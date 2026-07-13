import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockDisbursementProvider,
  DisabledDisbursementProvider,
  GatewayDisbursementProvider,
  getDisbursementProvider,
} from '@/lib/disbursement';
import { refundViaGateway } from '@/lib/midtrans';

const baseReq = {
  payoutId: 'po1',
  amount: 90_000,
  reference: 'GGR-x',
};

describe('getDisbursementProvider (Bagian 6)', () => {
  const prev = process.env.DISBURSEMENT_PROVIDER;
  afterEach(() => {
    process.env.DISBURSEMENT_PROVIDER = prev;
  });

  it('default → MOCK (tidak pernah transfer nyata)', () => {
    delete process.env.DISBURSEMENT_PROVIDER;
    expect(getDisbursementProvider()).toBeInstanceOf(MockDisbursementProvider);
  });

  it('DISBURSEMENT_PROVIDER=gateway → Iris', () => {
    process.env.DISBURSEMENT_PROVIDER = 'gateway';
    expect(getDisbursementProvider()).toBeInstanceOf(GatewayDisbursementProvider);
  });
});

describe('production disbursement safety', () => {
  it('uses DISABLED rather than a fake payout when production is unconfigured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.DISBURSEMENT_PROVIDER;
    expect(getDisbursementProvider()).toBeInstanceOf(DisabledDisbursementProvider);
    vi.unstubAllEnvs();
  });
});

describe('GatewayDisbursementProvider (Iris)', () => {
  const prev = process.env.MIDTRANS_IRIS_API_KEY;
  afterEach(() => {
    process.env.MIDTRANS_IRIS_API_KEY = prev;
  });

  it('tanpa MIDTRANS_IRIS_API_KEY → gagal tertutup (fail closed)', async () => {
    delete process.env.MIDTRANS_IRIS_API_KEY;
    const res = await new GatewayDisbursementProvider().disburse({
      ...baseReq,
      recipient: {
        method: 'bank',
        details: { accountNumber: '123', bankCode: 'bca', accountName: 'Joko' },
      },
    });
    expect(res.success).toBe(false);
    expect(res.failureReason).toMatch(/Iris API key/i);
  });

  it('detail bank tidak lengkap → ditolak sebelum call gateway', async () => {
    process.env.MIDTRANS_IRIS_API_KEY = 'iris-key';
    const res = await new GatewayDisbursementProvider().disburse({
      ...baseReq,
      recipient: { method: 'bank', details: { accountName: 'Joko' } }, // no account number / bank
    });
    expect(res.success).toBe(false);
    expect(res.failureReason).toMatch(/tidak didukung|tidak lengkap|Iris/i);
  });

  it('metode ovo/dana belum didukung Iris → ditolak', async () => {
    process.env.MIDTRANS_IRIS_API_KEY = 'iris-key';
    const res = await new GatewayDisbursementProvider().disburse({
      ...baseReq,
      recipient: { method: 'ovo', details: { phone: '628' } },
    });
    expect(res.success).toBe(false);
  });
});

describe('refundViaGateway (Bagian 7)', () => {
  beforeEach(() => {
    delete process.env.OPS_ALERT_PHONE;
  });

  it('tanpa order id → skipped (no-op sukses)', async () => {
    const res = await refundViaGateway({
      orderId: null,
      paymentId: 'pay1',
      amount: 30_000,
      reason: 'test',
    });
    expect(res.success).toBe(true);
    expect(res.skipped).toBe(true);
  });
});
