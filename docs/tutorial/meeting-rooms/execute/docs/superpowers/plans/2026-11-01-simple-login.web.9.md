# simple-login.web.9 Booking Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The booking form under the Rooms list: room, start, end and title, Book, and one message per answer (PRD v2 US-5, AC-5.1 to AC-5.6; node D10, D11).

**Architecture:** A pure core, `web/src/rooms/bookingRules.ts` (the title rule, the labelled time choices, keep-or-first selection, and the message for each `BookResult`), under a React component, `web/src/rooms/BookingForm.tsx`, that holds the choices and sends `bookRoom`. `RoomsScreen` renders the form below the list once the rooms have loaded, hands it the browser's clock as read when the rooms arrived, and fetches the date again after a 201 without dropping the list.

**Tech Stack:** React 19, TypeScript, Vite, Vitest with jsdom and Testing Library, `Intl` through `web/src/time/time.ts`. No new dependency.

**Spec:** `hsdd-context/superpowers/simple-login.web.9.md` (the phase context, with booking-api@v1, ADR-001, ADR-002 and D1, D3, D10, D11 inline).

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
5. The last task writes hsdd/verify/simple-login.web.9.verification.md from
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
11. When writing Mermaid, use mermaid-pastel-style.

Project rules every task also follows:

- Work only in the worktree `<repo>` (branch `lane/web`). Commands run from its root. Read only `web/`, `hsdd/contract/fixture/booking-api/`, the spec file above and this plan.
- Every test runs with `TZ=Asia/Kolkata` (the `web` scripts set it); never compute a time in the ambient zone (D6: only `web/src/time/` converts times).
- Copy is exact, from D10, D11 and the Scope: `Booked.`, `That time has already started.`, `A booking can last at most 8 hours.`, `A booking can start at most 365 days ahead.`, `That booking is not valid. Check the times and the title.`, `No times left on this date.`, `{roomName} is already booked from {start} to {end}.`, and D3's `Could not reach the server. Please try again.` (already `MESSAGES.unavailable`). Never show `error.message` (booking-api@v1 G18).
- No em dash character (U+2014) in any file written, and no phrase the user's CLAUDE.md bans.
- Commit with the repository's configured identity; end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Design rationale

1. **Pure core, thin component.** `bookingRules.ts` holds every rule a test can state without a DOM: the title rule, the labels, keep-or-first and the answer messages. The component holds state and effects only. The file is not named `bookingForm.ts`: on macOS's case-insensitive file system `./BookingForm` would resolve to `bookingForm.ts` before `BookingForm.tsx`.
2. **The clock is a value, read by Rooms.** The Scope gives the form "the browser's clock". Rooms reads `new Date().toISOString()` when a date's rooms arrive and keeps it in its loaded state; the form gets it as `now: Instant`. Render stays pure and the options do not shift between renders. Cost: a user who sits on Rooms sees starts that have since passed; the backend still decides (D11, ADR-002 Decision 5) and answers `started`. Each refetch, including the one after a 201, reads the clock again. Alternative rejected: a `() => Instant` prop read during render.
3. **Choices are derived, keep-or-first.** The form stores what the user chose (`roomId`, `start`, `end`) and derives what it shows: a chosen value still offered is kept, otherwise the first offered. This gives the Scope's "opens on the first start offered and the end on the first end after it" and "the end list follows the chosen start" without effects: a new start keeps the chosen end while it is still after the start and within 8 hours, and otherwise moves to the first end. Alternative rejected: resetting the end on every start change, which discards an end the user picked.
4. **The title rule counts code points and finds a non-whitespace character with `/\S/u`.** `[...title].length <= 80` (Scope; booking-api@v1 G8). JavaScript's whitespace set may differ from the backend's; a title the backend still refuses answers `VALIDATION_FAILED`, which shows D10's `invalid` message. The input has no `maxLength` (it counts UTF-16 units), and the title is sent as typed.
5. **One request per press.** Book is a submit button in a `<form>`, so Enter in the title submits too. While busy the button is disabled and reads `Booking…`, and the submit handler returns early unless every rule holds and nothing is in flight.
6. **The message is an alert beside Book,** as Home's Cancel notice is: the outcome of the user's own action. A press clears it; the answer sets it; it stays until the next press. `unauthorized` shows nothing and calls `onSessionExpired` (D1).
7. **After a 201 the list stays while Rooms fetches the date again.** A refetch of the date already shown keeps its list and its `now` until the answer arrives, so the form stays mounted with `Booked.`. A date change still reads `Loading…`, which unmounts the form and resets it, title included. If the refetch fails, D3's message replaces the list and the form with it (D10: the screen that asked shows D3).
8. **Answers after unmount are dropped,** `onSessionExpired` included, as Rooms and MyBookings do. The form unmounts when the date changes, so a booking answer for an earlier date is never shown under another.
9. **Focus.** A browser moves focus to the body when the focused Book button becomes disabled. When an answer settles and focus is on the body, the form moves it to the title field, which is where the next booking starts.
10. **Option lists are memoized** on `(date, zone, now)` and `(start, date, zone)`: each label is an `Intl` call, and a keystroke in the title must not recompute 96 of them.

## Review Focus

1. A title with leading or trailing spaces, or an 80-code-point title ending in an emoji, is sent exactly as typed: Task 1 (rule) and Task 3 (request body).
2. A second press, or Enter in the title, while a request is in flight sends nothing more: Task 3.
3. A booking answer that arrives after the form unmounted (the date changed meanwhile), a 401 included, changes nothing and calls nothing: Task 3.
4. Focus left on the body when Book disables itself returns to the title field when the answer settles; focus the user put elsewhere stays: Task 3.
5. A whitespace-only title made of tabs or no-break spaces keeps Book disabled, as three spaces do: Task 1.

## File structure

- Modify `web/src/messages.ts`: Book copy (Task 1).
- Create `web/src/rooms/bookingRules.ts`, `web/src/rooms/bookingRules.test.ts` (Task 1).
- Create `web/src/rooms/BookingForm.tsx`, `web/src/rooms/BookingForm.css`, `web/src/rooms/BookingForm.test.tsx` (Tasks 2, 3).
- Modify `web/src/rooms/RoomsScreen.tsx`, `web/src/rooms/RoomsScreen.test.tsx` (Task 4).
- Create `docs/superpowers/evidence/simple-login.web.9/` (browser check, before Task 5).
- Create `hsdd/verify/simple-login.web.9.verification.md` (Task 5).

Shared test values (Tasks 2 to 4): `TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'`; `fixture = (name) => loadFixture('booking-api', name)` from `web/src/test/fetchStub.ts`; `ROOMS` = `rooms-on-a-date`'s `response.body.rooms` (Merapi, Bromo, Thames, Kew).

---

### Task 1: Book copy and the form's pure core

**Files:**
- Modify: `web/src/messages.ts`
- Create: `web/src/rooms/bookingRules.ts`
- Test: `web/src/rooms/bookingRules.test.ts`

**Interfaces:**
- Consumes: `BookResult`, `Booking` from `web/src/api/types.ts`; `formatTime`, `startOptions`, `endOptions`, `Instant`, `IsoDate`, `ZoneName` from `web/src/time/time.ts`; `MESSAGES` from `web/src/messages.ts`.
- Produces:
  - `MESSAGES.booked`, `MESSAGES.bookStarted`, `MESSAGES.bookTooLong`, `MESSAGES.bookTooFarAhead`, `MESSAGES.bookInvalid`, `MESSAGES.noTimesLeft` (strings, exact copy above) and `bookConflictMessage(roomName: string, start: string, end: string): string` in `messages.ts`.
  - In `bookingRules.ts`: `TITLE_MAX_CHARACTERS = 80`; `titleAllowed(title: string): boolean`; `interface TimeChoice { readonly value: Instant; readonly label: string }`; `timeChoices(instants: readonly Instant[], zone: ZoneName, date: IsoDate): readonly TimeChoice[]`; `keepOrFirst<T>(chosen: T | undefined, offered: readonly T[]): T | undefined`; `type BookOutcome = { readonly kind: 'booked' | 'refused'; readonly message: string } | { readonly kind: 'expired' }`; `bookOutcome(result: BookResult, zone: ZoneName, date: IsoDate): BookOutcome`.

- [ ] **Step 1: Write the failing tests** in `bookingRules.test.ts`:

```ts
const titleOf = (name: string) => (fixture(name).request.body as { title: string }).title
describe('titleAllowed (AC-5.6, booking-api@v1 G8)', () => {
  it('accepts book-title-80-characters: 80 code points, 81 UTF-16 units', () => {
    expect([...titleOf('book-title-80-characters')]).toHaveLength(80)
    expect(titleOf('book-title-80-characters')).toHaveLength(81)
    expect(titleAllowed(titleOf('book-title-80-characters'))).toBe(true)
  })
  it("refuses book-title-too-long's 81 code points", () => expect(titleAllowed(titleOf('book-title-too-long'))).toBe(false))
  it('refuses empty and whitespace-only titles (Review Focus 5)', () => {
    for (const t of ['', '   ', '\t\t', '  ', ' \t \n']) expect(titleAllowed(t)).toBe(false)
  })
  it('accepts a title with spaces around it', () => expect(titleAllowed('  Retro ')).toBe(true))
})
describe('timeChoices (ADR-002 Decision 4)', () => {
  it("labels London's repeated hour twice on 2027-10-31", () => {
    const labels = timeChoices(startOptions('2027-10-31', 'Europe/London', '2027-10-01T09:00:00.000Z'), 'Europe/London', '2027-10-31').map((c) => c.label)
    expect(labels).toHaveLength(100)
    expect(labels.slice(4, 12)).toEqual(['01:00 BST', '01:15 BST', '01:30 BST', '01:45 BST', '01:00 GMT', '01:15 GMT', '01:30 GMT', '01:45 GMT'])
  })
  it("offers nothing in London's skipped hour on 2027-03-28", () => {
    const labels = timeChoices(startOptions('2027-03-28', 'Europe/London', '2027-03-01T09:00:00.000Z'), 'Europe/London', '2027-03-28').map((c) => c.label)
    expect(labels).toHaveLength(92)
    expect(labels.slice(0, 6)).toEqual(['00:00', '00:15', '00:30', '00:45', '02:00', '02:15'])
  })
  it('keeps each instant as the value', () => {
    expect(timeChoices(['2026-11-05T02:00:00.000Z'], 'Asia/Jakarta', '2026-11-05')).toEqual([{ value: '2026-11-05T02:00:00.000Z', label: '09:00' }])
  })
})
describe('keepOrFirst', () => {
  it('keeps a chosen value still offered', () => expect(keepOrFirst('b', ['a', 'b'])).toBe('b'))
  it('falls back to the first', () => expect(keepOrFirst('z', ['a', 'b'])).toBe('a'))
  it('opens on the first', () => expect(keepOrFirst(undefined, ['a', 'b'])).toBe('a'))
  it('is undefined when nothing is offered', () => expect(keepOrFirst('a', [])).toBeUndefined())
})
describe('bookOutcome (D10, booking-api@v1 G18)', () => {
  const conflict = (fixture('book-overlap').response.body as { error: { conflict: Booking } }).error.conflict
  it.each([
    [{ ok: true, value: conflict }, { kind: 'booked', message: 'Booked.' }],
    [{ ok: false, reason: 'conflict', conflict }, { kind: 'refused', message: 'Merapi is already booked from 09:00 to 10:00.' }],
    [{ ok: false, reason: 'started' }, { kind: 'refused', message: 'That time has already started.' }],
    [{ ok: false, reason: 'too-long' }, { kind: 'refused', message: 'A booking can last at most 8 hours.' }],
    [{ ok: false, reason: 'too-far-ahead' }, { kind: 'refused', message: 'A booking can start at most 365 days ahead.' }],
    [{ ok: false, reason: 'invalid' }, { kind: 'refused', message: 'That booking is not valid. Check the times and the title.' }],
    [{ ok: false, reason: 'unavailable' }, { kind: 'refused', message: 'Could not reach the server. Please try again.' }],
    [{ ok: false, reason: 'unauthorized' }, { kind: 'expired' }],
  ] as const)('%o', (result, outcome) => expect(bookOutcome(result, 'Asia/Jakarta', '2026-11-05')).toEqual(outcome))
  it('writes the conflict in the user zone with the picked date as the line date', () => {
    // London user, same conflict: 02:00Z to 03:00Z is 02:00 to 03:00 on 2026-11-05.
    expect(bookOutcome({ ok: false, reason: 'conflict', conflict }, 'Europe/London', '2026-11-05')).toEqual({ kind: 'refused', message: 'Merapi is already booked from 02:00 to 03:00.' })
    // Picked 2026-11-04 in Jakarta: the times carry their own date.
    expect(bookOutcome({ ok: false, reason: 'conflict', conflict }, 'Asia/Jakarta', '2026-11-04')).toEqual({ kind: 'refused', message: 'Merapi is already booked from Thu 5 Nov 09:00 to Thu 5 Nov 10:00.' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm --prefix web test -- src/rooms/bookingRules.test.ts`
Expected: FAIL, `Failed to resolve import "./bookingRules"`. Record the output.

- [ ] **Step 3: Implement** the Produces list. `titleAllowed`: `/\S/u.test(title) && [...title].length <= TITLE_MAX_CHARACTERS`. `timeChoices`: `formatTime(value, zone, date)` per instant. `bookOutcome`: an exhaustive map over the failure reasons (a `Record<Exclude<BookFailure, 'conflict' | 'unauthorized'>, string>`, as `MyBookings`' `CANCEL_NOTICE`), the conflict through `bookConflictMessage(conflict.roomName, formatTime(conflict.start, zone, date), formatTime(conflict.end, zone, date))`. `bookConflictMessage` returns `` `${roomName} is already booked from ${start} to ${end}.` ``.

- [ ] **Step 4: Run to verify it passes**

Run: `npm --prefix web test -- src/rooms/bookingRules.test.ts && npm --prefix web run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 5: Commit** `web.9: Book copy and the booking form's pure core`.

### Task 2: BookingForm shows the choices

**Files:**
- Create: `web/src/rooms/BookingForm.tsx`, `web/src/rooms/BookingForm.css`
- Test: `web/src/rooms/BookingForm.test.tsx`

**Interfaces:**
- Consumes: Task 1's `titleAllowed`, `timeChoices`, `keepOrFirst`, `MESSAGES.noTimesLeft`; `startOptions`, `endOptions` from `time.ts`; `Room` from `api/types.ts`.
- Produces: `export interface BookingFormProps { readonly token: string; readonly zone: ZoneName; readonly date: IsoDate; readonly rooms: readonly Room[]; readonly now: Instant; readonly onBooked: () => void; readonly onSessionExpired: () => void }` and `export function BookingForm(props: BookingFormProps)`. DOM, as PRD v2 Screens draws it: a `<form className="booking-form">` holding the text `Book:`, then `<label>`led controls named exactly `room` (select, option text the room's `name`, value its `id`), `start` and `end` (selects, option text the `TimeChoice` label, value the instant), `title` (`<input type="text">`, no `maxLength`), and a submit button named `Book`. With no start left, the start and end selects are replaced by `<p>No times left on this date.</p>`.

- [ ] **Step 1: Write the failing tests** in `BookingForm.test.tsx`. Render helper: `renderForm({ zone, date, now, rooms = ROOMS })` with `vi.fn()` for `onBooked` and `onSessionExpired`, `token = TOKEN`. `optionTexts = (label) => Array.from(screen.getByLabelText<HTMLSelectElement>(label).options, (o) => o.text)`.
  - `opens on the first room, the first start and the first end after it`: Jakarta, `2026-11-05`, now `2026-11-04T12:00:00.000Z`. `optionTexts('room')` equals `['Merapi', 'Bromo', 'Thames', 'Kew']`; the room select's value is `merapi`; `optionTexts('start')` has 96 entries starting `['00:00', '00:15']`; the start's value is `2026-11-04T17:00:00.000Z`; the end's displayed option is `00:15`.
  - `the end list follows the chosen start (D11)`: select start `09:00`; `optionTexts('end')` has 32 entries, first `09:15`, last `17:00`. Select end `10:00`, then start `09:30`: the end still reads `10:00`. Select start `10:00`: the end reads `10:15`.
  - `ends stop at the start of the next date`: select start `23:45`; `optionTexts('end')` equals `['Fri 6 Nov 00:00']`.
  - `starts later than the clock (D11)`: now `2026-11-05T02:00:00.000Z`, `2026-11-05`: the first start is `09:15`.
  - `no start left`: same clock, date `2026-11-04`: `screen.getByText('No times left on this date.')`, no `start` or `end` control, and Book disabled after typing `Retro` into title.
  - `the repeated hour offers two 01:30s; the skipped hour none` (London, now `2027-10-01T09:00:00.000Z`): on `2027-10-31` start options contain `01:30 BST` and `01:30 GMT`; rerendered on `2027-03-28` (now `2027-03-01T09:00:00.000Z`), no option starts with `01:`.
  - `Book is disabled until the title has a character that is not whitespace, and at most 80 code points (AC-5.6)`: disabled when empty, after typing three spaces, and after pasting `book-title-too-long`'s title; enabled after clearing and pasting `book-title-80-characters`' title; the input's value equals that title exactly (no truncation).
- [ ] **Step 2: Run to verify it fails**

Run: `npm --prefix web test -- src/rooms/BookingForm.test.tsx`
Expected: FAIL, `Failed to resolve import "./BookingForm"`. Record the output.

- [ ] **Step 3: Implement** `BookingForm` without sending: state `roomId?`, `start?`, `end?`, `title`; `starts = useMemo(() => timeChoices(startOptions(date, zone, now), zone, date), [date, zone, now])`; `start = keepOrFirst(chosenStart, starts.map(v))`; `ends` memoized on `[start, date, zone]` (empty when no start); `end = keepOrFirst(chosenEnd, …)`; `room = keepOrFirst(chosenRoom, rooms.map(id))`. Book is disabled unless `room`, `start`, `end` are defined and `titleAllowed(title)`. `onSubmit` calls `preventDefault()` only (Task 3 sends). `BookingForm.css`: the form wraps (`display: flex; flex-wrap: wrap; gap`), controls use Rooms' input look (`font: inherit; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px`), the title field grows (`flex: 1 1 10rem; min-width: 0`), and nothing overflows the card at 360 px. Import it from the component.
- [ ] **Step 4: Run to verify it passes**

Run: `npm --prefix web test -- src/rooms/BookingForm.test.tsx && npm --prefix web run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit** `web.9: BookingForm shows the room, start, end and title choices`.

### Task 3: BookingForm sends Book and shows each answer

**Files:**
- Modify: `web/src/rooms/BookingForm.tsx`
- Test: `web/src/rooms/BookingForm.test.tsx`

**Interfaces:**
- Consumes: `bookRoom(token, { roomId, start, end, title })` from `web/src/api/client.ts`; Task 1's `bookOutcome`; `stubFetch`, `stubFetchHanging`, `stubFetchUnreachable` from `web/src/test/fetchStub.ts`.
- Produces: the busy button text `Booking…`; the answer in `<p role="alert">` inside the form after the button; `onBooked()` once per 201; `onSessionExpired()` once per 401.

- [ ] **Step 1: Write the failing tests.** `choose(room, start, end, title)` selects by option text and pastes the title. `bodyOf(name) = fixture(name).request.body`. A local `stubFetchDeferred()` as in `RoomsScreen.test.tsx` (every call waits until the test answers it).
  - `book-a-room (Verification)`: Jakarta, `2026-11-05`, now `2026-11-04T12:00:00.000Z`, `stubFetch(fixture('book-a-room'))`; choose Merapi, `09:00`, `10:00`, `Sprint planning`; click Book. `stub.calls` equals `[{ method: 'POST', path: '/api/bookings', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: bodyOf('book-a-room') }]`; the alert reads `Booked.`; title value `''`; `onBooked` called once; room, start and end still `merapi`, `2026-11-05T02:00:00.000Z`, `2026-11-05T03:00:00.000Z`.
  - `book-overlap (AC-5.3, G18)`: same setup with `stubFetch(fixture('book-overlap'))`, choose Merapi, `09:30`, `10:30`, `Retro`: the body equals `bodyOf('book-overlap')`; the alert reads `Merapi is already booked from 09:00 to 10:00.`; no text `The room is already booked for part of that time.`; the choices and the title `Retro` stay; `onBooked` not called.
  - `book-in-the-repeated-hour (AC-4.4, AC-5.2)`: London, `2027-10-31`, now `2027-10-01T09:00:00.000Z`; choose Thames, `01:30 BST`, `01:30 GMT`, `Clock change drill`: the body equals `bodyOf('book-in-the-repeated-hour')`; alert `Booked.`.
  - `book-title-80-characters`: Jakarta, Merapi, `09:00`, `10:00`, that fixture's title: body equals `bodyOf('book-title-80-characters')`.
  - `a title is sent untrimmed (Review Focus 1)`: answer `book-a-room`; title `  Sprint planning `: the sent body's `title` is `'  Sprint planning '`.
  - `book-started`: now `2026-11-05T01:50:00.000Z`, `2026-11-05`, `09:00` is the first start; choose Merapi, `09:00`, `10:00`, `Retro`; the alert reads `That time has already started.`; choices stay.
  - `book-too-far-ahead`: London, `2027-11-04`, now `2026-11-04T00:00:00.000Z`; choose Thames, `00:15`, `01:15`, `Annual planning`: body equals `bodyOf('book-too-far-ahead')`; alert `A booking can start at most 365 days ahead.`
  - `book-too-long` and `book-title-blank` answers (the form cannot send either body, the backend can still answer them): alerts `A booking can last at most 8 hours.` and `That booking is not valid. Check the times and the title.`
  - `book-unknown-token (D1)`: `onSessionExpired` called once; no alert.
  - `unreachable (D3)`: `stubFetchUnreachable()`: alert `Could not reach the server. Please try again.`; choices and title stay.
  - `one request per press (Review Focus 2)`: `stubFetchHanging()`; click Book twice and press Enter in the title: `stub.calls` has length 1; the button reads `Booking…` and is disabled.
  - `a press clears the previous message`: after `book-overlap`'s alert, a second press with the deferred stub shows no alert until answered.
  - `drops an answer after unmount, a 401 included (Review Focus 3)`: deferred stub; press Book; unmount; answer 401 with `book-unknown-token`'s body: `onSessionExpired` and `onBooked` not called.
  - `focus left on the body returns to the title (Review Focus 4)`: deferred stub; press Book (focus on the button); `act(() => (document.activeElement as HTMLElement).blur())`; answer with `book-overlap`'s 409: `document.activeElement` is the title input. A second test: focus moved to the room select before the answer stays there.
- [ ] **Step 2: Run to verify they fail**

Run: `npm --prefix web test -- src/rooms/BookingForm.test.tsx`
Expected: the new tests FAIL (no request sent, no alert). Record the output.

- [ ] **Step 3: Implement** the submit handler: return unless `canBook && !busy`; clear the message; set busy; `await bookRoom(token, { roomId, start, end, title })`; drop the answer if unmounted (an `alive` ref set in an effect, as MyBookings does); `bookOutcome(result, zone, date)`: `expired` calls `onSessionExpired` (through a ref written in a layout effect, as RoomsScreen does); `booked` sets the message, clears the title and calls `onBooked`; `refused` sets the message. Clear busy and bump a `settled` counter; a `useLayoutEffect` on it focuses the title input when `document.activeElement` is `null` or `document.body`.
- [ ] **Step 4: Run to verify they pass**

Run: `npm --prefix web test -- src/rooms/BookingForm.test.tsx && npm --prefix web run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit** `web.9: BookingForm sends Book once and shows D10's answer`.

### Task 4: Rooms renders the form and fetches the date again after a booking

**Files:**
- Modify: `web/src/rooms/RoomsScreen.tsx`
- Test: `web/src/rooms/RoomsScreen.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 and 3's `BookingForm`.
- Produces: `ListState`'s `loaded` gains `readonly now: Instant` (the browser's clock read when the answer arrived). A `refresh` counter joins the fetch effect's dependencies; `onBooked` increments it. A run for the date already loaded keeps that list (`setList((prev) => (prev.kind === 'loaded' && prev.date === date ? prev : LOADING))`). The form renders after `.rooms-list` only while `shownList.kind === 'loaded'`, with `date={shownList.date}`, `rooms={shownList.rooms}`, `now={shownList.now}`.

- [ ] **Step 1: Write the failing tests** in `RoomsScreen.test.tsx`:
  - `renders the form below the list once the rooms have loaded`: London, `rooms-on-a-date`: after the lines show, `screen.getByRole('button', { name: 'Book' })` exists and `list()` precedes the form in document order; while `stubFetchHanging()` reads `Loading…`, and after `stubFetchUnreachable()`'s D3 message, there is no Book button.
  - `the form's starts come from the clock read when the rooms arrived`: clock `2026-11-04T18:00:00.000Z`, Jakarta, `rooms-range-edges`: the first start option reads `01:15`.
  - `after a 201 it fetches the date again and the booking shows under Merapi, with Booked. kept (Scope)`: clock `2026-11-04T18:00:00.000Z`, Jakarta. `stubFetch(fixture('rooms-range-edges'), withBooking, fixture('book-a-room'))`, where `withBooking` is `rooms-range-edges` answering with `book-a-room`'s response booking appended to Merapi's `bookings` (it sorts last by `start`, so G13's order holds). Choose Merapi, `09:00`, `10:00`, `Sprint planning`; click Book. Then `stub.calls` routes are `GET {RANGE_EDGES_PATH}`, `POST /api/bookings`, `GET {RANGE_EDGES_PATH}`, with `RANGE_EDGES_PATH = '/api/rooms?from=2026-11-04T17:00:00.000Z&to=2026-11-05T17:00:00.000Z'`; `shown()` contains `09:00 to 10:00  Sprint planning` right after `08:00 to 08:30  Standup`; the alert still reads `Booked.`; `Loading…` never appeared after the first answer (assert with the deferred stub: after the POST answers, before the refetch answers, `list()` is not null and the alert reads `Booked.`).
  - `a refetch that answers 401 calls onSessionExpired`: same, with the second rooms answer `rooms-no-token`'s response at that path.
- [ ] **Step 2: Run to verify they fail**

Run: `npm --prefix web test -- src/rooms/RoomsScreen.test.tsx`
Expected: the new tests FAIL (no Book button). Record the output.

- [ ] **Step 3: Implement** the Produces list in `RoomsScreen.tsx`. Update the doc comment to name the form and the refetch.
- [ ] **Step 4: Run to verify they pass**

Run: `npm --prefix web test -- src/rooms/RoomsScreen.test.tsx && npm --prefix web run typecheck`
Expected: all pass, the existing 11 Rooms tests included.

- [ ] **Step 5: Commit** `web.9: Rooms renders the booking form and fetches the date again after a booking`.

### Before Task 5: the gate and the browser check (controller)

- [ ] From a clean install: `rm -rf web/node_modules web/dist web/package-lock.json && npm --prefix web install && npm --prefix web run gate`. Expected: tsc clean, every test file passes, `vite build` writes `web/dist`. Record per-file counts with `--reporter=json` into `docs/superpowers/evidence/simple-login.web.9/`.
- [ ] Browser check, off ports 3000 and 5173: the backend on `PORT=3109` with its own database `meeting_rooms_web9` on the Compose service (created first), Vite on 5179 proxying `/api` to 3109 through a config outside the repository. Sign in as `ayu`, open Rooms on a future date, book, see `Booked.` and the line under the room; trigger an overlap; screenshots at 360 px and at desktop width into `docs/superpowers/evidence/simple-login.web.9/`. Drop the database afterwards.

### Task 5: Verification doc

**Files:**
- Create: `hsdd/verify/simple-login.web.9.verification.md`

- [ ] **Step 1:** Write it from `hsdd/templates/verification.md` at full-review depth: Commands to run, Expected output, Observed (dated; the gate's numbers before and after, per file; each Verification sentence of the phase mapped to its test; each task's failing output; review results), Outstanding, Learnings (each with one disposition, or `- none`), Metrics. Leave `## Sign-off` exactly as the template has it. The title line uses a hyphen, not the template's em dash. Evidence cited lives in the repository.
- [ ] **Step 2:** `grep -c "$(printf '\xe2\x80\x94')" hsdd/verify/simple-login.web.9.verification.md` prints `0`; `git status --porcelain -- hsdd` shows only this file.
- [ ] **Step 3: Commit** `web.9: verification doc`.
