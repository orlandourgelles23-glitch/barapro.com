/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * BARAPRO v11 — install.js
 *
 * Backup Node.js installer — can be run directly with: node install.js
 * The PRIMARY installer is INSTALAR.bat which handles everything natively
 * in batch script for maximum Windows compatibility.
 *
 * This script provides the same functionality as a fallback and is also
 * called by ACTUALIZAR.bat when updating the system.
 *
 * Pattern adapted from DETOA v2.6 installer.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Configuration ──
const VERSION = '11';
const MIN_NODE_VERSION = 18;
const IS_WINDOWS = process.platform === 'win32';

// ── Helpers ──
function log(msg) {
  console.log('\x1b[32m[BARAPRO v' + VERSION + ']\x1b[0m ' + msg);
}

function warn(msg) {
  console.warn('\x1b[33m[AVISO]\x1b[0m ' + msg);
}

function error(msg) {
  console.error('\x1b[31m[ERROR]\x1b[0m ' + msg);
}

function success(msg) {
  console.log('\x1b[36m[OK]\x1b[0m ' + msg);
}

function step(num, total, msg) {
  console.log('');
  console.log('\x1b[36m━━━ [' + num + '/' + total + '] ' + msg + ' ━━━\x1b[0m');
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, {
      stdio: 'inherit',
      timeout: opts.timeout || 300000,
      env: { ...process.env, ...opts.env },
      cwd: opts.cwd || process.cwd(),
    });
    return true;
  } catch (err) {
    return false;
  }
}

function runQuiet(cmd, opts = {}) {
  try {
    const result = execSync(cmd, {
      stdio: 'pipe',
      timeout: opts.timeout || 30000,
      env: { ...process.env, ...opts.env },
      cwd: opts.cwd || process.cwd(),
      encoding: 'utf-8',
    });
    return result.trim();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copy a directory recursively (cross-platform, no Unix cp dependency).
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get the prisma command for the current platform.
 * Uses local binary first, then npx as fallback.
 */
function getPrismaCmd() {
  if (IS_WINDOWS) {
    const cmdPath = path.join(process.cwd(), 'node_modules', '.bin', 'prisma.cmd');
    if (fs.existsSync(cmdPath)) {
      return '"' + cmdPath + '"';
    }
  } else {
    const binPath = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
    if (fs.existsSync(binPath)) {
      return binPath;
    }
  }
  return 'npx -y prisma';
}

/**
 * Get the next command for the current platform.
 */
function getNextCmd() {
  if (IS_WINDOWS) {
    const cmdPath = path.join(process.cwd(), 'node_modules', '.bin', 'next.cmd');
    if (fs.existsSync(cmdPath)) {
      return '"' + cmdPath + '"';
    }
  } else {
    const binPath = path.join(process.cwd(), 'node_modules', '.bin', 'next');
    if (fs.existsSync(binPath)) {
      return binPath;
    }
  }
  return 'npx -y next';
}

// ── Installation Steps ──

function checkNode() {
  const version = runQuiet('node -v');
  if (!version) {
    error('Node.js no esta instalado.');
    error('Descargue e instale Node.js desde https://nodejs.org (version 18 o superior)');
    return false;
  }
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  if (major < MIN_NODE_VERSION) {
    error('Node.js ' + version + ' es muy antiguo. Se requiere v' + MIN_NODE_VERSION + '+');
    return false;
  }
  success('Node.js ' + version);
  return true;
}

function checkPathSafety() {
  const cwd = process.cwd();
  const dangerousChars = ['(', ')', '&', '^', '#', '%', '!', '@'];
  const hasDangerous = dangerousChars.some(ch => cwd.includes(ch));

  if (hasDangerous) {
    warn('La ruta del proyecto contiene caracteres especiales:');
    warn('  ' + cwd);
    warn('');
    warn('Esto puede causar problemas con algunos comandos de Windows.');
    warn('Se recomienda mover la carpeta a una ruta sin parentesis ni caracteres especiales.');
    warn('Ejemplo: D:\\BARAPRO\\BARAPRO_v11');
    warn('');
  }
  return true;
}

async function installDependencies() {
  if (fs.existsSync('node_modules/next') && fs.existsSync('node_modules/@prisma/client')) {
    success('Dependencias ya instaladas');
    return true;
  }

  log('Instalando dependencias con --ignore-scripts (puede tardar)...');

  // Strategy from DETOA: --ignore-scripts first to avoid Prisma postinstall crashes
  const commands = [
    { cmd: 'npm install --ignore-scripts', name: 'npm --ignore-scripts', timeout: 600000 },
    { cmd: 'bun install --ignore-scripts', name: 'bun --ignore-scripts', timeout: 600000 },
    { cmd: 'npm install', name: 'npm', timeout: 600000 },
  ];

  for (const ic of commands) {
    log('Intentando: ' + ic.cmd + '...');
    const ok = run(ic.cmd, { timeout: ic.timeout });
    if (ok && fs.existsSync('node_modules/next')) {
      success('Paquetes instalados con ' + ic.name);
      return true;
    }
    warn(ic.name + ' fallo.');

    if (commands.indexOf(ic) < commands.length - 1) {
      log('Esperando 10 segundos...');
      await sleep(10000);
    }
  }

  error('No se pudieron instalar las dependencias.');
  error('Verifique su conexion a internet y ejecute INSTALAR.bat de nuevo.');
  return false;
}

async function generatePrismaClient() {
  const clientPath = path.join('node_modules', '.prisma', 'client', 'index.js');
  if (fs.existsSync(clientPath)) {
    success('Prisma client encontrado (pre-generado)');
    return true;
  }

  warn('Prisma client no encontrado. Intentando generar...');
  const prismaCmd = getPrismaCmd();
  log('Usando: ' + prismaCmd);

  for (let attempt = 1; attempt <= 3; attempt++) {
    log('Intento ' + attempt + ' de 3...');
    const ok = run(prismaCmd + ' generate', { timeout: 180000 });
    if (ok && fs.existsSync(clientPath)) {
      success('Prisma client generado correctamente.');
      return true;
    }
    if (attempt < 3) {
      log('Esperando 10 segundos antes de reintentar...');
      await sleep(10000);
    }
  }

  warn('No se pudo generar el Prisma client.');
  warn('El sistema intentara generarlo automaticamente al iniciar.');
  return false;
}

async function initializeDatabase() {
  if (!fs.existsSync('db')) {
    fs.mkdirSync('db', { recursive: true });
  }

  // Set absolute DATABASE_URL
  const dbFile = path.join(process.cwd(), 'db', 'custom.db').replace(/\\/g, '/');
  process.env.DATABASE_URL = 'file:' + dbFile;

  const initDbPath = path.join(process.cwd(), 'init-db.js');
  if (!fs.existsSync(initDbPath)) {
    warn('init-db.js no encontrado. Se omitira la inicializacion.');
    return true;
  }

  log('Ejecutando init-db.js...');
  const ok = run('node init-db.js', { timeout: 60000 });
  if (ok) {
    success('Base de datos inicializada');
  } else {
    // Fallback: try prisma db push
    warn('init-db.js fallo. Intentando prisma db push...');
    const prismaCmd = getPrismaCmd();
    run(prismaCmd + ' db push', { timeout: 60000 });
    // Try seed
    run('node init-db.js', { timeout: 60000 });
  }
  return true;
}

function generateAuthSecret() {
  const envPath = path.join(process.cwd(), '.env');
  const secretHex = crypto.randomBytes(32).toString('hex');

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Remove any existing AUTH_SECRET_HEX line
  envContent = envContent.split('\n')
    .filter(line => !line.startsWith('AUTH_SECRET_HEX='))
    .join('\n')
    .trim();

  // Add the new secret
  envContent += '\nAUTH_SECRET_HEX=' + secretHex + '\n';

  fs.writeFileSync(envPath, envContent, 'utf-8');
  success('AUTH_SECRET_HEX generado (clave unica para esta instalacion).');
}

/**
 * Find the actual standalone server.js directory.
 * Next.js 16 may nest it under the project directory name:
 *   .next/standalone/server.js              (if built at project root)
 *   .next/standalone/<dirname>/server.js    (if built in a subdirectory)
 * This function returns the directory containing server.js.
 */
function findStandaloneDir() {
  const standaloneRoot = path.join(process.cwd(), '.next', 'standalone');

  // Check direct location first
  if (fs.existsSync(path.join(standaloneRoot, 'server.js'))) {
    return standaloneRoot;
  }

  // Search one level deep for nested directory (e.g., .next/standalone/BARAPRO_v11/)
  if (fs.existsSync(standaloneRoot)) {
    const entries = fs.readdirSync(standaloneRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nestedPath = path.join(standaloneRoot, entry.name, 'server.js');
        if (fs.existsSync(nestedPath)) {
          return path.join(standaloneRoot, entry.name);
        }
      }
    }
  }

  return null;
}

/**
 * Move contents of a nested standalone directory up one level.
 * Next.js 16 nests standalone output under the project directory name.
 * We need to flatten it so scripts and BAT files can find server.js at
 * .next/standalone/server.js (not .next/standalone/PROJECT_NAME/server.js).
 */
function flattenStandaloneDir() {
  const standaloneRoot = path.join(process.cwd(), '.next', 'standalone');
  if (!fs.existsSync(standaloneRoot)) return;

  // Already flat?
  if (fs.existsSync(path.join(standaloneRoot, 'server.js'))) return;

  // Find the nested directory
  const entries = fs.readdirSync(standaloneRoot, { withFileTypes: true });
  const nestedDir = entries.find(e =>
    e.isDirectory() &&
    fs.existsSync(path.join(standaloneRoot, e.name, 'server.js'))
  );

  if (!nestedDir) return;

  const nestedPath = path.join(standaloneRoot, nestedDir.name);
  log('Detectado standalone anidado en: ' + nestedDir.name);
  log('Aplanando estructura para compatibilidad...');

  // Move all items from nested dir up to standalone root
  const items = fs.readdirSync(nestedPath, { withFileTypes: true });
  for (const item of items) {
    const src = path.join(nestedPath, item.name);
    const dest = path.join(standaloneRoot, item.name);

    // If destination already exists (e.g., node_modules), merge carefully
    if (fs.existsSync(dest)) {
      if (item.isDirectory()) {
        // Merge directories by copying contents
        copyDirSync(src, dest);
      }
      // Skip if file already exists at destination
    } else {
      // Move the item
      fs.renameSync(src, dest);
    }
  }

  // Remove the now-empty nested directory
  try {
    fs.rmSync(nestedPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  success('Estructura standalone aplanada correctamente.');
}

function buildStandalone() {
  // Check if standalone already exists (flat or nested)
  const existingDir = findStandaloneDir();
  if (existingDir) {
    success('Build standalone ya existe. Se omite el paso de build.');
    // Still flatten if needed
    flattenStandaloneDir();
    // IMPORTANT: Still copy all runtime files and critical modules
    // even if build already exists (they may be missing from a previous partial install)
    copyStandaloneFiles();
    return true;
  }

  log('Compilando build standalone (puede tardar varios minutos)...');
  log('Esto es necesario para ejecucion offline en produccion.');

  const nextCmd = getNextCmd();
  log('Usando: ' + nextCmd);

  // Set memory limit
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';

  let buildOk = run(nextCmd + ' build', { timeout: 600000 });

  // Fallback: try with --webpack (uses less memory)
  if (!buildOk) {
    warn('Turbopack fallo. Intentando con --webpack...');
    buildOk = run(nextCmd + ' build --webpack', { timeout: 600000 });
  }

  // Fallback: npx
  if (!buildOk) {
    warn('Binario local fallo. Intentando con npx...');
    buildOk = run('npx -y next build', { timeout: 600000 });
  }

  // Last resort: webpack with npx and less memory
  if (!buildOk) {
    warn('Reintentando con npx + --webpack + 2GB RAM...');
    process.env.NODE_OPTIONS = '--max-old-space-size=2048';
    buildOk = run('npx -y next build --webpack', { timeout: 600000 });
  }

  if (!buildOk) {
    error('next build fallo. El sistema funcionara en modo desarrollo.');
    error('Para modo produccion, asegurese de tener suficiente memoria RAM (minimo 2GB libre).');
    return false;
  }

  success('Build completado.');

  // ── Fix nested standalone directory ──
  flattenStandaloneDir();

  // ── Verify server.js exists ──
  const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
  if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    error('server.js no encontrado en .next/standalone/. Build incompleto.');
    return false;
  }

  // Copy all files to standalone
  copyStandaloneFiles();
  return true;
}

/**
 * Copy all runtime files, critical modules, and config to the standalone directory.
 * Called both after a fresh build AND when a build already exists (re-run).
 */
function copyStandaloneFiles() {
  const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
  if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    error('server.js no encontrado. No se pueden copiar archivos.');
    return;
  }

  // Copy .next/static
  const staticSrc = path.join(process.cwd(), '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    log('Copiando archivos estaticos...');
    copyDirSync(staticSrc, staticDest);
    success('Archivos estaticos copiados.');
  }

  // Copy public/
  const publicSrc = path.join(process.cwd(), 'public');
  const publicDest = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    log('Copiando archivos publicos...');
    copyDirSync(publicSrc, publicDest);
    success('Archivos publicos copiados.');
  }

  // Copy runtime files
  const runtimeFiles = ['start.js', 'init-db.js', 'INICIAR.bat', 'DETENER.bat',
                         'CREAR_ACCESO_DIRECTO.bat', 'ACTUALIZAR.bat'];
  log('Copiando archivos de ejecucion al directorio standalone...');
  for (const file of runtimeFiles) {
    const src = path.join(process.cwd(), file);
    const dest = path.join(standaloneDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy critical modules to standalone
  // These are NOT included by Next.js standalone trace and must be copied manually.
  const criticalModules = [
    ['.prisma', 'node_modules/.prisma'],
    ['@prisma/client', 'node_modules/@prisma/client'],
    ['@prisma/engines', 'node_modules/@prisma/engines'],
    ['prisma', 'node_modules/prisma'],
    ['better-sqlite3', 'node_modules/better-sqlite3'],
    ['bcryptjs', 'node_modules/bcryptjs'],
    ['docx', 'node_modules/docx'],
    ['jszip', 'node_modules/jszip'],
    ['jose', 'node_modules/jose'],
    ['uuid', 'node_modules/uuid'],
  ];

  log('Copiando modulos criticos al standalone...');
  for (const [modName, modPath] of criticalModules) {
    const src = path.join(process.cwd(), 'node_modules', modName);
    const dest = path.join(standaloneDir, modPath);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
      success(modName + ' copiado.');
    }
  }

  // Copy prisma schema and seed for DB recovery
  const prismaDest = path.join(standaloneDir, 'prisma');
  if (!fs.existsSync(prismaDest)) fs.mkdirSync(prismaDest, { recursive: true });
  if (fs.existsSync('prisma/schema.prisma')) {
    fs.copyFileSync('prisma/schema.prisma', path.join(prismaDest, 'schema.prisma'));
  }
  if (fs.existsSync('prisma/seed.ts')) {
    fs.copyFileSync('prisma/seed.ts', path.join(prismaDest, 'seed.ts'));
  }

  // Create .env in standalone with absolute path (CRITICAL: Prisma cannot
  // resolve relative SQLite paths in standalone mode because the CWD changes)
  const absStandaloneDir = standaloneDir.replace(/\\/g, '/');
  const envContent = 'DATABASE_URL=file:' + absStandaloneDir + '/db/custom.db\n';
  fs.writeFileSync(path.join(standaloneDir, '.env'), envContent, 'utf-8');
  success('.env creado con ruta absoluta.');

  // Create db directory in standalone
  const dbDir = path.join(standaloneDir, 'db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Copy database if exists
  if (fs.existsSync('db/custom.db')) {
    fs.copyFileSync('db/custom.db', path.join(dbDir, 'custom.db'));
    success('Base de datos copiada al standalone.');
  }

  // D16: Verify and repair critical standalone build artifacts
  // Next.js 16 standalone server CRASHES with ENOENT if pages-manifest.json
  // is missing. This can happen on Windows due to xcopy/flatten issues.
  const serverDir = path.join(standaloneDir, '.next', 'server');
  if (fs.existsSync(serverDir)) {
    const manifestPath = path.join(serverDir, 'pages-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      fs.writeFileSync(manifestPath, JSON.stringify({
        "/404": "pages/404.html",
        "/500": "pages/500.html"
      }, null, 2));
      warn('pages-manifest.json faltante — creado automaticamente.');
    }

    // Ensure error pages directory and files exist
    const pagesDir = path.join(serverDir, 'pages');
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }
    if (!fs.existsSync(path.join(pagesDir, '404.html'))) {
      fs.writeFileSync(path.join(pagesDir, '404.html'),
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body><h1>404 - Pagina no encontrada</h1></body></html>');
      warn('404.html faltante — creado automaticamente.');
    }
    if (!fs.existsSync(path.join(pagesDir, '500.html'))) {
      fs.writeFileSync(path.join(pagesDir, '500.html'),
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>500</title></head><body><h1>500 - Error del servidor</h1></body></html>');
      warn('500.html faltante — creado automaticamente.');
    }
  }

  // Copy postbuild.js script
  const postbuildSrc = path.join(process.cwd(), 'scripts', 'postbuild.js');
  const postbuildDest = path.join(standaloneDir, 'scripts', 'postbuild.js');
  if (fs.existsSync(postbuildSrc)) {
    const scriptsDir = path.join(standaloneDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });
    fs.copyFileSync(postbuildSrc, postbuildDest);
  }

  success('Archivos de ejecucion copiados.');
}

// ── Wait for Enter ──
function waitForEnter() {
  console.log('');
  console.log('  Presione Enter para cerrar esta ventana...');
  try {
    process.stdin.setRawMode(true);
  } catch {}
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
}

// ── Main ──
async function main() {
  console.log('');
  console.log('\x1b[36m╔══════════════════════════════════════════════════════════╗');
  console.log('║   BARAPRO v' + VERSION + ' — Instalador                               ║');
  console.log('║   Herramienta de Viabilidad Financiera                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\x1b[0m');
  console.log('');
  console.log('  Este instalador prepara el sistema para ejecucion offline.');
  console.log('');

  const TOTAL_STEPS = 8;

  // Step 1
  step(1, TOTAL_STEPS, 'Verificando Node.js');
  if (!checkNode()) {
    error('No se puede continuar sin Node.js.');
    waitForEnter();
    return;
  }

  // Step 2
  step(2, TOTAL_STEPS, 'Verificando ruta de instalacion');
  checkPathSafety();

  // Step 3
  step(3, TOTAL_STEPS, 'Instalando dependencias');
  const depsOk = await installDependencies();

  // Step 4
  step(4, TOTAL_STEPS, 'Generando cliente Prisma');
  if (depsOk) {
    await generatePrismaClient();
  } else {
    warn('No se pueden generar sin dependencias.');
  }

  // Step 5
  step(5, TOTAL_STEPS, 'Inicializando base de datos');
  if (depsOk) {
    await initializeDatabase();
  }

  // Step 6
  step(6, TOTAL_STEPS, 'Generando clave de seguridad');
  generateAuthSecret();

  // Step 7
  step(7, TOTAL_STEPS, 'Compilando servidor de produccion');
  buildStandalone();

  // Step 8
  step(8, TOTAL_STEPS, 'Verificacion final');
  const standaloneExists = fs.existsSync(path.join('.next', 'standalone', 'server.js'));
  const prismaClientExists = fs.existsSync(path.join('node_modules', '.prisma', 'client', 'index.js'));

  if (standaloneExists) {
    success('Servidor de produccion listo.');
  } else {
    warn('Servidor de produccion no disponible.');
    warn('El sistema funcionara en modo desarrollo.');
  }

  if (prismaClientExists) {
    success('Prisma client generado.');
  } else {
    warn('Prisma client no generado. Se intentara generar al iniciar.');
  }

  // Summary
  console.log('');
  console.log('\x1b[32m╔══════════════════════════════════════════════════════════╗');
  console.log('║   INSTALACION COMPLETADA                                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\x1b[0m');
  console.log('');
  if (standaloneExists) {
    console.log('  Para iniciar BARAPRO:');
    console.log('    cd .next\\standalone');
    console.log('    INICIAR.bat');
    console.log('');
    console.log('  O haga doble clic en: .next\\standalone\\INICIAR.bat');
    console.log('');
    console.log('  Modo: \x1b[32mPRODUCCION (offline)\x1b[0m');
  } else {
    console.log('  Para iniciar BARAPRO:');
    console.log('    Haga doble clic en: \x1b[36mINICIAR.bat\x1b[0m');
    console.log('');
    console.log('  Modo: \x1b[33mDESARROLLO (requiere internet)\x1b[0m');
  }
  console.log('');
  console.log('  Credenciales por defecto:');
  console.log('    Usuario:     admin');
  console.log('    Contrasena:  2026');
  console.log('');

  waitForEnter();
}

// ── Global error handlers — prevent silent crashes ──
process.on('uncaughtException', (err) => {
  error('Error inesperado: ' + (err.message || String(err)));
  console.log('');
  console.log('  No se preocupe. Intente ejecutar INSTALAR.bat de nuevo.');
  waitForEnter();
});

process.on('unhandledRejection', (reason) => {
  error('Promesa rechazada: ' + (reason instanceof Error ? reason.message : String(reason)));
  console.log('');
  console.log('  No se preocupe. Intente ejecutar INSTALAR.bat de nuevo.');
  waitForEnter();
});

main().catch((err) => {
  error('Error fatal: ' + (err.message || String(err)));
  console.log('');
  console.log('  No se preocupe. Intente ejecutar INSTALAR.bat de nuevo.');
  waitForEnter();
});
