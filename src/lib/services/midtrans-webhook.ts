/**
 * Midtrans webhook service (PROMPT MASTER Bagian 4) — the business logic behind
 * `POST /api/webhooks/midtrans`, extracted from the route so the route is a thin
 * controller (parse → delegate → respond) and this logic is unit-testable in
 * isolation.
 *
 * Contract (unchanged behaviour): every handled case returns a `WebhookResult`
 * (httpStatus + JSON payload). Only an UNEXPECTED error throws — the route lets
 * it propagate to a 500 so Midtrans retries and we don't record a half-processed
 * event. Acks are 200 even when ignored (invalid signature / unknown order /
 * mismatch) because Midtrans retries non-200 and its dashboard "test
 * notification" is unsigned.
 *
 * Guarantees preserved: signature verified (timing-safe), idempotent via the
 * WebhookEvent ledger, amount-mismatch never auto-processed, out-of-order events
 * rejected by the state machine (no status override), audit via PaymentEvent.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import {
  applyTransitionWithJob,
  InvalidTransitionError,
  ConcurrentTransitionError,
} from '../payment-state';
import { logEvent, logAlert, notifyOps } from '../logger';
import { sendReceiptEmail } from '../email';
import { paymentRepository } from '../repositories/payment';
import { webhookEventRepository } from '../repositories/webhook-event';

/** Escalate to ops if signature failures spike (Bagian 10: >5 in 10 minutes). */
const SIG_FAIL_WINDOW_MS = 10 * 60 * 1000;
const SIG_FAIL_ESCALATE = 5;

/** The subset of the Midtrans notification body we read. */
export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  transaction_status?: string;
  fraud_status?: string;
  signature_key?: string;
  payment_type?: string;
  va_numbers?: Array<{ va_number?: string }>;
}

/** What the route should send back. */
export interface WebhookResult {
  httpStatus: number;
  payload: Record<string, unknown>;
}

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

export async function handleMidtransWebhook(body: MidtransNotification): Promise<WebhookResult> {
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
    return { httpStatus: 500, payload: { ok: false } };
  }

  const externalId = String(order_id ?? '');
  const eventType = `${transaction_status ?? 'unknown'}:${fraud_status ?? '-'}`;
  const sigValid = verifySignature(order_id, status_code, gross_amount, serverKey, signature_key);
  // JSON-safe copy of the body for the ledger / audit (typed body → InputJsonValue).
  const rawPayload = body as unknown as Prisma.InputJsonValue;

  // 1. Idempotency: a webhook we've already handled (same order + event) is a
  //    no-op. Gateways retry aggressively, so this is the common case.
  const seen = await webhookEventRepository.findByKey(externalId, eventType);
  if (seen) {
    logEvent('webhook.duplicate', { order_id, eventType });
    return { httpStatus: 200, payload: { ok: true, duplicate: true } };
  }

  // 2. Signature gate. Never process an unverified payload.
  if (!sigValid) {
    logAlert('WEBHOOK_SIGNATURE_INVALID', { order_id });
    await webhookEventRepository.record(externalId, eventType, false, body);
    // Spike of bad signatures = likely replay/attack — page ops (Bagian 10).
    const recentBad = await webhookEventRepository.countRecentInvalid(SIG_FAIL_WINDOW_MS);
    if (recentBad > SIG_FAIL_ESCALATE) {
      logAlert('WEBHOOK_SIGNATURE_INVALID_SPIKE', { count: recentBad, windowMin: 10 });
      await notifyOps('WEBHOOK_SIGNATURE_INVALID_SPIKE', { count: recentBad, windowMin: 10 });
    }
    return { httpStatus: 200, payload: { ok: true, ignored: 'invalid signature' } };
  }
  logEvent('webhook.verified', { order_id });

  // 3. Match the payment. Unknown order_id (e.g. dashboard test) → ack + record.
  const payment = await paymentRepository.findByOrderId(externalId);
  if (!payment) {
    await webhookEventRepository.record(externalId, eventType, true, body);
    return { httpStatus: 200, payload: { ok: true, ignored: 'payment not found', order_id } };
  }

  // 4. Financial mismatch is the highest-priority alarm — never auto-process it.
  const gross = Number(gross_amount);
  if (Number.isFinite(gross) && Math.round(gross) !== payment.amount) {
    const mismatch = {
      order_id,
      paymentId: payment.id,
      dbAmount: payment.amount,
      gatewayAmount: gross,
    };
    logAlert('PAYMENT_AMOUNT_MISMATCH', mismatch);
    // Highest-priority alarm (Bagian 10) — page ops immediately.
    await notifyOps('PAYMENT_AMOUNT_MISMATCH', mismatch);
    await webhookEventRepository.record(externalId, eventType, true, body);
    return { httpStatus: 200, payload: { ok: true, ignored: 'amount mismatch' } };
  }

  const isSuccess =
    (transaction_status === 'capture' && fraud_status === 'accept') ||
    transaction_status === 'settlement';
  const isFailure =
    transaction_status === 'cancel' ||
    transaction_status === 'expire' ||
    transaction_status === 'deny';

  // 5. Apply the state transition. Idempotent (PAID→PAID is a no-op) and guarded,
  //    so duplicate/concurrent success events are safe. An out-of-order event
  //    (e.g. `expire` after `settlement`) is rejected by the state machine and
  //    logged as an anomaly rather than overriding the status.
  try {
    if (isSuccess) {
      const res = await prisma.$transaction((tx) =>
        applyTransitionWithJob(tx, {
          paymentId: payment.id,
          to: 'PAID',
          triggeredBy: 'WEBHOOK',
          reason: transaction_status,
          rawWebhookPayload: rawPayload,
          expectedFrom: 'PENDING',
          data: {
            midtransPaymentType: payment_type ?? null,
            midtransVaNumber: va_numbers?.[0]?.va_number ?? null,
            paidAt: new Date(),
          },
          jobStatus: 'CONFIRMED',
        })
      );
      if (res.changed) {
        logEvent('payment.status_changed', { paymentId: payment.id, from: 'PENDING', to: 'PAID' });
        // Email the customer their receipt + PDF nota (best-effort, off the critical path).
        await sendReceiptEmail(payment.jobId).catch(() => {});
      }
    } else if (isFailure) {
      const res = await prisma.$transaction((tx) =>
        applyTransitionWithJob(tx, {
          paymentId: payment.id,
          to: 'FAILED',
          triggeredBy: 'WEBHOOK',
          reason: transaction_status,
          rawWebhookPayload: rawPayload,
          expectedFrom: 'PENDING',
          jobStatus: 'CANCELLED',
        })
      );
      if (res.changed) {
        logEvent('payment.status_changed', {
          paymentId: payment.id,
          from: 'PENDING',
          to: 'FAILED',
        });
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
      await webhookEventRepository.record(externalId, eventType, true, body);
      return { httpStatus: 200, payload: { ok: true, anomaly: 'out_of_order' } };
    }
    // Unexpected error — do NOT record, so the gateway retry reprocesses it.
    throw err;
  }

  await webhookEventRepository.record(externalId, eventType, true, body);
  return { httpStatus: 200, payload: { ok: true } };
}
