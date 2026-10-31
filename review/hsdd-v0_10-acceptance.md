# HSDD v0.10 Acceptance

**Status:** Expectations committed before any run. Results are recorded below
each criterion after the run, never edited into the expectations.
**Method:** a cold-context session (the operator's `claude-work` profile) with
the v0.10 skills installed, run against the microsite project's implementation
repos. Nothing from that project is committed here beyond the identifiers this
record names.
**Spec:** `spec/hsdd-spec-v0_10.md` chapter 15;
`docs/superpowers/plans/2026-10-10-v0_10-release.md` (this release's plan).
Criteria A1 to A4 and B1 to C3 are carried from the v0.9 record unchanged;
A5, D1 to D7 and E1 to E5 cover what v0.10.0 adds; A6 and A7 cover what
v0.10.1 corrects; F1 to F6 cover what v0.10.2 corrects. Every `Result:` is
filled by the owner's run, never by the implementer.

## A. Phase context and coding methods

### A1. Superpowers switch on a pending phase

- **Run:** `/hsdd-phase {a pending frontend phase} --method superpowers` in the
  frontend implementation repo.
- **Expected:** `hsdd-context/{phase-id}.md` and
  `hsdd-context/superpowers/{phase-id}.md` exist; the stamp names the spec SHA
  the submodule points at; the equality check prints nothing; every `@v`,
  `ADR-` and `OQ` id in the generic file has its subsection or line.
- **Fails if:** a contract or ADR is summarized rather than copied; a sibling
  phase's section appears; any `{placeholder}` survives in the derivative.
- **Result:**

### A2. A fresh session plans from the derivative alone

- **Run:** a new session, given only the line the switch reported
  (`Use superpowers:writing-plans to plan hsdd-context/superpowers/{phase-id}.md`).
- **Expected:** `writing-plans` produces a plan under `docs/superpowers/plans/`
  without asking for context outside the file and its links; the plan passes
  every item of the derivative's Plan check.
- **Fails if:** the session starts at brainstorming, opens the node spec or
  another phase's section to plan, or the plan lacks the verification-doc task.
- **Result:**

### A3. OpenSpec receives a superset

- **Run:** for the same phase, `/hsdd-phase {phase-id} --method openspec`, then
  compare against the three blocks the v0.8 skill would have written (render
  them by following `git show origin/main:skills/hsdd-config/SKILL.md` for the
  same phase).
- **Expected:** every non-heading line of the old Current Phase, Contracts and
  Governing Decisions blocks appears in the new phase block; the project-wide
  context and `rules:` are byte-identical to before the switch.
- **Fails if:** any old line is missing, or `rules:` changed.
- **Result:**

### A4. An undeclared project stays on OpenSpec

- **Run:** the switch on a repo whose conventions have no Coding method line.
- **Expected:** `config.yaml`'s phase block and `hsdd-context/{phase-id}.md`
  are written, and nothing else (`git status --porcelain` lists only those).
- **Result:**

### A5. A superpowers-only project gets the verification template

- **Run:** in a scratch copy of an implementation repo whose
  `hsdd/conventions.md` says `**Coding method:** superpowers` and which has
  no `hsdd/templates/` directory, `/hsdd-phase {a pending phase}`. Separately,
  in a scratch copy whose `hsdd/templates/verification.md` exists but has no
  `## Learnings` heading, run the same command.
- **Expected:** `hsdd/templates/verification.md` exists afterwards and is
  byte-identical to `skills/hsdd-config/templates/verification.md`; the run
  report says it was copied; the derivative's constraint 5 points at it. In
  the second case the old copy is replaced by the skill's template,
  byte-identical, and the report says it was replaced; no existing
  verification doc changed.
- **Fails if:** the template is missing, retyped (any diff), or the report
  does not mention the copy. In the second case: the old copy is left in
  place, or any verification doc changed.
- **Result:**

### A6. Every contract subsection carries its Validation (v0.10.1)

- **Run:** `/hsdd-phase {a pending phase that consumes a stable contract} --method superpowers`.
- **Expected:** every contract subsection has Interface, Guarantees and
  Validation, each verbatim from the contract file; the Discipline line and
  the derivative's constraint 7 say to test against the fixtures their
  Validation names.
- **Fails if:** a subsection has no Validation block although its contract
  has a `## Validation` section, or any Validation line differs from the
  source.
- **Result:**

### A7. A contract named but not consumed is `referenced` (v0.10.1)

- **Run:** the switch on a phase whose consumed contract's text names a
  contract the phase neither consumes nor produces. If the field project has
  no such phase, use a scratch copy of `docs/tutorial/simple-login/execute/`
  without its `hsdd-context/`, and `simple-login.web.3`.
- **Expected:** the named contract has a `· referenced ·` subsection with
  Interface, Guarantees and Validation; the Discipline section has a
  Referenced line naming it; every `consumes` and `produces` heading matches
  the Phase block's Consumes and Produces; the self-contained gate reports no
  missing id.
- **Fails if:** the named contract is headed `consumes` or `produces`, is
  left out, or gets a stub instead of its text.
- **Result:**

## B. The plan page

### B1. The plan page renders the field project's tree

- **Run:** in an implementation repo, with the v0.10 skills installed, invoke
  `hsdd-summary` and follow its process to the end (extract, fill, validate,
  slots, prose, lint, stamp, render, check).
- **Expected:** every unparsed item is filled from the line it names (the
  tree has exactly two: a phase with no summary-table row, and a phase section
  whose heading or fields do not parse); `validate` exits 0; `check` reports
  `summary.html: fresh`; the page opens from disk with networking disabled and
  draws the root's parts with contract edges; the leaf-parent with the most
  phases shows an ordered list of steps, not a diagram, and its reviewer page
  says why; an internal node's page draws contracts produced elsewhere in the
  tree from one "Elsewhere in the tree" box; no file outside `hsdd/summary/`
  changed.
- **Fails if:** a source file changed, a value was guessed where the source
  states none, or the page requests the network.
- **Result:**

### B2. The stakeholder sees no id

- **Run:** from the project root, after B1:

  ```bash
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { renderPlan } from "./hsdd/scripts/summary/views-plan.mjs";
  import { namesId } from "./hsdd/scripts/summary/prose.mjs";
  const html = readFileSync("hsdd/summary/summary.html", "utf8");
  const page = JSON.parse(/id="hsdd-page">([^<]*)</.exec(html)[1]);
  const m = page.model;
  const routes = [{ view: "top" }, ...m.nodes.map((n) => ({ view: "node", id: n.id })), { view: "contracts" }, ...m.contracts.map((c) => ({ view: "contract", id: c.ref })), { view: "adrs" }];
  let bad = 0;
  for (const r of routes) {
    const v = renderPlan(page, { audience: "stakeholder", ...r });
    const text = [v.title, v.body.replace(/<[^>]*>/g, " "), ...v.diagrams.flatMap((d) => d.spec.nodes.flatMap((n) => [n.label, n.sub]))].join(" ");
    const id = namesId(text, m.ids);
    if (id) { bad++; console.log(r.view, r.id ?? "", "names", id); }
  }
  console.log(bad ? `${bad} view(s) leak an id` : "no id in any stakeholder view");'
  ```

- **Expected:** `no id in any stakeholder view`.
- **Fails if:** any view names an id. A leak from a node's own name is a
  finding for that node's spec, recorded here; a leak from the page's own
  words is a defect in `views-plan.mjs`.
- **Result:**


## C. The checkpoint page

### C1. The page renders the field project's chain, with the computed values pinned

- **Run:** in an implementation repo, with the v0.10 skills installed and
  `hsdd/summary/` present, `hsdd-summary`'s Process (checkpoint page)
  against the chain whose heads are the 2026-09-18 report and plan.
- **Expected:**
  - Exactly two unparsed items, both a step owned by "both" (C-90, G-24),
    filled from the plan's Operating model.
  - `validate checkpoint` exits 0 with no integrity finding.
  - Carried ages: F-189 and F-195 at 2 consecutive registers; F-206 at 1.
  - Step I-2 open in 2 consecutive plans.
  - Delta against the 2026-09-15 plan: 1 step carried (I-2), 21 no longer
    present.
  - M4 6 / 6 up from 5 / 6; M5 6 / 10 up from 5 / 9; M6 2 / 8 up from
    0 / 6; M7 0 / 6 shown as new.
  - The plan graph: 21 nodes, drawn as 14 boxes (steps batched by lane and
    depth), with Sync Y and Sync Z as junctions.
  - The lead top says, above the plan graph, that the 21 steps and syncs
    are too many to draw one by one and are grouped by lane and depth.
  - `check` reports `checkpoint.html: fresh`, and the plan page's state is
    unchanged by the run.
- **Result:**

### C2. Inverted: known defects are not shown as clean

- **Expected:** Build progress shows the backend gateway node flagged (the
  atlas marks its count); the lead's Findings list shows F-189 and F-195 as
  running for 2 reports; I-2 carries "open in 2 plans".
- **Fails if:** any of the three appears clean.
- **Result:**

### C3. A tree without `hsdd/summary/` is untouched

- **Run:** `/hsdd-checkpoint` on a project with no `hsdd/summary/`.
- **Expected:** no `**Stale summaries:**` line, no page, no `hsdd-summary`
  script run; the management documents have v0.8's shapes.
- **Result:**

## D. The 0.8 rules, now in the skills

### D1. The verification doc carries Learnings

- **Run:** complete one gate-only phase end to end on the field project
  (any method) and open its verification doc.
- **Expected:** `## Learnings` present with `- none` or dispositioned
  entries; Sign-off lists the Learning dispositions line.
- **Fails if:** Learnings absent, or an entry without a disposition passed
  the gate.
- **Result:**

### D2. Reconcile refuses a fixtureless flip and reports it

- **Run:** in a scratch copy of the field spec tree, author a new contract
  with `hsdd-contract`, then delete the schema and fixtures it wrote (the
  state of a contract whose artifact was never written), plan its producing
  and consuming phases (so its `phase_ids` are final), and run
  `/hsdd-reconcile`.
- **Expected:** the contract stays `draft`; the report names it, the path it
  lacks, and the `hsdd-contract` step that adds it; no `validation:` key
  was written.
- **Fails if:** the contract became `stable`, or acquired
  `validation: grandfathered`.
- **Result:**

### D3. Grandfather round trip, with a checkpoint before the marking

- **Run:** on the field project, `/hsdd-checkpoint` (its first run after
  upgrading HSDD); then `/hsdd-checkpoint` again **before** executing the
  marking step; then execute the marking step the second plan carries for
  `hsdd-reconcile`; then `/hsdd-checkpoint` a third time.
- **Expected:** the first report lists the fixtureless `stable` contracts,
  records their count as remaining, and its Bottom line row names the set
  source (the plan's filename and the step's ID); the plan has one 🤖 step
  whose prompt names those contracts by id and version with the baseline
  SHA, and a *Validate:* grep. The second report shows the same remaining
  count and the same set source, and its plan carries the marking step
  forward with the same contracts and the same baseline SHA. After
  reconcile, exactly those contracts carry `validation: grandfathered` and
  `INDEX.md` is unchanged. The third report shows the same count with the
  previous count in parentheses and no High finding.
- **Fails if:** a checkpoint edited a contract file; any report's count
  rose; the second report counted the contracts as discharged or routed
  them without the baseline SHA; the third report raised a High finding; a
  `draft` was marked.
- **Result:**

### D4. Ordering policy is read, not assumed

- **Run:** set `**Ordering policy:** fp-progression` in a scratch copy's
  conventions and write a phase plan for one leaf-parent; then remove that
  line and any pre-v0.10 `FP ordering:` bullet, and plan another.
- **Expected:** each plan names the policy it followed after its summary
  table; the second says `interfaces-first`.
- **Fails if:** either plan names the wrong policy or none.
- **Result:**

### D5. Producing phases replay the contract

- **Run:** the plan from D4.
- **Expected:** every phase whose Produces is not `none` has a Gate that
  names the contract replay for each produced contract (or `node default
  plus contract replay for {slug}`).
- **Fails if:** a producing phase's Gate omits it.
- **Result:**

### D6. Backfill finding on a planted commit

- **Run:** in a scratch copy of an implementation repo of a launched project
  (say in the run that it is post-launch: backfill applies only then), commit
  a small code change that no phase covers, then `/hsdd-checkpoint`.
- **Expected:** a backfill finding in the register; a plan step that
  appends a retro phase through `hsdd-phase-plan` append mode; no existing
  phase renumbered when that step is executed.
- **Fails if:** the change is reported as in-progress or ignored, or the
  retro phase renumbers anything.
- **Result:**

### D7. Inverted: a known defect is not shown clean

- **Expected:** the D3 first report's register contains the field project's
  fixtureless `stable` contracts as findings; a clean register fails this
  criterion.
- **Result:**

## E. Adoption and intake

### E1. Adopt the unadopted surface around the field tree

- **Run:** in the field project's implementation repo, `/hsdd-adopt` on
  the code the governed tree sits inside (the owner names the modules).
- **Expected:** `hsdd/scripts/seams/` byte-identical to the skill's
  `scripts/`; the tree was shown and confirmed before any node spec or
  contract was written;
  every new node spec carries `- **Adopted:** as-built`, an
  `## Observed surface` in the script's bullet order stamped with one sha,
  and at least one real `unknown:` line; every adopted contract is `v0`,
  `stable`, `compatibility` declared, with its schema or fixtures present
  at the canonical paths and an `## Observed completeness` block;
  registries regenerated; no refactoring proposal; `.hsdd-seams.json` not
  committed.
- **Fails if:** a node has no `unknown:` line, an `## Observed surface`
  bullet was hand-edited (its content differs from `render` for the same
  prefixes at the same sha), or any proposal to restructure the code
  appears.
- **Result:**

### E2. Drift is found, and never looked for in a greenfield tree

- **Run:** after E1, add one route to an adopted module and commit, then
  `/hsdd-checkpoint`; separately, `/hsdd-checkpoint` on a scratch tree with
  no `## Observed surface` and no `hsdd/scripts/seams/`.
- **Expected:** the first run's register has a drift finding naming the
  node and `routes.count changed n -> n+1`, with a plan step; a second
  adopted node with no code change reports `nothing changed`; the
  greenfield run's report and transcript show no `extract-seams.mjs`
  invocation and no finding about the missing directory.
- **Fails if:** the drift is missing, an unchanged adopted node reports a
  difference, or the greenfield run ran the script or reported
  `hsdd/scripts/seams/` as missing.
- **Result:**

### E3. A change request is routed, recorded first, and collisions are serialized

- **Run:** plant an open intake record touching node X; then `/hsdd-intake`
  on a real change request that also touches X.
- **Expected:** the new record exists before any handoff ran (its
  `## Routing` carries the handoff prompt; the record was written before any
  spec or plan change, and under the standalone-spec-repo profile its commit
  comes first in `git log`); exactly one class; the planted record is named
  under `**Collisions:**` and both change logs say which waits, or that the
  two were merged; the slug contains none of `progress`, `execution-plan`,
  `milestones` or `atlas`;
  no spec, contract or ADR was written by the intake.
- **Fails if:** a handoff ran before the record existed, or the collision
  went unrecorded.
- **Result:**

### E4. Promote first, once

- **Run:** route a change (E3 may serve) to one of E1's as-built nodes.
- **Expected:** `hsdd-spec` promotion mode ran, stopped for confirmation,
  and after it the node reads `- **Adopted:** promoted` with its
  `## Observed surface` kept; the intake's `**Promotes:**` names it; a
  second change routed to the same node consumes the promoted spec and
  does not re-promote.
- **Fails if:** phases were planned on the as-built spec, the surface was
  deleted, or the node was promoted twice.
- **Result:**

### E5. Inverted: an adoption with no unknowns fails

- **Expected:** an adoption run whose node specs carry no real `unknown:`
  line (only the script's placeholder, or none) fails E1 regardless of
  everything else being in order.
- **Result:**

## F. The change flow (v0.10.2)

F1 to F3 run on a scratch repository holding a copy of
`docs/tutorial/simple-login-update/template/`, committed, with the v0.10.2
skills; they follow the tutorial's prompts in order.

### F1. Intake names the authority and the request's path

- **Run:** "A change request came in: @hsdd/context/update-1-add-phone.md
  (approved by product). Route it into the tree."
- **Expected:** the record's Request line ends `(approved PRD)`; its
  Routing says the change request's path joins each landing node's Sources
  and each planned phase cites the record in its Scope.
- **Fails if:** the authority is any other value, or the record says its
  own path joins Sources.
- **Result:**

### F2. A lockstep bump writes v2 beside v1 and deprecates v1

- **Run:** "Draft profile-api@v2 (adds phone) per hsdd/management/{the record}."
- **Expected:** `hsdd/contract/profile-api.v2.md`,
  `schema/profile-api.v2.schema.json` and `fixture/profile-api.v2/` exist;
  v1's three paths still exist, and only v1's frontmatter `status` and its
  `## Versioning` changed; v2's migration note names `lockstep`; v1 is
  `status: deprecated`, its sunset the first phase in v2's `produced_by`;
  v2 is `draft`; auth-api@v1's guarantee that names profile-api@v1 names
  v2 as well, and ADR-001's `affects` lists profile-api@v2.
- **Fails if:** a v1 file was renamed or moved, the note names no mode, v1
  is still `stable`, or a node spec was edited in this run.
- **Result:**

### F3. Append mode leaves the header; reconcile writes the ripple

- **Run:** the tutorial's three `/hsdd-phase-plan … per …` prompts, then
  "Reconcile: drain the pending governance updates."
- **Expected:** after planning, no node spec's `Produces` or `Consumes`
  line changed; each Sources gained `hsdd/context/update-1-add-phone.md`,
  never the intake record; no lone appended phase carries a sizing-floor
  line; no appended Scope rests on "per the request's Screen" without the
  row it means. After reconcile, every node header, the root's child
  table, embedded summaries, DAG and contract matrix name profile-api@v2,
  each embedded summary's Sources matches its node's, and the root's
  `## Sources` lists the change request with its authority.
- **Fails if:** a planner edited a header, a Sources entry names the
  record, or a copy above a node still lacks v2 after reconcile.
- **Result:**

### F4. The context carries the node decisions a phase cites

- **Run:** on a scratch copy of `docs/tutorial/simple-login/execute/`
  without its `hsdd-context/`, `/hsdd-config simple-login.backend.2 --method superpowers`.
- **Expected:** `## Decisions` has a `· node decision` subsection for D1
  and one for D2, each verbatim from `hsdd/spec/simple-login.backend.md`;
  the Discipline test-first line and constraint 1 carry the
  merged-dependency sentence; the equality check prints nothing.
- **Fails if:** a cited decision is missing or paraphrased, or a decision
  the Phase block does not cite appears.
- **Result:**

### F5. The checkpoint reads liveness and delegated sign-offs

- **Run:** on a scratch copy of `docs/tutorial/simple-login-update/execute/`
  as it stood before its checkpoint (commit `a82f99a`, the subtree), "Run
  the weekly checkpoint. This is the project's first."
- **Expected:** findings, each with a plan step: profile-api@v1 `stable`
  while nothing serves it, routed to `hsdd-contract`; web.1, web.3 and
  integration.1 migrated, routed to `hsdd-reconcile` to move them to
  `former_consumers`; the nine owner-proxy sign-offs in one finding for the
  owner. The intake record closes. Executing the reconcile step moves the
  three ids and deletes none.
- **Fails if:** v1 is reported healthy, the migrated ids are deleted
  rather than moved, or the proxy sign-offs count as done with no finding.
- **Result:**

### F6. Inverted: a sign-off that names no person is not done

- **Run:** as F5, after changing simple-login.backend.3's Reviewer line to
  `Claude, 2026-10-30`.
- **Expected:** backend.3 is reported as a claim, the Reviewer naming no
  person is a finding, and the intake record stays open.
- **Fails if:** backend.3 counts as done, or the record closes.
- **Result:**
