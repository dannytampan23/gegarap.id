import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendWAMessage } from '@/lib/whatsapp';
import {
  applyTransition,
  InvalidTransitionError,
  ConcurrentTransitionError,
} from '@/lib/payment-state';
import { logEvent, logAlert } from '@/lib/logger';

/** Midtrans notification signature = sha512(orderId + statusCode + grossAmount + serverKey). */
function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  received: unknown
): boolean {
  const expected = createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  // Constant-time compare to avoid leaking the signature via timing.
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

/** Record the webhook in the idempotency ledger (forensic raw copy). Swallows
 * the unique-violation that a concurrent duplicate would cause. */
async function recordWebhook(
  externalId: string,
  eventType: string,
  signatureValid: boolean,
  body: unknown
): Promise<void> {
  try {
    await prisma.webhookEvent.create({
      data: {
        gateway: 'MIDTRANS',
        externalId,
        eventType,
        signatureValid,
        rawPayload: body as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
  }
}

async function notifyCustomerPaid(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { customer: true, provider: { include: { user: true } } },
  });
  if (!job?.customer.phone) return;
  await sendWAMessage(
    job.customer.phone,
    `✅ *Pembayaran DP Diterima!*\n\n` +
      `Booking #${job.id.slice(-6).toUpperCase()} dikonfirmasi.\n` +
      `Tukang: ${job.provider.user.name}\n` +
      (job.scheduledDate ? `Jadwal: ${job.scheduledDate.toLocaleDateString('id-ID')}\n` : '') +
      `\nTukang akan segera menghubungi Anda. 🔧`
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const {
    order_id,
    transaction_status,
    fraud_status,
    status_code,
    gross_amount,
    signature_key,
    payment_type,
    va_numbers,
  } = body;

  logEvent('webhook.received', { order_id, transaction_status, fraud_status });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    logEvent('webhook.received', { order_id, error: 'MIDTRANS_SERVER_KEY missing' }, 'error');
    // 500 (not recorded) so Midtrans retries once the key is configured.
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const externalId = String(order_id ?? '');
  const eventType = `${transaction_status ?? 'unknown'}:${fraud_status ?? '-'}`;
  const sigValid = verifySignature(order_id, status_code, gross_amount, serverKey, signature_key);

  // 1. Idempotency: a webhook we've already handled (same order + event) is a
  //    no-op. Gateways retry aggressively, so this is the common case.
  const seen = await prisma.webhookEvent.findUnique({
    where: { gateway_externalId_eventType: { gateway: 'MIDTRANS', externalId, eventType } },
  });
  if (seen) {
    logEvent('webhook.duplicate', { order_id, eventType });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 2. Signature gate. Ack 200 (Midtrans retries on non-200 and its dashboard
  //    "test notification" is unsigned) but never process an unverified payload.
  if (!sigValid) {
    logAlert('WEBHOOK_SIGNATURE_INVALID', { order_id });
    await recordWebhook(externalId, eventType, false, body);
    return NextResponse.json({ ok: true, ignored: 'invalid signature' });
  }
  logEvent('webhook.verified', { order_id });

  // 3. Match the payment. Unknown order_id (e.g. dashboard test) → ack + record.
  const payment = await prisma.payment.findUnique({ where: { midtransOrderId: externalId } });
  if (!payment) {
    await recordWebhook(externalId, eventType, true, body);
    return NextResponse.json({ ok: true, ignored: 'payment not found', order_id });
  }

  // 4. Financial mismatch is the highest-priority alarm — never auto-process it.
  const gross = Number(gross_amount);
  if (Number.isFinite(gross) && Math.round(gross) !== payment.amount) {
    logAlert('PAYMENT_AMOUNT_MISMATCH', {
      order_id,
      paymentId: payment.id,
      dbAmount: payment.amount,
      gatewayAmount: gross,
    });
    await recordWebhook(externalId, eventType, true, body);
    return NextResponse.json({ ok: true, ignored: 'amount mismatch' });
  }

  const isSuccess =
    (transaction_status === 'capture' && fraud_status === 'accept') ||
    transaction_status === 'settlement';
  const isFailure =
    transaction_status === 'cancel' ||
    transaction_status === 'expire' ||
    transaction_status === 'deny';

  // 5. Apply the state transition. The transition is idempotent (PAID→PAID is a
  //    no-op) and guarded, so duplicate/concurrent success events are safe. An
  //    out-of-order event (e.g. `expire` after `settlement`) is rejected by the
  //    state machine and logged as an anomaly rather than overriding the status.
  try {
    if (isSuccess) {
      const res = await prisma.$transaction((tx) =>
        applyTransition(tx, {
          paymentId: payment.id,
          to: 'PAID',
          triggeredBy: 'WEBHOOK',
          reason: transaction_status,
          rawWebhookPayload: body,
          expectedFrom: 'PENDING',
          data: {
            midtransPaymentType: payment_type ?? null,
            midtransVaNumber: va_numbers?.[0]?.va_number ?? null,
            paidAt: new Date(),
          },
        })
      );
      if (res.changed) {
        await prisma.job.update({ where: { id: payment.jobId }, data: { status: 'CONFIRMED' } });
        logEvent('payment.status_changed', { paymentId: payment.id, from: 'PENDING', to: 'PAID' });
        await notifyCustomerPaid(payment.jobId);
      }
    } else if (isFailure) {
      const res = await prisma.$transaction((tx) =>
        applyTransition(tx, {
          paymentId: payment.id,
          to: 'FAILED',
          triggeredBy: 'WEBHOOK',
          reason: transaction_status,
          rawWebhookPayload: body,
          expectedFrom: 'PENDING',
        })
      );
      if (res.changed) {
        logEvent('payment.status_changed', { paymentId: payment.id, from: 'PENDING', to: 'FAILED' });
      }
    }
  } catch (err) {
    if (err instanceof InvalidTransitionError || err instanceof ConcurrentTransitionError) {
      logAlert('WEBHOOK_OUT_OF_ORDER', {
        order_id,
        paymentId: payment.id,
        transaction_status,
        error: err.message,
      });
      await recordWebhook(externalId, eventType, true, body);
      return NextResponse.json({ ok: true, anomaly: 'out_of_order' });
    }
    // Unexpected error — do NOT record, so the gateway retry reprocesses it.
    throw err;
  }

  await recordWebhook(externalId, eventType, true, body);
  return NextResponse.json({ ok: true });
}

// Register this URL in Midtrans Dashboard → Settings → Configuration →
// Payment Notification URL: https://www.gegarap.id/api/webhooks/midtrans
