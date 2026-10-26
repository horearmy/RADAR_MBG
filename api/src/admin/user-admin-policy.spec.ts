import {
  assertCanAssignRole,
  assertCanResetMfa,
  assertGlobalRoleAssignment,
  assertNotLastGlobalAdmin,
  assertNotSelfDeactivation,
} from './user-admin-policy.js';

describe('user administration policy', () => {
  it('requires MFA before assigning MFA-required roles', () => {
    expect(() => assertCanAssignRole({ isGlobal: false, requiresMfa: true, mfaEnabled: false, scopeCount: 1 }))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'MFA_REQUIRED_FOR_ROLE' }) }));
  });

  it('requires exactly one scope for non-global roles and none for global roles', () => {
    expect(() => assertCanAssignRole({ isGlobal: false, requiresMfa: false, mfaEnabled: false, scopeCount: 0 }))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'ROLE_SCOPE_INVALID' }) }));
    expect(() => assertCanAssignRole({ isGlobal: true, requiresMfa: false, mfaEnabled: true, scopeCount: 1 }))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'ROLE_SCOPE_INVALID' }) }));
    expect(() => assertCanAssignRole({ isGlobal: false, requiresMfa: false, mfaEnabled: false, scopeCount: 1 }))
      .not.toThrow();
  });

  it('prevents self-deactivation and removing the last active global administrator', () => {
    expect(() => assertNotSelfDeactivation('same', 'same', false))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'USER_CANNOT_SUSPEND_SELF' }) }));
    expect(() => assertNotLastGlobalAdmin(true, 1))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'LAST_ACTIVE_GLOBAL_ADMIN' }) }));
    expect(() => assertNotLastGlobalAdmin(true, 2)).not.toThrow();
  });

  it('restricts global role assignment to a global administrator', () => {
    expect(() => assertGlobalRoleAssignment(false, true))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'GLOBAL_ROLE_ASSIGNMENT_FORBIDDEN' }) }));
    expect(() => assertGlobalRoleAssignment(false, false)).not.toThrow();
  });

  it('requires a different administrator with MFA to reset an account MFA factor', () => {
    expect(() => assertCanResetMfa('same', 'same', true))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'MFA_RESET_SELF_FORBIDDEN' }) }));
    expect(() => assertCanResetMfa('admin', 'target', false))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'MFA_RESET_REQUIRES_MFA' }) }));
    expect(() => assertCanResetMfa('admin', 'target', true)).not.toThrow();
  });
});
