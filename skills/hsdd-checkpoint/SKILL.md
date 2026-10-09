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

`management/` sits beside `spec/`, `contract/`, `adr/` at the HSDD root, so
from a session's working directory it is `hsdd/management/` — in a
single-repo project and under the standalone-spec-repo profile alike (there
the submodule mounts at `hsdd/`, which is why no path changes).
Point-in-time documents are dated and chained; the atlas is living:

- `hsdd/management/YYYY-MM-DD-progress.md` — this skill writes it
- `hsdd/management/YYYY-MM-DD-execution-plan.md` — this skill writes it
- `hsdd/management/YYYY-MM-DD-milestones.md` — `hsdd-milestone` writes it; this
  skill ticks its gates
- `hsdd/management/atlas.md` — this skill regenerates it whole

Chain rules (enforced here, checked every pass):

- Every dated doc carries `**Supersedes:**` linking the previous doc of its
  kind **by exact filename**, `**Companion docs:**` (same-date siblings), and a
  `## Change log`. Documents produced by an evidence pass — the progress report
  and the execution plan — also carry `**Repo baselines:**` (spec repo SHA,
  every implementation repo SHA, and each repo's submodule pointer under the
  standalone-spec-repo profile). A milestone document instead names the progress
  report it drew its numbers from in `**Basis:**`; it reviews no repo, so it
  states no SHAs of its own.
- After publication a dated doc accepts exactly two in-place edits: ticking
  its own checkboxes and appending to its change log. Anything more is a new
  superseding document. **Historical documents are never rewritten.**

## Where This Runs, and What It Needs

Run from an **implementation repo** — governance is at `hsdd/`, and the
code-vs-plan pass needs the code, `openspec/`, `hsdd-context/`, and the gates. Under the
standalone-spec-repo profile this is a rule, not a preference: never run
from a standalone clone of the spec repo (see conventions.md).

The evidence pass spans **every** implementation repo, and only one of them
is your working directory. **Take the sibling repos' paths from the
invoking prompt; if they are absent, ask for them and stop** — repo
locations differ per machine, so they are session input, never a
checked-in list. A pass that silently reviews only the repo it happens to
be standing in produces a progress report that undercounts the project.

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
     links resolve by exact filename; baselines present on the progress
     report and execution plan; a milestone document names its Basis); and
     any unresolved conformance finding parked in the milestone document's
     change log since the last checkpoint — `hsdd-milestone` has no plan of
     its own to write into, so it leaves findings there for this pass to
     fold into the register.
   - *Code vs plan (each implementation repo):* which phases the code
     actually completes versus what plans and the prior progress report
     claim; contract-surface drift in both directions (code behavior the
     contract does not promise, contract promises the code abandoned);
     scope creep (code with no phase). Also audit the profile's history
     rules: a branch pair spanning this repo and the spec repo that landed
     (or was deleted) on one side only, and any multi-phase epic
     squash-merged into a single commit — the latter destroys the per-phase
     history the velocity numbers are computed from, so flag it the week it
     happens, when the branch may still exist.
3. **Emit the progress report** (shape below). The only admissible "done"
   is: implemented, gate command green, verification doc merged to the spec
   repo's main branch. Claims without a verification doc are reported as
   claims.

   If `hsdd/summary/` exists, run `node hsdd/scripts/summary/summary.mjs
   check` and list the plan page, if it is stale, and the plan page's stale
   prose entries on the report's `**Stale summaries:**` header line (`none`
   when they are fresh). Leave the checkpoint page and its prose off the line:
   this run re-renders them at step 7. If `hsdd/scripts/summary/` is missing,
   run `hsdd-summary`'s Setup first. They are information only: never a
   findings-register entry, never a plan step, never a gate.
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
   to `hsdd-milestone` — do not re-baseline here. Record the resulting gate
   status in the progress report's Milestone gate status section, and
   compare it against the previous report's — two consecutive reds fire the
   trigger.
7. **Render the checkpoint page (only when `hsdd/summary/` exists).** Invoke
   `hsdd-summary` and follow its Process (checkpoint page) over the documents
   this run just wrote. If the page reports a Plan integrity finding (a
   finding with no step and no waiver, a step with no detail block, a
   Depends entry that resolves to nothing, a decision defined twice), this
   run's own quality gate failed: fix the new plan, then render again. A
   project without `hsdd/summary/` skips this step entirely and runs no
   `hsdd-summary` script.
8. **Report** with the same discipline the pass audits: what was written,
   what could not be verified, and where the decisions are recorded. Never a
   silent green.

   **Decisions are written, not asked.** Every choice this pass surfaced
   belongs in the execution plan as a step with an owner and the sync that
   will settle it (proposed guardrails marked *proposed*, contested findings
   marked as decisions). The closing report *points at* those steps — it does
   not open a decision queue in the session. A checkpoint is run days before
   the sync precisely so a human can take the plan to the team and decide
   there, with the people affected. Ending the run by asking the operator to
   adjudicate findings converts a written agenda back into an interactive
   interrogation, and whatever they answer alone is a decision the team never
   saw.
9. **Land the output.** Commit the `hsdd/management/` changes, and
   `hsdd/summary/` when step 7 ran, in the same commit. Under the
   standalone-spec-repo profile, commit and push them **inside the submodule**
   to spec-repo main, then bump every implementation repo's pointer to that
   commit — including the repos you did not run from. Skipping the bump for the
   other repos is precisely how step 1's finding gets manufactured; do it now,
   not next week.

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
- **A missing milestone document is normal at adoption**, not a finding: tick
  nothing, note in the progress report that no milestone baseline exists, and
  recommend `hsdd-milestone` once every leaf-parent is phase-planned.

## Document Shapes

### Progress report (`hsdd/management/YYYY-MM-DD-progress.md`)

Required sections, in order:

- Header block: date, `**Supersedes:**` (previous progress report, exact
  filename), `**Repo baselines:**`, `**Companion docs:**`, `**Method:**` (one
  line: which repos were reviewed, against what). When `hsdd/summary/`
  exists, an optional `**Stale summaries:**` line (step 3).
- **Bottom line** — one table: phases planned / code-complete / remaining
  (externally-contingent count broken out), implementation progress %,
  observed velocity per lane (PE/manday), calibrated remaining effort,
  calendar outlook.
- **Milestone gate status** — one row per milestone: gate items met / total,
  and each unmet item with the phase or external answer it waits on. This is
  the persisted input for the re-baseline slip trigger: comparing this section
  against the previous progress report is how "red across two consecutive
  checkpoints" becomes checkable rather than remembered.
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

### Execution plan (`hsdd/management/YYYY-MM-DD-execution-plan.md`)

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
  integration syncs: one row per sync (when, who, a one-line agenda),
  linking to the sync's section where it has one.
- **Plan graph** — one Mermaid flowchart of the plan ahead: every
  load-bearing sync as a junction node, every step batch as a node inside
  its lane's subgraph, edges from the Depends column and the sync
  sections' *Unblocks* lines. Derived from the tables the way the atlas
  is derived from the artifacts: regenerated whole with every plan, and
  when graph and tables disagree, the tables are right — regenerate the
  graph. The atlas's ~20-node ceiling applies: chart batches, never
  individual phases. Follow `mermaid-pastel-style` if installed. Scoped
  runs get no exemption — a scoped checkpoint still supersedes the whole
  plan.
- **Sync sections** — one per **load-bearing** sync (a sync any step,
  decision, or lane start depends on; the standing weekly is exempt — it
  has a rhythm, not a gate), carrying: **Entry** (checkboxes: what must
  be done or brought before the sync, citing step IDs); **Agenda** (the
  decisions the sync settles, defined here once — stable ID, question,
  live options, and the governance artifact the answer must land in);
  **Exit** (checkboxes: the sync is discharged when every box ticks; a
  decision's box names its landing artifact); **Unblocks** (one line per
  lane: what starts when the sync exits). Steps, tracks, and other syncs
  cite the agenda's decisions by ID; a step's Depends column may name a
  sync only if that sync has a section. The agenda defines the
  *question* — the *answer* still lands in its governance artifact
  (cite, never define).
- **Step tables** — stable step IDs, owner, action, dependency, done
  checkbox.
- **Step details** — every step in every step table gets exactly one
  detail block, keyed by step ID. For 🤖/🤝 steps: the exact
  `/<skill> …` prompt to paste and a *Validate:* line naming the
  observable outcome to check by hand — required, not decorative; this is
  what makes the plan executable by someone other than its author. For
  👤 steps: a **briefing** — *Why:* (one or two sentences; finding IDs
  cited in parentheses after the fact they justify, never as the
  subject), *Do:* (a checklist, one checkbox per action, each naming its
  concrete target — file, branch, field, person), *Done when:* (one
  observable line, the human analogue of *Validate:*). The human is the
  one executor who cannot be re-prompted; the block is what they execute
  from. The table cell holds a one-sentence summary — the cell indexes,
  the block instructs; a cell that needs a second sentence, a
  semicolon-chained list, or more than two parenthetical citations has
  outgrown the table.
- **External tracks** — `E{n}` table: owner, status, what happens on
  answer, which contingent phases it gates (by OQ id).
- **Timeline** — weeks × lanes, aligned to the milestone document.
- **Guardrails** — append-only numbered rules; a lesson learned becomes
  the next number; never renumber or delete.
- **Change log.**

### Atlas (`hsdd/management/atlas.md`)

**Undated on purpose, and therefore stamped.** The atlas is the one living
management file: every checkpoint overwrites it whole. It carries no date in
its filename because it is derived state, like a generated `INDEX.md` — a
dated series would leave a shelf of stale views with no way to tell which one
is true, and would invite hand-patching the newest instead of regenerating it.
Its history is git's: `git log -p -- hsdd/management/atlas.md` for the
progression, `git show <sha>:hsdd/management/atlas.md` for any past state.

Because the filename carries no date, the **header must**, and it is required,
not decorative — an atlas with no stamp cannot be told apart from one three
weeks stale:

```markdown
**Generated:** {YYYY-MM-DD} by `hsdd-checkpoint`. Regenerated whole at every
checkpoint; never hand-patched.
**Derived from:** `hsdd/spec/` + `hsdd/contract/` + `hsdd/adr/` at spec-repo
{sha} · `hsdd/verify/` for **done** · each implementation repo's
`openspec/changes/` and `hsdd-context/` for **in-progress** ·
{repo}@{sha} for every implementation repo.
If this file disagrees with those artifacts, this file is wrong — regenerate it.
```

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

The atlas is **derived only**: every element must be reconstructible from the
artifacts — `hsdd/spec/`, `hsdd/contract/`, `hsdd/adr/` for the tree, contracts,
and ADR coverage; `hsdd/verify/` for `done` (the pinned definition: a
verification doc merged to spec-repo main); each implementation repo's `openspec/changes/` and `hsdd-context/` for `in-progress` (a phase with either and no verification doc on spec-repo main). Never derive `done` from spec prose, because prose carries claims, and separating claims from evidence is what this pass
exists to do. If it disagrees with the
artifacts, the atlas is wrong by definition; the fix is regeneration. If
`mermaid-pastel-style` is installed, follow it for all diagrams.

## Read-Only Toward Governance

Checkpoint *finds* the stale ADR note, the undrained reconcile section,
the contract drift — it does not fix them. Fixes become plan steps routed
to the owning skill and the owning human. The only files this skill
writes live under `hsdd/management/`, plus `hsdd/summary/` through
`hsdd-summary` when that directory exists (step 7).

## Quality Gates

- [ ] Baselines pinned before any content conclusion; submodule pointers
      audited under the profile.
- [ ] Every findings-register row has a plan step or an explicit waiver —
      diff register against plan, nothing orphaned.
- [ ] "Done" claims verified against verification docs on main; claims
      without docs reported as claims.
- [ ] In-progress read from both `openspec/changes/` and `hsdd-context/` in
      every implementation repo; a phase with either and no verification
      doc on main is in-progress, never done.
- [ ] New plan supersedes the previous plan by exact filename; baselines
      and companion links present in every emitted doc.
- [ ] Guardrails imported/extended append-only; proposals marked as
      proposals.
- [ ] Every step in every step table has exactly one detail block — a
      prompt + *Validate:* for 🤖/🤝, a *Why / Do / Done when* briefing
      for 👤. No step's content lives only in its table cell.
- [ ] No Action cell in a step table carries more than one sentence.
- [ ] Plan graph present and consistent with the tables: every
      load-bearing sync and every step batch appears exactly once, every
      edge traces to a Depends entry or an *Unblocks* line, and the graph
      stays under ~20 nodes.
- [ ] Every load-bearing sync has a section with Entry / Agenda / Exit /
      Unblocks; no step depends on a sync that has no section.
- [ ] Every decision queued for a sync is defined once, in that sync's
      Agenda, and only cited everywhere else.
- [ ] Atlas regenerated whole; no diagram over ~20 nodes; every element
      greppable back to a source artifact.
- [ ] Atlas carries its `Generated:` date and `Derived from:` baselines —
      the filename has no date, so the header must.
- [ ] Milestone gates ticked; re-baseline trigger evaluated and reported.
- [ ] No file outside `hsdd/management/` modified, except `hsdd/summary/`
      through step 7.
- [ ] When `hsdd/summary/` exists: the Stale summaries line is filled, the
      checkpoint page rendered with no Plan integrity finding, and it landed
      with the management documents. When it does not exist: no
      `hsdd-summary` script ran.
- [ ] Every implementation repo was reviewed — paths taken from the prompt,
      or asked for when absent; none silently skipped.
- [ ] Every decision this pass surfaced is a plan step with an owner and a
      sync — not a question put to the operator at the end of the run.
- [ ] OQ health verified: every cited id defined exactly once, statuses
      coherent, no stale pending-prose on resolved questions.
- [ ] Profile history rules audited: no one-sided branch pair, no
      squash-merged multi-phase epic (or both reported as findings).
- [ ] Output landed: management changes committed (and, under the profile,
      pushed inside the submodule with every repo's pointer bumped).

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
| "I found something contested — I'll ask the operator to decide before I finish" | The plan is the decision's home and the sync is its venue. Write the step, name the owner, and point at it. A decision extracted from whoever happened to run the checkpoint is one the team never saw. |
| "The other repo's path wasn't given; I'll review what I can see" | A report that counts one lane of a two-lane project is wrong, not partial. Ask for the paths and stop until you have them. |
| "I'll run this in the spec repo — that's where the documents go" | The spec repo has no code, no openspec, no gates, and editing a standalone clone strands every submodule pointer. Run from an implementation repo; the tree is at `hsdd/`. |
| "The milestone gate is red again — I'll adjust the dates" | Two consecutive reds fire the re-baseline trigger, which belongs to hsdd-milestone and the stakeholders. Tick, report, hand off. |
| "The table cell already says everything the briefing would" | Then the cell is unreadable, which is the defect. The agent running a 🤖 step can be re-prompted mid-task; the human running a 👤 step has only what the plan gave them. The cell indexes, the block instructs. |
| "The Depends column already encodes the graph" | Rows are read one at a time; parallelism and funnels are shapes, invisible until drawn. The first thing the field asked for back was the diagram. Derive it from the tables and draw it. |
| "The sync has an agenda row in the table — that's the checklist" | An agenda names topics; a gate needs entry criteria, exit criteria, and what they unblock. Steps depend on this sync: if nothing defines its discharge, every one of them inherits an undefined dependency. |
| "The checkpoint page shows a Plan integrity finding; I'll mention it in the report" | It is this run's own quality gate failing, read back by a script. Fix the plan, render again, then land. |
