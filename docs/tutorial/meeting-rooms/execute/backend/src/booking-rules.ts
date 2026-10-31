// booking-api@v1's rules as pure functions: no I/O, no framework, no clock read
// (the time arrives as an argument) and no time zone, because the backend
// works in instants only (ADR-002 Decision 4).
import type { NewBooking, Result } from "./domain.ts";
import { ROOMS } from "./rooms.ts";

/** G1: a string in exactly the form toISOString() writes, with a four-digit year. */
export function isInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

/** G2: an instant whose UTC minutes are 00, 15, 30 or 45, with zero seconds and milliseconds. */
export function isQuarterHourInstant(value: unknown): value is string {
  if (!isInstant(value)) return false;
  const date = new Date(value);
  return date.getUTCMinutes() % 15 === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

export type RoomsQuery = { from: Date; to: Date };

const fail = <C extends string>(code: C): { ok: false; error: { code: C } } => ({ ok: false, error: { code } });

/** GET /api/rooms: `from` and `to` each one instant, `from` before `to`, no cap on the range. */
export function checkRoomsQuery(query: unknown): Result<RoomsQuery, { code: "VALIDATION_FAILED" }> {
  if (typeof query !== "object" || query === null) return fail("VALIDATION_FAILED");
  const { from, to } = query as Record<string, unknown>;
  if (!isInstant(from) || !isInstant(to)) return fail("VALIDATION_FAILED");
  const range = { from: new Date(from), to: new Date(to) };
  return range.from.getTime() < range.to.getTime() ? { ok: true, value: range } : fail("VALIDATION_FAILED");
}

/** G9: the longest booking, 8 hours of elapsed time. */
export const MAX_BOOKING_MS = 8 * 60 * 60 * 1000;
/** G10: the latest start, 8,760 hours (365 days) after the clock, the boundary included. */
export const MAX_AHEAD_MS = 8760 * 60 * 60 * 1000;

export type NewBookingRequest = { contentType: string | undefined; body: unknown; accountId: string; now: Date };
export type NewBookingFailure = { code: "VALIDATION_FAILED" | "BOOKING_TOO_LONG" | "BOOKING_STARTED" | "BOOKING_TOO_FAR_AHEAD" };

/** The media type before any parameters, compared case-insensitively. */
const isJson = (contentType: string | undefined): boolean =>
  contentType !== undefined && contentType.split(";")[0]!.trim().toLowerCase() === "application/json";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * G8, D9: 1 to 80 code points, at least one not whitespace, none U+0000 and no
 * unpaired surrogate (in a `u` pattern a surrogate class matches only a lone one).
 */
const isTitle = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const length = [...value].length;
  return length >= 1 && length <= 80 && /\S/u.test(value) && !/[\u0000\uD800-\uDFFF]/u.test(value);
};

const isRoomId = (value: unknown): value is string => ROOMS.some((room) => room.id === value);

/**
 * POST /api/bookings: the request's shape (400), then the limits in booking-api@v1's
 * order (G15). The title is kept exactly as sent; other fields are ignored.
 */
export function checkNewBooking(request: NewBookingRequest): Result<NewBooking, NewBookingFailure> {
  const { contentType, body, accountId, now } = request;
  if (!isJson(contentType) || !isObject(body)) return fail("VALIDATION_FAILED");
  const { roomId, start, end, title } = body;
  if (!isRoomId(roomId) || !isQuarterHourInstant(start) || !isQuarterHourInstant(end) || !isTitle(title)) {
    return fail("VALIDATION_FAILED");
  }
  const booking = { roomId, accountId, title, start: new Date(start), end: new Date(end) };
  const [startMs, endMs, nowMs] = [booking.start.getTime(), booking.end.getTime(), now.getTime()];
  if (endMs <= startMs) return fail("VALIDATION_FAILED");
  if (endMs - startMs > MAX_BOOKING_MS) return fail("BOOKING_TOO_LONG");
  if (nowMs >= startMs) return fail("BOOKING_STARTED");
  if (startMs - nowMs > MAX_AHEAD_MS) return fail("BOOKING_TOO_FAR_AHEAD");
  return { ok: true, value: booking };
}
