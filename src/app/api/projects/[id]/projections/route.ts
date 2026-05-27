import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import {
  apiSuccess,
  internalError,
  notFound,
  validationError,
  safeParseBody,
} from "@/lib/api-errors";
import {
  validateProjections,
  isUUID,
} from "@/lib/api-validation";
import { getAuthUser } from '@/lib/api-auth';

// Obtener todas las proyecciones anuales de un proyecto
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

    // Verificar que el proyecto existe
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return notFound('Proyecto no encontrado');
    }

    const projections = await db.annualProjection.findMany({
      where: { projectId: id },
      orderBy: { year: "asc" },
    });

    return apiSuccess(projections);
  } catch (error) {
    return internalError(error, "GET /api/projects/[id]/projections");
  }
}

// Crear o actualizar proyecciones anuales (bulk upsert)
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

    // Validate projections structure
    const result = validateProjections(body as Record<string, unknown>);
    if (!result.valid) return validationError(result.errors);

    const { projections } = body as { projections: Record<string, unknown>[] };

    // Verificar que el proyecto existe
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return notFound('Proyecto no encontrado');
    }

    // Eliminar proyecciones existentes y recrear
    await db.annualProjection.deleteMany({ where: { projectId: id } });

    const created = await db.annualProjection.createMany({
      data: projections.map((ap) => ({
        projectId: id,
        year: parseInt(String(ap.year)),
        revenue: parseFloat(String(ap.revenue)) || 0,
        variableCosts: parseFloat(String(ap.variableCosts)) || 0,
        fixedCosts: parseFloat(String(ap.fixedCosts)) || 0,
        depreciation: parseFloat(String(ap.depreciation)) || 0,
      })),
    });

    // Retornar las proyecciones creadas
    const resultProjections = await db.annualProjection.findMany({
      where: { projectId: id },
      orderBy: { year: "asc" },
    });

    return apiSuccess(
      { count: created.count, projections: resultProjections },
      201
    );
  } catch (error) {
    return internalError(error, "POST /api/projects/[id]/projections");
  }
}
