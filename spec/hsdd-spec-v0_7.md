# HSDD: Hierarchical Spec-Driven Development (v0.7 delta)

> Delta specification. It adds the **management layer** — a fourth artifact
> class for running an HSDD project week over week: progress reports,
> execution plans, milestone documents, and a generated atlas, produced by
> two new skills (`hsdd-checkpoint`, `hsdd-milestone`); absorbs the
> field-proven **open-question convention** into the templates and skills;
> and codifies the **standalone-spec-repo profile** for projects with more
> than one implementation repository. Read it against v0.6.1; only the
> changes are stated here. Everything in v0.3–v0.6.1 not touched below
> still stands, and every v0.6.1-conformant artifact remains valid — the
> delta is additive by contract (§7).

**Version:** 0.7.0 (draft)
**Status:** For review
**Date:** 2026-07-26
**Author:** Purbo Mohamad
**Drafted from:** the moka-microsite field deployment (2026-07-10 →
2026-07-24: `microsite-hsdd` as a standalone spec repo, submoduled into
`microsite-be` and `microsite-fe`; 13 nodes, 89 phases, 24 contracts, 18
ADRs, two developers, running the v0.6.1 skills). Primary evidence: the
management documents `management/2026-07-17-*` and `management/2026-07-24-*`
in microsite-hsdd, and its open-question normalization commit `699410e`.
**Supersedes (in part):** nothing structural in v0.3–v0.6.1. The vNext
mechanization draft (`spec/hsdd-spec-vnext.md`) surrenders the 0.7.0 slot it
was a candidate for and renumbers to **0.8 candidate**; where the two
overlap, §8.3 states the relationship.

---

## 1. What 0.7 Changes and Why

Every release so far hardened the *artifact* pipeline: decomposition (0.3),
parallel-safe governance (0.4.2), one root (0.5), proportional ceremony and
the execution branch protocol (0.6), structural anchors and source
provenance (0.6.1). Two weeks of running that pipeline on a real project —
multiple developers, multiple repos, external teams that could not stabilize
their contracts on our schedule, product context that kept arriving
mid-flight — exposed the layer none of those releases specified: **how to
run the project**. Three observations, all of the same shape:

1. **Stale specs entangled the team, and reconcile alone could not untangle
   them.** When external contracts stayed provisional and new context (a PRD
   revision, a design drop, a stack decision) landed mid-flight, the
   generated specs drifted and the team could no longer see the best way
   forward. `hsdd-reconcile` repairs artifacts one entry at a time; what
   actually restored coherence was a manually-prompted *comprehensive
   review* of all repos against the incoming context, compiled into a
   forward plan for the week — sync agenda, revised steps, copy-paste
   prompts. Done twice (07-17, 07-24), it converged on a stable document
   shape and a weekly rhythm.

2. **Open questions rotted without a convention.** Specs referenced IDs that
   were never defined anywhere (`OQ-B3`), and whether a question was
   blocked, partially answered, or resolved could not be read off the page.
   A manual cleanup pass (`699410e`: 30 IDs normalized across four owning
   specs plus conventions.md) produced a convention that works — stable IDs,
   one definition home, a status table, an audit trail — but it lives in one
   project's conventions.md, not in the methodology.

3. **Stakeholder communication had no artifact.** Progress percentages,
   velocity, milestone checkpoints, risk posture — all had to be invented by
   manual prompting. They too converged on stable shapes: a milestone
   document (demo + gate per checkpoint, a contingent tail excluded from the
   launch gate) and a progress report (evidence, calibration, ranked
   blockers, a findings register).

In v0.6.1's terms these are all **unpinned behaviors**: the good runs
produced the microsite management documents, but nothing in the skill set
says those documents should exist, when they are produced, or what shape
they take. The same prompt on a different day — or from a different team
member — produces a different document or none. 0.7 pins the layer the same
way 0.6.1 pinned provenance: required shapes, named triggers, and skills
that own the behavior.

One structural insight shapes the packaging. The progress report, the
revised execution plan, the milestone gate ticks, and the bird's-eye atlas
are four **views over one expensive evidence pass** — the full review of the
spec repo and every implementation repo. Splitting them into one skill per
document would re-run that pass (or couple the skills through half-shared
state). So one skill runs the pass and emits every view (`hsdd-checkpoint`,
§3), and only milestone *generation* — which has a different trigger and a
different audience — stands alone (`hsdd-milestone`, §4).

The changes:

1. **The management layer** (§2): a fourth artifact class, `management/`,
   with required document shapes and one invariant — cite, never define.
2. **`hsdd-checkpoint`** (§3): the weekly (or context-triggered) evidence
   pass and its four emitted views.
3. **`hsdd-milestone`** (§4): milestone generation and re-baselining.
4. **The open-question convention** (§5): absorbed from the field, anchored
   structurally in the skills that touch it.
5. **The standalone-spec-repo profile** (§6): the multi-repo layout,
   submodule rules included.
6. **Compatibility and adoption** (§7): additive-only contract; first-run
   adoption on existing v0.6.1 projects.

---

## 2. The Management Layer

### 2.1 A fourth artifact class

`management/` joins `spec/`, `contract/`, and `adr/` at the HSDD root. It
holds the documents that run the project: progress reports, execution plans,
milestone documents, and the atlas.

Its defining invariant, the same single-source-of-truth discipline the
open-question convention applies (§5):

> **Management documents cite, never define.** Nothing in `management/` is
> normative. No open question is defined there, no contract semantic, no
> decision, no phase content. A decision minuted in an execution plan or a
> sync agenda **must land in its proper governance artifact** — a spec
> `D{n}`, an ADR, a contract amendment — or it does not exist; the
> management document links to where it landed.

The field precedent is the microsite R6 pattern: the wizard decisions were
*scheduled* in the execution plan but *recorded* in the setup-wizard spec.
The rule makes the management layer disposable-by-construction: deleting
`management/` loses navigation, velocity history, and stakeholder
communication — never truth.

### 2.2 The document chain

Point-in-time documents — progress reports, execution plans, milestone
documents — are dated files:

```
management/YYYY-MM-DD-progress.md
management/YYYY-MM-DD-execution-plan.md
management/YYYY-MM-DD-milestones.md
```

- Each carries a `**Supersedes:**` header linking the previous document of
  its kind **by exact filename**, forming an unbroken audit chain. (The
  field showed why "by exact filename" must be said: the 07-24 microsite
  plan's supersedes link points at `hsdd-execution-plan.md`, a file that no
  longer exists under that name.)
- Documents produced by an evidence pass (progress report, execution plan)
  carry a `**Repo baselines:**` header pinning the commit SHA of the spec repo
  and every implementation repo (including, under the §6 profile, each
  implementation repo's submodule pointer) — the review is meaningless without
  knowing what it reviewed. A milestone document does not review repos: it
  inherits its baselines from the progress report named in its `**Basis:**`
  header, and must not restate SHAs it did not verify.
- Each carries a `**Companion docs:**` header linking its same-date
  siblings, and a `## Change log` section.
- After publication, a dated document accepts exactly two kinds of in-place
  edit: **ticking** its own checkboxes (step `Done` boxes, milestone gates) and
  **appending** to its change log. Anything more is a new superseding document.
  One named exception: a milestone document is a living checkpoint tracker, so
  an *absorbed* scope change (§4.2 — totals moved, dates held) may also update
  its gate contents in place, with a change-log entry saying what moved and why
  the window still holds. A change that moves the dates is never absorbed; it
  is a re-baseline, and re-baselines supersede. Progress reports and execution
  plans have no such exception. Historical documents are never rewritten.

The **atlas** is the exception: a single living file, `management/atlas.md`,
regenerated in full on every checkpoint and overwritten each time. It is pure
derived state — its history is git's job, not a filename's
(`git log -p -- management/atlas.md`). A dated series would leave a shelf of
stale views with no way to tell which is true, and would invite patching the
newest by hand instead of regenerating it — the failure the whole-file rule
exists to prevent. **Because the filename carries no date, the header must**:
every atlas states the date it was generated and the artifact baselines it was
derived from (§2.6). An unstamped atlas cannot be distinguished from a
three-week-stale one, which is the only way this file can lie.

### 2.3 The progress report

The evidence view. Audience: the team, and the other two documents — the
execution plan and the milestone document take their numbers from here, not
from independent counting. Required sections:

- **Header block:** date, `**Supersedes:**` (the previous progress report, by
  exact filename), `**Repo baselines:**`, `**Companion docs:**`, and
  `**Method:**` — one line naming what was actually reviewed (which repos,
  against what).
- **Bottom line** — one table: phases planned / code-complete / remaining
  (with the externally-contingent count broken out), implementation
  progress %, observed velocity per lane, calibrated remaining effort,
  calendar outlook. A stakeholder who reads nothing else reads this.
- **Milestone gate status** — one row per milestone (gate items met / total,
  each unmet item's blocker); this is the persisted input the re-baseline
  slip trigger reads to make "red across two consecutive checkpoints"
  checkable.
- **What is done** — per node, **with evidence**. The only admissible
  "done" is v0.6's definition made checkable: *the phase's verification
  document is merged to the spec repo's main branch.* Claims without a
  verification doc are reported as claims, not as done.
- **Velocity** — observed rate per lane in PE per manday, then the
  *calibrated* rate with its caveats stated (early phases are light;
  review, not generation, is the bottleneck; no scaling assumptions beyond
  current staffing). Calibration here supersedes any earlier estimation
  document — the ad-hoc PE-estimation doc the field produced is exactly
  this section, done once and then orphaned.
- **Blockers** — ranked by urgency, each with what it blocks and its repair.
- **Findings register** — every defect the evidence pass found (governance
  integrity, code-vs-plan drift, hygiene), with severity. This section has
  a consumer contract: see §2.7.
- **Verdict** — a short honest paragraph: is the method working, what is
  the real threat. (The field's example: "the threats are not velocity but
  coherence.")

### 2.4 The execution plan

The operational view. Audience: the people driving AI sessions this week.
Required sections:

- **Header block:** created date, supersedes link, repo baselines,
  companion docs.
- **Operating model preamble** — who executes (the lanes), where prompts
  run (which repo, which session), and a pointer to the delegation guide
  (which prior plans may carry by reference).
- **Current state** — the delta since the superseded plan, in plan terms
  ("B2 done; scope grew by N phases via ADR-x; new since last plan: …").
- **Ownership split** — one table: nodes per lane, contracts per lane
  (single-writer, per v0.4.2), external tracks per lane.
- **Sync points** — the standing weekly plus any named consolidation or
  integration syncs, each with when, who, agenda.
- **Step tables** — per sync or lane batch: stable step IDs (the field's
  `R1`/`B2'`/`F3'` scheme), owner, action, dependency, done checkbox.
- **Copy-paste prompts with validation** — for every delegable step: the
  exact `/<skill> …` prompt to paste, the marker
  **🤖 delegate / 🤝 interactive / 👤 human-only**, and a *Validate:* line
  naming the observable outcome to check by hand. This is the section that
  makes the plan executable by someone other than its author, and it is
  required, not decorative.
- **External tracks** — the `E{n}` table: owner, current status, what
  happens on answer, which contingent phases it gates (by OQ ID, §5).
- **Timeline** — weeks × lanes, aligned to the milestone document's
  checkpoints.
- **Guardrails** — an append-only numbered rule list. Rules are never
  renumbered or deleted; a lesson learned this week becomes the next
  number. (The field's rules 9–12 — squash-merge ban, verify-doc-on-main,
  submodule pointers, coordinated branch pairs — generalize into the §6
  profile; project-specific rules stay here.)
- **Change log.**

### 2.5 The milestone document

The stakeholder view. Required structure:

- **How to read this** — demo/gate semantics, the slip tolerance (how many
  days a milestone may slip before it triggers anything), and the launch
  window as a **base / optimistic / pessimistic** triple.
- **Milestones** — each one has:
  - a **demo**: something a stakeholder can *watch work*. Not "module X
    complete" — "publish a microsite via API on staging and fetch the
    public page". If a milestone has no demo, it is not a milestone; find
    the demonstrable slice.
  - a **gate**: measurable yes/no checkboxes. "Phase X done" always means
    the pinned definition: implemented, gate command green, verification
    doc merged to spec-repo main.
- **Contingent tail** — externally-gated work listed with what it waits on,
  its entry criterion, and its estimate, **deliberately excluded from the
  launch gate**, each with a pre-agreed degradation path stated in the
  document ("dashboard ships in 'coming soon' state; the tail ships
  post-launch — this is the plan, not a slip"). This section is the risk
  register's schedule face: it converts external uncertainty from a threat
  into a decision already made.
- **Tracking** — who ticks the gates and when (the weekly checkpoint, §3),
  and the re-baseline trigger (§4.2).
- **Change log.**

### 2.6 The atlas

The bird's-eye view, `management/atlas.md`, regenerated by every checkpoint.

Every atlas opens with a required stamp — a `Generated:` line (date and the
skill that wrote it) and a `Derived from:` line naming the spec-repo commit
and every implementation repo commit the view was built from — followed by the
statement that if the file disagrees with those artifacts, the file is wrong.
The stamp is what makes an undated filename safe (§2.2).

Three parts:

1. **The tree** — root to phases, every node with its status. Node status
   is one of `specified / phase-planned`; phase status is one of
   `planned / in-progress / done / contingent (OQ-id)`, where `done` uses
   the pinned definition. Rendered as a diagram down to nodes with a
   per-node phase-status table beneath, so the diagram stays legible and
   the numbers stay greppable.
2. **The contract graph** — which nodes produce and consume which
   contracts, with each contract's `draft / stable` status on the edge
   set. One overview diagram at subsystem level, then **one detail diagram
   per parent node**; a diagram that would exceed roughly 20 nodes must be
   split. Never one mega-graph — the reader this document exists for gives
   up at the first unreadable diagram.
3. **The ADR coverage map** — which ADRs govern which nodes and contracts
   (from the `Governed by` links), as a table; a diagram only where the
   ADR's reach is genuinely cross-cutting.

The atlas is **derived only**: every element must be reconstructible from the
artifacts — `hsdd/spec/`, `hsdd/contract/`, `hsdd/adr/` for the tree, contracts,
and ADR coverage; `hsdd/verify/` for `done` (the pinned definition: a
verification doc merged to spec-repo main); each implementation repo's
`openspec/changes/` for `in-progress`. Never derive `done` from spec prose —
prose carries claims, and separating claims from evidence is what this pass
exists to do. It introduces no new
information and therefore needs no reconcile, no ownership, and no review
gate — if it disagrees with the artifacts, the atlas is wrong by
definition, and the fix is regeneration.

### 2.7 The findings→plan loop

The rule that makes the weekly review compile instead of advise:

> **Every row of the progress report's findings register lands in the
> execution plan as a step — or is explicitly waived in the plan with a
> reason.** No third state. A finding that appears in two consecutive
> progress reports without a landed step is itself a finding, one level
> up.

The field validated this loop exactly: the 07-24 progress report's §5
register ("full agent-review reports were produced; the actionable items
are folded into the execution plan as Sync R") became the eight R-steps of
the 07-24 plan. 0.7 makes the folding mandatory and auditable — the plan
step cites the finding, so a reviewer can diff register against plan and
find nothing orphaned.

---

## 3. `hsdd-checkpoint`

### 3.1 One pass, four views

New skill. One run of `hsdd-checkpoint`:

1. **Pins the baselines.** Records the spec repo SHA and every
   implementation repo SHA; under the §6 profile, also each repo's
   submodule pointer. A pointer that does not reference a spec-repo main
   commit is recorded as a finding immediately — before any content
   review, because every conclusion drawn through a forked submodule is
   suspect.
2. **Runs the evidence pass.**
   - *Governance integrity* (spec repo): registry consistency (INDEX files
     match artifact files), dangling references (files, anchors, IDs),
     open-question health (§5.2: every cited ID defined exactly once,
     statuses coherent, no stale "pending OQ-x" prose on resolved
     questions), undrained `Governance updates (pending reconcile)`
     sections, verification-doc audit (every claimed-done phase has its
     doc on main, sign-off fields filled, no template residue), management
     chain integrity (supersedes links resolve, baselines present).
   - *Code vs plan* (each implementation repo): what phases the code
     actually completes versus what the plans and prior progress report
     claim; contract-surface drift (code behavior the contract does not
     promise, contract promises the code abandoned); scope creep (code
     with no phase).
3. **Emits the progress report** (§2.3 shape), findings register included.
4. **Revises the execution plan** (§2.4 shape): new dated file superseding
   the previous one, current-state delta computed from the evidence pass,
   findings compiled into steps per §2.7, guardrail candidates proposed
   from the week's lessons (proposed — the human accepts or rejects each).
5. **Regenerates the atlas** (§2.6).
6. **Ticks the milestone gates** in the current milestone document and
   evaluates the §4.2 re-baseline trigger, reporting it loudly if it
   fires.

The skill's output ends with the same discipline it audits: a list of what
it changed, what it could not verify, and what needs a human decision —
never a silent green.

### 3.2 Two modes

- **Full** (default): the whole §3.1 sequence. Intended cadence: weekly,
  before the team sync, so the sync works from the fresh plan. The cadence
  is a convention, not a mechanism — nothing in 0.7 schedules anything.
- **Scoped** (`hsdd-checkpoint` with named inputs — commit IDs, document
  paths, a described context drop): the field's original untangling prompt
  ("comprehensive review because there was new context in commit X and
  commit Y"), formalized. The evidence pass narrows to the artifacts the
  new context touches plus their closure (consumers of touched contracts,
  phase plans of touched nodes); the code-vs-plan review runs only where
  that closure reaches. Output is the same four views — a scoped run still
  supersedes the plan (the plan absorbs the new context) but may carry
  forward the previous progress report's numbers where the scope did not
  touch them, saying so.

A scoped run answers "new context arrived — what does it break and what do
we do"; a full run answers "what is true — and what do we do". Both end in
a plan, because a review that does not end in a plan is the confusion the
field observed, restated.

### 3.3 What checkpoint is not

Checkpoint is read-only toward governance artifacts. It *finds* the stale
ADR note, the undrained reconcile section, the contract drift — it does not
fix them; the fixes become plan steps routed to the owning skill
(`hsdd-reconcile`, `hsdd-contract`, `hsdd-adr`) and the owning human. The
one thing it writes besides `management/` files is nothing.

---

## 4. `hsdd-milestone`

### 4.1 Generation

New skill, event-triggered, with an explicit precondition stop:

> **Precondition:** every leaf-parent node has a phase plan. This is the
> first moment total scope is computable — a milestone document generated
> before it is guesswork wearing a suit. If any leaf-parent lacks a phase
> plan, the skill **stops and names the missing plans** instead of
> generating.

Generation takes velocity from the latest progress report's calibration.
If no progress report exists yet (planning finished before any
implementation), it uses the phase plans' assumed rate and says so, with a
wider stated uncertainty band — the document is explicit about which of
the two it used.

The generated document follows §2.5. Two rules bind the content:

- **Milestones are demos, not internals.** The skill derives candidate
  milestones from the dependency structure (what becomes demonstrable
  when), not from the org chart or the node list.
- **The contingent tail is computed, not curated:** every phase marked
  contingent on an external OQ (§5) lands in the tail with its degradation
  path, and the launch gate is checked to exclude the tail entirely. An
  externally-gated phase inside the launch gate is a generation error.

### 4.2 Maintenance split

Weekly gate-ticking belongs to `hsdd-checkpoint` (§3.1 step 6), not to this
skill. `hsdd-milestone` runs again only to **re-baseline**, on either
trigger:

- **The slip trigger:** a gate red across two consecutive checkpoints.
- **The scope trigger:** a change that moves the totals (the field's
  ADR-018: +1 contract, +2 phases). If the dates hold — the buffer absorbs
  it — the change is *absorbed*: gates updated, change-log entry, same
  file. If the dates move, it is a *re-baseline*: a new dated document
  superseding the old, with the old window and the new window both stated,
  so the slip is visible instead of silently renormalized.

Re-baselining is a stakeholder event, not bookkeeping — the skill's output
says what changed, why, and what was decided (add people, cut scope, move
the window), and that decision lands per §2.1 where decisions land.

---

## 5. The Open-Question Convention

### 5.1 The convention

Absorbed from the field (`699410e`) into the methodology. Normative, for
every HSDD project:

- **ID scheme.** The root spec mints `OQ{n}`; node specs mint
  `OQ-{prefix}{n}`, with the prefix set declared in conventions.md (the
  field's: `B` backend, `F` frontend, `MS` backend.microsite). IDs are
  stable — never renumbered, never reused. Resolved entries keep their
  table row and detail subsection as audit trail; they are never deleted.
- **One definition home.** An OQ is defined exactly once, in the
  `## Open questions` section of the spec that owns the decision — the
  root for cross-cutting questions, the closest owning node otherwise. A
  child spec that needs a local view of a parent's question mints its own
  ID and marks it `[inherits OQ{n}]`. Every other artifact — leaf specs,
  contracts, ADRs, phase plans, management documents — **cites the ID
  only**, never re-defines the question. This is what gives the question a
  spine from root to phase: root `OQ{n}` → node `OQ-B{m} [inherits OQ{n}]`
  → contingent-phase marker `contingent (OQ-B{m})` in the phase plan.
- **Format,** in the owning spec: a summary table

  ```markdown
  | ID | Question | Status | Waits on | Affects |
  ```

  followed by one `### {ID} — {title}` detail subsection per entry, so
  `grep {ID}` always lands on the definition.
- **Status vocabulary:** `OPEN` (undecided) · `PARTIAL` (partly resolved;
  the residual named under *Waits on*) · `RESOLVED (date)` (decided; the
  row points at where the decision landed — an ADR, a contract, a spec
  `D{n}`). `ext:` under *Waits on* marks an external party and links the
  execution plan's E-track where one exists.
- **Resolving an OQ** = update the row and detail in the owning spec, land
  the decision in its proper artifact, and sweep citations that still
  treat it as open. Prose that justifies a design choice as "pending
  OQ-x" after OQ-x resolved is a named defect class (the field's R8-bis),
  not a cosmetic wrinkle.

### 5.2 Structural anchors

Per the v0.6.1 doctrine — a convention that lives only in prose fires
inconsistently — each behavior gets an anchor in the skill that owns it:

- **`hsdd-spec`:** the root and node spec templates gain the
  `## Open questions` section with the summary table and detail-subsection
  format, so specs are born conforming. Minting rules (stable IDs, prefix
  from conventions.md, `[inherits …]` markers) live in the skill text at
  the decomposition step, where questions are first surfaced.
- **`hsdd-phase-plan`:** a contingent phase **must** name the OQ ID it is
  contingent on. A contingency with no OQ behind it is an error with a
  stop: either the question exists — cite it — or it does not, in which
  case surface it to the owning spec first.
- **`hsdd-contract` / `hsdd-adr`:** cite-only; resolving text points at the
  owning spec's ID.
- **`hsdd-reconcile`:** gains the citation sweep — when a reconcile pass
  lands a resolution, it sweeps for citations still treating the question
  as open.
- **`hsdd-checkpoint`:** verifies the whole system every pass (§3.1):
  every cited ID defined exactly once, every definition in its owner's
  spec, statuses coherent, no stale pending-prose. This is the check that
  makes a phantom `OQ-B3` a one-week defect instead of a standing
  confusion.
- **conventions.md** (template): gains the `## Open questions (OQ)`
  section carrying the convention and the project's prefix set.

---

## 6. The Standalone-Spec-Repo Profile

### 6.1 When, and the layout

Opt-in, declared in conventions.md. The trigger condition: **more than one
implementation repository.** The single-repo `hsdd/` layout of v0.5
remains the default and is untouched.

Under the profile the HSDD tree is its own git repository — the **spec
repo** — and each implementation repo mounts it as a **git submodule at
`hsdd/`**. The mount point is the whole trick:

> **Every path is unchanged.** From an implementation repo the tree is
> `hsdd/spec/…`, `hsdd/contract/…`, `hsdd/adr/…`, `hsdd/management/…` —
> byte-identical to the v0.5 single-repo layout. The profile costs **zero**
> path changes; no skill needs conditional path resolution, and no document
> needs a profile-specific path example.

The spec repo's own root holds `spec/`, `contract/`, `adr/`, `management/`,
`conventions.md`, `verify/` directly — but that view belongs to the
repository, not to any HSDD session, because of §6.2. `management/` lives
in the spec repo (as `hsdd/management/` from every implementation repo):
the layer describes the project, not one subsystem, and both lanes must see
the same copy.

### 6.2 The run-location rule

> **Skills run only from an implementation repo — never from a standalone
> clone of the spec repo.** Every `/hsdd-*` invocation, governance-only
> ones included (`hsdd-contract`, `hsdd-adr`, `hsdd-reconcile`,
> `hsdd-checkpoint`), runs with an implementation repo as the working
> directory and reaches governance through `hsdd/`.

Three reasons, each a failure the field produced:

1. **A standalone clone is a third working copy.** Edits made there leave
   every implementation repo's pointer behind, and the pointer bump is a
   separate act someone must remember — precisely the guardrail-11 incident
   (a pointer stranded on a lineage that never merged). Editing through the
   submodule makes the pointer bump local and obvious.
2. **Assertions need the code.** A skill run from the spec repo cannot see
   `openspec/`, cannot run a gate command, and cannot compare code against a
   phase plan. `hsdd-checkpoint`'s evidence pass would be reduced to reading
   the documents that are already suspect.
3. **One run location is one set of paths.** The alternative — sometimes
   `hsdd/spec/…`, sometimes `spec/…` — is the stale-prefix trap the field
   hit six times in one conventions.md.

**Writing through the submodule.** Governance edits land in the submodule
working tree; they are committed and pushed **inside the submodule** to
spec-repo main, and each implementation repo's pointer is then bumped to
that commit. The pointer bump for repos *other than* the one you ran from
is a separate step and is the standard way pointers go stale —
`hsdd-checkpoint` audits every repo's pointer on every pass (§3.1 step 1).

**Cross-repo runs.** A skill whose scope spans repos — `hsdd-checkpoint`
above all, whose code-vs-plan pass must review every implementation repo —
takes the sibling repos' paths **from the invoking prompt**, and asks for
them when they are absent. Repo locations differ per machine and the
management skills are typically run by a lead, so the paths are session
input, not a checked-in registry that goes stale in someone else's
checkout.

### 6.3 The four rules

Generalized from the field's guardrails 9–12, which were each written in
the blood of an actual incident:

1. **Submodule pointers only ever reference spec-repo main commits.** A
   pointer into a feature branch silently forks the spec truth for every
   session in that repo. (Field incident: BE main's pointer stranded on a
   lineage that never merged.)
2. **A phase is done when its verification doc is on spec-repo main** —
   same day as sign-off, not parked on a feature branch. Blank reviewer
   or disposition fields are a review failure, not a formality. (Field:
   the common.2–.5 docs stranded on an unmerged branch, sign-offs blank.)
3. **Coordinated branch pairs land or die atomically.** Work that spans an
   implementation repo and the spec repo lives on a named branch pair;
   never merge — or delete — one side without the other. (Field: the
   discarded stack restructure, which did this right and proved the rule
   in both directions.)
4. **No squash-merging multi-phase epics.** Per-phase history is the
   velocity data (§2.3) and the audit trail; a squash merge destroys both
   unrecoverably. Merge phase branches individually, or merge-commit the
   epic with branch history intact. (Field: one squash merge cost the BE
   lane its per-phase velocity record.)

`hsdd-checkpoint` audits all four every pass (§3.1 step 1 covers rule 1;
the verification-doc audit covers rule 2; the evidence pass surfaces 3 and
4 as findings when it can see them).

### 6.4 What does not change

The governance freeze, sibling isolation, single-writer contracts,
reconcile ordering — all v0.4.2–v0.6 rules apply unchanged, and so does
every path they name. The profile changes *where the tree is versioned*
and *where sessions run*, nothing about the tree's shape. Parallel phase
planning still uses worktrees; the execution branch protocol of v0.6
applies per implementation repo, with the branch-pair rule (§6.3 rule 3)
layered on when work spans repos.

---

## 7. Compatibility and Adoption (v0.6.1 → v0.7)

### 7.1 The compatibility contract

**0.7 is additive.** No existing artifact shape changes:

- Specs, contracts, ADRs, phase plans, and verification docs that conform
  to v0.6.1 remain conformant. The OQ section (§5) is a new section in
  the templates, required only where open questions exist; a spec with no
  open questions needs nothing.
- The management layer is new files in a new directory. No governance
  artifact gains a new required field.
- The profile (§6) is opt-in; single-repo projects change nothing.
- No skill loses a capability; the six existing skills gain only the §5.2
  anchors.
- The one new stop (§5.2's contingency rule in `hsdd-phase-plan`) binds
  contingencies authored by the run that hits it; pre-existing unnamed
  contingencies are reported for minting, never blocked.

A v0.6.1 project can therefore upgrade its skills and keep working
mid-flight — which is exactly what the reference project (§7.3) will do.

### 7.2 The adoption run

The first `hsdd-checkpoint` on an existing project is an **adoption run** —
the same pass, with three defined behaviors instead of failures:

- **Nonconformances are findings, not errors.** Pre-convention OQ
  formats, missing atlas, broken supersedes links, blank sign-offs: each
  becomes a findings-register row and, per §2.7, a migration step in the
  emitted plan. The run never hard-fails on the state it exists to
  repair.
- **Existing documents are adopted, not replaced.** Pre-existing
  management documents become the head of the supersedes chain — the new
  plan supersedes the latest old plan by exact filename; existing
  numbered guardrails are imported under their numbers, not restarted
  from 1. Historical dated documents are never rewritten (§2.2);
  conformance applies from the next document forward.
- **The first atlas is generated,** whatever state the tree is in — an
  atlas of a messy tree is precisely the map the cleanup needs.

`hsdd-milestone` behaves symmetrically: an existing milestone document is
recognized as the current baseline (subsequent runs re-baseline it per
§4.2); it is never duplicated.

### 7.3 The acceptance fixture

The reference project **is** the acceptance test. 0.7 is not done until
running the two new skills against microsite-hsdd (a live v0.6.1 project,
mid-implementation) produces conforming documents **without manual
repair**, and the adoption run's findings register catches the known
seeded reality: the dangling supersedes link
(`hsdd-execution-plan.md`, renamed to its dated form), the missing atlas,
the blank sign-off fields, the stale-prose class (R8-bis). A checkpoint
that runs clean on a repo known to contain findings fails acceptance in
the more important direction.

---

## 8. Updated Skill Set, Commands, and Layout

### 8.1 Eight skills

| Skill | 0.7 change |
|---|---|
| `hsdd-spec` | + OQ section in templates, minting rules (§5.2) |
| `hsdd-contract` | + OQ cite-only rule (§5.2) |
| `hsdd-adr` | + OQ cite-only rule (§5.2) |
| `hsdd-phase-plan` | + contingent-phase-names-OQ stop (§5.2) |
| `hsdd-reconcile` | + resolution citation sweep (§5.2) |
| `hsdd-config` | + submodule-pointer check under the §6 profile (paths unchanged) |
| **`hsdd-checkpoint`** | **new** (§3) |
| **`hsdd-milestone`** | **new** (§4) |

Slash commands: `/hsdd-checkpoint`, `/hsdd-milestone` join the existing
six.

### 8.2 Layout additions

```
{hsdd root}/
  management/
    YYYY-MM-DD-progress.md
    YYYY-MM-DD-execution-plan.md
    YYYY-MM-DD-milestones.md
    atlas.md
```

### 8.3 Relationship to the 0.8 candidate (vNext mechanization)

The vNext draft renumbers to 0.8 candidate; nothing in it is absorbed or
contradicted here, and the overlap is a planned hand-off:

- vNext's `hsdd status` derives project state mechanically; 0.7's
  checkpoint evidence pass is its **manual predecessor**. When the CLI
  lands, checkpoint's step 2 gets cheaper and more deterministic — the
  skill keeps the judgment (findings, plan compilation, verdict), the
  tool takes the counting. Same relationship the governance freeze had to
  `hsdd-reconcile`: the discipline precedes its mechanization.
- vNext's `hsdd lint` would mechanize the OQ health check and the
  registry/dangling-reference sweeps of §3.1.
- The atlas is a projection the CLI could emit verbatim.

0.7 deliberately specifies the *documents and the discipline*, not the
tooling — so that the discipline is field-validated before it is frozen
into code.

---

## 9. Settled Decisions (v0.7)

1. **Two skills, not four, not zero.** One evidence pass feeds four views
   (checkpoint); milestone generation alone has a distinct trigger and
   audience. One-skill-per-document re-runs the expensive pass or couples
   the skills; conventions-only repeats the prose-fires-inconsistently
   failure 0.6.1 diagnosed.
2. **Management = 0.7; mechanization vNext = 0.8 candidate.** The
   management layer is field-driven and shippable now; the CLI is a
   bigger bet and keeps its own release.
3. **Cite, never define.** Management documents are views; every truth
   they carry lives in a governance artifact. Deleting `management/`
   loses no truth.
4. **Dated chain for point-in-time docs; one living atlas.** Tick-and-
   append are the only in-place edits after publication; supersedes links
   are by exact filename.
5. **Checkpoint ticks, milestone re-baselines.** Weekly gate maintenance
   belongs to the weekly skill; `hsdd-milestone` runs only at generation
   and on the slip/scope triggers.
6. **Open questions are a convention plus anchors, not a skill.** The
   behavior lives in the skills that already own the artifacts where OQs
   appear.
7. **The profile is normative and opt-in, and it moves no paths.** The
   submodule mounts at `hsdd/`, so `hsdd/spec/…` and friends stay literally
   correct in both layouts — the profile's content is the run-location rule
   (§6.2) plus four incident-backed rules, not a path scheme. Single-repo
   remains the default.
8. **Additive compatibility is a contract, not an aspiration** (§7.1),
   with the reference project as the acceptance fixture (§7.3).
9. **Rejected document classes** (derivable or duplicative — YAGNI): a
   standalone risk register (it is the OQ tables + external tracks +
   contingent tail, already maintained where they live); sync minutes
   (the plan's sync tables and the governance artifacts that record
   decisions serve); a stakeholder one-pager (that is the milestone
   document); a standalone estimation doc (that is the progress report's
   calibration section, kept current instead of orphaned).

## 10. Non-Goals (v0.7)

- **No mechanization.** No CLI, no generated registries beyond what
  exists, no lint tooling — that is the 0.8 candidate's ground (§8.3).
- **No scheduling.** The weekly cadence is convention; nothing fires on a
  timer.
- **No new governance semantics.** Freeze, reconcile, ownership, tiers —
  untouched. The management layer sits strictly downstream of them.
- **No multi-team org model.** Two-lane, single-project management is
  what the field validated; the multi-team profile stays in the 0.8
  candidate (vNext §13).
- **No dashboard/BI ambitions for the atlas.** It is a markdown file with
  diagrams, regenerated whole; interactivity is out.

## 11. Implementation Plan

1. `skills/hsdd-checkpoint/` + `commands/hsdd-checkpoint.md` — §3, §2.3,
   §2.4, §2.6 shapes as the skill's templates; adoption behaviors (§7.2).
2. `skills/hsdd-milestone/` + `commands/hsdd-milestone.md` — §4, §2.5
   shape as template.
3. §5.2 anchor edits: `hsdd-spec` (templates + minting), `hsdd-phase-plan`
   (contingent stop), `hsdd-contract`/`hsdd-adr` (cite-only line),
   `hsdd-reconcile` (sweep step), conventions template (OQ section).
4. `hsdd-config`: submodule-pointer check before the phase context switch
   (§6.2) — no path resolution changes, because the profile does not move
   any path.
5. Users guide: a "Running the project" chapter (management layer, weekly
   rhythm, adoption walkthrough on an existing project).
6. Acceptance: adoption run + full checkpoint + milestone re-baseline
   against microsite-hsdd (§7.3); expected-findings list written before
   the run.
7. CHANGELOG + README.
