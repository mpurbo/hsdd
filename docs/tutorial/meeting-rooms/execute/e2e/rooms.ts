// The Rooms screen as the browser suite reaches it: through Home's `Book a
// room`, read and driven by the words PRD v2 Screens shows. Shared by
// rooms.spec.ts and clock-change.spec.ts (a spec file cannot import another).
import type { Page } from "@playwright/test";
import { JAKARTA, LONDON, addDays, quarterHours, rangeLabel, timeLabel, wallTimeInstants, type Instant, type IsoDate } from "./time.ts";
import { PASSWORDS, postBooking, tokenFor, type Booking, type Username } from "./api.ts";
import { expect, signIn } from "./fixtures.ts";

export type RoomId = "merapi" | "bromo" | "thames" | "kew";

/** PRD v2 Rooms: each room's name, office, zone and the heading line Rooms shows. */
export const ROOMS: Readonly<Record<RoomId, { name: string; office: string; timeZone: string; heading: string }>> = {
  merapi: { name: "Merapi", office: "Jakarta", timeZone: JAKARTA, heading: "Merapi · Jakarta · 8 seats" },
  bromo: { name: "Bromo", office: "Jakarta", timeZone: JAKARTA, heading: "Bromo · Jakarta · 4 seats" },
  thames: { name: "Thames", office: "London", timeZone: LONDON, heading: "Thames · London · 10 seats" },
  kew: { name: "Kew", office: "London", timeZone: LONDON, heading: "Kew · London · 4 seats" },
};

/** Each account's profile zone (profile-api@v2 G4). */
export const ZONES: Readonly<Record<Username, string>> = { ayu: JAKARTA, budi: LONDON };

const dateInput = (page: Page) => page.getByLabel("Rooms on");

/** Signs `who` in, opens Rooms from Home and waits for the `Rooms on` date input. */
export async function openRooms(page: Page, who: Username): Promise<void> {
  await page.goto("/");
  await signIn(page, who, PASSWORDS[who]);
  await page.getByRole("button", { name: "Book a room" }).click();
  await expect(dateInput(page)).toBeVisible();
}

/** Fills the `Rooms on` input with `date`; the list reloads asynchronously, so read it in a retrying assertion. */
export async function showDate(page: Page, date: IsoDate): Promise<void> {
  await dateInput(page).fill(date);
}

/**
 * The non-blank lines under `room`'s heading in `main`, up to the next room
 * heading or `Book:`, each with its own spacing; `["(no bookings)"]` for an empty room.
 */
export async function roomLines(page: Page, room: RoomId): Promise<string[]> {
  const lines = (await page.getByRole("main").innerText()).split("\n").filter((line) => line.trim() !== "");
  const headings = new Set(Object.values(ROOMS).map((r) => r.heading));
  const from = lines.findIndex((line) => line.trim() === ROOMS[room].heading);
  if (from < 0) return [];
  const rest = lines.slice(from + 1);
  const stop = rest.findIndex((line) => headings.has(line.trim()) || line.trim().startsWith("Book:"));
  return stop < 0 ? rest : rest.slice(0, stop);
}

/** The lines Rooms shows for a booking on a line about `lineDate`: its times in the user's zone and title, then the room's own times when its zone differs. */
export function expectedLines(
  booking: Pick<Booking, "start" | "end" | "title">,
  room: RoomId,
  userZone: string,
  lineDate: IsoDate,
): string[] {
  const { start, end, title } = booking;
  const { timeZone, office } = ROOMS[room];
  const mine = `${rangeLabel(start, end, userZone, lineDate)}  ${title}`;
  return timeZone === userZone ? [mine] : [mine, `(${rangeLabel(start, end, timeZone, lineDate)} in ${office})`];
}

/** Books `room` from `from` to `to`, wall times on `date` in `zone` (first instant of each), through booking-api@v1. */
export async function bookViaApi(
  who: Username, room: RoomId, date: IsoDate, zone: string, from: string, to: string, title: string,
): Promise<Booking> {
  const [start] = wallTimeInstants(date, from, zone);
  const [end] = wallTimeInstants(date, to, zone);
  const reply = await postBooking(await tokenFor(who), { roomId: room, start, end, title });
  expect(reply.status, JSON.stringify(reply.body)).toBe(201);
  return reply.body as Booking;
}

/** The visible labels of the `start` or `end` combobox's options, in order. */
export async function optionLabels(page: Page, name: "start" | "end"): Promise<string[]> {
  const options = await page.getByRole("combobox", { name, exact: true }).locator("option").evaluateAll(
    (nodes) => nodes.map((node) => node.textContent ?? ""),
  );
  return options.map((label) => label.trim());
}

/** Selects `room`, `start` and `end` by label and fills `title`, without pressing `Book`. */
export async function fillBookingForm(
  page: Page, choice: { room: string; start: string; end: string; title: string },
): Promise<void> {
  await page.getByRole("combobox", { name: "room", exact: true }).selectOption({ label: choice.room });
  await page.getByRole("combobox", { name: "start", exact: true }).selectOption({ label: choice.start });
  await page.getByRole("combobox", { name: "end", exact: true }).selectOption({ label: choice.end });
  await page.getByRole("textbox", { name: "title" }).fill(choice.title);
}

/** Fills the form (see `fillBookingForm`) and presses `Book`. */
export async function bookThroughForm(
  page: Page, choice: { room: string; start: string; end: string; title: string },
): Promise<void> {
  await fillBookingForm(page, choice);
  await page.getByRole("button", { name: "Book" }).click();
}

/** The message Rooms shows when `room` is already booked over `other`: its times in `userZone`, against the line date `lineDate`. */
export function overlapMessage(room: RoomId, other: Pick<Booking, "start" | "end">, userZone: string, lineDate: IsoDate): string {
  return `${ROOMS[room].name} is already booked from ${rangeLabel(other.start, other.end, userZone, lineDate)}.`;
}

/** Each quarter hour of `date` and of the next date in `zone`, keyed by the label the form shows (`timeLabel` against `date`). */
export function labelInstants(date: IsoDate, zone: string): Map<string, Instant> {
  return new Map(
    [...quarterHours(date, zone), ...quarterHours(addDays(date, 1), zone)].map((at) => [timeLabel(at, zone, date), at]),
  );
}
