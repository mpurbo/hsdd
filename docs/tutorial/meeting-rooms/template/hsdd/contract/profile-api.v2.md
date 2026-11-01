---
id: profile-api
version: v2
status: stable
kind: api
owner: simple-login.backend
compatibility: additive-only
produced_by: [simple-login.backend.3]
consumers: [simple-login.web.4, simple-login.integration.2]
phase_ids: final
---

# Contract: profile-api (v2)

- **Governed by:** [ADR-001]

## Interface

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

## Guarantees / invariants

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

## Versioning

- v2 current, drafted 2026-10-30 for
  `hsdd/management/2026-10-30-intake-add-phone.md`. It adds `phone` to the
  profile and declares `additive-only`: a later optional field keeps v2.
- Migration from v1: a consumer reads `phone` and ignores fields it does
  not know. `GET /api/me` carries one shape, so the producer cannot serve
  v1 and v2 side by side: from its v2 phase on it serves v2 only. A v1
  consumer that ignores unknown fields keeps working until it migrates,
  but v1's "exactly the five fields" guarantee no longer holds for it.
  The deprecation window is the time between the producer's v2 phase and
  the last consumer's; this intake ships them together. v1 then goes
  `deprecated`, then `retired`.

## Validation

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
