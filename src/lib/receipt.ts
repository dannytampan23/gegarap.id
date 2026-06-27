/**
 * Receipt (nota) data builder — the single source of truth for the payment
 * receipt, shared by the receipt page, the PDF route, and the email sender so
 * the three never drift. HTTP-agnostic: callers pass a job id and get a typed
 * snapshot (or null if the job/payment doesn't exist).
 *
 * Money fields are whole Rupiah integers, consistent with the Job/Payment models.
 */

import prisma from './prisma';

export interface ReceiptData {
  jobId: string;
  /** Short booking ref shown to users, e.g. "5F237D". */
  shortId: string;
  /** Midtrans order id — the "No. Transaksi" on the nota. */
  orderId: string | null;
  paidAt: Date | null;
  /** Humanised payment method, e.g. "GoPay", "Transfer Bank". */
  paymentMethod: string | null;
  paymentStatus: string;
  isPaid: boolean;

  // Booking detail
  providerName: string;
  category: string;
  description: string;
  address: string;
  district: string;
  scheduledDate: Date | null;
  timeSlot: string;
  estimatedDays: number;

  // Money (whole Rupiah)
  totalFee: number;
  dpAmount: number;
  remaining: number;
  dpPercent: number;

  // Customer (recipient of the email / owner check)
  customerId: string;
  customerName: string;
  customerEmail: string;
}

/** Turn Midtrans' raw payment_type into something a customer recognises. */
function humanisePaymentMethod(type: string | null): string | null {
  if (!type) return null;
  const map: Record<string, string> = {
    gopay: 'GoPay',
    shopeepay: 'ShopeePay',
    qris: 'QRIS',
    bank_transfer: 'Transfer Bank (Virtual Account)',
    echannel: 'Mandiri Bill',
    credit_card: 'Kartu Kredit',
    cstore: 'Gerai Retail',
    bca_klikpay: 'BCA KlikPay',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the receipt snapshot for a booking. Returns null when the job or its
 * payment is missing. Does NOT enforce ownership — callers (page/PDF route) must
 * check `data.customerId` against the session.
 */
export async function getReceiptData(jobId: string): Promise<ReceiptData | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      payment: true,
      customer: { select: { name: true, email: true } },
      provider: { select: { category: true, user: { select: { name: true } } } },
    },
  });
  if (!job || !job.payment) return null;

  const p = job.payment;
  const remaining = Math.max(0, job.totalFee - job.dpAmount);
  const dpPercent = job.totalFee > 0 ? Math.round((job.dpAmount / job.totalFee) * 100) : 0;

  return {
    jobId: job.id,
    shortId: job.id.slice(-6).toUpperCase(),
    orderId: p.midtransOrderId,
    paidAt: p.paidAt,
    paymentMethod: humanisePaymentMethod(p.midtransPaymentType),
    paymentStatus: p.status,
    isPaid: p.status === 'PAID' || p.status === 'HELD' || p.status === 'RELEASED',

    providerName: job.provider.user.name,
    category: job.provider.category,
    description: job.description ?? '',
    address: job.customerAddress,
    district: job.district ?? '',
    scheduledDate: job.scheduledDate,
    timeSlot: job.timeSlot ?? '',
    estimatedDays: job.estimatedDays,

    totalFee: job.totalFee,
    dpAmount: job.dpAmount,
    remaining,
    dpPercent,

    customerId: job.customerId,
    customerName: job.customer.name,
    customerEmail: job.customer.email,
  };
}
