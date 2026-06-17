import { describe, it, expect } from 'vitest';
import {
  calculateBookingFinancials,
  DEFAULT_FEE_RULE,
  MINIMUM_DP,
} from '@/lib/calculations';

describe('calculateBookingFinancials (percent-based)', () => {
  it('kalkulasi dasar 1 hari (DP 30%, fee 10%)', () => {
    const fin = calculateBookingFinancials(150_000, 1);
    expect(fin.subtotal).toBe(150_000);
    expect(fin.dpPercentApplied).toBe(30);
    expect(fin.dpAmount).toBe(45_000); // 30% × 150.000
    expect(fin.remainingAmount).toBe(105_000); // 150.000 − 45.000
    expect(fin.platformFee).toBe(15_000); // 10% × 150.000
    expect(fin.providerEarnings).toBe(135_000); // 150.000 − 15.000
  });

  it('kalkulasi 3 hari', () => {
    const fin = calculateBookingFinancials(150_000, 3);
    expect(fin.subtotal).toBe(450_000);
    expect(fin.dpAmount).toBe(135_000); // 30%
    expect(fin.platformFee).toBe(45_000); // 10%
    expect(fin.providerEarnings).toBe(405_000);
  });

  it('DP + platformFee selalu menjumlah persis (no Rupiah lost)', () => {
    const fin = calculateBookingFinancials(133_333, 1);
    expect(fin.platformFee + fin.providerEarnings).toBe(fin.subtotal);
    expect(fin.dpAmount + fin.remainingAmount).toBe(fin.subtotal);
  });

  it('job bernilai besar → DP dinaikkan ke 50%', () => {
    const fin = calculateBookingFinancials(3_000_000, 1);
    expect(fin.subtotal).toBe(3_000_000);
    expect(fin.dpPercentApplied).toBe(50); // > Rp 2.000.000 threshold
    expect(fin.dpAmount).toBe(1_500_000);
    expect(fin.providerEarnings).toBe(2_700_000); // fee tetap 10%
  });

  it('DP di bawah minimum absolut → pakai MINIMUM_DP', () => {
    const fin = calculateBookingFinancials(50_000, 1); // 30% = 15.000 < 20.000
    expect(fin.dpAmount).toBe(MINIMUM_DP);
  });

  it('customer boleh bayar DP lebih besar dari konfigurasi', () => {
    const fin = calculateBookingFinancials(150_000, 1, DEFAULT_FEE_RULE, 80_000);
    expect(fin.dpAmount).toBe(80_000);
    expect(fin.remainingAmount).toBe(70_000);
  });

  it('dpInput di bawah konfigurasi diabaikan (pakai DP konfigurasi)', () => {
    const fin = calculateBookingFinancials(150_000, 1, DEFAULT_FEE_RULE, 5_000);
    expect(fin.dpAmount).toBe(45_000);
  });

  it('campaign override hanya menurunkan fee, provider tidak dirugikan', () => {
    const fin = calculateBookingFinancials(150_000, 1, {
      ...DEFAULT_FEE_RULE,
      campaignFeePercent: 0,
    });
    expect(fin.platformFee).toBe(0);
    expect(fin.providerEarnings).toBe(150_000); // provider dapat penuh
    expect(fin.dpAmount).toBe(45_000); // DP tidak berubah
  });

  it('dailyRate 0 → throw error', () => {
    expect(() => calculateBookingFinancials(0, 1)).toThrow();
  });
});
