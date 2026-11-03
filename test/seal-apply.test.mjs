import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sealTree, INPUTS } from "./helpers/seal-fixture.mjs";
import { readTree } from "../skills/hsdd-seal/scripts/lib/scan.mjs";
import { buildPlan } from "../skills/hsdd-seal/scripts/lib/plan.mjs";
import { applyOps, describeOps } from "../skills/hsdd-seal/scripts/lib/ops.mjs";
import { retroactiveDoc, signDoc, opsSign } from "../skills/hsdd-seal/scripts/lib/sign.mjs";

const PH = { id: "acme.api.4", name: "Export", tier: "gate-only" };

export function planned() {
  const { root, catchup } = sealTree();
  const tree = readTree(root, { catchup });
  const plan = buildPlan(tree, { ...INPUTS, catchup });
  return { root, catchup, tree, plan };
}

test("applyOps: dry run writes nothing, --write writes, identical content is skipped", () => {
  const root = mkdtempSync(join(tmpdir(), "hsdd-seal-ops-"));
  const ops = [{ kind: "write", path: "hsdd/verify/x.md", content: "hello\n", note: "x" }];
  const dry = applyOps(root, ops, { write: false });
  assert.equal(existsSync(join(root, "hsdd/verify/x.md")), false);
  assert.deepEqual(dry.applied, []);
  const wet = applyOps(root, ops, { write: true });
  assert.deepEqual(wet.applied, ["hsdd/verify/x.md"]);
  assert.equal(readFileSync(join(root, "hsdd/verify/x.md"), "utf8"), "hello\n");
  const again = applyOps(root, ops, { write: true });
  assert.deepEqual(again.applied, []);
  assert.deepEqual(again.skipped, ["hsdd/verify/x.md"]);
  assert.match(describeOps(ops), /write\s+hsdd\/verify\/x\.md\s+x/);
  const noted = applyOps(root, [{ kind: "note", path: "hsdd/spec/n.md", note: "by hand" }], { write: true });
  assert.deepEqual([noted.applied, noted.skipped], [[], []]);
  assert.match(noted.lines[0], /^note\s+hsdd\/spec\/n\.md\s+by hand$/);
});

test("applyOps: delete and rename", () => {
  const root = mkdtempSync(join(tmpdir(), "hsdd-seal-ops-"));
  applyOps(root, [{ kind: "write", path: "a/one.md", content: "1\n", note: "" }, { kind: "write", path: "b/two.md", content: "2\n", note: "" }], { write: true });
  const r = applyOps(root, [{ kind: "delete", path: "a", note: "" }, { kind: "rename", path: "b/two.md", to: "c/d/two.md", note: "" }, { kind: "delete", path: "missing", note: "" }], { write: true });
  assert.equal(existsSync(join(root, "a")), false);
  assert.equal(readFileSync(join(root, "c/d/two.md"), "utf8"), "2\n");
  assert.deepEqual(r.skipped, ["missing"]);
});

test("retroactiveDoc has the template's sections and the fixed sentences", () => {
  const d = retroactiveDoc(PH, INPUTS);
  for (const h of ["## Commands to run", "## Expected output", "## Observed", "## Outstanding", "## Learnings", "## Sign-off"]) assert.ok(d.includes(`\n${h}\n`), h);
  assert.match(d, /^# Verification: acme\.api\.4 — Export$/m);
  assert.match(d, /## Commands to run\nnone, retroactive\n/);
  assert.match(d, /## Expected output\nsee QA evidence\n/);
  assert.match(d, /## Observed\n2026-11-03: Not observed by this run\. Released in 2\.4\.0 on 2026-09-15\. QA evidence: QA run 77\. Retroactive \(spec §11\.8\)\.\n/);
  assert.match(d, /## Outstanding\n- individual verification not performed\n/);
  assert.match(d, /## Learnings\n- none\n/);
  assert.match(d, /- Reviewer \/ date: Claude for Dewi \(delegated\), 2026-11-03\n- Review tier applied: gate-only\n- Disposition of each Outstanding item: waived \(released and QA-verified\)\n- Disposition of each Learning: none\n/);
  assert.match(retroactiveDoc({ ...PH, tier: null }, INPUTS), /- Review tier applied: not stated in the phase record\n/);
});

test("signDoc keeps a real body, replaces Sign-off, fills empty Learnings", () => {
  const before = "# Verification: acme.api.3 — Pagination\n\n## Commands to run\nnpm test\n\n## Observed\n2026-09-20: ran npm test, 14 passed.\n\n## Outstanding\n- the export of page 2 was not checked\n\n## Learnings\n\n## Sign-off\n- Reviewer / date: {person} | {agent} for {person} (delegated)\n- Review tier applied:\n";
  const after = signDoc(before, { id: "acme.api.3", name: "Pagination", tier: "spot-check" }, INPUTS);
  assert.ok(after.includes("2026-09-20: ran npm test, 14 passed."));
  assert.ok(after.includes("- the export of page 2 was not checked"));
  assert.match(after, /## Learnings\n- none\n/);
  assert.match(after, /## Sign-off\n- Reviewer \/ date: Claude for Dewi \(delegated\), 2026-11-03\n- Review tier applied: spot-check\n- Disposition of each Outstanding item: waived \(released and QA-verified\)\n- Disposition of each Learning: none\n$/);
  assert.equal((after.match(/## Sign-off/g) || []).length, 1);
  assert.doesNotMatch(after, /\{person\}/);
});

test("signDoc appends Sign-off when the section is missing", () => {
  const after = signDoc("# V\n## Observed\nran it\n", PH, INPUTS);
  assert.match(after, /## Sign-off\n- Reviewer \/ date: Claude for Dewi \(delegated\), 2026-11-03/);
  assert.match(after, /## Learnings\n- none\n/);
});

test("opsSign on the fixture: missing and catch-up docs are written whole, an unsigned real doc is patched, signed docs are untouched", () => {
  const { tree, plan } = planned();
  const ops = opsSign(plan, tree);
  const byPath = Object.fromEntries(ops.map((o) => [o.path, o]));
  assert.deepEqual(Object.keys(byPath).sort(), ["hsdd/verify/acme.api.3.verification.md", "hsdd/verify/acme.web.1.verification.md", "hsdd/verify/acme.web.2.verification.md"]);
  assert.ok(byPath["hsdd/verify/acme.web.2.verification.md"].content.includes("Not observed by this run"));
  assert.ok(!byPath["hsdd/verify/acme.web.2.verification.md"].content.includes("reconstructed"));
  assert.ok(byPath["hsdd/verify/acme.web.1.verification.md"].content.includes("# Verification: acme.web.1 — Shell"));
  assert.ok(byPath["hsdd/verify/acme.api.3.verification.md"].content.includes("2026-09-20: ran npm test, 14 passed."));
  assert.ok(ops.every((o) => o.kind === "write"));
});

test("opsSign is idempotent after --write", () => {
  const { root, catchup, tree, plan } = planned();
  applyOps(root, opsSign(plan, tree), { write: true });
  const after = readTree(root, { catchup });
  assert.equal(after.docs.get("acme.api.3").signed, true);
  assert.equal(after.docs.get("acme.web.2").signed, true);
  assert.equal(opsSign(plan, after).length, 0);
});

test("opsSign writes a doc for a phase the owner reclassified to sign", () => {
  const { root, tree, plan } = planned();
  plan.phases.find((p) => p.id === "acme.web.3").class = "sign";
  const ops = opsSign(plan, tree);
  assert.ok(ops.some((o) => o.path === "hsdd/verify/acme.web.3.verification.md"));
  applyOps(root, ops, { write: true });
  assert.ok(existsSync(join(root, "hsdd/verify/acme.web.3.verification.md")));
});

// Task 5: the drop step
import { API_SPEC, CONVENTIONS } from "./helpers/seal-fixture.mjs";
import { statusLine, insertStatus, conventionsParagraph, addConvention, opsDrop } from "../skills/hsdd-seal/scripts/lib/drop.mjs";

test("statusLine is the fixed dropped line", () => {
  assert.equal(statusLine(INPUTS), "- **Status:** dropped (2026-11-03, not built before release 2.4.0)");
});

test("insertStatus puts the line after the phase's Review tier, once, and only in that phase", () => {
  const line = statusLine(INPUTS);
  const once = insertStatus(API_SPEC, { id: "acme.api.4", n: 4 }, line);
  assert.match(once, /### acme\.api\.4: Export\n[\s\S]*?- \*\*Review tier:\*\* gate-only\n- \*\*Status:\*\* dropped \(2026-11-03, not built before release 2\.4\.0\)\n- \*\*Dependencies:\*\* none\n/);
  assert.equal((once.match(/\*\*Status:\*\* dropped/g) || []).length, 1);
  assert.equal(insertStatus(once, { id: "acme.api.4", n: 4 }, line), once);
  assert.equal(insertStatus(API_SPEC, { id: "acme.api.9", n: 9 }, line), null);
});

test("insertStatus falls back to the end of the field block when there is no Review tier line", () => {
  const spec = "# n: N\n\n## Phase Plan\n\n### n.1: One\n\n- **Scope:** x\n- **Gate:** npm test\n\nSome prose.\n";
  const out = insertStatus(spec, { id: "n.1", n: 1 }, "- **Status:** dropped (d, r)");
  assert.match(out, /- \*\*Gate:\*\* npm test\n- \*\*Status:\*\* dropped \(d, r\)\n\nSome prose\.\n/);
});

test("conventions paragraph is appended once under Phase design", () => {
  const para = conventionsParagraph(INPUTS);
  assert.match(para, /^A phase record may carry `- \*\*Status:\*\* dropped \(date, reason\)`\./);
  assert.match(para, /release 2\.4\.0\.$/);
  const conv = addConvention(CONVENTIONS, para);
  assert.match(conv, /## Phase design[\s\S]*Status:\*\* dropped[\s\S]*\n## Teams/);
  assert.equal(addConvention(conv, para), conv);
  const bare = addConvention("# Project Conventions\n\n## Layout\n- x\n", para);
  assert.match(bare, /\n## Phase design\n\nA phase record may carry/);
});

test("opsDrop writes the two node specs and the conventions file, and is idempotent", () => {
  const { root, catchup, tree, plan } = planned();
  const ops = opsDrop(plan, tree);
  assert.deepEqual(ops.map((o) => o.path).sort(), ["hsdd/conventions.md", "hsdd/spec/acme.api.md", "hsdd/spec/acme.web.md"]);
  applyOps(root, ops, { write: true });
  const after = readTree(root, { catchup });
  assert.deepEqual([...after.dropped].sort(), ["acme.api.4", "acme.web.3"]);
  assert.equal(after.conventions.hasDropped, true);
  assert.equal(opsDrop(plan, after).length, 0);
  assert.ok(readFileSync(join(root, "hsdd/spec/acme.api.md"), "utf8").includes("## Governance updates (pending reconcile)\n\n- confirm"));
});

// Task 6: the prune step
import { prunableDirs, opsPrune } from "../skills/hsdd-seal/scripts/lib/prune.mjs";

test("prunableDirs keeps only directories whose every file the catch-up added", () => {
  assert.deepEqual(prunableDirs(new Set(["x/a", "x/b", "y/a"]), new Map([["x", ["x/a", "x/b"]], ["y", ["y/a", "y/b"]], ["z", []]])), ["x"]);
});

test("opsPrune deletes the catch-up archive and nothing else, and is idempotent", () => {
  const { root, catchup, tree, plan } = planned();
  const ops = opsPrune(plan, tree);
  assert.deepEqual(ops.map((o) => [o.kind, o.path]), [["delete", "openspec/changes/archive/2026-10-25-acme-api-3"]]);
  applyOps(root, ops, { write: true });
  assert.equal(existsSync(join(root, "openspec/changes/archive/2026-10-25-acme-api-3")), false);
  assert.ok(existsSync(join(root, "openspec/changes/archive/2026-08-01-acme-api-1/proposal.md")));
  assert.ok(existsSync(join(root, "openspec/specs/api/spec.md")));
  assert.equal(opsPrune(plan, readTree(root, { catchup })).length, 0);
});

test("opsPrune honours the owner removing a directory from the plan", () => {
  const { tree, plan } = planned();
  plan.prune = [];
  assert.deepEqual(opsPrune(plan, tree), []);
});
