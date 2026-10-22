---
name: hsdd-auto
description: >
  Use when the owner hands HSDD's planning chain to an unattended run: an
  empty tree planned through reconcile, or one change request routed through
  every handoff its intake record names, one fresh subagent per skill
  invocation, every decision recorded for one review sitting afterwards.
  Triggers: "/hsdd-auto", "plan the whole tree without asking me", "run the
  planning unattended", "route this change request through every handoff",
  "take in the new spec version end to end", "resume the unattended run",
  "where is the run". Do NOT use for one skill invocation with the human
  present (invoke that skill), for adoption (hsdd-adopt, whose confirmation
  is the owner's), for executing phases (hsdd-config), for checkpoints,
  milestones or reading aids (hsdd-checkpoint, hsdd-milestone,
  hsdd-summary), or under the standalone-spec-repo profile.
---

# HSDD Auto: Unattended Planning Runs

Run HSDD's planning chain without the owner at each ask point. The scripts do
every part that has one right answer: the next step, its prompt and write
set, the gate, both commits, the records, every timestamp. You do the
judgement: answer or stop on each ask point per the owner's stop policy,
review each step, accept or reject inserted steps, write the plan's change
log and the report's prose. A fresh step subagent runs each HSDD skill
invocation. You never run a planning skill in your own context, never
implement a phase, never pass a review gate.

**Core principle: the files are the memory.** Every fact a prompt states is
read from a file by `dispatch.mjs` or cited to one. Every decision is minted
and stamped by `decide.mjs` when it is taken. Everything needed to continue
is on disk. The owner reviews the ledger afterwards in one sitting, so every
answer you give on the owner's behalf is listed, never hidden.

## Invocation

```text
/hsdd-auto                          start a run, or resume the current segment
/hsdd-auto intake <source> [flags]  open an intake segment for one change request
/hsdd-auto status                   show where the run is; changes nothing
```

Flags: `--stop-policy stop|decide-and-record` sets the opening segment's
policy; for an intake, `--authority accepted-rfc|draft|ticket|incident|braindump`
gives the request's authority, default `draft`. `status` runs
`node hsdd/scripts/auto/state.mjs` and shows its output (with no
`hsdd/auto/run.yaml`, say no run is configured).

The **only interactive moment** is the first run's questions. After that,
ask the owner nothing: every answer is a recorded decision, or the run ends
with `STOP.md`. Words in the invoking message that bear on the run ("do not
ask me anything", "treat v2 as normative") become `setup` decisions of the
segment they open; never apply them silently.

**Scripts.** Run every command from the repository root; the scripts take
the working directory as the root. Commands are written
`node hsdd/scripts/auto/{script}.mjs`. Until the `setup` step's
`state.mjs install-scripts` has made that copy current (no copy yet, or its
`VERSION` differs from this skill's), run the same command from this skill's
`scripts/` directory (its base directory is printed when the skill loads).
Exit 0 is success, 1 a refusal or failed check whose findings it printed, 2
a usage error. `next.mjs` and `state.mjs --json` print one JSON document.

**Files you write for a script** (the owner's instruction, a resume message,
a context file, a `next.mjs` result, the host's usage) go in a scratch
directory outside the repository and outside every `out_of_bounds` path: a
stray file inside the repository fails the gate's A1, and the adapter's Bash
hook refuses any command that names an out-of-bounds path. Decisions go to
`decide.mjs` on stdin.

**Git.** Change git state only through `commit.mjs` and
`state.mjs open-segment`. Never commit, stage, amend, rebase, squash or
push yourself. Steps run one at a time: never launch a subagent while
another step is open.

## Preconditions

- Run from the repository that holds the tree at `hsdd/` (or will, for a
  plan run on an empty tree).
- Not the standalone-spec-repo profile declared in `hsdd/conventions.md`.
- A clean working tree apart from the declared owner files (and a
  `hsdd/auto/run.yaml` the first run has just written).
- The six planning skills (`hsdd-spec`, `hsdd-adr`, `hsdd-contract`,
  `hsdd-phase-plan`, `hsdd-reconcile`, `hsdd-intake`) under `skills_dir`,
  each with its `## Unattended runs` section. Otherwise: reinstall HSDD 0.11.
- Node.js 20 or later on the path.

`node hsdd/scripts/auto/state.mjs preflight` checks the profile, the six
skills and Node; `state.mjs open-segment` runs it again and checks the tree.
A refusal says what to do and changes nothing.

**Memory isolation.** Agent hosts keep per-project memory and transcripts
outside the repository. Strongest: the owner starts the session with
`CLAUDE_CONFIG_DIR` set to a directory used only for the run (project
settings cannot set it). Otherwise propose the memory paths
(`~/.claude*/projects/*/memory`) for `out_of_bounds` in question 4.

## First run

Only when `hsdd/auto/run.yaml` is missing.

1. Run `node hsdd/scripts/auto/state.mjs defaults` (from this skill's
   `scripts/`; it needs no `run.yaml`). It prints JSON: `run`, `root`,
   `branch`, `base`, `skills_dir` (null when no candidate holds
   `hsdd-auto`) and `owner_files`. Read the root spec's `## Sources`,
   `hsdd/conventions.md` and the owner's agent instruction files for the
   other defaults.
2. Ask these in one batch, each with its proposed default:
   1. The run's name, the root node id, the branch (`auto/{run}`), the base
      (the current branch), and `skills_dir`.
   2. Who builds what: one team or several, and the team per subtree. The
      answer becomes an owner fact. On "decide", remove `axis` from
      `stop_set`; the root step then decides the axis with
      `would_have_asked: true` and class `axis`.
   3. The sources: normative, informative, baseline, each with its `cite`,
      `version`, and `authority` when known. Also `orchestrator_files`: the
      project instruction files that name a source, so a later `setup` may
      update them.
   4. `read_only` (always every source path) and `out_of_bounds`.
   5. Owner facts: what the run takes as given (coding method, tooling it may
      not install).
   6. Toolchain command prefixes and rules.
   7. Stop policy (default `stop`) and stop set (default all seven: `axis`,
      `shape`, `promotion`, `breaking-amend`, `collision`, `external`,
      `gate-twice`).
   8. Owner files: default the `owner_files` that `state.mjs defaults`
      printed (what `git status` shows modified or untracked). Entries are
      plain files, never directories or globs; the loader refuses those.
   9. Prose rules (`banned_chars`, `banned_phrases`, `token_forms`, `level`),
      proposed from the owner's instruction files.
   10. Commit trailers.
3. Write `hsdd/auto/run.yaml` in the YAML subset the scripts parse: block
   mappings and sequences, one-line flow collections of scalars or of flat
   flow mappings, one-line scalars, `#` comments. Quote a string holding
   `: ` or `#`, starting with a special character, or reading as a number
   or boolean. No anchors, multi-line scalars or tabs. End with a bare
   `segments:`. The fields are in this skill's
   `scripts/schema/run-config.schema.json`; the usual ones:

   ```yaml
   version: 1
   run: shop
   root: shop
   branch: auto/shop
   base: main
   skills_dir: .claude/skills
   owner_facts:
     - "Who builds what: one team builds the API and the web app."
   preferences: ["Functional-first: pure core, imperative shell."]
   sources:
     normative: [{ path: ref/spec.md, cite: Spec, version: v1, authority: accepted-rfc }]
   read_only: [ref/]
   out_of_bounds: ["~/.claude*/projects/*/memory"]
   owner_files: [notes/todo.md]
   orchestrator_files: [CLAUDE.md]
   toolchain:
     commands: { dart: fvm dart }
     rules: ["Always fvm dart, never a bare dart."]
   prose_rules:
     banned_chars: ["\u2014"]
     token_forms: { empty_cell: none, id_separator: ":", reason_separator: " - " }
     level: warn
   stop_set: [axis, shape, promotion, breaking-amend, collision, external, gate-twice]
   stop_policy: stop
   commit:
     trailers: ["Co-Authored-By: {name} <{email}>"]
   segments:
   ```

   Then run `node hsdd/scripts/auto/state.mjs preflight`: it loads the file
   (a parse or schema error names its line) and checks the preconditions.
4. Show the file and, for a bare `/hsdd-auto`, the one sentence you will open
   the segment with; the owner confirms. That sentence is the segment's
   instruction. Open the segment (The loop, step 1). Never ask again: a later
   configuration change is a `setup` decision of a new segment.

## The loop

### 1. Open or resume a segment

1. No `run.yaml`: First run.
2. Read `node hsdd/scripts/auto/state.mjs --json`. A new segment opens only
   when there is none yet, or the current one is finished (`next` is
   `{"done": true}`), stopped (`next` is `blocked`) or ended by an owner
   message (`segment.ended` is true). Otherwise resume it (Context recovery,
   then the step loop) and skip the rest of this list; refuse
   `/hsdd-auto intake` with that reason.
3. While `STOP.md` exists, the invoking message must carry the owner's
   answer. A bare `/hsdd-auto` is refused, showing `STOP.md`'s question.
4. A finished segment and a message with no instruction: show `state.mjs`
   and end.
5. Write the owner's message verbatim to an instruction file and open the
   segment with one of:

   ```bash
   node hsdd/scripts/auto/state.mjs open-segment --instruction-file {file} --mode plan
   node hsdd/scripts/auto/state.mjs open-segment --instruction-file {file} --mode intake --request {source} --authority {authority}
   node hsdd/scripts/auto/state.mjs open-segment --instruction-file {file}
   ```

   The first for a plan segment; the second for `/hsdd-auto intake`, always
   with `--authority` (`draft` when the owner gave none); the third for the
   segment that answers `STOP.md` or follows an owner-message end, which
   copies the ended segment's mode, request and authority. Append
   `--stop-policy {policy}` when the owner gave one. It checks out the run
   branch (creating it from `base`), appends the segment entry and prints it
   as JSON on its first line: keep its `id` and `first_step`.

### 2. The setup step

`node hsdd/scripts/auto/dispatch.mjs --next` starts it and prints only its
dispatch path; the step id is the segment's `first_step`. Then:

1. `node hsdd/scripts/auto/state.mjs preflight` (`open-segment` ran it
   already; it costs nothing to confirm).
2. `node hsdd/scripts/auto/state.mjs install-scripts`: copies the scripts to
   `hsdd/scripts/auto/` when the copy is not current, and
   `hsdd/scripts/gen-registry.mjs` from `hsdd-contract` when contracts exist
   and the copy is missing or differs. Never copy or edit them by hand.
3. `node hsdd/scripts/auto/state.mjs snapshot`: hashes the owner files into
   `hsdd/auto/owner-files.json`.
4. On Claude Code, `node hsdd/scripts/auto/adapter.mjs install` (or
   `adapter.mjs install --stop-hook` for the optional SubagentStop hook),
   then `node hsdd/scripts/auto/adapter.mjs check`. A check failure is a
   `setup` decision: fix it, or proceed with that rule as an instruction
   only. On another host skip both: the rules stay instructions in every
   prompt and the gate catches every write after the fact.
5. Record, each with `decide.mjs --step {step} --by orchestrator --stdin`:
   - the reading of each sentence of the owner's instruction that changes
     how the run behaves (which source is normative, the stop policy, a
     scope limit), the sentence quoted as evidence;
   - the segment's stop policy when it differs from `run.yaml`'s default;
   - each predecided answer (Deciding in advance);
   - each change to `run.yaml` or an `orchestrator_files` path made in this
     step, each with a change-log entry. For an intake whose request is a
     new version of a source: the new version joins `sources` as normative
     or informative with its `version`, the old one moves to `baseline` with
     its own, and the `orchestrator_files` that name the normative source
     follow;
   - an owner's answer to `STOP.md`, with
     `decide.mjs --step {step} --by owner --type setup --stdin`, its evidence
     naming the stopped step's id. Delete `STOP.md`. When an owner fact can
     carry the answer (an `axis` answer), append it to `owner_facts` and
     record that change;
   - an adapter check failure.
6. `node hsdd/scripts/auto/commit.mjs --step {step} --status completed`.

`run.yaml` changes only in a `setup` step, except a `predecided` entry a
`plan` step may add. A segment entry is never edited.

### 3. The plan step

`dispatch.mjs --next` starts it. Run `node hsdd/scripts/auto/next.mjs --stages`
and write the segment's paragraph at the end of `## Segments` in
`hsdd/auto/plan.md`: one block with no blank line, opening
`**{segment id}.**` and then one sentence stating the segment's purpose
(every later prompt quotes it; it ends at the first `.`, `!` or `?`
followed by a space). Then the mode, the owner's instruction, the stop
policy, the stages as `--stages` printed them, and the decisions you expect
to take. `plan.md` is prose the gate checks (D1): quote the instruction only
when it holds no banned character or phrase; otherwise paraphrase it and
point at the segment's entry in `hsdd/auto/run.yaml`, which keeps it
verbatim. Record as `plan` decisions any choice about the path the stages
leave open. Then `commit.mjs --step {step} --status completed`.

**`plan.md`** has three sections. `## Segments` is yours, one paragraph per
segment. `## Step log` is regenerated by `commit.mjs`; never touch it.
`## Change log` gets one entry per change to the path (an inserted or
rejected step, a skipped handoff, a configuration change, a continuation),
appended at its end, each opening with the id of the decision that made the
change (`- DEC-042: ...`), never a typed date. A skipped handoff takes no
decision of its own: its entry opens with the id of the `intake` step's
decision that made the handoff conditional (`when: cites-superseded`).
Before the first judgement commit `plan.md` may not exist: start it from
`commit.mjs`'s skeleton (`# Run plan: {run}`, `## Segments`, `## Step log`,
`## Change log`).

### 4. The step loop

Run `node hsdd/scripts/auto/next.mjs` and act on its result; repeat until it
returns `done` or `blocked`. `{file}` below holds the result as JSON, outside
the repository.

- `step`, a subagent kind: A subagent step (below).
- `step`, kind `report`: Finishing a segment.
- `skip`: write the change-log entry, then
  `node hsdd/scripts/auto/commit.mjs --skip {handoff} --reason "{reason}"`.
- `waiting`: a step is open. Context recovery.
- `stop`: a producer cycle.
  `node hsdd/scripts/auto/dispatch.mjs --plan --for stop --result-file {file}`,
  then A producer cycle (Answering a stop).
- `close`: an open item on `run` or the request path.
  `dispatch.mjs --plan --for close --result-file {file}`; record the
  decision; `routed.mjs close {item} --addressed|--explained --by {step} --note "{decision id}: {why}"`
  with the plan step as `--by`; commit.
- `decide`: an `insert-step` item still undecided.
  `dispatch.mjs --plan --for decide --result-file {file}`; accept or reject
  it (Inserted steps); commit.
- `stuck`: first check `state.mjs --json`'s `segment.ended`. When true, an
  owner message ended the segment: open the next segment of the same mode,
  that message as its instruction (The loop, step 1, third form), never a
  `--plan` step. Otherwise Stuck
  (Finishing a segment).
- `blocked`: the run is stopped. End, showing `STOP.md`'s question.
- `done`: run `node hsdd/scripts/auto/state.mjs done` and send the final
  message (Finishing a segment).

A `--plan` step is committed like any other step, `stopped` when it wrote
`STOP.md`. A decision always belongs to an open step: the one under review,
or a plan step. For one taken while no step is open, start
`dispatch.mjs --plan --for other`.

### 5. A subagent step

1. `node hsdd/scripts/auto/dispatch.mjs --next` writes
   `hsdd/auto/dispatch/{step}.md` and prints its path, a blank line and the
   launch prompt. Use `dispatch.mjs --next --context-file {file}` only for
   what the step needs from the run that no fact line carries. Every
   non-empty line of that file carries a citation token (a repository path with `/`, a commit sha, a
   step, decision or queue id, or `{cite} §{n}`), or the dispatch is
   refused. A refusal above 64 KiB lists slot sizes: when `context_lines`
   is among the largest, shorten the context file and run `--next` again;
   any other size refusal is a hard stop.
2. Launch the step agent with the launch prompt as its whole prompt. Never
   retype, extend or edit the prompt, and never edit a dispatch file: the
   subagent reads its instructions there, and the file is the audit record.
   The dispatch already has the skill invoked with `--unattended {step}`;
   adding it, or anything else, is not yours to do.
3. Wait for the hand-back (Waiting).
4. Read the latest report of the step's series:
   `hsdd/auto/steps/{step}.json`, or `{step}.r{n}.json` with the highest
   `n` after resumes.
5. `status` `stopped` or `run-stop-candidate`: Answering a stop.
   `completed`: Reviewing a step.
6. `node hsdd/scripts/auto/commit.mjs --step {step} --status completed`:
   the gate, the artifact commit, the records, the judgement commit. Add
   `commit.mjs --step {step} --status completed --model {id} --usage-file {file}`
   only when the host reports the subagent's model and usage
   (`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
   `cache_creation_input_tokens`, as JSON in a file outside the repository);
   never estimate. On a refusal, read the findings: a finding in the step's
   work is a rework; never bypass.

### 6. Waiting

Never poll: no status checks, no reading the subagent's files, no short
timers. With `dispatch.wait: hand-back` (the default) the host notifies you
when the subagent ends; with `foreground` the launch call returns its
result. You may set one fallback wake-up per launch, of
`fallback_wakeup_minutes` from `run.yaml`'s `dispatch` (default 30, never
under 20), for a subagent that hangs. When it fires, re-read `state.mjs`
and the subagent's status, then keep waiting with no further timer, or
treat the subagent as lost (Context recovery). A timed wait shorter than 20
minutes is a defect.

### 7. On Claude Code

- **Launch:** the Agent tool with `subagent_type: hsdd-auto-step` when the
  adapter is installed (otherwise the default agent type), the launch
  prompt as `prompt`, and a description such as "hsdd-auto step S07".
- **Hand-back:** the task notification (`dispatch.wait: hand-back`).
- **Resume:** a message to the same agent id (SendMessage) carrying,
  unedited, the text `dispatch.mjs --resume` printed.
- **Lost:** a subagent whose session ended or whose agent id no longer
  answers.
- **Fallback wake-up:** one background shell command that sleeps that many
  minutes.
- **`/goal`:** `node hsdd/scripts/auto/state.mjs goal` prints a condition
  line the owner may set; the loop needs none while hand-backs arrive.

### 8. What the modes walk

`next.mjs` evaluates the mode's stages from the top on every call and acts
on the first unfinished one.

- **plan:** setup; plan; root decomposition (`root-spec`); root ADRs (an
  `adr` per cited ADR id without a file); root contracts (a `contract` per
  named slug without a file, producer-first); mid-level decomposition (a
  `mid-level-spec` per internal node that names no child ids, then ADRs and
  contracts again); phase plans (a `phase-plan` per leaf-parent without
  one, producer-first, and a `reconcile` on every leaf-parent whose pending
  section has entries before the next `phase-plan`); consistency (a step
  per open `must-address` or `consider` item, then an `align` on `all`);
  report.
- **intake:** setup; plan; route (the `intake` step writes the record and
  its handoff block); handoffs (a step per handoff in block order, each once
  its `after` list is executed or skipped; one whose `when` does not hold
  comes back as `skip`); consistency (as plan, without the align); align (on
  every leaf-parent no step of the segment re-planned, when there is one);
  report. A `structural` request is a `shape` stop inside the `intake`
  step. Apply the record's insert rule through `insert-step` items, each
  accepted by a `plan` decision citing the rule. The record stays
  `**Status:** open`; never close it.
- A request that is a new version of a source moves citations: the setup
  updates `sources`, and the record routes one `citation-touch` per citing
  artifact with `when: cites-superseded`, after the content handoffs.

## Judgement points

Each judgement is a decision in an open step, recorded with `decide.mjs`
when you take it. The JSON has `artifact` (a path, or null), `question` (a
skill's wording verbatim when a skill asked), `options` (at least two
`{label, consequence}`), `chosen`, `why` (for the owner reading cold; says
so when there is no evidence; when options are close, names the signal that
would have changed the choice), `evidence`, `blast_radius`, `confidence`,
`would_have_asked`, `stop_class` (set exactly when `would_have_asked` is
true) and `would_upstream`. Never supply `id`, `at`, `segment`, `step`,
`step_ref`, `by` or `commit`. One decision per real choice; no padding.

```bash
node hsdd/scripts/auto/decide.mjs --step {step} --by orchestrator --stdin <<'EOF'
{"artifact": null, "question": "...", "options": [...], "chosen": "...", "why": "...", "evidence": [], "blast_radius": "node-local", "confidence": "high", "would_have_asked": false, "stop_class": null, "would_upstream": false}
EOF
```

It prints `{id} at {at}`; cite that id in resume messages, `STOP.md`,
`predecided`, queue events and change-log entries.

### Answering a stop

A step subagent never answers a stop. On a report with `status` `stopped`
(a skill stop) or `run-stop-candidate`:

1. **Check the read:** `node hsdd/scripts/auto/gate.mjs --step {step} --check B1,B5`.
   An error means the subagent did not read to the end, where the
   predecided answers are. Resume it with that finding (Rework and
   gate-twice) and handle nothing else until a report passes.
2. **Check the class.** Correct a wrong `stop_class`; say why in your
   decision, or in `STOP.md`.
3. **Check the condition.** `shape` holds only when both options are
   defensible, differ in nodes or contracts, and nothing in the sources,
   the owner facts, HSDD's rules or an experiment gives one a stated reason
   to lead. When one has, answer it (case B) citing that reason, with
   `would_have_asked: false`.
4. **Ingest:** `node hsdd/scripts/auto/routed.mjs ingest --step {step}`,
   then accept or reject each `insert-step` item it opened (Inserted steps)
   before any stopped commit.
5. **Handle it:**

| Class | Policy `stop`, class in `stop_set` | Otherwise |
|-------|------------------------------------|-----------|
| `axis`, `shape`, `promotion`, `breaking-amend`, `collision` | Case A | Case B (an `axis` outside `stop_set` never stops: the root step decides it) |
| `gate-twice` | Case A | Rework and gate-twice |
| `external` | Case A | Case B only with an in-repository alternative (a project-local dependency instead of a global one); with none, a hard stop |
| `upstream`, `judgement` | Never a stop: resume with `--reason finding` telling the step to decide it; record nothing yourself; it does not count against `rework_limit` | Same |
| `procedural` | Case C | Case C |

**Case A: end the run.** Write `hsdd/judgement/STOP.md` with your
recommendation, in exactly this shape (`state.mjs` reads its first lines):

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

Then `node hsdd/scripts/auto/commit.mjs --step {step} --status stopped`
commits the partial artifacts and the judgement set with `STOP.md`, leaving
a clean tree. End, showing the question.

**Case B: answer and resume.** Record your answer in the step's sidecar
(`decide.mjs --step {step} --by orchestrator --stdin`) with
`would_have_asked: true`, the class, the subagent's options plus any you
add, and a `why` naming the signal that would have changed it. Put the
answer and the decision id in a message file, run
`node hsdd/scripts/auto/dispatch.mjs --resume {step} --reason answer --message-file {file}`,
send what it prints to the same subagent, wait, and handle the next report.
Nothing is committed in between. When the host cannot resume a subagent,
commit the step `stopped` instead; its continuation carries the answer.

**Case C: supply the missing input.** Record a `plan` decision in the
step's sidecar. Accept the `insert-step` item the report routed for the
step that supplies the input, or open one,
`node hsdd/scripts/auto/routed.mjs open --from {step} --target run --kind insert-step --text "{why}" --step-kind {kind} --step-target {target}`,
then `node hsdd/scripts/auto/routed.mjs decide {item} --accepted --decision {id}`.
Add the change-log entry; only then
`commit.mjs --step {step} --status stopped`, so the decision and the queue
events share its judgement commit. `next.mjs` returns the inserted step,
then the continuation.

**Continuations.** `next.mjs` returns a continuation of a stopped subagent
step (same kind and target, `continues` set) once `STOP.md` is gone and
every `insert-step` item opened from it is `addressed` or `rejected`.
Dispatch it like any step; its prompt names the stopped report, the partial
artifacts and every decision on the stop. A stopped `plan` step gets no
continuation: the new segment's `plan` step reads the owner's `by: owner`
decision and opens and accepts the `insert-step` items it implies, by
`plan` decisions citing it.

**A producer cycle** (`stop`). In the `--plan --for stop` step: under policy
`stop` with `shape` in `stop_set`, write `STOP.md` naming the cycle and
commit the step `stopped`. Otherwise decide an order, record it, and open
and accept one `insert-step` item per cycle member, in that order.

### Hard stops

These write `STOP.md` under either policy. They are the only `STOP.md`
allowed under `decide-and-record`.

- An `external` need with no in-repository alternative.
- A continuation that itself reaches `gate-twice` (class `gate-twice`).
- A dispatch over the size limit. A refused `--next`, once the context file
  is shortened: `dispatch.mjs --plan --for size --result-file {file}`,
  record the decision, write `STOP.md` with class `external` and the size
  list as its question, commit the plan step `stopped`. A refused
  `dispatch.mjs --redispatch {step}` leaves the lost step open, so no plan
  step can open: record it in the lost step itself with
  `decide.mjs --step {step} --by orchestrator --stdin` naming the size list,
  write `STOP.md` with class `external` (the fix lies outside the
  repository: a larger host read limit or a shorter owner configuration)
  and the size list as its question, then
  `node hsdd/scripts/auto/commit.mjs --step {step} --status stopped --no-report`.
- An owner file a step changed (gate A2): only the owner restores it. Record
  the decision in the step's sidecar, write `STOP.md` naming the file with
  class `external`, then `commit.mjs --step {step} --status stopped`, which
  leaves the file in place and out of the commit.
- `stuck` with no step kind able to fix it (class `shape`, Finishing a
  segment).

### Deciding in advance

When the `setup` or `plan` step can see the segment meeting a stop-set
class many times (an intake whose change breaks stable contracts meets
`breaking-amend` on each), decide it once, only under `decide-and-record`
or when an owner fact already gives the answer. Record one decision with
`would_have_asked: true` and the class, write `predecided` in `run.yaml`
(`{class}: { answer: "...", decision: DEC-nnn }`), and add a change-log
entry. `dispatch.mjs` puts it into every later prompt; a subagent that meets
the class applies it and records its own decision citing yours. It never
covers a breaking change under `compatibility: frozen` or at `v0`.

### Reviewing a step

After the hand-back of a completed report, before the commit:

1. `node hsdd/scripts/auto/routed.mjs ingest --step {step}`.
2. Read the report and the diff of the step's write set. Check: every
   `self_check` entry with `fail`; every artifact the report names exists
   and nothing outside the write set changed; every sentence the diff
   touches is true against the current text of what it cites, and the step
   left no sentence it read and knew to be false (one it reports as out of
   scope gets a rework or a routed item); every routed item the dispatch
   listed is in `closes`; `reads_outside` is empty, or each entry gets a
   `plan` decision (keep the output, or rework).
3. Rework each finding (Rework and gate-twice) or route it to a later step
   with `routed.mjs open --from {step} --target {target} --kind must-address --text "{finding}"`
   (or `--kind consider`), by a recorded `plan` decision either way.
4. Accept or reject every `insert-step` item the ingest opened.
5. `node hsdd/scripts/auto/gate.mjs --step {step}` previews the gate and its
   warnings (B4, B6); `commit.mjs` runs it anyway.

### Rework and gate-twice

`node hsdd/scripts/auto/dispatch.mjs --resume {step} --reason finding --message-file {file}`
sends a finding (a failed gate or review) to the same subagent, the message
stating the finding and its decision id. A step may be resumed for findings
at most `rework_limit` times (default 1); resumes that carry an answer, or
an `upstream` or `judgement` stop back to the step, do not count. The next
failure is `gate-twice`. Under policy `stop` with `gate-twice` in
`stop_set`: case A. Otherwise record a decision (`would_have_asked: true`,
class `gate-twice`, a `why` quoting the findings) and commit the step
`stopped`; the continuation, a fresh subagent, receives the findings.

For that stopped commit: when the finding is B1 or B5 (no valid report),
`commit.mjs --step {step} --status stopped --no-report`; for paths outside
the write set (A1), `commit.mjs --step {step} --status stopped --discard {path}`,
with a `plan` decision naming each path. Never discard an owner file.

### Inserted steps

An `insert-step` item comes from a report's `routed`, your review, the
intake record's insert rule, or case C. Accept or reject it with a `plan`
decision and
`node hsdd/scripts/auto/routed.mjs decide {item} --accepted|--rejected --decision {id}`,
in the sidecar of the step under review when the item came from its report
or review, otherwise in a `plan` step; never between steps. Add a
change-log entry naming the decision. Reject an item that duplicates a
pending handoff (same kind and target), citing it. To make an item wait for
intake handoffs, open it with
`routed.mjs open --from {step} --target run --kind insert-step --text "{why}" --step-kind {kind} --step-target {target} --after handoffs`
(or `--after {handoff id}`). An item routed from a stopped handoff step
never gets an `after` naming that handoff, nor `handoffs`: the item would
wait for the handoff, and the handoff's continuation for the item.

### Owner instructions

- An owner's words in the invoking message are `setup` decisions of the
  segment they open (The setup step).
- An owner message that arrives mid-segment is an instruction. After the
  current step's commits, start `dispatch.mjs --plan --for owner` and record
  a `plan` decision quoting the message, how you read it, and from which
  step it applies.
  - It changes `run.yaml`: end the segment with
    `node hsdd/scripts/auto/commit.mjs --step {step} --status completed --note "ended: owner message"`,
    then open the next segment with the message as its instruction (third
    form); its `setup` applies the change.
  - It asks the run to stop: commit the plan step and end, with no
    `STOP.md`. `/hsdd-auto` resumes the segment later.
  - Otherwise act on it in that plan step (queue items, predecided
    answers), commit, and continue the loop.

## Context recovery

Everything needed to continue is on disk. After any context summary, and on
every `/hsdd-auto` that resumes, read before acting: `state.mjs`,
`hsdd/auto/plan.md`, the last twenty lines of
`hsdd/judgement/decisions.jsonl`, and `git log --oneline -20`. Before
re-entering any handling, read the step's sidecar
(`hsdd/auto/steps/{step}.decisions.jsonl`) and the uncommitted lines of
`hsdd/auto/queue.jsonl` (`git diff HEAD -- hsdd/auto/queue.jsonl`): a
decision or item already there for the same question or text is reused,
never minted again. Remove `hsdd/auto/.decide.lock` when a lost subagent
left it.

When a subagent step is open, first ask the host whether its subagent still
runs; if it does, wait for its hand-back. Otherwise resume by what is on
disk (`state.mjs --json`'s `steps.in_progress` gives `has_report` and
`has_artifact_commit`):

| On disk | Resume by |
|---------|-----------|
| Dispatch file of a subagent step; no report of the current series; no artifact commit | `node hsdd/scripts/auto/dispatch.mjs --redispatch {step}`: a new launch under the same id, whose prompt lists the files the lost launch changed; launch a fresh subagent with the prompt it prints |
| Dispatch file whose latest launch is a resume newer than every report; no artifact commit | The resumed subagent is gone: `dispatch.mjs --redispatch {step}` |
| Dispatch file of an orchestrator step (`skill: none`); no commits | Its kind (`setup`, `plan`, `report`), and for a `--plan` step its body's `for:` line and result, name what it was opened for; finish that work and run `commit.mjs` |
| Index not empty, `HEAD` equal to the dispatch file's `head` | A crash inside `commit.mjs` after staging: run it again; it unstages and starts over |
| Dispatch file and report; no artifact commit | The review, or the stop handling |
| Artifact commit (`HEAD`'s subject names the step); no judgement commit | `commit.mjs --step {step} --status {status}` again: it continues from the ledger |

A refused redispatch is a hard stop recorded in the lost step itself (Hard
stops). With no step open, act on `next` (The step loop); when it is the
newest segment's `setup` step, run The setup step even if `STOP.md` is
present: a crash followed `open-segment`, and the segment entry's
`instruction` is the owner's answer.

## Finishing a segment

When `next.mjs` returns the `report` step:

1. `dispatch.mjs --next`.
2. `node hsdd/scripts/auto/report.mjs --segment {segment id}` writes
   `{report_dir}/{segment id}.md` (default `hsdd/auto/report/`), covering
   every earlier segment that ended or stopped without a report.
3. `node hsdd/scripts/auto/gate.mjs --final` for its F2 lines (its F6
   error stands until the slots are filled): read each reference to an old
   contract version and confirm it is history.
4. Fill the prose slots (`<!-- slot:{name} -->` to `<!-- /slot -->`):
   `outcome` (three to five sentences, answer first; say when it also
   covers earlier segments); for an intake, `what_changed` and
   `earlier_proposals` (from the intake step's `notes`: which earlier
   `would_upstream` decisions the request adopted, contradicted or left
   open); `assumptions` about the owner's intent; `record_gaps` (what the
   generated list leaves out, and the F2 count with each reference read).
   The prose rules apply to slots.
5. Record any last `plan` decisions in this step.
6. Run `report.mjs --segment {segment id}` once more: it keeps the slots and
   refreshes the generated parts, including the final gate's warning count.
   For an intake it also appends the record's `## Produced`; never write
   that by hand.
7. `commit.mjs --step {step} --status completed` runs the final gate, then
   commits. On a refusal, fix what the findings name and run it again.
8. `node hsdd/scripts/auto/state.mjs done` prints `DONE {segment id}`.

End with one message to the owner: the report's path, the number of steps
and decisions, the `would_have_asked` decisions by id, whether anything
stopped, the output of `state.mjs done`, and a reminder that `/hsdd-summary`
re-renders the reading aids, which the run does not drive.

**Stuck.** `next.mjs` returns `stuck` when no stage rule can make progress
and the done condition fails. Check `segment.ended` first (The step loop).
Then `node hsdd/scripts/auto/dispatch.mjs --plan --for stuck --result-file {file}`,
record a decision naming each unmet condition, and route it: an accepted
`insert-step` item, or an item for an existing target
(`routed.mjs open --from {step} --target {target} --kind must-address --text "{condition}"`).
When no step kind can fix it, write `STOP.md` with class `shape` and the
unmet conditions as its question, and commit the plan step `stopped`: a
hard stop.

## Quality Gates

- [ ] Every step has two commits, its artifact commit then
      `judgement: {step}`; a skipped handoff has one.
- [ ] Every decision was minted and stamped by `decide.mjs` when it was
      taken; no id or time was typed.
- [ ] No prompt carries a fact that `dispatch.mjs` did not read from a
      file or that is not cited to one; every launch prompt went out as
      printed.
- [ ] No step id reused or renumbered; ids come only from `dispatch.mjs`.
- [ ] No `STOP.md` under `decide-and-record` except a hard stop.
- [ ] No planning skill ran in the orchestrator's context.
- [ ] Every wait was a hand-back, with at most one fallback wake-up per
      launch, never under 20 minutes.
- [ ] Every owner instruction is a recorded decision; every change to the
      path is a change-log entry opening with its decision id.
- [ ] Every file written for a script lies outside the repository.
- [ ] The report's slots are filled, `report.mjs` ran again after them, and
      the final message carries `state.mjs done`'s output.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I remember what that step decided, I'll restate it in the prompt" | Facts come from files. `dispatch.mjs` reads them; a context line cites a file, commit, step, decision or queue id. Memory drifts; files do not. |
| "The timestamp doesn't matter, I'll write one" | Only scripts stamp. A typed time breaks the ledger's window checks and the audit. |
| "This stop is obviously answered, I'll let the subagent take it" | A stop is the orchestrator's: answered by case B and recorded with `would_have_asked: true`, or ended with `STOP.md`. A subagent never answers one. |
| "The gate is wrong this once, I'll commit anyway" | Fix the step by a rework, or the configuration by a recorded decision in a setup or plan step. Never bypass the gate, never commit by hand. |
| "I'll check on the subagent in a few minutes" | Wait for the hand-back. At most one fallback wake-up, never under 20 minutes, and no polling. |
| "Quicker to run the skill myself in this context" | The orchestrator never runs a planning skill. A fresh subagent with only its dispatch file is the isolation the skill needs, and the file is the audit record. |
| "I'll add a line to the launch prompt so the subagent gets it right" | The launch prompt goes out as printed; the dispatch already carries `--unattended {step}`. Context goes through `--context-file`, cited. |
| "The owner would want a say here, I'll ask" | The only questions are the first run's. Everything else is a recorded decision or `STOP.md`. |
| "The report says completed, the review can wait" | Ingest, read the diff, and check every touched sentence against what it cites. The gate is mechanical; it does not read meaning. |
| "The script copy is stale, I'll patch it by hand" | `state.mjs install-scripts`, in a setup step or a plan step by a recorded decision. Never edit `hsdd/scripts/auto/`. |
