# simple-login.integration.5: Rooms and Booking in the Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browser tests for PRD v2 US-4 and US-5 (AC-4.1 to AC-4.4, AC-5.1 to AC-5.6, AC-2.3 at a booking call) against the real service on its real PostgreSQL and the real web app, London's clock-change days included.

**Architecture:** One new driver module, `e2e/rooms.ts`, reaches Rooms through Home's `Book a room` and reads and drives it by the words PRD v2 Screens shows; two spec files use it: `e2e/rooms.spec.ts` (US-4, US-5 on winter dates of its own) and `e2e/clock-change.spec.ts` (AC-4.4 on the next last Sundays of March and October in London). Every expected string comes from `e2e/time.ts` with the account's zone; bookings a test needs beforehand go through `e2e/api.ts`. The rig (`e2e/fixtures.ts`, `e2e/global-setup.ts`, `playwright.config.ts`) is unchanged.

**Tech Stack:** Node.js 24 (runs `.ts` directly), `@playwright/test` 1.64 driving the installed Chrome in `Asia/Kolkata`, the real Fastify service on PostgreSQL 17 (`meeting_rooms_e2e`), the real Vite dev server.

**Spec:** `hsdd-context/superpowers/simple-login.integration.5.md` (the phase context, verbatim, between its markers). Worktree: `<repo>`; run every command from it.

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 7 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm test` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.integration.5.verification.md from
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

Project rules every task also obeys:

- Never read or change anything under `backend/` or `web/` (the node does not own them; the web app is a black box seen through the browser). Never read other nodes' specs or other phases' contexts or plans.
- Selectors are visible words only: `Book a room`, the date input labelled `Rooms on`, the `Home` button, the comboboxes `room`, `start`, `end`, the textbox `title`, the button `Book`, and visible text. Never CSS classes, ids, option `value`s or storage.
- Expected strings come from `e2e/time.ts` with the account's zone (`budi` is `Europe/London`, `ayu` is `Asia/Jakarta`); a literal from the Scope is added beside a computed string only as a pin (as `home.spec.ts` does with `expect(line).toContain("17:00 to 18:00")`).
- No file written in this phase contains the em dash character (U+2014) or the hyphenated adjective joining "load" and "bearing" (a banned phrase).
- Commits use the repository's configured identity and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Ports 3000 and 5173 must be free before a Playwright run; leave no server running.
- Evidence (red and green outputs) goes under `docs/superpowers/evidence/simple-login.integration.5/`, committed with the task.

## Design rationale

- **Red steps use named network mutants.** The web app's Rooms screen and the service already ship (simple-login.web.9, simple-login.backend.7), so a new test passes at once. Each failing-test step installs a mutant for the run only, with Playwright's `page.route` or `context.route` in the spec under test (an uncommitted edit), records the failing output and the mutant's diff in the evidence file, then removes the edit. The mutants stand for real faults the tests exist to catch:
  - `M-zone`: `GET /api/me` answered with `timeZone: "Asia/Kolkata"` (the browser's zone used as the user's, ADR-002 Alternatives).
  - `M-order`: `GET /api/rooms` answered with `rooms` reversed.
  - `M-room-zone`: `GET /api/rooms` answered with every room's `timeZone` set to the signed-in user's zone (no room's local times shown).
  - `M-fake-201`: `POST /api/bookings` answered locally with 201 and the request's fields plus a made-up id, never reaching the service.
  - `M-conflict-shift`: a 409 answer's `error.conflict.start` and `end` moved one hour later.
  - `M-title`: the `POST /api/bookings` body's `title` trimmed before it reaches the service.
  Mutants are installed with this shape (the controller checks it in review):
  ```ts
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), timeZone: "Asia/Kolkata" } });
  });
  ```
  No `web/` or `backend/` mutant: this phase does not read that code.
- **A shared driver, `e2e/rooms.ts`.** Both spec files open Rooms, pick a date, read a room's lines and book through the form; a spec file cannot import another spec file, so the driver is its own module. The Scope estimates ~2 files; the driver makes 3.
- **A room's lines are read as text.** `roomLines` takes the `main` landmark's `innerText`, finds the room's heading line (`Merapi · Jakarta · 8 seats`), and returns the non-blank lines up to the next heading or `Book:`. Lines keep their raw spacing (the screen shows `{start} to {end}  {title}` with two spaces, and a title's own spaces), so a test compares them exactly. A room in another zone than the user's shows its local times as the next line, `({start} to {end} in {office})`.
- **Dates of their own.** `rooms.spec.ts` follows `home.spec.ts`'s header: it recomputes home's six winter dates with the same expression and continues from the day after the last, `britishWinterDays(addDays(HOME_DATES[5], 1), 8)`. Every booking it makes lies between 00:00 and 17:00 London time on its date, so ayu's Jakarta view of a date (from 17:00 UTC the day before) holds only that date's bookings; the one exception, AC-4.2's 16:00 to 19:00 London booking, owns the next date too (`DATES[1]` is never used). `clock-change.spec.ts` books Thames on the two clock-change days, which are never winter dates; `rig.spec.ts` and `success.spec.ts` assert only their own rooms on those days (simple-login.integration.3's final review).
- **AC-4.1 holds the browser's clock.** The default date depends only on the browser's clock and the user's zone (ADR-002 Decision 5). At an arbitrary hour the user's date usually equals the browser zone's, so the test fixes the browser's clock (`page.clock.setFixedTime`, before the page loads) at the latest past instant where the dates differ: 17:45 UTC for ayu (Jakarta's next date; Asia/Kolkata and UTC still on the earlier one) and 20:00 UTC for budi (London's date; Asia/Kolkata on the next). A past instant keeps the token's `expiresAt` ahead of the browser's clock.
- **AC-5.6 checks the outcome, not the mechanism.** Each refused title is attempted with `Book` when enabled, else Enter in `title`; then the 80-character title is booked on the same room and range. Any refused title that had been booked would make that last attempt a conflict, and `GET /api/rooms` then lists exactly one booking there, with the 80-character title.
- **AC-5.4 with two contexts.** `browser.newContext()` inherits `baseURL` and `timezoneId` from the config (checked: `Asia/Calcutta`, Chrome's name for Asia/Kolkata). Both pages press `Book` in one `Promise.all`.

## Review Focus

1. A run that starts in the last quarter hour before midnight in London, or in October's repeated hour: AC-5.5's quarter hour then carries a date prefix or ` BST`/` GMT`; its labels come from `timeLabel`, never from `HH:mm` formatting (Task 4).
2. The farther clock-change day more than 365 days ahead (about six days a year, after late October): the booking is skipped with a Playwright annotation, never a failure; `bookable(start, now)` decides and the test pins it on one instant each side of the limit (Task 5).
3. A title with an astral character and runs of spaces: one emoji is one character (booking-api@v1 Values), and the title is shown and stored exactly as typed, untrimmed (Task 4).
4. Another test's bookings on a shared view (Rooms shows every user's bookings, booking-api@v1 G13): the date rule above; exact line lists only on dates and rooms a test owns (Tasks 1 to 5).
5. The laptop's own zone (this laptop is in Asia/Jakarta, ayu's zone) leaking into an expected string: every expected string names its zone; the gate is also run with `TZ=Europe/London` (Task 5).

---

### Task 1: The Rooms driver, AC-4.1 and AC-4.2

**Files:**
- Create: `e2e/rooms.ts`
- Create: `e2e/rooms.spec.ts`
- Evidence: `docs/superpowers/evidence/simple-login.integration.5/task-1-red-*.txt`, `task-1-green.txt`

**Interfaces:**
- Consumes: `e2e/time.ts` (`LONDON`, `JAKARTA`, `addDays`, `britishWinterDays`, `todayIn`, `dateIn`, `wallTimeInstants`, `rangeLabel`, `formatDate`, `type IsoDate`, `type Instant`), `e2e/api.ts` (`PASSWORDS`, `postBooking`, `getRooms`, `tokenFor`, `type Booking`, `type Username`), `e2e/fixtures.ts` (`test`, `expect`, `signIn`).
- Produces (in `e2e/rooms.ts`):
  - `type RoomId = "merapi" | "bromo" | "thames" | "kew"`
  - `const ROOMS: Readonly<Record<RoomId, { name: string; office: string; timeZone: string; heading: string }>>` with PRD v2 Rooms' values; `heading` is `Merapi · Jakarta · 8 seats`, `Bromo · Jakarta · 4 seats`, `Thames · London · 10 seats`, `Kew · London · 4 seats`.
  - `const ZONES: Readonly<Record<Username, string>>`: `ayu` `JAKARTA`, `budi` `LONDON` (profile-api@v2 G4).
  - `openRooms(page: Page, who: Username): Promise<void>`: `page.goto("/")`, `signIn`, click `Book a room`, wait for the `Rooms on` date input.
  - `showDate(page: Page, date: IsoDate): Promise<void>`: fills the `Rooms on` input.
  - `roomLines(page: Page, room: RoomId): Promise<string[]>`: as in Design rationale.
  - `expectedLines(booking: Pick<Booking, "start" | "end" | "title">, room: RoomId, userZone: string, lineDate: IsoDate): string[]`: `[`${rangeLabel(start, end, userZone, lineDate)}  ${title}`]`, plus `(${rangeLabel(start, end, ROOMS[room].timeZone, lineDate)} in ${office})` when the room's zone is not `userZone`.
  - `bookViaApi(who: Username, room: RoomId, date: IsoDate, zone: string, from: string, to: string, title: string): Promise<Booking>`: first instant of each wall time from `wallTimeInstants`, `postBooking`, expects 201.

- [ ] **Step 1: Write the failing tests** in `e2e/rooms.spec.ts`, with a header like `home.spec.ts`'s: the date rule, a table of test, date index, rooms, accounts.
  - `AC-4.1: Rooms lists the four rooms in order, opens on today in the user's zone, and Home returns` : for each of ayu (clock 17:45 UTC) and budi (clock 20:00 UTC): `page.clock.setFixedTime(at)` before `openRooms`; the four headings appear in `main`'s text in the order Merapi, Bromo, Thames, Kew; the `Rooms on` input has `todayIn(ZONES[who], at)`, and the test asserts that this differs from `todayIn("Asia/Kolkata", at)`; pressing `Home` shows `Hello, Ayu Lestari` (or `Hello, Budi Santoso`).
  - `AC-4.2: a date in ayu's zone shows each room's overlapping bookings, earliest first, and (no bookings)` on `DATES[0]`: through the API, ayu books Kew 08:00 to 09:00 then 03:00 to 04:00 London time (out of order) and Thames 16:00 to 19:00 London time. On Jakarta date `DATES[0]`: Merapi and Bromo are exactly `["(no bookings)"]`; Kew is exactly the two bookings' `expectedLines`, the 03:00 one first; Thames is exactly its `expectedLines` and its first line contains `23:00 to ${formatDate(addDays(DATES[0], 1))} 02:00` (pin: `23:00 to Fri 6 Nov 02:00` in the Scope's example). On the next date, Thames's lines contain its `expectedLines` for that line date, the first starting `${formatDate(DATES[0])} 23:00 to 02:00`.
- [ ] **Step 2: Run against `M-zone`, then `M-order`; expect FAIL.** Run: `npx playwright test e2e/rooms.spec.ts`. `M-zone` must fail AC-4.1 (the date) and AC-4.2 (the lines); `M-order` must fail AC-4.1 (the order). Save each output with the mutant's diff as `task-1-red-zone.txt` and `task-1-red-order.txt`; remove the mutant.
- [ ] **Step 3: Implement `e2e/rooms.ts`** with the signatures above until the tests run without mutants.
- [ ] **Step 4: Run and expect PASS.** `npx playwright test e2e/rooms.spec.ts`: 2 passed; save as `task-1-green.txt`.
- [ ] **Step 5: Commit** `e2e/rooms.ts`, `e2e/rooms.spec.ts` and the evidence: `e2e: Rooms lists the rooms and a date's bookings in the user's zone (integration.5)`.

### Task 2: AC-4.3, AC-5.1 and AC-5.2

**Files:**
- Modify: `e2e/rooms.spec.ts` (two tests); `e2e/rooms.ts` only if a helper below is missing
- Evidence: `task-2-red-room-zone.txt`, `task-2-red-fake-201.txt`, `task-2-green.txt`

**Interfaces:**
- Consumes: Task 1's `e2e/rooms.ts`.
- Produces (in `e2e/rooms.ts`):
  - `optionLabels(page: Page, name: "start" | "end"): Promise<string[]>`: the visible labels of that combobox's options, in order.
  - `bookThroughForm(page: Page, choice: { room: string; start: string; end: string; title: string }): Promise<void>`: selects `room`, `start`, `end` by label, fills `title`, presses `Book`.
  - `labelInstants(date: IsoDate, zone: string): Map<string, Instant>`: each quarter hour of `date` and the next date, keyed by `timeLabel(at, zone, date)`.

- [ ] **Step 1: Write the failing tests.**
  - `AC-4.3: another office's bookings also show the room's local times; the user's own zone shows none` on `DATES[2]`: ayu books Merapi 09:00 to 10:00 and Bromo 11:00 to 12:00 Jakarta time; budi books Thames 10:00 to 11:00 and Kew 13:00 to 14:00 London time. Budi on London date `DATES[2]`: Merapi is exactly its `expectedLines` (pins: first line contains `02:00 to 03:00`, second is `(09:00 to 10:00 in Jakarta)`), Kew exactly one line. Ayu on Jakarta date `DATES[2]`: Thames is exactly its `expectedLines` (pin: second line `(10:00 to 11:00 in London)`), Bromo exactly one line.
  - `AC-5.1 and AC-5.2: budi books through the form; starts and ends fall on quarter hours, every end after its start` on `DATES[3]`: `optionLabels(page, "start")` equals `quarterHours(DATES[3], LONDON).map((at) => timeLabel(at, LONDON, DATES[3]))` and has 96 entries; for each of the starts `09:00` and `23:00`, after selecting it every end label is a key of `labelInstants(DATES[3], LONDON)` whose instant is after the start's; then `bookThroughForm` Bromo, `09:00`, `10:00`, `Form booking`: `Booked.` shows, Bromo's lines become exactly its `expectedLines` (pin: `(16:00 to 17:00 in Jakarta)`), and `GET /api/me/bookings` for budi holds a booking with that title and those two instants.
- [ ] **Step 2: Run against `M-room-zone` (fails AC-4.3) and `M-fake-201` (fails AC-5.1: no line or no stored booking); expect FAIL.** Save outputs with diffs; remove the mutants.
- [ ] **Step 3: Add the helpers** to `e2e/rooms.ts`.
- [ ] **Step 4: Run and expect PASS.** `npx playwright test e2e/rooms.spec.ts`: 4 passed; save `task-2-green.txt`.
- [ ] **Step 5: Commit**: `e2e: room-local times and booking through the form on Rooms (integration.5)`.

### Task 3: AC-5.3 and AC-5.4

**Files:**
- Modify: `e2e/rooms.spec.ts`
- Evidence: `task-3-red-conflict-shift.txt`, `task-3-red-fake-201.txt`, `task-3-green.txt`

**Interfaces:**
- Consumes: `openRooms`, `showDate`, `roomLines`, `expectedLines`, `bookViaApi`, `bookThroughForm` from `e2e/rooms.ts`; `getRooms` from `e2e/api.ts`.
- Produces: `overlapMessage(room: RoomId, other: Pick<Booking, "start" | "end">, userZone: string, lineDate: IsoDate): string` in `e2e/rooms.ts`: `${ROOMS[room].name} is already booked from ${rangeLabel(other.start, other.end, userZone, lineDate)}.`

- [ ] **Step 1: Write the failing tests.**
  - `AC-5.3: an overlap is refused with the other booking's times in budi's zone; touching books` on `DATES[4]`: ayu books Merapi 09:00 to 10:00 Jakarta time through the API; budi books Merapi `02:30` to `03:30` through the form: the exact text `overlapMessage("merapi", ayus, LONDON, DATES[4])` shows (pin: contains `02:00 to 03:00`) and Merapi still lists only ayu's booking; then `03:00` to `04:00`: `Booked.` and Merapi lists both, ayu's first.
  - `AC-5.4: two users pressing Book together get one booking; the other sees the overlap message in their own zone` on `DATES[5]`: budi on `page`, ayu on a page of `browser.newContext()` (closed in `finally`), both on Rooms on `DATES[5]` with Thames and the same range (`10:00` to `11:00` for budi, `17:00` to `18:00` for ayu), titles `Race budi` and `Race ayu`; both `Book` clicks in one `Promise.all`. Each page then shows `Booked.` or its own overlap message (`Thames is already booked from 10:00 to 11:00.` for budi, `... 17:00 to 18:00.` for ayu, computed with `overlapMessage`), checked with `locator.or`; exactly one page shows `Booked.`; `GET /api/rooms` over the London date lists exactly one Thames booking, the winner's title; the winner's page lists exactly that one booking under Thames.
- [ ] **Step 2: Run against `M-conflict-shift` (fails both message checks) and `M-fake-201` on both contexts (both see `Booked.`); expect FAIL.** Save outputs with diffs; remove the mutants.
- [ ] **Step 3: Add `overlapMessage`.**
- [ ] **Step 4: Run and expect PASS.** `npx playwright test e2e/rooms.spec.ts`: 6 passed. Then run the AC-5.4 test five times in a row (`--repeat-each 5 -g "AC-5.4"`) to show no flake; save both as `task-3-green.txt`.
- [ ] **Step 5: Commit**: `e2e: overlap refusal and two users booking at once on Rooms (integration.5)`.

### Task 4: AC-5.5, AC-5.6 and AC-2.3 at a booking call

**Files:**
- Modify: `e2e/rooms.spec.ts`
- Evidence: `task-4-red-fake-201.txt`, `task-4-red-title.txt`, `task-4-green.txt`

**Interfaces:**
- Consumes: `e2e/rooms.ts`; `currentQuarterHour` from `e2e/api.ts`; the worker fixture `backend.restart()` from `e2e/fixtures.ts`.
- Produces: none.

- [ ] **Step 1: Write the failing tests.**
  - `AC-5.5: with only the browser's clock five minutes before the current quarter hour, booking it shows That time has already started.`: `q = currentQuarterHour()`; `page.clock.setFixedTime(Date.parse(q) - 5 * 60_000)` before `openRooms(page, "budi")`; `showDate(page, dateIn(q, LONDON))`; the start labels include `timeLabel(q, LONDON, date)`; book Bromo from it to the label of `q` plus 15 minutes, title `Started`: the exact text `That time has already started.` shows, and `GET /api/rooms` from `q` to `q` plus 15 minutes lists no Bromo booking.
  - `AC-5.6: blank, spaces-only and 81-character titles book nothing; 80 characters book exactly as typed` on `DATES[6]`, Kew `10:00` to `11:00`, budi: for `""`, `"   "` and an 81-code-point title, fill `title`, press `Book` if enabled, else press Enter in `title`; then book the 80-code-point title `" 😀 Retro  and planning, " + "x".repeat(...)` (exactly 80 code points, a leading space, an astral emoji, a double space): `Booked.` shows; Kew's lines are exactly `expectedLines` with that title; `GET /api/rooms` lists exactly one Kew booking on the date, `title` strictly equal to the typed one.
  - `AC-2.3: after a restart, pressing Book lands on Login with the expiry message` on `DATES[7]`: budi fills Merapi `09:00` to `10:00`, `After restart`; `backend.restart()`; press `Book`: `Your session has expired. Please sign in again.` and the `Sign in` button show; signed in again through the API, `GET /api/rooms` lists no Merapi booking on the date.
- [ ] **Step 2: Run against `M-fake-201` (fails AC-5.5 and AC-2.3) and `M-title` (fails AC-5.6); expect FAIL.** Save outputs with diffs; remove the mutants.
- [ ] **Step 3: Make the tests pass without mutants** (no new helper is expected).
- [ ] **Step 4: Run and expect PASS.** `npx playwright test e2e/rooms.spec.ts`: 9 passed; save `task-4-green.txt`.
- [ ] **Step 5: Commit**: `e2e: started times, title rules and an expired session at Book (integration.5)`.

### Task 5: AC-4.4 on London's clock-change days, the README, the gate

**Files:**
- Create: `e2e/clock-change.spec.ts`
- Modify: `README.md` (the browser suite's coverage text and the e2e row of the layout table)
- Evidence: `task-5-red-zone.txt`, `task-5-red-fake-201.txt`, `task-5-green.txt`, `gate.txt`, `gate-tz-london.txt`

**Interfaces:**
- Consumes: `e2e/rooms.ts`; `nextClockChangeDays`, `quarterHours`, `timeLabel`, `homeLine`, `wallTimeInstants` from `e2e/time.ts`.
- Produces: nothing other tasks use. Inside `e2e/clock-change.spec.ts`, a module-local `bookable(start: Instant, now: number): boolean`: `Date.parse(start) <= now + 365 * 24 * 3600 * 1000` (booking-api@v1 G10, the boundary included).

- [ ] **Step 1: Write the failing tests** in `e2e/clock-change.spec.ts`, header naming the two days, Thames, and why no other file meets them.
  - `AC-4.4: the March day offers 92 starts and none from 01:00 to 01:45`: budi, `march` from `nextClockChangeDays()`: start labels equal `quarterHours(march, LONDON)` labelled by `timeLabel`, length 92, none starts with `01:`.
  - `AC-4.4: the October day offers 100 starts, 01:00 to 01:45 BST then GMT`: length 100; the labels from `01:00 BST` to `01:45 GMT` appear as the eight consecutive entries `01:00 BST`, `01:15 BST`, `01:30 BST`, `01:45 BST`, `01:00 GMT`, `01:15 GMT`, `01:30 GMT`, `01:45 GMT`.
  - `bookable` pinned: true at exactly 365 days, false one millisecond after.
  - `AC-4.4: budi books Thames across the skipped hour on the March day` and `AC-4.4: budi books Thames from 01:30 BST to 01:30 GMT on the October day`: if `bookable(start, Date.now())`: book through the form (`00:30` to `02:30`; `01:30 BST` to `01:30 GMT`), `Booked.`; budi's Thames lines are exactly `expectedLines` (pins: `00:30 to 02:30  {title}`, `01:30 BST to 01:30 GMT  {title}`); the stored booking lasts one hour (March) and two hours (October); `Home` shows `homeLine(start, end, LONDON)` (pins when the year is 2027: `Sun 28 Mar  00:30 to 02:30`, `Sun 31 Oct  01:30 BST to 01:30 GMT`), matched with whitespace normalized as `home.spec.ts` does; ayu's Thames lines on the same date are exactly `expectedLines` (pins: `07:30 to 08:30  {title}`, `(00:30 to 02:30 in London)` and `(01:30 BST to 01:30 GMT in London)`). Else: add the annotation `{ type: "booking skipped", description: "{date} starts more than 365 days after the real clock (booking-api@v1 G10)" }` and check that day's Rooms lines only: the four headings and Thames `["(no bookings)"]`.
- [ ] **Step 2: Run against `M-zone` (the March day offers 96 starts in Asia/Kolkata) and `M-fake-201` (no stored booking); expect FAIL.** Save outputs with diffs; remove the mutants.
- [ ] **Step 3: Implement** until the file passes without mutants: `npx playwright test e2e/clock-change.spec.ts`: 5 passed; save `task-5-green.txt`.
- [ ] **Step 4: README.** Replace the browser-coverage bullet so it is true: in the browser, AC-1.1 to AC-1.3, AC-2.1 to AC-2.5, AC-3.1, AC-4.1 to AC-4.4 (London's clock-change days in `clock-change.spec.ts`), AC-5.1 to AC-5.6, AC-6.1 and AC-6.2, and AC-2.3 at a booking call; at the service AC-6.3 and the Success tests, as now. Name `rooms.ts` in the e2e row of the layout table.
- [ ] **Step 5: Gate from a clean install.** `rm -rf node_modules backend/node_modules web/node_modules test-results && npm run install:all && npm test`: exit 0, every suite's count recorded (`gate.txt`); then `TZ=Europe/London npm test` (`gate-tz-london.txt`): exit 0. Check `lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN` prints nothing.
- [ ] **Step 6: Commit**: `e2e: London's clock-change days on Rooms and Home; README coverage (integration.5)`.

### Task 6: Browser checks and the verification doc

**Files:**
- Create: `docs/superpowers/evidence/simple-login.integration.5/browser-check.mjs` and its outputs (text and screenshots)
- Create: `hsdd/verify/simple-login.integration.5.verification.md`

- [ ] **Step 1: The phase's Verification and the deferred items, in `npm run dev`.** `browser-check.mjs` drives Chrome (Playwright library, `timezoneId` `America/Los_Angeles`, a zone neither account's, Kolkata's nor the laptop's) against `http://localhost:5173`: as budi, Rooms on the next last Sunday of March (start labels, none `01:..`) and of October (`01:00 BST` to `01:45 GMT`); two contexts, budi and ayu, book the same Thames hour on a date of the check's own at once (one `Booked.`, one AC-5.3 message); screenshots of Rooms at 1280 px for the comparison with PRD v2's Screens wireframe; then cancel the check's bookings through booking-api@v1 so `meeting_rooms` keeps none of them. Stop `npm run dev`; ports 3000 and 5173 free.
- [ ] **Step 2: Write the verification doc** from `hsdd/templates/verification.md` at full-review depth: Commands to run, Expected output, Observed (dated; the gate counts before and after; each task's red mutant and green; the reviews), Outstanding, Learnings (each dispositioned, or `- none`), Metrics; `## Sign-off` exactly as the template has it. The template's title line uses an em dash; this doc's title uses ` - ` instead (project prose rule).
- [ ] **Step 3: Commit**: `verify: simple-login.integration.5 verification doc (sign-off left for the owner)`.
