/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * BARAPRO v10.4 — instrumentation-node.ts
 *
 * Node.js-only database initialization logic.
 * Called by instrumentation.ts ONLY in the Node.js runtime.
 *
 * Strategy:
 *   1. Check if DB is already initialized → return immediately
 *   2. If not → run `node init-db.js` via child_process
 *   3. init-db.js uses @prisma/client directly to create tables and seed
 *
 * NOTE: We use child_process to run init-db.js instead of inline Prisma
 * operations because the Turbopack runtime context can cause issues with
 * Prisma's raw SQL operations (tables created via $executeRawUnsafe may
 * not be visible to ORM methods within the same process).
 *
 * The Prisma client and Windows engine binary are PRE-GENERATED
 * in the distribution ZIP, so no network access is needed.
 */

function log(msg: string) {
  console.log('[BARAPRO init] ' + msg);
}

function warn(msg: string) {
  console.warn('[BARAPRO init] AVISO: ' + msg);
}

function error(msg: string) {
  console.error('[BARAPRO init] ERROR: ' + msg);
}

/**
 * Ensure the db directory exists.
 */
function ensureDatabasePath(): void {
  const fs = require('fs');
  const path = require('path');

  const dbDir = path.join(process.cwd(), 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('Directorio db/ creado.');
  }

  log('DATABASE_URL: ' + (process.env.DATABASE_URL || '(no definida)'));
  log('CWD: ' + process.cwd());
}

/**
 * Check if the database has the required tables.
 * Uses Prisma Client if available, otherwise returns false.
 */
async function isDatabaseReady(): Promise<boolean> {
  let PrismaClient: any;
  try {
    const mod = require('@prisma/client');
    PrismaClient = mod.PrismaClient;
  } catch {
    log('@prisma/client no disponible. Se requiere inicializacion.');
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
    const tableNames = tables.map((t) => t.name);
    const required = ['User', 'Project', 'License', 'CenterConfig'];
    const hasAll = required.every((t) => tableNames.includes(t));
    if (hasAll) {
      log('Base de datos OK (' + tableNames.length + ' tablas).');
      return true;
    } else {
      log('Faltan tablas. Encontradas: ' + (tableNames.join(', ') || '(ninguna)'));
      return false;
    }
  } catch {
    log('Base de datos vacia o no encontrada. Se inicializara.');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Initialize the database using init-db.js via child_process.
 * This is the PRIMARY initialization method — it works reliably
 * because it runs in a clean Node.js process outside of Turbopack.
 */
async function runInitDb(): Promise<boolean> {
  const { execSync } = require('child_process');
  try {
    log('Ejecutando: node init-db.js');
    execSync('node init-db.js', {
      stdio: 'pipe',
      env: { ...process.env },
      timeout: 60000,
      cwd: process.cwd(),
    });
    log('Base de datos inicializada correctamente.');
    return true;
  } catch (err) {
    error('init-db.js fallo: ' + String(err));
    return false;
  }
}

/**
 * Fallback: Try prisma db push via child_process.
 */
async function tryPrismaDbPush(): Promise<boolean> {
  const { execSync } = require('child_process');
  try {
    // Try local prisma binary first, then npx -y
    const fs = require('fs');
    const path = require('path');
    const isWindows = process.platform === 'win32';
    let cmd = 'npx -y prisma db push --skip-generate';

    if (isWindows) {
      const prismaCmd = path.join(process.cwd(), 'node_modules', '.bin', 'prisma.cmd');
      if (fs.existsSync(prismaCmd)) {
        cmd = '"' + prismaCmd + '" db push --skip-generate';
      }
    } else {
      const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
      if (fs.existsSync(prismaBin)) {
        cmd = prismaBin + ' db push --skip-generate';
      }
    }

    log('Intentando: ' + cmd);
    execSync(cmd, {
      stdio: 'pipe',
      env: { ...process.env },
      timeout: 60000,
    });
    log('Tablas creadas via prisma db push.');
    return true;
  } catch {
    warn('prisma db push fallo.');
    return false;
  }
}

/**
 * Main initialization function — called from instrumentation.ts
 * only in the Node.js runtime (never in Edge Runtime).
 */
export async function initDatabase(): Promise<void> {
  log('BARAPRO v11 — Verificando base de datos...');

  try {
    // Step 0: Ensure DB path exists
    ensureDatabasePath();

    // Step 1: Check if DB is already ready
    const isReady = await isDatabaseReady();
    if (isReady) {
      return; // All good, nothing to do
    }

    // Step 2: Initialize using init-db.js (primary method)
    log('Inicializando base de datos...');
    const initOk = await runInitDb();
    if (initOk) {
      return; // Success
    }

    // Step 3: Fallback — try prisma db push
    const pushOk = await tryPrismaDbPush();
    if (pushOk) {
      // Try seeding again via init-db.js
      await runInitDb();
      return;
    }

    // Step 4: All methods failed
    error('No se pudo inicializar la base de datos.');
    error('Intente manualmente: node init-db.js');
  } catch (err) {
    error('Error durante la inicializacion: ' + String(err));
    // Don't throw — the app may still work if the DB is partially initialized
  }
}
