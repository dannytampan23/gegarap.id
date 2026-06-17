import prisma from './prisma';
import { DEFAULT_FEE_RULE, type FeeRule } from './calculations';

/** A FeeRule plus the snapshot ids to persist on the Payment. */
export interface ResolvedFee extends FeeRule {
  feeConfigId: string | null;
  campaignId: string | null;
}

/** Sentinel category for the platform-wide fallback FeeConfig row. */
export const DEFAULT_CATEGORY = 'DEFAULT';

/**
 * Pick the effective FeeConfig for a category at `now`: a category-specific row
 * wins over the DEFAULT row; among effective rows the most recent `effectiveFrom`
 * wins. A config is effective when effectiveFrom ≤ now < effectiveTo (or no end).
 */
async function pickFeeConfig(category: string, now: Date) {
  const rows = await prisma.feeConfig.findMany({
    where: {
      category: { in: [category, DEFAULT_CATEGORY] },
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return (
    rows.find((r) => r.category === category) ??
    rows.find((r) => r.category === DEFAULT_CATEGORY) ??
    null
  );
}

/**
 * Pick the first active, in-window, under-limit campaign that applies to the
 * category. A campaign with empty `eligibleCategories` applies to all.
 */
async function pickCampaign(category: string, now: Date) {
  const rows = await prisma.campaign.findMany({
    where: { active: true, startDate: { lte: now }, endDate: { gt: now } },
    orderBy: { startDate: 'desc' },
  });
  return (
    rows.find(
      (c) =>
        (c.eligibleCategories.length === 0 || c.eligibleCategories.includes(category)) &&
        (c.usageLimit == null || c.usedCount < c.usageLimit)
    ) ?? null
  );
}

/**
 * Resolve the fee rule for a category. Falls back to the DEFAULT FeeConfig row,
 * then to the hardcoded DEFAULT_FEE_RULE — so booking never breaks if FeeConfig
 * hasn't been seeded. Applies a matching campaign's fee override (fee % only).
 */
export async function resolveFee(category: string, now: Date = new Date()): Promise<ResolvedFee> {
  const [config, campaign] = await Promise.all([
    pickFeeConfig(category, now),
    pickCampaign(category, now),
  ]);

  const rule: FeeRule = config
    ? {
        platformFeePercent: config.platformFeePercent,
        dpPercent: config.dpPercent,
        minDpThresholdAmount: config.minDpThresholdAmount,
        highValueDpPercent: config.highValueDpPercent,
      }
    : { ...DEFAULT_FEE_RULE };

  return {
    ...rule,
    campaignFeePercent: campaign ? campaign.feeOverridePercent : null,
    feeConfigId: config?.id ?? null,
    campaignId: campaign?.id ?? null,
  };
}
