// The test database helper (D8): one database per test file, never meeting_rooms.
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, createPool } from "../src/db.ts";
import { createTestDatabase, testDatabase } from "./db.ts";
import type { GivenBooking } from "./replay.ts";

const db = testDatabase();
beforeEach(() => db.resetBookings());

const USERNAMES: Record<string, string> = { u_001: "ayu", u_002: "budi" };
const stored = async (): Promise<GivenBooking[]> =>
  (
    await db.pool.query("SELECT id, room_id, account_id, title, start_at, end_at FROM booking ORDER BY id")
  ).rows.map((r) => ({
    id: r.id,
    account: USERNAMES[r.account_id] ?? r.account_id,
    roomId: r.room_id,
    title: r.title,
    start: (r.start_at as Date).toISOString(),
    end: (r.end_at as Date).toISOString(),
  }));
const count = async () => Number((await db.pool.query("SELECT count(*) AS n FROM booking")).rows[0].n);

const givenOf = (fixture: string): GivenBooking[] =>
  JSON.parse(readFileSync(new URL(`../../hsdd/contract/fixture/booking-api/${fixture}.json`, import.meta.url), "utf8"))
    .given;

describe("seedBookings and resetBookings", () => {
  it("seeds a fixture's given bookings with their ids and account ids", async () => {
    const given = givenOf("my-bookings-budi");
    expect(given).toHaveLength(6);
    await db.seedBookings(given);
    expect(await stored()).toEqual([...given].sort((a, b) => a.id.localeCompare(b.id)));
  });

  it("keeps a title outside the Basic Multilingual Plane exactly", async () => {
    const given: GivenBooking = {
      id: "00000000-0000-4000-8000-0000000000aa",
      account: "ayu",
      roomId: "bromo",
      title: "Rapat \u{1F680} tim",
      start: "2026-11-05T02:00:00.000Z",
      end: "2026-11-05T03:00:00.000Z",
    };
    await db.seedBookings([given]);
    expect(await stored()).toEqual([given]);
  });

  it("resetBookings leaves no booking", async () => {
    await db.seedBookings(givenOf("rooms-range-edges"));
    await db.resetBookings();
    expect(await count()).toBe(0);
  });

  it("refuses a given booking whose account is no built-in username", async () => {
    const [first] = givenOf("cancel-my-booking");
    await expect(db.seedBookings([first!, { ...first!, id: "00000000-0000-4000-8000-0000000000bb", account: "citra" }]))
      .rejects.toThrow(/citra/);
    expect(await count()).toBe(0);
  });
});

const maintenanceUrl = () => {
  const url = new URL(DEFAULT_DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
};

describe("createTestDatabase", () => {
  it("two test databases created at once get different names, neither meeting_rooms nor meeting_rooms_e2e", async () => {
    const both = await Promise.all([createTestDatabase(), createTestDatabase()]);
    try {
      const [a, b] = both;
      expect(a.name).not.toBe(b.name);
      for (const db of both) {
        expect(db.name).toMatch(/^test_[0-9a-f]{32}$/);
        const { rows } = await db.pool.query("SELECT to_regclass('booking') AS booking");
        expect(rows[0].booking).toBe("booking");
      }
    } finally {
      await Promise.all(both.map((db) => db.drop()));
    }
  });

  it("drops the database it created when the schema cannot be applied", async () => {
    let name = "";
    const broken = async (pool: Pool) => {
      name = (await pool.query("SELECT current_database() AS name")).rows[0].name;
      throw new Error("schema.sql is broken");
    };
    await expect(createTestDatabase(broken)).rejects.toThrow("schema.sql is broken");
    expect(name).toMatch(/^test_[0-9a-f]{32}$/);
    const admin = createPool(maintenanceUrl());
    try {
      const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
      expect(rows).toEqual([]);
    } finally {
      await admin.end();
    }
  });

  it("a dropped test database is gone from pg_database", async () => {
    const db = await createTestDatabase();
    await db.drop();
    const admin = createPool(maintenanceUrl());
    try {
      const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [db.name]);
      expect(rows).toEqual([]);
    } finally {
      await admin.end();
    }
  });
});
