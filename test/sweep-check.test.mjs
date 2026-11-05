import { test } from "node:test";
import assert from "node:assert/strict";
import { handoffsOf, checkRecord } from "../skills/hsdd-intake/scripts/lib/check.mjs";
import { parseRecord, renderRecord } from "../skills/hsdd-intake/scripts/lib/record.mjs";
import { readTree } from "../skills/hsdd-intake/scripts/lib/tree.mjs";
import { draftFor, recordOf } from "../skills/hsdd-intake/scripts/lib/draft.mjs";
import { sweepRepo, completeDraft, fillRecord } from "./helpers/sweep-fixture.mjs";

const fx = sweepRepo();
const tree = readTree(fx.root);
const s7 = (k) => fx.shas[k].slice(0, 7);
const range = { repo: "acme", named: "--repo", main: "main", from: fx.base, to: fx.shas.contract, fromNote: "from named" };
const fresh = draftFor(fx.root, range, tree, new Map());
const draftText = renderRecord(recordOf(range, "2026-11-05", undefined, fresh));
const goodText = completeDraft(draftText, fx.shas);
const good = () => parseRecord(goodText);
const problems = (r, rows = fresh.rows) => checkRecord(r, rows, tree);

const set = (r, k, patch) => ({ ...r, rows: r.rows.map((x) => (x.sha === s7(k) ? { ...x, ...patch } : x)) });
const dropRow = (r, k) => ({ ...r, rows: r.rows.filter((x) => x.sha !== s7(k)) });
const addRow = (r, sha) => ({ ...r, rows: [...r.rows, { sha, node: "acme.web", cls: "log", reason: "none", subject: "x" }] });
const addToPrompt = (r, sha) => ({ ...r, routing: [...r.routing, "```text", `mentions ${sha}`, "```"] });
const dropHandoffs = (r) => ({ ...r, routing: ["none"] });
const miscount = (r) => ({ ...r, changeLog: [r.changeLog[0].replace(/\d+ log/, "99 log"), ...r.changeLog.slice(1)] });

test("handoffsOf reads a retro handoff's three prompts and an intake handoff's one", () => {
  const hs = handoffsOf(good().routing);
  const retro = hs.filter((h) => h.cls === "retro");
  const intake = hs.filter((h) => h.cls === "intake");
  assert.equal(retro.length, 1);
  assert.deepEqual([retro[0].id, retro[0].target, retro[0].prompts.length], ["H1", "acme.web", 3]);
  assert.match(retro[0].prompts[0], new RegExp(s7("copy")));
  assert.ok(intake.length >= 1);
  assert.ok(intake.every((h) => h.prompts.length === 1 && h.prompts[0].includes(h.target)));
  assert.deepEqual(handoffsOf(["none"]), []);
});

test("a conformant record passes", () => assert.deepEqual(problems(good()), []));

const REFUSALS = [
  ["a candidate with no row", (r) => dropRow(r, "log"), /no row/],
  ["a row with no candidate", (r) => addRow(r, "deadbee"), /no candidate/],
  ["a ? cell", (r) => set(r, "log", { cls: "?" }), /\?/],
  ["an unknown class", (r) => set(r, "log", { cls: "skip" }), /class/],
  ["a retro row with reason none", (r) => set(r, "copy", { reason: "none" }), /reason/],
  ["a script-set intake changed with no line", (r) => set(r, "routeAdd", { cls: "log", reason: "none" }), /lowered/],
  ["a log row's sha in a handoff", (r) => addToPrompt(r, s7("log")), /handoff/],
  ["a retro row with no handoff", (r) => dropHandoffs(r), /handoff/],
  ["a retro row on an as-built node", (r) => set(r, "asBuilt", { cls: "retro", reason: "x" }), /as-built/],
  ["a retro row on the root", (r) => set(r, "copy", { node: "acme" }), /internal|root/],
  ["a node outside the tree", (r) => set(r, "log", { node: "acme.nope" }), /not in the tree/],
  ["none on a log row", (r) => set(r, "log", { node: "none" }), /none/],
  ["an empty Run by", (r) => ({ ...r, runBy: "" }), /Run by/],
  ["a ? Run by", (r) => ({ ...r, runBy: "?" }), /Run by/],
  ["a placeholder Run by", (r) => ({ ...r, runBy: "{person}" }), /Run by/],
  ["counts that disagree", (r) => miscount(r), /counts/],
  ["closed with a retro row", (r) => ({ ...r, status: "closed (2026-11-05)" }), /Status/],
  ["a malformed Status", (r) => ({ ...r, status: "done" }), /Status/],
];
for (const [name, edit, re] of REFUSALS) test(`check refuses ${name}`, () => assert.match(problems(edit(good())).join("\n"), re));

test("each refusal names the row's sha", () => {
  assert.match(problems(set(good(), "copy", { reason: "none" })).join("\n"), new RegExp(s7("copy")));
});

test("none is valid on intake and unplaced rows", () => {
  const r = good();
  const unplaced = r.rows.find((x) => x.cls === "unplaced");
  assert.equal(unplaced.node, "none");
  assert.deepEqual(problems(r), []);
});

test("an all-log record must be closed", () => {
  const logs = fresh.rows.filter((x) => x.sha === s7("log"));
  const text = completeDraft(renderRecord(recordOf(range, "2026-11-05", undefined, { ...fresh, rows: logs })), fx.shas);
  const r = parseRecord(text);
  assert.deepEqual(problems(r, logs), []);
  assert.match(problems({ ...r, status: "open" }, logs).join("\n"), /Status/);
});

const without = (lines, sha) => {
  const i = lines.findIndex((l) => l.startsWith("**H") && l.includes(sha));
  return [...lines.slice(0, i), ...lines.slice(i + 4)];
};
test("a script-set intake lowered with its line passes", () => {
  const sha = s7("routeAdd");
  const text = fillRecord(goodText, {
    rows: { [sha]: { cls: "log", reason: "none" } },
    routing: without(parseRecord(goodText).routing, sha),
    lowered: [`- 2026-11-05: lowered ${sha} from intake to log by Purbo: a route-like string in a comment`],
  });
  const r = parseRecord(text);
  assert.ok(!problems(r).join("\n").includes("lowered"), problems(r).join("\n"));
  // a line for another class or another sha does not count
  const wrong = { ...r, changeLog: r.changeLog.map((l) => l.replace("to log", "to retro")) };
  assert.match(problems(wrong).join("\n"), /lowered/);
});
