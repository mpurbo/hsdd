import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadIntakeRecords, parseIntakeRecord, parseHandoffBlock, blockErrors, segmentRecord,
  supersededStrings, citesSuperseded, targetFiles,
} from "../skills/hsdd-auto/scripts/lib/intake.mjs";
import { loadTree } from "../skills/hsdd-auto/scripts/lib/tree.mjs";
import { parseLayout } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { withDefaults } from "../skills/hsdd-auto/scripts/lib/config.mjs";
import { makeRepo, baseConfig } from "./helpers/auto-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const INTAKE = join(HERE, "fixtures", "auto", "intake");
const LAYOUT = parseLayout("");
const fixture = (name) => readFileSync(join(INTAKE, name), "utf8");
const record = (name, path = `hsdd/management/${name}`) => parseIntakeRecord(fixture(name), path);
const NO_TREE = { nodes: new Map(), contracts: new Map() };
const blockErrs = (r, tree = NO_TREE) => blockErrors(r, tree);
const withBlock = (rec, edit) => {
  const block = structuredClone(rec.block);
  edit(block);
  return { ...rec, block };
};

test("reads the header and the handoff block", () => {
  const r = record("2026-10-22-intake-order-v2.md");
  assert.equal(r.path, "hsdd/management/2026-10-22-intake-order-v2.md");
  assert.equal(r.slug, "order-v2");
  assert.equal(r.title, "Order API v2, a currency on every order");
  assert.equal(r.date, "2026-10-22");
  assert.equal(r.request, "ref/spec-v2.md");
  assert.equal(r.authority, "accepted-rfc");
  assert.equal(r.cls, "cross-node");
  assert.deepEqual(r.landsOn, ["shop.api", "shop.web.app"]);
  assert.deepEqual(r.contracts, ["order-api"]);
  assert.deepEqual(r.promotes, []);
  assert.deepEqual(r.collisions, []);
  assert.equal(r.status, "open");
  assert.match(r.routing, /^Class `cross-node`/);
  assert.equal(r.blockError, null);
  assert.deepEqual(r.block.handoffs.map((h) => h.id), ["H1", "H2a"]);
  assert.equal(r.block.handoffs[1].when, "cites-superseded");
  assert.deepEqual(r.block.handoffs[1].after, ["H1"]);
  assert.match(r.block.insert_rule, /^A contract change/);
  assert.deepEqual(blockErrs(r), []);
});
test("blockErrors: prompts out of order, unknown after, wrong skill, duplicate id", () => {
  const bad = record("bad-block.md");
  assert.equal(bad.slug, "bad-block");
  const errors = blockErrs(bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /H2a/);
  assert.match(errors[0], /order/);

  const good = record("2026-10-22-intake-order-v2.md");
  const unknownAfter = blockErrs(withBlock(good, (b) => { b.handoffs[1].after = ["H9"]; }));
  assert.equal(unknownAfter.length, 1);
  assert.match(unknownAfter[0], /H2a.*after.*H9/);
  const laterAfter = blockErrs(withBlock(good, (b) => { b.handoffs[0].after = ["H2a"]; }));
  assert.match(laterAfter.join("\n"), /H1.*after.*H2a/);

  const wrongSkill = blockErrs(withBlock(good, (b) => { b.handoffs[0].skill = "hsdd-spec"; }));
  assert.equal(wrongSkill.length, 1);
  assert.match(wrongSkill[0], /H1.*contract-touch.*hsdd-contract/);
  const citationSkill = blockErrs(withBlock(good, (b) => { b.handoffs[1].skill = "hsdd-contract"; }));
  assert.match(citationSkill.join("\n"), /H2a.*hsdd-spec/);

  const duplicate = blockErrs(withBlock(good, (b) => { b.handoffs[1].id = "H1"; b.handoffs[1].after = []; }));
  assert.match(duplicate.join("\n"), /duplicate.*H1/);

  const missingPrompt = blockErrs(withBlock(good, (b) => { b.handoffs[0].prompt = "Touch order-api: something the prose never says"; }));
  assert.match(missingPrompt.join("\n"), /H1.*verbatim/);

  const schema = blockErrs(withBlock(good, (b) => { b.handoffs[0].kind = "intake"; }));
  assert.ok(schema.length > 0);
  assert.match(schema.join("\n"), /kind/);
  assert.deepEqual(blockErrs({ ...good, block: { version: 1, handoffs: "x" } }).length > 0, true);
});
test("structural record may have an empty block", () => {
  const s = record("structural.md");
  assert.equal(s.cls, "structural");
  assert.deepEqual(s.landsOn, ["shop"]);
  assert.deepEqual(s.contracts, []);
  assert.deepEqual(s.block, { version: 1, handoffs: [] });
  assert.deepEqual(blockErrs(s), []);
  const crossNode = blockErrs({ ...s, cls: "cross-node" });
  assert.equal(crossNode.length, 1);
  assert.match(crossNode[0], /structural/);
  const good = record("2026-10-22-intake-order-v2.md");
  assert.match(blockErrs({ ...good, cls: "structural" }).join("\n"), /structural/);
});
test("cites-superseded both ways", () => {
  const dir = makeRepo({ stage: "06-planned", files: {
    "notes/v1-dot.md": "Built against order-api@v1.\n",
    "notes/v10.md": "Built against order-api@v10 only.\n",
    "notes/beta.md": "Built against order-api@v1-beta only.\n",
    "notes/path.md": "Sources: ref/spec.md (§2)\n",
    "notes/v2.md": "Built against order-api@v2 only.\n",
    "notes/version.md": "Per Spec v1 §2, orders carry a status.\n",
    "notes/version-tail.md": "Per Spec v10 and Spec v1.2 and spec-v1x.\n",
  } });
  const tree = loadTree(dir, LAYOUT, { root: "shop" });
  const atV2 = { ...tree, contracts: new Map([["order-api", { ...tree.contracts.get("order-api"), version: "v2" }]]) };
  const config = withDefaults(baseConfig({ sources: {
    normative: [{ path: "ref/spec-v2.md", cite: "Spec", version: "v2" }],
    baseline: [{ path: "ref/spec.md", cite: "Spec", version: "v1" }],
  } }));
  const strings = supersededStrings(config, atV2);
  assert.deepEqual(strings.plain, ["ref/spec.md"]);
  const holds = (file) => citesSuperseded(dir, [file], strings);
  assert.equal(holds("notes/v1-dot.md"), true);
  assert.equal(holds("notes/v10.md"), false);
  assert.equal(holds("notes/beta.md"), false);
  assert.equal(holds("notes/path.md"), true);
  assert.equal(holds("notes/v2.md"), false);
  assert.equal(holds("notes/version.md"), true);
  assert.equal(holds("notes/version-tail.md"), false);
  assert.equal(citesSuperseded(dir, ["notes/missing.md", "notes/v2.md"], strings), false);
  assert.equal(citesSuperseded(dir, ["notes/missing.md", "notes/v1-dot.md"], strings), true);

  // A current contract version that equals the baseline's version string is not a superseded mention.
  const atV1 = supersededStrings(config, tree);
  assert.equal(citesSuperseded(dir, ["hsdd/contract/fixture/order-api/create-order.json"], atV1), false);
  assert.equal(citesSuperseded(dir, ["hsdd/contract/fixture/order-api/create-order.json"], strings), true);
  // The storefront spec cites ref/spec.md in its Sources, so a baseline move dispatches its touch.
  assert.equal(citesSuperseded(dir, targetFiles("citation-touch", "shop.web.app", LAYOUT, tree), atV1), true);
});
test("supersededStrings: every lower contract version, no baseline means no plain strings", () => {
  const tree = { contracts: new Map([["a", { version: "v3" }], ["b", { version: "v1" }], ["c", { version: "v0" }], ["d", { version: null }]]) };
  const s = supersededStrings(withDefaults(baseConfig()), tree);
  assert.deepEqual(s.plain, []);
  const text = (t) => s.refs.some((r) => r.test(t));
  assert.equal(text("a@v0"), true);
  assert.equal(text("a@v1)"), true);
  assert.equal(text("see a@v2"), true);
  assert.equal(text("a@v3"), false);
  assert.equal(text("b@v1"), false);
  assert.equal(text("b@v0"), true);
  assert.equal(text("xa@v1"), false);
  assert.equal(text("a@v1_x"), false);
  assert.equal(s.refs.every((r) => !r.global && !r.sticky), true);
  const noBaseline = supersededStrings(baseConfig(), tree);
  assert.deepEqual(noBaseline.plain, []);
});
test("targetFiles names the target's files; a contract's fixture directory expands", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const tree = loadTree(dir, LAYOUT, { root: "shop" });
  assert.deepEqual(targetFiles("contract-touch", "order-api", LAYOUT, tree), [
    "hsdd/contract/order-api.md",
    "hsdd/contract/fixture/order-api/create-order.json",
    "hsdd/contract/fixture/order-api/get-missing-order.json",
    "hsdd/contract/schema/order-api.schema.json",
  ]);
  assert.deepEqual(targetFiles("citation-touch", "order-api", LAYOUT, tree), targetFiles("contract-touch", "order-api", LAYOUT, tree));
  assert.deepEqual(targetFiles("citation-touch", "ADR-001", LAYOUT, tree), ["hsdd/adr/001-order-ids.md"]);
  assert.deepEqual(targetFiles("adr-update", "ADR-009", LAYOUT, tree), []);
  assert.deepEqual(targetFiles("citation-touch", "shop.web.app", LAYOUT, tree), ["hsdd/spec/shop.web.app.md"]);
  assert.deepEqual(targetFiles("phase-plan-append", "shop.api", LAYOUT, tree), ["hsdd/spec/shop.api.md"]);
  assert.deepEqual(targetFiles("align", "shop.api,shop.web.app", LAYOUT, tree), ["hsdd/spec/shop.api.md", "hsdd/spec/shop.web.app.md"]);
  assert.deepEqual(targetFiles("align", "all", LAYOUT, tree), ["hsdd/spec/shop.api.md", "hsdd/spec/shop.web.app.md"]);
  assert.deepEqual(targetFiles("contract", "new-api", LAYOUT, tree), ["hsdd/contract/new-api.md", "hsdd/contract/schema/new-api.schema.json"]);
});
test("parseHandoffBlock: absent, invalid JSON, unterminated, two blocks, other fences", () => {
  assert.deepEqual(parseHandoffBlock("prose only\n"), { block: null, error: null });
  assert.deepEqual(parseHandoffBlock("```json\n{\"version\": 1}\n```\n"), { block: null, error: null });
  assert.match(parseHandoffBlock("```hsdd-handoffs\n{ not json\n```\n").error, /JSON/);
  assert.match(parseHandoffBlock("```hsdd-handoffs\n{\"version\": 1, \"handoffs\": []}\n").error, /closing fence/);
  const two = "```hsdd-handoffs\n{\"version\": 1, \"handoffs\": []}\n```\n\n```hsdd-handoffs\n{\"version\": 1, \"handoffs\": []}\n```\n";
  assert.match(parseHandoffBlock(two).error, /more than one/);
  assert.deepEqual(parseHandoffBlock("~~~~ hsdd-handoffs\n{\"version\": 1, \"handoffs\": []}\n~~~~\n").block, { version: 1, handoffs: [] });
  const r = { ...record("structural.md"), block: null, blockError: "the hsdd-handoffs block is not valid JSON: x" };
  assert.deepEqual(blockErrs(r), ["the hsdd-handoffs block is not valid JSON: x"]);
  assert.deepEqual(blockErrs({ ...r, blockError: null }), []);
});
test("parseIntakeRecord is lenient about header forms", () => {
  const r = parseIntakeRecord([
    "# Fix the receipt font", "",
    "- **Request:** `https://tickets.example.invalid/T-12` (ticket)",
    "- **Class:** Local", "- **Lands on:** shop.web.app", "- **Contracts:** none",
    "- **Promotes:** [shop.api]", "- **Collisions:** [2026-10-20-intake-x.md]", "- **Status:** closed (2026-10-30)", "",
    "## Routing", "", "One leaf-parent.", "",
  ].join("\n"), "hsdd/management/2026-10-24-intake-receipt-font.md");
  assert.equal(r.title, "Fix the receipt font");
  assert.equal(r.date, "2026-10-24");
  assert.equal(r.request, "https://tickets.example.invalid/T-12");
  assert.equal(r.authority, "ticket");
  assert.equal(r.cls, "local");
  assert.deepEqual(r.landsOn, ["shop.web.app"]);
  assert.deepEqual(r.contracts, []);
  assert.deepEqual(r.promotes, ["shop.api"]);
  assert.deepEqual(r.collisions, ["2026-10-20-intake-x.md"]);
  assert.equal(r.status, "closed");
  assert.equal(r.block, null);
  assert.equal(r.routing, "One leaf-parent.");
  const empty = parseIntakeRecord("", "hsdd/management/x.md");
  assert.equal(empty.slug, "x");
  assert.equal(empty.request, null);
  assert.equal(empty.cls, null);
  assert.equal(empty.routing, null);
  assert.deepEqual(empty.landsOn, []);
});
test("loadIntakeRecords lists management intake records newest first; segmentRecord picks by request line", () => {
  const order = fixture("2026-10-22-intake-order-v2.md");
  const dir = makeRepo({ stage: "06-planned", files: {
    "hsdd/management/2026-10-22-intake-order-v2.md": order,
    "hsdd/management/2026-10-22-intake-another.md": order.replace("# Intake: Order API v2, a currency on every order", "# Intake: Another"),
    "hsdd/management/2026-10-23-intake-marketplace.md": fixture("structural.md"),
    "hsdd/management/2026-09-01-intake-old.md": order.replace("- **Date:** 2026-10-22", "- **Date:** 2026-09-01"),
    "hsdd/management/2026-10-22-progress.md": "# Progress\n",
    "hsdd/management/archive/2026-12-01-intake-sealed.md": order,
  } });
  const records = loadIntakeRecords(dir, LAYOUT);
  assert.deepEqual(records.map((r) => r.path), [
    "hsdd/management/2026-10-23-intake-marketplace.md",
    "hsdd/management/2026-10-22-intake-order-v2.md",
    "hsdd/management/2026-10-22-intake-another.md",
    "hsdd/management/2026-09-01-intake-old.md",
  ]);
  assert.equal(segmentRecord(records, "ref/spec-v2.md").path, "hsdd/management/2026-10-22-intake-order-v2.md");
  assert.equal(segmentRecord([...records].reverse(), "ref/spec-v2.md").path, "hsdd/management/2026-10-22-intake-order-v2.md");
  assert.equal(segmentRecord(records, "ref/marketplace.md").slug, "marketplace");
  assert.equal(segmentRecord(records, "ref/nothing.md"), null);
  assert.deepEqual(loadIntakeRecords(makeRepo({ stage: "01-root" }), LAYOUT), []);
});

test("parseHandoffBlock: a closed block whose JSON is not an object is an error", () => {
  for (const body of ["null", "[1, 2]", "42", "\"text\""]) {
    const r = parseHandoffBlock(`\`\`\`hsdd-handoffs\n${body}\n\`\`\`\n`);
    assert.equal(r.block, null);
    assert.match(r.error, /not a JSON object/);
  }
});
test("blockErrors requires the tree", () => {
  assert.throws(() => blockErrors(record("structural.md")), /tree is required/);
  assert.deepEqual(blockErrors(record("structural.md"), NO_TREE), []);
});
test("cites-superseded with a multi-dot baseline version", () => {
  const dir = makeRepo({ files: {
    "notes/exact.md": "Per Spec v0.15.1 \u00a73, orders carry a status.\n",
    "notes/longer.md": "Per Spec v0.15.10 \u00a73, orders carry a status.\n",
  } });
  const config = withDefaults(baseConfig({ sources: {
    normative: [{ path: "ref/spec-v2.md", cite: "Spec", version: "v0.16.0" }],
    baseline: [{ path: "ref/old.md", cite: "Spec", version: "v0.15.1" }],
  } }));
  const strings = supersededStrings(config, { contracts: new Map() });
  assert.equal(citesSuperseded(dir, ["notes/exact.md"], strings), true);
  assert.equal(citesSuperseded(dir, ["notes/longer.md"], strings), false);
});
