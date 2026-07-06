# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.4.2...HEAD
[0.4.2]: https://github.com/OWNER/REPO/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/OWNER/REPO/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/OWNER/REPO/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OWNER/REPO/releases/tag/v0.3.0
