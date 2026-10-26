import { vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { DistributedLoginRateLimiter, LoginRateLimiter } from './login-rate-limiter.js';

describe('login rate limiter', () => {
  it('limits repeated attempts for one identity and then allows a new window', () => {
    const limiter = new LoginRateLimiter(3, 1_000);

    expect(limiter.allows('operator', '192.0.2.1', 0)).toBe(true);
    expect(limiter.allows('operator', '192.0.2.1', 1)).toBe(true);
    expect(limiter.allows('operator', '192.0.2.1', 2)).toBe(true);
    expect(limiter.allows('operator', '192.0.2.1', 3)).toBe(false);
    expect(limiter.allows('operator', '192.0.2.1', 1_000)).toBe(true);
  });

  it('limits password spraying across identities from the same IP', () => {
    const limiter = new LoginRateLimiter(2, 1_000);

    expect(limiter.allows('first', '192.0.2.2', 0)).toBe(true);
    expect(limiter.allows('second', '192.0.2.2', 1)).toBe(true);
    expect(limiter.allows('third', '192.0.2.2', 2)).toBe(false);
  });

  it('clears both IP and identity buckets after successful authentication', () => {
    const limiter = new LoginRateLimiter(2, 1_000);

    expect(limiter.allows('operator', '192.0.2.3', 0)).toBe(true);
    expect(limiter.allows('other', '192.0.2.3', 1)).toBe(true);
    expect(limiter.allows('operator', '192.0.2.3', 2)).toBe(false);
    limiter.clear('operator', '192.0.2.3');
    expect(limiter.allows('operator', '192.0.2.3', 3)).toBe(true);
  });

  it('uses database-backed atomic buckets for IP and identity limits', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ attempt_count: 1 }])
      .mockResolvedValueOnce([{ attempt_count: 1 }])
      .mockResolvedValueOnce([{ attempt_count: 11 }])
      .mockResolvedValueOnce([{ attempt_count: 2 }]);
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<boolean>) => callback({
      $queryRaw: query,
      $executeRaw: vi.fn().mockResolvedValue(0),
    }));
    const prisma = { db: { $transaction: transaction } } as unknown as PrismaService;
    const limiter = new DistributedLoginRateLimiter(prisma, 10, 60_000);

    await expect(limiter.allows('operator', '192.0.2.4', 0)).resolves.toBe(true);
    await expect(limiter.allows('other', '192.0.2.4', 1)).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(4);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('clears the shared database buckets after successful authentication', async () => {
    const execute = vi.fn().mockResolvedValue(2);
    const prisma = { db: { $executeRaw: execute } } as unknown as PrismaService;
    const limiter = new DistributedLoginRateLimiter(prisma);

    await limiter.clear('operator', '192.0.2.5');

    expect(execute).toHaveBeenCalledOnce();
  });
});
