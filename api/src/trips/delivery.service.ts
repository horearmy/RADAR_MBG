import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryReviewStatus,
  DeliveryStatus,
  Prisma,
  TrackingStatus,
  TripStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertTripTransition } from './trip-transitions.js';
import { PrismaService } from '../database/prisma.service.js';
import { ReviewDeliveryDto, SubmitDeliveryDto } from './delivery.dto.js';
import { InvalidDeliveryQuantityError, reconcileDeliveryQuantities } from './delivery-policy.js';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async startDelivery(
    tripId: string,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      this.assertTenantTrip(trip.tenantId, tenantContext);
      await this.assertTripScope(trip, principal, tx);

      const replay = await this.findEventReplay(tx, tripId, idempotencyKey, 'TRIP.DELIVERY_STARTED');
      if (replay) return { tripId, status: trip.status, replayed: true };

      this.assertTransition(trip.status, TripStatus.DELIVERY_IN_PROGRESS);
      const now = new Date();
      const updated = await tx.trip.updateMany({
        where: { id: tripId, status: trip.status, version: trip.version },
        data: {
          status: TripStatus.DELIVERY_IN_PROGRESS,
          deliveryStatus: DeliveryStatus.IN_PROGRESS,
          deliveryStartedAt: now,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

      await this.writeTripEventAndAudit(tx, {
        tripId,
        actorUserId: principal.id,
        eventType: 'TRIP.DELIVERY_STARTED',
        idempotencyKey,
        requestId,
        before: { status: trip.status, version: trip.version },
        after: { status: TripStatus.DELIVERY_IN_PROGRESS, version: trip.version + 1 },
      });

      return { tripId, status: TripStatus.DELIVERY_IN_PROGRESS, startedAt: now, replayed: false };
    });
  }

  async submitDelivery(
    tripId: string,
    principal: SessionPrincipal,
    input: SubmitDeliveryDto,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const requestHash = this.hash(JSON.stringify({
      receivedQuantity: input.receivedQuantity,
      damagedQuantity: input.damagedQuantity ?? 0,
      varianceReason: input.varianceReason?.trim() ?? null,
      confirmationNote: input.confirmationNote?.trim() ?? null,
      deviceTimestamp: input.deviceTimestamp ?? null,
    }));

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      this.assertTenantTrip(trip.tenantId, tenantContext);
      await this.assertTripScope(trip, principal, tx);

      const replay = await tx.deliveryRecord.findUnique({ where: { idempotencyKey } });
      if (replay) {
        if (
          replay.tripId !== tripId ||
          replay.receiverUserId !== principal.id ||
          replay.requestHash !== requestHash
        ) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return this.presentDelivery(replay, true);
      }

      const current = await tx.deliveryRecord.findFirst({
        where: { tripId, isCurrent: true },
        orderBy: { version: 'desc' },
      });
      const isCorrection = trip.status === TripStatus.DELIVERED && current?.reviewStatus === DeliveryReviewStatus.REJECTED;
      if (trip.status !== TripStatus.DELIVERY_IN_PROGRESS && !isCorrection) {
        throw new ConflictException({ code: 'DELIVERY_NOT_IN_PROGRESS' });
      }
      if (trip.dispatchedQuantity === null) {
        throw new ConflictException({ code: 'DISPATCH_QUANTITY_REQUIRED' });
      }

      const damagedQuantity = input.damagedQuantity ?? 0;
      let reconciliation;
      try {
        reconciliation = reconcileDeliveryQuantities(
          trip.dispatchedQuantity,
          input.receivedQuantity,
          damagedQuantity,
        );
      } catch (error) {
        if (error instanceof InvalidDeliveryQuantityError) {
          throw new BadRequestException({ code: 'DELIVERY_QUANTITY_EXCEEDS_DISPATCH' });
        }
        throw error;
      }
      const shortageQuantity = reconciliation.shortageQuantity;
      const hasVariance = reconciliation.hasVariance;
      const varianceReason = input.varianceReason?.trim();
      if (hasVariance && !varianceReason) {
        throw new BadRequestException({ code: 'VARIANCE_REASON_REQUIRED' });
      }
      if (isCorrection && !varianceReason) {
        throw new BadRequestException({ code: 'CORRECTION_REASON_REQUIRED' });
      }
      if (current && !isCorrection) {
        throw new ConflictException({ code: 'DELIVERY_RECORD_ALREADY_SUBMITTED' });
      }

      const now = new Date();
      if (current) {
        await tx.deliveryRecord.update({
          where: { id: current.id },
          data: { isCurrent: false },
        });
        await tx.deliveryAdjustment.create({
          data: {
            deliveryRecordId: current.id,
            actorUserId: principal.id,
            reason: varianceReason ?? 'Correction submitted after previous review rejection',
            before: {
              receivedQuantity: current.receivedQuantity,
              damagedQuantity: current.damagedQuantity,
              shortageQuantity: current.shortageQuantity,
              reviewStatus: current.reviewStatus,
            },
            after: {
              receivedQuantity: input.receivedQuantity,
              damagedQuantity,
              shortageQuantity,
            },
          },
        });
      }

      const reviewStatus = hasVariance
        ? DeliveryReviewStatus.PENDING_REVIEW
        : DeliveryReviewStatus.ACCEPTED;
      const record = await tx.deliveryRecord.create({
        data: {
          tripId,
          version: (current?.version ?? 0) + 1,
          isCurrent: true,
          plannedQuantity: trip.plannedQuantity,
          dispatchedQuantity: trip.dispatchedQuantity,
          receivedQuantity: input.receivedQuantity,
          damagedQuantity,
          shortageQuantity,
          varianceReason,
          receiverUserId: principal.id,
          confirmationNote: input.confirmationNote?.trim(),
          deviceTimestamp: input.deviceTimestamp ? new Date(input.deviceTimestamp) : undefined,
          serverReceivedAt: now,
          reviewStatus,
          idempotencyKey,
          requestHash,
        },
      });

      const nextDeliveryStatus = hasVariance
        ? DeliveryStatus.UNDER_REVIEW
        : DeliveryStatus.DELIVERED;
      const nextTripStatus = isCorrection ? trip.status : TripStatus.DELIVERED;
      const updated = await tx.trip.updateMany({
        where: { id: tripId, status: trip.status, version: trip.version },
        data: {
          status: nextTripStatus,
          deliveryStatus: nextDeliveryStatus,
          deliveredAt: trip.deliveredAt ?? now,
          receivedQuantity: input.receivedQuantity,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

      await this.writeTripEventAndAudit(tx, {
        tripId,
        actorUserId: principal.id,
        eventType: isCorrection ? 'POD.CORRECTED' : 'POD.SUBMITTED',
        idempotencyKey,
        requestId,
        reason: varianceReason,
        before: {
          status: trip.status,
          deliveryStatus: trip.deliveryStatus,
          version: trip.version,
        },
        after: {
          status: nextTripStatus,
          deliveryStatus: nextDeliveryStatus,
          deliveryRecordId: record.id,
          version: trip.version + 1,
        },
        metadata: {
          plannedQuantity: trip.plannedQuantity,
          dispatchedQuantity: trip.dispatchedQuantity,
          receivedQuantity: input.receivedQuantity,
          damagedQuantity,
          shortageQuantity,
        },
      });

      return this.presentDelivery(record, false);
    });
  }

  async reviewDelivery(
    tripId: string,
    principal: SessionPrincipal,
    input: ReviewDeliveryDto,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      this.assertTenantTrip(trip.tenantId, tenantContext);
      await this.assertTripScope(trip, principal, tx);

      const eventType = input.decision === 'ACCEPT' ? 'POD.REVIEW_ACCEPTED' : 'POD.REVIEW_REJECTED';
      const replay = await tx.tripEvent.findUnique({
        where: { tripId_idempotencyKey: { tripId, idempotencyKey } },
        select: { eventType: true, actorUserId: true, metadata: true },
      });
      if (replay) {
        const expectedHash = this.hash(`${input.decision}:${input.reason.trim()}`);
        const metadata = replay.metadata as { requestHash?: string } | null;
        if (
          replay.eventType !== eventType ||
          replay.actorUserId !== principal.id ||
          metadata?.requestHash !== expectedHash
        ) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        const current = await tx.deliveryRecord.findFirst({
          where: { tripId, isCurrent: true },
          orderBy: { version: 'desc' },
        });
        return { record: current ? this.presentDelivery(current, true) : null, replayed: true };
      }

      const record = await tx.deliveryRecord.findFirst({
        where: { tripId, isCurrent: true },
        orderBy: { version: 'desc' },
      });
      if (!record || record.reviewStatus !== DeliveryReviewStatus.PENDING_REVIEW) {
        throw new ConflictException({ code: 'DELIVERY_REVIEW_NOT_PENDING' });
      }
      if (record.receiverUserId === principal.id) {
        throw new ForbiddenException({ code: 'SELF_REVIEW_FORBIDDEN' });
      }

      const now = new Date();
      const reviewStatus = input.decision === 'ACCEPT'
        ? DeliveryReviewStatus.ACCEPTED
        : DeliveryReviewStatus.REJECTED;
      const nextDeliveryStatus = input.decision === 'REJECT'
        ? DeliveryStatus.UNDER_REVIEW
        : record.receivedQuantity < record.dispatchedQuantity
          ? DeliveryStatus.PARTIAL
          : DeliveryStatus.DELIVERED;

      await tx.deliveryRecord.update({
        where: { id: record.id },
        data: {
          reviewStatus,
          reviewedBy: principal.id,
          reviewedAt: now,
          reviewReason: input.reason,
        },
      });
      const updated = await tx.trip.updateMany({
        where: { id: tripId, status: TripStatus.DELIVERED, version: trip.version },
        data: { deliveryStatus: nextDeliveryStatus, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

      await this.writeTripEventAndAudit(tx, {
        tripId,
        actorUserId: principal.id,
        eventType,
        idempotencyKey,
        requestId,
        reason: input.reason,
        before: { deliveryStatus: trip.deliveryStatus, reviewStatus: record.reviewStatus },
        after: { deliveryStatus: nextDeliveryStatus, reviewStatus },
        metadata: {
          deliveryRecordId: record.id,
          version: record.version,
          requestHash: this.hash(`${input.decision}:${input.reason.trim()}`),
        },
      });

      return {
        record: {
          ...this.presentDelivery(record, false),
          reviewStatus,
          reviewedBy: principal.id,
          reviewedAt: now,
          reviewReason: input.reason,
        },
        replayed: false,
      };
    });
  }

  async completeTrip(
    tripId: string,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      this.assertTenantTrip(trip.tenantId, tenantContext);
      await this.assertTripScope(trip, principal, tx);

      const replay = await this.findEventReplay(tx, tripId, idempotencyKey, 'TRIP.COMPLETED');
      if (replay) return { tripId, status: trip.status, replayed: true };

      const record = await tx.deliveryRecord.findFirst({
        where: { tripId, isCurrent: true },
        orderBy: { version: 'desc' },
      });
      if (
        trip.deliveryStatus === DeliveryStatus.UNDER_REVIEW ||
        !record ||
        record.reviewStatus !== DeliveryReviewStatus.ACCEPTED
      ) {
        throw new ConflictException({ code: 'DELIVERY_RECONCILIATION_REQUIRED' });
      }

      this.assertTransition(trip.status, TripStatus.COMPLETED);
      const now = new Date();
      const updated = await tx.trip.updateMany({
        where: { id: tripId, status: trip.status, version: trip.version },
        data: {
          status: TripStatus.COMPLETED,
          trackingStatus: TrackingStatus.ENDED,
          completedAt: now,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

      await this.writeTripEventAndAudit(tx, {
        tripId,
        actorUserId: principal.id,
        eventType: 'TRIP.COMPLETED',
        idempotencyKey,
        requestId,
        before: { status: trip.status, version: trip.version },
        after: { status: TripStatus.COMPLETED, version: trip.version + 1 },
      });

      return { tripId, status: TripStatus.COMPLETED, completedAt: now, replayed: false };
    });
  }

  private async assertTripScope(
    trip: Prisma.TripGetPayload<{}>,
    principal: SessionPrincipal,
    tx: Prisma.TransactionClient,
  ) {
    const source = await tx.sppg.findUnique({
      where: { id: trip.sppgId },
      select: { id: true, organizationId: true, regionId: true },
    });
    const destination = await tx.deliveryLocation.findUnique({
      where: { id: trip.deliveryLocationId },
      select: { organizationId: true, regionId: true },
    });
    if (!source || !destination) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });

    const inScope = principal.roles.some(
      (role) =>
        role.isGlobal ||
        role.organizationId === trip.organizationId ||
        role.regionId === source.regionId ||
        role.regionId === destination.regionId ||
        role.sppgId === source.id,
    );
    const requiresDriverScope =
      principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    if (
      !inScope ||
      (requiresDriverScope && !principal.roles.some((role) => role.isGlobal) &&
        (!principal.driverId || principal.driverId !== trip.driverId))
    ) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }
  }

  private assertTenantTrip(tripTenantId: string, tenantContext?: { tenantId: string } | null) {
    if (tripTenantId !== (tenantContext?.tenantId ?? null)) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }
  }

  private async findEventReplay(
    tx: Prisma.TransactionClient,
    tripId: string,
    idempotencyKey: string,
    eventType: string,
  ) {
    const event = await tx.tripEvent.findUnique({
      where: { tripId_idempotencyKey: { tripId, idempotencyKey } },
      select: { eventType: true },
    });
    if (!event) return false;
    if (event.eventType !== eventType) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
    return true;
  }

  private async writeTripEventAndAudit(
    tx: Prisma.TransactionClient,
    input: {
      tripId: string;
      actorUserId: string;
      eventType: string;
      idempotencyKey: string;
      requestId: string;
      reason?: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.tripEvent.create({
      data: {
        tripId: input.tripId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.eventType.toLowerCase(),
        entityType: 'trip',
        entityId: input.tripId,
        result: 'success',
        reason: input.reason,
        before: input.before,
        after: input.after,
        requestId: input.requestId,
      },
    });
  }

  private presentDelivery<T extends {
    id: string;
    tripId: string;
    version: number;
    plannedQuantity: number;
    dispatchedQuantity: number;
    receivedQuantity: number;
    damagedQuantity: number;
    shortageQuantity: number;
    varianceReason: string | null;
    reviewStatus: DeliveryReviewStatus;
    serverReceivedAt: Date;
  }>(record: T, replayed: boolean) {
    return {
      deliveryRecordId: record.id,
      tripId: record.tripId,
      version: record.version,
      plannedQuantity: record.plannedQuantity,
      dispatchedQuantity: record.dispatchedQuantity,
      receivedQuantity: record.receivedQuantity,
      damagedQuantity: record.damagedQuantity,
      shortageQuantity: record.shortageQuantity,
      varianceReason: record.varianceReason,
      reviewStatus: record.reviewStatus,
      serverReceivedAt: record.serverReceivedAt,
      replayed,
    };
  }

  private assertTransition(current: TripStatus, next: TripStatus) {
    try {
      assertTripTransition(current, next);
    } catch {
      throw new ConflictException({
        code: 'ILLEGAL_TRIP_TRANSITION',
        current,
        next,
      });
    }
  }

  private assertIdempotencyKey(key: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
