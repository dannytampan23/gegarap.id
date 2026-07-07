'use client';

import * as React from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FbUser } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  phone?: string | null;
  role?: string;
}

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionShape {
  data: { user: SessionUser } | null;
  status: Status;
  /** Re-read the Firestore profile (e.g. after the user adds their WA number). */
  update: () => Promise<void>;
}

/** Identity as returned by /api/me — sourced from Postgres (authoritative). */
interface MeProfile {
  name?: string | null;
  phone?: string | null;
  image?: string | null;
  role?: string;
}

const SessionContext = React.createContext<SessionShape>({
  data: null,
  status: 'loading',
  update: async () => {},
});

/**
 * Client auth context backed by Firebase Auth. Exposes a `useSession()` hook
 * shaped like the old NextAuth one so existing components only swap the import.
 * `role`/`phone`/`name` come from /api/me — i.e. Postgres, the single source of
 * truth — so the client never shows a stale Firestore copy of the role. They
 * drive UI only; the server independently re-checks for RBAC.
 *
 * Mounted once in the root layout (replaces NextAuth's SessionProvider).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [fbUser, setFbUser] = React.useState<FbUser | null>(null);
  const [profile, setProfile] = React.useState<MeProfile | null>(null);
  const [status, setStatus] = React.useState<Status>('loading');

  const loadProfile = React.useCallback(async (u: FbUser | null) => {
    if (!u) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      if (!res.ok) {
        setProfile(null);
        return;
      }
      const json = (await res.json()) as { user?: MeProfile | null };
      setProfile(json.user ?? null);
    } catch {
      setProfile(null);
    }
  }, []);

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      // Keep the httpOnly server session cookie in sync with the client session.
      // Without this, a client that's still signed in (Firebase persists auth in
      // IndexedDB and auto-refreshes) but whose server cookie expired/was cleared
      // hits 401 on server routes (onboarding, bookings, dashboard). Re-posting
      // the fresh ID token re-mints the cookie so client and server never drift.
      if (u) {
        try {
          const idToken = await u.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
        } catch {
          /* best-effort; explicit login flow also establishes the cookie */
        }
      }
      await loadProfile(u);
      setStatus(u ? 'authenticated' : 'unauthenticated');
    });
  }, [loadProfile]);

  const update = React.useCallback(async () => {
    await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const value = React.useMemo<SessionShape>(
    () => ({
      data: fbUser
        ? {
            user: {
              id: fbUser.uid,
              name: profile?.name ?? fbUser.displayName,
              email: fbUser.email,
              image: profile?.image ?? fbUser.photoURL,
              phone: profile?.phone ?? null,
              role: profile?.role,
            },
          }
        : null,
      status,
      update,
    }),
    [fbUser, profile, status, update]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Drop-in replacement for next-auth/react's useSession(). */
export function useSession(): SessionShape {
  return React.useContext(SessionContext);
}

/** Sign out of Firebase AND clear the server session cookie. */
export async function signOutFull(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
  await firebaseSignOut(auth);
}
