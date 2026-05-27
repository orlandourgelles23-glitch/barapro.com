import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { exportToDocxBuffer } from '@/lib/barapro-docx';
import type { BaraproState } from '@/lib/barapro-store';

// ============================================================
// DOCX EXPORT API ROUTE
// Generates the DOCX file server-side using Packer.toBuffer()
// This is more reliable than client-side Packer.toBlob()
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Require authentication for document export
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
    }

    // Parse the state data from the request body
    const stateData = await request.json();

    // The client sends only data properties (no functions)
    // We need to create a compatible state object
    const state = stateData as BaraproState;

    // Generate DOCX buffer server-side
    const buffer = await exportToDocxBuffer(state);

    // Get filename from state
    const projectName = state.project?.projectName || 'Proyecto';
    const safeName = projectName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_Reporte_BARAPRO.docx`;

    // Return the DOCX file with proper headers
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { error: 'Error al generar el documento Word' },
      { status: 500 },
    );
  }
}
