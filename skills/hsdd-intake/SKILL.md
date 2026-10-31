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
  approved PRD | draft | ticket | incident | braindump). An approved
  amendment to a PRD is `approved PRD`.
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
   | `cross-node` | touches several nodes' surfaces | `hsdd-contract` bump and/or `hsdd-adr`, then `hsdd-phase-plan` on each node (append mode when it already has phases) |
   | `new-capability` | needs a node that does not exist | `hsdd-spec` graft mode on the **existing parent**, then phase-plan the new child |
   | `structural` | the tree's shape is wrong for this change | **stop**: a human decision, the expensive one; the record states why and what the options are |

5. **Write the record before the handoff** (shape below). The routing
   decision is auditable because it was written first, not inferred from
   whatever the next skill did. The change request's own path (the
   `**Request:**` line, never this record's path) also lands in the
   `- **Sources:**` field of every node it governs when those skills run,
   while each phase planned for it cites this record in its Scope; say so
   in the record.
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
listed phase is done as `hsdd-checkpoint` counts it: its verification doc
on the spec repo's main line (the branch the conventions' `**Main line:**`
names, `main` when absent), signed by a person or for one, the same
admissibility rule as everywhere else. `hsdd-checkpoint` appends the
phases whose Scope cites the record, ticks `**Status:** closed (date)` and
appends to the change log; this skill never closes a record.

## Handoff block

The record's `## Routing` section may carry, after its prose, one fenced
block with the info string `hsdd-handoffs` holding JSON. The block is
optional, and its absence keeps a record conformant. This skill writes it
whenever it runs with `--unattended`, and may write it otherwise.

````markdown
```hsdd-handoffs
{
  "version": 1,
  "handoffs": [
    { "id": "H1", "kind": "adr-update", "skill": "hsdd-adr", "target": "ADR-003",
      "prompt": "Amend ADR-003 for ...", "when": null, "after": [] },
    { "id": "H7a", "kind": "citation-touch", "skill": "hsdd-contract", "target": "topic-model",
      "prompt": "Touch topic-model@v1 for ...", "when": "cites-superseded", "after": ["H1"] }
  ],
  "insert_rule": "A contract change that alters what an unshipped phase implements or replays adds phase-plan-append and reconcile steps on that phase's node, before the final align."
}
```
````

- `id`: `H{n}` with an optional lower-case letter for a family (`H7a`).
- `kind`: a step kind of the table below; `skill` the one the table gives
  it; `target` in the form the table gives for that kind:

  | Kind | Skill | Target |
  |------|-------|--------|
  | `root-spec`, `mid-level-spec`, `graft`, `promote`, `spec-touch` | `hsdd-spec` | a node id |
  | `adr`, `adr-update` | `hsdd-adr` | an ADR id |
  | `contract`, `contract-touch` | `hsdd-contract` | a contract slug |
  | `citation-touch` | by the file: `hsdd-spec`, `hsdd-adr` or `hsdd-contract` | a node id, ADR id or contract slug |
  | `phase-plan`, `phase-plan-append` | `hsdd-phase-plan` | a leaf-parent's node id |
  | `reconcile`, `align` | `hsdd-reconcile` | node ids, comma-separated, or `all` |
- `prompt`: the exact handoff prompt, as the record's prose gives it.
- `when`: `null` (always dispatched) or `cites-superseded`.
- `after`: handoff ids that must be executed or skipped first. An empty list
  means "after the previous handoff in the list"; the first handoff waits on
  nothing.
- `insert_rule`: optional, plain text; the orchestrator applies it.

**`cites-superseded`** holds when any of the target's files contains a
superseded string. The superseded strings are: for every `baseline` source
in `run.yaml`, its `path` and its `version`; and for every contract whose
current version is `v{n}` with `n` above 0, each `{slug}@v{k}` with `k`
below `n`, followed by a character that is not a letter, digit, `_` or `-`,
or by the end of the text. The target's files are: for a contract,
`hsdd/contract/{slug}.md`, `hsdd/contract/fixture/{slug}/**` and
`hsdd/contract/schema/{slug}.schema.json`; for an ADR, its file; for a node,
its spec file. The match is textual and counts history too: a target whose
only old-version mentions are history is still dispatched, and its touch
keeps them. The orchestrator evaluates the condition when the handoff comes
up, not when the record is written.

A `structural` record's block has an empty `handoffs` list, since its
handoffs are the owner's decision. The continuation after the owner's answer
re-classifies the request, rewrites `## Routing` with the handoffs and the
block, and logs the change in `## Change log`.

The prose stays authoritative for people, and the block must say the same
thing: the prose quotes each handoff's prompt verbatim, in the block's order.

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
| Class `structural` | return | `shape` |
| A landing on an as-built node | decide: write the `**Promotes:**` line and order a `promote` handoff first (§9.2); the `promotion` stop is `hsdd-spec`'s, in that step | none |
| Serializing or merging with an open intake | decide | `judgement` |

When the orchestrator answers a `return` (§8.3, case B), the resumed step
applies the answer, and the quality gate that names the human act is `n/a`
with the orchestrator's decision id.

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
- [ ] The handoff block, when present, lists the same handoffs as the prose,
      in the same order, with the same prompts.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "This PRD is big; it deserves its own spec tree" | A PRD is never a root. It fans out into grafts and appended phases on the system's tree, and the intake record is where it is visible as one unit of work. |
| "I'll route first and write the record after" | Then the record describes what happened, not what was decided. Write it first; it is the audit trail. |
| "The as-built node is small; I'll phase-plan it as is" | An as-built spec is an unvalidated claim about intent. Promote it through hsdd-spec, with the human's confirmation, then route. |
| "The other intake touches the same contract but a different field" | Same contract, same single writer, same serialization. Record which intake waits. |
| "I'll fix the tree shape while I'm here" | Structural is the human's decision. Stop with the options written down. |
