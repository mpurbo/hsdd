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
- `hsdd/templates/verification.md`            verification-doc template, copied from hsdd-config
- `openspec/config.yaml` + `openspec/changes/` config and one change per phase
- `hsdd/management/`                          management layer (progress, execution plans, milestones, atlas) — written only by hsdd-checkpoint / hsdd-milestone

**Standalone-spec-repo profile (opt-in, multi-repo projects):** declare it
here with a line `Profile: standalone-spec-repo`. The spec repo's root then
IS the HSDD tree (`spec/`, `contract/`, `adr/`, `management/`, this file —
no `hsdd/` prefix anywhere, including in path examples and quoted commands),
and each implementation repo mounts the spec repo as a git submodule.
Submodule pointers only ever reference spec-repo main commits; a phase is
done when its verification doc is on spec-repo main; branch pairs spanning
an implementation repo and the spec repo land or are discarded atomically;
multi-phase epics are never squash-merged.

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
- Open question: root `OQ{n}`; node `OQ-{prefix}{n}` (declare prefixes here,
  e.g. `B` = backend, `F` = frontend); child view of a parent question:
  `[inherits OQ{n}]`

## Open questions (OQ)
- IDs are stable — never renumbered, never reused. Resolved entries keep
  their row and detail subsection (audit trail); never delete them.
- One definition home: defined exactly once, in the `## Open questions`
  section of the spec that owns the decision. Every other artifact cites
  the ID only.
- Format (owning spec): summary table
  `| ID | Question | Status | Waits on | Affects |` + one `### {ID}` detail
  subsection per entry.
- Status: `OPEN` · `PARTIAL` (residual under *Waits on*) · `RESOLVED (date)`
  (row points at the landing artifact). `ext:` marks an external party;
  link the execution plan's E-track where one exists.
- Resolving = update row + detail, land the decision in its artifact
  (ADR / contract / `D{n}`), and sweep citations that still treat it as
  open (`hsdd-reconcile` does this).

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
