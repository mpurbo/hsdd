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

> **Fewer than two gate records?** The slip trigger is **un-evaluable**, not
> "not fired" — say so in those words. It needs two consecutive Milestone gate
> status sections to compare, so it cannot fire until the second checkpoint
> after this rhythm starts. Reporting an un-evaluable trigger as "not fired"
> reads as evidence of health that nobody gathered.

**Do NOT use for** weekly gate ticking (that is `hsdd-checkpoint`'s step),
progress reporting, or phase planning.

> **Precondition (hard stop):** every leaf-parent node has a phase plan. A
> milestone document generated before that is guesswork wearing a suit. If
> any leaf-parent lacks a phase plan, **stop and name the missing plans**
> instead of generating.

## Process

1. **Verify the precondition.** Walk the spec tree under `hsdd/spec/`; every
   leaf-parent must have a `## Phase Plan` section. Missing plans: stop,
   list them, done. (Run from an implementation repo — under the
   standalone-spec-repo profile, never from a standalone clone of the spec
   repo. This skill needs no other repo's code: it reads the tree and the
   latest progress report, both under `hsdd/`.)
2. **Take calibration.** Velocity comes from the latest progress report's
   calibrated rates. If no progress report exists yet (planning finished
   before implementation started), use the phase plans' assumed rate and a
   wider stated uncertainty band. Either way, the document states which of
   the two it used.
3. **Adopt, don't duplicate; one unsealed document at a time.** Milestone
   documents are per campaign: the adoption bootstrap, one change request's
   fan-out, or a release train. A document carrying `- **Sealed:**` in its
   header (it lives under `hsdd/management/archive/`) is a closed campaign,
   never the current baseline. If an unsealed milestone document exists, it
   is the current baseline: generation is illegal; you are here for a
   re-baseline (step 6). If none exists, generate, naming the campaign in the
   header. Never mint a second unsealed chain.
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
   post-launch — this is the plan, not a slip").
   *External* means the owning spec's OQ table marks the question `ext:` under
   *Waits on* (conventions.md § Open questions) — that marker, not a judgment
   call, decides what leaves the launch gate. An externally-gated phase
   inside the launch gate is a generation error.

   **Internally-blocked work stays in the gate.** A phase waiting on a
   decision *your* organization owns — a product call, a legal sign-off — is
   not tail material however long it has been pending: its timing is yours.
   Keep it inside the launch gate and give it a named decision owner and a
   decision deadline. Tailing it converts a decision someone can make into
   weather nobody controls, and quietly removes it from the schedule the
   stakeholders agreed to.
6. **Re-baseline (when triggered).** If the dates hold — the buffer
   absorbs the change — *absorb*: update gates, append to the change log,
   same file. If the dates move — *re-baseline*: a new dated document
   superseding the old **by exact filename**, with the old window and the
   new window both stated, so the slip is visible instead of silently
   renormalized. A re-baseline is a stakeholder event: report what
   changed, why, and what was decided (add people, cut scope, move the
   window) — and that decision lands in its governance artifact, not
   here.

## Findings This Skill Produces

A check run that changes nothing may still notice conformance problems in the
existing document — a tail entry that should sit inside the gate, a phase
double-booked in both, a gate depending on something that is not a phase.
Record each in the milestone document's change log, dated, and say plainly
that it is deferred rather than fixed.

Then hand it on: **the next `hsdd-checkpoint` reads this change log and folds
anything unresolved into its findings register**, where the loop turns it into
a plan step with an owner. Without that hop a finding recorded here is
stranded — real, written down, and reaching nobody. This skill has no plan of
its own to write into; the checkpoint does.

## Document Shape (`hsdd/management/YYYY-MM-DD-milestones.md`)

Required sections, in order:

- Header block: date, audience, `**Campaign:**` (one line naming the campaign),
  `**Basis:**` (the progress report these numbers
  came from — it carries the repo baselines, which this document does not
  restate — or an explicit statement that no progress report exists yet and the
  phase plans' assumed rate was used), `**Companion docs:**` (same-date
  siblings), `**Supersedes:**` on re-baselines (exact filename),
  `**Execution detail:**` link to the current execution plan.
- **How to read this** — demo/gate semantics, the slip tolerance (how many
  days a milestone may slip before it triggers anything), the launch
  window as a **base / optimistic / pessimistic** triple.
- **Milestones** — one section per milestone: demo, then gate checkboxes.
  An overview diagram (Mermaid) of the milestone sequence is recommended;
  if `mermaid-pastel-style` is installed, follow it.
- **Contingent tail** — the table from step 5 with degradation paths.
- **Tracking** — who ticks (the weekly checkpoint); the re-baseline trigger,
  which is a gate red across two consecutive checkpoints, read from the two
  most recent progress reports' Milestone gate status sections, or totals
  moved; the single source of truth for "done"; and sealing: the checkpoint
  whose tick turns the last gate green adds `- **Sealed:** YYYY-MM-DD`,
  appends to the change log, and moves this file to
  `hsdd/management/archive/`. The next campaign opens a new document here.
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
- [ ] No second unsealed chain: an existing unsealed document was adopted or
      superseded, never duplicated; sealed documents were left untouched.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Phase planning is nearly done — generate now" | Total scope is not computable from nearly. Stop and name the missing plans; a week early buys a document that lies. |
| "Milestone = backend complete" | Stakeholders can't watch "complete". Find the demonstrable slice the dependency structure makes available. |
| "This external phase is critical, keep it in the launch gate" | Its timing is not yours to promise. Tail it with a degradation path — that converts uncertainty into a decision already made. |
| "The dates moved a little, just update them" | Moved dates are a re-baseline: both windows stated, supersedes chain, stakeholder event. Silent renormalization hides the slip until it can't be managed. |
| "I'll tick the gates while I'm here" | Ticking is the checkpoint's step — one writer per rhythm. This skill runs at generation and re-baseline, nothing between. |
| "No progress report yet, so I'll guess a velocity" | Don't guess silently. Use the phase plans' assumed rate, widen the band, and say exactly which source the numbers came from. |
