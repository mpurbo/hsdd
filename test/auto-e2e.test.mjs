// End-to-end simulated runs (spec 17.2's runs 1 to 6, 17.1's bundled copy): every script driven through
// its CLI exactly as the orchestrator drives it (chapter 8), with a scripted stand-in for each step
// subagent (test/helpers/auto-standin.mjs). One helper per orchestrator action; each scenario is a short
// sequence of them with assertions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { commitStepPhases } from "../skills/hsdd-auto/scripts/commit.mjs";
import { formatFlow, formatScalar, parseYaml } from "../skills/hsdd-auto/scripts/lib/yaml.mjs";
import { SCRIPTS, baseConfig, completeSkills, gitIn, makeRepo } from "./helpers/auto-repo.mjs";
import { FIXTURES, readDispatchFile, standIn } from "./helpers/auto-standin.mjs";

const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const jsonl = (dir, rel) => (existsSync(join(dir, rel)) ? read(dir, rel).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const outside = (name, text) => {
  const file = join(mkdtempSync(join(tmpdir(), "hsdd-auto-e2e-")), name);
  writeFileSync(file, text);
  return file;
};
const edit = (from, to) => (old) => {
  assert.ok(old !== null && old.includes(from), `no ${JSON.stringify(from)} to replace`);
  return old.replace(from, to);
};

// ---------- the scripts, as the orchestrator runs them ----------

// Before the first setup step copies them, the scripts run from the installed skill (spec 4.3).
const scriptPath = (dir, script) => {
  const copy = join(dir, "hsdd/scripts/auto", script);
  return existsSync(copy) ? copy : join(completeSkills(), "hsdd-auto", "scripts", script);
};

// Runs a script and asserts its exit code (0 unless `code` says otherwise).
const cli = (dir, script, args = [], { input, code = 0 } = {}) => {
  const r = spawnSync(process.execPath, [scriptPath(dir, script), ...args], { cwd: dir, input, encoding: "utf8" });
  assert.equal(r.status, code, `${script} ${args.join(" ")} exited ${r.status}:\n${r.stdout ?? ""}${r.stderr ?? ""}`);
  return { stdout: r.stdout ?? "" };
};

const nextOf = (dir) => JSON.parse(cli(dir, "next.mjs").stdout);
const stateOf = (dir) => JSON.parse(cli(dir, "state.mjs", ["--json"]).stdout);
const committedSteps = (dir) => jsonl(dir, "hsdd/judgement/run.jsonl");
const sidecar = (dir, step) => jsonl(dir, `hsdd/auto/steps/${step}.decisions.jsonl`);
const queue = (dir) => jsonl(dir, "hsdd/auto/queue.jsonl");
const itemsFrom = (dir, step, kind) => queue(dir).filter((l) => l.status === "open" && l.from === step && l.kind === kind);

// A decision input (spec 10.4): two options, the first chosen unless `chosen` says otherwise.
const dec = (question, more = {}) => ({
  artifact: null,
  question,
  options: [{ label: "A", consequence: "the first way, which the evidence supports" }, { label: "B", consequence: "the second way, which nothing supports" }],
  chosen: "A",
  why: "The sources and the owner facts favour A; a stated reason for B would have changed it.",
  evidence: [],
  blast_radius: "node-local",
  confidence: "high",
  would_have_asked: false,
  stop_class: null,
  would_upstream: false,
  ...more,
});

const decide = (dir, step, decision, { by = "orchestrator", type } = {}) => {
  const r = cli(dir, "decide.mjs", ["--step", step, "--by", by, ...(type ? ["--type", type] : []), "--stdin"], { input: JSON.stringify(decision) });
  return /^(DEC-\d{3,}) at /m.exec(r.stdout)[1];
};

// ---------- run.yaml edits a setup or plan step makes (one key per line, as the test helper writes it) ----------

const setKey = (dir, key, value) => {
  const text = read(dir, "hsdd/auto/run.yaml");
  const line = `${key}: ${formatFlow(value)}`;
  const re = new RegExp(`^${key}:.*$`, "m");
  put(dir, "hsdd/auto/run.yaml", re.test(text) ? text.replace(re, line) : text.replace(/^segments:/m, `${line}\nsegments:`));
};

// An owner fact appended to a block sequence `owner_facts:` after its last item, or to a one-line list.
const appendFact = (dir, fact) => {
  const lines = read(dir, "hsdd/auto/run.yaml").split("\n");
  const at = lines.findIndex((l) => /^owner_facts:/.test(l));
  if (lines[at].replace(/#.*$/, "").trim() !== "owner_facts:") {
    setKey(dir, "owner_facts", [...parseYaml(lines.join("\n")).owner_facts, fact]);
    return;
  }
  let end = at + 1;
  while (end < lines.length && /^\s+-/.test(lines[end])) end++;
  lines.splice(end, 0, `  - ${formatScalar(fact)}`);
  put(dir, "hsdd/auto/run.yaml", lines.join("\n"));
};

// ---------- orchestrator actions (chapter 8) ----------

// 8.1 item 4: state.mjs open-segment with the owner's instruction in a file outside the repository.
const openSegment = (dir, { mode, instruction, request, authority, stopPolicy } = {}) => {
  const args = [
    "open-segment", "--instruction-file", outside("instruction.md", `${instruction}\n`),
    ...(mode ? ["--mode", mode] : []), ...(request ? ["--request", request] : []),
    ...(authority ? ["--authority", authority] : []), ...(stopPolicy ? ["--stop-policy", stopPolicy] : []),
  ];
  return JSON.parse(cli(dir, "state.mjs", args).stdout.split("\n")[0]);
};

const commitStep = (dir, step, status = "completed", extra = []) => cli(dir, "commit.mjs", ["--step", step, "--status", status, ...extra]).stdout;

// 8.1 item 5. `owner` is an answer to STOP.md: recorded --by owner, STOP.md removed, and `ownerFact`
// appended to owner_facts when the answer is one an owner fact carries. `before(step)` makes the
// configuration changes the decisions record.
const runSetup = (dir, seg, { decisions = [], owner = null, ownerFact = null, before = null, adapter = false } = {}) => {
  assert.equal(nextOf(dir).step?.kind, "setup");
  const out = cli(dir, "dispatch.mjs", ["--next"]).stdout.trim().split("\n");
  const step = seg.first_step;
  assert.deepEqual(out, [`hsdd/auto/dispatch/${step}.md`], "an orchestrator step prints only its dispatch path");
  cli(dir, "state.mjs", ["install-scripts"]);
  cli(dir, "state.mjs", ["snapshot"]);
  if (adapter) {
    cli(dir, "adapter.mjs", ["install"]);
    cli(dir, "adapter.mjs", ["check"]);
  }
  const ids = {};
  if (owner) {
    ids.owner = decide(dir, step, owner, { by: "owner", type: "setup" });
    rmSync(join(dir, "hsdd/judgement/STOP.md"));
    if (ownerFact) {
      appendFact(dir, ownerFact);
      ids.ownerFact = decide(dir, step, dec("Carry the owner's axis answer as an owner fact so the continuation's skill finds it answered?", {
        artifact: "hsdd/auto/run.yaml", evidence: [ids.owner],
      }));
    }
  }
  before?.(step, ids);
  for (const d of decisions) decide(dir, step, d);
  commitStep(dir, step);
  return { step, ids };
};

// 8.1 item 6: the segment's paragraph at the end of ## Segments, opening with **{segment id}.** (S-5),
// with the stages next.mjs --stages prints; `items` are queue items the orchestrator opens.
const runPlanStep = (dir, seg, { purpose, items = [] } = {}) => {
  assert.equal(nextOf(dir).step?.kind, "plan");
  const [path] = cli(dir, "dispatch.mjs", ["--next"]).stdout.trim().split("\n");
  const step = /(S\d{2,})\.md$/.exec(path)[1];
  const stages = JSON.parse(cli(dir, "next.mjs", ["--stages"]).stdout);
  const paragraph = [
    `**${seg.id}.** ${purpose}`,
    // plan.md is the orchestrator's prose, checked by D1, so it points at the instruction rather than quoting it.
    `Mode ${seg.mode}, stop policy ${seg.stop_policy}; the owner's instruction is the segment's entry in hsdd/auto/run.yaml.`,
    `Stages: ${stages.map((s) => `${s.n} ${s.name} (${s.done ? "done" : "to do"})`).join(", ")}.`,
  ].join(" ");
  const plan = read(dir, "hsdd/auto/plan.md");
  put(dir, "hsdd/auto/plan.md", plan.replace(/\n*(## Step log)/, `\n\n${paragraph}\n\n$1`));
  for (const it of items) {
    cli(dir, "routed.mjs", ["open", "--from", step, "--target", it.target, "--kind", it.kind, "--text", it.text]);
  }
  commitStep(dir, step);
  return { step };
};

const LAUNCH = (step) => [
  `You are step ${step} of an unattended HSDD run. Your complete instructions are`,
  `in hsdd/auto/dispatch/${step}.md. Read the whole file first, then follow it exactly.`,
];

// 8.1's subagent loop, first half: dispatch.mjs --next, then the launch (the stand-in plays the subagent).
const launch = (dir, plan, expect = {}) => {
  const n = nextOf(dir);
  assert.ok(n.step, `next.mjs returned ${JSON.stringify(n)}, not a step`);
  for (const [k, v] of Object.entries(expect)) assert.equal(n.step[k], v, `next step ${k}: ${JSON.stringify(n.step)}`);
  const out = cli(dir, "dispatch.mjs", ["--next"]).stdout.trimEnd().split("\n");
  const step = /(S\d{2,})\.md$/.exec(out[0])[1];
  assert.deepEqual(out.slice(1), ["", ...LAUNCH(step)], "dispatch.mjs prints the path, a blank line and the launch prompt (spec 10.3)");
  standIn(dir, step, plan);
  return step;
};

// 6.9: a change-log entry, opening with the id of the decision that made the change. plan.md is in every
// step's judgement set, and the change log is its last section.
const changeLog = (dir, decision, text) => {
  const plan = read(dir, "hsdd/auto/plan.md");
  put(dir, "hsdd/auto/plan.md", `${plan.replace(/\s*$/, "")}\n${/## Change log$/.test(plan.trimEnd()) ? "\n" : ""}- ${decision}: ${text}\n`);
};

// 8.5: ingest the report's routed items, then accept or reject each insert-step item it opened (8.7),
// with a change-log entry naming the decision.
const review = (dir, step, { accept = true } = {}) => {
  cli(dir, "routed.mjs", ["ingest", "--step", step]);
  for (const it of itemsFrom(dir, step, "insert-step")) {
    const id = decide(dir, step, dec(`Accept the insert-step ${it.id} (${it.step_kind} on ${it.step_target}) routed by ${step}?`, {
      options: [{ label: "accept", consequence: "the step runs before the stage rule" }, { label: "reject", consequence: "the finding is deferred" }],
      chosen: accept ? "accept" : "reject", evidence: [it.id],
    }));
    cli(dir, "routed.mjs", ["decide", it.id, accept ? "--accepted" : "--rejected", "--decision", id]);
    changeLog(dir, id, `${accept ? "accepted" : "rejected"} insert-step ${it.id}, ${it.step_kind} on ${it.step_target}, routed by ${step}`);
  }
};

// A stand-in plan may carry `then(dir, step)`, the orchestrator's own handling of the hand-back,
// `accept: false` to reject the insert-step items it routes, and `commitArgs`, extra commit.mjs
// arguments (the host's model and usage).
const runStep = (dir, plan, expect) => {
  const step = launch(dir, plan, expect);
  if (plan.then) return plan.then(dir, step) ?? step;
  review(dir, step, { accept: plan.accept ?? true });
  commitStep(dir, step, "completed", plan.commitArgs ?? []);
  return step;
};

// 10.3 --plan: an orchestrator plan step outside the stage order, opened for `forReason` with next.mjs's
// result in its body; `act(step)` records its decisions and queue events; `note` goes on its run line.
const planStep = (dir, forReason, result, act, { note, status = "completed" } = {}) => {
  const args = ["--plan", "--for", forReason, ...(result ? ["--result-file", outside("result.json", JSON.stringify(result))] : [])];
  const out = cli(dir, "dispatch.mjs", args).stdout.trim().split("\n");
  assert.equal(out.length, 1, "an orchestrator step prints only its dispatch path");
  const step = /(S\d{2,})\.md$/.exec(out[0])[1];
  assert.match(read(dir, out[0]), new RegExp(`^for: ${forReason}$`, "m"));
  act(step);
  commitStep(dir, step, status, note ? ["--note", note] : []);
  return step;
};

// 10.2 `close`: an open item on `run` or the request path, closed in a plan step by a recorded decision.
const closeItem = (dir, result) => planStep(dir, "close", result, (step) => {
  const item = queue(dir).find((l) => l.id === result.close.item);
  const id = decide(dir, step, dec(`${item.id} (${item.kind} on ${item.target}): ${item.text} Address it or explain it?`, {
    options: [{ label: "explain", consequence: "no step can change the request; the finding is recorded" }, { label: "address", consequence: "a step would have to change a read-only source" }],
    chosen: "explain", evidence: [item.id],
  }));
  cli(dir, "routed.mjs", ["close", item.id, "--explained", "--by", step, "--note", `read-only request; decided in ${id}`]);
});

// 8.3 item 1: the read check passes before any stop handling.
const checkRead = (dir, step) => cli(dir, "gate.mjs", ["--step", step, "--check", "B1,B5"]);
// The stop of the step's latest report: {step}.r{n}.json with the highest n, else {step}.json.
const stopOf = (dir, step) => {
  const rank = (n) => Number(new RegExp(`^${step}(?:\\.r(\\d+))?\\.json$`).exec(n)?.[1] ?? 0);
  const reports = readdirSync(join(dir, "hsdd/auto/steps")).filter((n) => new RegExp(`^${step}(\\.r\\d+)?\\.json$`).test(n)).sort((a, b) => rank(a) - rank(b));
  return JSON.parse(read(dir, `hsdd/auto/steps/${reports.at(-1)}`)).stop;
};

// 6.7's shape, from the stopped report.
const stopText = (step, seg, front, { stop_class: stopClass, question, options, recommendation, blocks }) => [
  `# Run stopped at ${step}`,
  "",
  `- **Segment:** ${seg.id}`,
  `- **Stop class:** ${stopClass}`,
  `- **Step:** ${step} (${front.kind}, ${front.skill} on ${front.target})`,
  "",
  "## Question",
  question,
  "",
  "## Options",
  ...options.map((o) => `- **${o.label}**${o.label === recommendation ? " (recommended)" : ""}: ${o.consequence}`),
  "",
  "## What it blocks",
  blocks,
  "",
  "## How to resume",
  "Answer in one message, then run `/hsdd-auto`. The answer opens a new segment",
  "and is recorded as its owner's decision. For a stopped subagent step a",
  "continuation of the same kind and target is dispatched with it; for a stopped",
  "`plan` step the new segment's `plan` step turns the answer into steps (§8.3).",
  "",
].join("\n");

// 8.3 case A: end the run. STOP.md, then the stopped commit.
const stopCaseA = (dir, step, seg) => {
  checkRead(dir, step);
  review(dir, step);
  put(dir, "hsdd/judgement/STOP.md", stopText(step, seg, readDispatchFile(dir, step).front, stopOf(dir, step)));
  commitStep(dir, step, "stopped");
};

// 8.3 case B: answer as the owner's stand-in, resume the same subagent, review, commit.
const stopCaseB = (dir, step, resumePlan) => {
  checkRead(dir, step);
  review(dir, step);
  const stop = stopOf(dir, step);
  const id = decide(dir, step, dec(stop.question, {
    options: stop.options, chosen: stop.recommendation, would_have_asked: true, stop_class: stop.stop_class,
    why: `Answered as the owner's stand-in under decide-and-record: ${stop.recommendation} keeps every existing id; a source naming the other party would have changed it.`,
  }));
  cli(dir, "dispatch.mjs", ["--resume", step, "--reason", "answer", "--message-file", outside("answer.md", `The answer is ${stop.recommendation} (${id}).\n`)]);
  standIn(dir, step, resumePlan);
  review(dir, step);
  commitStep(dir, step);
  return id;
};

// 8.3 case C: supply the missing input. A plan decision, the insert-step item accepted citing it, then
// the stopped commit, so the decision and the queue events share the judgement commit.
const stopCaseC = (dir, step) => {
  checkRead(dir, step);
  cli(dir, "routed.mjs", ["ingest", "--step", step]);
  const [it] = itemsFrom(dir, step, "insert-step");
  assert.ok(it, `${step}'s report routes the insert-step that supplies the missing input`);
  const id = decide(dir, step, dec(`${step} stopped for a missing input; insert ${it.step_kind} on ${it.step_target} to supply it?`, {
    options: [{ label: "insert", consequence: "the inserted step supplies the input, then the continuation runs" }, { label: "stop", consequence: "the owner supplies it" }],
    chosen: "insert", evidence: [it.id],
  }));
  cli(dir, "routed.mjs", ["decide", it.id, "--accepted", "--decision", id]);
  changeLog(dir, id, `inserted ${it.step_kind} on ${it.step_target} (${it.id}) before the continuation of ${step}`);
  commitStep(dir, step, "stopped");
  return { item: it.id, decision: id };
};

// 8.10: the report step. report.mjs, the prose slots filled, report.mjs once more, then the commit
// (which runs the final gate) and state.mjs done.
const SLOT = /(<!-- slot:([a-z_]+) -->)\s*(<!-- \/slot -->)/g;
const finishSegment = (dir, seg, { crashAt = null } = {}) => {
  const n = nextOf(dir);
  assert.equal(n.step?.kind, "report", `next.mjs returned ${JSON.stringify(n)}`);
  const [path] = cli(dir, "dispatch.mjs", ["--next"]).stdout.trim().split("\n");
  const step = /(S\d{2,})\.md$/.exec(path)[1];
  cli(dir, "report.mjs", ["--segment", seg.id]);
  const rel = `hsdd/auto/report/${seg.id}.md`;
  put(dir, rel, read(dir, rel).replace(SLOT, (_, open, name, close) => `${open}\nThe ${name.replace(/_/g, " ")} of ${seg.id}, written by the orchestrator.\n${close}`));
  cli(dir, "report.mjs", ["--segment", seg.id]);
  if (crashAt) assert.equal(commitStepPhases(dir, { step, status: "completed" }, { stopAfter: crashAt }).stoppedAfter, crashAt);
  commitStep(dir, step);
  assert.equal(cli(dir, "state.mjs", ["done"]).stdout.trim().split("\n").at(-1), `DONE ${seg.id}`);
  return step;
};

// The loop (8.1 item 7) until done, blocked or stuck: each step result runs the stand-in plan keyed
// "{kind} {target}" (a list is used in order), a skip is committed, a close is handled in a plan step,
// the report step finishes.
const drive = (dir, seg, plans) => {
  const queues = Object.fromEntries(Object.entries(plans).map(([k, v]) => [k, [].concat(v)]));
  for (let i = 0; i < 40; i++) {
    const n = nextOf(dir);
    if (n.stuck) return n;
    if (n.done || n.blocked) {
      const unused = Object.entries(queues).filter(([, q]) => q.length > 0).map(([k]) => k);
      assert.deepEqual(unused, [], "every stand-in plan given to drive is used");
      return n;
    }
    if (n.skip) { cli(dir, "commit.mjs", ["--skip", n.skip.handoff, "--reason", n.skip.reason]); continue; }
    if (n.close) { closeItem(dir, n); continue; }
    if (n.step?.kind === "report") { finishSegment(dir, seg); continue; }
    assert.ok(n.step, `next.mjs returned ${JSON.stringify(n)}`);
    const key = `${n.step.kind} ${n.step.target}`;
    const plan = queues[key]?.shift();
    assert.ok(plan !== undefined, `no stand-in plan for ${key} (${n.step.why})`);
    runStep(dir, plan);
  }
  throw new Error("drive: no end after 40 results");
};

// ---------- the planning chain the fixture overlays describe (stage 00 to 06) ----------

const PENDING_WEB = [
  "## Governance updates (pending reconcile)",
  "",
  "> Emitted by hsdd-phase-plan. Drained by hsdd-reconcile; do not apply by hand.",
  "",
  "- confirm `order-api@v1` consumers: [shop.web.app.1, shop.web.app.2]",
  "  - both storefront phases replay the order-api fixtures",
  "",
].join("\n");
const DRAINED = "## Governance updates (pending reconcile)\n\n> Reconciled by hsdd-reconcile. Drained entries are in git history.\n";
const webPlanWithPending = () => readFileSync(join(FIXTURES, "tree/06-planned/hsdd/spec/shop.web.app.md"), "utf8")
  .replace(/## Governance updates \(pending reconcile\)[\s\S]*$/, PENDING_WEB);

const chain = () => ({
  "root-spec shop": {
    overlay: "01-root",
    decisions: [dec("Which axis splits the shop at the root?", { artifact: "hsdd/spec/shop.md", evidence: ["Spec §4"], blast_radius: "tree" })],
  },
  "adr ADR-001": { overlay: "02-adrs", decisions: [dec("How are order ids minted?", { artifact: "hsdd/adr/001-order-ids.md", evidence: ["Spec §2"] })] },
  "contract order-api": {
    overlay: "03-contracts",
    decisions: [dec("Which validation format does order-api use?", { artifact: "hsdd/contract/order-api.md", blast_radius: "contract" })],
  },
  "mid-level-spec shop.web": { overlay: "04-mid", decisions: [dec("Does shop.web split into more than one app?", { artifact: "hsdd/spec/shop.web.md", evidence: ["Spec §3"] })] },
  "phase-plan shop.api": { overlay: "05-phase-api", decisions: [dec("Which phase produces order-api?", { artifact: "hsdd/spec/shop.api.md" })] },
  "reconcile shop.api": {
    files: {
      "hsdd/spec/shop.api.md": { from: "06-planned/hsdd/spec/shop.api.md" },
      "hsdd/contract/order-api.md": edit("produced_by: [shop.api.1]", "produced_by: [shop.api.2]"),
    },
    regen: true,
    decisions: [dec("Confirm order-api@v1 produced_by shop.api.2?", { artifact: "hsdd/contract/order-api.md", blast_radius: "contract" })],
  },
  "phase-plan shop.web.app": { files: { "hsdd/spec/shop.web.app.md": webPlanWithPending() }, decisions: [dec("Does the order client come first?", { artifact: "hsdd/spec/shop.web.app.md" })] },
  "reconcile shop.web.app": {
    files: {
      "hsdd/spec/shop.web.app.md": { from: "06-planned/hsdd/spec/shop.web.app.md" },
      "hsdd/contract/order-api.md": { from: "06-planned/hsdd/contract/order-api.md" },
    },
    regen: true,
    decisions: [dec("Finalize order-api's phase ids now that both nodes are planned?", { artifact: "hsdd/contract/order-api.md", blast_radius: "contract" })],
  },
  "align all": { notes: ["every plan cites only current versions"] },
});

// A plan-mode repository at a fixture stage whose run configuration points skills_dir at a complete
// installation (the six planning skills with `## Unattended runs`).
const repoAt = (stage, over = {}) => makeRepo({ stage, config: baseConfig({ skills_dir: completeSkills(), ...over }) });

// ---------- assertions shared by the scenarios ----------

const subjects = (dir) => gitIn(dir, "log", "--reverse", "--format=%s", "main..HEAD").split("\n").filter(Boolean);

// Two commits per step: the artifact commit, then `judgement: {step}`, in run-log order; skips are one commit.
const assertTwoCommitsPerStep = (dir) => {
  const lines = committedSteps(dir);
  const steps = subjects(dir).filter((s) => !/^auto: skip H/.test(s));
  assert.equal(steps.length, 2 * lines.length, `two commits per step:\n${steps.join("\n")}`);
  lines.forEach((l, i) => {
    assert.match(steps[2 * i], new RegExp(`^(hsdd|auto): ${l.step_ref} ${l.kind}[ :]`), `artifact commit of ${l.step_ref}`);
    assert.equal(steps[2 * i + 1], `judgement: ${l.step_ref}`);
    assert.equal(gitIn(dir, "log", "-1", "--format=%s", l.commit).startsWith(steps[2 * i]), true);
  });
};

// The ledger validates, every dispatch file is committed, and the tree is clean apart from `dirty`, the
// owner files the owner keeps uncommitted.
const assertRecordsComplete = (dir, { dirty = [] } = {}) => {
  cli(dir, "ledger.mjs", ["validate"]);
  for (const l of committedSteps(dir)) gitIn(dir, "cat-file", "-e", `HEAD:hsdd/auto/dispatch/${l.step_ref}.md`);
  assert.deepEqual(gitIn(dir, "status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean), dirty, "the run ends with a clean tree apart from the owner files");
};

// ---------- the scenarios ----------

const TRAILER = "Co-Authored-By: Test Agent <agent@example.invalid>";
const OWNER_FILE = "notes/owner.md";

test("plan, decide-and-record: stage 00 to done", () => {
  // An uncommitted owner file, a commit trailer, and spec 5.4's prose rules at level error: none of them
  // may stop the run, and the owner file reaches no commit. run.yaml holds the banned character and
  // phrase literally, and so does the owner's instruction, which run.yaml keeps verbatim (D1 exempts the
  // owner's configuration files).
  const dir = repoAt("00-empty", {
    owner_files: [OWNER_FILE], commit: { trailers: [TRAILER] },
    prose_rules: { banned_chars: ["\u2014"], banned_phrases: ["leverage"], token_forms: { empty_cell: "none", id_separator: ":", reason_separator: " - " }, level: "error" },
  });
  assert.match(read(dir, "hsdd/auto/run.yaml"), /\u2014/);
  assert.match(read(dir, "hsdd/auto/run.yaml"), /leverage/);
  put(dir, OWNER_FILE, "The owner's notes, uncommitted.\n");
  const seg = openSegment(dir, { mode: "plan", instruction: "Plan the shop from scratch through reconcile \u2014 leverage the spec. Do not ask me anything; record the decisions.", stopPolicy: "decide-and-record" });
  assert.equal(seg.first_step, "S00");
  runSetup(dir, seg, {
    decisions: [dec("The owner asked not to be asked: which stop policy does this segment run under?", {
      options: [{ label: "decide-and-record", consequence: "the orchestrator answers stops and records them" }, { label: "stop", consequence: "the run ends on each stop" }],
      chosen: "decide-and-record", evidence: ["hsdd/auto/run.yaml"], why: "The instruction says: Do not ask me anything; record the decisions.",
    })],
  });
  assert.deepEqual(Object.keys(JSON.parse(read(dir, "hsdd/auto/owner-files.json"))), [OWNER_FILE]);
  runPlanStep(dir, seg, { purpose: "Plan the shop's tree from an empty repository through reconcile." });

  // The mid-level step meets a shape stop; under decide-and-record the orchestrator answers it (case B)
  // and resumes the same subagent, which finishes the decomposition.
  const shape = {
    status: "stopped",
    question: "Does shop.web hold one storefront app or a storefront and a staff app?",
    skill_rule: "hsdd-spec asks the human when two decompositions are both defensible.",
    stop_class: "shape",
    options: [
      { label: "One storefront app", consequence: "one leaf-parent, shop.web.app; a staff app is grafted later" },
      { label: "Storefront and staff apps", consequence: "two leaf-parents and a second consumer of order-api" },
    ],
    recommendation: "One storefront app",
    blocks: "mid-level-spec on shop.web",
  };
  const plans = chain();
  const usage = outside("usage.json", JSON.stringify({ input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }));
  plans["root-spec shop"].commitArgs = ["--model", "claude-opus-5-5", "--usage-file", usage];
  let answered = null;
  plans["mid-level-spec shop.web"] = { stop: shape, then: (d, step) => { answered = { step, id: stopCaseB(d, step, chain()["mid-level-spec shop.web"]) }; } };
  // An experiment settles a runtime fact the contract step's decision cites (7.5).
  const probe = "hsdd/auto/experiments/order-schema";
  plans["contract order-api"] = {
    ...plans["contract order-api"],
    files: { [`${probe}/README.md`]: "The order-api schema accepts the create-order fixture.\n", [`${probe}/output.txt`]: "valid\n" },
    experiments: [{ path: `${probe}/`, question: "Does the schema accept the create-order fixture?", finding: "It does." }],
    decisions: [dec("Which validation format does order-api use?", { artifact: "hsdd/contract/order-api.md", blast_radius: "contract", evidence: [`${probe}/`] })],
  };
  // A read outside the read set is a B4 warning the orchestrator records as a plan decision (7.4).
  let outsideRead = null;
  plans["phase-plan shop.api"] = {
    ...plans["phase-plan shop.api"],
    reads_outside: [{ path: "hsdd/spec/shop.web.app.md", why: "checked how the consumer names the contract" }],
    then: (d, step) => {
      review(d, step);
      assert.match(cli(d, "gate.mjs", ["--step", step]).stdout, /^warn {2}B4 hsdd\/spec\/shop\.web\.app\.md was read outside the step's read set/m);
      outsideRead = decide(d, step, dec(`${step} read hsdd/spec/shop.web.app.md outside its read set: keep its output or rework it?`, {
        options: [{ label: "keep", consequence: "the plan stands; the read named a contract only" }, { label: "rework", consequence: "a fresh plan without the read" }],
        chosen: "keep", evidence: [step],
      }));
      commitStep(d, step);
    },
  };
  // The align routes an insert-step the orchestrator rejects: a deferred finding with its decision (8.7).
  plans["align all"] = {
    ...plans["align all"],
    accept: false,
    routed: [{ target: "run", kind: "insert-step", text: "Graft a staff app beside the storefront", step_kind: "graft", step_target: "shop.web" }],
  };
  assert.deepEqual(drive(dir, seg, plans), { done: true });

  assert.equal(cli(dir, "state.mjs", ["done"]).stdout.trim(), `DONE ${seg.id}`);
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir, { dirty: [`?? ${OWNER_FILE}`] });
  const lines = committedSteps(dir);
  assert.deepEqual(lines.map((l) => `${l.step_ref} ${l.kind} ${l.target}`), [
    `S00 setup ${seg.id}`, `S01 plan ${seg.id}`, "S02 root-spec shop", "S03 adr ADR-001", "S04 contract order-api",
    "S05 mid-level-spec shop.web", "S06 phase-plan shop.api", "S07 reconcile shop.api", "S08 phase-plan shop.web.app",
    "S09 reconcile shop.web.app", "S10 align all", `S11 report ${seg.id}`,
  ]);
  // Every decision is in the ledger with its step's artifact commit; the stop's answer is listed first.
  const ledger = jsonl(dir, "hsdd/judgement/decisions.jsonl");
  assert.equal(ledger.length, 12, "one setup decision, one per stand-in step but the align, the stop's answer, the outside read and the rejection");
  for (const d of ledger) assert.equal(d.commit, lines.find((l) => l.step_ref === d.step_ref).commit);
  const answer = ledger.find((d) => d.id === answered.id);
  assert.deepEqual([answer.step_ref, answer.by, answer.step, answer.would_have_asked, answer.stop_class], ["S05", "orchestrator", "plan", true, "shape"]);
  assert.deepEqual(readDispatchFile(dir, "S05").front.launches.map((l) => l.reason), ["initial", "resume-answer"]);
  // The host's model and usage reach the run line; the trailer is on every commit; the owner file on none.
  const root = lines.find((l) => l.step_ref === "S02");
  assert.equal(root.model, "claude-opus-5-5");
  assert.equal(root.usage.output_tokens, 340);
  for (const body of gitIn(dir, "log", "--format=%B%x00", "main..HEAD").split("\0").map((b) => b.trim()).filter(Boolean)) {
    assert.ok(body.endsWith(TRAILER), `a commit without the trailer:\n${body}`);
  }
  assert.equal(gitIn(dir, "log", "--format=%h", "--", OWNER_FILE), "");
  // The report's prose slots are filled, and it lists the stop's answer first.
  const report = read(dir, `hsdd/auto/report/${seg.id}.md`);
  assert.doesNotMatch(report, /<!-- slot:[a-z_]+ -->\s*<!-- \/slot -->/);
  assert.match(report, new RegExp(`## Decisions to look at first\\n\\n\\| Decision \\| Step \\| Question \\| Chosen \\|\\n\\| --- \\| --- \\| --- \\| --- \\|\\n\\| ${answered.id} \\| S05 plan \\|`));
  assert.match(report, /S05 was resumed at .* for an answer/);
  assert.match(report, /^\| hsdd\/auto\/experiments\/order-schema \| Does the schema accept the create-order fixture\? \| The order-api schema accepts the create-order fixture\. \|$/m);
  assert.match(report, /^- S06 read hsdd\/spec\/shop\.web\.app\.md outside its read set: checked how the consumer names the contract$/m);
  assert.match(report, /^\| insert-step, rejected \| Q-001 \| S10 \| graft on shop\.web \| Graft a staff app beside the storefront \(rejected by DEC-\d+\) \|$/m);
  gitIn(dir, "cat-file", "-e", `${lines.find((l) => l.step_ref === "S04").commit}:${probe}/output.txt`);
  assert.ok(ledger.some((d) => d.id === outsideRead && d.step_ref === "S06" && d.by === "orchestrator"));
  // The change log keeps its entries across every step-log regeneration.
  const rejection = queue(dir).find((l) => l.id === "Q-001" && l.status === "rejected").decision;
  assert.match(read(dir, "hsdd/auto/plan.md"), new RegExp(`## Change log\\n\\n- ${rejection}: rejected insert-step Q-001, graft on shop.web, routed by S10\\n$`));
});

test("bundled copy: after the setup step hsdd/scripts/auto/ is byte-identical to the skill's scripts", () => {
  const dir = repoAt("00-empty", { out_of_bounds: ["notes/private"] });
  const seg = openSegment(dir, { mode: "plan", instruction: "Plan the shop." });
  const { step } = runSetup(dir, seg, { adapter: true });
  const files = (root, rel = "") => readdirSync(join(root, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(root, rel === "" ? e.name : `${rel}/${e.name}`) : [rel === "" ? e.name : `${rel}/${e.name}`])).sort();
  const copy = join(dir, "hsdd/scripts/auto");
  assert.deepEqual(files(copy), files(SCRIPTS));
  for (const f of files(SCRIPTS)) assert.ok(readFileSync(join(copy, f)).equals(readFileSync(join(SCRIPTS, f))), `${f} differs`);
  const setup = committedSteps(dir).find((l) => l.step_ref === step).commit;
  for (const f of ["hsdd/scripts/auto/VERSION", "hsdd/scripts/auto/lib/yaml.mjs", ".claude/settings.json", ".claude/agents/hsdd-auto-step.md", "hsdd/auto/adapter.json"]) {
    gitIn(dir, "cat-file", "-e", `${setup}:${f}`);
  }
  assert.equal(gitIn(dir, "status", "--porcelain"), "");

  // The adapter's Bash hook, run as the host runs it from .claude/settings.json, over the copy: the
  // step's decide command passes; an out-of-bounds read and a subagent's git write are refused.
  const settings = JSON.parse(read(dir, ".claude/settings.json"));
  const command = settings.hooks.PreToolUse.find((e) => e.matcher === "Bash").hooks[0].command;
  const hook = (cmd) => spawnSync("sh", ["-c", command], {
    cwd: dir, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: cmd }, cwd: dir, agent_id: "a1", agent_type: "hsdd-auto-step" }),
  });
  assert.equal(hook("node hsdd/scripts/auto/decide.mjs --step S02 --stdin").status, 0);
  const read1 = hook("cat notes/private/key.txt");
  assert.equal(read1.status, 2);
  assert.match(read1.stderr, /notes\/private/);
  assert.equal(hook("git commit -m x").status, 2);

  // The run goes on with the adapter's files committed.
  runPlanStep(dir, seg, { purpose: "Plan the shop with the adapter installed." });
  runStep(dir, chain()["root-spec shop"], { kind: "root-spec", target: "shop" });
  cli(dir, "adapter.mjs", ["check"]);
  assertTwoCommitsPerStep(dir);
});

test("plan, stop: an axis stop ends the run, the owner's answer opens a segment, the continuation runs to done", () => {
  const spec = readFileSync(join(FIXTURES, "tree/00-empty/ref/spec.md"), "utf8").replace("- One team builds both the order API and the web app.\n", "");
  // The owner's hand-written run.yaml: comments, block style, a quoted string with `: ` and `#`
  // (Review Focus 1). Every script reads it; the segment appends and the setup's edit keep its lines.
  const owned = [
    "# The shop's run, written by its owner.",
    "version: 1",
    "run: shop",
    "branch: auto/shop   # the run branch",
    "base: main",
    `skills_dir: ${completeSkills()}`,
    "owner_facts:",
    "  - \"Totals are integers in cents: no floating point anywhere (#money).\"",
    "sources:",
    "  normative:",
    "    - path: ref/spec.md",
    "      cite: Spec",
    "      version: v1",
    "read_only: [ref/]   # every source path",
    "stop_policy: stop",
    "segments:   # appended by hsdd-auto",
    "",
  ].join("\n");
  const dir = makeRepo({ stage: "00-empty", files: { "ref/spec.md": spec, "hsdd/auto/run.yaml": owned } });
  const seg = openSegment(dir, { mode: "plan", instruction: "Plan the shop from scratch through reconcile." });
  assert.equal(seg.stop_policy, "stop");
  runSetup(dir, seg);
  runPlanStep(dir, seg, { purpose: "Plan the shop's tree from an empty repository through reconcile." });

  const axis = {
    status: "stopped",
    question: "Who builds what?",
    skill_rule: "hsdd-spec asks who builds what before it picks the decomposition axis.",
    stop_class: "axis",
    options: [
      { label: "One team", consequence: "the root splits by deploy target, the API and the web app" },
      { label: "Two teams", consequence: "the root splits by team ownership, with a contract on each team edge" },
    ],
    recommendation: "One team",
    blocks: "root-spec on shop, and every step after it",
  };
  const root = launch(dir, { files: { "hsdd/conventions.md": { from: "01-root/hsdd/conventions.md" } }, stop: axis }, { kind: "root-spec", target: "shop" });
  stopCaseA(dir, root, seg);
  assert.deepEqual(nextOf(dir), { blocked: "hsdd/judgement/STOP.md" });
  assert.equal(cli(dir, "state.mjs", ["done"]).stdout.trim(), `STOPPED ${seg.id}: hsdd/judgement/STOP.md`);
  const status = cli(dir, "state.mjs").stdout;
  assert.match(status, /^stop: class axis, see hsdd\/judgement\/STOP\.md$/m);
  assert.match(status, /^next: \{"blocked":"hsdd\/judgement\/STOP\.md"\}$/m);
  assert.match(cli(dir, "state.mjs", ["goal"]).stdout, new RegExp(`STOPPED ${seg.id}: hsdd/judgement/STOP\\.md`));
  assert.equal(gitIn(dir, "status", "--porcelain"), "", "the run ends with a clean tree");
  assert.equal(committedSteps(dir).at(-1).status, "stopped");
  assert.match(gitIn(dir, "log", "-2", "--format=%s"), new RegExp(`^judgement: ${root}\\nhsdd: ${root} root-spec shop: .* \\(stopped\\)$`));

  // The owner answers; /hsdd-auto opens a new segment of the stopped one's mode.
  const answer = "One team builds both the order API and the web app.";
  const seg2 = openSegment(dir, { instruction: answer });
  assert.equal(seg2.mode, "plan");
  assert.match(seg2.id, /^\d{4}-\d{2}-\d{2}-plan(-2)?$/, "the next plan segment id, -2 on the same day (spec 5.5)");
  assert.notEqual(seg2.id, seg.id);
  const { step: setup2, ids } = runSetup(dir, seg2, {
    owner: dec("Who builds what?", {
      options: axis.options, chosen: "One team", evidence: [root, "hsdd/judgement/STOP.md"], why: `The owner answered STOP.md of ${root}: "${answer}"`,
    }),
    ownerFact: `Who builds what: ${answer}`,
  });
  assert.equal(existsSync(join(dir, "hsdd/judgement/STOP.md")), false);
  assert.deepEqual(sidecar(dir, setup2).map((d) => d.id), [ids.owner, ids.ownerFact]);
  const ownerDecision = jsonl(dir, "hsdd/judgement/decisions.jsonl").find((d) => d.id === ids.owner);
  assert.equal(ownerDecision.by, "owner");
  assert.equal(ownerDecision.step, "setup");
  assert.match(read(dir, "hsdd/auto/run.yaml"), /Who builds what: One team builds both/);
  runPlanStep(dir, seg2, { purpose: "Continue the plan from the owner's answer to the axis stop." });

  const n = nextOf(dir);
  assert.equal(n.step.continues, root);
  assert.equal(n.step.kind, "root-spec");
  const plans = chain();
  const cont = launch(dir, plans["root-spec shop"], { kind: "root-spec", continues: root });
  const continuing = read(dir, `hsdd/auto/dispatch/${cont}.md`);
  assert.match(continuing, new RegExp(`Stopped step: ${root}`));
  assert.match(continuing, new RegExp(`Decision on its stop: ${ids.owner}, chosen "One team" \\(by owner\\)`));
  review(dir, cont);
  commitStep(dir, cont);
  delete plans["root-spec shop"];
  assert.deepEqual(drive(dir, seg2, plans), { done: true });

  assert.equal(committedSteps(dir).find((l) => l.step_ref === cont).continues, root);
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
  assert.match(read(dir, `hsdd/auto/report/${seg2.id}.md`), new RegExp(`also covers segment ${seg.id}`));
  // The owner's lines survive two segment appends and the setup's edit, in order and byte for byte.
  const final = read(dir, "hsdd/auto/run.yaml").split("\n");
  const lost = owned.split("\n").reduce(({ at, missing }, line) => {
    const i = final.indexOf(line, at);
    return i < 0 ? { at, missing: [...missing, line] } : { at: i + 1, missing };
  }, { at: 0, missing: [] }).missing;
  assert.deepEqual(lost, [], `the owner's run.yaml lines are kept in order:\n${final.join("\n")}`);
  assert.deepEqual(parseYaml(final.join("\n")).segments.map((x) => x.id), [seg.id, seg2.id]);
});

test("procedural stop: an unminted open question inserts a spec-touch, then the continuation finishes the plan", () => {
  const dir = repoAt("05-phase-api");
  const seg = openSegment(dir, { mode: "plan", instruction: "Finish the phase plans." });
  runSetup(dir, seg);
  runPlanStep(dir, seg, { purpose: "Finish the shop's phase plans and reconcile them." });
  const plans = chain();
  runStep(dir, plans["reconcile shop.api"], { kind: "reconcile", target: "shop.api" });

  // The phase plan needs OQ-F1, which no spec defines: hsdd-phase-plan stops for it (procedural).
  const partial = readFileSync(join(FIXTURES, "tree/06-planned/hsdd/spec/shop.web.app.md"), "utf8")
    .replace("handles the 422 case", "handles the 422 case and retries a timed-out create as OQ-F1 decides");
  const web = launch(dir, {
    files: { "hsdd/spec/shop.web.app.md": partial },
    stop: {
      status: "stopped",
      question: "Phase shop.web.app.2 depends on open question OQ-F1, which is not minted in any spec.",
      skill_rule: "hsdd-phase-plan stops when a phase cites an open-question id that no spec defines.",
      stop_class: "procedural",
      options: [{ label: "mint OQ-F1 in shop.web.app", consequence: "a spec-touch defines the question, then the plan cites it" }],
      recommendation: "mint OQ-F1 in shop.web.app",
      blocks: "the shop.web.app phase plan",
    },
    routed: [{ target: "run", kind: "insert-step", text: "Mint OQ-F1 (does checkout retry a timed-out create?) in shop.web.app's spec", step_kind: "spec-touch", step_target: "shop.web.app" }],
  }, { kind: "phase-plan", target: "shop.web.app" });
  const { item } = stopCaseC(dir, web);
  assert.equal(committedSteps(dir).at(-1).status, "stopped");
  const queued = queue(dir).filter((l) => l.id === item).map((l) => l.status);
  assert.deepEqual(queued, ["open", "accepted"], "the decision and the queue events land in the stopped step's judgement commit");
  gitIn(dir, "diff", "--quiet", "HEAD", "--", "hsdd/auto/queue.jsonl");

  // The inserted step runs first, then the continuation.
  const oq = [
    "## Open questions", "",
    "| ID | Question | Status | Waits on | Affects |", "|----|----------|--------|----------|---------|",
    "| OQ-F1 | Does checkout retry a create that timed out? | OPEN | ext: product owner | shop.web.app |", "",
    "### OQ-F1: Checkout retry", "", "Until it is answered, checkout shows the error and never retries.", "",
  ].join("\n");
  const touch = runStep(dir, {
    files: { "hsdd/spec/shop.web.app.md": (old) => old.replace("## Phase Plan", `${oq}\n## Phase Plan`) },
    decisions: [dec("Which node owns the checkout retry question?", { artifact: "hsdd/spec/shop.web.app.md" })],
  }, { kind: "spec-touch", target: "shop.web.app", queue_item: item });
  assert.equal(queue(dir).filter((l) => l.id === item).at(-1).status, "addressed");
  const cont = runStep(dir, {
    files: { "hsdd/spec/shop.web.app.md": (old) => old.replace(/## Governance updates \(pending reconcile\)[\s\S]*$/, PENDING_WEB) },
    decisions: [dec("Does shop.web.app.2 wait on OQ-F1?", { artifact: "hsdd/spec/shop.web.app.md" })],
  }, { kind: "phase-plan", target: "shop.web.app", continues: web });
  // The reconcile drains the pending section but leaves order-api draft: after the align no stage rule
  // can make progress and the done condition fails (stuck, 8.10).
  const final = readFileSync(join(FIXTURES, "tree/06-planned/hsdd/contract/order-api.md"), "utf8");
  const stuck = drive(dir, seg, {
    "reconcile shop.web.app": {
      ...plans["reconcile shop.web.app"],
      files: {
        "hsdd/spec/shop.web.app.md": (old) => old.replace(/## Governance updates \(pending reconcile\)[\s\S]*$/, DRAINED),
        "hsdd/contract/order-api.md": () => final.replace("status: stable", "status: draft"),
      },
    },
    "align all": plans["align all"],
  });
  assert.ok(stuck.stuck.includes("contract order-api is draft"), JSON.stringify(stuck));
  // 8.10: a plan step names each unmet condition in a decision and routes it to an accepted insert-step.
  let fix = null;
  const unstick = planStep(dir, "stuck", stuck, (step) => {
    const id = decide(dir, step, dec(`Stuck: ${stuck.stuck.join("; ")}. Which step fixes it?`, {
      options: [{ label: "contract-touch on order-api", consequence: "the contract becomes stable" }, { label: "stop", consequence: "a hard stop under shape" }],
      chosen: "contract-touch on order-api", evidence: ["hsdd/contract/order-api.md"],
    }));
    cli(dir, "routed.mjs", ["open", "--from", step, "--target", "run", "--kind", "insert-step", "--text", "Mark order-api stable: both nodes are planned and its phase ids are final", "--step-kind", "contract-touch", "--step-target", "order-api"]);
    fix = itemsFrom(dir, step, "insert-step")[0].id;
    cli(dir, "routed.mjs", ["decide", fix, "--accepted", "--decision", id]);
    changeLog(dir, id, `inserted contract-touch on order-api (${fix}): the segment was stuck on a draft contract`);
  });
  assert.equal(committedSteps(dir).at(-1).step_ref, unstick);
  assert.deepEqual(drive(dir, seg, {
    "contract-touch order-api": { files: { "hsdd/contract/order-api.md": { from: "06-planned/hsdd/contract/order-api.md" } }, regen: true },
    "align all": plans["align all"],
  }), { done: true });
  assert.equal(queue(dir).filter((l) => l.id === fix).at(-1).status, "addressed");

  const lines = committedSteps(dir);
  assert.equal(lines.find((l) => l.step_ref === cont).continues, web);
  assert.ok(lines.findIndex((l) => l.step_ref === touch) < lines.findIndex((l) => l.step_ref === cont));
  assert.match(read(dir, "hsdd/spec/shop.web.app.md"), /### OQ-F1: Checkout retry/);
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
});

// ---------- the intake (spec 9.2, 9.3, 12.2) ----------

// A request path with spaces, capitals and non-ASCII letters (Review Focus 4).
const REQUEST = "ref/Spec V2 \u00dcn\u00efcode.md";
const SPEC_V2 = readFileSync(join(FIXTURES, "tree/00-empty/ref/spec.md"), "utf8")
  .replace("Version: v1.", "Version: v2.")
  .replace("the total in cents", "the total as a money object (amount in cents and a currency, IDR or USD)");

const PROMPTS = {
  H1: "Touch order-api: Spec v2 §2 adds a currency to every order; retyping total_cents is breaking, so author order-api@v2 with a migration note",
  H2: `Touch shop.web.app: Spec v2 §3 shows the currency of every total; cite order-api@v2 and ${REQUEST}`,
  H3a: "citation touch hsdd/spec/shop.web.app.md: move its citations to the current versions",
  H3b: "citation touch hsdd/spec/shop.api.md: move its citations to the current versions",
};

const intakeRecord = () => {
  const handoffs = [
    { id: "H1", kind: "contract-touch", skill: "hsdd-contract", target: "order-api", prompt: PROMPTS.H1, when: null, after: [] },
    { id: "H2", kind: "spec-touch", skill: "hsdd-spec", target: "shop.web.app", prompt: PROMPTS.H2, when: null, after: ["H1"] },
    { id: "H3a", kind: "citation-touch", skill: "hsdd-spec", target: "shop.web.app", prompt: PROMPTS.H3a, when: "cites-superseded", after: ["H2"] },
    { id: "H3b", kind: "citation-touch", skill: "hsdd-spec", target: "shop.api", prompt: PROMPTS.H3b, when: "cites-superseded", after: ["H1"] },
  ];
  return [
    "# Intake: Order API v2, a currency on every order", "",
    "- **Date:** 2026-10-23",
    `- **Request:** ${REQUEST} (accepted-rfc)`,
    "- **Class:** cross-node",
    "- **Lands on:** [shop.api, shop.web.app] · **Contracts:** [order-api]",
    "- **Promotes:** none", "- **Collisions:** none", "- **Status:** open", "",
    "## Request", "",
    `Spec v2 (${REQUEST} §2) adds a currency to every order: \`total_cents\` becomes a`,
    "`total` money object. The storefront shows the currency (§3).", "",
    "## Routing", "",
    "Class `cross-node`: the change lands on shop.api, which produces order-api, and on",
    "shop.web.app, which consumes it. Every artifact that may still cite order-api@v1 is",
    "then touched once, by its owning skill, when it still cites a superseded version.", "",
    "Handoffs, in order:", "",
    `1. H1, hsdd-contract: \`${PROMPTS.H1}\``,
    `2. H2, hsdd-spec: \`${PROMPTS.H2}\``,
    `3. H3a, hsdd-spec, only when the file still cites a superseded version: \`${PROMPTS.H3a}\``,
    `4. H3b, hsdd-spec, only when the file still cites a superseded version: \`${PROMPTS.H3b}\``, "",
    "```hsdd-handoffs",
    JSON.stringify({ version: 1, handoffs }, null, 2),
    "```", "",
    "## Produced", "",
    "## Change log", "",
    "- 2026-10-23: created, routed cross-node", "",
  ].join("\n");
};

const contractV2 = (old) => old
  .replace("version: v1", "version: v2")
  .replace("`Order` is `{ \"id\", \"customer_id\", \"lines\", \"total_cents\", \"status\", \"created_at\" }`",
    "`Order` is `{ \"id\", \"customer_id\", \"lines\", \"total\", \"status\", \"created_at\" }`, where `total` is `{ \"amount_cents\", \"currency\" }`")
  .replace(/- v1 current\.[\s\S]*?migrate\./, "- v2 current. v1 is superseded: `total_cents` became `total`, a money object;\n  migration note: read `total.amount_cents` where v1 read `total_cents`.");

const citesCurrent = (old) => old.replaceAll("order-api@v1", "order-api@v2").replaceAll("ref/spec.md", REQUEST);

test("intake: handoffs run or skip by their condition under a predecided breaking-amend, and ## Produced gains order-api@v2", () => {
  // A pre-existing defect in a file the intake never touches: an open-question id defined nowhere
  // (Review Focus 3). It stays a warning in every gate and in the done definition.
  const shop = readFileSync(join(FIXTURES, "tree/04-mid/hsdd/spec/shop.md"), "utf8").replace("axis is the deploy target, not team ownership.", "axis is the deploy target, not team ownership. Refunds are open (OQ7).");
  const dir = makeRepo({ stage: "06-planned", config: baseConfig({ skills_dir: completeSkills() }), files: { [REQUEST]: SPEC_V2, "hsdd/spec/shop.md": shop } });
  // An instruction with quotes, `#`, `: ` and a newline round-trips through run.yaml (Review Focus 4).
  const instruction = "Take in \"Spec V2\" as normative: #1 priority.\nDo not ask me anything, but record the decisions.";
  const seg = openSegment(dir, { mode: "intake", request: REQUEST, authority: "accepted-rfc", stopPolicy: "decide-and-record", instruction });
  assert.equal(seg.id.replace(/^\d{4}-\d{2}-\d{2}-/, ""), "intake-spec-v2-n-code");
  assert.equal(parseYaml(read(dir, "hsdd/auto/run.yaml")).segments.at(-1).instruction, instruction);
  let predecided;
  runSetup(dir, seg, {
    before: (step) => {
      // 9.3: the new version becomes normative and the old one moves to the baseline, both recorded.
      setKey(dir, "sources", { normative: [{ path: REQUEST, cite: "Spec", version: "v2" }], baseline: [{ path: "ref/spec.md", cite: "Spec", version: "v1" }] });
      decide(dir, step, dec("The instruction says to take in Spec v2 as normative: which sources does the run read?", {
        artifact: "hsdd/auto/run.yaml", evidence: [REQUEST], blast_radius: "tree",
        options: [{ label: "v2 normative, v1 baseline", consequence: "citations move to v2; v1 is read only to see what changed" }, { label: "both normative", consequence: "two specs bind and contradict" }],
        chosen: "v2 normative, v1 baseline",
      }));
      // 8.4: the change breaks a stable contract, so the segment will meet breaking-amend; decided once.
      predecided = decide(dir, step, dec("A breaking change to a stable contract: how is it versioned?", {
        options: [{ label: "next version", consequence: "the contract takes v2 with a migration note; consumers move by citation touches" }, { label: "new contract", consequence: "a second contract beside the first" }],
        chosen: "next version", would_have_asked: true, stop_class: "breaking-amend", blast_radius: "contract", evidence: ["Spec §2", "hsdd/contract/order-api.md"],
      }));
      setKey(dir, "predecided", { "breaking-amend": { answer: "A breaking change to a stable contract takes the next version with a migration note.", decision: predecided } });
    },
  });
  runPlanStep(dir, seg, { purpose: "Take Spec v2's currency into the planned tree." });

  const intake = runStep(dir, {
    files: { "hsdd/management/2026-10-23-intake-order-v2.md": intakeRecord() },
    decisions: [
      dec("Which class is the request?", { artifact: "hsdd/management/2026-10-23-intake-order-v2.md", chosen: "A" }),
      dec("Spec v2 §3 names no display format for an amount in a currency: which one does the tree assume?", {
        artifact: "hsdd/management/2026-10-23-intake-order-v2.md", chosen: "A", would_upstream: true, blast_radius: "upstream", confidence: "medium", evidence: ["Spec §3"],
      }),
    ],
    routed: [{ target: REQUEST, kind: "consider", text: "Spec v2 §3 does not say how the storefront formats an amount in a currency." }],
  }, { kind: "intake", target: REQUEST });
  const upstream = cli(dir, "state.mjs", ["upstream"]).stdout.trim().split("\n");
  assert.equal(upstream.length, 1);
  assert.match(upstream[0], new RegExp(`^DEC-\\d{3} intake \\(${intake}\\) Spec v2 §3 names no display format .* -> A$`));
  const [consider] = itemsFrom(dir, intake, "consider");

  // H1 meets breaking-amend and applies the predecided answer instead of stopping.
  const h1 = launch(dir, {
    files: { "hsdd/contract/order-api.md": contractV2 },
    regen: true,
    decisions: [dec("Retyping total_cents breaks order-api@v1: next version or a new contract?", {
      artifact: "hsdd/contract/order-api.md", options: [{ label: "next version", consequence: "order-api@v2" }, { label: "new contract", consequence: "order-money-api@v1" }],
      chosen: "next version", would_have_asked: true, stop_class: "breaking-amend", blast_radius: "contract", evidence: [predecided, "Spec §2"],
    })],
  }, { kind: "contract-touch", target: "order-api", handoff: "H1" });
  assert.match(read(dir, `hsdd/auto/dispatch/${h1}.md`), new RegExp(`- \`breaking-amend\`: A breaking change to a stable contract takes the next version with a migration note\\. \\(${predecided}\\)`));
  assert.ok(read(dir, `hsdd/auto/dispatch/${h1}.md`).includes(PROMPTS.H1), "a handoff step's invocation is the record's prompt");
  review(dir, h1);
  commitStep(dir, h1);

  assert.deepEqual(drive(dir, seg, {
    "spec-touch shop.web.app": {
      files: { "hsdd/spec/shop.web.app.md": (old) => citesCurrent(old).replace("Totals are\nshown from `total_cents` and never recomputed.", "Totals are\nshown from `total` with its currency and never recomputed.") },
      decisions: [dec("Where does the storefront show the currency?", { artifact: "hsdd/spec/shop.web.app.md" })],
    },
    "citation-touch shop.api": { files: { "hsdd/spec/shop.api.md": citesCurrent } },
    "align shop.api,shop.web.app": { notes: ["both plans cite only current versions"] },
  }), { done: true });

  const reportText = read(dir, `hsdd/auto/report/${seg.id}.md`);
  assert.match(/## Upstream\n([\s\S]*?)\n### Earlier proposals/.exec(reportText)[1], /Spec v2 §3 names no display format/);

  // The consider item on the request path came back as `close` and was closed in a plan step.
  const closing = queue(dir).filter((l) => l.id === consider.id);
  assert.deepEqual(closing.map((l) => l.status), ["open", "explained"]);
  const closer = committedSteps(dir).find((l) => l.step_ref === closing[1].by);
  assert.equal(closer.kind, "plan");
  assert.match(read(dir, `hsdd/auto/dispatch/${closer.step_ref}.md`), new RegExp(`"item": "${consider.id}"`));

  // H3a was skipped by its condition (H2 already moved the file's citations); H3b ran.
  const skips = jsonl(dir, "hsdd/auto/handoffs.jsonl");
  assert.deepEqual(skips.map((l) => [l.handoff, l.status]), [["H3a", "skipped"]]);
  assert.match(skips[0].reason, /cites-superseded does not hold/);
  const handoffs = stateOf(dir).intake.handoffs.map((h) => [h.id, h.state]);
  assert.deepEqual(handoffs, [["H1", "executed"], ["H2", "executed"], ["H3a", "skipped"], ["H3b", "executed"]]);
  assert.ok(subjects(dir).some((s) => /^auto: skip H3a: cites-superseded does not hold/.test(s)));

  // F2's remaining references are warnings only: the files the segment did not touch keep order-api@v1.
  const final = cli(dir, "gate.mjs", ["--final"]).stdout;
  assert.match(final, /^warn {2}F2 hsdd\/spec\/shop\.md: order-api@v1/m);
  assert.match(final, /^warn {2}C6 OQ7 is cited and defined nowhere \(hsdd\/spec\/shop\.md\); not changed in this segment$/m);
  assert.doesNotMatch(final, /^ERROR/m);
  assert.match(read(dir, `hsdd/auto/dispatch/${h1}.md`), /^> Take in "Spec V2" as normative: #1 priority\.\n> Do not ask me anything, but record the decisions\.$/m);

  // The record's ## Produced gains the bump and no phase; one change-log line names the segment.
  const record = read(dir, "hsdd/management/2026-10-23-intake-order-v2.md");
  const produced = /## Produced\n([\s\S]*?)\n## Change log/.exec(record)[1];
  assert.match(produced, /^- Contracts bumped: order-api@v2$/m);
  assert.doesNotMatch(produced, /shop\.(api|web\.app)\.\d/);
  assert.match(record, new RegExp(`hsdd-auto segment ${seg.id}: contracts bumped order-api@v2`));
  assert.equal(committedSteps(dir).find((l) => l.step_ref === intake).kind, "intake");
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
});

// ---------- rework and interruption (spec 8.6, 8.9) ----------

const ITEM_TEXT = "shop.api's Overview says OQ1 is defined in the root spec; name the section that answers it";
const overviewFix = edit("defined in the root spec).", "defined in the root spec, ## Open questions).");
const reworkDecision = (step, finding) => dec(`${step}: ${finding}. Rework it, or route it to a later step?`, {
  options: [{ label: "rework", consequence: "the same subagent fixes it now" }, { label: "route", consequence: "a later step fixes it" }],
  chosen: "rework", evidence: [step], why: `The finding is the step's own work: ${finding}`,
});
const resumeFinding = (dir, step, finding) => {
  const id = decide(dir, step, reworkDecision(step, finding));
  cli(dir, "dispatch.mjs", ["--resume", step, "--reason", "finding", "--message-file", outside("finding.md", `${finding} (${id}). Fix it.\n`)]);
  return id;
};
const otherCheck = (v) => (v === "00000000" ? "11111111" : "00000000");
const plannedWithItem = (dir, stopPolicy) => {
  const seg = openSegment(dir, { mode: "plan", instruction: "Check the planned tree once more.", stopPolicy });
  runSetup(dir, seg);
  const { step } = runPlanStep(dir, seg, {
    purpose: "Fix one finding in the planned tree, then align it.",
    items: [{ target: "shop.api", kind: "must-address", text: ITEM_TEXT }],
  });
  const [item] = queue(dir).filter((l) => l.from === step);
  return { seg, item: item.id };
};

test("rework: a report that fails B3 is resumed once and passes", () => {
  const dir = repoAt("06-planned");
  const { seg, item } = plannedWithItem(dir);
  const touch = launch(dir, { files: { "hsdd/spec/shop.api.md": overviewFix } }, { kind: "spec-touch", target: "shop.api" });
  assert.match(read(dir, `hsdd/auto/dispatch/${touch}.md`), new RegExp(`- ${item}, must-address, from S01: `));
  review(dir, touch);
  const refused = cli(dir, "commit.mjs", ["--step", touch, "--status", "completed"], { code: 1 }).stdout;
  assert.match(refused, new RegExp(`^ERROR B3 ${item} must-address from S01 on shop.api was listed for the step and is not in the closes of its reports`, "m"));
  assert.equal(committedSteps(dir).some((l) => l.step_ref === touch), false, "a refused commit commits nothing");

  resumeFinding(dir, touch, `gate B3: ${item} is not in the report's closes`);
  standIn(dir, touch, { closes: [{ id: item, outcome: "addressed", note: "the Overview now names the section" }] });
  review(dir, touch);
  commitStep(dir, touch);
  const front = readDispatchFile(dir, touch).front;
  assert.deepEqual(front.launches.map((l) => l.reason), ["initial", "resume-finding"]);
  assert.deepEqual(readdirSync(join(dir, "hsdd/auto/steps")).filter((n) => n.startsWith(`${touch}.`)).sort(),
    [`${touch}.decisions.jsonl`, `${touch}.json`, `${touch}.r1.json`]);
  assert.deepEqual(queue(dir).filter((l) => l.id === item).map((l) => [l.status, l.by ?? null]), [["open", null], ["addressed", touch]]);

  // 8.11: an owner message that changes run.yaml ends the segment in a plan step; a new segment of the
  // same mode applies the change in its setup, and its report covers the ended one.
  const message = "From now on allow two reworks per step.";
  const ending = planStep(dir, "owner", null, (step) => {
    decide(dir, step, dec(`The owner wrote: "${message}" How does the run read it, and from which step?`, {
      options: [{ label: "rework_limit 2 from the next segment", consequence: "the segment ends here; the next setup changes run.yaml" }, { label: "ignore", consequence: "the owner's instruction is lost" }],
      chosen: "rework_limit 2 from the next segment", why: `It changes run.yaml, so it ends ${seg.id} after ${touch} (spec 8.11).`,
    }));
  }, { note: "ended: owner message" });
  assert.equal(stateOf(dir).segment.ended, true);
  assert.match(nextOf(dir).stuck[0], new RegExp(`segment ${seg.id} was ended at ${ending}`));
  const seg2 = openSegment(dir, { instruction: message });
  assert.equal(seg2.mode, "plan");
  assert.match(seg2.id, /^\d{4}-\d{2}-\d{2}-plan(-2)?$/);
  runSetup(dir, seg2, {
    before: (step) => {
      setKey(dir, "rework_limit", 2);
      decide(dir, step, dec(`The owner wrote: "${message}" Set rework_limit to 2?`, {
        artifact: "hsdd/auto/run.yaml", options: [{ label: "2", consequence: "two resumes per step before gate-twice" }, { label: "1", consequence: "the default" }], chosen: "2", evidence: [ending],
      }));
    },
  });
  assert.equal(parseYaml(read(dir, "hsdd/auto/run.yaml")).rework_limit, 2);
  runPlanStep(dir, seg2, { purpose: "Align the tree under the owner's new rework limit." });
  assert.deepEqual(drive(dir, seg2, { "align all": chain()["align all"] }), { done: true });
  const report = read(dir, `hsdd/auto/report/${seg2.id}.md`);
  assert.match(report, new RegExp(`also covers segment ${seg.id}`));
  assert.match(report, new RegExp(`${touch} was resumed at .* for a finding`));
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
});

test("rework: two planted failures raise gate-twice, committed stopped, and the continuation finishes under decide-and-record", () => {
  const dir = repoAt("06-planned");
  const { seg, item } = plannedWithItem(dir, "decide-and-record");
  const closes = [{ id: item, outcome: "addressed", note: "the Overview now names the section" }];
  const touch = launch(dir, { files: { "hsdd/spec/shop.api.md": overviewFix }, closes, readCheck: otherCheck }, { kind: "spec-touch", target: "shop.api" });
  const first = cli(dir, "commit.mjs", ["--step", touch, "--status", "completed"], { code: 1 }).stdout;
  assert.match(first, /^ERROR B5 .* the subagent did not read the whole file/m);

  resumeFinding(dir, touch, "gate B5: the report's read_check is not the dispatch file's");
  standIn(dir, touch, { closes, readCheck: otherCheck });
  const second = cli(dir, "commit.mjs", ["--step", touch, "--status", "completed"], { code: 1 }).stdout;
  assert.match(second, new RegExp(`^ERROR B5 hsdd/auto/steps/${touch}\\.r1\\.json has read_check`, "m"));

  // rework_limit 1 is spent: gate-twice. Under decide-and-record the orchestrator records it, commits the
  // step stopped without a valid report, and a continuation gets the findings.
  const twice = decide(dir, touch, dec(`${touch} failed its gate twice (B5 both times): stop the run, or continue with a fresh subagent?`, {
    options: [{ label: "continue", consequence: "a continuation with a fresh subagent receives the findings" }, { label: "stop", consequence: "the owner looks first" }],
    chosen: "continue", would_have_asked: true, stop_class: "gate-twice", evidence: [touch],
    why: `Findings: "${second.split("\n").find((l) => l.startsWith("ERROR B5"))}". A fresh subagent rereads the whole file.`,
  }));
  const stopped = commitStep(dir, touch, "stopped", ["--no-report"]);
  assert.match(stopped, new RegExp(`renamed hsdd/auto/steps/${touch}\\.json -> hsdd/auto/steps/${touch}\\.invalid1\\.json`));
  const line = committedSteps(dir).at(-1);
  assert.deepEqual([line.step_ref, line.status], [touch, "stopped"]);
  assert.match(line.note, /no valid report/);
  assert.equal(queue(dir).filter((l) => l.id === item).at(-1).status, "open", "an invalid report's closes are never ingested");

  const cont = launch(dir, { closes }, { kind: "spec-touch", target: "shop.api", continues: touch });
  const prompt = read(dir, `hsdd/auto/dispatch/${cont}.md`);
  assert.match(prompt, new RegExp(`Its renamed reports, history: \`hsdd/auto/steps/${touch}\\.invalid1\\.json\`, \`hsdd/auto/steps/${touch}\\.invalid1\\.r1\\.json\``));
  assert.match(prompt, new RegExp(`Decision on its stop: ${twice}, chosen "continue" \\(by orchestrator\\)`));
  assert.match(prompt, new RegExp(`- ${item}, must-address, from S01: `));
  review(dir, cont);
  commitStep(dir, cont);
  assert.deepEqual(drive(dir, seg, { "align all": chain()["align all"] }), { done: true });
  assert.equal(committedSteps(dir).find((l) => l.step_ref === cont).continues, touch);
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
});

test("interruption: lost launches are re-dispatched under the same id, and a crash between the two commits reruns to one of each", () => {
  const dir = repoAt("06-planned");
  const { seg, item } = plannedWithItem(dir);
  const closes = [{ id: item, outcome: "addressed", note: "the Overview now names the section" }];

  // Launch 1 is lost before any report: a partial edit, one decision, and a lock its decide left behind.
  const touch = launch(dir, {
    files: { "hsdd/spec/shop.api.md": edit("keeps totals in integer cents.", "keeps totals in integer cents (Spec §4).") },
    decisions: [dec("Cite the cents constraint in shop.api's Overview?", { artifact: "hsdd/spec/shop.api.md", evidence: ["Spec §4"] })],
    noReport: true,
  }, { kind: "spec-touch", target: "shop.api" });
  put(dir, "hsdd/auto/.decide.lock", "4242\n");
  const lost = stateOf(dir).steps.in_progress;
  assert.deepEqual(lost, { step: touch, has_report: false, has_artifact_commit: false });
  assert.match(cli(dir, "state.mjs").stdout, new RegExp(`^steps: \\d+ dispatched, last ${touch}; in progress ${touch} \\(report: no, artifact commit: no\\)$`, "m"));
  assert.deepEqual(nextOf(dir), { waiting: touch });
  // 8.9: the decision already recorded is reused, never minted again; the stale lock is removed.
  assert.equal(sidecar(dir, touch).length, 1);
  rmSync(join(dir, "hsdd/auto/.decide.lock"));
  const before = readDispatchFile(dir, touch).readCheck;
  assert.deepEqual(cli(dir, "dispatch.mjs", ["--redispatch", touch]).stdout.trimEnd().split("\n"), [`hsdd/auto/dispatch/${touch}.md`, "", ...LAUNCH(touch)]);
  const again = readDispatchFile(dir, touch);
  assert.notEqual(again.readCheck, before, "a redispatch draws a new read check");
  assert.match(again.body, /## Redispatch\n\nRedispatch 1 of step/);
  assert.match(again.body, /- `hsdd\/spec\/shop\.api\.md`/);
  assert.match(again.body, new RegExp(`The decisions the lost launch recorded are in \`hsdd/auto/steps/${touch}\\.decisions\\.jsonl\``));

  // Launch 2 reports; the review sends a finding back, and the resumed subagent is lost too.
  standIn(dir, touch, { files: { "hsdd/spec/shop.api.md": overviewFix }, closes });
  review(dir, touch);
  resumeFinding(dir, touch, "review: the Overview's new citation names Spec §4 without its version");
  assert.equal(stateOf(dir).steps.in_progress.has_report, true);
  assert.deepEqual(nextOf(dir), { waiting: touch });
  cli(dir, "dispatch.mjs", ["--redispatch", touch]);
  const third = readDispatchFile(dir, touch);
  assert.deepEqual(third.front.launches.map((l) => l.reason), ["initial", "redispatch", "resume-finding", "redispatch"]);
  assert.equal(third.report, `hsdd/auto/steps/${touch}.json`, "a redispatch starts a new series at {step}.json");
  assert.ok(existsSync(join(dir, `hsdd/auto/steps/${touch}.lost2.json`)), "the lost series is renamed");
  assert.equal(existsSync(join(dir, `hsdd/auto/steps/${touch}.json`)), false);

  // Launch 3 finishes; the commit crashes right after the artifact commit and is run again.
  standIn(dir, touch, { files: { "hsdd/spec/shop.api.md": edit("(Spec §4)", "(Spec v1 §4)") }, closes });
  review(dir, touch);
  const crash = commitStepPhases(dir, { step: touch, status: "completed" }, { stopAfter: "artifact" });
  assert.equal(crash.stoppedAfter, "artifact");
  assert.equal(stateOf(dir).steps.in_progress.has_artifact_commit, true);
  assert.deepEqual(nextOf(dir), { waiting: touch });
  assert.match(commitStep(dir, touch), new RegExp(`resuming ${touch}: HEAD [0-9a-f]{7} is its artifact commit`));

  // The align crashes after its run line is appended, before the plan and the judgement commit.
  const align = launch(dir, chain()["align all"], { kind: "align", target: "all" });
  review(dir, align);
  assert.equal(commitStepPhases(dir, { step: align, status: "completed" }, { stopAfter: "run" }).stoppedAfter, "run");
  commitStep(dir, align);
  // The report step crashes after staging: the rerun unstages and starts over (8.9).
  const report = finishSegment(dir, seg, { crashAt: "stage" });

  for (const step of [touch, align, report]) {
    assert.equal(subjects(dir).filter((s) => new RegExp(`^(hsdd|auto): ${step} `).test(s)).length, 1, `one artifact commit for ${step}`);
    assert.equal(subjects(dir).filter((s) => s === `judgement: ${step}`).length, 1, `one judgement commit for ${step}`);
    assert.equal(committedSteps(dir).filter((l) => l.step_ref === step).length, 1, `one run line for ${step}`);
  }
  const ledger = jsonl(dir, "hsdd/judgement/decisions.jsonl").filter((d) => d.step_ref === touch);
  assert.equal(ledger.length, 2, "the lost launch's decision and the review's, each once");
  assert.equal(new Set(ledger.map((d) => d.id)).size, 2);
  assert.deepEqual(queue(dir).filter((l) => l.id === item).map((l) => l.status), ["open", "addressed"]);
  gitIn(dir, "cat-file", "-e", `HEAD:hsdd/auto/steps/${touch}.lost2.json`);
  assert.equal(committedSteps(dir).find((l) => l.step_ref === touch).dispatches, 4);
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
});

test("interruption: a redispatch over the size limit is a hard stop recorded in the lost step itself", () => {
  const dir = repoAt("06-planned");
  const { seg } = plannedWithItem(dir);
  // The orchestrator's context file (each line cites a path) takes the dispatch file over the 64 KiB limit:
  // refused, no id allocated; the orchestrator shortens it and runs --next again (10.3), close to the limit.
  const context = (n) => outside("context.md", `${Array.from({ length: n }, (_, i) => `- hsdd/spec/shop.api.md: context line ${String(i).padStart(3, "0")} for the touch, padded to a realistic length.`).join("\n")}\n`);
  const tooLong = cli(dir, "dispatch.mjs", ["--next", "--context-file", context(620)], { code: 1 }).stdout;
  assert.match(tooLong, /above the 65536-byte limit .* nothing written and no step id allocated\. Slot sizes, largest first:\n {2}context_lines \d+/);
  assert.deepEqual(stateOf(dir).steps.in_progress, null);
  const out = cli(dir, "dispatch.mjs", ["--next", "--context-file", context(560)]).stdout.trimEnd().split("\n");
  const touch = /(S\d{2,})\.md$/.exec(out[0])[1];
  const size = readFileSync(join(dir, out[0])).length;
  assert.ok(size > 32768 && size <= 65536, `the dispatch file is ${size} bytes`);
  // The lost launch writes enough files that the redispatch section listing them crosses the limit.
  const files = Object.fromEntries(Array.from({ length: Math.ceil((65536 - size) / 40) + 20 }, (_, i) => [`hsdd/auto/experiments/probe/case-${String(i).padStart(4, "0")}.txt`, "x\n"]));
  standIn(dir, touch, { files, noReport: true });
  const refused = cli(dir, "dispatch.mjs", ["--redispatch", touch], { code: 1 }).stdout;
  assert.match(refused, /above the 65536-byte limit .* nothing written or renamed\. This is a hard stop recorded in S\d+ itself/);
  assert.deepEqual(readDispatchFile(dir, touch).front.launches.map((l) => l.reason), ["initial"], "a refused redispatch writes nothing");

  // B-15: the orchestrator's decision in the lost step's sidecar, STOP.md, and the stopped commit without a report.
  const sizes = refused.split("\n").filter((l) => /^ {2}\S/.test(l)).join("; ");
  const id = decide(dir, touch, dec(`The redispatch of ${touch} would exceed the dispatch size limit: how does the run go on?`, {
    options: [{ label: "stop", consequence: "the owner raises the host's read limit or shortens the configuration" }, { label: "shorten", consequence: "nothing the orchestrator controls is large enough" }],
    chosen: "stop", would_have_asked: true, stop_class: "external", evidence: [touch], why: `The sizes, largest first: ${sizes}`,
  }));
  const front = readDispatchFile(dir, touch).front;
  put(dir, "hsdd/judgement/STOP.md", stopText(touch, seg, front, {
    stop_class: "external", question: `The redispatch of ${touch} would exceed the 64 KiB dispatch limit (${sizes}).`,
    options: [{ label: "raise the limit", consequence: "the host reads larger files in one call" }, { label: "shorten", consequence: "the owner shortens the configuration" }],
    recommendation: "raise the limit", blocks: `spec-touch on shop.api (${touch}) and every step after it`,
  }));
  commitStep(dir, touch, "stopped", ["--no-report", "--note", "redispatch refused: size"]);
  const line = committedSteps(dir).at(-1);
  assert.deepEqual([line.step_ref, line.status, line.note], [touch, "stopped", "redispatch refused: size; no valid report"]);
  assert.ok(jsonl(dir, "hsdd/judgement/decisions.jsonl").some((d) => d.id === id && d.stop_class === "external" && d.step_ref === touch));
  assert.deepEqual(nextOf(dir), { blocked: "hsdd/judgement/STOP.md" });
  assert.equal(cli(dir, "state.mjs", ["done"]).stdout.trim(), `STOPPED ${seg.id}: hsdd/judgement/STOP.md`);
  assertTwoCommitsPerStep(dir);
  assertRecordsComplete(dir);
});
