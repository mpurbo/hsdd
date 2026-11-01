# Task 4 report

Implemented D-d in backend/src/app.ts: setErrorHandler answers a 4xx on a BOOKING_ROUTES pattern (request.routeOptions.url) with 401 UNAUTHORIZED or 400 VALIDATION_FAILED (booking-api body); login rule unchanged; 5xx rethrown. `frameworkErrors`: DELETE under /api/bookings/ answers 401 or 404 BOOKING_NOT_FOUND; other framework errors go to reply.send(error) (Fastify's default handler; same code/statusCode, `error` label may differ from the raw default for 414). Session store and signedIn now created before Fastify() and shared.

TDD: RED = `TZ=Asia/Kolkata npx vitest run test/booking-routes.test.ts -t "refuses before"`: 5 failed (413, 413, 413, 400, 414), 2 passed (login 400, non-DELETE bad URL already true). GREEN: same command 7 passed. Full suite: 19 files, 290 tests passed; tsc clean.

Files: backend/src/app.ts, backend/test/booking-routes.test.ts.
Concerns: frameworkErrors fallback body for non-booking framework errors is Fastify's default error handler output, not byte-identical to the raw onMaxParamLength body (error label). Untested for 414 outside bookings.
