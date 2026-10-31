// The rig's own properties: the run's time zone, the database of its own,
// the service's start and stop, and the helpers in e2e/api.ts.
import { expect, test } from "./fixtures.ts";
import { currentQuarterHour, deleteBooking, getMyBookings, getRooms, instant, login, postBooking, tokenFor, utcDay, type Booking } from "./api.ts";

// ICU reports a link's canonical name (Asia/Kolkata is Asia/Calcutta on some
// builds), so the expected name comes from the same runtime's Intl, not a literal.
const KOLKATA = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata" }).resolvedOptions().timeZone;

test("the run is in Asia/Kolkata: the worker and the browser", async ({ page }) => {
  expect(process.env.TZ).toBe("Asia/Kolkata");
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(KOLKATA);
  expect(new Date("2026-11-05T00:00:00.000Z").getHours()).toBe(5); // +05:30
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(KOLKATA);
});

test("api.ts: instants are toISOString() strings on quarter hours of UTC", () => {
  const now = Date.parse("2026-11-01T10:07:59.999Z");
  expect(utcDay(0, now)).toBe(Date.parse("2026-11-01T00:00:00.000Z"));
  expect(instant(utcDay(4, now), 2)).toBe("2026-11-05T02:00:00.000Z");
  expect(instant(utcDay(4, now), 23, 45)).toBe("2026-11-05T23:45:00.000Z");
  expect(() => instant(utcDay(4, now), 2, 10)).toThrow(RangeError);
  expect(currentQuarterHour(now)).toBe("2026-11-01T10:00:00.000Z");
});

test("api.ts: sign in, book, list, cancel against the service", async () => {
  expect((await login("ayu", "wrong")).status).toBe(401);
  const ayu = await tokenFor("ayu");
  const day = utcDay(40);
  const request = { roomId: "kew", start: instant(day, 3), end: instant(day, 4), title: "Rig round trip" };
  const booked = await postBooking(ayu, request);
  expect(booked.status).toBe(201);
  const booking = booked.body as Booking;
  expect(booking).toMatchObject({ ...request, roomName: "Kew" });
  const rooms = await getRooms(ayu, instant(day, 0), instant(utcDay(41), 0));
  expect(rooms.status).toBe(200);
  expect((rooms.body as { rooms: Array<{ id: string; bookings: Booking[] }> }).rooms.map((r) => [r.id, r.bookings]))
    .toEqual([["merapi", []], ["bromo", []], ["thames", []], ["kew", [booking]]]);
  expect(((await getMyBookings(ayu)).body as { bookings: Booking[] }).bookings).toContainEqual(booking);
  expect(await deleteBooking(ayu, booking.id)).toEqual({ status: 204, body: null });
  expect(((await getMyBookings(ayu)).body as { bookings: Booking[] }).bookings).not.toContainEqual(booking);
});
