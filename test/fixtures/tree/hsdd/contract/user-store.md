---
id: user-store
version: v1
status: stable
kind: api
owner: ext:directory
produced_by: []
consumers: [acme.api.2]
phase_ids: final
---

# Contract: user-store

## Interface
`GET /users/{id}`

## Guarantees / invariants
- returns 404 for an unknown id
