// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO Auth Token — JWT-based stateless authentication
// Uses jose (HS256) for signing and verification.
// Tokens survive server restarts and HMR because they are self-validating.
// The signing key is persisted to a file so it survives restarts.
// ═══════════════════════════════════════════════════════════════════════════════

import { SignJWT, jwtVerify } from 'jose'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as crypto from 'crypto'

// ─── Configuration ─────────────────────────────────────────────────────────────

const TOKEN_EXPIRY_SECONDS = 30 * 60 // 30 minutes
const ALG = 'HS256'
const KEY_FILE = join(process.cwd(), '.auth-secret')

// ─── Persistent Key Management ─────────────────────────────────────────────────

let _secret: Uint8Array | null = null

/**
 * Get or generate the persistent signing key.
 * The key is stored in `.auth-secret` file so it survives server restarts.
 */
function getSecret(): Uint8Array {
  if (_secret) return _secret

  // Try AUTH_SECRET_HEX environment variable first (same key as Edge Runtime)
  // This ensures proxy.ts and server-side auth use the same signing key.
  const envKey = process.env.AUTH_SECRET_HEX
  if (envKey && envKey.length === 64) {
    _secret = Buffer.from(envKey, 'hex')
    return _secret
  }

  try {
    // Try to read existing key from file
    if (existsSync(KEY_FILE)) {
      const hexKey = readFileSync(KEY_FILE, 'utf-8').trim()
      if (hexKey.length === 64) {
        // Valid 256-bit hex key
        _secret = Buffer.from(hexKey, 'hex')
        return _secret
      }
    }
  } catch {
    // File read failed — generate a new key
  }

  // Generate a new random 256-bit key
  const key = crypto.randomBytes(32)
  _secret = new Uint8Array(key)

  // Persist to file for next restart
  try {
    writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 })
  } catch {
    // Can't persist — tokens won't survive restart, but still works in-memory
  }

  return _secret
}

// ─── Token Generation ──────────────────────────────────────────────────────────

/**
 * Generate a JWT auth token for a given user ID.
 * The token is self-contained and doesn't need server-side storage.
 */
export async function generateAuthToken(userId: string): Promise<string> {
  const secret = getSecret()

  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS)
    .setJti(crypto.randomUUID())
    .sign(secret)

  return token
}

// ─── Token Validation ──────────────────────────────────────────────────────────

/**
 * Validate a JWT auth token and return the user ID, or null if invalid/expired.
 */
export async function validateAuthToken(token: string): Promise<string | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALG],
    })

    const uid = payload.uid as string | undefined
    if (!uid) return null

    return uid
  } catch {
    // Token expired, invalid signature, malformed, etc.
    return null
  }
}

// ─── Token Revocation (best-effort) ───────────────────────────────────────────
// Note: With stateless JWTs, true revocation requires a blacklist.
// For now, revocation is handled by short token expiry (30 min).
// Users can simply log out and the token will naturally expire.

export function revokeAuthToken(_token: string): void {
  // No-op for stateless JWTs.
  // Token will expire naturally within 30 minutes.
  // For stronger revocation, implement a database-backed blacklist.
}
