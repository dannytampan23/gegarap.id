import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import { mockPrisma } from './mocks/prisma';
import { matchesDeclaredFileType } from '@/lib/file-signature';
import { durableRateLimit } from '@/lib/rate-limit';
import { enqueueIdentitySync } from '@/lib/identity-sync';

describe('file signature validation', () => {
  it('accepts matching formats and rejects a spoofed MIME type', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(matchesDeclaredFileType(png, 'image/png')).toBe(true);
    expect(matchesDeclaredFileType(Buffer.from('not an image'), 'image/png')).toBe(false);
    expect(matchesDeclaredFileType(Buffer.from('%PDF-1.7'), 'application/pdf')).toBe(true);
    expect(matchesDeclaredFileType(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg')).toBe(true);
  });
});

describe('durable mutation limiter', () => {
  it('uses a transaction-backed bucket', async () => {
    mockPrisma.$transaction.mockImplementationOnce(async (fn) =>
      (fn as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma)
    );
    mockPrisma.rateLimitBucket.findUnique.mockResolvedValue(null);
    mockPrisma.rateLimitBucket.upsert.mockResolvedValue({
      key: 'booking:u1',
      count: 1,
      resetAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });

    const result = await durableRateLimit('booking:u1', { windowMs: 60_000, max: 3 });
    expect(result).toMatchObject({ ok: true, remaining: 2 });
    expect(mockPrisma.rateLimitBucket.upsert).toHaveBeenCalledOnce();
  });
});

describe('identity sync outbox', () => {
  it('versions the event from the authoritative profile snapshot', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'Customer',
      email: 'customer@example.com',
      phone: '628123456789',
      role: 'CUSTOMER',
    } as never);
    mockPrisma.outboxMessage.upsert.mockResolvedValue({ id: 'o1' } as never);
    await enqueueIdentitySync(mockPrisma as unknown as Prisma.TransactionClient, {
      userId: 'u1',
      authProvider: 'google',
    });

    expect(mockPrisma.outboxMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ channel: 'FIREBASE_PROFILE', toAddress: 'u1' }),
      })
    );
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } })
    );
  });
});
