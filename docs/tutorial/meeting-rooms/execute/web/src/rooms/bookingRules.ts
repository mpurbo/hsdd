import type { BookFailure, BookResult } from '../api/types'
import { bookConflictMessage, MESSAGES } from '../messages'
import { formatTime, type Instant, type IsoDate, type ZoneName } from '../time/time'

/** AC-5.6, booking-api@v1 G8: counted in code points, not UTF-16 units. */
export const TITLE_MAX_CHARACTERS = 80

export const titleAllowed = (title: string): boolean => /\S/u.test(title) && [...title].length <= TITLE_MAX_CHARACTERS

export interface TimeChoice {
  readonly value: Instant
  readonly label: string
}

/** ADR-002 Decision 4: the picked date is the line's date, so a repeated hour gets two labels. */
export const timeChoices = (instants: readonly Instant[], zone: ZoneName, date: IsoDate): readonly TimeChoice[] =>
  instants.map((value) => ({ value, label: formatTime(value, zone, date) }))

/** The chosen value if it is still offered, else the first offered one. */
export const keepOrFirst = <T>(chosen: T | undefined, offered: readonly T[]): T | undefined =>
  chosen !== undefined && offered.includes(chosen) ? chosen : offered[0]

export type BookOutcome = { readonly kind: 'booked' | 'refused'; readonly message: string } | { readonly kind: 'expired' }

/** D10: one message per refusal. `conflict` is written from the booking and `unauthorized` ends the session (D1). */
const REFUSAL: Readonly<Record<Exclude<BookFailure, 'conflict' | 'unauthorized'>, string>> = {
  started: MESSAGES.bookStarted,
  'too-long': MESSAGES.bookTooLong,
  'too-far-ahead': MESSAGES.bookTooFarAhead,
  invalid: MESSAGES.bookInvalid,
  unavailable: MESSAGES.unavailable,
}

export function bookOutcome(result: BookResult, zone: ZoneName, date: IsoDate): BookOutcome {
  if (result.ok) return { kind: 'booked', message: MESSAGES.booked }
  if (result.reason === 'unauthorized') return { kind: 'expired' }
  if (result.reason === 'conflict') {
    const { roomName, start, end } = result.conflict
    return { kind: 'refused', message: bookConflictMessage(roomName, formatTime(start, zone, date), formatTime(end, zone, date)) }
  }
  return { kind: 'refused', message: REFUSAL[result.reason] }
}
