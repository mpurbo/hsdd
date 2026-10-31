import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { c2, c3, c3Cited, c4, c5, c6, c7, c8, inScope, treeChecks } from "../skills/hsdd-auto/scripts/lib/checks.mjs";
import { checkRegistries } from "../skills/hsdd-auto/scripts/lib/registry.mjs";
import { loadTree } from "../skills/hsdd-auto/scripts/lib/tree.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { loadIntakeRecords, parseIntakeRecord } from "../skills/hsdd-auto/scripts/lib/intake.mjs";
import { resolveLayout } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { makeRepo } from "./helpers/auto-repo.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const INTAKE = join(HERE, "fixtures", "auto", "intake");

const repo = (stage) => makeRepo({ stage });
const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const edit = (dir, rel, from, to) => {
  const t = read(dir, rel);
  assert.ok(t.includes(from), `${rel} has no ${JSON.stringify(from)}`);
  put(dir, rel, t.replace(from, to));
};
const treeOf = (dir) => loadTree(dir, resolveLayout(dir), { root: "shop" });
const ids = (fs) => fs.map((f) => `${f.level}:${f.id}`);
const API = "hsdd/spec/shop.api.md";
const WEB = "hsdd/spec/shop.web.app.md";
const CONTRACT = "hsdd/contract/order-api.md";
const ADR = "hsdd/adr/001-order-ids.md";
const intakeRecord = (name) => parseIntakeRecord(readFileSync(join(INTAKE, name), "utf8"), `hsdd/management/${name}`);

// ---------- C0 and C1 ----------

test("C0 passes with the generator and fails without it", () => {
  const dir = repo("03-contracts");
  assert.deepEqual(checkRegistries(dir, resolveLayout(dir)).c0, []);
  rmSync(join(dir, "hsdd/scripts/gen-registry.mjs"));
  const { c0 } = checkRegistries(dir, resolveLayout(dir));
  assert.equal(c0.length, 1);
  assert.equal(c0[0].id, "C0");
  assert.equal(c0[0].level, "error");
});

test("C1 passes on a regenerated tree and fails on a stale registry", () => {
  const dir = repo("03-contracts");
  assert.deepEqual(checkRegistries(dir, resolveLayout(dir)).c1, []);
  edit(dir, CONTRACT, "status: draft", "status: stable");
  const { c1 } = checkRegistries(dir, resolveLayout(dir));
  assert.equal(c1.length, 1);
  assert.equal(c1[0].id, "C1");
  assert.equal(c1[0].level, "error");
  assert.equal(c1[0].file, "hsdd/contract/INDEX.md");
});

test("C1 fails when the registry is missing", () => {
  const dir = repo("03-contracts");
  rmSync(join(dir, "hsdd/contract/INDEX.md"));
  assert.deepEqual(checkRegistries(dir, resolveLayout(dir)).c1.map((f) => f.file), ["hsdd/contract/INDEX.md"]);
});

const hashTree = (dir) => {
  const walk = (d) => readdirSync(d).sort().flatMap((n) => {
    const full = join(d, n);
    return statSync(full).isDirectory() ? walk(full) : [`${full} ${createHash("sha256").update(readFileSync(full)).digest("hex")}`];
  });
  return walk(join(dir, "hsdd"));
};

test("C1 writes nothing into the tree", () => {
  for (const dirty of [false, true]) {
    const dir = repo("03-contracts");
    if (dirty) edit(dir, CONTRACT, "status: draft", "status: stable");
    const before = hashTree(dir);
    const tmpRoot = mkdtempSync(join(tmpdir(), "hsdd-checks-test-"));
    checkRegistries(dir, resolveLayout(dir), { tmpRoot });
    assert.deepEqual(hashTree(dir), before);
    assert.deepEqual(readdirSync(tmpRoot), [], "the temporary copy is removed");
    rmSync(tmpRoot, { recursive: true });
  }
});

test("C1 catches a stale registry left after every contract and ADR was removed", () => {
  const dir = repo("03-contracts");
  rmSync(join(dir, CONTRACT));
  rmSync(join(dir, ADR));
  const { c1 } = checkRegistries(dir, resolveLayout(dir));
  assert.deepEqual(c1.map((f) => f.file).sort(), ["hsdd/adr/INDEX.md", "hsdd/contract/INDEX.md"]);
});

test("C1 is skipped with a warning when the layout is relocated", () => {
  const dir = repo("03-contracts");
  put(dir, "hsdd/conventions.md", "# Conventions\n\n## Layout\n\n- `hsdd/spec/{node-id}.md`  specs\n- `docs/contract/{slug}.md`  contracts\n");
  const layout = resolveLayout(dir);
  assert.equal(layout.relocated, true);
  const r = checkRegistries(dir, layout);
  assert.equal(r.skipped, true);
  assert.deepEqual(r.c1.map((f) => f.level), ["warn"]);
  assert.match(r.c1[0].message, /skipped/);
});

test("C0 and C4 skip INDEX.md", () => {
  const dir = repo("03-contracts");
  rmSync(join(dir, CONTRACT));
  rmSync(join(dir, "hsdd/scripts/gen-registry.mjs"));
  assert.deepEqual(checkRegistries(dir, resolveLayout(dir)).c0, [], "INDEX.md alone is not a contract file");
  assert.deepEqual(c4(treeOf(dir), { repoRoot: dir }), []);
});

test("generator checks are skipped before the first contract", () => {
  const dir = repo("02-adrs");
  const r = checkRegistries(dir, resolveLayout(dir));
  assert.deepEqual(r.c0, []);
  assert.deepEqual(r.c1, []);
  assert.equal(r.skipped, false);
});

test("the context wires the registry check", () => {
  const dir = repo("03-contracts");
  const ctx = loadContext(dir);
  assert.deepEqual(ctx.registry(), { c0: [], c1: [], skipped: false });
  assert.equal(ctx.registry(), ctx.registry(), "memoized");
  assert.deepEqual(loadContext(dir, { registry: () => "injected" }).registry(), "injected");
});

// ---------- C2 ----------

test("C2 passes on a finished tree", () => assert.deepEqual(c2(treeOf(repo("06-planned"))), []));

test("C2 reports a title that does not match, a missing Kind and a child with no spec file", () => {
  const dir = repo("06-planned");
  edit(dir, API, "# shop.api: Order API", "# shop.orders: Order API");
  edit(dir, WEB, "- **Kind:** leaf-parent", "- **Purpose2:** x");
  rmSync(join(dir, "hsdd/spec/shop.web.md"));
  const fs = c2(treeOf(dir));
  assert.ok(fs.every((f) => f.id === "C2" && f.level === "error"));
  assert.deepEqual(fs.map((f) => f.file).sort(), [API, WEB, "hsdd/spec/shop.md"].sort());
  assert.match(fs.find((f) => f.file === "hsdd/spec/shop.md").message, /shop\.web/);
});

// ---------- C3 ----------

test("C3 passes on a finished tree", () => assert.deepEqual(c3(treeOf(repo("06-planned")), {}), []));

test("C3 reports front matter that lacks a field", () => {
  const dir = repo("06-planned");
  edit(dir, ADR, "date: 2026-10-20\n", "");
  const fs = c3(treeOf(dir), {});
  assert.deepEqual(ids(fs), ["error:C3"]);
  assert.equal(fs[0].file, ADR);
});

test("C3 reports a cited ADR with no file, and warns when a stage rule will create it", () => {
  const dir = repo("06-planned");
  edit(dir, API, "- **Governed by:** [ADR-001]\n- **Sources", "- **Governed by:** [ADR-001, ADR-002]\n- **Sources");
  const fs = c3(treeOf(dir), {});
  assert.deepEqual(ids(fs), ["error:C3"]);
  assert.equal(fs[0].file, API);
  assert.match(fs[0].message, /ADR-002/);
  assert.deepEqual(ids(c3(treeOf(dir), { willCreateAdrs: new Set(["ADR-002"]) })), ["warn:C3"]);
  assert.deepEqual(ids(c3(treeOf(dir), { willCreateAdrs: ["ADR-002"] })), ["warn:C3"]);
});

test("C3 requires Governed by on the affects target, and names the target's file", () => {
  const dir = repo("06-planned");
  edit(dir, API, "- **Governed by:** [ADR-001]\n- **Sources", "- **Governed by:** none\n- **Sources");
  edit(dir, API, "- **Governed by:** [ADR-001]\n- **Scope:** order and line", "- **Governed by:** none\n- **Scope:** order and line");
  const fs = c3(treeOf(dir), {});
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", API]]);
});

test("C3 reads the contract side of Governed by from governed_by", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "governed_by: [ADR-001]\n", "");
  const fs = c3(treeOf(dir), {});
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", CONTRACT]]);
});

test("C3 warns on an affects target with no file", () => {
  const dir = repo("06-planned");
  edit(dir, ADR, "affects: [shop.api, order-api@v1]", "affects: [shop.api, order-api@v1, shop.missing]");
  const fs = c3(treeOf(dir), {});
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["warn", null]]);
  assert.match(fs[0].message, /shop\.missing/);
});

// ---------- C4 ----------

const c4of = (dir) => c4(treeOf(dir), { repoRoot: dir });

test("C4 passes on a finished tree", () => assert.deepEqual(c4of(repo("06-planned")), []));

test("C4 reports a missing front-matter field and an id that does not match the file", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "owner: shop.api\n", "");
  edit(dir, CONTRACT, "id: order-api", "id: orders");
  const fs = c4of(dir);
  assert.equal(fs.length, 2);
  assert.ok(fs.every((f) => f.id === "C4" && f.level === "error" && f.file === CONTRACT));
});

test("C4 requires phase_ids final for a stable contract, except at v0", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "phase_ids: final", "phase_ids: provisional");
  const fs = c4of(dir);
  assert.deepEqual(fs.map((f) => f.level), ["error"]);
  assert.match(fs[0].message, /phase_ids/);
});

test("C4 exempts v0", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "phase_ids: final", "phase_ids: provisional");
  edit(dir, CONTRACT, "version: v1", "version: v0");
  assert.deepEqual(c4of(dir), []);
});

test("C4 checks the validation paths of a stable contract; a draft without them warns", () => {
  const dir = repo("06-planned");
  rmSync(join(dir, "hsdd/contract/schema/order-api.schema.json"));
  assert.deepEqual(c4of(dir), [], "the fixture directory still has files");
  rmSync(join(dir, "hsdd/contract/fixture"), { recursive: true });
  mkdirSync(join(dir, "hsdd/contract/fixture/order-api"), { recursive: true });
  assert.deepEqual(ids(c4of(dir)), ["error:C4"], "an empty directory does not count");
  edit(dir, CONTRACT, "phase_ids: final", "phase_ids: final\nvalidation: grandfathered");
  assert.deepEqual(c4of(dir), []);
  const draft = repo("06-planned");
  edit(draft, CONTRACT, "status: stable", "status: draft");
  rmSync(join(draft, "hsdd/contract/schema"), { recursive: true });
  rmSync(join(draft, "hsdd/contract/fixture"), { recursive: true });
  assert.deepEqual(ids(c4of(draft)), ["warn:C4"]);
});

// ---------- C5 ----------

test("C5 passes on a finished tree", () => assert.deepEqual(c5(treeOf(repo("06-planned")), {}), []));

test("C5 reports a citation of a version that is not current", () => {
  const dir = repo("06-planned");
  edit(dir, WEB, "- **Consumes:** [order-api@v1]\n- **Produces:** none\n- **Scope:** a typed", "- **Consumes:** [order-api@v2]\n- **Produces:** none\n- **Scope:** a typed");
  const fs = c5(treeOf(dir), {});
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", WEB]]);
  assert.match(fs[0].message, /order-api@v2/);
});

test("C5 accepts a version the Versioning section names, as history", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "version: v1", "version: v2");
  edit(dir, CONTRACT, "- v1 current. Breaking changes require v2 and a migration note; v1 stays until\n  all consumers migrate.", "- v2 current; v1 is retired. Migration note: see below.");
  assert.deepEqual(c5(treeOf(dir), {}), []);
  const stale = repo("06-planned");
  edit(stale, CONTRACT, "version: v1", "version: v3");
  edit(stale, CONTRACT, "- v1 current. Breaking changes require v2 and a migration note; v1 stays until\n  all consumers migrate.", "- v3 current.");
  assert.ok(c5(treeOf(stale), {}).length > 0, "v1 is not named once the section talks about v3 only");
});

test("C5 reports a citation of a contract with no file", () => {
  const dir = repo("06-planned");
  edit(dir, WEB, "- **Consumes:** [order-api@v1]\n- **Produces:** none\n- **Scope:** a typed", "- **Consumes:** [order-api@v1, pay-api@v1]\n- **Produces:** none\n- **Scope:** a typed");
  const fs = c5(treeOf(dir), {});
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", WEB]]);
});

test("C5 warns for a contract a stage rule will create", () => {
  const dir = repo("05-phase-api");
  rmSync(join(dir, "hsdd/contract"), { recursive: true });
  const t = treeOf(dir);
  assert.ok(c5(t, {}).every((f) => f.level === "error" && f.id === "C5"));
  assert.ok(c5(t, {}).length > 0);
  const fs = c5(t, { willCreateContracts: new Set(["order-api"]) });
  assert.ok(fs.length > 0 && fs.every((f) => f.level === "warn"));
  assert.ok(c5(t, { willCreateContracts: ["order-api"] }).every((f) => f.level === "warn"));
});

test("C5 skips an external citation", () => {
  const dir = repo("06-planned");
  edit(dir, WEB, "- **Consumes:** [order-api@v1]\n- **Produces:** none\n- **Scope:** a typed", "- **Consumes:** [order-api@v1, ledger-api@v4 (ext)]\n- **Produces:** none\n- **Scope:** a typed");
  assert.deepEqual(c5(treeOf(dir), {}), []);
});

// ---------- C6 ----------

test("C6 passes on a finished tree", () => assert.deepEqual(c6(treeOf(repo("06-planned"))), []));

test("C6 reports a citation with no definition and a duplicate definition", () => {
  const dir = repo("06-planned");
  edit(dir, API, "(OQ1,", "(OQ7,");
  const fs = c6(treeOf(dir));
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", API]]);
  assert.match(fs[0].message, /OQ7/);
  const dup = repo("06-planned");
  edit(dup, API, "## Governance updates", "### OQ1: Duplicate\n\nAgain.\n\n## Governance updates");
  const dfs = c6(treeOf(dup));
  assert.equal(dfs.length, 1);
  assert.equal(dfs[0].level, "error");
  assert.match(dfs[0].message, /OQ1/);
});

// ---------- C7 ----------

test("C7 passes on a finished tree", () => assert.deepEqual(c7(treeOf(repo("06-planned"))), []));

test("C7 reports a phase id that is not a heading, as a warning while phase_ids is provisional", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "produced_by: [shop.api.2]", "produced_by: [shop.api.9]");
  edit(dir, CONTRACT, "phase_ids: final", "phase_ids: provisional");
  const fs = c7(treeOf(dir));
  assert.deepEqual(fs.map((f) => [f.id, f.level, f.file]), [["C7", "warn", CONTRACT]]);
  edit(dir, CONTRACT, "phase_ids: provisional", "phase_ids: final");
  assert.deepEqual(c7(treeOf(dir)).map((f) => f.level), ["error"]);
});

test("C7 accepts short phase ids", () => {
  const dir = repo("06-planned");
  edit(dir, API, "### shop.api.2: Order endpoints", "### 2: Order endpoints");
  assert.deepEqual(c7(treeOf(dir)), []);
  edit(dir, CONTRACT, "consumers: [shop.web.app.1, shop.web.app.2]", "consumers: [shop.web.app.1, shop.web.app.8]");
  assert.deepEqual(c7(treeOf(dir)).map((f) => f.level), ["error"]);
});

// ---------- C8 ----------

const c8of = (records, over = {}) => c8(records, { intakeStep: false, recordPath: null, tree: treeOf(repo("06-planned")), ...over });

test("C8 passes on valid records", () => {
  assert.deepEqual(c8of(["2026-10-22-intake-order-v2.md", "structural.md"].map(intakeRecord)), []);
});

test("C8 reports a banned slug word", () => {
  const r = { ...intakeRecord("structural.md"), path: "hsdd/management/2026-10-23-intake-atlas-refresh.md", slug: "atlas-refresh" };
  const fs = c8of([r]);
  assert.deepEqual(fs.map((f) => [f.id, f.level, f.file]), [["C8", "error", r.path]]);
});

test("C8 reports a header field that is missing", () => {
  const text = readFileSync(join(INTAKE, "structural.md"), "utf8").replace("- **Collisions:** none\n", "");
  const r = parseIntakeRecord(text, "hsdd/management/2026-10-23-intake-marketplace.md");
  const fs = c8of([r]);
  assert.equal(fs.length, 1);
  assert.match(fs[0].message, /Collisions/i);
});

test("C8 reports a bad block and prompts out of order", () => {
  const fs = c8of([intakeRecord("bad-block.md")]);
  assert.ok(fs.length > 0);
  assert.ok(fs.every((f) => f.id === "C8" && f.level === "error" && f.file === "hsdd/management/bad-block.md"));
});

test("C8 requires the block in an intake step", () => {
  const text = readFileSync(join(INTAKE, "structural.md"), "utf8").replace(/```hsdd-handoffs[\s\S]*?```\n/, "");
  const r = parseIntakeRecord(text, "hsdd/management/2026-10-23-intake-marketplace.md");
  assert.deepEqual(c8of([r]), [], "an absent block is fine outside an intake step");
  const fs = c8of([r], { intakeStep: true, recordPath: r.path });
  assert.equal(fs.length, 1);
  assert.match(fs[0].message, /block/);
  assert.deepEqual(c8of([r], { intakeStep: true, recordPath: "hsdd/management/other.md" }), []);
});

test("C8 allows an empty block only for a structural record", () => {
  const text = readFileSync(join(INTAKE, "structural.md"), "utf8").replace("**Class:** structural", "**Class:** local");
  const r = parseIntakeRecord(text, "hsdd/management/2026-10-23-intake-marketplace.md");
  assert.ok(c8of([r], { intakeStep: true, recordPath: r.path }).length > 0);
  assert.deepEqual(c8of([intakeRecord("structural.md")], { intakeStep: true, recordPath: "hsdd/management/structural.md" }), []);
});

// ---------- all of them ----------

test("treeChecks runs C2 to C8 and passes on a finished tree", () => {
  const dir = repo("06-planned");
  assert.deepEqual(treeChecks(loadContext(dir), {}), []);
});

test("checks report the file", () => {
  const dir = repo("06-planned");
  edit(dir, API, "# shop.api: Order API", "# shop.orders: Order API");
  edit(dir, ADR, "date: 2026-10-20\n", "");
  edit(dir, ADR, "affects: [shop.api, order-api@v1]", "affects: [shop.api, order-api@v1, shop.missing]");
  edit(dir, WEB, "- **Consumes:** [order-api@v1]\n- **Produces:** none\n- **Scope:** a typed", "- **Consumes:** [order-api@v9, pay-api@v1]\n- **Produces:** none\n- **Scope:** a typed");
  edit(dir, API, "(OQ1,", "(OQ7,");
  edit(dir, CONTRACT, "owner: shop.api\n", "");
  edit(dir, CONTRACT, "produced_by: [shop.api.2]", "produced_by: [shop.api.9]");
  const fs = treeChecks(loadContext(dir), {});
  assert.ok(fs.length >= 7);
  assert.deepEqual([...new Set(fs.map((f) => f.id))].sort(), ["C2", "C3", "C4", "C5", "C6", "C7"]);
  for (const f of fs) {
    assert.ok(f.file === null || (typeof f.file === "string" && !f.file.startsWith("/") && f.file.startsWith("hsdd/")), JSON.stringify(f));
    assert.ok(f.level === "error" || f.level === "warn");
    assert.equal(typeof f.message, "string");
  }
  assert.ok(fs.some((f) => f.file === null));
});

test("treeChecks passes the intake record to C8", () => {
  const dir = repo("06-planned");
  const text = readFileSync(join(INTAKE, "structural.md"), "utf8").replace(/```hsdd-handoffs[\s\S]*?```\n/, "");
  put(dir, "hsdd/management/2026-10-23-intake-marketplace.md", text);
  const ctx = loadContext(dir);
  assert.equal(loadIntakeRecords(dir, ctx.layout).length, 1);
  assert.deepEqual(treeChecks(ctx, {}), []);
  const fs = treeChecks(ctx, { intakeStep: true, recordPath: "hsdd/management/2026-10-23-intake-marketplace.md" });
  assert.deepEqual(fs.map((f) => f.id), ["C8"]);
});

// ---------- related files and the scope rule ----------

test("inScope counts a finding by its file or by a related file", () => {
  const changed = new Set(["hsdd/contract/order-api.md"]);
  assert.equal(inScope({ file: "hsdd/contract/order-api.md" }, changed), true);
  assert.equal(inScope({ file: "hsdd/contract/INDEX.md", related: ["hsdd/contract/order-api.md"] }, changed), true);
  assert.equal(inScope({ file: null, related: ["hsdd/contract/order-api.md"] }, changed), true);
  assert.equal(inScope({ file: "hsdd/contract/INDEX.md" }, changed), false);
  assert.equal(inScope({ file: null }, changed), false);
});

test("C0 relates the contract files; C1 the contract and ADR files and the generator", () => {
  const dir = repo("06-planned");
  edit(dir, CONTRACT, "status: stable", "status: draft");
  const [c1] = checkRegistries(dir, resolveLayout(dir)).c1;
  assert.equal(c1.file, "hsdd/contract/INDEX.md");
  assert.deepEqual(c1.related, [CONTRACT, ADR, "hsdd/scripts/gen-registry.mjs"]);
  rmSync(join(dir, "hsdd/scripts/gen-registry.mjs"));
  const [c0] = checkRegistries(dir, resolveLayout(dir)).c0;
  assert.equal(c0.file, "hsdd/scripts/gen-registry.mjs");
  assert.deepEqual(c0.related, [CONTRACT]);
});

test("a generator crash relates the same files as a stale registry", () => {
  const dir = repo("06-planned");
  put(dir, "hsdd/scripts/gen-registry.mjs", "process.exit(3);\n");
  const [c1] = checkRegistries(dir, resolveLayout(dir)).c1;
  assert.match(c1.message, /failed on a temporary copy/);
  assert.deepEqual(c1.related, [CONTRACT, ADR, "hsdd/scripts/gen-registry.mjs"]);
});

test("C3 relates the ADR's own file to a governance finding; C3's citation part is exported", () => {
  const dir = repo("06-planned");
  edit(dir, API, "- **Governed by:** [ADR-001]\n- **Sources", "- **Governed by:** none\n- **Sources");
  edit(dir, API, "- **Governed by:** [ADR-001]\n- **Scope:** order and line", "- **Governed by:** none\n- **Scope:** order and line");
  const [g] = c3(treeOf(dir), {});
  assert.equal(g.file, API);
  assert.deepEqual(g.related, [ADR]);
  edit(dir, API, "- **Governed by:** none\n- **Sources", "- **Governed by:** [ADR-002]\n- **Sources");
  const cited = c3Cited(treeOf(dir), {});
  assert.deepEqual(cited.map((f) => [f.level, f.file, f.related]), [["error", API, undefined]]);
  assert.deepEqual(ids(c3Cited(treeOf(dir), { willCreateAdrs: ["ADR-002"] })), ["warn:C3"]);
});

test("C7 relates the spec file of the phase's node", () => {
  const dir = repo("06-planned");
  edit(dir, WEB, "### shop.web.app.2: Cart and checkout", "### Cart and checkout");
  const [f] = c7(treeOf(dir));
  assert.equal(f.file, CONTRACT);
  assert.equal(f.level, "error");
  assert.deepEqual(f.related, [WEB]);
});
