import { describe, expect, it } from 'vitest'
import type { Booking } from '../api/types'
import { bookConflictMessage } from '../messages'
import { loadFixture } from '../test/fetchStub'
import { startOptions } from '../time/time'
import { bookOutcome, keepOrFirst, timeChoices, titleAllowed } from './bookingRules'

const fixture = (name: string) => loadFixture('booking-api', name)

const titleOf = (name: string) => (fixture(name).request.body as { title: string }).title
describe('titleAllowed (AC-5.6, booking-api@v1 G8)', () => {
  it('accepts book-title-80-characters: 80 code points, 81 UTF-16 units', () => {
    expect([...titleOf('book-title-80-characters')]).toHaveLength(80)
    expect(titleOf('book-title-80-characters')).toHaveLength(81)
    expect(titleAllowed(titleOf('book-title-80-characters'))).toBe(true)
  })
  it("refuses book-title-too-long's 81 code points", () => expect(titleAllowed(titleOf('book-title-too-long'))).toBe(false))
  it('refuses empty and whitespace-only titles (Review Focus 5)', () => {
    for (const t of ['', '   ', '\t\t', '\u00a0\u00a0', ' \t\u00a0\n']) expect(titleAllowed(t)).toBe(false)
  })
  it('accepts a title with spaces around it', () => expect(titleAllowed('  Retro ')).toBe(true))
})
describe('timeChoices (ADR-002 Decision 4)', () => {
  it("labels London's repeated hour twice on 2027-10-31", () => {
    const labels = timeChoices(startOptions('2027-10-31', 'Europe/London', '2027-10-01T09:00:00.000Z'), 'Europe/London', '2027-10-31').map((c) => c.label)
    expect(labels).toHaveLength(100)
    expect(labels.slice(4, 12)).toEqual(['01:00 BST', '01:15 BST', '01:30 BST', '01:45 BST', '01:00 GMT', '01:15 GMT', '01:30 GMT', '01:45 GMT'])
  })
  it("offers nothing in London's skipped hour on 2027-03-28", () => {
    const labels = timeChoices(startOptions('2027-03-28', 'Europe/London', '2027-03-01T09:00:00.000Z'), 'Europe/London', '2027-03-28').map((c) => c.label)
    expect(labels).toHaveLength(92)
    expect(labels.slice(0, 6)).toEqual(['00:00', '00:15', '00:30', '00:45', '02:00', '02:15'])
  })
  it('keeps each instant as the value', () => {
    expect(timeChoices(['2026-11-05T02:00:00.000Z'], 'Asia/Jakarta', '2026-11-05')).toEqual([{ value: '2026-11-05T02:00:00.000Z', label: '09:00' }])
  })
})
describe('keepOrFirst', () => {
  it('keeps a chosen value still offered', () => expect(keepOrFirst('b', ['a', 'b'])).toBe('b'))
  it('falls back to the first', () => expect(keepOrFirst('z', ['a', 'b'])).toBe('a'))
  it('opens on the first', () => expect(keepOrFirst(undefined, ['a', 'b'])).toBe('a'))
  it('is undefined when nothing is offered', () => expect(keepOrFirst('a', [])).toBeUndefined())
})
describe('bookConflictMessage (D10)', () => {
  it('writes the sentence around a formatted range', () => expect(bookConflictMessage('Merapi', '09:00 to 10:00')).toBe('Merapi is already booked from 09:00 to 10:00.'))
})
describe('bookOutcome (D10, booking-api@v1 G18)', () => {
  const conflict = (fixture('book-overlap').response.body as { error: { conflict: Booking } }).error.conflict
  it.each([
    [{ ok: true, value: conflict }, { kind: 'booked', message: 'Booked.' }],
    [{ ok: false, reason: 'conflict', conflict }, { kind: 'refused', message: 'Merapi is already booked from 09:00 to 10:00.' }],
    [{ ok: false, reason: 'started' }, { kind: 'refused', message: 'That time has already started.' }],
    [{ ok: false, reason: 'too-long' }, { kind: 'refused', message: 'A booking can last at most 8 hours.' }],
    [{ ok: false, reason: 'too-far-ahead' }, { kind: 'refused', message: 'A booking can start at most 365 days ahead.' }],
    [{ ok: false, reason: 'invalid' }, { kind: 'refused', message: 'That booking is not valid. Check the times and the title.' }],
    [{ ok: false, reason: 'unavailable' }, { kind: 'refused', message: 'Could not reach the server. Please try again.' }],
    [{ ok: false, reason: 'unauthorized' }, { kind: 'expired' }],
  ] as const)('%o', (result, outcome) => expect(bookOutcome(result, 'Asia/Jakarta', '2026-11-05')).toEqual(outcome))
  it('writes the conflict in the user zone with the picked date as the line date', () => {
    // London user, same conflict: 02:00Z to 03:00Z is 02:00 to 03:00 on 2026-11-05.
    expect(bookOutcome({ ok: false, reason: 'conflict', conflict }, 'Europe/London', '2026-11-05')).toEqual({ kind: 'refused', message: 'Merapi is already booked from 02:00 to 03:00.' })
    // Picked 2026-11-04 in Jakarta: the times carry their own date.
    expect(bookOutcome({ ok: false, reason: 'conflict', conflict }, 'Asia/Jakarta', '2026-11-04')).toEqual({ kind: 'refused', message: 'Merapi is already booked from Thu 5 Nov 09:00 to Thu 5 Nov 10:00.' })
  })
})
