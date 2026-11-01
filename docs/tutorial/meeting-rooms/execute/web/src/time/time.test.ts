import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  asTimeZone,
  dayRange,
  endOptions,
  formatDate,
  formatRange,
  formatTime,
  sameZone,
  startOptions,
  todayIn,
} from './time'

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
  it('2011-12-30 in Pacific/Apia, a date the zone skipped, has 0 quarter-hour instants', () => {
    expect(startOptions('2011-12-30', 'Pacific/Apia', EARLY)).toEqual([])
  })
  it('gives none for 2026-11-04 in Jakarta with now at 2026-11-05T02:00:00.000Z', () => {
    expect(startOptions('2026-11-04', JAKARTA, '2026-11-05T02:00:00.000Z')).toEqual([])
  })
})

describe('a malformed date', () => {
  it.each(['', '2026-11-5', '2026-02-30'])('makes startOptions and endOptions throw RangeError for %j', (bad) => {
    expect(() => startOptions(bad, JAKARTA, EARLY)).toThrow(RangeError)
    expect(() => endOptions('2026-11-05T02:00:00.000Z', bad, JAKARTA)).toThrow(RangeError)
  })
})

describe('endOptions', () => {
  it('gives 0 ends from the start of the next date: 2026-11-06 00:00 in Jakarta on the line of 2026-11-05', () => {
    expect(endOptions('2026-11-05T17:00:00.000Z', '2026-11-05', JAKARTA)).toEqual([])
  })
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

describe('an unparsable instant', () => {
  it('makes startOptions throw RangeError for the now "not an instant"', () => {
    expect(() => startOptions('2026-11-05', JAKARTA, 'not an instant')).toThrow(RangeError)
  })
  it('makes endOptions throw RangeError for the start "not an instant"', () => {
    expect(() => endOptions('not an instant', '2026-11-05', JAKARTA)).toThrow(RangeError)
  })
  it('makes todayIn throw RangeError for the instant "not an instant"', () => {
    expect(() => todayIn('not an instant', JAKARTA)).toThrow(RangeError)
  })
})

describe('an instant not in toISOString form', () => {
  it.each(['2026-11-04T20:00', '2026-11-04', '2026-11-04T20:00:00Z', '2026', '2026-11-04T20:00:00.000+07:00'])(
    'makes todayIn, formatTime and formatRange throw RangeError for %j',
    (bad) => {
      expect(() => todayIn(bad, JAKARTA)).toThrow(RangeError)
      expect(() => formatTime(bad, JAKARTA, '2026-11-04')).toThrow(RangeError)
      expect(() => formatRange(bad, '2026-11-05T02:00:00.000Z', JAKARTA, '2026-11-04')).toThrow(RangeError)
    },
  )
})

const label = (zone: string, date: string) => (i: string) => formatTime(i, zone, date)

describe('formatDate', () => {
  it('writes 2026-11-05 as Thu 5 Nov', () => {
    expect(formatDate('2026-11-05')).toBe('Thu 5 Nov')
  })
  it('throws RangeError for a malformed date', () => {
    expect(() => formatDate('2026-02-30')).toThrow(RangeError)
  })
})

describe('formatTime', () => {
  it('writes HH:mm on a 24-hour clock', () => {
    expect(formatTime('2026-11-05T02:00:00.000Z', JAKARTA, '2026-11-05')).toBe('09:00')
  })
  it('2027-03-28 in Europe/London: 92 labels, none from 01:00 to 01:45', () => {
    const labels = startOptions('2027-03-28', LONDON, EARLY).map(label(LONDON, '2027-03-28'))
    expect(labels).toHaveLength(92)
    expect(labels.filter((l) => l.startsWith('01:'))).toEqual([])
  })
  it('2027-10-31 in Europe/London: 100 labels, the repeated hour marked BST then GMT', () => {
    const labels = startOptions('2027-10-31', LONDON, EARLY).map(label(LONDON, '2027-10-31'))
    expect(labels).toHaveLength(100)
    const at = labels.indexOf('00:45')
    expect(labels.slice(at, at + 10)).toEqual([
      '00:45', '01:00 BST', '01:15 BST', '01:30 BST', '01:45 BST',
      '01:00 GMT', '01:15 GMT', '01:30 GMT', '01:45 GMT', '02:00',
    ])
  })
  it('2026-11-05 in Asia/Jakarta: 96 labels, no short name', () => {
    const labels = startOptions('2026-11-05', JAKARTA, EARLY).map(label(JAKARTA, '2026-11-05'))
    expect(labels).toHaveLength(96)
    expect(labels.every((l) => /^\d\d:\d\d$/.test(l))).toBe(true)
  })
  it('puts the date first when the instant falls before the line date (Review Focus 2)', () => {
    expect(formatTime('2026-11-04T16:00:00.000Z', JAKARTA, '2026-11-05')).toBe('Wed 4 Nov 23:00')
  })
  it("2027-10-31 01:30 BST on 2027-10-30's line: date first, short name last (Review Focus 3)", () => {
    expect(formatTime('2027-10-31T00:30:00.000Z', LONDON, '2027-10-30')).toBe('Sun 31 Oct 01:30 BST')
  })
  it('2028-04-02 in Australia/Lord_Howe: the two 01:30 labels differ, GMT+11 then GMT+10:30 (Review Focus 5)', () => {
    expect(formatTime('2028-04-01T14:30:00.000Z', 'Australia/Lord_Howe', '2028-04-02')).toBe('01:30 GMT+11')
    expect(formatTime('2028-04-01T15:00:00.000Z', 'Australia/Lord_Howe', '2028-04-02')).toBe('01:30 GMT+10:30')
    expect(formatTime('2028-04-01T15:30:00.000Z', 'Australia/Lord_Howe', '2028-04-02')).toBe('02:00')
  })
  it('labels the ends from 09:00 and from 22:00 on 2026-11-05 in Jakarta', () => {
    const from9 = endOptions('2026-11-05T02:00:00.000Z', '2026-11-05', JAKARTA).map(label(JAKARTA, '2026-11-05'))
    expect([from9[0], from9.at(-1)]).toEqual(['09:15', '17:00'])
    const from22 = endOptions('2026-11-05T15:00:00.000Z', '2026-11-05', JAKARTA).map(label(JAKARTA, '2026-11-05'))
    expect([from22[0], from22.at(-1)]).toEqual(['22:15', 'Fri 6 Nov 00:00'])
  })
  it('2027-10-31 in London: 32 end labels from 01:30 BST, 01:45 BST, 01:00 GMT and on to 08:30', () => {
    const ends = endOptions('2027-10-31T00:30:00.000Z', '2027-10-31', LONDON).map(label(LONDON, '2027-10-31'))
    expect(ends).toHaveLength(32)
    expect(ends.slice(0, 2)).toEqual(['01:45 BST', '01:00 GMT'])
    expect(ends.at(-1)).toBe('08:30')
  })
})

describe('formatRange', () => {
  it('reads a London booking from 16:00 to 19:00 on 5 November as 23:00 to Fri 6 Nov 02:00 for Jakarta', () => {
    expect(formatRange('2026-11-05T16:00:00.000Z', '2026-11-05T19:00:00.000Z', JAKARTA, '2026-11-05')).toBe('23:00 to Fri 6 Nov 02:00')
  })
  it('reads 2027-10-31 in London: 00:00 to 01:30 BST', () => {
    expect(formatRange('2027-10-30T23:00:00.000Z', '2027-10-31T00:30:00.000Z', LONDON, '2027-10-31')).toBe('00:00 to 01:30 BST')
  })
  it('reads 2027-10-31 in London: 01:00 GMT to 01:30 GMT', () => {
    expect(formatRange('2027-10-31T01:00:00.000Z', '2027-10-31T01:30:00.000Z', LONDON, '2027-10-31')).toBe('01:00 GMT to 01:30 GMT')
  })
  it('reads 2027-10-31 in London: 23:30 to Mon 1 Nov 00:00', () => {
    expect(formatRange('2027-10-31T23:30:00.000Z', '2027-11-01T00:00:00.000Z', LONDON, '2027-10-31')).toBe('23:30 to Mon 1 Nov 00:00')
  })
})

const AMBIENT = ['Asia/Kolkata', 'Europe/London', 'Asia/Jakarta', 'UTC', 'America/St_Johns', 'Pacific/Kiritimati']

describe('any ambient zone (ADR-002 Consequences)', () => {
  const saved = process.env.TZ
  afterEach(() => {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  })
  it.each(AMBIENT)('gives the same answers under TZ=%s', (tz) => {
    process.env.TZ = tz
    // TZ took effect: both sides canonical (Node reports Asia/Calcutta for Asia/Kolkata)
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone,
    )
    expect(dayRange('2027-10-31', LONDON)).toEqual({ start: '2027-10-30T23:00:00.000Z', end: '2027-11-01T00:00:00.000Z' })
    expect(todayIn('2026-11-04T17:00:00.000Z', JAKARTA)).toBe('2026-11-05')
    expect(startOptions('2026-11-05', JAKARTA, '2026-11-05T02:00:00.000Z')).toHaveLength(59)
    expect(formatDate('2026-11-05')).toBe('Thu 5 Nov')
    expect(formatRange('2026-11-05T16:00:00.000Z', '2026-11-05T19:00:00.000Z', JAKARTA, '2026-11-05')).toBe('23:00 to Fri 6 Nov 02:00')
    expect(formatRange('2027-10-31T01:00:00.000Z', '2027-10-31T01:30:00.000Z', LONDON, '2027-10-31')).toBe('01:00 GMT to 01:30 GMT')
  })
})

describe('module boundary (D6, the phase Verification line)', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..') // web/src
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []
    })
  const isTest = (p: string) => /\.test\.tsx?$/.test(p) || relative(SRC, p).startsWith('test/')
  const source = files(SRC).filter((p) => !isTest(p))
  const inTime = (p: string) => relative(SRC, p).startsWith('time/')

  it('scans the files it is meant to cover', () => {
    expect(source.map((p) => relative(SRC, p))).toContain('time/time.ts')
  })
  const timeSource = source.filter(inTime)
  it('web/src/time/ imports nothing', () => {
    const importing = /^\s*import\b|^\s*export\b[^;\n]*\bfrom\b|\brequire\s*\(/m
    const offenders = timeSource.filter((p) => importing.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
  it("web/src/time/ names no zone outside its tests, except the one 'UTC' of formatDate (design note 4)", () => {
    const literals = timeSource.flatMap((p) =>
      [...readFileSync(p, 'utf8').matchAll(/(['"`])((?:(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]),
    )
    const accepted = literals.filter((l) => {
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: l })
        return true
      } catch {
        return false
      }
    })
    expect([...new Set(accepted)].filter((l) => l !== 'UTC')).toEqual([])
  })
  it('nowhere in web/src calls a local Date getter or setter, and nowhere outside web/src/time/ a toLocale method or Intl.DateTimeFormat', () => {
    const localDate = /\.(get|set)(FullYear|Year|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds|TimezoneOffset)\(/
    const locale = /\.toLocale\w*\(|Intl\.DateTimeFormat/
    const read = (p: string) => readFileSync(p, 'utf8')
    const offenders = source
      .filter((p) => localDate.test(read(p)) || (!inTime(p) && locale.test(read(p))))
      .map((p) => relative(SRC, p))
    expect(offenders).toEqual([])
  })
})
