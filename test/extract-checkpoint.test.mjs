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
