// AC-4.4 on London's clock-change days: the next last Sunday of March (the
// clocks skip 01:00 to 02:00) and of October (01:00 to 02:00 is shown twice),
// both from `nextClockChangeDays()`, and Thames, the London room the Rooms
// screen shows in London's own zone.
//
// No other spec file meets these two days with Thames: rooms.spec.ts and
// home.spec.ts book only on British winter dates, and rooms.spec.ts keeps its
// one booking that spills into a next date (AC-4.2) on dates that are never a
// clock-change day; rig.spec.ts and success.spec.ts assert only their own
// rooms on these days. So Thames holds exactly the booking each test below makes on its day,
// and its lines can be compared exactly. Each day gets its own title.
//
// booking-api@v1 G10 refuses a start more than 365 days after the real clock.
// About six days a year (after late October) the farther day is out of reach:
// that test adds a "booking skipped" annotation and checks the day's Rooms
// lines only.
import { JAKARTA, LONDON, dayRange, homeLine, nextClockChangeDays, quarterHours, timeLabel, wallTimeInstants, type Instant, type IsoDate } from "./time.ts";
import { getRooms, tokenFor, type Booking } from "./api.ts";
import { expect, test } from "./fixtures.ts";
import { ROOMS, ZONES, bookThroughForm, expectedLines, openRooms, optionLabels, roomLines, showDate, type RoomId } from "./rooms.ts";
import type { Page } from "@playwright/test";

const DAYS = nextClockChangeDays();
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** booking-api@v1 G10: a start up to 365 days after `now` is accepted, the boundary included. */
function bookable(start: Instant, now: number): boolean {
  return Date.parse(start) <= now + 365 * 24 * 3600 * 1000;
}

/** The labels the form's `start` list shows for `date` in London. */
const startLabels = (date: IsoDate): string[] => quarterHours(date, LONDON).map((at) => timeLabel(at, LONDON, date));

/** Rooms on `date`, once its list has loaded (Thames shows its heading and a line). */
async function roomsOn(page: Page, who: "ayu" | "budi", date: IsoDate): Promise<void> {
  await openRooms(page, who);
  await showDate(page, date);
  await expect.poll(async () => (await roomLines(page, "thames")).length).toBeGreaterThan(0);
}

test("AC-4.4: the March day offers 92 starts and none from 01:00 to 01:45", async ({ page }) => {
  const { march } = DAYS;
  await roomsOn(page, "budi", march);
  await expect.poll(() => optionLabels(page, "start")).toEqual(startLabels(march));
  const labels = await optionLabels(page, "start");
  expect(labels).toHaveLength(92);
  expect(labels.filter((label) => label.startsWith("01:"))).toEqual([]);
});

test("AC-4.4: the October day offers 100 starts, 01:00 to 01:45 BST then GMT", async ({ page }) => {
  const { october } = DAYS;
  await roomsOn(page, "budi", october);
  await expect.poll(() => optionLabels(page, "start")).toEqual(startLabels(october));
  const labels = await optionLabels(page, "start");
  expect(labels).toHaveLength(100);
  const from = labels.indexOf("01:00 BST");
  expect(from).toBeGreaterThanOrEqual(0);
  expect(labels.slice(from, from + 8)).toEqual([
    "01:00 BST", "01:15 BST", "01:30 BST", "01:45 BST", "01:00 GMT", "01:15 GMT", "01:30 GMT", "01:45 GMT",
  ]);
});

test("bookable: true at exactly 365 days, false one millisecond after", () => {
  const now = Date.UTC(2026, 10, 1, 12, 0, 0);
  const limit = now + 365 * 24 * 3600 * 1000;
  expect(bookable(new Date(limit).toISOString(), now)).toBe(true);
  expect(bookable(new Date(limit + 1).toISOString(), now)).toBe(false);
});

type Day = {
  name: string;
  date: IsoDate;
  from: string; // the form's start label
  to: string; // the form's end label
  title: string;
  hours: number; // how long the stored booking lasts
  home: string; // Home's line when the year is 2027, as a pin
  ayu: string; // ayu's first Thames line before the title, as a pin
  room: string; // the room's own line, as a pin
};

const dayCases = (): Day[] => [
  {
    name: "budi books Thames across the skipped hour on the March day",
    date: DAYS.march, from: "00:30", to: "02:30", title: "Across the skipped hour", hours: 1,
    home: "Sun 28 Mar  00:30 to 02:30", ayu: "07:30 to 08:30", room: "(00:30 to 02:30 in London)",
  },
  {
    name: "budi books Thames from 01:30 BST to 01:30 GMT on the October day",
    date: DAYS.october, from: "01:30 BST", to: "01:30 GMT", title: "Across the repeated hour", hours: 1,
    home: "Sun 31 Oct  01:30 BST to 01:30 GMT", ayu: "07:30 to 08:30", room: "(01:30 BST to 01:30 GMT in London)",
  },
];

for (const day of dayCases()) {
  test(`AC-4.4: ${day.name}`, async ({ page, browser }, testInfo) => {
    const { date } = day;
    const [start] = wallTimeInstants(date, day.from.slice(0, 5), LONDON);
    if (!bookable(start, Date.now())) {
      testInfo.annotations.push({
        type: "booking skipped",
        description: `${date} starts more than 365 days after the real clock (booking-api@v1 G10)`,
      });
      await roomsOn(page, "budi", date);
      await expect.poll(() => optionLabels(page, "start")).toEqual(startLabels(date));
      await expect.poll(() => roomLines(page, "thames")).toEqual(["(no bookings)"]);
      const main = await page.getByRole("main").innerText();
      for (const room of Object.values(ROOMS)) expect(main).toContain(room.heading);
      return;
    }

    await roomsOn(page, "budi", date);
    await expect.poll(() => roomLines(page, "thames")).toEqual(["(no bookings)"]);
    await expect.poll(() => optionLabels(page, "start")).toEqual(startLabels(date));
    await bookThroughForm(page, { room: "Thames", start: day.from, end: day.to, title: day.title });
    await expect(page.getByText("Booked.", { exact: true })).toBeVisible();

    // The stored booking, through the service.
    const range = dayRange(date, LONDON);
    const rooms = await getRooms(await tokenFor("budi"), range.start, range.end);
    expect(rooms.status).toBe(200);
    const thames = (rooms.body as { rooms: Array<{ id: string; bookings: Booking[] }> }).rooms.find((r) => r.id === ("thames" satisfies RoomId))!;
    expect(thames.bookings).toHaveLength(1);
    const booking = thames.bookings[0];
    expect(booking.title).toBe(day.title);
    expect(Date.parse(booking.end) - Date.parse(booking.start)).toBe(day.hours * 3600 * 1000);

    // Budi's Rooms.
    const budi = expectedLines(booking, "thames", ZONES.budi, date);
    await expect.poll(() => roomLines(page, "thames")).toEqual(budi);
    expect(budi[0]).toBe(`${day.from} to ${day.to}  ${day.title}`);

    // Budi's Home.
    await page.getByRole("button", { name: "Home" }).click();
    const line = homeLine(booking.start, booking.end, LONDON);
    if (date.startsWith("2027-")) expect(line).toBe(day.home);
    await expect(page.locator("body")).toContainText(normalize(`${line} Thames · ${day.title}`), { useInnerText: true });

    // Ayu, in Jakarta, in a context of her own.
    const ayu = await (await browser.newContext()).newPage();
    try {
      await roomsOn(ayu, "ayu", date);
      const lines = expectedLines(booking, "thames", JAKARTA, date);
      await expect.poll(() => roomLines(ayu, "thames")).toEqual(lines);
      expect(lines[0]).toBe(`${day.ayu}  ${day.title}`);
      expect(lines[1]).toBe(day.room);
    } finally {
      await ayu.context().close();
    }
  });
}
