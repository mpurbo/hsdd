---
name: hsdd-phase-plan
description: >
  Use when breaking a node that is ALREADY a leaf-parent (no subsystems left)
  into ordered, independently implementable phases before the OpenSpec cycle.
  Triggers: "write the phase plan for X", "break X into phases", "implementation
  phases", "phase breakdown", "this node is small enough to phase", "phase
  dependency graph", "review tiers", "gate command", "size estimate per phase".
  Each phase becomes one OpenSpec change and fits one review window. If the node
  still contains subsystems, decompose it with hsdd-spec FIRST. Do NOT use for
  OpenSpec artifacts (use openspec directly).
---

# HSDD Phase Plan: Leaf-Parent to Ordered Phases

Take one leaf-parent node and produce an implementation-ready set of phases. Each
phase is the atomic unit of HSDD: it drives exactly one OpenSpec cycle and is
sized so the AI run plus human review and manual verification fit one Claude Code
rolling window (target ~5h).

**Core principle:** Define contracts and phases before any code. Each phase is
independently testable, contract-bounded, and follows FP progression: types ->
pure functions -> effects -> composition.

## When to Use

- A node spec (`hsdd-spec`) marked a node `leaf-parent`.
- You are ready to deep-dive one node before starting OpenSpec.

**Do NOT use for** decomposing into sub-nodes (`hsdd-spec`) or OpenSpec artifacts
(proposal/design/tasks belong to the OpenSpec cycle, configured by `hsdd-config`).

**Precondition:** the node must already be a leaf-parent. If a request like
"break X into pieces" is ambiguous and X still contains subsystems, hand back to
`hsdd-spec` to decompose first, then return here for the leaf-parent.

## Process

1. **Load conventions.** Read `hsdd/conventions.md` (single source of truth for
   naming, layout, and the parallel development protocol; a pre-0.5 project has
   it at `docs/conventions.md`: honor its layout and offer to migrate). Do not
   re-scan every prior spec.
2. **Reference the node spec.** Load `hsdd/spec/{node-id}.md`: purpose,
   consumed/produced contract ids, governing ADRs, isolation strategy. Reference
   ADRs by id (`Governed by: [ADR-NNN]`); they are authored as files by
   `hsdd-adr`, never inline here.
3. **Define phases** using the template below, applying FP ordering and the
   sizing rule. Reference contracts by id (`hsdd-contract` owns the bodies).
4. **Draw the phase dependency graph** showing parallel lanes.
5. **Assign a review tier** per phase.
6. **Emit governance updates.** Append the
   `## Governance updates (pending reconcile)` section (template below) to this
   node's plan file. Never edit `hsdd/contract/`, `hsdd/adr/`,
   `hsdd/conventions.md`, or any `INDEX.md`: they are frozen inputs, applied
   later by `hsdd-reconcile` at the root.

## Governance Freeze (Read-Only Inputs)

Phase planning reads governance files; it never writes them. `hsdd/contract/*`,
`hsdd/adr/*`, `hsdd/conventions.md`, and both `INDEX.md` registries are a frozen
snapshot, whether you run at the repo root or in a worktree, serial or
parallel. Every intended change is emitted as data in the node's own plan file
and applied once, at the root, by `hsdd-reconcile`.

Append this section to `hsdd/spec/{node-id}.md`:

```markdown
## Governance updates (pending reconcile)

> Emitted by hsdd-phase-plan on {YYYY-MM-DD}. Drained by hsdd-reconcile;
> do not apply by hand.

- confirm `{contract-id}@v{n}` {produced_by|consumers}: [{phase-ids}]
- note: {conventions-worthy fact: a new package, a shared artifact created
  by an owned phase}
- amend `{contract-id}@v{n}`: {a guarantee or semantic this plan settled for
  a contract this node owns, that consumers may rely on}
- request `{contract-id}@v{n}`: {the gap, phrased as a question}
  - assumption: {what this plan assumes while the gap is open}
  - contingent phases: {phase ids that must not start until resolved, or none}
```

Any entry may carry short rationale sub-bullets; `hsdd-reconcile` reads them.

**Contract gaps (two-tier rule).** If a gap in a consumed contract changes the
shape of the plan (which phases exist, what they produce), stop and ask the
human now; a wrong structural assumption poisons every downstream phase.
Otherwise proceed conservatively and record a `request` entry with the
assumption stated and the contingent phases listed.

**Producer-side discoveries (`amend`).** Planning often settles semantics of a
contract this node owns (an error mapping, an ordering guarantee) that would
otherwise hide as a node-local decision consumers never see. If a consumer
could reasonably depend on it, emit an `amend` entry so `hsdd-reconcile` folds
it into the contract body; keep it node-local only when it is invisible across
the boundary. If the amendment could break an existing consumer, say so in the
entry; reconcile takes breaking amends to the human.

**Sibling isolation.** Do not read sibling worktree folders or other nodes'
phase plans. Contracts are the only inter-node knowledge; a sibling's
half-written plan on the same disk is not a contract. Sibling node specs as
written by `hsdd-spec` (purpose, contracts, DAG) are shared decomposition
artifacts and fine to read; a sibling's phase-plan sections and its worktree
are not.

## Phase Ordering (FP Progression)

1. **Phase 1 (always):** domain types, core traits/interfaces, scaffolding. No
   business logic, only the type-level skeleton.
2. **Early phases (parallel-safe):** config, state, IO utilities, independent
   modules consuming Phase 1 types.
3. **Middle phases:** pure-core logic, then effects/IO at boundaries; concrete
   implementations of the traits.
4. **Final phase:** integration wiring, entry point, dependency assembly. The
   imperative shell.

## Phase Template

```markdown
### {phase-id}: {Phase Name}

**Consumes:** [contract-id@version, ...]   # prior-phase or cross-node contracts
**Produces:** [contract-id@version, ...]
**Governed by:** [ADR-NNN, ...]            # optional
**Scope:** concrete, verifiable deliverable
**Size estimate:** ~N files, ~N lines, <= 8 OpenSpec tasks
**Gate:** exact command (e.g. `cargo build && cargo test`)
**Verification:** 1-3 lines of intent: what a human should confirm works beyond
  the gate (observable behavior, not commands)
**Review tier:** gate-only | spot-check | full-review
**Dependencies:** which prior phases, and what specifically (contracts only)
```

**Verification is a description, not a document.** The plan's only output is
the phase sections in `hsdd/spec/{node-id}.md`. Never create files under
`hsdd/verify/` during planning: the verification doc
(`hsdd/verify/{phase-id}.verification.md`, with exact commands, expected
output, what to inspect) is written during the OpenSpec cycle at apply, by the
documentation task that `hsdd-config` injects, once the implementation details
exist. The human uses that doc to manually verify the completed change before
archive. The plan's Verification line is the intent that task expands on.

## Review Tiers

| Tier | For | At the gate |
|------|-----|-------------|
| gate-only | scaffolding, types, boilerplate | gate passes, auto-proceed, human notified |
| spot-check | well-constrained phases with clear contracts | glance at diff, confirm gate, proceed |
| full-review | orchestration, business logic, integrations, security | read diff, run verification, consider edge cases |

Phase 1 (types/scaffolding) is gate-only. Pure utilities are spot-check. External
integrations and orchestration are full-review.

## Sizing to the Review Window

Each phase must fit one window: `[AI: new -> design -> tasks -> apply -> verify]`
plus `[human: review specs + read diff + run manual verification]` within ~5h. The
review tier modulates the human half. If a phase cannot fit, it is too big: split
it. Phase sizing is the control knob for context, tokens, time, and quality.

## Phase Dependency Graph

```text
{node}.1 (Types & Contracts)
 |-- {node}.2 (Component A)
 |-- {node}.3 (Component B)      <- parallel with .2
 |-- {node}.4 (Component C)      <- parallel with .2, .3
 |    |-- {node}.5 (Provider X)  <- depends on .4
 |-- {node}.6 (Orchestration)    <- depends on .2-.4 contracts
      |-- {node}.7 (Wiring)      <- depends on all
```

## Phase Design Checklist

- [ ] Phase 1 defines all shared types and contract-bounded interfaces.
- [ ] Phases 2..N-1 are maximally independent (parallelizable where possible).
- [ ] Each phase has <= 8 OpenSpec tasks (split if more).
- [ ] Contract ids are defined before the phase that implements them.
- [ ] Phase N is testable with mocks even if Phase N-1 is not implemented.
- [ ] No phase couples to another phase's internals.
- [ ] Each phase has a concrete gate, a verification description, and a review tier.
- [ ] The phase dependency graph is included.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll figure out phases during implementation" | Phases defined after coding starts are retrofitted, not designed. Contracts leak. |
| "These two phases are too small, combine them" | Small phases are a feature: focused review and parallel work. |
| "This phase is a bit big but fine" | If it overflows the review window, the human becomes the bottleneck. Split it. |
| "The contract is obvious" | Explicit contracts enable mock testing and phase isolation. Reference the id. |
| "Skip the dependency graph" | Without it, phases are assumed sequential and parallel teams stall. |
| "The contract gap is obvious, I'll just fix the contract file" | Governance files are frozen during planning. Emit a `request`; `hsdd-reconcile` applies the answer at the root. |
| "I'll create the shared artifact locally; the merge will be trivial" | Two agents generating from the same prose are never byte-identical. Record a `request`; the contract must name one canonical owner. |
| "I'll peek at the sibling worktree's plan to coordinate" | Contracts are the only inter-node knowledge. Peeking couples plans invisibly and races the sibling's edits. |
| "I'll write the verification doc now while the phase is fresh" | Planning cannot know the implementation. The doc is written at apply by an OpenSpec task; the plan carries only the one-line intent. |
