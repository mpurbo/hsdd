# simple-login.backend.1: Service skeleton, domain types, contract replay rig. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `backend/` package that type-checks and tests green, holding the domain types, the two built-in accounts as data, a route-less `buildApp(deps)`, and a contract replay rig that phase 2's gate will run against the real routes.

**Architecture:** Pure data and types in `src/`; the replay rig is test-side code in `test/replay.ts` that reads the contract's schemas and fixtures from `../hsdd/contract/` by path relative to the file, never the working directory. `buildApp` takes its effects (clock, random bytes) as arguments, so phase 2 adds routes without touching how the app is built.

**Tech Stack:** Node.js 24 (runs `.ts` directly), TypeScript, Fastify 5, Vitest, Ajv 8 (draft 2020-12) with ajv-formats.

**Spec:** `hsdd-context/superpowers/simple-login.backend.1.md` (the phase context; its Links section points at the node spec and ADR-001). The fixture format and placeholder rules are in `hsdd/contract/auth-api.md` and `hsdd/contract/profile-api.md`, section `## Validation`.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 5 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix backend run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.1.verification.md from
   hsdd/templates/verification.md at gate-only depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier gate-only: no design discussion in the plan; slim verification doc.

Project facts every task uses: commands run from the repository root
(`execute/`); `backend/` is its own npm package (`"type": "module"`,
`"private": true`, `engines.node >= 24`); TypeScript imports use explicit
`.ts` extensions (Node type stripping), so `tsconfig.json` sets
`allowImportingTsExtensions`, `noEmit`, `erasableSyntaxOnly`,
`verbatimModuleSyntax`, `strict`, `module`/`moduleResolution` `nodenext`.

## Review Focus

1. The rig is run with a different working directory (`npm --prefix backend` from the root, or `npx vitest` inside `backend/`): fixture paths must still resolve. Pinned by Task 3 (paths from `import.meta.url`).
2. Someone adds a sixth fixture file later: it must be replayed without a code change. Pinned by Task 3 (fixtures are read from the directory, counted against the files on disk).
3. A non-fixture file lands in a fixture directory (a `README.md`): the rig must skip it, not crash. Pinned by Task 3.
4. A real response that differs from an `exact` fixture by one field: the rig must report it, naming the fixture. Pinned by Task 4.
5. A placeholder for an account the hooks do not know: the rig must fail that fixture with a message, not throw out of the suite. Pinned by Task 4.

---

### Task 1: Package skeleton, domain types, `buildApp`

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/.gitignore`
- Create: `backend/src/domain.ts`, `backend/src/app.ts`
- Test: `backend/test/app.test.ts`

**Interfaces:**
- Produces (`src/domain.ts`): `type Clock = () => Date`; `type RandomBytes = (size: number) => Buffer`; `type PasswordHash = { salt: string; hash: string }` (hex); `type Account = { id: string; username: string; displayName: string; email: string; memberSince: string; password: PasswordHash }`; `type Profile = Omit<Account, "password">`; `type Session = { token: string; accountId: string; expiresAt: Date }`; `type ErrorCode = "VALIDATION_FAILED" | "INVALID_CREDENTIALS" | "UNAUTHORIZED"`; `type ApiError = { error: { code: ErrorCode; message: string } }`; `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`.
- Produces (`src/app.ts`): `type AppDeps = { clock: Clock; randomBytes: RandomBytes; accounts: readonly Account[] }`; `function buildApp(deps: AppDeps): FastifyInstance` (logger off).

- [ ] **Step 1: Write the failing test** `test/app.test.ts`: `buildApp` with a fixed clock, `crypto.randomBytes` and an empty account list; `app.inject({ method: "GET", url: "/api/me" })` has status 404 (no routes in this phase); `app.close()` resolves.
- [ ] **Step 2: Run it and see it fail** (`npm --prefix backend test`): expected failure, cannot resolve `../src/app.ts`. Before that, create `package.json` (scripts `test` = `vitest run`, `gate` = `tsc --noEmit && vitest run`; dependency `fastify@^5`; dev dependencies `typescript`, `vitest`, `ajv@^8`, `ajv-formats@^3`, `@types/node`), `tsconfig.json` (include `src`, `test`), `.gitignore` (`node_modules/`), and run `npm --prefix backend install`.
- [ ] **Step 3: Implement** `src/domain.ts` (types only) and `src/app.ts`.
- [ ] **Step 4: Run** `npm --prefix backend run gate`: type check clean, 1 test passes.
- [ ] **Step 5: Commit** `feat(backend): package skeleton, domain types, buildApp`.

### Task 2: The built-in accounts

**Files:**
- Create: `backend/src/accounts.ts`
- Test: `backend/test/accounts.test.ts`

**Interfaces:**
- Consumes: `Account`, `Profile` from Task 1.
- Produces: `const ACCOUNTS: readonly Account[]` (Ayu `u_001`, Budi `u_002`, values from the PRD's demo-accounts table); `function toProfile(account: Account): Profile`.

- [ ] **Step 1: Write the failing test** `test/accounts.test.ts`: `toProfile(ACCOUNTS[0])` deep-equals the `response.body` of `../../hsdd/contract/fixture/profile-api/me-ayu.json`, and `ACCOUNTS[1]` likewise `me-budi.json`; usernames are unique; every `password.salt` is 32 hex characters and every `password.hash` 128; `toProfile` output has no `password` key.
- [ ] **Step 2: Run it and see it fail** (module not found).
- [ ] **Step 3: Implement** `src/accounts.ts`. Hashes are data, computed once with Node's scrypt, `N = 16384, r = 8, p = 1`, key length 64, a fresh 16-byte salt per account, both hex: `node -e 'const c=require("crypto");const s=c.randomBytes(16);console.log(s.toString("hex"),c.scryptSync(process.argv[1],s,64).toString("hex"))' sunrise-42` (and `harbor-17`). The plaintext passwords never appear in `src/`.
- [ ] **Step 4: Run** `npm --prefix backend test`: all pass.
- [ ] **Step 5: Commit** `feat(backend): built-in accounts as data`.

### Task 3: Replay rig, fixtures and schemas

**Files:**
- Create: `backend/test/replay.ts`
- Test: `backend/test/replay.test.ts`

**Interfaces:**
- Produces: `type ContractSlug = "auth-api" | "profile-api"`; `type Fixture = { name: string; description: string; request: { method: "GET" | "POST"; path: string; headers: Record<string, string>; body?: unknown }; response: { status: number; body: unknown }; replay: "exact" | "schema" }`; `function loadFixtures(slug: ContractSlug): Fixture[]` (every `*.json` in the slug's fixture directory, sorted by file name); `function responseValidator(slug: ContractSlug): (response: { status: number; body: unknown }) => string[]` (an empty array means valid; otherwise Ajv's errors as readable strings). Paths resolve from `new URL("../../hsdd/contract/", import.meta.url)`.

- [ ] **Step 1: Write the failing test** `test/replay.test.ts`: for each slug, `loadFixtures` returns one fixture per `.json` file on disk (count read with `readdirSync`), and every fixture's `response` validates (`[]`); a copy of `login-wrong-password` with `code` changed to `"OOPS"` does not validate; a fixture directory may hold a non-JSON file (test against a temporary directory through an optional `dir` parameter: `loadFixtures(slug, dir?)`).
- [ ] **Step 2: Run it and see it fail** (module not found).
- [ ] **Step 3: Implement** `test/replay.ts` (`ajv/dist/2020.js`, `strict: true`, `allErrors: true`, `ajv-formats`).
- [ ] **Step 4: Run** `npm --prefix backend test`: all pass; ten fixtures reported valid.
- [ ] **Step 5: Commit** `test(backend): contract replay rig, fixtures and schemas`.

### Task 4: Replay rig, placeholders and replay modes

**Files:**
- Modify: `backend/test/replay.ts`
- Test: `backend/test/replay.test.ts`

**Interfaces:**
- Consumes: `Fixture`, `loadFixtures`, `responseValidator` (Task 3).
- Produces: `type PlaceholderHooks = { token(username: string): Promise<string>; expiredToken(username: string): Promise<string> }`; `function fillHeaders(headers: Record<string, string>, hooks: PlaceholderHooks): Promise<Record<string, string>>` (replaces `{{token:<username>}}` and `{{expired-token:<username>}}`); `function replayFixture(app: FastifyInstance, slug: ContractSlug, fixture: Fixture, hooks: PlaceholderHooks): Promise<string[]>` (empty means the fixture reproduced). `exact`: status and parsed body deep-equal the fixture. `schema`: status equal and the body valid. Any hook rejection becomes one problem string naming the fixture.

- [ ] **Step 1: Write the failing tests**: `fillHeaders` turns `Bearer {{token:ayu}}` into `Bearer T-ayu` and `Bearer {{expired-token:ayu}}` into `Bearer X-ayu` with stub hooks; against a throwaway Fastify app whose routes echo a fixture's response, `replayFixture` returns `[]` for every fixture of both contracts; with one body field changed it returns a problem naming the fixture; with hooks that reject for `budi`, `me-budi` returns a problem and the test does not throw.
- [ ] **Step 2: Run them and see them fail** (`fillHeaders` is not exported).
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: Run the gate** `npm --prefix backend run gate` and keep the output for the verification doc.
- [ ] **Step 5: Commit** `test(backend): placeholders and replay modes`.

### Task 5: Verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.1.verification.md`

- [ ] **Step 1:** Write it from `hsdd/templates/verification.md` at gate-only depth: commands (including `npm --prefix backend install` for a fresh checkout), expected output, Observed (dated, from Task 4's gate run), a 3 to 5 line checklist, Outstanding, Learnings with dispositions or `- none`, Metrics. Leave Sign-off blank.
- [ ] **Step 2: Commit** `docs(hsdd): simple-login.backend.1 verification doc`.

## Execution handoff

The owner is unavailable and asked for no questions. Native execution
(`superpowers:executing-plans`) is used: five small tasks with tight
interfaces between them, and a gate-only tier, so a fresh reviewer per task
would cost more than a shipped mistake here.

## Plan check (from the derivative)

- [x] The plan's Global Constraints contain constraints 1 to 8 above, verbatim.
- [x] Every `### Task N:` except the last starts with a failing-test step.
- [x] The last task writes the verification doc named in constraint 5.
- [x] The plan has at most 5 tasks.
- [x] The plan is saved under docs/superpowers/plans/.
