import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { releaseAndSettle } from '@/lib/payout';
import { InvalidTransitionError } from '@/lib/payment-state';

const completeSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** Job states from which the customer may confirm completion. */
const COMPLETABLE_JOB = ['CONFIRMED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const { rating, comment } = completeSchema.parse(body);

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        payment: { include: { payouts: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        review: true,
      },
    });

    // Only the booking's owner may complete it.
    if (!job || job.customerId !== session.user.id) return fail('Booking tidak ditemukan.', 404);
    if (!COMPLETABLE_JOB.includes(job.status)) {
      return fail('Status booking tidak valid untuk diselesaikan.', 400);
    }
    if (!job.payment || !['PAID', 'HELD', 'RELEASED'].includes(job.payment.status)) {
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

    // Save the review idempotently and recompute the provider rating. The job
    // status was committed atomically with the payment release above.
    if (!job.review)
      await prisma.$transaction(async (tx) => {
        const created = await tx.review.createMany({
          data: [
            {
              jobId: job.id,
              userId: session.user.id,
              providerProfileId: job.providerProfileId,
              rating,
              comment: comment || null,
            },
          ],
          skipDuplicates: true,
        });
        if (created.count === 0) return;

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

    return ok({
      released: true,
      payoutStatus: settle.status,
      providerAmount: job.payment.providerAmount,
      platformFee: job.payment.platformFee,
      rating: job.review?.rating ?? rating,
    });
  })();
}
