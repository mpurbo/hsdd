// Probe for simple-login.backend.7's rewritten `start` test (S24): what D6's schema does when the
// service applies it at a start on a database created empty, and again at a second start on the
// same database, and whether the test file can drop that database while a pool still holds it.
// Run through run.sh, which starts and removes the Compose service.
import pg from "pg";

const ADMIN = process.env.PROBE_DATABASE_URL ?? "postgres://probe:probe@127.0.0.1:55498/probe";
const urlOf = (name) => ADMIN.replace(/\/[^/]*$/, `/${name}`);

// D6, every statement IF NOT EXISTS, sent as one multi-statement query as a service would at start.
const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  CREATE TABLE IF NOT EXISTS booking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id text NOT NULL,
    account_id text NOT NULL,
    title text NOT NULL,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    CHECK (start_at < end_at),
    EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  );`;

// One "start": a new pool on the database, the schema applied, then `serve` run against it.
const startOn = async (url, serve) => {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  const notices = [];
  pool.on("connect", (c) => c.on("notice", (n) => notices.push(`${n.code} ${n.message}`)));
  try {
    await pool.query(SCHEMA);
    return { notices, result: await serve(pool) };
  } finally {
    await pool.end();
  }
};

const tables = (pool) => pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
).then((r) => r.rows.map((x) => x.table_name));

const admin = new pg.Client({ connectionString: ADMIN });
await admin.connect();

// 1. A database created empty: no tables before the first start.
const name = `probe_start_${process.pid}`;
await admin.query(`CREATE DATABASE ${name}`);
{
  const c = new pg.Client({ connectionString: urlOf(name) });
  await c.connect();
  console.log(`1. created ${name} empty; public tables before the first start: ${JSON.stringify(await tables(c))}`);
  await c.end();
}

// 2. First start: the schema applies, no bookings, one booking inserted.
const first = await startOn(urlOf(name), async (pool) => {
  const before = (await pool.query("SELECT count(*)::int AS n FROM booking")).rows[0].n;
  const ins = await pool.query(
    "INSERT INTO booking (room_id, account_id, title, start_at, end_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, start_at",
    ["merapi", "u_001", "Sprint planning", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z"],
  );
  return { tables: await tables(pool), before, id: ins.rows[0].id };
});
console.log(`2. first start: schema applied, tables ${JSON.stringify(first.result.tables)}, bookings before ${first.result.before}, booked id ${first.result.id}, notices ${JSON.stringify(first.notices)}`);

// 3. Second start on the same database: the schema applies again, the booking is still there.
const second = await startOn(urlOf(name), async (pool) =>
  (await pool.query("SELECT id, room_id, start_at FROM booking")).rows.map((r) => ({ id: r.id, room: r.room_id, start: r.start_at.toISOString() })));
const kept = second.result.length === 1 && second.result[0].id === first.result.id;
console.log(`3. second start: rows ${JSON.stringify(second.result)}; same id kept: ${kept}; notices ${JSON.stringify(second.notices)}`);

// 4. Dropping the database while a pool still holds a connection, then after the pool ends.
const holder = new pg.Pool({ connectionString: urlOf(name), max: 1 });
await holder.query("SELECT 1");
try {
  await admin.query(`DROP DATABASE ${name}`);
  console.log("4. DROP DATABASE with an open pool: succeeded");
} catch (e) {
  console.log(`4. DROP DATABASE with an open pool: ${e.code} ${e.message}`);
}
await holder.end();
await admin.query(`DROP DATABASE ${name}`);
console.log("   after the pool ended: DROP DATABASE succeeded");

// 5. DROP DATABASE ... WITH (FORCE) while a pool still holds a connection.
const forced = `${name}_force`;
await admin.query(`CREATE DATABASE ${forced}`);
const holder2 = new pg.Pool({ connectionString: urlOf(forced), max: 1 });
holder2.on("error", (e) => console.log(`   the open pool's client then reports: ${e.code ?? ""} ${e.message}`));
await holder2.query("SELECT 1");
await admin.query(`DROP DATABASE ${forced} WITH (FORCE)`);
console.log("5. DROP DATABASE WITH (FORCE) with an open pool: succeeded");
await new Promise((r) => setTimeout(r, 200));
await holder2.end().catch(() => {});

const left = (await admin.query("SELECT datname FROM pg_database WHERE datname LIKE 'probe_start_%'")).rows.map((r) => r.datname);
console.log(`6. probe databases left: ${JSON.stringify(left)}`);
await admin.end();
