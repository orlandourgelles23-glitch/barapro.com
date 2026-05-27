import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const start = Date.now();
  try {
    // Check database connectivity
    await db.user.count();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: 'connected',
      responseTime: `${Date.now() - start}ms`,
      version: '11',
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: 'disconnected',
      error: 'Error de conexión',
      responseTime: `${Date.now() - start}ms`,
      version: '11',
    }, { status: 503 });
  }
}
