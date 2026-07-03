---
name: hsdd-adopt
description: >
  Use when bringing an EXISTING system (brownfield) under HSDD: mapping real
  seams, writing as-built node specs, extracting contracts from existing
  interfaces, and decomposing lazily. Triggers: "adopt HSDD for this codebase",
  "bring this existing system under HSDD", "brownfield", "map the current
  architecture into a spec tree", "extract contracts from the existing API",
  "as-built spec", "we already have a system, where do we start". Do NOT use
  for greenfield decomposition (use hsdd-spec) or for refactoring proposals
  (adoption never redesigns; improvements come later as learnings and ADRs).
---

# HSDD Adopt: Brownfield Adoption

Give an existing system a path into HSDD. The output feeds the standard loop
unchanged: node specs, contracts, phase plans, cycles, gates. The systems that
actually suffer the too-big-spec problem mostly already exist; this is their
entry point.

**Core principle:** The tree fits the system, not the other way around. Adoption
describes reality; improvement arrives later through the feedback loop
(learnings, ADRs, `hsdd rename`), never as part of adoption itself.

## Process

1. **Archaeology.** Map the real seams: deployables, packages, API surfaces,
   event topics, schema/DB boundaries. Propose a shallow tree (depth 1 to 2)
   that follows the seams that exist, not the ones anyone wishes existed.
2. **As-built node specs.** Write node specs marked `adopted: as-built` in
   frontmatter: purpose, owns/does-not-own, and observed contracts. No invented
   decomposition below the level needed now.

   ```markdown
   ---
   id: legacy.billing
   kind: leaf-parent
   consumes: [customer-record@v1]
   produces: [invoice-events@v1]
   adopted: as-built
   ---

   ### legacy.billing: Billing (as built)

   **Purpose:** invoice generation and dunning, as currently deployed
   **Owns:** invoice tables, dunning scheduler
   **Does not own:** payment execution (external PSP)
   **Decomposes into:** phases (only when this subtree changes)
   **Isolation strategy:** exercised today via the staging environment and
     tests/billing/; internals partially unknown (dunning cron undocumented)
   ```

3. **Contracts from seams.** Extract real interfaces as contracts:
   `version: v1` defined as **current behavior**. Schemas come from the code or
   traffic; fixtures are generated from existing tests or captured payloads.
   These start `stable` (they describe reality) and immediately give the
   validation harness to code that never had one: producers gain a
   contract-verification gate, consumers gain fixtures to test against.
4. **Lazy tree.** Only the subtree about to change gets decomposed further and
   phased. Everything else remains an as-built stub. Depth on demand; the
   ceremony budget goes where the work is.
5. **First change.** From here the standard loop applies: `hsdd-phase-plan` on
   the target node, `/hsdd-new {phase-id}`, cycle, `hsdd-review` gate.
6. **Prove the tree:** `npx hsdd registry && npx hsdd lint`.

## Rules

- **Never propose refactoring to fit a nicer tree.** Boundary improvements
  arrive later as learnings and ADRs, through the standard feedback loop, once
  phases are flowing.
- **As-built specs are honest about ignorance.** Unknown internals stay unknown
  and are said to be unknown. The `Isolation strategy` records how the node is
  exercised today (existing tests, staging environment), not an aspiration.
- **Contracts describe observed behavior**, including the warts. A wart worth
  fixing becomes a learning at a later gate, then a versioned bump with a
  migration note; it is never silently "corrected" during extraction.

## Quality Gates

- [ ] The tree follows deployable/package/API seams that verifiably exist.
- [ ] Depth is 1-2; only the about-to-change subtree is deeper.
- [ ] Every as-built node is marked `adopted: as-built` in frontmatter.
- [ ] Extracted contracts carry schemas/fixtures taken from reality (code,
      traffic, tests), and lint accepts them as `stable`.
- [ ] No refactoring proposals anywhere in the adoption output.
- [ ] `npx hsdd registry && npx hsdd lint` pass.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "While I'm here, the billing seam should really be split" | Adoption describes; it never redesigns. Record the itch as a proposed ADR and move on. |
| "The current API is ugly, I'll spec the cleaner version" | Consumers depend on the ugly one. v1 = current behavior; the cleaner one is v2 with a migration note, later. |
| "Decompose everything now so the tree is complete" | Ceremony is a cost. Stubs are honest; depth on demand where the work is. |
| "I don't know what this module does, I'll infer something plausible" | As-built specs are honest about ignorance. 'Unknown, exercised via X' beats invented certainty. |
| "These contracts have no tests, mark them draft" | They describe running reality; that is what stable means here. Generate fixtures from captured behavior so the harness exists from day one. |
