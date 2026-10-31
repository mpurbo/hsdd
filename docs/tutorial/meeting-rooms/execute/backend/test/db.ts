// One PostgreSQL database per test file, on the Compose service, created with
// the schema and dropped after the file (D8). Tests never touch meeting_rooms.
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll } from "vitest";
import { DEFAULT_DATABASE_URL, applySchema, createPool } from "../src/db.ts";

export type TestDatabase = {
  readonly name: string;
  readonly pool: Pool;
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

export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${randomBytes(16).toString("hex")}`;
  await onMaintenance((admin) => admin.query(`CREATE DATABASE ${name}`));
  const pool = createPool(urlFor(name));
  await applySchema(pool);
  return {
    name,
    pool,
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
  };
}
