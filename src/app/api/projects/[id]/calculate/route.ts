import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import {
  apiSuccess,
  internalError,
  notFound,
} from "@/lib/api-errors";
import { isUUID } from "@/lib/api-validation";
import {
  calculateAllIndicators,
  generateCashFlows,
} from "@/lib/financial-calculations";
import { getAuthUser } from '@/lib/api-auth';

// Calcular indicadores financieros de un proyecto
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
    const uuidErr = isUUID(id, 'id');
    if (uuidErr) {
      const { validationError } = await import("@/lib/api-errors");
      return validationError([uuidErr]);
    }

    const project = await db.project.findUnique({
      where: { id },
      include: {
        cashFlows: {
          orderBy: { period: "asc" },
        },
        financingSources: true,
        investmentItems: true,
        annualProjections: {
          orderBy: { year: "asc" },
        },
      },
    });

    if (!project) {
      return notFound('Proyecto no encontrado');
    }

    // Obtener flujos de caja o generarlos automáticamente
    let cashFlows: number[];

    if (project.cashFlows.length > 0) {
      cashFlows = project.cashFlows.map((cf) => cf.amount);
    } else {
      cashFlows = generateCashFlows(
        project.initialInvestment,
        project.annualRevenue,
        project.annualCosts,
        project.projectDuration
      );
    }

    // Convertir tasa de descuento de porcentaje a decimal
    const discountRate = project.discountRate / 100;

    // Parsear tasas de descuento por año (JSON string a array)
    let discountRatesByYear: number[] | undefined;
    if (project.discountRatesByYear) {
      try {
        const parsed = JSON.parse(project.discountRatesByYear);
        if (Array.isArray(parsed) && parsed.length > 0) {
          discountRatesByYear = parsed.map((r: number) => Number(r));
        }
      } catch {
        discountRatesByYear = undefined;
      }
    }

    // Mapear fuentes de financiamiento
    const financingSources = project.financingSources.map((fs) => ({
      sourceName: fs.sourceName,
      amount: fs.amount,
      interestRate: fs.interestRate,
      term: fs.term,
      gracePeriod: fs.gracePeriod,
    }));

    // Mapear partidas de inversión
    const investmentItems = project.investmentItems.map((ii) => ({
      itemName: ii.itemName,
      quantity: ii.quantity,
      unitPrice: ii.unitPrice,
      usefulLife: ii.usefulLife,
    }));

    // Calcular todos los indicadores con parámetros completos BARAPRO
    const result = calculateAllIndicators(
      project.initialInvestment,
      discountRate,
      cashFlows,
      project.annualRevenue,
      project.annualCosts,
      project.projectDuration,
      project.scenarioOptimist,
      project.scenarioPessimist,
      {
        fixedCosts: project.fixedCosts || undefined,
        variableCosts: project.variableCosts || undefined,
        financeRate: project.financeRate ? project.financeRate / 100 : undefined,
        reinvestRate: project.reinvestRate ? project.reinvestRate / 100 : undefined,
        contingencyReserveRate: project.contingencyReserveRate,
        retainedEarningsRate: project.retainedEarningsRate,
        discountRatesByYear,
        financingSources,
        investmentItems,
        taxRateSales: project.taxRateSales,
        taxRateIncome: project.taxRateIncome,
        generalExpensesCoefficient: project.generalExpensesCoefficient,
        scenarioInvestPessimist: project.scenarioInvestPessimist,
        scenarioInvestOptimist: project.scenarioInvestOptimist,
        scenarioRevenuePessimist: project.scenarioRevenuePessimist,
        scenarioRevenueOptimist: project.scenarioRevenueOptimist,
        scenarioCostsPessimist: project.scenarioCostsPessimist,
        scenarioCostsOptimist: project.scenarioCostsOptimist,
      }
    );

    return apiSuccess(result);
  } catch (error) {
    return internalError(error, "POST /api/projects/[id]/calculate");
  }
}
