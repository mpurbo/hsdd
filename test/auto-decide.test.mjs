import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { decide, nextDecisionId } from "../skills/hsdd-auto/scripts/decide.mjs";
import { readJsonl } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { STAMP_RE, stampMs } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { SCRIPTS, addSegment, fakeStep, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const SEGMENT = "2026-10-22-plan";
const planSeg = { id: SEGMENT, mode: "plan", opened_at: "2026-10-22T10:00:00Z", instruction: "plan", stop_policy: "stop", first_step: "S00" };
const put = (dir, rel, content) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const input = (over = {}) => ({
  artifact: "hsdd/specs/shop.md", question: "Which id scheme?",
  options: [{ label: "uuid", consequence: "opaque" }, { label: "seq", consequence: "guessable" }],
  chosen: "uuid", why: "no ordering need", evidence: [], blast_radius: "node-local", confidence: "high",
  would_have_asked: false, stop_class: null, would_upstream: false, ...over,
});
const sidecar = (dir, step) => readJsonl(dir, `hsdd/auto/steps/${step}.decisions.jsonl`);
const dec = (id) => ({ id, at: "2026-10-22T10:00:00Z", by: "subagent", step: "plan", ...input() });
const repo = (steps = [["S07", "mid-level-spec", "shop.api"]]) => {
  const dir = makeRepo({ stage: "06-planned" });
  addSegment(dir, planSeg);
  for (const [step, kind, target] of steps) openStep(dir, { step, segment: SEGMENT, kind, target });
  return dir;
};
const refused = (dir, args, over) => {
  const r = decide2(dir, args, over);
  assert.equal(r.code, 1, r.stdout);
  return r;
};
const decide2 = (dir, args, obj) => run(dir, "decide.mjs", args, { input: JSON.stringify(obj) });

test("mints consecutive ids across the ledger and uncommitted sidecars", () => {
  const dir = repo([["S07", "mid-level-spec", "shop.api"], ["S08", "mid-level-spec", "shop.api"]]);
  put(dir, P.ledger, `${JSON.stringify({ id: "DEC-004" })}\n`);
  put(dir, "hsdd/auto/steps/S07.decisions.jsonl", `${JSON.stringify(dec("DEC-005"))}\n`);
  assert.equal(nextDecisionId(dir), "DEC-006");
  const r = run(dir, "decide.mjs", ["--step", "S08", "--stdin"], { input: JSON.stringify(input()) });
  assert.equal(r.code, 0, r.stdout);
  assert.match(r.stdout.trim(), /^DEC-006 at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.equal(sidecar(dir, "S08")[0].id, "DEC-006");
  assert.equal(nextDecisionId(dir), "DEC-007");
});

test("ids order numerically past 999 and start at DEC-001", () => {
  const dir = repo();
  assert.equal(nextDecisionId(dir), "DEC-001");
  put(dir, P.ledger, `${JSON.stringify({ id: "DEC-999" })}\n${JSON.stringify({ id: "DEC-1000" })}\n`);
  assert.equal(nextDecisionId(dir), "DEC-1001");
});

test("stamps at at the moment of the call", () => {
  const dir = repo();
  const before = Math.floor(Date.now() / 1000) * 1000;
  const { id, at } = decide(dir, { step: "S07", input: input() });
  const after = Date.now();
  assert.match(at, STAMP_RE);
  assert.ok(stampMs(at) >= before && stampMs(at) <= after);
  assert.deepEqual(sidecar(dir, "S07").map((l) => [l.id, l.at]), [[id, at]]);
});

test("rejects supplied id, at, segment, step, step_ref, by or commit", () => {
  const dir = repo();
  const supplied = { id: "DEC-001", at: "2026-10-22T10:00:00Z", segment: SEGMENT, step: "plan", step_ref: "S07", by: "owner", commit: "abc1234" };
  for (const [k, v] of Object.entries(supplied)) {
    const r = refused(dir, ["--step", "S07", "--stdin"], { ...input(), [k]: v });
    assert.match(r.stdout, new RegExp(`${k} is set by decide.mjs`));
  }
  assert.deepEqual(sidecar(dir, "S07"), []);
});

test("rejects a chosen that is not a label, a would_have_asked without class, upstream without would_upstream", () => {
  const dir = repo();
  assert.match(refused(dir, ["--step", "S07", "--stdin"], input({ chosen: "nope" })).stdout, /chosen is not one of/);
  assert.match(refused(dir, ["--step", "S07", "--stdin"], input({ would_have_asked: true })).stdout, /stop_class is set exactly when/);
  assert.match(refused(dir, ["--step", "S07", "--stdin"], input({ stop_class: "axis" })).stdout, /stop_class is set exactly when/);
  assert.match(refused(dir, ["--step", "S07", "--stdin"], input({ blast_radius: "upstream" })).stdout, /upstream implies would_upstream/);
  assert.equal(decide2(dir, ["--step", "S07", "--stdin"], input({ blast_radius: "upstream", would_upstream: true, would_have_asked: true, stop_class: "upstream" })).code, 0);
  assert.match(refused(dir, ["--step", "S07", "--stdin"], input({ options: [{ label: "uuid", consequence: "x" }] })).stdout, /at least 2 items/);
  assert.equal(sidecar(dir, "S07").length, 1);
});

test("assigns the decision type by section 10.4", () => {
  const dir = repo([
    ["S01", "contract", "order-api"], ["S02", "setup", SEGMENT], ["S03", "plan", SEGMENT],
    ["S04", "spec-touch", "shop"], ["S05", "spec-touch", "shop.api"], ["S06", "citation-touch", "order-api"], ["S07", "adr", "ADR-001"],
  ]);
  const typeOf = (step, by, extra = []) => {
    const r = run(dir, "decide.mjs", ["--step", step, "--by", by, ...extra, "--stdin"], { input: JSON.stringify(input()) });
    assert.equal(r.code, 0, r.stdout);
    return sidecar(dir, step).at(-1).step;
  };
  assert.equal(typeOf("S01", "subagent"), "contract");
  assert.equal(typeOf("S01", "orchestrator"), "plan");
  assert.equal(typeOf("S02", "orchestrator"), "setup");
  assert.equal(typeOf("S02", "owner"), "setup");
  assert.equal(typeOf("S03", "owner"), "plan");
  assert.equal(typeOf("S01", "subagent", ["--type", "reconcile"]), "reconcile");
  assert.equal(typeOf("S04", "subagent"), "root-spec");
  assert.equal(typeOf("S05", "subagent"), "mid-level-spec");
  assert.equal(typeOf("S06", "subagent"), "contract");
  assert.equal(typeOf("S07", "subagent"), "adr");
  assert.equal(run(dir, "decide.mjs", ["--step", "S01", "--type", "bogus", "--stdin"], { input: "{}" }).code, 2);
});

const spawnDecide = (dir, step, body) => new Promise((resolve) => {
  const child = spawn(process.execPath, [join(SCRIPTS, "decide.mjs"), "--step", step, "--stdin"], { cwd: dir });
  let stdout = "";
  child.stdout.on("data", (d) => { stdout += d; });
  child.on("close", (code) => resolve({ code, stdout }));
  child.stdin.end(body);
});

test("the lock prevents two concurrent mints from sharing an id", async () => {
  const dir = repo();
  const results = await Promise.all(Array.from({ length: 8 }, () => spawnDecide(dir, "S07", JSON.stringify(input()))));
  assert.deepEqual(results.map((r) => r.code), Array(8).fill(0), results.map((r) => r.stdout).join("\n"));
  const ids = sidecar(dir, "S07").map((l) => l.id);
  assert.deepEqual([...ids].sort(), Array.from({ length: 8 }, (_, i) => `DEC-${String(i + 1).padStart(3, "0")}`));
  assert.equal(new Set(results.map((r) => r.stdout.split(" ")[0])).size, 8);
  assert.equal(existsSync(join(dir, P.decideLock)), false);
});

test("replaces a lock older than 60 seconds", () => {
  const dir = repo();
  put(dir, P.decideLock, "99999\n");
  const old = new Date(Date.now() - 120_000);
  utimesSync(join(dir, P.decideLock), old, old);
  const r = run(dir, "decide.mjs", ["--step", "S07", "--stdin"], { input: JSON.stringify(input()) });
  assert.equal(r.code, 0, r.stdout);
  assert.equal(existsSync(join(dir, P.decideLock)), false);
});

test("a fresh lock is waited for and then taken when its holder releases it", async () => {
  const dir = repo();
  put(dir, P.decideLock, "99999\n");
  const pending = spawnDecide(dir, "S07", JSON.stringify(input()));
  await new Promise((r) => setTimeout(r, 400));
  assert.deepEqual(sidecar(dir, "S07"), []);
  unlinkSync(join(dir, P.decideLock));
  const r = await pending;
  assert.equal(r.code, 0, r.stdout);
  assert.equal(sidecar(dir, "S07").length, 1);
});

test("refuses a step whose judgement commit exists", () => {
  const dir = makeRepo({ stage: "06-planned" });
  addSegment(dir, planSeg);
  fakeStep(dir, { step: "S00", segment: SEGMENT, kind: "plan", target: SEGMENT });
  const r = refused(dir, ["--step", "S00", "--by", "orchestrator", "--stdin"], input());
  assert.match(r.stdout, /judgement commit/);
  assert.deepEqual(sidecar(dir, "S00"), []);
});

test("refuses a step with no dispatch file", () => {
  const dir = repo();
  const r = refused(dir, ["--step", "S42", "--stdin"], input());
  assert.match(r.stdout, /no dispatch file/);
});

test("CLI: --file, bad JSON, missing --step, both sources", () => {
  const dir = repo();
  put(dir, "d.json", JSON.stringify(input()));
  const ok = run(dir, "decide.mjs", ["--step", "S07", "--file", "d.json"]);
  assert.equal(ok.code, 0, ok.stdout);
  assert.equal(ok.stdout.trim().split("\n").length, 1);
  assert.equal(run(dir, "decide.mjs", ["--step", "S07", "--stdin"], { input: "{not json" }).code, 1);
  assert.equal(run(dir, "decide.mjs", ["--stdin"], { input: "{}" }).code, 2);
  assert.equal(run(dir, "decide.mjs", ["--step", "S07", "--stdin", "--file", "d.json"], { input: "{}" }).code, 2);
  assert.equal(run(dir, "decide.mjs", ["--step", "S07"]).code, 2);
  assert.equal(readFileSync(join(dir, "hsdd/auto/steps/S07.decisions.jsonl"), "utf8").trim().split("\n").length, 1);
});
