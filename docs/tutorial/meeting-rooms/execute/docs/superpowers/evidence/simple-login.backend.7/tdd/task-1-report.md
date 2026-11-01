# Task 1 report

Status: DONE_WITH_CONCERNS. Commit 827a3d2 "backend.7: the store in the app; GET /api/rooms and GET /api/me/bookings".

## Implemented
- `AppDeps.store` (required). `buildApp` creates the session store once, builds `signedIn = signedInAccount(accounts, sessions)` as a local const, passes `signedIn` to `registerRoutes` (GET /api/me goes through it) and `registerBookingRoutes`.
- `signedInAccount` in routes.ts. `booking-routes.ts`: `BOOKING_ROUTES`, `BookingRouteDeps`, `registerBookingRoutes` with GET /api/rooms (401, then checkRoomsQuery, then store.overlapping, then roomsView) and GET /api/me/bookings (401, then store.notEndedOf(account.id, clock()), then myBookingsView). 401 via `errorResponse({ code: "UNAUTHORIZED" })`.
- `test/no-store.ts` NO_STORE; `store: NO_STORE` in app/routes/server log tests.
- contract.replay.test.ts: file database, token honours issuedAt, prepare hook, SLUGS + SERVED set.
- New test/booking-routes.test.ts (6 tests: the 5 in the brief plus 401 on /api/me/bookings).

## TDD Evidence
RED: `cd backend && TZ=Asia/Kolkata npx vitest run test/contract.replay.test.ts test/booking-routes.test.ts test/app.test.ts`
Result: 3 files failed, 16 failed | 10 passed. The 9 booking-api GET fixtures: `booking-api/rooms-on-a-date: status 404, expected 200` (and the 8 others likewise: 404 vs 200/400/401); 6 booking-routes tests got `expected 404 to be 200/400/401`; app.test: `GET /api/rooms?...: expected 404 to be 401`. Expected: routes not yet registered.
GREEN: same command: Test Files 3 passed (3), Tests 26 passed (26) (replay 19 = 5+5+9, booking-routes 6, app 1). Full suite: `TZ=Asia/Kolkata npx vitest run`: 19 files, 239 tests passed. `npx tsc --noEmit`: no output.

## Files changed
backend/src/{app,routes,server}.ts, backend/src/booking-routes.ts (new), backend/test/{app,routes,server,contract.replay}.test.ts, backend/test/booking-routes.test.ts (new), backend/test/no-store.ts (new).

## Concerns
1. app.test.ts must see 401 for POST /api/bookings and DELETE /api/bookings/x, but the brief says registerBookingRoutes has only the two GET handlers and Tasks 2/3 own those routes. To satisfy the test I registered interim token-only handlers (401 without a token, else 501) in booking-routes.ts, marked with a comment. Tasks 2 and 3 must replace them (their RED step will then see 501, not Fastify's 404, for authenticated requests; unauthenticated gives 401 already).
2. server.ts `start(port)` had to compile with the required `store`: I added interim wiring (pool on DEFAULT_DATABASE_URL, createBookingStore, onClose ends pool; schema not applied). The existing start test passes against the Compose DB. The real start/configFromEnv/error-listener work (D-e, D-f) is a later task.
3. Server test output prints Fastify log lines from the `start` test (pre-existing behavior).

## Self-review
Diff matches the brief; no em dash or banned phrase in files; tests run on the real database.
