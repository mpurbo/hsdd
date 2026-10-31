import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTree, parseNodeSpec, parseContract, parseAdr, contractRefs, phaseNodeOf } from "../skills/hsdd-auto/scripts/lib/tree.mjs";
import { parseLayout, resolveLayout } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { makeRepo, gitIn, SKILLS } from "./helpers/auto-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "auto");
const OVERLAYS = join(FIXTURES, "tree");
const STAGES = ["00-empty", "01-root", "02-adrs", "03-contracts", "04-mid", "05-phase-api", "06-planned"];
const LAYOUT = parseLayout("");

const repos = new Map();
const repo = (stage) => {
  if (!repos.has(stage)) repos.set(stage, makeRepo({ stage }));
  return repos.get(stage);
};
const tree = (stage) => loadTree(repo(stage), LAYOUT, { root: "shop" });

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

// ---------- the brief's tests ----------

test("root stage: nodes, kinds and citations", () => {
  const t = loadTree(repo("01-root"), LAYOUT, { root: "shop" });
  assert.deepEqual([...t.nodes.keys()].sort(), ["shop", "shop.api", "shop.web"]);
  assert.equal(t.nodes.get("shop.web").kind, "internal");
  assert.deepEqual(t.nodes.get("shop.web").decomposesInto, []);
  assert.deepEqual(t.adrCites.map((c) => c.id), ["ADR-001", "ADR-001"]);
  assert.deepEqual(t.contractNames.map((c) => c.slug).sort(), ["order-api", "order-api"]);
  assert.deepEqual(t.mentionOrder, ["shop.api", "shop.web"]);
});
test("planned stage: phase plan, summary table, stamped pending sections", () => {
  const n = loadTree(repo("06-planned"), LAYOUT, { root: "shop" }).nodes.get("shop.api");
  assert.equal(n.hasSummaryTable, true); assert.deepEqual(n.phases.map((p) => p.id), ["shop.api.1", "shop.api.2"]);
  assert.deepEqual(n.pending, { present: true, entries: 0 });
});
test("pending entries counted before reconcile", () => assert.equal(loadTree(repo("05-phase-api"), LAYOUT, { root: "shop" }).nodes.get("shop.api").pending.entries, 1));
test("title separators :, em dash, en dash and ' - ' all parse", () => {
  for (const sep of [":", " \u2014", " \u2013", " -"]) {
    const n = parseNodeSpec(`# shop.api${sep} Order API\n\n## Node\n\n- **Kind:** leaf-parent\n`, "hsdd/spec/shop.api.md");
    assert.equal(n.titleId, "shop.api", JSON.stringify(sep));
    assert.equal(n.name, "Order API", JSON.stringify(sep));
    assert.equal(n.kind, "leaf-parent");
  }
  const tight = parseNodeSpec("# shop.api\u2014Order API\n", "hsdd/spec/shop.api.md");
  assert.equal(tight.titleId, "shop.api");
  assert.equal(tight.name, "Order API");
  const bare = parseNodeSpec("# Order API\n", "hsdd/spec/shop.api.md");
  assert.equal(bare.titleId, null);
  assert.equal(bare.name, "Order API");
  assert.equal(parseNodeSpec("no title\n", "hsdd/spec/shop.api.md").title, null);
});
test("contract refs with (ext) and bracket lists", () => assert.deepEqual(contractRefs("[user-store@v1 (ext)], [auth-token@v2]"), [{ slug: "user-store", version: "v1", ext: true }, { slug: "auth-token", version: "v2", ext: false }]));
test("phaseNodeOf", () => assert.equal(phaseNodeOf("acme.backend.billing.2"), "acme.backend.billing"));

// ---------- more on the parsers ----------

test("contractRefs: none, duplicates, backticks and versions above 9", () => {
  assert.deepEqual(contractRefs("none"), []);
  assert.deepEqual(contractRefs(""), []);
  assert.deepEqual(contractRefs(null), []);
  assert.deepEqual(contractRefs("`order-api@v12`, order-api@v12, [session@v2] (ext)"), [
    { slug: "order-api", version: "v12", ext: false },
    { slug: "session", version: "v2", ext: true },
  ]);
  assert.deepEqual(contractRefs("[a@v1 (ext), b@v1]"), [{ slug: "a", version: "v1", ext: true }, { slug: "b", version: "v1", ext: false }]);
});
test("phaseNodeOf leaves an id without a numeric tail unchanged", () => {
  assert.equal(phaseNodeOf("shop.api"), "shop.api");
  assert.equal(phaseNodeOf("shop.api.12"), "shop.api");
  assert.equal(phaseNodeOf("shop"), "shop");
});
test("node fields: own block under ## Node, before the first ## or a ### of its own id", () => {
  const underNode = parseNodeSpec([
    "# shop.web: Web App", "", "Intro.", "", "## Node", "",
    "- **Kind:** Internal", "- **Purpose:** every screen", "- **Team:** web",
    "- **Consumes:** [order-api@v1], [auth-token@v2 (ext)]", "- **Produces:** none",
    "- **Governed by:** [ADR-002, ADR-010]",
    "- **Sources:** [`ref/spec.md` (§3, §4)], ref/brand.md", "- **Adopted:** As-built", "- **Status:** retired",
    "- **Decomposes into:** [shop.web.app], shop.web.admin (later)", "",
    "## Child nodes", "", "### shop.web.app: Storefront", "", "- **Kind:** leaf-parent", "- **Purpose:** the store", "",
    "### shop.web.admin \u2014 Admin", "", "- **Kind:** leaf-parent", "",
    "### Notes", "", "- not a node", "",
    "## Observed surface", "", "- routes", "",
  ].join("\n"), "hsdd/spec/shop.web.md");
  assert.equal(underNode.id, "shop.web");
  assert.equal(underNode.file, "hsdd/spec/shop.web.md");
  assert.equal(underNode.title, "shop.web: Web App");
  assert.equal(underNode.kind, "internal");
  assert.equal(underNode.purpose, "every screen");
  assert.equal(underNode.team, "web");
  assert.deepEqual(underNode.consumes, [{ slug: "order-api", version: "v1", ext: false }, { slug: "auth-token", version: "v2", ext: true }]);
  assert.deepEqual(underNode.produces, []);
  assert.deepEqual(underNode.governedBy, ["ADR-002", "ADR-010"]);
  assert.deepEqual(underNode.sources, ["ref/spec.md (§3, §4)", "ref/brand.md"]);
  assert.equal(underNode.adopted, "as-built");
  assert.equal(underNode.status, "retired");
  assert.deepEqual(underNode.decomposesInto, ["shop.web.app", "shop.web.admin"]);
  assert.deepEqual(underNode.children, [{ id: "shop.web.app", name: "Storefront" }, { id: "shop.web.admin", name: "Admin" }]);
  assert.equal(underNode.observedSurface, true);
  assert.equal(underNode.hasPhasePlan, false);
  assert.deepEqual(underNode.pending, { present: false, entries: 0 });

  const beforeH2 = parseNodeSpec("# a.b: B\n\n- **Kind:** leaf-parent\n- **Decomposes into:** phases (see hsdd-phase-plan)\n\n## Overview\n\n- **Kind:** internal\n", "hsdd/spec/a.b.md");
  assert.equal(beforeH2.kind, "leaf-parent");
  assert.deepEqual(beforeH2.decomposesInto, []);
  assert.equal(beforeH2.observedSurface, false);

  const ownH3 = parseNodeSpec("# a.b: B\n\n## Spec\n\n### a.b: B\n\n- **Kind:** leaf-parent\n- **Purpose:** p\n", "hsdd/spec/a.b.md");
  assert.equal(ownH3.kind, "leaf-parent");
  assert.deepEqual(ownH3.children, []);

  const none = parseNodeSpec("# a.b: B\n\n## Overview\n\ntext\n", "hsdd/spec/a.b.md");
  assert.equal(none.kind, null);
  assert.equal(none.purpose, null);
  assert.deepEqual(none.consumes, []);
  assert.deepEqual(none.decomposesInto, []);
});
test("decomposesInto is empty for an empty value, phases, none or prose without ids", () => {
  const dec = (v) => parseNodeSpec(`# a.b: B\n\n- **Kind:** internal\n- **Decomposes into:**${v === null ? "" : ` ${v}`}\n`, "hsdd/spec/a.b.md").decomposesInto;
  assert.deepEqual(dec(null), []);
  assert.deepEqual(dec("phases (see hsdd-phase-plan)"), []);
  assert.deepEqual(dec("Phases"), []);
  assert.deepEqual(dec("none"), []);
  assert.deepEqual(dec("TBD at the next hsdd-spec run"), []);
  assert.deepEqual(dec("`a.b.c`, `a.b.d`"), ["a.b.c", "a.b.d"]);
});
test("phase plan: summary table, full and short phase headings, OQ headings are not phases", () => {
  const text = [
    "# a.b: B", "", "- **Kind:** leaf-parent", "",
    "## Phase Plan", "", "**Default gate:** `npm test`", "",
    "| Phase | Name | Tier |", "|------:|------|------|", "| 1 | Types | gate-only |", "| b.2 | Store | spot-check |", "",
    "### 1: Types", "", "- **Consumes:** none", "- **Produces:** none", "- **Scope:** types", "",
    "### b.2 \u2013 Store", "", "- **Consumes:** [x@v1]", "- **Produces:** [y@v2]", "- **Governed by:** [ADR-003]", "- **Scope:** store", "",
    "### a.b.3 - Wiring", "", "- **Scope:** wiring", "",
    "### Phase dependency graph", "", "```mermaid", "flowchart TD", "### 9: not a heading inside a fence", "```", "",
    "## Open questions", "", "### OQ-B1: Retention", "", "Open.", "", "### OQ2 - Region", "",
  ].join("\n");
  const n = parseNodeSpec(text, "hsdd/spec/a.b.md");
  assert.equal(n.hasPhasePlan, true);
  assert.equal(n.hasSummaryTable, true);
  assert.deepEqual(n.phases.map((p) => [p.id, p.short, p.name]), [["a.b.1", "1", "Types"], ["a.b.2", "b.2", "Store"], ["a.b.3", "a.b.3", "Wiring"]]);
  assert.deepEqual(n.phases[1].consumes, [{ slug: "x", version: "v1", ext: false }]);
  assert.deepEqual(n.phases[1].produces, [{ slug: "y", version: "v2", ext: false }]);
  assert.deepEqual(n.phases[1].governedBy, ["ADR-003"]);
  assert.deepEqual(n.phases[0].governedBy, []);

  const noTable = parseNodeSpec("# a.b: B\n\n## Phase Plan\n\n| Step | Name |\n|---|---|\n| 1 | x |\n\n### a.b.1: X\n", "hsdd/spec/a.b.md");
  assert.equal(noTable.hasPhasePlan, true);
  assert.equal(noTable.hasSummaryTable, false);
  const tableElsewhere = parseNodeSpec("# a.b: B\n\n## Overview\n\n| Phase | Name |\n|---|---|\n| 1 | x |\n\n## Phase Plan\n\ntext\n", "hsdd/spec/a.b.md");
  assert.equal(tableElsewhere.hasSummaryTable, false);
  assert.equal(parseNodeSpec("# a.b: B\n\n### a.b.1: before any plan\n", "hsdd/spec/a.b.md").phases.length, 0);
});
test("pending section: entries are top-level confirm, note, amend and request bullets", () => {
  const text = [
    "# a.b: B", "", "## Governance updates (pending reconcile)", "",
    "> Emitted by hsdd-phase-plan on 2026-10-21. Drained by hsdd-reconcile;", "> do not apply by hand.", "",
    "- confirm `x@v1` produced_by: [a.b.1]", "  - note: a sub-bullet is rationale, not an entry",
    "- note: a new package", "- **amend** `x@v1`: ordering guaranteed", "- request `y@v1`: who owns retries?",
    "  - assumption: the caller", "  - contingent phases: a.b.2 (OQ-B1)", "- something else", "",
    "## Open questions", "", "- confirm in another section is not an entry", "",
  ].join("\n");
  assert.deepEqual(parseNodeSpec(text, "hsdd/spec/a.b.md").pending, { present: true, entries: 4 });
  const stamped = "# a.b: B\n\n## Governance updates (pending reconcile)\n\n> Reconciled 2026-10-22 by hsdd-reconcile. Drained entries are in git history.\n";
  assert.deepEqual(parseNodeSpec(stamped, "hsdd/spec/a.b.md").pending, { present: true, entries: 0 });
  const appended = `${text.split("## Open questions")[0]}## Governance updates (pending reconcile)\n\n- note: second emission\n`;
  assert.equal(parseNodeSpec(appended, "hsdd/spec/a.b.md").pending.entries, 5);
});
test("parseContract reads lenient front matter and the body sections", () => {
  const c = parseContract([
    "---", "id: order-api", "version: v2   # bumped", "status: \"stable\"", "kind: api", "owner: shop.api",
    "compatibility: versioned", "produced_by:", "  - shop.api.2", "  - 'shop.api.3'", "consumers: [shop.web.app.1, shop.web.app.2]",
    "governed_by: [ADR-001]", "phase_ids: final", "validation: grandfathered", "# a comment line", "---", "",
    "# Contract: order-api", "", "## Versioning", "", "- v2 current; v1 stays until shop.web.app migrates.",
    "- **Breaking:** removing a field.", "", "## Validation", "",
    "- schema: `hsdd/contract/schema/order-api.schema.json`", "- fixture: ./hsdd/contract/fixture/order-api/", "- fixtures: hsdd/contract/fixture/extra/", "",
  ].join("\n"), "hsdd/contract/order-api.md");
  assert.equal(c.slug, "order-api");
  assert.equal(c.file, "hsdd/contract/order-api.md");
  assert.equal(c.version, "v2");
  assert.equal(c.status, "stable");
  assert.equal(c.phaseIds, "final");
  assert.equal(c.owner, "shop.api");
  assert.deepEqual(c.producedBy, ["shop.api.2", "shop.api.3"]);
  assert.deepEqual(c.consumers, ["shop.web.app.1", "shop.web.app.2"]);
  assert.deepEqual(c.governedBy, ["ADR-001"]);
  assert.equal(c.compatibility, "versioned");
  assert.equal(c.validation, "grandfathered");
  assert.deepEqual(c.validationPaths, [
    { kind: "schema", path: "hsdd/contract/schema/order-api.schema.json" },
    { kind: "fixture", path: "hsdd/contract/fixture/order-api/" },
    { kind: "fixture", path: "hsdd/contract/fixture/extra/" },
  ]);
  assert.match(c.versioningText, /^- v2 current/);
  assert.equal(c.breakingLine, "removing a field.");
  assert.equal(c.front.kind, "api");

  const bare = parseContract("# Contract: x\n", "hsdd/contract/x.md");
  assert.equal(bare.front, null);
  assert.equal(bare.version, null);
  assert.deepEqual(bare.producedBy, []);
  assert.deepEqual(bare.validationPaths, []);
  assert.equal(bare.versioningText, null);
  assert.equal(bare.breakingLine, null);
  assert.deepEqual(parseContract("---\nid: y\nconsumers: shop.web\n---\n", "hsdd/contract/y.md").consumers, ["shop.web"]);
  assert.equal(parseContract("---\r\nid: z\r\nstatus: draft\r\n---\r\n", "hsdd/contract/z.md").status, "draft");
});
test("parseAdr takes the id from front matter, else from the file name", () => {
  const a = parseAdr("---\nid: ADR-001\nstatus: accepted\naffects: [shop.api, order-api@v1]\ndate: 2026-10-20\n---\n# ADR-001: x\n", "hsdd/adr/001-order-ids.md");
  assert.deepEqual({ id: a.id, file: a.file, status: a.status, affects: a.affects, date: a.date }, {
    id: "ADR-001", file: "hsdd/adr/001-order-ids.md", status: "accepted", affects: ["shop.api", "order-api@v1"], date: "2026-10-20",
  });
  const b = parseAdr("# ADR-7: no front matter\n", "hsdd/adr/7-x.md");
  assert.equal(b.id, "ADR-007");
  assert.equal(b.front, null);
  assert.deepEqual(b.affects, []);
  assert.equal(b.status, null);
});

// ---------- the staged fixture tree ----------

test("stage 00 has nothing under hsdd/ and keeps its own normative source", () => {
  assert.ok(!existsSync(join(OVERLAYS, "00-empty", "hsdd")));
  const dir = repo("00-empty");
  assert.match(readFileSync(join(dir, "ref/spec.md"), "utf8"), /^# Shop: product specification/);
  const t = tree("00-empty");
  assert.equal(t.root, "shop");
  assert.equal(t.rootFile, null);
  assert.equal(t.nodes.size, 0);
  assert.deepEqual(t.mentionOrder, []);
  assert.deepEqual(t.specFiles, []);
  assert.equal(t.contracts.size, 0);
  assert.equal(t.adrs.size, 0);
});
test("stage 01: the root, embedded children, sources, the open question", () => {
  const t = tree("01-root");
  assert.equal(t.rootFile, "hsdd/spec/shop.md");
  const root = t.nodes.get("shop");
  assert.equal(root.kind, "internal");
  assert.deepEqual(root.decomposesInto, ["shop.api", "shop.web"]);
  assert.deepEqual(root.children, [{ id: "shop.api", name: "Order API" }, { id: "shop.web", name: "Web App" }]);
  assert.deepEqual(root.sources, ["ref/spec.md"]);
  const api = t.nodes.get("shop.api");
  assert.equal(api.kind, "leaf-parent");
  assert.deepEqual(api.produces, [{ slug: "order-api", version: "v1", ext: false }]);
  assert.deepEqual(api.governedBy, ["ADR-001"]);
  assert.deepEqual(api.decomposesInto, []);
  assert.equal(api.hasPhasePlan, false);
  assert.deepEqual(t.adrCites, [{ id: "ADR-001", file: "hsdd/spec/shop.api.md" }, { id: "ADR-001", file: "hsdd/spec/shop.md" }]);
  assert.deepEqual(t.oqDefs, [{ id: "OQ1", file: "hsdd/spec/shop.md" }]);
  assert.deepEqual(t.oqCites.map((c) => `${c.id} ${c.file}`), ["OQ1 hsdd/spec/shop.api.md", "OQ1 hsdd/spec/shop.md"]);
  assert.deepEqual(t.contractCites.map((c) => `${c.slug}@${c.version} ${c.file}`), [
    "order-api@v1 hsdd/spec/shop.api.md", "order-api@v1 hsdd/spec/shop.md", "order-api@v1 hsdd/spec/shop.web.md",
  ]);
  assert.deepEqual(t.contractNames, [
    { slug: "order-api", version: "v1", ext: false, file: "hsdd/spec/shop.api.md", node: "shop.api" },
    { slug: "order-api", version: "v1", ext: false, file: "hsdd/spec/shop.web.md", node: "shop.web" },
  ]);
  assert.deepEqual(t.specFiles.map((f) => f.file), ["hsdd/spec/shop.api.md", "hsdd/spec/shop.md", "hsdd/spec/shop.web.md"]);
  assert.equal(t.contracts.size, 0);
  assert.equal(t.adrs.size, 0);
});
test("stage 02: the ADR file", () => {
  const t = tree("02-adrs");
  const adr = t.adrs.get("ADR-001");
  assert.equal(adr.file, "hsdd/adr/001-order-ids.md");
  assert.equal(adr.status, "accepted");
  assert.deepEqual(adr.affects, ["shop.api", "order-api@v1"]);
  assert.equal(adr.date, "2026-10-20");
  assert.deepEqual(t.adrCites.map((c) => c.file), ["hsdd/spec/shop.api.md", "hsdd/spec/shop.md", "hsdd/adr/001-order-ids.md"]);
  assert.ok(t.contractCites.some((c) => c.file === "hsdd/adr/001-order-ids.md" && c.slug === "order-api"));
});
test("stage 03: the draft contract, its validation files and the registries", () => {
  const t = tree("03-contracts");
  assert.deepEqual([...t.contracts.keys()], ["order-api"]);
  const c = t.contracts.get("order-api");
  assert.equal(c.status, "draft");
  assert.equal(c.phaseIds, "provisional");
  assert.deepEqual(c.governedBy, ["ADR-001"]);
  assert.equal(c.owner, "shop.api");
  assert.equal(c.compatibility, "versioned");
  assert.match(c.breakingLine, /^removing or retyping a field/);
  assert.deepEqual(c.validationPaths.map((v) => v.kind), ["schema", "fixture"]);
  for (const v of c.validationPaths) assert.ok(existsSync(join(repo("03-contracts"), v.path)), v.path);
  assert.deepEqual(c.fixtureFiles, ["hsdd/contract/fixture/order-api/create-order.json", "hsdd/contract/fixture/order-api/get-missing-order.json"]);
  assert.equal(c.schemaFile, "hsdd/contract/schema/order-api.schema.json");
  assert.match(c.text, /^---\nid: order-api/);
  assert.ok(!t.contracts.has("INDEX"));
  assert.ok(!t.adrs.has("INDEX"));
  assert.ok(!t.contractCites.some((x) => x.file.endsWith("INDEX.md")));
});
test("stage 04: the web app decomposed; mention order follows the root, then the parent", () => {
  const t = tree("04-mid");
  assert.equal(t.nodes.size, 4);
  assert.deepEqual(t.nodes.get("shop.web").decomposesInto, ["shop.web.app"]);
  assert.equal(t.nodes.get("shop.web.app").kind, "leaf-parent");
  assert.deepEqual(t.nodes.get("shop.web.app").consumes, [{ slug: "order-api", version: "v1", ext: false }]);
  assert.deepEqual(t.mentionOrder, ["shop.api", "shop.web", "shop.web.app"]);
  assert.deepEqual(t.contractNames.map((c) => c.node), ["shop.api", "shop.web", "shop.web.app"]);
});
test("stage 05: shop.api planned with one pending entry; shop.web.app unplanned", () => {
  const t = tree("05-phase-api");
  const api = t.nodes.get("shop.api");
  assert.equal(api.hasPhasePlan, true);
  assert.equal(api.hasSummaryTable, true);
  assert.deepEqual(api.phases.map((p) => p.id), ["shop.api.1", "shop.api.2"]);
  assert.deepEqual(api.phases[1].produces, [{ slug: "order-api", version: "v1", ext: false }]);
  assert.equal(t.nodes.get("shop.web.app").hasPhasePlan, false);
  assert.deepEqual(t.nodes.get("shop.web.app").pending, { present: false, entries: 0 });
});
test("stage 06 is a finished plan segment", () => {
  const dir = repo("06-planned");
  const t = tree("06-planned");
  const leafParents = [...t.nodes.values()].filter((n) => n.kind === "leaf-parent");
  assert.deepEqual(leafParents.map((n) => n.id), ["shop.api", "shop.web.app"]);
  for (const n of leafParents) {
    assert.equal(n.hasSummaryTable, true, n.id);
    assert.deepEqual(n.pending, { present: true, entries: 0 }, n.id);
  }
  for (const n of t.nodes.values()) {
    assert.equal(n.titleId, n.id, n.file);
    assert.ok(n.kind, n.file);
    for (const child of n.decomposesInto) assert.ok(t.nodes.has(child), `${n.id} names ${child}`);
  }
  const c = t.contracts.get("order-api");
  assert.equal(c.status, "stable");
  assert.equal(c.phaseIds, "final");
  const schema = c.validationPaths.find((v) => v.kind === "schema");
  const fixture = c.validationPaths.find((v) => v.kind === "fixture");
  assert.ok(statSync(join(dir, schema.path)).isFile());
  assert.ok(readdirSync(join(dir, fixture.path)).length > 0);
  for (const pid of [...c.producedBy, ...c.consumers]) {
    const node = t.nodes.get(phaseNodeOf(pid));
    assert.ok(node?.phases.some((p) => p.id === pid), `${pid} is a phase heading`);
  }
  for (const adr of t.adrs.values()) {
    for (const target of adr.affects) {
      const slug = target.replace(/@v\d+$/, "");
      const governed = t.nodes.get(target)?.governedBy ?? t.contracts.get(slug)?.governedBy;
      assert.ok(governed?.includes(adr.id), `${target} is governed by ${adr.id}`);
    }
  }
  for (const cite of t.adrCites) assert.ok(t.adrs.has(cite.id), cite.id);
  for (const cite of t.contractCites) assert.equal(t.contracts.get(cite.slug)?.version, cite.version, `${cite.slug}@${cite.version} in ${cite.file}`);
  const defined = new Set(t.oqDefs.map((d) => d.id));
  assert.equal(defined.size, t.oqDefs.length);
  for (const cite of t.oqCites) assert.ok(defined.has(cite.id), cite.id);
  assert.deepEqual(t.mentionOrder, ["shop.api", "shop.web", "shop.web.app"]);
});
test("every stage from 03 regenerates its registries byte for byte", () => {
  const bundled = readFileSync(join(SKILLS, "hsdd-contract", "scripts", "gen-registry.mjs"));
  for (const stage of STAGES.slice(3)) {
    const dir = makeRepo({ stage });
    assert.ok(readFileSync(join(dir, "hsdd/scripts/gen-registry.mjs")).equals(bundled), stage);
    execFileSync(process.execPath, ["hsdd/scripts/gen-registry.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(gitIn(dir, "status", "--porcelain"), "", stage);
  }
});
test("stage overlays carry no em dash", () => {
  for (const file of walk(FIXTURES)) {
    assert.ok(!readFileSync(file, "utf8").includes("\u2014"), file);
  }
});
test("loadTree honours a relocated spec directory and infers the root", () => {
  const dir = makeRepo({ stage: "01-root", commit: false });
  const conventions = join(dir, "hsdd/conventions.md");
  writeFileSync(conventions, readFileSync(conventions, "utf8").replace("`hsdd/spec/{node-id}.md`", "`docs/arch/{node-id}.md`"));
  mkdirSync(join(dir, "docs"));
  renameSync(join(dir, "hsdd/spec"), join(dir, "docs/arch"));
  const layout = resolveLayout(dir);
  assert.equal(layout.spec, "docs/arch");
  const t = loadTree(dir, layout, {});
  assert.equal(t.root, "shop");
  assert.equal(t.rootFile, "docs/arch/shop.md");
  assert.equal(t.nodes.get("shop.api").file, "docs/arch/shop.api.md");
});
test("mention order: unmentioned nodes follow in file order; the root is never listed", () => {
  const dir = makeRepo({ stage: "01-root", files: {
    "hsdd/spec/shop.zeta.md": "# shop.zeta: Z\n\n- **Kind:** leaf-parent\n",
    "hsdd/spec/shop.alpha.md": "# shop.alpha: A\n\n- **Kind:** leaf-parent\n",
    "hsdd/spec/shop.web.md": "# shop.web: Web\n\n- **Kind:** internal\n- **Decomposes into:** shop.web.app\n\nSee hsdd/spec/shop.zeta.md.\n",
  } });
  const t = loadTree(dir, LAYOUT, { root: "shop" });
  assert.deepEqual(t.mentionOrder, ["shop.api", "shop.web", "shop.zeta", "shop.alpha"]);
});
test("open-question definitions need a separator or the end of the heading", () => {
  const dir = makeRepo({ stage: "01-root", files: {
    "hsdd/spec/shop.web.md": "# shop.web: Web\n\n- **Kind:** internal\n\n## Open questions\n\n### OQ-W1 \u2014 Fonts\n\n### OQ-W2\n\n### OQ3x: not a definition\n\n#### OQ-W4: wrong level\n\nCites OQ-W1, OQ9 and OQ-W1 again.\n",
  } });
  const t = loadTree(dir, LAYOUT, { root: "shop" });
  assert.deepEqual(t.oqDefs.map((d) => d.id), ["OQ1", "OQ-W1", "OQ-W2"]);
  assert.deepEqual(t.oqCites.filter((c) => c.file === "hsdd/spec/shop.web.md").map((c) => c.id), ["OQ-W1", "OQ-W2", "OQ-W4", "OQ9"]);
});

test("phase headings count only inside the Phase Plan section", () => {
  const n = parseNodeSpec([
    "# a.b: B", "", "- **Kind:** leaf-parent", "",
    "## Phase Plan", "", "### a.b.1: Inside", "", "- **Scope:** x", "",
    "## Notes", "", "### a.b.2: Outside the plan", "", "- **Scope:** y", "",
  ].join("\n"), "hsdd/spec/a.b.md");
  assert.deepEqual(n.phases.map((p) => p.id), ["a.b.1"]);
});
test("mention order: a leaf-parent's spec does not contribute", () => {
  const dir = makeRepo({ stage: "01-root", files: {
    "hsdd/spec/shop.api.md": "# shop.api: API\n\n- **Kind:** leaf-parent\n- **Decomposes into:** phases\n\nSee hsdd/spec/shop.zeta.md.\n",
    "hsdd/spec/shop.zeta.md": "# shop.zeta: Z\n\n- **Kind:** leaf-parent\n",
    "hsdd/spec/shop.alpha.md": "# shop.alpha: A\n\n- **Kind:** leaf-parent\n",
  } });
  const t = loadTree(dir, LAYOUT, { root: "shop" });
  assert.deepEqual(t.mentionOrder, ["shop.api", "shop.web", "shop.alpha", "shop.zeta"]);
});
test("from stage 04 the root's embedded shop.web block names shop.web.app", () => {
  assert.deepEqual(tree("04-mid").nodes.get("shop").decomposesInto, ["shop.api", "shop.web"]);
  assert.match(readFileSync(join(repo("04-mid"), "hsdd/spec/shop.md"), "utf8"), /\*\*Decomposes into:\*\* shop\.web\.app/);
});
