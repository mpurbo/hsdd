# simple-login.web.7 Home: Time Zone, My Bookings and Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home shows the user's time zone and their bookings that have not ended, in their zone, each with a Cancel button, and a 401 from any booking call signs the user out to Login with the expiry message.

**Architecture:** A pure line formatter (`home/bookingLines.ts`) turns a `Booking` into its two display lines through the time module. A `MyBookings` component is the shell around `fetchMyBookings` and `cancelBooking`. `HomeScreen` gains the Time zone row and shows `MyBookings`, or D7's line without a usable zone. `App` gives Home the token, the zone and `onSessionExpired`, which feeds a new pure flow event, `session-expired`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest with jsdom and Testing Library, fixtures from `hsdd/contract/fixture/`.

**Spec:** `hsdd-context/superpowers/simple-login.web.7.md` (its marked block equals `hsdd-context/simple-login.web.7.md`).

**Worktree:** every command runs in `<repo>`. Commit messages start `web.7: ` and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No file may contain the em dash character (U+2014), nor the one banned phrase each implementer's prompt names.

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
5. The last task writes hsdd/verify/simple-login.web.7.verification.md from
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
11. When writing Mermaid diagrams, use mermaid-pastel-style.

("The Contracts section below" in constraint 7 is the spec file's Contracts section: booking-api@v1 and profile-api@v2 consumed, auth-api@v1 and profile-api@v1 referenced.)

## Design notes

1. **The line's date is `todayIn(booking.start, zone)`.** web.6's `todayIn(now, zone)` is the time module's one function from an instant to the date it falls on in a zone; its name is about Rooms, its contract is general. D6 forbids any other conversion in `web/src`, so Home reuses it rather than adding one.
2. **The list on screen is always the last answer of `GET /api/me/bookings`.** The client never edits it: a 204 shows through the refetch, as the Scope says ("a 204 fetches the list again, so the booking leaves it"). The pressed Cancel stays busy (`Cancelling…`, disabled) until its DELETE and the refetch it triggers have settled, so a booking the backend already cancelled never offers Cancel again in between.
3. **Latest request wins; answers after unmount are dropped.** Each list fetch takes a sequence number and only the newest one's answer is applied. An `alive` ref, cleared on unmount, drops every later answer, `onSessionExpired` included: a stale 401 arriving after Sign out and a new sign-in must not clear the new stored session.
4. **The list effect depends on `token` only.** `onSessionExpired` is read through a ref updated on every render, so a parent passing a new callback identity never triggers a refetch.
5. **App validates the zone once.** App passes `zone = profile.timeZone === undefined ? undefined : asTimeZone(profile.timeZone)`. Home trusts it: `undefined` means D7 (row `Not available`, D7's line, no request). A name `Intl` accepts is the received string, so the row shows `timeZone` exactly as received.
6. **Cancel's notice.** Each Cancel press clears the notice. `started`, `not-found`, `not-yours` set D10's message above the list and refetch; `unavailable` sets D3's message above the list and does not refetch (the list stays); `unauthorized` calls `onSessionExpired`. A list fetch's `unavailable` replaces the list with D3's message; the notice is left as it is.
7. **Two spaces in `{date}  {start} to {end}`.** The line is one text node with two spaces and the CSS `white-space: pre-wrap`, so the gap shows. Tests compare `textContent`, never `getByText` with that string: Testing Library's default matcher collapses whitespace.
8. **Copy.** D7 and D10 sentences go into `messages.ts`; labels (`Time zone`, `My bookings`, `Cancel`, `Cancelling…`, `Loading…`) stay inline in JSX, as `Username` and `Sign out` do. Only the copy this phase shows is added; Book's copy is web.9's.
9. **First load reads `Loading…`** while the first list fetch is in flight (as App and web.8's Rooms do). A refetch keeps the old list on screen.
10. **Roles.** The notice above the list and the D3 line in place of the list are `role="status"`, as Login's notice is. Each booking is an `<li>` holding two `<p>`: the first is the date-and-range line, the second holds a `<span>` with `{roomName} · {title}` and the Cancel button.

## Review Focus

1. Two Cancels in flight whose list answers arrive out of order: the newest list request's answer is what shows (Task 4).
2. An answer arriving after Home has gone (Sign out while the list fetch is in flight): no state update and no `onSessionExpired` call (Task 3).
3. A profile whose `timeZone` `Intl` refuses (`Mars/Olympus`): Time zone reads `Not available`, D7's line shows, no bookings request is sent (Task 5).
4. A booking that crosses the user's midnight or lies in London's repeated hour: the line carries the end's own date or the zone's short name, from `formatRange` (Task 2).
5. A refusal whose `error.message` differs from the contract's text: the screen still shows D10's copy, chosen by `error.code` (Task 4).

---

### Task 1: The flow's `session-expired` event

**Files:**
- Modify: `web/src/session/flow.ts`
- Test: `web/src/session/flow.test.ts`

**Interfaces:**
- Produces: `AppEvent` gains `{ readonly type: 'session-expired' }`. `next(signedIn, { type: 'session-expired' })` returns `{ kind: 'signed-out', notice: 'session-expired' }`; in `checking` and `signed-out` it returns the state unchanged (`toBe`).

- [ ] **Step 1: Write the failing tests** in `flow.test.ts`: add to the transition table `['a 401 on a signed-in screen shows Login with the expiry notice (D1)', signedIn, { type: 'session-expired' }, { kind: 'signed-out', notice: 'session-expired' }]`; add to the ignored table `['a stale expiry while signed out', signedOut, { type: 'session-expired' }]` and `['an expiry while checking', checking, { type: 'session-expired' }]`.
- [ ] **Step 2: Run** `npm --prefix web test -- src/session/flow.test.ts`. Expected: the transition test FAILS (state returned unchanged); record the output.
- [ ] **Step 3: Implement** the event in `flow.ts`: add it to `AppEvent`; in the `signed-in` branch, `signed-out` gives `{ kind: 'signed-out' }` and `session-expired` gives `{ kind: 'signed-out', notice: 'session-expired' }`. Update the header comment: the screen is a function of the app state (D4).
- [ ] **Step 4: Run** `npm --prefix web test -- src/session/flow.test.ts` and `npm --prefix web run typecheck`. Expected: PASS, no type error.
- [ ] **Step 5: Commit** `web.7: the flow's session-expired event (D1)`.

### Task 2: Booking lines (pure)

**Files:**
- Create: `web/src/home/bookingLines.ts`
- Test: `web/src/home/bookingLines.test.ts`

**Interfaces:**
- Consumes: `Booking` from `../api/types`; `formatDate`, `formatRange`, `todayIn`, `type ZoneName` from `../time/time`.
- Produces: `export interface BookingLine { readonly id: string; readonly when: string; readonly what: string }` and `export function bookingLine(booking: Booking, zone: ZoneName): BookingLine`, where, with `date = todayIn(booking.start, zone)`, `when` is `` `${formatDate(date)}  ${formatRange(booking.start, booking.end, zone, date)}` `` (two spaces) and `what` is `` `${booking.roomName} · ${booking.title}` `` (the title exactly as received).

- [ ] **Step 1: Write the failing tests** in `bookingLines.test.ts`, with `const budi = (loadFixture('booking-api', 'my-bookings-budi').response.body as { bookings: Booking[] }).bookings` and a helper `at(start, end, title = 'T')` building a `Booking` with room `Thames`:
  - `budi.map((b) => bookingLine(b, 'Europe/London'))` equals, in order, `{ id: '00000000-0000-4000-8000-000000000013', when: 'Thu 5 Nov  09:00 to 10:00', what: 'Merapi · Ongoing sync' }`, `{ id: '…011', when: 'Thu 5 Nov  10:00 to 11:00', what: 'Thames · Design review' }`, `{ id: '…016', when: 'Thu 5 Nov  10:00 to 10:30', what: 'Kew · Quick check' }`, `{ id: '…015', when: 'Thu 12 Nov  10:00 to 11:00', what: 'Merapi · Next week' }` (write the ids in full).
  - The same bookings in `Asia/Jakarta`: `when` values `Thu 5 Nov  16:00 to 17:00`, `Thu 5 Nov  17:00 to 18:00`, `Thu 5 Nov  17:00 to 17:30`, `Thu 12 Nov  17:00 to 18:00` (the user's zone, never the room's: ADR-002 Decision 7).
  - Crossing the user's midnight: `at('2026-11-05T16:00:00.000Z', '2026-11-05T19:00:00.000Z')` in `Asia/Jakarta` gives `when` `Thu 5 Nov  23:00 to Fri 6 Nov 02:00`.
  - London's repeated hour: `at('2027-10-31T01:00:00.000Z', '2027-10-31T01:30:00.000Z')` gives `Sun 31 Oct  01:00 GMT to 01:30 GMT`; `at('2027-10-30T23:00:00.000Z', '2027-10-31T00:30:00.000Z')` gives `Sun 31 Oct  00:00 to 01:30 BST`.
  - The title as received: `at(…, '  Café ☕ sync  ').what` is `'Thames ·   Café ☕ sync  '`.
- [ ] **Step 2: Run** `npm --prefix web test -- src/home/bookingLines.test.ts`. Expected: FAIL, module not found; record it.
- [ ] **Step 3: Implement** `bookingLine` in `bookingLines.ts` (a header comment names ADR-002 Decision 7 and design note 1).
- [ ] **Step 4: Run** the same command. Expected: PASS. Also `npm --prefix web test -- src/time/time.test.ts` (the D6 guard) PASS.
- [ ] **Step 5: Commit** `web.7: booking lines in the user's zone (ADR-002 Decision 7)`.

### Task 3: My bookings, the list

**Files:**
- Create: `web/src/home/MyBookings.tsx`
- Modify: `web/src/messages.ts`, `web/src/home/HomeScreen.css`
- Test: `web/src/home/MyBookings.test.tsx`

**Interfaces:**
- Consumes: `fetchMyBookings(token): Promise<Result<readonly Booking[], MyBookingsFailure>>`; `bookingLine` (Task 2); `MESSAGES.unavailable`.
- Produces: `export interface MyBookingsProps { readonly token: string; readonly zone: ZoneName; readonly onSessionExpired: () => void }` and `export function MyBookings(props: MyBookingsProps)`, rendering `<section aria-labelledby=…>` with `<h2>My bookings</h2>`. `MESSAGES.noBookings = '(no bookings)'`.

- [ ] **Step 1: Write the failing tests** in `MyBookings.test.tsx` (`TOKEN` as in `App.test.tsx`; helper `lines()` returns, per `listitem`, `[firstP.textContent, secondP.querySelector('span').textContent]`):
  - `stubFetch(my-bookings-budi)`, zone `Europe/London`: `await` the four lines of Task 2's London case in order, and each `listitem` has one button named `Cancel`; `stub.calls` is one `GET /api/me/bookings` with `authorization: Bearer ${TOKEN}`.
  - `my-bookings-none`: the section shows `(no bookings)` and no `listitem`.
  - `stubFetchHanging()`: the section shows `Loading…`.
  - `stubFetchUnreachable()`: the section shows `Could not reach the server. Please try again.`, no `listitem`, `onSessionExpired` not called.
  - `my-bookings-expired-token`: `onSessionExpired` called once.
  - After unmount (Review Focus 2): render with `my-bookings-expired-token`, `unmount()` at once, `await new Promise((r) => setTimeout(r, 0))`; `onSessionExpired` not called. Record its failure against a named mutant (the `alive` check removed) once the component exists.
- [ ] **Step 2: Run** `npm --prefix web test -- src/home/MyBookings.test.tsx`. Expected: FAIL, module not found; record it.
- [ ] **Step 3: Implement** `MyBookings` per design notes 2, 3, 4, 9 and 10: list state `{ kind: 'loading' } | { kind: 'loaded'; bookings } | { kind: 'unavailable' }`; a `load()` that takes the next sequence number, awaits `fetchMyBookings(token)`, and applies the answer only when `alive` and still the newest; `unauthorized` calls `onSessionExpiredRef.current()`. Add `noBookings` to `MESSAGES`. Add the section's styles to `HomeScreen.css` (`.home-booking-when { white-space: pre-wrap }`, list without bullets, Cancel beside the title, lines wrapping at 360 px).
- [ ] **Step 4: Run** the same command. Expected: PASS. Then the mutant run for the unmount test (remove the `alive` check, see it FAIL, restore) and record both outputs.
- [ ] **Step 5: Commit** `web.7: My bookings lists the user's bookings (AC-6.1, D1, D3)`.

### Task 4: My bookings, Cancel

**Files:**
- Modify: `web/src/home/MyBookings.tsx`, `web/src/messages.ts`
- Test: `web/src/home/MyBookings.test.tsx`

**Interfaces:**
- Consumes: `cancelBooking(token, id): Promise<Result<null, CancelFailure>>`; `atPath(fixture, path)` from `../test/fetchStub`.
- Produces: `MESSAGES.cancelStarted = 'That booking has already started, so it cannot be cancelled.'`, `MESSAGES.cancelNotFound = 'That booking was already cancelled.'`, `MESSAGES.cancelNotYours = 'You can cancel only your own bookings.'` (D10).

- [ ] **Step 1: Write the failing tests** (`DESIGN = '/api/bookings/00000000-0000-4000-8000-000000000011'`; a local `stubFetchDeferred()` that records `METHOD path` and hands each call a resolver, answering with `new Response(status === 204 ? null : JSON.stringify(body), { status })`):
  - `stubFetch(my-bookings-budi, my-bookings-none, atPath(cancel-my-booking, DESIGN))`: Cancel in Design review's item sends `DELETE ${DESIGN}` with `Bearer ${TOKEN}`; then `(no bookings)` shows; `stub.calls` routes are `GET /api/me/bookings`, `DELETE ${DESIGN}`, `GET /api/me/bookings` (AC-6.2).
  - `it.each` over `cancel-started`, `cancel-unknown`, `cancel-someone-elses` at `DESIGN` (list `my-bookings-budi` repeating): the `status` above the list reads `That booking has already started, so it cannot be cancelled.`, `That booking was already cancelled.`, `You can cancel only your own bookings.` respectively, and the calls end with a second `GET /api/me/bookings`.
  - Review Focus 5: `cancel-someone-elses` with `error.message` replaced by `'Something else.'` still shows `You can cancel only your own bookings.`.
  - `atPath(cancel-no-token, DESIGN)`: `onSessionExpired` called once.
  - A 500 at `DESIGN` (`cancel-my-booking` with `response: { status: 500, body: { error: { code: 'INTERNAL', message: 'x' } } }`): the status reads D3's message, the four items stay, no second GET, `onSessionExpired` not called.
  - Busy (deferred stub): after the list loads, Cancel on Design review: that item's button reads `Cancelling…` and is disabled while the other three read `Cancel` and are enabled; pressing Quick check's Cancel sends a second DELETE while the first is pending.
  - Review Focus 1 (deferred stub): Cancel on Design review, then on Quick check; answer Quick check's DELETE 204, then Design review's 204; answer the later GET with `my-bookings-none`, then the earlier GET with `my-bookings-budi`; the section shows `(no bookings)`. Record its failure against a named mutant (the newest-sequence check removed).
- [ ] **Step 2: Run** `npm --prefix web test -- src/home/MyBookings.test.tsx`. Expected: the new tests FAIL (no `Cancel` handler, no copy); record it.
- [ ] **Step 3: Implement** Cancel per design notes 2, 3 and 6: a `cancelling` set of ids; `CANCEL_NOTICE: Readonly<Record<Exclude<CancelFailure, 'unauthorized'>, string>>`; on press clear the notice, mark the id busy, await `cancelBooking`; if not `alive` stop; `unauthorized` calls `onSessionExpired`; `unavailable` sets D3's notice and clears busy; otherwise set D10's notice for a refusal, `await load()`, then clear busy. Add the three messages.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then the mutant run for Review Focus 1 and record both outputs.
- [ ] **Step 5: Commit** `web.7: Cancel on My bookings (AC-6.2, D9, D10)`.

### Task 5: Home's Time zone row, D7, and App's wiring

**Files:**
- Modify: `web/src/home/HomeScreen.tsx`, `web/src/home/HomeScreen.css`, `web/src/messages.ts`, `web/src/App.tsx`
- Test: `web/src/home/HomeScreen.test.tsx`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `MyBookings` (Tasks 3, 4); `asTimeZone` from `../time/time`; the `session-expired` event (Task 1); `clearSession`.
- Produces: `HomeScreenProps` = `{ profile: Profile; token: string; zone: ZoneName | undefined; onSignOut: () => void; onSessionExpired: () => void }` (all readonly), the Props web.8 builds on. `MESSAGES.timeZoneNotAvailable = 'Not available'`, `MESSAGES.bookingsNeedTimeZone = 'Bookings need your time zone, which is not available.'` (D7).

- [ ] **Step 1: Write the failing tests.**
  - `HomeScreen.test.tsx`: every render passes `token`, `zone` and `onSessionExpired` and stubs `my-bookings-none`. Ayu's rows become Username, Email, Phone, `['Time zone', 'Asia/Jakarta']`, Member since; Budi's carry `['Time zone', 'Europe/London']`. With `zone={undefined}` (Ayu's profile without `timeZone`): the row reads `Not available`, the page shows `Bookings need your time zone, which is not available.`, no `My bookings` heading, and `stub.calls` is empty.
  - `App.test.tsx`: every test that reaches Home adds a bookings fixture to its stub. New: stored session with `me-budi` and `my-bookings-budi` shows `Europe/London` between Phone and Member since, then the four London lines of Task 2 in order, each with Cancel. `me-ayu` with `my-bookings-none` shows `Asia/Jakarta` and `(no bookings)`. `me-budi` with `my-bookings-expired-token` lands on Login with the status `Your session has expired. Please sign in again.` and `sessionStorage.getItem('simple-login.session')` null. A `me-ayu` body without `timeZone`, and one with `timeZone: 'Mars/Olympus'` (Review Focus 3), each show `Not available` and the D7 line, with calls only `GET /api/me`. The walk's expected routes become `POST /api/login`, `GET /api/me`, `GET /api/me/bookings`, `GET /api/me`, `GET /api/me/bookings`.
- [ ] **Step 2: Run** `npm --prefix web test -- src/home/HomeScreen.test.tsx src/App.test.tsx`. Expected: FAIL (no Time zone row, no list); record it.
- [ ] **Step 3: Implement.** `HomeScreen`: the Time zone row between Phone and Member since showing `zone ?? MESSAGES.timeZoneNotAvailable`; under the details, `<MyBookings token zone onSessionExpired />` when `zone !== undefined`, else one `<p>` with `MESSAGES.bookingsNeedTimeZone`; Sign out stays last. `App`: `onSessionExpired` (stable through `useCallback`) clears the stored session and dispatches `session-expired`; the signed-in case passes `token={state.session.token}` and the zone per design note 5. Add the two messages and the D7 line's style.
- [ ] **Step 4: Run** `npm --prefix web test -- src/home/HomeScreen.test.tsx src/App.test.tsx`, then, from a clean install (`rm -rf web/node_modules web/dist && npm --prefix web install`), `npm --prefix web run gate` and the per-suite counts (`TZ=Asia/Kolkata npx vitest run --reporter=verbose` in `web/`). Expected: PASS; gate exit 0. Keep the output for the verification doc (constraint 4); if the final review changes code, re-run both before Task 6.
- [ ] **Step 5: Commit** `web.7: Home shows the time zone and My bookings; App wires the expiry (AC-2.1, AC-2.5, D1, D7)`.

### Task 6: Verification doc

**Files:**
- Create: `hsdd/verify/simple-login.web.7.verification.md`

- [ ] **Step 1:** Take the gate output and per-suite counts from the clean-install run made before this task (Task 5 Step 4, or its re-run after the final review's fixes).
- [ ] **Step 2:** Write the doc from `hsdd/templates/verification.md` at full-review depth: every section filled except `## Sign-off`, left as the template has it. The title uses a hyphen, not the template's em dash. Observed carries the gate's output and the failing-test and mutant evidence inline (no git-ignored log is cited). Outstanding lists what was not verified here (the 360 px look; the real backend). Learnings carry one disposition each, or `- none`.
- [ ] **Step 3: Commit** `web.7: verification doc`.
