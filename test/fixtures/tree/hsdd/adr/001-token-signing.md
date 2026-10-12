---
id: ADR-001
status: accepted
affects: [acme.api, auth-token@v1]
date: 2026-09-01
---

# ADR-001: Token signing

## Context
Long deliberation.

## Decision
Sign tokens with Ed25519. Keys rotate monthly.

## Consequences
- Verifiers need the public key.
