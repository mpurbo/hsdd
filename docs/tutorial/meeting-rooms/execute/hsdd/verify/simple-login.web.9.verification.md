# Verification: simple-login.web.9 - Booking form

Review tier: full-review. Branch `lane/web`, phase commits `53463a5..` (base
`bd752d5`). Phase context `hsdd-context/simple-login.web.9.md`, spec `bd752d5`;
plan `docs/superpowers/plans/2026-11-01-simple-login.web.9.md`; evidence
`docs/superpowers/evidence/simple-login.web.9/`.

## Commands to run

From the repository root (the directory holding `hsdd/`), on a fresh checkout:

```bash
rm -rf web/node_modules web/dist web/package-lock.json   # web/package-lock.json is git-ignored
npm --prefix web install
npm --prefix web run gate        # tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build
```

The phase's own tests, alone:

```bash
npm --prefix web test -- src/rooms/bookingRules.test.ts src/rooms/BookingForm.test.tsx src/rooms/RoomsScreen.test.tsx
```

This phase produces no contract, so there is no schema validation or fixture
replay to run. It consumes booking-api@v1 through `fetch` stubbed with
`hsdd/contract/fixture/booking-api/`; the backend never runs for the gate.

Optional browser check (not part of the gate; needs Docker and Chrome). It
stays off ports 3000 and 5173 and off the `meeting_rooms` database:

```bash
npm --prefix backend install && npm --prefix backend run db:up
docker exec meeting-rooms-postgres-1 psql -U meeting_rooms -d meeting_rooms -c 'CREATE DATABASE meeting_rooms_web9'
PORT=3109 DATABASE_URL=postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms_web9 npm --prefix backend start &
npm --prefix web run build && (cd web && npx vite preview --config <path>/vite.preview.mjs) &
node <path>/browser-check.mjs <output directory>
docker exec meeting-rooms-postgres-1 psql -U meeting_rooms -d meeting_rooms -c 'DROP DATABASE meeting_rooms_web9'
```

`vite.preview.mjs` (port 5179, `/api` proxied to 3109) and `browser-check.mjs`
are in the evidence directory; both hold absolute paths of the worktree they
ran in, which a rerun replaces.

## Expected output

- `npm --prefix web install` adds the packages with no error.
- `tsc --noEmit` prints nothing.
- Vitest: `Test Files  18 passed (18)`, `Tests  387 passed (387)`, no warning
  lines (no React `act()` warning).
- `vite build` writes `web/dist/index.html` and one CSS and one JS asset, and
  prints `built in`.
- Exit status 0.
- The browser check prints one JSON line per width with `"booked":"Booked."`,
  `"conflict":"Merapi is already booked from 09:00 to 10:00."` and
  `"horizontalScroll":false`.

## Observed

2026-11-01.

**Phase switch.** hsdd-config wrote `hsdd-context/simple-login.web.9.md` and
`hsdd-context/superpowers/simple-login.web.9.md` from spec `bd752d5` (not
dirty); the equality check printed nothing (commit `53463a5`). Contracts:
booking-api@v1 consumes; auth-api@v1, profile-api@v2 and profile-api@v1
referenced (named inside booking-api@v1's and auth-api@v1's sections).
Decisions: ADR-001, ADR-002, D1, D3, D10, D11. No open question is cited.

**Gate before the phase** (`53463a5`, whose `web/` equals `bd752d5`'s; installed tree): tsc clean, 16 files,
331 tests passed, build OK.

**Gate after the phase, from a clean install** (`5fadce3`, output in
`docs/superpowers/evidence/simple-login.web.9/gate-clean-install.txt`): tsc
clean; `Test Files 18 passed (18)`, `Tests 387 passed (387)`; `vite build`
OK; exit 0. Per file (before, after; `tests-before.json`, `tests-after.json`):

| File | Before | After |
|------|-------:|------:|
| web/src/rooms/bookingRules.test.ts | 0 | 21 |
| web/src/rooms/BookingForm.test.tsx | 0 | 27 |
| web/src/rooms/RoomsScreen.test.tsx | 11 | 19 |
| web/src/api/client.test.ts | 124 | 124 |
| web/src/time/time.test.ts | 63 | 63 |
| web/src/session/flow.test.ts | 22 | 22 |
| web/src/App.test.tsx | 20 | 20 |
| web/src/home/MyBookings.test.tsx | 20 | 20 |
| web/src/login/LoginScreen.test.tsx | 16 | 16 |
| web/src/session/store.test.ts | 12 | 12 |
| web/src/test/fetchStub.test.ts | 10 | 10 |
| web/src/rooms/roomViews.test.ts | 8 | 8 |
| web/src/home/HomeScreen.test.tsx | 8 | 8 |
| web/src/home/memberSince.test.ts | 8 | 8 |
| web/src/home/bookingLines.test.ts | 5 | 5 |
| web/src/App.expiry.test.tsx | 2 | 2 |
| web/src/viteConfig.test.ts | 1 | 1 |
| web/src/test/ambientZone.test.ts | 1 | 1 |
| **Total** | **331** | **387** |

**The phase's Verification, sentence by sentence** (all in
`web/src/rooms/`, all passing in the run above):

| Verification | Test |
|--------------|------|
| Jakarta, clock `2026-11-04T12:00:00.000Z`, 2026-11-05: Merapi, `09:00`, `10:00`, `Sprint planning` sends exactly `book-a-room`'s body and shows `Booked.` | BookingForm.test.tsx `book-a-room (Verification)` (method, path, both headers and body compared whole) |
| `book-overlap`'s answer shows `Merapi is already booked from 09:00 to 10:00.` | `book-overlap (AC-5.3, G18)`, which also checks that `error.message` is not on screen |
| London, clock `2027-10-01T09:00:00.000Z`, 2027-10-31: Thames, `01:30 BST`, `01:30 GMT` sends exactly `book-in-the-repeated-hour`'s body | `book-in-the-repeated-hour (AC-4.4, AC-5.2)` |
| `book-title-80-characters`'s title (80 code points, 81 UTF-16 units) is accepted and sent unchanged | `book-title-80-characters`; bookingRules.test.ts `accepts book-title-80-characters: 80 code points, 81 UTF-16 units` |
| `book-title-too-long`'s title (81 code points) and three spaces keep Book disabled | `Book is disabled until the title has a character that is not whitespace, and at most 80 code points (AC-5.6)`; bookingRules.test.ts `refuses book-title-too-long's 81 code points`, `refuses empty and whitespace-only titles (Review Focus 5)` |
| Clock `2026-11-05T01:50:00.000Z`: `book-started`'s answer to `09:00` shows `That time has already started.` | `book-started` |
| `book-too-far-ahead` (2027-11-04, `00:15` to `01:15`, clock `2026-11-04T00:00:00.000Z`) shows `A booking can start at most 365 days ahead.` | `book-too-far-ahead` (also compares the sent body to the fixture's) |
| `book-unknown-token`'s 401 calls `onSessionExpired` | `book-unknown-token (D1): ends the session, no message` |
| Clock `2026-11-05T02:00:00.000Z`: starts for 2026-11-05 in Jakarta begin at `09:15`; 2026-11-04 reads `No times left on this date.` | `starts later than the clock (D11)`, `no start left` |

The rest of the Scope: the room select opens on the first room and the start
and end on the first offered (`opens on the first room, the first start and
the first end after it`); the end list follows the start (`the end list
follows the chosen start (D11)`, `ends stop at the start of the next date`);
the skipped hour offers no `01:xx` (`the repeated hour offers two 01:30s; the
skipped hour none`, bookingRules.test.ts `offers nothing in London's skipped
hour on 2027-03-28`); `too-long` and `invalid` (the `it.each` over
`book-too-long` and `book-title-blank`); `unavailable` (`unreachable (D3)`);
choices kept after a refusal (`book-overlap`, `book-started`, `unreachable`);
one request per press (`one request per press (Review Focus 2)`); a 201
clears the title and Rooms fetches the date again with the booking under
Merapi (RoomsScreen.test.tsx `a 201 fetches the date again, the booking
shows under Merapi, Booked. stays (Scope)`); the form below the list only
once the rooms have loaded (`renders the form below the list once the rooms
have loaded`, `has no form while loading or after the D3 message`).

**Test-first evidence.** Every RED ran against code this phase adds, never
against a dependency phase's behavior, so constraint 1's earlier-commit run
did not apply; where a test passed on its first run, a named mutant shows it
can fail.

- Task 1 (`6b6170d`): `npm --prefix web test -- src/rooms/bookingRules.test.ts`
  failed on the unresolved import `./bookingRules`; then 20 passed.
- Task 2 (`e143eb3`): `src/rooms/BookingForm.test.tsx` failed on the
  unresolved import `./BookingForm`; then 7 passed.
- Task 3 (`84ea168`): `Tests 17 failed | 8 passed (25)`, each failure "Unable
  to find role=alert", "expected vi.fn() to be called 1 times, but got 0" or
  "no call 0" (nothing sent); then 25 passed. Eight mutants of
  `BookingForm.tsx` were each caught: guard without `busy`, guard without
  `canBook`, no `alive` check, always focus the title, no focus effect, busy
  left set after `expired`, a press that keeps the message, `expired` that
  also sets a message.
- Task 4 (`420e085`): `src/rooms/RoomsScreen.test.tsx` gave `Tests 6 failed |
  12 passed (18)` (no Book button); then 18 passed. One new test, `has no
  form while loading or after the D3 message`, passed at RED: it states an
  absence that held before the form existed.
- Final fixes (`5fadce3`): the U+00A0 cases failed under the mutant
  `/[^ \t\n]/u` (`expected true to be false`); the two-argument
  `bookConflictMessage` failed first on TS2554; the title typed in flight
  failed first (`expected '' to be 'Sprint planning and retro'`). The two
  added tests passed at once and were each caught by a named mutant: no
  `alive` check in `BookingForm.tsx` (4 routes sent instead of 3), and
  `keepOrFirst` returning the chosen value unconditionally.

**Reviews** (superpowers:subagent-driven-development: a fresh implementer and
a fresh task reviewer per task, then one whole-branch review):

| Review | Critical | Important | Minor | Outcome |
|--------|---------:|----------:|------:|---------|
| Task 1 | 0 | 0 | 3 | approved |
| Task 2 | 0 | 0 | 4 | approved |
| Task 3 | 0 | 0 | 3 | approved |
| Task 4 | 0 | 0 | 3 | approved |
| Whole branch (`bd752d5..420e085`) | 0 | 1 | 6 | with fixes |
| Re-review of the fixes (`420e085..5fadce3`) | 0 | 0 | 0 | 5 of 5 addressed, no new breakage |

The whole-branch review's Important finding: the U+00A0 cases of the Review
Focus 5 test had become ASCII spaces. Fixed in `5fadce3` together with four
Minor findings: controls at 15 px (iOS Safari zooms; now `1rem` as every
other input in the app), the overlap sentence now written through
`formatRange` as the Scope says, a title typed while Book is in flight no
longer wiped by the 201, and two added tests (a date change during an
in-flight Book; a later clock moving a start no longer offered). Two Minor
findings were ruled on and not changed; they are the first two Learnings.
The reviewer found none of the 12 deferred task-level minors blocking.

**Browser check** (real Chrome through Playwright, on the build of `5fadce3`;
backend on 3109 with its own database `meeting_rooms_web9`, dropped
afterwards): as `ayu` (`Asia/Jakarta`), Rooms on 2026-11-05, Merapi `09:00`
to `10:00` `Sprint planning`: `Booked.`, the line `09:00 to 10:00  Sprint
planning` under Merapi; then `09:30` to `10:30` `Retro`: `Merapi is already
booked from 09:00 to 10:00.`; no horizontal scroll at 360 px. The same at
1280 px on 2026-11-06 with `Design review`. After each answer focus is on
the title field. Output in `browser-check.out.jsonl`, screenshots
`360px-*.png` and `1280px-*.png`.

## Outstanding

- The `1rem` control size is meant to stop iOS Safari zooming on focus. It
  was checked in the CSS only; verifying it takes an iOS device or simulator.
- The alert (`role="alert"`) was found by role in Chrome; no screen reader
  announced it in this environment. Verifying takes VoiceOver or NVDA.
- Focus returning to the title was seen in Chrome only; Safari and Firefox
  apply their own rule when a focused button becomes disabled.
- London's clock-change days in the form were proven by unit and component
  tests (`TZ=Asia/Kolkata`), not in a browser; the integration node's
  browser suite owns AC-4.4 end to end.

## Learnings

- A failed refetch after a 201 replaces the list and the form with D3's
  message, so `Booked.` goes with them and a user may think a saved booking
  failed. D10 ("the screen that asked") and plan rationale 7 chose this; the
  alternative keeps the form with `Booked.` and drops only the list. The
  next Home or Rooms fetch shows the booking. Decision for the owner;
  proposed disposition: dropped (D10 settles it; the window needs a network
  failure in the second after a successful Book).
- A Book answered `unavailable` (no answer within 10 s, or a network
  failure) does not refetch the date. If the backend saved the booking
  anyway, a retry is refused with `{room} is already booked from {start} to
  {end}.` naming the user's own booking, and the list stays stale until the
  next fetch. Refetching on `unavailable` would show the truth but, on a dead
  network, replace the form with D3's message too. Decision for the owner;
  proposed disposition: dropped (D10 maps `unavailable` to D3's message with
  the choices kept; Home lists the booking).
- booking-api@v1 G8 says "at least one of them not whitespace" without naming
  a whitespace set. The form uses JavaScript's `\s`, so a title of only
  U+200B (zero-width space) enables Book; the backend's answer then decides,
  and a refusal shows D10's `invalid` message. Proposed disposition: dropped
  (the backend decides and the message covers a refusal; naming the set in
  the contract would be a compatible clarification if the owner wants one).
- The phase plan sized web.9 at "~5 files (~360 lines, about half of them
  tests)". It landed at 8 web files and 896 added lines: 313 product (151
  component, 77 CSS, 42 core, 18 copy, 25 in Rooms) and 583 test. The review
  still fit one sitting. Proposed disposition: dropped (an estimate, kept as
  velocity data in Metrics).
- `hsdd/templates/verification.md` differs from hsdd-config's bundled
  template in Sign-off: the bundled one names delegated sign-off (`{person} |
  {agent} for {person} (delegated)`) and this copy does not. The switch
  leaves a copy that has `## Learnings` as it is and reports the difference.
  Proposed disposition: dropped (replacing the project's copy is the owner's
  choice; this doc follows the project's copy).

## Metrics

- Agent wall-clock: 2026-11-01 04:56 to 07:06 (+07:00) from the switch
  commit to the evidence commit, including a pause of the run on an API
  usage limit between Task 3 (05:16) and Task 4 (06:54).
- Review wall-clock: owner review pending (full-review tier).
- Gate failures before green: 0 at the gate. Inside the tasks, one
  unexpected test failure on Task 3's first green run, root-caused in the
  test (jsdom does not move focus off a disabled button) and fixed there.
- Tokens: subagents about 763k in all (implementers 54.8k, 53.8k, 142.6k,
  65.0k; task reviewers 48.2k, 53.3k, 54.7k, 50.0k; whole-branch review
  124.4k; fix wave 67.1k; re-review 48.8k). The controller's own use is not
  reported by the harness.
- Product diff against process artifacts: 313 product lines and 583 test
  lines under `web/`; about 2,050 lines of process text (phase context and
  derivative, plan, evidence text) plus this doc and six screenshots.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) |
  deferred to {phase-id}
- Disposition of each Learning: spec-updated | contract-bumped (id@v) |
  adr-proposed (ADR-nnn) | dropped (reason)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
