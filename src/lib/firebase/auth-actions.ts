'use client';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { auth } from './client';

/** Exchange the signed-in user's ID token for an httpOnly server session cookie. */
export async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error('SESSION_FAILED');
}

export async function loginWithGoogle(): Promise<void> {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await establishSession(cred.user);
}

export async function loginWithEmailPassword(email: string, password: string): Promise<void> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await establishSession(cred.user);
}

/** Server-side WA → email lookup (client never queries Firestore for this). */
export async function resolveWhatsapp(
  whatsapp: string
): Promise<{ email: string; authProvider: string | null }> {
  const res = await fetch('/api/auth/resolve-identifier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsapp }),
  });
  // The API intentionally uses the same generic status/message for an
  // unknown number to avoid account enumeration.
  if (res.status === 401) throw new Error('NOT_FOUND');
  if (!res.ok) throw new Error('RESOLVE_FAILED');
  return res.json();
}

/** Read a Firebase error code off an unknown thrown value. */
export function errorCode(e: unknown): string | undefined {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** Map a Firebase Auth error code to an actionable Indonesian message. */
export function firebaseAuthMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email/No. WhatsApp atau kata sandi salah.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Login dengan Google dibatalkan.';
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah terdaftar dengan metode lain. Coba masuk pakai email + kata sandi.';
    case 'auth/network-request-failed':
      return 'Koneksi bermasalah. Silakan coba lagi.';
    default:
      return 'Terjadi kesalahan. Silakan coba lagi.';
  }
}
