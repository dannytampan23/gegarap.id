import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { evaluateRefund, DEFAULT_REFUND_POLICY } from '@/lib/refund-policy';
import { transitionPayment, InvalidTransitionError } from '@/lib/payment-state';
import { recordAudit, AuditAction } from '@/lib/audit';
import { executeRefund } from '@/lib/refund-execution';
import { logEvent } from '@/lib/logger';

const refundSchema = z.object({
  reason: z.string().trim().min(5, 'Jelaskan alasan pembatalan (min. 5 karakter)').max(500),
  evidenceUrls: z.array(z.string().url()).max(5).optional(),
});

/** States from which a refund/dispute flow can still act. */
const REFUNDABLE = ['PAID', 'HELD'];

/**
 * POST /api/bookings/:id/refund — customer requests a cancellation/refund. The
 * outcome is decided by the refund matrix (lib/refund-policy), NOT ad-hoc here:
 * auto-refund, dispute (admin review), or reject. All state changes go through
 * the backend state machine and are audit-logged.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.id) return fail('Harus login.', 401);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = refundSchema.parse(body);

    const job = await prisma.job.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!job || job.customerId !== session.user.id) return fail('Booking tidak ditemukan.', 404);
    if (!job.payment) return fail('Tidak ada pembayaran untuk booking ini.', 400);
    const payment = job.payment;

    if (['REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'].includes(payment.status)) {
      return fail('Pembatalan untuk pembayaran ini sedang/sudah diproses.', 409);
    }

    // Abuse counter: this account's refund requests within the window (Bagian 7).
    const windowStart = new Date(
      Date.now() - DEFAULT_REFUND_POLICY.refundAbuseWindowDays * 86_400_000
    );
    const recentRefundCount = await prisma.refundRequest.count({
      where: { requestedById: session.user.id, createdAt: { gte: windowStart } },
    });

    const decision = evaluateRefund({
      jobStatus: job.status,
      paymentStatus: payment.status,
      paidAmount: payment.amount,
      completedAt: job.status === 'COMPLETED' ? job.updatedAt : null,
      recentRefundCount,
    });

    logEvent('refund.requested', {
      jobId: job.id,
      paymentId: payment.id,
      scenario: decision.scenario,
      outcome: decision.outcome,
    });

    // NO_PAYMENT: nothing captured. Cancel the booking if still pending.
    if (decision.outcome === 'NOOP') {
      if (payment.status === 'PENDING' || payment.status === 'DRAFT') {
        try {
          await transitionPayment({
            paymentId: payment.id,
            to: 'EXPIRED',
            triggeredBy: session.user.id,
            reason: `customer cancel: ${input.reason}`,
          });
          await prisma.job.update({ where: { id: job.id }, data: { status: 'CANCELLED' } });
        } catch (e) {
          if (!(e instanceof InvalidTransitionError)) throw e;
        }
      }
      return ok({
        scenario: decision.scenario,
        outcome: 'CANCELLED',
        refundAmount: 0,
        message: decision.reason,
      });
    }

    // Record the request (also feeds the abuse counter) before acting.
    const status = decision.outcome === 'REJECT' ? 'REJECTED' : 'PENDING_REVIEW';
    const refundRequest = await prisma.refundRequest.create({
      data: {
        paymentId: payment.id,
        requestedById: session.user.id,
        reason: input.reason,
        evidenceUrls: input.evidenceUrls ?? [],
        type: decision.refundType,
        amount: decision.refundAmount,
        status,
      },
    });

    // Flag (never auto-block) repeat refunders.
    if (decision.flagAbuse) {
      await prisma.fraudFlag.create({
        data: {
          userId: session.user.id,
          type: 'REFUND_ABUSE',
          severity: 'MEDIUM',
          note: `Pengajuan refund ke-${recentRefundCount + 1} dalam ${DEFAULT_REFUND_POLICY.refundAbuseWindowDays} hari`,
        },
      });
    }

    if (decision.outcome === 'REJECT') {
      return ok({
        scenario: decision.scenario,
        outcome: 'REJECTED',
        refundAmount: 0,
        message: decision.reason,
      });
    }

    // Both remaining outcomes require an active (PAID/HELD) payment.
    if (!REFUNDABLE.includes(payment.status)) {
      await prisma.refundRequest.update({
        where: { id: refundRequest.id },
        data: { status: 'REJECTED' },
      });
      return fail('Status pembayaran tidak memungkinkan refund.', 409);
    }

    try {
      if (decision.outcome === 'AUTO_REFUND') {
        const gateway = await executeRefund({
          refundRequestId: refundRequest.id,
          paymentId: payment.id,
          jobId: job.id,
          orderId: payment.midtransOrderId,
          amount: decision.refundAmount,
          reason: `auto-refund ${decision.scenario}: ${input.reason}`,
          triggeredBy: session.user.id,
        });
        if (!gateway.success) {
          return fail(
            'Refund tercatat tetapi gateway belum mengonfirmasi pengembalian dana. Tim kami akan menindaklanjuti.',
            502
          );
        }
        logEvent('refund.resolved', {
          paymentId: payment.id,
          outcome: 'REFUNDED',
          refundAmount: decision.refundAmount,
        });
        await recordAudit({
          actorId: session.user.id,
          action: AuditAction.RefundTriggered,
          targetType: 'Payment',
          targetId: payment.id,
          metadata: {
            auto: true,
            scenario: decision.scenario,
            refundAmount: decision.refundAmount,
          },
        });
        return ok({
          scenario: decision.scenario,
          outcome: 'REFUNDED',
          refundAmount: decision.refundAmount,
          message: decision.reason,
        });
      }

      // DISPUTE
      await transitionPayment({
        paymentId: payment.id,
        to: 'DISPUTED',
        triggeredBy: session.user.id,
        reason: input.reason,
      });
      return ok({
        scenario: decision.scenario,
        outcome: 'DISPUTED',
        refundAmount: 0,
        message: decision.reason,
      });
    } catch (e) {
      if (e instanceof InvalidTransitionError) {
        await prisma.refundRequest.update({
          where: { id: refundRequest.id },
          data: { status: 'REJECTED' },
        });
        return fail('Status pembayaran tidak memungkinkan refund saat ini.', 409);
      }
      throw e;
    }
  })();
}
