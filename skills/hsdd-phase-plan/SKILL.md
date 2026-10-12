---
name: hsdd-phase-plan
description: >
  Use when breaking a node that is ALREADY a leaf-parent (no subsystems left)
  into ordered, independently implementable phases before the OpenSpec cycle.
  Triggers: "write the phase plan for X", "break X into phases", "implementation
  phases", "phase breakdown", "this node is small enough to phase", "phase
  dependency graph", "review tiers", "gate command", "size estimate per phase".
  Also "append a phase to X", "add a retro phase", "the plan needs another phase"
  (append mode). Each phase becomes one OpenSpec change and fits one review
  window. If the node still contains subsystems, decompose it with hsdd-spec
  FIRST. Do NOT use for OpenSpec artifacts (use openspec directly).
---

# HSDD Phase Plan: Leaf-Parent to Ordered Phases

Take one leaf-parent node and produce an implementation-ready set of phases. Each
phase is the atomic unit of HSDD: it drives exactly one OpenSpec cycle and is
sized so the AI run plus human review and manual verification fit one Claude Code
rolling window (target ~5h).

**Core principle:** Define contracts and phases before any code. Each phase is
independently testable, contract-bounded, and ordered by the project's named
ordering policy (below).

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
   naming, layout, and the parallel development protocol). Do not
   re-scan every prior spec.
2. **Reference the node spec.** Load `hsdd/spec/{node-id}.md`: purpose,
   consumed/produced contract ids, governing ADRs, isolation strategy. Reference
   ADRs by id (`Governed by: [ADR-NNN]`); they are authored as files by
   `hsdd-adr`, never inline here. Read the node's **Sources** — the
   referenced documents or sections, not just the node spec's summary of
   them — before phasing. A binding detail found only in a source must land
   where execution will see it: in a phase's Scope or Verification line, or
   in a contract `request`/`amend` entry so the contract body carries it.
   Phases do not carry a Sources field; the phase plan is written by
   someone who read the sources.
3. **Define phases** using the template below, applying the project's
   ordering policy (Phase Ordering, below) and the sizing rule. Reference
   contracts by id (`hsdd-contract` owns the bodies).
   Open the `## Phase Plan` section with the phase summary table (one row
   per phase), then the detailed phase sections.
4. **Draw the phase dependency graph** as a Mermaid flowchart, showing
   parallel lanes and cross-node dependencies.
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
  - contingent phases: {phase ids that must not start until resolved, or
    none} — each names the owning open question: `{phase-id} (OQ-…)`
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

**Contingency names its question (stop).** A phase whose start waits on an
unresolved question cites the OQ id — in its phase section (Scope or
Dependencies line, e.g. `contingent (OQ-B7)`) and in any `request` entry's
contingent-phases list. If the question has no minted ID, **stop**: the
owning spec mints it (`hsdd-spec` owns the format) before this plan builds
on it. An unnamed contingency is invisible to the checkpoint's health pass
and to the milestone document's contingent tail.

> **Adopting on a v0.6.1 project.** The stop binds contingencies *this run*
> authors. A pre-existing unnamed contingency inherited from an earlier plan is
> reported, not blocked: list it with the question it implies so the owning spec
> can mint an ID, and carry on. Upgrading the skills never blocks work already
> in flight.

**Sibling isolation.** Do not read sibling worktree folders or other nodes'
phase plans. Contracts are the only inter-node knowledge; a sibling's
half-written plan on the same disk is not a contract. Sibling node specs as
written by `hsdd-spec` (purpose, contracts, DAG) are shared decomposition
artifacts and fine to read; a sibling's phase-plan sections and its worktree
are not.

## Phase Ordering (a named policy)

Read the `**Ordering policy:**` line in `hsdd/conventions.md`. Absent means
`interfaces-first`, except that a conventions file whose Phase design
section still carries the pre-v0.10 `FP ordering:` bullet reads as
`fp-progression`; say so in the plan and recommend adding the line.
Sizing, tiers, gates, the summary table and the floor do not depend on the
policy; only the order does.

**`interfaces-first` (default).**
1. **First phase (always):** the stable interfaces: domain types, the
   contract-bounded surfaces this node produces, scaffolding. No business
   logic.
2. **Early phases (parallel-safe):** independent modules that consume the
   first phase's types; effects stay behind the interfaces they implement.
3. **Middle phases:** the logic behind each interface, pure where the
   design allows, with IO at the boundaries.
4. **Final phase:** composition: integration wiring, entry point,
   dependency assembly.

**`fp-progression`.** The stricter variant: types, then pure functions,
then effects, then composition, as four ordered bands. Phase 1 is the
type-level skeleton; pure-core phases precede every effect phase; the
final phase is the imperative shell.

**Project-defined.** Named on the conventions line and described in the
conventions body; follow it as written and cite it in the plan's first
line after the summary table.

Whatever the policy, a phase that produces a contract comes before any
phase that consumes it, and the plan's first line after the summary table
names the policy it followed.


## Phase Summary Table

The `## Phase Plan` section of the node spec opens with a summary table, one
row per phase:

```markdown
| Phase | Name | Tier | Size | Depends on | Collides with |
|------:|------|------|------|------------|---------------|
| {n}.1 | Skeleton and test rig | gate-only | ~400 loc, ≤7 tasks | — | 2, 3 |
| {n}.2 | Visual composition | spot-check | ~250 loc, ≤6 tasks | 1 | 1, 3 |
```

The table is the human index; the bullet sections remain the machine-consumed
detail (`hsdd-config` injects only the detailed phase section, so per-phase
context cost is unchanged). Omit the *Collides with* column when no phase
collides.

`## Phase Plan` begins with the `**Default gate:**` line (when present)
followed immediately by the summary table; prose commentary comes after the
table, not before. The table's Phase column uses the same id form as the
phase section headers — the short `{n}.{i}` form is fine if used
consistently throughout the plan.

## Phase Template

```markdown
### {phase-id}: {Phase Name}

- **Consumes:** [contract-id@version, ...] — prior-phase or cross-node
  contracts, or "none"
- **Produces:** [contract-id@version, ...], or "none"
- **Governed by:** [ADR-NNN, ...]            (omit when empty)
- **Scope:** concrete, verifiable deliverable
- **Size estimate:** ~N files (~N lines), <= 8 OpenSpec tasks
- **Gate:** exact command, or "node default" (see node-level default gate)
- **Verification:** 1-3 lines of intent: what a human should confirm works
  beyond the gate (observable behavior, not commands)
- **Review tier:** gate-only | spot-check | full-review
- **Collides with:** [phase-ids]             (omit when none)
- **Dependencies:** which prior phases, and what specifically (contracts only)
```

**Verification is a description, not a document.** The plan's only output is
the phase sections in `hsdd/spec/{node-id}.md`. Never create files under
`hsdd/verify/` during planning: the verification doc
(`hsdd/verify/{phase-id}.verification.md`, with exact commands, expected
output, what to inspect) is written during the OpenSpec cycle at apply, by the
documentation task that `hsdd-config` injects, once the implementation details
exist. The human uses that doc to manually verify the completed change before
archive. The plan's Verification line is the intent that task expands on.

**Rendering rule.** Field blocks are bullet lists (or tables); never bare
`**Field:** value` lines separated by soft line breaks — every compliant
markdown renderer collapses those into one paragraph. Empty lists render
"none", not `[]`.

**`Collides with` marks textual contention** — phases editing the same
files. It never reshapes logical dependencies: colliding phases execute
serially on the node's integration branch; spawn parallel worktrees only for
phases with no collision between them. Entries use the same id form as
Dependencies; a one-line reason may follow an em dash:
`- **Collides with:** [{ids}] — same file (src/channels/registry.ts)`.

**Node-level default gate.** A phase plan may state one default gate above
the summary table — ``**Default gate:** `<command>` `` — and a phase's
`- **Gate:**` field then reads `node default` unless it overrides.

**Producer gate replays the contract.** For every phase whose `Produces`
is not `none`, the `Gate` line includes the contract replay: the command
that validates the phase's real output against
`hsdd/contract/schema/{slug}.schema.json` and reproduces
`hsdd/contract/fixture/{slug}/` for each produced contract. When the
project has no such command yet, the phase's Scope includes creating it and
the Gate names it. A `Gate` of `node default` on a producing phase reads
`node default plus contract replay for {slug}`. Consuming phases test
against those fixtures, never against hand-rolled mocks.

## Review Tiers

| Tier | For | At the gate |
|------|-----|-------------|
| gate-only | scaffolding, types, boilerplate | gate passes, auto-proceed, human notified |
| spot-check | well-constrained phases with clear contracts | glance at diff, confirm gate, proceed |
| full-review | orchestration, business logic, integrations, security | read diff, run verification, consider edge cases |

**Review tier sets the artifact profile.** The tier also sets the artifact
profile of the phase's OpenSpec cycle — gate-only: no `design.md`, slim
verification doc; spot-check: `design.md` only if the phase settles a real
design decision, short verification doc; full-review: the full set.
gate-only and spot-check phases also keep the proposal brief (a few lines:
what and why); only full-review phases get a full proposal. `tasks.md` and
the requirement/scenario deltas never scale (they drive TDD at every tier),
and every phase still produces a verification doc. `hsdd-config`'s rules
enforce this.

Phase 1 (types/scaffolding) is gate-only. Pure utilities are spot-check. External
integrations and orchestration are full-review.

## Sizing: the Phase Equivalent

One **Phase Equivalent (PE)** is the largest change one reviewer can
genuinely review and manually verify in one sitting, plus the agent run
that produced it: roughly <= 400 changed lines of non-generated code, <= 8
OpenSpec tasks, about half a working day end to end. The ~5h window is
calibration for that; the review sitting is the invariant. Each phase is
one PE: `[AI: plan -> implement -> verify]` plus `[human: review specs +
read diff + run manual verification]`, with the review tier modulating the
human half. If a phase cannot fit, it is too big: split it. Phase sizing is
the control knob for context, tokens, time, and quality.


> **Sizing floor.** A phase must be big enough to earn its cycle. Two
> adjacent phases are merge candidates when all hold: (i) same review tier,
> (ii) same consumed contracts, (iii) no third phase depends on one without
> the other, (iv) the merged phase still fits the review window with <= 8
> OpenSpec tasks. Textual contention strengthens the case: phases that would
> serialize anyway (same file, same owner) have a lower bar to merge. Keep a
> small phase separate only for a reason you can name: a tier boundary, a
> parallel lane assigned to another owner, or a risk you want reviewed in
> isolation. Smell: if a phase's predicted process artifacts (proposal +
> design + spec deltas + tasks + verification doc) exceed its predicted
> diff, it is a merge candidate by default.

When a merge-candidate pair is kept split, record the reason in one line —
in the kept phase's section or a short note under the summary table. A plan
with no merge-candidate pairs records nothing.

## Change Requests

When the invoking prompt names an intake record, every phase planned for
that request, in a new plan or an appended one, names the record in its
Scope (`per hsdd/management/2026-10-10-intake-payout-scheduling.md`), so
the checkpoint can append it to the record's `## Produced` and close the
record when the phase ships, and the request's path joins the node's
`- **Sources:**` field (appended, never replacing an entry).

## Append Mode (a plan that already has phases)

A change routed to this node, or a backfill finding from `hsdd-checkpoint`,
appends phases to an existing plan. Rules:

- Continue numbering from the highest existing phase id. **Never renumber.
  Never rewrite a shipped phase.** A shipped phase is one whose verification
  doc is on the spec repo's main branch; shipped-ness is read from
  `hsdd/verify/`, never authored here.
- The summary table is a permanent ledger: shipped phases keep their rows;
  new rows are appended.
- A **retro phase** (a backfill for code that shipped with no phase) is
  marked `(retro)` in its name, cites the finding id in its Scope, and its
  verification doc is written after the fact and marked retroactive.
- A phase appended for a change request follows Change Requests above.
- The dependency graph gains the new nodes; existing edges are not redrawn.
- The pending-governance section is appended to, with a new emission date
  line, and drained by `hsdd-reconcile` as usual.

## Phase Dependency Graph


The graph is a Mermaid flowchart: one node per phase labeled
`{phase-id}<br/>{short name}`; edges are logical dependencies only
(contention is carried by `Collides with`, not drawn); cross-node
dependencies appear as **dashed** edges with the dependency named on the
edge label. If `mermaid-pastel-style` is installed, follow it.

```mermaid
flowchart TD
    P1["{node}.1<br/>Types & contracts"]
    P2["{node}.2<br/>Component A"]
    P3["{node}.3<br/>Component B"]
    P4["{node}.4<br/>Orchestration"]
    P5["{node}.5<br/>Wiring"]
    X1["{producer}.2<br/>produces {contract}"]

    P1 --> P2
    P1 --> P3
    P2 --> P4
    P3 --> P4
    P4 --> P5
    X1 -. "{contract}@v1" .-> P5
```

## Phase Design Checklist

- [ ] Phase 1 defines all shared types and contract-bounded interfaces.
- [ ] Phases 2..N-1 are maximally independent (parallelizable where possible).
- [ ] Each phase has <= 8 OpenSpec tasks (split if more).
- [ ] Adjacent same-tier phases were checked against the sizing floor; every
      merge candidate kept separate names its reason (tier boundary,
      parallel lane, isolated risk).
- [ ] Contract ids are defined before the phase that implements them.
- [ ] Phase N is testable against contract fixtures even if Phase N-1 is
      not implemented.
- [ ] No phase couples to another phase's internals.
- [ ] Each phase has a concrete gate, a verification description, and a review tier.
- [ ] The phase dependency graph is included as a Mermaid flowchart and matches the Dependencies fields.
- [ ] Summary table opens the section and matches the phase sections.
- [ ] Field blocks are bullet lists; empty lists say "none".
- [ ] Every contingent phase names the OQ id it waits on; no contingency
            without a minted OQ.
- [ ] The plan names the ordering policy it followed, matching the
      conventions line (or `interfaces-first` when absent, `fp-progression`
      when only the pre-v0.10 `FP ordering:` bullet is present).
- [ ] Every producing phase's Gate includes the contract replay for each
      contract it produces.
- [ ] In append mode: no existing id changed, no shipped phase edited,
      numbering continued from the highest existing id.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll figure out phases during implementation" | Phases defined after coding starts are retrofitted, not designed. Contracts leak. |
| "Merge them so there's less to review" | Merging to dodge review defeats the tiers. Merge only under the sizing floor's conditions. |
| "Small phases are always a feature" | Small phases are a feature when they buy parallelism or isolated review. A phase below the floor buys neither and still costs a full cycle. |
| "The node spec already lists N pieces, so N phases" | A prose enumeration is not a phase plan. Run the floor over adjacent same-tier phases before accepting the count. |
| "This phase is a bit big but fine" | If it overflows the review window, the human becomes the bottleneck. Split it. |
| "The contract is obvious" | Explicit contracts enable mock testing and phase isolation. Reference the id. |
| "Skip the dependency graph" | Without it, phases are assumed sequential and parallel teams stall. |
| "The contract gap is obvious, I'll just fix the contract file" | Governance files are frozen during planning. Emit a `request`; `hsdd-reconcile` applies the answer at the root. |
| "I'll create the shared artifact locally; the merge will be trivial" | Two agents generating from the same prose are never byte-identical. Record a `request`; the contract must name one canonical owner. |
| "I'll peek at the sibling worktree's plan to coordinate" | Contracts are the only inter-node knowledge. Peeking couples plans invisibly and races the sibling's edits. |
| "I'll write the verification doc now while the phase is fresh" | Planning cannot know the implementation. The doc is written at apply by an OpenSpec task; the plan carries only the one-line intent. |
| "The dependency is obvious, no need for an OQ id" | An unnamed contingency can't be tracked, tailed, or resolved. Name the OQ or stop and have the owning spec mint it. |
