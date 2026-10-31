import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, withDefaults, currentSegment, ConfigError } from "../skills/hsdd-auto/scripts/lib/config.mjs";
import { git, GitError, headSha, currentBranch, branchExists, changedPaths, indexEmpty, headSubject, commitStamp, showFile, revExists, defaultBranch, listTree, changedSince } from "../skills/hsdd-auto/scripts/lib/git.mjs";
import { STAMP_RE } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { validate } from "../skills/hsdd-auto/scripts/lib/schema.mjs";
import { baseConfig, makeRepo, gitIn, run, fakeStep, addSegment, installScripts, SCRIPTS } from "./helpers/auto-repo.mjs";

const intake = { id: "2026-10-22-intake-x", mode: "intake", opened_at: "2026-10-22T10:00:00Z", instruction: "do it", stop_policy: "stop", first_step: "S00", request: "ref/x.md", authority: "ticket" };
const planSeg = { id: "2026-10-22-plan", mode: "plan", opened_at: "2026-10-22T10:00:00Z", instruction: "plan", stop_policy: "stop", first_step: "S00" };
const loadWith = (o) => loadConfig(makeRepo({ config: baseConfig(o) }));
const errorsOf = (o) => { try { loadWith(o); return null; } catch (e) { assert.ok(e instanceof ConfigError); return e.errors.join("\n"); } };

test("loadConfig applies defaults", () => {
  const c = loadWith({});
  assert.equal(c.rework_limit, 1);
  assert.equal(c.stop_set.length, 7);
  assert.equal(c.root, "shop");
  assert.equal(c.stop_policy, "stop");
  assert.deepEqual(c.commit, { trailers: [], artifact: "hsdd", judgement: "judgement", orchestrator: "auto" });
  assert.deepEqual(c.dispatch, { wait: "hand-back", fallback_wakeup_minutes: 30 });
  assert.deepEqual(c.prose_rules, { banned_chars: [], banned_phrases: [], token_forms: {}, level: "warn" });
  assert.deepEqual(c.segments, []);
  assert.deepEqual(c.sources.baseline, []);
  assert.deepEqual(c.sources.informative, []);
  assert.deepEqual(c.toolchain, { commands: {}, rules: [] });
  assert.deepEqual(c.predecided, {});
  assert.equal(c.experiments_dir, "hsdd/auto/experiments");
  assert.equal(c.report_dir, "hsdd/auto/report");
});
test("withDefaults keeps given values and does not mutate", () => {
  const raw = baseConfig({ root: "main-node", rework_limit: 0, commit: { artifact: "spec" }, stop_set: ["axis"] });
  const before = JSON.stringify(raw);
  const c = withDefaults(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(c.root, "main-node");
  assert.equal(c.rework_limit, 0);
  assert.equal(c.commit.artifact, "spec");
  assert.equal(c.commit.judgement, "judgement");
  assert.deepEqual(c.stop_set, ["axis"]);
});
test("a first-run file with a bare segments key loads as empty; currentSegment is the last entry", () => {
  const dir = makeRepo();
  assert.match(readFileSync(join(dir, "hsdd/auto/run.yaml"), "utf8"), /\nsegments:\n$/);
  assert.equal(currentSegment(loadConfig(dir)), null);
  addSegment(dir, planSeg);
  addSegment(dir, { ...planSeg, id: "2026-10-23-plan" });
  assert.equal(currentSegment(loadConfig(dir)).id, "2026-10-23-plan");
});
test("loadConfig code rules", () => {
  assert.match(errorsOf({ predecided: { upstream: { answer: "x", decision: "DEC-001" } } }), /predecided.*upstream/);
  assert.equal(errorsOf({ predecided: { axis: { answer: "x", decision: "DEC-001" } } }), null);
  const { authority, ...noAuthority } = intake;
  assert.match(errorsOf({ segments: [noAuthority] }), /authority/);
  const { request, ...noRequest } = intake;
  assert.match(errorsOf({ segments: [noRequest] }), /request/);
  assert.equal(errorsOf({ segments: [intake] }), null);
  assert.match(errorsOf({ segments: [planSeg, planSeg] }), /duplicate segment id 2026-10-22-plan/);
  const bl = { normative: [{ path: "ref/new.md", cite: "Spec" }], baseline: [{ path: "ref/old.md", cite: "Spec", version: "v0" }] };
  const msg = errorsOf({ sources: bl });
  assert.match(msg, /ref\/new\.md/);
  assert.doesNotMatch(msg, /ref\/old\.md/);
  assert.match(errorsOf({ sources: { normative: [{ path: "ref/new.md", cite: "Spec", version: "v1" }], baseline: [{ path: "ref/old.md", cite: "Spec" }] } }), /ref\/old\.md/);
  assert.equal(errorsOf({ sources: { normative: [{ path: "ref/new.md", cite: "Spec" }] } }), null);
});
test("read_only covers every source path", () => {
  const sources = {
    normative: [{ path: "ref/spec.md", cite: "Spec", version: "v2" }],
    informative: [{ path: "docs/guide.md", cite: "Guide", version: "v2" }],
    baseline: [{ path: "./old/spec-v1.md", cite: "Spec", version: "v1" }],
  };
  // The exact path, a directory entry with or without its trailing slash, and a glob the gate also reads.
  assert.equal(errorsOf({ sources, read_only: ["ref/", "docs/guide.md", "old"] }), null);
  assert.equal(errorsOf({ sources, read_only: ["ref/**", "docs/*.md", "./old/"] }), null);
  const msg = errorsOf({ sources, read_only: ["ref/", "refs/old/"] });
  assert.match(msg, /read_only: sources\.informative path docs\/guide\.md is not covered by any read_only entry/);
  assert.match(msg, /read_only: sources\.baseline path \.\/old\/spec-v1\.md is not covered/);
  assert.doesNotMatch(msg, /ref\/spec\.md/);
  // A directory entry covers what is inside it, never a sibling that shares its prefix.
  assert.match(errorsOf({ sources: { normative: [{ path: "ref-2/spec.md", cite: "Spec" }] }, read_only: ["ref"] }), /ref-2\/spec\.md is not covered/);
  assert.match(errorsOf({ sources: { normative: [{ path: "ref/spec.md", cite: "Spec" }] }, read_only: [] }), /ref\/spec\.md is not covered/);
});
test("owner_files entries are plain file paths", () => {
  for (const entry of ["notes/", "notes/*.md", "notes/a?.md", "notes/[ab].md"]) {
    const msg = errorsOf({ owner_files: ["CLAUDE.md", entry] });
    assert.ok(msg?.includes(`owner_files: ${entry} is not a plain file path`), `${entry}: ${msg}`);
    assert.ok(!msg.includes("CLAUDE.md is"), "a plain path is not named");
  }
  assert.equal(errorsOf({ owner_files: ["CLAUDE.md", "./notes/owner.md"] }), null);
});
test("loadConfig reads a hand-written block-style run.yaml with comments", () => {
  const text = [
    "# Run configuration, written by hand.",
    "version: 1",
    "run: shop          # the run's name",
    "branch: auto/shop",
    "base: main",
    "",
    "# Where the skills are installed.",
    `skills_dir: ${SCRIPTS.replace(/\/hsdd-auto\/scripts$/, "")}`,
    "owner_facts:",
    "  # one fact per line",
    "  - One team builds the shop.",
    "  - \"Payments: an external provider # not ours\"",
    "sources:",
    "  # the normative source first",
    "  normative:",
    "    - path: ref/spec.md",
    "      cite: Spec",
    "      # a comment between keys of one entry",
    "      version: v1",
    "  baseline:",
    "    - path: ref/spec-v0.md",
    "      cite: Spec",
    "      version: v0",
    "read_only:",
    "  - ref/",
    "prose_rules:",
    "  banned_chars: [\"\\u2014\"]",
    "  level: error",
    "segments:",
    "",
  ].join("\n");
  const dir = makeRepo({ files: { "hsdd/auto/run.yaml": text } });
  const c = loadConfig(dir);
  assert.equal(c.run, "shop");
  assert.deepEqual(c.owner_facts, ["One team builds the shop.", "Payments: an external provider # not ours"]);
  assert.deepEqual(c.sources.normative, [{ path: "ref/spec.md", cite: "Spec", version: "v1" }]);
  assert.deepEqual(c.sources.baseline, [{ path: "ref/spec-v0.md", cite: "Spec", version: "v0" }]);
  assert.deepEqual(c.read_only, ["ref/"]);
  assert.equal(c.prose_rules.level, "error");
  assert.deepEqual(c.prose_rules.banned_chars, ["\u2014"]);
  assert.deepEqual(c.segments, []);
});
test("loadConfig reports schema, parse and missing-file errors as ConfigError", () => {
  assert.match(errorsOf({ version: 2 }), /version/);
  assert.match(errorsOf({ skills_dir: "" }), /skills_dir/);
  assert.equal(errorsOf({ skills_dir: "/abs/skills" }), null);
  const dir = makeRepo({ files: { "hsdd/auto/run.yaml": "version: 1\n\tbad: x\n" } });
  assert.throws(() => loadConfig(dir), (e) => e instanceof ConfigError && /line 2/.test(e.message));
  const empty = makeRepo({ files: { "hsdd/auto/run.yaml": "# nothing\n" } });
  assert.throws(() => loadConfig(empty), ConfigError);
  const none = makeRepo({ commit: false });
  writeFileSync(join(none, "hsdd/auto/run.yaml"), "");
  assert.throws(() => loadConfig(none), ConfigError);
});
test("helper makes a committed repository and runs a script", () => {
  const dir = makeRepo();
  assert.equal(gitIn(dir, "log", "--oneline").split("\n").length, 1);
  assert.notEqual(run(dir, "missing.mjs").code, 0);
  assert.equal(currentBranch(dir), "main");
  assert.throws(() => makeRepo({ stage: "99-none" }), /no tree overlay/);
});
test("git wrapper", () => {
  const dir = makeRepo({ files: { "a b/it's.md": "x\n" } });
  assert.match(headSha(dir), /^[0-9a-f]{7,}$/);
  assert.match(headSha(dir, { short: false }), /^[0-9a-f]{40}$/);
  assert.equal(headSubject(dir), "init");
  assert.ok(branchExists(dir, "main"));
  assert.ok(!branchExists(dir, "nope"));
  assert.ok(revExists(dir, "HEAD"));
  assert.ok(!revExists(dir, "deadbeef"));
  assert.equal(defaultBranch(dir), "main");
  assert.deepEqual(changedPaths(dir), []);
  assert.ok(indexEmpty(dir));
  assert.match(commitStamp(dir, "HEAD"), STAMP_RE);
  assert.equal(git(dir, ["rev-parse", "nope"], { allowFail: true }), null);
  assert.throws(() => git(dir, ["rev-parse", "--verify", "nope"]), GitError);
  assert.equal(git(dir, ["hash-object", "--stdin"], { input: "x\n" }).length, 40);
  assert.equal(showFile(dir, "HEAD", "a b/it's.md"), "x\n");
  assert.equal(showFile(dir, "HEAD", "missing.md"), null);
  assert.deepEqual(listTree(dir, "HEAD", "ref"), ["ref/spec.md"]);
  assert.deepEqual(listTree(dir, "HEAD", "nowhere"), []);
  assert.deepEqual(listTree(dir, "HEAD", "a b"), ["a b/it's.md"]);
});
test("changedPaths, changedSince and indexEmpty see the working tree", () => {
  const dir = makeRepo({ files: { ".gitignore": "ignored.txt\n", "old.md": "o\n", "keep.md": "k\n" } });
  const base = headSha(dir);
  writeFileSync(join(dir, "keep.md"), "k2\n");
  writeFileSync(join(dir, "new file.md"), "n\n");
  writeFileSync(join(dir, "ignored.txt"), "i\n");
  gitIn(dir, "mv", "old.md", "moved.md");
  assert.deepEqual(changedPaths(dir), ["keep.md", "moved.md", "new file.md", "old.md"]);
  assert.ok(!indexEmpty(dir));
  assert.deepEqual(changedSince(dir, base), ["keep.md", "moved.md", "new file.md", "old.md"]);
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "-m", "second");
  assert.deepEqual(changedPaths(dir), []);
  assert.deepEqual(changedSince(dir, base), ["keep.md", "moved.md", "new file.md", "old.md"]);
  assert.deepEqual(changedSince(dir, "HEAD"), []);
});
test("fakeStep fabricates a subagent step and an orchestrator step", () => {
  const dir = makeRepo();
  addSegment(dir, planSeg);
  const a = fakeStep(dir, { step: "S00", segment: "2026-10-22-plan", kind: "setup", target: "2026-10-22-plan" });
  assert.equal(gitIn(dir, "log", "--format=%s", "-3").split("\n").slice(0, 2).join("|"), "judgement: S00|auto: S00 setup: fake");
  assert.match(readFileSync(join(dir, "hsdd/auto/dispatch/S00.md"), "utf8"), /^---\nstep_ref: S00\n/);
  const b = fakeStep(dir, { step: "S01", segment: "2026-10-22-plan", kind: "root-spec", target: "shop", files: { "hsdd/spec/shop.md": "# shop\n" } });
  assert.equal(gitIn(dir, "log", "--format=%s", "-2").split("\n")[1], "hsdd: S01 root-spec shop: fake");
  assert.equal(gitIn(dir, "show", "--name-only", "--format=", b.commit), "hsdd/spec/shop.md");
  const judged = gitIn(dir, "show", "--name-only", "--format=", b.judgementCommit).split("\n").sort();
  assert.deepEqual(judged, ["hsdd/auto/dispatch/S01.md", "hsdd/judgement/run.jsonl"]);
  assert.equal(gitIn(dir, "status", "--porcelain"), "");
  assert.deepEqual(validate("run-line", b.line), []);
  assert.notEqual(a.commit, b.commit);
  const c = fakeStep(dir, { step: "S02", segment: "2026-10-22-plan", kind: "root-spec", target: "shop", status: "stopped", continues: "S01", note: "n" });
  assert.match(gitIn(dir, "log", "--format=%s", "-2").split("\n")[1], /\(stopped\)$/);
  assert.equal(c.line.continues, "S01");
  assert.equal(gitIn(dir, "show", `HEAD:hsdd/judgement/run.jsonl`).split("\n").length, 3);
});
test("fakeStep uses configured prefixes and trailers", () => {
  const dir = makeRepo({ config: baseConfig({ commit: { artifact: "spec", judgement: "log", orchestrator: "run", trailers: ["Signed-off-by: A <a@example.invalid>"] } }) });
  fakeStep(dir, { step: "S00", segment: "s", kind: "plan", target: "s" });
  assert.equal(gitIn(dir, "log", "--format=%s", "-2"), "log: S00\nrun: S00 plan: fake");
  assert.match(gitIn(dir, "log", "-1", "--format=%B"), /Signed-off-by: A/);
});
test("installScripts copies the scripts and the registry generator", () => {
  const dir = makeRepo();
  installScripts(dir);
  assert.equal(readFileSync(join(dir, "hsdd/scripts/auto/lib/yaml.mjs"), "utf8"), readFileSync(join(SCRIPTS, "lib/yaml.mjs"), "utf8"));
  assert.ok(readFileSync(join(dir, "hsdd/scripts/gen-registry.mjs"), "utf8").length > 0);
});
