import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}


  async listTenants() {
    return this.prisma.db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        tenantCode: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async suspendTenant(id: string, principal: { id: string }, requestId: string, reason?: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    if (tenant.status !== 'ACTIVE') throw new BadRequestException({ code: 'TENANT_STATUS_INVALID' });

    const updated = await this.prisma.db.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    await this.prisma.db.auditLog.create({
      data: {
        actorUserId: principal.id,
        action: 'tenant.suspend',
        entityType: 'tenant',
        entityId: id,
        result: 'SUCCESS',
        reason: reason ?? null,
        requestId,
      },
    });

    return updated;
  }

  async archiveTenant(id: string, principal: { id: string }, requestId: string, reason?: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    if (tenant.status === 'ARCHIVED') throw new BadRequestException({ code: 'TENANT_STATUS_INVALID' });

    const updated = await this.prisma.db.tenant.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this.prisma.db.auditLog.create({
      data: {
        actorUserId: principal.id,
        action: 'tenant.archive',
        entityType: 'tenant',
        entityId: id,
        result: 'SUCCESS',
        reason: reason ?? null,
        requestId,
      },
    });

    return updated;
  }

  async reactivateTenant(id: string, principal: { id: string }, requestId: string, reason?: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    if (tenant.status === 'ACTIVE') throw new BadRequestException({ code: 'TENANT_STATUS_INVALID' });

    const updated = await this.prisma.db.tenant.update({
      where: { id },
      data: { status: 'ACTIVE', suspendedAt: null, activatedAt: new Date() },
    });

    await this.prisma.db.auditLog.create({
      data: {
        actorUserId: principal.id,
        action: 'tenant.reactivate',
        entityType: 'tenant',
        entityId: id,
        result: 'SUCCESS',
        reason: reason ?? null,
        requestId,
      },
    });

    return updated;
  }

  async listGeofences(tenantId?: string, activeOnly?: boolean) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (activeOnly !== undefined) where.active = activeOnly;
    const rows = await this.prisma.db.geofence.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        tenantId: true,
        sppgId: true,
        deliveryLocationId: true,
        type: true,
        shapeType: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        minGpsAccuracyMeters: true,
        confirmationFixes: true,
        confirmationDurationSeconds: true,
        // Wajib disertakan agar geofence POLYGON tetap tergambar di peta platform.
        polygonCoordinates: true,
        active: true,
        version: true,
        createdAt: true,
        sppg: { select: { code: true, name: true } },
        deliveryLocation: { select: { code: true, name: true } },
      },
      take: 200,
    });
    return this.attachTenant(rows);
  }

  async listPlatformGeofences(tenantId?: string, activeOnly?: boolean) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (activeOnly !== undefined) where.active = activeOnly;
    const rows = await this.prisma.db.geofence.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        tenantId: true,
        sppgId: true,
        deliveryLocationId: true,
        type: true,
        shapeType: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        minGpsAccuracyMeters: true,
        confirmationFixes: true,
        confirmationDurationSeconds: true,
        // Wajib disertakan agar geofence POLYGON tetap tergambar di peta platform.
        polygonCoordinates: true,
        active: true,
        version: true,
        createdAt: true,
        sppg: { select: { code: true, name: true } },
        deliveryLocation: { select: { code: true, name: true } },
      },
      take: 500,
    });
    return this.attachTenant(rows);
  }

  /**
   * Geofence.tenantId tidak memiliki relasi Prisma ke Tenant, sehingga data tenant
   * dilampirkan lewat query terpisah agar endpoint platform tidak error (500).
   */
  private async attachTenant<T extends { tenantId: string | null }>(rows: T[]) {
    const tenantIds = [...new Set(rows.map((row) => row.tenantId).filter((id): id is string => Boolean(id)))];
    if (!tenantIds.length) {
      return rows.map((row) => ({ ...row, tenant: null }));
    }
    const tenants = await this.prisma.db.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, tenantCode: true, name: true },
    });
    const byId = new Map(
      tenants.map((tenant) => [tenant.id, { tenantCode: tenant.tenantCode, name: tenant.name }]),
    );
    return rows.map((row) => ({
      ...row,
      tenant: row.tenantId ? byId.get(row.tenantId) ?? null : null,
    }));
  }

  async recipientReviewSummary(tenantId?: string, from?: string, to?: string) {
    const where: any = {};
    if (tenantId) where.trip = { tenantId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const reviews = await this.prisma.db.recipientReview.findMany({
      where,
      select: { rating: true, emoji: true, createdAt: true, trip: { select: { tenantId: true } } },
    });

    const tenantIds = [...new Set(reviews.map((r) => r.trip?.tenantId).filter((id): id is string => Boolean(id)))];
    const tenantRows = tenantIds.length
      ? await this.prisma.db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, tenantCode: true, name: true } })
      : [];
    const tenantById = new Map(tenantRows.map((t) => [t.id, t]));

    const total = reviews.length;
    const averageRating = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
    const distribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: reviews.filter((r) => r.rating === rating).length,
    }));

    const emojiCounts = new Map<string, number>();
    for (const r of reviews) {
      if (r.emoji) emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) ?? 0) + 1);
    }
    const emojis = [...emojiCounts.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count);

    const byTenant = new Map<string, { tenantId: string; tenantCode: string; name: string; total: number; sum: number }>();
    for (const r of reviews) {
      const tid = r.trip?.tenantId;
      if (!tid) continue;
      const t = tenantById.get(tid);
      if (!t) continue;
      const current = byTenant.get(tid) ?? { tenantId: tid, tenantCode: t.tenantCode, name: t.name, total: 0, sum: 0 };
      current.total += 1;
      current.sum += r.rating;
      byTenant.set(tid, current);
    }
    const tenants = [...byTenant.values()].map((t) => ({
      tenantId: t.tenantId,
      tenantCode: t.tenantCode,
      name: t.name,
      total: t.total,
      averageRating: t.total > 0 ? t.sum / t.total : 0,
    })).sort((a, b) => b.averageRating - a.averageRating);

    return {
      total,
      averageRating: Number(averageRating.toFixed(2)),
      distribution,
      emojis,
      tenants,
    };
  }

  async recipientReviewsRecent(tenantId?: string, limit = 20) {
    const where: any = {};
    if (tenantId) where.trip = { tenantId };
    const rows = await this.prisma.db.recipientReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        rating: true,
        emoji: true,
        comment: true,
        status: true,
        createdAt: true,
        trip: { select: { tenantId: true } },
        user: { select: { displayName: true, username: true } },
      },
    });
    const tenantIds = [...new Set(rows.map((r) => r.trip?.tenantId).filter((id): id is string => Boolean(id)))];
    const tenantRows = tenantIds.length
      ? await this.prisma.db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, tenantCode: true, name: true } })
      : [];
    const tenantById = new Map(tenantRows.map((t) => [t.id, t]));
    return rows.map((r) => {
      const t = r.trip?.tenantId ? tenantById.get(r.trip.tenantId) : null;
      return {
        id: r.id,
        rating: r.rating,
        emoji: r.emoji,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        tenantCode: t?.tenantCode ?? null,
        tenantName: t?.name ?? null,
        userName: r.user?.displayName ?? r.user?.username ?? null,
      };
    });
  }

  async summary(filters?: { tenantId?: string; from?: string; to?: string }) {
    const tripWhere: any = {};
    if (filters?.tenantId) tripWhere.tenantId = filters.tenantId;
    if (filters?.from || filters?.to) {
      tripWhere.plannedDepartureAt = {};
      if (filters.from) tripWhere.plannedDepartureAt.gte = new Date(filters.from);
      if (filters.to) tripWhere.plannedDepartureAt.lte = new Date(filters.to);
    }
    const [tenants, trips, drivers] = await Promise.all([
      this.prisma.db.tenant.count(filters?.tenantId ? { where: { id: filters.tenantId } } : undefined),
      this.prisma.db.trip.count({ where: tripWhere }),
      this.prisma.db.driver.count(filters?.tenantId ? { where: { tenantId: filters.tenantId } } : undefined),
    ]);
    return { tenants, trips, drivers };
  }

  async dashboardSummary() {
    const [tenantTotal, tenantActive, tenantPendingActivation, tenantSuspended, registrationPendingReview, approvalPending] =
      await Promise.all([
        this.prisma.db.tenant.count(),
        this.prisma.db.tenant.count({ where: { status: 'ACTIVE' } }),
        this.prisma.db.tenant.count({ where: { status: 'PENDING_ACTIVATION' } }),
        this.prisma.db.tenant.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.db.tenantRegistration.count({
          where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        }),
        this.prisma.db.approvalRequest.count({ where: { status: 'PENDING_APPROVAL' } }),
      ]);

    return {
      tenants: {
        total: tenantTotal,
        active: tenantActive,
        pendingActivation: tenantPendingActivation,
        suspended: tenantSuspended,
      },
      registrations: { pendingReview: registrationPendingReview },
      approvals: { pending: approvalPending },
      refreshedAt: new Date().toISOString(),
    };
  }
}
