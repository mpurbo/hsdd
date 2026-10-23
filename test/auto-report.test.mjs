import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendProduced, appendedRecord, buildReport, coveredSegments, decisionsFirst, main, producedAdditions,
} from "../skills/hsdd-auto/scripts/report.mjs";
import { finalGate } from "../skills/hsdd-auto/scripts/gate.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { P, reportPath, stepPaths } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { appendJsonl, readDispatch, writeDispatch } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, fakeStep, gitIn, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER = readFileSync(join(HERE, "fixtures", "auto", "intake", "2026-10-22-intake-order-v2.md"), "utf8");

const SEG = "2026-10-22-plan";
const SEG2 = "2026-10-23-plan";
const ISEG = "2026-10-22-intake-spec-v2";
const REQUEST = "ref/spec-v2.md";
const RECORD = "hsdd/management/2026-10-22-intake-order-v2.md";
const CONTRACT = "hsdd/contract/order-api.md";
const ADR = "hsdd/adr/001-order-ids.md";

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const commitAll = (dir, msg = "owner edit") => { gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "--allow-empty", "-m", msg); };

const planSegment = (id = SEG, first = "S00") => ({ id, mode: "plan", opened_at: nowStamp(), instruction: "Plan the shop.", stop_policy: "stop", first_step: first });
const intakeSegment = () => ({
  id: ISEG, mode: "intake", opened_at: nowStamp(), instruction: "Take in ref/spec-v2.md.", stop_policy: "stop", first_step: "S00",
  request: REQUEST, authority: "accepted-rfc",
});
const step = (dir, n, kind, target, over = {}, seg = SEG) =>
  fakeStep(dir, { step: `S${String(n).padStart(2, "0")}`, segment: seg, kind, target, ...over });

// A planned tree with one plan segment, its setup (S00) and plan (S01) steps committed.
const begun = () => {
  const dir = makeRepo({ stage: "06-planned" });
  addSegment(dir, planSegment());
  step(dir, 0, "setup", SEG);
  step(dir, 1, "plan", SEG);
  return dir;
};

// A planned tree with an intake segment, setup, plan and the intake step (S02) committed with its record.
const intakeBegun = () => {
  const dir = makeRepo({ stage: "06-planned", files: { [REQUEST]: "# Spec v2\n" } });
  addSegment(dir, intakeSegment());
  step(dir, 0, "setup", ISEG, {}, ISEG);
  step(dir, 1, "plan", ISEG, {}, ISEG);
  step(dir, 2, "intake", REQUEST, { files: { [RECORD]: ORDER } }, ISEG);
  return dir;
};

const decision = (over = {}) => ({
  id: "DEC-001", at: nowStamp(), segment: SEG, step: "plan", step_ref: "S01", by: "orchestrator", artifact: null,
  question: "Which wording?", options: [{ label: "a", consequence: "short" }, { label: "b", consequence: "long" }], chosen: "a",
  why: "shorter", evidence: [], blast_radius: "node-local", confidence: "high", would_have_asked: false, stop_class: null,
  would_upstream: false, commit: "abcdef1", ...over,
});
const ledger = (dir, ...ds) => ds.forEach((d) => appendJsonl(dir, P.ledger, d));
const queue = (dir, ...lines) => lines.forEach((l) => appendJsonl(dir, P.queue, { at: nowStamp(), ...l }));

const ctxOf = (dir) => loadContext(dir);
const build = (dir, seg = SEG, existing = null) => buildReport(ctxOf(dir), seg, existing);
const section = (text, heading) => {
  const m = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text);
  assert.ok(m, `no section ${heading} in\n${text}`);
  return m[1];
};
const addLaunch = (dir, stepId, reason) => {
  const d = readDispatch(dir, stepId);
  writeDispatch(dir, stepId, { ...d.front, launches: [...d.front.launches, { at: nowStamp(), reason }] }, d.body);
};
const stepReport = (stepId, over = {}) => ({
  step_ref: stepId, skill: "hsdd-spec", target: "shop.api", status: "completed", stop: null, artifacts: [], experiments: [],
  self_check: [], routed: [], closes: [], reads_outside: [], notes: ["did the step"], read_check: "00000000", ...over,
});
const withReport = (stepId, over) => ({ [reportPath(stepId, 0)]: `${JSON.stringify(stepReport(stepId, over), null, 2)}\n` });

// ---------- decisions first ----------

test("decisions to look at first, in 10.9 order", () => {
  const dir = begun();
  ledger(dir,
    decision({ id: "DEC-001", step: "setup", step_ref: "S00" }),
    decision({ id: "DEC-002", confidence: "low", question: "low one" }),
    decision({ id: "DEC-003", would_have_asked: true, stop_class: "judgement", question: "asked one" }),
    decision({ id: "DEC-004", blast_radius: "tree", question: "tree one" }),
    decision({ id: "DEC-005", question: "plain one" }),
    decision({ id: "DEC-006", would_have_asked: true, confidence: "low", blast_radius: "upstream", stop_class: "upstream", question: "asked and low" }),
    decision({ id: "DEC-007", blast_radius: "upstream", would_upstream: true, question: "upstream one", evidence: ["Spec §1", "ref/spec.md"] }),
    decision({ id: "DEC-008", segment: "some-other-segment", would_have_asked: true, stop_class: "axis", question: "other segment" }),
  );
  const text = build(dir);
  const ids = [...section(text, "Decisions to look at first").matchAll(/^\| (DEC-\d+) /gm)].map((m) => m[1]);
  assert.deepEqual(ids, ["DEC-003", "DEC-006", "DEC-002", "DEC-004", "DEC-007", "DEC-001"]);
  assert.match(section(text, "Decisions to look at first"), /\| DEC-001 \| S00 setup \| Which wording\? \| a \|/);
  assert.deepEqual(decisionsFirst([]), []);
  const up = section(text, "Upstream");
  assert.match(up, /\| DEC-007 \| upstream one \| a \| Spec §1; ref\/spec\.md \|/);
  assert.ok(!up.includes("DEC-002"));
});

test("the open report step's own sidecar decisions are in the decision sections", () => {
  // Final review B2: the report step records its last plan decisions (8.10) before its commit appends them.
  const dir = begun();
  step(dir, 2, "align", "all");
  ledger(dir, decision({ id: "DEC-001", question: "committed one", would_have_asked: true, stop_class: "judgement" }));
  openStep(dir, { step: "S03", segment: SEG, kind: "report", target: SEG });
  const sidecar = (over) => {
    const { segment, step_ref, commit, ...rest } = decision(over);
    return JSON.stringify(rest);
  };
  put(dir, stepPaths("S03").decisions, [
    sidecar({ id: "DEC-002", question: "last plan decision", confidence: "low" }),
    "not json",
    sidecar({ id: "DEC-001", question: "a duplicate of a ledger id" }),
  ].join("\n") + "\n");
  const text = build(dir);
  const first = section(text, "Decisions to look at first");
  assert.match(first, /\| DEC-002 \| S03 plan \| last plan decision \| a \|/, first);
  assert.match(first, /\| DEC-001 \| S01 plan \| committed one \|/, first);
  assert.ok(!first.includes("a duplicate of a ledger id"), "a ledger id is not listed twice");
  assert.match(section(text, "Every decision by blast radius"), /- DEC-002 \(S03 plan, low\): last plan decision/);
  // Another segment's open step, or a step that is not the report, adds nothing.
  const other = begun();
  openStep(other, { step: "S02", segment: SEG, kind: "spec-touch", target: "shop.api" });
  put(other, stepPaths("S02").decisions, `${sidecar({ id: "DEC-001", question: "a subagent's decision", confidence: "low" })}\n`);
  assert.ok(!build(other).includes("a subagent's decision"));
});

test("braces and pipes in decision text reach the report as written", () => {
  const dir = begun();
  ledger(dir, decision({ would_have_asked: true, stop_class: "judgement", question: "Use {name} or {{step}} or a|b?\nsecond line", chosen: "x {y}" }));
  const first = section(build(dir), "Decisions to look at first");
  assert.ok(first.includes("Use {name} or {{step}} or a\\|b? second line"), first);
  assert.ok(first.includes("x {y}"));
});

test("an empty cell is a hyphen and an empty section says none", () => {
  const dir = begun();
  const text = build(dir);
  assert.equal(section(text, "Decisions to look at first").trim(), "None.");
  assert.equal(section(text, "Experiments").trim(), "None.");
  assert.match(section(text, "Every decision by blast radius"), /None\./);
});

// ---------- the prose slots ----------

test("prose slots survive a re-run", () => {
  const dir = begun();
  const first = run(dir, "report.mjs", ["--segment", SEG]);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  const file = `hsdd/auto/report/${SEG}.md`;
  const mine = read(dir, file)
    .replace(/(<!-- slot:outcome -->)\s*(<!-- \/slot -->)/, (_, a, b) => `${a}\nThe plan is done. Braces {stay} and $& too.\n${b}`)
    .replace(/(<!-- slot:assumptions -->)\s*(<!-- \/slot -->)/, (_, a, b) => `${a}\nThe owner wants it small.\n${b}`);
  put(dir, file, mine);
  ledger(dir, decision({ would_have_asked: true, stop_class: "judgement", question: "late arrival" }));
  const second = run(dir, "report.mjs", ["--segment", SEG]);
  assert.equal(second.code, 0, second.stdout + second.stderr);
  const after = read(dir, file);
  assert.ok(after.includes("<!-- slot:outcome -->\nThe plan is done. Braces {stay} and $& too.\n<!-- /slot -->"));
  assert.ok(after.includes("<!-- slot:assumptions -->\nThe owner wants it small.\n<!-- /slot -->"));
  assert.match(section(after, "Decisions to look at first"), /late arrival/);
  const third = run(dir, "report.mjs", ["--segment", SEG]);
  assert.equal(third.code, 0);
  assert.equal(read(dir, file), after, "a re-run without a change writes the same bytes");
});

test("the how-to-review sentence carries the configured commit prefixes and a literal {step}", () => {
  const dir = begun();
  const text = build(dir);
  assert.ok(text.includes("Each step is two\ncommits, `hsdd: {step} ...` then `judgement: {step}`."), section(text, "How to review"));
  assert.ok(!text.includes("\u2014"));
});

// ---------- coverage ----------

test("a segment ended by an owner message is covered by the next report", () => {
  const dir = begun();
  step(dir, 2, "plan", SEG, { note: "ended: owner message" });
  ledger(dir, decision({ id: "DEC-001", would_have_asked: true, stop_class: "judgement", question: "from the first segment" }));
  addSegment(dir, planSegment(SEG2, "S03"));
  step(dir, 3, "setup", SEG2, {}, SEG2);
  ledger(dir, decision({ id: "DEC-002", segment: SEG2, step: "setup", step_ref: "S03", question: "from the second segment" }));
  const ctx = ctxOf(dir);
  assert.deepEqual(coveredSegments(ctx, SEG2), [SEG, SEG2]);
  assert.deepEqual(coveredSegments(ctx, SEG), [SEG]);
  const text = buildReportOf(ctx);
  assert.ok(buildReport(ctxOf(begun()), SEG, null).indexOf("also covers") < 0, "nothing earlier, no note");
  assert.match(text, new RegExp(`^This report also covers segment ${SEG}, which ended without a report`, "m"));
  assert.ok(!text.includes("also covers segments"));
  const outcome = section(text, "Outcome");
  assert.match(outcome, /<!-- slot:outcome -->\s*<!-- \/slot -->/, "the Outcome slot stays empty");
  put(dir, `hsdd/auto/report/${SEG2}.md`, text);
  assert.ok(finalGate(ctxOf(dir)).some((f) => f.id === "F6" && /slot outcome is empty/.test(f.message)), "F6 does not accept the empty Outcome slot");
  const first = section(text, "Decisions to look at first");
  assert.ok(first.includes("from the first segment") && first.includes("from the second segment"));
  // Once the earlier segment has a committed report it is not covered again.
  step(dir, 4, "report", SEG, {}, SEG);
  assert.deepEqual(coveredSegments(ctxOf(dir), SEG2), [SEG2]);
});
const buildReportOf = (ctx) => buildReport(ctx, SEG2, null);

test("a segment an earlier report covered is not covered again", () => {
  // SEG stopped; SEG2 continued it and finished, so its report covered SEG; SEG3 covers itself only.
  const SEG3 = "2026-10-24-plan";
  const dir = begun();
  step(dir, 2, "spec-touch", "shop.api", { status: "stopped" });
  addSegment(dir, planSegment(SEG2, "S03"));
  step(dir, 3, "setup", SEG2, {}, SEG2);
  step(dir, 4, "spec-touch", "shop.api", { continues: "S02" }, SEG2);
  step(dir, 5, "report", SEG2, {}, SEG2);
  addSegment(dir, planSegment(SEG3, "S06"));
  step(dir, 6, "setup", SEG3, {}, SEG3);
  const ctx = ctxOf(dir);
  assert.deepEqual(coveredSegments(ctx, SEG2), [SEG, SEG2]);
  assert.deepEqual(coveredSegments(ctx, SEG3), [SEG3]);
  assert.deepEqual(ctx.segmentChain(SEG3), [SEG3], "the final scope uses the same chain");
});

test("coveredSegments rejects a segment that is not in run.yaml", () => {
  assert.throws(() => coveredSegments(ctxOf(begun()), "nope"), /no segment nope/);
  const dir = begun();
  const r = run(dir, "report.mjs", ["--segment", "nope"]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /no segment nope/);
  assert.equal(run(dir, "report.mjs", []).code, 2);
});

// ---------- experiments ----------

test("experiments list each README's first line", () => {
  const dir = begun();
  put(dir, "hsdd/auto/experiments/parser/README.md", "\n# The parser accepts trailing commas.\nMore text.\n");
  put(dir, "hsdd/auto/experiments/timing/output.txt", "12ms\n");
  step(dir, 2, "spec-touch", "shop.api", {
    files: withReport("S02", { experiments: [
      { path: "hsdd/auto/experiments/parser", question: "Does it accept trailing commas?", finding: "yes" },
      { path: "hsdd/auto/experiments/timing/output.txt", question: "How fast?", finding: "fast" },
    ] }),
  });
  ledger(dir, decision({ step_ref: "S02", evidence: ["hsdd/auto/experiments/cited/output.txt"] }));
  const exp = section(build(dir), "Experiments");
  assert.ok(exp.includes("| hsdd/auto/experiments/parser | Does it accept trailing commas? | The parser accepts trailing commas. |"), exp);
  assert.ok(exp.includes("| hsdd/auto/experiments/timing | How fast? | - |"), exp);
  assert.ok(exp.includes("| hsdd/auto/experiments/cited | - | - |"), exp);
});

// ---------- record gaps ----------

test("record gaps list resumed, re-dispatched and stopped steps", () => {
  const dir = begun();
  step(dir, 2, "spec-touch", "shop.api", {
    files: withReport("S02", { reads_outside: [{ path: "docs/notes.md", why: "needed the glossary" }] }),
  });
  addLaunch(dir, "S02", "resume-finding");
  addLaunch(dir, "S02", "resume-answer");
  addLaunch(dir, "S02", "redispatch");
  gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "-m", "launches");
  step(dir, 3, "spec-touch", "shop.api", { status: "stopped" });
  step(dir, 4, "spec-touch", "shop.api", { continues: "S03" });
  ledger(dir,
    decision({ id: "DEC-001", step_ref: "S03", step: "mid-level-spec", would_have_asked: true, stop_class: "shape", question: "Which axis?" }),
    decision({ id: "DEC-002", step_ref: "S02", step: "mid-level-spec", at: "2000-01-01T00:00:00Z", by: "subagent", question: "stamped early" }),
    decision({ id: "DEC-003", step_ref: "S02", step: "setup", at: "2000-01-01T00:00:00Z", by: "owner", question: "owner answer" }),
  );
  const gaps = section(build(dir), "Record gaps");
  assert.match(gaps, /- S02 was resumed at \S+ for a finding/);
  assert.match(gaps, /- S02 was resumed at \S+ for an answer/);
  assert.match(gaps, /- S02 was re-dispatched at \S+: the earlier subagent was lost/);
  assert.match(gaps, /- S03 stopped: shape, DEC-001: Which axis\?/);
  assert.match(gaps, /- S04 continues S03/);
  assert.match(gaps, /- S02 read docs\/notes\.md outside its read set: needed the glossary/);
  assert.match(gaps, /- DEC-002 \(S02\) is stamped 2000-01-01T00:00:00Z, outside its step's window/);
  assert.ok(!gaps.includes("DEC-003"), "an owner's answer is recorded later than its step window");
  assert.match(gaps, /- As of this report run, the final gate reports \d+ warnings?\./);
});

test("record gaps list inserted and skipped steps", () => {
  const dir = intakeBegun();
  appendJsonl(dir, P.handoffs, { segment: ISEG, handoff: "H2a", at: nowStamp(), status: "skipped", reason: "shop.web.app cites no superseded version" });
  queue(dir, { id: "Q-001", status: "open", from: "S02", target: "run", kind: "insert-step", text: "replan the cart phase", step_kind: "phase-plan-append", step_target: "shop.web.app" });
  queue(dir, { id: "Q-001", status: "accepted", decision: "DEC-001" });
  step(dir, 3, "phase-plan-append", "shop.web.app", { queue_item: "Q-001" }, ISEG);
  const gaps = section(build(dir, ISEG), "Record gaps");
  assert.match(gaps, /- S03 is an inserted step for Q-001 \(phase-plan-append on shop\.web\.app\): replan the cart phase/);
  assert.match(gaps, /- H2a was skipped: shop\.web\.app cites no superseded version/);
});

// ---------- deferred findings ----------

test("deferred findings list open consider items, rejected insert-steps and align repeats", () => {
  const dir = begun();
  step(dir, 2, "spec-touch", "shop.api");
  step(dir, 3, "reconcile", "shop.api");
  queue(dir,
    { id: "Q-001", status: "open", from: "S02", target: "shop.api", kind: "consider", text: "repeat finding" },
    { id: "Q-001", status: "explained", by: "S03", note: "kept as written" },
    { id: "Q-002", status: "open", from: "S02", target: "shop.api", kind: "consider", text: "still open finding" },
    { id: "Q-003", status: "open", from: "S02", target: "shop.api", kind: "consider", text: "closed finding" },
    { id: "Q-003", status: "addressed", by: "S03", note: "done" },
    { id: "Q-004", status: "open", from: "S02", target: "run", kind: "insert-step", text: "add a reconcile", step_kind: "reconcile", step_target: "shop.api" },
    { id: "Q-004", status: "rejected", decision: "DEC-009" },
    { id: "Q-005", status: "open", from: "S02", target: "run", kind: "insert-step", text: "accepted insert", step_kind: "reconcile", step_target: "shop.api" },
    { id: "Q-005", status: "accepted", decision: "DEC-010" },
    { id: "Q-006", status: "open", from: "S90", target: "shop.api", kind: "consider", text: "from an unknown step" },
  );
  step(dir, 4, "align", "all", { files: withReport("S04", { skill: "hsdd-reconcile", target: "all", routed: [
    { target: "shop.api", kind: "consider", text: "repeat finding" },
    { target: "shop.api", kind: "consider", text: "a new finding" },
  ] }) });
  const text = build(dir);
  const deferred = section(text, "Deferred findings");
  assert.ok(!deferred.includes("Q-006"), "an item from a step outside the covered segments is not listed");
  assert.ok(deferred.includes("| consider, open | Q-002 | S02 | shop.api | still open finding |"), deferred);
  assert.ok(deferred.includes("| insert-step, rejected | Q-004 | S02 | reconcile on shop.api | add a reconcile (rejected by DEC-009) |"), deferred);
  assert.ok(deferred.includes("| align repeat, not reopened | - | S04 | shop.api | repeat finding |"), deferred);
  for (const absent of ["Q-001", "Q-003", "Q-005", "a new finding"]) assert.ok(!deferred.includes(absent), `${absent} must not be listed:\n${deferred}`);
});

// ---------- the plan report ----------

test("plan report has the tree table and every decision by blast radius", () => {
  const dir = begun();
  ledger(dir,
    decision({ id: "DEC-001", blast_radius: "contract", question: "contract one" }),
    decision({ id: "DEC-002", blast_radius: "node-local", question: "local one", confidence: "medium" }),
    decision({ id: "DEC-003", blast_radius: "tree", question: "tree one" }),
  );
  const text = build(dir);
  assert.match(text, /^# Segment report: 2026-10-22-plan\n/);
  const changed = section(text, "What changed");
  assert.ok(changed.includes("| Node | Kind | Phases | Produces | Consumes |"), changed);
  assert.ok(changed.includes("| shop.api | leaf-parent | 2 | order-api@v1 | - |"), changed);
  assert.ok(changed.includes("| shop.web.app | leaf-parent |"), changed);
  assert.ok(changed.includes("| shop | "), changed);
  const radius = section(text, "Every decision by blast radius");
  assert.ok(radius.indexOf("### tree") < radius.indexOf("### contract") && radius.indexOf("### contract") < radius.indexOf("### node-local"), radius);
  assert.ok(radius.includes("- DEC-002 (S01 plan, medium): local one Chosen: a"), radius);
  assert.ok(!radius.includes("### upstream"));
  assert.ok(!text.includes("Segment report: {"), "no unfilled slot");
});

// ---------- the intake report and the Produced append ----------

test("the intake report has the handoff table", () => {
  const dir = intakeBegun();
  appendJsonl(dir, P.handoffs, { segment: ISEG, handoff: "H2a", at: nowStamp(), status: "skipped", reason: "cites no superseded version" });
  step(dir, 3, "contract-touch", "order-api", { handoff: "H1" }, ISEG);
  const text = build(dir, ISEG);
  assert.ok(text.includes("## Earlier proposals read against the request"));
  assert.ok(!text.includes("## Every decision by blast radius"));
  const changed = section(text, "What changed");
  assert.match(changed, /\| H1 \| S03 \| contract-touch \| order-api \| [0-9a-f]{7} \|/);
  assert.match(changed, /\| H2a \| skipped \(cites no superseded version\) \| citation-touch \| shop\.web\.app \| - \|/);
});

// Contract bumped, an ADR changed and a node grafted inside the intake segment.
const produced = () => {
  const dir = intakeBegun();
  put(dir, CONTRACT, read(dir, CONTRACT).replace("version: v1", "version: v2"));
  put(dir, ADR, `${read(dir, ADR)}\nAmended for the currency.\n`);
  step(dir, 3, "contract-touch", "order-api", { handoff: "H1" }, ISEG);
  step(dir, 4, "graft", "shop.web.admin", { files: { "hsdd/spec/shop.web.admin.md": "# shop.web.admin: Admin\n\n## Node\n\n- **Kind:** leaf-parent\n- **Purpose:** admin screens\n" } }, ISEG);
  step(dir, 5, "graft", "shop.web.ghost", {}, ISEG);
  return dir;
};

test("intake append to ## Produced is idempotent and lists no phases", () => {
  const dir = produced();
  const add = producedAdditions(ctxOf(dir), ISEG);
  assert.deepEqual(add, { contracts: ["order-api@v2"], adrs: ["ADR-001"], nodes: ["shop.web.admin"] });
  assert.equal(appendProduced(ctxOf(dir), ISEG), true);
  const once = read(dir, RECORD);
  const produced_ = section(once, "Produced");
  assert.ok(produced_.includes("- Contracts bumped: order-api@v2"), produced_);
  assert.ok(produced_.includes("- ADRs amended: ADR-001"));
  assert.ok(produced_.includes("- Nodes grafted: shop.web.admin"));
  assert.ok(!/shop\.[a-z.]+\.\d/.test(produced_) && !/phase/i.test(produced_), "no phase is appended");
  const log = section(once, "Change log");
  const today = nowStamp().slice(0, 10);
  assert.ok(log.includes("- 2026-10-22: created, routed cross-node"));
  assert.ok(log.includes(`- ${today}: hsdd-auto segment ${ISEG}: contracts bumped order-api@v2; ADRs amended ADR-001; nodes grafted shop.web.admin`), log);
  assert.ok(once.startsWith(ORDER.slice(0, ORDER.indexOf("## Produced"))), "text before ## Produced is untouched");
  assert.equal(appendProduced(ctxOf(dir), ISEG), false);
  assert.equal(read(dir, RECORD), once);
  assert.ok(!once.includes("\u2014"));
});

test("the CLI writes the report and the append, and a second run changes nothing", () => {
  const dir = produced();
  const out = [];
  assert.equal(main(["--segment", ISEG], dir, { log: (l) => out.push(l) }), 0, out.join("\n"));
  assert.ok(out.some((l) => /^appended ## Produced/.test(l)), out.join("\n"));
  assert.match(out.at(-1), /^report: hsdd\/auto\/report\/.+ covers 1 segment\(s\)$/);
  const record = read(dir, RECORD);
  const report = read(dir, `hsdd/auto/report/${ISEG}.md`);
  const again = [];
  assert.equal(main(["--segment", ISEG], dir, { log: (l) => again.push(l) }), 0);
  assert.ok(again.some((l) => /^no ## Produced append/.test(l)));
  assert.equal(read(dir, RECORD), record);
  assert.equal(read(dir, `hsdd/auto/report/${ISEG}.md`), report);
});

test("nothing to append when no contract, ADR or node changed", () => {
  const dir = intakeBegun();
  assert.equal(appendProduced(ctxOf(dir), ISEG), false);
  assert.equal(read(dir, RECORD), ORDER);
});

test("a record without ## Produced or ## Change log gets both sections", () => {
  const add = { contracts: ["a@v2"], adrs: [], nodes: [] };
  const bare = "# Intake: x\n\n## Request\n\nText.\n";
  const out = appendedRecord(bare, add, "seg-1", "2026-10-23");
  assert.equal(out, "# Intake: x\n\n## Request\n\nText.\n\n## Produced\n\n- Contracts bumped: a@v2\n\n## Change log\n\n- 2026-10-23: hsdd-auto segment seg-1: contracts bumped a@v2\n");
  const noLog = "# Intake: x\n\n## Produced\n\n- Phases: shop.api.1\n\n## Change log\n\n- d: created\n";
  const out2 = appendedRecord(noLog, add, "seg-1", "2026-10-23");
  assert.ok(out2.includes("- Phases: shop.api.1\n- Contracts bumped: a@v2\n\n## Change log\n\n- d: created\n- 2026-10-23: hsdd-auto segment seg-1: contracts bumped a@v2\n"), out2);
  assert.equal(appendedRecord(bare, { contracts: [], adrs: [], nodes: [] }, "seg-1", "2026-10-23"), null);
  assert.equal(appendedRecord(out, add, "seg-1", "2026-10-23"), null);
});
