import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecipientService } from '../src/recipient/recipient.service.js';

function createPrisma(stopSiteId: string, memberSiteIds: string[]) {
  const tx = {};
  const prisma = {
    db: {
      recipientMembership: {
        findMany: vi.fn(async () => memberSiteIds.map((id) => ({ recipientSiteId: id, status: 'ACTIVE', site: { id, organization: {} } }))),
      },
      deliveryStop: {
        findUnique: vi.fn(async () => ({ id: 'stop-1', recipientSiteId: stopSiteId, site: { id: stopSiteId, organization: {} }, trip: { id: 'trip-1', sppg: null, deliveryLocation: null, vehicle: null, driver: null, deliveryRecords: [] } })),
      },
      deliveryLocation: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    },
  };
  return prisma as any;
}

const storage = { configured: false, signedDownloadUrl: vi.fn() } as any;

describe('recipient IDOR/BOLA', () => {
  it('denies reading a stop from another recipient site', async () => {
    const prisma = createPrisma('site-b', ['site-a']);
    const service = new RecipientService(prisma, storage);
    await expect(service.getStop('user-1', 'stop-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies opening POD from another recipient site', async () => {
    const prisma = createPrisma('site-b', ['site-a']);
    const service = new RecipientService(prisma, storage);
    await expect(service.getPod('user-1', 'stop-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies confirming a stop from another recipient site', async () => {
    const prisma = createPrisma('site-b', ['site-a']);
    const service = new RecipientService(prisma, storage);
    await expect(service.confirm('user-1', 'stop-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies reporting an issue for a stop from another recipient site', async () => {
    const prisma = createPrisma('site-b', ['site-a']);
    const service = new RecipientService(prisma, storage);
    await expect(service.reportIssue('user-1', 'stop-1', { category: 'OTHER', description: 'test' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows reading a stop from an owned recipient site', async () => {
    const prisma = createPrisma('site-a', ['site-a']);
    const service = new RecipientService(prisma, storage);
    const result = await service.getStop('user-1', 'stop-1');
    expect(result.stopId).toBe('stop-1');
  });
});