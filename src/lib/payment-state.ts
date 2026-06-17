import { Prisma } from '@prisma/client';
import type { Payment, PaymentEvent } from '@prisma/client';
import prisma from './prisma';

// ─── Payment lifecycle (PROMPT MASTER Bagian 3) ─────────────────────────────
// The ONLY place payment status may change. Transitions are backend-only, every
// one is recorded to the append-only PaymentEvent log, and an illegal or
// out-of-order transition throws instead of silently overwriting.

export type PaymentStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PAID'
  | 'HELD'
  | 'RELEASED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'REFUND_REJECTED'
  | 'DISPUTED'
  | 'EXPIRED'
  | 'FAILED';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'DRAFT',
  'PENDING',
  'PAID',
  'HELD',
  'RELEASED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'REFUND_REJECTED',
  'DISPUTED',
  'EXPIRED',
  'FAILED',
] as const;

/** Terminal states never transition again. */
export const TERMINAL_STATUSES: readonly PaymentStatus[] = [
  'RELEASED',
  'REFUNDED',
  'EXPIRED',
  'FAILED',
] as const;

/**
 * Legal transitions. Anything not listed here is rejected — in particular a
 * `FAILED`/`EXPIRED` webhook arriving after `PAID` is NOT allowed to override
 * (Bagian 5.3: log as anomaly, do not process).
 */
export const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  DRAFT: ['PENDING', 'EXPIRED', 'FAILED'],
  PENDING: ['PAID', 'EXPIRED', 'FAILED'],
  PAID: ['HELD', 'REFUND_REQUESTED', 'DISPUTED', 'REFUNDED'],
  HELD: ['RELEASED', 'REFUND_REQUESTED', 'DISPUTED'],
  RELEASED: [],
  REFUND_REQUESTED: ['REFUNDED', 'REFUND_REJECTED', 'DISPUTED'],
  REFUNDED: [],
  REFUND_REJECTED: ['HELD', 'RELEASED', 'DISPUTED'],
  DISPUTED: ['RELEASED', 'REFUNDED'],
  EXPIRED: [],
  FAILED: [],
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: PaymentStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Errors (typed so callers can branch & log anomalies) ───────────────────

export class PaymentNotFoundError extends Error {
  readonly code = 'PAYMENT_NOT_FOUND';
  constructor(public paymentId: string) {
    super(`Payment not found: ${paymentId}`);
  }
}

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';
  constructor(
    public from: string,
    public to: string,
    detail?: string
  ) {
    super(`Illegal payment transition ${from} → ${to}${detail ? ` (${detail})` : ''}`);
  }
}

export class ConcurrentTransitionError extends Error {
  readonly code = 'CONCURRENT_TRANSITION';
  constructor(
    public expectedFrom: string,
    public to: string,
    public actual?: string
  ) {
    super(`Concurrent modification: expected ${expectedFrom} → ${to}, now ${actual ?? 'unknown'}`);
  }
}

// ─── Transition engine ──────────────────────────────────────────────────────

type Db = Prisma.TransactionClient;

export interface TransitionInput {
  paymentId: string;
  to: PaymentStatus;
  /** 'SYSTEM' | 'WEBHOOK' | a User.id (admin/customer/provider). */
  triggeredBy: string;
  reason?: string;
  rawWebhookPayload?: Prisma.InputJsonValue;
  /** Extra scalar fields to set on the Payment alongside the status change. */
  data?: Prisma.PaymentUpdateManyMutationInput;
  /** Optional guard: only proceed if the current status is (one of) these. */
  expectedFrom?: PaymentStatus | PaymentStatus[];
}

export interface TransitionResult {
  payment: Payment;
  event: PaymentEvent | null;
  /** False when the payment was already in the target state (idempotent no-op). */
  changed: boolean;
}

/**
 * Apply a transition inside an existing transaction. Uses a status-guarded
 * `updateMany` so two concurrent callers can't both move the same payment.
 * Re-applying the same target state is an idempotent no-op (returns changed:false)
 * — this is what makes duplicate webhooks safe.
 */
export async function applyTransition(db: Db, input: TransitionInput): Promise<TransitionResult> {
  const current = await db.payment.findUnique({ where: { id: input.paymentId } });
  if (!current) throw new PaymentNotFoundError(input.paymentId);

  const from = current.status as PaymentStatus;

  // Idempotent: already in the target state → no event, no change.
  if (from === input.to) {
    return { payment: current, event: null, changed: false };
  }

  if (input.expectedFrom) {
    const allowed = Array.isArray(input.expectedFrom) ? input.expectedFrom : [input.expectedFrom];
    if (!allowed.includes(from)) {
      throw new InvalidTransitionError(from, input.to, `expected ${allowed.join('|')}`);
    }
  }

  if (!canTransition(from, input.to)) {
    throw new InvalidTransitionError(from, input.to);
  }

  const updated = await db.payment.updateMany({
    where: { id: input.paymentId, status: from },
    data: { ...(input.data ?? {}), status: input.to },
  });
  if (updated.count === 0) {
    const latest = await db.payment.findUnique({ where: { id: input.paymentId } });
    throw new ConcurrentTransitionError(from, input.to, latest?.status);
  }

  const payment = (await db.payment.findUnique({ where: { id: input.paymentId } }))!;
  const event = await db.paymentEvent.create({
    data: {
      paymentId: input.paymentId,
      fromStatus: from,
      toStatus: input.to,
      triggeredBy: input.triggeredBy,
      reason: input.reason ?? null,
      rawWebhookPayload: input.rawWebhookPayload ?? Prisma.JsonNull,
    },
  });

  return { payment, event, changed: true };
}

/** Run a transition in its own transaction (the common case). */
export function transitionPayment(input: TransitionInput): Promise<TransitionResult> {
  return prisma.$transaction((tx) => applyTransition(tx, input));
}

// ─── Status → human label mapping (Bagian 9) ────────────────────────────────
// NEVER render raw statuses to end users. This is the single source of truth
// the frontend should use (see docs/payment-status-mapping.md).

export type StatusTone = 'info' | 'success' | 'warning' | 'danger';

export interface StatusLabel {
  customer: string;
  /** '—' means the status isn't surfaced to the provider at all. */
  provider: string;
  tone: StatusTone;
}

export const STATUS_LABELS: Record<PaymentStatus, StatusLabel> = {
  DRAFT: { customer: 'Menyiapkan Pembayaran', provider: '—', tone: 'info' },
  PENDING: { customer: 'Menunggu Pembayaran', provider: '—', tone: 'warning' },
  PAID: {
    customer: 'Pembayaran Diterima, Mencari Provider',
    provider: 'Job Baru — Pembayaran Customer Sudah Aman',
    tone: 'success',
  },
  HELD: {
    customer: 'Dana Ditahan Aman — Provider Sedang Mengerjakan',
    provider: 'Sedang Dikerjakan — Dana Akan Cair Setelah Selesai',
    tone: 'info',
  },
  RELEASED: {
    customer: 'Selesai — Terima kasih!',
    provider: 'Dana Telah Dicairkan ke Rekening Anda',
    tone: 'success',
  },
  REFUND_REQUESTED: {
    customer: 'Refund Sedang Diproses',
    provider: 'Pembatalan Sedang Ditinjau',
    tone: 'warning',
  },
  REFUNDED: {
    customer: 'Dana Telah Dikembalikan',
    provider: 'Pembatalan Disetujui — Dana Dikembalikan ke Customer',
    tone: 'info',
  },
  REFUND_REJECTED: {
    customer: 'Pengajuan Refund Ditolak',
    provider: 'Pembatalan Ditolak — Pekerjaan Dilanjutkan',
    tone: 'info',
  },
  DISPUTED: {
    customer: 'Sedang Ditinjau Tim Kami (estimasi 48 jam)',
    provider: 'Ada Komplain — Tim Kami Akan Hubungi Anda',
    tone: 'warning',
  },
  EXPIRED: { customer: 'Pembayaran Kedaluwarsa', provider: '—', tone: 'danger' },
  FAILED: { customer: 'Pembayaran Gagal', provider: '—', tone: 'danger' },
};

export function customerStatusLabel(status: string): string {
  return isPaymentStatus(status) ? STATUS_LABELS[status].customer : status;
}

export function providerStatusLabel(status: string): string {
  return isPaymentStatus(status) ? STATUS_LABELS[status].provider : status;
}
