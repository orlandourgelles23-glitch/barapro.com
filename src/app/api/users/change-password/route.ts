import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/password';
import { getAuthUser } from '@/lib/api-auth';

// Common passwords that must be rejected
const COMMON_PASSWORDS = [
  'password', '12345678', 'qwerty12', 'admin123', 'barapro12',
  'password1', 'password12', '123456789', '1234567890',
  'iloveyou', 'qwerty123', 'abc12345', 'letmein12',
];

// POST — Change password
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (newPassword.trim().length < 8) {
      return NextResponse.json({ error: 'La nueva contrasena debe tener al menos 8 caracteres' }, { status: 400 });
    }
    // Require at least one letter and one number
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: 'La nueva contrasena debe contener al menos una letra y un numero' }, { status: 400 });
    }
    // Require at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return NextResponse.json({ error: 'La nueva contrasena debe contener al menos un caracter especial (!@#$%^&*()_+-=[]{}|;:.,<>/?)' }, { status: 400 });
    }
    // Reject common passwords
    if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
      return NextResponse.json({ error: 'La nueva contrasena es demasiado comun. Elija una contrasena mas segura.' }, { status: 400 });
    }

    // Only allow users to change their own password, or admins to change any password
    const isAdmin = currentUser.role === 'admin';
    const isSelf = currentUser.id === userId;

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Find target user
    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verify current password (always required for security)
    const validPassword = await verifyPassword(currentPassword, targetUser.password);
    if (!validPassword) {
      return NextResponse.json({ error: 'La contrasena actual es incorrecta' }, { status: 400 });
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: 'Contrasena cambiada correctamente' });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Error al cambiar la contrasena' }, { status: 500 });
  }
}
