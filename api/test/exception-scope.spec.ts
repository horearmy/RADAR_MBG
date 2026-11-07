import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { canAccessExceptionScope } from '../src/exceptions/exception-access-policy.js';

describe('exception access scope', () => {
  const entity = { organizationId: 'org-1', regionId: 'region-1', sppgId: 'sppg-1' };

  it('allows global admin', () => {
    expect(canAccessExceptionScope({ roles: [{ isGlobal: true, organizationId: null, regionId: null, sppgId: null }] } as any, entity)).toBe(true);
  });

  it('allows same sppg', () => {
    expect(canAccessExceptionScope({ roles: [{ isGlobal: false, organizationId: null, regionId: null, sppgId: 'sppg-1' }] } as any, entity)).toBe(true);
  });

  it('denies different sppg/region/org', () => {
    expect(canAccessExceptionScope({ roles: [{ isGlobal: false, organizationId: 'org-2', regionId: 'region-2', sppgId: 'sppg-2' }] } as any, entity)).toBe(false);
  });

  it('denies no roles', () => {
    expect(canAccessExceptionScope({ roles: [] } as any, entity)).toBe(false);
  });
});
