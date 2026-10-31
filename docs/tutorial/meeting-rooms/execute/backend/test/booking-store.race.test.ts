// G5 (PRD v2 Success): 20 simultaneous inserts for one room and time on a pool of 20
// connections. Its own file, so its own database (D8), and its PostgreSQL log lines can be read alone.
import { Pool } from "pg";
import { expect, it } from "vitest";
import type { NewBooking } from "../src/domain.ts";
import { createBookingStore } from "../src/booking-store.ts";
import { testDatabase } from "./db.ts";

const ROUNDS = 10;
const AT_ONCE = 20;
const db = testDatabase();
const attempt = (n: number): NewBooking => ({
  roomId: "merapi",
  accountId: n % 2 === 1 ? "u_001" : "u_002",
  title: `Attempt ${n}`,
  start: new Date("2026-11-05T02:00:00.000Z"),
  end: new Date("2026-11-05T03:00:00.000Z"),
});

it(
  "20 simultaneous inserts for one room and time store one booking and name it nineteen times, ten rounds (G5; PRD v2 Success)",
  async () => {
    const pool = new Pool({ connectionString: db.url, max: AT_ONCE });
    try {
      // Every connection is open before the first round, so no round's time includes connecting.
      await Promise.all(Array.from({ length: AT_ONCE }, () => pool.query("SELECT 1")));
      const s = createBookingStore(pool);
      const times: number[] = [];
      for (let round = 0; round < ROUNDS; round++) {
        await db.resetBookings();
        const began = performance.now();
        const outcomes = await Promise.allSettled(Array.from({ length: AT_ONCE }, (_, i) => s.insert(attempt(i + 1))));
        const ms = performance.now() - began;
        times.push(ms);
        expect(outcomes.filter((o) => o.status === "rejected")).toEqual([]);
        const results = outcomes.flatMap((o) => (o.status === "fulfilled" ? [o.value] : []));
        const stored = results.flatMap((r) => (r.ok ? [r.value] : []));
        expect(stored).toHaveLength(1);
        expect(results.filter((r) => !r.ok)).toEqual(Array(AT_ONCE - 1).fill({ ok: false, error: stored[0] }));
        expect(Number((await db.pool.query("SELECT count(*) AS n FROM booking")).rows[0].n)).toBe(1);
        expect(ms).toBeLessThan(1000);
      }
      console.log(`G5 rounds (ms): ${times.map((t) => t.toFixed(1)).join(", ")}`);
    } finally {
      await pool.end();
    }
  },
  30_000,
);
