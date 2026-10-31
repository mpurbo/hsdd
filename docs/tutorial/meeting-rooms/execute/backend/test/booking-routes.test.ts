// The booking endpoints against a real PostgreSQL database (D8).
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
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
const LOGIN_INVALID = { error: { code: "VALIDATION_FAILED", message: "Username and password are required." } };
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
  const post = (payload: string, token?: string, contentType: string | null = "application/json") =>
    built.inject({
      method: "POST",
      url: "/api/bookings",
      headers: {
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        ...(contentType === null ? {} : { "content-type": contentType }),
      },
      payload,
    });
  return { app: built, signIn, setClock, get, post };
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

const bookingBody = (title = "Sprint planning") =>
  JSON.stringify({ roomId: MERAPI, start: "2026-11-05T02:00:00.000Z", end: "2026-11-05T03:00:00.000Z", title });

describe("POST /api/bookings", () => {
  it("creates a booking, answers 201 with its wire form and stores it", async () => {
    const { signIn, post, get } = service();
    const token = await signIn("ayu");
    const res = await post(bookingBody(), token);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      roomId: MERAPI,
      roomName: "Merapi",
      title: "Sprint planning",
      start: "2026-11-05T02:00:00.000Z",
      end: "2026-11-05T03:00:00.000Z",
    });
    const mine = await get("/api/me/bookings", token);
    expect(mine.json().bookings).toEqual([res.json()]);
  });

  it("answers 409 naming the overlapping booking", async () => {
    const { signIn, post } = service();
    const first = await post(bookingBody("First"), await signIn("ayu"));
    const second = await post(bookingBody("Second"), await signIn("budi"));
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({
      error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: first.json() },
    });
  });

  it("answers 401 without a token", async () => {
    const { post } = service();
    const res = await post(bookingBody());
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(UNAUTHORIZED);
  });

  it("answers a limit failure through the rules (started booking is 422)", async () => {
    const { signIn, post, setClock } = service();
    setClock("2026-11-05T02:30:00.000Z");
    const token = await signIn("ayu");
    const res = await post(bookingBody(), token);
    expect(res.json().error.code).toBe("BOOKING_STARTED");
  });
});

describe("content type: POST /api/bookings answers as POST /api/login does (backend.5 Outstanding)", () => {
  const loginBody = JSON.stringify({ username: "ayu", password: "sunrise-42" });
  it.each([
    ["text/plain", 400, LOGIN_INVALID, 400, BOOKING_INVALID],
    [undefined, 400, LOGIN_INVALID, 400, BOOKING_INVALID], // the header left out; the body still sent
    ["application/json; charset=utf-8", 200, undefined, 201, undefined],
  ] as const)("%s", async (contentType, loginStatus, loginBody_, bookStatus, bookBody) => {
    const { app: built, signIn, post } = service();
    const token = await signIn("budi");
    const login = await built.inject({
      method: "POST",
      url: "/api/login",
      headers: contentType === undefined ? {} : { "content-type": contentType },
      payload: loginBody,
    });
    expect(login.statusCode).toBe(loginStatus);
    if (loginBody_ !== undefined) expect(login.json()).toEqual(loginBody_);
    const booked = await post(bookingBody(), token, contentType ?? null);
    expect(booked.statusCode).toBe(bookStatus);
    if (bookBody !== undefined) expect(booked.json()).toEqual(bookBody);
  });
});

it("refuses a body that is not JSON, or JSON that is not an object, with 400", async () => {
  const { signIn, post } = service();
  const token = await signIn("ayu");
  for (const body of ["{", "null", "[]", '"x"']) {
    const res = await post(body, token);
    expect(res.statusCode, body).toBe(400);
    expect(res.json(), body).toEqual(BOOKING_INVALID);
  }
});

it("answers 401 before 400 when both apply (G15)", async () => {
  const { post } = service();
  const res = await post("{");
  expect(res.statusCode).toBe(401);
  expect(res.json()).toEqual(UNAUTHORIZED);
});

it("20 simultaneous POSTs for one room and time give one 201 and nineteen 409 naming it, ten rounds (G5)", async () => {
  const pool = new Pool({ connectionString: db.url, max: 20 });
  try {
    const { signIn, post } = service(createBookingStore(pool));
    const tokens = [await signIn("ayu"), await signIn("budi")];
    for (let round = 0; round < 10; round++) {
      await db.resetBookings();
      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, i) => post(bookingBody(`Attempt ${i + 1}`), tokens[i % 2])),
      );
      const statuses = responses.map((r) => r.statusCode);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(19);
      const created = responses.find((r) => r.statusCode === 201)!;
      for (const r of responses.filter((r) => r.statusCode === 409)) {
        expect(r.json()).toEqual({
          error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: created.json() },
        });
      }
    }
  } finally {
    await app?.close();
    app = undefined;
    await pool.end();
  }
});
