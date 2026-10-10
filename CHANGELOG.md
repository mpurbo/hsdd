# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.0] - 2026-10-10

The release that follows 0.7.1. The 0.8.0 and 0.9.0 entries below describe
work that was never tagged; all of it ships here, with every rule
implemented by a skill.

Specification: `spec/hsdd-spec-v0_10.md`. Basis:
`review/2026-10-10-v0.9.0-review-fable-5.1.md` and
`review/2026-10-10-successor-direction-fable-5.1.md`. Acceptance:
`review/hsdd-v0_10-acceptance.md`.

### Upgrading from 0.7.1

- Reinstall the eleven skills.
- The first checkpoint after upgrading runs the upgrade behaviors: it
  enumerates the fixtureless `stable` contracts and emits the plan step
  that has `hsdd-reconcile` mark them `validation: grandfathered`.
- Add `**Ordering policy:** fp-progression` to `hsdd/conventions.md` to
  keep 0.7.1's ordering, or remove the old `FP ordering:` bullet to take
  `interfaces-first`. Until you do, the old bullet reads as
  `fp-progression`.
- The first phase switch replaces a verification template that has no
  `## Learnings`.
- `hsdd-adopt` and `hsdd-intake` do nothing until invoked.

### Added

- **The 0.8.0 rules the skills never received.** `hsdd-config`'s
  verification template gains `## Learnings` (one disposition per entry
  before sign-off) and `## Metrics`; `hsdd-contract` gains `compatibility`,
  `external_consumers`, the `retired` status, the executable-validation
  rule with canonical paths (it writes the schema and fixtures when it
  authors a contract or a new version; phases only replay them) and the
  `validation: grandfathered` key; `hsdd-spec` gains the `Team` and
  `Status` fields, integration nodes, graft mode and node retirement, and
  its conventions template the `**Ordering policy:**` and `**Teams:**`
  lines; `hsdd-phase-plan` gains the named ordering policy
  (`interfaces-first` default, `fp-progression`), the Phase Equivalent, the
  producer gate replay and append mode; `hsdd-reconcile` asserts an
  executable validation artifact at the `draft → stable` flip, marks
  grandfathered contracts and discharges each once `hsdd-contract` has
  written its artifact, and retires contracts; `hsdd-checkpoint` audits
  the grandfathered count, files backfill findings with retro phases,
  excludes retired nodes from the atlas's active view and seals a milestone
  document when its tick turns the last gate green; `hsdd-milestone` treats
  a sealed document as a closed campaign.
- **`hsdd-adopt`**, the brownfield entry point: a bundled, tested seam
  extractor (`hsdd/scripts/seams/`: manifests, routes, schemas, migrations and
  tables, topics, owners, co-change coupling; `render` writes the `## Observed
  surface` block, whose `modules:` line records the rendered prefixes, and
  `diff` re-extracts exactly those to detect drift), as-built node specs
  with required `unknown:` lines, `v0` contracts with
  `## Observed completeness`, a human confirmation of the tree before any
  node spec or contract is written, and never a refactoring proposal.
  Owners resolve by the last matching `CODEOWNERS` rule per file, read from
  the git top level; unreadable directories are skipped and reported.
- **`hsdd-intake`**: routes a change request into the existing tree
  (`local`, `cross-node`, `new-capability`, `structural`), reads every open
  intake first and serializes collisions, promotes an as-built landing
  first, and writes the dated, never-superseded intake record before any
  handoff. A PRD is never a root.
- **Promotion mode** in `hsdd-spec`; **as-built drift**, stale-caveat and
  intake-closure checks in `hsdd-checkpoint`, the drift check gated on the
  tree having an `## Observed surface`.
- **Chapter 15, rule by rule.** One table states, for every rule since
  0.7.1, its effect on an existing project and the skill that implements
  it. Nothing in the specification is specified without a skill.
- **§15.3 Artifact stability.** The artifact formats are frozen for the
  1.0 line; later changes are additive optional fields only.
- Everything 0.9.0 added (below): the generic phase context and its two
  derivatives, the coding method, `hsdd-summary` and chapter 13.

### Changed

- `hsdd-config`'s switch copies the verification template when it is missing,
  for either method, and replaces a pre-0.10 copy that has no `## Learnings`;
  a superpowers-only project previously never got it, and an upgrading project
  kept its old copy.
- The specification describes the phase context once: a session receives
  its phase, the Interface and Guarantees of the contracts it consumes and
  produces, and its ADRs' decisions (six places that still said "consumes
  only" were corrected).
- Ordering policy and teams mode are lines in the conventions body, not
  frontmatter.
- README leads with the review sitting as the rationale; bounded context is
  a consequence.
- Skills no longer mention pre-0.5 layouts; the specification supports
  0.6.1 and later.

### Removed

- The claim that 0.8.0's consolidation "ships for the first time" in 0.9.0.

## [0.9.0] - 2026-10-10 (never released; ships in 0.10.0)

Design:
`docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md`.

### Added

- **The generic phase context.** Before each phase, `hsdd-config` writes
  `hsdd-context/{phase-id}.md` in the implementation repo: the phase, the
  Interface and Guarantees of every contract it consumes and produces, the
  Decision and Consequences of its ADRs, its open questions, and pinned
  links. Every line is copied from a governance file or is fixed text.
- **Coding methods.** The phase context is wrapped, word for word, for
  OpenSpec (`openspec/config.yaml`) or for superpowers
  (`hsdd-context/superpowers/{phase-id}.md`, a spec for `writing-plans`
  whose Global Constraints carry test-first, the task cap, the gate and the
  verification doc). `**Coding method:**` in conventions sets the default;
  `/hsdd-phase {id} --method` overrides it.
- **`hsdd-summary`**, a new skill with zero-dependency scripts: the plan
  page and the checkpoint page, offline HTML reading aids with three
  audiences each, stamped against their inputs.
- **Chapter 13, Reading Aids**, in `spec/hsdd-spec-v0_9.md`.

### Changed

- `hsdd-config`: no longer OpenSpec-only. OpenSpec's phase block is now a
  superset of what earlier releases injected; `rules:` are unchanged.
- `hsdd-checkpoint`: `hsdd-context/` counts as in-progress evidence; when
  `hsdd/summary/` exists, its step 7 renders the checkpoint page.
- The invariant "one phase = one OpenSpec change" reads "one phase = one
  coding cycle"; the atlas non-goal is narrowed, not reversed.

### Removed

- The README and users guide no longer describe the brownfield entry point or
  change intake: their skills have not shipped. The specification still
  defines both (chapters 6 and 11); the skills and their walkthroughs arrive in
  v0.10.0.

## [0.8.0] - 2026-08-03 (never released; ships in 0.10.0)

A **consolidation, not a delta.** `spec/hsdd-spec-v0_8.md` is a single
standalone specification absorbing v0.3 through v0.7.1 and the tool-free half
of the shelved vNext exploration. The delta series remains in `spec/` as
history; nothing requires reading it. The delta format is retired for major
revisions.

Two new chapters carry the release's substance, both from one observation:
**the tree does not complete — phases complete, so after the first change
every project is brownfield.** Greenfield is a three-month bootstrap; the
rest of a system's life is the steady state.

Design: `docs/superpowers/specs/2026-07-29-v0_8-consolidation-brownfield-design.md`.
Acceptance record: `review/hsdd-v0_8-acceptance.md` (13/13 criteria PASS).

### Added

- **Chapter 6 — Entry B: Brownfield Adoption.** A codebase that already
  exists becomes a structural peer of the greenfield entry, not a special
  case. `hsdd-adopt` (forthcoming skill) extracts seams by bundled script,
  proposes a shallow tree on the seams that exist, and writes as-built node
  specs carrying an `## Observed surface` section stamped with the extraction
  SHA — with `unknown:` lines required, because a node with no unknowns is a
  node nobody looked at. It stops there: no decomposition below what the
  first change needs, and never a proposal to refactor the system into a
  nicer tree. Adoption cost scales with **seam count, not LOC**.
- **Chapter 11 — Steady State: Change Intake.** `hsdd-intake` (forthcoming
  skill) routes an incoming change request into the existing tree —
  `local` / `cross-node` / `new-capability` / `structural` — and writes the
  routing decision before the handoff. The load-bearing rule: **a PRD is
  never a root; there is one tree and it is the system's.** Intake records
  accumulate, dated and never superseded — the rule that replaces "wipe
  `hsdd/` and rebuild." Includes phase-plan append mode, spec graft mode,
  node retirement, collision serialization across open intakes, and a
  **legal bypass** for production incidents (hotfix → backfill finding →
  retro phase, escalating if unclosed across two checkpoints).
- **Chapter 14 (chapter 15 in the current specification) — Upgrading and Compatibility.** v0.8.0 is additive; the
  vehicle is checkpoint's existing adoption run. The one rule with teeth —
  `stable` contracts need executable validation — is **grandfathered and
  discharged on touch**: the set closes at upgrade, each contract gains
  fixtures only when a phase next touches it, and the remaining count is
  reported every checkpoint and can only fall.
- Adopted contracts start at **`v0`** with a required `## Observed
  completeness` caveat. `v0` is a permanent property, not a waypoint;
  `v0 → v1` is the contract-level adoption exit, taken only on redesign.
- Per-contract-version **`compatibility:` policy** — `additive-only` (the
  Protobuf discipline, claimable only if existing fixtures still pass),
  `versioned` (default), `frozen` — plus the `retired` status,
  `external_consumers`, and a live-consumer retirement finding.
- **Per-campaign milestone documents**, sealed when every gate is green and
  moved to `management/archive/`; sealing is evidence-backed, never declared.
- From vNext: executable validation for `stable`, both gates running the
  contract, integration nodes, the `## Learnings` loop dispositioned at the
  gate, mid-phase contract renegotiation, the unified **Phase Equivalent**,
  phase ordering as a named policy (`interfaces-first` default), the `Team`
  field, and the `## Metrics` block.

### Changed

- **Honest claims** (chapter 15, now chapter 16, mirrored in the README): context isolation
  is *probabilistic, not enforced* — the defense is prose and structure,
  pressure-tested and holding, not a mechanism. HSDD bounds per-session token
  cost; it *does not reduce the total*.
- The settled-decisions table gains a required **provenance column**
  (`field-tested` / `pressure-tested` / `reasoned-only`) so new material
  cannot inherit credibility from tested material. Most of what this release
  adds is `reasoned-only`, and the document says so.
- README and users guide: the reading path collapses to one specification,
  the skill table grows to ten, and the guide gains a brownfield walkthrough
  (adopt → intake → promote).

### Not included

- **No `hsdd` CLI.** No `context`, `lint`, `status`, `rename`, `check-scope`,
  or `template`. Mechanical invariants stay prose- and structure-enforced, on
  the 0.6.0 pressure-campaign evidence. Scripts are permitted only under one
  boundary: **bundled with a new skill, never changing how an existing skill
  behaves.** The mechanization line stays on the shelf as a later candidate.
- No `hsdd-review` skill, no multi-team enforcement, no back-application of
  v0.8.0 rules to existing artifacts, and no support for projects below
  0.6.1 (upgrade to 0.6.1 first).
- **Skill files are unchanged in this release.** `hsdd-adopt` and
  `hsdd-intake` and the amendments to the existing eight follow in a separate
  cycle, after this specification is approved.

## [0.7.1] - 2026-08-01

Driven by the first real-world `hsdd-checkpoint` run (the moka-microsite
adoption checkpoint of 2026-07-31) read against the hand-prompted 07-24 plan it
superseded, plus operator feedback of 2026-08-01. The emission conformed to
v0.7 §2.4's letter and was still harder for its human audience to execute:
every regression fell on the plan surface only humans consume, which §2.4
never made required. Delta spec: `spec/hsdd-spec-v0_7_1.md`.

### Changed

- `hsdd-checkpoint` execution-plan shape — three structural anchors for the
  human-facing surface, no new invariants:
  - "Copy-paste prompts with validation" generalizes to **Step details**:
    every step gets exactly one detail block. 🤖/🤝 steps keep the exact
    prompt + *Validate:* line; 👤 steps gain a **briefing** (*Why / Do /
    Done when*) — one checkbox per action, each naming its concrete target.
    Table cells shrink to a one-sentence summary: the cell indexes, the
    block instructs.
  - New required **Plan graph** section: one Mermaid flowchart (load-bearing
    syncs as junctions, step batches in lane subgraphs, edges from the
    Depends column), derived from the tables and regenerated whole — when
    graph and tables disagree, the tables win. ~20-node ceiling; no
    per-phase charting; applies in scoped mode too.
  - New required **Sync sections**: every load-bearing sync (one any step,
    decision, or lane start depends on) gets Entry / Agenda / Exit /
    Unblocks, with its decisions defined once in the Agenda (question,
    options, landing artifact) and only cited elsewhere. A step may depend
    only on a sectioned sync. The standing weekly stays a table row.
  - Five new quality gates and three new anti-rationalization rows anchor
    the above.
- Users guide: the weekly-checkpoint walkthrough describes the new plan
  surface and states the briefing rule's reason — the human is the one
  executor who cannot be re-prompted.

### Acceptance

- Re-tested per the delta's §7 against the microsite fixture, 2026-08-01: a
  clean-room re-emission of the 2026-07-31 execution plan from the same
  evidence (the updated skill text, the progress report, and the superseded
  plan — the prior emission withheld) produced all three previously missing
  behaviors: *Why / Do / Done when* briefings on every 👤 step, a 19-node
  plan graph consistent with the step tables, and sectioned syncs with
  their decisions defined once and cited by ID — with all 27 findings
  still landing as steps or explicit waivers. A loophole hunt over the
  three new anti-rationalization rows found no dodge the quality gates do
  not close.

## [0.7.0] - 2026-07-26

Driven by the moka-microsite field deployment (2026-07-10 → 07-24: three repos,
two developers, 89 phases under v0.6.1). Delta spec: `spec/hsdd-spec-v0_7.md`.

### Added

- The management layer: `management/` as a fourth artifact class (cite, never
  define) — dated progress reports, execution plans, and milestone documents
  chained by exact-filename supersedes links, plus a living, regenerated
  `atlas.md` (spec tree with phase status, contract graph, ADR coverage map).
- `hsdd-checkpoint` (+ `/hsdd-checkpoint`): one evidence pass across the spec
  repo and every implementation repo emitting all four views, in full or scoped
  mode; the findings→plan loop (every finding becomes a plan step or an explicit
  waiver); the first run on an existing project is an adoption run. Sibling repo
  paths come from the invoking prompt; the skill asks when they are absent.
- `hsdd-milestone` (+ `/hsdd-milestone`): the stakeholder milestone document — a
  demo and a gate per milestone, with a computed contingent tail excluded from
  the launch gate — generated once every leaf-parent is phase-planned, and
  re-baselined on the slip or scope trigger with both windows stated.
- Open-question convention: stable IDs (`OQ{n}` / `OQ-{prefix}{n}`), one
  definition home, the `| ID | Question | Status | Waits on | Affects |` table
  with `OPEN` / `PARTIAL` / `RESOLVED (date)`, anchored structurally in
  `hsdd-spec` (templates + minting), `hsdd-phase-plan` (a contingency must name
  its question — a stop), `hsdd-contract` / `hsdd-adr` (cite-only), and
  `hsdd-reconcile` (resolution citation sweep).
- Standalone-spec-repo profile for multi-repo projects: the HSDD tree is its own
  repo, mounted as a submodule **at `hsdd/`** — so every path is unchanged and no
  skill needs profile-specific resolution. Adds the run-location rule (skills run
  from an implementation repo, never from a standalone clone of the spec repo)
  and four incident-backed rules: pointers reference spec-repo main only, a phase
  is done when its verification doc is on spec-repo main, cross-repo branch pairs
  land or are discarded atomically, and multi-phase epics are never
  squash-merged.
- Users guide: a "Running the project" chapter covering the developer/lead role
  split, the weekly rhythm, milestones, open questions, the multi-repo profile,
  and adoption on a project already underway.

### Changed

- `hsdd-config` checks the submodule pointer as the **first** step of the phase
  context switch under the profile — it gates every later step, all of which read
  through `hsdd/`.
- The vNext mechanization draft renumbers from 0.7.0 candidate to 0.8 candidate.
  v0.7 is additive over v0.6.1 by contract (spec §7.1), with microsite-hsdd as
  the acceptance fixture (§7.3).

### Acceptance

- **Gate discharged (spec §7.3), 2026-07-26.** Both skills ran against the
  microsite reference project — a live v0.6.1 project mid-implementation — from
  an implementation repo in a cold-context session, and produced conforming
  documents without manual repair. The adoption run caught 7/7 seeded findings
  plus a High finding the expectations missed (a signed verification doc whose
  implementation exists nowhere in the repo), and all 26 register entries trace
  to a plan step or an explicit waiver. `hsdd-milestone` adopted the existing
  baseline and declined to generate. Four skill defects surfaced and were
  fixed: `hsdd-checkpoint` ended by asking the operator to adjudicate findings
  instead of pointing at the plan steps that already recorded them; and
  `hsdd-milestone` lacked a slip-trigger bootstrap rule, a home for
  internally-blocked work, and a route for its own findings into the
  findings→plan loop. Full record: `review/hsdd-v0_7-acceptance-microsite.md`.

## [0.6.1] - 2026-07-13

Driven by the v0.6.0 pressure-test campaign
(`review/hsdd-skills-v0_6_0-pressure-test-fable-xhigh.md`) and a field
observation on source-document provenance. Delta spec:
`spec/hsdd-spec-v0_6_1.md`.

### Added

- Source provenance: the root spec carries a `## Sources` section and every
  node a `Sources` field that trickles down at each decomposition level;
  quality gates ensure no source is silently dropped and none is listed on
  a node it does not govern. `hsdd-phase-plan` reads the node's sources and
  lands binding details in phase lines or contract entries; phase contexts
  are unchanged (sources are never injected).
- Sizing-floor checklist item in `hsdd-phase-plan` (the ceiling always had
  one), a one-line kept-split reason whenever a merge candidate stays
  separate, and an anti-enumeration-anchoring row.

### Changed

- The "who builds what?" clarifying question is a mandatory stop when the
  input does not state team structure and the system plausibly spans
  stacks; proceeding on an assumed axis is no longer allowed.
- `hsdd-spec` step 7 writes one spec file per node: every child gets its
  own `hsdd/spec/{child-id}.md` at decomposition time.
- Format clarifications in `hsdd-phase-plan`: the summary table opens the
  `## Phase Plan` section; phase ids in tables and `Collides with` match
  the section headers; `Collides with` may carry a one-line reason.

## [0.6.0] - 2026-07-13

Driven by the second field test (GMP-911) and its review
(`review/hsdd-process-v0_5_1-review-fable-xhigh.md`). Delta spec:
`spec/hsdd-spec-v0_6.md`.

### Added

- Phase summary table: every phase plan opens with a per-phase overview
  (phase, name, tier, size, dependencies, collisions) for the human
  reviewer; `hsdd-config` still injects only the detailed section.
- Sizing floor in `hsdd-phase-plan`: adjacent phases with the same tier,
  the same contracts, and a clean dependency shape merge instead of each
  paying a full OpenSpec cycle; artifacts-exceed-diff is the default merge
  smell. The anti-merge anti-rationalization row is replaced by two
  motive-aware rows.
- Tier-scaled artifact profile: gate-only phases skip `design.md` and get a
  slim verification doc; spot-check skips design unless a real decision
  exists; full-review keeps the full set. Tasks and spec deltas never
  scale, and every phase still produces a verification doc.
- Execution protocol (conventions template, `hsdd-config`, users guide):
  `openspec/config.yaml`'s phase block is ephemeral (take either side on
  merge, re-run `/hsdd-phase`); one integration branch per node; plans and
  reconcile live on exactly one lineage; `Collides with:` marks textual
  contention and serializes execution; capabilities are named after stable
  feature areas, not phases.
- Ownership-first decomposition axis in `hsdd-spec`: split stack-first when
  different teams own different parts of the stack; capability slices apply
  within one owner's territory. "Who builds what?" is the canonical
  clarifying question.
- Bundled verification-doc template (`hsdd-config`, copied to
  `hsdd/templates/verification.md` at setup) with Outstanding and Sign-off
  sections; the review gate is not passed while an Outstanding item lacks a
  disposition.

### Changed

- Node and phase templates emit field blocks as bullet lists (bare
  `**Field:** value` lines collapse into one paragraph in every compliant
  renderer); empty contract lists render "none"; standalone node specs no
  longer duplicate their title as an inner heading.
- `hsdd-phase-plan`'s dependency graph is a Mermaid flowchart (pastel style
  if installed; cross-node dependencies dashed); the ASCII example is
  retired. A phase plan may declare a node-level default gate.
- `hsdd-config`'s compound tasks rule is split into three rules; the phase
  context switch warns when the requested phase is not next-runnable.
- Users guide: examples reformatted to the new templates, review-tier
  section updated, execution-stage walkthrough added (Step 8).

## [0.5.1] - 2026-07-06

- `hsdd-phase-plan` no longer implies it should create verification documents.
  The phase template's Verification field said the description "becomes the
  verification doc at hsdd/verify/{phase-id}.verification.md", which agents
  read as an instruction to write that file during planning. The field is now
  explicitly a 1-3 line statement of intent, with a rule that the plan's only
  output is the node's plan file: the verification doc is written at apply by
  the documentation task `hsdd-config` injects, once implementation details
  exist, for the human to verify the completed change before archive. Added a
  matching anti-rationalization entry.

## [0.5.0] - 2026-07-06

### Changed

- **Breaking:** every HSDD artifact now lives under one root directory,
  `hsdd/`, with singular directory names (`spec/hsdd-spec-v0_5.md`):
  - `docs/conventions.md` -> `hsdd/conventions.md`
  - `docs/spec/` -> `hsdd/spec/`
  - `docs/verify/` -> `hsdd/verify/`
  - `contracts/` -> `hsdd/contract/`
  - `adr/` -> `hsdd/adr/`
  - `scripts/gen-registry.mjs` -> `hsdd/scripts/gen-registry.mjs`

  `openspec/` is unchanged; OpenSpec owns that location. The layout stays a
  default: a project may override any path in its conventions file.
- `gen-registry.mjs` defaults: root is `./hsdd` (was cwd), scanning
  `contract/` and `adr/` under it. `--root <dir>` is unchanged. Standard
  invocation is now `node hsdd/scripts/gen-registry.mjs`.
- Skills that load conventions read `hsdd/conventions.md` first and fall back
  to `docs/conventions.md` for pre-0.5 projects, honoring the layout that
  file states and offering to migrate.
- README, users guide, and all six skills updated to the new paths, including
  trigger phrases (`hsdd/contract/INDEX.md`, `@hsdd/spec/foo.md`).

### Migration (existing projects)

```bash
mkdir -p hsdd/scripts
git mv docs/conventions.md hsdd/conventions.md
git mv docs/spec hsdd/spec
git mv docs/verify hsdd/verify        # if present
git mv contracts hsdd/contract
git mv adr hsdd/adr                   # if present
git mv scripts/gen-registry.mjs hsdd/scripts/gen-registry.mjs
```

Then update the layout section of `hsdd/conventions.md` (or re-seed it from
the template) and re-copy the bundled generator, since the old copy scans the
old paths. Keeping the old layout is also fine: state it in the conventions
file and the skills honor it.

## [0.4.2] - 2026-07-05

### Added

- `hsdd-reconcile` skill: drain the `## Governance updates (pending reconcile)`
  sections emitted by `hsdd-phase-plan`, resolve contract-gap requests with the
  human, finalize contract phase ids, and regenerate the registries. Runs at
  the repo root after (parallel) phase-plan branches merge.
- `/hsdd-reconcile` slash command.
- Governance freeze protocol (`spec/hsdd-spec-v0_4_2.md`): `contracts/`,
  `adr/`, `docs/conventions.md`, and the INDEX registries are read-only during
  phase planning; intended changes ride the node's own plan file as
  `confirm`/`note`/`amend`/`request` entries. Parallel phase planning in
  git worktrees becomes conflict-free by construction.
- Contract frontmatter field `phase_ids: provisional | final`, flipped only by
  `hsdd-reconcile`. No generator change: unknown fields are ignored by the
  projection. `status` flips `draft` to `stable` at the end of the same
  reconcile pass, once `phase_ids` is `final` and no unresolved `request`
  names the contract (interface-frozen semantics).

### Changed

- `hsdd-phase-plan` no longer updates `docs/conventions.md` (old process step
  6); it emits a pending-governance section, asks the human when a contract
  gap changes the plan's shape, and never reads sibling worktrees.
- `hsdd-contract`: contracts are written at the root only; prose "update the
  phase ids later" notes are replaced by the `phase_ids` field; a new quality
  gate requires naming the canonical path and owning phase of any code-level
  artifact both sides consume.
- `hsdd-config`: the tasks rule no longer instructs the apply step to update
  `docs/conventions.md`; the phase context switch warns when a consumed
  contract is still provisional and stops when the phase is contingent on an
  unresolved request.
- Conventions template: the hand-maintained `## Established contracts` list is
  replaced by a pointer to the generated `contracts/INDEX.md`, plus a new
  `## Parallel development protocol` section.
- Users guide: reconcile in the loop and the workflow diagram; a serial
  reconcile note in Example 1 and a parallel-worktrees walkthrough in
  Example 2.

## [0.4.1] - 2026-07-02

### Fixed

- `hsdd-contract` and `hsdd-adr` now require copying the bundled
  `scripts/gen-registry.mjs` verbatim and explicitly forbid reimplementing it from
  the skill description. A retyped generator silently mis-projects the registry (for
  example emitting the ADR `affects` column for contracts, which use
  `owner`/`consumers`), and a regenerate-and-diff check does not catch it.
- `hsdd-adr` closes a bootstrap gap: the registry generator ships only with
  `hsdd-contract`, but ADRs are frequently materialized before the first contract.
  The skill now says so and points to the `hsdd-contract` skill's bundled copy
  instead of implying the generator is already present.

## [0.4.0] - 2026-07-02

### Added

- `hsdd-adr` skill: author and maintain cross-cutting Architecture Decision
  Records as first-class files (`adr/{nnn}-{title}.md`) with registry-compatible
  frontmatter, a status lifecycle (proposed/accepted/superseded/deprecated), and
  bidirectional `Affects`/`Governed by` links.
- `/hsdd-adr` slash command.
- `spec/hsdd-spec-v0_4.md`: delta spec over v0.3.
- Documented where to run `openspec init` (once, at the repo root; one OpenSpec
  project per HSDD tree) in the spec, README, user's guide, and conventions template.

### Fixed

- Broken ADR handoff: `hsdd-spec` now hands accepted ADRs to `hsdd-adr` to
  materialize as files instead of leaving them as inline prose; `hsdd-config`
  stops and authors a referenced-but-missing ADR rather than fabricating or
  dropping it.
- Reconciled the ADR artifact with `gen-registry.mjs`: ADRs now carry YAML
  frontmatter (the generator reads `id`/`status`/`affects`), superseding the
  body-field example in v0.3 §12.4. No generator change required.

## [0.3.0] - 2026-07-01

### Added

- `hsdd-spec` skill: turn a brain-dump into a high-level spec and decompose nodes into subsystems.
- `hsdd-phase-plan` skill: break a leaf-parent node into ordered, independently implementable phases.
- `hsdd-contract` skill: define, version, and update first-class contracts between nodes.
- `hsdd-config` skill: set up/update OpenSpec `config.yaml` and switch phase context.
- Slash commands under `commands/`.
- Docs (`docs/`), specs (`spec/`), and review assets (`review/`).

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/OWNER/REPO/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/OWNER/REPO/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/OWNER/REPO/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/OWNER/REPO/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/OWNER/REPO/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/OWNER/REPO/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/OWNER/REPO/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OWNER/REPO/releases/tag/v0.3.0
