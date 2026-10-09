---
name: hsdd-summary
description: >
  Use when someone needs to read an HSDD tree or its management documents
  without reading every artifact: renders offline HTML reading aids. The plan
  page takes a reviewer, a stakeholder or an implementer from the root down to
  the phase cards, with What to check at every level; the checkpoint page lays
  out the newest progress report and execution plan for the lead running the
  sync, each lane's executor, and stakeholders. Triggers: "summary page",
  "review page", "plan page", "summary.html", "checkpoint page",
  "checkpoint.html", "make the execution plan readable", "a reading aid for
  this MR", "explain the tree to the PM", "show me the plan from the top",
  "stale summaries", "hsdd/summary". Do NOT use for writing or changing specs,
  contracts or ADRs (hsdd-spec, hsdd-contract, hsdd-adr), writing progress
  reports or execution plans (hsdd-checkpoint), or the phase context
  (hsdd-config).
---

# HSDD Summary: Reading Aids

Render optional, derived reading aids over the tree: one offline HTML file
per page, under `hsdd/summary/`. The specs, contracts and ADRs stay the source
of truth; a page only helps a person into them, and if it disagrees with them
the page is wrong.

**Core principle: facts from the scripts, framing from you.** The bundled
scripts compute every id, count, edge, table and diagram. You do two things
only: fill the fields the parser flags as unparsed, by reading the source at
the line it names, and write short plain-English prose into the slots it
lists. You never draw an edge, count anything, restate a contract or edit a
source.

## Pages

| Page | File | Built from | Regenerate |
|------|------|------------|------------|
| Plan page | `hsdd/summary/summary.html` | `hsdd/spec/`, `hsdd/contract/`, `hsdd/adr/`, `hsdd/conventions.md`, `glossary.json`, `prose.json` | after each `hsdd-spec` level and each phase plan, so the reviewer opens it in the same merge request |
| Checkpoint page | `hsdd/summary/checkpoint.html` | the newest progress report and execution plan, the chain behind them, the atlas, the node names in `hsdd/spec/`, `checkpoint-prose.json` | at every checkpoint, as `hsdd-checkpoint`'s gated step |

Each page is stamped with a hash of every input it read; `check` reports it
stale when any input changes. Nothing gates on a page, and nothing outside
`hsdd/summary/` is ever written.

## Setup (first run)

Copy this skill's `scripts/` directory, `vendor/` included, **verbatim** to
`hsdd/scripts/summary/` in the project (this skill's base directory is printed
when the skill loads). Never retype a file: the copy must be the code the
skill's tests cover, including the escaping and offline rules. Every command
below runs from the project root, the directory that holds `hsdd/`.

## Audiences

| Audience | Reads the page to | Ids | Detail |
|----------|-------------------|-----|--------|
| `reviewer` (default) | approve a spec level or a phase plan, then read the source | shown | full, with What to check |
| `stakeholder` | understand the plan without reading the source | never | names, counts and plain words; no gates, no question text |
| `implementer` | orient before a phase | shown | full, plus gates |

On the checkpoint page:

| Audience | Reads the page to | Ids | Detail |
|----------|-------------------|-----|--------|
| `lead` (default) | run the sync | shown | the read, tiles, gates, syncs, the plan graph, blockers, findings, the delta |
| `executor` | work a lane between syncs | shown | each lane's steps in run order, prompts and briefings in full, a copy button on every prompt |
| `stakeholder` | know where things stand | never | the verdict, id-free bottom-line rows, milestones in plain words, what could slip |

Keys on the page: `1` `2` `3` switch audience, `t` the top, `u` up a level;
on the plan page `c` contracts and `d` decisions; on the checkpoint page `f`
findings and `s` build progress. The Shortcuts button turns them off.

## Process (plan page)

1. **Extract.**

   ```bash
   node hsdd/scripts/summary/summary.mjs extract plan
   ```

   It writes the model to a scratch file and prints every unparsed item:
   a model path (`/phases/4/tier`), the source file and line, and the reason.
2. **Fill each unparsed item from its source.** Open the file at the line,
   read what the artifact says, and set the model field at that path (a tier
   becomes one of `gate-only`, `spot-check`, `full-review`; a dependency list
   becomes full phase ids). Delete the entry from `unparsed`. Never add an
   item the parser did not flag, never guess a value the source does not
   state, and never edit the source: a source defect is a finding for its
   owning skill.
3. **Validate.**

   ```bash
   node hsdd/scripts/summary/summary.mjs validate plan
   ```

   Exit 0 means the model is complete. An error means the extraction is
   wrong; fix the model, not the check. Findings are not errors: they appear
   on the page under What to check.
4. **Seed the prose.**

   ```bash
   node hsdd/scripts/summary/summary.mjs slots plan
   ```

   It adds missing entries to `hsdd/summary/prose.json` and
   `hsdd/summary/glossary.json` and lists what to write first.
5. **Write the prose** (rules and examples below). Write only into empty or
   stale `text` fields and empty glossary entries. Never touch `facts` or
   `textHash`, and never change a glossary entry that has text: people own
   it.
6. **Lint, rewriting at most twice.**

   ```bash
   node hsdd/scripts/summary/summary.mjs lint plan
   ```

   Findings left after the second rewrite stay; the page lists them under
   Readability notes for the reviewer.
7. **Stamp.** `node hsdd/scripts/summary/summary.mjs stamp plan` restamps
   only the entries you rewrote.
8. **Render.** `node hsdd/scripts/summary/summary.mjs render plan` writes
   `hsdd/summary/summary.html`. It refuses while the model does not validate
   or a required slot is empty.
9. **Check.** `node hsdd/scripts/summary/summary.mjs check` must report the
   page `fresh`.
10. **Report:** the page's path, the unparsed items you filled and from
    where, the slots you wrote, and any readability notes left.

## Process (checkpoint page)

Run it after `hsdd-checkpoint` has written the dated progress report and
execution plan (its gated step invokes this). The steps are the plan page's,
with `checkpoint` in place of `plan`:

1. `node hsdd/scripts/summary/summary.mjs extract checkpoint`. The usual
   unparsed item is a step whose owner names no lane ("both"): set its
   `lanes` from the plan's Operating model or Ownership split.
2. `validate checkpoint` must exit 0. Integrity findings (an orphan finding,
   a step with no detail block, a Depends entry that resolves to nothing)
   are not errors: they are `hsdd-checkpoint`'s own quality gates, and the
   checkpoint run fixes its plan before landing.
3. `slots checkpoint`, then write the stakeholder prose in
   `hsdd/summary/checkpoint-prose.json`: `cp:verdict`, one
   `cp:milestone:{id}` per milestone, one `cp:blocker:{rank}` per blocker.
4. `lint checkpoint`, at most two rewrites; `stamp checkpoint`;
   `render checkpoint` writes `hsdd/summary/checkpoint.html`; `check` must
   report it fresh.

Commit `hsdd/summary/` (pages, prose stores, glossary) with the change it
summarizes. Never commit the scratch model. Under the standalone-spec-repo
profile `hsdd/summary/` lives in the spec repo, so it lands the way every
governance edit does: committed and pushed inside the submodule, then each
implementation repo's pointer bumped.

## Writing the Prose

| Slot | Words | Rule |
|------|-------|------|
| `explain:{node}` (required) | 25 | what the part is for, in words anyone reads; no ids |
| `note:{node}:{audience}` | 40 | what that audience should look at here; the stakeholder note has no ids |
| `delivers:{phase}` | 25 | what is true when the phase is done |
| `promise:{contract}` | 40 | what a consumer can rely on, in plain words; no ids |
| glossary `{contract-id}` (required) | 8 | a plain noun phrase the stakeholder reads instead of the id |
| `cp:verdict` (required) | 60 | the checkpoint's verdict for someone outside the team; no ids |
| `cp:milestone:{id}` (required) | 25 | what reaching this milestone means for the people it serves; no ids |
| `cp:blocker:{rank}` (required) | 25 | what could slip because of this blocker, and why; no ids |

The lint checks the word limit, ids in id-free slots, and markdown. Write
plain sentences, not fragments; say what a thing does, not what it is called.

**Examples.**

- `explain:acme.api`: "Hands out the sign-in passes the web console checks,
  and keeps each merchant's session alive between visits."
- `note:acme.api:reviewer`: "Check that api.3's region choice still waits on
  OQ1; the session contract is provisional until reconcile runs."
- `delivers:acme.api.2`: "A known user gets a signed pass that expires exactly
  one day after it is issued."
- `promise:auth-token@v1`: "A pass always names exactly one user and stops
  working one day after it was issued, with no grace period."
- glossary `auth-token`: "the sign-in pass".
- `cp:verdict`: "The first milestone landed on its date. The second waits on
  one open question about where sessions are stored, which the team settles
  on Monday."
- `cp:milestone:M2`: "Merchants can open the console and see every outlet
  they run, with its current status."
- `cp:blocker:1`: "Building session storage cannot start until the team
  picks where sessions live; every day of delay moves the outlet screens."

## What the Plan Page Shows

- **From the top down.** The root's parts as boxes, each with its
  explanation; a click (or Enter on a focused box) opens a part, down to a
  leaf-parent's phase graph and each phase's card. Breadcrumbs and `u` go
  back up.
- **Edges come from contracts.** An edge means something in one part consumes
  a contract something in the other produces; contracts produced outside the
  tree arrive from one "Outside the tree" box, and on a part's own page,
  contracts produced elsewhere in the tree arrive from one "Elsewhere in the
  tree" box.
- **A leaf-parent's phases** are colored by review tier, joined by their
  dependencies; collisions nothing orders are dashed, and collisions a
  dependency already orders are counted, not drawn. More than 12 phases
  collapse into steps (phases with no dependency between them); more than six
  steps become an ordered list.
- **What to check, at every level,** for the part and everything under it:
  full-review phases, contingent phases, contracts named but not written,
  provisional contracts, version drift, missing or proposed ADRs, undrained
  governance updates, phases missing from their summary table, collisions.
- **Contracts and decisions,** each a click away.

## What the Checkpoint Page Shows

Every fact comes from the documents by script; every card links to its
source file and line, and the markdown stays the record.

- **The lead's top view:** the one-sentence read; the bottom-line rows as
  tiles; each milestone gate as a bar with its movement since the previous
  report; the syncs; the plan graph (syncs as junctions, steps joined by
  their Depends cells, their syncs' Entry and Unblocks lines; above 20
  boxes, steps batch by lane and depth; above 20 batches, an ordered list);
  the blockers; the findings by severity, each with the number of
  consecutive registers it has appeared in; and what changed since the
  previous plan.
- **A sync:** Entry, each decision with its options and where its answer
  lands, Exit, Unblocks, and the steps waiting on it.
- **A lane:** its steps in the order they can run; for the executor, every
  prompt with a copy button and every briefing's Why, Do and Done when.
- **A finding:** its text, how many consecutive registers it has been in,
  and the steps that land it or the waiver that closes it. A finding with
  neither says so.
- **Build progress:** the atlas's per-node counts on the node tree.
- **Plan integrity:** the cross-checks `hsdd-checkpoint`'s quality gates
  name, as the scripts read the documents.

## Quality Gates

- [ ] `validate` exited 0, and every unparsed item was filled from the line
      it named.
- [ ] Every required slot and glossary entry has text; no existing glossary
      entry changed.
- [ ] Lint is clean, or its findings stand after at most two rewrites.
- [ ] Prose stamped; page rendered; `check` reports it fresh.
- [ ] No file outside `hsdd/summary/` changed, and the scratch model is not
      committed.
- [ ] Checkpoint page: every step has its lanes, and the page shows no Plan
      integrity finding that the checkpoint run should have fixed first.
- [ ] The scripts under `hsdd/scripts/summary/` are byte-identical to this
      skill's `scripts/`.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I can see the graph; I'll draw the diagram myself" | The script derives edges from the contracts and reduces the layout. A hand-drawn diagram looks right the day it is drawn and drifts the day after. |
| "The parser missed this field; I'll fix the spec so it parses" | The spec belongs to its skill and its owner. Fill the model from the source; if the source is wrong, that is a finding for hsdd-spec or hsdd-phase-plan. |
| "This unparsed tier is obviously full-review" | Only if the source says so. Read the line it names; if it states no tier, report it rather than invent one. |
| "The explanation needs 40 words to be accurate" | The limit is the point. If it does not fit, you are restating what the page already shows; say what it means. |
| "The stakeholder will understand the ids" | They will not, and the lint fails it. Use the glossary's words. |
| "Lint still complains after two rewrites; one more round" | Two rounds, then the Readability notes. They tell the reviewer where the text is weak, which is worth more than a third rewrite. |
| "The glossary entry is clumsy; I'll improve it" | People own existing entries. Fill empty ones only. |
| "I'll retype the script from memory, it's quicker than copying" | A retyped script is not the one the tests cover: escaping, the offline rule and the id scan are pinned only for the bundled code. Copy the directory verbatim. |
| "The page is stale but close enough" | A stale page shows a plan that no longer exists. Regenerate it, or say in your report that it is stale. |
| "The report says 'third consecutive pass'; the page says two" | The page counts register rows by script. The report's prose may count days or the underlying problem. Both can be true; neither is edited to match the other. |
| "This owner says 'both'; I'll leave the lanes empty" | Then the step appears in no lane and its executor never sees it. Read the plan's Operating model and fill the lanes. |
