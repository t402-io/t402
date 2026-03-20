import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateMap = new Map<string, { count: number; reset: number }>();

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/demo')) {
    return NextResponse.next();
  }
  const ip = request.headers.get('cf-connecting-ip') || request.ip || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + 60_000 });
    return NextResponse.next();
  }
  entry.count++;
  if (entry.count > 100) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/demo/:path*' };
