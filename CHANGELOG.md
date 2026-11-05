# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.13.0] - Unreleased

Small changes after launch. `hsdd-intake` takes a change in either tense: a
request below the line gets a node and a commit trailer and no record, and a
sweep attributes shipped commits in a dated record, one row per commit,
handing off only what earned a phase or an intake. The skill count stays
thirteen.

Specification: `spec/hsdd-spec-v0_13.md`.

### Upgrading from 0.12.0

- Reinstall the thirteen skills. No existing artifact is rewritten.
- The `manual` class applies from the next request forward. No record is
  written for it, so nothing existing changes.
- Sweep mode and `hsdd/scripts/sweep/` are opt-in. A project that never
  sweeps is unaffected: its post-launch commits with no phase are backfill
  findings as before, and the finding's step now names a sweep.
- The sweep record is a new management document outside the chain rules, and
  the reading aids ignore it by its slug.
- The `commit` authority is a new value of an existing field; existing
  records are unchanged.
- A retro phase over several commits is forward-only: retro phases already
  planned stand.
- A commit whose retro phase cites it by sha is attributed. A retro phase
  that cites only a finding id attributes nothing, so start the first sweep
  after such commits.
- The amended scripts rule changes nothing on a project: request mode runs
  no script.
- A project that adopted the manual lane from the 0.12 user's guide is
  conformant: its trailers are read as hints, its same-day retro phases
  stand, and its first sweep names its own `--from`. Remove the
  `## Manual lane` paragraph from `hsdd/conventions.md` if you added it. It
  conflicts with the checkpoint's attribution rule, and the first checkpoint
  after the upgrade files it as a finding whose step removes it.

### Added

- **The `manual` class** of `hsdd-intake` (spec v0.13 chapter 3): after
  launch, a request that, as described, moves no route, schema, topic or
  table, stales no claim of the owning node's closure, and lands inside one
  node. The answer is the node and the commit trailer
  `HSDD-Node: {node-id}`, no record; the change ships on the implementation
  repository's main line and the sweep attributes it. When the description
  does not let the skill tell, the class is another one. `manual` is not an
  unattended class: under `hsdd-auto` such a request is routed `local` and
  the decision recorded.
- **Sweep mode** of `hsdd-intake` (chapters 4, 6 and 7): `/hsdd-intake sweep`
  reads one contiguous range of an implementation repository's main line,
  from the end of the previous sweep to the head. `sweep.mjs` sets aside
  merges, governance-only commits and attributed commits, applies the
  surface test to the rest and proposes a node for each. The agent applies
  the claim test, whether the diff makes a claim of the owning node's
  closure false or stale. A row's class is `log`, `retro`, `intake` or
  `unplaced`. `draft` writes the record, `check` reads it back against a
  fresh draft, and `commit` commits it alone and never pushes; `check` and
  `commit` gate first publication. The procedure is
  `skills/hsdd-intake/sweep.md`, read in sweep mode only. The scripts are
  copied verbatim to `hsdd/scripts/sweep/`; eight of them are copies of
  `hsdd-adopt`'s and `hsdd-summary`'s, kept identical by a test.
- **The sweep record** (chapter 5):
  `hsdd/management/YYYY-MM-DD-sweep-{repo}-{to7}.md`, one per repository per
  run, one row per candidate. A `log` row is the whole record of its commit.
  The `retro` rows hand off one phase per node per record, with its
  reconcile and a retroactive verification doc signed by delegation; each
  `intake` row hands off one run of request mode; `unplaced` rows are listed
  for the owner. The record closes when its handoffs have landed and no
  `unplaced` row remains.
- **The `commit` authority** (§6.2): a shipped commit given to request mode
  as `{repo}@{sha}`, one commit per request, never `manual`; the phases it
  produces are retro phases. It is an authority of request mode only:
  `hsdd-spec`'s root `## Sources` list and `hsdd-auto`'s `authority` enum
  are unchanged.
- README: a "Small changes after launch" section; the interactive guide's
  class table gains `manual` and its skill map describes both modes.

### Changed

- `hsdd-checkpoint`: the backfill step. The code-vs-plan pass reads every
  sweep record; a row in one attributes a commit, and a commit trailer
  attributes nothing on its own. Every other commit since the newest
  record's `{to}`, or since launch when there is none, is one backfill
  finding per repository naming the unswept range, whose plan step is
  `/hsdd-intake sweep --from {sha}`, never a retro phase per commit. The
  intake-record pass closes sweep records and files as findings an
  `unplaced` row, a record open two checkpoints after its date with a
  handoff not landed, a sha two records both classify, and two consecutive
  records whose ranges leave a gap. Sweep records run by delegation join the
  delegated sign-offs' finding, and a `## Manual lane` paragraph in
  `conventions.md` is filed as a finding whose step removes it.
- `hsdd-phase-plan`: append mode's retro phase may record several commits
  from one sweep record, one retro phase per node per record and never one
  per commit, review tier gate-only unless the prompt says otherwise. The
  phase sizing ceiling does not apply to a retro phase.
- The scripts rule (spec v0.10 §16.3, §18.1): "bundled with a new skill
  only; no script changes an existing skill's behavior" becomes "bundled
  with a new skill or a new mode of an existing skill; no script changes an
  existing mode's behavior".
- `hsdd-spec`'s conventions template: the layout names
  `hsdd/scripts/sweep/`, `hsdd/management/` names `hsdd-intake` as the writer
  of sweep records, and the profile section's repository list uses the names
  sweep records use.
- The user's guide: the small-fixes section is rewritten over the two
  tenses, its retro-phase prompts and the `## Manual lane` block are gone,
  and "Outside the loop" names `manual` and the sweep. `HSDD-Kind:` is read
  by nothing and the guide stops recommending it; a project that writes it
  loses nothing.

## [0.12.0] - Unreleased

Sealing a released tree. A system that shipped and that QA verified can
have its stale HSDD ledger closed by script, with no model in the loop, and
the method gains the one rule the seal needs: a `dropped` status for a phase
that was planned and never built.

Specification: `spec/hsdd-spec-v0_12.md`. Design record:
`docs/superpowers/specs/2026-11-03-hsdd-seal-design.md`.

### Upgrading from 0.11.0

- Reinstall the thirteen skills. Nothing is rewritten.
- The dropped phase status is recognized from the next checkpoint. A
  project that already carries the convention paragraph under
  `## Phase design` keeps it; it is now informative.
- An intake record whose produced phases were all dropped closes as
  `closed (date, dropped)` from the next checkpoint; existing closed records
  are unchanged.
- A project that never seals is otherwise unaffected.

### Added

- **`hsdd-seal`**, the thirteenth skill: seal a released tree whose HSDD
  artifacts went stale, by script and with no model in the loop. `plan`
  reads the tree and writes a seal plan with a default class per phase
  (`done`, `sign`, `drop`, `keep`, `skip`); the owner edits the class;
  `apply sign|drop|prune|close` writes retroactive verification docs by
  delegated sign-off, marks unbuilt phases `- **Status:** dropped` under a
  project convention appended to `hsdd/conventions.md`, removes OpenSpec
  change directories an earlier catch-up invented, closes intake records
  whose produced phases are done, ticks milestone gates and seals the
  campaign document into the archive; `report` appends the result and the
  list of what only the owner can do. Every write is a dry run until
  `--write`; `--commit` commits only the paths it touched and refuses a
  detached submodule. `plan` validates `--catchup` before reading anything
  and never overwrites an existing plan without `--force`; apply re-derives
  every path from the phase id or a fresh scan, so the owner's edit surface
  is the `class` field and nothing else. The scripts are copied
  verbatim to `hsdd/scripts/seal/`; `md.mjs` and `extract-plan.mjs` are
  copies of `hsdd-summary`'s, kept identical by a test.
- **The dropped phase status** (spec v0.12 §3): `- **Status:** dropped
  (date, reason)` on a phase record, after its review tier, takes the phase
  out of every scope and done count while keeping its id and its ledger
  row.
- README: a "Sealing a released tree" section; the user's guide's "Outside
  the loop" chapter seals by script; the interactive guide's skill map
  lists `hsdd-seal`.

### Changed

- `hsdd-checkpoint`: dropped phases are out of every count and listed in
  one line; an all-dropped intake record closes as `closed (date, dropped)`;
  a gate a dropped phase names is satisfied for that phase; seal plan files
  are outside the chain rules; the first checkpoint after a seal takes the
  seal plan's result as a named input and lists the seal's delegated
  sign-offs in one finding.
- `hsdd-milestone`: a dropped phase is out of a campaign's scope.
- `hsdd-phase-plan`: append mode never rewrites, renumbers or merges with a
  dropped phase.
- `hsdd-intake`: the record's Status field admits `closed (date, dropped)`.
- `hsdd-spec`'s conventions template: the layout names `hsdd/scripts/seal/`
  and `hsdd-seal` among the writers of `hsdd/management/`.

## [0.11.0] - Unreleased

Unattended planning runs. `hsdd-auto` runs HSDD's planning chain without the
owner at each ask point, one fresh subagent per skill invocation, and records
every decision for one review sitting afterwards.

Specification: `spec/hsdd-spec-v0_11.md`. Settled build decisions:
`docs/superpowers/plans/2026-10-22-hsdd-auto-decisions.md`. Acceptance:
`review/hsdd-v0_11-acceptance.md`.

### Upgrading from 0.10.2

- Reinstall the twelve skills. Nothing else changes unless `/hsdd-auto` runs.
- A project that never runs `/hsdd-auto` is unaffected: the new
  `## Unattended runs` sections are inert unless a skill is invoked with
  `--unattended`.
- A `hsdd/judgement/decisions.jsonl` written by a hand-built unattended run
  continues under `hsdd-auto`; its lines read as legacy lines, with one
  warning.

### Added

- **`hsdd-auto`**, the twelfth skill, with bundled zero-dependency scripts
  (`state`, `next`, `dispatch`, `decide`, `ledger`, `gate`, `commit`,
  `routed`, `report`, `adapter`) copied verbatim to `hsdd/scripts/auto/` by
  the first `setup` step. The scripts compute the next step, render its
  prompt, gate and commit it, mint and stamp every decision, and write the
  report; the orchestrator keeps the judgement.
- **Two modes.** `plan` plans an empty tree through reconcile. `intake`
  routes one change request through `hsdd-intake` and every handoff its
  record names.
- **A stop policy per segment.** `stop` ends the run with `hsdd/judgement/STOP.md`
  at a stop-set condition; `decide-and-record` decides it and records the
  decision with `would_have_asked: true`. A class can be decided in advance
  with `predecided`. `external` and four other hard stops end the run under
  either policy.
- **Run records:** `hsdd/auto/` (the run configuration, the plan, the queue,
  every dispatch file, step reports, one report per segment) and
  `hsdd/judgement/` (the decision ledger, the run log, `STOP.md`, and the
  owner's `decision-reviews.jsonl`).
- **A Claude Code adapter** (`adapter.mjs install`, `adapter.mjs check`):
  permission deny rules and a Bash hook that keep a run inside its declared
  inputs.
- `docs/guide/`: chapter 10, "Run unattended", on handing planning to an
  agent and reviewing its decisions afterwards.
- `docs/tutorial/meeting-rooms/`: a third recorded run, the first planned
  by `hsdd-auto`. PRD version 2 grows simple-login into meeting-room
  booking for two offices in different time zones, with PostgreSQL in
  Docker; an intake segment plans it unattended (31 steps, 231 recorded
  decisions, no stop), the owner's review follows in one sitting over the
  ledger, twelve phases are built in a backend, a web and an integration
  lane, and a checkpoint closes the intake. The `template/`, the
  `execute/` repository with its full history, and an interactive
  `walkthrough/` with the process log, including the findings about HSDD
  the run surfaced.
- **Test coverage:** script tests for every script and
  `test/auto-e2e.test.mjs`, which drives the scripts through simulated plan,
  stop, procedural-stop, intake, rework and interruption runs.

### Changed

- `hsdd-spec`, `hsdd-adr`, `hsdd-contract`, `hsdd-phase-plan`,
  `hsdd-reconcile` and `hsdd-intake` each gain an `## Unattended runs`
  section: the skill's ask points as a table, a structured stop at an ask
  point instead of a question, and each decision recorded when it is taken.
- `hsdd-intake` gains an optional machine-readable handoff block in the
  intake record; existing records stay conformant.
- `hsdd-reconcile` gains a named align mode.
- `hsdd-contract`, `hsdd-adr` and `hsdd-spec` gain the citation-touch rule
  for moving citations when a source document or contract version changes.
- The contract file gains the optional front-matter field `governed_by`.
  Open-question and `Collides with` separators admit `:`, an en dash or
  ` - ` beside the em dash, and an empty cell admits `none` and `-`.

### Fixed

hsdd-auto was built against 0.10.0. Before the tutorial run, a check
against 0.10.1 and 0.10.2 found fifteen gaps (build decisions B-40 to
B-51), and the run itself showed six more defects (B-52 to B-57). All are
fixed here; the 775 tests the branch had grew to 815.

- Contracts are indexed by front-matter `id`, so a later version in its
  own file (`{slug}.v{n}.md`, 0.10.2) is the same contract: the gate's C4
  and C5, the facts a step receives, the target lines, C3 and the
  `## Produced` append all read the version a citation names.
- `approved-prd` is an authority, rendered in `hsdd-intake`'s words
  wherever it reaches a prompt or a record.
- A lower contract version counts as superseded only when it is
  `deprecated` or `retired`; citation touch and align never edit a node
  header's Produces or Consumes or an ADR's `affects`, so a `coexisting`
  version keeps its live citations.
- A bump's migration mode (`coexisting` or `lockstep`) has an unattended
  disposition under `breaking-amend`, and a predecided answer names it;
  hsdd-contract and hsdd-reconcile route the lockstep consumers' phases
  and the ADR `affects` update as inserted steps.
- "Shipped" reads the conventions' `**Main line:**`, not `origin/HEAD`.
- A baseline source's version matches only with its citation name, never
  as a bare token (`"1"` matched every `minLength: 1`).
- An item on a handoff waits for that handoff's own step instead of being
  handed to every earlier step on the same node.
- An inserted step's invocation carries its item's text; an accepted
  insert-step can be withdrawn while no step has run it.
- `## Produced` lists new contracts and proposed ADRs and drops its
  placeholder.
- The parent's citation touch owns its copies of a child's lines.
- v0.11 reads against v0.10.2; its "v0.10.0 §n" prefix names the v0_10
  document as of 0.10.2.

The tutorial's process log lists eleven further findings about HSDD
(hsdd-config's referenced-contract closure and self-contained check, the
verification template, the superpowers derivative, sizing, evidence),
left unchanged for the owner.

### Notes for the owner

The build found these errata in the specification and worked around them
without editing it. The decisions file records each.

- C.3 writes the contract step's `G{n}`, which section 13.2 reads as a slot
  named `n`; the template renders `G{n}` through `G{{n}}` (B-13).
- Section 11.1 appends `/**` to every deny rule, which never matches a file
  path; the adapter writes the path itself and the path with `/**` (B-22).
- D1 (prose rules) on `run.yaml` blocked every segment at level `error`,
  because the file lists the banned phrases and stores the owner's
  instruction verbatim; D1 exempts `run.yaml`, `owner-files.json`,
  `adapter.json` and the `orchestrator_files` (B-23).
- C5's literal reading passes a citation of a contract version that does not
  exist yet, because the Versioning line names the next version; C5 accepts
  only the current version or an older one the section names (B-7).

## [0.10.2] - 2026-10-31

The change flow's missing rules, found by the second tutorial run; the
superpowers derivative names the skills it relies on; the phase-switch
prompts in both tutorials. Specification: `spec/hsdd-spec-v0_10.md`, now at
0.10.2; its §15.1 states the upgrade. Acceptance:
`review/hsdd-v0_10-acceptance.md`, F1 to F7.

### Upgrading from 0.10.1

- Reinstall the skills. Changed: `hsdd-intake`, `hsdd-contract`,
  `hsdd-phase-plan`, `hsdd-reconcile`, `hsdd-config` and its verification
  template, `hsdd-checkpoint`, and `hsdd-spec`'s conventions template.
- The upgrade rewrites nothing under `hsdd/` and triggers no adoption run.
  Two optional additions: the contract key `former_consumers` (absent
  means none migrated) and the conventions line `**Main line:**` (absent
  means `main`). The registry generator is unchanged, and a project's copy
  passes the new key through.
- Forward-only: contract versions drafted, plans written and phases
  switched after the upgrade follow the new rules. A phase context already
  written is a record. A superpowers plan in progress copied the old
  constraints; re-running its switch rewrites the derivative, and the next
  plan copies the new ones.
- The next checkpoint applies the new audits to the whole tree: a `stable`
  version that nothing serves, migrated consumers still in `consumers`,
  and delegated sign-offs each become findings with plan steps. A phase an
  earlier progress report counted done is never downgraded.
- A project's `hsdd/templates/verification.md` is kept; the switch reports
  that it differs from the skill's.

### Added

- `docs/tutorial/simple-login-update/`: a second recorded run, one change
  to the finished simple-login project (the user's phone number on Home)
  taken through HSDD's change flow with the v0.10.1 skills: hsdd-intake,
  a breaking contract change minting `profile-api@v2` beside v1, phases
  appended on three nodes, reconcile, two parallel superpowers lanes and an
  integration phase, and the first hsdd-checkpoint closing the intake
  record. The `template/` (the finished project plus the change request),
  the `execute/` repository after the change, and an interactive
  `walkthrough/` with a diff against the template and a full process log,
  including twelve findings about the change flow.

### Changed

- `hsdd-config`: the superpowers derivative names the skills its rules
  rely on, not only the behavior, because a skill's rules load only when
  something names it and `subagent-driven-development` has an implementer
  follow TDD only "if task says to". Constraint 1 names
  `test-driven-development`; new constraints 9 and 10 name
  `verification-before-completion` and `systematic-debugging`, so tech
  skills now start at 11. The header and a Plan check box name the
  execution skill by review tier: `executing-plans` at gate-only and
  spot-check, `subagent-driven-development` at full-review. The switch
  warns for a named skill that is not installed.

### Fixed

The twelve findings about the change flow in
`docs/tutorial/simple-login-update/walkthrough/process-log.md` ("Findings
about HSDD's change flow"), and the first run's finding 3, which is the
same defect as finding 7. Finding 10 (`referenced` text lengthens a
migration phase's context) stays as it is.

- `hsdd-intake`: `approved PRD` is an authority value (finding 1). The
  change request's own path, not the intake record's, joins each node's
  Sources (finding 6). A record closes when its phases are done, so a
  claim keeps it open (finding 12).
- `hsdd-contract`: a later version is a new file beside the first,
  `{slug}.v{n}.md`, with its schema and fixtures, and nothing is renamed
  (finding 2). A breaking change's migration note names its mode:
  `coexisting` keeps the window; `lockstep`, for one surface with one
  shape, deprecates the old version in the same run, its sunset when the
  new version's first producer ships (finding 4). `consumers` means live: a
  phase whose node's newest shipped phase consumes a later version has
  migrated and moves to the new `former_consumers` key (finding 5). The
  bump also amends other contracts that name the old version and adds the
  new one to ADR `affects` (finding 3). A new version starts `draft`, and
  the `additive-only` fixture test applies to changes within a version.
- `hsdd-reconcile`: writes the version ripple, a newly confirmed version
  into the node header's `Produces`/`Consumes`, the parent's child table,
  summary (with the `Sources` append mode extended) and DAG, the root's
  contract matrix, and a new change request into the root's `## Sources`
  (finding 3). On a
  checkpoint's plan step it moves migrated consumers and retires a
  `deprecated` version past its sunset.
- `hsdd-phase-plan`: append mode leaves the node header to reconcile
  (finding 3) and runs the sizing floor over the appended phases only
  (finding 8). A phase line carries the binding detail itself, never only a
  pointer to a source, and the checklist checks it (finding 7).
- `hsdd-config`: the phase context carries every node decision (`D{n}`)
  the Phase block cites, under Decisions, and the self-contained gate
  checks them (finding 7; first run, finding 3). The Discipline test-first
  line and superpowers constraint 1 say what a test fails against when a
  dependency phase has already merged: the commit before that phase, or a
  named mutant (finding 11). Contracts are found by frontmatter `id` and
  `version`. Rule 2 no longer contradicts rule 1 when a Scope names
  another phase: the Scope is copied verbatim, ids and all.
- `hsdd-checkpoint`: a sign-off delegated to an agent names the person it
  answers to, counts as done, and goes into one finding for that person to
  ratify; a Reviewer who names no person leaves the phase a claim (finding
  12); intake closure and milestone sealing count only done phases.
  Migration health: migrated consumers, `deprecated` versions past
  their sunset, and `stable` versions nothing serves are findings with plan
  steps (findings 4 and 5). "Main" is the conventions' `**Main line:**`
  (finding 9), as it is in `hsdd-config`'s pointer and next-runnable checks
  and in `hsdd-contract`'s shipped phase.
- Verification template: the Reviewer line and the footer name delegated
  sign-offs (finding 12).
- Conventions template: the `**Main line:**` line (finding 9); the layout
  names later contract versions; the switch is named `/hsdd-config`, the
  installed skill, instead of the optional `/hsdd-phase` command.
- Both tutorials: every `/hsdd-phase` prompt is now `/hsdd-config`, since
  their setup installs only the skills, and so is each tree's conventions
  file. Each finding fixed here is marked in the process logs and the
  walkthroughs; the walkthroughs' embedded snapshots (`data.js`) keep the
  text the runs recorded. Each README names the skill version its run was
  recorded with, and the walkthroughs and the first process log note where
  the superpowers derivative now differs.
- `spec/hsdd-spec-v0_10.md` states the same in place (§2.6, §3.1, §3.4,
  §3.5, §3.6, §7.6, §8.2, §8.4, §9.2, §9.7, §9.8, §9.9, §10.2, §10.3,
  §11.2, §11.3, §12.7, §14.1, §14.2, glossary), with the upgrade in §15.1
  and nine rows in §18.1. The users-guide and the HTML guide agree.

## [0.10.1] - 2026-10-30

Two phase-context corrections, found by the simple-login tutorial run, and
the documentation added since 0.10.0. Specification:
`spec/hsdd-spec-v0_10.md`, now at 0.10.1; its §15.1 states the upgrade.
Acceptance: `review/hsdd-v0_10-acceptance.md`, A6 and A7.

### Upgrading from 0.10.0

- Reinstall the skills. Only `hsdd-config` and `hsdd-phase-plan` changed.
- Nothing under `hsdd/` changes, and the upgrade triggers no adoption run:
  a 0.10.0 project's newest progress report already has its
  grandfathered-contracts row.
- Forward-only: phases switched after the upgrade get the Validation
  blocks and `referenced` subsections. A phase context already written is a
  record and is not rewritten.
- A superpowers phase already in progress keeps the context it started
  with. Re-running its switch rewrites constraint 7, which its plan copied
  verbatim from the old derivative.

### Added

- `docs/tutorial/simple-login/`: a complete, recorded HSDD run on a small
  product (a two-endpoint login backend and a two-screen web app). The
  `template/` inputs (a PRD and an RFC), the `execute/` repository the run
  produced (tree, contracts, phase contexts, superpowers plans,
  verification docs, and the tested code), and an interactive
  `walkthrough/` with a presenter mode and a do-it-yourself mode, backed by
  a full process log.

- `docs/guide/`: an interactive, offline HTML guide for newcomers. A start
  page and nine short chapters, from the problem HSDD solves to running a
  project, using the user's guide's examples, with brownfield adoption and
  change intake as chapters of their own.

### Fixed

Two defects in the v0.10.0 phase context, found by the simple-login
tutorial run (`docs/tutorial/simple-login/walkthrough/process-log.md`,
"Findings about HSDD itself", 1 and 2) and reproduced on scratch copies of
its tree with the v0.10.0 skill before the fix.

- `hsdd-config` now copies each contract's `## Validation` section into
  its subsection, after Interface and Guarantees. The Discipline line and
  superpowers constraint 7 tell the session to test against the fixtures
  it names. Before, a consuming phase was told to test against fixtures
  its context never located, and a phase building the replay rig had no
  fixture format or placeholder rules.
- `hsdd-config` has a third direction, `referenced`, for a contract the
  file names that the phase neither consumes nor produces: named in the
  Phase block, or inside another contract's text. It gets the same
  subsection, is collected until no contract id lacks one, and is named in
  a Discipline line: use it only as the Scope says. Before, the Contracts
  rule (Consumes and Produces only) and the self-contained gate (every
  named id inline) contradicted each other, and rule 1 forbade inventing a
  label; both reproductions headed such contracts `consumes`, contradicting
  the Phase block.
- `hsdd-phase-plan`: a phase that works with a contract it neither
  consumes nor produces (a replay rig built ahead of the producing phase)
  names it as `{contract-id}@{version}` in its Scope, so the switch finds
  it.
- `spec/hsdd-spec-v0_10.md` states the same in place (§1.5, §1.6, §3.4,
  §3.6, §5.3, §9.2, §9.7, §9.8, §16.1, a glossary entry for referenced
  contract), with the upgrade in §15.1 and two rows in §18.1. The user's
  guide sample context, the README and the HTML guide agree.

## [0.10.0] - 2026-10-10

The release that follows 0.7.1. The 0.8.0 and 0.9.0 entries below describe
work that was never tagged; all of it ships here, with every rule
implemented by a skill.

Specification: `spec/hsdd-spec-v0_10.md`. Basis:
`review/2026-10-10-v0.9.0-review-fable-5.1.md` and
`review/2026-10-10-successor-direction-fable-5.1.md`. Acceptance:
`review/hsdd-v0_10-acceptance.md`.

### Upgrading from 0.7.1

- Reinstall the eleven skills.
- The first checkpoint after upgrading runs the upgrade behaviors: it
  enumerates the fixtureless `stable` contracts and emits the plan step
  that has `hsdd-reconcile` mark them `validation: grandfathered`.
- Add `**Ordering policy:** fp-progression` to `hsdd/conventions.md` to
  keep 0.7.1's ordering, or remove the old `FP ordering:` bullet to take
  `interfaces-first`. Until you do, the old bullet reads as
  `fp-progression`.
- The first phase switch replaces a verification template that has no
  `## Learnings`.
- `hsdd-adopt` and `hsdd-intake` do nothing until invoked.

### Added

- **The 0.8.0 rules the skills never received.** `hsdd-config`'s
  verification template gains `## Learnings` (one disposition per entry
  before sign-off) and `## Metrics`; `hsdd-contract` gains `compatibility`,
  `external_consumers`, the `retired` status, the executable-validation
  rule with canonical paths (it writes the schema and fixtures when it
  authors a contract or a new version; phases only replay them) and the
  `validation: grandfathered` key; `hsdd-spec` gains the `Team` and
  `Status` fields, integration nodes, graft mode and node retirement, and
  its conventions template the `**Ordering policy:**` and `**Teams:**`
  lines; `hsdd-phase-plan` gains the named ordering policy
  (`interfaces-first` default, `fp-progression`), the Phase Equivalent, the
  producer gate replay and append mode; `hsdd-reconcile` asserts an
  executable validation artifact at the `draft → stable` flip, marks
  grandfathered contracts and discharges each once `hsdd-contract` has
  written its artifact, and retires contracts; `hsdd-checkpoint` audits
  the grandfather set by membership against the upgrade checkpoint's
  marking step (carried forward until executed) and reports the remaining
  count, files backfill findings with retro phases,
  excludes retired nodes from the atlas's active view and seals a milestone
  document when its tick turns the last gate green; `hsdd-milestone` treats
  a sealed document as a closed campaign.
- **`hsdd-adopt`**, the brownfield entry point: a bundled, tested seam
  extractor (`hsdd/scripts/seams/`: manifests, routes, schemas, migrations and
  tables, topics, owners, co-change coupling; `render` writes the `## Observed
  surface` block, whose `modules:` line records the rendered prefixes, and
  `diff` re-extracts exactly those to detect drift), as-built node specs
  with required `unknown:` lines, `v0` contracts with
  `## Observed completeness`, a human confirmation of the tree before any
  node spec or contract is written, and never a refactoring proposal.
  Owners resolve by the last matching `CODEOWNERS` rule per file, read from
  the git top level; unreadable directories are skipped and reported.
- **`hsdd-intake`**: routes a change request into the existing tree
  (`local`, `cross-node`, `new-capability`, `structural`), reads every open
  intake first and serializes collisions, promotes an as-built landing
  first, and writes the dated, never-superseded intake record before any
  handoff. A PRD is never a root.
- **Promotion mode** in `hsdd-spec`; **as-built drift**, stale-caveat and
  intake-closure checks in `hsdd-checkpoint`, the drift check gated on the
  tree having an `## Observed surface`.
- **Chapter 15, rule by rule.** One table states, for every rule since
  0.7.1, its effect on an existing project and the skill that implements
  it. Nothing in the specification is specified without a skill.
- **§15.3 Artifact stability.** The artifact formats are frozen for the
  1.0 line; later changes are additive optional fields only.
- Everything 0.9.0 added (below): the generic phase context and its two
  derivatives, the coding method, `hsdd-summary` and chapter 13.

### Changed

- `hsdd-config`'s switch copies the verification template when it is missing,
  for either method, and replaces a pre-0.10 copy that has no `## Learnings`;
  a superpowers-only project previously never got it, and an upgrading project
  kept its old copy.
- The specification describes the phase context once: a session receives
  its phase, the Interface and Guarantees of the contracts it consumes and
  produces, and its ADRs' decisions (six places that still said "consumes
  only" were corrected).
- Ordering policy and teams mode are lines in the conventions body, not
  frontmatter.
- README leads with the review sitting as the rationale; bounded context is
  a consequence.
- Skills no longer mention pre-0.5 layouts; the specification supports
  0.6.1 and later.

### Removed

- The claim that 0.8.0's consolidation "ships for the first time" in 0.9.0.

## [0.9.0] - 2026-10-10 (never released; ships in 0.10.0)

Design:
`docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md`.

### Added

- **The generic phase context.** Before each phase, `hsdd-config` writes
  `hsdd-context/{phase-id}.md` in the implementation repo: the phase, the
  Interface and Guarantees of every contract it consumes and produces, the
  Decision and Consequences of its ADRs, its open questions, and pinned
  links. Every line is copied from a governance file or is fixed text.
- **Coding methods.** The phase context is wrapped, word for word, for
  OpenSpec (`openspec/config.yaml`) or for superpowers
  (`hsdd-context/superpowers/{phase-id}.md`, a spec for `writing-plans`
  whose Global Constraints carry test-first, the task cap, the gate and the
  verification doc). `**Coding method:**` in conventions sets the default;
  `/hsdd-phase {id} --method` overrides it.
- **`hsdd-summary`**, a new skill with zero-dependency scripts: the plan
  page and the checkpoint page, offline HTML reading aids with three
  audiences each, stamped against their inputs.
- **Chapter 13, Reading Aids**, in `spec/hsdd-spec-v0_9.md`.

### Changed

- `hsdd-config`: no longer OpenSpec-only. OpenSpec's phase block is now a
  superset of what earlier releases injected; `rules:` are unchanged.
- `hsdd-checkpoint`: `hsdd-context/` counts as in-progress evidence; when
  `hsdd/summary/` exists, its step 7 renders the checkpoint page.
- The invariant "one phase = one OpenSpec change" reads "one phase = one
  coding cycle"; the atlas non-goal is narrowed, not reversed.

### Removed

- The README and users guide no longer describe the brownfield entry point or
  change intake: their skills have not shipped. The specification still
  defines both (chapters 6 and 11); the skills and their walkthroughs arrive in
  v0.10.0.

## [0.8.0] - 2026-08-03 (never released; ships in 0.10.0)

A **consolidation, not a delta.** `spec/hsdd-spec-v0_8.md` is a single
standalone specification absorbing v0.3 through v0.7.1 and the tool-free half
of the shelved vNext exploration. The delta series remains in `spec/` as
history; nothing requires reading it. The delta format is retired for major
revisions.

Two new chapters carry the release's substance, both from one observation:
**the tree does not complete — phases complete, so after the first change
every project is brownfield.** Greenfield is a three-month bootstrap; the
rest of a system's life is the steady state.

Design: `docs/superpowers/specs/2026-07-29-v0_8-consolidation-brownfield-design.md`.
Acceptance record: `review/hsdd-v0_8-acceptance.md` (13/13 criteria PASS).

### Added

- **Chapter 6 — Entry B: Brownfield Adoption.** A codebase that already
  exists becomes a structural peer of the greenfield entry, not a special
  case. `hsdd-adopt` (forthcoming skill) extracts seams by bundled script,
  proposes a shallow tree on the seams that exist, and writes as-built node
  specs carrying an `## Observed surface` section stamped with the extraction
  SHA — with `unknown:` lines required, because a node with no unknowns is a
  node nobody looked at. It stops there: no decomposition below what the
  first change needs, and never a proposal to refactor the system into a
  nicer tree. Adoption cost scales with **seam count, not LOC**.
- **Chapter 11 — Steady State: Change Intake.** `hsdd-intake` (forthcoming
  skill) routes an incoming change request into the existing tree —
  `local` / `cross-node` / `new-capability` / `structural` — and writes the
  routing decision before the handoff. The load-bearing rule: **a PRD is
  never a root; there is one tree and it is the system's.** Intake records
  accumulate, dated and never superseded — the rule that replaces "wipe
  `hsdd/` and rebuild." Includes phase-plan append mode, spec graft mode,
  node retirement, collision serialization across open intakes, and a
  **legal bypass** for production incidents (hotfix → backfill finding →
  retro phase, escalating if unclosed across two checkpoints).
- **Chapter 14 (chapter 15 in the current specification) — Upgrading and Compatibility.** v0.8.0 is additive; the
  vehicle is checkpoint's existing adoption run. The one rule with teeth —
  `stable` contracts need executable validation — is **grandfathered and
  discharged on touch**: the set closes at upgrade, each contract gains
  fixtures only when a phase next touches it, and the remaining count is
  reported every checkpoint and can only fall.
- Adopted contracts start at **`v0`** with a required `## Observed
  completeness` caveat. `v0` is a permanent property, not a waypoint;
  `v0 → v1` is the contract-level adoption exit, taken only on redesign.
- Per-contract-version **`compatibility:` policy** — `additive-only` (the
  Protobuf discipline, claimable only if existing fixtures still pass),
  `versioned` (default), `frozen` — plus the `retired` status,
  `external_consumers`, and a live-consumer retirement finding.
- **Per-campaign milestone documents**, sealed when every gate is green and
  moved to `management/archive/`; sealing is evidence-backed, never declared.
- From vNext: executable validation for `stable`, both gates running the
  contract, integration nodes, the `## Learnings` loop dispositioned at the
  gate, mid-phase contract renegotiation, the unified **Phase Equivalent**,
  phase ordering as a named policy (`interfaces-first` default), the `Team`
  field, and the `## Metrics` block.

### Changed

- **Honest claims** (chapter 15, now chapter 16, mirrored in the README): context isolation
  is *probabilistic, not enforced* — the defense is prose and structure,
  pressure-tested and holding, not a mechanism. HSDD bounds per-session token
  cost; it *does not reduce the total*.
- The settled-decisions table gains a required **provenance column**
  (`field-tested` / `pressure-tested` / `reasoned-only`) so new material
  cannot inherit credibility from tested material. Most of what this release
  adds is `reasoned-only`, and the document says so.
- README and users guide: the reading path collapses to one specification,
  the skill table grows to ten, and the guide gains a brownfield walkthrough
  (adopt → intake → promote).

### Not included

- **No `hsdd` CLI.** No `context`, `lint`, `status`, `rename`, `check-scope`,
  or `template`. Mechanical invariants stay prose- and structure-enforced, on
  the 0.6.0 pressure-campaign evidence. Scripts are permitted only under one
  boundary: **bundled with a new skill, never changing how an existing skill
  behaves.** The mechanization line stays on the shelf as a later candidate.
- No `hsdd-review` skill, no multi-team enforcement, no back-application of
  v0.8.0 rules to existing artifacts, and no support for projects below
  0.6.1 (upgrade to 0.6.1 first).
- **Skill files are unchanged in this release.** `hsdd-adopt` and
  `hsdd-intake` and the amendments to the existing eight follow in a separate
  cycle, after this specification is approved.

## [0.7.1] - 2026-08-01

Driven by the first real-world `hsdd-checkpoint` run (the moka-microsite
adoption checkpoint of 2026-07-31) read against the hand-prompted 07-24 plan it
superseded, plus operator feedback of 2026-08-01. The emission conformed to
v0.7 §2.4's letter and was still harder for its human audience to execute:
every regression fell on the plan surface only humans consume, which §2.4
never made required. Delta spec: `spec/hsdd-spec-v0_7_1.md`.

### Changed

- `hsdd-checkpoint` execution-plan shape — three structural anchors for the
  human-facing surface, no new invariants:
  - "Copy-paste prompts with validation" generalizes to **Step details**:
    every step gets exactly one detail block. 🤖/🤝 steps keep the exact
    prompt + *Validate:* line; 👤 steps gain a **briefing** (*Why / Do /
    Done when*) — one checkbox per action, each naming its concrete target.
    Table cells shrink to a one-sentence summary: the cell indexes, the
    block instructs.
  - New required **Plan graph** section: one Mermaid flowchart (load-bearing
    syncs as junctions, step batches in lane subgraphs, edges from the
    Depends column), derived from the tables and regenerated whole — when
    graph and tables disagree, the tables win. ~20-node ceiling; no
    per-phase charting; applies in scoped mode too.
  - New required **Sync sections**: every load-bearing sync (one any step,
    decision, or lane start depends on) gets Entry / Agenda / Exit /
    Unblocks, with its decisions defined once in the Agenda (question,
    options, landing artifact) and only cited elsewhere. A step may depend
    only on a sectioned sync. The standing weekly stays a table row.
  - Five new quality gates and three new anti-rationalization rows anchor
    the above.
- Users guide: the weekly-checkpoint walkthrough describes the new plan
  surface and states the briefing rule's reason — the human is the one
  executor who cannot be re-prompted.

### Acceptance

- Re-tested per the delta's §7 against the microsite fixture, 2026-08-01: a
  clean-room re-emission of the 2026-07-31 execution plan from the same
  evidence (the updated skill text, the progress report, and the superseded
  plan — the prior emission withheld) produced all three previously missing
  behaviors: *Why / Do / Done when* briefings on every 👤 step, a 19-node
  plan graph consistent with the step tables, and sectioned syncs with
  their decisions defined once and cited by ID — with all 27 findings
  still landing as steps or explicit waivers. A loophole hunt over the
  three new anti-rationalization rows found no dodge the quality gates do
  not close.

## [0.7.0] - 2026-07-26

Driven by the moka-microsite field deployment (2026-07-10 → 07-24: three repos,
two developers, 89 phases under v0.6.1). Delta spec: `spec/hsdd-spec-v0_7.md`.

### Added

- The management layer: `management/` as a fourth artifact class (cite, never
  define) — dated progress reports, execution plans, and milestone documents
  chained by exact-filename supersedes links, plus a living, regenerated
  `atlas.md` (spec tree with phase status, contract graph, ADR coverage map).
- `hsdd-checkpoint` (+ `/hsdd-checkpoint`): one evidence pass across the spec
  repo and every implementation repo emitting all four views, in full or scoped
  mode; the findings→plan loop (every finding becomes a plan step or an explicit
  waiver); the first run on an existing project is an adoption run. Sibling repo
  paths come from the invoking prompt; the skill asks when they are absent.
- `hsdd-milestone` (+ `/hsdd-milestone`): the stakeholder milestone document — a
  demo and a gate per milestone, with a computed contingent tail excluded from
  the launch gate — generated once every leaf-parent is phase-planned, and
  re-baselined on the slip or scope trigger with both windows stated.
- Open-question convention: stable IDs (`OQ{n}` / `OQ-{prefix}{n}`), one
  definition home, the `| ID | Question | Status | Waits on | Affects |` table
  with `OPEN` / `PARTIAL` / `RESOLVED (date)`, anchored structurally in
  `hsdd-spec` (templates + minting), `hsdd-phase-plan` (a contingency must name
  its question — a stop), `hsdd-contract` / `hsdd-adr` (cite-only), and
  `hsdd-reconcile` (resolution citation sweep).
- Standalone-spec-repo profile for multi-repo projects: the HSDD tree is its own
  repo, mounted as a submodule **at `hsdd/`** — so every path is unchanged and no
  skill needs profile-specific resolution. Adds the run-location rule (skills run
  from an implementation repo, never from a standalone clone of the spec repo)
  and four incident-backed rules: pointers reference spec-repo main only, a phase
  is done when its verification doc is on spec-repo main, cross-repo branch pairs
  land or are discarded atomically, and multi-phase epics are never
  squash-merged.
- Users guide: a "Running the project" chapter covering the developer/lead role
  split, the weekly rhythm, milestones, open questions, the multi-repo profile,
  and adoption on a project already underway.

### Changed

- `hsdd-config` checks the submodule pointer as the **first** step of the phase
  context switch under the profile — it gates every later step, all of which read
  through `hsdd/`.
- The vNext mechanization draft renumbers from 0.7.0 candidate to 0.8 candidate.
  v0.7 is additive over v0.6.1 by contract (spec §7.1), with microsite-hsdd as
  the acceptance fixture (§7.3).

### Acceptance

- **Gate discharged (spec §7.3), 2026-07-26.** Both skills ran against the
  microsite reference project — a live v0.6.1 project mid-implementation — from
  an implementation repo in a cold-context session, and produced conforming
  documents without manual repair. The adoption run caught 7/7 seeded findings
  plus a High finding the expectations missed (a signed verification doc whose
  implementation exists nowhere in the repo), and all 26 register entries trace
  to a plan step or an explicit waiver. `hsdd-milestone` adopted the existing
  baseline and declined to generate. Four skill defects surfaced and were
  fixed: `hsdd-checkpoint` ended by asking the operator to adjudicate findings
  instead of pointing at the plan steps that already recorded them; and
  `hsdd-milestone` lacked a slip-trigger bootstrap rule, a home for
  internally-blocked work, and a route for its own findings into the
  findings→plan loop. Full record: `review/hsdd-v0_7-acceptance-microsite.md`.

## [0.6.1] - 2026-07-13

Driven by the v0.6.0 pressure-test campaign
(`review/hsdd-skills-v0_6_0-pressure-test-fable-xhigh.md`) and a field
observation on source-document provenance. Delta spec:
`spec/hsdd-spec-v0_6_1.md`.

### Added

- Source provenance: the root spec carries a `## Sources` section and every
  node a `Sources` field that trickles down at each decomposition level;
  quality gates ensure no source is silently dropped and none is listed on
  a node it does not govern. `hsdd-phase-plan` reads the node's sources and
  lands binding details in phase lines or contract entries; phase contexts
  are unchanged (sources are never injected).
- Sizing-floor checklist item in `hsdd-phase-plan` (the ceiling always had
  one), a one-line kept-split reason whenever a merge candidate stays
  separate, and an anti-enumeration-anchoring row.

### Changed

- The "who builds what?" clarifying question is a mandatory stop when the
  input does not state team structure and the system plausibly spans
  stacks; proceeding on an assumed axis is no longer allowed.
- `hsdd-spec` step 7 writes one spec file per node: every child gets its
  own `hsdd/spec/{child-id}.md` at decomposition time.
- Format clarifications in `hsdd-phase-plan`: the summary table opens the
  `## Phase Plan` section; phase ids in tables and `Collides with` match
  the section headers; `Collides with` may carry a one-line reason.

## [0.6.0] - 2026-07-13

Driven by the second field test (FT-2) and its review
(`review/hsdd-process-v0_5_1-review-fable-xhigh.md`). Delta spec:
`spec/hsdd-spec-v0_6.md`.

### Added

- Phase summary table: every phase plan opens with a per-phase overview
  (phase, name, tier, size, dependencies, collisions) for the human
  reviewer; `hsdd-config` still injects only the detailed section.
- Sizing floor in `hsdd-phase-plan`: adjacent phases with the same tier,
  the same contracts, and a clean dependency shape merge instead of each
  paying a full OpenSpec cycle; artifacts-exceed-diff is the default merge
  smell. The anti-merge anti-rationalization row is replaced by two
  motive-aware rows.
- Tier-scaled artifact profile: gate-only phases skip `design.md` and get a
  slim verification doc; spot-check skips design unless a real decision
  exists; full-review keeps the full set. Tasks and spec deltas never
  scale, and every phase still produces a verification doc.
- Execution protocol (conventions template, `hsdd-config`, users guide):
  `openspec/config.yaml`'s phase block is ephemeral (take either side on
  merge, re-run `/hsdd-phase`); one integration branch per node; plans and
  reconcile live on exactly one lineage; `Collides with:` marks textual
  contention and serializes execution; capabilities are named after stable
  feature areas, not phases.
- Ownership-first decomposition axis in `hsdd-spec`: split stack-first when
  different teams own different parts of the stack; capability slices apply
  within one owner's territory. "Who builds what?" is the canonical
  clarifying question.
- Bundled verification-doc template (`hsdd-config`, copied to
  `hsdd/templates/verification.md` at setup) with Outstanding and Sign-off
  sections; the review gate is not passed while an Outstanding item lacks a
  disposition.

### Changed

- Node and phase templates emit field blocks as bullet lists (bare
  `**Field:** value` lines collapse into one paragraph in every compliant
  renderer); empty contract lists render "none"; standalone node specs no
  longer duplicate their title as an inner heading.
- `hsdd-phase-plan`'s dependency graph is a Mermaid flowchart (pastel style
  if installed; cross-node dependencies dashed); the ASCII example is
  retired. A phase plan may declare a node-level default gate.
- `hsdd-config`'s compound tasks rule is split into three rules; the phase
  context switch warns when the requested phase is not next-runnable.
- Users guide: examples reformatted to the new templates, review-tier
  section updated, execution-stage walkthrough added (Step 8).

## [0.5.1] - 2026-07-06

- `hsdd-phase-plan` no longer implies it should create verification documents.
  The phase template's Verification field said the description "becomes the
  verification doc at hsdd/verify/{phase-id}.verification.md", which agents
  read as an instruction to write that file during planning. The field is now
  explicitly a 1-3 line statement of intent, with a rule that the plan's only
  output is the node's plan file: the verification doc is written at apply by
  the documentation task `hsdd-config` injects, once implementation details
  exist, for the human to verify the completed change before archive. Added a
  matching anti-rationalization entry.

## [0.5.0] - 2026-07-06

### Changed

- **Breaking:** every HSDD artifact now lives under one root directory,
  `hsdd/`, with singular directory names (`spec/hsdd-spec-v0_5.md`):
  - `docs/conventions.md` -> `hsdd/conventions.md`
  - `docs/spec/` -> `hsdd/spec/`
  - `docs/verify/` -> `hsdd/verify/`
  - `contracts/` -> `hsdd/contract/`
  - `adr/` -> `hsdd/adr/`
  - `scripts/gen-registry.mjs` -> `hsdd/scripts/gen-registry.mjs`

  `openspec/` is unchanged; OpenSpec owns that location. The layout stays a
  default: a project may override any path in its conventions file.
- `gen-registry.mjs` defaults: root is `./hsdd` (was cwd), scanning
  `contract/` and `adr/` under it. `--root <dir>` is unchanged. Standard
  invocation is now `node hsdd/scripts/gen-registry.mjs`.
- Skills that load conventions read `hsdd/conventions.md` first and fall back
  to `docs/conventions.md` for pre-0.5 projects, honoring the layout that
  file states and offering to migrate.
- README, users guide, and all six skills updated to the new paths, including
  trigger phrases (`hsdd/contract/INDEX.md`, `@hsdd/spec/foo.md`).

### Migration (existing projects)

```bash
mkdir -p hsdd/scripts
git mv docs/conventions.md hsdd/conventions.md
git mv docs/spec hsdd/spec
git mv docs/verify hsdd/verify        # if present
git mv contracts hsdd/contract
git mv adr hsdd/adr                   # if present
git mv scripts/gen-registry.mjs hsdd/scripts/gen-registry.mjs
```

Then update the layout section of `hsdd/conventions.md` (or re-seed it from
the template) and re-copy the bundled generator, since the old copy scans the
old paths. Keeping the old layout is also fine: state it in the conventions
file and the skills honor it.

## [0.4.2] - 2026-07-05

### Added

- `hsdd-reconcile` skill: drain the `## Governance updates (pending reconcile)`
  sections emitted by `hsdd-phase-plan`, resolve contract-gap requests with the
  human, finalize contract phase ids, and regenerate the registries. Runs at
  the repo root after (parallel) phase-plan branches merge.
- `/hsdd-reconcile` slash command.
- Governance freeze protocol (`spec/hsdd-spec-v0_4_2.md`): `contracts/`,
  `adr/`, `docs/conventions.md`, and the INDEX registries are read-only during
  phase planning; intended changes ride the node's own plan file as
  `confirm`/`note`/`amend`/`request` entries. Parallel phase planning in
  git worktrees becomes conflict-free by construction.
- Contract frontmatter field `phase_ids: provisional | final`, flipped only by
  `hsdd-reconcile`. No generator change: unknown fields are ignored by the
  projection. `status` flips `draft` to `stable` at the end of the same
  reconcile pass, once `phase_ids` is `final` and no unresolved `request`
  names the contract (interface-frozen semantics).

### Changed

- `hsdd-phase-plan` no longer updates `docs/conventions.md` (old process step
  6); it emits a pending-governance section, asks the human when a contract
  gap changes the plan's shape, and never reads sibling worktrees.
- `hsdd-contract`: contracts are written at the root only; prose "update the
  phase ids later" notes are replaced by the `phase_ids` field; a new quality
  gate requires naming the canonical path and owning phase of any code-level
  artifact both sides consume.
- `hsdd-config`: the tasks rule no longer instructs the apply step to update
  `docs/conventions.md`; the phase context switch warns when a consumed
  contract is still provisional and stops when the phase is contingent on an
  unresolved request.
- Conventions template: the hand-maintained `## Established contracts` list is
  replaced by a pointer to the generated `contracts/INDEX.md`, plus a new
  `## Parallel development protocol` section.
- Users guide: reconcile in the loop and the workflow diagram; a serial
  reconcile note in Example 1 and a parallel-worktrees walkthrough in
  Example 2.

## [0.4.1] - 2026-07-02

### Fixed

- `hsdd-contract` and `hsdd-adr` now require copying the bundled
  `scripts/gen-registry.mjs` verbatim and explicitly forbid reimplementing it from
  the skill description. A retyped generator silently mis-projects the registry (for
  example emitting the ADR `affects` column for contracts, which use
  `owner`/`consumers`), and a regenerate-and-diff check does not catch it.
- `hsdd-adr` closes a bootstrap gap: the registry generator ships only with
  `hsdd-contract`, but ADRs are frequently materialized before the first contract.
  The skill now says so and points to the `hsdd-contract` skill's bundled copy
  instead of implying the generator is already present.

## [0.4.0] - 2026-07-02

### Added

- `hsdd-adr` skill: author and maintain cross-cutting Architecture Decision
  Records as first-class files (`adr/{nnn}-{title}.md`) with registry-compatible
  frontmatter, a status lifecycle (proposed/accepted/superseded/deprecated), and
  bidirectional `Affects`/`Governed by` links.
- `/hsdd-adr` slash command.
- `spec/hsdd-spec-v0_4.md`: delta spec over v0.3.
- Documented where to run `openspec init` (once, at the repo root; one OpenSpec
  project per HSDD tree) in the spec, README, user's guide, and conventions template.

### Fixed

- Broken ADR handoff: `hsdd-spec` now hands accepted ADRs to `hsdd-adr` to
  materialize as files instead of leaving them as inline prose; `hsdd-config`
  stops and authors a referenced-but-missing ADR rather than fabricating or
  dropping it.
- Reconciled the ADR artifact with `gen-registry.mjs`: ADRs now carry YAML
  frontmatter (the generator reads `id`/`status`/`affects`), superseding the
  body-field example in v0.3 §12.4. No generator change required.

## [0.3.0] - 2026-07-01

### Added

- `hsdd-spec` skill: turn a brain-dump into a high-level spec and decompose nodes into subsystems.
- `hsdd-phase-plan` skill: break a leaf-parent node into ordered, independently implementable phases.
- `hsdd-contract` skill: define, version, and update first-class contracts between nodes.
- `hsdd-config` skill: set up/update OpenSpec `config.yaml` and switch phase context.
- Slash commands under `commands/`.
- Docs (`docs/`), specs (`spec/`), and review assets (`review/`).

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/OWNER/REPO/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/OWNER/REPO/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/OWNER/REPO/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/OWNER/REPO/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/OWNER/REPO/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/OWNER/REPO/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/OWNER/REPO/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OWNER/REPO/releases/tag/v0.3.0
