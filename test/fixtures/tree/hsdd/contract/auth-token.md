---
id: auth-token
version: v1
status: stable
kind: api
owner: acme.api
produced_by: [acme.api.2]
consumers: [acme.api.3, acme.web.console.1]
phase_ids: final
---

# Contract: auth-token

## Interface
`issue(userId) -> Token`

## Guarantees / invariants
- exp is iat plus 86400 seconds
- sub is the user id

## Versioning
- v1 current.
