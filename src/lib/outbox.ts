/**
 * Transactional outbox for outbound notifications (currently WhatsApp).
 *
 * Why: request handlers used to `await sendWAMessage(...)` inline, which (a) made
 * the user wait on a slow external gateway and (b) silently lost the message if
 * the gateway hiccuped. Instead we ENQUEUE a row here — a fast local INSERT in
 * the same Postgres the transaction already uses — and let a cron dispatcher
 * deliver it out-of-band with retries. Enqueue never throws, so a queue problem
 * can never break the business transaction that triggered the notification.
 *
 * Delivery + retry happens in {@link dispatchOutboxBatch}, called by
 * `/api/cron/dispatch-outbox`.
 */

import prisma from './prisma';
import { sendWAMessage } from './whatsapp';
import { logEvent } from './logger';

/** A delivery is parked as FAILED after this many unsuccessful attempts. */
export const OUTBOX_MAX_ATTEMPTS = 5;

/** Postgres unique-violation code — a duplicate `dedupeKey` means "already queued". */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Queue a WhatsApp message for durable, non-blocking delivery. Returns nothing
 * and never throws — call sites treat notification as best-effort.
 *
 * @param dedupeKey optional idempotency guard. If a transition can fire twice
 *   (e.g. a webhook retry), pass a stable key so the same message is enqueued
 *   only once. A collision is treated as success (the message is already queued).
 */
export async function enqueueWhatsApp(
  to: string,
  body: string,
  dedupeKey?: string
): Promise<void> {
  try {
    await prisma.outboxMessage.create({
      data: { channel: 'WHATSAPP', toAddress: to, body, dedupeKey: dedupeKey ?? null },
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === PRISMA_UNIQUE_VIOLATION) {
      return; // already queued for this dedupeKey — idempotent no-op
    }
    // Never let a queue failure break the caller's transaction.
    logEvent('outbox.enqueue_failed', { to, error: String(err) }, 'warn');
  }
}

export interface DispatchResult {
  scanned: number;
  sent: number;
  failed: number;
}

/**
 * Deliver a batch of PENDING outbox rows. Successful sends become SENT; failures
 * increment `attempts` and either retry (back to PENDING) or park as FAILED once
 * they exhaust {@link OUTBOX_MAX_ATTEMPTS}.
 *
 * NOTE: this is a single-worker dispatcher. With one cron schedule it won't run
 * concurrently; if you ever fan it out, add a SELECT ... FOR UPDATE SKIP LOCKED
 * claim step to avoid two workers sending the same row (worst case today: a rare
 * duplicate WA message, never a lost one).
 */
export async function dispatchOutboxBatch(limit = 50): Promise<DispatchResult> {
  const pending = await prisma.outboxMessage.findMany({
    where: { status: 'PENDING', attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    let delivered = false;
    let error: string | undefined;
    try {
      delivered = await sendWAMessage(msg.toAddress, msg.body);
    } catch (err) {
      error = String(err);
    }

    if (delivered) {
      await prisma.outboxMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      sent++;
    } else {
      const nextAttempts = msg.attempts + 1;
      await prisma.outboxMessage.update({
        where: { id: msg.id },
        data: {
          status: nextAttempts >= OUTBOX_MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          attempts: { increment: 1 },
          lastError: error ?? 'gateway_rejected',
        },
      });
      failed++;
    }
  }

  logEvent('outbox.dispatch', { scanned: pending.length, sent, failed });
  return { scanned: pending.length, sent, failed };
}
