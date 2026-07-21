import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/validations/auth';

const E2E_SESSION_COOKIE = 'e2e-session';

export async function POST(req: Request) {
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    role?: string;
    phone?: string;
    email?: string;
    name?: string;
  } | null;

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const id = `e2e-${unique}`;
  const role = body?.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
  const phone = normalizePhone(body?.phone || `81${unique.slice(-8).padStart(8, '0')}`);
  const email = (body?.email || `${id}@test.gegarap.id`).toLowerCase();
  const name = body?.name || 'E2E Tester';

  await prisma.user.upsert({
    where: { id },
    update: { name, email, phone, role },
    create: { id, name, email, phone, role },
  });

  const res = NextResponse.json({ ok: true, userId: id });
  res.cookies.set(E2E_SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(E2E_SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
