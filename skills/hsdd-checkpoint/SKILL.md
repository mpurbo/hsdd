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
