import {
  canAccessSppg,
  hasPermission,
  type SppgScope,
} from './permissions.js';
import type { SessionPrincipal } from './auth.service.js';

const target: SppgScope = {
  organizationId: 'org-1',
  regionId: 'region-1',
  sppgId: 'sppg-1',
};

function principal(
  role: Partial<SessionPrincipal['roles'][number]>,
): SessionPrincipal {
  return {
    id: 'user-1',
    username: 'operator',
    displayName: 'Operator',
    mfaEnabled: false,
    driverId: null,
    roles: [
      {
        code: 'OPERATOR',
        isGlobal: false,
        organizationId: null,
        regionId: null,
        sppgId: null,
        permissions: [],
        ...role,
      },
    ],
  };
}

describe('authorization scope helpers', () => {
  it('requires the explicit permission grant', () => {
    expect(hasPermission(principal({ permissions: ['trip:read'] }), 'trip:read')).toBe(true);
    expect(hasPermission(principal({ permissions: [] }), 'trip:read')).toBe(false);
  });

  it('limits SPPG roles to their assigned scope and permits global roles', () => {
    expect(canAccessSppg(principal({ sppgId: 'sppg-1' }), target)).toBe(true);
    expect(canAccessSppg(principal({ sppgId: 'sppg-other' }), target)).toBe(false);
    expect(canAccessSppg(principal({ regionId: 'region-1' }), target)).toBe(true);
    expect(canAccessSppg(principal({ organizationId: 'org-1' }), target)).toBe(true);
    expect(canAccessSppg(principal({ isGlobal: true }), target)).toBe(true);
  });
});
