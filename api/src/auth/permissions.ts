import { ForbiddenException, SetMetadata } from '@nestjs/common';
import type { SessionPrincipal } from './auth.service.js';

const REQUIRED_PERMISSIONS = 'radar:required-permissions';

export type SppgScope = {
  organizationId: string;
  regionId: string;
  sppgId: string;
};

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS, permissions);
}

const TENANT_ROLE_PERMISSIONS: Record<string, string[]> = {
  TENANT_ADMIN: [
    'trip:read', 'trip:create', 'trip:schedule', 'trip:dispatch', 'trip:manage', 'trip:start', 'trip:location:update', 'trip:track:read',
    'master:read', 'master:manage', 'sppg:read', 'sppg:manage', 'organization:read',
    'geofence:read', 'geofence:manage',
    'exception:read',
    'report:read',
    'tenant:read',
  ],
  TENANT_OPERATOR: [
    'trip:read', 'trip:create', 'trip:schedule', 'trip:dispatch', 'trip:manage', 'trip:track:read',
    'master:read', 'sppg:read',
    'geofence:read',
    'exception:read',
    'report:read',
    'tenant:read',
  ],
  TENANT_DRIVER: [
    'trip:read', 'trip:start', 'trip:location:update', 'trip:track:read',
  ],
  TENANT_VIEWER: [
    'trip:read', 'trip:track:read',
    'master:read', 'sppg:read',
    'report:read',
    'tenant:read',
  ],
};

export function hasPermission(
  principal: SessionPrincipal,
  permission: string,
): boolean {
  if (principal.roles.some((role) => role.permissions.includes(permission))) return true;
  if (principal.tenantRole && TENANT_ROLE_PERMISSIONS[principal.tenantRole]?.includes(permission)) return true;
  return false;
}

export function canAccessSppg(
  principal: SessionPrincipal,
  target: SppgScope,
): boolean {
  return principal.roles.some(
    (role) =>
      role.isGlobal ||
      role.organizationId === target.organizationId ||
      role.regionId === target.regionId ||
      role.sppgId === target.sppgId,
  );
}

export function assertSppgAccess(
  principal: SessionPrincipal,
  target: SppgScope,
): void {
  if (!canAccessSppg(principal, target)) {
    throw new ForbiddenException({
      code: 'SCOPE_FORBIDDEN',
      message: 'Akses ke data SPPG ini tidak diizinkan.',
    });
  }
}

export { REQUIRED_PERMISSIONS };
