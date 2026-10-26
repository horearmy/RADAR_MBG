import { AccountStatus } from '@prisma/client';
import { isAccountTokenUsable } from './account-token-policy.js';

describe('account access token policy', () => {
  const now = new Date('2026-10-26T12:00:00.000Z');
  const valid = {
    expiresAt: new Date('2026-10-27T12:00:00.000Z'),
    consumedAt: null,
    now,
  };

  it('accepts an unused invitation only for an invited account', () => {
    expect(isAccountTokenUsable({ ...valid, purpose: 'INVITATION', accountStatus: AccountStatus.INVITED })).toBe(true);
    expect(isAccountTokenUsable({ ...valid, purpose: 'INVITATION', accountStatus: AccountStatus.ACTIVE })).toBe(false);
  });

  it('accepts password reset only for an active account', () => {
    expect(isAccountTokenUsable({ ...valid, purpose: 'PASSWORD_RESET', accountStatus: AccountStatus.ACTIVE })).toBe(true);
    expect(isAccountTokenUsable({ ...valid, purpose: 'PASSWORD_RESET', accountStatus: AccountStatus.SUSPENDED })).toBe(false);
  });

  it('rejects expired, consumed, and unknown-purpose tokens', () => {
    expect(isAccountTokenUsable({ ...valid, purpose: 'INVITATION', accountStatus: AccountStatus.INVITED, expiresAt: now })).toBe(false);
    expect(isAccountTokenUsable({ ...valid, purpose: 'INVITATION', accountStatus: AccountStatus.INVITED, consumedAt: now })).toBe(false);
    expect(isAccountTokenUsable({ ...valid, purpose: 'OTHER', accountStatus: AccountStatus.ACTIVE })).toBe(false);
  });
});
