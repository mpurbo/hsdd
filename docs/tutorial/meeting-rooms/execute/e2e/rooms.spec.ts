// US-4 and US-5 on Rooms: the rooms in order, the default date, the bookings
// of a date in the user's zone, and the booking form.
//
// Bookings a test needs beforehand go through e2e/api.ts on dates of their
// own: London dates wholly in GMT (never a clock-change day). home.spec.ts
// owns britishWinterDays(addDays(todayIn(LONDON), 60), 6); this file
// recomputes those six with the same expression and continues from the day
// after the last: britishWinterDays(addDays(HOME_DATES[5], 1), 8). Every
// booking made here lies between 00:00 and 17:00 London time on its date, so
// ayu's Jakarta view of a date (from 17:00 UTC the day before) holds only that
// date's bookings; the one exception, AC-4.2's 16:00 to 19:00 London booking,
// owns the next date too (DATES[1] is never used). Rooms shows every user's
// bookings, so a test reads exact lines only on dates and rooms it owns.
//
// | Test                      | Date index | Rooms         | Accounts |
// |---------------------------|-----------:|---------------|----------|
// | AC-4.1: order and default |       none | all           | both     |
// | AC-4.2: a date's bookings |          0 | Merapi to Kew | ayu      |
import { LONDON, addDays, britishWinterDays, formatDate, todayIn, type IsoDate } from "./time.ts";
import { expect, test } from "./fixtures.ts";
import { ROOMS, ZONES, bookViaApi, expectedLines, openRooms, roomLines, showDate, type RoomId } from "./rooms.ts";

const HOME_DATES: IsoDate[] = britishWinterDays(addDays(todayIn(LONDON), 60), 6);
const DATES: IsoDate[] = britishWinterDays(addDays(HOME_DATES[5], 1), 8);

const ORDER: RoomId[] = ["merapi", "bromo", "thames", "kew"];
const DAY = 24 * 60 * 60 * 1000;

/** The latest instant not after `now` whose UTC time of day is `hours:minutes`. */
function latestPast(hours: number, minutes: number, now: number = Date.now()): number {
  const today = new Date(now);
  const at = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours, minutes);
  return at <= now ? at : at - DAY;
}

// The default date depends only on the browser's clock and the user's zone
// (ADR-002 Decision 5), so the browser's clock is held at an instant where the
// user's date differs from the browser zone's (Asia/Kolkata).
const CLOCKS = [
  { who: "ayu", at: latestPast(17, 45), greeting: "Hello, Ayu Lestari" },
  { who: "budi", at: latestPast(20, 0), greeting: "Hello, Budi Santoso" },
] as const;

for (const { who, at, greeting } of CLOCKS) {
  test(`AC-4.1: Rooms lists the four rooms in order, opens on today in ${who}'s zone, and Home returns`, async ({ page }) => {
    const today = todayIn(ZONES[who], at);
    expect(today).not.toBe(todayIn("Asia/Kolkata", at));
    await page.clock.setFixedTime(at);
    await openRooms(page, who);
    await expect(page.getByLabel("Rooms on")).toHaveValue(today);
    await expect
      .poll(async () => {
        const text = await page.getByRole("main").innerText();
        return ORDER.map((room) => ({ room, index: text.indexOf(ROOMS[room].heading) }))
          .filter(({ index }) => index >= 0)
          .sort((a, b) => a.index - b.index)
          .map(({ room }) => room);
      })
      .toEqual(ORDER);
    await page.getByRole("button", { name: "Home" }).click();
    await expect(page.getByRole("heading", { name: greeting })).toBeVisible();
  });
}

test("AC-4.2: a date in ayu's zone shows each room's overlapping bookings, earliest first, and (no bookings)", async ({ page }) => {
  const zone = ZONES.ayu;
  const date = DATES[0];
  const next = addDays(date, 1);
  // Kew out of order: 08:00 first.
  const later = await bookViaApi("ayu", "kew", date, LONDON, "08:00", "09:00", "Kew later");
  const earlier = await bookViaApi("ayu", "kew", date, LONDON, "03:00", "04:00", "Kew earlier");
  const thames = await bookViaApi("ayu", "thames", date, LONDON, "16:00", "19:00", "Thames late");

  await openRooms(page, "ayu");
  await showDate(page, date);
  await expect.poll(() => roomLines(page, "merapi")).toEqual(["(no bookings)"]);
  await expect.poll(() => roomLines(page, "bromo")).toEqual(["(no bookings)"]);
  await expect.poll(() => roomLines(page, "kew")).toEqual([
    ...expectedLines(earlier, "kew", zone, date),
    ...expectedLines(later, "kew", zone, date),
  ]);
  await expect.poll(() => roomLines(page, "thames")).toEqual(expectedLines(thames, "thames", zone, date));
  // Pin: 16:00 to 19:00 in London is 23:00 to 02:00 the next day in Jakarta.
  expect((await roomLines(page, "thames"))[0]).toContain(`23:00 to ${formatDate(next)} 02:00`);

  await showDate(page, next);
  const onNext = expectedLines(thames, "thames", zone, next);
  await expect.poll(async () => (await roomLines(page, "thames")).join("\n")).toContain(onNext.join("\n"));
  expect((await roomLines(page, "thames"))[0]).toMatch(new RegExp(`^${formatDate(date)} 23:00 to 02:00`));
});
