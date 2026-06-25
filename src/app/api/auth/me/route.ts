import { NextResponse } from 'next/server';
import { getSession } from '@/lib/firebase/session';

/** Never cache — identity (role/phone) must reflect Postgres right now. */
export const dynamic = 'force-dynamic';

/**
 * The authoritative client-facing session. `getSession()` verifies the session
 * cookie and reads role/phone/name from Postgres (the domain source of truth),
 * so the client never depends on a possibly-stale Firestore copy of `role`.
 * Used by the client AuthProvider to populate `useSession()`.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, user: null }, { status: 401 });
  return NextResponse.json({ ok: true, user: session.user });
}
