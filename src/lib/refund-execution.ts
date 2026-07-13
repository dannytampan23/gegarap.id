import prisma from '@/lib/prisma';
import { refundViaGateway, type GatewayRefundResult } from '@/lib/midtrans';
import { applyTransition, InvalidTransitionError, type PaymentStatus } from '@/lib/payment-state';

export class RefundAmountLockedError extends Error {
  constructor(
    public readonly expected: number | null,
    public readonly received: number
  ) {
    super(`Refund amount is locked at ${expected ?? 'unknown'}, received ${received}`);
  }
}

export interface ExecuteRefundInput {
  refundRequestId: string;
  paymentId: string;
  jobId: string;
  orderId: string | null;
  amount: number;
  reason: string;
  triggeredBy: string;
  resolvedById?: string;
}

/**
 * Recoverable refund saga. The payment first moves to REFUND_REQUESTED, then
 * the idempotent gateway call runs, and only a confirmed gateway result may
 * atomically finalize both Payment=REFUNDED and Job=CANCELLED.
 */
export async function executeRefund(input: ExecuteRefundInput): Promise<GatewayRefundResult> {
  await prisma.$transaction(async (tx) => {
    const request = await tx.refundRequest.findUnique({ where: { id: input.refundRequestId } });
    if (!request || request.paymentId !== input.paymentId) {
      throw new Error(`Refund request not found for payment ${input.paymentId}`);
    }
    if (request.gatewayAttemptedAt && request.amount !== input.amount) {
      throw new RefundAmountLockedError(request.amount, input.amount);
    }

    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new Error(`Payment not found: ${input.paymentId}`);
    const status = payment.status as PaymentStatus;

    if (status === 'PAID' || status === 'HELD') {
      await applyTransition(tx, {
        paymentId: input.paymentId,
        to: 'REFUND_REQUESTED',
        triggeredBy: input.triggeredBy,
        reason: input.reason,
      });
    } else if (!['REFUND_REQUESTED', 'DISPUTED', 'REFUNDED'].includes(status)) {
      throw new InvalidTransitionError(status, 'REFUNDED');
    }

    await tx.refundRequest.update({
      where: { id: input.refundRequestId },
      data: {
        amount: input.amount,
        gatewayStatus: 'PROCESSING',
        gatewayFailureReason: null,
        gatewayAttemptedAt: request.gatewayAttemptedAt ?? new Date(),
      },
    });
  });

  const gateway = await refundViaGateway({
    orderId: input.orderId,
    paymentId: input.paymentId,
    amount: input.amount,
    reason: input.reason,
  });

  if (!gateway.success) {
    await prisma.refundRequest.update({
      where: { id: input.refundRequestId },
      data: {
        status: 'PENDING_REVIEW',
        gatewayStatus: 'FAILED',
        gatewayFailureReason: gateway.failureReason?.slice(0, 1000) ?? 'unknown',
      },
    });
    return gateway;
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new Error(`Payment not found: ${input.paymentId}`);
    const status = payment.status as PaymentStatus;

    if (status !== 'REFUNDED') {
      await applyTransition(tx, {
        paymentId: input.paymentId,
        to: 'REFUNDED',
        triggeredBy: input.triggeredBy,
        reason: input.reason,
        expectedFrom: ['REFUND_REQUESTED', 'DISPUTED'],
      });
    }

    await tx.job.update({ where: { id: input.jobId }, data: { status: 'CANCELLED' } });
    await tx.refundRequest.update({
      where: { id: input.refundRequestId },
      data: {
        status: 'APPROVED',
        amount: input.amount,
        resolvedById: input.resolvedById ?? null,
        resolvedAt: new Date(),
        resolutionNote: input.reason,
        gatewayStatus: 'SUCCESS',
        gatewayRefundId: gateway.refundId ?? null,
        gatewayFailureReason: null,
      },
    });
  });

  return gateway;
}
