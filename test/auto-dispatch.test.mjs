import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_BYTES, WARN_BYTES, buildDispatch, contextErrors, dispatchContext, factLines, preambleFills, purposeOf, stepFills,
} from "../skills/hsdd-auto/scripts/dispatch.mjs";
import { selectNext } from "../skills/hsdd-auto/scripts/next.mjs";
import { lineErrors } from "../skills/hsdd-auto/scripts/routed.mjs";
import { slotNames } from "../skills/hsdd-auto/scripts/lib/render.mjs";
import { appendJsonl, nextFreeStep, readDispatch, readJsonl } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, baseConfig, fakeStep, gitIn, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, "..", "skills", "hsdd-auto", "scripts", "templates");
const ORDER = readFileSync(join(HERE, "fixtures", "auto", "intake", "2026-10-22-intake-order-v2.md"), "utf8");

const SEG = "2026-10-22-plan";
const INTAKE = "2026-10-22-intake-spec-v2";
const REQUEST = "ref/spec-v2.md";
const RECORD = "hsdd/management/2026-10-22-intake-order-v2.md";

const planSegment = (id = SEG, over = {}) => ({
  id, mode: "plan", opened_at: nowStamp(), instruction: "Plan the shop.", stop_policy: "stop", first_step: "S00", ...over,
});
const intakeSegment = (id = INTAKE, over = {}) => ({
  id, mode: "intake", opened_at: nowStamp(), instruction: "Take in ref/spec-v2.md.", stop_policy: "stop", first_step: "S00",
  request: REQUEST, authority: "accepted-rfc", ...over,
});

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const stepIn = (seg) => (dir, n, kind, target = seg, over = {}) =>
  fakeStep(dir, { step: `S${String(n).padStart(2, "0")}`, segment: seg, kind, target, ...over });
const step = stepIn(SEG);

// A plan segment at a fixture stage with its setup (S00) and plan (S01) committed.
const planRepo = (stage, { config, files } = {}) => {
  const dir = makeRepo({ stage, ...(config ? { config } : {}), ...(files ? { files } : {}) });
  addSegment(dir, planSegment());
  step(dir, 0, "setup");
  step(dir, 1, "plan");
  return dir;
};
// An intake segment on the planned tree, setup and plan committed; with `record`, its intake step (S02) too.
const intakeRepo = ({ config, record } = {}) => {
  const dir = makeRepo({ stage: "06-planned", ...(config ? { config } : {}), files: { [REQUEST]: "# Spec v2\n\nVersion: v2.\n" } });
  addSegment(dir, intakeSegment());
  const s = stepIn(INTAKE);
  s(dir, 0, "setup");
  s(dir, 1, "plan");
  if (record) s(dir, 2, "intake", REQUEST, { files: { [RECORD]: record } });
  return dir;
};

const queue = (dir, ...lines) => {
  for (const l of lines) {
    const line = { at: nowStamp(), ...l };
    assert.deepEqual(lineErrors(readJsonl(dir, P.queue), line), [], JSON.stringify(line));
    appendJsonl(dir, P.queue, line);
  }
  gitIn(dir, "add", P.queue);
  gitIn(dir, "commit", "-q", "-m", "queue");
  return dir;
};
const item = (id, kind, target, over = {}) => ({ id, status: "open", from: "S01", target, kind, text: `item ${id} on ${target}`, ...over });
const insert = (id, stepKind, stepTarget) => ({
  id, status: "open", from: "S01", target: "run", kind: "insert-step", text: `insert ${stepKind} on ${stepTarget}`, step_kind: stepKind, step_target: stepTarget,
});
const accepted = (id) => ({ id, status: "accepted", decision: "DEC-001" });
const inserted = (stepKind, stepTarget) => queue(planRepo("06-planned"), insert("Q-001", stepKind, stepTarget), accepted("Q-001"));

// One repository per subagent kind, in a state where next.mjs returns that kind.
const STATES = {
  "root-spec": () => planRepo("00-empty"),
  adr: () => planRepo("01-root"),
  contract: () => planRepo("02-adrs"),
  "mid-level-spec": () => planRepo("03-contracts"),
  "phase-plan": () => planRepo("04-mid"),
  reconcile: () => planRepo("05-phase-api"),
  align: () => planRepo("06-planned"),
  "spec-touch": () => queue(planRepo("06-planned"), item("Q-001", "consider", "shop.api")),
  "contract-touch": () => queue(planRepo("06-planned"), item("Q-001", "must-address", "order-api")),
  "adr-update": () => queue(planRepo("06-planned"), item("Q-001", "consider", "ADR-001")),
  graft: () => inserted("graft", "shop.web"),
  promote: () => inserted("promote", "shop.api"),
  "phase-plan-append": () => inserted("phase-plan-append", "shop.web.app"),
  "citation-touch": () => inserted("citation-touch", "order-api"),
  intake: () => intakeRepo(),
};

const launchPrompt = (s, path) =>
  `You are step ${s} of an unattended HSDD run. Your complete instructions are\nin ${path}. Read the whole file first, then follow it exactly.\n`;

// Dispatches the kind's state once per test file run: { dir, step, path, text, out }.
const dispatched = new Map();
const dispatchKind = (kind) => {
  if (!dispatched.has(kind)) {
    const dir = STATES[kind]();
    const next = selectNext(dispatchContext(dir));
    assert.equal(next.step?.kind, kind, `${kind}: next returned ${JSON.stringify(next)}`);
    const out = run(dir, "dispatch.mjs", ["--next"]);
    assert.equal(out.code, 0, `${kind}: ${out.stdout}${out.stderr}`);
    const path = out.stdout.split("\n")[0];
    const s = /(S\d{2,})\.md$/.exec(path)[1];
    dispatched.set(kind, { dir, step: s, path, text: read(dir, path), out });
  }
  return dispatched.get(kind);
};

const C2_SLOTS = ["step", "kind", "skill", "report", "head", "handoff_suffix", "skill_mode", "target_line", "decide_command", "write_set_list",
  "experiments_dir", "invocation", "fact_lines", "routed_lines", "predecided_lines", "continuing_lines", "context_lines"];
const C4_SLOTS = ["target", "target_file", "target_version", "proposing_spec", "reason", "record", "request", "authority"];
const PREAMBLE_SLOTS = slotNames(readFileSync(join(TEMPLATES, "preamble.md"), "utf8"));

const section = (text, heading) => text.split(`${heading}\n`)[1].split(/\n### |\n## /)[0];
const factsOf = (text) => section(text, "### Facts").split("\n").filter((l) => l.trim() !== "").slice(2).map((l) => l.replace(/^- /, ""));

// ---------- the brief's tests ----------

test("--next renders every template with no unfilled slot", () => {
  const unfilled = new RegExp(`\\{(${[...C2_SLOTS, ...C4_SLOTS, ...PREAMBLE_SLOTS].join("|")})\\}`);
  for (const kind of Object.keys(STATES)) {
    const { dir, step: s, text } = dispatchKind(kind);
    assert.ok(!unfilled.test(text), `${kind}: ${unfilled.exec(text)?.[0]} is unfilled`);
    assert.ok(!text.includes("default_invocation"), `${kind}: the default invocation comment is stripped`);
    const d = readDispatch(dir, s);
    assert.equal(d.front.kind, kind);
    assert.equal(d.front.template, `steps/${kind}.md`);
    assert.equal(d.front.skill_version, "0.11.0");
    assert.equal(d.front.report, `hsdd/auto/steps/${s}.json`);
    assert.ok(text.includes(`## Your step: ${s} (${kind}`), kind);
    assert.ok(text.includes(`\`node hsdd/scripts/auto/decide.mjs --step ${s} --stdin\``), kind);
    assert.ok(d.body.startsWith("# Step preamble\n"), kind);
  }
});

test("prints exactly §10.3's launch prompt", () => {
  const { path, out } = dispatchKind("root-spec");
  assert.equal(path, "hsdd/auto/dispatch/S02.md");
  assert.equal(out.stdout, `${path}\n\n${launchPrompt("S02", path)}`);
  assert.equal(out.stderr, "");
});

test("the read check is the last line, never in the front matter", () => {
  const { dir, step: s, text } = dispatchKind("root-spec");
  const d = readDispatch(dir, s);
  assert.match(d.readCheck, /^[0-9a-f]{8}$/);
  assert.equal(text.trimEnd().split("\n").at(-1), `read_check: ${d.readCheck}`);
  assert.ok(text.endsWith(`\nread_check: ${d.readCheck}\n`));
  assert.ok(!Object.hasOwn(d.front, "read_check"));
  const front = text.split("\n---\n")[0];
  assert.ok(!front.includes(d.readCheck), "the value is not in the front matter");
  assert.equal(text.split(d.readCheck).length, 2, "the value appears once");
});

test("--resume appends a launch and keeps the read check; --redispatch renames the series and draws a new one", () => {
  const dir = planRepo("00-empty");
  const first = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(first.code, 0, first.stdout);
  const path = "hsdd/auto/dispatch/S02.md";
  const before = readDispatch(dir, "S02");
  put(dir, "hsdd/auto/steps/S02.json", "{}\n");
  put(dir, "msg.md", "Answer: one team builds both nodes (DEC-002).\n");

  const resumed = run(dir, "dispatch.mjs", ["--resume", "S02", "--reason", "answer", "--message-file", "msg.md"]);
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.ok(resumed.stdout.includes("Answer: one team builds both nodes (DEC-002)."));
  assert.ok(resumed.stdout.includes("hsdd/auto/steps/S02.r1.json"), resumed.stdout);
  assert.ok(resumed.stdout.includes(path), "the message says the rest of the prompt holds");
  const r1 = readDispatch(dir, "S02");
  assert.equal(r1.readCheck, before.readCheck, "a resume keeps the read check");
  assert.deepEqual(r1.front.launches.map((l) => l.reason), ["initial", "resume-answer"]);
  assert.ok(r1.body.includes("## Resume 1\n"));
  assert.ok(r1.body.indexOf("## Resume 1") < r1.body.lastIndexOf("read_check:"));
  assert.ok(r1.body.includes(resumed.stdout.trimEnd()), "the section is the message sent");
  assert.ok(r1.body.startsWith(before.body.slice(0, before.body.lastIndexOf("read_check:"))), "nothing above is rewritten");

  put(dir, "hsdd/auto/steps/S02.r1.json", "{}\n");
  put(dir, "hsdd/spec/shop.md", "# shop: Shop\n");
  const re = run(dir, "dispatch.mjs", ["--redispatch", "S02"]);
  assert.equal(re.code, 0, re.stdout);
  assert.equal(re.stdout, `${path}\n\n${launchPrompt("S02", path)}`);
  const r2 = readDispatch(dir, "S02");
  assert.match(r2.readCheck, /^[0-9a-f]{8}$/);
  assert.notEqual(r2.readCheck, before.readCheck, "a redispatch draws a new read check");
  assert.deepEqual(r2.front.launches.map((l) => l.reason), ["initial", "resume-answer", "redispatch"]);
  const steps = readdirSync(join(dir, P.stepsDir)).sort();
  assert.deepEqual(steps, ["S02.lost1.json", "S02.lost1.r1.json"]);
  const redispatch = r2.body.split("## Redispatch\n")[1];
  assert.ok(redispatch.includes("`hsdd/spec/shop.md`"), "the lost launch's change is listed");
  assert.ok(redispatch.includes("`hsdd/auto/steps/S02.json`"), "the report goes to the series' first file");
  assert.ok(!redispatch.includes("`hsdd/auto/dispatch/S02.md`"), "the dispatch file itself is not a change of the launch");
  assert.ok(r2.body.indexOf("## Redispatch") > r2.body.indexOf("## Resume 1"));
  assert.equal(r2.body.trimEnd().split("\n").at(-1), `read_check: ${r2.readCheck}`);

  // A resume after the redispatch starts the fresh series' numbering again.
  const again = run(dir, "dispatch.mjs", ["--resume", "S02", "--reason", "finding", "--message-file", "msg.md"]);
  assert.equal(again.code, 0, again.stdout);
  assert.ok(again.stdout.includes("hsdd/auto/steps/S02.r1.json"), again.stdout);
  const r3 = readDispatch(dir, "S02");
  assert.equal(r3.readCheck, r2.readCheck);
  assert.deepEqual(r3.front.launches.map((l) => l.reason), ["initial", "resume-answer", "redispatch", "resume-finding"]);
});

test("predecided answers render once, in the step section", () => {
  const answer = "A breaking change to a stable contract takes the next version with a migration note.";
  const config = baseConfig({ predecided: { "breaking-amend": { answer, decision: "DEC-001" } } });
  const dir = planRepo("00-empty", { config });
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 0, out.stdout);
  const text = read(dir, "hsdd/auto/dispatch/S02.md");
  assert.equal(text.split(answer).length, 2, "the answer appears exactly once");
  const at = text.indexOf(answer);
  assert.ok(at > text.indexOf("### Predecided answers") && at < text.indexOf("### Continuing"));
  assert.ok(section(text, "### Predecided answers").includes("`breaking-amend`"));
  assert.ok(section(text, "### Predecided answers").includes("DEC-001"));
});

test("refuses a context line without a citation token", () => {
  const dir = planRepo("00-empty");
  put(dir, "ctx.md", "The contract is fine.\n");
  const out = run(dir, "dispatch.mjs", ["--next", "--context-file", "ctx.md"]);
  assert.equal(out.code, 1, out.stdout);
  assert.match(out.stdout, /ctx\.md:1\b/);
  assert.ok(out.stdout.includes("The contract is fine."));
  assert.equal(nextFreeStep(dir), "S02", "no id allocated");

  put(dir, "ctx.md", "Read hsdd/spec/shop.md first.\n\nKept from 7afa20c.\nS01 planned it; DEC-004 and Q-002 agree.\nSee Spec §2.\n");
  const ok = run(dir, "dispatch.mjs", ["--next", "--context-file", "ctx.md"]);
  assert.equal(ok.code, 0, ok.stdout);
  const ctxSection = section(read(dir, "hsdd/auto/dispatch/S02.md"), "### Context from the orchestrator");
  assert.ok(ctxSection.includes("Read hsdd/spec/shop.md first.\n\nKept from 7afa20c."), ctxSection);
  assert.ok(ctxSection.includes("See Spec §2."));
});

test("warns above 32 KiB and refuses above 64 KiB without allocating an id", () => {
  const warned = planRepo("00-empty", { config: baseConfig({ owner_facts: ["w".repeat(36000)] }) });
  const w = run(warned, "dispatch.mjs", ["--next"]);
  assert.equal(w.code, 0, w.stdout);
  const size = Buffer.byteLength(read(warned, "hsdd/auto/dispatch/S02.md"));
  assert.ok(size > WARN_BYTES && size <= MAX_BYTES, String(size));
  assert.match(w.stderr, /^warn /);
  assert.ok(w.stderr.includes(String(size)));
  const listed = w.stderr.split("\n").filter((l) => /^ {2}[a-z_]+ \d+$/.test(l));
  assert.equal(listed[0].trim().split(" ")[0], "owner_fact_lines", "largest first");
  assert.ok(w.stdout.startsWith("hsdd/auto/dispatch/S02.md\n\nYou are step S02"), "stdout stays the path and the prompt");

  const refused = planRepo("00-empty", { config: baseConfig({ owner_facts: ["r".repeat(70000)] }) });
  const r = run(refused, "dispatch.mjs", ["--next"]);
  assert.equal(r.code, 1, r.stdout);
  const lines = r.stdout.split("\n").filter((l) => /^ {2}[a-z_]+ \d+$/.test(l));
  assert.equal(lines[0].trim().split(" ")[0], "owner_fact_lines");
  const bytes = lines.map((l) => Number(l.trim().split(" ")[1]));
  assert.deepEqual(bytes, [...bytes].sort((a, b) => b - a), "largest first");
  assert.ok(!existsSync(join(refused, "hsdd/auto/dispatch/S02.md")));
  assert.equal(nextFreeStep(refused), "S02");
});

test("--resume refuses a message that crosses the limit", () => {
  const dir = planRepo("00-empty");
  assert.equal(run(dir, "dispatch.mjs", ["--next"]).code, 0);
  const before = read(dir, "hsdd/auto/dispatch/S02.md");
  put(dir, "msg.md", `${"m".repeat(MAX_BYTES)}\n`);
  const out = run(dir, "dispatch.mjs", ["--resume", "S02", "--reason", "finding", "--message-file", "msg.md"]);
  assert.equal(out.code, 1, out.stdout);
  assert.match(out.stdout, /65536/);
  assert.equal(read(dir, "hsdd/auto/dispatch/S02.md"), before, "nothing written");
});

test("{segment_context} lists at most three earlier segments", () => {
  const dir = makeRepo({ stage: "00-empty" });
  const ids = [1, 2, 3, 4, 5].map((n) => `2026-10-1${n}-plan`);
  put(dir, P.plan, `# Run plan: shop\n\n## Segments\n\n${ids.map((id, i) => `**${id}.** Purpose number ${i + 1} of the run. More text\nthat wraps.\n`).join("\n")}\n## Step log\n\n## Change log\n`);
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "-m", "plan");
  ids.forEach((id, i) => {
    addSegment(dir, planSegment(id, { first_step: `S${String(2 * i).padStart(2, "0")}` }));
    stepIn(id)(dir, 2 * i, "setup");
    stepIn(id)(dir, 2 * i + 1, "plan");
  });
  addSegment(dir, planSegment(SEG, { first_step: "S10" }));
  step(dir, 10, "setup");
  step(dir, 11, "plan");
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 0, out.stdout);
  const text = read(dir, "hsdd/auto/dispatch/S12.md");
  const context = text.split("## Inputs and limits")[0];
  assert.ok(context.includes(`This step belongs to segment ${SEG} (plan), opened `));
  assert.ok(context.includes("> Plan the shop."));
  const listed = context.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(listed.length, 4, context);
  assert.deepEqual(listed.slice(0, 3).map((l) => /`([^`]+)`/.exec(l)[1]), [ids[4], ids[3], ids[2]]);
  assert.ok(listed[0].includes("steps S08 to S09"), listed[0]);
  assert.ok(listed[0].includes("Purpose number 5 of the run."), listed[0]);
  assert.ok(!listed[0].includes("More text"), "only the first sentence");
  assert.match(listed[3], /\b2 more\b/);
  assert.ok(listed[3].includes("hsdd/auto/plan.md"));
  assert.ok(!context.includes(ids[0]) && !context.includes(ids[1]));
});

test("--plan --for writes the reason into the body", () => {
  const dir = planRepo("00-empty");
  put(dir, "result.json", JSON.stringify({ stuck: ["stage 2 Root decomposition: the root spec hsdd/spec/shop.md does not exist"] }));
  const out = run(dir, "dispatch.mjs", ["--plan", "--for", "stuck", "--result-file", "result.json"]);
  assert.equal(out.code, 0, out.stdout);
  assert.equal(out.stdout, "hsdd/auto/dispatch/S02.md\n");
  const d = readDispatch(dir, "S02");
  assert.equal(d.front.kind, "plan");
  assert.equal(d.front.skill, "none");
  assert.equal(d.front.target, SEG);
  assert.equal(d.front.report, null);
  assert.equal(d.front.template, null);
  assert.deepEqual(d.front.launches, []);
  assert.ok(d.front.write_set.includes(P.plan));
  assert.equal(d.readCheck, null, "an orchestrator step has no read check");
  assert.ok(d.body.startsWith("for: stuck\n"), d.body);
  const fenced = /```json\n([\s\S]*?)\n```/.exec(d.body);
  assert.deepEqual(JSON.parse(fenced[1]), { stuck: ["stage 2 Root decomposition: the root spec hsdd/spec/shop.md does not exist"] });

  const bare = planRepo("00-empty");
  assert.equal(run(bare, "dispatch.mjs", ["--plan", "--for", "owner"]).code, 0);
  assert.equal(readDispatch(bare, "S02").body, "for: owner\n");
  assert.equal(run(bare, "dispatch.mjs", ["--plan", "--for", "lunch"]).code, 2, "an unknown --for is a usage error");
});

test("--next refuses a non-step result", () => {
  const dir = planRepo("00-empty");
  openStep(dir, { step: "S02", segment: SEG, kind: "root-spec", target: "shop" });
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 1, out.stdout);
  assert.match(out.stdout, /waiting/);
  assert.equal(nextFreeStep(dir), "S03", "no id allocated");
  assert.ok(!existsSync(join(dir, "hsdd/auto/dispatch/S03.md")));
});

test("setup allocates exactly first_step", () => {
  const dir = makeRepo({ stage: "00-empty" });
  addSegment(dir, planSegment());
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 0, out.stdout);
  assert.equal(out.stdout, "hsdd/auto/dispatch/S00.md\n", "an orchestrator step prints only the path");
  const d = readDispatch(dir, "S00");
  assert.equal(d.front.kind, "setup");
  assert.equal(d.front.skill, "none");
  assert.equal(d.body, "");
  assert.deepEqual(d.front.launches, []);

  const off = makeRepo({ stage: "00-empty" });
  addSegment(off, planSegment(SEG, { first_step: "S03" }));
  const r = run(off, "dispatch.mjs", ["--next"]);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stdout, /S03/);
  assert.match(r.stdout, /S00/);
  assert.equal(nextFreeStep(off), "S00");
});

const FACT = / \(([^()]+\/[^()]+)\)$/;
const EXPECTED_FACTS = {
  "root-spec": ["`ref/spec.md`: normative, version v1, authority absent (hsdd/auto/run.yaml)", "`hsdd/conventions.md` does not exist yet (hsdd/conventions.md)"],
  adr: ["(hsdd/spec/shop.api.md)", "cites ADR-001"],
  contract: ["`shop.api` **Produces:** [order-api@v1] (hsdd/spec/shop.api.md)", "`shop.web` **Consumes:** [order-api@v1] (hsdd/spec/shop.web.md)",
    "`ADR-001` (accepted) affects `order-api@v1` (hsdd/adr/001-order-ids.md)", "`order-api` has no contract file yet"],
  "mid-level-spec": ["`shop.web` **Kind:** internal (hsdd/spec/shop.web.md)", "Parent `shop` embeds `shop.web` under `### shop.web: Web App` (hsdd/spec/shop.md)",
    "Consumes `order-api@v1`: version v1, status draft, phase_ids provisional (hsdd/contract/order-api.md)"],
  "phase-plan": ["`shop.api` **Owns:** order storage, order id minting, the order endpoints (hsdd/spec/shop.api.md)",
    "**Ordering policy:** interfaces-first (hsdd/conventions.md)", "**Coding method:** openspec (hsdd/conventions.md)", "**Teams:** single-team (hsdd/conventions.md)",
    "Governed by `ADR-001`: status accepted (hsdd/adr/001-order-ids.md)"],
  reconcile: ["`shop.api` pending section: 1 entry (1 confirm) (hsdd/spec/shop.api.md)"],
  align: ["No phase has a verification doc on main (main:hsdd/verify)"],
  "contract-touch": ["`order-api` front matter `version: v1` (hsdd/contract/order-api.md)", "Breaking: removing or retyping a field",
    "`order-api` validation schema `hsdd/contract/schema/order-api.schema.json` exists (hsdd/contract/order-api.md)"],
  "citation-touch": ["`order-api` is at v1 (hsdd/contract/order-api.md)", "Superseded string `order-api@v0`: order-api is at v1 (hsdd/contract/order-api.md)",
    "Source `Spec` (`ref/spec.md`): normative, version v1 (hsdd/auto/run.yaml)"],
  "phase-plan-append": ["`shop.web.app` has phases shop.web.app.1, shop.web.app.2 (hsdd/spec/shop.web.app.md)",
    "No intake record: this plan segment's step comes from the insert-step item Q-001 (hsdd/auto/queue.jsonl)"],
  promote: ["`shop.api` has no `## Observed surface` section (hsdd/spec/shop.api.md)"],
  graft: ["Child `shop.web.app` of `shop.web`: leaf-parent, spec file hsdd/spec/shop.web.app.md (hsdd/spec/shop.web.md)"],
  intake: ["Request `ref/spec-v2.md`, authority accepted-rfc (hsdd/auto/run.yaml)", "Node `shop.api`: leaf-parent, Order API (hsdd/spec/shop.api.md)",
    "0 earlier decisions carry would_upstream: true; `node hsdd/scripts/auto/state.mjs upstream` lists them (hsdd/judgement/decisions.jsonl)"],
};

test("facts end in the path they were read from", () => {
  for (const kind of Object.keys(STATES)) {
    const { text } = dispatchKind(kind);
    const facts = factsOf(text);
    assert.ok(facts.length > 0, kind);
    for (const line of facts) assert.match(line, FACT, `${kind}: ${line}`);
    for (const want of EXPECTED_FACTS[kind] ?? []) assert.ok(facts.some((l) => l.includes(want)), `${kind}: no fact contains ${want}\n${facts.join("\n")}`);
  }
});

// ---------- further cases ----------

test("--plan and --next refuse on an ended segment", () => {
  const dir = planRepo("00-empty");
  step(dir, 2, "plan", SEG, { note: "ended: owner message" });
  for (const args of [["--next"], ["--plan", "--for", "owner"]]) {
    const out = run(dir, "dispatch.mjs", args);
    assert.equal(out.code, 1, `${args}: ${out.stdout}`);
    assert.match(out.stdout, /open-segment/);
  }
  assert.equal(nextFreeStep(dir), "S03");
});

test("--plan refuses while a step is open, and before the segment's setup is committed", () => {
  const open = planRepo("00-empty");
  openStep(open, { step: "S02", segment: SEG, kind: "root-spec", target: "shop" });
  const r = run(open, "dispatch.mjs", ["--plan", "--for", "other"]);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stdout, /S02/);
  assert.equal(nextFreeStep(open), "S03");

  const fresh = makeRepo({ stage: "00-empty" });
  addSegment(fresh, planSegment());
  const f = run(fresh, "dispatch.mjs", ["--plan", "--for", "owner"]);
  assert.equal(f.code, 1, f.stdout);
  assert.match(f.stdout, /first_step S00/);
});

test("an intake handoff's invocation is its prompt verbatim, and the header names the record", () => {
  const dir = intakeRepo({ record: ORDER });
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 0, out.stdout);
  const text = read(dir, "hsdd/auto/dispatch/S03.md");
  assert.ok(text.includes(`## Your step: S03 (contract-touch, handoff H1 of ${RECORD})`));
  const prompt = "Touch order-api: Spec v2 §2 adds a currency to every order; retyping total_cents is breaking, so author order-api@v2 with a migration note";
  assert.equal(section(text, "### Invocation").trim(), prompt);
  assert.equal(readDispatch(dir, "S03").front.handoff, "H1");
});

test("a default invocation renders the instruction slots", () => {
  const inv = (kind) => section(dispatchKind(kind).text, "### Invocation").trim();
  assert.equal(inv("root-spec"), "Decompose the system into its root node, `shop`, from the normative sources and the owner facts.");
  assert.equal(inv("adr"), "Materialize `ADR-001` as `hsdd/spec/shop.md` proposes it.");
  assert.equal(inv("contract"), "Author `order-api@v1`.");
  assert.equal(inv("spec-touch"), "Touch `shop.api`: item Q-001 on shop.api.");
  assert.equal(inv("graft"), "Graft under `shop.web` the child this step's routed item or handoff names: insert graft on shop.web.");
  assert.equal(inv("phase-plan-append"), "Append phases to `shop.web.app` per the insert-step item Q-001.");
  assert.equal(inv("citation-touch"), "Citation touch `hsdd/contract/order-api.md`: move its citations to the current versions.");
  assert.equal(inv("align"), "Align all after the consistency pass.");
  assert.equal(inv("intake"), "Route `ref/spec-v2.md` (accepted-rfc) into the tree.");
});

test("routed items are listed by id, and the step section names the skill mode", () => {
  const { text } = dispatchKind("contract-touch");
  assert.equal(section(text, "### Routed to this step").trim(), "- Q-001, must-address, from S01: item Q-001 on order-api");
  assert.ok(dispatchKind("phase-plan-append").text.includes("- **Skill:** `hsdd-phase-plan` in append mode."));
  assert.ok(dispatchKind("citation-touch").text.includes("- **Skill:** `hsdd-contract`. Invoke"));
  assert.equal(section(dispatchKind("root-spec").text, "### Routed to this step").trim(), "none");
});

test("a continuation lists the stopped step's reports, commit and decisions", () => {
  const dir = planRepo("00-empty");
  put(dir, "hsdd/auto/steps/S02.json", "{}\n");
  const decision = {
    id: "DEC-001", at: nowStamp(), segment: SEG, step: "plan", step_ref: "S02", by: "orchestrator", artifact: null,
    question: "Who builds what?", options: [{ label: "one team", consequence: "a" }, { label: "two teams", consequence: "b" }],
    chosen: "one team", why: "owner fact", evidence: [], blast_radius: "tree", confidence: "high",
    would_have_asked: true, stop_class: "axis", would_upstream: false, commit: "0000000",
  };
  appendJsonl(dir, P.ledger, decision);
  const { commit } = step(dir, 2, "root-spec", "shop", { status: "stopped" });
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 0, out.stdout);
  const d = readDispatch(dir, "S03");
  assert.equal(d.front.continues, "S02");
  const cont = section(d.text, "### Continuing");
  assert.ok(cont.includes("S02"), cont);
  assert.ok(cont.includes("`hsdd/auto/dispatch/S02.md`"), cont);
  assert.ok(cont.includes("`hsdd/auto/steps/S02.json`"), cont);
  assert.ok(cont.includes(commit), cont);
  assert.ok(cont.includes("DEC-001, chosen \"one team\""), cont);
  assert.ok(cont.includes("Finish the work from where it stopped; its partial artifacts are committed."));
});

test("owner text renders verbatim, braces included", () => {
  const config = baseConfig({ owner_facts: ["Specs live at hsdd/spec/{node}.md and {{name}} stays doubled."] });
  const dir = planRepo("00-empty", { config });
  const out = run(dir, "dispatch.mjs", ["--next"]);
  assert.equal(out.code, 0, out.stdout);
  assert.ok(read(dir, "hsdd/auto/dispatch/S02.md").includes("- Specs live at hsdd/spec/{node}.md and {{name}} stays doubled."));
});

test("prose rules name banned characters by code point, never the character", () => {
  const config = baseConfig({
    prose_rules: { banned_chars: ["\u2014", "\u2026"], banned_phrases: ["leverage"], token_forms: { empty_cell: "none", id_separator: ":" } },
  });
  const dir = planRepo("00-empty", { config });
  assert.equal(run(dir, "dispatch.mjs", ["--next"]).code, 0);
  const text = read(dir, "hsdd/auto/dispatch/S02.md");
  const rules = text.split("- **Prose rules for everything you write.** ")[1].split("\n- **Citations.**")[0];
  assert.ok(rules.includes("U+2014 EM DASH"), rules);
  assert.ok(rules.includes("U+2026."), rules);
  assert.ok(rules.includes("\"leverage\""), rules);
  assert.ok(rules.includes("`none` for an empty table cell or list"), rules);
  assert.ok(rules.includes("`:` between an id and its title in a heading"), rules);
  assert.ok(!text.includes("\u2014") && !text.includes("\u2026"), "the characters themselves never appear");
});

test("the preamble's slots come from run.yaml and the segment", () => {
  const config = baseConfig({
    out_of_bounds: ["~/tmp"], read_only: ["ref/"], owner_files: ["NOTES.md"], preferences: ["Functional-first."],
    toolchain: { commands: { node: "node" }, rules: ["Never install globally."] }, stop_set: ["shape", "external"], stop_policy: "decide-and-record",
    sources: { normative: [{ path: "ref/spec.md", cite: "Spec", version: "v2" }], baseline: [{ path: "ref/old.md", cite: "Spec", version: "v1" }] },
  });
  const dir = makeRepo({ stage: "00-empty", config, files: { "ref/old.md": "# old\n", "NOTES.md": "notes\n" } });
  addSegment(dir, planSegment(SEG, { stop_policy: "decide-and-record" }));
  const f = preambleFills(dispatchContext(dir));
  assert.equal(f.branch, "auto/shop");
  assert.equal(f.out_of_bounds_lines, "- `~/tmp`");
  assert.equal(f.read_only_list, "`ref/`");
  assert.equal(f.owner_file_list, "`NOTES.md`");
  assert.equal(f.owner_fact_lines, "- One team builds the shop.");
  assert.equal(f.preference_lines, "- Functional-first.");
  assert.equal(f.toolchain_lines, "Never install globally. Use exactly these command prefixes: `node`: `node`.");
  assert.equal(f.stop_set_lines.split("\n").length, 2);
  assert.ok(f.stop_set_lines.startsWith("- `shape`: The two leading options"));
  assert.ok(f.policy_paragraph.startsWith("The owner asked not to be asked in this segment."));
  assert.ok(f.source_lines.includes("- `ref/old.md`: baseline, read only to see what changed, cited as `Spec`, version v1, authority absent;"));
  assert.ok(f.citation_lines.includes("`Spec v1 §3.4`"), f.citation_lines);
  assert.equal(f.prose_rule_lines, "none");
  assert.equal(f.segment_context, `This step belongs to segment ${SEG} (plan), opened ${dispatchContext(dir).segment.opened_at} by the owner's instruction:\n\n> Plan the shop.`);
});

test("buildDispatch is a pure function of the snapshot", () => {
  const { dir } = dispatchKind("contract-touch");
  const ctx = dispatchContext(dir);
  const next = { ...readDispatch(dir, "S02").front, inputs: [], why: "test" };
  const args = { step: "S09", head: "abcdef0", renderedAt: "2026-10-22T10:00:00Z", readCheck: "0123abcd", contextLines: ["See S01."] };
  const a = buildDispatch(ctx, next, args);
  const b = buildDispatch(ctx, next, args);
  assert.equal(a.text, b.text);
  assert.equal(a.front.step_ref, "S09");
  assert.deepEqual(a.front.launches, [{ at: "2026-10-22T10:00:00Z", reason: "initial" }]);
  assert.ok(a.text.endsWith("\nread_check: 0123abcd\n"));
  assert.ok(a.text.includes("See S01."));
  assert.deepEqual(a.sizes.map((s) => s.bytes), [...a.sizes.map((s) => s.bytes)].sort((x, y) => y - x));
  assert.deepEqual(factLines(ctx, next), factsOf(a.text).map((l) => l));
  assert.equal(stepFills(ctx, next, { step: "S09", head: "abcdef0" }).decide_command, "node hsdd/scripts/auto/decide.mjs --step S09 --stdin");
});

test("usage errors exit 2", () => {
  const dir = planRepo("00-empty");
  assert.equal(run(dir, "dispatch.mjs", []).code, 2);
  assert.equal(run(dir, "dispatch.mjs", ["--next", "--plan", "--for", "owner"]).code, 2);
  assert.equal(run(dir, "dispatch.mjs", ["--resume", "S02", "--reason", "maybe", "--message-file", "m.md"]).code, 2);
  assert.equal(run(dir, "dispatch.mjs", ["--plan"]).code, 2);
  assert.equal(run(dir, "dispatch.mjs", ["--bogus"]).code, 2);
});

test("--resume and --redispatch refuse an orchestrator or committed step without a stack trace", () => {
  const dir = planRepo("00-empty");
  put(dir, "msg.md", "go on\n");
  for (const args of [["--resume", "S00", "--reason", "answer", "--message-file", "msg.md"], ["--redispatch", "S01"], ["--redispatch", "S42"]]) {
    const out = run(dir, "dispatch.mjs", args);
    assert.equal(out.code, 1, `${args}: ${out.stdout}`);
    assert.ok(!/\n\s+at /.test(out.stdout + out.stderr), "no stack trace");
  }
});

test("each citation token alone satisfies a context line", () => {
  const config = baseConfig({ sources: { normative: [{ path: "ref/spec.md", cite: "Spec", version: "v2" }], baseline: [{ path: "ref/old.md", cite: "Old", version: "v1" }] } });
  for (const line of ["see hsdd/spec/shop.md", "kept from 7afa20c", "as S07 did", "per DEC-012", "closes Q-003", "Spec §3.4 says so", "Old v1 §2 said otherwise"]) {
    assert.deepEqual(contextErrors([line], config), [], line);
  }
  for (const line of ["The contract is fine.", "S7 did it", "DEC-12 says", "section §3 of the spec", "Guide §2"]) {
    assert.equal(contextErrors([line], config).length, 1, line);
  }
  assert.match(contextErrors(["see hsdd/spec/shop.md", "", "no token here"], config, "ctx.md")[0], /^ctx\.md:3: /);
});

test("purposeOf takes the first sentence after the bold segment id", () => {
  const plan = "# Run plan: shop\n\n## Segments\n\n**2026-10-20-plan.** Plan the tree. Then more.\n\n**2026-10-21-intake-x.** Take in\nthe new spec! Rest.\n\n## Step log\n";
  assert.equal(purposeOf(plan, "2026-10-20-plan"), "Plan the tree.");
  assert.equal(purposeOf(plan, "2026-10-21-intake-x"), "Take in the new spec!");
  assert.equal(purposeOf(plan, "2026-10-22-plan"), null);
  assert.equal(purposeOf(null, "2026-10-20-plan"), null);
});

test("--redispatch refuses once HEAD has moved past the dispatch head", () => {
  const dir = planRepo("00-empty");
  assert.equal(run(dir, "dispatch.mjs", ["--next"]).code, 0);
  put(dir, "hsdd/spec/shop.md", "# shop: Shop\n");
  put(dir, "hsdd/auto/steps/S02.json", "{}\n");
  gitIn(dir, "add", "hsdd/spec/shop.md");
  gitIn(dir, "commit", "-q", "-m", "hsdd: S02 root-spec shop: partial");
  const before = read(dir, "hsdd/auto/dispatch/S02.md");
  const out = run(dir, "dispatch.mjs", ["--redispatch", "S02"]);
  assert.equal(out.code, 1, out.stdout);
  assert.match(out.stdout, /commit\.mjs/);
  assert.equal(read(dir, "hsdd/auto/dispatch/S02.md"), before);
  assert.ok(existsSync(join(dir, "hsdd/auto/steps/S02.json")), "nothing renamed");
});
