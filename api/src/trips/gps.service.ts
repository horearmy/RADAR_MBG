import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrackingStatus, TripStatus } from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertSppgAccess } from '../auth/permissions.js';
import { PrismaService } from '../database/prisma.service.js';
import { distanceMeters } from './trip-geo.js';
import { GpsPositionDto, TrackQueryDto } from './gps.dto.js';
import { GeofenceService } from './geofence.service.js';

const TRACKABLE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.IN_TRANSIT,
  TripStatus.ARRIVAL_DETECTED,
  TripStatus.ARRIVAL_VERIFIED,
  TripStatus.DELIVERY_IN_PROGRESS,
];

@Injectable()
export class GpsService {
  private readonly ingestBuckets = new Map<string, { count: number; resetAt: number }>();
  private requestCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geofences: GeofenceService,
  ) {}

  async appendPosition(
    tripId: string,
    principal: SessionPrincipal,
    input: GpsPositionDto,
    idempotencyKey: string,
    requestId: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    this.assertIngestRateLimit(principal.id, tripId);
    const deviceTimestamp = new Date(input.deviceTimestamp);
    const now = new Date();
    const futureSkewSeconds = Number(process.env.GPS_MAX_FUTURE_SKEW_SECONDS ?? 30);
    if (
      !Number.isFinite(deviceTimestamp.getTime()) ||
      deviceTimestamp.getTime() - now.getTime() > futureSkewSeconds * 1000
    ) {
      throw new BadRequestException({ code: 'GPS_TIMESTAMP_INVALID' });
    }

    return this.prisma.db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          driverId: true,
          sppg: { select: { id: true, organizationId: true, regionId: true } },
          status: true,
          trackingStatus: true,
        },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      assertSppgAccess(principal, {
        organizationId: trip.sppg.organizationId,
        regionId: trip.sppg.regionId,
        sppgId: trip.sppg.id,
      });
      if (principal.driverId !== trip.driverId) {
        throw new ForbiddenException({ code: 'DRIVER_ASSIGNMENT_REQUIRED' });
      }
      if (!TRACKABLE_TRIP_STATUSES.includes(trip.status)) {
        throw new ConflictException({ code: 'TRIP_NOT_TRACKABLE' });
      }

      const replay = await tx.gpsPosition.findUnique({
        where: { tripId_idempotencyKey: { tripId, idempotencyKey } },
      });
      if (replay) {
        if (!this.matchesPosition(replay, input, deviceTimestamp)) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return {
          accepted: true,
          replayed: true,
          positionId: replay.id,
          deviceTimestamp: replay.deviceTimestamp,
          serverReceivedAt: replay.serverReceivedAt,
          integrityFlags: replay.integrityFlags,
          livePositionUpdated: false,
        };
      }

      const latest = await tx.gpsPosition.findFirst({
        where: { tripId },
        orderBy: [{ deviceTimestamp: 'desc' }, { serverReceivedAt: 'desc' }],
        select: {
          latitude: true,
          longitude: true,
          accuracyMeters: true,
          deviceTimestamp: true,
          sequenceNumber: true,
        },
      });
      const integrityFlags = this.getIntegrityFlags(input, deviceTimestamp, now, latest);
      const liveMaxAgeSeconds = Number(process.env.GPS_LIVE_MAX_AGE_SECONDS ?? 90);
      const fresh =
        Number.isFinite(liveMaxAgeSeconds) &&
        liveMaxAgeSeconds > 0 &&
        now.getTime() - deviceTimestamp.getTime() <= liveMaxAgeSeconds * 1000;
      const livePositionUpdated = integrityFlags.length === 0 && fresh;

      const position = await tx.gpsPosition.create({
        data: {
          tripId,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          speedMps: input.speedMps,
          headingDegrees: input.headingDegrees,
          deviceTimestamp,
          serverReceivedAt: now,
          sequenceNumber: input.sequenceNumber,
          source: 'DRIVER_PWA',
          integrityFlags,
          idempotencyKey,
        },
        select: { id: true, deviceTimestamp: true, serverReceivedAt: true },
      });

      if (livePositionUpdated) {
        await tx.trip.updateMany({
          where: { id: tripId, status: { in: TRACKABLE_TRIP_STATUSES } },
          data: { trackingStatus: TrackingStatus.LIVE },
        });
      }

      const arrivalDetected = livePositionUpdated
        ? await this.geofences.evaluateArrival(tx, tripId, now)
        : false;

      if (integrityFlags.length > 0) {
        await tx.tripEvent.create({
          data: {
            tripId,
            actorUserId: principal.id,
            eventType: 'GPS.DATA_QUALITY_WARNING',
            idempotencyKey,
            occurredAt: now,
            deviceTimestamp,
            metadata: {
              positionId: position.id,
              integrityFlags,
              accuracyMeters: input.accuracyMeters,
              requestId,
            },
          },
        });
      }

      return {
        accepted: true,
        replayed: false,
        positionId: position.id,
        deviceTimestamp: position.deviceTimestamp,
        serverReceivedAt: position.serverReceivedAt,
        integrityFlags,
        livePositionUpdated,
        arrivalDetected,
      };
    });
  }

  async getTrack(
    tripId: string,
    principal: SessionPrincipal,
    query: TrackQueryDto,
  ) {
    const trip = await this.prisma.db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        driverId: true,
        sppg: { select: { id: true, organizationId: true, regionId: true } },
      },
    });
    if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    assertSppgAccess(principal, {
      organizationId: trip.sppg.organizationId,
      regionId: trip.sppg.regionId,
      sppgId: trip.sppg.id,
    });
    const requiresDriverScope =
      principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    if (
      requiresDriverScope &&
      !principal.roles.some((role) => role.isGlobal) &&
      (!principal.driverId || principal.driverId !== trip.driverId)
    ) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }

    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    if (to <= from) throw new BadRequestException({ code: 'INVALID_TRACK_RANGE' });

    if (query.cursorId) {
      const cursor = await this.prisma.db.gpsPosition.findFirst({
        where: { id: query.cursorId, tripId },
        select: { id: true },
      });
      if (!cursor) throw new BadRequestException({ code: 'INVALID_TRACK_CURSOR' });
    }

    const positions = await this.prisma.db.gpsPosition.findMany({
      where: {
        tripId,
        deviceTimestamp: { gte: from, lte: to },
      },
      orderBy: [{ deviceTimestamp: 'desc' }, { serverReceivedAt: 'desc' }],
      ...(query.cursorId ? { cursor: { id: query.cursorId }, skip: 1 } : {}),
      take: query.limit,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        speedMps: true,
        headingDegrees: true,
        deviceTimestamp: true,
        serverReceivedAt: true,
        sequenceNumber: true,
        source: true,
        integrityFlags: true,
      },
    });

    const hasMore = positions.length === query.limit;
    const nextCursorId = hasMore ? positions[positions.length - 1]?.id : undefined;
    return {
      tripId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit: query.limit,
      hasMore,
      nextCursorId,
      positions: positions.reverse(),
    };
  }

  private getIntegrityFlags(
    input: GpsPositionDto,
    deviceTimestamp: Date,
    now: Date,
    latest: {
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      accuracyMeters: Prisma.Decimal | null;
      deviceTimestamp: Date;
      sequenceNumber: number | null;
    } | null,
  ) {
    const flags: string[] = [];
    const maxAccuracy = Number(process.env.GPS_MAX_ACCURACY_M ?? 50);
    const maxDeviceAgeSeconds = Number(process.env.GPS_MAX_DEVICE_AGE_SECONDS ?? 7 * 24 * 60 * 60);

    if (!Number.isFinite(maxAccuracy) || maxAccuracy <= 0 || input.accuracyMeters > maxAccuracy) {
      flags.push('GPS_ACCURACY_POOR');
    }
    if (
      Number.isFinite(maxDeviceAgeSeconds) &&
      maxDeviceAgeSeconds > 0 &&
      now.getTime() - deviceTimestamp.getTime() > maxDeviceAgeSeconds * 1000
    ) {
      flags.push('DEVICE_TIMESTAMP_OLD');
    }

    if (latest) {
      if (deviceTimestamp <= latest.deviceTimestamp) flags.push('DEVICE_TIMESTAMP_OUT_OF_ORDER');
      if (
        input.sequenceNumber !== undefined &&
        latest.sequenceNumber !== null &&
        input.sequenceNumber <= latest.sequenceNumber
      ) {
        flags.push('SEQUENCE_OUT_OF_ORDER');
      }

      const elapsedSeconds = (deviceTimestamp.getTime() - latest.deviceTimestamp.getTime()) / 1000;
      if (elapsedSeconds > 0) {
        const distance = distanceMeters(
          input.latitude,
          input.longitude,
          Number(latest.latitude),
          Number(latest.longitude),
        );
        const maxSpeedMps = Number(process.env.GPS_MAX_SPEED_MPS ?? 45);
        if (Number.isFinite(maxSpeedMps) && maxSpeedMps > 0 && distance / elapsedSeconds > maxSpeedMps) {
          flags.push('IMPLAUSIBLE_JUMP');
        }
      }
    }

    return flags;
  }

  private matchesPosition(
    stored: {
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      accuracyMeters: Prisma.Decimal | null;
      deviceTimestamp: Date;
      speedMps: Prisma.Decimal | null;
      headingDegrees: Prisma.Decimal | null;
      sequenceNumber: number | null;
    },
    input: GpsPositionDto,
    deviceTimestamp: Date,
  ) {
    return (
      Number(stored.latitude) === input.latitude &&
      Number(stored.longitude) === input.longitude &&
      Number(stored.accuracyMeters) === input.accuracyMeters &&
      stored.deviceTimestamp.getTime() === deviceTimestamp.getTime() &&
      (stored.speedMps === null ? input.speedMps === undefined : Number(stored.speedMps) === input.speedMps) &&
      (stored.headingDegrees === null ? input.headingDegrees === undefined : Number(stored.headingDegrees) === input.headingDegrees) &&
      stored.sequenceNumber === (input.sequenceNumber ?? null)
    );
  }

  private assertIdempotencyKey(key: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
  }

  private assertIngestRateLimit(userId: string, tripId: string) {
    const now = Date.now();
    const key = `${userId}:${tripId}`;
    const limit = Number(process.env.GPS_INGEST_RATE_PER_MINUTE ?? 120);
    this.requestCount += 1;

    if (this.requestCount % 128 === 0) {
      for (const [bucketKey, bucket] of this.ingestBuckets) {
        if (bucket.resetAt <= now) this.ingestBuckets.delete(bucketKey);
      }
    }

    const bucket = this.ingestBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!Number.isInteger(limit) || limit < 1 || this.ingestBuckets.size >= 10_000) {
        throw new HttpException({ code: 'GPS_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      this.ingestBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException({ code: 'GPS_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
