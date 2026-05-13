import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lightweight middleware — no NextAuth import (openid-client breaks Edge runtime).
// We check only for the presence of the NextAuth session cookie here.
// Full JWT verification happens server-side in every route via getCurrentUserContext().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/');  // All API routes handle their own auth

  if (isPublicPath) return NextResponse.next();

  // NextAuth v4 stores the session in one of these cookies
  const hasSession =
    request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token');

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
