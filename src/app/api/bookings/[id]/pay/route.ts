import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { createSnapToken } from '@/lib/midtrans';
import { logEvent } from '@/lib/logger';

/**
 * POST /api/bookings/:id/pay — (re)issue a Snap token so the customer can pay the
 * DP from the dashboard (the booking-creation popup only fires once). Generates a
 * FRESH order id + token each call so a stale/expired token never blocks payment;
 * the webhook matches on the latest stored `midtransOrderId`. Customer-only.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await getSession();
    if (!session?.user?.id) return fail('Harus login untuk membayar.', 401);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { payment: true, provider: { select: { category: true, user: { select: { name: true } } } } },
    });
    if (!job || !job.payment) return fail('Booking tidak ditemukan.', 404);
    if (job.customerId !== session.user.id) return fail('Akses ditolak.', 403);

    // Only an unpaid, still-pending booking can be paid. PAID/HELD/CANCELLED/etc.
    // are surfaced as a clear 409 instead of charging twice.
    if (job.payment.status !== 'PENDING' || job.status !== 'PENDING') {
      return fail('Booking ini tidak menunggu pembayaran DP.', 409);
    }

    const phone = job.customerWaNumber ?? session.user.phone;
    if (!phone) return fail('Nomor WhatsApp belum lengkap.', 400);

    const orderId = `GGR-${job.id}-${Date.now().toString(36)}`;
    const snap = await createSnapToken({
      orderId,
      amount: job.payment.amount,
      customerName: session.user.name ?? phone,
      customerPhone: phone,
      customerEmail: session.user.email ?? null,
      description: `DP Booking ${job.provider.category} - ${job.provider.user.name}`,
    });

    await prisma.payment.update({
      where: { id: job.payment.id },
      data: { midtransOrderId: orderId, idempotencyKey: orderId, midtransToken: snap.token },
    });
    logEvent('payment.created', { paymentId: job.payment.id, jobId: job.id, order_id: orderId, resumed: true });

    return ok({ snapToken: snap.token, mock: snap.mock });
  })();
}
