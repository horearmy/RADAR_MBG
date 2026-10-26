import { vi } from 'vitest';
import { AuditService } from './audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { SessionPrincipal } from '../auth/auth.service.js';

describe('audit service scope', () => {
  it('includes master-data audit history only for resources visible to the assigned SPPG scope', async () => {
    const auditFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      db: {
        sppg: { findMany: vi.fn().mockResolvedValue([
          { id: 'sppg-a', organizationId: 'org-a', regionId: 'region-a' },
        ]) },
        region: { findMany: vi.fn().mockResolvedValue([{ id: 'region-a', organizationId: 'org-a' }]) },
        deliveryLocation: { findMany: vi.fn().mockResolvedValue([{ id: 'location-a' }]) },
        geofence: { findMany: vi.fn().mockResolvedValue([{ id: 'geofence-a' }]) },
        vehicle: { findMany: vi.fn().mockResolvedValue([{ id: 'vehicle-a' }]) },
        driver: { findMany: vi.fn().mockResolvedValue([{ id: 'driver-a' }]) },
        driverVehicleAssignment: { findMany: vi.fn().mockResolvedValue([{ id: 'assignment-a' }]) },
        trip: { findMany: vi.fn().mockResolvedValue([{ id: 'trip-a' }]) },
        exceptionCase: { findMany: vi.fn().mockResolvedValue([{ id: 'exception-a' }]) },
        approvalRequest: { findMany: vi.fn().mockResolvedValue([{ id: 'approval-a' }]) },
        auditLog: { findMany: auditFindMany, count: vi.fn().mockResolvedValue(0) },
      },
    } as unknown as PrismaService;
    const service = new AuditService(prisma);
    const principal = {
      id: 'user-a',
      username: 'admin-a',
      displayName: 'Admin A',
      mfaEnabled: true,
      driverId: null,
      roles: [{
        code: 'SPPG_ADMIN',
        isGlobal: false,
        organizationId: null,
        regionId: null,
        sppgId: 'sppg-a',
        permissions: ['audit:read'],
      }],
    } satisfies SessionPrincipal;

    await service.list(principal, { page: 1, pageSize: 25 });

    const where = auditFindMany.mock.calls[0][0].where;
    const scopeFilter = where.AND[0].OR as Array<{ entityType: string; entityId: { in: string[] } }>;
    const idsByType = new Map(scopeFilter.map((filter) => [filter.entityType, filter.entityId.in]));
    expect(idsByType.get('organization')).toEqual([]);
    expect(idsByType.get('region')).toEqual(['region-a']);
    expect(idsByType.get('sppg')).toEqual(['sppg-a']);
    expect(idsByType.get('delivery_location')).toEqual(['location-a']);
    expect(idsByType.get('geofence')).toEqual(['geofence-a']);
    expect(idsByType.get('vehicle')).toEqual(['vehicle-a']);
    expect(idsByType.get('driver')).toEqual(['driver-a']);
    expect(idsByType.get('driver_vehicle_assignment')).toEqual(['assignment-a']);
    expect(idsByType.get('trip')).toEqual(['trip-a']);
    expect(idsByType.get('exception_case')).toEqual(['exception-a']);
    expect(idsByType.get('approval_request')).toEqual(['approval-a']);
  });
});
