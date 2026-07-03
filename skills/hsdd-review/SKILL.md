---
name: hsdd-review
description: >
  Use when running the human review gate for a completed HSDD phase: walking the
  per-tier checklist, dispositioning learnings, and recording sign-off.
  Triggers: "review phase X", "run the gate for X", "sign off on X", "the phase
  is built, what now", "disposition the learnings", "gate-only review",
  "spot-check review", "full review of the phase", "/hsdd-review". The gate is
  the centerpiece of HSDD: every phase ends here. Do NOT use for reviewing
  OpenSpec artifacts mid-cycle (that is the cycle's own review step) or for
  general code review outside HSDD.
---

# HSDD Review: The Human Gate, Driven

Drive the reviewer through the phase gate at the depth its tier demands, get
every learning dispositioned, and record a sign-off that real infrastructure
enforces. The human owns correctness; this skill makes their sitting efficient
and complete.

**Inputs:** the phase id, its tier (from the phase block), the verification doc
(`docs/verify/{phase-id}.verification.md`), and the diff.

## Process

1. **Load the phase.** `npx hsdd context {phase-id}` shows what the phase was
   bound to; read the phase block's Gate, Verification, and Review tier.
2. **Run the mechanical checks** and paste real output into the verification doc:
   - the phase gate command (from `Gate:`), which includes contract
     verification for producing phases;
   - `npx hsdd check-scope {phase-id}` (a note if the phase declares no Touches);
   - `npx hsdd lint`.
3. **Walk the tier checklist** (below) with the reviewer.
4. **Disposition every learning.** The verification doc's `## Learnings` section
   must give each entry exactly one disposition. "No learnings" is a valid
   entry; silence is not. Do not sign off while any learning is undispositioned
   (`hsdd lint` flags them).
5. **Record the sign-off** (mechanism below), then re-derive project state:
   `npx hsdd status`.

## Per-Tier Checklists

**gate-only** (minutes):
- [ ] Gate command green (output captured in the verification doc)
- [ ] Scope check green (or explicitly no Touches)
- [ ] Diff size within the phase's Size estimate

**spot-check** (gate-only, plus):
- [ ] Read the diff summary (files + shapes, not every line)
- [ ] Read the produced contract/type surface; naming and shape match the phase Scope
- [ ] Confirm no coupling to another node's internals

**full-review** (spot-check, plus):
- [ ] Read the full diff
- [ ] Run the manual verification steps from the verification doc
- [ ] Probe the edge cases listed in the phase's Verification
- [ ] Check error paths against the consumed contracts' guarantees

## Learnings and Dispositions

Every learning carries exactly one disposition:

```markdown
## Learnings
- L1: auth-token needs a `scopes` claim the contract omits.
  -> disposition: contract-bumped (auth-token@v2)
- L2: session-store latency budget was guessed; measured 3x higher.
  -> disposition: spec-updated (acme.backend.auth: Isolation strategy)
- L3: considered switching JWT lib mid-phase.
  -> disposition: dropped (out of scope; current lib adequate)
```

| Disposition | Executes via |
|-------------|--------------|
| `spec-updated` | edit the node spec (hand to `hsdd-spec` if the boundary moved) |
| `contract-bumped (id@v)` | `hsdd-contract` |
| `adr-proposed (ADR-nnn)` | `hsdd-adr` |
| `dropped (reason)` | recorded, nothing else |

This is the upward feedback loop: what the phase learned flows back into the
tree before the next phase derives its context.

## Sign-Off Uses Real Review Infrastructure

A "reviewed by" line an agent can type is an honor-system record. Prefer
infrastructure that already enforces human identity:

- **PR flow (recommended):** each phase is a branch `hsdd/{phase-id}` merged by
  pull request; the PR approval and merge are the approval event. Link the PR in
  the verification doc (`- PR: <url> (merged 2026-07-03)`). Tiers map to PR
  ceremony: gate-only = auto-merge on green checks with notification;
  spot-check = one approval; full-review = approval after running the
  verification steps.
- **Fallback (no PR flow):** the human commits the signed line themselves:
  `- reviewed by: <name> date: <date> tier: <tier>`. The doc records which
  mechanism was used.

`hsdd status` derives `approved` from exactly these records.

## Optional: Metrics

Fill the verification doc's `## Metrics` block at the gate while the numbers are
fresh (agent wall-clock, review wall-clock, gate failures before green, tokens
if reported, escaped defects retroactively). `hsdd status --write` aggregates
whatever exists into `docs/STATUS.md`. Consistent records are the evidence
program; skip only deliberately.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The gate is green, ship it" | The gate is the floor. The tier checklist is the review; learnings still need dispositions. |
| "I'll sign off for the reviewer" | Sign-off records a human decision. An agent-typed approval is a forgery, not a record. |
| "No learnings worth writing down" | Then write '- none'. Silence is indistinguishable from 'nobody asked'. |
| "The learning can wait until later" | Undispositioned learnings rot; the next phase derives context from a tree that never heard them. Disposition now, even if the disposition is 'dropped'. |
| "Full review is overkill for this small diff" | The tier was set at planning time by risk and leverage. Renegotiate the plan if it is wrong; do not silently downgrade. |
