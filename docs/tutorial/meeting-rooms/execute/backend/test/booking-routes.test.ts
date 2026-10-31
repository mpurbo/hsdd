// The booking endpoints against a real PostgreSQL database (D8).
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ACCOUNTS } from "../src/accounts.ts";
import { buildApp } from "../src/app.ts";
import type { BookingStore } from "../src/domain.ts";
import { createBookingStore } from "../src/booking-store.ts";
import { testDatabase } from "./db.ts";

const db = testDatabase();
beforeEach(() => db.resetBookings());

const NOW = "2026-11-04T12:00:00.000Z"; // every booking below is on 2026-11-05
const PASSWORDS: Record<string, string> = { ayu: "sunrise-42", budi: "harbor-17" };
const UNAUTHORIZED = { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } };
const BOOKING_INVALID = { error: { code: "VALIDATION_FAILED", message: "The request is not valid." } };

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

function service(store: BookingStore = createBookingStore(db.pool)) {
  let now = Date.parse(NOW);
  const built = (app = buildApp({ clock: () => new Date(now), randomBytes, accounts: ACCOUNTS, store }));
  const signIn = async (username: string): Promise<string> => {
    const res = await built.inject({
      method: "POST",
      url: "/api/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username, password: PASSWORDS[username] }),
    });
    return res.json().token;
  };
  const setClock = (iso: string) => void (now = Date.parse(iso));
  const get = (url: string, token?: string) =>
    built.inject({ method: "GET", url, ...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }) });
  return { app: built, signIn, setClock, get };
}

const MERAPI = "merapi";
const seed = (id: string, account: string, roomId = MERAPI, start = "2026-11-05T02:00:00.000Z", end = "2026-11-05T03:00:00.000Z") =>
  db.seedBookings([{ id, account, roomId, title: "Standup", start, end }]);
const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const DAY = "from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z";

describe("GET /api/rooms", () => {
  it("decodes percent-encoded colons like plain ones", async () => {
    const { signIn, get } = service();
    await seed(ID1, "ayu");
    const token = await signIn("ayu");
    const plain = await get(`/api/rooms?${DAY}`, token);
    const encoded = await get("/api/rooms?from=2026-11-05T00%3A00%3A00.000Z&to=2026-11-06T00%3A00%3A00.000Z", token);
    expect(encoded.statusCode).toBe(200);
    expect(encoded.json()).toEqual(plain.json());
    expect(plain.json().rooms[0].bookings).toHaveLength(1);
  });

  it("refuses a repeated from with 400", async () => {
    const { signIn, get } = service();
    const token = await signIn("ayu");
    const res = await get("/api/rooms?from=2026-11-05T00:00:00.000Z&from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z", token);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(BOOKING_INVALID);
  });

  it("answers a range from 0000-01-01T00:00:00.000Z with 200 and its bookings (D10)", async () => {
    const { signIn, get } = service();
    await seed(ID1, "ayu");
    const res = await get("/api/rooms?from=0000-01-01T00:00:00.000Z&to=2026-11-06T00:00:00.000Z", await signIn("ayu"));
    expect(res.statusCode).toBe(200);
    expect(res.json().rooms[0].bookings).toHaveLength(1);
  });

  it("answers 401 before 400 when both apply (G15)", async () => {
    const { get } = service();
    const res = await get("/api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-05T00:00:00.000Z");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(UNAUTHORIZED);
  });
});

describe("GET /api/me/bookings", () => {
  it("lists only the caller's bookings", async () => {
    const { signIn, get } = service();
    await seed(ID1, "ayu");
    await seed(ID2, "budi", "bromo", "2026-11-05T04:00:00.000Z", "2026-11-05T05:00:00.000Z");
    const res = await get("/api/me/bookings", await signIn("ayu"));
    expect(res.statusCode).toBe(200);
    expect(res.json().bookings.map((b: { id: string }) => b.id)).toEqual([ID1]);
  });

  it("answers 401 without a token", async () => {
    const { get } = service();
    const res = await get("/api/me/bookings");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(UNAUTHORIZED);
  });
});
