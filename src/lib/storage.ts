import { randomUUID, createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only KTP storage. KTP images are sensitive identity documents and live
 * in a PRIVATE Supabase bucket:
 *   - Written with the SERVICE ROLE key (never the anon key).
 *   - Stored under an unguessable, PII-free object key (uuid + hashed userId).
 *   - Never served via a public URL — admins read them through a short-lived
 *     signed URL minted on demand for KYC review.
 *
 * This module must never be imported by client code; the service role key would
 * leak. It is only used by server route handlers and server components.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_KTP_BUCKET ?? 'ktp-private';

/** True when real, write-capable storage credentials are present. */
export const isStorageConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

/** Sentinel stored when running locally without Supabase keys. */
export const DEV_PLACEHOLDER_PATH = 'dev/ktp-placeholder';

const SIGNED_URL_TTL_SECONDS = 120; // 2 minutes — long enough to view, short enough to be safe

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Non-reversible per-user path segment so object keys can't be enumerated. */
function userSegment(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

/**
 * Upload a KTP image and return its private object PATH (not a URL). The path is
 * what gets persisted on the provider profile; resolve it to a viewable link
 * only via {@link getKtpSignedUrl}.
 */
export async function uploadKtp(params: {
  userId: string;
  buffer: Buffer;
  contentType: string;
  ext: string;
}): Promise<{ path: string }> {
  // Random, unguessable key — no phone/name/timestamp anywhere in the path.
  const path = `ktp/${userSegment(params.userId)}/${randomUUID()}.${params.ext}`;

  if (!isStorageConfigured) {
    // Dev fallback so onboarding is testable without Supabase. Hard error in prod.
    if (process.env.NODE_ENV !== 'production') return { path: DEV_PLACEHOLDER_PATH };
    throw new Error('Penyimpanan KTP belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY kosong).');
  }

  const { error } = await admin()
    .storage.from(SUPABASE_BUCKET)
    .upload(path, params.buffer, { contentType: params.contentType, upsert: false });
  if (error) throw new Error(`Upload KTP gagal: ${error.message}`);

  return { path };
}

/**
 * Mint a short-lived signed URL for a private KTP object. Intended only for
 * authenticated admins doing KYC review; the link expires in 2 minutes. Returns
 * null if there is no document or the signing fails.
 */
export async function getKtpSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (!isStorageConfigured || path === DEV_PLACEHOLDER_PATH) {
    return 'https://placehold.co/800x500/png?text=KTP+(dev+placeholder)';
  }

  const { data, error } = await admin()
    .storage.from(SUPABASE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('[storage] signed URL error:', error.message);
    return null;
  }
  return data.signedUrl;
}
