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
import { JAKARTA, LONDON, addDays, britishWinterDate, homeLine, todayIn, wallTimeInstants, type IsoDate } from "./time.ts";
import { PASSWORDS, postBooking, tokenFor, type Booking, type Username } from "./api.ts";
import { expect, profileFixture, signIn, signOut, test } from "./fixtures.ts";
import type { Page } from "@playwright/test";

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
