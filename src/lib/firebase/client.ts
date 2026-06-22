import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

/**
 * Firebase **client** SDK (browser). Used by the login/register UI and the auth
 * context. Only the public `NEXT_PUBLIC_*` config is needed — these values are
 * safe to ship to the client (access is governed by Firestore security rules,
 * not by hiding the apiKey).
 *
 * The values are hardcoded as fallbacks because they are public and identical
 * across every environment, and because they must be present at BUILD time
 * (NEXT_PUBLIC_* are inlined, and the auth pages prerender `getAuth()` — a
 * missing key crashes the build with auth/invalid-api-key). An env var, if set,
 * still wins, so a different Firebase project can be used without code changes.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAXDLfO3XFwwy1ST4n4DAWktrA5ftNhz5s',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'gegarap.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'gegarap',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Point the client SDK at the local emulators in dev. Guarded so HMR / repeated
// imports don't try to connect twice (which throws).
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  const g = globalThis as typeof globalThis & { __FB_EMULATORS__?: boolean };
  if (!g.__FB_EMULATORS__) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    g.__FB_EMULATORS__ = true;
  }
}
