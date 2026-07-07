import { randomUUID, createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET =
  process.env.SUPABASE_PRIVATE_DOC_BUCKET ?? process.env.SUPABASE_BUCKET ?? 'private-documents';

export const isStorageConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
export const DEV_PLACEHOLDER_PATH = 'dev/private-doc-placeholder';

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function userSegment(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

export type PrivateDocKind = 'face' | 'certificate';

export async function uploadPrivateDocument(params: {
  userId: string;
  kind: PrivateDocKind;
  buffer: Buffer;
  contentType: string;
  ext: string;
}): Promise<{ path: string }> {
  const path = `${params.kind}/${userSegment(params.userId)}/${randomUUID()}.${params.ext}`;

  if (!isStorageConfigured) {
    if (process.env.NODE_ENV !== 'production') return { path: `${DEV_PLACEHOLDER_PATH}-${params.kind}` };
    throw new Error('Penyimpanan dokumen belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY kosong).');
  }

  const { error } = await admin()
    .storage.from(SUPABASE_BUCKET)
    .upload(path, params.buffer, { contentType: params.contentType, upsert: false });
  if (error) throw new Error(`Upload dokumen gagal: ${error.message}`);

  return { path };
}
