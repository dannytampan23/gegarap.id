import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ok, fail, handle } from '@/lib/api';
import { transitionPayment, InvalidTransitionError } from '@/lib/payment-state';
import { sendWAMessage } from '@/lib/whatsapp';
import { logEvent } from '@/lib/logger';

/**
 * POST /api/bookings/:id/start — the provider marks that work has begun. Moves
 * the payment PAID → HELD (escrow held while the job runs) and the job to
 * IN_PROGRESS. Provider-only.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { payment: true, provider: { select: { userId: true } }, customer: { select: { phone: true } } },
    });
    if (!job) return fail('Booking tidak ditemukan.', 404);
    if (job.provider.userId !== session.user.id) return fail('Akses ditolak.', 403);
    if (!job.payment || job.payment.status !== 'PAID') return fail('Pembayaran belum dikonfirmasi.', 400);
    if (job.status !== 'CONFIRMED') return fail('Pekerjaan tidak dalam status untuk dimulai.', 400);

    try {
      await transitionPayment({
        paymentId: job.payment.id,
        to: 'HELD',
        triggeredBy: session.user.id,
        reason: 'provider started work',
      });
    } catch (e) {
      if (e instanceof InvalidTransitionError) return fail('Status pembayaran tidak valid.', 409);
      throw e;
    }
    await prisma.job.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS' } });
    logEvent('payment.status_changed', { paymentId: job.payment.id, from: 'PAID', to: 'HELD' });

    if (job.customer.phone) {
      await sendWAMessage(
        job.customer.phone,
        `🔧 *Pekerjaan Dimulai*\n\nTukang telah mulai mengerjakan booking #${job.id.slice(-6).toUpperCase()}.\nDana Anda ditahan aman oleh sistem hingga pekerjaan selesai.`
      );
    }

    return ok({ jobStatus: 'IN_PROGRESS', paymentStatus: 'HELD' });
  })();
}
