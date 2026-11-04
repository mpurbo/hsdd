---
name: hsdd-seal
description: >
  Use when a system has shipped and QA verified it, but its HSDD tree went
  stale and the owner wants the ledger consistent without verifying phase by
  phase: unsigned verification docs, phases planned and never built, open
  intake records, an unsealed milestone document. Runs a zero-dependency
  script: plan, an owner edit, apply, report; no model reads the tree.
  Triggers: "seal the tree", "we released, close out the ledger", "bulk
  sign-off after release", "the HSDD artifacts are stale after release",
  "mark the unbuilt phases dropped", "archive the campaign". Do NOT use for
  a system that has not shipped (the checkpoint's backfill path, spec §11.8),
  for one phase (write its verification doc), for draining governance
  (hsdd-reconcile) or for the weekly evidence pass (hsdd-checkpoint).
---

# HSDD Seal: Close the Ledger of a Released Tree

The seal is clerical. Every act it needs is already admissible under the
spec: a delegated sign-off counts as done (§10.2), an Outstanding item may
be waived with a reason, a verification doc written after the fact is the
retroactive doc the bypass rule names (§11.8), an intake record closes when
its produced phases are done (§11.5), a campaign seals when its gates are
green (§12.5), and a protocol stated in `hsdd/conventions.md` reaches every
skill (§14.2). The one rule it adds, the dropped status for a phase that was planned and
never built, is spec v0.12 §3; the seal itself is v0.12 chapter 4. Nothing here needs judgment except which
phases shipped, and that is the owner's knowledge, so the owner edits one
field and a script does the rest.

**Core principle: the script writes only fixed sentences.** A signed doc
says the phase was not individually observed and what stood in for that.
Nothing claims a run that did not happen, a reviewer who did not sign, or a
date that is not today's.

## What a seal is, and is not

A sealed tree has every phase **done** (a signed verification doc on the
main line) or **dropped** (`- **Status:** dropped (date, reason)` on its
record), every intake record with done phases **closed**, the campaign's
milestone document **sealed** and in `hsdd/management/archive/`. It does
not run a checkpoint, a reconcile or a milestone generation: the expensive
evidence pass was already paid for, and the first steady-state checkpoint
after the seal supersedes the pre-seal plan. It edits no contract, ADR,
node header or shipped phase.

## Setup (first run in a project)

Copy this skill's `scripts/` directory **verbatim** to `hsdd/scripts/seal/`
(this skill's base directory is printed when the skill loads). Never retype
a file: the copy is the code the tests cover. Node 20 or later. Every
command runs from the project root, the directory that holds `hsdd/`; under
the standalone-spec-repo profile, from an implementation repo, where the
script commits inside the submodule and bumps the pointer.

## Procedure

1. **Plan.** One command reads the tree and writes two files under
   `hsdd/management/`, `{today}-seal-plan.json` (the owner's edit surface)
   and `{today}-seal-plan.md` (a rendering):

   ```bash
   node hsdd/scripts/seal/seal.mjs plan --release 2.4.0 --date 2026-09-15 \
     --owner "Dewi Lestari" --evidence "QA regression 2.4.0, Jira PAY fix version 2.4.0" \
     --catchup a1b2c3d..f4e5d6c
   ```

   `--catchup` names the commits an earlier catch-up attempt made (a
   revspec, `since:YYYY-MM-DD`, or comma-separated shas); the plan marks
   the verification docs and OpenSpec directories they added. The value is
   checked first: a `since:` date must be a calendar date, and every sha or
   range end must be a commit in each repository the catch-up is read from;
   under the standalone-spec-repo profile only `since:` reaches both the
   implementation repo and the submodule. A bad value exits 1 and writes
   nothing. An existing plan file is never overwritten without `--force`,
   because it may carry the owner's edits. `--keep` names phases to leave
   open. Every phase gets a default class:
   `done` (signed doc), `sign` (the newest progress report counts it done,
   its phase context exists, an OpenSpec change names it, or a doc existed
   before the catch-up), `drop` (nothing else), `keep` (only by `--keep`),
   `skip` (already dropped, or a retired node). When in doubt the default
   is `drop`: a built phase wrongly dropped is re-planned by a later
   intake; an unbuilt phase wrongly signed makes contracts claim behavior
   the code lacks.
2. **The owner edits the `class` field** in the JSON where the default is
   wrong, and may shorten the `prune` list. Nothing else in the file is
   acted on: every path is re-derived from the phase id or re-checked
   against a fresh scan at apply time, and a path that leaves the project
   root is refused. The markdown's Unparsed table lists what the parsers
   could not read; those items get no edit and must be handled by hand.
3. **Apply, one step at a time,** each as a dry run first, then with
   `--write`, and `--commit` to commit only the paths it touched
   (`seal: {step}`; anything else the owner had staged stays staged). Under
   the profile, `--commit` refuses to write while `hsdd/` has a detached
   HEAD, since a commit there would sit on no branch:

   ```bash
   node hsdd/scripts/seal/seal.mjs apply sign  --plan hsdd/management/2026-11-03-seal-plan.json
   node hsdd/scripts/seal/seal.mjs apply sign  --plan hsdd/management/2026-11-03-seal-plan.json --write --commit
   # then drop, prune, close the same way
   ```

   - `sign`: a missing doc, or one the catch-up added, is written whole from
     the fixed template; any other unsigned doc keeps its body and gets its
     `## Sign-off` rewritten (`Claude for {owner} (delegated), {today}`,
     Outstanding waived, Learnings `- none` when empty). When a doc already
     carries Learnings entries, their disposition line reads `dropped (sealed
     at release {tag}; not actioned)` and the report lists the phase for a
     person to read them; the seal never claims a disposition nobody made.
   - `drop`: the Status line after each dropped phase's `Review tier`, and
     one paragraph under `## Phase design` in `hsdd/conventions.md`. A doc
     the catch-up added for a dropped phase is left in place and listed for
     the owner; the seal deletes no verification doc.
   - `prune`: deletes each `openspec/changes/` directory whose every file
     the catch-up added; `openspec/specs/` is never touched.
   - `close`: re-scans, closes intake records whose produced phases are all
     done (appending cited phases first), closes an all-dropped record as
     `closed (date, dropped)` since its request was not delivered, leaves a
     mixed record open, ticks each gate whose phases are done or dropped (a
     gate written as a range, `a.1–a.4`, counts every phase of that node in
     the range),
     records the dropped ones in the change log as an absorb, and when every
     gate is ticked adds `- **Sealed:** {today}` and moves the document to
     the archive.
4. **Report.** `report --plan ... --write` appends a `## Result` section to
   the plan markdown: counts, records, the milestone, pending governance,
   what was pruned, and **Needs the owner**: `request` entries for
   `hsdd-reconcile`, gates still open, records still open, kept phases,
   unparsed items. That list is the whole of what the owner reads.

Each step is idempotent: a second `apply` changes nothing.

## Rules

- Never write an observation, output or date for a run that did not happen.
- Never edit a contract or ADR body, a node header, a shipped phase, or any
  management document other than the intake records, the milestone document
  and the seal plan.
- Never delete a verification doc, an intake record, a progress report or an
  execution plan; never touch `openspec/specs/`.
- Never answer a `request` entry; it is a contract gap for a person.
- The dropped status is spec v0.12 §3. On skills older than 0.12.0 every
  checkpoint prompt restates "treat a phase carrying `- **Status:** dropped`
  as out of scope and not counted"; the conventions paragraph the seal
  appends states it where a project's own agents read it.

## When to stop

- A phase the parsers could not read (the plan's Unparsed table) or a gate
  that names no known phase: the owner classifies it or edits the document
  by hand; the script will not guess.
- A gate that names a phase neither done nor dropped keeps the document
  unsealed. `hsdd-milestone` keeps one unsealed document at a time, so work
  the owner wants to keep belongs in a new campaign after the seal, or is
  dropped and re-enters through `hsdd-intake`.

## After the seal

Steady state resumes through `hsdd-intake`. The first checkpoint after the
seal, scoped to the seal commits, supersedes the pre-seal execution plan,
lists the seal's delegated sign-offs in one finding for the owner to ratify,
and carries the standing decision that every finding except a contract or
ADR item is waived "sealed at release {tag}". A reconcile runs when the
first intake needs one; the seal left every pending section in place.

## Quality Gates

- [ ] `hsdd/scripts/seal/` is byte-identical to this skill's `scripts/`.
- [ ] The plan was written and the owner edited its `class` field before any
      `apply --write`.
- [ ] Every `apply` ran as a dry run before `--write`.
- [ ] No verification doc carries an Observed sentence other than the fixed
      retroactive one or a real run's record.
- [ ] Every dropped phase has its Status line and the conventions paragraph
      exists once.
- [ ] No file outside `hsdd/` changed except deletions under
      `openspec/changes/`.
- [ ] The report's Needs the owner list is in the owner's hands; nothing on
      it was answered by the agent.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll sign it as the owner" | A sign-off names who answers for it. `Claude for {owner} (delegated)` is admissible and comes back to the owner at the next checkpoint; the owner's name alone is a forgery. |
| "The Observed section can describe what probably happened" | Probably is not observed. The fixed sentence names the release and the QA evidence; that is the record. |
| "I'll delete the whole openspec/ directory, it is all stale" | `openspec/specs/` describes current behavior, which exists. Only change directories the catch-up invented go. |
| "I'll run a full checkpoint to be safe" | The evidence pass was paid for before the seal and nothing in the code changed. The first steady-state checkpoint, scoped, finishes the seal. |
| "This phase has no doc, but I remember it shipped" | The owner's memory is the edit to the `class` field. The script's default is drop, and the owner overrides it in the file, where the decision is recorded. |
