// The browser suite's own time model (ADR-002), for expected strings and for
// picking dates. Pure functions: every zone is an argument, every answer
// comes from Intl's time-zone data, and nothing reads the ambient zone or
// the web app's code. Calendar arithmetic (adding days, the last Sunday of a
// month) is on Date.UTC and getUTC*, which no zone touches.

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** An instant as `Date.prototype.toISOString()` writes it (booking-api@v1 Values). */
export type Instant = string;

export const LONDON = "Europe/London";
export const JAKARTA = "Asia/Jakarta";

const MINUTE = 60 * 1000;
const QUARTER = 15 * MINUTE;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ms = (at: Instant | number): number => (typeof at === "number" ? at : Date.parse(at));
const iso = (at: number): Instant => new Date(at).toISOString();

const wallFormats = new Map<string, Intl.DateTimeFormat>();
function wallParts(at: Instant | number, zone: string): Record<string, string> {
  let format = wallFormats.get(zone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    wallFormats.set(zone, format);
  }
  return Object.fromEntries(format.formatToParts(ms(at)).map((p) => [p.type, p.value]));
}

/** The date `at` falls on in `zone`. */
export function dateIn(at: Instant | number, zone: string): IsoDate {
  const p = wallParts(at, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The wall-clock time of `at` in `zone`, 24-hour `HH:mm`. */
export function timeIn(at: Instant | number, zone: string): string {
  const p = wallParts(at, zone);
  return `${p.hour}:${p.minute}`;
}

const nameFormats = new Map<string, Intl.DateTimeFormat>();
/** The zone's short name at `at`, as `en-GB` writes it (`GMT`, `BST`). */
export function zoneName(at: Instant | number, zone: string): string {
  let format = nameFormats.get(zone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "short" });
    nameFormats.set(zone, format);
  }
  return format.formatToParts(ms(at)).find((p) => p.type === "timeZoneName")!.value;
}

/** Today's date in `zone`. */
export function todayIn(zone: string, now: number = Date.now()): IsoDate {
  return dateIn(now, zone);
}

const utcMidnight = (date: IsoDate): number => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** The date `days` calendar days after `date` (negative goes back). */
export function addDays(date: IsoDate, days: number): IsoDate {
  return iso(utcMidnight(date) + days * DAY).slice(0, 10);
}

/**
 * The first instant whose date in `zone` is `date`. Every zone offset in the
 * time-zone data is a multiple of 15 minutes (ADR-002 Decision 6), so a date
 * starts on a quarter hour of UTC, within 15 hours of its UTC midnight.
 */
function startOf(date: IsoDate, zone: string): number {
  const from = utcMidnight(date) - 15 * HOUR;
  for (let at = from; at <= from + 30 * HOUR; at += QUARTER) {
    if (dateIn(at, zone) === date) return at;
  }
  throw new RangeError(`no instant falls on ${date} in ${zone}`);
}

/** From the start of `date` in `zone` up to the start of the next date; never taken as 24 hours. */
export function dayRange(date: IsoDate, zone: string): { start: Instant; end: Instant } {
  return { start: iso(startOf(date, zone)), end: iso(startOf(addDays(date, 1), zone)) };
}

/** Every quarter-hour instant of `date` in `zone`, in order: 92, 96 or 100 in London. */
export function quarterHours(date: IsoDate, zone: string): Instant[] {
  const start = startOf(date, zone);
  const end = startOf(addDays(date, 1), zone);
  const out: Instant[] = [];
  for (let at = start; at < end; at += QUARTER) out.push(iso(at));
  return out;
}

/**
 * The instants at which `zone`'s clocks read `time` on `date`: none in an hour
 * the clocks skip, two in an hour they repeat (earlier first), else one.
 * `time` is a quarter hour, `HH:mm`.
 */
export function wallTimeInstants(date: IsoDate, time: string, zone: string): Instant[] {
  if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(time)) throw new RangeError(`${time} is not a quarter hour HH:mm`);
  return quarterHours(date, zone).filter((at) => timeIn(at, zone) === time);
}

/** The last Sunday of `month` (1 to 12) in `year`. */
function lastSunday(year: number, month: number): IsoDate {
  const last = Date.UTC(year, month, 0); // day 0 of the next month
  return iso(last - new Date(last).getUTCDay() * DAY).slice(0, 10);
}

/** The next last Sunday of March and of October strictly after today's date in London (AC-4.4). */
export function nextClockChangeDays(now: number = Date.now()): { march: IsoDate; october: IsoDate } {
  const today = todayIn(LONDON, now);
  const year = Number(today.slice(0, 4));
  const next = (month: number): IsoDate => {
    const thisYear = lastSunday(year, month);
    return thisYear > today ? thisYear : lastSunday(year + 1, month);
  };
  return { march: next(3), october: next(10) };
}

/**
 * The first date on or after `from` that London spends wholly in GMT: 24
 * hours long and starting in `GMT`, so never a clock-change day. From any
 * date one comes within 218 days.
 */
export function britishWinterDate(from: IsoDate): IsoDate {
  for (let date = from, i = 0; i < 366; date = addDays(date, 1), i++) {
    const { start, end } = dayRange(date, LONDON);
    if (Date.parse(end) - Date.parse(start) === DAY && zoneName(start, LONDON) === "GMT") return date;
  }
  throw new RangeError(`no date wholly in GMT within a year of ${from}`);
}

// ADR-002 Decision 7: the strings the web app shows, as the tests expect them.

/** A time as 24-hour `HH:mm` in `zone`. */
export function formatTime(at: Instant, zone: string): string {
  return timeIn(at, zone);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** A date as `en-GB` writes weekday, day and month: `Thu 5 Nov`. */
export function formatDate(date: IsoDate): string {
  return dateFormat.format(utcMidnight(date));
}

/**
 * A time as shown on a line about `lineDate`: prefixed with its own date when
 * that differs in `zone`, followed by the zone's short name when the clocks
 * show its wall time twice on its date.
 */
export function timeLabel(at: Instant, zone: string, lineDate: IsoDate): string {
  const date = dateIn(at, zone);
  const time = timeIn(at, zone);
  const prefix = date === lineDate ? "" : `${formatDate(date)} `;
  const suffix = wallTimeInstants(date, time, zone).length === 2 ? ` ${zoneName(at, zone)}` : "";
  return `${prefix}${time}${suffix}`;
}

/** `{start} to {end}`, each as `timeLabel` writes it. */
export function rangeLabel(start: Instant, end: Instant, zone: string, lineDate: IsoDate): string {
  return `${timeLabel(start, zone, lineDate)} to ${timeLabel(end, zone, lineDate)}`;
}

/** A room's zone and its office's name, as booking-api@v1's rooms carry them. */
export type RoomZone = { timeZone: string; office: string };

/**
 * A booking's times on a line about `lineDate` in `userZone`; for a room whose
 * zone is not the user's (compared as names), followed by
 * `({start} to {end} in {office})` in the room's zone, against the same line date.
 */
export function bookingTimes(start: Instant, end: Instant, userZone: string, lineDate: IsoDate, room: RoomZone): string {
  const mine = rangeLabel(start, end, userZone, lineDate);
  return room.timeZone === userZone ? mine : `${mine} (${rangeLabel(start, end, room.timeZone, lineDate)} in ${room.office})`;
}

/** Home's line for a booking: `{date}  {start} to {end}`, the line's date being the start's in `zone`. */
export function homeLine(start: Instant, end: Instant, zone: string): string {
  const date = dateIn(start, zone);
  return `${formatDate(date)}  ${rangeLabel(start, end, zone, date)}`;
}
