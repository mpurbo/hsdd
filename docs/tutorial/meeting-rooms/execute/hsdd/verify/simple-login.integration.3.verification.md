# Verification: simple-login.integration.3 - PostgreSQL rig, booking replay and the Success tests

Review tier full-review. Branch `lane/integration`, spec 9a1e469, implementation
head 203fce9; this doc and Task 7's evidence are the commit after it. Every
evidence file named below is in `docs/superpowers/evidence/simple-login.integration.3/`.

## Commands to run

From the root of a clone of `lane/integration`, in bash (the evidence lines use
`${PIPESTATUS[0]}`).

One-time setup:

```bash
colima start          # macOS; any Docker with Compose works (docker compose or the standalone docker-compose)
npm run install:all   # backend/, web/, then the root (@playwright/test, pg)
```

This run stood in for a fresh clone with
`rm -rf node_modules backend/node_modules web/node_modules && npm run install:all`.
The browser suite drives the installed Google Chrome; without it,
`npx playwright install chromium` and `PW_CHANNEL=chromium`.

The gate, twice in a row:

```bash
npm test
npm test
```

The phase's Verification line, scripted. Ports 3000 and 5173 must be free
(`npm run dev` stopped):

```bash
node docs/superpowers/evidence/simple-login.integration.3/verify-dev.mjs book
npm test
node docs/superpowers/evidence/simple-login.integration.3/verify-dev.mjs check <the id on book's "BOOKED id" line>
lsof -nP -iTCP:3000 -sTCP:LISTEN; lsof -nP -iTCP:5173 -sTCP:LISTEN   # both print nothing
```

`verify-dev.mjs` is a Node module with no dependencies. Each mode starts
`npm run dev` in a process group of its own, waits for 127.0.0.1:3000 and
localhost:5173, and talks only to the web app's proxy at
`http://localhost:5173/api`, as the browser does. `book` signs in as `ayu`,
reads `/api/me`, and books Kew on the UTC date 48 days after today, 06:00 to
07:00 UTC, titled `Dev check`, then prints the booking. `check` signs in as
`ayu`, finds that id in `GET /api/me/bookings`, cancels it (204) and confirms it
is no longer listed. Each mode then sends SIGTERM to the whole group (as
`scripts/dev.mjs` stops its children) and waits for both ports to close.
Instants come from UTC arithmetic on epoch milliseconds; nothing runs SQL
against `meeting_rooms`. The day offset 48 is past every day the browser suite books
(39 to 47), and the suite books on `meeting_rooms_e2e` in any case.

An exported developer zone, at suite level:

```bash
TZ=Asia/Jakarta npm run e2e
```

Each suite on its own, in the order `npm test` runs them:

```bash
npm --prefix backend run gate
npm --prefix backend run replay
npm --prefix web run gate
npm --prefix backend run db:up && node --test "scripts/*.test.mjs"
npm run e2e        # one file: npx playwright test e2e/success.spec.ts
```

Task 7's evidence files were captured as
`FORCE_COLOR=0 <command> 2>&1 | tee <file>; echo "exit ${PIPESTATUS[0]}" >> <file>`.

The phase produces no contract, so there is no schema validation. The contract
checks in the gate are the producer's replay (`npm --prefix backend run replay`,
46 cases) and the proxy replay (`e2e/proxy-replay.spec.ts`, 24 exact fixtures
sent through the web dev server to the real service).

## Expected output

`npm test` exits 0 and prints, in this order:

| Suite | Command | Passing looks like |
|-------|---------|--------------------|
| backend gate | `npm --prefix backend run gate` | `Test Files 19 passed (19)`, `Tests 299 passed (299)` |
| backend replay | `npm --prefix backend run replay` | `Test Files 1 passed (1)`, `Tests 46 passed (46)` |
| web gate | `npm --prefix web run gate` | `Test Files 13 passed (13)`, `Tests 296 passed (296)`, then Vite's `✓ built in` line |
| scripts | `node --test "scripts/*.test.mjs"` | `tests 3`, `pass 3`, `fail 0` |
| browser suite | `npm run e2e` | `Running 49 tests using 1 worker`, then `49 passed` |

The browser suite per file:

| File | Tests | What |
|------|------:|------|
| `e2e/home.spec.ts` | 6 | shipped, unchanged |
| `e2e/login.spec.ts` | 4 | shipped, unchanged |
| `e2e/proxy-replay.spec.ts` | 25 | the count check (24 = 4 auth-api@v1 + 5 profile-api@v2 + 15 booking-api@v1), then one test per fixture |
| `e2e/rig.spec.ts` | 6 | the zone in the worker and the browser, `api.ts` instants, the `api.ts` round trip, the sentinel, two `startService` failure modes |
| `e2e/success.spec.ts` | 8 | five rounds of 20 simultaneous attempts, the restart, AC-5.5, AC-6.3 |

Five lines, one per round, each just before that round's `✓` line:
`round N: ayu won, booking <uuid>` or `round N: budi won, booking <uuid>`, for N
1 to 5. Which account wins changes from run to run; one winner per round is the
property.

Every run starts on a freshly created `meeting_rooms_e2e`: the sentinel test
(`a run starts with no bookings`) and every round answer 201 even when two runs
fall on the same UTC date and book the same slots.

The backend gate's log also carries two `57P01 terminating connection due to
administrator command` lines and one level-50 line with a 500. They come from
the backend's own tests, are in gate-baseline.txt too, and the gate passes with
them.

`verify-dev.mjs book` prints `POST http://localhost:5173/api/login as ayu -> 200`,
`GET http://localhost:5173/api/me -> 200, username "ayu"`, the
`POST http://localhost:5173/api/bookings` line ending `-> 201`, the booking,
`BOOKED id <uuid>`, `# 127.0.0.1:3000 and localhost:5173 are closed`,
`# verify-dev.mjs book: OK`, exit 0. `check <uuid>` prints the same two sign-in
lines, the `Dev check` booking with that id, `KEPT id <uuid>: the same id as
booked`, `DELETE ... -> 204`, `still listed: false`, the ports closed,
`# verify-dev.mjs check: OK`, exit 0.

`TZ=Asia/Jakarta npm run e2e`: `49 passed`, exit 0, the zone test included,
because `playwright.config.ts` sets `TZ` to Asia/Kolkata over the exported zone
before the runner starts a worker or the service.

Task 7 adds these evidence files: install.txt, gate-run-1.txt, gate-run-2.txt,
verify-dev.mjs, verify-dev.txt, e2e-tz-jakarta.txt.

## Observed

2026-11-01. Task 7's runs fall on the UTC date 2026-10-31, as the committed
stamps show: `verify-dev.mjs book` at 2026-10-31T23:56:40Z and `check` at
2026-10-31T23:57:41Z (verify-dev.txt), with gate run 2 between them; gate run
1's Vitest `Start at 05:25:03` (gate-run-1.txt) is a little over two minutes
before gate run 2's `Start at 05:27:12` (gate-run-2.txt), both on the
Asia/Kolkata clock the gate sets; the zone run's cleanup is stamped
2026-10-31T23:58:33Z (e2e-tz-jakarta.txt). So gate run 1, gate run 2 and the
zone run booked the same per-day slots, the day offsets of the header tables in
`e2e/rig.spec.ts` and `e2e/success.spec.ts`. The dev check's day (+48) is
2026-12-18 (verify-dev.txt). Node 24.18.

### Baseline

Before the phase, clean install, tree 9a1e469 plus the context commit
(gate-baseline.txt): backend gate 299 tests (19 files); backend replay 46; web
gate 296 (13 files); scripts (`node --test`) 3; browser suite 20 (home 6, login
4, proxy replay 10). Exit 0.

### Red and green per task

Constraint 1 lets a test of behavior that a merged dependency phase delivered
fail first against the tree before that phase (a commit-before red, run with
`backend/` swapped in the working tree only, then restored and checked clean)
or against a named mutant. Each red below says which kind it is.

Task 1, the run's zone (8d7c464):
- Red: task-1-red.txt, with `TZ=UTC` exported: `Expected: "Asia/Kolkata"`,
  `Received: "UTC"`, 1 failed.
- task-1-red-alias.txt is explanatory, not the red: ICU on Node 24.18 reports
  Asia/Kolkata as "Asia/Calcutta", so the literal comparison of
  `resolvedOptions().timeZone` failed even with the zone set. The zone tests
  now compare with the runtime's own canonical name; `TZ` itself stays the
  literal.
- Green: task-1-green.txt, `TZ=UTC` exported, 1 passed.

Task 2, `e2e/api.ts`, sign-in and the four booking-api@v1 calls (a7380ff):
- Red: task-2-red.txt, `Cannot find module .../e2e/api.ts`.
- Green: task-2-green.txt, 3 passed.

Task 3, a database of its own per run and the service in a process group
(443af48):
- Red, the sentinel against the shipped rig, which runs the service on
  `meeting_rooms`: task-3-red-sentinel-run1.txt passes (1 passed), and
  task-3-red-sentinel-run2.txt fails with 409 `BOOKING_CONFLICT`, the first
  run's booking still there.
- Red, the start: task-3-red-start.txt, `does not provide an export named
  'SERVICE_PORT'`.
- Green: task-3-green-run1.txt and task-3-green-run2.txt, 6 passed each, with
  `db:up` before the tests; task-3-green-shipped.txt, the shipped login, home
  and proxy-replay specs, 20 passed.
- task-3-cleanup.txt: the red run's sentinel deleted from `meeting_rooms`
  through the API, 204.

Task 4, the replay of 15 booking-api@v1 fixtures through the dev proxy
(3e823d2):
- Red, the count: task-4-red-count.txt, `Received length: 9`, expected 24.
- Green: task-4-green.txt, 25 passed.
- Commit-before red: task-4-red-before-booking-api.txt, `backend/` swapped to
  b5d93b6 (Merge simple-login.backend.4, the lane before booking-api): 15
  failed, `Expected: 400`, `Received: 404`. This file has no header naming the
  sha. The commands were `git restore --source=b5d93b6 --worktree -- backend`;
  `npm --prefix backend install`;
  `npx playwright test e2e/proxy-replay.spec.ts -g "booking-api/"`;
  `git restore --worktree -- backend`; `npm --prefix backend install`; and
  `git status --short backend` printed nothing.
- task-4-green-after-restore.txt: 25 passed on the restored backend.

Task 5, 20 simultaneous attempts in five rounds (0e495c4):
- Commit-before red: task-5-red-before-booking-api.txt (b5d93b6): 5 failed,
  404.
- Green: task-5-green.txt, 5 passed; budi won all five rounds in that run. A
  later full-suite run, task-6-green.txt, gave round 5 to ayu.
- The reds show the route's absence only. No committed run shows the test
  catching a non-atomic check: a mutant on the rig's side cannot make the
  backend racy.

Task 6, a restart keeps every booking, AC-5.5, AC-6.3, README for PRD v2
(28e51bf, 9c04b71):
- Commit-before red: task-6-red-restart-before-backend-7.txt (25ed989, the
  lane before simple-login.backend.7): `POST /api/bookings` answers 404, so the
  test fails at its first booking, before the restart (`Expected: 201`,
  `Received: 404`). Booking routes arrived with backend.7, contrary to the
  plan's premise that the earlier lane kept bookings in memory.
- Named-mutant red: task-6-red-restart-mutant.txt, the mutant "restart onto
  an empty database" (`restart()` drops and re-creates `meeting_rooms_e2e`
  between stop and start). The old-token 401 checks pass, then the test fails
  at the lists: bookings lost, 1 failed. Mutant reverted, then 8 passed in the
  same file.
- Commit-before red: task-6-red-before-booking-api.txt (b5d93b6): AC-5.5 and
  AC-6.3, 2 failed, 404.
- Green: task-6-green.txt, 8 passed.

Final fix wave (203fce9):
- Red: final-fix-red-thames.txt. A temporary `e2e/aa-thames.spec.ts` books
  Thames 00:30 to 01:30 UTC on days +40, +41 and +46, as
  simple-login.integration.5 would on a clock-change day: 3 failed, 12 passed.
- Green: final-fix-green-thames.txt, 15 passed, the temporary file removed;
  final-fix-green-suite.txt, the whole browser suite, 49 passed.

### Reviews

superpowers:subagent-driven-development: a fresh implementer and a fresh task
reviewer per task, then a final whole-branch review.

| Review | Reviewer | Verdict | Critical | Important | Minor |
|--------|----------|---------|---------:|----------:|------:|
| Task 1 | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 2 | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 3 | opus | spec compliant, Approved | 0 | 0 | 9 |
| Task 4 | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 5 | sonnet | spec compliant, Approved | 0 | 0 | 3 |
| Task 6 | sonnet | spec compliant, Approved | 0 | 0 | 2 |
| Final, whole branch 9a1e469..9c04b71 | opus | With fixes | 0 | 2 | 5 |
| Fix wave, scoped re-review | sonnet | F1 to F6 addressed, no new breakage | 0 | 0 | 2 nits |

For Task 6 the controller asked for the named-mutant restart red before the
review (9c04b71).

The final review triaged the 23 deferred task minors: 2 to fix before merge
(the in-browser zone check; the README "runner" wording), the rest can stay.
Its findings and what was fixed in 203fce9:
- Important 1: the rooms-view assertions read Thames, which
  simple-login.integration.5 books on London's clock-change days; with one
  worker and files in name order, the gate would fail on about 14 days a year
  once integration.5 lands. Fixed: the tests assert the room order and only
  the rooms they own; the restart test filters to its own three ids.
- Important 2: README claimed the browser suite walks every PRD acceptance
  criterion. Fixed: README names what is covered in the browser, at the
  service and by the replay.
- Minors fixed: window ends derived from the day (`nextDay` in `e2e/api.ts`,
  days computed once per file); Colima before `npm test` in README; the pgrep
  pattern in new evidence; the in-browser zone check (the browser's own
  canonical name, and `getHours()` 5).

The scoped re-review left 2 nits: `utcDay(n, TODAY)` reads oddly; a README line
break.

Deferred minors left as they are, per the final triage: `startService` has no
child `'error'` listener; the port poll runs on for up to 15 s after an early
exit; a service crash after it listened is silent until the next request; the
output tail is taken on `'exit'`, not `'close'`; no SIGKILL escalation (as in
`scripts/dev.mjs`); the win32 `npm.cmd` branch does not work (as in
`scripts/dev.mjs`); the early-exit test assumes port 3999 is free; `api.ts`
`utcDay` accepts a non-integer and `deleteBooking` does not encode the id; the
`PASSWORDS` cast in the proxy replay; the `loadExactFixtures` slug string; the
status sort in `success.spec.ts` has no comparator and its array type evolves;
the Task 2 round trip leaves its booking if it fails midway.

### Gate runs 1 and 2 (Task 7)

Run 1 followed the clean install (install.txt: three installs, each
`found 0 vulnerabilities`, exit 0; npm warns that fsevents@2.3.3 has install
scripts not covered by allowScripts, a warning only). Run 2 followed
`verify-dev.mjs book`, with no reinstall.

| Suite | Run 1 (gate-run-1.txt) | Run 2 (gate-run-2.txt) |
|-------|------------------------|------------------------|
| backend gate | 19 files, 299 passed | 19 files, 299 passed |
| backend replay | 1 file, 46 passed | 1 file, 46 passed |
| web gate | 13 files, 296 passed; build ✓ | 13 files, 296 passed; build ✓ |
| scripts | 3 tests, 3 pass, 0 fail | 3 tests, 3 pass, 0 fail |
| browser suite | 49 passed (11.6s) | 49 passed (10.7s) |
| per file: home, login, proxy-replay, rig, success | 6, 4, 25, 6, 8 | 6, 4, 25, 6, 8 |
| exit | 0 | 0 |
| round 1 to 5 winners | budi, ayu, budi, budi, budi | ayu, budi, budi, budi, ayu |

Each round printed one `round N: ... won, booking <uuid>` line, in both runs.

A freshly created `meeting_rooms_e2e` for each run, by inference: the logs do
not show the global setup's `DROP DATABASE` and `CREATE DATABASE` (it prints
only `db:up`'s lines). Both runs fall on one UTC date, so run 2 booked the
slots run 1 had left booked: the sentinel (Bromo, day +39, in
`e2e/rig.spec.ts`) and the five round winners (Merapi, days +41 to +45, in
`e2e/success.spec.ts`; all twenty round 5 ranges share one quarter hour, so
each overlaps that round's winner). Gate run 2 passed the sentinel and every round
(gate-run-2.txt), which only a freshly created database allows: a database
carried over from run 1 answers 409 there, the failure
task-3-red-sentinel-run2.txt shows on the shipped rig.

Ports after each run: `verify-dev.mjs` refuses to start while 3000 or 5173
listens. Its `book` run started after gate run 1 and its `check` run after gate
run 2, and both started (verify-dev.txt).

The gate's log carries ANSI color codes on its Vitest and Vite lines; see the
evidence caveats below.

### The dev check (verify-dev.txt)

- `book`, 2026-10-31T23:56:40Z: `npm run dev` ran `db:up` (PostgreSQL
  Running, Healthy), then the service (`Server listening at
  http://127.0.0.1:3000`) and Vite on localhost:5173. Through the proxy:
  `POST /api/login` as ayu 200; `GET /api/me` 200, username `"ayu"`;
  `POST /api/bookings` 201 with
  `{"id":"bcf4fa7c-7d77-40e5-a7b2-2697204677d2","roomId":"kew","roomName":"Kew","title":"Dev check","start":"2026-12-18T06:00:00.000Z","end":"2026-12-18T07:00:00.000Z"}`.
  SIGTERM to the group; `npm run dev` exited; both ports closed; exit 0.
- Gate run 2 (gate-run-2.txt), exit 0, whose browser suite ran on a freshly
  created `meeting_rooms_e2e` (inferred above from its sentinel and rounds).
- `check bcf4fa7c-7d77-40e5-a7b2-2697204677d2`, 2026-10-31T23:57:41Z:
  `npm run dev` again; sign-in 200; `/api/me` 200, `"ayu"`;
  `GET /api/me/bookings` 200 lists exactly one `Dev check` booking, the same
  object with the same id; `DELETE /api/bookings/bcf4fa7c-...` 204; the next
  `GET /api/me/bookings` no longer lists it. Group stopped, ports closed,
  exit 0.
- Cleanup checks at 23:58:02Z: `lsof` on 3000 and on 5173 print nothing;
  `pgrep -fl "scripts/dev.mjs"` and `pgrep -fl "mr-int/web/node_modules"`
  print nothing; the only `node src/server.ts` running has its cwd in another
  lane's worktree (`mr-web`, port 3109). `pgrep -fl "npm --prefix backend
  start"` printed that lane's shell; see the evidence caveats.

The sign-in here goes through the web app's proxy, not the Login screen; see
Outstanding.

### An exported zone (e2e-tz-jakarta.txt)

`TZ=Asia/Jakarta npm run e2e`: 49 passed, exit 0, including
`the run is in Asia/Kolkata: the worker and the browser`. Winners: budi, ayu,
budi, ayu, ayu. The cleanup checks, stamped 2026-10-31T23:58:33Z: `lsof` on
3000 and 5173 print nothing.

### Evidence caveats

- Cleanup lines in the Task 4 to Task 6 evidence use
  `pgrep -fl "backend/src/server.ts"`, the shipped rig's path, which the new
  rig never runs; the checks that mean something there are the `lsof` lines
  on 3000 and 5173.
- The fix wave's evidence switched to `pgrep -fl "npm --prefix backend start"`.
  Task 7 found that pattern cannot match either: npm sets its process title to
  `npm start`, so the pattern matches only a shell whose command line holds
  the string, never the npm process that `e2e/fixtures.ts` or
  `scripts/dev.mjs` spawns. verify-dev.txt shows it on another lane's process
  group (its shell, then `npm start`, then `node src/server.ts`). In every
  evidence file the `lsof` lines are the cleanup check; verify-dev.txt adds
  checks scoped to this worktree.
- `FORCE_COLOR=0` turns color on in Vitest and Vite: their check treats any
  `FORCE_COLOR` as forcing color (`"FORCE_COLOR" in env`, in Vitest's
  tinyrainbow chunk). gate-run-1.txt, gate-run-2.txt and verify-dev.txt carry
  ANSI codes on Vitest and Vite lines; gate-baseline.txt has none.
  `sed 's/\x1b\[[0-9;]*m//g'` strips them and the counts read the same.
  Playwright and `node --test` honor `FORCE_COLOR=0`.

### Rulings the context did not settle (the controller's)

1. No superpowers constraint 11: mermaid-pastel-style styles diagrams; it is
   not a language skill.
2. `hsdd/templates/verification.md` has `## Learnings` but differs from the
   hsdd-config skill's bundled template; left unchanged, as the switch's step 7
   says.
3. This doc's title uses ` - ` where the template has an em dash.
4. File names `e2e/rig.spec.ts` and `e2e/global-setup.ts`; the Scope names
   neither.
5. "A database of its own" is proven through the contract by a per-day
   sentinel run twice, not by `pg_stat_activity`, a backend internal.
6. Constraint 1's commit-before runs swap `backend/` in the working tree to
   b5d93b6 or 25ed989, never committed, restored and checked clean.
7. The replay selection is an explicit list of the Scope's 15 names, guarded
   by the count test.
8. Evidence lives in `docs/superpowers/evidence/simple-login.integration.3/`.
9. ICU names Asia/Kolkata "Asia/Calcutta": the zone tests compare with the
   runtime's own canonical name, on the Node side and, after the fix wave, in
   the browser; `TZ` itself stays the literal.
10. The restart test's red at 25ed989 is a missing endpoint; the named mutant
    "restart onto an empty database" supplies the red for lost bookings.
11. The final whole-branch review ran before Task 7, so the gate runs and
    this doc reflect the code after its fixes.
12. No merge of main (web.8) into `lane/integration`: the caller merges lanes.
13. The dates and rooms allocation stays a header table in each spec, not
    exported data.
14. One extra `TZ=Asia/Jakarta npm run e2e` run covers an exported developer
    zone at suite level, rather than a whole gate under an exported `TZ`.

## Outstanding

- main moved to web.8 (bd752d5) after this lane branched; the gate here runs
  on `lane/integration` with web.7. To verify: re-run `npm test` after the
  lanes merge.
- README.md describes booking and the Rooms screen (Scope (h)); this lane's
  web app (web.7) has neither. To verify: once simple-login.web.9 has merged,
  integration.4 and .5 drive them in the browser.
- The service inherits `TZ=Asia/Kolkata` by construction (the spawn
  environment), but no contract exposes the service's zone, so it cannot be
  observed from outside. It cannot be verified through the contracts.
  Proposed for sign-off: waived (unobservable through the contracts; inherited
  by construction from the spawn environment).
- Whether the twenty requests overlap inside the service cannot be observed
  from outside; the rounds prove G5's outcome, and the reds show only the
  route's absence. To verify: a backend-side test with a non-atomic store
  mutant, which belongs to simple-login.backend, not this node.
- A fresh clone was approximated by a clean install in this worktree
  (`node_modules` removed in the root, `backend/` and `web/`); Colima was
  already running, and only the standalone `docker-compose` exists on this
  laptop. To verify: clone `lane/integration` into an empty directory on a
  machine with Colima stopped, then `colima start`, `npm run install:all`,
  `npm test`.
- The Verification line's "`ayu` signs in" was checked through the web app's
  proxy (`POST http://localhost:5173/api/login`, then `/api/me`), not on the
  Login screen of `npm run dev`; the browser suite drives the Login screen,
  but on its own servers and database. To verify: `npm run dev`, open
  <http://localhost:5173>, sign in as `ayu` / `sunrise-42`, and Home shows
  ayu's profile.

## Learnings

The dispositions below are proposed; the reviewer confirms or changes each at
sign-off.

- ICU (Node 24.18 and Chrome) reports the IANA link Asia/Kolkata as
  "Asia/Calcutta" from `resolvedOptions().timeZone`, so a test that compares
  the ambient zone's name with the literal fails. Nothing in the governance
  text asserts the canonical name, and ADR-002 compares the contract's
  `timeZone` strings as data. Disposition: dropped (no governance text is
  wrong; a note for simple-login.integration.4's `e2e/time.ts`)
- Scope (g) of this node ("Every test books on dates and rooms no other test
  uses") guards bookings, not reads: the rooms view lists every room and
  `GET /api/me/bookings` is account-wide, so a test that asserts on a room or
  a list it does not own meets another phase's bookings (integration.5 books
  Thames on clock-change days, which this phase's day offsets can hit). The
  final review caught it here. The change: simple-login.integration's plan
  states, for phases .4 and .5, that a test asserts only on rooms and ids it
  owns. Disposition: spec-updated (proposed; applied at the root through
  hsdd-phase-plan by the reviewer)
- `hsdd/templates/verification.md` (the tree's copy) differs from the
  hsdd-config 0.11 bundled template (no delegated sign-off form) and carries
  an em dash in its title. Disposition: dropped (the switch's step 7 keeps a
  copy with Learnings; re-copying it is the owner's choice at the root)
- The phase plan's evidence convention, `FORCE_COLOR=0`, turns color on in
  Vitest and Vite, so gate evidence carries ANSI codes (gate-run-1.txt,
  gate-run-2.txt). Disposition: dropped (an evidence convention in the phase
  plan, not governance text; the next plans can use `NO_COLOR=1`)
- The cleanup check `pgrep -fl "npm --prefix backend start"` cannot match the
  npm process it looks for, because npm retitles itself `npm start`
  (verify-dev.txt). Disposition: dropped (an evidence technique, not
  governance text; the `lsof` checks on 3000 and 5173 are the ones the next
  plans should name)

## Metrics

- Agent wall-clock: not measured by the harness.
- Review wall-clock, tier full-review: not measured by the harness.
- Review rounds: Tasks 1 to 6, one task review each, all Approved. Final
  whole-branch review: one round (With fixes), then one fix wave (203fce9)
  and one scoped re-review that passed it.
- Gate failures before green: 0. The baseline, run 1 and run 2 each exited 0
  (gate-baseline.txt, gate-run-1.txt, gate-run-2.txt). In Task 7's gate runs
  the browser suite took 11.6 s and 10.7 s; the whole gate's wall-clock is not
  in the evidence.
- Tokens: not reported by the harness.
- Product diff vs process artifacts, `git diff --numstat 9a1e469..HEAD`:
  - through 203fce9: product (package.json, playwright.config.ts, e2e/,
    README.md) 9 files, +535 -60; process (hsdd-context/, docs/superpowers/)
    29 files, +3472 -0, of which hsdd-context/ 1397, the plan 422, evidence
    1653.
  - with Task 7's commits: product unchanged; process (hsdd-context/,
    docs/superpowers/, hsdd/verify/) 36 files, +4759 -0;
    Task 7 adds 7 files, +1287 (this doc, five evidence files, verify-dev.mjs).
- Escaped defects: none found yet.

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
