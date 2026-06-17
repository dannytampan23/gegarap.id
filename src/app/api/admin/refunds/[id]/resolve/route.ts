import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { transitionPayment, InvalidTransitionError, type PaymentStatus } from '@/lib/payment-state';
import { releaseAndSettle } from '@/lib/payout';
import { recordAudit, AuditAction } from '@/lib/audit';
import { sendWAMessage } from '@/lib/whatsapp';
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
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);
    const adminId = admin.id;

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = resolveSchema.parse(body);

    const rr = await prisma.refundRequest.findUnique({
      where: { id: params.id },
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

    /** Move PAID/HELD/REFUND_REQUESTED/DISPUTED → a resolved state. */
    async function moveTo(to: PaymentStatus, reason: string) {
      // From an active payment, pass through REFUND_REQUESTED for a clean trail.
      if (to === 'REFUNDED' && (current === 'PAID' || current === 'HELD')) {
        await transitionPayment({ paymentId: payment.id, to: 'REFUND_REQUESTED', triggeredBy: adminId, reason });
      }
      await transitionPayment({ paymentId: payment.id, to, triggeredBy: adminId, reason });
    }

    const notify = async (phone: string | null | undefined, msg: string) => {
      if (phone) await sendWAMessage(phone, msg);
    };

    try {
      if (input.decision === 'APPROVE') {
        const refundAmount = input.refundAmount ?? rr.amount ?? payment.amount;
        await moveTo('REFUNDED', `admin approve refund: ${input.reason}`);
        await prisma.$transaction([
          prisma.refundRequest.update({
            where: { id: rr.id },
            data: {
              status: 'APPROVED',
              amount: refundAmount,
              resolvedById: admin.id,
              resolvedAt: new Date(),
              resolutionNote: input.reason,
            },
          }),
          prisma.job.update({ where: { id: job.id }, data: { status: 'CANCELLED' } }),
        ]);

        // TODO(Phase 7): call the gateway refund API to return the money.
        logEvent('refund.resolved', { paymentId: payment.id, by: admin.id, outcome: 'REFUNDED', refundAmount });
        await recordAudit({
          actorId: admin.id,
          action: AuditAction.RefundTriggered,
          targetType: 'Payment',
          targetId: payment.id,
          metadata: { refundRequestId: rr.id, refundAmount, reason: input.reason },
        });
        await notify(
          job.customer.phone,
          `✅ *Refund Disetujui*\n\nRp ${refundAmount.toLocaleString('id-ID')} akan dikembalikan ke metode pembayaran Anda dalam beberapa hari kerja.`
        );
        await notify(
          job.provider.user.phone,
          `ℹ️ *Hasil Peninjauan*\n\nBooking #${job.id.slice(-6).toUpperCase()}: tim memutuskan refund ke customer.\nAlasan: ${input.reason}`
        );
        return ok({ refundRequestId: rr.id, outcome: 'REFUNDED', refundAmount });
      }

      // REJECT — side with the provider.
      const to: PaymentStatus = current === 'DISPUTED' ? 'RELEASED' : 'REFUND_REJECTED';
      if (to === 'RELEASED') {
        // Release escrow + settle the provider payout.
        await releaseAndSettle(payment.id, adminId, `admin reject refund (sided with provider): ${input.reason}`);
      } else {
        await transitionPayment({ paymentId: payment.id, to, triggeredBy: adminId, reason: `admin reject refund: ${input.reason}` });
      }
      await prisma.$transaction([
        prisma.refundRequest.update({
          where: { id: rr.id },
          data: { status: 'REJECTED', resolvedById: admin.id, resolvedAt: new Date(), resolutionNote: input.reason },
        }),
        ...(to === 'RELEASED'
          ? [prisma.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } })]
          : []),
      ]);

      logEvent('refund.resolved', { paymentId: payment.id, by: admin.id, outcome: to });
      await recordAudit({
        actorId: admin.id,
        action: 'REFUND_REJECTED',
        targetType: 'Payment',
        targetId: payment.id,
        metadata: { refundRequestId: rr.id, to, reason: input.reason },
      });
      await notify(
        job.customer.phone,
        `ℹ️ *Hasil Peninjauan Pembatalan*\n\nPengajuan refund Anda untuk booking #${job.id.slice(-6).toUpperCase()} tidak disetujui.\nAlasan: ${input.reason}`
      );
      await notify(
        job.provider.user.phone,
        `✅ *Hasil Peninjauan*\n\nBooking #${job.id.slice(-6).toUpperCase()}: komplain tidak terbukti, pekerjaan dilanjutkan/diselesaikan.`
      );
      return ok({ refundRequestId: rr.id, outcome: to });
    } catch (e) {
      if (e instanceof InvalidTransitionError) {
        return fail(`Status pembayaran (${current}) tidak bisa diresolusi dengan aksi ini.`, 409);
      }
      throw e;
    }
  })();
}
