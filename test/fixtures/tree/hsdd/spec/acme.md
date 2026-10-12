# acme: Acme Platform

## Overview

Acme lets a merchant sign in and manage outlets.

## Child nodes

### acme.api: Token Service

- **Kind:** leaf-parent
- **Purpose:** issue and verify access tokens
- **Owns:** token issuance, session storage
- **Does not own:** user records
- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1], [session@v2]
- **Governed by:** [ADR-001]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fake user store, fixed clock

### acme.web: Merchant Web

- **Kind:** internal
- **Purpose:** every screen a merchant uses
- **Team:** web
- **Owns:** the console
- **Does not own:** tokens
- **Consumes:** [auth-token@v1], [session@v1], [outlet-api@v1]
- **Produces:** none
- **Decomposes into:** acme.web.console
- **Isolation strategy:** mocked API

### acme.ops: Operations Scripts

- **Kind:** leaf-parent
- **Purpose:** the deploy scripts that existed before the tree
- **Adopted:** as-built
- **Consumes:** none
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** dry-run flag

### acme.legacy: Legacy Portal

- **Kind:** leaf-parent
- **Purpose:** the old portal
- **Status:** retired
- **Consumes:** none
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** none

## Open questions

| ID | Question | Status | Waits on | Affects |
|----|----------|--------|----------|---------|
| OQ1 | Which region hosts the sessions? | OPEN | ext: infra team | acme.api.3 |
| OQ2 | Do outlets need soft delete? | RESOLVED (2026-09-01) | none | ADR-002 |

### OQ1 - Session region

Undecided.

### OQ2 - Soft delete

Decided in ADR-002.
