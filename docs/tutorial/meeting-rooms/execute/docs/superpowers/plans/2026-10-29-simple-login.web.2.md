# simple-login.web.2 Login screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Login screen per the PRD wireframe: two fields, a Sign in button gated on both being non-empty and busy in flight, the session handed to the parent on success, and one message per failure plus a parent-supplied notice.

**Architecture:** `LoginScreen` is a controlled form over web.1's `signIn`. Its request state is an ADT (`idle | busy | failed(message)`); a pure `messageFor(reason)` maps each `SignInFailure` to its D3 copy. One message slot sits under the button, as in the wireframe: it shows the failure message, or the parent's `notice` until the first submit.

**Tech Stack:** React 19.3, TypeScript 7.0, Vitest 5 + jsdom, @testing-library/react 16.3, @testing-library/user-event 14.6, the web.1 fixture stub.

**Spec:** `hsdd-context/superpowers/simple-login.web.2.md` (paths relative to the tutorial project root; every command runs from there).

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 5 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix web run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.web.2.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.

Phase-specific values, copied from the phase context and the PRD:

- Copy: heading `Sign in`; labels `Username`, `Password`; button `Sign in`. AC-1.2 message `Incorrect username or password.`; D3 network message `Could not reach the server. Please try again.`
- AC-1.3: the button is disabled while either field is empty. The username is sent exactly as typed (auth-api@v1: case-sensitive, no trimming).
- auth-api@v1 field limits: username 1 to 64 characters, password 1 to 128.
- Mocks: only the web.1 fixture stub (`stubFetch`, `stubFetchUnreachable`, `stubFetchHanging`); no hand-written responses.
- Commits: one commit for the phase, in the last task. `web/package-lock.json` stays gitignored.

## Design notes (decisions this phase settles)

- **One message slot, under the button** (the wireframe's "(error message here)"). It shows the failure message after a failed submit. Before the first submit it shows the parent's `notice`, if one was passed. The notice is gone once the user submits.
- **`invalid-input` shows the AC-1.2 message.** D3 names no message for it. It is unreachable from this screen: the button blocks empty fields, and `maxLength` 64/128 enforces the contract limits. If it ever occurs, the credentials as typed cannot match an account.
- **After `invalid-credentials` or `invalid-input`, the password is cleared and focused, and the username is kept** (AC-1.2). After `unavailable` both fields are kept, so a retry is one click.
- **Busy:** while the request is in flight, the button is disabled and reads `Signing in…`, and the form has `aria-busy="true"`. A second submit is ignored. The fields stay editable.
- **Base stylesheet.** A small `web/src/index.css` (body margin, system font, page background) is imported by `main.tsx`, next to the per-screen `LoginScreen.css`. Each screen then owns only its card.

## Review Focus

1. A username of only spaces, or with a trailing space: it counts as typed, so the button is enabled and the value is sent unchanged. Tests in Tasks 1 and 3.
2. Pressing Enter while the other field is empty: nothing is sent. Test in Task 1.
3. A double click or a repeated Enter while in flight: exactly one request. Test in Task 2.
4. A server that never answers: the busy state ends with the network message after web.1's request timeout, so the screen is never stuck. Test in Task 2.
5. Retrying after a failure: the next submit replaces the old message, and a successful retry hands the session up. Test in Task 3.

---

### Task 1: Form, fields and the AC-1.3 gate

**Files:**
- Create: `web/src/login/LoginScreen.tsx`, `web/src/login/LoginScreen.css`, `web/src/index.css`
- Modify: `web/src/main.tsx` (import `./index.css`)
- Test: `web/src/login/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `Session` from `web/src/api/types.ts` (web.1).
- Produces:

```ts
export interface LoginScreenProps {
  readonly onSignedIn: (session: Session) => void
  readonly notice?: string
}
export function LoginScreen(props: LoginScreenProps): React.JSX.Element
```

- [ ] **Step 1: Write the failing tests**

```tsx
const setup = (props: Partial<LoginScreenProps> = {}) => {
  const onSignedIn = vi.fn()
  const user = userEvent.setup()
  render(<LoginScreen onSignedIn={onSignedIn} {...props} />)
  return { user, onSignedIn,
    username: screen.getByLabelText('Username'), password: screen.getByLabelText('Password'),
    button: screen.getByRole('button', { name: 'Sign in' }) }
}
it('shows the wireframe: heading, two fields, the button', () => {
  const { username, password, button } = setup()
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(password).toHaveAttribute('type', 'password')
  expect(username).toHaveAttribute('maxLength', '64')
  expect(password).toHaveAttribute('maxLength', '128')
  expect(username.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(password.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
it('disables Sign in while either field is empty (AC-1.3)', async () => {
  const { user, username, password, button } = setup()
  expect(button).toBeDisabled()
  await user.type(username, 'ayu');      expect(button).toBeDisabled()
  await user.type(password, 'x');        expect(button).toBeEnabled()
  await user.clear(username);            expect(button).toBeDisabled()
})
it('counts a username of spaces as typed', async () => {
  const { user, username, password, button } = setup()
  await user.type(username, '   '); await user.type(password, 'x')
  expect(button).toBeEnabled()
})
it('sends nothing when Enter is pressed with a field empty', async () => {
  const stub = stubFetch(loadFixture('auth-api', 'login-success'))
  const { user, username } = setup()
  await user.type(username, 'ayu{Enter}')
  expect(stub.calls).toEqual([])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: FAIL, cannot resolve `./LoginScreen`.

- [ ] **Step 3: Implement**

`LoginScreen` renders `<main className="login"><form className="login-card" noValidate>` containing an `h1`, two labelled inputs (`autoComplete` `username` / `current-password`, `maxLength` 64 / 128), the submit button and the message slot `<p className="login-message">` (empty for now). `canSubmit = username !== '' && password !== ''`; the submit handler calls `preventDefault()` and returns early when it is false. `LoginScreen.css`: a centered card (max-width 22rem, padding, border, radius), full-width inputs and button, readable at 320px. `index.css`: `body { margin: 0; font-family: system-ui, sans-serif; background: #f4f5f7; color: #1e293b; }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: 4 passed.

### Task 2: Sign in, busy state, success hand-off (AC-1.1)

**Files:**
- Create: `web/src/messages.ts`
- Modify: `web/src/login/LoginScreen.tsx`
- Test: `web/src/login/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `signIn(username, password): Promise<Result<Session, SignInFailure>>` and `REQUEST_TIMEOUT_MS` from `web/src/api/client.ts`; `stubFetch`, `stubFetchHanging`, `loadFixture` (web.1).
- Produces: the busy contract: the button reads `Signing in…` and is disabled, and the form has `aria-busy="true"`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('hands the session to its parent on success (AC-1.1)', async () => {
  const stub = stubFetch(loadFixture('auth-api', 'login-success'))
  const { user, username, password, button, onSignedIn } = setup()
  await user.type(username, 'ayu'); await user.type(password, 'sunrise-42'); await user.click(button)
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({
    token: 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ', expiresAt: '2026-10-29T10:30:00.000Z' }))
  expect(onSignedIn).toHaveBeenCalledTimes(1)
  expect(stub.calls.map((c) => c.body)).toEqual([{ username: 'ayu', password: 'sunrise-42' }])
})
it('is busy while the request is in flight and sends one request', async () => {
  vi.useFakeTimers()
  const stub = stubFetchHanging()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<LoginScreen onSignedIn={vi.fn()} />)
  await user.type(screen.getByLabelText('Username'), 'ayu')
  await user.type(screen.getByLabelText('Password'), 'sunrise-42{Enter}')
  const busy = screen.getByRole('button', { name: 'Signing in…' })
  expect(busy).toBeDisabled()
  expect(busy.closest('form')).toHaveAttribute('aria-busy', 'true')
  await user.click(busy); await user.keyboard('{Enter}')
  expect(stub.calls).toHaveLength(1)
})
it('ends the busy state with the network message when the server never answers', async () => {
  vi.useFakeTimers()
  stubFetchHanging()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<LoginScreen onSignedIn={vi.fn()} />)
  await user.type(screen.getByLabelText('Username'), 'ayu')
  await user.type(screen.getByLabelText('Password'), 'sunrise-42{Enter}')
  await act(() => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS))
  expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.')
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: FAIL. `onSignedIn` is never called, there is no `Signing in…` button, and there is no alert.

- [ ] **Step 3: Implement**

State `status: { kind: 'idle' } | { kind: 'busy' } | { kind: 'failed'; message: string }`. Submit: return when `!canSubmit || status.kind === 'busy'`; set busy; `await signIn(username, password)`; on `ok`, call `onSignedIn(result.value)` and set idle; otherwise set `failed` with `messageFor(result.reason)`. `messageFor` is a pure function: `invalid-credentials` and `invalid-input` give `Incorrect username or password.`, `unavailable` gives `Could not reach the server. Please try again.` The copy lives in `web/src/messages.ts` as `export const MESSAGES = { invalidCredentials, unavailable } as const`. The message slot gets `role="alert"` when it shows a failure. The button is disabled when `!canSubmit || busy`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: 7 passed.

### Task 3: Failures: AC-1.2, the network message, as-typed usernames

**Files:**
- Modify: `web/src/login/LoginScreen.tsx`
- Test: `web/src/login/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `stubFetch`, `stubFetchUnreachable`, `loadFixture` (web.1); `MESSAGES` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

```tsx
it.each(['login-wrong-password', 'login-unknown-user'])(
  '%s: shows the AC-1.2 message, keeps the username, clears and focuses the password', async (name) => {
    stubFetch(loadFixture('auth-api', name))
    const { user, username, password, button, onSignedIn } = setup()
    await user.type(username, 'ayu'); await user.type(password, 'sunset-42'); await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
    expect(username).toHaveValue('ayu')
    expect(password).toHaveValue('')
    expect(password).toHaveFocus()
    expect(onSignedIn).not.toHaveBeenCalled()
  })
it('shows the AC-1.2 message for a 400 (invalid-input)', async () => {
  stubFetch(loadFixture('auth-api', 'login-empty-username'))
  const { user, username, password, button } = setup()
  await user.type(username, 'ayu'); await user.type(password, 'x'); await user.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
})
it('shows the network message and keeps both fields when the server is unreachable', async () => {
  stubFetchUnreachable()
  const { user, username, password, button } = setup()
  await user.type(username, 'ayu'); await user.type(password, 'sunrise-42'); await user.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.')
  expect(username).toHaveValue('ayu'); expect(password).toHaveValue('sunrise-42')
})
it('sends the username exactly as typed', async () => {
  const stub = stubFetch(loadFixture('auth-api', 'login-unknown-user'))
  const { user, username, password, button } = setup()
  await user.type(username, 'Ayu '); await user.type(password, 'sunrise-42'); await user.click(button)
  await screen.findByRole('alert')
  expect(stub.calls.map((c) => c.body)).toEqual([{ username: 'Ayu ', password: 'sunrise-42' }])
})
it('a successful retry after a failure hands the session up', async () => {
  stubFetch(loadFixture('auth-api', 'login-wrong-password'))
  const { user, username, password, button, onSignedIn } = setup()
  await user.type(username, 'ayu'); await user.type(password, 'sunset-42'); await user.click(button)
  await screen.findByRole('alert')
  stubFetch(loadFixture('auth-api', 'login-success'))
  await user.type(password, 'sunrise-42'); await user.click(button)
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1))
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: FAIL on the password assertions (not cleared, not focused). The message assertions may already pass from Task 2; any that do are recorded as already covered.

- [ ] **Step 3: Implement**

On `invalid-credentials` or `invalid-input`: `setPassword('')` and focus the password input through a ref after the state update (`useEffect` keyed on the failure). On `unavailable`: leave the fields alone.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: 13 passed.

### Task 4: The parent's notice

**Files:**
- Modify: `web/src/login/LoginScreen.tsx`
- Test: `web/src/login/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `LoginScreenProps.notice` (Task 1).
- Produces: phase 3 passes `notice` (the D3 expiry copy) and relies on it showing in the message slot until the first submit.

- [ ] **Step 1: Write the failing tests**

```tsx
it('shows the notice its parent passes in, under the button', () => {
  const { button } = setup({ notice: 'Your session has expired. Please sign in again.' })
  const notice = screen.getByRole('status')
  expect(notice).toHaveTextContent('Your session has expired. Please sign in again.')
  expect(button.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
it('replaces the notice once the user submits', async () => {
  stubFetch(loadFixture('auth-api', 'login-wrong-password'))
  const { user, username, password, button } = setup({ notice: 'Your session has expired. Please sign in again.' })
  await user.type(username, 'ayu'); await user.type(password, 'sunset-42'); await user.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
  expect(screen.queryByText('Your session has expired. Please sign in again.')).toBeNull()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: FAIL, no element with role `status`.

- [ ] **Step 3: Implement**

A `submitted` flag is set on the first submit. The slot shows the failure message with `role="alert"` when `status.kind === 'failed'`. Otherwise it shows `notice` with `role="status"` while `!submitted`. Otherwise the slot is empty.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web test -- src/login/LoginScreen.test.tsx`
Expected: 15 passed.

### Task 5: Gate, verification doc, commit

**Files:**
- Create: `hsdd/verify/simple-login.web.2.verification.md`

- [ ] **Step 1: Run the gate and keep its output**

Run: `npm --prefix web run gate`
Expected: `tsc` silent, Vitest `Test Files  6 passed (6)` and `Tests  50 passed (50)`, Vite `built in`.

- [ ] **Step 2: Write `hsdd/verify/simple-login.web.2.verification.md`**

From `hsdd/templates/verification.md` at spot-check depth: commands, expected output, what to eyeball, dated Observed, Outstanding (the visual wireframe check needs the screen mounted by `App`, which phase 3 does: deferred to simple-login.web.3), Learnings, Metrics. Sign-off stays blank. No em-dash characters.

- [ ] **Step 3: Commit the phase**

```bash
git add web/ docs/superpowers/plans/2026-10-29-simple-login.web.2.md hsdd/verify/simple-login.web.2.verification.md
git commit -m "feat(tutorial): simple-login.web.2 Login screen" -m "<two or three body lines>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
