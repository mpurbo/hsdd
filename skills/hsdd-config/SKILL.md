---
name: hsdd-config
description: >
  Use when setting up or updating OpenSpec's config.yaml for an HSDD project, or
  switching the phase context before starting an OpenSpec change. Triggers:
  "configure openspec", "setup openspec config", "switch phase context to X",
  "phase context switch", "why didn't openspec use TDD", "inject consumed
  contracts", "wire skills into the openspec workflow", "openspec not picking up
  discipline", "start phase X" or "begin phase X" (meaning switch the OpenSpec
  phase context, not write code). Do NOT use for non-OpenSpec projects, general
  CLAUDE.md configuration, or creating OpenSpec change artifacts like
  proposal/design/tasks (those are OpenSpec's own steps).
---

# HSDD Config: Phase-Scoped OpenSpec Context

Configure OpenSpec's `config.yaml` so every artifact inherits project context,
invokes the right companion skills, and sees only the current phase plus its
dependencies. Run once for setup, then switch the phase context before each new
OpenSpec change.

**Two problems it solves:**
1. **Lost discipline.** Skills are session-scoped; TDD invoked in one session is
   forgotten in the next. `config.yaml` is the cross-session memory.
2. **Wasted tokens.** Loading a full node spec into every session when one phase
   section plus its consumed contracts (~20 lines) is all that is needed.

## When to Use

- **New project:** after `openspec init` (run once, at the repo root: the same
  directory that holds `hsdd/`. One HSDD tree has one
  OpenSpec project), or when `config.yaml` is empty/default.
- **Starting a phase (critical):** switch the phase context BEFORE `opsx:new`. If
  config still references the previous phase, every artifact inherits stale
  context (wrong contracts, wrong gate, wrong verification).
- **Missing discipline:** the agent skipped TDD, conventions, or progressive phases.
- **New companion skills installed:** weave them into the workflow.

## Process

1. **Discover context.** Read `hsdd/conventions.md` (a pre-0.5 project has it at
   `docs/conventions.md`: honor its layout and offer to migrate), `hsdd/spec/*.md`
   (by path, not in full), `CLAUDE.md`, and tech-stack files (`Cargo.toml`,
   `package.json`).
2. **Discover companion skills** actually installed (e.g. `superpowers:*`,
   `fp-rust`). Only reference ones present; missing ones degrade gracefully.
3. **Map skills to workflow steps** (table below).
4. **Generate `config.yaml`** with a `context:` and a `rules:` section.
5. **Copy the bundled verification template** into the project (see
   "Verification Doc Template" below) if `hsdd/templates/verification.md` does
   not already exist.
6. **Present for review:** which docs were used, which skills mapped, which phase
   is current.
7. **Switch phase context** before each new change (see below).

## Skill-to-Step Mapping

| OpenSpec step | Companion skill | Why |
|---------------|-----------------|-----|
| design | `superpowers:brainstorming` (if exploratory) | explore alternatives first |
| apply | `superpowers:test-driven-development`, tech skills (`fp-rust`, ...) | TDD per task, language conventions |
| post-apply | `superpowers:verification-before-completion` | evidence before done |
| on failure | `superpowers:systematic-debugging` | root-cause, not patch |

## config.yaml

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

  ## Current Phase: {phase-id} - {Phase Name}
  <paste the phase section: scope, contracts consumed/produced, gate,
  verification, review tier, dependencies>

  ## Contracts from Prior Phases / Nodes
  <for each consumed contract id, paste ONLY its Interface + Guarantees>

  ## Governing Decisions
  <for each ADR referenced by this phase or its consumed contracts, paste ONLY
  the Decision + Consequences>

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

## Verification Doc Template

The documentation task's tasks-rule (above) writes each phase's verification
doc from a fixed template, not from a description. On first setup, copy the
bundled `templates/verification.md` **verbatim** from this skill into the
project as `hsdd/templates/verification.md` (this skill's base directory is
printed when the skill loads) — same precedent as `gen-registry.mjs` in
`hsdd-contract`: copy the file, never retype it. A retyped template drifts
(a paraphrased Outstanding section or a dropped Sign-off silently loses the
gate condition below).

The template's depth scales with the review tier (gate-only: slim; spot-check:
short; full-review: full — see the tasks rule above), but every tier keeps the
Sign-off section. **The review gate is not passed while an Outstanding item
lacks a disposition** (`verified` | `waived (reason)` | `deferred to
{phase-id}`).

## Phase Context Switch (do this BEFORE opsx:new)

1. Open the leaf-parent node spec, find the next phase section.
2. Replace `## Current Phase` with that phase's block.
3. Replace `## Contracts from Prior Phases / Nodes` with only the Interface +
   Guarantees of each consumed contract id.
4. Replace `## Governing Decisions` with only the Decision + Consequences of each
   referenced ADR. If a referenced `ADR-NNN` has no file under `hsdd/adr/`, it was
   never materialized: stop and author it with `hsdd-adr` first. You must not
   invent the decision; the human supplies it. If the decision content is not
   available, author the ADR as `status: proposed` with the Decision left as an
   explicit TODO, and do not inject it as binding until it is `accepted`. Do not
   silently drop the reference.
5. **Next-runnable check.** Warn if the requested phase is already archived
   under `openspec/changes/archive/` (it already ran; switching to it again is
   likely a mistake), or if a dependency phase's change is neither archived nor
   merged (its contracts/decisions may not be what this phase expects to
   consume).
6. **Reconcile check.** If any consumed contract has `phase_ids: provisional`,
   or the node's plan has an unresolved `request` naming it, warn and recommend
   running `hsdd-reconcile` first. If the phase being started is listed under a
   request's `contingent phases`, stop and require explicit human confirmation
   before proceeding.
7. Do not touch the project-wide context or the rules.

This gives the session ~20 lines of phase context instead of a full spec. The
`/hsdd-phase {phase-id}` slash command, if installed, runs this step.

**`config.yaml` is ephemeral.** The `## Current Phase` block (and its
companion contract/ADR blocks) is per-session working state, rewritten by
every phase context switch. After any merge, conflicts in
`openspec/config.yaml` carry no information: take either side and re-run this
switch — see the conventions file's execution protocol.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll update config after creating the change" | Too late: artifacts already generated with stale phase context. Update BEFORE opsx:new. |
| "CLAUDE.md already has my conventions" | CLAUDE.md is not injected into OpenSpec instructions. config.yaml is. |
| "I'll remember to invoke TDD manually" | Sessions do not share memory. config.yaml does. |
| "Inject the whole node spec to be safe" | That defeats context isolation. Inject only the phase plus consumed contract interfaces and governing ADR decisions. |
| "The ADR is referenced but has no file; I'll paraphrase it" | A referenced ADR with no file was never materialized. Author it with hsdd-adr. If the decision is unknown, author it `proposed` with a TODO; never invent an `accepted` decision. |
| "The contract is provisional but close enough, inject it" | Provisional means reconcile has not confirmed both sides; open `request` entries may still reshape what this phase consumes. Warn, and stop for phases contingent on an open request. |
| "The config conflict looks meaningful, I'll hand-merge both phase blocks" | The Current Phase block is ephemeral working state. Take either side and re-run the phase switch. |
| "A design.md can't hurt for this gate-only phase" | It costs a full artifact plus review attention for a phase with nothing to decide. The tier sets the artifact profile; follow it. |
