/**
 * Advisory fraud scoring for AI search results (System 4). Scores a provider in
 * [0,1] from cheap, structural signals (price vs market, suspiciously-perfect
 * rating on thin reviews, brand-new + already-highly-rated). Heuristic only — it
 * gates VISIBILITY in the assistant, it is not an authoritative account action.
 *
 *  - score >= 0.5  → excluded from results entirely
 *  - 0.3 .. 0.49   → shown with a "Baru bergabung" caution badge
 *  - < 0.3         → shown normally
 */

/** Rough market reference for a daily rate (Rupiah). */
const MARKET_AVG_PRICE = 150_000;

export interface FraudSignalInput {
  /** Daily rate in whole Rupiah (the provider's price ceiling proxy). */
  dailyRate: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
}

export const FRAUD_EXCLUDE_THRESHOLD = 0.5;
export const FRAUD_BADGE_THRESHOLD = 0.3;

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / 86_400_000;
}

/** Compute the advisory fraud score for a provider. Never throws. */
export function calculateFraudScore(p: FraudSignalInput): number {
  let score = 0;

  // Implausibly cheap (< 50% of market) — classic bait pricing.
  if (p.dailyRate > 0 && p.dailyRate < MARKET_AVG_PRICE * 0.5) score += 0.4;

  // A perfect rating off very few reviews is easy to fake.
  if (p.rating >= 5.0 && p.ratingCount < 5) score += 0.3;

  // Brand-new account that already shows a high rating.
  if (daysSince(p.createdAt) < 30 && p.rating > 4.5) score += 0.3;

  return Math.min(score, 1);
}

/** Map a score to its display treatment. */
export function fraudBadge(score: number): 'baru' | null {
  return score >= FRAUD_BADGE_THRESHOLD && score < FRAUD_EXCLUDE_THRESHOLD ? 'baru' : null;
}
