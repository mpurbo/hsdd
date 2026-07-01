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

- **New project:** after `openspec init`, or when `config.yaml` is empty/default.
- **Starting a phase (critical):** switch the phase context BEFORE `opsx:new`. If
  config still references the previous phase, every artifact inherits stale
  context (wrong contracts, wrong gate, wrong verification).
- **Missing discipline:** the agent skipped TDD, conventions, or progressive phases.
- **New companion skills installed:** weave them into the workflow.

## Process

1. **Discover context.** Read `docs/conventions.md`, `docs/spec/*.md` (by path,
   not in full), `CLAUDE.md`, and tech-stack files (`Cargo.toml`, `package.json`).
2. **Discover companion skills** actually installed (e.g. `superpowers:*`,
   `fp-rust`). Only reference ones present; missing ones degrade gracefully.
3. **Map skills to workflow steps** (table below).
4. **Generate `config.yaml`** with a `context:` and a `rules:` section.
5. **Present for review:** which docs were used, which skills mapped, which phase
   is current.
6. **Switch phase context** before each new change (see below).

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
  - Conventions: see docs/conventions.md

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
    - "Scope this proposal to a single HSDD phase."
    - "Reference the phase scope, consumed/produced contracts, and gate."
    - "Include the review tier (gate-only, spot-check, full-review)."
  specs:
    - "Every requirement MUST have at least one WHEN/THEN scenario."
    - "Scenarios must be directly translatable to TDD test cases."
  design:
    - "Follow FP-first architecture: types -> pure functions -> effects -> composition."
    - "Justify decisions with rationale and alternatives; flag risks with mitigations."
  tasks:
    - "Order tasks for TDD: test first, then implementation."
    - "Each task completable in one red-green-refactor cycle."
    - "Include a gate task that runs the phase gate command."
    - "After the gate task, add a documentation task that (1) updates docs/conventions.md with newly established contracts, and (2) writes the verification doc at docs/verify/{phase-id}.verification.md (commands to run, expected output, what to inspect)."
```

Only valid artifact ids are `proposal`, `design`, `specs`, `tasks`. Adding any
other id makes OpenSpec reject the config. Quote any rule containing `: `.

## Phase Context Switch (do this BEFORE opsx:new)

1. Open the leaf-parent node spec, find the next phase section.
2. Replace `## Current Phase` with that phase's block.
3. Replace `## Contracts from Prior Phases / Nodes` with only the Interface +
   Guarantees of each consumed contract id.
4. Replace `## Governing Decisions` with only the Decision + Consequences of each
   referenced ADR.
5. Do not touch the project-wide context or the rules.

This gives the session ~20 lines of phase context instead of a full spec. The
`/hsdd-phase {phase-id}` slash command, if installed, runs this step.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll update config after creating the change" | Too late: artifacts already generated with stale phase context. Update BEFORE opsx:new. |
| "CLAUDE.md already has my conventions" | CLAUDE.md is not injected into OpenSpec instructions. config.yaml is. |
| "I'll remember to invoke TDD manually" | Sessions do not share memory. config.yaml does. |
| "Inject the whole node spec to be safe" | That defeats context isolation. Inject only the phase plus consumed contract interfaces and governing ADR decisions. |
