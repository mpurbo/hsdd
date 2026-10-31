# simple-login.web.8: Rooms on a date, moving between screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Rooms screen without its booking form (every room and its bookings on a date in the user's zone) and the app's moves between Home and Rooms (D4).

**Architecture:** A pure view function turns booking-api@v1 rooms into the lines Rooms shows, using only the time module (`formatRange`, `sameZone`, `asTimeZone`). `RoomsScreen` is a thin shell: it reads the browser's clock once, fetches with `dayRange`, and renders the view. The flow (pure reducer) gains which signed-in screen shows; `App` maps it to Home or Rooms and ties every `session-expired` to the token of the session that rendered the screen, so a late 401 can never clear a newer session.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 5 with jsdom and Testing Library; Node.js 24; `fetch` stubbed with the contract fixtures (`web/src/test/fetchStub.ts`).

**Spec:** `hsdd-context/superpowers/simple-login.web.8.md` (phase context `hsdd-context/simple-login.web.8.md`, spec 25ed989).

All commands run from the repository root. Per-file test runs: `npm --prefix web test -- <path>` (the script sets `TZ=Asia/Kolkata`).

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
5. The last task writes hsdd/verify/simple-login.web.8.verification.md from
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

Project rules every task also keeps (from the phase context):

- D6: no time conversion outside `web/src/time/`; no `Date` local getters; no parsing a date-time without `Z`. Rooms reads the clock only as `new Date().toISOString()`, once, when it mounts (ADR-002 Decision 5).
- D8: `fetchRooms(token, range.start, range.end)` already writes the query unencoded; use it as is.
- G13 / G18: rooms and their bookings are shown in the order received, never sorted; nothing reads `error.message`.
- Copy is exact: `Rooms on`, `Home`, `Book a room`, `Loading…`, `(no bookings)` (`MESSAGES.noBookings`), D3's `Could not reach the server. Please try again.` (`MESSAGES.unavailable`). Room line `{name} · {office} · {seats} seats`; booking line `{start} to {end}  {title}` (two spaces); local line `({start} to {end} in {office})`.
- No file this phase writes contains an em dash (U+2014); use a hyphen or rewrite the sentence.

## Design rationale (full-review)

1. **Pure view, thin screen.** `roomViews` is a pure function of `(rooms, date, zone)`; every Verification string is pinned there without React. The screen only owns the date, the request and the four list states.
2. **The line's date is the picked date** for both the user's line and the room's local line (Scope: "with the same line's date"), so `formatRange` adds a date only to a time that falls on another date in the zone it is shown in.
3. **A room zone `Intl` refuses gets no local line** (`asTimeZone` returns `undefined`). The contract promises an IANA name; this guard only keeps a bad answer from throwing during render, as D7 does for the user's zone.
4. **A date the time module refuses sends nothing.** `<input type="date">` reports `''` while a field is cleared or half typed, and a year below 0100 (`0002-10-31` while typing `2027`) makes `dayRange` throw `RangeError`. Rooms catches it, sends no request and shows no list until the input holds a date `dayRange` accepts. No new message: the contract and D3/D10 name none.
5. **Latest date wins.** Each request belongs to the effect run for its date; the effect's cleanup marks it stale, so an answer for an earlier date, or one arriving after Rooms unmounts, changes nothing and never calls `onSessionExpired`.
6. **The flow holds the screen; storage holds only the session (D2, D4).** `signed-in` gains `screen: 'home' | 'rooms'`; `profile-loaded` always lands on `'home'`, so sign-in, the load check and a reload show Home.
7. **Expiry is tied to a token** (the web.7 sign-off's open item). `session-expired` carries the token whose request answered 401. The reducer ignores it unless that token is the signed-in session's, and App removes the stored session only when the stored token is that token. App binds `onSessionExpired` to the token of the session it renders, so a screen left over from an earlier session can only ever report the earlier token. The two guards keep different halves: the compare-and-clear keeps a newer sign-in's stored session, the reducer's token check keeps it on screen, so both are needed; the screens' own drop-after-unmount guard is a third. (Corrected after the Task 5 review; this item first said either guard alone was enough.)
8. **Rooms is reachable only with a usable zone.** Home offers `Book a room` only with a zone (D7), and App renders Rooms only when `asTimeZone` accepted the profile's zone; otherwise a `rooms` screen renders Home.

## Review Focus

1. A date input cleared or half typed (`''`, `0002-10-31`): no request, no crash, no stale list under the new date. Task 3 pins it.
2. Two date changes whose answers arrive out of order: the list is the newest date's answer. Task 3 pins it.
3. A 401 from Rooms that arrives after the user went Home, signed out and signed in again: the newer session stays stored and on screen. Tasks 1 and 5 pin it.
4. A room whose `timeZone` `Intl` refuses: its bookings still show, without a local line. Task 2 pins it.
5. A profile without a usable zone: no `Book a room`, so Rooms cannot open without a zone. Tasks 4 and 5 pin it.

---

### Task 1: The flow knows the screen; expiry names its token

**Files:**
- Modify: `web/src/session/flow.ts`
- Test: `web/src/session/flow.test.ts`

**Interfaces:**
- Produces:
  - `export type Screen = 'home' | 'rooms'`
  - `AppState` signed-in member: `{ readonly kind: 'signed-in'; readonly session: Session; readonly profile: Profile; readonly screen: Screen }`
  - `AppEvent` gains `{ readonly type: 'show-rooms' }` and `{ readonly type: 'show-home' }`; `session-expired` becomes `{ readonly type: 'session-expired'; readonly token: string }`.

- [ ] **Step 1: Write the failing tests.** In `flow.test.ts`, `signedIn` becomes `{ kind: 'signed-in', session, profile, screen: 'home' }` and add `onRooms: AppState = { ...signedIn, screen: 'rooms' }`. Transition table additions (existing rows keep their names; the existing `session-expired` row sends `{ type: 'session-expired', token: session.token }`):
  - `'a loaded profile shows Home'`: `checking` + `profile-loaded` → `signedIn` (with `screen: 'home'`).
  - `'Book a room shows Rooms (D4)'`: `signedIn` + `show-rooms` → `onRooms`.
  - `'Home on Rooms shows Home (D4)'`: `onRooms` + `show-home` → `signedIn`.
  - `'a 401 on Rooms shows Login with the expiry notice (D1)'`: `onRooms` + `{ type: 'session-expired', token: session.token }` → `{ kind: 'signed-out', notice: 'session-expired' }`.
  Ignored-event additions (`toBe(from)`):
  - `'an expiry for another session's token'`: `signedIn` + `{ type: 'session-expired', token: 'another-token' }`, and the same on `onRooms`.
  - `'Book a room while signed out'`: `signedOut` + `show-rooms`; `'Home while checking'`: `checking` + `show-home`.
  - The two existing stale-expiry rows send a token.
- [ ] **Step 2: Run** `npm --prefix web test -- src/session/flow.test.ts`. Expected: FAIL (type errors aside, vitest runs: the `screen` rows and the token rows fail). Record the output.
- [ ] **Step 3: Implement** in `flow.ts`: `profile-loaded` → `{ kind: 'signed-in', session, profile, screen: 'home' }`; in `signed-in`, `show-rooms` / `show-home` set `screen`; `session-expired` applies only when `event.token === state.session.token`. Update the header comment: the screen is held in memory only (D4).
- [ ] **Step 4: Run** `npm --prefix web test -- src/session/flow.test.ts`. Expected: PASS. `npm --prefix web run typecheck` reports errors in `App.tsx` until Task 5 (the event shape); that is expected. Record both.
- [ ] **Step 5: Commit** `web.8: the flow holds Home or Rooms; an expiry names its token (D1, D4)`.

### Task 2: Rooms' lines (pure)

**Files:**
- Create: `web/src/rooms/roomViews.ts`
- Test: `web/src/rooms/roomViews.test.ts`

**Interfaces:**
- Consumes: `Room` from `../api/types`; `formatRange`, `sameZone`, `asTimeZone`, `IsoDate`, `ZoneName` from `../time/time`.
- Produces:
  ```ts
  export interface RoomBookingView { readonly id: string; readonly line: string; readonly local: string | undefined }
  export interface RoomView { readonly id: string; readonly heading: string; readonly bookings: readonly RoomBookingView[] }
  export function roomViews(rooms: readonly Room[], date: IsoDate, zone: ZoneName): readonly RoomView[]
  ```

- [ ] **Step 1: Write the failing tests.** Helper `flat(views)` = for each view, `heading`, then `'(no bookings)'` when it has none, else each booking's `line` followed by its `local` when defined. Rooms come from `loadFixture('booking-api', name).response.body.rooms`.
  - `'shows rooms-on-a-date for a London user (AC-4.1, AC-4.3)'`: `('2026-11-05', 'Europe/London')` → `['Merapi · Jakarta · 8 seats', '02:00 to 03:00  Sprint planning', '(09:00 to 10:00 in Jakarta)', 'Bromo · Jakarta · 4 seats', '(no bookings)', 'Thames · London · 10 seats', '10:00 to 11:00  Design review', 'Kew · London · 4 seats', '(no bookings)']`.
  - `'shows rooms-range-edges for a Jakarta user (ADR-002 Decision 7)'`: `('2026-11-05', 'Asia/Jakarta')` → `['Merapi · Jakarta · 8 seats', '06:00 to 07:00  Planning', '08:00 to 08:30  Standup', 'Bromo · Jakarta · 4 seats', '23:45 to Fri 6 Nov 00:15  Wrap-up', 'Thames · London · 10 seats', '(no bookings)', 'Kew · London · 4 seats', 'Wed 4 Nov 23:30 to 00:30  Handover', '(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)']`.
  - `'shows rooms-on-a-clock-change-day for a London user (AC-4.4)'`: `('2027-10-31', 'Europe/London')` → `['Merapi · Jakarta · 8 seats', '(no bookings)', 'Bromo · Jakarta · 4 seats', '(no bookings)', 'Thames · London · 10 seats', '00:00 to 01:30 BST  Midnight launch', '01:00 GMT to 01:30 GMT  After the change', '23:30 to Mon 1 Nov 00:00  Last slot', 'Kew · London · 4 seats', '(no bookings)']`.
  - `'adds the local line for the other office in either direction'`: rooms-on-a-date with `('2026-11-05', 'Asia/Jakarta')` → Merapi `'09:00 to 10:00  Sprint planning'` with no local line; Thames `'17:00 to 18:00  Design review'` then `'(10:00 to 11:00 in London)'`.
  - `'keeps the order received, rooms and bookings (G13)'`: the rooms-range-edges rooms reversed, and Merapi's two bookings reversed → headings and Merapi's lines come out in the reversed order.
  - `'a room zone Intl refuses: no local line, no throw (Review Focus 4)'`: rooms-on-a-date with Merapi's `timeZone: 'Mars/Olympus'`, London user → Merapi's booking has `local: undefined`, line `'02:00 to 03:00  Sprint planning'`.
  - `'keeps the title exactly as received'`: a booking titled `'  Two  spaces '` → line ends with `'  ' + '  Two  spaces '`.
  - Each booking view's `id` is the booking's `id`; each room view's `id` is the room's `id`.
- [ ] **Step 2: Run** `npm --prefix web test -- src/rooms/roomViews.test.ts`. Expected: FAIL, `Failed to resolve import "./roomViews"`. Record it.
- [ ] **Step 3: Implement `roomViews`.** `heading = \`${name} · ${office} · ${seats} seats\``; `line = \`${formatRange(start, end, zone, date)}  ${title}\``; `local` is `undefined` when `sameZone(room.timeZone, zone)` or `asTimeZone(room.timeZone) === undefined`, else `\`(${formatRange(start, end, room.timeZone, date)} in ${office})\``. Validate the room zone once per room.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `web.8: Rooms' lines in the user's zone and the office's (AC-4.1, AC-4.3, AC-4.4)`.

### Task 3: The Rooms screen

**Files:**
- Create: `web/src/rooms/RoomsScreen.tsx`, `web/src/rooms/RoomsScreen.css`
- Test: `web/src/rooms/RoomsScreen.test.tsx`

**Interfaces:**
- Consumes: `roomViews` (Task 2); `fetchRooms(token, from, to): Promise<Result<readonly Room[], RoomsFailure>>`; `todayIn`, `dayRange`, `ZoneName`; `MESSAGES`.
- Produces:
  ```ts
  export interface RoomsScreenProps {
    readonly token: string
    readonly zone: ZoneName
    readonly onHome: () => void
    readonly onSessionExpired: () => void
  }
  export function RoomsScreen(props: RoomsScreenProps): JSX.Element
  ```
  DOM the tests and Task 5 rely on: `<main className="rooms">`; an `<h1>` whose accessible name is `Rooms on`, holding a `<label>` for the `<input type="date">` (so `getByLabelText('Rooms on')` finds the input); a `Home` button; the list as `<ul className="rooms-list">` where each room is an `<li>` whose lines are `<p>` elements in display order (room line; then `(no bookings)` or, per booking, its line and its local line when defined). `Loading…` and the D3 message are a `<p>` in place of the list, the D3 one with `role="status"`.

- [ ] **Step 1: Write the failing tests.** Clock: `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(new Date(...))` (setup.ts restores real timers). Helper `shown = () => Array.from(document.querySelectorAll('.rooms-list p'), (p) => p.textContent)`. Calls via `stubFetch(...).calls`.
  - `'opens on today in the user zone and shows rooms-on-a-date (AC-4.1, AC-4.2, AC-4.3)'`: clock `2026-11-05T09:30:00.000Z`, zone `Europe/London`, stub `rooms-on-a-date`. The input's value is `'2026-11-05'`; the one call is `GET /api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z` with `authorization: Bearer {TOKEN}`; `shown()` equals Task 2's first list.
  - `'opens on the Jakarta date and shows rooms-range-edges'`: clock `2026-11-04T18:00:00.000Z`, zone `Asia/Jakarta`, stub `rooms-range-edges` → value `'2026-11-05'`, `shown()` equals Task 2's second list.
  - `'picking 2027-10-31 fetches the clock-change day (AC-4.4)'`: London as in the first test, stub `rooms-on-a-date` and `rooms-on-a-clock-change-day`; after the first list shows, `fireEvent.change(input, { target: { value: '2027-10-31' } })`. The second call's path is `/api/rooms?from=2027-10-30T23:00:00.000Z&to=2027-11-01T00:00:00.000Z`; `shown()` equals Task 2's third list.
  - `'reads Loading… while the request is in flight'`: `stubFetchHanging()` → `Loading…` shows and no `.rooms-list`.
  - `'rooms-no-token: a 401 calls onSessionExpired (D1)'`: London clock, stub `rooms-no-token` → `onSessionExpired` called once.
  - `'unavailable: D3 message in place of the list, the date kept'`: London clock, `stubFetchUnreachable()` → `role="status"` reads `Could not reach the server. Please try again.`, no `.rooms-list`, the input still `'2026-11-05'`.
  - `'Home calls onHome'`.
  - `'a cleared or half-typed date sends nothing and shows no list (Review Focus 1)'`: after the first list, change to `''`, then to `'0002-10-31'`: no new call, no `.rooms-list`, no `Loading…`, no throw; then `'2026-11-05'` again sends a second call to the first path and the list returns.
  - `'shows the newest date when answers arrive out of order (Review Focus 2)'`: a deferred fetch (every call waits until the test answers it; write the helper locally, as `MyBookings.test.tsx` does); change the date to `2027-10-31` while the first call waits; answer call 1 (`2027-10-31`) with the clock-change body, then call 0 with rooms-on-a-date's body → `shown()` is the clock-change list.
  - `'drops an answer that arrives after unmount, a 401 included'`: deferred fetch, `unmount()`, answer 401 `UNAUTHORIZED` → `onSessionExpired` not called.
- [ ] **Step 2: Run** `npm --prefix web test -- src/rooms/RoomsScreen.test.tsx`. Expected: FAIL, `Failed to resolve import "./RoomsScreen"`. Record it.
- [ ] **Step 3: Implement `RoomsScreen`.** `const [date, setDate] = useState(() => todayIn(new Date().toISOString(), zone))`. One effect on `[token, zone, date]`: `dayRange(date, zone)` inside `try`; a `RangeError` means no request and the list state `none`; otherwise state `loading`, then `fetchRooms`; the effect cleanup marks the run stale, and a stale run sets no state and calls nothing. List state: `none | loading | loaded(rooms) | unavailable`; `unauthorized` calls `onSessionExpired` (read through a ref written in a layout effect, as MyBookings does, so a new callback identity never refetches). Render `roomViews(rooms, date, zone)`. Import `./RoomsScreen.css`.
  `RoomsScreen.css`: its own classes only (`.rooms`, `.rooms-card`, `.rooms-header`, `.rooms-list`, …), in Home's visual language. Each line is a block; booking and local lines `white-space: pre-wrap` (the two spaces and the title as received) and `overflow-wrap: anywhere`; the header (heading, input, Home) wraps at narrow widths; nothing scrolls sideways at 360 px.
- [ ] **Step 4: Run** the same command. Expected: PASS, no `act()` warning. Record it.
- [ ] **Step 5: Commit** `web.8: the Rooms screen on a date (AC-4.1 to AC-4.4, D1, D3, D8)`.

### Task 4: Home offers Book a room

**Files:**
- Modify: `web/src/home/HomeScreen.tsx`, `web/src/home/HomeScreen.css`
- Test: `web/src/home/HomeScreen.test.tsx`

**Interfaces:**
- Produces: `HomeScreenProps` gains `readonly onBookRoom: () => void`.

- [ ] **Step 1: Write the failing tests.** `renderHome` passes `onBookRoom` (default `vi.fn()`, overridable).
  - `'Book a room sits beside Sign out and calls its parent (D4)'`: with `me-budi`, the buttons in document order end with `['Book a room', 'Sign out']`; clicking `Book a room` calls `onBookRoom` once.
  - Extend `'without a zone (D7): …'`: `queryByRole('button', { name: 'Book a room' })` is null.
- [ ] **Step 2: Run** `npm --prefix web test -- src/home/HomeScreen.test.tsx`. Expected: FAIL (`Unable to find role="button" and name "Book a room"`). Record it.
- [ ] **Step 3: Implement.** The two buttons in one row (`.home-actions`), `Book a room` first and only when `zone !== undefined`; update the component comment (D7's line takes the place of My bookings and Book a room).
- [ ] **Step 4: Run** the same command. Expected: PASS. `App.tsx` does not pass `onBookRoom` until Task 5, so `typecheck` still reports it.
- [ ] **Step 5: Commit** `web.8: Home offers Book a room with a usable zone (D4, D7)`.

### Task 5: App moves between Home and Rooms

**Files:**
- Modify: `web/src/App.tsx`
- Test: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1's states and events, Task 3's `RoomsScreen`, Task 4's `onBookRoom`, `loadSession` / `clearSession`.

- [ ] **Step 1: Write the failing tests** (Date-only fake timers as in Task 3; clock `2026-11-05T09:30:00.000Z` unless stated).
  - `'walks Login, Home, Book a room, Rooms, Home, Sign out, Login (D4)'`: stub `login-success`, `me-budi`, `my-bookings-none`, `rooms-on-a-date`; sign in as `budi` / `harbor-17`; `Hello, Budi Santoso`; click `Book a room` → heading `Rooms on`, input `'2026-11-05'`, the first room line `Merapi · Jakarta · 8 seats` shown; click `Home` → `Hello, Budi Santoso` and `(no bookings)`; `Sign out` → `Sign in`, nothing stored. Calls: `['POST /api/login', 'GET /api/me', 'GET /api/me/bookings', 'GET /api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z', 'GET /api/me/bookings']`.
  - `'a reload on Rooms shows Home (D2, D4)'`: stored session, `me-budi`, `my-bookings-none`, `rooms-on-a-date`; Book a room; Rooms shows; `unmount()`; render again → `Hello, Budi Santoso`, no `Rooms on` heading.
  - `'rooms-no-token: a 401 on Rooms lands on Login with the expiry message, nothing stored (D1)'`: stored session, `me-budi`, `my-bookings-none`, `rooms-no-token`; Book a room → `role="status"` reads `Your session has expired. Please sign in again.`, heading `Sign in`, storage empty.
  - `'a late 401 from Rooms cannot clear a newer session (D1, Review Focus 3)'`: stored session for `TOKEN`; fixtures `me-budi`, `my-bookings-none`, and `login-success` answering with token `NEWER = 'Zr4kP0aW8nE2xT6mQ1vB9cY3hL7dJ5sF0gU2iO4kN8q'`; every `GET /api/rooms…` call is held until the test answers it (wrap the installed stub). Book a room → Home → Sign out → sign in → `Hello, Budi Santoso`. Answer the held call with 401 `UNAUTHORIZED` inside `act`. Then: still `Hello, Budi Santoso`, no status message, stored session's token is `NEWER`.
  - `'Rooms opens on today each time it shows (D4)'`: stored session, `me-budi`, `my-bookings-none`, `rooms-on-a-date`, `rooms-on-a-clock-change-day`; Book a room; change the date to `2027-10-31`; Home; Book a room → the input is `'2026-11-05'` again.
  - `'without a usable zone, Book a room is not offered'`: `me-ayu` without `timeZone` → no `Book a room` button.
- [ ] **Step 2: Run** `npm --prefix web test -- src/App.test.tsx`. Expected: FAIL (no `Book a room`; and `tsc` errors from Task 1). Record it.
- [ ] **Step 3: Implement.** `signedInToken = state.kind === 'signed-in' ? state.session.token : null`; `onSessionExpired = useCallback(() => { if (signedInToken === null) return; if (loadSession()?.token === signedInToken) clearSession(); dispatch({ type: 'session-expired', token: signedInToken }) }, [signedInToken])`. In `signed-in`: compute the zone with `asTimeZone` once; `screen === 'rooms'` and a zone → `RoomsScreen` with `onHome` dispatching `show-home`; otherwise `HomeScreen` with `onBookRoom` dispatching `show-rooms`. Update the header comment (D4: Home or Rooms in memory; the expiry guard).
- [ ] **Step 4: Run** `npm --prefix web test -- src/App.test.tsx` and `npm --prefix web run typecheck`. Expected: PASS and no output from `tsc`.
- [ ] **Step 5: Named mutants for the expiry guard** (each applied alone, then restored; record the output): (a) RoomsScreen's stale check removed → the late-401 test still passes (App's guards hold); (b) (a) plus App's compare-and-clear made unconditional plus the reducer's token check removed → the late-401 test fails.
- [ ] **Step 6: Commit** `web.8: App moves between Home and Rooms; a late expiry cannot clear a newer session (D1, D2, D4)`.

### Task 6: The gate, the 360 px check, the verification doc

**Files:**
- Create: `hsdd/verify/simple-login.web.8.verification.md`, `docs/superpowers/evidence/simple-login.web.8/rooms-360.mjs` and its outputs in that directory.

- [ ] **Step 1: Gate from a clean install:** `rm -rf web/node_modules web/dist && npm --prefix web install && npm --prefix web run gate`. Expected: exit 0, `Test Files  15 passed (15)`. Keep the output and the per-file counts (`cd web && TZ=Asia/Kolkata npx vitest run --reporter=verbose`).
- [ ] **Step 2: The 360 px check.** `rooms-360.mjs` (Playwright from the root's `@playwright/test`, installed Chrome): build `web/`, serve `web/dist`, answer `/api/*` from the fixtures (`me-budi` + `rooms-on-a-date` at clock `2026-11-05T09:30:00.000Z`; `me-ayu` + `rooms-range-edges` at `2026-11-04T18:00:00.000Z`), viewport 360 px wide, open Rooms through `Book a room`, and assert: the page does not scroll sideways, and every `.rooms-list p` starts below the previous one ends. It writes a screenshot and a JSON of the measured boxes beside itself. Commit the script and its outputs.
- [ ] **Step 3: Write the verification doc** from `hsdd/templates/verification.md` at full-review depth: every section except `## Sign-off`, which stays as the template has it. Title separator a hyphen, not the template's em dash.
- [ ] **Step 4: Commit** `web.8: verification doc`.
