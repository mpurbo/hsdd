import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handoffStates, selectNext, stages, unmetDone, willCreate } from "../skills/hsdd-auto/scripts/next.mjs";
import { lineErrors } from "../skills/hsdd-auto/scripts/routed.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { appendJsonl, readJsonl } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { validate } from "../skills/hsdd-auto/scripts/lib/schema.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, baseConfig, fakeStep, gitIn, makeRepo, run } from "./helpers/auto-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER = readFileSync(join(HERE, "fixtures", "auto", "intake", "2026-10-22-intake-order-v2.md"), "utf8");
const STRUCTURAL = readFileSync(join(HERE, "fixtures", "auto", "intake", "structural.md"), "utf8");

const SEG = "2026-10-22-intake-spec-v2";
const SEG2 = "2026-10-23-intake-spec-v2";
const REQUEST = "ref/spec-v2.md";
const RECORD = "hsdd/management/2026-10-22-intake-order-v2.md";
const APP = "hsdd/spec/shop.web.app.md";
const CONTRACT = "hsdd/contract/order-api.md";

const segment = (id = SEG, over = {}) => ({
  id, mode: "intake", opened_at: nowStamp(), instruction: "Take in ref/spec-v2.md.", stop_policy: "stop", first_step: "S00",
  request: REQUEST, authority: "accepted-rfc", ...over,
});

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const replaced = (dir, rel, from, to) => {
  const t = read(dir, rel);
  assert.ok(t.includes(from), `${rel} has no ${JSON.stringify(from)}`);
  return t.split(from).join(to);
};
const commitAll = (dir, msg = "owner edit") => { gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "-m", msg); };

// Stage 06 (planned) with the request file and one intake segment opened.
const opened = ({ config, prepare } = {}) => {
  const dir = makeRepo({ stage: "06-planned", ...(config ? { config } : {}), files: { [REQUEST]: "# Spec v2\n\nVersion: v2.\n" } });
  if (prepare) { prepare(dir); commitAll(dir); }
  addSegment(dir, segment());
  return dir;
};
const stepIn = (seg) => (dir, n, kind, target = seg, over = {}) =>
  fakeStep(dir, { step: `S${String(n).padStart(2, "0")}`, segment: seg, kind, target, ...over });
const step = stepIn(SEG);
// Opened, with the segment's setup (S00) and plan (S01) committed.
const begun = (opts) => {
  const dir = opened(opts);
  step(dir, 0, "setup");
  step(dir, 1, "plan");
  return dir;
};
// Begun, and the intake step (S02) committed with its record.
const routed = (opts = {}, record = ORDER) => {
  const dir = begun(opts);
  step(dir, 2, "intake", REQUEST, { files: { [RECORD]: record } });
  return dir;
};

const ctxOf = (dir) => loadContext(dir);
const next = (dir) => selectNext(ctxOf(dir));
const stepOf = (dir) => {
  const r = next(dir);
  assert.ok(r.step, `expected a step, got ${JSON.stringify(r)}`);
  return r.step;
};
const stateOf = (dir, id) => handoffStates(ctxOf(dir)).find((h) => h.id === id);

// order-api at v2, as H1 leaves it.
const contractV2 = (dir) => replaced(dir, CONTRACT, "version: v1", "version: v2");
const h1 = (dir, n = 3, over = {}) => step(dir, n, "contract-touch", "order-api", { handoff: "H1", ...over });

// A skip line for the handoff (6.12), committed unless asked otherwise.
const skip = (dir, handoff, { seg = SEG, commit = true } = {}) => {
  const line = { segment: seg, handoff, at: nowStamp(), status: "skipped", reason: `${handoff} cites no superseded version` };
  assert.deepEqual(validate("handoff-skip", line), []);
  appendJsonl(dir, P.handoffs, line);
  if (commit) { gitIn(dir, "add", P.handoffs); gitIn(dir, "commit", "-q", "-m", `auto: skip ${handoff}: test`); }
};

const queue = (dir, ...lines) => {
  for (const l of lines) {
    const line = { at: nowStamp(), ...l };
    assert.deepEqual(lineErrors(readJsonl(dir, P.queue), line), [], JSON.stringify(line));
    appendJsonl(dir, P.queue, line);
  }
  gitIn(dir, "add", P.queue);
  gitIn(dir, "commit", "-q", "-m", "queue");
};
const item = (id, kind, target, over = {}) => ({ id, status: "open", from: "S02", target, kind, text: `item ${id}`, ...over });
const insert = (id, from, stepKind, stepTarget, over = {}) => ({
  id, status: "open", from, target: "run", kind: "insert-step", text: `insert ${id}`, step_kind: stepKind, step_target: stepTarget, ...over,
});
const accepted = (id) => ({ id, status: "accepted", decision: "DEC-001" });
const addressed = (id, by) => ({ id, status: "addressed", by, note: `step ${by} committed` });

// A record whose ## Routing prose quotes each prompt in block order (C8), with its block.
const SKILL = {
  promote: "hsdd-spec", "spec-touch": "hsdd-spec", "contract-touch": "hsdd-contract", contract: "hsdd-contract",
  adr: "hsdd-adr", "adr-update": "hsdd-adr", "phase-plan-append": "hsdd-phase-plan",
};
const handoff = (id, kind, target, over = {}) => ({
  id, kind, skill: SKILL[kind] ?? "hsdd-spec", target, prompt: `${kind} ${target} for ${id}`, when: null, after: [], ...over,
});
const recordText = (handoffs, { promotes = "none", cls = "cross-node" } = {}) => [
  "# Intake: a test record", "",
  "- **Date:** 2026-10-22",
  `- **Request:** ${REQUEST} (accepted-rfc)`,
  `- **Class:** ${cls}`,
  "- **Lands on:** [shop.api, shop.web.app] · **Contracts:** [order-api]",
  `- **Promotes:** ${promotes}`,
  "- **Collisions:** none",
  "- **Status:** open", "",
  "## Request", "", "A test request.", "",
  "## Routing", "", "Handoffs, in order:", "",
  ...handoffs.map((h, i) => `${i + 1}. ${h.id}: \`${h.prompt}\``), "",
  "```hsdd-handoffs", JSON.stringify({ version: 1, handoffs }, null, 2), "```", "",
  "## Produced", "", "## Change log", "", "- 2026-10-22: created", "",
].join("\n");

// ---------- the brief's table ----------

test("intake step", () => {
  const s = stepOf(begun());
  assert.equal(s.kind, "intake");
  assert.equal(s.target, REQUEST);
  assert.equal(s.skill, "hsdd-intake");
  assert.equal(s.handoff, null);
  assert.deepEqual(s.write_set, ["hsdd/management/*-intake-*.md"]);
  assert.deepEqual(s.inputs, [REQUEST]);
  assert.match(s.why, /^stage 2 Route: /);
});

test("first handoff in block order", () => {
  const s = stepOf(routed());
  assert.equal(s.kind, "contract-touch");
  assert.equal(s.target, "order-api");
  assert.equal(s.handoff, "H1");
  assert.equal(s.skill, "hsdd-contract");
  assert.equal(s.queue_item, null);
  assert.equal(s.continues, null);
  assert.ok(s.inputs.includes(CONTRACT));
  assert.match(s.why, /^stage 3 Handoffs: H1 /);
});

test("after waits", () => {
  // H1 pending but not selectable (its continuation waits on an insert-step ordered after the
  // handoffs): H2a, after H1, is not returned, so this fails if waitsOn returned [].
  const blocked = routed();
  h1(blocked, 3, { status: "stopped" });
  queue(blocked, insert("Q-001", "S03", "phase-plan-append", "shop.web.app", { after: "handoffs" }), accepted("Q-001"));
  const r = next(blocked);
  assert.equal(r.step?.handoff ?? null, null, JSON.stringify(r));
  assert.notEqual(r.step?.handoff, "H2a");
  const dir = routed();
  assert.equal(stepOf(dir).handoff, "H1", "H1 pending: H2a, after H1, is not returned");
  h1(dir, 3, { status: "stopped" });
  const c = stepOf(dir);
  assert.equal(c.handoff, "H1", "H1 still pending through its stop");
  assert.equal(c.continues, "S03");
  h1(dir, 4, { continues: "S03", files: { [CONTRACT]: contractV2(dir) } });
  const s = stepOf(dir);
  assert.equal(s.handoff, "H2a", "H2a comes up once H1's continuation completes");
  assert.equal(s.kind, "citation-touch");
});

test("skip when the condition does not hold", () => {
  const dir = routed();
  h1(dir, 3, { files: { [CONTRACT]: contractV2(dir), [APP]: replaced(dir, APP, "order-api@v1", "order-api@v2") } });
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["skip"]);
  assert.equal(r.skip.handoff, "H2a");
  assert.equal(typeof r.skip.reason, "string");
  assert.match(r.skip.reason, /cites-superseded/);
  assert.match(r.skip.reason, /hsdd\/spec\/shop\.web\.app\.md/);
});

test("dispatch when it holds via a baseline version string", () => {
  const config = baseConfig({
    sources: {
      normative: [{ path: REQUEST, cite: "Spec", version: "v2" }],
      baseline: [{ path: "ref/spec.md", cite: "Spec", version: "v1" }],
    },
  });
  // The node cites the new source by path, so only a version string can make the condition hold.
  const dir = routed({ config, prepare: (d) => put(d, APP, replaced(d, APP, "ref/spec.md", REQUEST)) });
  h1(dir);
  assert.equal(next(dir).skip?.handoff, "H2a", "control: order-api@v1 is current and the path is not cited");
  put(dir, APP, replaced(dir, APP, "## Phase Plan", "Checkout follows Spec v1 §2.\n\n## Phase Plan"));
  commitAll(dir);
  const s = stepOf(dir);
  assert.equal(s.kind, "citation-touch");
  assert.equal(s.target, "shop.web.app");
  assert.equal(s.handoff, "H2a");
  assert.equal(s.skill, "hsdd-spec");
  assert.deepEqual(s.write_set, [APP, "hsdd/contract/INDEX.md", "hsdd/adr/INDEX.md"]);
  assert.match(s.why, /cites-superseded holds/);
});

test("dispatch when it holds via slug@vk", () => {
  const dir = routed();
  h1(dir, 3, { files: { [CONTRACT]: contractV2(dir) } });
  assert.ok(read(dir, APP).includes("order-api@v1"));
  const s = stepOf(dir);
  assert.equal(s.kind, "citation-touch");
  assert.equal(s.target, "shop.web.app");
  assert.equal(s.handoff, "H2a");
});

test("promote first", () => {
  const record = recordText([handoff("H1", "promote", "shop.api"), handoff("H2", "contract-touch", "order-api")], { promotes: "[shop.api]" });
  const ctx = ctxOf(routed({}, record));
  assert.deepEqual(ctx.intake.record.promotes, ["shop.api"]);
  const s = selectNext(ctx).step;
  assert.equal(s.kind, "promote");
  assert.equal(s.target, "shop.api");
  assert.equal(s.handoff, "H1");
  assert.equal(s.skill, "hsdd-spec");
});

test("handoff state across segments", () => {
  const dir = routed();
  h1(dir, 3, { note: "ended: the owner asked to pause after H1" });
  addSegment(dir, segment(SEG2, { first_step: "S04" }));
  assert.deepEqual(handoffStates(ctxOf(dir)), [
    { id: "H1", kind: "contract-touch", target: "order-api", state: "executed", step: "S03" },
    { id: "H2a", kind: "citation-touch", target: "shop.web.app", state: "pending", step: null },
  ]);
  const step2 = stepIn(SEG2);
  assert.equal(stepOf(dir).kind, "setup");
  step2(dir, 4, "setup");
  step2(dir, 5, "plan");
  const r = next(dir);
  assert.equal(r.skip?.handoff, "H2a", `H1 is not run again and no second intake runs: ${JSON.stringify(r)}`);
});

test("stopped handoff stays pending", () => {
  const dir = routed();
  h1(dir, 3, { status: "stopped" });
  assert.deepEqual(stateOf(dir, "H1"), { id: "H1", kind: "contract-touch", target: "order-api", state: "pending", step: "S03" });
  const s = stepOf(dir);
  assert.equal(s.kind, "contract-touch");
  assert.equal(s.target, "order-api");
  assert.equal(s.handoff, "H1");
  assert.equal(s.continues, "S03");
});

// H1 executed (order-api stays at v1) and H2a skipped by a committed skip line: stage 3 is done.
const handedOff = (opts) => {
  const dir = routed(opts);
  h1(dir);
  skip(dir, "H2a");
  return dir;
};

test("align on not-re-planned leaf-parents", () => {
  const dir = handedOff();
  step(dir, 4, "phase-plan-append", "shop.api");
  const s = stepOf(dir);
  assert.equal(s.kind, "align");
  assert.equal(s.target, "shop.web.app");
  assert.equal(s.skill, "hsdd-reconcile");
  assert.match(s.why, /^stage 5 Align: /);
});

test("empty align set holds", () => {
  const dir = handedOff();
  step(dir, 4, "phase-plan-append", "shop.api");
  step(dir, 5, "phase-plan-append", "shop.web.app");
  const s = stepOf(dir);
  assert.equal(s.kind, "report");
  assert.deepEqual(s.write_set, [`hsdd/auto/report/${SEG}.md`, RECORD]);
  assert.equal(stages(ctxOf(dir))[5].done, true);
});

test("a completed align on all satisfies the intake align condition", () => {
  const dir = handedOff();
  step(dir, 4, "align", "all");
  assert.equal(stepOf(dir).kind, "report");
});

test("consistency before align", () => {
  const dir = handedOff();
  queue(dir, item("Q-001", "consider", "shop.api"));
  const s = stepOf(dir);
  assert.equal(s.kind, "spec-touch");
  assert.equal(s.target, "shop.api");
  assert.match(s.why, /^stage 4 Consistency: .*Q-001/);
});

test("intake done", () => {
  const dir = handedOff();
  step(dir, 4, "align", "shop.api,shop.web.app");
  assert.equal(stepOf(dir).kind, "report");
  step(dir, 5, "report");
  assert.deepEqual(next(dir), { done: true });
  assert.deepEqual(unmetDone(ctxOf(dir)), []);
});

// ---------- further cases ----------

test("the align target lists every leaf-parent producer-first when none was re-planned", () => {
  const s = stepOf(handedOff());
  assert.equal(s.kind, "align");
  assert.equal(s.target, "shop.api,shop.web.app");
});

test("re-planned is counted from the record's intake step in a continuing segment", () => {
  const dir = handedOff();
  step(dir, 4, "phase-plan-append", "shop.api", { note: "ended: the owner asked to pause" });
  addSegment(dir, segment(SEG2, { first_step: "S05" }));
  const step2 = stepIn(SEG2);
  step2(dir, 5, "setup");
  step2(dir, 6, "plan");
  const s = stepOf(dir);
  assert.equal(s.kind, "align");
  assert.equal(s.target, "shop.web.app");
});

test("an uncommitted skip line keeps the handoff pending, so the skip comes back", () => {
  const dir = routed();
  h1(dir);
  skip(dir, "H2a", { commit: false });
  assert.equal(stateOf(dir, "H2a").state, "pending");
  assert.equal(next(dir).skip?.handoff, "H2a");
  gitIn(dir, "add", P.handoffs);
  gitIn(dir, "commit", "-q", "-m", "auto: skip H2a: test");
  assert.deepEqual(stateOf(dir, "H2a"), { id: "H2a", kind: "citation-touch", target: "shop.web.app", state: "skipped", step: null });
  assert.equal(stepOf(dir).kind, "align");
});

test("an empty after list waits on the previous handoff", () => {
  // H2 has `after: []`, so it waits on H1. H1 stopped, and its continuation waits on an insert-step
  // ordered after the handoffs: nothing can run, and H2 is not returned around H1.
  const record = recordText([handoff("H1", "contract-touch", "order-api"), handoff("H2", "spec-touch", "shop.api"),
    handoff("H3", "spec-touch", "shop.web.app", { after: ["H1"] })]);
  const dir = routed({}, record);
  h1(dir, 3, { status: "stopped" });
  queue(dir, insert("Q-001", "S03", "phase-plan-append", "shop.web.app", { after: "handoffs" }), accepted("Q-001"));
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["stuck"], JSON.stringify(r));
  assert.ok(r.stuck.some((l) => /H1/.test(l) && /S03/.test(l)), JSON.stringify(r.stuck));
});

test("an explicit after list lets a later handoff run beside a pending one", () => {
  const record = recordText([handoff("H1", "contract-touch", "order-api"), handoff("H2", "spec-touch", "shop.api", { after: [] }),
    handoff("H3", "spec-touch", "shop.web.app", { after: ["H1"] })]);
  const dir = routed({}, record);
  h1(dir);
  assert.equal(stepOf(dir).handoff, "H2");
  step(dir, 4, "spec-touch", "shop.api", { handoff: "H2", status: "stopped" });
  queue(dir, insert("Q-001", "S04", "phase-plan-append", "shop.api", { after: "handoffs" }), accepted("Q-001"));
  const s = stepOf(dir);
  assert.equal(s.handoff, "H3", "H3 waits only on H1, which is executed");
});

test("an insert-step item ordered after a handoff waits for it", () => {
  const dir = routed();
  queue(dir,
    insert("Q-001", "S02", "phase-plan-append", "shop.web.app", { after: "H1" }), accepted("Q-001"),
    insert("Q-002", "S02", "reconcile", "shop.web.app", { after: "handoffs" }), accepted("Q-002"));
  assert.equal(stepOf(dir).handoff, "H1", "neither item runs before H1");
  h1(dir);
  const s = stepOf(dir);
  assert.equal(s.queue_item, "Q-001", "Q-001 runs once H1 is executed, before H2a");
  step(dir, 4, "phase-plan-append", "shop.web.app", { queue_item: "Q-001" });
  queue(dir, addressed("Q-001", "S04"));
  assert.equal(next(dir).skip?.handoff, "H2a", "Q-002 waits for every handoff");
  skip(dir, "H2a");
  assert.equal(stepOf(dir).queue_item, "Q-002");
});

test("an insert-step item ordered after the handoffs waits for the intake's record", () => {
  const dir = begun();
  queue(dir, insert("Q-001", "S01", "phase-plan-append", "shop.web.app", { after: "handoffs" }), accepted("Q-001"));
  assert.equal(stepOf(dir).kind, "intake", "no handoff is known before the record, so the item waits");
});

test("a stopped re-plan does not count until its continuation completes", () => {
  const dir = handedOff();
  step(dir, 4, "phase-plan-append", "shop.api", { status: "stopped" });
  const c = stepOf(dir);
  assert.equal(c.continues, "S04");
  const lines = unmetDone(ctxOf(dir), { final: true });
  assert.ok(lines.some((l) => /^stage 5 Align: .*align on shop\.api,shop\.web\.app$/.test(l)), JSON.stringify(lines));
  step(dir, 5, "phase-plan-append", "shop.api", { continues: "S04" });
  assert.equal(stepOf(dir).target, "shop.web.app");
});

test("an insert-step item naming a handoff the block lacks waits for every handoff", () => {
  const dir = routed();
  queue(dir, insert("Q-001", "S02", "spec-touch", "shop.api", { after: "H9" }), accepted("Q-001"));
  assert.equal(stepOf(dir).handoff, "H1");
  h1(dir);
  assert.equal(next(dir).skip?.handoff, "H2a");
  skip(dir, "H2a");
  assert.equal(stepOf(dir).queue_item, "Q-001");
});

test("an item on a handoff id becomes a touch of the handoff's own target", () => {
  const dir = handedOff();
  queue(dir, item("Q-001", "consider", "H1"), item("Q-002", "must-address", "order-api"));
  const s = stepOf(dir);
  assert.equal(s.kind, "contract-touch");
  assert.equal(s.target, "order-api");
  assert.equal(s.handoff, null, "the touch does not replay H1's prompt");
  assert.match(s.why, /closes Q-001, Q-002/);
});

test("an item on the request path is closed by the orchestrator", () => {
  const dir = handedOff();
  queue(dir, item("Q-001", "consider", REQUEST));
  assert.deepEqual(Object.keys(next(dir)), ["close"]);
  assert.equal(next(dir).close.item, "Q-001");
});

test("the align routes an item: consistency runs again, then a second align", () => {
  const dir = handedOff();
  step(dir, 4, "align", "shop.api,shop.web.app");
  queue(dir, item("Q-001", "consider", "shop.web.app", { from: "S04" }));
  assert.equal(stepOf(dir).kind, "spec-touch");
  step(dir, 5, "spec-touch", "shop.web.app");
  queue(dir, { id: "Q-001", status: "addressed", by: "S05", note: "n" });
  const s = stepOf(dir);
  assert.equal(s.kind, "align");
  assert.equal(s.target, "shop.api,shop.web.app");
});

test("a structural record after a completed intake step is stuck", () => {
  const dir = routed({}, STRUCTURAL.replace("ref/marketplace.md (draft)", `${REQUEST} (accepted-rfc)`));
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["stuck"], JSON.stringify(r));
  assert.ok(r.stuck.some((l) => /^stage 2 Route: .*structural/.test(l)), JSON.stringify(r.stuck));
});

test("a stopped intake step returns its continuation, never a fresh intake", () => {
  const dir = begun();
  step(dir, 2, "intake", REQUEST, { status: "stopped", files: { [RECORD]: ORDER } });
  const s = stepOf(dir);
  assert.equal(s.kind, "intake");
  assert.equal(s.continues, "S02");
  assert.equal(stages(ctxOf(dir))[2].done, false, "the partial record does not satisfy stage 2");
});

test("a record the segment's intake step did not write does not satisfy stage 2", () => {
  const dir = opened({ prepare: (d) => put(d, RECORD, ORDER) });
  step(dir, 0, "setup");
  step(dir, 1, "plan");
  assert.equal(stepOf(dir).kind, "intake");
});

test("a new intake after a finished one on the same request routes again", () => {
  const dir = handedOff();
  step(dir, 4, "align", "shop.api,shop.web.app");
  step(dir, 5, "report");
  assert.deepEqual(next(dir), { done: true });
  addSegment(dir, segment(SEG2, { first_step: "S06", instruction: "Take in ref/spec-v2.md again." }));
  const step2 = stepIn(SEG2);
  step2(dir, 6, "setup");
  step2(dir, 7, "plan");
  assert.equal(stepOf(dir).kind, "intake");
  assert.deepEqual(handoffStates(ctxOf(dir)), [], "the finished intake's record is not this intake's until its intake step writes one");
});

test("willCreate names the ADRs and contracts a pending handoff of kind adr or contract will create", () => {
  const record = recordText([handoff("H1", "adr", "ADR-002"), handoff("H2", "contract", "payment-api"),
    handoff("H3", "contract-touch", "order-api")]);
  const dir = routed({}, record);
  const before = willCreate(ctxOf(dir));
  assert.deepEqual([...before.adrs], ["ADR-002"]);
  assert.deepEqual([...before.contracts], ["payment-api"]);
  step(dir, 3, "adr", "ADR-002", { handoff: "H1" });
  const after = willCreate(ctxOf(dir));
  assert.deepEqual([...after.adrs], []);
  assert.deepEqual([...after.contracts], ["payment-api"]);
});

test("stages lists the seven intake stages", () => {
  const dir = handedOff();
  assert.deepEqual(stages(ctxOf(dir)), [
    { n: 0, name: "Setup", done: true },
    { n: 1, name: "Plan", done: true },
    { n: 2, name: "Route", done: true },
    { n: 3, name: "Handoffs", done: true },
    { n: 4, name: "Consistency", done: true },
    { n: 5, name: "Align", done: false },
    { n: 6, name: "Report", done: false },
  ]);
  const out = run(dir, "next.mjs", ["--stages"]);
  assert.equal(out.code, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).length, 7);
});

test("unmet handoff lines name each pending handoff", () => {
  const dir = routed();
  h1(dir, 3, { status: "stopped" });
  const lines = unmetDone(ctxOf(dir), { final: true });
  assert.ok(lines.some((l) => /^stage 3 Handoffs: H1 .*S03/.test(l)), JSON.stringify(lines));
  assert.ok(lines.some((l) => /^stage 3 Handoffs: H2a .*pending/.test(l)), JSON.stringify(lines));
});

test("handoffStates is empty outside an intake segment with a record", () => {
  assert.deepEqual(handoffStates(ctxOf(begun())), []);
});
