# simple-login.backend.2: Sign-in, sessions and the two endpoints. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The real `POST /api/login` and `GET /api/me`, producing auth-api@v1 and profile-api@v1, proven by replaying all ten contract fixtures against the real routes.

**Architecture:** A pure core (request parsing, the token header, expiry arithmetic) and a thin imperative shell (scrypt, the in-memory session `Map`, Fastify). `buildApp` from phase 1 keeps its signature; it now creates the session store from the injected clock and random source and registers the routes. `server.ts` is the only file that reads the real clock, `crypto.randomBytes` and `process.env`.

**Tech Stack:** Node.js 24, TypeScript, Fastify 5, Vitest; the phase 1 replay rig (`backend/test/replay.ts`).

**Spec:** `hsdd-context/superpowers/simple-login.backend.2.md`. Its Scope cites the node's D1 and D2, which are not injected; their content reached the contracts through reconcile (auth-api@v1: "Usernames match exactly: case-sensitive, with no trimming"; both: "Development address ... `http://127.0.0.1:3000`; the `PORT` environment variable overrides the port").

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 7 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix backend run gate plus contract replay for auth-api and profile-api: npm --prefix backend run replay` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.2.verification.md from
   hsdd/templates/verification.md at full-review depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier full-review: design rationale for every non-obvious choice; full verification doc.

Values pinned by the contracts and ADR-001: token = 32 random bytes,
base64url, 43 characters; lifetime exactly 30 minutes (`1_800_000` ms);
messages `Username and password are required.`, `Incorrect username or
password.`, `Sign in to continue.`; username 1 to 64 characters, password 1
to 128; profile has exactly `id, username, displayName, email,
memberSince`.

## Design rationale (full-review)

- **Async scrypt** (`crypto.scrypt`, promisified) rather than `scryptSync`:
  one comparison costs tens of milliseconds, and a sync call would stall
  every other request for that long.
- **Dummy hash for unknown users** (RFC §4): `authenticate` always runs
  exactly one comparison, so response time does not reveal whether a
  username exists. The verifier is a parameter so the test can count calls
  without timing anything.
- **"Valid until expiresAt" means `now < expiresAt`.** At exactly
  `expiresAt` the token is rejected; the contract says "accepted until
  `expiresAt`, and rejected after it", and the strict inequality is the
  conservative reading.
- **Own content-type handling.** Fastify answers a non-JSON content type
  with 415 and malformed JSON with its own 400 shape before any handler
  runs. The login route instead takes the raw body as a string and parses
  it in a pure function, so every malformed request reaches one code path
  and gets the contract's 400 envelope. A Fastify-level error on
  `/api/login` (such as a body over the size limit) is mapped to the same
  400 by the app's error handler.
- **Bearer scheme is case-insensitive** (`Bearer`, `bearer`), per HTTP
  authentication syntax; anything else is a 401.
- **Logging:** the service logs with Fastify's default request
  serializers, which record method, URL and address, never headers or
  bodies, so neither the password nor the token reaches a log line (RFC
  §9). A test captures the log stream to prove it.

## Review Focus

1. Two sign-ins for the same user: both tokens stay valid; the second must not evict the first. Pinned in Task 2.
2. A login body larger than Fastify's 1 MiB limit: the contract says any invalid body is 400 `VALIDATION_FAILED`, not Fastify's 413. Pinned in Task 4.
3. A token presented at exactly `expiresAt`: rejected (strict inequality). Pinned in Task 2.
4. `Authorization: bearer <token>` (lower-case scheme) and extra fields in the login JSON: accepted, as the contracts allow. Pinned in Task 3.
5. A sign-in whose response or log could leak the password or the token: neither appears in any log line. Pinned in Task 5.

---

### Task 1: Password verification

**Files:**
- Create: `backend/src/passwords.ts`
- Test: `backend/test/passwords.test.ts`

**Interfaces:**
- Consumes: `Account`, `PasswordHash` (`src/domain.ts`); `ACCOUNTS` (`src/accounts.ts`).
- Produces: `function verifyPassword(password: string, stored: PasswordHash): Promise<boolean>` (scrypt `N = 16384, r = 8, p = 1`, 64-byte key, `timingSafeEqual`); `const DUMMY_HASH: PasswordHash`; `type Verify = typeof verifyPassword`; `function authenticate(accounts: readonly Account[], username: string, password: string, verify?: Verify): Promise<Account | undefined>`.

- [ ] **Step 1: Write the failing tests**: `verifyPassword("sunrise-42", ayu.password)` is `true`; `"sunset-42"` is `false`; `authenticate(ACCOUNTS, "ayu", "sunrise-42")` returns Ayu; wrong password returns `undefined`; `authenticate(ACCOUNTS, "Ayu", "sunrise-42")` returns `undefined` (exact match); with a counting `verify`, an unknown username calls it exactly once, with `DUMMY_HASH`.
- [ ] **Step 2: Run** `npm --prefix backend test -- passwords`: FAIL, module not found.
- [ ] **Step 3: Implement** `src/passwords.ts`. `DUMMY_HASH` is a fixed salt and the key of a random string, generated once like the account hashes.
- [ ] **Step 4: Run** the same command: PASS.
- [ ] **Step 5: Commit** `feat(backend): password verification with a dummy hash for unknown users`.

### Task 2: Session store

**Files:**
- Create: `backend/src/sessions.ts`
- Test: `backend/test/sessions.test.ts`

**Interfaces:**
- Consumes: `Clock`, `RandomBytes`, `Session` (`src/domain.ts`).
- Produces: `const SESSION_TTL_MS = 1_800_000`; `type SessionStore = { issue(accountId: string): Session; resolve(token: string): Session | undefined }`; `function createSessionStore(clock: Clock, randomBytes: RandomBytes): SessionStore`; `function isLive(session: Session, now: Date): boolean` (pure: `now < expiresAt`).

- [ ] **Step 1: Write the failing tests** (a test clock whose time the test moves): `issue` returns a 43-character `[A-Za-z0-9_-]` token made from `randomBytes(32)` and `expiresAt` exactly `SESSION_TTL_MS` after the clock; `resolve` returns the session 1 ms before expiry, `undefined` at exactly `expiresAt` and after it; an unknown token resolves to `undefined`; two `issue` calls for one account give two tokens that both resolve.
- [ ] **Step 2: Run** `npm --prefix backend test -- sessions`: FAIL, module not found.
- [ ] **Step 3: Implement** with a `Map<string, Session>`; `resolve` deletes an expired entry when it sees one.
- [ ] **Step 4: Run**: PASS.
- [ ] **Step 5: Commit** `feat(backend): in-memory session store with a fixed 30-minute lifetime`.

### Task 3: Request parsing (pure)

**Files:**
- Create: `backend/src/requests.ts`
- Test: `backend/test/requests.test.ts`

**Interfaces:**
- Consumes: `Result` (`src/domain.ts`).
- Produces: `type Credentials = { username: string; password: string }`; `function parseLoginRequest(contentType: string | undefined, raw: string): Result<Credentials, "invalid">`; `function parseBearer(header: string | undefined): string | undefined`.

- [ ] **Step 1: Write the failing tests**. `parseLoginRequest`: ok for `application/json` (also `application/json; charset=utf-8`) with both fields, extra fields ignored; invalid for: missing field, empty string, username of 65 characters, password of 129, a number instead of a string, an array body, malformed JSON, an empty body, `text/plain`, no content type. `parseBearer`: `"Bearer abc"` and `"bearer abc"` give `"abc"`; `undefined`, `""`, `"Bearer"`, `"Bearer "`, `"Basic abc"`, `"Bearer a b"` give `undefined`.
- [ ] **Step 2: Run** `npm --prefix backend test -- requests`: FAIL, module not found.
- [ ] **Step 3: Implement** both as pure functions.
- [ ] **Step 4: Run**: PASS.
- [ ] **Step 5: Commit** `feat(backend): pure parsing of the login body and the bearer header`.

### Task 4: The two routes, and the contract replay

**Files:**
- Create: `backend/src/routes.ts`, `backend/test/routes.test.ts`, `backend/test/contract.replay.test.ts`
- Modify: `backend/src/app.ts`, `backend/package.json` (script `replay` = `vitest run test/contract.replay.test.ts`)

**Interfaces:**
- Consumes: Tasks 1 to 3; `toProfile` (`src/accounts.ts`); `replayFixture`, `loadFixtures`, `PlaceholderHooks` (`test/replay.ts`).
- Produces: `function registerRoutes(app: FastifyInstance, deps: { accounts: readonly Account[]; sessions: SessionStore }): void`; `buildApp(deps: AppDeps)` unchanged in signature, now with both routes, the raw-string content-type parser and the error handler.

- [ ] **Step 1: Write the failing tests.** `contract.replay.test.ts`: for every fixture of both contracts, a fresh `buildApp` with the real `ACCOUNTS` and a movable test clock; hooks sign in through the real `POST /api/login` with the PRD's demo passwords (a test-only map), and `expiredToken` moves the clock `SESSION_TTL_MS + 1000` ms after signing in; `replayFixture` returns `[]`. `routes.test.ts`: login 200 has `expiresAt` equal to the clock plus 30 minutes in ISO form; wrong password and unknown user bodies are equal as raw strings; a 2 MiB body is 400 `VALIDATION_FAILED`; `Content-Type: text/plain` is 400 `VALIDATION_FAILED`; Budi's token returns Budi's profile; `bearer` in lower case works.
- [ ] **Step 2: Run** `npm --prefix backend test`: FAIL, every fixture reports `status 404`.
- [ ] **Step 3: Implement** `src/routes.ts` and wire it in `buildApp`.
- [ ] **Step 4: Run** `npm --prefix backend test` and `npm --prefix backend run replay`: PASS; the replay covers ten fixtures.
- [ ] **Step 5: Commit** `feat(backend): POST /api/login and GET /api/me, replayed against the contracts`.

### Task 5: Server entry and log hygiene

**Files:**
- Create: `backend/src/server.ts`, `backend/test/server.test.ts`
- Modify: `backend/src/app.ts` (`AppDeps` gains optional `logger?: FastifyServerOptions["logger"]`, default `false`), `backend/package.json` (script `start` = `node src/server.ts`)

**Interfaces:**
- Produces: `function start(port: number): Promise<FastifyInstance>` (listens on host `127.0.0.1`; the module calls `start(Number(process.env.PORT ?? 3000))` only when `import.meta.main`).

- [ ] **Step 1: Write the failing tests**: an app built with a logger writing to an in-memory stream, after a successful sign-in and a `/api/me` call, has log lines and none contains `sunrise-42` or the issued token; `start(0)` listens on `127.0.0.1` and a real `fetch` of `POST /api/login` with Ayu's credentials returns 200.
- [ ] **Step 2: Run** `npm --prefix backend test -- server`: FAIL, module not found.
- [ ] **Step 3: Implement** `server.ts` and the logger option.
- [ ] **Step 4: Run the gate** `npm --prefix backend run gate && npm --prefix backend run replay`, keep the output; then the manual check: `npm --prefix backend start`, `curl` sign-in as `ayu`, `curl /api/me` with the token, wrong password and unknown user (bodies compared with `diff`).
- [ ] **Step 5: Commit** `feat(backend): server entry on 127.0.0.1 and log hygiene`.

### Task 6: Verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.2.verification.md`

- [ ] **Step 1:** Write it from `hsdd/templates/verification.md` at full-review depth, every section, with Task 5's gate output and the `curl` transcript under Observed. Leave Sign-off blank.
- [ ] **Step 2: Commit** `docs(hsdd): simple-login.backend.2 verification doc`.

## Execution handoff

The owner is unavailable. Native execution (`superpowers:executing-plans`):
six tasks that build on each other in a straight line, and the phase is
full-review, so the fresh reviewer is spent once, on the whole branch at
the end, where it can see the security logic and the routes together.

## Plan check (from the derivative)

- [x] The plan's Global Constraints contain constraints 1 to 8 above, verbatim.
- [x] Every `### Task N:` except the last starts with a failing-test step.
- [x] The last task writes the verification doc named in constraint 5.
- [x] The plan has at most 7 tasks.
- [x] The plan is saved under docs/superpowers/plans/.
