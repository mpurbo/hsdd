---
id: booking-api
version: v1
status: draft
kind: api
owner: simple-login.backend
governed_by: [ADR-001, ADR-002]
compatibility: versioned
produced_by: [simple-login.backend.7]
consumers: [simple-login.web.5, simple-login.integration.3]
phase_ids: provisional
---

# Contract: booking-api

- **Governed by:** [ADR-001, ADR-002]

## Interface

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
`http://127.0.0.1:3000`, with `PORT` overriding the port.

## Guarantees / invariants

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

## Versioning

- v1 current, drafted 2026-10-31 for
  `hsdd/management/2026-10-31-intake-prd-simple-login-v2.md`. The two
  limits PRD v2 leaves to engineering are G9 and G10.
- Compatible, so the version stays v1: a new optional field in a response,
  a new endpoint, a room added to the pre-loaded data (consumers render the
  list they receive and never hard-code it).
- Breaking: removing, renaming or retyping a field; a new required request
  field or query parameter; refusing a request v1 accepts, or a new status,
  code or message for a case; any change to either limit in either
  direction, to the check order, to the instant form, to the overlap rule,
  to which booking `error.conflict` names, to the order of a list, or to a
  room's `id`. A breaking change requires v2 and a migration note here
  naming its mode.
- 2026-11-01, for
  `hsdd/management/2026-10-31-intake-prd-simple-login-v2.md`, from
  simple-login.backend's plan (its D9), applied by hsdd-reconcile: a
  `POST /api/bookings` whose `title` holds U+0000 or an unpaired surrogate
  is refused with 400 `VALIDATION_FAILED`, at order 2 with the title's
  other rules (G8), and the schema's `Title` states the same rule.
  PostgreSQL `text` cannot store U+0000, and an unpaired surrogate cannot
  travel as UTF-8 (it comes back as U+FFFD), so neither title could be
  returned exactly as sent. Refusing a request the draft accepted is
  breaking by the list above; v1 is `draft`, and no consumer phase is
  planned or shipped against it, so the change is made in v1 in place
  rather than as v2. The 35 fixtures are unchanged and validate against
  the amended schema.

## Validation

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
