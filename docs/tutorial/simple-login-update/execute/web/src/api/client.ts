// API client for auth-api@v1 and profile-api@v2. An effectful shell (`send`)
// over pure deciders that read only the status and `error.code`, never
// `error.message`. Anything the contracts do not name is `unavailable` (D3);
// fields a contract does not name are ignored.
import type { Profile, ProfileFailure, Result, Session, SignInFailure } from './types'

/**
 * A request that has not answered after this long is `unavailable`, so every
 * call settles. Well above the PRD's 3-second sign-in target.
 */
export const REQUEST_TIMEOUT_MS = 10_000

interface Answer {
  readonly status: number
  readonly body: unknown
}

const ok = <T>(value: T): { readonly ok: true; readonly value: T } => ({ ok: true, value })
const fail = <F>(reason: F): { readonly ok: false; readonly reason: F } => ({ ok: false, reason })

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const stringField = (body: unknown, key: string): string | undefined => {
  const v = isRecord(body) ? body[key] : undefined
  return typeof v === 'string' ? v : undefined
}

const errorCode = (body: unknown): string | undefined =>
  isRecord(body) ? stringField(body.error, 'code') : undefined

/** One HTTP exchange; `null` when the request fails, times out, or the body is not JSON. */
async function send(path: string, init: RequestInit): Promise<Answer | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(path, { ...init, signal: controller.signal })
    return { status: res.status, body: (await res.json()) as unknown }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function decideSignIn(answer: Answer | null): Result<Session, SignInFailure> {
  if (answer === null) return fail('unavailable')
  const { status, body } = answer
  if (status === 200) {
    const token = stringField(body, 'token')
    const expiresAt = stringField(body, 'expiresAt')
    return token !== undefined && expiresAt !== undefined ? ok({ token, expiresAt }) : fail('unavailable')
  }
  const code = errorCode(body)
  if (status === 400 && code === 'VALIDATION_FAILED') return fail('invalid-input')
  if (status === 401 && code === 'INVALID_CREDENTIALS') return fail('invalid-credentials')
  return fail('unavailable')
}

const PROFILE_FIELDS = ['id', 'username', 'displayName', 'email', 'phone', 'memberSince'] as const

function decideProfile(answer: Answer | null): Result<Profile, ProfileFailure> {
  if (answer === null) return fail('unavailable')
  const { status, body } = answer
  if (status === 200) {
    const [id, username, displayName, email, phone, memberSince] = PROFILE_FIELDS.map((key) => stringField(body, key))
    return id !== undefined &&
      username !== undefined &&
      displayName !== undefined &&
      email !== undefined &&
      phone !== undefined &&
      memberSince !== undefined
      ? ok({ id, username, displayName, email, phone, memberSince })
      : fail('unavailable')
  }
  if (status === 401 && errorCode(body) === 'UNAUTHORIZED') return fail('unauthorized')
  return fail('unavailable')
}

/** POST /api/login. The username is sent exactly as typed (auth-api@v1 matches it exactly). */
export async function signIn(username: string, password: string): Promise<Result<Session, SignInFailure>> {
  return decideSignIn(
    await send('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  )
}

/** GET /api/me with the opaque token sent back verbatim. */
export async function fetchProfile(token: string): Promise<Result<Profile, ProfileFailure>> {
  return decideProfile(await send('/api/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } }))
}
