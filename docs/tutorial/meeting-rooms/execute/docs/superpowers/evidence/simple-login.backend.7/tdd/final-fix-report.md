# Final fix report, simple-login.backend.7

Items 1-5 and the optional app.ts comment done in one commit (see git log, subject "backend.7: survive a connection lost mid-request, ...").

1. In-flight connection loss. server.ts `start`: `pool.on("connect", (client) => client.on("error", () => {}))` with a comment (why it exists, why silent). New test "answers 500 for the request whose connection is lost while it waits on the room lock, and keeps serving" (own database, tag b7_in_flight, advisory lock on a dedicated client, polled wait_event_type='Lock' with a 5 s bound, terminate asserted true, 500, unlock, next POST 201).
   RED (before the fix): the test body passed (500 then 201) but Vitest reported "Unhandled Errors ... Uncaught Exception Error: Connection terminated unexpectedly (node_modules/pg/lib/client.js:204)", last test being the new one; run exit failed. Matches the finding (under Vitest the process is caught rather than exiting 1).
   GREEN: no Unhandled Errors. server.test.ts three runs: 11 passed each, no errors.
2. Idle-loss test: asserts pg_terminate_backend returned a true row, replaced the 500 ms sleep with `until` polling (20 ms step, 5 s bound) for no backend with that application_name; still passes.
3. Message now: "The database cannot be reached or refused the connection (<code>). Start it with npm --prefix backend run db:up, and check that DATABASE_URL names a database that exists." Tests (in-process and spawned) assert the new wording; added a 3D000 test (missing database on the Compose service, never meeting_rooms).
4. Removed the try around createPool (comment says why).
5. booking-routes.ts: constants ROOMS, MY_BOOKINGS, BOOKINGS, BOOKING; BOOKING_ROUTES built from them and the handlers register with them. Covered by booking-routes and replay tests (full suite).
Optional: comment on the FastifyReply cast in app.ts.

Verification: `npx tsc --noEmit` clean. Full suite: 19 files passed, 299 tests passed, 0 errors. Leftover-database query printed nothing.
Files: backend/src/server.ts, backend/src/booking-routes.ts, backend/src/app.ts, backend/test/server.test.ts.
Concerns: the silent client listener also swallows errors on a checked-out client that nothing else logs when the failing call is not a query (none exist today in booking-store).
