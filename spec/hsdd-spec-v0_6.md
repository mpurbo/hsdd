# HSDD: Hierarchical Spec-Driven Development (v0.6 delta)

> Delta specification. It makes plans render correctly for human reviewers,
> makes ceremony proportional to phase risk (a sizing floor and tier-scaled
> artifacts), defines the execution-stage protocol that v0.4.2's freeze
> defined for planning, and pins the decomposition axis to ownership
> (stack-first when different teams own different parts of the stack). Read
> it against v0.5/v0.5.1; only the changes are stated here. Everything in
> v0.3/v0.4/v0.4.2/v0.5 not touched below still stands.

**Version:** 0.6.0 (draft)
**Status:** For review
**Date:** 2026-07-12
**Author:** Purbo Mohamad
**Drafted from:** the second field test (GMP-911) and its review,
`review/hsdd-process-v0_5_1-review-fable-xhigh.md`, plus a decomposition
observation from a second project running the same skills.
**Supersedes (in part):** the field-block shape of the node-header and phase
templates (`hsdd-spec`, `hsdd-phase-plan`), the ASCII dependency-graph example
of `hsdd-phase-plan`, the unqualified "capability slices over technology
buckets" preference of `hsdd-spec`, the ceiling-only sizing rule and its
anti-merge anti-rationalization row, the "every phase still runs the full
OpenSpec cycle" clause of the users guide's review-tier section, and the
single compound tasks rule of `hsdd-config`. All other provisions are
unchanged.

---

## 1. What 0.6 Changes and Why

The second field test ran the whole loop on a production React monorepo
(GMP-911: one root node, two leaf-parents, fourteen planned phases, one
contract, two ADRs, nine execution worktrees). The methodology's central bet
paid off — the two nodes were built in genuine isolation against a contract
that stayed byte-identical across both lineages — but the field surfaced four
classes of friction, none of them in the parts v0.4.2 already hardened (the
first three from this test, the fourth from a second project running the
same skills):

1. **Plans render as run-on paragraphs.** The node and phase templates emit
   consecutive `**Field:** value` lines separated by single newlines.
   CommonMark treats those as soft breaks, so GitHub and every compliant
   renderer collapse a nine-field phase section — including a 20-line Scope —
   into one paragraph. The artifact that exists *for the human reviewer* is
   the one the human cannot read. Relatedly, one node's dependency graph came
   out as Mermaid and its sibling's as ASCII art, because `hsdd-phase-plan`'s
   example is ASCII while `hsdd-spec` mandates Mermaid.
2. **Ceremony has a ceiling but no floor.** Sizing is enforced downward only:
   the ~5h window rule, the ≤8-task rule, and an anti-rationalization row
   that brands every merge impulse as rationalization. Meanwhile every phase
   pays an identical fixed cost (full OpenSpec artifact set, full
   verification doc, context switch, review, archive). Measured on the
   smallest field phase: ~160 lines of product change against ~495 lines of
   process artifacts, a 3:1 ratio. The users guide already states the
   principle — *depth and ceremony are costs* — but no skill can act on it.
3. **Planning is conflict-free by construction; execution is not.** The
   field repo shows: `openspec/config.yaml` rewritten wholesale and committed
   on every phase branch (a guaranteed, meaningless merge conflict); the same
   node's phase plan and a reconcile committed independently on two diverged
   lineages (an add/add conflict and an authority ambiguity waiting at
   integration); and four worktrees executing phases in parallel that the
   plan itself had flagged as textually colliding in one file.
4. **Decomposition follows elegance, not ownership.** A high-level spec with
   a clear backend and a clear frontend was decomposed vertically — auth
   end-to-end, billing end-to-end — each node spanning both stacks.
   Logically defensible; practically each node now had two owning teams,
   which breaks the leaf-parent criterion ("one owner or pair can hold its
   full scope in their head") and the worktree-per-node assignment model.
   The cause is the skill's own unqualified preference for "capability
   slices over technology buckets".

v0.6 fixes all four, plus the housekeeping the review listed. No core
invariant moves: one phase still drives exactly one OpenSpec change and ends
at one human review gate; the planning freeze and reconcile semantics are
untouched.

---

## 2. Readable Plans

### 2.1 Field blocks are bullet lists

Every field block emitted by `hsdd-spec` (node header) and `hsdd-phase-plan`
(phase sections) becomes a bullet list. The 2-space continuation indent for
wrapped values is unchanged; wrapped lines become list-item continuations and
keep rendering inside their field.

Updated phase template:

```markdown
### {phase-id}: {Phase Name}

- **Consumes:** [contract-id@version, ...] — prior-phase or cross-node
  contracts, or "none"
- **Produces:** [contract-id@version, ...], or "none"
- **Governed by:** [ADR-NNN, ...]            (omit when empty)
- **Scope:** concrete, verifiable deliverable
- **Size estimate:** ~N files (~N lines), <= 8 OpenSpec tasks
- **Gate:** exact command, or "node default" (§3.4)
- **Verification:** 1-3 lines of intent: what a human should confirm works
  beyond the gate (observable behavior, not commands)
- **Review tier:** gate-only | spot-check | full-review
- **Collides with:** [phase-ids]             (omit when none; §4.3)
- **Dependencies:** which prior phases, and what specifically (contracts only)
```

The node-header template in `hsdd-spec` changes the same way (`- **Kind:** …`
through `- **Isolation strategy:** …`).

Two writing rules become quality-gate items in both skills:

- **Rendering rule:** field blocks must be bullet lists or tables; never rely
  on soft line breaks for structure.
- **Empty lists render as "none"**, not `[]`. Bracket notation is agent-speak;
  the plan is a human artifact.

Rejected alternatives, so they stay rejected: full tables for the phase record
(Scope and Verification are multi-sentence prose; table cells force them onto
one physical line — unreadable source, undiffable, fragile to edit) and hard
line breaks (trailing spaces or `\` are invisible in source and silently
stripped by editors and formatters).

### 2.2 The phase summary table

The `## Phase Plan` section of a node spec now **opens with a summary table**,
one row per phase:

```markdown
| Phase | Name | Tier | Size | Depends on | Collides with |
|------:|------|------|------|------------|---------------|
| {n}.1 | Skeleton, constants, test rig | gate-only | ~400 loc, ≤7 tasks | — | 2, 3 |
| {n}.2 | Visual composition | spot-check | ~250 loc, ≤6 tasks | 1 | 1, 3 |
```

The table is the human index; the bullet sections remain the machine-consumed
detail. `hsdd-config` keeps injecting only the detailed phase section into
`config.yaml`, so per-phase context cost is unchanged and the table never
enters an agent's context. Omit the *Collides with* column when no phase
collides.

New quality-gate item in `hsdd-phase-plan`: the summary table matches the
phase sections (same rule shape as the existing DAG-matches-table gate).

### 2.3 The phase dependency graph is Mermaid

`hsdd-phase-plan`'s dependency graph is now a **Mermaid flowchart**, replacing
the ASCII example. This aligns it with `hsdd-spec`, which has required a
Mermaid DAG since v0.3; the ASCII example in the phase-plan skill was the only
reason sibling plans came out in different formats. Rules:

- One node per phase, labeled `{phase-id}<br/>{short name}`.
- Edges are logical dependencies only (the existing rule; textual contention
  is carried by *Collides with*, not drawn).
- Cross-node dependencies (a phase consuming another node's artifact) appear
  as **dashed** edges with the dependency named on the edge label.
- If `mermaid-pastel-style` is installed, follow it — same clause as
  `hsdd-spec` step 7.

### 2.4 Headings in standalone node spec files

The templates start at `###` because they are designed for embedding. A
standalone node spec file emitted by `hsdd-spec` uses: one `#` title
(`# {node-id}: {Node Name}`), `##` for document sections, and does **not**
repeat the title as an inner `###` heading. This retires the duplicated
H1/H3 title pair observed in every field-generated node spec.

---

## 3. Proportional Ceremony

### 3.1 The sizing floor

v0.3 §12.3's window rule gains a lower bound. Added to `hsdd-phase-plan`
alongside "Sizing to the Review Window":

> **Sizing floor.** A phase must be big enough to earn its cycle. Two
> adjacent phases are merge candidates when all hold: (i) same review tier,
> (ii) same consumed contracts, (iii) no third phase depends on one without
> the other, (iv) the merged phase still fits the review window with ≤ 8
> OpenSpec tasks. Textual contention strengthens the case: phases that would
> serialize anyway (same file, same owner) have a lower bar to merge. Keep a
> small phase separate only for a reason you can name: a tier boundary, a
> parallel lane assigned to another owner, or a risk you want reviewed in
> isolation.
>
> Smell: if a phase's predicted process artifacts (proposal + design + spec
> deltas + tasks + verification doc) exceed its predicted diff, it is a merge
> candidate by default.

Field calibration: applying the floor to the GMP-911 plans merges 14 phases
into 10 with no isolation lost where isolation was doing work — the pure
core, the effects layer, and the integrations keep their own cycles and
their full-review tiers.

### 3.2 The review tier scales the artifacts

Through v0.5.1 the tier modulated only human attention; every phase produced
the identical artifact set. From 0.6 the tier also sets the artifact profile:

| Tier | proposal | design.md | tasks + spec deltas | verification doc |
|------|----------|-----------|---------------------|------------------|
| gate-only | brief (a few lines: what and why) | **skipped** | full | slim: gate command, expected output, 3–5 line checklist |
| spot-check | brief | skipped unless the phase settles a real design decision | full | short: commands, expected output, what to eyeball |
| full-review | full | full | full | full (current shape) |

Never scaled: `tasks.md` and the requirement/scenario deltas — they drive
TDD and the tests, at every tier. Every phase still produces a verification
doc; only its depth varies. OpenSpec already treats `design.md` as an
optional artifact for changes that need design decisions; this table states
when the HSDD workflow exercises that option.

Mechanism: the review tier is already injected into every phase context, so
`hsdd-config`'s artifact rules become tier-conditional. Field evidence for
the split: the gate-only skeleton phase carried a 133-line `design.md` that
decided nothing its proposal and spec deltas had not already stated, while a
full-review phase's 157-line `design.md` earned its keep (decisions the
verification doc later leaned on). The tier already encodes exactly the
needed signal.

### 3.3 Anti-rationalization, rebalanced

The row "These two phases are too small, combine them" → "Small phases are a
feature" is removed from `hsdd-phase-plan`. It made the skill structurally
unable to agree with a correct merge. Replaced by two rows that distinguish
motive:

| Thought | Reality |
|---------|---------|
| "Merge them so there's less to review" | Merging to dodge review defeats the tiers. Merge only under the sizing floor's conditions. |
| "Small phases are always a feature" | Small phases are a feature when they buy parallelism or isolated review. A phase below the floor buys neither and still costs a full cycle. |

### 3.4 Node-level default gate

A phase plan may state one default gate command above the summary table:

```markdown
**Default gate:** `pnpm --filter @gma-apps/migpa test && pnpm --filter @gma-apps/migpa build`
```

A phase's `- **Gate:**` field then reads `node default` unless it overrides.
One place to fix when the command changes; seven identical copies observed in
the field plan.

---

## 4. The Execution Protocol

v0.4.2 froze governance during *planning*. These rules are its mirror for
*execution* — the per-phase OpenSpec cycles running on branches and
worktrees. They live in the conventions template's parallel-development
section (extended and renamed to cover both stages), in `hsdd-config`, and in
the users guide.

### 4.1 `config.yaml` is ephemeral working state

The `## Current Phase` block (and its companion contract/ADR blocks) in
`openspec/config.yaml` is per-session working state, rewritten by every phase
context switch. **A merge conflict on it carries no information.** The rule:

> On any merge, resolve `openspec/config.yaml` by taking either side, then
> re-run the phase context switch (`/hsdd-phase {next-phase}`) before the
> next OpenSpec cycle. Optionally set `openspec/config.yaml merge=ours` in
> `.gitattributes` on integration branches.

`/hsdd-phase` gains a self-heal check: warn when the Current Phase block
names a phase that is not next-runnable per the node's plan (already
archived, or blocked by an unmerged dependency).

### 4.2 Branch discipline

- One **integration branch per node**; phase branches merge into it.
- Node integration branches merge into the **root branch**.
- A node's plan file (`hsdd/spec/{node-id}.md`) is written on **exactly one
  lineage**. Never re-plan or copy a plan onto a diverged sibling lineage.
- `hsdd-reconcile` runs **once, at the root lineage**, after the node plans
  are merged there — never per-lineage. Its commit exists only on the root.

Field failure this prevents: the same node's phase plan plus a reconcile
committed independently on two diverged lineages — near-identical content,
different hashes, an add/add conflict and an "which reconcile is
authoritative?" question deferred to integration day.

### 4.3 Structured contention: `Collides with`

When phases share files, the plan already knows it (the field plan said so in
prose: every phase edits `index.html`, so "parallel worktrees buy little
here") — but prose is invisible at the moment worktrees get spawned. The
knowledge becomes structured:

- Each phase section carries `- **Collides with:** [phase-ids]` when the plan
  expects textual contention (omit when none).
- The summary table (§2.2) shows the column, so the human sees contention
  when deciding what to parallelize.
- Rule of thumb stated in the users guide: colliding phases execute serially
  on the node's integration branch; spawn parallel worktrees only for phases
  with no `Collides with` entry between them.

Logical dependencies and textual contention stay separate concepts: the
Mermaid graph draws the former, the field carries the latter.

### 4.4 Capability naming in `openspec/specs/`

Per-phase capability names (`loading-shell-skeleton`,
`loading-shell-visuals`, …) leave `openspec/specs/` a pile of phase-shaped
specs no future change will update; per-area names make archives collide when
phases run in parallel. The trade-off is real, so 0.6 states a default
instead of pretending there is none:

> Name capabilities after a **stable feature area within the node**, not
> after the phase. Accept that same-capability archives serialize — under
> §4.3 colliding phases serialize anyway. Fall back to per-phase capability
> names only when genuinely parallel phases would contend on the same
> capability spec.

This is a `hsdd-config` proposal-rule change plus a users-guide note.

---

## 5. The Verification Doc Gets a Template and a Sign-off

The verification doc's required content previously lived inside one compound
`hsdd-config` tasks rule. Two changes:

**5.1 The tasks rule splits into three rules** (long compound rules are the
ones agents half-apply):

1. "Include a gate task that runs the phase gate command."
2. "After the gate task, add a documentation task that writes the
   verification doc at `hsdd/verify/{phase-id}.verification.md` from the
   bundled template, at the depth the phase's review tier requires (§3.2)."
3. "Never update `hsdd/conventions.md` or `hsdd/contract/` from a phase;
   governance changes are made at the root (hsdd-contract / hsdd-reconcile)."

**5.2 `hsdd-config` bundles `templates/verification.md`:**

```markdown
# Verification: {phase-id} — {Phase Name}

## Commands to run
## Expected output
## Observed            (dated; what actually happened when implemented)
## Outstanding         (what could not be verified in this environment)
## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) | deferred to {phase-id}
```

The Outstanding section pattern emerged in the field (an agent honestly
listing what a headless environment could not verify) and proved valuable;
the Sign-off section closes its loop — the review gate is not passed while an
Outstanding item lacks a disposition. Timing is unchanged from 0.5.1: the doc
is written at apply, never during planning.

---

## 6. The Decomposition Axis

### 6.1 The observed failure

A second project's high-level spec had a clear backend and a clear frontend,
and `hsdd-spec` decomposed it vertically: auth end-to-end, billing
end-to-end, each node spanning both stacks. Nothing about that is logically
wrong — and everything about it is practically wrong when backend and
frontend are different teams. An end-to-end node then has two owners, its
phases interleave two toolchains and deploy targets, the leaf-parent
criterion ("one owner or pair can hold its full scope in their head")
silently fails, and the worktree-per-node model has no single owner to
assign the node to.

The cause is in the skill: "prefer capability slices over technology
buckets" is stated without qualification. It was written to reject *layer*
buckets inside one codebase (controllers/, models/, ui/ — untestable in
isolation because every feature crosses all of them). It gets read as
licensing feature slices across an ownership boundary. The users guide's own
Example 2 already models the right behavior (acme splits into backend /
mobile / web, "built by separate teams", before any capability appears); the
skill now states what the example only showed.

### 6.2 The rule: ownership first, capabilities within

Added to `hsdd-spec` (process step 2):

> **Choose the decomposition axis by ownership, not elegance.** At each
> level, first split along the boundaries where different teams, owners, or
> deploy targets hold different parts of the stack — backend vs frontend vs
> mobile. Those boundaries come with their natural contract (the API, the
> event stream) and match how work is actually assigned; Conway's law is a
> constraint to design with, not a smell to fight. Within one owner's
> territory, prefer capability slices (auth, billing) over technology
> buckets (controllers, models, ui): that rule rejects layer buckets inside
> one codebase, never stack splits across teams.
>
> A capability that spans the stack does not disappear; it returns one level
> down as a node per side — `{sys}.backend.auth` and `{sys}.frontend.auth` —
> joined by a contract, with the pairing visible in the dependency DAG.
>
> Vertical end-to-end slices remain correct when one owner genuinely holds
> the whole stack (a solo developer, one full-stack squad): there the
> feature boundary *is* the ownership boundary.

The rule reduces to one question: **who builds what?** When the input does
not state the team structure and the system plausibly spans stacks, this is
the canonical use of step 1's one-clarifying-question allowance — the answer
changes the decomposition, which is exactly the bar that step sets for
asking.

New quality-gate item in `hsdd-spec`: the decomposition axis at each level
matches the stated ownership; no node is owned by two teams. New
anti-rationalization row:

| Thought | Reality |
|---------|---------|
| "Auth end-to-end is one coherent capability" | Coherent for whom? If backend and frontend are different owners, the node has two owners and no isolation. Split at the ownership boundary; the capability comes back as a node pair joined by a contract. |

---

## 7. Skill Edits (summary)

| Skill | Change |
|-------|--------|
| `hsdd-phase-plan` | Bullet-list phase template; summary table + quality gate; Mermaid dependency graph (pastel style if installed, dashed cross-node edges); sizing floor + merge smell; anti-rationalization rows replaced (§3.3); node-level default gate; `Collides with` field; "none" for empty lists. |
| `hsdd-spec` | Bullet-list node-header template; standalone-file heading levels (§2.4); rendering rule in quality gates; "none" for empty lists; ownership-first decomposition axis (§6) with quality gate and anti-rationalization row. |
| `hsdd-config` | Tier-conditional artifact rules (§3.2); tasks rule split in three; bundled verification template; config-ephemerality rule (§4.1); `/hsdd-phase` self-heal check; capability-naming default (§4.4). |
| `hsdd-contract`, `hsdd-adr`, `hsdd-reconcile` | No change. |
| Conventions template | Parallel-development section extended to the execution protocol (§4.1–4.4). |

---

## 8. Settled Decisions (0.6)

| Question | Decision |
|----------|----------|
| Decomposition axis | Ownership first: split by stack when different teams own different parts of it; capability slices apply within one owner's territory. "Capability over technology buckets" rejects layer buckets in one codebase, not cross-team stack splits. Unknown team structure is the canonical one-clarifying-question. |
| Field-block format | Bullet lists. Tables rejected for multi-sentence fields; hard line breaks rejected as invisible and fragile. |
| Human scannability of a plan | A summary table per phase plan, human-only; `hsdd-config` injection is unchanged, so agent context cost is zero. |
| Dependency graph format | Mermaid, both skills, always; ASCII retired. Cross-node edges dashed. Contention is not drawn — it is a field. |
| Sizing | Floor added to the existing ceiling; merge requires same tier, same contracts, clean dependency shape, and window fit. Artifacts-exceed-diff is the default merge smell. |
| What the review tier controls | Human attention (as before) **and** artifact depth: design.md and verification depth scale; tasks and spec deltas never scale; a verification doc always exists. |
| One phase = one OpenSpec change = one review gate | Unchanged invariant. |
| `openspec/config.yaml` at merge | Ephemeral: take either side, re-run the phase switch. Conflicts on it carry no information. |
| Where plans and reconciles live | A node's plan on exactly one lineage; reconcile once, at the root lineage only. |
| Textual contention | Structured (`Collides with`), surfaced in the summary table, serializes execution; it never reshapes logical dependencies. |
| Capability naming | Per stable feature area within the node by default; per-phase names only for genuinely parallel contention. |
| Verification doc | Bundled template with Outstanding + Sign-off; gate not passed while an Outstanding item lacks a disposition. Written at apply (0.5.1 rule stands). |
| Empty contract lists | Render "none", not `[]`. |

---

## 9. Implementation Steps

1. Edit `hsdd-phase-plan`: phase template (bullets, `Collides with`, node
   default gate), summary table + gate, Mermaid graph section, sizing floor,
   anti-rationalization rows, "none" rule.
2. Edit `hsdd-spec`: node-header template, heading levels, rendering rule,
   decomposition-axis rule with its quality gate and anti-rationalization
   row.
3. Edit `hsdd-config`: tier-conditional artifact rules, split tasks rule,
   bundle `templates/verification.md`, config-ephemerality + self-heal,
   capability-naming rule.
4. Edit the conventions template: execution protocol section.
5. Update the users guide: reformat the inline examples to the new
   templates; revise the review-tier section ("full cycle regardless of
   tier" clause); add an execution-stage walkthrough mirroring Example 2's
   planning walkthrough (integration branches, config merge rule,
   contention); note in Example 2 that its stack-first split is the stated
   rule (§6), not just an example.
6. Update README and CHANGELOG (`[0.6.0]`); fix the stale compare links
   (0.5.0/0.5.1 entries have no link definitions and `[Unreleased]` still
   compares against v0.4.2).
7. No change to `gen-registry.mjs`.
8. (Editorial, may ship separately) Consolidate v0.3–v0.6 into a single
   current spec; the users guide still links v0.3 as "the methodology spec",
   and the reading path is now five documents deep.
