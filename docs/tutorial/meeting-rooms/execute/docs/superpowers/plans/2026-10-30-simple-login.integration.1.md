# simple-login.integration.1: End-to-end run and browser test. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command starts the real backend and the real web app, and one command proves every PRD acceptance criterion in a real browser against them.

**Architecture:** A root `package.json` that owns only scripts and the browser-test dependency; `backend/` and `web/` stay untouched. A small Node script runs both dev servers. Playwright drives the installed Chrome; the web dev server is a Playwright `webServer`, while the backend is a worker fixture the tests can restart, because a restart is the only way to make a stored token unknown without reading the web app's internals.

**Tech Stack:** Node.js 24.2+, `@playwright/test` with `channel: "chrome"` (no browser download), `node:test` for the dev-script test.

**Spec:** `hsdd-context/superpowers/simple-login.integration.1.md`. The screens' visible text comes from the PRD (`hsdd/context/prd-simple-login.md`, US-1 to US-3), not from the web app's code.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm test` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.integration.1.verification.md from
   hsdd/templates/verification.md at full-review depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier full-review: design rationale for every non-obvious choice; full verification doc.

Pinned values: backend `http://127.0.0.1:3000` (contracts); web dev server
`http://localhost:5173` (RFC §1); demo accounts `ayu` / `sunrise-42`,
`budi` / `harbor-17`; messages "Incorrect username or password.", "Your
session has expired. Please sign in again."; Home shows "Hello, {displayName}",
username, email, member since "14 March 2024"; Home within 3 seconds of
Sign in.

## Design rationale (full-review)

- **Restart instead of seeding storage (AC-2.3).** The phase Scope says
  "seeded with a token the backend never issued". Seeding needs the web
  app's storage key and shape, which are web internals (web D2), and
  constraint 7 forbids them. Restarting the backend makes the browser's
  stored token one the backend no longer knows; profile-api@v1 guarantees
  that answers exactly like an expired token, and ADR-001 says a restart
  signs everyone out, so the test also proves that consequence. Ledgered
  as a ruling.
- **Backend as a worker fixture, web as a `webServer`.** Playwright cannot
  restart a `webServer`; the fixture owns the process. One worker
  (`workers: 1`) so the restart never races another test.
- **The installed Chrome** (`channel: "chrome"`): no browser download, no
  extra install step for a newcomer who has Chrome. `PW_CHANNEL` overrides.
- **Selectors are the PRD's words** (`getByLabel("Username")`,
  `getByRole("button", { name: "Sign in" })`), so the test fails if the
  screens drift from the PRD, and never depends on markup.
- **These tests check behavior that already exists.** Their failing step
  comes from missing wiring (config, fixture, helpers). To prove a passing
  test can still catch a regression, Task 3 includes one mutation check:
  break one message in the web app, see the browser test fail, revert.

## Review Focus

1. Ports already taken (a developer's own `npm run dev` still running): `npm test` must say so rather than test a stale server. Pinned in Task 2 (`reuseExistingServer: false`, `strictPort`).
2. Ctrl-C on `npm run dev` must stop both servers, leaving no orphan holding port 3000. Pinned in Task 1.
3. One server crashing under `npm run dev`: the other stops too, and the script exits non-zero. Pinned in Task 1.
4. The proxy path: a request through `localhost:5173/api` must reach the backend unchanged (headers and body). Pinned in Task 5.
5. A slow first compile in Vite making "Home within 3 seconds" flaky: the clock starts at the click, after the page has loaded. Pinned in Task 2.

---

### Task 1: Root scripts and the dev runner

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`, `package-lock.json`, `test-results/`, `playwright-report/`), `scripts/dev.mjs`, `scripts/dev.test.mjs`, `README.md`

**Interfaces:**
- Produces: scripts `install:all` (backend, web, root), `dev` (`node scripts/dev.mjs`), `e2e` (`playwright test`), `test` (backend gate, backend replay, web gate, `node --test scripts/`, then `e2e`); `scripts/dev.mjs` spawns `npm --prefix backend start` and `npm --prefix web run dev -- --strictPort`, prefixes each line with `[backend]` or `[web]`, and on SIGINT or SIGTERM, or when either child exits, stops the other and exits with the first non-zero code.

- [ ] **Step 1: Write the failing tests** `scripts/dev.test.mjs` (node:test): spawn `node scripts/dev.mjs`; within 20 s `POST http://127.0.0.1:3000/api/login` with Ayu's credentials answers 200 and `GET http://localhost:5173/` answers 200; after SIGINT the process exits and both ports refuse connections. Second test: with `PORT` pointing the backend at a port already held by the test, the runner exits non-zero within 20 s and port 5173 is free again.
- [ ] **Step 2: Run** `node --test scripts/`: FAIL, `scripts/dev.mjs` not found.
- [ ] **Step 3: Implement** `package.json` (`"private": true`, `"type": "module"`, `engines.node >=24.2`, dev dependency `@playwright/test`), `scripts/dev.mjs` (spawn with `detached: false`, forward signals, kill the sibling on exit), and `README.md` (what this is, prerequisites, `npm run install:all`, `npm run dev`, the demo accounts, `npm test`, the layout).
- [ ] **Step 4: Run** `node --test scripts/`: PASS.
- [ ] **Step 5: Commit** `feat(integration): root scripts and a dev runner that starts and stops both servers`.

### Task 2: Browser test rig, and signing in (AC-1.1, success metric)

**Files:**
- Create: `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/login.spec.ts`

**Interfaces:**
- Produces: `e2e/fixtures.ts` exports `test` (Playwright `test` extended with a worker-scoped `backend: { restart(): Promise<void> }` that starts `node backend/src/server.ts` and waits for `127.0.0.1:3000`), `expect`, and `signIn(page: Page, username: string, password: string): Promise<void>` (fills the PRD's fields and clicks Sign in).
- Config: `testDir: "e2e"`, `workers: 1`, `use: { baseURL: "http://localhost:5173", channel: process.env.PW_CHANNEL ?? "chrome" }`, one `webServer`: `npm --prefix web run dev -- --strictPort` at `http://localhost:5173`, `reuseExistingServer: false`.

- [ ] **Step 1: Write the failing test** `login.spec.ts`: "AC-1.1: the right password reaches Home within 3 seconds": open `/`, start a clock, `signIn(page, "ayu", "sunrise-42")`, expect the heading "Hello, Ayu Lestari" visible, elapsed under 3000 ms.
- [ ] **Step 2: Run** `npm run e2e`: FAIL (no config, then `fixtures.ts` missing).
- [ ] **Step 3: Implement** the config and `fixtures.ts`.
- [ ] **Step 4: Run** `npm run e2e`: PASS.
- [ ] **Step 5: Commit** `test(integration): browser rig and AC-1.1 against the real service`.

### Task 3: The rest of US-1, US-2 and US-3

**Files:**
- Modify: `e2e/login.spec.ts`; create `e2e/home.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `signIn` (Task 2).

- [ ] **Step 1: Write the tests**: AC-1.2 (wrong password and unknown user each show "Incorrect username or password." and Sign in is still there); AC-1.3 (Sign in disabled with either field empty); AC-2.1 (Home shows `ayu`, `ayu@example.com`, "14 March 2024"); AC-2.2 (after `page.reload()` Home is still shown); AC-3.1 (Sign out returns to the Login form; a reload stays on Login); Budi sees Budi's profile, not Ayu's. They use a `signOut(page)` helper that does not exist yet.
- [ ] **Step 2: Run** `npm run e2e`: FAIL, `signOut` is not exported.
- [ ] **Step 3: Implement** `signOut(page: Page): Promise<void>` in `fixtures.ts`.
- [ ] **Step 4: Run** `npm run e2e`: PASS. Mutation check: change "Incorrect username or password." in the web app's message table, run AC-1.2, see it fail, revert, see it pass. Record both outputs.
- [ ] **Step 5: Commit** `test(integration): every US-1 to US-3 criterion in the browser`.

### Task 4: Expiry through a backend restart (AC-2.3)

**Files:**
- Modify: `e2e/home.spec.ts`, `e2e/fixtures.ts`

- [ ] **Step 1: Write the failing test**: "AC-2.3: a session the backend no longer knows returns to Login with the expiry message": sign in as Ayu, `await backend.restart()`, `page.reload()`, expect "Your session has expired. Please sign in again." and the Login form.
- [ ] **Step 2: Run** `npm run e2e -- -g AC-2.3`: FAIL, `restart` is not implemented (it throws "not implemented").
- [ ] **Step 3: Implement** `restart()`: stop the child, wait for the port to close, start a new one, wait for it to answer.
- [ ] **Step 4: Run** `npm run e2e`: PASS.
- [ ] **Step 5: Commit** `test(integration): AC-2.3 through a backend restart (ADR-001)`.

### Task 5: Contract replay through the dev proxy, and the gate

**Files:**
- Create: `e2e/proxy-replay.spec.ts`

- [ ] **Step 1: Write the failing test**: for every fixture of auth-api@v1 and profile-api@v1 whose `replay` is `exact`, send its request with Playwright's `request` to `http://localhost:5173` + path, filling `{{token:u}}` by signing in through the proxy and `{{expired-token:u}}` by signing in and then `backend.restart()` (an unknown token answers the expired body byte for byte, profile-api@v1); expect status and JSON body to equal the fixture's. The fixtures are read from `hsdd/contract/fixture/` through a `loadExactFixtures()` helper that does not exist yet.
- [ ] **Step 2: Run** `npm run e2e -- proxy-replay`: FAIL, `loadExactFixtures` is not exported.
- [ ] **Step 3: Implement** `loadExactFixtures(): Array<{ slug: string; fixture: Fixture }>` in `fixtures.ts`.
- [ ] **Step 4: Run the gate** `npm test` from a state where nothing is running; keep the output. Then the manual check: `npm run dev`, open `http://localhost:5173` in Chrome, sign in as `ayu`, reload, sign out, try a wrong password; Ctrl-C and confirm both ports are free.
- [ ] **Step 5: Commit** `test(integration): contract replay through the dev proxy`.

### Task 6: Verification doc

**Files:**
- Create: `hsdd/verify/simple-login.integration.1.verification.md`

- [ ] **Step 1:** Write it from `hsdd/templates/verification.md` at full-review depth, every section, with Task 5's gate output under Observed. Leave Sign-off blank.
- [ ] **Step 2: Commit** `docs(hsdd): simple-login.integration.1 verification doc`.

## Execution handoff

The owner is unavailable. Native execution (`superpowers:executing-plans`):
five tasks that share one test rig, and a fresh reviewer at the end on
the whole phase, as for every full-review phase in this run.

## Plan check (from the derivative)

- [x] The plan's Global Constraints contain constraints 1 to 8 above, verbatim.
- [x] Every `### Task N:` except the last starts with a failing-test step.
- [x] The last task writes the verification doc named in constraint 5.
- [x] The plan has at most 6 tasks.
- [x] The plan is saved under docs/superpowers/plans/.
