import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync, mkdtempSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TREE, completedModel } from "./helpers/plan-fixture.mjs";
import { extractPlan } from "../skills/hsdd-summary/scripts/extract-plan.mjs";
import { crossCheckPlan, reaches } from "../skills/hsdd-summary/scripts/checks-plan.mjs";
import { validate } from "../skills/hsdd-summary/scripts/schema.mjs";

const SCHEMA = JSON.parse(readFileSync(new URL("../skills/hsdd-summary/scripts/plan-model.schema.json", import.meta.url), "utf8"));

test("schema: the raw extraction fails only where unparsed items are", () => {
  const raw = extractPlan(TREE, { specSha: "abc1234" });
  assert.deepEqual(validate(SCHEMA, raw), ['/phases/4/tier: null is not one of "gate-only", "spot-check", "full-review"']);
});

test("schema: the completed model is valid", () => {
  assert.deepEqual(validate(SCHEMA, completedModel()), []);
});

test("schema validator: types, required, additionalProperties, pattern, $ref", () => {
  const s = { type: "object", required: ["a"], additionalProperties: false, properties: { a: { $ref: "#/$defs/x" } }, $defs: { x: { type: "string", pattern: "^v\\d$" } } };
  assert.deepEqual(validate(s, { a: "v1" }), []);
  assert.deepEqual(validate(s, { a: "x", b: 1 }), ['/a: "x" does not match ^v\\d$', '/: unexpected property "b"']);
  assert.deepEqual(validate(s, {}), ['/: missing required "a"']);
  assert.throws(() => validate({ oneOf: [] }, 1), /not supported/);
});

test("errors: unparsed items stop the run", () => {
  const { errors } = crossCheckPlan(extractPlan(TREE, { specSha: "abc1234" }));
  assert.match(errors[0], /^2 unparsed item\(s\) remain; first: \/phases\/4\/tier/);
});

test("errors: unknown dependency and cycles", () => {
  const m = completedModel();
  m.phases[0].dependsOn = ["acme.api.3"];
  m.phases[1].dependsOn = ["acme.api.1", "acme.api.9"];
  const { errors } = crossCheckPlan(m);
  assert.ok(errors.includes("phase acme.api.2 names acme.api.9, which is not a phase"));
  assert.ok(errors.some((e) => /cycle: acme\.api\.1 -> acme\.api\.3 -> acme\.api\.2 -> acme\.api\.1/.test(e)));
});

test("findings on the fixture tree", () => {
  const { errors, findings } = crossCheckPlan(completedModel());
  assert.deepEqual(errors, []);
  const got = findings.map((f) => `${f.node} ${f.kind} ${f.message}`);
  for (const line of [
    "acme.api pending-governance governance updates are waiting for reconcile",
    "acme.web.console not-in-table acme.web.console.3 has a phase section but no summary-table row",
    "acme.web unwritten-contract outlet-api@v1 is named, not yet written",
    "acme.web.console version-mismatch session@v1 is cited; the contract file is at v2",
    "acme.api provisional-contract session@v2 is provisional: reconcile has not confirmed its phase ids",
    "acme.web.console adr-missing ADR-003 is cited, but no ADR file exists",
    "acme.api adr-proposed ADR-002 is proposed: not binding until accepted",
    "acme.api contingent acme.api.3 is contingent on OQ1 (OPEN)",
    "acme.api collision-ordered acme.api.2 and acme.api.3 edit the same files; a dependency already orders them",
  ]) assert.ok(got.includes(line), line);
  assert.ok(!got.some((l) => /user-store@v1 is named/.test(l)), "an external contract with a file is not unwritten");
});

test("reaches follows dependency chains", () => {
  const deps = new Map([["a", ["b"]], ["b", ["c"]], ["c", []]]);
  assert.equal(reaches(deps, "a", "c"), true);
  assert.equal(reaches(deps, "c", "a"), false);
});

test("a node described only inside its parent's spec has no-spec-file", () => {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-x-"));
  cpSync(TREE, dir, { recursive: true });
  appendFileSync(join(dir, "hsdd/spec/acme.md"), "\n### acme.d: D\n\n- **Kind:** leaf-parent\n- **Purpose:** D does one thing.\n- **Consumes:** none\n- **Produces:** none\n");
  const model = extractPlan(dir, { specSha: "abc1234" });
  for (const p of model.phases) if (p.tier === null) p.tier = "spot-check"; // the fixture's own completion, as completedModel does
  assert.deepEqual(validate(SCHEMA, model), []);
  const d = model.nodes.find((n) => n.id === "acme.d");
  assert.equal(d.sourceFile, "hsdd/spec/acme.md");
  assert.ok(model.nodes.find((n) => n.id === "acme").children.includes("acme.d"));
  const { findings } = crossCheckPlan(model);
  assert.ok(findings.some((f) => f.node === "acme.d" && f.kind === "no-spec-file"), JSON.stringify(findings));
});
