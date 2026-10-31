import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    return this.prisma.db.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
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
}
