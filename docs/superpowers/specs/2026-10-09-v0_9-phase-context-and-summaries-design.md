# v0.9.0: Phase Context, Coding Methods, and Reading Aids

**Date:** 2026-10-09
**Status:** Design, approved in conversation section by section; awaiting review of this document
**Owner:** Purbo Mohamad
**Drafted by:** Claude (Opus 5.5), from a brainstorming session
**Base:** `feat/v0.8.0` (unmerged). This release branches as `feat/v0.9.0`.
**Produces:** `spec/hsdd-spec-v0_9.md` (v0.8's consolidated spec plus the
changes in §8), one restructured skill (`hsdd-config`), one new skill
(`hsdd-summary`), and gated amendments to `hsdd-checkpoint`.

---

## 1. Problem

Three gaps, each observed in the field.

**Gap 1: the phase context exists only in OpenSpec's shape.** `hsdd-config`
writes the phase context straight into `openspec/config.yaml`. A team that
executes a phase with superpowers (`writing-plans`, then
`subagent-driven-development` under `test-driven-development`), with Claude
Code's own planning, or by hand has no HSDD-produced input to start from. The
content that matters (the phase section, the Interface and Guarantees of its
contracts, the Decision and Consequences of its ADRs) is method-neutral; only
the wrapping is OpenSpec's. The fix is to build one self-contained,
method-neutral phase context and derive one input per coding method from it.

**Gap 2: nobody reads the tree whole.** A real tree (the microsite project:
18 node specs, about 22,000 lines, 153 phases, 23 contracts, about 50 ADRs) is
complete enough for agents and too long for a reviewer or a stakeholder. The
atlas helps with status but shows everything at once.

**Gap 3: the management documents are a hard read.** The microsite
2026-09-18 checkpoint produced a 331-line progress report and a 929-line
execution plan. Their structure is regular, because `hsdd-checkpoint`
mandates it, but it is buried: a single findings-register cell runs past 150
words, a milestone gate row packs ten ☑/☐ items into one cell, and decision
D-49 is defined about 140 lines below the plan-graph node that depends on it.
The owner's report: "it was a hard read, but after we get used to it, it
became easier." Facts a reader needs are spread across the chain rather than
stated anywhere ("F-189, carried, tenth day"; "Sync W did not discharge,
third consecutive pass").

## 2. Decisions taken

| Question | Decision |
|----------|----------|
| How is the generic phase context built? | **Prose**, inside `hsdd-config`. No script: `hsdd-config` is a proven skill (§3.1). Derivatives **wrap** the generic context word for word; they never rewrite it. |
| Where does it live, and when is it written? | **In the implementation repo, one file per phase**, outside `hsdd/`, written at phase start and kept after the phase. It records the spec SHA it was built from. |
| How is the coding method chosen? | **Project default plus per-phase override.** `conventions.md` declares `**Coding method:**`; an undeclared project is `openspec`. |
| How does the management HTML relate to `hsdd-summary`? | **One skill, two pages.** `hsdd-summary` owns the engine; the plan page and the checkpoint page are separate files with separate stamps. `hsdd-checkpoint` gains one step, gated on `hsdd/summary/` existing. |
| Who does the checkpoint page serve first? | **The lead running the sync.** Executor and stakeholder are audience toggles. |
| How is the model extracted? | **Hybrid.** A script parses what the templates fix and lists what it could not parse; the agent fills only those items, from the sources; a schema and a script cross-check validate. |
| How is the engine built? | **From this document.** The page requirements are stated here as behaviour (§5.4); implementers work from this document and their plan. |
| How does it look? | **HSDD's own visual identity**, built on the `mermaid-pastel-style` roles HSDD diagrams already use. |

## 3. Boundaries

### 3.1 The scripting boundary (v0.8 chapter 6)

> A script may ship bundled with a new skill. No script may change how an
> existing skill behaves.

- **`hsdd-config` stays prose.** The generic context is selection, not
  authorship (§4.3), which is what makes the prose path safe. The derivatives
  embed it verbatim, and an equality check by `diff` proves they agree.
- **`hsdd-summary` is new**, so it bundles scripts.
- **`hsdd-checkpoint` reaches a script only behind a gate**: its new step runs
  when `hsdd/summary/` exists. A tree without it never reaches the step. This
  is the same shape as v0.8's adoption-extractor gate.
- **`hsdd-checkpoint`'s in-progress evidence change (§4.8) is prose** and
  adds an evidence source; it changes no existing behaviour for a project
  that never writes `hsdd-context/`.

### 3.2 Provenance and fixtures

HSDD is Apache-2.0. Everything this release adds is written for it:

- Implementer subagents receive this document and their plan only.
- The diagram layout library is the one third-party file: dagre, MIT
  licensed, vendored from npm, pinned by version and sha256, with its licence
  beside it.
- Test fixtures are synthetic (§10). Nothing from the microsite project is
  committed to this repository; acceptance runs against it locally.

### 3.3 The atlas non-goal

v0.8 §15.3 lists "Dashboard/BI ambitions for the atlas" as a non-goal:
"interactivity is out." This release narrows it rather than reversing it:

- **The atlas stays a markdown file**, regenerated whole, unchanged.
- **The checkpoint page is a reading aid**, not the atlas: optional, derived,
  never authoritative, never a gate. Its status lens draws what the atlas
  already states.
- The non-goal row is rewritten to say exactly this (§8). Settled decisions
  (chapter 17) record the change with provenance `reasoned-only`.

## 4. Item 1: the phase context and its derivatives

### 4.1 Files

All in the implementation repo:

```text
hsdd-context/
  {phase-id}.md                  generic, method-neutral; committed on the phase branch
  superpowers/
    {phase-id}.md                superpowers derivative; committed
openspec/config.yaml             OpenSpec derivative; ephemeral, as today (v0.8 §9.3)
```

`hsdd-context/` is a second exception to v0.8 §13.1's single-root rule,
beside `openspec/`, for the same reason: it is execution state of the
implementation repo (v0.8 §9.1's mechanism class), not governance. Under the
standalone-spec-repo profile `hsdd/` is a submodule, and writing per-phase
working state into it would mean a spec-repo push and pointer bumps at every
phase start. The path is a default recorded in `conventions.md`, overridable
like every other path.

Per-phase files never conflict on merge, unlike `config.yaml` (v0.8 §9.3),
because no two branches write the same phase. The files stay after the phase
as the record of what context the coding session was given.

### 4.2 The generic template

Fixed sections, in this order:

```markdown
<!-- hsdd-phase-context {"phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Phase {phase-id}: {Phase Name}

## Goal
{the phase's Scope line}

## Where it sits
- Node: {node-id} · {Purpose}
- Owns: {Owns}
- Does not own: {Does not own}
- Isolation strategy: {Isolation strategy}

## Phase
{the phase's bullet block; `node default` replaced by the default gate's command}

## Contracts
### {contract-id}@{version} · consumes|produces · {status}
**Interface**
{Interface}
**Guarantees**
{Guarantees}

## Decisions
### ADR-{nnn}: {title} · {status}
**Decision**
{Decision}
**Consequences**
{Consequences}

## Open questions
- {OQ-id} · {status} · {question}

## Discipline
- Test-first: write each behaviour's failing test, and see it fail, before
  the code that makes it pass.
- Governance freeze: change nothing under hsdd/ except this phase's
  verification doc; contracts, ADRs, specs and conventions change only
  through hsdd-contract, hsdd-adr and hsdd-reconcile.
- Consume contracts only: build against the Interface and Guarantees above,
  never against another node's internals.
- Verification doc: hsdd/verify/{phase-id}.verification.md from
  hsdd/templates/verification.md at {tier} depth

## Links (spec {spec-sha})
- Phase section: hsdd/spec/{node-id}.md, "### {phase-id}"
- Node spec: hsdd/spec/{node-id}.md
- {contract-id}@{version}: hsdd/contract/{contract-id}.md
- ADR-{nnn}: hsdd/adr/{nnn}-{slug}.md
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
```

- **Produced contracts are new.** Today's switch injects consumed contracts
  only. A producing phase needs the Interface and Guarantees it must satisfy.
- **Decisions** cover every ADR the phase cites and every ADR its contracts
  cite. A `proposed` ADR appears with its status and the line "not binding
  until accepted"; a cited ADR with no file stops the switch, as today.
- **Open questions** list only the ids the phase or its contracts cite.
- **No sources.** v0.8 §9.2 and §7.6 keep source documents out of the phase
  context because the planner already read them. That rule stands, and the
  Links section names no source document.
- **Node hard constraints are not included.** The node template has no field
  for them; selecting them from Overview prose would be authorship.
- **Sibling phases** are cited by id only, in the Phase block's
  Dependencies and Collides with lines.

### 4.3 Rules

1. **Selection, never authorship.** Every line under a section heading is a
   verbatim excerpt from a governance file, a fixed text this document
   defines (the Discipline lines), or a link. The agent writes no sentence of
   its own into the file. This is what keeps the prose path deterministic
   enough.
2. **Self-contained.** Every contract, ADR and OQ id in the file has its text
   inline in its section, except sibling phase ids. Every link names the spec
   SHA. A quality gate in `hsdd-config` checks this.
3. **Push, not pull.** The links are for provenance and escalation. They never
   replace an inline excerpt; v0.8 §17.2 dropped pull-based phase context and
   this release does not revive it.
4. **Size.** The phase block grows from about 20 lines to roughly 80 to 150,
   mostly contract text. Nothing is truncated to fit: a context that is too
   large signals a phase that consumes too much, and the fix belongs in the
   phase plan.
5. **Staleness.** The stamp records the spec SHA. When governance changes
   mid-phase, re-run the switch; the file is rewritten whole.

### 4.4 The OpenSpec derivative

`openspec/config.yaml` keeps its project-wide `context:` sections (Artifact
Compliance, Project, Tech Stack, Architecture Principles, Development
Discipline) and its `rules:` unchanged. The three per-phase blocks
(`## Current Phase`, `## Contracts from Prior Phases / Nodes`,
`## Governing Decisions`) are replaced by the generic body, verbatim, between
`<!-- hsdd-phase-context:begin -->` and `<!-- hsdd-phase-context:end -->`.

**What protects the proven path:** OpenSpec receives a superset of today's
injection. Every line of the old three blocks has a counterpart in the
generic body (the phase block, consumed contracts' Interface and Guarantees,
governing ADRs' Decision and Consequences). Acceptance criterion A3 checks it.

### 4.5 The superpowers derivative

```markdown
<!-- hsdd-derivative {"method":"superpowers","phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Phase {phase-id}: {Phase Name}

> Start with superpowers:writing-plans, given this file's path. Do not start
> at brainstorming: this phase was designed and reviewed in HSDD. Save the
> plan under docs/superpowers/plans/ in this repository, never under hsdd/.

## Global Constraints
{numbered list, below}

## Plan check
{checklist, below}

<!-- hsdd-phase-context:begin -->
{generic body, verbatim}
<!-- hsdd-phase-context:end -->
```

`writing-plans` copies the spec's Global Constraints into the plan header
verbatim, and `subagent-driven-development` hands them to every implementer
and every task reviewer (verified against superpowers 6.4.1). That makes
Global Constraints the place for HSDD's rules. HSDD's wording, with values
filled from the phase:

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task
   without a failing-test step.
3. The plan has at most {N} tasks, N taken from the phase's Size estimate:
   the phase is sized to one review sitting.
4. Before the last task, run the gate `{command}` and keep its output for
   the verification doc's Observed section.
5. The last task writes `hsdd/verify/{phase-id}.verification.md` from
   `hsdd/templates/verification.md` at {tier} depth, fills Learnings and
   Metrics as the template asks, and leaves Sign-off for a human reviewer.
6. Nothing under `hsdd/` changes except that verification doc. Contracts,
   ADRs, specs and conventions change only through `hsdd-contract`,
   `hsdd-adr` and `hsdd-reconcile`.
7. Build against the Interface and Guarantees in the Contracts section,
   never against another node's internals.
8. Review tier {tier}: {gate-only: no design discussion in the plan, slim
   verification doc | spot-check: design notes only for a decision the phase
   actually settles, short verification doc | full-review: design rationale
   for every non-obvious choice, full verification doc}.
9. When writing {language}, use {skill}. One line per installed tech skill
   that `conventions.md` or `CLAUDE.md` names; none when there are none.

Rule 1 states test-first in every task's own text because an implementer
subagent sees only its task and the Global Constraints.

**Plan check**, run by whoever drives `writing-plans`, after its self-review
and before choosing an execution method:

- [ ] The plan's Global Constraints contain rules 1 to 9 verbatim.
- [ ] Every `### Task N:` except the last starts with a failing-test step.
- [ ] The last task writes the verification doc named in rule 5.
- [ ] The plan has at most N tasks.
- [ ] The plan is saved under `docs/superpowers/plans/`.

**A superpowers run:** `writing-plans` with the derivative's path, the plan
check, then `subagent-driven-development` (or `executing-plans`, which loads
`test-driven-development`), then the verification doc as the last task. The
definition of done is unchanged: a verification doc merged to spec-repo main.
`hsdd/templates/verification.md` is unchanged.

**Equality check**, for both derivatives: the text between the begin and end
markers equals the generic file's body. For `config.yaml`, compare after
removing the block scalar's indentation. `hsdd-config` performs it with
`diff` as a quality gate; no script ships.

### 4.6 Choosing the method

- `conventions.md` gains `**Coding method:** openspec | superpowers`. An
  undeclared project is `openspec`, so existing projects keep today's
  behaviour plus the new generic file.
- `/hsdd-phase {phase-id}` writes the generic file and the declared method's
  derivative. `/hsdd-phase {phase-id} --method superpowers` overrides the
  declaration for one phase.
- The generic file is always written, whatever the method: it is the audit
  record and the in-progress signal (§4.8).

### 4.7 The switch, amended

Existing steps stay, in order: the profile pointer check, opening the
leaf-parent and its next phase, the missing-ADR stop, the next-runnable
check, the reconcile check. Then:

1. Write `hsdd-context/{phase-id}.md` from the template.
2. Run the self-contained quality gate (§4.3 rule 2).
3. Write the method's derivative.
4. Run the equality check.
5. Report: files written, method, spec SHA, and for superpowers the exact
   prompt to start the session with.

The next-runnable check becomes method-neutral. It warns when the phase
already has `hsdd/verify/{phase-id}.verification.md` on spec-repo main
(already done), or when its OpenSpec change is archived (OpenSpec method). It
warns when a dependency phase has neither a verification doc nor a merged
branch.

### 4.8 Knock-on changes, prose only

- **`hsdd-checkpoint` and the atlas:** a phase is `in-progress` when the refs
  the pass already reads hold either an `openspec/changes/` entry for it
  (today) or `hsdd-context/{phase-id}.md` (new), and no verification doc for
  it is on spec-repo main. v0.8 §12.6's derivation sentence names both.
- **`hsdd-phase-plan` is untouched.** No new phase field.
- **The conventions template** gains the Coding method line and the
  `hsdd-context/` path.
- **`commands/hsdd-phase.md`** gains `--method`.

### 4.9 Cut

| Not in this release | Why |
|---------------------|-----|
| A "test cases to write first" phase field | The phase template has none; OpenSpec's scenarios and `writing-plans`' tasks produce the test cases. Adding a field means changing `hsdd-phase-plan`. |
| A test-first evidence section in the verification doc | The template's Observed section already holds gate output; changing a proven template buys little. |
| Freezing and versioning derivatives | Only needed when a derivative is attached to a tracker ticket. HSDD attaches nothing. |
| A plan-check script | The scripting boundary; the checklist lives in the derivative itself. |

## 5. `hsdd-summary`: the shared engine

### 5.1 Files

```text
skills/hsdd-summary/
  SKILL.md
  scripts/summary.mjs            CLI entry: extract | validate | slots | lint | stamp | render | check
  scripts/*.mjs                  modules (parse, model, graph, layout, html, prose, stamp)
  scripts/vendor/dagre.min.js    + LICENSE + README.md (version, sha256, source URL)
  schema/plan-model.schema.json
  schema/checkpoint-model.schema.json
commands/hsdd-summary.md
test/                            repo root; `node --test test/`
```

In a project, first use copies `scripts/` (vendor included) into
`hsdd/scripts/` and `schema/` into `hsdd/schema/` verbatim, the
`gen-registry.mjs` precedent. Output:

```text
hsdd/summary/
  summary.html       the plan page
  checkpoint.html    the checkpoint page
  glossary.json      id → plain noun phrase; people own existing entries
  prose.json         prose slots, each stamped
```

The model is scratch, written under the OS temp directory (or `--model
<path>`), and never committed. `hsdd-summary` writes nothing outside
`hsdd/summary/`. The scripts are zero-dependency Node; the schema validator
is bundled and supports only the keywords the two schemas use.

### 5.2 The pipeline

1. **`extract plan|checkpoint`** parses the sources (§6.1, §7.2) and writes
   the model plus `unparsed[]`: file, line, field, reason.
2. **The agent fills each unparsed item** in the model, reading the source
   at that line. It never edits a source, and it never adds an item the
   parser did not flag.
3. **`validate`** checks the model against its schema, then cross-checks
   (§6.1, §7.3). An error means the extraction is wrong; fix the model, not
   the check. Findings are not errors: they appear on the page.
4. **`slots`** seeds `glossary.json` and `prose.json` and lists the empty
   slots. Entries whose subject has gone are listed as orphaned; the skill
   asks before deleting one.
5. **The agent writes prose** into empty or stale slots, within word limits.
   It never changes an existing glossary entry.
6. **`lint`**, at most two rewrites; findings left after the second rewrite
   are shown on the page as readability notes.
7. **`stamp`** restamps only the entries that were rewritten.
8. **`render plan|checkpoint`** writes the page. It refuses while a required
   slot is empty.
9. **`check`** reports a stale page and stale prose entries. It always exits
   0: staleness is information, never a gate.

### 5.3 Facts and framing

Every id, count, edge, table and diagram comes from the script. The agent
writes only bounded prose slots and fills unparsed fields from the source.
It never draws an edge, counts anything, or restates a contract.

### 5.4 Page requirements

Each requirement is behaviour the scripts and tests must show.

1. **One offline file.** No network request, ever. A Content-Security-Policy
   meta tag allows only the page's own inline script and style. The model
   travels inline as JSON.
2. **Escape every value** rendered into HTML or SVG, from any source,
   including the model's JSON when it is inlined.
3. **Diagrams fit their viewport** and carry a legend for every fill and line
   style they use. A diagram that would exceed 12 boxes collapses a level or
   becomes a list.
4. **Keyboard.** Every box is focusable and opens on Enter. A redrawn diagram
   keeps focus on the box that had it. A skip control focuses the main
   content without changing the view. Single-key shortcuts can be turned off;
   the browser remembers the choice.
5. **Routes.** The URL fragment holds the view (`#lead/sync/Y`). A fragment
   naming an id the model does not hold falls back to the top view. Back,
   breadcrumbs and "up a level" work.
6. **The stakeholder never sees an id.** Every id a renderer prints is
   registered, and a test scans each stakeholder render for every registered
   id.
7. **Inputs are checked by name.** A file that is missing, is not JSON, or has
   the wrong shape stops `render` with a message naming it. `stamp` refuses to
   stamp the page. `check` survives a malformed prose store.
8. **Collisions ordered by a dependency are counted, not listed.**
9. **One wording per state**, for example "named, not yet written" for every
   unwritten contract, and real plurals everywhere.
10. **The vendored layout library is pinned**: one copy, by version and sha256.

### 5.5 Visual identity

- **Palette:** the `mermaid-pastel-style` roles. Ink `#1e293b`, lines
  `#475569`. Role fills: process `#f3e8ff`/`#7c3aed`, decision
  `#fef3c7`/`#d97706`, flow `#e0e7ff`/`#4f46e5`, done `#d1fae5`/`#059669`,
  failure `#fee2e2`/`#dc2626`, implementation `#dbeafe`/`#2563eb`. Groups use
  dashed strokes with no fill. The page diagrams therefore match the Mermaid
  diagrams in the specs and the atlas.
- **Semantic mapping:** tier (gate-only, spot-check, full-review), status
  (planned, in-progress, done, contingent), severity (High, Medium, Low) and
  step mode (🤖, 🤝, 👤) each map to a role, fixed across both pages.
- **Light and dark themes,** both readable, chosen by `prefers-color-scheme`
  with a toggle.
- **System font stack.** Nothing loads from the network (§5.4 rule 1).

## 6. The plan page

### 6.1 Extraction (`extract plan`)

| Source | What the parser reads |
|--------|-----------------------|
| `hsdd/spec/*.md` | Title (`# {node-id}: {Name}`); the field block (Kind, Status, Purpose, Owns, Does not own, Consumes, Produces, Governed by, Sources as a count, Decomposes into, Isolation strategy, Team); the child-node table and the typed dependency table (`hard`, `contract`, `event`, `shared-model`); `## Open questions` (table, plus the presence of each detail subsection); whether an undrained `## Governance updates (pending reconcile)` section exists; `## Observed surface` presence (adopted nodes). |
| Leaf-parents' `## Phase Plan` | `**Default gate:**`; the summary table; each `### {phase-id}: {Name}` bullet block (Consumes, Produces, Governed by, Scope, Size estimate, Gate, Verification, Review tier, Collides with, Dependencies). |
| `hsdd/contract/*.md` | Frontmatter (id, version, status, kind, owner, produced_by, consumers, phase_ids); the Interface and Guarantees sections, one line per guarantee. |
| `hsdd/adr/*.md` | Frontmatter (id, status, affects, date); the Decision's first sentence. |
| `hsdd/conventions.md` | Project name, OQ prefixes, Coding method. |

A pre-0.6.1 bare `**Field:** value` block, a table with unexpected columns,
or a phase heading the summary table does not list each become `unparsed[]`
entries, never guesses. Dependency edges come from the table, never from the
Mermaid block.

**Cross-checks:** every summary-table row has a phase section and the reverse;
every Depends and Collides entry names a phase in the same node; there are no
cycles; every contract ref resolves to a file or is marked "named, not yet
written"; every ADR cited has a file; every OQ cited is defined once.

### 6.2 Views

- **Top:** the root's children as boxes. Each box carries its explanation and
  its phase count. Edges come from the dependency table. No status: status
  belongs to the checkpoint page.
- **Internal node:** its children diagram, the same way down.
- **Leaf-parent:** its phase graph. Boxes are coloured by tier; edges come
  from Dependencies; collisions are dashed lines, counted rather than drawn
  when a dependency already orders the pair.
- **Phase card:** Scope, Consumes and Produces as contract chips, Governed by,
  the resolved gate, Verification intent, tier, size, Collides with, and the
  "delivers" prose.
- **Contracts:** a producer-to-consumer view layered to at most 12 boxes,
  each contract marked draft, stable, provisional (`phase_ids:
  provisional`), deprecated, retired, or named-not-written. A contract card
  shows the Guarantees one per line and the "promise" prose.
- **ADRs:** a coverage table from `Governed by` and `affects`.
- **Retired nodes** are hidden from the active view (v0.8 §11.6) and listed
  behind a toggle. Adopted nodes carry an as-built marker.

### 6.3 What to check, at every level

Full-review phases; collisions no dependency orders; provisional contracts;
contracts named but not written; open OQs and the phases contingent on them;
undrained governance updates; ADRs cited with no file. Each list is scoped to
the node being viewed and its descendants.

### 6.4 Audiences and prose

| Audience | Reads it to | Ids | Detail |
|----------|-------------|-----|--------|
| reviewer (default) | approve a spec level or a phase plan, then read the source | allowed | full |
| stakeholder | understand without reading the source | never; glossed | counts instead of lists; no gates, no OQ text |
| implementer | orient before a phase | allowed | full, plus gates |

| Slot | Words | Audience |
|------|-------|----------|
| Node explanation | 25 | all; no ids |
| Node note | 40 | one per audience, optional |
| Phase "delivers" | 25 | reviewer, implementer |
| Contract "promise" | 40 | all; no ids |
| Glossary entry | a few words | stakeholder |

### 6.5 When it runs

After each `hsdd-spec` level and after each phase plan, so the reviewer opens
the page in the same MR as the specs. Under the standalone-spec-repo profile
it is committed in the spec repo with the change it summarizes.

## 7. The checkpoint page

### 7.1 File and stamp

`hsdd/summary/checkpoint.html`. Living, like the atlas: the filename has no
date, so the page carries a visible stamp naming its date and the exact
filenames of the chain heads it read. Its history is git's. Keeping it under
`hsdd/summary/` leaves both write rules intact: `hsdd-checkpoint` writes
`hsdd/management/`, `hsdd-summary` writes `hsdd/summary/`.

### 7.2 Extraction (`extract checkpoint`)

The chain heads: the latest progress report, execution plan and milestone
document, and the atlas. Earlier reports and plans are read through the
supersedes chain for the computed values in §7.3.

| Source | What the parser reads |
|--------|-----------------------|
| Progress report | Header lines (date, Supersedes, Repo baselines, Companion docs, Method, Stale summaries); the Bottom line table; the bold one-sentence read; the Milestone gate status table, each cell split on ☑ and ☐ into items; the re-baseline trigger arms; the What is done table; Blockers (numbered, with bold lead and step and finding refs); the findings register (id, severity, area, bold lead, body); the Verdict. |
| Execution plan | Header lines; lanes and the delegation legend; Current state; the Ownership split table; the Sync points table; each sync section's Entry, Agenda (decisions found by their `**D-{n} ·` lead, with options and "Lands in"), Exit and Unblocks; every step table, whatever its columns, located by an ID, Owner and Action header; the waiver table; step details by `### {step-id} ·` heading (mode emoji, owner, Prompt block and Validate, or Why, Do and Done when); External tracks; Timeline; Guardrails (accepted ranges, rejected numbers, proposals); the Change log. |
| Milestone document | Milestone ids, names, dates and gate items. |
| Atlas | Done and total per node, from the per-node phase-status tables. |

**The plan graph is recomputed** from Depends columns and Unblocks lines, never
parsed from the plan's Mermaid block. v0.7.1 already says the tables win when
graph and tables disagree.

The real documents drift from the mandated shapes: a build-lane step table
without a Finding column, an extra "Waived or closed without a step" table,
guardrails cited by reference across earlier plans, a house-style note. The
parser treats a recognised variant as data and anything else as
`unparsed[]`.

### 7.3 Computed by the script

- **The findings→plan loop:** each register row maps to the steps whose
  Finding column cites it, or to a waiver row. Orphans are flagged.
- **References:** every Depends entry resolves to a step, a sync that has a
  section, or a decision defined in an Agenda. Every decision is defined
  once.
- **Carried age:** the number of consecutive progress reports in the chain
  whose register holds a finding id, and the number of consecutive plans in
  which a step has stayed unticked.
- **Delta:** which of the previous plan's steps are ticked (landed) and which
  are not.
- **Gate movement:** each milestone's met/total against the previous report.
- **Graph size:** the recomputed plan graph against the ~20-node ceiling.

Violations of the first two appear on the page under "Plan integrity", as
information. They are `hsdd-checkpoint`'s own quality gates made visible
(§7.6).

### 7.4 Views

Every card links to its anchor in the source markdown: the markdown stays the
record.

- **Top (lead):** the one-sentence read; bottom-line tiles; milestone gate
  bars with ▲ and ▼ against the previous report; the next syncs as cards (date,
  gating or standing, decision count); the plan graph, clickable; blockers in
  rank order with step chips; findings by severity, each with its carried
  age.
- **Sync:** the Entry checklist with the lane that owes each item; each
  decision with its options and where its answer lands; the Exit checklist;
  Unblocks per lane; the steps that depend on the sync.
- **Lane:** its steps in dependency order with status; its timeline row; the
  nodes, contracts and external tracks it owns.
- **Step:** mode, owner, action, Depends chips, finding chips, then either the
  prompt with a copy button and the Validate line, or Why, the Do checklist
  and Done when.
- **Finding:** severity, area, full text, carried age, its landing step or
  waiver, and links to the earlier reports that held it.
- **Milestone:** each item, met or unmet, and for an unmet item what it waits
  on, as chips to steps, phases and external tracks.
- **Status tree:** the atlas lens, drawn on the same node graph the plan page
  uses: done and total per node, opening to the node's phase statuses.

### 7.5 Audiences and prose

| Audience | First view | Ids |
|----------|-----------|-----|
| lead (default) | everything in §7.4 | allowed |
| executor | pick a lane: its step cards in full, the Entry items it owes, the syncs it attends | allowed |
| stakeholder | bottom line, milestones in plain words, calendar outlook, verdict | never |

The markdown is already prose, so the slots are few:

| Slot | Words | Audience |
|------|-------|----------|
| Milestone explanation | 25 | stakeholder |
| Verdict | 60 | stakeholder |
| Blocker gist | 25 | stakeholder |

The lead and executor read the source text as written.

### 7.6 The `hsdd-checkpoint` step, gated

Only when `hsdd/summary/` exists:

- **At step 3**, run `summary.mjs check` and list the stale plan page and
  prose entries on the progress report's optional `**Stale summaries:**`
  header line (`none` when fresh). It is information only: never a
  findings-register row, a plan step, or a gate.
- **After step 6**, render the checkpoint page through `hsdd-summary`. If it
  reports a Plan integrity violation, fix the new plan before landing; the
  violation is a failed checkpoint quality gate, not a finding.
- **At step 8**, the page lands in the same commit as the management
  documents.

A tree without `hsdd/summary/` never reaches any of this. The management
document shapes do not change apart from the optional header line.

## 8. Changes to the specification

`spec/hsdd-spec-v0_9.md` is `spec/hsdd-spec-v0_8.md` with these changes; the
v0.8 file stays in `spec/` as history.

| Chapter | Change |
|---------|--------|
| 1 | The skill table gains `hsdd-summary`; `hsdd-config`'s row names both coding methods. |
| 9 | Retitled "Execution: Phase Context and Coding Methods". §9.2 restated around the generic context (§4.2, §4.3), with the "~20 lines" figure replaced. New sections: the OpenSpec derivative, the superpowers derivative and its run, choosing the method. §9.3 (ephemeral `config.yaml`) stands. |
| 12 | §12.3 gains the optional Stale summaries line. §12.6's in-progress derivation names `hsdd-context/`. §12.7 gains the gated step. |
| New 13 | "Reading Aids": the engine, its requirements and identity, the plan page, the checkpoint page. Later chapters renumber. |
| 13 → 14 | The layout gains `hsdd-context/`, `hsdd/summary/` and `hsdd/schema/`; the single-root rule names its two exceptions; the conventions file gains Coding method. |
| 14 → 15 | Upgrading: an undeclared project is `openspec`; `hsdd-context/` appears on the first switch; `hsdd/summary/` is opt-in. |
| 15 → 16 | The atlas non-goal is narrowed (§3.3). |
| 17 → 18 | New rows, all `reasoned-only`: generic phase context, derivatives wrap, method selection, reading aids, the narrowed atlas non-goal. |
| 18 → 19 | Glossary: generic phase context, derivative, coding method, reading aid, plan page, checkpoint page, carried age. |

## 9. Skill surface

| Skill or file | Change |
|---------------|--------|
| `hsdd-config` | Rewritten around §4. Description and triggers gain superpowers ("start phase X with superpowers", "superpowers input for phase X", "phase context for X"). The "Do NOT use for non-OpenSpec projects" exclusion goes. |
| `commands/hsdd-phase.md` | `--method`; still a one-line delegator. |
| `hsdd-spec` conventions template | Coding method line; `hsdd-context/` and `hsdd/summary/` paths. |
| `hsdd-checkpoint` | §4.8 evidence source; the §7.6 gated step; one quality-gate row for each. |
| `hsdd-summary` (new) | §5 to §7. |
| `commands/hsdd-summary.md` (new) | One-line delegator. |
| README, users guide, CHANGELOG | The new skill, both methods, the reading aids. |

`hsdd-adopt` and `hsdd-intake`, specified by v0.8 and not yet built, are not
touched and are not needed by anything here.

## 10. Testing

**Scripts**, with `node --test`, on synthetic fixtures:

- **A tree fixture** with deliberate drift: a pre-0.6.1 bare `**Field:**`
  block, a contract named but not written, a provisional contract, an
  undrained governance section, an open OQ with a contingent phase, a retired
  node, and an adopted node.
- **A three-report management chain** with the drift seen in the field: step
  tables with differing columns, a waiver table, guardrails by reference, a
  house-style note, a finding carried across all three reports, a step
  unticked across two plans, and one orphan finding.
- **Snapshot tests** of the model and of every view in every audience.
- **Escaping:** hostile strings (`</script>`, `"><svg onload=…>`, `{{`) in
  every field type render inert.
- **Offline:** no `http:` or `https:` in any `src`, and none in any `href`
  apart from source links.
- **Stakeholder id scan** (§5.4 rule 6).
- **Stamp and check round-trips:** changing any input flips `check` to stale
  for exactly the dependent page and slots.

**Skills** (`hsdd-config`, the `hsdd-checkpoint` amendment) are prose and are
proven by acceptance, not unit tests.

## 11. Acceptance criteria

Run locally in a cold-context session (the `claude-work` alias), with
expectations committed before the run, as in v0.7. Nothing from the microsite
project is committed.

- **A1.** `/hsdd-phase {pending phase} --method superpowers` on microsite-fe
  writes the generic file and the derivative; the equality check is clean;
  the self-contained gate passes.
- **A2.** A fresh session given only the superpowers derivative writes a plan
  with `writing-plans` without asking for context outside the file and its
  links, and the plan passes the plan check.
- **A3.** The OpenSpec derivative for the same phase contains every line of
  the three blocks today's switch would inject.
- **A4.** An OpenSpec-method switch on an undeclared project writes
  `config.yaml` (project-wide sections and `rules:` unchanged, phase blocks
  per §4.4) and `hsdd-context/{phase-id}.md`, and nothing else.
- **B1.** The plan page renders the microsite tree. `unparsed[]` is resolved,
  `validate` is clean, `check` reports it fresh, and it opens with networking
  disabled.
- **B2.** The stakeholder view of B1 contains no registered id.
- **C1.** The checkpoint page renders the 2026-09-18 chain, and the values
  pinned before the run match: F-189's carried age, F-195 at three passes,
  the loop's orphan count, and M6 at 2/8 moved up from 0/8.
- **C2.** Inverted criterion: the run fails if the page shows a known defect
  in the pinned set as clean.
- **C3.** A checkpoint run on a tree without `hsdd/summary/` writes no Stale
  summaries line, renders no page, and runs no `hsdd-summary` script.

## 12. Risks

| Risk | Mitigation |
|------|------------|
| The agent paraphrases while building the generic context. | Rule 1 of §4.3 plus the self-contained gate; A3 checks the OpenSpec superset. Escalation path if the field shows drift: a generator script in a later release, recorded as deferred. |
| Field documents drift past what the parser recognises. | `unparsed[]` plus agent fill. The parser's recognised variants grow from fixtures; nothing is guessed. |
| The checkpoint page becomes the thing people read instead of the plan. | Every card links to its source anchor; the stamp names the source files; the page is derived and never edited. |
| Rendering a 900-line plan costs too many tokens. | The script parses; the agent touches only `unparsed[]` and three stakeholder slots. |
| `hsdd-context/` files go stale mid-phase. | The stamp names the spec SHA; re-running the switch rewrites the file whole. |

## 13. Non-goals

| Excluded | Why |
|----------|-----|
| A generator script for the phase context | The scripting boundary; deferred until the field shows prose drift. |
| Markdown views from `hsdd-summary` | Nobody asked for them. They can come later on request. |
| Order of work, waves, and critical path across nodes on the plan page | The checkpoint page's plan graph covers cross-node order. |
| A JIRA preview, readiness records, request maps | HSDD has none of these artifacts. |
| An interactive atlas | The atlas stays markdown (§3.3). |
| Methods beyond OpenSpec and superpowers | The generic file serves Claude Code planning and people as it stands; a new method later is a new derivative, never a change to the generic template. |

## 14. Implementation plans

Three plans, written after this document is approved:

- **Plan A, item 1.** `hsdd-config`, `commands/hsdd-phase.md`, the
  conventions template, the `hsdd-checkpoint` evidence source, spec chapters
  9, 12 (§12.6) and 14. Prose only. Independent of B and C, and can run in
  parallel with B.
- **Plan B, the engine and the plan page.** `hsdd-summary`, its scripts,
  schemas and tests, the command, and the new Reading Aids chapter's engine
  and plan-page sections.
- **Plan C, the checkpoint page.** The checkpoint extraction, model and views,
  the gated `hsdd-checkpoint` step, the rest of the Reading Aids chapter, and
  the release wrap-up (README, users guide, CHANGELOG, settled decisions,
  glossary, acceptance record). Depends on B.

Commits are authored as `Purbo Mamad <m.purbo@gmail.com>`; the branch is
pushed after each task-sized commit.
