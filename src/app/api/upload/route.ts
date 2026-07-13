import { NextResponse } from 'next/server';
import { getSession } from '@/lib/firebase/session';
import { uploadPrivateDocument, type PrivateDocKind } from '@/lib/storage';
import { clientIp, enforceDurableRateLimit } from '@/lib/rate-limit';
import { matchesDeclaredFileType } from '@/lib/file-signature';
import { isHttpAwareError } from '@/lib/errors';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;
const KINDS: PrivateDocKind[] = ['face', 'certificate'];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Harus login dulu.' }, { status: 401 });
  }

  try {
    await enforceDurableRateLimit(`upload:${session.user.id}:${clientIp(req)}`, {
      windowMs: 60 * 60 * 1000,
      max: 10,
    });
  } catch (error) {
    if (isHttpAwareError(error)) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.httpStatus });
    }
    throw error;
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const kindRaw = String(formData.get('kind') ?? '');

  if (!(KINDS as string[]).includes(kindRaw)) {
    return NextResponse.json(
      { ok: false, message: 'Jenis dokumen tidak didukung.' },
      { status: 400 }
    );
  }
  const kind = kindRaw as PrivateDocKind;

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: 'File tidak ditemukan.' }, { status: 400 });
  }

  const allowed = kind === 'certificate' ? ALLOWED_TYPES : ALLOWED_TYPES.slice(0, 3);
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          kind === 'certificate'
            ? 'Hanya JPG/PNG/PDF yang diizinkan.'
            : 'Hanya JPG/PNG yang diizinkan.',
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: 'Ukuran file maksimal 5MB.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesDeclaredFileType(buffer, file.type)) {
      return NextResponse.json(
        { ok: false, message: 'Isi file tidak sesuai dengan format yang dinyatakan.' },
        { status: 400 }
      );
    }
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
