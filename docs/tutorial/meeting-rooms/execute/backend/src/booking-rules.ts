// booking-api@v1's rules as pure functions: no I/O, no framework, no clock read
// (the time arrives as an argument) and no time zone, because the backend
// works in instants only (ADR-002 Decision 4).
import { BOOKING_ERRORS } from "./domain.ts";
import type { Booking, BookingErrorCode, NewBooking, Result, Room, StoredBooking } from "./domain.ts";
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

export type RoomWithBookings = Room & { bookings: Booking[] };

const roomIndex = (roomId: string): number => {
  const index = ROOMS.findIndex((room) => room.id === roomId);
  // The rules refuse an unknown room before any write (D3): reaching one here is a defect.
  if (index < 0) throw new Error(`no pre-loaded room has the id ${roomId}`);
  return index;
};

/** booking-api@v1's Booking: the room's name added, the instants as toISOString(), no account. */
export function toWireBooking(booking: StoredBooking): Booking {
  const { id, roomId, title, start, end } = booking;
  return { id, roomId, roomName: ROOMS[roomIndex(roomId)]!.name, title, start: start.toISOString(), end: end.toISOString() };
}

const byStart = (a: StoredBooking, b: StoredBooking): number => a.start.getTime() - b.start.getTime();

/** G13: every room in D3's order, each with its bookings earliest start first, [] for none. */
export function roomsView(bookings: readonly StoredBooking[]): { rooms: RoomWithBookings[] } {
  const sorted = bookings.toSorted(byStart);
  return {
    rooms: ROOMS.map((room) => ({ ...room, bookings: sorted.filter((b) => b.roomId === room.id).map(toWireBooking) })),
  };
}

/** G14: the caller's bookings by start, ties in D3's room order. */
export function myBookingsView(bookings: readonly StoredBooking[]): { bookings: Booking[] } {
  const ordered = bookings.toSorted((a, b) => byStart(a, b) || roomIndex(a.roomId) - roomIndex(b.roomId));
  return { bookings: ordered.map(toWireBooking) };
}

/** The schema's BookingId: a lower-case UUID. */
export function isBookingId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

export type CancelRequest = { id: string; accountId: string; now: Date; booking: StoredBooking | undefined };
export type CancelFailure = { code: "BOOKING_NOT_FOUND" | "BOOKING_NOT_YOURS" | "BOOKING_STARTED" };

/** DELETE /api/bookings/{id}, in booking-api@v1's order (G11, G12, G15). */
export function checkCancel(request: CancelRequest): Result<StoredBooking, CancelFailure> {
  const { id, accountId, now, booking } = request;
  if (!isBookingId(id) || booking === undefined) return fail("BOOKING_NOT_FOUND");
  if (booking.accountId !== accountId) return fail("BOOKING_NOT_YOURS");
  if (now.getTime() >= booking.start.getTime()) return fail("BOOKING_STARTED");
  return { ok: true, value: booking };
}

/** Every way a booking request can fail; a conflict alone names the other booking (G6). */
export type BookingFailure =
  | { code: Exclude<BookingErrorCode, "BOOKING_CONFLICT"> }
  | { code: "BOOKING_CONFLICT"; conflict: StoredBooking };

export type BookingErrorBody = { error: { code: BookingErrorCode; message: string; conflict?: Booking } };

/** booking-api@v1's Errors: one status and one message per code; error.conflict for BOOKING_CONFLICT only. */
export function errorResponse(failure: BookingFailure): { status: number; body: BookingErrorBody } {
  const { status, message } = BOOKING_ERRORS[failure.code];
  const error = { code: failure.code, message };
  return {
    status,
    body: { error: failure.code === "BOOKING_CONFLICT" ? { ...error, conflict: toWireBooking(failure.conflict) } : error },
  };
}
