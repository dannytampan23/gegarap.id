import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma';

// The dispatcher does the actual WhatsApp send; capture it to drive outcomes.
const { sendWAMessage } = vi.hoisted(() => ({ sendWAMessage: vi.fn() }));
vi.mock('@/lib/whatsapp', () => ({ __esModule: true, sendWAMessage }));

import { enqueueWhatsApp, dispatchOutboxBatch, OUTBOX_MAX_ATTEMPTS } from '@/lib/outbox';

describe('outbox enqueue', () => {
  beforeEach(() => sendWAMessage.mockReset());

  it('persists a PENDING WhatsApp row', async () => {
    mockPrisma.outboxMessage.create.mockResolvedValue({} as never);
    await enqueueWhatsApp('628111', 'halo', 'k1');
    expect(mockPrisma.outboxMessage.create).toHaveBeenCalledWith({
      data: { channel: 'WHATSAPP', toAddress: '628111', body: 'halo', dedupeKey: 'k1' },
    });
  });

  it('treats a duplicate dedupeKey (P2002) as an idempotent no-op, never throws', async () => {
    mockPrisma.outboxMessage.create.mockRejectedValue({ code: 'P2002' } as never);
    await expect(enqueueWhatsApp('628111', 'halo', 'dup')).resolves.toBeUndefined();
  });

  it('never throws on an unexpected DB error', async () => {
    mockPrisma.outboxMessage.create.mockRejectedValue(new Error('db down') as never);
    await expect(enqueueWhatsApp('628111', 'halo')).resolves.toBeUndefined();
  });
});

describe('outbox dispatch', () => {
  beforeEach(() => sendWAMessage.mockReset());

  it('marks a delivered message SENT', async () => {
    mockPrisma.outboxMessage.findMany.mockResolvedValue([
      { id: 'm1', toAddress: '628111', body: 'hi', attempts: 0 },
    ] as never);
    sendWAMessage.mockResolvedValue(true);

    const res = await dispatchOutboxBatch();

    expect(res).toMatchObject({ scanned: 1, sent: 1, failed: 0 });
    expect(mockPrisma.outboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({ status: 'SENT' }),
      })
    );
  });

  it('retries (stays PENDING) when delivery fails below the attempt cap', async () => {
    mockPrisma.outboxMessage.findMany.mockResolvedValue([
      { id: 'm2', toAddress: '628111', body: 'hi', attempts: 0 },
    ] as never);
    sendWAMessage.mockResolvedValue(false);

    const res = await dispatchOutboxBatch();

    expect(res).toMatchObject({ sent: 0, failed: 1 });
    expect(mockPrisma.outboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) })
    );
  });

  it('parks as FAILED once attempts reach the cap', async () => {
    mockPrisma.outboxMessage.findMany.mockResolvedValue([
      { id: 'm3', toAddress: '628111', body: 'hi', attempts: OUTBOX_MAX_ATTEMPTS - 1 },
    ] as never);
    sendWAMessage.mockResolvedValue(false);

    await dispatchOutboxBatch();

    expect(mockPrisma.outboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });
});
