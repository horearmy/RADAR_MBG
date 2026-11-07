import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MasterDataService } from '../src/admin/master-data.service.js';

function createPrisma(driverTenantId: string) {
  const tx = {};
  const prisma = {
    db: {
      driver: {
        findFirst: vi.fn(async (args: any) => {
          const whereTenant = args?.where?.tenantId;
          if (whereTenant && whereTenant !== driverTenantId) return null;
          return {
            id: 'driver-1',
            tenantId: driverTenantId,
            sppgId: 'sppg-1',
            sppg: { id: 'sppg-1', organizationId: 'org-1', regionId: 'region-1', status: 'ACTIVE' },
            user: null,
          };
        }),
      },
      tenant: {
        findUnique: vi.fn(async () => ({ id: driverTenantId, tenantCode: 'T-1', name: 'Tenant 1' })),
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
  roles: [
    { code: 'TENANT_ADMIN', isGlobal: false, organizationId: null, regionId: null, sppgId: null, permissions: [] },
    { code: 'TENANT_SCOPE', isGlobal: false, organizationId: null, regionId: null, sppgId: 'sppg-1', permissions: [] },
  ],
  tenantMemberships: [{ tenantId: 'tenant-a', tenantCode: 'T-A', tenantName: 'Tenant A', role: 'TENANT_ADMIN' }],
  hasTenantMemberships: true,
  tenantRole: 'TENANT_ADMIN',
  tenantId: 'tenant-a',
  features: null,
} as any;

describe('master-data IDOR (driver)', () => {
  it('denies reading a driver from another tenant', async () => {
    const prisma = createPrisma('tenant-b');
    const service = new MasterDataService(prisma);
    await expect(service.getDriver('driver-1', tenantPrincipal, { tenantId: 'tenant-a' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows reading a driver from the same tenant', async () => {
    const prisma = createPrisma('tenant-a');
    const service = new MasterDataService(prisma);
    const result = await service.getDriver('driver-1', tenantPrincipal, { tenantId: 'tenant-a' });
    expect(result.id).toBe('driver-1');
  });
});
