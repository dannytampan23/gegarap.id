import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';

/**
 * POST /api/bookings/:id/mark-done — the provider reports the job finished. The
 * job moves to AWAITING_CONFIRMATION (payment stays HELD); this starts the 72h
 * auto-release clock (Bagian 3) — if the customer never confirms, the cron
 * releases funds so the provider isn't left unpaid by an absent customer.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const job = await prisma.job.findUnique({
      where: { id },
      include: { payment: true, provider: { select: { userId: true } }, customer: { select: { phone: true } } },
    });
    if (!job) return fail('Booking tidak ditemukan.', 404);
    if (job.provider.userId !== session.user.id) return fail('Akses ditolak.', 403);
    if (job.status !== 'IN_PROGRESS') return fail('Pekerjaan belum dalam pengerjaan.', 400);
    if (!job.payment || job.payment.status !== 'HELD') return fail('Status pembayaran tidak valid.', 400);

    await prisma.job.update({ where: { id: job.id }, data: { status: 'AWAITING_CONFIRMATION' } });

    return ok({ jobStatus: 'AWAITING_CONFIRMATION' });
  })();
}
