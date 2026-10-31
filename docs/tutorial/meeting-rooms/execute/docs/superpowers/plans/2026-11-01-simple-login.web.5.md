# simple-login.web.5 Booking API Client, Time Zone in the Profile, Test Rig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The web node's typed boundary for PRD v2: booking-api@v1's client and types, `timeZone` in the profile, the booking-api fixture stub, and the `Asia/Kolkata` ambient zone for every test; no screen changes.

**Architecture:** Each new call is the existing effectful `send` over a pure decider that reads only the status and `error.code`, and pure decoders that rebuild each `Room` and `Booking` from known fields only, refusing a body that lacks a field or holds an instant that is not its own `toISOString()`. The fixture stub gains the booking-api set, a body-less 204, per-route queues and a path override. The ambient zone is fixed in the npm scripts and guarded by a test.

**Tech Stack:** TypeScript 7, React 19 (untouched here), Vite 8, Vitest 5 with jsdom, Node.js 24.

**Spec:** hsdd-context/superpowers/simple-login.web.5.md (and hsdd-context/simple-login.web.5.md, its generic body)

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 7 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix web run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.web.5.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.
9. Every claim that a task is done, a test passes or a defect is fixed
   follows superpowers:verification-before-completion: it cites the command
   that was run and the output it printed, never an inference from the diff.
10. A test that fails when it should pass, or behavior the plan did not
    expect, goes through superpowers:systematic-debugging: find the root
    cause before any fix.

Project rules for this plan: commands run from the repository root; packages install per package directory (`npm --prefix web install`), never globally; no em dash character (U+2014) and no phrase from the owner's banned list in any file written; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Each failing-test output is recorded in `<scratch>/web5-evidence.md` for the verification doc.

## Design notes (decisions this phase settles)

- **Book's failure shape.** `reason` stays a string literal in every failure, as in web.1's `Result`, so a screen can look a message up by `reason`; the `conflict` failure alone carries one more field, `conflict: Booking`. `BookResult` is the three-member union in Task 5; narrowing on `reason === 'conflict'` gives the booking.
- **No time zone is an absent property.** `Profile.timeZone?: string`; the decoder leaves the key out when the 200 has none. `null` or any non-string present is `unavailable` (D7).
- **Cancel's success value is `null`** (`Result<null, CancelFailure>`): a 204 carries nothing.
- **The cancel id is path-encoded** with `encodeURIComponent`, a no-op for every UUID and for `not-a-booking`; the rooms query stays unencoded (D8). An id is server data, and encoding keeps a malformed one inside `/api/bookings/`.
- **Instants are checked by shape before parsing:** only a string matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` is parsed with `Date.parse`, and it must be finite and equal `new Date(ms).toISOString()`. No date-time without `Z` is ever parsed.

## Review Focus

1. A 200 profile whose `timeZone` is present but `null` is `unavailable`, not a profile with none (D7: present and not a string). Test in Task 3.
2. A 200 or 201 instant that has the right shape but names no real date (`2026-02-30T00:00:00.000Z`), or carries an offset or no milliseconds, is `unavailable` (G1). Tests in Task 4 and Task 5.
3. A list the backend sends out of order stays in the order received: no client sort (G13, G14). Test in Task 4.
4. A 409 `BOOKING_CONFLICT` whose `error.conflict` is missing, lacks a field, or holds a bad instant is `unavailable` (G6). Test in Task 5.
5. Unknown fields at every level (profile, room, booking, conflict) are dropped and never fail decoding; a request object with extra properties still sends exactly the four fields (G18, Scope (2)). Tests in Tasks 4 and 5.

---

### Task 1: The ambient zone and the proxy comment

**Files:**
- Create: `web/src/test/ambientZone.test.ts`
- Modify: `web/package.json` (scripts `test`, `gate`)
- Modify: `web/vite.config.ts` (the proxy comment)

**Interfaces:**
- Consumes: none
- Produces: every later `npm --prefix web test` and `gate` run executes with `TZ=Asia/Kolkata`.

- [ ] **Step 1: Write the failing test**

```ts
describe('ambient zone (ADR-002 Consequences)', () => {
  it('runs every test in Asia/Kolkata, neither account zone nor UTC', () => {
    expect(['Asia/Calcutta', 'Asia/Kolkata']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})
```

- [ ] **Step 2: Run it and record the failure**

Run: `npm --prefix web test -- src/test/ambientZone.test.ts`
Expected: FAIL, the received zone is the laptop's (`Asia/Jakarta` here).

- [ ] **Step 3: Set the scripts and the comment**

`"test": "TZ=Asia/Kolkata vitest run"`, `"gate": "tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build"`. The proxy comment reads `// auth-api@v1, profile-api@v2 and booking-api@v1 development address; 127.0.0.1, not localhost.`; the target stays `http://127.0.0.1:3000`.

- [ ] **Step 4: Run the whole suite**

Run: `npm --prefix web test`
Expected: PASS, 10 files, 91 tests (the 90 before plus the guard).

- [ ] **Step 5: Commit** `web.5: every web test runs in Asia/Kolkata (ADR-002), with a guard`

### Task 2: The fixture stub for booking-api@v1

**Files:**
- Modify: `web/src/test/fetchStub.ts`
- Test: `web/src/test/fetchStub.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `type FixtureApi = 'auth-api' | 'profile-api.v2' | 'booking-api'`
  - `interface GivenBooking { id: string; account: string; roomId: string; title: string; start: string; end: string }`
  - `Fixture` gains `clock?: string` and `given?: GivenBooking[]`; `request.headers` may be `{}`.
  - `stubFetch(...fixtures: Fixture[]): FetchStub`: fixtures on one route (method and path) are answered in the order given, the last repeating; a 204 is answered with `new Response(null, { status: 204 })`.
  - `atPath(fixture: Fixture, path: string): Fixture`: the same fixture with `request.path` replaced; method, status and body unchanged.

- [ ] **Step 1: Write the failing tests**

- `lists the fixtures of each API`: add `expect(listFixtures('booking-api')).toHaveLength(35)`.
- `types a booking fixture's clock and given, and never sends them`: `const f = loadFixture('booking-api', 'book-overlap')`; `const clock: string | undefined = f.clock`; `expect(clock).toBe('2026-11-04T12:00:00.000Z')`; `expect(f.given?.[0]?.id).toBe('00000000-0000-4000-8000-000000000023')`; after `stubFetch(f)` a `POST /api/bookings` answers 409 with a body equal to `f.response.body` (no `clock`, no `given`).
- `answers a 204 with no body`: stub `cancel-my-booking`; `DELETE /api/bookings/00000000-0000-4000-8000-000000000031` gives status 204 and `await res.text()` equal to `''`.
- `answers several fixtures on one route in the order given, the last repeating` (replaces `refuses two fixtures on one route`): stub `my-bookings-budi` then `my-bookings-none`; three `GET /api/me/bookings` give the bodies of budi, none, none.
- `atPath answers a call at the named path with the fixture's response`: `atPath(loadFixture('booking-api', 'cancel-started'), '/api/bookings/00000000-0000-4000-8000-000000000011')` answers a DELETE there with 422 and the fixture's body; a DELETE at the fixture's own path rejects with `no fixture for DELETE /api/bookings/00000000-0000-4000-8000-000000000033`.

- [ ] **Step 2: Run and record the failures**

Run: `npm --prefix web test -- src/test/fetchStub.test.ts` and `npm --prefix web run typecheck`
Expected: FAIL (`no fixture set booking-api`; the 204 `Response` constructor throws; `two fixtures for GET /api/me/bookings`; `atPath` is not exported).

- [ ] **Step 3: Implement the stub changes in `web/src/test/fetchStub.ts`**

Routes map to a queue; each call shifts the queue unless one fixture is left. Update the header comment to name booking-api@v1.

- [ ] **Step 4: Run the whole suite**

Run: `npm --prefix web test` and `npm --prefix web run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit** `web.5: the fixture stub answers booking-api@v1`

### Task 3: `timeZone` in the profile

**Files:**
- Modify: `web/src/api/types.ts` (`Profile`)
- Modify: `web/src/api/client.ts` (`decideProfile`)
- Test: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `Profile` gains `readonly timeZone?: string`, the name as received; absent means none.

- [ ] **Step 1: Write the failing tests**

- `profileCases`: `me-ayu` gains `timeZone: 'Asia/Jakarta'`, `me-budi` gains `timeZone: 'Europe/London'`.
- Add to the `a 200 %s is unavailable` table: `['with a numeric timeZone', { ...ayuBody, timeZone: 7 }]` and `['with a null timeZone', { ...ayuBody, timeZone: null }]`.
- `fetchProfile: a 200 without timeZone decodes with none`: the body is `ayuBody` without `timeZone`; the result is `ok` with the six fields and `'timeZone' in value` is `false`.

- [ ] **Step 2: Run and record**

Run: `npm --prefix web test -- src/api/client.test.ts`
Expected: FAIL for `me-ayu`, `me-budi` (no `timeZone`) and the numeric and null cases (decoded as ok). The without-`timeZone` test passes on this tree: it is behavior web.4 delivers. Record that, and in Step 4 run it against the named mutant "timeZone required" (an absent `timeZone` made `unavailable`) and record its failure.

- [ ] **Step 3: Implement**

`decideProfile`: a present `timeZone` that is not a string is `unavailable`; a string is kept; absent leaves the key out. Update the comment on `Profile`.

- [ ] **Step 4: Run, then the mutant**

Run: `npm --prefix web test -- src/api/client.test.ts` (PASS); apply the mutant, rerun (FAIL on `a 200 without timeZone decodes with none`), revert, rerun (PASS).

- [ ] **Step 5: Commit** `web.5: Profile carries timeZone as received, or none (D7)`

### Task 4: Booking types, `fetchRooms` and `fetchMyBookings`

**Files:**
- Modify: `web/src/api/types.ts`
- Modify: `web/src/api/client.ts`
- Test: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: `stubFetch`, `loadFixture('booking-api', …)` from Task 2.
- Produces:
  - `interface Booking { readonly id: string; readonly roomId: string; readonly roomName: string; readonly title: string; readonly start: string; readonly end: string }`
  - `interface Room { readonly id: string; readonly name: string; readonly office: string; readonly timeZone: string; readonly seats: number; readonly bookings: readonly Booking[] }`
  - `type RoomsFailure = 'unauthorized' | 'unavailable'`, `type MyBookingsFailure = 'unauthorized' | 'unavailable'`
  - `fetchRooms(token: string, from: string, to: string): Promise<Result<readonly Room[], RoomsFailure>>`
  - `fetchMyBookings(token: string): Promise<Result<readonly Booking[], MyBookingsFailure>>`
  - In `client.ts`, unexported: `decodeBooking(v: unknown): Booking | undefined` (Task 5 reuses it for the 201 and `error.conflict`).

- [ ] **Step 1: Write the failing tests**

- `roomsCases` (6): `rooms-on-a-date`, `rooms-on-a-clock-change-day`, `rooms-range-edges` are `ok` with the fixture body's `rooms`; `rooms-no-token` `unauthorized`; `rooms-from-not-before-to` and `rooms-instant-without-milliseconds` `unavailable`.
- `myBookingsCases` (3): `my-bookings-budi` and `my-bookings-none` `ok` with the body's `bookings`; `my-bookings-expired-token` `unauthorized`.
- `it.each` over each table: stub the fixture; for rooms take `from` and `to` from the fixture path with `/^\/api\/rooms\?from=(.*)&to=(.*)$/`; assert the result, and `stub.calls` equal `[{ method: 'GET', path: fixture.request.path, headers: { authorization: \`Bearer ${TOKEN}\` }, body: undefined }]`.
- `fetchRooms keeps the rooms' order (G13)`: `rooms-on-a-date` ids are `['merapi', 'bromo', 'thames', 'kew']`.
- `fetchMyBookings keeps the order received, with no client sort (G14)`: `my-bookings-budi` with its `bookings` reversed decodes reversed.
- `a malformed 200 is unavailable` (`it.each` over edits of `rooms-on-a-date`'s body): a booking `start` of `2026-11-05T09:00:00.000+07:00`, of `2026-11-05T02:00:00Z`, of `2026-02-30T00:00:00.000Z`; a room without `timeZone`; `seats: '8'`; `rooms: {}`; a booking without `title`. And `my-bookings-budi` with one `end` of `2026-11-05T11:00:00.000`.
- `unknown fields are dropped`: `rooms-on-a-date` with `floor: 3` on a room and `owner: 'budi'` on a booking decodes to the fixture's rooms.

- [ ] **Step 2: Run and record**

Run: `npm --prefix web test -- src/api/client.test.ts` and `npm --prefix web run typecheck`
Expected: FAIL (`fetchRooms` and `fetchMyBookings` not exported).

- [ ] **Step 3: Implement**

Types in `types.ts` (header comment names booking-api@v1). In `client.ts`: `isInstant` per the design note; `decodeBooking`, `decodeRoom` and a list decoder that fails on any bad element; `decideRooms` and `decideMyBookings` (200 decodes `rooms` or `bookings`; 401 `UNAUTHORIZED` is `unauthorized`; anything else `unavailable`); both functions send `Authorization: Bearer {token}`, the rooms path written as `/api/rooms?from=${from}&to=${to}` (D8). Header comment names booking-api@v1.

- [ ] **Step 4: Run** `npm --prefix web test -- src/api/client.test.ts` and `npm --prefix web run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `web.5: fetchRooms and fetchMyBookings over booking-api@v1`

### Task 5: `bookRoom`

**Files:**
- Modify: `web/src/api/types.ts`, `web/src/api/client.ts`
- Test: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: `decodeBooking` (Task 4).
- Produces:
  - `interface BookingRequest { readonly roomId: string; readonly start: string; readonly end: string; readonly title: string }`
  - `type BookFailure = 'unauthorized' | 'invalid' | 'too-long' | 'started' | 'too-far-ahead' | 'conflict' | 'unavailable'`
  - `type BookResult = { readonly ok: true; readonly value: Booking } | { readonly ok: false; readonly reason: Exclude<BookFailure, 'conflict'> } | { readonly ok: false; readonly reason: 'conflict'; readonly conflict: Booking }`
  - `bookRoom(token: string, request: BookingRequest): Promise<BookResult>`

- [ ] **Step 1: Write the failing tests**

- `bookCases` (20): `ok` with the 201 body for `book-365-days-ahead`, `book-a-room`, `book-eight-hours`, `book-in-the-repeated-hour`, `book-same-time-other-room`, `book-title-80-characters`, `book-touching`; `invalid` for `book-end-not-after-start`, `book-instant-with-offset`, `book-not-on-a-quarter-hour`, `book-title-blank`, `book-title-too-long`, `book-unknown-room`; `started` for `book-started`, `book-started-and-overlapping`; `too-long` for `book-too-long`; `too-far-ahead` for `book-too-far-ahead`; `unauthorized` for `book-unknown-token`; `conflict` with `conflict` equal to the body's `error.conflict` for `book-overlap`, `book-overlap-several`.
- `it.each` over `bookCases`: call `bookRoom(TOKEN, fixture.request.body as BookingRequest)`; assert the result and `stub.calls` equal `[{ method: 'POST', path: '/api/bookings', headers: { authorization: \`Bearer ${TOKEN}\`, 'content-type': 'application/json' }, body: fixture.request.body }]`.
- `bookRoom: the conflict names the other booking`: for `book-overlap`, `conflict.roomName` `Merapi`, `start` `2026-11-05T02:00:00.000Z`, `end` `2026-11-05T03:00:00.000Z`.
- `bookRoom sends exactly the four fields, the title as typed`: `{ roomId: 'merapi', start: '2026-11-05T02:00:00.000Z', end: '2026-11-05T03:00:00.000Z', title: '  Retro  ', note: 'x' }` sends the four fields with `title: '  Retro  '`.
- `a 409 without a conflict that decodes is unavailable (G6)`: `book-overlap` with `error.conflict` removed, without `roomName`, with `start: '2026-11-05T09:30:00.000+07:00'`.
- `a malformed 201 is unavailable`: `book-a-room` with `end: '2026-02-30T00:00:00.000Z'`, and without `id`.
- `unknown fields in a 201 and a conflict are dropped`: `book-a-room` with `owner: 'ayu'`, and `book-overlap`'s conflict with `owner: 'budi'`, decode to the fixture values.

- [ ] **Step 2: Run and record**: `npm --prefix web test -- src/api/client.test.ts`, `npm --prefix web run typecheck`. Expected: FAIL (`bookRoom` not exported).

- [ ] **Step 3: Implement** `decideBook` (201 decodes the booking; 401 `UNAUTHORIZED`; 400 `VALIDATION_FAILED`; 422 `BOOKING_TOO_LONG`, `BOOKING_STARTED`, `BOOKING_TOO_FAR_AHEAD`; 409 `BOOKING_CONFLICT` with a decodable `error.conflict`; anything else `unavailable`) and `bookRoom` (`Content-Type: application/json`, body `JSON.stringify({ roomId, start, end, title })` built from the four fields).

- [ ] **Step 4: Run**: same commands. Expected: PASS.

- [ ] **Step 5: Commit** `web.5: bookRoom over booking-api@v1`

### Task 6: `cancelBooking`, a 204 without a body, every fixture mapped

**Files:**
- Modify: `web/src/api/types.ts`, `web/src/api/client.ts` (`send`, new decider)
- Test: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 5.
- Produces: `type CancelFailure = 'unauthorized' | 'not-found' | 'not-yours' | 'started' | 'unavailable'`; `cancelBooking(token: string, id: string): Promise<Result<null, CancelFailure>>`.

- [ ] **Step 1: Write the failing tests**

- `cancelCases` (6): `cancel-my-booking` `{ ok: true, value: null }`; `cancel-malformed-id` and `cancel-unknown` `not-found`; `cancel-someone-elses` `not-yours`; `cancel-started` `started`; `cancel-no-token` `unauthorized`. `it.each`: the id is the path after `/api/bookings/`; `stub.calls` equal `[{ method: 'DELETE', path: fixture.request.path, headers: { authorization: \`Bearer ${TOKEN}\` }, body: undefined }]`.
- `maps every booking-api fixture`: the sorted keys of the four tables equal `listFixtures('booking-api').map((f) => f.name)` (35).
- `reads only error.code`: for every booking-api fixture whose body has `error`, the same expected result with `error.message` replaced by `'changed'`, and with it removed.
- `cancelBooking keeps an id inside /api/bookings/`: `cancelBooking(TOKEN, 'a/b?c')` calls `/api/bookings/a%2Fb%3Fc` (stubbed with `atPath(cancel-unknown, '/api/bookings/a%2Fb%3Fc')`), `not-found`.
- `the booking calls are unavailable when the server is unreachable or never answers`: the four functions with `stubFetchUnreachable()`, then with `stubFetchHanging()` and fake timers advanced by `REQUEST_TIMEOUT_MS`.

- [ ] **Step 2: Run and record**: `npm --prefix web test -- src/api/client.test.ts`, `npm --prefix web run typecheck`. Expected: FAIL (`cancelBooking` not exported). After Step 3's decider but before the `send` change, `cancel-my-booking` gives `unavailable` (the 204 body read throws): record that run too.

- [ ] **Step 3: Implement** `send` reads no body when the status is 204 (`body: null`); `decideCancel` (204 `ok(null)`; 401 `UNAUTHORIZED`; 404 `BOOKING_NOT_FOUND`; 403 `BOOKING_NOT_YOURS`; 422 `BOOKING_STARTED`; anything else `unavailable`); `cancelBooking` sends `DELETE /api/bookings/${encodeURIComponent(id)}` with the bearer header.

- [ ] **Step 4: Run** `npm --prefix web test` and `npm --prefix web run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `web.5: cancelBooking; send reads no body from a 204`

### Task 7: The gate and the verification doc

**Files:**
- Create: `hsdd/verify/simple-login.web.5.verification.md`

- [ ] **Step 1: Gate from a clean install**

Run: `rm -rf web/node_modules web/dist && npm --prefix web install && npm --prefix web run gate`
Expected: `tsc` silent, every test file passes including `src/test/ambientZone.test.ts`, `vite build` writes `dist/`. Keep the output and the per-file counts (`npx vitest run --reporter=verbose` under `TZ=Asia/Kolkata`).

- [ ] **Step 2: The static checks**

Run: `grep -n "message" web/src/api/client.ts` (only comments name `error.message`); `grep -n "Date\|toLocale\|getHours\|getDate" web/src/api/client.ts` (only `Date.parse` and `toISOString` in `isInstant`).

- [ ] **Step 3: Write the verification doc** from `hsdd/templates/verification.md` at spot-check depth: commands, expected output with what to eyeball, Observed (dated, with each task's recorded failing output and the gate), Outstanding, Learnings (each dispositioned or `- none`), Metrics; `## Sign-off` left as the template has it. The title's dash is written as ` - `.

- [ ] **Step 4: Commit** `web.5: verification doc`
