/**
 * Booking domain service.
 *
 * Orchestrates the create-booking use case so it lives in ONE testable place
 * instead of being inlined in the HTTP route: idempotency → velocity guard →
 * device check → risk score → provider/fee resolution → financial snapshot →
 * payment token (with manual-transfer fallback) → atomic Job+Payment write →
 * provider notification (enqueued, not sent inline).
 *
 * The route stays thin: authenticate, parse the body, call this, wrap the result
 * in the API envelope. This module is HTTP-agnostic — it throws typed errors
 * (lib/errors) that `handle()` maps to status codes, and it takes a plain
 * `deviceId` string rather than the Request so it never touches transport.
 */

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { BadRequestError, ForbiddenError, RateLimitedError } from '@/lib/errors';
import type { BookingInput } from '@/lib/validations';
import { calculateBookingFinancials } from '@/lib/calculations';
import { resolveFee } from '@/lib/fee-config';
import { createSnapToken, MidtransUnavailableError } from '@/lib/midtrans';
import {
  buildManualTransferInstruction,
  isManualTransferConfigured,
  type ManualTransferInstruction,
} from '@/lib/manual-transfer';
import { checkBookingVelocity, recordDeviceAndCheck } from '@/lib/fraud';
import { assessBookingRisk, type RiskBand } from '@/lib/risk-scoring';
import { paymentRepository } from '@/lib/repositories/payment';
import { logEvent } from '@/lib/logger';

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
  dpAmount: number;
  totalFee: number;
  /** How the DP is collected. */
  paymentMethod: 'SNAP' | 'MANUAL_TRANSFER';
  /** Snap token (empty string on the manual-transfer fallback path). */
  snapToken: string;
  /** True for the local dev mock token (no real Snap popup). */
  mockPayment: boolean;
  /** Present only when paymentMethod === 'MANUAL_TRANSFER'. */
  manualTransfer?: ManualTransferInstruction;
  /** Risk band for this booking (observability/UX). */
  riskBand?: RiskBand;
  /** True when an idempotency key matched an existing booking (no new work done). */
  idempotentReplay?: boolean;
}

export interface CreateBookingOptions {
  /** Client-supplied Idempotency-Key header — makes retries safe (no dupes). */
  idempotencyKey?: string | null;
}

/**
 * Create a booking + its DP payment for `actor`. `deviceId` is an opaque
 * fingerprint (the route derives it from headers) used for the advisory
 * device-fraud check. `opts.idempotencyKey` (if supplied) dedupes retries.
 */
export async function createBooking(
  input: BookingInput,
  actor: BookingActor,
  deviceId: string,
  opts: CreateBookingOptions = {}
): Promise<CreateBookingResult> {
  const idempotencyKey = opts.idempotencyKey?.trim() || null;

  // 0. Idempotency: if this exact request was already processed, return the
  //    original result instead of creating a second booking/charge.
  if (idempotencyKey) {
    const replay = await findByIdempotencyKey(idempotencyKey, actor.id);
    if (replay) return replay;
  }

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
    select: {
      id: true,
      category: true,
      dailyRate: true,
      isVerified: true,
      available: true,
      user: { select: { name: true, phone: true } },
    },
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

  // Risk scoring (advisory): always scores + logs the ML feature vector, flags
  // HIGH risk, and only hard-blocks when score crosses RISK_BLOCK_THRESHOLD
  // (default: never). This never throws on its own.
  const risk = await assessBookingRisk({
    customerId: actor.id,
    amount: fin.dpAmount,
    subtotal: fin.subtotal,
  });
  if (risk.shouldBlock) {
    throw new ForbiddenError(
      'Booking ditahan sementara untuk verifikasi keamanan. Hubungi dukungan untuk melanjutkan.'
    );
  }

  // Build the payment delivery first (using a pre-generated job id) so we never
  // persist a booking whose payment couldn't be set up. Midtrans caps order_id
  // at 50 chars: "GGR-" + uuid(36) + "-" + base36 ms (~8) = ~49.
  const jobId = randomUUID();
  const orderId = `GGR-${jobId}-${Date.now().toString(36)}`;
  const delivery = await preparePaymentDelivery({
    orderId,
    amount: fin.dpAmount,
    customerName: actor.name ?? customerPhone,
    customerPhone,
    customerEmail: actor.email ?? null,
    description: `DP Booking ${provider.category} - ${provider.user.name}`,
  });

  // Persist Job + Payment atomically (nested write). The unique idempotencyKey
  // is the race backstop: a concurrent duplicate trips P2002 → return the winner.
  let job;
  try {
    job = await prisma.job.create({
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
            paymentGateway: delivery.gateway,
            idempotencyKey: idempotencyKey ?? orderId,
            midtransOrderId: orderId, // external reference (also used for manual)
            midtransToken: delivery.snapToken || null,
          },
        },
      },
      include: { payment: { select: { id: true } } },
    });
  } catch (err) {
    // Lost an idempotency race — the other request already created it. Return it.
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const replay = await findByIdempotencyKey(idempotencyKey, actor.id);
      if (replay) return replay;
    }
    throw err;
  }

  logEvent('payment.created', {
    paymentId: job.payment?.id,
    jobId: job.id,
    order_id: orderId,
    method: delivery.gateway,
    riskBand: risk.band,
    riskScore: risk.score,
  });

  return {
    jobId: job.id,
    providerName: provider.user.name,
    dpAmount: fin.dpAmount,
    totalFee: fin.totalAmount,
    paymentMethod: delivery.gateway,
    snapToken: delivery.snapToken,
    mockPayment: delivery.mock,
    manualTransfer: delivery.manualTransfer,
    riskBand: risk.band,
  };
}

// ─── Payment delivery (Snap, with manual-transfer fallback) ──────────────────

interface DeliveryParams {
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  description: string;
}

interface PaymentDelivery {
  gateway: 'SNAP' | 'MANUAL_TRANSFER';
  snapToken: string;
  mock: boolean;
  manualTransfer?: ManualTransferInstruction;
}

/**
 * Try to mint a Snap token. If the gateway is UNAVAILABLE (after retries) and a
 * manual-transfer destination is configured, fall back to bank instructions so
 * the booking isn't lost. A permanent gateway rejection (bad payload/keys) is
 * re-thrown — falling back would mask a real bug.
 */
async function preparePaymentDelivery(params: DeliveryParams): Promise<PaymentDelivery> {
  try {
    const snap = await createSnapToken(params);
    return { gateway: 'SNAP', snapToken: snap.token, mock: snap.mock };
  } catch (err) {
    if (err instanceof MidtransUnavailableError && isManualTransferConfigured()) {
      logEvent(
        'payment.fallback',
        { order_id: params.orderId, reason: 'midtrans_unavailable' },
        'warn'
      );
      const manualTransfer = buildManualTransferInstruction({
        amount: params.amount,
        reference: params.orderId,
      });
      return { gateway: 'MANUAL_TRANSFER', snapToken: '', mock: false, manualTransfer };
    }
    throw err;
  }
}

// ─── Idempotency replay ──────────────────────────────────────────────────────

/** Rebuild a CreateBookingResult from an already-persisted Payment, or null. */
async function findByIdempotencyKey(
  key: string,
  customerId: string
): Promise<CreateBookingResult | null> {
  const payment = await paymentRepository.findByIdempotencyKey(key);
  if (!payment || payment.customerId !== customerId || !payment.job) return null;

  const isManual = payment.paymentGateway === 'MANUAL_TRANSFER';
  const manualTransfer =
    isManual && payment.midtransOrderId
      ? buildManualTransferInstruction({
          amount: payment.amount,
          reference: payment.midtransOrderId,
        })
      : undefined;

  return {
    jobId: payment.jobId,
    providerName: payment.job.provider.user.name,
    dpAmount: payment.amount,
    totalFee: payment.job.totalFee,
    paymentMethod: isManual ? 'MANUAL_TRANSFER' : 'SNAP',
    snapToken: payment.midtransToken ?? '',
    mockPayment: (payment.midtransToken ?? '').startsWith('mock-'),
    manualTransfer,
    idempotentReplay: true,
  };
}
