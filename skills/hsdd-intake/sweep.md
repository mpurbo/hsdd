# HSDD Intake: Sweep Mode

**Core principle: the script owns the record's structure, the agent answers
one bounded question per commit.** The script reads the range, sets aside
what is attributed, runs the surface test and writes every row. The agent
fills the cells it left, asking whether the commit is the work of a phase
and, if it is not, whether the diff makes a claim of the owning node's
closure false or stale. Nothing a sweep writes counts as done.

## When it applies

A launched system whose tree is current enough that the next change will
read it: after adoption, after the launch campaign sealed, or after a seal.
Whoever merged the small changes runs it (the runner), a developer or a lead.
It does not apply before launch, and it delivers no request: a ticket, a PRD
or an incident goes through request mode before the code is written.

## Setup

The first sweep in a project copies this skill's `scripts/` directory
**verbatim** to `hsdd/scripts/sweep/`, never retyping a file, and commits the
copy itself, since `commit` commits the record alone. A later copy replaces
the directory: a second `cp -R` nests inside it. Node 20 or later. Every
command runs from the implementation repository's root, the directory that
holds `hsdd/`. Under the standalone-spec-repo profile each implementation
repository is swept on its own and its records land in the submodule.

## Procedure

```bash
node hsdd/scripts/sweep/sweep.mjs draft [--from SHA] [--to REF] [--main BRANCH] [--repo NAME] [--run-by NAME] [--today YYYY-MM-DD] --write
node hsdd/scripts/sweep/sweep.mjs check hsdd/management/DATE-sweep-REPO-SHA7.md
node hsdd/scripts/sweep/sweep.mjs commit hsdd/management/DATE-sweep-REPO-SHA7.md
```

1. **`draft --write`,** with the invocation's arguments after `sweep`. `--to`
   defaults to the head of the main line, `main` unless `--main` names
   another. `--from` defaults to the `{to}` of the repository's newest sweep
   record, and a first sweep must name it. `draft` refuses an unfinished
   record of the same repository (a `?` left) and an unreadable record,
   until each is fixed or deleted. A range with no candidates writes no
   record: report the counts and stop.
2. **Fill every `?`, and nothing else.** The agent adds and drops no row.
   - **Node**, by this order of evidence, the script having applied the
     first two: (1) an `HSDD-Node:` trailer naming an active node, which is
     where a `manual` answer arrives and which does not override `spans`;
     (2) the one node whose `modules:` line covers every changed path; (3)
     the agent's reading of the atlas (`hsdd/spec/` when there is none):
     each node's Isolation strategy, its phases' Scope lines, any `modules:`
     line; (4) the runner, asked once, for the commits the first three left.
     Paths that span two nodes make the commit `intake`, reason
     `spans {node}, {node}`, node `none`. A commit no node owns and nobody
     places is `unplaced`, reason its paths, node `none`, and is never
     guessed onto a node; one partly unowned is placed by the runner or not
     at all. An `intake` row nobody places stays `intake`, node `none`.
   - **Class and Reason**, by the phase test on every row, then the claim
     test on every row left at `?`. `Reason` is `none` for `log`, the phase
     id for `phase`, the claim's location for `retro`, the surface move or the
     spanned nodes for `intake`, the paths for `unplaced`, and never what the
     code now does.
   - **`Run by`**, unless `--run-by` filled it: a person, or
     `{agent} for {person} (delegated)`, asking the runner once. That
     person answers for the classification.
   - **The first change-log line's counts**, agreeing with the table.
3. **Write `## Routing`** from the rows, in table order, numbered `H{n}`:
   one handoff per node with `retro` rows and one per `intake` row, each
   headed `**H{n}** ({class}, {node or sha}):`, every prompt in its own
   `text` fence below it. When every row is `log` or `phase`, leave `## Routing` at
   `none` and tick `Status` to `closed (YYYY-MM-DD)` with the record's date.
4. **`check`, until it passes.** It reads the record back against a fresh
   draft of its range, exits non-zero naming the row, and writes nothing.
   Fix the record and run it again; never commit a record `check` refused.
5. **`commit`.** It takes only the record's path, runs `check` itself, and
   commits the record alone as `sweep: {repo} {from7}..{to7}`; anything else
   staged stays staged. Under the profile it commits inside the submodule,
   bumps the pointer, and refuses while the submodule's HEAD is detached;
   after a rejected pointer commit, run it again. It never pushes. Under the
   profile the runner pushes inside `hsdd/` before pushing the implementation
   repository, as every governance edit is pushed, or the pointer names a
   commit no clone has.
6. **Run the handoffs** in order, or hand the prompts over.
7. **Report** the path, the counts, what is `unplaced`, the handoffs not run.

A published record accepts ticking `Status`, appending to the change log,
and one more edit: a person may edit the `Node` and `Class` cells of an
`unplaced` row, and its `Reason` with them, with a change-log line naming
the person and the new class, and the handoff the new class needs appended
to `## Routing`. Nothing else is edited in place. A wrong class on any other
row is corrected by the change-log line
`- YYYY-MM-DD: raised {sha7} from {class} to {class} by {person}: {reason}`
and the handoff it now needs. The row's class follows the last such line,
over its cell, and a raise on a closed record sets `Status` back to `open`
in the same edit. `check` and `commit` gate the first publication only: a
published edit is committed with git directly, since the first change-log
line keeps the counts of the day it was written.

## The phase test

It runs first, on every candidate, those the surface test set `intake`
included. Read the owning node's phases and nothing wider. The commit is
phase work when a phase of its owning node, not dropped, describes it: the
diff is what the phase's Scope says, and the commit's date is no later than
the day the phase's verification doc was signed, when it has been signed.
On a row the surface test set `intake`, the phase must also account for the
move, in its Scope or its Produces. The class is then **`phase`**, the reason
is the phase id, and the row is the whole record of the commit: no claim test
and no handoff, because the phase's own gate and verification doc answer for
it.

A commit that spans two nodes stays `intake`, since a phase belongs to one
node. Sharing a node is not evidence: a small fix on a node with an open phase
is not that phase's work. When the diff does not let you tell, ask the runner
once, and a commit nobody claims for a phase goes on to the claim test. Moving
a script-set `intake` to `phase` is not lowering: the commit already has a
phase, and that phase answers for the move. `check` refuses a reason that is
no phase of the row's node, a dropped phase, and a row that spans two nodes.

## The claim test

It runs on every candidate the first two tests left. The agent reads the diff
and the owning node's closure, nothing wider: the node's spec file, the
Scope and Verification lines of its phases, the Guarantees of the contracts
the node produces, and the Decision of each ADR in its Governed by. If the
diff makes any sentence there false or stale, the class is **`retro`**, and
the reason names the claim by its location
(`acme.web.checkout.4 Verification: "shows the fee line"`). Otherwise the
class is **`log`**, and the row is the whole record of the commit. A copy
change that renames what a Verification line names is `retro`; a font size
is `log`; a log line is `log` unless a Guarantee speaks of logging. The
agent writes the claim it found, never a judgment of worth: "not worth
recording" is not a class.

**On an as-built node** (`- **Adopted:** as-built`) the claim test is not
applied. Its header is an unvalidated claim about intent, its
`## Observed surface` is re-rendered by the checkpoint's drift pass, and it
has no phases whose lines a diff could stale. A candidate placed on an
as-built node is `log` unless the surface moved; a retro phase is never
planned on an as-built node, and promotion waits for the first change
request that needs a phase. `check` refuses a `retro` row there, and on an
internal node or the root, where append mode has no plan to write into. A
`retro` on an as-built node is `log`. On an internal node or the root the
agent asks the runner which leaf-parent owns the paths, then applies the
claim test against that node; when the runner names none, the row is
`unplaced`. The agent never moves a filled Node cell on its own.

**Raising.** The agent may raise a class: `log` to `retro`, and either to
`intake` when it reads a move the classifiers missed or when the paths span
two nodes. It never lowers one. The classifiers are regex candidates, and a
produced contract's Interface is surface, not claim: a diff that changes
what it describes is a move whether or not they saw it.

**Lowering** is the runner's, before the record is committed, for any class,
the agent's or the script's, with this change-log line:
`- YYYY-MM-DD: lowered {sha7} from {class} to {class} by {person}: {reason}`.
A script-set `intake` lowered this way records a false positive of the
classifiers (a route-like string in a comment, a `.schema.json` fixture),
and the `Run by` line is who answers for it. `check` refuses a lowered
`intake` without that line, and an `intake` is never lowered to `unplaced`.
After publication no class is lowered, by anyone.

## Handoff prompts

Copy each prompt into `## Routing` verbatim and change only its
placeholders: `check` reads a prompt's shas at `commits {sha}, {sha}` and
`{repo}@{sha} (commit)` and nowhere else. `{record}` is the record's
filename, `.md` included. A `{sha}` is a row's seven-character sha, and
`{sha}, {sha}` lists all of a handoff's shas, comma and space between them.

**`retro`:** one handoff per node per record, however many commits it lists,
in three prompts run in order. The first appends the phase:

```text
/hsdd-phase-plan {node} per hsdd/management/{record}: add one retro phase
for commits {sha}, {sha}. Scope lists each commit with the claim it staled
(the record's Reason cells); Verification states the behavior as the code
now has it; review tier gate-only; gate the node default. Plan nothing the
commits did not do. If a commit moved a route, schema, topic or table, stop
and say so: that is an intake, not a retro phase.
```

The second drains what the append emitted, usually nothing:
`/hsdd-reconcile {node}`. The third writes the verification doc:

```text
Write hsdd/verify/{phase-id}.verification.md from
hsdd/templates/verification.md for the retro phase. Commands to run: the
node's gate. Observed: run it now, dated, and open with "Retroactive:
written after commits {sha}, {sha} shipped". Outstanding and Learnings per
the template. Sign-off: {agent} for {person} (delegated), tier gate-only.
Run the commands; do not invent an observation.
```

`{phase-id}` stays as written in the record; the agent running the prompt
fills it from the append's result. `{person}` is the `Run by` person. No
phase context is written: the code exists.

**`intake`:** one handoff to request mode per row, authority `commit`.
`{subject}` and `{reason}` are the row's cells, `{date}` the commit's date:

```text
/hsdd-intake route {repo}@{sha} (commit): {subject}. Shipped {date} on the
main line; the sweep found {reason}; per hsdd/management/{record}.
```

**`unplaced`:** no handoff. The report names the row, the next checkpoint
files it as a finding, and the record stays open until a person places it.

## Quality Gates

- [ ] Every candidate has a row; none was added or dropped by hand.
- [ ] No class was lowered by the agent.
- [ ] Every `phase` row names a phase of its node whose Scope describes the
      diff.
- [ ] A claim is named by its location on every `retro` row.
- [ ] No `retro` row sits on an as-built node.
- [ ] `check` passed before `commit`.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "This change isn't worth recording" | Worth is not a class. The question is whether the diff stales a claim: name the claim, or write `log`. A `log` row is one line, and a commit with no row is a backfill finding at the next checkpoint. |
| "I'll skip the record, nothing staled" | Nothing staled is the `log` answer, and the row is the record. Without it the commits stay an unswept range, and the next checkpoint files that as a finding. |
| "The classifier is wrong, I'll change that intake to log" | An agent never lowers a class, and `check` refuses the row. Ask the runner, who may lower it before the commit with the change-log line, and who answers for it. |
| "I'll guess the node" | Ask the runner once. A commit nobody places is `unplaced`, listed for the owner; a guess puts code no node owns on a node and hides the finding. |
| "It's on the node with the open phase, so it's phase work" | Sharing a node is not evidence. The phase's Scope must describe the diff, and a phase already signed absorbs nothing later. Otherwise run the claim test. |
