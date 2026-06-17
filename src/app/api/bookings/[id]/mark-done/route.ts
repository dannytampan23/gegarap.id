import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ok, fail, handle } from '@/lib/api';
import { AUTO_RELEASE_HOURS } from '@/lib/payout';
import { sendWAMessage } from '@/lib/whatsapp';

/**
 * POST /api/bookings/:id/mark-done — the provider reports the job finished. The
 * job moves to AWAITING_CONFIRMATION (payment stays HELD); this starts the 72h
 * auto-release clock (Bagian 3) — if the customer never confirms, the cron
 * releases funds so the provider isn't left unpaid by an absent customer.
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
    if (job.status !== 'IN_PROGRESS') return fail('Pekerjaan belum dalam pengerjaan.', 400);
    if (!job.payment || job.payment.status !== 'HELD') return fail('Status pembayaran tidak valid.', 400);

    await prisma.job.update({ where: { id: job.id }, data: { status: 'AWAITING_CONFIRMATION' } });

    if (job.customer.phone) {
      await sendWAMessage(
        job.customer.phone,
        `📷 *Pekerjaan Selesai — Mohon Konfirmasi*\n\nTukang menandai booking #${job.id.slice(-6).toUpperCase()} selesai.\n` +
          `Silakan periksa dan konfirmasi di aplikasi. Bila tidak ada konfirmasi/komplain dalam ${AUTO_RELEASE_HOURS} jam, dana otomatis dicairkan ke tukang.`
      );
    }

    return ok({ jobStatus: 'AWAITING_CONFIRMATION' });
  })();
}
