# simple-login.backend: Backend service

- **Kind:** leaf-parent
- **Purpose:** authenticate built-in users and serve over HTTP the signed-in user's profile with their time zone and the bookings of the pre-loaded meeting rooms (each room's bookings in a time range, booking a room, the user's own bookings, cancelling one), keeping the bookings in PostgreSQL 17
- **Owns:** the built-in accounts with their time zones, password verification, the session store, the pre-loaded rooms, the bookings, the PostgreSQL 17 database that keeps them, its Docker Compose service and that service's Compose file, `POST /api/login`, `GET /api/me`, `GET /api/rooms`, `GET /api/me/bookings`, `POST /api/bookings`, `DELETE /api/bookings/{id}`, the `backend/` directory
- **Does not own:** screens, where the browser keeps the token, the dev proxy
- **Consumes:** none
- **Produces:** [auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1]
- **Governed by:** [ADR-001, ADR-002]
- **Sources:** hsdd/context/prd-simple-login.v2.md (US-1, US-2, Demo accounts, Scope, US-4, US-5, US-6, Rooms, Constraints, Left to engineering, Team and delivery, Success), hsdd/context/rfc-simple-login.md (§2 API, §3 Session model, §4 Passwords, §5 Backend stack, §7 Testing, §9 Security notes)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** Fastify `app.inject()` with an injected clock and random source; tests that read or write bookings run against a real PostgreSQL 17, never a mock or an in-memory stand-in (PRD v2 Constraints); the gate replays the auth-api, profile-api and booking-api fixtures against the real routes, the injected clock reading each booking-api fixture's `clock` and the database holding exactly its `given` bookings; no browser, and no fixed port: only the `start` test listens, on 127.0.0.1 at a port the system picks

## Overview

A Fastify service on Node.js 24, written in TypeScript, with the
PostgreSQL 17 database that keeps its bookings. This node owns the
database and runs it on the laptop as a Docker Compose service, through
Colima on macOS (PRD v2 Constraints, Team and delivery). The service holds
the two built-in accounts in memory, each with its time zone as an IANA
name (PRD v2 Demo accounts), checks passwords against scrypt hashes, and
issues opaque bearer tokens with a fixed 30-minute lifetime from an
in-memory session store (ADR-001). It serves the signed-in user's profile,
time zone included (PRD v2 AC-2.1, AC-2.5). The four pre-loaded rooms of
the Jakarta and London offices each carry their office and its time zone
(PRD v2 Rooms). The booking endpoints list every room with its bookings in
a requested range, book a room, list the user's bookings that have not
ended, and cancel one of them (PRD v2 US-4 to US-6).

A booking's start and end are instants: the service applies no time zone,
and its injected clock decides whether a booking has started or ended
(ADR-002). No two bookings of one room overlap, not even when two
overlapping requests arrive at the same moment (PRD v2 AC-5.3, AC-5.4);
how the database holds that is this node's decision, taken in its phase
plan. Bookings survive a restart of the service, which still signs every
user out (PRD v2 Constraints, ADR-001). Everything it promises the web app
is in auth-api@v1 and profile-api@v1, which simple-login.backend.3
replaces with profile-api@v2, and in booking-api@v1; nothing else about it
is visible outside this node.

## Phase Plan

**Default gate:** `npm --prefix backend run gate`

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| simple-login.backend.1 | Service skeleton, domain types, contract replay rig | gate-only | ~8 files (~250 lines), ≤5 tasks | none |
| simple-login.backend.2 | Sign-in, sessions and the two endpoints | full-review | ~9 files (~380 lines), ≤7 tasks | 1 |
| simple-login.backend.3 | Phone number in the profile (profile-api@v2) | spot-check | ~7 files (~40 lines), ≤3 tasks | 2 |
| simple-login.backend.4 | Time zones, booking types, PostgreSQL and the booking replay rig | gate-only | ~14 files (~400 lines), ≤7 tasks | 3 |
| simple-login.backend.5 | Booking rules (pure core) | spot-check | ~4 files (~350 lines), ≤6 tasks | 4 |
| simple-login.backend.6 | The booking store on PostgreSQL | full-review | ~3 files (~330 lines), ≤6 tasks | 4 |
| simple-login.backend.7 | Booking endpoints, the service on its database (booking-api@v1) | full-review | ~8 files (~380 lines), ≤7 tasks | 5, 6 |

Ordering policy: `interfaces-first` (from `hsdd/conventions.md`). Phase 1
holds the types, the account data and the test rig with no business logic;
phase 2 is the logic behind both endpoints and the composition that serves
them. Commands run from the repository root (the directory holding `hsdd/`).

Sizing floor. The first draft had three phases: skeleton (gate-only),
password and session logic (full-review), HTTP routes (full-review). The
last two share a tier, consume the same contracts (none), no third phase
depends on one without the other, and together they fit seven tasks, so
they merged into phase 2. Phases 1 and 2 stay separate on a tier boundary:
scaffolding that only needs its gate to pass, versus security logic that
needs a full review.

Append, 2026-10-30 (update 1, per
hsdd/management/2026-10-30-intake-add-phone.md). Phase 3 follows the same
`interfaces-first` policy. The change alters one produced surface, the
profile, and the account data behind it, with no new logic, so the type
change, the data and the gate's switch to profile-api@v2 form one phase,
ordered after phase 2 because it changes phase 2's routes and replay. It
produces profile-api@v2 ahead of the integration node's v2 phase, which
runs against the real service; the web lane builds against the v2
fixtures and does not wait.

Sizing floor, append. Phase 3's process artifacts will outweigh its
~40-line diff, which makes it a merge candidate by the smell, but it has
no partner: phase 2 is shipped and full-review, and the request gives this
node no other phase. It stays one phase; the spot-check tier keeps its
proposal brief and leaves out `design.md`.

Append, 2026-10-31 (PRD v2, per
hsdd/management/2026-10-31-intake-prd-simple-login-v2.md). Phases 4 to 7
follow the same `interfaces-first` policy. Phase 4 holds the types, the
room and account data, the PostgreSQL 17 service with its schema, the test
database and the replay rig for booking-api@v1, with no business logic; it
also adds the time zone to the accounts, so it produces profile-api@v2 as
touched for PRD v2 and turns the gate green again (the `me-ayu` and
`me-budi` fixtures now carry `timeZone`). Phases 5 (the pure rules) and 6
(the store on PostgreSQL) each depend only on phase 4 and can run in
parallel. Phase 7 is the composition: the four routes, the service on its
database and the replay that produces booking-api@v1. The web lane builds
against booking-api@v1's fixtures and does not wait for phase 7; the
integration node's PRD v2 phases run against the real service and its
database, and wait for it.

Sizing floor, append (phases 4 to 7). Phases 4 and 5, and 5 and 6, sit on
tier boundaries (gate-only, spot-check, full-review). Phases 6 and 7 share
a tier, consume the same contracts (none), and no third phase depends on
one without the other, but merged they come to about 710 lines and 13
tasks, over one review sitting; phase 6 also holds the concurrency logic, a
risk reviewed on its own. They stay split. A phase of its own for the time
zone (about 15 lines) would have been a merge candidate by the smell, so it
is part of phase 4.

### Decisions

- **D1. Usernames match exactly:** case-sensitive, no trimming. `Ayu` is
  not `ayu`. Consumers can observe this, so it is emitted as an `amend`
  below rather than kept node-local.
- **D2. The service listens on `127.0.0.1`, port `PORT` or 3000** (RFC §1).
  The web app's dev proxy must point at the same address, and neither
  contract says where the service runs, so it is emitted as an `amend`.
- **D3. The rooms are data in the service,** like the accounts: the four
  rooms of booking-api@v1, in its order, with no rooms table. A booking row
  keeps its room's id, which the rules check before any write (PRD v2
  Rooms: pre-loaded, nobody adds, edits or removes one).
- **D4. PostgreSQL 17 runs from `backend/compose.yaml`:** one service,
  `postgres`, image `postgres:17-alpine`, published on `127.0.0.1:55432`
  only (not 5432, so a PostgreSQL already on the laptop does not collide),
  user, password and database `meeting_rooms` (local laptop only, PRD v2
  Constraints), a named volume so bookings outlive the container, and a
  `pg_isready` healthcheck. `npm --prefix backend run db:up` starts it and
  returns once it is healthy (`up -d --wait`), through `docker compose`
  when that command exists and `docker-compose` otherwise: a Homebrew
  install under Colima may have only the second
  (hsdd/auto/experiments/booking-store-postgres/). `db:down` stops it and
  keeps the volume. The service reads `DATABASE_URL`, default
  `postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms`,
  and never logs it. simple-login.integration starts the database through
  `db:up`, so this is emitted as a `note`.
- **D5. node-postgres (`pg`, with `@types/pg`).** Instants go into SQL as
  their `toISOString()` strings and come back as `Date`. A `Date`
  parameter also round-trips, but the driver writes it in the process's
  zone; a string keeps that zone out of every query. Read back under a
  session `TimeZone` of `Europe/London` or `Asia/Jakarta` with
  `TZ=Asia/Kolkata`, every instant is unchanged
  (hsdd/auto/experiments/booking-store-postgres/).
- **D6. One schema file, applied at every start.**
  `backend/src/schema.sql` creates the extension `btree_gist` and the table
  `booking`: `id uuid` defaulting to `gen_random_uuid()`, `room_id`,
  `account_id`, `title text`, `start_at` and `end_at timestamptz`,
  `CHECK (start_at < end_at)`, and
  `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)`,
  every statement `IF NOT EXISTS`. The service applies it when it starts
  and the tests to every new database; there is no migration tool.
  Cancelling deletes the row. Ids are random UUIDs, so none is reused
  (ADR-002 Decision 2; booking-api@v1 Shapes).
- **D7. One transaction per booking, under a lock on its room.** The store
  books in one transaction: `pg_advisory_xact_lock(hashtext(room_id))`,
  then the earliest overlapping booking of that room (`ORDER BY start_at
  LIMIT 1`), which is the 409's `error.conflict` when there is one, else the
  `INSERT`. Cancelling takes the same lock, so a conflict is never named
  while its booking is being cancelled. The exclusion constraint of D6
  stays as the invariant (booking-api@v1 G4); a `23P01` or `40P01` that
  still reaches the store answers by re-reading the earliest overlapping
  booking, never by a 5xx. In the experiment, 20 simultaneous inserts
  under the lock settled every round in under 100 ms with no deadlock.
  Against the constraint alone, some runs settled only through `deadlock
  detected` (`40P01`, after PostgreSQL's 1 s deadlock_timeout), up to 19
  seconds a round, and a `40P01` loser that re-read too early found no
  winner to name; re-trying the insert then left 18 attempts unbooked
  after ten retries each and one round 215 seconds long
  (hsdd/auto/experiments/booking-store-postgres/).
- **D8. Tests never touch the `meeting_rooms` database.** A helper gives
  each test file its own database on the same Compose service, created with
  the schema and dropped after the file, so files still run in parallel and
  a replay that empties the bookings erases nothing of a developer's. One
  such database takes about 30 ms to create with its schema
  (hsdd/auto/experiments/booking-store-postgres/).
- **D9. A title holding U+0000 or an unpaired surrogate is refused** with
  400 `VALIDATION_FAILED`. PostgreSQL `text` refuses U+0000 (`22021`, a
  5xx if it reached the database), and an unpaired surrogate comes back as
  U+FFFD, so neither title could be stored and returned exactly as sent
  (booking-api@v1 G8; hsdd/auto/experiments/booking-store-postgres/).
  Consumers can observe it, so it is emitted as an `amend`.
- **D10. A range bound before `0001-01-01T00:00:00.000Z` goes to SQL as
  that instant.** `0000-01-01T00:00:00.000Z` is an instant by booking-api@v1
  G1, which PostgreSQL refuses (`22008`, date/time field value out of
  range); no booking lies before year 1, so the answer is the same and
  never a 5xx. Invisible across the boundary, so it stays node-local.

### simple-login.backend.1: Service skeleton, domain types, contract replay rig

- **Consumes:** none
- **Produces:** none
- **Governed by:** [ADR-001]
- **Scope:** the `backend/` package (TypeScript on Node 24, Fastify 5, Vitest, Ajv; `npm run gate` = `tsc --noEmit` then `vitest run`); domain types (account, profile, session, the error envelope, a result type); the two built-in accounts from the PRD with their scrypt salt and hash as data (no verification logic); a `buildApp(deps)` factory taking a clock and a random source, with no routes yet; and the contract replay rig: a test helper that loads each fixture under `hsdd/contract/fixture/{auth-api,profile-api}/`, fills the `{{token:…}}` and `{{expired-token:…}}` placeholders through hooks the caller supplies, sends the request through `app.inject()`, and checks the response by the fixture's `replay` mode against `hsdd/contract/schema/{slug}.schema.json`. Its own tests prove every fixture validates against its schema and that the account data equals the `me-ayu` and `me-budi` fixture bodies.
- **Size estimate:** ~8 files (~250 lines), <= 5 OpenSpec tasks
- **Gate:** `npm --prefix backend run gate`
- **Verification:** `npm --prefix backend run gate` passes from a clean checkout after `npm --prefix backend install`; the replay rig reports all ten fixtures as schema-valid.
- **Review tier:** gate-only
- **Dependencies:** none

### simple-login.backend.2: Sign-in, sessions and the two endpoints

- **Consumes:** none
- **Produces:** [auth-api@v1, profile-api@v1]
- **Governed by:** [ADR-001]
- **Scope:** password verification with scrypt and `timingSafeEqual`, running one comparison against a dummy hash when the username is unknown (RFC §4); the in-memory session store: 32 random bytes base64url per token, a fixed 30-minute expiry from the injected clock, lookup that rejects unknown and expired tokens (ADR-001); `POST /api/login` and `GET /api/me` exactly as the contracts state, with every error in the envelope, including a body that is not JSON or not `application/json` (400 `VALIDATION_FAILED`, never Fastify's default error shape); usernames matched per D1; `backend/src/server.ts` started by `npm --prefix backend start`, listening per D2; no password or token in any log line (RFC §9); and a `replay` script that runs the replay rig from phase 1 against the real routes.
- **Size estimate:** ~9 files (~380 lines), <= 7 OpenSpec tasks
- **Gate:** `npm --prefix backend run gate` plus contract replay for auth-api and profile-api: `npm --prefix backend run replay`
- **Verification:** with the service running, `curl` signs in as `ayu`, fetches `/api/me` with the token and gets Ayu's profile; a wrong password and an unknown user return byte-identical 401 bodies; a token stops working after 30 minutes (proven by the injected clock in tests, not by waiting).
- **Review tier:** full-review
- **Dependencies:** simple-login.backend.1 (domain types, account data, `buildApp`, the replay rig)

### simple-login.backend.3: Phone number in the profile (profile-api@v2)

- **Consumes:** none
- **Produces:** [profile-api@v2]
- **Governed by:** [ADR-001]
- **Scope:** per hsdd/management/2026-10-30-intake-add-phone.md. `GET /api/me` moves from profile-api@v1 to profile-api@v2: the profile gains `phone`. `Account` gains `phone: string`, held as the display string and returned exactly as stored, never parsed, normalized or reformatted (AC-2.4); `Profile` stays `Account` without its password, so `toProfile` passes `phone` through and the profile still carries no password, hash or token. The built-in accounts gain the numbers from update 1's Demo accounts table: `ayu` `+62 812 3456 7890`, `budi` `+62 813 9876 5432`. The accounts test compares both profiles with the `me-ayu` and `me-budi` bodies under `hsdd/contract/fixture/profile-api.v2/`. The replay rig gains the slug `profile-api.v2` (schema `hsdd/contract/schema/profile-api.v2.schema.json`, fixtures `hsdd/contract/fixture/profile-api.v2/`), its own tests cover those fixtures, and `npm --prefix backend run replay` replays auth-api@v1 (unchanged) and profile-api@v2. profile-api@v1 leaves the replay: the endpoint carries one shape and serves v2 only from this phase on (profile-api@v2, Versioning), so v1's exact `me-ayu` and `me-budi` bodies no longer reproduce. `POST /api/login`, the session store and every 401 body are unchanged. Out of scope (update 1, Scope): editing or verifying the number, sign-in by phone, any other field.
- **Size estimate:** ~7 files (~40 lines), <= 3 OpenSpec tasks
- **Gate:** node default plus contract replay for profile-api.v2: `npm --prefix backend run replay` (the same run keeps replaying auth-api)
- **Verification:** with the service running, Ayu's token at `GET /api/me` returns the six profile-api@v2 fields with `phone` exactly `+62 812 3456 7890`, and Budi's returns `+62 813 9876 5432`; the 401 bodies are unchanged; the replay lists the auth-api and profile-api.v2 fixtures and no profile-api@v1 fixture.
- **Review tier:** spot-check
- **Dependencies:** simple-login.backend.2 (shipped: `Account`, `toProfile`, `GET /api/me`, the replay rig and `contract.replay.test.ts`); profile-api@v2's schema and fixtures, `stable` once hsdd-reconcile drains this plan (root Dev flow: lane 1 starts from `stable` contracts)

### simple-login.backend.4: Time zones, booking types, PostgreSQL and the booking replay rig

- **Consumes:** none
- **Produces:** [profile-api@v2]
- **Governed by:** [ADR-001, ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. Types, data, scaffolding and test rig only; no business logic. (1) The time zone, profile-api@v2 as touched for PRD v2: `Account` gains `timeZone`, an IANA name held as data and returned exactly as stored: `ayu` `Asia/Jakarta`, `budi` `Europe/London` (PRD v2 Demo accounts). `toProfile` passes it through, so `GET /api/me` serves seven fields, `id`, `username`, `displayName`, `email`, `phone`, `memberSince`, `timeZone`, and still no password, hash or token; the accounts test compares both profiles with the `me-ayu` and `me-budi` bodies under `hsdd/contract/fixture/profile-api.v2/`, and its key-set test expects those seven. The service applies no zone to anything (ADR-002). (2) Booking types, values only, in `backend/src/domain.ts`: `Room` (`id`, `name`, `office`, `timeZone`, `seats`); `StoredBooking` (`id`, `roomId`, `accountId`, `title`, `start`, `end`, the instants as `Date`); `NewBooking` (the same without `id`); booking-api@v1's wire `Booking`; the six booking error codes beside the three existing ones; booking-api@v1's status and message for each code as one table of data, apart from auth-api@v1's bodies, which stay as they are (auth-api@v1's `VALIDATION_FAILED` reads `Username and password are required.`, booking-api@v1's `The request is not valid.`); and the `BookingStore` interface the routes will call: `insert(NewBooking)` giving the stored booking or, as an error value, the overlapping booking to name (G6), `overlapping(from, to)`, `notEndedOf(accountId, now)`, `find(id)`, and `remove(booking)` giving false when it was already gone. (3) The rooms per D3, in `backend/src/rooms.ts`, in this order: `merapi` Merapi, Jakarta, `Asia/Jakarta`, 8 seats; `bromo` Bromo, Jakarta, `Asia/Jakarta`, 4; `thames` Thames, London, `Europe/London`, 10; `kew` Kew, London, `Europe/London`, 4. (4) PostgreSQL 17 per D4, D5 and D6: `backend/compose.yaml`, `backend/scripts/db-up.mjs` behind the `db:up` and `db:down` scripts, `backend/src/schema.sql`, and `backend/src/db.ts` (a pool from `DATABASE_URL`, and `applySchema(pool)`), with `pg` and `@types/pg` in the package; a test proves the schema stores two touching bookings of one room, refuses an overlapping one with SQLSTATE `23P01`, and stores the same range in another room. (5) The test database per D8: `backend/test/db.ts` with `testDatabase()` (a fresh database with the schema, dropped after the file), `resetBookings` and `seedBookings(given)`, which inserts a fixture's `given` bookings directly, with their ids, mapping each `account` username to the account's `id` (`ayu` `u_001`, `budi` `u_002`). (6) The gate: the `gate` script becomes `npm run db:up && tsc --noEmit && TZ=Asia/Kolkata vitest run`, and `replay` becomes `npm run db:up && TZ=Asia/Kolkata vitest run test/contract.replay.test.ts`; a test fails unless the ambient zone resolves to `Asia/Kolkata`, which `Intl` reports as `Asia/Calcutta`, so no time passes only on a laptop set to Jakarta, London or UTC (ADR-002 Consequences). (7) The replay rig for booking-api@v1, built ahead of the phase that produces it: the slug `booking-api` (schema `hsdd/contract/schema/booking-api.schema.json`, fixtures `hsdd/contract/fixture/booking-api/`, 35, all `exact`); a fixture's `clock` and `given`; the `DELETE` method; a `prepare(fixture)` hook the caller supplies, which sets the injected clock to `clock` and leaves the database holding exactly the `given` bookings before the request; `{{token:u}}` issued at `clock`, and `{{expired-token:u}}` issued 30 minutes and 1 second before it, so its `expiresAt` is before `clock`; a `204` whose fixture body is `null` matches an empty real body, and the rig never calls `res.json()` on an empty body; a `201` matches when its body equals the fixture's except `id`, which must match the schema's `BookingId` and differ from every `given` id; every response is checked against the top-level schema and against its endpoint's `$defs` (`GetRoomsResponse`, `GetMyBookingsResponse`, `PostBookingResponse`, `DeleteBookingResponse`, chosen by method and path). The rig's own tests prove that all 35 fixture responses validate against both, that each reproduces against an app that returns it, and that a `201` carrying a `given` id or a non-UUID id, or a `204` with a body, is reported. auth-api@v1 and profile-api@v2 keep replaying as they do.
- **Size estimate:** ~14 files (~400 lines), <= 7 OpenSpec tasks
- **Gate:** node default plus contract replay for profile-api.v2: `npm --prefix backend run replay` (the same run keeps replaying auth-api)
- **Verification:** with Docker running, `npm --prefix backend run gate` passes from a clean checkout after `npm --prefix backend install` and starts PostgreSQL on its own; `GET /api/me` with Ayu's token returns `"timeZone": "Asia/Jakarta"` and Budi's `"Europe/London"`; after the gate, `docker-compose -f backend/compose.yaml exec postgres psql -U meeting_rooms -l` (or `docker compose`) lists no database left behind by a test.
- **Review tier:** gate-only
- **Dependencies:** simple-login.backend.3 (shipped: `Account`, `toProfile`, the replay rig with the `profile-api.v2` slug, `contract.replay.test.ts`); profile-api@v2 as touched for PRD v2 (`stable`); booking-api@v1's schema and fixtures as drafted (`draft`), read by the rig and replayed by no route yet

### simple-login.backend.5: Booking rules (pure core)

- **Consumes:** none
- **Produces:** none
- **Governed by:** [ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. booking-api@v1's rules as pure functions in `backend/src/booking-rules.ts`: no I/O, no Fastify, no clock read (the time arrives as an argument) and no time zone, because the backend works in instants only (ADR-002 Decision 4). An instant is accepted only when `new Date(s).toISOString() === s` (G1), so `2026-11-05T02:00:00Z`, `2026-11-05T09:00:00.000+07:00` and `2026-02-30T00:00:00.000Z` are refused; a quarter-hour instant has UTC minutes 00, 15, 30 or 45 and zero seconds and milliseconds (G2; ADR-002 Decision 6). `GET /api/rooms`: `from` and `to` are each one string (a repeated parameter is refused), already percent-decoded by the framework, both instants, `from` before `to`, with no cap on the range. `POST /api/bookings`: the `content-type` is `application/json` and the body a JSON object, as for sign-in; `roomId` is one of D3's room ids; `start` and `end` are quarter-hour instants, `end` after `start`; `title` is a string of 1 to 80 code points, counted as `[...title].length`, never `.length` (an emoji is one, as Ajv's `maxLength` counts), with at least one character that `/\S/u` matches (the schema's pattern), and with no U+0000 and no unpaired surrogate (D9); it is kept exactly as sent, never trimmed; other fields are ignored; any of these failing is `VALIDATION_FAILED`. Then, in this order (G15): more than 8 hours of elapsed time from `start` to `end` (28,800,000 ms) is `BOOKING_TOO_LONG` (G9); a clock reading `start` or later is `BOOKING_STARTED`, the moment of `start` counting as started (G7); `start` more than 8,760 hours after the clock is `BOOKING_TOO_FAR_AHEAD`, the boundary accepted (G10). Cancelling, given the clock, the caller's account id and the stored booking or none: an id that is not a lower-case UUID (the schema's `BookingId`), or that names no booking, is `BOOKING_NOT_FOUND`; another account's booking is `BOOKING_NOT_YOURS`, whatever its timing; a booking whose `start` the clock has reached is `BOOKING_STARTED` (G11, G12). The views: a stored booking on the wire gains `roomName` from D3's rooms; the rooms view lists every room in D3's order with its bookings earliest `start` first and `[]` for none (G13); my bookings are sorted by `start`, ties in D3's room order (G14); each error code maps to its one status and message, and `BOOKING_CONFLICT` carries `error.conflict`. Unit tests hold each boundary: exactly 8 hours accepted and 8 hours 15 minutes refused; `start` equal to the clock refused; 8,760 hours ahead accepted and 8,760 hours 15 minutes refused; 80 emoji accepted and 81 refused; a title of spaces refused; a title holding U+0000, or U+D800 on its own, refused. A second test runs every booking-api@v1 fixture whose answer these rules decide (each `400`, `403`, `404` and `422`), with its `clock`, its request and, for `DELETE`, its `given` booking, and expects that fixture's status and body.
- **Size estimate:** ~4 files (~350 lines), <= 6 OpenSpec tasks
- **Gate:** node default
- **Verification:** the rules module imports nothing that does I/O and names no time zone; the boundary tests name the guarantee each holds (G1, G2, G7 to G10, G12 to G15); the fixture-driven test lists each `400`, `403`, `404` and `422` fixture by name.
- **Review tier:** spot-check
- **Dependencies:** simple-login.backend.4 (the booking types, the rooms, the error table, the fixture loader); booking-api@v1's fixtures

### simple-login.backend.6: The booking store on PostgreSQL

- **Consumes:** none
- **Produces:** none
- **Governed by:** [ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. `createBookingStore(pool)` in `backend/src/booking-store.ts` implements phase 4's `BookingStore` on PostgreSQL 17 per D5, D6, D7 and D10. `insert` runs D7's transaction: the room's advisory lock, then the earliest overlapping booking of that room under the half-open rule `tstzrange(start_at, end_at, '[)') && tstzrange($start, $end, '[)')`, returned as the conflict when there is one, else the `INSERT ... RETURNING` with the id from `gen_random_uuid()`; a `23P01` or `40P01` that still arrives is answered by the same re-read, never thrown. `overlapping(from, to)` returns every room's bookings that overlap `[from, to)`, ordered by `start_at`, a bound before `0001-01-01T00:00:00.000Z` sent as that instant (D10), so `from=0000-01-01T00:00:00.000Z` answers like any range; `notEndedOf(accountId, now)` returns that account's bookings with `end_at` after `now` (G14: one in progress is listed, one that ended at `now` is not); `find(id)` reads one booking; `remove(booking)` deletes it under the same room lock and gives false when no row was left to delete. No SQL converts an instant to a zone (ADR-002 Decision 2). The tests run against a real PostgreSQL 17 through phase 4's test database, never a mock or an in-memory stand-in (PRD v2 Constraints): touching bookings are both stored (G3); an overlap is refused naming the earliest overlapping booking when there are several (G6); a booking of another room never blocks (G4); 20 simultaneous inserts for the same room and time, on a pool of 20 connections, store exactly one booking and give nineteen conflicts naming it, with no other outcome, over ten rounds (G5; PRD v2 Success); after `remove`, the next insert books the same range (G11); a second pool on the same database, standing in for a restart, reads every booking with its id (G17); instants read back unchanged under `TZ=Asia/Kolkata` with a session `TimeZone` of `Europe/London`; a range from `0000-01-01T00:00:00.000Z` returns the bookings it overlaps instead of an error.
- **Size estimate:** ~3 files (~330 lines), <= 6 OpenSpec tasks
- **Gate:** node default
- **Verification:** the 20-at-once test passes in each of ten rounds, each round settling in well under a second, and PostgreSQL's log (`docker-compose -f backend/compose.yaml logs postgres`, or `docker compose`) shows no `deadlock detected` from it; no store function takes or returns a zone or a local time.
- **Review tier:** full-review
- **Dependencies:** simple-login.backend.4 (the `BookingStore` interface, `schema.sql`, `db.ts`, the test database)

### simple-login.backend.7: Booking endpoints, the service on its database (booking-api@v1)

- **Consumes:** none
- **Produces:** [booking-api@v1]
- **Governed by:** [ADR-001, ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. The four endpoints of booking-api@v1, each checking the bearer token first as `GET /api/me` does, 401 `UNAUTHORIZED` `Sign in to continue.` for a missing, unknown or expired one (G16; ADR-001), then phase 5's rules, then phase 6's store: `GET /api/rooms?from={instant}&to={instant}` (200 `{ "rooms": [...] }`, 400); `GET /api/me/bookings` (200 `{ "bookings": [...] }`); `POST /api/bookings` (201 `Booking`, 400, 422, and 409 `BOOKING_CONFLICT` with `error.conflict`); `DELETE /api/bookings/{id}` (204 with no body, 404, 403, 422, and 404 when the store finds the booking already gone). A request Fastify refuses before a handler on a booking route, such as a body over its size limit, still answers by its endpoint's order: 401 when the token fails, else 400 `VALIDATION_FAILED` with booking-api@v1's message; `POST /api/login` keeps auth-api@v1's 400 body. `buildApp(deps)` gains the store. `backend/src/server.ts` creates the pool from `DATABASE_URL` (D4), applies the schema (D6), closes the pool when the app closes, never logs the URL, a password or a token (RFC-001 §9), and exits with a message naming `npm --prefix backend run db:up` when the database cannot be reached. Sessions stay in memory (ADR-001), so a restart signs everyone out and keeps every booking. The replay: `contract.replay.test.ts` adds the slug `booking-api`, with a `prepare` hook that sets the injected clock to each fixture's `clock` and seeds exactly its `given` bookings into the file's test database, so `npm --prefix backend run replay` replays auth-api@v1 (5 fixtures), profile-api@v2 (5) and booking-api@v1 (35). The sequences no fixture holds (booking-api@v1 Validation) are this phase's own tests, against the real PostgreSQL: 20 simultaneous `POST`s through `app.inject()` for the same room and time give one 201 and nineteen 409 `BOOKING_CONFLICT` whose `error.conflict` is the 201's booking, never a 5xx (G5); after a 204, the next request books the same range (G11); a second `buildApp` on the same database, standing in for a restart, answers the old token with 401 and, after a new sign-in, lists every booking with its id (G17; auth-api@v1 G3). The `start` test in `server.test.ts` runs against a test database.
- **Size estimate:** ~8 files (~380 lines), <= 7 OpenSpec tasks
- **Gate:** node default plus contract replay for booking-api, profile-api.v2 and auth-api: `npm --prefix backend run replay`
- **Verification:** after `npm --prefix backend run db:up` and `npm --prefix backend start`, signed in as `ayu` with `curl`: `GET /api/rooms` for the next day in Jakarta (from 17:00Z to 17:00Z) lists Merapi, Bromo, Thames and Kew in that order; booking Merapi for an hour that day answers 201, and an overlapping second request 409 naming the first; restart the service: the old token gets 401, and after signing in again `GET /api/me/bookings` lists the booking with the same id; `DELETE` of it answers 204 with no body.
- **Review tier:** full-review
- **Dependencies:** simple-login.backend.5 (the rules and views), simple-login.backend.6 (the store); booking-api@v1 `stable`, which hsdd-reconcile sets once its producer and consumers are confirmed (H15, H17, H19; root Dev flow: lane 1 starts from `stable` contracts)

### Phase dependency graph

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TD
    B1["simple-login.backend.1<br/>Skeleton, types, replay rig"]
    B2["simple-login.backend.2<br/>Sign-in, sessions, endpoints"]
    W["simple-login.web<br/>(consumer node)"]
    I["simple-login.integration.1<br/>(consumer phase)"]
    B3["simple-login.backend.3<br/>Phone in the profile (v2)"]
    I2["simple-login.integration.2<br/>(consumer phase)"]
    B4["simple-login.backend.4<br/>Time zones, types, PostgreSQL, rig"]
    B5["simple-login.backend.5<br/>Booking rules (pure core)"]
    B6["simple-login.backend.6<br/>Booking store on PostgreSQL"]
    B7["simple-login.backend.7<br/>Booking endpoints (booking-api@v1)"]
    I3["simple-login.integration<br/>(PRD v2 consumer phases)"]

    B1 --> B2
    B2 -. "auth-api@v1, profile-api@v1 (real service)" .-> I
    B2 -. "contracts only; the web lane uses fixtures" .-> W
    B2 --> B3
    B3 -. "profile-api@v2 (real service)" .-> I2
    B3 -. "profile-api@v2, contract only; the web lane uses fixtures" .-> W
    B3 --> B4
    B4 --> B5
    B4 --> B6
    B5 --> B7
    B6 --> B7
    B4 -. "profile-api@v2 with timeZone, contract only; the web lane uses fixtures" .-> W
    B7 -. "booking-api@v1, contract only; the web lane uses fixtures" .-> W
    B4 -. "profile-api@v2 with timeZone (real service)" .-> I3
    B7 -. "booking-api@v1 (real service on its PostgreSQL)" .-> I3

    style B1 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B2 fill:#d1fae5,stroke:#059669,color:#1e293b
    style W fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I fill:#fef3c7,stroke:#d97706,color:#1e293b
    style B3 fill:#d1fae5,stroke:#059669,color:#1e293b
    style I2 fill:#fef3c7,stroke:#d97706,color:#1e293b
    style B4 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B5 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B6 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B7 fill:#d1fae5,stroke:#059669,color:#1e293b
    style I3 fill:#fef3c7,stroke:#d97706,color:#1e293b
```

## Governance updates (pending reconcile)

> Reconciled 2026-10-29 by hsdd-reconcile. Drained entries are in git history.

> Reconciled 2026-10-30 by hsdd-reconcile. Drained entries are in git history.

> Reconciled 2026-11-01 by hsdd-reconcile. Drained entries are in git history.
