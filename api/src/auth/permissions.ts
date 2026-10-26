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

export function hasPermission(
  principal: SessionPrincipal,
  permission: string,
): boolean {
  return principal.roles.some((role) => role.permissions.includes(permission));
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
