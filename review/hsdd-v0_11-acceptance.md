# HSDD v0.11 Acceptance

**Status:** Expectations committed before any live run. Results are recorded
below each run after it, never edited into the expectations.
**Method:** a cold-context session with the twelve v0.11 skills installed,
run against a sandbox project (a throwaway repository with a small
three-node specification, never a real project). Run every command from the
sandbox's repository root.
**Spec:** `spec/hsdd-spec-v0_11.md` section 17.2;
`docs/superpowers/plans/2026-10-22-hsdd-auto-decisions.md` (the settled
build decisions).
Every `Result:` is filled by the owner's run, never by the builder.

## Preface: what has and has not run

The builder ran no live acceptance. The script-level evidence is
`test/auto-e2e.test.mjs`, which drives every script through its CLI as the
orchestrator drives it, with a scripted stand-in for each step subagent. It
covers seven scenarios:

| Scenario | Maps to |
|----------|---------|
| plan, decide-and-record: stage 0 to done | run 1 |
| plan, stop: an axis stop ends the run, the owner's answer opens a segment, the continuation runs to done | run 2 |
| procedural stop: an unminted open question inserts a `spec-touch`, then the continuation finishes the plan | run 3 |
| intake: handoffs run or skip by their condition under a predecided `breaking-amend` | run 4 |
| rework: a report that fails B3 is resumed once and passes; two planted failures raise `gate-twice` (two tests) | run 5 |
| interruption: lost launches are re-dispatched under the same id, and a crash between the two commits reruns to one of each | run 6 |
| bundled copy: after the setup step `hsdd/scripts/auto/` is byte-identical to the skill's scripts | the install check inside run 1 |

Runs 7 and 8 have no script-level counterpart: the adapter needs a real
host, and the cost needs real token usage. The stand-ins prove the scripts
and the loop; they say nothing about whether a real subagent decides well.
The owner runs these cold.

## 1. Plan, decide-and-record

### Setup

A sandbox with a three-node specification as its only source and an owner
fact that names who builds what. `/hsdd-auto` answers the first-run
questions, then `/hsdd-auto --stop-policy decide-and-record` plans the tree.

### Expected

- `node hsdd/scripts/auto/state.mjs done` prints `DONE {segment id}`.
- The plan segment's done definition holds: every contract above `v0` is
  `status: stable` with `phase_ids: final`; the registries regenerate clean;
  `node hsdd/scripts/auto/gate.mjs --final` exits 0; `git status --porcelain`
  prints nothing apart from the owner files.
- `git log --oneline` shows two commits per step: an artifact commit, then
  a judgement commit.
- `node hsdd/scripts/auto/ledger.mjs validate` exits 0. Every decision
  carries an `at` stamp inside its step's window and an id minted by
  `decide.mjs`, with no gap in the ids.
- Every step has a committed `hsdd/auto/dispatch/{step}.md`.
- `hsdd/auto/report/{segment id}.md` has no empty prose slot, and lists the
  `would_have_asked` decisions first.
- `node hsdd/scripts/auto/state.mjs` shows `hsdd/scripts/auto/` as an exact
  copy of the skill's scripts (`diff -r skills/hsdd-auto/scripts
  hsdd/scripts/auto` prints nothing).

Result:

## 2. Plan, stop

### Setup

The same sandbox, reset to its state before run 1, with no owner fact for
who builds what and the `stop` policy.

### Expected

- The root step ends `stopped`: `hsdd/judgement/STOP.md` exists with
  `**Stop class:** axis`, a question, two or more options and a
  recommendation; the tree is clean; `state.mjs done` prints
  `STOPPED {segment id}: hsdd/judgement/STOP.md`.
- A bare `/hsdd-auto` is refused and shows `STOP.md`'s question.
- `/hsdd-auto` with an answer opens a new segment. Its `setup` decision is
  `by: owner` and names the stopped step; `STOP.md` is gone.
- A continuation of the root step is dispatched with the answer, and the
  run continues to `DONE {new segment id}`.

Result:

## 3. Procedural stop

### Setup

The planned sandbox's tree reset to before phase planning, with one
`leaf-parent` whose spec cites an open-question id that no spec mints.

### Expected

- The `phase-plan` step is committed as `stopped` with class `procedural`,
  and no `STOP.md` is written.
- A `spec-touch` step is inserted (`hsdd/auto/plan.md`'s change log cites
  the decision that accepted it) and mints the id.
- A continuation of the `phase-plan` step finishes the plan, and
  `state.mjs done` prints `DONE {segment id}`.

Result:

## 4. Intake

### Setup

On the planned sandbox, a change request that breaks one `stable` contract
under `compatibility: versioned`. `/hsdd-auto intake {request path}
--stop-policy decide-and-record`, with a predecided `breaking-amend` answer
in `run.yaml`.

### Expected

- The contract takes its next version; `node hsdd/scripts/auto/gate.mjs
  --final` exits 0.
- Every artifact that cites the old version gets a citation touch, or its
  handoff is listed in `hsdd/auto/handoffs.jsonl` with the condition that
  skipped it.
- The align runs, or its target set is empty (every leaf-parent was
  re-planned by a step of the segment).
- Searching the tree for the old version leaves only history (change logs,
  version tables).
- The intake record's `## Produced` is filled and lists no phases;
  `**Status:** open` is unchanged.
- Every `breaking-amend` decision of a step cites the predecided decision.

Result:

## 5. Rework

### Setup

Plant a step whose report omits a queue item the dispatch file listed in
`closes` (gate check B3).

### Expected

- The step is resumed once (`dispatch.mjs --resume`, reason `finding`) and
  passes; its run lines show the resume.
- Then plant a second failure on a later step: the step raises
  `gate-twice`. Under `decide-and-record` it is committed `stopped`, its
  decision is recorded, and a continuation with a fresh subagent receives
  the findings. Under `stop` it ends the run with `STOP.md`, class
  `gate-twice`.

Result:

## 6. Interruption

### Setup

Run a segment and end the host session twice: once while a step subagent is
running, and once after `commit.mjs` has made the artifact commit and
before it makes the judgement commit.

### Expected

- After the first end, `/hsdd-auto` runs `dispatch.mjs --redispatch {step}`:
  a new launch under the same step id; no second step id is minted.
- After the second end, `/hsdd-auto` runs `commit.mjs` again for the same
  step; `git log --oneline` shows exactly one artifact commit and one
  judgement commit for it.
- `ledger.mjs validate` exits 0, and no decision was minted twice.
- A leftover `hsdd/auto/.decide.lock` was removed.

Result:

## 7. Adapter

### Setup

A first-ever setup in the sandbox, in a host session started before
`adapter.mjs install` ran.

### Expected

- `node hsdd/scripts/auto/adapter.mjs check` exits 0.
- `.claude/settings.json` holds deny rules for every `out_of_bounds` and
  `read_only` entry, each as the path itself and the path with `/**`.
- The setup step's decision records that host enforcement installed by this
  setup applies from the next host session, and that until then the rules
  are prompt instructions (decision B-25). The run does not stop for it,
  and the segment's final message names that decision.
- In the next host session, a test step asked to read an `out_of_bounds`
  file is refused by the host (a denied tool call, not a prompt
  instruction), and `ls` of the project root is allowed.

Result:

## 8. Cost

### Setup

Run 1 with the host's model and usage passed to every `commit.mjs` call
(`--model`, `--usage-file`).

### Expected

- The orchestrator's output tokens and its share of all output tokens are
  recorded here, next to FT-3's 28% (spec section 16.1). This is evidence,
  not a pass condition.

Result:
