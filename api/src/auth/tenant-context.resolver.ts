import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from './tenant-context.js';

@Injectable()
export class TenantContextResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<TenantContext | null> {
    const membership = await this.prisma.db.tenantMembership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return null;

    const tenant = await this.prisma.db.tenant.findUnique({
      where: { id: membership.tenantId },
    });
    if (!tenant || tenant.status !== 'ACTIVE') return null;

    return {
      userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role as TenantContext['role'],
      permissions: [],
    };
  }
}
