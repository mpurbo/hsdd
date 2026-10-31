<!-- hsdd-phase-context {"phase":"simple-login.web.1","spec":"995f28a","date":"2026-10-29"} -->
# Current Phase: simple-login.web.1 - App skeleton, API client, session storage

## Goal
the `web/` package (React 19, TypeScript, Vite, Vitest with jsdom and Testing Library; `npm run gate` = `tsc --noEmit`, then `vitest run`, then `vite build`); the Vite dev proxy from `/api` to the backend's development address, `http://127.0.0.1:3000` (auth-api@v1); the API client, `signIn(username, password)` and `fetchProfile(token)`, returning a result value (a session or a profile, or a failure reason: `invalid-credentials`, `invalid-input`, `unauthorized`, `unavailable`) decided by status and `error.code`, never by message; the session store over `sessionStorage` (D2); a test helper that answers stubbed `fetch` calls with the auth-api and profile-api fixture responses; a placeholder `App`.

## Where it sits
- Node: simple-login.web · let a user sign in, see their profile and sign out in the browser
- Owns: the Login screen, the Home screen, the API client, token storage in the browser, the Vite dev proxy, the `web/` directory
- Does not own: accounts, password checks, sessions on the server
- Isolation strategy: `fetch` is stubbed with the auth-api and profile-api fixtures; the backend never needs to run

## Phase
- **Consumes:** [auth-api@v1, profile-api@v1]
- **Produces:** none
- **Governed by:** [ADR-001]
- **Scope:** the `web/` package (React 19, TypeScript, Vite, Vitest with jsdom and Testing Library; `npm run gate` = `tsc --noEmit`, then `vitest run`, then `vite build`); the Vite dev proxy from `/api` to the backend's development address, `http://127.0.0.1:3000` (auth-api@v1); the API client, `signIn(username, password)` and `fetchProfile(token)`, returning a result value (a session or a profile, or a failure reason: `invalid-credentials`, `invalid-input`, `unauthorized`, `unavailable`) decided by status and `error.code`, never by message; the session store over `sessionStorage` (D2); a test helper that answers stubbed `fetch` calls with the auth-api and profile-api fixture responses; a placeholder `App`.
- **Size estimate:** ~10 files (~300 lines), <= 6 OpenSpec tasks
- **Gate:** `npm --prefix web run gate`
- **Verification:** the client's tests feed every one of the ten fixtures through the stub and get the right result; `npm --prefix web run dev` serves the placeholder page.
- **Review tier:** spot-check
- **Dependencies:** none (builds against the contracts' fixtures, not the backend)

## Contracts
### auth-api@v1 · consumes · stable
**Interface**
`POST /api/login` with a JSON body:

```json
{ "username": "ayu", "password": "sunrise-42" }
```

- `username`: string, 1 to 64 characters.
- `password`: string, 1 to 128 characters.

Responses (all bodies JSON):

| Status | When | Body |
|--------|------|------|
| 200 | the username and password match a built-in account | `{ "token": string, "tokenType": "Bearer", "expiresAt": string }` |
| 400 | the body is not a JSON object with both fields valid as above | `{ "error": { "code": "VALIDATION_FAILED", "message": "Username and password are required." } }` |
| 401 | unknown username, or wrong password | `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect username or password." } }` |

- `token`: 43 characters of base64url (`[A-Za-z0-9_-]`).
- `expiresAt`: an ISO-8601 UTC date-time, for example
  `2026-10-29T10:30:00.000Z`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the service listens on `http://127.0.0.1:3000`; the
`PORT` environment variable overrides the port. A dev proxy or a test
targets this address, not `localhost`.
**Guarantees**
- `expiresAt` is exactly 30 minutes after the moment the token was issued
  (ADR-001).
- A token from a 200 response is accepted by `profile-api@v1` until
  `expiresAt`, and rejected after it.
- An unknown username and a wrong password give the same status, the same
  body, byte for byte.
- Usernames match exactly: case-sensitive, with no trimming. `Ayu` and
  `ayu ` are unknown usernames. Clients send what the user typed.
- The token is opaque: consumers store it and send it back, never parse it.
- No response contains the password or a password hash.
- Consumers branch on `error.code`, never on `error.message`.

### profile-api@v1 · consumes · stable
**Interface**
`GET /api/me` with the header `Authorization: Bearer {token}`, where
`{token}` came from `auth-api@v1`.

| Status | When | Body |
|--------|------|------|
| 200 | the token is one the backend issued and it has not expired | the signed-in user's profile, below |
| 401 | no `Authorization` header, a header that is not `Bearer {token}`, an unknown token, or an expired token | `{ "error": { "code": "UNAUTHORIZED", "message": "Sign in to continue." } }` |

The profile:

```json
{
  "id": "u_001",
  "username": "ayu",
  "displayName": "Ayu Lestari",
  "email": "ayu@example.com",
  "memberSince": "2024-03-14"
}
```

- `id`: string, stable per account.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.
**Guarantees**
- The profile has exactly the five fields above; it never contains a
  password, a hash or a token.
- The profile returned is always the account the token was issued for.
- Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- Consumers branch on `error.code`, never on `error.message`.

## Decisions
### ADR-001: Session tokens · accepted
**Decision**
Sessions are opaque bearer tokens held in the backend's in-memory session
store. A token is 32 random bytes, base64url-encoded (43 characters),
issued by `POST /api/login` and sent as `Authorization: Bearer {token}`.
Its lifetime is a fixed 30 minutes from issue, with no renewal. Sign-out is
client-side: the web app discards its token; there is no logout endpoint.
**Consequences**
- Restarting the backend signs every user out.
- Consumers never parse a token; its only meaning is "valid until
  `expiresAt`".
- An expired, unknown or missing token is one case for consumers: 401
  `UNAUTHORIZED`.
- After a client-side sign-out the server entry lives on until it expires;
  a stolen token stays valid for at most 30 minutes.
- Time is an input: the backend's session logic takes the clock as a
  dependency so expiry is testable without waiting.

## Discipline
- Test-first: write each behavior's failing test, and see it fail, before
  the code that makes it pass.
- Governance freeze: change nothing under hsdd/ except this phase's
  verification doc; contracts, ADRs, specs and conventions change only
  through hsdd-contract, hsdd-adr and hsdd-reconcile.
- Consume contracts only: build against the Interface and Guarantees above,
  never against another node's internals.
- Contract wrong mid-phase: pause at a task boundary; write the gap, in
  request or amend wording, under the verification doc's Outstanding and
  stop; the human records it in the node's plan, renegotiates at the root
  through hsdd-contract, and propagates the change into this phase's branch;
  re-run the phase switch; resume. Never improvise around the contract.
- Verification doc: hsdd/verify/simple-login.web.1.verification.md from
  hsdd/templates/verification.md at spot-check depth. Every Learning
  carries one disposition before sign-off; "- none" is valid, silence is not.

## Links (spec 995f28a)
- Phase section: hsdd/spec/simple-login.web.md, heading "### simple-login.web.1: App skeleton, API client, session storage"
- Node spec: hsdd/spec/simple-login.web.md
- auth-api@v1: hsdd/contract/auth-api.md
- profile-api@v1: hsdd/contract/profile-api.md
- ADR-001: hsdd/adr/001-session-tokens.md
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
