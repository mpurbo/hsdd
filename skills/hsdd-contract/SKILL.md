---
name: hsdd-contract
description: >
  Use when defining, versioning, or updating a contract between HSDD nodes (the
  interface one node exposes to another). Triggers: "define the X contract",
  "what does auth produce or consume", "add a contract", "bump the contract to
  v2", "contract registry", "producer and consumer interface", "event schema
  between subsystems", "shared model type", "contracts/INDEX.md". Contracts are
  first-class versioned files in contracts/. Do NOT use for node decomposition
  (use hsdd-spec) or phase planning (use hsdd-phase-plan).
---

# HSDD Contract: First-Class Versioned Interfaces

A contract is the **only** thing one HSDD node may know about another. It is a
standalone, versioned file, not prose buried in a spec.

**Core principle:** A contract has two parts with two jobs. The YAML frontmatter
is machine-readable metadata projected into the registry. The body is the
human-facing interface injected into a consuming phase's context. A consumer
reads exactly one of those, never the producing node's internals.

## When to Use

- A node spec (`hsdd-spec`) named a contract id under `Consumes`/`Produces` and
  the body needs writing.
- A contract must change: bump the version, add a guarantee, deprecate.
- The registry (`contracts/INDEX.md`) needs regenerating after a change.

**Do NOT use for** node decomposition (`hsdd-spec`) or phase planning
(`hsdd-phase-plan`).

## Contract Artifact

Write to `contracts/{slug}.md`:

```markdown
---
id: auth-token
version: v1
status: stable          # stable | draft | deprecated
kind: api               # api | event | schema | shared-model | file | cli
owner: acme.backend.auth
produced_by: [acme.backend.auth.2]
consumers: [acme.backend.billing.2, acme.mobile.session.1]
---

# Contract: auth-token

## Interface
<schema, signature, endpoint, event payload, or file layout>

## Guarantees / invariants
- token.sub is immutable for the token's lifetime
- exp is always greater than iat

## Versioning
- v1 current. Breaking changes require v2 + a migration note. v1 stays until all
  consumers migrate.

## Validation
- fixture: fixtures/auth-token.json
- schema: schemas/auth-token.schema.json
```

Keep the frontmatter complete and accurate: it is the source of truth for the
registry and for the context `hsdd-config` injects into each phase.

## Dependency Types

Classify how consumers couple to this contract so `hsdd-spec` can sequence work:

| Type | Meaning |
|------|---------|
| api | request/response interface a consumer calls |
| event | async message a consumer subscribes to |
| schema | data shape exchanged via file, table, or payload |
| shared-model | a value type shared across nodes (Money, Address) |
| file | a generated file or directory layout |
| cli | command arguments, stdout shape, exit codes |

## Versioning Policy

- Versions are `v{n}`. No semantic versioning.
- A backward-compatible addition stays the same version.
- A breaking change creates `v{n+1}` and a migration note in `## Versioning`. The
  old version remains `stable` until every consumer migrates, then `deprecated`.
- Consumers always reference a specific version: `auth-token@v1`.

## The Registry (generated, never hand-edited)

`contracts/INDEX.md` is derived data: a pure projection over every contract's
frontmatter. Do not hand-maintain it. Run the bundled generator after any change:

```bash
node scripts/gen-registry.mjs        # writes contracts/INDEX.md (and adr/INDEX.md)
```

On first use, copy `scripts/gen-registry.mjs` from this skill into the project's
`scripts/` directory and, ideally, wire it into a pre-commit or CI hook. A script
is deterministic and costs zero model tokens; agent-maintained indexes drift.

## Quality Gates

- [ ] Frontmatter has id, version, status, kind, owner, produced_by, consumers.
- [ ] `consumers` lists phase ids that actually consume this contract.
- [ ] The Interface section is concrete enough to mock against.
- [ ] At least one guarantee/invariant is stated.
- [ ] A breaking change bumped the version and added a migration note.
- [ ] The registry was regenerated.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The contract is obvious, skip the file" | Explicit contracts enable mock testing and node isolation. Write it. |
| "I'll just edit INDEX.md by hand" | The registry is derived. Hand edits drift from the contracts. Run the generator. |
| "Small change, no version bump" | If a consumer's code could break, it is a new version. Bump and note the migration. |
| "Put the schema in the node spec" | Then consumers must read the producer's spec. Contracts exist so they do not. |
