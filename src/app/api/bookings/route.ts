import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { bookingSchema } from '@/lib/validations';
import { calculateBookingFinancials } from '@/lib/calculations';
import { resolveFee } from '@/lib/fee-config';
import { createSnapToken } from '@/lib/midtrans';
import { sendWAMessage } from '@/lib/whatsapp';
import { checkBookingVelocity, deviceIdFrom, recordDeviceAndCheck } from '@/lib/fraud';

export async function POST(req: Request) {
  return handle(async () => {
    // 1. Booking requires an authenticated session.
    const session = await getSession();
    if (!session?.user?.id) {
      return fail('Harus login untuk booking.', 401);
    }

    // 1a. A reachable WhatsApp number is required to book (the provider contacts
    //     the customer there). Google sign-ups without one are asked to add it
    //     first — the dashboard prompts for this non-blockingly.
    const customerPhone = session.user.phone;
    if (!customerPhone) {
      return fail('Lengkapi nomor WhatsApp di dashboard sebelum membuat booking.', 400);
    }

    // 1b. Velocity guard (Bagian 8): cap simultaneous unpaid bookings per account.
    const velocity = await checkBookingVelocity(session.user.id);
    if (velocity.blocked) {
      return fail(
        `Anda punya ${velocity.activeCount} booking yang belum dibayar. Selesaikan atau batalkan dulu sebelum membuat booking baru.`,
        429
      );
    }
    // Device-fingerprint observation (best-effort, advisory flag only).
    await recordDeviceAndCheck(deviceIdFrom(req), session.user.id);

    // 2. Validate input (identity comes from the session, not the body).
    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = bookingSchema.parse(body);

    // 3. Provider must exist and be open for bookings (snapshot the rate now).
    const provider = await prisma.providerProfile.findUnique({
      where: { id: input.providerProfileId },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!provider || !provider.isVerified || !provider.available) {
      return fail('Tukang tidak tersedia.', 400);
    }

    // 4. Financials — resolve the category's fee rule (FeeConfig + campaign),
    //    then snapshot it. The Payment stores feeConfigId so later config
    //    changes never rewrite this transaction's economics.
    const fee = await resolveFee(provider.category);
    const fin = calculateBookingFinancials(
      provider.dailyRate,
      input.estimatedDays,
      fee,
      input.dpAmount
    );

    // 5. Build the Snap token first (using a pre-generated job id) so we never
    //    persist a booking whose payment couldn't be created.
    const jobId = randomUUID();
    // Midtrans caps order_id at 50 chars. "GGR-" + uuid(36) + "-" + base36 ms
    // timestamp(~8) = ~49, leaving the full job id traceable while staying under
    // the limit (a plain ms timestamp pushed it to 54 and Midtrans rejected it).
    const orderId = `GGR-${jobId}-${Date.now().toString(36)}`;
    const snap = await createSnapToken({
      orderId,
      amount: fin.dpAmount,
      customerName: session.user.name ?? customerPhone,
      customerPhone,
      description: `DP Booking ${provider.category} - ${provider.user.name}`,
    });

    // 6. Persist Job + Payment atomically (nested write).
    const job = await prisma.job.create({
      data: {
        id: jobId,
        customerId: session.user.id,
        providerProfileId: provider.id,
        status: 'PENDING',
        description: input.description,
        customerAddress: input.customerAddress,
        customerWaNumber: customerPhone,
        district: input.district,
        scheduledDate: new Date(input.scheduledDate),
        timeSlot: input.timeSlot,
        notes: input.notes || null,
        estimatedDays: input.estimatedDays,
        dailyRate: provider.dailyRate,
        totalFee: fin.subtotal,
        dpAmount: fin.dpAmount,
        platformCommission: fin.platformFee,
        providerPayout: fin.providerEarnings,
        payment: {
          create: {
            amount: fin.dpAmount,
            type: 'DP',
            status: 'PENDING',
            customerId: session.user.id,
            providerProfileId: provider.id,
            dpAmount: fin.dpAmount,
            remainingAmount: fin.remainingAmount,
            platformFee: fin.platformFee,
            providerAmount: fin.providerEarnings,
            feeConfigId: fee.feeConfigId,
            campaignId: fee.campaignId,
            idempotencyKey: orderId, // unik per percobaan pembayaran
            midtransOrderId: orderId,
            midtransToken: snap.token,
          },
        },
      },
    });

    // 7. Notify the provider over WhatsApp (best-effort).
    if (provider.user.phone) {
      await sendWAMessage(
        provider.user.phone,
        `📋 *Booking Baru di gegarap.id!*\n\n` +
          `Pekerjaan: ${input.description}\n` +
          `Alamat: ${input.customerAddress}, ${input.district}\n` +
          `Jadwal: ${new Date(input.scheduledDate).toLocaleDateString('id-ID')}, ${input.timeSlot}\n` +
          `Estimasi: ${input.estimatedDays} hari\n` +
          `Total: Rp ${fin.totalAmount.toLocaleString('id-ID')}\n\n` +
          `Cek dashboard: ${process.env.APP_URL ?? ''}/provider/dashboard`
      );
    }

    return ok(
      {
        jobId: job.id,
        providerName: provider.user.name,
        snapToken: snap.token,
        mockPayment: snap.mock,
        dpAmount: fin.dpAmount,
        totalFee: fin.totalAmount,
      },
      201
    );
  })();
}
