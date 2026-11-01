// schema.sql (D6) on a real PostgreSQL 17, in a database of this file's own (D8).
import { beforeEach, describe, expect, it } from "vitest";
import { applySchema } from "../src/db.ts";
import { testDatabase } from "./db.ts";

const db = testDatabase();

const insert = (roomId: string, start: string, end: string) =>
  db.pool.query(
    "INSERT INTO booking (room_id, account_id, title, start_at, end_at) VALUES ($1, 'u_001', 'Sprint planning', $2, $3) RETURNING id",
    [roomId, start, end],
  );
const count = async () => Number((await db.pool.query("SELECT count(*) AS n FROM booking")).rows[0].n);

beforeEach(async () => {
  await db.pool.query("DELETE FROM booking");
});

describe("schema.sql", () => {
  it("stores two touching bookings of one room", async () => {
    await insert("merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    await insert("merapi", "2026-11-05T03:00:00.000Z", "2026-11-05T04:00:00.000Z");
    expect(await count()).toBe(2);
  });

  it("refuses an overlapping booking of the same room with SQLSTATE 23P01", async () => {
    await insert("merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    await expect(insert("merapi", "2026-11-05T02:30:00.000Z", "2026-11-05T03:30:00.000Z")).rejects.toMatchObject({
      code: "23P01",
    });
    expect(await count()).toBe(1);
  });

  it("stores the same range in another room", async () => {
    await insert("merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    await insert("bromo", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    expect(await count()).toBe(2);
  });

  it("refuses a booking whose end is not after its start", async () => {
    await expect(insert("merapi", "2026-11-05T03:00:00.000Z", "2026-11-05T03:00:00.000Z")).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("gives a booking inserted without an id a random lower-case UUID", async () => {
    const { rows } = await insert("kew", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("applying the schema again keeps the bookings", async () => {
    await insert("thames", "2026-11-05T10:00:00.000Z", "2026-11-05T11:00:00.000Z");
    await applySchema(db.pool);
    expect(await count()).toBe(1);
  });
});
