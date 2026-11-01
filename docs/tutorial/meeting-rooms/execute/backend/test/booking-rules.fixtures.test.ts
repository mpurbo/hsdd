// Every booking-api@v1 fixture whose answer the rules decide, run through the
// rules with its clock, its request and its given bookings (simple-login.backend.5).
import { describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { checkCancel, checkNewBooking, checkRoomsQuery, errorResponse, toWireBooking } from "../src/booking-rules.ts";
import type { Booking, StoredBooking } from "../src/domain.ts";
import { loadFixtures, type Fixture, type GivenBooking } from "./replay.ts";

const fixtures = loadFixtures("booking-api");

const accountId = (username: string): string => {
  const account = ACCOUNTS.find((a) => a.username === username);
  if (account === undefined) throw new Error(`no built-in account ${username}`);
  return account.id;
};
const caller = (f: Fixture): string => accountId(/\{\{token:([^}]+)\}\}/.exec(f.request.headers.authorization ?? "")?.[1] ?? "");
const toStored = (g: GivenBooking): StoredBooking => ({
  id: g.id, roomId: g.roomId, accountId: accountId(g.account), title: g.title, start: new Date(g.start), end: new Date(g.end),
});
/** The query as the framework hands it over: decoded, a repeated parameter as an array. */
const query = (path: string): Record<string, string | string[]> => {
  const params = new URL(path, "http://127.0.0.1").searchParams;
  return Object.fromEntries([...new Set(params.keys())].map((k) => [k, params.getAll(k).length === 1 ? params.get(k)! : params.getAll(k)]));
};

/** The rules' answer to one fixture's request, at its clock, with its given bookings. */
const decide = (f: Fixture) => {
  const now = new Date(f.clock!);
  const { method, path, headers, body } = f.request;
  if (method === "GET") return checkRoomsQuery(query(path));
  if (method === "POST") return checkNewBooking({ contentType: headers["content-type"], body, accountId: caller(f), now });
  const id = decodeURIComponent(path.slice("/api/bookings/".length));
  return checkCancel({ id, accountId: caller(f), now, booking: (f.given ?? []).map(toStored).find((b) => b.id === id) });
};

const named = (statuses: number[], pathPrefix = "/api/") =>
  fixtures.filter((f) => statuses.includes(f.response.status) && f.request.path.startsWith(pathPrefix)).map((f) => [f.name, f] as const);

describe("booking-api@v1 fixtures the rules decide", () => {
  it("are these sixteen, each 400, 403, 404 and 422", () => {
    expect(named([400, 403, 404, 422]).map(([name]) => name).sort()).toStrictEqual([
      "book-end-not-after-start", "book-instant-with-offset", "book-not-on-a-quarter-hour", "book-started",
      "book-started-and-overlapping", "book-title-blank", "book-title-too-long", "book-too-far-ahead", "book-too-long",
      "book-unknown-room", "cancel-malformed-id", "cancel-someone-elses", "cancel-started", "cancel-unknown",
      "rooms-from-not-before-to", "rooms-instant-without-milliseconds",
    ]);
  });

  it.each(named([400, 403, 404, 422]))("%s: the rules give its status and body", (_name, f) => {
    const result = decide(f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(errorResponse(result.error)).toStrictEqual(f.response);
  });
});

describe("booking-api@v1 fixtures the rules let through", () => {
  it.each([...named([200], "/api/rooms"), ...named([201, 204, 409])])("%s passes its rule", (_name, f) => {
    expect(decide(f).ok).toBe(true);
  });

  it.each(named([201]))("%s: the new booking on the wire is the fixture's body", (_name, f) => {
    const result = checkNewBooking({ contentType: f.request.headers["content-type"], body: f.request.body, accountId: caller(f), now: new Date(f.clock!) });
    const expected = f.response.body as Booking;
    expect(result.ok && toWireBooking({ id: expected.id, ...result.value })).toStrictEqual(expected);
  });

  it.each(named([409]))("%s: the conflict body names the given booking", (_name, f) => {
    const { conflict } = (f.response.body as { error: { conflict: Booking } }).error;
    const given = (f.given ?? []).map(toStored).find((b) => b.id === conflict.id)!;
    expect(errorResponse({ code: "BOOKING_CONFLICT", conflict: given })).toStrictEqual(f.response);
  });
});
