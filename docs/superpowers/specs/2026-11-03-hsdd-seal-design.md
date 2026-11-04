# hsdd-seal: sealing a released tree by script

Design record for the thirteenth skill, `hsdd-seal`. Decided in conversation
with the owner on 2026-11-02 and 2026-11-03; this file is the written form a
builder plans from.

## Intent

A system shipped and QA verified it, and its HSDD tree went stale: unsigned
verification docs, phases planned and never built, open intake records, an
unsealed milestone document, an execution plan full of steps nobody will do.
The owner wants the ledger consistent so steady-state intake can resume, and
will not verify phase by phase. The spec already admits every act the seal
needs (delegated sign-off counted done, Outstanding waived with a reason, a
retroactive verification doc, findings waived in the plan, a campaign sealed
when its gates are green, a convention in `conventions.md` reaching every
skill). What it lacks is a status for a phase that was never built, and a way
to do all of it without a model reading every file.

The seal is clerical. Almost nothing in it needs judgment, and the one thing
that does, which phases shipped, is the owner's knowledge, not a model's.
So the seal is a script: it computes a plan from the tree, the owner edits
one column, the script applies the plan, and a model is never in the loop.
The project that prompted this runs on a metered account; the open-source
repo does not.

## Goals

- Zero model tokens for a seal: `plan`, an owner edit, `apply`, `report`.
- Every write is computed first and shown as a dry run; `--write` applies.
- Honest artifacts: a signed doc says the phase was not individually
  observed and what stood in for that; nothing claims a run that did not
  happen.
- Unparsed input is reported with file and line and skipped, never guessed.
- Idempotent: a second `apply` of any step changes nothing.
- Self-contained: Node 20, no dependencies, copied verbatim into
  `hsdd/scripts/seal/` like `gen-registry.mjs` and `seams/`.

## Non-goals

- No checkpoint, reconcile or milestone generation. The first steady-state
  checkpoint after the seal supersedes the pre-seal plan; a reconcile runs
  when the first intake needs one.
- No edits to contract or ADR bodies, node headers, shipped phases, or any
  management document other than the ones named below.
- No attribution of commits to phases, and no code evidence of any kind:
  the owner classifies.
- No new mechanism in any other skill. The only change outside the new
  skill is packaging: README row, command file, changelog.

## Anti-goals

- A seal that invents an observation, a reviewer or a date.
- A plan the owner cannot read in one sitting.
- A script that edits prose it did not generate (the only prose edits are
  appended change-log lines and one appended conventions paragraph).

## Constraints

- Verification docs follow `hsdd-config`'s bundled template; the generated
  doc keeps that template's title line and section names exactly.
- A delegated sign-off reads `Claude for {owner} (delegated), {date}` and
  counts as done under spec §10.2.
- The dropped status is a project convention: `- **Status:** dropped
  ({date}, not built before release {tag})` directly after the phase
  record's `- **Review tier:**` line, plus one paragraph under
  `## Phase design` in `hsdd/conventions.md`. A future spec version may
  name it; until then every checkpoint prompt restates it.
- Intake records close by the spec's rule only: `## Produced` names at
  least one phase and every listed phase is done. A record whose produced
  phases are all dropped stays open with a dated change-log line.
- A milestone gate is ticked when every phase it names is done or
  dropped; the dropped ones are recorded in the document's change log as
  an absorb (dates hold). When every gate is ticked the header gains
  `- **Sealed:** {date}` and the file moves to `hsdd/management/archive/`.
- Under the standalone-spec-repo profile `hsdd/` is a git submodule: git
  queries about `hsdd/` paths run inside it; `openspec/` is in the
  implementation repo.
- The plan and its JSON live in `hsdd/management/` with the slug
  `seal-plan`, which the reading aids never mistake for a dated report.

## Decided

- **Packaging.** A new skill directory `skills/hsdd-seal/` with a short
  `SKILL.md`, `scripts/seal.mjs` and `scripts/lib/`. `md.mjs` and
  `extract-plan.mjs` are copied from `hsdd-summary/scripts/` into
  `hsdd-seal/scripts/` so the installed skill is self-contained; a test in
  this repo keeps the copies byte-identical.
- **Commands.** `plan`, `apply sign|drop|prune|close`, `report`. Options
  on `plan`: `--release`, `--date`, `--owner`, `--evidence`, `--catchup`
  (a revspec, `since:YYYY-MM-DD`, or comma-separated shas), `--keep`
  (phase ids), `--today`. `apply` and `report` take `--plan <json>`;
  `apply` takes `--write` (default dry run) and `--commit`.
- **Classification defaults.** `done`: a doc exists whose Reviewer line
  names someone (non-empty, no `{placeholder}`, not none/tbd). `sign`: not
  done, and the newest progress report's "What is done" tables name the
  phase, or a doc exists that the catch-up commits did not add. `drop`:
  everything else. `keep`: only by `--keep` or the owner's edit. A phase
  already `dropped`, or in a retired node, is left alone. When in doubt,
  drop: a built phase wrongly dropped is re-planned by a later intake; an
  unbuilt phase wrongly signed makes contracts claim behavior the code
  lacks.
- **Sign.** A missing doc is written whole from a fixed template. A doc
  the catch-up commits added is rewritten whole (its Observed text is not
  evidence). Any other unsigned doc keeps its body and gets its
  `## Sign-off` section rewritten, `- none` inserted into an empty
  `## Learnings`, and Outstanding items waived.
- **Prune.** A directory under `openspec/changes/` (archive included) is
  deleted when every file in it was first added by the catch-up commits.
  `openspec/specs/` is never touched.
- **The owner's edit surface** is the JSON `class` field. The markdown is
  a rendering and says so.
- **Execution.** Native, in this session, test first per task, one fresh
  reviewer on the whole branch at the end.

## Left to the builder

Parser tolerances beyond those the tests fix, the exact wording of dry-run
output, and the order of sections in the rendered plan.
