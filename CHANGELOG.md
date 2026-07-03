# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-07-03

### Added

- `hsdd` CLI (`cli/`, published to npm as `hsdd`): zero-dependency Node >= 20
  package owning every deterministic operation. Commands: `registry` (absorbs
  `gen-registry.mjs`; derives contract owner/consumers from the tree), `context`
  (pull-based phase-context assembly, spliced into `openspec/config.yaml`
  between literal markers), `lint` (13 referential-integrity checks plus the
  multi-team profile), `status` (derived phase lifecycle, `--write` emits
  `docs/STATUS.md` with metrics aggregation), `rename` (tree surgery with
  `docs/renames.md` ledger; never rewrites the openspec archive), and
  `check-scope` (changed files vs the phase's `Touches` globs).
- `hsdd-review` skill and `/hsdd-review` command: per-tier gate checklists,
  learning dispositions (spec-updated, contract-bumped, adr-proposed, dropped),
  and sign-off via PR or signed line.
- `hsdd-adopt` skill: brownfield adoption with as-built node specs, contracts
  extracted from real seams (v1 = current behavior), and lazy decomposition.
- `/hsdd-new` command: the paved road; derives the phase context via the CLI,
  then starts the OpenSpec change with the authoritative `Phase:` line.
- Machine-readable artifact model: YAML frontmatter on node specs and
  conventions; the phase block is now normative grammar; contract frontmatter
  gains `schema`/`fixtures` (required for `stable`).
- Multi-team profile (opt-in): `team` ownership, `Acked-by` contract bumps, ADR
  `## Approvals`, all lint-enforced.
- `spec/hsdd-spec-v0_5.md` (delta over v0.3 + v0.4; the last delta before v1.0)
  and `docs/maintainers-guide.md` (tests, npm publishing, release chores).

### Changed

- Contract frontmatter drops `produced_by` and `consumers`; the registry derives
  both (a field lives in exactly one place). `hsdd lint` flags the old shape.
- The phase context switch is pull-based: `/hsdd-phase` now delegates to
  `npx hsdd context --write`; `hsdd-config` shrinks to project init plus the
  engine adapter (markers, `Phase:` proposal rule).
- FP progression became a named ordering policy (`ordering_policy` in
  conventions frontmatter; default `interfaces-first`).
- The PE is redefined as one human review sitting (~<= 400 changed lines, <= 8
  tasks); the ~5h window wording is calibration, not definition.
- Review tiers follow a leverage rule: outputs consumed by 2+ later phases mean
  `spot-check` minimum; `gate-only` is reserved for consumer-less scaffolding
  (the linkcheck and acme examples' phase 1 became `spot-check`).
- README/guide claims rewritten honestly: context injection shapes attention
  (enforcement is opt-in via `Touches` + `check-scope`); per-session context is
  bounded but total tokens scale with phase count.
- Parallel phases require one git worktree per active phase (branch
  `hsdd/{phase-id}`).

### Removed

- The bundled `skills/hsdd-contract/scripts/gen-registry.mjs` and the 0.4.1
  verbatim-copy rule; the CLI makes the retyped-generator failure mode
  structurally impossible and closes the `hsdd-adr` bootstrap gap.

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

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/OWNER/REPO/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/OWNER/REPO/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/OWNER/REPO/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OWNER/REPO/releases/tag/v0.3.0
