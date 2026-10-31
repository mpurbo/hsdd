# Verification: simple-login.backend.5 - Booking rules (pure core)

## Commands to run
From the repository root, with Docker running (Colima on macOS): the gate
starts PostgreSQL itself, and the gate runs the whole backend suite.

```bash
npm --prefix backend install
npm --prefix backend run gate
```

The phase's own tests alone, which need no database:

```bash
cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts test/booking-rules.fixtures.test.ts
```

This phase produces no contract, so there is no replay to run.

## Expected output
- `npm --prefix backend run gate` exits 0: `db:up` reports the container
  `Healthy`, `tsc --noEmit` prints nothing, and Vitest reports
  `Test Files  16 passed (16)` and `Tests  195 passed (195)`.
- `test/booking-rules.test.ts` 45 tests and
  `test/booking-rules.fixtures.test.ts` 39; the other 14 files keep their
  111.
- What to eyeball, by the phase's Verification line:
  - `backend/src/booking-rules.ts` imports only `./domain.ts` and
    `./rooms.ts`, reads no clock and names no time zone. The tests under
    "the rules module is pure (ADR-002 Decision 4)" scan the source for an
    import of anything else, `Date.now(`, `new Date()`, `Intl`,
    `toLocale`, `getTimezoneOffset`, a local-time getter and an IANA zone
    or `"UTC"` literal.
  - The boundary tests name the guarantee each holds: G1 (instant form,
    four-digit year, strings only), G2 (quarter hours; end after start),
    G7 (start equal to the clock refused), G8 (80 emoji accepted, 81
    refused; blank refused; U+0000 and a lone U+D800 refused; kept as
    sent), G9 (exactly 8 hours accepted, 8 hours 15 minutes refused;
    elapsed time across London's 25-hour day), G10 (8,760 hours accepted,
    8,760 hours 15 minutes refused), G11, G12 (another account's booking
    whatever its timing), G13, G14 (ties in D3's room order), G15 (the
    POST order; the DELETE order for a malformed id), and G6 for the
    conflict body.
  - `booking-rules.fixtures.test.ts` lists the sixteen fixtures the rules
    decide by name: `book-end-not-after-start`, `book-instant-with-offset`,
    `book-not-on-a-quarter-hour`, `book-started`,
    `book-started-and-overlapping`, `book-title-blank`,
    `book-title-too-long`, `book-too-far-ahead`, `book-too-long`,
    `book-unknown-room`, `cancel-malformed-id`, `cancel-someone-elses`,
    `cancel-started`, `cancel-unknown`, `rooms-from-not-before-to`,
    `rooms-instant-without-milliseconds`; each reproduces its status and
    body through `errorResponse`. The thirteen `200 GET /api/rooms`, `201`,
    `204` and `409` fixtures pass their rule, the seven `201` bodies equal
    `toWireBooking` of the new booking, and the two `409` bodies equal
    `errorResponse` of the named given booking.

## Observed
2026-11-01, macOS, Node.js 24.18.0, PostgreSQL 17 (`postgres:17-alpine`)
under Colima through the standalone `docker-compose`. The Compose service
was shared with simple-login.backend.6's worktree and stayed `Running`
throughout; no run stopped or recreated it.

- Baseline, the gate at 8839bbe before any code: exit 0, 14 files, 111
  tests.
- Clean install at 75fdd26: `backend/node_modules` and the gitignored
  `backend/package-lock.json` removed, `npm --prefix backend install`
  (exit 0; fastify 5.12.7, pg 8.23.1, typescript 7.0.2, vitest 5.0.5,
  ajv 8.20.0). Then `npm --prefix backend run gate`: exit 0, `tsc` silent,
  `Test Files  16 passed (16)`, `Tests  195 passed (195)`;
  `booking-rules.test.ts` 45, `booking-rules.fixtures.test.ts` 39, the
  other 14 files 111 as before. The same clean-install gate at 2729dc9,
  before the review fix, gave 16 files and 194 tests.
- Test-first, each task's recorded failing run:
  - Task 1: the module could not be resolved; no test ran.
  - Task 2: 11 failed, 10 passed (`checkNewBooking is not a function`).
  - Task 3: 5 failed, 21 passed (`ok` where `BOOKING_TOO_LONG`,
    `BOOKING_STARTED` and `BOOKING_TOO_FAR_AHEAD` were expected).
  - Task 4: 5 failed, 26 passed (`toWireBooking`, `roomsView`,
    `myBookingsView` not exported).
  - Task 5: 32 failed, 51 passed (`checkCancel`, `isBookingId`,
    `errorResponse` not exported).
- Tests that passed before their own task's code: Task 5's let-through
  rows test behavior Tasks 1 to 4 had already delivered. Each was run
  against a named mutant, then reverted: `MAX_AHEAD_MS - 1` (2 failed),
  title limit 79 (2 failed), `roomName` replaced by the room id (9
  failed), the start's quarter-hour check removed (1 failed). The purity
  scan was run against three probes, each caught: an import of `node:fs`,
  a `new Date()`, a `"Asia/Jakarta"` literal.
- Two plan test defects were fixed during execution, neither in the
  code: a missing content type passed through a helper whose default
  parameter turned `undefined` into `application/json`, and an
  upper-cased id that held no hex letters and so did not change.
- Decisions this phase settled (the plan's Design notes): an instant
  also needs a four-digit year (booking-api@v1 Values and the schema's
  `Instant` pattern; the round trip alone admits `+010000-...`); the
  content type is the media type before any `;`, trimmed and
  case-insensitive, so `application/json; charset=utf-8` is accepted;
  rooms-query parameters other than `from` and `to` are ignored (the
  schema's `GetRoomsQuery` is open); `toWireBooking` throws for a room
  that is not one of D3's, as a defect rather than a request error.
- Final review, a fresh reviewer (Opus) over e64693d..2729dc9 at
  spot-check: Critical 0, Important 1, Minor 4, verdict "with fixes".
  - Important 1, fixed in 75fdd26: the DELETE order for a malformed id was
    untested, and a `checkCancel` that checked the id after ownership and
    timing passed all 83 tests. The new test "G15: a malformed id is
    BOOKING_NOT_FOUND even when the booking is another account's or has
    started" fails against that mutant (`BOOKING_NOT_YOURS`) and passes on
    the real order; the gate then passed 195 of 195.
  - Minor, deferred: `roomsView` drops a booking of an unknown room where
    `toWireBooking` and `myBookingsView` throw; `checkCancel` does not
    check that the booking's id is the requested id; three tests sit
    under a G1 tag or the "(G2, G8)" describe while holding the
    Interface's 400 rows (from not before to; a missing or repeated
    parameter; the content type, the body's shape, other fields), so the
    guarantee list above is the accurate trace; the purity scan misses a
    single-quoted import specifier and `Date()` without `new`.
  - The reviewer checked each Review Focus item by probe (expanded and
    negative years, wrong-typed bodies, content-type variants, the
    let-through fixtures, malformed rooms queries), and ran the five `200`
    fixtures through `roomsView` and `myBookingsView` with the store's
    filters emulated: all five bodies match.
- For simple-login.backend.7, which composes these rules: call
  `isBookingId(id)` before `store.find(id)`, since a `uuid` column raises
  `22P02` on `not-a-booking`; pass the result through `checkCancel` all
  the same.

## Outstanding
- The content-type rule is not verified against sign-in's or against
  Fastify. The Scope says "as for sign-in", and the sign-in code is
  outside this phase's context, so whether sign-in also accepts
  `charset` parameters and any case is not checked; nor is whether
  Fastify hands a `text/plain` body or a missing content type to the
  handler rather than answering 415 itself. Verifying it takes
  simple-login.backend.7's route tests: `POST /api/bookings` with
  `text/plain`, with no content type and with
  `application/json; charset=utf-8`, each compared with `POST /api/login`.

## Learnings
- The Scope states G1 as "an instant is accepted only when
  `new Date(s).toISOString() === s`". That condition is necessary but not
  sufficient: it admits `+010000-01-01T00:00:00.000Z` and
  `-000001-01-01T00:00:00.000Z`, which booking-api@v1's Values ("a
  four-digit year") and the schema's `Instant` pattern refuse. The rules
  apply both. dropped (the contract and its schema already pin the
  four-digit year, and "only when" does not contradict them)
- "as for sign-in" points the Scope at code outside the phase context, so
  the content-type rule had to be read from HTTP's media-type rules
  instead of from a governance file (see Outstanding). spec-updated
- G8, D9 and the schema's `Title` accept titles that render blank or
  reorder text: only zero-width characters (U+200B), C1 controls such as
  U+0085, or a bidi override (U+202E). Every user sees such a title in the
  rooms view. dropped (refusing them refuses what booking-api@v1 accepts,
  a breaking change by its Versioning, for a cosmetic effect on a
  one-laptop product)

## Metrics
- Agent wall-clock: about 30 minutes, 02:31 to 03:00 WIB, from the phase
  switch to this doc; the review sitting is the owner's.
- Review wall-clock: the fresh reviewer took 5 minutes 43 seconds at
  spot-check (148,771 tokens).
- Gate failures before green: none; the gate passed on its first run at
  2729dc9 and again at 75fdd26. Two plan test defects failed once each
  during Tasks 2 and 5 before green.
- Product diff: 522 lines added in 3 files (`booking-rules.ts` 145, its
  two test files 377), against the plan's estimate of about 350 lines in
  about 4 files; tests are 72% of it. Process artifacts: the phase
  context 684 lines, its superpowers derivative 737, the plan 685, this
  doc.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) |
  deferred to {phase-id}
- Disposition of each Learning: spec-updated | contract-bumped (id@v) |
  adr-proposed (ADR-nnn) | dropped (reason)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
