import prisma from './prisma';
import { applyTransition, InvalidTransitionError, type PaymentStatus } from './payment-state';
import { getDisbursementProvider } from './disbursement';
import { recordAudit, AuditAction } from './audit';
import { logEvent, notifyOps } from './logger';

/** Below this accumulated amount, payout is held & batched (Bagian 6). */
export const MIN_PAYOUT = 10_000; // Rp 10.000

/** Auto-release window after the provider marks a job done (Bagian 3). */
export const AUTO_RELEASE_HOURS = 72;

export interface SettleResult {
  payoutId: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  reason?: string;
}

/** Provider may receive money now only with passed KYC + payout details (Bagian 6). */
export function isPayoutEligible(provider: {
  kycStatus: string;
  payoutMethod: string | null;
  payoutDetails: unknown;
}): boolean {
  return (
    provider.kycStatus === 'APPROVED' && !!provider.payoutMethod && provider.payoutDetails != null
  );
}

/**
 * Create (if absent) and try to execute the provider payout for a RELEASED
 * payment. KYC gate: an unverified provider, missing payout details, or an
 * amount below MIN_PAYOUT leaves the Payout SCHEDULED — funds are held, never
 * lost, and the provider is nudged to finish KYC.
 */
export async function settleProviderPayout(paymentId: string): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      providerProfileId: true,
      providerAmount: true,
      platformFee: true,
      midtransOrderId: true,
      provider: {
        select: {
          kycStatus: true,
          payoutMethod: true,
          payoutDetails: true,
          user: { select: { phone: true } },
        },
      },
    },
  });
  if (!payment) throw new Error(`Payment not found: ${paymentId}`);
  if (!payment.providerProfileId || !payment.provider) {
    throw new Error(`Payment ${paymentId} has no provider to pay`);
  }

  const amount = payment.providerAmount;

  // Reuse a live payout if one exists, else create it.
  let payout = await prisma.payout.findFirst({
    where: { paymentId, status: { in: ['SCHEDULED', 'PROCESSING', 'SUCCESS'] } },
  });
  if (!payout) {
    payout = await prisma.payout.create({
      data: {
        paymentId,
        providerProfileId: payment.providerProfileId,
        amount,
        status: 'SCHEDULED',
      },
    });
  }
  if (payout.status === 'SUCCESS') return { payoutId: payout.id, status: 'SUCCESS' };

  // KYC gate.
  if (!isPayoutEligible(payment.provider)) {
    logEvent(
      'disbursement.failed',
      { payoutId: payout.id, paymentId, reason: 'kyc_or_payout_details_missing' },
      'warn'
    );
    return { payoutId: payout.id, status: 'SCHEDULED', reason: 'kyc_pending' };
  }

  // Minimum-threshold batching.
  if (amount < MIN_PAYOUT) {
    return { payoutId: payout.id, status: 'SCHEDULED', reason: 'below_min_threshold' };
  }

  // Execute via the (mockable) disbursement provider.
  await prisma.payout.update({ where: { id: payout.id }, data: { status: 'PROCESSING' } });
  const result = await getDisbursementProvider().disburse({
    payoutId: payout.id,
    amount,
    recipient: {
      method: payment.provider.payoutMethod ?? 'unknown',
      details: (payment.provider.payoutDetails as Record<string, unknown>) ?? {},
    },
    reference: payment.midtransOrderId ?? payment.id,
  });

  if (!result.success) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'FAILED', failureReason: result.failureReason ?? 'unknown' },
    });
    logEvent(
      'disbursement.failed',
      { payoutId: payout.id, paymentId, reason: result.failureReason },
      'error'
    );
    // Page ops if this provider's disbursements fail repeatedly (Bagian 10).
    const recentFailures = await prisma.payout.count({
      where: { providerProfileId: payment.providerProfileId, status: 'FAILED' },
    });
    if (recentFailures > 1) {
      await notifyOps('DISBURSEMENT_REPEATED_FAILURE', {
        providerProfileId: payment.providerProfileId,
        failures: recentFailures,
        paymentId,
        reason: result.failureReason,
      });
    }
    return { payoutId: payout.id, status: 'FAILED', reason: result.failureReason };
  }

  await prisma.$transaction([
    prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'SUCCESS',
        disbursementExternalId: result.externalId ?? null,
        executedAt: new Date(),
      },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        disbursedAt: new Date(),
        disbursedAmount: amount,
        platformFeeCharged: payment.platformFee,
      },
    }),
  ]);
  logEvent('disbursement.executed', { payoutId: payout.id, paymentId, amount });
  await recordAudit({
    actorId: null,
    action: AuditAction.PayoutDisbursed,
    targetType: 'Payout',
    targetId: payout.id,
    metadata: { paymentId, amount, provider: getDisbursementProvider().name },
  });
  return { payoutId: payout.id, status: 'SUCCESS' };
}

/**
 * Move a payment to RELEASED (stepping PAID→HELD→RELEASED as needed) and settle
 * the provider payout. Used by job completion, the 72h auto-release cron, and
 * an admin siding with the provider on a dispute.
 */
export async function releaseAndSettle(
  paymentId: string,
  triggeredBy: string,
  reason: string
): Promise<SettleResult> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error(`Payment not found: ${paymentId}`);
    const status = payment.status as PaymentStatus;

    if (status === 'PAID') {
      await applyTransition(tx, { paymentId, to: 'HELD', triggeredBy, reason });
      await applyTransition(tx, { paymentId, to: 'RELEASED', triggeredBy, reason });
    } else if (status === 'HELD' || status === 'DISPUTED' || status === 'REFUND_REJECTED') {
      await applyTransition(tx, { paymentId, to: 'RELEASED', triggeredBy, reason });
    } else if (status !== 'RELEASED') {
      throw new InvalidTransitionError(status, 'RELEASED');
    }

    await tx.job.update({ where: { id: payment.jobId }, data: { status: 'COMPLETED' } });
  });

  logEvent('payment.status_changed', { paymentId, to: 'RELEASED', triggeredBy });
  const settle = await settleProviderPayout(paymentId);
  return settle;
}
