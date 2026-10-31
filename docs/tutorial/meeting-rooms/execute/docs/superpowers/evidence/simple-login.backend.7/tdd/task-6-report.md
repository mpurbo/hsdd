# Task 6 report

Status: DONE.

## Implemented (backend/src/server.ts)
- start: createPool (a throw, e.g. malformed URL, becomes the D-e rejection), buildApp, pool.on('error') logging only code and message at warn via app.log, onClose ends the pool, applySchema (failure: await app.close() which runs onClose and ends the pool, then reject with Error("The database cannot be reached (<code>). Start it with npm --prefix backend run db:up, or set DATABASE_URL to a database that exists.")), then listen (failure: close the app, rethrow).
- code is error.code, else error.name; never the message.
- import.meta.main block: catches, writes message to stderr, process.exit(1).
- app.close() on a never-listened app does run onClose and end the pool: the in-process start(0, UNREACHABLE) test returns, prints nothing, and Vitest exits normally.

## TDD evidence
RED: `cd backend && TZ=Asia/Kolkata npx vitest run test/server.test.ts test/booking-routes.test.ts`
 -> Test Files 1 failed | 1 passed; Tests 2 failed | 38 passed (40); Errors 1.
 - start rejects naming db:up: FAIL (message was pg's connect ECONNREFUSED).
 - entry exits non-zero: FAIL (stderr had the unhandled rejection stack, Error: connect ECONNREFUSED 127.0.0.1:1, no db:up; Node exit status 1 but message missing).
 - lost connection: test itself passed, run ended with "Unhandled Errors ... Uncaught Exception: error: terminating connection due to administrator command" (code 57P01, from pg-protocol parseErrorMessage), "Vitest caught 1 unhandled error".
 - log test (booking-routes): passed first (Fastify logs no headers).
GREEN: same command -> Test Files 2 passed; Tests 40 passed (40); no Unhandled Errors. The log shows `"code":"57P01","message":"terminating connection due to administrator command","msg":"idle database connection lost"` at level 40, and the next request after 500 ms answered 200 (no dead-client hit, so the wait was not raised).
Mutant: added `request.log.info({ authorization: request.headers.authorization }, "mutant")` to GET /api/me/bookings -> booking-routes.test.ts: Tests 1 failed | 30 passed, the log test "AssertionError: expected [ Array(1) ] to deeply equal []". Reverted with git checkout; booking-routes tests 31 pass.
Full: Test Files 19 passed (19), Tests 297 passed (297); `npx tsc --noEmit` clean.

## Files
backend/src/server.ts, backend/test/server.test.ts (3 tests in "start when the database fails"; restart test still first), backend/test/booking-routes.test.ts (log test; also asserts no line mentions "authorization").

## Leftover databases
`SELECT datname ... LIKE 'test_%'` printed nothing. git status clean after commit. No em dash in changed files.

## Self-review / concerns
- The Fastify logger: true output is verbose in the restart/lost-connection tests (existing behaviour of start with logger: true), not new noise from the failure path.
- The URL's password could still reach a log only via pg error messages; the listener logs message, which for 57P01 is server text. A connection-phase error with a message echoing the URL is not known for pg; code is kept alongside. Say if you want message dropped from the warn.
- Pool-creation try/catch is nearly unreachable (pg parses lazily); kept for malformed URLs per D-e.
