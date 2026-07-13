# Project Conventions

> Single source of truth for HSDD naming, layout, and process conventions.
> Seeded by hsdd-spec at the root; updated only at the root (hsdd-spec or
> hsdd-reconcile). Phase planning treats this file as read-only.
> Override any default below and every skill honors it.

## Layout (default)
Every HSDD artifact lives under one root directory, `hsdd/`. Directory names
are singular. OpenSpec files stay where OpenSpec expects them (`openspec/`).

- `hsdd/conventions.md`                       this file
- `hsdd/spec/{node-id}.md`                    node specs and leaf-parent phase plans
- `hsdd/verify/{phase-id}.verification.md`    per-phase verification docs
- `hsdd/contract/{slug}.md` + `hsdd/contract/INDEX.md`  first-class contracts (registry generated)
- `hsdd/adr/{nnn}-{title}.md` + `hsdd/adr/INDEX.md`     cross-cutting decisions (authored by hsdd-adr, registry generated)
- `hsdd/scripts/gen-registry.mjs`             registry generator (copied verbatim from hsdd-contract)
- `openspec/config.yaml` + `openspec/changes/` config and one change per phase

## OpenSpec init
Run `openspec init` once, at the repo root (the directory holding `hsdd/`,
this file's parent). One HSDD tree has one OpenSpec project; phases
are isolated by the per-phase context switch (hsdd-config), not by separate
projects. Polyrepo: init per repo root and share `hsdd/contract/` + `hsdd/adr/`.

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
`hsdd/contract/INDEX.md` (generated) is the single index of established contracts.
Do not list contracts here; run `node hsdd/scripts/gen-registry.mjs` after any
contract change.

## Parallel development protocol (planning and execution)
- Governance files (`hsdd/contract/`, `hsdd/adr/`, this file, both `INDEX.md`)
  are read-only during phase planning, at the root and in every worktree.
- `hsdd-phase-plan` emits intended changes as a
  `## Governance updates (pending reconcile)` section in its own node's plan
  file (`confirm` / `note` / `amend` / `request` entries).
- After phase-plan branches merge, run `hsdd-reconcile` at the root: it drains
  pending sections, resolves `request` entries with the human, finalizes
  contract `phase_ids`, and regenerates the registries.
- Planners never read sibling worktrees or other nodes' phase plans (sibling
  node specs from hsdd-spec are shared and fine to read); contracts are the
  only inter-node knowledge.

### Execution protocol (per-phase OpenSpec cycles)
- **`openspec/config.yaml` is ephemeral working state.** The `## Current Phase`
  block (and its companion contract/ADR blocks) is per-session working state,
  rewritten by every phase context switch. A merge conflict on it carries no
  information: resolve by taking either side, then re-run the phase context
  switch (`/hsdd-phase {next-phase}`) before the next OpenSpec cycle.
  Optionally set `openspec/config.yaml merge=ours` in `.gitattributes` on
  integration branches.
- **Branch discipline.** One integration branch per node; phase branches merge
  into it; node integration branches merge into the root branch. A node's plan
  file (`hsdd/spec/{node-id}.md`) is written on exactly one lineage — never
  re-plan or copy a plan onto a diverged sibling lineage. `hsdd-reconcile`
  runs once, at the root lineage, after the node plans are merged there; its
  commit exists only on the root.
- **Textual contention serializes.** Phases whose plan sections carry
  `Collides with` entries naming each other execute serially on the node's
  integration branch. Spawn parallel worktrees only for phases with no
  collision between them.
- **Capability naming.** Name OpenSpec capabilities after a stable feature
  area within the node, not after the phase. Same-capability archives then
  serialize — colliding phases serialize anyway. Fall back to per-phase
  capability names only when genuinely parallel phases would contend on the
  same capability spec.
