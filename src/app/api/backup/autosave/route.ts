// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO Autosave — Server-side project backup persistence
// POST /api/backup/autosave  → Save project data to server file system
// GET  /api/backup/autosave  → List available server-side backups for user
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

// ─── Configuration ─────────────────────────────────────────────────────────────

const BACKUPS_DIR = join(process.cwd(), 'backups');
const MAX_BACKUPS_PER_USER = 5;

// ─── Ensure backups directory exists ──────────────────────────────────────────

function ensureBackupsDir() {
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

// ─── Sanitize userId for use in filenames ─────────────────────────────────────

function sanitizeUserId(userId: string): string {
  // Only allow alphanumeric, dashes, underscores
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ─── Get backup files for a user, sorted by timestamp (newest first) ─────────

function getUserBackupFiles(userId: string): string[] {
  ensureBackupsDir();
  const safeId = sanitizeUserId(userId);
  const prefix = `${safeId}_`;

  try {
    const allFiles = readdirSync(BACKUPS_DIR);
    return allFiles
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort()
      .reverse(); // Newest first (filenames contain timestamps)
  } catch {
    return [];
  }
}

// ─── POST: Save a server-side backup ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos de proyecto inválidos' }, { status: 400 });
    }

    ensureBackupsDir();

    const safeId = sanitizeUserId(currentUser.id);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${safeId}_${timestamp}.json`;
    const filepath = join(BACKUPS_DIR, filename);

    // Write backup file
    const payload = {
      userId: safeId,
      savedAt: new Date().toISOString(),
      data: body,
    };

    writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');

    // Clean up old backups: keep only the last MAX_BACKUPS_PER_USER
    const userFiles = getUserBackupFiles(currentUser.id);
    if (userFiles.length > MAX_BACKUPS_PER_USER) {
      const filesToDelete = userFiles.slice(MAX_BACKUPS_PER_USER);
      for (const f of filesToDelete) {
        try {
          unlinkSync(join(BACKUPS_DIR, f));
        } catch {
          // Best-effort deletion
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Respaldo guardado en el servidor',
      filename,
      savedAt: payload.savedAt,
    });
  } catch (error: any) {
    console.error('Autosave POST error:', error);
    return NextResponse.json(
      { error: 'Error al guardar el respaldo en el servidor' },
      { status: 500 }
    );
  }
}

// ─── GET: List available server-side backups for the user ─────────────────────

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    ensureBackupsDir();

    const userFiles = getUserBackupFiles(currentUser.id);
    const backups: Array<{
      filename: string;
      savedAt: string;
      size: number;
    }> = [];

    for (const f of userFiles) {
      try {
        const filepath = join(BACKUPS_DIR, f);
        const stat = statSync(filepath);

        // Extract timestamp from filename: {userId}_{timestamp}.json
        const safeId = sanitizeUserId(currentUser.id);
        const prefix = `${safeId}_`;
        const timestampPart = f.startsWith(prefix)
          ? f.slice(prefix.length, -5) // Remove prefix and .json
          : f.replace('.json', '');

        backups.push({
          filename: f,
          savedAt: timestampPart.replace(/-/g, (match, offset) => {
            // Restore ISO format: first 10 dashes stay as-is for date part
            // Actually, just return a readable version
            return offset < 10 ? '-' : offset === 10 ? 'T' : ':';
          }),
          size: stat.size,
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return NextResponse.json({
      backups,
      count: backups.length,
      maxPerUser: MAX_BACKUPS_PER_USER,
    });
  } catch (error: any) {
    console.error('Autosave GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener la lista de respaldos' },
      { status: 500 }
    );
  }
}
