// The browser session (D2): `{ token, expiresAt }` under one sessionStorage
// key. Never throws: storage that is missing or refuses access means "no
// session". It does not judge expiry; GET /api/me does (D1).
import type { Session } from '../api/types'

export const SESSION_KEY = 'simple-login.session'

function defaultStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function parseSession(raw: string | null): Session | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { token, expiresAt } = value as Record<string, unknown>
    return typeof token === 'string' && typeof expiresAt === 'string' ? { token, expiresAt } : null
  } catch {
    return null
  }
}

export function loadSession(storage: Storage | null = defaultStorage()): Session | null {
  try {
    return parseSession(storage?.getItem(SESSION_KEY) ?? null)
  } catch {
    return null
  }
}

export function saveSession(session: Session, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify({ token: session.token, expiresAt: session.expiresAt }))
  } catch {
    // Storage refused (privacy mode, quota): the session lasts only in memory.
  }
}

export function clearSession(storage: Storage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored that we can reach.
  }
}
