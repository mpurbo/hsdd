---
name: hsdd-config
description: >
  Use when starting or switching to an HSDD phase before implementing it, with
  OpenSpec or with superpowers, or when setting up OpenSpec's config.yaml for
  an HSDD project. Writes one self-contained phase context per phase and wraps
  it for the coding method. Triggers: "start phase X" or "begin phase X"
  (meaning switch the phase context, not write code), "switch phase context to
  X", "phase context switch", "phase context for X", "start phase X with
  superpowers", "superpowers input for phase X", "configure openspec", "setup
  openspec config", "why didn't openspec use TDD", "inject consumed contracts",
  "wire skills into the openspec workflow", "openspec not picking up
  discipline". Do NOT use for writing code, general CLAUDE.md configuration,
  OpenSpec's own change artifacts (proposal, design, tasks), or the superpowers
  plan itself (superpowers:writing-plans writes it, starting from the file this
  skill writes).
---

# HSDD Config: One Phase Context, One Derivative per Coding Method

Before a phase is implemented, build its **generic phase context**: one
self-contained file with everything a coding session needs about the phase,
and nothing else. Then wrap it, word for word, in the **derivative** for the
project's coding method: OpenSpec's `config.yaml`, or a superpowers spec that
`superpowers:writing-plans` starts from. Set up OpenSpec once; switch the
phase context before every phase.

**Three problems it solves:**
1. **Lost discipline.** Skills are session-scoped; TDD invoked in one session
   is forgotten in the next. The derivative carries the discipline across the
   session boundary: `config.yaml` for OpenSpec, Global Constraints for
   superpowers.
2. **Wasted tokens.** A session needs the phase, the contracts it touches and
   the decisions that govern it, not the full node spec.
3. **One method only.** The phase context is method-neutral; only the wrapping
   belongs to a method. A new method is a new derivative, never a change to the
   generic context.

## Files

| File | Where | Written by | Committed |
|------|-------|------------|-----------|
| Generic phase context | `hsdd-context/{phase-id}.md` | every switch, any method | yes, on the phase branch; kept after the phase |
| Superpowers derivative | `hsdd-context/superpowers/{phase-id}.md` | a switch with method `superpowers` | yes, on the phase branch |
| OpenSpec derivative | `openspec/config.yaml` | Setup, and a switch with method `openspec` | ephemeral working state (see the switch) |

All three live in the implementation repo, outside `hsdd/`. They are execution
state, not governance: under the standalone-spec-repo profile `hsdd/` is a
submodule, and per-phase working state must not become a spec-repo push.
`hsdd-context/` is a default; `conventions.md` may override it. `{phase-id}` is
always the full dotted id (`acme.api.2`), even when the node's phase headings
use a short form (`api.2`).

## When to Use

- **New project with OpenSpec:** after `openspec init` (once, at the repo root:
  the directory that holds `hsdd/`; one HSDD tree has one OpenSpec project), or
  when `config.yaml` is empty or default. Run Setup.
- **Starting a phase (critical):** switch BEFORE `opsx:new`, or before starting
  `superpowers:writing-plans`. A session that starts on stale context inherits
  the wrong contracts, the wrong gate and the wrong verification.
- **Governance changed mid-phase:** re-run the switch; the files are rewritten
  whole.
- **Missing discipline:** the agent skipped TDD, conventions, or the
  verification doc.
- **New companion skills installed:** weave them in.

## Setup

1. **Discover context.** Read `hsdd/conventions.md` (a pre-0.5 project has it
   at `docs/conventions.md`: honor its layout and offer to migrate),
   `hsdd/spec/*.md` (by path, not in full), `CLAUDE.md`, and tech-stack files
   (`Cargo.toml`, `package.json`). If `conventions.md` declares
   `Profile: standalone-spec-repo`, `hsdd/` is a git submodule of this
   implementation repo. **Paths are unchanged**: the submodule mounts at
   `hsdd/`, so `hsdd/spec/…`, `hsdd/contract/…`, `hsdd/adr/…` resolve as
   written. Run from the implementation repo, never from a standalone clone of
   the spec repo, and see the pointer check in the switch.
2. **Read the coding method** from the `**Coding method:**` line of
   `conventions.md`: `openspec` or `superpowers`. No line means `openspec`.
3. **Discover companion skills** actually installed (`superpowers:*`,
   `fp-rust`, …). Reference only ones present; missing ones degrade gracefully.
4. **OpenSpec only:** map skills to workflow steps (table below) and generate
   `config.yaml` from the template in "The OpenSpec Derivative". Until the
   first switch, leave the two markers adjacent with nothing between them.
5. **Copy the bundled verification template** into the project if
   `hsdd/templates/verification.md` does not exist (see below).
6. **Present for review:** which docs were used, which skills mapped, the
   coding method.

## Skill-to-Step Mapping (OpenSpec)

| OpenSpec step | Companion skill | Why |
|---------------|-----------------|-----|
| design | `superpowers:brainstorming` (if exploratory) | explore alternatives first |
| apply | `superpowers:test-driven-development`, tech skills (`fp-rust`, ...) | TDD per task, language conventions |
| post-apply | `superpowers:verification-before-completion` | evidence before done |
| on failure | `superpowers:systematic-debugging` | root-cause, not patch |

With the superpowers method the skills are the method itself, and the
derivative's Global Constraints carry the discipline instead of this table.

## The Generic Phase Context

`hsdd-context/{phase-id}.md`. Fixed sections, in this order. Text in braces is
filled; everything else is literal.

```markdown
<!-- hsdd-phase-context {"phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Current Phase: {phase-id} - {Phase Name}

## Goal
{the phase's Scope value, verbatim}

## Where it sits
- Node: {node-id} · {the node's Purpose value, verbatim}
- Owns: {Owns, verbatim}
- Does not own: {Does not own, verbatim}
- Isolation strategy: {Isolation strategy, verbatim}

## Phase
{the phase's bullet block, verbatim, except that a Gate of `node default` is
replaced by the plan's default gate command in backticks}

## Contracts
### {contract-id}@{version} · {consumes|produces} · {status}
**Interface**
{the contract's Interface section body, verbatim}
**Guarantees**
{the contract's Guarantees section body, verbatim}

## Decisions
### ADR-{nnn}: {title} · {status}
**Decision**
{the ADR's Decision section body, verbatim}
**Consequences**
{the ADR's Consequences section body, verbatim}

## Open questions
- {OQ-id} · {status} · {the Question cell, verbatim}

## Discipline
- Test-first: write each behaviour's failing test, and see it fail, before
  the code that makes it pass.
- Governance freeze: change nothing under hsdd/ except this phase's
  verification doc; contracts, ADRs, specs and conventions change only
  through hsdd-contract, hsdd-adr and hsdd-reconcile.
- Consume contracts only: build against the Interface and Guarantees above,
  never against another node's internals.
- Verification doc: hsdd/verify/{phase-id}.verification.md from
  hsdd/templates/verification.md at {review tier} depth.

## Links (spec {spec-sha})
- Phase section: hsdd/spec/{node-id}.md, heading "{the phase's heading line as written}"
- Node spec: hsdd/spec/{node-id}.md
- {contract-id}@{version}: hsdd/contract/{contract-file} (omit this line for an external contract)
- ADR-{nnn}: hsdd/adr/{adr-file}
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
```

**Filling it:**

- **Node fields** come from the node's own spec file (`hsdd/spec/{node-id}.md`):
  its field block, under `## Node` or directly under the title. When the file
  has no field block, use the `### {node-id}: …` block embedded in the parent's
  spec.
- **Contracts:** every contract the phase's Consumes or Produces names, in that
  order, one subsection each. A contract named with `(ext)` or otherwise
  external and with no file under `hsdd/contract/` gets the subsection heading
  `### {contract-id}@{version} · consumes · external` (or `produces`) and the
  single line `External contract; no file in hsdd/contract/.`, and the switch
  warns. When the phase names no contract, omit the section.
- **Decisions:** the ADRs the phase's Governed by names, the ADRs each
  contract in the Contracts section names in its own Governed by, and every
  ADR whose `affects` frontmatter names such a contract; each once, in ADR
  number order. A `proposed` ADR keeps its subsection and gains the line
  `Not binding until accepted.` under its heading. When there are none, omit
  the section.
- **Open questions:** only the ids the phase or its contracts cite, with the
  status and question from the owning spec's table. Omit the section when there
  are none.
- **Spec SHA:** `git -C hsdd rev-parse --short HEAD`. If
  `git -C hsdd status --porcelain -- spec contract adr conventions.md` prints
  anything, append `-dirty` and warn: the file cites text that is not
  committed.
- **Date:** today, `YYYY-MM-DD`.

**Rules:**

1. **Selection, never authorship.** Every line is a verbatim excerpt from a
   governance file, a fixed text from the template above, or a link. Write no
   sentence of your own into the file. Do not summarize a contract, reorder its
   guarantees, or drop a line you judge unimportant.
2. **Self-contained.** Every contract, ADR and OQ id the file names has its
   text inline in its section. Other phases' ids appear only in the Phase
   block's Dependencies and Collides with lines.
3. **Push, not pull.** The links are for provenance and escalation. They never
   replace an inline excerpt.
4. **No truncation.** A context too large to read signals a phase that touches
   too much; the fix belongs in the phase plan, through `hsdd-phase-plan`.
5. **Rewritten whole.** Every switch overwrites the file. Never append, never
   patch by hand.

## The OpenSpec Derivative

`openspec/config.yaml`. The project-wide `context:` sections and the `rules:`
list are written at Setup and never touched by a switch. The phase block is the
generic file's body (everything after its first line, the stamp) between the
markers, indented two spaces as the YAML block requires.

```yaml
context: |
  ## Artifact Compliance
  After writing any artifact, re-read each rule and verify the content satisfies
  every rule. Fix violations before reporting completion.

  ## Project: <name>
  <1-2 sentence description>

  ## Tech Stack
  <language, framework, build system>

  ## Architecture Principles
  <3-5 bullets from the system spec or CLAUDE.md>

  ## Development Discipline
  - TDD (red-green-refactor): use superpowers:test-driven-development at apply.
  - <tech-specific>: use <skill> when writing <language>.
  - Conventions: see hsdd/conventions.md

  <!-- hsdd-phase-context:begin -->
  {the generic file's body, every line indented two spaces; blank lines stay blank}
  <!-- hsdd-phase-context:end -->

rules:
  proposal:
    - "If the Current Phase review tier is gate-only or spot-check, keep the proposal brief: a few lines stating what and why."
    - "Scope this proposal to a single HSDD phase."
    - "Reference the phase scope, consumed/produced contracts, and gate."
    - "Include the review tier (gate-only, spot-check, full-review)."
    - "Name the change's capability after a stable feature area of the node, not after the phase; use a per-phase capability name only when genuinely parallel phases would contend on the same capability spec."
  specs:
    - "Every requirement MUST have at least one WHEN/THEN scenario."
    - "Scenarios must be directly translatable to TDD test cases."
  design:
    - "If the Current Phase review tier is gate-only, skip design.md entirely; if spot-check, write design.md only when the phase settles a real design decision. Only full-review phases always get a full design.md."
    - "Follow FP-first architecture: types -> pure functions -> effects -> composition."
    - "Justify decisions with rationale and alternatives; flag risks with mitigations."
  tasks:
    - "Order tasks for TDD: test first, then implementation."
    - "Each task completable in one red-green-refactor cycle."
    - "Include a gate task that runs the phase gate command."
    - "After the gate task, add a documentation task that writes the verification doc at hsdd/verify/{phase-id}.verification.md following hsdd/templates/verification.md, at the depth the phase's review tier requires (gate-only: slim; spot-check: short; full-review: full)."
    - "Never update hsdd/conventions.md or hsdd/contract/ from a phase; governance changes are made at the root (hsdd-contract / hsdd-reconcile)."
```

Only valid artifact ids are `proposal`, `design`, `specs`, `tasks`. Adding any
other id makes OpenSpec reject the config. Quote any rule containing `: `.

## The Superpowers Derivative

`hsdd-context/superpowers/{phase-id}.md`:

```markdown
<!-- hsdd-derivative {"method":"superpowers","phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Current Phase: {phase-id} - {Phase Name}

> Start with superpowers:writing-plans, given this file's path. Do not start
> at brainstorming: this phase was designed and reviewed in HSDD. Save the
> plan under docs/superpowers/plans/ in this repository, never under hsdd/.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most {N} tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `{gate command}` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/{phase-id}.verification.md from
   hsdd/templates/verification.md at {review tier} depth, fills every section
   the template asks for at that depth, and leaves Sign-off for a human
   reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below
   (if any), never against another node's internals.
8. Review tier {review tier}: {tier line}.
{9. When writing {language}, use {skill}. One numbered line per installed tech skill.}

## Plan check

Run this after writing-plans' self-review, before choosing an execution method.

- [ ] The plan's Global Constraints contain constraints 1 to {last} above, verbatim.
- [ ] Every `### Task N:` except the last starts with a failing-test step.
- [ ] The last task writes the verification doc named in constraint 5.
- [ ] The plan has at most {N} tasks.
- [ ] The plan is saved under docs/superpowers/plans/.

<!-- hsdd-phase-context:begin -->
{the generic file's body, verbatim}
<!-- hsdd-phase-context:end -->
```

**Filling it:**

- **{N}** is the number in the phase's Size estimate (`<= 7 OpenSpec tasks`
  gives 7). With no number there, use 8, the sizing ceiling.
- **{gate command}** is the phase's Gate, with `node default` resolved, as in
  the generic file.
- **{tier line}** is one of these three, by the phase's Review tier:
  - gate-only: `no design discussion in the plan; slim verification doc.`
  - spot-check: `design notes only for a decision this phase actually settles; short verification doc.`
  - full-review: `design rationale for every non-obvious choice; full verification doc.`
- **Constraint 9** is one line per installed tech skill that `conventions.md`
  or `CLAUDE.md` names (`When writing Rust, use fp-rust.`), numbered 9, 10, …
  With none, there is no constraint 9 and `{last}` is 8.

### Running a phase with superpowers

1. Start a session in the implementation repo with
   `superpowers:writing-plans` and the derivative's path. Do not start at
   brainstorming, and do not say only "implement this phase": the session
   bootstrap sends a bare build request to brainstorming.
2. Run the derivative's Plan check before choosing an execution method, and fix
   every unticked item in the plan.
3. Execute with `superpowers:subagent-driven-development` (or
   `superpowers:executing-plans`, which loads `test-driven-development`).
4. The last task writes the verification doc. Superpowers keeps test evidence
   only in its implementers' reports, in a workspace it deletes after the final
   review; the verification doc is where the evidence lasts.

## Phase Context Switch (before `opsx:new` or `writing-plans`)

1. **Profile check first (standalone-spec-repo only).** Before reading anything
   through `hsdd/`, verify the submodule pointer references a spec-repo main
   commit. A pointer off main is stale or forked truth, and every line below
   would be read from it: stop and re-point the submodule to main, or get
   explicit human confirmation. Same reason `hsdd-checkpoint` pins baselines
   before reviewing content.
2. **Find the phase.** Open the leaf-parent node spec and its `## Phase Plan`.
   Match the requested phase by its full id or by the short form the headings
   use; the files are named by the full id. Read the method from `--method` if
   given, else from conventions.
3. **Gate.** If the phase's Gate is `node default` and the plan has no
   `**Default gate:**` line, stop and report the missing line. Never invent a
   command.
4. **ADRs.** If a referenced `ADR-NNN` has no file under `hsdd/adr/`, it was
   never materialized: stop and author it with `hsdd-adr` first. You must not
   invent the decision; the human supplies it. If the decision content is not
   available, author the ADR as `status: proposed` with the Decision left as an
   explicit TODO, and it enters the context as not binding. Do not silently
   drop the reference.
5. **Next-runnable check.** Warn if the phase already has
   `hsdd/verify/{phase-id}.verification.md` on spec-repo main (it is done), or,
   for OpenSpec, if its change is already under `openspec/changes/archive/`.
   Warn if a dependency phase has neither a verification doc nor a merged
   branch: its contracts and decisions may not be what this phase expects.
6. **Reconcile check.** If any contract the phase consumes or produces has
   `phase_ids: provisional`, or the node's plan has an unresolved `request`
   naming it, warn and recommend `hsdd-reconcile` first. If the phase is listed
   under a request's `contingent phases`, stop and require explicit human
   confirmation before proceeding.
7. **Write the generic phase context** from the template above.
8. **Self-contained gate.** Check rule 2 against the file you wrote: list every
   `@v`, `ADR-` and `OQ` id in it and confirm each has its subsection or line.
   Fix the file, never the rule.
9. **Write the derivative** for the method: replace the content between the
   markers in `openspec/config.yaml`, or write
   `hsdd-context/superpowers/{phase-id}.md`. Do not touch the project-wide
   context or the rules. When `openspec/config.yaml` has no markers (a v0.8
   config), replace v0.8's phase blocks (`## Current Phase`,
   `## Contracts from Prior Phases / Nodes`, `## Governing Decisions`, from
   the first of them through the end of the last) with the marked block, keep
   everything else, and say so once in the run report.
10. **Equality check.** The generic body must equal the text between the
    markers. For superpowers:
    `diff <(tail -n +2 hsdd-context/{phase-id}.md) <(sed -n '/hsdd-phase-context:begin/,/hsdd-phase-context:end/p' hsdd-context/superpowers/{phase-id}.md | sed '1d;$d')`.
    For OpenSpec:
    `diff <(tail -n +2 hsdd-context/{phase-id}.md) <(sed -n '/hsdd-phase-context:begin/,/hsdd-phase-context:end/p' openspec/config.yaml | sed '1d;$d' | sed 's/^  //')`.
    Both print nothing. Any output is a defect in the derivative: rewrite it.
11. **Report:** the files written, the method, the spec SHA (and any `-dirty`
    warning), every warning above, and for superpowers the exact line to start
    the session with:
    `Use superpowers:writing-plans to plan hsdd-context/superpowers/{phase-id}.md`.

The `/hsdd-phase {phase-id} [--method openspec|superpowers]` slash command, if
installed, runs this switch.

**`config.yaml` is ephemeral.** The phase block between the markers is
per-session working state, rewritten by every switch. After any merge,
conflicts in `openspec/config.yaml` carry no information: take either side and
re-run the switch (see the conventions file's execution protocol). The files
under `hsdd-context/` never conflict: each phase has its own.

## Verification Doc Template

The OpenSpec documentation task (the tasks rule) and the superpowers last task
(constraint 5) both write each phase's verification doc from a fixed template,
not from a description. On first setup, copy the bundled
`templates/verification.md` **verbatim** from this skill into the project as
`hsdd/templates/verification.md` (this skill's base directory is printed when
the skill loads), the same precedent as `gen-registry.mjs` in `hsdd-contract`:
copy the file, never retype it. A retyped template drifts (a paraphrased
Outstanding section or a dropped Sign-off silently loses the gate condition
below).

The template's depth scales with the review tier (gate-only: slim; spot-check:
short; full-review: full), but every tier keeps the Sign-off section. **The
review gate is not passed while an Outstanding item lacks a disposition**
(`verified` | `waived (reason)` | `deferred to {phase-id}`).

## Quality Gates

- [ ] The generic file exists at `hsdd-context/{phase-id}.md`, named by the
      full phase id, with a stamp naming the spec SHA (and `-dirty` when it
      applies).
- [ ] Every line in it is a verbatim excerpt, template text, or a link.
- [ ] The self-contained gate passed: every contract, ADR and OQ id named has
      its text inline, or its external one-liner.
- [ ] The derivative for the method was written, and the equality check
      printed nothing.
- [ ] For OpenSpec, the project-wide context and `rules:` are unchanged.
- [ ] For superpowers, the Global Constraints and Plan check are filled, with
      no braces left.
- [ ] Every stop (missing ADR, missing default gate, contingent phase) was
      honored; every warning is in the report.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll update the context after creating the change" | Too late: the session already started from stale context. Switch BEFORE `opsx:new` or `writing-plans`. |
| "CLAUDE.md already has my conventions" | CLAUDE.md is not injected into OpenSpec instructions, and a superpowers implementer sees only its task and the Global Constraints. The derivative is what carries them. |
| "I'll remember to invoke TDD manually" | Sessions do not share memory. The derivative does. |
| "Inject the whole node spec to be safe" | That defeats context isolation. The phase, its contracts and its decisions; links for the rest. |
| "This contract section is long, I'll summarize it" | Rule 1. A summary is your sentence, and the session will treat it as the contract. Copy it, or fix the phase plan if it is too much. |
| "The links are enough; the agent can open the contract" | Push, not pull. A link is for provenance; the text the phase depends on is inline. |
| "The ADR is referenced but has no file; I'll paraphrase it" | A referenced ADR with no file was never materialized. Author it with hsdd-adr. If the decision is unknown, author it `proposed` with a TODO; never invent an `accepted` decision. |
| "The contract is provisional but close enough" | Provisional means reconcile has not confirmed both sides; open `request` entries may still reshape it. Warn, and stop for phases contingent on an open request. |
| "The config conflict looks meaningful, I'll hand-merge both phase blocks" | The phase block is ephemeral working state. Take either side and re-run the switch. |
| "The derivative is close enough to the generic file" | The equality check exists because close enough is how two methods drift apart. Rewrite it until `diff` prints nothing. |
| "A design.md can't hurt for this gate-only phase" | It costs a full artifact plus review attention for a phase with nothing to decide. The tier sets the artifact profile; follow it. |
| "The submodule is a few commits behind; the context is probably fine" | A stale pointer injects governance that may have been amended or retracted on main. Bump the pointer first; it is one command. |
| "Superpowers will figure out the plan from 'implement this phase'" | A bare build request lands in brainstorming, which re-opens a design HSDD already reviewed. Start at writing-plans with the derivative's path. |
