/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * BARAPRO v10.2 — prisma/seed.ts
 * Seed script for CLI execution during installation
 *
 * This script creates the initial admin user and CenterConfig.
 * It uses direct Prisma Client and bcryptjs (no Next.js imports).
 *
 * Usage: npx tsx prisma/seed.ts
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '2026';

async function main() {
  console.log('[seed] BARAPRO v10.2 — Inicializando base de datos...');

  const prisma = new PrismaClient();

  try {
    // ── 1. Create default admin user ──
    const existingUserCount = await prisma.user.count();

    if (existingUserCount === 0) {
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          username: DEFAULT_USERNAME,
          password: hashedPassword,
          name: 'Administrador',
          role: 'admin',
          isMaster: true,
          active: true,
        },
      });

      console.log(`[seed] Usuario administrador creado: ${user.username}`);
    } else {
      console.log(`[seed] Ya existen ${existingUserCount} usuarios. Se omite la creacion del usuario por defecto.`);
    }

    // ── 2. Create default CenterConfig ──
    const existingConfig = await prisma.centerConfig.findFirst();

    if (!existingConfig) {
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

      await prisma.centerConfig.create({
        data: {
          centerName: 'BARAPRO',
          organism: '',
          masterUsername: DEFAULT_USERNAME,
          masterPassword: hashedPassword,
        },
      });

      console.log('[seed] CenterConfig creado con valores por defecto.');
    } else {
      console.log('[seed] CenterConfig ya existe. Se omite.');
    }

    // ── 3. Create default trial license if none exists ──
    const existingLicense = await prisma.license.findFirst();

    if (!existingLicense) {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day trial

      await prisma.license.create({
        data: {
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
          note: 'Licencia de evaluacion generada automaticamente por el instalador',
        },
      });

      console.log('[seed] Licencia de prueba (30 dias) creada automaticamente.');
    } else {
      console.log('[seed] Licencia ya existe. Se omite.');
    }

    console.log('');
    console.log('[seed] ====================================');
    console.log('[seed]   Base de datos inicializada');
    console.log('[seed] ====================================');
    console.log(`[seed]   Usuario:    ${DEFAULT_USERNAME}`);
    console.log(`[seed]   Contrasena: ${DEFAULT_PASSWORD}`);
    console.log('[seed] ====================================');
    console.log('');
  } catch (error) {
    console.error('[seed] Error durante la inicializacion:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
