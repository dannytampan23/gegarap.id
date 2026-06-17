// Refund & dispute matrix (PROMPT MASTER Bagian 7).
//
// The decision lives in ONE declarative function driven by a config object —
// never as if-else scattered across endpoints (Anti-pattern Bagian 14). The
// tunable knobs (percentages, windows, abuse threshold) are isolated in
// RefundPolicyConfig so they can move to a DB-backed config later without
// touching the decision logic.

export interface RefundPolicyConfig {
  /** Cancel before the provider engages → full refund. */
  cancelBeforeAcceptPercent: number; // 100
  /** Cancel after booking confirmed, before work starts (Bagian 7: 80–90%). */
  cancelAfterAcceptPercent: number; // 85
  /** Complaint window after the job is marked done. */
  complaintWindowHours: number; // 24
  /** Admin SLA to resolve a dispute (informational/UX). */
  adminSlaHours: number; // 48
  /** Nth refund request within the window that trips REFUND_ABUSE. */
  refundAbuseCount: number; // 4
  refundAbuseWindowDays: number; // 30
}

export const DEFAULT_REFUND_POLICY: RefundPolicyConfig = {
  cancelBeforeAcceptPercent: 100,
  cancelAfterAcceptPercent: 85,
  complaintWindowHours: 24,
  adminSlaHours: 48,
  refundAbuseCount: 4,
  refundAbuseWindowDays: 30,
};

export type RefundScenario =
  | 'NO_PAYMENT' // belum dibayar → tidak ada dana yang ditahan
  | 'BEFORE_ACCEPT' // dibayar, provider belum accept → 100%
  | 'AFTER_ACCEPT_BEFORE_START' // booking confirmed, kerja belum mulai → partial
  | 'AFTER_START' // sedang dikerjakan → wajib DISPUTED
  | 'POST_COMPLETION_WITHIN_WINDOW' // komplain ≤ window setelah selesai → DISPUTED
  | 'POST_COMPLETION_EXPIRED'; // window habis → tolak

export type RefundOutcome = 'AUTO_REFUND' | 'DISPUTE' | 'REJECT' | 'NOOP';

export interface RefundContext {
  jobStatus: string; // PENDING|CONFIRMED|IN_PROGRESS|COMPLETED|CANCELLED
  paymentStatus: string; // PaymentStatus
  /** Amount the customer has actually paid (DP) — the refundable base. */
  paidAmount: number;
  /** When the job was marked completed (drives the complaint window). */
  completedAt?: Date | null;
  now?: Date;
  /** Refund requests by this account within the abuse window. */
  recentRefundCount: number;
  policy?: RefundPolicyConfig;
}

export interface RefundDecision {
  scenario: RefundScenario;
  outcome: RefundOutcome;
  refundAmount: number; // ke customer
  providerCompensation: number; // paidAmount − refundAmount (Bagian 7)
  refundType: 'FULL' | 'PARTIAL';
  requiresAdmin: boolean;
  flagAbuse: boolean;
  reason: string;
}

function deriveScenario(ctx: RefundContext, policy: RefundPolicyConfig): RefundScenario {
  // Money not captured yet → nothing to refund.
  if (['DRAFT', 'PENDING', 'EXPIRED', 'FAILED'].includes(ctx.paymentStatus)) {
    return 'NO_PAYMENT';
  }

  switch (ctx.jobStatus) {
    case 'PENDING':
      // Paid but provider hasn't accepted yet (rare in the current flow).
      return 'BEFORE_ACCEPT';
    case 'CONFIRMED':
      return 'AFTER_ACCEPT_BEFORE_START';
    case 'IN_PROGRESS':
      return 'AFTER_START';
    case 'COMPLETED': {
      const now = ctx.now ?? new Date();
      const within =
        ctx.completedAt != null &&
        now.getTime() - ctx.completedAt.getTime() <= policy.complaintWindowHours * 3_600_000;
      return within ? 'POST_COMPLETION_WITHIN_WINDOW' : 'POST_COMPLETION_EXPIRED';
    }
    default:
      // CANCELLED or unknown → treat as expired/non-refundable.
      return 'POST_COMPLETION_EXPIRED';
  }
}

/**
 * Evaluate the refund matrix. Pure & deterministic — given the same context it
 * always returns the same decision, so it's fully unit-testable. The caller is
 * responsible for applying the resulting state transition and side effects.
 */
export function evaluateRefund(ctx: RefundContext): RefundDecision {
  const policy = ctx.policy ?? DEFAULT_REFUND_POLICY;
  const scenario = deriveScenario(ctx, policy);

  const full = (): Pick<RefundDecision, 'refundAmount' | 'providerCompensation' | 'refundType'> => ({
    refundAmount: ctx.paidAmount,
    providerCompensation: 0,
    refundType: 'FULL',
  });
  const partial = (
    pct: number
  ): Pick<RefundDecision, 'refundAmount' | 'providerCompensation' | 'refundType'> => {
    const refundAmount = Math.floor((ctx.paidAmount * pct) / 100);
    return {
      refundAmount,
      providerCompensation: ctx.paidAmount - refundAmount,
      refundType: 'PARTIAL',
    };
  };

  let decision: RefundDecision;
  switch (scenario) {
    case 'NO_PAYMENT':
      decision = {
        scenario,
        outcome: 'NOOP',
        ...full(),
        refundAmount: 0,
        requiresAdmin: false,
        flagAbuse: false,
        reason: 'Belum ada pembayaran yang ditahan — booking dapat dibatalkan tanpa refund.',
      };
      break;
    case 'BEFORE_ACCEPT':
      decision = {
        scenario,
        outcome: 'AUTO_REFUND',
        ...full(),
        requiresAdmin: false,
        flagAbuse: false,
        reason: 'Dibatalkan sebelum tukang menerima pekerjaan — refund penuh otomatis.',
      };
      break;
    case 'AFTER_ACCEPT_BEFORE_START':
      decision = {
        scenario,
        outcome: 'AUTO_REFUND',
        ...partial(policy.cancelAfterAcceptPercent),
        requiresAdmin: false,
        flagAbuse: false,
        reason: `Dibatalkan setelah booking dikonfirmasi sebelum pengerjaan dimulai — refund ${policy.cancelAfterAcceptPercent}%, sisanya kompensasi tukang.`,
      };
      break;
    case 'AFTER_START':
      decision = {
        scenario,
        outcome: 'DISPUTE',
        refundAmount: 0,
        providerCompensation: 0,
        refundType: 'FULL',
        requiresAdmin: true,
        flagAbuse: false,
        reason: `Pekerjaan sudah dimulai — tidak ada refund otomatis, ditinjau tim kami (SLA ${policy.adminSlaHours} jam).`,
      };
      break;
    case 'POST_COMPLETION_WITHIN_WINDOW':
      decision = {
        scenario,
        outcome: 'DISPUTE',
        refundAmount: 0,
        providerCompensation: 0,
        refundType: 'FULL',
        requiresAdmin: true,
        flagAbuse: false,
        reason: `Komplain dalam ${policy.complaintWindowHours} jam setelah selesai — dana ditahan, ditinjau tim kami (SLA ${policy.adminSlaHours} jam).`,
      };
      break;
    case 'POST_COMPLETION_EXPIRED':
      decision = {
        scenario,
        outcome: 'REJECT',
        refundAmount: 0,
        providerCompensation: 0,
        refundType: 'FULL',
        requiresAdmin: false,
        flagAbuse: false,
        reason: 'Masa komplain telah berakhir — refund tidak dapat diproses.',
      };
      break;
  }

  // Abuse override (Bagian 7/8): the Nth refund request in the window can no
  // longer auto-approve — it goes to manual review and is flagged.
  if (ctx.recentRefundCount + 1 >= policy.refundAbuseCount) {
    decision.flagAbuse = true;
    if (decision.outcome === 'AUTO_REFUND') {
      decision.outcome = 'DISPUTE';
      decision.requiresAdmin = true;
      decision.reason += ' (Pengajuan refund berulang — masuk peninjauan manual.)';
    }
  }

  return decision;
}
