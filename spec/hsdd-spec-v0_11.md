# HSDD: Hierarchical Spec-Driven Development (v0.11 delta: unattended runs)

> Delta specification. It adds `hsdd-auto`, a twelfth skill that runs HSDD's
> planning chain unattended: from an empty tree to reconciled phase plans, or
> from an incoming change request through every handoff its intake record
> names. Every decision a human would have taken is recorded in a ledger for
> one review sitting afterwards. Read it against v0.10.0; only the changes are
> stated here. Everything in v0.10.0 not touched below still stands.

**Version:** 0.11.0 (draft)
**Status:** For review
**Date:** 2026-10-22
**Owner:** Purbo Mohamad
**Drafted from:** FT-3, the first unattended planning run on a live project
(two segments, 96 steps, 90 subagent dispatches, 1071 recorded decisions),
summarized in chapter 14. This document and v0.10.0 are the whole input for
implementing the release; nothing from the FT-3 repository is needed.
**Supersedes (in part):** v0.10.0 §1.5's skill count and table (one row
added), §14.1's layout tree (three directories added), §15.1's compatibility
table (rows added), §16.3's non-goals (two rows amended), chapter 18 (rows
added) and chapter 19 (terms added). Under an unattended run only (§12.1),
rules that require a human's answer give way to a recorded decision. Under
the `decide-and-record` policy the orchestrator answers, as the owner's
stand-in, the questions v0.10.0 reserves for the human: who builds what
(v0.10.0 §2.5), promotion confirmation (v0.10.0 §6.4), collision
arbitration (v0.10.0 §8.4), and breaking amendments (v0.10.0 §8.2 for
`hsdd-reconcile`; for `hsdd-contract` the stop is one this document's §12.1
introduces, since the skill applies the versioning rule itself).
Under either policy four more rules give way: `hsdd-adr`'s "never write
invented content as `accepted`" (v0.10.0 §4.3), `hsdd-contract`'s "a
breaking change creates `v{n+1}`" for a `draft` contract (v0.10.0 §3.5),
`hsdd-reconcile`'s "resolve `request` entries with the human" for requests
that break no consumer (v0.10.0 §8.4), and `hsdd-spec`'s "ownership stated
by the human" when the owner left the axis to the run (v0.10.0 §2.5). Every such answer is a ledger line with `would_have_asked: true`,
listed first in the segment's report. All other v0.10.0 provisions are
unchanged.

---

## 1. What 0.11 Changes and Why

### 1.1 The problem

HSDD planning is paced by its ask points. `hsdd-spec` stops on "who builds
what?", `hsdd-phase-plan` stops on a structural contract gap, `hsdd-reconcile`
stops on a collision or a breaking amendment, and a dozen softer questions
(accept this ADR, answer this `request`) wait for a human between steps. For
a tree of nine nodes that is a few hundred questions spread over days, and
most of them have an answer the sources already imply.

An owner who wants the whole tree planned, or one change routed through every
node it touches, can instead hand the run to an agent and review the
decisions afterwards in one sitting. FT-3 did exactly that, twice, with an
orchestrating Claude Code session driving one subagent per skill invocation.
It worked: no step failed, every decision was recorded with its options and
evidence, and the owner could audit the run step by step. It also showed what
a hand-built orchestration costs and where it breaks (chapter 14): the
protocol lived in a pasted prompt, the orchestrator wrote over a quarter of
all output tokens restating context, timestamps were typed by hand and some
were wrong, prompts carried facts from the orchestrator's memory, and the
scripts that made it work lived in a session scratchpad that was later
emptied.

### 1.2 What this release adds

- **`hsdd-auto`**, a twelfth skill (chapter 3). It owns the run: it computes
  the next step, renders the step's prompt from templates, dispatches one
  fresh subagent per step, answers stops as the owner's stand-in or ends the
  run, gates and commits each step, and keeps the records. Its scripts ship
  bundled and are copied verbatim into the project, like `gen-registry.mjs`
  and the seam extractor.
- **Run records** (chapter 6): a decision ledger, a run log, the rendered
  prompt of every dispatch, a routing queue, step reports, and a report per
  segment. They are the input of a later judgement layer (§16.2).
- **Two modes** (chapter 9): `plan`, which plans an empty tree through
  reconcile, and `intake`, which routes one change request into a planned
  tree through `hsdd-intake` and every handoff its record names.
- **A stop policy** (chapter 8): the owner chooses per segment whether a stop
  condition ends the run with `STOP.md` or is decided and recorded with
  `would_have_asked: true`. Answers can be decided in advance per stop class.
- **An unattended-mode contract for six planning skills** (§12.1): each skill
  lists its ask points as a table and, when invoked by `hsdd-auto`, returns a
  structured stop at an ask point instead of a question, and records each
  decision at the moment it takes it.
- **Three additive changes to existing skills** (§12.2 to §12.4): an optional
  machine-readable handoff block in the intake record, a named align mode for
  `hsdd-reconcile`, and a rule for moving citations when a source document or
  contract version changes.
- **A Claude Code adapter** (chapter 11): permission deny rules and a Bash
  hook that keep a run inside its declared inputs, installed into the project
  by `hsdd-auto`.

### 1.3 What it does not change

- **The core invariant (v0.10.0 §1.3).** `hsdd-auto` plans; it never
  implements a phase, never runs `hsdd-config`, and never passes a review
  gate.
- **Human review.** Unattended planning moves the human's review from each
  ask point to one sitting over the ledger; it does not remove it. Every
  answer the run gave on the owner's behalf is listed first in the segment's
  report.
- **Artifact formats (v0.10.0 §15.3).** Every change to an existing artifact
  is an optional addition whose absence keeps the artifact conformant. The
  formats this document introduces join the frozen set when v0.11.0 is
  released (§15.2).
- **The scripts boundary (v0.10.0 §16.3, §18.1).** Scripts ship bundled with
  the new skill and change no existing skill's behavior. The existing skills
  change only through their own text (chapter 12), and only when invoked by
  `hsdd-auto`.
- **No scheduler, no CLI, no judge.** Nothing starts a run on a timer; the
  one timed wait inside a run is §8.8's fallback wake-up. There is no `hsdd`
  command line. A judge that scores artifacts and gates steps is deferred
  (§16.2); this release records what it will need.

### 1.4 Versions

v0.11.0 follows v0.10.0 as a minor release. The v1.0 release criterion
(v0.10.0 chapter 17, the published case study) is unchanged.

### 1.5 How to read this document

Chapters 2 to 13 and the appendices are normative. Chapter 14 is the
evidence the design rests on and is informative. Chapter 15 states
compatibility, chapter 16 the decisions and what is deferred, chapter 17 the
acceptance criteria. **Must** and **never** are requirements; **should** is
a default a project may override in its run configuration. A section number
without a version prefix refers to this document; v0.10.0's sections are
written "v0.10.0 §n", and a list that follows that prefix stays in v0.10.0
("v0.10.0 §16.3, §18.1").

---

## 2. Vocabulary

These terms are used with exactly these meanings throughout. v0.10.0's
chapter 19 gains them (§15.4).

- **Run:** one unattended effort on one branch of one repository, configured
  by one run configuration (`hsdd/auto/run.yaml`). A run has one or more
  segments and lasts until the owner merges or abandons its branch.
- **Segment:** a stretch of unattended work opened by one owner instruction:
  the first `/hsdd-auto`, a later `/hsdd-auto intake <source>`, or the answer
  to a `STOP.md`. Each segment has one mode, one stop policy, one preamble
  version and one report, or a share of the next segment's when it ended
early (§10.9). Steps are numbered across the whole run, not per
  segment.
- **Step:** one unit of work with an id (`S00`, `S01`, ... `S100`), a kind,
  a target, a write set, and two commits. A subagent step is exactly one HSDD
  skill invocation on one target by one fresh subagent. An orchestrator step
  (`setup`, `plan`, `report`) is done by the orchestrator itself and runs no
  HSDD skill.
- **Step kind:** the type of a step, which fixes its skill, its template, its
  write set and the decision type of the decisions taken in it (§7.1).
- **Launch:** one start of a step subagent: the initial dispatch, a
  re-dispatch after an interruption, or a resume (§8.6).
- **Continuation:** a new step of the same kind and target as a step that
  ended `stopped`, dispatched once the stop is resolved (§8.3).
- **Owner:** the human who configured the run and reviews it. The only source
  of instructions. Facts the owner states are owner facts.
- **Orchestrator:** the agent session that runs `hsdd-auto`. It sequences
  steps, launches subagents, answers stops as the owner's stand-in, reviews
  each step, runs the scripts that gate, commit and record, and writes the
  change log and the report's prose. It never runs an HSDD planning skill in
  its own context.
- **Step subagent:** a fresh agent with no context except its dispatch file.
  It invokes one HSDD skill, writes that skill's artifacts, its experiments
  and its step report, and records its decisions. It never commits and never
  answers a stop.
- **Decision:** a choice between at least two options that a human could have
  made, recorded with its options and consequences, the chosen option, the
  reason, the evidence, the blast radius and the confidence (§6.2).
- **Decision ledger:** `hsdd/judgement/decisions.jsonl`, one decision per
  line, append-only, each line pinned to the commit holding the artifact it
  landed in.
- **Run log:** `hsdd/judgement/run.jsonl`, one line per step.
- **Stop:** a point where the run cannot proceed without an owner's answer.
  A **skill stop** is one a skill's ask-point table marks `return` (§12.1). A
  **run-stop candidate** is a stop-set condition a subagent meets outside a
  skill stop. Every stop has a **stop class** (§8.2).
- **Stop set:** the stop classes that end the run under the `stop` policy.
- **Stop policy:** per segment, `stop` (a stop in the stop set writes
  `STOP.md` and ends the run) or `decide-and-record` (the orchestrator
  answers it and records it with `would_have_asked: true`).
- **Predecided answer:** an answer fixed before any step met the stop, keyed
  by stop class, injected into every prompt (§8.4).
- **would_have_asked:** a decision field: true when a skill stopped for a
  human, or a careful engineer would have put the question to the owner
  first.
- **would_upstream:** a decision field: true when the right resolution is a
  change to a read-only source; the decision is resolved locally and listed
  for upstreaming.
- **Blast radius:** what a decision can change. `node-local`: one node's
  internals. `contract`: a contract's interface or guarantees, so every
  consumer. `tree`: which nodes or contracts exist. `upstream`: a read-only
  source would change.
- **Routed item:** a follow-up one step raises for a later step, kept in the
  routing queue `hsdd/auto/queue.jsonl` (§6.5).
- **Write set:** the paths a step may change (§7.3).
- **Judgement set:** the run's record files a step's judgement commit holds
  (§6.11).
- **Gate:** `gate.mjs`, the mechanical check of a step before its artifact
  commit (§10.6).
- **Experiment:** a throwaway program a subagent writes and runs to settle a
  runtime fact a decision depends on, kept with its captured output and cited
  as evidence (§7.5).
- **Owner files:** paths the owner names that no step may change, guarded by
  hash (§6.10).
- **Out-of-bounds paths:** paths no agent in the run may read (§5.1,
  chapter 11).
- **Sources:** the documents the project implements. **Normative** sources
  bind; **informative** sources guide; **baseline** sources are an earlier
  version, read only to see what changed.
- **Segment report:** the document the owner reads first, written at the end
  of each segment (§10.9).

---

## 3. The Skill

### 3.1 Role

`hsdd-auto` is a role skill like the other eleven: one artifact class (the
run and its records), one skill. Its row in v0.10.0 §1.5's table:

| Skill | Role | Key outputs |
|-------|------|-------------|
| `hsdd-auto` | Run HSDD's planning chain unattended: compute the next step, dispatch one fresh subagent per skill invocation, answer or stop on each ask point per the owner's stop policy, gate and commit each step, and record every decision for one review sitting. | `hsdd/auto/`, `hsdd/judgement/`, a report per segment |

It drives six of the existing skills: `hsdd-spec`, `hsdd-adr`,
`hsdd-contract`, `hsdd-phase-plan`, `hsdd-reconcile` and `hsdd-intake`. It
never drives `hsdd-adopt` (adoption's human confirmation is the owner's,
v0.10.0 §6.4, §6.5), `hsdd-config` (execution), `hsdd-checkpoint`,
`hsdd-milestone` or `hsdd-summary`.

### 3.2 Packaging

The skill is a `SKILL.md` that the orchestrating session follows, plus
zero-dependency Node.js scripts that do every part of the work that has one
right answer: which step is next, what its prompt says, what it may write,
whether it passed, the commits, the records, the timestamps. The model is
used only where judgement is needed (§3.4). A Claude Code adapter (chapter
11) adds enforcement at the edges; the skill and its scripts work without it
on any agent host that can launch a subagent with a prompt and read its
result.

A Claude Code plugin as the package was rejected (§16.3): tool-level
enforcement, but one host only. An external runner on an agent SDK is
deferred (§16.2): deterministic sequencing, but every judgement point then
needs its own model call, which is building the judge first.

### 3.3 Invocation

```text
/hsdd-auto                          start a run, or resume the current segment
/hsdd-auto intake <source> [flags]  open an intake segment for one change request
/hsdd-auto status                   where the run is: segment, last step, next step, open queue, stop
```

Flags: `--stop-policy stop|decide-and-record` overrides the opening
segment's policy; for an intake, `--authority
accepted-rfc|draft|ticket|incident|braindump` gives the request's authority
(default `draft`). Prompts render these in `hsdd-intake`'s words:
`accepted-rfc` as "accepted RFC", the others unchanged.

The slash command is a one-line delegator, `commands/hsdd-auto.md`, like
every other skill's (v0.10.0 §14.3).

The **only interactive moment** is the first `/hsdd-auto` in a project with
no `hsdd/auto/run.yaml`: the skill asks the questions of §5.3 once, writes
the file, shows it, and starts. Every later invocation reads the file and
asks nothing. An owner's words in the invoking message that bear on the run
("do not ask me anything", "treat v2 as normative") are read by the
orchestrator and recorded as `setup` decisions of the segment they open
(§8.1); they are never applied silently.

### 3.4 Who does what

| Work | Done by |
|------|---------|
| Which step runs next, its kind, target, inputs and write set | `next.mjs` |
| Rendering the prompt, with facts read from the repository, routed items and predecided answers | `dispatch.mjs` |
| Minting a decision's id and stamping its time at the moment it is taken | `decide.mjs` |
| The gate, both commits, ledger lines, run lines, the plan's step log | `gate.mjs`, `commit.mjs`, `ledger.mjs` |
| The routing queue | `routed.mjs` |
| The report's tables and lists | `report.mjs` |
| Answering a skill stop or a run-stop candidate as the owner's stand-in | orchestrator |
| Deciding a stop class in advance | orchestrator, as a `setup` or `plan` decision |
| Accepting or rejecting an `insert-step` item | orchestrator, as a `plan` decision |
| Reviewing a step's report and artifacts beyond the gate (§8.5) | orchestrator |
| The plan's change log, the report's prose slots | orchestrator |
| The skill's own work | step subagent |

### 3.5 Where it runs

From the repository that holds the tree at `hsdd/` (v0.10.0 §9.5), on a
branch the run creates from a base branch and commits to under v0.10.0 §9.4's
branch discipline. Steps run
serially (§16.2 defers parallel dispatch). The standalone-spec-repo profile
(v0.10.0 §14.4), where `hsdd/` is a submodule, is not supported in v0.11:
`/hsdd-auto` refuses to start when `hsdd/conventions.md` declares it, and
says so (§16.2).

---

## 4. Files and Layout

### 4.1 The skill's files

```text
skills/hsdd-auto/
  SKILL.md                      the loop, the judgement points, stop handling (§4.4)
  scripts/                      copied verbatim to the project's hsdd/scripts/auto/
    VERSION                     one line: the release, e.g. 0.11.0
    lib/                        shared modules: yaml.mjs (the subset of §5.2), paths.mjs (§4.2),
                                schema.mjs (hand validation, §6.1), git.mjs, time.mjs
    state.mjs                   the run's state; `done`; the status view (§10.1)
    next.mjs                    the next step (§10.2)
    dispatch.mjs                renders a prompt to hsdd/auto/dispatch/<step>.md (§10.3)
    decide.mjs                  mints, stamps and appends one decision (§10.4)
    ledger.mjs                  appends to and validates the ledger and run log (§10.5)
    gate.mjs                    the step gate and the final gate (§10.6)
    commit.mjs                  the two commits per step, and handoff skips (§10.7)
    routed.mjs                  the routing queue (§10.8)
    report.mjs                  the segment report's generated parts (§10.9)
    adapter.mjs                 installs and checks the Claude Code adapter (chapter 11)
    hook-bash.mjs               the adapter's Bash PreToolUse hook (§11.1)
    hook-subagent-stop.mjs      the adapter's optional SubagentStop hook (§11.1)
    schema/                     the JSON Schemas of appendix A
    templates/
      preamble.md               the step preamble with slots (appendix B)
      steps/{kind}.md           one step-section template per subagent step kind (appendix C)
      report/{mode}.md          the report skeleton per mode (§10.9)
commands/hsdd-auto.md           the slash-command delegator
```

All scripts are ES modules, need Node.js 20 or later, and use only Node's
standard library. Exit codes: 0 success, 1 a failed check, 2 a usage error;
the two hooks instead follow the host's hook protocol (§11.1), where exit 2
blocks the call. Output: `next.mjs` and `state.mjs --json` print one JSON
document and nothing else; `dispatch.mjs` prints what §10.3 says; every other
script prints its findings, then a one-line summary last.

### 4.2 The project's files

```text
hsdd/
  auto/
    run.yaml                    the run configuration (chapter 5)
    plan.md                     the run's plan: segments, generated step log, change log (§6.9)
    queue.jsonl                 the routing queue (§6.5)
    handoffs.jsonl              intake handoffs skipped by their condition (§6.12)
    owner-files.json            hashes of the owner files (§6.10)
    adapter.json                the settings entries the adapter added (§11.1)
    dispatch/{step}.md          every step's dispatch file: front matter plus the prompt (§6.6)
    steps/{step}.json           the subagent's step report (§6.4); {step}.r{n}.json per resume;
                                {step}.lost{k}[.r{n}].json per redispatch (§8.6)
    steps/{step}.decisions.jsonl  the step's decisions, written only by decide.mjs (§6.4)
    experiments/{name}/         experiments (§7.5); the path is configurable
    report/{segment}.md         one report per segment (§10.9); the path is configurable
  judgement/
    decisions.jsonl             the decision ledger (§6.2)
    run.jsonl                   the run log (§6.3)
    decision-reviews.jsonl      the owner's reviews (§6.8); written by the owner only
    STOP.md                     present only while a run is stopped (§6.7)
  scripts/
    auto/                       verbatim copy of skills/hsdd-auto/scripts/
.claude/                        the adapter's files, when installed (chapter 11)
```

v0.10.0 §14.1's layout tree gains `auto/`, `judgement/` and `scripts/auto/`
under `hsdd/`. The tree's root is always `hsdd/`. The directories inside it
that v0.10.0 lets `hsdd/conventions.md` relocate (`spec/`, `contract/`,
`adr/`, `management/`, `verify/`) are resolved by `lib/paths.mjs` from the
conventions file's layout section, defaulting to v0.10.0 §14.1. The parse
rule: under the first heading that starts with `## Layout`, take the first
backticked path of each bullet; the directory of the path ending in
`{node-id}.md` is `spec/`, of the first path ending in `{slug}.md` is
`contract/`, of the path ending in `{nnn}-{title}.md` is `adr/`, of the path
ending in `{phase-id}.verification.md` is `verify/`, and the path ending in
`management/` is `management/`; a directory with no matching bullet keeps its
default. `scripts/` is not relocated: the skills and the registry generator
name `hsdd/scripts/` directly, and the generator reads `hsdd/contract/` and
`hsdd/adr/` at their default paths, so C1 (§10.6) runs only when both are at
their defaults and is otherwise skipped with a warning. Everywhere
this document writes `H/spec/`, `H/contract/` and so on, it means the
resolved path, and `H/` alone means `hsdd/`. `hsdd/auto/` and
`hsdd/judgement/` are written only by `hsdd-auto`'s scripts, the
orchestrator and, for reviews, the owner.

### 4.3 Bundled-script copy rule

The skill's `scripts/` directory is copied verbatim to `hsdd/scripts/auto/`,
the same rule as `hsdd/scripts/summary/` and `hsdd/scripts/seams/`. The copy
is current when its `VERSION` equals the installed skill's and every file is
byte-identical; anything else is a gate error (§10.6, A3), fixed by
recopying in a `setup` step or, mid-segment, in a `plan` step by a recorded
decision (§7.3), never by editing. Until the
first `setup` step has made the copy, the orchestrator runs the scripts from
the installed skill's `scripts/` directory.

### 4.4 What `SKILL.md` contains

The skill text follows the house shape of the other skills: front matter
with a description, triggers and "Do NOT use for" lines, then:

1. **Preconditions:** run from the repository holding `hsdd/`; not the
   standalone-spec-repo profile; a clean working tree apart from the declared
   owner files; the six planning skills installed with their
   `## Unattended runs` sections (§12.1); Node.js 20 or later on the path.
2. **First run:** the questions of §5.3, `run.yaml`, the bundled-script copy,
   the adapter (chapter 11), the branch, the `setup` and `plan` steps.
3. **The loop** of chapter 8, as numbered steps naming the script to run at
   each point.
4. **Judgement points:** answering a stop (§8.3), deciding in advance (§8.4),
   accepting an inserted step (§8.7), reviewing a step (§8.5), reading an
   owner instruction (§8.1, §8.11). Each says what to record.
5. **Context recovery** (§8.9).
6. **Finishing a segment** (§8.10).
7. **Quality gates**, as checkboxes: two commits per step; every decision
   minted and stamped by `decide.mjs`; no prompt fact that was not read from a
   file by `dispatch.mjs` or cited to one; no step id reused or renumbered; no
   `STOP.md` under `decide-and-record` except for §8.2's hard stops.
8. **Anti-rationalization table**, at least: "I remember what that step
   decided, I'll restate it in the prompt" (facts come from files); "the
   timestamp doesn't matter, I'll write one" (only scripts stamp); "this stop
   is obviously answered, I'll let the subagent take it" (a stop is the
   orchestrator's, recorded); "the gate is wrong this once, I'll commit
   anyway" (fix the step or the configuration by a recorded decision, never
   bypass); "I'll check on the subagent in a few minutes" (wait for the
   hand-back).

---

## 5. The Run Configuration

### 5.1 Fields

`hsdd/auto/run.yaml` holds everything about a run that is the owner's to
say. The orchestrator edits it only in a `setup` step, by a recorded
decision, except that a `plan` step may add a `predecided` entry (§8.4). Its
JSON Schema is appendix A.1.

| Field | Required | Meaning |
|-------|----------|---------|
| `version` | yes | Format version of this file: `1`. |
| `run` | yes | The run's name, kebab case. |
| `root` | no | The root node's id, the target of the `root-spec` step (§7.1). Default: the run's name. |
| `branch`, `base` | yes | The run branch, created from `base` by `state.mjs open-segment` when the first segment opens (§8.1), before any step is dispatched. Every commit of the run lands on `branch`. The run never squashes, amends, rebases or force-pushes. |
| `skills_dir` | yes | Where the installed HSDD skills are: a project path such as `.agents/skills`, or a home path such as `~/.claude/skills`. The verbatim-copy checks read from it. |
| `models` | no | `orchestrator` (informational) and `step` (given to the step agent type, §11.1, when the host supports a per-subagent model). Recorded on run lines. |
| `owner_facts` | yes | Facts the owner states, one string each. Steps use them as given and never re-decide them. |
| `preferences` | no | The owner's standing engineering preferences, one string each, passed to every step. |
| `prose_rules` | no | `banned_chars` and `banned_phrases` (lists), `token_forms` (§7.6: `empty_cell`, `id_separator`, `reason_separator`, `source_separator`), and `level`: `warn` (default) or `error`, how the gate treats a violation. |
| `sources` | yes | `normative`, `informative`, `baseline`: lists of `{path, cite, version, authority}`. `cite` is the short name prompts and artifacts use when citing it (`Spec`, `Guide`). `version` is the version string the document goes by (`v0.15.1`); it is required for every source of a segment that moves a version (§9.3), because §12.2's `cites-superseded` condition matches on it. `authority` is what the root spec's `## Sources` records for the document (`accepted-rfc`, `draft`, `ticket`, `incident` or `braindump`); when absent, the `root-spec` step decides it and records the decision. |
| `read_only` | yes | Paths no step may write. Always includes every source path. |
| `out_of_bounds` | no | Paths no agent in the run may read, as the owner writes them (absolute, `~/`, or project-relative). |
| `owner_files` | no | Paths no step may change, hashed at the start of each segment (§6.10). |
| `orchestrator_files` | no | Paths outside `hsdd/` that a `setup` step may write, such as the project's agent instruction file that names the normative source. |
| `toolchain` | no | `commands`: a map from a tool name to the exact command prefix steps must use (`dart: fvm dart`); `rules`: one string each ("never a bare `dart`"). |
| `experiments_dir` | no | Default `hsdd/auto/experiments`. |
| `report_dir` | no | Default `hsdd/auto/report`. |
| `stop_set` | no | Stop classes that end the run under the `stop` policy, from `axis`, `shape`, `promotion`, `breaking-amend`, `collision`, `external`, `gate-twice`. Default all seven. |
| `stop_policy` | no | Default policy for new segments: `stop` (default) or `decide-and-record`. |
| `predecided` | no | A map from a stop-set class to `{answer, decision}`: the answer text injected into every prompt and the id of the `setup` or `plan` decision that fixed it (§8.4). |
| `commit` | no | `trailers` (lines appended to every commit message), and the subject prefixes `artifact` (default `hsdd`), `judgement` (default `judgement`) and `orchestrator` (default `auto`). |
| `rework_limit` | no | Resumes allowed per step for a failed gate or review before the step counts as `gate-twice`. Default `1`. |
| `dispatch` | no | `wait`: `hand-back` (default: the host notifies the session when the subagent ends) or `foreground` (the launch call returns with the result); `fallback_wakeup_minutes`: default `30`, never below `20` (§8.8). |
| `segments` | yes | Appended by the skill, one entry per segment (§5.5). An entry is never edited after its segment's `setup` commit. |

### 5.2 The YAML subset

`run.yaml` is written by people, so it is YAML, and the scripts parse it
without a dependency, so it is a subset. `lib/yaml.mjs` accepts exactly:
block mappings; block sequences; flow sequences whose items are scalars or
flow mappings (`[a, b]`, `[{path: x, cite: Spec}]`); flow mappings of
scalars (`{path: x, cite: Spec}`); plain, single-quoted and double-quoted
scalars on one line; integers; `true`, `false`, `null`; and `#` comments.
Double-quoted scalars accept the escapes `\"`, `\\`, `\n`, `\t` and
`\uXXXX`. Indentation is spaces only. Anything else (anchors, aliases, tags,
multi-line scalars, multiple documents, tabs) is a parse error that names the
line. Writers quote any string containing `: `, `#`, a leading special
character, or a value that would otherwise read as a number or boolean.
`lib/yaml.mjs` also writes the subset, so `state.mjs open-segment` can
append a segment entry without disturbing the owner's comments: it appends
the entry's line under `segments:` and rewrites nothing else. A first-run
file writes `segments:` with no value, which the loader reads as an empty
list (as it reads `[]`), and the appender replaces that line with the block
sequence.

### 5.3 The first-run questions

When `run.yaml` is missing, `/hsdd-auto` asks these, in one batch, proposing
a default for each from what it can read (the root spec's `## Sources`,
`hsdd/conventions.md`, `git status`, the owner's agent instruction files):

1. The run's name (default: the repository directory's name), the root node
   id (default: the run's name), the branch (default `auto/{run}`), the base (default the current branch), and where
   the HSDD skills are installed (default: the first of `.agents/skills`,
   `.claude/skills`, `~/.claude/skills` that holds `hsdd-auto`).
2. Who builds what: one team or several, and the team per subtree. The
   answer becomes an owner fact, so the `axis` stop never fires. The owner may
   answer "decide": the skill then removes `axis` from `stop_set`, and the
   root step decides the axis and records it with `would_have_asked: true`
   and class `axis`.
3. The sources: which documents are normative, informative or baseline,
   their citation names and versions.
4. Read-only paths and out-of-bounds paths.
5. Owner facts: anything the run must take as given (coding method, tooling
   the run may not install).
6. Toolchain command prefixes and rules.
7. Stop policy and stop set, with the defaults shown.
8. Owner files: default every path `git status` shows as modified or
   untracked at that moment.
9. Prose rules: proposed from the owner's instruction files when they state
   banned characters or phrases.
10. Commit trailers.

The skill writes the answers to `run.yaml`, shows the file, and opens the
first segment. A later `/hsdd-auto` never asks again; a configuration change
is a `setup` decision of a new segment (§8.1).

### 5.4 Example

```yaml
version: 1
run: v1-planning
branch: auto/v1-planning
base: main
skills_dir: .agents/skills
models: { orchestrator: claude-opus-5-5, step: claude-opus-5-5 }
owner_facts:
  - "Who builds what: one developer with coding agents. One team, one repository."
  - "The v0.15.1 Specification is accepted for v1 and replaces v0.15.0. The Guide and the Rationale are informative."
  - "Coding method for phase execution: superpowers, not OpenSpec. OpenSpec is not installed."
  - "No global tooling may be installed; project-local dev dependencies are fine."
preferences:
  - "Functional-first: pure core, imperative shell, immutability, composition, ADTs, declarative over imperative."
prose_rules:
  banned_chars: ["\u2014"]
  banned_phrases: ["leverage"]
  token_forms: { empty_cell: none, id_separator: ":", reason_separator: " - " }
  level: warn
sources:
  normative: [{ path: ref/docs/arch/spec-v0_15_1.md, cite: Spec, version: v0.15.1 }]
  informative:
    - { path: ref/docs/arch/guide-v0_15_1.md, cite: Guide, version: v0.15.1 }
    - { path: ref/docs/arch/rationale-v0_15_1.md, cite: Rationale, version: v0.15.1 }
  baseline: [{ path: ref/docs/arch/spec-v0_15_0.md, cite: Spec, version: v0.15.0 }]
read_only: [ref/]
out_of_bounds: [~/tmp, "~/.claude*/projects/*/memory"]
owner_files: []
orchestrator_files: [CLAUDE.md]
toolchain:
  commands: { dart: fvm dart, flutter: fvm flutter }
  rules: ["Always fvm dart and fvm flutter, never a bare dart."]
stop_set: [axis, shape, promotion, breaking-amend, collision, external, gate-twice]
stop_policy: stop
predecided:
  breaking-amend: { answer: "A breaking change to a stable contract takes the next version with a migration note.", decision: DEC-688 }
commit:
  trailers: ["Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"]
segments:
  - { id: 2026-10-17-plan, mode: plan, opened_at: "2026-10-17T11:53:19Z", instruction: "Plan the tree from scratch through reconcile.", stop_policy: stop, first_step: S00 }
  - { id: 2026-10-20-intake-spec-v0-15-1, mode: intake, opened_at: "2026-10-20T16:04:09Z", instruction: "Align everything with v0.15.1. Do not ask me anything, but record the decisions.", stop_policy: decide-and-record, first_step: S55, request: ref/docs/arch/spec-v0_15_1.md, authority: accepted-rfc }
```

### 5.5 Segment entries

Each `segments` entry has:

- `id`: `{YYYY-MM-DD}-plan` for a plan segment;
  `{YYYY-MM-DD}-intake-{slug}` for an intake, where `{slug}` is the request's
  file name without its extension (or a URL's last path segment), lower-cased,
  with every run of characters outside `a-z0-9` turned into one `-`, cut at
  40 characters, then trimmed of `-`; an empty result becomes `request`.
  When the id is taken, `-2`, `-3` and so on are appended. The segment id is the run's name for the segment; the intake
  record's own slug is `hsdd-intake`'s to choose and need not match.
- `mode`: `plan` or `intake`. A segment opened by an answer to `STOP.md` has
  the stopped segment's mode.
- `opened_at`: the time the skill started handling the owner's instruction,
  taken by the script that appends the entry, never typed.
- `instruction`: the owner's words that opened the segment, verbatim: the
  message to `/hsdd-auto`, or for a bare first run the sentence the skill
  shows after the §5.3 questions and the owner confirms.
- `stop_policy`, `first_step`: the next free step id when the entry is
  appended; `dispatch.mjs --next` for the segment's `setup` step allocates
  exactly this id and refuses otherwise (§7.2).
- For an intake: `request` (path or URL) and `authority`. A segment opened
  by an answer to `STOP.md` or by an owner message (§8.11) copies the ended
  segment's `mode`, `request` and `authority`.

`state.mjs open-segment` (§10.1) appends the entry before the segment's
`setup` step, computing the id, `first_step` and `opened_at`; that step's
artifact commit carries it.

---

## 6. Run Records

### 6.1 Rules for every record

- **Append-only.** No line of `decisions.jsonl`, `run.jsonl`, `queue.jsonl`,
  `handoffs.jsonl` or a decisions sidecar is edited or removed. A correction
  is a new line: a `plan` decision, or a queue line with the same id and a
  new status.
- **Times are taken, never typed.** Every timestamp in a record is UTC at
  second precision with a `Z` suffix (`2026-10-20T16:04:30Z`), produced by a
  script at the moment the event happens: `decide.mjs` for a decision,
  `dispatch.mjs` for a step's start and each launch, `commit.mjs` for a
  step's end and a skip, `routed.mjs` for a queue event, `state.mjs
  open-segment` for a segment's `opened_at`. An agent never writes a
  timestamp by hand.
- **Paths** are repository-relative with `/` separators, never absolute.
- **Validation by hand.** Every script validates what it writes against the
  JSON Schemas of appendix A with `lib/schema.mjs`, which implements the
  subset those schemas use: `type` (a name or a list of names), `enum`,
  `pattern`, `required`, `properties`, `additionalProperties` (`false` or a
  schema), `items`, `minItems`, `minLength`, `minimum`, and `$ref` to
  `#/$defs/{name}` or to `{file}.schema.json#/$defs/{name}` in the same
  `schema/` directory. No JSON Schema library is needed. Rules the subset
  cannot state are listed under each schema and checked in code.

### 6.2 The decision record

One line of `hsdd/judgement/decisions.jsonl` per decision. Schema: appendix
A.2.

| Field | Meaning |
|-------|---------|
| `id` | `DEC-001` onward, minted by `decide.mjs` when the decision is recorded (§10.4), never reused. |
| `at` | When the decision was taken, stamped by `decide.mjs`. |
| `segment` | The segment id. |
| `step` | The decision type: `setup`, `plan`, `intake`, `root-spec`, `mid-level-spec`, `adr`, `contract`, `phase-plan`, `reconcile`. §7.1 gives each step kind's type; `decide.mjs` assigns it (§10.4). |
| `step_ref` | The step id. |
| `by` | `subagent`, `orchestrator`, or `owner` (an owner's answer to a `STOP.md`, recorded by the next segment's `setup`). |
| `artifact` | The repository path the decision lands in, or `null` when it shaped a prompt or the run rather than a file. |
| `question` | The question as it arose; a skill's wording verbatim when a skill asked it. |
| `options` | At least two `{label, consequence}`; the consequence says what choosing it costs or buys, in one or two sentences. |
| `chosen` | Exactly one option's label. |
| `why` | The reason, for the owner reading cold. Says so when there is no evidence. When two options are close, names the signal that would have changed the choice. |
| `evidence` | Strings: source sections by citation name and number (`Spec §3.4`), experiment paths, artifact paths, decision ids, package documentation. Empty means judgement alone, and `why` says so. |
| `blast_radius` | `node-local`, `contract`, `tree` or `upstream` (chapter 2). |
| `confidence` | `high`, `medium` or `low`. |
| `would_have_asked` | True when a skill stopped for a human, or a careful engineer would have asked the owner first even though the policy allowed deciding. |
| `stop_class` | A stop class (§8.2) when `would_have_asked` is true, else `null`. |
| `would_upstream` | True when the right resolution is a change to a read-only source. |
| `model` | Optional: the model that took the decision. |
| `commit` | The step's artifact commit, added by `ledger.mjs` when it appends the line. |

One decision per real choice between options, including small ones a skill
forces (a name, an id, a default); no padding.

### 6.3 The run line

One line of `hsdd/judgement/run.jsonl` per step, appended by `commit.mjs`
before the judgement commit. Schema: appendix A.3.

| Field | Meaning |
|-------|---------|
| `step_ref`, `segment`, `kind`, `skill`, `target` | From the dispatch file; `skill` is `none` for an orchestrator step. |
| `started` | The dispatch file's `rendered_at`. |
| `finished` | The artifact commit's time. |
| `commit` | The artifact commit. |
| `dispatches` | The number of launches (the dispatch file's `launches`); `0` for an orchestrator step. |
| `status` | `completed`, or `stopped` for a step that ended on a stop (§8.3). |
| `continues` | The id of the stopped step this step continues, or absent. |
| `model`, `usage` | Optional, from `commit.mjs --model` and `--usage-file` when the host reports them; `usage` is `{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}`. |
| `note` | Optional, one line a reader of the log must know, such as "no artifact changed; empty artifact commit". |

### 6.4 The step report and the decisions sidecar

A subagent step writes two kinds of record:

- **The step report**, `hsdd/auto/steps/{step}.json`, written by the
  subagent at the end of its launch. A resumed launch writes
  `{step}.r{n}.json` (`n` from 1). In a resume report `status`, `stop` and
  `self_check` describe the step as it stands at the end of that launch;
  `artifacts`, `experiments`, `routed`, `closes`, `reads_outside` and `notes`
  list only what that launch added, and readers take the union of the
  series. Schema: appendix A.4.
- **The decisions sidecar**, `hsdd/auto/steps/{step}.decisions.jsonl`,
  written only by `decide.mjs`, one decision per line, each with its id and
  time (appendix A.2, `$defs.sidecarDecision`). The orchestrator's decisions
  during the step go to the same sidecar with `by: orchestrator`. An
  orchestrator step may have a sidecar and has no report.

| Report field | Meaning |
|--------------|---------|
| `step_ref`, `skill`, `target` | As dispatched. |
| `status` | `completed`, `stopped` (a skill stop) or `run-stop-candidate`. |
| `stop` | `null` when completed; otherwise `{question, skill_rule, stop_class, options, recommendation, blocks}`. For a skill stop, `question` is the skill's wording verbatim and `skill_rule` quotes the skill text that requires the stop. For a run-stop candidate, `question` is the subagent's one-sentence statement of the condition and `skill_rule` quotes the class's "Raised when" line from the preamble's stop conditions. `options` holds at least two entries, or one when `stop_class` is `procedural`. `blocks` says what cannot proceed. |
| `artifacts` | The paths the step wrote. |
| `experiments` | `{path, question, finding}` per experiment. |
| `self_check` | `{gate, status, note}` per quality gate of the skill: `gate` quoted verbatim from the skill's quality-gate section, `status` `pass`, `fail` or `n/a`. A gate that requires a human act (the human confirmed, the human stated), or that a give-way rule of §12.1 overrides, is `n/a` with the id of the decision that stood in for it in `note`; a gate whose subject the step did not touch is `n/a` with the note `not exercised by this step` (§12.1). |
| `routed` | Follow-ups for later steps (§6.5): `{target, kind, text}`, plus `step_kind` and `step_target` when `kind` is `insert-step`. |
| `closes` | The queue items the dispatch listed for this step: `{id, outcome, note}`, `outcome` `addressed` or `explained`. |
| `reads_outside` | `{path, why}` per file the subagent read outside its kind's read set (§7.4). Empty when none. |
| `notes` | A list of strings: counts, findings, anything the orchestrator or the report needs that is not a routed item. |

### 6.5 The routing queue

`hsdd/auto/queue.jsonl`, one line per item event, written only by
`routed.mjs`. Schema: appendix A.5.

An item is opened from a report's `routed` entry (`routed.mjs ingest`) or by
the orchestrator (`routed.mjs open`): `{id: "Q-001", at, status: "open",
from, target, kind, text}`, with `step_kind` and `step_target` for an
`insert-step` item. Its `kind`:

- `must-address`: the target's next step must do it or explain why not. An
  open `must-address` item fails the final gate.
- `consider`: the target's next step must read it and say what it did. An
  item still open at the segment's end is listed among the report's deferred
  findings.
- `insert-step`: proposes a new step of `step_kind` (any subagent kind except
  `intake`) on `step_target`, for the reason in `text`. Its `target` is
  always `run`, so it never matches a step. An optional `after` names an
  intake handoff id, or `handoffs` for all of them, that must be executed or
  skipped before the step runs (§8.7). The orchestrator accepts or rejects it
  with a `plan` decision (§8.7).

**Targets** are written as: a node id (`acme.backend.auth`), a contract slug
without version (`auth-token`, the contract's `id`, which stands for every
version file of it), the file name of one later version without `.md`
(`auth-token.v2`, v0.10.0 §3.1), an ADR id (`ADR-003`), an intake handoff id
(`H7a`), or `run` (the run itself). A step's target string is its node id,
contract slug or ADR id; for `citation-touch`, the touched file's node id,
slug or ADR id; for `reconcile` and `align`, a comma-separated list of node
ids, or `all` for every leaf-parent (for records and matching only: the skill
drains every pending section in the tree, §7.1); for `intake`, the request
path. An item
**matches** a step when its target equals the step's target, is an element of
the step's target list (`all` matching every leaf-parent), or is the
handoff id the step executes. `dispatch.mjs` lists every open matching item
in the step's prompt, and the step must close each in `closes`.

**Closing.** An item's later events are new lines with its id: `addressed` or
`explained` (with `by`, the closing step, and `note`), written by
`routed.mjs ingest` from a report's `closes` or by the orchestrator with
`routed.mjs close` for items targeting `run` or the request path; `accepted`
or `rejected` (with `decision`) for an `insert-step` item; and `addressed`
for an accepted `insert-step` item, written by `commit.mjs` when the inserted
step commits as `completed` (a stopped inserted step keeps the item
`accepted`, and its continuation carries the item, §8.3). An item's state is
its last line.

### 6.6 The dispatch file

`hsdd/auto/dispatch/{step}.md`, written by `dispatch.mjs` when the step
starts and committed in its judgement commit. It is the exact prompt the
subagent received, so a step can be audited and re-run from it. Front matter
(schema: appendix A.8):

```yaml
---
step_ref: S64
segment: 2026-10-20-intake-spec-v0-15-1
kind: citation-touch
skill: hsdd-contract
target: topic-model
handoff: H7a                     # null outside intake handoffs
queue_item: null                 # the insert-step item this step executes
continues: null                  # the stopped step this step continues
report: hsdd/auto/steps/S64.json # null for an orchestrator step
decisions: hsdd/auto/steps/S64.decisions.jsonl
write_set: ["hsdd/contract/topic-model.md", "hsdd/contract/fixture/topic-model/**", "hsdd/contract/schema/topic-model.schema.json", "hsdd/contract/INDEX.md", "hsdd/adr/INDEX.md"]
template: steps/citation-touch.md  # null for an orchestrator step
skill_version: 0.11.0            # from scripts/VERSION
rendered_at: "2026-10-20T19:28:30Z"
head: 7afa20c                    # HEAD when rendered; the gate's check A4
launches: [{ at: "2026-10-20T19:28:30Z", reason: initial }]
---
```

The body is the rendered preamble (appendix B) followed by the rendered step
section (appendix C). Each later launch appends to `launches`
(`redispatch`, `resume-answer` or `resume-finding`) and, for a resume, a
`## Resume {n}` section with its message to the body. An orchestrator step
(`setup`, `plan`, `report`) also gets a dispatch file, with `skill: none`,
no report, and an empty body without a read check, so that every step has
an id, a start time, a write set and a `head` recorded the same way.

**The read check.** A subagent step's body ends with the line
`read_check: {value}`, where the value is eight hex digits from a
cryptographic random source. It stays the file's last line: `dispatch.mjs`
moves it below every section it appends. A redispatch draws a new value,
since a fresh subagent must show its own read; a resume keeps it, since the
message goes to the subagent that already read the file. The value is not
in the front matter, so a read that stops short of the end cannot find it.
Every report of the step echoes it (appendix A.4), and the gate compares
the latest report's value with the file's (§10.6, B5). The file's size is bounded so that one read returns
all of it (§10.3).

### 6.7 `STOP.md`

Written by the orchestrator when a stop in the stop set fires under the
`stop` policy, or a hard stop fires (§8.2), and committed in the stopped
step's judgement commit. Shape:

```markdown
# Run stopped at {step}

- **Segment:** {segment id}
- **Stop class:** {class}
- **Step:** {step} ({kind}, {skill} on {target})

## Question
{verbatim}

## Options
- **{label}** (recommended): {consequence}
- **{label}**: {consequence}

## What it blocks
{the steps that cannot run, by kind and target}

## How to resume
Answer in one message, then run `/hsdd-auto`. The answer opens a new segment
and is recorded as its owner's decision. For a stopped subagent step a
continuation of the same kind and target is dispatched with it; for a stopped
`plan` step the new segment's `plan` step turns the answer into steps (§8.3).
```

While `STOP.md` exists and no segment entry newer than the stopped step's
has been appended, `next.mjs` returns `blocked`. The next `/hsdd-auto`
must carry the owner's answer; the new segment's `setup` records it with
`decide.mjs --by owner --type setup`, removes `STOP.md`, and the run
continues with the continuation (§8.3).

### 6.8 The owner's review line

`hsdd/judgement/decision-reviews.jsonl`, written by the owner, never by the
run. Schema: appendix A.6. Fields: `decision`, `at`, `review` (`agree`,
`disagree`, `should-have-asked`), `reason` (required for `disagree` and
`should-have-asked`), and optionally `reviewer`, `preferred` (on `disagree`,
the label the owner would have chosen, or `other: {one line}`) and `impact`
(on `disagree`, the blast radius of the difference). A second review of the
same decision is a new line.

### 6.9 The plan

`hsdd/auto/plan.md` is the run's human-readable path, in three sections:

- `## Segments`: one paragraph per segment, written by the orchestrator in the
  segment's `plan` step: the mode, the owner's instruction, the stop policy,
  the stages `next.mjs --stages` printed, and the decisions the orchestrator
  expects to take. The first sentence of each paragraph states the segment's
  purpose in one line; the preamble quotes it (appendix B).
- `## Step log`: a table regenerated whole by `commit.mjs` from `run.jsonl`
  and `handoffs.jsonl` at every judgement commit: step, segment, kind, skill,
  target, status, artifact commit, and a row per skipped handoff. Never
  edited by hand.
- `## Change log`: entries appended by the orchestrator, saying what changed
  in the path and why (an inserted or rejected step, a skipped handoff, a
  configuration change, a continuation). Each entry opens with the id of the
  decision that made the change, whose `at` is the entry's time; no date is
  typed.

### 6.10 The owner-file snapshot

`hsdd/auto/owner-files.json` maps each path in `owner_files` to the sha256
of its bytes, or `null` when it is absent (schema: appendix A.9). Each
segment's `setup` step takes it. The gate fails a step when any hash
differs (A2). The owner changing a file between segments is expected: the
next segment's setup takes a new snapshot.

### 6.11 What each commit holds

| Commit | Subject | Holds |
|--------|---------|-------|
| Artifact commit | `{artifact}: {step} {kind} {target}: {summary}` for a subagent step, `{orchestrator}: {step} {kind}: {summary}` for an orchestrator step, with ` (stopped)` appended for a stopped step | The step's write-set changes and its experiments. Empty when nothing changed, so every step has two commits. Never an owner file. |
| Judgement commit | `{judgement}: {step}` | The **judgement set**: the step's ledger lines and run line, its report files and decisions sidecar, its dispatch file, `queue.jsonl`, `handoffs.jsonl`, `plan.md`, and `STOP.md` when written or removed. |
| Skip commit | `{orchestrator}: skip {handoff}: {reason}` | One `handoffs.jsonl` line and the regenerated `plan.md` (§6.12). |

All carry the configured trailers. A decision's `commit` is its step's
artifact commit, so `git show {commit}:{artifact}` is the artifact as it
stood when the decision landed, and `git rev-parse {commit}:{artifact}` its
blob.

### 6.12 Skipped handoffs

`hsdd/auto/handoffs.jsonl` records each intake handoff that `next.mjs`
passed over because its `when` condition did not hold: `{segment, handoff,
at, status: "skipped", reason}` (schema: appendix A.11), written by
`commit.mjs --skip` (§10.7). An executed handoff needs no line: a step whose
run line is `completed`, or a completed continuation of one, names it in its
dispatch file; a handoff whose only step is `stopped` is still `pending`.
Handoff state is read across every segment with the same `request`, since a
segment opened by an answer or an owner message continues the same intake
(§5.5). `state.mjs` reports each handoff as `executed`, `skipped` or
`pending` from these sources.

---

## 7. The Step Model

### 7.1 Step kinds

| Kind | Skill (mode) | Target | Decision type | Template |
|------|--------------|--------|---------------|----------|
| `setup` | none (orchestrator) | the segment id | `setup` | none |
| `plan` | none (orchestrator) | the segment id | `plan` | none |
| `root-spec` | `hsdd-spec` | the root node id (`root`, §5.1) | `root-spec` | `root-spec.md` |
| `mid-level-spec` | `hsdd-spec` | an internal node id | `mid-level-spec` | `mid-level-spec.md` |
| `graft` | `hsdd-spec` (graft mode) | the parent's node id | `mid-level-spec` | `graft.md` |
| `promote` | `hsdd-spec` (promotion mode) | an as-built node id | `mid-level-spec` | `promote.md` |
| `spec-touch` | `hsdd-spec` (touch, §12.1) | a node id | `root-spec` for the root, else `mid-level-spec` | `spec-touch.md` |
| `adr` | `hsdd-adr` | an ADR id | `adr` | `adr.md` |
| `adr-update` | `hsdd-adr` | an ADR id | `adr` | `adr-update.md` |
| `contract` | `hsdd-contract` | a contract slug | `contract` | `contract.md` |
| `contract-touch` | `hsdd-contract` | a contract slug | `contract` | `contract-touch.md` |
| `citation-touch` | `hsdd-contract`, `hsdd-adr` or `hsdd-spec`, by the file | a contract slug, ADR id or node id | that skill's type, as above | `citation-touch.md` |
| `phase-plan` | `hsdd-phase-plan` | a leaf-parent's node id | `phase-plan` | `phase-plan.md` |
| `phase-plan-append` | `hsdd-phase-plan` (append mode) | a leaf-parent's node id | `phase-plan` | `phase-plan-append.md` |
| `reconcile` | `hsdd-reconcile` | node ids, comma-separated, or `all` | `reconcile` | `reconcile.md` |
| `align` | `hsdd-reconcile` (align mode, §12.3) | node ids, comma-separated, or `all` | `reconcile` | `align.md` |
| `intake` | `hsdd-intake` | the request path | `intake` | `intake.md` |
| `report` | none (orchestrator) | the segment id | `plan` | none |

The decision type applies to the subagent's decisions. The orchestrator's
decisions in any step are of type `plan`, except in a `setup` step, where
they are `setup`; `decide.mjs --type` overrides either (§10.4).

`spec-touch`, `contract-touch` and `adr-update` change an existing
artifact's content for a reason a routed item or a handoff states;
`citation-touch` changes only citations and the sentences they sit in
(§12.4).

A `reconcile` or `align` step's target names the plans the step was ordered
for. The skill has no per-node scope: it drains every pending section in the
tree (`hsdd-reconcile` step 2), so the target serves records and queue
matching, and the write set covers every plan file.

### 7.2 Step ids

`S` followed by a decimal number of at least two digits (`S00`, `S07`,
`S100`). `dispatch.mjs` allocates the next id when the step starts, never
earlier, so an inserted step never renumbers another. Ids are unique across
the run's segments and never reused. A handoff skipped by its condition
takes no id (§6.12).

### 7.3 Write sets

A step may change only the paths of its kind. Paths are relative to the
repository; `H/` is `hsdd/` and `H/spec/`, `H/contract/`, `H/adr/` and
`H/management/` are the resolved paths of §4.2; `**` matches any depth.

| Kind | May write |
|------|-----------|
| `root-spec`, `mid-level-spec`, `graft`, `promote`, `spec-touch` | `H/spec/*.md`, `H/conventions.md` |
| `adr`, `adr-update` | `H/adr/**`, `H/spec/*.md` and `H/contract/*.md` (to add `Governed by` and mark resolved open-question rows), `H/scripts/gen-registry.mjs` |
| `contract`, `contract-touch` | `H/contract/**`, `H/adr/INDEX.md`, `H/scripts/gen-registry.mjs` |
| `citation-touch` | the target's file; for a contract also `H/contract/fixture/{slug}/**` and `H/contract/schema/{slug}.schema.json`; `H/contract/INDEX.md`, `H/adr/INDEX.md` |
| `phase-plan`, `phase-plan-append` | `H/spec/{node}.md` only |
| `reconcile`, `align` | `H/contract/**`, `H/spec/*.md`, `H/conventions.md`, `H/adr/INDEX.md` |
| `intake` | one new file `H/management/YYYY-MM-DD-intake-{slug}.md`, and existing `H/management/*-intake-*.md` files (their change logs, for collisions) |
| `setup` | `H/auto/run.yaml`, `H/auto/owner-files.json`, `H/auto/adapter.json`, `H/scripts/auto/**`, `H/scripts/gen-registry.mjs`, `.claude/settings.json`, `.claude/agents/hsdd-auto-step.md`, the `orchestrator_files` |
| `plan` | `H/auto/plan.md`; `H/auto/run.yaml` for a `predecided` entry only (§8.4); `H/scripts/auto/**` and `H/scripts/gen-registry.mjs` to recopy a stale copy (§4.3) |
| `report` | `{report_dir}/{segment}.md`; for an intake segment, the segment's intake record |

Every subagent step may also write its report files and anything under
`experiments_dir`. The judgement set (§6.11) is written by the scripts and is
never a write-set violation. The registries (`H/contract/INDEX.md`,
`H/adr/INDEX.md`) may change in any step that may write the generator's
inputs.

**Never**, for a subagent step: `H/judgement/`, any other path under
`H/auto/`, `H/scripts/auto/`, a `read_only` path, an `owner_files` path,
`skills_dir`, `.claude/`, and git state (no commit, stage, stash, branch,
reset or checkout).

### 7.4 Read sets

A step reads what its skill reads, its dispatch file, the sources, and its
experiments. "What its skill reads" is the files the step section's fact
lines name and the files the skill's own process steps tell it to open; a
file outside both is a read outside. Two limits are stated in every prompt
and checked through the report's `reads_outside`:

- **Sibling isolation (v0.10.0 §8.3).** A `phase-plan` or
  `phase-plan-append` step must not read another node's `## Phase Plan`
  section or pending section. Because a node's plan lives in its spec file,
  which the step may read for purpose and contracts, no path rule can
  enforce this; the template tells the step to follow its skill's own phase
  templates for format (appendix C), so it never needs a sibling's plan.
- **Out of bounds.** No agent reads an `out_of_bounds` path. The adapter
  enforces it where the host allows (chapter 11).

A subagent that read outside its read set says so in `reads_outside`. The
orchestrator records each entry as a `plan` decision (keep the step's
output, or rework it) and the report lists it under record gaps.

### 7.5 Experiments

When a decision depends on a runtime fact (what a library does, how a
runtime schedules, what a parser accepts), the subagent writes a throwaway
program under `{experiments_dir}/{name}/`, runs it with the toolchain's
command prefixes, keeps the source and the captured output (`output.txt`,
or `output-{case}.txt`), adds a `README.md` of at most ten lines whose first
line is the finding, and cites the directory in the decision's evidence. An
experiment never joins the project's build or workspace. A fact that a short
program settles is never guessed.

### 7.6 Prose rules and template tokens

The preamble passes `prose_rules` to every step. When a banned character is
one an HSDD template uses as a token, the step writes the configured
`token_forms` instead: `empty_cell` for an empty table cell or list,
`id_separator` between an id and its title in a heading, and
`reason_separator` before a `Collides with` reason, and `source_separator`
between the path, authority and scope of a root `## Sources` line. The forms
must be among those v0.10.0's formats admit after §15.3's amendment: `:`, an
en dash or ` - ` between an id and its title, ` - ` before a `Collides with`
reason and in a `## Sources` line, and `none` or `-` for an empty cell;
`hsdd-summary`'s plan extractor already reads each of them as it reads the
em dash. The gate reports violations in write-set files at
`prose_rules.level` (D1). Exempt: step reports, sidecars and the generated
parts of a segment report, since they quote skill and decision text
verbatim; `H/conventions.md`, a copied skill template whose prose the step
does not rewrite; and the bundled copies under `H/scripts/` and `.claude/`,
which are never edited (§4.3). A segment report's prose slots are checked.

---

## 8. The Loop

### 8.1 Opening a segment

`/hsdd-auto` (or `/hsdd-auto intake <source>`) does, in order:

1. **Read the configuration.** When `hsdd/auto/run.yaml` is missing, ask the
   questions of §5.3 and write it.
2. **Refuse when it cannot run at all.** `hsdd/conventions.md` declares the
   standalone-spec-repo profile, or one of the six planning skills under
   `skills_dir` lacks its `## Unattended runs` section (reinstall HSDD
   0.11). The refusal says what to do and changes nothing.
3. **Read the state** (`state.mjs`). If a step is in progress, or the
   current segment is unfinished, resume (§8.9) and skip the rest of this
   list: a new segment opens only when the current one is finished, stopped,
   or ended by an owner message (§8.11), and `/hsdd-auto intake` on an
   unfinished segment is refused with that reason. If `STOP.md` exists, the
   invoking message must carry the owner's answer, unless the newest segment
   entry has no `setup` commit yet (a crash after item 4), whose
   `instruction` then is the answer; otherwise refuse and show
   `STOP.md`'s question. Before opening a new segment, refuse when the
   working tree has changes outside `owner_files`, `hsdd/auto/run.yaml` (a
   first run has just written it) and the judgement set.
4. **Open the segment** with `state.mjs open-segment` (§10.1): it checks out
   the run branch, creating it from `base` when it does not exist, so that
   every dispatch file's `head` and every commit are on it, and appends the
   segment entry (§5.5).
5. **Run the `setup` step.** `dispatch.mjs --next` starts it. Copy the
   scripts when the copy is not current (§4.3), copy `gen-registry.mjs` from `hsdd-contract` when
   contracts exist and the copy is missing or differs, take the owner-file
   snapshot, and install or check the adapter (chapter 11). Then record, with
   `decide.mjs --by orchestrator`:
   - the reading of each sentence of the owner's instruction that changes how
     the run behaves (which source is normative, the stop policy, a scope
     limit), with the sentence quoted as evidence;
   - the segment's stop policy when it differs from `run.yaml`'s default;
   - each predecided answer (§8.4);
   - each change to `run.yaml` or an `orchestrator_files` path, made in this
     step;
   - an owner's answer to `STOP.md`, with `--by owner`, its evidence naming
     the stopped step's id; remove `STOP.md`; and when the answer is one an
     owner fact can carry (an `axis` answer), append it to `owner_facts`, so
     the continuation's skill finds it answered, recording the `run.yaml`
     change.
   Commit with `commit.mjs --step {step} --status completed`.
6. **Run the `plan` step.** `next.mjs --stages` prints the stages the mode
   will walk (chapter 9) and which are done. The orchestrator writes the
   segment's paragraph under `## Segments` in `plan.md` and records, as
   `plan` decisions, any choice about the path the stages leave open.
   Commit.
7. **Enter the step loop:** repeat `next.mjs`, act on its result (§10.2),
   until it returns `done` or `blocked`; `stop`, `close`, `decide` and `stuck`
   are handled in a `plan` step and the loop continues.

For each subagent step the loop is: `dispatch.mjs --next` writes the
dispatch file and prints the launch prompt; the orchestrator launches the
step agent with it and waits (§8.8); on the hand-back it reads the report;
it handles a stop (§8.3) or reviews the step (§8.5); then
`commit.mjs --step {step} --status completed`.

### 8.2 Stop classes and the stop policy

| Class | Raised when | Typical source |
|-------|-------------|----------------|
| `axis` | The decomposition axis is unknown and no owner fact answers it. | `hsdd-spec` "who builds what?" |
| `shape` | The two leading options produce different nodes or a different set of contracts, both are defensible, and no source, owner fact, HSDD rule or experiment gives one a stated reason to lead. | `hsdd-spec`, `hsdd-phase-plan` structural contract gap, `hsdd-intake` class `structural`, a producer cycle (§9.1) |
| `promotion` | An as-built node would be promoted. | `hsdd-spec` promotion mode, run as the `promote` step an intake record's `**Promotes:**` line orders first (§9.2) |
| `breaking-amend` | A change the contract's own versioning rules call breaking, to a `stable` contract under `compatibility: versioned`. Under `frozen`, or at `v0`, such a change is a run-stop candidate of this class that no predecided answer covers: a frozen contract takes a new contract and a `v0` one a redesign (`hsdd-contract`'s versioning policy). | `hsdd-contract`, `hsdd-reconcile` amend or request |
| `collision` | Two nodes' entries conflict at reconcile. | `hsdd-reconcile` |
| `external` | The run needs something outside the repository: a credential, a private network resource, or global tooling. | any |
| `gate-twice` | A step failed its gate or its review once more than `rework_limit` allows. | the loop |
| `upstream` | The right resolution changes a read-only source. | any |
| `procedural` | A skill stops for a missing input another step supplies: an unminted open-question id, a node that still contains subsystems, an ADR cited without a file. | `hsdd-phase-plan` |
| `judgement` | A choice a careful engineer would put to the owner although no skill stops for it. | the ask-point tables of §12.1 |

Only the first seven can be in `stop_set`. Handling:

| Class | Policy `stop` and class in `stop_set` | Otherwise |
|-------|---------------------------------------|-----------|
| `axis`, `shape`, `promotion`, `breaking-amend`, `collision` | End the run with `STOP.md` (§8.3, case A). | The orchestrator answers as the owner's stand-in (§8.3, case B); for `axis` outside `stop_set` the root step decides it itself and no stop is raised (§5.3, §12.1). |
| `gate-twice` | End the run with `STOP.md` (§8.3, case A). | The orchestrator records the decision, commits the step as `stopped`, and a continuation with a fresh subagent receives the findings (§8.6). |
| `external` | End the run with `STOP.md`. | Answer only with an in-repository alternative (a project-local dependency instead of a global one). When none exists, end the run with `STOP.md`. This is a **hard stop**: no policy waives it. |
| `upstream` | Never a stop: the step resolves it locally with `would_upstream: true`. A read-only source is never changed. | Same. |
| `procedural` | Never ends the run: a skill stop handled by §8.3, case C. | Same. |
| `judgement` | Never a stop: the step decides and records it with `would_have_asked: true`. | Same. |

A step that returns `upstream` or `judgement` as a stop is resumed with
`dispatch.mjs --resume {step} --reason finding --message-file {file}` and the
instruction to decide
it; the orchestrator records no decision of its own, and the resume does not
count against `rework_limit`.

**Hard stops** write `STOP.md` under either policy: an `external` need with
no in-repository alternative; a continuation that itself reaches
`gate-twice` (§8.6); a dispatch file that stays over the size limit once the
orchestrator's context is shortened (§10.3); an owner file a step changed,
which only the owner can restore (§10.7); and a `stuck` segment that no step
kind can fix (§8.10).

### 8.3 Answering a stop

A step subagent never answers a stop. It ends its launch with
`status: stopped` (a skill stop) or `status: run-stop-candidate` (a stop-set
condition met outside a skill stop) and a `stop` object (§6.4). The
orchestrator then:

1. **Checks the read.** It runs `gate.mjs --step {step} --check B1,B5`. An
   error means the subagent did not read its dispatch file to the end, where
   the predecided answers are, so the stop may be one they answer. The
   orchestrator resumes the subagent with that finding (§8.6) and handles
   nothing else until a report passes.
2. **Checks the class.** It may correct the subagent's `stop_class` and says
   why in its decision.
3. **Checks the condition.** For `shape`, the condition holds only when both
   options are defensible, they differ in nodes or contracts, and neither the
   sources, the owner facts, HSDD's rules nor an experiment gives one a
   stated reason to lead. When one has a stated reason, the condition does
   not hold: the orchestrator answers it (case B), cites that reason, and
   records `would_have_asked: false`.
4. **Ingests the report's routed items** (`routed.mjs ingest --step {step}`)
   and accepts or rejects each `insert-step` item among them with a `plan`
   decision in this step's sidecar, as §8.5 does for a completed step; this
   happens before any `commit.mjs --status stopped` below.
5. **Handles it by §8.2's table, in one of three cases:**

- **Case A: end the run.** The orchestrator writes `STOP.md` (§6.7) with its
  recommendation, then runs `commit.mjs --step {step} --status stopped`,
  which commits the partial artifacts (gate checks A1 to A4, B1 and B5) and the
  judgement set with `STOP.md`. The run ends with a clean tree. The owner's
  answer later opens a new segment, and `next.mjs` returns the
  continuation.
- **Case B: answer and resume.** The orchestrator records its answer in the
  step's sidecar (`decide.mjs --step {step} --by orchestrator`, with
  `would_have_asked: true` and the class, the subagent's options plus any it
  adds, and a `why` for the owner reading cold that names the signal that
  would have changed it). It resumes the same subagent with
  `dispatch.mjs --resume {step} --reason answer --message-file {file}`, whose
  message gives the answer and the decision id. The step continues; nothing is committed in between. When the
  host cannot resume a subagent, the orchestrator instead commits the step as
  `stopped` and the continuation carries the answer.
- **Case C: supply the missing input.** For `procedural`, the orchestrator
  records a `plan` decision in the step's sidecar, accepts the `insert-step`
  item the report routed for the step that supplies the input, or opens one
  when the report did not (`routed.mjs open --from {step} --kind insert-step
  ...`), citing that decision (`routed.mjs decide`),
  and only then commits the step as `stopped`, so the decision and the queue
  events land in the same judgement commit. `next.mjs` returns the inserted
  step, then the continuation.

**Continuations.** `next.mjs` returns a continuation for a subagent step
whose run line is `stopped` when: no later step continues it, `STOP.md` is absent,
and every `insert-step` item opened from it is `addressed` or `rejected` (a
rejection is among the decisions the continuation carries). The continuation
has the stopped step's kind, target, handoff and `queue_item`, `continues`
set to the stopped step's id, and a prompt that names the stopped step's report, its
committed partial artifacts, and every decision taken on its stop (by id),
and tells the step to finish the work from there. A stage condition that
the stopped step's partial artifacts happen to satisfy does not count until
a continuation of it completes; likewise an `insert-step` item or a handoff
the stopped step's dispatch file names is returned only as that step's
continuation (§10.2).

A `plan` step that wrote `STOP.md` (a hard stop, §8.2, §8.10, or a
producer-cycle stop under policy `stop`, §10.2) is
committed `stopped` too, but gets no continuation: the new segment's `plan`
step reads the owner's `by: owner` decision and opens and accepts the
`insert-step` items it implies (an order for a cycle's members, the step that
fixes a stuck condition), by `plan` decisions that cite it.

The stop stays visible throughout: the stopped report, the orchestrator's
decision, the run line's `stopped` status, and the continuation's
`continues`.

### 8.4 Deciding in advance

When the `setup` or `plan` step can see that the segment will meet a
stop-set class (an intake whose change breaks stable contracts will meet
`breaking-amend` on every one of them), the orchestrator may decide the
answer once instead of answering the same stop many times. It does so only
under `decide-and-record`, or when an owner fact already gives the answer.
It records one decision (type `setup` or `plan`, by the step) with
`would_have_asked: true` and the class, and writes `predecided[class]` with
the answer and the decision id; the `plan` step's write set admits that entry
(§7.3).
`dispatch.mjs` puts every predecided answer into every step section
(appendix C.2), so a predecided answer added by a `plan` step reaches the
next step. A subagent
that meets that class applies the answer, records its own decision with
`would_have_asked: true`, the class, and the predecided decision's id in its
evidence, and does not stop. Each such decision is therefore still listed
for review.

### 8.5 Reviewing a step

After the hand-back of a completed step and before committing it, the
orchestrator runs `routed.mjs ingest --step {step}`, so the report's routed
items exist, then reads the report and the diff of its write set, and
checks:

- every `self_check` entry with `fail`;
- every artifact the report names exists, and nothing outside the write set
  changed (the gate repeats this mechanically);
- every sentence the diff touches is true against the current text of what
  it cites, and the step did not leave a sentence it read and knew to be
  false (a step that reports such a sentence as outside its scope gets a
  rework or a routed item, by a recorded `plan` decision);
- the step closed every routed item its dispatch listed (`closes`);
- `reads_outside` is empty, or each entry is recorded (§7.4).

A finding is reworked by resuming the subagent (§8.6), or routed to a later
step with `routed.mjs open`, by a recorded `plan` decision either way. Every
`insert-step` item the ingest opened is accepted or rejected now, with a
`plan` decision in this step's sidecar (§8.7). Every orchestrator decision
belongs to a step whose judgement commit has not been made: this step's, or
a `plan` step's (§10.3); `decide.mjs` refuses a step that already has one
(§10.4).

### 8.6 Resume and rework

A resume continues the same subagent, with its context, through the host's
message-to-agent capability. `dispatch.mjs --resume {step} --reason
answer|finding --message-file {file}` records it (§6.6) and prints the
message to send, which states the answer or finding, the decision id, the
report file to write (`{step}.r{n}.json`), and that the rest of the
original prompt still holds.

A step may be resumed for findings (a failed gate or review) at most
`rework_limit` times. The next failure raises `gate-twice`. Under `stop`
(with `gate-twice` in the stop set) that is case A. Otherwise the
orchestrator records a decision with `would_have_asked: true` and class
`gate-twice`, commits the step as `stopped`, and the continuation, a fresh
subagent, receives the findings: the decision's `why` quotes them, and the
continuation's `### Continuing` lists every report file of the series and
the dispatch path (appendix C.2). When the finding is B1 or B5 (no valid
report), the stopped commit uses `commit.mjs --status stopped --no-report`,
which skips those two checks, renames the report series
`{step}.invalid{k}[.r{n}].json` and notes it in the run line (§10.7). A
continuation that itself reaches `gate-twice` is a hard stop. Resumes that
carry a stop's answer never count against the limit.

When the subagent was lost (the session ended mid-launch), the step is
re-dispatched under the same id with `dispatch.mjs --redispatch {step}`
(§8.9), which records a `redispatch` launch and prints the launch prompt. A
redispatch starts a new report series: the step's existing report files are
renamed `{step}.lost{k}.json` and `{step}.lost{k}.r{n}.json` (`k` counts
redispatches from 1) and stay in the judgement set; the fresh subagent writes
`{step}.json` again; B1, B3, B5 and `routed.mjs ingest` read only the current
series.

### 8.7 Inserted steps

An `insert-step` item comes from a report's `routed`, from the
orchestrator's review, from an intake record's insert rule, or from case C.
The orchestrator accepts or rejects it with a `plan` decision
(`routed.mjs decide`), recorded in the sidecar of the step under review when
the item came from its report or review (§8.5), and otherwise in a `plan`
step (§10.3); never between steps. `next.mjs` returns accepted, unaddressed
items as steps before any stage rule, oldest first. The step takes its id at
dispatch (§7.2), its dispatch file names the item (`queue_item`), and
`commit.mjs` marks the item `addressed` when the step commits as
`completed`; a stopped step leaves it `accepted` for its continuation. An
item may carry `after` (§6.5): `next.mjs` returns it only once the named
handoff, or every handoff, is executed or skipped, so an insert ordered
"before the final align" waits for the handoffs. The orchestrator rejects an
item that duplicates a pending handoff (same kind and target), citing it.
The orchestrator adds a change-log entry naming the decision.

### 8.8 Waiting

The orchestrator waits for the subagent's hand-back; it never polls. With
`dispatch.wait: hand-back` the host notifies the session when the subagent
ends; with `foreground` the launch call itself returns the result. One
fallback wake-up of `fallback_wakeup_minutes` may be set per launch, for a
subagent that hangs; it re-reads the state and the subagent's status and
sets no further timer. A timed wait shorter than 20 minutes is a defect.

### 8.9 Recovering context and resuming after an interruption

Everything needed to continue is on disk. After any context summary, and on
every `/hsdd-auto` that resumes, the orchestrator reads `state.mjs`,
`hsdd/auto/plan.md`, the last twenty lines of `decisions.jsonl` and
`git log --oneline -20` before acting. Before re-entering any handling it
reads the step's sidecar and the uncommitted lines of `queue.jsonl`: a
decision or item already present for the same question or text is reused,
never minted again; a `hsdd/auto/.decide.lock` left by a lost subagent is
removed. A step that started but has no judgement commit resumes where it
stopped:

| State on disk | Resume by |
|---------------|-----------|
| Dispatch file of a subagent step; no report of the current series; no artifact commit | `dispatch.mjs --redispatch {step}`: a new launch under the same id, whose prompt says which files the lost launch changed and that the step must finish or correct them. |
| Dispatch file whose latest launch is a resume newer than every report file; no artifact commit | The resumed subagent is gone: `dispatch.mjs --redispatch {step}` (§8.6). |
| Dispatch file of an orchestrator step (`skill: none`); no commits | Its body names what the step was opened for (§10.3, `--for`); finish that work and run `commit.mjs`. |
| Index not empty, `HEAD` equal to the dispatch file's `head` | A crash inside `commit.mjs` after staging: `commit.mjs` unstages and starts over (§10.7). |
| Dispatch file and report; no artifact commit | The review (§8.5), or the stop handling (§8.3). |
| Artifact commit (`HEAD`'s subject names the step); no judgement commit | `commit.mjs --step {step} --status {status}` again: it sees the artifact commit and continues from the ledger (§10.7). |

### 8.10 Finishing a segment

When every other condition of the mode holds, `next.mjs` returns the
`report` step (chapter 9). The orchestrator runs `report.mjs`, fills the
report's prose slots (§10.9), records any last `plan` decisions, and runs
`commit.mjs --step {step} --status completed`, which runs the final gate
before committing. After the commit `state.mjs done` prints
`DONE {segment}`. The orchestrator ends with one message to the owner: the
report's path, the number of steps and decisions, the `would_have_asked`
decisions by id, whether anything stopped, `state.mjs done`'s output, and a
reminder that `/hsdd-summary` re-renders the reading aids, which the run does
not drive (v0.10.0 §13.3).

When `next.mjs` returns `stuck`, no stage rule can make progress but the
done condition fails. The orchestrator starts a `plan` step
(`dispatch.mjs --plan`), records a decision that names each unmet condition,
and either routes it (an accepted `insert-step` item, or an item for an
existing target) or, when no step kind can fix it, writes `STOP.md` under
class `shape` with the unmet conditions as its question and commits the
`plan` step with `--status stopped` (§8.3). That is a hard stop (§8.2).

### 8.11 Owner messages during a segment

An owner message that arrives while a segment runs is an instruction. After
the current step's commits, the orchestrator starts a `plan` step
(`dispatch.mjs --plan`) and quotes the message in a `plan` decision that
states how it reads it and from which step it applies. A message that
changes `run.yaml` ends the current segment there and opens a new segment of
the same mode, whose `setup` applies the change; the ending `plan` step is
committed with `--note "ended: owner message"`, which `state.mjs` and
`next.mjs` read as the segment's end (§10.1), and the new segment's report
covers the ended one (§10.9). A message that asks the run to stop ends it
after that `plan` step's commits, with no `STOP.md`; `/hsdd-auto` resumes it
later.

---

## 9. Modes

### 9.1 `plan`: an empty tree through reconcile

`next.mjs` walks these stages in order. A stage is done when its condition
holds, so a plan segment on a partly planned tree starts at its first
unfinished stage.

| Stage | Steps | Done when |
|-------|-------|-----------|
| 0 Setup | `setup` | the segment's `setup` step is committed |
| 1 Plan | `plan` | the segment's `plan` step is committed |
| 2 Root decomposition | `root-spec` on the root | the root spec exists |
| 3 Root ADRs | one `adr` per ADR id a spec cites that has no file, in order of first citation in the root spec, then in the parent specs producer-first | every cited ADR id has a file |
| 4 Root contracts | one `contract` per contract slug a spec names that has no file, producer-first | every named contract has a file |
| 5 Mid-level decomposition | `mid-level-spec` on each node whose `Kind` is `internal` and whose `Decomposes into` names no child ids (it is empty or starts with `phases`), in producer-first order; stages 3 and 4 then apply again to what those name | no such node remains, and stages 3 and 4 are done |
| 6 Phase plans | `phase-plan` on each `leaf-parent` that is not as-built (`**Adopted:** as-built`) and has no `## Phase Plan`, producer-first; before the next `phase-plan`, a `reconcile` on every leaf-parent whose pending section has entries | every such leaf-parent has a phase summary table and no pending section has entries |
| 7 Consistency | one step per open `must-address` or `consider` item, oldest first, of the kind its target needs (node: `spec-touch`; contract: `contract-touch`; ADR: `adr-update`; a handoff id: the kind for that handoff's own target; the intake request path or `run`: `next.mjs` returns `close`, §10.2); then an `align` on `all` | no open item, and the align condition holds |
| 8 Report | `report` | the segment's `report` step is committed |

**The align condition.** The segment's last committed subagent step is an
`align` whose target was, in plan mode, `all`, and in intake mode every
leaf-parent that no step of the segment re-planned, where re-planned means
the target of a committed `phase-plan` or `phase-plan-append` of the segment
(counted from the record's `intake` step when the segment continues an
earlier one, §9.2). An empty target set in intake mode counts as the
condition holding, and no align runs. An item an `align` routes whose `text`
equals one closed `explained` earlier in the segment is not reopened: it is
a deferred finding (§10.9), so stage 7 ends after at most one align
following the last touch.

**Producer-first.** Nodes and contracts are ordered so a producer comes
before its consumers. Node A precedes node B when B consumes a contract A
produces; contract X precedes contract Y when Y's producing node consumes X.
Producers and consumers are read from node specs' `Produces` and `Consumes`
fields and from contract front matter (`owner`, `consumers`), where a phase
id's node is the id without its trailing numeric segment
(`acme.backend.billing.2` belongs to `acme.backend.billing`). Ties keep the order of first mention in the root
spec, then in the parent spec. A cycle among the candidates is a `shape`
stop (`next.mjs` returns `stop`).

**Done** for a plan segment (`state.mjs done`): every stage is done; every
contract version above `v0`, each its own file (v0.10.0 §3.1), is
`status: stable` with `phase_ids: final`, except a `deprecated` or
`retired` one (this document exempts `v0`: an adopted contract, v0.10.0
§6.3, whose phases are not planned until promotion); the registries
regenerate clean; every cited ADR, contract, open-question and phase id
resolves; no `must-address` item is open; the ledger validates; and the
working tree is clean apart from `owner_files`. The final gate (F1) checks
the same list except the `report` stage and the clean tree, which only hold
after the report step's commit.

### 9.2 `intake`: one change request into a planned tree

| Stage | Steps | Done when |
|-------|-------|-----------|
| 0 Setup | `setup` | committed |
| 1 Plan | `plan` | committed |
| 2 Route | `intake` on the request | the intake record exists with its handoff block (§12.2) |
| 3 Handoffs | one step per handoff, in block order, each once every handoff in its `after` list is executed or skipped; a handoff whose `when` condition does not hold is skipped (§6.12) | every handoff is executed or skipped |
| 4 Consistency | as plan stage 7, without the align | no open item |
| 5 Align | an `align` on every leaf-parent that no step of this segment re-planned (§9.1's align condition), when that set is not empty | the align condition holds |
| 6 Report | `report` | committed |

**The segment's intake record** is the newest `H/management/*-intake-*.md`
whose `**Request:**` line names the segment's `request`, written by the
segment's `intake` step or, for a segment that continues an earlier one, by
that segment's.

A `structural` class is a `shape` stop inside the `intake` step itself
(§12.1), so no handoff has run when it fires. A `**Promotes:**` line is not a
stop there: the record orders a `promote` handoff first, and the `promotion`
stop is `hsdd-spec`'s, raised when that step runs. Collisions with open
intake records are resolved by
`hsdd-intake`'s own rules (serialize or merge), which are decisions, not
stops.

The record's **insert rule**, when it has one, says which findings add steps
(for example: a contract change that alters what a phase implements or
replays adds a `phase-plan-append` and a `reconcile` on that phase's node,
before the align). The orchestrator applies it through `insert-step` items,
each accepted by a `plan` decision that cites the rule.

**Done** for an intake segment: every stage is done; no `must-address` item
is open; every contract version above `v0` is `status: stable` with `phase_ids:
final` (§9.1); the
registries regenerate clean;
every cited id resolves; the ledger validates; and the working tree is clean
apart from `owner_files`. The intake record stays `**Status:** open` until
its phases ship (v0.10.0 §11.5); `hsdd-auto` never closes it.

### 9.3 When the request is a new version of a source

An intake whose request is a new version of a source document also moves
citations of the source, and one that supersedes a contract version (a
`lockstep` bump deprecates the old version in the run that drafts the next,
v0.10.0 §3.5) moves citations of that version. A `coexisting` bump moves
none: the old version stays live, and each consumer moves in a phase of its
own (§12.4). For a new source version the `setup` step updates `sources`:
the new version becomes normative or informative with its `version`, and the
old one moves to `baseline` with its own. It also updates the
`orchestrator_files` that name the normative source. Both are recorded
decisions. The intake record then routes one `citation-touch` per artifact
that may still cite a superseded string, with `when: cites-superseded`
(§12.2), after the content handoffs, and the touches follow §12.4. No touch
moves a contract version in a node header or an ADR's `affects`:
`hsdd-reconcile`'s version ripple writes a confirmed version into the
headers and the specs above them, and `hsdd-adr` adds the new version to
`affects`. So each leaf-parent the change lands on gets a
`phase-plan-append` and a `reconcile`, and a `spec-touch` only when its own
text changes.

---

## 10. The Scripts

Every script runs from the repository root as
`node hsdd/scripts/auto/{script}.mjs` (from the installed skill's `scripts/`
before the first copy, §4.3), reads `hsdd/auto/run.yaml`, and is a pure
function of the repository's state and its arguments, except for the files
it says it writes and the time it stamps. None calls a model.

### 10.1 `state.mjs`

```text
state.mjs [--json]     the run's state, as text or JSON
state.mjs done         whether the current segment is finished
state.mjs goal         a /goal line for hosts that have one (§11.4)
state.mjs upstream     every would_upstream decision in the ledger
state.mjs open-segment --mode plan|intake --instruction-file f.md
                       [--request <path> --authority <a>] [--stop-policy <p>]
                       opens a segment: branch, entry, opened_at (§5.5, §8.1)
```

The JSON has: `run`, `branch`, `head`; `segment` (`id`, `mode`,
`stop_policy`, `first_step`, and `ended`, true when the segment's last run
line carries a `note` starting `ended:`, §8.11); `steps` (`count`, `last`, and `in_progress`,
the step with a dispatch file but no judgement commit, with `has_report` and
`has_artifact_commit`); `stop` (the class and path when `STOP.md` exists);
`queue` (open items by kind); `tree` (`nodes`, `leaf_parents_without_plan`,
`pending_sections`, `contracts_not_final`, `unresolved_ids`); for an intake
segment `intake` (`record`, and each handoff with `executed`, `skipped` or
`pending`); and `next`, what `next.mjs` returns. The text form is what
`/hsdd-auto status` shows.

`done` prints each unmet condition of the mode's done definition (§9.1,
§9.2), one per line, and exits 1. When every condition holds it prints
`DONE {segment}` as its last line and exits 0. When `STOP.md` exists it
prints `STOPPED {segment}: hsdd/judgement/STOP.md` and exits 0.

`upstream` prints one line per ledger decision with `would_upstream: true`,
in id order: id, step, question and chosen label. An `intake` step runs it
instead of receiving the list in its prompt (appendix C.2a), since the list
grows with every segment.

`open-segment` checks out `branch`, creating it from `base` when it is
missing; computes the segment id in §5.5's forms (with the `-2`, `-3`
suffixes) and `first_step`, the next free step id (§7.2); stamps `opened_at`;
copies `request` and `authority` from the ended segment when the new one
continues it and the flags are absent; appends the entry with `lib/yaml.mjs`
and prints it. It refuses while a step is open or the current segment is
unfinished (§8.1). With `commit.mjs` it is the only script that changes git
state.

### 10.2 `next.mjs`

```text
next.mjs               what to do next, as JSON
next.mjs --stages      the mode's stages, each with "done": true or false
```

The result is exactly one of:

| Result | Meaning |
|--------|---------|
| `{"blocked": "hsdd/judgement/STOP.md"}` | The run is stopped. |
| `{"waiting": "S07"}` | A step has a dispatch file and no judgement commit; resume it (§8.9). |
| `{"step": {...}}` | The next step: `kind`, `skill`, `target`, `handoff`, `queue_item`, `continues` (each `null` when not applicable), `inputs` (the files the template will name), `write_set` (§7.3), `why` (the stage and the rule or item that selected it). |
| `{"skip": {"handoff": "H7c", "reason": "..."}}` | An intake handoff whose `when` condition does not hold; record it with `commit.mjs --skip`. |
| `{"stop": {"class": "shape", "reason": "..."}}` | A stage rule cannot order its candidates (a producer cycle). The orchestrator handles it in a `plan` step started with `dispatch.mjs --plan`: under `stop` with `shape` in the stop set it writes `STOP.md` naming the cycle and commits the step `stopped` (§8.3); otherwise it decides an order, records it, and opens and accepts one `insert-step` item per cycle member in that order, which `next.mjs` then returns before the stage rule. |
| `{"close": {"item": "Q-012", "why": "..."}}` | An open `must-address` or `consider` item targets `run` or the request path (plan stage 7, intake stage 4). The orchestrator handles it in a `plan` step (`dispatch.mjs --plan --for close`): it records the decision and closes the item with `routed.mjs close`. |
| `{"decide": {"item": "Q-013"}}` | An `insert-step` item is still `open` (a crash before its decision, §8.5). The orchestrator handles it in a `plan` step (`--for decide`): it records the decision and runs `routed.mjs decide`. |
| `{"stuck": ["unmet condition", ...]}` | No rule can make progress and the done condition fails. The orchestrator handles it in a `plan` step (§8.10). |
| `{"done": true}` | The segment's done condition holds. |

Selection, in order: `waiting`; the newest segment's `setup` step when its
entry has no `setup` commit, then its `plan` step when it has no `plan`
commit (so a segment opened by an owner's answer can remove `STOP.md`);
`blocked`; an `open` `insert-step` item (`decide`); a pending continuation
(§8.3); accepted, unaddressed `insert-step` items whose `after` is satisfied,
oldest first (§8.7); the current stage's rule (chapter 9), which yields
`step`, `skip`, `close` or `stop`; then `done` when the done condition holds,
else `stuck`. An item or a handoff named by the dispatch file of a stopped
step that no completed step continues is never returned on its own, only as
that step's continuation (§8.3). `next.mjs` never
allocates an id and never writes. Given the same repository state it always
returns the same result.

### 10.3 `dispatch.mjs`

```text
dispatch.mjs --next [--context-file f.md]
dispatch.mjs --plan --for stop|close|decide|stuck|owner|size|other [--result-file f.json]
dispatch.mjs --resume S07 --reason answer|finding --message-file f.md
dispatch.mjs --redispatch S07
```

`--next` runs `next.mjs` itself and refuses unless the result is `step`; it
allocates the step's id (§7.2),
takes `rendered_at` and `head`, renders the preamble (appendix B) and the
kind's step template (appendix C), and writes `hsdd/auto/dispatch/{step}.md`
with its front matter (§6.6). For a subagent step it prints the dispatch
file's path, a blank line, and the **launch prompt**, the only text the
orchestrator passes to the subagent:

```text
You are step {step} of an unattended HSDD run. Your complete instructions are
in {dispatch path}. Read the whole file first, then follow it exactly.
```

The orchestrator never retypes or edits the rendered prompt: the subagent
reads it from the file, which is also the audit record. For an orchestrator
kind (`setup`, `plan`, `report`) the file's body is empty and only the path
is printed.

**Size.** A dispatch file must come back whole from one file read (Claude
Code's Read tool returns at most 25,000 tokens in one call by default,
`CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS`; a longer file comes back as a
first page only, and a file over 256 KB is refused), so `dispatch.mjs`
checks the file's size in bytes after every write. At the densest plausible
tokenization, about three bytes per token, 64 KiB stays under 22,000 tokens. Above 32 KiB it prints a warning listing each slot's rendered
size, largest first. Above 64 KiB it writes nothing and refuses with the same
list; a refused `--next` allocates no id. When `{context_lines}` is among the
largest slots, the orchestrator shortens its context file and runs `--next`
again. Any other refusal of `--next` or `--redispatch` is a hard stop
(§8.2): the orchestrator records it in a `plan` step and writes `STOP.md`
with the list. `--resume` refuses a message that would take the file over
the limit, and the orchestrator shortens the message. The fixed text of the
preamble and a step section is about 9 KiB; the slots that would otherwise
grow with the run are bounded where appendices B and C define them.

**Facts come from files.** Every fact a template states about the tree is
filled by `dispatch.mjs` from the repository (appendix C.2), each line
ending in the path it was read from. The orchestrator may add context
through `--context-file`, but each non-empty line of that file must carry at
least one citation token (a repository path containing `/`, a commit sha of
seven or more hex digits, a step id, a decision id, a queue id, or a source
citation `{cite} §{n}`); `dispatch.mjs` refuses the file and names the line
otherwise. Every rendered prompt tells the subagent to check any stated fact
it relies on against the file it cites before acting.

`--plan` starts an orchestrator `plan` step outside the stage order, for a
`stop`, `close` or `stuck` result of `next.mjs`, an owner message (§8.11), a
size refusal (above), or any other decision taken while no step is open: it
allocates an id and writes a dispatch file with kind `plan` and the segment
as target, whose body records `--for` and the `next.mjs` result in
`--result-file` (an orchestrator step has no read check, so its body may
carry them), so a recovery knows what the step was opened for (§8.9). In it
the orchestrator records its decisions, may open, accept, reject or close
queue items or write `STOP.md`, and commits it like any other step,
`stopped` when it wrote `STOP.md` (§8.3).

`--resume` appends a `resume-answer` or `resume-finding` launch, appends
`## Resume {n}` with the message to the dispatch file's body, and prints the
message to send to the subagent; the message names the report file
`{step}.r{n}.json`. `--redispatch` appends a `redispatch` launch, adds a
`## Redispatch` section that lists the files the lost launch changed
(`git status`) and states that earlier `## Resume` sections are history and
the report goes to `{step}.json` (§8.6), and prints the launch prompt.

### 10.4 `decide.mjs`

```text
decide.mjs --step S07 [--by subagent|orchestrator|owner] [--type <decision type>]
           (--stdin | --file d.json)
```

Reads one decision object with the fields of §6.2 except `id`, `at`,
`segment`, `step`, `step_ref`, `by` and `commit` (supplying any of them is an
error), and refuses a `--step` whose judgement commit exists (§8.5). Then,
holding the lock file `hsdd/auto/.decide.lock` (created exclusively, removed
after; a lock older than 60 seconds is replaced, and A1 ignores the file):

1. **Mints the id:** one more than the highest id in `decisions.jsonl` and
   in every `hsdd/auto/steps/*.decisions.jsonl`.
2. **Stamps `at`** with the current UTC time at second precision.
3. **Sets `by`** (default `subagent`) **and the type:** `--type` when given;
   otherwise, for `subagent`, the step kind's decision type from the
   dispatch file (§7.1); for `orchestrator` and `owner`, `setup` in a `setup`
   step and `plan` elsewhere.
4. **Validates** against appendix A.2's `sidecarDecision`, plus: `chosen`
   is an option's label; `stop_class` is set exactly when
   `would_have_asked` is true; `blast_radius: upstream` implies
   `would_upstream: true`.
5. **Appends** the line to `hsdd/auto/steps/{step}.decisions.jsonl` and
   prints `{id} at {at}`.

It is the only way a decision gets an id or a time, so a decision's id is
known the moment it is taken and can be cited in a resume message,
`STOP.md`, `predecided`, or a queue event.

### 10.5 `ledger.mjs`

```text
ledger.mjs decisions --step S07 --commit <sha>
ledger.mjs run --step S07 --commit <sha> --status completed|stopped
           [--model <id>] [--usage-file u.json] [--note "..."]
ledger.mjs validate
ledger.mjs next-id
```

`decisions` reads the step's sidecar and appends each line to
`decisions.jsonl` in id order, adding `segment`, `step_ref` and `commit`.
`run` appends the run line (§6.3), taking `started`, `dispatches`,
`continues` and the step's identity from the dispatch file and `finished`
from the artifact commit. Both are called by `commit.mjs`. `next-id` prints
the id `decide.mjs` would mint.

`validate` checks the ledger and the run log:

- each line against its schema;
- ids unique and increasing in file order (a gap is a warning: an id minted
  and never committed);
- `chosen` is an option's label; `stop_class` set exactly when
  `would_have_asked` is true; `upstream` blast radius implies
  `would_upstream`;
- every `commit` exists; no `at` lies in the future;
- every `at` is at or after its segment's `opened_at`;
- every `subagent` decision's `at` lies in its step's window, from the
  dispatch file's `rendered_at` minus 60 seconds to the artifact commit's
  time plus 60 seconds; an `orchestrator` or `owner` decision's `at` lies
  between its step's `rendered_at` minus 60 seconds and the next step's
  `rendered_at`, or the time of validation when no later step exists.

**Legacy lines.** A ledger line without `segment` is a legacy line from a
hand-built run that used this record's earlier shape: the fields of §6.2
without `segment`, `by` and `model`, with `at` allowed to carry a numeric
zone offset. Legacy lines are validated against that shape, their times are
not window-checked, and every legacy line yields one warning in total, not
one per line. A run log line without `segment` is legacy in the same way.

### 10.6 `gate.mjs`

```text
gate.mjs --step S07     the step gate, before the artifact commit
gate.mjs --step S07 --check B5,B6
                        only the named checks, whatever the step's status
gate.mjs --final        the segment's final gate
```

The step gate reads the step's dispatch file for its kind, target, write set
and `head`. Each check has an id; the output is one `warn  {id} {message}`
or `ERROR {id} {message}` line per finding, then
`gate: {e} error(s), {w} warning(s), {n} changed file(s)`. Exit 0 when there
is no error.

**Scope.** The C checks always run over the whole tree. In the step gate a
C finding is an error when its file is one the step changed, and a warning
otherwise. In the final gate it is an error when its file changed during the
segment (since the segment's `setup` commit), and a warning otherwise. A
tree's pre-existing defects therefore never block a step that did not touch
them. C5, C6 and C7 read `H/spec`, `H/contract` and `H/adr` only;
`H/management`, `H/auto` and the dispatch files may name old versions and
ids as history. A C finding's file is the file the check names: for C3, the
`affects` target's file, not the ADR's. The stage logic C3 and C5 rely on
is imported from `next.mjs`.

| Id | Check | Level |
|----|-------|-------|
| A1 | Every changed or untracked path is in the step's write set, its report files or sidecar, `experiments_dir`, the judgement set (§6.11), or `owner_files`; `hsdd/auto/.decide.lock` is ignored. A path on the never list (§7.3) is reported as forbidden. | error |
| A2 | Every owner file matches its hash in `owner-files.json`. | error |
| A3 | `hsdd/scripts/auto/` is the current copy (§4.3); `H/scripts/gen-registry.mjs`, when present, is byte-identical to `hsdd-contract`'s bundled copy under `skills_dir`. | error |
| A4 | `HEAD` is the dispatch file's `head`, and the index is empty: the step committed and staged nothing. | error |
| B1 | The step's report files of the current series (§8.6) exist and validate against appendix A.4, and its sidecar, when present, against A.2's `sidecarDecision` (a step with no decisions has none). | error |
| B2 | Every `subagent` decision in the sidecar has an `at` between the dispatch file's `rendered_at` minus 60 seconds and now plus 60 seconds. | error |
| B3 | Every queue item that matched the step (§6.5) and was open at the dispatch file's `rendered_at`, which is the set its prompt listed, appears in the `closes` of the union of the step's current report files. | error for `must-address`, warning for `consider` |
| B4 | `reads_outside` is empty. | warning |
| B5 | The step's latest report of the current series (the newest by launch order: `{step}.r{n}.json` with the highest `n`, else `{step}.json`) has a `read_check` equal to the value on its dispatch file's last line (§6.6). | error |
| B6 | The dispatch file is at most 32 KiB (§10.3). | warning |
| C0 | Contract files (`H/contract/*.md` except `INDEX.md`) exist and `H/scripts/gen-registry.mjs` does not. | error |
| C1 | When the generator exists, `node H/scripts/gen-registry.mjs --root {tmp}` on a temporary copy of `H/` exits 0 and writes registries byte-identical to the tree's, so the gate itself never writes into the tree. | error |
| C2 | Every node spec has a `# {node-id}: {Name}` title matching its file name and a `Kind` field; every child id its `Decomposes into` names has a spec file (a value that is empty or starts with `phases` names none). | scoped |
| C3 | Every ADR file has front matter with `id`, `status`, `affects` and `date`; every cited `ADR-{nnn}` has a file, or is one a plan-mode stage rule, or a not yet executed intake handoff of kind `adr`, will create (warning); every `affects` target that has a file carries a `Governed by` that names the ADR (a node or phase in its header; a contract in the optional front-matter field `governed_by`, §15.3); a target with no file yet is a warning, `hsdd-adr`'s forward reference. | scoped |
| C4 | Every contract file (`H/contract/*.md` except `INDEX.md`), one per version (v0.10.0 §3.1), has front matter with `id`, `version`, `status`, `kind`, `owner`, `produced_by`, `consumers` and `phase_ids` (`compatibility` is optional, v0.10.0 §15.1); its file name is its `id`, or, for a later version (a file with the same `id` holds a lower version), `{id}.v{n}` with `v{n}` its `version` (a later version written before 0.10.2 under a name of another form stands, v0.10.0 §15.1); no two files have the same `id` and `version` (each is reported); `status: stable` implies `phase_ids: final` except at `version: v0` (an adopted contract, v0.10.0 §6.3); a `stable` file without `validation: grandfathered` names, in `## Validation`, a schema or fixture path that exists and is not an empty directory (a `draft` without one is a warning). | scoped |
| C5 | Every `{slug}@v{n}` citation names a version a file of that contract `id` holds, whatever its status, or a version below the current one (the highest a file holds) that the current file's `## Versioning` names (the history of a bump in place before 0.10.2); a contract a plan-mode stage rule, or a not yet executed intake handoff of kind `contract`, will create is a warning, and so is a version a not yet executed handoff of kind `contract` on `{id}.v{n}` will create. | scoped |
| C6 | Every open-question id is defined once, as a heading in one spec, and every citation of one resolves. | scoped |
| C7 | Every phase id a contract file's `produced_by` or `consumers` names is a phase heading in its node's spec file, in the full form or the short `{n}.{i}` form (v0.10.0 §7.5). | scoped when the file's `phase_ids` is `final`, else warning |
| C8 | An intake record's slug contains none of `progress`, `execution-plan`, `milestones`, `atlas`; its header has every field of v0.10.0 §11.2; its handoff block (§12.2), when present, parses against appendix A.7, and each handoff's `prompt` appears verbatim in the `## Routing` prose, in the block's order. In an `intake` step the block is required, and may be empty only when `**Class:**` is `structural`. | scoped |
| D1 | No changed write-set text file contains a banned character or phrase, with §7.6's exemptions (step reports, sidecars, a segment report's generated parts, `H/conventions.md`, the bundled copies under `H/scripts/` and `.claude/`); a segment report's prose slots are checked. | `prose_rules.level` |

Which checks run depends on the step and its status: a `completed` subagent
step runs A, B, C and D; a `completed` orchestrator step runs A1 to A3, C
and D, and the `report` step also runs the final gate; a `stopped` subagent
step runs A1 to A4, B1 and B5 (B1 and B5 skipped under `--no-report`,
§10.7); a `stopped` orchestrator step runs A1 to A3. For a stopped step A2
is a warning: only the owner can restore an owner file, so the run line's
`note` and `STOP.md` name it (§10.7).

The final gate runs C0 to C8 over the whole tree with the final scope, then:

| Id | Check | Level |
|----|-------|-------|
| F1 | Every condition of the mode's done definition (§9.1, §9.2) holds, except the `report` stage and the clean working tree. | error |
| F2 | References to a superseded contract version (§12.2: `deprecated` or `retired`, or with no file of its own), outside that contract's own files (every version file of its `id`, and the cited version's schema and fixtures): one line per file and version, with a count. Dated history may name old versions on purpose (§12.4); the report states the count and that each was read. | warning |
| F3 | `ledger.mjs validate` passes. | error |
| F4 | No `must-address` item is open, and no `insert-step` item is still `open` (undecided). | error |
| F5 | `H/contract/INDEX.md` lists every contract slug the specs name. | error |
| F6 | The segment report exists and every prose slot in it is filled. | error |

### 10.7 `commit.mjs`

```text
commit.mjs --step S07 --status completed|stopped [--summary "one line"]
           [--model <id>] [--usage-file u.json] [--note "one line"]
           [--discard <path>]... [--no-report]
commit.mjs --skip H7c --reason "one line"
```

For a step, in order:

1. **Resume detection.** When `HEAD`'s subject is this step's artifact
   commit (§6.11) and no judgement commit follows it, skip to step 4. When
   the index is not empty and `HEAD` equals the dispatch file's `head`, a
   run crashed after staging: unstage everything (`git reset`) and go on.
2. **Gate** per §10.6 for the step's kind and status; on an error, print
   the findings and exit 1 having committed nothing.
3. **Artifact commit.** Stage exactly the changed paths inside the write
   set and `experiments_dir`, never an owner file and never with
   `git add -A`, and commit (§6.11), with `--allow-empty` when nothing
   changed. A `stopped` step's partial artifacts are committed this way so
   the tree is clean. With `--discard`, each named path outside the write
   set is first restored to `HEAD` (`git checkout --`), or removed when
   untracked, so a step that failed A1 twice can be committed `stopped`; the
   run line's `note` lists the discarded paths, and the orchestrator records
   a `plan` decision naming each. An owner file a step changed (A2) is never
   restored by the run: the step is committed `stopped` with the file left
   in place and out of the commit, and `STOP.md` names it, a hard stop.
   With `--no-report` (a `gate-twice` raised by B1 or B5, §8.6) the gate
   skips B1 and B5, the report series is renamed
   `{step}.invalid{k}[.r{n}].json`, and the run line's `note` says
   `no valid report`.
4. **Records.** `ledger.mjs decisions`; `routed.mjs ingest`; for a
   `completed` step with a `queue_item`, mark that item `addressed` (`by` the
   step, `note` "step {id} committed"); `ledger.mjs run`. Each append
   skips a line already present (a decision by id; an `open` queue line by
   `from`, `kind`, `target` and `text`, since a report carries no item id;
   any other queue event by id and status; a run line by `step_ref`), so a
   rerun after a crash inside this step, or the review's earlier ingest
   (§8.5), adds nothing twice.
5. **Plan.** Regenerate `plan.md`'s step log (§6.9).
6. **Judgement commit.** Stage the judgement set and commit.
7. Print both commit shas.

The artifact commit's `{summary}` is `--summary` when given, else the
report's first `notes` entry cut to 72 characters, else `no summary`; for an
orchestrator step without `--summary` it is the segment id.

It refuses to run when a changed path lies outside the write set, the
step's report files and sidecar, `experiments_dir`, the judgement set and
the owner files; when the current branch is not the run's; or when the
step's report opened an `insert-step` item still `open` (§8.5). It never
amends, rebases, squashes or pushes.

`--skip` appends the `handoffs.jsonl` line (§6.12), regenerates the step
log, and makes the skip commit (§6.11). It refuses when the handoff's
condition holds or the handoff already has a step or a committed skip line;
an uncommitted skip line for the handoff is a crash after the append, and the
rerun makes the commit.

### 10.8 `routed.mjs`

```text
routed.mjs ingest --step S07
routed.mjs open --from S07 --target <id> --kind must-address|consider|insert-step --text "..."
                [--step-kind <kind> --step-target <id>] [--after <handoff id>|handoffs]
routed.mjs close Q-012 --addressed|--explained --by S07 --note "..."
routed.mjs decide Q-012 --accepted|--rejected --decision DEC-0nn
routed.mjs list [--target <id>] [--open]
```

`ingest` opens one item per `routed` entry of the step's report files and
records each `closes` entry. `open` lets the orchestrator raise an item.
`close` lets the orchestrator close a `must-address` or `consider` item that
targets `run` or the request path, in a `plan` step (§10.2). `decide`
records the outcome of an `insert-step` item. `list` prints items in their
current state. Item ids are `Q-001` onward. The module also exports the
matching rule of §6.5, which `dispatch.mjs` and `gate.mjs` use.

### 10.9 `report.mjs`

```text
report.mjs --segment <id>
```

Writes `{report_dir}/{segment}.md` from `templates/report/{mode}.md`.
Generated parts are rebuilt on every run; prose slots
(`<!-- slot:{name} -->` to `<!-- /slot -->`) are left for the orchestrator
and kept across re-runs. Both modes have, in order:

1. **Outcome** (slot): the result in three to five sentences, answer first.
2. **What changed:** for an intake, a slot plus a generated table of every
   handoff with its step (or "skipped" and the reason), kind, target and
   artifact commit; for a plan, a generated table of the tree with one row
   per node: kind, phase count, contracts produced and consumed.
3. **Decisions to look at first** (generated): every `would_have_asked`
   decision, then every `low`-confidence, `tree` or `upstream` decision, then
   every `setup` decision; one row each with id, step, the question cut to
   one line, and the chosen label.
4. **Upstream** (generated): every `would_upstream` decision with its
   question, choice and evidence. An intake report adds a slot, **Earlier
   proposals read against the request**, filled from the intake step's
   `notes`: which earlier `would_upstream` decisions the request adopted,
   contradicted or left open.
5. **Every decision by blast radius** (plan mode, generated): one line each.
6. **Experiments** (generated): each directory with its README's first line.
7. **Assumptions about the owner's intent** (slot).
8. **Record gaps** (generated, then a slot): decisions outside their step
   window, resumed, re-dispatched and stopped steps and why, continuations,
   `reads_outside` entries, inserted and skipped steps, and the final gate's
   warning count.
9. **Deferred findings** (generated): `consider` items still open,
   `insert-step` items rejected (with the decision id), and align findings
   not reopened (§9.1).
10. **How to review** (fixed text): read the report, then the decisions
    under item 3 in the ledger; record one line per decision in
    `hsdd/judgement/decision-reviews.jsonl` (§6.8); each step is two
    commits, `{artifact}: {step} ...` then `{judgement}: {step}`.

For an intake segment the `report` step also appends to the intake record's
`## Produced` the contracts bumped (`id@v`), the ADRs amended and the nodes
grafted, and one change-log line. A contract `id` counts as bumped when its
current version is above the highest version any of its files held at the
setup commit: a later version in a file of its own (v0.10.0 §3.1), or a bump
in place; an `id` with no file then is new, not bumped. This is the hand append `hsdd-intake`'s
template allows for grafts and bumps; §15.3 adds the report step to the
conventions template's writers of `hsdd/management/`. Phases are not
appended: `hsdd-checkpoint` appends them from their Scope citations (v0.10.0
§11.2).

`report.mjs --segment` covers the named segment and every earlier segment of
the run that has no report (one ended by an owner message or a stop, §8.3,
§8.11): the Outcome slot says so, and the generated sections draw from all
of them.

---

## 11. The Claude Code Adapter

The skill and its scripts run on any agent host that can launch a subagent
with a prompt. The adapter adds what only the host can enforce: reads of
out-of-bounds paths and writes to read-only paths, refused before they
happen. Without it those rules are instructions in every prompt, as in FT-3,
and the gate still catches every write after the fact.

### 11.1 What `adapter.mjs install` writes

`adapter.mjs install [--stop-hook]` merges into the project's
`.claude/settings.json`, keeping every entry already there, and records each
value it added in `hsdd/auto/adapter.json` (schema: appendix A.10) so
`adapter.mjs uninstall` removes exactly those and nothing else.

**Permission deny rules.** For each `out_of_bounds` path, a `Read(...)` rule;
for each `read_only` path, an `Edit(...)` rule. The host's rule syntax is
gitignore-style, and the script translates the owner's path forms:

| Owner writes | Rule path |
|--------------|-----------|
| An absolute path `/a/b` | `//a/b/**` (a double slash is the filesystem root; a single leading slash would anchor to the project) |
| A home path `~/a/b` | `~/a/b/**` |
| A project path `a/b` | `/a/b/**` (anchored to the project root, so it does not match `a/b` at any depth) |

A glob the owner wrote is kept as written, with `/**` appended when it does
not end in `**`, so a directory glob also denies the files under it;
`adapter.mjs check` tries a file under such a path (§11.3). `Write(...)`
rules are not
written: the host does not consult them, and `Edit(...)` rules govern every
file-writing tool. A `Read` deny also blocks edits of the same path. The
host applies `Read` denies to its search tools on a best-effort basis and to
recognized shell file commands (`cat`, `head`, `tail`, `sed`, `tee`,
redirections), but not to arbitrary subprocesses; the hook below and an
operating-system sandbox close what remains. Deny rules apply to the
subagents the session launches.

**A Bash PreToolUse hook.** One entry under `hooks.PreToolUse` with matcher
`Bash` and the command
`node "${CLAUDE_PROJECT_DIR}/hsdd/scripts/auto/hook-bash.mjs"`. The hook
reads the event JSON on stdin and takes `tool_input.command`. It blocks the
call, with exit code 2 and the reason on stderr (which the host returns to
the agent), when:

1. the command text names an `out_of_bounds` path in its owner form, its
   absolute form or its `~` form, or a path a glob in the list matches;
2. the command writes to a `read_only` path by redirection or a file command
   (`>`, `>>`, `tee`, `cp`, `mv`, `rm`, `sed -i`, `touch`);
3. the event carries `agent_id` (the call comes from a subagent) and the
   command changes git state: `git` with `commit`, `add`, `rm`, `mv`,
   `reset`, `checkout`, `switch`, `restore`, `stash`, `rebase`, `merge`,
   `cherry-pick`, `revert`, `push`, `tag` with an argument, `branch` with any
   argument other than `--list`, `-a`, `-r`, `-v`, `-vv` and
   `--show-current`, or `update-ref`.

Otherwise it exits 0 with no output. The hook matches text, so it cannot see
a path a program computes at run time; the gate and the sandbox are the
backstops. The host documents `agent_id` as present when the hook fires
inside a subagent, and its examples omit it for the main session; the
orchestrator in any case changes git state only through `commit.mjs` and
`state.mjs open-segment`, whose command text names no git subcommand, so rule
3 never matches them.

**A step agent type.** `.claude/agents/hsdd-auto-step.md`, with front matter
`name: hsdd-auto-step`, a `description`, `model` from `run.yaml`'s
`models.step` when set, and a `tools` allowlist of the file, search, shell
and skill tools a step needs, with the agent-launching tool left out and
also named in `disallowedTools`: the host otherwise lets a subagent start
subagents of its own, three levels deep, and a step must not. The
orchestrator launches every step with this agent type.

**An optional SubagentStop hook.** With `--stop-hook`, an entry under
`hooks.SubagentStop` runs `hook-subagent-stop.mjs` when a subagent ends. It
reads the subagent's own transcript path from the event's
`agent_transcript_path` (`transcript_path` is the main session's), finds the
dispatch path
in the subagent's first message (the launch prompt of §10.3), and when the
dispatch file's `report` is missing or fails appendix A.4, it blocks the stop
with the reason "Write your report to {path} before ending"; when the
latest report's `read_check` differs from the dispatch file's last line (B5), it
blocks with "Read {dispatch path} to its end, then correct your report".
The host then gives the subagent that reason as its next instruction. Any other subagent,
or a missing or unreadable transcript, exits 0.

### 11.2 Isolating memory

Agent hosts keep per-project memory and transcripts outside the repository,
where an out-of-bounds rule must name them. Two ways, in order of strength:

- Launch the orchestrating session with `CLAUDE_CONFIG_DIR` set, in the
  shell that starts the host, to a directory used only for the run. User
  settings, transcripts and per-project memory then live under that
  directory, and other projects' memory is outside the session's tree. The
  variable cannot be set from project settings.
- Otherwise list the memory paths in `out_of_bounds`
  (`~/.claude*/projects/*/memory`), which installs read denies and the hook
  rule.

### 11.3 Checking the adapter

`adapter.mjs check` verifies that every rule the configuration implies is in
`.claude/settings.json`, that the hook commands point at the current copy,
and runs `hook-bash.mjs` on sample events: a `cat` of each out-of-bounds path
in each of its forms must exit 2; `ls` of the project root must exit 0;
`git commit -m x` with an `agent_id` must exit 2 and without one exit 0;
`git branch new-name` with an `agent_id` must exit 2. Every `setup` step runs
the check and records a failure as a `setup` decision: fix it, or proceed
with the rule as an instruction only.

### 11.4 The `/goal` condition

Claude Code's `/goal` keeps a session working until a condition holds,
judged after each turn by a small model that sees the conversation but
cannot read files or run commands. The condition must therefore be something
the orchestrator prints. `state.mjs goal` prints, for the current segment:

```text
/goal The hsdd-auto segment {segment} is finished: the last message shows the
output of `node hsdd/scripts/auto/state.mjs done` ending in the line
"DONE {segment}" or "STOPPED {segment}: hsdd/judgement/STOP.md". Stop if 20
turns pass without a new judgement commit being reported.
```

The orchestrator's final message of a segment always includes
`state.mjs done`'s output (§8.10). The goal is optional: the loop needs no
external nudge when the host delivers hand-backs.

---

## 12. Changes to the Existing Skills

All changes are additive. Each skill behaves exactly as in v0.10.0 unless it
is invoked with the unattended flag, except where a section below says
otherwise.

### 12.1 The unattended-mode contract

`hsdd-spec`, `hsdd-adr`, `hsdd-contract`, `hsdd-phase-plan`,
`hsdd-reconcile` and `hsdd-intake` each gain a section `## Unattended runs`,
placed immediately before the skill's quality-gate section
(`## Quality Gates`; in `hsdd-phase-plan`, `## Phase Design Checklist`),
with this text and the skill's own table:

> When your arguments contain `--unattended {step}`, you run as step
> `{step}` of an `hsdd-auto` run, and your dispatch file
> `hsdd/auto/dispatch/{step}.md` names your report. Then:
>
> 1. At each ask point in the table below, act on its disposition.
>    `return`: write your report with `status: "stopped"` and a `stop`
>    object (the question verbatim, the rule of this skill that requires it,
>    the stop class, the options with their consequences, your
>    recommendation, what it blocks), leave your partial artifacts in place,
>    and end your turn. Never answer it yourself. `decide`: take the decision
>    and record it with `would_have_asked: true` and the class the table
>    gives, or `false` where the table gives none, unless a careful engineer
>    would have asked the owner first: then `true` with class `judgement`.
> 2. Record every decision when you take it, with
>    `node hsdd/scripts/auto/decide.mjs --step {step} --stdin` and the
>    decision as JSON in the shape your dispatch file shows. Never write a
>    time or an id yourself.
> 3. Do not invoke interactive companion skills such as brainstorming; the
>    run's decision policy replaces their dialogue.
> 4. Copy each of this skill's quality gates (for `hsdd-phase-plan`, the
>    items of its Phase Design Checklist) verbatim into the report's
>    `self_check`, with `pass`, `fail` or `n/a` and a note. A gate that
>    requires a human act (the human confirmed, decided or stated) is `n/a`,
>    and its note names the decision that stood in for that act. So is a
>    gate that a give-way rule of the table below overrides, its note naming
>    the decision that applied the rule, and a gate whose subject this step
>    did not touch, its note reading `not exercised by this step`.
> 5. A predecided answer in your dispatch file for a class in the table
>    replaces the `return` for that class: apply it, record your decision
>    citing the predecided decision's id, and continue. The exception is a
>    breaking change under `compatibility: frozen` or at `v0`, which you
>    report as a run-stop candidate whatever the predecided answers say
>    (§8.2).
> 6. Where the table says a rule of this skill gives way, the recorded
>    decision replaces the human act that rule requires, and the owner's
>    later review of that decision is the act.

The tables:

**`hsdd-spec`**

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| "Who builds what?" when no owner fact or `**Teams:**` line answers it | return; when `axis` is not in the run's stop set, decide (the rule "ownership stated by the human" gives way) | `axis` |
| A decomposition-changing unknown: two defensible shapes, nothing gives one a stated reason to lead (this covers the skill's one clarifying question) | return | `shape` |
| Promotion confirmation | return | `promotion` |
| Accepting a proposed ADR, the ordering policy, the coding method, teams mode, a decomposition the sources imply | decide | `judgement` when a careful engineer would ask |
| Resolving an open question; a resolution that changes a read-only source sets `would_upstream` | decide | `judgement` or `upstream` |

`hsdd-spec` also gains a paragraph **Touch**, since its modes (root,
internal node, promotion, graft, retirement) have no name for a bounded edit:
"Invoked as `touch {node}: {reason}`, change only what the invocation and the
routed items name, in the node's own file and, when named, the parent's
embedded summary of it. Never edit the node's `## Phase Plan`, except under
the Citation touch paragraph; keep every id, the heading rule and the
section order; record each change as a decision." The `spec-touch` kind
(§7.1) invokes it.

Three more lines for `hsdd-spec`: its `## Sources` authority list gains
`incident`; promotion mode's confirmation stop asks one fixed question,
"Promote `{node}` from as-built to governed with this decomposition?", which
an unattended run returns verbatim; and its gate phrase "informative only,
not decomposed" is matched on its words, whatever separator the project's
prose rules put between them.

**`hsdd-adr`**

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| Materializing an ADR whose decision no human stated | decide: write it `accepted`, its `## Context` citing the decision id (the rule "never write invented content as `accepted`" gives way) | `judgement` |
| Superseding an `accepted` ADR | decide | `judgement` |

`hsdd-adr`'s Bidirectional Linking gains "a contract carries the link as the
front-matter field `governed_by: [ADR-NNN, ...]`" (§15.3), and the skill
gains a paragraph **Amendments**: "An in-place change that keeps the decision
adds an entry `- {YYYY-MM-DD}: {what changed and why}` under
`## Amendments` at the end of the file; `status`, `date` and the numbering of
items are unchanged. A changed decision supersedes instead." The
`adr-update` kind (§7.1) uses both.

**`hsdd-contract`**

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| A breaking change to a `stable` contract under `compatibility: versioned` | return. The skill applies its versioning rule itself, so this stop is the section's own: `skill_rule` quotes its sentence "under an unattended run, a breaking change to a `stable` contract under `compatibility: versioned` is returned to the orchestrator" | `breaking-amend` |
| A breaking change to a `frozen` contract, or to a `v0` contract | report it as a run-stop candidate; no predecided answer applies (a frozen contract takes a new contract, a `v0` one a redesign) | `breaking-amend` |
| A breaking change to a `draft` contract | decide between `v{n+1}` with a migration note and a change in place with a `## Versioning` line (the rule "a breaking change creates `v{n+1}`" gives way for drafts) | `judgement` |
| Interface and guarantee choices the sources leave open | decide | `judgement` when a careful engineer would ask |

`hsdd-contract`'s template gains: the front-matter field `governed_by`
(§15.3); guarantee ids, each bullet under `## Guarantees / invariants`
opening `G{n}:`, so fixtures and phase gates can cite one; and a `Breaking:`
line under `## Versioning` naming what counts as breaking for this contract.
Under an unattended run its gate "the block changed in any commit that added
fixtures to it" reads "in this step's changes".

**`hsdd-phase-plan`**

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| A gap in a consumed contract that changes which phases exist or what they produce | return | `shape` |
| A contingency on a question with no minted id | return | `procedural` |
| The node still contains subsystems (the skill's precondition) | return, routing an `insert-step` of kind `mid-level-spec` on the node | `procedural` |
| A gap that does not change the plan's shape | decide: record a `request` entry with its assumption | none |
| Tier, gate and sizing choices | decide | none |

`hsdd-phase-plan`'s Append Mode gains: "When the invoking prompt names an
unshipped phase, append mode may rewrite it in place; the phase keeps its id,
and the new emission date line of the pending section names the rewrite."

**`hsdd-reconcile`**

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| A collision | return | `collision` |
| An `amend` or a `request` answer that breaks a consumer of a `stable` contract under `compatibility: versioned` (`frozen` or `v0`: a run-stop candidate, §8.2) | return | `breaking-amend` |
| The same for a `draft` contract | decide (the rule that it "goes to the human" gives way for drafts) | `judgement` |
| A `request` answer that breaks no consumer | decide (the rule "resolve `request` entries with the human" gives way) | `judgement` |
| Step 5's cross-cutting answer for `hsdd-adr`; step 7's `hsdd-contract` step for a missing validation artifact | route an `insert-step` (`adr` or `adr-update`; `contract-touch`), and never write the ADR or the artifact yourself | none |

No step kind invokes reconcile's grandfather marking, discharge or retirement
(its steps 8 and 9), so their inputs never arise in a run.

**`hsdd-intake`**

| Ask point | Disposition | Class |
|-----------|-------------|-------|
| Class `structural` | return | `shape` |
| A landing on an as-built node | decide: write the `**Promotes:**` line and order a `promote` handoff first (§9.2); the `promotion` stop is `hsdd-spec`'s, in that step | none |
| Serializing or merging with an open intake | decide | `judgement` |

When the orchestrator answers a `return` (§8.3, case B), the resumed step
applies the answer, and the quality gate that names the human act is `n/a`
with the orchestrator's decision id.

### 12.2 `hsdd-intake`: the handoff block

The intake record's `## Routing` section may carry, after its prose, one
fenced block with the info string `hsdd-handoffs` holding JSON (appendix
A.7):

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
- `kind`: a subagent step kind of §7.1 except `intake`; `skill` the one
  §7.1 gives it; `target` in the form §6.5 gives for that kind:

  | Kind | Skill | Target |
  |------|-------|--------|
  | `mid-level-spec`, `graft`, `promote`, `spec-touch` | `hsdd-spec` | a node id |
  | `adr`, `adr-update` | `hsdd-adr` | an ADR id |
  | `contract`, `contract-touch` | `hsdd-contract` | a contract slug (its `id`; `{id}.v{n}` names one later version, v0.10.0 §3.1) |
  | `citation-touch` | by the file: `hsdd-spec`, `hsdd-adr` or `hsdd-contract` | a node id, ADR id or contract slug |
  | `phase-plan`, `phase-plan-append` | `hsdd-phase-plan` | a leaf-parent's node id |
  | `reconcile`, `align` | `hsdd-reconcile` | node ids, comma-separated, or `all` |
- `prompt`: the exact handoff prompt, as the record's prose gives it.
- `when`: `null` (always dispatched) or `cites-superseded`.
- `after`: handoff ids that must be executed or skipped first. An empty list
  means "after the previous handoff in the list"; the first handoff waits on
  nothing.
- `insert_rule`: optional, plain text; the orchestrator applies it (§9.2).

**`cites-superseded`** holds when any of the target's files contains a
superseded string. The superseded strings are: for every `baseline` source
in `run.yaml`, its `path` and its `version`; and for every contract `id`
whose current version, the highest any file of that `id` holds (v0.10.0
§3.1), is `v{n}` with `n` above 0, each `{id}@v{k}` with `k` below `n` that
is superseded, followed by a character that is not a letter, digit, `_` or
`-`, or by the end of the text. A lower version with a file of its own is
superseded only when that file is `deprecated` or `retired`: under
`coexisting` it stays `stable` while it has a live consumer (v0.10.0 §3.5),
and a citation of it is live. A lower version with no file of its own lives
only as history inside a later file (a bump in place, before 0.10.2) and is
superseded. A version's own files (its contract file, schema and fixtures)
describe it, so `{id}@v{k}` in them is no superseded string. The target's
files are: for a contract `id`, every version's file with its schema and
fixtures (`H/contract/{slug}.md`, `H/contract/fixture/{slug}/**` and
`H/contract/schema/{slug}.schema.json` for the first version, `{slug}.v{n}`
in place of `{slug}` for a later one); for `{id}.v{n}`, that version's
files; for an ADR, its file; for a node, its spec file. The match is
textual and counts history too: a target whose only old-version mentions
are history is still dispatched, and its touch keeps them (§12.4).
`next.mjs` evaluates the condition when the handoff comes up, not when the
record is written.

The block is optional, and its absence keeps a record conformant (v0.10.0
§15.3). `hsdd-intake` writes it whenever it runs with `--unattended`, and may
write it otherwise. The skill gains a section **Handoff block** carrying this
subsection: the example, the field rules, the kind table and the meaning of
`cites-superseded`, so a step needs no other text to write it. A
`structural` record's block has an empty `handoffs` list, since its handoffs
are the owner's decision; the continuation after the answer (§8.3)
re-classifies the request, rewrites `## Routing` with the handoffs and the
block, and logs the change in `## Change log`. The prose stays authoritative for people; the block must
say the same thing: the prose quotes each handoff's prompt verbatim, in the
block's order, and `hsdd-intake`'s quality gates gain the line "the handoff
block, when present, lists the same handoffs as the prose, in the same order,
with the same prompts".

### 12.3 `hsdd-reconcile`: align mode

`hsdd-reconcile` gains one operation, **align**, as a numbered step after its
step 13 and a mode paragraph; step 13's sweep of resolved open questions and
its trigger words are unchanged. Align runs standalone, with no pending
section present, like the steps the skill's step 2 names. It is invoked as
`/hsdd-reconcile align {node ids or all} after {what changed}` and, for each
named node's plan text:

1. moves every live citation of a contract version that is superseded
   (§12.2: `deprecated` or `retired`, or with no file of its own) to the
   current version, by §12.4's rule, in unshipped phases only and never in
   a node header's `Produces` or `Consumes` line; a citation of an earlier
   version that stays live beside the new one (`coexisting`) stays, and
   align routes one `consider` item to the node, naming the new version,
   since moving a consumer is that node's planning, never align's;
2. re-derives each phase gate's contract and guarantee arguments against the
   validation artifacts of the version the phase cites, where the gate names
   them;
3. checks that every phase id named in a contract's `produced_by`,
   `consumers` or delivery text exists, and that every phase Scope that cites
   an intake record cites one that exists;
4. records every finding it cannot fix within citations and gate arguments
   (a Scope that is now wrong, a phase that no longer fits) as a routed item
   for the owning skill, never rewriting a phase's scope itself.

It drains nothing and flips nothing unless the invocation also names those
steps. Its quality gates gain "every change align made is a citation or a
gate argument".

### 12.4 Citation touches when a version moves

When a source document moves to a new version, or a contract version is
superseded, every artifact that cites the old version is touched once, by
its owning skill (`hsdd-contract`, `hsdd-adr`, `hsdd-spec`), under this
rule, invoked as `citation touch {file}: move its citations to the current
versions`, which those three skills gain as a paragraph **Citation touch**.
A contract version is superseded as §12.2 says: its file is `deprecated` or
`retired` (`lockstep` deprecates it in the run that drafts the next version,
v0.10.0 §3.5), or it has no file of its own (a bump in place, before
0.10.2). A `coexisting` version stays `stable` while it has a live consumer,
and each consumer moves to the new version in a phase of its own.

- A **live** citation of a superseded version moves to the current one: an
  unshipped phase's boundary or delivery line, a guarantee citation, a
  fixture header comment, a node's `Sources` entry for a source document,
  any sentence that states what holds now.
- Never move a contract version in a node header's `Produces` or `Consumes`
  line, or in a copy of that line above the node (a parent's embedded
  summary, child-node table or DAG, the root's contract matrix):
  `hsdd-reconcile`'s version ripple writes those, keeping every version the
  node's phases name (v0.10.0 §3.5). Never edit an ADR's `affects`:
  `hsdd-adr` adds the new version there.
- An earlier contract version that is neither `deprecated` nor `retired`
  stays live beside the new one (`coexisting`): leave every citation of it,
  and route one `consider` item, naming the new version, to the node whose
  plan would move to it (the node of the citing phase, or the producer or
  consumer the citing sentence is about), so that node's own planning
  decides when it moves.
- A **shipped phase** (one whose verification doc is on the spec repo's
  main line, the conventions' `**Main line:**`, `main` when absent, v0.10.0
  §14.2) is history in full: nothing in it moves, and the touch reports each
  such reference as kept.
- **Historical** text keeps the version it describes: a dated amendment
  entry, a migration note, a "Corrected" paragraph, an account of what an
  earlier version did.
- When a moved citation sits in a sentence the new version makes false,
  restate the sentence to match the cited artifact's current text, and record
  one decision per sentence: what it said, what it says now, which part of
  the new version it follows. That is a compatible wording change in the
  touched file.
- Never change the touched artifact's own declarations, guarantees, cases or
  fixture behavior in a citation touch. When keeping a sentence true would
  need that, leave it, route it as a finding, and name the step it needs.
- Classify the touch against the touched artifact's own versioning rules
  (it normally stays at its version) and record that as one decision.
- Report how many citations moved and how many were kept, as history or
  as a live earlier version.

The final gate's F2 lists what still names a superseded version, so the
report can say that each remaining reference was read and is history.

### 12.5 What stays deferred

HSDD's templates use an em dash as an empty-cell token and in some headings.
A project that bans the character writes the replacement forms of §7.6,
which §15.3 admits into the frozen formats because every bundled parser
already reads them. What stays deferred is making the templates themselves
configurable: they keep the em dash, and a project that bans it relies on
the prompt to say otherwise.

---

## 13. Templates and Prompts

### 13.1 What a subagent receives

The launch prompt (§10.3) points at the dispatch file. The dispatch file's
body is the rendered preamble followed by the rendered step section. The
subagent therefore starts with no context but the file, which is the
isolation HSDD wants for every skill run, and the orchestrator spends no
output on restating it. The file is at most 64 KiB, so one read returns it
whole (§10.3), and it ends with the read check (§6.6).

### 13.2 Slots

A slot is `{name}` where `name` is lower-case letters and underscores. A
literal brace pair in a template is written doubled: `{{name}}` renders as
`{name}`. Text in braces that contains anything else (a space, a comma, a
capital) is never a slot and renders as written. Slots are filled only from
`run.yaml`, the segment entry, the step and the repository, by the tables in
appendices B and C, and `dispatch.mjs` fails on a slot it cannot fill. A fill
is itself rendered once before insertion, so a fill that names a slot
(`{decide_command}` names `{step}`) comes out filled; a slot in the fill's
own output is left as written.

### 13.3 The preamble

`templates/preamble.md` (appendix B) is the same for every step of a
segment. It carries, in this order: who the subagent is and what one step
is; the segment's context; the inputs and the out-of-bounds paths; the owner
facts and preferences; the decision policy; the stop set and the segment's
stop policy; how the policy applies to a step subagent; the rules of the run
(write set, no git, no interactive companion skills, experiments, prose
rules, citation forms, owner files, read-only paths); and the report's
shape, as a JSON skeleton.

### 13.4 The step section

`templates/steps/{kind}.md` (appendix C) has a common header, generated
blocks, and the kind's own instructions:

1. **Header:** step id, skill and its arguments (with `--unattended {step}`),
   target, report path, the decide command, the write set.
2. **Invocation:** an intake handoff's prompt verbatim, or the kind's
   default.
3. **Facts** (generated): the current state of every artifact the step reads
   or must keep consistent, each line ending in the file it was read from.
4. **Routed to this step** (generated): the open queue items that match the
   step (§6.5), by id; the report must close each.
5. **Predecided answers** (generated). They appear here and not in the
   preamble, so the preamble stays the same for a segment's steps when a
   `plan` step adds one.
6. **Continuing** (generated, for a continuation only): the stopped step,
   its report, its committed partial artifacts, and the decisions taken on
   its stop.
7. **Context from the orchestrator** (optional, from `--context-file`, every
   line cited).
8. **What to do:** the kind's instructions, including that the skill's own
   templates are the format, so the step never needs a sibling artifact for
   format (§7.4).
9. **Done when:** the conditions, ending with the gate command the subagent
   may run itself.

### 13.5 Changing templates

Templates are part of the skill. A template change ships in a skill release
with a `VERSION` change and a CHANGELOG entry. Each dispatch file records the
template and the skill version that rendered it, so an audit compares like
with like.

---

## 14. Evidence (informative)

### 14.1 FT-3

FT-3 planned a Dart and Flutter library from a three-document reference
architecture (a normative specification, an informative guide and an
informative rationale), for one owner working with coding agents, in one
repository, against HSDD v0.10.0's skills. The orchestration was a pasted
prompt driving one Claude Code session; it was not `hsdd-auto`, but its
protocol is the one this release packages: one skill invocation per fresh
subagent, a gate, two commits per step, a decision ledger, experiments as
evidence.

| | Segment 1: plan | Segment 2: intake of a new specification version |
|---|---|---|
| Steps; subagent dispatches | 55; 52 | 41; 38 plus one resume |
| Wall clock (serial) | 22 h 25 min | 8 h 24 min |
| Subagents working | 20 h 44 min | 7 h 19 min |
| Orchestrator overhead | 7% | 13% |
| Median subagent minutes per step | contract 37, phase-plan 26, ADR 20, reconcile 18, spec touch 10 | intake 25, contract 30, phase-plan 17, spec touch 7, reconcile 7, citation touch 4.5 |
| Subagent output tokens; cache reads | 1.78M; 814M | 0.58M; 415M |
| Orchestrator output tokens; share of all output | 0.68M; 28% | 0.40M; 41% |
| Context summaries during the segment | 1 | 0 |
| Decisions; citing an experiment; with no evidence | 684; 304; 4 | 387; 111; 1 |
| `would_have_asked` decisions | 31 | 14 (11 of them `breaking-amend`) |
| Stop policy | stop | decide and record |

The result: a tree of nine nodes, three ADRs and nine contracts, every
contract stable and final, every leaf-parent planned; then, after the new
specification version, four contracts at a new version, three phases
appended, every other artifact's live citations moved, and the final gate
clean. Every dispatch in both segments completed without a skill stop or a
run-stop candidate. **The stop path was never exercised**; its rules here
are reasoned, not tested (§16.1 marks them so).

The specification's author later ruled on 7 of the 38 decisions the first
segment marked `would_upstream`, adopting 4 and contradicting 3. That is the
first outcome label of its kind and the reason chapter 6 keeps every
decision's options and evidence: a later judge (§16.2) calibrates against
such outcomes.

### 14.2 What failed, and the rule that answers it

| FT-3 observation | v0.11 rule |
|------------------|------------|
| Prompts carried facts from the orchestrator's memory, and four were wrong (an amendment count, an authorship, a section number, a description of an experiment's stand-in). The subagents caught each against the source. | Facts in prompts are generated from files; orchestrator context lines must cite (§10.3). |
| Timestamps typed by hand: six orchestrator decisions in local time labelled UTC; in segment 2, ten setup decisions with chosen times, one before the owner's message arrived. One subagent stamped its decisions at the end, so only upper bounds exist. | Only scripts stamp, and `decide.mjs` mints the id with the time (§6.1, §10.4); every decision is checked against its step's window (§10.5, B2). |
| Two inserted steps in segment 1 shifted later step ids in plan rows and cross-references. | Ids at dispatch (§7.2). Segment 2 already did this, and four inserted steps renumbered nothing. |
| The step log was edited by hand and drifted. | Generated from the run log (§6.9). |
| Blindness was only an instruction; the orchestrator read a memory file describing a comparison run after each segment. | The adapter (chapter 11). |
| The gate was patched twice during segment 1. | Write sets per kind from configuration (§7.3). Segment 2 extended the gate once, before its first skill step, and never again. |
| The commit script, step prompts and notes lived in a session scratchpad, later emptied. | Scripts bundled and copied (§4.3); every rendered prompt committed (§6.6); routed items in the queue (§6.5). |
| 57 timed wake-ups in segment 1; none in segment 2, with no step lost. | Wait for the hand-back (§8.8). |
| The consistency pass was improvised in segment 1 and planned as a final handoff in segment 2. | A standard stage and an align mode (§9.1, §12.3). |
| The owner's uncommitted files sat in the working tree when segment 2 began. | Owner files and their hash snapshot (§6.10, A2). |
| The owner's "do not ask me anything" changed the stop policy for segment 2 only. | Stop policy per segment, read and recorded at setup (§8.1, §8.2). |
| One decision taken before any step (a breaking change to a stable contract takes the next version) answered the class that 11 of the 14 later would-have-asked decisions belonged to. | Predecided answers (§8.4). |
| A phase-plan step read a sibling node's plan to copy its format, against v0.10.0 §8.3, and said so. | Templates name the skill's own templates as the format; `reads_outside` (§7.4). |
| A step reported a sentence it had found false as outside its scope; resuming the same subagent fixed it in 8 minutes. | Resume as the first rework (§8.6); the review checks for this (§8.5). |
| The orchestrator's share of output tokens rose from 28% to 41% as steps got smaller and prompts did not. | The launch prompt is a pointer to the dispatch file (§10.3). |
| A citation touch found nothing to move and needed an empty commit. | Empty artifact commits are part of the protocol (§10.7). |
| Thirteen steps moved citations from the old specification version to the new one under a rule the orchestrator wrote for the purpose. | The citation-touch rule (§12.4) and the `cites-superseded` condition (§12.2). |

---

## 15. Compatibility

### 15.1 Upgrading to v0.11.0 is additive

Upgrading means reinstalling the twelve skills. No existing artifact is
rewritten. v0.10.0 §15.1's table gains these rows:

| Change | Effect on an existing ≥0.6.1 project | Implemented in v0.11.0 by |
|--------|--------------------------------------|---------------------------|
| `hsdd-auto`, `hsdd/auto/`, `hsdd/judgement/`, `hsdd/scripts/auto/` (chapters 3 to 11) | Opt-in. A project that never runs `/hsdd-auto` is unaffected. | `hsdd-auto` |
| `## Unattended runs` sections (§12.1) | Inert unless a skill is invoked with `--unattended`. | the six planning skills |
| The intake handoff block (§12.2) | Optional; existing records stay conformant. | `hsdd-intake` |
| Reconcile align mode (§12.3) | A named invocation; nothing runs it implicitly. | `hsdd-reconcile` |
| The citation-touch rule (§12.4) | Applies to touches made after the upgrade. | `hsdd-contract`, `hsdd-adr`, `hsdd-spec` |

A project whose `hsdd/judgement/decisions.jsonl` was written by a hand-built
unattended run in the earlier record shape can continue under `hsdd-auto`:
its lines are legacy lines (§10.5), validated with one warning, and the
first segment's `setup` records the import as a decision.

### 15.2 Artifact stability

The formats this document defines join v0.10.0 §15.3's frozen set when
v0.11.0 is released: `run.yaml` version 1, the decision record and sidecar
line, the run line, the step report, the queue line, the dispatch file's
front matter, the skipped-handoff line, `owner-files.json`, `adapter.json`,
`STOP.md`, the review line, and the handoff block (appendix A). Later
releases may add optional fields only. `run.yaml`'s `version` changes only
with a migration the skill performs in a `setup` step.

### 15.3 Edits to v0.10.0's text

- v0.10.0 §1.5: "Eleven skills" becomes "Twelve skills"; the table gains
  this document's §3.1 row; the chain diagram gains a line
  `hsdd-auto (unattended) -> runs the chain above, records every decision`.
- v0.10.0 §14.1: the layout tree gains this document's §4.2 directories.
- v0.10.0 §3.1: the contract file gains the optional front-matter field
  `governed_by: [ADR-NNN, ...]`, the contract's side of the `Governed by`
  link v0.10.0 §4.3 requires of it; the registry generator keeps unknown keys and
  projects nothing from this one.
- v0.10.0 §4.4 and §7.5: the separator between an open-question id and its
  title, and before a `Collides with` reason, admits `:`, an en dash or
  ` - ` beside the em dash; an empty table cell or list admits `none` and
  `-`. The bundled parsers already read each of these as the em dash, and
  no existing artifact changes.
- `hsdd-spec`'s `conventions.md` template, the `hsdd/management/` bullet:
  its writers gain "and `hsdd-auto`'s report step, for an intake record's
  `## Produced`".
- v0.10.0 §16.3: the "An `hsdd-review` skill" row reads "Deferred, together
  with the judge that would gate unattended runs (v0.11 §16.2)". The
  "Back-application" row also covers v0.11.0's rules. The "Scheduling" row
  reads "nothing fires on a timer, except the one fallback wake-up per
  launch of an unattended run (v0.11 §8.8)".
- v0.10.0 §18.1: this document's §16.1 rows are appended.
- v0.10.0 chapter 19: this document's §15.4 terms are appended.

### 15.4 Glossary additions

Run, segment, step, step kind, launch, continuation, orchestrator, step
subagent, decision ledger, decisions sidecar, run log, skill stop, run-stop
candidate, stop class, stop set, stop policy, predecided answer,
`would_have_asked`, `would_upstream`, blast radius, routed item, write set,
judgement set, read check, experiment, owner files, out-of-bounds paths,
baseline source, segment report, handoff block, `cites-superseded`, align
mode, touch, citation touch: each as chapter 2, §6.4, §6.6, §12.1, §12.2,
§12.3 and §12.4 define them.

---

## 16. Decisions

### 16.1 Settled

Provenance as v0.10.0 chapter 18 defines it. `field-tested` here means
exercised in FT-3's hand-built orchestration, which ran the same protocol
without the packaging.

| Question | Decision | Provenance |
|----------|----------|------------|
| Where unattended planning lives | A twelfth skill with bundled scripts and a host adapter (§3.2). | reasoned-only |
| Unit of a step | One skill invocation on one target by one fresh subagent; the orchestrator runs no planning skill itself (chapter 2). | field-tested |
| Commits per step | Two: artifacts, then judgement; an empty artifact commit when nothing changed (§6.11, §10.7). | field-tested |
| Decision record | Question, options with consequences, chosen, why, evidence, blast radius, confidence, would-have-asked with class, would-upstream, commit (§6.2). | field-tested |
| Who mints ids and stamps time | `decide.mjs` only, at the moment of the decision (§6.1, §10.4). | reasoned-only (FT-3's hand stamps are the evidence against the alternative) |
| Step ids | Allocated at dispatch, never renumbered (§7.2). | field-tested |
| Next step | Computed by a script from the repository's state (§10.2). | reasoned-only |
| Prompts | Rendered from templates with facts read from files, committed, and passed as a pointer; at most 64 KiB, ending in a read check the report echoes (§6.6, §10.3, chapter 13). | reasoned-only |
| Stop policy | Per segment: `stop` or `decide-and-record`; a hard stop for needs outside the repository (§8.2). | field-tested for `decide-and-record`; the `stop` path is reasoned-only |
| Stopped steps | Committed as `stopped`, then continued by a new step once the stop is resolved; an answered stop resumes the same subagent instead (§8.3). | reasoned-only |
| Answering stops in advance | Predecided answers per stop class (§8.4). | field-tested |
| Rework | Resume the same subagent first, within a limit (§8.6). | field-tested (once) |
| Waiting | For the hand-back, never polling (§8.8). | field-tested |
| Owner files | Hash snapshot per segment, checked by the gate (§6.10). | field-tested |
| Serial steps | Yes; parallel dispatch deferred (§16.2). | field-tested |
| Routing queue | Structured items with `must-address`, `consider` and `insert-step` kinds and a matching rule (§6.5). | reasoned-only |
| Gate scope | Errors only in files the step (or segment) changed; pre-existing defects are warnings (§10.6). | reasoned-only |
| Host enforcement | Deny rules, a Bash hook and a step agent type, installed and checked (chapter 11). | reasoned-only |
| Skills under an unattended run | An ask-point table per skill with `return` or `decide` dispositions, and declared overrides (§12.1). | reasoned-only |
| Intake handoffs for a machine | An optional JSON block in `## Routing`, with a textual `cites-superseded` condition (§12.2). | reasoned-only |
| Consistency pass | A stage in both modes and a reconcile align mode (§9.1, §9.2, §12.3). | field-tested |
| Citations when a version moves | Live citations move, history keeps its version, false sentences are restated and recorded (§12.4). | field-tested |

### 16.2 Deferred

| Deferred | Why |
|----------|-----|
| A judge (`hsdd-judge`) that scores each step's artifacts against a rubric and decides proceed, stop or block | It needs reviewed decisions and artifact verdicts to calibrate against, which only exist after runs like FT-3 are reviewed. v0.11 records what it needs: options, evidence, blobs by commit, models. Its place in the loop would be after the gate and before the artifact commit. |
| The standalone-spec-repo profile | Under the profile, governance edits are pushed to spec-repo main as they are made and pointers reference only main commits (v0.10.0 §9.5, §14.4 rule 1), while a run lands as a branch reviewed before it merges. Each step would also commit in two repositories (artifacts and run records in the spec repo, the pointer and the adapter in the implementation repo), and two implementation repos running at once would share `run.yaml`, step ids and decision ids. Support needs a run branch pair whose pointer may reference spec-branch commits on the run branch only and which lands atomically at segment end (rule 3), a run lock in the spec repo, and run configuration and records kept per implementation repo. Specify it once a profile project needs unattended runs. |
| Dual decisions for chosen step kinds: two independent subagents decide the step's questions, agreement stands, and each disagreement is recorded `would_have_asked` and resolved by a third pass or, under `stop`, stops | Its value depends on how often a decision flips between runs on identical inputs, which no run has measured. FT-3's three ADR steps took 13 to 21 decisions each, and the defects later steps corrected in them were factual (a lint severity, an exit code); experiments settle those, and a second draft from the same model and inputs would likely share them. Comparing two whole drafts would also discard the better choices of the losing one. Measure run-to-run variance per step kind first. The two ledgers must then be matched by question, which ADRs allow (the open-question ids they resolve) and most kinds do not. An optional `dual_kinds` list in `run.yaml` would add it without a format change. |
| Parallel dispatch | Producer-first planning with a reconcile after each plan serializes most steps. Citation touches and root ADRs have disjoint write sets and are the candidates; measure on a run before designing it. |
| A run explorer (a reading aid over the records) | The records and dispatch files hold everything it needs; it belongs with the reading aids of v0.10.0 chapter 13 when built. |
| Configurable template tokens | §12.5. |
| Unattended adoption | `hsdd-adopt`'s human confirmation is the owner's by design (v0.10.0 §6.4, §6.5). |
| Unattended retirement (`hsdd-spec` retirement mode, reconcile step 9) | No field run has retired a node; the confirmation and the live-consumer check stay a human's until one does. |
| An external runner for CI | Every judgement point would need its own model call, which is the judge. |

### 16.3 Rejected

- **A Claude Code plugin as the package.** It gives tool-level enforcement
  but ties the method to one host; the adapter gives the same enforcement as
  an optional layer.
- **Agents typing timestamps, with validation afterwards.** FT-3 shows the
  failure is not malice but convenience; a check after the fact cannot
  recover the true time.
- **Ids minted at commit time.** A decision's id is needed before its
  commit: in a resume message, a `STOP.md`, a predecided answer, a queue
  event.
- **The orchestrator writing prompts freehand.** It costs the most output
  tokens of anything the orchestrator does and is where wrong facts entered.
- **One global stop policy per run.** The owner's tolerance changes with the
  work: FT-3's owner wanted stops for the first plan and none for the
  intake.

---

## 17. Acceptance

### 17.1 Script tests

Under `test/`, with Node's built-in test runner and fixtures under
`test/fixtures/auto/` (a small tree at each plan-mode stage, an intake
record with a handoff block, and a ledger with legacy lines). At least:

- `yaml.mjs`: accepts every construct of §5.2 and round-trips an appended
  segment entry without touching comments; rejects anchors, multi-line
  scalars and tabs, naming the line.
- `decide.mjs`: mints consecutive ids across the ledger and uncommitted
  sidecars; stamps `at`; rejects a supplied `id` or `at`; rejects a `chosen`
  that is not a label, `would_have_asked: true` without a class, and
  `upstream` blast radius without `would_upstream`; assigns the decision type
  by §10.4; the lock prevents two concurrent mints from sharing an id;
  refuses a step whose judgement commit exists; replaces a lock older than
  60 seconds.
- `ledger.mjs`: appends a sidecar in id order with `segment`, `step_ref` and
  `commit`; rejects a subagent decision outside its window; warns once for
  legacy lines; warns on an id gap.
- `next.mjs`: for each fixture stage returns the step chapter 9 names;
  producer-first order on a three-contract chain; a cycle returns `stop`;
  a pending continuation and an accepted insert-step come before the stage
  rule; intake handoff order, `after`, and `cites-superseded` both ways,
  including a `baseline` version string and a `{slug}@v{k}` reference;
  `skip`, `waiting`, `blocked`, `close`, `decide`, `stuck` and `done`; an
  item's `after` honoured; a stopped step's item or handoff returned only as
  its continuation; a `promote`
  handoff first for a record with a `**Promotes:**` line; no step for an
  as-built leaf-parent in stage 6.
- `dispatch.mjs`: renders every template with no unfilled slot and with
  doubled braces rendered single; refuses a context line without a citation
  token; prints exactly §10.3's launch prompt; `--resume` and
  `--redispatch` append launches; the read check is the last line after
  every append, new on `--redispatch` and unchanged on `--resume`, and never
  in the front matter; predecided answers render once, in the step section;
  warns above 32 KiB and refuses above 64 KiB, listing slot sizes, without
  allocating an id; `--resume` refuses a message that crosses the limit;
  `{segment_context}` lists at most three earlier segments; `--redispatch`
  renames the report series and draws a new read check; `--plan --for`
  writes the reason into the body; `--next` refuses a non-`step` result.
- `gate.mjs`: one fixture per check id that fails it and one that passes;
  a defect in a file the step did not change is a warning; the generator
  checks are skipped before the first contract; `--check` runs only the
  named checks on a step of any status; C3 warns on an `affects` target with
  no file; C4 exempts `v0`; a step without a sidecar passes B1; C1 writes
  nothing into the tree; C0 and C4 skip `INDEX.md`; F4 fails on an open
  insert-step; a stopped orchestrator step runs A1 to A3.
- `state.mjs upstream`: lists exactly the ledger's `would_upstream`
  decisions, in id order.
- `state.mjs open-segment`: creates and checks out the branch once; takes
  `-2` on a taken id and the next free step id as `first_step`; copies
  `request` and `authority` when continuing a segment; refuses while a step
  is open; reads `segments:` with no value as empty.
- `commit.mjs`: stages only the write set; never stages an owner file;
  refuses an out-of-set change; makes an empty artifact commit; resumes from
  an existing artifact commit without making a second one; marks an
  insert-step item `addressed` only on `completed`; `--discard` restores the
  named paths and notes them; writes the step log; `--skip` refuses when the
  condition holds and resumes from an uncommitted skip line; `--no-report`
  skips B1 and B5 and renames the series; unstages a dirty index at the
  dispatch head; refuses a step with an open insert-step; ingest dedupes
  `open` lines by text; never amends.
- `routed.mjs`: open, close, decide, ingest; the matching rule of §6.5 for
  each target form; an item's state is its last line.
- `hook-bash.mjs`: every form of an out-of-bounds path is blocked; git writes
  are blocked only with `agent_id`; `git branch new-name` is a write.
- The bundled copy: the `setup` step's `hsdd/scripts/auto/` is
  byte-identical to the skill's `scripts/`.

### 17.2 Live acceptance

Recorded in `review/hsdd-v0_11-acceptance.md` before the release, each with
a filled `Result:`:

1. **Plan, decide-and-record.** A sandbox project with a small three-node
   specification planned to `done`: every condition of §9.1's done
   definition holds; two commits per step; every decision minted and stamped
   inside its window; every dispatch file committed; the report's prose
   slots filled.
2. **Plan, stop.** The same sandbox with no owner fact for "who builds
   what": the root step returns an `axis` stop, the run commits it as
   `stopped`, writes `STOP.md` and ends with a clean tree; `/hsdd-auto` with
   an answer opens a new segment that records it with `by: owner`, dispatches
   the continuation, and continues to `done`.
3. **Procedural stop.** A phase-plan step that meets an unminted open
   question is committed as `stopped`, an inserted `spec-touch` mints the id,
   and the continuation finishes the plan.
4. **Intake.** On the planned sandbox, a request that breaks one stable
   contract, under `decide-and-record` with a predecided `breaking-amend`
   answer: the contract takes its next version, every citing artifact gets a
   citation touch or is skipped by its condition, the align runs or its
   target set is empty (§9.1), F2's
   remaining references are all history, and the record's `## Produced` is
   filled without phases.
5. **Rework.** A step whose output fails a gate check is resumed once and
   passes; a second planted failure raises `gate-twice`.
6. **Interruption.** The session is ended once mid-launch and once between
   the two commits; `/hsdd-auto` recovers both per §8.9 without a duplicate
   commit.
7. **Adapter.** `adapter.mjs check` passes, and a test step asked to read an
   out-of-bounds file is refused by the host.
8. **Cost.** The orchestrator's share of output tokens in run 1 is recorded
   next to FT-3's 28%, as evidence for §16.1, not as a pass condition.

---

## Appendix A. Schemas

JSON Schema 2020-12, restricted to the keywords `lib/schema.mjs` implements
(§6.1). Each ships as `scripts/schema/{name}.schema.json`. The rules under
each schema are the ones the keyword subset cannot state; the named script
checks them in code.

### A.1 `run-config.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/run-config/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "run", "branch", "base", "skills_dir", "owner_facts", "sources", "read_only", "segments"],
  "properties": {
    "version": { "enum": [1] },
    "run": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
    "root": { "type": "string", "minLength": 1 },
    "branch": { "type": "string", "minLength": 1 },
    "base": { "type": "string", "minLength": 1 },
    "skills_dir": { "type": "string", "minLength": 1 },
    "models": {
      "type": "object", "additionalProperties": false,
      "properties": { "orchestrator": { "type": "string", "minLength": 1 }, "step": { "type": "string", "minLength": 1 } }
    },
    "owner_facts": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "preferences": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "prose_rules": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "banned_chars": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "banned_phrases": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "token_forms": {
          "type": "object", "additionalProperties": false,
          "properties": {
            "empty_cell": { "type": "string", "minLength": 1 },
            "id_separator": { "type": "string", "minLength": 1 },
            "reason_separator": { "type": "string", "minLength": 1 },
            "source_separator": { "type": "string", "minLength": 1 }
          }
        },
        "level": { "enum": ["warn", "error"] }
      }
    },
    "sources": {
      "type": "object", "additionalProperties": false, "required": ["normative"],
      "properties": {
        "normative": { "$ref": "#/$defs/sources" },
        "informative": { "$ref": "#/$defs/sources" },
        "baseline": { "$ref": "#/$defs/sources" }
      }
    },
    "read_only": { "$ref": "#/$defs/paths" },
    "out_of_bounds": { "$ref": "#/$defs/paths" },
    "owner_files": { "$ref": "#/$defs/paths" },
    "orchestrator_files": { "$ref": "#/$defs/paths" },
    "toolchain": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "commands": { "type": "object", "additionalProperties": { "type": "string", "minLength": 1 } },
        "rules": { "type": "array", "items": { "type": "string", "minLength": 1 } }
      }
    },
    "experiments_dir": { "type": "string", "minLength": 1 },
    "report_dir": { "type": "string", "minLength": 1 },
    "stop_set": { "type": "array", "items": { "$ref": "#/$defs/stoppable" } },
    "stop_policy": { "$ref": "#/$defs/stopPolicy" },
    "predecided": {
      "type": "object",
      "additionalProperties": {
        "type": "object", "additionalProperties": false, "required": ["answer", "decision"],
        "properties": {
          "answer": { "type": "string", "minLength": 1 },
          "decision": { "type": "string", "pattern": "^DEC-[0-9]{3,}$" }
        }
      }
    },
    "commit": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "trailers": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "artifact": { "type": "string", "minLength": 1 },
        "judgement": { "type": "string", "minLength": 1 },
        "orchestrator": { "type": "string", "minLength": 1 }
      }
    },
    "rework_limit": { "type": "integer", "minimum": 0 },
    "dispatch": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "wait": { "enum": ["hand-back", "foreground"] },
        "fallback_wakeup_minutes": { "type": "integer", "minimum": 20 }
      }
    },
    "segments": {
      "type": ["array", "null"],
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["id", "mode", "opened_at", "instruction", "stop_policy", "first_step"],
        "properties": {
          "id": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}-(plan|intake-[a-z0-9]+(-[a-z0-9]+)*)(-[0-9]+)?$" },
          "mode": { "enum": ["plan", "intake"] },
          "opened_at": { "$ref": "#/$defs/time" },
          "instruction": { "type": "string", "minLength": 1 },
          "stop_policy": { "$ref": "#/$defs/stopPolicy" },
          "first_step": { "$ref": "#/$defs/stepRef" },
          "request": { "type": "string", "minLength": 1 },
          "authority": { "enum": ["accepted-rfc", "draft", "ticket", "incident", "braindump"] }
        }
      }
    }
  },
  "$defs": {
    "time": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" },
    "stepRef": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "paths": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "sources": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["path", "cite"],
        "properties": {
          "path": { "type": "string", "minLength": 1 },
          "cite": { "type": "string", "minLength": 1 },
          "version": { "type": "string", "minLength": 1 },
          "authority": { "enum": ["accepted-rfc", "draft", "ticket", "incident", "braindump"] }
        }
      }
    },
    "stopPolicy": { "enum": ["stop", "decide-and-record"] },
    "stoppable": { "enum": ["axis", "shape", "promotion", "breaking-amend", "collision", "external", "gate-twice"] }
  }
}
```

Checked in code (`lib/yaml.mjs` loader): every `predecided` key is a
stoppable class; an intake segment has `request` and `authority`; segment
ids are unique; every source of a segment that moves a version has a
`version` (§9.3).

### A.2 `decision.schema.json`

The ledger line. `$defs.sidecarDecision` is a line of a step's decisions
sidecar; `$defs.decisionInput` is what `decide.mjs` reads.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/decision/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "at", "segment", "step", "step_ref", "by", "artifact", "question", "options", "chosen", "why", "evidence", "blast_radius", "confidence", "would_have_asked", "stop_class", "would_upstream", "commit"],
  "properties": {
    "id": { "$ref": "#/$defs/id" },
    "at": { "$ref": "#/$defs/time" },
    "segment": { "type": "string", "minLength": 1 },
    "step": { "$ref": "#/$defs/type" },
    "step_ref": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "by": { "$ref": "#/$defs/by" },
    "artifact": { "$ref": "#/$defs/artifact" },
    "question": { "type": "string", "minLength": 1 },
    "options": { "$ref": "#/$defs/options" },
    "chosen": { "type": "string", "minLength": 1 },
    "why": { "type": "string", "minLength": 1 },
    "evidence": { "$ref": "#/$defs/evidence" },
    "blast_radius": { "$ref": "#/$defs/blast" },
    "confidence": { "$ref": "#/$defs/confidence" },
    "would_have_asked": { "type": "boolean" },
    "stop_class": { "$ref": "#/$defs/stopClassOrNull" },
    "would_upstream": { "type": "boolean" },
    "model": { "type": "string", "minLength": 1 },
    "commit": { "type": "string", "pattern": "^[0-9a-f]{7,64}$" }
  },
  "$defs": {
    "id": { "type": "string", "pattern": "^DEC-[0-9]{3,}$" },
    "time": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" },
    "type": { "enum": ["setup", "plan", "intake", "root-spec", "mid-level-spec", "adr", "contract", "phase-plan", "reconcile"] },
    "by": { "enum": ["subagent", "orchestrator", "owner"] },
    "artifact": { "type": ["string", "null"], "pattern": "^(?!/)(?!(?:.*/)?\\.\\.(?:/|$)).+$" },
    "options": {
      "type": "array", "minItems": 2,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["label", "consequence"],
        "properties": { "label": { "type": "string", "minLength": 1 }, "consequence": { "type": "string", "minLength": 1 } }
      }
    },
    "evidence": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "blast": { "enum": ["node-local", "contract", "tree", "upstream"] },
    "confidence": { "enum": ["high", "medium", "low"] },
    "stopClassOrNull": {
      "enum": ["axis", "shape", "promotion", "breaking-amend", "collision", "external", "gate-twice", "upstream", "procedural", "judgement", null]
    },
    "sidecarDecision": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "at", "by", "step", "artifact", "question", "options", "chosen", "why", "evidence", "blast_radius", "confidence", "would_have_asked", "stop_class", "would_upstream"],
      "properties": {
        "id": { "$ref": "#/$defs/id" },
        "at": { "$ref": "#/$defs/time" },
        "by": { "$ref": "#/$defs/by" },
        "step": { "$ref": "#/$defs/type" },
        "artifact": { "$ref": "#/$defs/artifact" },
        "question": { "type": "string", "minLength": 1 },
        "options": { "$ref": "#/$defs/options" },
        "chosen": { "type": "string", "minLength": 1 },
        "why": { "type": "string", "minLength": 1 },
        "evidence": { "$ref": "#/$defs/evidence" },
        "blast_radius": { "$ref": "#/$defs/blast" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "would_have_asked": { "type": "boolean" },
        "stop_class": { "$ref": "#/$defs/stopClassOrNull" },
        "would_upstream": { "type": "boolean" },
        "model": { "type": "string", "minLength": 1 }
      }
    },
    "decisionInput": {
      "type": "object", "additionalProperties": false,
      "required": ["artifact", "question", "options", "chosen", "why", "evidence", "blast_radius", "confidence", "would_have_asked", "stop_class", "would_upstream"],
      "properties": {
        "artifact": { "$ref": "#/$defs/artifact" },
        "question": { "type": "string", "minLength": 1 },
        "options": { "$ref": "#/$defs/options" },
        "chosen": { "type": "string", "minLength": 1 },
        "why": { "type": "string", "minLength": 1 },
        "evidence": { "$ref": "#/$defs/evidence" },
        "blast_radius": { "$ref": "#/$defs/blast" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "would_have_asked": { "type": "boolean" },
        "stop_class": { "$ref": "#/$defs/stopClassOrNull" },
        "would_upstream": { "type": "boolean" },
        "model": { "type": "string", "minLength": 1 }
      }
    }
  }
}
```

Checked in code (`decide.mjs`, `ledger.mjs`): `chosen` equals one option's
`label`; `stop_class` is non-null exactly when `would_have_asked` is true;
`blast_radius: upstream` implies `would_upstream: true`; ids are unique.

### A.3 `run-line.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/run-line/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["step_ref", "segment", "kind", "skill", "target", "started", "finished", "commit", "dispatches", "status"],
  "properties": {
    "step_ref": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "segment": { "type": "string", "minLength": 1 },
    "kind": { "$ref": "#/$defs/kind" },
    "skill": { "enum": ["none", "hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile", "hsdd-intake"] },
    "target": { "type": "string", "minLength": 1 },
    "started": { "$ref": "#/$defs/time" },
    "finished": { "$ref": "#/$defs/time" },
    "commit": { "type": "string", "pattern": "^[0-9a-f]{7,64}$" },
    "dispatches": { "type": "integer", "minimum": 0 },
    "status": { "enum": ["completed", "stopped"] },
    "continues": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "model": { "type": "string", "minLength": 1 },
    "usage": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "input_tokens": { "type": "integer", "minimum": 0 },
        "output_tokens": { "type": "integer", "minimum": 0 },
        "cache_read_input_tokens": { "type": "integer", "minimum": 0 },
        "cache_creation_input_tokens": { "type": "integer", "minimum": 0 }
      }
    },
    "note": { "type": "string", "minLength": 1 }
  },
  "$defs": {
    "time": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" },
    "kind": {
      "enum": ["setup", "plan", "root-spec", "mid-level-spec", "graft", "promote", "spec-touch", "adr", "adr-update", "contract", "contract-touch", "citation-touch", "phase-plan", "phase-plan-append", "reconcile", "align", "intake", "report"]
    },
    "insertableKind": {
      "enum": ["root-spec", "mid-level-spec", "graft", "promote", "spec-touch", "adr", "adr-update", "contract", "contract-touch", "citation-touch", "phase-plan", "phase-plan-append", "reconcile", "align"]
    }
  }
}
```

### A.4 `step-report.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/step-report/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["step_ref", "skill", "target", "status", "stop", "artifacts", "experiments", "self_check", "routed", "closes", "reads_outside", "notes", "read_check"],
  "properties": {
    "step_ref": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "skill": { "enum": ["hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile", "hsdd-intake"] },
    "target": { "type": "string", "minLength": 1 },
    "status": { "enum": ["completed", "stopped", "run-stop-candidate"] },
    "stop": {
      "type": ["object", "null"], "additionalProperties": false,
      "required": ["question", "skill_rule", "stop_class", "options", "recommendation", "blocks"],
      "properties": {
        "question": { "type": "string", "minLength": 1 },
        "skill_rule": { "type": "string", "minLength": 1 },
        "stop_class": { "enum": ["axis", "shape", "promotion", "breaking-amend", "collision", "external", "gate-twice", "upstream", "procedural", "judgement"] },
        "options": {
          "type": "array", "minItems": 1,
          "items": {
            "type": "object", "additionalProperties": false, "required": ["label", "consequence"],
            "properties": { "label": { "type": "string", "minLength": 1 }, "consequence": { "type": "string", "minLength": 1 } }
          }
        },
        "recommendation": { "type": "string", "minLength": 1 },
        "blocks": { "type": "string", "minLength": 1 }
      }
    },
    "artifacts": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "experiments": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["path", "question", "finding"],
        "properties": {
          "path": { "type": "string", "minLength": 1 },
          "question": { "type": "string", "minLength": 1 },
          "finding": { "type": "string", "minLength": 1 }
        }
      }
    },
    "self_check": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["gate", "status", "note"],
        "properties": {
          "gate": { "type": "string", "minLength": 1 },
          "status": { "enum": ["pass", "fail", "n/a"] },
          "note": { "type": "string" }
        }
      }
    },
    "routed": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["target", "kind", "text"],
        "properties": {
          "target": { "type": "string", "minLength": 1 },
          "kind": { "enum": ["must-address", "consider", "insert-step"] },
          "text": { "type": "string", "minLength": 1 },
          "step_kind": { "$ref": "run-line.schema.json#/$defs/insertableKind" },
          "step_target": { "type": "string", "minLength": 1 }
        }
      }
    },
    "closes": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["id", "outcome", "note"],
        "properties": {
          "id": { "type": "string", "pattern": "^Q-[0-9]{3,}$" },
          "outcome": { "enum": ["addressed", "explained"] },
          "note": { "type": "string", "minLength": 1 }
        }
      }
    },
    "reads_outside": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["path", "why"],
        "properties": { "path": { "type": "string", "minLength": 1 }, "why": { "type": "string", "minLength": 1 } }
      }
    },
    "notes": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "read_check": { "type": "string", "pattern": "^[0-9a-f]{8}$" }
  }
}
```

Checked in code (`gate.mjs` B1): `stop` is `null` exactly when `status` is
`completed`; `stop.options` has at least two entries unless `stop_class` is
`procedural`; `recommendation` is an option's label; a `routed` entry has
`step_kind` and `step_target` exactly when its `kind` is `insert-step`. For
a `run-stop-candidate`, `skill_rule` is the class's "Raised when" line and
`question` the subagent's statement of the condition (§6.4). A resume report
(`{step}.r{n}.json`) has the same shape; its `status`, `stop` and
`self_check` describe the step at the end of that launch, its list fields
only what the launch added (§6.4).

### A.5 `queue-line.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/queue-line/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "at", "status"],
  "properties": {
    "id": { "type": "string", "pattern": "^Q-[0-9]{3,}$" },
    "at": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" },
    "status": { "enum": ["open", "addressed", "explained", "accepted", "rejected"] },
    "from": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "target": { "type": "string", "minLength": 1 },
    "kind": { "enum": ["must-address", "consider", "insert-step"] },
    "text": { "type": "string", "minLength": 1 },
    "step_kind": { "$ref": "run-line.schema.json#/$defs/insertableKind" },
    "step_target": { "type": "string", "minLength": 1 },
    "after": { "type": "string", "minLength": 1 },
    "by": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "note": { "type": "string", "minLength": 1 },
    "decision": { "type": "string", "pattern": "^DEC-[0-9]{3,}$" }
  }
}
```

Checked in code (`routed.mjs`): an `open` line has `from`, `target`, `kind`
and `text`, plus `step_kind` and `step_target` for `insert-step`, whose
`target` is `run` and which alone may carry `after` (a handoff id or
`handoffs`);
`addressed` and `explained` have `by` and `note`; `accepted` and `rejected`
have `decision` and apply only to `insert-step` items; an `addressed` line
for an `insert-step` item follows an `accepted` one.

### A.6 `review.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/review/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["decision", "at", "review"],
  "properties": {
    "decision": { "type": "string", "pattern": "^DEC-[0-9]{3,}$" },
    "at": { "type": "string", "minLength": 1 },
    "review": { "enum": ["agree", "disagree", "should-have-asked"] },
    "reason": { "type": "string", "minLength": 1 },
    "reviewer": { "type": "string", "minLength": 1 },
    "preferred": { "type": "string", "minLength": 1 },
    "impact": { "enum": ["node-local", "contract", "tree", "upstream"] }
  }
}
```

`reason` is required for `disagree` and `should-have-asked`.

### A.7 `handoffs.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/handoffs/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "handoffs"],
  "properties": {
    "version": { "enum": [1] },
    "handoffs": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["id", "kind", "skill", "target", "prompt", "when", "after"],
        "properties": {
          "id": { "type": "string", "pattern": "^H[0-9]+[a-z]?$" },
          "kind": {
            "enum": ["root-spec", "mid-level-spec", "graft", "promote", "spec-touch", "adr", "adr-update", "contract", "contract-touch", "citation-touch", "phase-plan", "phase-plan-append", "reconcile", "align"]
          },
          "skill": { "enum": ["hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile"] },
          "target": { "type": "string", "minLength": 1 },
          "prompt": { "type": "string", "minLength": 1 },
          "when": { "enum": [null, "cites-superseded"] },
          "after": { "type": "array", "items": { "type": "string", "pattern": "^H[0-9]+[a-z]?$" } }
        }
      }
    },
    "insert_rule": { "type": "string", "minLength": 1 }
  }
}
```

Checked in code (`gate.mjs` C8): the list is empty only when the record's
`**Class:**` is `structural`; handoff ids are unique; every `after` id
names an earlier handoff; `skill` is the one §7.1 gives for the `kind`;
each `prompt` appears verbatim in the `## Routing` prose, in block order.

### A.8 `dispatch.schema.json`

The dispatch file's front matter (§6.6), parsed with `lib/yaml.mjs`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/dispatch/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["step_ref", "segment", "kind", "skill", "target", "handoff", "queue_item", "continues", "report", "decisions", "write_set", "template", "skill_version", "rendered_at", "head", "launches"],
  "properties": {
    "step_ref": { "type": "string", "pattern": "^S[0-9]{2,}$" },
    "segment": { "type": "string", "minLength": 1 },
    "kind": { "$ref": "run-line.schema.json#/$defs/kind" },
    "skill": { "enum": ["none", "hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile", "hsdd-intake"] },
    "target": { "type": "string", "minLength": 1 },
    "handoff": { "type": ["string", "null"], "pattern": "^H[0-9]+[a-z]?$" },
    "queue_item": { "type": ["string", "null"], "pattern": "^Q-[0-9]{3,}$" },
    "continues": { "type": ["string", "null"], "pattern": "^S[0-9]{2,}$" },
    "report": { "type": ["string", "null"], "minLength": 1 },
    "decisions": { "type": "string", "minLength": 1 },
    "write_set": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "template": { "type": ["string", "null"], "minLength": 1 },
    "skill_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "rendered_at": { "$ref": "run-line.schema.json#/$defs/time" },
    "head": { "type": "string", "pattern": "^[0-9a-f]{7,64}$" },
    "launches": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["at", "reason"],
        "properties": {
          "at": { "$ref": "run-line.schema.json#/$defs/time" },
          "reason": { "enum": ["initial", "redispatch", "resume-answer", "resume-finding"] }
        }
      }
    }
  }
}
```

Checked in code (`dispatch.mjs`): `skill` is `none` exactly for an
orchestrator kind, and then `report` and `template` are `null` and
`launches` is empty; `launches` otherwise starts with one `initial`.

### A.9 `owner-files.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/owner-files/1",
  "type": "object",
  "additionalProperties": { "type": ["string", "null"], "pattern": "^[0-9a-f]{64}$" }
}
```

Keys are the `owner_files` paths; a value is the file's sha256 in hex, or
`null` when the file was absent.

### A.10 `adapter.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/adapter/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "added", "created"],
  "properties": {
    "version": { "enum": [1] },
    "added": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false, "required": ["file", "pointer", "value"],
        "properties": {
          "file": { "type": "string", "minLength": 1 },
          "pointer": { "type": "string", "minLength": 1 },
          "value": {}
        }
      }
    },
    "created": { "type": "array", "items": { "type": "string", "minLength": 1 } }
  }
}
```

`added` lists each value `install` added to a JSON file: `pointer` is a JSON
Pointer to the array it was appended to (`/permissions/deny`,
`/hooks/PreToolUse`, `/hooks/SubagentStop`), and `value` the exact element.
`created` lists the files `install` created (`.claude/agents/hsdd-auto-step.md`,
and `.claude/settings.json` when it did not exist). `uninstall` removes each
`added` element that is still present, deletes each `created` file it still
owns (unchanged since creation), and deletes `adapter.json`.

### A.11 `handoff-skip.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-auto/handoff-skip/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["segment", "handoff", "at", "status", "reason"],
  "properties": {
    "segment": { "type": "string", "minLength": 1 },
    "handoff": { "type": "string", "pattern": "^H[0-9]+[a-z]?$" },
    "at": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" },
    "status": { "enum": ["skipped"] },
    "reason": { "type": "string", "minLength": 1 }
  }
}
```

---

## Appendix B. The Step Preamble

`templates/preamble.md`, verbatim except for its slots, which the table after
the text fills.

````markdown
# Step preamble

You are one step of an unattended HSDD run in this repository, on branch
`{branch}`. An orchestrator sequences the steps, answers the owner's
questions when a skill stops, commits, and keeps the decision ledger. You run
exactly one HSDD skill invocation, on the one target your step section names,
then write your report and end your turn.

{segment_context}

## Inputs and limits

Your inputs are:

- this repository;
{source_lines}
- the HSDD skills under `{skills_dir}`;
- the toolchain below, and public package documentation.

Do not read these paths, and do not search for what they hold:

{out_of_bounds_lines}

## Facts from the owner

These are facts, not decisions. Use them as given and never re-decide them.

{owner_fact_lines}

The owner's standing preferences:

{preference_lines}

## Decision policy

Decide and record everything HSDD's planning asks of a human, except the stop
conditions below. That includes scope, ordering policy, contract validation
format, accepting proposed ADRs, resolving open questions in the node that
owns them, decomposition shape and depth, contract interfaces and guarantees,
phase plans, tiers and gates, and at reconcile the `confirm` entries, the
`request` entries that break no consumer, and non-breaking `amend` entries.
Where the right resolution is a change to a read-only source, resolve it
locally and set `would_upstream: true`.

A decision is recorded when it is taken, never reconstructed. A decision with
no evidence says so in `why`. When two options are close, say which signal
would have changed your mind. When a fact in this prompt matters to a
decision, check it against the file it cites first; the files win.

## Stop conditions

These end your turn and go to the orchestrator:

{stop_set_lines}

{policy_paragraph}

A predecided answer in your step section replaces a stop of its class, except
a breaking change under `compatibility: frozen` or at `v0`, which you report
as a run-stop candidate whatever the predecided answers say.

## How the policy applies to you

1. **A skill stop is never yours to answer.** Invoke your skill with
   `--unattended` and your step id in its arguments, as your step section
   shows. When the skill's `## Unattended runs` table says `return`, write
   your report with `status: "stopped"` and the `stop` object, leave your
   partial artifacts in place, and end your turn.
2. **A stop condition met outside a skill stop is reported, not acted on.**
   End your turn with `status: "run-stop-candidate"` and the same `stop`
   object, where `question` is your one-sentence statement of the condition
   and `skill_rule` quotes the class's "Raised when" line from the stop
   conditions above. For `shape`, the condition holds only when both leading options
   are defensible, they produce different nodes or a different set of
   contracts, and nothing in the sources, the owner's facts, HSDD's rules or
   an experiment gives one a stated reason to lead. When something does,
   decide and cite it.
3. **Everything else you decide**, and mark `would_have_asked: true` with a
   class (`judgement` unless a stop class fits) when a careful engineer would
   have asked the owner first.
4. **Record each decision when you take it**, with the decide command your
   step section gives, the decision as one JSON object on stdin, in this
   shape:

   ```json
   {
     "artifact": "hsdd/spec/example.md",
     "question": "the question as it arose; a skill's wording verbatim",
     "options": [
       { "label": "short label", "consequence": "what choosing it costs or buys" },
       { "label": "another label", "consequence": "..." }
     ],
     "chosen": "short label",
     "why": "the reason, for the owner reading cold",
     "evidence": ["Spec §3.4", "hsdd/auto/experiments/example/"],
     "blast_radius": "node-local",
     "confidence": "high",
     "would_have_asked": false,
     "stop_class": null,
     "would_upstream": false
   }
   ```

   `artifact` is `null` when the decision lands in no file. `blast_radius`
   is `node-local`, `contract`, `tree` or `upstream`; `confidence` is
   `high`, `medium` or `low`; `stop_class` is a class when
   `would_have_asked` is true, else `null`. The command prints the decision's
   id; never write a time or an id yourself. Record one decision per real
   choice between options, including small ones your skill forces; do not
   pad.

## Rules of the run

- Write only your step section's write set, your report files, and
  experiments under `{experiments_dir}/`. Never write under
  `hsdd/judgement/`, elsewhere under `hsdd/auto/`, or any of these read-only
  paths: {read_only_list}.
- Do not commit, stage, stash, branch, reset, check out, or otherwise change
  git state. The orchestrator commits after checking your work.
- Do not invoke interactive companion skills such as brainstorming. Invoke
  the HSDD skill your step names with the Skill tool and follow it exactly.
- Leave these owner files untouched: {owner_file_list}.
- **Experiments.** When a decision depends on a runtime fact, write a
  throwaway program under `{experiments_dir}/{{name}}/`, run it with the
  toolchain below, keep the source and the captured output, add a
  `README.md` of at most ten lines whose first line is the finding, and cite
  the directory as evidence. Never guess a fact a short program settles.
  Never add an experiment to the project's build or workspace.
- **Toolchain.** {toolchain_lines}
- **Prose rules for everything you write.** {prose_rule_lines}
- **Citations.** {citation_lines}

## Your report

Write your report to the path your step section gives (for a resume, the
path the resume message gives), as one JSON object in this shape:

```json
{
  "step_ref": "S07",
  "skill": "hsdd-contract",
  "target": "auth-token",
  "status": "completed",
  "stop": null,
  "artifacts": ["hsdd/contract/auth-token.md"],
  "experiments": [{ "path": "hsdd/auto/experiments/example/", "question": "...", "finding": "..." }],
  "self_check": [{ "gate": "the skill's quality gate, verbatim", "status": "pass", "note": "..." }],
  "routed": [
    { "target": "acme.backend.billing", "kind": "consider", "text": "..." },
    { "target": "run", "kind": "insert-step", "text": "why", "step_kind": "spec-touch", "step_target": "acme.backend" }
  ],
  "closes": [{ "id": "Q-004", "outcome": "addressed", "note": "..." }],
  "reads_outside": [],
  "notes": ["anything else the orchestrator should know"],
  "read_check": "the eight hex digits on this file's last line"
}
```

`status` is `completed`, `stopped` or `run-stop-candidate`. When not
completed, `stop` is `{ "question": "verbatim", "skill_rule": "the skill text
that requires the stop", "stop_class": "...", "options": [{ "label": "...",
"consequence": "..." }], "recommendation": "a label", "blocks": "what cannot
proceed" }`. `self_check` quotes each of your skill's quality gates; a gate
that requires a human act is `n/a`, its note naming the decision that stood
in for it; a gate whose subject this step did not touch is `n/a` with the
note `not exercised by this step`. `routed` kinds are `must-address`, `consider` and `insert-step`.
`closes` lists every item your step section routes to you, with outcome
`addressed` or `explained`. `reads_outside` lists files you read outside
what your skill reads, each as `{ "path": "...", "why": "..." }`.
`read_check` is the value on this file's last line; it shows you read the
file to its end, and a resume report carries the same value. In a resume
report, `status`, `stop` and `self_check` describe the step as it now stands;
the list fields hold only what the resume added. Your
decisions are not in the report: the decide command has recorded them.

Then end your turn with a two-line summary: the status, and when stopped the
question verbatim.
````

| Slot | Filled from |
|------|-------------|
| `{branch}`, `{skills_dir}`, `{experiments_dir}` | `run.yaml` |
| `{segment_context}` | "This step belongs to segment {id} ({mode}), opened {opened_at} by the owner's instruction:" and the instruction quoted; then one line for each of the three most recent earlier segments: its id, mode, first and last step, and the first sentence of its paragraph in `plan.md`'s `## Segments`; then, when more exist, one line with their number and that heading's path. |
| `{source_lines}` | One line per source: path, role (normative; informative; baseline, "read only to see what changed"), citation name, version, and authority or `absent`. |
| `{out_of_bounds_lines}` | `out_of_bounds`, one per line, or `none`. |
| `{owner_fact_lines}`, `{preference_lines}` | `owner_facts`, `preferences`, one per line, or `none`. |
| `{stop_set_lines}` | One line per class in `stop_set`, with §8.2's "Raised when" text. |
| `{policy_paragraph}` | Fixed text per policy. `stop`: "The orchestrator ends the run on these and asks the owner." `decide-and-record`: "The owner asked not to be asked in this segment. The orchestrator answers these as the owner's stand-in and records each answer with `would_have_asked: true`, except needs outside the repository it cannot meet. For you nothing changes: you report stops, you never answer them." |
| `{read_only_list}`, `{owner_file_list}` | `read_only`, `owner_files`, comma-separated, or `none`. |
| `{toolchain_lines}` | `toolchain.rules`, then "Use exactly these command prefixes:" and each `toolchain.commands` entry; or `none`. |
| `{prose_rule_lines}` | Each banned character by its Unicode name and code point (never the character itself), each banned phrase, and the `token_forms` as §7.6 states them; or `none`. |
| `{citation_lines}` | "Cite sources by citation name and section number, for example `{cite} §3.4`", with each source's citation name, and for each baseline source "name its version, for example `{cite} {version} §3.4`". |

---

## Appendix C. Step Section Templates

### C.1 The common skeleton

Each `templates/steps/{kind}.md` is this skeleton with the kind's
**What to do** and **Done when** text from C.3 in place. Slots are filled by
the tables in C.2 and C.4.

````markdown
## Your step: {step} ({kind}{handoff_suffix})

- **step_ref:** {step}
- **Skill:** `{skill}`{skill_mode}. Invoke it with the Skill tool; its
  arguments are the invocation below followed by ` --unattended {step}` (a
  leading `/hsdd-...` in the invocation is dropped: the tool names the skill).
- **Target:** {target_line}
- **Report:** `{report}`
- **Decide command:** `{decide_command}`
- **Write set:** {write_set_list}, your report files, and `{experiments_dir}/`.

### Invocation

{invocation}

### Facts

Read from the repository at commit `{head}` when this prompt was rendered.
Each line names its file; check it there before relying on it.

{fact_lines}

### Routed to this step

{routed_lines}

### Predecided answers

{predecided_lines}

### Continuing

{continuing_lines}

### Context from the orchestrator

{context_lines}

### What to do

(the kind's text from C.3)

### Done when

(the kind's text from C.3)
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
````

### C.2 Skeleton slots

| Slot | Filled from |
|------|-------------|
| `{step}`, `{kind}`, `{skill}`, `{report}`, `{head}` | The dispatch file's front matter. |
| `{handoff_suffix}` | `, handoff {id} of {record path}` for an intake handoff; otherwise empty. |
| `{skill_mode}` | ` in graft mode`, ` in promotion mode`, ` in append mode` or ` in align mode` for `graft`, `promote`, `phase-plan-append` and `align`; otherwise empty. |
| `{target_line}` | The target, then the files it resolves to (§6.5, §12.2). |
| `{decide_command}` | `node hsdd/scripts/auto/decide.mjs --step {step} --stdin` |
| `{write_set_list}` | The dispatch file's `write_set`, comma-separated, each in backticks. |
| `{experiments_dir}` | `run.yaml`. |
| `{invocation}` | An intake handoff's `prompt`, verbatim; otherwise the kind's default invocation from C.3, rendered. |
| `{fact_lines}` | C.2a below. |
| `{routed_lines}` | Every open queue item matching the step (§6.5): id, kind, from, text. Or `none`. |
| `{predecided_lines}` | One line per `predecided` entry: class, answer, decision id; or `none`. Keys are stoppable classes, so there are at most seven lines. |
| `{continuing_lines}` | For a continuation: the stopped step's id, its dispatch file's path, every report file of its series, its artifact commit, and each decision taken on its stop (id and chosen label): the orchestrator's decisions in the stopped step's sidecar, and any `by: owner` decision whose evidence names the stopped step. Then "Finish the work from where it stopped; its partial artifacts are committed." Otherwise `none`. |
| `{context_lines}` | The `--context-file`'s lines, or `none`. |

**C.2a Facts per kind.** Each line ends with the path it was read from.

| Kind | `{fact_lines}` holds |
|------|----------------------|
| `root-spec` | Each source's path, role, version and authority (or `absent`); whether `hsdd/` and `hsdd/conventions.md` exist. The owner facts are already in the preamble. |
| `mid-level-spec`, `graft`, `promote`, `spec-touch` | The target's header fields and `Decomposes into`; each contract version it produces or consumes with `version`, `status`, `phase_ids`, read from the file that holds that version (v0.10.0 §3.1); each ADR that governs it with `status`; the parent's embedded summary of it; for a graft, the parent's children.; for a promotion, the node's `Adopted` line and its `## Observed surface` heading. |
| `adr`, `adr-update` | The spec lines that propose or cite the ADR; its current front matter (update); the specs and contracts it `affects`. |
| `contract`, `contract-touch` | The producing node's `Produces` line and each consuming node's `Consumes` line; each ADR whose `affects` names this contract; the contracts it builds on, with versions and statuses; for an `id` with more than one version file, or a `{id}.v{n}` target, each version's `version`, `status` and `phase_ids`; the front matter and `## Versioning` of each file the target resolves to (touch); their validation paths and whether they exist. |
| `citation-touch` | Every contract's current `version`, and each lower version that stays live (a file of its own, neither `deprecated` nor `retired`); every source's citation name and version, with the baseline sources marked; the superseded strings of §12.2; every phase id with a verification doc on the main line (the conventions' `**Main line:**`, `main` when absent), by node (§12.4). |
| `phase-plan`, `phase-plan-append` | The node's `Purpose`, `Owns`, `Produces` and `Consumes`; each consumed and produced contract version with `version`, `status`, `phase_ids` and validation paths, read from the file that holds that version; the governing ADRs; `conventions.md`'s ordering policy, coding method and teams lines; for append, the existing phase ids, which of them have a verification doc on the main line, and the intake record's path. |
| `reconcile`, `align` | Every pending section in the tree with its entry counts, the named nodes first; every contract version those entries name with `version`, `status`, `phase_ids`, from the file that holds it; for align, every phase id with a verification doc on the main line, by node (§12.4). |
| `intake` | The request's path and authority; every open intake record's path and landings; the atlas's path, or the tree's node list; for a new source version, the old and new paths and versions; the number of earlier `would_upstream` decisions, and `node hsdd/scripts/auto/state.mjs upstream`, which lists them. |

### C.3 Instructions per kind

**`root-spec`** (`hsdd-spec`, root). Default invocation: "Decompose the
system into its root node, `{target}`, from the normative sources and the
owner facts." What to do: follow `hsdd-spec` at the root. Write the root
spec and one spec file per child. Name every contract on an edge by id;
propose ADRs for cross-cutting decisions; mint open questions in the node
that owns them. Seed `conventions.md` with the coding method, ordering policy
and teams lines the owner facts give. List every source in `## Sources`
with the authority `run.yaml` gives it, deciding and recording one where it
is absent, and mark each informative source with the skill's phrase
"informative only, not decomposed". Done when: the root spec and every child's file
exist; `conventions.md` exists; every edge names its contract id.

**`mid-level-spec`** (`hsdd-spec`). Default invocation: "Decompose
`{target}`." What to do: apply `hsdd-spec`'s rule for when to stop
recursing; either decompose into children with one file each, or mark the
node `leaf-parent` and say why. When the result changes what the parent's
embedded summary or DAG says, route an `insert-step` for a `spec-touch` on
the parent. Done when: the node's Kind is final and every child it names
has a file.

**`graft`** (`hsdd-spec`, graft mode). Default invocation: "Graft under
`{target}` the child this step's routed item or handoff names: {reason}."
What to do: follow graft mode (v0.10.0 §11.4): the new child takes the next
slug; the parent's child summaries and DAG gain it; contracts it consumes
from siblings are left to the child's phase plan's `request` entries. Done
when: the child's file
exists and the parent names it.

**`promote`** (`hsdd-spec`, promotion mode). Default invocation: "Promote
`{target}` from as-built to governed: {reason}." What to do: follow promotion
mode (v0.10.0 §6.4) with the node's `## Observed surface` as a primary source
beside the request; the confirmation the mode asks for is a `promotion` stop
unless predecided. Its `v0` contracts stay at `v0` unless the promotion
redesigns one (`hsdd-contract`'s versioning policy). Done when: the node's
`Adopted` line reads `promoted`, `## Observed surface` is kept, and its spec
reads as a governed node's.

**`spec-touch`** (`hsdd-spec`). Default invocation: "Touch `{target}`:
{reason}." What to do: follow the skill's **Touch** paragraph (§12.1): change
only what the invocation and the routed items name. Do not edit the node's `## Phase Plan`. Done when: every routed item is closed and nothing
else in the file changed.

**`adr`** (`hsdd-adr`). Default invocation: "Materialize `{target}` as
`{proposing_spec}` proposes it." What to do: write the ADR `accepted` under
the decision policy, citing your acceptance decision's id in its
`## Context` (§12.1); run an experiment when the decision rests on a runtime
fact; add `Governed by` to every node it affects and `governed_by` to every
contract (§12.1); regenerate
the registries, copying the generator from `hsdd-contract` verbatim when it
is missing. Done when: the ADR file exists and every `affects` target names
it.

**`adr-update`** (`hsdd-adr`). Default invocation: "Update `{target}`:
{reason}." What to do: add an entry under `## Amendments` (§12.1) or
supersede, as the invocation says; never rewrite the decision's history. Done when: the change is in
place and every `affects` target is consistent with it.

**`contract`** (`hsdd-contract`). Default invocation: "Author
`{target}@{target_version}`." What to do: write every front-matter field
(`status: draft`, `phase_ids: provisional`, `governed_by` naming the ADRs the
facts list), the Interface, Guarantees with ids `G{n}`, `## Versioning` with
its `Breaking:` line (§12.1), and `## Validation` with the schema and
fixtures written now; prove executable fixtures with an
experiment where the toolchain can run them; regenerate the registries. Done
when: the file and its validation paths exist.

**`contract-touch`** (`hsdd-contract`). Default invocation: "Touch
`{target}`: {reason}." What to do: classify the change against the
contract's own `## Versioning`. A breaking change to a `stable` contract is a
`breaking-amend` stop unless a predecided answer covers it; then apply the
answer; under `compatibility: frozen` or at `v0` it is a run-stop candidate
whatever the predecided answers say (§8.2). Update the fixtures with the
text. Done when: the change is in
place, classified and recorded.

**`citation-touch`** (`hsdd-contract`, `hsdd-adr` or `hsdd-spec`). Default
invocation: "Citation touch {target_file}: move its citations to the
current versions." What to do: apply §12.4's citation-touch rule exactly:
never move a contract version in a node header's `Produces` or `Consumes`
line, a copy of it above the node, or an ADR's `affects`; leave every
citation of a live earlier version (`coexisting`) and route a `consider`
item for it; report the counts moved and kept in `notes`. Done when: no
citation the rule moves names a superseded string, and every sentence that
restates another artifact is true against its current text.

**`phase-plan`** (`hsdd-phase-plan`). Default invocation: "Plan the phases
of `{target}`." What to do: follow the skill's phase record and
plan document templates exactly; they are the format. Read the node's own
spec, its contracts, its ADRs and `conventions.md`. **Do not open another
node's `## Phase Plan` or pending section**, for format or anything else
(v0.10.0 §8.3). Every gate of a producing phase replays the contracts it
produces. Emit `confirm`, `amend` and `request` entries in the pending
section. A gap in a consumed contract that changes which phases exist is a
`shape` stop. Done when: the plan has its summary table, dependency graph
and pending section.

**`phase-plan-append`** (`hsdd-phase-plan`, append mode). Default
invocation: "Append phases to `{target}` per {record}." What to do: as
`phase-plan`, plus append mode's rules (v0.10.0 §11.3): never renumber;
never rewrite a shipped phase (one with a verification doc on the
conventions' `**Main line:**`, `main` when absent, v0.10.0 §14.2); rewrite an unshipped phase in place only when the invocation says
so (§12.1); every phase rewritten or appended cites in its Scope the intake
record, or in a plan segment the `insert-step` item's id; when there is a
record, the request joins the node's Sources; the pending section gets a new
emission date line. Done when: as `phase-plan`, and every phase the
invocation names is rewritten or explained.

**`reconcile`** (`hsdd-reconcile`). Default invocation: "Reconcile
{target}." What to do: follow the skill's steps in order. A collision is a
`collision` stop; an amend or request answer that breaks a consumer of a
`stable` contract is a `breaking-amend` stop unless predecided; for a
`draft` contract, and for every other request, you decide. Hand nothing to
`hsdd-adr` or `hsdd-contract` yourself: route an `insert-step` (§12.1). Done
when: every pending section in the tree is stamped as reconciled (the skill
drains the whole tree; the target names the plans this step was ordered for)
and the flips the skill allows are made.

**`align`** (`hsdd-reconcile`, align mode). Default invocation: "Align
{target} after {reason}." What to do: §12.3. Route
every finding beyond citations and gate arguments to its owning skill. Done
when: the named plans cite no superseded version, except history.

**`intake`** (`hsdd-intake`). Default invocation: "Route `{request}`
({authority}) into the tree." What to do: follow `hsdd-intake`: read every
open intake record first, locate the landing, classify, and write the record
before any handoff, with the handoff block of §12.2. A `structural` class is
a `shape` stop. A landing on an as-built node puts a `promote` handoff first
(§9.2). For a new version of a source, order the handoffs: content handoffs producer-first
(ADRs and contracts before the specs and plans that consume them); then one
`citation-touch` per artifact that may still cite a superseded string
(`when: cites-superseded`); then, for each affected leaf-parent, a
`phase-plan-append` and a `reconcile` (a `spec-touch` only for a change to
the node's own text, never for the contract version in its header, which
the reconcile writes). Order no align: the
segment's align stage follows the handoffs (§9.2). State an insert rule. Read the earlier `would_upstream` decisions in
the facts against the request, and record in `notes` which it adopts,
contradicts or leaves open. Write no spec, contract or ADR. Done when: the
record exists with every header field, its prose routing and its handoff
block, and the two agree.

### C.4 Instruction slots

| Slot | Filled from |
|------|-------------|
| `{target}` | The step's target (§6.5). |
| `{target_file}` | The files the target resolves to, each in backticks, comma-separated: for a contract `id`, every version's file (`H/contract/{slug}.md`, then each later version's, v0.10.0 §3.1), for `{id}.v{n}` that version's file (`H/contract/{id}.v{n}.md` before it exists); the ADR's file; or `H/spec/{node}.md`. |
| `{target_version}` | For `{id}.v{n}`, `v{n}`; for a contract `id`, the highest version the specs cite for it (`v1` when none). |
| `{proposing_spec}` | The first spec file, in the root spec's order, that cites the ADR. |
| `{reason}` | The text of the `insert-step` item the step executes, or of the routed items it closes, joined; or for an `align` from a stage rule, `the consistency pass` in plan mode and `the segment's handoffs` in intake mode. |
| `{record}` | The path of the segment's intake record; in a plan segment, `the insert-step item {id}` that ordered the step. |
| `{request}`, `{authority}` | The segment entry. |
