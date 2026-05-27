import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import {
  apiSuccess,
  apiCreated,
  internalError,
  validationError,
  safeParseBody,
} from "@/lib/api-errors";
import {
  validateCreateFinancing,
  isUUID,
} from "@/lib/api-validation";
import { getAuthUser } from '@/lib/api-auth';

// GET - Obtener fuentes de financiamiento de un proyecto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Validate UUID format
    const uuidErr = isUUID(id, 'id');
    if (uuidErr) return validationError([uuidErr]);

    const sources = await db.financingSource.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
    });
    return apiSuccess(sources);
  } catch (error) {
    return internalError(error, "GET /api/projects/[id]/financing");
  }
}

// POST - Crear fuente de financiamiento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Validate UUID format
    const uuidErr = isUUID(id, 'projectId');
    if (uuidErr) return validationError([uuidErr]);

    const { data: body, error: parseError } = await safeParseBody(request);
    if (parseError || !body) return parseError!;

    // Validate financing source fields
    const result = validateCreateFinancing(body as Record<string, unknown>);
    if (!result.valid) return validationError(result.errors);

    const { sourceName, amount, interestRate, term, gracePeriod } = body as Record<string, unknown>;

    const source = await db.financingSource.create({
      data: {
        projectId: id,
        sourceName: sourceName as string,
        amount: parseFloat(String(amount)),
        interestRate: interestRate ? parseFloat(String(interestRate)) : null,
        term: term ? parseInt(String(term)) : null,
        gracePeriod: gracePeriod ? parseInt(String(gracePeriod)) : null,
      },
    });

    return apiCreated(source);
  } catch (error) {
    return internalError(error, "POST /api/projects/[id]/financing");
  }
}
