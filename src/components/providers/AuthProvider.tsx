'use client';

import * as React from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FbUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

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

interface FirestoreProfile {
  name?: string | null;
  whatsapp?: string | null;
  photoURL?: string | null;
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
 * `role`/`whatsapp` come from the user's own Firestore profile doc (readable
 * under the security rules); they drive UI only — the server re-checks for RBAC.
 *
 * Mounted once in the root layout (replaces NextAuth's SessionProvider).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [fbUser, setFbUser] = React.useState<FbUser | null>(null);
  const [profile, setProfile] = React.useState<FirestoreProfile | null>(null);
  const [status, setStatus] = React.useState<Status>('loading');

  const loadProfile = React.useCallback(async (u: FbUser | null) => {
    if (!u) {
      setProfile(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'users', u.uid));
      setProfile(snap.exists() ? (snap.data() as FirestoreProfile) : null);
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
      // hits 401 on server routes (KTP upload, bookings, dashboard). Re-posting
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
              image: profile?.photoURL ?? fbUser.photoURL,
              phone: profile?.whatsapp ?? null,
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
