interface RateLimitEntry {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number | null
}

const store = new Map<string, RateLimitEntry>()

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const WINDOW_MS = 15 * 60 * 1000 // 15 minute window

export function checkRateLimit(identifier: string): {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: Date | null
} {
  const now = Date.now()
  let entry = store.get(identifier)

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    entry = { attempts: 0, firstAttemptAt: now, lockedUntil: null }
    store.set(identifier, entry)
  }

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: new Date(entry.lockedUntil) }
  }

  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.attempts = 0
    entry.firstAttemptAt = now
    entry.lockedUntil = null
    store.set(identifier, entry)
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS
    store.set(identifier, entry)
    return { allowed: false, remainingAttempts: 0, lockedUntil: new Date(entry.lockedUntil) }
  }

  entry.attempts++
  store.set(identifier, entry)

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - entry.attempts, lockedUntil: null }
}

export function resetRateLimit(identifier: string): void {
  store.delete(identifier)
}

if (typeof globalThis !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now - entry.firstAttemptAt > WINDOW_MS && (!entry.lockedUntil || now > entry.lockedUntil)) {
        store.delete(key)
      }
    }
  }, 10 * 60 * 1000)
  timer.unref()
}
