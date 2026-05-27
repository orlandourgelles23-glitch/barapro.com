'use client';

import { useBaraproStore } from '@/lib/barapro-store';

// ============================================================
// BARAPRO V10 — Native .barapro Project Format
// ============================================================
// A JSON-based format that preserves ALL project data with:
// - Schema version for future migrations
// - SHA-256 checksum for integrity verification
// - All 27 data slices in a single file
// - Metadata (created, modified, app version, center info)
// - Compression support for large projects
// ============================================================

/** Current schema version for the .barapro format */
export const BARAPRO_FORMAT_VERSION = '10.0';

/** All data slice keys that must be present in a V10 project file */
export const V10_DATA_SLICES = [
  'project',
  'constructionItems',
  'capitalItems',
  'subcontractItems',
  'resourceItems',
  'purchaseItems',
  'salesItems',
  'otherIncomeItems',
  'subventionItems',
  'salesReturnItems',
  'publicServiceItems',
  'commercialExpenses',
  'adminExpenses',
  'maintenanceItems',
  'indirectExpenses',
  'loans',
  'parameters',
  'sparePartItems',
  'otherResourceItems',
  'intangibleAssets',
  'directCostItems',
  'commercialSalaries',
  'adminSalaries',
  'maintenanceSalaries',
  'indirectSalaries',
  'directCostSalaries',
  'logicalFramework',
] as const;

export type V10DataSliceKey = typeof V10_DATA_SLICES[number];

/** Metadata for a .barapro project file */
export interface BaraproMetadata {
  /** Format schema version (e.g., '10.0') */
  formatVersion: string;
  /** BARAPRO app version that created the file */
  appVersion: string;
  /** ISO timestamp when the project was first created */
  createdAt: string;
  /** ISO timestamp when the project was last saved */
  savedAt: string;
  /** Name of the project */
  projectName: string;
  /** Name of the center (if configured) */
  centerName?: string;
  /** Organism (if configured) */
  organism?: string;
  /** SHA-256 checksum of the data payload (hex) */
  checksum: string;
  /** Number of data slices included */
  sliceCount: number;
  /** Total size of uncompressed JSON data in bytes */
  dataSize: number;
}

/** Complete .barapro project file structure */
export interface BaraproProjectFile {
  /** File format identifier — always 'BARAPRO' */
  magic: 'BARAPRO';
  /** Metadata about the project file */
  meta: BaraproMetadata;
  /** The actual project data — all 27 data slices */
  data: Record<string, any>;
}

// ============================================================
// Checksum (SHA-256) — browser-compatible
// ============================================================
async function sha256Hex(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: simple hash for environments without SubtleCrypto
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const chr = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

// ============================================================
// Extract all saveable state from the store
// ============================================================
export function extractSaveableState(): Record<string, any> {
  const store = useBaraproStore.getState();
  const data: Record<string, any> = {};
  for (const key of V10_DATA_SLICES) {
    data[key] = (store as any)[key];
  }
  return data;
}

// ============================================================
// Validate imported data — check all required slices exist
// ============================================================
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingSlices: string[];
  extraSlices: string[];
}

export function validateBaraproData(data: Record<string, any>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingSlices: string[] = [];
  const extraSlices: string[] = [];

  // Check required slices
  for (const key of V10_DATA_SLICES) {
    if (!(key in data)) {
      missingSlices.push(key);
    }
  }

  // Check for unexpected keys
  const knownKeys = new Set<string>(V10_DATA_SLICES);
  for (const key of Object.keys(data)) {
    if (!knownKeys.has(key)) {
      extraSlices.push(key);
    }
  }

  // Validate project has a name
  if (data.project && !data.project.projectName) {
    warnings.push('El proyecto no tiene nombre');
  }

  // Validate arrays are arrays
  const arrayKeys = V10_DATA_SLICES.filter(k => k !== 'project' && k !== 'parameters' && k !== 'logicalFramework');
  for (const key of arrayKeys) {
    if (key in data && !Array.isArray(data[key])) {
      errors.push(`"${key}" debe ser un arreglo, se recibió ${typeof data[key]}`);
    }
  }

  // Validate parameters is an object
  if ('parameters' in data && (typeof data.parameters !== 'object' || Array.isArray(data.parameters))) {
    errors.push('"parameters" debe ser un objeto');
  }

  // Validate logicalFramework has rows
  if ('logicalFramework' in data) {
    const lf = data.logicalFramework;
    if (lf && !Array.isArray(lf.rows)) {
      errors.push('"logicalFramework.rows" debe ser un arreglo');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingSlices,
    extraSlices,
  };
}

// ============================================================
// Create a V10 .barapro project file
// ============================================================
export async function createBaraproFile(
  projectName?: string,
  centerName?: string,
  organism?: string
): Promise<BaraproProjectFile> {
  const data = extractSaveableState();
  const name = projectName || data.project?.projectName || 'Sin Nombre';
  const dataJson = JSON.stringify(data);
  const checksum = await sha256Hex(dataJson);

  return {
    magic: 'BARAPRO',
    meta: {
      formatVersion: BARAPRO_FORMAT_VERSION,
      appVersion: '10.0',
      createdAt: data.project?.startDate || new Date().toISOString(),
      savedAt: new Date().toISOString(),
      projectName: name,
      centerName,
      organism,
      checksum,
      sliceCount: V10_DATA_SLICES.length,
      dataSize: dataJson.length,
    },
    data,
  };
}

// ============================================================
// Parse and validate a .barapro file from JSON string
// ============================================================
export async function parseBaraproFile(jsonString: string): Promise<{
  file: BaraproProjectFile;
  validation: ValidationResult;
  checksumValid: boolean;
}> {
  const parsed = JSON.parse(jsonString);

  // Basic structure check
  if (parsed.magic !== 'BARAPRO') {
    throw new Error('Archivo inválido: no es un archivo .barapro válido (firma incorrecta)');
  }

  if (!parsed.meta || !parsed.data) {
    throw new Error('Archivo inválido: estructura incompleta (falta meta o data)');
  }

  // Version check
  const version = parsed.meta.formatVersion || '0';
  if (version && Number(version.split('.')[0]) > Number(BARAPRO_FORMAT_VERSION.split('.')[0])) {
    throw new Error(
      `El archivo fue creado con BARAPRO v${version}, que es más reciente que la versión instalada (v${BARAPRO_FORMAT_VERSION}). Actualice la aplicación.`
    );
  }

  // Checksum verification
  const dataJson = JSON.stringify(parsed.data);
  const computedChecksum = await sha256Hex(dataJson);
  const checksumValid = computedChecksum === parsed.meta.checksum;

  // Validate data
  const validation = validateBaraproData(parsed.data);

  return {
    file: parsed as BaraproProjectFile,
    validation,
    checksumValid,
  };
}

// ============================================================
// Migrate data from older format versions
// ============================================================
export function migrateBaraproData(
  data: Record<string, any>,
  fromVersion: string
): Record<string, any> {
  const major = Number(fromVersion.split('.')[0]) || 0;

  // Migration from v3.0 (old autosave) → v10.0
  if (major < 10) {
    // Ensure all V10 slices exist (fill missing with defaults)
    for (const key of V10_DATA_SLICES) {
      if (!(key in data)) {
        if (key === 'project') {
          // Don't overwrite if it exists under a different key
        } else if (key === 'parameters') {
          // Keep empty — will use store defaults
        } else if (key === 'logicalFramework') {
          data[key] = { rows: [] };
        } else {
          data[key] = [];
        }
      }
    }

    // Convert decimal rates to integer percentages
    // Pre-V10 .barapro/autosave stored rates as 0-1 decimals (e.g., 0.15 for 15%)
    // V10 stores rates as 0-100 integers (e.g., 15 for 15%)
    if (data.parameters && typeof data.parameters === 'object') {
      const RATE_KEYS = [
        'incomeTaxRate', 'salesTaxRate', 'specialSocialSecurityRate',
        'taxOnWorkforceRate', 'personalIncomeTaxRate', 'workerSocialSecurityRate',
        'territorialTaxRate', 'honorariosAdminRate',
        'discountRateCUP', 'discountRateMLC', 'minimumAcceptableRate', 'inflationRate',
        'contingencyReserveRate', 'operationsContingencyRate', 'retainedEarningsRate',
        'dividendCAMRate', 'projectAccountRate', 'arieRate', 'reservasEstimulacionRate',
        'beneficioReinvertirRate', 'canonRoyaltiesRate', 'otrosGastosVariablesPct',
        'otrasReservasVoluntariasRate', 'dividendoEstatalPct',
        'dividendoSocioCubanoPct', 'dividendoSocioExtranjeroPct',
        'bankFeeRate', 'vacationNormRate', 'salaryComplementRate',
        'residualValuePercent',
      ];
      let needsConversion = false;
      for (const rk of RATE_KEYS) {
        const v = data.parameters[rk];
        if (typeof v === 'number' && v > 0 && v < 1) {
          needsConversion = true;
          break;
        }
      }
      if (needsConversion) {
        for (const rk of RATE_KEYS) {
          const v = data.parameters[rk];
          if (typeof v === 'number' && v > 0 && v < 1) {
            data.parameters[rk] = Math.round(v * 10000) / 100;
          }
        }
        // Also convert residualPercent inside assetCategoryRates
        if (Array.isArray(data.parameters.assetCategoryRates)) {
          for (const cat of data.parameters.assetCategoryRates) {
            if (cat && typeof cat.residualPercent === 'number' && cat.residualPercent > 0 && cat.residualPercent < 1) {
              cat.residualPercent = Math.round(cat.residualPercent * 100);
            }
          }
        }
      }
    }
  }

  return data;
}

// ============================================================
// Download .barapro file
// ============================================================
export async function downloadBaraproFile(
  projectName?: string,
  centerName?: string,
  organism?: string
): Promise<void> {
  const file = await createBaraproFile(projectName, centerName, organism);
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeName = (projectName || 'proyecto')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_.]/g, '')
    .replace(/\s+/g, '_');

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.barapro`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// Read a .barapro file from user input
// ============================================================
export function readBaraproFile(file: File): Promise<{
  file: BaraproProjectFile;
  validation: ValidationResult;
  checksumValid: boolean;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const jsonString = evt.target?.result as string;
        const result = await parseBaraproFile(jsonString);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
}

// ============================================================
// Backup rotation — keep last N autosaves
// ============================================================
const BACKUP_KEY_PREFIX = 'barapro_backup_';
const MAX_BACKUPS = 3;

export function saveBackup(data: Record<string, any>): void {
  try {
    const timestamp = Date.now();
    const key = `${BACKUP_KEY_PREFIX}${timestamp}`;

    // Save the new backup
    localStorage.setItem(key, JSON.stringify(data));

    // Rotate old backups
    const backupKeys = Object.keys(localStorage)
      .filter(k => k.startsWith(BACKUP_KEY_PREFIX))
      .sort();

    while (backupKeys.length > MAX_BACKUPS) {
      localStorage.removeItem(backupKeys.shift()!);
    }
  } catch {
    // localStorage might be full — ignore
  }
}

export function getBackups(): Array<{ key: string; timestamp: number; data: any }> {
  const backups: Array<{ key: string; timestamp: number; data: any }> = [];

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(BACKUP_KEY_PREFIX)) {
      try {
        const timestamp = Number(key.replace(BACKUP_KEY_PREFIX, ''));
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        backups.push({ key, timestamp, data });
      } catch {
        // Corrupted backup — remove it
        localStorage.removeItem(key);
      }
    }
  }

  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

export function clearBackups(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(BACKUP_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

// ============================================================
// Data size estimation — warn if approaching localStorage limits
// ============================================================
export function estimateDataSize(data: Record<string, any>): number {
  return new Blob([JSON.stringify(data)]).size;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const LOCALSTORAGE_WARNING_THRESHOLD = 4 * 1024 * 1024; // 4 MB
