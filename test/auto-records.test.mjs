import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  appendJsonl, committedJsonl, judgementCommitted, listDispatches, nextFreeStep, readCheckOf, readDispatch, readJsonl,
  readReports, readSidecar, reportSeries, stepId, stepNum, writeDispatch,
} from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { makeRepo, fakeStep, addSegment, gitIn } from "./helpers/auto-repo.mjs";

const put = (dir, rel, content) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const T = "2026-10-22T10:00:00Z";
const front = (step, over = {}) => ({
  step_ref: step, segment: "2026-10-22-plan", kind: "spec-touch", skill: "hsdd-spec", target: "shop.api", handoff: null,
  queue_item: null, continues: null, report: `hsdd/auto/steps/${step}.json`, decisions: `hsdd/auto/steps/${step}.decisions.jsonl`,
  write_set: ["hsdd/spec/*.md"], template: "steps/spec-touch.md", skill_version: "0.11.0", rendered_at: T, head: "abc1234",
  launches: [{ at: T, reason: "initial" }], ...over,
});

test("nextFreeStep starts at S00 and follows the highest dispatch file", () => {
  const dir = makeRepo();
  assert.equal(nextFreeStep(dir), "S00");
  for (let n = 0; n <= 9; n++) put(dir, `hsdd/auto/dispatch/${stepId(n)}.md`, "x");
  assert.equal(nextFreeStep(dir), "S10");
  const big = makeRepo();
  put(big, "hsdd/auto/dispatch/S99.md", "x");
  assert.equal(nextFreeStep(big), "S100");
  put(big, "hsdd/auto/dispatch/S100.md", "x");
  put(big, "hsdd/auto/dispatch/S100.md.bak", "x");
  assert.equal(nextFreeStep(big), "S101");
  assert.deepEqual(listDispatches(big), ["S99", "S100"]);
});

test("stepNum and stepId round trip; a non step id throws", () => {
  assert.equal(stepNum("S07"), 7);
  assert.equal(stepNum("S123"), 123);
  assert.equal(stepId(7), "S07");
  assert.equal(stepId(123), "S123");
  assert.throws(() => stepNum("7"), /not a step id/);
});

test("judgementCommitted reads HEAD's run log only", () => {
  const dir = makeRepo();
  fakeStep(dir, { step: "S00", segment: "2026-10-22-plan", kind: "plan", target: "shop" });
  assert.equal(judgementCommitted(dir, "S00"), true);
  appendFileSync(join(dir, P.runLog), `${JSON.stringify({ step_ref: "S01", segment: "2026-10-22-plan", kind: "plan" })}\n`);
  assert.equal(judgementCommitted(dir, "S01"), false);
  assert.equal(readJsonl(dir, P.runLog).length, 2);
  assert.equal(committedJsonl(dir, P.runLog).length, 1);
  assert.equal(judgementCommitted(makeRepo(), "S00"), false);
});

test("report series excludes lost and invalid renames, in launch order", () => {
  const dir = makeRepo();
  for (const n of ["S07.json", "S07.r1.json", "S07.r2.json", "S07.r10.json", "S07.lost1.json", "S07.lost1.r1.json", "S07.invalid1.json", "S07.decisions.jsonl", "S070.json", "S08.json"]) {
    put(dir, `hsdd/auto/steps/${n}`, "{}");
  }
  const s = (n) => `hsdd/auto/steps/${n}`;
  assert.deepEqual(reportSeries(dir, "S07"), [s("S07.json"), s("S07.r1.json"), s("S07.r2.json"), s("S07.r10.json")]);
  assert.deepEqual(reportSeries(makeRepo(), "S07"), []);
});

test("readReports marks a file that is not JSON; readSidecar reads the sidecar", () => {
  const dir = makeRepo();
  put(dir, "hsdd/auto/steps/S03.json", "{ not json");
  put(dir, "hsdd/auto/steps/S03.r1.json", JSON.stringify({ step_ref: "S03" }));
  put(dir, "hsdd/auto/steps/S04.json", "[1]");
  const [bad, good] = readReports(dir, "S03");
  assert.equal(bad.report, null);
  assert.match(bad.error, /not valid JSON/);
  assert.equal(bad.path, "hsdd/auto/steps/S03.json");
  assert.deepEqual(good, { path: "hsdd/auto/steps/S03.r1.json", report: { step_ref: "S03" }, error: null });
  assert.match(readReports(dir, "S04")[0].error, /not a JSON object/);
  put(dir, "hsdd/auto/steps/S03.decisions.jsonl", `${JSON.stringify({ id: "DEC-001" })}\n`);
  assert.deepEqual(readSidecar(dir, "S03"), [{ id: "DEC-001" }]);
  assert.deepEqual(readSidecar(dir, "S09"), []);
});

test("readJsonl: missing file is empty, a bad line names file and line; appendJsonl adds the newline", () => {
  const dir = makeRepo();
  assert.deepEqual(readJsonl(dir, "hsdd/auto/queue.jsonl"), []);
  put(dir, "hsdd/auto/queue.jsonl", `${JSON.stringify({ a: 1 })}\n\n{ broken\n`);
  assert.throws(() => readJsonl(dir, "hsdd/auto/queue.jsonl"), /^Error: hsdd\/auto\/queue\.jsonl:3:/);
  put(dir, "hsdd/auto/h.jsonl", JSON.stringify({ a: 1 }));
  appendJsonl(dir, "hsdd/auto/h.jsonl", { b: 2 });
  assert.equal(readFileSync(join(dir, "hsdd/auto/h.jsonl"), "utf8"), '{"a":1}\n{"b":2}\n');
  appendJsonl(dir, "hsdd/new/dir/x.jsonl", { c: 3 });
  assert.deepEqual(readJsonl(dir, "hsdd/new/dir/x.jsonl"), [{ c: 3 }]);
});

test("readDispatch finds the read check only on the last line", () => {
  const dir = makeRepo();
  writeDispatch(dir, "S05", front("S05"), "prompt\n\nread_check: 0a1b2c3d\n");
  const d = readDispatch(dir, "S05");
  assert.equal(d.readCheck, "0a1b2c3d");
  assert.equal(d.front.target, "shop.api");
  assert.equal(d.body, "prompt\n\nread_check: 0a1b2c3d\n");
  assert.match(d.text, /^---\n/);
  writeDispatch(dir, "S06", front("S06"), "prompt\n\nread_check: 0a1b2c3d\nmore text\n");
  assert.equal(readDispatch(dir, "S06").readCheck, null);
  writeDispatch(dir, "S07", front("S07"), "prompt\nread_check: 0a1b2c3d\n\n\n");
  assert.equal(readDispatch(dir, "S07").readCheck, "0a1b2c3d");
  writeDispatch(dir, "S08", front("S08"), "read_check: 0A1B2C3D\n");
  assert.equal(readDispatch(dir, "S08").readCheck, null);
  assert.equal(readCheckOf("x read_check: 0a1b2c3d"), null);
  assert.equal(readCheckOf("read_check: 0a1b2c3"), null);
  assert.equal(readDispatch(dir, "S42"), null);
});

test("writeDispatch rejects an orchestrator dispatch with a report", () => {
  const dir = makeRepo();
  const orch = front("S00", { kind: "plan", skill: "none", report: null, template: null, launches: [] });
  assert.equal(writeDispatch(dir, "S00", orch, ""), "hsdd/auto/dispatch/S00.md");
  assert.equal(readDispatch(dir, "S00").readCheck, null);
  assert.throws(() => writeDispatch(dir, "S01", { ...orch, step_ref: "S01", report: "x" }, ""), /no report/);
  assert.throws(() => writeDispatch(dir, "S01", { ...orch, step_ref: "S01", skill: "hsdd-spec" }, ""), /exactly for an orchestrator/);
  assert.throws(() => writeDispatch(dir, "S01", { ...orch, step_ref: "S01", launches: [{ at: T, reason: "initial" }] }, ""), /no launches/);
  assert.throws(() => writeDispatch(dir, "S01", front("S01", { launches: [] }), "x"), /initial/);
  assert.throws(() => writeDispatch(dir, "S01", front("S01", { launches: [{ at: T, reason: "redispatch" }] }), "x"), /initial/);
  assert.throws(() => writeDispatch(dir, "S01", front("S02"), "x"), /not the dispatched step/);
  assert.throws(() => writeDispatch(dir, "S01", { ...front("S01"), extra: 1 }, "x"), /unexpected property/);
  assert.equal(readDispatch(dir, "S01"), null);
});

test("loadContext on a planned tree", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const ctx = loadContext(dir);
  assert.equal(ctx.tree.nodes.size, 4);
  assert.equal(ctx.inProgress, null);
  assert.equal(ctx.segment, null);
  assert.deepEqual(ctx.segments, []);
  assert.equal(ctx.stopExists, false);
  assert.equal(ctx.stopCommitted, false);
  assert.equal(ctx.branch, "main");
  assert.match(ctx.head, /^[0-9a-f]{7,}$/);
  assert.equal(ctx.defaultBranch, "main");
  assert.equal(ctx.dispatches.size, 0);
  assert.equal(ctx.intake.record, null);
  assert.equal(ctx.changedInSegment("2026-10-22-plan").size, 0);
  assert.equal(ctx.setupCommit("2026-10-22-plan"), null);
  assert.equal(ctx.verifiedPhases.size, 0);
});

test("loadContext: in-progress step, committed steps, stop file", () => {
  const dir = makeRepo({ stage: "06-planned" });
  fakeStep(dir, { step: "S00", segment: "2026-10-22-plan", kind: "plan", target: "shop" });
  writeDispatch(dir, "S01", front("S01"), "p\n\nread_check: 0a1b2c3d\n");
  put(dir, P.stop, "# stop\n");
  const ctx = loadContext(dir);
  assert.equal(ctx.inProgress, "S01");
  assert.deepEqual([...ctx.dispatches.keys()], ["S00", "S01"]);
  assert.equal(ctx.dispatches.get("S01").readCheck, "0a1b2c3d");
  assert.equal(ctx.runLines.length, 1);
  assert.equal(ctx.committedRunLines.length, 1);
  assert.equal(ctx.stopExists, true);
  assert.equal(ctx.stopCommitted, false);
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "-m", "stop");
  assert.equal(loadContext(dir).stopCommitted, true);
});

test("loadContext: a malformed dispatch file is an entry with an error, not a throw", () => {
  const dir = makeRepo();
  put(dir, "hsdd/auto/dispatch/S00.md", "no front matter\n");
  const ctx = loadContext(dir);
  assert.equal(ctx.dispatches.get("S00").front, null);
  assert.match(ctx.dispatches.get("S00").error, /front matter/);
  assert.equal(ctx.inProgress, "S00");
});

test("loadContext: setup commit, files changed in the segment, verified phases, memoized registry", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const segment = "2026-10-22-plan";
  addSegment(dir, { id: segment, mode: "plan", opened_at: T, instruction: "plan", stop_policy: "stop", first_step: "S00" });
  const { commit } = fakeStep(dir, { step: "S00", segment, kind: "setup", target: "shop", files: { "hsdd/auto/note.md": "n\n" } });
  put(dir, "hsdd/spec/new.md", "# new\n");
  put(dir, "hsdd/spec/shop.api.md", "# changed\n");
  put(dir, "hsdd/verify/shop.api.1.verification.md", "# v\n");
  gitIn(dir, "add", "hsdd/verify");
  gitIn(dir, "commit", "-q", "-m", "verify");
  let calls = 0;
  const ctx = loadContext(dir, { registry: () => { calls++; return { c0: [], c1: [], skipped: false }; } });
  assert.equal(ctx.segment.id, segment);
  assert.equal(ctx.setupCommit(segment), commit);
  assert.equal(ctx.setupCommit("other"), null);
  const changed = ctx.changedInSegment(segment);
  assert.ok(changed.has("hsdd/auto/note.md"));
  assert.ok(changed.has("hsdd/spec/new.md"));
  assert.ok(changed.has("hsdd/spec/shop.api.md"));
  assert.ok(!changed.has("hsdd/spec/shop.web.md"));
  assert.equal(ctx.changedInSegment(segment), changed);
  assert.deepEqual([...ctx.verifiedPhases], ["shop.api.1"]);
  assert.equal(calls, 0);
  assert.equal(ctx.registry(), ctx.registry());
  assert.equal(calls, 1);
});

test("loadContext: the intake record of an intake segment", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const record = readFileSync(join(import.meta.dirname, "fixtures/auto/intake/2026-10-22-intake-order-v2.md"), "utf8");
  put(dir, "hsdd/management/2026-10-22-intake-order-v2.md", record);
  addSegment(dir, { id: "2026-10-22-intake-order-v2", mode: "intake", opened_at: T, instruction: "intake", stop_policy: "stop", first_step: "S00", request: "ref/spec-v2.md", authority: "accepted-rfc" });
  const ctx = loadContext(dir);
  assert.equal(ctx.intake.records.length, 1);
  assert.equal(ctx.intake.record.slug, "order-v2");
});
