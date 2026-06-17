import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ok, fail, handle } from '@/lib/api';
import { releaseAndSettle } from '@/lib/payout';
import { InvalidTransitionError } from '@/lib/payment-state';
import { sendWAMessage } from '@/lib/whatsapp';

const completeSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** Job states from which the customer may confirm completion. */
const COMPLETABLE_JOB = ['CONFIRMED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const { rating, comment } = completeSchema.parse(body);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { payment: true, provider: { include: { user: true } }, customer: true },
    });

    // Only the booking's owner may complete it.
    if (!job || job.customerId !== session.user.id) return fail('Booking tidak ditemukan.', 404);
    if (!COMPLETABLE_JOB.includes(job.status)) {
      return fail('Status booking tidak valid untuk diselesaikan.', 400);
    }
    if (!job.payment || !['PAID', 'HELD'].includes(job.payment.status)) {
      return fail('Pembayaran belum terkonfirmasi.', 400);
    }

    // Release escrow + settle the provider payout (KYC-gated, mockable).
    let settle;
    try {
      settle = await releaseAndSettle(
        job.payment.id,
        session.user.id,
        'customer confirmed completion'
      );
    } catch (e) {
      if (e instanceof InvalidTransitionError) {
        return fail('Pembayaran tidak dapat dicairkan dari status saat ini.', 409);
      }
      throw e;
    }

    // Mark the job done, save the review, and recompute the provider rating.
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
      await tx.review.create({
        data: {
          jobId: job.id,
          userId: session.user.id,
          providerProfileId: job.providerProfileId,
          rating,
          comment: comment || null,
        },
      });
      const reviews = await tx.review.findMany({
        where: { providerProfileId: job.providerProfileId },
        select: { rating: true },
      });
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await tx.providerProfile.update({
        where: { id: job.providerProfileId },
        data: {
          rating: Math.round(avg * 10) / 10,
          ratingCount: reviews.length,
          completedJobs: { increment: 1 },
        },
      });
    });

    // Tell the provider what happened to their money.
    const providerAmount = job.payment.providerAmount;
    if (job.provider.user.phone) {
      const msg =
        settle.status === 'SUCCESS'
          ? `💰 *Dana Pekerjaan Dicairkan!*\n\nPekerjaan dari ${job.customer.name ?? job.customer.phone} selesai.\n` +
            `Dana dicairkan: *Rp ${providerAmount.toLocaleString('id-ID')}* (platform fee Rp ${job.payment.platformFee.toLocaleString('id-ID')} sudah dipotong).`
          : `✅ *Pekerjaan Selesai*\n\nDana Rp ${providerAmount.toLocaleString('id-ID')} sudah aman. ` +
            (settle.reason === 'kyc_pending'
              ? 'Selesaikan verifikasi rekening/KYC untuk mencairkannya.'
              : 'Pencairan sedang diproses.');
      await sendWAMessage(job.provider.user.phone, msg);
    }

    return ok({
      released: true,
      payoutStatus: settle.status,
      providerAmount,
      platformFee: job.payment.platformFee,
      rating,
    });
  })();
}
