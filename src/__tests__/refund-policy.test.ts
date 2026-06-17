import { describe, it, expect } from 'vitest';
import { evaluateRefund } from '@/lib/refund-policy';

const base = {
  paidAmount: 100_000,
  recentRefundCount: 0,
};

describe('evaluateRefund (matrix Bagian 7)', () => {
  it('belum bayar → NOOP, tidak ada refund', () => {
    const d = evaluateRefund({ ...base, jobStatus: 'PENDING', paymentStatus: 'PENDING' });
    expect(d.scenario).toBe('NO_PAYMENT');
    expect(d.outcome).toBe('NOOP');
    expect(d.refundAmount).toBe(0);
  });

  it('sebelum tukang accept → refund 100% otomatis', () => {
    const d = evaluateRefund({ ...base, jobStatus: 'PENDING', paymentStatus: 'PAID' });
    expect(d.scenario).toBe('BEFORE_ACCEPT');
    expect(d.outcome).toBe('AUTO_REFUND');
    expect(d.refundAmount).toBe(100_000);
    expect(d.refundType).toBe('FULL');
    expect(d.requiresAdmin).toBe(false);
  });

  it('setelah confirmed sebelum mulai → refund parsial 85%, sisanya kompensasi tukang', () => {
    const d = evaluateRefund({ ...base, jobStatus: 'CONFIRMED', paymentStatus: 'PAID' });
    expect(d.scenario).toBe('AFTER_ACCEPT_BEFORE_START');
    expect(d.outcome).toBe('AUTO_REFUND');
    expect(d.refundAmount).toBe(85_000);
    expect(d.providerCompensation).toBe(15_000);
    expect(d.refundType).toBe('PARTIAL');
  });

  it('setelah pekerjaan dimulai → DISPUTED (admin)', () => {
    const d = evaluateRefund({ ...base, jobStatus: 'IN_PROGRESS', paymentStatus: 'HELD' });
    expect(d.scenario).toBe('AFTER_START');
    expect(d.outcome).toBe('DISPUTE');
    expect(d.requiresAdmin).toBe(true);
    expect(d.refundAmount).toBe(0);
  });

  it('komplain dalam window 24 jam setelah selesai → DISPUTED', () => {
    const d = evaluateRefund({
      ...base,
      jobStatus: 'COMPLETED',
      paymentStatus: 'HELD',
      completedAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    expect(d.scenario).toBe('POST_COMPLETION_WITHIN_WINDOW');
    expect(d.outcome).toBe('DISPUTE');
  });

  it('komplain setelah window habis → REJECT', () => {
    const d = evaluateRefund({
      ...base,
      jobStatus: 'COMPLETED',
      paymentStatus: 'RELEASED',
      completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    expect(d.scenario).toBe('POST_COMPLETION_EXPIRED');
    expect(d.outcome).toBe('REJECT');
  });

  it('refund ke-4 dalam 30 hari → flag abuse + tidak auto-approve', () => {
    const d = evaluateRefund({
      ...base,
      jobStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      recentRefundCount: 3, // ini akan jadi pengajuan ke-4
    });
    expect(d.flagAbuse).toBe(true);
    expect(d.outcome).toBe('DISPUTE'); // bukan AUTO_REFUND lagi
    expect(d.requiresAdmin).toBe(true);
  });
});
