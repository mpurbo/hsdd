import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendDecisions, appendRunLine, main, nextDecisionId, validateLedger } from "../skills/hsdd-auto/scripts/ledger.mjs";
import { decide } from "../skills/hsdd-auto/scripts/decide.mjs";
import { readJsonl, readDispatch } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { commitStamp } from "../skills/hsdd-auto/scripts/lib/git.mjs";
import { stampMs } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, gitIn, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const SEGMENT = "2026-10-22-plan";
const planSeg = { id: SEGMENT, mode: "plan", opened_at: "2020-01-01T00:00:00Z", instruction: "plan", stop_policy: "stop", first_step: "S00" };
const LEGACY = join(dirname(fileURLToPath(import.meta.url)), "fixtures/auto/ledger/legacy.jsonl");
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
const repo = (steps = [["S00", "mid-level-spec", "shop.api"]]) => {
  const dir = makeRepo({ stage: "06-planned" });
  addSegment(dir, planSeg);
  for (const [step, kind, target] of steps) openStep(dir, { step, segment: SEGMENT, kind, target });
  return dir;
};
const commitAll = (dir) => {
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "--allow-empty", "-m", "artifact");
  return gitIn(dir, "rev-parse", "HEAD");
};
const silent = () => { const out = []; return { out, log: (l) => out.push(l) }; };
const stamp = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const ledger = (dir) => readJsonl(dir, P.ledger);
const writeLedger = (dir, lines) => put(dir, P.ledger, lines.map((l) => `${JSON.stringify(l)}\n`).join(""));

test("appends a sidecar in id order with segment, step_ref and commit", () => {
  const dir = repo();
  const a = decide(dir, { step: "S00", input: input({ question: "first" }) });
  const b = decide(dir, { step: "S00", by: "orchestrator", input: input({ question: "second" }) });
  // an out-of-order sidecar still lands in id order
  const side = join(dir, "hsdd/auto/steps/S00.decisions.jsonl");
  const [l1, l2] = readFileSync(side, "utf8").trim().split("\n");
  writeFileSync(side, `${l2}\n${l1}\n`);
  const commit = commitAll(dir);
  assert.equal(appendDecisions(dir, "S00", commit), 2);
  const lines = ledger(dir);
  assert.deepEqual(lines.map((l) => l.id), [a.id, b.id]);
  assert.deepEqual(lines.map((l) => [l.segment, l.step_ref, l.commit, l.by, l.step]), [
    [SEGMENT, "S00", commit, "subagent", "mid-level-spec"], [SEGMENT, "S00", commit, "orchestrator", "plan"],
  ]);
  assert.equal(appendDecisions(dir, "S00", commit), 0);
  assert.equal(ledger(dir).length, 2);
  assert.deepEqual(validateLedger(dir), { errors: [], warnings: [] });
});

test("appendDecisions after a crash appends only the missing line; an invalid sidecar line writes nothing", () => {
  const dir = repo();
  decide(dir, { step: "S00", input: input() });
  decide(dir, { step: "S00", input: input() });
  const commit = commitAll(dir);
  const [first] = readFileSync(join(dir, "hsdd/auto/steps/S00.decisions.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  writeLedger(dir, [{ ...first, segment: SEGMENT, step_ref: "S00", commit }]);
  assert.equal(appendDecisions(dir, "S00", commit), 1);
  assert.deepEqual(ledger(dir).map((l) => l.id), ["DEC-001", "DEC-002"]);

  const bad = repo();
  decide(bad, { step: "S00", input: input() });
  put(bad, "hsdd/auto/steps/S00.decisions.jsonl", `${readFileSync(join(bad, "hsdd/auto/steps/S00.decisions.jsonl"), "utf8")}${JSON.stringify({ id: "DEC-002" })}\n`);
  assert.throws(() => appendDecisions(bad, "S00", commitAll(bad)), /DEC-002/);
  assert.deepEqual(ledger(bad), []);
});

test("appendRunLine takes started, dispatches and continues from the dispatch file", () => {
  const dir = repo([["S00", "mid-level-spec", "shop.api"], ["S01", "plan", SEGMENT]]);
  const commit = commitAll(dir);
  assert.equal(appendRunLine(dir, { step: "S00", commit, status: "completed", model: "m-1", usage: { input_tokens: 5, output_tokens: 7 }, note: "n" }), true);
  assert.equal(appendRunLine(dir, { step: "S00", commit, status: "completed" }), false);
  assert.equal(appendRunLine(dir, { step: "S01", commit, status: "stopped" }), true);
  const [s0, s1] = readJsonl(dir, P.runLog);
  const front = readDispatch(dir, "S00").front;
  assert.equal(s0.started, front.rendered_at);
  assert.equal(s0.dispatches, 1);
  assert.equal(s0.finished, commitStamp(dir, commit));
  assert.deepEqual([s0.kind, s0.skill, s0.target, s0.segment, s0.model, s0.note], ["mid-level-spec", "hsdd-spec", "shop.api", SEGMENT, "m-1", "n"]);
  assert.equal(s0.continues, undefined);
  assert.deepEqual([s1.dispatches, s1.skill, s1.status], [0, "none", "stopped"]);
  assert.equal(readJsonl(dir, P.runLog).length, 2);
  assert.throws(() => appendRunLine(dir, { step: "S09", commit, status: "completed" }), /no readable dispatch/);
});

test("appendRunLine carries continues from a dispatch file", () => {
  const dir = repo([["S00", "mid-level-spec", "shop.api"]]);
  const text = readFileSync(join(dir, "hsdd/auto/dispatch/S00.md"), "utf8").replace("continues: null", "continues: S00");
  put(dir, "hsdd/auto/dispatch/S01.md", text.replace("step_ref: S00", "step_ref: S01"));
  assert.equal(appendRunLine(dir, { step: "S01", commit: commitAll(dir), status: "completed" }), true);
  assert.equal(readJsonl(dir, P.runLog)[0].continues, "S00");
});

test("a clean committed step validates with no findings", () => {
  const dir = repo([["S00", "mid-level-spec", "shop.api"], ["S01", "plan", SEGMENT]]);
  decide(dir, { step: "S00", input: input() });
  const commit = commitAll(dir);
  appendDecisions(dir, "S00", commit);
  appendRunLine(dir, { step: "S00", commit, status: "completed" });
  assert.deepEqual(validateLedger(dir), { errors: [], warnings: [] });
});

const committedWith = (dir, over) => {
  decide(dir, { step: "S00", input: input() });
  const commit = commitAll(dir);
  appendDecisions(dir, "S00", commit);
  writeLedger(dir, ledger(dir).map((l) => ({ ...l, ...over(l, commit) })));
  return commit;
};

test("rejects a subagent decision outside its window", () => {
  const dir = repo();
  const front = readDispatch(dir, "S00").front;
  committedWith(dir, () => ({ at: stamp(stampMs(front.rendered_at) - 120_000) }));
  const { errors } = validateLedger(dir);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /DEC-001.*outside S00's window/);

  const late = repo();
  committedWith(late, (l, commit) => ({ at: stamp(stampMs(commitStamp(late, commit)) + 120_000) }));
  assert.match(validateLedger(late, { now: stamp(Date.now() + 600_000) }).errors.join("\n"), /DEC-001.*outside S00's window/);
});

test("an orchestrator decision runs to the next step's rendered_at", () => {
  const t0 = stampMs("2026-10-22T10:00:00Z");
  const mk = (atMs, orchestrator = true) => {
    const dir = makeRepo({ stage: "06-planned" });
    addSegment(dir, planSeg);
    openStep(dir, { step: "S00", segment: SEGMENT, kind: "plan", target: SEGMENT, renderedAt: stamp(t0) });
    openStep(dir, { step: "S01", segment: SEGMENT, kind: "plan", target: SEGMENT, renderedAt: stamp(t0 + 600_000) });
    decide(dir, { step: "S00", by: orchestrator ? "orchestrator" : "owner", input: input() });
    const commit = commitAll(dir);
    appendDecisions(dir, "S00", commit);
    writeLedger(dir, ledger(dir).map((l) => ({ ...l, at: stamp(atMs) })));
    return validateLedger(dir).errors;
  };
  assert.deepEqual(mk(t0 + 599_000), []);
  assert.deepEqual(mk(t0 - 59_000), []);
  assert.match(mk(t0 + 601_000)[0], /outside S00's window/);
  assert.match(mk(t0 - 61_000, false)[0], /outside S00's window/);
});

test("rejects a time in the future, before the segment opened, and a missing commit", () => {
  const dir = repo();
  committedWith(dir, () => ({ at: stamp(Date.now() + 3_600_000) }));
  assert.match(validateLedger(dir).errors.join("\n"), /lies in the future/);

  const early = repo();
  addSegment(early, { ...planSeg, id: "2026-10-23-plan", opened_at: "2999-01-01T00:00:00Z", first_step: "S05" });
  committedWith(early, () => ({ segment: "2026-10-23-plan" }));
  assert.match(validateLedger(early, { now: "2999-06-01T00:00:00Z" }).errors.join("\n"), /before segment 2026-10-23-plan opened/);

  const gone = repo();
  committedWith(gone, () => ({ commit: "deadbeef" }));
  assert.match(validateLedger(gone).errors.join("\n"), /commit deadbeef does not exist/);
});

test("rejects lines that break the schema or the code rules, and duplicate or decreasing ids", () => {
  const dir = repo();
  committedWith(dir, () => ({}));
  const [a] = ledger(dir);
  writeLedger(dir, [
    a,
    { ...a, id: "DEC-001" },
    { ...a, id: "DEC-005", chosen: "nope" },
    { ...a, id: "DEC-003", would_have_asked: true },
    { ...a, id: "DEC-006", blast_radius: "upstream" },
    { ...a, id: "DEC-007", extra: 1 },
  ]);
  const text = validateLedger(dir).errors.join("\n");
  assert.match(text, /DEC-001: id appears more than once/);
  assert.match(text, /DEC-005: chosen is not one of/);
  assert.match(text, /DEC-003: ids must increase/);
  assert.match(text, /DEC-003: stop_class is set exactly when/);
  assert.match(text, /DEC-006: blast_radius upstream implies/);
  assert.match(text, /DEC-007: .*unexpected property extra/);
});

const withLegacy = (dir) => {
  const commit = gitIn(dir, "rev-parse", "HEAD");
  put(dir, P.ledger, readFileSync(LEGACY, "utf8").replaceAll("{{commit}}", commit));
  return commit;
};

test("warns once for legacy lines", () => {
  const dir = repo();
  withLegacy(dir);
  const r = validateLedger(dir);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /3 legacy ledger line/);
});

test("legacy lines are shape-checked but not window-checked; a legacy line with by or a bad offset is an error", () => {
  const dir = repo();
  const commit = withLegacy(dir);
  const [a, b, c] = ledger(dir);
  writeLedger(dir, [{ ...a, by: "owner" }, { ...b, at: "yesterday" }, { ...c, question: "" }]);
  const text = validateLedger(dir).errors.join("\n");
  assert.match(text, /DEC-001: legacy line has by/);
  assert.match(text, /DEC-002: at: not a timestamp/);
  assert.match(text, /DEC-003: \$\.question/);
  assert.ok(commit);
});

test("legacy and current lines mix, and legacy run lines warn once", () => {
  const dir = repo();
  const commit = withLegacy(dir);
  const legacyRun = { step_ref: "S00", kind: "plan", skill: "none", target: "x", started: "2026-09-01T10:00:00+07:00", finished: "2026-09-01T10:10:00+07:00", commit, dispatches: 0, status: "completed" };
  put(dir, P.runLog, `${JSON.stringify(legacyRun)}\n${JSON.stringify({ ...legacyRun, step_ref: "S01" })}\n`);
  const r = validateLedger(dir);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[1], /2 legacy run log line/);
});

test("warns on an id gap", () => {
  const dir = repo();
  committedWith(dir, () => ({}));
  const [a] = ledger(dir);
  writeLedger(dir, [a, { ...a, id: "DEC-003" }]);
  const r = validateLedger(dir);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /gap between DEC-001 and DEC-003/);
});

test("run log lines: schema, one per step, commit exists", () => {
  const dir = repo();
  const commit = commitAll(dir);
  appendRunLine(dir, { step: "S00", commit, status: "completed" });
  const [l] = readJsonl(dir, P.runLog);
  put(dir, P.runLog, [l, l, { ...l, step_ref: "S01", commit: "deadbeef" }, { ...l, step_ref: "S02", status: "weird" }].map((x) => `${JSON.stringify(x)}\n`).join(""));
  const text = validateLedger(dir).errors.join("\n");
  assert.match(text, /run line S00: more than one run line/);
  assert.match(text, /run line S01: commit deadbeef does not exist/);
  assert.match(text, /run line S02: .*status/);
});

test("next-id prints what decide would mint", () => {
  const dir = repo();
  const out = silent();
  assert.equal(main(["next-id"], dir, out), 0);
  assert.deepEqual(out.out, ["DEC-001"]);
  const { id } = decide(dir, { step: "S00", input: input() });
  assert.equal(id, "DEC-001");
  assert.equal(nextDecisionId(dir), "DEC-002");
  assert.equal(run(dir, "ledger.mjs", ["next-id"]).stdout.trim(), "DEC-002");
});

test("CLI: decisions, run, validate and usage errors", () => {
  const dir = repo();
  decide(dir, { step: "S00", input: input() });
  const commit = commitAll(dir);
  const d = run(dir, "ledger.mjs", ["decisions", "--step", "S00", "--commit", commit]);
  assert.equal(d.code, 0, d.stdout);
  assert.equal(d.stdout.trim(), "decisions S00: appended 1");
  put(dir, "u.json", JSON.stringify({ input_tokens: 1, output_tokens: 2 }));
  const r = run(dir, "ledger.mjs", ["run", "--step", "S00", "--commit", commit, "--status", "completed", "--usage-file", "u.json", "--note", "n"]);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(readJsonl(dir, P.runLog)[0].usage, { input_tokens: 1, output_tokens: 2 });
  assert.match(run(dir, "ledger.mjs", ["run", "--step", "S00", "--commit", commit, "--status", "completed"]).stdout, /nothing appended/);
  const v = run(dir, "ledger.mjs", ["validate"]);
  assert.equal(v.code, 0, v.stdout);
  assert.equal(v.stdout.trim().split("\n").at(-1), "ledger: 0 error(s), 0 warning(s)");
  writeLedger(dir, [{ id: "DEC-001" }]);
  const bad = run(dir, "ledger.mjs", ["validate"]);
  assert.equal(bad.code, 1);
  assert.match(bad.stdout.trim().split("\n").at(-1), /ledger: \d+ error/);
  assert.equal(run(dir, "ledger.mjs", ["decisions", "--step", "S00"]).code, 2);
  assert.equal(run(dir, "ledger.mjs", ["run", "--step", "S00", "--commit", commit, "--status", "bogus"]).code, 2);
  assert.equal(run(dir, "ledger.mjs", ["frobnicate"]).code, 2);
  assert.equal(run(dir, "ledger.mjs", ["decisions", "--step", "S77", "--commit", commit]).code, 1);
});
