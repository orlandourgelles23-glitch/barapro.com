// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO Shared API Auth Helper
// Eliminates duplicated getAuthenticatedUser() across every API route.
//
// How it works:
//   ALWAYS validates the Bearer token from the Authorization header using JWT.
//   The x-user-id header is trusted ONLY if it was set by the proxy (middleware),
//   which already validated the JWT. If x-user-id is present but NO Authorization
//   header exists, we still reject — headers can be spoofed by clients.
//
//   This approach prevents header injection attacks while supporting the
//   proxy/middleware flow for efficiency.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { validateAuthToken } from '@/lib/auth-token';

/**
 * Get authenticated user from request.
 *
 * SECURITY: Always validates the JWT Bearer token from the Authorization header.
 * The x-user-id header set by the proxy is used as a hint to skip redundant
 * JWT validation only when a valid Bearer token is also present.
 *
 * Returns the full user record or null if not authenticated / inactive.
 */
export async function getAuthUser(request: NextRequest) {
  // Step 1: Extract and validate Bearer token (ALWAYS required)
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  const userId = await validateAuthToken(token);

  if (!userId) return null;

  // Step 2: If proxy set x-user-id, verify it matches the JWT (anti-spoofing)
  const proxyUserId = request.headers.get('x-user-id');
  if (proxyUserId && proxyUserId !== userId) {
    // x-user-id doesn't match JWT — possible header injection, reject
    return null;
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;
  return user;
}

/**
 * Require admin role — returns user if admin, or null otherwise.
 * Use this for admin-only endpoints.
 */
export async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}
