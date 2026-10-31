# Verification: simple-login.web.6 - Time functions (pure core)

## Commands to run
From the repository root (the directory holding `hsdd/`), on Node.js 24:

```bash
# one-time setup on a fresh checkout (the lockfile is git-ignored, so this resolves afresh)
rm -rf web/node_modules web/package-lock.json web/dist
npm --prefix web install --no-audit --no-fund

# the gate: tsc, the tests in Asia/Kolkata, the build
npm --prefix web run gate

# per-file test counts, in the ambient zone the scripts set
(cd web && TZ=Asia/Kolkata npx vitest run --reporter=verbose)

# the time suite under other ambient zones
(cd web && TZ=Europe/London npx vitest run src/time/time.test.ts)
(cd web && TZ=America/St_Johns npx vitest run src/time/time.test.ts)
(cd web && TZ=Asia/Jakarta npx vitest run src/time/time.test.ts)
(cd web && TZ=UTC npx vitest run src/time/time.test.ts)

# Verification line, clause 2: time.ts has no import, export-from or require
grep -nE "^\s*(import|export .* from)|require\(" web/src/time/time.ts

# Verification line, clause 3: calls outside web/src/time/
grep -rnE "getHours|getDate|toLocale|Intl\.DateTimeFormat" web/src --include='*.ts' --include='*.tsx' | grep -v "^web/src/time/"
```

This phase produces no contract, so there is no replay command.

## Expected output
- `npm --prefix web run gate` exits 0: `tsc --noEmit` prints nothing;
  Vitest reports `Test Files  11 passed (11)` and `Tests  262 passed (262)`;
  `vite build` succeeds (25 modules) and writes `web/dist/`.
- Per file: the ten files web.5 left are unchanged (`src/api/client.test.ts`
  124, `src/App.test.tsx` 9, `src/home/HomeScreen.test.tsx` 6,
  `src/home/memberSince.test.ts` 8, `src/login/LoginScreen.test.tsx` 16,
  `src/session/flow.test.ts` 12, `src/session/store.test.ts` 12,
  `src/test/ambientZone.test.ts` 1, `src/test/fetchStub.test.ts` 10,
  `src/viteConfig.test.ts` 1), plus `src/time/time.test.ts` 63.
- The time suite reports 63 passed in each of Europe/London,
  America/St_Johns, Asia/Jakarta and UTC.
- The `time.ts` import grep prints nothing (exit 1).
- The outside-`time/` grep prints one line,
  `web/src/test/ambientZone.test.ts:10`, a test file (web.5's guard).

## Observed
2026-11-01, Node v24.18.0, npm 11.16.0; installed typescript 7.0.2,
vitest 5.0.5, vite 8.3.5, react 19.3.1.

**Gate, from a clean install** (install: "added 105 packages", exit 0).
- Before (HEAD 737501a, the signed web.5): exit 0; `tsc` silent;
  10 files, 199 tests passed; `vite build` OK (25 modules).
- After (HEAD 61d7b39): exit 0; `tsc` silent; 11 files, 262 tests passed;
  `vite build` built in 320 ms. Log: `.superpowers/sdd/2026-11-01-simple-login.web.6/gate.log`.
- Re-run on the installed packages at 61d7b39 with a clean tree
  (`git status --short` empty): exit 0, 11 files, 262 tests passed,
  `vite build` built in 62 ms.
- Per file before: App.test.tsx 9, viteConfig.test.ts 1, api/client.test.ts
  124, home/HomeScreen.test.tsx 6, home/memberSince.test.ts 8,
  login/LoginScreen.test.tsx 16, session/flow.test.ts 12,
  session/store.test.ts 12, test/ambientZone.test.ts 1,
  test/fetchStub.test.ts 10. After: the same ten, plus time/time.test.ts 63.
- Time suite under other zones: Europe/London 63, America/St_Johns 63,
  Asia/Jakarta 63, UTC 63 passed (London and St_Johns re-run at the gate).
  Zero gate failures before green.

**The Verification line, clause by clause.**
1. "each clock-change test names its date and its expected count": the
   titles carry both, for example "2027-03-28 in Europe/London is 23 hours",
   "... has 92 quarter-hour instants", "2027-10-31 ... 100 labels",
   "2011-12-30 in Pacific/Apia ... 0", and the London end labels' 32.
   Checked by reading the titles. Not enforced by a test. One exception:
   the Review Focus 3 test (one label, "Sun 31 Oct 01:30 BST" on
   2027-10-30's line) names its date only, since a single-label test has no
   count (parked minor).
2. "`web/src/time/` imports nothing but its own types and names no zone
   outside its tests": `time.ts` has no import, export-from or require
   (the grep prints nothing). Enforced by the test "web/src/time/ imports
   nothing". The only string literal in `time.ts` that `Intl` accepts as a
   time zone is `'UTC'`, in `formatDate`. Enforced by the test
   "web/src/time/ names no zone outside its tests". Reading: "no user, room
   or ambient zone" (ruling 1).
3. "nowhere in `web/src` outside `web/src/time/` calls `getHours`,
   `getDate`, a `toLocale` method or `Intl.DateTimeFormat`": the grep finds
   one hit, `web/src/test/ambientZone.test.ts:10`, web.5's guard
   (`Intl.DateTimeFormat().resolvedOptions().timeZone`), a test file.
   Reading: the clause applies to non-test sources (ruling 2, Learning L1).
   Enforced by a guard test that scans non-test sources and bans every
   `Date` local getter and setter in all non-test `web/src` files,
   including `time/` (D6).

**Test-first and mutant evidence** (details in the task and fix-wave
reports in `.superpowers/sdd/2026-11-01-simple-login.web.6/`).
- Task 1: RED, module `./time` unresolved; GREEN 8/8.
- Task 2: RED 17 failed ("endOptions is not a function" and similar);
  GREEN 25/25. Fix round 1: RED 2 failed (`startOptions`/`endOptions` did not
  throw on 'not an instant'); GREEN 28/28.
- Task 3: RED 15 failed ("is not a function"); GREEN 43/43. The Lord Howe
  GMT+11 / GMT+10:30 cases matched on the first run.
- Task 4 (guards over behavior Tasks 1 to 3 delivered, so each was shown
  failing against a named mutant):
  - M1 `formatDate` via `new Date(date)` and `getDay`/`getDate`/`getMonth`:
    the America/St_Johns sweep case failed ("expected 'Wed 4 Nov' to be
    'Thu 5 Nov'") while the pinned Kolkata `formatDate` test passed.
  - M2 `import type` in `time.ts`: "imports nothing" failed.
  - M3 `const DEFAULT = 'Asia/Jakarta'`: "names no zone" failed.
  - M4 `web/src/zzMutant.ts` with `toLocaleTimeString`: the outside-`time/`
    test failed with `['zzMutant.ts']`.
  GREEN 53/53, full suite 252/252.
- Fix wave: fix 1 RED 5 failed, then green. The tightened guards each failed
  against a mutant (`getDay` in `time.ts`; `'Singapore'`;
  `export { join } from 'node:path'`; `require`). The TZ-took-effect check
  failed (5 sweep cases) with the TZ assignment removed. The new
  malformed and empty tests pinned existing behavior and failed against a
  loop-bound mutant (20 failed). Formatter cache timing:
  `dayRange('2027-10-31', 'Europe/London')` 2.353 ms to 0.222 ms per call
  (100 calls).
- The final reviewer's brute-force cross-check (scratch, not committed):
  all 418 zones `Intl` lists, 3,388 days around every transition 2026 to
  2028. `dayRange` matches a minute-resolution reference; every date
  boundary is quarter-aligned; the short-name suffix matches a brute-force
  same-wall-time search; no date's wall dates run backwards.

**Reviews** (full-review tier: a reviewer per task, a final whole-branch
review).

| Reviewer | Critical | Important | Minor | Outcome |
|---|---|---|---|---|
| Task 1 | 0 | 0 | 3 | Approved |
| Task 2 | 0 | 1 | 4 | Important fixed in e48af0d (`startOptions`/`endOptions` returned [] for an unparsable instant); scoped re-review: addressed, no new breakage |
| Task 3 | 0 | 0 | 3 | Approved |
| Task 4 | 0 | 0 | 4 | Approved |
| Final, whole branch | 0 | 1 | 5 | One fix wave (5 commits) fixed the Important (`parseInstant` accepted a date-time without Z and read it in the ambient zone, against the Scope and D6) and Minors 2, 4, 5, 6 plus seven deferred task minors; scoped re-review: 8 of 8 addressed, no new Critical or Important; 4 residual minors parked |

**Rulings the context did not settle** (cost if wrong).
1. `formatDate` formats in `'UTC'`; "names no zone" is read as "no user, room
   or ambient zone". Cost: one line, hand-written names or a zone argument.
2. The Verification line's third clause applies to non-test sources
   (web.5's `ambientZone.test.ts` must call `Intl.DateTimeFormat()`). Cost:
   none for this phase, only the line's wording.
3. "None" is `undefined`; `asTimeZone` returns the name as given (not
   canonicalised), so `sameZone` stays string equality. Cost: web.7 adapts
   a `??`.
4. Malformed dates and instants throw `RangeError` (the Scope's return
   types have no "none"); `parseInstant` accepts only the exact
   `toISOString` form (ADR-002 Decision 1). Cost: callers guard their
   inputs, and a producer that drops milliseconds is refused.
5. A per-zone wall-clock formatter cache, the module's only state,
   reversing plan design note 7 after the reviewer's measurement. Cost: one
   bounded Map.
6. Guards stricter than the Verification line: all `Date` local getters and
   setters banned in non-test `web/src` including `time/`, and every
   `Intl`-accepted literal in `time/` must be `'UTC'`. Cost: a later phase
   needing one of these calls amends the guard under review.
7. No constraint-11 tech skill other than mermaid-pastel-style (named by
   conventions.md as a stack skill, installed); referenced contracts
   ordered by discovery. Cost: cosmetic.
8. This doc's title uses " - " where the template has an em dash. Cost:
   cosmetic.
9. Task 5 ran after the final review so the doc records it. Cost: the
   final reviewer did not see the doc.

## Outstanding
- O1. en-GB output in the browsers the integration suite drives (Chromium's
  ICU) is not verified here. Node 24's ICU writes "Sept" for September and
  no comma, and `formatDate` strips a comma defensively. To verify:
  simple-login.integration's browser tests on a date in September and on
  London's change days.
- O2. Ambient-zone independence in a real browser (the browser's time zone,
  not `TZ`) is not verified here. To verify: the integration suite's
  browser time zone set to Asia/Kolkata (ADR-002 Consequences).

## Learnings
- L1. The Verification line ("nowhere in `web/src` outside `web/src/time/`
  calls ... `Intl.DateTimeFormat`"), read literally, is already false on the
  tree: web.5's shipped guard `web/src/test/ambientZone.test.ts:10` calls
  it. The line should say "no non-test file" in simple-login.web.md's web.6
  Verification. spec-updated
- L2. The Scope says "Each takes the zone ... as an argument" and the
  Verification line says `time/` "names no zone", but `formatDate(date)` has
  no zone argument and `Intl` writes en-GB weekday and month names only for
  an instant in a named zone. `'UTC'` is the minimal deviation. The web.6
  Verification line should allow `formatDate`'s `'UTC'`. spec-updated
- L3. Every function throws `RangeError` on a malformed date, and Rooms' date
  input yields `''` when cleared, so web.8 needs a guard or a throw-free
  parser (an exported `asIsoDate(s): IsoDate | undefined` reusing the
  module's validator). The bare-string types also let swapped arguments
  compile; branded types would not. The web.8 Scope should name the guard or
  `asIsoDate`, and branded types go on the web.7/web.8 sync agenda.
  spec-updated
- L4. `hsdd/templates/verification.md` differs from the hsdd-config skill's
  bundled template (the Reviewer / date line and the delegated sign-off
  note); the config switch leaves a post-v0.10 copy as it is. hsdd-config
  step 7 leaves a copy with `## Learnings` untouched by rule, and
  re-copying is the owner's call. dropped (hsdd-config step 7 leaves the
  copy as is)

## Metrics
- Agent wall-clock: about 02:25 to 03:10 WIB, roughly 45 minutes (switch,
  plan, 4 tasks with 5 task reviews or re-reviews, final review about 10.5
  minutes, one fix wave, gate).
- Review wall-clock (full-review): task reviews 7 to 39 s each; the final
  review 10.5 minutes.
- Gate failures before green: 0 (both clean-install gates passed first run).
- Tokens: about 795k reported by the harness for the 13 subagent dispatches
  before Task 5 (controller tokens not reported).
- Product diff: `web/src/time/time.ts` 204 lines, `web/src/time/time.test.ts`
  305 lines (509 together, against the plan's ~340 and the PE guide's ~400;
  the excess is the final review's guards and tests).
- Process artifacts: hsdd-context 707 + 761 lines, plan 486 lines, plus this
  verification doc.
- Escaped defects added later: none yet.

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
