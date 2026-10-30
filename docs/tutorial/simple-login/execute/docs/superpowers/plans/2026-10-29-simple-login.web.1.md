# simple-login.web.1 App skeleton, API client, session storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `web/` package with a placeholder App, the `/api` dev proxy, a fixture-backed `fetch` stub, the typed API client (`signIn`, `fetchProfile`) and the `sessionStorage` session store.

**Architecture:** The API client is a thin effectful shell (`fetch`, JSON parse) over two pure deciders that map `(status, error.code)` to a `Result` value; anything the contract does not name maps to `unavailable`. The session store is three functions over an injectable `Storage`, defaulting to `window.sessionStorage`, that never throw. Tests stub the global `fetch` with the contract fixtures, routed by the fixture's `request.method` and `request.path`.

**Tech Stack:** React 19.3, TypeScript 7.0, Vite 8.3, @vitejs/plugin-react 6.1, Vitest 5.0 with jsdom 30, @testing-library/react 16.3, @testing-library/user-event 14.6, @testing-library/jest-dom 7.0, @types/node for the fixture loader.

**Spec:** `hsdd-context/superpowers/simple-login.web.1.md` (paths in this plan are relative to the tutorial project root, the directory holding `hsdd/` and `web/`; every command runs from there).

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix web run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.web.1.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.

Phase-specific values, copied from the phase context:

- Gate: `npm run gate` = `tsc --noEmit`, then `vitest run`, then `vite build`.
- Dev proxy: `/api` to `http://127.0.0.1:3000` (auth-api@v1), not `localhost`.
- Failure reasons: `invalid-credentials`, `invalid-input`, `unauthorized`, `unavailable`, decided by status and `error.code`, never by message.
- Session storage (D2): `sessionStorage`, one key `simple-login.session`, value `{ token, expiresAt }`.
- Mocks: `fetch` is stubbed with the fixtures in `hsdd/contract/fixture/{auth-api,profile-api}/`; no hand-written response mocks. A rejected `fetch` (network failure) is not a response and may be simulated.
- Commits: one commit for the whole phase, in the last task (orchestrator instruction). `web/package-lock.json` is gitignored (orchestrator instruction: the pre-commit guard can match lockfile hashes).

## Design notes (decisions this phase settles)

- **Fixture routing.** `stubFetch(...fixtures)` answers a call with the fixture whose `request.method` and `request.path` match; two fixtures on one route is an error at stub time, an unmatched call rejects. Tests that need a different answer on the same route re-stub. This keeps every answer a real fixture and makes a wrong URL fail loudly.
- **Non-contract answers are `unavailable`.** Any status, `error.code` or 200 body shape the contract does not name, a non-JSON body, or a rejected `fetch` becomes `unavailable` (D3's "network failure or unexpected status").
- **The store does not judge expiry.** `loadSession` returns a well-formed stored session even if `expiresAt` is past; D1 makes `GET /api/me` the only expiry check.
- **The store never throws.** Storage that is missing or throws (`SecurityError`, quota) degrades to "no session".

## Review Focus

1. Storage that throws on access (privacy mode, disabled site data): `loadSession` returns `null`, `saveSession` and `clearSession` do nothing and do not throw. Test in Task 4.
2. A stored value that is not ours (corrupt JSON, wrong shape, an older build's format): `loadSession` returns `null` instead of crashing. Test in Task 4.
3. A username with case or surrounding spaces (`Ayu `): sent exactly as typed, never trimmed. Test in Task 3.
4. The backend is down: `fetch` rejects, giving `unavailable`. Test in Task 3. The dev proxy's own error status when the backend is down is not a fixture; Task 5 observes it against the real dev server.
5. A token is sent back verbatim as `Bearer {token}`, never parsed or encoded. Test in Task 3.

---

### Task 1: Package skeleton, placeholder App, dev proxy

**Files:**
- Create: `web/package.json`, `web/.gitignore`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/test/setup.ts`
- Test: `web/src/App.test.tsx`, `web/src/viteConfig.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export default function App()` in `web/src/App.tsx` (phase 3 replaces its body); the test setup file that later tasks rely on (jest-dom matchers, RTL `cleanup`, `vi.unstubAllGlobals()` and `sessionStorage.clear()` after each test).

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/App.test.tsx
it('renders the app title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Simple Login' })).toBeInTheDocument()
})
```

```ts
// web/src/viteConfig.test.ts  (first line: // @vitest-environment node)
it('proxies /api to the backend development address', () => {
  expect(config.server?.proxy?.['/api']).toMatchObject({ target: 'http://127.0.0.1:3000' })
})
```

- [ ] **Step 2: Add the tooling the tests need to run**

`web/package.json`: `"private": true`, `"type": "module"`, scripts `dev` = `vite`, `build` = `vite build`, `test` = `vitest run`, `typecheck` = `tsc --noEmit`, `gate` = `tsc --noEmit && vitest run && vite build`; dependencies `react`, `react-dom` at `^19.3`; devDependencies at the versions in Tech Stack plus `@types/react`, `@types/react-dom`, `@types/node`. `web/.gitignore`: `node_modules/`, `dist/`, `package-lock.json`. `web/tsconfig.json`: strict, `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit`, `types: ["vite/client", "node"]`, include `src` and `vite.config.ts`. `web/vite.config.ts`: `defineConfig` from `vitest/config`, the React plugin, `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`, no `server` block yet. `web/src/test/setup.ts` as in Interfaces. Run `npm --prefix web install`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm --prefix web exec -- vitest run`
Expected: FAIL. `App.test.tsx` cannot resolve `./App`; `viteConfig.test.ts` gets `undefined` for the proxy entry.

- [ ] **Step 4: Implement**

`web/src/App.tsx`: `<main><h1>Simple Login</h1></main>`. `web/src/main.tsx`: `createRoot(document.getElementById('root')!)` rendering `<StrictMode><App /></StrictMode>`. `web/index.html`: `lang="en"`, viewport meta, `<title>Simple Login</title>`, `<div id="root">`, module script `/src/main.tsx`. `web/vite.config.ts`: `server: { proxy: { '/api': { target: 'http://127.0.0.1:3000' } } }`.

- [ ] **Step 5: Run the gate**

Run: `npm --prefix web run gate`
Expected: `tsc` prints nothing, Vitest reports 2 passed, Vite writes `web/dist/index.html`.

### Task 2: Fixture-backed fetch stub

**Files:**
- Create: `web/src/test/fetchStub.ts`
- Test: `web/src/test/fetchStub.test.ts`

**Interfaces:**
- Consumes: the fixture files at `hsdd/contract/fixture/{auth-api,profile-api}/*.json`, located with `new URL('../../../hsdd/contract/fixture/', import.meta.url)`.
- Produces:

```ts
export type FixtureApi = 'auth-api' | 'profile-api'
export interface Fixture {
  name: string; description: string
  request: { method: string; path: string; headers: Record<string, string>; body?: unknown }
  response: { status: number; body: unknown }
  replay: 'exact' | 'schema'
}
export interface RecordedCall { method: string; path: string; headers: Record<string, string>; body: unknown }
export interface FetchStub { readonly calls: RecordedCall[] }
export function loadFixture(api: FixtureApi, name: string): Fixture
export function listFixtures(api: FixtureApi): Fixture[]          // sorted by name
export function stubFetch(...fixtures: Fixture[]): FetchStub       // vi.stubGlobal('fetch', ...)
export function stubFetchUnreachable(): FetchStub                  // every call rejects with TypeError
```

`RecordedCall.headers` has lower-cased names; `body` is the parsed JSON request body, or `undefined` when there is none.

- [ ] **Step 1: Write the failing tests**

```ts
it('lists the five fixtures of each API', () => {
  expect(listFixtures('auth-api').map((f) => f.name)).toEqual([
    'login-empty-username', 'login-missing-password', 'login-success',
    'login-unknown-user', 'login-wrong-password'])
  expect(listFixtures('profile-api').map((f) => f.name)).toEqual([
    'me-ayu', 'me-budi', 'me-expired-token', 'me-no-token', 'me-unknown-token'])
})
it('answers a matching call with the fixture response and records it', async () => {
  const fixture = loadFixture('auth-api', 'login-success')
  const stub = stubFetch(fixture)
  const res = await fetch('/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ayu', password: 'sunrise-42' }) })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fixture.response.body)
  expect(stub.calls).toEqual([{ method: 'POST', path: '/api/login',
    headers: { 'content-type': 'application/json' },
    body: { username: 'ayu', password: 'sunrise-42' } }])
})
it('rejects a call no fixture matches', async () => {
  stubFetch(loadFixture('auth-api', 'login-success'))
  await expect(fetch('/api/me')).rejects.toThrow('no fixture for GET /api/me')
})
it('refuses two fixtures on one route', () => {
  expect(() => stubFetch(loadFixture('auth-api', 'login-success'),
    loadFixture('auth-api', 'login-wrong-password'))).toThrow('two fixtures for POST /api/login')
})
it('simulates an unreachable server', async () => {
  stubFetchUnreachable()
  await expect(fetch('/api/login', { method: 'POST' })).rejects.toBeInstanceOf(TypeError)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web exec -- vitest run src/test/fetchStub.test.ts`
Expected: FAIL, cannot resolve `./fetchStub`.

- [ ] **Step 3: Implement `web/src/test/fetchStub.ts`**

Read fixtures with `readFileSync`/`readdirSync`. The stub builds a `Response` from `JSON.stringify(fixture.response.body)` with the fixture's status and `content-type: application/json`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web exec -- vitest run src/test/fetchStub.test.ts`
Expected: 5 passed.

### Task 3: API client

**Files:**
- Create: `web/src/api/types.ts`, `web/src/api/client.ts`
- Test: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: `loadFixture`, `listFixtures`, `stubFetch`, `stubFetchUnreachable` (Task 2).
- Produces:

```ts
// web/src/api/types.ts
export interface Session { readonly token: string; readonly expiresAt: string }
export interface Profile { readonly id: string; readonly username: string
  readonly displayName: string; readonly email: string; readonly memberSince: string }
export type SignInFailure = 'invalid-credentials' | 'invalid-input' | 'unavailable'
export type ProfileFailure = 'unauthorized' | 'unavailable'
export type Result<T, F> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: F }
// web/src/api/client.ts
export function signIn(username: string, password: string): Promise<Result<Session, SignInFailure>>
export function fetchProfile(token: string): Promise<Result<Profile, ProfileFailure>>
```

- [ ] **Step 1: Write the failing tests**

```ts
const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const signInCases: Record<string, Result<Session, SignInFailure>> = {
  'login-success': { ok: true, value: { token: TOKEN, expiresAt: '2026-10-29T10:30:00.000Z' } },
  'login-empty-username': { ok: false, reason: 'invalid-input' },
  'login-missing-password': { ok: false, reason: 'invalid-input' },
  'login-unknown-user': { ok: false, reason: 'invalid-credentials' },
  'login-wrong-password': { ok: false, reason: 'invalid-credentials' },
}
const profileCases: Record<string, Result<Profile, ProfileFailure>> = {
  'me-ayu': { ok: true, value: { id: 'u_001', username: 'ayu', displayName: 'Ayu Lestari',
    email: 'ayu@example.com', memberSince: '2024-03-14' } },
  'me-budi': { ok: true, value: { id: 'u_002', username: 'budi', displayName: 'Budi Santoso',
    email: 'budi@example.com', memberSince: '2025-01-09' } },
  'me-expired-token': { ok: false, reason: 'unauthorized' },
  'me-no-token': { ok: false, reason: 'unauthorized' },
  'me-unknown-token': { ok: false, reason: 'unauthorized' },
}
it('maps every fixture', () => {   // a new fixture fails here until it is mapped
  expect(Object.keys(signInCases).sort()).toEqual(listFixtures('auth-api').map((f) => f.name))
  expect(Object.keys(profileCases).sort()).toEqual(listFixtures('profile-api').map((f) => f.name))
})
it.each(Object.entries(signInCases))('signIn: %s', async (name, expected) => {
  const fixture = loadFixture('auth-api', name)
  stubFetch(fixture)
  const body = fixture.request.body as { username?: string; password?: string }
  expect(await signIn(body.username ?? '', body.password ?? '')).toEqual(expected)
})
it.each(Object.entries(profileCases))('fetchProfile: %s', async (name, expected) => {
  stubFetch(loadFixture('profile-api', name))
  expect(await fetchProfile(TOKEN)).toEqual(expected)
})
it('signIn posts the username exactly as typed', async () => {
  const stub = stubFetch(loadFixture('auth-api', 'login-unknown-user'))
  await signIn('Ayu ', 'sunrise-42')
  expect(stub.calls).toEqual([{ method: 'POST', path: '/api/login',
    headers: { 'content-type': 'application/json' },
    body: { username: 'Ayu ', password: 'sunrise-42' } }])
})
it('fetchProfile sends the token back verbatim', async () => {
  const stub = stubFetch(loadFixture('profile-api', 'me-ayu'))
  await fetchProfile(TOKEN)
  expect(stub.calls).toEqual([{ method: 'GET', path: '/api/me',
    headers: { authorization: `Bearer ${TOKEN}` }, body: undefined }])
})
it('an unreachable server is unavailable', async () => {
  stubFetchUnreachable()
  expect(await signIn('ayu', 'sunrise-42')).toEqual({ ok: false, reason: 'unavailable' })
  expect(await fetchProfile(TOKEN)).toEqual({ ok: false, reason: 'unavailable' })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web exec -- vitest run src/api/client.test.ts`
Expected: FAIL, cannot resolve `./client`.

- [ ] **Step 3: Implement `web/src/api/types.ts` and `web/src/api/client.ts`**

A private `send(path, init): Promise<{ status: number; body: unknown } | null>` does `fetch` and `res.json()`, returning `null` when either throws. Private pure deciders `decideSignIn(status, body)` and `decideProfile(status, body)` switch on status and `error.code`: login 200 with string `token` and `expiresAt` gives the session `{ token, expiresAt }` (no `tokenType`), 400 `VALIDATION_FAILED` gives `invalid-input`, 401 `INVALID_CREDENTIALS` gives `invalid-credentials`; me 200 with five string fields gives the profile (picked field by field), 401 `UNAUTHORIZED` gives `unauthorized`; everything else gives `unavailable`. `error.message` is never read.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web exec -- vitest run src/api/client.test.ts`
Expected: 14 passed.

### Task 4: Session store

**Files:**
- Create: `web/src/session/store.ts`
- Test: `web/src/session/store.test.ts`

**Interfaces:**
- Consumes: `Session` (Task 3).
- Produces:

```ts
export const SESSION_KEY = 'simple-login.session'
export function loadSession(storage?: Storage): Session | null
export function saveSession(session: Session, storage?: Storage): void
export function clearSession(storage?: Storage): void
```

Omitted `storage` means `window.sessionStorage`, looked up inside a `try` because the lookup itself can throw.

- [ ] **Step 1: Write the failing tests**

```ts
const session: Session = { token: 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ', expiresAt: '2026-10-29T10:30:00.000Z' }
it('round-trips a session through sessionStorage', () => {
  saveSession(session)
  expect(loadSession()).toEqual(session)
})
it('writes only token and expiresAt under simple-login.session', () => {
  saveSession({ ...session, tokenType: 'Bearer' } as Session)
  expect(sessionStorage.getItem('simple-login.session')).toBe(
    '{"token":"q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ","expiresAt":"2026-10-29T10:30:00.000Z"}')
})
it('has no session when nothing is stored', () => { expect(loadSession()).toBeNull() })
it.each(['not json', '{"token":1,"expiresAt":"x"}', '{"token":"x"}', 'null', '[]'])(
  'ignores a stored value that is not a session: %s', (raw) => {
    sessionStorage.setItem('simple-login.session', raw)
    expect(loadSession()).toBeNull()
  })
it('returns a past-dated session as stored (D1: the server judges expiry)', () => {
  const old = { ...session, expiresAt: '2000-01-01T00:00:00.000Z' }
  saveSession(old)
  expect(loadSession()).toEqual(old)
})
it('clearSession removes only its own key', () => {
  saveSession(session); sessionStorage.setItem('other', '1')
  clearSession()
  expect(sessionStorage.getItem('simple-login.session')).toBeNull()
  expect(sessionStorage.getItem('other')).toBe('1')
})
it('never throws when storage throws', () => {
  const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') },
    removeItem: () => { throw new Error('denied') } } as unknown as Storage
  expect(loadSession(broken)).toBeNull()
  expect(() => saveSession(session, broken)).not.toThrow()
  expect(() => clearSession(broken)).not.toThrow()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web exec -- vitest run src/session/store.test.ts`
Expected: FAIL, cannot resolve `./store`.

- [ ] **Step 3: Implement `web/src/session/store.ts`**

`saveSession` writes `JSON.stringify({ token, expiresAt })` picked from the argument. `loadSession` parses and accepts only an object with string `token` and string `expiresAt`, returning a fresh `{ token, expiresAt }`. Every storage call sits in a `try`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web exec -- vitest run src/session/store.test.ts`
Expected: 11 passed.

### Task 5: Gate, dev-server check, verification doc, commit

**Files:**
- Create: `hsdd/verify/simple-login.web.1.verification.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the phase's verification doc and the phase commit.

- [ ] **Step 1: Run the gate and keep its output**

Run: `npm --prefix web run gate 2>&1 | tee <scratchpad>/web1-gate.txt`
Expected: `tsc` silent, Vitest `Test Files  5 passed (5)` and `Tests  32 passed (32)`, Vite `built in`.

- [ ] **Step 2: Serve the placeholder page and observe the proxy**

Run `npm --prefix web run dev -- --host 127.0.0.1 --port 5173 --strictPort` in the background, then `curl -s http://127.0.0.1:5173/` (expect `<div id="root">` and `<title>Simple Login</title>`) and `curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:5173/api/login` with no backend running (record the status the proxy gives; the client maps it to `unavailable`). Stop the server.

- [ ] **Step 3: Write `hsdd/verify/simple-login.web.1.verification.md`**

From `hsdd/templates/verification.md` at spot-check depth: Commands to run (install, gate, dev check), Expected output, Observed (dated, from Steps 1 and 2), Outstanding, Learnings ("- none" or dispositioned entries), Metrics (agent wall-clock, gate failures before green, product vs process lines). Sign-off fields stay blank. No em-dash characters.

- [ ] **Step 4: Commit the phase**

```bash
git add web/ docs/superpowers/plans/2026-10-29-simple-login.web.1.md hsdd/verify/simple-login.web.1.verification.md
git commit -m "feat(tutorial): simple-login.web.1 App skeleton, API client, session storage" -m "<two or three body lines>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Check `git show --stat HEAD` lists no `package-lock.json`, nothing under `node_modules/` or `dist/`.
