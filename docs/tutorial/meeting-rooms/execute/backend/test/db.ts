// One PostgreSQL database per test file, on the Compose service, created with
// the schema and dropped after the file (D8). Tests never touch meeting_rooms.
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { DEFAULT_DATABASE_URL, applySchema, createPool } from "../src/db.ts";
import type { GivenBooking } from "./replay.ts";

export type TestDatabase = {
  readonly name: string;
  readonly pool: Pool;
  /** Deletes every booking. */
  resetBookings(): Promise<void>;
  /** Inserts a fixture's given bookings directly, with their ids, each account username mapped to its account id. */
  seedBookings(given: readonly GivenBooking[]): Promise<void>;
  drop(): Promise<void>;
};

/** The Compose service's address with another database name. DATABASE_URL is ignored: tests use that service only. */
const urlFor = (database: string): string => {
  const url = new URL(DEFAULT_DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
};

const onMaintenance = async <T>(work: (admin: Pool) => Promise<T>): Promise<T> => {
  const admin = createPool(urlFor("postgres"));
  try {
    return await work(admin);
  } finally {
    await admin.end();
  }
};

const accountIdOf = (username: string): string => {
  const account = ACCOUNTS.find((a) => a.username === username);
  if (account === undefined) throw new Error(`given booking names ${username}, who is no built-in account`);
  return account.id;
};

export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${randomBytes(16).toString("hex")}`;
  await onMaintenance((admin) => admin.query(`CREATE DATABASE ${name}`));
  const pool = createPool(urlFor(name));
  await applySchema(pool);
  return {
    name,
    pool,
    async resetBookings() {
      await pool.query("DELETE FROM booking");
    },
    async seedBookings(given) {
      // Every account is resolved before the first insert, so a bad fixture inserts nothing.
      const rows = given.map((b) => [b.id, b.roomId, accountIdOf(b.account), b.title, b.start, b.end]);
      for (const row of rows) {
        // Instants go in as their ISO strings (D5).
        await pool.query(
          "INSERT INTO booking (id, room_id, account_id, title, start_at, end_at) VALUES ($1, $2, $3, $4, $5, $6)",
          row,
        );
      }
    },
    async drop() {
      await pool.end();
      // No FORCE: a connection a test left open fails the drop loudly (55006).
      await onMaintenance((admin) => admin.query(`DROP DATABASE IF EXISTS ${name}`));
    },
  };
}

/** This file's database: created before its tests, dropped after them. */
export function testDatabase(): Omit<TestDatabase, "drop"> {
  let db: TestDatabase | undefined;
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(async () => {
    await db?.drop();
  });
  const current = (): TestDatabase => {
    if (db === undefined) throw new Error("testDatabase() is read before its beforeAll ran");
    return db;
  };
  return {
    get name() {
      return current().name;
    },
    get pool() {
      return current().pool;
    },
    resetBookings: () => current().resetBookings(),
    seedBookings: (given) => current().seedBookings(given),
  };
}
