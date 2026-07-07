/**
 * Payment repository — the ONLY place that knows how to query the Payment table
 * (Clean Architecture: data access isolated from business logic).
 *
 * Services/route-handlers call these named methods instead of inlining Prisma
 * queries, so the query shapes (especially the deep includes) live in one place
 * and the rest of the code stays persistence-agnostic. Writes that must be part
 * of a state transition stay in `lib/payment-state` (the domain layer) so the
 * append-only PaymentEvent audit is never bypassed.
 */

import prisma from '../prisma';

/** The booking-replay include: payment + its job + provider display name. */
const withJobAndProvider = {
  job: { include: { provider: { select: { user: { select: { name: true } } } } } },
} as const;

export const paymentRepository = {
  /** Look up a payment by its Midtrans order id (external reference). */
  findByOrderId(orderId: string) {
    return prisma.payment.findUnique({ where: { midtransOrderId: orderId } });
  },

  /**
   * Look up a payment by idempotency key, with the job + provider name eagerly
   * loaded — used to rebuild a booking result on an idempotent replay.
   */
  findByIdempotencyKey(key: string) {
    return prisma.payment.findUnique({
      where: { idempotencyKey: key },
      include: withJobAndProvider,
    });
  },
};

export type PaymentWithJob = NonNullable<
  Awaited<ReturnType<typeof paymentRepository.findByIdempotencyKey>>
>;
