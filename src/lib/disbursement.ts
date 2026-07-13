import MidtransClient from 'midtrans-client';
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

/** Production-safe fallback: records a failed payout instead of inventing one. */
export class DisabledDisbursementProvider implements IDisbursementProvider {
  readonly name = 'DISABLED';
  async disburse(req: DisbursementRequest): Promise<DisbursementResult> {
    logEvent(
      'disbursement.failed',
      { provider: this.name, payoutId: req.payoutId, reason: 'provider_not_configured' },
      'error'
    );
    return {
      success: false,
      failureReason: 'Pencairan otomatis belum dikonfigurasi. Dana tetap tercatat dan ditahan.',
    };
  }
}

/**
 * Real disbursement via Midtrans Iris. Uses the Iris creator API key
 * (`MIDTRANS_IRIS_API_KEY`), separate from the Snap/Core server key. Fails
 * closed when the key is absent so funds are never silently lost.
 *
 * Approval policy (single-step vs creator/approver + OTP) is configured on the
 * Iris account; this client only *creates* the payout. A created payout that's
 * queued for approval is still a success here — the money is committed to move
 * once approved. Beneficiary mapping:
 *   - bank   → details: { bankCode|bankName, accountNumber, accountName }
 *   - gopay  → details: { phone }   (Iris e-wallet channel "gopay")
 */
export class GatewayDisbursementProvider implements IDisbursementProvider {
  readonly name = 'IRIS';

  private mapBeneficiary(req: DisbursementRequest): {
    beneficiary_name: string;
    beneficiary_account: string;
    beneficiary_bank: string;
  } | null {
    const d = req.recipient.details;
    const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : undefined);
    switch (req.recipient.method) {
      case 'bank':
        if (!str('accountNumber') || !(str('bankCode') ?? str('bankName'))) return null;
        return {
          beneficiary_name: str('accountName') ?? 'Provider',
          beneficiary_account: str('accountNumber')!,
          beneficiary_bank: (str('bankCode') ?? str('bankName'))!.toLowerCase(),
        };
      case 'gopay':
        if (!str('phone')) return null;
        return {
          beneficiary_name: str('accountName') ?? 'Provider',
          beneficiary_account: str('phone')!,
          beneficiary_bank: 'gopay',
        };
      default:
        return null; // ovo/dana not supported by Iris in this build
    }
  }

  async disburse(req: DisbursementRequest): Promise<DisbursementResult> {
    const apiKey = process.env.MIDTRANS_IRIS_API_KEY;
    if (!apiKey) {
      logEvent(
        'disbursement.failed',
        { provider: this.name, payoutId: req.payoutId, reason: 'iris_api_key_missing' },
        'error'
      );
      return {
        success: false,
        failureReason: 'Iris API key (MIDTRANS_IRIS_API_KEY) belum dikonfigurasi.',
      };
    }

    const beneficiary = this.mapBeneficiary(req);
    if (!beneficiary) {
      logEvent(
        'disbursement.failed',
        {
          provider: this.name,
          payoutId: req.payoutId,
          reason: 'unsupported_or_incomplete_payout_details',
          method: req.recipient.method,
        },
        'error'
      );
      return {
        success: false,
        failureReason: `Metode/detail payout tidak didukung Iris: ${req.recipient.method}.`,
      };
    }

    try {
      const iris = new MidtransClient.Iris({
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
        serverKey: apiKey,
      });
      const res = await iris.createPayouts({
        payouts: [
          {
            ...beneficiary,
            amount: String(req.amount), // Iris expects amount as a string
            notes: `Payout ${req.reference}`.slice(0, 100),
          },
        ],
      });
      const payouts = (res.payouts as Array<Record<string, unknown>> | undefined) ?? [];
      const externalId = (payouts[0]?.reference_no as string | undefined) ?? undefined;
      logEvent('disbursement.executed', {
        provider: this.name,
        payoutId: req.payoutId,
        amount: req.amount,
        externalId,
      });
      return { success: true, externalId };
    } catch (err) {
      const failureReason = err instanceof Error ? err.message : String(err);
      logEvent(
        'disbursement.failed',
        { provider: this.name, payoutId: req.payoutId, failureReason },
        'error'
      );
      return { success: false, failureReason };
    }
  }
}

/**
 * Select the disbursement provider. Defaults to the mock unless real
 * disbursement is explicitly enabled — so staging/dev can never accidentally
 * transfer real money.
 */
export function getDisbursementProvider(): IDisbursementProvider {
  if (process.env.DISBURSEMENT_PROVIDER === 'gateway') return new GatewayDisbursementProvider();
  if (process.env.NODE_ENV !== 'production' && process.env.DISBURSEMENT_PROVIDER !== 'disabled') {
    return new MockDisbursementProvider();
  }
  return new DisabledDisbursementProvider();
}
