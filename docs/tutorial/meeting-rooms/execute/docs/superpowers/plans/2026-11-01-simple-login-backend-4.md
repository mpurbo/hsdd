# simple-login.backend.4 Implementation Plan: Time zones, booking types, PostgreSQL and the booking replay rig

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the accounts their time zone (profile-api@v2 as touched for PRD v2), add the booking types, rooms and error table, run PostgreSQL 17 from `backend/compose.yaml` with its schema and a per-file test database, move the gate to `TZ=Asia/Kolkata` with the database started by the gate, and build the booking-api@v1 replay rig ahead of the phase that produces it. No business logic.

**Architecture:** Values in `src/domain.ts` and `src/rooms.ts`; one effect module `src/db.ts` (pool from a URL, `applySchema`) over `src/schema.sql`; test-side helpers in `test/db.ts` (one database per test file on the Compose service) and `test/replay.ts` (the rig, contract-side, with a pure `judgeResponse`).

**Tech Stack:** Node.js 24, TypeScript 7 (`tsc --noEmit`), Fastify 5, Vitest 5, Ajv 2020, node-postgres (`pg` 8.23, `@types/pg`), PostgreSQL 17 (`postgres:17-alpine`) under Docker Compose through Colima.

**Spec:** hsdd-context/superpowers/simple-login.backend.4.md (its phase-context block is the whole specification).

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 7 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix backend run gate` plus contract replay for profile-api.v2: `npm --prefix backend run replay` (the same run keeps replaying auth-api) and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.4.verification.md from
   hsdd/templates/verification.md at gate-only depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier gate-only: no design discussion in the plan; slim verification doc.
9. Every claim that a task is done, a test passes or a defect is fixed
   follows superpowers:verification-before-completion: it cites the command
   that was run and the output it printed, never an inference from the diff.
10. A test that fails when it should pass, or behavior the plan did not
    expect, goes through superpowers:systematic-debugging: find the root
    cause before any fix.
11. When writing Mermaid, use mermaid-pastel-style.

Environment (this host): packages install per package directory (`npm --prefix backend install`), never globally; only the standalone `docker-compose` exists. Commands run from the repository root. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No U+2014 in any file written.

## Review Focus

1. Test databases left behind or colliding: two files creating databases at once must get different names, never `meeting_rooms` or `meeting_rooms_e2e`, and a dropped one must be gone from `pg_database` (Task 3).
2. A booking-api request path with percent-encoded colons in its query (the contract allows it) must still select `GetRoomsResponse` (Task 6).
3. A `201` whose `id` is an upper-case UUID is not a `BookingId` (the schema's pattern is lower-case) and must be reported (Task 6).
4. A seeded title outside the Basic Multilingual Plane (an emoji) must read back exactly as given (Task 4).
5. `db:up` run when the service is already up returns at once with exit 0, and re-applying the schema to a database that holds bookings keeps them (Task 3).

---

### Task 1: The time zone in the profile (profile-api@v2 as touched for PRD v2)

**Files:**
- Modify: `backend/src/domain.ts` (`Account`)
- Modify: `backend/src/accounts.ts` (`ACCOUNTS`)
- Test: `backend/test/accounts.test.ts`

**Interfaces:**
- Produces: `Account.timeZone: string` (an IANA name, held as data, returned exactly as stored). `Profile` stays `Omit<Account, "password">`.

- [ ] **Step 1: Write the failing test.** In `accounts.test.ts`, rename the key-set test to `"a profile has exactly the seven profile-api@v2 fields"` and expect `["displayName", "email", "id", "memberSince", "phone", "timeZone", "username"]`. The two fixture-equality tests (`me-ayu`, `me-budi` under `profile-api.v2/`) already fail on this tree; keep them.
- [ ] **Step 2: Run it and record the failure.** `npm --prefix backend exec -- vitest run test/accounts.test.ts test/contract.replay.test.ts` from the repo root (or `npx vitest run ...` in `backend/`). Expected: 3 failures in `accounts.test.ts` (key set, `me-ayu`, `me-budi`) and 2 in `contract.replay.test.ts` (`profile-api.v2/me-ayu`, `me-budi`), each missing `timeZone`.
- [ ] **Step 3: Implement.** `Account` gains `timeZone: string` with a one-line doc comment ("IANA name, held as data and returned exactly as stored; the service applies no zone (ADR-002)"). `ACCOUNTS`: `ayu` `"Asia/Jakarta"`, `budi` `"Europe/London"`. `toProfile` is unchanged.
- [ ] **Step 4: Run and see it pass.** Same command. Expected: both files green; then `npx tsc --noEmit` in `backend/` prints nothing.
- [ ] **Step 5: Commit** `backend.4: accounts carry their time zone (profile-api@v2, PRD v2)`.

### Task 2: Booking types, the error table and the rooms

**Files:**
- Modify: `backend/src/domain.ts`
- Create: `backend/src/rooms.ts`
- Test: `backend/test/domain.test.ts`, `backend/test/rooms.test.ts`

**Interfaces:**
- Produces, in `src/domain.ts`:
  - `Room = { id: string; name: string; office: string; timeZone: string; seats: number }`
  - `StoredBooking = { id: string; roomId: string; accountId: string; title: string; start: Date; end: Date }`
  - `NewBooking = Omit<StoredBooking, "id">`
  - `Booking = { id: string; roomId: string; roomName: string; title: string; start: string; end: string }` (booking-api@v1's wire shape; instants as `toISOString()` strings)
  - `ErrorCode` gains `"BOOKING_TOO_LONG" | "BOOKING_STARTED" | "BOOKING_TOO_FAR_AHEAD" | "BOOKING_CONFLICT" | "BOOKING_NOT_FOUND" | "BOOKING_NOT_YOURS"`
  - `BookingErrorCode = Exclude<ErrorCode, "INVALID_CREDENTIALS">`
  - `BOOKING_ERRORS: Readonly<Record<BookingErrorCode, { status: number; message: string }>>`, booking-api@v1's Errors table as data
  - `BookingStore`:
    ```ts
    insert(booking: NewBooking): Promise<Result<StoredBooking, StoredBooking>>; // error: the overlapping booking to name (G6)
    overlapping(from: Date, to: Date): Promise<readonly StoredBooking[]>;
    notEndedOf(accountId: string, now: Date): Promise<readonly StoredBooking[]>;
    find(id: string): Promise<StoredBooking | undefined>;
    remove(booking: StoredBooking): Promise<boolean>; // false when it was already gone
    ```
- Produces, in `src/rooms.ts`: `ROOMS: readonly Room[]`.
- `routes.ts`' auth-api@v1 bodies (`VALIDATION_FAILED` reading `Username and password are required.`) stay as they are.

- [ ] **Step 1: Write the failing tests.**
  `test/domain.test.ts` reads `hsdd/contract/schema/booking-api.schema.json` and every file under `hsdd/contract/fixture/booking-api/` with `readFileSync` (as `accounts.test.ts` does):
  - `"BOOKING_ERRORS holds booking-api@v1's eight codes"`: `Object.keys(BOOKING_ERRORS).sort()` equals `["BOOKING_CONFLICT","BOOKING_NOT_FOUND","BOOKING_NOT_YOURS","BOOKING_STARTED","BOOKING_TOO_FAR_AHEAD","BOOKING_TOO_LONG","UNAUTHORIZED","VALIDATION_FAILED"]`.
  - `"each code's message is the one the schema fixes"`: from every `$defs` entry with `properties.error.properties.code.const`, build `{ code: message.const }`; it equals `Object.fromEntries(Object.entries(BOOKING_ERRORS).map(([c, e]) => [c, e.message]))`.
  - `"each code answers with the status every fixture gives it"`: for every fixture whose `response.body.error.code` is set, `BOOKING_ERRORS[code].status === response.status`; the set of codes seen equals the table's keys.
  - `"auth-api@v1's VALIDATION_FAILED body stays apart from booking-api@v1's"`: `VALIDATION_FAILED.error.message` from `src/routes.ts` is `"Username and password are required."` and `BOOKING_ERRORS.VALIDATION_FAILED.message` is `"The request is not valid."`.
  - `"BookingStore's methods have the shapes the routes will call"`: `expectTypeOf<BookingStore["insert"]>().toEqualTypeOf<(booking: NewBooking) => Promise<Result<StoredBooking, StoredBooking>>>()`, and likewise for the other four signatures above; `expectTypeOf<NewBooking>().toEqualTypeOf<Omit<StoredBooking, "id">>()`; `expectTypeOf<Booking["start"]>().toEqualTypeOf<string>()`; `expectTypeOf<StoredBooking["start"]>().toEqualTypeOf<Date>()`. These fail under `tsc`, not under Vitest.

  `test/rooms.test.ts`:
  - `"the rooms are booking-api@v1's four, in its order"`: `ROOMS` equals the `rooms-on-a-date` fixture's `response.body.rooms` with `bookings` removed from each.
  - `"room ids are unique"`.
- [ ] **Step 2: Run and record the failures.** `npx vitest run test/domain.test.ts test/rooms.test.ts` (fails: modules or exports missing) and `npx tsc --noEmit` (fails: `BookingStore`, `NewBooking`, `StoredBooking`, `Booking` not exported).
- [ ] **Step 3: Implement** the types and `BOOKING_ERRORS` in `domain.ts` (values only, keep its header comment true) and `ROOMS` in `rooms.ts`: `merapi` Merapi, Jakarta, `Asia/Jakarta`, 8; `bromo` Bromo, Jakarta, `Asia/Jakarta`, 4; `thames` Thames, London, `Europe/London`, 10; `kew` Kew, London, `Europe/London`, 4.
- [ ] **Step 4: Run and see it pass.** Both commands of Step 2: Vitest green, `tsc` prints nothing.
- [ ] **Step 5: Commit** `backend.4: booking types, booking-api@v1 error table and the rooms (D3)`.

### Task 3: PostgreSQL 17 on Compose, the schema and a test database per file

**Files:**
- Create: `backend/compose.yaml`, `backend/scripts/db-up.mjs`, `backend/src/schema.sql`, `backend/src/db.ts`, `backend/test/db.ts`
- Modify: `backend/package.json` (scripts `db:up`, `db:down`; dependency `pg`, dev dependency `@types/pg`)
- Test: `backend/test/schema.test.ts`, `backend/test/db.test.ts`

**Interfaces:**
- Produces, in `src/db.ts`:
  - `DEFAULT_DATABASE_URL = "postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms"`
  - `createPool(databaseUrl: string): Pool` (named import `Pool` from `pg`); reads no environment variable and logs nothing
  - `applySchema(pool: Pool): Promise<void>`: runs `src/schema.sql` (read relative to `import.meta.url`) as one simple query
- Produces, in `test/db.ts`:
  - `TestDatabase = { readonly name: string; readonly pool: Pool; drop(): Promise<void> }` (Task 4 adds two methods)
  - `createTestDatabase(): Promise<TestDatabase>`: on `DEFAULT_DATABASE_URL`'s server, through the maintenance database `postgres`, `CREATE DATABASE` named `test_` plus 32 random hex characters, then `createPool` on it and `applySchema`. `drop()` ends the pool, then `DROP DATABASE IF EXISTS` (no `FORCE`: a leaked connection fails loudly with `55006`). It ignores `DATABASE_URL`: tests use the Compose service only (D8).
  - `testDatabase(): Omit<TestDatabase, "drop">`: calls `createTestDatabase` in `beforeAll` and `drop` in `afterAll` of the calling file; its members delegate to that database and throw if read before `beforeAll` ran.

- [ ] **Step 1: Write the failing tests.**
  `test/schema.test.ts`, with `const db = testDatabase()` at file level and `beforeEach` running `DELETE FROM booking`; inserts are SQL with instants as ISO strings (D5):
  - `"stores two touching bookings of one room"`: `merapi` `2026-11-05T02:00:00.000Z` to `03:00`, then `03:00` to `04:00`: both stored.
  - `"refuses an overlapping booking of the same room with SQLSTATE 23P01"`: after `02:00` to `03:00`, `02:30` to `03:30` rejects with `{ code: "23P01" }`.
  - `"stores the same range in another room"`: `merapi` and `bromo` both `02:00` to `03:00`.
  - `"refuses a booking whose end is not after its start"`: rejects with `{ code: "23514" }`.
  - `"gives a booking inserted without an id a random lower-case UUID"`: matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`.
  - `"applying the schema again keeps the bookings"` (Review Focus 5): insert one, `applySchema(db.pool)` again, count is 1.

  `test/db.test.ts` (Review Focus 1):
  - `"two test databases created at once get different names, neither meeting_rooms nor meeting_rooms_e2e"`: `Promise.all` of two `createTestDatabase()`; names differ and match `/^test_[0-9a-f]{32}$/`; each has the table `booking` (`to_regclass('booking')` not null); drop both.
  - `"a dropped test database is gone from pg_database"`: create, drop, then on a pool to `postgres` `SELECT 1 FROM pg_database WHERE datname = $1` returns no row.
- [ ] **Step 2: Run and record the failures.** `npx vitest run test/schema.test.ts test/db.test.ts`: fails on the missing modules (`../src/db.ts`, `./db.ts`).
- [ ] **Step 3: Implement.**
  - `compose.yaml` per D4: `name: meeting-rooms`; service `postgres`, image `postgres:17-alpine`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` all `meeting_rooms`, ports `"127.0.0.1:55432:5432"` only, named volume at `/var/lib/postgresql/data`, healthcheck `pg_isready -h 127.0.0.1 -U meeting_rooms -d meeting_rooms` (over TCP, so the entrypoint's socket-only init server does not count as ready), interval 1s, retries 30.
  - `scripts/db-up.mjs up|down`: uses `docker compose` when `docker compose version` exits 0, else `docker-compose`; runs `-f <backend>/compose.yaml up -d --wait` or `down` (keeps the volume) with inherited stdio and exits with the child's status. Scripts: `"db:up": "node scripts/db-up.mjs up"`, `"db:down": "node scripts/db-up.mjs down"`.
  - `npm --prefix backend install pg@^8.23.1` and `npm --prefix backend install -D @types/pg@^8.23.1`.
  - `schema.sql` per D6, every statement `IF NOT EXISTS`:
    ```sql
    CREATE EXTENSION IF NOT EXISTS btree_gist;
    CREATE TABLE IF NOT EXISTS booking (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id text NOT NULL,
      account_id text NOT NULL,
      title text NOT NULL,
      start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL,
      CONSTRAINT booking_starts_before_it_ends CHECK (start_at < end_at),
      CONSTRAINT booking_no_overlap EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
    );
    ```
  - `src/db.ts` and `test/db.ts` per the Interfaces block.
- [ ] **Step 4: Run and see it pass.** `npm --prefix backend run db:up` (exit 0 once healthy), run it again (Review Focus 5: returns at once, exit 0), then `npx vitest run test/schema.test.ts test/db.test.ts` green and `npx tsc --noEmit` silent.
- [ ] **Step 5: Commit** `backend.4: PostgreSQL 17 on Compose, schema.sql and a test database per file (D4 to D6, D8)`.

### Task 4: Seeding a fixture's `given` bookings

**Files:**
- Modify: `backend/test/db.ts`, `backend/test/replay.ts` (the `GivenBooking` type only)
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces, in `test/replay.ts`: `GivenBooking = { id: string; account: string; roomId: string; title: string; start: string; end: string }`.
- Produces, on `TestDatabase` (and so on `testDatabase()`'s handle):
  - `resetBookings(): Promise<void>`: deletes every booking
  - `seedBookings(given: readonly GivenBooking[]): Promise<void>`: inserts each directly with its `id`, `account` mapped to the built-in account's `id` through `ACCOUNTS` (`ayu` `u_001`, `budi` `u_002`); an unknown username rejects with an error naming it, before any insert.

- [ ] **Step 1: Write the failing tests** in `test/db.test.ts`, on a file-level `testDatabase()` with `beforeEach(() => db.resetBookings())`:
  - `"seeds a fixture's given bookings with their ids and account ids"`: seed the `given` of `hsdd/contract/fixture/booking-api/my-bookings-budi.json` (6 bookings); `SELECT id, room_id, account_id, title, start_at, end_at FROM booking ORDER BY id` mapped to `{ id, account, roomId, title, start: start_at.toISOString(), end: end_at.toISOString() }` with `account_id` mapped back (`u_001` to `ayu`) equals the `given` sorted by `id`.
  - `"keeps a title outside the Basic Multilingual Plane exactly"` (Review Focus 4): a given titled `"Rapat \u{1F680} tim"` reads back equal.
  - `"resetBookings leaves no booking"`: seed, reset, `count(*)` is 0.
  - `"refuses a given booking whose account is no built-in username"`: rejects with a message containing `citra`, and the table stays empty.
- [ ] **Step 2: Run and record the failures.** `npx tsc --noEmit` (no `resetBookings`, `seedBookings`, `GivenBooking`) and `npx vitest run test/db.test.ts` (`db.resetBookings is not a function`).
- [ ] **Step 3: Implement** the two methods and the type per the Interfaces block. Insert instants as the given strings (D5).
- [ ] **Step 4: Run and see it pass.** Both commands of Step 2.
- [ ] **Step 5: Commit** `backend.4: seed a fixture's given bookings into the test database`.

### Task 5: The gate starts PostgreSQL and runs in Asia/Kolkata

**Files:**
- Modify: `backend/package.json` (`gate`, `replay`)
- Test: `backend/test/zone.test.ts` (new), `backend/test/server.test.ts` (`package` block)

**Interfaces:**
- Produces: `gate` = `npm run db:up && tsc --noEmit && TZ=Asia/Kolkata vitest run`; `replay` = `npm run db:up && TZ=Asia/Kolkata vitest run test/contract.replay.test.ts`.

- [ ] **Step 1: Write the failing tests.**
  - `test/zone.test.ts`, `"runs in Asia/Kolkata, neither account's zone nor UTC (ADR-002 Consequences)"`: `expect(["Asia/Kolkata", "Asia/Calcutta"]).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)` and `new Date("2026-11-05T00:00:00.000Z").getTimezoneOffset()` is `-330`.
  - `server.test.ts` `package` block, `"the gate and the replay start PostgreSQL and run in Asia/Kolkata"`: `pkg.scripts.gate` and `pkg.scripts.replay` equal the two strings above.
- [ ] **Step 2: Run and record the failures.** `npx vitest run test/zone.test.ts test/server.test.ts` on this laptop (zone `Asia/Jakarta`): both new tests fail.
- [ ] **Step 3: Implement** the two scripts.
- [ ] **Step 4: Run and see it pass.** `npm --prefix backend run gate` and `npm --prefix backend run replay` from the repo root: both exit 0.
- [ ] **Step 5: Commit** `backend.4: the gate starts PostgreSQL and runs in Asia/Kolkata`.

### Task 6: The booking-api@v1 replay rig

**Files:**
- Modify: `backend/test/replay.ts`
- Test: `backend/test/replay.test.ts`

**Interfaces:**
- Consumes: `GivenBooking` (Task 4).
- Produces, in `test/replay.ts`:
  - `ContractSlug` gains `"booking-api"`.
  - `Fixture`: `request.method` is `"GET" | "POST" | "DELETE"`; optional `clock?: string` and `given?: GivenBooking[]`.
  - `PlaceholderHooks`: `token(username: string, issuedAt?: Date): Promise<string>` (when `issuedAt` is given the caller issues the token with its clock reading `issuedAt`); `expiredToken(username: string): Promise<string>` (fixtures without a `clock`, unchanged); `prepare?(fixture: Fixture): Promise<void>` (sets the injected clock to `clock` and leaves the database holding exactly `given`).
  - `EXPIRED_TOKEN_AGE_MS = 30 * 60 * 1000 + 1000` (from the contract's 30 minutes, not from `src/sessions.ts`).
  - `fillHeaders(headers, hooks, clock?: Date)`: with a `clock`, `{{token:u}}` calls `hooks.token(u, clock)` and `{{expired-token:u}}` calls `hooks.token(u, new Date(clock.getTime() - EXPIRED_TOKEN_AGE_MS))`; without one, as today.
  - `endpointDef(method: string, path: string): "GetRoomsResponse" | "GetMyBookingsResponse" | "PostBookingResponse" | "DeleteBookingResponse" | undefined`, matched on the path without its query string: `GET /api/rooms`, `GET /api/me/bookings`, `POST /api/bookings`, `DELETE /api/bookings/{anything}`.
  - `responseValidator(slug: ContractSlug, def?: string)`: with `def`, validates against `{schema.$id}#/$defs/{def}`.
  - `judgeResponse(slug: ContractSlug, fixture: Fixture, actual: { status: number; body: string }): string[]`, pure: an empty body is `null` and is never passed to `JSON.parse`; status first; for `booking-api` the parsed response must pass the top-level schema and its `endpointDef`'s `$defs` (an unknown endpoint is a problem), then equal the fixture's body, except that a `201` compares without `id` and its `id` must match `$defs/BookingId` and differ from every `given` id; other slugs keep their `exact` and `schema` modes.
  - `replayFixture(app, slug, fixture, hooks)`: a fixture with a `clock` and no `hooks.prepare` is a problem; fills the headers (with the fixture's clock), then `await hooks.prepare?.(fixture)` for a fixture with a `clock`, then `app.inject` (with `DELETE`), then `judgeResponse(slug, fixture, { status: res.statusCode, body: res.body })`. Problems keep the `{slug}/{fixture.name}: ` prefix.

- [ ] **Step 1: Write the failing tests** in `replay.test.ts`:
  - `SLUGS` gains `"booking-api"`, so the existing "loads one fixture per JSON file", "validates against the schema" and "reproduces against an app that returns it" tests cover it. The echo app routes `GET`, `POST` and `DELETE`, and the shared hooks gain a no-op `prepare`.
  - `"booking-api: 35 fixtures, all exact"`.
  - `"booking-api: every fixture response validates against its endpoint's $defs"`: for each, `endpointDef(method, path)` is defined and `responseValidator("booking-api", def)(fixture.response)` is `[]`.
  - `"chooses the endpoint's $defs by method and path"`: the four mappings above; `GET /api/rooms?from=2026-11-05T00%3A00%3A00.000Z&to=2026-11-06T00%3A00%3A00.000Z` gives `GetRoomsResponse` (Review Focus 2); `GET /api/me` and `POST /api/rooms` give `undefined`.
  - `"issues {{token:u}} at the fixture's clock and {{expired-token:u}} 30 minutes and 1 second before it, then prepares, then sends"`: recording hooks and an echo app that records the request; for `my-bookings-expired-token` the log is `["token budi 2026-11-05T08:59:59.000Z", "prepare my-bookings-expired-token", "request"]`; for `book-a-room` it starts `"token ayu 2026-11-04T12:00:00.000Z"`.
  - `"reports a fixture with a clock when the caller supplies no prepare hook"`.
  - Pure `judgeResponse` cases on `book-touching` (a `201` with `given`): its body with `id` set to a `given` id is reported; with `id` `"not-a-uuid"` is reported; with `id` upper-cased (`"10000000-0000-4000-8000-00000000000A"`, Review Focus 3) is reported; with a fresh lower-case UUID passes; with `title` changed is reported. Each problem names `book-touching`.
  - `"reports a 204 that carries a body"`: `judgeResponse("booking-api", cancel-my-booking, { status: 204, body: "{}" })` is one problem; with body `""` it is `[]`.
  - `"reports an empty body where the fixture has one, without parsing it"`: `rooms-no-token` with `{ status: 401, body: "" }` is one problem.
- [ ] **Step 2: Run and record the failures.** `npx tsc --noEmit` (unknown slug, missing exports) and `npx vitest run test/replay.test.ts`.
- [ ] **Step 3: Implement** per the Interfaces block. `contract.replay.test.ts` is not changed: auth-api@v1 and profile-api@v2 keep replaying as they do, and no route replays booking-api@v1 yet.
- [ ] **Step 4: Run and see it pass.** `npm --prefix backend run gate` from the repo root: exit 0.
- [ ] **Step 5: Commit** `backend.4: the booking-api@v1 replay rig`.

### Task 7: The gate from a clean install, and the verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.4.verification.md`

- [ ] **Step 1: Clean install and gate.** `rm -rf backend/node_modules backend/package-lock.json`, `npm --prefix backend run db:down`, `npm --prefix backend install`, then `npm --prefix backend run gate` and `npm --prefix backend run replay`; keep both outputs and the per-file test counts (`npx vitest run --reporter=json` under `TZ=Asia/Kolkata`).
- [ ] **Step 2: The phase's Verification.** `npm --prefix backend start` (in the background), sign in as `ayu` and `budi` with `curl` on `http://127.0.0.1:3000/api/login`, `GET /api/me` with each token shows `"timeZone": "Asia/Jakarta"` and `"Europe/London"`; stop the server. `docker-compose -f backend/compose.yaml exec postgres psql -U meeting_rooms -l` lists no `test_` database.
- [ ] **Step 3: Write the verification doc** from `hsdd/templates/verification.md` at gate-only depth: Commands to run, Expected output, a 3 to 5 line checklist, Observed (dated, with the failing outputs each task recorded and the gate numbers), Outstanding, Learnings (each dispositioned, or `- none`), Metrics; `## Sign-off` left as the template has it. The template's title line uses U+2014; write it with ` - ` instead.
- [ ] **Step 4: Commit** `backend.4: verification doc`.
