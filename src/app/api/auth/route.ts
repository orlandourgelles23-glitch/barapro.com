import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, isHashed, hashPassword } from '@/lib/password';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { generateAuthToken } from '@/lib/auth-token';
import { addAuditEntry } from '@/app/api/audit-log/route';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    // Rate limiting
    const rateCheck = checkRateLimit(username);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: `Cuenta bloqueada. Intente nuevamente en ${Math.ceil((rateCheck.lockedUntil!.getTime() - Date.now()) / 60000)} minutos.`,
        lockedUntil: rateCheck.lockedUntil,
      }, { status: 429 });
    }

    // Find user
    const user = await db.user.findFirst({
      where: { username, active: true },
    });

    if (!user) {
      // Audit: failed login (unknown user)
      addAuditEntry({ userId: 'unknown', username, action: 'login_failed', resource: 'auth', details: 'Usuario no encontrado', ip: clientIp });
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      // Audit: failed login (wrong password)
      addAuditEntry({ userId: user.id, username, action: 'login_failed', resource: 'auth', details: `Contraseña incorrecta (${rateCheck.remainingAttempts} intentos restantes)`, ip: clientIp });
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos', remainingAttempts: rateCheck.remainingAttempts }, { status: 401 });
    }

    // Migrate plaintext password to bcrypt
    if (!isHashed(user.password)) {
      const hashed = await hashPassword(password);
      await db.user.update({ where: { id: user.id }, data: { password: hashed } });
    }

    // Reset rate limit on success
    resetRateLimit(username);

    // Generate auth token
    const token = await generateAuthToken(user.id);

    // Audit: successful login
    addAuditEntry({ userId: user.id, username, action: 'login_success', resource: 'auth', details: 'Inicio de sesión exitoso', ip: clientIp });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isMaster: user.isMaster,
      },
      token,
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 500 });
  }
}
