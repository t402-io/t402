import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateMap = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60000;
const MAX_REQUESTS = 100;

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://*.walletconnect.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'on',
  'Content-Security-Policy': CSP_DIRECTIVES,
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  // Rate limiting for API demo routes
  if (request.nextUrl.pathname.startsWith('/api/demo')) {
    const ip = request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
    const now = Date.now();
    const entry = rateMap.get(ip);

    if (!entry || now > entry.reset) {
      // Clean up expired entries to prevent unbounded memory growth
      if (rateMap.size > 1000) {
        for (const [key, val] of rateMap) {
          if (now > val.reset) rateMap.delete(key);
        }
      }
      rateMap.set(ip, { count: 1, reset: now + WINDOW_MS });
      return applySecurityHeaders(NextResponse.next());
    }

    entry.count++;
    if (entry.count > MAX_REQUESTS) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      );
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // All other routes — apply security headers only
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|favicon\\.svg|favicon-96x96\\.png|apple-touch-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
