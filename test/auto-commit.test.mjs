import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHASES, SKIP_PHASES, artifactSubject, commitStep, commitStepPhases, ensurePlan, replaceSection, skipHandoff, skipHandoffPhases, stepLogTable,
} from "../skills/hsdd-auto/scripts/commit.mjs";
import { decideItem, ingest } from "../skills/hsdd-auto/scripts/routed.mjs";
import { decide } from "../skills/hsdd-auto/scripts/decide.mjs";
import { P, reportPath, stepPaths } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { appendJsonl, readDispatch, readJsonl, writeDispatch } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, baseConfig, fakeStep, gitIn, installScripts, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEG = "2026-10-22-plan";
const API = "hsdd/spec/shop.api.md";
const CONTRACT = "hsdd/contract/order-api.md";
const REPORT = `hsdd/auto/report/${SEG}.md`;
const OWNER = "notes/owner.md";
const EXPERIMENT = "hsdd/auto/experiments/probe/README.md";
const TRAILER = "Co-Authored-By: Test Agent <agent@example.invalid>";
const TOUCH = ["keeps totals in integer cents.", "keeps totals in integer cents, never floats."];

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const edit = (dir, rel, from, to) => {
  const t = read(dir, rel);
  assert.ok(t.includes(from), `${rel} has no ${JSON.stringify(from)}`);
  put(dir, rel, t.replace(from, to));
};
const commitAll = (dir, msg = "owner edit") => { gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "--allow-empty", "-m", msg); };
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Points HEAD at a branch on the current commit without a checkout, so the working tree is untouched
// and no checkout hook of the machine running the tests installs commit hooks into the repository.
const onBranch = (dir, name) => {
  if (gitIn(dir, "branch", "--list", name) === "") gitIn(dir, "branch", name);
  gitIn(dir, "symbolic-ref", "HEAD", `refs/heads/${name}`);
};

const cfg = (over = {}) => baseConfig({ commit: { trailers: [TRAILER] }, ...over });
const segment = () => ({ id: SEG, mode: "plan", opened_at: nowStamp(), instruction: "Plan the shop.", stop_policy: "stop", first_step: "S00" });

// A repository at a fixture stage on the run branch, with the scripts installed (A3), one plan segment
// opened, and its setup (S00) and plan (S01) steps committed.
const begun = ({ stage = "06-planned", config = cfg(), files, prepare } = {}) => {
  const dir = makeRepo({ stage, config, files });
  onBranch(dir, "auto/shop");
  installScripts(dir);
  prepare?.(dir);
  commitAll(dir, "install the scripts");
  addSegment(dir, segment());
  fakeStep(dir, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  fakeStep(dir, { step: "S01", segment: SEG, kind: "plan", target: SEG });
  return dir;
};

const open = (dir, kind, target, step = "S02") => openStep(dir, { step, segment: SEG, kind, target });

const reportOf = (step, skill, target, over = {}) => ({
  step_ref: step, skill, target, status: "completed", stop: null, artifacts: [], experiments: [], self_check: [],
  routed: [], closes: [], reads_outside: [], notes: ["did the step"], read_check: "00000000", ...over,
});
const writeReport = (dir, step, report, n = 0) => put(dir, reportPath(step, n), `${JSON.stringify(report, null, 2)}\n`);
const touchReport = (over) => reportOf("S02", "hsdd-spec", "shop.api", { artifacts: [API], ...over });

const STOP = {
  question: "Which axis?", skill_rule: "Stop when the axis is unknown.", stop_class: "axis",
  options: [{ label: "a", consequence: "split by team" }, { label: "b", consequence: "split by deploy target" }], recommendation: "a", blocks: "the children",
};

// S02: an open spec-touch on shop.api that changed its spec and wrote a valid report.
const touched = (opts) => {
  const dir = begun(opts);
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport());
  return dir;
};

const decisionInput = (over = {}) => ({
  artifact: API, question: "Which wording?",
  options: [{ label: "a", consequence: "keeps it short" }, { label: "b", consequence: "spells it out" }], chosen: "a",
  why: "shorter", evidence: [], blast_radius: "node-local", confidence: "high", would_have_asked: false, stop_class: null,
  would_upstream: false, ...over,
});
const planInput = (over = {}) => decisionInput({ artifact: null, question: "Accept the inserted step?", ...over });

const setFront = (dir, step, over) => {
  const d = readDispatch(dir, step);
  writeDispatch(dir, step, { ...d.front, ...over }, d.body);
};
const addLaunch = (dir, step, reason) => {
  const d = readDispatch(dir, step);
  setFront(dir, step, { launches: [...d.front.launches, { at: nowStamp(), reason }] });
};

const headFull = (dir) => gitIn(dir, "rev-parse", "HEAD");
const body = (dir, rev = "HEAD") => gitIn(dir, "log", "-1", "--format=%B", rev).trimEnd();
const dispatchHead = (dir, step = "S02") => gitIn(dir, "rev-parse", readDispatch(dir, step).front.head);
const subjects = (dir, range) => { const out = gitIn(dir, "log", "--format=%s", range); return out === "" ? [] : out.split("\n").reverse(); };
const filesOf = (dir, rev) => gitIn(dir, "show", "--name-only", "--format=", rev).split("\n").filter(Boolean).sort();
const status = (dir) => gitIn(dir, "status", "--porcelain=v1", "-uall");
const staged = (dir) => gitIn(dir, "diff", "--cached", "--name-only");
const runLine = (dir, step) => readJsonl(dir, P.runLog).find((l) => l.step_ref === step);
const commitOf = (dir, over = {}) => commitStep(dir, { step: "S02", status: "completed", ...over });
const queueItem = (id, kind, target, over = {}) => ({ id, at: nowStamp(), status: "open", from: "S01", target, kind, text: `item ${id}`, ...over });

// Exit codes and output shape of a refused CLI call.
const refused = (r, pattern) => {
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.stdout, pattern);
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /, "no stack trace");
  assert.match(r.stdout.trimEnd().split("\n").at(-1), /^commit: /);
};

// ---------- the artifact commit ----------

test("stages only the write set and never an owner file", () => {
  // The owner's drafts were dirty when the segment's setup took the snapshot, so A2 passes and A1 admits
  // them; one lies inside the step's write set, so only the owner rule keeps it out of the commit.
  const CONVENTIONS = "hsdd/conventions.md";
  const config = cfg({ owner_files: [OWNER, CONVENTIONS] });
  const dir = begun({ config, files: { [OWNER]: "mine\n" } });
  const draft = `${read(dir, CONVENTIONS)}\nAn owner's draft line.\n`;
  put(dir, P.ownerFiles, JSON.stringify({ [OWNER]: sha256("owner draft\n"), [CONVENTIONS]: sha256(draft) }));
  commitAll(dir, "the owner-file snapshot");
  put(dir, OWNER, "owner draft\n");
  put(dir, CONVENTIONS, draft);
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  put(dir, EXPERIMENT, "what the probe found\n");
  writeReport(dir, "S02", touchReport({ experiments: [{ path: EXPERIMENT, question: "q", finding: "f" }] }));
  decide(dir, { step: "S02", input: decisionInput() });
  const head = dispatchHead(dir);

  const r = commitOf(dir);
  assert.deepEqual(subjects(dir, `${head}..HEAD`), ["hsdd: S02 spec-touch shop.api: did the step", "judgement: S02"]);
  assert.equal(r.artifact, gitIn(dir, "rev-parse", "HEAD^"));
  assert.equal(r.judgement, headFull(dir));
  assert.deepEqual(filesOf(dir, r.artifact), [EXPERIMENT, API].sort());
  assert.deepEqual(filesOf(dir, r.judgement), [P.ledger, P.plan, stepPaths("S02").dispatch, stepPaths("S02").report, stepPaths("S02").decisions, P.runLog].sort());
  assert.equal(status(dir), ` M ${CONVENTIONS}\n M ${OWNER}`, "the owner files stay in place, uncommitted");
  assert.equal(staged(dir), "");
  const decisions = readJsonl(dir, P.ledger);
  assert.deepEqual(decisions.map((d) => [d.id, d.step_ref, d.commit]), [["DEC-001", "S02", r.artifact]]);
  assert.deepEqual(runLine(dir, "S02"), {
    ...runLine(dir, "S02"), step_ref: "S02", segment: SEG, kind: "spec-touch", skill: "hsdd-spec", target: "shop.api", commit: r.artifact, dispatches: 1, status: "completed",
  });
  assert.equal(runLine(dir, "S02").note, undefined, "nothing a reader must know");
});

test("a stopped step that changed an owner file is committed without it, and its note names it", () => {
  const config = cfg({ owner_files: [OWNER] });
  const dir = begun({ config, files: { [OWNER]: "mine\n", [P.ownerFiles]: JSON.stringify({ [OWNER]: sha256("mine\n") }) } });
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  put(dir, OWNER, "changed by the step\n");
  writeReport(dir, "S02", touchReport({ status: "stopped", stop: STOP }));
  assert.throws(() => commitOf(dir), (e) => /A2/.test(e.message) || e.findings?.some((f) => f.id === "A2"), "completed: A2 is an error");
  assert.equal(staged(dir), "");
  const r = commitOf(dir, { status: "stopped" });
  assert.deepEqual(filesOf(dir, r.artifact), [API]);
  assert.ok(!filesOf(dir, r.judgement).includes(OWNER));
  assert.equal(read(dir, OWNER), "changed by the step\n", "never restored by the run");
  assert.match(runLine(dir, "S02").note, /notes\/owner\.md/);
  assert.match(gitIn(dir, "log", "-1", "--format=%s", r.artifact), / \(stopped\)$/);
});

test("stages a deletion inside the write set, and a removed STOP.md in the judgement commit", () => {
  const SCRATCH = "hsdd/spec/shop.scratch.md";
  const dir = begun({ prepare: (d) => { put(d, SCRATCH, "# shop.scratch: Scratch\n\n- **Kind:** leaf\n"); put(d, P.stop, "# Run stopped at S09\n"); } });
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  rmSync(join(dir, SCRATCH));
  rmSync(join(dir, P.stop));
  writeReport(dir, "S02", touchReport());
  const r = commitOf(dir);
  const nameStatus = (rev) => gitIn(dir, "show", "--name-status", "--format=", rev).split("\n").filter(Boolean).sort();
  assert.deepEqual(nameStatus(r.artifact), [`D\t${SCRATCH}`, `M\t${API}`]);
  assert.ok(nameStatus(r.judgement).includes(`D\t${P.stop}`), nameStatus(r.judgement).join(", "));
  assert.equal(status(dir), "");
});

test("refuses an out-of-set change and commits nothing", () => {
  const dir = touched();
  put(dir, "src/app.js", "x\n");
  const before = headFull(dir);
  const r = run(dir, "commit.mjs", ["--step", "S02", "--status", "completed"]);
  refused(r, /^ERROR A1 src\/app\.js /m);
  assert.equal(headFull(dir), before);
  assert.equal(staged(dir), "");
  assert.equal(runLine(dir, "S02"), undefined);
  assert.equal(existsSync(join(dir, P.plan)), false, "nothing written");
  assert.throws(() => commitOf(dir), (e) => e.findings?.some((f) => f.id === "A1" && f.file === "src/app.js"));
});

test("makes an empty artifact commit when nothing changed", () => {
  const dir = begun();
  open(dir, "plan", SEG);
  const head = dispatchHead(dir);
  const r = commitOf(dir);
  assert.equal(gitIn(dir, "rev-parse", `${r.artifact}^`), head);
  assert.deepEqual(filesOf(dir, r.artifact), [], "an empty commit");
  assert.equal(gitIn(dir, "log", "-1", "--format=%s", r.artifact), `auto: S02 plan: ${SEG}`, "an orchestrator step's summary is the segment id");
  assert.equal(runLine(dir, "S02").note, "no artifact changed; empty artifact commit");
  assert.equal(runLine(dir, "S02").dispatches, 0);
  assert.deepEqual(filesOf(dir, r.judgement), [P.plan, stepPaths("S02").dispatch, P.runLog].sort(), "S-6: the plan skeleton lands with the first judgement commit");
});

test("subjects, summaries and trailers", () => {
  assert.equal(artifactSubject({ artifact: "hsdd", orchestrator: "auto" }, { step_ref: "S07", kind: "adr", target: "ADR-003", skill: "hsdd-adr" }, "decided", "stopped"),
    "hsdd: S07 adr ADR-003: decided (stopped)");
  assert.equal(artifactSubject({ artifact: "hsdd", orchestrator: "run" }, { step_ref: "S08", kind: "report", target: SEG, skill: "none" }, SEG, "completed"),
    `run: S08 report: ${SEG}`);

  const dir = touched();
  const long = `${"x".repeat(40)} ${"y".repeat(60)}`;
  writeReport(dir, "S02", touchReport({ notes: [long, "second"] }));
  const r = commitOf(dir);
  assert.equal(body(dir, r.artifact), `hsdd: S02 spec-touch shop.api: ${long.slice(0, 72)}\n\n${TRAILER}`);
  assert.equal(body(dir, r.judgement), `judgement: S02\n\n${TRAILER}`);

  const given = touched();
  const g = commitOf(given, { summary: "  tightened\nthe totals  " });
  assert.equal(gitIn(given, "log", "-1", "--format=%s", g.artifact), "hsdd: S02 spec-touch shop.api: tightened the totals");

  const silent = touched();
  writeReport(silent, "S02", touchReport({ notes: [] }));
  const s = commitOf(silent);
  assert.equal(gitIn(silent, "log", "-1", "--format=%s", s.artifact), "hsdd: S02 spec-touch shop.api: no summary");
});

// ---------- resume ----------

test("resumes from an existing artifact commit without a second one", () => {
  const dir = touched();
  const head = dispatchHead(dir);
  const first = commitStepPhases(dir, { step: "S02", status: "completed" }, { stopAfter: "artifact" });
  assert.equal(first.stoppedAfter, "artifact");
  assert.deepEqual(subjects(dir, `${head}..HEAD`), ["hsdd: S02 spec-touch shop.api: did the step"]);
  assert.equal(runLine(dir, "S02"), undefined);

  assert.throws(() => commitOf(dir, { status: "stopped" }), /completed/, "the artifact commit's status decides");
  const r = commitOf(dir);
  assert.ok(r.lines.some((l) => /resum/i.test(l)), r.lines.join("\n"));
  assert.deepEqual(subjects(dir, `${head}..HEAD`), ["hsdd: S02 spec-touch shop.api: did the step", "judgement: S02"]);
  assert.equal(r.artifact, first.artifact);
  assert.equal(runLine(dir, "S02").commit, first.artifact);
});

// Q-001 is open on shop.api; S02 closes it, routes a consider item and records one decision.
const busy = () => {
  const dir = begun();
  appendJsonl(dir, P.queue, queueItem("Q-001", "must-address", "shop.api"));
  commitAll(dir, "queue");
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport({
    closes: [{ id: "Q-001", outcome: "addressed", note: "done" }],
    routed: [{ target: "shop.web.app", kind: "consider", text: "the storefront shows the cents" }],
  }));
  decide(dir, { step: "S02", input: decisionInput() });
  return dir;
};

test("commit rerun after a crash at each point", () => {
  const opts = { step: "S02", status: "completed" };
  for (const phase of PHASES) {
    const dir = busy();
    const head = dispatchHead(dir);
    const crashed = commitStepPhases(dir, opts, { stopAfter: phase });
    assert.equal(crashed.stoppedAfter, phase);
    if (phase === "stage") {
      assert.equal(headFull(dir), head, "after staging, HEAD is still the dispatch head");
      assert.notEqual(staged(dir), "", "and the index is dirty");
    }
    const r = commitStep(dir, opts);
    assert.deepEqual(subjects(dir, `${head}..HEAD`), ["hsdd: S02 spec-touch shop.api: did the step", "judgement: S02"], `crash after ${phase}`);
    assert.deepEqual(readJsonl(dir, P.ledger).map((d) => [d.id, d.commit]), [["DEC-001", r.artifact]], `ledger after ${phase}`);
    assert.deepEqual(readJsonl(dir, P.queue).map((l) => `${l.id} ${l.status}`), ["Q-001 open", "Q-001 addressed", "Q-002 open"], `queue after ${phase}`);
    assert.deepEqual(readJsonl(dir, P.runLog).map((l) => l.step_ref), ["S00", "S01", "S02"], `run log after ${phase}`);
    assert.equal(runLine(dir, "S02").commit, r.artifact);
    assert.equal(status(dir), "", `a clean tree after ${phase}`);
    assert.throws(() => commitStep(dir, opts), /already committed|judgement commit/, "a third run refuses");
  }
});

test("unstages a dirty index at the dispatch head", () => {
  const dir = touched();
  gitIn(dir, "add", API, stepPaths("S02").report);
  const r = commitOf(dir);
  assert.ok(r.lines.some((l) => /unstag/i.test(l)), r.lines.join("\n"));
  assert.deepEqual(filesOf(dir, r.artifact), [API]);
  assert.ok(filesOf(dir, r.judgement).includes(stepPaths("S02").report));
});

test("refuses a step whose artifact commit is not HEAD, and a committed step", () => {
  const dir = touched();
  commitStepPhases(dir, { step: "S02", status: "completed" }, { stopAfter: "artifact" });
  gitIn(dir, "commit", "-q", "--allow-empty", "-m", "someone else");
  assert.throws(() => commitOf(dir), /artifact commit/);
  const done = touched();
  commitOf(done);
  const r = run(done, "commit.mjs", ["--step", "S02", "--status", "completed"]);
  refused(r, /S02/);
});

test("never amends", () => {
  const dir = touched();
  const before = headFull(dir);
  const head = dispatchHead(dir);
  assert.equal(head, before);
  const r = commitOf(dir);
  assert.equal(gitIn(dir, "rev-parse", `${r.artifact}^`), head, "the artifact commit's parent is the dispatch head");
  assert.equal(gitIn(dir, "rev-parse", `${r.judgement}^`), r.artifact, "the judgement commit's parent is the artifact commit");
  assert.equal(gitIn(dir, "merge-base", "--is-ancestor", before, "HEAD"), "", "history only grows");
  assert.equal(gitIn(dir, "rev-list", "--count", `${before}..HEAD`), "2");
});

// ---------- records ----------

const inserted = (status) => {
  const dir = begun();
  appendJsonl(dir, P.queue, queueItem("Q-001", "insert-step", "run", { step_kind: "spec-touch", step_target: "shop.api" }));
  appendJsonl(dir, P.queue, { id: "Q-001", at: nowStamp(), status: "accepted", decision: "DEC-001" });
  commitAll(dir, "queue");
  open(dir, "spec-touch", "shop.api");
  setFront(dir, "S02", { queue_item: "Q-001" });
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport(status === "stopped" ? { status: "stopped", stop: STOP } : {}));
  return dir;
};

test("marks an insert-step item addressed only on completed", () => {
  const done = inserted("completed");
  commitOf(done);
  const lines = readJsonl(done, P.queue).filter((l) => l.id === "Q-001");
  assert.deepEqual(lines.map((l) => l.status), ["open", "accepted", "addressed"]);
  assert.equal(lines.at(-1).by, "S02");
  assert.equal(lines.at(-1).note, "step S02 committed");

  const stopped = inserted("stopped");
  commitOf(stopped, { status: "stopped" });
  assert.deepEqual(readJsonl(stopped, P.queue).filter((l) => l.id === "Q-001").map((l) => l.status), ["open", "accepted"], "a stopped step leaves it accepted");
});

test("refuses a completed inserted step whose item is not accepted", () => {
  const dir = inserted("completed");
  setFront(dir, "S02", { queue_item: "Q-009" });
  assert.throws(() => commitOf(dir), /Q-009/);
  assert.equal(staged(dir), "");
  assert.equal(runLine(dir, "S02"), undefined);
});

const INSERT = { target: "run", kind: "insert-step", text: "re-plan the storefront", step_kind: "phase-plan-append", step_target: "shop.web.app" };

test("refuses a step with an open insert-step", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ routed: [INSERT] }));
  const head = headFull(dir);
  assert.throws(() => commitOf(dir), /insert-step/, "routed and not yet ingested");
  ingest(dir, "S02");
  assert.throws(() => commitOf(dir), /Q-001/, "ingested and still open");
  assert.equal(headFull(dir), head);
  const r = run(dir, "commit.mjs", ["--step", "S02", "--status", "completed"]);
  refused(r, /Q-001/);
  const { id } = decide(dir, { step: "S02", by: "orchestrator", input: planInput() });
  decideItem(dir, "Q-001", { outcome: "accepted", decision: id });
  commitOf(dir);
  assert.deepEqual(readJsonl(dir, P.queue).map((l) => `${l.id} ${l.status}`), ["Q-001 open", "Q-001 accepted"]);
  assert.deepEqual(readJsonl(dir, P.ledger).map((d) => [d.id, d.by]), [["DEC-001", "orchestrator"]]);
});

test("ingest dedupes open lines by text", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ routed: [{ target: "shop.web.app", kind: "consider", text: "the storefront shows the cents" }] }));
  ingest(dir, "S02");
  const r = commitOf(dir);
  const queue = readJsonl(dir, P.queue);
  assert.deepEqual(queue.map((l) => `${l.id} ${l.status} ${l.text}`), ["Q-001 open the storefront shows the cents"]);
  assert.ok(filesOf(dir, r.judgement).includes(P.queue));
});

test("an invalid orchestrator sidecar is refused before the artifact commit", () => {
  const dir = begun();
  open(dir, "plan", SEG);
  put(dir, stepPaths("S02").decisions, `${JSON.stringify({ id: "DEC-001", at: nowStamp(), by: "orchestrator", step: "plan", ...planInput({ chosen: "c" }) })}\n`);
  const head = headFull(dir);
  assert.throws(() => commitOf(dir), (e) => e.findings?.some((f) => f.id === "B1" && /chosen/.test(f.message)));
  assert.equal(headFull(dir), head);
});

// ---------- --discard and --no-report ----------

test("--discard restores the named paths and notes them", () => {
  const dir = touched();
  const contract = read(dir, CONTRACT);
  edit(dir, CONTRACT, "G3: every amount", "G3: each amount");
  put(dir, "src/app.js", "x\n");
  put(dir, "src/deep/more.js", "y\n");
  assert.throws(() => commitOf(dir, { status: "stopped" }), (e) => e.findings?.some((f) => f.id === "A1"));
  assert.throws(() => commitOf(dir, { status: "stopped", discard: [API] }), /write set|admitted/, "a write-set path is never discarded");
  assert.equal(read(dir, CONTRACT), contract.replace("G3: every amount", "G3: each amount"), "a refused discard changes nothing");

  const r = commitOf(dir, { status: "stopped", discard: [CONTRACT, "src/"] });
  assert.equal(read(dir, CONTRACT), contract, "restored to HEAD");
  assert.equal(existsSync(join(dir, "src/app.js")), false, "untracked: removed");
  assert.equal(existsSync(join(dir, "src/deep/more.js")), false);
  assert.deepEqual(filesOf(dir, r.artifact), [API]);
  assert.equal(runLine(dir, "S02").note, `discarded: ${CONTRACT}, src`);
  assert.equal(status(dir), "");
});

test("--discard never restores an owner file", () => {
  const config = cfg({ owner_files: [OWNER] });
  const dir = begun({ config, files: { [OWNER]: "mine\n", [P.ownerFiles]: JSON.stringify({ [OWNER]: sha256("mine\n") }) } });
  open(dir, "spec-touch", "shop.api");
  put(dir, OWNER, "changed\n");
  writeReport(dir, "S02", touchReport({ artifacts: [] }));
  assert.throws(() => commitOf(dir, { status: "stopped", discard: [OWNER] }), /owner/);
  assert.equal(read(dir, OWNER), "changed\n");
});

test("--no-report skips B1 and B5 and renames the series", () => {
  const dir = touched();
  writeReport(dir, "S02", touchReport({ read_check: "deadbeef" }));
  addLaunch(dir, "S02", "resume-finding");
  writeReport(dir, "S02", touchReport({ read_check: "deadbeef", artifacts: [] }), 1);
  const r1 = run(dir, "commit.mjs", ["--step", "S02", "--status", "stopped"]);
  refused(r1, /^ERROR B5 /m);

  const r = commitOf(dir, { status: "stopped", noReport: true });
  assert.equal(existsSync(join(dir, reportPath("S02", 0))), false);
  assert.equal(existsSync(join(dir, reportPath("S02", 1))), false);
  const renamed = ["hsdd/auto/steps/S02.invalid1.json", "hsdd/auto/steps/S02.invalid1.r1.json"];
  assert.ok(renamed.every((p) => filesOf(dir, r.judgement).includes(p)), filesOf(dir, r.judgement).join(", "));
  assert.equal(runLine(dir, "S02").note, "no valid report");
  assert.equal(runLine(dir, "S02").status, "stopped");
  assert.equal(gitIn(dir, "log", "-1", "--format=%s", r.artifact), "hsdd: S02 spec-touch shop.api: no summary (stopped)");
  assert.deepEqual(filesOf(dir, r.artifact), [API]);
});

test("a refused redispatch is committed stopped with --no-report, its decision and STOP.md", () => {
  const dir = begun();
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  const { id } = decide(dir, { step: "S02", by: "orchestrator", input: planInput({ question: "The redispatch is too large", would_have_asked: true, stop_class: "external" }) });
  put(dir, P.stop, "# Run stopped at S02\n");
  const r = commitOf(dir, { status: "stopped", noReport: true, note: "redispatch refused: size" });
  assert.ok(filesOf(dir, r.judgement).includes(P.stop));
  assert.deepEqual(readJsonl(dir, P.ledger).map((d) => [d.id, d.commit]), [[id, r.artifact]]);
  assert.equal(runLine(dir, "S02").note, "redispatch refused: size; no valid report");
  assert.equal(status(dir), "");
});

test("commit refuses without a valid report", () => {
  const dir = touched();
  rmSync(join(dir, reportPath("S02", 0)));
  const head = headFull(dir);
  refused(run(dir, "commit.mjs", ["--step", "S02", "--status", "completed"]), /^ERROR B1 hsdd\/auto\/steps\/S02\.json does not exist/m);
  put(dir, reportPath("S02", 0), "{not json");
  refused(run(dir, "commit.mjs", ["--step", "S02", "--status", "completed"]), /^ERROR B1 hsdd\/auto\/steps\/S02\.json: not valid JSON/m);
  assert.equal(headFull(dir), head);
  assert.equal(staged(dir), "");
  const missing = run(dir, "commit.mjs", ["--step", "S77", "--status", "completed"]);
  refused(missing, /S77/);
});

// ---------- refusals and the CLI ----------

test("refuses on the wrong branch", () => {
  const dir = touched();
  onBranch(dir, "elsewhere");
  const head = headFull(dir);
  assert.throws(() => commitOf(dir), /auto\/shop/);
  refused(run(dir, "commit.mjs", ["--step", "S02", "--status", "completed"]), /auto\/shop/);
  assert.equal(headFull(dir), head);
});

test("the CLI prints the gate, both commits and a summary, and exits 2 on a usage error", () => {
  const dir = touched();
  const r = run(dir, "commit.mjs", ["--step", "S02", "--status", "completed", "--model", "test-model", "--note", "a note"]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const lines = r.stdout.trimEnd().split("\n");
  assert.match(lines[0], /^gate: 0 error\(s\), 0 warning\(s\), \d+ changed file\(s\)$/);
  const artifact = gitIn(dir, "rev-parse", "HEAD^");
  const judgement = headFull(dir);
  assert.ok(lines.some((l) => l.includes(artifact) && /artifact/.test(l)), r.stdout);
  assert.ok(lines.some((l) => l.includes(judgement) && /judgement/.test(l)), r.stdout);
  assert.match(lines.at(-1), /^commit: S02 /);
  assert.equal(runLine(dir, "S02").model, "test-model");
  assert.equal(runLine(dir, "S02").note, "a note");

  // The host's usage report lives outside the repository, so the gate never sees it.
  const outside = mkdtempSync(join(tmpdir(), "hsdd-usage-"));
  const usageFile = join(outside, "u.json");
  writeFileSync(usageFile, JSON.stringify({ input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }));
  const usage = touched();
  const ok = run(usage, "commit.mjs", ["--step", "S02", "--status", "completed", "--usage-file", usageFile]);
  assert.equal(ok.code, 0, ok.stdout);
  assert.deepEqual(runLine(usage, "S02").usage, { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });

  const bad = touched();
  writeFileSync(usageFile, JSON.stringify({ tokens: "many" }));
  refused(run(bad, "commit.mjs", ["--step", "S02", "--status", "completed", "--usage-file", usageFile]), /usage/);
  writeFileSync(usageFile, "{not json");
  refused(run(bad, "commit.mjs", ["--step", "S02", "--status", "completed", "--usage-file", usageFile]), /usage/);
  assert.equal(runLine(bad, "S02"), undefined, "a bad usage file is refused before any commit");

  for (const args of [
    [], ["--step", "S02"], ["--step", "S02", "--status", "done"], ["--step", "bad", "--status", "completed"],
    ["--step", "S02", "--status", "completed", "--skip", "H1"], ["--skip", "H1"], ["--skip", "H1", "--reason", "x", "--status", "completed"],
    ["--skip", "bad", "--reason", "x"], ["--step", "S02", "--status", "completed", "--no-report"], ["--step", "S02", "--status", "completed", "extra"],
    ["--step", "S02", "--status", "completed", "--summary", " "],
  ]) {
    const e = run(bad, "commit.mjs", args);
    assert.equal(e.code, 2, `${args.join(" ")}: ${e.stdout}${e.stderr}`);
    assert.match(e.stdout.trimEnd().split("\n").at(-1), /^commit: usage error$/);
  }
});

test("--no-report refuses an orchestrator step", () => {
  const dir = begun();
  open(dir, "plan", SEG);
  assert.throws(() => commitOf(dir, { status: "stopped", noReport: true }), /orchestrator/);
});

// ---------- the report step ----------

const FILLED = [
  "# Segment report", "", "## Outcome", "", "<!-- slot:outcome -->", "The tree is planned.", "<!-- /slot -->", "",
  "## Assumptions about the owner's intent", "", "<!-- slot:assumptions -->", "None beyond the owner facts.", "<!-- /slot -->", "",
].join("\n");

const finished = (report = FILLED) => {
  const dir = begun();
  fakeStep(dir, { step: "S02", segment: SEG, kind: "align", target: "all" });
  open(dir, "report", SEG, "S03");
  put(dir, REPORT, report);
  return dir;
};

test("report step runs the final gate", () => {
  const dir = finished();
  const r = commitStep(dir, { step: "S03", status: "completed" });
  assert.deepEqual(filesOf(dir, r.artifact), [REPORT]);
  assert.equal(gitIn(dir, "log", "-1", "--format=%s", r.artifact), `auto: S03 report: ${SEG}`);

  const unfilled = finished(FILLED.replace("The tree is planned.", ""));
  const head = headFull(unfilled);
  refused(run(unfilled, "commit.mjs", ["--step", "S03", "--status", "completed"]), /^ERROR F6 /m);
  assert.equal(headFull(unfilled), head);
});

// ---------- the plan ----------

test("writes the step log", () => {
  const dir = begun();
  appendJsonl(dir, P.handoffs, { segment: SEG, handoff: "H9", at: nowStamp(), status: "skipped", reason: "a | test reason" });
  commitAll(dir, "a skip line from elsewhere");
  open(dir, "spec-touch", "shop.api");
  edit(dir, API, ...TOUCH);
  writeReport(dir, "S02", touchReport());
  const r = commitOf(dir);
  const plan = read(dir, P.plan);
  assert.match(plan, /^# Run plan: shop\n\n## Segments\n\n## Step log\n\n/);
  assert.match(plan, /\n## Change log\n$/);
  const table = plan.split("## Step log\n\n")[1].split("\n\n## Change log")[0].split("\n");
  assert.equal(table[0], "| Step | Segment | Kind | Skill | Target | Status | Artifact commit |");
  const rows = table.slice(2);
  const commitOfStep = (s) => runLine(dir, s).commit.slice(0, 7);
  assert.deepEqual(rows.slice().sort(), [
    `| S00 | ${SEG} | setup | none | ${SEG} | completed | ${commitOfStep("S00")} |`,
    `| S01 | ${SEG} | plan | none | ${SEG} | completed | ${commitOfStep("S01")} |`,
    `| S02 | ${SEG} | spec-touch | hsdd-spec | shop.api | completed | ${r.artifact.slice(0, 7)} |`,
    `| - | ${SEG} | skip | none | H9 | skipped: a \\| test reason | - |`,
  ].sort());
  assert.equal(rows.length, 4, "one row per run line and per skip line");
});

test("stepLogTable orders rows by time, a run line before a skip in the same second", () => {
  const line = (step, finished) => ({ step_ref: step, segment: SEG, kind: "plan", skill: "none", target: SEG, finished, commit: "0123456789abcdef", status: "completed" });
  const skip = (handoff, at) => ({ segment: SEG, handoff, at, status: "skipped", reason: "r" });
  const t = stepLogTable(
    [line("S01", "2026-10-22T10:00:00Z"), line("S02", "2026-10-22T10:05:00Z"), line("S03", "2026-10-22T10:09:00Z")],
    [skip("H1", "2026-10-22T10:05:00Z"), skip("H2", "2026-10-22T10:06:00Z")],
  ).split("\n");
  assert.deepEqual(t.slice(2).map((r) => r.split(" | ")[0].replace("| ", "") + (r.includes("skip") ? r.split(" | ")[4] : "")), ["S01", "S02", "-H1", "-H2", "S03"]);
  assert.equal(t[2], `| S01 | ${SEG} | plan | none | ${SEG} | completed | 0123456 |`);
  assert.equal(stepLogTable([], []).split("\n").length, 2, "a header and its rule");
});

test("replaceSection rewrites one section whole and keeps the rest", () => {
  const md = "# Run plan: shop\n\n## Segments\n\n**x.** Purpose.\n\n## Step log\n\nold row\nold row 2\n\n## Change log\n\n- DEC-001: a change\n";
  const out = replaceSection(md, "Step log", "| a |\n| b |");
  assert.equal(out, "# Run plan: shop\n\n## Segments\n\n**x.** Purpose.\n\n## Step log\n\n| a |\n| b |\n\n## Change log\n\n- DEC-001: a change\n");
  assert.equal(replaceSection(out, "Step log", "| a |\n| b |"), out, "idempotent");
  assert.equal(replaceSection("# T\n\n## Step log\n\nold\n", "Step log", "new"), "# T\n\n## Step log\n\nnew\n", "the last section");
  assert.equal(replaceSection("# T\n", "Step log", "new"), "# T\n\n## Step log\n\nnew\n", "a missing section is appended");
  assert.equal(replaceSection("## Step log\n\n```\n## not a heading\n```\n\n## Change log\n", "Step log", "new"), "## Step log\n\nnew\n\n## Change log\n");
});

test("ensurePlan writes the skeleton only when plan.md is missing", () => {
  const dir = begun();
  const config = { run: "shop" };
  assert.equal(ensurePlan(dir, config), "# Run plan: shop\n\n## Segments\n\n## Step log\n\n## Change log\n");
  put(dir, P.plan, "# Run plan: shop\n\n## Segments\n\n**x.** Mine.\n");
  assert.equal(ensurePlan(dir, config), "# Run plan: shop\n\n## Segments\n\n**x.** Mine.\n");
});

// ---------- --skip ----------

const ISEG = "2026-10-22-intake-spec-v2";
const REQUEST = "ref/spec-v2.md";
const RECORD = "hsdd/management/2026-10-22-intake-order-v2.md";
const APP = "hsdd/spec/shop.web.app.md";
const ORDER = readFileSync(join(HERE, "fixtures", "auto", "intake", "2026-10-22-intake-order-v2.md"), "utf8");

// An intake segment whose record routes H1 (contract-touch, unconditional) and H2a (citation-touch on
// shop.web.app, cites-superseded); H1 executed, moving order-api to v2 and, with `moveApp`, the app's citations.
const handedOff = ({ moveApp, executeH1 = true }) => {
  const dir = makeRepo({ stage: "06-planned", config: cfg(), files: { [REQUEST]: "# Spec v2\n" } });
  onBranch(dir, "auto/shop");
  installScripts(dir);
  commitAll(dir, "install the scripts");
  addSegment(dir, {
    id: ISEG, mode: "intake", opened_at: nowStamp(), instruction: "Take in ref/spec-v2.md.", stop_policy: "stop", first_step: "S00",
    request: REQUEST, authority: "accepted-rfc",
  });
  fakeStep(dir, { step: "S00", segment: ISEG, kind: "setup", target: ISEG });
  fakeStep(dir, { step: "S01", segment: ISEG, kind: "plan", target: ISEG });
  fakeStep(dir, { step: "S02", segment: ISEG, kind: "intake", target: REQUEST, files: { [RECORD]: ORDER } });
  if (executeH1) {
    const files = { [CONTRACT]: read(dir, CONTRACT).replace("version: v1", "version: v2") };
    if (moveApp) files[APP] = read(dir, APP).replaceAll("order-api@v1", "order-api@v2");
    fakeStep(dir, { step: "S03", segment: ISEG, kind: "contract-touch", target: "order-api", handoff: "H1", files });
  }
  return dir;
};

test("--skip refuses when the condition holds and resumes from an uncommitted skip line", () => {
  const early = handedOff({ executeH1: false });
  assert.throws(() => skipHandoff(early, { handoff: "H1", reason: "not needed" }), /H1.*(no when|always)/);
  assert.throws(() => skipHandoff(early, { handoff: "H7", reason: "x" }), /H7/);

  const holds = handedOff({ moveApp: false });
  const head = headFull(holds);
  assert.throws(() => skipHandoff(holds, { handoff: "H1", reason: "x" }), /H1.*step|S03/, "H1 has a step");
  refused(run(holds, "commit.mjs", ["--skip", "H2a", "--reason", "cites nothing old"]), /cites-superseded holds|condition holds/);
  assert.equal(headFull(holds), head);
  assert.equal(existsSync(join(holds, P.handoffs)), false, "nothing appended");

  const dir = handedOff({ moveApp: true });
  const before = headFull(dir);
  const crashed = skipHandoffPhases(dir, { handoff: "H2a", reason: "cites no superseded version" }, { stopAfter: "append" });
  assert.equal(crashed.stoppedAfter, "append");
  assert.equal(headFull(dir), before);
  assert.equal(readJsonl(dir, P.handoffs).length, 1);

  const r = run(dir, "commit.mjs", ["--skip", "H2a", "--reason", "cites no superseded version"]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout.trimEnd().split("\n").at(-1), /^commit: /);
  const lines = readJsonl(dir, P.handoffs);
  assert.equal(lines.length, 1, "the rerun appends nothing");
  assert.deepEqual({ ...lines[0], at: "-" }, { segment: ISEG, handoff: "H2a", at: "-", status: "skipped", reason: "cites no superseded version" });
  assert.equal(gitIn(dir, "rev-list", "--count", `${before}..HEAD`), "1");
  assert.equal(body(dir), `auto: skip H2a: cites no superseded version\n\n${TRAILER}`);
  assert.deepEqual(filesOf(dir, "HEAD"), [P.handoffs, P.plan].sort());
  assert.match(read(dir, P.plan), new RegExp(`\\| - \\| ${ISEG} \\| skip \\| none \\| H2a \\| skipped: cites no superseded version \\| - \\|`));
  assert.equal(status(dir), "");

  refused(run(dir, "commit.mjs", ["--skip", "H2a", "--reason", "again"]), /H2a.*skipped/);
  assert.equal(readJsonl(dir, P.handoffs).length, 1);
});

test("--skip crash points each rerun to one skip line and one commit", () => {
  for (const phase of SKIP_PHASES) {
    const dir = handedOff({ moveApp: true });
    const before = headFull(dir);
    skipHandoffPhases(dir, { handoff: "H2a", reason: "nothing cites v1" }, { stopAfter: phase });
    const r = skipHandoff(dir, { handoff: "H2a", reason: "nothing cites v1" });
    assert.equal(r.commit, headFull(dir));
    assert.equal(readJsonl(dir, P.handoffs).length, 1, `after ${phase}`);
    assert.equal(gitIn(dir, "rev-list", "--count", `${before}..HEAD`), "1", `after ${phase}`);
    assert.equal(status(dir), "", `after ${phase}`);
  }
});

test("--skip refuses while a step is open, and outside an intake segment", () => {
  const dir = handedOff({ moveApp: true });
  openStep(dir, { step: "S04", segment: ISEG, kind: "align", target: "all" });
  assert.throws(() => skipHandoff(dir, { handoff: "H2a", reason: "x" }), /S04/);
  const plan = begun();
  assert.throws(() => skipHandoff(plan, { handoff: "H1", reason: "x" }), /intake/);
});
