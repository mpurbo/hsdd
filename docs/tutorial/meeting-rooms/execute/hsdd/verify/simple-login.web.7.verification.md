# Verification: simple-login.web.7 - Home: time zone, my bookings and Cancel

> Written at apply by the documentation task, once implementation details
> exist, never during planning. Depth per review tier: gate-only = slim
> (gate command, expected output, a 3-5 line checklist, Learnings);
> spot-check = short (commands, expected output, what to eyeball,
> Learnings); full-review = full (every section below). Every tier keeps
> Learnings and Sign-off.

Review tier: full-review. Phase context: `hsdd-context/simple-login.web.7.md`
(spec 13d02da). Plan: `docs/superpowers/plans/2026-11-01-simple-login.web.7.md`.
Code range: 13cad7c (plan) to ad1c8fe. The template's title separator is an
em dash; this doc uses a hyphen (see Learnings).

## Commands to run

From the repository root, on a fresh checkout. The backend and PostgreSQL
are not needed: every test stubs `fetch` with the contract fixtures
(Isolation strategy).

```sh
rm -rf web/node_modules web/dist
npm --prefix web install
npm --prefix web run gate        # tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build
```

Per-file counts:

```sh
cd web && TZ=Asia/Kolkata npx vitest run --reporter=verbose
```

This phase's own suites only:

```sh
npm --prefix web test -- src/home src/App.test.tsx src/session/flow.test.ts
```

This phase produces no contract, so there is no replay.

The failing-first evidence for Task 1 can be reproduced against the tree
before the phase:

```sh
cp web/src/session/flow.ts /tmp/flow.ts.keep
git show 13cad7c:web/src/session/flow.ts > web/src/session/flow.ts
npm --prefix web test -- src/session/flow.test.ts   # 1 failed | 14 passed (15)
cp /tmp/flow.ts.keep web/src/session/flow.ts
```

## Expected output

- `npm --prefix web run gate` exits 0. `tsc` prints nothing, vitest prints
  `Test Files  13 passed (13)` and `Tests  296 passed (296)` with no
  `act()` warning and no console output, and `vite build` writes `dist/`.
- Passing tests per file, before (13cad7c) and after (ad1c8fe):

| File | Before | After |
|------|-------:|------:|
| src/api/client.test.ts | 124 | 124 |
| src/App.test.tsx | 9 | 14 |
| src/home/bookingLines.test.ts | - | 5 |
| src/home/HomeScreen.test.tsx | 6 | 7 |
| src/home/memberSince.test.ts | 8 | 8 |
| src/home/MyBookings.test.tsx | - | 20 |
| src/login/LoginScreen.test.tsx | 16 | 16 |
| src/session/flow.test.ts | 12 | 15 |
| src/session/store.test.ts | 12 | 12 |
| src/test/ambientZone.test.ts | 1 | 1 |
| src/test/fetchStub.test.ts | 10 | 10 |
| src/time/time.test.ts | 63 | 63 |
| src/viteConfig.test.ts | 1 | 1 |
| **Total (files)** | **262 (11)** | **296 (13)** |

- The phase's Verification, clause by clause, and the test that shows it:

| Verification clause | Test |
|---|---|
| `me-budi` + `my-bookings-budi`: `Europe/London` between Phone and Member since, then the four lines `Thu 5 Nov  09:00 to 10:00` / `Merapi · Ongoing sync`, `Thu 5 Nov  10:00 to 11:00` / `Thames · Design review`, `Thu 5 Nov  10:00 to 10:30` / `Kew · Quick check`, `Thu 12 Nov  10:00 to 11:00` / `Merapi · Next week`, each with Cancel | App.test.tsx "shows Budi's zone between Phone and Member since, then his four bookings, each with Cancel"; MyBookings.test.tsx "lists the user's bookings in the user's zone, each with Cancel"; bookingLines.test.ts "shows the fixture bookings in London time" |
| `me-ayu` shows `Asia/Jakarta`; `my-bookings-none` shows `(no bookings)` | App.test.tsx "shows Ayu's zone and (no bookings)"; MyBookings.test.tsx "says so when there are no bookings" |
| Cancel on Design review sends `DELETE /api/bookings/00000000-0000-4000-8000-000000000011`, answered by `cancel-my-booking`'s 204 at that path; the list is fetched again and answered by `my-bookings-none` | MyBookings.test.tsx "cancels the booking and shows the list fetched again (AC-6.2)" |
| `cancel-started`, `cancel-unknown`, `cancel-someone-elses` at that path show the three D10 sentences | MyBookings.test.tsx "%s: D10 message above the list, and the list fetched again" (three cases) |
| Through App, `me-budi` + `my-bookings-expired-token` lands on Login with `Your session has expired. Please sign in again.` and nothing stored | App.test.tsx "a 401 on the list sends Home to Login with the expiry message and clears the session (D1)" |
| A profile without `timeZone` shows `Not available` and sends no bookings request | App.test.tsx "with %s: Not available, the D7 line, and only GET /api/me is sent" (absent, and `Mars/Olympus`); HomeScreen.test.tsx "without a zone (D7): ..." |

- The plan's Review Focus, each pinned by a test: (1) out-of-order list
  answers, MyBookings "shows the newest list request answer when two
  Cancels answer out of order (Review Focus 1)" and "keeps both Cancels
  busy until the newest list request answers, the stale one answering
  first (design note 2)"; (2) answers after unmount, "drops an answer that
  arrives after unmount" and "drops a Cancel answer that arrives after
  unmount"; (3) `Mars/Olympus`, the App test above; (4) midnight crossing
  and the repeated hour, bookingLines.test.ts; (5) `error.message` ignored,
  "chooses the message by error.code, never error.message".

## Observed

2026-11-01, on macOS (Darwin 25.6.0), Node.js v24.18.0, npm 11.16.0;
installed: react 19.3.1, typescript 7.0.2, vite 8.3.5, vitest 5.0.5,
jsdom 30.1.3.

**Baseline, 13cad7c, clean install:** gate exit 0, `Test Files  11 passed
(11)`, `Tests  262 passed (262)`.

**Final, ad1c8fe, clean install** (`rm -rf web/node_modules web/dist`,
`npm --prefix web install`, `npm --prefix web run gate`): exit 0. The
install printed two `npm warn allow-scripts` lines (install scripts left
unapproved by npm 11); the gate does not depend on them.

```
> simple-login-web@0.0.0 gate
> tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build

 RUN  v5.0.5 .../mr-web/web

 Test Files  13 passed (13)
      Tests  296 passed (296)
   Duration  2.14s (environment 55%, setup 25%, tests 12%, import 4%, transform 3%)

vite v8.3.5 building client environment for production...
✓ 28 modules transformed.
dist/index.html                   0.39 kB │ gzip:  0.26 kB
dist/assets/index-gidTJImX.css    2.61 kB │ gzip:  0.85 kB
dist/assets/index-YoZ5mUex.js   232.22 kB │ gzip: 72.89 kB
✓ built in 237ms
```

Per-file counts at ad1c8fe are the "After" column above (verbose run).

**Failing first, task by task.** Every test of this phase covers behavior
this phase adds; none covers behavior a dependency phase (web.4, web.5,
web.6) already delivered, so each failed first against the tree before its
own task. Where a guard could pass vacuously, it was also run against a
named mutant. Each mutant was applied alone and restored.

- Task 1 (`session-expired`, b120382), test against the pre-phase
  `flow.ts` (13cad7c), re-run for this doc:
  ```
  × a 401 on a signed-in screen shows Login with the expiry notice (D1) 2ms
  FAIL  src/session/flow.test.ts > session flow > a 401 on a signed-in screen shows Login with the expiry notice (D1)
  AssertionError: expected { kind: 'signed-in', …(2) } to deeply equal { kind: 'signed-out', …(1) }
   Test Files  1 failed (1)
        Tests  1 failed | 14 passed (15)
  ```
- Task 2 (`bookingLine`, f1df914): the new file failed to load before
  `bookingLines.ts` existed (`Failed Suites 1`, no tests); then 5 passed.
- Task 3 (the list, d89f5da): before `MyBookings.tsx` existed,
  `Error: Failed to resolve import "./MyBookings" from "src/home/MyBookings.test.tsx"`.
  Named mutant, `!alive.current ||` removed:
  ```
  × drops an answer that arrives after unmount (no onSessionExpired)
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
        Tests  1 failed | 5 passed (6)
  ```
- Task 4 (Cancel, 9a40a81), tests against d89f5da's component (button with
  no handler): `Tests  10 failed | 6 passed (16)`, for example
  `TestingLibraryElementError: Unable to find an element with the text: (no bookings)`
  (204 test) and `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times`
  (Cancel 401). Named mutant, the newest-sequence check removed from
  `load()`: only "shows the newest list request answer when two Cancels
  answer out of order (Review Focus 1)" failed, showing the stale
  `my-bookings-budi` list over `(no bookings)`, `Tests  1 failed | 16
  passed (17)`. Five more one-line mutants (no refetch await, no notice
  clear, no `alive` check in Cancel, a refetch after `unavailable`,
  `disabled={false}`) each failed exactly one test.
- Task 4 fix round 1 (76e5c19): the test that answers the stale list
  request first failed at 4027157 with
  `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Cancelling…"`,
  `Tests  1 failed | 17 passed (18)`; the same failure returns under the
  named mutant "the stale branch returns at once".
- Task 5 (Home and App, 4027157), tests against 9a40a81:
  `Tests  10 failed | 11 passed (21)`, for example
  `TestingLibraryElementError: Unable to find role="heading" and name "My bookings"`
  and, for the walk,
  `AssertionError: expected [ 'POST /api/login', …(2) ] to deeply equal [ 'POST /api/login', …(4) ]`.
- Final-review fix wave (451263b, ad1c8fe), tests against 76e5c19:
  `Tests  9 failed | 11 passed (20)`, with `Unable to find role="alert"`,
  `expect(element).toHaveFocus()` and
  `expect(element).toHaveAccessibleDescription()`. Named mutants: "always
  focus the heading" fails "leaves focus where the user moved it while the
  Cancel was in flight"; "never move focus" fails the 204 test; each
  `Tests  1 failed | 19 passed (20)`.

**Reviews (full-review: a fresh implementer and a fresh task reviewer per
task, then a whole-branch review).** Critical / Important / Minor:

| Review | C | I | M | Outcome |
|---|--:|--:|--:|---|
| Task 1, flow event | 0 | 0 | 1 | approved |
| Task 2, booking lines | 0 | 0 | 1 | approved |
| Task 3, the list | 0 | 0 | 6 | approved; the render-time ref write moved into a layout effect in Task 4 |
| Task 4, Cancel | 0 | 1 | 8 | the Important: overlapping Cancels re-enabled Cancel on a booking already cancelled; fixed in round 1, re-review clean |
| Task 5, Home and App | 0 | 0 | 3 | approved |
| Final, whole branch | 0 | 1 | 7 | the Important: a Cancel's outcome was not announced and focus fell to the page; fixed with Minors 1 to 6 in one wave, re-review 7 of 7 addressed |

The final reviewer read `hsdd/context/prd-simple-login.v2.md`, which is not
in this phase's context, and reported that the layout matches its Home
wireframe except that the wireframe indents each booking's second line
(see Outstanding).

**Rulings taken during the phase** (each with what it costs if wrong) are
listed in the hand-off to the owner proxy; the ones that shape behavior:
the line's date is `todayIn(booking.start, zone)` (D6 allows no other
conversion); the list on screen is always the last answer of
`GET /api/me/bookings`, never edited by the client; a stale list request
settles with the newest one, so a pressed Cancel stays busy until the list
it shows postdates its DELETE; App validates the zone once with
`asTimeZone`; the Cancel notice is `role="alert"` and focus that falls to
the page after a Cancel moves to the My bookings heading.

## Outstanding

1. **Browser checks not run here.** jsdom applies no stylesheet and keeps
   focus on a disabled button. Not verified: the booking lines and Cancel
   at 360 px; `min-width: 8em` holding `Cancelling…` without moving the
   row; a title's spaces shown through `white-space: pre-wrap`; the notice
   colour; a screen reader announcing the Cancel alert; focus moving to the
   heading after a refusal when the browser drops focus from the disabled
   button. To verify: `npm --prefix backend run db:up`,
   `npm --prefix backend start`, `npm --prefix web run dev`, sign in as
   `budi`, and check Home at 360 px with VoiceOver on.
2. **The PRD v2 Screens wireframe was not in the phase context.** The
   Scope says "Home as PRD v2 Screens draws it" but the context neither
   inlines nor links the PRD, so the layout follows the Scope's row order,
   then My bookings, then Sign out. The final reviewer reports the
   wireframe also indents each booking's second line; that was not
   applied. To verify: the owner compares Home with the wireframe and
   rules on the indent.
3. **Against the real backend.** Not run, by the Isolation strategy: the
   web lane builds against booking-api@v1's fixtures. The integration
   node's browser suite exercises Home against the service.

## Learnings

- The phase Scope cites "PRD v2 Screens" for Home's layout, and web.8 and
  web.9 cite it for Rooms and the form, but hsdd-config inlines no context
  document and the phase context links none, so the implementing session
  works without the wireframe (Outstanding 2). The node's plan should state
  the layout these phases need, or name the wireframe lines to inline.
  spec-updated
- D10 gives Book a success message (`Booked.`) but a Cancel's 204 none:
  the booking just leaves the list, and a screen-reader user hears nothing
  (focus moves to the heading). Whether Cancel gets a success line is an
  owner decision for D10. spec-updated
- The node has no decision on how messages are announced. This phase
  renders the outcome of the user's own action (a Cancel's notice) as
  `role="alert"` and a message on arrival (the D3 line in place of the
  list) as `role="status"`, as Login does; web.8 (Rooms' messages) and
  web.9 (Book's message) will meet the same choice. A line in D3 or D10
  would fix it for the node. spec-updated
- App's `onSessionExpired` clears the stored session whatever the state;
  only MyBookings' drop-after-unmount guard keeps a late 401 from erasing
  a session signed in since. web.8 adds callers (Rooms' list, Book). D1
  could say that an answer arriving after its screen has gone is dropped.
  spec-updated
- The verification template's title separator is an em dash, which this
  project's prose rules ban; this doc uses a hyphen. The template is a
  verbatim copy of hsdd-config's, so the fix belongs upstream in HSDD, not
  in this tree. dropped (upstream template, not this tree)

## Metrics

- Agent wall-clock: about 55 minutes, from the phase switch (58fe0ac,
  03:12) to this doc; implementation commits from 03:20 (b120382) to 03:54
  (ad1c8fe).
- Review wall-clock, full-review: five task reviews, two scoped re-reviews
  and one whole-branch review, about 15 minutes of reviewer time in all
  (the whole-branch review about 8).
- Gate failures before green: 0. The gate ran three times (baseline, end
  of Task 5, after the fix wave), each from a clean install, each exit 0.
- Fix rounds: Task 4, one round; the final review, one wave.
- Subagent tokens, as the harness reported them: about 950k across 13
  subagent runs (5 implementers, one resumed for two fix passes; 8
  reviewers); the controller's own tokens are not reported.
- Product diff (web/src, not tests): +328 -11, of which CSS +69 -1. Tests:
  +510 -11. Together 838 lines added and 22 removed, against the plan's
  estimate of ~385; the tests and the two fix passes account for the
  excess.
- Process artifacts: phase context 747 lines, superpowers derivative 801,
  plan 179, this doc.
- Escaped defects: none known yet.

## Sign-off
- Reviewer / date: Claude for Purbo Mohamad (owner proxy, delegated by the owner before the run), 2026-11-01
- Review tier applied: full-review: per-task reviewers and a final whole-branch reviewer read (Task 4: 1 Important, overlapping Cancels re-enabled a cancelled booking's button, fixed and re-reviewed clean; final: 1 Important, no announcement and lost focus after a Cancel, fixed with role=alert and focus to the heading, all 7 re-reviewed addressed); the gate rerun green by the orchestrator (13 files, 296 tests)
- Disposition of each Outstanding item: browser checks (360 px, Cancel width, screen-reader announcement, focus after a refusal) and running against the real backend: deferred to simple-login.integration.4 (Home browser tests); the wireframe's indented second line: waived (cosmetic)
- Disposition of each Learning: all five dropped; on D10, no success message for a cancel: PRD v2 AC-6.2 says the booking leaves my list, and that is the confirmation

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
