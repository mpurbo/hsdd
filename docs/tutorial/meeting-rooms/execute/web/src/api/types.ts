// The web node's own types for auth-api@v1, profile-api@v2 and booking-api@v1
// (no shared code package: each node writes its types from the contract's
// Interface).

/** What the web app keeps of a 200 from POST /api/login (D2). The token is opaque. */
export interface Session {
  readonly token: string
  readonly expiresAt: string
}

/**
 * A 200 from GET /api/me (profile-api@v2). `phone` is shown as given, never
 * reformatted. `timeZone` is the IANA name as received, absent when the
 * profile has none (a backend that predates the field, G5; D7).
 */
export interface Profile {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly email: string
  readonly phone: string
  readonly memberSince: string
  readonly timeZone?: string
}

export type SignInFailure = 'invalid-credentials' | 'invalid-input' | 'unavailable'

export type ProfileFailure = 'unauthorized' | 'unavailable'

/** booking-api@v1 `Booking`. `start` and `end` are instants, kept as the strings received. */
export interface Booking {
  readonly id: string
  readonly roomId: string
  readonly roomName: string
  readonly title: string
  readonly start: string
  readonly end: string
}

/** booking-api@v1 `RoomWithBookings`: a room and its bookings that overlap the requested range. */
export interface Room {
  readonly id: string
  readonly name: string
  readonly office: string
  readonly timeZone: string
  readonly seats: number
  readonly bookings: readonly Booking[]
}

export type RoomsFailure = 'unauthorized' | 'unavailable'

export type MyBookingsFailure = 'unauthorized' | 'unavailable'

/** The body of POST /api/bookings: exactly these four fields. */
export interface BookingRequest {
  readonly roomId: string
  readonly start: string
  readonly end: string
  readonly title: string
}

export type BookFailure = 'unauthorized' | 'invalid' | 'too-long' | 'started' | 'too-far-ahead' | 'conflict' | 'unavailable'

export type CancelFailure = 'unauthorized' | 'not-found' | 'not-yours' | 'started' | 'unavailable'

/** A `conflict` carries the booking the request overlaps (`error.conflict`, G6). */
export type BookResult =
  | { readonly ok: true; readonly value: Booking }
  | { readonly ok: false; readonly reason: Exclude<BookFailure, 'conflict'> }
  | { readonly ok: false; readonly reason: 'conflict'; readonly conflict: Booking }

export type Result<T, F> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: F }
