import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma';

// Notifications are now ENQUEUED to the outbox (durable, non-blocking) rather
// than sent inline; the cron dispatcher does the actual WhatsApp send. So we
// capture enqueueWhatsApp to assert who gets notified. `vi.hoisted` makes the
// mock available inside the hoisted vi.mock factory.
const { enqueueWhatsApp } = vi.hoisted(() => ({ enqueueWhatsApp: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/outbox', () => ({ __esModule: true, enqueueWhatsApp }));

import { notifyPaymentStatus } from '@/lib/notifications';

function paymentWithJob(over: Record<string, unknown> = {}) {
  return {
    id: 'pay1',
    amount: 30_000,
    providerAmount: 27_000,
    platformFee: 3_000,
    job: {
      id: 'job-ABCDEF',
      scheduledDate: null,
      customer: { name: 'Budi', phone: '628111' },
      provider: { user: { name: 'Tukang Joko', phone: '628222' } },
    },
    ...over,
  };
}

describe('notifyPaymentStatus (Bagian 9)', () => {
  beforeEach(() => {
    enqueueWhatsApp.mockClear();
  });

  it('PAID → memberi tahu customer DAN provider', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(paymentWithJob() as never);
    await notifyPaymentStatus('pay1', 'PAID');
    expect(enqueueWhatsApp).toHaveBeenCalledTimes(2);
    const targets = enqueueWhatsApp.mock.calls.map((c) => c[0]);
    expect(targets).toContain('628111');
    expect(targets).toContain('628222');
  });

  it('EXPIRED → hanya customer (provider tidak punya copy)', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(paymentWithJob() as never);
    await notifyPaymentStatus('pay1', 'EXPIRED');
    expect(enqueueWhatsApp).toHaveBeenCalledTimes(1);
    expect(enqueueWhatsApp.mock.calls[0][0]).toBe('628111');
  });

  it('RELEASED + payout SUCCESS → pesan provider menyebut dana dicairkan', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(paymentWithJob() as never);
    await notifyPaymentStatus('pay1', 'RELEASED', { settleStatus: 'SUCCESS' });
    const providerMsg = enqueueWhatsApp.mock.calls.find((c) => c[0] === '628222')?.[1] as string;
    expect(providerMsg).toMatch(/Dicairkan/i);
  });

  it('setiap pesan dibawa dengan dedupeKey idempoten', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(paymentWithJob() as never);
    await notifyPaymentStatus('pay1', 'PAID');
    const keys = enqueueWhatsApp.mock.calls.map((c) => c[2]);
    expect(keys).toContain('pay:pay1:PAID:customer');
    expect(keys).toContain('pay:pay1:PAID:provider');
  });

  it('payment tidak ditemukan → tidak throw, tidak kirim', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null as never);
    await expect(notifyPaymentStatus('missing', 'PAID')).resolves.toBeUndefined();
    expect(enqueueWhatsApp).not.toHaveBeenCalled();
  });

  it('hanya kirim ke pihak yang punya nomor telepon', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(
      paymentWithJob({
        job: {
          id: 'job-ABCDEF',
          scheduledDate: null,
          customer: { name: 'Budi', phone: null },
          provider: { user: { name: 'Joko', phone: '628222' } },
        },
      }) as never
    );
    await notifyPaymentStatus('pay1', 'PAID');
    expect(enqueueWhatsApp).toHaveBeenCalledTimes(1);
    expect(enqueueWhatsApp.mock.calls[0][0]).toBe('628222');
  });
});
