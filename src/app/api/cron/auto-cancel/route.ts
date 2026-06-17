import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { applyTransition } from '@/lib/payment-state';
import { logEvent } from '@/lib/logger';

/** Don't let a stale build cache a response; always run fresh. */
export const dynamic = 'force-dynamic';

const EXPIRE_AFTER_MS = 60 * 60 * 1000; // 60 menit (Bagian 3)

/**
 * Auto-cancel (Bagian 3): a Payment stuck in PENDING for > 60 minutes is moved
 * to EXPIRED and its booking is released. Runs frequently; only acts on rows
 * past the cutoff, so it's safe to call often.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const cutoff = new Date(Date.now() - EXPIRE_AFTER_MS);
  const stale = await prisma.payment.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, jobId: true },
  });

  let expired = 0;
  for (const p of stale) {
    try {
      const res = await prisma.$transaction((tx) =>
        applyTransition(tx, {
          paymentId: p.id,
          to: 'EXPIRED',
          triggeredBy: 'SYSTEM',
          reason: 'auto-cancel: PENDING > 60m',
        })
      );
      if (res.changed) {
        await prisma.job.update({ where: { id: p.jobId }, data: { status: 'CANCELLED' } });
        expired++;
      }
    } catch (e) {
      // Concurrent webhook may have just moved it; log and continue.
      logEvent('autocancel.run', { paymentId: p.id, error: String(e) }, 'warn');
    }
  }

  logEvent('autocancel.run', { scanned: stale.length, expired });
  return NextResponse.json({ ok: true, scanned: stale.length, expired });
}
