// Time module rules: the zone is always an argument, never the ambient one.
// Wall-clock fields come from Intl only, never from Date's local getters.
// The module has no import; its types are its own.

export type IsoDate = string // 'YYYY-MM-DD', a calendar date with no zone
export type Instant = string // Date.prototype.toISOString() form, '2026-11-05T02:00:00.000Z'
export type ZoneName = string // a name Intl.DateTimeFormat accepts as timeZone
export type DayRange = { readonly start: Instant; readonly end: Instant }

type WallClock = {
  readonly date: IsoDate
  readonly time: string // 'HH:mm'
  readonly offsetMs: number // wall time as if UTC, minus the instant (truncated to the second)
}

function fail(type: string): never {
  throw new RangeError(`Intl gave no ${type} part`)
}

// Design note 5: the one place an Instant is parsed; NaN never travels on.
// Only the toISOString form is accepted (ADR-002 Decision 1): anything else, such as a
// date-time without Z, would be read in the ambient zone.
function parseInstant(instant: Instant): number {
  const ms = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(instant) ? Date.parse(instant) : Number.NaN
  if (Number.isNaN(ms) || new Date(ms).toISOString() !== instant) {
    throw new RangeError(`Not an instant: ${JSON.stringify(instant)}`)
  }
  return ms
}

// Memoization keyed by zone: observably pure, bounded by the zones in use, and independent of
// TZ because every formatter has an explicit timeZone.
const wallClockFormats = new Map<ZoneName, Intl.DateTimeFormat>()
function wallClockFormat(zone: ZoneName): Intl.DateTimeFormat {
  const cached = wallClockFormats.get(zone)
  if (cached !== undefined) return cached
  const made = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  wallClockFormats.set(zone, made)
  return made
}

// The one wall-clock reader: a single formatToParts call per instant.
function wallClock(ms: number, zone: ZoneName): WallClock {
  const parts = wallClockFormat(zone).formatToParts(new Date(ms))
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? fail(type)
  const year = field('year').padStart(4, '0')
  const [month, day, hour, minute] = [
    field('month'),
    field('day'),
    field('hour'),
    field('minute'),
  ]
  const wallAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(field('second')),
  )
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    offsetMs: wallAsUtc - Math.floor(ms / 1000) * 1000,
  }
}

export function asTimeZone(name: string): ZoneName | undefined {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: name })
    return name
  } catch (e) {
    if (e instanceof RangeError) return undefined
    throw e
  }
}

export function sameZone(a: ZoneName, b: ZoneName): boolean {
  return a === b
}

export function todayIn(now: Instant, zone: ZoneName): IsoDate {
  return wallClock(parseInstant(now), zone).date
}

const QUARTER_MS = 15 * 60_000
const HOUR_MS = 60 * 60_000
const MAX_BOOKING_MS = 8 * HOUR_MS

// Design note 5: one validator for every function that takes an IsoDate.
// Returns the date's UTC midnight in ms; throws RangeError unless it is a real YYYY-MM-DD.
function dateToUtcMs(date: IsoDate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (m === null) throw new RangeError(`Not a YYYY-MM-DD date: ${JSON.stringify(date)}`)
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Not a real calendar date: ${date}`)
  }
  return ms
}

// Calendar arithmetic, never 24 hours of instants.
function nextDate(date: IsoDate): IsoDate {
  const d = new Date(dateToUtcMs(date))
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
    .toISOString()
    .slice(0, 10)
}

// First quarter-hour instant whose wall date is >= date (design note 2), as ms.
function startOf(date: IsoDate, zone: ZoneName): number {
  const midnight = dateToUtcMs(date)
  const from = midnight - 15 * HOUR_MS
  const to = midnight + 15 * HOUR_MS
  for (let ms = from; ms <= to; ms += QUARTER_MS) {
    if (wallClock(ms, zone).date >= date) return ms
  }
  throw new RangeError(`No start found for ${date}`)
}

export function dayRange(date: IsoDate, zone: ZoneName): DayRange {
  return {
    start: new Date(startOf(date, zone)).toISOString(),
    end: new Date(startOf(nextDate(date), zone)).toISOString(),
  }
}

export function startOptions(date: IsoDate, zone: ZoneName, now: Instant): readonly Instant[] {
  const start = startOf(date, zone)
  const end = startOf(nextDate(date), zone)
  const nowMs = parseInstant(now)
  const out: Instant[] = []
  for (let ms = start; ms < end; ms += QUARTER_MS) {
    if (ms > nowMs) out.push(new Date(ms).toISOString())
  }
  return out
}

export function endOptions(start: Instant, date: IsoDate, zone: ZoneName): readonly Instant[] {
  const startMs = parseInstant(start)
  const limit = Math.min(startMs + MAX_BOOKING_MS, startOf(nextDate(date), zone))
  const out: Instant[] = []
  for (let ms = startMs + QUARTER_MS; ms <= limit; ms += QUARTER_MS) {
    out.push(new Date(ms).toISOString())
  }
  return out
}

// Design note 4: a calendar date has no zone, and UTC midnight formatted in UTC is the identity mapping.
export function formatDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(dateToUtcMs(date)))
    .replace(',', '')
}

function shortZoneName(ms: number, zone: ZoneName): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' }).formatToParts(
    new Date(ms),
  )
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? fail('timeZoneName')
}

// Design note 3: repeated when another instant shows the same wall date and time. The only
// candidates are the shifts between this instant's offset and the zone's offsets a day either side.
function isRepeated(ms: number, zone: ZoneName): boolean {
  const here = wallClock(ms, zone)
  const dayMs = 24 * HOUR_MS
  const others = [ms - dayMs, ms + dayMs]
    .map((t) => wallClock(t, zone).offsetMs)
    .filter((o) => o !== here.offsetMs)
  return others.some((o) => {
    const there = wallClock(ms + here.offsetMs - o, zone)
    return there.date === here.date && there.time === here.time
  })
}

export function formatTime(instant: Instant, zone: ZoneName, lineDate: IsoDate): string {
  const ms = parseInstant(instant)
  const wall = wallClock(ms, zone)
  const prefix = wall.date === lineDate ? '' : `${formatDate(wall.date)} `
  const suffix = isRepeated(ms, zone) ? ` ${shortZoneName(ms, zone)}` : ''
  return `${prefix}${wall.time}${suffix}`
}

export function formatRange(start: Instant, end: Instant, zone: ZoneName, lineDate: IsoDate): string {
  return `${formatTime(start, zone, lineDate)} to ${formatTime(end, zone, lineDate)}`
}
