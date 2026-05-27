import { NextRequest, NextResponse } from 'next/server';
import { validateAuthToken } from '@/lib/auth-token';
import { db } from '@/lib/db';

/**
 * GET /api/auth/validate — Check if a Bearer token is still valid.
 * Returns { valid: true, user } or { valid: false }.
 * Used by the frontend to detect stale sessions.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const userId = await validateAuthToken(token);

    if (!userId) {
      return NextResponse.json({ valid: false, error: 'Token expired or invalid' }, { status: 401 });
    }

    // Verify user still exists and is active
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isMaster: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return NextResponse.json({ valid: false, error: 'User deactivated' }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isMaster: user.isMaster,
      },
    });
  } catch (error: any) {
    console.error('Auth validate error:', error);
    return NextResponse.json({ valid: false, error: 'Validation error' }, { status: 401 });
  }
}
