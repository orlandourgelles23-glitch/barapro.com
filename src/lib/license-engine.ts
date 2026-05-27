// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO License Engine — RSA asymmetric time-based licensing system
// GPL-3.0-only — CADEM 2024-2026
// ═══════════════════════════════════════════════════════════════════════════════
//
// ARCHITECTURE (RSA Asymmetric):
//   1. Developer generates keys OFFLINE using master-private.key (RSA-2048)
//   2. Public key is EMBEDDED in this file — only verifies, never signs
//   3. Key format: DETOA-{TIER}-{RS256-JWT}.{signature}
//   4. Payload: licensee, tier, features, issuedAt, expiresAt, machineId?
//   5. Validation: decode → verify RSA signature → check expiry → check machine → features
//   6. Clock tampering: record timestamps, detect backward jumps
//
// SECURITY MODEL:
//   - Only the holder of master-private.key can generate valid licenses
//   - This file contains ONLY the public key — it can VERIFY but NEVER sign
//   - License generation happens externally (offline tool, never in BARAPRO)
//   - Even if someone reads this source code, they CANNOT create new licenses
//
// KEY FORMAT:
//   DETOA-{tier}-{RS256-JWT-token}
//
// TIERS:
//   trial      → 30 days, 3 users, basic features only
//   basic      → 365 days, 5 users, Evaluación + Inversiones + basic reports
//   premium    → 365 days, 15 users, all features + Indicadores + Escenarios
//   enterprise → 730 days, unlimited users, all features + API + multi-site
// ═══════════════════════════════════════════════════════════════════════════════

import { jwtVerify, decodeJwt, importSPKI, type JWTPayload } from 'jose'

// ─── RSA Public Key (embedded — only for VERIFICATION) ──────────────────────────
// This public key can verify licenses signed with the matching private key.
// It CANNOT be used to sign/generate new licenses.
// The private key (master-private.key) is NEVER distributed with the application.
// ═══════════════════════════════════════════════════════════════════════════════

const EMBEDDED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvaud+hD0dA9Iag2Jpt03
rKGRq7sjWc454slSUApsArPXJOfuqaVI1neezB9+zY5nHQI+DtQXn9tSuTudShZo
OXnnzJ1wBjPHG91qDAVqYfEgbCZ+ev4p3scstz5x2M5geW64r63WJ+RPd0hlxnsg
eeiyRBARaQedNILIZlzxJisqc1UB0BH6Zqb6qmZzaGh5X+37IVjmLjgeLhkqiT7X
0cvfREctTAydWGzGuvtqB91cOa80Roiw4JLd/gpQ4SLh0o+38ioALLDMEAPPJlp3
KG17sHUrGgDr53g8bojOHirZsWwqw61Dq+/O9Eq19QF3iqiE6Quh5v7O+668WRu3
eQIDAQAB
-----END PUBLIC KEY-----`

// Cached verification key (imported once, reused)
let _verifyKey: Awaited<ReturnType<typeof import('jose').importSPKI>> | null = null

async function getVerifyKey() {
  if (_verifyKey) return _verifyKey

  const { importSPKI } = await import('jose')
  _verifyKey = await importSPKI(EMBEDDED_PUBLIC_KEY, 'RS256')
  return _verifyKey
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LicenseTier = 'trial' | 'basic' | 'premium' | 'enterprise'
export type LicenseStatus = 'active' | 'expired' | 'expired_grace' | 'revoked' | 'suspended' | 'invalid' | 'none'

export interface LicenseFeatures {
  evaluacion: boolean        // Evaluación de Proyectos
  inversiones: boolean       // Inversiones
  costos: boolean            // Costos
  warehouse: boolean         // Almacén / Registro
  cashRegister: boolean      // Caja / Arqueo
  rawMaterials: boolean      // Materias Primas
  indicadores: boolean       // Indicadores
  suppliers: boolean         // Proveedores
  flujos: boolean            // Flujos de Caja
  reports: boolean           // Reportes básicos
  escenarios: boolean        // Escenarios
  reportes: boolean          // Reportes / Auditoría
  exportPDF: boolean         // Exportar PDF
  exportWord: boolean        // Exportar Word
  exportExcel: boolean       // Exportar Excel
  backup: boolean            // Respaldo de datos
  multiUser: boolean         // Múltiples usuarios
  sensibilidad: boolean      // Análisis de Sensibilidad
  organisms: boolean         // Gestión de entidades
  techSheets: boolean        // Fichas técnicas
  anexos: boolean            // Anexos
  wasteControl: boolean      // Control de merma
  inventoryCheck: boolean    // Conciliación inventario
}

export interface LicensePayload extends JWTPayload {
  lid: string           // License ID (cuid)
  licensee: string      // Organization name
  email: string         // Contact email
  tier: LicenseTier     // License tier
  maxUsers: number      // Max concurrent users
  features: LicenseFeatures // Feature flags
  iat: number           // Issued at (Unix timestamp)
  exp: number           // Expires at (Unix timestamp)
  mid?: string          // Machine ID (bound to this machine)
  nbf?: number          // Not valid before
  jti: string           // JWT ID (unique identifier)
}

export interface LicenseInfo {
  status: LicenseStatus
  tier: LicenseTier
  licensee: string
  email: string
  maxUsers: number
  features: LicenseFeatures
  issuedAt: Date
  expiresAt: Date
  activatedAt: Date | null
  daysRemaining: number
  isGracePeriod: boolean
  key: string
  machineId: string
  warnings: string[]
}

export interface ValidationResult {
  valid: boolean
  status: LicenseStatus
  info: LicenseInfo | null
  warnings: string[]
  errors: string[]
}

// ─── Tier Configuration ───────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<LicenseTier, {
  durationDays: number
  maxUsers: number
  graceDays: number
  features: LicenseFeatures
}> = {
  trial: {
    durationDays: 30,
    maxUsers: 3,
    graceDays: 7,
    features: {
      evaluacion: true, inversiones: true, costos: true, warehouse: true,
      cashRegister: true, rawMaterials: false, indicadores: false,
      suppliers: true, flujos: false, reports: true,
      escenarios: false, reportes: false, exportPDF: true,
      exportWord: false, exportExcel: true, backup: true,
      multiUser: false, sensibilidad: false, organisms: false,
      techSheets: false, anexos: false, wasteControl: false,
      inventoryCheck: false,
    },
  },
  basic: {
    durationDays: 365,
    maxUsers: 5,
    graceDays: 14,
    features: {
      evaluacion: true, inversiones: true, costos: true, warehouse: true,
      cashRegister: true, rawMaterials: true, indicadores: false,
      suppliers: true, flujos: true, reports: true,
      escenarios: false, reportes: true, exportPDF: true,
      exportWord: true, exportExcel: true, backup: true,
      multiUser: true, sensibilidad: true, organisms: true,
      techSheets: true, anexos: false, wasteControl: false,
      inventoryCheck: false,
    },
  },
  premium: {
    durationDays: 365,
    maxUsers: 15,
    graceDays: 21,
    features: {
      evaluacion: true, inversiones: true, costos: true, warehouse: true,
      cashRegister: true, rawMaterials: true, indicadores: true,
      suppliers: true, flujos: true, reports: true,
      escenarios: true, reportes: true, exportPDF: true,
      exportWord: true, exportExcel: true, backup: true,
      multiUser: true, sensibilidad: true, organisms: true,
      techSheets: true, anexos: true, wasteControl: true,
      inventoryCheck: true,
    },
  },
  enterprise: {
    durationDays: 730,
    maxUsers: 999,
    graceDays: 30,
    features: {
      evaluacion: true, inversiones: true, costos: true, warehouse: true,
      cashRegister: true, rawMaterials: true, indicadores: true,
      suppliers: true, flujos: true, reports: true,
      escenarios: true, reportes: true, exportPDF: true,
      exportWord: true, exportExcel: true, backup: true,
      multiUser: true, sensibilidad: true, organisms: true,
      techSheets: true, anexos: true, wasteControl: true,
      inventoryCheck: true,
    },
  },
}

// ─── Feature Labels (for UI) ──────────────────────────────────────────────────

export const FEATURE_LABELS: Record<keyof LicenseFeatures, string> = {
  evaluacion: 'Evaluación de Proyectos',
  inversiones: 'Inversiones',
  costos: 'Costos',
  warehouse: 'Almacén / Registro',
  cashRegister: 'Caja / Arqueo',
  rawMaterials: 'Materias Primas',
  indicadores: 'Indicadores',
  suppliers: 'Proveedores',
  flujos: 'Flujos de Caja',
  reports: 'Reportes Básicos',
  escenarios: 'Escenarios',
  reportes: 'Reportes / Auditoría',
  exportPDF: 'Exportar PDF',
  exportWord: 'Exportar Word',
  exportExcel: 'Exportar Excel',
  backup: 'Respaldo de Datos',
  multiUser: 'Múltiples Usuarios',
  sensibilidad: 'Análisis de Sensibilidad',
  organisms: 'Gestión de Entidades',
  techSheets: 'Fichas Técnicas',
  anexos: 'Anexos',
  wasteControl: 'Control de Merma',
  inventoryCheck: 'Conciliación de Inventario',
}

export const TIER_LABELS: Record<LicenseTier, string> = {
  trial: 'Prueba',
  basic: 'Básica',
  premium: 'Premium',
  enterprise: 'Empresarial',
}

export const TIER_DESCRIPTIONS: Record<LicenseTier, string> = {
  trial: '30 días, funciones básicas, ideal para evaluar',
  basic: '1 año, funciones esenciales para pequeñas empresas',
  premium: '1 año, todas las funciones incluyendo indicadores',
  enterprise: '2 años, acceso completo sin límites',
}

// ─── Built-in Trial License Key ──────────────────────────────────────────────
// This key is created by the seed script and stored in the database.
// It bypasses RSA verification since it's not a JWT — it's an evaluation key.
export const BUILT_IN_TRIAL_KEY = 'DETOA-trial-BUILT-IN'

// ─── License Validation (RSA) ─────────────────────────────────────────────────

/**
 * Validate a license key using RSA public key verification.
 *
 * This function:
 * 1. Decodes the JWT without checking expiry (so we can show expired license info)
 * 2. Verifies the RSA-2048 cryptographic signature
 * 3. Checks machine binding (if applicable)
 * 4. Manually checks expiry and grace periods
 *
 * Only licenses signed with the matching RSA private key will pass verification.
 */
export async function validateLicenseKey(key: string, machineId?: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // ── Built-in trial license (no RSA verification needed) ──
  // The seed script creates this key in the database for evaluation purposes.
  // It is not a JWT — it's a special built-in key that bypasses RSA verification.
  if (key === BUILT_IN_TRIAL_KEY) {
    const tierConfig = TIER_DEFAULTS.trial
    const now = Date.now()

    // Use stored activation timestamp to prevent perpetual trial.
    // localStorage is only available in the browser; on the server (Node.js),
    // it doesn't exist so we fall back to the current time.
    // The trial expiry is primarily enforced by the DB record's expiresAt field.
    const TRIAL_ACTIVATION_KEY = 'barapro-trial-activated'
    let activationTime: number = now
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ls = typeof localStorage !== 'undefined' ? localStorage : (typeof (globalThis as any)?.localStorage !== 'undefined' ? (globalThis as any).localStorage : null)
      if (ls) {
        const stored = ls.getItem(TRIAL_ACTIVATION_KEY)
        if (stored) {
          activationTime = Number(stored)
          if (isNaN(activationTime)) activationTime = now
        } else {
          ls.setItem(TRIAL_ACTIVATION_KEY, String(now))
        }
      }
    } catch {
      // localStorage not available (server-side) — use now
    }

    const issuedAt = new Date(activationTime)
    const expiresAt = new Date(activationTime + tierConfig.durationDays * 24 * 60 * 60 * 1000)
    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)))

    let status: LicenseStatus = 'active'
    let isGracePeriod = false
    const trialWarnings: string[] = ['Licencia de evaluación integrada — para uso de prueba solamente.']

    if (now > expiresAt.getTime()) {
      const graceEnd = expiresAt.getTime() + tierConfig.graceDays * 24 * 60 * 60 * 1000
      if (now <= graceEnd) {
        status = 'expired_grace'
        isGracePeriod = true
        trialWarnings.push(`Licencia de prueba expirada. Período de gracia: ${Math.ceil((graceEnd - now) / 86400000)} días restantes.`)
      } else {
        status = 'expired'
        trialWarnings.push('Licencia de prueba expirada.')
      }
    } else if (daysRemaining <= 7) {
      trialWarnings.push(`Licencia de prueba expira en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}.`)
    }

    const info: LicenseInfo = {
      status,
      tier: 'trial',
      licensee: 'Evaluación',
      email: '',
      maxUsers: tierConfig.maxUsers,
      features: tierConfig.features,
      issuedAt,
      expiresAt,
      activatedAt: new Date(activationTime),
      daysRemaining,
      isGracePeriod,
      key,
      machineId: machineId || '',
      warnings: trialWarnings,
    }

    return {
      valid: status === 'active' || status === 'expired_grace',
      status,
      info,
      warnings: info.warnings,
      errors: status === 'expired' ? ['Licencia de prueba expirada.'] : [],
    }
  }

  // Check key format
  if (!key.startsWith('DETOA-')) {
    return { valid: false, status: 'invalid', info: null, warnings, errors: ['Formato de clave inválido — debe comenzar con DETOA-'] }
  }

  const parts = key.split('-')
  if (parts.length < 3) {
    return { valid: false, status: 'invalid', info: null, warnings, errors: ['Formato de clave inválido'] }
  }

  // Extract tier from key format: DETOA-{TIER}-{token}
  const tierStr = parts[1]?.toLowerCase()
  const token = key.slice(key.indexOf('-', 6) + 1) // After "DETOA-TIER-"

  if (!tierStr || !TIER_DEFAULTS[tierStr as LicenseTier]) {
    return { valid: false, status: 'invalid', info: null, warnings, errors: ['Tier de licencia no reconocido'] }
  }

  const tier = tierStr as LicenseTier

  try {
    const verifyKey = await getVerifyKey()

    // Step 1: Decode the JWT payload WITHOUT checking expiry
    // This allows us to show license info even for expired licenses
    let payload: JWTPayload
    try {
      payload = decodeJwt(token)
    } catch (decodeErr) {
      errors.push('Token de licencia corrupto o malformado.')
      return { valid: false, status: 'invalid', info: null, warnings, errors }
    }

    const licensePayload = payload as unknown as LicensePayload

    // Step 2: Verify the RSA cryptographic signature
    // jwtVerify will throw if the signature is invalid OR if expired (ERR_JWT_EXPIRED)
    // We handle both cases separately
    try {
      await jwtVerify(token, verifyKey, {
        algorithms: ['RS256'],
      })
    } catch (verifyErr: unknown) {
      const err = verifyErr as { code?: string; message?: string }
      // jose throws JWTExpiredError (code: 'ERR_JWT_EXPIRED') when expired but signature IS valid
      const isExpiredOnly = err.code === 'ERR_JWT_EXPIRED' ||
        (err.message && err.message.includes('expir'))

      if (!isExpiredOnly) {
        // Real signature failure — tampered, forged, or signed with wrong key
        errors.push('Firma de licencia inválida. Contacte al proveedor.')
        return { valid: false, status: 'invalid', info: null, warnings, errors }
      }
      // Signature is valid, just expired — continue to manual expiry check below
    }

    const now = Math.floor(Date.now() / 1000)

    // Step 3: Check machine binding
    if (licensePayload.mid && machineId && licensePayload.mid !== machineId) {
      errors.push('Licencia vinculada a otra máquina. Contacte al proveedor.')
      return { valid: false, status: 'invalid', info: null, warnings, errors }
    }

    // Step 4: Check revocation
    if (licensePayload.rev === true) {
      return { valid: false, status: 'revoked', info: null, warnings, errors: ['Licencia revocada'] }
    }

    // Step 5: Manual expiry check (not relying on jose, so we can show grace periods)
    const expiresAt = licensePayload.exp
    const tierConfig = TIER_DEFAULTS[tier]
    const gracePeriod = tierConfig.graceDays * 24 * 60 * 60 // in seconds

    let status: LicenseStatus = 'active'
    let isGracePeriod = false
    let daysRemaining = Math.floor((expiresAt - now) / 86400)

    if (now > expiresAt) {
      if (now <= expiresAt + gracePeriod) {
        status = 'expired_grace'
        isGracePeriod = true
        daysRemaining = 0
        warnings.push(`Licencia expirada. Período de gracia: ${Math.ceil((expiresAt + gracePeriod - now) / 86400)} días restantes.`)
      } else {
        status = 'expired'
        daysRemaining = 0
        errors.push('Licencia expirada. Renueve para continuar usando el sistema.')
      }
    } else if (daysRemaining <= 14) {
      warnings.push(`Licencia expira en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}. Renueve pronto.`)
    } else if (daysRemaining <= 30) {
      warnings.push(`Licencia expira en ${daysRemaining} días.`)
    }

    // Convert JWT timestamps to Date objects safely.
    // JWT spec: iat/exp are SECONDS since epoch. Some keys may incorrectly
    // use milliseconds, so we detect and handle both cases.
    const safeDateFromTimestamp = (ts: number): Date => {
      // If timestamp > 1e12, it's likely already in milliseconds
      const ms = ts > 1e12 ? ts : ts * 1000
      const d = new Date(ms)
      // Sanity clamp: dates must be between 2020-01-01 and 2100-01-01
      const MIN_MS = new Date('2020-01-01').getTime()
      const MAX_MS = new Date('2100-01-01').getTime()
      if (d.getTime() < MIN_MS || d.getTime() > MAX_MS) {
        return new Date() // Fallback to now if date is unreasonable
      }
      return d
    }

    const info: LicenseInfo = {
      status,
      tier: licensePayload.tier || tier,
      licensee: licensePayload.licensee || '',
      email: licensePayload.email || '',
      maxUsers: licensePayload.maxUsers || tierConfig.maxUsers,
      features: (licensePayload.features || tierConfig.features) as LicenseFeatures,
      issuedAt: safeDateFromTimestamp(licensePayload.iat || now),
      expiresAt: safeDateFromTimestamp(licensePayload.exp || expiresAt),
      activatedAt: null, // Set by DB on activation
      daysRemaining: Math.max(0, daysRemaining),
      isGracePeriod,
      key,
      machineId: licensePayload.mid || '',
      warnings,
    }

    return {
      valid: status === 'active' || status === 'expired_grace',
      status,
      info,
      warnings,
      errors,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    errors.push(`Error al validar licencia: ${message}`)
    return { valid: false, status: 'invalid', info: null, warnings, errors }
  }
}

// ─── Simple hash fallback (for environments without crypto.subtle) ──────────

/**
 * Simple deterministic hash function (djb2 variant) for non-secure contexts.
 * NOT cryptographically secure, but sufficient for machine fingerprinting.
 */
async function simpleHash(str: string): Promise<string> {
  // Use SubtleHash if available in a web worker, otherwise use djb2
  let hash1 = 5381
  let hash2 = 52711
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash1 = ((hash1 << 5) + hash1 + ch) & 0xffffffff
    hash2 = ((hash2 << 5) + hash2 + ch) & 0xffffffff
  }
  const combined = ((hash1 >>> 0).toString(16).padStart(8, '0')) +
                   ((hash2 >>> 0).toString(16).padStart(8, '0')) +
                   ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0')
  // Pad to at least 32 chars
  return combined.padEnd(32, combined)
}

// ─── Machine Fingerprinting ───────────────────────────────────────────────────

/**
 * Generate a machine fingerprint based on available browser/system info.
 * This is NOT a security measure — just a soft binding to discourage casual sharing.
 */
export async function generateMachineId(): Promise<string> {
  const components: string[] = []

  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)
  components.push(`${window.devicePixelRatio}`)

  // Browser info
  components.push(navigator.userAgent)
  components.push(navigator.language)
  components.push(`${navigator.hardwareConcurrency || 'unknown'}`)

  // Platform
  components.push(navigator.platform || 'unknown')

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)

  // Canvas fingerprint (simplified)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('DETOA-FP', 2, 15)
      components.push(canvas.toDataURL().slice(-50))
    }
  } catch {
    // Canvas not available
  }

  const raw = components.join('|||')

  // SHA-256 hash — with fallback for non-secure contexts (HTTP without localhost)
  let hashHex: string
  try {
    if (crypto.subtle) {
      const encoder = new TextEncoder()
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw))
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } else {
      // Fallback: simple hash for environments without crypto.subtle
      hashHex = await simpleHash(raw)
    }
  } catch {
    // If crypto.subtle fails for any reason, use fallback
    hashHex = await simpleHash(raw)
  }

  // Return first 32 hex chars (128 bits — sufficient for fingerprinting)
  return `MF-${hashHex.substring(0, 32)}`
}

// ─── Clock Tampering Detection ────────────────────────────────────────────────

const CLOCK_STORAGE_KEY = 'barapro-clock-state'

interface ClockState {
  lastTimestamp: number  // Unix ms
  lastUpdated: string    // ISO date string
}

/**
 * Check for clock tampering. Returns true if time seems normal.
 */
export function checkClockTampering(): { ok: boolean; eventType: string; details: string } {
  try {
    const stored = localStorage.getItem(CLOCK_STORAGE_KEY)
    const now = Date.now()

    if (!stored) {
      // First run — initialize
      saveClockState(now)
      return { ok: true, eventType: 'normal', details: 'Primera ejecución' }
    }

    const state: ClockState = JSON.parse(stored)
    const diff = now - state.lastTimestamp

    // If diff is negative, clock went backward — suspicious
    if (diff < -60000) { // More than 1 minute backward
      return {
        ok: false,
        eventType: 'suspicious_backward',
        details: `Reloj movido atrás ${Math.abs(diff) / 1000}s. Último: ${new Date(state.lastTimestamp).toLocaleString()}`
      }
    }

    // If diff is more than 1 year forward, suspicious (unless genuinely dormant)
    if (diff > 365 * 24 * 60 * 60 * 1000) {
      return {
        ok: false,
        eventType: 'suspicious_forward',
        details: `Salto de tiempo detectado: ${Math.floor(diff / 86400000)} días.`
      }
    }

    // Update state (only if forward and reasonable)
    if (diff > 5000) { // Update every 5 seconds minimum
      saveClockState(now)
    }

    return { ok: true, eventType: 'normal', details: '' }
  } catch {
    return { ok: true, eventType: 'normal', details: 'Error al verificar reloj' }
  }
}

function saveClockState(timestamp: number) {
  try {
    const state: ClockState = {
      lastTimestamp: timestamp,
      lastUpdated: new Date(timestamp).toISOString(),
    }
    localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage not available
  }
}

// ─── Local License Storage ───────────────────────────────────────────────────

const LICENSE_STORAGE_KEY = 'barapro-license-key'
const LICENSE_INFO_KEY = 'barapro-license-info'

/**
 * Save license key to localStorage
 */
export function saveLicenseToLocal(key: string): void {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, key)
  } catch {
    // localStorage not available
  }
}

/**
 * Get license key from localStorage
 */
export function getLocalLicenseKey(): string | null {
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Remove license from localStorage
 */
export function removeLocalLicense(): void {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY)
    localStorage.removeItem(LICENSE_INFO_KEY)
  } catch {
    // localStorage not available
  }
}

/**
 * Save cached license info
 */
export function cacheLicenseInfo(info: LicenseInfo): void {
  try {
    localStorage.setItem(LICENSE_INFO_KEY, JSON.stringify({
      ...info,
      cachedAt: Date.now(),
    }))
  } catch {
    // localStorage not available
  }
}

/**
 * Get cached license info (for fast UI rendering before async validation)
 * Restores Date objects from ISO strings produced by JSON serialization.
 */
export function getCachedLicenseInfo(): LicenseInfo | null {
  try {
    const cached = localStorage.getItem(LICENSE_INFO_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    // Restore Date objects from serialized ISO strings
    if (parsed) {
      if (parsed.issuedAt) parsed.issuedAt = new Date(parsed.issuedAt)
      if (parsed.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt)
      if (parsed.activatedAt) parsed.activatedAt = new Date(parsed.activatedAt)
    }
    return parsed
  } catch {
    return null
  }
}

// ─── Feature Gate Helper ─────────────────────────────────────────────────────

/**
 * Check if a specific feature is available for the current license
 */
export function hasFeature(features: LicenseFeatures, feature: keyof LicenseFeatures): boolean {
  return features[feature] === true
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Format a date for display. Accepts Date, string (ISO), or number (timestamp).
 * Handles deserialized dates from localStorage that come back as strings.
 */
export function formatLicenseDate(date: Date | string | number | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Get a human-readable status text
 */
export function getLicenseStatusText(status: LicenseStatus): string {
  switch (status) {
    case 'active': return 'Activa'
    case 'expired': return 'Expirada'
    case 'expired_grace': return 'Expirada (Período de Gracia)'
    case 'revoked': return 'Revocada'
    case 'suspended': return 'Suspendida'
    case 'invalid': return 'Inválida'
    case 'none': return 'Sin Licencia'
  }
}

/**
 * Get status color for UI
 */
export function getLicenseStatusColor(status: LicenseStatus): string {
  switch (status) {
    case 'active': return 'text-emerald-600'
    case 'expired_grace': return 'text-amber-600'
    case 'expired': return 'text-red-600'
    case 'revoked': return 'text-red-800'
    case 'suspended': return 'text-orange-600'
    case 'invalid': return 'text-red-600'
    case 'none': return 'text-gray-500'
  }
}
