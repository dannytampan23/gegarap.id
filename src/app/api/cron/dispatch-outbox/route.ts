import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { dispatchIdentitySyncBatch } from '@/lib/identity-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await dispatchIdentitySyncBatch();
  return NextResponse.json({ ok: true, ...result });
}
