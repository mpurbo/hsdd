# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/OWNER/REPO/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OWNER/REPO/releases/tag/v0.3.0
