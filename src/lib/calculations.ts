import { SITE } from './site';

/** Absolute DP floor in Rupiah — a percentage DP is never charged below this. */
export const MINIMUM_DP = SITE.minimumDp; // Rp 20.000

/**
 * A resolved fee rule applied to one booking. These are percentages/thresholds
 * snapshotted from FeeConfig (+ an optional Campaign override) at booking time —
 * the Payment stores the FeeConfig id it used so later config changes never
 * rewrite history. NEVER hardcode fee numbers outside of FeeConfig/DEFAULT_FEE_RULE.
 */
export interface FeeRule {
  platformFeePercent: number; // mis. 10 = 10%
  dpPercent: number; // mis. 30 = 30%
  minDpThresholdAmount: number; // subtotal di atas ini → DP dinaikkan (0 = nonaktif)
  highValueDpPercent: number; // mis. 50 = 50% untuk job bernilai besar
  /** Campaign override of the platform fee ONLY (never the DP / provider share). */
  campaignFeePercent?: number | null;
}

/** Fallback used before any FeeConfig row exists, and for client-side estimates. */
export const DEFAULT_FEE_RULE: FeeRule = {
  platformFeePercent: 10,
  dpPercent: 30,
  minDpThresholdAmount: 2_000_000,
  highValueDpPercent: 50,
};

export interface BookingFinancials {
  dailyRate: number;
  estimatedDays: number;
  subtotal: number; // dailyRate × estimatedDays (= totalAmount)
  dpPercentApplied: number; // 30 atau 50 (high-value)
  dpAmount: number; // DP yang ditagih di muka
  remainingAmount: number; // subtotal − dpAmount, ditagih saat selesai
  platformFeePercentApplied: number; // fee % efektif (termasuk campaign)
  platformFee: number; // floor(subtotal × fee%)
  providerEarnings: number; // subtotal − platformFee (= providerAmount)
  totalAmount: number; // = subtotal
}

/**
 * The single source of truth for every money calculation in the app.
 *
 * Fee model (PROMPT MASTER Bagian 6): percentage-based, configurable per
 * category via FeeConfig. DP defaults to `dpPercent`, bumped to
 * `highValueDpPercent` once the subtotal exceeds `minDpThresholdAmount`.
 *
 * All money is integer Rupiah. `platformFee` is floored, and
 * `providerEarnings = subtotal − platformFee`, so the two always sum to exactly
 * the subtotal (no Rupiah lost) and the provider is never short-changed by
 * rounding. A Campaign overrides only the fee percent — never the DP or the
 * provider's share — so a promo can never cost the provider money.
 */
export function calculateBookingFinancials(
  dailyRate: number,
  estimatedDays: number,
  rule: FeeRule = DEFAULT_FEE_RULE,
  dpInput?: number
): BookingFinancials {
  if (dailyRate <= 0) throw new Error('dailyRate harus lebih dari 0');
  if (estimatedDays <= 0) throw new Error('estimatedDays harus lebih dari 0');

  const subtotal = Math.round(dailyRate * estimatedDays);

  // DP percentage — bump to the high-value rate above the threshold.
  const dpPercentApplied =
    rule.minDpThresholdAmount > 0 && subtotal > rule.minDpThresholdAmount
      ? rule.highValueDpPercent
      : rule.dpPercent;

  // Configured DP, clamped to [MINIMUM_DP, subtotal]. A caller may pay MORE
  // upfront via dpInput, but never less than the configured/minimum DP.
  const configuredDp = Math.floor((subtotal * dpPercentApplied) / 100);
  const dpAmount = Math.min(subtotal, Math.max(configuredDp, MINIMUM_DP, dpInput ?? 0));
  const remainingAmount = subtotal - dpAmount;

  // Platform fee — campaign overrides only the percent.
  const platformFeePercentApplied = rule.campaignFeePercent ?? rule.platformFeePercent;
  const platformFee = Math.floor((subtotal * platformFeePercentApplied) / 100);
  const providerEarnings = subtotal - platformFee;

  return {
    dailyRate,
    estimatedDays,
    subtotal,
    dpPercentApplied,
    dpAmount,
    remainingAmount,
    platformFeePercentApplied,
    platformFee,
    providerEarnings,
    totalAmount: subtotal,
  };
}

/** Whether a down payment meets the absolute minimum required to confirm. */
export function isDpValid(dpAmount: number): boolean {
  return dpAmount >= MINIMUM_DP;
}
