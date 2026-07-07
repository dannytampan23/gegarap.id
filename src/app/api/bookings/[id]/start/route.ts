import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { transitionPayment, InvalidTransitionError } from '@/lib/payment-state';
import { assertProviderOwnsJob } from '@/lib/authz';
import { logEvent } from '@/lib/logger';

/**
 * POST /api/bookings/:id/start — the provider marks that work has begun. Moves
 * the payment PAID → HELD (escrow held while the job runs) and the job to
 * IN_PROGRESS. Provider-only.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const job = await prisma.job.findUnique({
      where: { id },
      include: { payment: true, provider: { select: { userId: true } } },
    });
    if (!job) return fail('Booking tidak ditemukan.', 404);
    // Ownership policy (service-layer second line): provider may only start their
    // own assigned job. Throws ForbiddenError → 403 via handle().
    assertProviderOwnsJob({ customerId: job.customerId, providerUserId: job.provider.userId }, session.user.id);
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

    return ok({ jobStatus: 'IN_PROGRESS', paymentStatus: 'HELD' });
  })();
}
