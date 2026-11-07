import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { TenantService } from '../src/tenant/tenant.service.js';

function createPrisma(locationTenantId: string) {
  const tx = {};
  const prisma = {
    db: {
      tenant: {
        findUnique: vi.fn(async () => ({ id: locationTenantId === 'tenant-a' ? 'tenant-a' : 'tenant-b', legacySppgId: 'sppg-1' })),
      },
      sppg: {
        findUnique: vi.fn(async () => ({ id: 'sppg-1' })),
      },
      deliveryLocation: {
        findFirst: vi.fn(async (args: any) => {
          const whereTenant = args?.where?.tenantId;
          if (whereTenant && whereTenant !== locationTenantId) return null;
          return { id: 'loc-1', tenantId: locationTenantId, name: 'Loc' };
        }),
      },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    },
  };
  return prisma as any;
}

const cache = { get: vi.fn(async () => null), set: vi.fn(async () => undefined), del: vi.fn(async () => undefined) } as any;
const email = {} as any;

describe('tenant IDOR (delivery location)', () => {
  it('denies reading a delivery location from another tenant', async () => {
    const prisma = createPrisma('tenant-b');
    const service = new TenantService(prisma, email, cache);
    await expect(service.getDeliveryLocation('tenant-a', 'loc-1')).rejects.toThrow('LOCATION_NOT_FOUND');
  });

  it('allows reading a delivery location from the same tenant', async () => {
    const prisma = createPrisma('tenant-a');
    const service = new TenantService(prisma, email, cache);
    const result = await service.getDeliveryLocation('tenant-a', 'loc-1');
    expect(result.id).toBe('loc-1');
  });
});
