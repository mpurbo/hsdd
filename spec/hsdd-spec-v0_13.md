# HSDD: Hierarchical Spec-Driven Development (v0.13 delta: the sweep)

> Delta specification. It adds `hsdd-sweep`, a fourteenth skill that
> attributes the small post-launch commits a tree would otherwise lose: it
> reads a commit range, drops what is already attributed, classifies each
> remaining commit by two tests, writes one record, and hands off only what
> earned a phase or an intake. Read it against v0.10.2, v0.11.0 and
> v0.12.0; only the changes are stated here. Everything in those documents
> not touched below still stands.

**Version:** 0.13.0 (draft)
**Status:** For review
**Date:** 2026-11-05
**Owner:** Purbo Mohamad
**Drafted from:** the owner's request of 2026-11-05 for a lane below
`hsdd-intake`, FT-4's field report (v0.12.0 chapter 8) and the manual lane
the user's guide describes as a project convention (v0.12.0 §9.2 deferred
its promotion). No project has run the lane yet; chapter 10 marks every
decision accordingly. This document, v0.10.2, v0.11.0 and v0.12.0 are the
whole input for implementing the release.
**Supersedes (in part):** v0.10.0 §1.5's skill count and table (one row
added), §2.6's and §11.2's authority list (one value added), §7.2's sizing
ceiling (retro phases exempted), §11.8's bypass path (steps 2 to 4),
§12.7's code-vs-plan and intake-record passes (sweep records read and
closed), §14.1's layout tree (one directory and one file
pattern added), §15.1's compatibility table (rows added), chapter 18 (rows
added) and chapter 19 (terms added); v0.11.0 §15.3's and v0.12.0 §7.3's
skill count (now fourteen); v0.12.0 §9.2's deferred row on the `manual`
intake class and the commit-trailer lane (taken up here). All other
provisions are unchanged.

---

## 1. What 0.13 Changes and Why

### 1.1 The problem

After launch most changes are small: a font size, a line of copy, a log
line, a null check. The method's unit of record is the phase, and a phase
costs the same for a twenty-line fix as for a feature: an intake or a
backfill finding, a phase-plan append, a reconcile, a verification doc, a
sign-off. FT-4 showed what happens when that cost exceeds a team's
tolerance: the fixes ship, the tree stops describing the code, and the
repair that rebuilds history one retro phase per change (v0.10.0 §11.8)
costs more review than the work it records. v0.12.0 answered the recovery
with the seal. It did not answer the steady state that made the seal
necessary, and the user's guide's manual lane, written as a project
convention, still costs one retro phase and one retroactive verification
doc per fix.

The method needs a lane whose cost per change is one table row, with a test
that says when a change has earned more. The guide already names the first
test: the contract surface, not the diff size. This document adds the
second, a change that makes a claim in the tree false, and gives both a
home.

### 1.2 What this release adds

- **The sweep** (chapter 3): an operation over a range of commits on an
  implementation repository's main line. A script sets aside the commits
  that are already attributed, detects moves of the contract surface, and
  proposes a node for each remaining commit; an agent applies one bounded
  test, whether the diff makes a claim in the owning node's closure stale;
  the result is one class per commit: `log`, `retro` or `intake`.
- **The sweep record** (chapter 4): a dated management document, one per
  repository per run, that cites every commit in the range with its node
  and class. A `log` row is the whole record of that commit. The record
  closes when its handoffs have landed.
- **Handoffs** (chapter 5): one retro phase per node per record for the
  `retro` rows, with its reconcile and its retroactive verification doc
  signed by delegation; one `hsdd-intake` run per `intake` row under the
  new authority `commit`; and a listing for the owner of commits no node
  owns.
- **`hsdd-sweep`**, a fourteenth skill (chapter 6), whose script owns the
  record's structure and whose agent fills the cells the script could not.
- **Edits to four skills' text** (chapter 7): the checkpoint reads and
  closes sweep records and routes an unswept range to a sweep instead of a
  retro phase per commit; intake admits the `commit` authority; phase
  planning's append mode writes a retro phase over several commits; the
  conventions template names the new paths and writer.

### 1.3 What it does not change

- **The core invariant (v0.10.0 §1.3)** and the definition of done. A `log`
  row claims nothing about verification; it says only which node a commit
  happened in. Nothing a sweep writes counts as done.
- **The dividing line.** A change that moves a route, schema, topic or
  table is not small whatever its line count; it goes through `hsdd-intake`
  and a contract bump as before. The sweep detects the move and hands off;
  it never classifies such a commit `log`.
- **Human review.** A sweep names the person it answers to, and the
  classification is theirs. A retro phase still gets its verification doc
  and its sign-off; the checkpoint still lists delegated ones to ratify.
- **Artifact formats (v0.10.0 §15.3).** The sweep record is a new
  management document; no existing format gains a required field. The
  `commit` authority is a new value of an existing field.
- **The scripts boundary (v0.10.0 §16.3, §18.1).** The script ships bundled
  with the new skill; existing skills change only through their text, and
  the classifiers the script reuses are copies kept identical by a test.
- **Before launch, nothing.** A fix made before launch belongs to the phase
  it fixes, on that phase's branch (v0.10.0 §11.8). The sweep applies after
  launch, like backfill.

### 1.4 Versions

v0.13.0 follows v0.12.0 as a minor release. The v1.0 release criterion
(v0.10.0 chapter 17, the published case study) is unchanged.

### 1.5 How to read this document

Chapters 2 to 8 are normative. Chapter 9 is the evidence the design rests
on and is informative. Chapter 10 states the decisions and what is
deferred, chapter 11 the acceptance criteria. **Must** and **never** are
requirements; **should** is a default. A section number without a version
prefix refers to this document; "v0.10.0 §n" reads that section's 0.10.2
text, "v0.11.0 §n" reads v0.11.0, and "v0.12.0 §n" reads v0.12.0.

---

## 2. Vocabulary

- **Launched.** As v0.10.0 §11.8: the system runs in production; an adopted
  tree from adoption, a greenfield tree from the sealing of the campaign
  whose gate includes launch.
- **Main line of an implementation repository.** The branch its merged
  work lands on, `main` unless the invocation names another. It is distinct
  from the spec repo's main line (v0.10.0 §14.2), where verification docs
  and records land.
- **Range.** The commits on an implementation repository's main line
  between the end of the previous sweep of that repository and a named
  head, `{from}..{to}` in git's sense (§3.2).
- **Candidate commit.** A commit in the range that the sweep must classify:
  not a merge, not governance-only, not attributed (§3.2).
- **Governance-only commit.** A commit whose every changed path lies under
  the governance paths: `hsdd/` (the submodule pointer included, under the
  profile), `hsdd-context/` and `openspec/`.
- **Attributed commit.** A commit that is governance-only, a merge, one
  whose message names a phase id of the tree, or one that a sweep record
  has classified. After launch a commit that is none of these is scope
  creep (v0.10.0 §12.7).
- **Surface move.** A diff that adds, removes or changes a route, a table,
  a topic or a schema file as the seam classifiers see them, or that
  touches a path under `hsdd/contract/` (§3.3).
- **Claim.** A sentence in the owning node's closure that the code can make
  false without moving the surface: a phase's Scope or Verification line;
  the node header's Purpose, Owns, Does not own and Isolation strategy; a
  node decision; the Guarantees of a contract the node produces; the
  Decision of an ADR the node is governed by (§3.3). A produced contract's
  Interface is surface, not claim.
- **Class.** The sweep's disposition for a candidate: `log`, `retro`,
  `intake` or `unplaced` (§3.3, §3.4).
- **Sweep record.** The management document of chapter 4.
- **Retro phase, backfill, delegated sign-off.** As v0.10.0 §11.8, §12.7
  and §10.2 define them.

---

## 3. The Sweep

### 3.1 When it applies

A sweep applies to a launched system whose tree is current enough that the
next change will read it: after adoption, after the launch campaign sealed,
or after a seal (v0.12.0 §4.11). It is run by whoever merged the small
changes, a developer at the end of the day or a lead before a checkpoint,
over the same range with the same procedure; the record names who. It does
not apply before launch, and it is not the way to deliver a request: a
ticket, a PRD or an incident goes through `hsdd-intake` before the code is
written, as v0.10.0 chapter 11 says. The sweep looks only backwards, at
commits that exist on the main line.

### 3.2 The range and the candidates

The sweep reads one implementation repository's main line from `{from}` to
`{to}`. `{to}` defaults to the main line's head. `{from}` defaults to the
`{to}` of the newest sweep record for that repository (§4.1); the first
sweep of a repository must name it, and the record says it did. Under the
standalone-spec-repo profile each implementation repository is swept on its
own, from that repository, and the records land in the submodule.

Of the commits in the range, the script sets aside, with a one-line listing
each in the record:

| Set aside | Test |
|-----------|------|
| merge commits | more than one parent |
| governance-only commits | every changed path is under `hsdd/`, `hsdd-context/` or `openspec/` |
| attributed commits | the message's subject, body or a trailer names a phase id the tree's plan files define, as a whole token (not preceded or followed by a letter, a digit, `_` or `-`, and not followed by `.` and a digit); a message naming an id no plan defines is not attributed, and the record notes the unknown id |
| classified commits | a sweep record of this repository already lists the sha |

Everything else is a candidate, and every candidate gets a row. The script
never drops a candidate, and the agent never adds one. A range with no
candidates writes no record: the report says so with the counts, and the
next sweep's default `{from}` is unchanged.

### 3.3 The two tests

A candidate's class comes from two tests applied in order. The first is the
script's, the second the agent's.

**The surface test** (script). For each changed path, the script extracts
routes, topics and migration tables from the file's content before and
after the commit with the seam classifiers of `hsdd-adopt`'s extractor,
copied verbatim; a difference in any of the three is a surface move. So is
a schema file (proto, OpenAPI, GraphQL, Avro, JSON Schema) added, changed
or removed, and so is any changed path under `hsdd/contract/`. A candidate
with a surface move is class **`intake`**, with the move as its reason
(`route added POST /payouts/preview`, `schema changed api/openapi.yaml`).
The classifiers are regex candidates, as `hsdd-adopt` says of them: a move
they miss is for the agent to raise, and a diff that changes what a
produced contract's Interface describes is such a move whether or not they
saw it; a move they report is never lowered by an agent.

**The claim test** (agent), for every candidate the first test left. The
agent reads the diff and the owning node's closure, nothing wider: the
node's spec file, the Scope and Verification lines of its phases, the
Guarantees of the contracts the node produces, and the Decision of each
ADR in its Governed by. If the diff makes any sentence
there false or stale, the class is **`retro`**, and the reason names the
claim by its location (`acme.web.checkout.4 Verification: "shows the fee
line"`). Otherwise the class is **`log`**, and the row is the whole record
of the commit. A copy change that renames what a Verification line names is
`retro`; a font size is `log`; a log line is `log` unless a Guarantee speaks
of logging. The agent writes the claim it found, never a judgment of worth:
"not worth recording" is not a class, and the question the agent answers is
the bounded one.

**On an as-built node** (`- **Adopted:** as-built`, v0.10.0 §6.1) the claim
test is not applied. Its header is an unvalidated claim about intent
(v0.10.0 §6.5), its `## Observed surface` is re-rendered by the
checkpoint's drift pass, and it has no phases whose lines a diff could
stale. A candidate placed on an as-built node is `log` unless the surface
moved; a retro phase is never planned on an as-built node, and promotion
waits for the first change request, as v0.10.0 §6.4 says. Depth on demand
holds for small fixes too.

The agent may raise a class: `log` to `retro`, and either to `intake` when
it reads a move the classifiers missed or when the paths span two nodes
(§3.4). It never lowers one. A person who runs the sweep may lower any
class before the record is committed, the agent's or the script's, with a
change-log line naming the person, the sha and the reason; a script-set
`intake` lowered this way records a false positive of the classifiers (a
route-like string in a comment, a `.schema.json` fixture), and the record's
`Run by` line is who answers for it. After publication no class is lowered
(§4.3).

### 3.4 Placement

Every candidate names the node it happened in, by this order of evidence:

1. an `HSDD-Node:` trailer in the message naming a node the tree defines;
2. the script's proposal: exactly one node whose `## Observed surface`
   `modules:` line (v0.10.0 §6.2) covers every changed path; when the
   `modules:` lines of two nodes each cover some of the paths, the script
   sets `intake` with the reason `spans` (below);
3. the agent's reading of the atlas (`hsdd/spec/` when there is none): each
   node's Isolation strategy, its phases' Scope lines, and any `modules:`
   line, the same prompt the user's guide gives;
4. the person running the sweep, asked once, for the commits the first
   three left.

Paths that span two nodes make the commit `intake` with the reason `spans
{node}, {node}`: two nodes is the first sign the change is not small, and
the collision rules of v0.10.0 §11.7 belong to intake. A commit whose paths
are partly unowned is placed by the runner or not at all. A commit no node
owns and nobody places is **`unplaced`**, with the paths as its reason; it
is listed for the owner (§5.3) and is never guessed onto a node.

### 3.5 Who runs it, and who answers

A sweep's `Run by` line names a person, or `{agent} for {person}`, the same
rule as a sign-off (v0.10.0 §10.2). The classification is a judgment and
must be answerable. The next checkpoint lists sweep records run by
delegation since the last one in the same finding as delegated sign-offs,
for the person to ratify. A developer sweeping their own merged fixes
answers for them; a lead sweeping the week's range answers for the
classification, not for the code.

---

## 4. The Sweep Record

### 4.1 The file

`hsdd/management/YYYY-MM-DD-sweep-{repo}-{to7}.md`: the date of the run,
the repository's name, and the first seven characters of `{to}`. `{repo}`
is `--repo` when the invocation gives it; else the last path segment of the
`origin` remote's URL without `.git`, which is the same on every
developer's machine; else the basename of the top-level directory, and the
header's `Repository` line says which. The name is lower-cased with every
character that is not a letter or digit replaced by `-`. It is the key
under which records chain (§3.2) and the checkpoint matches them (chapter
7), so it must not vary by clone. A name that contains `progress`,
`execution-plan`, `milestones` or `atlas` is refused with a request for
`--repo`, so the slug never carries a word the reading aids read as a
dated report. Like intake records (v0.10.0 §11.5)
the record is dated, never superseded and outside the supersedes chain;
records accumulate, one per repository per run. The newest record for a
repository is the one with the latest date and, among records of one date,
the one whose `{to}` descends from the others' on the main line.

### 4.2 The shape

````markdown
# Sweep: {repo} {from7}..{to7}

- **Date:** YYYY-MM-DD
- **Repository:** {repo} ({main line branch}; named by --repo | origin | directory)
- **Range:** {from}..{to} ({n} commits, {k} candidates; from named | from {previous record filename})
- **Run by:** {person} | {agent} for {person} (delegated)
- **Status:** open | closed (YYYY-MM-DD)

## Commits

| Commit | Node | Class | Reason | Subject |
|--------|------|-------|--------|---------|
| a1b2c3d | acme.web.checkout | log | none | checkout: larger total on the preview |
| b2c3d4e | acme.web.checkout | retro | acme.web.checkout.4 Verification: "shows the fee line" | checkout: "fee" becomes "charge" |
| c3d4e5f | acme.backend.payouts | intake | route added POST /payouts/preview | payouts: preview endpoint |
| d4e5f6a | none | unplaced | src/legacy/report.ts | report: null check |

## Not candidates
- merges: {n} ({shas})
- governance-only: {n} ({shas})
- attributed: {sha} -> {phase-id}, ...
- classified by {filename}: {shas}
- unknown phase id: {sha} names {id}

## Routing
**H1** (retro, acme.web.checkout):
```text
{the append prompt of §5.1, verbatim}
```
```text
{the reconcile prompt of §5.1}
```
```text
{the verification-doc prompt of §5.1, verbatim}
```
**H2** (intake, c3d4e5f):
```text
{the prompt of §5.2, verbatim}
```

## Produced
- H1: acme.web.checkout.9
- H2: 2026-11-06-intake-payouts-preview.md

## Change log
- YYYY-MM-DD: created; {k} candidates: {l} log, {r} retro, {i} intake, {u} unplaced
````

Every cell is one clause. The `Reason` cell is `none` for `log`, the claim's
location for `retro`, the surface move or the spanned nodes for `intake`,
the paths for `unplaced`. The `Subject` cell is the commit's subject line
with any pipe character replaced by a slash. A category under
`## Not candidates` with nothing in it reads `none`. `## Produced` reads
`none` until a product lands. The record cites and never defines (v0.10.0
§12.1): a reason names where a claim lives, not what the code now does;
what the code now does is the retro phase's business.

### 4.3 Edits after publication

A published record accepts the two edits of v0.10.0 §12.2, ticking `Status`
and appending to the change log, and one more, named here as the milestone
absorb is named there: a person may edit the `Node` and `Class` cells of an
`unplaced` row, and its `Reason` with them, with a change-log line naming
the person and the new class, and with the handoff the new class needs
appended to `## Routing`. Nothing else is edited in place; a wrong class on
any other row is corrected by a change-log line and, when the correction
raises the class, by the handoff it now needs, appended to `## Routing`. No
class is lowered after publication, by anyone: lowering happens before the
commit (§3.3), and a published `intake` row's commit went to intake, whose
record says what it found.

### 4.4 Closure

A record **closes** when every `retro` and `intake` row's handoff has its
product named in `## Produced` (a phase id whose Scope cites the record; an
intake record whose `**Request:**` names the sha) and no `unplaced` row
remains. Closure means the commits are attributed, not that the retro
phases are done: a retro phase's done-ness is its node's ledger's business
and its intake's, and the sweep record does not track it twice. A record
with only `log` rows is written `closed` by the sweep itself, on the day it
is created, with no change-log line beyond the first. Every other record is
closed by `hsdd-checkpoint` (chapter 7), which appends the products and
ticks the status; the sweep closes nothing it did not create closed.

---

## 5. Handoffs

### 5.1 `retro`: one phase per node per record

For each node with `retro` rows, `## Routing` carries one handoff `H{n}`
in three prompts, which the agent runs in order or hands to the person who
will. The first appends the phase through `hsdd-phase-plan` append mode:

```text
/hsdd-phase-plan {node} per hsdd/management/{record}: add one retro phase
for commits {sha}, {sha}. Scope lists each commit with the claim it staled
(the record's Reason cells); Verification states the behavior as the code
now has it; review tier gate-only; gate the node default. Plan nothing the
commits did not do. If a commit moved a route, schema, topic or table, stop
and say so: that is an intake, not a retro phase.
```

The second drains what the append emitted, usually nothing:
`/hsdd-reconcile {node}`. The third writes the verification doc, with
`{phase-id}` filled by the agent from the append's result:

```text
Write hsdd/verify/{phase-id}.verification.md from
hsdd/templates/verification.md for the retro phase. Commands to run: the
node's gate. Observed: run it now, dated, and open with "Retroactive:
written after commits {sha}, {sha} shipped". Outstanding and Learnings per
the template. Sign-off: {agent} for {person} (delegated), tier gate-only.
Run the commands; do not invent an observation.
```

`{person}` is the record's `Run by` person, who answers for the sweep and
so for its retro docs; the checkpoint lists the delegated sign-off for them
to ratify like any other (v0.10.0 §10.2). The phase is named `(retro)`,
cites the record in its Scope (v0.10.0 §11.3 names the intake record the
same way), and lists the shas. No phase context is written for it: the code
exists. A retro phase is one phase per node per record however many
commits it lists, and it is never split by commit. v0.10.0 §7.2's ceiling
sizes the run and the review of work not yet done; a retro phase records
work that is done, so the ceiling does not apply to it, and a commit list
too long to read in one sitting is a sign the sweep ran too late, which the
record's range shows. A retro phase is never planned on an as-built node
(§3.3).

### 5.2 `intake`: one record per commit

For each `intake` row, one handoff to `hsdd-intake`, with the prompt:

```text
/hsdd-intake route {repo}@{sha} (commit): {subject}. Shipped {date} on the
main line; the sweep found {reason}; per hsdd/management/{record}.
```

`commit` is a new authority value (chapter 7): the request is the diff,
already in production. Intake classifies it as any other request, `local`,
`cross-node`, `new-capability` or `structural`, reads the open intakes for
collisions, writes its record and hands off; the phases it produces are
retro phases, since the code shipped, and the contract bump it orders is
the one the surface move already made in the code. The intake record's
`**Request:**` line names `{repo}@{sha}`, which is how the checkpoint ties
it back to the sweep record (§4.4).

### 5.3 `unplaced`: listed for the owner

An `unplaced` row has no handoff. The record lists it, the sweep's report
names it, and the next checkpoint files it as a finding: code on no node is
unadopted surface, and its plan step is `hsdd-adopt` on that surface
(v0.10.0 §15.1's "one case worth calling out"), or a person placing the
commit under §4.3. The record stays open until the row is placed.

---

## 6. The Skill

### 6.1 Role and packaging

`hsdd-sweep` is the fourteenth skill. Its `SKILL.md` tells the agent to run
the script, to fill only the cells the script left, to apply the claim test
as §3.3 states it and no wider test, to ask the runner for placements the
evidence did not give, to fix a record `check` refused and run `check`
again, and never to commit a record `check` refused. Its `scripts/`
directory holds `sweep.mjs` and `lib/`, Node 20 or later, no dependency,
and eight files copied verbatim and kept byte-identical by a test in this
repository: from `hsdd-adopt/scripts/`, the classifiers `routes.mjs`,
`topics.mjs`, `migrations.mjs` and `schemas.mjs`, and `diff.mjs` with
`walk.mjs`, which parse a `modules:` line as the drift pass does; from
`hsdd-summary/scripts/`, `md.mjs` and `extract-plan.mjs`, which read node
and phase ids as the seal and the reading aids do. The sweep then agrees
with every other reader about what a route, a scope and a phase id are. The
directory is copied verbatim to `hsdd/scripts/sweep/` under the
bundled-script copy rule (v0.11.0 §4.3).

### 6.2 Invocation

From an implementation repository's root, the directory that holds `hsdd/`:

```text
node hsdd/scripts/sweep/sweep.mjs draft [--from SHA] [--to REF] [--main BRANCH] [--repo NAME] [--run-by NAME] [--today YYYY-MM-DD] [--write]
node hsdd/scripts/sweep/sweep.mjs check hsdd/management/DATE-sweep-REPO-SHA7.md
node hsdd/scripts/sweep/sweep.mjs commit hsdd/management/DATE-sweep-REPO-SHA7.md
```

The slash command is `/hsdd-sweep`; its arguments are the script's. A
developer types it after merging; a lead types it before a checkpoint. An
unattended run under `hsdd-auto` is deferred (§10.2).

### 6.3 The steps

**`draft`** reads the range (§3.2), sets aside what §3.2 names, runs the
surface test (§3.3) and the script's placement (§3.4 steps 1 and 2), and
writes the record of §4.2 with every candidate row present: `intake` rows
complete, with their reason; other rows with `Node` filled where the
evidence gave one and `?` where it did not, and `Class` and `Reason` as
`?`. The header, the `## Not candidates` section and the first change-log
line are complete; `## Routing` and `## Produced` read `none`. Without
`--write` the draft is printed and nothing is written; an existing record
for the same repository and `{to}` is never overwritten. A `--from` earlier
than the previous record's `{to}` is accepted and the overlap lands under
`classified by`. A `--to` that is not on the main line, or a `--from` that
is not an ancestor of `--to`, is refused before anything is read. The
script reads the repository through git only; it never checks out, stashes
or writes to the working tree: the before and after contents the
classifiers read are materialized from `git show` into a temporary
directory outside the repository, removed afterwards. A range with no
candidates writes nothing (§3.2).

**The agent** then fills every `?`: the node by §3.4 step 3, asking the
runner (step 4) for what the tree does not answer; the class and reason by
the claim test. It raises classes as §3.3 allows and lowers none. It writes
`## Routing` from the rows, one handoff per node with `retro` rows and one
per `intake` row, with the prompts of chapter 5 verbatim, in table order,
numbered `H{n}`, each headed `**H{n}** ({class}, {node or sha}):`, a
`retro` handoff carrying the three prompts of §5.1. For a record whose
rows are all `log` it leaves `## Routing` at `none` and ticks `Status` to
`closed` with the record's date.

**`check`** reads the record back against a fresh `draft` of the range its
header names, with the record under check left out of the classified set,
and refuses, naming the row, when: a candidate has no row or a row has no
candidate; a cell is still `?`; a class is not one of the four; a `retro`
or `intake` row's reason is `none`; a row the draft set `intake` is
anything else and no change-log line names its sha as lowered by a person
(§3.3); a `log` row's sha appears in a handoff; a `retro` or `intake` row
has no handoff whose first prompt names its sha; a `retro` row's node is
as-built; a node named is not in the tree; `Run by` is empty or a template
placeholder; `Status` is `closed` on a record with a `retro`, `intake` or
`unplaced` row, or `open` on a record with only `log` rows. `check` exits
non-zero and writes nothing; the agent fixes the record and runs it again.

**`commit`** runs `check`, then commits the record alone with the message
`sweep: {repo} {from7}..{to7}`; anything else staged stays staged. Under
the profile the commit lands inside the submodule and the pointer is bumped
in the implementation repository; the step refuses while the submodule's
HEAD is detached (v0.10.0 §14.4 rule 1, as the seal does). It never pushes.
The agent then runs the handoffs of `## Routing` in order, or hands the
prompts to the person who will.

### 6.4 Files

| Path | Written by | Holds |
|------|-----------|-------|
| `hsdd/scripts/sweep/` | the first run, by copy | the script and the eight copies of §6.1 |
| `hsdd/management/YYYY-MM-DD-sweep-{repo}-{to7}.md` | `draft`, then the agent, then `commit` after `check`; `hsdd-checkpoint` appends `## Produced` and ticks `Status` | the record |

---

## 7. Edits to Existing Skills

Each is a change to the skill's text only.

- **`hsdd-checkpoint`.** The code-vs-plan pass reads every sweep record of
  each implementation repository. After launch, a commit on the main line
  that is a merge, is governance-only, names a phase id, or is a row in a
  sweep record is attributed; a `log` row needs nothing further, and a
  commit trailer attributes nothing on its own. Every other commit
  since the newest record's `{to}`, or since launch when there is none, is
  one backfill finding per repository naming the unswept range, whose plan
  step is `/hsdd-sweep --from {sha}`, never a retro phase per commit; the
  two-checkpoint escalation of v0.10.0 §11.8 stands. The intake-record pass
  gains the sweep records: for each open record, append to `## Produced`
  the phase ids whose Scope cites it and the intake records whose
  `**Request:**` names one of its `intake` shas, tick `closed (date)` when
  §4.4 holds, and file as findings an `unplaced` row (plan step:
  `hsdd-adopt` on the paths, or a person placing it), a record still open
  two checkpoints after its date with a handoff not landed, and a sha two
  records both classify. Sweep records run by delegation since the last
  checkpoint join the delegated sign-offs' finding. Sweep records are
  outside the chain rules, like intake records and the seal plan. Where a
  project's `conventions.md` still carries the user's guide's `## Manual
  lane (project convention)` paragraph, this rule takes precedence over
  it, and the first checkpoint after the upgrade files the paragraph as a
  finding whose step removes it (§8.1).
- **`hsdd-intake`.** The authority list gains `commit`: a request of the
  form `{repo}@{sha}` whose change already shipped on an implementation
  repository's main line. The `## Request` section cites the sweep record;
  the phases the routing produces are retro phases, and the handoff prompt
  to `hsdd-phase-plan` says so.
- **`hsdd-phase-plan`.** Append mode's retro phase may record several
  commits from one sweep record: its Scope cites the record and lists each
  sha with the claim it staled; one retro phase per node per record, never
  one per commit; review tier gate-only unless the prompt says otherwise.
  The checklist item on retro phases admits the record where it named the
  finding id, either being admissible.
- **`hsdd-spec`'s `conventions.md` template.** The layout gains
  `hsdd/scripts/sweep/`; `hsdd/management/` names `hsdd-sweep` among its
  writers (the sweep record); the profile section's repository list names
  each repository by the name §4.1 derives, so the list and the records
  agree.

The user's guide's "Small fixes and small requests on a launched system"
section is rewritten over the skill: the "fix already made" path and the
`## Manual lane (project convention)` paragraph become the sweep, and the
`HSDD-Node:` trailer stays as the placement hint §3.4 reads. `HSDD-Kind:`
is read by nothing and the guide stops recommending it; a project that
writes it loses nothing. The guide's Upgrading section tells a project
that added the convention paragraph to remove it.

---

## 8. Compatibility

### 8.1 Upgrading to v0.13.0 is additive

Upgrading means reinstalling the fourteen skills. No existing artifact is
rewritten. v0.10.0 §15.1's table gains these rows:

| Change | Effect on an existing ≥0.6.1 project | Implemented in v0.13.0 by |
|--------|--------------------------------------|---------------------------|
| `hsdd-sweep` and `hsdd/scripts/sweep/` (chapters 3 to 6) | Opt-in. A project that never sweeps is unaffected: its post-launch commits with no phase are backfill findings as before, and the finding's step now names a sweep. | `hsdd-sweep`; `hsdd-checkpoint` |
| The sweep record (chapter 4) | A new management document outside the chain rules; the reading aids ignore it by its slug. | `hsdd-sweep`, `hsdd-checkpoint` |
| The `commit` authority (§5.2) | A new value of an existing field; existing records are unchanged. | `hsdd-intake` |
| A retro phase over several commits (§5.1) | Forward-only: retro phases already planned stand. | `hsdd-phase-plan` |
| The manual lane as a project convention (user's guide, 0.12) | A project that adopted the convention is conformant; its trailers are read as hints, its same-day retro phases stand, and its first sweep names its own `--from`. Its `## Manual lane` paragraph conflicts with chapter 7's attribution rule, so the first checkpoint after the upgrade files it as a finding whose step removes it. | `hsdd-sweep`; `hsdd-checkpoint` |

### 8.2 Artifact stability

The sweep record joins v0.10.0 §15.3's frozen set when v0.13.0 is released:
its header lines, its five table columns in their order, and its four
section headings. Later releases may add optional header lines, columns to
the right of `Subject`, or sections after `## Change log` only.

### 8.3 Edits to earlier text

- v0.10.0 §1.5, v0.11.0 §15.3 and v0.12.0 §7.3: "Thirteen skills" becomes
  "Fourteen skills"; the table gains this document's §6.1 row; the chain
  diagram gains the line
  `hsdd-sweep (after launch) -> attributes small commits, one row each`.
- v0.10.0 §2.6 and §11.2: the authority list gains `commit`.
- v0.10.0 §7.2: the ceiling does not apply to a retro phase, which records
  work already done (§5.1).
- v0.10.0 §11.8: steps 2 to 4 read: the checkpoint's code-vs-plan pass
  files one backfill finding per repository naming the unswept range; its
  step is a sweep; the sweep's `retro` and `intake` rows produce the retro
  phases, with verification docs written after the fact and marked
  retroactive; a `log` row needs none. Step 5 stands.
- v0.10.0 §12.7: the code-vs-plan and intake-record passes read as chapter
  7's first bullet.
- v0.10.0 §14.1: the layout tree gains `hsdd/scripts/sweep/` and
  `hsdd/management/YYYY-MM-DD-sweep-{repo}-{to7}.md`.
- v0.10.0 §18.1: this document's §10.1 rows are appended.
- v0.10.0 chapter 19: this document's §8.4 terms are appended.
- v0.12.0 §9.2: the row on the `manual` intake class and the commit-trailer
  lane is struck; this document is its promotion.

### 8.4 Glossary additions

Sweep, range, candidate commit, governance-only commit, attributed commit,
surface move, claim, class, sweep record: each as chapter 2 defines them.

---

## 9. Evidence (informative)

### 9.1 What FT-4 and the manual lane showed

FT-4 (v0.12.0 §8.1) is the released system whose tree went stale because
its developers fixed QA findings by hand faster than phases could be
planned, and whose owner found the one-retro-phase-per-change repair more
expensive than the work it recorded. The seal answered the recovery. The
user's guide then described a manual lane as a project convention: a fix
that moves no contract surface may ship before its phase exists, carries
`HSDD-Node` and `HSDD-Kind` trailers, and gets a same-day retro phase with a
retroactive verification doc. v0.12.0 §9.2 deferred promoting the lane to a
rule until a project had run it for a release.

The owner's request of 2026-11-05 said why the lane as described would not
be run: for a font size, a copy change or a log line, a retro phase and a
verification doc are the ceremony the lane was meant to remove, only moved
to the same day. The request proposed a file of commit shas and a skill to
bulk-intake them, deciding per entry whether the change was worth
recording. Three observations shaped what this document does with it:

| Observation | Rule |
|-------------|------|
| A hand-kept file of shas duplicates the git log, drifts from it, and costs an edit per fix, which is the friction the lane exists to remove. | The input is a range on the main line; the previous record supplies the default start (§3.2). |
| "Worth recording" as an open judgment is the question the method cannot answer well in an agent; the dividing lines the guide already names are tests an agent can apply. | Two tests, surface and claim, the first by script and the second bounded to the owning node's closure (§3.3). |
| The one-retro-phase-per-change shape failed in FT-4 by volume, not by kind: a phase is the right record for a change that staled a claim and the wrong one for a change that staled nothing. | Three classes; `log` is one row; `retro` is one phase per node per record (§3.3, §5.1). |

### 9.2 What has not been shown

No project has run a sweep. The claim test has not been measured for
agreement between an agent and a person over a real week of commits, and
the surface classifiers have been exercised only on `hsdd-adopt`'s
fixtures. The first field run should record, in its records' change logs,
every class a person lowered, since each is a case the agent judged too
strictly, and every `log` row a later checkpoint found to have staled a
claim, since each is a case it judged too loosely. Chapter 10 marks every
decision `reasoned-only`.

---

## 10. Decisions

### 10.1 Settled

Provenance as v0.10.0 chapter 18 defines it.

| Question | Decision | Provenance |
|----------|----------|------------|
| Where small post-launch changes are recorded | In a sweep record, one row per commit; a phase only when a claim went stale; an intake only when the surface moved (chapters 3 to 5). | reasoned-only |
| The sweep's input | A commit range on an implementation repository's main line, defaulting from the previous record; never a hand-kept file (§3.2). | reasoned-only |
| What "worth recording" means | Two bounded tests, surface then claim; the agent names the claim or the move, never a worth (§3.3). | reasoned-only |
| Who applies which test | The script applies the surface test and proposes placement from `modules:` lines; the agent applies the claim test over the owning node's closure and places from the tree; the runner places what the tree does not answer (§3.3, §3.4). | reasoned-only |
| Lowering a class | Never by an agent; a person may before the record is committed, the script's `intake` included, with a change-log line that `check` reads; never after publication (§3.3, §4.3, §6.3). | reasoned-only |
| A small fix on an as-built node | `log` unless the surface moved: no claim test, no retro phase, no promotion for a shipped fix (§3.3). | reasoned-only |
| What the retro handoff runs | The append, the reconcile and the retroactive verification doc, signed by delegation for the `Run by` person (§5.1). | reasoned-only |
| The retro phase and the sizing ceiling | Exempt: it records done work; a long commit list is evidence the sweep ran late (§5.1). | reasoned-only |
| `{repo}` | `--repo`, else the origin remote's basename, else the directory's; refused when it carries a reserved word (§4.1). | reasoned-only |
| A range with no candidates | No record; the next default `{from}` is unchanged (§3.2). | reasoned-only |
| How the script reads the tree | Through copies of the extractor's and the summary engine's parsers, byte-identical to their sources (§6.1). | reasoned-only |
| A commit two nodes own | `intake`: collisions belong to intake (§3.4). | reasoned-only |
| A commit no node owns | `unplaced`, listed for the owner, never guessed onto a node; a person may place it in the record after publication (§3.4, §4.3, §5.3). | reasoned-only |
| The record's grain | One per repository per run, dated, never superseded, named by repository and `{to}` (§4.1). | reasoned-only |
| Closure | When every handoff's product is named and no row is unplaced; done-ness of the retro phases is not the record's to track (§4.4). | reasoned-only |
| Retro phase grain | One per node per record, listing its commits; never one per commit (§5.1). | reasoned-only |
| A `log` row's verification | None; the row claims only where the commit happened (§1.3, §3.3). | reasoned-only |
| Where the lane lives | A fourteenth skill: event-driven like intake, cheap like the seal, writing into management and handing off into governance (chapter 6). | reasoned-only |
| The script's and the agent's edit surfaces | The script owns the record's structure and the `intake` rows; the agent fills `?` cells and writes `## Routing`; a person's lowering is logged; `check` refuses anything else (§6.3). | reasoned-only |
| Who answers for a classification | The `Run by` person; a delegated run is listed for ratification like a delegated sign-off (§3.5). | reasoned-only |
| The checkpoint's backfill step | A sweep over the unswept range, not a retro phase per commit (chapter 7). | reasoned-only |
| Commit trailers | `HSDD-Node:` is read as a placement hint; nothing is required; `HSDD-Kind:` is not read (§3.4, chapter 7). | reasoned-only |

### 10.2 Deferred

| Deferred | Why |
|----------|-----|
| A `sweep` step kind under `hsdd-auto` | The agent's part has two ask points (a placement the tree does not give, and a class it would lower) that the stop policy can carry; the first field runs should show how often they fire before a step kind is written. The record already carries its handoffs in `## Routing` and admits an `hsdd-handoffs` block later, as intake's does. |
| A `**Launched:**` line in conventions, as the default `--from` of a repository's first sweep and the checkpoint's launch test | Today launch is inferred (v0.10.0 §11.8) and the first sweep names its start. One line would make both mechanical; whether anyone forgets the first `--from` is for the field to show. |
| A claim test by script | It needs claims a script can read, which v0.10.0 §1.4's structural anchors give for Scope and Verification lines but not for prose; the judgment layer the v0.11 and v0.12 deferred lists name is where a structured claim would come from. |
| A per-node maintenance ledger | Derivable from the sweep records and git; a living appended file is a third in-place-edit model the management layer does not have. Written only if readers ask for it. |
| A verification doc field for external evidence | Unchanged from v0.12.0 §9.2; a retro phase over several commits makes the field more useful, not less. |
| Sweep records on the reading aids | The checkpoint page reads the progress report and plan; a sweep's effect is a line in the report's code-vs-plan section, which the page already renders. A sweep view waits for a release that touches the summary scripts. |
| A sweep across several repositories in one record | One record per repository keeps the range, the default start and the closure per repository; a lead sweeping two repositories runs the command twice. Merged records return if that proves tiresome. |
| Reading sweep records at the seal | A tree swept weekly does not go stale. If a sealed tree ever has open sweep records, the seal's `close` should close them too; the first such seal decides. |

### 10.3 Rejected

- **A hand-kept file of commit shas as the input.** It is a copy of the git
  log that can drift from it, and an edit per fix is the friction the lane
  removes. The curation it would carry lives in trailers and in the
  runner's answers.
- **A mode of `hsdd-checkpoint`.** The checkpoint already finds unphased
  commits, but it is periodic, expensive and read-only toward governance;
  the sweep is event-driven, cheap, and must hand off into governance.
  FT-4's owner found the checkpoint's output more than a person reads;
  tying the cheap lane to it would make the lane unused.
- **A mode of `hsdd-intake`.** A sweep is many requests with authority
  `commit`, but intake's process (every open record read, collisions
  serialized, a record before any handoff) is the ceremony that does not
  fit a font size. A sweep mode would skip most of intake and be a
  different skill under the same name.
- **"Worth recording" as the agent's question.** Unbounded, unauditable,
  and the kind of judgment the method keeps with people. The bounded tests
  are auditable by anyone who reads the row.
- **Not recording `log` commits at all.** Then they are scope creep at
  every checkpoint, or the checkpoint must learn to ignore them, and the
  tree's attribution is incomplete in a way nobody can see. One row is the
  cheapest honest attribution.
- **A verification doc per `log` commit.** The ceremony the lane exists to
  remove; a `log` row claims nothing a doc would verify.
- **One retro phase per commit.** FT-4's repair shape; it fails by volume.
- **A required commit trailer.** A commit without one still gets
  classified; a lane that requires discipline at commit time is the lane
  that gets skipped under pressure, which is when it matters.
- **A living per-repository ledger instead of dated records.** A third
  in-place-edit model; dated records follow the intake precedent, and the
  `{to}` in the name gives the next sweep its start without parsing.

---

## 11. Acceptance

### 11.1 Script tests

Under `test/`, with Node's built-in test runner and a fixture under
`test/helpers/` holding a git repository with a tree of two nodes that both
carry an `## Observed surface` whose `modules:` line names a prefix, one
promoted with phases and one as-built, and a main line of commits that
cover: a merge; a governance-only commit; a submodule pointer bump under a
profile variant; a commit whose message names a phase id, one whose trailer
does, and one naming an id no plan defines; a commit adding a route, one
changing a schema file, one adding a migration with a table, one adding a
topic producer, each in a file whose other lines also change; a copy change
in a routes file that moves no route; a log line; a commit under the
as-built node's prefix that would stale a header sentence; a commit
spanning both nodes' prefixes; a commit under a path no node owns; a commit
carrying `HSDD-Node:`. At least:

- the range: default `--from` from the newest record of the repository, and
  the overlap under `classified by`; a first sweep with no record and no
  `--from` is refused; a `--to` off the main line and a non-ancestor
  `--from` are refused before anything is read; a range of only set-aside
  commits writes nothing and exits 0 with the counts.
- the set-aside: merges, governance-only commits (the gitlink included),
  attributed commits with the boundary rule, unknown ids noted.
- the surface test: each of the four moves is `intake` with the stated
  reason; the copy change in the routes file is not; a path under
  `hsdd/contract/` is; the working tree is untouched and no temporary
  directory is left behind.
- placement: the trailer first, then a unique `modules:` match, then `?`;
  both prefixes give `intake` with `spans` by script; no node gives `?`,
  never a guess.
- the as-built rule: the commit under the as-built node's prefix drafts
  with the node proposed; filled `retro` by a test, `check` refuses it;
  filled `log`, it passes.
- the draft: every candidate has a row, cells as §6.3 says, the header and
  the `## Not candidates` section complete; nothing written without
  `--write`; an existing record for the same `{to}` is not overwritten.
- `check`: each refusal of §6.3 on a record edited to trigger it, naming
  the row; a conformant record passes; the record under check is not
  counted against itself; a script-set `intake` lowered with a change-log
  line passes and without one is refused; an all-`log` record must be
  `closed` and any other `open`.
- `commit`: the record alone, unrelated staged files left staged; the
  message; under the profile, inside the submodule with the pointer bumped
  afterwards, and refused while the submodule's HEAD is detached.
- the slug: `{repo}` from `--repo`, else the origin remote's basename, else
  the directory's, normalized as §4.1 says; a name carrying a reserved word
  is refused.
- the eight copies of §6.1 are byte-identical to their sources.

### 11.2 Documentation and skill texts

`SKILL.md` under 200 lines with triggers and do-not-use cases, the claim
test and the as-built rule stated as §3.3 states them, and an
anti-rationalization table whose first row is the worth judgment; the slash command delegates in one line;
the four skill texts of chapter 7 carry their edits; the conventions
template carries chapter 7's lines; the user's guide's small-fixes section
is rewritten over the skill, and the third situation in "Outside the loop"
names it; the README table, install line and chain diagram count fourteen
skills; the interactive guide's skill map lists it; the changelog entry
names the upgrade effects of §8.1.

### 11.3 Live acceptance

One sweep over a real range on a launched tree, run by a person, with the
record committed and the handoffs run: at least one `log`, one `retro` and
one `intake` row among the candidates, the retro phase appended and its
retroactive verification doc signed, the intake record written, and the
next checkpoint closing the sweep record with no finding against it other
than the delegated-run listing. The record's change log notes every class
the person lowered (§9.2).
