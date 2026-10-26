import type { SessionPrincipal } from '../auth/auth.service.js';

export type ExceptionScopeEntity = {
  organizationId: string;
  regionId: string;
  sppgId: string;
};

export function canAccessExceptionScope(
  principal: Pick<SessionPrincipal, 'roles'>,
  entity: ExceptionScopeEntity,
) {
  return principal.roles.some(
    (role) =>
      role.isGlobal ||
      role.organizationId === entity.organizationId ||
      role.regionId === entity.regionId ||
      role.sppgId === entity.sppgId,
  );
}
