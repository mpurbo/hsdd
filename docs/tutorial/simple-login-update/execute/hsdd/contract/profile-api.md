---
id: profile-api
version: v1
status: stable
kind: api
owner: simple-login.backend
compatibility: versioned
produced_by: [simple-login.backend.2]
consumers: [simple-login.web.1, simple-login.web.3, simple-login.integration.1]
phase_ids: final
---

# Contract: profile-api

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
  "memberSince": "2024-03-14"
}
```

- `id`: string, stable per account.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.

## Guarantees / invariants

- The profile has exactly the five fields above; it never contains a
  password, a hash or a token.
- The profile returned is always the account the token was issued for.
- Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- Consumers branch on `error.code`, never on `error.message`.

## Versioning

- v1 current. 2026-10-29: the development address was added by
  hsdd-reconcile from the phase plans; a compatible addition, so the
  version stays v1.
- 2026-10-30: v2 drafted in `hsdd/contract/profile-api.v2.md` (adds
  `phone`); its Versioning section carries the migration note. v1 stays
  `stable` until every v1 consumer has a v2 phase shipped.
- Breaking changes require v2 and a migration note here; v1
  stays until every consumer migrates.

## Validation

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
