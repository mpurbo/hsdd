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
} as const
