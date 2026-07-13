import MidtransClient from 'midtrans-client';
import { logEvent, logAlert, notifyOps } from './logger';
import { withRetry } from './retry';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey =
  process.env.MIDTRANS_CLIENT_KEY ?? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '';

/** Whether real Midtrans credentials are present. */
export const isMidtransConfigured = Boolean(serverKey);

function snapClient() {
  return new MidtransClient.Snap({ isProduction, serverKey: serverKey!, clientKey });
}

function coreClient() {
  return new MidtransClient.CoreApi({ isProduction, serverKey: serverKey!, clientKey });
}

// ─── Typed gateway errors ────────────────────────────────────────────────────
// Distinguishing the two lets callers react correctly: a TRANSIENT outage can
// fall back to manual transfer / be retried; a PERMANENT request error is our
// bug (bad payload, invalid key) and must surface, not silently fall back.

/** The gateway was unreachable/erroring after all retries (network, 5xx, 429). */
export class MidtransUnavailableError extends Error {
  readonly code = 'MIDTRANS_UNAVAILABLE';
  readonly httpStatus = 503;
  readonly transient = true;
  constructor(message = 'Gateway pembayaran sedang tidak tersedia.') {
    super(message);
    this.name = 'MidtransUnavailableError';
  }
}

/** The gateway rejected the request (4xx) — invalid payload/keys. Not retried. */
export class MidtransRequestError extends Error {
  readonly code = 'MIDTRANS_REQUEST_REJECTED';
  readonly httpStatus = 502;
  readonly transient = false;
  constructor(message = 'Permintaan ke gateway pembayaran ditolak.') {
    super(message);
    this.name = 'MidtransRequestError';
  }
}

/** Read the HTTP status off a midtrans-client error (it sets `httpStatusCode`). */
function midtransHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'httpStatusCode' in err) {
    const code = Number((err as { httpStatusCode?: unknown }).httpStatusCode);
    return Number.isFinite(code) ? code : undefined;
  }
  return undefined;
}

/** Transient = worth retrying: no HTTP status (network), 429, or any 5xx. */
export function isTransientMidtransError(err: unknown): boolean {
  const status = midtransHttpStatus(err);
  if (status === undefined) return true; // network / DNS / timeout
  if (status === 429) return true; // rate limited
  return status >= 500; // gateway-side error
}

/** Map a raw gateway/network error to one of our typed errors. */
function toMidtransError(err: unknown): MidtransUnavailableError | MidtransRequestError {
  const msg = err instanceof Error ? err.message : String(err);
  return isTransientMidtransError(err)
    ? new MidtransUnavailableError(msg)
    : new MidtransRequestError(msg);
}

// ─── Payment channels ────────────────────────────────────────────────────────
// ⚠️ ROOT CAUSE of "No payment channels available": Snap shows the channels that
// are ACTIVE for your merchant account (Dashboard → Settings → Snap Preferences /
// Payment Methods) AND that match the request. Two failure modes to avoid:
//   1. Sending `enabled_payments: []` — an EMPTY array hides every channel.
//   2. Sending a channel name your account hasn't activated.
// So by default we OMIT `enabled_payments` entirely (Snap auto-detects all active
// channels). `MIDTRANS_ENABLED_PAYMENTS` is an opt-in override for when you need
// to force a curated list.

/** Curated channel set used when MIDTRANS_ENABLED_PAYMENTS=default. */
export const DEFAULT_ENABLED_PAYMENTS = [
  'gopay',
  'shopeepay',
  'other_qris',
  'bca_va',
  'bni_va',
  'bri_va',
  'permata_va',
  'indomaret',
  'alfamart',
] as const;

/**
 * Resolve the optional channel allow-list from env.
 *  - unset / "all"  → undefined (omit the field → Snap shows ALL active channels)
 *  - "default"      → the curated DEFAULT_ENABLED_PAYMENTS list
 *  - "a,b,c"        → that explicit list
 * Never returns an empty array (the cause of "no channels"); an empty/blank
 * config collapses to undefined (auto-detect).
 */
export function configuredEnabledPayments(): string[] | undefined {
  const raw = process.env.MIDTRANS_ENABLED_PAYMENTS?.trim();
  if (!raw || raw.toLowerCase() === 'all') return undefined;
  if (raw.toLowerCase() === 'default') return [...DEFAULT_ENABLED_PAYMENTS];
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

export interface SnapResult {
  token: string;
  redirectUrl: string;
  /** True when this is a local dev stand-in, not a real Midtrans transaction. */
  mock: boolean;
}

/**
 * Create a Snap token for a DP payment.
 *
 * Resilient: the gateway call is retried with exponential backoff on transient
 * failures. On exhaustion it throws `MidtransUnavailableError` (callers may fall
 * back to manual transfer); a 4xx rejection throws `MidtransRequestError`.
 */
export async function createSnapToken(params: {
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  description: string;
}): Promise<SnapResult> {
  // Dev fallback: without server keys we return a mock token so the booking
  // flow is fully testable locally. The UI treats `mock-` tokens as instant
  // success (no Snap popup). In production, missing keys is a hard error.
  if (!isMidtransConfigured) {
    if (!isProduction) {
      return { token: `mock-${params.orderId}`, redirectUrl: '#', mock: true };
    }
    throw new Error('Midtrans belum dikonfigurasi (MIDTRANS_SERVER_KEY kosong).');
  }

  const enabledPayments = configuredEnabledPayments();
  const payload: Record<string, unknown> = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount,
    },
    customer_details: {
      first_name: params.customerName,
      phone: params.customerPhone,
      ...(params.customerEmail ? { email: params.customerEmail } : {}),
    },
    // item_details MUST sum to gross_amount or Midtrans rejects the request.
    item_details: [
      {
        id: 'DP_BOOKING',
        price: params.amount,
        quantity: 1,
        name: params.description.slice(0, 50),
      },
    ],
    // 3DS on for card payments (required for production card acceptance).
    credit_card: { secure: true },
    callbacks: {
      finish: `${process.env.APP_URL ?? ''}/dashboard`,
    },
    // Only include the allow-list when explicitly configured — NEVER send [].
    ...(enabledPayments ? { enabled_payments: enabledPayments } : {}),
  };

  try {
    const transaction = await withRetry(() => snapClient().createTransaction(payload), {
      label: 'midtrans.snap.create',
      isRetryable: isTransientMidtransError,
    });
    return { token: transaction.token, redirectUrl: transaction.redirect_url, mock: false };
  } catch (err) {
    const mapped = toMidtransError(err);
    logAlert('MIDTRANS_SNAP_CREATE_FAILED', {
      order_id: params.orderId,
      transient: mapped.transient,
      httpStatus: midtransHttpStatus(err),
      error: mapped.message,
    });
    throw mapped;
  }
}

/** Fetch a transaction's status from Midtrans (used to reconcile webhooks). */
export async function getTransactionStatus(orderId: string) {
  return withRetry(() => coreClient().transaction.status(orderId), {
    label: 'midtrans.core.status',
    isRetryable: isTransientMidtransError,
  });
}

// ─── Refund (return money to customer) — PROMPT MASTER Bagian 7 ──────────────

export interface GatewayRefundInput {
  /** Midtrans order id (externalId). Null/mock → no real refund to make. */
  orderId: string | null;
  paymentId: string;
  amount: number; // integer Rupiah
  reason: string;
}

export interface GatewayRefundResult {
  success: boolean;
  /** True when there was nothing to call (dev/mock or no order id). */
  skipped: boolean;
  refundId?: string;
  failureReason?: string;
}

/**
 * Ask the gateway to return money to the customer. Without real credentials
 * (dev/mock) it is a logged no-op so the refund flow stays testable.
 *
 * Callers keep the Payment in REFUND_REQUESTED until this confirms success.
 * Failures raise an ops alert and remain retryable through the stable refund key.
 * The function itself never throws.
 */
export async function refundViaGateway(input: GatewayRefundInput): Promise<GatewayRefundResult> {
  if (!isMidtransConfigured || !input.orderId) {
    const productionFailure = process.env.NODE_ENV === 'production';
    logEvent('refund.gateway', {
      paymentId: input.paymentId,
      amount: input.amount,
      skipped: true,
      reason: !input.orderId ? 'no_order_id' : 'midtrans_not_configured',
    });
    return productionFailure
      ? { success: false, skipped: true, failureReason: 'Gateway refund tidak lengkap.' }
      : { success: true, skipped: true };
  }

  // A stable refund_key makes the gateway call itself idempotent, so a retry
  // after a transient failure can't double-refund.
  const refundKey = `rf-${input.paymentId}`;
  try {
    const res = await withRetry(
      () =>
        coreClient().transaction.refund(input.orderId!, {
          refund_key: refundKey,
          amount: input.amount,
          reason: input.reason,
        }),
      { label: 'midtrans.core.refund', isRetryable: isTransientMidtransError }
    );
    const refundId =
      (res.refund_key as string | undefined) ?? (res.transaction_id as string | undefined);
    logEvent('refund.gateway', {
      paymentId: input.paymentId,
      order_id: input.orderId,
      amount: input.amount,
      refundId,
      status: res.status_code,
    });
    return { success: true, skipped: false, refundId };
  } catch (err) {
    const failureReason = err instanceof Error ? err.message : String(err);
    logAlert('GATEWAY_REFUND_FAILED', {
      paymentId: input.paymentId,
      order_id: input.orderId,
      amount: input.amount,
      failureReason,
    });
    await notifyOps('GATEWAY_REFUND_FAILED', {
      paymentId: input.paymentId,
      order_id: input.orderId,
      amount: input.amount,
      failureReason,
    });
    return { success: false, skipped: false, failureReason };
  }
}
