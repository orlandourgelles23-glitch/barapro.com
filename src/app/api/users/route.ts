import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { getAuthUser, requireAdmin } from '@/lib/api-auth';

// Common passwords that must be rejected
const COMMON_PASSWORDS = [
  'password', '12345678', 'qwerty12', 'admin123', 'barapro12',
  'password1', 'password12', '123456789', '1234567890',
  'iloveyou', 'qwerty123', 'abc12345', 'letmein12',
];

// GET — List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);
    if (!currentUser) {
      return NextResponse.json(
        currentUser === null && !request.headers.get('x-user-id')
          ? { error: 'No autorizado' }
          : { error: 'Acceso denegado. Se requiere rol de administrador.' },
        { status: request.headers.get('x-user-id') ? 403 : 401 },
      );
    }

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

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Error al obtener la lista de usuarios' }, { status: 500 });
  }
}

// POST — Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);
    if (!currentUser) {
      return NextResponse.json(
        request.headers.get('x-user-id')
          ? { error: 'Acceso denegado. Se requiere rol de administrador.' }
          : { error: 'No autorizado' },
        { status: request.headers.get('x-user-id') ? 403 : 401 },
      );
    }

    const body = await request.json();
    const { username, password, name, role } = body;

    // Validate required fields
    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'El nombre de usuario es requerido' }, { status: 400 });
    }
    if (!password || !password.trim()) {
      return NextResponse.json({ error: 'La contrasena es requerida' }, { status: 400 });
    }

    // Password strength requirements
    if (password.trim().length < 8) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 8 caracteres' }, { status: 400 });
    }
    // At least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'La contrasena debe contener al menos una letra y un numero' }, { status: 400 });
    }
    // At least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return NextResponse.json({ error: 'La contrasena debe contener al menos un caracter especial (!@#$%^&*()_+-=[]{}|;:.,<>/?)' }, { status: 400 });
    }
    // Reject common passwords
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      return NextResponse.json({ error: 'La contrasena es demasiado comun. Elija una contrasena mas segura.' }, { status: 400 });
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'El rol debe ser "admin" o "user"' }, { status: 400 });
    }

    // Check username uniqueness
    const existingUser = await db.user.findUnique({ where: { username: username.trim() } });
    if (existingUser) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 });
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        name: (name || '').trim(),
        role,
        active: true,
        isMaster: false,
      },
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

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 });
  }
}
