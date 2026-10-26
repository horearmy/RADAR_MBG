import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArrivalVerificationResult,
  Prisma,
  QrTokenStatus,
  TripStatus,
  ArrivalVerificationStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertSppgAccess } from '../auth/permissions.js';
import { PrismaService } from '../database/prisma.service.js';
import { distanceMeters } from './trip-geo.js';
import { IssueQrTokenDto, OverrideArrivalDto, VerifyArrivalDto } from './arrival.dto.js';

const QR_ISSUE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.READY_TO_DEPART,
  TripStatus.IN_TRANSIT,
  TripStatus.ARRIVAL_DETECTED,
];

@Injectable()
export class ArrivalService {
  private readonly verifyBuckets = new Map<string, { count: number; resetAt: number }>();
  private requestCount = 0;

  constructor(private readonly prisma: PrismaService) {}

  async issueQrToken(
    tripId: string,
    principal: SessionPrincipal,
    input: IssueQrTokenDto,
    requestId: string,
  ) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000);

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          sppg: { select: { id: true, organizationId: true, regionId: true } },
        },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      assertSppgAccess(principal, {
        organizationId: trip.sppg.organizationId,
        regionId: trip.sppg.regionId,
        sppgId: trip.sppg.id,
      });
      if (!QR_ISSUE_TRIP_STATUSES.includes(trip.status)) {
        throw new ConflictException({ code: 'TRIP_NOT_READY_FOR_QR' });
      }

      await tx.qrToken.updateMany({
        where: {
          tripId,
          deliveryLocationId: trip.deliveryLocationId,
          status: QrTokenStatus.ACTIVE,
          expiresAt: { lte: now },
        },
        data: { status: QrTokenStatus.EXPIRED },
      });
      await tx.qrToken.updateMany({
        where: {
          tripId,
          deliveryLocationId: trip.deliveryLocationId,
          status: QrTokenStatus.ACTIVE,
        },
        data: { status: QrTokenStatus.REVOKED },
      });

      const qrToken = await tx.qrToken.create({
        data: {
          tokenHash,
          deliveryLocationId: trip.deliveryLocationId,
          tripId,
          issuedBy: principal.id,
          expiresAt,
        },
      });
      await tx.tripEvent.create({
        data: {
          tripId,
          actorUserId: principal.id,
          eventType: 'QR.TOKEN_ISSUED',
          occurredAt: now,
          metadata: { qrTokenId: qrToken.id, expiresAt: expiresAt.toISOString() },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'qr.token.issue',
          entityType: 'qr_token',
          entityId: qrToken.id,
          result: 'success',
          after: { tripId, deliveryLocationId: trip.deliveryLocationId, expiresAt: expiresAt.toISOString() },
          requestId,
        },
      });

      return {
        token: rawToken,
        tokenId: qrToken.id,
        expiresAt: expiresAt.toISOString(),
        deliveryLocationId: trip.deliveryLocationId,
      };
    });
  }

  async verifyArrival(
    tripId: string,
    principal: SessionPrincipal,
    input: VerifyArrivalDto,
    idempotencyKey: string,
    requestId: string,
  ) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    this.assertVerificationRateLimit(principal.id, tripId);

    const now = new Date();
    const deviceTimestamp = new Date(input.deviceTimestamp);
    const tokenHash = this.hash(input.qrToken);
    const requestHash = this.hash([
      tokenHash,
      input.latitude,
      input.longitude,
      input.accuracyMeters,
      deviceTimestamp.toISOString(),
    ].join(':'));

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          sppg: { select: { id: true, organizationId: true, regionId: true } },
          deliveryLocation: {
            include: {
              geofences: {
                where: { active: true, type: 'DELIVERY' },
                orderBy: { version: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      this.assertArrivalScope(principal, trip);

      const replay = await tx.arrivalVerification.findUnique({
        where: { tripId_idempotencyKey: { tripId, idempotencyKey } },
      });
      if (replay) {
        if (replay.actorUserId !== principal.id || replay.requestHash !== requestHash) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return { result: replay.result, reasonCode: replay.reasonCode, replayed: true };
      }

      const qrToken = await tx.qrToken.findUnique({ where: { tokenHash } });
      if (!qrToken) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          result: ArrivalVerificationResult.INVALID_QR,
          reasonCode: 'INVALID_OR_EXPIRED_TOKEN',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      if (
        qrToken.deliveryLocationId !== trip.deliveryLocationId ||
        (qrToken.tripId !== null && qrToken.tripId !== tripId)
      ) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.WRONG_DESTINATION,
          reasonCode: 'TOKEN_CONTEXT_MISMATCH',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      if (qrToken.status !== QrTokenStatus.ACTIVE || qrToken.expiresAt <= now) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.INVALID_QR,
          reasonCode: qrToken.status === QrTokenStatus.USED ? 'TOKEN_ALREADY_USED' : 'TOKEN_EXPIRED',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      if (trip.status !== TripStatus.ARRIVAL_DETECTED) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.PENDING_LOCATION,
          reasonCode: 'ARRIVAL_GEOFENCE_NOT_CONFIRMED',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      const geofence = trip.deliveryLocation.geofences[0];
      if (!geofence) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.MANUAL_REVIEW_REQUIRED,
          reasonCode: 'DESTINATION_GEOFENCE_NOT_CONFIGURED',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      const maxAccuracy = Math.min(
        Number(process.env.GPS_MAX_ACCURACY_M ?? 50),
        Number(geofence.minGpsAccuracyMeters),
      );
      if (!Number.isFinite(maxAccuracy) || input.accuracyMeters > maxAccuracy) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.GPS_ACCURACY_INSUFFICIENT,
          reasonCode: 'GPS_ACCURACY_THRESHOLD',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      const maxAgeSeconds = Number(process.env.GPS_LIVE_MAX_AGE_SECONDS ?? 90);
      const maxFutureSeconds = Number(process.env.GPS_MAX_FUTURE_SKEW_SECONDS ?? 30);
      if (
        now.getTime() - deviceTimestamp.getTime() > maxAgeSeconds * 1000 ||
        deviceTimestamp.getTime() - now.getTime() > maxFutureSeconds * 1000
      ) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.PENDING_LOCATION,
          reasonCode: 'GPS_TIMESTAMP_STALE_OR_INVALID',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      const distance = distanceMeters(
        input.latitude,
        input.longitude,
        Number(geofence.centerLatitude),
        Number(geofence.centerLongitude),
      );
      if (distance > Number(geofence.radiusMeters)) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.PENDING_LOCATION,
          reasonCode: 'OUTSIDE_DESTINATION_GEOFENCE',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      const tokenUsed = await tx.qrToken.updateMany({
        where: { id: qrToken.id, status: QrTokenStatus.ACTIVE, expiresAt: { gt: now } },
        data: { status: QrTokenStatus.USED, usedAt: now, usedBy: principal.id },
      });
      if (tokenUsed.count !== 1) {
        return this.recordAttempt(tx, {
          tripId,
          actorUserId: principal.id,
          qrTokenId: qrToken.id,
          result: ArrivalVerificationResult.INVALID_QR,
          reasonCode: 'TOKEN_ALREADY_USED',
          requestHash,
          idempotencyKey,
          requestId,
          input,
          deviceTimestamp,
          now,
        });
      }

      const changed = await tx.trip.updateMany({
        where: { id: tripId, status: TripStatus.ARRIVAL_DETECTED, version: trip.version },
        data: {
          status: TripStatus.ARRIVAL_VERIFIED,
          verificationStatus: ArrivalVerificationStatus.VERIFIED,
          arrivalVerifiedAt: now,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }

      const verification = await tx.arrivalVerification.create({
        data: {
          tripId,
          qrTokenId: qrToken.id,
          actorUserId: principal.id,
          result: ArrivalVerificationResult.VERIFIED,
          requestHash,
          latitude: input.latitude,
          longitude: input.longitude,
          gpsAccuracyMeters: input.accuracyMeters,
          deviceTimestamp,
          serverReceivedAt: now,
          idempotencyKey,
        },
      });
      await tx.tripEvent.create({
        data: {
          tripId,
          actorUserId: principal.id,
          eventType: 'TRIP.ARRIVAL_VERIFIED',
          fromStatus: TripStatus.ARRIVAL_DETECTED,
          toStatus: TripStatus.ARRIVAL_VERIFIED,
          occurredAt: now,
          deviceTimestamp,
          idempotencyKey,
          metadata: { verificationId: verification.id, qrTokenId: qrToken.id },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'trip.arrival.verify',
          entityType: 'trip',
          entityId: tripId,
          result: 'success',
          before: { status: TripStatus.ARRIVAL_DETECTED, version: trip.version },
          after: { status: TripStatus.ARRIVAL_VERIFIED, version: trip.version + 1 },
          requestId,
        },
      });

      return {
        result: ArrivalVerificationResult.VERIFIED,
        reasonCode: null,
        verificationId: verification.id,
        verifiedAt: now.toISOString(),
        replayed: false,
      };
    });
  }

  async overrideArrival(
    tripId: string,
    principal: SessionPrincipal,
    input: OverrideArrivalDto,
    idempotencyKey: string,
    requestId: string,
  ) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    const now = new Date();
    const requestHash = this.hash([
      input.version,
      input.reason,
      input.evidenceNote ?? '',
    ].join(':'));

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          sppg: { select: { id: true, organizationId: true, regionId: true } },
          deliveryLocation: { select: { regionId: true } },
        },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      this.assertArrivalScope(principal, trip);

      const replay = await tx.arrivalOverride.findUnique({
        where: { tripId_idempotencyKey: { tripId, idempotencyKey } },
      });
      if (replay) {
        if (replay.actorUserId !== principal.id || replay.requestHash !== requestHash) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return {
          result: 'VERIFIED',
          reasonCode: 'MANUAL_OVERRIDE',
          overrideId: replay.id,
          verifiedAt: replay.createdAt.toISOString(),
          replayed: true,
        };
      }

      if (trip.version !== input.version) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }
      if (trip.status !== TripStatus.IN_TRANSIT && trip.status !== TripStatus.ARRIVAL_DETECTED) {
        throw new ConflictException({ code: 'TRIP_NOT_OVERRIDABLE' });
      }

      const changed = await tx.trip.updateMany({
        where: { id: tripId, status: trip.status, version: trip.version },
        data: {
          status: TripStatus.ARRIVAL_VERIFIED,
          verificationStatus: ArrivalVerificationStatus.OVERRIDDEN,
          arrivalVerifiedAt: now,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }

      const override = await tx.arrivalOverride.create({
        data: {
          tripId,
          actorUserId: principal.id,
          decision: 'VERIFIED',
          reason: input.reason.trim(),
          evidenceNote: input.evidenceNote?.trim(),
          fromStatus: trip.status,
          toStatus: TripStatus.ARRIVAL_VERIFIED,
          requestHash,
          idempotencyKey,
          createdAt: now,
        },
      });
      await tx.tripEvent.create({
        data: {
          tripId,
          actorUserId: principal.id,
          eventType: 'TRIP.ARRIVAL_OVERRIDDEN',
          fromStatus: trip.status,
          toStatus: TripStatus.ARRIVAL_VERIFIED,
          reason: input.reason.trim(),
          occurredAt: now,
          idempotencyKey,
          metadata: {
            overrideId: override.id,
            evidenceNote: input.evidenceNote?.trim() ?? null,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'trip.arrival.override',
          entityType: 'trip',
          entityId: tripId,
          result: 'success',
          reason: input.reason.trim(),
          before: { status: trip.status, version: trip.version },
          after: { status: TripStatus.ARRIVAL_VERIFIED, version: trip.version + 1 },
          requestId,
        },
      });

      return {
        result: 'VERIFIED',
        reasonCode: 'MANUAL_OVERRIDE',
        overrideId: override.id,
        verifiedAt: now.toISOString(),
        replayed: false,
      };
    });
  }

  private async recordAttempt(
    tx: Prisma.TransactionClient,
    data: {
      tripId: string;
      actorUserId: string;
      qrTokenId?: string;
      result: ArrivalVerificationResult;
      reasonCode: string;
      requestHash: string;
      idempotencyKey: string;
      requestId: string;
      input: VerifyArrivalDto;
      deviceTimestamp: Date;
      now: Date;
    },
  ) {
    const verification = await tx.arrivalVerification.create({
      data: {
        tripId: data.tripId,
        qrTokenId: data.qrTokenId,
        actorUserId: data.actorUserId,
        result: data.result,
        reasonCode: data.reasonCode,
        requestHash: data.requestHash,
        latitude: data.input.latitude,
        longitude: data.input.longitude,
        gpsAccuracyMeters: data.input.accuracyMeters,
        deviceTimestamp: data.deviceTimestamp,
        serverReceivedAt: data.now,
        idempotencyKey: data.idempotencyKey,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: 'trip.arrival.verify',
        entityType: 'trip',
        entityId: data.tripId,
        result: 'failure',
        reason: data.reasonCode,
        after: { verificationId: verification.id, result: data.result },
        requestId: data.requestId,
      },
    });

    if (
      data.result === ArrivalVerificationResult.PENDING_LOCATION ||
      data.result === ArrivalVerificationResult.GPS_ACCURACY_INSUFFICIENT ||
      data.result === ArrivalVerificationResult.MANUAL_REVIEW_REQUIRED
    ) {
      await tx.trip.updateMany({
        where: { id: data.tripId, status: TripStatus.ARRIVAL_DETECTED },
        data: {
          verificationStatus:
            data.result === ArrivalVerificationResult.MANUAL_REVIEW_REQUIRED
              ? ArrivalVerificationStatus.MANUAL_REVIEW
              : ArrivalVerificationStatus.PENDING,
          version: { increment: 1 },
        },
      });
    }

    return {
      result: data.result,
      reasonCode: data.reasonCode,
      verificationId: verification.id,
      replayed: false,
    };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private assertVerificationRateLimit(userId: string, tripId: string) {
    const now = Date.now();
    const key = `${userId}:${tripId}`;
    const limit = Number(process.env.QR_VERIFY_RATE_PER_MINUTE ?? 30);
    this.requestCount += 1;

    if (this.requestCount % 128 === 0) {
      for (const [bucketKey, bucket] of this.verifyBuckets) {
        if (bucket.resetAt <= now) this.verifyBuckets.delete(bucketKey);
      }
    }

    const bucket = this.verifyBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!Number.isInteger(limit) || limit < 1 || this.verifyBuckets.size >= 10_000) {
        throw new HttpException({ code: 'QR_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      this.verifyBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException({ code: 'QR_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private assertArrivalScope(
    principal: SessionPrincipal,
    trip: {
      id: string;
      organizationId: string;
      driverId: string;
      sppg: { id: string; organizationId: string; regionId: string };
      deliveryLocation: { regionId: string };
    },
  ) {
    const hasGlobalRole = principal.roles.some((role) => role.isGlobal);
    const inScope = principal.roles.some(
      (role) =>
        role.isGlobal ||
        role.organizationId === trip.organizationId ||
        role.regionId === trip.deliveryLocation.regionId ||
        role.sppgId === trip.sppg.id,
    );
    const needsDriverScope =
      principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');

    if (
      !inScope ||
      (needsDriverScope && !hasGlobalRole && principal.driverId !== trip.driverId)
    ) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }
  }
}
