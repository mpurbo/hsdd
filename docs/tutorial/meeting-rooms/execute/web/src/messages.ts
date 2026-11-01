// User-facing copy fixed by the PRD and the node's D3 and D10 (one message per failure).
export const MESSAGES = {
  /** AC-1.2: never says which of the two was wrong. */
  invalidCredentials: 'Incorrect username or password.',
  /** D3: a network failure or an unexpected answer. */
  unavailable: 'Could not reach the server. Please try again.',
  /** AC-2.3, D1: GET /api/me answered 401. */
  sessionExpired: 'Your session has expired. Please sign in again.',
  /** D10: the list is empty. */
  noBookings: '(no bookings)',
  /** D10: a Cancel answered 422 `BOOKING_STARTED` (D9: the backend decides). */
  cancelStarted: 'That booking has already started, so it cannot be cancelled.',
  /** D10: a Cancel answered 404 `BOOKING_NOT_FOUND`, for example another tab cancelled it first. */
  cancelNotFound: 'That booking was already cancelled.',
  /** D10: a Cancel answered 403 `BOOKING_NOT_YOURS`. */
  cancelNotYours: 'You can cancel only your own bookings.',
  /** D7: the profile has no usable time zone. */
  timeZoneNotAvailable: 'Not available',
  /** D7: shown in place of the bookings list. */
  bookingsNeedTimeZone: 'Bookings need your time zone, which is not available.',
  /** D10: a Book answered 201. */
  booked: 'Booked.',
  /** D10: a Book answered 422 `BOOKING_STARTED`. */
  bookStarted: 'That time has already started.',
  /** D10: a Book answered 422 `BOOKING_TOO_LONG`. */
  bookTooLong: 'A booking can last at most 8 hours.',
  /** D10: a Book answered 422 `BOOKING_TOO_FAR_AHEAD`. */
  bookTooFarAhead: 'A booking can start at most 365 days ahead.',
  /** D10: a Book answered 400 or another invalid-booking code. */
  bookInvalid: 'That booking is not valid. Check the times and the title.',
  /** D11: the picked date has no start left. */
  noTimesLeft: 'No times left on this date.',
} as const

/**
 * D10: a Book answered 409. The sentence is `{roomName} is already booked from {start} to {end}.`;
 * `range` is `formatRange`'s `{start} to {end}` for the booking's own times in the user's zone, never `error.message` (G18).
 */
export const bookConflictMessage = (roomName: string, range: string): string => `${roomName} is already booked from ${range}.`
