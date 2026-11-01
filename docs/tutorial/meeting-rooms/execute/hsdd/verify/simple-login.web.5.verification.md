# Verification: simple-login.web.5 - Booking API client, the time zone in the profile, the test rig

> Written at apply by the documentation task, once implementation details
> exist, never during planning. Depth per review tier: gate-only = slim
> (gate command, expected output, a 3-5 line checklist, Learnings);
> spot-check = short (commands, expected output, what to eyeball,
> Learnings); full-review = full (every section below). Every tier keeps
> Learnings and Sign-off.

## Commands to run
From the repository root (the directory holding `hsdd/`), on Node.js 24:

```bash
# one-time setup on a fresh checkout (packages per package directory)
npm --prefix web install

# the gate (node default): tsc, the tests in Asia/Kolkata, the build
npm --prefix web run gate

# per-file test counts, in the ambient zone the scripts set
(cd web && TZ=Asia/Kolkata npx vitest run --reporter=verbose)

# no client code reads error.message (the only hit is the header comment)
grep -n "message" web/src/api/client.ts
```

This phase produces no contract, so there is no replay command. The
booking-api@v1 and profile-api@v2 fixtures are replayed against the
client by `web/src/api/client.test.ts`, inside the gate.

## Expected output
- `npm --prefix web run gate` exits 0: `tsc --noEmit` prints nothing;
  Vitest reports `Test Files  10 passed (10)` and `Tests  199 passed (199)`;
  `vite build` writes `web/dist/`.
- Per file: `src/api/client.test.ts` 124, `src/App.test.tsx` 9,
  `src/home/HomeScreen.test.tsx` 6, `src/home/memberSince.test.ts` 8,
  `src/login/LoginScreen.test.tsx` 16, `src/session/flow.test.ts` 12,
  `src/session/store.test.ts` 12, `src/test/ambientZone.test.ts` 1,
  `src/test/fetchStub.test.ts` 10, `src/viteConfig.test.ts` 1.
- `grep -n "message" web/src/api/client.ts` prints one line, line 3, a
  comment.

What to eyeball:
- `web/src/api/client.test.ts`, the four tables `roomsCases` (6),
  `myBookingsCases` (3), `bookCases` (20) and `cancelCases` (6): each of
  the 35 booking-api@v1 fixtures is named with the result it gives, and
  `maps every booking-api fixture` fails when a fixture is added to the
  contract without a row.
- `fetchProfile: me-ayu` and `me-budi` carry `Asia/Jakarta` and
  `Europe/London`; `me-expired-token`, `me-no-token` and
  `me-unknown-token` give `unauthorized`; `a 200 without timeZone decodes
  with none (D7)`; `a 200 with a numeric timeZone is unavailable` (the
  Verification line's `"timeZone": 7`) and `with a null timeZone`.
- `web/package.json`: `"test": "TZ=Asia/Kolkata vitest run"` and
  `"gate": "tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build"`;
  `src/test/ambientZone.test.ts` is in the gate's run.
- `web/src/api/client.ts`: `isInstant` parses only a string already in
  `toISOString()` form; `fetchRooms` writes the query unencoded (D8);
  `bookRoom` rebuilds the body from the four fields; `send` reads no body
  from a 204.
- `web/src/api/types.ts`: `BookResult`'s `conflict` member carries the
  decoded booking; `Profile.timeZone` is optional (absent means none).
- No `.tsx` file changed: the phase makes no screen changes.

## Observed
2026-11-01, branch `lane/web` from `2e9ef03`, Node.js 24.18.0, npm 11.16.0,
the laptop's own zone `Asia/Jakarta`.

- Before the phase, from a clean install: the gate passed with 9 files and
  90 tests (`client` 19, `App` 9, `HomeScreen` 6, `memberSince` 8,
  `LoginScreen` 16, `flow` 12, `store` 12, `fetchStub` 7, `viteConfig` 1).
- Each task's failing test, as run before its code (test-first):
  - Task 1, ambient zone: `AssertionError: expected [ 'Asia/Calcutta',
    'Asia/Kolkata' ] to include 'Asia/Jakarta'` (scripts not yet changed).
  - Task 2, the stub: first all five new tests failed on `no fixture set
    booking-api`; with only the set added, each failed for its own
    reason: `TypeError: Response constructor: Invalid response status code
    204`, `Error: two fixtures for GET /api/me/bookings`, `TypeError:
    atPath is not a function`; `tsc` reported `Property 'clock' does not
    exist on type 'Fixture'` and the same for `given`.
  - Task 3, `timeZone`: 5 failed (`me-ayu`, `me-budi`, the numeric and
    null cases, and the unknown-fields test that reuses `me-ayu`). `a 200
    without timeZone decodes with none (D7)` passed on the tree before
    the change (web.4 already ignored the field); against the named
    mutant "timeZone required" (an absent `timeZone` made `unavailable`)
    it failed, 1 of 22.
  - Task 4, rooms and my bookings: 20 failed, `fetchRooms is not a
    function` and `fetchMyBookings is not a function`.
  - Task 5, `bookRoom`: 28 failed, `bookRoom is not a function`.
  - Task 6, `cancelBooking`: the completeness test failed with 29 of 35
    fixtures mapped (the six `cancel-*` missing); then 13 failed on
    `cancelBooking is not a function`; with the decider written but
    before the `send` change, `cancel-my-booking` gave `{ ok: false,
    reason: 'unavailable' }` instead of `{ ok: true, value: null }`.
    Three tests cover behavior earlier code already delivers, so each
    ran against a named mutant: "code only with a message" (20 of the 22
    refusal cases failed; the 2 that passed are refusals that are
    `unavailable` either way), "send rethrows" (3 failed), "unencoded id"
    (1 failed).
- Final review, a fresh reviewer over `2e9ef03..87531d1`: Critical 0,
  Important 1, Minor 4, verdict "With fixes". The reviewer ran the gate
  (176 passed) and its own mutants.
  - Important: no test caught a client sort of the rooms list or of a
    room's bookings (G13); a sorting mutant passed 176/176. Fixed by
    `fetchRooms keeps the order received, rooms and bookings, with no
    client sort (G13)` over `rooms-range-edges` reversed: it failed
    under the mutant (1 of 199) and passes on the code.
  - Minor, re-graded Important by the executor: the `error.code` half of
    the list and cancel deciders was unpinned; a status-only mutant
    passed 176/176. Fixed by `a refusal whose error.code the contract
    does not give it is unavailable` over the 22 refusal fixtures: 7
    failed under the mutant; all pass on the code.
  - Deferred minors: `cancelBooking`'s test name overstates its
    guarantee (`encodeURIComponent` leaves `..` as is; ids are server
    UUIDs); `BOOK_REFUSALS` holds shared result objects where
    `CANCEL_REFUSALS` holds reasons; a duplicate import in
    `client.test.ts`.
- The gate after the fix pass, from a clean install (`rm -rf
  web/node_modules web/dist && npm --prefix web install && npm --prefix
  web run gate`): exit 0; `tsc` silent; `Test Files  10 passed (10)`,
  `Tests  199 passed (199)`; `vite build` wrote `dist/index.html`,
  `dist/assets/index-CR7PgSBy.css` and `dist/assets/index-BW6_7MCK.js`.
- `grep -n "message" web/src/api/client.ts`: line 3 only, the header
  comment. `Date` appears only in `isInstant` (`Date.parse`,
  `toISOString`); no `toLocale`, `getHours`, `getDate` or `Intl` call.
- Nothing under `hsdd/` changed except this file.

## Outstanding
- none

## Learnings
- The Scope fixes the scripts as `TZ=Asia/Kolkata vitest run`, which is
  POSIX-shell syntax: `npm --prefix web test` and `gate` fail under
  Windows `cmd`. dropped (the product runs on one laptop, per ADR-001's
  2026-10-31 amendment; a cross-platform form would need a dependency
  such as `cross-env`)
- The booking-api@v1 rooms fixtures all list the rooms in the rooms'
  order and each room's bookings by start, so a consumer test that only
  replays them cannot catch a client sort (G13); this phase's first
  rooms-order test missed one, and the final review caught it. A
  consumer proves "the order received" by editing a fixture body. dropped
  (the fixtures prove the producer's order, which is their job; the
  consumer-side technique is in this phase's tests)
- D7 says a name `Intl` refuses counts as absent, but names no phase
  that applies it, and this phase's Scope holds the profile's
  `timeZone` as received. dropped (the rule applies where the name is
  used; the first phase that reads `Profile.timeZone` carries it)
- The phase block's Dependencies cite `H17 and H19`, ids that neither the
  node spec nor anything the phase context links defines, so the context
  cannot inline them. dropped (they qualify booking-api@v1's route to
  `stable`, which the contract now has, with `phase_ids: final`; nothing
  in this phase depends on them)
- `hsdd/templates/verification.md` differs from the template bundled with
  the installed hsdd-config: the bundled Sign-off names a delegated
  reviewer (`{person} | {agent} for {person} (delegated)`) and says a
  delegated sign-off names the person it answers to. The switch leaves a
  copy that has `## Learnings` as it is. dropped (a template refresh, not
  a spec, contract or ADR change; the root re-copies it when the owner
  chooses)

## Metrics
- Agent wall-clock: about 27 minutes, from the phase switch (01:58) to
  the fix-pass commit (02:24), including the review.
- Review wall-clock, tier spot-check: one whole-branch review by a fresh
  reviewer, 335 s, 138,119 reviewer tokens; the session's own tokens are
  not reported by the harness.
- Gate failures before green: 0 (the clean-install gate passed on its
  first run; each task's failing runs were the intended test-first runs).
- Product diff: 8 files under `web/`, 675 lines added and 44 deleted;
  of them, production code and config (`client.ts`, `types.ts`,
  `package.json`, `vite.config.ts`) 243 added and 21 deleted, and tests
  with the test helper 432 added and 23 deleted. The Size estimate was ~8
  files and ~400 lines, about half tests: the file count held, the lines
  came to about 1.8 times the estimate, mostly the fixture tables.
- Process artifacts: the phase context 697 lines, its superpowers
  derivative 750, the plan 286, this file.
- Escaped defects: none known yet.

## Sign-off
- Reviewer / date: Claude for Purbo Mohamad (owner proxy, delegated by the owner before the run), 2026-11-01
- Review tier applied: spot-check: the diff read by file list and size (8 files under web/, 675 lines added), the gate rerun green by the orchestrator (10 files, 199 tests), the fresh reviewer's report read (0 Critical, 1 Important and 1 raised Minor, both fixed with failing-mutant evidence)
- Disposition of each Outstanding item: none outstanding
- Disposition of each Learning: all five dropped, each with the reason recorded above; the stale project verification template is noted for the owner

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
