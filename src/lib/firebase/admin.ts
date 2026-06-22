import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase **Admin** SDK (server only — Route Handlers, Server Actions, the
 * session helper). Bypasses Firestore security rules, so never import this into
 * client code.
 *
 * In dev the Admin SDK auto-targets the emulators when FIREBASE_AUTH_EMULATOR_HOST
 * and FIRESTORE_EMULATOR_HOST are set (see .env.local), so no real service
 * account is required. In production it uses FIREBASE_SERVICE_ACCOUNT_KEY.
 */
function createAdminApp(): App {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // Prefer a real service account when provided (production). Otherwise fall back
  // to projectId-only init, which is all the emulator needs.
  if (serviceAccount) {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
      projectId,
    });
  }
  return initializeApp({ projectId });
}

const adminApp = getApps().length ? getApp() : createAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

/**
 * Thrown when a Firebase Admin call can't reach the backend in time — i.e. the
 * Firestore/Auth emulator isn't running in dev, or a transient outage in prod.
 * Lets call sites answer with a clear "service unavailable" instead of leaking a
 * raw gRPC error after the SDK's ~tens-of-seconds connect retry.
 */
export class AdminUnavailableError extends Error {
  constructor(message = 'AUTH_BACKEND_UNAVAILABLE') {
    super(message);
    this.name = 'AdminUnavailableError';
  }
}

/**
 * Race an Admin SDK call against a short deadline so an unreachable backend
 * fails fast (default 8s) rather than hanging on gRPC's long retry budget.
 */
export function withAdminTimeout<T>(op: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AdminUnavailableError()), ms);
    op.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
