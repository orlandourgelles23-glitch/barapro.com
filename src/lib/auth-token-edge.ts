// ═══════════════════════════════════════════════════════════════════════════════
// BARAPRO Edge-compatible Auth Token — JWT verification for Edge Runtime
// This file uses only Web APIs (no Node.js fs/path/crypto) so it works in middleware.
// ═══════════════════════════════════════════════════════════════════════════════

import { jwtVerify } from 'jose';

const ALG = 'HS256';

// Cache the key in memory (Edge Runtime doesn't have filesystem)
let _secret: Uint8Array | null = null;

/**
 * Get the signing key for Edge Runtime.
 * Reads from the EDGE_AUTH_SECRET environment variable (hex-encoded 256-bit key).
 * Falls back to reading from the .auth-secret file content via a build-time variable.
 */
function getEdgeSecret(): Uint8Array {
  if (_secret) return _secret;

  // Try environment variable first (recommended for production)
  const envKey = process.env.EDGE_AUTH_SECRET;
  if (envKey && envKey.length === 64) {
    _secret = new Uint8Array(
      envKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    return _secret;
  }

  // Try reading the auth secret hex key from environment
  const authSecret = process.env.AUTH_SECRET_HEX;
  if (authSecret && authSecret.length === 64) {
    _secret = new Uint8Array(
      authSecret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    return _secret;
  }

  throw new Error(
    'EDGE_AUTH_SECRET or AUTH_SECRET_HEX environment variable is required for Edge Runtime auth. ' +
    'Set it to the hex content of your .auth-secret file.'
  );
}

/**
 * Validate a JWT auth token in Edge Runtime.
 * Returns the user ID if valid, or null if invalid/expired.
 */
export async function validateAuthTokenEdge(token: string): Promise<string | null> {
  try {
    const secret = getEdgeSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALG],
    });

    const uid = payload.uid as string | undefined;
    if (!uid) return null;

    return uid;
  } catch {
    // Token expired, invalid signature, malformed, etc.
    return null;
  }
}
