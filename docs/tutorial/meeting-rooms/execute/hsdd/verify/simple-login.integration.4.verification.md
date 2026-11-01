# Verification: simple-login.integration.4 - Home in the browser: time zone, my bookings, cancelling

Review tier spot-check. Branch `lane/integration`, spec d5bf470 (the phase
context's stamp), implementation head 990012d; this doc is the commit after it. Every evidence file named
below is in `docs/superpowers/evidence/simple-login.integration.4/`.

## Commands to run

From the repository root, with Colima (or Docker) running and nothing on
ports 3000 and 5173:

```bash
rm -rf node_modules backend/node_modules web/node_modules
npm run install:all
npm test                                   # the gate
npx playwright test e2e/time.spec.ts e2e/home.spec.ts e2e/login.spec.ts   # this phase's specs alone
```

The browser checks (phase Verification line and the items deferred here),
against `npm run dev` on the developer database `meeting_rooms`:

```bash
npm run dev &                              # wait for :3000 and :5173
node docs/superpowers/evidence/simple-login.integration.4/browser-check.mjs
kill -INT %1                               # dev.mjs stops both servers
```

The script books three bookings for budi on a London date wholly in GMT at
least 90 days ahead, and cancels every booking it made before it exits.

## Expected output

- `npm test` exits 0: backend gate 299 tests, backend replay 46, web gate
  387, `scripts/*.test.mjs` 3, browser suite 69 (49 before this phase, plus
  13 in e2e/time.spec.ts and 7 new in e2e/home.spec.ts).
- The browser suite leaves nothing on ports 3000 and 5173.
- browser-check.mjs prints eight `PASS` lines and no `FAIL`.

What to eyeball: budi-home-360.png (Home at 360 px, each booking's two lines
and its Cancel), budi-home-360-cancelling.png (`Cancelling…` in the same
box), budi-home-360-refused.png (the notice above the list),
ayu-login-home-1280.png.

## Observed

2026-11-01, Node.js 24.18.0, PostgreSQL 17 in Colima, the installed Chrome.

**Gate.** Before any change, on d5bf470 as installed (gate-baseline.txt):
backend 299, replay 46, web 387, scripts 3, browser 49, exit 0. After a clean
install of the root, backend/ and web/ (install.txt), on 34f17ce
(gate-run.txt): backend 299, replay 46, web 387, scripts 3, browser 68, exit 0.
After the final review's fix, on the same install (gate-run-after-review.txt,
990012d): backend 299, replay 46, web 387, scripts 3, browser 69, exit 0.
`lsof` showed nothing listening on 3000 or 5173 after each run.

**Reds.** e2e/time.ts is new: its specs failed on the missing module
(task-1-red.txt) and on the missing exports (task-2-red.txt), then passed, 7
and 12 (task-1-green.txt, task-2-green.txt). The Home and Login behavior was
already delivered by merged web phases (web.9 and earlier), so each new test's
red ran against a named mutant at the network boundary, a temporary
`page.route` block in the spec that was never committed; each evidence file
starts with the mutant's code:

| Mutant | Evidence | What failed |
|--------|----------|-------------|
| A: `/api/me` answers `timeZone: "Asia/Kolkata"`, the browser's zone | task-3-red-zone-mutant.txt | AC-2.1 and AC-2.5 zone names (`Asia/Jakarta` not found); both AC-2.5 booking lines (Home showed `Thu 31 Dec  15:30 to 16:30`, Kolkata time, for ayu's `17:00 to 18:00`) |
| B: `/api/login` answers 3.5 s late | task-3-red-slow-signin.txt | the shipped AC-1.1 (`Received: 3873`, `Expected: < 3000`); the new AC-1.1 passes under the same mutant |
| C: my bookings arrive reversed | task-4-red-mutant-C.txt | AC-6.1 order (`Order 3` before `Order 1`): the web app shows the order the service returns |
| D: a stray booking titled `Ayu not budi` joins my bookings | task-4-red-mutant-D.txt | AC-6.1 "none of ayu's", and the empty state (`(no bookings)` not shown) |
| E: every DELETE answered 422 `BOOKING_STARTED` before the service | task-4-red-mutant-E.txt | AC-6.2 (the cancelled line stays) |
| F: my bookings answers an empty list to the token signed in after the restart | task-5-red-lost-at-restart.txt | Success in the browser, at the line after signing in again |

Each spec then passed against the real service and web app
(task-3-green.txt 13, task-4-green.txt 12, task-5-green.txt 13 in
home.spec.ts).

**Dates.** home.spec.ts books on London dates wholly in GMT, the first at
least 60 days after today in London (this run: 31 Dec 2026, then 1 to 5
Jan 2027), never one of the UTC days 39 to 47 that rig.spec.ts and
success.spec.ts book. e2e/time.ts pins every example the Scope names
(e2e/time.spec.ts), all under `TZ=Asia/Kolkata`.

**Browser checks against `npm run dev`** (browser-check.mjs,
browser-check.out.json, browser-check.out.txt; date booked 30 Jan 2027):

| Check | Result |
|-------|--------|
| integration.3, deferred: ayu signs in on the Login screen of `npm run dev` | Home shows `Hello, Ayu Lestari` and `Asia/Jakarta` (ayu-login-home-1280.png) |
| Phase Verification: budi's Home shows `Europe/London` and his bookings soonest first in London time | three bookings made out of order show 08:00, 11:00, 15:00 (budi-home-1280.png) |
| Phase Verification: changing the time zone does not move a time on screen | the My bookings text is identical with the browser in Asia/Kolkata, America/New_York and Pacific/Auckland |
| Phase Verification: `Cancel` removes one at once | the line left without a reload once the DELETE answered |
| web.7, deferred: Home at 360 px | `scrollWidth` 360 = `clientWidth` 360; every Cancel box from x 199 to 319 (budi-home-360.png) |
| web.7, deferred: the Cancel button's width | 120 px wide as `Cancel` and as `Cancelling…` (disabled), and neither the button nor its line moved (budi-home-360-cancelling.png) |
| web.7, deferred: the Cancel notice being announced | a refused Cancel (the booking cancelled through the API first) shows `That booking was already cancelled.` in an element with `role="alert"` (budi-home-360-refused.png) |
| web.7, deferred: focus after a refusal | focus moved to the `My bookings` heading (`H2`, `tabindex="-1"`), not the body |
| cleanup | no booking the script made is left in `meeting_rooms` |

`npm run dev` was stopped with SIGINT to scripts/dev.mjs; ports 3000 and 5173
were free a second later.

**Review.** One fresh whole-branch reviewer on d5bf470..b55c882: Critical 0,
Important 1, Minor 7. Important 1: home.spec.ts chose its dates with a
private start (today + 60 days), and any later file starting from its own
offset gets the same first winter dates whenever both starts fall in British
summer time (about 224 run days of 2027 for the offsets measured). Fixed in
990012d: e2e/time.ts exports `britishWinterDays(from, count)`, home.spec.ts
uses it, and its header says a later file continues from the day after
home.spec's last date. Red on the missing export
(final-fix-red-winter-days.txt), green with home.spec.ts
(final-fix-green-winter-days.txt, 26 passed), then the whole gate
(gate-run-after-review.txt). The seven Minors are left as they are: the
Cancel locator would not catch two identical lines (none exist); AC-6.2's
rebooking relies on the web app removing the line after the 204; the time.spec
header overclaims for zones west of UTC; README.md's coverage sentence (the
first Learning below); browser-check.mjs records one check unconditionally and
books before its `try`; `timeLabel`'s quarter-hour precondition is
undocumented; expected Home lines come from the service's own reply, except
AC-2.5's literal times.

## Outstanding

1. **Screen reader.** The Cancel notice's `role="alert"` was read from the
   accessibility tree, not heard: VoiceOver was not run. To verify: macOS
   VoiceOver on, `npm run dev`, as budi cancel a booking already cancelled
   elsewhere, and hear the notice.
2. **The laptop's time zone.** "Changing the laptop's time zone" was checked
   by changing the browser's zone (three `timezoneId`s); the laptop's own
   zone, and so the service's and Vite's, stayed as it was. The service works
   in instants (ADR-002 Decision 4), so its zone reaches no response. To
   verify: change the macOS time zone, restart `npm run dev`, and compare
   budi's Home.
3. **A fresh clone** was approximated by a clean install in this worktree,
   with Colima already running and only the standalone `docker-compose` on
   this laptop, as in simple-login.integration.3.

## Learnings

- README.md's test section still says the browser suite "does not drive
  booking, Home's bookings or Rooms", which this phase makes wrong for Home.
  The phase Scope names e2e/time.ts, e2e/time.spec.ts, e2e/home.spec.ts and
  e2e/login.spec.ts and not README.md (simple-login.integration.3's Scope
  named it), so the narrowest reading left it. spec-updated (proposed: the
  README sentence is rewritten when simple-login.integration.5 lands, or in
  its Scope).
- ADR-002 Decision 7 says a time off its line's date carries its own date,
  but not which line date governs a room's local times on the Rooms screen
  when the room is in another zone. e2e/time.ts `bookingTimes` uses the same
  line date as the user's times; the Scope's examples are all same-date.
  dropped (simple-login.integration.5 drives the Rooms line against the web
  app and meets any mismatch there).
- The AC-6.1 empty-state test cancels every booking budi holds, since Home's
  list is account-wide. Later files (simple-login.integration.5) must not
  rely on a booking of budi's made outside their own test. dropped (stated
  in home.spec.ts's header, and Scope (g) of simple-login.integration.3
  already requires it).

## Metrics

- Agent wall-clock: about 25 minutes from the phase switch commit (f2eb5ef)
  to the browser checks (b55c882); the final review took about 11 minutes,
  and its fix and gate about 5.
- Review: spot-check, one fresh whole-branch reviewer.
- Gate failures before green: none.
- Product diff: 4 files, +454 / -4 lines (e2e/time.ts 201 with comments,
  e2e/time.spec.ts 107, e2e/home.spec.ts +145, e2e/login.spec.ts +1/-4),
  above the plan's ~250. Process artifacts: the two context files and the
  plan, +1641; evidence, +1638 lines of text plus five PNGs.

## Sign-off
- Reviewer / date: Claude for Purbo Mohamad (owner proxy, delegated by the owner before the run), 2026-11-01
- Review tier applied: spot-check: the diff read by file list (e2e/time.ts, its spec, home.spec.ts, evidence), the six named network mutants' red outputs in docs/superpowers/evidence/simple-login.integration.4/ read, the fresh reviewer's report read (1 Important, a seasonal date collision with integration.5's tests, fixed test-first with a shared winter-date helper), the root npm test rerun green by the orchestrator (browser 69)
- Disposition of each Outstanding item: the README's coverage sentence (now false): deferred to simple-login.integration.5, which completes the browser coverage; VoiceOver and the OS time-zone change: waived (the alert role is checked in the accessibility tree; three browser zones give identical text); a fresh clone: deferred to the tutorial's fresh-clone run
- Disposition of each Learning: all dropped for this tree; that deferred items from earlier sign-offs never reach a later phase's context is carried to the checkpoint as an HSDD finding

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
