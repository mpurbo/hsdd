import { describe, expect, it } from 'vitest'
import type { Booking } from '../api/types'
import { loadFixture } from '../test/fetchStub'
import { bookingLine } from './bookingLines'

const budi = (loadFixture('booking-api', 'my-bookings-budi').response.body as { bookings: Booking[] }).bookings

const at = (start: string, end: string, title = 'T'): Booking => ({
  id: '00000000-0000-4000-8000-0000000000aa',
  roomId: 'thames',
  roomName: 'Thames',
  title,
  start,
  end,
})

const ID = (n: string) => `00000000-0000-4000-8000-0000000000${n}`

describe('bookingLine', () => {
  it('shows the fixture bookings in London time', () => {
    expect(budi.map((b) => bookingLine(b, 'Europe/London'))).toEqual([
      { id: ID('13'), when: 'Thu 5 Nov  09:00 to 10:00', what: 'Merapi · Ongoing sync' },
      { id: ID('11'), when: 'Thu 5 Nov  10:00 to 11:00', what: 'Thames · Design review' },
      { id: ID('16'), when: 'Thu 5 Nov  10:00 to 10:30', what: 'Kew · Quick check' },
      { id: ID('15'), when: 'Thu 12 Nov  10:00 to 11:00', what: 'Merapi · Next week' },
    ])
  })

  it("uses the user's zone, never the room's", () => {
    expect(budi.map((b) => bookingLine(b, 'Asia/Jakarta').when)).toEqual([
      'Thu 5 Nov  16:00 to 17:00',
      'Thu 5 Nov  17:00 to 18:00',
      'Thu 5 Nov  17:00 to 17:30',
      'Thu 12 Nov  17:00 to 18:00',
    ])
  })

  it("carries the end's own date when the booking crosses the user's midnight", () => {
    expect(bookingLine(at('2026-11-05T16:00:00.000Z', '2026-11-05T19:00:00.000Z'), 'Asia/Jakarta').when).toBe(
      'Thu 5 Nov  23:00 to Fri 6 Nov 02:00',
    )
  })

  it("carries the zone's short name in London's repeated hour", () => {
    expect(bookingLine(at('2027-10-31T01:00:00.000Z', '2027-10-31T01:30:00.000Z'), 'Europe/London').when).toBe(
      'Sun 31 Oct  01:00 GMT to 01:30 GMT',
    )
    expect(bookingLine(at('2027-10-30T23:00:00.000Z', '2027-10-31T00:30:00.000Z'), 'Europe/London').when).toBe(
      'Sun 31 Oct  00:00 to 01:30 BST',
    )
  })

  it('keeps the title exactly as received', () => {
    expect(bookingLine(at('2026-11-05T10:00:00.000Z', '2026-11-05T11:00:00.000Z', '  Café ☕ sync  '), 'Europe/London').what).toBe(
      'Thames ·   Café ☕ sync  ',
    )
  })
})
