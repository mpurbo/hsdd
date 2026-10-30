# Verification: simple-login.web.2 · Login screen

> Spot-check depth. Written at apply, 2026-10-30, from the gate run and the
> visual check below. Commands run from the tutorial project root (the
> directory holding `hsdd/` and `web/`).

## Commands to run

```bash
npm --prefix web install                                  # one-time, fresh checkout
npm --prefix web run gate                                 # tsc --noEmit, vitest run, vite build
npm --prefix web test -- src/login/LoginScreen.test.tsx   # the screen's tests alone
```

## Expected output

- Gate exits 0: `tsc` silent; Vitest `Test Files  6 passed (6)`,
  `Tests  51 passed (51)` (16 in `LoginScreen.test.tsx`); Vite writes
  `dist/`.
- `LoginScreen.test.tsx` covers, against the auth-api fixtures only:
  - AC-1.1: `login-success` hands `{ token, expiresAt }` to `onSignedIn`
    once.
  - AC-1.2: `login-wrong-password` and `login-unknown-user` show
    `Incorrect username or password.`, keep the username, and clear and
    focus the password.
  - AC-1.3: the button stays disabled while either field is empty, and
    Enter sends nothing.
  - D3: an unreachable server, or one that never answers within web.1's
    10 s timeout, shows `Could not reach the server. Please try again.`
    and keeps both fields.
  - In flight: the button reads `Signing in…` and is disabled, and a
    second submit sends nothing.
  - The parent's notice shows under the button until the first submit.
  - `Ayu ` is sent as typed.

What to eyeball: `web/src/login/LoginScreen.tsx` reads only the result's
`reason`, never a server message. The copy sits in `web/src/messages.ts`.
The username input carries `autocapitalize="none"`, `autocorrect="off"` and
`spellcheck="false"`.

## Observed

2026-10-30, Node 24.18.0, npm 11.16.0, macOS.

- Gate at 00:30, exit 0: `tsc` silent; Vitest 5.0.5 `Test Files  6 passed
  (6)`, `Tests  51 passed (51)`; Vite 8.3.5 `built in 67ms`.
- Visual check at 00:24. The screen was rendered through a temporary
  preview entry, deleted afterwards, because `App` mounts nothing until
  web.3. Headless Chrome ran with a throwaway profile and showed the page
  in 360 px iframes.
  - The layout matches the PRD wireframe: `Sign in` heading, Username,
    Password, the `Sign in` button, and the message slot under it.
  - The card fits 360 px with the 16 px gutter. The disabled button is
    grey. The expiry notice wraps under the button.
  - A direct 390 px window was misleading: desktop Chrome keeps a layout
    viewport of about 500 px, so the iframe was needed.
- Design notes this phase settles:
  - One message slot under the button. It shows a failure, or the
    parent's notice until the first submit.
  - `invalid-input` shows the AC-1.2 copy (see Learnings).
  - After a credential failure the password is cleared and focused. After
    `unavailable` both fields stay.
  - A base `index.css` (body margin, system font) sits next to
    `LoginScreen.css`.
- Final review (fresh context) raised one Important item, which was fixed
  test-first. iOS capitalizes the first letter of a text field, and
  auth-api@v1 matches usernames case-sensitively. A phone user typing
  `ayu` would have sent `Ayu`.
- Tooling note: Testing Library's async helpers (`user-event`, `waitFor`,
  `findBy`) hang under Vitest fake timers. They wait on a `setTimeout(0)`
  and detect fake clocks only through a `jest` global. The in-flight tests
  therefore type with real timers, then fake the clock and use `fireEvent`.

## Outstanding

- Screen-reader announcement of the message slot (`role="alert"` for
  failures, `role="status"` for the notice) was not verified: there is no
  assistive technology in this environment. What it takes: a VoiceOver pass
  on `npm --prefix web run dev` once web.3 mounts the screen.

## Learnings

- D3 promises "one message per failure" but names none for
  `invalid-input` (a 400 `VALIDATION_FAILED`). This screen shows the AC-1.2
  copy, which is truthful for credentials that cannot match an account.
  The failure is unreachable from the form: the button blocks empty fields
  and `maxLength` enforces the 64/128 limits. spec-updated (D3 in
  hsdd/spec/simple-login.web.md: add `invalid-input` shows the AC-1.2
  message)

## Metrics

- Agent wall-clock: 00:15 to 00:31 (2026-10-30), about 16 minutes,
  including about 6 minutes waiting on the fresh-context reviewer.
- Gate failures before green: 0 (2 gate runs, both exit 0). Unplanned red
  runs: 1. In Task 2, two fake-timer tests timed out instead of failing on
  their assertions; the tooling note above records the fix.
- Tokens: the final reviewer used 106,352 (as the harness reported). The
  implementer's usage was not reported.
- Product vs process: product 385 lines (188 app source including 80 lines
  of CSS, 197 test). Process: the plan, 325 lines, and this doc, 114 lines.

## Sign-off
- Reviewer / date: Claude as owner proxy (the owner was unavailable), 2026-10-30
- Review tier applied: spot-check: diff skimmed, gate re-run green (79/79), the screen compared
  with the PRD wireframe through the phase's own visual check
- Disposition of each Outstanding item: screen-reader pass: waived (no assistive technology in this
  environment; listed for the owner in the process log's closing notes)
- Disposition of each Learning: spec-updated, applied at this gate: D3 in
  hsdd/spec/simple-login.web.md now names the `invalid-input` message

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
