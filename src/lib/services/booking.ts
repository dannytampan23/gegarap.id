/**
 * Booking domain service.
 *
 * Orchestrates the create-booking use case so it lives in ONE testable place
 * instead of being inlined in the HTTP route: velocity guard → provider/fee
 * resolution → financial snapshot → payment token → atomic Job+Payment write →
 * provider notification (enqueued, not sent inline).
 *
 * The route stays thin: authenticate, parse the body, call this, wrap the result
 * in the API envelope. This module is HTTP-agnostic — it throws typed errors
 * (lib/errors) that `handle()` maps to status codes, and it takes a plain
 * `deviceId` string rather than the Request so it never touches transport.
 */

import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { BadRequestError, RateLimitedError } from '@/lib/errors';
import type { BookingInput } from '@/lib/validations';
import { calculateBookingFinancials } from '@/lib/calculations';
import { resolveFee } from '@/lib/fee-config';
import { createSnapToken } from '@/lib/midtrans';
import { enqueueWhatsApp } from '@/lib/outbox';
import { checkBookingVelocity, recordDeviceAndCheck } from '@/lib/fraud';

/** The authenticated actor creating the booking (identity comes from the session). */
export interface BookingActor {
  id: string;
  name: string | null;
  /** Canonical WhatsApp number (628…). Required to book. */
  phone: string | null;
  /** Customer email — passed to Midtrans customer_details (optional). */
  email?: string | null;
}

export interface CreateBookingResult {
  jobId: string;
  providerName: string;
  snapToken: string;
  mockPayment: boolean;
  dpAmount: number;
  totalFee: number;
}

/**
 * Create a booking + its DP payment for `actor`. `deviceId` is an opaque
 * fingerprint (the route derives it from headers) used for the advisory
 * device-fraud check.
 */
export async function createBooking(
  input: BookingInput,
  actor: BookingActor,
  deviceId: string
): Promise<CreateBookingResult> {
  // A reachable WhatsApp number is required — the provider coordinates there.
  // Google sign-ups without one are prompted to add it in the dashboard first.
  const customerPhone = actor.phone;
  if (!customerPhone) {
    throw new BadRequestError('Lengkapi nomor WhatsApp di dashboard sebelum membuat booking.');
  }

  // Velocity guard (Bagian 8): cap simultaneous unpaid bookings per account.
  const velocity = await checkBookingVelocity(actor.id);
  if (velocity.blocked) {
    throw new RateLimitedError(
      `Anda punya ${velocity.activeCount} booking yang belum dibayar. Selesaikan atau batalkan dulu sebelum membuat booking baru.`
    );
  }
  // Device-fingerprint observation (best-effort, advisory flag only).
  await recordDeviceAndCheck(deviceId, actor.id);

  // Provider must exist and be open for bookings (snapshot the rate now).
  const provider = await prisma.providerProfile.findUnique({
    where: { id: input.providerProfileId },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!provider || !provider.isVerified || !provider.available) {
    throw new BadRequestError('Tukang tidak tersedia.');
  }

  // Financials — resolve the category's fee rule (FeeConfig + campaign), then
  // snapshot it. The Payment stores feeConfigId so later config changes never
  // rewrite this transaction's economics.
  const fee = await resolveFee(provider.category);
  const fin = calculateBookingFinancials(
    provider.dailyRate,
    input.estimatedDays,
    fee,
    input.dpAmount
  );

  // Build the Snap token first (using a pre-generated job id) so we never persist
  // a booking whose payment couldn't be created.
  const jobId = randomUUID();
  // Midtrans caps order_id at 50 chars. "GGR-" + uuid(36) + "-" + base36 ms
  // timestamp(~8) = ~49, leaving the full job id traceable while staying under
  // the limit (a plain ms timestamp pushed it to 54 and Midtrans rejected it).
  const orderId = `GGR-${jobId}-${Date.now().toString(36)}`;
  const snap = await createSnapToken({
    orderId,
    amount: fin.dpAmount,
    customerName: actor.name ?? customerPhone,
    customerPhone,
    customerEmail: actor.email ?? null,
    description: `DP Booking ${provider.category} - ${provider.user.name}`,
  });

  // Persist Job + Payment atomically (nested write).
  const job = await prisma.job.create({
    data: {
      id: jobId,
      customerId: actor.id,
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
          customerId: actor.id,
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

  // Notify the provider over WhatsApp (durable + non-blocking via the outbox).
  if (provider.user.phone) {
    await enqueueWhatsApp(
      provider.user.phone,
      `📋 *Booking Baru di gegarap.id!*\n\n` +
        `Pekerjaan: ${input.description}\n` +
        `Alamat: ${input.customerAddress}, ${input.district}\n` +
        `Jadwal: ${new Date(input.scheduledDate).toLocaleDateString('id-ID')}, ${input.timeSlot}\n` +
        `Estimasi: ${input.estimatedDays} hari\n` +
        `Total: Rp ${fin.totalAmount.toLocaleString('id-ID')}\n\n` +
        `Cek dashboard: ${process.env.APP_URL ?? ''}/provider/dashboard`,
      `job:${jobId}:new`
    );
  }

  return {
    jobId: job.id,
    providerName: provider.user.name,
    snapToken: snap.token,
    mockPayment: snap.mock,
    dpAmount: fin.dpAmount,
    totalFee: fin.totalAmount,
  };
}
