import { test } from "node:test";
import assert from "node:assert/strict";
import { sealTree } from "./helpers/seal-fixture.mjs";
import { readTree } from "../skills/hsdd-seal/scripts/lib/scan.mjs";
import { classify, buildPlan, renderPlan, planPaths } from "../skills/hsdd-seal/scripts/lib/plan.mjs";

export const INPUTS = { release: "2.4.0", date: "2026-09-15", owner: "Dewi", evidence: "QA run 77", catchup: null, today: "2026-11-03", keep: [] };

const noEvidence = { report: false, context: false, openspec: false };
const noDoc = { exists: false, signed: false, placeholder: false, addedInCatchup: false };

test("classify: signed doc is done whatever else holds", () => {
  assert.equal(classify({ phase: { status: "active" }, doc: { ...noDoc, exists: true, signed: true }, evidence: noEvidence, keep: new Set() }).class, "done");
});

test("classify: evidence of work means sign", () => {
  for (const e of ["report", "context", "openspec"]) {
    assert.equal(classify({ phase: { status: "active" }, doc: noDoc, evidence: { ...noEvidence, [e]: true }, keep: new Set() }).class, "sign", e);
  }
  assert.equal(classify({ phase: { status: "active" }, doc: { ...noDoc, exists: true }, evidence: noEvidence, keep: new Set() }).class, "sign");
});

test("classify: a catch-up doc alone is no evidence, so drop", () => {
  assert.equal(classify({ phase: { status: "active" }, doc: { ...noDoc, exists: true, addedInCatchup: true }, evidence: noEvidence, keep: new Set() }).class, "drop");
  assert.equal(classify({ phase: { status: "active" }, doc: noDoc, evidence: noEvidence, keep: new Set() }).class, "drop");
});

test("classify: keep wins over drop and sign; dropped or retired phases are skipped", () => {
  assert.equal(classify({ phase: { status: "active" }, doc: noDoc, evidence: noEvidence, keep: new Set(["x"]), id: "x" }).class, "keep");
  assert.equal(classify({ phase: { status: "dropped" }, doc: noDoc, evidence: noEvidence, keep: new Set() }).class, "skip");
  assert.equal(classify({ phase: { status: "retired" }, doc: { ...noDoc, exists: true, signed: true }, evidence: noEvidence, keep: new Set() }).class, "skip");
});

test("buildPlan classifies the fixture", () => {
  const { root, catchup } = sealTree();
  const t = readTree(root, { catchup });
  const p = buildPlan(t, { ...INPUTS, catchup });
  assert.equal(p.kind, "seal-plan");
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.inputs.catchup, catchup);
  const cls = Object.fromEntries(p.phases.map((x) => [x.id, x.class]));
  assert.deepEqual(cls, {
    "acme.api.1": "done", "acme.api.2": "done", "acme.api.3": "sign", "acme.api.4": "drop",
    "acme.legacy.1": "skip", "acme.web.1": "sign", "acme.web.2": "sign", "acme.web.3": "drop",
  });
  const web2 = p.phases.find((x) => x.id === "acme.web.2");
  assert.deepEqual(web2.evidence, { report: false, context: true, openspec: false });
  assert.equal(web2.doc.addedInCatchup, true);
  assert.equal(web2.docPath, "hsdd/verify/acme.web.2.verification.md");
  assert.equal(web2.tier, "spot-check");
  assert.equal(buildPlan(t, { ...INPUTS, keep: ["acme.web.3"] }).phases.find((x) => x.id === "acme.web.3").class, "keep");
  assert.deepEqual(p.prune.map((x) => x.dir), ["openspec/changes/archive/2026-10-25-acme-api-3"]);
  assert.deepEqual(p.prune[0].files.sort(), ["openspec/changes/archive/2026-10-25-acme-api-3/proposal.md", "openspec/changes/archive/2026-10-25-acme-api-3/tasks.md"]);
  assert.deepEqual(p.intakes.map((i) => [i.path, i.status, i.produced, i.cited]), [["hsdd/management/2026-08-20-intake-feature-x.md", "open", ["acme.api.3", "acme.api.4"], ["acme.api.3", "acme.api.4", "acme.web.3"]]]);
  assert.equal(p.milestone.path, "hsdd/management/2026-09-01-milestones.md");
  assert.equal(p.milestone.gates.length, 4);
  assert.deepEqual(p.pending, [{ node: "acme.api", path: "hsdd/spec/acme.api.md", entries: 2, requests: 1 }]);
  assert.deepEqual(p.unparsed, []);
  assert.equal(typeof p.specSha, "string");
});

test("renderPlan is a management document with the edit instruction and the tables", () => {
  const { root, catchup } = sealTree();
  const p = buildPlan(readTree(root, { catchup }), { ...INPUTS, catchup });
  const md = renderPlan(p);
  assert.match(md, /^# Seal plan: release 2\.4\.0/);
  assert.match(md, /Edit the "class" field in hsdd\/management\/2026-11-03-seal-plan\.json \(done, sign, drop, keep\); this file is a rendering\./);
  assert.match(md, /\| acme\.api\.4 \|.*\| drop \|/);
  assert.match(md, /\| acme\.web\.2 \|.*\| sign \|/);
  assert.match(md, /2026-08-20-intake-feature-x\.md/);
  assert.match(md, /acme\.api\.10 done/);
  assert.match(md, /2026-10-25-acme-api-3/);
  assert.match(md, /\| acme\.api \|.*\| 1 \|/);
  assert.doesNotMatch(md, /—/);
});

test("planPaths", () => {
  assert.deepEqual(planPaths("/x", "2026-11-03"), { json: "hsdd/management/2026-11-03-seal-plan.json", md: "hsdd/management/2026-11-03-seal-plan.md" });
});
