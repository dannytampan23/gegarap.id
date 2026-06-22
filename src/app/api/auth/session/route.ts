import { NextResponse } from 'next/server';
import { adminAuth, AdminUnavailableError, withAdminTimeout } from '@/lib/firebase/admin';
import { ensureUserRecord, SESSION_COOKIE, SESSION_EXPIRES_IN_MS } from '@/lib/firebase/session';

/**
 * Exchange a Firebase ID token for an httpOnly session cookie (the bridge from
 * the client-SDK login to server-side Next.js auth). Also provisions the
 * Postgres mirror + Firestore profile on a first-time sign-in (e.g. Google).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const idToken = body?.idToken;
  if (typeof idToken !== 'string' || !idToken) {
    return NextResponse.json({ error: 'idToken wajib.' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 401 });
  }

  let sessionCookie: string;
  try {
    await withAdminTimeout(
      ensureUserRecord({
        uid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? null,
        picture: decoded.picture ?? null,
        authProvider: decoded.firebase?.sign_in_provider === 'password' ? 'password' : 'google',
      })
    );

    sessionCookie = await withAdminTimeout(
      adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS })
    );
  } catch (e) {
    if (e instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: 'Layanan sedang tidak tersedia. Coba lagi sebentar lagi.' },
        { status: 503 }
      );
    }
    throw e;
  }

  const res = NextResponse.json({ status: 'success' });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
    path: '/',
  });
  return res;
}

/** Clear the session cookie on logout (called alongside the client signOut). */
export async function DELETE() {
  const res = NextResponse.json({ status: 'success' });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
