import 'reflect-metadata';
import { GeofenceLocationType } from '../src/trips/geofence.dto.js';
import { GeofenceService } from '../src/trips/geofence.service.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';
const sppgId = '44444444-4444-4444-8444-444444444444';

const tenantPrincipal = {
  id: 'user-tenant-a',
  username: 'tenant-a',
  displayName: 'Tenant A',
  mfaEnabled: true,
  driverId: null,
  roles: [{ code: 'TENANT_ADMIN', isGlobal: false, organizationId: null, regionId: null, sppgId: null, permissions: [] }],
};

function createService(location: Record<string, unknown> | null, legacySppgId: string | null = null) {
  const tx = {
    deliveryLocation: { findUnique: vi.fn(async () => location) },
    tenant: { findUnique: vi.fn(async () => ({ legacySppgId })) },
    sppg: { findUnique: vi.fn(async () => ({ organizationId: 'org-1', regionId: 'region-1' })) },
    geofence: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => ({ id: 'geofence-old', version: 2 })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'geofence-new', ...data })),
      findMany: vi.fn(async () => []),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $executeRaw: vi.fn(async () => 1),
  };
  const prisma = {
    db: {
      ...tx,
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
  return { service: new GeofenceService(prisma as never), prisma, tx };
}

describe('cross-tenant negative', () => {
  it('denies a tenant access to a delivery location owned by another tenant even when organization and region match', async () => {
    const { service } = createService({
      id: locationId,
      organizationId: 'org-1',
      regionId: 'region-1',
      active: true,
      tenantId: tenantB,
    });

    await expect(
      service.listForLocation(
        { locationType: GeofenceLocationType.DELIVERY, locationId },
        tenantPrincipal,
        { tenantId: tenantA },
      ),
    ).rejects.toMatchObject({ response: { code: 'LOCATION_NOT_FOUND' } });
  });

  it('allows a tenant access to its own delivery location', async () => {
    const { service, tx } = createService({
      id: locationId,
      organizationId: 'org-1',
      regionId: 'region-1',
      active: true,
      tenantId: tenantA,
    });

    await expect(
      service.listForLocation(
        { locationType: GeofenceLocationType.DELIVERY, locationId },
        tenantPrincipal,
        { tenantId: tenantA },
      ),
    ).resolves.toEqual([]);
    expect(tx.geofence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: tenantA }) }),
    );
  });

  it('keeps legacy access only for unowned delivery locations', async () => {
    const { service } = createService(
      { id: locationId, organizationId: 'org-1', regionId: 'region-1', active: true, tenantId: null },
      sppgId,
    );

    await expect(
      service.listForLocation(
        { locationType: GeofenceLocationType.DELIVERY, locationId },
        tenantPrincipal,
        { tenantId: tenantA },
      ),
    ).resolves.toEqual([]);
  });

  it('only deactivates geofences owned by the requesting tenant', async () => {
    const { service, tx } = createService({
      id: locationId,
      organizationId: 'org-1',
      regionId: 'region-1',
      active: true,
      tenantId: tenantA,
    });

    await service.create(
      {
        locationType: GeofenceLocationType.DELIVERY,
        locationId,
        shapeType: 'CIRCLE',
        name: 'Geofence A',
        centerLatitude: -6.2,
        centerLongitude: 106.8,
        radiusMeters: 100,
        minGpsAccuracyMeters: 50,
        confirmationFixes: 2,
        confirmationDurationSeconds: 10,
        reason: 'test',
      },
      tenantPrincipal,
      'test-key-12345678',
      'request-1',
      { tenantId: tenantA },
    );

    expect(tx.geofence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA, active: true }),
      }),
    );
    expect(tx.geofence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA, active: true }),
      }),
    );
  });
});
