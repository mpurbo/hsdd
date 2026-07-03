// Fixture builder: writes a throwaway HSDD project tree for tests.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

export function makeProject(files) {
  const root = mkdtempSync(join(tmpdir(), "hsdd-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// A minimal consistent project used across suites: one leaf-parent node with
// two phases, one contract with schema+fixtures, one accepted ADR.
export const BASE_PROJECT = {
  "docs/conventions.md": `---
specs_dir: docs/spec
verify_dir: docs/verify
contracts_dir: contracts
adr_dir: adr
openspec_dir: openspec
ordering_policy: interfaces-first
profile: single-team
---

# Project Conventions
`,
  "docs/spec/acme.backend.auth.md": `---
id: acme.backend.auth
kind: leaf-parent
consumes: [user-model@v1]
produces: [auth-token@v1]
governed_by: [ADR-001]
---

### acme.backend.auth: Authentication

**Purpose:** issue and verify tokens
**Owns:** token lifecycle
**Does not own:** user profiles
**Decomposes into:** phases (see phase plan below)
**Isolation strategy:** fixtures for user-model; mock JWKS

## Phase Plan

### acme.backend.auth.1: Types and contracts

**Consumes:** [user-model@v1]
**Produces:** [auth-token@v1]
**Governed by:** [ADR-001]
**Scope:** domain types and the auth-token contract
**Size estimate:** ~6 files, ~250 lines, <= 8 OpenSpec tasks
**Gate:** cargo test && npm run contract:verify auth-token
**Verification:** fixture round-trip
**Review tier:** spot-check
**Touches:** [src/auth/**, tests/auth/**]
**Dependencies:** none

### acme.backend.auth.2: Token issuance

**Consumes:** [auth-token@v1]
**Produces:** []
**Scope:** issue JWTs on login
**Size estimate:** ~4 files, ~300 lines, <= 8 OpenSpec tasks
**Gate:** cargo test
**Verification:** manual login flow
**Review tier:** full-review
**Dependencies:** phase 1 (auth-token@v1 only)
`,
  "docs/spec/acme.web.md": `---
id: acme.web
kind: internal
consumes: [auth-token@v1]
produces: []
---

### acme.web: Web Console

**Purpose:** merchant web console
**Owns:** web UI
**Does not own:** backend
**Decomposes into:** acme.web.dashboard
**Isolation strategy:** contract fixtures
`,
  "contracts/auth-token.md": `---
id: auth-token
version: v1
status: stable
kind: api
owner: acme.backend.auth
governed_by: [ADR-001]
schema: schemas/auth-token.schema.json
fixtures: fixtures/auth-token/
---

# Contract: auth-token

## Interface
{ sub, exp, iat, scopes }

## Guarantees / invariants
- exp is always greater than iat

## Versioning
- v1 current.

## Validation
- schema: schemas/auth-token.schema.json
- fixtures: fixtures/auth-token/
`,
  "contracts/user-model.md": `---
id: user-model
version: v1
status: stable
kind: shared-model
owner: acme.backend.users
schema: schemas/user-model.schema.json
---

# Contract: user-model

## Interface
{ id, email }

## Guarantees / invariants
- id is immutable
`,
  "docs/spec/acme.backend.users.md": `---
id: acme.backend.users
kind: leaf-parent
consumes: []
produces: [user-model@v1]
---

### acme.backend.users: Users

**Purpose:** user model
**Owns:** user records
**Does not own:** auth
**Decomposes into:** phases (see phase plan below)
**Isolation strategy:** in-memory store

### acme.backend.users.1: User model

**Consumes:** []
**Produces:** [user-model@v1]
**Scope:** user model types
**Size estimate:** ~2 files, ~80 lines, <= 8 OpenSpec tasks
**Gate:** cargo test
**Verification:** review types
**Review tier:** spot-check
**Dependencies:** none
`,
  "schemas/auth-token.schema.json": `{}`,
  "schemas/user-model.schema.json": `{}`,
  "fixtures/auth-token/example.json": `{}`,
  "adr/001-auth-provider.md": `---
id: ADR-001
status: accepted
affects: [acme.backend.auth, auth-token@v1]
date: 2026-07-02
---

# ADR-001: Auth provider

## Context
Login must work across mobile and web.

## Decision
Use provider X with rotating asymmetric keys.

## Consequences
- token verification needs the public JWKS endpoint
`,
  "openspec/config.yaml": `context: |
  ## Project: acme
  Merchant onboarding.

  <!-- hsdd:phase-context:begin -->
  <!-- hsdd:phase-context:end -->

rules:
  proposal:
    - "First line: Phase: {phase-id}"
`,
};
