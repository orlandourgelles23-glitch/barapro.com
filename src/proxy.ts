/**
 * BARAPRO v11 — proxy.ts
 *
 * Next.js 16 Proxy for API route authentication.
 * Replaces the deprecated middleware.ts convention with proxy.ts.
 *
 * This proxy validates JWT Bearer tokens on all API routes except
 * the public routes defined below. Valid tokens are decoded and the
 * user ID is injected into the x-user-id header for downstream use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthTokenEdge } from '@/lib/auth-token-edge';

// Routes that don't require authentication
const PUBLIC_API_ROUTES = ['/api/auth', '/api/seed-auth', '/api/health'];

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Only protect API routes
    if (!pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // Allow public routes
    if (PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
      return NextResponse.next();
    }

    // Extract Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado. Inicie sesion.' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();
    const userId = await validateAuthTokenEdge(token);

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado. Token invalido o expirado.' },
        { status: 401 }
      );
    }

    // Add user ID to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userId);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    // If proxy fails, allow the request through
    // Individual API routes have their own auth validation as backup
    console.error('[proxy.ts] Auth error, passing through:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
