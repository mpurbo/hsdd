# v0.9 Plan C: The Checkpoint Page and the Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hsdd-summary` renders a second page, `hsdd/summary/checkpoint.html`, over the newest progress report and execution plan for the lead running the sync, each lane's executor and stakeholders; `hsdd-checkpoint` renders it in one gated step; the specification, README, users guide and CHANGELOG describe v0.9; the acceptance run is recorded.

**Architecture:** The engine Plan B built gains a second page kind. A new extractor reads the management chain (heads, history, atlas) and lists what it could not parse; new cross-checks compute what no single document states (the findings-to-plan loop, carried ages, the delta against the previous plan, gate movement, plan integrity); new pure views render lead, executor and stakeholder views; the plan graph is recomputed from the plan's tables and collapsed by lane and depth. `hsdd-checkpoint` reaches any of it only when `hsdd/summary/` exists.

**Tech Stack:** As Plan B: Node.js 20 or later, built-ins only; markdown skill and spec files.

**Spec:** `docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md` (sections 3.1, 3.3, 7, 8, 9, 11 C1 to C3). Read it before starting.

## Global Constraints

- Work on branch `feat/v0.9.0`. Commit as `Purbo Mamad <m.purbo@gmail.com>`; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git push` after every task.
- Plan B is complete before this plan starts (its 78 tests pass). Tasks 9 to 11 also need Plan A's spec and acceptance files.
- Zero dependencies: Node built-ins only. Run tests with `node --test test/*.test.mjs`.
- Source files contain no literal em-dash, en-dash, line-separator or paragraph-separator character; write them as `\u2014`, `\u2013`, `\u2028`, `\u2029` escapes in code. New prose contains no em-dash and none of the phrases the house style bans (the dispatch prompt names them).
- The page rules of Plan B hold for the new page: one offline file, hash-based CSP, every value escaped, no `style=` attributes, no inline handlers, the stakeholder never sees an id.
- `hsdd-checkpoint` behaves exactly as before in a project without `hsdd/summary/`: no `hsdd-summary` script runs and its documents do not change shape. The management document shapes themselves do not change apart from the optional `**Stale summaries:**` header line.
- Each page keeps its own prose store: `hsdd/summary/prose.json` (plan page) and `hsdd/summary/checkpoint-prose.json` (checkpoint page).

**Deviations from the design, recorded:** design §7.2 reads the milestone document; the progress report's Milestone gate status section already carries every milestone's name, date, items and count, so the milestone document is not read. Design §11 C1 pinned "F-195 at three passes"; the script counts consecutive register rows and finds two, because the report's prose counts recurrences of the underlying problem. Task 11 pins the computed values.

## Review Focus

1. **Management documents in older shapes:** numbered sections (`## 6. Findings register`), sync parts marked by bold labels instead of `###`, an agenda written as a table, decision titles whose bold wraps a line, step headings separated by an em dash, lanes named with a parenthetical (`FE lane (Aulia)`), and an Ownership split that only refers back to an earlier plan. Pinned by Task 2's tests.
2. **A plan never ticked after publication:** the delta must not claim nothing landed; it reports steps carried and steps no longer present. Pinned in Task 3.
3. **A step owned by "both":** it must not silently vanish from every lane. It is an unparsed item until filled. Pinned in Tasks 2 and 3.
4. **Writing one page's prose:** it must never make the other page stale. Pinned in Task 5.
5. **A newer progress report landing after the page was rendered:** `check` reports the checkpoint page stale and the plan page fresh. Pinned in Task 5.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `test/fixtures/tree/hsdd/management/` | Create | Synthetic chain: three reports, three plans, an atlas |
| `skills/hsdd-summary/scripts/extract-checkpoint.mjs` | Create | Chain to checkpoint model, plus `unparsed[]` |
| `skills/hsdd-summary/scripts/checks-checkpoint.mjs` | Create | Errors, integrity findings, computed values |
| `skills/hsdd-summary/scripts/checkpoint-model.schema.json` | Create | The checkpoint model's schema |
| `skills/hsdd-summary/scripts/views-checkpoint.mjs` | Create | Lead, executor and stakeholder views |
| `skills/hsdd-summary/scripts/graph.mjs` | Replace | Adds `stepRefsIn`, `dependsRefs`, `planGraph`, `collapsePlanGraph` |
| `skills/hsdd-summary/scripts/prose.mjs` | Replace | Adds `checkpointSlots` |
| `skills/hsdd-summary/scripts/stamp.mjs` | Replace | Adds `checkpointInputs` |
| `skills/hsdd-summary/scripts/html.mjs` | Replace | Adds the `checkpoint` page kind |
| `skills/hsdd-summary/scripts/summary.mjs` | Replace | Adds the `checkpoint` kind to the CLI |
| `skills/hsdd-summary/SKILL.md` | Replace | The checkpoint page's process, audiences, prose |
| `skills/hsdd-checkpoint/SKILL.md` | Modify | The gated step |
| `spec/hsdd-spec-v0_9.md` | Modify | §1.5, §12.3, §12.7, §13.4, §14.1, §18.1, §19 |
| `README.md`, `docs/users-guide.md`, `CHANGELOG.md` | Modify | v0.9 for readers |
| `review/hsdd-v0_9-acceptance.md` | Modify | C1 to C3, then the recorded results |

---

### Task 1: The synthetic management chain

**Files:**
- Create: `test/fixtures/tree/hsdd/management/` (7 files)

**Interfaces:**
- Produces: a chain for the fixture project "acme": progress reports 2026-09-18, 2026-09-25 (numbered sections) and 2026-10-02 (the head, in the current shape); execution plans of the same dates (09-25 in an older shape: bold-label sync parts, a table agenda, no ownership table; 09-18 a bare step table); an atlas with a flagged count and a Total row. The head plan holds one "both" owner (C-6), one finding with no step and no waiver (F-6), one waived finding (F-5), and a decision title whose bold wraps a line (D-2). F-3 appears in all three registers; C-5 stays open in all three plans.

- [ ] **Step 1: Create the chain**

Run from the repo root:

````bash
mkdir -p test/fixtures/tree/hsdd/management
cat > test/fixtures/tree/hsdd/management/2026-09-18-execution-plan.md <<'MD'
# acme · Execution Plan (2026-09-18)

## Step tables

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| C-3 | API | Add the conventions file. | none | F-1 | ☑ |
| C-5 | API | Run reconcile. | none | none | ☐ |
MD
cat > test/fixtures/tree/hsdd/management/2026-09-18-progress.md <<'MD'
# acme · Progress Report (2026-09-18)

**Date:** 2026-09-18

## Bottom line

| | |
|---|---:|
| **Verified done** | **0** |

## Findings register

| ID | Sev | Area | Finding |
|---|---|---|---|
| **F-1** | Low | layout | **The conventions file is missing.** |
| **F-2** | Medium | tests | **The expiry test is flaky.** |
| **F-3** | High | open questions | **OQ1 has no owner.** |

## Verdict

First checkpoint.
MD
cat > test/fixtures/tree/hsdd/management/2026-09-25-execution-plan.md <<'MD'
# acme · Execution Plan (2026-09-25)

**Created:** 2026-09-25

## Ownership split

Unchanged from the first plan.

## Sync points

| Sync | When | Who | Agenda in one line |
|---|---|---|---|
| **Sync Z** | Mon Sep 28 | everyone | Agree the token expiry |

## Sync Z - Mon Sep 28 (gating)

**Entry**

- [ ] C-4 done.

**Agenda**

| ID | Decision | Live options | Lands in |
|---|---|---|---|
| **D-0** | **How long does a token live?** | 12h or 24h | ADR-001 |

**Exit.** The sync is discharged when D-0 is answered.

**Unblocks:** API starts C-5.

## Step tables

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| C-4 | API | Fix the token expiry test. | none | F-2 | ☐ |
| C-5 | API | Run reconcile. | Sync Z | F-4 | ☐ |

## Step details

### C-4 - fix the expiry test (API)

*Validate:* the test passes.

### C-5 - drain the provisional flag (API)

*Validate:* `phase_ids: final`.
MD
cat > test/fixtures/tree/hsdd/management/2026-09-25-progress.md <<'MD'
# acme · Progress Report (2026-09-25)

**Date:** 2026-09-25 · **Supersedes:** [2026-09-18-progress.md](2026-09-18-progress.md)

## 1. Bottom line

| | |
|---|---:|
| **Verified done** | **1** |

## 2. Milestone gate status

| Milestone | Gate | Unmet items |
|---|---|---|
| **M1** · sign-in works on staging (Fri Oct 2) | **2 / 3** | ☑ token issuance · ☑ sign-in form · ☐ staging deploy |
| **M2** · merchants see their outlets (Fri Oct 16) | **1 / 4** | ☑ outlet list design · ☐ session store · ☐ outlet list · ☐ OQ1 answered |

## 3. Blockers

1. **OQ1 is open (F-3).**

## 4. Findings register

| ID | Sev | Area | Finding |
|---|---|---|---|
| **F-3** | High | open questions | **OQ1 has no owner.** |
| **F-4** | Medium | contracts | **`session@v2` is provisional.** |

## 5. Verdict

On track.
MD
cat > test/fixtures/tree/hsdd/management/2026-10-02-execution-plan.md <<'MD'
# acme · Execution Plan (2026-10-02)

**Created:** 2026-10-02 · **Supersedes:** [2026-09-25-execution-plan.md](2026-09-25-execution-plan.md)
**Repo baselines:** hsdd `abc1234`
**Companion docs:** [2026-10-02-progress.md](2026-10-02-progress.md) · [atlas.md](atlas.md)

## Operating model

Two build lanes and an operator.

## Current state (delta since 09-25, in plan terms)

- **Two phases closed.** `api.1` and `api.2` are done.
- **M1 reached.** The first milestone is met on its date.

## Ownership split

| | API lane | Web lane | Operator |
|---|---|---|---|
| **Nodes** | `acme.api` | `acme.web.console` | none |
| **Contracts (single-writer)** | `auth-token`, `session` | none | ADRs |

## Sync points

| Sync | When | Who | Agenda in one line |
|---|---|---|---|
| **Sync A** (gating) | Mon Oct 5, 30 min | operator + both lanes | Choose the session region |
| **Weekly** | Fri Oct 9 | everyone | Standing weekly |

## Sync A · Mon Oct 5, 30 min (gating)

**Why it gates:** `api.3` and the outlet list wait on it.

### Entry

- [ ] C-5 drafted, so the session contract can be read as it will ship.
- [x] Operator brings the infra team's two region options.

### Agenda

**D-1 · Which region hosts the sessions?** Live options: **(a)** eu-west,
**(b)** ap-southeast. **Lands in:** OQ1's row in `spec/acme.md`, and ADR-002.

**D-2 · Does api.3 split
into two phases?** Live options: **(a)** keep it whole, **(b)** split it.
**Lands in:** the phase plan in `spec/acme.api.md`.

### Exit

- [ ] D-1 answered and recorded in `spec/acme.md`.
- [ ] D-2 answered.

### Unblocks

- **API lane:** B-1 starts.
- **Web lane:** F-1 starts once B-1 lands.
- **Operator:** G-2 records the answer.

## Step tables

### C · repairs

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| C-5 | API 🤖 | Run reconcile so `session@v2` loses its provisional flag. | none | F-4 | ☐ |
| C-6 | both 👤 | Collect the missing reviewer sign-off. | none | F-5 | ☑ |

### G · governance

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| G-2 | operator 🤝 | Record D-1's answer in OQ1 and ADR-002. | Sync A (D-1) | F-3 | ☐ |

### B / F · build lanes

| ID | Owner | Action | Depends | ☐ |
|---|---|---|---|---|
| B-1 | API | Build `api.3`. | Sync A, C-5 | ☐ |
| F-1 | Web | Build `console.2` and `console.3`. | B-1 | ☐ |

### Waived or closed without a step

| Finding | Disposition |
|---|---|
| **F-5** | **Closed:** C-6 collected the sign-off the same day. |

## Step details

### C-5 · drain the provisional flag 🤖 (API)

**Prompt:**

```
In the acme repo, run hsdd-reconcile for session@v2 and report the phase ids it finalizes.
```

*Validate:* `contract/session.md` reads `phase_ids: final`.

### C-6 · collect the reviewer sign-off 👤 (both)

**Why:** a verification doc with no reviewer is a claim, not evidence (F-5).

**Do:**

- [x] Ask the reviewer to sign `verify/acme.api.1.verification.md`.

**Done when:** the Reviewer line is filled.

### G-2 · record the region decision 🤝 (operator)

**Prompt:**

```
Record D-1's answer from Sync A in the OQ1 row of spec/acme.md and in ADR-002.
```

*Validate:* OQ1 reads RESOLVED with today's date.

### B-1 · build api.3 (API)

**Prompt:**

```
/hsdd-phase acme.api.3 --method superpowers
```

*Validate:* the verification doc for `acme.api.3` is on main.

### F-1 · build the outlet screens (Web)

**Prompt:**

```
/hsdd-phase acme.web.console.2
```

*Validate:* both verification docs are on main.

## External tracks

| Track | Owner | Status | What happens on answer | Gates |
|---|---|---|---|---|
| E-1 · session region | operator | open | D-1 settles it | `api.3` (OQ1) |

## Timeline

| Week | API lane | Web lane | Operator |
|---|---|---|---|
| **Oct 5 to Oct 9** | C-5, then B-1 | waits on B-1 | Sync A, G-2 |

## Change log

- 2026-10-02, first publication.
MD
cat > test/fixtures/tree/hsdd/management/2026-10-02-progress.md <<'MD'
# acme · Progress Report (2026-10-02)

**Date:** 2026-10-02 · **Supersedes:** [2026-09-25-progress.md](2026-09-25-progress.md)
**Repo baselines:** hsdd `abc1234` · acme-web `main@def5678`
**Companion docs:** [2026-10-02-execution-plan.md](2026-10-02-execution-plan.md) · [atlas.md](atlas.md)
**Method:** full evidence pass across both repos.

## Bottom line

| | |
|---|---:|
| **Phases planned** | **6** |
| **Verified done** | **3** (50 %) |
| **Remaining** | **3** · `api.3`, `console.2`, `console.3` |
| **Calendar outlook** | M2 on Fri Oct 16 is **reachable** |

**The one-sentence read:** the token service is half done, and the console waits on one open question.

## Milestone gate status

| Milestone | Gate | Movement | Unmet items and what each waits on |
|---|---|---|---|
| **M1** · sign-in works on staging (Fri Oct 2) | **3 / 3 · REACHED** | up from 2/3 | ☑ token issuance · ☑ sign-in form · ☑ staging deploy |
| **M2** · merchants see their outlets (Fri Oct 16) | **1 / 4** | same | ☑ outlet list design · ☐ session store (`api.3`) · ☐ outlet list (`console.2`) · ☐ OQ1 answered |

- **Gate arm: DID NOT FIRE.** M2 has one reading.
- **Disposition: none.** No trigger fired.

## What is done

| Phase | Tier | Sign-off | Note |
|---|---|---|---|
| `acme.api.1` · types | gate-only | Dana, 09-24 | |
| `acme.api.2` · token issuance | full-review | Dana, 09-30 | ADR-001 |

## Velocity

**Observed:** 2 phases in 5 working days.

## Blockers

1. **OQ1 is still open (F-3).** `api.3` cannot start until the region is chosen. **Repair:** step **G-2**.
2. **The session contract is provisional (F-4).** Reconcile has not run. **Repair:** step **C-5**.

## Findings register

| ID | Sev | Area | Finding |
|---|---|---|---|
| **F-3** | **High** | open questions | **OQ1 has no owner.** Carried from the first checkpoint. |
| **F-4** | Medium | contracts | **`session@v2` is still provisional.** Reconcile has not run. |
| **F-5** | Low | sign-off | **One verification doc has no reviewer.** |
| **F-6** | Low | branches | **A stale branch remains.** Nothing in the plan lands it. |

## Verdict

The method is working; the risk is the open question.

## Change log

- 2026-10-02, first publication.
MD
cat > test/fixtures/tree/hsdd/management/atlas.md <<'MD'
# acme · Atlas

**Generated:** 2026-10-02 by `hsdd-checkpoint`.

## 1 · The tree

### Phase status per node

| Node | Live | Done | Retired | Planned (remaining) |
|---|---:|---:|---:|---|
| `api` | 3 | **2** | 0 | `api.3` |
| `web.console` | 3 | 1 ⚠ | 0 | `console.2` `console.3` |
| `ops` | 0 | 0 | 0 | none |
| **Total** | **6** | **3** | **0** | **3** |
MD
ls test/fixtures/tree/hsdd/management | wc -l   # 7
````

- [ ] **Step 2: Verify the plan page is unaffected**

Run: `node --test test/*.test.mjs`
Expected: PASS, 78 tests. (The plan extractor and its stamps never read `hsdd/management/`.)

- [ ] **Step 3: Commit**

```bash
git add test/fixtures/tree/hsdd/management
git commit -m "test(hsdd-summary): a synthetic management chain with the drift seen in the field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: The checkpoint extractor

**Files:**
- Create: `skills/hsdd-summary/scripts/extract-checkpoint.mjs`
- Test: `test/extract-checkpoint.test.mjs`

**Interfaces:**
- Consumes: `md.mjs` (including `blocks` and `sectionName`), `extractPlan`, `sha`.
- Produces: `extractCheckpoint(root, { specSha }) -> model` (shape in Task 3's schema); `chainFiles(root) -> { progress: [newest first], plans: [newest first], atlas }`; `dated(dir, suffix)`; `headerFields(lines)`; `parseProgress(lines)`; `parsePlan(lines)`; `parseAtlas(lines)`; `modeOf(text) -> "delegate"|"interactive"|"human"|null`; `lanesFor(owner, lanes) -> keys`; `HISTORY` (8); `STEP_ID`. A step whose owner names no lane becomes `unparsed` at `/plan/steps/{i}/lanes`; an atlas row naming no node at `/atlas/{i}/node`; a gate with no count and not reached at `/progress/milestones/{i}/fraction`. Facts: `cp:verdict`, `cp:milestone:{id}`, `cp:blocker:{rank}`.

- [ ] **Step 1: Write the failing test**

Create `test/extract-checkpoint.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TREE } from "./helpers/plan-fixture.mjs";
import { toLines } from "../skills/hsdd-summary/scripts/md.mjs";
import { extractCheckpoint, chainFiles, headerFields, parsePlan, modeOf, lanesFor } from "../skills/hsdd-summary/scripts/extract-checkpoint.mjs";

const m = extractCheckpoint(TREE, { specSha: "abc1234" });

test("chain: newest first, both naming schemes, the atlas", () => {
  const c = chainFiles(TREE);
  assert.deepEqual(c.progress.map((f) => f.slice(16)), ["2026-10-02-progress.md", "2026-09-25-progress.md", "2026-09-18-progress.md"]);
  assert.equal(c.plans[0], "hsdd/management/2026-10-02-execution-plan.md");
  assert.equal(c.atlas, "hsdd/management/atlas.md");
  assert.equal(m.project.date, "2026-10-02");
});

test("header lines with several fields separated by middots", () => {
  const h = headerFields(toLines("# T\n\n**Date:** 2026-10-02 · **Supersedes:** [a](a.md)\n**Method:** full pass\n\n## Bottom line"));
  assert.deepEqual(h, { Date: "2026-10-02", Supersedes: "[a](a.md)", Method: "full pass" });
});

test("progress: bottom line, the read, gates with items, trigger arms", () => {
  const p = m.progress;
  assert.equal(p.bottomLine.length, 4);
  assert.equal(p.bottomLine[3].label, "Calendar outlook");
  assert.match(p.read, /^the token service is half done/);
  assert.deepEqual(p.milestones.map((x) => [x.id, x.name, x.date, x.fraction, x.reached, x.items.length]), [
    ["M1", "sign-in works on staging", "Fri Oct 2", [3, 3], true, 3],
    ["M2", "merchants see their outlets", "Fri Oct 16", [1, 4], false, 4],
  ]);
  assert.deepEqual(p.milestones[1].items[1], { met: false, text: "session store (`api.3`)" });
  assert.deepEqual(p.trigger.map((t) => t.lead), ["Gate arm: DID NOT FIRE", "Disposition: none"]);
});

test("progress: blockers link findings and steps; findings carry severity and lead", () => {
  assert.deepEqual(m.progress.blockers.map((b) => [b.rank, b.findings, b.steps]), [[1, ["F-3"], ["G-2"]], [2, ["F-4"], ["C-5"]]]);
  assert.deepEqual(m.progress.findings.map((f) => [f.id, f.severity, f.lead]), [
    ["F-3", "High", "OQ1 has no owner"], ["F-4", "Medium", "session@v2 is still provisional"],
    ["F-5", "Low", "One verification doc has no reviewer"], ["F-6", "Low", "A stale branch remains"],
  ]);
});

test("plan: lanes, ownership, sync with entry, decisions (wrapped bold), exit, unblocks", () => {
  const p = m.plan;
  assert.deepEqual(p.lanes.map((l) => l.key), ["API", "Web", "Operator"]);
  const a = p.syncs[0];
  assert.equal(a.id, "A");
  assert.equal(a.gating, true);
  assert.deepEqual(a.entry.map((e) => e.checked), [false, true]);
  assert.deepEqual(a.decisions.map((d) => [d.id, d.question]), [["D-1", "Which region hosts the sessions?"], ["D-2", "Does api.3 split into two phases?"]]);
  assert.match(a.decisions[0].landsIn, /^OQ1's row/);
  assert.deepEqual(a.unblocks.map((u) => u.lane), ["API lane", "Web lane", "Operator"]);
  assert.deepEqual(p.syncPoints.map((x) => x.id), ["A", "Weekly"]);
});

test("plan: steps from every step table, modes, lanes, ticks, waivers", () => {
  assert.deepEqual(m.plan.steps.map((s) => [s.id, s.mode, s.lanes.join("+"), s.done]), [
    ["C-5", "delegate", "API", false], ["C-6", "human", "", true], ["G-2", "interactive", "Operator", false],
    ["B-1", null, "API", false], ["F-1", null, "Web", false],
  ]);
  assert.deepEqual(m.plan.waivers.map((w) => w.finding), ["F-5"]);
});

test("plan: step details, prompt or briefing", () => {
  const d = new Map(m.plan.details.map((x) => [x.id, x]));
  assert.match(d.get("C-5").prompt, /^In the acme repo, run hsdd-reconcile/);
  assert.match(d.get("C-5").validate, /phase_ids: final/);
  assert.match(d.get("C-6").why, /^a verification doc with no reviewer/);
  assert.deepEqual(d.get("C-6").do.map((x) => x.checked), [true]);
  assert.match(d.get("C-6").doneWhen, /Reviewer line is filled/);
  assert.equal(d.get("C-6").mode, "human");
  assert.equal(d.get("C-6").owner, "both");
});

test("an older plan: bold-label parts, a table agenda, lanes from owners", () => {
  const p = parsePlan(toLines([
    "## Ownership split", "", "Unchanged.", "", "## Sync Z - Mon (gating)", "", "**Entry**", "", "- [ ] C-4 done.", "",
    "**Agenda**", "", "| ID | Decision | Live options | Lands in |", "|---|---|---|---|", "| **D-0** | **Expiry?** | 12h or 24h | ADR-001 |", "",
    "**Exit.** Discharged when D-0 is answered.", "", "**Unblocks:** API starts C-5.", "",
    "## Step tables", "", "| ID | Owner | Action | Depends | ☐ |", "|---|---|---|---|---|", "| C-4 | API | Fix. | none | ☐ |", "| C-5 | both | Run. | Sync Z | ☐ |",
    "", "## Step details", "", "### C-4 \u2014 fix the test (API)", "", "*Validate:* passes.",
  ].join("\n")));
  assert.deepEqual(p.syncs[0].decisions.map((d) => [d.id, d.question, d.landsIn]), [["D-0", "Expiry?", "ADR-001"]]);
  assert.deepEqual(p.syncs[0].unblocks, [{ lane: null, text: "API starts C-5." }]);
  assert.deepEqual(p.lanes.map((l) => l.key), ["API"]);
  assert.deepEqual(p.steps.map((s) => s.lanes), [["API"], []]);
  assert.equal(p.details[0].id, "C-4");
  assert.equal(p.details[0].title, "fix the test");
});

test("atlas rows resolve short node names; the total row is skipped", () => {
  assert.deepEqual(m.atlas.map((a) => [a.node, a.done, a.live, a.warn]), [["acme.api", 2, 3, false], ["acme.web.console", 1, 3, true], ["acme.ops", 0, 0, false]]);
});

test("history: findings and gates per report, open and done per plan", () => {
  assert.deepEqual(m.history.progress.map((h) => h.findings), [["F-3", "F-4", "F-5", "F-6"], ["F-3", "F-4"], ["F-1", "F-2", "F-3"]]);
  assert.deepEqual(m.history.progress[1].gates, { M1: [2, 3], M2: [1, 4] });
  assert.deepEqual(m.history.plans.map((h) => h.open), [["C-5", "G-2", "B-1", "F-1"], ["C-4", "C-5"], ["C-5"]]);
});

test("unparsed: only the step whose owner names no lane", () => {
  assert.deepEqual(m.unparsed.map((u) => u.path), ["/plan/steps/1/lanes"]);
  assert.match(m.unparsed[0].reason, /owner "both" names no lane/);
});

test("ids cover steps, findings, decisions, tracks, phases and short node names", () => {
  for (const id of ["C-5", "F-3", "D-1", "E-1", "api.3", "acme.api.3", "web.console"]) assert.ok(m.ids.includes(id), id);
});

test("modeOf and lanesFor", () => {
  assert.equal(modeOf("BE \u{1F916}"), "delegate");
  assert.equal(modeOf("BE"), null);
  const lanes = [{ key: "FE" }, { key: "BE" }, { key: "Operator" }];
  assert.deepEqual(lanesFor("BE+FE", lanes), ["FE", "BE"]);
  assert.deepEqual(lanesFor("operator \u{1F91D}", lanes), ["Operator"]);
  assert.deepEqual(lanesFor("both", lanes), []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/extract-checkpoint.test.mjs`
Expected: FAIL with `Cannot find module` for `extract-checkpoint.mjs`.

- [ ] **Step 3: Implement**

Create `skills/hsdd-summary/scripts/extract-checkpoint.mjs`:

```js
// Extract the checkpoint model from hsdd/management/: the newest progress
// report and execution plan, the atlas, and the chain behind them.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { toLines, headings, sections, tables, column, plain, blocks, sectionName } from "./md.mjs";
import { extractPlan, sha, codingMethod } from "./extract-plan.mjs";

export const HISTORY = 8;
export const STEP_ID = /^([A-Z]{1,2}-(?:\d+|[a-z]))([′″']*)/;
const STEP_IDS = /\b[A-Z]{1,2}-(?:\d+|[a-z])[′″']*(?![\w-])/g;
const MODES = [["\u{1F916}", "delegate"], ["\u{1F91D}", "interactive"], ["\u{1F464}", "human"]];

export function dated(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-/.test(f) && f.endsWith(suffix))
    .sort()
    .reverse();
}

// Newest first. Progress reports end "-progress.md"; plans end
// "execution-plan.md" (older chains used "-hsdd-execution-plan.md").
export function chainFiles(root) {
  const dir = join(root, "hsdd/management");
  return {
    progress: dated(dir, "-progress.md").map((f) => `hsdd/management/${f}`),
    plans: dated(dir, "execution-plan.md").map((f) => `hsdd/management/${f}`),
    atlas: existsSync(join(dir, "atlas.md")) ? "hsdd/management/atlas.md" : null,
  };
}

function read(root, rel) {
  return toLines(readFileSync(join(root, rel), "utf8"));
}

function section(ls, re) {
  return sections(ls, 2).find((s) => re.test(sectionName(s.title))) ?? null;
}

function sub(ls, sec, re) {
  if (!sec) return null;
  return sections(ls, 3, sec.start, sec.end).find((s) => re.test(sectionName(s.title))) ?? null;
}

function boldLead(text) {
  const m = /\*\*(.+?)\*\*/.exec(text);
  return m ? plain(m[1]).replace(/[.:]\s*$/, "") : null;
}

export function modeOf(text) {
  return MODES.find(([e]) => String(text).includes(e))?.[1] ?? null;
}

function stripModes(text) {
  return MODES.reduce((t, [e]) => t.split(e).join(""), String(text)).trim();
}

// "**Date:** x · **Supersedes:** [y](y)" lines before the first "##".
export function headerFields(ls) {
  const first = headings(ls).find((h) => h.level === 2);
  const out = {};
  for (const l of ls.slice(0, first ? first.line : ls.length)) {
    for (const part of l.split(/\s·\s(?=\*\*)/)) {
      const m = /^\s*\*\*([^*]+?):\*\*\s*(.*)$/.exec(part);
      if (m) out[m[1].trim()] = m[2].trim();
    }
  }
  return out;
}

function blocksOf(ls, sec) {
  return sec ? blocks(ls, sec.start, sec.end) : [];
}

function tableIn(ls, sec, ...cols) {
  if (!sec) return null;
  return tables(ls, sec.start, sec.end).find((t) => cols.every((c) => column(t, c) >= 0)) ?? null;
}

function fraction(text) {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(plain(text));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function gateItems(cell) {
  return String(cell)
    .split(/(?=[☑☐])/)
    .filter((p) => /^[☑☐]/.test(p))
    .map((p) => ({ met: p.startsWith("☑"), text: p.slice(1).replace(/^\s*·\s*/, "").replace(/\s*·\s*$/, "").trim() }));
}

export function parseProgress(ls) {
  const header = headerFields(ls);
  const bl = section(ls, /^bottom line/i);
  const blTable = bl ? tables(ls, bl.start, bl.end)[0] ?? null : null;
  const blBlocks = blocksOf(ls, bl).filter((b) => b.type === "p");
  const readBlock = blBlocks.find((b) => /^\*\*the one-sentence read/i.test(b.text)) ?? blBlocks[0] ?? null;

  const ms = section(ls, /^milestone gate status/i);
  const mt = tableIn(ls, ms, "milestone", "gate");
  const milestones = [];
  if (mt) {
    const [cm, cg, cv] = ["milestone", "gate", "movement"].map((n) => column(mt, n));
    const ci = mt.header.length - 1;
    for (const r of mt.rows) {
      const cell = plain(r.cells[cm] ?? "");
      const m = /^(M[\w.\u2013-]*?)(?:\s*·\s*|\s+|$)(.*)$/.exec(cell);
      const rest = m ? m[2] : cell;
      const date = /\(([^)]*)\)\s*$/.exec(rest);
      milestones.push({
        id: m ? m[1] : cell,
        name: rest.replace(/\s*\([^)]*\)\s*$/, "").trim(),
        date: date ? date[1] : null,
        gate: plain(r.cells[cg] ?? ""),
        fraction: fraction(r.cells[cg] ?? ""),
        reached: /reached/i.test(r.cells[cg] ?? ""),
        movement: cv >= 0 ? plain(r.cells[cv] ?? "") : null,
        items: ci !== cg ? gateItems(r.cells[ci] ?? "") : [],
        raw: r.cells.join(" | "),
        line: r.line + 1,
      });
    }
  }
  const trigger = blocksOf(ls, ms).filter((b) => b.type === "ul").flatMap((b) => b.items).map((it) => ({ lead: boldLead(it.text), text: it.text }));

  const done = section(ls, /^what is done/i);
  const doneTable = tableIn(ls, done, "phase");

  const bk = section(ls, /^blockers/i);
  const bkList = blocksOf(ls, bk).find((b) => b.type === "ol");
  const blockers = (bkList?.items ?? []).map((it, i) => ({ rank: i + 1, lead: boldLead(it.text), text: it.text }));

  const fr = section(ls, /^findings register/i);
  const ft = tableIn(ls, fr, "id", "finding");
  const findings = [];
  if (ft) {
    const [ci, cs, ca, cf] = ["id", "sev", "area", "finding"].map((n) => column(ft, n));
    for (const r of ft.rows) findings.push({
      id: plain(r.cells[ci] ?? ""),
      severity: plain(r.cells[cs] ?? "") || null,
      area: ca >= 0 ? plain(r.cells[ca] ?? "") : "",
      lead: boldLead(r.cells[cf] ?? ""),
      text: r.cells[cf] ?? "",
      line: r.line + 1,
    });
  }

  return {
    header,
    bottomLine: blTable ? blTable.rows.map((r) => ({ label: plain(r.cells[0] ?? ""), value: r.cells[1] ?? "" })) : [],
    read: readBlock ? readBlock.text.replace(/^\*\*the one-sentence read:?\*\*:?\s*/i, "") : null,
    milestones,
    trigger,
    done: doneTable ? { header: doneTable.header, rows: doneTable.rows.map((r) => r.cells) } : null,
    doneNotes: blocksOf(ls, done).filter((b) => b.type !== "table"),
    velocity: blocksOf(ls, section(ls, /^velocity/i)),
    blockers,
    findings,
    verdict: blocksOf(ls, section(ls, /^verdict/i)),
    sections: sections(ls, 2).map((s) => sectionName(s.title)),
  };
}

function laneKey(name) {
  return plain(name).replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+lane$/i, "").trim();
}

// A sync section's parts (Entry, Agenda, Exit, Unblocks), marked either by
// "###" headings or by a bold-only line such as "**Agenda**".
function syncParts(ls, sec) {
  const marks = [];
  for (let i = sec.start; i < sec.end; i++) {
    const h = /^###\s+(.*)$/.exec(ls[i]);
    const b = /^\*\*(Entry|Agenda|Exit|Unblocks)\b[^*]*\*\*\s*(.*)$/i.exec(ls[i].trim());
    const name = h ? sectionName(h[1]) : b ? b[1] : null;
    if (name && /^(entry|agenda|exit|unblocks)/i.test(name)) marks.push({ name: name.toLowerCase().match(/^(entry|agenda|exit|unblocks)/)[1], line: i, inline: b ? b[2].trim() : "" });
    else if (h) marks.push({ name: null, line: i, inline: "" });
  }
  const out = {};
  marks.forEach((m, k) => {
    if (m.name && !out[m.name]) out[m.name] = { start: m.line + 1, end: k + 1 < marks.length ? marks[k + 1].line : sec.end, inline: m.inline };
  });
  return { parts: out, first: marks.length ? marks[0].line : sec.end };
}

export function lanesFor(owner, lanes) {
  const o = stripModes(plain(owner)).toLowerCase();
  return lanes.filter((l) => new RegExp(`(^|[^a-z])${l.key.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(o)).map((l) => l.key);
}

function syncId(text) {
  const m = /^sync\s+([^\s·\u2014,(]+)/i.exec(plain(text));
  return m ? m[1] : null;
}

// An Agenda's decisions, in either form: a paragraph led by
// "**D-49 · question?**" (the bold may wrap lines) followed by its options,
// or a table with ID and Decision columns.
function decisions(ls, from, to) {
  const t = tables(ls, from, to).find((x) => column(x, "id") >= 0 && column(x, "decision") >= 0);
  if (t) {
    const [ci, cd, co, cl] = ["id", "decision", "live", "lands"].map((n) => column(t, n));
    return t.rows.map((r) => ({ id: plain(r.cells[ci] ?? ""), question: plain(r.cells[cd] ?? ""), text: co >= 0 ? r.cells[co] ?? "" : "", landsIn: cl >= 0 ? plain(r.cells[cl] ?? "") : null, line: r.line + 1 }));
  }
  const out = [];
  let cur = null;
  for (const b of blocks(ls, from, to)) {
    const m = b.type === "p" ? /^\*\*(D-\d+[\u2032\u2033']*)\s*(?:\u00b7|\u2014|-|:)\s*(.*?)\*\*\s*(.*)$/.exec(b.text) : null;
    if (m) {
      cur = { id: m[1], question: plain(m[2]), parts: [m[3]] };
      out.push(cur);
    } else if (cur && b.type === "p") cur.parts.push(b.text);
    else if (cur && (b.type === "ul" || b.type === "ol")) cur.parts.push(b.items.map((it) => `- ${it.text}`).join("\n"));
  }
  return out.map((d) => {
    const text = d.parts.filter(Boolean).join("\n\n");
    const lands = /\*\*Lands in:\*\*\s*([\s\S]*)$/.exec(text);
    return { id: d.id, question: d.question, text: lands ? text.slice(0, lands.index).trim() : text, landsIn: lands ? lands[1].replace(/\s+/g, " ").trim() : null, line: null };
  });
}

export function parsePlan(ls) {
  const header = headerFields(ls);
  const own = section(ls, /^ownership split/i);
  const ownTable = own ? tables(ls, own.start, own.end)[0] ?? null : null;
  const lanes = ownTable ? ownTable.header.slice(1).map((h) => ({ name: plain(h), key: laneKey(h) })) : [];
  const ownership = ownTable ? ownTable.rows.map((r) => ({ label: plain(r.cells[0] ?? ""), cells: r.cells.slice(1) })) : [];

  const cs = section(ls, /^current state/i);
  const currentState = blocksOf(ls, cs).filter((b) => b.type === "ul").flatMap((b) => b.items.map((it) => it.text));

  const sp = section(ls, /^sync points/i);
  const spTable = tableIn(ls, sp, "sync");
  const points = spTable ? spTable.rows.map((r) => ({ id: syncId(r.cells[0]) ?? plain(r.cells[0]).replace(/\s*\(.*\)\s*$/, ""), name: plain(r.cells[0]), when: plain(r.cells[column(spTable, "when")] ?? ""), who: column(spTable, "who") >= 0 ? plain(r.cells[column(spTable, "who")] ?? "") : "", agenda: r.cells[r.cells.length - 1] ?? "" })) : [];

  const syncs = [];
  for (const s of sections(ls, 2).filter((x) => /^sync\s+\S/i.test(sectionName(x.title)) && !/^sync points/i.test(sectionName(x.title)))) {
    const id = syncId(s.title);
    const { parts, first } = syncParts(ls, s);
    const items = (sec) => blocksOf(ls, sec).filter((b) => b.type === "ul").flatMap((b) => b.items);
    const why = blocks(ls, s.start, first).find((b) => b.type === "p" && /why it gates/i.test(b.text));
    syncs.push({
      id,
      title: plain(s.title),
      gating: /gating/i.test(s.title),
      why: why ? why.text : null,
      entry: items(parts.entry),
      decisions: parts.agenda ? decisions(ls, parts.agenda.start, parts.agenda.end) : [],
      exit: items(parts.exit),
      unblocks: items(parts.unblocks).length
        ? items(parts.unblocks).map((it) => ({ lane: boldLead(it.text), text: it.text.replace(/^\*\*[^*]+\*\*:?\s*/, "") }))
        : [parts.unblocks?.inline, ...blocksOf(ls, parts.unblocks).filter((b) => b.type === "p").map((b) => b.text)].filter(Boolean).map((text) => ({ lane: null, text })),
      line: s.line + 1,
    });
  }

  const steps = [];
  const waivers = [];
  const hs = headings(ls);
  for (const t of tables(ls)) {
    const titleOf = () => plain([...hs].reverse().find((h) => h.line < t.line)?.text ?? "");
    if (column(t, "id") >= 0 && column(t, "owner") >= 0 && column(t, "action") >= 0) {
      const [ci, co, ca, cd, cf] = ["id", "owner", "action", "depends", "finding"].map((n) => column(t, n));
      const last = t.header.length - 1;
      for (const r of t.rows) {
        const id = plain(r.cells[ci] ?? "");
        const doneCell = r.cells[last] ?? "";
        steps.push({
          id,
          owner: stripModes(plain(r.cells[co] ?? "")),
          mode: modeOf(r.cells[co] ?? ""),
          lanes: [],
          action: r.cells[ca] ?? "",
          depends: cd >= 0 ? r.cells[cd] ?? "" : "",
          findings: cf >= 0 ? [...new Set(plain(r.cells[cf] ?? "").match(/\b[A-Z]{1,2}-\d+\b/g) ?? [])] : [],
          done: /☑|\[x\]/i.test(doneCell) ? true : /☐|\[ \]/.test(doneCell) ? false : null,
          group: titleOf(),
          line: r.line + 1,
        });
      }
    } else if (column(t, "finding") >= 0 && column(t, "disposition") >= 0) {
      for (const r of t.rows) waivers.push({ finding: plain(r.cells[column(t, "finding")] ?? ""), text: r.cells[column(t, "disposition")] ?? "", line: r.line + 1 });
    }
  }
  // With no ownership table, single-word owners name the lanes.
  if (!lanes.length) for (const k of [...new Set(steps.map((x) => x.owner).filter((o) => /^[A-Za-z]+$/.test(o) && !/^(both|all)$/i.test(o)))]) lanes.push({ name: k, key: k });
  for (const st of steps) st.lanes = lanesFor(st.owner, lanes);

  const sd = section(ls, /^step details/i);
  const details = [];
  if (sd) {
    for (const h of sections(ls, 3, sd.start, sd.end)) {
      const t = plain(h.title);
      const m = STEP_ID.exec(t);
      if (!m) continue;
      const bs = blocks(ls, h.start, h.end);
      const find = (re) => bs.findIndex((b) => b.type === "p" && re.test(b.text));
      const after = (re) => {
        const k = find(re);
        return k < 0 ? null : bs[k].text.replace(re, "").trim() || null;
      };
      const pk = find(/^\*\*Prompt/i);
      const prompt = pk >= 0 ? bs.slice(pk + 1).find((b) => b.type === "code")?.text ?? null : bs.find((b) => b.type === "code")?.text ?? null;
      const dk = find(/^\*\*Do:?\*\*/i);
      const owner = /\(([^)]*)\)\s*$/.exec(t);
      details.push({
        id: m[1] + m[2],
        title: stripModes(t.slice(m[0].length).replace(/^\s*(·|\u2014|-)\s*/, "").replace(/\s*\([^)]*\)\s*$/, "")).trim(),
        mode: modeOf(h.title),
        owner: owner ? owner[1] : null,
        prompt,
        validate: after(/^\*(?:\*)?Validate:?\*(?:\*)?:?/i),
        why: after(/^\*\*Why:?\*\*:?/i),
        do: dk >= 0 && bs[dk + 1]?.type === "ul" ? bs[dk + 1].items : [],
        doneWhen: after(/^\*\*Done when:?\*\*:?/i),
        body: bs,
        line: h.line + 1,
      });
    }
  }

  const et = section(ls, /^external tracks/i);
  const etTable = et ? tables(ls, et.start, et.end)[0] ?? null : null;
  const tl = section(ls, /^timeline/i);
  const tlTable = tl ? tables(ls, tl.start, tl.end)[0] ?? null : null;
  return {
    header,
    lanes,
    ownership,
    currentState,
    syncPoints: points,
    syncs,
    steps,
    waivers,
    details,
    externalTracks: etTable ? { header: etTable.header, rows: etTable.rows.map((r) => r.cells) } : null,
    timeline: tlTable ? { header: tlTable.header, rows: tlTable.rows.map((r) => r.cells) } : null,
    timelineNotes: blocksOf(ls, tl).filter((b) => b.type === "p"),
    sections: sections(ls, 2).map((s) => sectionName(s.title)),
  };
}

export function parseAtlas(ls) {
  const t = tables(ls).find((x) => column(x, "node") >= 0 && column(x, "done") >= 0);
  if (!t) return [];
  const [cn, cl, cd, cr] = ["node", "live", "done", "planned"].map((n) => column(t, n));
  return t.rows
    .map((r) => ({ node: plain(r.cells[cn] ?? ""), live: Number(plain(r.cells[cl] ?? "").match(/\d+/)?.[0] ?? NaN), done: Number(plain(r.cells[cd] ?? "").match(/\d+/)?.[0] ?? NaN), warn: /⚠/.test(r.cells[cd] ?? ""), remaining: cr >= 0 ? r.cells[cr] ?? "" : "", line: r.line + 1 }))
    .filter((r) => !/^total$/i.test(r.node));
}

function idsIn(text, known) {
  return [...new Set((String(text).match(STEP_IDS) ?? []).filter((x) => known.has(x)))];
}

export function extractCheckpoint(root, { specSha = "n/a" } = {}) {
  const chain = chainFiles(root);
  const unparsed = [];
  const facts = {};
  if (!chain.progress.length || !chain.plans.length) throw new Error("extract checkpoint: hsdd/management/ holds no dated progress report and execution plan");
  const progressFile = chain.progress[0];
  const planFile = chain.plans[0];
  const pls = read(root, progressFile);
  const progress = parseProgress(pls);
  const plan = parsePlan(read(root, planFile));

  const tree = extractPlan(root, { specSha });
  const nodeIds = new Set(tree.nodes.map((n) => n.id));
  const rootId = tree.project.root;
  const full = (short) => (nodeIds.has(short) ? short : nodeIds.has(`${rootId}.${short}`) ? `${rootId}.${short}` : null);

  plan.steps.forEach((s, i) => {
    if (!s.lanes.length) unparsed.push({ path: `/plan/steps/${i}/lanes`, file: planFile, line: s.line, reason: `owner "${s.owner}" names no lane in the ownership split (${plan.lanes.map((l) => l.key).join(", ")})` });
  });
  progress.milestones.forEach((m, i) => {
    if (!m.fraction && !m.reached) unparsed.push({ path: `/progress/milestones/${i}/fraction`, file: progressFile, line: m.line, reason: `gate "${m.gate}" states no met/total` });
  });
  const atlas = chain.atlas ? parseAtlas(read(root, chain.atlas)) : [];
  atlas.forEach((a, i) => {
    const id = full(a.node);
    if (id) a.node = id;
    else unparsed.push({ path: `/atlas/${i}/node`, file: chain.atlas, line: a.line, reason: `atlas row "${a.node}" names no node in hsdd/spec/` });
  });

  // The chain behind the heads, newest first, bounded.
  const history = {
    progress: chain.progress.slice(0, HISTORY).map((f) => {
      const p = f === progressFile ? progress : parseProgress(read(root, f));
      return { file: f, findings: p.findings.map((x) => x.id), gates: Object.fromEntries(p.milestones.map((m) => [m.id, m.fraction])) };
    }),
    plans: chain.plans.slice(0, HISTORY).map((f) => {
      const p = f === planFile ? plan : parsePlan(read(root, f));
      return { file: f, open: p.steps.filter((s) => s.done !== true).map((s) => s.id), done: p.steps.filter((s) => s.done === true).map((s) => s.id) };
    }),
  };

  facts["cp:verdict"] = sha(JSON.stringify(progress.verdict));
  for (const m of progress.milestones) facts[`cp:milestone:${m.id}`] = sha(m.raw);
  for (const b of progress.blockers) facts[`cp:blocker:${b.rank}`] = sha(b.text);

  const stepIds = new Set(plan.steps.map((s) => s.id));
  for (const b of progress.blockers) {
    b.findings = [...new Set(b.text.match(/\b[A-Z]{1,2}-\d+\b/g) ?? [])].filter((id) => progress.findings.some((f) => f.id === id));
    b.steps = idsIn(b.text, stepIds);
  }

  const phaseShort = tree.phases.flatMap((p) => [p.heading, `${p.node.split(".").pop()}.${p.n}`, p.id.slice(rootId.length + 1)]);
  const nodeShort = tree.nodes.map((n) => n.id.slice(rootId.length + 1)).filter(Boolean);
  const ids = [...new Set([
    ...tree.ids, ...phaseShort, ...nodeShort, ...stepIds, ...progress.findings.map((f) => f.id),
    ...plan.syncs.flatMap((s) => s.decisions.map((d) => d.id)),
    ...(plan.externalTracks?.rows ?? []).map((r) => /\bE-\d+\b/.exec(r[0] ?? "")?.[0]).filter(Boolean),
  ])].filter((x) => x && x.length > 1);

  return {
    kind: "checkpoint",
    schemaVersion: 1,
    project: { root: rootId, name: tree.project.name, specSha, codingMethod: tree.project.codingMethod, date: /(\d{4}-\d{2}-\d{2})/.exec(progressFile)[1] },
    files: { progress: progressFile, plan: planFile, atlas: chain.atlas, chain: [...new Set([...history.progress.map((h) => h.file), ...history.plans.map((h) => h.file)])] },
    tree: tree.nodes.map((n) => ({ id: n.id, name: n.name, parent: n.parent, children: n.children, kind: n.kind, status: n.status })),
    progress,
    plan,
    atlas,
    history,
    ids,
    facts,
    unparsed,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/extract-checkpoint.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/scripts/extract-checkpoint.mjs test/extract-checkpoint.test.mjs
git commit -m "feat(hsdd-summary): extract the checkpoint model from the management chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: The checkpoint schema, cross-checks, plan graph and prose slots

**Files:**
- Create: `skills/hsdd-summary/scripts/checks-checkpoint.mjs`, `skills/hsdd-summary/scripts/checkpoint-model.schema.json`, `test/helpers/checkpoint-fixture.mjs`
- Replace: `skills/hsdd-summary/scripts/graph.mjs` (adds four functions at the end; nothing else changes), `skills/hsdd-summary/scripts/prose.mjs` (adds `checkpointSlots` before `slotKind`; nothing else changes)
- Test: `test/checks-checkpoint.test.mjs`

**Interfaces:**
- Consumes: the model from Task 2.
- Produces: `crossCheckCheckpoint(model) -> { errors, findings: [{ kind, message, ... }], computed: { ages, stepAges, landedBy, delta: { file, carried, gone, ticked } | null, movement: { [id]: { prev, now, dir } } } }`; `consecutive(flags)`. Integrity kinds: `missing-section`, `missing-detail`, `detail-without-step`, `decision-duplicate`, `depends-unresolved`, `orphan-finding`. From `graph.mjs`: `stepRefsIn(text, stepIds)`, `dependsRefs(text, stepIds, syncIds, decisionHome) -> { steps, syncs, decisions, unresolved }`, `planGraph(model) -> { nodes: [{ id: "sync:Y"|"step:C-5", kind, ref, lane, done? }], edges }`, `collapsePlanGraph(graph, max) -> { nodes, edges, collapsed }` (steps batch by lane and layer). From `prose.mjs`: `checkpointSlots(model)` with keys `cp:verdict` (60 words), `cp:milestone:{id}` (25), `cp:blocker:{rank}` (25), all required and id-free. Helpers: `completedCheckpoint()`, `checkpointPage(model, extra)`.

- [ ] **Step 1: Write the test helper and the failing test**

Create `test/helpers/checkpoint-fixture.mjs`:

```js
import { extractCheckpoint } from "../../skills/hsdd-summary/scripts/extract-checkpoint.mjs";
import { crossCheckCheckpoint } from "../../skills/hsdd-summary/scripts/checks-checkpoint.mjs";
import { TREE } from "./plan-fixture.mjs";

// The checkpoint model as the agent leaves it: C-6's "both" owner filled
// from the plan's Operating model (both build lanes).
export function completedCheckpoint() {
  const m = extractCheckpoint(TREE, { specSha: "abc1234" });
  m.plan.steps.find((s) => s.id === "C-6").lanes = ["API", "Web"];
  m.unparsed = [];
  return m;
}

// Page data as render builds it for the checkpoint page.
export function checkpointPage(model = completedCheckpoint(), extra = {}) {
  const checked = crossCheckCheckpoint(model);
  const prose = { "cp:verdict": "The first milestone landed on time; the second waits on one open question about where sessions live." };
  for (const ms of model.progress.milestones) prose[`cp:milestone:${ms.id}`] = "Plain words about what this milestone means for merchants.";
  for (const b of model.progress.blockers) prose[`cp:blocker:${b.rank}`] = "Plain words about what could slip and why.";
  const safe = { bottomLine: model.progress.bottomLine.map((r) => !/`/.test(r.value)) };
  return { kind: "checkpoint", project: model.project, model, prose, gloss: {}, findings: checked.findings, computed: checked.computed, safe, readability: [], generated: "2026-10-02", ...extra };
}
```

Create `test/checks-checkpoint.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TREE } from "./helpers/plan-fixture.mjs";
import { completedCheckpoint } from "./helpers/checkpoint-fixture.mjs";
import { extractCheckpoint } from "../skills/hsdd-summary/scripts/extract-checkpoint.mjs";
import { crossCheckCheckpoint, consecutive } from "../skills/hsdd-summary/scripts/checks-checkpoint.mjs";
import { planGraph, collapsePlanGraph, dependsRefs } from "../skills/hsdd-summary/scripts/graph.mjs";
import { validate } from "../skills/hsdd-summary/scripts/schema.mjs";
import { checkpointSlots, proseStatus } from "../skills/hsdd-summary/scripts/prose.mjs";

const SCHEMA = JSON.parse(readFileSync(new URL("../skills/hsdd-summary/scripts/checkpoint-model.schema.json", import.meta.url), "utf8"));

test("schema: the raw extraction fails only at the unfilled lane; the completed model is valid", () => {
  assert.deepEqual(validate(SCHEMA, extractCheckpoint(TREE)), ["/plan/steps/1/lanes: fewer than 1 item(s)"]);
  assert.deepEqual(validate(SCHEMA, completedCheckpoint()), []);
});

test("errors: unparsed items and duplicate steps", () => {
  assert.match(crossCheckCheckpoint(extractCheckpoint(TREE)).errors[0], /^1 unparsed item\(s\) remain/);
  const m = completedCheckpoint();
  m.plan.steps.push({ ...m.plan.steps[0] });
  assert.ok(crossCheckCheckpoint(m).errors.includes("step C-5 appears in two step tables"));
});

test("integrity: the orphan finding; nothing else on a conforming plan", () => {
  assert.deepEqual(crossCheckCheckpoint(completedCheckpoint()).findings.map((f) => f.message), ["F-6 has no plan step and no waiver"]);
});

test("integrity: missing detail, unresolved depends, duplicate decision", () => {
  const m = completedCheckpoint();
  m.plan.details = m.plan.details.filter((d) => d.id !== "F-1");
  m.plan.steps[3].depends = "Sync Q, C-99, D-7";
  m.plan.syncs.push({ ...m.plan.syncs[0], id: "B" });
  const msgs = crossCheckCheckpoint(m).findings.map((f) => f.message);
  assert.ok(msgs.includes("F-1 has no detail block"));
  for (const x of ["Sync Q", "C-99", "D-7"]) assert.ok(msgs.some((s) => s.includes(`depends on "${x}"`)), x);
  assert.ok(msgs.some((s) => /D-1 is defined in Sync A and Sync B/.test(s)));
});

test("computed: carried ages, open-step ages, landing, delta, gate movement", () => {
  const { computed } = crossCheckCheckpoint(completedCheckpoint());
  assert.deepEqual(computed.ages, { "F-3": 3, "F-4": 2, "F-5": 1, "F-6": 1 });
  assert.equal(computed.stepAges["C-5"], 3);
  assert.deepEqual(computed.landedBy["F-5"], { steps: ["C-6"], waived: true });
  assert.deepEqual(computed.landedBy["F-6"], { steps: [], waived: false });
  assert.deepEqual(computed.delta, { file: "hsdd/management/2026-09-25-execution-plan.md", carried: ["C-5"], gone: ["C-4"], ticked: [] });
  assert.deepEqual(computed.movement, { M1: { prev: [2, 3], now: [3, 3], dir: "up" }, M2: { prev: [1, 4], now: [1, 4], dir: "same" } });
});

test("consecutive counts from the newest until the first gap", () => {
  assert.equal(consecutive([true, true, false, true]), 2);
  assert.equal(consecutive([false, true]), 0);
});

test("dependsRefs: syncs, decisions standing for their sync, steps, unresolved", () => {
  const r = dependsRefs("Sync A (D-1), C-5, C-9", new Set(["C-5"]), new Set(["A"]), new Map([["D-1", "A"]]));
  assert.deepEqual(r, { steps: ["C-5"], syncs: ["A"], decisions: ["D-1"], unresolved: ["C-9"] });
  assert.deepEqual(dependsRefs("none", new Set(), new Set(), new Map()), { steps: [], syncs: [], decisions: [], unresolved: [] });
});

test("planGraph: edges from depends, entry and unblocks; collapse batches by lane and layer", () => {
  const g = planGraph(completedCheckpoint());
  assert.deepEqual(g.edges.map((e) => `${e.from}>${e.to}`).sort(), [
    "step:B-1>step:F-1", "step:C-5>step:B-1", "step:C-5>sync:A", "sync:A>step:B-1", "sync:A>step:F-1", "sync:A>step:G-2",
  ]);
  const c = collapsePlanGraph(g, 3);
  assert.equal(c.collapsed, true);
  assert.ok(c.nodes.some((n) => n.id === "sync:A"));
  assert.ok(c.nodes.every((n) => n.kind === "sync" || n.id.startsWith("batch:")));
  assert.equal(collapsePlanGraph(g, 20).collapsed, false);
});

test("checkpoint slots are required and id-free; orphans stay within their page", () => {
  const m = completedCheckpoint();
  const slots = checkpointSlots(m);
  assert.deepEqual(slots.map((s) => s.key), ["cp:verdict", "cp:milestone:M1", "cp:milestone:M2", "cp:blocker:1", "cp:blocker:2"]);
  assert.ok(slots.every((s) => s.required && s.noIds));
  const store = { version: 1, entries: { "explain:acme": { text: "x", facts: null, textHash: null }, "cp:blocker:9": { text: "y", facts: null, textHash: null } } };
  assert.deepEqual(proseStatus(store, { version: 1, entries: {} }, slots, [], "checkpoint").orphaned, ["cp:blocker:9"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/checks-checkpoint.test.mjs`
Expected: FAIL with `ENOENT` for `checkpoint-model.schema.json`.

- [ ] **Step 3: Write the schema**

Create `skills/hsdd-summary/scripts/checkpoint-model.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-summary/checkpoint-model",
  "title": "hsdd-summary checkpoint model",
  "description": "What extract checkpoint writes and the agent completes: the newest progress report and execution plan, the atlas, the chain behind them, and the tree's node skeleton. Nothing here is authored.",
  "type": "object",
  "required": [
    "kind",
    "schemaVersion",
    "project",
    "files",
    "tree",
    "progress",
    "plan",
    "atlas",
    "history",
    "ids",
    "facts",
    "unparsed"
  ],
  "additionalProperties": false,
  "properties": {
    "kind": {
      "const": "checkpoint"
    },
    "schemaVersion": {
      "const": 1
    },
    "project": {
      "type": "object",
      "required": [
        "root",
        "name",
        "specSha",
        "codingMethod",
        "date"
      ],
      "additionalProperties": false,
      "properties": {
        "root": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "specSha": {
          "type": "string"
        },
        "codingMethod": {
          "enum": [
            "openspec",
            "superpowers"
          ]
        },
        "date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        }
      }
    },
    "files": {
      "type": "object",
      "required": [
        "progress",
        "plan",
        "atlas",
        "chain"
      ],
      "additionalProperties": false,
      "properties": {
        "progress": {
          "type": "string",
          "pattern": "^hsdd/management/"
        },
        "plan": {
          "type": "string",
          "pattern": "^hsdd/management/"
        },
        "atlas": {
          "type": [
            "string",
            "null"
          ]
        },
        "chain": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "tree": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "name",
          "parent",
          "children",
          "kind",
          "status"
        ],
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "parent": {
            "type": [
              "string",
              "null"
            ]
          },
          "children": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "kind": {
            "type": [
              "string",
              "null"
            ]
          },
          "status": {
            "enum": [
              "active",
              "retired"
            ]
          }
        }
      }
    },
    "progress": {
      "type": "object",
      "required": [
        "header",
        "bottomLine",
        "read",
        "milestones",
        "trigger",
        "done",
        "doneNotes",
        "velocity",
        "blockers",
        "findings",
        "verdict",
        "sections"
      ],
      "additionalProperties": false,
      "properties": {
        "header": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "bottomLine": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "label",
              "value"
            ],
            "additionalProperties": false,
            "properties": {
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              }
            }
          }
        },
        "read": {
          "type": [
            "string",
            "null"
          ]
        },
        "milestones": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/milestone"
          }
        },
        "trigger": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "lead",
              "text"
            ],
            "additionalProperties": false,
            "properties": {
              "lead": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "text": {
                "type": "string"
              }
            }
          }
        },
        "done": {
          "$ref": "#/$defs/table"
        },
        "doneNotes": {
          "$ref": "#/$defs/blocks"
        },
        "velocity": {
          "$ref": "#/$defs/blocks"
        },
        "blockers": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "rank",
              "lead",
              "text",
              "findings",
              "steps"
            ],
            "additionalProperties": false,
            "properties": {
              "rank": {
                "type": "integer",
                "minimum": 1
              },
              "lead": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "text": {
                "type": "string"
              },
              "findings": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "steps": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            }
          }
        },
        "findings": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/finding"
          }
        },
        "verdict": {
          "$ref": "#/$defs/blocks"
        },
        "sections": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "plan": {
      "type": "object",
      "required": [
        "header",
        "lanes",
        "ownership",
        "currentState",
        "syncPoints",
        "syncs",
        "steps",
        "waivers",
        "details",
        "externalTracks",
        "timeline",
        "timelineNotes",
        "sections"
      ],
      "additionalProperties": false,
      "properties": {
        "header": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "lanes": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "name",
              "key"
            ],
            "additionalProperties": false,
            "properties": {
              "name": {
                "type": "string"
              },
              "key": {
                "type": "string",
                "minLength": 1
              }
            }
          }
        },
        "ownership": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "label",
              "cells"
            ],
            "additionalProperties": false,
            "properties": {
              "label": {
                "type": "string"
              },
              "cells": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            }
          }
        },
        "currentState": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "syncPoints": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "name",
              "when",
              "who",
              "agenda"
            ],
            "additionalProperties": false,
            "properties": {
              "id": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "name": {
                "type": "string"
              },
              "when": {
                "type": "string"
              },
              "who": {
                "type": "string"
              },
              "agenda": {
                "type": "string"
              }
            }
          }
        },
        "syncs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/sync"
          }
        },
        "steps": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/step"
          }
        },
        "waivers": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "finding",
              "text",
              "line"
            ],
            "additionalProperties": false,
            "properties": {
              "finding": {
                "type": "string"
              },
              "text": {
                "type": "string"
              },
              "line": {
                "type": "integer"
              }
            }
          }
        },
        "details": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/detail"
          }
        },
        "externalTracks": {
          "$ref": "#/$defs/table"
        },
        "timeline": {
          "$ref": "#/$defs/table"
        },
        "timelineNotes": {
          "$ref": "#/$defs/blocks"
        },
        "sections": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "atlas": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "node",
          "live",
          "done",
          "warn",
          "remaining",
          "line"
        ],
        "additionalProperties": false,
        "properties": {
          "node": {
            "type": "string"
          },
          "live": {
            "type": "number"
          },
          "done": {
            "type": "number"
          },
          "warn": {
            "type": "boolean"
          },
          "remaining": {
            "type": "string"
          },
          "line": {
            "type": "integer"
          }
        }
      }
    },
    "history": {
      "type": "object",
      "required": [
        "progress",
        "plans"
      ],
      "additionalProperties": false,
      "properties": {
        "progress": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "file",
              "findings",
              "gates"
            ],
            "additionalProperties": false,
            "properties": {
              "file": {
                "type": "string"
              },
              "findings": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "gates": {
                "type": "object",
                "additionalProperties": {
                  "type": [
                    "array",
                    "null"
                  ],
                  "items": {
                    "type": "integer"
                  }
                }
              }
            }
          }
        },
        "plans": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "file",
              "open",
              "done"
            ],
            "additionalProperties": false,
            "properties": {
              "file": {
                "type": "string"
              },
              "open": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "done": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    },
    "ids": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "facts": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "pattern": "^sha256:[0-9a-f]{64}$"
      }
    },
    "unparsed": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "path",
          "file",
          "line",
          "reason"
        ],
        "additionalProperties": false,
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^/"
          },
          "file": {
            "type": "string"
          },
          "line": {
            "type": "integer",
            "minimum": 1
          },
          "reason": {
            "type": "string"
          }
        }
      }
    }
  },
  "$defs": {
    "block": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "enum": [
            "p",
            "ul",
            "ol",
            "code",
            "table",
            "quote",
            "heading"
          ]
        }
      }
    },
    "blocks": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/block"
      }
    },
    "table": {
      "type": [
        "object",
        "null"
      ],
      "properties": {
        "header": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    },
    "item": {
      "type": "object",
      "required": [
        "checked",
        "text"
      ],
      "additionalProperties": false,
      "properties": {
        "checked": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "text": {
          "type": "string"
        }
      }
    },
    "milestone": {
      "type": "object",
      "required": [
        "id",
        "name",
        "date",
        "gate",
        "fraction",
        "reached",
        "movement",
        "items",
        "raw",
        "line"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string"
        },
        "date": {
          "type": [
            "string",
            "null"
          ]
        },
        "gate": {
          "type": "string"
        },
        "fraction": {
          "type": [
            "array",
            "null"
          ],
          "items": {
            "type": "integer",
            "minimum": 0
          },
          "minItems": 2
        },
        "reached": {
          "type": "boolean"
        },
        "movement": {
          "type": [
            "string",
            "null"
          ]
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "met",
              "text"
            ],
            "additionalProperties": false,
            "properties": {
              "met": {
                "type": "boolean"
              },
              "text": {
                "type": "string"
              }
            }
          }
        },
        "raw": {
          "type": "string"
        },
        "line": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "finding": {
      "type": "object",
      "required": [
        "id",
        "severity",
        "area",
        "lead",
        "text",
        "line"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "severity": {
          "type": [
            "string",
            "null"
          ]
        },
        "area": {
          "type": "string"
        },
        "lead": {
          "type": [
            "string",
            "null"
          ]
        },
        "text": {
          "type": "string"
        },
        "line": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "sync": {
      "type": "object",
      "required": [
        "id",
        "title",
        "gating",
        "why",
        "entry",
        "decisions",
        "exit",
        "unblocks",
        "line"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string"
        },
        "gating": {
          "type": "boolean"
        },
        "why": {
          "type": [
            "string",
            "null"
          ]
        },
        "entry": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/item"
          }
        },
        "decisions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "question",
              "text",
              "landsIn",
              "line"
            ],
            "additionalProperties": false,
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^D-\\d+"
              },
              "question": {
                "type": "string"
              },
              "text": {
                "type": "string"
              },
              "landsIn": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "line": {
                "type": [
                  "integer",
                  "null"
                ]
              }
            }
          }
        },
        "exit": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/item"
          }
        },
        "unblocks": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "lane",
              "text"
            ],
            "additionalProperties": false,
            "properties": {
              "lane": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "text": {
                "type": "string"
              }
            }
          }
        },
        "line": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "step": {
      "type": "object",
      "required": [
        "id",
        "owner",
        "mode",
        "lanes",
        "action",
        "depends",
        "findings",
        "done",
        "group",
        "line"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "owner": {
          "type": "string"
        },
        "mode": {
          "enum": [
            null,
            "delegate",
            "interactive",
            "human"
          ]
        },
        "lanes": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1
        },
        "action": {
          "type": "string"
        },
        "depends": {
          "type": "string"
        },
        "findings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "done": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "group": {
          "type": "string"
        },
        "line": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "detail": {
      "type": "object",
      "required": [
        "id",
        "title",
        "mode",
        "owner",
        "prompt",
        "validate",
        "why",
        "do",
        "doneWhen",
        "body",
        "line"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "mode": {
          "enum": [
            null,
            "delegate",
            "interactive",
            "human"
          ]
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "prompt": {
          "type": [
            "string",
            "null"
          ]
        },
        "validate": {
          "type": [
            "string",
            "null"
          ]
        },
        "why": {
          "type": [
            "string",
            "null"
          ]
        },
        "do": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/item"
          }
        },
        "doneWhen": {
          "type": [
            "string",
            "null"
          ]
        },
        "body": {
          "$ref": "#/$defs/blocks"
        },
        "line": {
          "type": "integer",
          "minimum": 1
        }
      }
    }
  }
}
```

- [ ] **Step 4: Extend the graph module**

Replace `skills/hsdd-summary/scripts/graph.mjs` with:

```js
// Graphs the plan page draws, derived from the model. Pure functions; this
// file is also inlined into the page, so it imports nothing.

export const MAX_BOXES = 12;
// A collapsed graph is a chain of steps; past this many it reads better as a list.
export const MAX_STEPS = 6;
export const OUTSIDE = "(outside)";

export function nodeById(model) {
  return new Map(model.nodes.map((n) => [n.id, n]));
}

export function activeChildren(model, id) {
  const byId = nodeById(model);
  return (byId.get(id)?.children ?? []).map((c) => byId.get(c)).filter((n) => n && n.status === "active");
}

export function subtree(model, id) {
  const byId = nodeById(model);
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop();
    if (out.has(x) || !byId.has(x)) continue;
    out.add(x);
    stack.push(...byId.get(x).children);
  }
  return out;
}

// contract id -> node ids that produce it (node fields, phase fields, owner, produced_by).
export function producers(model) {
  const out = new Map();
  const put = (cid, node) => {
    if (!out.has(cid)) out.set(cid, new Set());
    out.get(cid).add(node);
  };
  const nodes = new Set(model.nodes.map((n) => n.id));
  for (const n of model.nodes) for (const r of n.produces) put(r.ref.split("@")[0], n.id);
  for (const p of model.phases) for (const r of p.produces) put(r.ref.split("@")[0], p.node);
  for (const c of model.contracts) {
    if (nodes.has(c.owner)) put(c.id, c.owner);
    for (const pid of c.producedBy) {
      const node = pid.replace(/\.\d+$/, "");
      if (nodes.has(node)) put(c.id, node);
    }
  }
  return out;
}

function consumedIn(model, ids) {
  const refs = new Map();
  for (const n of model.nodes) if (ids.has(n.id)) for (const r of n.consumes) refs.set(r.ref, r);
  for (const p of model.phases) if (ids.has(p.node)) for (const r of p.consumes) refs.set(r.ref, r);
  return [...refs.values()];
}

function edgeKind(model, refs) {
  const kinds = new Set(refs.map((ref) => model.contracts.find((c) => c.id === ref.split("@")[0])?.kind ?? "api"));
  if (kinds.size === 1 && kinds.has("event")) return "event";
  if (kinds.size === 1 && kinds.has("shared-model")) return "shared-model";
  return "contract";
}

// Boxes are the active children of `parentId`; an edge A -> B means something
// in B's subtree consumes a contract something in A's subtree produces.
// Contracts produced outside the tree arrive from one OUTSIDE box.
export function childGraph(model, parentId) {
  const kids = activeChildren(model, parentId);
  const subs = new Map(kids.map((k) => [k.id, subtree(model, k.id)]));
  const prod = producers(model);
  const external = new Set(model.contracts.filter((c) => c.external).map((c) => c.id));
  const edges = new Map();
  const addEdge = (from, to, ref) => {
    const key = `${from}|${to}`;
    if (!edges.has(key)) edges.set(key, { from, to, refs: [] });
    if (!edges.get(key).refs.includes(ref)) edges.get(key).refs.push(ref);
  };
  for (const b of kids) {
    for (const r of consumedIn(model, subs.get(b.id))) {
      const cid = r.ref.split("@")[0];
      const from = kids.filter((a) => a.id !== b.id && [...(prod.get(cid) ?? [])].some((p) => subs.get(a.id).has(p)));
      for (const a of from) addEdge(a.id, b.id, r.ref);
      if (!from.length && (r.ext || external.has(cid)) && !(prod.get(cid)?.size)) addEdge(OUTSIDE, b.id, r.ref);
    }
  }
  const list = [...edges.values()].map((e) => ({ ...e, kind: edgeKind(model, e.refs) }));
  return { boxes: kids.map((k) => k.id), outside: list.some((e) => e.from === OUTSIDE), edges: list };
}

// Longest-path layering over in-set dependencies: layer 0 depends on nothing in the set.
export function layers(ids, depsOf) {
  const set = new Set(ids);
  const memo = new Map();
  const depth = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const ds = (depsOf(id) ?? []).filter((d) => set.has(d));
    const v = ds.length ? 1 + Math.max(...ds.map((d) => depth(d, seen))) : 0;
    memo.set(id, v);
    return v;
  };
  const out = [];
  for (const id of ids) {
    const d = depth(id);
    (out[d] ??= []).push(id);
  }
  return out.filter(Boolean);
}

export function reachesIn(depsOf, from, to) {
  const seen = new Set();
  const stack = [...(depsOf(from) ?? [])];
  while (stack.length) {
    const x = stack.pop();
    if (x === to) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(depsOf(x) ?? []));
  }
  return false;
}

// A leaf-parent's phases: in-node dependency edges, collisions no dependency
// orders (drawn), the count of ordered ones (not drawn), cross-node
// dependencies, and the layering used when the graph is too large to draw.
export function phaseGraph(model, nodeId) {
  const ps = model.phases.filter((p) => p.node === nodeId);
  const ids = ps.map((p) => p.id);
  const set = new Set(ids);
  const byId = new Map(ps.map((p) => [p.id, p]));
  const depsOf = (id) => (byId.get(id)?.dependsOn ?? []).filter((d) => set.has(d));
  const edges = ps.flatMap((p) => depsOf(p.id).map((d) => ({ from: d, to: p.id, kind: "depends" })));
  const collisions = [];
  let orderedCollisions = 0;
  const seen = new Set();
  for (const p of ps) for (const o of p.collidesWith) {
    if (!set.has(o)) continue;
    const key = [p.id, o].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (reachesIn(depsOf, p.id, o) || reachesIn(depsOf, o, p.id)) orderedCollisions++;
    else collisions.push({ from: [p.id, o].sort()[0], to: [p.id, o].sort()[1], kind: "collides" });
  }
  const cross = ps.flatMap((p) => p.dependsOn.filter((d) => !set.has(d)).map((d) => ({ phase: p.id, on: d })));
  const steps = layers(ids, depsOf);
  return { ids, edges, collisions, orderedCollisions, cross, steps, collapsed: ids.length > MAX_BOXES };
}

const STEP_REF = /\b[A-Z]{1,2}-(?:\d+|[a-z])[′″']*(?![\w-])/g;

export function stepRefsIn(text, stepIds) {
  return [...new Set((String(text ?? "").match(STEP_REF) ?? []).filter((x) => stepIds.has(x)))];
}

// A Depends cell -> the steps, syncs (with sections) and decisions it names.
// A decision stands for the sync whose agenda defines it.
export function dependsRefs(text, stepIds, syncIds, decisionHome) {
  const out = { steps: [], syncs: [], decisions: [], unresolved: [] };
  const t = String(text ?? "").replace(/`/g, "");
  for (const m of t.matchAll(/\bSync\s+([^\s,;()·]+)/gi)) {
    if (syncIds.has(m[1])) out.syncs.push(m[1]);
    else out.unresolved.push(`Sync ${m[1]}`);
  }
  for (const m of t.matchAll(/\bD-\d+[′″']*/g)) {
    const home = decisionHome.get(m[0]);
    if (home) {
      out.decisions.push(m[0]);
      out.syncs.push(home);
    } else out.unresolved.push(m[0]);
  }
  const rest = t.replace(/\bSync\s+[^\s,;()·]+/gi, " ").replace(/\bD-\d+[′″']*/g, " ");
  for (const m of rest.matchAll(STEP_REF)) (stepIds.has(m[0]) ? out.steps : out.unresolved).push(m[0]);
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])];
  return out;
}

// The execution plan as a graph: syncs with sections and steps. Edges come
// from Depends cells, from steps a sync's Entry names (step -> sync), and from
// steps its Unblocks lines name (sync -> step). Never from the plan's Mermaid.
export function planGraph(model) {
  const { plan } = model;
  const stepIds = new Set(plan.steps.map((s) => s.id));
  const syncIds = new Set(plan.syncs.map((s) => s.id));
  const home = new Map();
  for (const s of plan.syncs) for (const d of s.decisions) if (!home.has(d.id)) home.set(d.id, s.id);
  const nodes = [
    ...plan.syncs.map((s) => ({ id: `sync:${s.id}`, kind: "sync", ref: s.id, lane: null })),
    ...plan.steps.map((s) => ({ id: `step:${s.id}`, kind: "step", ref: s.id, lane: s.lanes.length === 1 ? s.lanes[0] : s.lanes.length ? "shared" : null, done: s.done })),
  ];
  const edges = new Map();
  const add = (a, b) => {
    if (a !== b) edges.set(`${a}>${b}`, { from: a, to: b });
  };
  for (const s of plan.steps) {
    const r = dependsRefs(s.depends, stepIds, syncIds, home);
    for (const d of r.steps) add(`step:${d}`, `step:${s.id}`);
    for (const y of r.syncs) add(`sync:${y}`, `step:${s.id}`);
  }
  for (const y of plan.syncs) {
    for (const it of y.entry) for (const id of stepRefsIn(it.text, stepIds)) add(`step:${id}`, `sync:${y.id}`);
    for (const u of y.unblocks) for (const id of stepRefsIn(u.text, stepIds)) add(`sync:${y.id}`, `step:${id}`);
  }
  return { nodes, edges: [...edges.values()] };
}

// Above the box limit, steps batch by (lane, layer); syncs stay single boxes.
export function collapsePlanGraph(g, max = MAX_BOXES) {
  if (g.nodes.length <= max) return { ...g, collapsed: false };
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const lay = layers(g.nodes.map((n) => n.id), (id) => g.edges.filter((e) => e.to === id).map((e) => e.from));
  const layerOf = new Map();
  lay.forEach((ids, k) => ids.forEach((id) => layerOf.set(id, k)));
  const batchOf = (n) => (n.kind === "sync" ? n.id : `batch:${n.lane ?? "unassigned"}:${layerOf.get(n.id)}`);
  const boxes = new Map();
  for (const n of g.nodes) {
    const b = batchOf(n);
    if (!boxes.has(b)) boxes.set(b, { id: b, kind: n.kind === "sync" ? "sync" : "batch", ref: n.kind === "sync" ? n.ref : null, lane: n.lane, layer: layerOf.get(n.id), members: [] });
    boxes.get(b).members.push(n.ref);
  }
  const edges = new Map();
  for (const e of g.edges) {
    const a = batchOf(byId.get(e.from));
    const b = batchOf(byId.get(e.to));
    if (a !== b) edges.set(`${a}>${b}`, { from: a, to: b });
  }
  return { nodes: [...boxes.values()], edges: [...edges.values()], collapsed: true };
}
```

- [ ] **Step 5: Extend the prose store**

Replace `skills/hsdd-summary/scripts/prose.mjs` with:

```js
// The prose store and glossary: which slots exist, which are empty, stale or
// unstamped, and the lint every written slot must pass. Pure functions.
import { createHash } from "node:crypto";
import { words } from "./md.mjs";

export const AUDIENCES = { plan: ["reviewer", "stakeholder", "implementer"], checkpoint: ["lead", "executor", "stakeholder"] };
export const GLOSS_LIMIT = 8;

export function textHash(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

// One slot per piece of prose a page can show: key, word limit, whether the
// page refuses to render without it, whether ids are forbidden in it, and
// the facts hash that makes it stale when its subject changes.
export function planSlots(model) {
  const slots = [];
  const active = model.nodes.filter((n) => n.status === "active");
  for (const n of active) {
    const facts = model.facts[`explain:${n.id}`];
    slots.push({ key: `explain:${n.id}`, limit: 25, required: true, noIds: true, facts });
    for (const a of AUDIENCES.plan) slots.push({ key: `note:${n.id}:${a}`, limit: 40, required: false, noIds: a === "stakeholder", facts });
  }
  const activeIds = new Set(active.map((n) => n.id));
  for (const p of model.phases) if (activeIds.has(p.node)) slots.push({ key: `delivers:${p.id}`, limit: 25, required: false, noIds: false, facts: model.facts[`delivers:${p.id}`] });
  for (const c of model.contracts) slots.push({ key: `promise:${c.ref}`, limit: 40, required: false, noIds: true, facts: model.facts[`promise:${c.ref}`] });
  return slots;
}

// Glossary keys: every contract id (not version) the active tree names. The
// stakeholder reads these plain phrases instead of contract ids; nodes are
// shown by their names, which are not ids.
export function planGlossaryKeys(model) {
  const active = model.nodes.filter((n) => n.status === "active");
  const activeIds = new Set(active.map((n) => n.id));
  const contracts = new Set(model.contracts.map((c) => c.id));
  for (const x of [...active, ...model.phases.filter((p) => activeIds.has(p.node))]) {
    for (const r of [...x.consumes, ...x.produces]) contracts.add(r.ref.split("@")[0]);
  }
  return [...contracts].sort();
}

// The checkpoint page's slots: the stakeholder reads only these, so all are
// required and none may name an id. Keys share the store under "cp:".
export function checkpointSlots(model) {
  const f = model.facts;
  return [
    { key: "cp:verdict", limit: 60, required: true, noIds: true, facts: f["cp:verdict"] },
    ...model.progress.milestones.map((m) => ({ key: `cp:milestone:${m.id}`, limit: 25, required: true, noIds: true, facts: f[`cp:milestone:${m.id}`] })),
    ...model.progress.blockers.map((b) => ({ key: `cp:blocker:${b.rank}`, limit: 25, required: true, noIds: true, facts: f[`cp:blocker:${b.rank}`] })),
  ];
}

export function slotKind(key) {
  return key.startsWith("cp:") ? "checkpoint" : "plan";
}

export function emptyStore() {
  return { version: 1, entries: {} };
}

// Add missing slots and glossary keys; never change or drop existing text.
export function seed(store, glossary, slots, glossKeys) {
  const s = structuredClone(store);
  const g = structuredClone(glossary);
  for (const slot of slots) if (!(slot.key in s.entries)) s.entries[slot.key] = { text: "", facts: null, textHash: null };
  for (const k of glossKeys) if (!(k in g.entries)) g.entries[k] = "";
  return { store: s, glossary: g };
}

// `kind` limits orphan detection to that page's slots ("cp:" keys belong to
// the checkpoint page); each page keeps its own store file.
export function proseStatus(store, glossary, slots, glossKeys, kind = "plan") {
  const keys = new Set(slots.map((s) => s.key));
  const out = { emptyRequired: [], emptyOptional: [], stale: [], unstamped: [], orphaned: [], glossEmpty: [], glossOrphaned: [] };
  for (const slot of slots) {
    const e = store.entries[slot.key];
    if (!e || !e.text.trim()) {
      (slot.required ? out.emptyRequired : out.emptyOptional).push(slot.key);
      continue;
    }
    if (e.textHash !== textHash(e.text) || e.facts === null) out.unstamped.push(slot.key);
    else if (e.facts !== slot.facts) out.stale.push(slot.key);
  }
  for (const k of Object.keys(store.entries)) if (slotKind(k) === kind && !keys.has(k)) out.orphaned.push(k);
  const gk = new Set(glossKeys);
  for (const k of glossKeys) if (!String(glossary.entries[k] ?? "").trim()) out.glossEmpty.push(k);
  if (kind === "plan") for (const k of Object.keys(glossary.entries)) if (!gk.has(k)) out.glossOrphaned.push(k);
  return out;
}

// Restamp only the entries whose text changed since they were last stamped.
export function stampProse(store, slots) {
  const s = structuredClone(store);
  const restamped = [];
  for (const slot of slots) {
    const e = s.entries[slot.key];
    if (!e || !e.text.trim()) continue;
    if (e.textHash !== textHash(e.text) || e.facts === null) {
      e.facts = slot.facts;
      e.textHash = textHash(e.text);
      restamped.push(slot.key);
    }
  }
  return { store: s, restamped };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function namesId(text, ids) {
  return ids.find((id) => new RegExp(`(^|[^\\w.@-])${escapeRe(id)}($|[^\\w@-])`).test(text)) ?? null;
}

export function lintProse(store, glossary, slots, glossKeys, ids) {
  const findings = [];
  for (const slot of slots) {
    const text = store.entries[slot.key]?.text ?? "";
    if (!text.trim()) continue;
    const n = words(text);
    if (n > slot.limit) findings.push({ key: slot.key, rule: "length", message: `${n} words; the limit is ${slot.limit}` });
    if (slot.noIds) {
      const id = namesId(text, ids);
      if (id) findings.push({ key: slot.key, rule: "id", message: `names ${id}; say what it is instead` });
    }
    if (/[`*_#[\]]/.test(text)) findings.push({ key: slot.key, rule: "markdown", message: "uses markdown; write plain text" });
  }
  for (const k of glossKeys) {
    const text = String(glossary.entries[k] ?? "");
    if (!text.trim()) continue;
    if (words(text) > GLOSS_LIMIT) findings.push({ key: `gloss:${k}`, rule: "length", message: `${words(text)} words; the limit is ${GLOSS_LIMIT}` });
    const id = namesId(text, ids);
    if (id) findings.push({ key: `gloss:${k}`, rule: "id", message: `names ${id}; a gloss is plain words` });
  }
  return findings;
}
```

- [ ] **Step 6: Implement the cross-checks**

Create `skills/hsdd-summary/scripts/checks-checkpoint.mjs`:

```js
// Cross-checks and computed values over a checkpoint model. Errors stop the
// render; integrity findings are hsdd-checkpoint's own quality gates, shown on
// the page; computed values are what no single document states.
import { dependsRefs } from "./graph.mjs";

export function crossCheckCheckpoint(model) {
  const errors = [];
  const findings = [];
  const add = (kind, message, extra = {}) => findings.push({ kind, message, ...extra });
  const { progress, plan, history } = model;

  if (model.unparsed.length) {
    const u = model.unparsed[0];
    errors.push(`${model.unparsed.length} unparsed item(s) remain; first: ${u.path} (${u.file}:${u.line}) ${u.reason}`);
  }
  const seen = new Set();
  for (const s of plan.steps) {
    if (seen.has(s.id)) errors.push(`step ${s.id} appears in two step tables`);
    seen.add(s.id);
  }

  for (const [label, re] of [["Bottom line", /^bottom line/i], ["Milestone gate status", /^milestone gate status/i], ["Blockers", /^blockers/i], ["Findings register", /^findings register/i], ["Verdict", /^verdict/i]]) {
    if (!progress.sections.some((t) => re.test(t))) add("missing-section", `the progress report has no ${label} section`);
  }
  for (const [label, re] of [["Ownership split", /^ownership split/i], ["Sync points", /^sync points/i], ["Step details", /^step details/i]]) {
    if (!plan.sections.some((t) => re.test(t))) add("missing-section", `the execution plan has no ${label} section`);
  }

  const stepIds = new Set(plan.steps.map((s) => s.id));
  const detailIds = new Set(plan.details.map((d) => d.id));
  for (const s of plan.steps) if (!detailIds.has(s.id)) add("missing-detail", `${s.id} has no detail block`, { step: s.id });
  for (const d of plan.details) if (!stepIds.has(d.id)) add("detail-without-step", `${d.id} has a detail block but no step-table row`, { step: d.id });

  const syncIds = new Set(plan.syncs.map((s) => s.id));
  const decisionHome = new Map();
  for (const s of plan.syncs) for (const d of s.decisions) {
    if (decisionHome.has(d.id)) add("decision-duplicate", `${d.id} is defined in Sync ${decisionHome.get(d.id)} and Sync ${s.id}`, { decision: d.id });
    else decisionHome.set(d.id, s.id);
  }
  for (const s of plan.steps) {
    const r = dependsRefs(s.depends, stepIds, syncIds, decisionHome);
    for (const x of r.unresolved) add("depends-unresolved", `${s.id} depends on "${x}", which is no step, sync with a section, or decision in this plan`, { step: s.id });
  }

  const cited = new Map();
  for (const s of plan.steps) for (const f of s.findings) cited.set(f, [...(cited.get(f) ?? []), s.id]);
  const waived = new Set(plan.waivers.map((w) => w.finding));
  for (const f of progress.findings) if (!cited.has(f.id) && !waived.has(f.id)) add("orphan-finding", `${f.id} has no plan step and no waiver`, { finding: f.id });

  const computed = {
    ages: Object.fromEntries(progress.findings.map((f) => [f.id, consecutive(history.progress.map((h) => h.findings.includes(f.id)))])),
    stepAges: Object.fromEntries(plan.steps.map((s) => [s.id, consecutive(history.plans.map((h) => h.open.includes(s.id)))])),
    landedBy: Object.fromEntries(progress.findings.map((f) => [f.id, { steps: cited.get(f.id) ?? [], waived: waived.has(f.id) }])),
    delta: delta(history.plans),
    movement: movement(progress.milestones, history.progress[1]?.gates ?? {}),
  };
  return { errors, findings, computed };
}

// How many entries, from the newest, are true in a row.
export function consecutive(flags) {
  let n = 0;
  for (const f of flags) {
    if (!f) break;
    n++;
  }
  return n;
}

// Against the previous plan: its steps still in this plan (carried), its
// steps no longer here (landed or dropped; the Current state says which), and
// any it ticked in place. Ticks alone are not trusted: plans are often left
// unticked after publication.
function delta(plans) {
  const [head, prev] = plans;
  if (!prev) return null;
  const now = new Set([...head.open, ...head.done]);
  const before = [...prev.open, ...prev.done];
  return { file: prev.file, carried: before.filter((id) => now.has(id)), gone: before.filter((id) => !now.has(id)), ticked: prev.done };
}

function movement(milestones, prevGates) {
  return Object.fromEntries(milestones.map((m) => {
    const prev = prevGates[m.id] ?? null;
    const now = m.fraction;
    let dir = "new";
    if (prev && now) dir = now[0] > prev[0] ? "up" : now[0] < prev[0] ? "down" : "same";
    else if (m.id in prevGates) dir = "same";
    return [m.id, { prev, now, dir }];
  }));
}

```

- [ ] **Step 7: Run it to verify it passes, and nothing regressed**

Run: `node --test test/*.test.mjs`
Expected: PASS, 100 tests (78 from Plan B, 13 from Task 2, 9 here).

- [ ] **Step 8: Commit**

```bash
git add skills/hsdd-summary/scripts/checks-checkpoint.mjs skills/hsdd-summary/scripts/checkpoint-model.schema.json skills/hsdd-summary/scripts/graph.mjs skills/hsdd-summary/scripts/prose.mjs test/helpers/checkpoint-fixture.mjs test/checks-checkpoint.test.mjs
git commit -m "feat(hsdd-summary): checkpoint cross-checks, computed ages and delta, the plan graph

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: The checkpoint views

**Files:**
- Create: `skills/hsdd-summary/scripts/views-checkpoint.mjs`
- Test: `test/views-checkpoint.test.mjs`

**Interfaces:**
- Consumes: `views-core.mjs` (`renderBlocks` included), `graph.mjs`, page data `{ kind, project, model, prose, gloss: {}, findings, computed, safe: { bottomLine: boolean[] }, readability, generated }`.
- Produces: `CHECKPOINT_AUDIENCES` (`lead`, `executor`, `stakeholder`), `PLAN_GRAPH_MAX` (20), `renderCheckpoint(page, route)`. Routes: `top`, `sync/{id}`, `lane/{key}`, `step/{id}`, `finding/{id}`, `findings`, `milestone/{id}`, `status[/{node}]`. The stakeholder reaches only `top`, `milestone/{id}` and `status`; anything else, and any unknown id, falls back to that audience's top. Imports nothing outside this directory; top-level names distinct from the plan views'.

- [ ] **Step 1: Write the failing test**

Create `test/views-checkpoint.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { completedCheckpoint, checkpointPage } from "./helpers/checkpoint-fixture.mjs";
import { renderCheckpoint, CHECKPOINT_AUDIENCES } from "../skills/hsdd-summary/scripts/views-checkpoint.mjs";
import { namesId } from "../skills/hsdd-summary/scripts/prose.mjs";

const model = completedCheckpoint();
const page = checkpointPage(model);

function routes(m) {
  return [
    { view: "top" }, { view: "findings" }, { view: "status" },
    ...m.plan.syncs.map((s) => ({ view: "sync", id: s.id })),
    ...m.plan.lanes.map((l) => ({ view: "lane", id: l.key })),
    ...m.plan.steps.map((s) => ({ view: "step", id: s.id })),
    ...m.progress.findings.map((f) => ({ view: "finding", id: f.id })),
    ...m.progress.milestones.map((x) => ({ view: "milestone", id: x.id })),
    ...m.tree.map((n) => ({ view: "status", id: n.id })),
  ];
}

function visibleText(v) {
  const diagram = v.diagrams.flatMap((d) => [...d.spec.nodes.flatMap((n) => [n.label, n.sub]), ...d.spec.edges.map((e) => e.label), ...d.spec.legend.map((l) => l.text)]);
  return [v.title, ...v.crumbs.map((c) => c.label), v.body.replace(/<[^>]*>/g, " "), ...diagram].join("\n").replace(/&[a-z#0-9]+;/g, " ");
}

test("every route renders for every audience", () => {
  for (const audience of CHECKPOINT_AUDIENCES) for (const r of routes(model)) {
    const v = renderCheckpoint(page, { audience, ...r });
    assert.ok(v.title && v.body, `${audience} ${r.view} ${r.id ?? ""}`);
  }
});

test("the stakeholder never sees an id", () => {
  for (const r of routes(model)) {
    const text = visibleText(renderCheckpoint(page, { audience: "stakeholder", ...r }));
    assert.equal(namesId(text, model.ids), null, `${r.view} ${r.id ?? ""}: ${namesId(text, model.ids)}`);
  }
});

test("lead top: the read, tiles, gates with movement, syncs, the plan graph, blockers, delta, integrity", () => {
  const v = renderCheckpoint(page, { audience: "lead", view: "top" });
  assert.match(v.body, /the token service is half done/);
  assert.match(v.body, /class="tile"/);
  assert.match(v.body, /move-up/);
  assert.match(v.body, /Sync A \(gating\)/);
  assert.equal(v.diagrams[0].id, "plan");
  assert.deepEqual(v.diagrams[0].spec.nodes.map((n) => n.id).sort(), ["step:B-1", "step:C-5", "step:C-6", "step:F-1", "step:G-2", "sync:A"]);
  assert.match(v.body, /OQ1 is still open/);
  assert.match(v.body, /1 step carried into this plan, 1 step no longer in it/);
  assert.match(v.body, /F-6 has no plan step and no waiver/);
  assert.match(v.body, /3 reports running/);
});

test("executor: lane cards, then a lane's steps in order with the prompts in full", () => {
  assert.match(renderCheckpoint(page, { audience: "executor", view: "top" }).body, /API lane/);
  const lane = renderCheckpoint(page, { audience: "executor", view: "lane", id: "API" }).body;
  assert.ok(lane.indexOf("C-5") < lane.indexOf("B-1"), "C-5 runs before B-1");
  assert.match(lane, /data-copy/);
  assert.match(lane, /run hsdd-reconcile for session@v2/);
  assert.doesNotMatch(renderCheckpoint(page, { audience: "lead", view: "lane", id: "API" }).body, /data-copy/);
});

test("sync view: entry, decisions with where they land, exit, unblocks, waiting steps", () => {
  const b = renderCheckpoint(page, { audience: "lead", view: "sync", id: "A" }).body;
  for (const s of ["D-1 · Which region hosts the sessions?", "Lands in:", "Steps waiting on this sync", "API lane:"]) assert.ok(b.includes(s), s);
});

test("finding view: age with earlier reports, where it lands; an orphan says so", () => {
  assert.match(renderCheckpoint(page, { audience: "lead", view: "finding", id: "F-3" }).body, /In 3 consecutive registers/);
  assert.match(renderCheckpoint(page, { audience: "lead", view: "finding", id: "F-6" }).body, /No step and no waiver/);
});

test("status: the atlas on the node tree; a flagged count shows", () => {
  const v = renderCheckpoint(page, { audience: "lead", view: "status" });
  const web = v.diagrams[0].spec.nodes.find((n) => n.id === "acme.web");
  assert.equal(web.role, "status-contingent");
  assert.equal(v.diagrams[0].spec.nodes.find((n) => n.id === "acme.api").sub, "2 of 3 phases done");
});

test("stakeholder top: verdict, safe rows only, milestones in plain words, what could slip", () => {
  const b = renderCheckpoint(page, { audience: "stakeholder", view: "top" }).body;
  assert.match(b, /The first milestone landed on time/);
  assert.match(b, /Calendar outlook/);
  assert.doesNotMatch(b, /Remaining/);
  assert.match(b, /What could slip/);
});

test("lead-only views fall back to the stakeholder top; unknown ids fall back too", () => {
  assert.equal(renderCheckpoint(page, { audience: "stakeholder", view: "step", id: "C-5" }).title, "Progress on 2026-10-02");
  assert.equal(renderCheckpoint(page, { audience: "lead", view: "step", id: "Z-9" }).title, "Checkpoint 2026-10-02");
});

test("hostile text in the documents is escaped", () => {
  const m = completedCheckpoint();
  m.progress.findings[0].text = "<img src=x onerror=alert(1)>";
  m.plan.details[0].body.push({ type: "code", lang: "", text: "</code></pre><script>x()</script>" });
  const p = checkpointPage(m);
  for (const r of [{ view: "finding", id: "F-3" }, { view: "step", id: "C-5" }]) {
    assert.doesNotMatch(renderCheckpoint(p, { audience: "lead", ...r }).body, /<img|<script/);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/views-checkpoint.test.mjs`
Expected: FAIL with `Cannot find module` for `views-checkpoint.mjs`.

- [ ] **Step 3: Implement**

Create `skills/hsdd-summary/scripts/views-checkpoint.mjs`:

```js
// The checkpoint page's views. Pure: (page data, route) -> { title, crumbs,
// body, diagrams }. Inlined into the page with views-core.mjs and graph.mjs.
import { html, raw, inline, plural, href, chip, section, diagramSlot, renderBlocks, capitalize } from "./views-core.mjs";
import { planGraph, collapsePlanGraph, dependsRefs, layers } from "./graph.mjs";

export const CHECKPOINT_AUDIENCES = ["lead", "executor", "stakeholder"];
export const PLAN_GRAPH_MAX = 20;

const MODE_WORDS = { delegate: "\u{1F916} delegate", interactive: "\u{1F91D} interactive", human: "\u{1F464} human-only" };
const SEVERITIES = ["High", "Medium", "Low"];

export function renderCheckpoint(page, route) {
  const m = page.model;
  const ctx = {
    page,
    m,
    a: route.audience,
    stake: route.audience === "stakeholder",
    steps: new Map(m.plan.steps.map((s) => [s.id, s])),
    details: new Map(m.plan.details.map((d) => [d.id, d])),
    findings: new Map(m.progress.findings.map((f) => [f.id, f])),
    syncs: new Map(m.plan.syncs.map((s) => [s.id, s])),
  };
  if (!ctx.stake) {
    if (route.view === "sync" && ctx.syncs.has(route.id)) return cpSync(ctx, ctx.syncs.get(route.id));
    if (route.view === "lane" && m.plan.lanes.some((l) => l.key === route.id)) return cpLane(ctx, route.id);
    if (route.view === "step" && ctx.steps.has(route.id)) return cpStep(ctx, ctx.steps.get(route.id));
    if (route.view === "finding" && ctx.findings.has(route.id)) return cpFinding(ctx, ctx.findings.get(route.id));
    if (route.view === "findings") return cpFindings(ctx);
  }
  if (route.view === "milestone") {
    const ms = m.progress.milestones.find((x) => x.id === route.id);
    if (ms) return cpMilestone(ctx, ms);
  }
  if (route.view === "status") return cpStatus(ctx, route.id);
  if (ctx.stake) return cpStakeholderTop(ctx);
  if (ctx.a === "executor") return cpExecutorTop(ctx);
  return cpLeadTop(ctx);
}

function prose(ctx, key) {
  return ctx.page.prose[key] ?? "";
}

function home(ctx) {
  return { label: `Checkpoint ${ctx.m.project.date}`, href: href(ctx.a) };
}

function src(file, line) {
  if (!file) return raw("");
  return html`<p class="source">Source: <a href="${String(file).replace(/^hsdd\//, "../")}">${file}${line ? `:${line}` : ""}</a></p>`;
}

function stepChip(ctx, id) {
  const s = ctx.steps.get(id);
  return chip(id, s ? href(ctx.a, "step", id) : null, s && s.done ? "status-done" : "");
}

function findingChip(ctx, id) {
  const f = ctx.findings.get(id);
  return chip(id, f ? href(ctx.a, "finding", id) : null, f ? `sev-${f.severity}` : "");
}

function bar(fr) {
  if (!fr) return raw("");
  const [met, total] = fr;
  const pct = total ? Math.round((100 * met) / total) : 0;
  return html`<span class="meter" role="img" aria-label="${met} of ${total}"><span class="meter-fill w${Math.round(pct / 5) * 5}"></span></span>`;
}

function arrow(dir) {
  return { up: "▲", down: "▼", same: "═", new: "new" }[dir] ?? "";
}

function decisionHome(ctx) {
  const out = new Map();
  for (const s of ctx.m.plan.syncs) for (const d of s.decisions) if (!out.has(d.id)) out.set(d.id, s.id);
  return out;
}

function dependsChips(ctx, text) {
  const r = dependsRefs(text, new Set(ctx.steps.keys()), new Set(ctx.syncs.keys()), decisionHome(ctx));
  return raw([...r.syncs.map((y) => chip(`Sync ${y}`, href(ctx.a, "sync", y), "sync").s), ...r.steps.map((s) => stepChip(ctx, s).s), ...r.unresolved.map((u) => chip(u, null, "missing").s)].join(" "));
}

function graphSpec(ctx) {
  const g = planGraph(ctx.m);
  if (!g.nodes.length) return null;
  const c = g.nodes.length > PLAN_GRAPH_MAX ? collapsePlanGraph(g, PLAN_GRAPH_MAX) : { ...g, collapsed: false };
  if (c.nodes.length > PLAN_GRAPH_MAX) return null;
  const point = (id) => ctx.m.plan.syncPoints.find((p) => p.id === id);
  const nodes = c.nodes.map((n) => {
    if (n.kind === "sync") return { id: n.id, label: `Sync ${n.ref}`, sub: point(n.ref)?.when ?? "", role: "sync", href: href(ctx.a, "sync", n.ref) };
    if (n.kind === "batch") {
      const open = n.members.filter((id) => ctx.steps.get(id)?.done !== true);
      return { id: n.id, label: `${n.lane === "unassigned" ? "No lane" : n.lane === "shared" ? "Shared" : n.lane} · ${plural(n.members.length, "step")}`, sub: n.members.join(", "), role: open.length ? "lane-step" : "status-done", href: n.lane && n.lane !== "shared" && n.lane !== "unassigned" ? href(ctx.a, "lane", n.lane) : null };
    }
    const s = ctx.steps.get(n.ref);
    const d = ctx.details.get(n.ref);
    return { id: n.id, label: n.ref, sub: `${s.lanes.join(", ")}${d ? `\n${d.title}` : ""}`, role: s.done ? "status-done" : "lane-step", href: href(ctx.a, "step", n.ref) };
  });
  const roles = new Set(nodes.map((n) => n.role));
  const legend = [
    roles.has("sync") && { swatch: "sync", text: "sync: a meeting other work waits on" },
    roles.has("lane-step") && { swatch: "lane-step", text: c.collapsed ? "steps of one lane at one depth, still open" : "open step" },
    roles.has("status-done") && { swatch: "status-done", text: "done" },
    c.edges.length && { edge: "depends", text: "must come first" },
  ].filter(Boolean);
  return { direction: "LR", nodes, edges: c.edges.map((e) => ({ ...e, kind: "depends", label: "" })), legend };
}

function bottomTiles(ctx, onlySafe) {
  const rows = ctx.m.progress.bottomLine.filter((r, i) => !onlySafe || ctx.page.safe?.bottomLine?.[i]);
  if (!rows.length) return raw("");
  return html`<dl class="tiles">${rows.map((r) => html`<div class="tile"><dt>${r.label}</dt><dd>${inline(r.value)}</dd></div>`)}</dl>`;
}

function gates(ctx) {
  const mv = ctx.page.computed.movement ?? {};
  const ms = ctx.m.progress.milestones;
  if (!ms.length) return raw("");
  return html`<ul class="gates">${ms.map((x) => {
    const v = mv[x.id];
    const label = ctx.stake ? html`<strong>${x.name || x.id}</strong>` : html`<a href="${href(ctx.a, "milestone", x.id)}"><strong>${x.id}</strong></a> ${x.name}`;
    return html`<li><span class="gate-name">${label}${x.date ? html` <span class="muted">${x.date}</span>` : ""}</span>
      ${x.fraction ? html`${bar(x.fraction)}<span class="gate-count">${x.fraction[0]} / ${x.fraction[1]}</span>` : html`<span><span class="badge status-done">reached</span></span><span></span>`}
      <span>${!ctx.stake && v && v.dir !== "same" ? html`<span class="move move-${v.dir}" title="${v.prev ? `was ${v.prev[0]} / ${v.prev[1]}` : "first reading"}">${arrow(v.dir)}</span>` : ""}</span>
      ${ctx.stake && prose(ctx, `cp:milestone:${x.id}`) ? html`<p>${prose(ctx, `cp:milestone:${x.id}`)}</p>` : ""}</li>`;
  })}</ul>`;
}

function integrity(ctx) {
  if (!ctx.page.findings.length) return raw("");
  return section("Plan integrity", html`<p class="muted">hsdd-checkpoint's own quality gates, as the scripts read the documents.</p><ul>${ctx.page.findings.map((f) => html`<li>${f.message}</li>`)}</ul>`, "check");
}

function readability(ctx) {
  if (ctx.stake || !ctx.page.readability.length) return raw("");
  return section("Readability notes", html`<ul>${ctx.page.readability.map((f) => html`<li><code>${f.key}</code>: ${f.message}</li>`)}</ul>`, "readability");
}

function cpLeadTop(ctx) {
  const { m, page } = ctx;
  const spec = graphSpec(ctx);
  const ages = page.computed.ages ?? {};
  const delta = page.computed.delta;
  const sev = Object.fromEntries(SEVERITIES.map((s) => [s, m.progress.findings.filter((f) => f.severity === s)]));
  const syncCards = m.plan.syncPoints.map((p) => {
    const s = ctx.syncs.get(p.id);
    return html`<li class="card"><p class="eyebrow">${s ? (s.gating ? "gating" : "sync") : "standing"}</p><h3>${s ? html`<a href="${href(ctx.a, "sync", p.id)}">${p.name}</a>` : p.name}</h3><p class="muted">${p.when}${p.who ? ` · ${p.who}` : ""}</p><p>${inline(p.agenda)}</p>${s ? html`<p class="muted">${plural(s.decisions.length, "decision")} · ${plural(s.entry.length, "entry item")}</p>` : ""}</li>`;
  });
  const body = html`
    <header class="page-head"><p class="eyebrow">Checkpoint ${m.project.date}</p><h1>${m.project.name}</h1>
      ${m.progress.read ? html`<p class="explain">${inline(m.progress.read)}</p>` : ""}</header>
    ${bottomTiles(ctx, false)}
    ${section("Milestone gates", gates(ctx))}
    ${section("Syncs", html`<ul class="cards">${syncCards}</ul>`)}
    ${spec ? section("Plan graph", diagramSlot("plan")) : section("Order of work", stepOrder(ctx))}
    ${section("Blockers", html`<ol class="blockers">${m.progress.blockers.map((b) => html`<li><strong>${b.lead ?? ""}</strong> ${b.findings.map((f) => findingChip(ctx, f))} ${b.steps.map((s) => stepChip(ctx, s))}</li>`)}</ol>`)}
    ${section("Findings", html`<p>${SEVERITIES.map((s) => html`<span class="badge sev-${s}">${s}: ${sev[s].length}</span> `)} <a href="${href(ctx.a, "findings")}">all ${m.progress.findings.length}</a></p>
      <ul>${m.progress.findings.filter((f) => f.severity === "High" || (ages[f.id] ?? 0) > 1).map((f) => html`<li>${findingChip(ctx, f.id)} ${f.lead ?? ""}${(ages[f.id] ?? 0) > 1 ? html` <span class="badge warn">${plural(ages[f.id], "report")} running</span>` : ""}</li>`)}</ul>`)}
    ${delta ? section("Since the last plan", html`<p>Against <a href="${delta.file.replace(/^hsdd\//, "../")}">${delta.file.split("/").pop()}</a>: ${plural(delta.carried.length, "step")} carried into this plan, ${plural(delta.gone.length, "step")} no longer in it (landed or dropped; the Current state says which).</p>
      ${m.plan.currentState.length ? html`<ul>${m.plan.currentState.map((t) => html`<li>${inline(t)}</li>`)}</ul>` : ""}`) : ""}
    ${integrity(ctx)}
    ${readability(ctx)}
    ${src(m.files.progress)}${src(m.files.plan)}`;
  return { title: `Checkpoint ${m.project.date}`, crumbs: [home(ctx)], body: body.s, diagrams: spec ? [{ id: "plan", spec }] : [] };
}

function stepOrder(ctx) {
  const g = planGraph(ctx.m);
  const lay = layers(g.nodes.map((n) => n.id), (id) => g.edges.filter((e) => e.to === id).map((e) => e.from));
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return html`<ol class="steps">${lay.map((ids) => html`<li>${ids.map((id) => {
    const n = byId.get(id);
    return n.kind === "sync" ? chip(`Sync ${n.ref}`, href(ctx.a, "sync", n.ref), "sync") : stepChip(ctx, n.ref);
  })}</li>`)}</ol>`;
}

function laneSteps(ctx, key) {
  const g = planGraph(ctx.m);
  const lay = layers(g.nodes.map((n) => n.id), (id) => g.edges.filter((e) => e.to === id).map((e) => e.from));
  const order = lay.flat();
  return ctx.m.plan.steps.filter((s) => s.lanes.includes(key)).sort((x, y) => order.indexOf(`step:${x.id}`) - order.indexOf(`step:${y.id}`));
}

function cpExecutorTop(ctx) {
  const { m } = ctx;
  const body = html`
    <header class="page-head"><p class="eyebrow">Checkpoint ${m.project.date}</p><h1>Pick your lane</h1>
      <p class="explain">Each lane's steps, in the order they can run, with the prompt or briefing to work from.</p></header>
    <ul class="cards">${m.plan.lanes.map((l) => {
      const steps = laneSteps(ctx, l.key);
      const open = steps.filter((s) => s.done !== true);
      return html`<li class="card"><h3><a href="${href(ctx.a, "lane", l.key)}">${l.name}</a></h3><p>${plural(open.length, "open step")}${steps.length > open.length ? `, ${steps.length - open.length} done` : ""}</p><p>${open.slice(0, 6).map((s) => stepChip(ctx, s.id))}</p></li>`;
    })}</ul>
    ${section("Syncs", html`<ul>${m.plan.syncPoints.map((p) => html`<li>${ctx.syncs.has(p.id) ? html`<a href="${href(ctx.a, "sync", p.id)}">${p.name}</a>` : p.name} · ${p.when}</li>`)}</ul>`)}`;
  return { title: `Checkpoint ${m.project.date}`, crumbs: [home(ctx)], body: body.s, diagrams: [] };
}

function cpStakeholderTop(ctx) {
  const { m } = ctx;
  const body = html`
    <header class="page-head"><p class="eyebrow">Progress on ${m.project.date}</p><h1>${m.project.name}</h1>
      <p class="explain">${prose(ctx, "cp:verdict")}</p></header>
    ${section("Where things stand", bottomTiles(ctx, true))}
    ${section("Milestones", gates(ctx))}
    ${m.progress.blockers.length ? section("What could slip", html`<ul>${m.progress.blockers.map((b) => html`<li>${prose(ctx, `cp:blocker:${b.rank}`)}</li>`)}</ul>`) : ""}
    ${section("Build progress", html`<p><a href="${href(ctx.a, "status")}">See how far each part has come.</a></p>`)}`;
  return { title: `Progress on ${m.project.date}`, crumbs: [{ label: `Progress on ${m.project.date}`, href: href(ctx.a) }], body: body.s, diagrams: [] };
}

function cpSync(ctx, s) {
  const p = ctx.m.plan.syncPoints.find((x) => x.id === s.id);
  const g = planGraph(ctx.m);
  const waiting = g.edges.filter((e) => e.from === `sync:${s.id}` && e.to.startsWith("step:")).map((e) => e.to.slice(5));
  const checklist = (items) => renderBlocks([{ type: "ul", items }]);
  const body = html`
    <header class="page-head"><p class="eyebrow">${s.gating ? "Gating sync" : "Sync"}</p><h1>${s.title}</h1>
      ${p ? html`<p class="muted">${p.when}${p.who ? ` · ${p.who}` : ""}</p>` : ""}
      ${s.why ? html`<p class="explain">${inline(s.why)}</p>` : ""}</header>
    ${section("Entry", s.entry.length ? checklist(s.entry) : html`<p class="muted">None stated.</p>`)}
    ${section("Agenda", html`${s.decisions.map((d) => html`<article class="card decision"><h3>${d.id} · ${d.question}</h3>${renderBlocks(d.text.split(/\n\n/).map((t) => ({ type: "p", text: t })))}${d.landsIn ? html`<p><strong>Lands in:</strong> ${inline(d.landsIn)}</p>` : ""}</article>`)}`)}
    ${section("Exit", s.exit.length ? checklist(s.exit) : html`<p class="muted">None stated.</p>`)}
    ${section("Unblocks", html`<ul>${s.unblocks.map((u) => html`<li>${u.lane ? html`<strong>${u.lane}:</strong> ` : ""}${inline(u.text)}</li>`)}</ul>`)}
    ${waiting.length ? section("Steps waiting on this sync", html`<p>${waiting.map((id) => stepChip(ctx, id))}</p>`) : ""}
    ${src(ctx.m.files.plan, s.line)}`;
  return { title: s.title, crumbs: [home(ctx), { label: `Sync ${s.id}`, href: href(ctx.a, "sync", s.id) }], body: body.s, diagrams: [] };
}

function stepCard(ctx, s, full) {
  const d = ctx.details.get(s.id);
  const age = ctx.page.computed.stepAges?.[s.id] ?? 0;
  return html`<article class="card step">
    <p class="eyebrow">${s.mode ? MODE_WORDS[s.mode] : "step"} · ${s.owner}${s.done ? html` <span class="badge status-done">done</span>` : ""}${age > 1 ? html` <span class="badge warn">open in ${plural(age, "plan")}</span>` : ""}</p>
    <h3><a href="${href(ctx.a, "step", s.id)}">${s.id}</a> · ${d ? d.title : ""}</h3>
    <p>${inline(s.action)}</p>
    <p class="muted">Depends: ${dependsChips(ctx, s.depends)}${s.findings.length ? html` · Findings: ${s.findings.map((f) => findingChip(ctx, f))}` : ""}</p>
    ${full && d ? html`<div class="detail">${renderBlocks(d.body)}</div>` : ""}
  </article>`;
}

function cpLane(ctx, key) {
  const lane = ctx.m.plan.lanes.find((l) => l.key === key);
  const steps = laneSteps(ctx, key);
  const k = ctx.m.plan.lanes.indexOf(lane);
  const own = ctx.m.plan.ownership.filter((r) => r.cells[k] && !/^\s*(\u2014|-)?\s*$/.test(r.cells[k]));
  const tl = ctx.m.plan.timeline;
  const tcol = tl ? tl.header.findIndex((h) => h.toLowerCase().includes(key.toLowerCase())) : -1;
  const body = html`
    <header class="page-head"><p class="eyebrow">Lane</p><h1>${lane.name}</h1>
      <p class="explain">${plural(steps.filter((s) => s.done !== true).length, "open step")}, in the order they can run.</p></header>
    ${steps.map((s) => stepCard(ctx, s, ctx.a === "executor"))}
    ${own.length ? section("Owns", html`<dl>${own.map((r) => html`<dt>${r.label}</dt><dd>${inline(r.cells[k])}</dd>`)}</dl>`) : ""}
    ${tcol > 0 ? section("Timeline", html`<dl>${tl.rows.map((r) => html`<dt>${inline(r[0])}</dt><dd>${inline(r[tcol] ?? "")}</dd>`)}</dl>`) : ""}`;
  return { title: lane.name, crumbs: [home(ctx), { label: lane.name, href: href(ctx.a, "lane", key) }], body: body.s, diagrams: [] };
}

function cpStep(ctx, s) {
  const d = ctx.details.get(s.id);
  const g = planGraph(ctx.m);
  const next = g.edges.filter((e) => e.from === `step:${s.id}`).map((e) => e.to);
  const body = html`
    ${stepCard(ctx, s, true)}
    ${next.length ? section("Unblocks", html`<p>${next.map((id) => (id.startsWith("sync:") ? chip(`Sync ${id.slice(5)}`, href(ctx.a, "sync", id.slice(5)), "sync") : stepChip(ctx, id.slice(5))))}</p>`) : ""}
    ${src(ctx.m.files.plan, d ? d.line : s.line)}`;
  const crumbs = [home(ctx), ...(s.lanes.length === 1 ? [{ label: ctx.m.plan.lanes.find((l) => l.key === s.lanes[0])?.name ?? s.lanes[0], href: href(ctx.a, "lane", s.lanes[0]) }] : []), { label: s.id, href: href(ctx.a, "step", s.id) }];
  return { title: `${s.id}${d ? ` · ${d.title}` : ""}`, crumbs, body: body.s, diagrams: [] };
}

function cpFinding(ctx, f) {
  const age = ctx.page.computed.ages?.[f.id] ?? 1;
  const landed = ctx.page.computed.landedBy?.[f.id] ?? { steps: [], waived: false };
  const waiver = ctx.m.plan.waivers.find((w) => w.finding === f.id);
  const reports = ctx.m.history.progress.slice(0, age).map((h) => h.file);
  const body = html`
    <header class="page-head"><p class="eyebrow"><span class="badge sev-${f.severity}">${f.severity}</span> ${f.area}</p><h1>${f.id} · ${f.lead ?? ""}</h1>
      <p class="muted">In ${plural(age, "consecutive register")}${age > 1 ? html`: ${reports.map((r) => html`<a href="${r.replace(/^hsdd\//, "../")}">${r.split("/").pop()}</a> `)}` : ""}</p></header>
    <div class="card">${renderBlocks([{ type: "p", text: f.text }])}</div>
    ${section("Lands in the plan as", landed.steps.length ? html`<p>${landed.steps.map((s) => stepChip(ctx, s))}</p>` : waiver ? html`<p><strong>Waived:</strong> ${inline(waiver.text)}</p>` : html`<p class="warn-text">No step and no waiver.</p>`)}
    ${src(ctx.m.files.progress, f.line)}`;
  return { title: f.id, crumbs: [home(ctx), { label: "Findings", href: href(ctx.a, "findings") }, { label: f.id, href: href(ctx.a, "finding", f.id) }], body: body.s, diagrams: [] };
}

function cpFindings(ctx) {
  const ages = ctx.page.computed.ages ?? {};
  const landed = ctx.page.computed.landedBy ?? {};
  const body = html`<header class="page-head"><h1>Findings register</h1></header>
    <div class="table-wrap"><table><thead><tr><th>ID</th><th>Severity</th><th>Area</th><th>Finding</th><th>Reports</th><th>Lands in</th></tr></thead><tbody>
    ${ctx.m.progress.findings.map((f) => html`<tr><td><a href="${href(ctx.a, "finding", f.id)}">${f.id}</a></td><td><span class="badge sev-${f.severity}">${f.severity}</span></td><td>${f.area}</td><td>${f.lead ?? ""}</td><td>${ages[f.id] ?? 1}</td><td>${(landed[f.id]?.steps ?? []).map((s) => stepChip(ctx, s))}${landed[f.id]?.waived ? "waived" : ""}</td></tr>`)}
    </tbody></table></div>`;
  return { title: "Findings", crumbs: [home(ctx), { label: "Findings", href: href(ctx.a, "findings") }], body: body.s, diagrams: [] };
}

function cpMilestone(ctx, x) {
  const v = ctx.page.computed.movement?.[x.id];
  const body = html`
    <header class="page-head"><p class="eyebrow">Milestone${x.date ? ` · ${x.date}` : ""}</p><h1>${ctx.stake ? capitalize(x.name || x.id) : `${x.id} · ${x.name}`}</h1>
      <p>${x.fraction ? html`${bar(x.fraction)} ${x.fraction[0]} / ${x.fraction[1]}` : html`<span class="badge status-done">reached</span>`}${!ctx.stake && v && v.prev ? html` <span class="muted">(was ${v.prev[0]} / ${v.prev[1]})</span>` : ""}</p>
      ${ctx.stake ? html`<p class="explain">${prose(ctx, `cp:milestone:${x.id}`)}</p>` : ""}</header>
    ${ctx.stake ? "" : x.items.length ? section("Gate items", renderBlocks([{ type: "ul", items: x.items.map((it) => ({ checked: it.met, text: it.text })) }])) : section("Gate", html`<p>${inline(x.raw)}</p>`)}
    ${ctx.stake ? "" : src(ctx.m.files.progress, x.line)}`;
  return { title: ctx.stake ? capitalize(x.name || x.id) : x.id, crumbs: [ctx.stake ? { label: `Progress on ${ctx.m.project.date}`, href: href(ctx.a) } : home(ctx), { label: ctx.stake ? capitalize(x.name || x.id) : x.id, href: href(ctx.a, "milestone", x.id) }], body: body.s, diagrams: [] };
}

function cpStatus(ctx, id) {
  const tree = new Map(ctx.m.tree.map((n) => [n.id, n]));
  const root = ctx.m.project.root;
  const at = tree.has(id) ? id : root;
  const rows = new Map(ctx.m.atlas.map((r) => [r.node, r]));
  const sub = (nid) => {
    const out = [nid];
    for (const c of tree.get(nid)?.children ?? []) out.push(...sub(c));
    return out;
  };
  const totals = (nid) => sub(nid).reduce((acc, x) => {
    const r = rows.get(x);
    return r ? { live: acc.live + r.live, done: acc.done + r.done, warn: acc.warn || r.warn } : acc;
  }, { live: 0, done: 0, warn: false });
  const kids = (tree.get(at)?.children ?? []).map((c) => tree.get(c)).filter((n) => n && n.status === "active");
  const box = (n) => {
    const t = totals(n.id);
    return { id: n.id, label: n.name, sub: t.live ? `${t.done} of ${t.live} ${ctx.stake ? "pieces of work" : "phases"} done` : ctx.stake ? "nothing planned yet" : "no phases", role: t.warn ? "status-contingent" : t.live && t.done === t.live ? "status-done" : "status-planned", href: (tree.get(n.id)?.children ?? []).length || rows.has(n.id) ? href(ctx.a, "status", n.id) : null };
  };
  const node = tree.get(at);
  const nodes = [box(node), ...kids.map(box)];
  const spec = { direction: "TB", nodes, edges: kids.map((k) => ({ from: node.id, to: k.id, kind: "depends", label: "" })), legend: [{ swatch: "status-done", text: "every phase done" }, { swatch: "status-planned", text: "phases remaining" }, { swatch: "status-contingent", text: ctx.stake ? "needs a correction" : "the atlas flags a count" }] };
  const r = rows.get(at);
  const t = totals(at);
  const crumbs = [ctx.stake ? { label: `Progress on ${ctx.m.project.date}`, href: href(ctx.a) } : home(ctx)];
  for (let n = node; n; n = n.parent ? tree.get(n.parent) : null) crumbs.splice(1, 0, { label: n.name, href: href(ctx.a, "status", n.id) });
  const body = html`
    <header class="page-head"><p class="eyebrow">Build progress</p><h1>${node.name}</h1>
      <p class="explain">${t.live ? `${t.done} of ${t.live} ${ctx.stake ? "pieces of work" : "phases"} done.` : ""}</p></header>
    ${kids.length ? diagramSlot("status") : ""}
    ${r && !ctx.stake ? section("From the atlas", html`<dl><dt>Live</dt><dd>${r.live}</dd><dt>Done</dt><dd>${r.done}${r.warn ? " (flagged)" : ""}</dd><dt>Remaining</dt><dd>${inline(r.remaining)}</dd></dl>`) : ""}
    ${ctx.stake ? "" : src(ctx.m.files.atlas, r?.line)}`;
  return { title: node.name, crumbs, body: body.s, diagrams: kids.length ? [{ id: "status", spec }] : [] };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/views-checkpoint.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/scripts/views-checkpoint.mjs test/views-checkpoint.test.mjs
git commit -m "feat(hsdd-summary): checkpoint views for the lead, the executor and stakeholders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: The checkpoint page in the assembler and the CLI

**Files:**
- Replace: `skills/hsdd-summary/scripts/stamp.mjs` (adds `checkpointInputs`), `skills/hsdd-summary/scripts/html.mjs` (adds the `checkpoint` kind: views, audiences, nav keys `t`, `f`, `s`), `skills/hsdd-summary/scripts/summary.mjs` (adds the `checkpoint` kind: schema, page `checkpoint.html`, prose `checkpoint-prose.json`, extract, check, slots, inputs, the stakeholder-safe bottom-line flags, `present`)
- Test: `test/cli-checkpoint.test.mjs`

**Interfaces:**
- Consumes: Tasks 2 to 4.
- Produces: the commands `extract checkpoint`, `validate checkpoint`, `slots checkpoint`, `lint checkpoint`, `stamp checkpoint`, `render checkpoint`, and `check` covering both pages. `checkpointInputs(root)`: the eight newest reports and plans, the atlas, the spec files the node names come from, `checkpoint-prose.json`.

- [ ] **Step 1: Write the failing test**

Create `test/cli-checkpoint.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TREE } from "./helpers/plan-fixture.mjs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { main } from "../skills/hsdd-summary/scripts/summary.mjs";

function run(root, ...argv) {
  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    return { code: main(argv, root), out: lines.join("\n") };
  } catch (e) {
    return { code: 1, out: lines.join("\n"), error: e.message };
  } finally {
    console.log = log;
  }
}

function plan(root, model) {
  run(root, "extract", "plan", "--model", model);
  const m = JSON.parse(readFileSync(model, "utf8"));
  m.phases[4].tier = "spot-check";
  m.phases[5].dependsOn = ["acme.web.console.2"];
  m.unparsed = [];
  writeFileSync(model, JSON.stringify(m));
  run(root, "slots", "--model", model);
  const p = join(root, "hsdd/summary/prose.json");
  const s = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(s.entries)) if (k.startsWith("explain:")) s.entries[k].text = "Plain words about what this part does.";
  writeFileSync(p, JSON.stringify(s));
  const g = join(root, "hsdd/summary/glossary.json");
  const gl = JSON.parse(readFileSync(g, "utf8"));
  for (const k of Object.keys(gl.entries)) gl.entries[k] = "a connection";
  writeFileSync(g, JSON.stringify(gl));
  run(root, "stamp", "--model", model);
  return run(root, "render", "--model", model);
}

test("checkpoint pipeline, beside a plan page that it never makes stale", () => {
  const root = mkdtempSync(join(tmpdir(), "hsdd-cp-"));
  cpSync(TREE, root, { recursive: true });
  assert.equal(plan(root, join(root, "plan.json")).code, 0);
  const model = join(root, "cp.json");
  let r = run(root, "extract", "checkpoint", "--model", model);
  assert.match(r.out, /\/plan\/steps\/1\/lanes/);
  const m = JSON.parse(readFileSync(model, "utf8"));
  m.plan.steps[1].lanes = ["API", "Web"];
  m.unparsed = [];
  writeFileSync(model, JSON.stringify(m));
  assert.equal(run(root, "validate", "checkpoint", "--model", model).code, 0);
  assert.match(run(root, "render", "checkpoint", "--model", model).error, /required slot/);
  r = run(root, "slots", "checkpoint", "--model", model);
  assert.match(r.out, /cp:verdict \(max 60 words, no ids\)/);
  const p = join(root, "hsdd/summary/checkpoint-prose.json");
  const s = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(s.entries)) s.entries[k].text = "Plain words for whoever reads this.";
  writeFileSync(p, JSON.stringify(s));
  run(root, "stamp", "checkpoint", "--model", model);
  r = run(root, "render", "checkpoint", "--model", model);
  assert.equal(r.code, 0, r.error);
  assert.ok(existsSync(join(root, "hsdd/summary/checkpoint.html")));
  const html = readFileSync(join(root, "hsdd/summary/checkpoint.html"), "utf8");
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1].replace(/&#39;/g, "'");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  for (const sc of scripts) assert.ok(csp.includes(`'sha256-${createHash("sha256").update(sc, "utf8").digest("base64")}'`));
  new vm.Script(scripts[1]);
  assert.match(scripts[1], /render: renderCheckpoint/);
  r = run(root, "check");
  assert.match(r.out, /checkpoint\.html: fresh/);
  assert.match(r.out, /summary\.html: fresh/);
  writeFileSync(join(root, "hsdd/management/2026-10-09-progress.md"), "# acme · Progress Report (2026-10-09)\n");
  r = run(root, "check");
  assert.match(r.out, /checkpoint\.html: stale\n  added: hsdd\/management\/2026-10-09-progress\.md/);
  assert.match(r.out, /summary\.html: fresh/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/cli-checkpoint.test.mjs`
Expected: FAIL: `extract: unknown kind "checkpoint"` makes the first assertion fail.

- [ ] **Step 3: Replace the three files**

Replace `skills/hsdd-summary/scripts/stamp.mjs` with:

```js
// Input stamps: which files a page was built from, and whether they changed.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { listMd } from "./extract-plan.mjs";
import { chainFiles, HISTORY } from "./extract-checkpoint.mjs";

export function fileHash(path) {
  return "sha256:" + createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Every file the plan page reads, relative to the project root, sorted.
export function planInputs(root) {
  const out = [];
  if (existsSync(join(root, "hsdd/conventions.md"))) out.push("hsdd/conventions.md");
  for (const dir of ["spec", "contract", "adr"]) for (const f of listMd(join(root, "hsdd", dir))) out.push(`hsdd/${dir}/${f}`);
  for (const f of ["glossary.json", "prose.json"]) if (existsSync(join(root, "hsdd/summary", f))) out.push(`hsdd/summary/${f}`);
  return out.sort();
}

// Every file the checkpoint page reads: the chain it walks (newest first,
// bounded), the atlas, the specs its status view names, and the prose store.
// A newer report or plan changes the set, so the page reads stale.
export function checkpointInputs(root) {
  const c = chainFiles(root);
  const out = [...c.progress.slice(0, HISTORY), ...c.plans.slice(0, HISTORY)];
  if (c.atlas) out.push(c.atlas);
  for (const p of planInputs(root)) if (!p.startsWith("hsdd/summary/")) out.push(p);
  if (existsSync(join(root, "hsdd/summary/checkpoint-prose.json"))) out.push("hsdd/summary/checkpoint-prose.json");
  return [...new Set(out)].sort();
}

export function hashInputs(root, paths) {
  return Object.fromEntries(paths.map((p) => [p, fileHash(join(root, p))]));
}

export function diffInputs(stamped, current) {
  const changed = [];
  const added = [];
  const removed = [];
  for (const [p, h] of Object.entries(current)) {
    if (!(p in stamped)) added.push(p);
    else if (stamped[p] !== h) changed.push(p);
  }
  for (const p of Object.keys(stamped)) if (!(p in current)) removed.push(p);
  return { changed, added, removed, fresh: !changed.length && !added.length && !removed.length };
}

// JSON that is safe inside a <script> element: no "<", ">", "&" or line
// separators survive literally, and JSON.parse still reads it back exactly.
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function readPageStamp(html) {
  const m = /<script type="application\/json" id="hsdd-stamp">([^<]*)<\/script>/.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
```

Replace `skills/hsdd-summary/scripts/html.mjs` with:

```js
// Assemble one offline HTML file: styles, the page data, the vendored layout
// engine, the view functions and the runtime, under a hash-based CSP.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { esc } from "./views-core.mjs";
import { safeJson } from "./stamp.mjs";
import { PLAN_AUDIENCES } from "./views-plan.mjs";
import { CHECKPOINT_AUDIENCES } from "./views-checkpoint.mjs";

const here = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

export const KINDS = {
  plan: {
    label: "Plan",
    files: ["views-core.mjs", "graph.mjs", "views-plan.mjs"],
    audiences: PLAN_AUDIENCES,
    render: "renderPlan",
    audienceConst: "PLAN_AUDIENCES",
    nav: [
      { label: "Plan", path: "", key: "t" },
      { label: "Contracts", path: "contracts", key: "c" },
      { label: "Decisions", path: "adrs", key: "d" },
    ],
  },
  checkpoint: {
    label: "Checkpoint",
    files: ["views-core.mjs", "graph.mjs", "views-checkpoint.mjs"],
    audiences: CHECKPOINT_AUDIENCES,
    render: "renderCheckpoint",
    audienceConst: "CHECKPOINT_AUDIENCES",
    nav: [
      { label: "Checkpoint", path: "", key: "t" },
      { label: "Findings", path: "findings", key: "f" },
      { label: "Build progress", path: "status", key: "s" },
    ],
  },
};

// An ES module as a classic-script fragment: drop import lines, unexport.
export function toClassic(src) {
  return src
    .split("\n")
    .filter((l) => !/^import\s/.test(l))
    .map((l) => l.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/, ""))
    .join("\n");
}

function cspHash(text) {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

function assertInlineSafe(name, text) {
  if (/<\/script|<!--/i.test(text)) throw new Error(`${name} contains "</script" or "<!--" and cannot be inlined`);
}

export function renderPage({ kind, page, stamp }) {
  const k = KINDS[kind];
  if (!k) throw new Error(`unknown page kind "${kind}"`);
  const css = here("./page.css");
  const dagre = here("./vendor/dagre.min.js");
  const keys = Object.fromEntries(k.nav.map((n) => [n.key, n.path]));
  const bundle = [
    ...k.files.map((f) => toClassic(here(`./${f}`))),
    `const PAGE_VIEWS = { audiences: ${k.audienceConst}, render: ${k.render}, keys: ${JSON.stringify(keys)} };`,
    here("./app.js"),
  ].join("\n");
  assertInlineSafe("vendor/dagre.min.js", dagre);
  assertInlineSafe("the view bundle", bundle);
  const csp = [
    "default-src 'none'",
    `script-src ${cspHash(dagre)} ${cspHash(bundle)}`,
    `style-src ${cspHash(css)}`,
    "img-src data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const title = `${page.project.name} · ${k.label}`;
  const nav = k.nav.map((n) => `<a data-nav="${esc(n.path)}" href="#">${esc(n.label)}<kbd>${esc(n.key)}</kbd></a>`).join("");
  const auds = k.audiences.map((a, i) => `<button type="button" data-audience="${esc(a)}" aria-pressed="${i === 0}">${esc(a)}<kbd>${i + 1}</kbd></button>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body>
<button type="button" class="skip" data-skip>Skip to the summary</button>
<header class="bar">
<div class="brand"><span class="mark">HSDD</span><strong>${esc(page.project.name)}</strong> <span class="muted">${esc(k.label)}</span></div>
<nav class="views" aria-label="Views">${nav}</nav>
<div class="audience" role="group" aria-label="Audience">${auds}</div>
<div class="tools"><button type="button" id="theme">Theme</button><button type="button" id="keys" aria-pressed="true">Shortcuts</button></div>
</header>
<nav id="crumbs" class="crumbs" aria-label="Breadcrumbs"></nav>
<main id="main" tabindex="-1"><noscript>This page draws itself with its own inline script. Open it in a browser with scripts enabled.</noscript></main>
<footer class="stamp">Generated ${esc(stamp.generated)} from spec ${esc(stamp.specSha)} · ${Object.keys(stamp.inputs).length} input files · derived, never edited: regenerate it with hsdd-summary.</footer>
<script type="application/json" id="hsdd-page">${safeJson(page)}</script>
<script type="application/json" id="hsdd-stamp">${safeJson(stamp)}</script>
<script>${dagre}</script>
<script>${bundle}</script>
</body>
</html>
`;
}
```

Replace `skills/hsdd-summary/scripts/summary.mjs` with:

```js
#!/usr/bin/env node
// hsdd-summary CLI: extract | validate | slots | lint | stamp | render | check.
// Run from the project root (the directory that holds hsdd/).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractPlan } from "./extract-plan.mjs";
import { crossCheckPlan } from "./checks-plan.mjs";
import { extractCheckpoint, chainFiles } from "./extract-checkpoint.mjs";
import { crossCheckCheckpoint } from "./checks-checkpoint.mjs";
import { plain } from "./md.mjs";
import { validate } from "./schema.mjs";
import { planSlots, planGlossaryKeys, checkpointSlots, emptyStore, seed, proseStatus, stampProse, lintProse, namesId } from "./prose.mjs";
import { planInputs, checkpointInputs, hashInputs, diffInputs, readPageStamp } from "./stamp.mjs";
import { renderPage } from "./html.mjs";

export const KINDS = {
  plan: {
    schema: "./plan-model.schema.json",
    page: "summary.html",
    prose: "prose.json",
    extract: (root, opts) => extractPlan(root, opts),
    check: crossCheckPlan,
    slots: planSlots,
    glossKeys: planGlossaryKeys,
    inputs: (root) => planInputs(root),
    extras: () => ({}),
    present: (root) => existsSync(join(root, "hsdd/spec")),
  },
  checkpoint: {
    schema: "./checkpoint-model.schema.json",
    page: "checkpoint.html",
    prose: "checkpoint-prose.json",
    extract: (root, opts) => extractCheckpoint(root, opts),
    check: crossCheckCheckpoint,
    slots: checkpointSlots,
    glossKeys: () => [],
    inputs: (root) => checkpointInputs(root),
    // The stakeholder sees a bottom-line row only when it names no id.
    extras: (model, checked) => ({
      computed: checked.computed,
      safe: { bottomLine: model.progress.bottomLine.map((r) => !/`/.test(r.value) && !namesId(plain(r.value), model.ids)) },
    }),
    present: (root) => existsSync(join(root, "hsdd/summary/checkpoint.html")) && chainFiles(root).progress.length > 0,
  },
};

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o") out.o = argv[++i];
    else if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true;
    else out._.push(a);
  }
  return out;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path} is not valid JSON: ${e.message}`);
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function specSha(root) {
  try {
    return execFileSync("git", ["-C", join(root, "hsdd"), "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "n/a";
  }
}

function defaultModel(kind) {
  return join(tmpdir(), `hsdd-summary-${kind}-model.json`);
}

function loadModel(a) {
  const path = a.model ?? defaultModel(a._[1] ?? "plan");
  const model = readJson(path, null);
  if (!model) throw new Error(`no model at ${path}; run extract first`);
  if (!KINDS[model.kind]) throw new Error(`${path} has kind "${model.kind}", which no page draws`);
  return { model, path };
}

// Each page has its own prose store, so writing one page's prose never makes
// the other page stale. The glossary belongs to the plan page.
function proseFiles(root, kind) {
  const dir = join(root, "hsdd/summary");
  return { prosePath: join(dir, KINDS[kind].prose), glossPath: join(dir, "glossary.json") };
}

function loadProse(root, kind) {
  const { prosePath, glossPath } = proseFiles(root, kind);
  const store = readJson(prosePath, emptyStore());
  const glossary = readJson(glossPath, { version: 1, entries: {} });
  if (!store || typeof store.entries !== "object") throw new Error(`${prosePath} has no "entries" object`);
  if (!glossary || typeof glossary.entries !== "object") throw new Error(`${glossPath} has no "entries" object`);
  return { store, glossary };
}

function schemaErrors(model) {
  const schema = JSON.parse(readFileSync(new URL(KINDS[model.kind].schema, import.meta.url), "utf8"));
  return validate(schema, model);
}

function list(label, items, max = 20) {
  if (!items.length) return;
  console.log(`${label} (${items.length}):`);
  for (const x of items.slice(0, max)) console.log(`  ${x}`);
  if (items.length > max) console.log(`  … ${items.length - max} more`);
}

export function main(argv, root = process.cwd()) {
  const a = args(argv);
  const cmd = a._[0];
  if (cmd === "extract") {
    const kind = a._[1] ?? "plan";
    if (!KINDS[kind]) throw new Error(`extract: unknown kind "${kind}"`);
    const model = KINDS[kind].extract(root, { specSha: specSha(root) });
    const path = a.model ?? defaultModel(kind);
    writeJson(path, model);
    console.log(`model: ${path}`);
    list("unparsed: fill each at its path from the source, then delete the entry", model.unparsed.map((u) => `${u.path}  ${u.file}:${u.line}  ${u.reason}`), 200);
    return 0;
  }
  if (cmd === "validate") {
    const { model } = loadModel(a);
    const se = schemaErrors(model);
    const { errors, findings } = KINDS[model.kind].check(model);
    list("schema errors", se, 200);
    list("errors", errors, 200);
    console.log(`findings: ${findings.length} (shown on the page)`);
    return se.length || errors.length ? 1 : 0;
  }
  if (cmd === "slots") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const { store, glossary } = loadProse(root, model.kind);
    const slots = k.slots(model);
    const keys = k.glossKeys(model);
    const seeded = seed(store, glossary, slots, keys);
    const { prosePath, glossPath } = proseFiles(root, model.kind);
    writeJson(prosePath, seeded.store);
    if (keys.length) writeJson(glossPath, seeded.glossary);
    const st = proseStatus(seeded.store, seeded.glossary, slots, keys, model.kind);
    const limit = new Map(slots.map((s) => [s.key, s]));
    list("write first: empty required slots", st.emptyRequired.map((x) => `${x} (max ${limit.get(x).limit} words, no ids)`), 500);
    list("glossary entries to write (a few plain words each)", st.glossEmpty, 500);
    list("stale: the subject changed; rewrite", st.stale, 500);
    list("unstamped: rewritten but not stamped", st.unstamped, 500);
    list("orphaned: subject gone; ask before deleting", [...st.orphaned, ...st.glossOrphaned.map((g) => `glossary:${g}`)], 500);
    console.log(`optional slots empty: ${st.emptyOptional.length}`);
    return 0;
  }
  if (cmd === "lint") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const { store, glossary } = loadProse(root, model.kind);
    const f = lintProse(store, glossary, k.slots(model), k.glossKeys(model), model.ids);
    list("readability findings", f.map((x) => `${x.key}: ${x.message}`), 500);
    if (!f.length) console.log("lint: clean");
    return 0;
  }
  if (cmd === "stamp") {
    if (a._.some((x) => /\.html?$/i.test(x)) || (a.o && /\.html?$/i.test(a.o))) throw new Error("stamp: pages are stamped by render, never by hand");
    const { model } = loadModel(a);
    const { store } = loadProse(root, model.kind);
    const { store: s, restamped } = stampProse(store, KINDS[model.kind].slots(model));
    writeJson(proseFiles(root, model.kind).prosePath, s);
    list("restamped", restamped, 500);
    if (!restamped.length) console.log("stamp: nothing rewritten since the last stamp");
    return 0;
  }
  if (cmd === "render") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const se = schemaErrors(model);
    const checked = k.check(model);
    const { errors, findings } = checked;
    if (se.length || errors.length) throw new Error(`render: the model does not validate (${[...se, ...errors][0]}); run validate`);
    const { store, glossary } = loadProse(root, model.kind);
    const slots = k.slots(model);
    const keys = k.glossKeys(model);
    const st = proseStatus(store, glossary, slots, keys, model.kind);
    if (st.emptyRequired.length || st.glossEmpty.length) throw new Error(`render: ${st.emptyRequired.length + st.glossEmpty.length} required slot(s) are empty (first: ${[...st.emptyRequired, ...st.glossEmpty][0]}); run slots`);
    const out = resolve(root, a.o ?? join("hsdd/summary", k.page));
    if (relative(join(root, "hsdd/summary"), out).startsWith("..")) throw new Error("render: the page must be written under hsdd/summary/");
    const generated = new Date().toISOString().slice(0, 10);
    const page = {
      kind: model.kind,
      project: model.project,
      model,
      prose: Object.fromEntries(Object.entries(store.entries).map(([key, e]) => [key, e.text])),
      gloss: glossary.entries,
      findings,
      readability: lintProse(store, glossary, slots, keys, model.ids),
      generated,
      ...k.extras(model, checked),
    };
    const stamp = { kind: model.kind, generated, specSha: model.project.specSha, inputs: hashInputs(root, k.inputs(root, model)) };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderPage({ kind: model.kind, page, stamp }));
    console.log(`wrote ${relative(root, out)} (${findings.length} findings, ${page.readability.length} readability notes)`);
    return 0;
  }
  if (cmd === "check") {
    const dir = join(root, "hsdd/summary");
    const pages = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".html")).sort() : [];
    if (!pages.length) console.log("check: no pages under hsdd/summary/");
    for (const f of pages) {
      const stamp = readPageStamp(readFileSync(join(dir, f), "utf8"));
      if (!stamp || !KINDS[stamp.kind]) {
        console.log(`${f}: no readable stamp; regenerate it`);
        continue;
      }
      const d = diffInputs(stamp.inputs, hashInputs(root, KINDS[stamp.kind].inputs(root)));
      console.log(`${f}: ${d.fresh ? "fresh" : "stale"}`);
      for (const [label, xs] of [["changed", d.changed], ["added", d.added], ["removed", d.removed]]) if (xs.length) console.log(`  ${label}: ${xs.join(", ")}`);
    }
    const models = [];
    for (const [kind, k] of Object.entries(KINDS)) {
      try {
        if (k.present(root)) models.push(k.extract(root, {}));
      } catch (e) {
        console.log(`cannot re-extract ${kind} to check prose: ${e.message}`);
      }
    }
    for (const model of models) {
      try {
        const k = KINDS[model.kind];
        const { store, glossary } = loadProse(root, model.kind);
        const st = proseStatus(store, glossary, k.slots(model), k.glossKeys(model), model.kind);
        list(`stale ${model.kind} prose entries`, st.stale);
        list(`unstamped ${model.kind} prose entries`, st.unstamped);
      } catch (e) {
        console.log(`prose store unreadable: ${e.message}`);
      }
    }
    return 0;
  }
  console.log("usage: summary.mjs extract plan|checkpoint | validate | slots | lint | stamp | render [-o hsdd/summary/x.html] | check   [--model path]");
  return cmd ? 2 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Run the whole suite**

Run: `node --test test/*.test.mjs`
Expected: PASS, 111 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/scripts/stamp.mjs skills/hsdd-summary/scripts/html.mjs skills/hsdd-summary/scripts/summary.mjs test/cli-checkpoint.test.mjs
git commit -m "feat(hsdd-summary): render and check the checkpoint page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 6: Check the checkpoint page in a real browser

**Files:**
- Modify: any file under `skills/hsdd-summary/scripts/` only if this check exposes a defect (test-first: the failing assertion in the owning test file, then the fix).

- [ ] **Step 1: Render the fixture's checkpoint page in a scratch copy**

```bash
rm -rf /tmp/hsdd-cp && mkdir -p /tmp/hsdd-cp && cp -R test/fixtures/tree/hsdd /tmp/hsdd-cp/
cd /tmp/hsdd-cp
S=~/git/hsdd/skills/hsdd-summary/scripts/summary.mjs
node $S extract checkpoint --model cp.json
node -e 'const f=require("fs");const m=JSON.parse(f.readFileSync("cp.json"));m.plan.steps[1].lanes=["API","Web"];m.unparsed=[];f.writeFileSync("cp.json",JSON.stringify(m))'
node $S slots checkpoint --model cp.json > /dev/null
node -e 'const f=require("fs");const p="hsdd/summary/checkpoint-prose.json";const s=JSON.parse(f.readFileSync(p));for(const k in s.entries)s.entries[k].text="Plain words for whoever reads this.";f.writeFileSync(p,JSON.stringify(s))'
node $S stamp checkpoint --model cp.json > /dev/null && node $S render checkpoint --model cp.json && node $S check
cd ~/git/hsdd
```

Expected: `wrote hsdd/summary/checkpoint.html (1 findings, …)` (the orphan F-6) and `checkpoint.html: fresh`.

- [ ] **Step 2: Run each audience and route in headless Chrome**

Serve `/tmp/hsdd-cp/hsdd` (`python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/hsdd-cp/hsdd`) and dump the DOM, as in Plan B Task 10, for `""`, `#lead/sync/A`, `#executor/lane/API`, `#lead/step/C-6`, `#lead/finding/F-6`, `#lead/status`, `#stakeholder`:

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # or google-chrome on Linux
"$CH" --headless=new --disable-gpu --no-first-run --user-data-dir=/tmp/hsdd-chrome \
  --virtual-time-budget=4000 --enable-logging=stderr --v=0 \
  --dump-dom "http://127.0.0.1:8765/summary/checkpoint.html$HASH" 2>/tmp/hsdd-chrome.log \
  | grep -c 'class="box '
grep -i -E 'uncaught|refused to|violates' /tmp/hsdd-chrome.log
```

Expected box counts: the top 6 (Sync A and five steps), `#lead/status` 4 (the root and its three active parts), every other route 0. The log `grep` prints nothing.

- [ ] **Step 3: Look at it**

Open `/tmp/hsdd-cp/hsdd/summary/checkpoint.html` from disk. Confirm by eye: the milestone bars line up in one column; M1 shows ▲; the plan graph draws Sync A as a junction; F-3 shows "3 reports running"; the executor's API lane lists C-5 before B-1 and its Copy button copies the prompt; Plan integrity lists F-6; the stakeholder view shows the verdict, the Calendar outlook tile but not the Remaining tile, and no step, finding or decision id.

- [ ] **Step 4: Commit (only if Steps 2 or 3 led to a fix)**

```bash
git add skills/hsdd-summary/scripts test
git commit -m "fix(hsdd-summary): what the checkpoint page's browser check exposed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 7: The skill text for the checkpoint page

**Files:**
- Replace: `skills/hsdd-summary/SKILL.md`

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-summary-c.sh <<'EOF'
s=skills/hsdd-summary/SKILL.md
fail=0
for need in "checkpoint.html" "## Process (checkpoint page)" "extract checkpoint" "checkpoint-prose.json" "cp:verdict" "cp:milestone:{id}" "cp:blocker:{rank}" "## What the Checkpoint Page Shows" "| \`lead\` (default) |" "| \`executor\` |"; do
  grep -qF -- "$need" "$s" || { echo "MISSING: $need"; fail=1; }
done
grep -q $'\xe2\x80\x94' "$s" && { echo "EM-DASH"; fail=1; }
exit $fail
EOF
bash /tmp/hsdd-v09-summary-c.sh
```

Expected: FAIL with the `MISSING` lines.

- [ ] **Step 2: Replace the skill**

Replace `skills/hsdd-summary/SKILL.md` with:

````markdown
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
| Plan page | `hsdd/summary/summary.html` | `hsdd/spec/`, `hsdd/contract/`, `hsdd/adr/`, `hsdd/conventions.md`, `glossary.json`, `prose.json` | after each `hsdd-spec` level and each phase plan, so the reviewer opens it in the same MR |
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
  tree arrive from one "Outside the tree" box.
- **A leaf-parent's phases** are coloured by review tier, joined by their
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
````

- [ ] **Step 3: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-summary-c.sh`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add skills/hsdd-summary/SKILL.md
git commit -m "feat(hsdd-summary): the checkpoint page's process, audiences and prose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 8: `hsdd-checkpoint` renders the page, gated on `hsdd/summary/`

**Files:**
- Modify: `skills/hsdd-checkpoint/SKILL.md` (step 3, a new step 7, steps 7 and 8 renumbered to 8 and 9, the progress report header shape, the read-only section, two quality gates, one anti-rationalization row)

**Interfaces:**
- Consumes: the `hsdd-summary` skill (Task 7).
- Produces: the gated step. Nothing calls step numbers of this skill by number elsewhere in the repository.

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-ckpt-c.sh <<'EOF'
s=skills/hsdd-checkpoint/SKILL.md
fail=0
flat=$(tr '\n' ' ' < "$s" | tr -s ' ')
for need in "7. **Render the checkpoint page (only when \`hsdd/summary/\` exists).**" "9. **Land the output.**" "**Stale summaries:**" "runs no \`hsdd-summary\` script" "plus \`hsdd/summary/\` through" "The checkpoint page shows a Plan integrity finding"; do
  printf '%s' "$flat" | grep -qF -- "$need" || { echo "MISSING: $need"; fail=1; }
done
[ "$(grep -c '^[0-9]\. \*\*' "$s")" -ge 12 ] || { echo "STEPS NOT RENUMBERED"; fail=1; }
git diff -U0 "$s" | grep '^+' | grep -q $'\xe2\x80\x94' && { echo "EM-DASH added"; fail=1; }
exit $fail
EOF
bash /tmp/hsdd-v09-ckpt-c.sh
```

Expected: FAIL with the `MISSING` lines.

- [ ] **Step 2: Apply the edits**

Save this script as `/tmp/hsdd-v09-ckpt-edit.py` and run `python3 /tmp/hsdd-v09-ckpt-edit.py skills/hsdd-checkpoint/SKILL.md`. Each edit asserts its anchor exists exactly once, so a drifted file fails loudly instead of being edited in the wrong place.

```python
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
edits = [
(
"""   repo's main branch. Claims without a verification doc are reported as
   claims.
4. **Revise the execution plan**""",
"""   repo's main branch. Claims without a verification doc are reported as
   claims.

   If `hsdd/summary/` exists, run `node hsdd/scripts/summary/summary.mjs
   check` and list the stale plan page and stale prose entries on the
   report's `**Stale summaries:**` header line (`none` when all are fresh).
   They are information only: never a findings-register entry, never a plan
   step, never a gate.
4. **Revise the execution plan**""",
),
(
"""   compare it against the previous report's \u2014 two consecutive reds fire the
   trigger.
7. **Report** with the same discipline""",
"""   compare it against the previous report's \u2014 two consecutive reds fire the
   trigger.
7. **Render the checkpoint page (only when `hsdd/summary/` exists).** Invoke
   `hsdd-summary` and follow its Process (checkpoint page) over the documents
   this run just wrote. If the page reports a Plan integrity finding (a
   finding with no step and no waiver, a step with no detail block, a
   Depends entry that resolves to nothing), this run's own quality gate
   failed: fix the new plan, then render again. A project without
   `hsdd/summary/` skips this step entirely and runs no `hsdd-summary`
   script.
8. **Report** with the same discipline""",
),
(
"""8. **Land the output.** Commit the `hsdd/management/` changes.""",
"""9. **Land the output.** Commit the `hsdd/management/` changes, and
   `hsdd/summary/` when step 7 ran, in the same commit.""",
),
(
"""  filename), `**Repo baselines:**`, `**Companion docs:**`, `**Method:**` (one
  line: which repos were reviewed, against what).""",
"""  filename), `**Repo baselines:**`, `**Companion docs:**`, `**Method:**` (one
  line: which repos were reviewed, against what). When `hsdd/summary/`
  exists, an optional `**Stale summaries:**` line (step 3).""",
),
(
"""to the owning skill and the owning human. The only files this skill
writes live under `hsdd/management/`.""",
"""to the owning skill and the owning human. The only files this skill
writes live under `hsdd/management/`, plus `hsdd/summary/` through
`hsdd-summary` when that directory exists (step 7).""",
),
(
"""- [ ] No file outside `hsdd/management/` modified.""",
"""- [ ] No file outside `hsdd/management/` modified, except `hsdd/summary/`
      through step 7.
- [ ] When `hsdd/summary/` exists: the Stale summaries line is filled, the
      checkpoint page rendered with no Plan integrity finding, and it landed
      with the management documents. When it does not exist: no
      `hsdd-summary` script ran.""",
),
]
for old, new in edits:
    assert s.count(old) == 1, "anchor not found exactly once: " + old[:60]
    s = s.replace(old, new, 1)
row = '| "The checkpoint page shows a Plan integrity finding; I\'ll mention it in the report" | It is this run\'s own quality gate failing, read back by a script. Fix the plan, render again, then land. |\n'
s = s.rstrip("\n") + "\n" + row
open(p, "w", encoding="utf-8").write(s)
print("hsdd-checkpoint: 6 edits and 1 row applied")
```

Expected output: `hsdd-checkpoint: 6 edits and 1 row applied`.

- [ ] **Step 3: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-ckpt-c.sh`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add skills/hsdd-checkpoint/SKILL.md
git commit -m "feat(hsdd-checkpoint): render the checkpoint page when hsdd/summary/ exists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 9: The checkpoint page in the specification

**Files:**
- Modify: `spec/hsdd-spec-v0_9.md` (§1.5, §12.3, §12.7, new §13.4, §14.1, §18.1, §19)

**Interfaces:**
- Consumes: the file after Plan A Task 2 and Plan B Task 12 (§13.3 exists).

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-spec-c.sh <<'EOF'
f=spec/hsdd-spec-v0_9.md
flat=$(tr '\n' ' ' < "$f" | tr -s ' ')
fail=0
for need in "### 13.4 The checkpoint page" "and the checkpoint page" "an optional \`**Stale summaries:**\` line" "7. **Renders the checkpoint page**" "plus \`summary/\` through \`hsdd-summary\`" "checkpoint.html" "checkpoint-prose.json" "| Checkpoint page |" "| Prose stores |" "- **Checkpoint page:**" "- **Carried age:**"; do
  printf '%s' "$flat" | grep -qF -- "$need" || { echo "MISSING: $need"; fail=1; }
done
python3 /tmp/hsdd-v09-refs.py "$f" > /dev/null || { echo "REFS BROKEN"; fail=1; }
git diff -U0 "$f" | grep '^+' | grep -q $'\xe2\x80\x94' && { echo "EM-DASH added"; fail=1; }
exit $fail
EOF
bash /tmp/hsdd-v09-spec-c.sh
```

Expected: FAIL with the `MISSING` lines.

- [ ] **Step 2: Make the edits**

**2a. §1.5**: replace the `hsdd-summary` row (added by Plan B) with:

```markdown
| `hsdd-summary` | Render optional reading aids over the canonical artifacts: the plan page, an offline HTML view of the tree from the root down to the phase cards, and the checkpoint page, over the newest progress report and execution plan (chapter 13). | `hsdd/summary/*.html` |
```

**2b. §12.3**: in the Header block bullet, replace the text that starts at ``and `**Method:**` `` and ends at `naming what was actually reviewed.` (the end of that bullet) with:

```markdown
and `**Method:**`, one line naming what was actually reviewed; when
  `hsdd/summary/` exists, an optional `**Stale summaries:**` line (chapter
  13), information only.
```

**2c. §12.7**: after the numbered item `6. **Ticks the milestone gates** …` (its last line ends `it fires.`), add:

```markdown
7. **Renders the checkpoint page**, only when `hsdd/summary/` exists
   (§13.4). A Plan integrity finding on the page is this run's own quality
   gate failing: the run fixes its plan, renders again, and lands the page
   with the management documents. A project without `hsdd/summary/` runs no
   `hsdd-summary` script.
```

and replace the last sentence of §12.7, `The only files it\nwrites are \`management/\` files.` (match across the break), with `The only files it writes are \`management/\` files, plus \`summary/\` through \`hsdd-summary\` when that directory exists.`

**2d. Chapter 13**: after §13.3's last paragraph and before the chapter's closing `---`, insert:

```markdown
### 13.4 The checkpoint page

`hsdd/summary/checkpoint.html`, rendered by `hsdd-checkpoint`'s gated step
(§12.7) from the newest progress report and execution plan, the eight newest
of each behind them, the atlas, the node names under `hsdd/spec/`, and its
own prose store, `checkpoint-prose.json`. Like the atlas it is living: the
filename carries no date, the stamp names the files it read, and a newer
report or plan makes it stale.

- **Extraction** reads what §12.3 and §12.4 fix: the header lines, the
  Bottom line table and the one-sentence read, the Milestone gate status
  table with each cell split into met and unmet items, the Blockers, the
  findings register and the Verdict; the Ownership split's lanes, the Sync
  points table, every sync section's Entry, Agenda decisions, Exit and
  Unblocks (marked by `###` headings or bold labels, with decisions as led
  paragraphs or as a table), every table with ID, Owner and Action columns,
  the waivers, and each step's detail block; the atlas's per-node counts. A
  step whose owner names no lane is an unparsed item. The plan's Mermaid
  graph is never parsed.
- **Computed by the script:** the findings-to-plan loop (each finding's
  landing steps or its waiver); how many consecutive registers each finding
  has appeared in, and how many consecutive plans each step has stayed
  open; the previous plan's steps carried into this one and those no longer
  in it (ticks are not trusted, because plans are often left unticked); each
  milestone's movement since the previous report; and the plan graph,
  recomputed from Depends cells and each sync's Entry and Unblocks lines,
  with steps batched by lane and depth above 20 boxes and an ordered list
  above 20 batches.
- **Plan integrity** shows, as information, what `hsdd-checkpoint`'s
  quality gates check: a finding with no step and no waiver, a step with no
  detail block, a Depends entry that resolves to nothing, a decision defined
  twice. A checkpoint run that sees one fixes its plan before landing.
- **Three audiences.** The lead (default) gets the read, the bottom line,
  the gates, the syncs, the plan graph, the blockers, the findings with
  their ages, and the delta; a sync opens to its Entry, decisions, Exit and
  Unblocks. The executor picks a lane and reads its steps in run order, with
  every prompt and briefing in full. The stakeholder reads a 60-word
  verdict, the bottom-line rows that name no id, each milestone with a
  25-word plain explanation, and a 25-word gist per blocker.

A count the page computes can differ from a report's prose ("tenth day",
"third consecutive pass"): prose may count days or the underlying problem,
while the page counts register rows. Neither is edited to match the other.
```

**2e. §14.1 layout `text` block**: after the line `    glossary.json               # plain words for contract ids` (added by Plan B), add:

```text
    checkpoint.html             # the checkpoint page (hsdd-summary, via hsdd-checkpoint)
    checkpoint-prose.json       # its stakeholder prose
```

**2f. §18.1**: append the rows

```markdown
| Checkpoint page | A living reading aid over the newest management documents, first for the lead running the sync; ages, the loop, the delta, gate movement and the plan graph computed by script (§13.4). | reasoned-only |
| Prose stores | One per page (`prose.json`, `checkpoint-prose.json`), so writing one page's prose never makes another stale (§13.2). | reasoned-only |
```

**2g. §19**: append

```markdown
- **Checkpoint page:** the reading aid over the newest progress report and
  execution plan, rendered by `hsdd-checkpoint`'s gated step (§13.4).
- **Carried age:** the number of consecutive progress-report registers a
  finding has appeared in, counted by script (§13.4).
```

- [ ] **Step 3: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-spec-c.sh`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add spec/hsdd-spec-v0_9.md
git commit -m "spec(v0.9): the checkpoint page and hsdd-checkpoint's gated step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 10: README, users guide, CHANGELOG

**Files:**
- Modify: `README.md`, `docs/users-guide.md`, `CHANGELOG.md`

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-docs.sh <<'EOF'
fail=0
need() { tr '\n' ' ' < "$1" | tr -s ' ' | grep -qF -- "$2" || { echo "MISSING in $1: $2"; fail=1; }; }
need README.md "All eleven HSDD skills"
need README.md "| \`hsdd-summary\` |"
need README.md "OpenSpec or superpowers"
need docs/users-guide.md "--method superpowers"
need docs/users-guide.md "### Reading aids"
need docs/users-guide.md "checkpoint.html"
need CHANGELOG.md "## [Unreleased]"
need CHANGELOG.md "hsdd-summary"
for f in README.md docs/users-guide.md CHANGELOG.md; do git diff -U0 "$f" | grep '^+' | grep -q $'\xe2\x80\x94' && { echo "EM-DASH added in $f"; fail=1; }; done
exit $fail
EOF
bash /tmp/hsdd-v09-docs.sh
```

Expected: FAIL with the `MISSING` lines.

- [ ] **Step 2: README.md**

1. Replace `# All ten HSDD skills (replace with your repo path)` with `# All eleven HSDD skills (replace with your repo path)`.
2. Replace `` `hsdd-config` wires them into each OpenSpec cycle. `` with `` `hsdd-config` wires them into each phase's coding session, OpenSpec or superpowers. ``
3. Replace the `hsdd-config` row of the skill table with:

```markdown
| `hsdd-config` | Before each phase, write one self-contained phase context (the phase, the text of the contracts it touches, its decisions, pinned links) and wrap it for the project's coding method: OpenSpec's `config.yaml`, or a spec for superpowers' `writing-plans`. |
```

4. Add this row after the `hsdd-milestone` row:

```markdown
| `hsdd-summary` | Render offline HTML reading aids: the plan page (root to phase cards, for a reviewer, a stakeholder or an implementer) and the checkpoint page (the newest progress report and execution plan, for the lead running the sync, each lane's executor, and stakeholders). |
```

- [ ] **Step 3: docs/users-guide.md**

1. In Example 2, Step 5, after the `yaml` block and before `### Step 6`, insert:

````markdown
The same switch writes `hsdd-context/acme.backend.auth.2.md` first: the
method-neutral phase context that the `config.yaml` block above is copied
from, word for word. A team on superpowers instead of OpenSpec runs:

```text
You: "/hsdd-phase acme.backend.auth.2 --method superpowers"
```

and starts the phase's session with
`Use superpowers:writing-plans to plan hsdd-context/superpowers/acme.backend.auth.2.md`.
The file's Global Constraints carry test-first, the task cap, the gate and
the verification doc into every task `subagent-driven-development` runs.
Set `**Coding method:** superpowers` in `hsdd/conventions.md` to make it the
default.
````

2. In `## Running the project`, after the `### The weekly checkpoint` subsection and before `### Milestones`, insert:

````markdown
### Reading aids

Two optional pages, both one offline HTML file under `hsdd/summary/`, both
derived and never edited:

- **The plan page** (`summary.html`): the tree from the root's parts down to
  each phase's card, with What to check at every level, for a reviewer, a
  stakeholder or an implementer. Render it after a spec level or a phase
  plan, so the reviewer opens it in the same MR:

  > `/hsdd-summary` render the plan page.

- **The checkpoint page** (`checkpoint.html`): the newest progress report
  and execution plan laid out for the sync. The lead sees the read, the
  gates and their movement, the syncs, the plan graph, the blockers, and
  how long each finding has been carried; each executor picks a lane and
  works its steps in order, copying prompts from the page; stakeholders see
  the verdict and the milestones in plain words. Once `hsdd/summary/`
  exists, every checkpoint renders it as its last step before landing.

`/hsdd-summary` check lists any page or prose that has gone stale.
````

- [ ] **Step 4: CHANGELOG.md**

Insert directly above `## [0.8.0] - 2026-08-03`:

```markdown
## [Unreleased]

Targets 0.9.0. Design:
`docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md`.
Acceptance: `review/hsdd-v0_9-acceptance.md`.

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
  `hsdd/summary/` exists, a gated step renders the checkpoint page.
- The invariant "one phase = one OpenSpec change" reads "one phase = one
  coding cycle"; the atlas non-goal is narrowed, not reversed.
```

- [ ] **Step 5: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-docs.sh`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/users-guide.md CHANGELOG.md
git commit -m "docs(v0.9): README, users guide and CHANGELOG for phase contexts and reading aids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 11: Commit the C1 to C3 acceptance expectations before any run

**Files:**
- Modify: `review/hsdd-v0_9-acceptance.md`

The values below were computed by the scripts from the field project's chain whose newest documents are the 2026-09-18 progress report and execution plan. If newer documents exist when the run happens, run against a scratch copy of the project with them removed.

- [ ] **Step 1: Append section C**

Append to `review/hsdd-v0_9-acceptance.md`:

```markdown

## C. The checkpoint page

### C1. The page renders the field project's chain, with the computed values pinned

- **Run:** in an implementation repo, with the v0.9 skills installed and
  `hsdd/summary/` present, `hsdd-summary`'s Process (checkpoint page)
  against the chain whose heads are the 2026-09-18 report and plan.
- **Expected:**
  - Exactly two unparsed items, both a step owned by "both" (C-90, G-24),
    filled from the plan's Operating model.
  - `validate checkpoint` exits 0 with no integrity finding.
  - Carried ages: F-189 and F-195 at 2 consecutive registers; F-206 at 1.
  - Step I-2 open in 2 consecutive plans.
  - Delta against the 2026-09-15 plan: 1 step carried (I-2), 21 no longer
    present.
  - M4 6 / 6 up from 5 / 6; M5 6 / 10 up from 5 / 9; M6 2 / 8 up from
    0 / 6; M7 0 / 6 shown as new.
  - The plan graph: 21 nodes, drawn as 14 boxes (steps batched by lane and
    depth), with Sync Y and Sync Z as junctions.
  - `check` reports `checkpoint.html: fresh`, and the plan page's state is
    unchanged by the run.
- **Result:**

### C2. Inverted: known defects are not shown as clean

- **Expected:** Build progress shows the backend gateway node flagged (the
  atlas marks its count); the lead's Findings list shows F-189 and F-195 as
  running for 2 reports; I-2 carries "open in 2 plans".
- **Fails if:** any of the three appears clean.
- **Result:**

### C3. A tree without `hsdd/summary/` is untouched

- **Run:** `/hsdd-checkpoint` on a project with no `hsdd/summary/`.
- **Expected:** no `**Stale summaries:**` line, no page, no `hsdd-summary`
  script run; the management documents have v0.8's shapes.
- **Result:**
```

- [ ] **Step 2: Verify**

Run: `grep -c '^### C[1-3]\.' review/hsdd-v0_9-acceptance.md && grep -c $'\xe2\x80\x94' review/hsdd-v0_9-acceptance.md`
Expected: `3` then `0`.

- [ ] **Step 3: Commit**

```bash
git add review/hsdd-v0_9-acceptance.md
git commit -m "review(v0.9): C1-C3 acceptance expectations, recorded before the run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 12: The acceptance run (operator, cold context)

**Files:**
- Modify: `review/hsdd-v0_9-acceptance.md` (the `Result:` lines and a verdict), `CHANGELOG.md` (the acceptance line)

This task is the operator's. An agent that helped write the skills proves nothing about them, so the run happens in a session that has not seen this work.

- [ ] **Step 1: Install the branch's skills into the cold-context profile**

```bash
cp -R ~/.claude-work/skills ~/.claude-work/skills.pre-v0_9.bak
for s in hsdd-config hsdd-checkpoint hsdd-summary; do rm -rf ~/.claude-work/skills/$s && cp -R skills/$s ~/.claude-work/skills/; done
cp commands/hsdd-phase.md commands/hsdd-summary.md ~/.claude-work/commands/ 2>/dev/null || true
```

- [ ] **Step 2: Run A1 to A4, B1 and B2, C1 to C3**

In a fresh `claude-work` session per criterion, follow each criterion's **Run** line exactly as written in `review/hsdd-v0_9-acceptance.md`. Do not paste expectations into the session.

- [ ] **Step 3: Record**

Under each criterion's `Result:` write PASS or FAIL, the date, and the evidence (a file path, a command and its output, or a screenshot path). A FAIL is recorded as a FAIL; the fix becomes a new task, and the criterion is re-run after it. Add a closing `## Verdict` paragraph: how many criteria passed, and any deviation recorded rather than argued away.

- [ ] **Step 4: Point the CHANGELOG at the result**

In `CHANGELOG.md`'s `[Unreleased]` section, replace `Acceptance: \`review/hsdd-v0_9-acceptance.md\`.` with `Acceptance: \`review/hsdd-v0_9-acceptance.md\` ({n}/9 criteria PASS).`, `{n}` filled.

- [ ] **Step 5: Commit**

```bash
git add review/hsdd-v0_9-acceptance.md CHANGELOG.md
git commit -m "review(v0.9): acceptance record

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
