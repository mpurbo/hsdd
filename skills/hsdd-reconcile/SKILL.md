---
name: hsdd-reconcile
description: >
  Use when draining the pending governance updates that hsdd-phase-plan emitted
  into node plan files, typically after parallel phase-plan branches merge.
  Triggers: "reconcile the worktrees", "drain pending governance updates",
  "merge the phase plans", "apply governance updates", "resolve contract
  requests", "finalize phase ids", "the contract is still provisional", "sweep
  the resolved open question", "align the plans after the contract moved". Also
  "mark the grandfathered contracts",
  "discharge the grandfather mark", "retire the contracts of {node}". Runs at
  the root lineage after branches are
  merged — from an implementation repo under the standalone-spec-repo profile,
  never from a standalone clone of the spec repo. Do NOT use for authoring
  contract bodies (use hsdd-contract), recording cross-cutting decisions (use
  hsdd-adr), or phase planning (use hsdd-phase-plan).
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
  `phase_ids: provisional` or `status: draft`, or that a phase is contingent
  on an open `request`.
- A checkpoint plan step names contracts to mark or discharge as
  grandfathered, a retired node, or a `draft` contract whose artifact now
  exists. These invocations usually find no pending section; step 2 still
  runs the steps they name.

**Do NOT use for** authoring or versioning contract bodies (`hsdd-contract`),
recording decisions (`hsdd-adr`), or phase planning (`hsdd-phase-plan`).

**Precondition:** run with every phase-plan branch merged, on the root lineage
(not in a phase worktree). Under the standalone-spec-repo profile that means
**from an implementation repo**, editing governance through `hsdd/` — never
from a standalone clone of the spec repo, whose edits strand every submodule
pointer. Commit and push inside the submodule, then bump each implementation
repo's pointer. The git merge is textually clean by construction (no branch
edits governance files); this skill performs the semantic merge.

## Process

1. **Load conventions.** Read `hsdd/conventions.md` first; it may override
   the default layout (plan files under `hsdd/spec/`) and states the parallel
   development protocol this skill completes.
2. **Scan.** Find every `## Governance updates (pending reconcile)` section in
   `hsdd/spec/*.md`. If none exist, say so; then still run, in order, the
   steps this invocation names (step 7 for a `draft` contract with
   `phase_ids: final` whose artifact now exists, step 8's grandfather
   marking or discharge, step 9's retirement, the resolved-question sweep),
   then step 12 when any of them changed a contract, and stop. Entries may
   carry rationale sub-bullets, and `contingent phases: none` means nothing
   blocks; read both accordingly.
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
   unresolved, flip `status: draft` to `stable` **only if** its `## Validation`
   section names a schema or a fixtures directory and that path exists on
   disk (defaults `hsdd/contract/schema/{slug}.schema.json`,
   `hsdd/contract/fixture/{slug}/`). A contract that qualifies on phase ids
   and requests but has no artifact stays `draft`; report it by name with
   the path it lacks, and emit the `hsdd-contract` step that adds it.
   Never flip without the artifact, and never write `validation:
   grandfathered` to get past this check: the grandfather set is closed
   (step 8). Contracts that were already `stable` before this run are not
   re-examined here; a pre-existing fixtureless `stable` contract without
   the `validation:` key is reported once for the checkpoint's grandfather
   audit (the upgrade run enumerates it; after that, the grandfather set
   decides whether it is waiting for the marking step or `hsdd-contract`'s
   to give an artifact), never un-flipped. Stable means interface-frozen, safe to
   build against, not producer-shipped. This step runs after steps 5-6 on
   purpose: the no-open-request condition is only decidable once requests
   are resolved.
8. **Grandfather marking and discharge.** When the invoking prompt or an
   execution-plan step from the upgrade checkpoint (or a later checkpoint
   carrying that step forward) names contracts to mark:
   for each that is `stable`, lacks an artifact at its Validation paths, and
   has no `validation:` key, add `validation: grandfathered` to its
   frontmatter and report the count. Never mark a `draft`, and never mark a
   contract whose file was created after the upgrade checkpoint's baseline SHA
   (the plan step carries it, from that progress report's Repo baselines
   header; invoked without one, ask for it). Never re-mark a contract whose
   file history in the spec repo already carried the key
   (`git -C hsdd log -G 'validation: grandfathered' -- contract/{file}`
   prints a commit): it was discharged, and a lost artifact is
   `hsdd-contract`'s to restore. Read that history inside the spec repo,
   never from the implementation repo, where `hsdd/` is a submodule and the
   log shows nothing; in a shallow clone, fetch the full history first, and
   history that cannot be read is reported, never taken as "never
   carried". Discharge: when the invoking
   prompt or a checkpoint plan step names a grandfathered contract whose
   artifact now exists at its Validation paths, remove the key and say so.
9. **Contract retirement.** When the invoking prompt or a checkpoint plan
   step names a retired node (`- **Status:** retired`), set each contract
   that node solely produced to `status: retired` **unless** a consumer or
   an `external_consumers` entry still names the version; in that case
   leave the status, and report the live consumer as a finding for the
   checkpoint.
10. **Apply `note` entries** to `hsdd/conventions.md` only when they change a
   convention. Drop notes that duplicate derived data; the registry already
   projects contract facts.
11. **Stamp each drained section**, replacing its entries with one line:
   `> Reconciled {YYYY-MM-DD} by hsdd-reconcile. Drained entries are in git history.`
12. **Regenerate the registries:** `node hsdd/scripts/gen-registry.mjs`.
13. **Sweep resolved questions.** This step also runs standalone: "sweep
    OQ-B7, resolved by ADR-021" is a valid invocation with no pending
    sections present. When a drained entry (or a human arbitration during
    this run) resolves an open question: update the row
    and detail subsection in the owning spec (`RESOLVED (date)`, pointing at
    the landing artifact), then grep the OQ id across the tree — specs,
    contracts, ADRs, phase plans — and update every citation that still
    treats it as open (contingency markers, "pending OQ-x" prose). Report
    the swept locations.
14. **Align.** An operation of its own, run standalone with no pending
    section present, like the steps step 2 names; step 13's sweep of resolved
    open questions and its trigger words are unchanged. See Align Mode below.

## Align Mode (citations and gate arguments after a version moved)

Invoked as `/hsdd-reconcile align {node ids or all} after {what changed}`.
Align runs standalone, with no pending section present, and for each named
node's plan text:

1. moves every live citation of a contract version that is no longer current
   to the current version, by the Citation touch rule of `hsdd-spec`, in
   unshipped phases only;
2. re-derives each phase gate's contract and guarantee arguments against the
   current contract's validation artifacts, where the gate names them;
3. checks that every phase id named in a contract's `produced_by`,
   `consumers` or delivery text exists, and that every phase Scope that cites
   an intake record cites one that exists;
4. records every finding it cannot fix within citations and gate arguments
   (a Scope that is now wrong, a phase that no longer fits) as a routed item
   for the owning skill, never rewriting a phase's scope itself.

It drains nothing and flips nothing unless the invocation also names those
steps.

## Entry Handling

| Entry | Target | Rule |
|-------|--------|------|
| `confirm` | contract frontmatter | apply; flip `phase_ids` to `final` when both sides are confirmed |
| `request` | contract body (or a new ADR) | human resolves; skill applies; contingent phases unblock |
| `amend` | contract body | producer-side enrichment; backward-compatible keeps the version, breaking goes to the human and bumps it |
| `note` | `hsdd/conventions.md` | apply only if it changes a convention; drop derived facts |
| grandfather step (from a checkpoint plan step) | contract frontmatter | mark: add `validation: grandfathered` to listed `stable` contracts without artifacts, never to a `draft`, never to a new contract, never to one whose history carried the key; discharge: remove the key from a listed contract whose artifact now exists |
| retire (node retired) | contract frontmatter | `status: retired` for solely-produced contracts with no live consumer; otherwise a finding |

## Unattended runs

When your arguments contain `--unattended {step}`, you run as step
`{step}` of an `hsdd-auto` run, and your dispatch file
`hsdd/auto/dispatch/{step}.md` names your report. Then:

1. At each ask point in the table below, act on its disposition.
   `return`: write your report with `status: "stopped"` and a `stop`
   object (the question verbatim, the rule of this skill that requires it,
   the stop class, the options with their consequences, your
   recommendation, what it blocks), leave your partial artifacts in place,
   and end your turn. Never answer it yourself. `decide`: take the decision
   and record it with `would_have_asked: true` and the class the table
   gives, or `false` where the table gives none, unless a careful engineer
   would have asked the owner first: then `true` with class `judgement`.
2. Record every decision when you take it, with
   `node hsdd/scripts/auto/decide.mjs --step {step} --stdin` and the
   decision as JSON in the shape your dispatch file shows. Never write a
   time or an id yourself.
3. Do not invoke interactive companion skills such as brainstorming; the
   run's decision policy replaces their dialogue.
4. Copy each of this skill's quality gates (for `hsdd-phase-plan`, the
   items of its Phase Design Checklist) verbatim into the report's
   `self_check`, with `pass`, `fail` or `n/a` and a note. A gate that
   requires a human act (the human confirmed, decided or stated) is `n/a`,
   and its note names the decision that stood in for that act. So is a
   gate that a give-way rule of the table below overrides, its note naming
   the decision that applied the rule, and a gate whose subject this step
   did not touch, its note reading `not exercised by this step`.
5. A predecided answer in your dispatch file for a class in the table
   replaces the `return` for that class: apply it, record your decision
   citing the predecided decision's id, and continue. The exception is a
   breaking change under `compatibility: frozen` or at `v0`, which you
   report as a run-stop candidate whatever the predecided answers say
   (§8.2).
6. Where the table says a rule of this skill gives way, the recorded
   decision replaces the human act that rule requires, and the owner's
   later review of that decision is the act.

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| A collision | return | `collision` |
| An `amend` or a `request` answer that breaks a consumer of a `stable` contract under `compatibility: versioned` (`frozen` or `v0`: a run-stop candidate, §8.2) | return | `breaking-amend` |
| The same for a `draft` contract | decide (the rule that it "goes to the human" gives way for drafts) | `judgement` |
| A `request` answer that breaks no consumer | decide (the rule "resolve `request` entries with the human" gives way) | `judgement` |
| Step 5's cross-cutting answer for `hsdd-adr`; step 7's `hsdd-contract` step for a missing validation artifact | route an `insert-step` (`adr` or `adr-update`; `contract-touch`), and never write the ADR or the artifact yourself | none |

No step kind invokes reconcile's grandfather marking, discharge or retirement
(its steps 8 and 9), so their inputs never arise in a run.

## Quality Gates

- [ ] Every pending section drained, or explicitly deferred with a reason.
- [ ] No contract with both sides fully planned remains `phase_ids: provisional`; none with `phase_ids: final`, no open request and an existing validation artifact remains `status: draft`; none was flipped without its artifact.
- [ ] Grandfather marks were added only to pre-existing fixtureless `stable` contracts named by the plan step (the upgrade step or one carrying it forward), none re-marked after a discharge, and removed wherever the artifact now exists.
- [ ] No contract was retired while a consumer or external consumer still names it.
- [ ] Every collision was decided by the human, and the losing plan was updated to match.
- [ ] Contract edits follow hsdd-contract versioning (breaking change = new version + migration note).
- [ ] `node hsdd/scripts/gen-registry.mjs` ran after the last contract edit.
- [ ] No artifact still cites a resolved OQ as open; sweep locations
      reported.
- [ ] Every change align made is a citation or a gate argument.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "The entries are obvious, apply them without reading the contract" | An entry can contradict the contract or another node's entry. Group by contract and check collisions first. |
| "Auto-resolve the collision, the producer is probably right" | Ownership disputes are design decisions. The human arbitrates, once, at merge time. |
| "The request is trivial, answer it myself" | A request is a gap the contract never specified. Inventing the answer re-creates the divergence this skill exists to remove. |
| "Skip the registry regen, frontmatter barely changed" | The registry is derived data. Any frontmatter change without a regen makes INDEX.md lie. |
| "Leave the drained entries in place for history" | Git history already keeps them. A stale pending section gets re-drained and double-applied. |
| "The OQ row says RESOLVED — done" | Citations elsewhere still gate phases on it and justify contract prose with it. Grep the id; sweep every stale citation. |
| "The fixtures will come in the next phase; flip it to stable now" | Stable means a consumer can build against fixtures today. Leave it draft, name the hsdd-contract step that adds the artifact, and let hsdd-config warn consumers that it is draft. |
| "This new contract has no fixtures; mark it grandfathered" | The set closed at upgrade. A new contract without an artifact is an error, not history. |
