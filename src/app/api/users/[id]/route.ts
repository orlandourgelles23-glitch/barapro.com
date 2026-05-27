import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/api-auth';

// GET — Get single user (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Error al obtener el usuario' }, { status: 500 });
  }
}

// PUT — Update user (admin only, or user updating their own profile)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const isAdmin = currentUser.role === 'admin';
    const isSelf = currentUser.id === id;

    // Only admin or self can update
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Check target user exists
    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, any> = {};

    if (isAdmin) {
      // Admin can change name, role, active
      if (body.name !== undefined) {
        updateData.name = body.name.trim();
      }
      if (body.role !== undefined) {
        if (!['admin', 'user'].includes(body.role)) {
          return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
        }
        // Prevent changing the last admin's role
        if (targetUser.role === 'admin' && body.role !== 'admin') {
          const adminCount = await db.user.count({ where: { role: 'admin', active: true } });
          if (adminCount <= 1) {
            return NextResponse.json({ error: 'No se puede cambiar el rol del ultimo administrador activo' }, { status: 400 });
          }
        }
        updateData.role = body.role;
      }
      if (body.active !== undefined) {
        updateData.active = body.active;
      }
    } else {
      // Self can only change name
      if (body.name !== undefined) {
        updateData.name = body.name.trim();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron datos para actualizar' }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Error al actualizar el usuario' }, { status: 500 });
  }
}

// DELETE — Deactivate user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { id } = await params;

    // Cannot deactivate self
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'No puede desactivar su propia cuenta' }, { status: 400 });
    }

    // Check target user exists
    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Cannot deactivate master user
    if (targetUser.isMaster) {
      return NextResponse.json({ error: 'No se puede desactivar el usuario maestro' }, { status: 400 });
    }

    // Cannot deactivate the last active admin
    if (targetUser.role === 'admin' && targetUser.active) {
      const adminCount = await db.user.count({ where: { role: 'admin', active: true } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'No se puede desactivar el ultimo administrador activo' }, { status: 400 });
      }
    }

    // Soft delete: set active to false
    await db.user.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ message: 'Usuario desactivado correctamente' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Error al desactivar el usuario' }, { status: 500 });
  }
}
