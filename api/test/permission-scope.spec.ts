import { describe, expect, it } from 'vitest';
import { hasPermission } from '../src/auth/permissions.js';
import type { SessionPrincipal } from '../src/auth/auth.service.js';

function principal(overrides: Partial<SessionPrincipal> = {}): SessionPrincipal {
  return {
    id: 'user-1',
    username: 'user',
    displayName: 'User',
    mfaEnabled: false,
    driverId: null,
    roles: [],
    tenantRole: null,
    tenantMemberships: [],
    ...overrides,
  };
}

describe('permission scope', () => {
  it('grants global admin all permissions', () => {
    const user = principal({
      roles: [{ code: 'SUPERADMIN', isGlobal: true, organizationId: null, regionId: null, sppgId: null, permissions: [] }],
    });
    expect(hasPermission(user, 'tenant:read')).toBe(true);
    expect(hasPermission(user, 'master:manage')).toBe(true);
  });

  it('grants tenant admin tenant permissions from membership', () => {
    const user = principal({
      tenantMemberships: [{ tenantId: 'tenant-1', tenantCode: 'T1', tenantName: 'Tenant 1', role: 'TENANT_ADMIN' }],
    });
    expect(hasPermission(user, 'tenant:read')).toBe(true);
    expect(hasPermission(user, 'tenant:manage')).toBe(true);
  });

  it('does not grant tenant read to driver', () => {
    const user = principal({
      tenantMemberships: [{ tenantId: 'tenant-1', tenantCode: 'T1', tenantName: 'Tenant 1', role: 'TENANT_DRIVER' }],
    });
    expect(hasPermission(user, 'tenant:read')).toBe(false);
    expect(hasPermission(user, 'trip:start')).toBe(true);
  });

  it('grants recipient read from tenant role', () => {
    const user = principal({ tenantRole: 'TENANT_VIEWER' });
    expect(hasPermission(user, 'tenant:read')).toBe(true);
  });
});