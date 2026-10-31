// The test database helper (D8): one database per test file, never meeting_rooms.
import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, createPool } from "../src/db.ts";
import { createTestDatabase } from "./db.ts";

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
