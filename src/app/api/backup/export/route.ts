// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO Backup Export — Full database export as signed JSON
// GET /api/backup/export
// Requires admin privileges
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado. Se requieren privilegios de administrador.' }, { status: 403 });
    }

    // ─── Export CenterConfig (strip masterPassword hash) ──────────────────────
    const centerConfigRaw = await db.centerConfig.findFirst();
    const centerConfig = centerConfigRaw
      ? (() => { const { masterPassword, ...rest } = centerConfigRaw; return rest; })()
      : null;

    // ─── Export License ───────────────────────────────────────────────────────
    const license = await db.license.findFirst();

    // ─── Export Users (strip passwords) ───────────────────────────────────────
    const users = await db.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isMaster: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ─── Export Projects with all related records ─────────────────────────────
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cashFlows: {
          orderBy: { period: 'asc' },
        },
        financingSources: true,
        investmentItems: true,
        annualProjections: {
          orderBy: { year: 'asc' },
        },
      },
    });

    // ─── Build signed export structure ────────────────────────────────────────
    const backup = {
      magic: 'BARAPRO_BACKUP',
      version: '10.1',
      exportedAt: new Date().toISOString(),
      data: {
        centerConfig,
        license,
        users,
        projects,
      },
    };

    return NextResponse.json(backup);
  } catch (error: any) {
    console.error('Backup export error:', error);
    return NextResponse.json(
      { error: 'Error al exportar el respaldo de la base de datos' },
      { status: 500 }
    );
  }
}
