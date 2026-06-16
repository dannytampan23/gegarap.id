import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Auth + role-based access control for protected areas.
 *
 *   - Unauthenticated visitors → /login?redirect=… (back to where they meant to go)
 *   - /admin/*    → ADMIN only
 *   - /provider/* → PROVIDER (or ADMIN) only
 *   - /dashboard, /book, /onboarding → any authenticated user
 *
 * Note: the JWT `role` is refreshed from the DB in the auth `jwt` callback, so a
 * freshly onboarded provider gets PROVIDER access on the next session refresh
 * (the onboarding flow calls session.update() to make this immediate).
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Not logged in → bounce to login, preserving the intended destination.
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token as { role?: string }).role;

  // Admin area is ADMIN-only. Send everyone else home.
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Provider area is for PROVIDERs (admins may inspect it too). A customer who
  // hasn't onboarded gets sent to their own dashboard rather than a dead end.
  if (pathname.startsWith('/provider') && role !== 'PROVIDER' && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/provider/:path*',
    '/admin/:path*',
    '/book/:path*',
    '/onboarding/:path*',
  ],
};
