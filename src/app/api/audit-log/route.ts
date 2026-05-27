import { NextRequest, NextResponse } from 'next/server';
import { validateAuthToken } from '@/lib/auth-token';
import { db } from '@/lib/db';

// In-memory audit log (resets on server restart)
// For production, migrate to a Prisma model
const auditLog: Array<{
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  details: string;
  ip: string;
}> = [];

/** Add an audit entry (called from other route handlers) */
export function addAuditEntry(entry: Omit<typeof auditLog[number], 'id' | 'timestamp'>) {
  auditLog.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  // Keep last 500 entries
  if (auditLog.length > 500) auditLog.length = 500;
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const userId = await validateAuthToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;
  return user;
}

// GET — List recent audit log entries (admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de administrador.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    return NextResponse.json({
      entries: auditLog.slice(0, limit),
      total: auditLog.length,
    });
  } catch (error: any) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: 'Error al obtener el registro de auditoría' }, { status: 500 });
  }
}
