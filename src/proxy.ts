import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'session';

/**
 * Fast presence gate only. Every protected page and mutation verifies the
 * Firebase session server-side, so this redirect is never the authorization
 * boundary.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(loginUrl);
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
