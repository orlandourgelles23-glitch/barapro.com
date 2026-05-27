import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

/**
 * Seed endpoint — creates the default admin user if no users exist.
 *
 * SECURITY: This endpoint ONLY works when zero users exist in the database.
 * Once any user is created, it returns 403.
 * It does NOT return credentials in the response body.
 *
 * NOTE: This route is intentionally public (no auth guard) because it is
 * the bootstrap mechanism for the initial admin account. The self-protecting
 * logic (userCount > 0 → 403) prevents re-execution after seeding.
 */
export async function POST() {
  try {
    // Check if any user exists — if so, refuse to run
    const userCount = await db.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Ya existen usuarios. El seed solo funciona en una base de datos vacía.' },
        { status: 403 }
      );
    }

    // Use the documented default password '2026' for consistency with login screen hint
    const defaultPassword = '2026';

    const hashedPassword = await hashPassword(defaultPassword);

    const user = await db.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Administrador',
        role: 'admin',
        isMaster: true,
        active: true,
      },
    });

    // Create default CenterConfig
    await db.centerConfig.create({
      data: {
        centerName: 'BARAPRO',
        masterUsername: 'admin',
        masterPassword: hashedPassword,
      },
    });

    // SECURITY: Do NOT return the default password in the response.
    // The default credentials are documented in the installation guide.
    return NextResponse.json({
      message: 'Usuario administrador creado exitosamente',
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Error al crear usuario por defecto' },
      { status: 500 }
    );
  }
}
