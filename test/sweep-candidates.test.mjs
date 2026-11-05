import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeCommits } from "../skills/hsdd-intake/scripts/lib/git.mjs";
import { readTree } from "../skills/hsdd-intake/scripts/lib/tree.mjs";
import { isGovernancePath, phaseIdsIn, unknownIdsIn, shaTokensIn, setAside, asideLines, place } from "../skills/hsdd-intake/scripts/lib/candidates.mjs";
import { sweepRepo } from "./helpers/sweep-fixture.mjs";

const fx = sweepRepo();
const commits = rangeCommits(fx.root, fx.base, fx.shas.contract);
const tree = readTree(fx.root);
const commit = (key) => commits.find((c) => c.sha === fx.shas[key]);
const s7 = (key) => fx.shas[key].slice(0, 7);

test("phaseIdsIn is boundary-safe", () => {
  assert.deepEqual(phaseIdsIn("per acme.web.20", ["acme.web.2"]), []);
  assert.deepEqual(phaseIdsIn("acme.web.2: done.", ["acme.web.2"]), ["acme.web.2"]);
  assert.deepEqual(phaseIdsIn("xacme.web.2 and acme.web.2-b", ["acme.web.2"]), []);
  assert.deepEqual(phaseIdsIn("see acme.web.2.1", ["acme.web.2"]), []);
});

test("unknownIdsIn ignores versions and file names", () => {
  assert.deepEqual(unknownIdsIn("bump v1.2.3, per acme.web.20", ["acme.web"], ["acme.web.2"]), ["acme.web.20"]);
  assert.deepEqual(unknownIdsIn("acme.web.2 and acme.web.js and acme.web", ["acme.web"], ["acme.web.2"]), []);
});

test("setAside on the fixture", () => {
  const a = setAside(commits, tree, new Map());
  assert.deepEqual(a.merges, [s7("merge")]);
  assert.deepEqual(a.governance, [s7("gov"), s7("citing")]);
  assert.deepEqual(a.attributed.map((x) => x.sha), [s7("phaseSubject"), s7("phaseTrailer"), s7("cited")]);
  assert.deepEqual(a.attributed.map((x) => x.phases), [["acme.web.2"], ["acme.web.1"], ["acme.web.3"]]);
  assert.deepEqual(a.unknown, [{ sha: s7("unknownId"), id: "acme.web.20" }]);
  assert.ok(a.candidates.some((c) => c.sha === fx.shas.side), "a commit a merge brought in is a candidate");
  assert.ok(a.candidates.some((c) => c.sha === fx.shas.unknownId));
  assert.ok(!a.candidates.some((c) => c.sha === fx.shas.merge || c.sha === fx.shas.gov || c.sha === fx.shas.phaseSubject));
});

test("a commit a phase's Scope cites is listed under attributed, and the rest of that Scope attributes nothing", () => {
  const a = setAside(commits, tree, new Map());
  assert.ok(!a.candidates.some((c) => c.sha === fx.shas.cited));
  assert.match(asideLines(a)[2], new RegExp(`${s7("cited")} -> acme\\.web\\.3$`));
  assert.ok(a.candidates.some((c) => c.sha === fx.shas.log), "the sha ending a record's filename in the Scope is no citation");
  assert.equal(commits.filter((c) => c.sha.startsWith("feedbee")).length, 0, "feedbee is no commit's prefix");
  assert.equal(a.attributed.length, 3);
});

test("setAside groups classified commits by record", () => {
  const classified = new Map([[s7("log"), "2026-01-01-sweep-a.md"], [s7("copy"), "2026-01-01-sweep-a.md"], [s7("topic"), "2026-02-02-sweep-b.md"]]);
  const a = setAside(commits, tree, classified);
  assert.deepEqual(a.classified, [
    { filename: "2026-01-01-sweep-a.md", shas: [s7("copy"), s7("log")] },
    { filename: "2026-02-02-sweep-b.md", shas: [s7("topic")] },
  ]);
  assert.ok(!a.candidates.some((c) => [fx.shas.log, fx.shas.copy, fx.shas.topic].includes(c.sha)));
});

test("a merge is set aside before the classified test", () => {
  const a = setAside(commits, tree, new Map([[s7("merge"), "r.md"]]));
  assert.deepEqual(a.merges, [s7("merge")]);
  assert.deepEqual(a.classified, []);
});

test("the gitlink alone is governance-only", () => assert.equal(isGovernancePath("hsdd"), true));
test("governance prefixes", () => {
  for (const p of ["hsdd/x.md", "hsdd-context/a", "openspec/b/c"]) assert.equal(isGovernancePath(p), true);
  assert.equal(isGovernancePath("src/hsdd/x"), false);
});
test("hsdd-contextual is not governance", () => assert.equal(isGovernancePath("hsdd-contextual/x.js"), false));

const rows = {
  side: "acme.web", unknownId: "acme.web", routeAdd: "acme.web", schema: null, migration: "acme.web", alter: "acme.web",
  topic: "acme.web", copy: "acme.web", moved: "acme.web", removed: "acme.web", spaced: "acme.web", log: "acme.web",
  asBuilt: "acme.reports", unowned: null, retired: null, trailer: "acme.web", cited: "acme.web", contract: "acme.web",
};
for (const [key, node] of Object.entries(rows)) {
  test(`place: ${key}`, () => assert.deepEqual(place(commit(key), tree), { node, spans: [] }));
}
for (const key of ["spans", "trailerSpan"]) {
  test(`place: ${key}`, () => assert.deepEqual(place(commit(key), tree), { node: null, spans: ["acme.reports", "acme.web"] }));
}

const mk = (paths, message = "x") => ({ sha: "a".repeat(40), parents: ["b"], date: "", subject: "x", message, paths });
const t2 = (scopes) => ({ nodes: new Map([["a", { status: "active" }], ["b", { status: "active" }]]), nodeIds: ["a", "b"], phaseIds: [], scopes });

test("a ./ scope and a narrower scope both covering gives null, not spans", () => {
  const t = t2([{ node: "a", prefixes: ["./"] }, { node: "b", prefixes: ["src/b/"] }]);
  assert.deepEqual(place(mk(["src/b/x.js"]), t), { node: null, spans: [] });
});
test("partly unowned paths give null, not spans", () => {
  const t = t2([{ node: "a", prefixes: ["src/a/"] }]);
  assert.deepEqual(place(mk(["src/a/x.js", "other/y.js"]), t), { node: null, spans: [] });
});
test("a trailer naming a retired or unknown node is ignored", () => {
  const t = { ...t2([{ node: "a", prefixes: ["src/a/"] }]), nodes: new Map([["a", { status: "active" }], ["b", { status: "retired" }]]) };
  assert.equal(place(mk(["z/y.js"], "x\n\nHSDD-Node: b"), t).node, null);
  assert.equal(place(mk(["z/y.js"], "x\n\nHSDD-Node: nope"), t).node, null);
  assert.equal(place(mk(["z/y.js"], "x\n\nHSDD-Node: a"), t).node, "a");
});
test("governance paths are left out of placement", () => {
  const t = t2([{ node: "a", prefixes: ["src/a/"] }]);
  assert.deepEqual(place(mk(["hsdd/c.md", "src/a/x.js"]), t), { node: "a", spans: [] });
});

test("shaTokensIn reads whole tokens of 7 to 40 lower-case hex characters", () => {
  assert.deepEqual(shaTokensIn("commits a1b2c3d, `b2c3d4e5` and acme@c3d4e5f."), ["a1b2c3d", "b2c3d4e5", "c3d4e5f"]);
  assert.deepEqual(shaTokensIn(`${"a".repeat(40)} ${"b".repeat(41)}`), ["a".repeat(40)]);
  for (const t of ["a1b2c3", "A1B2C3D", "a1b2c3dz", "za1b2c3d", "a1b2c3d-x", "2026-11-05-sweep-acme-a1b2c3d.md"]) assert.deepEqual(shaTokensIn(t), [], t);
});

const cites = (scopeShas, more = {}) => ({ nodes: new Map(), nodeIds: [], phaseIds: [], scopes: [], scopeShas, ...more });
const sha = "abcdef0" + "1".repeat(33);
const hotfix = (message = "x") => ({ ...mk(["src/a/x.js"], message), sha });

test("setAside: a listed token that starts the full sha attributes the commit to that phase", () => {
  for (const token of ["abcdef0", "abcdef01", sha]) {
    const a = setAside([hotfix()], cites([{ sha: token, phase: "a.3" }]), new Map());
    assert.deepEqual(a.attributed, [{ sha: "abcdef0", phases: ["a.3"] }], token);
    assert.deepEqual(a.candidates, [], token);
  }
});
test("setAside: a Scope token that is hex but no commit's prefix attributes nothing", () => {
  for (const token of ["feedbee", "bcdef01", "abcdef02"]) {
    const a = setAside([hotfix()], cites([{ sha: token, phase: "a.3" }]), new Map());
    assert.deepEqual(a.attributed, [], token);
    assert.equal(a.candidates.length, 1, token);
  }
});
test("setAside: every citing phase is listed once", () => {
  const scopeShas = [{ sha: "abcdef0", phase: "a.3" }, { sha: "abcdef01", phase: "a.3" }, { sha: "abcdef0", phase: "a.4" }];
  assert.deepEqual(setAside([hotfix()], cites(scopeShas), new Map()).attributed, [{ sha: "abcdef0", phases: ["a.3", "a.4"] }]);
});
test("setAside: the Scope test runs after the message test and before the classified test", () => {
  const scopeShas = [{ sha: "abcdef0", phase: "a.3" }];
  const named = setAside([hotfix("a.1: done")], cites(scopeShas, { phaseIds: ["a.1", "a.3"] }), new Map());
  assert.deepEqual(named.attributed, [{ sha: "abcdef0", phases: ["a.1"] }]);
  const classified = setAside([hotfix()], cites(scopeShas), new Map([["abcdef0", "r.md"]]));
  assert.deepEqual([classified.attributed.length, classified.classified], [1, []]);
});

test("asideLines reads none for an empty category", () => {
  const empty = { merges: [], governance: [], attributed: [], classified: [], unknown: [], candidates: [] };
  assert.deepEqual(asideLines(empty), ["- merges: none", "- governance-only: none", "- attributed: none", "- classified by: none", "- unknown phase id: none"]);
});
test("asideLines lists each category", () => {
  const a = { merges: ["aaaaaaa"], governance: ["bbbbbbb", "ccccccc"], attributed: [{ sha: "ddddddd", phases: ["p.1", "p.2"] }], classified: [{ filename: "r.md", shas: ["eeeeeee"] }], unknown: [{ sha: "fffffff", id: "x.20" }], candidates: [] };
  assert.deepEqual(asideLines(a), [
    "- merges: 1 (aaaaaaa)", "- governance-only: 2 (bbbbbbb, ccccccc)", "- attributed: ddddddd -> p.1, p.2",
    "- classified by r.md: eeeeeee", "- unknown phase id: fffffff names x.20",
  ]);
});
