---
id: auth-api
version: v1
status: stable
kind: api
owner: simple-login.backend
governed_by: [ADR-001]
compatibility: versioned
produced_by: [simple-login.backend.2]
consumers: [simple-login.web.1, simple-login.web.2, simple-login.web.3, simple-login.web.4, simple-login.web.8, simple-login.integration.1, simple-login.integration.2]
phase_ids: final
---

# Contract: auth-api

- **Governed by:** [ADR-001]

## Interface

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

## Guarantees / invariants

- G1: `expiresAt` is exactly 30 minutes after the moment the token was
  issued (ADR-001).
- G2: A token from a 200 response is accepted by `profile-api@v1`,
  `profile-api@v2` and `booking-api@v1` until `expiresAt`, and rejected
  after it. A restart can end it sooner (G3).
- G3: A restart of the service ends every token issued before it, ahead of
  its `expiresAt`: after the restart each is rejected exactly as an expired
  token is (ADR-001).
- G4: Sign-out is client-side: there is no logout endpoint, and a client
  signs out by discarding its token (ADR-001). Signing out ends nothing on
  the service, so a token kept or copied before it stays accepted until it
  expires (G2) or the service restarts (G3).
- G5: An unknown username and a wrong password give the same status, the
  same body, byte for byte.
- G6: Usernames match exactly: case-sensitive, with no trimming. `Ayu` and
  `ayu ` are unknown usernames. Clients send what the user typed.
- G7: The token is opaque: consumers store it and send it back, never parse
  it.
- G8: No response contains the password or a password hash.
- G9: Consumers branch on `error.code`, never on `error.message`.

## Versioning

- v1 current. 2026-10-29: the development address and the exact-match
  username rule were added by hsdd-reconcile from the phase plans; both are
  compatible additions, so the version stays v1.
- 2026-10-30: "character" defined as a Unicode code point, after both the
  backend's final review and the web.3 gate met the ambiguity. The schema
  already counted code points; a clarification, so the version stays v1.
- 2026-10-30: the token guarantee also names `profile-api@v2`, drafted for
  `hsdd/management/2026-10-30-intake-add-phone.md`. The same tokens work at
  the same endpoint; a compatible clarification, so the version stays v1.
- 2026-10-31, for
  `hsdd/management/2026-10-31-intake-prd-simple-login-v2.md`: the
  guarantees take ids G1 to G9, in their order; G2 also names
  `booking-api@v1`, which takes the same tokens from the same service.
  G3 (a restart ends every token) and G4 (sign-out is client-side, with no
  logout endpoint) state what ADR-001 has decided since v1 and the service
  has always done; ADR-001's 2026-10-31 amendments keep both. `consumers`
  gains `simple-login.web.3` and `simple-login.web.4`, whose App tests read
  the `login-success` fixture
  (`hsdd/management/2026-10-30-execution-plan.md` C-3, finding F-4). No
  endpoint, shape, status, schema or fixture changes: compatible
  clarifications and metadata, so the version stays v1.
- Breaking changes require v2 and a migration note here; v1
  stays until every consumer migrates.

## Validation

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
