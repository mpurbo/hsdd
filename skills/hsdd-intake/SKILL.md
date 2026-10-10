---
name: hsdd-intake
description: >
  Use when a change request arrives for a system that already has an HSDD
  tree: a PRD, an RFC, a ticket, an incident, a design drop. Routes it into
  the existing tree, checks for collisions with open intakes, writes the
  routing record before any handoff, and hands off. Triggers: "here's a new
  PRD, where does it go", "route this change", "intake this ticket", "a
  change request came in", "where in the tree does this land", "new feature
  request for an existing system". Do NOT use for the first tree
  (hsdd-spec at the root, or hsdd-adopt), for the periodic evidence pass
  (hsdd-checkpoint), or for writing the phases themselves (hsdd-phase-plan).
---

# HSDD Intake: Route a Change Into the Tree

**A PRD is never a root. There is one tree, and it is the system's.** A
change request is an input that produces changes to that tree: nodes
grafted, phases appended, contracts bumped. It never becomes a root and
never gets a spec of its own. The tree does not complete; phases complete.

Separate from `hsdd-checkpoint` on both axes: checkpoint is periodic and
read-only toward governance; intake is event-driven and its whole job is
to route into governance. Its record is a management document: it cites,
it never defines.

## Inputs

- The change request: a path or URL, and its authority (accepted RFC |
  draft | ticket | incident | braindump).
- `hsdd/management/atlas.md` (the newest tree view); when no atlas exists,
  `hsdd/spec/` directly.
- Every open intake record under `hsdd/management/` (step 1).

## Process

1. **Read every open intake first.** List `hsdd/management/*-intake-*.md`
   whose header says `**Status:** open`. For each, note the nodes, contracts
   and parent it touches. Collisions with the new request are decided here,
   before routing:

   | Collision | Rule |
   |-----------|------|
   | Two changes touching the same node or the same contract | Serialize (this intake waits on the open one, say so in both records' change logs) or merge into one record; write which |
   | Two `new-capability` grafts under the same parent | Serialize: both edit the parent's child list and DAG |
   | Two changes needing the same as-built node promoted | Promote once, share the result: the second intake consumes the promoted node; it never re-promotes |

2. **Locate the landing.** From the atlas (or the tree), name every node
   whose surface the request touches, and every contract on those seams.
   Read the request's sources, not the atlas's summary of them.
3. **Promote first when the landing is as-built.** A node marked
   `- **Adopted:** as-built` is not a fifth routing class: name it in this
   intake's `**Promotes:**` line, classify the change against the node as
   it will be once promoted, and make promotion the first handoff (step 6):
   `hsdd-spec` promotion mode, with its human confirmation stop, the node's
   `## Observed surface` a primary source alongside the request. The other
   handoffs follow only after that confirmation.
4. **Classify**, one class per intake:

   | Class | Means | Routes to |
   |-------|-------|-----------|
   | `local` | fits inside one existing leaf-parent | `hsdd-phase-plan` on that node (append mode when it already has phases) |
   | `cross-node` | touches several nodes' surfaces | `hsdd-contract` bump and/or `hsdd-adr`, then `hsdd-phase-plan` append mode on each node |
   | `new-capability` | needs a node that does not exist | `hsdd-spec` graft mode on the **existing parent**, then phase-plan the new child |
   | `structural` | the tree's shape is wrong for this change | **stop**: a human decision, the expensive one; the record states why and what the options are |

5. **Write the record before the handoff** (shape below). The routing
   decision is auditable because it was written first, not inferred from
   whatever the next skill did. The request's path also lands in
   `## Sources` of every node it governs when those skills run; say so in
   the record.
6. **Hand off** to the skill the class names, with the exact prompt to run;
   when the record names a promotion, that handoff runs first and the rest
   wait for its confirmation; or stop on `structural`. Under the
   standalone-spec-repo profile the record is committed and pushed inside
   the submodule like every governance-adjacent edit. A phase-plan handoff
   prompt names the record's path:
   `/hsdd-phase-plan {node} per hsdd/management/{record}.md`.
7. **Report:** the record's path, the class, the landing nodes, collisions
   found and how they were serialized, and the handoff prompt.

## The intake record

`hsdd/management/YYYY-MM-DD-intake-{slug}.md`. The slug is the request's
short name in kebab case and **never contains `progress`,
`execution-plan`, `milestones` or `atlas`**, so the reading aids do not
mistake the record for a dated report. Dated and **never superseded**;
records accumulate, one per change request, and that is the rule that
replaces "wipe `hsdd/` and rebuild".

```markdown
# Intake: {Change request title}

- **Date:** YYYY-MM-DD
- **Request:** {path or URL} ({authority})
- **Class:** local | cross-node | new-capability | structural
- **Lands on:** [node ids] · **Contracts:** [contract ids or none]
- **Promotes:** [as-built node ids promoted first, or none]
- **Collisions:** [open intake filenames this waits on or merged with, or none]
- **Status:** open | closed (YYYY-MM-DD)

## Request
{at most five lines: what is asked, for whom, by when, citing the source}

## Routing
{the decision and why, written before the handoff: the class, the landing
nodes, what each receiving skill will do, the exact handoff prompt; for
structural, the options and what the human must decide}

## Produced
{a ledger: nodes grafted, contracts bumped (id@v), ADRs proposed, phases
appended (ids). hsdd-checkpoint appends phases from Scope citations; grafts
and bumps may be appended by hand}

## Change log
- YYYY-MM-DD: created, routed {class}
```

A record **closes** when `## Produced` names at least one phase and every
listed phase has a verification doc on the spec repo's main branch, the
same admissibility rule as everywhere else. `hsdd-checkpoint` appends the
phases whose Scope cites the record, ticks `**Status:** closed (date)` and
appends to the change log; this skill never closes a record.

## Quality Gates

- [ ] Every open intake was read before routing; collisions are named in
      this record and in the colliding record's change log.
- [ ] An as-built landing was recorded under Promotes and promoted as the first handoff, once.
- [ ] Exactly one class; the record exists before any handoff ran.
- [ ] The slug contains none of `progress`, `execution-plan`, `milestones`
      or `atlas`.
- [ ] `## Routing` carries the exact handoff prompt; `structural` stopped
      with options written, not a question asked.
- [ ] No spec, contract or ADR was written by this skill.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "This PRD is big; it deserves its own spec tree" | A PRD is never a root. It fans out into grafts and appended phases on the system's tree, and the intake record is where it is visible as one unit of work. |
| "I'll route first and write the record after" | Then the record describes what happened, not what was decided. Write it first; it is the audit trail. |
| "The as-built node is small; I'll phase-plan it as is" | An as-built spec is an unvalidated claim about intent. Promote it through hsdd-spec, with the human's confirmation, then route. |
| "The other intake touches the same contract but a different field" | Same contract, same single writer, same serialization. Record which intake waits. |
| "I'll fix the tree shape while I'm here" | Structural is the human's decision. Stop with the options written down. |
