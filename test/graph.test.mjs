import { test } from "node:test";
import assert from "node:assert/strict";
import { completedModel } from "./helpers/plan-fixture.mjs";
import { childGraph, phaseGraph, layers, subtree, producers, OUTSIDE, ELSEWHERE, MAX_BOXES } from "../skills/hsdd-summary/scripts/graph.mjs";

const model = completedModel();

test("subtree and producers", () => {
  assert.deepEqual([...subtree(model, "acme.web")].sort(), ["acme.web", "acme.web.console"]);
  assert.deepEqual([...producers(model).get("auth-token")], ["acme.api"]);
});

test("childGraph at the root: retired nodes hidden, edges from contracts, external box", () => {
  const g = childGraph(model, "acme");
  assert.deepEqual(g.boxes, ["acme.api", "acme.ops", "acme.web"]);
  const e = g.edges.map((x) => `${x.from}>${x.to} ${x.kind} ${x.refs.join(",")}`).sort();
  assert.deepEqual(e, [
    `${OUTSIDE}>acme.api contract user-store@v1`,
    "acme.api>acme.web contract auth-token@v1,session@v1",
  ]);
  assert.equal(g.outside, true);
  assert.equal(g.elsewhere, false);
});

test("childGraph on a non-root page: contracts produced elsewhere in the tree arrive from ELSEWHERE", () => {
  const g = childGraph(model, "acme.web");
  assert.deepEqual(g.boxes, ["acme.web.console"]);
  assert.equal(g.elsewhere, true);
  assert.equal(g.outside, false);
  assert.equal(g.edges.length, 1);
  const [e] = g.edges;
  assert.equal(e.from, ELSEWHERE);
  assert.equal(e.to, "acme.web.console");
  assert.ok(e.refs.includes("auth-token@v1"));
  assert.ok(e.refs.includes("session@v1"));
});

test("phaseGraph: dependency edges, ordered collisions counted, cross-node listed", () => {
  const g = phaseGraph(model, "acme.api");
  assert.deepEqual(g.edges.map((e) => `${e.from}>${e.to}`), ["acme.api.1>acme.api.2", "acme.api.2>acme.api.3"]);
  assert.deepEqual(g.collisions, []);
  assert.equal(g.orderedCollisions, 1);
  assert.deepEqual(g.steps, [["acme.api.1"], ["acme.api.2"], ["acme.api.3"]]);
  assert.equal(g.collapsed, false);
  assert.deepEqual(phaseGraph(model, "acme.web.console").cross, [{ phase: "acme.web.console.2", on: "acme.api.2" }]);
});

test("phaseGraph: an unordered collision is drawn", () => {
  const m = structuredClone(model);
  m.phases[2].dependsOn = ["acme.api.1"];
  const g = phaseGraph(m, "acme.api");
  assert.deepEqual(g.collisions, [{ from: "acme.api.2", to: "acme.api.3", kind: "collides" }]);
  assert.equal(g.orderedCollisions, 0);
});

test("layers: longest path, independent of input order", () => {
  const deps = { a: [], b: ["a"], c: ["a"], d: ["b", "c"], e: [] };
  assert.deepEqual(layers(["d", "c", "b", "a", "e"], (x) => deps[x]), [["a", "e"], ["c", "b"], ["d"]]);
});

test("phaseGraph collapses above the box limit", () => {
  const m = structuredClone(model);
  for (let i = 4; i <= MAX_BOXES + 2; i++) {
    m.phases.push({ ...m.phases[0], id: `acme.api.${i}`, n: i, heading: `api.${i}`, dependsOn: [`acme.api.${i - 1}`], collidesWith: [] });
  }
  assert.equal(phaseGraph(m, "acme.api").collapsed, true);
});
