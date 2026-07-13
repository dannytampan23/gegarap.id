import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { InvalidTransitionError, type PaymentStatus } from '@/lib/payment-state';
import { releaseAndSettle } from '@/lib/payout';
import { recordAudit, AuditAction } from '@/lib/audit';
import { executeRefund, RefundAmountLockedError } from '@/lib/refund-execution';
import { logEvent } from '@/lib/logger';

const forceSchema = z.object({
  action: z.enum(['REFUND', 'RELEASE']),
  reason: z.string().trim().min(5, 'Alasan wajib diisi (min. 5 karakter)').max(500),
});

/**
 * POST /api/admin/payments/:id/force — admin force-refund or force-release with
 * a MANDATORY reason (Bagian 12.6). Every action is audit-logged and goes through
 * the state machine, so it's reconstructable from PaymentEvent + AuditLog.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = forceSchema.parse(body);

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return fail('Pembayaran tidak ditemukan.', 404);
    const current = payment.status as PaymentStatus;

    try {
      if (input.action === 'RELEASE') {
        await releaseAndSettle(payment.id, admin.id, `force-release: ${input.reason}`);
        await recordAudit({
          actorId: admin.id,
          action: 'FORCE_RELEASE',
          targetType: 'Payment',
          targetId: payment.id,
          metadata: { reason: input.reason, from: current },
        });
        logEvent('payment.status_changed', {
          paymentId: payment.id,
          to: 'RELEASED',
          by: admin.id,
          forced: true,
        });
        return ok({ paymentId: payment.id, action: 'RELEASE', status: 'RELEASED' });
      }

      let refundRequest = await prisma.refundRequest.findFirst({
        where: { paymentId: payment.id, status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'desc' },
      });
      if (!refundRequest) {
        refundRequest = await prisma.refundRequest.create({
          data: {
            paymentId: payment.id,
            requestedById: admin.id,
            reason: `[FORCE] ${input.reason}`,
            type: 'FULL',
            amount: payment.amount,
            status: 'PENDING_REVIEW',
          },
        });
      }
      const gateway = await executeRefund({
        refundRequestId: refundRequest.id,
        paymentId: payment.id,
        jobId: payment.jobId,
        orderId: payment.midtransOrderId,
        amount: payment.amount,
        reason: `force-refund: ${input.reason}`,
        triggeredBy: admin.id,
        resolvedById: admin.id,
      });
      if (!gateway.success) {
        return fail(
          'Gateway belum mengonfirmasi refund. Permintaan tetap menunggu tindak lanjut.',
          502
        );
      }
      await recordAudit({
        actorId: admin.id,
        action: AuditAction.RefundTriggered,
        targetType: 'Payment',
        targetId: payment.id,
        metadata: {
          reason: input.reason,
          from: current,
          forced: true,
          refundAmount: payment.amount,
        },
      });
      logEvent('refund.resolved', {
        paymentId: payment.id,
        to: 'REFUNDED',
        by: admin.id,
        forced: true,
      });
      return ok({ paymentId: payment.id, action: 'REFUND', status: 'REFUNDED' });
    } catch (e) {
      if (e instanceof RefundAmountLockedError) {
        return fail('Nominal refund sudah dikunci oleh percobaan gateway sebelumnya.', 409);
      }
      if (e instanceof InvalidTransitionError) {
        return fail(
          `Status pembayaran (${current}) tidak bisa di-${input.action.toLowerCase()} paksa.`,
          409
        );
      }
      throw e;
    }
  })();
}
