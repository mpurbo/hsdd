import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { extractPlan, phaseList, splitTitle, codingMethod } from "../skills/hsdd-summary/scripts/extract-plan.mjs";

// A throwaway HSDD tree: { "hsdd/spec/x.md": text, ... } written under a fresh temp dir.
function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), "hsdd-x-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const TREE = fileURLToPath(new URL("./fixtures/tree", import.meta.url));
const model = extractPlan(TREE, { specSha: "abc1234" });
const node = (id) => model.nodes.find((n) => n.id === id);
const phase = (id) => model.phases.find((p) => p.id === id);

test("project: root, name, sha, coding method", () => {
  assert.deepEqual(model.project, { root: "acme", name: "Acme Platform", specSha: "abc1234", codingMethod: "superpowers" });
  assert.equal(codingMethod(""), "openspec");
});

test("nodes are sorted by id and linked to parents", () => {
  assert.deepEqual(model.nodes.map((n) => n.id), ["acme", "acme.api", "acme.legacy", "acme.ops", "acme.web", "acme.web.console"]);
  assert.equal(node("acme.web.console").parent, "acme.web");
  assert.deepEqual(node("acme").children, ["acme.api", "acme.legacy", "acme.ops", "acme.web"]);
});

test("own field block, embedded fallback, and bare pre-0.6.1 lines", () => {
  assert.equal(node("acme.api").purpose, "issue and verify access tokens");
  assert.equal(node("acme.web").kind, "internal");
  assert.equal(node("acme.web").team, "web");
  assert.deepEqual(node("acme.web.console").governedBy, ["ADR-003"]);
  assert.equal(node("acme").kind, "root");
});

test("status, adoption and observed surface", () => {
  assert.equal(node("acme.legacy").status, "retired");
  assert.equal(node("acme.ops").adopted, "as-built");
  assert.equal(node("acme.ops").observedSurface, true);
});

test("contract references keep the external marker", () => {
  assert.deepEqual(node("acme.api").consumes, [{ ref: "user-store@v1", ext: true }]);
  assert.deepEqual(node("acme.api").produces.map((r) => r.ref), ["auth-token@v1", "session@v2"]);
});

test("open questions and pending governance", () => {
  assert.deepEqual(node("acme").openQuestions.map((q) => [q.id, q.status, q.hasDetail]), [["OQ1", "OPEN", true], ["OQ2", "RESOLVED", true]]);
  assert.equal(node("acme.api").pendingGovernance, true);
  assert.equal(node("acme.web.console").pendingGovernance, false);
});

test("phases: ids from short headings, default gate, tiers, caps", () => {
  assert.deepEqual(node("acme.api").phases, ["acme.api.1", "acme.api.2", "acme.api.3"]);
  assert.equal(phase("acme.api.2").heading, "api.2");
  assert.equal(phase("acme.api.2").resolvedGate, "npm test");
  assert.equal(phase("acme.api.3").resolvedGate, "npm test -- sessions");
  assert.equal(phase("acme.api.2").tier, "full-review");
  assert.equal(phase("acme.api.2").taskCap, 5);
});

test("dependencies and collisions from the summary table", () => {
  assert.deepEqual(phase("acme.api.3").dependsOn, ["acme.api.2"]);
  assert.deepEqual(phase("acme.api.2").collidesWith, ["acme.api.3"]);
  assert.deepEqual(phase("acme.web.console.2").dependsOn, ["acme.web.console.1", "acme.api.2"]);
  assert.deepEqual(phase("acme.api.3").contingentOn, ["OQ1"]);
});

test("unparsed: an off-vocabulary tier and a phase with no table row", () => {
  assert.deepEqual(model.unparsed.map((u) => u.path), ["/phases/4/tier", "/phases/5/dependsOn"]);
  assert.equal(phase("acme.web.console.3").inTable, false);
  assert.equal(phase("acme.web.console.2").tier, null);
});

test("contracts: frontmatter, external owner, guarantees", () => {
  const c = model.contracts.find((x) => x.ref === "session@v2");
  assert.equal(c.phaseIds, "provisional");
  assert.equal(model.contracts.find((x) => x.ref === "user-store@v1").external, true);
  assert.deepEqual(model.contracts.find((x) => x.ref === "auth-token@v1").guarantees, ["exp is iat plus 86400 seconds", "sub is the user id"]);
  assert.ok(!model.contracts.some((x) => x.sourceFile.endsWith("INDEX.md")));
});

test("ADRs: title, status, first sentence of the decision", () => {
  assert.deepEqual(model.adrs.map((a) => [a.id, a.title, a.status, a.decision]), [
    ["ADR-001", "Token signing", "accepted", "Sign tokens with Ed25519."],
    ["ADR-002", "Session store", "proposed", "Keep sessions in Redis."],
  ]);
});

test("ids cover nodes, phases, short headings, refs, ADRs and OQs", () => {
  for (const id of ["acme.api", "acme.api.2", "api.2", "outlet-api@v1", "ADR-002", "OQ-A1"]) assert.ok(model.ids.includes(id), id);
});

test("facts are stable hashes keyed by slot subject", () => {
  assert.match(model.facts["explain:acme.api"], /^sha256:[0-9a-f]{64}$/);
  assert.ok(model.facts["delivers:acme.api.2"]);
  assert.ok(model.facts["promise:auth-token@v1"]);
  assert.deepEqual(extractPlan(TREE, { specSha: "abc1234" }).facts, model.facts);
});

test("phaseList: aliases, cross-node, ranges, footnote marks, none", () => {
  const nodes = new Set(["x.web", "x.api"]);
  const aliases = new Map([["w", "x.web"], ["api", "x.api"]]);
  assert.deepEqual(phaseList("1, w.2, api.3\u2020", "x.web", nodes, aliases).ids, ["x.web.1", "x.web.2", "x.api.3"]);
  assert.deepEqual(phaseList("w.1\u2013w.3", "x.web", nodes, aliases).ids, ["x.web.1", "x.web.2", "x.web.3"]);
  assert.deepEqual(phaseList("\u2014", "x.web", nodes).ids, []);
  assert.deepEqual(phaseList("zz.4", "x.web", nodes).unresolved, ["zz.4"]);
});

test("splitTitle: colon, em dash and spaced hyphen", () => {
  assert.deepEqual(splitTitle("acme.api: Token Service"), { id: "acme.api", name: "Token Service" });
  assert.deepEqual(splitTitle("acme-x.backend \u2014 Backend"), { id: "acme-x.backend", name: "Backend" });
  assert.deepEqual(splitTitle("acme.web - Web"), { id: "acme.web", name: "Web" });
});

test("a phase section the heading or field form rejects is reported, not dropped", () => {
  const spec = [
    "# a: Root",
    "",
    "## Node",
    "",
    "- **Kind:** leaf-parent",
    "- **Purpose:** the root",
    "- **Consumes:** none",
    "- **Produces:** none",
    "",
    "## Phase Plan",
    "",
    "**Default gate:** `npm test`",
    "",
    "| Phase | Name | Tier |",
    "|------:|------|------|",
    "| a.1 | One | gate-only |",
    "| a.3 | Three | gate-only |",
    "",
    "### a.1: One",
    "",
    "- **Scope:** s",
    "- **Review tier:** gate-only",
    "",
    "### Phase a.3: Three",
    "",
    "- **Scope**: s",
    "",
  ].join("\n");
  const m = extractPlan(makeTree({ "hsdd/spec/a.md": spec }), { specSha: "x" });
  const entry = m.unparsed.find((u) => u.path === "/phases/-");
  assert.ok(entry, "an unparsed entry for the unreadable section");
  assert.equal(entry.file, "hsdd/spec/a.md");
  assert.equal(entry.line, spec.split("\n").findIndex((l) => l === "### Phase a.3: Three") + 1);
  assert.match(entry.reason, /Phase a\.3: Three/);
  assert.deepEqual((m.nodes.find((n) => n.id === "a").tableOnly ?? []).map((t) => t.id), []);
});

test("a child embedded without a spec file of its own is a node", () => {
  const root = makeTree({
    "hsdd/spec/x.md": [
      "# x: Root",
      "",
      "## Node",
      "",
      "- **Kind:** leaf-parent",
      "- **Purpose:** the root",
      "- **Consumes:** none",
      "- **Produces:** none",
      "",
      "### x.d: D",
      "",
      "- **Kind:** leaf-parent",
      "- **Purpose:** the d part",
      "- **Consumes:** none",
      "- **Produces:** none",
      "",
    ].join("\n"),
  });
  const m = extractPlan(root, { specSha: "x" });
  const d = m.nodes.find((n) => n.id === "x.d");
  assert.ok(d, "x.d is a node");
  assert.equal(d.purpose, "the d part");
  assert.equal(d.sourceFile, "hsdd/spec/x.md");
  assert.equal(d.parent, "x");
  assert.ok(m.nodes.find((n) => n.id === "x").children.includes("x.d"));
});

test("a phase prefix resolves only when it names exactly one node", () => {
  assert.deepEqual(phaseList("a.1", "x.c", new Set(["x.c", "x.a", "y.a"])), { ids: [], unresolved: ["a.1"] });
  assert.deepEqual(phaseList("a.1", "x.c", new Set(["x.c", "x.a"])).ids, ["x.a.1"]);
});

test("a collision reason after the target is not a phase reference", () => {
  const root = makeTree({
    "hsdd/spec/x.md": "# x: Root\n\n## Node\n\n- **Kind:** internal\n- **Purpose:** r\n- **Consumes:** none\n- **Produces:** none\n",
    "hsdd/spec/x.a.md": "# x.a: A\n\n## Node\n\n- **Kind:** leaf-parent\n- **Purpose:** a\n- **Consumes:** none\n- **Produces:** none\n",
    "hsdd/spec/x.c.md": [
      "# x.c: C",
      "",
      "## Node",
      "",
      "- **Kind:** leaf-parent",
      "- **Purpose:** c",
      "- **Consumes:** none",
      "- **Produces:** none",
      "",
      "## Phase Plan",
      "",
      "**Default gate:** `npm test`",
      "",
      "| Phase | Name | Depends on |",
      "|------:|------|------------|",
      "| c.1 | One | none |",
      "",
      "### c.1: One",
      "",
      "- **Scope:** s",
      "- **Review tier:** gate-only",
      "- **Collides with:** [a.2] \u2014 same file (src/x.ts)",
      "",
    ].join("\n"),
  });
  const m = extractPlan(root, { specSha: "x" });
  assert.deepEqual(m.phases.find((p) => p.id === "x.c.1").collidesWith, ["x.a.2"]);
  assert.ok(!m.unparsed.some((u) => u.path.endsWith("/collidesWith")), "no unparsed collision entry");
});

test("a dash range in Collides with stays a range; a reason after a space-dash is cut", () => {
  const root = makeTree({
    "hsdd/spec/x.md": "# x: Root\n\n## Node\n\n- **Kind:** internal\n- **Purpose:** r\n- **Consumes:** none\n- **Produces:** none\n",
    "hsdd/spec/x.a.md": "# x.a: A\n\n## Node\n\n- **Kind:** leaf-parent\n- **Purpose:** a\n- **Consumes:** none\n- **Produces:** none\n",
    "hsdd/spec/x.c.md": [
      "# x.c: C",
      "",
      "## Node",
      "",
      "- **Kind:** leaf-parent",
      "- **Purpose:** c",
      "- **Consumes:** none",
      "- **Produces:** none",
      "",
      "## Phase Plan",
      "",
      "**Default gate:** `npm test`",
      "",
      "| Phase | Name | Depends on |",
      "|------:|------|------------|",
      "| c.1 | One | none |",
      "| c.2 | Two | none |",
      "",
      "### c.1: One",
      "",
      "- **Scope:** s",
      "- **Review tier:** gate-only",
      "- **Collides with:** a.1\u2013a.3",
      "",
      "### c.2: Two",
      "",
      "- **Scope:** s",
      "- **Review tier:** gate-only",
      "- **Collides with:** [a.2] \u2014 same file (src/x.ts)",
      "",
    ].join("\n"),
  });
  const m = extractPlan(root, { specSha: "x" });
  assert.deepEqual(m.phases.find((p) => p.id === "x.c.1").collidesWith, ["x.a.1", "x.a.2", "x.a.3"]);
  assert.deepEqual(m.phases.find((p) => p.id === "x.c.2").collidesWith, ["x.a.2"]);
  assert.ok(!m.unparsed.some((u) => u.path.endsWith("/collidesWith")), "no unparsed collision entry");
});
