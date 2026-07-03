---
name: hsdd-config
description: >
  Use when setting up or updating OpenSpec's config.yaml for an HSDD project
  (project init and the engine adapter). Triggers: "configure openspec", "setup
  openspec config", "why didn't openspec use TDD", "wire skills into the
  openspec workflow", "openspec not picking up discipline", "add the phase
  context markers". The per-phase context switch itself is mechanical and
  belongs to the CLI: run `npx hsdd context {phase-id} --write` (or the
  /hsdd-new command). Do NOT use for non-OpenSpec projects, general CLAUDE.md
  configuration, or creating OpenSpec change artifacts like proposal/design/
  tasks (those are OpenSpec's own steps).
---

# HSDD Config: Project Init and the Engine Adapter

Configure OpenSpec's `config.yaml` once so every artifact inherits project
context, invokes the right companion skills, and carries the marked region the
CLI splices phase context into. This skill owns the judgment (what context, which
skills, which rules); the per-phase switch is a pure function owned by
`hsdd context`.

**Two problems it solves:**
1. **Lost discipline.** Skills are session-scoped; TDD invoked in one session is
   forgotten in the next. `config.yaml` is the cross-session memory.
2. **A stable adapter boundary.** The Phase Context artifact produced by
   `hsdd context` is engine-neutral markdown; this config is the one adapter
   that binds it to OpenSpec. If the engine changes, only this adapter changes.

## When to Use

- **New project:** after `openspec init` (run once, at the repo root: the same
  directory that holds `docs/`, `contracts/`, and `adr/`. One HSDD tree has one
  OpenSpec project).
- **Missing discipline:** the agent skipped TDD, conventions, or the phase rules.
- **New companion skills installed:** weave them into the workflow.
- **Markers missing:** `hsdd context --write` reports no marker pair.

**NOT for the phase switch.** Starting a phase is `/hsdd-new {phase-id}` (or
`npx hsdd context {phase-id} --write` by hand). The context is derived from the
tree at cycle start; nothing needs to be remembered, and stale context cannot be
inherited.

## Process

1. **Discover context.** Read `docs/conventions.md` (including its frontmatter),
   `docs/spec/*.md` (by path, not in full), `CLAUDE.md`, and tech-stack files
   (`Cargo.toml`, `package.json`).
2. **Ensure the CLI is available:** `npm i -D hsdd` (or confirm `npx hsdd`
   resolves). Every deterministic operation depends on it.
3. **Discover companion skills** actually installed (e.g. `superpowers:*`,
   `fp-rust`). Only reference ones present; missing ones degrade gracefully.
4. **Map skills to workflow steps** (table below).
5. **Generate `config.yaml`** with a `context:` and a `rules:` section, including
   the literal phase-context markers.
6. **Present for review:** which docs were used, which skills mapped.

## Skill-to-Step Mapping

| OpenSpec step | Companion skill | Why |
|---------------|-----------------|-----|
| design | `superpowers:brainstorming` (if exploratory) | explore alternatives first |
| apply | `superpowers:test-driven-development`, tech skills (`fp-rust`, ...) | TDD per task, language conventions |
| post-apply | `superpowers:verification-before-completion` | evidence before done |
| on failure | `superpowers:systematic-debugging` | root-cause, not patch |
| review gate | `hsdd-review` | tiered human gate, learnings dispositioned |

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

  <!-- hsdd:phase-context:begin -->
  <!-- hsdd:phase-context:end -->

rules:
  proposal:
    - "First line: 'Phase: {phase-id}' (the current phase id from the Current Phase section)."
    - "Scope this proposal to a single HSDD phase."
    - "Reference the phase scope, consumed/produced contracts, and gate."
    - "Include the review tier (gate-only, spot-check, full-review)."
  specs:
    - "Every requirement MUST have at least one WHEN/THEN scenario."
    - "Scenarios must be directly translatable to TDD test cases."
  design:
    - "Follow the ordering policy from docs/conventions.md (default interfaces-first)."
    - "Justify decisions with rationale and alternatives; flag risks with mitigations."
  tasks:
    - "Order tasks for TDD: test first, then implementation."
    - "Each task completable in one red-green-refactor cycle."
    - "Include a gate task that runs the phase gate command."
    - "After the gate task, add a documentation task that (1) updates docs/conventions.md with newly established contracts, and (2) writes the verification doc at docs/verify/{phase-id}.verification.md (commands to run, expected output, what to inspect, a Learnings section)."
```

Only valid artifact ids are `proposal`, `design`, `specs`, `tasks`. Adding any
other id makes OpenSpec reject the config. Quote any rule containing `: `.

The markers are load-bearing: `hsdd context {phase-id} --write` replaces only
the region between them, so project-wide context and `rules:` are untouched by
construction, not by instruction. Never remove them; never write inside them by
hand.

## Parallel Phases

One working copy has one `config.yaml`; that is a physical fact. Concurrent
phases therefore require one git worktree per active phase (branch
`hsdd/{phase-id}`), each with its own spliced config. Sequential phases in a
single checkout are fine: `/hsdd-new` re-derives the context each time.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll paste the phase section into config myself" | The context is a pure function of the phase id. Run `npx hsdd context {phase-id} --write`; hand-pasted context drifts and skips the ADR/contract error paths. |
| "CLAUDE.md already has my conventions" | CLAUDE.md is not injected into OpenSpec instructions. config.yaml is. |
| "I'll remember to invoke TDD manually" | Sessions do not share memory. config.yaml does. |
| "The markers look like clutter, drop them" | Without the marker pair the CLI has nowhere to splice and hard-errors. They are the adapter. |
| "Two parallel phases, one checkout, I'll be careful" | One file cannot hold two contexts. Worktree per active phase, required. |
