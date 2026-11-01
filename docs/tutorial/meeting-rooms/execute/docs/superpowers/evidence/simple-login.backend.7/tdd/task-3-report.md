# Task 3 report: DELETE /api/bookings/{id}; full replay

Commit 15303b3 "backend.7: DELETE /api/bookings/{id}; replay all 45 fixtures".

## Implemented
- booking-routes.ts: real DELETE handler (401, checkCancel with store.find, errorResponse on failure, store.remove: true 204, false 404 BOOKING_NOT_FOUND). `tokenOnly` and the unused Fastify type imports removed.
- contract.replay.test.ts: SERVED and the filter removed, `endpointDef` import dropped, count test added (auth-api 5, profile-api.v2 5, booking-api 35).
- booking-routes.test.ts: 4 new tests (G11 sequence, find-then-row-gone race, upper-case UUID, G16 it.each x4 = 7 cases total in the describe).

## TDD evidence
RED: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-routes.test.ts test/contract.replay.test.ts`
8 failed | 61 passed (69). Replay: cancel-malformed-id "status 501, expected 404", cancel-my-booking 501 vs 204, cancel-someone-elses 501 vs 403, cancel-started 501 vs 422, cancel-unknown 501 vs 404 (501 from the interim stub, not Fastify's 404; the sixth cancel fixture, the 401 one, passes via the stub). Route tests: G11 (204 expected), already-gone race and upper-case failed on 501.
Test defect found: the upper-case test used ID1 (digits only, upper-casing is a no-op, so it got 204 after the implementation). Fixed with a letters-bearing UUID; then passed.
GREEN: same command: 2 files passed, 69 passed (replay 46 = 45 fixtures + count test; booking-routes 23).
Full suite: 19 files, 283 tests passed. `npx tsc --noEmit` printed nothing (exit 0).

## Self-review
- No em dash in the three files; git status clean after commit; nothing under hsdd/ touched.
- The upper-case test passes via checkCancel's isBookingId before the lower-case-matching uuid column can find the row.

## Concerns
- None. Review Focus 1 (Fastify-refused ids) is Task 4's.
