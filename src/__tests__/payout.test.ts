import { describe, it, expect, beforeEach } from 'vitest';
import { mockPrisma } from './mocks/prisma';
import { settleProviderPayout, isPayoutEligible, MIN_PAYOUT } from '@/lib/payout';
import { MockDisbursementProvider } from '@/lib/disbursement';

describe('isPayoutEligible (KYC gate)', () => {
  it('APPROVED + metode + detail → eligible', () => {
    expect(
      isPayoutEligible({ kycStatus: 'APPROVED', payoutMethod: 'gopay', payoutDetails: { phone: '08' } })
    ).toBe(true);
  });
  it('KYC belum APPROVED → tidak eligible', () => {
    expect(
      isPayoutEligible({ kycStatus: 'PENDING', payoutMethod: 'gopay', payoutDetails: { phone: '08' } })
    ).toBe(false);
  });
  it('tanpa payout detail → tidak eligible', () => {
    expect(
      isPayoutEligible({ kycStatus: 'APPROVED', payoutMethod: 'gopay', payoutDetails: null })
    ).toBe(false);
  });
});

describe('MockDisbursementProvider', () => {
  it('selalu sukses dengan externalId (tanpa transfer nyata)', async () => {
    const res = await new MockDisbursementProvider().disburse({
      payoutId: 'po1',
      amount: 50_000,
      recipient: { method: 'gopay', details: {} },
      reference: 'ref',
    });
    expect(res.success).toBe(true);
    expect(res.externalId).toContain('po1');
  });
});

describe('settleProviderPayout', () => {
  beforeEach(() => {
    mockPrisma.payout.findFirst.mockResolvedValue(null as never);
    mockPrisma.payout.create.mockResolvedValue({ id: 'po1', status: 'SCHEDULED', amount: 90_000 } as never);
    mockPrisma.payout.update.mockResolvedValue({} as never);
    mockPrisma.$transaction.mockResolvedValue([] as never);
    mockPrisma.auditLog.create.mockResolvedValue({} as never);
  });

  it('provider belum KYC → payout SCHEDULED, tidak ada disbursement', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      providerProfileId: 'pp1',
      providerAmount: 90_000,
      platformFee: 10_000,
      midtransOrderId: 'GGR-x',
      provider: { kycStatus: 'PENDING', payoutMethod: 'gopay', payoutDetails: { phone: '08' }, user: { phone: null } },
    } as never);

    const res = await settleProviderPayout('pay1');
    expect(res.status).toBe('SCHEDULED');
    expect(res.reason).toBe('kyc_pending');
    expect(mockPrisma.payout.update).not.toHaveBeenCalled(); // never moved to PROCESSING
  });

  it('di bawah MIN_PAYOUT → ditahan SCHEDULED untuk batching', async () => {
    mockPrisma.payout.create.mockResolvedValue({ id: 'po1', status: 'SCHEDULED', amount: MIN_PAYOUT - 1 } as never);
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      providerProfileId: 'pp1',
      providerAmount: MIN_PAYOUT - 1,
      platformFee: 10_000,
      midtransOrderId: 'GGR-x',
      provider: { kycStatus: 'APPROVED', payoutMethod: 'gopay', payoutDetails: { phone: '08' }, user: { phone: null } },
    } as never);

    const res = await settleProviderPayout('pay1');
    expect(res.status).toBe('SCHEDULED');
    expect(res.reason).toBe('below_min_threshold');
  });

  it('eligible + di atas threshold → SUCCESS via mock disbursement', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      providerProfileId: 'pp1',
      providerAmount: 90_000,
      platformFee: 10_000,
      midtransOrderId: 'GGR-x',
      provider: { kycStatus: 'APPROVED', payoutMethod: 'gopay', payoutDetails: { phone: '08' }, user: { phone: null } },
    } as never);

    const res = await settleProviderPayout('pay1');
    expect(res.status).toBe('SUCCESS');
    expect(mockPrisma.payout.update).toHaveBeenCalled(); // moved to PROCESSING then SUCCESS
  });
});
