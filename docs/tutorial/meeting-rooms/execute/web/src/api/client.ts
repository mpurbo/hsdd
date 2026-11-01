// API client for auth-api@v1, profile-api@v2 and booking-api@v1. An effectful
// shell (`send`) over pure deciders that read only the status and
// `error.code`, never `error.message`. Anything the contracts do not name is
// `unavailable` (D3); fields a contract does not name are ignored, and the
// decoders rebuild each value from the fields its type names (G18).
import type {
  BookResult,
  Booking,
  BookingRequest,
  CancelFailure,
  MyBookingsFailure,
  Profile,
  ProfileFailure,
  Result,
  Room,
  RoomsFailure,
  Session,
  SignInFailure,
} from './types'

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

const INSTANT_FORM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * booking-api@v1 G1: an instant is exactly what `toISOString()` writes for it.
 * Only a string already in that form is parsed, so no date-time without `Z`
 * is ever read as a local time.
 */
const isInstant = (v: unknown): v is string => {
  if (typeof v !== 'string' || !INSTANT_FORM.test(v)) return false
  const ms = Date.parse(v)
  return Number.isFinite(ms) && new Date(ms).toISOString() === v
}

const instantField = (body: unknown, key: string): string | undefined => {
  const v = isRecord(body) ? body[key] : undefined
  return isInstant(v) ? v : undefined
}

/** Every element decoded, or `undefined` when the value is not a list or any element fails. */
function decodeList<T>(v: unknown, decode: (element: unknown) => T | undefined): readonly T[] | undefined {
  if (!Array.isArray(v)) return undefined
  const decoded: T[] = []
  for (const element of v) {
    const value = decode(element)
    if (value === undefined) return undefined
    decoded.push(value)
  }
  return decoded
}

function decodeBooking(v: unknown): Booking | undefined {
  const id = stringField(v, 'id')
  const roomId = stringField(v, 'roomId')
  const roomName = stringField(v, 'roomName')
  const title = stringField(v, 'title')
  const start = instantField(v, 'start')
  const end = instantField(v, 'end')
  return id !== undefined &&
    roomId !== undefined &&
    roomName !== undefined &&
    title !== undefined &&
    start !== undefined &&
    end !== undefined
    ? { id, roomId, roomName, title, start, end }
    : undefined
}

function decodeRoom(v: unknown): Room | undefined {
  if (!isRecord(v)) return undefined
  const id = stringField(v, 'id')
  const name = stringField(v, 'name')
  const office = stringField(v, 'office')
  const timeZone = stringField(v, 'timeZone')
  const seats = typeof v.seats === 'number' ? v.seats : undefined
  const bookings = decodeList(v.bookings, decodeBooking)
  return id !== undefined &&
    name !== undefined &&
    office !== undefined &&
    timeZone !== undefined &&
    seats !== undefined &&
    bookings !== undefined
    ? { id, name, office, timeZone, seats, bookings }
    : undefined
}

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/**
 * One HTTP exchange; `null` when the request fails, times out, or the body is
 * not JSON. A 204 has no body to read, so its body is `null`.
 */
async function send(path: string, init: RequestInit): Promise<Answer | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(path, { ...init, signal: controller.signal })
    return { status: res.status, body: res.status === 204 ? null : ((await res.json()) as unknown) }
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
    if (
      id === undefined ||
      username === undefined ||
      displayName === undefined ||
      email === undefined ||
      phone === undefined ||
      memberSince === undefined
    )
      return fail('unavailable')
    const profile: Profile = { id, username, displayName, email, phone, memberSince }
    // D7: absent is none; present and not a string makes the 200 malformed.
    if (!isRecord(body) || !('timeZone' in body)) return ok(profile)
    const timeZone = stringField(body, 'timeZone')
    return timeZone === undefined ? fail('unavailable') : ok({ ...profile, timeZone })
  }
  if (status === 401 && errorCode(body) === 'UNAUTHORIZED') return fail('unauthorized')
  return fail('unavailable')
}

/** A 200 decodes the list under `key`, in the order received; a 401 `UNAUTHORIZED` is `unauthorized`. */
function decideList<T>(
  answer: Answer | null,
  key: string,
  decode: (element: unknown) => T | undefined,
): Result<readonly T[], 'unauthorized' | 'unavailable'> {
  if (answer === null) return fail('unavailable')
  const { status, body } = answer
  if (status === 200) {
    const list = decodeList(isRecord(body) ? body[key] : undefined, decode)
    return list === undefined ? fail('unavailable') : ok(list)
  }
  if (status === 401 && errorCode(body) === 'UNAUTHORIZED') return fail('unauthorized')
  return fail('unavailable')
}

const BOOK_REFUSALS: Readonly<Record<string, BookResult>> = {
  '401 UNAUTHORIZED': fail('unauthorized'),
  '400 VALIDATION_FAILED': fail('invalid'),
  '422 BOOKING_TOO_LONG': fail('too-long'),
  '422 BOOKING_STARTED': fail('started'),
  '422 BOOKING_TOO_FAR_AHEAD': fail('too-far-ahead'),
}

function decideBook(answer: Answer | null): BookResult {
  if (answer === null) return fail('unavailable')
  const { status, body } = answer
  if (status === 201) {
    const booking = decodeBooking(body)
    return booking === undefined ? fail('unavailable') : ok(booking)
  }
  const code = errorCode(body)
  if (status === 409 && code === 'BOOKING_CONFLICT') {
    const conflict = decodeBooking(isRecord(body) && isRecord(body.error) ? body.error.conflict : undefined)
    return conflict === undefined ? fail('unavailable') : { ok: false, reason: 'conflict', conflict }
  }
  return BOOK_REFUSALS[`${status} ${code}`] ?? fail('unavailable')
}

const CANCEL_REFUSALS: Readonly<Record<string, CancelFailure>> = {
  '401 UNAUTHORIZED': 'unauthorized',
  '404 BOOKING_NOT_FOUND': 'not-found',
  '403 BOOKING_NOT_YOURS': 'not-yours',
  '422 BOOKING_STARTED': 'started',
}

function decideCancel(answer: Answer | null): Result<null, CancelFailure> {
  if (answer === null) return fail('unavailable')
  const { status, body } = answer
  if (status === 204) return ok(null)
  return fail(CANCEL_REFUSALS[`${status} ${errorCode(body)}`] ?? 'unavailable')
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

/**
 * GET /api/rooms: every room with its bookings that overlap [from, to), in the
 * order received (G13). The instants are written into the query as they are,
 * never encoded (D8).
 */
export async function fetchRooms(token: string, from: string, to: string): Promise<Result<readonly Room[], RoomsFailure>> {
  return decideList(await send(`/api/rooms?from=${from}&to=${to}`, { method: 'GET', headers: bearer(token) }), 'rooms', decodeRoom)
}

/** GET /api/me/bookings: the user's bookings that have not ended, in the order received (G14), never sorted here. */
export async function fetchMyBookings(token: string): Promise<Result<readonly Booking[], MyBookingsFailure>> {
  return decideList(await send('/api/me/bookings', { method: 'GET', headers: bearer(token) }), 'bookings', decodeBooking)
}

/** POST /api/bookings with exactly the four fields, the title as typed. */
export async function bookRoom(token: string, request: BookingRequest): Promise<BookResult> {
  const { roomId, start, end, title } = request
  return decideBook(
    await send('/api/bookings', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, start, end, title }),
    }),
  )
}

/** DELETE /api/bookings/{id}; a 204 means the booking is cancelled. The id is path-encoded, a no-op for a UUID. */
export async function cancelBooking(token: string, id: string): Promise<Result<null, CancelFailure>> {
  return decideCancel(await send(`/api/bookings/${encodeURIComponent(id)}`, { method: 'DELETE', headers: bearer(token) }))
}
