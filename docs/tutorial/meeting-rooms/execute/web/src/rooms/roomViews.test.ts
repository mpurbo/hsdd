import { describe, expect, it } from 'vitest'
import type { Room } from '../api/types'
import { loadFixture } from '../test/fetchStub'
import { roomViews, type RoomView } from './roomViews'

const rooms = (name: string): readonly Room[] =>
  (loadFixture('booking-api', name).response.body as { rooms: Room[] }).rooms

const flat = (views: readonly RoomView[]): string[] =>
  views.flatMap((v) => [
    v.heading,
    ...(v.bookings.length === 0 ? ['(no bookings)'] : v.bookings.flatMap((b) => (b.local === undefined ? [b.line] : [b.line, b.local]))),
  ])

describe('roomViews', () => {
  it('shows rooms-on-a-date for a London user (AC-4.1, AC-4.3)', () => {
    expect(flat(roomViews(rooms('rooms-on-a-date'), '2026-11-05', 'Europe/London'))).toEqual([
      'Merapi · Jakarta · 8 seats',
      '02:00 to 03:00  Sprint planning',
      '(09:00 to 10:00 in Jakarta)',
      'Bromo · Jakarta · 4 seats',
      '(no bookings)',
      'Thames · London · 10 seats',
      '10:00 to 11:00  Design review',
      'Kew · London · 4 seats',
      '(no bookings)',
    ])
  })

  it('shows rooms-range-edges for a Jakarta user (ADR-002 Decision 7)', () => {
    expect(flat(roomViews(rooms('rooms-range-edges'), '2026-11-05', 'Asia/Jakarta'))).toEqual([
      'Merapi · Jakarta · 8 seats',
      '06:00 to 07:00  Planning',
      '08:00 to 08:30  Standup',
      'Bromo · Jakarta · 4 seats',
      '23:45 to Fri 6 Nov 00:15  Wrap-up',
      'Thames · London · 10 seats',
      '(no bookings)',
      'Kew · London · 4 seats',
      'Wed 4 Nov 23:30 to 00:30  Handover',
      '(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)',
    ])
  })

  it('shows rooms-on-a-clock-change-day for a London user (AC-4.4)', () => {
    expect(flat(roomViews(rooms('rooms-on-a-clock-change-day'), '2027-10-31', 'Europe/London'))).toEqual([
      'Merapi · Jakarta · 8 seats',
      '(no bookings)',
      'Bromo · Jakarta · 4 seats',
      '(no bookings)',
      'Thames · London · 10 seats',
      '00:00 to 01:30 BST  Midnight launch',
      '01:00 GMT to 01:30 GMT  After the change',
      '23:30 to Mon 1 Nov 00:00  Last slot',
      'Kew · London · 4 seats',
      '(no bookings)',
    ])
  })

  it('adds the local line for the other office in either direction', () => {
    const views = roomViews(rooms('rooms-on-a-date'), '2026-11-05', 'Asia/Jakarta')
    expect(flat(views).slice(0, 3)).toEqual(['Merapi · Jakarta · 8 seats', '09:00 to 10:00  Sprint planning', 'Bromo · Jakarta · 4 seats'])
    expect(views[0]!.bookings[0]!.local).toBeUndefined()
    expect(flat(views).slice(4, 7)).toEqual(['Thames · London · 10 seats', '17:00 to 18:00  Design review', '(10:00 to 11:00 in London)'])
  })

  it('keeps the order received, rooms and bookings (G13)', () => {
    const received = [...rooms('rooms-range-edges')].reverse().map((r) => (r.name === 'Merapi' ? { ...r, bookings: [...r.bookings].reverse() } : r))
    expect(flat(roomViews(received, '2026-11-05', 'Asia/Jakarta'))).toEqual([
      'Kew · London · 4 seats',
      'Wed 4 Nov 23:30 to 00:30  Handover',
      '(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)',
      'Thames · London · 10 seats',
      '(no bookings)',
      'Bromo · Jakarta · 4 seats',
      '23:45 to Fri 6 Nov 00:15  Wrap-up',
      'Merapi · Jakarta · 8 seats',
      '08:00 to 08:30  Standup',
      '06:00 to 07:00  Planning',
    ])
  })

  it('a room zone Intl refuses: no local line, no throw (Review Focus 4)', () => {
    const bad = rooms('rooms-on-a-date').map((r) => (r.name === 'Merapi' ? { ...r, timeZone: 'Mars/Olympus' } : r))
    const views = roomViews(bad, '2026-11-05', 'Europe/London')
    expect(views[0]!.bookings[0]!.local).toBeUndefined()
    expect(views[0]!.bookings[0]!.line).toBe('02:00 to 03:00  Sprint planning')
  })

  it('keeps the title exactly as received', () => {
    const retitled = rooms('rooms-on-a-date').map((r) =>
      r.name === 'Thames' ? { ...r, bookings: r.bookings.map((b) => ({ ...b, title: '  Two  spaces ' })) } : r,
    )
    const views = roomViews(retitled, '2026-11-05', 'Europe/London')
    expect(views[2]!.bookings[0]!.line.endsWith('  ' + '  Two  spaces ')).toBe(true)
  })

  it('carries the booking id and the room id', () => {
    const source = rooms('rooms-on-a-date')
    const views = roomViews(source, '2026-11-05', 'Europe/London')
    expect(views.map((v) => v.id)).toEqual(source.map((r) => r.id))
    expect(views.flatMap((v) => v.bookings.map((b) => b.id))).toEqual(source.flatMap((r) => r.bookings.map((b) => b.id)))
  })
})
