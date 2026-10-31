import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { buildApp } from "../src/app.ts";
import { DEFAULT_DATABASE_URL } from "../src/db.ts";
import { configFromEnv, start } from "../src/server.ts";
import { testDatabase } from "./db.ts";
import { NO_STORE } from "./no-store.ts";

const AYU = JSON.stringify({ username: "ayu", password: "sunrise-42" });

describe("log hygiene (RFC §9)", () => {
  it("never writes the password or the token to a log line", async () => {
    const lines: string[] = [];
    const stream = new Writable({ write: (chunk, _enc, done) => (lines.push(String(chunk)), done()) });
    const app = buildApp({ clock: () => new Date(), randomBytes, accounts: ACCOUNTS, store: NO_STORE, logger: { level: "info", stream } });
    const login = await app.inject({ method: "POST", url: "/api/login", headers: { "content-type": "application/json" }, payload: AYU });
    const token = login.json().token as string;
    await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } });
    await app.close();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => l.includes("sunrise-42") || l.includes(token))).toEqual([]);
  });
});

const db = testDatabase({ empty: true });
const started: FastifyInstance[] = [];
afterEach(async () => {
  // a connected pool fails the drop with 55006
  await Promise.all(started.splice(0).map((app) => app.close()));
});
const begin = async (): Promise<FastifyInstance> => {
  const app = await start(0, db.url);
  started.push(app);
  return app;
};
const baseOf = (app: FastifyInstance): string => `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
const JSON_HEADERS = { "content-type": "application/json" };

describe("configFromEnv", () => {
  it("defaults to port 3000 and the Compose database", () => {
    expect(configFromEnv({})).toEqual({ port: 3000, databaseUrl: DEFAULT_DATABASE_URL });
  });

  it("reads PORT and DATABASE_URL", () => {
    expect(configFromEnv({ PORT: "4001", DATABASE_URL: "postgres://x@127.0.0.1:1/y" })).toEqual({
      port: 4001,
      databaseUrl: "postgres://x@127.0.0.1:1/y",
    });
  });
});

describe("start", () => {
  it("starts on an empty database, books, and after a second start keeps the booking and signs everyone out (G17)", async () => {
    expect((await db.pool.query("SELECT to_regclass('public.booking') AS t")).rows[0].t).toBeNull();
    const first = await begin();
    expect((first.server.address() as AddressInfo).address).toBe("127.0.0.1");
    const signIn = async (base: string): Promise<string> =>
      ((await (await fetch(`${base}/api/login`, { method: "POST", headers: JSON_HEADERS, body: AYU })).json()) as { token: string }).token;
    const quarter = 15 * 60 * 1000;
    const hourMs = Math.ceil((Date.now() + 24 * 60 * 60 * 1000) / quarter) * quarter;
    const hour = new Date(hourMs).toISOString();
    const end = new Date(hourMs + 60 * 60 * 1000).toISOString();
    const rangeUrl = (base: string) => `${base}/api/rooms?from=${encodeURIComponent(hour)}&to=${encodeURIComponent(end)}`;
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    const token1 = await signIn(baseOf(first));
    const rooms = await fetch(rangeUrl(baseOf(first)), { headers: auth(token1) });
    expect(rooms.status).toBe(200);
    const body = (await rooms.json()) as { rooms: { id: string; bookings: unknown[] }[] };
    expect(body.rooms.map((r) => r.id)).toEqual(["merapi", "bromo", "thames", "kew"]);
    expect(body.rooms.map((r) => r.bookings)).toEqual([[], [], [], []]);
    const post = await fetch(`${baseOf(first)}/api/bookings`, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...auth(token1) },
      body: JSON.stringify({ roomId: "merapi", title: "Restart check", start: hour, end }),
    });
    expect(post.status).toBe(201);
    const created = await post.json();
    expect((await db.pool.query("SELECT to_regclass('public.booking') AS t")).rows[0].t).toBe("booking");
    await first.close();

    const second = await begin();
    const stale = await fetch(`${baseOf(second)}/api/me/bookings`, { headers: auth(token1) });
    expect(stale.status).toBe(401);
    expect(((await stale.json()) as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    const token2 = await signIn(baseOf(second));
    const again = (await (await fetch(rangeUrl(baseOf(second)), { headers: auth(token2) })).json()) as {
      rooms: { id: string; bookings: unknown[] }[];
    };
    expect(again.rooms.find((r) => r.id === "merapi")!.bookings).toEqual([created]);
    const mine = await fetch(`${baseOf(second)}/api/me/bookings`, { headers: auth(token2) });
    expect(await mine.json()).toEqual({ bookings: [created] });
  });
});

describe("package", () => {
  it("declares the Node version whose import.meta.main the server entry relies on", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.engines.node).toBe(">=24.2");
  });

  it("the gate and the replay start PostgreSQL and run in Asia/Kolkata", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.scripts.gate).toBe("npm run db:up && tsc --noEmit && TZ=Asia/Kolkata vitest run");
    expect(pkg.scripts.replay).toBe("npm run db:up && TZ=Asia/Kolkata vitest run test/contract.replay.test.ts");
  });
});
