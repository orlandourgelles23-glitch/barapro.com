/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * BARAPRO v10.4 — init-db.js
 *
 * Standalone database initializer that uses the PRE-GENERATED @prisma/client
 * directly — no Prisma CLI, no engine downloads, no network needed.
 *
 * This script:
 *   1. Ensures the db/ directory exists
 *   2. Sets DATABASE_URL to an absolute path
 *   3. Creates all tables via raw SQL (using @prisma/client)
 *   4. Seeds the admin user, CenterConfig, and trial license
 *
 * Usage: node init-db.js
 * Called by: install.js (step 3) and instrumentation-node.ts (fallback)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── SQL for creating all tables ──
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "initialInvestment" REAL NOT NULL,
    "discountRate" REAL NOT NULL,
    "annualCosts" REAL NOT NULL DEFAULT 0,
    "annualRevenue" REAL NOT NULL DEFAULT 0,
    "projectDuration" INTEGER NOT NULL,
    "projectType" TEXT NOT NULL DEFAULT 'nuevo',
    "pdlCategory" TEXT NOT NULL DEFAULT 'economico_productivo',
    "entity" TEXT,
    "responsible" TEXT,
    "location" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CUP',
    "taxRateSales" REAL NOT NULL DEFAULT 10,
    "taxRateIncome" REAL NOT NULL DEFAULT 15,
    "socialSecurityContribution" REAL NOT NULL DEFAULT 0,
    "laborForceTax" REAL NOT NULL DEFAULT 0,
    "localDevelopmentContribution" REAL NOT NULL DEFAULT 0,
    "generalExpensesCoefficient" REAL NOT NULL DEFAULT 0,
    "adminExpensesCoefficient" REAL NOT NULL DEFAULT 0,
    "productionExpensesCoefficient" REAL NOT NULL DEFAULT 0,
    "scenarioOptimist" REAL NOT NULL DEFAULT 0.10,
    "scenarioPessimist" REAL NOT NULL DEFAULT -0.10,
    "objectiveGeneral" TEXT,
    "objectiveSpecific" TEXT,
    "assumptions" TEXT,
    "fixedCosts" REAL NOT NULL DEFAULT 0,
    "variableCosts" REAL NOT NULL DEFAULT 0,
    "financeRate" REAL,
    "reinvestRate" REAL,
    "contingencyReserveRate" REAL NOT NULL DEFAULT 0,
    "retainedEarningsRate" REAL NOT NULL DEFAULT 50,
    "discountRatesByYear" TEXT NOT NULL DEFAULT '',
    "scenarioInvestPessimist" REAL NOT NULL DEFAULT 0.10,
    "scenarioInvestOptimist" REAL NOT NULL DEFAULT -0.05,
    "scenarioRevenuePessimist" REAL NOT NULL DEFAULT -0.20,
    "scenarioRevenueOptimist" REAL NOT NULL DEFAULT 0.05,
    "scenarioCostsPessimist" REAL NOT NULL DEFAULT 0.15,
    "scenarioCostsOptimist" REAL NOT NULL DEFAULT 0.05,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "CashFlow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'net',
    "projectId" TEXT NOT NULL,
    CONSTRAINT "CashFlow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "FinancingSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "interestRate" REAL,
    "term" INTEGER,
    "gracePeriod" INTEGER,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancingSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InvestmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "usefulLife" INTEGER,
    "depreciationRate" REAL,
    "currency" TEXT NOT NULL DEFAULT 'CUP',
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AnnualProjection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "variableCosts" REAL NOT NULL DEFAULT 0,
    "fixedCosts" REAL NOT NULL DEFAULT 0,
    "depreciation" REAL NOT NULL DEFAULT 0,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "AnnualProjection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "License" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "licensee" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT 'trial',
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "features" TEXT NOT NULL DEFAULT '[]',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "activatedAt" DATETIME,
    "lastCheckedAt" DATETIME,
    "machineId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "CenterConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerName" TEXT NOT NULL DEFAULT '',
    "organism" TEXT NOT NULL DEFAULT '',
    "masterUsername" TEXT NOT NULL DEFAULT '',
    "masterPassword" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "License_key_key" ON "License"("key");
`;

function log(msg) {
  console.log('[BARAPRO init-db] ' + msg);
}

function warn(msg) {
  console.warn('[BARAPRO init-db] AVISO: ' + msg);
}

function error(msg) {
  console.error('[BARAPRO init-db] ERROR: ' + msg);
}

/**
 * Ensure the db directory and DATABASE_URL are configured.
 */
function ensureDatabasePath() {
  const dbDir = path.join(process.cwd(), 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('Directorio db/ creado.');
  }

  // Always set DATABASE_URL to absolute path
  const dbFile = path.join(dbDir, 'custom.db').replace(/\\/g, '/');
  const absoluteUrl = 'file:' + dbFile;
  process.env.DATABASE_URL = absoluteUrl;
  log('DATABASE_URL = ' + absoluteUrl);
}

/**
 * Create tables using raw SQL via Prisma Client.
 * Returns true on success.
 */
async function createTables() {
  let PrismaClient;
  try {
    const mod = require('@prisma/client');
    PrismaClient = mod.PrismaClient;
  } catch (err) {
    error('No se pudo cargar @prisma/client: ' + err.message);
    error('Ejecute: npx prisma generate');
    return false;
  }

  const prisma = new PrismaClient({ log: [] });
  try {
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('already exists')) {
          // Table or index already exists — that's fine
        } else {
          throw err;
        }
      }
    }
    log('Tablas creadas/verificadas correctamente.');
    return true;
  } catch (err) {
    error('Error creando tablas: ' + String(err));
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Check if tables already exist.
 */
async function tablesExist() {
  let PrismaClient;
  try {
    const mod = require('@prisma/client');
    PrismaClient = mod.PrismaClient;
  } catch {
    return false;
  }

  const prisma = new PrismaClient({ log: [] });
  try {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master
      WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_prisma%'
    `;
    const required = ['User', 'Project', 'License', 'CenterConfig'];
    return required.every(t => tables.some(tbl => tbl.name === t));
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seed the admin user, CenterConfig, and trial license.
 */
async function seedDatabase() {
  let PrismaClient, bcrypt;
  try {
    const mod = require('@prisma/client');
    PrismaClient = mod.PrismaClient;
  } catch (err) {
    error('No se pudo cargar @prisma/client para seed: ' + err.message);
    return false;
  }
  try {
    bcrypt = require('bcryptjs');
  } catch (err) {
    error('No se pudo cargar bcryptjs: ' + err.message);
    return false;
  }

  const prisma = new PrismaClient({ log: [] });
  try {
    // 1. Create admin user if none exist
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const hashedPassword = await bcrypt.hash('2026', 10);
      await prisma.user.create({
        data: {
          id: crypto.randomBytes(16).toString('hex'),
          username: 'admin',
          password: hashedPassword,
          name: 'Administrador',
          role: 'admin',
          isMaster: true,
          active: true,
        },
      });
      log('Usuario admin creado (admin / 2026).');
    } else {
      log('Usuarios existentes: ' + userCount + '. Se omite creacion.');
    }

    // 2. Create default CenterConfig if none exist
    const configCount = await prisma.centerConfig.count();
    if (configCount === 0) {
      const hashedPassword = await bcrypt.hash('2026', 10);
      await prisma.centerConfig.create({
        data: {
          id: crypto.randomBytes(16).toString('hex'),
          centerName: 'BARAPRO',
          organism: '',
          masterUsername: 'admin',
          masterPassword: hashedPassword,
        },
      });
      log('CenterConfig creado.');
    }

    // 3. Create trial license if none exist
    const licenseCount = await prisma.license.count();
    if (licenseCount === 0) {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 30);

      await prisma.license.create({
        data: {
          id: crypto.randomBytes(16).toString('hex'),
          key: 'DETOA-trial-BUILT-IN',
          licensee: 'Evaluacion',
          email: '',
          tier: 'trial',
          maxUsers: 3,
          features: JSON.stringify({
            evaluacion: true, inversiones: true, costos: true,
            warehouse: true, cashRegister: true, rawMaterials: false,
            indicadores: false, suppliers: true, flujos: false,
            reports: true, escenarios: false, reportes: false,
            exportPDF: true, exportWord: false, exportExcel: true,
            backup: true, multiUser: false, sensibilidad: false,
            organisms: false, techSheets: false, anexos: false,
            wasteControl: false, inventoryCheck: false,
          }),
          issuedAt: now,
          expiresAt: expiresAt,
          activatedAt: now,
          machineId: '',
          status: 'active',
          note: 'Licencia de evaluacion generada automaticamente',
        },
      });
      log('Licencia de prueba (30 dias) creada.');
    }

    return true;
  } catch (err) {
    error('Error durante seed: ' + String(err));
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// ── Main ──
async function main() {
  console.log('');
  log('BARAPRO v11 — Inicializador de base de datos');
  log('==============================================');

  // Step 0: Ensure DB path
  ensureDatabasePath();

  // Step 1: Check if tables already exist
  const exists = await tablesExist();
  if (exists) {
    log('Base de datos ya inicializada. No se necesitan cambios.');
    return true;
  }

  // Step 2: Create tables
  log('Creando tablas...');
  const tablesOk = await createTables();
  if (!tablesOk) {
    error('No se pudieron crear las tablas.');
    return false;
  }

  // Step 3: Seed data
  log('Insertando datos iniciales...');
  const seedOk = await seedDatabase();
  if (seedOk) {
    log('Base de datos inicializada correctamente.');
  } else {
    warn('Algunos datos iniciales no se pudieron insertar.');
  }

  return seedOk;
}

// Run if called directly
if (require.main === module) {
  main()
    .then(ok => {
      process.exit(ok ? 0 : 1);
    })
    .catch(err => {
      error('Error fatal: ' + err.message);
      process.exit(1);
    });
}

// Export for use by instrumentation-node.ts
module.exports = { ensureDatabasePath, createTables, seedDatabase, tablesExist };
