import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadKtp } from '@/lib/storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Harus login dulu.' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('ktp');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: 'File tidak ditemukan.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { ok: false, message: 'Hanya JPG/PNG yang diizinkan.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: 'Ukuran file maksimal 5MB.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    // Stores into a PRIVATE bucket under a random, PII-free key (uuid + hashed
    // userId) and returns the object PATH — NOT a public URL. The path is what
    // the onboarding form sends back as `ktpImageUrl`; admins later resolve it
    // to a short-lived signed URL for KYC review.
    const { path } = await uploadKtp({
      userId: session.user.id,
      buffer,
      contentType: file.type,
      ext,
    });
    return NextResponse.json({ ok: true, url: path });
  } catch (err) {
    console.error('[upload/ktp] error:', err);
    const message =
      err instanceof Error && process.env.NODE_ENV !== 'production'
        ? err.message
        : 'Upload gagal. Silakan coba lagi.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
