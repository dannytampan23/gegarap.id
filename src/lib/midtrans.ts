import { randomUUID } from 'node:crypto';
import MidtransClient from 'midtrans-client';
import { logEvent, logAlert, notifyOps } from './logger';

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

export interface SnapResult {
  token: string;
  redirectUrl: string;
  /** True when this is a local dev stand-in, not a real Midtrans transaction. */
  mock: boolean;
}

/** Create a Snap token for a DP payment. */
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

  const transaction = await snapClient().createTransaction({
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount,
    },
    customer_details: {
      first_name: params.customerName,
      phone: params.customerPhone,
      ...(params.customerEmail ? { email: params.customerEmail } : {}),
    },
    item_details: [
      {
        id: 'DP_BOOKING',
        price: params.amount,
        quantity: 1,
        name: params.description.slice(0, 50),
      },
    ],
    callbacks: {
      finish: `${process.env.APP_URL ?? ''}/dashboard`,
    },
  });

  return { token: transaction.token, redirectUrl: transaction.redirect_url, mock: false };
}

/** Fetch a transaction's status from Midtrans (used to reconcile webhooks). */
export async function getTransactionStatus(orderId: string) {
  return coreClient().transaction.status(orderId);
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
 * IMPORTANT: callers move the Payment to REFUNDED in the DB first; if the gateway
 * call then FAILS we have a DB-vs-gateway mismatch, so we raise the highest
 * alarm + page ops (Bagian 10) for manual settlement rather than silently
 * swallowing it. The function itself never throws.
 */
export async function refundViaGateway(input: GatewayRefundInput): Promise<GatewayRefundResult> {
  if (!isMidtransConfigured || !input.orderId) {
    logEvent('refund.gateway', {
      paymentId: input.paymentId,
      amount: input.amount,
      skipped: true,
      reason: !input.orderId ? 'no_order_id' : 'midtrans_not_configured',
    });
    return { success: true, skipped: true };
  }

  try {
    const res = await coreClient().transaction.refund(input.orderId, {
      refund_key: `rf-${input.paymentId}-${randomUUID().slice(0, 8)}`,
      amount: input.amount,
      reason: input.reason,
    });
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
