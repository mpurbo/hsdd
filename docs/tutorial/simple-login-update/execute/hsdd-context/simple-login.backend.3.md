<!-- hsdd-phase-context {"phase":"simple-login.backend.3","spec":"d10d0d4","date":"2026-10-30"} -->
# Current Phase: simple-login.backend.3 - Phone number in the profile (profile-api@v2)

## Goal
per hsdd/management/2026-10-30-intake-add-phone.md. `GET /api/me` moves from profile-api@v1 to profile-api@v2: the profile gains `phone`. `Account` gains `phone: string`, held as the display string and returned exactly as stored, never parsed, normalized or reformatted (AC-2.4); `Profile` stays `Account` without its password, so `toProfile` passes `phone` through and the profile still carries no password, hash or token. The built-in accounts gain the numbers from update 1's Demo accounts table: `ayu` `+62 812 3456 7890`, `budi` `+62 813 9876 5432`. The accounts test compares both profiles with the `me-ayu` and `me-budi` bodies under `hsdd/contract/fixture/profile-api.v2/`. The replay rig gains the slug `profile-api.v2` (schema `hsdd/contract/schema/profile-api.v2.schema.json`, fixtures `hsdd/contract/fixture/profile-api.v2/`), its own tests cover those fixtures, and `npm --prefix backend run replay` replays auth-api@v1 (unchanged) and profile-api@v2. profile-api@v1 leaves the replay: the endpoint carries one shape and serves v2 only from this phase on (profile-api@v2, Versioning), so v1's exact `me-ayu` and `me-budi` bodies no longer reproduce. `POST /api/login`, the session store and every 401 body are unchanged. Out of scope (update 1, Scope): editing or verifying the number, sign-in by phone, any other field.

## Where it sits
- Node: simple-login.backend · authenticate built-in users and serve the signed-in user's profile over HTTP
- Owns: the built-in accounts, password verification, the session store, `POST /api/login`, `GET /api/me`, the `backend/` directory
- Does not own: screens, where the browser keeps the token, the dev proxy
- Isolation strategy: Fastify `app.inject()` with an injected clock and random source; the gate replays the auth-api and profile-api fixtures against the real routes; no browser and no open port needed

## Phase
- **Consumes:** none
- **Produces:** [profile-api@v2]
- **Governed by:** [ADR-001]
- **Scope:** per hsdd/management/2026-10-30-intake-add-phone.md. `GET /api/me` moves from profile-api@v1 to profile-api@v2: the profile gains `phone`. `Account` gains `phone: string`, held as the display string and returned exactly as stored, never parsed, normalized or reformatted (AC-2.4); `Profile` stays `Account` without its password, so `toProfile` passes `phone` through and the profile still carries no password, hash or token. The built-in accounts gain the numbers from update 1's Demo accounts table: `ayu` `+62 812 3456 7890`, `budi` `+62 813 9876 5432`. The accounts test compares both profiles with the `me-ayu` and `me-budi` bodies under `hsdd/contract/fixture/profile-api.v2/`. The replay rig gains the slug `profile-api.v2` (schema `hsdd/contract/schema/profile-api.v2.schema.json`, fixtures `hsdd/contract/fixture/profile-api.v2/`), its own tests cover those fixtures, and `npm --prefix backend run replay` replays auth-api@v1 (unchanged) and profile-api@v2. profile-api@v1 leaves the replay: the endpoint carries one shape and serves v2 only from this phase on (profile-api@v2, Versioning), so v1's exact `me-ayu` and `me-budi` bodies no longer reproduce. `POST /api/login`, the session store and every 401 body are unchanged. Out of scope (update 1, Scope): editing or verifying the number, sign-in by phone, any other field.
- **Size estimate:** ~7 files (~40 lines), <= 3 OpenSpec tasks
- **Gate:** `npm --prefix backend run gate` plus contract replay for profile-api.v2: `npm --prefix backend run replay` (the same run keeps replaying auth-api)
- **Verification:** with the service running, Ayu's token at `GET /api/me` returns the six profile-api@v2 fields with `phone` exactly `+62 812 3456 7890`, and Budi's returns `+62 813 9876 5432`; the 401 bodies are unchanged; the replay lists the auth-api and profile-api.v2 fixtures and no profile-api@v1 fixture.
- **Review tier:** spot-check
- **Dependencies:** simple-login.backend.2 (shipped: `Account`, `toProfile`, `GET /api/me`, the replay rig and `contract.replay.test.ts`); profile-api@v2's schema and fixtures, `stable` once hsdd-reconcile drains this plan (root Dev flow: lane 1 starts from `stable` contracts)

## Contracts
### profile-api@v2 · produces · stable
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
  "phone": "+62 812 3456 7890",
  "memberSince": "2024-03-14"
}
```

- `id`: string, stable per account.
- `phone`: string, the account's phone number exactly as stored: `+`, the
  country code, then groups of digits separated by single spaces.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.
**Guarantees**
- The profile has the six fields above. Under `additive-only` it may later
  gain optional fields; it never loses, retypes or repurposes one, and it
  never contains a password, a hash or a token.
- Consumers ignore fields they do not know.
- `phone` is returned exactly as stored; consumers show it as given and
  never reformat it.
- The profile returned is always the account the token was issued for.
- Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/profile-api.v2.schema.json
- fixture: hsdd/contract/fixture/profile-api.v2/
- The schema validates one response as `{ "status": number, "body": ... }`.
  The profile is closed (`additionalProperties: false`), so a leaked field
  fails the producer's replay. An `additive-only` amendment adds its new
  optional field to the schema in the same edit, and every existing fixture
  must still validate against the amended schema.
- Each fixture is one JSON file: `{ "name", "description", "request":
  { "method", "path", "headers" }, "response": { "status", "body" },
  "replay" }`. `replay` is `exact` (the producer's real status and body
  must equal the fixture's) or `schema` (the real status must equal it and
  the real body must validate against the schema).
- A request header may hold a placeholder the producer's replay fills in:
  `{{token:<username>}}` is a token freshly issued for that account;
  `{{expired-token:<username>}}` is a token for that account whose
  `expiresAt` has passed. Consumers use only the fixture's `response`.
- The `200` fixtures carry the built-in accounts' real profiles, phone
  numbers included, so the producer's replay also proves its account data
  matches the change request.
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume.

### profile-api@v1 · referenced · stable
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
**Validation**
- schema: hsdd/contract/schema/profile-api.schema.json
- fixture: hsdd/contract/fixture/profile-api/
- The schema validates one response as `{ "status": number, "body": ... }`.
- Fixture files follow the same shape as auth-api@v1's. A request header
  may hold a placeholder the producer's replay fills in:
  `{{token:<username>}}` is a token freshly issued for that account;
  `{{expired-token:<username>}}` is a token for that account whose
  `expiresAt` has passed. Consumers use only the fixture's `response`.
- The `200` fixtures carry the built-in accounts' real profiles, so the
  producer's replay also proves its account data matches the PRD.
- Code-level artifacts: as auth-api@v1. No shared code package; each node
  writes its own types from this Interface.

### auth-api@v1 · referenced · stable
**Interface**
`POST /api/login` with a JSON body:

```json
{ "username": "ayu", "password": "sunrise-42" }
```

- `username`: string, 1 to 64 characters.
- `password`: string, 1 to 128 characters.
- A character is a Unicode code point, which is what JSON Schema's
  `maxLength` counts: an emoji is one character, not two.

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
- A token from a 200 response is accepted by `profile-api@v1` and
  `profile-api@v2` until `expiresAt`, and rejected after it.
- An unknown username and a wrong password give the same status, the same
  body, byte for byte.
- Usernames match exactly: case-sensitive, with no trimming. `Ayu` and
  `ayu ` are unknown usernames. Clients send what the user typed.
- The token is opaque: consumers store it and send it back, never parse it.
- No response contains the password or a password hash.
- Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/auth-api.schema.json
- fixture: hsdd/contract/fixture/auth-api/
- The schema validates one response as `{ "status": number, "body": ... }`;
  `$defs.LoginRequest` describes a valid request body.
- Each fixture is one JSON file: `{ "name", "description", "request":
  { "method", "path", "headers", "body" }, "response": { "status", "body" },
  "replay" }`. `replay` is `exact` (the producer's real status and body
  must equal the fixture's) or `schema` (the real status must equal it and
  the real body must validate against the schema; used where values vary,
  such as `token` and `expiresAt`).
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume: the
  producer's gate replays them, consumers stub `fetch` with them.

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
- Consume contracts only: build against the Interface and Guarantees of
  each contract above that this phase consumes or produces, test against
  the fixtures their Validation names, and never build against another
  node's internals.
- Referenced: profile-api@v1, auth-api@v1. Not consumed or
  produced by this phase; use each only as this phase's Scope says.
- Contract wrong mid-phase: pause at a task boundary; write the gap, in
  request or amend wording, under the verification doc's Outstanding and
  stop; the human records it in the node's plan, renegotiates at the root
  through hsdd-contract, and propagates the change into this phase's branch;
  re-run the phase switch; resume. Never improvise around the contract.
- Verification doc: hsdd/verify/simple-login.backend.3.verification.md from
  hsdd/templates/verification.md at spot-check depth. Every Learning
  carries one disposition before sign-off; "- none" is valid, silence is not.
- Contract replay: the gate validates this phase's real output against the
  schema and reproduces the fixtures of profile-api@v2.

## Links (spec d10d0d4)
- Phase section: hsdd/spec/simple-login.backend.md, heading "### simple-login.backend.3: Phone number in the profile (profile-api@v2)"
- Node spec: hsdd/spec/simple-login.backend.md
- profile-api@v2: hsdd/contract/profile-api.v2.md
- profile-api@v1: hsdd/contract/profile-api.md
- auth-api@v1: hsdd/contract/auth-api.md
- ADR-001: hsdd/adr/001-session-tokens.md
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
