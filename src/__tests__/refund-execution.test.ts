import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma';

const gatewayMocks = vi.hoisted(() => ({ refundViaGateway: vi.fn() }));

vi.mock('@/lib/midtrans', () => ({
  refundViaGateway: gatewayMocks.refundViaGateway,
}));

import { executeRefund, RefundAmountLockedError } from '@/lib/refund-execution';

const input = {
  refundRequestId: 'rr1',
  paymentId: 'pay1',
  jobId: 'job1',
  orderId: 'GGR-1',
  amount: 50_000,
  reason: 'approved refund',
  triggeredBy: 'admin1',
  resolvedById: 'admin1',
};

describe('executeRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn) =>
      (fn as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma)
    );
    mockPrisma.refundRequest.findUnique.mockResolvedValue({
      id: 'rr1',
      paymentId: 'pay1',
      amount: 50_000,
      gatewayAttemptedAt: null,
    } as never);
    mockPrisma.refundRequest.update.mockResolvedValue({ id: 'rr1' } as never);
  });

  it('finalizes payment and job only after the gateway confirms success', async () => {
    mockPrisma.payment.findUnique
      .mockResolvedValueOnce({ id: 'pay1', jobId: 'job1', status: 'REFUND_REQUESTED' } as never)
      .mockResolvedValueOnce({ id: 'pay1', jobId: 'job1', status: 'REFUND_REQUESTED' } as never)
      .mockResolvedValueOnce({ id: 'pay1', jobId: 'job1', status: 'REFUND_REQUESTED' } as never)
      .mockResolvedValueOnce({ id: 'pay1', jobId: 'job1', status: 'REFUNDED' } as never);
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'evt1' } as never);
    mockPrisma.job.update.mockResolvedValue({ id: 'job1', status: 'CANCELLED' } as never);
    gatewayMocks.refundViaGateway.mockResolvedValue({
      success: true,
      skipped: false,
      refundId: 'rf-pay1',
    });

    const result = await executeRefund(input);

    expect(result.success).toBe(true);
    expect(gatewayMocks.refundViaGateway.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.job.update.mock.invocationCallOrder[0]
    );
    expect(mockPrisma.refundRequest.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', gatewayStatus: 'SUCCESS' }),
      })
    );
  });

  it('keeps the refund pending and does not cancel the job when the gateway fails', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      id: 'pay1',
      jobId: 'job1',
      status: 'REFUND_REQUESTED',
    } as never);
    gatewayMocks.refundViaGateway.mockResolvedValue({
      success: false,
      skipped: false,
      failureReason: 'gateway unavailable',
    });

    const result = await executeRefund(input);

    expect(result.success).toBe(false);
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
    expect(mockPrisma.refundRequest.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_REVIEW', gatewayStatus: 'FAILED' }),
      })
    );
  });

  it('does not allow a retried idempotency key to change the refund amount', async () => {
    mockPrisma.refundRequest.findUnique.mockResolvedValue({
      id: 'rr1',
      paymentId: 'pay1',
      amount: 40_000,
      gatewayAttemptedAt: new Date(),
    } as never);

    await expect(executeRefund(input)).rejects.toBeInstanceOf(RefundAmountLockedError);
    expect(gatewayMocks.refundViaGateway).not.toHaveBeenCalled();
  });
});
