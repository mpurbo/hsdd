# Verification: simple-login.web.4 · Phone number on Home

> Spot-check depth. Plan: `docs/superpowers/plans/2026-10-30-simple-login.web.4.md`.
> Context: `hsdd-context/superpowers/simple-login.web.4.md` (spec d10d0d4).

## Commands to run

From the repository root (the directory holding `hsdd/`):

```bash
npm --prefix web install            # once per fresh checkout; lockfiles are git-ignored
npm --prefix web run gate           # tsc --noEmit, then vitest run, then vite build
grep -rn "'profile-api'" web/src    # who still names the profile-api@v1 fixture set
```

This phase produces no contract, so there is no replay to run. It consumes
profile-api@v2 through `hsdd/contract/fixture/profile-api.v2/` only.

## Expected output

- The gate exits 0: no `tsc` errors, `Test Files 9 passed (9)`,
  `Tests 90 passed (90)`, and `vite build` ends with `✓ built in`.
- The `grep` prints one line, `web/src/test/fetchStub.test.ts`, the cast in
  the test that proves the stub refuses that set (`no fixture set
  profile-api`) before reading it. No other web test reads
  `hsdd/contract/fixture/profile-api/`.
- The tests that carry the phase's claims:
  - `fetchProfile: me-ayu` and `me-budi`: the profile includes `phone`.
  - `fetchProfile: a 200 without a phone (a profile-api@v1 answer) is unavailable`,
    and the `null` and numeric cases.
  - `fetchProfile ignores fields it does not know (profile-api@v2)`.
  - `HomeScreen`: rows are Username, Email, Phone, Member since, with
    `+62 812 3456 7890` for Ayu and `+62 813 9876 5432` for Budi; three
    other groupings are shown exactly as given (AC-2.4).
  - `App`: `me-ayu` and `me-budi` through the stubbed `GET /api/me` show
    their phone character for character; a 200 without `phone` on load
    shows the D3 network message and keeps the stored session (D5).
  - The web.3 load-check and walk tests pass unchanged on the v2 fixtures.

What to eyeball:

- Home at 360 px against the Screen in `hsdd/context/update-1-add-phone.md`:
  the Phone row sits between Email and Member since, the number on one
  line, as stored. In a real browser this needs a backend that serves
  profile-api@v2 (simple-login.backend.3): `npm run dev`, sign in as
  `ayu` / `sunrise-42`, device toolbar at 360 px.
- `web/src/home/HomeScreen.tsx` renders `{profile.phone}` with no
  formatting call.

## Observed

2026-10-30, Node 24.18.0, macOS.

- Gate: exit 0. `tsc` clean; 9 test files, 90 tests passed (79 before the
  phase); build succeeded. RED before each change: Task 1, the refusal test
  failed ("expected [Function] to throw an error") and `tsc` failed with
  TS2345 on `'profile-api.v2'`; Task 2, seven tests failed (both fixture
  profiles lacked `phone`, the three malformed 200s returned `ok: true`,
  the unknown-field case lacked `phone`, and the App case showed Home) and
  `tsc` failed with TS2353; Task 3, seven tests failed (no Phone row).
- `grep`: one line, `web/src/test/fetchStub.test.ts:23`.
- 360 px: a throwaway entry rendered `HomeScreen` with the v2 `me-ayu` and
  `me-budi` bodies inside a 360 px iframe, screenshotted with headless
  Chrome and then deleted. The card spans x 16 to 344; rows in the
  Screen's order; `+62 812 3456 7890` and `+62 813 9876 5432` each on one
  line with room to spare. `--window-size=360` alone is not a 360 px
  check: headless Chrome laid the page out at about 500 px.

## Outstanding

- Home against the real backend: this phase never runs it (isolation
  strategy). The producer's v2 answer is proven by simple-login.backend.3's
  replay; the browser walk on v2 belongs to simple-login.integration.2. A
  backend still on v1 would answer 200 without `phone`, and the app then
  shows Login with the network message after sign-in (D3, D5), by design.
- The 360 px eyeball above, in a real browser, by the reviewer.

## Learnings

- The phase's Scope and Verification cite "the request's Screen", but
  neither the generic context nor its superpowers derivative inlines the
  Screen or links `hsdd/context/update-1-add-phone.md`; it was reachable
  only through the node spec's Sources line. The tree is consistent; the
  gap is in what phase-context generation carries into Links.
  dropped (tooling, not the tree: raised with this run's report)

## Metrics

- Agent wall-clock: 13:13 to 13:35. Plan and Plan check 7 min, Tasks 1
  to 4 7 min, final whole-branch review by a fresh reviewer 7 min (0
  Critical, 0 Important, 5 Minor deferred; no fix pass).
- Gate failures before green: none unplanned; each RED above was planned.
- Product diff: `web/` +121 −30 over 11 files (production +19 −10, tests
  and the fixture stub +102 −20). Process artifacts: plan 271 lines, this
  doc.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) |
  deferred to {phase-id}
- Disposition of each Learning: spec-updated | contract-bumped (id@v) |
  adr-proposed (ADR-nnn) | dropped (reason)
