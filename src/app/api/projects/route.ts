import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import {
  apiSuccess,
  apiCreated,
  internalError,
  validationError,
  unauthorized,
  safeParseBody,
} from "@/lib/api-errors";
import {
  validateCreateProject,
  validateCashFlowItems,
  validateFinancingItems,
  validateInvestmentItems,
} from "@/lib/api-validation";

// Obtener todos los proyectos
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) return unauthorized();

    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
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
    return apiSuccess(projects);
  } catch (error) {
    return internalError(error, "GET /api/projects");
  }
}

// Crear un nuevo proyecto
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) return unauthorized();

    const { data: body, error: parseError } = await safeParseBody(request);
    if (parseError || !body) return parseError!;

    // Validate main fields
    const result = validateCreateProject(body as Record<string, unknown>);
    if (!result.valid) return validationError(result.errors);

    // Validate nested arrays
    const errors = [
      ...(body.cashFlows ? validateCashFlowItems(body.cashFlows as unknown[]) : []),
      ...(body.financingSources ? validateFinancingItems(body.financingSources as unknown[]) : []),
      ...(body.investmentItems ? validateInvestmentItems(body.investmentItems as unknown[]) : []),
    ];
    if (errors.length > 0) return validationError(errors);

    const {
      name,
      description,
      initialInvestment,
      discountRate,
      annualCosts,
      annualRevenue,
      projectDuration,
      cashFlows,
      // BARAPRO fields originales
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
      // Nuevos campos BARAPRO
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

    const project = await db.project.create({
      data: {
        name: name as string,
        description: (description as string) || null,
        initialInvestment: parseFloat(String(initialInvestment)),
        discountRate: parseFloat(String(discountRate)),
        annualCosts: parseFloat(String(annualCosts)) || 0,
        annualRevenue: parseFloat(String(annualRevenue)) || 0,
        projectDuration: parseInt(String(projectDuration)),
        // BARAPRO fields originales
        projectType: (projectType as string) || "nuevo",
        pdlCategory: (pdlCategory as string) || "economico_productivo",
        entity: (entity as string) || null,
        responsible: (responsible as string) || null,
        location: (location as string) || null,
        currency: (currency as string) || "CUP",
        taxRateSales: parseFloat(String(taxRateSales)) || 10,
        taxRateIncome: parseFloat(String(taxRateIncome)) || 15,
        socialSecurityContribution: parseFloat(String(socialSecurityContribution)) || 0,
        laborForceTax: parseFloat(String(laborForceTax)) || 0,
        localDevelopmentContribution: parseFloat(String(localDevelopmentContribution)) || 0,
        generalExpensesCoefficient: parseFloat(String(generalExpensesCoefficient)) || 0,
        adminExpensesCoefficient: parseFloat(String(adminExpensesCoefficient)) || 0,
        productionExpensesCoefficient: parseFloat(String(productionExpensesCoefficient)) || 0,
        scenarioOptimist: parseFloat(String(scenarioOptimist)) || 0.10,
        scenarioPessimist: parseFloat(String(scenarioPessimist)) || -0.10,
        objectiveGeneral: (objectiveGeneral as string) || null,
        objectiveSpecific: (objectiveSpecific as string) || null,
        assumptions: (assumptions as string) || null,
        // Nuevos campos BARAPRO
        fixedCosts: parseFloat(String(fixedCosts)) || 0,
        variableCosts: parseFloat(String(variableCosts)) || 0,
        financeRate: financeRate !== undefined && financeRate !== null ? parseFloat(String(financeRate)) : null,
        reinvestRate: reinvestRate !== undefined && reinvestRate !== null ? parseFloat(String(reinvestRate)) : null,
        contingencyReserveRate: parseFloat(String(contingencyReserveRate)) || 0,
        retainedEarningsRate: parseFloat(String(retainedEarningsRate)) || 50,
        discountRatesByYear: typeof discountRatesByYear === "string" ? discountRatesByYear : (discountRatesByYear ? JSON.stringify(discountRatesByYear) : ""),
        scenarioInvestPessimist: parseFloat(String(scenarioInvestPessimist)) || 0.10,
        scenarioInvestOptimist: parseFloat(String(scenarioInvestOptimist)) || -0.05,
        scenarioRevenuePessimist: parseFloat(String(scenarioRevenuePessimist)) || -0.20,
        scenarioRevenueOptimist: parseFloat(String(scenarioRevenueOptimist)) || 0.05,
        scenarioCostsPessimist: parseFloat(String(scenarioCostsPessimist)) || 0.15,
        scenarioCostsOptimist: parseFloat(String(scenarioCostsOptimist)) || 0.05,
        // Relaciones
        cashFlows: cashFlows
          ? {
              create: (cashFlows as unknown[]).map((cf) => {
                const c = cf as Record<string, unknown>;
                return {
                  period: Number(c.period),
                  amount: Number(c.amount),
                  type: (c.type as string) || "net",
                };
              }),
            }
          : undefined,
        financingSources: financingSources
          ? {
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
            }
          : undefined,
        investmentItems: investmentItems
          ? {
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
            }
          : undefined,
        annualProjections: annualProjections
          ? {
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
            }
          : undefined,
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

    return apiCreated(project);
  } catch (error) {
    return internalError(error, "POST /api/projects");
  }
}
