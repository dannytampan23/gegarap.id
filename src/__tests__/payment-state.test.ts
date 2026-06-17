import { describe, it, expect } from 'vitest';
import type { Prisma } from '@prisma/client';
import { mockPrisma } from './mocks/prisma';
import {
  applyTransition,
  canTransition,
  isTerminal,
  isPaymentStatus,
  customerStatusLabel,
  providerStatusLabel,
  STATUS_LABELS,
  PAYMENT_STATUSES,
  InvalidTransitionError,
  PaymentNotFoundError,
} from '@/lib/payment-state';

const db = mockPrisma as unknown as Prisma.TransactionClient;

describe('canTransition (legal-transition map)', () => {
  it('izinkan PENDING → PAID', () => expect(canTransition('PENDING', 'PAID')).toBe(true));
  it('izinkan PAID → HELD', () => expect(canTransition('PAID', 'HELD')).toBe(true));
  it('izinkan HELD → RELEASED', () => expect(canTransition('HELD', 'RELEASED')).toBe(true));
  it('TOLAK out-of-order PAID → FAILED', () =>
    expect(canTransition('PAID', 'FAILED')).toBe(false));
  it('TOLAK dari terminal RELEASED', () => expect(canTransition('RELEASED', 'REFUNDED')).toBe(false));
});

describe('isTerminal', () => {
  it('RELEASED/REFUNDED/EXPIRED/FAILED terminal', () => {
    expect(isTerminal('RELEASED')).toBe(true);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(isTerminal('FAILED')).toBe(true);
  });
  it('PAID/HELD bukan terminal', () => {
    expect(isTerminal('PAID')).toBe(false);
    expect(isTerminal('HELD')).toBe(false);
  });
});

describe('status labels (Bagian 9)', () => {
  it('setiap status punya label customer & provider', () => {
    for (const s of PAYMENT_STATUSES) {
      expect(STATUS_LABELS[s].customer.length).toBeGreaterThan(0);
      expect(STATUS_LABELS[s].provider.length).toBeGreaterThan(0);
    }
  });
  it('tidak membocorkan status mentah ke customer', () => {
    expect(customerStatusLabel('HELD')).not.toBe('HELD');
    expect(customerStatusLabel('PENDING')).toBe('Menunggu Pembayaran');
  });
  it('PENDING tidak ditampilkan ke provider', () => {
    expect(providerStatusLabel('PENDING')).toBe('—');
  });
  it('status tak dikenal dikembalikan apa adanya', () => {
    expect(customerStatusLabel('WHATEVER')).toBe('WHATEVER');
    expect(isPaymentStatus('WHATEVER')).toBe(false);
  });
});

describe('applyTransition', () => {
  it('happy path PENDING → PAID menulis PaymentEvent', async () => {
    mockPrisma.payment.findUnique
      .mockResolvedValueOnce({ id: 'p1', status: 'PENDING' } as never)
      .mockResolvedValueOnce({ id: 'p1', status: 'PAID' } as never);
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'evt1' } as never);

    const res = await applyTransition(db, {
      paymentId: 'p1',
      to: 'PAID',
      triggeredBy: 'WEBHOOK',
      reason: 'settlement',
    });

    expect(res.changed).toBe(true);
    expect(mockPrisma.paymentEvent.create).toHaveBeenCalledOnce();
    expect(mockPrisma.paymentEvent.create.mock.calls[0][0].data).toMatchObject({
      fromStatus: 'PENDING',
      toStatus: 'PAID',
      triggeredBy: 'WEBHOOK',
    });
  });

  it('idempotent: target == current → no-op tanpa event', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({ id: 'p1', status: 'PAID' } as never);

    const res = await applyTransition(db, { paymentId: 'p1', to: 'PAID', triggeredBy: 'WEBHOOK' });

    expect(res.changed).toBe(false);
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.paymentEvent.create).not.toHaveBeenCalled();
  });

  it('out-of-order PAID → FAILED ditolak (tidak override)', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({ id: 'p1', status: 'PAID' } as never);

    await expect(
      applyTransition(db, { paymentId: 'p1', to: 'FAILED', triggeredBy: 'WEBHOOK' })
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('payment tidak ditemukan → PaymentNotFoundError', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce(null as never);
    await expect(
      applyTransition(db, { paymentId: 'nope', to: 'PAID', triggeredBy: 'SYSTEM' })
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });
});
