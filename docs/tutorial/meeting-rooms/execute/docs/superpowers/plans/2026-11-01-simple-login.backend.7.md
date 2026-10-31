# simple-login.backend.7: Booking endpoints, the service on its database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve booking-api@v1's four endpoints from the real Fastify app on its PostgreSQL store, start the service on its database (schema applied at start, pool closed on close), and replay all 45 fixtures of auth-api@v1, profile-api@v2 and booking-api@v1 in the gate.

**Architecture:** Composition only. Phase 5's pure rules (`backend/src/booking-rules.ts`) decide every answer except the conflict; phase 6's `createBookingStore(pool)` (`backend/src/booking-store.ts`) holds the bookings. A new `backend/src/booking-routes.ts` wires them behind the same bearer check `GET /api/me` uses; `backend/src/app.ts` gains the store and the mapping of requests Fastify refuses before a handler; `backend/src/server.ts` becomes the imperative shell that owns the pool.

**Tech Stack:** TypeScript on Node.js 24 (type stripping, `import.meta.main`), Fastify 5.12, `pg` 8, Vitest 5, PostgreSQL 17 on the Compose service (`npm --prefix backend run db:up`).

**Spec:** `hsdd-context/superpowers/simple-login.backend.7.md` (its generic body is `hsdd-context/simple-login.backend.7.md`). Two items deferred by earlier signed verification docs are also covered: simple-login.backend.5's Outstanding (content type of `POST /api/bookings` compared with `POST /api/login`, Task 2) and simple-login.backend.4's deferred minor (no `'error'` listener on the pool once `server.ts` holds it, Task 6).

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 7 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate ``npm --prefix backend run gate` plus contract replay for booking-api, profile-api.v2 and auth-api: `npm --prefix backend run replay`` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.7.verification.md from
   hsdd/templates/verification.md at full-review depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier full-review: design rationale for every non-obvious choice; full verification doc.
9. Every claim that a task is done, a test passes or a defect is fixed
   follows superpowers:verification-before-completion: it cites the command
   that was run and the output it printed, never an inference from the diff.
10. A test that fails when it should pass, or behavior the plan did not
    expect, goes through superpowers:systematic-debugging: find the root
    cause before any fix.

Project rules for this run, in addition: every command runs from the
worktree root `<repo>`
(cd into it in every shell command); never stop or restart the Compose
service (`db:up` on a running service is a no-op and is fine); no em dash
character (U+2014), and none of the banned phrases each task brief names, in
any file written; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A `DELETE /api/bookings/{id}` whose id Fastify refuses before any handler (a malformed percent escape such as `%E0%A4%A`, or an id over Fastify's 100-character `maxParamLength`): Fastify answers 400 or 414 in its own shape, outside `setErrorHandler`. booking-api@v1 says an id that is not a UUID is 404 `BOOKING_NOT_FOUND`, after the 401 check. Task 4 pins both.
2. The database drops the service's idle connections (a PostgreSQL restart, an administrator's `pg_terminate_backend`): with no `'error'` listener the pool's `'error'` event ends the process (backend.4's deferred minor). The service must log it and serve the next request. Task 6 pins it.
3. `POST /api/bookings` with `text/plain`, with no content type, and with `application/json; charset=utf-8`, compared with `POST /api/login` (backend.5's Outstanding). Task 2 pins all three.
4. `GET /api/rooms` with `from` before year 1 (`0000-01-01T00:00:00.000Z`, an instant by G1 that PostgreSQL refuses), and with its colons percent-encoded: a 200, never a 5xx. Task 1 pins both.
5. A booking cancelled between the route's `find` and its `remove` (two cancels of one booking, or any writer in between): the store's `remove` gives false, and the answer is 404 `BOOKING_NOT_FOUND`, never a 5xx or a second 204. Task 3 pins it.

## Design rationale (full-review)

- **D-a. `store` is required in `AppDeps`.** A service without its store cannot exist by type. Test files that never reach a booking route (`app.test.ts`, `routes.test.ts`, the existing log test in `server.test.ts`) pass `NO_STORE` from `backend/test/no-store.ts`, whose every method rejects with `Error("this test reaches no booking route")`. It holds no bookings and answers nothing, so it is not the mock or in-memory stand-in the Isolation strategy forbids: any test that reaches it fails. Alternative: a real test database in those files too (about 30 ms each and a PostgreSQL dependency for auth-only tests); rejected as cost with no extra proof.
- **D-b. One token check for every authenticated route.** `signedInAccount(accounts, sessions)` in `routes.ts` returns `(authorization: string | undefined) => Account | undefined`; `GET /api/me` and the four booking routes all use it, so G16's "as `GET /api/me` does" holds by construction.
- **D-c. Booking routes in their own module.** `backend/src/booking-routes.ts` holds the four handlers and the route list; `routes.ts` keeps sign-in and the profile. Each handler is: token, then phase 5's check, then phase 6's store, then phase 5's view or `errorResponse`.
- **D-d. Requests Fastify refuses before a handler.** `setErrorHandler` matches a booking route by `request.routeOptions.url` (the route pattern, so `/api/bookings/:id` matches every id): a 4xx answers 401 `UNAUTHORIZED` when the token fails, else 400 `VALIDATION_FAILED` with booking-api@v1's message, as the Scope says for every booking route. Login keeps its `startsWith("/api/login")` rule and auth-api@v1's body. 5xx errors are rethrown to Fastify's default handler as today. Fastify's `frameworkErrors` option (called for `FST_ERR_BAD_URL`, `FST_ERR_MAX_PARAM_LENGTH`, `FST_ERR_ASYNC_CONSTRAINT`, before any route is matched) maps a `DELETE` whose URL starts with `/api/bookings/` to 401, else 404 `BOOKING_NOT_FOUND`: booking-api@v1's DELETE table says an id that is not a UUID is 404, and has no 400. Any other framework error keeps Fastify's own body, `{ error: "Bad Request", code, message, statusCode }` with `statusCode` as its status.
- **D-e. `start(port, databaseUrl)` order.** Create the pool; build the app with `createBookingStore(pool)`; attach the pool's `'error'` listener (logs `code` and `message` at `warn` through `app.log`, nothing else, so the URL never reaches a log); add an `onClose` hook that ends the pool; apply the schema; listen on `127.0.0.1`. A schema failure ends the pool and rejects with `Error("The database cannot be reached (<code>). Start it with npm --prefix backend run db:up, or set DATABASE_URL to a database that exists.")`, where `<code>` is the error's `code` or its `name`: never its message or the URL (a malformed URL's `TypeError` carries the input). A listen failure closes the app (which ends the pool) and rethrows.
- **D-f. Configuration as a pure function.** `configFromEnv(env: NodeJS.ProcessEnv): { port: number; databaseUrl: string }` reads `PORT` (default 3000, `Number(...)` as today) and `DATABASE_URL` (default `DEFAULT_DATABASE_URL`). Only the `import.meta.main` block passes `process.env` to it, so the default is tested without any test touching `meeting_rooms` (D8). The block prints the rejection's `message` to stderr and exits 1.
- **D-g. The pool's `'error'` listener lives in `start`, not in `createPool`.** It needs the app's logger, and the test helpers in `backend/test/db.ts` never meet a dropped idle connection (no `FORCE` drop, no restart). Tested by `pg_terminate_backend` on the connections tagged with an `application_name` the test puts in the URL it passes to `start`, so no Compose restart is needed.
- **D-h. The replay grows with the routes.** `contract.replay.test.ts` gets the `booking-api` slug in Task 1 behind a set of served endpoints (`GetRoomsResponse`, `GetMyBookingsResponse`), Task 2 adds `PostBookingResponse`, and Task 3 removes the set, so each route task's failing step is its own fixtures failing with Fastify's 404. When Task 3 ends, the replay is 45 fixtures: auth-api 5, profile-api.v2 5, booking-api 35.

## Shared test setup for `backend/test/booking-routes.test.ts` (created in Task 1)

```ts
const db = testDatabase();               // D8, with the schema
beforeEach(() => db.resetBookings());
const NOW = "2026-11-04T12:00:00.000Z";  // every booking below is on 2026-11-05
const PASSWORDS: Record<string, string> = { ayu: "sunrise-42", budi: "harbor-17" };
// service(store = createBookingStore(db.pool)) returns { app, signIn(username): Promise<string>, setClock(iso) };
// the app is buildApp({ clock: () => new Date(now), randomBytes, accounts: ACCOUNTS, store }); afterEach closes it.
const UNAUTHORIZED = { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } };
const BOOKING_INVALID = { error: { code: "VALIDATION_FAILED", message: "The request is not valid." } };
const LOGIN_INVALID = { error: { code: "VALIDATION_FAILED", message: "Username and password are required." } };
```

---

### Task 1: The store in the app; `GET /api/rooms` and `GET /api/me/bookings`

**Files:**
- Create: `backend/src/booking-routes.ts`, `backend/test/booking-routes.test.ts`, `backend/test/no-store.ts`
- Modify: `backend/src/app.ts`, `backend/src/routes.ts`, `backend/test/contract.replay.test.ts`, `backend/test/app.test.ts`, `backend/test/routes.test.ts`, `backend/test/server.test.ts` (the log test only gains `store: NO_STORE`)

**Interfaces:**
- Consumes: `checkRoomsQuery`, `roomsView`, `myBookingsView`, `errorResponse` from `booking-rules.ts`; `createBookingStore(pool)`; `testDatabase()`; `loadFixtures`, `replayFixture`, `endpointDef`, `PlaceholderHooks` (with `token(username, issuedAt?)` and `prepare(fixture)`) from `test/replay.ts`.
- Produces: `AppDeps` gains `store: BookingStore` (required). `signedInAccount(accounts: readonly Account[], sessions: SessionStore): (authorization: string | undefined) => Account | undefined` in `routes.ts`. In `booking-routes.ts`: `export const BOOKING_ROUTES: ReadonlySet<string>` (`"/api/rooms"`, `"/api/me/bookings"`, `"/api/bookings"`, `"/api/bookings/:id"`), `export type BookingRouteDeps = { clock: Clock; store: BookingStore; signedIn: (authorization: string | undefined) => Account | undefined }`, `export function registerBookingRoutes(app: FastifyInstance, deps: BookingRouteDeps): void`. `NO_STORE: BookingStore` in `test/no-store.ts`.

- [ ] **Step 1: Write the failing tests**

In `contract.replay.test.ts`: a file database `const db = testDatabase()`; `realService()` builds the app with `store: createBookingStore(db.pool)`; the `token` hook honours `issuedAt` (`if (issuedAt) now = issuedAt.getTime()` before signing in); a `prepare` hook sets `now = Date.parse(fixture.clock!)`, then `await db.resetBookings(); await db.seedBookings(fixture.given ?? [])`. `SLUGS` becomes `["auth-api", "profile-api.v2", "booking-api"]`, and a booking-api fixture is replayed only when `SERVED.has(endpointDef(method, path)!)`, with `SERVED = new Set(["GetRoomsResponse", "GetMyBookingsResponse"])`.

In `booking-routes.test.ts`:

```ts
it("GET /api/rooms decodes percent-encoded colons like plain ones", async () => {
  // seed one Merapi booking 02:00-03:00 on 2026-11-05, then
  const plain = await get("/api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z", token);
  const encoded = await get("/api/rooms?from=2026-11-05T00%3A00%3A00.000Z&to=2026-11-06T00%3A00%3A00.000Z", token);
  expect(encoded.statusCode).toBe(200);
  expect(encoded.json()).toEqual(plain.json());
  expect(plain.json().rooms[0].bookings).toHaveLength(1);
});
it("GET /api/rooms refuses a repeated from with 400", ...);            // ?from=A&from=A&to=B -> 400 BOOKING_INVALID
it("GET /api/rooms answers a range from 0000-01-01T00:00:00.000Z with 200 and its bookings (D10)", ...);
it("GET /api/rooms answers 401 before 400 when both apply (G15)", ...); // no token, from=to -> 401 UNAUTHORIZED
it("GET /api/me/bookings lists only the caller's bookings", ...);    // ayu and budi each book; ayu sees one
```

In `app.test.ts`, rename the test to "serves the six API routes and nothing else" and add, with `store: NO_STORE`: `GET /api/rooms?from=…&to=…`, `GET /api/me/bookings`, `POST /api/bookings`, `DELETE /api/bookings/x` each answer 401 with no token; `GET /api/profile` stays 404.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd <worktree> && npm --prefix backend run db:up && cd backend && TZ=Asia/Kolkata npx vitest run test/contract.replay.test.ts test/booking-routes.test.ts test/app.test.ts`
Expected: FAIL. The 9 GET fixtures report `status 404, expected …`; the new route tests get Fastify's 404; `app.test.ts` gets 404 for the four booking routes.

- [ ] **Step 3: Implement**

`AppDeps.store`; `signedInAccount` (refactor `GET /api/me` onto it); `registerBookingRoutes` with the two GET handlers: 401 via `errorResponse({ code: "UNAUTHORIZED" })` when `signedIn(request.headers.authorization)` is undefined; `GET /api/rooms` runs `checkRoomsQuery(request.query)`, then `store.overlapping(from, to)`, then `roomsView`; `GET /api/me/bookings` runs `store.notEndedOf(account.id, clock())`, then `myBookingsView`. Every answer goes out as `reply.code(status).send(body)`. `NO_STORE` and the `store: NO_STORE` lines in `app.test.ts`, `routes.test.ts` and `server.test.ts`'s log test.

- [ ] **Step 4: Run to verify they pass, then the whole suite and `tsc`**

Run: `cd <worktree>/backend && TZ=Asia/Kolkata npx vitest run test/contract.replay.test.ts test/booking-routes.test.ts test/app.test.ts && npx tsc --noEmit && TZ=Asia/Kolkata npx vitest run`
Expected: replay 19 passed (5 + 5 + 9); every file passes; `tsc` prints nothing.

- [ ] **Step 5: Commit** `backend.7: the store in the app; GET /api/rooms and GET /api/me/bookings`

### Task 2: `POST /api/bookings`

**Files:**
- Modify: `backend/src/booking-routes.ts`, `backend/test/booking-routes.test.ts`, `backend/test/contract.replay.test.ts`

**Interfaces:**
- Consumes: `checkNewBooking({ contentType, body, accountId, now })`, `toWireBooking`, `errorResponse` (with `{ code: "BOOKING_CONFLICT", conflict }`), `store.insert`.
- Produces: the `POST /api/bookings` handler.

- [ ] **Step 1: Write the failing tests**

Add `"PostBookingResponse"` to `SERVED`. In `booking-routes.test.ts`:

```ts
describe("content type: POST /api/bookings answers as POST /api/login does (backend.5 Outstanding)", () => {
  // login body: {"username":"ayu","password":"sunrise-42"}; booking body: Merapi 2026-11-05 02:00-03:00 "Sprint planning"
  it.each([
    ["text/plain", 400, LOGIN_INVALID, 400, BOOKING_INVALID],
    [undefined, 400, LOGIN_INVALID, 400, BOOKING_INVALID],   // the header left out; the body still sent
    ["application/json; charset=utf-8", 200, undefined, 201, undefined],
  ])("%s", async (contentType, loginStatus, loginBody, bookStatus, bookBody) => { /* status and, when given, body of each */ });
});
it("refuses a body that is not JSON, or JSON that is not an object, with 400", ...); // "{", "null", "[]", "\"x\"" -> 400 BOOKING_INVALID each
it("answers 401 before 400 when both apply (G15)", ...);                              // no token, body "{" -> 401
it("20 simultaneous POSTs for one room and time give one 201 and nineteen 409 naming it, ten rounds (G5)", async () => {
  // store on its own Pool({ connectionString: db.url, max: 20 }), ended in finally; ayu and budi tokens alternate;
  // each round: resetBookings, 20 app.inject POSTs in Promise.all, titles "Attempt 1".."Attempt 20"
  expect(statuses.filter((s) => s === 201)).toHaveLength(1);
  expect(statuses.filter((s) => s === 409)).toHaveLength(19);
  for (const r of conflicts) expect(r.json()).toEqual({ error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: created.json() } });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd <worktree>/backend && TZ=Asia/Kolkata npx vitest run test/contract.replay.test.ts test/booking-routes.test.ts`
Expected: FAIL: the 20 `book-*` fixtures report `status 404, expected …`; the new route tests get 404.

- [ ] **Step 3: Implement the handler**

401 first; then `checkNewBooking` with `contentType: request.headers["content-type"]`, `body: parseJson(request.body)` (a local `parseJson(raw: unknown): unknown`: `JSON.parse` of a string, `undefined` for anything else or for a parse error), `accountId: account.id`, `now: clock()`; a failure goes through `errorResponse`; then `store.insert`: ok is 201 `toWireBooking(value)`, an error is `errorResponse({ code: "BOOKING_CONFLICT", conflict: error })`.

- [ ] **Step 4: Run to verify they pass, then the whole suite and `tsc`**

Expected: replay 39 passed (5 + 5 + 29); every file passes; `tsc` prints nothing.

- [ ] **Step 5: Commit** `backend.7: POST /api/bookings`

### Task 3: `DELETE /api/bookings/{id}`; the full replay

**Files:**
- Modify: `backend/src/booking-routes.ts`, `backend/test/booking-routes.test.ts`, `backend/test/contract.replay.test.ts`

**Interfaces:**
- Consumes: `checkCancel({ id, accountId, now, booking })`, `store.find`, `store.remove`.
- Produces: the `DELETE /api/bookings/:id` handler; the replay with no endpoint filter.

- [ ] **Step 1: Write the failing tests**

Remove `SERVED` and its filter from `contract.replay.test.ts`, and add:

```ts
it("replays auth-api 5, profile-api.v2 5 and booking-api 35 fixtures", () => {
  expect(SLUGS.map((slug) => [slug, loadFixtures(slug).length])).toEqual([["auth-api", 5], ["profile-api.v2", 5], ["booking-api", 35]]);
});
```

In `booking-routes.test.ts`:

```ts
it("after a 204 the booking is gone at once and the next request books the same range (G11)", async () => {
  // ayu books; DELETE -> 204 with res.body === ""; GET /api/me/bookings for ayu -> []; GET /api/rooms lists no booking;
  // DELETE again -> 404 BOOKING_NOT_FOUND; budi POSTs the same room and range -> 201
});
it("answers 404 when the store finds the booking already gone", async () => {
  // a real store whose find deletes the row straight after reading it:
  // { ...real, find: async (id) => { const b = await real.find(id); await db.pool.query("DELETE FROM booking WHERE id = $1", [id]); return b; } }
  // DELETE -> 404 { error: { code: "BOOKING_NOT_FOUND", message: "There is no such booking." } }
});
it("answers an upper-case UUID with 404", ...);
it.each(["GET /api/rooms?…", "GET /api/me/bookings", "POST /api/bookings", "DELETE /api/bookings/<uuid>"])(
  "%s answers a missing, an unknown and an expired token with GET /api/me's 401 body, byte for byte (G16)", ...);
  // expired: a token issued at NOW, then setClock 30 min 1 s later; compare res.body with GET /api/me's res.body
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL: the 6 `cancel-*` fixtures report `status 404, expected …` (`cancel-malformed-id` and `cancel-unknown` fail on the body: Fastify's 404 shape); the DELETE route tests get Fastify's 404.

- [ ] **Step 3: Implement the handler**

401 first; `const id = request.params.id`; `checkCancel({ id, accountId: account.id, now: clock(), booking: await store.find(id) })`; a failure goes through `errorResponse`; then `store.remove(booking)`: true is `reply.code(204).send()`, false is `errorResponse({ code: "BOOKING_NOT_FOUND" })`.

- [ ] **Step 4: Run to verify they pass, then the whole suite and `tsc`**

Expected: replay 46 passed (45 fixtures and the count test); every file passes; `tsc` prints nothing.

- [ ] **Step 5: Commit** `backend.7: DELETE /api/bookings/{id}; replay all 45 fixtures`

### Task 4: Requests Fastify refuses before a handler

**Files:**
- Modify: `backend/src/app.ts`, `backend/test/booking-routes.test.ts`

**Interfaces:**
- Consumes: `BOOKING_ROUTES`, `signedIn`, `errorResponse`.
- Produces: the booking branch of `setErrorHandler`; the `frameworkErrors` option.

- [ ] **Step 1: Write the failing tests**

```ts
const HUGE = JSON.stringify({ title: "x".repeat(2 * 1024 * 1024) });  // over Fastify's 1 MiB bodyLimit
it("POST /api/bookings over the size limit answers 400 with booking-api's body when the token is valid", ...); // -> 400 BOOKING_INVALID
it("POST /api/bookings over the size limit answers 401 when the token is missing or expired", ...);           // -> 401 UNAUTHORIZED
it("DELETE /api/bookings/{id} with a body over the size limit answers 400, else 401 (Scope)", ...);
it("POST /api/login over the size limit keeps auth-api's 400", ...);                                        // -> 400 LOGIN_INVALID
it.each(["%E0%A4%A", "a".repeat(101)])("DELETE /api/bookings/%s answers 404 BOOKING_NOT_FOUND with a token, 401 without", ...);
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL: the size-limit tests get Fastify's 413 (the error handler rethrows outside login); the path tests get 400 `FST_ERR_BAD_URL` and 414 `FST_ERR_MAX_PARAM_LENGTH` in Fastify's own shape.

- [ ] **Step 3: Implement per D-d**

`setErrorHandler`: for a 4xx, login as today; `BOOKING_ROUTES.has(request.routeOptions.url ?? "")` answers `errorResponse({ code: signedIn(...) ? "VALIDATION_FAILED" : "UNAUTHORIZED" })`. `Fastify({ logger, frameworkErrors })`: a `DELETE` whose `request.url` starts with `/api/bookings/` answers `errorResponse({ code: signedIn(...) ? "BOOKING_NOT_FOUND" : "UNAUTHORIZED" })`; anything else keeps Fastify's body. The session store is created once in `buildApp` and shared by the routes and both handlers.

- [ ] **Step 4: Run to verify they pass, then the whole suite and `tsc`**

- [ ] **Step 5: Commit** `backend.7: answer requests Fastify refuses on booking routes by their endpoint's order`

### Task 5: The service on its database; the restart through `start`

**Files:**
- Modify: `backend/src/server.ts`, `backend/test/server.test.ts`, `backend/test/db.ts`, `backend/test/db.test.ts`

**Interfaces:**
- Consumes: `createPool`, `applySchema`, `DEFAULT_DATABASE_URL` from `db.ts`; `createBookingStore`; `createTestDatabase(apply)`.
- Produces: `start(port: number, databaseUrl: string): Promise<FastifyInstance>`; `configFromEnv(env: NodeJS.ProcessEnv): { port: number; databaseUrl: string }`; `testDatabase(options?: { empty?: boolean })`, where `empty: true` creates the database without the schema (used by `server.test.ts` alone).

- [ ] **Step 1: Write the failing tests**

`db.test.ts`: `createTestDatabase(async () => {})` gives a database with no `booking` table (`SELECT to_regclass('public.booking') AS t` is `null`), and `drop()` removes it (`pg_database` has no row of that name). `server.test.ts`: the file database is `testDatabase({ empty: true })`; the old `start` test is removed (folded in below); `configFromEnv({})` is `{ port: 3000, databaseUrl: DEFAULT_DATABASE_URL }` and `configFromEnv({ PORT: "4001", DATABASE_URL: "postgres://x@127.0.0.1:1/y" })` is `{ port: 4001, databaseUrl: "postgres://x@127.0.0.1:1/y" }`; and:

```ts
it("starts on an empty database, books, and after a second start keeps the booking and signs everyone out (G17)", async () => {
  // every app started is pushed to `started`; afterEach closes each one still open (a connected pool fails the drop with 55006)
  expect((await db.pool.query("SELECT to_regclass('public.booking') AS t")).rows[0].t).toBeNull();
  const first = await start(0, db.url);
  expect((first.server.address() as AddressInfo).address).toBe("127.0.0.1");
  // over fetch: sign in ayu; hour = the first quarter-hour instant at least a day after Date.now(), to = hour + 1 h
  // GET /api/rooms?from=hour&to=end -> 200, rooms ids ["merapi","bromo","thames","kew"], each bookings []
  // POST Merapi [hour, end) "Restart check" -> 201, kept as `created`
  expect((await db.pool.query("SELECT to_regclass('public.booking') AS t")).rows[0].t).toBe("booking");
  await first.close();
  const second = await start(0, db.url);
  // the first token: GET /api/me/bookings -> 401 UNAUTHORIZED
  // sign in again: GET /api/rooms same range -> merapi.bookings equals [created]; GET /api/me/bookings -> { bookings: [created] }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd <worktree>/backend && TZ=Asia/Kolkata npx vitest run test/server.test.ts test/db.test.ts`
Expected: FAIL: `start` ignores the URL and builds no store (the booking routes need one), `configFromEnv` is not exported, `testDatabase` takes no option.

- [ ] **Step 3: Implement per D-e and D-f**

`start` as D-e without the `'error'` listener and without the rejection message (Task 6 adds both); the `import.meta.main` block calls `start(...configFromEnv(process.env))` in that shape. `testDatabase({ empty })` passes `async () => {}` to `createTestDatabase` when `empty`.

- [ ] **Step 4: Run to verify they pass, then the whole suite and `tsc`**

- [ ] **Step 5: Commit** `backend.7: start on its database, apply the schema, close the pool; restart test through start`

### Task 6: When the database fails: unreachable at start, connections lost while running; log hygiene

**Files:**
- Modify: `backend/src/server.ts`, `backend/test/server.test.ts`, `backend/test/booking-routes.test.ts`

**Interfaces:**
- Consumes: `start`, `configFromEnv`.
- Produces: the rejection message of D-e; the pool's `'error'` listener (D-g).

- [ ] **Step 1: Write the failing tests**

```ts
const UNREACHABLE = "postgres://meeting_rooms:not-the-password@127.0.0.1:1/meeting_rooms";
it("start rejects naming npm --prefix backend run db:up when the database cannot be reached, and never the URL", async () => {
  const error = await start(0, UNREACHABLE).then(() => undefined, (e: Error) => e);
  expect(error?.message).toContain("npm --prefix backend run db:up");
  expect(error?.message).not.toContain("not-the-password");
});
it("npm start's entry exits non-zero with that message when the database cannot be reached", () => {
  const run = spawnSync(process.execPath, ["src/server.ts"], { cwd: BACKEND_DIR, env: { ...process.env, PORT: "0", DATABASE_URL: UNREACHABLE }, encoding: "utf8", timeout: 15_000 });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain("npm --prefix backend run db:up");
  expect(run.stdout + run.stderr).not.toContain("not-the-password");
});
it("keeps serving after the database ends its idle connections (backend.4 deferred minor)", async () => {
  // a database of its own: const own = await createTestDatabase(), dropped in finally after the app is closed,
  // so the test does not depend on the file database or on test order
  // start(0, `${own.url}?application_name=b7_lost_connection`); sign in; GET /api/rooms -> 200 (the pool now holds an idle connection)
  // own.pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'b7_lost_connection'")
  // wait 500 ms; GET /api/rooms again -> 200
});
```

In `booking-routes.test.ts`, the log test: an app with `logger: { level: "info", stream }`; sign in, book, list both views, cancel; no line holds `sunrise-42` or the token.

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL: the message does not name `db:up` (it is pg's `connect ECONNREFUSED…`); the entry exits 1 with an unhandled rejection's stack and no `db:up`; the lost-connection test ends with Vitest's "Unhandled Errors" from the pool's `'error'` event (57P01, `terminating connection due to administrator command`). Record which of these is red; the log test may pass first (Fastify logs no headers), in which case Step 2 records it against a named mutant: a handler that logs `request.headers.authorization` at `info`.

- [ ] **Step 3: Implement per D-e and D-g**

- [ ] **Step 4: Run to verify they pass, then the whole suite and `tsc`**

- [ ] **Step 5: Commit** `backend.7: name db:up when the database cannot be reached; survive lost idle connections`

### Task 7: The gate, the manual verification, the verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.7.verification.md`, `docs/superpowers/evidence/simple-login.backend.7/` (`gate.txt`, `replay.txt`, `curl.txt`)

- [ ] **Step 1:** From a clean install (`rm -rf backend/node_modules backend/package-lock.json && npm --prefix backend install`), run `npm --prefix backend run gate` and `npm --prefix backend run replay`; save both outputs under `docs/superpowers/evidence/simple-login.backend.7/`. Expected: both exit 0; the replay lists 45 fixtures and the count test.
- [ ] **Step 2:** The phase's Verification, by hand, transcript saved as `curl.txt`: `npm --prefix backend run db:up`, `npm --prefix backend start`; as `ayu`, `GET /api/rooms` for the next day in Jakarta (17:00Z to 17:00Z) lists Merapi, Bromo, Thames, Kew; book Merapi for an hour that day (201), an overlapping request (409 naming the first); restart the service; the old token gets 401; sign in again; `GET /api/me/bookings` lists the booking with the same id; `DELETE` it (204, no body). Then a database created empty on the Compose service (`CREATE DATABASE`, never `meeting_rooms`), the service started with `DATABASE_URL` naming it: four rooms with no bookings, and `\dt` lists `booking`; drop it afterwards. After the gate, the Compose service lists no database left by a test.
- [ ] **Step 3:** Write the verification doc from `hsdd/templates/verification.md` at full-review depth: every section but `## Sign-off`, which stays as the template has it. Its title uses " - ", not the template's em dash. Observed cites the files in `docs/superpowers/evidence/simple-login.backend.7/`. Outstanding and Learnings carry the findings of this run.
- [ ] **Step 4: Commit** `backend.7: verification doc`
