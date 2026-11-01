// e2e/time.ts pinned to ADR-002's examples and to London's clock-change days.
// The run's ambient zone is Asia/Kolkata (playwright.config.ts), so a helper
// that read it would miss every exact instant below.
import { expect, test } from "./fixtures.ts";
import {
  JAKARTA, LONDON, bookingTimes, britishWinterDate, dayRange, formatDate, formatTime, homeLine, nextClockChangeDays, quarterHours, rangeLabel,
  timeIn, timeLabel, todayIn, wallTimeInstants, zoneName,
} from "./time.ts";

const HOUR = 60 * 60 * 1000;
const hours = (range: { start: string; end: string }) => (Date.parse(range.end) - Date.parse(range.start)) / HOUR;

test("time.ts: a date's range runs from its start to the next date's start, in the zone given", () => {
  expect(dayRange("2026-11-05", LONDON)).toEqual({ start: "2026-11-05T00:00:00.000Z", end: "2026-11-06T00:00:00.000Z" });
  expect(dayRange("2026-11-05", JAKARTA)).toEqual({ start: "2026-11-04T17:00:00.000Z", end: "2026-11-05T17:00:00.000Z" });
});

test("time.ts: London's March change day is 23 hours, with no 01:00 to 01:45", () => {
  expect(hours(dayRange("2027-03-28", LONDON))).toBe(23);
  const times = quarterHours("2027-03-28", LONDON).map((at) => timeIn(at, LONDON));
  expect(times).toHaveLength(92);
  for (const skipped of ["01:00", "01:15", "01:30", "01:45"]) expect(times).not.toContain(skipped);
  expect(wallTimeInstants("2027-03-28", "01:30", LONDON)).toEqual([]);
});

test("time.ts: London's October change day is 25 hours, with 01:00 to 01:45 first BST, then GMT", () => {
  expect(hours(dayRange("2027-10-31", LONDON))).toBe(25);
  const instants = quarterHours("2027-10-31", LONDON);
  expect(instants).toHaveLength(100);
  const repeated = instants.filter((at) => ["01:00", "01:15", "01:30", "01:45"].includes(timeIn(at, LONDON)));
  expect(repeated.map((at) => `${timeIn(at, LONDON)} ${zoneName(at, LONDON)}`)).toEqual([
    "01:00 BST", "01:15 BST", "01:30 BST", "01:45 BST",
    "01:00 GMT", "01:15 GMT", "01:30 GMT", "01:45 GMT",
  ]);
  expect(wallTimeInstants("2027-10-31", "01:30", LONDON)).toEqual(["2027-10-31T00:30:00.000Z", "2027-10-31T01:30:00.000Z"]);
});

test("time.ts: the next change days are strictly after today's date in London", () => {
  expect(nextClockChangeDays(Date.parse("2026-11-01T00:00:00.000Z"))).toEqual({ march: "2027-03-28", october: "2027-10-31" });
  expect(nextClockChangeDays(Date.parse("2027-03-28T12:00:00.000Z"))).toEqual({ march: "2028-03-26", october: "2027-10-31" });
});

test("time.ts: today's date depends on the zone, never on the ambient one", () => {
  const now = Date.parse("2026-11-04T17:00:00.000Z");
  expect(todayIn(JAKARTA, now)).toBe("2026-11-05");
  expect(todayIn(LONDON, now)).toBe("2026-11-04");
});

test("time.ts: a date in British winter time is wholly GMT and never a change day", () => {
  expect(britishWinterDate("2026-12-31")).toBe("2026-12-31");
  expect(britishWinterDate("2027-01-27")).toBe("2027-01-27");
  expect(britishWinterDate("2027-06-01")).toBe("2027-11-01");
  expect(britishWinterDate("2027-03-28")).toBe("2027-11-01");
});

test("time.ts: a wall time off the quarter hours is refused", () => {
  expect(() => wallTimeInstants("2026-11-05", "10:10", LONDON)).toThrow(RangeError);
});

// ADR-002 Decision 7: the strings every browser test expects.
const at = (date: string, time: string, zone: string) => wallTimeInstants(date, time, zone)[0];

test("time.ts: a time is 24-hour HH:mm in the zone given; a date is en-GB weekday, day and month", () => {
  expect(formatDate("2026-11-05")).toBe("Thu 5 Nov");
  expect(formatTime("2026-11-05T09:05:00.000Z", LONDON)).toBe("09:05");
  expect(formatTime("2026-11-05T13:00:00.000Z", JAKARTA)).toBe("20:00");
});

test("time.ts: a time off its line's date carries its own date", () => {
  const start = at("2026-11-05", "16:00", LONDON);
  const end = at("2026-11-05", "19:00", LONDON);
  expect(rangeLabel(start, end, JAKARTA, "2026-11-05")).toBe("23:00 to Fri 6 Nov 02:00");
});

test("time.ts: a time in an hour the clocks repeat carries the zone's short name", () => {
  expect(timeLabel("2027-10-31T00:30:00.000Z", LONDON, "2027-10-31")).toBe("01:30 BST");
  expect(timeLabel("2027-10-31T01:30:00.000Z", LONDON, "2027-10-31")).toBe("01:30 GMT");
  expect(rangeLabel("2027-10-31T00:30:00.000Z", "2027-10-31T01:30:00.000Z", LONDON, "2027-10-31")).toBe("01:30 BST to 01:30 GMT");
});

test("time.ts: a room in another zone adds its own times and office; one in the user's zone does not", () => {
  const merapi = { timeZone: JAKARTA, office: "Jakarta" };
  const thames = { timeZone: LONDON, office: "London" };
  expect(bookingTimes("2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z", LONDON, "2026-11-05", merapi))
    .toBe("02:00 to 03:00 (09:00 to 10:00 in Jakarta)");
  expect(bookingTimes("2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z", LONDON, "2026-11-05", thames)).toBe("02:00 to 03:00");
});

test("time.ts: Home's line is the start's date, two spaces, then the range in the user's zone", () => {
  const thames = [at("2026-11-05", "10:00", LONDON), at("2026-11-05", "11:00", LONDON)] as const;
  expect(homeLine(...thames, JAKARTA)).toBe("Thu 5 Nov  17:00 to 18:00");
  const merapi = [at("2026-11-05", "09:00", JAKARTA), at("2026-11-05", "10:00", JAKARTA)] as const;
  expect(homeLine(...merapi, LONDON)).toBe("Thu 5 Nov  02:00 to 03:00");
  const evening = [at("2026-11-05", "16:00", LONDON), at("2026-11-05", "19:00", LONDON)] as const;
  expect(homeLine(...evening, JAKARTA)).toBe("Thu 5 Nov  23:00 to Fri 6 Nov 02:00");
});
