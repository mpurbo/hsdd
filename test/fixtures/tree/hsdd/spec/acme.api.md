# acme.api: Token Service

## Node

- **Kind:** leaf-parent
- **Purpose:** issue and verify access tokens
- **Owns:** token issuance, session storage
- **Does not own:** user records
- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1], [session@v2]
- **Governed by:** [ADR-001]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fake user store, fixed clock

## Phase Plan

**Default gate:** `npm test`

| Phase | Name | Tier | Size | Depends on | Collides with |
|------:|------|------|------|------------|---------------|
| api.1 | Types | gate-only | ~3 files, <= 3 OpenSpec tasks | none | none |
| api.2 | Token issuance | full-review | ~4 files, <= 5 OpenSpec tasks | 1 | 3 |
| api.3 | Session store | full-review | ~5 files, <= 6 OpenSpec tasks | 2 | 2 |

### api.1: Types

- **Consumes:** none
- **Produces:** none
- **Scope:** token and session types
- **Size estimate:** ~3 files (~80 lines), <= 3 OpenSpec tasks
- **Gate:** node default
- **Verification:** the types compile
- **Review tier:** gate-only
- **Dependencies:** none

### api.2: Token issuance

- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1]
- **Governed by:** [ADR-001]
- **Scope:** issue a signed token for a known user
- **Size estimate:** ~4 files (~250 lines), <= 5 OpenSpec tasks
- **Gate:** node default
- **Verification:** a token issued now expires in exactly 24 hours
- **Review tier:** full-review
- **Collides with:** [api.3]
- **Dependencies:** api.1 (types)

### api.3: Session store

- **Consumes:** [auth-token@v1]
- **Produces:** [session@v2]
- **Governed by:** [ADR-002]
- **Scope:** store sessions in the region OQ1 settles
- **Size estimate:** ~5 files (~300 lines), <= 6 OpenSpec tasks
- **Gate:** `npm test -- sessions`
- **Verification:** a session survives a restart
- **Review tier:** full-review
- **Collides with:** [api.2]
- **Dependencies:** api.2; contingent (OQ1)

## Open questions

| ID | Question | Status | Waits on | Affects |
|----|----------|--------|----------|---------|
| OQ-A1 | Rotate signing keys monthly? | PARTIAL | security review | acme.api.2 |

### OQ-A1 - Key rotation

Monthly is likely.

## Governance updates (pending reconcile)

- request: session@v2 consumers gain acme.web.console.2
