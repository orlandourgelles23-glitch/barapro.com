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
  validateCreateInvestmentItem,
  isUUID,
} from "@/lib/api-validation";
import { getAuthUser } from '@/lib/api-auth';

// GET - Obtener partidas de inversión de un proyecto
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

    const items = await db.investmentItem.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
    });
    return apiSuccess(items);
  } catch (error) {
    return internalError(error, "GET /api/projects/[id]/investment-items");
  }
}

// POST - Crear partida de inversión
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

    // Validate investment item fields
    const result = validateCreateInvestmentItem(body as Record<string, unknown>);
    if (!result.valid) return validationError(result.errors);

    const { category, itemName, quantity, unitPrice, usefulLife, depreciationRate, currency } = body as Record<string, unknown>;

    const item = await db.investmentItem.create({
      data: {
        projectId: id,
        category: category as string,
        itemName: itemName as string,
        quantity: parseFloat(String(quantity)),
        unitPrice: parseFloat(String(unitPrice)),
        usefulLife: usefulLife ? parseInt(String(usefulLife)) : null,
        depreciationRate: depreciationRate ? parseFloat(String(depreciationRate)) : null,
        currency: (currency as string) || "CUP",
      },
    });

    return apiCreated(item);
  } catch (error) {
    return internalError(error, "POST /api/projects/[id]/investment-items");
  }
}
