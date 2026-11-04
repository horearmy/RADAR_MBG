import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverStatus,
  Prisma,
  SppgStatus,
  TrackingStatus,
  TripStatus,
  VehicleStatus,
} from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertSppgAccess } from '../auth/permissions.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CancelTripDto,
  ChangeDestinationDto,
  CreateTripDto,
  ListTripsDto,
  ReassignTripDto,
  RescheduleTripDto,
  StartTripDto,
} from './trip.dto.js';
import { isWithinRadius } from './trip-geo.js';
import {
  assertTripTransition,
  InvalidTripTransitionError,
} from './trip-transitions.js';

const TERMINAL_STATUSES = [TripStatus.COMPLETED, TripStatus.CANCELLED];

const TRIP_STATUS_LABELS: Array<{ status: TripStatus; label: string }> = [
  { status: TripStatus.DRAFT, label: 'draf' },
  { status: TripStatus.SCHEDULED, label: 'terjadwal' },
  { status: TripStatus.READY_TO_DEPART, label: 'siap berangkat' },
  { status: TripStatus.IN_TRANSIT, label: 'dalam perjalanan' },
  { status: TripStatus.ARRIVAL_DETECTED, label: 'kedatangan terdeteksi' },
  { status: TripStatus.ARRIVAL_VERIFIED, label: 'kedatangan terverifikasi' },
  { status: TripStatus.DELIVERY_IN_PROGRESS, label: 'penyaluran berlangsung' },
  { status: TripStatus.DELIVERED, label: 'terkirim' },
  { status: TripStatus.COMPLETED, label: 'selesai' },
  { status: TripStatus.CANCELLED, label: 'dibatalkan' },
  { status: TripStatus.EXCEPTION, label: 'perlu perhatian' },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TripService {
  constructor(private readonly prisma: PrismaService) {}

  async listTrips(principal: SessionPrincipal, query: ListTripsDto, tenantContext?: { tenantId: string } | null) {
    const search = query.q ? this.searchWhere(query.q) : null;
    const where: Prisma.TripWhereInput = {
      AND: [
        this.scopeWhere(principal, tenantContext),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.from || query.to
          ? [
              {
                plannedDepartureAt: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              },
            ]
          : []),
        ...(search ? [{ OR: search }] : []),
      ],
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.db.trip.findMany({
        where,
        orderBy: { plannedDepartureAt: 'desc' },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          status: true,
          trackingStatus: true,
          verificationStatus: true,
          deliveryStatus: true,
          plannedDepartureAt: true,
          plannedArrivalAt: true,
          actualDepartureAt: true,
          plannedQuantity: true,
          dispatchedQuantity: true,
          receivedQuantity: true,
          version: true,
          sppg: { select: { id: true, code: true, name: true } },
          deliveryLocation: { select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true } },
          driver: { select: { id: true, code: true, name: true } },
          vehicle: { select: { id: true, plateNumber: true } },
          positions: {
            orderBy: [{ deviceTimestamp: 'desc' }, { serverReceivedAt: 'desc' }],
            take: 1,
            select: {
              latitude: true,
              longitude: true,
              accuracyMeters: true,
              speedMps: true,
              headingDegrees: true,
              deviceTimestamp: true,
              serverReceivedAt: true,
              integrityFlags: true,
            },
          },
        },
      }),
      this.prisma.db.trip.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getTrip(id: string, principal: SessionPrincipal, tenantContext?: { tenantId: string } | null) {
    const trip = await this.prisma.db.trip.findFirst({
      where: { id, ...this.scopeWhere(principal, tenantContext) },
      select: {
        id: true,
        status: true,
        trackingStatus: true,
        verificationStatus: true,
        deliveryStatus: true,
        plannedDepartureAt: true,
        plannedArrivalAt: true,
        actualDepartureAt: true,
        arrivalDetectedAt: true,
        arrivalVerifiedAt: true,
        deliveryStartedAt: true,
        deliveredAt: true,
        completedAt: true,
        plannedQuantity: true,
        dispatchedQuantity: true,
        receivedQuantity: true,
        version: true,
        sppg: { select: { id: true, code: true, name: true } },
        deliveryLocation: { select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true } },
        driver: { select: { id: true, code: true, name: true } },
        vehicle: { select: { id: true, plateNumber: true, label: true } },
        positions: {
          orderBy: [{ deviceTimestamp: 'desc' }, { serverReceivedAt: 'desc' }],
          take: 1,
          select: {
            latitude: true,
            longitude: true,
            accuracyMeters: true,
            speedMps: true,
            headingDegrees: true,
            deviceTimestamp: true,
            serverReceivedAt: true,
            integrityFlags: true,
          },
        },
        deliveryRecords: {
          where: { isCurrent: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            plannedQuantity: true,
            dispatchedQuantity: true,
            receivedQuantity: true,
            damagedQuantity: true,
            shortageQuantity: true,
            reviewStatus: true,
            reviewReason: true,
            createdAt: true,
          },
        },
        events: {
          orderBy: { occurredAt: 'asc' },
          select: {
            id: true,
            eventType: true,
            fromStatus: true,
            toStatus: true,
            reason: true,
            occurredAt: true,
          },
        },
      },
    });

    if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    return trip;
  }

  async createTrip(
    input: CreateTripDto,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const plannedDepartureAt = new Date(input.plannedDepartureAt);
    const plannedArrivalAt = new Date(input.plannedArrivalAt);
    if (plannedArrivalAt <= plannedDepartureAt) {
      throw new BadRequestException({ code: 'INVALID_TRIP_SCHEDULE' });
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const replay = await tx.trip.findFirst({ where: { idempotencyKey, ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}) } });
        if (replay) {
          if (tenantContext && replay.tenantId !== tenantContext.tenantId) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
          await this.assertTripScope(replay.sppgId, replay.driverId, principal, tx);
          this.assertCreateReplayMatches(replay, input, plannedDepartureAt, plannedArrivalAt);
          return { trip: this.presentTrip(replay), replayed: true };
        }

        const source = await tx.sppg.findUnique({
          where: { id: input.sppgId },
          select: { id: true, organizationId: true, regionId: true, status: true },
        });
        if (!source || source.status !== SppgStatus.ACTIVE) {
          throw new BadRequestException({ code: 'SPPG_NOT_ACTIVE' });
        }
        assertSppgAccess(principal, {
          organizationId: source.organizationId,
          regionId: source.regionId,
          sppgId: source.id,
        });

        const [destination, vehicle, driver] = await Promise.all([
          tx.deliveryLocation.findFirst({
            where: {
              id: input.deliveryLocationId,
              organizationId: source.organizationId,
              active: true,
              ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
            },
            select: { id: true, organizationId: true, regionId: true, tenantId: true },
          }),
          tx.vehicle.findFirst({
            where: {
              id: input.vehicleId,
              ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
              organizationId: source.organizationId,
              sppgId: source.id,
              status: VehicleStatus.ACTIVE,
            },
            select: { id: true },
          }),
          tx.driver.findFirst({
            where: {
              id: input.driverId,
              ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
              sppgId: source.id,
              status: DriverStatus.ACTIVE,
            },
            select: { id: true },
          }),
        ]);

        if (!destination) throw new NotFoundException({ code: 'INVALID_DESTINATION' });
        if (tenantContext && destination.tenantId !== tenantContext.tenantId) {
          throw new NotFoundException({ code: 'INVALID_DESTINATION' });
        }
        if (!principal.roles.some((role) =>
          role.isGlobal ||
          role.organizationId === destination.organizationId ||
          role.regionId === destination.regionId ||
          (role.sppgId === source.id && source.regionId === destination.regionId)
        )) {
          throw new NotFoundException({ code: 'INVALID_DESTINATION' });
        }
        if (!vehicle) throw new BadRequestException({ code: 'VEHICLE_NOT_AVAILABLE' });
        if (!driver) throw new BadRequestException({ code: 'DRIVER_NOT_AVAILABLE' });

        const collision = await tx.trip.findFirst({
          where: {
            ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
            status: { notIn: TERMINAL_STATUSES },
            plannedDepartureAt: { lt: plannedArrivalAt },
            plannedArrivalAt: { gt: plannedDepartureAt },
            OR: [{ vehicleId: vehicle.id }, { driverId: driver.id }],
          },
          select: { id: true },
        });
        if (collision) {
          throw new ConflictException({ code: 'RESOURCE_ALREADY_ASSIGNED' });
        }

        const tenant = await tx.tenant.findUnique({ where: { legacySppgId: source.id } });
        if (!tenant) throw new BadRequestException({ code: 'TENANT_NOT_FOUND' });

        const trip = await tx.trip.create({
          data: {
            tenantId: tenant.id,
            organizationId: source.organizationId,
            sppgId: source.id,
            deliveryLocationId: destination.id,
            vehicleId: vehicle.id,
            driverId: driver.id,
            createdBy: principal.id,
            idempotencyKey,
            plannedDepartureAt,
            plannedArrivalAt,
            plannedQuantity: input.plannedQuantity,
          },
        });

        await this.writeEventAndAudit(tx, {
          tripId: trip.id,
          actorUserId: principal.id,
          eventType: 'TRIP.CREATED',
          toStatus: trip.status,
          idempotencyKey,
          requestId,
          after: { status: trip.status, version: trip.version },
        });

        return { trip: this.presentTrip(trip), replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException({ code: 'RESOURCE_ASSIGNMENT_CONFLICT_RETRY' });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.db.trip.findFirst({
          where: { idempotencyKey, ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}) },
        });
        if (replay) {
          if (tenantContext && replay.tenantId !== tenantContext.tenantId) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
          await this.assertTripScope(replay.sppgId, replay.driverId, principal);
          this.assertCreateReplayMatches(replay, input, plannedDepartureAt, plannedArrivalAt);
          return { trip: this.presentTrip(replay), replayed: true };
        }
      }
      throw error;
    }
  }

  async rescheduleTrip(
    id: string,
    input: RescheduleTripDto,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const plannedDepartureAt = new Date(input.plannedDepartureAt);
    const plannedArrivalAt = new Date(input.plannedArrivalAt);
    if (plannedArrivalAt <= plannedDepartureAt) {
      throw new BadRequestException({ code: 'INVALID_TRIP_SCHEDULE' });
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findFirst({ where: { id, ...this.scopeWhere(principal, tenantContext) } });
        if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
        if (tenantContext && trip.tenantId !== tenantContext.tenantId) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
        await this.assertTripScope(trip.sppgId, trip.driverId, principal, tx);

        const replay = await tx.tripEvent.findUnique({
          where: { tripId_idempotencyKey: { tripId: id, idempotencyKey } },
          select: { eventType: true },
        });
        if (replay) {
          if (replay.eventType !== 'TRIP.RESCHEDULED') {
            throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
          }
          return { trip: this.presentTrip(trip), replayed: true };
        }

        if (trip.status !== TripStatus.DRAFT && trip.status !== TripStatus.SCHEDULED) {
          throw new ConflictException({ code: 'TRIP_NOT_RESCHEDULABLE' });
        }
        if (trip.version !== input.version) {
          throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
        }

        const collision = await tx.trip.findFirst({
          where: {
            ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
            id: { not: trip.id },
            status: { notIn: TERMINAL_STATUSES },
            plannedDepartureAt: { lt: plannedArrivalAt },
            plannedArrivalAt: { gt: plannedDepartureAt },
            OR: [{ vehicleId: trip.vehicleId }, { driverId: trip.driverId }],
          },
          select: { id: true },
        });
        if (collision) throw new ConflictException({ code: 'RESOURCE_ALREADY_ASSIGNED' });

        const changed = await tx.trip.updateMany({
          where: { id, version: trip.version, ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}) },
          data: {
            plannedDepartureAt,
            plannedArrivalAt,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

        await this.writeEventAndAudit(tx, {
          tripId: trip.id,
          actorUserId: principal.id,
          eventType: 'TRIP.RESCHEDULED',
          fromStatus: trip.status,
          toStatus: trip.status,
          idempotencyKey,
          requestId,
          reason: input.reason,
          before: {
            plannedDepartureAt: trip.plannedDepartureAt,
            plannedArrivalAt: trip.plannedArrivalAt,
            version: trip.version,
          },
          after: {
            plannedDepartureAt,
            plannedArrivalAt,
            version: trip.version + 1,
          },
        });

        return {
          trip: this.presentTrip({
            ...trip,
            plannedDepartureAt,
            plannedArrivalAt,
            version: trip.version + 1,
          }),
          replayed: false,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({ code: 'RESOURCE_ASSIGNMENT_CONFLICT_RETRY' });
      }
      throw error;
    }
  }

  async reassignTrip(
    id: string,
    input: ReassignTripDto,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const trip = await tx.trip.findFirst({ where: { id, ...this.scopeWhere(principal, tenantContext) } });
        if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
        if (tenantContext && trip.tenantId !== tenantContext.tenantId) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
        await this.assertTripScope(trip.sppgId, trip.driverId, principal, tx);

        const replay = await tx.tripEvent.findUnique({
          where: { tripId_idempotencyKey: { tripId: id, idempotencyKey } },
          select: { eventType: true },
        });
        if (replay) {
          if (replay.eventType !== 'TRIP.REASSIGNED') {
            throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
          }
          return { trip: this.presentTrip(trip), replayed: true };
        }

        if (trip.status !== TripStatus.DRAFT && trip.status !== TripStatus.SCHEDULED) {
          throw new ConflictException({ code: 'TRIP_NOT_REASSIGNABLE' });
        }
        if (trip.version !== input.version) {
          throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
        }

        const [vehicle, driver] = await Promise.all([
          tx.vehicle.findFirst({
            where: {
              id: input.vehicleId,
              ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
              organizationId: trip.organizationId,
              sppgId: trip.sppgId,
              status: VehicleStatus.ACTIVE,
            },
            select: { id: true },
          }),
          tx.driver.findFirst({
            where: {
              id: input.driverId,
              ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
              sppgId: trip.sppgId,
              status: DriverStatus.ACTIVE,
            },
            select: { id: true },
          }),
        ]);
        if (!vehicle) throw new BadRequestException({ code: 'VEHICLE_NOT_AVAILABLE' });
        if (!driver) throw new BadRequestException({ code: 'DRIVER_NOT_AVAILABLE' });

        const collision = await tx.trip.findFirst({
          where: {
            ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
            id: { not: trip.id },
            status: { notIn: TERMINAL_STATUSES },
            plannedDepartureAt: { lt: trip.plannedArrivalAt },
            plannedArrivalAt: { gt: trip.plannedDepartureAt },
            OR: [{ vehicleId: vehicle.id }, { driverId: driver.id }],
          },
          select: { id: true },
        });
        if (collision) throw new ConflictException({ code: 'RESOURCE_ALREADY_ASSIGNED' });

        const changed = await tx.trip.updateMany({
          where: { id, version: trip.version, ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}) },
          data: {
            vehicleId: vehicle.id,
            driverId: driver.id,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

        await this.writeEventAndAudit(tx, {
          tripId: trip.id,
          actorUserId: principal.id,
          eventType: 'TRIP.REASSIGNED',
          fromStatus: trip.status,
          toStatus: trip.status,
          idempotencyKey,
          requestId,
          reason: input.reason,
          before: {
            vehicleId: trip.vehicleId,
            driverId: trip.driverId,
            version: trip.version,
          },
          after: {
            vehicleId: vehicle.id,
            driverId: driver.id,
            version: trip.version + 1,
          },
        });

        return {
          trip: this.presentTrip({
            ...trip,
            vehicleId: vehicle.id,
            driverId: driver.id,
            version: trip.version + 1,
          }),
          replayed: false,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({ code: 'RESOURCE_ASSIGNMENT_CONFLICT_RETRY' });
      }
      throw error;
    }
  }

  async changeDestination(
    id: string,
    input: ChangeDestinationDto,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findFirst({
        where: { id, ...this.scopeWhere(principal, tenantContext) },
        include: { sppg: { select: { id: true, organizationId: true, regionId: true } } },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      if (tenantContext && trip.tenantId !== tenantContext.tenantId) {
        throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      }
      await this.assertTripScope(trip.sppgId, trip.driverId, principal, tx);

      const replay = await tx.tripEvent.findUnique({
        where: { tripId_idempotencyKey: { tripId: id, idempotencyKey } },
        select: { eventType: true },
      });
      if (replay) {
        if (replay.eventType !== 'TRIP.DESTINATION_CHANGED') {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return { trip: this.presentTrip(trip), replayed: true };
      }

      if (trip.status !== TripStatus.DRAFT && trip.status !== TripStatus.SCHEDULED) {
        throw new ConflictException({ code: 'DESTINATION_CHANGE_REQUIRES_EXCEPTION' });
      }
      if (trip.version !== input.version) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }

      const destination = await tx.deliveryLocation.findFirst({
        where: {
          id: input.deliveryLocationId,
          organizationId: trip.sppg.organizationId,
          active: true,
          ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}),
        },
        select: { id: true, organizationId: true, regionId: true, tenantId: true },
      });
      if (!destination) throw new NotFoundException({ code: 'INVALID_DESTINATION' });
      if (!principal.roles.some((role) =>
        role.isGlobal ||
        role.organizationId === destination.organizationId ||
        role.regionId === destination.regionId ||
        (role.sppgId === trip.sppgId && trip.sppg.regionId === destination.regionId)
      )) {
        throw new NotFoundException({ code: 'INVALID_DESTINATION' });
      }

      const changed = await tx.trip.updateMany({
        where: { id, version: trip.version, ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}) },
        data: {
          deliveryLocationId: destination.id,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });

      await this.writeEventAndAudit(tx, {
        tripId: trip.id,
        actorUserId: principal.id,
        eventType: 'TRIP.DESTINATION_CHANGED',
        fromStatus: trip.status,
        toStatus: trip.status,
        idempotencyKey,
        requestId,
        reason: input.reason,
        before: {
          deliveryLocationId: trip.deliveryLocationId,
          version: trip.version,
        },
        after: {
          deliveryLocationId: destination.id,
          version: trip.version + 1,
        },
      });

      return {
        trip: this.presentTrip({
          ...trip,
          deliveryLocationId: destination.id,
          version: trip.version + 1,
        }),
        replayed: false,
      };
    });
  }

  cancelTrip(
    id: string,
    input: CancelTripDto,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    return this.transitionTrip(
      id,
      principal,
      TripStatus.CANCELLED,
      'TRIP.CANCELLED',
      idempotencyKey,
      requestId,
      { reason: input.reason, version: input.version },
      tenantContext,
    );
  }

  scheduleTrip(
    id: string,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    return this.transitionTrip(id, principal, 'SCHEDULED', 'TRIP.SCHEDULED', idempotencyKey, requestId, undefined, tenantContext);
  }

  readyTrip(
    id: string,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    return this.transitionTrip(id, principal, 'READY_TO_DEPART', 'TRIP.READY_TO_DEPART', idempotencyKey, requestId, undefined, tenantContext);
  }

  async startTrip(
    id: string,
    principal: SessionPrincipal,
    input: StartTripDto,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findFirst({
        where: { id, ...this.scopeWhere(principal, tenantContext) },
        include: {
          sppg: {
            include: {
              geofences: {
                where: { active: true, type: 'SPPG' },
                orderBy: { version: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      if (tenantContext && trip.tenantId !== tenantContext.tenantId) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      assertSppgAccess(principal, {
        organizationId: trip.sppg.organizationId,
        regionId: trip.sppg.regionId,
        sppgId: trip.sppg.id,
      });

      const replay = await tx.tripEvent.findUnique({
        where: { tripId_idempotencyKey: { tripId: id, idempotencyKey } },
        select: { eventType: true, metadata: true },
      });
      if (replay) {
        if (replay.eventType !== 'TRIP.STARTED') {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        const metadata = replay.metadata as { latitude?: number; longitude?: number; accuracyMeters?: number } | null;
        if (
          metadata?.latitude !== input.latitude ||
          metadata?.longitude !== input.longitude ||
          metadata?.accuracyMeters !== input.accuracyMeters
        ) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return { trip: this.presentTrip(trip), replayed: true };
      }

      if (principal.driverId !== trip.driverId) {
        throw new ForbiddenException({ code: 'DRIVER_ASSIGNMENT_REQUIRED' });
      }
      const originGeofence = trip.sppg.geofences[0];
      if (!originGeofence || originGeofence.centerLatitude === null || originGeofence.centerLongitude === null || originGeofence.radiusMeters === null) {
        throw new ConflictException({ code: 'ORIGIN_GEOFENCE_NOT_CONFIGURED' });
      }
      this.assertGpsQuality(input.accuracyMeters, Number(originGeofence.minGpsAccuracyMeters));
      this.assertInsideOrigin(
        input.latitude,
        input.longitude,
        originGeofence.centerLatitude,
        originGeofence.centerLongitude,
        Number(originGeofence.radiusMeters),
      );
      this.assertTransition(trip.status, TripStatus.IN_TRANSIT);

      const now = new Date();
      const deviceTimestamp = input.deviceTimestamp ? new Date(input.deviceTimestamp) : now;
      this.assertDeviceTimestamp(deviceTimestamp, now);
      const changed = await tx.trip.updateMany({
        where: { id, status: trip.status, version: trip.version, ...(tenantContext ? { tenantId: tenantContext.tenantId } : {}) },
        data: {
          status: TripStatus.IN_TRANSIT,
          trackingStatus: TrackingStatus.LIVE,
          actualDepartureAt: now,
          dispatchedQuantity: trip.plannedQuantity,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }

      await tx.gpsPosition.create({
        data: {
          tripId: trip.id,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          deviceTimestamp,
          serverReceivedAt: now,
          source: 'DRIVER_PWA',
          idempotencyKey,
        },
      });
      await this.writeEventAndAudit(tx, {
        tripId: trip.id,
        actorUserId: principal.id,
        eventType: 'TRIP.STARTED',
        fromStatus: trip.status,
        toStatus: TripStatus.IN_TRANSIT,
        idempotencyKey,
        requestId,
        before: { status: trip.status, version: trip.version },
        after: { status: TripStatus.IN_TRANSIT, version: trip.version + 1 },
        metadata: { latitude: input.latitude, longitude: input.longitude, accuracyMeters: input.accuracyMeters },
        deviceTimestamp: input.deviceTimestamp ? deviceTimestamp : undefined,
      });

      await this.createStatusNotification(tx, trip.id, TripStatus.IN_TRANSIT);

      return { trip: this.presentTrip({
        ...trip,
        status: TripStatus.IN_TRANSIT,
        trackingStatus: TrackingStatus.LIVE,
        actualDepartureAt: now,
        dispatchedQuantity: trip.plannedQuantity,
        version: trip.version + 1,
      }), replayed: false };
    });
  }

  private async transitionTrip(
    id: string,
    principal: SessionPrincipal,
    nextStatus: TripStatus,
    eventType: string,
    idempotencyKey: string,
    requestId: string,
    options?: { reason?: string; version?: number },
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);

    return this.prisma.db.$transaction(async (tx) => {
        const trip = await tx.trip.findFirst({ where: { id, ...this.scopeWhere(principal, tenantContext) } });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      await this.assertTripScope(trip.sppgId, trip.driverId, principal, tx);
      if (tenantContext && trip.tenantId !== tenantContext.tenantId) {
        throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      }

      const replay = await tx.tripEvent.findUnique({
        where: { tripId_idempotencyKey: { tripId: id, idempotencyKey } },
        select: { eventType: true },
      });
      if (replay) {
        if (replay.eventType !== eventType) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return { trip: this.presentTrip(trip), replayed: true };
      }

      if (options?.version !== undefined && trip.version !== options.version) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }
      this.assertTransition(trip.status, nextStatus);
      const changed = await tx.trip.updateMany({
        where: { id, status: trip.status, version: trip.version },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'TRIP_CHANGED_RETRY' });
      }

      await this.writeEventAndAudit(tx, {
        tripId: trip.id,
        actorUserId: principal.id,
        eventType,
        fromStatus: trip.status,
        toStatus: nextStatus,
        idempotencyKey,
        requestId,
        reason: options?.reason,
        before: { status: trip.status, version: trip.version },
        after: { status: nextStatus, version: trip.version + 1 },
      });

      await this.createStatusNotification(tx, trip.id, nextStatus);

      return {
        trip: this.presentTrip({ ...trip, status: nextStatus, version: trip.version + 1 }),
        replayed: false,
      };
    });
  }

  private async assertTripScope(
    sppgId: string,
    driverId: string,
    principal: SessionPrincipal,
    tx: Prisma.TransactionClient = this.prisma.db,
  ) {
    const sppg = await tx.sppg.findUnique({
      where: { id: sppgId },
      select: { id: true, organizationId: true, regionId: true },
    });
    if (!sppg) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    const hasGlobalRole = principal.roles.some((role) => role.isGlobal);
    const requiresDriverScope =
      principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    if (
      requiresDriverScope &&
      !hasGlobalRole &&
      (!principal.driverId || principal.driverId !== driverId)
    ) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }
    assertSppgAccess(principal, {
      organizationId: sppg.organizationId,
      regionId: sppg.regionId,
      sppgId: sppg.id,
    });
  }

  private searchWhere(term: string): Prisma.TripWhereInput[] {
    const contains = { contains: term, mode: 'insensitive' as const };
    const conditions: Prisma.TripWhereInput[] = [
      { sppg: { is: { name: contains } } },
      { sppg: { is: { code: contains } } },
      { deliveryLocation: { is: { name: contains } } },
      { deliveryLocation: { is: { code: contains } } },
      { driver: { is: { name: contains } } },
      { driver: { is: { code: contains } } },
      { vehicle: { is: { plateNumber: contains } } },
    ];

    const normalized = term.toLowerCase();
    const statuses = TRIP_STATUS_LABELS.filter(
      (entry) => entry.label.includes(normalized) || entry.status.toLowerCase().replaceAll('_', ' ').includes(normalized),
    ).map((entry) => entry.status);
    if (statuses.length > 0) {
      conditions.push({ status: { in: statuses } });
    }

    if (UUID_PATTERN.test(term)) {
      conditions.push({ id: term });
    }

    return conditions;
  }

  private scopeWhere(principal: SessionPrincipal, tenantContext?: { tenantId: string } | null): Prisma.TripWhereInput {
    if (tenantContext) return { tenantId: tenantContext.tenantId };
    if (principal.roles.some((role) => role.isGlobal)) return {};

    const rules: Prisma.TripWhereInput[] = [];
    for (const role of principal.roles) {
      if (role.organizationId) rules.push({ organizationId: role.organizationId });
      if (role.regionId) rules.push({ sppg: { is: { regionId: role.regionId } } });
      if (role.sppgId) rules.push({ sppgId: role.sppgId });
    }

    const scope: Prisma.TripWhereInput = rules.length
      ? { OR: rules }
      : { id: { in: [] } };
    const requiresDriverScope =
      principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    let result: Prisma.TripWhereInput;
    if (requiresDriverScope) {
      result = principal.driverId
        ? { AND: [scope, { driverId: principal.driverId }] }
        : { id: { in: [] } };
    } else {
      result = scope;
    }
    return result;
  }

  private assertIdempotencyKey(key: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
  }

  private assertTransition(current: TripStatus, next: TripStatus) {
    try {
      assertTripTransition(current, next);
    } catch (error) {
      if (error instanceof InvalidTripTransitionError) {
        throw new ConflictException({
          code: 'ILLEGAL_TRIP_TRANSITION',
          current: error.current,
          next: error.next,
        });
      }
      throw error;
    }
  }

  private assertGpsQuality(accuracyMeters: number, geofenceThreshold: number) {
    const maxAccuracy = Number(process.env.GPS_MAX_ACCURACY_M ?? 50);
    if (
      !Number.isFinite(maxAccuracy) ||
      maxAccuracy <= 0 ||
      !Number.isFinite(geofenceThreshold) ||
      geofenceThreshold <= 0 ||
      accuracyMeters > Math.min(maxAccuracy, geofenceThreshold)
    ) {
      throw new BadRequestException({ code: 'GPS_ACCURACY_INSUFFICIENT' });
    }
  }

  private assertDeviceTimestamp(deviceTimestamp: Date, serverTimestamp: Date) {
    const maxAgeSeconds = Number(process.env.GPS_MAX_DEVICE_AGE_SECONDS ?? 300);
    const maxFutureSkewSeconds = Number(process.env.GPS_MAX_FUTURE_SKEW_SECONDS ?? 30);
    const differenceSeconds = (deviceTimestamp.getTime() - serverTimestamp.getTime()) / 1000;

    if (
      !Number.isFinite(maxAgeSeconds) ||
      !Number.isFinite(maxFutureSkewSeconds) ||
      maxAgeSeconds <= 0 ||
      maxFutureSkewSeconds < 0 ||
      differenceSeconds < -maxAgeSeconds ||
      differenceSeconds > maxFutureSkewSeconds
    ) {
      throw new BadRequestException({ code: 'GPS_TIMESTAMP_INVALID' });
    }
  }

  private assertCreateReplayMatches(
    trip: {
      sppgId: string;
      deliveryLocationId: string;
      vehicleId: string;
      driverId: string;
      plannedDepartureAt: Date;
      plannedArrivalAt: Date;
      plannedQuantity: number;
    },
    input: CreateTripDto,
    plannedDepartureAt: Date,
    plannedArrivalAt: Date,
  ) {
    if (
      trip.sppgId !== input.sppgId ||
      trip.deliveryLocationId !== input.deliveryLocationId ||
      trip.vehicleId !== input.vehicleId ||
      trip.driverId !== input.driverId ||
      trip.plannedDepartureAt.getTime() !== plannedDepartureAt.getTime() ||
      trip.plannedArrivalAt.getTime() !== plannedArrivalAt.getTime() ||
      trip.plannedQuantity !== input.plannedQuantity
    ) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
  }

  private presentTrip<T extends {
    id: string;
    status: TripStatus;
    trackingStatus: TrackingStatus;
    verificationStatus: string;
    deliveryStatus: string;
    plannedDepartureAt: Date;
    plannedArrivalAt: Date;
    actualDepartureAt: Date | null;
    plannedQuantity: number;
    dispatchedQuantity: number | null;
    receivedQuantity: number | null;
    version: number;
  }>(trip: T) {
    return {
      id: trip.id,
      status: trip.status,
      trackingStatus: trip.trackingStatus,
      verificationStatus: trip.verificationStatus,
      deliveryStatus: trip.deliveryStatus,
      plannedDepartureAt: trip.plannedDepartureAt,
      plannedArrivalAt: trip.plannedArrivalAt,
      actualDepartureAt: trip.actualDepartureAt,
      plannedQuantity: trip.plannedQuantity,
      dispatchedQuantity: trip.dispatchedQuantity,
      receivedQuantity: trip.receivedQuantity,
      version: trip.version,
    };
  }

  private assertInsideOrigin(
    latitude: number,
    longitude: number,
    originLatitude: Prisma.Decimal,
    originLongitude: Prisma.Decimal,
    radiusMeters: number,
  ) {
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      throw new ConflictException({ code: 'ORIGIN_GEOFENCE_NOT_CONFIGURED' });
    }

    if (!isWithinRadius(
      latitude,
      longitude,
      Number(originLatitude),
      Number(originLongitude),
      radiusMeters,
    )) {
      throw new ForbiddenException({ code: 'OUTSIDE_DEPARTURE_GEOFENCE' });
    }
  }

  private async writeEventAndAudit(
    tx: Prisma.TransactionClient,
    input: {
      tripId: string;
      actorUserId: string;
      eventType: string;
      fromStatus?: string;
      toStatus: string;
      idempotencyKey: string;
      requestId: string;
      reason?: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
      metadata?: Prisma.InputJsonValue;
      deviceTimestamp?: Date;
    },
  ) {
    await tx.tripEvent.create({
      data: {
        tripId: input.tripId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        idempotencyKey: input.idempotencyKey,
        deviceTimestamp: input.deviceTimestamp,
        metadata: input.metadata,
        reason: input.reason,
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

  /** Buat notifikasi untuk recipient saat status trip berubah. */
  private async createStatusNotification(tx: Prisma.TransactionClient, tripId: string, status: string) {
    const stops = await tx.deliveryStop.findMany({
      where: { tripId },
      include: { site: { include: { memberships: { where: { status: 'ACTIVE' } } } } },
    });
    if (stops.length === 0) return;
    const tripRef = `TRP-${tripId.slice(0, 8).toUpperCase()}`;
    const titleMap: Record<string, string> = {
      IN_TRANSIT: 'Kendaraan dalam perjalanan',
      ARRIVAL_DETECTED: 'Kendaraan mendekati lokasi',
      ARRIVAL_VERIFIED: 'Kendaraan tiba di lokasi',
      DELIVERED: 'POD telah dikirim',
      COMPLETED: 'Pengiriman selesai',
    };
    const title = titleMap[status] ?? `Status perjalanan: ${status}`;
    const notifications = stops.flatMap((stop) =>
      stop.site.memberships.map((m) => ({
        userId: m.userId,
        type: status === 'DELIVERED' ? 'POD_SUBMITTED' : 'SCHEDULE_CHANGED',
        title,
        body: `Perjalanan ${tripRef} · ${stop.site.name}`,
        status: 'QUEUED',
        stopId: stop.id,
        tripId,
      })),
    );
    if (notifications.length > 0) {
      await tx.notificationEvent.createMany({ data: notifications });
    }
  }
}
