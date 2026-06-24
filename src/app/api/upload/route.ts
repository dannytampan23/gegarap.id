import { NextResponse } from 'next/server';
import { getSession } from '@/lib/firebase/session';
import { uploadPrivateDocument, type PrivateDocKind } from '@/lib/storage';

/**
 * Generic private-document upload for the KYC wizard: `POST /api/upload` with a
 * multipart body of `{ file, kind }` where kind ∈ ktp | face | certificate.
 * Everything lands in the same private bucket as KTP and returns a storage PATH
 * (never a public URL) for the onboarding payload.
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const KINDS: PrivateDocKind[] = ['ktp', 'face', 'certificate'];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Harus login dulu.' }, { status: 401 });
  }

  const formData = await req.formData();
  // Accept either `file` (spec) or `ktp` (back-compat) as the field name.
  const file = formData.get('file') ?? formData.get('ktp');
  const kindRaw = String(formData.get('kind') ?? 'ktp');
  const kind = (KINDS as string[]).includes(kindRaw) ? (kindRaw as PrivateDocKind) : 'ktp';

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: 'File tidak ditemukan.' }, { status: 400 });
  }
  // Certificates may be PDFs; identity photos must be images.
  const allowed = kind === 'certificate' ? ALLOWED_TYPES : ALLOWED_TYPES.slice(0, 3);
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          kind === 'certificate' ? 'Hanya JPG/PNG/PDF yang diizinkan.' : 'Hanya JPG/PNG yang diizinkan.',
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: 'Ukuran file maksimal 5MB.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const { path } = await uploadPrivateDocument({
      userId: session.user.id,
      kind,
      buffer,
      contentType: file.type,
      ext,
    });
    return NextResponse.json({ ok: true, url: path });
  } catch (err) {
    console.error('[upload] error:', err);
    const message =
      err instanceof Error && process.env.NODE_ENV !== 'production'
        ? err.message
        : 'Upload gagal. Silakan coba lagi.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
