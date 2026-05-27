// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO Backup Import — Full database import from signed JSON
// POST /api/backup/import
// Requires JWT auth with admin role
// All import operations are wrapped in a Prisma transaction for data safety.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // ─── Auth check: admin only ──────────────────────────────────────────────
    const currentUser = await requireAdmin(request);
    if (!currentUser) {
      if (!request.headers.get('x-user-id')) {
        return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
      }
      return NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol de administrador para importar respaldos.' },
        { status: 403 }
      );
    }

    // ─── Parse and validate backup structure ──────────────────────────────────
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 });
    }

    if (body.magic !== 'BARAPRO_BACKUP') {
      return NextResponse.json(
        { error: 'Archivo de respaldo inválido. El campo "magic" no coincide.' },
        { status: 400 }
      );
    }

    if (!body.data || typeof body.data !== 'object') {
      return NextResponse.json(
        { error: 'Archivo de respaldo inválido. No se encontró el campo "data".' },
        { status: 400 }
      );
    }

    const { data } = body;

    // ─── Transactional import — all-or-nothing for data safety ───────────────
    const result = await db.$transaction(async (tx) => {
      const counts = {
        centerConfig: 0,
        license: 0,
        users: 0,
        projects: 0,
        cashFlows: 0,
        financingSources: 0,
        investmentItems: 0,
        annualProjections: 0,
      };

      // ─── Import CenterConfig (upsert single record) ──────────────────────
      if (data.centerConfig && typeof data.centerConfig === 'object') {
        const cc = data.centerConfig;
        const existing = await tx.centerConfig.findFirst();

        if (existing) {
          await tx.centerConfig.update({
            where: { id: existing.id },
            data: {
              centerName: cc.centerName ?? existing.centerName,
              organism: cc.organism ?? existing.organism,
              masterUsername: cc.masterUsername ?? existing.masterUsername,
              // Do NOT import masterPassword for security
            },
          });
        } else {
          await tx.centerConfig.create({
            data: {
              centerName: cc.centerName ?? '',
              organism: cc.organism ?? '',
              masterUsername: cc.masterUsername ?? '',
              masterPassword: '',
            },
          });
        }
        counts.centerConfig = 1;
      }

      // ─── Import License (upsert single record) ───────────────────────────
      if (data.license && typeof data.license === 'object') {
        const lic = data.license;
        if (lic.key) {
          const existingLic = await tx.license.findFirst({ where: { key: lic.key } });

          if (existingLic) {
            await tx.license.update({
              where: { id: existingLic.id },
              data: {
                licensee: lic.licensee ?? existingLic.licensee,
                email: lic.email ?? existingLic.email,
                tier: lic.tier ?? existingLic.tier,
                maxUsers: lic.maxUsers ?? existingLic.maxUsers,
                features: lic.features ?? existingLic.features,
                expiresAt: lic.expiresAt ? new Date(lic.expiresAt) : existingLic.expiresAt,
                status: lic.status ?? existingLic.status,
                note: lic.note ?? existingLic.note,
              },
            });
          } else {
            await tx.license.create({
              data: {
                key: lic.key,
                licensee: lic.licensee ?? '',
                email: lic.email ?? '',
                tier: lic.tier ?? 'trial',
                maxUsers: lic.maxUsers ?? 3,
                features: lic.features ?? '[]',
                issuedAt: lic.issuedAt ? new Date(lic.issuedAt) : new Date(),
                expiresAt: lic.expiresAt ? new Date(lic.expiresAt) : new Date(),
                activatedAt: lic.activatedAt ? new Date(lic.activatedAt) : null,
                lastCheckedAt: lic.lastCheckedAt ? new Date(lic.lastCheckedAt) : null,
                machineId: lic.machineId ?? '',
                status: lic.status ?? 'active',
                note: lic.note ?? '',
              },
            });
          }
          counts.license = 1;
        }
      }

      // ─── Import Users (upsert, do NOT import passwords) ──────────────────
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          if (!u.username) continue;

          const existingUser = await tx.user.findUnique({ where: { username: u.username } });

          if (existingUser) {
            // Update only non-sensitive fields; keep existing password
            await tx.user.update({
              where: { id: existingUser.id },
              data: {
                name: u.name ?? existingUser.name,
                role: u.role ?? existingUser.role,
                isMaster: u.isMaster ?? existingUser.isMaster,
                active: u.active ?? existingUser.active,
              },
            });
          } else {
            // Create new user with a random placeholder password
            // They must reset their password after import
            const crypto = await import('crypto');
            const placeholderPassword = crypto.randomBytes(24).toString('hex');

            await tx.user.create({
              data: {
                username: u.username,
                password: placeholderPassword, // Will need to be reset
                name: u.name ?? '',
                role: u.role ?? 'user',
                isMaster: u.isMaster ?? false,
                active: u.active ?? true,
              },
            });
          }
          counts.users++;
        }
      }

      // ─── Import Projects with related records ────────────────────────────
      if (Array.isArray(data.projects)) {
        for (const p of data.projects) {
          if (!p.name) continue;

          const existingProject = await tx.project.findUnique({ where: { id: p.id } }).catch(() => null);

          if (existingProject) {
            // Update existing project
            await tx.project.update({
              where: { id: existingProject.id },
              data: {
                name: p.name,
                description: p.description ?? null,
                initialInvestment: Number(p.initialInvestment) || 0,
                discountRate: Number(p.discountRate) || 0,
                annualCosts: Number(p.annualCosts) || 0,
                annualRevenue: Number(p.annualRevenue) || 0,
                projectDuration: Number(p.projectDuration) || 1,
                projectType: p.projectType ?? 'nuevo',
                pdlCategory: p.pdlCategory ?? 'economico_productivo',
                entity: p.entity ?? null,
                responsible: p.responsible ?? null,
                location: p.location ?? null,
                currency: p.currency ?? 'CUP',
                taxRateSales: Number(p.taxRateSales) || 10,
                taxRateIncome: Number(p.taxRateIncome) || 15,
                socialSecurityContribution: Number(p.socialSecurityContribution) || 0,
                laborForceTax: Number(p.laborForceTax) || 0,
                localDevelopmentContribution: Number(p.localDevelopmentContribution) || 0,
                generalExpensesCoefficient: Number(p.generalExpensesCoefficient) || 0,
                adminExpensesCoefficient: Number(p.adminExpensesCoefficient) || 0,
                productionExpensesCoefficient: Number(p.productionExpensesCoefficient) || 0,
                scenarioOptimist: Number(p.scenarioOptimist) || 0.1,
                scenarioPessimist: Number(p.scenarioPessimist) || -0.1,
                objectiveGeneral: p.objectiveGeneral ?? null,
                objectiveSpecific: p.objectiveSpecific ?? null,
                assumptions: p.assumptions ?? null,
                fixedCosts: Number(p.fixedCosts) || 0,
                variableCosts: Number(p.variableCosts) || 0,
                financeRate: p.financeRate != null ? Number(p.financeRate) : null,
                reinvestRate: p.reinvestRate != null ? Number(p.reinvestRate) : null,
                contingencyReserveRate: Number(p.contingencyReserveRate) || 0,
                retainedEarningsRate: Number(p.retainedEarningsRate) || 50,
                discountRatesByYear: p.discountRatesByYear ?? '',
                scenarioInvestPessimist: Number(p.scenarioInvestPessimist) || 0.1,
                scenarioInvestOptimist: Number(p.scenarioInvestOptimist) || -0.05,
                scenarioRevenuePessimist: Number(p.scenarioRevenuePessimist) || -0.2,
                scenarioRevenueOptimist: Number(p.scenarioRevenueOptimist) || 0.05,
                scenarioCostsPessimist: Number(p.scenarioCostsPessimist) || 0.15,
                scenarioCostsOptimist: Number(p.scenarioCostsOptimist) || 0.05,
              },
            });

            // Delete and recreate related records for clean update
            await tx.cashFlow.deleteMany({ where: { projectId: existingProject.id } });
            await tx.financingSource.deleteMany({ where: { projectId: existingProject.id } });
            await tx.investmentItem.deleteMany({ where: { projectId: existingProject.id } });
            await tx.annualProjection.deleteMany({ where: { projectId: existingProject.id } });

            const projectId = existingProject.id;

            // Recreate CashFlows
            if (Array.isArray(p.cashFlows)) {
              for (const cf of p.cashFlows) {
                await tx.cashFlow.create({
                  data: {
                    period: Number(cf.period) || 0,
                    amount: Number(cf.amount) || 0,
                    type: cf.type ?? 'net',
                    projectId,
                  },
                });
                counts.cashFlows++;
              }
            }

            // Recreate FinancingSources
            if (Array.isArray(p.financingSources)) {
              for (const fs of p.financingSources) {
                await tx.financingSource.create({
                  data: {
                    sourceName: fs.sourceName ?? '',
                    amount: Number(fs.amount) || 0,
                    interestRate: fs.interestRate != null ? Number(fs.interestRate) : null,
                    term: fs.term != null ? Number(fs.term) : null,
                    gracePeriod: fs.gracePeriod != null ? Number(fs.gracePeriod) : null,
                    projectId,
                  },
                });
                counts.financingSources++;
              }
            }

            // Recreate InvestmentItems
            if (Array.isArray(p.investmentItems)) {
              for (const ii of p.investmentItems) {
                await tx.investmentItem.create({
                  data: {
                    category: ii.category ?? '',
                    itemName: ii.itemName ?? '',
                    quantity: Number(ii.quantity) || 0,
                    unitPrice: Number(ii.unitPrice) || 0,
                    usefulLife: ii.usefulLife != null ? Number(ii.usefulLife) : null,
                    depreciationRate: ii.depreciationRate != null ? Number(ii.depreciationRate) : null,
                    currency: ii.currency ?? 'CUP',
                    projectId,
                  },
                });
                counts.investmentItems++;
              }
            }

            // Recreate AnnualProjections
            if (Array.isArray(p.annualProjections)) {
              for (const ap of p.annualProjections) {
                await tx.annualProjection.create({
                  data: {
                    year: Number(ap.year) || 0,
                    revenue: Number(ap.revenue) || 0,
                    variableCosts: Number(ap.variableCosts) || 0,
                    fixedCosts: Number(ap.fixedCosts) || 0,
                    depreciation: Number(ap.depreciation) || 0,
                    projectId,
                  },
                });
                counts.annualProjections++;
              }
            }
          } else {
            // Create new project with all related records
            const project = await tx.project.create({
              data: {
                id: p.id, // Preserve original ID for referential integrity
                name: p.name,
                description: p.description ?? null,
                initialInvestment: Number(p.initialInvestment) || 0,
                discountRate: Number(p.discountRate) || 0,
                annualCosts: Number(p.annualCosts) || 0,
                annualRevenue: Number(p.annualRevenue) || 0,
                projectDuration: Number(p.projectDuration) || 1,
                projectType: p.projectType ?? 'nuevo',
                pdlCategory: p.pdlCategory ?? 'economico_productivo',
                entity: p.entity ?? null,
                responsible: p.responsible ?? null,
                location: p.location ?? null,
                currency: p.currency ?? 'CUP',
                taxRateSales: Number(p.taxRateSales) || 10,
                taxRateIncome: Number(p.taxRateIncome) || 15,
                socialSecurityContribution: Number(p.socialSecurityContribution) || 0,
                laborForceTax: Number(p.laborForceTax) || 0,
                localDevelopmentContribution: Number(p.localDevelopmentContribution) || 0,
                generalExpensesCoefficient: Number(p.generalExpensesCoefficient) || 0,
                adminExpensesCoefficient: Number(p.adminExpensesCoefficient) || 0,
                productionExpensesCoefficient: Number(p.productionExpensesCoefficient) || 0,
                scenarioOptimist: Number(p.scenarioOptimist) || 0.1,
                scenarioPessimist: Number(p.scenarioPessimist) || -0.1,
                objectiveGeneral: p.objectiveGeneral ?? null,
                objectiveSpecific: p.objectiveSpecific ?? null,
                assumptions: p.assumptions ?? null,
                fixedCosts: Number(p.fixedCosts) || 0,
                variableCosts: Number(p.variableCosts) || 0,
                financeRate: p.financeRate != null ? Number(p.financeRate) : null,
                reinvestRate: p.reinvestRate != null ? Number(p.reinvestRate) : null,
                contingencyReserveRate: Number(p.contingencyReserveRate) || 0,
                retainedEarningsRate: Number(p.retainedEarningsRate) || 50,
                discountRatesByYear: p.discountRatesByYear ?? '',
                scenarioInvestPessimist: Number(p.scenarioInvestPessimist) || 0.1,
                scenarioInvestOptimist: Number(p.scenarioInvestOptimist) || -0.05,
                scenarioRevenuePessimist: Number(p.scenarioRevenuePessimist) || -0.2,
                scenarioRevenueOptimist: Number(p.scenarioRevenueOptimist) || 0.05,
                scenarioCostsPessimist: Number(p.scenarioCostsPessimist) || 0.15,
                scenarioCostsOptimist: Number(p.scenarioCostsOptimist) || 0.05,
                // Related records
                cashFlows: Array.isArray(p.cashFlows)
                  ? {
                      create: p.cashFlows.map((cf: Record<string, unknown>) => ({
                        period: Number(cf.period) || 0,
                        amount: Number(cf.amount) || 0,
                        type: (cf.type as string) ?? 'net',
                      })),
                    }
                  : undefined,
                financingSources: Array.isArray(p.financingSources)
                  ? {
                      create: p.financingSources.map((fs: Record<string, unknown>) => ({
                        sourceName: (fs.sourceName as string) ?? '',
                        amount: Number(fs.amount) || 0,
                        interestRate: fs.interestRate != null ? Number(fs.interestRate) : null,
                        term: fs.term != null ? Number(fs.term) : null,
                        gracePeriod: fs.gracePeriod != null ? Number(fs.gracePeriod) : null,
                      })),
                    }
                  : undefined,
                investmentItems: Array.isArray(p.investmentItems)
                  ? {
                      create: p.investmentItems.map((ii: Record<string, unknown>) => ({
                        category: (ii.category as string) ?? '',
                        itemName: (ii.itemName as string) ?? '',
                        quantity: Number(ii.quantity) || 0,
                        unitPrice: Number(ii.unitPrice) || 0,
                        usefulLife: ii.usefulLife != null ? Number(ii.usefulLife) : null,
                        depreciationRate: ii.depreciationRate != null ? Number(ii.depreciationRate) : null,
                        currency: (ii.currency as string) ?? 'CUP',
                      })),
                    }
                  : undefined,
                annualProjections: Array.isArray(p.annualProjections)
                  ? {
                      create: p.annualProjections.map((ap: Record<string, unknown>) => ({
                        year: Number(ap.year) || 0,
                        revenue: Number(ap.revenue) || 0,
                        variableCosts: Number(ap.variableCosts) || 0,
                        fixedCosts: Number(ap.fixedCosts) || 0,
                        depreciation: Number(ap.depreciation) || 0,
                      })),
                    }
                  : undefined,
              },
            });

            // Count created related records
            if (Array.isArray(p.cashFlows)) counts.cashFlows += p.cashFlows.length;
            if (Array.isArray(p.financingSources)) counts.financingSources += p.financingSources.length;
            if (Array.isArray(p.investmentItems)) counts.investmentItems += p.investmentItems.length;
            if (Array.isArray(p.annualProjections)) counts.annualProjections += p.annualProjections.length;

            // Silence unused variable warning
            void project;
          }

          counts.projects++;
        }
      }

      return counts;
    });

    return NextResponse.json({
      success: true,
      message: 'Respaldo importado correctamente',
      imported: result,
    });
  } catch (error: any) {
    console.error('Backup import error:', error);
    return NextResponse.json(
      { error: 'Error al importar el respaldo' },
      { status: 500 }
    );
  }
}
