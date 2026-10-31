# simple-login.integration: End-to-end integration

- **Kind:** leaf-parent
- **Purpose:** prove the real service and the real web app work together, end to end
- **Owns:** the root `package.json` scripts, which run the real service with its PostgreSQL 17, started through simple-login.backend's Docker Compose service, beside the real web app; the end-to-end browser test; the scripted tests PRD v2 Success names (20 simultaneous attempts to book the same room for the same time, every acceptance criterion including on London's clock-change days, bookings surviving a restart of the service); the run instructions
- **Does not own:** any code under `backend/` or `web/`
- **Consumes:** [auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-002]
- **Sources:** hsdd/context/prd-simple-login.v2.md (Success, Team and delivery, Constraints, Demo accounts, AC-2.1, AC-2.4, US-1, AC-2.2, AC-2.3, AC-2.5, US-3, US-4, US-5, US-6, Rooms, Screens), hsdd/context/rfc-simple-login.md (§1 Summary, §7 Testing, §8 Repository layout)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** none by design: its edges are `hard`, so it runs the real service on its real PostgreSQL 17, never a mock or an in-memory stand-in (PRD v2 Constraints), beside the real web app, and drives a real browser against them in a time zone that is neither account's nor UTC (ADR-002); the service runs on the real clock

## Overview

The node that turns two independently tested halves into one product. It
starts PostgreSQL 17, the real service on it and the real web app, replays
the contract fixtures through the dev proxy, and drives a browser through
PRD v2's acceptance criteria. It also owns the one command a newcomer runs
to start everything, the database included. The database, its Docker
Compose service and that service's Compose file are simple-login.backend's
(PRD v2 Team and delivery); this node's root scripts start them, on the
laptop and through Colima on macOS (PRD v2 Constraints).

It owns the scripted tests PRD v2 Success names, run against the real
service and its real PostgreSQL, never a mock or an in-memory stand-in
(PRD v2 Constraints):

- 20 simultaneous attempts to book the same room for the same time give
  exactly one booking: one 201 and nineteen 409 `BOOKING_CONFLICT`
  (booking-api@v1 G5).
- Every acceptance criterion passes, on London's clock-change days too
  (PRD v2 AC-4.4).
- A restart of the service keeps every booking with its id. The same
  restart ends every token, so the test signs in again before it lists
  them (booking-api@v1 G17, auth-api@v1 G3, ADR-001).

Nothing here sets the service's clock: it runs on the real one. A
clock-change test therefore takes the next last Sunday of March or of
October after it, never a fixed date, and booking-api@v1's 365-day limit
keeps that day bookable (ADR-002 Consequences, booking-api@v1 G10). A
restart stays the expired-token stand-in for PRD v2 AC-2.3, since after it
every earlier token is rejected exactly as an expired one is (auth-api@v1
G3). Where a criterion turns on the backend's clock, a booking that has
started (PRD v2 AC-5.5, AC-6.2), the phase plan names the scripted test
that covers it. The proxy replay covers the fixtures the running service
can answer as written; a booking-api@v1 fixture that needs a set clock or
seeded bookings is not among them (booking-api@v1 Validation).

## Phase Plan

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| simple-login.integration.1 | End-to-end run and browser test | full-review | ~6 files (~280 lines), ≤6 tasks | simple-login.backend.2, simple-login.web.3 |
| simple-login.integration.2 | Phone number end to end | spot-check | ~4 files (~35 lines), ≤4 tasks | simple-login.integration.1, simple-login.backend.3, simple-login.web.4 |
| simple-login.integration.3 | PostgreSQL rig, booking replay and the Success tests | full-review | ~8 files (~340 lines), ≤7 tasks | simple-login.integration.2, simple-login.backend.4, simple-login.backend.7 |
| simple-login.integration.4 | Home in the browser: time zone, my bookings, cancelling | spot-check | ~4 files (~250 lines), ≤6 tasks | simple-login.integration.3, simple-login.web.9 |
| simple-login.integration.5 | Rooms and booking in the browser, clock-change days included | full-review | ~2 files (~300 lines), ≤7 tasks | simple-login.integration.3, simple-login.integration.4, simple-login.web.9 |

Ordering policy: `interfaces-first` (from `hsdd/conventions.md`). The node
is one composition phase, so the policy only fixes its place: last, after
both producers have shipped. Commands run from the repository root (the
directory holding `hsdd/`).

Update 1 (2026-10-30, `hsdd/management/2026-10-30-intake-add-phone.md`)
appends simple-login.integration.2 under the same policy: one more
composition phase, again last, after the profile-api@v2 producer phase
(simple-login.backend.3) and the web app's v2 phase (simple-login.web.4)
have shipped. Both ids are the provisional ones in profile-api@v2's front
matter.

- simple-login.integration.2 sits below the sizing floor (its process
  artifacts will outweigh a ~35-line diff) and has no merge partner: the
  only adjacent phase, simple-login.integration.1, has shipped and is never
  rewritten, and the work cannot move to another node, because this node
  owns the browser suite.
- Its tier is spot-check, not integration.1's full-review: the dev runner,
  the backend fixture and the Playwright config are unchanged; the phase
  adds assertions against a clear contract and retargets one fixture
  directory.

PRD v2 (2026-10-31,
`hsdd/management/2026-10-31-intake-prd-simple-login-v2.md`) appends
simple-login.integration.3 to simple-login.integration.5 under the same
policy, read inside this node: the shared rig first, then the tests that
use it. simple-login.integration.3 puts the rig on PostgreSQL with a
database of its own per run, starts the service through its documented
command, adds the booking-api@v1 helpers and proves PRD v2 Success at the
service; simple-login.integration.4 adds the time helpers and drives Home;
simple-login.integration.5 drives Rooms, London's clock-change days
included. The cross-node ids are the ones in profile-api@v2's and
booking-api@v1's front matter.

- Where a criterion turns on the backend's clock, the scripted test that
  covers it: PRD v2 AC-5.5 at the service in simple-login.integration.3
  and in the browser in simple-login.integration.5, with only the
  browser's clock held back; AC-6.2's started case and AC-6.1's booking in
  progress in the backend's replay of booking-api@v1's `cancel-started`
  and `my-bookings-budi` under its injected clock, on its real PostgreSQL,
  which the root `npm test` runs. No test here waits for a booking to
  start.
- simple-login.integration.3 can land while the web lane is still
  building: it drives no new screen. It should land with the backend's
  PostgreSQL work (see its Dependencies).

### simple-login.integration.1: End-to-end run and browser test

- **Consumes:** [auth-api@v1, profile-api@v1]
- **Produces:** none
- **Scope:** the root `package.json`: `install:all` (installs `backend/` and `web/`), `dev` (starts the real backend and the web dev server together, and Ctrl-C stops both; a small Node script, no extra dependency), and `test` (backend gate, backend replay, web gate, then `e2e`); a Playwright suite (Chromium, or the installed Chrome) whose `webServer` starts the real backend and the real web dev server; browser tests for AC-1.1, AC-1.2, AC-1.3, AC-2.1, AC-2.2, AC-2.3 (seeded with a token the backend never issued, which profile-api@v1 guarantees answers like an expired one), AC-3.1, and the PRD's success metric (Home within 3 seconds of Sign in); a contract replay through the dev proxy: every `exact` fixture request sent to the web dev server's `/api` gets the fixture's response, with tokens from real sign-ins; a `README.md` with the run instructions and the demo accounts. The backend's development address is `http://127.0.0.1:3000` (auth-api@v1).
- **Size estimate:** ~6 files (~280 lines), <= 6 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** from a fresh clone, `npm run install:all && npm run dev`, open `http://localhost:5173`, sign in as `ayu`, see the profile, reload, still signed in, sign out; then the same with a wrong password.
- **Review tier:** full-review
- **Dependencies:** simple-login.backend.2 (hard: the real service), simple-login.web.3 (hard: the complete web app)

### simple-login.integration.2: Phone number end to end

- **Consumes:** [auth-api@v1, profile-api@v2]
- **Produces:** none
- **Scope:** per hsdd/management/2026-10-30-intake-add-phone.md. The browser suite proves the amended AC-2.1 and the new AC-2.4 against the real service and the real web app: the AC-2.1 test also sees Ayu's phone number; a new AC-2.4 test matches each built-in account's number as the whole text, exactly as profile-api@v2's `200` fixtures carry it (`+62 812 3456 7890` for `ayu`, `+62 813 9876 5432` for `budi`), so a reformatted number fails; the Budi test also sees Budi's number and not Ayu's. The proxy replay moves from `hsdd/contract/fixture/profile-api/` to `hsdd/contract/fixture/profile-api.v2/` (still every `exact` fixture: four of auth-api@v1, five of profile-api@v2). Its exact `200` replays prove the backend stores the numbers the change request names, and the browser tests prove the web app shows them unchanged; together they are AC-2.4's "exactly as the account stores it". The expired-token stand-in (a backend restart) and the AC-2.3 test now rest on profile-api@v2's guarantee that every rejection gives the same 401 body; comments that cite profile-api@v1 move to v2. The `README.md` names profile-api@v2 where it names the replayed contracts, and its demo-accounts table gains each account's phone number. Selectors stay on visible text, never web-internal markup or storage. The root `package.json` scripts and `scripts/` do not change.
- **Size estimate:** ~4 files (~35 lines), <= 4 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** signed in as `ayu`, Home shows `+62 812 3456 7890` with the other details, and as `budi` shows `+62 813 9876 5432`; a web app that reformats the number (spaces dropped, say) fails the AC-2.4 test; every other criterion behaves as in simple-login.integration.1 (update 1: nothing else in the PRD changes).
- **Review tier:** spot-check
- **Dependencies:** simple-login.integration.1 (shipped: the browser rig, the proxy replay, `npm test`); simple-login.backend.3 (hard: the real service serving profile-api@v2); simple-login.web.4 (hard: the web app showing the phone number). Land it with simple-login.backend.3: once the backend serves profile-api@v2, integration.1's replay of profile-api@v1's `exact` `200` fixtures fails on the new `phone` field (profile-api@v2, Versioning), so the root `npm test` is red until this phase merges.

### simple-login.integration.3: PostgreSQL rig, booking replay and the Success tests

- **Consumes:** [auth-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. The rig runs the real service on its real PostgreSQL 17 beside the real web app, and the PRD v2 Success tests run against it. (a) PostgreSQL is simple-login.backend's Compose service (`127.0.0.1:55432`, user, password and database `meeting_rooms`); this node starts it only with `npm --prefix backend run db:up`, which picks `docker compose` or `docker-compose` and returns once healthy (on this laptop only `docker-compose` exists, so no root script calls Docker), and never reads or writes the backend's tables. Root `package.json`: `dev` becomes `npm --prefix backend run db:up && node scripts/dev.mjs` (the service then uses its default database, `meeting_rooms`); `test` runs `npm --prefix backend run db:up` after the web gate and before `node --test "scripts/*.test.mjs"` and `npm run e2e`; `pg` joins the root devDependencies. scripts/dev.mjs and scripts/dev.test.mjs do not change. (b) The browser suite runs on a database of its own: a Playwright global setup runs `npm --prefix backend run db:up`, connects with `pg` to `postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/postgres` and runs `DROP DATABASE IF EXISTS meeting_rooms_e2e WITH (FORCE)` then `CREATE DATABASE meeting_rooms_e2e`, so every run starts with no bookings and `meeting_rooms` keeps the developer's. The worker fixture in e2e/fixtures.ts starts the service with `npm --prefix backend start` in a process group of its own (stopped as scripts/dev.mjs stops its children), with `PORT=3000` and `DATABASE_URL=postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms_e2e`, never by a path under `backend/`; `restart()` stops the whole group, waits for port 3000 to close and starts the service again on the same database, so every booking stays and every token ends (auth-api@v1 G3). The rig assumes the service creates its tables and the four pre-loaded rooms in an empty database when it starts, which this plan's request entry on booking-api@v1 asks the backend to confirm; if the backend answers with a separate command, the global setup runs that command with the same `DATABASE_URL`. (c) playwright.config.ts sets `process.env.TZ = "Asia/Kolkata"` before anything reads the clock, so the runner, its workers and the service they start inherit it, and `use.timezoneId: "Asia/Kolkata"` for the browser: a zone that is neither account's nor UTC (ADR-002). (d) e2e/api.ts: sign-in (auth-api@v1) and the four booking-api@v1 calls against the service's development address `http://127.0.0.1:3000`, each returning the status and the parsed body; instants are `toISOString()` strings (`2026-11-05T02:00:00.000Z`) on quarter hours of UTC (ADR-002 Decisions 1 and 6). (e) The proxy replay (e2e/proxy-replay.spec.ts) adds every booking-api@v1 fixture whose answer comes from a rule checked before any rule that reads the clock or the stored bookings: the eight 400 `VALIDATION_FAILED` (book-end-not-after-start, book-instant-with-offset, book-not-on-a-quarter-hour, book-title-blank, book-title-too-long, book-unknown-room, rooms-from-not-before-to, rooms-instant-without-milliseconds), the four 401 `UNAUTHORIZED` (book-unknown-token, cancel-no-token, rooms-no-token, and my-bookings-expired-token, whose `{{expired-token:budi}}` the shipped restart fills), the two 404 `BOOKING_NOT_FOUND` (cancel-unknown, cancel-malformed-id) and the 422 `BOOKING_TOO_LONG` (book-too-long: the length rule is order 3 of `POST /api/bookings`, before the clock's orders 4 and 5). Its count check becomes 24 exact fixtures: 4 of auth-api@v1, 5 of profile-api@v2, 15 of booking-api@v1, none of profile-api@v1. The other 20 booking-api@v1 fixtures need a set clock or seeded bookings, which only the producer's replay has (booking-api@v1 Validation). (f) e2e/success.spec.ts, PRD v2 Success at the service. 20 simultaneous attempts: 20 requests to book one room for one range, sent at once with Node's `fetch` (10 with ayu's token, 10 with budi's), give exactly one 201 and nineteen 409 `BOOKING_CONFLICT` whose `error.conflict` equals the 201's booking, and no 5xx; GET /api/rooms over the range then lists that one booking in that room (booking-api@v1 G5, G6). Five rounds, each on a slot of its own; in the fifth the 20 ranges differ but all contain one quarter hour. A restart keeps every booking: bookings for ayu and budi in three rooms, then `restart()`; each old token now gets 401 `UNAUTHORIZED` at GET /api/me/bookings, and after signing in again each account's list and GET /api/rooms return the same bookings with the same ids (booking-api@v1 G17, auth-api@v1 G3, ADR-001). AC-5.5 at the service: booking the current quarter hour of UTC, which the real clock has reached, gives 422 `BOOKING_STARTED` (G7). AC-6.3: budi cancelling ayu's booking gives 403 `BOOKING_NOT_YOURS`, and ayu's list still holds it (G12). (g) Every test books on dates and rooms no other test uses, so no test meets another's bookings. (h) README.md: the product is now sign-in, a profile with phone number and time zone, and meeting-room booking, served by a Fastify service with PostgreSQL 17 and a React web app with Login, Home and Rooms; prerequisites gain Docker with Compose (`docker compose` or the standalone `docker-compose`) and, on macOS, Colima (`colima start` before `npm run dev`); `npm run dev` starts PostgreSQL, then the service and the web app; `npm --prefix backend run db:down` stops PostgreSQL and keeps the bookings; restarting the service signs everyone out and keeps every booking (ADR-001); the demo accounts table gains each account's time zone (`ayu` Asia/Jakarta, `budi` Europe/London); a rooms table lists Merapi (Jakarta, 8 seats), Bromo (Jakarta, 4), Thames (London, 10) and Kew (London, 4); the test section names the 24 replayed fixtures, the Success tests, the browser's Asia/Kolkata zone and the database `meeting_rooms_e2e` each browser run re-creates. The shipped browser tests keep passing unchanged; selectors stay on visible text.
- **Size estimate:** ~8 files (~340 lines), <= 7 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** from a fresh clone with Colima (or Docker) running, `npm run install:all && npm run dev` starts PostgreSQL, the service and the web app, and `ayu` signs in; `npm test` passes twice in a row, each run on a freshly created `meeting_rooms_e2e`, while a booking made through `npm run dev` stays in `meeting_rooms`; each of the five rounds names one winner.
- **Review tier:** full-review
- **Dependencies:** simple-login.integration.2 (shipped: the browser rig, the proxy replay, `npm test`); simple-login.backend.4 (hard: every profile carries `timeZone`; until it ships, the shipped replay of profile-api@v2's `me-ayu` and `me-budi` fails, profile-api@v2 Versioning); simple-login.backend.7 (hard: the service serving booking-api@v1 with its bookings in PostgreSQL, started by `npm --prefix backend start` after `db:up`). Land it with the backend's PostgreSQL work: once the service needs its database, the shipped rig, which spawns `backend/src/server.ts` with neither `db:up` nor `DATABASE_URL`, passes only while an earlier step has left PostgreSQL running.

### simple-login.integration.4: Home in the browser: time zone, my bookings, cancelling

- **Consumes:** [auth-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. (a) e2e/time.ts: pure functions that take the zone as an argument and use `Intl` only, never the ambient zone and never the web app's code: today's date in a zone; a date's range, from its start up to the start of the next date (never taken as 24 hours); its quarter-hour instants; a wall time on a date to its instants (two in an hour the clocks repeat, none in one they skip); the next last Sunday of March and of October strictly after today's date in London; and the strings of ADR-002 Decision 7: a time as 24-hour `HH:mm`; a date as `en-GB` writes weekday, day and month (`Thu 5 Nov`); a time whose date, in the zone it is shown in, is not its line's date, prefixed with its own date (`23:00 to Fri 6 Nov 02:00`); a time in an hour the clocks repeat, followed by the zone's `en-GB` short name (`01:30 BST`, `01:30 GMT`); a booking of a room in another zone, followed by `({start} to {end} in {office})`; and Home's line `{date}  {start} to {end}`, whose line date is the start's date. Its tests, e2e/time.spec.ts, pin: London's 2026-11-05 runs from 2026-11-05T00:00:00.000Z to 2026-11-06T00:00:00.000Z and Jakarta's from 2026-11-04T17:00:00.000Z to 2026-11-05T17:00:00.000Z; London's 2027-03-28 is 23 hours with 92 quarter hours and none from 01:00 to 01:45; London's 2027-10-31 is 25 hours with 100, 01:00 to 01:45 first BST, then GMT; from 2026-11-01T00:00:00.000Z the next change days are 2027-03-28 and 2027-10-31; a London booking from 16:00 to 19:00 on 5 November 2026 reads `23:00 to Fri 6 Nov 02:00` for a user in Jakarta; 2026-11-05T02:00:00.000Z to 2026-11-05T03:00:00.000Z in Merapi reads `02:00 to 03:00 (09:00 to 10:00 in Jakarta)` for a user in London. (b) e2e/home.spec.ts. AC-2.1: the shipped test also sees the `Time zone` row with ayu's zone. AC-2.5: each account's Home shows its zone as its name, the whole text, read from profile-api@v2's `me-ayu` and `me-budi` fixtures (`Asia/Jakarta`, `Europe/London`); a booking of ayu's for Thames from 10:00 to 11:00 London time shows on her Home in Jakarta time (`17:00 to 18:00` on a date in British winter time), and a booking of budi's for Merapi from 09:00 to 10:00 Jakarta time shows on his Home in London time (`02:00 to 03:00` in British winter time); the browser runs in Asia/Kolkata, so a time shown in the browser's zone fails. AC-6.1: three bookings of budi's, made through booking-api@v1 out of order, show on his Home soonest first, each as `{date}  {start} to {end}` then `{room} · {title}` with a `Cancel` button; a booking of ayu's does not appear on budi's Home; once every booking of a user has been cancelled through booking-api@v1, Home shows `(no bookings)` under `My bookings`. AC-6.2: `Cancel` on one of budi's bookings removes its lines at once and leaves the others; ayu then books the same room and range through booking-api@v1 and gets 201 (booking-api@v1 G11). PRD v2 Success in the browser: budi signed in with a booking, `restart()`, a reload shows Login with `Your session has expired. Please sign in again.` (AC-2.3), and after signing in again Home still lists the booking. (c) e2e/login.spec.ts: the AC-1.1 test asserts that the right password reaches Home and no longer asserts 3 seconds, a PRD 1 success metric PRD v2 Success does not name. Bookings a test needs beforehand are made through e2e/api.ts on dates and rooms no other test uses; expected strings come from e2e/time.ts with the account's zone, and lines match as text with whitespace normalized. Selectors stay on visible text: `Time zone`, `My bookings`, `Cancel`, `(no bookings)`, `Book a room`, `Sign out`.
- **Size estimate:** ~4 files (~250 lines), <= 6 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** in `npm run dev`, signed in as `budi`, Home shows `Europe/London` and his bookings soonest first in London time, and `Cancel` removes one at once; changing the laptop's time zone does not move a time on screen; e2e/time.spec.ts reproduces ADR-002's examples.
- **Review tier:** spot-check
- **Dependencies:** simple-login.integration.3 (the database of its own, the backend fixture's `restart()`, e2e/api.ts, the browser's Asia/Kolkata zone); simple-login.web.9 (hard: the web app's Home with the time zone, my bookings and `Cancel`; the last web phase booking-api@v1 names among its consumers).

### simple-login.integration.5: Rooms and booking in the browser, clock-change days included

- **Consumes:** [auth-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-002]
- **Scope:** per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md. Browser tests for US-4 and US-5 against the real service and the real web app. They reach Rooms through Home's `Book a room` and find controls by the words PRD v2 Screens shows: the date input after `Rooms on`, the `Home` button, the selects `room`, `start` and `end`, the field `title` and the button `Book`. Bookings a test needs beforehand are made through e2e/api.ts on dates and rooms no other test uses; expected strings come from e2e/time.ts with the account's zone. (a) e2e/rooms.spec.ts. AC-4.1: Rooms lists `Merapi · Jakarta · 8 seats`, `Bromo · Jakarta · 4 seats`, `Thames · London · 10 seats` and `Kew · London · 4 seats`, in that order, with the date input on today's date in the user's zone, and `Home` returns to Home. AC-4.2: a date picked in the user's zone shows under each room the bookings that overlap it, earliest first, each as `{start} to {end}  {title}`, and `(no bookings)` under a room with none; a London booking from 16:00 to 19:00 shows for ayu on the date it starts in Jakarta with its end's own date (`23:00 to Fri 6 Nov 02:00` for 5 November 2026), and again on the next date with its start's. AC-4.3: a Merapi booking from 09:00 to 10:00 Jakarta time shows for budi as his London times followed by `(09:00 to 10:00 in Jakarta)`; a Thames booking shows for ayu followed by `({start} to {end} in London)`; a booking in the user's own zone shows no such line. AC-5.1 and AC-5.2: budi books a room through the form and sees `Booked.` and the new line; every start and end offered falls on :00, :15, :30 or :45, and every end offered is after the chosen start. AC-5.3: a booking that overlaps one of ayu's in Merapi is refused with `Merapi is already booked from {start} to {end}.`, the other booking's times in budi's zone (`02:00 to 03:00` for Jakarta's 09:00 to 10:00 in British winter time), and one that only touches it gives `Booked.`. AC-5.4: ayu and budi, in two browser contexts on Rooms, choose the same room and range and press `Book` together; exactly one sees `Booked.`, the other sees AC-5.3's message with the winner's times in their own zone, and the room then shows one booking. AC-5.5: with only the browser's clock held five minutes before the current quarter hour (`page.clock.setFixedTime` before the page loads; the service keeps the real clock), the form offers that quarter hour on its date in the user's zone, which the test picks, and booking it shows `That time has already started.` and makes no booking. AC-5.6: an empty title, a title of spaces only and an 81-character title each make no booking (checked through booking-api@v1, whichever way the form refuses them), and an 80-character title gives `Booked.` and shows exactly as typed. AC-2.3 at a booking call: after `restart()`, pressing `Book` lands on Login with `Your session has expired. Please sign in again.`. (b) e2e/clock-change.spec.ts, AC-4.4, on the next last Sunday of March and the next of October strictly after today's date in London, from e2e/time.ts, never a fixed date (ADR-002 Consequences). For budi, Rooms on the March day offers 92 starts and none from 01:00 to 01:45; on the October day it offers 100, among them `01:00 BST` to `01:45 BST` and then `01:00 GMT` to `01:45 GMT`. On each of the two days whose booking starts at most 365 days after the real clock (booking-api@v1 G10), budi books Thames through the form, from 00:30 to 02:30 on the March day (one elapsed hour, across the skipped one) and from `01:30 BST` to `01:30 GMT` on the October day; his Rooms line reads `00:30 to 02:30` and `01:30 BST to 01:30 GMT`, and his Home line, for 2027, `Sun 28 Mar  00:30 to 02:30` and `Sun 31 Oct  01:30 BST to 01:30 GMT`; ayu's Rooms on the same date reads `07:30 to 08:30` followed by `(00:30 to 02:30 in London)` and `(01:30 BST to 01:30 GMT in London)`. The nearer day is always within 365 days (at most 217 days ahead); the farther one is beyond it for about six days in some years, and then the test checks that day's starts and Rooms lines only and adds a Playwright annotation saying the booking was skipped.
- **Size estimate:** ~2 files (~300 lines), <= 7 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** in `npm run dev`, as `budi`, Rooms on the next last Sunday of March offers no start from 01:00 to 01:45 and on the next of October offers 01:00 to 01:45 twice, marked BST then GMT; two browsers booking the same Thames hour at once give one `Booked.` and one AC-5.3 message; `npm test` passes whatever the laptop's time zone.
- **Review tier:** full-review
- **Dependencies:** simple-login.integration.3 (the database of its own, the backend fixture's `restart()`, e2e/api.ts, the browser's Asia/Kolkata zone); simple-login.integration.4 (e2e/time.ts); simple-login.web.9 (hard: the Rooms screen with its date, its booking form and its messages; the last web phase booking-api@v1 names among its consumers).

### Phase dependency graph

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TD
    B2["simple-login.backend.2<br/>Sign-in, sessions, endpoints"]
    W3["simple-login.web.3<br/>Home screen, session flow"]
    I1["simple-login.integration.1<br/>End-to-end run and browser test"]
    B3["simple-login.backend.3<br/>produces profile-api@v2"]
    W4["simple-login.web.4<br/>consumes profile-api@v2"]
    I2["simple-login.integration.2<br/>Phone number end to end"]

    B2 -. "hard: the running service" .-> I1
    W3 -. "hard: the running web app" .-> I1
    I1 --> I2
    B3 -. "hard: the service on profile-api@v2" .-> I2
    W4 -. "hard: the web app showing the phone" .-> I2

    B4["simple-login.backend.4<br/>profile-api@v2 with timeZone"]
    B7["simple-login.backend.7<br/>produces booking-api@v1"]
    W9["simple-login.web.9<br/>last booking-api@v1 consumer"]
    I3["simple-login.integration.3<br/>PostgreSQL rig, replay, Success tests"]
    I4["simple-login.integration.4<br/>Home in the browser"]
    I5["simple-login.integration.5<br/>Rooms in the browser, clock-change days"]

    I2 --> I3
    B4 -. "hard: profiles with timeZone" .-> I3
    B7 -. "hard: booking-api@v1 on PostgreSQL" .-> I3
    I3 --> I4
    I3 --> I5
    I4 --> I5
    W9 -. "hard: Home with my bookings" .-> I4
    W9 -. "hard: the Rooms screen" .-> I5

    style B2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I1 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W4 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I2 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B4 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style B7 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W9 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I3 fill:#d1fae5,stroke:#059669,color:#1e293b
    style I4 fill:#d1fae5,stroke:#059669,color:#1e293b
    style I5 fill:#d1fae5,stroke:#059669,color:#1e293b
```

## Governance updates (pending reconcile)

> Reconciled 2026-10-29 by hsdd-reconcile. Drained entries are in git history.

> Reconciled 2026-10-30 by hsdd-reconcile. Drained entries are in git history.

> Reconciled 2026-11-01 by hsdd-reconcile. Drained entries are in git history.
