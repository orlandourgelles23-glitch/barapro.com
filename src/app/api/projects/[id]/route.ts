import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import {
  apiSuccess,
  apiDeleted,
  internalError,
  validationError,
  notFound,
  safeParseBody,
} from "@/lib/api-errors";
import {
  validateUpdateProject,
  validateCashFlowItems,
  validateFinancingItems,
  validateInvestmentItems,
  isUUID,
} from "@/lib/api-validation";
import { getAuthUser } from '@/lib/api-auth';

// Obtener un proyecto por ID
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

    return apiSuccess(project);
  } catch (error) {
    return internalError(error, "GET /api/projects/[id]");
  }
}

// Actualizar un proyecto
export async function PUT(
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

    const { data: body, error: parseError } = await safeParseBody(request);
    if (parseError || !body) return parseError!;

    // Validate update fields
    const result = validateUpdateProject(body as Record<string, unknown>);
    if (!result.valid) return validationError(result.errors);

    // Validate nested arrays if present
    const errors = [
      ...(body.cashFlows ? validateCashFlowItems(body.cashFlows as unknown[]) : []),
      ...(body.financingSources ? validateFinancingItems(body.financingSources as unknown[]) : []),
      ...(body.investmentItems ? validateInvestmentItems(body.investmentItems as unknown[]) : []),
    ];
    if (errors.length > 0) return validationError(errors);

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Proyecto no encontrado');
    }

    const {
      name,
      description,
      initialInvestment,
      discountRate,
      annualCosts,
      annualRevenue,
      projectDuration,
      cashFlows,
      projectType,
      pdlCategory,
      entity,
      responsible,
      location,
      currency,
      taxRateSales,
      taxRateIncome,
      socialSecurityContribution,
      laborForceTax,
      localDevelopmentContribution,
      generalExpensesCoefficient,
      adminExpensesCoefficient,
      productionExpensesCoefficient,
      scenarioOptimist,
      scenarioPessimist,
      objectiveGeneral,
      objectiveSpecific,
      assumptions,
      financingSources,
      investmentItems,
      fixedCosts,
      variableCosts,
      financeRate,
      reinvestRate,
      contingencyReserveRate,
      retainedEarningsRate,
      discountRatesByYear,
      scenarioInvestPessimist,
      scenarioInvestOptimist,
      scenarioRevenuePessimist,
      scenarioRevenueOptimist,
      scenarioCostsPessimist,
      scenarioCostsOptimist,
      annualProjections,
    } = body as Record<string, unknown>;

    // ─── Transactional delete+update+create — atomic for data safety ────────
    const project = await db.$transaction(async (tx) => {
      // Eliminar datos relacionados existentes
      if (body.cashFlows) {
        await tx.cashFlow.deleteMany({ where: { projectId: id } });
      }
      if (body.financingSources) {
        await tx.financingSource.deleteMany({ where: { projectId: id } });
      }
      if (body.investmentItems) {
        await tx.investmentItem.deleteMany({ where: { projectId: id } });
      }
      if (body.annualProjections) {
        await tx.annualProjection.deleteMany({ where: { projectId: id } });
      }

      // Actualizar proyecto y recrear relaciones
      return tx.project.update({
        where: { id },
        data: {
          name: name != null ? (name as string) : existing.name,
          description: description !== undefined ? (description as string) : existing.description,
          initialInvestment: initialInvestment !== undefined ? parseFloat(String(initialInvestment)) : existing.initialInvestment,
          discountRate: discountRate !== undefined ? parseFloat(String(discountRate)) : existing.discountRate,
          annualCosts: annualCosts !== undefined ? parseFloat(String(annualCosts)) : existing.annualCosts,
          annualRevenue: annualRevenue !== undefined ? parseFloat(String(annualRevenue)) : existing.annualRevenue,
          projectDuration: projectDuration !== undefined ? parseInt(String(projectDuration)) : existing.projectDuration,
          projectType: projectType !== undefined ? (projectType as string) : existing.projectType,
          pdlCategory: pdlCategory !== undefined ? (pdlCategory as string) : existing.pdlCategory,
          entity: entity !== undefined ? (entity as string) : existing.entity,
          responsible: responsible !== undefined ? (responsible as string) : existing.responsible,
          location: location !== undefined ? (location as string) : existing.location,
          currency: currency !== undefined ? (currency as string) : existing.currency,
          taxRateSales: taxRateSales !== undefined ? parseFloat(String(taxRateSales)) : existing.taxRateSales,
          taxRateIncome: taxRateIncome !== undefined ? parseFloat(String(taxRateIncome)) : existing.taxRateIncome,
          socialSecurityContribution: socialSecurityContribution !== undefined ? parseFloat(String(socialSecurityContribution)) : existing.socialSecurityContribution,
          laborForceTax: laborForceTax !== undefined ? parseFloat(String(laborForceTax)) : existing.laborForceTax,
          localDevelopmentContribution: localDevelopmentContribution !== undefined ? parseFloat(String(localDevelopmentContribution)) : existing.localDevelopmentContribution,
          generalExpensesCoefficient: generalExpensesCoefficient !== undefined ? parseFloat(String(generalExpensesCoefficient)) : existing.generalExpensesCoefficient,
          adminExpensesCoefficient: adminExpensesCoefficient !== undefined ? parseFloat(String(adminExpensesCoefficient)) : existing.adminExpensesCoefficient,
          productionExpensesCoefficient: productionExpensesCoefficient !== undefined ? parseFloat(String(productionExpensesCoefficient)) : existing.productionExpensesCoefficient,
          scenarioOptimist: scenarioOptimist !== undefined ? parseFloat(String(scenarioOptimist)) : existing.scenarioOptimist,
          scenarioPessimist: scenarioPessimist !== undefined ? parseFloat(String(scenarioPessimist)) : existing.scenarioPessimist,
          objectiveGeneral: objectiveGeneral !== undefined ? (objectiveGeneral as string) : existing.objectiveGeneral,
          objectiveSpecific: objectiveSpecific !== undefined ? (objectiveSpecific as string) : existing.objectiveSpecific,
          assumptions: assumptions !== undefined ? (assumptions as string) : existing.assumptions,
          fixedCosts: fixedCosts !== undefined ? parseFloat(String(fixedCosts)) : existing.fixedCosts,
          variableCosts: variableCosts !== undefined ? parseFloat(String(variableCosts)) : existing.variableCosts,
          financeRate: financeRate !== undefined ? (financeRate !== null ? parseFloat(String(financeRate)) : undefined) : existing.financeRate,
          reinvestRate: reinvestRate !== undefined ? (reinvestRate !== null ? parseFloat(String(reinvestRate)) : undefined) : existing.reinvestRate,
          contingencyReserveRate: contingencyReserveRate !== undefined ? parseFloat(String(contingencyReserveRate)) : existing.contingencyReserveRate,
          retainedEarningsRate: retainedEarningsRate !== undefined ? parseFloat(String(retainedEarningsRate)) : existing.retainedEarningsRate,
          discountRatesByYear: discountRatesByYear !== undefined ? (typeof discountRatesByYear === "string" ? discountRatesByYear : JSON.stringify(discountRatesByYear)) : existing.discountRatesByYear,
          scenarioInvestPessimist: scenarioInvestPessimist !== undefined ? parseFloat(String(scenarioInvestPessimist)) : existing.scenarioInvestPessimist,
          scenarioInvestOptimist: scenarioInvestOptimist !== undefined ? parseFloat(String(scenarioInvestOptimist)) : existing.scenarioInvestOptimist,
          scenarioRevenuePessimist: scenarioRevenuePessimist !== undefined ? parseFloat(String(scenarioRevenuePessimist)) : existing.scenarioRevenuePessimist,
          scenarioRevenueOptimist: scenarioRevenueOptimist !== undefined ? parseFloat(String(scenarioRevenueOptimist)) : existing.scenarioRevenueOptimist,
          scenarioCostsPessimist: scenarioCostsPessimist !== undefined ? parseFloat(String(scenarioCostsPessimist)) : existing.scenarioCostsPessimist,
          scenarioCostsOptimist: scenarioCostsOptimist !== undefined ? parseFloat(String(scenarioCostsOptimist)) : existing.scenarioCostsOptimist,
          // Relaciones (recrear si se envían)
          ...(cashFlows
            ? {
                cashFlows: {
                  create: (cashFlows as unknown[]).map((cf) => {
                    const c = cf as Record<string, unknown>;
                    return {
                      period: Number(c.period),
                      amount: Number(c.amount),
                      type: (c.type as string) || "net",
                    };
                  }),
                },
              }
            : {}),
          ...(financingSources
            ? {
                financingSources: {
                  create: (financingSources as unknown[]).map((fs) => {
                    const f = fs as Record<string, unknown>;
                    return {
                      sourceName: f.sourceName as string,
                      amount: Number(f.amount),
                      interestRate: f.interestRate != null ? Number(f.interestRate) : null,
                      term: f.term != null ? Number(f.term) : null,
                      gracePeriod: f.gracePeriod != null ? Number(f.gracePeriod) : null,
                    };
                  }),
                },
              }
            : {}),
          ...(investmentItems
            ? {
                investmentItems: {
                  create: (investmentItems as unknown[]).map((ii) => {
                    const it = ii as Record<string, unknown>;
                    return {
                      category: it.category as string,
                      itemName: it.itemName as string,
                      quantity: Number(it.quantity),
                      unitPrice: Number(it.unitPrice),
                      usefulLife: it.usefulLife != null ? Number(it.usefulLife) : null,
                      depreciationRate: it.depreciationRate != null ? Number(it.depreciationRate) : null,
                      currency: (it.currency as string) || "CUP",
                    };
                  }),
                },
              }
            : {}),
          ...(annualProjections
            ? {
                annualProjections: {
                  create: (annualProjections as unknown[]).map((ap) => {
                    const a = ap as Record<string, unknown>;
                    return {
                      year: Number(a.year),
                      revenue: Number(a.revenue) || 0,
                      variableCosts: Number(a.variableCosts) || 0,
                      fixedCosts: Number(a.fixedCosts) || 0,
                      depreciation: Number(a.depreciation) || 0,
                    };
                  }),
                },
              }
            : {}),
        },
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
    });

    return apiSuccess(project);
  } catch (error) {
    return internalError(error, "PUT /api/projects/[id]");
  }
}

// Eliminar un proyecto
export async function DELETE(
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

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Proyecto no encontrado');
    }

    await db.project.delete({ where: { id } });
    return apiDeleted('Proyecto eliminado correctamente');
  } catch (error) {
    return internalError(error, "DELETE /api/projects/[id]");
  }
}
