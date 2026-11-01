---
id: profile-api
version: v2
status: stable
kind: api
owner: simple-login.backend
governed_by: [ADR-001, ADR-002]
compatibility: additive-only
produced_by: [simple-login.backend.3, simple-login.backend.4]
consumers: [simple-login.web.4, simple-login.web.5, simple-login.web.7, simple-login.web.8, simple-login.integration.2, simple-login.integration.3, simple-login.integration.4, simple-login.integration.5]
phase_ids: final
---

# Contract: profile-api (v2)

- **Governed by:** [ADR-001, ADR-002]

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
  "memberSince": "2024-03-14",
  "timeZone": "Asia/Jakarta"
}
```

- `id`: string, stable per account.
- `phone`: string, the account's phone number exactly as stored: `+`, the
  country code, then groups of digits separated by single spaces.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- `timeZone`: string, the account's time zone as an IANA name, for
  example `Asia/Jakarta` (ADR-002). Optional in the schema, so a profile
  without it still validates; the producer sends it in every profile (G4).
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.

## Guarantees / invariants

- G1: The profile has the fields above: the six it was drafted with, and
  `timeZone` (G4). Under `additive-only` it may later gain optional fields;
  it never loses, retypes or repurposes one, and it never contains a
  password, a hash or a token.
- G2: Consumers ignore fields they do not know.
- G3: `phone` is returned exactly as stored; consumers show it as given and
  never reformat it.
- G4: Every `200` profile carries `timeZone`: the account's IANA time-zone
  name exactly as stored, never an offset or an abbreviation. `ayu` is in
  `Asia/Jakarta` and `budi` in `Europe/London` (PRD v2 Demo accounts).
- G5: A consumer takes the user's zone from `timeZone` only and never puts
  another zone in its place, the browser's included (ADR-002). A profile
  without `timeZone` comes only from a producer that predates the field; a
  consumer then shows no time rather than guess one.
- G6: The profile returned is always the account the token was issued for.
- G7: Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- G8: Consumers branch on `error.code`, never on `error.message`.

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
- 2026-10-31, for
  `hsdd/management/2026-10-31-intake-prd-simple-login-v2.md`: the profile
  gains `timeZone`, the account's IANA time-zone name (ADR-002; PRD v2
  AC-2.1, AC-2.5, Demo accounts). The schema adds it as an optional field,
  and the five fixtures as they stood before this entry validate against
  the amended schema; `me-ayu` and `me-budi` now carry it. G4 promises it
  in every `200` profile, and G5 says a consumer never substitutes another
  zone. The guarantees take ids G1 to G8, in their order. Nothing is
  removed, retyped or repurposed: an additive change under
  `additive-only`, so the version stays v2. The producer serves `timeZone`
  from the phase that adds it to the account data; until that phase ships,
  its exact replay of `me-ayu` and `me-budi` fails, and a consumer can meet
  a profile without it (G5).

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
  numbers and time zones included, so the producer's replay also proves
  its account data matches PRD v2 Demo accounts.
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume.
