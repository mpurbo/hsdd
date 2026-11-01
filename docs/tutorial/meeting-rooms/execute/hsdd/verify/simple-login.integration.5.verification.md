# Verification: simple-login.integration.5 - Rooms and booking in the browser, clock-change days included

Review tier: full-review. Branch `lane/integration`, from b74eedd (integration.4 signed) to 36fc726 plus this doc. Plan: docs/superpowers/plans/2026-11-01-simple-login.integration.5.md. Evidence: docs/superpowers/evidence/simple-login.integration.5/.

## Commands to run

One-time setup on a fresh checkout (macOS): `colima start`, then

```bash
npm run install:all          # backend/, web/ and the root test tools
```

The gate, from the repository root, with ports 3000 and 5173 free (stop `npm run dev` first):

```bash
npm test                     # backend gate, backend replay, web gate, db:up, dev-runner test, browser suite
TZ=Europe/London npm test    # the same gate with the laptop's zone moved to budi's
```

This phase's tests alone:

```bash
npx playwright test e2e/rooms.spec.ts e2e/clock-change.spec.ts
```

The phase's Verification line and the items earlier phases deferred here, against the developer setup (two terminals):

```bash
npm run dev                                                              # terminal 1
node docs/superpowers/evidence/simple-login.integration.5/browser-check.mjs   # terminal 2, then Ctrl-C terminal 1
```

The check drives the installed Chrome with the browser in America/Los_Angeles, books on dates of its own in `meeting_rooms`, and cancels every booking it made before it exits. No contract is produced by this phase, so there is no contract replay of its own; the gate's proxy replay of the 24 consumed fixtures is unchanged.

## Expected output

- `npm test` exits 0 with: backend gate `Tests 299 passed (299)`, backend replay `Tests 46 passed (46)`, web gate `Tests 387 passed (387)`, dev runner `ℹ tests 3`, `ℹ fail 0`, browser suite `85 passed`. Before this phase the browser suite had 69 tests.
- The 16 new browser tests: e2e/rooms.spec.ts 11 (AC-4.1 once per account, AC-4.2, AC-4.3, AC-5.1 and AC-5.2, AC-5.3, AC-5.4, AC-5.5, AC-5.6, AC-2.3 at a booking call, and the date-rule test), e2e/clock-change.spec.ts 5 (the March starts, the October starts, the 365-day predicate, the March booking, the October booking).
- `TZ=Europe/London npm test` prints the same counts.
- `browser-check.mjs` prints, for budi, 92 starts with no `01:xx` on the next last Sunday of March and 100 on the next of October with `01:00 BST` to `01:45 BST` then `01:00 GMT` to `01:45 GMT`; for the two browsers booking one Thames hour at once, one `Booked.` and one `Thames is already booked from ... .` in the loser's own zone, and one booking stored; then a 204 for each cancelled booking.
- Nothing listens on ports 3000 or 5173 afterwards.

## Observed

2026-11-01, Asia/Jakarta laptop (ayu's zone), Node.js 24.18.0, PostgreSQL 17 through Colima and the standalone `docker-compose`, Chrome through Playwright 1.64.

**Gate, before and after.**

| Run | Commit | Backend | Replay | Web | Dev runner | Browser | Exit |
|-----|--------|--------:|-------:|----:|-----------:|--------:|-----:|
| Clean install, before the phase (gate-baseline.txt) | a5b94d5 | 299 | 46 | 387 | 3 | 69 | 0 |
| Clean install, first attempt (gate-attempt-1-failed.txt) | 987003e | 299 | 46 | 386 of 387 | not run | not run | 1 |
| Clean install (gate.txt) | 987003e | 299 | 46 | 387 | 3 | 84 | 0 |
| `TZ=Europe/London` (gate-tz-london.txt) | 987003e | 299 | 46 | 387 | 3 | 84 | 0 |
| Clean install, after the final fix wave (gate-final.txt) | cbb2590 | 299 | 46 | 387 | 3 | 85 | 0 |
| `TZ=Europe/London` (gate-final-tz-london.txt) | cbb2590 | 299 | 46 | 387 | 3 | 85 | 0 |

The failed attempt stopped in the web gate: `web/src/App.test.tsx` "checks a stored session and shows Home (AC-2.2)" saw 1 authorization header where it expected 2. It did not recur in the four full gates above (the Task 5 implementer also reports six passing web-gate runs, not kept as evidence) (see Outstanding 2 and Learnings 2). This phase changed nothing under `web/`. The logged 500 `terminating connection due to administrator command` in gate.txt comes from the backend's own vitest gate (a `POST /api/bookings` answered 500 while a backend test's server lost its database connection), before its `Tests 299 passed`, not from the browser suite.

**Test-first evidence.** The web app's Rooms screen (simple-login.web.9) and the service (simple-login.backend.7) already deliver every behavior these tests cover, so each failing-test step ran against a named mutant (constraint 1): a Playwright route installed for the run only, its diff recorded in the evidence file, then removed. No `web/` or `backend/` code was read or mutated.

| Task | Mutant | Red (file: what failed) | Green |
|------|--------|-------------------------|-------|
| 1 | M-zone: `GET /api/me` answers `timeZone: "Asia/Kolkata"` | task-1-red-zone.txt: 3 failed; the date input held Asia/Kolkata's date; Kew's lines read 08:30 where 10:00 was expected | task-1-green.txt: 3 passed |
| 1 | M-order: rooms reversed | task-1-red-order.txt: both AC-4.1 tests, rooms received as kew, thames, bromo, merapi | |
| 2 | M-room-zone: every room in the user's zone | task-2-red-room-zone.txt: AC-4.3 at Merapi's lines (no local-times line) | task-2-green.txt: 5 passed |
| 2 | M-fake-201: `POST /api/bookings` answered locally with 201 | task-2-red-fake-201.txt (an incomplete body: failed at `Booked.`); task-2-red-fake-201-complete.txt (a complete Booking: failed at Bromo's lines) | |
| 3 | M-conflict-shift: the 409's conflict one hour later | task-3-red-conflict-shift.txt: AC-5.3 and AC-5.4 at the overlap message | task-3-green.txt: 7 passed, then five separate AC-5.4 runs, each 1 passed |
| 3 | M-fake-201 on both contexts | task-3-red-fake-201.txt: AC-5.3 at the message; AC-5.4 saw two `Booked.` | |
| 4 | M-fake-201 | task-4-red-fake-201.txt: AC-5.5 (no `That time has already started.`), AC-2.3 (`POST /api/bookings` 201 where 401 expected), AC-5.6 | task-4-green.txt: 10 passed |
| 4 | M-title: the title trimmed before the service | task-4-red-title.txt: AC-5.6, the 80-code-point line lost its leading space | |
| 5 | M-zone | task-5-red-zone.txt: the March day offered 96 starts; the October list differed | task-5-green.txt: 5 passed |
| 5 | M-fake-201 | task-5-red-fake-201.txt: both booking tests, Thames held 0 stored bookings | |
| Final fix | the date allocation before the fix, inlined | final-fix-red-dates.txt: for a London today of 2027-01-20, `DATES[1]` expected 2027-03-28, received 2027-11-01 | final-fix-green-dates.txt; final-fix-green-suite.txt: 16 passed, then the whole browser suite 85 passed |

One first draft passed a mutant it should have failed: AC-2.3 under M-fake-201 still reached Login, because the list reload after the faked 201 met the 401. The test now also asserts that the `POST /api/bookings` answer itself is 401.

**The phase's Verification line, in `npm run dev`** (browser-check.out.txt, browser in America/Los_Angeles, neither account's zone, the suite's Asia/Kolkata nor the laptop's Asia/Jakarta):

- budi, Rooms on 2027-03-28: 92 starts, none `01:xx`, `00:45` followed by `02:00`.
- budi, Rooms on 2027-10-31: 100 starts, `01:00 BST`, `01:15 BST`, `01:30 BST`, `01:45 BST`, `01:00 GMT`, `01:15 GMT`, `01:30 GMT`, `01:45 GMT` (budi-rooms-october-1280.png).
- Two browsers, budi and ayu, booking Thames 12:00 to 13:00 London (19:00 to 20:00 Jakarta) on 2027-01-31 at once: budi saw `Booked.`, ayu saw `Thames is already booked from 19:00 to 20:00.`, and Thames held one booking, `Race budi` (budi-rooms-race-1280.png, ayu-rooms-race-1280.png).
- `npm test` whatever the laptop's zone: green on the Asia/Jakarta laptop and under `TZ=Europe/London` (table above).
- The three bookings the check made were cancelled (204 each); `meeting_rooms` keeps none of them.

**Items earlier phases deferred here.**

- simple-login.web.6 O1 (en-GB output in Chromium) and O2 (the browser's ambient zone): the suite asserts, in Chrome running in Asia/Kolkata, strings the web app formats with `Intl` in the browser: `Wed 13 Jan`-style dates, `23:00 to Fri 6 Nov 02:00`-style cross-date times, `01:30 BST to 01:30 GMT`, `Sun 28 Mar  00:30 to 02:30` on Home. The browser check in America/Los_Angeles shows the same times as the suite. Verified.
- simple-login.web.8 (Rooms against PRD v2's Screens wireframe and the real backend): budi-rooms-wireframe-1280.png, with the wireframe's own content booked (`Sprint planning` in Merapi, 09:00 to 10:00 Jakarta; `Design review` in Thames, 10:00 to 11:00 London). Same as the wireframe: `Rooms on` with the date input and `Home`; the four rooms as `Merapi · Jakarta · 8 seats` and so on, in order; `02:00 to 03:00  Sprint planning` then `(09:00 to 10:00 in Jakarta)`; `10:00 to 11:00  Design review` with no local-times line for a London room seen from London; `(no bookings)`; the form `Book:` with `room`, `start`, `end`, `title`, `Book` and the message after it. Different, none against an acceptance criterion: the date input shows the browser's own date format (`2027/01/30`), not the wireframe's `2026-11-05`; booking lines are not indented under their room (the room heading is bold and the local-times line grey instead); the message sits under the form, not beside `Book`. At 360 px wide (budi-rooms-360.png) the controls wrap within the width. Verified against the real backend.
- simple-login.web.9 (the clock-change days in a browser): e2e/clock-change.spec.ts and the browser check above. Verified.
- simple-login.integration.4 (the README's coverage sentence, which said the suite does not drive Home's bookings): README.md's "It covers" list now names, in the browser, AC-1.1 to AC-1.3, AC-2.1 to AC-2.5, AC-3.1, AC-4.1 to AC-4.4, AC-5.1 to AC-5.6, AC-6.1, AC-6.2 and AC-2.3 at a booking call, plus e2e/time.spec.ts; the layout row names `rooms.ts` and `time.ts`. Each claim was checked against the spec files' test titles by the Task 5 reviewer and the final reviewer.

**Dates the tests used on this run** (London today 2026-11-01): home.spec.ts 2026-12-31 to 2027-01-05; rooms.spec.ts 2027-01-06 to 2027-01-13; clock-change.spec.ts 2027-03-28 and 2027-10-31 (both bookable: the October booking starts 364 days ahead).

**Reviews** (superpowers:subagent-driven-development: a fresh implementer and a fresh task reviewer per task, then a final whole-branch review, one fix wave and its scoped re-review):

| Review | Model | Verdict | Critical | Important | Minor |
|--------|-------|---------|---------:|----------:|------:|
| Task 1 (f35740b) | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 2 (4134f5b) | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 3 (6e92659, 15de563) | sonnet | spec compliant, Approved | 0 | 0 | 4 |
| Task 4 (808888d) | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 5 (987003e, 6eea2b8) | sonnet | spec compliant, Approved | 0 | 0 | 5 |
| Final, whole branch b74eedd..6eea2b8 | opus | With fixes | 0 | 1 | 5 |
| Fix wave cbb2590, scoped re-review | sonnet | F1 to F7 addressed, no new breakage | 0 | 0 | 1 cosmetic |

Before Task 3's review, the controller reverted its implementer's change that shaped AC-5.4 around Playwright's repeat index (15de563). The final review's Important finding: on one London date a year (2027-01-20, 2028-01-19, 2029-01-17, 2030-01-23, 2031-01-22) rooms.spec's first date was the Saturday before the March change, so AC-4.2's 16:00 to 19:00 London Thames booking fell inside ayu's exact Thames view in clock-change.spec, hidden only by file order. Fixed in cbb2590: rooms.spec allocates its dates so that `DATES[1]` is always `DATES[0]`'s next date, pinned by the date-rule test. The same wave fixed five Minors (date-proving polls before `(no bookings)` reads, year-independent pins made unconditional, `exact: true` on every `Booked.` and `Book` lookup, the README's `time.ts` lists, a readable title assertion) and one table's padding; the final reviewer judged the remaining deferred Minors fine to keep.

**Rulings the phase context did not settle** (each with its cost if wrong):

1. Red steps run against named network mutants, never against `web/` or `backend/` code nor the tree before simple-login.web.8. Cost: a fault no mutant models would go unnoticed.
2. A third file, e2e/rooms.ts, beside the Scope's two: both spec files drive Rooms and a spec cannot import a spec. Cost: one small file over the size estimate.
3. AC-4.1 holds the browser's clock at an instant where the user's date differs from Asia/Kolkata's (17:45 UTC for ayu, 20:00 UTC for budi). Cost: none known.
4. The derivative has no constraint 11: conventions.md names only optional stack skills, none for TypeScript. Cost: one discipline line missing from every task.
5. This doc's title uses ` - ` where the template has an em dash (the owner's prose rule). Cost: one line of template drift.
6. PRD v2 (hsdd/context/prd-simple-login.v2.md: Screens, US-4, US-5) was read though the context's Links do not name it, because the Scope finds controls by PRD v2 Screens' words and web.8 deferred the wireframe comparison here. Cost: none.
7. M-fake-201 answers with a complete Booking (`roomName`, a UUID), since the web app shows no `Booked.` for a malformed 201. Cost: none.
8. AC-5.4's flake check is five separate runs, each on a fresh database, not `--repeat-each` (repeats share one database), and the test keeps the plan's fixed values. Cost: about a minute.
9. AC-2.3 also asserts that the `POST /api/bookings` answer is 401. Cost: the test pins booking-api@v1 order 1 as well.
10. The October booking from `01:30 BST` to `01:30 GMT` lasts one elapsed hour, not the plan's two. Cost: none.
11. The web gate's one-off failure is recorded, not fixed (this node owns nothing under `web/`). Cost: the root `npm test` can stay intermittently red until the web owner looks.
12. rooms.spec's dates keep `DATES[1]` as `DATES[0]`'s next date (the final review's option b). Cost: on a few days a year AC-4.2 runs on November dates.
13. Commits carry `Co-Authored-By: Claude Opus 5.5`, the orchestrator's line, subagents' commits included. Cost: none.

## Outstanding

1. The clock-change skip branch (the farther day more than 365 days after the real clock: annotate `booking skipped`, check that day's starts and Rooms lines only) has not run: on 2026-11-01 both days are bookable. The final reviewer's probe puts the next runs in late March 2029 and late October 2031. Its predicate is pinned on both sides of the boundary by the `bookable` test. To verify: run `npx playwright test e2e/clock-change.spec.ts` on such a day, or with the service's clock set forward, which this node cannot do (the service runs on the real clock).
2. `web/src/App.test.tsx` "checks a stored session and shows Home (AC-2.2)" failed once (gate-attempt-1-failed.txt) and passed in the four full gates after it. Outside this node. To verify: the web owner runs `npm --prefix web run gate` repeatedly and fixes the race.
3. A fresh clone: the gates ran after removing every `node_modules` in this worktree, not from a fresh clone, and on the kept PostgreSQL volume (as instructed). To verify: the tutorial's fresh-clone run.
4. The laptop's own time-zone setting was not changed: `TZ=Europe/London` for the whole gate and America/Los_Angeles for the browser check stand in for it. To verify: change macOS's zone and run `npm test`.

## Learnings

- After a refused booking (409) Rooms keeps the list it had: in the AC-5.4 browser check the loser's screen says `Thames is already booked from 19:00 to 20:00.` while Thames still shows `(no bookings)` (ayu-rooms-race-1280.png). PRD v2 and booking-api@v1 are silent; this phase's AC-5.4 test checks the winner's page and the stored booking. spec-updated (proposed: simple-login.web's plan decides whether Rooms reloads the date after a refusal; no change in this node).
- The web gate's `App.test.tsx` AC-2.2 test is flaky (one failure, an authorization-header count, then four passes), so the root `npm test` can fail on code no recent phase touched. spec-updated (proposed: a fix in simple-login.web's next phase).
- home.spec.ts's date rule ("continue from the day after the last") does not cover a test whose Jakarta view spills into the next London date; on one day a year that let two files meet on Thames, hidden by file order. rooms.spec.ts now keeps a spilling test's next date as its own and pins it. dropped (stated in rooms.spec.ts's header and pinned by its date-rule test; a later file continues after rooms.spec's last date).
- The phase context's Links name no input document, yet the Scope finds controls by "the words PRD v2 Screens shows", and simple-login.web.8 deferred a comparison with PRD v2's wireframe to this phase; the PRD was read under a ruling. dropped (an hsdd-config finding for the run report; the tree needs no change).
- hsdd/templates/verification.md titles a doc with an em dash, which the owner's prose rule bans in every file written. dropped (a template finding for the run report; this doc uses ` - `).

## Metrics

- Agent wall-clock: about 62 minutes from the phase switch commit (a5b94d5, 07:49 WIB) to the browser checks and final gate commit (36fc726, 08:51 WIB), including the baseline and two final gates.
- Review wall-clock (full-review): task reviews 35 s, 36 s, 37 s, 56 s and 69 s; the final whole-branch review about 15 minutes; the fix-wave re-review 32 s.
- Gate failures before green: one (the web flake above); none from this phase's code.
- Subagent tokens as the harness reported them: implementers about 450k (six dispatches), reviewers about 604k (seven dispatches, the final review 242k of them); the controlling session's own tokens are not reported.
- Product diff vs process artifacts: 624 added lines in e2e/ and README.md against about 4,500 in the phase context, plan, evidence text and this doc (screenshots not counted).
- Escaped defects: none known.

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
