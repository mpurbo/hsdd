// The booking store (D5, D6) on a real PostgreSQL 17, in a database of this file's own (D8).
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import type { NewBooking } from "../src/domain.ts";
import { createBookingStore } from "../src/booking-store.ts";
import { testDatabase } from "./db.ts";

const at = (iso: string): Date => new Date(iso);
const booking = (over: Partial<NewBooking> = {}): NewBooking => ({
  roomId: "merapi", accountId: "u_001", title: "Sprint planning",
  start: at("2026-11-05T02:00:00.000Z"), end: at("2026-11-05T03:00:00.000Z"), ...over,
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const db = testDatabase();
const store = () => createBookingStore(db.pool);
const count = async () => Number((await db.pool.query("SELECT count(*) AS n FROM booking")).rows[0].n);
beforeEach(() => db.resetBookings());

describe("insert", () => {
  it("stores touching bookings of one room (G3)", async () => {
    const s = store();
    const results = [
      await s.insert(booking()),
      await s.insert(booking({ start: at("2026-11-05T03:00:00.000Z"), end: at("2026-11-05T04:00:00.000Z") })),
      await s.insert(booking({ start: at("2026-11-05T01:00:00.000Z"), end: at("2026-11-05T02:00:00.000Z") })),
    ];
    expect(results.map((r) => r.ok)).toEqual([true, true, true]);
  });

  it("returns the stored booking with a new lower-case UUID", async () => {
    const result = await store().insert(booking());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toMatch(UUID);
    expect(result.value).toEqual({ id: result.value.id, ...booking() });
  });

  it("keeps a title exactly as sent, never trimmed", async () => {
    const title = "  Rapat \u{1F680} tim \u{20000}  ";
    const result = await store().insert(booking({ title }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe(title);
    expect((await store().find(result.value.id))?.title).toBe(title);
  });

  it("a booking of another room never blocks (G4)", async () => {
    await store().insert(booking());
    expect((await store().insert(booking({ roomId: "bromo" }))).ok).toBe(true);
  });

  it("refuses an overlap naming the earliest overlapping booking (G6)", async () => {
    const s = store();
    await s.insert(booking({ start: at("2026-11-05T03:00:00.000Z"), end: at("2026-11-05T04:00:00.000Z") }));
    const earlier = await s.insert(booking());
    expect(earlier.ok).toBe(true);
    if (!earlier.ok) return;
    const refused = await s.insert(
      booking({ start: at("2026-11-05T02:30:00.000Z"), end: at("2026-11-05T03:30:00.000Z") }),
    );
    expect(refused).toEqual({ ok: false, error: earlier.value });
    expect(await count()).toBe(2);
  });

  it("a booking of another account blocks and is named", async () => {
    const s = store();
    const theirs = await s.insert(booking({ accountId: "u_002" }));
    expect(theirs.ok).toBe(true);
    if (!theirs.ok) return;
    const refused = await s.insert(
      booking({ start: at("2026-11-05T02:15:00.000Z"), end: at("2026-11-05T02:45:00.000Z") }),
    );
    expect(refused).toEqual({ ok: false, error: theirs.value });
  });
});

describe("find", () => {
  it("find reads one booking", async () => {
    const stored = await store().insert(booking());
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(await store().find(stored.value.id)).toEqual(stored.value);
  });

  it("find gives undefined for an id that names no booking", async () => {
    expect(await store().find("00000000-0000-4000-8000-000000000999")).toBeUndefined();
  });

  it("find gives undefined for an id that is not a lower-case UUID", async () => {
    const stored = await store().insert(booking());
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const id = stored.value.id;
    for (const bad of ["not-a-uuid", id.toUpperCase(), id.replaceAll("-", "")]) {
      await expect(store().find(bad)).resolves.toBeUndefined();
    }
  });
});

describe("zones", () => {
  it.each(["Europe/London", "Asia/Jakarta"])(
    "instants read back unchanged under TZ=Asia/Kolkata with session TimeZone %s (D5)",
    async (zone) => {
      expect(new Date("2026-03-29T00:00:00.000Z").getTimezoneOffset()).toBe(-330);
      const pool = new Pool({ connectionString: db.url, options: `-c TimeZone=${zone}` });
      try {
        expect((await pool.query("SHOW TimeZone")).rows[0].TimeZone).toBe(zone);
        const s = createBookingStore(pool);
        const start = "2026-03-29T00:45:00.000Z";
        const end = "2026-03-29T01:15:00.000Z";
        const stored = await s.insert(booking({ start: at(start), end: at(end) }));
        expect(stored.ok).toBe(true);
        if (!stored.ok) return;
        const found = await s.find(stored.value.id);
        expect(found?.start.toISOString()).toBe(start);
        expect(found?.end.toISOString()).toBe(end);
      } finally {
        await pool.end();
      }
    },
  );

  it("no SQL in the store converts an instant to a zone (ADR-002 Decision 2)", () => {
    const text = readFileSync(new URL("../src/booking-store.ts", import.meta.url), "utf8");
    for (const forbidden of [
      /AT\s+TIME\s+ZONE/i, /\btimezone\s*\(/i, /::\s*timestamp(?!tz)\b/i, /::\s*date\b/i, /::\s*time\b/i, /\bTimeZone\b/,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });
});
