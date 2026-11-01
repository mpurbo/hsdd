---
id: ADR-002
status: accepted
affects: [simple-login, simple-login.backend, simple-login.web, simple-login.integration, profile-api@v2, booking-api@v1]
date: 2026-10-31
---

# ADR-002: Time model

## Context

PRD v2 (2026-10-31) puts every time on screen in the user's own time zone
(Goal, AC-2.5) for two offices: Jakarta (`Asia/Jakarta`, no daylight
saving) and London (`Europe/London`, whose clocks change on the last Sundays
of March and October, AC-4.4). A user picks a date in their zone and sees
the bookings that overlap it (AC-4.2), sees another office's rooms in that
office's time as well (AC-4.3), books on quarter hours (AC-5.2), is refused
an overlap with a message in their zone (AC-5.3, AC-5.4), cannot book a time
that has started (AC-5.5), and cancels only before the start (AC-6.2). The
backend keeps bookings in PostgreSQL 17 (Constraints), the web app shows
them, and the integration node proves both together, on London's
clock-change days too (Success). How times travel and are stored, where the
zone comes from, which node converts and which clock decides bind all three
nodes, the profile and the booking API, so the intake record for PRD v2
made this an ADR (hsdd/management/2026-10-31-intake-prd-simple-login-v2.md,
DEC-009).

No human stated this decision. The unattended run that took PRD v2 in wrote
it `accepted` under the run's decision policy (DEC-037); the owner reviews
it with the run's other decisions. Each choice is recorded on its own:
wire format DEC-025, storage DEC-026, the zone's source DEC-027, the
converting node DEC-028, the clock DEC-029, the quarter hour DEC-030, the
form on clock-change days DEC-031, display marks DEC-032, the room's local
times DEC-033, test zones DEC-034, the link to the root DEC-035, the
Governed by lines DEC-036.

The runtime facts were checked on Node.js 24.18 (tz data 2026b) and
PostgreSQL 17.11: hsdd/auto/experiments/time-model-intl/ and
hsdd/auto/experiments/time-model-postgres/.

## Decision

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

## Consequences

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

## Alternatives considered

- Local times with an offset on the wire: several strings name one instant,
  so an exact fixture depends on which offset the producer picks.
- A wall-clock date and times plus a zone on the wire: the repeated hour
  needs an offset as well, and every reader resolves wall times.
- The backend turning a picked date into a range from the account's zone:
  the query reads like the PRD, but zone arithmetic then lives in both
  nodes, and the form's wall times still need converting.
- The room's wall-clock time stored beside its zone: keeps a future
  booking's wall time across a rule change, but every overlap and start
  check converts first and no plain exclusion constraint holds.
- The browser's zone as the user's: no profile change, but one user sees
  different times on two machines, and PRD v2's Demo accounts give each
  account its zone.
- The browser's clock for "started": two clocks disagree near a start.
- A fixed list from 00:00 to 23:45 in the form: on London's change days it
  offers four times that do not exist and cannot offer the second 01:xx.
