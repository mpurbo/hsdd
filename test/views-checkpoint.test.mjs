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

const extraStep = (id, lane, depends) => ({ id, owner: lane, mode: "delegate", lanes: [lane], action: `Do ${id}.`, depends, findings: [], done: false, group: "Z · bulk", line: 900 });

test("a plan graph too big to draw says so and keeps one diagram", () => {
  const m = completedCheckpoint();
  for (let i = 1; i <= 25; i++) m.plan.steps.push(extraStep(`Z-${i}`, "API", "none"));
  const v = renderCheckpoint(checkpointPage(m), { audience: "lead", view: "top" });
  assert.match(v.body, /are too many to draw one by one/);
  assert.equal(v.diagrams.length, 1);
});

test("a plan graph too big even when grouped lists its steps in order", () => {
  const m = completedCheckpoint();
  for (let i = 1; i <= 30; i++) m.plan.steps.push(extraStep(`Z-${i}`, "API", i === 1 ? "none" : `Z-${i - 1}`));
  const v = renderCheckpoint(checkpointPage(m), { audience: "lead", view: "top" });
  assert.equal(v.diagrams.find((d) => d.id === "plan"), undefined);
  assert.match(v.body, /too many to draw even when grouped/);
  assert.match(v.body, /Order of work/);
});

test("a status view with more children than fit draws a list, not a diagram", () => {
  const m = completedCheckpoint();
  const root = m.project.root;
  const rootNode = m.tree.find((n) => n.id === root);
  for (let k = 1; k <= 13; k++) {
    const id = `${root}.k${k}`;
    m.tree.push({ id, name: `Part ${k}`, parent: root, children: [], kind: "leaf-parent", status: "active" });
    rootNode.children.push(id);
  }
  const lead = renderCheckpoint(checkpointPage(m), { audience: "lead", view: "status" });
  assert.deepEqual(lead.diagrams, []);
  assert.match(lead.body, /16 children are too many to draw/);
  const stake = renderCheckpoint(checkpointPage(m), { audience: "stakeholder", view: "status" });
  assert.deepEqual(stake.diagrams, []);
  assert.match(stake.body, /16 parts are too many to draw as one picture/);
  assert.equal(namesId(visibleText(stake), m.ids), null);
});
