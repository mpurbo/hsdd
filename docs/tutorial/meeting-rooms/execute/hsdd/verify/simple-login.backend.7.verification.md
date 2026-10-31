# Verification: simple-login.backend.7 - Booking endpoints, the service on its database (booking-api@v1)

> Written at apply by the documentation task, once implementation details
> exist, never during planning. Depth per review tier: gate-only = slim
> (gate command, expected output, a 3-5 line checklist, Learnings);
> spot-check = short (commands, expected output, what to eyeball,
> Learnings); full-review = full (every section below). Every tier keeps
> Learnings and Sign-off.

## Commands to run
From the repository root (the directory holding `hsdd/`), with Docker
running (Colima on this laptop; the scripts use `docker compose` where it
exists, else `docker-compose`):

1. One-time setup on a fresh checkout: `npm --prefix backend install`
   (`backend/package-lock.json` is git-ignored, so this resolves the
   ranges in `backend/package.json`).
2. The gate: `npm --prefix backend run gate`. It runs `db:up` (starts the
   Compose service `postgres` and waits until it is healthy), `tsc --noEmit`,
   then `TZ=Asia/Kolkata vitest run`.
3. Contract replay for booking-api, profile-api.v2 and auth-api:
   `npm --prefix backend run replay`. It validates every real response
   against `hsdd/contract/schema/{slug}.schema.json` (booking-api also
   against the endpoint's `$defs`) and reproduces every fixture under
   `hsdd/contract/fixture/{auth-api,profile-api.v2,booking-api}/`.
4. No test database left behind:
   `docker-compose -f backend/compose.yaml exec -T postgres psql -U meeting_rooms -d meeting_rooms -Atc "SELECT datname FROM pg_database WHERE datname LIKE 'test_%'"`
   (or `docker compose`).
5. The phase's Verification by hand:
   `bash docs/superpowers/evidence/simple-login.backend.7/verify.sh "$PWD" <an empty log directory>`.
   It needs port 3000 free and the Compose service up. It writes one
   booking into `meeting_rooms` and cancels it, creates and drops the
   database `b7_verify_empty`, and prints the transcript with tokens
   shortened. Its dates are fixed (the next day in Jakarta as seen on
   2026-11-01: `FROM=2026-11-01T17:00:00.000Z`, `TO=2026-11-02T17:00:00.000Z`,
   the booking 03:00Z to 04:00Z on 2026-11-02); a later run moves `FROM`,
   `TO`, `START` and `END` to the next day, or the booking answers 422
   `BOOKING_STARTED`.

## Expected output
- Step 2 exits 0: `Test Files  19 passed (19)`, `Tests  299 passed (299)`,
  and `tsc` prints nothing. Per file: accounts 6, app 1, booking-routes 31,
  booking-rules.fixtures 39, booking-rules 45, booking-store.race 1,
  booking-store 28, contract.replay 46, db 8, domain 5, passwords 6,
  replay 28, requests 22, rooms 2, routes 8, schema 6, server 11,
  sessions 5, zone 1.
- Step 3 exits 0 with 46 tests in `test/contract.replay.test.ts`: 5
  `auth-api/…`, 5 `profile-api.v2/…`, 35 `booking-api/…` (every one
  `exact`), and the count test "replays auth-api 5, profile-api.v2 5 and
  booking-api 35 fixtures". No profile-api@v1 fixture is replayed.
- Step 4 prints nothing.
- Step 5, in order: when the service never ran on `meeting_rooms`, it has
  no `booking` table before the first start and has one after; the service
  logs `Server listening at http://127.0.0.1:3000`; `GET /api/rooms` for
  the next day in Jakarta answers 200 with Merapi, Bromo, Thames, Kew in
  that order; booking Merapi 03:00Z to 04:00Z answers 201; an overlapping
  request answers 409 `BOOKING_CONFLICT` whose `error.conflict` is the
  201's booking; after a restart the old token answers 401 `UNAUTHORIZED`,
  and after a new sign-in `GET /api/me/bookings` lists the booking with the
  same id; `DELETE` answers 204 with a body of 0 bytes; on
  `b7_verify_empty`, created empty, the service lists the four rooms with
  `"bookings": []` and `\dt` then shows `booking`; with `DATABASE_URL`
  naming a port nothing listens on, `npm --prefix backend start` exits 1
  printing a line that names `npm --prefix backend run db:up` and no
  password; no service log line holds the password, a token or the
  database URL.

## Observed
2026-11-01, branch `lane/backend`, spec 3eb46d2, Node.js v24.18.0, npm
11.16.0, PostgreSQL 17 (`postgres:17-alpine`) on the Compose service.
Evidence is committed under `docs/superpowers/evidence/simple-login.backend.7/`
(hostnames in log lines replaced by `<host>`).

**Gate before the phase** (`gate-before.txt`, tree 3eb46d2 after a clean
install): exit 0, 18 files, 224 tests; the replay 10 tests (auth-api 5,
profile-api.v2 5). Per file then: accounts 6, app 1,
booking-rules.fixtures 39, booking-rules 45, booking-store.race 1,
booking-store 28, contract.replay 10, db 7, domain 5, passwords 6,
replay 28, requests 22, rooms 2, routes 8, schema 6, server 4, sessions 5,
zone 1.

**Gate after the phase** (`gate.txt`, `gate-tests.txt`, `replay.txt`,
HEAD fb8be52, after `rm -rf backend/node_modules backend/package-lock.json`
and `npm --prefix backend install`): `npm --prefix backend run gate` exit 0,
19 files, 299 tests, `tsc` silent, per file exactly as in Expected output
(new: booking-routes 31; changed: contract.replay 10 to 46, db 7 to 8,
server 4 to 11). `npm --prefix backend run replay` exit 0, 46 tests: the
45 fixtures and the count test. Step 4 printed nothing; the Compose service
held `meeting_rooms`, `postgres`, `template0`, `template1`.

**Manual Verification** (`curl.txt`, produced by `verify.sh` at 21:20Z on
2026-10-31, which is 2026-11-01 04:20 in Jakarta): every expectation of
step 5 held. `meeting_rooms` had no `booking` table before the first start
and had one after, so the default database also took the empty-database
path. Booking id `25d1c58b-7e7e-411c-89c6-659506e1731c` was returned by
the 201, named by the 409, listed after the restart, and cancelled with a
204 of 0 bytes. The unreachable start printed
`The database cannot be reached or refused the connection (ECONNREFUSED). Start it with npm --prefix backend run db:up, and check that DATABASE_URL names a database that exists.`
and exited 1. The four service logs held 0 lines with the password, a
token or `meeting_rooms:meeting_rooms`.

**What was built** (`backend/`, 4 source files +197/-15, 8 test files
+633/-23): `src/booking-routes.ts` (new) holds the four handlers, each
token first through `signedInAccount` (the check `GET /api/me` now uses
too), then phase 5's rules, then phase 6's store, then the rules' view or
`errorResponse`; `DELETE` answers 404 when `remove` finds the row already
gone. `src/app.ts`: `AppDeps.store` (required); one session store shared by
the routes and both refusal handlers; `setErrorHandler` answers a 4xx on a
booking route (matched by route pattern) with 401 when the token fails,
else booking-api's 400, and keeps auth-api's 400 on `POST /api/login`;
`frameworkErrors` answers ids Fastify refuses before routing on
`DELETE /api/bookings/…` with 401, else 404 `BOOKING_NOT_FOUND`.
`src/server.ts`: `start(port, databaseUrl)` (pool, app, listeners, schema,
listen on 127.0.0.1; closing the app ends the pool; every failure path
closes the app), `configFromEnv(env)` read only by the `import.meta.main`
block, which prints the rejection's message and exits 1. `test/db.ts`:
`testDatabase({ empty: true })`, used by `server.test.ts` alone.
`test/no-store.ts`: a store that rejects every call, for tests that reach
no booking route.

**TDD** (subagent-driven-development; each implementer's report with its
RED and GREEN commands and output is in `tdd/`):
- Task 1 (827a3d2): RED 16 failed (the 9 GET fixtures `status 404`, route
  tests 404). GREEN replay 19 (5+5+9), suite 239.
- Task 2 (4cb7305, b0b7a03): RED 27 failed (19 `book-*` fixtures and 8
  route tests answered 501 by Task 1's interim stub; `book-unknown-token`
  was already 401 through it). GREEN replay 39, suite 269.
- Task 3 (15303b3): RED 8 failed (5 `cancel-*` fixtures 501, 3 route
  tests). The count test passed at once: the fixture counts were already
  true. GREEN replay 46, suite 283.
- Task 4 (ff566b7): RED 5 failed (413, 413, 413, 400 `FST_ERR_BAD_URL`,
  414 `FST_ERR_MAX_PARAM_LENGTH`). GREEN suite 290.
- Task 5 (4964366): RED 3 failed. The new `db.test.ts` test (a database
  created with no schema has no `booking` table) passed before any change,
  since `createTestDatabase` took its `apply` function since phase 4; the
  restart test's "table is null before the first start" assertion is the
  one that failed for the empty option. GREEN suite 293.
- Task 6 (d57c424): RED 2 failed, and the idle-loss test ended in Vitest
  "Unhandled Errors" (57P01 `terminating connection due to administrator
  command`). The booking-route log test passed first; against the named
  mutant (a handler logging `request.headers.authorization` at `info`) it
  failed 1 of 31, and the mutant was reverted. GREEN suite 297.
- Final-review fixes (fb8be52): the in-flight test failed with Vitest
  "Unhandled Errors: Uncaught Exception: Connection terminated
  unexpectedly" before the fix; GREEN `server.test.ts` three runs in a row,
  11 passed each; suite 299.

**Deferred to this phase by earlier signed docs, now settled:**
- simple-login.backend.5's Outstanding (the content-type rule "as for
  sign-in"): `POST /api/bookings` and `POST /api/login` compared with the
  same header each time (`booking-routes.test.ts`, "content type"):
  `text/plain` 400 and 400; no `content-type` header with a JSON body 400
  and 400; `application/json; charset=utf-8` 200 and 201. Each 400 carries
  its own contract's body (`Username and password are required.` and
  `The request is not valid.`). Fastify hands both bodies to the handler as
  a string; it never answers 415 itself, because the app replaces Fastify's
  parsers with one catch-all string parser. Verified.
- simple-login.backend.4's deferred minor (no pool `'error'` listener):
  `start` attaches one that logs the code and message at `warn`, and the
  test that terminates the service's idle connections
  (`pg_terminate_backend` on its own test database, by `application_name`)
  shows the next request answered 200. The final review found the same
  crash for a connection lost while a request holds it (a `POST` waiting on
  the room's advisory lock): pg-pool removes its listener from a
  checked-out client. `start` now gives every client a silent `'error'`
  listener; the in-flight request answers 500 and the next `POST` 201
  (`server.test.ts`, "answers 500 for the request whose connection is lost
  while it waits on the room lock, and keeps serving"). Verified, by
  `pg_terminate_backend`, not by a restart of the Compose service (see
  Outstanding).

**Reviews** (full-review tier: a fresh implementer and a fresh task
reviewer per task, then one whole-branch review; the ledger with every
finding and ruling is `review-ledger.md`):

| Review | Critical | Important | Minor | Outcome |
|---|---:|---:|---:|---|
| Task 1 | 0 | 0 | 4 | approved |
| Task 2 | 0 | 1 | 3 | Important fixed in b0b7a03 (a generated `backend/.vitest/json/output.json` was committed); re-review: addressed |
| Task 3 | 0 | 0 | 3 | approved |
| Task 4 | 0 | 0 | 4 | approved |
| Task 5 | 0 | 0 | 3 | approved |
| Task 6 | 0 | 0 | 5 | approved |
| Final, whole branch | 0 | 1 | 4 | all five fixed in fb8be52; re-review: 5 of 5 addressed, no new Critical or Important, 2 new Minor |

The final review's Important was the in-flight crash above. Its Minors,
fixed in the same commit: the idle-loss test could pass without
terminating anything (it now asserts a terminated backend and polls
instead of sleeping); the refusal read "cannot be reached" for a wrong
password or a missing database (now "cannot be reached or refused the
connection (<code>)", still naming `db:up`, with a `3D000` test); a dead
`try` around `createPool`; the four route patterns were written twice
(now named once and `BOOKING_ROUTES` is built from them). The final
review's triage kept every task-level Minor as not blocking; they stay
listed in the ledger.

**Rulings the phase context did not settle** (each recorded in the ledger
with its cost if wrong):
1. A body Fastify refuses on `DELETE /api/bookings/{id}` answers 401, else
   400 `VALIDATION_FAILED`, as the Scope says for every booking route,
   though booking-api@v1's DELETE table has no 400 (Learning 1).
2. An id Fastify refuses before routing on `DELETE /api/bookings/…`
   (malformed percent escape, over 100 characters) answers 401, else 404
   `BOOKING_NOT_FOUND`: the contract says an id that is not a UUID is 404;
   left as is, Fastify answered 400 or 414 in its own shape (Learning 2).
3. Tests that reach no booking route pass a store that rejects every call
   instead of a real test database; it holds and serves nothing.
4. The pool's listeners live in `start`, not in `createPool`.
5. `configFromEnv(env)` is a pure function, so the D4 default is tested
   without touching `meeting_rooms`.
6. `start` rejects with one message for any database failure before
   listening, naming `db:up` and the error's code only, never its message
   (a malformed URL's `TypeError` carries the input).
7. Task 1's interim token-only `POST` and `DELETE` handlers (401, else
   501) stood until Tasks 2 and 3 replaced them.
8. The silent per-client `'error'` listener stands: an error it hides
   surfaces on that client's next query, which discards the client.

## Outstanding
- A restart of PostgreSQL itself while the service runs was not exercised:
  this run was told not to stop or restart the Compose service, which
  another lane shares. Both connection-loss paths were proven with
  `pg_terminate_backend` (57P01, the code a fast shutdown sends). To
  verify: with `npm --prefix backend start` running, `npm --prefix backend run db:down`
  then `npm --prefix backend run db:up`; the process must stay up, a
  request during the outage answers 500, and the first request after
  `db:up` reports healthy answers normally.

## Learnings
- booking-api@v1's `DELETE /api/bookings/{id}` table has no 400 row, while
  the phase Scope says a request Fastify refuses on any booking route
  answers 400 `VALIDATION_FAILED` when the token is good. The only DELETE
  request that reaches that rule is one with a body over 1 MiB, which no
  consumer sends; the Scope was followed. dropped (no consumer can meet
  it; making it 404 or ignoring the body would be a node-spec edit for an
  input nobody sends)
- The same Scope sentence, read literally, would answer the ids Fastify
  refuses before routing (a malformed percent escape, an id over Fastify's
  100-character `maxParamLength`) with 400, but the contract defines such
  an id as "not a UUID", 404 `BOOKING_NOT_FOUND`. Fastify answers those
  outside `setErrorHandler`, through `frameworkErrors`, which nothing in the
  plan named. The contract was followed. spec-updated
- simple-login.backend.4's deferred minor described only idle connections;
  a connection lost while phase 6's store holds a checked-out client (any
  request waiting on a room's advisory lock, up to nineteen at once in G5)
  ended the process the same way. Fixed here; nothing in governance named
  the narrower case. dropped (fixed in this phase)
- A lost connection now answers the request that held it with Fastify's
  default 500 body, not booking-api@v1's error envelope. The contract
  defines no 5xx and G5 rules out a 5xx only for contention, which still
  never produces one. dropped (outside the contract; consumers already
  treat an unknown failure as failure)
- The size estimate was ~9 files (~400 lines); the phase changed 12 files
  under `backend/`: 197 lines added in `src/`, 633 in `test/`, most of them
  the route tests (394) and the `start` tests on real sockets and real
  connection loss. dropped (sizing data for later composition phases; the
  phase fit one sitting)

## Metrics
- Agent wall-clock: about 65 minutes. Phase switch committed 03:37
  (local, UTC+7), plan 03:46, the six code tasks 03:49 to 04:03, final
  review and its fixes to 04:17, clean-install gate and manual verification
  04:19 to 04:21, then this document.
- Review wall-clock, full-review tier through
  superpowers:subagent-driven-development (harness-reported agent
  durations): six task reviews about 3 minutes in all, two scoped
  re-reviews under 1 minute, the whole-branch review 10 min 34 s; about
  14 minutes.
- Gate failures before green: none. Every full-suite run the implementers
  reported was green, and the gate from a clean install passed at its
  first run. The RED runs above were the intended failing steps.
- Tokens: about 1,046,000 across 16 subagent runs (harness-reported); the
  controller's are not reported.
- Product diff vs process artifacts: product +830 / -38 lines in 12 files
  under `backend/` (no generated code); process: generic phase context
  715, superpowers derivative 768, plan 362, plus the evidence directory
  and this document.

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
