import { auth } from '@/lib/auth';
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const publicPaths = ['/login', '/api/auth', '/api/health'];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname.includes(path) || pathname === '/'
  );
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes except those needing locale
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Apply intl middleware first for locale routing
  const intlResponse = intlMiddleware(request);

  // Check if the path requires auth
  if (isPublicPath(pathname)) {
    return intlResponse;
  }

  // Get the session
  const session = await auth();

  // Not authenticated → redirect to login
  if (!session?.user) {
    const locale = pathname.split('/')[1] || defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require ADMIN role
  if (pathname.includes('/admin') && session.user.role !== 'ADMIN') {
    const locale = pathname.split('/')[1] || defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
};
