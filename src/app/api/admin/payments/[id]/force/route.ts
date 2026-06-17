import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { transitionPayment, InvalidTransitionError, type PaymentStatus } from '@/lib/payment-state';
import { releaseAndSettle } from '@/lib/payout';
import { recordAudit, AuditAction } from '@/lib/audit';
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
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = forceSchema.parse(body);

    const payment = await prisma.payment.findUnique({ where: { id: params.id } });
    if (!payment) return fail('Pembayaran tidak ditemukan.', 404);
    const current = payment.status as PaymentStatus;

    try {
      if (input.action === 'RELEASE') {
        await releaseAndSettle(payment.id, admin.id, `force-release: ${input.reason}`);
        await prisma.job.update({ where: { id: payment.jobId }, data: { status: 'COMPLETED' } });
        await recordAudit({
          actorId: admin.id,
          action: 'FORCE_RELEASE',
          targetType: 'Payment',
          targetId: payment.id,
          metadata: { reason: input.reason, from: current },
        });
        logEvent('payment.status_changed', { paymentId: payment.id, to: 'RELEASED', by: admin.id, forced: true });
        return ok({ paymentId: payment.id, action: 'RELEASE', status: 'RELEASED' });
      }

      // REFUND: step PAID/HELD → REFUND_REQUESTED → REFUNDED; DISPUTED → REFUNDED.
      if (current === 'PAID' || current === 'HELD') {
        await transitionPayment({ paymentId: payment.id, to: 'REFUND_REQUESTED', triggeredBy: admin.id, reason: input.reason });
      }
      await transitionPayment({ paymentId: payment.id, to: 'REFUNDED', triggeredBy: admin.id, reason: `force-refund: ${input.reason}` });
      await prisma.$transaction([
        prisma.job.update({ where: { id: payment.jobId }, data: { status: 'CANCELLED' } }),
        prisma.refundRequest.create({
          data: {
            paymentId: payment.id,
            requestedById: admin.id,
            reason: `[FORCE] ${input.reason}`,
            type: 'FULL',
            amount: payment.amount,
            status: 'APPROVED',
            resolvedById: admin.id,
            resolvedAt: new Date(),
            resolutionNote: 'force-refund oleh admin',
          },
        }),
      ]);
      // TODO(Phase 7+): gateway refund API call.
      await recordAudit({
        actorId: admin.id,
        action: AuditAction.RefundTriggered,
        targetType: 'Payment',
        targetId: payment.id,
        metadata: { reason: input.reason, from: current, forced: true, refundAmount: payment.amount },
      });
      logEvent('refund.resolved', { paymentId: payment.id, to: 'REFUNDED', by: admin.id, forced: true });
      return ok({ paymentId: payment.id, action: 'REFUND', status: 'REFUNDED' });
    } catch (e) {
      if (e instanceof InvalidTransitionError) {
        return fail(`Status pembayaran (${current}) tidak bisa di-${input.action.toLowerCase()} paksa.`, 409);
      }
      throw e;
    }
  })();
}
