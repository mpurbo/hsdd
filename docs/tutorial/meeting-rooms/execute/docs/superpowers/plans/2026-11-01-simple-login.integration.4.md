# simple-login.integration.4: Home in the browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Home against the real service and the real web app: the user's time zone, my bookings in the user's zone, `Cancel`, and bookings surviving a restart; plus the pure time helpers (e2e/time.ts) that every browser test takes its expected strings from.

**Architecture:** e2e/time.ts is a pure core over `Intl` (zone always an argument, no ambient zone, no web code). e2e/home.spec.ts makes its bookings through e2e/api.ts on dates of its own, drives Home through visible text only, and compares lines as whitespace-normalized text built by e2e/time.ts. e2e/login.spec.ts drops the 3-second assertion.

**Tech Stack:** Node.js 24, Playwright (installed Chrome), TypeScript run by Playwright's loader, `Intl.DateTimeFormat`.

**Spec:** hsdd-context/superpowers/simple-login.integration.4.md (wraps hsdd-context/simple-login.integration.4.md)

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

Phase-local rules (from the phase Scope):
- Selectors stay on visible text: `Time zone`, `My bookings`, `Cancel`, `(no bookings)`, `Book a room`, `Sign out` (plus the shipped Login labels in e2e/fixtures.ts).
- Expected strings come from e2e/time.ts with the account's zone; lines match as text with whitespace normalized.
- Bookings a test needs beforehand are made through e2e/api.ts on dates and rooms no other test uses. success.spec.ts and rig.spec.ts hold UTC days 39 to 47 ahead; this file starts at 60 days ahead.
- Evidence (red and green outputs, mutant diffs) goes to docs/superpowers/evidence/simple-login.integration.4/, committed.

**Red strategy (constraint 1).** e2e/time.ts is new: its reds are the missing module and missing functions. The Home tests cover behavior web.9 and earlier web phases already deliver, so each red runs the new test against a **named mutant at the network boundary**, injected with a temporary `page.route` block that is never committed (the diff and the failing output go into the evidence file). This keeps the red inside this node: web/ is not this phase's code and is not read.

## Design notes (decisions this phase settles)

- **Line dates for another zone's times.** `bookingTimes` labels the room's local times against the same line date as the user's times (ADR-002 Decision 7: a time whose date, in the zone it is shown in, is not the line's date carries its own date). The Scope pins only same-date examples.
- **A date in British winter time** is the first London date, on or after a start date, that is 24 hours long and starts in `GMT` (`britishWinterDate`). A clock-change day is never chosen. From any start at most ~275 days pass before one is found, so with a start of 60 days ahead a booking stays inside booking-api@v1 G10's 365 days.
- **Empty state.** AC-6.1's `(no bookings)` cancels every booking budi holds through booking-api@v1 (DELETE per id from GET /api/me/bookings), since the list is account-wide and other files may have booked for budi. No test may rely on a booking of budi's made outside its own body.

## Review Focus

1. Run on a date when 60 days ahead is British summer time: the winter date must skip forward and stay within 365 days. Pinned in Task 1 (`britishWinterDate` from 2027-06-01 and from 2027-03-28, the worst start: 2027-11-01 is 218 days later).
2. Other tests' bookings on budi's account-wide Home: order checks compare only the test's own lines. Pinned in Task 4 (positions in the normalized text, not the whole list).
3. A laptop in another zone (ambient zone leaking into time.ts): every pin runs under `TZ=Asia/Kolkata` and asserts exact UTC instants. Pinned in Task 1 and Task 2.
4. A booking of budi's already in progress when the empty-state test cancels everything: DELETE answers 422; the test fails with the booking named. Pinned in Task 4 (assert each DELETE is 204 with the booking in the message).
5. Two Home lines with the same text, making `Cancel` ambiguous: every booking a test makes has a unique title and range. Pinned in Task 4 (the Cancel locator resolves exactly one button).

---

### Task 1: e2e/time.ts dates and instants

**Files:**
- Create: `e2e/time.ts`
- Create: `e2e/time.spec.ts`

**Interfaces:**
- Produces (types): `type IsoDate = string` (`YYYY-MM-DD`); `type Instant = string` (`toISOString()` form); `const LONDON = "Europe/London"`, `const JAKARTA = "Asia/Jakarta"`.
- Produces (functions):
  - `dateIn(at: Instant | number, zone: string): IsoDate`
  - `timeIn(at: Instant | number, zone: string): string` (`HH:mm`, 24-hour)
  - `zoneName(at: Instant | number, zone: string): string` (`en-GB` short name: `GMT`, `BST`)
  - `todayIn(zone: string, now: number = Date.now()): IsoDate`
  - `addDays(date: IsoDate, days: number): IsoDate`
  - `dayRange(date: IsoDate, zone: string): { start: Instant; end: Instant }`
  - `quarterHours(date: IsoDate, zone: string): Instant[]`
  - `wallTimeInstants(date: IsoDate, time: string, zone: string): Instant[]` (0, 1 or 2; RangeError unless `time` is a quarter hour `HH:mm`)
  - `nextClockChangeDays(now: number = Date.now()): { march: IsoDate; october: IsoDate }`
  - `britishWinterDate(from: IsoDate): IsoDate`

- [ ] **Step 1: Write the failing tests** in `e2e/time.spec.ts` (import `test`, `expect` from `./fixtures.ts`, so the file shares the suite's worker):
  - `dayRange("2026-11-05", LONDON)` equals `{ start: "2026-11-05T00:00:00.000Z", end: "2026-11-06T00:00:00.000Z" }`; `dayRange("2026-11-05", JAKARTA)` equals `{ start: "2026-11-04T17:00:00.000Z", end: "2026-11-05T17:00:00.000Z" }`.
  - London 2027-03-28: range length 23 h; `quarterHours` has 92; their `timeIn` values contain none of `01:00`, `01:15`, `01:30`, `01:45`; `wallTimeInstants("2027-03-28", "01:30", LONDON)` is `[]`.
  - London 2027-10-31: range length 25 h; 100 quarter hours; the instants whose `timeIn` is `01:00` to `01:45` are 8, the first four `BST` and the last four `GMT` by `zoneName`, in that order; `wallTimeInstants("2027-10-31", "01:30", LONDON)` is `["2027-10-31T00:30:00.000Z", "2027-10-31T01:30:00.000Z"]`.
  - `nextClockChangeDays(Date.parse("2026-11-01T00:00:00.000Z"))` equals `{ march: "2027-03-28", october: "2027-10-31" }`; from `2027-03-28T12:00:00.000Z` (the March day itself) it gives `{ march: "2028-03-26", october: "2027-10-31" }` (strictly after).
  - `todayIn(JAKARTA, Date.parse("2026-11-04T17:00:00.000Z"))` is `"2026-11-05"`, `todayIn(LONDON, same)` is `"2026-11-04"`.
  - `britishWinterDate("2026-12-31")` is `"2026-12-31"`; from `"2027-06-01"` is `"2027-11-01"`; from `"2027-01-27"` is `"2027-01-27"`, from `"2027-03-28"` is `"2027-11-01"`.
  - `wallTimeInstants("2026-11-05", "10:10", LONDON)` throws `RangeError`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/time.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.4/task-1-red.txt`
Expected: FAIL, cannot resolve `./time.ts`.

- [ ] **Step 3: Implement** in `e2e/time.ts`. One cached `Intl.DateTimeFormat("en-CA", { timeZone, year, month, day, hour, minute, hourCycle: "h23" })` per zone for `dateIn`/`timeIn`; `zoneName` with `en-GB`, `timeZoneName: "short"`. `dayRange`: walk quarter hours from `Date.UTC(date) - 15 h` to the first instant whose `dateIn` is `date`, same for `addDays(date, 1)` (every offset is a multiple of 15 minutes, ADR-002 Decision 6). `addDays` and the last Sunday of a month are calendar arithmetic on `Date.UTC` and `getUTCDay`, never local getters.

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test e2e/time.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.4/task-1-green.txt`
Expected: all pass.

- [ ] **Step 5: Commit** `e2e/time.ts`, `e2e/time.spec.ts`, the evidence: `e2e: time.ts dates, ranges and clock-change days (integration.4)`.

### Task 2: e2e/time.ts strings (ADR-002 Decision 7)

**Files:**
- Modify: `e2e/time.ts`
- Modify: `e2e/time.spec.ts`

**Interfaces:**
- Consumes: Task 1's functions.
- Produces:
  - `formatTime(at: Instant, zone: string): string` (`17:00`)
  - `formatDate(date: IsoDate): string` (`Thu 5 Nov`)
  - `timeLabel(at: Instant, zone: string, lineDate: IsoDate): string`: `[{formatDate(own date)} ]HH:mm[ {zoneName}]`, the date when `dateIn(at, zone) !== lineDate`, the zone name when the wall time occurs twice on its date
  - `rangeLabel(start: Instant, end: Instant, zone: string, lineDate: IsoDate): string`: `{timeLabel(start)} to {timeLabel(end)}`
  - `type RoomZone = { timeZone: string; office: string }`
  - `bookingTimes(start: Instant, end: Instant, userZone: string, lineDate: IsoDate, room: RoomZone): string`: `rangeLabel(user)`, then ` ({rangeLabel(room.timeZone)} in {office})` when `room.timeZone !== userZone`
  - `homeLine(start: Instant, end: Instant, zone: string): string`: `{formatDate(dateIn(start))}  {rangeLabel(start, end, zone, dateIn(start))}` (two spaces)

- [ ] **Step 1: Write the failing tests** in `e2e/time.spec.ts`:
  - `formatDate("2026-11-05")` is `"Thu 5 Nov"`; `formatTime("2026-11-05T09:05:00.000Z", LONDON)` is `"09:05"`; `formatTime("2026-11-05T13:00:00.000Z", JAKARTA)` is `"20:00"`.
  - The London booking 16:00 to 19:00 on 5 November 2026 (`wallTimeInstants` of `16:00` and `19:00`): `rangeLabel(start, end, JAKARTA, "2026-11-05")` is `"23:00 to Fri 6 Nov 02:00"`.
  - `timeLabel("2027-10-31T00:30:00.000Z", LONDON, "2027-10-31")` is `"01:30 BST"`, and `...01:30:00.000Z` gives `"01:30 GMT"`; `rangeLabel` of those two is `"01:30 BST to 01:30 GMT"`.
  - `bookingTimes("2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z", LONDON, "2026-11-05", { timeZone: JAKARTA, office: "Jakarta" })` is `"02:00 to 03:00 (09:00 to 10:00 in Jakarta)"`; with `{ timeZone: LONDON, office: "London" }` it is `"02:00 to 03:00"`.
  - `homeLine` of ayu's Thames 10:00 to 11:00 London on 2026-11-05, in JAKARTA, is `"Thu 5 Nov  17:00 to 18:00"`; budi's Merapi 09:00 to 10:00 Jakarta on 2026-11-05, in LONDON, is `"Thu 5 Nov  02:00 to 03:00"`; the 16:00 to 19:00 London booking in JAKARTA is `"Thu 5 Nov  23:00 to Fri 6 Nov 02:00"`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/time.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.4/task-2-red.txt`
Expected: FAIL, the new functions are not exported (`formatDate is not a function` or a missing-export error).

- [ ] **Step 3: Implement** the six functions. `formatDate` uses `Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })` on `Date.UTC` of the date; the repeat test is `wallTimeInstants(dateIn(at), timeIn(at), zone).length === 2`.

- [ ] **Step 4: Run to verify it passes** (same command, `task-2-green.txt`). Expected: all pass.

- [ ] **Step 5: Commit** `e2e: time.ts strings of ADR-002 Decision 7 (integration.4)`.

### Task 3: Home shows the user's zone; AC-2.5 times; AC-1.1 without 3 seconds

**Files:**
- Modify: `e2e/home.spec.ts` (AC-2.1 gains the zone; new AC-2.5 tests; header comment with the day table; a `lines(page)` helper)
- Modify: `e2e/login.spec.ts` (AC-1.1)

**Interfaces:**
- Consumes: `homeLine`, `wallTimeInstants`, `britishWinterDate`, `todayIn`, `addDays`, `LONDON`, `JAKARTA` (Task 1, 2); `tokenFor`, `postBooking`, `type Booking` (e2e/api.ts); `profileFixture`, `signIn`, `signOut` (e2e/fixtures.ts).
- Produces (inside home.spec.ts): `const normalize = (s: string) => s.replace(/\s+/g, " ").trim()`; `async function homeText(page): Promise<string>` (the normalized `innerText` of `body`); `function winterDay(n: number): IsoDate` (the n-th date from `britishWinterDate(addDays(todayIn(LONDON), 60))` such that every date returned is distinct and wholly GMT, computed once at module load); `book(who, roomId, date, zone, from, to, title): Promise<Booking>` using `wallTimeInstants(date, from, zone)[0]`.

Day table (header comment): AC-2.5 ayu Thames `winterDay(0)`; AC-2.5 budi Merapi `winterDay(1)`; AC-6.1 Kew `winterDay(2)` and `winterDay(3)`; AC-6.2 Bromo `winterDay(4)`; Success in the browser Kew `winterDay(5)`.

- [ ] **Step 1: Write the failing tests.**
  - AC-2.1 (shipped test) also expects `getByText("Time zone")` visible and `getByText(exactly(AYU.timeZone))` visible.
  - `AC-2.5: each account's Home shows its zone as its name`: ayu sees `exactly(AYU.timeZone)` (`Asia/Jakarta`), budi `exactly(BUDI.timeZone)` (`Europe/London`), both values read from the `me-ayu`/`me-budi` fixtures.
  - `AC-2.5: ayu's Thames booking shows in Jakarta time`: book Thames 10:00 to 11:00 LONDON on `winterDay(0)`, title `Home zone ayu`; expected = `homeLine(start, end, JAKARTA)`, which contains `17:00 to 18:00`; `homeText(page)` contains `normalize(expected + " Thames · Home zone ayu")`.
  - `AC-2.5: budi's Merapi booking shows in London time`: Merapi 09:00 to 10:00 JAKARTA on `winterDay(1)`, title `Home zone budi`; expected contains `02:00 to 03:00`; same check with `Merapi · Home zone budi`.
  - login.spec.ts AC-1.1 is renamed `AC-1.1: the right password reaches Home` and drops `started` and the `toBeLessThan(3000)`.

- [ ] **Step 2: Record the reds (named mutants, never committed):**
  - Mutant A, "profile zone swapped to the browser's": `page.route("**/api/me", ...)` fulfils the real response with `timeZone: "Asia/Kolkata"`. Run: `npx playwright test e2e/home.spec.ts -g "AC-2" 2>&1 | tee .../task-3-red-zone-mutant.txt`. Expected: AC-2.1 and both AC-2.5 zone tests FAIL on the zone name; both AC-2.5 booking tests FAIL on the line (times shown in Asia/Kolkata).
  - Mutant B, "slow sign-in": `page.route("**/api/login", ...)` waits 3.5 s before `route.continue()`. Run the shipped AC-1.1 under it: FAIL on `toBeLessThan(3000)` (`task-3-red-slow-signin.txt`); the new AC-1.1 under it: PASS.
  - The mutant diffs go at the top of each evidence file.

- [ ] **Step 3: Implement**: no product code; the tests are the deliverable. Remove the mutants (`git diff` shows only the intended test changes).

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test e2e/home.spec.ts e2e/login.spec.ts 2>&1 | tee .../task-3-green.txt`. Expected: all pass.

- [ ] **Step 5: Commit** `e2e: Home shows the user's zone and times in it; AC-1.1 drops 3 seconds (integration.4)`.

### Task 4: My bookings: order, empty state, Cancel (AC-6.1, AC-6.2)

**Files:**
- Modify: `e2e/home.spec.ts`

**Interfaces:**
- Consumes: Task 3's helpers; `getMyBookings`, `deleteBooking` (e2e/api.ts).
- Produces: `cancelButton(page, line: string): Locator`: among `page.locator("*").filter({ hasText: line }).filter({ has: page.getByRole("button", { name: "Cancel" }) })`, the last (deepest) element's `Cancel` button; the test asserts it resolves to one button.

- [ ] **Step 1: Write the failing tests.**
  - `AC-6.1: budi's bookings show soonest first, each with Cancel, and none of ayu's`: post, out of order, Kew `winterDay(3)` 09:00 to 10:00 (`Order 3`), Kew `winterDay(2)` 14:00 to 15:00 (`Order 2`), Kew `winterDay(2)` 09:00 to 10:00 (`Order 1`), all LONDON wall times; ayu books Kew `winterDay(3)` 11:00 to 12:00 (`Ayu not budi`). Signed in as budi: each `homeLine(...) + " Kew · Order n"` appears in `homeText`, at increasing positions for n = 1, 2, 3; `cancelButton(page, homeLine(Order n))` has count 1 for each; `homeText` does not contain `Ayu not budi`.
  - `AC-6.1: with every booking cancelled, Home shows (no bookings) under My bookings`: as budi, `getMyBookings`, `deleteBooking` each (expect 204, message names the booking); `page.goto("/")`, sign in; `homeText` has `My bookings` before `(no bookings)`.
  - `AC-6.2: Cancel removes the booking at once and frees its range`: budi books Bromo `winterDay(4)` 09:00 to 10:00 (`Cancel me`) and 11:00 to 12:00 (`Keep me`); signed in, press `cancelButton(page, line(Cancel me))`; without a reload, `getByText(normalize(line(Cancel me)))` count 0 and `Bromo · Cancel me` count 0, `Keep me`'s line visible; ayu `postBooking` Bromo same range: status 201.

- [ ] **Step 2: Record the reds (named mutants, never committed):**
  - Mutant C, "my bookings reversed": `page.route("**/api/me/bookings")` reverses the real list. AC-6.1 order FAILS if the web app renders the order it receives; if it sorts itself the run passes, and that is recorded as the web app's own ordering (then Mutant C2: drop the first booking from the list, which FAILS the presence check).
  - Mutant D, "a stray booking": the route appends ayu's booking to budi's list: the "none of ayu's" check FAILS; with the empty-state test, the route answers `{ "bookings": [<one fake>] }`: `(no bookings)` FAILS.
  - Mutant E, "cancel refused": `page.route("**/api/bookings/*")` for DELETE fulfils 422 `BOOKING_STARTED` without reaching the service: AC-6.2 FAILS (the line stays, and ayu's booking gets 409).
  - Each to `task-4-red-<mutant>.txt` with its diff.

- [ ] **Step 3: Implement**: the tests are the deliverable; mutants removed.

- [ ] **Step 4: Run to verify it passes**: `npx playwright test e2e/home.spec.ts 2>&1 | tee .../task-4-green.txt`. Expected: all pass.

- [ ] **Step 5: Commit** `e2e: my bookings on Home, the empty state and Cancel (integration.4)`.

### Task 5: PRD v2 Success in the browser; the gate from a clean install

**Files:**
- Modify: `e2e/home.spec.ts`

**Interfaces:**
- Consumes: `backend.restart()` (e2e/fixtures.ts), Task 3's helpers.

- [ ] **Step 1: Write the failing test** `Success: after a restart, Login says the session expired and Home still lists the booking`: budi books Kew `winterDay(5)` 09:00 to 10:00 LONDON (`Survives restart`); signs in; line visible; `backend.restart()`; `page.reload()`; `Your session has expired. Please sign in again.` visible and `Sign in` button visible; `signIn` as budi; the same line and `Kew · Survives restart` visible.

- [ ] **Step 2: Record the red** with Mutant F, "bookings lost at restart": after the restart, `page.route("**/api/me/bookings")` answers `{ "bookings": [] }`. Expected: FAIL on the line after signing in again (`task-5-red-lost-at-restart.txt`).

- [ ] **Step 3: Implement**: the test is the deliverable; mutant removed.

- [ ] **Step 4: Run to verify it passes**: `npx playwright test e2e/home.spec.ts` (`task-5-green.txt`).

- [ ] **Step 5: Gate from a clean install (constraint 4).** `rm -rf node_modules backend/node_modules web/node_modules && npm run install:all 2>&1 | tee .../install.txt && npm test 2>&1 | tee .../gate-run.txt`. Expected: exit 0; backend gate 299, replay 46, web gate 387, scripts 3, browser 49 + the new tests (time.spec, AC-2.5 x3, AC-6.1 x2, AC-6.2, Success); nothing left on ports 3000 and 5173.

- [ ] **Step 6: Commit** `e2e: Home after a restart; gate from a clean install (integration.4)`.

### Task 6: Browser checks and the verification doc

**Files:**
- Create: `docs/superpowers/evidence/simple-login.integration.4/browser-check.mjs` (+ its `.out.json` and PNGs)
- Create: `hsdd/verify/simple-login.integration.4.verification.md`

- [ ] **Step 1: Browser checks in `npm run dev`** (dev database `meeting_rooms`; the script books for budi through the service, cleans up its own bookings, and stops nothing it did not start):
  - Phase Verification: budi's Home shows `Europe/London` and his bookings soonest first in London time; `Cancel` removes one at once; the My bookings text is identical with the browser in `Asia/Kolkata`, `America/New_York` and `Pacific/Auckland`.
  - Deferred from web.7: at 360 px, no horizontal scroll and each `Cancel` inside the viewport (screenshot); the `Cancel` button's width and its row's position unchanged while it reads `Cancelling…` (DELETE delayed by a route); a refused Cancel (booking already cancelled through the API) shows a notice in an element with role `alert`, and where focus lands after it.
  - Deferred from integration.3: ayu signs in on the Login screen of `npm run dev` and Home shows her profile.
  - Stop `npm run dev`; check ports 3000 and 5173 are free.
- [ ] **Step 2: Write the verification doc** from hsdd/templates/verification.md at spot-check depth: Commands, Expected, Observed (dated, gate counts before and after, the reds by mutant, the browser checks), Outstanding, Learnings (dispositioned or `- none`), Metrics; Sign-off left as the template has it.
- [ ] **Step 3: Commit** `verify: simple-login.integration.4 verification doc and browser checks`.
