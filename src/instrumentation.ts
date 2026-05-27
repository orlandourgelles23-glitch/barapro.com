/**
 * BARAPRO v10.4 — instrumentation.ts
 *
 * Next.js Server Instrumentation — runs ONCE when the server process starts.
 * Automatically initializes the database (creates tables + seeds admin user)
 * if needed. Works in both dev and production (standalone) modes.
 *
 * The register() function is called in BOTH the Node.js and Edge runtimes.
 * We must skip the heavy initialization in the Edge Runtime since it doesn't
 * support Node.js APIs (fs, child_process, process.cwd, etc.).
 *
 * The Prisma client and Windows engine binary are PRE-GENERATED in the
 * distribution ZIP, so no network access is needed for DB initialization.
 */

export async function register() {
  // Skip Edge Runtime — only initialize DB in Node.js runtime
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  // Dynamically import the Node.js-only initialization logic.
  // This avoids Edge Runtime from trying to parse Node.js APIs.
  try {
    const { initDatabase } = await import('./instrumentation-node');
    await initDatabase();
  } catch (err) {
    console.error('[BARAPRO init] Error durante la inicializacion:', err);
    // Don't throw — the app may still work if the DB was previously initialized
  }
}
