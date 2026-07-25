# HSDD v0.7 Management Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement HSDD v0.7 per `spec/hsdd-spec-v0_7.md` — two new skills (`hsdd-checkpoint`, `hsdd-milestone`), open-question anchors in the six existing skills and the conventions template, the standalone-spec-repo profile in `hsdd-config`, docs, and the acceptance run against microsite-hsdd.

**Architecture:** This is a skills/docs repo — the deliverables are markdown skill files following the house pattern (frontmatter with triggers + do-NOT-use, core principle, When to Use, Process, templates as bullet outlines, Quality Gates, Anti-Rationalization table). "Tests" are grep-verifiable anchors plus the §7.3 acceptance run against the live microsite-hsdd project.

**Tech Stack:** Markdown skills (Claude Code skill format), 4-line command shims in `commands/`, no build system.

## Global Constraints

- The normative source is `spec/hsdd-spec-v0_7.md`; section references (§n) below point there. On any conflict between this plan and the spec, the spec wins.
- House skill style: YAML frontmatter `name` + folded `description` with Triggers and "Do NOT use for"; one `#` title; `**Core principle:**` paragraph; `## When to Use`; `## Process` (numbered); `## Quality Gates` (checkboxes); `## Anti-Rationalization` (Thought | Reality table). Field blocks are bullet lists; empty lists render "none".
- Management-layer invariant, verbatim everywhere it's stated: **management documents cite, never define** (§2.1).
- The pinned "done" definition, verbatim: *implemented, gate command green, verification doc merged to the spec repo's main branch* (§2.3, §2.5).
- Supersedes links are **by exact filename** (§2.2). Dated docs accept only tick + change-log-append edits after publication.
- Work on branch `feat/v0.7.0`. One commit per task, message style `feat(skills): …` / `docs: …` matching `git log` precedent.
- Skill names `hsdd-checkpoint` and `hsdd-milestone` are fixed (§8.1) — do not rename (vNext reserves `hsdd-review`, `hsdd-adopt`).

---

### Task 1: `hsdd-checkpoint` skill + command

**Files:**
- Create: `skills/hsdd-checkpoint/SKILL.md`
- Create: `commands/hsdd-checkpoint.md`

**Interfaces:**
- Consumes: `spec/hsdd-spec-v0_7.md` §2 (document shapes), §3 (process), §7.2 (adoption).
- Produces: the skill later tasks reference by name; the document-shape outlines Task 2 and Task 6 cross-reference (`YYYY-MM-DD-progress.md`, `YYYY-MM-DD-execution-plan.md`, `atlas.md` filenames; the findings→plan rule).

- [ ] **Step 1: Write `skills/hsdd-checkpoint/SKILL.md`** with exactly this content:

````markdown
---
name: hsdd-checkpoint
description: >
  Use when reviewing an HSDD project's real state and compiling it into the
  management documents: one evidence pass across the spec repo and every
  implementation repo, emitting a progress report, a revised execution plan, a
  regenerated atlas, and milestone gate ticks. Triggers: "run a checkpoint",
  "weekly review", "comprehensive review of the project", "new context landed
  in commit X", "make sure the specs are consistent with this incoming
  context", "write an execution plan for the upcoming week", "progress
  report", "how far along are we", "what's our velocity", "regenerate the
  atlas". Do NOT use for generating or re-baselining the milestone document
  (hsdd-milestone), fixing the defects it finds (hsdd-reconcile,
  hsdd-contract, hsdd-adr own the fixes), or phase planning (hsdd-phase-plan).
---

# HSDD Checkpoint: One Evidence Pass, Four Views

Review what is actually true across the project's repos, then compile it into
the management layer: the progress report (evidence), the revised execution
plan (operations), the atlas (bird's-eye), and milestone gate ticks
(stakeholders). The four outputs are views over one evidence pass — run it
once, emit them all.

**Core principle:** management documents **cite, never define**. Nothing in
`management/` is normative; a decision minuted in a plan must land in its
governance artifact (spec `D{n}`, ADR, contract) or it does not exist. And a
review that does not end in a plan is confusion with a date on it — every
checkpoint ends in a revised execution plan.

## When to Use

- **Weekly (full mode):** before the team sync, so the sync works from a
  fresh plan. The cadence is a convention — nothing schedules it for you.
- **On a context drop (scoped mode):** a PRD revision, design drop, or
  decision landed ("new context in commit X and commit Y") and the specs
  must be re-checked against it.
- **First run on an existing project (adoption):** same pass, with the
  adoption behaviors below.

**Do NOT use for** milestone generation or re-baselining (`hsdd-milestone` —
this skill only *ticks* existing gates), authoring fixes (route findings to
`hsdd-reconcile` / `hsdd-contract` / `hsdd-adr`), or phase planning.

## The Management Layer

`management/` sits beside `spec/`, `contract/`, `adr/` at the HSDD root.
Point-in-time documents are dated and chained; the atlas is living:

- `management/YYYY-MM-DD-progress.md` — this skill writes it
- `management/YYYY-MM-DD-execution-plan.md` — this skill writes it
- `management/YYYY-MM-DD-milestones.md` — `hsdd-milestone` writes it; this
  skill ticks its gates
- `management/atlas.md` — this skill regenerates it whole

Chain rules (enforced here, checked every pass):

- Every dated doc carries `**Supersedes:**` linking the previous doc of its
  kind **by exact filename**, `**Repo baselines:**` (spec repo SHA + every
  implementation repo SHA + submodule pointers under the standalone-spec-repo
  profile), `**Companion docs:**` (same-date siblings), and a `## Change log`.
- After publication a dated doc accepts exactly two in-place edits: ticking
  its own checkboxes and appending to its change log. Anything more is a new
  superseding document. **Historical documents are never rewritten.**

## Process

1. **Pin the baselines.** Record the spec repo SHA and every implementation
   repo SHA. Under the standalone-spec-repo profile, record each repo's
   submodule pointer; a pointer that is not a spec-repo main commit is a
   finding *now*, before any content review — every conclusion drawn through
   a forked submodule is suspect.
2. **Run the evidence pass.**
   - *Governance integrity (spec repo):* registry consistency (INDEX files
     match artifact files); dangling references (files, anchors, IDs);
     open-question health (every cited OQ id defined exactly once in its
     owning spec, table + detail subsection present, statuses coherent, no
     prose still treating a `RESOLVED` question as pending); undrained
     `## Governance updates (pending reconcile)` sections; verification-doc
     audit (every claimed-done phase has its doc on main, sign-off fields
     filled, no template residue); management chain integrity (supersedes
     links resolve by exact filename, baselines present).
   - *Code vs plan (each implementation repo):* which phases the code
     actually completes versus what plans and the prior progress report
     claim; contract-surface drift in both directions (code behavior the
     contract does not promise, contract promises the code abandoned);
     scope creep (code with no phase).
3. **Emit the progress report** (shape below). The only admissible "done"
   is: implemented, gate command green, verification doc merged to the spec
   repo's main branch. Claims without a verification doc are reported as
   claims.
4. **Revise the execution plan** (shape below): a new dated file superseding
   the previous plan, current-state delta computed from the evidence pass,
   every findings-register row compiled into a step or explicitly waived
   (see the loop rule), guardrail candidates proposed from the week's
   lessons — proposed, the human accepts or rejects each; guardrails are
   append-only and never renumbered.
5. **Regenerate the atlas** (shape below), whole-file.
6. **Tick the milestone gates** in the current milestone document and
   evaluate the re-baseline trigger (a gate red across two consecutive
   checkpoints, or totals moved). If it fires, say so loudly and hand off
   to `hsdd-milestone` — do not re-baseline here.
7. **Report** with the same discipline the pass audits: what was written,
   what could not be verified, what needs a human decision. Never a silent
   green.

## The Findings→Plan Loop

> **Every row of the progress report's findings register lands in the
> execution plan as a step — or is explicitly waived in the plan with a
> reason.** No third state. The plan step cites the finding, so register
> and plan can be diffed with nothing orphaned. A finding appearing in two
> consecutive progress reports without a landed step is itself a finding,
> one level up.

## Two Modes

- **Full** (default): the whole sequence above.
- **Scoped** (named inputs — commit IDs, document paths, a described
  context drop): the evidence pass narrows to the artifacts the new
  context touches **plus their closure** (consumers of touched contracts,
  phase plans of touched nodes); code-vs-plan runs only where the closure
  reaches. Output is still all four views — a scoped run still supersedes
  the plan — but it may carry forward the previous progress report's
  numbers where the scope did not touch them, saying so explicitly.

A scoped run answers "new context arrived — what does it break and what do
we do"; a full run answers "what is true — and what do we do".

## Adoption Run (first checkpoint on an existing project)

- **Nonconformances are findings, not errors.** Pre-convention OQ formats,
  a missing atlas, broken supersedes links, blank sign-offs: each becomes
  a findings-register row and a migration step in the emitted plan. Never
  hard-fail on the state this run exists to repair.
- **Existing documents are adopted, not replaced.** Pre-existing management
  docs become the head of the supersedes chain (the new plan supersedes
  the latest old plan by exact filename, whatever its naming scheme);
  existing numbered guardrails are imported under their numbers, not
  restarted from 1. Historical docs are never rewritten; conformance
  applies from the next document forward.
- **The first atlas is generated** whatever state the tree is in — an
  atlas of a messy tree is precisely the map the cleanup needs.

## Document Shapes

### Progress report (`management/YYYY-MM-DD-progress.md`)

Required sections, in order:

- Header block: date, `**Repo baselines:**`, `**Companion docs:**`,
  `**Method:**` (one line: which repos were reviewed, against what).
- **Bottom line** — one table: phases planned / code-complete / remaining
  (externally-contingent count broken out), implementation progress %,
  observed velocity per lane (PE/manday), calibrated remaining effort,
  calendar outlook.
- **What is done** — per node, with evidence (verification doc on main).
- **Velocity** — observed rate per lane, then the calibrated rate with its
  caveats stated (early phases are light; review, not generation, is the
  bottleneck; no scaling assumptions beyond current staffing). Calibration
  here supersedes any earlier estimation document.
- **Blockers** — ranked by urgency: what each blocks, and its repair.
- **Findings register** — every defect found, with severity
  (High/Medium/Low) and area. Consumed by the loop rule above.
- **Verdict** — a short honest paragraph: is the method working, what is
  the real threat.

### Execution plan (`management/YYYY-MM-DD-execution-plan.md`)

Required sections, in order:

- Header block: created date, `**Supersedes:**` (exact filename),
  `**Repo baselines:**`, `**Companion docs:**`.
- **Operating model preamble** — who executes (the lanes), where prompts
  run; the delegation-guide legend: **🤖 delegate / 🤝 interactive /
  👤 human-only** (may point at a prior plan's guide by exact filename).
- **Current state** — the delta since the superseded plan, in plan terms.
- **Ownership split** — nodes per lane, contracts per lane (single-writer),
  external tracks per lane.
- **Sync points** — the standing weekly plus named consolidation or
  integration syncs: when, who, agenda.
- **Step tables** — stable step IDs, owner, action, dependency, done
  checkbox.
- **Copy-paste prompts with validation** — for every 🤖/🤝 step: the exact
  `/<skill> …` prompt to paste and a *Validate:* line naming the
  observable outcome to check by hand. Required, not decorative — this is
  what makes the plan executable by someone other than its author.
- **External tracks** — `E{n}` table: owner, status, what happens on
  answer, which contingent phases it gates (by OQ id).
- **Timeline** — weeks × lanes, aligned to the milestone document.
- **Guardrails** — append-only numbered rules; a lesson learned becomes
  the next number; never renumber or delete.
- **Change log.**

### Atlas (`management/atlas.md`)

Three parts, regenerated whole every checkpoint:

1. **The tree** — root to phases. Node status: `specified |
   phase-planned`; phase status: `planned | in-progress | done |
   contingent (OQ-id)` with the pinned done definition. A diagram down to
   nodes, a per-node phase-status table beneath.
2. **The contract graph** — producers, consumers, `draft/stable` per
   contract. One overview diagram at subsystem level, then one detail
   diagram per parent node; split any diagram that would exceed ~20 nodes.
   Never one mega-graph.
3. **The ADR coverage map** — which ADRs govern which nodes and contracts
   (from `Governed by`), as a table; a diagram only where an ADR's reach
   is genuinely cross-cutting.

The atlas is **derived only**: every element must be reconstructible by
grep from `spec/`, `contract/`, `adr/`. If it disagrees with the
artifacts, the atlas is wrong by definition; the fix is regeneration. If
`mermaid-pastel-style` is installed, follow it for all diagrams.

## Read-Only Toward Governance

Checkpoint *finds* the stale ADR note, the undrained reconcile section,
the contract drift — it does not fix them. Fixes become plan steps routed
to the owning skill and the owning human. The only files this skill
writes live under `management/`.

## Quality Gates

- [ ] Baselines pinned before any content conclusion; submodule pointers
      audited under the profile.
- [ ] Every findings-register row has a plan step or an explicit waiver —
      diff register against plan, nothing orphaned.
- [ ] "Done" claims verified against verification docs on main; claims
      without docs reported as claims.
- [ ] New plan supersedes the previous plan by exact filename; baselines
      and companion links present in every emitted doc.
- [ ] Guardrails imported/extended append-only; proposals marked as
      proposals.
- [ ] Atlas regenerated whole; no diagram over ~20 nodes; every element
      greppable back to a source artifact.
- [ ] Milestone gates ticked; re-baseline trigger evaluated and reported.
- [ ] No file outside `management/` modified.
- [ ] OQ health verified: every cited id defined exactly once, statuses
      coherent, no stale pending-prose on resolved questions.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The repos are probably in sync, skip the baseline pinning" | Every conclusion drawn through a forked submodule is suspect. Pin first; a stale pointer is finding number one. |
| "This finding is minor — note it in the report only" | Every register row lands as a plan step or an explicit waiver. No third state; unlanded findings are how confusion compounds. |
| "I'll fix the stale ADR note while I'm here" | Checkpoint is read-only toward governance. Route the fix to the owning skill as a plan step; a checkpoint that edits specs destroys its own evidence. |
| "The code looks done, the developer said it's done" | Done = verification doc merged to spec-repo main. Everything else is a claim, and the report says so. |
| "The old plan's link is broken — I'll fix the old file" | Historical docs are never rewritten. Record the finding; conformance applies from the next document forward. |
| "The atlas from last week mostly holds, patch it" | The atlas is derived state, regenerated whole. A patched atlas is a hand-maintained cache — the failure mode it exists to replace. |
| "Little changed; copy last week's numbers" | Carrying numbers forward is a scoped-mode privilege and must be stated in the doc. In full mode, count. |
| "The milestone gate is red again — I'll adjust the dates" | Two consecutive reds fire the re-baseline trigger, which belongs to hsdd-milestone and the stakeholders. Tick, report, hand off. |
````

- [ ] **Step 2: Write `commands/hsdd-checkpoint.md`** with exactly this content:

```markdown
---
description: Run an HSDD checkpoint - evidence pass, progress report, revised plan, atlas
---
Use the hsdd-checkpoint skill to run a checkpoint: $ARGUMENTS
```

- [ ] **Step 3: Verify anchors**

Run: `grep -c "cite, never define\|exact filename\|verification doc merged" skills/hsdd-checkpoint/SKILL.md && grep -n "^## " skills/hsdd-checkpoint/SKILL.md`
Expected: count ≥ 4; section list includes When to Use, The Management Layer, Process, The Findings→Plan Loop, Two Modes, Adoption Run, Document Shapes, Read-Only Toward Governance, Quality Gates, Anti-Rationalization.

- [ ] **Step 4: Commit**

```bash
git add skills/hsdd-checkpoint commands/hsdd-checkpoint.md
git commit -m "feat(skills): hsdd-checkpoint — one evidence pass, four views (v0.7 §3)"
```

---

### Task 2: `hsdd-milestone` skill + command

**Files:**
- Create: `skills/hsdd-milestone/SKILL.md`
- Create: `commands/hsdd-milestone.md`

**Interfaces:**
- Consumes: §4 and §2.5 of the spec; the shape names from Task 1 (`management/YYYY-MM-DD-milestones.md`; checkpoint ticks, milestone generates/re-baselines).
- Produces: the milestone-document shape Task 6's guide section references.

- [ ] **Step 1: Write `skills/hsdd-milestone/SKILL.md`** with exactly this content:

````markdown
---
name: hsdd-milestone
description: >
  Use when generating or re-baselining an HSDD project's milestone document —
  the stakeholder view: demo + gate checkpoints, launch window, contingent
  tail. Triggers: "generate the milestone document", "stakeholder
  checkpoints", "when can we launch", "re-baseline the milestones", "the
  milestone slipped two weeks", "scope changed, do the dates hold". Runs once
  all leaf-parents are phase-planned, and again only on the slip or scope
  trigger. Do NOT use for weekly gate ticking or progress reporting
  (hsdd-checkpoint), phase planning (hsdd-phase-plan), or recording the
  decisions a re-baseline produces (hsdd-adr / the owning spec).
---

# HSDD Milestone: Stakeholder Checkpoints With Demos and Gates

Generate the milestone document: the project's progress checkpoints as
stakeholders see them — each a demo plus a measurable gate — with the launch
window and the externally-gated contingent tail. Re-baseline it when reality
moves the dates.

**Core principle:** a milestone is something a stakeholder can **watch
work**, gated by checks that answer yes or no. Internals ("module X
complete") are not milestones; unmeasurable gates are not gates. And the
document cites, never defines — every number traces to the phase plans and
the latest progress report.

## When to Use

- **Generation:** every leaf-parent node has a phase plan — the first moment
  total scope is computable.
- **Re-baseline:** the slip trigger (a gate red across two consecutive
  checkpoints) or the scope trigger (a change moved the phase totals and
  the dates cannot absorb it).

**Do NOT use for** weekly gate ticking (that is `hsdd-checkpoint`'s step),
progress reporting, or phase planning.

> **Precondition (hard stop):** every leaf-parent node has a phase plan. A
> milestone document generated before that is guesswork wearing a suit. If
> any leaf-parent lacks a phase plan, **stop and name the missing plans**
> instead of generating.

## Process

1. **Verify the precondition.** Walk the spec tree; every leaf-parent must
   have a `## Phase Plan` section. Missing plans: stop, list them, done.
2. **Take calibration.** Velocity comes from the latest progress report's
   calibrated rates. If no progress report exists yet (planning finished
   before implementation started), use the phase plans' assumed rate and a
   wider stated uncertainty band. Either way, the document states which of
   the two it used.
3. **Adopt, don't duplicate.** If a milestone document already exists, it
   is the current baseline: generation is only legal if none exists;
   otherwise you are here for a re-baseline (step 6). Never mint a second
   parallel milestone chain.
4. **Derive milestones from the dependency structure** — what becomes
   demonstrable when — not from the org chart or the node list. Each
   milestone gets:
   - a **demo**: something a stakeholder can watch work ("publish via API
     on staging and fetch the public page"), and
   - a **gate**: yes/no checkboxes, where "phase X done" always means:
     implemented, gate command green, verification doc merged to the spec
     repo's main branch.
5. **Compute the contingent tail.** Every phase marked
   `contingent (OQ-id)` on an external question lands in the tail: what it
   waits on, its entry criterion, its estimate — **excluded from the
   launch gate**, each with a pre-agreed degradation path stated in the
   document ("dashboard ships in 'coming soon' state; the tail ships
   post-launch — this is the plan, not a slip"). An externally-gated phase
   inside the launch gate is a generation error.
6. **Re-baseline (when triggered).** If the dates hold — the buffer
   absorbs the change — *absorb*: update gates, append to the change log,
   same file. If the dates move — *re-baseline*: a new dated document
   superseding the old **by exact filename**, with the old window and the
   new window both stated, so the slip is visible instead of silently
   renormalized. A re-baseline is a stakeholder event: report what
   changed, why, and what was decided (add people, cut scope, move the
   window) — and that decision lands in its governance artifact, not
   here.

## Document Shape (`management/YYYY-MM-DD-milestones.md`)

Required sections, in order:

- Header block: date, audience, `**Basis:**` (the progress report or
  assumed-rate statement), `**Supersedes:**` on re-baselines,
  `**Execution detail:**` link to the current plan.
- **How to read this** — demo/gate semantics, the slip tolerance (how many
  days a milestone may slip before it triggers anything), the launch
  window as a **base / optimistic / pessimistic** triple.
- **Milestones** — one section per milestone: demo, then gate checkboxes.
  An overview diagram (Mermaid) of the milestone sequence is recommended;
  if `mermaid-pastel-style` is installed, follow it.
- **Contingent tail** — the table from step 5 with degradation paths.
- **Tracking** — who ticks (the weekly checkpoint), the re-baseline
  trigger (a gate red across two consecutive checkpoints, or totals
  moved), and the single source of truth for "done".
- **Change log.**

## Quality Gates

- [ ] Precondition verified — or the run stopped naming the missing phase
      plans.
- [ ] Calibration source stated (progress report vs assumed rate + wider
      band).
- [ ] Every milestone has a watchable demo and yes/no gate checkboxes;
      "done" uses the pinned definition.
- [ ] Every externally-contingent phase is in the tail with a degradation
      path; none inside the launch gate.
- [ ] Launch window stated as base / optimistic / pessimistic.
- [ ] Re-baseline: old and new windows both stated; supersedes by exact
      filename; absorb-vs-re-baseline choice justified in the change log.
- [ ] No decision recorded here that is not also landed (or scheduled to
      land) in a governance artifact.
- [ ] No second milestone chain: an existing document was adopted or
      superseded, never duplicated.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Phase planning is nearly done — generate now" | Total scope is not computable from nearly. Stop and name the missing plans; a week early buys a document that lies. |
| "Milestone = backend complete" | Stakeholders can't watch "complete". Find the demonstrable slice the dependency structure makes available. |
| "This external phase is critical, keep it in the launch gate" | Its timing is not yours to promise. Tail it with a degradation path — that converts uncertainty into a decision already made. |
| "The dates moved a little, just update them" | Moved dates are a re-baseline: both windows stated, supersedes chain, stakeholder event. Silent renormalization hides the slip until it can't be managed. |
| "I'll tick the gates while I'm here" | Ticking is the checkpoint's step — one writer per rhythm. This skill runs at generation and re-baseline, nothing between. |
| "No progress report yet, so I'll guess a velocity" | Don't guess silently. Use the phase plans' assumed rate, widen the band, and say exactly which source the numbers came from. |
````

- [ ] **Step 2: Write `commands/hsdd-milestone.md`** with exactly this content:

```markdown
---
description: Generate or re-baseline the HSDD milestone document (stakeholder checkpoints)
---
Use the hsdd-milestone skill to generate or re-baseline milestones: $ARGUMENTS
```

- [ ] **Step 3: Verify anchors**

Run: `grep -c "Precondition (hard stop)\|watch\|degradation path\|exact filename" skills/hsdd-milestone/SKILL.md && grep -n "^## " skills/hsdd-milestone/SKILL.md`
Expected: count ≥ 5; sections include When to Use, Process, Document Shape, Quality Gates, Anti-Rationalization.

- [ ] **Step 4: Commit**

```bash
git add skills/hsdd-milestone commands/hsdd-milestone.md
git commit -m "feat(skills): hsdd-milestone — generation + re-baseline (v0.7 §4)"
```

---

### Task 3: OQ convention in `hsdd-spec` + conventions template

**Files:**
- Modify: `skills/hsdd-spec/SKILL.md` (after the Node Spec Template section, ~line 196; Quality Gates ~line 198; Anti-Rationalization table end ~line 228)
- Modify: `skills/hsdd-spec/templates/conventions.md` (Naming section ~line 27; new section after Naming; Layout section ~line 8)

**Interfaces:**
- Consumes: §5.1/§5.2 of the spec.
- Produces: the `## Open Questions (OQ)` skill section and conventions-template text that Tasks 4 and 6 reference; the id grammar `OQ{n}` / `OQ-{prefix}{n}` / `[inherits OQ{n}]` / `contingent (OQ-id)` used across all tasks.

- [ ] **Step 1: Add the OQ section to `skills/hsdd-spec/SKILL.md`.** Insert after the paragraph ending "empty contract lists render \"none\", not `[]`." (end of the Node Spec Template section) and before `## Quality Gates`:

````markdown
## Open Questions (OQ)

Decomposition surfaces questions nobody can answer yet. They are governance,
not margin notes — every spec carries a `## Open questions` section when any
exist (omit the section only when there are none):

- **Minting.** The root spec mints `OQ{n}`; node specs mint
  `OQ-{prefix}{n}`, prefixes declared in `conventions.md`. IDs are stable —
  never renumbered, never reused. Resolved entries keep their table row and
  detail subsection as audit trail; never delete them.
- **One definition home.** An OQ is defined exactly once, in the spec that
  owns the decision — the root for cross-cutting questions, the closest
  owning node otherwise. A child needing a local view mints its own ID
  marked `[inherits OQ{n}]`. Every other artifact — contracts, ADRs, phase
  plans, management documents — cites the ID only.
- **Format,** in the owning spec: a summary table
  `| ID | Question | Status | Waits on | Affects |`, then one
  `### {ID} — {title}` detail subsection per entry, so `grep {ID}` lands on
  the definition.
- **Status vocabulary:** `OPEN` · `PARTIAL` (residual named under *Waits
  on*) · `RESOLVED (date)` (row points at where the decision landed — an
  ADR, a contract, a spec `D{n}`). `ext:` under *Waits on* marks an
  external party.
````

- [ ] **Step 2: Wire the section into the document list and gates.** In the same file:

(a) Change the line

```markdown
A node spec document also carries: Overview, child-node table, the typed
dependency DAG (Mermaid), dev-flow sequencing, and a contract matrix.
```

to

```markdown
A node spec document also carries: Overview, child-node table, the typed
dependency DAG (Mermaid), dev-flow sequencing, a contract matrix, and — when
any exist — the `## Open questions` section (format below).
```

(b) Append to `## Quality Gates`:

```markdown
- [ ] Every open question is defined once, in its owning spec, with a table
      row and a `### {ID}` detail subsection; child views carry
      `[inherits …]`; no cited ID lacks a definition.
- [ ] OQ prefixes used by node specs are declared in `conventions.md`.
```

(c) Append to the `## Anti-Rationalization` table:

```markdown
| "I'll reference OQ-B3; the reader will know what I mean" | An ID with no definition home is a phantom — ungreppable, unresolvable, unbudgetable. Mint it in the owning spec first, then cite it. |
```

- [ ] **Step 3: Update `skills/hsdd-spec/templates/conventions.md`.**

(a) Append to the `## Naming` list:

```markdown
- Open question: root `OQ{n}`; node `OQ-{prefix}{n}` (declare prefixes here,
  e.g. `B` = backend, `F` = frontend); child view of a parent question:
  `[inherits OQ{n}]`
```

(b) Insert a new section after `## Naming`:

```markdown
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
```

(c) Append to the `## Layout (default)` section, after the OpenSpec line:

```markdown
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
```

- [ ] **Step 4: Verify**

Run: `grep -c "OQ-{prefix}{n}\|inherits OQ" skills/hsdd-spec/SKILL.md skills/hsdd-spec/templates/conventions.md`
Expected: ≥ 2 in each file.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-spec
git commit -m "feat(skills): OQ convention in hsdd-spec + conventions template; profile + management layout (v0.7 §5.2, §6)"
```

---

### Task 4: OQ anchors in `hsdd-phase-plan`, `hsdd-contract`, `hsdd-adr`, `hsdd-reconcile`

**Files:**
- Modify: `skills/hsdd-phase-plan/SKILL.md` (Governance Freeze template ~line 89; after the two-tier rule ~line 98; Phase Design Checklist ~line 262; Anti-Rationalization ~line 292)
- Modify: `skills/hsdd-contract/SKILL.md` (Quality Gates ~line 135; Anti-Rationalization ~line 146)
- Modify: `skills/hsdd-adr/SKILL.md` (Quality Gates ~line 156)
- Modify: `skills/hsdd-reconcile/SKILL.md` (Process ~line 40; Quality Gates ~line 92; Anti-Rationalization ~line 100)

**Interfaces:**
- Consumes: the id grammar from Task 3 (`OQ{n}`, `OQ-{prefix}{n}`, `contingent (OQ-id)`, status vocabulary).
- Produces: the contingency stop `hsdd-checkpoint`'s OQ-health check (Task 1) assumes exists.

- [ ] **Step 1: `hsdd-phase-plan` — contingency names its question.**

(a) In the Governance-updates template, change the line

```markdown
  - contingent phases: {phase ids that must not start until resolved, or none}
```

to

```markdown
  - contingent phases: {phase ids that must not start until resolved, or
    none} — each names the owning open question: `{phase-id} (OQ-…)`
```

(b) Insert after the "**Producer-side discoveries (`amend`).**" paragraph:

```markdown
**Contingency names its question (stop).** A phase whose start waits on an
unresolved question cites the OQ id — in its phase section (Scope or
Dependencies line, e.g. `contingent (OQ-B7)`) and in any `request` entry's
contingent-phases list. If the question has no minted ID, **stop**: the
owning spec mints it (`hsdd-spec` owns the format) before this plan builds
on it. An unnamed contingency is invisible to the checkpoint's health pass
and to the milestone document's contingent tail.
```

(c) Append to `## Phase Design Checklist`:

```markdown
- [ ] Every contingent phase names the OQ id it waits on; no contingency
      without a minted OQ.
```

(d) Append to the Anti-Rationalization table:

```markdown
| "The dependency is obvious, no need for an OQ id" | An unnamed contingency can't be tracked, tailed, or resolved. Name the OQ or stop and have the owning spec mint it. |
```

- [ ] **Step 2: `hsdd-contract` — cite-only.** Append to `## Quality Gates`:

```markdown
- [ ] Open questions are cited by ID only — never defined here; prose
      justifying behavior as "pending OQ-x" is swept when the OQ resolves
      (hsdd-reconcile).
```

and to the Anti-Rationalization table:

```markdown
| "I'll explain the open question inline so the contract is self-contained" | A second definition forks the question. Cite the ID; the owning spec carries the question, status, and resolution trail. |
```

- [ ] **Step 3: `hsdd-adr` — cite-only.** Append to `## Quality Gates`:

```markdown
- [ ] Open questions are cited by ID only; an ADR that resolves one names
      the ID in its Decision, and the owning spec's OQ row is updated to
      point at this ADR (RESOLVED (date)).
```

- [ ] **Step 4: `hsdd-reconcile` — the resolution sweep.**

(a) Add a numbered step at the end of `## Process` (after the registry-regeneration step, keeping the existing numbering sequence):

```markdown
N. **Sweep resolved questions.** When a drained entry (or a human
   arbitration during this run) resolves an open question: update the row
   and detail subsection in the owning spec (`RESOLVED (date)`, pointing at
   the landing artifact), then grep the OQ id across the tree — specs,
   contracts, ADRs, phase plans — and update every citation that still
   treats it as open (contingency markers, "pending OQ-x" prose). Report
   the swept locations.
```

(replace `N.` with the actual next number in the file's Process list).

(b) Append to `## Quality Gates`:

```markdown
- [ ] No artifact still cites a resolved OQ as open; sweep locations
      reported.
```

(c) Append to the Anti-Rationalization table:

```markdown
| "The OQ row says RESOLVED — done" | Citations elsewhere still gate phases on it and justify contract prose with it. Grep the id; sweep every stale citation. |
```

- [ ] **Step 5: Verify**

Run: `grep -l "OQ" skills/hsdd-phase-plan/SKILL.md skills/hsdd-contract/SKILL.md skills/hsdd-adr/SKILL.md skills/hsdd-reconcile/SKILL.md`
Expected: all four filenames printed.

- [ ] **Step 6: Commit**

```bash
git add skills/hsdd-phase-plan skills/hsdd-contract skills/hsdd-adr skills/hsdd-reconcile
git commit -m "feat(skills): OQ anchors — contingency stop, cite-only, resolution sweep (v0.7 §5.2)"
```

---

### Task 5: standalone-spec-repo profile in `hsdd-config`

**Files:**
- Modify: `skills/hsdd-config/SKILL.md` (Process step 1 ~line 41; Phase Context Switch ~line 140; Anti-Rationalization ~line 174)

**Interfaces:**
- Consumes: the profile declaration `Profile: standalone-spec-repo` defined in Task 3's conventions template.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Extend discovery.** In `## Process` step 1, after the sentence ending "(`Cargo.toml`, `package.json`).", append:

```markdown
   If `conventions.md` declares `Profile: standalone-spec-repo`, the HSDD
   tree is a separate spec repo mounted as a git submodule of this
   implementation repo: resolve every governance path through the submodule
   mount point (`{submodule}/spec/…`, `{submodule}/contract/…` — the spec
   repo root is the tree; there is no `hsdd/` prefix), and read
   `conventions.md` from the submodule.
```

- [ ] **Step 2: Add the pointer check to the phase switch.** In `## Phase Context Switch`, insert a new numbered step after the "Reconcile check" step (renumber the final "Do not touch…" step accordingly):

```markdown
7. **Profile check (standalone-spec-repo only).** Verify the submodule
   pointer references a spec-repo main commit. A pointer off main is stale
   or forked truth: stop and re-point the submodule to main (or get
   explicit human confirmation) before injecting any context through it.
```

- [ ] **Step 3: Append to the Anti-Rationalization table:**

```markdown
| "The submodule is a few commits behind; the context is probably fine" | A stale pointer injects governance that may have been amended or retracted on main. Bump the pointer first; it is one command. |
```

- [ ] **Step 4: Verify**

Run: `grep -c "standalone-spec-repo" skills/hsdd-config/SKILL.md`
Expected: ≥ 3.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-config
git commit -m "feat(skills): hsdd-config resolves governance through the spec-repo submodule (v0.7 §6)"
```

---

### Task 6: users guide — "Running the project" chapter

**Files:**
- Modify: `docs/users-guide.md` (insert the new section immediately before `## Tips`, ~line 563)

**Interfaces:**
- Consumes: skill names and document shapes from Tasks 1–2; the OQ grammar from Task 3.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Insert this section before `## Tips`:**

````markdown
## Running the project (v0.7)

Planning artifacts tell you what to build; the management layer tells you
how it is going. Once implementation starts, add a weekly rhythm:

1. **Weekly checkpoint** — before the team sync, run:

   > `/hsdd-checkpoint` full checkpoint before Monday's sync.

   One evidence pass over the spec repo and every implementation repo, then
   four outputs: a dated **progress report** (what is actually done — only
   phases with verification docs on main count — velocity, ranked blockers,
   a findings register), a dated **execution plan** superseding last week's
   (step tables with copy-paste prompts and validate lines, external
   tracks, append-only guardrails), a regenerated **atlas**
   (`management/atlas.md`: the tree with phase status, the contract graph,
   the ADR coverage map), and ticked **milestone gates**. Every finding
   becomes a plan step or an explicit waiver — the review compiles into
   next week's work; it never just advises.

2. **When new context lands mid-week** (a PRD revision, a design drop):

   > `/hsdd-checkpoint` scoped — new context in commit `abc1234` and
   > `def5678`; check spec integrity against it and revise the plan.

   The pass narrows to the touched artifacts plus their closure and patches
   the plan the same day, instead of letting drift accumulate to Friday.

3. **Milestones** — once every leaf-parent is phase-planned (total scope is
   first computable), generate the stakeholder document:

   > `/hsdd-milestone` generate the milestone document.

   Each milestone is a **demo** (something a stakeholder can watch work)
   plus a **gate** (yes/no checkboxes). Externally-gated phases go to the
   **contingent tail** — excluded from the launch gate, each with a
   pre-agreed degradation path, so an external team's silence is a plan,
   not a slip. The weekly checkpoint ticks the gates; `hsdd-milestone` runs
   again only to re-baseline (a gate red two checkpoints running, or a
   scope change the dates cannot absorb — then old and new windows are both
   stated, so slips stay visible).

**Open questions** get the same discipline as contracts: minted once in the
owning spec (`OQ{n}` at the root, `OQ-B3`-style in nodes, prefixes declared
in conventions.md) with a status table (`OPEN / PARTIAL / RESOLVED`);
everything else cites the ID. Phase plans mark contingent phases
`contingent (OQ-…)`; the milestone tail and the checkpoint's health pass
are built from those markers.

**Multi-repo projects** (backend and frontend in separate repos): keep the
HSDD tree in its own spec repo and mount it as a git submodule of each
implementation repo (`Profile: standalone-spec-repo` in conventions.md).
Four rules keep the truth unforked: submodule pointers only ever reference
spec-repo main; a phase is done when its verification doc is on spec-repo
main; branch pairs spanning two repos land or are discarded together; never
squash-merge a multi-phase epic (per-phase history is your velocity data).

**Adopting on an existing project:** the first `/hsdd-checkpoint` run is an
adoption run — existing management docs become the head of the chain,
existing guardrails keep their numbers, nonconformances become findings
with migration steps instead of errors, and the first atlas is generated
however messy the tree. Historical documents are never rewritten.
````

- [ ] **Step 2: Verify**

Run: `grep -n "Running the project (v0.7)" docs/users-guide.md && grep -c "hsdd-checkpoint\|hsdd-milestone" docs/users-guide.md`
Expected: section present before `## Tips`; count ≥ 5.

- [ ] **Step 3: Commit**

```bash
git add docs/users-guide.md
git commit -m "docs: users guide — Running the project (v0.7 management layer)"
```

---

### Task 7: README, CHANGELOG, vNext renumbering

**Files:**
- Modify: `README.md` (install comment ~line 104; skill-set table ~lines 121–130; Learn more list ~line 171+)
- Modify: `CHANGELOG.md` (under `## [Unreleased]`, ~line 9)
- Modify: `spec/hsdd-spec-vnext.md` (header lines 11–12)

**Interfaces:**
- Consumes: skill names/one-liners from Tasks 1–2.
- Produces: nothing later tasks consume.

- [ ] **Step 1: README.** (a) Change the install comment `# All six HSDD skills` to `# All eight HSDD skills`. (b) In the `## The skill set` table, append after the `hsdd-reconcile` row:

```markdown
| `hsdd-checkpoint` | Run the weekly (or context-triggered) evidence pass: progress report, revised execution plan, regenerated atlas, milestone gate ticks. One pass, four views; every finding becomes a plan step. |
| `hsdd-milestone` | Generate the stakeholder milestone document once all leaf-parents are phase-planned — demo + gate per checkpoint, contingent tail excluded from the launch gate — and re-baseline it when dates move. |
```

(c) In `## Learn more`, append after the last delta entry:

```markdown
- [v0.7 delta](spec/hsdd-spec-v0_7.md): the management layer — checkpoint and
  milestone skills, the open-question convention, and the standalone-spec-repo
  profile for multi-repo projects. Read against v0.6.1.
```

- [ ] **Step 2: CHANGELOG.** Under `## [Unreleased]`, add:

```markdown
Driven by the moka-microsite field deployment (2026-07-10 → 07-24: three
repos, two developers, 89 phases under v0.6.1). Delta spec:
`spec/hsdd-spec-v0_7.md`.

### Added

- The management layer: `management/` as a fourth artifact class (cite,
  never define) — dated progress reports, execution plans, and milestone
  documents chained by exact-filename supersedes links, plus a living
  regenerated `atlas.md`.
- `hsdd-checkpoint` (+ `/hsdd-checkpoint`): one evidence pass emitting all
  four views, full or scoped mode; findings→plan loop (every finding
  becomes a plan step or explicit waiver); first run on an existing
  project is an adoption run.
- `hsdd-milestone` (+ `/hsdd-milestone`): stakeholder milestone document —
  demo + gate per milestone, computed contingent tail excluded from the
  launch gate — generated once all leaf-parents are phase-planned;
  re-baselines on the slip or scope trigger with both windows stated.
- Open-question convention (from microsite-hsdd `699410e`): stable IDs
  (`OQ{n}` / `OQ-{prefix}{n}`), one definition home, status table
  (`OPEN / PARTIAL / RESOLVED`), structural anchors in hsdd-spec
  (templates + minting), hsdd-phase-plan (contingency-names-its-question
  stop), hsdd-contract / hsdd-adr (cite-only), hsdd-reconcile (resolution
  sweep).
- Standalone-spec-repo profile: HSDD tree as its own repo, submoduled into
  each implementation repo; four incident-backed rules (pointers to main
  only, verify-doc-on-main = done, atomic branch pairs, no squash-merged
  epics).

### Changed

- The vNext mechanization draft renumbers from 0.7.0 candidate to 0.8
  candidate; v0.7 is additive over v0.6.1 by contract (spec §7.1), with
  microsite-hsdd as the acceptance fixture (§7.3).
```

- [ ] **Step 3: vNext renumbering.** In `spec/hsdd-spec-vnext.md`, change

```markdown
**Version:** vNext (undecided; 0.7.0 candidate)
```

to

```markdown
**Version:** vNext (undecided; 0.8.0 candidate — renumbered by v0.7, see
`spec/hsdd-spec-v0_7.md` §8.3)
```

- [ ] **Step 4: Verify**

Run: `grep -c "hsdd-checkpoint\|hsdd-milestone" README.md && grep -n "0.8.0 candidate" spec/hsdd-spec-vnext.md`
Expected: README count ≥ 2; vNext header matched.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md spec/hsdd-spec-vnext.md
git commit -m "docs: README + CHANGELOG for v0.7; vNext renumbers to 0.8 candidate"
```

---

### Task 8: acceptance run against microsite-hsdd (§7.3) — human-in-the-loop

**Files:**
- Create: `review/hsdd-v0_7-acceptance-microsite.md` (in this repo, after the run)
- External (user's live project, written only with the user present): `~/git/microsite-hsdd/management/*`

**Interfaces:**
- Consumes: everything from Tasks 1–5, installed into microsite-hsdd.
- Produces: the acceptance verdict; v0.7 is not done until this passes.

⚠️ This task writes into the user's live project repo. Run it interactively with the user, not from a subagent.

- [ ] **Step 1: Write the expected-findings list BEFORE the run** into `review/hsdd-v0_7-acceptance-microsite.md` (spec §11.6 — the list precedes the run so the run cannot grade its own homework). Seed it with the findings §7.3 names, re-verified against the repo's current state at run time:

```markdown
# v0.7 acceptance — microsite-hsdd adoption run

## Expected findings (written before the run; re-verify each still exists)

1. Dangling supersedes link: `management/2026-07-24-hsdd-execution-plan.md`
   line 3 links `hsdd-execution-plan.md` — the file is
   `2026-07-17-hsdd-execution-plan.md` (three more dangling anchors: lines
   13, 83, 320).
2. Missing atlas: no `management/atlas.md`.
3. Blank sign-offs: common.2/common.3 reviewer fields; common.3 disposition
   line (per the 07-24 progress report §4.1 — confirm still unfilled).
4. Stale pending-OQ prose (R8-bis class): `contract/be-analytics-api.md`
   and `contract/analytics-query.md` justify absent dismiss/snooze as
   "pending OQ-F6"; OQ-F6 resolved 2026-07-21/22.
5. Submodule pointer drift: BE main's hsdd pointer (unreachable lineage)
   and FE's stale pointer (per 07-24 progress §4.1 — re-verify).
6. Guardrails 1–12 imported from the 07-24 plan under their numbers.

## Pass criteria

- Findings register ⊇ every expected finding still present at run time.
- New plan supersedes `2026-07-24-hsdd-execution-plan.md` by exact filename.
- `atlas.md` generated with all three parts; no diagram > ~20 nodes.
- `git status` in microsite-hsdd shows changes under `management/` only.
- No historical dated document modified.
- `/hsdd-milestone` recognizes `2026-07-24-milestones.md` as the baseline
  and does NOT mint a duplicate (no re-baseline unless a trigger fires).
- FAIL if the checkpoint runs clean: a clean run on a repo known to
  contain findings fails acceptance in the more important direction.
```

- [ ] **Step 2: Install the v0.7 skills into microsite-hsdd** (with the user: their `skills-lock.json` pins versions — update via their usual `npx skills add` flow pointing at this repo/branch).

- [ ] **Step 3: Run the adoption checkpoint** in `~/git/microsite-hsdd`:

Run: `/hsdd-checkpoint` full checkpoint — first run on this project (adoption).
Expected: four outputs under `management/`; findings register covering the expected list.

- [ ] **Step 4: Run the milestone adoption check:**

Run: `/hsdd-milestone` — verify baseline recognition.
Expected: reports `2026-07-24-milestones.md` as the current baseline; no new file.

- [ ] **Step 5: Record the verdict** in `review/hsdd-v0_7-acceptance-microsite.md` (per-finding caught/missed table, deviations, verdict), then commit:

```bash
git add review/hsdd-v0_7-acceptance-microsite.md
git commit -m "review: v0.7 acceptance run against microsite-hsdd (spec §7.3)"
```

---

## Self-review notes

- **Spec coverage:** §2 → Tasks 1 (shapes) + 6 (guide); §3 → Task 1; §4 → Task 2; §5 → Tasks 3–4; §6 → Tasks 3(c)/5; §7 → Task 1 (adoption section) + Task 8; §8 → Tasks 7 + 1–2 (commands); §11.1–.7 → Tasks 1, 2, 3–4, 5, 6, 8, 7 respectively.
- **Deliberately out of scope:** no changes to `hsdd-phase.md` command (phase switch semantics unchanged); no CLI/lint (0.8, spec §10).
- **Type consistency check:** filenames (`YYYY-MM-DD-progress.md`, `-execution-plan.md`, `-milestones.md`, `atlas.md`), the profile declaration (`Profile: standalone-spec-repo`), the contingency marker (`contingent (OQ-id)`), and the done definition are identical across Tasks 1, 2, 3, 4, 6.
