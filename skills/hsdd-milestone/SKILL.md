---
name: hsdd-milestone
description: >
  Use when generating or re-baselining an HSDD project's milestone document —
  the stakeholder view: demo + gate checkpoints, launch window, contingent
  tail. Triggers: "generate the milestone document", "stakeholder
  checkpoints", "when can we launch", "re-baseline the milestones", "the
  milestone slipped two weeks", "scope changed, do the dates hold". Runs once
  all leaf-parents are phase-planned, and again only on the slip or scope
  trigger. Do NOT use for weekly gate ticking or progress reporting
  (hsdd-checkpoint), phase planning (hsdd-phase-plan), or recording the
  decisions a re-baseline produces (hsdd-adr / the owning spec).
---

# HSDD Milestone: Stakeholder Checkpoints With Demos and Gates

Generate the milestone document: the project's progress checkpoints as
stakeholders see them — each a demo plus a measurable gate — with the launch
window and the externally-gated contingent tail. Re-baseline it when reality
moves the dates.

**Core principle:** a milestone is something a stakeholder can **watch
work**, gated by checks that answer yes or no. Internals ("module X
complete") are not milestones; unmeasurable gates are not gates. And the
document cites, never defines — every number traces to the phase plans and
the latest progress report.

## When to Use

- **Generation:** every leaf-parent node has a phase plan — the first moment
  total scope is computable.
- **Re-baseline:** the slip trigger (a gate red across two consecutive
  checkpoints) or the scope trigger (a change moved the phase totals and
  the dates cannot absorb it).

**Do NOT use for** weekly gate ticking (that is `hsdd-checkpoint`'s step),
progress reporting, or phase planning.

> **Precondition (hard stop):** every leaf-parent node has a phase plan. A
> milestone document generated before that is guesswork wearing a suit. If
> any leaf-parent lacks a phase plan, **stop and name the missing plans**
> instead of generating.

## Process

1. **Verify the precondition.** Walk the spec tree; every leaf-parent must
   have a `## Phase Plan` section. Missing plans: stop, list them, done.
2. **Take calibration.** Velocity comes from the latest progress report's
   calibrated rates. If no progress report exists yet (planning finished
   before implementation started), use the phase plans' assumed rate and a
   wider stated uncertainty band. Either way, the document states which of
   the two it used.
3. **Adopt, don't duplicate.** If a milestone document already exists, it
   is the current baseline: generation is only legal if none exists;
   otherwise you are here for a re-baseline (step 6). Never mint a second
   parallel milestone chain.
4. **Derive milestones from the dependency structure** — what becomes
   demonstrable when — not from the org chart or the node list. Each
   milestone gets:
   - a **demo**: something a stakeholder can watch work ("publish via API
     on staging and fetch the public page"), and
   - a **gate**: yes/no checkboxes, where "phase X done" always means:
     implemented, gate command green, verification doc merged to the spec
     repo's main branch.
5. **Compute the contingent tail.** Every phase marked
   `contingent (OQ-id)` on an external question lands in the tail: what it
   waits on, its entry criterion, its estimate — **excluded from the
   launch gate**, each with a pre-agreed degradation path stated in the
   document ("dashboard ships in 'coming soon' state; the tail ships
   post-launch — this is the plan, not a slip"). An externally-gated phase
   inside the launch gate is a generation error.
6. **Re-baseline (when triggered).** If the dates hold — the buffer
   absorbs the change — *absorb*: update gates, append to the change log,
   same file. If the dates move — *re-baseline*: a new dated document
   superseding the old **by exact filename**, with the old window and the
   new window both stated, so the slip is visible instead of silently
   renormalized. A re-baseline is a stakeholder event: report what
   changed, why, and what was decided (add people, cut scope, move the
   window) — and that decision lands in its governance artifact, not
   here.

## Document Shape (`management/YYYY-MM-DD-milestones.md`)

Required sections, in order:

- Header block: date, audience, `**Basis:**` (the progress report or
  assumed-rate statement), `**Supersedes:**` on re-baselines,
  `**Execution detail:**` link to the current plan.
- **How to read this** — demo/gate semantics, the slip tolerance (how many
  days a milestone may slip before it triggers anything), the launch
  window as a **base / optimistic / pessimistic** triple.
- **Milestones** — one section per milestone: demo, then gate checkboxes.
  An overview diagram (Mermaid) of the milestone sequence is recommended;
  if `mermaid-pastel-style` is installed, follow it.
- **Contingent tail** — the table from step 5 with degradation paths.
- **Tracking** — who ticks (the weekly checkpoint), the re-baseline
  trigger (a gate red across two consecutive checkpoints, or totals
  moved), and the single source of truth for "done".
- **Change log.**

## Quality Gates

- [ ] Precondition verified — or the run stopped naming the missing phase
      plans.
- [ ] Calibration source stated (progress report vs assumed rate + wider
      band).
- [ ] Every milestone has a watchable demo and yes/no gate checkboxes;
      "done" uses the pinned definition.
- [ ] Every externally-contingent phase is in the tail with a degradation
      path; none inside the launch gate.
- [ ] Launch window stated as base / optimistic / pessimistic.
- [ ] Re-baseline: old and new windows both stated; supersedes by exact
      filename; absorb-vs-re-baseline choice justified in the change log.
- [ ] No decision recorded here that is not also landed (or scheduled to
      land) in a governance artifact.
- [ ] No second milestone chain: an existing document was adopted or
      superseded, never duplicated.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Phase planning is nearly done — generate now" | Total scope is not computable from nearly. Stop and name the missing plans; a week early buys a document that lies. |
| "Milestone = backend complete" | Stakeholders can't watch "complete". Find the demonstrable slice the dependency structure makes available. |
| "This external phase is critical, keep it in the launch gate" | Its timing is not yours to promise. Tail it with a degradation path — that converts uncertainty into a decision already made. |
| "The dates moved a little, just update them" | Moved dates are a re-baseline: both windows stated, supersedes chain, stakeholder event. Silent renormalization hides the slip until it can't be managed. |
| "I'll tick the gates while I'm here" | Ticking is the checkpoint's step — one writer per rhythm. This skill runs at generation and re-baseline, nothing between. |
| "No progress report yet, so I'll guess a velocity" | Don't guess silently. Use the phase plans' assumed rate, widen the band, and say exactly which source the numbers came from. |
