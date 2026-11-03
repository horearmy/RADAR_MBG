import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}


  async listTenants() {
    return this.prisma.db.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async listGeofences(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.db.geofence.findMany({
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
        active: true,
        version: true,
        createdAt: true,
        tenant: { select: { tenantCode: true, name: true } },
        sppg: { select: { code: true, name: true } },
        deliveryLocation: { select: { code: true, name: true } },
      },
      take: 200,
    });
  }

  async listPlatformGeofences(tenantId?: string, activeOnly?: boolean) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (activeOnly !== undefined) where.active = activeOnly;
    return this.prisma.db.geofence.findMany({
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
        active: true,
        version: true,
        createdAt: true,
        tenant: { select: { tenantCode: true, name: true } },
        sppg: { select: { code: true, name: true } },
        deliveryLocation: { select: { code: true, name: true } },
      },
      take: 500,
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
