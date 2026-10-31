import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { P, stepPaths, reportPath, resolveLayout, parseLayout, parseMainLine, globToRegExp, matchesAny, judgementSet, expandHome, ownerFileHash, ownerMatcher } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import {
  KINDS, ORCHESTRATOR_KINDS, SUBAGENT_KINDS, INSERTABLE_KINDS, STOP_CLASSES, STOPPABLE, RAISED_WHEN,
  targetType, skillFor, decisionTypeFor, writeSet, neverPatterns,
} from "../skills/hsdd-auto/scripts/lib/kinds.mjs";
import { withDefaults } from "../skills/hsdd-auto/scripts/lib/config.mjs";
import { baseConfig } from "./helpers/auto-repo.mjs";
import { validate, loadSchema } from "../skills/hsdd-auto/scripts/lib/schema.mjs";

const layout = resolveLayout(mkdtempSync(join(tmpdir(), "hsdd-auto-layout-")));
const tree = {
  nodes: new Map([["shop", {}], ["shop.api", {}], ["checkout", {}]]),
  contracts: new Map([["order-api", {}]]),
};
const cfg = (o = {}) => withDefaults(baseConfig(o));
const ctx = { layout, config: cfg(), segmentId: "2026-10-22-plan", record: null, tree };
const ctxWith = (o) => ({ ...ctx, config: cfg(o) });

test("resolveLayout reads a relocated layout", () => {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-auto-layout-"));
  assert.deepEqual(resolveLayout(dir), {
    spec: "hsdd/spec", contract: "hsdd/contract", adr: "hsdd/adr", management: "hsdd/management", verify: "hsdd/verify", relocated: false,
  });
  mkdirSync(join(dir, "hsdd"));
  writeFileSync(join(dir, P.conventions), [
    "# Conventions", "", "## Layout (custom)", "intro text with `ignored/path.md`",
    "- `docs/arch/{node-id}.md`  nodes",
    "- `docs/contracts/{slug}.md` + `docs/contracts/INDEX.md`",
    "- `docs/contracts/schema/{slug}.schema.json`",
    "- `docs/decisions/{nnn}-{title}.md`",
    "- `docs/verify/{phase-id}.verification.md`",
    "- `docs/management/`", "- `docs/management/archive/`", "", "## Other", "- `elsewhere/{node-id}.md`", "",
  ].join("\n"));
  assert.deepEqual(resolveLayout(dir), {
    spec: "docs/arch", contract: "docs/contracts", adr: "docs/decisions", management: "docs/management", verify: "docs/verify", relocated: true,
  });
});
test("resolveLayout keeps a default for a missing bullet, and only spec relocated is not relocated", () => {
  const l = parseLayout("## Layout (default)\n- `docs/arch/{node-id}.md`\n");
  assert.equal(l.spec, "docs/arch");
  assert.equal(l.contract, "hsdd/contract");
  assert.equal(l.relocated, false);
});
test("parseMainLine: the conventions' **Main line:** branch, main when the line is absent or empty", () => {
  assert.equal(parseMainLine(""), "main");
  assert.equal(parseMainLine("## Main line\n**Main line:** main\n"), "main");
  assert.equal(parseMainLine("## Main line\n**Main line:** `develop`\n\nThe spec repo's branch.\n"), "develop");
  assert.equal(parseMainLine("- **Main line:** release/2026.\n"), "release/2026");
  assert.equal(parseMainLine("**Main line:**\n"), "main");
  assert.equal(parseMainLine("The **Main line:** is not a line of its own.\n"), "main");
});
test("fixed paths and step paths", () => {
  assert.equal(P.runYaml, "hsdd/auto/run.yaml");
  assert.deepEqual(stepPaths("S07"), { dispatch: "hsdd/auto/dispatch/S07.md", report: "hsdd/auto/steps/S07.json", decisions: "hsdd/auto/steps/S07.decisions.jsonl" });
  assert.equal(reportPath("S07", 0), "hsdd/auto/steps/S07.json");
  assert.equal(reportPath("S07", 2), "hsdd/auto/steps/S07.r2.json");
});
test("globs", () => {
  assert.ok(matchesAny("hsdd/contract/fixture/a/x/y.json", ["hsdd/contract/**"]));
  assert.ok(!matchesAny("hsdd/spec/sub/a.md", ["hsdd/spec/*.md"]));
  assert.ok(matchesAny("hsdd/spec/a.md", ["hsdd/spec/*.md"]));
  assert.ok(matchesAny("ref/docs/a.md", ["ref/"]));
  assert.ok(!matchesAny("ref", ["ref/"]));
  assert.ok(matchesAny("a/b.md", ["a/**/b.md"]));
  assert.ok(matchesAny("a/x/y/b.md", ["a/**/b.md"]));
  assert.ok(!matchesAny("a/b.mdx", ["a/b.md"]));
  assert.ok(!matchesAny("aXb.md", ["a.b.md"]));
  assert.ok(globToRegExp("x(1).md").test("x(1).md"));
  assert.ok(!matchesAny("hsdd/contract", ["hsdd/contract/**"]));
});
test("a trailing-slash glob with a star translates the star and matches everything below", () => {
  assert.ok(matchesAny("vendor/a/x.md", ["vendor/*/"]));
  assert.ok(matchesAny("vendor/a/b/x.md", ["vendor/*/"]));
  assert.ok(!matchesAny("vendorx/a", ["vendor/*/"]));
  assert.ok(!matchesAny("vendor//x", ["vendor/*/"]));
  assert.ok(!matchesAny("vendor/a", ["vendor/*/"]));
  assert.ok(matchesAny("lib/x/y/z.md", ["lib/**/"]));
  assert.ok(matchesAny("pkg-1/sub/x", ["pkg-*/"]));
  assert.ok(!matchesAny("pkg-1", ["pkg-*/"]));
});
test("expandHome", () => {
  assert.ok(!expandHome("~/x").startsWith("~"));
  assert.equal(expandHome("rel/x"), "rel/x");
});
test("judgementSet", () => {
  const set = judgementSet("S07");
  for (const p of ["hsdd/judgement/decisions.jsonl", "hsdd/judgement/run.jsonl", "hsdd/auto/dispatch/S07.md", "hsdd/auto/queue.jsonl", "hsdd/auto/handoffs.jsonl", "hsdd/auto/plan.md", "hsdd/judgement/STOP.md"]) {
    assert.ok(matchesAny(p, set), p);
  }
  for (const p of ["hsdd/auto/steps/S07.json", "hsdd/auto/steps/S07.r1.json", "hsdd/auto/steps/S07.decisions.jsonl", "hsdd/auto/steps/S07.lost1.json", "hsdd/auto/steps/S07.invalid2.r1.json"]) {
    assert.ok(matchesAny(p, set), p);
  }
  assert.ok(!matchesAny("hsdd/auto/steps/S08.json", set));
  assert.ok(!matchesAny("hsdd/judgement/decision-reviews.jsonl", set));
});
test("kinds table", () => {
  assert.equal(Object.keys(KINDS).length, 18);
  assert.deepEqual([...ORCHESTRATOR_KINDS], ["setup", "plan", "report"]);
  assert.equal(SUBAGENT_KINDS.length, 15);
  assert.equal(INSERTABLE_KINDS.length, 14);
  assert.ok(!INSERTABLE_KINDS.includes("intake"));
  const enumIn = loadSchema("run-line").$defs;
  assert.deepEqual([...INSERTABLE_KINDS], enumIn.insertableKind.enum);
  assert.deepEqual(Object.keys(KINDS), enumIn.kind.enum);
  assert.equal(KINDS.graft.template, "graft.md");
  assert.equal(KINDS.setup.template, null);
  assert.equal(KINDS.align.skill, "hsdd-reconcile");
  assert.equal(KINDS.report.type, "plan");
});
test("write sets follow 7.3", () => {
  assert.deepEqual(writeSet("phase-plan", "shop.api", ctx), ["hsdd/spec/shop.api.md"]);
  assert.deepEqual(writeSet("phase-plan-append", "shop.api", ctx), ["hsdd/spec/shop.api.md"]);
  assert.ok(writeSet("citation-touch", "order-api", ctx).includes("hsdd/contract/fixture/order-api/**"));
  assert.ok(writeSet("citation-touch", "order-api", ctx).includes("hsdd/contract/schema/order-api.schema.json"));
  assert.ok(writeSet("citation-touch", "ADR-003", ctx).includes("hsdd/adr/003-*.md"));
  // Final review A2: an existing ADR's own file, whatever its name; the glob only for an ADR without a file.
  const withAdr = { ...ctx, tree: { ...tree, adrs: new Map([["ADR-003", { id: "ADR-003", file: "hsdd/adr/0003-order-ids.md" }]]) } };
  const adrSet = writeSet("citation-touch", "ADR-003", withAdr);
  assert.ok(adrSet.includes("hsdd/adr/0003-order-ids.md"), JSON.stringify(adrSet));
  assert.ok(!adrSet.includes("hsdd/adr/003-*.md"), JSON.stringify(adrSet));
  assert.ok(writeSet("citation-touch", "ADR-004", withAdr).includes("hsdd/adr/004-*.md"));
  assert.ok(writeSet("citation-touch", "shop.api", ctx).includes("hsdd/spec/shop.api.md"));
  assert.ok(writeSet("citation-touch", "shop.api", ctx).includes("hsdd/adr/INDEX.md"));
  assert.ok(writeSet("setup", "2026-10-22-plan", ctxWith({ orchestrator_files: ["CLAUDE.md"] })).includes("CLAUDE.md"));
  assert.ok(writeSet("setup", "2026-10-22-plan", ctx).includes("hsdd/scripts/auto/**"));
  assert.ok(writeSet("report", "2026-10-22-intake-x", { ...ctx, segmentId: "2026-10-22-intake-x" }).includes("hsdd/management/2026-10-22-intake-x.md"));
  assert.ok(writeSet("report", "2026-10-22-intake-x", { ...ctx, record: "hsdd/management/2026-10-22-intake-x.md" }).includes("hsdd/auto/report/2026-10-22-intake-x.md"));
  assert.deepEqual(writeSet("report", "2026-10-22-plan", ctx), ["hsdd/auto/report/2026-10-22-plan.md"]);
  assert.deepEqual(writeSet("report", "2026-10-22-plan", ctxWith({ report_dir: "out/r/" })), ["out/r/2026-10-22-plan.md"]);
  assert.deepEqual(writeSet("intake", "ref/x.md", ctx), ["hsdd/management/*-intake-*.md"]);
  assert.ok(writeSet("reconcile", "all", ctx).includes("hsdd/conventions.md"));
  assert.ok(writeSet("contract", "order-api", ctx).includes("hsdd/scripts/gen-registry.mjs"));
  assert.ok(writeSet("plan", "2026-10-22-plan", ctx).includes("hsdd/auto/plan.md"));
  const moved = { ...ctx, layout: { ...layout, spec: "docs/arch", contract: "docs/c", adr: "docs/d" } };
  assert.deepEqual(writeSet("phase-plan", "shop.api", moved), ["docs/arch/shop.api.md"]);
  assert.ok(writeSet("adr", "ADR-001", moved).includes("docs/d/**"));
  assert.throws(() => writeSet("nope", "x", ctx));
});
test("never patterns", () => {
  const inside = neverPatterns(cfg({ skills_dir: ".agents/skills", owner_files: ["CLAUDE.md"], read_only: ["ref/"] }), layout);
  for (const p of ["hsdd/judgement/STOP.md", "hsdd/auto/run.yaml", "hsdd/scripts/auto/lib/x.mjs", ".claude/settings.json", "ref/a.md", "CLAUDE.md", ".agents/skills/hsdd-spec/SKILL.md"]) {
    assert.ok(matchesAny(p, inside), p);
  }
  assert.ok(!matchesAny("hsdd/spec/shop.md", inside));
  assert.ok(!matchesAny("CLAUDE.md/notes.md", inside), "an owner file is its exact path, never a directory");
  assert.ok(matchesAny("notes/owner.md", neverPatterns(cfg({ owner_files: ["./notes/owner.md"] }), layout)));
  const outside = neverPatterns(cfg({ skills_dir: "/abs/skills" }), layout);
  assert.ok(!matchesAny("/abs/skills/x", outside));
  assert.ok(!neverPatterns(cfg({ skills_dir: "~/.claude/skills" }), layout).some((p) => p.includes("claude/skills")));
});
test("ownerMatcher and ownerFileHash take each owner file by its exact path", () => {
  const owner = ownerMatcher(["./notes/owner.md", "CLAUDE.md"]);
  assert.ok(owner("notes/owner.md") && owner("CLAUDE.md"));
  for (const p of ["notes/owner.md/x", "notes/owner.mdx", "notes/other.md", "CLAUDE.md.bak"]) assert.ok(!owner(p), p);
  const dir = mkdtempSync(join(tmpdir(), "hsdd-owner-"));
  writeFileSync(join(dir, "owner.md"), "mine\n");
  assert.equal(ownerFileHash(dir, "./owner.md"), createHash("sha256").update("mine\n").digest("hex"));
  assert.equal(ownerFileHash(dir, "absent.md"), null);
  mkdirSync(join(dir, "adir"));
  assert.equal(ownerFileHash(dir, "adir"), null, "a directory is not an owner file");
});
test("decision types follow 7.1", () => {
  assert.equal(decisionTypeFor("spec-touch", "shop", tree, "shop"), "root-spec");
  assert.equal(decisionTypeFor("spec-touch", "shop.api", tree, "shop"), "mid-level-spec");
  assert.equal(decisionTypeFor("citation-touch", "ADR-001", tree, "shop"), "adr");
  assert.equal(decisionTypeFor("citation-touch", "order-api", tree, "shop"), "contract");
  assert.equal(decisionTypeFor("citation-touch", "shop.api", tree, "shop"), "mid-level-spec");
  assert.equal(decisionTypeFor("citation-touch", "shop", tree, "shop"), "root-spec");
  assert.equal(decisionTypeFor("graft", "shop", tree, "shop"), "mid-level-spec");
  assert.equal(decisionTypeFor("report", "2026-10-22-plan", tree, "shop"), "plan");
  assert.equal(decisionTypeFor("setup", "2026-10-22-plan", tree, "shop"), "setup");
  assert.equal(decisionTypeFor("align", "all", tree, "shop"), "reconcile");
});
test("skillFor", () => {
  assert.equal(skillFor("setup", "x", tree), "none");
  assert.equal(skillFor("report", "x", tree), "none");
  assert.equal(skillFor("citation-touch", "ADR-001", tree), "hsdd-adr");
  assert.equal(skillFor("citation-touch", "order-api", tree), "hsdd-contract");
  assert.equal(skillFor("citation-touch", "shop.api", tree), "hsdd-spec");
  assert.equal(skillFor("promote", "shop.api", tree), "hsdd-spec");
  assert.throws(() => skillFor("citation-touch", "all", tree));
});
test("targetType", () => {
  assert.equal(targetType("ADR-003", tree), "adr");
  assert.equal(targetType("H7a", tree), "handoff");
  assert.equal(targetType("run", tree), "run");
  assert.equal(targetType("all", tree), "all");
  assert.equal(targetType("a,b", tree), "list");
  assert.equal(targetType("ref/x.md", tree), "request");
  assert.equal(targetType("shop", tree), "node");
  assert.equal(targetType("order-api", tree), "contract");
  assert.equal(targetType("unknown.node", tree), "node");
  assert.equal(targetType("unknown-slug", tree), "contract");
  assert.equal(targetType("docs/my request.md", tree), "request");
});
test("targetType: a file name with a document extension is the request path", () => {
  assert.equal(targetType("request.md", tree), "request");
  assert.equal(targetType("ref/a,b.md", tree), "request");
  assert.equal(targetType("brief.txt", tree), "request");
  assert.equal(targetType("rfc-12.pdf", tree), "request");
  assert.equal(targetType("shop.api", tree), "node");
  assert.equal(targetType("unknown.node", tree), "node");
  assert.equal(targetType("shop.web.admin", tree), "node");
  assert.equal(targetType("shop.api,shop.web", tree), "list");
  const mdNode = { nodes: new Map([["notes.md", {}]]), contracts: new Map([["report.txt", {}]]) };
  assert.equal(targetType("notes.md", mdNode), "node");
  assert.equal(targetType("report.txt", mdNode), "contract");
});
test("RAISED_WHEN quotes 8.2", () => {
  assert.equal(RAISED_WHEN.collision, "Two nodes' entries conflict at reconcile.");
  assert.equal(STOP_CLASSES.length, 10);
  assert.equal(STOPPABLE.length, 7);
  assert.deepEqual(Object.keys(RAISED_WHEN), [...STOP_CLASSES]);
  assert.deepEqual([...STOPPABLE], loadSchema("run-config").$defs.stoppable.enum);
  assert.ok(RAISED_WHEN["breaking-amend"].endsWith("(`hsdd-contract`'s versioning policy)."));
  assert.ok(validate("run-config", baseConfig()).length === 0);
});

// ---------- contract versions (v0.10.0 §3.1) ----------

test("targetType: `{id}.v{n}` names one version of a contract id; a dotted id that is not one stays a node", () => {
  assert.equal(targetType("order-api.v2", tree), "contract");
  assert.equal(targetType("order-api.v12", tree), "contract");
  assert.equal(targetType("pay-api.v2", tree), "node");
  assert.equal(targetType("order-api.vx", tree), "node");
  assert.equal(skillFor("citation-touch", "order-api.v2", tree), "hsdd-contract");
  assert.equal(decisionTypeFor("citation-touch", "order-api.v2", tree, "shop"), "contract");
});

test("a contract citation touch writes every version's files of the id, or the one version's", () => {
  const v1 = { slug: "order-api", stem: "order-api", file: "hsdd/contract/order-api.md", version: "v1" };
  const v2 = { slug: "order-api", stem: "order-api.v2", file: "hsdd/contract/order-api.v2.md", version: "v2" };
  const versioned = { ...ctx, tree: { ...tree, contracts: new Map([["order-api", { ...v2, versions: [v1, v2] }]]) } };
  const all = writeSet("citation-touch", "order-api", versioned);
  for (const p of ["hsdd/contract/order-api.md", "hsdd/contract/fixture/order-api/**", "hsdd/contract/schema/order-api.schema.json",
    "hsdd/contract/order-api.v2.md", "hsdd/contract/fixture/order-api.v2/**", "hsdd/contract/schema/order-api.v2.schema.json"]) assert.ok(all.includes(p), p);
  const one = writeSet("citation-touch", "order-api.v2", versioned);
  assert.ok(one.includes("hsdd/contract/order-api.v2.md") && !one.includes("hsdd/contract/order-api.md"), one.join(", "));
});
