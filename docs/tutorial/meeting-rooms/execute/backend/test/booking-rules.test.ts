import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkCancel,
  checkNewBooking,
  checkRoomsQuery,
  errorResponse,
  isBookingId,
  isInstant,
  isQuarterHourInstant,
  myBookingsView,
  roomsView,
  toWireBooking,
} from "../src/booking-rules.ts";
import type { StoredBooking } from "../src/domain.ts";

const refused = { ok: false, error: { code: "VALIDATION_FAILED" } };

describe("the rules module is pure (ADR-002 Decision 4)", () => {
  const source = readFileSync(new URL("../src/booking-rules.ts", import.meta.url), "utf8");

  it("imports only the domain types and the rooms", () => {
    const specifiers = [...source.matchAll(/\b(?:from|import)\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers.filter((s) => s !== "./domain.ts" && s !== "./rooms.ts")).toStrictEqual([]);
    expect(source).not.toMatch(/\bimport\(|\brequire\(/);
  });

  it("reads no clock and names no time zone", () => {
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)/);
    expect(source).not.toMatch(/\bIntl\b|toLocale|getTimezoneOffset|\.get(?:Hours|Minutes|Seconds|Milliseconds|Date|Day|Month|FullYear)\(/);
    expect(source).not.toMatch(/["'](?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc)\/|["'](?:UTC|GMT)["']/);
  });
});

describe("instants (G1, G2)", () => {
  it("G1: an instant is exactly the toISOString() form", () => {
    expect(isInstant("2026-11-05T02:00:00.000Z")).toBe(true);
    expect(isInstant("0000-01-01T00:00:00.000Z")).toBe(true);
    for (const s of ["2026-11-05T02:00:00Z", "2026-11-05T09:00:00.000+07:00", "2026-02-30T00:00:00.000Z", "2026-11-05", "", "soon"]) {
      expect(isInstant(s), s).toBe(false);
    }
  });

  it("G1: a year that is not four digits is refused, though toISOString() writes it", () => {
    expect(new Date("+010000-01-01T00:00:00.000Z").toISOString()).toBe("+010000-01-01T00:00:00.000Z");
    expect(isInstant("+010000-01-01T00:00:00.000Z")).toBe(false);
    expect(isInstant("-000001-01-01T00:00:00.000Z")).toBe(false);
  });

  it("G1: only a string is an instant", () => {
    for (const v of [Date.parse("2026-11-05T02:00:00.000Z"), null, undefined, new Date("2026-11-05T02:00:00.000Z"), ["2026-11-05T02:00:00.000Z"]]) {
      expect(isInstant(v)).toBe(false);
    }
  });

  it("G2: a quarter-hour instant has UTC minutes 00, 15, 30 or 45 and zero seconds and milliseconds", () => {
    for (const m of ["00", "15", "30", "45"]) expect(isQuarterHourInstant(`2026-11-05T02:${m}:00.000Z`)).toBe(true);
    for (const s of ["2026-11-05T02:10:00.000Z", "2026-11-05T02:15:01.000Z", "2026-11-05T02:15:00.001Z", "2026-11-05T02:15:00Z"]) {
      expect(isQuarterHourInstant(s), s).toBe(false);
    }
  });
});

describe("GET /api/rooms query (G1)", () => {
  const from = "2026-11-05T00:00:00.000Z";
  const to = "2026-11-06T00:00:00.000Z";

  it("G1: from and to are instants, from before to", () => {
    expect(checkRoomsQuery({ from, to })).toStrictEqual({ ok: true, value: { from: new Date(from), to: new Date(to) } });
  });

  it("G1: from not before to is refused", () => {
    expect(checkRoomsQuery({ from, to: from })).toStrictEqual(refused);
    expect(checkRoomsQuery({ from: to, to: from })).toStrictEqual(refused);
  });

  it("G1: a missing, repeated, empty or non-instant parameter is refused", () => {
    const bad: unknown[] = [{}, { from }, { to }, { from: [from, from], to }, { from, to: [to] }, { from: "2026-11-05T00:00:00Z", to }, { from: "", to }, null, undefined, "from=x"];
    for (const q of bad) expect(checkRoomsQuery(q), JSON.stringify(q)).toStrictEqual(refused);
  });

  it("no cap on the range, and other parameters are ignored", () => {
    expect(checkRoomsQuery({ from: "0000-01-01T00:00:00.000Z", to: "9999-12-31T23:59:59.999Z", page: "2" }).ok).toBe(true);
  });
});

const NOW = new Date("2026-11-04T12:00:00.000Z");
const valid = { roomId: "merapi", start: "2026-11-05T02:00:00.000Z", end: "2026-11-05T03:00:00.000Z", title: "Sprint planning" };
const book = (body: unknown, contentType: string | undefined = "application/json", now = NOW) =>
  checkNewBooking({ contentType, body, accountId: "u_001", now });

describe("POST /api/bookings request (G2, G8)", () => {
  it("a valid body gives the new booking, owned by the caller", () => {
    expect(book(valid)).toStrictEqual({
      ok: true,
      value: { roomId: "merapi", accountId: "u_001", title: "Sprint planning", start: new Date(valid.start), end: new Date(valid.end) },
    });
  });

  it("other fields are ignored", () => {
    expect(book({ ...valid, id: "x", accountId: "u_002", roomName: "Kew" })).toStrictEqual(book(valid));
  });

  it("the content-type is application/json, as for sign-in", () => {
    expect(book(valid, "application/json; charset=utf-8").ok).toBe(true);
    expect(book(valid, "Application/JSON").ok).toBe(true);
    // A missing header goes straight to the rule: `book`'s default would fill an explicit undefined.
    expect(checkNewBooking({ contentType: undefined, body: valid, accountId: "u_001", now: NOW })).toStrictEqual(refused);
    for (const ct of ["", "text/plain", "application/jsonx", "application/x-www-form-urlencoded"]) {
      expect(book(valid, ct), ct).toStrictEqual(refused);
    }
  });

  it("the body is a JSON object", () => {
    for (const b of [null, undefined, JSON.stringify(valid), 42, true, [valid]]) expect(book(b)).toStrictEqual(refused);
  });

  it("a missing or mistyped field is refused", () => {
    for (const key of ["roomId", "start", "end", "title"] as const) {
      const { [key]: _dropped, ...rest } = valid;
      expect(book(rest), `no ${key}`).toStrictEqual(refused);
      expect(book({ ...valid, [key]: 42 }), `numeric ${key}`).toStrictEqual(refused);
    }
    expect(book({ ...valid, start: Date.parse(valid.start) })).toStrictEqual(refused);
  });

  it("D3: roomId names one of the four rooms", () => {
    for (const roomId of ["merapi", "bromo", "thames", "kew"]) expect(book({ ...valid, roomId }).ok).toBe(true);
    for (const roomId of ["everest", "Merapi", " merapi", ""]) expect(book({ ...valid, roomId })).toStrictEqual(refused);
  });

  it("G2: start and end are quarter-hour instants, end after start", () => {
    expect(book({ ...valid, start: "2026-11-05T02:10:00.000Z" })).toStrictEqual(refused);
    expect(book({ ...valid, end: "2026-11-05T03:00:00Z" })).toStrictEqual(refused);
    expect(book({ ...valid, start: "2026-11-05T09:00:00.000+07:00", end: "2026-11-05T10:00:00.000+07:00" })).toStrictEqual(refused);
    expect(book({ ...valid, end: valid.start })).toStrictEqual(refused);
    expect(book({ ...valid, start: valid.end, end: valid.start })).toStrictEqual(refused);
  });

  it("G8: 80 emoji are accepted and 81 refused: characters are code points", () => {
    expect(book({ ...valid, title: "📅".repeat(80) }).ok).toBe(true);
    expect(book({ ...valid, title: "📅".repeat(81) })).toStrictEqual(refused);
    expect(book({ ...valid, title: "a".repeat(80) }).ok).toBe(true);
    expect(book({ ...valid, title: "a".repeat(81) })).toStrictEqual(refused);
  });

  it("G8: an empty title, or one of whitespace only, is refused", () => {
    for (const title of ["", "   ", "\t\n", "\u00a0\u3000"]) expect(book({ ...valid, title }), JSON.stringify(title)).toStrictEqual(refused);
  });

  it("G8, D9: a title holding U+0000 or an unpaired surrogate is refused", () => {
    for (const title of ["Retro\u0000", "\u0000", "Retro \uD800", "\uD800", "\uDC00 Retro", "\uDE00\uD83D"]) {
      expect(book({ ...valid, title }), JSON.stringify(title)).toStrictEqual(refused);
    }
    expect(book({ ...valid, title: "Retro \uD83D\uDCC5" }).ok).toBe(true);
  });

  it("G8: the title is kept exactly as sent, never trimmed", () => {
    const result = book({ ...valid, title: "  Retro  " });
    expect(result.ok && result.value.title).toBe("  Retro  ");
  });
});

describe("POST /api/bookings limits, in order (G7, G9, G10, G15)", () => {
  const at = (start: string, end: string, now = NOW) => {
    const result = book({ ...valid, start, end }, "application/json", now);
    return result.ok ? "ok" : result.error.code;
  };

  it("G9: exactly 8 hours is accepted, 8 hours 15 minutes refused", () => {
    expect(at("2026-11-05T01:00:00.000Z", "2026-11-05T09:00:00.000Z")).toBe("ok");
    expect(at("2026-11-05T01:00:00.000Z", "2026-11-05T09:15:00.000Z")).toBe("BOOKING_TOO_LONG");
  });

  it("G9: length is elapsed time: London 00:00 to 08:00 on its 25-hour day is 9 hours", () => {
    expect(at("2027-10-30T23:00:00.000Z", "2027-10-31T08:00:00.000Z", new Date("2027-10-01T09:00:00.000Z"))).toBe("BOOKING_TOO_LONG");
  });

  it("G7: a clock reading start, or later, has started; a millisecond before has not", () => {
    expect(at(valid.start, valid.end, new Date(valid.start))).toBe("BOOKING_STARTED");
    expect(at(valid.start, valid.end, new Date("2026-11-05T02:30:00.000Z"))).toBe("BOOKING_STARTED");
    expect(at(valid.start, valid.end, new Date("2026-11-05T01:59:59.999Z"))).toBe("ok");
  });

  it("G10: 8,760 hours ahead is accepted, 8,760 hours 15 minutes refused", () => {
    const now = new Date("2026-11-04T00:00:00.000Z");
    expect(Date.parse("2027-11-04T00:00:00.000Z") - now.getTime()).toBe(8760 * 60 * 60 * 1000);
    expect(at("2027-11-04T00:00:00.000Z", "2027-11-04T01:00:00.000Z", now)).toBe("ok");
    expect(at("2027-11-04T00:15:00.000Z", "2027-11-04T01:15:00.000Z", now)).toBe("BOOKING_TOO_FAR_AHEAD");
  });

  it("G15: the first rule that applies answers", () => {
    expect(at("2026-11-05T01:00:00.000Z", "2026-11-05T09:15:00.000Z", new Date("2026-11-05T02:00:00.000Z"))).toBe("BOOKING_TOO_LONG");
    expect(at("2028-01-01T00:00:00.000Z", "2028-01-01T09:00:00.000Z")).toBe("BOOKING_TOO_LONG");
    const invalidAndLong = book({ ...valid, start: "2026-11-05T01:00:00.000Z", end: "2026-11-05T09:15:00.000Z", title: "" }, "application/json", new Date("2026-11-05T02:00:00.000Z"));
    expect(invalidAndLong).toStrictEqual(refused);
  });
});

const stored = (id: string, roomId: string, start: string, end: string, accountId = "u_001"): StoredBooking => ({
  id, roomId, accountId, title: `Title ${id}`, start: new Date(start), end: new Date(end),
});

describe("views (G13, G14)", () => {
  it("a stored booking on the wire gains roomName and carries no account", () => {
    expect(toWireBooking(stored("b1", "thames", "2026-11-05T10:00:00.000Z", "2026-11-05T11:00:00.000Z"))).toStrictEqual({
      id: "b1", roomId: "thames", roomName: "Thames", title: "Title b1", start: "2026-11-05T10:00:00.000Z", end: "2026-11-05T11:00:00.000Z",
    });
  });

  it("a booking of no known room is a defect, not a view", () => {
    expect(() => toWireBooking(stored("x", "everest", "2026-11-05T10:00:00.000Z", "2026-11-05T11:00:00.000Z"))).toThrow(/everest/);
  });

  it("G13: every room in D3's order, each with its bookings earliest start first", () => {
    const late = stored("late", "thames", "2026-11-05T12:00:00.000Z", "2026-11-05T13:00:00.000Z");
    const early = stored("early", "thames", "2026-11-05T09:00:00.000Z", "2026-11-05T10:00:00.000Z", "u_002");
    const merapi = stored("m", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    const input = [late, early, merapi];
    const { rooms } = roomsView(input);
    expect(rooms.map((r) => r.id)).toStrictEqual(["merapi", "bromo", "thames", "kew"]);
    expect(rooms[0]).toStrictEqual({ id: "merapi", name: "Merapi", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 8, bookings: [toWireBooking(merapi)] });
    expect(rooms[2]!.bookings.map((b) => b.id)).toStrictEqual(["early", "late"]);
    expect(input).toStrictEqual([late, early, merapi]);
  });

  it("G13: a room with no booking has bookings []", () => {
    expect(roomsView([]).rooms.map((r) => r.bookings)).toStrictEqual([[], [], [], []]);
  });

  it("G14: my bookings by start, ties in D3's room order", () => {
    const kew = stored("k", "kew", "2026-11-05T09:00:00.000Z", "2026-11-05T10:00:00.000Z");
    const merapi = stored("m", "merapi", "2026-11-05T09:00:00.000Z", "2026-11-05T10:00:00.000Z");
    const thames = stored("t", "thames", "2026-11-05T08:00:00.000Z", "2026-11-05T09:00:00.000Z");
    const bromo = stored("b", "bromo", "2026-11-05T09:00:00.000Z", "2026-11-05T09:30:00.000Z");
    const input = [kew, merapi, thames, bromo];
    expect(myBookingsView(input).bookings.map((b) => b.id)).toStrictEqual(["t", "m", "b", "k"]);
    expect(input).toStrictEqual([kew, merapi, thames, bromo]);
  });
});

describe("DELETE /api/bookings/{id} (G11, G12)", () => {
  const mine = stored("00000000-0000-4000-8000-000000000031", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
  const cancel = (id: string, booking: StoredBooking | undefined, now = NOW, accountId = "u_001") => {
    const result = checkCancel({ id, accountId, now, booking });
    return result.ok ? result.value : result.error.code;
  };

  it("my booking, before its start, may be cancelled", () => {
    expect(cancel(mine.id, mine)).toBe(mine);
  });

  it("an id that is not a lower-case UUID is BOOKING_NOT_FOUND, before anything else", () => {
    expect(isBookingId(mine.id)).toBe(true);
    for (const id of ["not-a-booking", "", "00000000-0000-4000-8000-0000000000FF", "00000000-0000-4000-8000-00000000003", `${mine.id} `]) {
      expect(isBookingId(id), id).toBe(false);
      expect(cancel(id, mine), id).toBe("BOOKING_NOT_FOUND");
    }
  });

  it("G15: a malformed id is BOOKING_NOT_FOUND even when the booking is another account's or has started", () => {
    // An upper-case id can still find its lower-case row in a uuid column; the id's form must answer first.
    const hex = stored("00000000-0000-4000-8000-0000000000ff", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    const upper = "00000000-0000-4000-8000-0000000000FF";
    expect(cancel(upper, hex, NOW, "u_002")).toBe("BOOKING_NOT_FOUND");
    expect(cancel(upper, hex, hex.start)).toBe("BOOKING_NOT_FOUND");
    expect(cancel(upper, hex, hex.start, "u_002")).toBe("BOOKING_NOT_FOUND");
  });

  it("an id that names no booking is BOOKING_NOT_FOUND", () => {
    expect(cancel("00000000-0000-4000-8000-0000000000ff", undefined)).toBe("BOOKING_NOT_FOUND");
  });

  it("G12: another account's booking is BOOKING_NOT_YOURS, whatever its timing", () => {
    for (const now of [NOW, mine.start, new Date("2026-11-06T00:00:00.000Z")]) expect(cancel(mine.id, mine, now, "u_002")).toBe("BOOKING_NOT_YOURS");
  });

  it("G11: a booking whose start the clock has reached is BOOKING_STARTED", () => {
    expect(cancel(mine.id, mine, mine.start)).toBe("BOOKING_STARTED");
    expect(cancel(mine.id, mine, new Date("2026-11-05T02:30:00.000Z"))).toBe("BOOKING_STARTED");
    expect(cancel(mine.id, mine, new Date("2026-11-05T01:59:59.999Z"))).toBe(mine);
  });
});

describe("error responses (booking-api@v1 Errors)", () => {
  it.each([
    ["UNAUTHORIZED", 401, "Sign in to continue."],
    ["VALIDATION_FAILED", 400, "The request is not valid."],
    ["BOOKING_TOO_LONG", 422, "A booking can last at most 8 hours."],
    ["BOOKING_STARTED", 422, "That time has already started."],
    ["BOOKING_TOO_FAR_AHEAD", 422, "A booking can start at most 365 days ahead."],
    ["BOOKING_NOT_FOUND", 404, "There is no such booking."],
    ["BOOKING_NOT_YOURS", 403, "You can cancel only your own bookings."],
  ] as const)("%s is %i with its one message and no conflict", (code, status, message) => {
    expect(errorResponse({ code })).toStrictEqual({ status, body: { error: { code, message } } });
  });

  it("G6: BOOKING_CONFLICT is 409 and carries error.conflict as a wire Booking", () => {
    const other = stored("00000000-0000-4000-8000-000000000023", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z", "u_002");
    expect(errorResponse({ code: "BOOKING_CONFLICT", conflict: other })).toStrictEqual({
      status: 409,
      body: { error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: toWireBooking(other) } },
    });
  });
});
