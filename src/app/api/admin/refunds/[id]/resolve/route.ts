import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { transitionPayment, InvalidTransitionError, type PaymentStatus } from '@/lib/payment-state';
import { releaseAndSettle } from '@/lib/payout';
import { recordAudit, AuditAction } from '@/lib/audit';
import { executeRefund, RefundAmountLockedError } from '@/lib/refund-execution';
import { logEvent } from '@/lib/logger';

const resolveSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().min(5, 'Alasan wajib diisi (min. 5 karakter)').max(500),
  /** Optional admin override of the refunded amount (defaults to the request). */
  refundAmount: z.number().int().nonnegative().optional(),
});

/**
 * POST /api/admin/refunds/:id/resolve — admin decides a dispute / refund review.
 * Reason is mandatory (audit trail). APPROVE → REFUNDED; REJECT → funds RELEASED
 * to the provider (dispute) or REFUND_REJECTED (refund review). Every action is
 * audit-logged with the admin's id.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);
    const adminId = admin.id;

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = resolveSchema.parse(body);

    const rr = await prisma.refundRequest.findUnique({
      where: { id },
      include: {
        payment: {
          include: { job: { include: { customer: true, provider: { include: { user: true } } } } },
        },
      },
    });
    if (!rr) return fail('Permintaan refund tidak ditemukan.', 404);
    if (rr.status !== 'PENDING_REVIEW') return fail('Permintaan ini sudah diselesaikan.', 409);

    const payment = rr.payment;
    const job = payment.job;
    const current = payment.status as PaymentStatus;

    try {
      if (input.decision === 'APPROVE') {
        const refundAmount = input.refundAmount ?? rr.amount ?? payment.amount;
        const gateway = await executeRefund({
          refundRequestId: rr.id,
          paymentId: payment.id,
          jobId: job.id,
          orderId: payment.midtransOrderId,
          amount: refundAmount,
          reason: `admin approve: ${input.reason}`,
          triggeredBy: adminId,
          resolvedById: adminId,
        });
        if (!gateway.success) {
          return fail(
            'Gateway belum mengonfirmasi refund. Permintaan tetap menunggu tindak lanjut.',
            502
          );
        }
        logEvent('refund.resolved', {
          paymentId: payment.id,
          by: admin.id,
          outcome: 'REFUNDED',
          refundAmount,
        });
        await recordAudit({
          actorId: admin.id,
          action: AuditAction.RefundTriggered,
          targetType: 'Payment',
          targetId: payment.id,
          metadata: { refundRequestId: rr.id, refundAmount, reason: input.reason },
        });
        return ok({ refundRequestId: rr.id, outcome: 'REFUNDED', refundAmount });
      }

      // REJECT — side with the provider.
      const to: PaymentStatus = current === 'DISPUTED' ? 'RELEASED' : 'REFUND_REJECTED';
      if (to === 'RELEASED') {
        // Release escrow + settle the provider payout. Suppress the generic
        // RELEASED notice — we send a tailored dispute-ruling message below.
        await releaseAndSettle(
          payment.id,
          adminId,
          `admin reject refund (sided with provider): ${input.reason}`
        );
      } else {
        await transitionPayment({
          paymentId: payment.id,
          to,
          triggeredBy: adminId,
          reason: `admin reject refund: ${input.reason}`,
        });
      }
      await prisma.$transaction([
        prisma.refundRequest.update({
          where: { id: rr.id },
          data: {
            status: 'REJECTED',
            resolvedById: admin.id,
            resolvedAt: new Date(),
            resolutionNote: input.reason,
          },
        }),
      ]);

      logEvent('refund.resolved', { paymentId: payment.id, by: admin.id, outcome: to });
      await recordAudit({
        actorId: admin.id,
        action: 'REFUND_REJECTED',
        targetType: 'Payment',
        targetId: payment.id,
        metadata: { refundRequestId: rr.id, to, reason: input.reason },
      });
      return ok({ refundRequestId: rr.id, outcome: to });
    } catch (e) {
      if (e instanceof RefundAmountLockedError) {
        return fail('Nominal refund sudah dikunci oleh percobaan gateway sebelumnya.', 409);
      }
      if (e instanceof InvalidTransitionError) {
        return fail(`Status pembayaran (${current}) tidak bisa diresolusi dengan aksi ini.`, 409);
      }
      throw e;
    }
  })();
}
