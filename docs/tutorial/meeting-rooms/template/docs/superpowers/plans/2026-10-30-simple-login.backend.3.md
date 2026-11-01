# simple-login.backend.3: Phone number in the profile (profile-api@v2). Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /api/me` serves profile-api@v2: the profile gains `phone`, exactly as stored, and the gate replays auth-api@v1 and profile-api@v2 (no longer v1).

**Architecture:** `phone` is data, not behavior: one field on `Account`, two values in `ACCOUNTS`, carried through the unchanged `toProfile`. The replay rig gains a third slug, `profile-api.v2`; every backend test that read profile-api@v1's fixtures moves to v2's, so v1's retirement cannot break this node's gate.

**Tech Stack:** Node.js 24, TypeScript, Fastify 5, Vitest; the replay rig in `backend/test/replay.ts`.

**Spec:** `hsdd-context/superpowers/simple-login.backend.3.md`.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 3 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix backend run gate plus contract replay for profile-api.v2: npm --prefix backend run replay (the same run keeps replaying auth-api)` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.3.verification.md from
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

Values pinned by the change request and profile-api@v2: `ayu` →
`+62 812 3456 7890`, `budi` → `+62 813 9876 5432`; the profile's six fields
in order `id, username, displayName, email, phone, memberSince`; the v2
slug `profile-api.v2` (schema `hsdd/contract/schema/profile-api.v2.schema.json`,
fixtures `hsdd/contract/fixture/profile-api.v2/`).

## Design note (the one decision this phase settles)

The rig's own tests (`replay.test.ts`) also move from `profile-api` to
`profile-api.v2`, though the Scope names only the gate's replay. Keeping v1
there would make this node's gate depend on v1's files, which the intake
retires.

## Review Focus

1. A phone number with unusual spacing (`+1 555 0100`) on an injected
   account comes back from `GET /api/me` byte for byte: AC-2.4's "exactly as
   stored" means no normalization anywhere on the path.
2. The profile still carries no password, hash or token after the type
   change: `toProfile` strips only `password`, so a field added to
   `Account` later would leak unless the test checks the key set.
3. The 401 bodies are byte-identical to before (`me-no-token`,
   `me-unknown-token`, `me-expired-token` replay `exact` under v2).
4. `npm --prefix backend run replay` lists no `profile-api/` fixture.
5. Nothing outside `backend/` changes.

---

### Task 1: `GET /api/me` serves profile-api@v2

**Files:**
- Modify: `backend/src/domain.ts` (`Account.phone`; the `Profile` comment names v2)
- Modify: `backend/src/accounts.ts` (both accounts' `phone`)
- Modify: `backend/src/routes.ts` (comment: the exact bodies auth-api@v1 and profile-api@v2 fix)
- Modify: `backend/test/replay.ts` (`ContractSlug` gains `"profile-api.v2"`)
- Modify: `backend/test/accounts.test.ts`, `backend/test/replay.test.ts`, `backend/test/contract.replay.test.ts`, `backend/test/routes.test.ts`

**Interfaces:**
- Produces: `type Account = { id; username; displayName; email; phone: string; memberSince; password }`; `type ContractSlug = "auth-api" | "profile-api" | "profile-api.v2"`.

- [ ] **Step 1: Write the failing tests**

  - `accounts.test.ts`: `fixtureBody` reads `fixture/profile-api.v2/`; Ayu's
    and Budi's profiles equal the v2 `me-ayu` and `me-budi` bodies; new test
    `a profile has exactly the six profile-api@v2 fields`:
    `expect(Object.keys(toProfile(a)).sort()).toEqual(["displayName","email","id","memberSince","phone","username"])` for each account.
  - `contract.replay.test.ts`: `SLUGS = ["auth-api", "profile-api.v2"]`;
    header comment names profile-api@v2.
  - `replay.test.ts`: `SLUGS = ["auth-api", "profile-api.v2"]`; the two
    `me-ayu`/`me-budi` tests load from `"profile-api.v2"`.
  - `routes.test.ts`: new test `GET /api/me returns the stored phone byte for byte`:
    an app built with one injected account whose `phone` is `"+1 555 0100"`
    signs in and gets `body.phone === "+1 555 0100"`.

- [ ] **Step 2: Run them and record the failure**

  Run: `npm --prefix backend run gate`
  Expected: FAIL. `tsc` rejects `"profile-api.v2"` as a `ContractSlug` and
  `phone` on `Account`; vitest fails the accounts tests and the v2 `me-ayu`
  and `me-budi` replays (no `phone`).

- [ ] **Step 3: Implement**

  Add `phone: string` to `Account` between `email` and `memberSince`, the two
  values in `ACCOUNTS`, `"profile-api.v2"` to `ContractSlug`; update the two
  comments. `toProfile` is unchanged.

- [ ] **Step 4: Run the gate and the replay**

  Run: `npm --prefix backend run gate && npm --prefix backend run replay`
  Expected: PASS; the replay lists 5 `auth-api/` and 5 `profile-api.v2/`
  fixtures and no `profile-api/` one.

- [ ] **Step 5: Commit**

  `git commit -m "feat(backend): GET /api/me serves profile-api@v2 (phone)"`

### Task 2: Gate and verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.3.verification.md`

- [ ] **Step 1: Run the gate** (constraint 4) from a clean install:
  `npm --prefix backend ci || npm --prefix backend install`, then
  `npm --prefix backend run gate && npm --prefix backend run replay`, and
  keep the output.
- [ ] **Step 2: Write the verification doc** from
  `hsdd/templates/verification.md` at spot-check depth: Commands, Expected,
  Observed (dated, with the counts), Outstanding, Learnings (each with one
  disposition, or `- none`), Metrics; Sign-off left blank.
- [ ] **Step 3: Commit**

  `git commit -m "docs(hsdd): simple-login.backend.3 verification doc"`
