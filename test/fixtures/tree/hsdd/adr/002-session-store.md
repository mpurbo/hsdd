---
id: ADR-002
status: proposed
affects: [acme.api, session@v2]
date: 2026-09-05
---

# ADR-002: Session store

## Decision
Keep sessions in Redis.

## Consequences
- Needs a Redis cluster.
