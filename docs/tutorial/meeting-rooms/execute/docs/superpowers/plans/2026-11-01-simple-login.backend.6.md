# simple-login.backend.6: The Booking Store on PostgreSQL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `createBookingStore(pool)` in `backend/src/booking-store.ts` implements phase 4's `BookingStore` on PostgreSQL 17 per D5, D6, D7 and D10, proven against a real database.

**Architecture:** One factory closing over a `pg` `Pool`. Every SQL statement is a module constant; rows map to `StoredBooking` through one pure function. `insert` and `remove` each run one transaction that first takes `pg_advisory_xact_lock(hashtext(room_id))`; `insert` reads the earliest overlapping booking under that lock and inserts only when there is none, and answers a `23P01` or `40P01` by running the same locked read again. Instants enter SQL as `toISOString()` strings (D5); nothing converts to a zone.

**Tech Stack:** TypeScript on Node.js 24, `pg` 8 with `@types/pg`, Vitest 5, PostgreSQL 17 from `backend/compose.yaml`.

**Spec:** `hsdd-context/superpowers/simple-login.backend.6.md` (it embeds `hsdd-context/simple-login.backend.6.md`). Read both before any task.

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix backend run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.6.verification.md from
   hsdd/templates/verification.md at full-review depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier full-review: design rationale for every non-obvious choice; full verification doc.
9. Every claim that a task is done, a test passes or a defect is fixed
   follows superpowers:verification-before-completion: it cites the command
   that was run and the output it printed, never an inference from the diff.
10. A test that fails when it should pass, or behavior the plan did not
    expect, goes through superpowers:systematic-debugging: find the root
    cause before any fix.
11. When writing mermaid diagrams, use mermaid-pastel-style.

Project rules for every task:

- Work only inside the worktree `<repo>`; `cd` into it in every shell command.
- Never stop or restart the Compose service: another phase's agent uses it at the same time. `npm --prefix backend run db:up` is safe (it leaves a running service alone).
- Run single test files with `cd backend && TZ=Asia/Kolkata npx vitest run test/<file>`; the gate's zone (`Asia/Kolkata`) applies to every run.
- Commit with the repository's configured identity; end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- No em dash character (U+2014) in any file written, and never the hyphenated compound of "load" and "bearing".
- Touch only `backend/src/booking-store.ts`, `backend/test/booking-store.test.ts`, `backend/test/booking-store.race.test.ts`, and the one addition to `backend/test/db.ts` in Task 1.

## Design rationale

- **Lock, then read, then insert (D7).** Under READ COMMITTED each statement takes a fresh snapshot, and PostgreSQL makes a commit visible before it releases the committer's locks, so the read after `pg_advisory_xact_lock` sees every booking of that room committed by an earlier holder. The exclusion constraint (D6) stays the invariant; the lock turns contention into a queue instead of `23P01` and `deadlock detected`.
- **The contention answer is the same locked attempt again.** After a `23P01` or `40P01` the transaction is rolled back and the whole attempt reruns: lock, earliest overlapping booking, else insert. Rerunning under the lock answers "never thrown" without the experiment's failure (a `40P01` loser re-reading too early and finding no winner): the rerun waits for the room's lock, so the winner is committed before the read. Only a writer that skips the lock can cause either code; the store makes at most 3 attempts and then throws the last error, so such a writer cannot spin it forever.
- **`find` answers `undefined` for a string that is not a lower-case UUID**, without a query: PostgreSQL would raise `22P02` for it, and booking-api@v1 says a `{id}` that is not a UUID names no booking. The phase 5 rules refuse it first; the store does not rely on that.
- **D10 clamps both bounds of `overlapping`.** Each bound before `0001-01-01T00:00:00.000Z` goes to SQL as that instant; two clamped bounds make an empty range, which overlaps nothing.
- **Lists are ordered by `start_at`.** `overlapping` per the Scope; `notEndedOf` the same, so the store's lists are deterministic. Ties across rooms are phase 5's views' business.
- **`remove` locks on the booking's `roomId`** as passed, and deletes by `id` alone; its caller passes a booking that `find` returned.

## Review Focus

1. `find` given `not-a-uuid`, an upper-case UUID, or a UUID without hyphens: `undefined`, never a thrown `22P02` (Task 1).
2. A booking of another account blocks an overlapping insert and is named: the store's overlap is per room, never per account (Task 1).
3. A title with an emoji, a non-BMP character and leading and trailing spaces comes back exactly as stored, never trimmed (Task 1).
4. `overlapping` with both bounds before year 1 (`0000-01-01` to `0000-06-01`, and a year `-000001` bound): `[]`, never a thrown `22008` (Task 2).
5. Two `remove` calls for one booking at once: exactly one `true` and one `false`, and no error (Task 3).

---

### Task 1: insert and find on PostgreSQL

**Files:**
- Create: `backend/src/booking-store.ts`
- Create: `backend/test/booking-store.test.ts`
- Modify: `backend/test/db.ts` (add `url`)

**Interfaces:**
- Consumes: `BookingStore`, `NewBooking`, `StoredBooking`, `Result` from `backend/src/domain.ts`; `testDatabase()` from `backend/test/db.ts`; `Pool` from `pg`.
- Produces: `export function createBookingStore(pool: Pool): BookingStore` in `backend/src/booking-store.ts` (all five methods present from this task on; `overlapping`, `notEndedOf` and `remove` may throw `new Error("not implemented")` until Tasks 2 and 3). `TestDatabase` gains `readonly url: string`, the connection URL of the file's database, also exposed by `testDatabase()`'s returned object as a getter.

Test helpers, local to `backend/test/booking-store.test.ts`:

```ts
const at = (iso: string): Date => new Date(iso);
const booking = (over: Partial<NewBooking> = {}): NewBooking => ({
  roomId: "merapi", accountId: "u_001", title: "Sprint planning",
  start: at("2026-11-05T02:00:00.000Z"), end: at("2026-11-05T03:00:00.000Z"), ...over,
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const db = testDatabase();
const store = () => createBookingStore(db.pool);
beforeEach(() => db.resetBookings());
```

- [ ] **Step 1: Write the failing tests** in `describe("insert")`, `describe("find")` and `describe("zones")`:
  - `stores touching bookings of one room (G3)`: insert 02:00 to 03:00, then 03:00 to 04:00, then 01:00 to 02:00 in `merapi`; all three `ok: true`.
  - `returns the stored booking with a new lower-case UUID`: `insert(booking())` gives `{ ok: true, value }` with `value.id` matching `UUID` and `value` equal to `{ id: value.id, ...booking() }` (instants compared with `toEqual` on `Date`).
  - `keeps a title exactly as sent, never trimmed`: title `"  Rapat \u{1F680} tim \u{20000}  "` round-trips through `insert` and `find`.
  - `a booking of another room never blocks (G4)`: the same range in `bromo` after `merapi` is `ok: true`.
  - `refuses an overlap naming the earliest overlapping booking (G6)`: insert 03:00 to 04:00, then 02:00 to 03:00 (in that order); `insert` of 02:30 to 03:30 gives `{ ok: false, error }` with `error` equal to the 02:00 to 03:00 stored booking; the table holds 2 rows.
  - `a booking of another account blocks and is named`: `u_002` books 02:00 to 03:00; `u_001`'s 02:15 to 02:45 gives `ok: false` naming `u_002`'s booking.
  - `find reads one booking`: `find(stored.id)` equals the stored booking.
  - `find gives undefined for an id that names no booking`: `find("00000000-0000-4000-8000-000000000999")` is `undefined`.
  - `find gives undefined for an id that is not a lower-case UUID`: for each of `"not-a-uuid"`, the stored id upper-cased, the stored id without hyphens: `undefined`, and the promise does not reject.
  - `it.each(["Europe/London", "Asia/Jakarta"])("instants read back unchanged under TZ=Asia/Kolkata with session TimeZone %s (D5)")`: first `expect(new Date("2026-03-29T00:00:00.000Z").getTimezoneOffset()).toBe(-330)`; a `new Pool({ connectionString: db.url, options: \`-c TimeZone=${zone}\` })` whose `SHOW TimeZone` returns `zone`; through `createBookingStore` on that pool, insert `2026-03-29T00:45:00.000Z` to `2026-03-29T01:15:00.000Z` (London's clock change) and `find` it; `start.toISOString()` and `end.toISOString()` equal the strings sent; the pool is ended in `finally`.
  - `no SQL in the store converts an instant to a zone (ADR-002 Decision 2)`: the text of `backend/src/booking-store.ts` matches none of `/AT\s+TIME\s+ZONE/i`, `/\btimezone\s*\(/i`, `/::\s*timestamp(?!tz)\b/i`, `/::\s*date\b/i`, `/::\s*time\b/i`, `/\bTimeZone\b/`.

- [ ] **Step 2: Run them and record the failure**

Run: `cd backend && npm run db:up && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts`
Expected: FAIL, the module `../src/booking-store.ts` cannot be resolved. Keep the output for the report.

- [ ] **Step 3: Add `url` to `TestDatabase`** in `backend/test/db.ts`: `readonly url: string` on the type, `url: urlFor(name)` in `createTestDatabase`'s result, `get url() { return current().url; }` in `testDatabase()`'s.

- [ ] **Step 4: Implement `createBookingStore(pool)` with `insert` and `find`** in `backend/src/booking-store.ts`:
  - One `COLUMNS` constant `id, room_id, account_id, title, start_at, end_at` and a pure `toStoredBooking(row): StoredBooking`.
  - Every instant parameter is `date.toISOString()` with an explicit `::timestamptz` cast in SQL (D5).
  - `insert`: one client from `pool.connect()`, `BEGIN`; the earliest overlapping booking `SELECT {COLUMNS} FROM booking WHERE room_id = $1 AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)') ORDER BY start_at LIMIT 1`; if a row, `COMMIT` and return it as the error; else `INSERT ... RETURNING {COLUMNS}` (no id: `gen_random_uuid()` gives it), `COMMIT`, return it. On any error `ROLLBACK` and rethrow; release the client in `finally`, passing the error to `release` when `ROLLBACK` itself failed. No advisory lock yet: Task 4 adds it with its tests.
  - `find(id)`: `undefined` without a query unless `id` matches `UUID`; else `SELECT {COLUMNS} FROM booking WHERE id = $1`.
  - The file header says what the module is (one comment, the style of `backend/src/db.ts`).

- [ ] **Step 5: Run the tests and the type check**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts && npx tsc --noEmit`
Expected: every test in the file passes; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/booking-store.ts backend/test/booking-store.test.ts backend/test/db.ts
git commit -m "backend.6: the booking store's insert and find on PostgreSQL (D5, D6, G3, G4, G6)"
```

### Task 2: overlapping and notEndedOf

**Files:**
- Modify: `backend/src/booking-store.ts`
- Modify: `backend/test/booking-store.test.ts`

**Interfaces:**
- Consumes: Task 1's `createBookingStore`, `booking()`, `at()`, `db.url`.
- Produces: `overlapping(from: Date, to: Date): Promise<readonly StoredBooking[]>` and `notEndedOf(accountId: string, now: Date): Promise<readonly StoredBooking[]>`, both ordered by `start_at`.

- [ ] **Step 1: Write the failing tests** in `describe("overlapping")`, `describe("notEndedOf")` and `describe("restart")`:
  - `lists every room's bookings that overlap [from, to), earliest start first (G13 input)`: store `kew` 05:00 to 06:00, `merapi` 03:00 to 04:00, `thames` 01:00 to 02:00 (as `u_002`), `bromo` 06:00 to 07:00; `overlapping(at("...T01:30:00.000Z"), at("...T06:00:00.000Z"))` equals the `thames`, `merapi`, `kew` bookings in that order (the `bromo` one starts at `to`).
  - `excludes a booking that ends at from (half-open)`: a booking 01:00 to 02:00 is absent from `overlapping(02:00, 03:00)`.
  - `answers a range from 0000-01-01T00:00:00.000Z like any range (D10)`: with the 02:00 to 03:00 booking stored, `overlapping(at("0000-01-01T00:00:00.000Z"), at("2026-11-05T02:15:00.000Z"))` equals `[it]`; `overlapping(at("-000001-01-01T00:00:00.000Z"), at("2026-11-06T00:00:00.000Z"))` equals `[it]`.
  - `a range wholly before year 1 overlaps nothing`: `overlapping(at("0000-01-01T00:00:00.000Z"), at("0000-06-01T00:00:00.000Z"))` resolves to `[]`.
  - `notEndedOf lists the account's bookings whose end is after now (G14)`: with `now = at("2026-11-05T03:00:00.000Z")`, `u_001` holds one 02:00 to 03:00 (ended at `now`), one 02:30 to 03:30 in `bromo` (in progress), one 05:00 to 06:00 (ahead); `u_002` holds one 04:00 to 05:00; `notEndedOf("u_001", now)` equals the in-progress then the ahead booking.
  - `a second pool on the same database reads every booking with its id (G17)`: through a store on its own `new Pool({ connectionString: db.url })`, insert three bookings over two rooms and both accounts, then `end()` that pool; a store on a second new pool returns them all from `overlapping(at("2026-11-01T00:00:00.000Z"), at("2026-11-10T00:00:00.000Z"))`, ids included, and `find` returns each; the second pool is ended in `finally`.

- [ ] **Step 2: Run them and record the failure**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts`
Expected: FAIL in each new test with `not implemented` (Task 1's placeholders).

- [ ] **Step 3: Implement both methods**
  - `overlapping`: `SELECT {COLUMNS} FROM booking WHERE tstzrange(start_at, end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)') ORDER BY start_at`; each bound passes through a pure `sqlInstant(bound: Date): string` that gives `"0001-01-01T00:00:00.000Z"` for a bound before that instant and `bound.toISOString()` otherwise (D10).
  - `notEndedOf`: `SELECT {COLUMNS} FROM booking WHERE account_id = $1 AND end_at > $2::timestamptz ORDER BY start_at`.

- [ ] **Step 4: Run the tests and the type check**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts && npx tsc --noEmit`
Expected: all pass; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-store.ts backend/test/booking-store.test.ts
git commit -m "backend.6: overlapping and notEndedOf (D10, G14, G17)"
```

### Task 3: remove under the room's lock

**Files:**
- Modify: `backend/src/booking-store.ts`
- Modify: `backend/test/booking-store.test.ts`

**Interfaces:**
- Consumes: Task 1's store and helpers.
- Produces: `remove(booking: StoredBooking): Promise<boolean>`. A test helper, local to the test file, that Task 4 reuses:

```ts
/** Resolves once a session of this database waits on a lock of that kind; throws after 5 s. */
async function blockedOn(waitEvent: "advisory" | "transactionid"): Promise<void>
```

It polls `SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = $1` on `db.pool` every 10 ms.

- [ ] **Step 1: Write the failing tests** in `describe("remove")`:
  - `removes the booking, and the next insert books the same range (G11)`: `remove(stored)` is `true`; `find(stored.id)` is `undefined`; `insert` of the same range is `ok: true` with an id different from `stored.id`.
  - `gives false when the booking was already gone`: a second `remove(stored)` is `false`.
  - `two removes of one booking at once give one true and one false`: `Promise.all([remove(stored), remove(stored)])` sorted equals `[false, true]`.
  - `waits for the room's lock`: a client from `db.pool.connect()` runs `BEGIN` and `SELECT pg_advisory_xact_lock(hashtext('merapi'))`; `remove(stored)` of a `merapi` booking is started, not awaited; `await blockedOn("advisory")`; the booking is still in the table; the client `COMMIT`s; the `remove` resolves `true`. The client is released in `finally` (after `ROLLBACK` if the test failed midway).

- [ ] **Step 2: Run them and record the failure**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts -t remove`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement `remove`**: one client, `BEGIN`, `SELECT pg_advisory_xact_lock(hashtext($1))` with `booking.roomId`, `DELETE FROM booking WHERE id = $1`, `COMMIT`, return `rowCount === 1`; the same rollback and release handling as `insert`. Factor the transaction handling into one private `inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>` and use it in `insert` too, and the lock statement into one constant `LOCK_ROOM`.

- [ ] **Step 4: Run the tests and the type check**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts && npx tsc --noEmit`
Expected: all pass; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-store.ts backend/test/booking-store.test.ts
git commit -m "backend.6: remove under the room's lock (D7, G11)"
```

### Task 4: insert under the room's lock, contention answered by the re-read

**Files:**
- Modify: `backend/src/booking-store.ts`
- Modify: `backend/test/booking-store.test.ts`
- Create: `backend/test/booking-store.race.test.ts`

**Interfaces:**
- Consumes: Task 1's store, Task 3's `blockedOn` and `LOCK_ROOM`, `db.url`.
- Produces: no new names; `insert` gains D7's lock and its contention answer.

- [ ] **Step 1: Write the failing tests.** In `backend/test/booking-store.test.ts`, `describe("insert under contention")`; each uses a second client `other` from `db.pool.connect()`, released in `finally` after a `ROLLBACK` when its transaction is still open:
  - `reads the room's bookings only once it holds the room's lock (D7)`: `other` runs `BEGIN`, `SELECT pg_advisory_xact_lock(hashtext('merapi'))`, and inserts row X (`merapi`, `u_002`, 02:00 to 03:00) with plain SQL; `insert` of 02:30 to 03:30 is started; `await blockedOn("advisory")`; `other` `COMMIT`s; the `insert` gives `ok: false` naming X.
  - `answers a 23P01 by the re-read, naming the booking it met`: `other` runs `BEGIN` and inserts X without the lock; `insert` of 02:30 to 03:30 is started; `await blockedOn("transactionid")`; `other` `COMMIT`s; the `insert` gives `ok: false` naming X, and the table holds 1 row.
  - `answers a 40P01 by the re-read, naming the booking it met`: `other` runs `BEGIN`, `SET LOCAL deadlock_timeout = '10s'` (so the store's session, at the server's 1 s, is the one PostgreSQL aborts), and inserts X without the lock; `insert` of 02:30 to 03:30 is started; `await blockedOn("transactionid")`; `other` runs `SELECT pg_advisory_xact_lock(hashtext('merapi'))` (a deadlock with the store's transaction) and then `COMMIT`; the `insert` gives `ok: false` naming X. Give this test a 10 s timeout.

  In `backend/test/booking-store.race.test.ts` (its own file, so its PostgreSQL log lines can be read alone):
  - `20 simultaneous inserts for one room and time store one booking and name it nineteen times, ten rounds (G5; PRD v2 Success)`: one `new Pool({ connectionString: db.url, max: 20 })`, warmed with 20 simultaneous `SELECT 1`, ended in `finally`; a store on it; each of 10 rounds: `db.resetBookings()`, then `Promise.allSettled` of 20 `insert`s of `merapi` 2026-11-05 02:00 to 03:00, titles `Attempt 1` to `Attempt 20`, accounts alternating `u_001` and `u_002`; every outcome is fulfilled; exactly one is `ok: true`; the other 19 are `ok: false` with `error` equal to the winner's `value`; the table holds exactly 1 row; the round's wall-clock time, from `performance.now()`, is under 1000 ms. After the rounds, print one line `G5 rounds (ms): ...` with the ten times, for the verification doc. Give the test a 30 s timeout.

- [ ] **Step 2: Run them and record the failure**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts test/booking-store.race.test.ts`
Expected: FAIL: `blockedOn("advisory")` times out in the first test; the 23P01 and 40P01 tests reject with those codes; the race test sees rejected outcomes (`23P01`).

- [ ] **Step 3: Implement D7's lock and the contention answer in `insert`**

```ts
// One attempt, inside inTransaction: LOCK_ROOM with roomId, then the earliest
// overlapping booking, else the INSERT. The answer to contention is the attempt again.
const MAX_ATTEMPTS = 3;
const isContention = (error: unknown): boolean =>
  typeof error === "object" && error !== null && ["23P01", "40P01"].includes((error as { code?: unknown }).code as string);
for (let attempt = 1; ; attempt++) {
  try { return await inTransaction((client) => attemptInsert(client, booking)); }
  catch (error) { if (!isContention(error) || attempt === MAX_ATTEMPTS) throw error; }
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts test/booking-store.race.test.ts && npx tsc --noEmit`
Expected: all pass; the race test prints ten round times, each under 1000 ms; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-store.ts backend/test/booking-store.test.ts backend/test/booking-store.race.test.ts
git commit -m "backend.6: insert under the room's lock; 23P01 and 40P01 answered by the re-read (D7, G5)"
```

### Task 5: Gate and verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.6.verification.md`

- [ ] **Step 1: Run the gate from a clean install** and keep its output.

Run: `rm -rf backend/node_modules backend/package-lock.json && npm --prefix backend install && npm --prefix backend run gate`
Expected: exit 0; 16 test files pass (the 14 before this phase plus `booking-store.test.ts` and `booking-store.race.test.ts`).

- [ ] **Step 2: Record per-file test counts**: `cd backend && TZ=Asia/Kolkata npx vitest run --reporter=json --outputFile=<scratch>/after.json`, then list each file's test count.

- [ ] **Step 3: Run the 20-at-once file alone and read PostgreSQL's log for its window**

Run: `T=$(date -u +%Y-%m-%dT%H:%M:%SZ); cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.race.test.ts; docker-compose -f compose.yaml logs --since "$T" postgres | grep -c "deadlock detected"`
Expected: the test passes with ten round times under 1000 ms; the count is `0`. Note that the 40P01 test in `booking-store.test.ts` provokes one `deadlock detected` on purpose, so a whole-gate log shows one per gate run, from that test's statements.

- [ ] **Step 4: Check that no store function takes or returns a zone or a local time**: `grep -n "Date\|string" backend/src/booking-store.ts` shows instants only as `Date` and their `toISOString()` strings.

- [ ] **Step 5: Write `hsdd/verify/simple-login.backend.6.verification.md`** from `hsdd/templates/verification.md` at full-review depth: Commands to run, Expected output, Observed (dated, with the gate's per-file counts before and after, the ten round times, the log count, and for each task the failing output its first step recorded), Outstanding, Learnings (each with one disposition, or `- none`), Metrics. Leave `## Sign-off` exactly as the template has it. The heading uses ` - ` between the id and the name, since the project's prose forbids U+2014.

- [ ] **Step 6: Commit**

```bash
git add hsdd/verify/simple-login.backend.6.verification.md
git commit -m "backend.6: verification doc"
```
