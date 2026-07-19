import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mockPrisma } from './mocks/prisma';
import { POST } from '@/app/api/webhooks/midtrans/route';

const SERVER_KEY = 'test-server-key';

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${SERVER_KEY}`).digest('hex');
}

function webhookRequest(payload: Record<string, unknown>): Request {
  return new Request('http://localhost/api/webhooks/midtrans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function rawWebhookRequest(body: string): Request {
  return new Request('http://localhost/api/webhooks/midtrans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function settlementPayload(over: Record<string, unknown> = {}) {
  const order_id = 'GGR-job1-1';
  const status_code = '200';
  const gross_amount = '45000';
  return {
    order_id,
    status_code,
    gross_amount,
    transaction_status: 'settlement',
    signature_key: sign(order_id, status_code, gross_amount),
    payment_type: 'gopay',
    ...over,
  };
}

describe('Midtrans webhook', () => {
  beforeEach(() => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null as never);
    mockPrisma.webhookEvent.create.mockResolvedValue({} as never);
  });

  it('menolak body webhook yang terlalu besar sebelum diproses', async () => {
    const res = await POST(rawWebhookRequest(JSON.stringify({ padding: 'x'.repeat(65 * 1024) })));

    expect(res.status).toBe(413);
    expect(mockPrisma.webhookEvent.findUnique).not.toHaveBeenCalled();
  });

  it('duplikat (sudah ada di ledger) → 200 tanpa proses ulang', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({ id: 'we1' } as never);

    const res = await POST(webhookRequest(settlementPayload()));
    const json = await res.json();

    expect(json.duplicate).toBe(true);
    expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled(); // tidak diproses
  });

  it('signature tidak valid → diabaikan, tidak diproses', async () => {
    const res = await POST(webhookRequest(settlementPayload({ signature_key: 'bad' })));
    const json = await res.json();

    expect(json.ignored).toBe('invalid signature');
    expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalled(); // tetap dicatat (forensik)
  });

  it('nominal DB ≠ gateway → alarm mismatch, tidak diproses', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      status: 'PENDING',
      jobId: 'job1',
      amount: 99_999, // ≠ gross 45.000
    } as never);

    const res = await POST(webhookRequest(settlementPayload()));
    const json = await res.json();

    expect(json.ignored).toBe('amount mismatch');
  });

  it('out-of-order (expire setelah PAID) → anomaly, status TIDAK di-override', async () => {
    // $transaction(callback) harus menjalankan callback dengan tx.
    mockPrisma.$transaction.mockImplementation(((cb: unknown) =>
      (cb as (tx: typeof mockPrisma) => unknown)(mockPrisma)) as never);
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      status: 'PAID', // sudah dibayar
      jobId: 'job1',
      amount: 45_000,
    } as never);

    const order_id = 'GGR-job1-1';
    const res = await POST(
      webhookRequest({
        order_id,
        status_code: '202',
        gross_amount: '45000',
        transaction_status: 'expire',
        signature_key: sign(order_id, '202', '45000'),
      })
    );
    const json = await res.json();

    expect(json.anomaly).toBe('out_of_order');
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled(); // tidak meng-override
  });
});
