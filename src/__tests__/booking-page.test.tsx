import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma';

const resolveFee = vi.hoisted(() => vi.fn());

vi.mock('@/lib/fee-config', () => ({ resolveFee }));
vi.mock('@/app/(customer)/book/[id]/BookingForm', () => ({ default: () => null }));
vi.mock('@/components/payments/MidtransSnapScript', () => ({
  MidtransSnapScript: () => null,
}));

import BookingPage from '@/app/(customer)/book/[id]/page';

describe('Booking page', () => {
  beforeEach(() => {
    resolveFee.mockReset();
  });

  it('awaits dynamic params before querying the provider', async () => {
    const providerId = 'provider-123';

    mockPrisma.providerProfile.findUnique.mockResolvedValue({
      id: providerId,
      category: 'Tukang Ledeng',
      dailyRate: 150_000,
      rating: 4.9,
      ratingCount: 132,
      isVerified: true,
      available: true,
      user: { name: 'Budi Santoso' },
    } as never);
    resolveFee.mockResolvedValue({
      platformFeePercent: 10,
      dpPercent: 30,
      minDpThresholdAmount: 1_000_000,
      highValueDpPercent: 50,
      campaignFeePercent: null,
      feeConfigId: null,
      campaignId: null,
    });

    await BookingPage({ params: Promise.resolve({ id: providerId }) });

    expect(mockPrisma.providerProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: providerId } })
    );
    expect(resolveFee).toHaveBeenCalledWith('Tukang Ledeng');
  });
});
