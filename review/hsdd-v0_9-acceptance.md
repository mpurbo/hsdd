# HSDD v0.9 Acceptance

**Status:** Expectations committed before any run. Results are recorded below
each criterion after the run, never edited into the expectations.
**Method:** a cold-context session (the operator's `claude-work` profile) with
the v0.9 skills installed, run against the microsite project's implementation
repos. Nothing from that project is committed here beyond the identifiers this
record names.
**Spec:** `docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md` §11.

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
