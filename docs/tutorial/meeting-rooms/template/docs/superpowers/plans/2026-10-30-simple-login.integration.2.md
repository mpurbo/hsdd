# simple-login.integration.2: Phone number end to end. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The browser suite proves the amended AC-2.1 and the new AC-2.4 against the real service and the real web app, and the proxy replay moves to profile-api@v2.

**Architecture:** No new rig. Three assertions join `e2e/home.spec.ts`, the fixture loader in `e2e/fixtures.ts` swaps one slug, and the README follows. The phone values come from profile-api@v2's `200` fixtures, read at test time, so the browser test and the contract cannot disagree.

**Tech Stack:** Playwright 1.64 with system Chrome; the existing `e2e/fixtures.ts` (worker-scoped backend, `signIn`, `loadExactFixtures`).

**Spec:** `hsdd-context/superpowers/simple-login.integration.2.md`.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 4 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm test` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.integration.2.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.

Values pinned by profile-api@v2's fixtures: `ayu` → `+62 812 3456 7890`,
`budi` → `+62 813 9876 5432`; nine `exact` fixtures through the proxy (four
auth-api@v1, five profile-api@v2).

## Design note (the one decision this phase settles)

The phone numbers are read from `hsdd/contract/fixture/profile-api.v2/me-*.json`
at test time rather than typed into the spec. A typed literal could drift
from the contract; the fixture is the contract.

## Review Focus

1. A web app that reformats the number (spaces dropped, a dash added) fails
   AC-2.4: the match is the whole text of one element, `exact: true`.
2. Budi's Home shows Budi's number and not Ayu's.
3. The proxy replay still runs nine `exact` fixtures, none from
   `fixture/profile-api/`.
4. After `npm test`, nothing listens on 3000 or 5173.
5. The README's commands and contract names match what `npm test` runs.

---

### Task 1: AC-2.1 and AC-2.4 in the browser

**Files:**
- Modify: `e2e/fixtures.ts` (export `profileFixture(name): { phone: string; ... }` reading `profile-api.v2`)
- Modify: `e2e/home.spec.ts`

**Interfaces:**
- Produces: `profileFixture(name: "me-ayu" | "me-budi"): Record<string, string>` (the fixture's `response.body`).

- [ ] **Step 1: Write the failing tests** in `e2e/home.spec.ts`:
  - `AC-2.1` also expects `page.getByText(profileFixture("me-ayu").phone, { exact: true })` visible.
  - New `AC-2.4: Home shows each account's phone number exactly as stored`:
    for `ayu` and `budi` in turn (sign out between), the whole text of one
    element equals the fixture's `phone`.
  - The Budi test also expects Budi's phone visible and Ayu's
    (`+62 812 3456 7890`) with count 0.
  - The AC-2.3 comment cites profile-api@v2's every-rejection guarantee.
- [ ] **Step 2: Run against the web app before web.4** and record the failure.
  Run: `npx playwright test e2e/home.spec.ts`
  Expected: FAIL on AC-2.1, AC-2.4 and Budi (no phone on Home).
- [ ] **Step 3: Implement** `profileFixture` in `e2e/fixtures.ts`; merge the web.4 lane.
- [ ] **Step 4: Run.** `npx playwright test e2e/home.spec.ts` PASS.
- [ ] **Step 5: Commit** `test(integration): AC-2.1 amended and AC-2.4 in the browser`

### Task 2: The proxy replay moves to profile-api@v2

**Files:**
- Modify: `e2e/fixtures.ts` (`loadExactFixtures` slugs; the development-address comment), `e2e/proxy-replay.spec.ts` (comments), `README.md`

- [ ] **Step 1: Write the failing test**: in `e2e/proxy-replay.spec.ts`, a
  test `replays nine exact fixtures, none of profile-api@v1` asserting
  `loadExactFixtures()` has 9 entries, slugs `auth-api` ×4 and
  `profile-api.v2` ×5.
- [ ] **Step 2: Run** `npx playwright test e2e/proxy-replay.spec.ts`.
  Expected: FAIL (slugs are `profile-api`), and the v1 `me-ayu`/`me-budi`
  replays fail on `phone`.
- [ ] **Step 3: Implement**: slugs `["auth-api", "profile-api.v2"]`; comments
  name profile-api@v2; README: the replay names `profile-api@v2`, the demo
  table gains a `Phone` column.
- [ ] **Step 4: Run** `npm test`. Expected: exit 0; browser `20 passed` (18 before, plus AC-2.4 and the replay-set test).
- [ ] **Step 5: Commit** `test(integration): proxy replay on profile-api@v2`

### Task 3: Gate and verification doc

**Files:**
- Create: `hsdd/verify/simple-login.integration.2.verification.md`

- [ ] **Step 1:** `npm test` from the root (constraint 4); keep the output;
  then `lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN` prints nothing.
- [ ] **Step 2:** Mutation check for Review Focus 1: make the web app drop
  the spaces in `phone`, see AC-2.4 fail, revert.
- [ ] **Step 3:** Write the verification doc at spot-check depth; Sign-off blank.
- [ ] **Step 4: Commit** `docs(hsdd): simple-login.integration.2 verification doc`
