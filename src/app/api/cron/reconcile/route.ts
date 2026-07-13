import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthorizedCron } from '@/lib/cron-auth';
import {
  applyTransitionWithJob,
  InvalidTransitionError,
  ConcurrentTransitionError,
} from '@/lib/payment-state';
import { getTransactionStatus, isMidtransConfigured } from '@/lib/midtrans';
import { logEvent, logAlert } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RECONCILE_OLDER_THAN_MS = 10 * 60 * 1000; // 10 menit (Bagian 5.4)

/**
 * Reconciliation (Bagian 5.4): for PENDING payments older than 10 minutes, ask
 * the gateway directly instead of trusting that the webhook arrived. This
 * self-heals when a webhook is dropped. The state transitions are idempotent and
 * guarded, so this never fights a webhook that already landed.
 */
export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isMidtransConfigured) {
    return NextResponse.json({ ok: true, skipped: 'midtrans not configured' });
  }

  const cutoff = new Date(Date.now() - RECONCILE_OLDER_THAN_MS);
  const pending = await prisma.payment.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff }, midtransOrderId: { not: null } },
    select: { id: true, jobId: true, midtransOrderId: true, amount: true },
    orderBy: { createdAt: 'asc' },
    take: 25,
  });

  let healed = 0;
  for (const p of pending) {
    try {
      const status = await getTransactionStatus(p.midtransOrderId!);
      const ts = String(status.transaction_status ?? '');
      const fraud = String(status.fraud_status ?? '');
      const gross = Number(status.gross_amount);

      // Financial mismatch alarm (Bagian 10) — never auto-process.
      if (Number.isFinite(gross) && Math.round(gross) !== p.amount) {
        logAlert('PAYMENT_AMOUNT_MISMATCH', {
          source: 'reconcile',
          paymentId: p.id,
          dbAmount: p.amount,
          gatewayAmount: gross,
        });
        continue;
      }

      const isSuccess = (ts === 'capture' && fraud === 'accept') || ts === 'settlement';
      const isFailure = ts === 'cancel' || ts === 'expire' || ts === 'deny';

      if (isSuccess) {
        const res = await prisma.$transaction((tx) =>
          applyTransitionWithJob(tx, {
            paymentId: p.id,
            to: 'PAID',
            triggeredBy: 'SYSTEM',
            reason: `reconcile:${ts}`,
            expectedFrom: 'PENDING',
            data: {
              paidAt: new Date(),
              midtransPaymentType: (status.payment_type as string | undefined) ?? null,
            },
            jobStatus: 'CONFIRMED',
          })
        );
        if (res.changed) {
          healed++;
          logEvent('reconciliation.healed', { paymentId: p.id, to: 'PAID' });
        }
      } else if (isFailure) {
        const res = await prisma.$transaction((tx) =>
          applyTransitionWithJob(tx, {
            paymentId: p.id,
            to: 'FAILED',
            triggeredBy: 'SYSTEM',
            reason: `reconcile:${ts}`,
            expectedFrom: 'PENDING',
            jobStatus: 'CANCELLED',
          })
        );
        if (res.changed) {
          healed++;
          logEvent('reconciliation.healed', { paymentId: p.id, to: 'FAILED' });
        }
      }
    } catch (e) {
      if (e instanceof InvalidTransitionError || e instanceof ConcurrentTransitionError) {
        // A webhook already moved it past PENDING — fine, nothing to heal.
        continue;
      }
      // 404 = order never created at gateway (mock/dev), or a transient gateway
      // error. Log and move on; the next run retries.
      logEvent('reconciliation.run', { paymentId: p.id, error: String(e) }, 'warn');
    }
  }

  logEvent('reconciliation.run', { scanned: pending.length, healed });
  return NextResponse.json({
    ok: true,
    scanned: pending.length,
    healed,
    hasMore: pending.length === 25,
  });
}
