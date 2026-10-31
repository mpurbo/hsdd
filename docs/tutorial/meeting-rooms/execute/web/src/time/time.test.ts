import { describe, expect, it } from 'vitest'
import { asTimeZone, dayRange, endOptions, sameZone, startOptions, todayIn } from './time'

const LONDON = 'Europe/London'
const JAKARTA = 'Asia/Jakarta'

describe('todayIn', () => {
  it('gives 2026-11-04 for 2026-11-04T16:59:59.999Z in Asia/Jakarta', () => {
    expect(todayIn('2026-11-04T16:59:59.999Z', JAKARTA)).toBe('2026-11-04')
  })
  it('gives 2026-11-05 for 2026-11-04T17:00:00.000Z in Asia/Jakarta', () => {
    expect(todayIn('2026-11-04T17:00:00.000Z', JAKARTA)).toBe('2026-11-05')
  })
  it('gives London its own date for the same instant', () => {
    expect(todayIn('2026-11-04T17:00:00.000Z', LONDON)).toBe('2026-11-04')
  })
})

describe('asTimeZone', () => {
  it('gives the name when Intl accepts it', () => {
    expect(asTimeZone(JAKARTA)).toBe(JAKARTA)
    expect(asTimeZone(LONDON)).toBe(LONDON)
  })
  it('gives none for Mars/Olympus', () => {
    expect(asTimeZone('Mars/Olympus')).toBeUndefined()
  })
  it('gives none for an empty name', () => {
    expect(asTimeZone('')).toBeUndefined()
  })
  it('gives an offset Intl accepts unchanged (D7: a guard against a crash, not an IANA check)', () => {
    expect(asTimeZone('+07:00')).toBe('+07:00')
  })
})

describe('sameZone', () => {
  it('compares names as strings', () => {
    expect(sameZone(JAKARTA, JAKARTA)).toBe(true)
    expect(sameZone(JAKARTA, LONDON)).toBe(false)
    expect(sameZone(JAKARTA, 'asia/jakarta')).toBe(false)
  })
})

const EARLY = '2000-01-01T00:00:00.000Z' // before every date below: startOptions then lists all of a date's instants
const hours = (r: { start: string; end: string }) => (Date.parse(r.end) - Date.parse(r.start)) / 3_600_000

describe('dayRange', () => {
  it('2026-11-05 in Europe/London is 24 hours', () => {
    expect(dayRange('2026-11-05', LONDON)).toEqual({ start: '2026-11-05T00:00:00.000Z', end: '2026-11-06T00:00:00.000Z' })
  })
  it('2026-11-05 in Asia/Jakarta is 24 hours', () => {
    expect(dayRange('2026-11-05', JAKARTA)).toEqual({ start: '2026-11-04T17:00:00.000Z', end: '2026-11-05T17:00:00.000Z' })
  })
  it('2027-03-28 in Europe/London is 23 hours', () => {
    const r = dayRange('2027-03-28', LONDON)
    expect(r).toEqual({ start: '2027-03-28T00:00:00.000Z', end: '2027-03-28T23:00:00.000Z' })
    expect(hours(r)).toBe(23)
  })
  it('2027-10-31 in Europe/London is 25 hours', () => {
    const r = dayRange('2027-10-31', LONDON)
    expect(r).toEqual({ start: '2027-10-30T23:00:00.000Z', end: '2027-11-01T00:00:00.000Z' })
    expect(hours(r)).toBe(25)
  })
  it('2011-12-30 in Pacific/Apia, a date the zone skipped, is 0 hours', () => {
    const r = dayRange('2011-12-30', 'Pacific/Apia')
    expect(r.start).toBe(r.end)
  })
  it.each(['', '2026-11-5', '2026-02-30', '2026-11-05T00:00:00.000Z'])('throws RangeError for the date %j', (bad) => {
    expect(() => dayRange(bad, LONDON)).toThrow(RangeError)
  })
})

describe('startOptions', () => {
  it('2027-03-28 in Europe/London has 92 quarter-hour instants', () => {
    expect(startOptions('2027-03-28', LONDON, EARLY)).toHaveLength(92)
  })
  it('2027-10-31 in Europe/London has 100 quarter-hour instants', () => {
    expect(startOptions('2027-10-31', LONDON, EARLY)).toHaveLength(100)
  })
  it('2026-11-05 in Asia/Jakarta has 96 quarter-hour instants', () => {
    const all = startOptions('2026-11-05', JAKARTA, EARLY)
    expect(all).toHaveLength(96)
    expect(all[0]).toBe('2026-11-04T17:00:00.000Z')
    expect(all.at(-1)).toBe('2026-11-05T16:45:00.000Z')
  })
  it('gives 59 starts from 09:15 for 2026-11-05 in Jakarta with now at 2026-11-05T02:00:00.000Z', () => {
    const s = startOptions('2026-11-05', JAKARTA, '2026-11-05T02:00:00.000Z')
    expect(s).toHaveLength(59)
    expect(s[0]).toBe('2026-11-05T02:15:00.000Z') // 09:15 in Jakarta: now itself (09:00) is not later than now
  })
  it('gives none for 2026-11-04 in Jakarta with now at 2026-11-05T02:00:00.000Z', () => {
    expect(startOptions('2026-11-04', JAKARTA, '2026-11-05T02:00:00.000Z')).toEqual([])
  })
})

describe('endOptions', () => {
  it('gives 32 ends from 09:00 on 2026-11-05 in Jakarta: 09:15 to 17:00, the 8-hour limit', () => {
    const e = endOptions('2026-11-05T02:00:00.000Z', '2026-11-05', JAKARTA)
    expect(e).toHaveLength(32)
    expect(e[0]).toBe('2026-11-05T02:15:00.000Z')
    expect(e.at(-1)).toBe('2026-11-05T10:00:00.000Z')
  })
  it('gives 8 ends from 22:00 on 2026-11-05 in Jakarta: 22:15 to the start of the next date', () => {
    const e = endOptions('2026-11-05T15:00:00.000Z', '2026-11-05', JAKARTA)
    expect(e).toHaveLength(8)
    expect(e[0]).toBe('2026-11-05T15:15:00.000Z')
    expect(e.at(-1)).toBe('2026-11-05T17:00:00.000Z')
  })
  it('gives 32 ends from 01:30 BST on 2027-10-31 in London: 8 hours of elapsed time across the change', () => {
    const e = endOptions('2027-10-31T00:30:00.000Z', '2027-10-31', LONDON)
    expect(e).toHaveLength(32)
    expect(e.slice(0, 2)).toEqual(['2027-10-31T00:45:00.000Z', '2027-10-31T01:00:00.000Z'])
    expect(e.at(-1)).toBe('2027-10-31T08:30:00.000Z')
  })
})
