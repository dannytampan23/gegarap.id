import { NextResponse } from 'next/server';
import { adminDb, AdminUnavailableError, withAdminTimeout } from '@/lib/firebase/admin';
import { normalizePhone, isValidIndonesianPhone } from '@/lib/validations/auth';

/**
 * Resolve a WhatsApp number → the account's email, server-side only.
 *
 * The client never queries Firestore for this (security rules forbid `list`),
 * so nobody can enumerate/brute-force the WA→email mapping from the browser. We
 * use the Admin SDK here, which bypasses rules. Email-based login does NOT go
 * through this route (to avoid turning it into an email-existence oracle).
 *
 * Returns `{ email, authProvider }` so the client can short-circuit a
 * Google-only account with a helpful message instead of a failed password login.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw = typeof body?.whatsapp === 'string' ? body.whatsapp : '';
  const phone = normalizePhone(raw);
  if (!isValidIndonesianPhone(phone)) {
    return NextResponse.json({ error: 'Nomor WhatsApp tidak valid.' }, { status: 400 });
  }

  let snap;
  try {
    snap = await withAdminTimeout(
      adminDb.collection('users').where('whatsapp', '==', phone).limit(1).get()
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

  if (snap.empty) {
    return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
  }

  const data = snap.docs[0].data();
  return NextResponse.json({ email: data.email, authProvider: data.authProvider ?? null });
}
