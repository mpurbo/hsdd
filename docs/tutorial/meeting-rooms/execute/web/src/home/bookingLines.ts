// ADR-002 Decision 7: a booking is shown in the user's time zone, never the
// room's. Design note 1: the line's date comes from `todayIn(booking.start,
// zone)`, the time module's one conversion from an instant to a date (D6 forbids
// any other in web/src). `formatRange` then adds the end's own date when it
// differs and the zone's short name in a repeated hour.
import type { Booking } from '../api/types'
import { formatDate, formatRange, todayIn, type ZoneName } from '../time/time'

export interface BookingLine {
  readonly id: string
  readonly when: string
  readonly what: string
}

export function bookingLine(booking: Booking, zone: ZoneName): BookingLine {
  const date = todayIn(booking.start, zone)
  return {
    id: booking.id,
    when: `${formatDate(date)}  ${formatRange(booking.start, booking.end, zone, date)}`,
    what: `${booking.roomName} · ${booking.title}`,
  }
}
