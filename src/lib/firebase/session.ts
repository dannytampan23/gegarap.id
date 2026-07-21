import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from './admin';
import prisma from '@/lib/prisma';
import { enqueueIdentitySync } from '@/lib/identity-sync';

export const SESSION_COOKIE = 'session';
const E2E_SESSION_COOKIE = 'e2e-session';
/** Session cookie lifetime — 14 days, matching the old JWT expiry. */
export const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 14 * 1000;

export interface SessionUser {
  id: string; // Firebase Auth uid — also the Postgres User.id (the join key)
  name?: string | null;
  email?: string | null;
  phone?: string | null; // WhatsApp, canonical 628… (Postgres is authoritative)
  image?: string | null;
  role?: string;
}
export interface AppSession {
  user: SessionUser;
}

/** Verify the session cookie and return only the uid (cheap, no DB hit). */
export async function getSessionUid(): Promise<string | null> {
  const store = await cookies();
  if (process.env.E2E_TESTING === 'true') {
    const e2eUid = store.get(E2E_SESSION_COOKIE)?.value;
    if (e2eUid) return e2eUid;
  }

  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return decoded.uid;
  } catch {
    return null; // missing / invalid / revoked / expired
  }
}

/**
 * Drop-in replacement for the old `getServerSession(authOptions)`. Returns the
 * same `{ user: { id, name, email, phone, role, image } }` shape so existing
 * call sites only change the import + call. `role`/`phone` come from Postgres
 * (the authoritative domain record); `image` from the Firebase token.
 */
export async function getSession(): Promise<AppSession | null> {
  const store = await cookies();
  if (process.env.E2E_TESTING === 'true') {
    const e2eUid = store.get(E2E_SESSION_COOKIE)?.value;
    if (e2eUid) return sessionFromUid(e2eUid, null);
  }

  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(cookie, true);
  } catch {
    return null;
  }

  return sessionFromUid(decoded.uid, (decoded.picture as string | undefined) ?? null);
}

async function sessionFromUid(uid: string, image: string | null): Promise<AppSession | null> {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      image,
    },
  };
}

/**
 * Idempotently ensure the Postgres User mirror + Firestore auth-profile doc both
 * exist for a freshly-authenticated Firebase user. Called from the session route
 * so a first-time Google sign-in gets provisioned without a separate endpoint.
 *
 * The Postgres row is keyed by the Firebase uid so the relational graph (Job,
 * Payment, Review → User.id) keeps working. Existing fields are never clobbered.
 *
 * The Firestore doc is intentionally MINIMAL — it's only the server-side login
 * index for resolve-identifier (WA number → email/authProvider). Domain identity
 * (role, name, phone) lives in Postgres and is read by the client via /api/me, so
 * we deliberately do NOT copy `role` here (it would drift the moment an admin
 * changes a role in Postgres).
 */
export async function ensureUserRecord(input: {
  uid: string;
  email: string;
  name?: string | null;
  authProvider?: 'password' | 'google';
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: input.uid },
      update: {},
      create: {
        id: input.uid,
        email: input.email.toLowerCase(),
        name: input.name?.trim() || input.email.split('@')[0],
      },
    });
    await enqueueIdentitySync(tx, {
      userId: user.id,
      authProvider: input.authProvider ?? 'google',
    });
    return user;
  });
}
