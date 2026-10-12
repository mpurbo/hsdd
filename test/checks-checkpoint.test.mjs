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
