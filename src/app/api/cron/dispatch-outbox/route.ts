import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { dispatchOutboxBatch } from '@/lib/outbox';

/** Always run fresh — never serve a cached dispatch result. */
export const dynamic = 'force-dynamic';

/**
 * Deliver queued outbound notifications (Bagian 9/10). Request handlers enqueue
 * WhatsApp messages to the OutboxMessage table; this cron drains the PENDING
 * backlog and retries transient failures. Safe to call frequently — it only
 * touches rows that still need sending.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await dispatchOutboxBatch(50);
  return NextResponse.json({ ok: true, ...result });
}
