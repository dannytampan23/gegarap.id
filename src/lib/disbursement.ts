import { logEvent } from './logger';

// Disbursement abstraction (PROMPT MASTER Bagian 6). The real money transfer to
// a provider goes through a gateway (Midtrans Iris / Xendit Disbursement). It's
// behind an interface so tests and dev/staging can run the full flow WITHOUT
// actually moving money.

export interface DisbursementRequest {
  payoutId: string;
  amount: number; // integer Rupiah
  /** Provider payout target — e.g. { method: 'gopay', details: { phone } }. */
  recipient: { method: string; details: Record<string, unknown> };
  /** Idempotency / reconciliation reference (e.g. the payment/order id). */
  reference: string;
}

export interface DisbursementResult {
  success: boolean;
  externalId?: string;
  failureReason?: string;
}

export interface IDisbursementProvider {
  readonly name: string;
  disburse(req: DisbursementRequest): Promise<DisbursementResult>;
}

/**
 * Dev/test provider — never touches a real gateway. Succeeds deterministically
 * with a fake external id so the whole release→payout flow is testable.
 */
export class MockDisbursementProvider implements IDisbursementProvider {
  readonly name = 'MOCK';
  async disburse(req: DisbursementRequest): Promise<DisbursementResult> {
    logEvent('disbursement.executed', {
      provider: this.name,
      payoutId: req.payoutId,
      amount: req.amount,
      mock: true,
    });
    return { success: true, externalId: `mock-disb-${req.payoutId}` };
  }
}

/**
 * Placeholder for the real gateway provider. Wire up Midtrans Iris / Xendit here
 * when going live; until then it fails closed so funds are never silently lost.
 */
export class GatewayDisbursementProvider implements IDisbursementProvider {
  readonly name = 'GATEWAY';
  async disburse(req: DisbursementRequest): Promise<DisbursementResult> {
    logEvent(
      'disbursement.failed',
      { provider: this.name, payoutId: req.payoutId, reason: 'not implemented' },
      'error'
    );
    return { success: false, failureReason: 'Gateway disbursement belum dikonfigurasi.' };
  }
}

/**
 * Select the disbursement provider. Defaults to the mock unless real
 * disbursement is explicitly enabled — so staging/dev can never accidentally
 * transfer real money.
 */
export function getDisbursementProvider(): IDisbursementProvider {
  if (process.env.DISBURSEMENT_PROVIDER === 'gateway') return new GatewayDisbursementProvider();
  return new MockDisbursementProvider();
}
