import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sealTree, INPUTS } from "./helpers/seal-fixture.mjs";
import { readTree } from "../skills/hsdd-seal/scripts/lib/scan.mjs";
import { buildPlan } from "../skills/hsdd-seal/scripts/lib/plan.mjs";
import { applyOps } from "../skills/hsdd-seal/scripts/lib/ops.mjs";
import { opsSign } from "../skills/hsdd-seal/scripts/lib/sign.mjs";
import { opsDrop } from "../skills/hsdd-seal/scripts/lib/drop.mjs";
import { opsPrune } from "../skills/hsdd-seal/scripts/lib/prune.mjs";
import { opsClose } from "../skills/hsdd-seal/scripts/lib/close.mjs";
import { buildResult, renderResult, upsertResult } from "../skills/hsdd-seal/scripts/lib/report.mjs";

function sealed({ removeUnknownGate = false } = {}) {
  const { root, catchup } = sealTree();
  const tree = readTree(root, { catchup });
  const plan = buildPlan(tree, { ...INPUTS, catchup });
  applyOps(root, opsSign(plan, tree), { write: true });
  applyOps(root, opsDrop(plan, tree), { write: true });
  applyOps(root, opsPrune(plan, tree), { write: true });
  if (removeUnknownGate) {
    const ms = join(root, "hsdd/management/2026-09-01-milestones.md");
    writeFileSync(ms, readFileSync(ms, "utf8").replace(/^- \[ \] .*acme\.api\.10.*\n/m, ""));
  }
  applyOps(root, opsClose(plan, readTree(root, { catchup })), { write: true });
  return { root, catchup, plan, tree: readTree(root, { catchup }) };
}

test("buildResult counts the fixture after every step", () => {
  const { plan, tree } = sealed();
  const r = buildResult(plan, tree);
  assert.deepEqual(r.counts, { doneBefore: 2, signed: 3, dropped: 2, kept: 0, skipped: 1 });
  assert.deepEqual(r.intakes, [{ path: "hsdd/management/2026-08-20-intake-feature-x.md", status: "open" }]);
  assert.equal(r.milestone.sealed, false);
  assert.deepEqual(r.milestone.open, ["acme.api.10 done"]);
  assert.deepEqual(r.pruned, ["openspec/changes/archive/2026-10-25-acme-api-3"]);
  assert.ok(r.needsOwner.some((s) => /acme\.api.*request/.test(s)), r.needsOwner.join("\n"));
  assert.ok(r.needsOwner.some((s) => /acme\.api\.10/.test(s)), r.needsOwner.join("\n"));
  assert.ok(r.needsOwner.some((s) => /intake-feature-x/.test(s)), r.needsOwner.join("\n"));
  assert.deepEqual(r.unparsed, []);
});

test("buildResult sees a sealed milestone in the archive", () => {
  const { plan, tree } = sealed({ removeUnknownGate: true });
  const r = buildResult(plan, tree);
  assert.equal(r.milestone.sealed, true);
  assert.equal(r.milestone.path, "hsdd/management/archive/2026-09-01-milestones.md");
  assert.ok(!r.needsOwner.some((s) => /gate/.test(s)));
});

test("renderResult is tables and a Needs the owner list; upsertResult keeps one Result section", () => {
  const { plan, tree } = sealed();
  const md = renderResult(buildResult(plan, tree));
  assert.match(md, /^## Result\n/);
  assert.match(md, /\| Signed today \| 3 \|/);
  assert.match(md, /### Needs the owner\n- /);
  assert.doesNotMatch(md, /—/);
  const once = upsertResult("# Seal plan: release 2.4.0\n\nbody\n", md);
  const twice = upsertResult(once, md);
  assert.equal(twice, once);
  assert.equal((twice.match(/^## Result/gm) || []).length, 1);
  assert.match(twice, /^# Seal plan: release 2\.4\.0\n\nbody\n\n## Result\n/);
});

test("renderResult says none when nothing needs the owner", () => {
  const md = renderResult({ counts: { doneBefore: 1, signed: 0, dropped: 0, kept: 0, skipped: 0 }, intakes: [], milestone: null, pending: [], pruned: [], needsOwner: [], unparsed: [] });
  assert.match(md, /### Needs the owner\n- none\n/);
  assert.match(md, /no milestone document/);
});

// Fix pass: findings 7 and 9 in the report
test("the report lists undispositioned Learnings and a catch-up doc left on a dropped phase under Needs the owner", () => {
  const { root, catchup } = sealTree();
  const api3 = join(root, "hsdd/verify/acme.api.3.verification.md");
  writeFileSync(api3, readFileSync(api3, "utf8").replace("## Learnings\n\n", "## Learnings\n- the node spec names the wrong port\n\n"));
  const tree = readTree(root, { catchup });
  const plan = buildPlan(tree, { ...INPUTS, catchup });
  plan.phases.find((p) => p.id === "acme.web.2").class = "drop";
  applyOps(root, opsSign(plan, tree), { write: true });
  applyOps(root, opsDrop(plan, tree), { write: true });
  const r = buildResult(plan, readTree(root, { catchup }));
  assert.ok(r.needsOwner.some((s) => /acme\.api\.3.*Learnings/.test(s)), r.needsOwner.join("\n"));
  assert.ok(r.needsOwner.some((s) => /acme\.web\.2.*catch-up/.test(s)), r.needsOwner.join("\n"));
});
