import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { getAuthUser, requireAdmin } from '@/lib/api-auth';

// ─── GET ────────────────────────────────────────────────────────────────────────
// Returns the current CenterConfig without the masterPassword field.
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    const config = await db.centerConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: 'Configuración del centro no encontrada' }, { status: 404 });
    }

    // Strip masterPassword before sending
    const { masterPassword: _, ...safeConfig } = config;
    return NextResponse.json(safeConfig);
  } catch (error: any) {
    console.error('CenterConfig GET error:', error);
    return NextResponse.json({ error: 'Error al obtener la configuración del centro' }, { status: 500 });
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────────
// Updates CenterConfig and, when relevant, syncs the master User record.
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado. Se requieren privilegios de administrador.' }, { status: 403 });
    }

    const body = await request.json();
    const { centerName, organism, masterUsername, masterPassword } = body;

    // Fetch existing config
    const existing = await db.centerConfig.findFirst();
    if (!existing) {
      return NextResponse.json({ error: 'Configuración del centro no encontrada' }, { status: 404 });
    }

    // Build update data for CenterConfig
    const configData: Record<string, any> = {};
    if (centerName !== undefined) configData.centerName = centerName;
    if (organism !== undefined) configData.organism = organism;

    let usernameChanged = false;
    let passwordChanged = false;
    let newHashedPassword: string | null = null;

    // Handle masterUsername update
    if (masterUsername !== undefined && masterUsername !== existing.masterUsername) {
      configData.masterUsername = masterUsername;
      usernameChanged = true;
    }

    // Handle masterPassword update (only when a new value is actually provided)
    if (masterPassword !== undefined && masterPassword !== '') {
      newHashedPassword = await hashPassword(masterPassword);
      configData.masterPassword = newHashedPassword;
      passwordChanged = true;
    }

    // Update CenterConfig
    const updated = await db.centerConfig.update({
      where: { id: existing.id },
      data: configData,
    });

    // Sync changes to the master User record
    if (usernameChanged || passwordChanged) {
      const userData: Record<string, any> = {};
      if (usernameChanged) {
        userData.username = masterUsername;
      }
      if (passwordChanged && newHashedPassword) {
        userData.password = newHashedPassword;
      }

      await db.user.updateMany({
        where: { isMaster: true },
        data: userData,
      });
    }

    // Return updated config without the password
    const { masterPassword: _, ...safeConfig } = updated;
    return NextResponse.json(safeConfig);
  } catch (error: any) {
    console.error('CenterConfig PUT error:', error);
    return NextResponse.json({ error: 'Error al actualizar la configuración del centro' }, { status: 500 });
  }
}
