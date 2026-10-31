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
governed_by: [ADR-001]   # optional; the contract's side of `Governed by`, omit when empty
compatibility: versioned   # additive-only | versioned | frozen; declared per version
produced_by: [acme.backend.auth.2]
consumers: [acme.backend.billing.2, acme.mobile.session.1]
external_consumers: []  # consumers outside the tree; omit when empty
former_consumers: []    # phases that migrated to a later version; moved by hsdd-reconcile; omit when empty
phase_ids: provisional  # provisional | final; flipped only by hsdd-reconcile
---

# Contract: auth-token

## Interface
<schema, signature, endpoint, event payload, or file layout>

## Guarantees / invariants
- G1: token.sub is immutable for the token's lifetime
- G2: exp is always greater than iat

## Versioning
- v1 current. Breaking changes require v2 + a migration note. v1 stays until all
  consumers migrate.
- Breaking: removing or retyping a claim field, or shortening `exp`.

## Validation
- schema: hsdd/contract/schema/auth-token.schema.json
- fixture: hsdd/contract/fixture/auth-token/
```

Keep the frontmatter complete and accurate: it is the source of truth for the
registry and for the context `hsdd-config` injects into each phase.

**One file per version.** A contract's first version is
`hsdd/contract/{slug}.md`, with `schema/{slug}.schema.json` and
`fixture/{slug}/`. Each later version is a new file beside it,
`{slug}.v{n}.md`, with `schema/{slug}.v{n}.schema.json` and
`fixture/{slug}.v{n}/`, and its `## Validation` names those paths. Nothing
is renamed, so every citation of an earlier version's paths keeps
resolving. Skills find a version by its frontmatter `id` and `version`,
never by its filename.

`governed_by` is the contract's side of the `Governed by` link an ADR's
`affects` requires; the registry generator keeps it and projects nothing from
it. Each bullet under `## Guarantees / invariants` opens `G{n}:` so fixtures
and phase gates can cite one guarantee by id. The `Breaking:` line under
`## Versioning` names what counts as breaking for this contract.

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
`hsdd/contract/schema/{slug}.schema.json` and `hsdd/contract/fixture/{slug}/`,
with `{slug}.v{n}` in place of `{slug}` for a later version (above);
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
(for a later version, its own paths, per One file per version), as the
table above lists them: example payloads for `api` and `event`, edge cases
for `schema` and `shared-model`, a sample tree for `file`, recorded
invocations for `cli`. A phase never writes them; the producing phase's gate replays
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
  | `additive-only` | optional additions only; never remove, retype, or repurpose a field; consumers ignore unknowns | compatible changes keep the version; claimable for a change within the version only if that version's existing fixtures still pass against the changed schema |
  | `versioned` (default) | breaking changes bump | next version, a migration note in `## Versioning`, a deprecation window |
  | `frozen` | not under our control, or adopted pending investigation | a change is a new contract, not a new version |

- A backward-compatible addition stays the same version. A breaking change
  creates `v{n+1}`, and its `## Versioning` carries a migration note that
  names the **migration mode**:

  | mode | when | the old version |
  |------|------|-----------------|
  | `coexisting` | the producer serves both versions through a window (two paths, or negotiation) | stays `stable` until it has no live consumer, then `deprecated` with a sunset date, then `retired` |
  | `lockstep` | one surface, one shape: the phase that ships v{n+1} stops serving v{n} | goes `deprecated` in the run that drafts v{n+1}, its `## Versioning` naming the sunset: when the first phase in v{n+1}'s `produced_by` ships. There is no window, so every consumer node needs a migration phase that lands with that phase |

  A migration note that names no mode reads as `coexisting`, the rule
  before v0.10.2.
- **The rest of the ripple.** The run that drafts v{n+1} also finds every
  other text that names v{n}. Another contract whose body names v{n} in a
  statement that holds for v{n+1} too gets a compatible amendment here,
  naming both. An ADR whose `affects` names v{n} gains v{n+1} through
  `hsdd-adr`: this run's report names that handoff, to run before the
  phase plans. Node specs are not edited here: the planners' `confirm`
  entries carry the new version, and `hsdd-reconcile` writes it into
  them.
- Consumers always reference a specific version: `auth-token@v1`.
  `external_consumers` lists consumers outside the tree, by name.
- **Live and former consumers.** `consumers` lists the phases that consume
  this version now. A consumer phase has **migrated** when the newest
  shipped phase (its verification doc on the spec repo's main line, the
  conventions' `**Main line:**`, `main` when absent) of its node that names
  this contract in Consumes names a later version and not this one. The
  checkpoint reports that node's shipped phase ids still in this version's
  `consumers`, and `hsdd-reconcile` moves them to `former_consumers`, never
  deleting one.
  `former_consumers` is history: no rule reads it as live. A version's
  **live consumers** are its `consumers` and its `external_consumers`; an
  external entry leaves by hand, when that consumer says it has moved.
- `status` lifecycle: `draft → stable → deprecated → retired`. New contracts
  and new versions start `draft`. `hsdd-reconcile` flips `draft` to
  `stable` at the end of a reconcile pass, once both sides have confirmed
  their phase ids
  (`phase_ids: final`), no `request` naming the contract remains
  unresolved, and the executable validation artifact exists. `stable` means
  the interface is frozen and safe to build against, not that the producer
  has shipped; implementation confidence is what phase gates and review
  tiers certify.
- **Retiring a version that still has a live consumer, an
  `external_consumers` entry included, is a checkpoint finding**, not a
  contract edit. A `deprecated` version past its sunset with no live
  consumer goes to `retired` through `hsdd-reconcile`, on the checkpoint's
  plan step. When a node is retired (`- **Status:** retired` in its
  spec), the contracts it solely produced go to `retired` the same way,
  through `hsdd-reconcile`, and the live-consumer rule applies to each.

**Citation touch.** When a source document or a contract moves to a new
version, every artifact that cites the old version is touched once, by its
owning skill. Invoked as `citation touch {file}: move its citations to the
current versions`, change only citations and the sentences they sit in:

- A **live** citation moves to the current version: a node's Consumes or
  Produces line, an unshipped phase's boundary or delivery line, a guarantee
  citation, a fixture header comment, any sentence that states what holds
  now.
- A **shipped phase** (one whose verification doc is on the spec repo's
  main line, the conventions' `**Main line:**`, `main` when absent) is
  history in full: nothing in it moves. While a shipped phase or an
  `external_consumers` entry still names the old version, that version keeps
  its `stable` standing in the contract's `## Versioning` (the old version
  stays until all consumers migrate), and the touch reports each such
  reference as kept.
- **Historical** text keeps the version it describes: a dated amendment
  entry, a migration note, a "Corrected" paragraph, an account of what an
  earlier version did.
- When a moved citation sits in a sentence the new version makes false,
  restate the sentence to match the cited artifact's current text, and record
  one decision per sentence: what it said, what it says now, which part of
  the new version it follows. That is a compatible wording change in the
  touched file.
- Never change the touched artifact's own declarations, guarantees, cases or
  fixture behavior in a citation touch. When keeping a sentence true would
  need that, leave it, route it as a finding, and name the step it needs.
- Classify the touch against the touched artifact's own versioning rules
  (it normally stays at its version) and record that as one decision.
- Report how many citations moved and how many were kept as history.

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

## Unattended runs

When your arguments contain `--unattended {step}`, you run as step
`{step}` of an `hsdd-auto` run, and your dispatch file
`hsdd/auto/dispatch/{step}.md` names your report. Then:

1. At each ask point in the table below, act on its disposition.
   `return`: write your report with `status: "stopped"` and a `stop`
   object (the question verbatim, the rule of this skill that requires it,
   the stop class, the options with their consequences, your
   recommendation, what it blocks), leave your partial artifacts in place,
   and end your turn. Never answer it yourself. `decide`: take the decision
   and record it with `would_have_asked: true` and the class the table
   gives, or `false` where the table gives none, unless a careful engineer
   would have asked the owner first: then `true` with class `judgement`.
2. Record every decision when you take it, with
   `node hsdd/scripts/auto/decide.mjs --step {step} --stdin` and the
   decision as JSON in the shape your dispatch file shows. Never write a
   time or an id yourself.
3. Do not invoke interactive companion skills such as brainstorming; the
   run's decision policy replaces their dialogue.
4. Copy each of this skill's quality gates (for `hsdd-phase-plan`, the
   items of its Phase Design Checklist) verbatim into the report's
   `self_check`, with `pass`, `fail` or `n/a` and a note. A gate that
   requires a human act (the human confirmed, decided or stated) is `n/a`,
   and its note names the decision that stood in for that act. So is a
   gate that a give-way rule of the table below overrides, its note naming
   the decision that applied the rule, and a gate whose subject this step
   did not touch, its note reading `not exercised by this step`.
5. A predecided answer in your dispatch file for a class in the table
   replaces the `return` for that class: apply it, record your decision
   citing the predecided decision's id, and continue. The exception is a
   breaking change under `compatibility: frozen` or at `v0`, which you
   report as a run-stop candidate whatever the predecided answers say
   (§8.2).
6. Where the table says a rule of this skill gives way, the recorded
   decision replaces the human act that rule requires, and the owner's
   later review of that decision is the act.

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| A breaking change to a `stable` contract under `compatibility: versioned` | return. The skill applies its versioning rule itself, so this stop is the section's own: `skill_rule` quotes its sentence "under an unattended run, a breaking change to a `stable` contract under `compatibility: versioned` is returned to the orchestrator" | `breaking-amend` |
| A breaking change to a `frozen` contract, or to a `v0` contract | report it as a run-stop candidate; no predecided answer applies (a frozen contract takes a new contract, a `v0` one a redesign) | `breaking-amend` |
| A breaking change to a `draft` contract | decide between `v{n+1}` with a migration note and a change in place with a `## Versioning` line (the rule "a breaking change creates `v{n+1}`" gives way for drafts) | `judgement` |
| Interface and guarantee choices the sources leave open | decide | `judgement` when a careful engineer would ask |

Under an unattended run, a breaking change to a `stable` contract under
`compatibility: versioned` is returned to the orchestrator. Under an
unattended run the gate "the block changed in any commit that added fixtures
to it" reads "in this step's changes".

## Quality Gates

- [ ] Frontmatter has id, version, status, kind, owner, compatibility, produced_by, consumers; external_consumers and former_consumers when any exist.
- [ ] `consumers` lists phase ids that consume this version now; migrated ones are under `former_consumers`, never deleted.
- [ ] The Interface section is concrete enough to mock against.
- [ ] At least one guarantee/invariant is stated.
- [ ] A breaking change bumped the version in a new file beside the old one
      (`{slug}.v{n}.md`, its schema and fixtures likewise), and its migration
      note names the mode; under `lockstep` the old version is `deprecated`
      in the same run, with its sunset named.
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
| "v1 stays stable until consumers migrate; nothing to do to it at the bump" | Only when the producer can serve both. At one endpoint with one shape the bump is `lockstep`: deprecate v{n} now and name its sunset, or v{n} stays `stable` with nothing serving it. |
| "Rename v1's file to `{slug}.v1.md` so the versions match" | Every phase context, verification doc and spec line that cites v1's paths would break. A later version takes the suffix; the first keeps its paths. |
| "That phase consumed v1 once, so it stays in `consumers`" | `consumers` is who consumes the version now. A migrated phase moves to `former_consumers`, through `hsdd-reconcile`, so "no live consumer" can be read when the version retires. |
| "Put the schema in the node spec" | Then consumers must read the producer's spec. Contracts exist so they do not. |
| "The producing phase will write the schema from the real code" | A phase never writes under `hsdd/contract/`. Write it here from the Interface; a schema that turns out wrong is caught by the producer's replay and renegotiated mid-phase. |
| "Both sides can regenerate the shared types; they'll match" | Two generations from the same prose diverge. Name one canonical artifact path and one owning phase in the contract. |
| "I'll note 'update phase ids later' in the body" | Prose notes invite concurrent edits from both sides. `phase_ids: provisional` carries that state; `hsdd-reconcile` flips it. |
| "I'll explain the open question inline so the contract is self-contained" | A second definition forks the question. Cite the ID; the owning spec carries the question, status, and resolution trail. |
