import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard.js';
import type { AuthenticatedRequest } from './session.guard.js';

function createContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createGuard(requiresTenant = false) {
  const reflector = {
    getAllAndOverride: vi.fn(() => requiresTenant),
  } as unknown as Reflector;
  const auditLog = { create: vi.fn(async () => ({})) };
  const prisma = { db: { auditLog } };
  return { guard: new TenantGuard(prisma as never, reflector), auditLog };
}

const globalPrincipal = {
  id: 'user-platform',
  username: 'platform',
  displayName: 'Platform',
  mfaEnabled: true,
  driverId: null,
  roles: [{ code: 'SUPERADMIN', isGlobal: true, organizationId: null, regionId: null, sppgId: null, permissions: [] }],
};

const tenantPrincipal = {
  id: 'user-tenant',
  username: 'tenant',
  displayName: 'Tenant',
  mfaEnabled: true,
  driverId: null,
  roles: [{ code: 'TENANT_ADMIN', isGlobal: false, organizationId: null, regionId: null, sppgId: null, permissions: [] }],
};

describe('TenantGuard', () => {
  it('allows requests that have a resolved tenant context', () => {
    const { guard } = createGuard();
    const context = createContext({ principal: tenantPrincipal, tenantContext: { tenantId: 'tenant-a' } as never });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows global administrators without tenant selection on platform routes', () => {
    const { guard } = createGuard();
    const context = createContext({ principal: globalPrincipal, tenantContext: null });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects global administrators on routes that require tenant selection', () => {
    const { guard } = createGuard(true);
    const context = createContext({ principal: globalPrincipal, tenantContext: null });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects tenant users when no tenant context was resolved', () => {
    const { guard, auditLog } = createGuard();
    const context = createContext({ principal: tenantPrincipal, tenantContext: null });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorUserId: 'user-tenant' }) }),
    );
  });
});
