import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        'Upload foto KTP tidak lagi didukung. Verifikasi mitra sekarang menggunakan input NIK.',
    },
    { status: 410 }
  );
}
