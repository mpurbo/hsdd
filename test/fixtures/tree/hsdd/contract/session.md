---
id: session
version: v2
status: draft
kind: shared-model
owner: acme.api
produced_by: [acme.api.3]
consumers: [acme.web.console.2]
phase_ids: provisional
---

# Contract: session

## Interface
`Session { id, userId, expiresAt }`

## Guarantees / invariants
- a session never outlives its token
