import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GeofenceType, Prisma, TripStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertSppgAccess } from '../auth/permissions.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateGeofenceDto, GeofenceLocationType, ListGeofencesDto } from './geofence.dto.js';
import { canAccessDeliveryGeofence, hasConfirmedGeofenceArrival } from './geofence-policy.js';

@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}

  async listForLocation(query: ListGeofencesDto, principal: SessionPrincipal, tenantContext?: { tenantId: string } | null) {
    await this.getScopedLocationWhere(query.locationType, query.locationId, principal, tenantContext);
    const where = query.locationType === GeofenceLocationType.SPPG
      ? { sppgId: query.locationId }
      : { deliveryLocationId: query.locationId };
    return this.prisma.db.geofence.findMany({
      where,
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        shapeType: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        polygonCoordinates: true,
        minGpsAccuracyMeters: true,
        confirmationFixes: true,
        confirmationDurationSeconds: true,
        active: true,
        version: true,
        createdAt: true,
      },
    });
  }

  async create(
    input: CreateGeofenceDto,
    principal: SessionPrincipal,
    idempotencyKey: string,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const type = this.toPrismaType(input.locationType);

    const isPolygon = input.shapeType === 'POLYGON';
    let centerLatitude: number;
    let centerLongitude: number;
    let radiusMeters: number | null = input.radiusMeters ?? null;
    let polygonCoordinates: { longitude: number; latitude: number }[] | null = null;

    if (isPolygon) {
      if (!input.polygonCoordinates || input.polygonCoordinates.length < 3) {
        throw new BadRequestException({ code: 'INVALID_POLYGON' });
      }
      polygonCoordinates = input.polygonCoordinates;
      const lats = polygonCoordinates.map((p) => p.latitude);
      const lngs = polygonCoordinates.map((p) => p.longitude);
      centerLatitude = lats.reduce((a, b) => a + b, 0) / lats.length;
      centerLongitude = lngs.reduce((a, b) => a + b, 0) / lngs.length;
      radiusMeters = null;
    } else {
      if (input.centerLatitude === undefined || input.centerLongitude === undefined || input.radiusMeters === undefined) {
        throw new BadRequestException({ code: 'INVALID_CIRCLE' });
      }
      centerLatitude = input.centerLatitude;
      centerLongitude = input.centerLongitude;
    }

    return this.prisma.db.$transaction(async (tx) => {
      const replay = await tx.geofence.findUnique({ where: { idempotencyKey } });
      if (replay) {
        await this.assertGeofenceScope(replay, principal, tenantContext);
        if (!this.matchesInput(replay, input, type)) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return { geofence: replay, replayed: true };
      }

      const location = await this.getScopedLocationWhere(
        input.locationType,
        input.locationId,
        principal,
        tenantContext,
        tx,
      );
      if (
        input.locationType === GeofenceLocationType.SPPG &&
        (location as { status: string }).status !== 'ACTIVE'
      ) {
        throw new ConflictException({ code: 'SPPG_NOT_ACTIVE' });
      }
      const locationWhere = input.locationType === GeofenceLocationType.SPPG
        ? { sppgId: input.locationId }
        : { deliveryLocationId: input.locationId };
      const tenantId = tenantContext?.tenantId ?? null;
      const current = await tx.geofence.findFirst({
        where: { ...locationWhere, active: true },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });

      await tx.geofence.updateMany({
        where: { ...locationWhere, active: true },
        data: { active: false },
      });

      const geofence = await tx.geofence.create({
        data: {
          ...locationWhere,
          tenantId,
          type,
          shapeType: isPolygon ? 'POLYGON' : 'CIRCLE',
          name: input.name,
          centerLatitude,
          centerLongitude,
          radiusMeters,
          polygonCoordinates: polygonCoordinates ?? Prisma.JsonNull,
          minGpsAccuracyMeters: input.minGpsAccuracyMeters,
          confirmationFixes: input.confirmationFixes,
          confirmationDurationSeconds: input.confirmationDurationSeconds,
          idempotencyKey,
          createdBy: principal.id,
          version: (current?.version ?? 0) + 1,
        },
      });

      if (centerLatitude !== undefined && centerLongitude !== undefined) {
        await tx.$executeRaw`
          UPDATE geofences
          SET center = ST_SetSRID(ST_MakePoint(${centerLongitude}, ${centerLatitude}), 4326)::geography
          WHERE id = ${geofence.id}::uuid
        `;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'geofence.create',
          entityType: 'geofence',
          entityId: geofence.id,
          result: 'success',
          reason: input.reason,
          before: current ? { id: current.id, version: current.version, active: true } : Prisma.JsonNull,
          after: {
            type,
            name: input.name,
            centerLatitude: input.centerLatitude,
            centerLongitude: input.centerLongitude,
            radiusMeters: input.radiusMeters,
            version: geofence.version,
          },
          requestId,
        },
      });

      return { geofence, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async evaluateArrival(
    tx: Prisma.TransactionClient,
    tripId: string,
    now: Date,
  ): Promise<boolean> {
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: {
        deliveryLocation: {
          include: {
            geofences: {
              where: { active: true, type: GeofenceType.DELIVERY, shapeType: 'CIRCLE' },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    const geofence = trip?.deliveryLocation.geofences[0];
    if (!trip || trip.status !== TripStatus.IN_TRANSIT || !geofence) return false;

    const maxFixAgeSeconds = Number(process.env.GPS_LIVE_MAX_AGE_SECONDS ?? 90);
    if (!Number.isFinite(maxFixAgeSeconds) || maxFixAgeSeconds <= 0) return false;

    const fixes = await tx.gpsPosition.findMany({
      where: {
        tripId,
        deviceTimestamp: { gte: new Date(now.getTime() - maxFixAgeSeconds * 1000), lte: now },
      },
      orderBy: [{ deviceTimestamp: 'desc' }, { serverReceivedAt: 'desc' }],
      take: geofence.confirmationFixes,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        deviceTimestamp: true,
        integrityFlags: true,
      },
    });

    const confirmed = hasConfirmedGeofenceArrival(
      fixes.map((fix) => ({
        latitude: Number(fix.latitude),
        longitude: Number(fix.longitude),
        accuracyMeters: fix.accuracyMeters === null ? null : Number(fix.accuracyMeters),
        deviceTimestamp: fix.deviceTimestamp,
        integrityFlags: fix.integrityFlags,
      })),
      {
        centerLatitude: Number(geofence.centerLatitude),
        centerLongitude: Number(geofence.centerLongitude),
        radiusMeters: Number(geofence.radiusMeters),
        minGpsAccuracyMeters: Number(geofence.minGpsAccuracyMeters),
        confirmationFixes: geofence.confirmationFixes,
        confirmationDurationSeconds: geofence.confirmationDurationSeconds,
      },
      now,
      maxFixAgeSeconds,
    );
    if (!confirmed) return false;
    const observedDurationSeconds =
      (fixes[0].deviceTimestamp.getTime() - fixes[geofence.confirmationFixes - 1].deviceTimestamp.getTime()) / 1000;

    const updated = await tx.trip.updateMany({
      where: { id: trip.id, status: TripStatus.IN_TRANSIT, version: trip.version },
      data: {
        status: TripStatus.ARRIVAL_DETECTED,
        arrivalDetectedAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return false;

    const idempotencyKey = `arrival:${trip.id}:${geofence.id}`;
    await tx.tripEvent.create({
      data: {
        tripId: trip.id,
        eventType: 'TRIP.ARRIVAL_DETECTED',
        fromStatus: TripStatus.IN_TRANSIT,
        toStatus: TripStatus.ARRIVAL_DETECTED,
        occurredAt: now,
        idempotencyKey,
        metadata: {
          geofenceId: geofence.id,
          fixIds: fixes.map((fix) => fix.id),
          confirmationFixes: geofence.confirmationFixes,
          confirmationDurationSeconds: observedDurationSeconds,
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: 'trip.arrival_detected',
        entityType: 'trip',
        entityId: trip.id,
        result: 'success',
        before: { status: TripStatus.IN_TRANSIT, version: trip.version },
        after: { status: TripStatus.ARRIVAL_DETECTED, version: trip.version + 1 },
        requestId: randomUUID(),
      },
    });
    return true;
  }

  private async getScopedLocationWhere(
    locationType: GeofenceLocationType,
    locationId: string,
    principal: SessionPrincipal,
    tenantContext?: { tenantId: string } | null,
    tx: Prisma.TransactionClient = this.prisma.db,
  ) {
    if (locationType === GeofenceLocationType.SPPG) {
      const location = await tx.sppg.findUnique({
        where: { id: locationId },
        select: { id: true, organizationId: true, regionId: true, status: true },
      });
      if (!location) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });
      // Tenant users: check if SPPG belongs to their tenant
      if (principal.tenantRole && tenantContext?.tenantId) {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          select: { legacySppgId: true },
        });
        if (tenant?.legacySppgId === locationId) {
          return location;
        }
        throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });
      }
      assertSppgAccess(principal, {
        organizationId: location.organizationId,
        regionId: location.regionId,
        sppgId: location.id,
      });
      return location;
    }

    const location = await tx.deliveryLocation.findUnique({
      where: { id: locationId },
      select: { id: true, organizationId: true, regionId: true, active: true, tenantId: true },
    });
    if (!location || !location.active) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });

    // Tenant users: check if the location belongs to their tenant or their tenant's SPPG scope.
    if (principal.tenantRole && tenantContext?.tenantId) {
      if (location.tenantId && location.tenantId === tenantContext.tenantId) {
        return location;
      }
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantContext.tenantId },
        select: { legacySppgId: true },
      });
      if (tenant?.legacySppgId) {
        const sppg = await tx.sppg.findUnique({
          where: { id: tenant.legacySppgId },
          select: { organizationId: true, regionId: true },
        });
        if (sppg && sppg.organizationId === location.organizationId && sppg.regionId === location.regionId) {
          return location;
        }
      }
      throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });
    }

    const sppgIds = [...new Set(principal.roles.flatMap((role) => role.sppgId ? [role.sppgId] : []))];
    const scopedSppgs = sppgIds.length
      ? await tx.sppg.findMany({
          where: { id: { in: sppgIds } },
          select: { regionId: true },
        })
      : [];
    const sppgRegionIds = new Set(scopedSppgs.map(({ regionId }) => regionId));
    const authorized = canAccessDeliveryGeofence(principal.roles, location, sppgRegionIds);
    if (!authorized) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });
    return location;
  }

  private async assertGeofenceScope(
    geofence: { sppgId: string | null; deliveryLocationId: string | null },
    principal: SessionPrincipal,
    tenantContext?: { tenantId: string } | null,
  ) {
    if (geofence.sppgId) {
      return this.getScopedLocationWhere(GeofenceLocationType.SPPG, geofence.sppgId, principal, tenantContext);
    }
    if (geofence.deliveryLocationId) {
      return this.getScopedLocationWhere(GeofenceLocationType.DELIVERY, geofence.deliveryLocationId, principal, tenantContext);
    }
    throw new NotFoundException({ code: 'GEOFENCE_NOT_FOUND' });
  }

  private toPrismaType(type: GeofenceLocationType) {
    return type === GeofenceLocationType.SPPG ? GeofenceType.SPPG : GeofenceType.DELIVERY;
  }

  private matchesInput(
    geofence: {
      sppgId: string | null;
      deliveryLocationId: string | null;
      type: GeofenceType;
      shapeType: string;
      name: string;
      centerLatitude: Prisma.Decimal | null;
      centerLongitude: Prisma.Decimal | null;
      radiusMeters: Prisma.Decimal | null;
      minGpsAccuracyMeters: Prisma.Decimal;
      confirmationFixes: number;
      confirmationDurationSeconds: number;
      polygonCoordinates?: unknown;
    },
    input: CreateGeofenceDto,
    type: GeofenceType,
  ) {
    return (
      geofence.type === type &&
      (geofence.sppgId ?? geofence.deliveryLocationId) === input.locationId &&
      geofence.name === input.name &&
      geofence.shapeType === (input.shapeType ?? 'CIRCLE') &&
      (geofence.centerLatitude === null || Number(geofence.centerLatitude) === (input.centerLatitude ?? Number(geofence.centerLatitude))) &&
      (geofence.centerLongitude === null || Number(geofence.centerLongitude) === (input.centerLongitude ?? Number(geofence.centerLongitude))) &&
      (geofence.radiusMeters === null || Number(geofence.radiusMeters) === (input.radiusMeters ?? Number(geofence.radiusMeters))) &&
      Number(geofence.minGpsAccuracyMeters) === input.minGpsAccuracyMeters &&
      geofence.confirmationFixes === input.confirmationFixes &&
      geofence.confirmationDurationSeconds === input.confirmationDurationSeconds
    );
  }

  private assertIdempotencyKey(key: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
  }
}
