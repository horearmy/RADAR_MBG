import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TripService } from '../src/trips/trip.service.js';

function createPrisma(tripTenantId: string) {
  const tx = {};
  const prisma = {
    db: {
      trip: {
        findFirst: vi.fn(async (args: any) => {
          const whereTenant = args?.where?.tenantId;
          if (whereTenant && whereTenant !== tripTenantId) return null;
          return { id: 'trip-1', tenantId: tripTenantId, status: 'DRAFT', deliveryRecords: [] };
        }),
        findMany: vi.fn(async () => []),
      },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    },
  };
  return prisma as any;
}

const tenantPrincipal = {
  id: 'user-a',
  username: 'tenant-a',
  displayName: 'Tenant A',
  mfaEnabled: true,
  driverId: null,
  roles: [{ code: 'TENANT_ADMIN', isGlobal: false, organizationId: null, regionId: null, sppgId: null, permissions: [] }],
  tenantMemberships: [{ tenantId: 'tenant-a', tenantCode: 'T-A', tenantName: 'Tenant A', role: 'TENANT_ADMIN' }],
  hasTenantMemberships: true,
  tenantRole: 'TENANT_ADMIN',
  tenantId: 'tenant-a',
  features: null,
} as any;

describe('trip IDOR', () => {
  it('denies reading a trip from another tenant', async () => {
    const prisma = createPrisma('tenant-b');
    const service = new TripService(prisma);
    await expect(service.getTrip('trip-1', tenantPrincipal, { tenantId: 'tenant-a' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows reading a trip from the same tenant', async () => {
    const prisma = createPrisma('tenant-a');
    const service = new TripService(prisma);
    const result = await service.getTrip('trip-1', tenantPrincipal, { tenantId: 'tenant-a' });
    expect(result.id).toBe('trip-1');
  });
});
