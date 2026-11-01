# simple-login.web.3 Home screen and the session flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Home screen (AC-2.1) and compose the app so a stored session is checked on load (AC-2.2), a 401 sends the user to Login with the expiry message (AC-2.3, D1), signing in shows Home, and Sign out returns to Login (AC-3.1).

**Architecture:** The pure core is a session-flow state machine: `initialState(stored)` and `next(state, event)` over an `AppState` ADT (`checking | signed-in | signed-out`). `App` is the imperative shell. It holds the state with `useReducer`, runs `fetchProfile` while the state is `checking`, writes and clears storage in its event handlers, and renders Login, Home or a loading line from the state. `HomeScreen` is presentational, and a pure `formatMemberSince` renders `YYYY-MM-DD` as `14 March 2024`.

**Tech Stack:** React 19.3, TypeScript 7.0, Vitest 5 + jsdom, Testing Library, the web.1 fixture stub, web.1's client and store, web.2's `LoginScreen`.

**Spec:** `hsdd-context/superpowers/simple-login.web.3.md` (paths relative to the tutorial project root; every command runs from there).

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix web run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.web.3.verification.md from
   hsdd/templates/verification.md at full-review depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier full-review: design rationale for every non-obvious choice; full verification doc.

Phase-specific values, copied from the phase context, the PRD and D1 to D4:

- Home copy: heading `Hello, {displayName}`; rows `Username`, `Email`, `Member since`; button `Sign out`. Member since as a long date: `14 March 2024`.
- AC-2.3 / D3 expiry message: `Your session has expired. Please sign in again.` D3 network message: `Could not reach the server. Please try again.`
- D1: expiry is noticed only when `GET /api/me` answers 401, on load or reload. No client timer.
- D2: storage holds only `{ token, expiresAt }` under `simple-login.session`. Verification: "nothing but the token and its expiry is ever written to storage".
- D4 / ADR-001: no router; sign-out is client-side (no request).
- Mocks: only the web.1 fixture stub; no hand-written responses.
- Commits: one commit for the phase, in the last task. `web/package-lock.json` stays gitignored.
- Carried from the web.2 review (M7): `onSignedIn` must not await before Login unmounts; Login must remount on each switch to signed-out; no `<main>` around the screens (each screen renders its own).

## Design rationale (full-review)

- **A pure state machine, an effectful shell.** Every transition is a total function `next(state, event)`, so the AC flows are a table a reviewer can read and a unit test can pin. React, `fetch` and storage stay in `App`. A plain `useState` with handlers is shorter, but it would spread the rules across handlers and an effect.
- **Events that do not apply are ignored.** `next` returns the state unchanged for an event that does not fit it, for example a `profile-loaded` that arrives after a sign-out. The effect also drops results after its cleanup runs (StrictMode's double mount, or a fast sign-out). That is defence in depth against a stale response showing someone's Home.
- **One `checking` state serves the load and the post-sign-in step.** Home needs `displayName`, which only `GET /api/me` gives. After a sign-in the app saves the session and enters `checking`; after a load with a stored session it enters `checking` too. The fetch, the rules for 401 and the network failure are then the same in both paths.
- **While checking, a quiet `Loading…` line, never Login.** Showing Login first and then Home on a reload would look like a sign-out (AC-2.2).
- **`unauthorized` clears the session and shows Login with the expiry message.** A 401 cannot be told apart from an unknown token (ADR-001), so D1's single message covers both.
- **`unavailable` on the check shows Login with the network message and keeps the stored session.** The spec is silent on this case. Clearing would sign the user out over a network blip, so the next reload, with the server back, resumes the session. The cost: Login is on screen while a token is still stored. If the user signs in again, the new session overwrites it. Recorded as a Learning for D1/D3.
- **The notice is a reason, not copy.** `signed-out` carries `notice?: 'session-expired' | 'unavailable'`, and `App` maps it to `MESSAGES`. This is the same split as web.2's `messageFor`.
- **`formatMemberSince` never builds a `Date`.** It splits `YYYY-MM-DD` and uses a month-name table, so no time zone can shift the day: `new Date('2024-03-14')` is UTC midnight, which is 13 March in the Americas. It also avoids depending on ICU or locale. A value it cannot read is shown unchanged instead of crashing Home.
- **Stylesheets.** `HomeScreen.css` styles Home's card. The `Loading…` line uses one rule added to the base `index.css`, because it belongs to the app shell, not to a screen.

## Review Focus

1. A reload while the server is down: the user is not silently signed out. They see the network message, the session stays stored, and the next reload resumes it. Test in Task 4.
2. A slow `GET /api/me` on reload: no flash of Login, a `Loading…` line, then Home. Test in Task 4.
3. A stale profile response (after a sign-out or StrictMode's re-mount) never shows Home. Pinned by the reducer test in Task 2.
4. Member since in a time zone west of UTC: still `14 March 2024`, not the 13th. Test in Task 1.
5. Storage hygiene across the whole walk: only `simple-login.session` is ever written, only `{ token, expiresAt }`, nothing in `localStorage` or cookies; Sign out sends no request. Test in Task 5.

---

### Task 1: Member-since date

**Files:**
- Create: `web/src/home/memberSince.ts`
- Test: `web/src/home/memberSince.test.ts`

**Interfaces:**
- Produces: `export function formatMemberSince(date: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
it.each([['2024-03-14', '14 March 2024'], ['2025-01-09', '9 January 2025'], ['2024-12-31', '31 December 2024']])(
  'formats %s as %s', (date, expected) => { expect(formatMemberSince(date)).toBe(expected) })
it('keeps the calendar date in every time zone', () => {
  const saved = process.env.TZ
  try {
    for (const tz of ['America/Los_Angeles', 'Asia/Jakarta', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      expect(formatMemberSince('2024-03-14')).toBe('14 March 2024')
    }
  } finally { process.env.TZ = saved }
})
it.each(['2024-3-14', '', '2024-13-01', '14 March 2024'])('returns %j unchanged when it is not a YYYY-MM-DD date', (raw) => {
  expect(formatMemberSince(raw)).toBe(raw)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/home/memberSince.test.ts`
Expected: FAIL, cannot resolve `./memberSince`.

- [ ] **Step 3: Implement `formatMemberSince` in `web/src/home/memberSince.ts`**

Match `^(\d{4})-(\d{2})-(\d{2})$`. If month is 1 to 12 and day is 1 to 31, return `${Number(day)} ${MONTHS[month - 1]} ${year}`. Otherwise return the input. No `Date`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/home/memberSince.test.ts`
Expected: 8 passed.

### Task 2: Session-flow state machine

**Files:**
- Create: `web/src/session/flow.ts`
- Test: `web/src/session/flow.test.ts`

**Interfaces:**
- Consumes: `Session`, `Profile` (web.1 `web/src/api/types.ts`).
- Produces:

```ts
export type Notice = 'session-expired' | 'unavailable'
export type AppState =
  | { readonly kind: 'checking'; readonly session: Session }
  | { readonly kind: 'signed-in'; readonly session: Session; readonly profile: Profile }
  | { readonly kind: 'signed-out'; readonly notice?: Notice }
export type AppEvent =
  | { readonly type: 'signed-in'; readonly session: Session }
  | { readonly type: 'profile-loaded'; readonly profile: Profile }
  | { readonly type: 'profile-rejected' }
  | { readonly type: 'profile-unavailable' }
  | { readonly type: 'signed-out' }
export function initialState(stored: Session | null): AppState
export function next(state: AppState, event: AppEvent): AppState
```

- [ ] **Step 1: Write the failing tests**

```ts
const session: Session = { token: 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ', expiresAt: '2026-10-29T10:30:00.000Z' }
const profile = loadFixture('profile-api', 'me-ayu').response.body as Profile
const checking: AppState = { kind: 'checking', session }
const signedIn: AppState = { kind: 'signed-in', session, profile }
const signedOut: AppState = { kind: 'signed-out' }
it('starts by checking a stored session', () => { expect(initialState(session)).toEqual(checking) })
it('starts signed out with nothing stored', () => { expect(initialState(null)).toEqual(signedOut) })
it.each<[string, AppState, AppEvent, AppState]>([
  ['a loaded profile shows Home', checking, { type: 'profile-loaded', profile }, signedIn],
  ['a rejected token shows Login with the expiry notice', checking, { type: 'profile-rejected' }, { kind: 'signed-out', notice: 'session-expired' }],
  ['an unreachable server shows Login with the network notice', checking, { type: 'profile-unavailable' }, { kind: 'signed-out', notice: 'unavailable' }],
  ['signing in checks the new session', signedOut, { type: 'signed-in', session }, checking],
  ['signing in from an expiry notice checks the new session', { kind: 'signed-out', notice: 'session-expired' }, { type: 'signed-in', session }, checking],
  ['signing out shows Login without a notice', signedIn, { type: 'signed-out' }, signedOut],
])('%s', (_name, from, event, to) => { expect(next(from, event)).toEqual(to) })
it.each<[string, AppState, AppEvent]>([
  ['a stale profile after sign-out', signedOut, { type: 'profile-loaded', profile }],
  ['a stale rejection on Home', signedIn, { type: 'profile-rejected' }],
  ['a second sign-in while checking', checking, { type: 'signed-in', session }],
  ['a sign-out while signed out', signedOut, { type: 'signed-out' }],
])('ignores an event that does not apply: %s', (_name, from, event) => { expect(next(from, event)).toBe(from) })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/session/flow.test.ts`
Expected: FAIL, cannot resolve `./flow`.

- [ ] **Step 3: Implement `web/src/session/flow.ts`**

`next` switches on `state.kind`, then on `event.type`; every unlisted pair returns `state` itself (same reference).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/session/flow.test.ts`
Expected: 12 passed.

### Task 3: Home screen (AC-2.1)

**Files:**
- Create: `web/src/home/HomeScreen.tsx`, `web/src/home/HomeScreen.css`
- Test: `web/src/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `Profile` (web.1), `formatMemberSince` (Task 1).
- Produces: `export interface HomeScreenProps { readonly profile: Profile; readonly onSignOut: () => void }` and `export function HomeScreen(props: HomeScreenProps)`.

- [ ] **Step 1: Write the failing tests**

```tsx
const profileOf = (name: string) => loadFixture('profile-api', name).response.body as Profile
const rows = () => screen.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])
it('greets the user and lists their details in wireframe order (AC-2.1)', () => {
  render(<HomeScreen profile={profileOf('me-ayu')} onSignOut={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
  expect(rows()).toEqual([['Username', 'ayu'], ['Email', 'ayu@example.com'], ['Member since', '14 March 2024']])
})
it("shows Budi's own details", () => {
  render(<HomeScreen profile={profileOf('me-budi')} onSignOut={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
  expect(rows()).toEqual([['Username', 'budi'], ['Email', 'budi@example.com'], ['Member since', '9 January 2025']])
})
it('Sign out calls its parent', async () => {
  const onSignOut = vi.fn()
  render(<HomeScreen profile={profileOf('me-ayu')} onSignOut={onSignOut} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
  expect(onSignOut).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/home/HomeScreen.test.tsx`
Expected: FAIL, cannot resolve `./HomeScreen`.

- [ ] **Step 3: Implement**

`<main className="home"><section className="home-card">`: `h1` `Hello, {displayName}`, a `<dl>` with `dt`/`dd` pairs in the order Username, Email, Member since (`formatMemberSince(memberSince)`), and a `type="button"` Sign out. `HomeScreen.css`: the same card proportions as Login (max-width 22rem, 16px gutter); the `dl` is a two-column grid (`max-content 1fr`); `dd` wraps long emails (`overflow-wrap: anywhere`); Sign out is a secondary (outlined) button.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/home/HomeScreen.test.tsx`
Expected: 3 passed.

### Task 4: App composition, the load check (AC-2.2, AC-2.3, D1)

**Files:**
- Modify: `web/src/App.tsx` (replace the placeholder), `web/src/App.test.tsx` (replace the placeholder test), `web/src/messages.ts` (add `sessionExpired`), `web/src/index.css` (the `.app-loading` rule)
- Test: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `initialState`, `next`, `AppState` (Task 2); `HomeScreen` (Task 3); `LoginScreen` (web.2); `fetchProfile` (web.1); `loadSession`, `saveSession`, `clearSession`, `SESSION_KEY` (web.1).
- Produces: `export default function App()`; `MESSAGES.sessionExpired = 'Your session has expired. Please sign in again.'`.

- [ ] **Step 1: Write the failing tests**

```tsx
const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const stored = { token: TOKEN, expiresAt: '2026-10-29T10:30:00.000Z' }
const store = (s = stored) => sessionStorage.setItem('simple-login.session', JSON.stringify(s))
it('shows Login when nothing is stored, without a request', () => {
  const stub = stubFetch(loadFixture('profile-api', 'me-ayu'))
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(stub.calls).toEqual([])
})
it('checks a stored session and shows Home (AC-2.2)', async () => {
  store()
  const stub = stubFetch(loadFixture('profile-api', 'me-ayu'))
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
  expect(stub.calls.map((c) => c.headers.authorization)).toEqual([`Bearer ${TOKEN}`])
})
it('sends an expired session to Login with the expiry message and clears it (AC-2.3, D1)', async () => {
  store()
  stubFetch(loadFixture('profile-api', 'me-expired-token'))
  render(<App />)
  expect(await screen.findByRole('status')).toHaveTextContent('Your session has expired. Please sign in again.')
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(sessionStorage.getItem('simple-login.session')).toBeNull()
})
it('keeps the session and shows the network message when the server is unreachable on load', async () => {
  store()
  stubFetchUnreachable()
  render(<App />)
  expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the server. Please try again.')
  expect(sessionStorage.getItem('simple-login.session')).toBe(JSON.stringify(stored))
})
it('shows a loading line, not Login, while the stored session is checked', () => {
  store()
  stubFetchHanging()
  render(<App />)
  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/App.test.tsx`
Expected: FAIL. The placeholder renders `Simple Login`, so the Home, status and loading assertions fail. The first test may pass if Login is not yet mounted; record whichever fail.

- [ ] **Step 3: Implement `App` in `web/src/App.tsx`**

`useReducer(next, loadSession(), initialState)`. An effect keyed on `state.kind === 'checking' ? state.session.token : null` runs `fetchProfile(token)` with a `cancelled` flag set in its cleanup: `ok` dispatches `profile-loaded`; `unauthorized` calls `clearSession()` then dispatches `profile-rejected`; `unavailable` dispatches `profile-unavailable`. Render: `checking` gives `<main className="app-loading" aria-busy="true"><p>Loading…</p></main>`; `signed-in` gives `<HomeScreen profile onSignOut />`; `signed-out` gives `<LoginScreen onSignedIn notice={copy} />` with `copy` from `MESSAGES` by notice reason. Handlers, both synchronous: `onSignedIn(s)` calls `saveSession(s)` and dispatches `signed-in`; `onSignOut()` calls `clearSession()` and dispatches `signed-out`. `index.css`: `.app-loading { min-height: 100vh; display: grid; place-items: center; color: #64748b; }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/App.test.tsx`
Expected: 5 passed.

### Task 5: The walk: sign in, reload, sign out (AC-1.1, AC-2.2, AC-3.1, D2)

**Files:**
- Modify: `web/src/App.tsx` only if a test exposes a gap
- Test: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `App` (Task 4); `stubFetch`, `loadFixture` (web.1).

- [ ] **Step 1: Write the failing tests**

```tsx
it('walks Login, Home, reload, Home, Sign out, Login, writing only the token and its expiry', async () => {
  const writes: Array<[string, string]> = []
  const realSetItem = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
    writes.push([k, v]); realSetItem.call(this, k, v)
  })
  const stub = stubFetch(loadFixture('auth-api', 'login-success'), loadFixture('profile-api', 'me-ayu'))
  const user = userEvent.setup()
  const first = render(<App />)
  await user.type(screen.getByLabelText('Username'), 'ayu')
  await user.type(screen.getByLabelText('Password'), 'sunrise-42')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
  first.unmount()                                  // reload: storage survives, React state does not
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).toBeNull()  // AC-3.1: no notice after a deliberate sign-out
  expect(sessionStorage.getItem('simple-login.session')).toBeNull()
  expect(writes).toEqual([['simple-login.session',
    '{"token":"q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ","expiresAt":"2026-10-29T10:30:00.000Z"}']])
  expect(localStorage.length).toBe(0)
  expect(document.cookie).toBe('')
  expect(stub.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/login', 'GET /api/me', 'GET /api/me'])
})
```

The final `calls` assertion also proves that Sign out sends no request (ADR-001).

- [ ] **Step 2: Run the test to verify it fails, or record that it already passes**

Run: `npm --prefix web test -- src/App.test.tsx`
Expected: after Task 4 this walk may pass immediately, because it composes behaviour Task 4 built. Before Task 4 it fails. If it passes, temporarily break `onSignOut` (skip `clearSession()`), watch the test fail on the storage assertion, restore it, and record both outputs. That proves the test can catch the regression.

- [ ] **Step 3: Implement**

Only if Step 2 exposed a gap.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/App.test.tsx`
Expected: 6 passed.

### Task 6: Gate, visual check, verification doc, commit

**Files:**
- Create: `hsdd/verify/simple-login.web.3.verification.md`

- [ ] **Step 1: Run the gate and keep its output**

Run: `npm --prefix web run gate`
Expected: `tsc` silent, Vitest `Test Files  9 passed (9)` and `Tests  79 passed (79)`, Vite `built in`.

- [ ] **Step 2: Visual check**

Run the dev server and screenshot `/` with headless Chrome. With no backend and nothing stored, the real app shows Login. Render Home through a temporary preview entry that feeds `HomeScreen` the `me-ayu` fixture's profile in a 360 px iframe, then delete the preview files. Compare both against the PRD wireframe.

- [ ] **Step 3: Write `hsdd/verify/simple-login.web.3.verification.md`**

From `hsdd/templates/verification.md` at full-review depth: Commands to run, Expected output, Observed (dated, gate summary, visual check), Outstanding, Learnings (dispositioned), Metrics. This phase produces no contract, so there is no schema replay. Sign-off stays blank. No em-dash characters.

- [ ] **Step 4: Commit the phase**

```bash
git add web/ docs/superpowers/plans/2026-10-29-simple-login.web.3.md hsdd/verify/simple-login.web.3.verification.md
git commit -m "feat(tutorial): simple-login.web.3 Home screen and the session flow" -m "<two or three body lines>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
