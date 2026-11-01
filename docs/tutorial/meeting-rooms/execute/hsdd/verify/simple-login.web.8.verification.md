# Verification: simple-login.web.8 - Rooms on a date, moving between screens

> Written at apply by the documentation task, once implementation details
> exist, never during planning. Depth per review tier: gate-only = slim
> (gate command, expected output, a 3-5 line checklist, Learnings);
> spot-check = short (commands, expected output, what to eyeball,
> Learnings); full-review = full (every section below). Every tier keeps
> Learnings and Sign-off.

Review tier: full-review. Phase context: `hsdd-context/simple-login.web.8.md`
(spec 25ed989). Plan: `docs/superpowers/plans/2026-11-01-simple-login.web.8.md`.
Code range: cc87119 (plan) to d90a062; browser evidence 55b9bb8. The
template's title separator is an em dash; this doc uses a hyphen (see
Learnings).

## Commands to run

From the repository root, on a fresh checkout. The backend and PostgreSQL
are not needed: every test stubs `fetch` with the contract fixtures
(Isolation strategy).

```sh
rm -rf web/node_modules web/dist
npm --prefix web install
npm --prefix web run gate        # tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build
```

Per-file counts, and this phase's own suites:

```sh
cd web && TZ=Asia/Kolkata npx vitest run --reporter=verbose; cd ..
npm --prefix web test -- src/rooms src/App.test.tsx src/App.expiry.test.tsx src/session/flow.test.ts src/home/HomeScreen.test.tsx
```

The 360 px check (production build in the installed Chrome, `/api`
answered from the fixtures, the browser's clock fixed per scenario):

```sh
npm install                      # root: @playwright/test
npm --prefix web run build
node docs/superpowers/evidence/simple-login.web.8/rooms-360.mjs
```

It rewrites `rooms-360.json` and the screenshots beside the script and
exits 1 on a failed check.

The expiry guards' named mutants (each alone, then
`git checkout -- web/src/App.tsx web/src/session/flow.ts web/src/rooms/RoomsScreen.tsx`):

```sh
# M1: App's compare-and-clear made unconditional
sed -i '' 's/    if (loadSession()?.token === signedInToken) clearSession()/    clearSession()/' web/src/App.tsx
# M2: the reducer's token check removed
sed -i '' 's/          return event.token === state.session.token/          return true/' web/src/session/flow.ts
# M3: RoomsScreen's stale-run check removed
sed -i '' 's/      if (stale) return/      if (false) return/' web/src/rooms/RoomsScreen.tsx
npm --prefix web test -- src/App.expiry.test.tsx src/App.test.tsx
```

Failing first against the code before each task (tests at HEAD):

```sh
git show cc87119:web/src/session/flow.ts > web/src/session/flow.ts && npm --prefix web test -- src/session/flow.test.ts
git show cc87119:web/src/home/HomeScreen.tsx > web/src/home/HomeScreen.tsx && npm --prefix web test -- src/home/HomeScreen.test.tsx
git show 36867e6:web/src/App.tsx > web/src/App.tsx && npm --prefix web test -- src/App.test.tsx src/App.expiry.test.tsx
git checkout -- web/src
```

This phase produces no contract, so there is no replay.

## Expected output

- `npm --prefix web run gate` exits 0. `tsc` prints nothing, vitest prints
  `Test Files  16 passed (16)` and `Tests  331 passed (331)` with no
  `act()` warning and no console output, and `vite build` writes `dist/`.
- Passing tests per file, before (d94377c, the phase switch on 25ed989)
  and after (d90a062):

| File | Before | After |
|------|-------:|------:|
| src/api/client.test.ts | 124 | 124 |
| src/App.expiry.test.tsx | - | 2 |
| src/App.test.tsx | 14 | 20 |
| src/home/bookingLines.test.ts | 5 | 5 |
| src/home/HomeScreen.test.tsx | 7 | 8 |
| src/home/memberSince.test.ts | 8 | 8 |
| src/home/MyBookings.test.tsx | 20 | 20 |
| src/login/LoginScreen.test.tsx | 16 | 16 |
| src/rooms/RoomsScreen.test.tsx | - | 11 |
| src/rooms/roomViews.test.ts | - | 8 |
| src/session/flow.test.ts | 15 | 22 |
| src/session/store.test.ts | 12 | 12 |
| src/test/ambientZone.test.ts | 1 | 1 |
| src/test/fetchStub.test.ts | 10 | 10 |
| src/time/time.test.ts | 63 | 63 |
| src/viteConfig.test.ts | 1 | 1 |
| **Total (files)** | **296 (13)** | **331 (16)** |

- `rooms-360.mjs` prints, and exits 0:
  ```
  budi-rooms-on-a-date: 9 lines, scrollWidth 360 of 360, wrapped 0, date input top 41 -> 41, failures 0
  ayu-rooms-range-edges: 10 lines, scrollWidth 360 of 360, wrapped 1, date input top 41, failures 0
  ```
- The phase's Verification, clause by clause, and the test that shows it:

| Verification clause | Test |
|---|---|
| `me-budi`, clock `2026-11-05T09:30:00.000Z`: Rooms opens on 2026-11-05, sends `GET /api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z`, and `rooms-on-a-date` shows `Merapi · Jakarta · 8 seats`, `02:00 to 03:00  Sprint planning`, `(09:00 to 10:00 in Jakarta)`, `Bromo · Jakarta · 4 seats`, `(no bookings)`, `Thames · London · 10 seats`, `10:00 to 11:00  Design review`, `Kew · London · 4 seats`, `(no bookings)` | RoomsScreen.test.tsx "opens on today in the user zone and shows rooms-on-a-date (AC-4.1, AC-4.2, AC-4.3)"; roomViews.test.ts "shows rooms-on-a-date for a London user (AC-4.1, AC-4.3)"; App.test.tsx "walks Login, Home, Book a room, Rooms, Home, Sign out, Login (D4)" |
| `Asia/Jakarta`, clock `2026-11-04T18:00:00.000Z`, `rooms-range-edges`: `06:00 to 07:00  Planning`, `08:00 to 08:30  Standup`, `23:45 to Fri 6 Nov 00:15  Wrap-up`, `Wed 4 Nov 23:30 to 00:30  Handover` with `(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)` | RoomsScreen.test.tsx "opens on the Jakarta date and shows rooms-range-edges"; roomViews.test.ts "shows rooms-range-edges for a Jakarta user (ADR-002 Decision 7)" |
| Picking 2027-10-31 as the London user sends `from=2027-10-30T23:00:00.000Z&to=2027-11-01T00:00:00.000Z`; `rooms-on-a-clock-change-day` shows `00:00 to 01:30 BST  Midnight launch`, `01:00 GMT to 01:30 GMT  After the change`, `23:30 to Mon 1 Nov 00:00  Last slot` | RoomsScreen.test.tsx "picking 2027-10-31 fetches the clock-change day (AC-4.4)"; roomViews.test.ts "shows rooms-on-a-clock-change-day for a London user (AC-4.4)" |
| `rooms-no-token`'s 401 lands on Login with the expiry message and nothing stored | App.test.tsx "rooms-no-token: a 401 on Rooms lands on Login with the expiry message, nothing stored (D1)"; RoomsScreen.test.tsx "rooms-no-token: a 401 calls onSessionExpired (D1)" |
| The App test walks Login (`login-success`), Home, Book a room, Rooms, Home, Sign out, Login | App.test.tsx "walks Login, Home, Book a room, Rooms, Home, Sign out, Login (D4)" (its call list ends with a second `GET /api/me/bookings`: Home fetches again) |
| A reload on Rooms shows Home | App.test.tsx "a reload on Rooms shows Home (D2, D4)" |
| At 360 px wide each room and booking line stays on its own line | `rooms-360.mjs` (no sideways scroll, every `.rooms-list p` starts below the one before it, every line rendered as received); `rooms-360.json` and the screenshots |

- The rest of the Scope: `Loading…` while a fetch is in flight, for the
  first date and for a changed one ("reads Loading… while the request is
  in flight", "reads Loading… while a changed date is in flight, never the
  previous date's rooms (Scope)"); `unavailable` shows D3's message and
  keeps the date ("unavailable: D3 message in place of the list, the date
  kept"); `Book a room` beside Sign out, only with a usable zone
  (HomeScreen.test.tsx "Book a room sits beside Sign out and calls its
  parent (D4)", "without a zone (D7): ...", App.test.tsx "without a usable
  zone, Book a room is not offered"); Rooms opens on today each time
  (App.test.tsx "Rooms opens on today each time it shows (D4)").
- The web.7 sign-off's open item, App's `onSessionExpired` clearing storage
  whatever the state: an expiry now names its token and ends only its own
  session. App.expiry.test.tsx "an expiry from a screen of an earlier
  session neither clears nor ends the newer one (D1)" pins both App guards
  in the unmutated tree; App.test.tsx "a late 401 from Rooms cannot clear a
  newer session (D1, Review Focus 3)" covers the real Rooms dropping the
  late answer.
- The plan's Review Focus, each pinned by a test: (1) a cleared or
  half-typed date, "a cleared or half-typed date sends nothing and shows no
  list (Review Focus 1)"; (2) answers out of order, "shows the newest date
  when answers arrive out of order (Review Focus 2)"; (3) the late 401, the
  two tests above; (4) a room zone `Intl` refuses, "a room zone Intl
  refuses: no local line, no throw (Review Focus 4)"; (5) no usable zone,
  the D7 tests above.

## Observed

2026-11-01, on macOS (Darwin 25.6.0), Node.js v24.18.0, npm 11.16.0;
installed: react 19.3.1, typescript 7.0.2, vite 8.3.5, vitest 5.0.5,
jsdom 30.1.3; root @playwright/test 1.64.1 with the installed Google
Chrome.

**Baseline, d94377c, clean install:** gate exit 0, `Test Files  13 passed
(13)`, `Tests  296 passed (296)`.

**Final, d90a062, clean install** (`rm -rf web/node_modules web/dist`,
`npm --prefix web install`, `npm --prefix web run gate`): exit 0. The
install printed the `npm warn allow-scripts` lines for fsevents (install
scripts left unapproved by npm 11); the gate does not depend on them.

```
> simple-login-web@0.0.0 gate
> tsc --noEmit && TZ=Asia/Kolkata vitest run && vite build

 RUN  v5.0.5 .../mr-web/web

 Test Files  16 passed (16)
      Tests  331 passed (331)
   Duration  1.82s (environment 65%, setup 16%, tests 13%, import 3%, transform 2%)

vite v8.3.5 building client environment for production...
✓ 31 modules transformed.
dist/index.html                   0.39 kB │ gzip:  0.26 kB
dist/assets/index-CKCi2uI5.css    3.91 kB │ gzip:  1.03 kB
dist/assets/index-Ci6G-oRx.js   235.71 kB │ gzip: 73.88 kB
✓ built in 293ms
```

Per-file counts at d90a062 are the "After" column above (verbose run).

**360 px, on the build of d90a062** (`rooms-360.mjs`, 55b9bb8): the two
lines in Expected output, exit 0. The one wrapped line is Kew's
`(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)`, which wraps inside its
own block; the date input stays at 41 px from the top when the date
changes to 2027-10-31. Chrome shows the date input in the OS locale's
format (`2026/11/05`); its value is `2026-11-05`. Screenshots:
`docs/superpowers/evidence/simple-login.web.8/*.png`.

**Failing first.** Every test of this phase covers behavior this phase
adds; none covers behavior a dependency phase (web.5, web.6, web.7)
already delivered. Re-run for this doc against the code before each task,
with the tests at HEAD (Commands to run):

```
== web/src/session/flow.ts at cc87119
     × a loaded profile shows Home
     × Book a room shows Rooms (D4)
     × Home on Rooms shows Home (D4)
     × ignores an event that does not apply: an expiry for another session's token
     × ignores an event that does not apply: an expiry for another session's token on Rooms
      Tests  5 failed | 17 passed (22)
== web/src/home/HomeScreen.tsx at cc87119
     × Book a room sits beside Sign out and calls its parent (D4)
      Tests  1 failed | 7 passed (8)
== web/src/App.tsx at 36867e6
     × an expiry from a screen of an earlier session neither clears nor ends the newer one (D1)
     × an expiry from the current Rooms ends the session (D1)
     × walks Login, Home, Book a room, Rooms, Home, Sign out, Login (D4)
     × a reload on Rooms shows Home (D2, D4)
     × rooms-no-token: a 401 on Rooms lands on Login with the expiry message, nothing stored (D1)
     × a late 401 from Rooms cannot clear a newer session (D1, Review Focus 3)
     × Rooms opens on today each time it shows (D4)
      Tests  7 failed | 15 passed (22)
```

- `roomViews.ts` and `RoomsScreen.tsx` are new files: before each existed
  its test file failed to load (`Failed to resolve import "./roomViews"`,
  `Failed to resolve import "./RoomsScreen"`), per the implementers'
  recorded RED runs.
- Where a guard could pass vacuously, a named mutant decides. RoomsScreen
  (Task 3): the stale-run check removed fails "shows the newest date when
  answers arrive out of order" and "drops an answer that arrives after
  unmount, a 401 included" (`Tests  2 failed | 8 passed (10)`); the
  `RangeError` catch removed fails the half-typed date test with
  `RangeError: Not a real calendar date: 0002-10-31`. The changed-date
  `Loading…` test passes on f2d6c52 because `act` flushes the effect; with
  `setList(LOADING)` removed, f2d6c52 fails it showing
  `Thu 5 Nov 02:00 to Thu 5 Nov 03:00  Sprint planning` under 2027-10-31,
  while d90a062 under the same mutant still passes (the date-tagged list
  guards it), and removing both the tag check and `setList(LOADING)` fails
  it (`Tests  1 failed | 10 passed (11)`). The D7 "not offered" App test
  passed before Task 5 because HomeScreen already hid the button; the
  mutant "HomeScreen always shows Book a room" fails it.
- The expiry guards, re-run at d90a062 for this doc:
  ```
  M1 (unconditional clear):  × an expiry from a screen of an earlier session neither clears nor ends the newer one (D1)
                             AssertionError: expected null to deeply equal { …(2) }
                             Tests  1 failed | 21 passed (22)
  M2 (no reducer check):     × the same test
                             TestingLibraryElementError: Unable to find ... heading ... "Hello, Budi Santoso"
                             Tests  1 failed | 21 passed (22)
  M3 (no Rooms stale check): App.test.tsx  Tests  20 passed (20)
  M3 + M1 + M2:              × a late 401 from Rooms cannot clear a newer session (D1, Review Focus 3)
                             Tests  1 failed | 19 passed (20)
  ```
  So each App guard is needed on its own (M1 loses the stored session, M2
  the shown one), and the real Rooms also drops the late answer (M3 alone
  stays green).

**Reviews (full-review: a fresh implementer and a fresh task reviewer per
task, then a whole-branch review).** Critical / Important / Minor:

| Review | C | I | M | Outcome |
|---|--:|--:|--:|---|
| Task 1, the flow | 0 | 0 | 3 | approved |
| Task 2, Rooms' lines | 0 | 0 | 3 | approved |
| Task 3, the Rooms screen | 0 | 0 | 4 | approved; two Minors (no test of `Loading…` after a date change, one render pairing old rooms with the new date) returned as the final review's Important 2 |
| Task 4, Book a room | 0 | 0 | 4 | approved |
| Task 5, App | 0 | 1 | 3 | the Important: the code comment, from the plan's design rationale 7, said either expiry guard alone was enough; fixed in round 1 (comment, `App.expiry.test.tsx`), re-review clean |
| Final, whole branch | 0 | 2 | 4 | Important 1: the Rooms card was centred, so the header moved about 107 px on every date change; Important 2: the changed-date `Loading…` was unpinned; both fixed in one wave (Rooms top-aligned; the loaded list carries its date), re-review clean, 3 of 3 addressed |

**Deviations from the plan.** (1) Task 1 also bound App's
`onSessionExpired` to the signed-in token (moved forward from Task 5), so
no commit has a failing test. (2) The plan's design rationale 7 said
either guard alone stops a late 401; that is false and is corrected in the
plan with a note. (3) `App.expiry.test.tsx` was added to pin each App guard
without mutating Rooms. (4) The final fix wave changed `loaded` to carry
its date and top-aligned Rooms.

**Rulings taken during the phase** (each with what it costs if wrong) are
listed in the hand-off to the owner proxy; the ones that shape behavior: a
date `dayRange` refuses (`''`, a year below 0100 while typing) sends nothing
and shows no list, with no new copy; a room zone `Intl` refuses gets no
local line; `{seats} seats` is kept even for one seat; "stays on its own
line" is read as its own block, so a long local line may wrap inside it;
Rooms is top-aligned while Home stays centred; the expiry is tied to the
token of the session that rendered the screen.

## Outstanding

1. **The PRD v2 Screens wireframe was not in the phase context.** The
   Scope says "The Rooms screen as PRD v2 Screens draws it" and "Home gains
   `Book a room` beside Sign out (PRD v2 Screens)", but the context neither
   inlines nor links the PRD, so the layout follows the Scope's text: the
   heading `Rooms on` with the date input and `Home`, then each room line
   and its booking lines, flush left. To verify: the owner compares the
   screenshots in `docs/superpowers/evidence/simple-login.web.8/` with the
   wireframe.
2. **Browser checks not run here.** Run: the 360 px layout in Chrome. Not
   run: Safari and Firefox; a screen reader on the new screen (the D3 line
   is a `role="status"` that mounts with its text, as on Home); focus after
   `Book a room` and `Home`, which falls to the page because each button
   leaves with its screen; the date input under keyboard stepping. To
   verify: `npm --prefix backend run db:up`, `npm --prefix backend start`,
   `npm --prefix web run dev`, sign in as `budi`, and walk Home and Rooms at
   360 px with VoiceOver on.
3. **Against the real backend.** Not run, by the Isolation strategy: the
   web lane builds against booking-api@v1's fixtures. The integration
   node's browser suite exercises Rooms against the service.

## Learnings

- The phase Scope cites "PRD v2 Screens" for Rooms and for Home's new
  button, as web.7's did for Home, but hsdd-config inlines no context
  document and the phase context links none, so the implementing session
  again works without the wireframe (Outstanding 1). web.7 recorded the
  same Learning and it was dropped; web.9's form will meet it a third time.
  The node's plan should state the layout these phases need, or name the
  wireframe lines to inline. spec-updated
- D1 says a 401 "clears the session" but not whose. This phase settled it
  in code: an expiry carries the token of the request that got the 401, App
  removes the stored session only while storage holds that token, and the
  flow ignores an expiry for any other token. D1 could say that a 401 ends
  only the session whose token received it. spec-updated
- The node has no decision on focus when the screen changes. Login to
  Home, Home to Rooms and Rooms to Home all drop focus to the page, while
  MyBookings moves focus to its heading after a Cancel. A line in D4 would
  settle it for every screen. spec-updated
- D3's message says "Please try again", but on Rooms picking the same date
  fires no change and a reload lands on Home (D4), so a retry takes two
  date changes or Home and back. Whether Rooms gets a retry, and its copy,
  is the owner's call for D3 or D10. spec-updated
- The verification template's title separator is an em dash, which this
  project's prose rules ban; this doc uses a hyphen. The template is a
  verbatim copy of hsdd-config's, so the fix belongs upstream in HSDD, not
  in this tree. dropped (upstream template, not this tree)
- `hsdd/templates/verification.md` differs from the template hsdd-config
  now bundles: the bundled Sign-off names a delegated reviewer
  (`{person} | {agent} for {person} (delegated)`) and says who may run the
  gate. The phase switch leaves a copy that has `## Learnings` in place
  and reports the difference, so this tree keeps the older wording. dropped
  (a template refresh is a root decision, outside this phase)

## Metrics

- Agent wall-clock: about 50 minutes, from the phase switch (d94377c,
  04:01) to this doc; implementation commits from 04:09 (e1b3a3f) to 04:47
  (d90a062).
- Review wall-clock, full-review: five task reviews (about 9 minutes
  together), two scoped re-reviews (under a minute each) and one
  whole-branch review (about 7 minutes).
- Gate failures before green: 0. The gate ran twice from a clean install
  (baseline and final), each exit 0.
- Fix rounds: Task 1, one ruling-driven follow-up (App binding); Task 5,
  one round; the final review, one wave.
- Subagent tokens, as the harness reported them: about 1.24M across 14
  subagents (5 implementers, two of them resumed once; 1 fix agent; 8
  reviewers); the controller's own tokens are not reported.
- Product diff (web/src, not tests): +358 -18, of which CSS +122. Tests:
  +641 -7. Together 999 lines added and 25 removed, against the plan's
  estimate of ~400 (about half tests); the tests, the expiry-guard test
  file and the fix wave account for the excess.
- Process artifacts: phase context 742 lines, superpowers derivative 795,
  plan 214, browser evidence script 126 lines with five screenshots and a
  JSON, this doc.
- Escaped defects: none known yet.

## Sign-off
- Reviewer / date: Claude for Purbo Mohamad (owner proxy, delegated by the owner before the run), 2026-11-01
- Review tier applied: full-review: per-task reviewers and a final whole-branch reviewer read (Task 5: 1 Important, a comment claiming either expiry guard alone sufficed, fixed with a test pinning each guard; final: 2 Important, the Rooms header jumping on a date change and Loading not pinned after one, both fixed and re-reviewed clean); the 360 px evidence under docs/superpowers/evidence/simple-login.web.8/ looked at; the gate rerun green by the orchestrator (16 files, 331 tests)
- Disposition of each Outstanding item: the comparison with PRD v2's wireframe and a run against the real backend: deferred to simple-login.integration.5 (Rooms browser tests); Safari, Firefox and screen-reader checks: waived (the product is a one-laptop demo tested in Chrome, PRD v2 Constraints)
- Disposition of each Learning: all four dropped: the missing wireframe is an HSDD finding carried to the checkpoint; D1's 'whose session' is settled by the token binding this phase built; focus on a screen change and a retry on Rooms are product improvements for a later intake (picking another date already retries)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
