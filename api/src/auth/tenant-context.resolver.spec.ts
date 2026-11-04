import { TenantContextResolver } from './tenant-context.resolver.js';

describe('TenantContextResolver', () => {
  const memberships = [
    { id: 'membership-a', tenantId: '11111111-1111-4111-8111-111111111111', userId: 'user-a', role: 'TENANT_ADMIN', status: 'ACTIVE' },
    { id: 'membership-b', tenantId: '22222222-2222-4222-8222-222222222222', userId: 'user-a', role: 'TENANT_VIEWER', status: 'ACTIVE' },
  ];
  const tenants = [
    { id: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE', legacySppgId: 'sppg-a', features: { trips: true, invalid: 'true' } },
    { id: '22222222-2222-4222-8222-222222222222', status: 'ACTIVE', legacySppgId: 'sppg-b', features: { trips: false } },
  ];

  function createResolver() {
    const prisma = {
      db: {
        tenantMembership: {
          findMany: vi.fn(async ({ where }: { where: { tenantId?: string } }) => {
            return memberships
              .filter((membership) => !where.tenantId || membership.tenantId === where.tenantId)
              .filter((membership) => tenants.find((tenant) => tenant.id === membership.tenantId)?.status === 'ACTIVE')
              .map((membership) => ({
                ...membership,
                tenant: tenants.find((tenant) => tenant.id === membership.tenantId)!,
              }));
          }),
        },
      },
    };
    return { resolver: new TenantContextResolver(prisma as never), prisma };
  }

  it('requires explicit tenant selection when user has active memberships', async () => {
    const { resolver } = createResolver();
    await expect(resolver.resolve('user-a')).resolves.toBeNull();
  });

  it('resolves only the requested active tenant membership and SPPG scope', async () => {
    const { resolver } = createResolver();
    await expect(resolver.resolve('user-a', '22222222-2222-4222-8222-222222222222')).resolves.toEqual({
      userId: 'user-a',
      tenantId: '22222222-2222-4222-8222-222222222222',
      membershipId: 'membership-b',
      sppgId: 'sppg-b',
      role: 'TENANT_VIEWER',
      features: { trips: false },
      permissions: [],
    });
  });

  it('rejects malformed tenant identifiers before querying the database', async () => {
    const { resolver, prisma } = createResolver();
    await expect(resolver.resolve('user-a', 'not-a-tenant')).resolves.toBeNull();
    expect(prisma.db.tenantMembership.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when the requested tenant has no active membership', async () => {
    const { resolver } = createResolver();
    await expect(resolver.resolve('user-a', '33333333-3333-4333-8333-333333333333')).resolves.toBeNull();
  });
});
