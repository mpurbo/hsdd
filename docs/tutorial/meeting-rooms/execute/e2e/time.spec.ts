// e2e/time.ts pinned to ADR-002's examples and to London's clock-change days.
// The run's ambient zone is Asia/Kolkata (playwright.config.ts), so a helper
// that read it would miss every exact instant below.
import { expect, test } from "./fixtures.ts";
import { JAKARTA, LONDON, britishWinterDate, dayRange, nextClockChangeDays, quarterHours, timeIn, todayIn, wallTimeInstants, zoneName } from "./time.ts";

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
