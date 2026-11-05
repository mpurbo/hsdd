import { test } from "node:test";
import assert from "node:assert/strict";
import { runGit, resolveCommit, isAncestor, rangeCommits, showAt } from "../skills/hsdd-intake/scripts/lib/git.mjs";
import { readTree } from "../skills/hsdd-intake/scripts/lib/tree.mjs";
import { sweepRepo, sweepProfileRepo } from "./helpers/sweep-fixture.mjs";

const fx = sweepRepo();

test("rangeCommits walks side branches and keeps the merge", () => {
  const cs = rangeCommits(fx.root, fx.base, fx.shas.contract);
  assert.deepEqual(cs.find((c) => c.sha === fx.shas.side).paths, ["src/web/app.js"]);
  const m = cs.find((c) => c.sha === fx.shas.merge);
  assert.equal(m.parents.length, 2); assert.deepEqual(m.paths, []);
});
test("rangeCommits is oldest first and carries subject, body and date", () => {
  const cs = rangeCommits(fx.root, fx.base, fx.shas.contract);
  assert.equal(cs[0].sha, fx.shas.side);
  assert.equal(cs.at(-1).sha, fx.shas.contract);
  const t = cs.find((c) => c.sha === fx.shas.phaseTrailer);
  assert.equal(t.subject, "web: tidy"); assert.equal(t.message, "web: tidy\n\nPhase: acme.web.1");
  assert.match(t.date, /^\d{4}-\d{2}-\d{2}$/);
});
test("a path with a space survives", () => assert.ok(rangeCommits(fx.root, fx.base, fx.shas.spaced).at(-1).paths.includes("src/web/my assets/logo name.js")));
test("a nested project root reads relative paths and drops commits outside it", () => {
  const n = sweepRepo({ nested: true }); const cs = rangeCommits(n.root, n.base, n.shas.contract);
  assert.ok(!cs.some((c) => c.sha === n.shas.outside));
  assert.ok(cs.some((c) => c.paths.includes("src/web/app.js")));
});
test("showAt: a blob, a deleted path, a path with a space, a directory", () => {
  assert.equal(showAt(fx.root, fx.shas.copy, "src/web/old.js").toString(), 'app.delete("/payouts/old", h);\n');
  assert.equal(showAt(fx.root, fx.shas.removed, "src/web/old.js"), null);
  assert.equal(showAt(fx.root, fx.shas.spaced, "src/web/my assets/logo name.js").toString(), "// logo\n");
  assert.equal(showAt(fx.root, fx.shas.spaced, "src/web"), null);
  const n = sweepRepo({ nested: true });
  assert.ok(showAt(n.root, n.shas.contract, "src/web/app.js"));
});
test("isAncestor: true, false, and a bad ref throws", () => {
  assert.equal(isAncestor(fx.root, fx.base, fx.shas.contract), true);
  assert.equal(isAncestor(fx.root, fx.shas.contract, fx.base), false);
  assert.throws(() => isAncestor(fx.root, "nonesuch", fx.base));
});
test("resolveCommit: a sha resolves, a bad ref is null; runGit trims one newline", () => {
  assert.equal(resolveCommit(fx.root, fx.base), fx.base);
  assert.equal(resolveCommit(fx.root, "nonesuch"), null);
  assert.equal(runGit(fx.root, ["rev-parse", "HEAD"]), fx.shas.contract);
});
test("readTree: scopes leave out the retired node, adopted is read", () => {
  const t = readTree(fx.root);
  assert.deepEqual(t.scopes.map((s) => s.node).sort(), ["acme.reports", "acme.web"]);
  assert.deepEqual(t.scopes.find((s) => s.node === "acme.web").prefixes, ["src/web/"]);
  assert.equal(t.nodes.get("acme.reports").adopted, "as-built");
  assert.ok(t.phaseIds.includes("acme.web.2"));
});
test("the profile fixture reads the same tree and its pointer commit has no project path but the gitlink", () => {
  const p = sweepProfileRepo();
  assert.deepEqual(readTree(p.root).scopes.map((s) => s.node).sort(), ["acme.reports", "acme.web"]);
  assert.deepEqual(rangeCommits(p.root, p.base, p.shas.log).map((c) => c.sha), [p.shas.pointer, p.shas.log]);
});
