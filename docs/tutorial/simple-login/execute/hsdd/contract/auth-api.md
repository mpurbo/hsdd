---
id: auth-api
version: v1
status: draft
kind: api
owner: simple-login.backend
compatibility: versioned
produced_by: [simple-login.backend.1]
consumers: [simple-login.web.1, simple-login.integration.1]
phase_ids: provisional
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

## Guarantees / invariants

- `expiresAt` is exactly 30 minutes after the moment the token was issued
  (ADR-001).
- A token from a 200 response is accepted by `profile-api@v1` until
  `expiresAt`, and rejected after it.
- An unknown username and a wrong password give the same status, the same
  body, byte for byte.
- The token is opaque: consumers store it and send it back, never parse it.
- No response contains the password or a password hash.
- Consumers branch on `error.code`, never on `error.message`.

## Versioning

- v1 current. Breaking changes require v2 and a migration note here; v1
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
