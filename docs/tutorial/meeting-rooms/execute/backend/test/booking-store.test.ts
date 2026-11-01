// The booking store (D5, D6) on a real PostgreSQL 17, in a database of this file's own (D8).
import { readFileSync } from "node:fs";
import { Pool, type PoolClient } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import type { BookingStore, NewBooking } from "../src/domain.ts";
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

/** Resolves once a session of this database waits on a lock of that kind; throws after 5 s. */
async function blockedOn(waitEvent: "advisory" | "transactionid"): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await db.pool.query(
      `SELECT count(*) AS n FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = $1`,
      [waitEvent],
    );
    if (Number(rows[0].n) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`no session waited on a ${waitEvent} lock within 5 s`);
}

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
    for (const bad of ["not-a-uuid", id.replaceAll("-", "")]) {
      await expect(store().find(bad)).resolves.toBeUndefined();
    }
  });

  it("find gives undefined for the upper-cased form of a stored id", async () => {
    const id = "0000000a-0000-4000-8000-00000000000b";
    await db.pool.query(
      `INSERT INTO booking (id, room_id, account_id, title, start_at, end_at)
       VALUES ($1, 'merapi', 'u_001', 'Sprint planning', '2026-11-05T02:00:00Z', '2026-11-05T03:00:00Z')`,
      [id],
    );
    expect(id.toUpperCase()).not.toBe(id);
    expect((await store().find(id))?.id).toBe(id);
    await expect(store().find(id.toUpperCase())).resolves.toBeUndefined();
  });
});

describe("remove", () => {
  const made = async () => {
    const r = await store().insert(booking());
    if (!r.ok) throw new Error("insert refused");
    return r.value;
  };

  it("removes the booking, and the next insert books the same range (G11)", async () => {
    const was = await made();
    expect(await store().remove(was)).toBe(true);
    expect(await store().find(was.id)).toBeUndefined();
    const again = await store().insert(booking());
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.id).not.toBe(was.id);
  });

  it("gives false when the booking was already gone", async () => {
    const was = await made();
    expect(await store().remove(was)).toBe(true);
    expect(await store().remove(was)).toBe(false);
  });

  it("two removes of one booking at once give one true and one false", async () => {
    const was = await made();
    const results = await Promise.all([store().remove(was), store().remove(was)]);
    expect([...results].sort()).toEqual([false, true]);
  });

  it("waits for the room's lock, and deletes only under it (D7)", async () => {
    const was = await made();
    const holder = await db.pool.connect();
    let open = false;
    let removing: Promise<boolean> | undefined;
    try {
      await holder.query("BEGIN");
      open = true;
      await holder.query("SELECT pg_advisory_xact_lock(hashtext('merapi'))");
      removing = store().remove(was);
      await blockedOn("advisory");
      // A remove that deleted before the lock would hold the row's lock now: this fails with 55P03.
      await holder.query("SELECT id FROM booking WHERE id = $1 FOR UPDATE NOWAIT", [was.id]);
      expect(await store().find(was.id)).toEqual(was);
      await holder.query("COMMIT");
      open = false;
      expect(await removing).toBe(true);
    } finally {
      try {
        if (open) await holder.query("ROLLBACK");
      } finally {
        holder.release();
        await removing?.catch(() => undefined);
      }
    }
  }, 10_000);
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

const D = "2026-11-05";
const slot = (from: string, to: string, over: Partial<NewBooking> = {}): NewBooking =>
  booking({ start: at(`${D}T${from}:00.000Z`), end: at(`${D}T${to}:00.000Z`), ...over });
const stored = async (b: NewBooking) => {
  const r = await store().insert(b);
  if (!r.ok) throw new Error("insert refused");
  return r.value;
};

describe("overlapping", () => {
  it("lists every room's bookings that overlap [from, to), earliest start first (G13 input)", async () => {
    const kew = await stored(slot("05:00", "06:00", { roomId: "kew" }));
    const merapi = await stored(slot("03:00", "04:00"));
    const thames = await stored(slot("01:00", "02:00", { roomId: "thames", accountId: "u_002" }));
    await stored(slot("06:00", "07:00", { roomId: "bromo" }));
    expect(await store().overlapping(at(`${D}T01:30:00.000Z`), at(`${D}T06:00:00.000Z`))).toEqual([thames, merapi, kew]);
  });

  it("excludes a booking that ends at from (half-open)", async () => {
    await stored(slot("01:00", "02:00"));
    expect(await store().overlapping(at(`${D}T02:00:00.000Z`), at(`${D}T03:00:00.000Z`))).toEqual([]);
  });

  it("answers a range from 0000-01-01T00:00:00.000Z like any range (D10)", async () => {
    const it1 = await stored(slot("02:00", "03:00"));
    expect(await store().overlapping(at("0000-01-01T00:00:00.000Z"), at("2026-11-05T02:15:00.000Z"))).toEqual([it1]);
    expect(await store().overlapping(at("-000001-01-01T00:00:00.000Z"), at("2026-11-06T00:00:00.000Z"))).toEqual([it1]);
  });

  it("a range wholly before year 1 overlaps nothing", async () => {
    await stored(slot("02:00", "03:00"));
    expect(await store().overlapping(at("0000-01-01T00:00:00.000Z"), at("0000-06-01T00:00:00.000Z"))).toEqual([]);
  });
});

describe("notEndedOf", () => {
  it("notEndedOf lists the account's bookings whose end is after now (G14)", async () => {
    await stored(slot("02:00", "03:00"));
    const inProgress = await stored(slot("02:30", "03:30", { roomId: "bromo" }));
    const ahead = await stored(slot("05:00", "06:00"));
    await stored(slot("04:00", "05:00", { accountId: "u_002", roomId: "kew" }));
    expect(await store().notEndedOf("u_001", at(`${D}T03:00:00.000Z`))).toEqual([inProgress, ahead]);
  });
});

describe("restart", () => {
  it("a second pool on the same database reads every booking with its id (G17)", async () => {
    const first = new Pool({ connectionString: db.url });
    const made = [];
    try {
      const s = createBookingStore(first);
      for (const b of [slot("01:00", "02:00"), slot("01:00", "02:00", { roomId: "bromo", accountId: "u_002" }), slot("03:00", "04:00", { accountId: "u_002" })]) {
        const r = await s.insert(b);
        if (!r.ok) throw new Error("insert refused");
        made.push(r.value);
      }
    } finally {
      await first.end();
    }
    const second = new Pool({ connectionString: db.url });
    try {
      const s = createBookingStore(second);
      const all = await s.overlapping(at("2026-11-01T00:00:00.000Z"), at("2026-11-10T00:00:00.000Z"));
      expect([...all].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...made].sort((a, b) => a.id.localeCompare(b.id)));
      for (const m of made) expect(await s.find(m.id)).toEqual(m);
    } finally {
      await second.end();
    }
  });
});

describe("insert under contention", () => {
  // X: another account's booking of merapi, written by a second client with plain SQL.
  const X = slot("02:00", "03:00", { accountId: "u_002" });
  const later = slot("02:30", "03:30");
  const insertX = async (other: PoolClient) => {
    const { rows } = await other.query<{ id: string }>(
      `INSERT INTO booking (room_id, account_id, title, start_at, end_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz) RETURNING id`,
      [X.roomId, X.accountId, X.title, X.start.toISOString(), X.end.toISOString()],
    );
    return { id: rows[0].id, ...X };
  };

  it("waits for the room's lock, then names the booking committed under it (D7)", async () => {
    const other = await db.pool.connect();
    let open = false;
    let inserting: ReturnType<BookingStore["insert"]> | undefined;
    try {
      await other.query("BEGIN");
      open = true;
      await other.query("SELECT pg_advisory_xact_lock(hashtext('merapi'))");
      const x = await insertX(other);
      inserting = store().insert(later);
      await blockedOn("advisory");
      await other.query("COMMIT");
      open = false;
      expect(await inserting).toEqual({ ok: false, error: x });
    } finally {
      try {
        if (open) await other.query("ROLLBACK");
      } finally {
        other.release();
        await inserting?.catch(() => undefined);
      }
    }
  }, 10_000);

  it("never names a booking whose cancel holds the room's lock (D7)", async () => {
    // Y overlaps later and is committed; `other` cancels it under merapi's lock. A read
    // taken before the lock still sees Y and names it without ever waiting.
    const y = await stored(slot("03:00", "04:00", { accountId: "u_002" }));
    const other = await db.pool.connect();
    let open = false;
    let inserting: ReturnType<BookingStore["insert"]> | undefined;
    try {
      await other.query("BEGIN");
      open = true;
      await other.query("SELECT pg_advisory_xact_lock(hashtext('merapi'))");
      await other.query("DELETE FROM booking WHERE id = $1", [y.id]);
      inserting = store().insert(later);
      await blockedOn("advisory");
      await other.query("COMMIT");
      open = false;
      expect(await inserting).toEqual({ ok: true, value: { id: expect.stringMatching(UUID), ...later } });
      expect(await count()).toBe(1);
    } finally {
      try {
        if (open) await other.query("ROLLBACK");
      } finally {
        other.release();
        // The store's attempt settles inside this test, so a failure never commits into the next one.
        await inserting?.catch(() => undefined);
      }
    }
  }, 10_000);

  it("answers a 23P01 by the re-read, naming the booking it met", async () => {
    const other = await db.pool.connect();
    let open = false;
    let inserting: ReturnType<BookingStore["insert"]> | undefined;
    try {
      await other.query("BEGIN");
      open = true;
      const x = await insertX(other);
      inserting = store().insert(later);
      await blockedOn("transactionid");
      await other.query("COMMIT");
      open = false;
      expect(await inserting).toEqual({ ok: false, error: x });
      expect(await count()).toBe(1);
    } finally {
      try {
        if (open) await other.query("ROLLBACK");
      } finally {
        other.release();
        await inserting?.catch(() => undefined);
      }
    }
  }, 10_000);

  it("answers a 40P01 by the re-read, naming the booking it met", async () => {
    const other = await db.pool.connect();
    let open = false;
    let inserting: ReturnType<BookingStore["insert"]> | undefined;
    try {
      await other.query("BEGIN");
      open = true;
      // The store's session keeps the server's 1 s, so it is the one that finds the cycle and is aborted.
      await other.query("SET LOCAL deadlock_timeout = '10s'");
      const x = await insertX(other);
      inserting = store().insert(later);
      await blockedOn("transactionid");
      // The store holds merapi's lock and waits on X's transaction: this closes the cycle.
      await other.query("SELECT pg_advisory_xact_lock(hashtext('merapi'))");
      await other.query("COMMIT");
      open = false;
      expect(await inserting).toEqual({ ok: false, error: x });
    } finally {
      try {
        if (open) await other.query("ROLLBACK");
      } finally {
        other.release();
        await inserting?.catch(() => undefined);
      }
    }
  }, 10_000);

  it("holds under a session default of SERIALIZABLE: one winner, the rest name it, none rejected", async () => {
    // The lock-then-read order relies on READ COMMITTED, so the store asks for it itself.
    const pool = new Pool({ connectionString: db.url, options: "-c default_transaction_isolation=serializable" });
    try {
      const s = createBookingStore(pool);
      const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => s.insert(later)));
      expect(outcomes.filter((o) => o.status === "rejected")).toEqual([]);
      const results = outcomes.map((o) => (o as PromiseFulfilledResult<Awaited<ReturnType<BookingStore["insert"]>>>).value);
      const winners = results.filter((r) => r.ok);
      expect(winners).toHaveLength(1);
      const winner = (winners[0] as { ok: true; value: { id: string } }).value;
      for (const r of results) if (!r.ok) expect(r.error.id).toBe(winner.id);
      expect(await count()).toBe(1);
    } finally {
      await pool.end();
    }
  }, 20_000);
});
