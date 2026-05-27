/**
 * BARAPRO v11 — start.js
 * DB auto-init wrapper that runs before server.js
 *
 * This script ensures the database exists and is seeded before
 * starting the Next.js standalone server. It handles:
 *   1. Creating the db/ directory if missing
 *   2. Running init-db.js if tables don't exist
 *   3. Starting server.js
 *
 * Pattern adapted from DETOA v2.6 which works reliably on Windows.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'db');
const DB_FILE = path.join(DB_DIR, 'custom.db');

function run(cmd, label) {
  try {
    console.log(`[BARAPRO] ${label}...`);
    execSync(cmd, { stdio: 'inherit', env: { ...process.env } });
    console.log(`[BARAPRO] ${label} — OK`);
    return true;
  } catch (e) {
    console.warn(`[BARAPRO] ${label} — FAILED (${e.message})`);
    return false;
  }
}

function isDbInitialized() {
  if (!fs.existsSync(DB_FILE)) return false;
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    // Quick check: can we connect and find a User?
    const result = prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM User');
    // If we get here, tables exist
    return true;
  } catch {
    return false;
  }
}

// ── Repair standalone build artifacts ──
// Next.js 16 standalone requires certain files that may be missing
// after a Windows build (xcopy/flatten issues, antivirus, etc.).
// We repair them BEFORE starting the server to prevent ENOENT crashes.
function repairStandaloneArtifacts() {
  const nextDir = path.join(__dirname, '.next');
  const serverDir = path.join(nextDir, 'server');
  if (!fs.existsSync(serverDir)) return; // Not in standalone mode

  // D13: Ensure pages-manifest.json exists (critical — server CRASHES without it)
  const pagesManifestPath = path.join(serverDir, 'pages-manifest.json');
  if (!fs.existsSync(pagesManifestPath)) {
    fs.mkdirSync(path.dirname(pagesManifestPath), { recursive: true });
    fs.writeFileSync(pagesManifestPath, JSON.stringify({
      "/404": "pages/404.html",
      "/500": "pages/500.html"
    }, null, 2));
    console.warn('[BARAPRO] Reparado: pages-manifest.json creado (faltaba en el build)');
  }

  // Ensure error pages exist
  const pagesDir = path.join(serverDir, 'pages');
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
  }

  const page404 = path.join(pagesDir, '404.html');
  if (!fs.existsSync(page404)) {
    fs.writeFileSync(page404, '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body><h1>404 - Pagina no encontrada</h1></body></html>');
    console.warn('[BARAPRO] Reparado: 404.html creado');
  }

  const page500 = path.join(pagesDir, '500.html');
  if (!fs.existsSync(page500)) {
    fs.writeFileSync(page500, '<!DOCTYPE html><html><head><meta charset="utf-8"><title>500</title></head><body><h1>500 - Error del servidor</h1></body></html>');
    console.warn('[BARAPRO] Reparado: 500.html creado');
  }
}

// ── Main ──
console.log('[BARAPRO] BARAPRO v11 — Auto-initializing...');

// 0. Repair standalone build artifacts (must run BEFORE server starts)
repairStandaloneArtifacts();

// 1. Ensure db directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('[BARAPRO] Created db/ directory');
}

// 2. ALWAYS set DATABASE_URL to absolute path.
//    Prisma cannot reliably resolve relative SQLite paths,
//    especially in standalone mode where the directory structure
//    differs from development. Absolute path = guaranteed correct.
const absDbPath = path.join(DB_DIR, 'custom.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${absDbPath}`;
console.log(`[BARAPRO] DATABASE_URL=${process.env.DATABASE_URL}`);

// 3. If database file doesn't exist, try to initialize
if (!fs.existsSync(DB_FILE)) {
  console.log('[BARAPRO] Database not found — initializing...');

  // Try init-db.js first
  let initOk = false;
  if (fs.existsSync(path.join(__dirname, 'init-db.js'))) {
    initOk = run('node init-db.js', 'init-db.js');
  }

  if (!initOk) {
    // Try prisma db push as fallback
    if (fs.existsSync(path.join(__dirname, 'node_modules', '.bin', 'prisma'))) {
      initOk = run('node node_modules/.bin/prisma db push --skip-generate', 'prisma db push');
    }
    if (!initOk) {
      initOk = run('npx prisma db push --skip-generate', 'prisma db push (npx)');
    }
  }

  if (!initOk) {
    // Last resort: try the prisma entrypoint directly
    const prismaEntry = path.join(__dirname, 'node_modules', 'prisma', 'entrypoint.js');
    if (fs.existsSync(prismaEntry)) {
      initOk = run(`node "${prismaEntry}" db push --skip-generate`, 'prisma db push (entrypoint)');
    }
  }

  if (!initOk) {
    console.warn('[BARAPRO] WARNING: Could not initialize database.');
    console.warn('[BARAPRO] The server may fail. Run INSTALAR.bat to fix.');
  }
}

// 3b. If database exists but may not be seeded, check and run seed
if (fs.existsSync(DB_FILE)) {
  const SEED_FILE = path.join(__dirname, 'prisma', 'seed.ts');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    prisma.user.findFirst({ where: { isMaster: true } }).then(async (adminUser) => {
      if (!adminUser) {
        console.log('[BARAPRO] No admin user found — running seed...');
        // Try init-db.js first, then seed.ts
        let seedOk = false;
        if (fs.existsSync(path.join(__dirname, 'init-db.js'))) {
          seedOk = run('node init-db.js', 'seed (init-db.js)');
        }
        if (!seedOk && fs.existsSync(SEED_FILE)) {
          seedOk = run('npx tsx prisma/seed.ts', 'seed (tsx)');
          if (!seedOk) {
            run('node -e "require(\'tsx/cjs\'); require(\'./prisma/seed.ts\')"', 'seed (tsx/cjs)');
          }
        }
      } else {
        console.log('[BARAPRO] Database already seeded — OK');
      }
      await prisma.$disconnect();
    }).catch(async () => {
      await prisma.$disconnect();
    });
  } catch {
    // Prisma client not available yet, skip seed check
  }
}

// 4. Auto-open browser after a delay (if BARAPRO_AUTO_OPEN is set)
if (process.env.BARAPRO_AUTO_OPEN === '1') {
  const port = process.env.PORT || '3000';
  const url = `http://localhost:${port}`;
  setTimeout(() => {
    try {
      const start = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      require('child_process').exec(`${start} ${url}`);
    } catch {}
  }, 3000);
}

// 5. Start the Next.js standalone server
console.log('[BARAPRO] Starting Next.js server...');
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  require(serverPath);
} else {
  // Check if we're in project root and standalone exists elsewhere
  // (flat or nested under project directory name)
  let standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');
  if (!fs.existsSync(standaloneServer)) {
    // Check for nested directory (Next.js 16 nests under project name)
    const standaloneRoot = path.join(__dirname, '.next', 'standalone');
    if (fs.existsSync(standaloneRoot)) {
      try {
        const entries = fs.readdirSync(standaloneRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const nestedServer = path.join(standaloneRoot, entry.name, 'server.js');
            if (fs.existsSync(nestedServer)) {
              standaloneServer = nestedServer;
              break;
            }
          }
        }
      } catch {}
    }
  }
  if (fs.existsSync(standaloneServer)) {
    console.error('[BARAPRO] server.js not found here, but standalone build exists.');
    console.error('[BARAPRO] Run INICIAR.bat which will auto-detect the standalone directory.');
  } else {
    console.error('[BARAPRO] ERROR: server.js not found!');
    console.error('[BARAPRO] The production build has not been completed.');
    console.error('[BARAPRO] Run INSTALAR.bat to build, or use INICIAR.bat for dev mode.');
  }
  process.exit(1);
}
