import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Require authentication for file downloads
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    const fileName = request.nextUrl.searchParams.get('file') || 'BARAPRO_v10.2_COMPLETE.zip';
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.resolve(publicDir, fileName);

    // Security: prevent path traversal
    if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileName.endsWith('.zip') ? 'application/zip' : 'text/markdown',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Download ZIP error:', error);
    return NextResponse.json({ error: 'Error al descargar el archivo' }, { status: 500 });
  }
}
