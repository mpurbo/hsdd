# Verification: simple-login.backend.4 - Time zones, booking types, PostgreSQL and the booking replay rig

## Commands to run
From the repository root, with Docker running (Colima on macOS). A fresh
checkout needs only the install; the gate and the replay start PostgreSQL
17 themselves through `db:up`.

```sh
npm --prefix backend install
npm --prefix backend run gate
npm --prefix backend run replay
docker-compose -f backend/compose.yaml exec postgres psql -U meeting_rooms -l   # or: docker compose ...
```

The replay validates the real `POST /api/login` and `GET /api/me` responses
against hsdd/contract/schema/auth-api.schema.json and
hsdd/contract/schema/profile-api.v2.schema.json and reproduces
hsdd/contract/fixture/auth-api/ and hsdd/contract/fixture/profile-api.v2/
(profile-api@v2 is this phase's produced contract). booking-api@v1 has no
route yet: its rig is proven inside the gate by `backend/test/replay.test.ts`.

## Expected output
- `db:up`: container `meeting-rooms-postgres-1` reports `Healthy`; exit 0.
- `gate`: `tsc --noEmit` prints nothing; Vitest reports 14 files, 111 tests passed; exit 0.
- `replay`: 10 tests passed (auth-api 5, of which 4 `exact` and 1 `schema`; profile-api.v2 5 `exact`); exit 0.
- `psql -l`: `meeting_rooms`, `postgres`, `template0`, `template1` only; no `test_` database.

Checklist:
- [x] The gate passes from a clean install and starts PostgreSQL on its own.
- [x] `GET /api/me` returns `"timeZone": "Asia/Jakarta"` for Ayu and `"Europe/London"` for Budi, in the replay and against the running service.
- [x] No database is left behind by a test, including when a database's schema cannot be applied.
- [x] The booking-api@v1 rig: all 35 fixture responses validate against the top-level schema and their endpoint's `$defs`, each reproduces against an app that returns it, and a `201` with a `given` or non-UUID id, or a `204` with a body, is reported.
- [x] Every test runs in `Asia/Kolkata` (`Intl` reports `Asia/Calcutta`); a test fails otherwise.

## Observed
2026-11-01, on macOS with Colima, Node.js 24.18.0, standalone `docker-compose` 5.6.1 (no `docker compose` plugin).

- **Before the phase** (2e9ef03): `tsc` clean; Vitest 68/72 (`accounts.test.ts` 4/6, `contract.replay.test.ts` 8/10). The gate was red: `me-ayu` and `me-budi` under profile-api.v2 carry `timeZone`, as profile-api@v2's 2026-10-31 Versioning entry says they would until this phase.
- **After the phase** (ca8d1d0), from a clean install: `rm -rf backend/node_modules backend/package-lock.json`, `npm --prefix backend run db:down` (container and network removed, volume kept), `npm --prefix backend install` (pg 8.23.1, @types/pg 8.23.1, fastify 5.12.7, typescript 7.0.2, vitest 5.0.5). `npm --prefix backend run gate`: the container was created, started and reported `Healthy`; `tsc` printed nothing; 14 files, 111 passed, exit 0. `npm --prefix backend run replay`: 10 passed, exit 0: auth-api `login-empty-username`, `login-missing-password`, `login-success` (schema), `login-unknown-user`, `login-wrong-password`; profile-api.v2 `me-ayu`, `me-budi`, `me-expired-token`, `me-no-token`, `me-unknown-token`.
- Tests per file after: accounts 6, app 1, contract.replay 10, db 7, domain 5, passwords 6, replay 28, requests 22, rooms 2, routes 8, schema 6, server 4, sessions 5, zone 1.
- **Phase Verification**: with `npm --prefix backend start` running, `curl` sign-in and `GET /api/me` gave
  `{"id":"u_001","username":"ayu","displayName":"Ayu Lestari","email":"ayu@example.com","phone":"+62 812 3456 7890","memberSince":"2024-03-14","timeZone":"Asia/Jakarta"}` and
  `{"id":"u_002","username":"budi",...,"memberSince":"2025-01-09","timeZone":"Europe/London"}`.
  After the gate, `psql -l` listed the four databases above and no other. A second `db:up` while the service was up returned in under a second with exit 0.
- **Test first**: every task's tests ran red before its code, with the failing output kept: (1) 5 failures for the missing `timeZone` (accounts key set, `me-ayu`, `me-budi`, and the two replays); (2) `Cannot find module '../src/rooms.ts'`, `BOOKING_ERRORS` undefined, and `tsc` TS2305 for `Booking`, `BookingStore`, `NewBooking`, `StoredBooking`; (3) `Cannot find module '../src/db.ts'`; (4) `db.resetBookings is not a function` and `tsc` TS2305 `GivenBooking`; (5) `expected [ 'Asia/Kolkata', 'Asia/Calcutta' ] to include 'Asia/Jakarta'` and the old script strings; (6) `tsc` refusing the slug `booking-api` and the missing `endpointDef`, `judgeResponse`, `EXPIRED_TOKEN_AGE_MS`, with 12 Vitest failures. No test here covers behavior a merged dependency phase delivered, so none needed a run against an earlier commit or a named mutant.
- **Final review** (one fresh reviewer over 2e9ef03..7b7aeb4): Critical 0, Important 2, Minor 8. Fixed, each with a test seen failing first:
  - `createTestDatabase` left the database and its pool behind when the schema could not be applied after `CREATE DATABASE` (test "drops the database it created when the schema cannot be applied").
  - The rig reported a schema failure as every Ajv `oneOf` branch (176 lines for an upper-case `201` id, 60 for a wrong 401 message) and skipped the body comparison. It now reports the top-level schema in one line and the deepest violations of the endpoint's `oneOf` branch for the response's status, and always compares the body (3 to 4 lines in both cases).
  - Deferred minors with a later phase in view: `createPool` attaches no `'error'` listener, so a dropped idle connection would end the process once `server.ts` holds the pool (simple-login.backend.7); the rig calls `prepare` only for a fixture that has a `clock`, so a booking-api fixture missing `clock` or `given` would replay without it.
- **Interfaces later phases build on**: `BookingStore`, `BOOKING_ERRORS` and the booking types in `backend/src/domain.ts`; `ROOMS` in `backend/src/rooms.ts`; `createPool(url)` and `applySchema(pool)` in `backend/src/db.ts` (no environment read); `testDatabase()` with `pool`, `resetBookings()`, `seedBookings(given)` in `backend/test/db.ts`; in `backend/test/replay.ts` the hooks `token(username, issuedAt?)`, `expiredToken(username)` and `prepare(fixture)`: for a fixture with a `clock`, the rig issues `{{token:u}}` at `clock` and `{{expired-token:u}}` at `clock` minus 30 minutes and 1 second through `token`, then calls `prepare`, then sends the request.

## Outstanding
- The `docker compose` (plugin) branch of `backend/scripts/db-up.mjs` was not exercised: this host has only `docker-compose`, so every run took the fallback. Verify by running `npm --prefix backend run db:up` and `db:down` on a host where `docker compose version` succeeds.

## Learnings
- The phase's Dependencies line names booking-api@v1's schema and fixtures "as drafted (`draft`)"; at spec 2e9ef03 the contract is `stable` with `phase_ids: final`. The rig reads only the schema and the 35 fixtures, which match what the Scope describes. dropped (stale wording; `stable` supersedes `draft` and nothing in this phase depended on the difference)
- The size estimate was ~14 files (~400 lines); the phase changed 18 files under `backend/`: 101 lines added in `src/`, 696 in `test/`, 53 in the Compose file, the script and `package.json`. The replay rig and the test-database helper are test code, and they carry most of the weight. dropped (sizing data for later estimates of rig phases; the phase still fit one sitting)

## Metrics
- Agent wall-clock: about 30 minutes from the phase switch (01:59) to the green gate from a clean install (02:27); the plan was committed at 02:08 and the six code tasks at 02:16.
- Review wall-clock: final whole-branch review 7 min 24 s (one fresh reviewer; gate-only tier, superpowers:executing-plans); fix pass about 6 minutes.
- Gate failures before green: the gate was red on arrival (4 failures above); after Task 5 introduced the new gate, every gate run was green.
- Tokens: the reviewer used 165,814 (harness-reported); the executor's are not reported.
- Product diff vs process artifacts: product +850 / -44 lines in 18 files under `backend/` (no generated code); process +1,835 lines (generic phase context 766, superpowers derivative 820, plan 249), plus this document.

## Sign-off
- Reviewer / date: Claude for Purbo Mohamad (owner proxy, delegated by the owner before the run), 2026-11-01
- Review tier applied: gate-only: the gate rerun green by the orchestrator (14 files, 111 tests, PostgreSQL started by the gate itself); the agent's clean-install run and its one final review (0 Critical, 2 Important fixed with failing tests first) read
- Disposition of each Outstanding item: the plugin branch of db-up.mjs (docker compose): waived (this host has only the standalone docker-compose; the branch is a one-line command choice, read and judged right)
- Disposition of each Learning: both dropped, each with the reason recorded above

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
