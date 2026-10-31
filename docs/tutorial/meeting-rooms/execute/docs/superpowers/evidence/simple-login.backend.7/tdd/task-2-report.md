# Task 2 report: POST /api/bookings

Status: DONE. Commit 4cb7305 "backend.7: POST /api/bookings".

## Implemented
backend/src/booking-routes.ts: real POST /api/bookings handler (401 first; checkNewBooking with the request's content-type header, parseJson(request.body), account.id, clock(); failure through errorResponse; store.insert ok is 201 toWireBooking, error is 409 BOOKING_CONFLICT naming the stored booking). Local parseJson(raw: unknown): unknown. DELETE keeps the interim tokenOnly stub for Task 3.
Tests: booking-routes.test.ts gets a `post` helper (content type null means header omitted), LOGIN_INVALID, `import { Pool } from "pg"`; contract.replay.test.ts SERVED gains PostBookingResponse.

## TDD evidence
RED: `cd backend && TZ=Asia/Kolkata npx vitest run test/contract.replay.test.ts test/booking-routes.test.ts`
Result: Test Files 2 failed; Tests 27 failed | 28 passed (55). 8 new route tests failed, 19 book-* fixtures failed with e.g. "booking-api/book-too-long: status 501, expected 422" (501 from the Task 1 stub, not 404). Passed already under the stub: the 401 tests (G15 and no-token) and the rest of the 28. Output kept at .superpowers/sdd/2026-11-01-simple-login.backend.7/task-2-red.txt.
Two test-authoring slips found and fixed during GREEN (not handler defects): the default-parameter `undefined` swallowed the "no header" case (fixed with null); a token issued before setClock had expired.
GREEN: same command: 2 files passed, 55 passed (contract.replay 39 = 5+5+29, booking-routes 16). Full `TZ=Asia/Kolkata npx vitest run`: 19 files, 269 passed. `npx tsc --noEmit`: no output, exit 0.

## Observed content types (login vs booking, same header; booking token valid)
- text/plain: login 400 LOGIN_INVALID; booking 400 BOOKING_INVALID
- header omitted, body sent: login 400 LOGIN_INVALID; booking 400 BOOKING_INVALID
- application/json; charset=utf-8: login 200; booking 201
Non-JSON or non-object bodies ("{", "null", "[]", "\"x\"") give 400 BOOKING_INVALID each. No token plus body "{" gives 401. G5: 10 rounds of 20 concurrent POSTs, one 201 and nineteen 409 naming it, each round; Pool(max 20) ended and app closed in finally, no 55006.

## Files
backend/src/booking-routes.ts, backend/test/booking-routes.test.ts, backend/test/contract.replay.test.ts.

## Self-review
No em dash, no banned phrase. Replay brief said 20 book fixtures; 19 book-* failed in RED (the vitest output lists 19). Replay total 39 matches the brief's expectation. Wire Booking has roomName and no account (my first test guess was wrong; fixed to the contract's shape). No concerns.

## Fix round 1: generated Vitest report committed
Cause: my ad hoc `npx vitest run ... --reporter=json` (used for per-file counts) wrote backend/.vitest/json/output.json; `git add backend` then staged it. Check: after deleting backend/.vitest, a plain `TZ=Asia/Kolkata npx vitest run test/booking-routes.test.ts` (16 passed) did not recreate it, so the gate's command does not write it. Therefore .gitignore left alone.
Change: `git rm --cached` of the file in a new commit (4cb7305 not rewritten), local directory deleted.
Check: `git ls-files backend/.vitest` prints nothing; `git status --short` prints nothing after the plain run.
