import { ConflictException, ForbiddenException } from '@nestjs/common';

export function assertCanAssignRole(input: {
  isGlobal: boolean;
  requiresMfa: boolean;
  mfaEnabled: boolean;
  scopeCount: number;
}) {
  if (input.requiresMfa && !input.mfaEnabled) {
    throw new ConflictException({ code: 'MFA_REQUIRED_FOR_ROLE' });
  }
  if ((input.isGlobal && input.scopeCount !== 0) || (!input.isGlobal && input.scopeCount !== 1)) {
    throw new ConflictException({ code: 'ROLE_SCOPE_INVALID' });
  }
}

export function assertNotSelfDeactivation(actorId: string, targetId: string, isActive: boolean) {
  if (actorId === targetId && !isActive) {
    throw new ForbiddenException({ code: 'USER_CANNOT_SUSPEND_SELF' });
  }
}

export function assertNotLastGlobalAdmin(isGlobalAdmin: boolean, remainingActiveAdmins: number) {
  if (isGlobalAdmin && remainingActiveAdmins <= 1) {
    throw new ConflictException({ code: 'LAST_ACTIVE_GLOBAL_ADMIN' });
  }
}

export function assertGlobalRoleAssignment(actorIsGlobal: boolean, targetRoleIsGlobal: boolean) {
  if (targetRoleIsGlobal && !actorIsGlobal) {
    throw new ForbiddenException({ code: 'GLOBAL_ROLE_ASSIGNMENT_FORBIDDEN' });
  }
}

export function assertCanResetMfa(actorId: string, targetId: string, actorMfaEnabled: boolean) {
  if (actorId === targetId) throw new ForbiddenException({ code: 'MFA_RESET_SELF_FORBIDDEN' });
  if (!actorMfaEnabled) throw new ForbiddenException({ code: 'MFA_RESET_REQUIRES_MFA' });
}
