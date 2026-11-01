<!-- hsdd-derivative {"method":"superpowers","phase":"simple-login.integration.4","spec":"d5bf470","date":"2026-11-01"} -->
# Current Phase: simple-login.integration.4 - Home in the browser: time zone, my bookings, cancelling

> Start with superpowers:writing-plans, given this file's path. Do not start
> at brainstorming: this phase was designed and reviewed in HSDD. Save the
> plan under docs/superpowers/plans/ in this repository, never under hsdd/.
> The execution method is superpowers:executing-plans: the plan header
> names it, and the plan is executed with it.

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm test` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.integration.4.verification.md from
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
11. When writing Mermaid, use mermaid-pastel-style.

## Plan check

Run this after writing-plans' self-review, before execution starts.

- [ ] The plan's Global Constraints contain constraints 1 to 11 above, verbatim.
- [ ] The plan header names superpowers:executing-plans as its execution
      sub-skill, and no other.
- [ ] Every `### Task N:` except the last starts with a failing-test step.
- [ ] The last task writes the verification doc named in constraint 5.
- [ ] The plan has at most 6 tasks.
- [ ] The plan is saved under docs/superpowers/plans/.

<!-- hsdd-phase-context:begin -->
# Current Phase: simple-login.integration.4 - Home in the browser: time zone, my bookings, cancelling

## Goal
per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. (a) e2e/time.ts: pure functions that take the zone as an argument and use `Intl` only, never the ambient zone and never the web app's code: today's date in a zone; a date's range, from its start up to the start of the next date (never taken as 24 hours); its quarter-hour instants; a wall time on a date to its instants (two in an hour the clocks repeat, none in one they skip); the next last Sunday of March and of October strictly after today's date in London; and the strings of ADR-002 Decision 7: a time as 24-hour `HH:mm`; a date as `en-GB` writes weekday, day and month (`Thu 5 Nov`); a time whose date, in the zone it is shown in, is not its line's date, prefixed with its own date (`23:00 to Fri 6 Nov 02:00`); a time in an hour the clocks repeat, followed by the zone's `en-GB` short name (`01:30 BST`, `01:30 GMT`); a booking of a room in another zone, followed by `({start} to {end} in {office})`; and Home's line `{date}  {start} to {end}`, whose line date is the start's date. Its tests, e2e/time.spec.ts, pin: London's 2026-11-05 runs from 2026-11-05T00:00:00.000Z to 2026-11-06T00:00:00.000Z and Jakarta's from 2026-11-04T17:00:00.000Z to 2026-11-05T17:00:00.000Z; London's 2027-03-28 is 23 hours with 92 quarter hours and none from 01:00 to 01:45; London's 2027-10-31 is 25 hours with 100, 01:00 to 01:45 first BST, then GMT; from 2026-11-01T00:00:00.000Z the next change days are 2027-03-28 and 2027-10-31; a London booking from 16:00 to 19:00 on 5 November 2026 reads `23:00 to Fri 6 Nov 02:00` for a user in Jakarta; 2026-11-05T02:00:00.000Z to 2026-11-05T03:00:00.000Z in Merapi reads `02:00 to 03:00 (09:00 to 10:00 in Jakarta)` for a user in London. (b) e2e/home.spec.ts. AC-2.1: the shipped test also sees the `Time zone` row with ayu's zone. AC-2.5: each account's Home shows its zone as its name, the whole text, read from profile-api@v2's `me-ayu` and `me-budi` fixtures (`Asia/Jakarta`, `Europe/London`); a booking of ayu's for Thames from 10:00 to 11:00 London time shows on her Home in Jakarta time (`17:00 to 18:00` on a date in British winter time), and a booking of budi's for Merapi from 09:00 to 10:00 Jakarta time shows on his Home in London time (`02:00 to 03:00` in British winter time); the browser runs in Asia/Kolkata, so a time shown in the browser's zone fails. AC-6.1: three bookings of budi's, made through booking-api@v1 out of order, show on his Home soonest first, each as `{date}  {start} to {end}` then `{room} · {title}` with a `Cancel` button; a booking of ayu's does not appear on budi's Home; once every booking of a user has been cancelled through booking-api@v1, Home shows `(no bookings)` under `My bookings`. AC-6.2: `Cancel` on one of budi's bookings removes its lines at once and leaves the others; ayu then books the same room and range through booking-api@v1 and gets 201 (booking-api@v1 G11). PRD v2 Success in the browser: budi signed in with a booking, `restart()`, a reload shows Login with `Your session has expired. Please sign in again.` (AC-2.3), and after signing in again Home still lists the booking. (c) e2e/login.spec.ts: the AC-1.1 test asserts that the right password reaches Home and no longer asserts 3 seconds, a PRD 1 success metric PRD v2 Success does not name. Bookings a test needs beforehand are made through e2e/api.ts on dates and rooms no other test uses; expected strings come from e2e/time.ts with the account's zone, and lines match as text with whitespace normalized. Selectors stay on visible text: `Time zone`, `My bookings`, `Cancel`, `(no bookings)`, `Book a room`, `Sign out`.

## Where it sits
- Node: simple-login.integration · prove the real service and the real web app work together, end to end
- Owns: the root `package.json` scripts, which run the real service with its PostgreSQL 17, started through simple-login.backend's Docker Compose service, beside the real web app; the end-to-end browser test; the scripted tests PRD v2 Success names (20 simultaneous attempts to book the same room for the same time, every acceptance criterion including on London's clock-change days, bookings surviving a restart of the service); the run instructions
- Does not own: any code under `backend/` or `web/`
- Isolation strategy: none by design: its edges are `hard`, so it runs the real service on its real PostgreSQL 17, never a mock or an in-memory stand-in (PRD v2 Constraints), beside the real web app, and drives a real browser against them in a time zone that is neither account's nor UTC (ADR-002); the service runs on the real clock

## Phase
- **Consumes:** [auth-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. (a) e2e/time.ts: pure functions that take the zone as an argument and use `Intl` only, never the ambient zone and never the web app's code: today's date in a zone; a date's range, from its start up to the start of the next date (never taken as 24 hours); its quarter-hour instants; a wall time on a date to its instants (two in an hour the clocks repeat, none in one they skip); the next last Sunday of March and of October strictly after today's date in London; and the strings of ADR-002 Decision 7: a time as 24-hour `HH:mm`; a date as `en-GB` writes weekday, day and month (`Thu 5 Nov`); a time whose date, in the zone it is shown in, is not its line's date, prefixed with its own date (`23:00 to Fri 6 Nov 02:00`); a time in an hour the clocks repeat, followed by the zone's `en-GB` short name (`01:30 BST`, `01:30 GMT`); a booking of a room in another zone, followed by `({start} to {end} in {office})`; and Home's line `{date}  {start} to {end}`, whose line date is the start's date. Its tests, e2e/time.spec.ts, pin: London's 2026-11-05 runs from 2026-11-05T00:00:00.000Z to 2026-11-06T00:00:00.000Z and Jakarta's from 2026-11-04T17:00:00.000Z to 2026-11-05T17:00:00.000Z; London's 2027-03-28 is 23 hours with 92 quarter hours and none from 01:00 to 01:45; London's 2027-10-31 is 25 hours with 100, 01:00 to 01:45 first BST, then GMT; from 2026-11-01T00:00:00.000Z the next change days are 2027-03-28 and 2027-10-31; a London booking from 16:00 to 19:00 on 5 November 2026 reads `23:00 to Fri 6 Nov 02:00` for a user in Jakarta; 2026-11-05T02:00:00.000Z to 2026-11-05T03:00:00.000Z in Merapi reads `02:00 to 03:00 (09:00 to 10:00 in Jakarta)` for a user in London. (b) e2e/home.spec.ts. AC-2.1: the shipped test also sees the `Time zone` row with ayu's zone. AC-2.5: each account's Home shows its zone as its name, the whole text, read from profile-api@v2's `me-ayu` and `me-budi` fixtures (`Asia/Jakarta`, `Europe/London`); a booking of ayu's for Thames from 10:00 to 11:00 London time shows on her Home in Jakarta time (`17:00 to 18:00` on a date in British winter time), and a booking of budi's for Merapi from 09:00 to 10:00 Jakarta time shows on his Home in London time (`02:00 to 03:00` in British winter time); the browser runs in Asia/Kolkata, so a time shown in the browser's zone fails. AC-6.1: three bookings of budi's, made through booking-api@v1 out of order, show on his Home soonest first, each as `{date}  {start} to {end}` then `{room} · {title}` with a `Cancel` button; a booking of ayu's does not appear on budi's Home; once every booking of a user has been cancelled through booking-api@v1, Home shows `(no bookings)` under `My bookings`. AC-6.2: `Cancel` on one of budi's bookings removes its lines at once and leaves the others; ayu then books the same room and range through booking-api@v1 and gets 201 (booking-api@v1 G11). PRD v2 Success in the browser: budi signed in with a booking, `restart()`, a reload shows Login with `Your session has expired. Please sign in again.` (AC-2.3), and after signing in again Home still lists the booking. (c) e2e/login.spec.ts: the AC-1.1 test asserts that the right password reaches Home and no longer asserts 3 seconds, a PRD 1 success metric PRD v2 Success does not name. Bookings a test needs beforehand are made through e2e/api.ts on dates and rooms no other test uses; expected strings come from e2e/time.ts with the account's zone, and lines match as text with whitespace normalized. Selectors stay on visible text: `Time zone`, `My bookings`, `Cancel`, `(no bookings)`, `Book a room`, `Sign out`.
- **Size estimate:** ~4 files (~250 lines), <= 6 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** in `npm run dev`, signed in as `budi`, Home shows `Europe/London` and his bookings soonest first in London time, and `Cancel` removes one at once; changing the laptop's time zone does not move a time on screen; e2e/time.spec.ts reproduces ADR-002's examples.
- **Review tier:** spot-check
- **Dependencies:** simple-login.integration.3 (the database of its own, the backend fixture's `restart()`, e2e/api.ts, the browser's Asia/Kolkata zone); simple-login.web.9 (hard: the web app's Home with the time zone, my bookings and `Cancel`; the last web phase booking-api@v1 names among its consumers).

## Contracts
### auth-api@v1 · consumes · stable
**Interface**
`POST /api/login` with a JSON body:

```json
{ "username": "ayu", "password": "sunrise-42" }
```

- `username`: string, 1 to 64 characters.
- `password`: string, 1 to 128 characters.
- A character is a Unicode code point, which is what JSON Schema's
  `maxLength` counts: an emoji is one character, not two.

Responses (all bodies JSON):

| Status | When | Body |
|--------|------|------|
| 200 | the username and password match a built-in account | `{ "token": string, "tokenType": "Bearer", "expiresAt": string }` |
| 400 | the body is not a JSON object with both fields valid as above | `{ "error": { "code": "VALIDATION_FAILED", "message": "Username and password are required." } }` |
| 401 | unknown username, or wrong password | `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect username or password." } }` |

- `token`: 43 characters of base64url (`[A-Za-z0-9_-]`).
- `expiresAt`: an ISO-8601 UTC date-time, for example
  `2026-10-29T10:30:00.000Z`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the service listens on `http://127.0.0.1:3000`; the
`PORT` environment variable overrides the port. A dev proxy or a test
targets this address, not `localhost`.
**Guarantees**
- G1: `expiresAt` is exactly 30 minutes after the moment the token was
  issued (ADR-001).
- G2: A token from a 200 response is accepted by `profile-api@v1`,
  `profile-api@v2` and `booking-api@v1` until `expiresAt`, and rejected
  after it. A restart can end it sooner (G3).
- G3: A restart of the service ends every token issued before it, ahead of
  its `expiresAt`: after the restart each is rejected exactly as an expired
  token is (ADR-001).
- G4: Sign-out is client-side: there is no logout endpoint, and a client
  signs out by discarding its token (ADR-001). Signing out ends nothing on
  the service, so a token kept or copied before it stays accepted until it
  expires (G2) or the service restarts (G3).
- G5: An unknown username and a wrong password give the same status, the
  same body, byte for byte.
- G6: Usernames match exactly: case-sensitive, with no trimming. `Ayu` and
  `ayu ` are unknown usernames. Clients send what the user typed.
- G7: The token is opaque: consumers store it and send it back, never parse
  it.
- G8: No response contains the password or a password hash.
- G9: Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/auth-api.schema.json
- fixture: hsdd/contract/fixture/auth-api/
- The schema validates one response as `{ "status": number, "body": ... }`;
  `$defs.LoginRequest` describes a valid request body.
- Each fixture is one JSON file: `{ "name", "description", "request":
  { "method", "path", "headers", "body" }, "response": { "status", "body" },
  "replay" }`. `replay` is `exact` (the producer's real status and body
  must equal the fixture's) or `schema` (the real status must equal it and
  the real body must validate against the schema; used where values vary,
  such as `token` and `expiresAt`).
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume: the
  producer's gate replays them, consumers stub `fetch` with them.

### profile-api@v2 · consumes · stable
**Interface**
`GET /api/me` with the header `Authorization: Bearer {token}`, where
`{token}` came from `auth-api@v1`.

| Status | When | Body |
|--------|------|------|
| 200 | the token is one the backend issued and it has not expired | the signed-in user's profile, below |
| 401 | no `Authorization` header, a header that is not `Bearer {token}`, an unknown token, or an expired token | `{ "error": { "code": "UNAUTHORIZED", "message": "Sign in to continue." } }` |

The profile:

```json
{
  "id": "u_001",
  "username": "ayu",
  "displayName": "Ayu Lestari",
  "email": "ayu@example.com",
  "phone": "+62 812 3456 7890",
  "memberSince": "2024-03-14",
  "timeZone": "Asia/Jakarta"
}
```

- `id`: string, stable per account.
- `phone`: string, the account's phone number exactly as stored: `+`, the
  country code, then groups of digits separated by single spaces.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- `timeZone`: string, the account's time zone as an IANA name, for
  example `Asia/Jakarta` (ADR-002). Optional in the schema, so a profile
  without it still validates; the producer sends it in every profile (G4).
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.
**Guarantees**
- G1: The profile has the fields above: the six it was drafted with, and
  `timeZone` (G4). Under `additive-only` it may later gain optional fields;
  it never loses, retypes or repurposes one, and it never contains a
  password, a hash or a token.
- G2: Consumers ignore fields they do not know.
- G3: `phone` is returned exactly as stored; consumers show it as given and
  never reformat it.
- G4: Every `200` profile carries `timeZone`: the account's IANA time-zone
  name exactly as stored, never an offset or an abbreviation. `ayu` is in
  `Asia/Jakarta` and `budi` in `Europe/London` (PRD v2 Demo accounts).
- G5: A consumer takes the user's zone from `timeZone` only and never puts
  another zone in its place, the browser's included (ADR-002). A profile
  without `timeZone` comes only from a producer that predates the field; a
  consumer then shows no time rather than guess one.
- G6: The profile returned is always the account the token was issued for.
- G7: Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- G8: Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/profile-api.v2.schema.json
- fixture: hsdd/contract/fixture/profile-api.v2/
- The schema validates one response as `{ "status": number, "body": ... }`.
  The profile is closed (`additionalProperties: false`), so a leaked field
  fails the producer's replay. An `additive-only` amendment adds its new
  optional field to the schema in the same edit, and every existing fixture
  must still validate against the amended schema.
- Each fixture is one JSON file: `{ "name", "description", "request":
  { "method", "path", "headers" }, "response": { "status", "body" },
  "replay" }`. `replay` is `exact` (the producer's real status and body
  must equal the fixture's) or `schema` (the real status must equal it and
  the real body must validate against the schema).
- A request header may hold a placeholder the producer's replay fills in:
  `{{token:<username>}}` is a token freshly issued for that account;
  `{{expired-token:<username>}}` is a token for that account whose
  `expiresAt` has passed. Consumers use only the fixture's `response`.
- The `200` fixtures carry the built-in accounts' real profiles, phone
  numbers and time zones included, so the producer's replay also proves
  its account data matches PRD v2 Demo accounts.
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume.

### booking-api@v1 · consumes · stable
**Interface**
Four endpoints, served by the same process as `auth-api@v1`. Every request
carries the header `Authorization: Bearer {token}`, where `{token}` came
from `auth-api@v1`. Every body is JSON.

| Endpoint | Does | Success |
|----------|------|---------|
| `GET /api/rooms?from={instant}&to={instant}` | every room, each with its bookings that overlap `[from, to)` | 200 `{ "rooms": [RoomWithBookings, ...] }` |
| `GET /api/me/bookings` | the signed-in user's bookings that have not ended | 200 `{ "bookings": [Booking, ...] }` |
| `POST /api/bookings` | books a room | 201 `Booking` |
| `DELETE /api/bookings/{id}` | cancels one of the signed-in user's bookings | 204, no body |

### Values

- **Instant:** a UTC string in exactly the form
  `Date.prototype.toISOString()` writes: `2026-11-05T02:00:00.000Z`, a
  four-digit year, milliseconds, and `Z`. A request value counts as an
  instant only when it equals the `toISOString()` of the instant it names,
  so `2026-11-05T02:00:00Z`, `2026-11-05T09:00:00.000+07:00` and
  `2026-02-30T00:00:00.000Z` are refused. No local time and no other offset
  crosses the wire, in either direction.
- **Quarter-hour instant:** an instant whose UTC minutes are 00, 15, 30 or
  45 and whose seconds and milliseconds are zero.
- **Character:** a Unicode code point, as in `auth-api@v1`; an emoji is one
  character.

### Shapes

`RoomWithBookings`:

```json
{
  "id": "merapi",
  "name": "Merapi",
  "office": "Jakarta",
  "timeZone": "Asia/Jakarta",
  "seats": 8,
  "bookings": []
}
```

- `id`: the room's id, stable; `name`: what screens show.
- `office`: the office's name, as a consumer writes it in
  `(16:00 to 17:00 in Jakarta)`.
- `timeZone`: the office's IANA time-zone name.
- `seats`: an integer, at least 1.
- `bookings`: the room's bookings that overlap the requested range.

`Booking`, the one booking shape in every response:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "roomId": "merapi",
  "roomName": "Merapi",
  "title": "Sprint planning",
  "start": "2026-11-05T02:00:00.000Z",
  "end": "2026-11-05T03:00:00.000Z"
}
```

- `id`: a lower-case UUID. An id names one booking for good and is never
  reused.
- `roomId`, `roomName`: the booked room's `id` and `name`.
- `title`: exactly as it was sent when the room was booked.
- `start`, `end`: quarter-hour instants, `end` after `start`. The booking
  occupies the half-open range `[start, end)`.
- A booking carries no account identity: no response says who booked a
  room, except that my bookings are mine.

The rooms are pre-loaded (PRD v2 Rooms) and always listed in this order:

| `id` | `name` | `office` | `timeZone` | `seats` |
|------|--------|----------|------------|--------:|
| `merapi` | Merapi | Jakarta | Asia/Jakarta | 8 |
| `bromo` | Bromo | Jakarta | Asia/Jakarta | 4 |
| `thames` | Thames | London | Europe/London | 10 |
| `kew` | Kew | London | Europe/London | 4 |

### `GET /api/rooms?from={instant}&to={instant}`

`from` and `to` are instants, `from` before `to`. A consumer showing a date
in the user's time zone sends the start of that date and the start of the
next (23, 24 or 25 hours apart); the producer applies no zone and no cap on
the range. A query value may be sent with its colons percent-encoded or
not; the producer decodes both.

| Status | When | Body |
|--------|------|------|
| 200 | the query is valid | `{ "rooms": [...] }`: every room, each with its bookings that overlap `[from, to)`, earliest start first |
| 400 | `from` or `to` is missing or not an instant, or `from` is not before `to` | `VALIDATION_FAILED` |
| 401 | the token is missing, unknown or expired | `UNAUTHORIZED` |

### `GET /api/me/bookings`

| Status | When | Body |
|--------|------|------|
| 200 | the token is valid | `{ "bookings": [...] }`: the bookings of the token's account whose `end` is after the backend's clock, soonest `start` first, ties in the rooms' order |
| 401 | the token is missing, unknown or expired | `UNAUTHORIZED` |

### `POST /api/bookings`

Header `content-type: application/json`, body:

```json
{ "roomId": "merapi", "start": "2026-11-05T02:00:00.000Z", "end": "2026-11-05T03:00:00.000Z", "title": "Sprint planning" }
```

- `roomId`: a room's `id`.
- `start`, `end`: quarter-hour instants, `end` after `start`.
- `title`: a string of 1 to 80 characters, at least one of them not
  whitespace, and none of them U+0000 or an unpaired surrogate (a code
  point from U+D800 to U+DFFF that is not half of a pair), since neither
  could be stored and returned as sent. It is stored and returned exactly
  as sent, never trimmed.
- Other fields are ignored.

The rules are checked in this order; the first that applies answers:

| Order | Status | Code | When |
|------:|--------|------|------|
| 1 | 401 | `UNAUTHORIZED` | the token is missing, unknown or expired |
| 2 | 400 | `VALIDATION_FAILED` | the body is not a JSON object; a field is missing or of the wrong type; `roomId` names no room; `start` or `end` is not a quarter-hour instant; `end` is not after `start`; the title breaks its rule |
| 3 | 422 | `BOOKING_TOO_LONG` | `end` is more than 8 hours after `start` |
| 4 | 422 | `BOOKING_STARTED` | the backend's clock reads `start` or later |
| 5 | 422 | `BOOKING_TOO_FAR_AHEAD` | `start` is more than 365 days (8,760 hours) after the backend's clock |
| 6 | 409 | `BOOKING_CONFLICT` | a booking of the same room overlaps `[start, end)` |
| none | 201 | | the new `Booking`, owned by the token's account |

### `DELETE /api/bookings/{id}`

The rules are checked in this order; the first that applies answers:

| Order | Status | Code | When |
|------:|--------|------|------|
| 1 | 401 | `UNAUTHORIZED` | the token is missing, unknown or expired |
| 2 | 404 | `BOOKING_NOT_FOUND` | no booking has this id: it never existed, it was cancelled, or `{id}` is not a UUID |
| 3 | 403 | `BOOKING_NOT_YOURS` | the booking belongs to another account |
| 4 | 422 | `BOOKING_STARTED` | the backend's clock reads the booking's `start` or later |
| none | 204 | | no body; the booking is cancelled |

### Errors

Every error is the envelope `{ "error": { "code": string, "message":
string } }`. A `BOOKING_CONFLICT` error alone carries one more field,
`error.conflict`, a `Booking`: the other booking the request overlaps.

```json
{
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "The room is already booked for part of that time.",
    "conflict": {
      "id": "00000000-0000-4000-8000-000000000023",
      "roomId": "merapi",
      "roomName": "Merapi",
      "title": "Sprint planning",
      "start": "2026-11-05T02:00:00.000Z",
      "end": "2026-11-05T03:00:00.000Z"
    }
  }
}
```

Each code has one status and one message, at every endpoint:

| Code | Status | `message` |
|------|--------|-----------|
| `UNAUTHORIZED` | 401 | `Sign in to continue.` |
| `VALIDATION_FAILED` | 400 | `The request is not valid.` |
| `BOOKING_TOO_LONG` | 422 | `A booking can last at most 8 hours.` |
| `BOOKING_STARTED` | 422 | `That time has already started.` |
| `BOOKING_TOO_FAR_AHEAD` | 422 | `A booking can start at most 365 days ahead.` |
| `BOOKING_CONFLICT` | 409 | `The room is already booked for part of that time.` |
| `BOOKING_NOT_FOUND` | 404 | `There is no such booking.` |
| `BOOKING_NOT_YOURS` | 403 | `You can cancel only your own bookings.` |

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port. The process,
started by `npm --prefix backend start`, keeps the bookings in the
PostgreSQL database `DATABASE_URL` names, default
`postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms` on
simple-login.backend's Compose service (`npm --prefix backend run db:up`).
When that database exists but is empty, the service creates its tables in
it before it listens; a database that already holds them keeps its
bookings. The rooms are part of the service, not rows to load, so a new
database lists all four with no bookings. The database itself must
exist: `db:up` creates `meeting_rooms`, and a consumer that names another
creates it first.
**Guarantees**
- G1: Every instant in a request or a response is a UTC string in the
  `toISOString()` form; a request with an instant in any other form is
  refused with `VALIDATION_FAILED`.
- G2: A booking's `start` and `end` are quarter-hour instants and `end` is
  after `start`; a request that breaks either is refused with
  `VALIDATION_FAILED` (PRD v2 AC-5.2).
- G3: A booking occupies `[start, end)`. Two bookings of one room overlap
  when each starts before the other ends, so bookings that only touch, one
  ending at 10:00 and the next starting at 10:00, do not overlap
  (AC-5.3).
- G4: No two bookings of one room overlap, at any moment, whatever the
  concurrency. A request that overlaps a booking of the same room is
  refused with 409 `BOOKING_CONFLICT`; a booking of another room never
  blocks it (AC-5.3).
- G5: When requests that overlap each other in one room arrive at the same
  moment, and no existing booking or earlier rule refuses them, exactly one
  is answered 201 and every other one 409 `BOOKING_CONFLICT`, naming the
  winner or another overlapping booking by G6. Contention never surfaces as
  a 5xx (AC-5.4; PRD v2 Success: 20 simultaneous attempts give one
  booking).
- G6: `error.conflict` is a booking of the requested room that overlaps the
  requested range when the producer answers; when several do, the one with
  the earliest `start`. A 409 never comes without it.
- G7: A booking has started once the backend's clock reads its `start` or
  later; the moment of `start` counts as started. Booking a time that has
  started is refused with `BOOKING_STARTED` (AC-5.5). The browser's clock
  decides nothing (ADR-002).
- G8: The title is 1 to 80 characters with at least one not whitespace
  and none U+0000 or an unpaired surrogate, and is returned exactly as
  sent (AC-5.6). A title that breaks this rule is refused with
  `VALIDATION_FAILED`.
- G9: Longest booking: `end` at most 8 hours after `start`, counted as
  elapsed time between the instants (so on a clock-change day a wall-clock
  span across the change counts its real length); longer is refused with
  `BOOKING_TOO_LONG` (PRD v2 Left to engineering).
- G10: How far ahead: `start` at most 365 days (8,760 hours) after the
  backend's clock, the boundary included; later is refused with
  `BOOKING_TOO_FAR_AHEAD` (PRD v2 Left to engineering). From any moment,
  the next London clock-change day ends less than 220 days later, so it
  can always be booked (AC-4.4).
- G11: A user cancels only their own booking and only while the backend's
  clock reads before its `start` (AC-6.2). A 204 means the booking is gone
  at once: no later response lists it, its id answers 404, and its range
  can be booked by anyone in the next request.
- G12: Cancelling somebody else's booking is refused with 403
  `BOOKING_NOT_YOURS`, whatever its timing (AC-6.3).
- G13: The rooms view lists every room in the rooms' order, each with every
  booking of that room that overlaps `[from, to)`, earliest `start` first;
  a room with none has `"bookings": []` (AC-4.1, AC-4.2). It shows every
  user's bookings, not only the caller's.
- G14: My bookings are exactly the token account's bookings whose `end` is
  after the backend's clock, so a booking in progress is listed and one that
  ended at the clock's reading is not; ordered by `start`, ties in the
  rooms' order (AC-6.1).
- G15: Each request gets exactly one answer: the first rule in its
  endpoint's order that applies.
- G16: A missing, unknown or expired token gets 401 `UNAUTHORIZED` with
  `profile-api@v2`'s body at every endpoint; consumers cannot tell the
  three apart (ADR-001).
- G17: Bookings survive a restart of the service, ids unchanged. Tokens do
  not (ADR-001): after a restart a user signs in again and finds every
  booking.
- G18: Consumers branch on `error.code`, never on `error.message`. A
  consumer writes AC-5.3's message from `error.conflict`'s `roomName`,
  `start` and `end`. Consumers ignore response fields they do not know.
**Validation**
- schema: hsdd/contract/schema/booking-api.schema.json
- fixture: hsdd/contract/fixture/booking-api/
- The schema validates one response of any endpoint as `{ "status":
  number, "body": ... }`. `$defs.GetRoomsResponse`,
  `$defs.GetMyBookingsResponse`, `$defs.PostBookingResponse` and
  `$defs.DeleteBookingResponse` validate one endpoint's responses;
  `$defs.GetRoomsQuery` and `$defs.PostBookingRequest` describe valid
  requests. Every object is closed (`additionalProperties: false`), so a
  leaked field fails the producer's replay. The schema states the instant
  forms, the ids' forms, the title's length and the characters a title may
  not hold; it cannot compare two fields or read the clock (`end` after
  `start`, `from` before `to`, the limits, started), which the fixtures
  pin.
- Each fixture is one JSON file: `{ "name", "description", "clock",
  "given", "request": { "method", "path", "headers", "body" }, "response":
  { "status", "body" }, "replay" }`. `request.body` is present only for
  `POST`.
  - `clock`: the instant the producer's injected clock reads for the whole
    fixture, tokens included.
  - `given`: the bookings that exist before the request, each `{ "id",
    "account", "roomId", "title", "start", "end" }`, where `account` is a
    built-in username. The producer's replay starts from no bookings and
    creates these directly with these ids, not through `POST`: some lie
    before the clock.
  - A request header may hold a placeholder the producer's replay fills
    in, as in `profile-api@v2`: `{{token:<username>}}` is a token issued
    for that account at `clock`; `{{expired-token:<username>}}` is a token
    for that account whose `expiresAt` is before `clock`.
  - A 204's `response.body` is `null`: the real response has no body.
  - `replay` is `exact` in every fixture of this contract: the real status
    and body must equal the fixture's, except a 201's `id`, which must match
    the schema and differ from every `given` id.
  - Consumers match a call on `request.method` and `request.path` and
    answer with `response`; `clock` and `given` explain the answer and are
    never sent.
- The fixtures cover single requests. G5 (simultaneous requests), G11's
  "free at once" and G17 (a restart) are properties of sequences: the
  producer's own tests and the integration node prove them, against a real
  PostgreSQL (PRD v2 Constraints); no fixture does.
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume: the
  producer's gate replays them, consumers stub `fetch` with them.

### profile-api@v1 · referenced · stable
**Interface**
`GET /api/me` with the header `Authorization: Bearer {token}`, where
`{token}` came from `auth-api@v1`.

| Status | When | Body |
|--------|------|------|
| 200 | the token is one the backend issued and it has not expired | the signed-in user's profile, below |
| 401 | no `Authorization` header, a header that is not `Bearer {token}`, an unknown token, or an expired token | `{ "error": { "code": "UNAUTHORIZED", "message": "Sign in to continue." } }` |

The profile:

```json
{
  "id": "u_001",
  "username": "ayu",
  "displayName": "Ayu Lestari",
  "email": "ayu@example.com",
  "memberSince": "2024-03-14"
}
```

- `id`: string, stable per account.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.
**Guarantees**
- The profile has exactly the five fields above; it never contains a
  password, a hash or a token.
- The profile returned is always the account the token was issued for.
- Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/profile-api.schema.json
- fixture: hsdd/contract/fixture/profile-api/
- The schema validates one response as `{ "status": number, "body": ... }`.
- Fixture files follow the same shape as auth-api@v1's. A request header
  may hold a placeholder the producer's replay fills in:
  `{{token:<username>}}` is a token freshly issued for that account;
  `{{expired-token:<username>}}` is a token for that account whose
  `expiresAt` has passed. Consumers use only the fixture's `response`.
- The `200` fixtures carry the built-in accounts' real profiles, so the
  producer's replay also proves its account data matches the PRD.
- Code-level artifacts: as auth-api@v1. No shared code package; each node
  writes its own types from this Interface.

## Decisions
### ADR-001: Session tokens · accepted
**Decision**
Sessions are opaque bearer tokens held in the backend's in-memory session
store. A token is 32 random bytes, base64url-encoded (43 characters),
issued by `POST /api/login` and sent as `Authorization: Bearer {token}`.
Its lifetime is a fixed 30 minutes from issue, with no renewal. Sign-out is
client-side: the web app discards its token; there is no logout endpoint.
**Consequences**
- Restarting the backend signs every user out.
- Sessions are never written to PostgreSQL. Bookings are, so a restart
  keeps every booking; a user it signed out signs in again and finds them.
- A restart invalidates every issued token at once, so a test against the
  running service can restart it to get the 401 an expired token gets,
  without waiting 30 minutes.
- Consumers never parse a token; its only meaning is "valid until
  `expiresAt`".
- An expired, unknown or missing token is one case for consumers at every
  endpoint that takes the token: 401 `UNAUTHORIZED`.
- After a client-side sign-out the server entry lives on until it expires;
  a stolen token stays valid for at most 30 minutes, and in that time it
  can book and cancel in its user's name.
- Time is an input: the backend's session logic takes the clock as a
  dependency so expiry is testable without waiting.
### ADR-002: Time model · accepted
**Decision**
1. **A booking's start and end are instants.** On the wire, in both
   directions, an instant is a UTC ISO-8601 string in the form
   `Date.prototype.toISOString()` writes, for example
   `2026-11-05T02:00:00.000Z`. No local time, and no offset other than `Z`,
   crosses the wire. A calendar date with no time of day (`memberSince`)
   stays `YYYY-MM-DD`.
2. **PostgreSQL stores instants.** Start and end are `timestamptz`, never
   `timestamp` and never a local time beside a zone. A booking occupies the
   half-open interval from its start up to, not including, its end: two
   bookings of one room overlap when each starts before the other ends, so
   bookings that only touch do not overlap. No SQL converts a booking to a
   zone.
3. **Zones are IANA names, held as data.** The user's zone is the
   account's: the backend stores it with each built-in account, and the
   profile serves it as `timeZone` (`ayu` `Asia/Jakarta`, `budi`
   `Europe/London`). Each room carries its office's zone as `timeZone`,
   beside the office's name. Neither the browser's zone nor a process's zone
   is used for anything.
4. **The web app converts; the backend does not.** Every conversion between
   an instant and a wall-clock date or time happens in the web app, in pure
   functions that take the zone as an argument and use the runtime's `Intl`
   time-zone data. No node hand-codes an offset or a clock-change date.
   - A date picked in the user's zone becomes the range from the start of
     that date up to the start of the next, sent as two instants; the
     backend returns each room's bookings that overlap the range. A day is
     never taken to be 24 hours: London's clock-change days are 23 and 25
     hours long.
   - The booking form's start and end times for a date are the quarter-hour
     instants from the start of that date up to the start of the next, each
     labelled with its wall-clock time. A wall time the clocks skip is never
     offered; a wall time the clocks repeat is offered twice, once per
     instant.
   - The backend, its tests and its database work in instants only.
5. **The backend's clock decides.** A booking has started once the
   backend's clock reads its start or later, and has ended once it reads its
   end or later. Booking a time that has started is refused; a booking can
   be cancelled only before its start; my bookings are those that have not
   ended. The backend takes its clock as an injected dependency. The
   browser's clock only chooses the date the Rooms screen opens on (today in
   the user's zone) and may leave past times out of the form; the backend's
   answer decides.
6. **The quarter-hour rule is checked on the instant.** The backend accepts
   a start or an end only when its UTC minutes are a multiple of 15 and its
   seconds and milliseconds are zero, and an end only after its start. This
   equals the rule on the user's wall clock because every zone offset in the
   runtime's time-zone data is a multiple of 15 minutes.
7. **Times are shown in the user's zone, by the web app.** A time is
   24-hour `HH:mm` (`09:00`); a date is weekday, day and month as `en-GB`
   writes them (`Thu 5 Nov`).
   - A time whose date, in the zone it is shown in, is not the date its line
     is about carries its own date: a London booking from 16:00 to 19:00 on
     5 November reads `23:00 to Fri 6 Nov 02:00` for a user in Jakarta.
   - A wall time in an hour the clocks repeat carries the zone's short name
     as `en-GB` writes it: `01:30 BST`, then `01:30 GMT`.
   - On the Rooms screen, a booking of a room whose `timeZone` is not the
     user's `timeZone` (compared as names) also shows the room's local times
     and the office's name: `09:00 to 10:00 (16:00 to 17:00 in Jakarta)`.
     Home and the overlap message show the user's zone only.
   - The overlap message is written by the web app from the room's name and
     the other booking's start and end, which the backend returns as
     instants: `Merapi is already booked from 10:00 to 11:00.`
**Consequences**
- The backend needs no time-zone library and no clock-change test: overlap,
  started, ended, the quarter-hour rule and any limit on a booking's length
  or on how far ahead it starts are comparisons of instants. PostgreSQL's
  `tstzrange(start, end, '[)')` with `&&` states the overlap rule as is.
- London's clock changes are for the web app and the integration node to
  prove: the web app tests its conversion functions in isolation on both
  change days of a year, and the browser tests run the acceptance criteria
  on them.
- The booking API's query for a date takes two instants, not a date. Its
  overlap refusal carries the other booking's start and end, and each room
  carries `timeZone` and its office's name, so the web app can write every
  string above without asking again.
- The profile gains `timeZone`. The web app shows no booking time until it
  has the profile.
- Every node's tests run in an ambient zone that is neither account's nor
  UTC, for example `Asia/Kolkata` (+05:30): `TZ` for the Node.js test
  runners, the browser's time zone for the browser tests. A time computed in
  the ambient zone then fails a test instead of passing on a laptop set to
  Jakarta or London.
- Node.js 24 has no global `Temporal`. Code that the web app's tests run on
  Node.js uses `Intl`, or a library built on it, unless it brings its own
  polyfill.
- A test that needs a clock-change day takes the next one after the clock it
  runs under (the last Sunday of March or of October); a fixed date passes
  and then cannot be booked. London's clock changes are up to 217 days
  apart, so how far ahead the booking API accepts a booking decides whether
  that day can be booked through it.
- A request that reaches the backend at or after the start it asks for is
  refused, even when the form offered that time a moment earlier.
- A booking keeps its instant if a zone's rules change, so its wall-clock
  time would move. For Jakarta and London this is accepted.

## Discipline
- Test-first: write each behavior's failing test, and see it fail, before
  the code that makes it pass. A test of behavior that a merged dependency
  phase already delivered fails first against the tree before that phase,
  or against a named mutant; the verification doc's Observed says which.
- Governance freeze: change nothing under hsdd/ except this phase's
  verification doc; contracts, ADRs, specs and conventions change only
  through hsdd-contract, hsdd-adr and hsdd-reconcile.
- Consume contracts only: build against the Interface and Guarantees of
  each contract above that this phase consumes or produces, test against
  the fixtures their Validation names, and never build against another
  node's internals.
- Referenced: profile-api@v1. Not consumed or
  produced by this phase; use each only as this phase's Scope says.
- Contract wrong mid-phase: pause at a task boundary; write the gap, in
  request or amend wording, under the verification doc's Outstanding and
  stop; the human records it in the node's plan, renegotiates at the root
  through hsdd-contract, and propagates the change into this phase's branch;
  re-run the phase switch; resume. Never improvise around the contract.
- Verification doc: hsdd/verify/simple-login.integration.4.verification.md from
  hsdd/templates/verification.md at spot-check depth. Every Learning
  carries one disposition before sign-off; "- none" is valid, silence is not.

## Links (spec d5bf470)
- Phase section: hsdd/spec/simple-login.integration.md, heading "### simple-login.integration.4: Home in the browser: time zone, my bookings, cancelling"
- Node spec: hsdd/spec/simple-login.integration.md
- auth-api@v1: hsdd/contract/auth-api.md
- profile-api@v2: hsdd/contract/profile-api.v2.md
- booking-api@v1: hsdd/contract/booking-api.md
- profile-api@v1: hsdd/contract/profile-api.md
- ADR-001: hsdd/adr/001-session-tokens.md
- ADR-002: hsdd/adr/002-time-model.md
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
<!-- hsdd-phase-context:end -->
