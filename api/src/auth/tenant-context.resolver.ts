import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from './tenant-context.js';

@Injectable()
export class TenantContextResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, requestedTenantId?: string): Promise<TenantContext | null> {
    if (!requestedTenantId) return null;
    if (requestedTenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedTenantId)) {
      return null;
    }
    const memberships = await this.prisma.db.tenantMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        tenant: { is: { status: 'ACTIVE' } },
        ...(requestedTenantId ? { tenantId: requestedTenantId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { tenant: { select: { legacySppgId: true, features: true } } },
    });
    if (memberships.length !== 1) return null;
    const membership = memberships[0];
    const features = membership.tenant.features;

    return {
      userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      sppgId: membership.tenant.legacySppgId,
      features: features && typeof features === 'object' && !Array.isArray(features)
        ? Object.fromEntries(Object.entries(features).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'))
        : null,
      role: membership.role as TenantContext['role'],
      permissions: [],
    };
  }
}
