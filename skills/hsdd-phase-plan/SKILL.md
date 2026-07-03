---
name: hsdd-phase-plan
description: >
  Use when breaking a node that is ALREADY a leaf-parent (no subsystems left)
  into ordered, independently implementable phases before the OpenSpec cycle.
  Triggers: "write the phase plan for X", "break X into phases", "implementation
  phases", "phase breakdown", "this node is small enough to phase", "phase
  dependency graph", "review tiers", "gate command", "size estimate per phase".
  Each phase becomes one OpenSpec change and fits one review sitting. If the node
  still contains subsystems, decompose it with hsdd-spec FIRST. Do NOT use for
  OpenSpec artifacts (use openspec directly).
---

# HSDD Phase Plan: Leaf-Parent to Ordered Phases

Take one leaf-parent node and produce an implementation-ready set of phases. Each
phase is the atomic unit of HSDD: it drives exactly one OpenSpec cycle and is
sized to one Phase Equivalent (PE).

**One PE is the largest unit of change one reviewer can genuinely review and
manually verify in a single sitting**, plus the agent run that produces it.
Working guidelines: a reviewable diff of roughly <= 400 changed lines of
non-generated code, <= 8 OpenSpec tasks, about half a working day end to end.
(Calibration note, non-normative: as of mid-2026 one PE happens to fit one
Claude Code rolling window. The review sitting is the invariant, not the
window.)

**Core principle:** Define contracts and phases before any code. Each phase is
independently testable and contract-bounded; ordering follows the project's
named ordering policy.

## When to Use

- A node spec (`hsdd-spec`) marked a node `leaf-parent`.
- You are ready to deep-dive one node before starting OpenSpec.

**Do NOT use for** decomposing into sub-nodes (`hsdd-spec`) or OpenSpec artifacts
(proposal/design/tasks belong to the OpenSpec cycle).

**Precondition:** the node must already be a leaf-parent. If a request like
"break X into pieces" is ambiguous and X still contains subsystems, hand back to
`hsdd-spec` to decompose first, then return here for the leaf-parent.

## Process

1. **Load conventions.** Read `docs/conventions.md`: naming, layout, established
   contracts, and the frontmatter fields `ordering_policy` and `profile`.
2. **Reference the node spec.** Load `docs/spec/{node-id}.md`: purpose,
   consumed/produced contract ids, governing ADRs, isolation strategy. Reference
   ADRs by id; they are files authored by `hsdd-adr`, never inline here.
3. **Define phases** using the normative template below, applying the ordering
   policy and the PE sizing rule. Reference contracts by id (`hsdd-contract`
   owns the bodies).
4. **Wire contract verification into gates.** Any phase that `produces` a
   contract gets a gate that runs the contract's executable validation (e.g.
   `npm run contract:verify auth-token`): real output must validate against the
   schema and reproduce the fixtures. Consuming phases test against the
   fixtures, not hand-rolled mocks.
5. **Declare `Touches` where scoping matters.** For phases in trees with
   parallel lanes, security-sensitive seams, or multi-team ownership, list the
   file-scope globs and add `npx hsdd check-scope {phase-id}` to the gate. This
   is opt-in per phase; honest defaults over theatrical ones.
6. **Draw the phase dependency graph** showing parallel lanes.
7. **Assign a review tier** per phase using the leverage rule below.
8. **Update `conventions.md`** with any newly established cross-node contracts.
9. **Check the plan:** `npx hsdd lint` (phase blocks must parse against the
   normative grammar; numbering must be sequential).

## Ordering Policy

The ordering discipline is a named policy selected in `docs/conventions.md`
frontmatter (`ordering_policy`), not a hard-baked rule:

| Policy | Ordering |
|--------|----------|
| `interfaces-first` (default) | stable interfaces and shared types first, effects behind interfaces, composition and wiring last |
| `fp-progression` | types -> pure functions -> effects -> composition; the reference policy for FP stacks (Rust, Kafka Streams). This is interfaces-first sharpened. |
| project-defined | e.g. `walking-skeleton`: one thin end-to-end slice first, then widen; documented in the conventions body |

Sizing rules, tiers, and gates are policy-independent.

## Phase Template (normative grammar)

`hsdd context` parses this block and `hsdd lint` rejects blocks that do not
parse. Field order and bold labels are the grammar:

```markdown
### {phase-id}: {Phase Name}

**Consumes:** [contract-id@version, ...]
**Produces:** [contract-id@version, ...]
**Governed by:** [ADR-NNN, ...]            # optional
**Scope:** concrete, verifiable deliverable
**Size estimate:** ~N files, ~N lines, <= 8 OpenSpec tasks
**Gate:** exact command (include contract:verify for produced contracts)
**Verification:** how a human manually confirms it works
**Review tier:** gate-only | spot-check | full-review
**Touches:** [src/auth/**, tests/auth/**]  # optional file-scope globs
**Dependencies:** which prior phases, and what specifically (contracts only)
```

## Review Tiers: Leverage, Not Only Risk

| Tier | For | At the gate |
|------|-----|-------------|
| gate-only | artifacts with NO downstream consumers: build scaffolding, CI config, codegen output, vendored boilerplate | gate passes, auto-proceed, human notified |
| spot-check | well-constrained phases with clear contracts; ANY phase whose produced types/interfaces feed 2+ later phases | read the diff summary and produced contract surface, confirm gate |
| full-review | orchestration, business logic, integrations, security | read diff, run verification, probe edge cases |

**The leverage rule:** a phase whose produced types or interfaces are consumed
by two or more later phases gets `spot-check` at minimum. The type skeleton has
the highest downstream fan-out in the plan, is cheap to read (all signal), and
is expensive to get wrong. `gate-only` is reserved for consumer-less artifacts.

## Phase Dependency Graph

```text
{node}.1 (Interfaces & Contracts)   spot-check (feeds everything below)
 |-- {node}.2 (Component A)
 |-- {node}.3 (Component B)      <- parallel with .2
 |-- {node}.4 (Component C)      <- parallel with .2, .3
 |    |-- {node}.5 (Provider X)  <- depends on .4
 |-- {node}.6 (Orchestration)    <- depends on .2-.4 contracts
      |-- {node}.7 (Wiring)      <- depends on all
```

Parallel phases run in separate git worktrees (branch `hsdd/{phase-id}`), one
per active phase; that is required for concurrency, not suggested, because one
checkout has one `config.yaml`.

## Phase Design Checklist

- [ ] Phase 1 defines the shared types and contract-bounded interfaces.
- [ ] Phases 2..N-1 are maximally independent (parallelizable where possible).
- [ ] Each phase has <= 8 OpenSpec tasks (split if more).
- [ ] Contract ids are defined before the phase that implements them.
- [ ] Each producing phase's gate runs the contract verification.
- [ ] Phase N is testable with fixtures even if a producer is not implemented.
- [ ] No phase couples to another phase's internals.
- [ ] Tiers follow the leverage rule (fan-out >= 2 means spot-check minimum).
- [ ] `Touches` declared where isolation matters; check-scope wired into those gates.
- [ ] The phase dependency graph is included.
- [ ] `npx hsdd lint` accepts every phase block.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll figure out phases during implementation" | Phases defined after coding starts are retrofitted, not designed. Contracts leak. |
| "These two phases are too small, combine them" | Small phases are a feature: focused review and parallel work. |
| "This phase is a bit big but fine" | If it overflows one review sitting, the human becomes the bottleneck. Split it. |
| "Types are boilerplate, gate-only is fine" | The type skeleton feeds every later phase. Highest leverage, cheapest to read. Spot-check minimum. |
| "The gate is 'tests pass'" | A producing phase's gate must also run the contract verification, or mocks pass while live integration fails. |
| "Touches on every phase, to be safe" | Scope enforcement is opt-in where it matters. Ceremony everywhere is theater. |
| "Skip the dependency graph" | Without it, phases are assumed sequential and parallel teams stall. |
