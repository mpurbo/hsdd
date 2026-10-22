import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  contractOrder, pendingStopped, producerOrder, selectNext, stages, unmetDone, willCreate,
} from "../skills/hsdd-auto/scripts/next.mjs";
import { lineErrors } from "../skills/hsdd-auto/scripts/routed.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { appendJsonl, readJsonl } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { addSegment, baseConfig, fakeStep, gitIn, makeRepo, openStep, run } from "./helpers/auto-repo.mjs";

const SEG = "2026-10-22-plan";
const SEG2 = "2026-10-23-plan";
const segment = (id = SEG, over = {}) => ({
  id, mode: "plan", opened_at: nowStamp(), instruction: "Plan the shop.", stop_policy: "stop", first_step: "S00", ...over,
});

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const edit = (dir, rel, from, to) => {
  const t = read(dir, rel);
  assert.ok(t.includes(from), `${rel} has no ${JSON.stringify(from)}`);
  put(dir, rel, t.replace(from, to));
};
const commitAll = (dir, msg = "owner edit") => { gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "-m", msg); };

// A repository at a fixture stage with one plan segment opened.
const opened = (stage, { prepare } = {}) => {
  const dir = makeRepo({ stage });
  if (prepare) { prepare(dir); commitAll(dir); }
  addSegment(dir, segment());
  return dir;
};
const step = (dir, n, kind, target = SEG, over = {}) =>
  fakeStep(dir, { step: `S${String(n).padStart(2, "0")}`, segment: SEG, kind, target, ...over });
// Opened, with the segment's setup (S00) and plan (S01) committed.
const begun = (stage, opts) => {
  const dir = opened(stage, opts);
  step(dir, 0, "setup");
  step(dir, 1, "plan");
  return dir;
};

const ctxOf = (dir, opts) => loadContext(dir, opts);
const next = (dir, opts) => selectNext(ctxOf(dir, opts));
const stepOf = (dir, opts) => {
  const r = next(dir, opts);
  assert.ok(r.step, `expected a step, got ${JSON.stringify(r)}`);
  return r.step;
};

// Appends queue lines, each checked against the queue as it stands, and commits the queue.
const queue = (dir, ...lines) => {
  for (const l of lines) {
    const line = { at: nowStamp(), ...l };
    assert.deepEqual(lineErrors(readJsonl(dir, P.queue), line), [], JSON.stringify(line));
    appendJsonl(dir, P.queue, line);
  }
  gitIn(dir, "add", P.queue);
  gitIn(dir, "commit", "-q", "-m", "queue");
};
const insert = (id, from, stepKind, stepTarget, over = {}) => ({
  id, status: "open", from, target: "run", kind: "insert-step", text: `insert ${id}`, step_kind: stepKind, step_target: stepTarget, ...over,
});
const item = (id, kind, target, over = {}) => ({ id, status: "open", from: "S01", target, kind, text: `item ${id}`, ...over });
const accepted = (id) => ({ id, status: "accepted", decision: "DEC-001" });
const addressed = (id, by) => ({ id, status: "addressed", by, note: `step ${by} committed` });

const writeStop = (dir) => put(dir, P.stop, "# Run stopped at S02\n\n- **Segment:** x\n");

// ---------- the stage table, one test per fixture stage ----------

test("setup first", () => {
  const dir = opened("00-empty");
  const s = stepOf(dir);
  assert.equal(s.kind, "setup");
  assert.equal(s.target, SEG);
  assert.equal(s.skill, "none");
  assert.equal(s.handoff, null);
  assert.equal(s.queue_item, null);
  assert.equal(s.continues, null);
  assert.ok(s.write_set.includes(P.runYaml));
  assert.match(s.why, /setup/);
});

test("plan after setup", () => {
  const dir = opened("00-empty");
  step(dir, 0, "setup");
  const s = stepOf(dir);
  assert.equal(s.kind, "plan");
  assert.equal(s.target, SEG);
  assert.equal(s.skill, "none");
});

test("root-spec", () => {
  const s = stepOf(begun("00-empty"));
  assert.equal(s.kind, "root-spec");
  assert.equal(s.target, "shop");
  assert.equal(s.skill, "hsdd-spec");
  assert.deepEqual(s.write_set, ["hsdd/spec/*.md", "hsdd/conventions.md"]);
  assert.ok(s.inputs.includes("ref/spec.md"));
  assert.match(s.why, /^stage 2 /);
});

test("adr for an uncited file", () => {
  const s = stepOf(begun("01-root"));
  assert.equal(s.kind, "adr");
  assert.equal(s.target, "ADR-001");
  assert.equal(s.skill, "hsdd-adr");
  assert.ok(s.inputs.includes("hsdd/spec/shop.md"), "the citing spec is an input");
  assert.match(s.why, /ADR-001 is cited in hsdd\/spec\/shop\.md/);
});

test("contract", () => {
  const s = stepOf(begun("02-adrs"));
  assert.equal(s.kind, "contract");
  assert.equal(s.target, "order-api");
  assert.equal(s.skill, "hsdd-contract");
  assert.ok(s.inputs.includes("hsdd/spec/shop.api.md"), "the producing node is an input");
});

test("mid-level-spec", () => {
  const s = stepOf(begun("03-contracts"));
  assert.equal(s.kind, "mid-level-spec");
  assert.equal(s.target, "shop.web");
  assert.equal(s.skill, "hsdd-spec");
  assert.ok(s.inputs.includes("hsdd/spec/shop.web.md"));
  assert.ok(s.inputs.includes("hsdd/spec/shop.md"), "the parent is an input");
});

test("phase-plan producer-first", () => {
  const s = stepOf(begun("04-mid"));
  assert.equal(s.kind, "phase-plan");
  assert.equal(s.target, "shop.api");
  assert.equal(s.skill, "hsdd-phase-plan");
  assert.deepEqual(s.write_set, ["hsdd/spec/shop.api.md"]);
});

test("reconcile before the next phase-plan", () => {
  const s = stepOf(begun("05-phase-api"));
  assert.equal(s.kind, "reconcile");
  assert.equal(s.target, "shop.api");
  assert.equal(s.skill, "hsdd-reconcile");
});

test("align on all", () => {
  const s = stepOf(begun("06-planned"));
  assert.equal(s.kind, "align");
  assert.equal(s.target, "all");
  assert.equal(s.skill, "hsdd-reconcile");
  assert.match(s.why, /^stage 7 /);
});

test("report after align", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all");
  const s = stepOf(dir);
  assert.equal(s.kind, "report");
  assert.equal(s.target, SEG);
  assert.equal(s.skill, "none");
  assert.deepEqual(s.write_set, [`hsdd/auto/report/${SEG}.md`]);
});

test("done", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all");
  step(dir, 3, "report");
  assert.deepEqual(next(dir), { done: true });
  assert.deepEqual(unmetDone(ctxOf(dir)), []);
});

// ---------- producer-first and cycles ----------

const list = (refs) => (refs.length === 0 ? "none" : `[${refs.join(", ")}]`);
const nodeSpec = (id, { kind = "leaf-parent", consumes = [], produces = [], decomposes = "phases (see hsdd-phase-plan)" } = {}) =>
  `# ${id}: ${id}\n\n## Node\n\n- **Kind:** ${kind}\n- **Purpose:** test node\n- **Consumes:** ${list(consumes)}\n`
  + `- **Produces:** ${list(produces)}\n- **Decomposes into:** ${decomposes}\n\n## Overview\n\nA test node.\n`;
const contractFile = (slug, owner) =>
  `---\nid: ${slug}\nversion: v1\nstatus: draft\nkind: api\nowner: ${owner}\nproduced_by: [${owner}.1]\nconsumers: []\nphase_ids: provisional\n---\n\n# Contract: ${slug}\n`;
const chainTree = (dir) => {
  put(dir, "hsdd/spec/shop.md", nodeSpec("shop", { kind: "internal", decomposes: "shop.c, shop.b, shop.a" }));
  put(dir, "hsdd/spec/shop.a.md", nodeSpec("shop.a", { produces: ["a-api@v1"] }));
  put(dir, "hsdd/spec/shop.b.md", nodeSpec("shop.b", { consumes: ["a-api@v1"], produces: ["b-api@v1"] }));
  put(dir, "hsdd/spec/shop.c.md", nodeSpec("shop.c", { consumes: ["b-api@v1"], produces: ["c-api@v1"] }));
};

test("producer-first on a three-contract chain", () => {
  const dir = begun("00-empty", { prepare: chainTree });
  const tree = ctxOf(dir).tree;
  assert.deepEqual(tree.mentionOrder, ["shop.c", "shop.b", "shop.a"], "the fixture mentions c, b, a");
  assert.deepEqual(producerOrder(tree, ["shop.c", "shop.b", "shop.a"]), { order: ["shop.a", "shop.b", "shop.c"], cycle: [] });
  assert.deepEqual(contractOrder(tree, ["c-api", "b-api", "a-api"]), { order: ["a-api", "b-api", "c-api"], cycle: [] });
  const authored = [2, 3, 4].map((n) => {
    const s = stepOf(dir);
    assert.equal(s.kind, "contract");
    step(dir, n, "contract", s.target, { files: { [`hsdd/contract/${s.target}.md`]: contractFile(s.target, `shop.${s.target[0]}`) } });
    return s.target;
  });
  assert.deepEqual(authored, ["a-api", "b-api", "c-api"]);
  assert.equal(stepOf(dir).target, "shop.a", "phase plans follow producer-first too");
});

const cycleTree = (dir) => {
  put(dir, "hsdd/spec/shop.md", nodeSpec("shop", { kind: "internal", decomposes: "shop.a, shop.b" }));
  put(dir, "hsdd/spec/shop.a.md", nodeSpec("shop.a", { consumes: ["b-api@v1"], produces: ["a-api@v1"] }));
  put(dir, "hsdd/spec/shop.b.md", nodeSpec("shop.b", { consumes: ["a-api@v1"], produces: ["b-api@v1"] }));
};

test("a cycle returns stop", () => {
  const dir = begun("00-empty", {
    prepare: (d) => {
      cycleTree(d);
      put(d, "hsdd/contract/a-api.md", contractFile("a-api", "shop.a"));
      put(d, "hsdd/contract/b-api.md", contractFile("b-api", "shop.b"));
    },
  });
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["stop"]);
  assert.equal(r.stop.class, "shape");
  assert.match(r.stop.reason, /shop\.a/);
  assert.match(r.stop.reason, /shop\.b/);
  assert.deepEqual(producerOrder(ctxOf(dir).tree, ["shop.a", "shop.b"]), { order: [], cycle: ["shop.a", "shop.b"] });
});

test("a contract cycle among the contracts to author returns stop", () => {
  const dir = begun("00-empty", { prepare: cycleTree });
  const r = next(dir);
  assert.equal(r.stop?.class, "shape");
  assert.match(r.stop.reason, /a-api/);
  assert.match(r.stop.reason, /b-api/);
  // Ties keep first mention: shop.a's spec names b-api (Consumes) before a-api (Produces).
  assert.deepEqual(contractOrder(ctxOf(dir).tree, ["a-api", "b-api"]), { order: [], cycle: ["b-api", "a-api"] });
});

test("candidates outside a cycle are ordered before the stop", () => {
  const dir = begun("00-empty", {
    prepare: (d) => {
      put(d, "hsdd/spec/shop.md", nodeSpec("shop", { kind: "internal", decomposes: "shop.b, shop.c, shop.a" }));
      put(d, "hsdd/spec/shop.a.md", nodeSpec("shop.a", { produces: ["a-api@v1"] }));
      put(d, "hsdd/spec/shop.b.md", nodeSpec("shop.b", { consumes: ["a-api@v1", "c-api@v1"], produces: ["b-api@v1"] }));
      put(d, "hsdd/spec/shop.c.md", nodeSpec("shop.c", { consumes: ["b-api@v1"], produces: ["c-api@v1"] }));
      for (const [slug, owner] of [["a-api", "shop.a"], ["b-api", "shop.b"], ["c-api", "shop.c"]]) put(d, `hsdd/contract/${slug}.md`, contractFile(slug, owner));
    },
  });
  assert.deepEqual(producerOrder(ctxOf(dir).tree, ["shop.b", "shop.c", "shop.a"]), { order: ["shop.a"], cycle: ["shop.b", "shop.c"] });
  assert.equal(stepOf(dir).target, "shop.a", "the producer of the cycle is planned first");
  step(dir, 2, "phase-plan", "shop.a", { files: { "hsdd/spec/shop.a.md": `${nodeSpec("shop.a", { produces: ["a-api@v1"] })}\n## Phase Plan\n\n| Phase | Name |\n|---|---|\n| shop.a.1 | One |\n` } });
  const r = next(dir);
  assert.equal(r.stop?.class, "shape");
  assert.match(r.stop.reason, /shop\.b, shop\.c/);
});

// ---------- the selection order ----------

test("waiting", () => {
  const dir = begun("00-empty");
  step(dir, 2, "root-spec", "shop");
  openStep(dir, { step: "S03", segment: SEG, kind: "adr", target: "ADR-001" });
  assert.deepEqual(next(dir), { waiting: "S03" });
});

test("blocked", () => {
  const dir = begun("00-empty");
  writeStop(dir);
  step(dir, 2, "root-spec", "shop", { status: "stopped" });
  assert.deepEqual(next(dir), { blocked: "hsdd/judgement/STOP.md" });
});

test("setup of a new segment precedes blocked", () => {
  const dir = begun("00-empty");
  writeStop(dir);
  step(dir, 2, "root-spec", "shop", { status: "stopped" });
  addSegment(dir, segment(SEG2, { first_step: "S03" }));
  const s = stepOf(dir);
  assert.equal(s.kind, "setup");
  assert.equal(s.target, SEG2);
});

test("an answered stop runs the new segment's setup and plan, then the continuation", () => {
  const dir = begun("00-empty");
  writeStop(dir);
  step(dir, 2, "root-spec", "shop", { status: "stopped", files: { "hsdd/spec/shop.md": nodeSpec("shop", { kind: "internal", decomposes: "" }) } });
  addSegment(dir, segment(SEG2, { first_step: "S03" }));
  gitIn(dir, "rm", "-q", P.stop);
  fakeStep(dir, { step: "S03", segment: SEG2, kind: "setup", target: SEG2 });
  assert.equal(stepOf(dir).kind, "plan");
  fakeStep(dir, { step: "S04", segment: SEG2, kind: "plan", target: SEG2 });
  const s = stepOf(dir);
  assert.equal(s.kind, "root-spec");
  assert.equal(s.target, "shop");
  assert.equal(s.continues, "S02");
});

test("a hard stop in the newest segment's own setup is blocked", () => {
  const single = opened("00-empty");
  writeStop(single);
  step(single, 0, "setup", SEG, { status: "stopped" });
  assert.deepEqual(next(single), { blocked: "hsdd/judgement/STOP.md" });

  const answered = begun("00-empty");
  writeStop(answered);
  step(answered, 2, "root-spec", "shop", { status: "stopped" });
  addSegment(answered, segment(SEG2, { first_step: "S03" }));
  fakeStep(answered, { step: "S03", segment: SEG2, kind: "setup", target: SEG2, status: "stopped" });
  assert.deepEqual(next(answered), { blocked: "hsdd/judgement/STOP.md" });
});

test("decide", () => {
  const dir = begun("04-mid");
  queue(dir, insert("Q-001", "S01", "spec-touch", "shop.web"));
  assert.deepEqual(next(dir), { decide: { item: "Q-001" } });
});

test("continuation before stage rule", () => {
  const dir = begun("00-empty");
  const partial = nodeSpec("shop", { kind: "internal", decomposes: "shop.api" });
  step(dir, 2, "root-spec", "shop", { status: "stopped", files: { "hsdd/spec/shop.md": partial } });
  const s = stepOf(dir);
  assert.equal(s.kind, "root-spec");
  assert.equal(s.target, "shop");
  assert.equal(s.continues, "S02");
  assert.equal(s.skill, "hsdd-spec");
  assert.match(s.why, /S02/);
});

test("continuation of a stopped continuation continues the newest", () => {
  const dir = begun("00-empty");
  step(dir, 2, "root-spec", "shop", { status: "stopped" });
  step(dir, 3, "root-spec", "shop", { status: "stopped", continues: "S02" });
  assert.deepEqual(pendingStopped(ctxOf(dir)).map((c) => c.step), ["S03"]);
  assert.equal(stepOf(dir).continues, "S03");
});

test("a completed continuation ends the chain", () => {
  const dir = begun("00-empty");
  step(dir, 2, "root-spec", "shop", { status: "stopped" });
  step(dir, 3, "root-spec", "shop", { continues: "S02", files: { "hsdd/spec/shop.md": nodeSpec("shop", { kind: "internal", decomposes: "" }) } });
  assert.deepEqual(pendingStopped(ctxOf(dir)), []);
  const s = stepOf(dir);
  assert.equal(s.continues, null);
  assert.equal(s.kind, "mid-level-spec", "the root has no children, so stage 5 takes it");
});

test("a legacy run line starts no chain", () => {
  const dir = begun("00-empty");
  appendJsonl(dir, P.runLog, {
    step_ref: "S90", kind: "root-spec", skill: "hsdd-spec", target: "shop", started: "2026-10-01T10:00:00+07:00",
    finished: "2026-10-01T11:00:00+07:00", commit: gitIn(dir, "rev-parse", "HEAD"), dispatches: 1, status: "stopped",
  });
  commitAll(dir, "legacy run line");
  assert.deepEqual(pendingStopped(ctxOf(dir)), []);
  assert.equal(stepOf(dir).continues, null);
});

test("a stopped plan step gets no continuation", () => {
  const dir = begun("04-mid");
  writeStop(dir);
  step(dir, 2, "plan", SEG, { status: "stopped" });
  assert.deepEqual(next(dir), { blocked: "hsdd/judgement/STOP.md" });
  addSegment(dir, segment(SEG2, { first_step: "S03" }));
  gitIn(dir, "rm", "-q", P.stop);
  fakeStep(dir, { step: "S03", segment: SEG2, kind: "setup", target: SEG2 });
  fakeStep(dir, { step: "S04", segment: SEG2, kind: "plan", target: SEG2 });
  assert.deepEqual(pendingStopped(ctxOf(dir)), []);
  const s = stepOf(dir);
  assert.equal(s.kind, "phase-plan");
  assert.equal(s.continues, null);
});

test("continuation waits for its insert-step", () => {
  const dir = begun("04-mid");
  step(dir, 2, "phase-plan", "shop.api", { status: "stopped" });
  queue(dir, insert("Q-001", "S02", "spec-touch", "shop.api"), accepted("Q-001"));
  const s = stepOf(dir);
  assert.equal(s.kind, "spec-touch");
  assert.equal(s.target, "shop.api");
  assert.equal(s.queue_item, "Q-001");
  assert.equal(s.continues, null);
  step(dir, 3, "spec-touch", "shop.api", { queue_item: "Q-001" });
  queue(dir, addressed("Q-001", "S03"));
  const c = stepOf(dir);
  assert.equal(c.kind, "phase-plan");
  assert.equal(c.target, "shop.api");
  assert.equal(c.continues, "S02");
});

test("a rejected insert-step from the stopped step releases the continuation", () => {
  const dir = begun("04-mid");
  step(dir, 2, "phase-plan", "shop.api", { status: "stopped" });
  queue(dir, insert("Q-001", "S02", "spec-touch", "shop.api"), { id: "Q-001", status: "rejected", decision: "DEC-001" });
  assert.equal(stepOf(dir).continues, "S02");
});

test("no continuation while STOP.md exists", () => {
  const dir = begun("04-mid");
  writeStop(dir);
  step(dir, 2, "phase-plan", "shop.api", { status: "stopped" });
  assert.deepEqual(next(dir), { blocked: "hsdd/judgement/STOP.md" });
  assert.deepEqual(pendingStopped(ctxOf(dir)).map((c) => c.step), ["S02"], "still pending, only not returnable");
});

test("accepted insert-step before stage rule", () => {
  const dir = begun("04-mid");
  queue(dir, insert("Q-001", "S01", "adr-update", "ADR-001"), accepted("Q-001"));
  const s = stepOf(dir);
  assert.equal(s.kind, "adr-update");
  assert.equal(s.target, "ADR-001");
  assert.equal(s.skill, "hsdd-adr");
  assert.equal(s.queue_item, "Q-001");
  assert.match(s.why, /Q-001/);
});

test("accepted insert-steps are returned oldest first", () => {
  const dir = begun("04-mid");
  queue(dir,
    insert("Q-001", "S01", "spec-touch", "shop.web"),
    insert("Q-002", "S01", "adr-update", "ADR-001"),
    accepted("Q-002"), accepted("Q-001"));
  assert.equal(stepOf(dir).queue_item, "Q-001");
});

test("item after honoured", () => {
  // A plan segment has no handoffs, so `after: "handoffs"` holds vacuously and the item is returned.
  // The pending-handoff case needs Task 9's intake fixture.
  const dir = begun("04-mid");
  queue(dir, insert("Q-001", "S01", "spec-touch", "shop.web", { after: "handoffs" }), accepted("Q-001"));
  const s = stepOf(dir);
  assert.equal(s.kind, "spec-touch");
  assert.equal(s.queue_item, "Q-001");
});

test("stopped step's item returned only as continuation", () => {
  const dir = begun("04-mid");
  queue(dir, insert("Q-001", "S01", "spec-touch", "shop.web"), accepted("Q-001"));
  step(dir, 2, "spec-touch", "shop.web", { queue_item: "Q-001" });
  queue(dir, addressed("Q-001", "S02"), insert("Q-002", "S01", "adr-update", "ADR-001"), accepted("Q-002"));
  step(dir, 3, "adr-update", "ADR-001", { queue_item: "Q-002", status: "stopped" });
  queue(dir, insert("Q-003", "S03", "spec-touch", "shop.api"), accepted("Q-003"));
  const s = stepOf(dir);
  assert.equal(s.queue_item, "Q-003", "Q-002 is never returned as a fresh step");
  assert.equal(s.continues, null);
  step(dir, 4, "spec-touch", "shop.api", { queue_item: "Q-003" });
  queue(dir, addressed("Q-003", "S04"));
  const c = stepOf(dir);
  assert.equal(c.kind, "adr-update");
  assert.equal(c.target, "ADR-001");
  assert.equal(c.queue_item, "Q-002");
  assert.equal(c.continues, "S03");
});

test("close", () => {
  const dir = begun("06-planned");
  queue(dir,
    item("Q-001", "consider", "shop.api"), { id: "Q-001", status: "explained", by: "S01", note: "n" },
    item("Q-002", "must-address", "shop.web.app"), { id: "Q-002", status: "addressed", by: "S01", note: "n" },
    item("Q-003", "consider", "run"));
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["close"]);
  assert.equal(r.close.item, "Q-003");
  assert.equal(typeof r.close.why, "string");
  assert.match(r.close.why, /Q-003/);
});

test("consistency touch", () => {
  const dir = begun("06-planned");
  queue(dir, item("Q-001", "must-address", "shop.api"));
  const s = stepOf(dir);
  assert.equal(s.kind, "spec-touch");
  assert.equal(s.target, "shop.api");
  assert.equal(s.skill, "hsdd-spec");
  assert.equal(s.queue_item, null);
  assert.match(s.why, /Q-001/);
});

test("consistency maps contract and ADR targets, oldest first", () => {
  const dir = begun("06-planned");
  queue(dir, item("Q-001", "consider", "order-api"), item("Q-002", "must-address", "ADR-001"));
  const s = stepOf(dir);
  assert.equal(s.kind, "contract-touch");
  assert.equal(s.target, "order-api");
  step(dir, 2, "contract-touch", "order-api");
  queue(dir, { id: "Q-001", status: "addressed", by: "S02", note: "done" });
  const t = stepOf(dir);
  assert.equal(t.kind, "adr-update");
  assert.equal(t.target, "ADR-001");
});

test("an align after the last touch, then the report", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all");
  queue(dir, item("Q-001", "consider", "shop.api", { from: "S02" }));
  assert.equal(stepOf(dir).kind, "spec-touch");
  step(dir, 3, "spec-touch", "shop.api");
  queue(dir, { id: "Q-001", status: "addressed", by: "S03", note: "done" });
  const s = stepOf(dir);
  assert.equal(s.kind, "align", "the touch was the last subagent step, so the align condition fails");
  step(dir, 4, "align", "all");
  assert.equal(stepOf(dir).kind, "report");
});

test("a stopped align does not hold the align condition", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all", { status: "stopped" });
  assert.equal(stages(ctxOf(dir))[7].done, false);
  const s = stepOf(dir);
  assert.equal(s.kind, "align");
  assert.equal(s.continues, "S02");
});

test("no step for an as-built leaf-parent", () => {
  const dir = begun("04-mid", {
    prepare: (d) => edit(d, "hsdd/spec/shop.api.md", "- **Kind:** leaf-parent\n", "- **Kind:** leaf-parent\n- **Adopted:** as-built\n"),
  });
  const s = stepOf(dir);
  assert.equal(s.kind, "phase-plan");
  assert.equal(s.target, "shop.web.app");
});

test("reconcile names every node with pending entries, comma-separated", () => {
  const pending = "\n## Governance updates (pending reconcile)\n\n- request `order-api@v1` a list endpoint filter\n";
  const dir = begun("06-planned", {
    prepare: (d) => {
      put(d, "hsdd/spec/shop.web.app.md", read(d, "hsdd/spec/shop.web.app.md") + pending);
      edit(d, "hsdd/spec/shop.api.md", "> Reconciled 2026-10-22 by hsdd-reconcile. Drained entries are in git history.\n", "- note the store is in memory\n");
    },
  });
  const s = stepOf(dir);
  assert.equal(s.kind, "reconcile");
  assert.equal(s.target, "shop.api,shop.web.app");
});

// ---------- stuck and done ----------

const draftContract = (d) => {
  edit(d, "hsdd/contract/order-api.md", "status: stable", "status: draft");
  edit(d, "hsdd/contract/INDEX.md", "| v1 | api | stable |", "| v1 | api | draft |");
};

test("stuck", () => {
  // Controller ruling R2: a contract left draft (phase_ids final) after the align on all.
  const dir = begun("06-planned", { prepare: draftContract });
  step(dir, 2, "align", "all");
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["stuck"]);
  assert.ok(r.stuck.includes("contract order-api is draft"), JSON.stringify(r.stuck));
  assert.ok(!r.stuck.some((l) => /phase_ids/.test(l)), "phase_ids is final");
});

test("stuck after the report when done fails", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all");
  step(dir, 3, "report");
  draftContract(dir);
  commitAll(dir);
  const r = next(dir);
  assert.ok(r.stuck?.includes("contract order-api is draft"), JSON.stringify(r));
});

const oq9 = (d) => edit(d, "hsdd/spec/shop.api.md", "defined in the root spec).\n", "defined in the root spec). Expiry also waits on OQ9.\n");

test("done ignores defects in unchanged files", () => {
  const dir = begun("06-planned", { prepare: oq9 });
  step(dir, 2, "align", "all");
  assert.equal(stepOf(dir).kind, "report");
  step(dir, 3, "report");
  assert.deepEqual(next(dir), { done: true });
});

test("a defect in a file the segment changed is unmet", () => {
  const dir = begun("06-planned");
  const text = read(dir, "hsdd/spec/shop.api.md").replace("defined in the root spec).\n", "defined in the root spec). Expiry also waits on OQ9.\n");
  step(dir, 2, "align", "all", { files: { "hsdd/spec/shop.api.md": text } });
  const r = next(dir);
  assert.ok(r.stuck?.some((l) => l.includes("OQ9") && l.includes("hsdd/spec/shop.api.md")), JSON.stringify(r));
});

test("a registry finding counts only in a file the segment changed", () => {
  const stale = (d) => edit(d, "hsdd/contract/INDEX.md", "| `shop.api` | 2 |", "| `shop.api` | 3 |");
  const before = begun("06-planned", { prepare: stale });
  step(before, 2, "align", "all");
  assert.equal(stepOf(before).kind, "report", "a stale registry from before the segment is a warning");

  const during = begun("06-planned");
  const index = read(during, "hsdd/contract/INDEX.md").replace("| `shop.api` | 2 |", "| `shop.api` | 3 |");
  step(during, 2, "align", "all", { files: { "hsdd/contract/INDEX.md": index } });
  const r = next(during);
  assert.ok(r.stuck?.some((l) => l.startsWith("C1 ")), JSON.stringify(r));
});

test("a registry the segment's own change made stale is unmet", () => {
  // A contract-touch drops a consumer without regenerating INDEX.md: the stale file is INDEX.md (unchanged),
  // and the contract it was generated from is related and changed (review fix round 1).
  const dir = begun("06-planned");
  const touched = read(dir, "hsdd/contract/order-api.md").replace("consumers: [shop.web.app.1, shop.web.app.2]", "consumers: [shop.web.app.1]");
  step(dir, 2, "contract-touch", "order-api", { files: { "hsdd/contract/order-api.md": touched } });
  step(dir, 3, "align", "all");
  const lines = unmetDone(ctxOf(dir), { final: true });
  assert.ok(lines.some((l) => l.startsWith("C1 ") && l.includes("hsdd/contract/INDEX.md")), JSON.stringify(lines));
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["stuck"], "stuck, not report");
  assert.ok(r.stuck.some((l) => l.startsWith("C1 ")));
});

test("a phase heading a final contract names, removed in the segment, is unmet", () => {
  const dir = begun("06-planned");
  const replanned = read(dir, "hsdd/spec/shop.web.app.md").replace("### shop.web.app.2: Cart and checkout", "### Cart and checkout");
  step(dir, 2, "phase-plan", "shop.web.app", { files: { "hsdd/spec/shop.web.app.md": replanned } });
  step(dir, 3, "align", "all");
  const r = next(dir);
  assert.ok(r.stuck?.some((l) => l.startsWith("C7 ") && l.includes("shop.web.app.2")), JSON.stringify(r));
});

test("contracts authored in the segment without the generator are unmet", () => {
  const authored = begun("02-adrs");
  step(authored, 2, "contract", "order-api", { files: { "hsdd/contract/order-api.md": contractFile("order-api", "shop.api") } });
  const lines = unmetDone(ctxOf(authored), { final: true });
  assert.ok(lines.some((l) => l.startsWith("C0 ")), JSON.stringify(lines));

  const before = begun("02-adrs", { prepare: (d) => put(d, "hsdd/contract/order-api.md", contractFile("order-api", "shop.api")) });
  assert.ok(!unmetDone(ctxOf(before), { final: true }).some((l) => l.startsWith("C0 ")), "a contract from before the segment is a warning");
});

test("an open must-address item is unmet in the done definition", () => {
  const dir = begun("06-planned");
  queue(dir, item("Q-001", "consider", "shop.api"), item("Q-002", "must-address", "shop.web.app", { from: "S12" }));
  const lines = unmetDone(ctxOf(dir), { final: true });
  assert.ok(lines.includes("S12 must-address Q-002 is open"), JSON.stringify(lines));
  assert.ok(!lines.some((l) => /must-address Q-001/.test(l)), "a consider item is not a must-address line");
});

test("unmetDone with final omits the report stage and the clean tree", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all");
  put(dir, "scratch.txt", "left behind\n");
  const ctx = ctxOf(dir);
  assert.deepEqual(unmetDone(ctx, { final: true }), []);
  const full = unmetDone(ctx);
  assert.ok(full.some((l) => /^stage 8 Report: /.test(l)), JSON.stringify(full));
  assert.ok(full.some((l) => l.includes("scratch.txt")), JSON.stringify(full));
});

test("a dirty tree is not done; owner files do not count", () => {
  const config = baseConfig({ owner_files: ["notes/owner.md"] });
  const dir = makeRepo({ stage: "06-planned", config, files: { "notes/owner.md": "mine\n" } });
  addSegment(dir, segment());
  step(dir, 0, "setup");
  step(dir, 1, "plan");
  step(dir, 2, "align", "all");
  step(dir, 3, "report");
  put(dir, "notes/owner.md", "changed by the owner\n");
  assert.deepEqual(next(dir), { done: true });
  put(dir, "stray.md", "x\n");
  const r = next(dir);
  assert.deepEqual(r.stuck, ["the working tree has changes outside owner_files: stray.md"]);
});

test("ledger errors are unmet", () => {
  const dir = begun("06-planned");
  step(dir, 2, "align", "all");
  const lines = unmetDone(ctxOf(dir), { final: true, ledger: { errors: ["DEC-001: commit abc1234 does not exist"], warnings: [] } });
  assert.deepEqual(lines, ["ledger: DEC-001: commit abc1234 does not exist"]);
});

test("a segment ended by an owner message gives no step", () => {
  const dir = begun("04-mid");
  step(dir, 2, "plan", SEG, { note: "ended: owner message" });
  const r = next(dir);
  assert.deepEqual(Object.keys(r), ["stuck"]);
  assert.match(r.stuck[0], /ended/);
  assert.match(r.stuck[0], /open-segment/);
  addSegment(dir, segment(SEG2, { first_step: "S03" }));
  assert.equal(stepOf(dir).kind, "setup");
});

test("no segment and an intake segment", () => {
  const empty = makeRepo({ stage: "00-empty" });
  assert.deepEqual(Object.keys(next(empty)), ["stuck"]);
  const intake = makeRepo({ stage: "06-planned" });
  addSegment(intake, segment("2026-10-22-intake-spec-v2", { mode: "intake", request: "ref/spec-v2.md", authority: "accepted-rfc" }));
  assert.deepEqual(next(intake), { stuck: ["intake mode not implemented"] });
});

// ---------- stages, willCreate, determinism, the CLI ----------

test("partial artifacts of a stopped step never satisfy a stage", () => {
  const dir = begun("00-empty");
  step(dir, 2, "root-spec", "shop", { status: "stopped", files: { "hsdd/spec/shop.md": nodeSpec("shop", { kind: "internal", decomposes: "" }) } });
  const ctx = ctxOf(dir);
  assert.ok(ctx.tree.nodes.has("shop"), "the partial root spec exists");
  assert.equal(stages(ctx)[2].done, false);
  assert.ok(unmetDone(ctx, { final: true }).some((l) => /^stage 2 .*S02/.test(l)));
});

test("a stopped contract step's partial file keeps stage 4 open and returns its continuation", () => {
  const dir = begun("02-adrs");
  step(dir, 2, "contract", "order-api", { status: "stopped", files: { "hsdd/contract/order-api.md": contractFile("order-api", "shop.api") } });
  const ctx = ctxOf(dir);
  assert.ok(ctx.tree.contracts.has("order-api"), "the partial contract file exists");
  assert.equal(stages(ctx)[4].done, false);
  assert.ok(unmetDone(ctx, { final: true }).includes("stage 4 Root contracts: contract S02 on order-api stopped and no continuation of it has completed"));
  const s = stepOf(dir);
  assert.equal(s.kind, "contract");
  assert.equal(s.target, "order-api");
  assert.equal(s.continues, "S02");
});

test("willCreate lists the cited ADRs and named contracts that have no file", () => {
  const at01 = willCreate(ctxOf(begun("01-root")));
  assert.deepEqual([...at01.adrs], ["ADR-001"]);
  assert.deepEqual([...at01.contracts], ["order-api"]);
  const at03 = willCreate(ctxOf(begun("03-contracts")));
  assert.deepEqual([...at03.adrs], []);
  assert.deepEqual([...at03.contracts], []);
});

test("deterministic", () => {
  for (const stage of ["04-mid", "06-planned"]) {
    const dir = begun(stage);
    assert.equal(JSON.stringify(next(dir)), JSON.stringify(next(dir)));
  }
});

test("--stages", () => {
  const dir = begun("03-contracts");
  const r = run(dir, "next.mjs", ["--stages"]);
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.map((s) => s.n), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(out.filter((s) => s.done).map((s) => s.n), [0, 1, 2, 3, 4]);
  assert.equal(out[5].name, "Mid-level decomposition");
  assert.deepEqual(out, stages(ctxOf(dir)));
});

test("the CLI prints one JSON document and refuses unknown arguments", () => {
  const dir = begun("04-mid");
  const r = run(dir, "next.mjs");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), next(dir));
  assert.equal(r.stdout.trim().split("\n").length, 1);
  assert.equal(run(dir, "next.mjs", ["--bogus"]).code, 2);
  const broken = makeRepo({ files: { [P.runYaml]: "version: [\n" } });
  const b = run(broken, "next.mjs");
  assert.equal(b.code, 1);
  assert.equal(b.stdout, "");
  assert.doesNotMatch(b.stderr, /at .*\.mjs:\d+/, "no stack trace");
});
