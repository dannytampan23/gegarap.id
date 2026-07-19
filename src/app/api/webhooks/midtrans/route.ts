import { NextResponse } from 'next/server';
import { handleMidtransWebhook } from '@/lib/services/midtrans-webhook';

/**
 * Thin controller: parse the body and delegate to the webhook service, which
 * owns all verification/idempotency/state logic and returns the HTTP outcome.
 * An unexpected error from the service propagates to a 500 so Midtrans retries
 * (the service only throws when an event must be reprocessed, never recording it).
 */
export async function POST(req: Request) {
  const MAX_BODY_BYTES = 64 * 1024;
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const raw = await req.text().catch(() => '');
  if (!raw) return NextResponse.json({ ok: false }, { status: 400 });
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: Parameters<typeof handleMidtransWebhook>[0];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    body = parsed as Parameters<typeof handleMidtransWebhook>[0];
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await handleMidtransWebhook(body);
  return NextResponse.json(result.payload, { status: result.httpStatus });
}

// Register this URL in Midtrans Dashboard → Settings → Configuration →
// Payment Notification URL: https://www.gegarap.id/api/webhooks/midtrans
