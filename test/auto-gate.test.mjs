import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { finalGate, formatFindings, stepGate } from "../skills/hsdd-auto/scripts/gate.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { unmetDone } from "../skills/hsdd-auto/scripts/next.mjs";
import { RAISED_WHEN } from "../skills/hsdd-auto/scripts/lib/kinds.mjs";
import { P, reportPath, stepPaths } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { appendJsonl, readDispatch, writeDispatch } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, baseConfig, fakeStep, gitIn, installScripts, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const SEG = "2026-10-22-plan";
const API = "hsdd/spec/shop.api.md";
const WEB = "hsdd/spec/shop.web.app.md";
const CONTRACT = "hsdd/contract/order-api.md";
const INDEX = "hsdd/contract/INDEX.md";
const REPORT = `hsdd/auto/report/${SEG}.md`;
const EARLY = "2026-01-01T00:00:00Z";
const LATE = "2099-01-01T00:00:00Z";

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const edit = (dir, rel, from, to) => {
  const t = read(dir, rel);
  assert.ok(t.includes(from), `${rel} has no ${JSON.stringify(from)}`);
  put(dir, rel, t.replace(from, to));
};
const commitAll = (dir, msg = "owner edit") => { gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "--allow-empty", "-m", msg); };
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

const segment = () => ({ id: SEG, mode: "plan", opened_at: nowStamp(), instruction: "Plan the shop.", stop_policy: "stop", first_step: "S00" });

// A repository at a fixture stage with the scripts installed (A3), one plan segment opened, and its
// setup (S00) and plan (S01) steps committed. `prepare` edits the tree before the segment opens.
const begun = ({ stage = "06-planned", config, files, prepare } = {}) => {
  const dir = makeRepo({ stage, config, files });
  installScripts(dir);
  prepare?.(dir);
  commitAll(dir, "install the scripts");
  addSegment(dir, segment());
  fakeStep(dir, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  fakeStep(dir, { step: "S01", segment: SEG, kind: "plan", target: SEG });
  return dir;
};

const open = (dir, kind, target, step = "S02", over = {}) => openStep(dir, { step, segment: SEG, kind, target, ...over });

const reportOf = (step, skill, target, over = {}) => ({
  step_ref: step, skill, target, status: "completed", stop: null, artifacts: [], experiments: [], self_check: [],
  routed: [], closes: [], reads_outside: [], notes: ["did the step"], read_check: "00000000", ...over,
});
const writeReport = (dir, step, report, n = 0) => put(dir, reportPath(step, n), `${JSON.stringify(report, null, 2)}\n`);
const touchReport = (over) => reportOf("S02", "hsdd-spec", "shop.api", { artifacts: [API], ...over });

const TOUCH = ["keeps totals in integer cents.", "keeps totals in integer cents, never floats."];
const WEB_TOUCH = ["never recomputed.", "never recomputed on the client."];
const OQ9 = ["defined in the root spec).\n", "defined in the root spec). Expiry also waits on OQ9.\n"];
const oq9 = (dir) => edit(dir, API, ...OQ9);

// S02: an open spec-touch on shop.api that changed its spec and wrote a valid report.
const touched = (opts) => {
  const dir = begun(opts);
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport());
  return dir;
};

const decision = (over = {}) => ({
  id: "DEC-001", at: nowStamp(), by: "subagent", step: "mid-level-spec", artifact: API, question: "Which wording?",
  options: [{ label: "a", consequence: "keeps it short" }, { label: "b", consequence: "spells it out" }], chosen: "a",
  why: "shorter", evidence: [], blast_radius: "node-local", confidence: "high", would_have_asked: false, stop_class: null,
  would_upstream: false, ...over,
});
const writeSidecar = (dir, step, lines) => put(dir, stepPaths(step).decisions, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");

const addLaunch = (dir, step, reason) => {
  const d = readDispatch(dir, step);
  writeDispatch(dir, step, { ...d.front, launches: [...d.front.launches, { at: nowStamp(), reason }] }, d.body);
};

const gate = (dir, step = "S02", opts) => stepGate(loadContext(dir), step, opts);
const final = (dir) => finalGate(loadContext(dir));
const of = (fs, id) => fs.filter((f) => f.id === id);
const errors = (fs) => fs.filter((f) => f.level === "error");
const show = (fs) => JSON.stringify(fs, null, 1);
const queueLine = (dir, line) => appendJsonl(dir, P.queue, line);
const item = (id, kind, target, over = {}) => ({ id, at: EARLY, status: "open", from: "S01", target, kind, text: `item ${id}`, ...over });

// ---------- a clean step ----------

test("a clean completed subagent step passes every check", () => {
  const fs = gate(touched());
  assert.deepEqual(fs, [], show(fs));
});

// ---------- A ----------

test("A1 admits the write set, the report series, the sidecar, experiments, the judgement set and owner files", () => {
  const dir = touched({ config: baseConfig({ owner_files: ["notes/owner.md"] }), files: { "notes/owner.md": "mine\n" } });
  put(dir, "hsdd/auto/experiments/probe/README.md", "the finding\n");
  put(dir, reportPath("S02", 1), "{}\n");
  writeSidecar(dir, "S02", [decision()]);
  queueLine(dir, item("Q-001", "consider", "shop.api"));
  put(dir, P.plan, "# Run plan: shop\n");
  put(dir, "notes/owner.md", "changed by the owner\n");
  const fs = gate(dir, "S02", { checks: ["A1"] });
  assert.deepEqual(fs, [], show(fs));
});

test("A1 fails a path outside the write set", () => {
  const dir = touched();
  put(dir, "src/app.js", "x\n");
  edit(dir, CONTRACT, "G3: every amount", "G3: each amount");
  const fs = of(gate(dir), "A1");
  assert.deepEqual(fs.map((f) => f.file), [CONTRACT, "src/app.js"]);
  assert.ok(fs.every((f) => f.level === "error" && /outside the write set/.test(f.message)), show(fs));
});

test("A1 ignores the decide lock and reports never-list paths as forbidden", () => {
  const dir = touched();
  put(dir, P.decideLock, "4242\n");
  put(dir, P.runYaml, `${read(dir, P.runYaml)}# a note\n`);
  put(dir, "ref/spec.md", "# Spec v1, edited\n");
  put(dir, ".claude/settings.json", "{}\n");
  put(dir, "hsdd/judgement/decision-reviews.jsonl", "{}\n");
  const fs = of(gate(dir), "A1");
  assert.deepEqual(fs.map((f) => f.file), [".claude/settings.json", "hsdd/auto/run.yaml", "hsdd/judgement/decision-reviews.jsonl", "ref/spec.md"]);
  assert.ok(fs.every((f) => f.level === "error" && /never list/.test(f.message) && /forbidden/.test(f.message)), show(fs));
});

test("A2 fails a changed owner file, and is a warning on a stopped step", () => {
  const config = baseConfig({ owner_files: ["notes/owner.md", "notes/absent.md"] });
  const snapshot = JSON.stringify({ "notes/owner.md": sha256("mine\n"), "notes/absent.md": null });
  const dir = touched({ config, files: { "notes/owner.md": "mine\n", [P.ownerFiles]: snapshot } });
  assert.deepEqual(of(gate(dir), "A2"), []);
  put(dir, "notes/owner.md", "changed\n");
  put(dir, "notes/absent.md", "now present\n");
  const fs = of(gate(dir), "A2");
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", "notes/owner.md"], ["error", "notes/absent.md"]]);
  assert.deepEqual(of(gate(dir, "S02", { status: "stopped" }), "A2").map((f) => f.level), ["warn", "warn"]);
});

test("A2 fails when owner files have no snapshot", () => {
  const dir = touched({ config: baseConfig({ owner_files: ["notes/owner.md"] }), files: { "notes/owner.md": "mine\n" } });
  const fs = of(gate(dir), "A2");
  assert.equal(fs.length, 1);
  assert.match(fs[0].message, /owner-files\.json/);
});

test("an owner file is protected by its exact path, and nothing beside it is", () => {
  const config = baseConfig({ owner_files: ["notes/owner.md"] });
  const dir = touched({ config, files: { "notes/owner.md": "mine\n", "notes/other.md": "x\n", [P.ownerFiles]: JSON.stringify({ "notes/owner.md": sha256("mine\n") }) } });
  put(dir, "notes/owner.md", "changed\n");
  put(dir, "notes/other.md", "changed too\n");
  const fs = gate(dir);
  assert.deepEqual(of(fs, "A1").map((f) => f.file), ["notes/other.md"], show(fs));
  assert.match(of(fs, "A1")[0].message, /outside the write set/);
  assert.deepEqual(of(fs, "A2").map((f) => [f.level, f.file]), [["error", "notes/owner.md"]]);
});

test("A3 fails a stale copy of the scripts and a changed generator", () => {
  assert.deepEqual(of(gate(touched()), "A3"), []);
  const dir = begun({
    prepare: (d) => {
      rmSync(join(d, "hsdd/scripts/auto/routed.mjs"));
      put(d, "hsdd/scripts/auto/VERSION", "0.10.9\n");
      put(d, "hsdd/scripts/auto/extra.mjs", "export {};\n");
      put(d, P.genRegistry, `${read(d, P.genRegistry)}// edited by hand\n`);
    },
  });
  open(dir, "spec-touch", "shop.api");
  const fs = gate(dir, "S02", { checks: ["A3"] });
  assert.equal(fs.length, 2, show(fs));
  assert.ok(fs.every((f) => f.id === "A3" && f.level === "error"));
  assert.match(fs[0].message, /VERSION 0\.10\.9/);
  assert.match(fs[0].message, /routed\.mjs/);
  assert.match(fs[0].message, /extra\.mjs/);
  assert.match(fs[1].message, /gen-registry\.mjs/);

  const missing = begun({ prepare: (d) => rmSync(join(d, P.scriptsAuto), { recursive: true }) });
  open(missing, "spec-touch", "shop.api");
  const gone = gate(missing, "S02", { checks: ["A3"] });
  assert.equal(gone.length, 1);
  assert.match(gone[0].message, /does not exist/);
});

test("A3 is a warning on a stopped setup step, and an error otherwise", () => {
  const dir = begun({ prepare: (d) => rmSync(join(d, P.scriptsAuto), { recursive: true }) });
  open(dir, "setup", SEG);
  const level = (opts) => gate(dir, "S02", { ...opts, checks: ["A3"] }).map((f) => `${f.id}:${f.level}`);
  assert.deepEqual(level({ status: "stopped" }), ["A3:warn"]);
  assert.deepEqual(level({ status: "completed" }), ["A3:error"]);
  open(dir, "spec-touch", "shop.api", "S03");
  assert.deepEqual(gate(dir, "S03", { status: "stopped", checks: ["A3"] }).map((f) => `${f.id}:${f.level}`), ["A3:error"], "only a setup step may stop before the copy");
  installScripts(dir);
  assert.deepEqual(gate(dir, "S02", { status: "stopped", checks: ["A3"] }), [], "a current copy passes");
});

test("A4 fails when the step staged or committed", () => {
  const dir = touched();
  assert.deepEqual(of(gate(dir), "A4"), []);
  gitIn(dir, "add", API);
  const staged = of(gate(dir), "A4");
  assert.equal(staged.length, 1);
  assert.match(staged[0].message, /index is not empty/);
  assert.match(staged[0].message, /shop\.api\.md/);
  gitIn(dir, "commit", "-q", "-m", "the step committed");
  const moved = of(gate(dir), "A4");
  assert.equal(moved.length, 1);
  assert.match(moved[0].message, /HEAD/);
});

// ---------- B ----------

test("a step without a sidecar passes B1", () => {
  assert.deepEqual(of(gate(touched()), "B1"), []);
});

test("B1 passes a valid sidecar", () => {
  const dir = touched();
  writeSidecar(dir, "S02", [decision(), decision({ id: "DEC-002", by: "orchestrator", step: "plan", artifact: null })]);
  assert.deepEqual(of(gate(dir), "B1"), []);
});

test("B1 fails a missing report", () => {
  const dir = touched();
  rmSync(join(dir, reportPath("S02", 0)));
  const fs = of(gate(dir), "B1");
  assert.equal(fs.length, 1);
  assert.match(fs[0].message, /hsdd\/auto\/steps\/S02\.json does not exist/);
});

const STOP = {
  question: "Which axis?", skill_rule: "Stop when the axis is unknown.", stop_class: "axis",
  options: [{ label: "a", consequence: "split by team" }, { label: "b", consequence: "split by deploy target" }], recommendation: "a", blocks: "the children",
};

const B1_FAILS = [
  ["a schema error", { status: "done" }, /status/],
  ["a completed report with a stop", { stop: STOP }, /stop is null exactly when status is completed/],
  ["a stopped report without a stop", { status: "stopped" }, /stop is null exactly when status is completed/],
  ["one option outside procedural", { status: "stopped", stop: { ...STOP, options: [STOP.options[0]] } }, /at least two options/],
  ["a recommendation that is no option's label", { status: "stopped", stop: { ...STOP, recommendation: "c" } }, /recommendation/],
  ["an insert-step entry without its step fields", { routed: [{ target: "run", kind: "insert-step", text: "add a step" }] }, /step_kind and step_target/],
  ["a consider entry with step fields", { routed: [{ target: "shop.api", kind: "consider", text: "t", step_kind: "spec-touch", step_target: "shop.api" }] }, /step_kind and step_target/],
  ["a run-stop candidate that does not quote its Raised when line", { status: "run-stop-candidate", stop: { ...STOP, stop_class: "external" } }, /Raised when/],
  ["another step's report", { step_ref: "S09" }, /step_ref/],
  ["another target", { target: "shop.web.app" }, /target/],
  ["an artifact that does not exist", { artifacts: ["hsdd/spec/shop.nope.md"] }, /shop\.nope\.md, which does not exist/],
];

for (const [name, over, pattern] of B1_FAILS) {
  test(`B1 fails ${name}`, () => {
    const dir = touched();
    writeReport(dir, "S02", touchReport(over));
    const fs = of(gate(dir), "B1");
    assert.ok(fs.length > 0, "a B1 finding");
    assert.ok(fs.every((f) => f.level === "error" && f.message.startsWith("hsdd/auto/steps/S02.json")), show(fs));
    assert.ok(fs.some((f) => pattern.test(f.message)), show(fs));
  });
}

test("B1 passes a procedural stop with one option and a run-stop candidate quoting its Raised when line", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ status: "stopped", stop: { ...STOP, stop_class: "procedural", options: [STOP.options[0]] } }));
  assert.deepEqual(of(gate(dir, "S02", { status: "stopped" }), "B1"), []);
  writeReport(dir, "S02", touchReport({ status: "run-stop-candidate", stop: { ...STOP, stop_class: "external", skill_rule: `"${RAISED_WHEN.external}"` } }));
  assert.deepEqual(of(gate(dir, "S02", { status: "stopped" }), "B1"), []);
});

test("B1 requires one report per launch of the current series", () => {
  const dir = touched();
  addLaunch(dir, "S02", "resume-finding");
  const fs = of(gate(dir), "B1");
  assert.equal(fs.length, 1, show(fs));
  assert.match(fs[0].message, /hsdd\/auto\/steps\/S02\.r1\.json does not exist/);
  writeReport(dir, "S02", touchReport({ artifacts: [] }), 1);
  assert.deepEqual(of(gate(dir), "B1"), []);
  put(dir, reportPath("S02", 2), `${JSON.stringify(touchReport())}\n`);
  assert.match(of(gate(dir), "B1")[0]?.message ?? "", /S02\.r2\.json has no launch/);
});

test("B1 starts the series again after a redispatch", () => {
  const dir = touched();
  addLaunch(dir, "S02", "resume-finding");
  addLaunch(dir, "S02", "redispatch");
  assert.deepEqual(of(gate(dir), "B1"), []);
});

test("B1 requires a completed step's latest report to say completed, except under named checks", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ status: "stopped", stop: STOP }));
  const fs = of(gate(dir), "B1");
  assert.equal(fs.length, 1, show(fs));
  assert.match(fs[0].message, /^hsdd\/auto\/steps\/S02\.json: status "stopped"; a step committed completed needs the latest report/);
  assert.deepEqual(of(gate(dir, "S02", { status: "stopped" }), "B1"), [], "a stopped step may have a stopped report");
  assert.deepEqual(gate(dir, "S02", { checks: ["B1"] }), [], "named checks run whatever the status (8.3 checks a stopped report's read)");
  addLaunch(dir, "S02", "resume-answer");
  writeReport(dir, "S02", touchReport({ artifacts: [] }), 1);
  assert.deepEqual(of(gate(dir), "B1"), [], "the latest report decides");
});

test("B1 fails an unparsable or invalid sidecar, naming the file", () => {
  const dir = touched();
  writeSidecar(dir, "S02", [decision(), "{oops"]);
  const fs = of(gate(dir), "B1");
  assert.equal(fs.length, 1, show(fs));
  assert.match(fs[0].message, /^hsdd\/auto\/steps\/S02\.decisions\.jsonl:2: not valid JSON/);
  writeSidecar(dir, "S02", [decision({ chosen: "c" }), decision({ id: "DEC-002", confidence: "certain" })]);
  const bad = of(gate(dir), "B1");
  assert.ok(bad.some((f) => /S02\.decisions\.jsonl:1: .*chosen/.test(f.message)), show(bad));
  assert.ok(bad.some((f) => /S02\.decisions\.jsonl:2: .*confidence/.test(f.message)), show(bad));
});

test("B1 on unparsable report", () => {
  const dir = begun();
  open(dir, "spec-touch", "shop.api", "S04");
  put(dir, reportPath("S04", 0), "{not json");
  const fs = gate(dir, "S04");
  const b1 = of(fs, "B1");
  assert.equal(b1.length, 1, show(fs));
  assert.equal(b1[0].level, "error");
  assert.match(b1[0].message, /^hsdd\/auto\/steps\/S04\.json: not valid JSON/);
  const r = run(dir, "gate.mjs", ["--step", "S04"]);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^ERROR B1 hsdd\/auto\/steps\/S04\.json: not valid JSON/m);
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /, "no stack trace");
  assert.match(r.stdout.trimEnd().split("\n").at(-1), /^gate: \d+ error\(s\), \d+ warning\(s\), \d+ changed file\(s\)$/);
});

test("B2 fails a subagent decision outside the step's window", () => {
  const dir = touched();
  writeSidecar(dir, "S02", [decision()]);
  assert.deepEqual(of(gate(dir), "B2"), []);
  writeSidecar(dir, "S02", [
    decision({ at: EARLY }),
    decision({ id: "DEC-002", at: LATE }),
    decision({ id: "DEC-003", at: EARLY, by: "orchestrator", step: "plan" }),
    decision({ id: "DEC-004", at: "2026-13-45T00:00:00Z" }),
  ]);
  const fs = of(gate(dir), "B2");
  assert.deepEqual(fs.map((f) => f.level), ["error", "error", "error"], show(fs));
  assert.match(fs[0].message, /DEC-001/);
  assert.match(fs[1].message, /DEC-002/);
  assert.match(fs[2].message, /DEC-004/, "a time that does not exist is outside every window, never an exception");
});

test("B3 requires every matching item open at rendered_at to be closed", () => {
  const dir = begun();
  queueLine(dir, item("Q-001", "must-address", "shop.api"));
  queueLine(dir, item("Q-002", "consider", "shop.api"));
  queueLine(dir, item("Q-003", "must-address", "shop.web.app"));
  queueLine(dir, item("Q-004", "must-address", "shop.api", { at: LATE }));
  commitAll(dir, "queue");
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport());
  const fs = of(gate(dir), "B3");
  assert.deepEqual(fs.map((f) => [f.level, f.message.slice(0, 5)]), [["error", "Q-001"], ["warn", "Q-002"]], show(fs));
  writeReport(dir, "S02", touchReport({ closes: [{ id: "Q-001", outcome: "addressed", note: "done" }] }));
  writeReport(dir, "S02", touchReport({ closes: [{ id: "Q-002", outcome: "explained", note: "not needed" }] }), 1);
  addLaunch(dir, "S02", "resume-finding");
  assert.deepEqual(of(gate(dir), "B3"), [], "the union of the series closes both");
});

// A closes entry routed.mjs ingest would refuse: a conflicting outcome (Q-001) and an id with no open line (Q-099).
const refused = (status = "completed") => {
  const dir = begun();
  queueLine(dir, item("Q-001", "must-address", "shop.api"));
  queueLine(dir, { id: "Q-001", at: "2026-01-01T00:00:01Z", status: "explained", by: "S01", note: "out of scope" });
  commitAll(dir, "queue");
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  const closes = [{ id: "Q-001", outcome: "addressed", note: "done" }, { id: "Q-099", outcome: "addressed", note: "?" }];
  writeReport(dir, "S02", touchReport(status === "completed" ? { closes } : { closes, status: "stopped", stop: STOP }));
  return dir;
};

test("a closes entry ingest would refuse is a B1 error naming the item, printed once", () => {
  const fs = gate(refused());
  const b1 = of(fs, "B1");
  assert.equal(b1.length, 2, show(fs));
  assert.ok(b1.every((f) => f.level === "error"));
  assert.match(b1[0].message, /Q-001/);
  assert.match(b1[0].message, /already explained/);
  assert.match(b1[1].message, /Q-099/);
  assert.ok(!of(fs, "B3").some((f) => /Q-0(01|99)/.test(f.message)), "not printed again under B3");
  const b3 = gate(refused(), "S02", { checks: ["B3"] });
  assert.deepEqual(b3.map((f) => [f.id, f.level, f.message.slice(0, 5)]), [["B3", "error", "Q-001"], ["B3", "error", "Q-099"]], show(b3));
});

test("a stopped step whose report closes an unknown item fails B1", () => {
  const dir = refused("stopped");
  const fs = gate(dir, "S02", { status: "stopped" });
  assert.ok(of(fs, "B1").some((f) => f.level === "error" && /Q-099 has no open line/.test(f.message)), show(fs));
  assert.deepEqual(gate(dir, "S02", { status: "stopped", noReport: true }), [], "under --no-report the series is renamed and the check is moot");
});

test("B4 warns on reads outside the read set", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ reads_outside: [{ path: "hsdd/spec/shop.web.app.md", why: "checked a citation" }] }));
  const fs = of(gate(dir), "B4");
  assert.deepEqual(fs.map((f) => f.level), ["warn"]);
  assert.match(fs[0].message, /shop\.web\.app\.md/);
});

test("B5 compares the latest report's read check with the dispatch file's", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ read_check: "deadbeef" }));
  const fs = of(gate(dir), "B5");
  assert.equal(fs.length, 1);
  assert.equal(fs[0].level, "error");
  assert.match(fs[0].message, /deadbeef/);
  addLaunch(dir, "S02", "resume-answer");
  writeReport(dir, "S02", touchReport({ artifacts: [] }), 1);
  assert.deepEqual(of(gate(dir), "B5"), [], "the newest report decides");
});

test("B3 and B5 read the expected series, never a file no launch accounts for", () => {
  const dir = begun();
  queueLine(dir, item("Q-001", "must-address", "shop.api"));
  commitAll(dir, "queue");
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport({ read_check: "deadbeef" }));
  addLaunch(dir, "S02", "resume-finding");
  put(dir, reportPath("S02", 2), `${JSON.stringify(touchReport({ closes: [{ id: "Q-001", outcome: "addressed", note: "done" }] }))}\n`);
  const fs = gate(dir);
  assert.deepEqual(of(fs, "B5").map((f) => f.message.split(" ")[0]), ["hsdd/auto/steps/S02.r1.json"], show(fs));
  assert.match(of(fs, "B5")[0].message, /does not exist/);
  assert.deepEqual(of(fs, "B3").map((f) => f.message.slice(0, 5)), ["Q-001"], "the stray file's closes do not count");
  assert.ok(of(fs, "B1").some((f) => /S02\.r2\.json has no launch/.test(f.message)), show(fs));
});

test("B6 warns on a dispatch file above 32 KiB", () => {
  const dir = touched();
  const file = stepPaths("S02").dispatch;
  edit(dir, file, "fake prompt\n", `fake prompt\n${"x".repeat(33 * 1024)}\n`);
  const fs = of(gate(dir), "B6");
  assert.deepEqual(fs.map((f) => f.level), ["warn"]);
  assert.match(fs[0].message, /32768/);
});

// ---------- which checks run ----------

test("--check runs only the named checks on a step of any status", () => {
  const dir = touched();
  put(dir, "stray.txt", "x\n");
  writeReport(dir, "S02", touchReport({ status: "stopped", stop: STOP, read_check: "deadbeef" }));
  const fs = gate(dir, "S02", { status: "stopped", checks: ["B1", "B5"] });
  assert.deepEqual(fs.map((f) => f.id), ["B5"], show(fs));
  const r = run(dir, "gate.mjs", ["--step", "S02", "--check", "B1,B5", "--status", "stopped"]);
  const lines = r.stdout.trimEnd().split("\n");
  assert.ok(lines.slice(0, -1).every((l) => /^(ERROR|warn ) B[15] /.test(l)), r.stdout);
  assert.ok(lines.some((l) => /^ERROR B5 /.test(l)), r.stdout);
  assert.equal(r.code, 1);
  const plain = run(dir, "gate.mjs", ["--step", "S02", "--check", "B1"]);
  assert.equal(plain.code, 0, plain.stdout);
});

test("a stopped orchestrator step runs A1 to A3 only", () => {
  const config = baseConfig({ prose_rules: { banned_chars: ["\u2014"], level: "error" } });
  const dir = begun({ config });
  open(dir, "plan", SEG);
  put(dir, P.plan, "# Run plan: shop \u2014 draft\n");
  put(dir, "stray.txt", "x\n");
  gitIn(dir, "add", "stray.txt");
  oq9(dir);
  const stopped = gate(dir, "S02", { status: "stopped" });
  assert.ok(stopped.every((f) => ["A1", "A2", "A3"].includes(f.id)), show(stopped));
  assert.deepEqual(of(stopped, "A1").map((f) => f.file), [API, "stray.txt"]);
  const completed = gate(dir, "S02", { status: "completed" });
  assert.ok(of(completed, "D1").length > 0, show(completed));
  assert.deepEqual(of(completed, "C6").map((f) => [f.level, f.file]), [["error", API]], "C runs on a completed step, so the fixture would show it");
  assert.ok(!completed.some((f) => /^[B]/.test(f.id) || f.id === "A4"), "an orchestrator step has no A4 and no B checks");
  assert.ok(of(gate(dir, "S02", { checks: ["A4"] }), "A4").length > 0, "the staged path would fail A4");
});

test("a stopped subagent step runs A1 to A4, B1 and B5; --no-report drops B1 and B5", () => {
  const config = baseConfig({ prose_rules: { banned_chars: ["\u2014"], level: "error" } });
  const dir = begun({ config });
  queueLine(dir, item("Q-001", "must-address", "shop.api"));
  commitAll(dir, "queue");
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, TOUCH[0], "keeps totals in integer cents \u2014 always.");
  writeReport(dir, "S02", touchReport({ status: "stopped", stop: STOP, read_check: "deadbeef", reads_outside: [{ path: WEB, why: "x" }] }));
  const fs = gate(dir, "S02", { status: "stopped" });
  assert.deepEqual([...new Set(fs.map((f) => f.id))], ["B5"], show(fs));
  rmSync(join(dir, reportPath("S02", 0)));
  const none = gate(dir, "S02", { status: "stopped", noReport: true });
  assert.deepEqual(none, [], show(none));
});

// ---------- C scope ----------

test("a defect in a file the step did not change is a warning", () => {
  const dir = begun({ prepare: oq9 });
  open(dir, "spec-touch", "shop.web.app");
  edit(dir, WEB, ...WEB_TOUCH);
  writeReport(dir, "S02", reportOf("S02", "hsdd-spec", "shop.web.app", { artifacts: [WEB] }));
  const fs = of(gate(dir), "C6");
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["warn", API]], show(fs));
  assert.match(fs[0].message, /not changed by this step/);

  const changed = touched({ prepare: oq9 });
  assert.deepEqual(of(gate(changed), "C6").map((f) => [f.level, f.file]), [["error", API]]);
});

test("a registry finding is in scope through a related file the step changed", () => {
  const dir = begun();
  open(dir, "contract-touch", "order-api");
  edit(dir, CONTRACT, "consumers: [shop.web.app.1, shop.web.app.2]", "consumers: [shop.web.app.1]");
  writeReport(dir, "S02", reportOf("S02", "hsdd-contract", "order-api", { artifacts: [CONTRACT] }));
  const fs = of(gate(dir), "C1");
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", INDEX]], show(fs));
});

test("an adr step's own target is never a will-create warning", () => {
  const dir = begun({ stage: "01-root" });
  open(dir, "adr", "ADR-001");
  edit(dir, API, "- **Purpose:**", "- **Governed by:** [ADR-001, ADR-002]\n- **Purpose:**");
  writeReport(dir, "S02", reportOf("S02", "hsdd-adr", "ADR-001", { artifacts: [API] }));
  const c3 = of(gate(dir), "C3").filter((f) => f.file === API && /is cited/.test(f.message));
  assert.deepEqual(c3.map((f) => [f.level, f.message.slice(0, 7)]), [["error", "ADR-001"], ["warn", "ADR-002"]], show(c3));
});

test("pre-existing defect is a warning in the final gate", () => {
  const before = finished({ prepare: oq9 });
  const fs = final(before);
  assert.deepEqual(errors(fs), [], show(fs));
  assert.deepEqual(of(fs, "C6").map((f) => [f.level, f.file]), [["warn", API]]);
  assert.match(of(fs, "C6")[0].message, /not changed in this segment/);

  const during = begun();
  fakeStep(during, { step: "S02", segment: SEG, kind: "spec-touch", target: "shop.api", files: { [API]: read(during, API).replace(...OQ9) } });
  fakeStep(during, { step: "S03", segment: SEG, kind: "align", target: "all" });
  open(during, "report", SEG, "S04");
  put(during, REPORT, FILLED);
  const fd = final(during);
  assert.deepEqual(of(fd, "C6").map((f) => [f.level, f.file]), [["error", API]], show(fd));
});

// Final review A1: a stopped step's gate skips the C checks (10.6), so the defect it wrote is checked
// only by the final gate of the segment that continues it, whose scope starts at the chain's first setup.
const SEG_B = "2026-10-23-plan";
const answered = ({ previous = "stopped" } = {}) => {
  const dir = begun();
  fakeStep(dir, { step: "S02", segment: SEG, kind: "spec-touch", target: "shop.api", status: "stopped", files: { [API]: read(dir, API).replace(...OQ9) } });
  if (previous === "finished") {
    fakeStep(dir, { step: "S03", segment: SEG, kind: "spec-touch", target: "shop.api", continues: "S02" });
    fakeStep(dir, { step: "S04", segment: SEG, kind: "report", target: SEG });
  }
  const first = previous === "finished" ? 5 : 3;
  const s = (n) => `S${String(first + n).padStart(2, "0")}`;
  addSegment(dir, { ...segment(), id: SEG_B, instruction: "Answer: keep OQ9 open.", first_step: s(0) });
  fakeStep(dir, { step: s(0), segment: SEG_B, kind: "setup", target: SEG_B });
  fakeStep(dir, { step: s(1), segment: SEG_B, kind: "plan", target: SEG_B });
  if (previous === "stopped") fakeStep(dir, { step: s(2), segment: SEG_B, kind: "spec-touch", target: "shop.api", continues: "S02" });
  fakeStep(dir, { step: s(3), segment: SEG_B, kind: "align", target: "all" });
  openStep(dir, { step: s(4), segment: SEG_B, kind: "report", target: SEG_B });
  put(dir, `hsdd/auto/report/${SEG_B}.md`, FILLED);
  return dir;
};

test("a defect a stopped step wrote in the answered segment is unmet in the continuation's segment", () => {
  const dir = answered();
  const ctx = loadContext(dir);
  const done = unmetDone(ctx, { final: true }).filter((l) => l.startsWith("C6 "));
  assert.ok(done.some((l) => l.includes("OQ9") && l.includes(API)), JSON.stringify(done));
  const fs = final(dir);
  assert.deepEqual(of(fs, "C6").map((f) => [f.level, f.file]), [["error", API]], show(fs));
  assert.ok(of(fs, "F1").some((f) => f.level === "error" && /OQ9/.test(f.message)), show(of(fs, "F1")));
  const cli = run(dir, "gate.mjs", ["--final"]);
  assert.equal(cli.code, 1, cli.stdout);
  assert.match(cli.stdout, /^ERROR C6 .*OQ9/m);
});

test("a finished segment's changes stay out of the next segment's final scope", () => {
  const dir = answered({ previous: "finished" });
  const ctx = loadContext(dir);
  assert.deepEqual(unmetDone(ctx, { final: true }).filter((l) => l.startsWith("C6 ")), []);
  const fs = final(dir);
  assert.deepEqual(of(fs, "C6").map((f) => [f.level, f.file]), [["warn", API]], show(fs));
});

// ---------- intake segments ----------

const ISEG = "2026-10-22-intake-spec-v2";
const REQUEST = "ref/spec-v2.md";
const RECORD = "hsdd/management/2026-10-22-intake-order-v2.md";
const ORDER = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "auto", "intake", "2026-10-22-intake-order-v2.md"), "utf8");

// Stage 06 with the request file and the scripts, one intake segment opened, its setup and plan committed.
const intakeBegun = () => {
  const dir = makeRepo({ stage: "06-planned", files: { [REQUEST]: "# Spec v2\n" } });
  installScripts(dir);
  commitAll(dir, "install the scripts");
  addSegment(dir, {
    id: ISEG, mode: "intake", opened_at: nowStamp(), instruction: "Take in ref/spec-v2.md.", stop_policy: "stop", first_step: "S00",
    request: REQUEST, authority: "accepted-rfc",
  });
  fakeStep(dir, { step: "S00", segment: ISEG, kind: "setup", target: ISEG });
  fakeStep(dir, { step: "S01", segment: ISEG, kind: "plan", target: ISEG });
  return dir;
};
const setHandoff = (dir, step, handoff) => {
  const d = readDispatch(dir, step);
  writeDispatch(dir, step, { ...d.front, handoff }, d.body);
};

test("an intake step's record needs its handoff block", () => {
  const dir = intakeBegun();
  openStep(dir, { step: "S02", segment: ISEG, kind: "intake", target: REQUEST });
  put(dir, RECORD, ORDER.replace(/```hsdd-handoffs[\s\S]*?```\n/, ""));
  writeReport(dir, "S02", reportOf("S02", "hsdd-intake", REQUEST, { artifacts: [RECORD] }));
  const fs = of(gate(dir), "C8");
  assert.ok(fs.some((f) => f.level === "error" && f.file === RECORD && /hsdd-handoffs block/.test(f.message)), show(fs));
  put(dir, RECORD, ORDER);
  assert.deepEqual(errors(of(gate(dir), "C8")), []);
});

test("a handoff step closes the items on its handoff, and a step on a handoff's target the items on that handoff", () => {
  const dir = intakeBegun();
  fakeStep(dir, { step: "S02", segment: ISEG, kind: "intake", target: REQUEST, files: { [RECORD]: ORDER } });
  queueLine(dir, item("Q-001", "must-address", "H1"));
  queueLine(dir, item("Q-002", "must-address", "H2a"));
  queueLine(dir, item("Q-003", "must-address", "order-api"));
  commitAll(dir, "queue");
  openStep(dir, { step: "S03", segment: ISEG, kind: "contract-touch", target: "order-api" });
  setHandoff(dir, "S03", "H1");
  writeReport(dir, "S03", reportOf("S03", "hsdd-contract", "order-api"));
  assert.deepEqual(of(gate(dir, "S03"), "B3").map((f) => f.message.slice(0, 5)), ["Q-001", "Q-003"]);
  openStep(dir, { step: "S04", segment: ISEG, kind: "spec-touch", target: "shop.web.app" });
  writeReport(dir, "S04", reportOf("S04", "hsdd-spec", "shop.web.app"));
  assert.deepEqual(of(gate(dir, "S04"), "B3").map((f) => f.message.slice(0, 5)), ["Q-002"], "H2a's own target is shop.web.app (B-10)");
});

// ---------- D1 ----------

test("D1 at level error fails, at warn warns, and exempts step reports", () => {
  for (const level of ["error", "warn"]) {
    const config = baseConfig({ prose_rules: { banned_chars: ["\u2014"], banned_phrases: ["synergy"], level } });
    const dir = begun({ config });
    open(dir, "spec-touch", "shop.api");
    edit(dir, API, TOUCH[0], "keeps totals in integer cents \u2014 for Synergy.");
    edit(dir, "hsdd/conventions.md", "# Project Conventions", "# Project Conventions \u2014 synergy");
    writeReport(dir, "S02", touchReport({ notes: ["quoted \u2014 synergy"] }));
    writeSidecar(dir, "S02", [decision({ why: "synergy \u2014 quoted" })]);
    const fs = of(gate(dir), "D1");
    assert.deepEqual(fs.map((f) => [f.level, f.file]), [[level, API], [level, API]], show(fs));
    assert.match(fs[0].message, /U\+2014/);
    assert.ok(!fs[0].message.includes("\u2014"), "the message names the character by code point");
    assert.match(fs[1].message, /synergy/i);
  }
  const clean = begun({ config: baseConfig({ prose_rules: { banned_chars: ["\u2014"], level: "error" } }) });
  open(clean, "spec-touch", "shop.api");
  edit(clean, API, ...TOUCH);
  writeReport(clean, "S02", touchReport());
  assert.deepEqual(of(gate(clean), "D1"), []);
});

// The owner's configuration files hold the owner's rules and words verbatim: run.yaml lists the banned
// phrases and the instruction, an orchestrator file such as CLAUDE.md states them. plan.md is the
// orchestrator's prose and stays checked.
test("D1 exempts run.yaml, the owner-file snapshot, adapter.json and orchestrator_files, not plan.md", () => {
  const config = baseConfig({ orchestrator_files: ["CLAUDE.md"], prose_rules: { banned_chars: ["\u2014"], banned_phrases: ["synergy"], level: "error" } });
  const setup = begun({ config });
  open(setup, "setup", SEG);
  put(setup, P.runYaml, `${read(setup, P.runYaml)}# the owner: no synergy \u2014 ever\n`);
  put(setup, P.ownerFiles, `${JSON.stringify({ "notes/synergy.md": null })}\n`);
  put(setup, P.adapter, `${JSON.stringify({ note: "synergy \u2014 deny rules" })}\n`);
  put(setup, "CLAUDE.md", "Never write synergy or \u2014.\n");
  assert.deepEqual(of(gate(setup, "S02", { checks: ["D1"] }), "D1"), []);

  const plan = begun({ config });
  open(plan, "plan", SEG);
  put(plan, P.runYaml, `${read(plan, P.runYaml)}# synergy\n`);
  put(plan, P.plan, "# Run plan: shop\n\n## Segments\n\n**2026-10-22-plan.** Plan for synergy.\n");
  const fs = of(gate(plan, "S02", { checks: ["D1"] }), "D1");
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", P.plan]], show(fs));
});

test("D1 checks only a segment report's prose slots", () => {
  const config = baseConfig({ prose_rules: { banned_chars: ["\u2014"], level: "error" } });
  const dir = finished({ config });
  put(dir, REPORT, `# Report \u2014 generated\n\n| a | \u2014 |\n\n${FILLED}`);
  assert.deepEqual(of(gate(dir, "S03"), "D1"), []);
  put(dir, REPORT, FILLED.replace("The tree is planned.", "The tree is planned \u2014 fully."));
  const fs = of(gate(dir, "S03"), "D1");
  assert.deepEqual(fs.map((f) => [f.level, f.file]), [["error", REPORT]], show(fs));
  assert.match(fs[0].message, /slot outcome/);
});

// ---------- the final gate ----------

const FILLED = [
  "# Segment report", "", "## Outcome", "", "<!-- slot:outcome -->", "The tree is planned.", "<!-- /slot -->", "",
  "## Assumptions about the owner's intent", "", "<!-- slot:assumptions -->", "None beyond the owner facts.", "<!-- /slot -->", "",
].join("\n");

// A plan segment whose align on all is committed, with its report step (S03) open and its report written.
function finished({ config, prepare } = {}) {
  const dir = begun({ config, prepare });
  fakeStep(dir, { step: "S02", segment: SEG, kind: "align", target: "all" });
  open(dir, "report", SEG, "S03");
  put(dir, REPORT, FILLED);
  return dir;
}

test("the final gate passes on a finished plan segment", () => {
  const fs = final(finished());
  assert.deepEqual(fs, [], show(fs));
});

test("F1 fails an unmet condition of the done definition", () => {
  const dir = begun();
  open(dir, "report", SEG, "S02");
  put(dir, REPORT, FILLED);
  const fs = of(final(dir), "F1");
  assert.ok(fs.length > 0 && fs.every((f) => f.level === "error"), show(fs));
  assert.ok(fs.some((f) => /^stage 7 Consistency: .*align condition/.test(f.message)), show(fs));
});

test("F2 lists references to a contract version that is no longer current", () => {
  const bump = (d) => edit(d, CONTRACT, "version: v1", "version: v2");
  const fs = of(final(finished({ prepare: bump })), "F2");
  assert.ok(fs.length > 0 && fs.every((f) => f.level === "warn"), show(fs));
  const api = fs.find((f) => f.file === API);
  assert.ok(api, show(fs));
  assert.match(api.message, /order-api@v1 2 times/);
  assert.match(api.message, /current is v2/);
  assert.ok(fs.some((f) => f.file === "hsdd/contract/fixture/order-api/create-order.json"), "fixtures are scanned");
  assert.ok(!fs.some((f) => f.file === CONTRACT || f.file === INDEX), "not the contract's own file or the registry");
  assert.deepEqual(of(final(finished()), "F2"), []);
});

test("F3 fails when the ledger does not validate", () => {
  const dir = finished();
  put(dir, P.ledger, `${JSON.stringify({ id: "DEC-001" })}\n`);
  const fs = of(final(dir), "F3");
  assert.ok(fs.length > 0 && fs.some((f) => f.level === "error"), show(fs));
  assert.match(errors(fs)[0].message, /DEC-001/);
});

test("F4 fails on an open must-address item, not on a consider item", () => {
  const dir = finished();
  queueLine(dir, item("Q-001", "consider", "shop.api"));
  assert.deepEqual(of(final(dir), "F4"), []);
  queueLine(dir, item("Q-002", "must-address", "shop.api", { from: "S12" }));
  const fs = of(final(dir), "F4");
  assert.equal(fs.length, 1, show(fs));
  assert.equal(fs[0].level, "error");
  assert.match(fs[0].message, /Q-002/);
});

test("F4 fails on an open insert-step", () => {
  const dir = finished();
  queueLine(dir, item("Q-001", "insert-step", "run", { step_kind: "spec-touch", step_target: "shop.api" }));
  const fs = of(final(dir), "F4");
  assert.equal(fs.length, 1, show(fs));
  assert.match(fs[0].message, /Q-001/);
  assert.match(fs[0].message, /insert-step/);
  queueLine(dir, { id: "Q-001", at: nowStamp(), status: "rejected", decision: "DEC-001" });
  assert.deepEqual(of(final(dir), "F4"), [], "a decided insert-step is not open");
});

test("F5 fails when the contract registry misses a slug a spec names", () => {
  const dir = finished({ prepare: (d) => edit(d, INDEX, "| `order-api` | v1 | api | stable | `shop.api` | 2 |\n", "") });
  const fs = of(final(dir), "F5");
  assert.equal(fs.length, 1, show(fs));
  assert.equal(fs[0].level, "error");
  assert.match(fs[0].message, /order-api/);
});

test("F6 fails a missing report and an unfilled prose slot", () => {
  const dir = finished();
  put(dir, REPORT, FILLED.replace("None beyond the owner facts.", "  "));
  const fs = of(final(dir), "F6");
  assert.equal(fs.length, 1, show(fs));
  assert.match(fs[0].message, /slot assumptions/);
  rmSync(join(dir, REPORT));
  const gone = of(final(dir), "F6");
  assert.equal(gone.length, 1);
  assert.match(gone[0].message, /does not exist/);
});

test("the report step runs the final gate", () => {
  const dir = finished();
  assert.deepEqual(gate(dir, "S03"), []);
  put(dir, REPORT, FILLED.replace("The tree is planned.", ""));
  const fs = gate(dir, "S03");
  assert.deepEqual(fs.map((f) => f.id), ["F6"], show(fs));
});

// ---------- output and CLI ----------

test("formatFindings prints one line per finding, then the summary", () => {
  const text = formatFindings([
    { id: "A1", level: "error", message: "src/x.js is outside the write set", file: "src/x.js" },
    { id: "C6", level: "warn", message: "OQ9 is cited and defined nowhere", file: API },
  ], 3);
  assert.equal(text, [
    "ERROR A1 src/x.js is outside the write set",
    `warn  C6 OQ9 is cited and defined nowhere (${API})`,
    "gate: 1 error(s), 1 warning(s), 3 changed file(s)",
  ].join("\n"));
});

test("the CLI tells a refusal before any check from an unexpected failure", () => {
  const broken = touched();
  put(broken, P.runYaml, `${read(broken, P.runYaml)}rework_limit: lots\n`);
  const config = run(broken, "gate.mjs", ["--step", "S02"]);
  assert.equal(config.code, 1);
  assert.match(config.stdout, /rework_limit/);
  assert.match(config.stdout, /\ngate: failed before any check could run\n$/);
  const odd = touched();
  put(odd, P.runLog, "{not json\n");
  const r = run(odd, "gate.mjs", ["--step", "S02"]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /^gate: failed unexpectedly: hsdd\/judgement\/run\.jsonl:1: not valid JSON/);
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /, "no stack trace");
});

test("the CLI exits 0 without an error, 1 with one, and 2 on a usage error", () => {
  const dir = touched();
  const ok = run(dir, "gate.mjs", ["--step", "S02"]);
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  assert.equal(ok.stdout, "gate: 0 error(s), 0 warning(s), 3 changed file(s)\n");
  put(dir, "stray.txt", "x\n");
  const bad = run(dir, "gate.mjs", ["--step", "S02"]);
  assert.equal(bad.code, 1);
  assert.match(bad.stdout, /^ERROR A1 stray\.txt /m);
  for (const args of [[], ["--step", "S02", "--final"], ["--step", "S02", "--check", "Z9"], ["--final", "--check", "F1"], ["--step", "bad"], ["--step", "S02", "--status", "done"], ["--step", "S02", "extra"]]) {
    const r = run(dir, "gate.mjs", args);
    assert.equal(r.code, 2, `${args.join(" ")}: ${r.stdout}${r.stderr}`);
  }
  const missing = run(dir, "gate.mjs", ["--step", "S77"]);
  assert.equal(missing.code, 1);
  assert.match(missing.stdout, /S77/);
  assert.doesNotMatch(missing.stdout + missing.stderr, /\n\s+at /);
  const fin = run(finished(), "gate.mjs", ["--final"]);
  assert.equal(fin.code, 0, fin.stdout);
  assert.match(fin.stdout, /^gate: 0 error\(s\), 0 warning\(s\), \d+ changed file\(s\)\n$/);
});
