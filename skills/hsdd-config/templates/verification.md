# Verification: {phase-id} — {Phase Name}

> Written at apply by the documentation task, once implementation details
> exist, never during planning. Depth per review tier: gate-only = slim
> (gate command, expected output, a 3-5 line checklist, Learnings);
> spot-check = short (commands, expected output, what to eyeball,
> Learnings); full-review = full (every section below). Every tier keeps
> Learnings and Sign-off.

## Commands to run
<exact commands, including any one-time setup a fresh checkout needs. For a
phase that produces a contract, the command that validates the real output
against hsdd/contract/schema/{slug}.schema.json and reproduces
hsdd/contract/fixture/{slug}/>

## Expected output
<what passing looks like: counts, exit codes, artifacts produced>

## Observed
<dated: what actually happened when this phase was implemented>

## Outstanding
<what could not be verified in this environment, and what it takes to
verify it. Empty is a valid, and desirable, state.>

## Learnings
<gate-time findings about the tree, not about this phase's claims: a node
spec that was wrong, a contract that needs a bump, a decision that should
be an ADR. Each entry ends with exactly one disposition:
spec-updated | contract-bumped (id@v) | adr-proposed (ADR-nnn) | dropped (reason).
"- none" is a valid entry; an empty section is not.>

## Metrics
<optional; filled at the gate while the numbers are fresh: agent
wall-clock, review wall-clock with the tier, gate failures before green,
tokens if the harness reports them, product diff vs process artifacts in
lines; escaped defects added later when found>

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) |
  deferred to {phase-id}
- Disposition of each Learning: spec-updated | contract-bumped (id@v) |
  adr-proposed (ADR-nnn) | dropped (reason)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
