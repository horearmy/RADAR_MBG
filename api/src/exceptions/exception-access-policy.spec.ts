import { canAccessExceptionScope } from './exception-access-policy.js';

const entity = {
  organizationId: 'org-1',
  regionId: 'region-1',
  sppgId: 'sppg-2',
};

describe('exception scope policy', () => {
  it('does not expose a deduplicated exception from another SPPG in the same organization', () => {
    expect(canAccessExceptionScope({
      roles: [{
        code: 'SPPG_ADMIN',
        isGlobal: false,
        organizationId: null,
        regionId: null,
        sppgId: 'sppg-1',
        permissions: [],
      }],
    }, entity)).toBe(false);
  });

  it('allows an explicit organization, region, SPPG, or global scope', () => {
    for (const scope of [
      { organizationId: 'org-1', regionId: null, sppgId: null },
      { organizationId: null, regionId: 'region-1', sppgId: null },
      { organizationId: null, regionId: null, sppgId: 'sppg-2' },
      { organizationId: null, regionId: null, sppgId: null, isGlobal: true },
    ]) {
      expect(canAccessExceptionScope({
        roles: [{
          code: 'TEST',
          isGlobal: scope.isGlobal ?? false,
          organizationId: scope.organizationId,
          regionId: scope.regionId,
          sppgId: scope.sppgId,
          permissions: [],
        }],
      }, entity)).toBe(true);
    }
  });
});
