import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/** Hash a plaintext password using bcrypt */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/** Compare plaintext against a stored value. Handles both plain and hashed passwords for migration. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Migration: if stored password is not a bcrypt hash, compare directly
  if (!stored.startsWith('$2')) {
    return plain === stored
  }
  return bcrypt.compare(plain, stored)
}

/** Check if a stored password is already a bcrypt hash */
export function isHashed(password: string): boolean {
  return password.startsWith('$2')
}
