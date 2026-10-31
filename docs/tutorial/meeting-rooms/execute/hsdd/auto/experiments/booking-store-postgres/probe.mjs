// Probe for simple-login.backend's booking store (S16): how PostgreSQL 17, reached through
// node-postgres, answers 20 simultaneous overlapping bookings of one room, and what it does with
// booking-api@v1 values at their edges. Run through run.sh, which starts and removes the database.
import pg from "pg";

const URL = process.env.PROBE_DATABASE_URL ?? "postgres://probe:probe@127.0.0.1:55499/probe";
const ROUNDS = Number(process.env.PROBE_ROUNDS ?? 30);
const RAW_ROUNDS = Number(process.env.PROBE_RAW_ROUNDS ?? 10);
const RETRY_ROUNDS = Number(process.env.PROBE_RETRY_ROUNDS ?? 5);
const MAX_RETRIES = 10;
const N = 20;
const log = (...xs) => console.log(...xs);

const pool = new pg.Pool({ connectionString: URL, max: N + 2 });

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  DROP TABLE IF EXISTS booking;
  CREATE TABLE booking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id text NOT NULL,
    account_id text NOT NULL,
    title text NOT NULL,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    CHECK (start_at < end_at),
    EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  );`;

const INSERT = `INSERT INTO booking (room_id, account_id, title, start_at, end_at)
                VALUES ($1, $2, $3, $4, $5) RETURNING id::text AS id`;
const EARLIEST_OVERLAP = `SELECT id::text AS id FROM booking
                          WHERE room_id = $1 AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
                          ORDER BY start_at LIMIT 1`;

const REQ = ["merapi", "u_001", "Sprint planning", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z"];

// All N clients are checked out first, then every query is sent in the same tick.
const simultaneously = async (attempt) => {
  const clients = await Promise.all(Array.from({ length: N }, () => pool.connect()));
  try {
    return await Promise.all(clients.map((c, i) => attempt(c, i)));
  } finally {
    clients.forEach((c) => c.release());
  }
};

const tally = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const show = (m) => [...m].sort().map(([k, v]) => `${k}=${v}`).join(" ");

// A. A plain INSERT; the exclusion constraint alone decides.
const rawInsert = async (c) => {
  try {
    await c.query(INSERT, REQ);
    return "201";
  } catch (e) {
    return `error ${e.code}`;
  }
};

// A'. The same INSERT; a 23P01 or 40P01 re-reads the earliest overlapping booking, and tries again when none is
// left, giving up after MAX_RETRIES (the first run, unbounded, made no booking for minutes: output-run1-killed.txt).
const insertThenReread = async (c) => {
  let retries = 0;
  for (;;) {
    if (retries > MAX_RETRIES) return { outcome: `gave up after ${MAX_RETRIES} retries`, retries };
    try {
      const { rows } = await c.query(INSERT, REQ);
      return { outcome: "201", id: rows[0].id, retries };
    } catch (e) {
      if (e.code !== "23P01" && e.code !== "40P01") return { outcome: `error ${e.code}`, retries };
      const { rows } = await c.query(EARLIEST_OVERLAP, [REQ[0], REQ[3], REQ[4]]);
      if (rows.length > 0) return { outcome: `409 after ${e.code}`, conflict: rows[0].id, retries };
      retries += 1;
    }
  }
};

// D. One transaction per attempt: a per-room advisory lock, then read, then INSERT.
const lockThenInsert = async (c) => {
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [REQ[0]]);
    const found = await c.query(EARLIEST_OVERLAP, [REQ[0], REQ[3], REQ[4]]);
    if (found.rows.length > 0) {
      await c.query("COMMIT");
      return { outcome: "409", conflict: found.rows[0].id };
    }
    const { rows } = await c.query(INSERT, REQ);
    await c.query("COMMIT");
    return { outcome: "201", id: rows[0].id };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    return { outcome: `error ${e.code}` };
  }
};

const rounds = async (label, attempt, judge, count = ROUNDS) => {
  const outcomes = new Map();
  let bad = 0;
  let retries = 0;
  let maxMs = 0;
  const deadlocks = async () => {
    await new Promise((r) => setTimeout(r, 1100)); // cumulative statistics are flushed about once a second
    return (await pool.query("SELECT deadlocks::int AS n FROM pg_stat_database WHERE datname = current_database()")).rows[0].n;
  };
  const before = await deadlocks();
  for (let r = 0; r < count; r++) {
    await pool.query("TRUNCATE booking");
    const t0 = performance.now();
    const res = await simultaneously(attempt);
    maxMs = Math.max(maxMs, performance.now() - t0);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM booking");
    for (const [k, v] of tally(res.map((x) => (typeof x === "string" ? x : x.outcome)))) outcomes.set(k, (outcomes.get(k) ?? 0) + v);
    retries += res.reduce((s, x) => s + (x.retries ?? 0), 0);
    if (rows[0].n !== 1 || !judge(res)) bad += 1;
    if (process.env.PROBE_VERBOSE) log(`    round ${r + 1}: ${show(tally(res.map((x) => (typeof x === "string" ? x : x.outcome))))}; stored ${rows[0].n}; ${(performance.now() - t0).toFixed(0)} ms`);
  }
  if (count === 0) return;
  const after = await deadlocks();
  log(`  ${label}: ${count} rounds of ${N}; outcomes ${show(outcomes)}; rounds failing the check ${bad}; retries ${retries}; slowest round ${maxMs.toFixed(0)} ms; deadlocks detected ${after - before}`);
};

const oneWinnerNamed = (res) => {
  const wins = res.filter((x) => x.outcome === "201");
  return wins.length === 1 && res.filter((x) => x.outcome !== "201").every((x) => x.conflict === wins[0].id);
};

const edge = async (label, fn) => {
  try {
    log(`  ${label}: ${await fn()}`);
  } catch (e) {
    log(`  ${label}: error ${e.code ?? ""} ${e.message}`);
  }
};

const codePoints = (s) => [...s].map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(" ");

log(`1. ${(await pool.query("SELECT version()")).rows[0].version}`);
log(`   node ${process.version}, pg ${pg.defaults ? "loaded" : "?"}, process TZ=${process.env.TZ ?? "(unset)"}, Intl zone ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
await pool.query(SCHEMA);

log("2. 20 simultaneous requests for the same room and time (PRD v2 Success; booking-api@v1 G5, G6)");
await rounds("D  transaction: per-room advisory lock, read, INSERT", lockThenInsert, oneWinnerNamed);
await rounds("A  plain INSERT, the constraint alone", rawInsert, () => true, RAW_ROUNDS);
await rounds(`A' INSERT, on 23P01 or 40P01 re-read the earliest overlap, retry if none (at most ${MAX_RETRIES})`, insertThenReread, oneWinnerNamed, RETRY_ROUNDS);

log("3. values at the edges of booking-api@v1");
await pool.query("TRUNCATE booking");
await edge("title U+0000 (valid JSON, one code point, matches \\S)", async () => {
  await pool.query(INSERT, ["bromo", "u_001", "a\u0000b", REQ[3], REQ[4]]);
  return "stored";
});
await pool.query("TRUNCATE booking");
await edge("title with an unpaired surrogate U+D800", async () => {
  const sent = "a\uD800b";
  await pool.query(INSERT, ["bromo", "u_001", sent, REQ[3], REQ[4]]);
  const back = (await pool.query("SELECT title FROM booking")).rows[0].title;
  return `sent ${codePoints(sent)}; read back ${codePoints(back)}; equal ${back === sent}`;
});
await pool.query("TRUNCATE booking");
await edge("an emoji title round trip", async () => {
  const sent = "Planning \u{1F4C5}";
  await pool.query(INSERT, ["bromo", "u_001", sent, REQ[3], REQ[4]]);
  const back = (await pool.query("SELECT title FROM booking")).rows[0].title;
  return `equal ${back === sent}`;
});
await edge("instant 0000-01-01T00:00:00.000Z as a text parameter to timestamptz", async () =>
  JSON.stringify((await pool.query("SELECT $1::timestamptz AS t", ["0000-01-01T00:00:00.000Z"])).rows[0].t));
await edge("instant 0001-01-01T00:00:00.000Z as a text parameter to timestamptz", async () =>
  (await pool.query("SELECT $1::timestamptz AS t", ["0001-01-01T00:00:00.000Z"])).rows[0].t.toISOString());
await edge("instant 9999-12-31T23:45:00.000Z as a text parameter to timestamptz", async () =>
  (await pool.query("SELECT $1::timestamptz AS t", ["9999-12-31T23:45:00.000Z"])).rows[0].t.toISOString());
await edge("new Date('0000-01-01T00:00:00.000Z').toISOString()", async () => new Date("0000-01-01T00:00:00.000Z").toISOString());

log("4. instants through the driver");
await pool.query("TRUNCATE booking");
await pool.query(INSERT, ["thames", "u_002", "Design review", "2026-11-05T10:00:00.000Z", "2026-11-05T11:00:00.000Z"]);
await edge("read back under session TimeZone Europe/London, as Date.toISOString()", async () => {
  const c = new pg.Client({ connectionString: URL, options: "-c TimeZone=Europe/London" });
  await c.connect();
  const { rows } = await c.query("SELECT start_at, end_at FROM booking");
  await c.end();
  return `${rows[0].start_at.toISOString()} to ${rows[0].end_at.toISOString()}`;
});
await edge("read back under session TimeZone Asia/Jakarta, as Date.toISOString()", async () => {
  const c = new pg.Client({ connectionString: URL, options: "-c TimeZone=Asia/Jakarta" });
  await c.connect();
  const { rows } = await c.query("SELECT start_at FROM booking");
  await c.end();
  return rows[0].start_at.toISOString();
});
await edge("a JS Date parameter (not a string) written, read back", async () => {
  await pool.query("TRUNCATE booking");
  await pool.query(INSERT, ["kew", "u_002", "x", new Date("2027-03-28T00:45:00.000Z"), new Date("2027-03-28T01:15:00.000Z")]);
  const { rows } = await pool.query("SELECT start_at, end_at FROM booking");
  return `${rows[0].start_at.toISOString()} to ${rows[0].end_at.toISOString()}`;
});
await edge("gen_random_uuid()::text is lower case", async () => {
  const ids = (await pool.query("SELECT gen_random_uuid()::text AS id FROM generate_series(1, 200)")).rows.map((r) => r.id);
  return `${ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))} (200 ids, e.g. ${ids[0]})`;
});
await edge("a uuid column given a non-UUID text parameter", async () => {
  await pool.query("SELECT id FROM booking WHERE id = $1", ["not-a-uuid"]);
  return "no error";
});

await pool.end();
