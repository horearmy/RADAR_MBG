import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { ListAuditLogsDto } from './audit.dto.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: SessionPrincipal, query: ListAuditLogsDto) {
    const scope = await this.scopedEntityIds(principal);
    if (scope && !scope.size) return this.emptyPage(query);

    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (scope) {
      conditions.push({ OR: [...scope].map(([entityType, ids]) => ({
        entityType,
        entityId: { in: [...ids] },
      })) });
    }
    if (query.search) {
      conditions.push({ OR: [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
      ] });
    }
    const where: Prisma.AuditLogWhereInput = {
      ...(conditions.length ? { AND: conditions } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entityType ? { entityType: { contains: query.entityType, mode: 'insensitive' } } : {}),
      ...(query.from || query.to ? {
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(logs.flatMap((log) => log.actorUserId ? [log.actorUserId] : []))];
    const actors = actorIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));

    return {
      data: logs.map((log) => ({ ...log, actor: log.actorUserId ? actorById.get(log.actorUserId) ?? null : null })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private async scopedEntityIds(principal: SessionPrincipal) {
    if (principal.roles.some((role) => role.isGlobal)) return null;
    const organizationIds = [...new Set(principal.roles.flatMap((role) => role.organizationId ? [role.organizationId] : []))];
    const regionIds = [...new Set(principal.roles.flatMap((role) => role.regionId ? [role.regionId] : []))];
    const directSppgIds = [...new Set(principal.roles.flatMap((role) => role.sppgId ? [role.sppgId] : []))];
    const sppgScope: Prisma.SppgWhereInput[] = [
      ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
      ...(regionIds.length ? [{ regionId: { in: regionIds } }] : []),
      ...(directSppgIds.length ? [{ id: { in: directSppgIds } }] : []),
    ];
    if (!sppgScope.length) return new Map<string, Set<string>>();

    const sppgs = await this.prisma.db.sppg.findMany({
      where: { OR: sppgScope },
      select: { id: true, regionId: true },
    });
    const sppgIds = sppgs.map(({ id }) => id);
    const sppgRegionIds = [...new Set(sppgs.map(({ regionId }) => regionId))];
    const regionScopeIds = [...new Set([...regionIds, ...sppgRegionIds])];
    const [regions, deliveryLocations, vehicles, drivers, assignments, trips, exceptions, approvals] = await Promise.all([
      this.prisma.db.region.findMany({
        where: {
          OR: [
            ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
            ...(regionIds.length ? [{ id: { in: regionIds } }] : []),
            ...(sppgRegionIds.length ? [{ id: { in: sppgRegionIds } }] : []),
          ],
        },
        select: { id: true },
      }),
      regionScopeIds.length || organizationIds.length
        ? this.prisma.db.deliveryLocation.findMany({
            where: {
              OR: [
                ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
                ...(regionScopeIds.length ? [{ regionId: { in: regionScopeIds } }] : []),
              ],
            },
            select: { id: true },
          })
        : [],
      organizationIds.length || regionIds.length || directSppgIds.length
        ? this.prisma.db.vehicle.findMany({
            where: {
              OR: [
                ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
                ...(regionIds.length ? [{ sppg: { is: { regionId: { in: regionIds } } } }] : []),
                ...(directSppgIds.length ? [{ sppgId: { in: directSppgIds } }] : []),
              ],
            },
            select: { id: true },
          })
        : [],
      organizationIds.length || regionIds.length || directSppgIds.length
        ? this.prisma.db.driver.findMany({
            where: {
              OR: [
                ...(directSppgIds.length ? [{ sppgId: { in: directSppgIds } }] : []),
                ...(regionIds.length ? [{ sppg: { is: { regionId: { in: regionIds } } } }] : []),
                ...(organizationIds.length ? [{ sppg: { is: { organizationId: { in: organizationIds } } } }] : []),
              ],
            },
            select: { id: true },
          })
        : [],
      organizationIds.length || regionIds.length || directSppgIds.length
        ? this.prisma.db.driverVehicleAssignment.findMany({
            where: {
              OR: [
                ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
                ...(regionIds.length ? [{ sppg: { is: { regionId: { in: regionIds } } } }] : []),
                ...(directSppgIds.length ? [{ sppgId: { in: directSppgIds } }] : []),
              ],
            },
            select: { id: true },
          })
        : [],
      sppgIds.length
        ? this.prisma.db.trip.findMany({ where: { sppgId: { in: sppgIds } }, select: { id: true } })
        : [],
      sppgIds.length
        ? this.prisma.db.exceptionCase.findMany({
            where: { OR: [{ sppgId: { in: sppgIds } }, { trip: { sppgId: { in: sppgIds } } }] },
            select: { id: true },
          })
        : [],
      sppgIds.length
        ? this.prisma.db.approvalRequest.findMany({
            where: { targetType: 'SPPG', targetId: { in: sppgIds } },
            select: { id: true },
          })
        : [],
    ]);
    const geofences = sppgIds.length || deliveryLocations.length
      ? await this.prisma.db.geofence.findMany({
          where: {
            OR: [
              ...(sppgIds.length ? [{ sppgId: { in: sppgIds } }] : []),
              ...(deliveryLocations.length
                ? [{ deliveryLocationId: { in: deliveryLocations.map(({ id }) => id) } }]
                : []),
            ],
          },
          select: { id: true },
        })
      : [];
    const ids = new Map<string, Set<string>>();
    ids.set('organization', new Set(organizationIds));
    ids.set('region', new Set(regions.map(({ id }) => id)));
    ids.set('sppg', new Set(sppgIds));
    ids.set('delivery_location', new Set(deliveryLocations.map(({ id }) => id)));
    ids.set('geofence', new Set(geofences.map(({ id }) => id)));
    ids.set('vehicle', new Set(vehicles.map(({ id }) => id)));
    ids.set('driver', new Set(drivers.map(({ id }) => id)));
    ids.set('driver_vehicle_assignment', new Set(assignments.map(({ id }) => id)));
    ids.set('trip', new Set(trips.map(({ id }) => id)));
    ids.set('exception_case', new Set(exceptions.map(({ id }) => id)));
    ids.set('approval_request', new Set(approvals.map(({ id }) => id)));
    return ids;
  }

  private emptyPage(query: ListAuditLogsDto) {
    return {
      data: [],
      pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
    };
  }
}
