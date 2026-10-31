import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { buildApp } from "../src/app.ts";
import { DEFAULT_DATABASE_URL } from "../src/db.ts";
import { configFromEnv, start } from "../src/server.ts";
import { createTestDatabase, testDatabase } from "./db.ts";
import { NO_STORE } from "./no-store.ts";

const BACKEND_DIR = fileURLToPath(new URL("..", import.meta.url));
const UNREACHABLE = "postgres://meeting_rooms:not-the-password@127.0.0.1:1/meeting_rooms";
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

/** Polls until the condition holds; fails after the timeout so a stuck database cannot hang the suite. */
const until = async (condition: () => Promise<boolean>, timeoutMs = 5000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error("condition not reached before the timeout");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

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

describe("start when the database fails", () => {
  it("rejects naming npm --prefix backend run db:up when the database cannot be reached, and never the URL", async () => {
    const error = await start(0, UNREACHABLE).then(() => undefined, (e: Error) => e);
    expect(error?.message).toContain("cannot be reached or refused the connection");
    expect(error?.message).toContain("npm --prefix backend run db:up");
    expect(error?.message).not.toContain("not-the-password");
  });

  it("names the refusal's code and the DATABASE_URL check when the database does not exist (3D000)", async () => {
    const missing = new URL(DEFAULT_DATABASE_URL);
    missing.pathname = "/test_does_not_exist";
    const error = await start(0, missing.toString()).then(() => undefined, (e: Error) => e);
    expect(error?.message).toContain("(3D000)");
    expect(error?.message).toContain("check that DATABASE_URL names a database that exists");
    expect(error?.message).toContain("npm --prefix backend run db:up");
  });

  it("npm start's entry exits non-zero with that message when the database cannot be reached", () => {
    const run = spawnSync(process.execPath, ["src/server.ts"], {
      cwd: BACKEND_DIR,
      env: { ...process.env, PORT: "0", DATABASE_URL: UNREACHABLE },
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("cannot be reached or refused the connection");
    expect(run.stderr).toContain("npm --prefix backend run db:up");
    expect(run.stdout + run.stderr).not.toContain("not-the-password");
  });

  it("keeps serving after the database ends its idle connections (backend.4 deferred minor)", async () => {
    const own = await createTestDatabase();
    let app: FastifyInstance | undefined;
    try {
      app = await start(0, `${own.url}?application_name=b7_lost_connection`);
      const base = baseOf(app);
      const token = ((await (await fetch(`${base}/api/login`, { method: "POST", headers: JSON_HEADERS, body: AYU })).json()) as { token: string }).token;
      const rooms = () => fetch(`${base}/api/rooms?from=2026-11-05T00%3A00%3A00.000Z&to=2026-11-06T00%3A00%3A00.000Z`, { headers: { authorization: `Bearer ${token}` } });
      expect((await rooms()).status).toBe(200);
      const ended = await own.pool.query("SELECT pg_terminate_backend(pid) AS ended FROM pg_stat_activity WHERE application_name = 'b7_lost_connection'");
      expect(ended.rows.some((row) => row.ended === true)).toBe(true);
      await until(async () => (await own.pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name = 'b7_lost_connection'")).rowCount === 0);
      expect((await rooms()).status).toBe(200);
    } finally {
      await app?.close();
      await own.drop();
    }
  });

  it("answers 500 for the request whose connection is lost while it waits on the room lock, and keeps serving", async () => {
    const own = await createTestDatabase();
    const tag = "b7_in_flight";
    let app: FastifyInstance | undefined;
    const holder = await own.pool.connect();
    let held = false;
    try {
      app = await start(0, `${own.url}?application_name=${tag}`);
      const base = baseOf(app);
      const token = ((await (await fetch(`${base}/api/login`, { method: "POST", headers: JSON_HEADERS, body: AYU })).json()) as { token: string }).token;
      const quarter = 15 * 60 * 1000;
      const startMs = Math.ceil((Date.now() + 24 * 60 * 60 * 1000) / quarter) * quarter;
      const post = (offsetHours: number) =>
        fetch(`${base}/api/bookings`, {
          method: "POST",
          headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` },
          body: JSON.stringify({
            roomId: "merapi",
            title: "In flight",
            start: new Date(startMs + offsetHours * 3_600_000).toISOString(),
            end: new Date(startMs + (offsetHours + 1) * 3_600_000).toISOString(),
          }),
        });
      await holder.query("SELECT pg_advisory_lock(hashtext('merapi'))");
      held = true;
      const inFlight = post(0);
      await until(async () => (await own.pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [tag])).rowCount! > 0);
      const ended = await own.pool.query("SELECT pg_terminate_backend(pid) AS ended FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [tag]);
      expect(ended.rows.some((row) => row.ended === true)).toBe(true);
      expect((await inFlight).status).toBe(500);
      await holder.query("SELECT pg_advisory_unlock(hashtext('merapi'))");
      held = false;
      expect((await post(2)).status).toBe(201);
    } finally {
      if (held) await holder.query("SELECT pg_advisory_unlock(hashtext('merapi'))");
      holder.release();
      await app?.close();
      await own.drop();
    }
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
