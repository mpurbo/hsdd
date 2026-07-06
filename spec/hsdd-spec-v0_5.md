# HSDD: Hierarchical Spec-Driven Development (v0.5 delta)

> Delta specification. It consolidates every HSDD artifact under one root
> directory (`hsdd/`) and makes directory naming consistent (singular). Read it
> against v0.4.2; only the changes are stated here. Everything in
> v0.3/v0.4/v0.4.2 not touched below still stands.

**Version:** 0.5.0 (draft)
**Status:** For review
**Date:** 2026-07-06
**Author:** Purbo Mohamad
**Supersedes (in part):** the default layout section of the conventions
template, the layout paths named by every skill, and the registry generator's
default scan roots. All other v0.3/v0.4/v0.4.2 provisions are unchanged.

---

## 1. What 0.5 Changes and Why

Through v0.4.2 the skills scattered their output across four repo-root
locations: `docs/` (specs, verification docs, conventions), `contracts/`,
`adr/`, and `scripts/` (the registry generator). Two problems:

1. **No ownership boundary.** A target project's own documentation shares
   `docs/` with generated HSDD artifacts, and three more HSDD-owned
   directories sit loose at the repo root. Nothing on disk says "this is the
   methodology's output"; cleanup, review scoping, and .gitignore-style
   reasoning all require tribal knowledge.
2. **Inconsistent naming.** `spec` was singular, `contracts` plural, `adr`
   an acronym used as singular. Every skill and every user prompt had to
   remember which was which.

v0.5 moves every HSDD artifact under a single root directory, `hsdd/`, and
standardizes on **singular** directory names. Singular wins because `adr`
decides it: `adrs/` is not a word anyone writes, and the industry convention
for ADR directories is singular. With `adr` fixed, consistency forces `spec`,
`contract`, and `verify`. A directory names the artifact kind, not the
collection.

The only exception is `openspec/`: OpenSpec owns that location and expects
its `config.yaml` and `changes/` exactly there. HSDD does not relocate
another tool's files.

## 2. The Default Layout

| v0.4.2 | v0.5 |
|--------|------|
| `docs/conventions.md` | `hsdd/conventions.md` |
| `docs/spec/{node-id}.md` | `hsdd/spec/{node-id}.md` |
| `docs/verify/{phase-id}.verification.md` | `hsdd/verify/{phase-id}.verification.md` |
| `contracts/{slug}.md` + `contracts/INDEX.md` | `hsdd/contract/{slug}.md` + `hsdd/contract/INDEX.md` |
| `adr/{nnn}-{title}.md` + `adr/INDEX.md` | `hsdd/adr/{nnn}-{title}.md` + `hsdd/adr/INDEX.md` |
| `scripts/gen-registry.mjs` | `hsdd/scripts/gen-registry.mjs` |
| `openspec/config.yaml` + `openspec/changes/` | unchanged |

As before, the layout is a default: `hsdd/conventions.md` remains the single
source of truth, and a project may override any path in it. `openspec init`
still runs once, at the repo root, which is now simply the directory that
holds `hsdd/`.

## 3. Registry Generator Defaults

`gen-registry.mjs` keeps its `--root <dir>` flag but changes its defaults:

- Default root is `./hsdd` under the cwd (was the cwd itself).
- It scans `<root>/contract` and `<root>/adr` (was `contracts` and `adr`).
- The standard invocation becomes `node hsdd/scripts/gen-registry.mjs`.

The script is still bundled only with `hsdd-contract` and still copied
verbatim into the target project; the copy destination is now
`hsdd/scripts/`. Its bundled location inside the skill is unchanged.

## 4. Pre-0.5 Projects

The conventions file is also the compatibility mechanism. Skills that load
conventions read `hsdd/conventions.md` first; if it is absent but
`docs/conventions.md` exists, the project predates 0.5: honor the layout that
file states and offer to migrate. Migration is a rename, not a rewrite:

```bash
mkdir -p hsdd/scripts
git mv docs/conventions.md hsdd/conventions.md
git mv docs/spec hsdd/spec
git mv docs/verify hsdd/verify        # if present
git mv contracts hsdd/contract
git mv adr hsdd/adr                   # if present
git mv scripts/gen-registry.mjs hsdd/scripts/gen-registry.mjs
```

After migrating, update the layout section of `hsdd/conventions.md` (or
re-seed it from the template) and replace the copied generator with the
current bundled version, since the old copy scans the old paths by default.
A project that keeps the old layout stated in its conventions file continues
to work; the freeze protocol, reconcile semantics, and registry projection
are all layout-independent.

## 5. What Does Not Change

- Node, phase, contract, and ADR id schemes (`acme.backend.auth.3`,
  `auth-token@v1`, `ADR-001`).
- The governance freeze protocol and `hsdd-reconcile` semantics (v0.4.2).
- The conventions-override mechanism: the layout above is a default, not a
  requirement.
- `openspec/` location, the per-phase context switch, and the OpenSpec cycle.
