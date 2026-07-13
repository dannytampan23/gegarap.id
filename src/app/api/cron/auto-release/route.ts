import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { releaseAndSettle, AUTO_RELEASE_HOURS } from '@/lib/payout';
import { logEvent } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Auto-release safety net (Bagian 3): when a provider has marked a job done and
 * the customer hasn't confirmed or complained within 72h, release the escrow so
 * the provider isn't held hostage by an absent customer. Operates on HELD
 * payments whose job is AWAITING_CONFIRMATION and untouched past the window.
 */
export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) return NextResponse.json({ ok: false }, { status: 401 });

  const cutoff = new Date(Date.now() - AUTO_RELEASE_HOURS * 3_600_000);
  const candidates = await prisma.payment.findMany({
    where: {
      status: 'HELD',
      job: { status: 'AWAITING_CONFIRMATION', updatedAt: { lt: cutoff } },
    },
    select: { id: true, jobId: true },
    orderBy: { updatedAt: 'asc' },
    take: 25,
  });

  let released = 0;
  for (const p of candidates) {
    try {
      await releaseAndSettle(
        p.id,
        'SYSTEM',
        `auto-release: customer tidak merespons ${AUTO_RELEASE_HOURS} jam`
      );
      released++;
    } catch (e) {
      logEvent('autorelease.run', { paymentId: p.id, error: String(e) }, 'warn');
    }
  }

  logEvent('autorelease.run', { scanned: candidates.length, released });
  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    released,
    hasMore: candidates.length === 25,
  });
}
