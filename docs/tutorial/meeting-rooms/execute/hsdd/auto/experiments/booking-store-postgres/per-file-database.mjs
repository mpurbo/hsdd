// Probe for D8 (S16): how long one test file's own database takes on the Compose service:
// CREATE DATABASE, the schema (btree_gist and the booking table), then DROP DATABASE.
// Run through run-per-file-database.sh, which starts and removes the database.
import pg from "pg";

const ADMIN = process.env.PROBE_DATABASE_URL ?? "postgres://probe:probe@127.0.0.1:55499/probe";
const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  CREATE TABLE booking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id text NOT NULL, account_id text NOT NULL, title text NOT NULL,
    start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
    CHECK (start_at < end_at),
    EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  );`;

const admin = new pg.Client({ connectionString: ADMIN });
await admin.connect();
const times = [];
for (let i = 0; i < 10; i++) {
  const name = `probe_file_${process.pid}_${i}`;
  const t0 = performance.now();
  await admin.query(`CREATE DATABASE ${name}`);
  const db = new pg.Client({ connectionString: ADMIN.replace(/\/[^/]*$/, `/${name}`) });
  await db.connect();
  await db.query(SCHEMA);
  const t1 = performance.now();
  await db.end();
  await admin.query(`DROP DATABASE ${name}`);
  times.push({ create: t1 - t0, total: performance.now() - t0 });
}
await admin.end();
const max = (k) => Math.max(...times.map((t) => t[k])).toFixed(0);
const mean = (k) => (times.reduce((s, t) => s + t[k], 0) / times.length).toFixed(0);
console.log(`5. a database per test file: 10 times CREATE DATABASE + schema, then DROP DATABASE`);
console.log(`   create + schema: mean ${mean("create")} ms, max ${max("create")} ms; with drop: mean ${mean("total")} ms, max ${max("total")} ms`);
