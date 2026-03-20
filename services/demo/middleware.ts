import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateMap = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60000;
const MAX_REQUESTS = 100;

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/demo')) {
    return NextResponse.next();
  }

  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/demo/:path*' };
