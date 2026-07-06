---
name: hsdd-reconcile
description: >
  Use when draining the pending governance updates that hsdd-phase-plan emitted
  into node plan files, typically after parallel phase-plan branches merge.
  Triggers: "reconcile the worktrees", "drain pending governance updates",
  "merge the phase plans", "apply governance updates", "resolve contract
  requests", "finalize phase ids", "the contract is still provisional". Runs at
  the repo root, after branches are merged. Do NOT use for authoring contract
  bodies (use hsdd-contract), recording cross-cutting decisions (use hsdd-adr),
  or phase planning (use hsdd-phase-plan).
---

# HSDD Reconcile: Apply Pending Governance Updates

Phase planning treats governance files as a frozen snapshot and emits intended
changes as data: `## Governance updates (pending reconcile)` sections in each
node's plan file. This skill is the single writer that applies those effects at
the root, with the human arbitrating anything two nodes disagree on.

**Core principle:** planning is a pure function of the governance snapshot;
reconcile is the imperative shell. Effects are applied once, at the root, in
one place. Collisions are design decisions and belong to the human.

## When to Use

- Parallel phase-plan branches (worktrees) were merged and their pending
  sections need draining.
- A phase plan just finished in a serial flow (one node: reconcile is fast).
- `hsdd-config` warned that a consumed contract is still
  `phase_ids: provisional` or that a phase is contingent on an open `request`.

**Do NOT use for** authoring or versioning contract bodies (`hsdd-contract`),
recording decisions (`hsdd-adr`), or phase planning (`hsdd-phase-plan`).

**Precondition:** run at the repo root with every phase-plan branch merged. The
git merge is textually clean by construction (no branch edits governance
files); this skill performs the semantic merge.

## Process

1. **Load conventions.** Read `hsdd/conventions.md` first; it may override
   the default layout (plan files under `hsdd/spec/`) and states the parallel
   development protocol this skill completes. A pre-0.5 project has it at
   `docs/conventions.md`: honor its layout and offer to migrate.
2. **Scan.** Find every `## Governance updates (pending reconcile)` section in
   `hsdd/spec/*.md`. If none exist, say so and stop. Entries may carry
   rationale sub-bullets, and `contingent phases: none` means nothing blocks;
   read both accordingly.
3. **Detect collisions before applying anything.** Group entries by contract
   id. A collision is: two nodes claiming the same artifact or package,
   contradictory `confirm` entries, an `amend` conflicting with another node's
   assumption, or a `request` assumption that conflicts with another node's
   entry. Present each collision with both sides quoted; never auto-pick a
   winner. After the human decides, update the losing node's plan (its entry
   and any phase scope that assumed otherwise) to match.
4. **Apply `confirm` entries** to contract frontmatter (`produced_by`,
   `consumers`). When both producer and consumer ids are confirmed, flip
   `phase_ids: provisional` to `phase_ids: final`. A side with no planned
   phase consumers (external or human consumers only) counts as confirmed.
5. **Resolve `request` entries with the human.** Apply contract-shaped answers
   to the contract file under hsdd-contract rules (a breaking change bumps the
   version and adds a migration note). Hand cross-cutting answers to hsdd-adr.
   State which assumption held so contingent phases can start.
6. **Apply `amend` entries** to the owned contract's body (guarantees or
   semantics the producer's plan settled). A backward-compatible addition
   keeps the version; anything that could break a consumer goes to the human
   and bumps the version.
7. **Finalize contract status.** Now that requests and amends are settled:
   for every contract with `phase_ids: final` and no `request` left
   unresolved, flip `status: draft` to `stable`. Stable means
   interface-frozen, safe to build against (the hsdd-contract lifecycle
   rule), not producer-shipped. This step runs after steps 5-6 on purpose:
   the no-open-request condition is only decidable once requests are
   resolved.
8. **Apply `note` entries** to `hsdd/conventions.md` only when they change a
   convention. Drop notes that duplicate derived data; the registry already
   projects contract facts.
9. **Stamp each drained section**, replacing its entries with one line:
   `> Reconciled {YYYY-MM-DD} by hsdd-reconcile. Drained entries are in git history.`
10. **Regenerate the registries:** `node hsdd/scripts/gen-registry.mjs`.

## Entry Handling

| Entry | Target | Rule |
|-------|--------|------|
| `confirm` | contract frontmatter | apply; flip `phase_ids` to `final` when both sides are confirmed |
| `request` | contract body (or a new ADR) | human resolves; skill applies; contingent phases unblock |
| `amend` | contract body | producer-side enrichment; backward-compatible keeps the version, breaking goes to the human and bumps it |
| `note` | `hsdd/conventions.md` | apply only if it changes a convention; drop derived facts |

## Quality Gates

- [ ] Every pending section drained, or explicitly deferred with a reason.
- [ ] No contract with both sides fully planned remains `phase_ids: provisional`, and none with `phase_ids: final` and no open request remains `status: draft`.
- [ ] Every collision was decided by the human, and the losing plan was updated to match.
- [ ] Contract edits follow hsdd-contract versioning (breaking change = new version + migration note).
- [ ] `node hsdd/scripts/gen-registry.mjs` ran after the last contract edit.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The entries are obvious, apply them without reading the contract" | An entry can contradict the contract or another node's entry. Group by contract and check collisions first. |
| "Auto-resolve the collision, the producer is probably right" | Ownership disputes are design decisions. The human arbitrates, once, at merge time. |
| "The request is trivial, answer it myself" | A request is a gap the contract never specified. Inventing the answer re-creates the divergence this skill exists to remove. |
| "Skip the registry regen, frontmatter barely changed" | The registry is derived data. Any frontmatter change without a regen makes INDEX.md lie. |
| "Leave the drained entries in place for history" | Git history already keeps them. A stale pending section gets re-drained and double-applied. |
