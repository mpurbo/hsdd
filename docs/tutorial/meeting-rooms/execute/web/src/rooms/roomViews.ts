// AC-4.1, AC-4.3, AC-4.4, ADR-002 Decision 7: each booking is shown in the
// user's zone, followed by the office's own times when the office is in
// another zone. Both lines use the picked date as the line's date, so
// `formatRange` adds a date only to a time that falls on another date in the
// zone it is shown in. G13: rooms and bookings keep the order received.
import type { Room } from '../api/types'
import { asTimeZone, formatRange, sameZone, type IsoDate, type ZoneName } from '../time/time'

export interface RoomBookingView {
  readonly id: string
  readonly line: string
  readonly local: string | undefined
}

export interface RoomView {
  readonly id: string
  readonly heading: string
  readonly bookings: readonly RoomBookingView[]
}

export function roomViews(rooms: readonly Room[], date: IsoDate, zone: ZoneName): readonly RoomView[] {
  return rooms.map((room) => {
    // Validated once per room: a zone Intl refuses gets no local line instead of a throw (Review Focus 4).
    const officeZone = asTimeZone(room.timeZone)
    const showLocal = officeZone !== undefined && !sameZone(officeZone, zone)
    return {
      id: room.id,
      heading: `${room.name} · ${room.office} · ${room.seats} seats`,
      bookings: room.bookings.map((b) => ({
        id: b.id,
        line: `${formatRange(b.start, b.end, zone, date)}  ${b.title}`,
        local: showLocal ? `(${formatRange(b.start, b.end, officeZone, date)} in ${room.office})` : undefined,
      })),
    }
  })
}
