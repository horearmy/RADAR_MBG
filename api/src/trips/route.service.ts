import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertSppgAccess } from '../auth/permissions.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateRouteDto, ListRoutesDto } from './route.dto.js';

@Injectable()
export class RouteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: SessionPrincipal, query: ListRoutesDto) {
    const scope = await this.resolveScope(principal);
    const where: Prisma.RouteWhereInput = {
      ...(scope.global ? {} : {
        OR: [
          ...(scope.sppgIds.length ? [{ sppgId: { in: scope.sppgIds } }] : []),
          ...(scope.regionIds.length ? [{ sppg: { regionId: { in: scope.regionIds } } }] : []),
        ],
      }),
      ...(query.sppgId ? { sppgId: query.sppgId } : {}),
      ...(query.deliveryLocationId ? { deliveryLocationId: query.deliveryLocationId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.route.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          sppgId: true,
          deliveryLocationId: true,
          coordinates: true,
          distanceMeters: true,
          estimatedDurationSeconds: true,
          active: true,
          version: true,
          createdAt: true,
          sppg: { select: { id: true, code: true, name: true } },
          deliveryLocation: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.db.route.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async create(input: CreateRouteDto, principal: SessionPrincipal, idempotencyKey: string, requestId: string) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.prisma.db.$transaction(async (tx) => {
      const sppg = await tx.sppg.findUnique({
        where: { id: input.sppgId },
        select: { id: true, organizationId: true, regionId: true, status: true },
      });
      if (!sppg) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
      assertSppgAccess(principal, { organizationId: sppg.organizationId, regionId: sppg.regionId, sppgId: sppg.id });
      if (sppg.status !== 'ACTIVE') throw new ConflictException({ code: 'SPPG_NOT_ACTIVE' });

      const location = await tx.deliveryLocation.findUnique({
        where: { id: input.deliveryLocationId },
        select: { id: true, organizationId: true, regionId: true, active: true },
      });
      if (!location || !location.active) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });

      const distanceMeters = this.computeDistance(input.coordinates);
      const current = await tx.route.findFirst({
        where: { sppgId: input.sppgId, deliveryLocationId: input.deliveryLocationId, active: true },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      await tx.route.updateMany({
        where: { sppgId: input.sppgId, deliveryLocationId: input.deliveryLocationId, active: true },
        data: { active: false },
      });
      const tenant = await tx.tenant.findUnique({ where: { legacySppgId: input.sppgId } });
      if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });

      const route = await tx.route.create({
        data: {
          tenantId: tenant.id,
          sppgId: input.sppgId,
          deliveryLocationId: input.deliveryLocationId,
          name: input.name,
          coordinates: input.coordinates as unknown as Prisma.InputJsonValue,
          distanceMeters,
          idempotencyKey,
          createdBy: principal.id,
          version: (current?.version ?? 0) + 1,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'route.create',
          entityType: 'route',
          entityId: route.id,
          result: 'success',
          reason: input.reason ?? null,
          before: current ? { id: current.id, version: current.version, active: true } : Prisma.JsonNull,
          after: { id: route.id, version: route.version, name: route.name, distanceMeters: route.distanceMeters },
          requestId,
        },
      });
      return { route, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private computeDistance(points: { longitude: number; latitude: number }[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += haversineMeters(points[i - 1], points[i]);
    }
    return Math.round(total * 100) / 100;
  }

  private assertIdempotencyKey(key: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
  }

  async getById(id: string, principal: SessionPrincipal) {
    const route = await this.prisma.db.route.findUnique({
      where: { id },
      include: { sppg: { select: { id: true, code: true, name: true } }, deliveryLocation: { select: { id: true, code: true, name: true } } },
    });
    if (!route) throw new NotFoundException({ code: 'ROUTE_NOT_FOUND' });
    return route;
  }

  async archive(id: string, reason: string, principal: SessionPrincipal, idempotencyKey: string, requestId: string) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.prisma.db.$transaction(async (tx) => {
      const route = await tx.route.findUnique({ where: { id } });
      if (!route) throw new NotFoundException({ code: 'ROUTE_NOT_FOUND' });
      if (!route.active) return { route, replayed: true };
      await tx.route.update({ where: { id }, data: { active: false } });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'route.archive',
          entityType: 'route',
          entityId: id,
          result: 'success',
          reason,
          before: { id: route.id, version: route.version, active: true },
          after: { id: route.id, version: route.version, active: false },
          requestId,
        },
      });
      return { route: { ...route, active: false }, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  private async resolveScope(principal: SessionPrincipal) {
    const global = principal.roles.some((r) => r.isGlobal);
    const regionIds = [...new Set(principal.roles.flatMap((r) => r.regionId ? [r.regionId] : []))];
    const sppgIds = [...new Set(principal.roles.flatMap((r) => r.sppgId ? [r.sppgId] : []))];
    return { global, regionIds, sppgIds };
  }
}

function haversineMeters(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }): number {
  const R = 6371008.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}