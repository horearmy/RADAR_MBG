import { createHash } from 'node:crypto';
import type { PrismaService } from '../database/prisma.service.js';

type Bucket = { count: number; resetAt: number };

export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private checks = 0;

  constructor(
    private readonly maxAttempts = 10,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly maxBuckets = 10_000,
  ) {}

  allows(username: string, ip: string, now = Date.now()) {
    const keys = [
      `ip:${ip}`,
      `identity:${ip}:${username.toLowerCase()}`,
    ].map((value) => createHash('sha256').update(value).digest('hex'));

    this.checks += 1;
    if (this.checks % 128 === 0) {
      for (const [key, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(key);
      }
    }

    let allowed = true;
    for (const key of keys) {
      const bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        if (this.buckets.size >= this.maxBuckets) {
          allowed = false;
          continue;
        }
        this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
        continue;
      }

      bucket.count += 1;
      if (bucket.count > this.maxAttempts) allowed = false;
    }

    return allowed;
  }

  clear(username: string, ip: string) {
    for (const value of [`ip:${ip}`, `identity:${ip}:${username.toLowerCase()}`]) {
      this.buckets.delete(createHash('sha256').update(value).digest('hex'));
    }
  }
}

export class DistributedLoginRateLimiter {
  private checks = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly maxAttempts = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  async allows(username: string, ip: string, now = Date.now()) {
    const keys = this.keys(username, ip);
    const nowDate = new Date(now);
    const expiresAt = new Date(now + this.windowMs);
    return this.prisma.db.$transaction(async (tx) => {
      const counts = await Promise.all(keys.map(async (key) => {
        const rows = await tx.$queryRaw<Array<{ attempt_count: number }>>`
          INSERT INTO login_rate_limits (bucket_key, attempt_count, expires_at)
          VALUES (${key}, 1, ${expiresAt})
          ON CONFLICT (bucket_key) DO UPDATE SET
            attempt_count = CASE
              WHEN login_rate_limits.expires_at <= ${nowDate} THEN 1
              ELSE login_rate_limits.attempt_count + 1
            END,
            expires_at = CASE
              WHEN login_rate_limits.expires_at <= ${nowDate} THEN ${expiresAt}
              ELSE login_rate_limits.expires_at
            END
          RETURNING attempt_count
        `;
        return rows[0]?.attempt_count ?? this.maxAttempts + 1;
      }));

      this.checks += 1;
      if (this.checks % 128 === 0) {
        await tx.$executeRaw`DELETE FROM login_rate_limits WHERE expires_at <= ${nowDate}`;
      }
      return counts.every((count) => count <= this.maxAttempts);
    });
  }

  async clear(username: string, ip: string) {
    const [ipKey, identityKey] = this.keys(username, ip);
    await this.prisma.db.$executeRaw`
      DELETE FROM login_rate_limits WHERE bucket_key = ${ipKey} OR bucket_key = ${identityKey}
    `;
  }

  private keys(username: string, ip: string) {
    return [
      `ip:${ip}`,
      `identity:${ip}:${username.trim().toLowerCase()}`,
    ].map((value) => createHash('sha256').update(value).digest('hex'));
  }
}
