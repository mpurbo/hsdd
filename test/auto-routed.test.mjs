import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  closeItem, decideItem, ingest, leafParentsOf, lineErrors, main, markAddressed, matches, nextQueueId, openItem,
  openMatching, queueItems,
} from "../skills/hsdd-auto/scripts/routed.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { readJsonl } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { P } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { makeRepo, fakeStep, run } from "./helpers/auto-repo.mjs";

const SEGMENT = "2026-10-22-plan";
const put = (dir, rel, content) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const queue = (dir) => readJsonl(dir, P.queue);
const report = (step, over = {}) => ({
  step_ref: step, skill: "hsdd-spec", target: "shop.api", status: "completed", stop: null, artifacts: [], experiments: [],
  self_check: [], routed: [], closes: [], reads_outside: [], notes: [], read_check: "00000000", ...over,
});
const putReport = (dir, step, over, name = `${step}.json`) => put(dir, `hsdd/auto/steps/${name}`, JSON.stringify(report(step, over)));
const open = (id, over = {}) => ({ id, at: "2026-10-22T10:00:00Z", status: "open", from: "S01", target: "shop.api", kind: "must-address", text: `t ${id}`, ...over });
const line = (id, status, at, over = {}) => ({ id, at, status, ...over });
const silent = () => { const out = []; return { out, log: (l) => out.push(l) }; };

test("open, close, decide; state is the last line", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const id = openItem(dir, { from: "S01", target: "run", kind: "consider", text: "look at the size limit" });
  assert.equal(id, "Q-001");
  assert.equal(queueItems(queue(dir)).get("Q-001").status, "open");
  closeItem(dir, "Q-001", { outcome: "explained", by: "S03", note: "out of scope" });
  const item = queueItems(queue(dir)).get("Q-001");
  assert.equal(item.status, "explained");
  assert.deepEqual(item.events.map((e) => e.status), ["open", "explained"]);
  assert.equal(item.kind, "consider");
  assert.equal(main(["list", "--open"], dir, silent()), 0);
  const listed = silent();
  main(["list", "--open"], dir, listed);
  assert.deepEqual(listed.out, ["0 item(s), 0 open"]);

  const ins = openItem(dir, { from: "S02", target: "run", kind: "insert-step", text: "touch the spec", step_kind: "spec-touch", step_target: "shop.api", after: "handoffs" });
  assert.equal(ins, "Q-002");
  decideItem(dir, ins, { outcome: "accepted", decision: "DEC-004" });
  assert.equal(queueItems(queue(dir)).get(ins).status, "accepted");
  assert.equal(markAddressed(dir, ins, "S05", "the touch committed"), true);
  assert.equal(markAddressed(dir, ins, "S05", "the touch committed"), false);
  assert.equal(queue(dir).filter((l) => l.id === ins).length, 3);
  assert.equal(queueItems(queue(dir)).get(ins).status, "addressed");
  assert.equal(queueItems(queue(dir)).get(ins).after, "handoffs");
});

test("matching rule for each target form", () => {
  const leafParents = ["shop.api", "shop.web.app"];
  const item = (target, kind = "must-address") => ({ target, kind });
  const step = (target, handoff = null) => ({ target, handoff });
  assert.equal(matches(item("shop.api"), step("shop.api"), leafParents), true);
  assert.equal(matches(item("shop.api"), step("shop.web"), leafParents), false);
  assert.equal(matches(item("order-api"), step("order-api"), leafParents), true);
  assert.equal(matches(item("ADR-003"), step("ADR-003"), leafParents), true);
  assert.equal(matches(item("shop.api"), step("shop.api,shop.web.app"), leafParents), true);
  assert.equal(matches(item("shop.api"), step("shop.web.app, shop.api"), leafParents), true);
  assert.equal(matches(item("shop.web"), step("shop.api,shop.web.app"), leafParents), false);
  assert.equal(matches(item("shop.api"), step("all"), leafParents), true);
  assert.equal(matches(item("shop.web"), step("all"), leafParents), false);
  assert.equal(matches(item("H7a"), step("shop.api", "H7a"), leafParents), true);
  assert.equal(matches(item("H7a"), step("shop.api", null), leafParents), false);
  assert.equal(matches(item("H7b"), step("shop.api", "H7a"), leafParents), false);
  assert.equal(matches(item("run", "insert-step"), step("run"), leafParents), false);
  assert.equal(matches(item("shop.api", "insert-step"), step("shop.api"), leafParents), false);
  assert.equal(matches(item("ref/spec.md"), step("ref/spec.md"), leafParents), true);
});

test("leafParentsOf: leaf-parents that are not retired", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const tree = loadContext(dir).tree;
  assert.deepEqual(leafParentsOf(tree), ["shop.api", "shop.web.app"]);
  const retired = { nodes: new Map([["a", { id: "a", kind: "leaf-parent", status: "retired" }], ["b", { id: "b", kind: "leaf-parent", status: "active" }], ["c", { id: "c", kind: "internal" }]]) };
  assert.deepEqual(leafParentsOf(retired), ["b"]);
});

test("openMatching: state now and at a time, oldest first, insert-step never", () => {
  const lines = [
    open("Q-002", { at: "2026-10-22T10:05:00Z" }),
    open("Q-001", { at: "2026-10-22T10:00:00Z" }),
    line("Q-001", "explained", "2026-10-22T10:20:00Z", { by: "S02", note: "n" }),
    open("Q-003", { at: "2026-10-22T10:30:00Z" }),
    open("Q-004", { at: "2026-10-22T10:06:00Z", target: "run", kind: "insert-step", step_kind: "spec-touch", step_target: "shop.api" }),
    open("Q-005", { target: "shop.web" }),
  ];
  const step = { target: "shop.api", handoff: null };
  const ids = (xs) => xs.map((i) => i.id);
  assert.deepEqual(ids(openMatching(lines, step, [])), ["Q-002", "Q-003"]);
  assert.deepEqual(ids(openMatching(lines, step, [], "2026-10-22T10:10:00Z")), ["Q-001", "Q-002"]);
  assert.deepEqual(ids(openMatching(lines, step, [], "2026-10-22T10:20:00Z")), ["Q-002"]);
  assert.deepEqual(ids(openMatching(lines, step, [], "2026-10-22T09:00:00Z")), []);
  assert.deepEqual(ids(openMatching(lines, step, [], "2026-10-22T10:00:00Z")), ["Q-001"]);
  assert.deepEqual(ids(openMatching(lines, { target: "run", handoff: null }, [])), []);
});

test("queueItems ignores an orphan line; nextQueueId follows the highest id", () => {
  const lines = [line("Q-009", "explained", "2026-10-22T10:00:00Z"), open("Q-002"), open("Q-1000")];
  assert.deepEqual([...queueItems(lines).keys()], ["Q-002", "Q-1000"]);
  assert.equal(nextQueueId([]), "Q-001");
  assert.equal(nextQueueId(lines), "Q-1001");
  assert.equal(nextQueueId([open("Q-007")]), "Q-008");
});

const withStep = (dir, step, kind = "spec-touch", target = "shop.api") =>
  fakeStep(dir, { step, segment: SEGMENT, kind, target });

test("ingest dedupes open lines by text and records closes once", () => {
  const dir = makeRepo({ stage: "06-planned" });
  openItem(dir, { from: "S00", target: "shop.api", kind: "must-address", text: "add the currency field" });
  withStep(dir, "S01");
  putReport(dir, "S01", {
    routed: [
      { target: "shop.web.app", kind: "consider", text: "show the currency" },
      { target: "shop.web.app", kind: "consider", text: "show the currency" },
      { target: "order-api", kind: "must-address", text: "document the field" },
      { target: "shop.api", kind: "insert-step", text: "split the spec", step_kind: "spec-touch", step_target: "shop.api" },
    ],
    closes: [{ id: "Q-001", outcome: "addressed", note: "done" }],
  });
  putReport(dir, "S01", { routed: [{ target: "shop.web", kind: "consider", text: "later launch" }], closes: [{ id: "Q-001", outcome: "addressed", note: "done" }] }, "S01.r1.json");
  const first = ingest(dir, "S01", loadContext(dir));
  assert.deepEqual(first.opened, ["Q-002", "Q-003", "Q-004", "Q-005"]);
  assert.deepEqual(first.closed, [{ id: "Q-001", status: "addressed" }]);
  const after = queue(dir);
  assert.equal(after.length, 6);
  const second = ingest(dir, "S01", loadContext(dir));
  assert.deepEqual(second, { opened: [], closed: [], skipped: [] });
  assert.equal(queue(dir).length, 6);
  const items = queueItems(queue(dir));
  assert.equal(items.get("Q-001").status, "addressed");
  assert.equal(items.get("Q-001").events.at(-1).by, "S01");
  assert.equal(items.get("Q-002").from, "S01");
  assert.equal(items.get("Q-004").target, "run");
  assert.equal(items.get("Q-004").step_kind, "spec-touch");
  assert.equal(items.get("Q-005").text, "later launch");
});

test("ingest writes nothing when a line is invalid", () => {
  const dir = makeRepo({ stage: "06-planned" });
  withStep(dir, "S01");
  putReport(dir, "S01", {
    routed: [{ target: "shop.api", kind: "must-address", text: "ok" }],
    closes: [{ id: "Q-077", outcome: "addressed", note: "no such item" }],
  });
  assert.throws(() => ingest(dir, "S01", loadContext(dir)), /Q-077 has no open line/);
  assert.deepEqual(queue(dir), []);
  assert.throws(() => ingest(dir, "S09", loadContext(dir)), /no readable dispatch/);
});

test("ingest skips an align repeat of an explained item", () => {
  const dir = makeRepo({ stage: "06-planned" });
  withStep(dir, "S01");
  putReport(dir, "S01", { routed: [{ target: "shop.api", kind: "consider", text: "the error envelope differs" }] });
  ingest(dir, "S01", loadContext(dir));
  withStep(dir, "S02");
  putReport(dir, "S02", { closes: [{ id: "Q-001", outcome: "explained", note: "by design" }] });
  ingest(dir, "S02", loadContext(dir));
  assert.equal(queueItems(queue(dir)).get("Q-001").status, "explained");

  // a non-align step routing the same text opens it again
  withStep(dir, "S03");
  putReport(dir, "S03", { routed: [{ target: "shop.api", kind: "consider", text: "the error envelope differs" }] });
  assert.deepEqual(ingest(dir, "S03", loadContext(dir)).opened, ["Q-002"]);

  // an align step does not
  withStep(dir, "S04", "align", "all");
  putReport(dir, "S04", { skill: "hsdd-reconcile", target: "all", routed: [
    { target: "shop.api", kind: "consider", text: "the error envelope differs" },
    { target: "shop.api", kind: "consider", text: "a new finding" },
  ] });
  const r = ingest(dir, "S04", loadContext(dir));
  assert.deepEqual(r.opened, ["Q-003"]);
  assert.deepEqual(r.skipped.map((e) => e.text), ["the error envelope differs"]);
  assert.equal(queue(dir).filter((l) => l.status === "open").length, 3);
});

test("an align repeat is skipped only when the explained item was closed in this segment", () => {
  const dir = makeRepo({ stage: "06-planned" });
  fakeStep(dir, { step: "S01", segment: "2026-10-20-plan", kind: "spec-touch", target: "shop.api" });
  putReport(dir, "S01", { routed: [{ target: "shop.api", kind: "consider", text: "old finding" }] });
  ingest(dir, "S01", loadContext(dir));
  fakeStep(dir, { step: "S02", segment: "2026-10-20-plan", kind: "spec-touch", target: "shop.api" });
  putReport(dir, "S02", { closes: [{ id: "Q-001", outcome: "explained", note: "n" }] });
  ingest(dir, "S02", loadContext(dir));
  fakeStep(dir, { step: "S03", segment: "2026-10-22-plan", kind: "align", target: "all" });
  putReport(dir, "S03", { skill: "hsdd-reconcile", target: "all", routed: [{ target: "shop.api", kind: "consider", text: "old finding" }] });
  assert.deepEqual(ingest(dir, "S03", loadContext(dir)).opened, ["Q-002"]);
});

test("decide rejects a non insert-step item; close rejects a node-targeted item", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const a = openItem(dir, { from: "S01", target: "shop.api", kind: "must-address", text: "node targeted" });
  const b = openItem(dir, { from: "S01", target: "run", kind: "must-address", text: "run targeted" });
  const c = openItem(dir, { from: "S01", target: "ref/spec-v2.md", kind: "consider", text: "request targeted" });
  const d = openItem(dir, { from: "S01", target: "run", kind: "insert-step", text: "x", step_kind: "adr", step_target: "ADR-004" });
  assert.throws(() => decideItem(dir, a, { outcome: "accepted", decision: "DEC-001" }), /only an insert-step item/);
  assert.throws(() => closeItem(dir, a, { outcome: "explained", by: "S02", note: "n" }), /targets shop\.api/);
  assert.throws(() => closeItem(dir, d, { outcome: "explained", by: "S02", note: "n" }), /insert-step/);
  assert.throws(() => closeItem(dir, "Q-099", { outcome: "explained", by: "S02", note: "n" }), /not in the queue/);
  closeItem(dir, b, { outcome: "addressed", by: "S02", note: "n" });
  closeItem(dir, c, { outcome: "explained", by: "S02", note: "n" });
  assert.throws(() => closeItem(dir, b, { outcome: "explained", by: "S02", note: "n" }), /already addressed/);
  decideItem(dir, d, { outcome: "rejected", decision: "DEC-002" });
  assert.throws(() => decideItem(dir, d, { outcome: "accepted", decision: "DEC-003" }), /already rejected/);
  assert.equal(queue(dir).length, 4 + 2 + 1);
});

test("an addressed line for an insert-step needs an accepted line first", () => {
  const base = [open("Q-001", { target: "run", kind: "insert-step", step_kind: "spec-touch", step_target: "shop.api" })];
  const addressed = line("Q-001", "addressed", "2026-10-22T11:00:00Z", { by: "S05", note: "n" });
  assert.match(lineErrors(base, addressed).join(), /only after it is accepted/);
  const accepted = [...base, line("Q-001", "accepted", "2026-10-22T10:30:00Z", { decision: "DEC-001" })];
  assert.deepEqual(lineErrors(accepted, addressed), []);
  assert.match(lineErrors(base, line("Q-001", "explained", "2026-10-22T11:00:00Z", { by: "S05", note: "n" })).join(), /never explained/);
  const dir = makeRepo({ stage: "06-planned" });
  const id = openItem(dir, { from: "S01", target: "run", kind: "insert-step", text: "x", step_kind: "adr", step_target: "ADR-004" });
  assert.throws(() => markAddressed(dir, id, "S05", "n"), /only after it is accepted/);
  assert.equal(queue(dir).length, 1);
});

test("line rules: open lines carry what A.5 requires", () => {
  const err = (l, lines = []) => lineErrors(lines, l).join("\n");
  assert.match(err({ id: "Q-001", at: "2026-10-22T10:00:00Z", status: "open", kind: "consider", text: "x" }), /from is required/);
  assert.match(err(open("Q-001", { kind: "insert-step", target: "shop.api", step_kind: "adr", step_target: "ADR-009" })), /targets run/);
  assert.match(err(open("Q-001", { kind: "insert-step", target: "run" })), /step_kind is required/);
  assert.match(err(open("Q-001", { after: "handoffs" })), /after is not allowed/);
  assert.match(err(open("Q-001", { step_kind: "adr" })), /step_kind is not allowed/);
  assert.match(err(open("Q-001", { kind: "insert-step", target: "run", step_kind: "intake", step_target: "x" })), /step_kind/);
  assert.match(err(open("Q-001", { kind: "insert-step", target: "run", step_kind: "adr", step_target: "x", after: "later" })), /after is a handoff id/);
  assert.deepEqual(err(open("Q-001", { kind: "insert-step", target: "run", step_kind: "adr", step_target: "x", after: "H3a" })), "");
  assert.match(err(open("Q-001"), [open("Q-001")]), /already exists/);
  assert.match(err(line("Q-001", "explained", "2026-10-22T10:00:00Z", { by: "S01" }), [open("Q-001")]), /note/);
  assert.match(err(line("Q-001", "explained", "2026-10-22T10:00:00Z", { by: "S01", note: "n", target: "run" }), [open("Q-001")]), /target is not allowed/);
  assert.match(err(line("Q-001", "accepted", "2026-10-22T10:00:00Z", { decision: "DEC-001" }), [open("Q-001")]), /only an insert-step/);
  assert.match(err(line("Q-001", "bogus", "2026-10-22T10:00:00Z")), /status/);
});

test("CLI prints one-line summary last and exits 2 on usage error", () => {
  const dir = makeRepo({ stage: "06-planned" });
  const r = run(dir, "routed.mjs", ["open", "--from", "S01", "--target", "run", "--kind", "consider", "--text", "check the limits"]);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim().split("\n").at(-1), "opened Q-001");
  const list = run(dir, "routed.mjs", ["list"]);
  assert.equal(list.code, 0);
  assert.deepEqual(list.stdout.trim().split("\n"), ["Q-001 open consider S01 -> run: check the limits", "1 item(s), 1 open"]);
  assert.equal(run(dir, "routed.mjs", ["list", "--target", "shop.api"]).stdout.trim(), "0 item(s), 0 open");
  const close = run(dir, "routed.mjs", ["close", "Q-001", "--explained", "--by", "S03", "--note", "fine as is"]);
  assert.equal(close.code, 0);
  assert.equal(close.stdout.trim(), "Q-001 explained");
  assert.equal(run(dir, "routed.mjs", ["list", "--open"]).stdout.trim(), "0 item(s), 0 open");

  for (const args of [[], ["frobnicate"], ["open", "--from", "S01"], ["close", "Q-001"], ["close", "Q-001", "--addressed", "--explained", "--by", "S01", "--note", "n"],
    ["open", "--from", "S01", "--target", "run", "--kind", "bogus", "--text", "x"], ["list", "--nope"], ["decide", "Q-001", "--decision", "DEC-001"], ["ingest"]]) {
    const u = run(dir, "routed.mjs", args);
    assert.equal(u.code, 2, `args ${JSON.stringify(args)}`);
    assert.equal(u.stdout.trim().split("\n").at(-1), "routed: usage error");
    assert.equal(u.stderr, "");
  }
  const failed = run(dir, "routed.mjs", ["close", "Q-050", "--explained", "--by", "S03", "--note", "n"]);
  assert.equal(failed.code, 1);
  assert.equal(failed.stdout.trim().split("\n").at(-1), "routed: failed, nothing written");
  assert.match(failed.stdout, /Q-050 is not in the queue/);
  assert.equal(queue(dir).length, 2);
});

test("CLI ingest and decide end to end", () => {
  const dir = makeRepo({ stage: "06-planned" });
  withStep(dir, "S01");
  putReport(dir, "S01", { routed: [
    { target: "shop.api", kind: "must-address", text: "one" },
    { target: "run", kind: "insert-step", text: "two", step_kind: "adr", step_target: "ADR-004" },
  ] });
  const r = run(dir, "routed.mjs", ["ingest", "--step", "S01"]);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), "ingest S01: opened 2 (Q-001, Q-002), recorded 0 close(s), skipped 0");
  const d = run(dir, "routed.mjs", ["decide", "Q-002", "--accepted", "--decision", "DEC-010"]);
  assert.equal(d.code, 0);
  assert.equal(d.stdout.trim(), "Q-002 accepted");
  assert.equal(run(dir, "routed.mjs", ["decide", "Q-001", "--accepted", "--decision", "DEC-011"]).code, 1);
  assert.equal(JSON.parse(readFileSync(join(dir, P.queue), "utf8").trim().split("\n").at(-1)).status, "accepted");
  const noDispatch = run(dir, "routed.mjs", ["ingest", "--step", "S77"]);
  assert.equal(noDispatch.code, 1);
});

test("openMatching orders by the numeric part of the id", () => {
  const lines = [open("Q-1000"), open("Q-999"), open("Q-100")];
  const step = { target: "shop.api", handoff: null };
  assert.deepEqual(openMatching(lines, step, []).map((i) => i.id), ["Q-100", "Q-999", "Q-1000"]);
});

test("ingest after a crash that wrote only the first of two lines ends with exactly two", () => {
  const dir = makeRepo({ stage: "06-planned" });
  withStep(dir, "S01");
  putReport(dir, "S01", { routed: [
    { target: "shop.api", kind: "must-address", text: "first" },
    { target: "shop.web", kind: "consider", text: "second" },
  ] });
  appendFileSync(join(dir, P.queue), `${JSON.stringify(open("Q-001", { from: "S01", target: "shop.api", text: "first" }))}\n`);
  const r = ingest(dir, "S01");
  assert.deepEqual(r.opened, ["Q-002"]);
  assert.deepEqual(queue(dir).map((l) => [l.id, l.text]), [["Q-001", "first"], ["Q-002", "second"]]);
  assert.deepEqual(ingest(dir, "S01").opened, []);
  assert.equal(queue(dir).length, 2);
});

test("ingest ignores defects in the config, the tree and the intake records", () => {
  const dir = makeRepo({ stage: "06-planned" });
  withStep(dir, "S01");
  putReport(dir, "S01", { routed: [{ target: "shop.api", kind: "consider", text: "x" }] });
  writeFileSync(join(dir, P.runYaml), "version: [unclosed\n");
  put(dir, "hsdd/specs/broken.md", "\u0000 not a spec\n");
  const r = run(dir, "routed.mjs", ["ingest", "--step", "S01"]);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(queue(dir).map((l) => l.id), ["Q-001"]);
});
