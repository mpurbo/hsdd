// US-2, US-3 and US-6 on Home: the profile with its time zone, my bookings in
// the user's zone, Cancel, staying signed in, signing out, and a restart.
//
// Bookings a test needs are made through e2e/api.ts on dates of their own:
// London dates wholly in GMT (British winter time, never a clock-change day),
// the first at least 60 days after today in London, so none is one of the UTC
// days 39 to 47 that rig.spec.ts and success.spec.ts book. Computed once, at
// module load. Home lists every booking of the account that has not ended,
// including other files', so a test checks its own lines only.
//
// | Test                                   | Winter date | Room   | Account |
// |----------------------------------------|------------:|--------|---------|
// | AC-2.5: ayu's Thames booking           |           0 | Thames | ayu     |
// | AC-2.5: budi's Merapi booking          |           1 | Merapi | budi    |
// | AC-6.1: soonest first                  |        2, 3 | Kew    | both    |
// | AC-6.2: Cancel                         |           4 | Bromo  | both    |
//
// The AC-6.1 empty-state test cancels every booking budi holds, so no test may
// rely on a booking of budi's made outside its own body.
import { JAKARTA, LONDON, addDays, britishWinterDate, homeLine, todayIn, wallTimeInstants, type IsoDate } from "./time.ts";
import { PASSWORDS, deleteBooking, getMyBookings, postBooking, tokenFor, type Booking, type Username } from "./api.ts";
import { expect, profileFixture, signIn, signOut, test } from "./fixtures.ts";
import type { Locator, Page } from "@playwright/test";

const AYU = profileFixture("me-ayu");
const BUDI = profileFixture("me-budi");
/** The whole raw text, character for character: `exact: true` normalizes whitespace. */
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

const WINTER: IsoDate[] = [britishWinterDate(addDays(todayIn(LONDON), 60))];
while (WINTER.length < 6) WINTER.push(britishWinterDate(addDays(WINTER[WINTER.length - 1], 1)));
/** The n-th date of this file's own, each wholly in GMT. */
const winterDay = (n: number): IsoDate => WINTER[n];

/** Books `roomId` from `from` to `to`, wall times on `date` in `zone`, through booking-api@v1. */
async function book(who: Username, roomId: string, date: IsoDate, zone: string, from: string, to: string, title: string): Promise<Booking> {
  const [start] = wallTimeInstants(date, from, zone);
  const [end] = wallTimeInstants(date, to, zone);
  const reply = await postBooking(await tokenFor(who), { roomId, start, end, title });
  expect(reply.status, JSON.stringify(reply.body)).toBe(201);
  return reply.body as Booking;
}

/** Signs `who` in on the Login screen. */
async function home(page: Page, who: Username): Promise<void> {
  await page.goto("/");
  await signIn(page, who, PASSWORDS[who]);
}

/** Home shows `lines` in this order, each as text with whitespace normalized. */
async function expectLines(page: Page, ...lines: string[]): Promise<void> {
  await expect(page.locator("body")).toContainText(normalize(lines.join(" ")), { useInnerText: true });
}

/** The `Cancel` button of the booking whose Home line is `line`: inside the deepest element holding both. */
function cancelButton(page: Page, line: string): Locator {
  const cancel = page.getByRole("button", { name: "Cancel" });
  return page.locator("*").filter({ hasText: normalize(line) }).filter({ has: cancel }).last().getByRole("button", { name: "Cancel" });
}

test("AC-2.1: Home shows the signed-in user's details", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await expect(page.getByText("ayu@example.com")).toBeVisible();
  await expect(page.getByText("14 March 2024")).toBeVisible();
  await expect(page.getByText("ayu", { exact: true })).toBeVisible();
  await expect(page.getByText(exactly(AYU.phone!))).toBeVisible();
  await expect(page.getByText("Time zone", { exact: true })).toBeVisible();
  await expect(page.getByText(exactly(AYU.timeZone!))).toBeVisible();
});

test("AC-2.5: each account's Home shows its zone as its name, the whole text", async ({ page }) => {
  expect([AYU.timeZone, BUDI.timeZone]).toEqual(["Asia/Jakarta", "Europe/London"]);
  await home(page, "ayu");
  await expect(page.getByText(exactly(AYU.timeZone!))).toBeVisible();
  await signOut(page);
  await signIn(page, "budi", PASSWORDS.budi);
  await expect(page.getByText(exactly(BUDI.timeZone!))).toBeVisible();
});

// The browser runs in Asia/Kolkata (+05:30), so a time shown in the browser's
// zone misses these lines.
test("AC-2.5: ayu's Thames booking shows on her Home in Jakarta time", async ({ page }) => {
  const booking = await book("ayu", "thames", winterDay(0), LONDON, "10:00", "11:00", "Home zone ayu");
  const line = homeLine(booking.start, booking.end, JAKARTA);
  expect(line).toContain("17:00 to 18:00");
  await home(page, "ayu");
  await expectLines(page, line, "Thames · Home zone ayu");
});

test("AC-2.5: budi's Merapi booking shows on his Home in London time", async ({ page }) => {
  const booking = await book("budi", "merapi", winterDay(1), JAKARTA, "09:00", "10:00", "Home zone budi");
  const line = homeLine(booking.start, booking.end, LONDON);
  expect(line).toContain("02:00 to 03:00");
  await home(page, "budi");
  await expectLines(page, line, "Merapi · Home zone budi");
});

test("AC-2.4: Home shows each account's phone number exactly as stored", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByText(exactly(AYU.phone!))).toBeVisible();
  await signOut(page);
  await signIn(page, "budi", "harbor-17");
  await expect(page.getByText(exactly(BUDI.phone!))).toBeVisible();
});

test("Budi sees Budi's profile, not Ayu's", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "budi", "harbor-17");
  await expect(page.getByRole("heading", { name: "Hello, Budi Santoso" })).toBeVisible();
  await expect(page.getByText("9 January 2025")).toBeVisible();
  await expect(page.getByText(exactly(BUDI.phone!))).toBeVisible();
  await expect(page.getByText("ayu@example.com")).toHaveCount(0);
  await expect(page.getByText(AYU.phone!)).toHaveCount(0);
});

test("AC-2.2: reloading keeps the user signed in", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
});

test("AC-3.1: Sign out returns to Login, and a reload stays there", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await signOut(page);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("AC-2.3: a session the backend no longer knows returns to Login with the expiry message", async ({ page, backend }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  // ADR-001: a restart signs everyone out. profile-api@v2: every rejection
  // gives the same 401 body, so the now-unknown token answers like an expired one.
  await backend.restart();
  await page.reload();
  await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("AC-6.1: budi's bookings show soonest first, each with Cancel, and none of ayu's", async ({ page }) => {
  // Booked out of order: the last first.
  const third = await book("budi", "kew", winterDay(3), LONDON, "09:00", "10:00", "Order 3");
  const second = await book("budi", "kew", winterDay(2), LONDON, "14:00", "15:00", "Order 2");
  const first = await book("budi", "kew", winterDay(2), LONDON, "09:00", "10:00", "Order 1");
  await book("ayu", "kew", winterDay(3), LONDON, "11:00", "12:00", "Ayu not budi");
  const items = [first, second, third].map((b) => [homeLine(b.start, b.end, LONDON), `Kew · ${b.title}`] as const);
  await home(page, "budi");
  for (const item of items) await expectLines(page, ...item);
  const text = normalize(await page.locator("body").innerText());
  const positions = items.map((item) => text.indexOf(normalize(item.join(" "))));
  expect(positions[0], text).toBeLessThan(positions[1]);
  expect(positions[1], text).toBeLessThan(positions[2]);
  for (const [line] of items) await expect(cancelButton(page, line)).toHaveCount(1);
  expect(text).not.toContain("Ayu not budi");
});

test("AC-6.2: Cancel removes the booking's lines at once and frees its range", async ({ page }) => {
  const gone = await book("budi", "bromo", winterDay(4), LONDON, "09:00", "10:00", "Cancel me");
  const kept = await book("budi", "bromo", winterDay(4), LONDON, "11:00", "12:00", "Keep me");
  const goneLine = homeLine(gone.start, gone.end, LONDON);
  await home(page, "budi");
  await expectLines(page, goneLine, "Bromo · Cancel me");
  await cancelButton(page, goneLine).click();
  // No reload: the lines leave the page itself.
  await expect(page.locator("body")).not.toContainText(normalize(`${goneLine} Bromo · Cancel me`), { useInnerText: true });
  await expect(page.getByText("Bromo · Cancel me")).toHaveCount(0);
  await expectLines(page, homeLine(kept.start, kept.end, LONDON), "Bromo · Keep me");
  const ayu = await postBooking(await tokenFor("ayu"), { roomId: "bromo", start: gone.start, end: gone.end, title: "Ayu after cancel" });
  expect(ayu.status, JSON.stringify(ayu.body)).toBe(201); // booking-api@v1 G11
});

test("AC-6.1: with every booking of budi's cancelled, Home shows (no bookings) under My bookings", async ({ page }) => {
  const token = await tokenFor("budi");
  const mine = await getMyBookings(token);
  expect(mine.status).toBe(200);
  for (const booking of (mine.body as { bookings: Booking[] }).bookings) {
    expect(await deleteBooking(token, booking.id), `cancel ${JSON.stringify(booking)}`).toEqual({ status: 204, body: null });
  }
  await home(page, "budi");
  await expectLines(page, "My bookings", "(no bookings)");
});
