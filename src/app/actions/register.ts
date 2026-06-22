'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { Prisma } from '@prisma/client';
import { adminAuth, adminDb, AdminUnavailableError, withAdminTimeout } from '@/lib/firebase/admin';
import prisma from '@/lib/prisma';
import { registerSchema } from '@/lib/validations/auth';

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function firebaseErrorCode(e: unknown): string | undefined {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/**
 * Create a new account on Firebase Auth (which hashes the password internally —
 * no bcrypt here) and provision the Firestore auth profile + Postgres mirror.
 *
 * Uniqueness: Firebase enforces email; the Postgres `phone @unique` index is the
 * hard backstop for WhatsApp (a Firestore query has no native unique constraint),
 * with a Firestore soft-check first for a friendly message. The WA number is
 * stored as plain contact data — there is no OTP/verification.
 *
 * The client signs in afterwards and posts the ID token to /api/auth/session to
 * establish the session cookie (auto-login).
 */
export async function registerUser(raw: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Periksa kembali data yang Anda isi.', fieldErrors };
  }

  const { name, email, whatsapp, password } = parsed.data;

  try {
    // Soft WA dup-check (the hard guarantee is the Postgres unique index below).
    const dup = await withAdminTimeout(
      adminDb.collection('users').where('whatsapp', '==', whatsapp).limit(1).get()
    );
    if (!dup.empty) {
      return {
        ok: false,
        error: 'Nomor WhatsApp sudah terdaftar. Silakan masuk.',
        fieldErrors: { whatsapp: 'Nomor WhatsApp sudah terdaftar.' },
      };
    }

    // 1. Firebase Auth user — also enforces email uniqueness.
    let uid: string;
    try {
      const created = await withAdminTimeout(
        adminAuth.createUser({ email, password, displayName: name })
      );
      uid = created.uid;
    } catch (e) {
      if (firebaseErrorCode(e) === 'auth/email-already-exists') {
        return {
          ok: false,
          error: 'Email sudah terdaftar. Silakan masuk.',
          fieldErrors: { email: 'Email sudah terdaftar.' },
        };
      }
      throw e;
    }

    // 2. Postgres mirror (id = Firebase uid). `phone @unique` is the WA backstop.
    try {
      await prisma.user.create({ data: { id: uid, name, email, phone: whatsapp } });
    } catch (e) {
      // Don't orphan a Firebase account if the mirror insert fails.
      await adminAuth.deleteUser(uid).catch(() => {});
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        const onPhone = target.includes('phone');
        return {
          ok: false,
          error: onPhone
            ? 'Nomor WhatsApp sudah terdaftar. Silakan masuk.'
            : 'Email sudah terdaftar. Silakan masuk.',
          fieldErrors: onPhone
            ? { whatsapp: 'Nomor WhatsApp sudah terdaftar.' }
            : { email: 'Email sudah terdaftar.' },
        };
      }
      throw e;
    }

    // 3. Firestore auth-profile document.
    await withAdminTimeout(
      adminDb.collection('users').doc(uid).set({
        name,
        email,
        whatsapp,
        photoURL: null,
        role: 'CUSTOMER',
        authProvider: 'password',
        createdAt: FieldValue.serverTimestamp(),
      })
    );

    return { ok: true };
  } catch (e) {
    // Backend unreachable (e.g. Firebase emulator not running in dev): fail fast
    // with a clear message instead of bubbling up a raw 500 after a long retry.
    if (e instanceof AdminUnavailableError) {
      return {
        ok: false,
        error: 'Layanan pendaftaran sedang tidak tersedia. Coba lagi sebentar lagi.',
      };
    }
    throw e;
  }
}
