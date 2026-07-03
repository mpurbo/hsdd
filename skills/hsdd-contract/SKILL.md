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
is machine-readable, authored intent. The body is the human-facing interface
injected into a consuming phase's context (`hsdd context`). Anything derivable
from other artifacts (who consumes it, who produces it) is never authored at
all; `hsdd registry` projects it.

## When to Use

- A node spec (`hsdd-spec`) named a contract id under `Consumes`/`Produces` and
  the body needs writing.
- A contract must change: bump the version, add a guarantee, deprecate.
- A phase discovered mid-apply that a consumed contract is wrong or incomplete
  (renegotiation, below).

**Do NOT use for** node decomposition (`hsdd-spec`) or phase planning
(`hsdd-phase-plan`).

## Prerequisite: the `hsdd` CLI

All deterministic operations (registry projection, lint, phase context) belong
to the `hsdd` CLI, installed once per project:

```bash
npm i -D hsdd        # or run ad hoc: npx hsdd <command>
```

Never write, retype, or hand-maintain a registry generator; that failure mode
is retired. The CLI owns it.

## Contract Artifact

Write to `contracts/{slug}.md`:

```markdown
---
id: auth-token
version: v1
status: stable          # stable | draft | deprecated
kind: api               # api | event | schema | shared-model | file | cli
owner: acme.backend.auth
governed_by: [ADR-001]                    # optional
schema: schemas/auth-token.schema.json    # required for stable (one of schema/fixtures)
fixtures: fixtures/auth-token/            # required for stable (one of schema/fixtures)
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
```

Do NOT author `produced_by` or `consumers`: they were removed in v0.5. The
registry derives both by scanning node frontmatter and phase blocks; a field
lives in exactly one place.

## Stable Means Machine-Checkable

A contract may not be `stable` unless it carries at least one executable
validation artifact, enforced by `hsdd lint` (paths must exist):

| kind | expected validation |
|------|---------------------|
| api, event | schema plus example payloads |
| schema, shared-model | schema plus edge-case fixtures |
| file | a sample tree under fixtures/ |
| cli | recorded invocations (args, stdout, exit code) |

Both sides of the contract run it:

- **Producer:** the producing phase's `Gate:` includes a contract-verification
  command (e.g. `npm run contract:verify auth-token`) proving real output
  validates against the schema and reproduces the fixtures.
- **Consumer:** consuming phases build and test against the fixtures, not
  hand-rolled mocks. The mocks ARE the fixtures. A contract bump changes the
  fixtures and consumer tests fail loudly instead of drifting silently.

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
- Under the multi-team profile, a bump with cross-team consumers starts `draft`
  and may not go `stable` until every consuming team has an
  `Acked-by: <team> (date)` line in `## Versioning` (`hsdd lint` enforces it;
  consumers are derived, so the list is never stale).

## Mid-Phase Renegotiation

When a phase discovers mid-apply that a consumed contract is wrong:

1. **Pause** the apply at a task boundary; never improvise around the contract.
2. **Record** the gap as a learning in the in-progress verification notes.
3. **Renegotiate** here: a backward-compatible addition amends the current
   version; a breaking change drafts `v{n+1}` with a migration note.
4. **Re-derive** the context: `npx hsdd context {phase-id} --write`.
5. **Resume** the change. Producer-side changes ship through the producing
   node's next phase; the consumer never edits another node's internals.

## The Registry (generated, never authored)

`contracts/INDEX.md` is a pure projection. After any contract change:

```bash
npx hsdd registry     # writes contracts/INDEX.md and adr/INDEX.md
npx hsdd lint         # verify referential integrity
```

Wire both into pre-commit or CI. The `owner` and `consumers` columns are derived
from the tree, so the index cannot rot.

## Quality Gates

- [ ] Frontmatter has id, version, status, kind, owner (and NO produced_by/consumers).
- [ ] A `stable` contract declares schema and/or fixtures, and the paths exist.
- [ ] The Interface section is concrete enough to build against the fixtures.
- [ ] At least one guarantee/invariant is stated.
- [ ] A breaking change bumped the version and added a migration note.
- [ ] `npx hsdd registry` was run; `npx hsdd lint` is clean.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The contract is obvious, skip the file" | Explicit contracts enable fixture testing and node isolation. Write it. |
| "I'll add consumers to the frontmatter for clarity" | Derived data is never authored. `hsdd registry` projects consumers; a hand-written list rots. |
| "It's basically stable, fixtures can come later" | `stable` without executable validation is a promise nothing checks. Lint will reject it. Keep it `draft` until the schema or fixtures exist. |
| "I'll mock the consumer side by hand" | Hand-rolled mocks drift from the contract silently. The fixtures are the mocks. |
| "I'll just edit INDEX.md by hand" | The registry is derived. Run `npx hsdd registry`. |
| "Small change, no version bump" | If a consumer's code could break, it is a new version. Bump and note the migration. |
| "Put the schema in the node spec" | Then consumers must read the producer's spec. Contracts exist so they do not. |
