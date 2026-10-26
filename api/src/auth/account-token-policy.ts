import { AccountStatus } from '@prisma/client';

export function isAccountTokenUsable(input: {
  purpose: string;
  accountStatus: AccountStatus;
  expiresAt: Date;
  consumedAt: Date | null;
  now: Date;
}) {
  if (input.consumedAt || input.expiresAt <= input.now) return false;
  if (input.purpose === 'INVITATION') return input.accountStatus === AccountStatus.INVITED;
  if (input.purpose === 'PASSWORD_RESET') return input.accountStatus === AccountStatus.ACTIVE;
  return false;
}
