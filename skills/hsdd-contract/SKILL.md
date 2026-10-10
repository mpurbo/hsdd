---
name: hsdd-contract
description: >
  Use when defining, versioning, or updating a contract between HSDD nodes (the
  interface one node exposes to another). Triggers: "define the X contract",
  "what does auth produce or consume", "add a contract", "bump the contract to
  v2", "contract registry", "producer and consumer interface", "event schema
  between subsystems", "shared model type", "hsdd/contract/INDEX.md". Contracts are
  first-class versioned files in hsdd/contract/. Do NOT use for node decomposition
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
- The registry (`hsdd/contract/INDEX.md`) needs regenerating after a change.
- A phase discovered mid-apply that a consumed contract is wrong or
  incomplete, paused at a task boundary, and wrote the gap, in `request` or
  `amend` wording, under its verification doc's Outstanding; the human
  recorded it in the node's plan. Renegotiate here, at the root: a
  compatible addition amends the current version; a breaking change drafts
  `v{n+1}` with a migration note; either way the schema and fixtures change
  here too. The human then propagates the change into the phase's branch,
  and the phase re-runs its context switch and resumes. Producer-side code
  changes ship through the producing node's own phases.

**Do NOT use for** node decomposition (`hsdd-spec`) or phase planning
(`hsdd-phase-plan`).

## Contract Artifact

Write to `hsdd/contract/{slug}.md`:

```markdown
---
id: auth-token
version: v1
status: stable          # draft | stable | deprecated | retired
kind: api               # api | event | schema | shared-model | file | cli
owner: acme.backend.auth
compatibility: versioned   # additive-only | versioned | frozen; declared per version
produced_by: [acme.backend.auth.2]
consumers: [acme.backend.billing.2, acme.mobile.session.1]
external_consumers: []  # consumers outside the tree; omit when empty
phase_ids: provisional  # provisional | final; flipped only by hsdd-reconcile
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
- schema: hsdd/contract/schema/auth-token.schema.json
- fixture: hsdd/contract/fixture/auth-token/
```

Keep the frontmatter complete and accurate: it is the source of truth for the
registry and for the context `hsdd-config` injects into each phase.

## Provisional Phase Ids and the Writer Rule

`produced_by` and `consumers` usually start as guesses (the first phase of
each leaf-parent) because contracts are authored before phase plans exist.
Mark that state in frontmatter: `phase_ids: provisional`. Do not write prose
notes like "update these ids later" in the body; prose addressed to "whoever
runs next" invites concurrent edits from both sides. The field carries the
state, and only `hsdd-reconcile` flips it to `final`, after the phase plans on
both sides have confirmed their ids.

Contract files are written at the repo root only, in `hsdd-contract` or
`hsdd-reconcile` sessions. Phase planning (`hsdd-phase-plan`) never edits a
contract: it emits `confirm`, `amend`, and `request` entries in its node's
`## Governance updates (pending reconcile)` section instead.

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

## Executable Validation: `stable` Means Machine-Checkable

A contract may not be `stable` unless it carries at least one executable
validation artifact, a schema or a fixtures directory, at the canonical
paths its `## Validation` section names. Default locations are
`hsdd/contract/schema/{slug}.schema.json` and `hsdd/contract/fixture/{slug}/`;
the frontmatter and the Validation section are authoritative if a project
overrides them. `hsdd-reconcile` asserts the artifact exists at the
`draft → stable` flip. Per kind:

| Kind | Wants |
|------|-------|
| api, event | schema plus example payloads |
| schema, shared-model | schema plus edge-case fixtures |
| file | a sample tree |
| cli | recorded invocations |

**Both gates run the contract.** The gate of any phase that produces this
contract validates the phase's real output against the schema and
reproduces the fixtures (`hsdd-phase-plan` writes that into the phase's
Gate by default). Consuming phases build and test against the fixtures,
not hand-rolled mocks: **the mocks are the fixtures**, so a bump changes the
fixtures and consumer tests fail loudly instead of drifting.

**Authoring writes the artifact.** When this skill creates a contract or a
new version, it also writes `hsdd/contract/schema/{slug}.schema.json` from
the Interface and the kind's fixtures under `hsdd/contract/fixture/{slug}/`
(the table above): example payloads for `api` and `event`, edge cases for
`schema` and `shared-model`, a sample tree for `file`, recorded invocations
for `cli`. A phase never writes them; the producing phase's gate replays
them.

**Grandfathered contracts.** A contract that was already `stable` without
an artifact when the project upgraded carries `validation: grandfathered` in
frontmatter, written by `hsdd-reconcile` on the upgrade checkpoint's plan
step. The set is closed at upgrade: a new contract may never take the key.
It discharges on touch: the first phase that produces, amends, or bumps a
grandfathered contract cannot pass its gate until the artifact exists,
written at the root through this skill. Once it exists, the checkpoint
files a discharge finding and `hsdd-reconcile` removes the key. The
checkpoint reports the remaining count every pass and checks every mark
against the upgrade step's list.

## Adopted Contracts: `## Observed completeness`

Every `v0` contract carries one more required body section, the
contract-level analogue of a node's `unknown:` lines:

```markdown
## Observed completeness

- covered by fixtures: happy path, 4xx envelope, pagination
- NOT exercised: partial-batch failure, idempotency-key replay
- inferred from code, never observed in traffic: retry-after semantics
```

An adopted contract's guarantees are inferred; recording what the fixtures
do not reach is what keeps `stable` honest. The caveat is **maintained,
not write-once**: when a fixture added through this skill closes a gap, the
same edit updates this block. A `v0` contract whose fixture directory gained
files while this block stayed unchanged is a stale-caveat finding at the
next checkpoint. Until promotion gives an adopted node phases, its
contracts' `produced_by` and `consumers` name node ids with
`phase_ids: provisional`; the first phase plan on each side confirms them
through `hsdd-reconcile`, as for any other contract.

## Versioning Policy

- Versions are `v{n}`, `n >= 0`. No semantic versioning. **`v0` is the
  version of an adopted contract**: the interface as the existing system
  already implements it, written by `hsdd-adopt`, so `v1` means "the first
  version HSDD designed" and `@v0` reads as observed-not-designed at every
  reference site. A contract authored here starts at `v1`. `v0` is a
  permanent property, not a waypoint: extension under `additive-only`
  never exits it; **`v0 → v1` is the contract-level adoption exit**, taken
  only when the interface is genuinely redesigned, and the redesigned
  version re-declares its `compatibility`.
- `compatibility` is declared **per version**:

  | value | meaning | consequence |
  |-------|---------|-------------|
  | `additive-only` | optional additions only; never remove, retype, or repurpose a field; consumers ignore unknowns | compatible changes keep the version; claimable only if the existing fixtures still pass against the new schema |
  | `versioned` (default) | breaking changes bump | next version, a migration note in `## Versioning`, a deprecation window |
  | `frozen` | not under our control, or adopted pending investigation | a change is a new contract, not a new version |

- A backward-compatible addition stays the same version. A breaking change
  creates `v{n+1}` and a migration note in `## Versioning`. The old version
  remains `stable` until every consumer migrates, then `deprecated` with a
  sunset date, then `retired`.
- Consumers always reference a specific version: `auth-token@v1`.
  `external_consumers` lists consumers outside the tree, by name.
- `status` lifecycle: `draft → stable → deprecated → retired`. New contracts
  start `draft`. `hsdd-reconcile` flips `draft` to `stable` at the end of a
  reconcile pass, once both sides have confirmed their phase ids
  (`phase_ids: final`), no `request` naming the contract remains
  unresolved, and the executable validation artifact exists. `stable` means
  the interface is frozen and safe to build against, not that the producer
  has shipped; implementation confidence is what phase gates and review
  tiers certify.
- **Retiring a version that still has a live consumer, an
  `external_consumers` entry included, is a checkpoint finding**, not a
  contract edit. When a node is retired (`- **Status:** retired` in its
  spec), the contracts it solely produced go to `retired` the same way,
  through `hsdd-reconcile`, and the live-consumer rule applies to each.

## The Registry (generated, never hand-edited)

`hsdd/contract/INDEX.md` is derived data: a pure projection over every contract's
frontmatter. Do not hand-maintain it. Run the bundled generator after any change:

```bash
node hsdd/scripts/gen-registry.mjs   # writes hsdd/contract/INDEX.md (and hsdd/adr/INDEX.md)
```

On first use, copy the bundled `scripts/gen-registry.mjs` **verbatim** from this
skill into the project's `hsdd/scripts/` directory (this skill's base directory is
printed when the skill loads). Do NOT reimplement it from the description in this
file: a retyped copy silently mis-projects the registry. For example, a hand-written
version tends to reuse the ADR `affects` column for contracts, which do not have
`affects` (they have `owner` / `consumers`), producing an empty, wrong column that
still passes a naive freshness check. Copy the real file; then, ideally, wire it
into a pre-commit or CI hook. A script is deterministic and costs zero model tokens;
agent-maintained (or agent-rewritten) generators drift.

The same generator also projects `hsdd/adr/INDEX.md` from ADR frontmatter. ADR files
are authored by `hsdd-adr`, not here; this skill owns `hsdd/contract/` only.

## Quality Gates

- [ ] Frontmatter has id, version, status, kind, owner, compatibility, produced_by, consumers; external_consumers when any exist.
- [ ] `consumers` lists phase ids that actually consume this contract.
- [ ] The Interface section is concrete enough to mock against.
- [ ] At least one guarantee/invariant is stated.
- [ ] A breaking change bumped the version and added a migration note.
- [ ] The registry was regenerated.
- [ ] `phase_ids` is present (`provisional` until `hsdd-reconcile` finalizes it).
- [ ] Every code-level artifact both sides consume (types file, fixtures, shared package) names its canonical path and its owner in the Interface or Validation section: the owning phase for code, `hsdd-contract` for validation artifacts.
- [ ] A contract or version created by this run has its schema and its
      kind's fixtures written at the canonical paths.
- [ ] Open questions are cited by ID only — never defined here; prose
      justifying behavior as "pending OQ-x" is swept when the OQ resolves
      (hsdd-reconcile).
- [ ] A `stable` contract names a schema or a fixtures directory at the
      canonical paths and the artifact exists, or it carries
      `validation: grandfathered` (never on a contract authored after the
      upgrade).
- [ ] No version is `retired` while a consumer or an external consumer
      still names it.
- [ ] A `v0` contract carries `## Observed completeness`, and the block
      changed in any commit that added fixtures to it.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The contract is obvious, skip the file" | Explicit contracts enable mock testing and node isolation. Write it. |
| "I'll write the generator from this description" | The bundled `scripts/gen-registry.mjs` is the source of truth. Copy it verbatim; never retype or reimplement it. A rewritten copy drifts and mis-projects the registry (a naive freshness check will not catch it). |
| "I'll just edit INDEX.md by hand" | The registry is derived. Hand edits drift from the contracts. Run the generator. |
| "Small change, no version bump" | If a consumer's code could break, it is a new version. Bump and note the migration. |
| "Put the schema in the node spec" | Then consumers must read the producer's spec. Contracts exist so they do not. |
| "The producing phase will write the schema from the real code" | A phase never writes under `hsdd/contract/`. Write it here from the Interface; a schema that turns out wrong is caught by the producer's replay and renegotiated mid-phase. |
| "Both sides can regenerate the shared types; they'll match" | Two generations from the same prose diverge. Name one canonical artifact path and one owning phase in the contract. |
| "I'll note 'update phase ids later' in the body" | Prose notes invite concurrent edits from both sides. `phase_ids: provisional` carries that state; `hsdd-reconcile` flips it. |
| "I'll explain the open question inline so the contract is self-contained" | A second definition forks the question. Cite the ID; the owning spec carries the question, status, and resolution trail. |
