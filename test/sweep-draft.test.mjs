import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rangeCommits } from "../skills/hsdd-intake/scripts/lib/git.mjs";
import { readTree } from "../skills/hsdd-intake/scripts/lib/tree.mjs";
import { resolveRange, reasonOf, rowFor, draftFor, recordOf } from "../skills/hsdd-intake/scripts/lib/draft.mjs";
import { Refusal } from "../skills/hsdd-intake/scripts/lib/git.mjs";
import { sweepRepo } from "./helpers/sweep-fixture.mjs";
import { gitIn, write, initRepo } from "./helpers/seal-fixture.mjs";

const fx = sweepRepo();
const tree = readTree(fx.root);
const s7 = (k) => fx.shas[k].slice(0, 7);
const rec = (to, over = {}) => ({ repo: "acme", to, date: "2026-11-01", filename: `2026-11-01-sweep-acme-${to.slice(0, 7)}.md`, rows: [], ...over });
const range = (opts, records = []) => resolveRange(fx.root, { repo: "acme", to: fx.shas.contract, ...opts }, records);

test("resolveRange: a first sweep with no --from is refused", () => assert.throws(() => range({}), /first sweep .* --from/));
test("resolveRange: --to off the main line", () => {
  const r = sweepRepo();
  gitIn(r.root, "checkout", "-q", "-b", "lone");
  write(r.root, "x.txt", "x\n");
  gitIn(r.root, "add", "-A");
  gitIn(r.root, "commit", "-q", "-m", "lone");
  const lone = gitIn(r.root, "rev-parse", "HEAD");
  gitIn(r.root, "checkout", "-q", "main");
  assert.throws(() => resolveRange(r.root, { repo: "acme", from: r.base, to: lone }, []), /not on the main line/);
  assert.throws(() => resolveRange(r.root, { repo: "acme", from: r.base, to: "nonesuch" }, []), /not on the main line/);
});
test("resolveRange: an unknown main line", () => assert.throws(() => range({ from: fx.base, main: "trunk" }), /no branch/));
test("resolveRange: an unknown --from", () => assert.throws(() => range({ from: "nonesuch" }), /not a commit/));
test("resolveRange: --from after --to", () => assert.throws(() => range({ from: fx.shas.contract, to: fx.shas.routeAdd }), /not an ancestor of/));
test("resolveRange: a value starting with - is refused before git sees it", () => {
  for (const k of ["from", "to", "main"]) assert.throws(() => range({ from: fx.base, [k]: "--output=x" }), (e) => e instanceof Refusal && /starts with "-"/.test(e.message));
});
test("resolveRange: a named --from", () => {
  const r = range({ from: fx.base });
  assert.deepEqual([r.repo, r.main, r.from, r.to, r.fromNote], ["acme", "main", fx.base, fx.shas.contract, "from named"]);
});
test("resolveRange: the default --from is the newest record's to", () => {
  const r = range({}, [rec(fx.shas.phaseTrailer)]);
  assert.equal(r.from, fx.shas.phaseTrailer);
  assert.equal(r.fromNote, "from 2026-11-01-sweep-acme-" + s7("phaseTrailer") + ".md");
});
test("resolveRange: a --from later than the previous record's to leaves a gap", () =>
  assert.throws(() => range({ from: fx.shas.routeAdd }, [rec(fx.shas.phaseTrailer)]), /leaves commits unswept/));
test("resolveRange: a --from on a side branch the previous to does not contain leaves a gap", () => {
  const d = mkdtempSync(join(tmpdir(), "hsdd-sweep-gap-"));
  initRepo(d);
  const commit = (f) => { write(d, f, f); gitIn(d, "add", "-A"); gitIn(d, "commit", "-q", "-m", f); return gitIn(d, "rev-parse", "HEAD"); };
  const a = commit("a");
  gitIn(d, "checkout", "-q", "-b", "x");
  const b = commit("b");
  gitIn(d, "checkout", "-q", "main");
  const c = commit("c");
  gitIn(d, "merge", "-q", "--no-ff", "-m", "m", "x");
  const o = { repo: "acme" };
  assert.throws(() => resolveRange(d, { ...o, from: c }, [rec(b)]), /leaves commits unswept/);
  assert.equal(resolveRange(d, { ...o, from: a }, [rec(b)]).from, a);
});
test("resolveRange: an ancestor --from is accepted", () => {
  assert.equal(range({ from: fx.base }, [rec(fx.shas.phaseTrailer)]).from, fx.base);
  assert.equal(range({ from: fx.shas.phaseTrailer }, [rec(fx.shas.phaseTrailer)]).from, fx.shas.phaseTrailer);
});

const c = { sha: "a".repeat(40), subject: "s" };
test("rowFor: move, spans, a move with spans, neither", () => {
  assert.deepEqual(rowFor(c, ["route added GET /x"], { node: "n", spans: [] }), { sha: "aaaaaaa", node: "n", cls: "intake", reason: "route added GET /x", subject: "s" });
  assert.deepEqual(rowFor(c, [], { node: null, spans: ["a", "b"] }), { sha: "aaaaaaa", node: "none", cls: "intake", reason: "spans a, b", subject: "s" });
  assert.deepEqual(rowFor(c, ["m1", "m2"], { node: null, spans: ["a", "b"] }), { sha: "aaaaaaa", node: "none", cls: "intake", reason: "m1, +1 more", subject: "s" });
  assert.deepEqual(rowFor(c, [], { node: null, spans: [] }), { sha: "aaaaaaa", node: "?", cls: "?", reason: "?", subject: "s" });
  assert.deepEqual(rowFor(c, [], { node: "n", spans: [] }), { sha: "aaaaaaa", node: "n", cls: "?", reason: "?", subject: "s" });
});
test("reasonOf counts the rest", () => {
  assert.equal(reasonOf(["a", "b", "c"]), "a, +2 more");
  assert.equal(reasonOf(["a"]), "a");
});

test("draftFor over the fixture", () => {
  const d = draftFor(fx.root, { from: fx.base, to: fx.shas.contract }, tree, new Map());
  const row = (k) => d.rows.find((r) => r.sha === s7(k));
  assert.deepEqual([row("routeAdd").cls, row("routeAdd").reason, row("routeAdd").node], ["intake", "route added POST /payouts/preview", "acme.web"]);
  assert.deepEqual([row("schema").cls, row("schema").node], ["intake", "?"]);
  assert.equal(row("migration").reason, "table added holds, +1 more");
  assert.deepEqual([row("spans").cls, row("spans").reason, row("spans").node], ["intake", "spans acme.reports, acme.web", "none"]);
  assert.deepEqual([row("log").cls, row("log").reason, row("log").node], ["?", "?", "acme.web"]);
  assert.deepEqual([row("asBuilt").cls, row("asBuilt").node], ["?", "acme.reports"]);
  assert.equal(row("unowned").node, "?");
  assert.equal(d.rows.length, d.aside.candidates.length);
  assert.equal(d.commits.length, rangeCommits(fx.root, fx.base, fx.shas.contract).length);
});

test("recordOf", () => {
  const d = draftFor(fx.root, { from: fx.base, to: fx.shas.contract }, tree, new Map());
  const r = recordOf({ repo: "acme", named: "--repo", main: "main", from: fx.base, to: fx.shas.contract, fromNote: "from named" }, "2026-11-05", undefined, d);
  const intake = d.rows.filter((x) => x.cls === "intake").length;
  assert.deepEqual([r.runBy, r.status, r.routing, r.produced, r.date], ["?", "open", ["none"], ["none"], "2026-11-05"]);
  assert.deepEqual([r.commits, r.candidates], [d.commits.length, d.rows.length]);
  assert.deepEqual(r.changeLog, [`- 2026-11-05: created; ${d.rows.length} candidates: ? log, ? retro, ${intake} intake, ? unplaced, ? phase`]);
  assert.equal(recordOf({ repo: "a", from: "b", to: "c" }, "2026-11-05", "Purbo", d).runBy, "Purbo");
});
