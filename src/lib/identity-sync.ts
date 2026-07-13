import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { adminDb } from '@/lib/firebase/admin';
import { logEvent } from '@/lib/logger';

const CHANNEL = 'FIREBASE_PROFILE';
const MAX_ATTEMPTS = 5;

export async function enqueueIdentitySync(
  tx: Prisma.TransactionClient,
  input: { userId: string; authProvider?: 'password' | 'google' }
): Promise<void> {
  const authProvider = input.authProvider ?? 'google';
  const profile = await tx.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true, phone: true, role: true },
  });
  if (!profile) throw new Error(`Cannot enqueue identity sync for missing user ${input.userId}`);

  const body = JSON.stringify({ authProvider });
  const version = createHash('sha256')
    .update(JSON.stringify({ ...profile, authProvider }))
    .digest('hex')
    .slice(0, 12);
  await tx.outboxMessage.upsert({
    where: { dedupeKey: `identity:${input.userId}:${version}` },
    create: {
      channel: CHANNEL,
      toAddress: input.userId,
      body,
      dedupeKey: `identity:${input.userId}:${version}`,
    },
    update: {
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      sentAt: null,
    },
  });
}

export async function dispatchIdentitySyncBatch(limit = 25) {
  const staleClaim = new Date(Date.now() - 15 * 60 * 1000);
  const rows = await prisma.outboxMessage.findMany({
    where: {
      channel: CHANNEL,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ status: 'PENDING' }, { status: 'PROCESSING', updatedAt: { lt: staleClaim } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const claimed = await prisma.outboxMessage.updateMany({
      where: {
        id: row.id,
        OR: [{ status: 'PENDING' }, { status: 'PROCESSING', updatedAt: { lt: staleClaim } }],
      },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      const payload = JSON.parse(row.body) as { authProvider?: 'password' | 'google' };
      const user = await prisma.user.findUnique({
        where: { id: row.toAddress },
        select: { name: true, email: true, phone: true, role: true },
      });
      if (!user) throw new Error('Postgres user not found');

      await adminDb
        .collection('users')
        .doc(row.toAddress)
        .set(
          {
            name: user.name,
            email: user.email,
            whatsapp: user.phone,
            role: user.role,
            authProvider: payload.authProvider ?? 'google',
          },
          { merge: true }
        );
      await prisma.outboxMessage.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
      sent++;
    } catch (error) {
      const attempts = row.attempts + 1;
      await prisma.outboxMessage.update({
        where: { id: row.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          lastError: String(error).slice(0, 1000),
        },
      });
      failed++;
      logEvent(
        'identity.sync_failed',
        { outboxId: row.id, attempts, error: String(error) },
        'error'
      );
    }
  }

  return { scanned: rows.length, sent, failed, hasMore: rows.length === limit };
}
