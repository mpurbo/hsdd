# Project Conventions

> Single source of truth for HSDD naming, layout, and process conventions.
> Seeded by hsdd-spec at the root; updated only at the root (hsdd-spec or
> hsdd-reconcile). Phase planning treats this file as read-only.
> Override any default below and every skill honors it.

## Layout (default)
- `docs/spec/{node-id}.md`                    node specs and leaf-parent phase plans
- `docs/verify/{phase-id}.verification.md`    per-phase verification docs
- `contracts/{slug}.md` + `contracts/INDEX.md`  first-class contracts (registry generated)
- `adr/{nnn}-{title}.md` + `adr/INDEX.md`      cross-cutting decisions (authored by hsdd-adr, registry generated)
- `openspec/config.yaml` + `openspec/changes/` config and one change per phase

## OpenSpec init
Run `openspec init` once, at the repo root (the directory holding this file's
`docs/`, `contracts/`, and `adr/`). One HSDD tree has one OpenSpec project; phases
are isolated by the per-phase context switch (hsdd-config), not by separate
projects. Polyrepo: init per repo root and share `contracts/` + `adr/`.

## Naming
- Node id: dotted slug path from root (`acme.backend.auth`)
- Phase id: `{leaf-parent}.{n}` (`acme.backend.auth.3`)
- Contract: `{slug}@v{n}` (`auth-token@v1`)
- ADR: `ADR-{nnn}`; node-local decision: `D{n}`
- User story / acceptance: `US-{n}` / `AC-{n}.{y}`

## Companion skills (recommended)
Obra's superpowers (github.com/obra/superpowers), wired into OpenSpec by hsdd-config:
- `brainstorming` during decomposition and phase planning
- `test-driven-development`, `verification-before-completion` during apply
- `systematic-debugging` on failure
- `requesting-code-review` / `receiving-code-review` at the review gate

Stack skills (optional): `mermaid-pastel-style`, `fp-rust`, `fp-kstream-*`.

## Phase design
- FP ordering: types -> pure functions -> effects -> composition
- <= 8 OpenSpec tasks per phase; each phase fits one ~5h review window
- Review tiers: gate-only | spot-check | full-review

## Contracts
`contracts/INDEX.md` (generated) is the single index of established contracts.
Do not list contracts here; run `node scripts/gen-registry.mjs` after any
contract change.

## Parallel development protocol
- Governance files (`contracts/`, `adr/`, this file, both `INDEX.md`) are
  read-only during phase planning, at the root and in every worktree.
- `hsdd-phase-plan` emits intended changes as a
  `## Governance updates (pending reconcile)` section in its own node's plan
  file (`confirm` / `note` / `request` entries).
- After phase-plan branches merge, run `hsdd-reconcile` at the root: it drains
  pending sections, resolves `request` entries with the human, finalizes
  contract `phase_ids`, and regenerates the registries.
- Planners never read sibling worktrees or other nodes' phase plans; contracts
  are the only inter-node knowledge.
