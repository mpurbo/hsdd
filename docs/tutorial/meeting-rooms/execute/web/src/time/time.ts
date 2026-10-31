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

// The one wall-clock reader: a single formatToParts call per instant.
function wallClock(ms: number, zone: ZoneName): WallClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''
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
  return wallClock(Date.parse(now), zone).date
}
