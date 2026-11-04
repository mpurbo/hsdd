# HSDD: Hierarchical Spec-Driven Development (v0.12 delta: sealing a released tree)

> Delta specification. It adds `hsdd-seal`, a thirteenth skill that seals a
> released tree whose artifacts went stale, by script and with no model in
> the loop, and the one rule the seal needs that earlier versions lack: a
> `dropped` status for a phase that was planned and never built. Read it
> against v0.10.2 and v0.11.0; only the changes are stated here. Everything
> in those documents not touched below still stands.

**Version:** 0.12.0 (draft)
**Status:** For review
**Date:** 2026-11-04
**Owner:** Purbo Mohamad
**Drafted from:** FT-4, a released multi-node system built with HSDD v0.10
whose tree went stale between the release crunch and the first weeks of
production (chapter 8), and the fixture-tested implementation of the skill
with its independent review. This document, v0.10.2 and v0.11.0 are the
whole input for implementing the release.
**Supersedes (in part):** v0.10.0 §1.5's skill count and table (one row
added), §7.1's phase record (one optional line), §11.5's closure rule (one
case added), §12.3's done counts and §12.7's sealing rule (dropped phases
and the seal's hand-written ticks), §14.1's layout tree (one directory and
two files added), §15.1's compatibility table (rows added), chapter 18 (rows
added) and chapter 19 (terms added); v0.11.0 §15.3's "Twelve skills" (now
thirteen). All other provisions are unchanged.

---

## 1. What 0.12 Changes and Why

### 1.1 The problem

A system shipped. QA verified it. The HSDD tree that planned it did not
keep up: at the release crunch the developers fixed QA findings by hand,
verification docs went unsigned while the product went live, product
requests after launch landed outside the tree, and the weekly checkpoint
produced more than its readers could digest. When the owner tried to bring
the tree back, the method's own answer, one retro phase per manual change
(v0.10.0 §11.8), cost more review than the work it recorded, because it
rebuilds history and its cost grows with the number of changes. The tree
stayed stale, and a stale tree is one nobody trusts.

Three defects in the method showed up at once. The gate duplicated QA: the
team had a working definition of done and the method insisted on a second
one. There was no lane whose cost per change was near zero. And the
checkpoint's output was not sized for a person. v0.12 answers the first and
the recovery; the user's guide's "Outside the loop" chapter describes the
lane and the other practices as project conventions (§9.2 defers them).

### 1.2 What this release adds

- **A `dropped` phase status** (chapter 3): one optional line on a phase
  record that takes the phase out of every scope and every done count while
  keeping its id and its ledger row. The method had retirement for nodes and
  nothing for a phase that was planned and never built.
- **The seal** (chapter 4): a named operation on a released tree that
  leaves its ledger consistent without a per-phase review. Every act it
  needs is admissible under v0.10.2 already: a delegated sign-off counts as
  done (§10.2), an Outstanding item may be waived with a reason (§10.2), a
  verification doc written after the fact is the retroactive doc the bypass
  rule names (§11.8), an intake record closes when its produced phases are
  done (§11.5), a campaign seals when its gates are green (§12.5), and a
  protocol stated in `conventions.md` reaches every skill (§14.2). The seal
  composes them, adds the dropped status, and runs no checkpoint.
- **`hsdd-seal`**, a thirteenth skill (chapter 5), whose work is a script:
  `plan` reads the tree and writes a plan with a default class per phase;
  the owner edits that one field; `apply sign|drop|prune|close` writes the
  artifacts; `report` reads the result back. No model reads the tree. The
  one judgment in a seal, which phases shipped, is the owner's.
- **Edits to four skills' text** (chapter 6) so that the checkpoint, the
  milestone document, phase planning and intake records read the dropped
  status the way this document defines it.

### 1.3 What it does not change

- **The core invariant (v0.10.0 §1.3)** and the definition of done. A seal
  signs by delegation and says so in every doc it signs; it never claims an
  observation that did not happen.
- **Human review.** The seal moves the owner's attention from every phase
  to one plan file and one Needs-the-owner list; it does not remove it. The
  first checkpoint after a seal lists every delegated sign-off the seal made
  for the owner to ratify (v0.10.0 §12.7).
- **Artifact formats (v0.10.0 §15.3).** The Status line is optional and its
  absence keeps a phase record conformant; the closure variant is a new
  value of an existing field; the seal plan is a new management document.
- **The scripts boundary (v0.10.0 §16.3, §18.1).** The scripts ship bundled
  with the new skill. Existing skills change only through their own text,
  and the two parsers the skill reuses are copies kept identical by a test.
- **No checkpoint at the seal, no reconcile, no milestone generation.** The
  evidence pass was paid for before the seal; the first steady-state
  checkpoint finishes it (§4.11).

### 1.4 Versions

v0.12.0 follows v0.11.0 as a minor release. The v1.0 release criterion
(v0.10.0 chapter 17, the published case study) is unchanged.

### 1.5 How to read this document

Chapters 2 to 7 are normative. Chapter 8 is the evidence the design rests
on and is informative. Chapter 9 states the decisions and what is deferred,
chapter 10 the acceptance criteria. **Must** and **never** are requirements;
**should** is a default. A section number without a version prefix refers
to this document; "v0.10.0 §n" reads that section's 0.10.2 text, and
"v0.11.0 §n" reads v0.11.0.

---

## 2. Vocabulary

- **Released tree.** A tree whose system runs in production: an adopted tree
  from adoption, a greenfield tree from the sealing of the campaign whose
  gate includes launch (v0.10.0 §11.8).
- **Stale tree.** A released tree with phases whose verification docs are
  unsigned or missing, phases planned and never built, open intake records,
  or an unsealed milestone document, after the work it describes has
  shipped.
- **Dropped phase.** A phase whose record carries `- **Status:** dropped
  (date, reason)` (chapter 3).
- **Seal.** The operation of chapter 4, and its result: a tree in which
  every phase is done or dropped, every intake record with done phases is
  closed, and the campaign's milestone document is sealed and archived.
- **Seal plan.** The pair of management documents `plan` writes
  (`hsdd/management/YYYY-MM-DD-seal-plan.json` and `.md`); the JSON is the
  owner's edit surface, the markdown a rendering of it (§4.3).
- **Class.** The seal plan's disposition for a phase: `done`, `sign`,
  `drop`, `keep` or `skip` (§4.3).
- **Catch-up commits.** The commits an earlier attempt to repair the tree
  made after the fact: retroactive intake records, generated verification
  docs, OpenSpec change records for cycles that never ran. Named to `plan`
  by the owner (§4.3).
- **Retroactive doc, delegated sign-off, absorb.** As v0.10.0 §11.8, §10.2
  and §12.7 define them.

---

## 3. The Dropped Phase Status

### 3.1 The line

A phase record (v0.10.0 §7.1) may carry, directly after its
`- **Review tier:**` line:

```markdown
- **Status:** dropped (YYYY-MM-DD, reason)
```

The reason is one clause; the seal writes `not built before release {tag}`.
A phase without the line is active. The line is the phase-level counterpart
of a node's `- **Status:** retired` (v0.10.0 §11.6) and follows the same
discipline: the id stays resolvable, the file is kept, the row stays in the
ledger.

### 3.2 Semantics

A dropped phase is out of every campaign scope and every done count, and
never counts as remaining work:

- `hsdd-checkpoint` neither counts it done nor reports it as remaining or
  as a claim; the progress report lists dropped phases in one line.
- `hsdd-milestone` leaves it out of a campaign's scope; a gate that names
  it is satisfied for that phase, and the document's change log records
  the absorb (§4.7).
- `hsdd-intake`'s closure rule gains the all-dropped case (§3.4).
- `hsdd-phase-plan` append mode never rewrites or renumbers it and never
  takes it as a merge partner; numbering continues past it; a later change
  that needs the capability plans a new phase with a new id.
- `hsdd-config` is never run for it.

### 3.3 Who writes it

The seal (§4.5), or a person at the root. Never a phase session, and never
`hsdd-phase-plan`, whose append mode plans phases and does not dispose of
them. Dropping is a governance edit to a node spec; under the
standalone-spec-repo profile it is committed inside the submodule like any
other.

### 3.4 Intake record closure

v0.10.0 §11.5's rule stands and gains one case. A record closes when
`## Produced` names at least one phase and every listed phase is done,
as `**Status:** closed (YYYY-MM-DD)`. A record whose listed phases are
**all dropped** closes as `**Status:** closed (YYYY-MM-DD, dropped)` with
a change-log line; its request was not delivered, and the record says so.
A record with a mixture of done and dropped phases stays open until every
phase that is not dropped is done. `hsdd-checkpoint` and the seal's
`close` step apply the rule; `hsdd-intake` still closes nothing.

### 3.5 The convention paragraph

A project on skills older than 0.12.0, or one that wants the rule stated
where its own agents read it, may carry this paragraph under
`## Phase design` in `hsdd/conventions.md`; the seal appends it when it
drops a phase and the paragraph is absent:

> A phase record may carry `- **Status:** dropped (date, reason)`. A dropped
> phase is out of every campaign scope and every done count, keeps its id
> and its row in the plan ledger, and is never rewritten; a later change
> that needs the capability plans a new phase through hsdd-intake.

Under 0.12.0 skills the paragraph is informative: the rule is this chapter.

---

## 4. The Seal

### 4.1 When it applies

A seal applies to a released tree that went stale. It does not apply before
launch, where a fix belongs to the phase it fixes and backfill does not
exist yet (v0.10.0 §11.8), and it is not the way to close one phase, whose
verification doc a person writes. A seal is run once per release that left
the tree behind; a tree sealed and then kept current needs no second seal.

### 4.2 What sealed means

After a seal:

1. Every phase is **done** (a verification doc on the main line, signed by
   a person or by an agent for a named person) or **dropped** (§3), except
   phases the owner chose to **keep** (§4.3), which stay open and are
   listed.
2. Every intake record whose produced phases are all done is **closed**;
   one whose produced phases are all dropped is **closed (dropped)**.
3. The current campaign's milestone document is **sealed**, with
   `- **Sealed:** YYYY-MM-DD` in its header, and lives under
   `hsdd/management/archive/`, unless a kept phase or an unknown gate holds
   it open, in which case the report says which.
4. No contract, ADR, node header, shipped phase or pending governance
   section was changed. Reconcile is not part of a seal.
5. The seal plan's `## Result` names what only the owner can do.

Sealed does not mean verified. Every doc the seal signs says, in its
Observed section, that the phase was not individually observed and what
stood in for that.

### 4.3 The plan

`plan` reads the tree and writes the seal plan. Its inputs are the release
tag and date, the owner (the person every delegated sign-off names), the QA
evidence (a pointer, written verbatim into every retroactive doc), the
catch-up commits, and optionally phases to keep and the date.

**The catch-up value** is checked before anything is read: a `since:` value
must be a calendar date (git reads a malformed date as the beginning of
history), and every sha or range end must be a commit in each repository
the catch-up is read from. Under the standalone-spec-repo profile the
verification docs live in the submodule and OpenSpec records in the
implementation repository, so only `since:` reaches both; a sha from one
repository is refused with that explanation. A refused value writes
nothing.

**Default class per phase**, from evidence the script can read:

| Class | When |
|-------|------|
| `done` | the phase's verification doc exists and its Reviewer line names someone (non-empty, no template placeholder, not none) |
| `sign` | not done, and the newest progress report's "What is done" counts the phase, or its phase context exists under `hsdd-context/`, or an OpenSpec change directory names its id exactly, or a verification doc existed before the catch-up commits |
| `drop` | neither |
| `keep` | only when the owner names the phase |
| `skip` | the phase is already dropped, or its node is retired |

When in doubt the default is `drop`. A built phase wrongly dropped is
re-planned by a later intake and noticed by the developer; an unbuilt phase
wrongly signed makes the contracts and the node spec claim behavior the
code does not have, which misleads every later plan. The plan records the
evidence behind each default.

**The owner's edit surface** is the JSON's `class` field per phase, and the
`prune` list, which the owner may shorten. Nothing else in the file is
acted on: every path is re-derived from the phase id or re-checked against
a fresh scan when a step runs, a path that leaves the project root is
refused, and the plan's date must be a date. An existing plan file is never
overwritten without an explicit force, since it may carry the owner's
edits.

**Unparsed input** (a phase record without a readable tier, a verification
doc whose Sign-off the parser does not recognize, a gate that names no known
phase) is listed in the plan with file and line and gets no edit. The seal
never guesses.

The seal plan is a management document: it cites, it never defines. Its
slug is `seal-plan`, which the reading aids and the chain rules of v0.10.0
§12.2 never mistake for a dated report; like intake records it is outside
the supersedes chain.

### 4.4 Sign

For every phase of class `sign`:

- A missing doc, or one the catch-up commits added, is written whole from a
  fixed template: the bundled verification template's title line and
  section names; `## Commands to run` reads `none, retroactive`;
  `## Expected output` reads `see QA evidence`; `## Observed` reads
  `{today}: Not observed by this run. Released in {tag} on {date}. QA
  evidence: {evidence}. Retroactive (spec §11.8).`; `## Outstanding` holds
  one item, `individual verification not performed`; `## Learnings` reads
  `- none`; `## Sign-off` reads `Claude for {owner} (delegated), {today}`,
  the record's review tier (or `not stated in the phase record`),
  `Disposition of each Outstanding item: waived (released and
  QA-verified)`, `Disposition of each Learning: none`.
- Any other unsigned doc keeps its body: only its `## Sign-off` section is
  rewritten as above, and an empty `## Learnings` is filled with `- none`.
  When the doc already carries Learnings entries, the disposition line
  reads `dropped (sealed at release {tag}; not actioned)` and the report
  lists the phase for a person to read them. The seal never claims a
  disposition nobody made.
- A doc that is already signed is untouched.

The sign-off is a delegated sign-off under v0.10.0 §10.2: it counts as done,
and the next checkpoint lists it, with every other sign-off the seal made,
in one finding for the owner to ratify. Signing as the owner by name is
never admissible; the owner's name alone on a doc the owner did not sign is
a forgery.

### 4.5 Drop

For every phase of class `drop`: the Status line of §3.1 after the phase's
`- **Review tier:**` line (or at the end of its field block when the record
has no tier line), once; and the paragraph of §3.5 under `## Phase design`
in `hsdd/conventions.md` when it is absent. A verification doc the catch-up
added for a dropped phase is left in place and listed for the owner: the
seal deletes no verification doc (§9.2 defers the question).

### 4.6 Prune

An OpenSpec change directory (`openspec/changes/{name}` or
`openspec/changes/archive/{name}`) whose every file was first added by the
catch-up commits records a cycle that never ran. `prune` deletes each such
directory the plan lists and a fresh scan confirms. `openspec/specs/` is
never touched: it describes capability behavior that exists. Nothing
outside `openspec/changes/` is ever deleted by a seal.

### 4.7 Close

`close` re-scans the tree (so it sees what `sign` and `drop` wrote) and:

- For each open intake record: appends to `## Produced` any phase whose
  Scope cites the record and is missing there, then applies §3.4. A record
  closes with its Status line and a change-log line; a mixed record stays
  open.
- For the unsealed milestone document: ticks each gate whose phases are all
  done or dropped. A gate written as a range of one node's phases
  (`a.1–a.4`) names every phase of that node in the range. Dropped phases
  named by any gate are recorded in the change log as an absorb: the
  dates hold because the system is released. A gate that names no known
  phase, or a phase neither done nor dropped, stays open and keeps the
  document unsealed; the report names it. When every gate with known
  phases is ticked, `- **Sealed:** {today}` is added before the first
  section heading and the file moves to `hsdd/management/archive/`.

A seal written this way is evidence-backed in v0.10.0 §12.5's sense: each
tick the seal adds rests on a signed doc or a dropped line, and the first
checkpoint after the seal re-audits them. The seal never un-ticks a gate.

### 4.8 Report

`report` re-scans and appends a `## Result` section to the plan markdown:
phases done before the seal, signed by it, dropped, kept and skipped;
each intake record's status; the milestone document and its open gates;
pending governance sections and their `request` entries; the directories
pruned; and **Needs the owner**: `request` entries for `hsdd-reconcile`,
gates still open, records still open, kept phases, phases whose Learnings
were sealed unread, catch-up docs left on dropped phases, and unparsed
items. That list is the whole of what the owner acts on afterwards.

### 4.9 Writes and commits

Every step computes its file operations first and prints them; nothing is
written without an explicit write flag, and a second run of any step
changes nothing. With the commit flag a step commits only the paths it
touched, with the message `seal: {step}`; anything else the owner had
staged stays staged. Under the standalone-spec-repo profile the commit
lands inside the submodule and the pointer is bumped in the implementation
repository; a step refuses to write at all while the submodule's HEAD is
detached, since a commit there would sit on no branch (v0.10.0 §14.4
rule 1). The seal never pushes.

### 4.10 What the seal never does

- Write an observation, output, reviewer or date for a run that did not
  happen, or sign as a person.
- Edit a contract or ADR body, a node header, a shipped phase, a pending
  governance section, or any management document other than the intake
  records, the milestone document and the seal plan.
- Delete a verification doc, an intake record, a progress report, an
  execution plan or anything under `openspec/specs/`.
- Answer a `request` entry.
- Run a checkpoint, a reconcile or a milestone generation.

### 4.11 After the seal

Steady state resumes through `hsdd-intake`. The first checkpoint after a
seal is scoped to the seal's commits and takes the seal plan's `## Result`
as a named input, so its verification-doc audit reads one table instead of
every doc (a stated carry-forward, as v0.10.0 §12.7's scoped mode allows).
It supersedes the pre-seal execution plan, lists the seal's delegated
sign-offs in one finding, re-audits the hand-closed records and the sealed
document, and carries one standing decision: every finding whose remedy is
a verification, a ratification, a sync, a queued decision, a retro phase
for code that shipped in the release, or a step on a shipped or dropped
phase is waived in the plan with the reason `sealed at release {tag}`;
only contract and ADR findings remain as steps. A reconcile runs when the
first intake needs one; the seal leaves every pending section in place.

---

## 5. The Skill

### 5.1 Role and packaging

`hsdd-seal` is the thirteenth skill. Its `SKILL.md` tells the agent that
the seal is a script and how to run it, and the agent's only judgment is to
stop when a command exits non-zero. Its `scripts/` directory holds
`seal.mjs` and `lib/`, Node 20 or later, no dependency, and two files
copied from `hsdd-summary/scripts/`, `md.mjs` and `extract-plan.mjs`, kept
byte-identical by a test in this repository. The directory is copied
verbatim to `hsdd/scripts/seal/` under the bundled-script copy rule
(v0.11.0 §4.3); a retyped copy is not the code the tests cover.

### 5.2 Invocation

From the project root, the directory that holds `hsdd/` (under the profile,
an implementation repository):

```text
node hsdd/scripts/seal/seal.mjs plan --release R --date YYYY-MM-DD --owner NAME --evidence TEXT
                                      [--catchup REVSPEC|since:YYYY-MM-DD|SHA,SHA] [--keep id,id] [--today YYYY-MM-DD] [--force] [--commit]
node hsdd/scripts/seal/seal.mjs apply sign|drop|prune|close --plan hsdd/management/DATE-seal-plan.json [--write] [--commit]
node hsdd/scripts/seal/seal.mjs report --plan hsdd/management/DATE-seal-plan.json [--write] [--commit]
```

The slash command is `/hsdd-seal`. An owner may run the commands in a
terminal, which costs no model tokens, or hand the transcript to an agent
whose only job is to type it.

### 5.3 Files

| Path | Written by | Holds |
|------|-----------|-------|
| `hsdd/scripts/seal/` | the first run, by copy | the scripts |
| `hsdd/management/YYYY-MM-DD-seal-plan.json` | `plan`; the owner edits `class` | the plan, `kind: seal-plan`, `schemaVersion: 1` |
| `hsdd/management/YYYY-MM-DD-seal-plan.md` | `plan`, then `report` | the rendering and `## Result` |

---

## 6. Edits to Existing Skills

Each is a change to the skill's text only.

- **`hsdd-checkpoint`.** The done rule (step 3) states that a phase carrying
  `- **Status:** dropped` is out of every count and listed in one line. The
  intake pass (step 2) closes an all-dropped record as §3.4 says. The gate
  pass (step 6) treats a dropped phase as satisfied and the hand-sealed
  document in the archive as a closed campaign. Seal plan files are outside
  the chain rules. The first checkpoint after a seal behaves as §4.11.
- **`hsdd-milestone`.** A dropped phase is out of a campaign's scope; a gate
  satisfied by dropped phases carries the absorb in the change log.
- **`hsdd-phase-plan`.** Append mode never rewrites or renumbers a dropped
  phase and never merges with one.
- **`hsdd-intake`.** The record template's Status field admits
  `closed (YYYY-MM-DD, dropped)`, and the closure paragraph states the case.
- **`hsdd-spec`'s `conventions.md` template.** The layout gains
  `hsdd/scripts/seal/` and names `hsdd-seal` among the writers of
  `hsdd/management/` (the seal plan and its result).

---

## 7. Compatibility

### 7.1 Upgrading to v0.12.0 is additive

Upgrading means reinstalling the thirteen skills. No existing artifact is
rewritten. v0.10.0 §15.1's table gains these rows:

| Change | Effect on an existing ≥0.6.1 project | Implemented in v0.12.0 by |
|--------|--------------------------------------|---------------------------|
| `hsdd-seal` and `hsdd/scripts/seal/` (chapters 4, 5) | Opt-in. A project that never seals is unaffected. | `hsdd-seal` |
| The dropped phase status (chapter 3) | Recognized from the next checkpoint. A project that already carries §3.5's paragraph keeps it; it is now informative. | `hsdd-checkpoint`, `hsdd-milestone`, `hsdd-phase-plan`, `hsdd-intake` |
| `closed (date, dropped)` (§3.4) | A new value of an existing field; existing closed records are unchanged. | `hsdd-checkpoint`, `hsdd-seal` |
| The seal plan files (§4.3) | New management documents outside the chain rules. | `hsdd-seal`, `hsdd-checkpoint` |

A project sealed under 0.11.0 skills with the runbook procedure (the same
acts, done by prompt) is conformant: the artifacts are the ones this
document defines.

### 7.2 Artifact stability

The seal plan JSON (`kind: seal-plan`, `schemaVersion: 1`) and the Status
line join v0.10.0 §15.3's frozen set when v0.12.0 is released. Later
releases may add optional fields only.

### 7.3 Edits to v0.10.0's and v0.11.0's text

- v0.10.0 §1.5 and v0.11.0 §15.3: "Twelve skills" becomes "Thirteen
  skills"; the table gains this document's §5.1 row; the chain diagram gains
  the line `hsdd-seal (after release) -> closes the ledger of a stale tree by script`.
- v0.10.0 §7.1: the phase record gains the optional Status line of §3.1.
- v0.10.0 §11.5 and §12.7: the closure rule gains §3.4's case.
- v0.10.0 §12.3: dropped phases are out of the counts and listed in one
  line.
- v0.10.0 §12.5: a seal written by `hsdd-seal` under §4.7 is evidence-backed.
- v0.10.0 §14.1: the layout tree gains §5.3's paths.
- v0.10.0 §18.1: this document's §9.1 rows are appended.
- v0.10.0 chapter 19: this document's §7.4 terms are appended.

### 7.4 Glossary additions

Released tree, stale tree, dropped phase, seal, seal plan, class, catch-up
commits: each as chapter 2 defines them.

---

## 8. Evidence (informative)

### 8.1 FT-4

FT-4 is a released multi-node system built with HSDD v0.10 by a team with
its own QA function, planned and executed through the tree for most of its
life. In the weeks before release the pattern changed: QA found small
defects, developers fixed them where they stood, phases kept shipping
without their verification docs being signed, and the weekly full
checkpoint, though it produced the progress report and execution plan the
owner found useful, took longer to read than the sync it prepared. After
release, product requests kept arriving and were built outside the tree.
QA found no defect in the released system in manual or automated testing.

The owner then ran a full checkpoint and let the agent follow its plan: it
appended retroactive intake records, adjusted specs, contracts and ADRs,
generated verification docs, and generated OpenSpec change records for
phases nobody had run OpenSpec on. The result was more artifacts than the
owner could review, each describing work from the outside, and the owner
stopped. The question that produced this release was "is there a way to
say the tree is sealed, and move on?"

Three observations shaped the design:

| Observation | Rule |
|-------------|------|
| The repair that rebuilds history costs one retro phase per manual change and produces narrative nobody can check. | Catch up by state, not by history: sign what shipped by delegation with a fixed sentence, drop what was never built, and leave the evidence pass to the next checkpoint (§4.4, §4.5, §4.11). |
| The owner knew which phases shipped; the agent did not, and guessed in prose. | The one judgment is a field in a file the owner edits; the script applies it (§4.3). |
| Generated OpenSpec archives recorded cycles that never ran. | Prune what the catch-up invented, by provenance from git, never by name (§4.6). |

### 8.2 The implementation and its review

The skill was built test first against a synthetic two-commit git fixture
(a release commit and a catch-up commit) and a standalone-spec-repo fixture
with a real submodule. A fresh reviewer then read the whole branch and
drove the modules against scratch trees in 22 scenarios. It found one
critical and ten important defects, every one of which let the seal write
something false or delete something real, and each became a rule above:

| Finding | Rule |
|---------|------|
| A catch-up value git rejected was swallowed and the plan lied about provenance; a malformed `since:` date matched all history and pruned a real archive. | The catch-up value is validated before anything is read (§4.3). |
| Paths in the plan JSON were trusted; an edited `prune` entry could delete outside the tree. | Only `class` and the `prune` list are acted on; every path is re-derived or re-checked and confined to the root (§4.3). |
| `--commit` swept unrelated staged files into the seal commit. | Commit only the touched paths (§4.9). |
| A detached submodule received the seal commit on no branch. | Refuse to write while the submodule is detached (§4.9). |
| An OpenSpec directory named `acme-web-30` counted as evidence for `acme.web.3`. | Exact id matching, the same boundary rule for dashed and dotted forms (§4.3). |
| A numbered heading (`## 7. Sign-off`) produced a second Sign-off section. | One section finder shared by the scan and the sign step (§4.4). |
| A doc with real Learnings was signed with `Disposition of each Learning: none`. | `dropped (sealed; not actioned)` and a report line (§4.4). |
| A gate written as a range ticked on its endpoints. | Ranges expand to every phase of the node (§4.7). |
| A catch-up doc on a dropped phase was left unreported. | Listed for the owner (§4.5, §4.8). |
| A second `plan` run overwrote the owner's edits. | Never overwritten without force (§4.3). |
| A project root below the git root attributed nothing to the catch-up. | Paths are read relative to the project root (§4.3). |

The seal has not yet run on FT-4 itself; §9.1 marks its provenance
accordingly.

---

## 9. Decisions

### 9.1 Settled

Provenance as v0.10.0 chapter 18 defines it. `pressure-tested` here means
exercised by the fixture tests and the independent review of §8.2.

| Question | Decision | Provenance |
|----------|----------|------------|
| How a stale released tree is recovered | By state, not by history: a seal (chapter 4), never one retro phase per change. | reasoned-only (FT-4 is the evidence against the alternative) |
| A phase planned and never built | `- **Status:** dropped (date, reason)` on its record, out of every scope and count, row kept (chapter 3). | reasoned-only |
| Who classifies | The owner, by editing one field; the script proposes a default from evidence it can read, and the default is drop when in doubt (§4.3). | reasoned-only |
| Who runs the seal | A script, with no model reading the tree (chapter 5). | pressure-tested |
| What a seal sign-off says | A delegated sign-off and a fixed Observed sentence naming the release and the QA evidence; never the owner's name, never an invented observation (§4.4). | pressure-tested |
| Learnings on a doc the seal signs | Sealed as `dropped (sealed; not actioned)` and listed for a person (§4.4). | pressure-tested |
| An all-dropped intake record | Closes as `closed (date, dropped)` (§3.4). | reasoned-only |
| Catch-up OpenSpec records | Pruned by git provenance; `openspec/specs/` untouched (§4.6). | pressure-tested |
| A checkpoint at the seal | None; the first steady-state checkpoint, scoped, finishes it (§4.11). | reasoned-only |
| The seal plan's edit surface | `class` and the `prune` list; every path re-derived; no overwrite without force (§4.3). | pressure-tested |
| Commits | Touched paths only; refuse a detached submodule; never push (§4.9). | pressure-tested |
| Range gates | Expanded to the node's phases in the range (§4.7). | pressure-tested |

### 9.2 Deferred

| Deferred | Why |
|----------|-----|
| A re-baseline mode of `hsdd-adopt` that writes `## Observed surface` onto governed nodes and diffs contracts against the code, so a stale tree's contracts catch up by seam count | The seal spends the owner's attention on contracts and ADRs through the report; whether a mechanical surface re-baseline is worth a mode depends on how often contracts drifted in FT-4's class of project, which the first sealed project will show. |
| A verification doc field for external evidence (a QA run, a release checklist) that the gate admits in place of the agent's own run | FT-4's first defect. It changes v0.10.0 §10.2 for every phase, not only sealed ones, and deserves its own field trial. |
| A maintenance checkpoint that emits one page instead of four views | FT-4's third defect; v0.10.0 §12.7's scoped mode still supersedes the whole plan. Design it with the judgment layer the v0.11 deferred list names. |
| A `manual` intake class and the commit-trailer lane the user's guide describes | Conventions a project may adopt today; promoted to rules once a project has run them for a release. |
| Deleting a catch-up verification doc on a dropped phase | The same provenance logic as prune applies, but "never delete a verification doc" is a rule worth keeping until a seal has shown the case is common. The report lists them. |
| A seal under `hsdd-auto` | The seal has no ask point a model should answer; the owner's edit is the whole judgment. An orchestrator could run the transcript, which needs no step kind. |
| Dropped phases on the reading aids | The plan page renders every phase section; marking dropped ones is a change to the summary engine's scripts, a proven path, and waits for a release that touches them. |

### 9.3 Rejected

- **A full checkpoint as the sealing step.** The evidence pass was paid for
  before the seal and nothing in the code changes; FT-4's owner had already
  found its output more than a person reads.
- **A model-run seal.** Every act in a seal has one right answer except
  which phases shipped, and that one the owner knows and the model guesses.
- **Signing with the owner's name.** A sign-off names who answers for it;
  delegation is admissible and comes back to the owner at the next
  checkpoint; the owner's bare name on a doc the owner did not sign is a
  forgery.
- **A `cancelled` status on intake records instead of the dropped closure.**
  The record's request may still be delivered by a later phase; the closed
  variant keeps the record's history and says what happened to the phases
  it produced.

---

## 10. Acceptance

### 10.1 Script tests

Under `test/`, with Node's built-in test runner and the fixtures of
`test/helpers/seal-fixture.mjs` (a two-commit tree, a nested project root,
and a standalone-spec-repo tree with a real submodule). At least:

- scanning: signed, delegated, placeholder and missing docs; CRLF docs;
  boundary-safe id matching in gates, Produced sections and OpenSpec
  directory names; range gates; the catch-up set from git under the plain
  layout, the nested layout and the profile; a rejected catch-up value
  throws; the dropped set from phase records.
- planning: the default class per the table of §4.3 on the fixture, `keep`,
  the prune list, the rendering's edit instruction and tables.
- applying: dry run writes nothing; identical content is skipped; a second
  run of each step is empty; the retroactive doc's fixed text; a real doc
  keeps its body; numbered headings are replaced, not duplicated; real
  Learnings get the dropped disposition; the Status line after the tier
  line, once; the conventions paragraph once; prune accepts only a known
  change directory whose files the catch-up added; a path outside the root
  is refused; records close, close as dropped, or stay open as §3.4 says;
  gates tick, ranges expand, the absorb line is written, the document seals
  and moves.
- the CLI: plan, edit, apply all, report end to end; a rejected catch-up
  value exits 1 and writes nothing; `plan` refuses to overwrite without
  force; `--commit` leaves unrelated staged changes alone; the profile
  fixture refuses a detached submodule before writing and commits inside it
  with the pointer bump afterwards.
- `md.mjs` and `extract-plan.mjs` are byte-identical to `hsdd-summary`'s.

### 10.2 Documentation

`SKILL.md` under 200 lines with triggers and do-not-use cases; the user's
guide's "Sealing a released tree" section describes the script; the README
table and install line count thirteen skills; the changelog entry names the
upgrade effects of §7.1.
