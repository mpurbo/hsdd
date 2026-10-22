import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  StateError, defaultOwnerFiles, doneResult, formatState, goalText, installScripts, main, openRefusals, openSegment, preflight, requestSlug,
  segmentId, snapshotOwnerFiles, stateView, upstreamLines,
} from "../skills/hsdd-auto/scripts/state.mjs";
import { loadContext } from "../skills/hsdd-auto/scripts/lib/context.mjs";
import { loadConfig } from "../skills/hsdd-auto/scripts/lib/config.mjs";
import { P, ownerFileHash } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { appendJsonl, readJsonl } from "../skills/hsdd-auto/scripts/lib/records.mjs";
import { validate } from "../skills/hsdd-auto/scripts/lib/schema.mjs";
import { nowStamp } from "../skills/hsdd-auto/scripts/lib/time.mjs";
import { ownerState } from "../skills/hsdd-auto/scripts/gate.mjs";
import { SCRIPTS, SKILLS, addSegment, baseConfig, fakeStep, gitIn, makeRepo, openStep, run, writeRunYaml } from "./helpers/auto-repo.mjs";

const PLANNING = ["hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile", "hsdd-intake"];
const SEG = "2026-10-22-plan";
const INTAKE = "2026-10-22-intake-spec-v2";
const REQUEST = "ref/spec-v2.md";

const put = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const commitAll = (dir, msg = "owner edit") => { gitIn(dir, "add", "-A"); gitIn(dir, "commit", "-q", "--allow-empty", "-m", msg); };

// A copy of skills/ whose six planning skills carry `## Unattended runs` (Tasks 19 and 20 add the real
// section), so preflight and the bundled-script copy are tested against a complete installation.
let cached = null;
const completeSkills = () => {
  if (cached !== null) return cached;
  cached = mkdtempSync(join(tmpdir(), "hsdd-auto-skills-"));
  cpSync(SKILLS, cached, { recursive: true });
  for (const name of PLANNING) {
    const file = join(cached, name, "SKILL.md");
    writeFileSync(file, `${readFileSync(file, "utf8").replace(/\s*$/, "")}\n\n## Unattended runs\n\nstub\n`);
  }
  return cached;
};

const cfg = (over = {}) => baseConfig({ skills_dir: completeSkills(), ...over });
const instruction = (text = "Plan the shop.\n") => {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-auto-instruction-"));
  const file = join(dir, "instruction.md");
  writeFileSync(file, text);
  return file;
};
const planSegment = (id = SEG, over = {}) => ({ id, mode: "plan", opened_at: nowStamp(), instruction: "Plan the shop.", stop_policy: "stop", first_step: "S00", ...over });
const intakeSegment = (over = {}) => ({
  id: INTAKE, mode: "intake", opened_at: nowStamp(), instruction: "Take in ref/spec-v2.md.", stop_policy: "stop", first_step: "S00",
  request: REQUEST, authority: "accepted-rfc", ...over,
});
const branchOf = (dir) => gitIn(dir, "symbolic-ref", "--short", "HEAD");
const branches = (dir) => gitIn(dir, "branch", "--format=%(refname:short)").split("\n").filter(Boolean);
const ctxOf = (dir) => loadContext(dir);
const open = (dir, over = {}) => openSegment(dir, { mode: "plan", instructionFile: instruction(), ...over });
const refusal = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof StateError, String(e?.stack)); return e.message; }
  return assert.fail("expected a refusal");
};

test("open-segment creates and checks out the branch once", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  assert.equal(branchOf(dir), "main");
  const entry = open(dir);
  assert.equal(branchOf(dir), "auto/shop");
  assert.deepEqual(branches(dir), ["auto/shop", "main"]);
  assert.match(entry.id, /^\d{4}-\d{2}-\d{2}-plan$/);
  assert.equal(loadConfig(dir).segments.at(-1).id, entry.id);
  // The first segment ends; the second opens on the branch that exists, without creating another.
  fakeStep(dir, { step: "S00", segment: entry.id, kind: "setup", target: entry.id });
  fakeStep(dir, { step: "S01", segment: entry.id, kind: "report", target: entry.id });
  const second = open(dir);
  assert.deepEqual(branches(dir), ["auto/shop", "main"]);
  assert.equal(branchOf(dir), "auto/shop");
  assert.equal(second.first_step, "S02");
});

test("open-segment takes -2 on a taken id and the next free step id as first_step", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  const first = open(dir);
  assert.equal(first.first_step, "S00");
  fakeStep(dir, { step: "S00", segment: first.id, kind: "setup", target: first.id });
  fakeStep(dir, { step: "S01", segment: first.id, kind: "plan", target: first.id });
  fakeStep(dir, { step: "S02", segment: first.id, kind: "report", target: first.id });
  const second = open(dir);
  assert.equal(second.id, `${first.id}-2`);
  assert.equal(second.first_step, "S03");
});

test("open-segment copies request and authority when continuing a segment", () => {
  const ended = makeRepo({ stage: "06-planned", config: cfg(), files: { [REQUEST]: "# Spec v2\n" } });
  addSegment(ended, intakeSegment());
  fakeStep(ended, { step: "S00", segment: INTAKE, kind: "setup", target: INTAKE });
  fakeStep(ended, { step: "S01", segment: INTAKE, kind: "plan", target: INTAKE, note: "ended: owner message" });
  const continued = openSegment(ended, { instructionFile: instruction("Use the new stop policy.\n") });
  assert.equal(continued.mode, "intake");
  assert.equal(continued.request, REQUEST);
  assert.equal(continued.authority, "accepted-rfc");
  assert.match(continued.id, /^\d{4}-\d{2}-\d{2}-intake-spec-v2(-2)?$/);
  assert.equal(continued.instruction, "Use the new stop policy.");

  const stopped = makeRepo({ stage: "06-planned", config: cfg(), files: { [REQUEST]: "# Spec v2\n" } });
  addSegment(stopped, intakeSegment());
  fakeStep(stopped, { step: "S00", segment: INTAKE, kind: "setup", target: INTAKE });
  fakeStep(stopped, {
    step: "S01", segment: INTAKE, kind: "plan", target: INTAKE, status: "stopped",
    files: { [P.stop]: "# Run stopped at S01\n\n- **Segment:** x\n- **Stop class:** shape\n" },
  });
  const answered = openSegment(stopped, { instructionFile: instruction("Option A.\n"), stopPolicy: "decide-and-record" });
  assert.equal(answered.request, REQUEST);
  assert.equal(answered.stop_policy, "decide-and-record");

  // Flags win over the copy.
  const own = makeRepo({ stage: "06-planned", config: cfg(), files: { [REQUEST]: "# Spec v2\n" } });
  addSegment(own, intakeSegment());
  fakeStep(own, { step: "S00", segment: INTAKE, kind: "setup", target: INTAKE });
  fakeStep(own, { step: "S01", segment: INTAKE, kind: "plan", target: INTAKE, note: "ended: owner message" });
  const flagged = openSegment(own, { instructionFile: instruction(), request: "ref/other.md", authority: "draft" });
  assert.equal(flagged.request, "ref/other.md");
  assert.equal(flagged.authority, "draft");
});

test("open-segment refuses while a step is open", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(dir, planSegment());
  openStep(dir, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  assert.match(refusal(() => open(dir)), /S00 is open/);
  assert.equal(branchOf(dir), "main", "a refusal changes nothing");
});

test("open-segment refuses an unfinished segment, a dirty tree and an empty answer", () => {
  const unfinished = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(unfinished, planSegment());
  fakeStep(unfinished, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  assert.match(refusal(() => open(unfinished)), /segment 2026-10-22-plan is unfinished/);

  const dirty = makeRepo({ stage: "06-planned", config: cfg({ owner_files: ["notes/owner.md"] }), files: { "notes/owner.md": "mine\n" } });
  put(dirty, "notes/owner.md", "edited\n");
  put(dirty, "scratch.txt", "left behind\n");
  const message = refusal(() => open(dirty));
  assert.match(message, /scratch\.txt/);
  assert.ok(!/owner\.md/.test(message), message);
  assert.equal(branchOf(dirty), "main");
  rmSync(join(dirty, "scratch.txt"));
  assert.ok(open(dirty).id);

  const stopped = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(stopped, planSegment());
  fakeStep(stopped, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  fakeStep(stopped, { step: "S01", segment: SEG, kind: "plan", target: SEG, status: "stopped", files: { [P.stop]: "# Run stopped at S01\n\n- **Stop class:** shape\n" } });
  assert.match(refusal(() => open(stopped, { instructionFile: instruction("\n") })), /instruction is empty/);
});

test("open-segment reads segments: with no value as empty", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  assert.match(read(dir, P.runYaml), /^segments:\n/m);
  assert.deepEqual(ctxOf(dir).segments, []);
  const entry = open(dir);
  assert.deepEqual(loadConfig(dir).segments.map((s) => s.id), [entry.id]);
});

test("open-segment on a commented run.yaml", () => {
  const original = [
    "# Owner notes: keep these comments.",
    ...writeRunYaml(cfg({ owner_facts: ["Keep a: b # not a comment."] })).split("\n").filter((l) => l !== "" && !l.startsWith("segments")),
    "  # an indented comment between keys is fine at top level too",
    "segments: # none yet",
    "# footer comment",
    "",
  ].join("\n");
  const dir = makeRepo({ stage: "06-planned", config: cfg(), files: { [P.runYaml]: original } });
  const entry = open(dir, { instructionFile: instruction('Say "hi": # now\nthen stop.\n') });
  const after = read(dir, P.runYaml);
  const lines = after.split("\n");
  let from = 0;
  for (const line of original.split("\n")) {
    const at = lines.indexOf(line, from);
    assert.ok(at >= from, `line lost or moved: ${JSON.stringify(line)}`);
    from = at + 1;
  }
  assert.equal(lines.length, original.split("\n").length + 1, "exactly one line is added");
  assert.equal(loadConfig(dir).segments.at(-1).instruction, 'Say "hi": # now\nthen stop.');
  assert.equal(entry.instruction, 'Say "hi": # now\nthen stop.');
});

test("segment id slug", () => {
  assert.equal(segmentId("intake", "2026-10-22", "ref/Docs/Spec v0.15.1 – Größe.md", []), "2026-10-22-intake-spec-v0-15-1-gr-e");
  assert.equal(segmentId("intake", "2026-10-22", "https://x.test/a/!!!", []), "2026-10-22-intake-request");
  assert.equal(segmentId("plan", "2026-10-22", null, ["2026-10-22-plan"]), "2026-10-22-plan-2");
  assert.equal(segmentId("plan", "2026-10-22", null, ["2026-10-22-plan", "2026-10-22-plan-2"]), "2026-10-22-plan-3");
  assert.equal(requestSlug("https://x.test/docs/Spec-V2.0.md?x=1#top"), "spec-v2-0-md", "a URL keeps its last segment whole");
  assert.equal(requestSlug("a".repeat(39) + "-" + "b".repeat(10)), `${"a".repeat(39)}`, "cut at 40 characters, then trimmed of -");
  assert.equal(requestSlug("ref/spec.v2.md"), "spec-v2");
});

test("upstream lists exactly the would_upstream decisions in id order", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  const decision = (id, upstream, over = {}) => ({
    id, at: nowStamp(), segment: SEG, step: "plan", step_ref: "S01", by: "orchestrator", artifact: null, question: `Question ${id}?`,
    options: [{ label: "a", consequence: "x" }, { label: "b", consequence: "y" }], chosen: "a", why: "w", evidence: [], blast_radius: "run",
    confidence: "high", would_have_asked: false, stop_class: null, would_upstream: upstream, commit: "abc1234", ...over,
  });
  appendJsonl(dir, P.ledger, decision("DEC-010", true, { question: "Two\nlines?" }));
  appendJsonl(dir, P.ledger, decision("DEC-003", false));
  appendJsonl(dir, P.ledger, decision("DEC-002", true));
  assert.deepEqual(upstreamLines(ctxOf(dir)), ["DEC-002 S01 Question DEC-002? -> a", "DEC-010 S01 Two lines? -> a"]);
  const r = run(dir, "state.mjs", ["upstream"]);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, "DEC-002 S01 Question DEC-002? -> a\nDEC-010 S01 Two lines? -> a\n");
  assert.equal(readJsonl(dir, P.ledger).length, 3);
});

// A planned tree with its segment's steps committed through the report.
const finishedRun = () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(dir, planSegment());
  fakeStep(dir, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  fakeStep(dir, { step: "S01", segment: SEG, kind: "plan", target: SEG });
  return dir;
};

test("done prints unmet conditions and exits 1; DONE last and exit 0; STOPPED form", () => {
  const dir = finishedRun();
  const unmet = run(dir, "state.mjs", ["done"]);
  assert.equal(unmet.code, 1);
  assert.ok(unmet.stdout.split("\n").filter(Boolean).every((l) => /^stage \d /.test(l)), unmet.stdout);
  assert.match(unmet.stdout, /^stage 7 Consistency: /m);

  fakeStep(dir, { step: "S02", segment: SEG, kind: "align", target: "all" });
  fakeStep(dir, { step: "S03", segment: SEG, kind: "report", target: SEG });
  const done = run(dir, "state.mjs", ["done"]);
  assert.equal(done.code, 0);
  assert.equal(done.stdout.trimEnd().split("\n").at(-1), `DONE ${SEG}`);

  put(dir, P.stop, "# Run stopped at S03\n\n- **Stop class:** shape\n");
  const stopped = run(dir, "state.mjs", ["done"]);
  assert.equal(stopped.code, 0);
  assert.equal(stopped.stdout, `STOPPED ${SEG}: hsdd/judgement/STOP.md\n`);
  assert.deepEqual(doneResult(ctxOf(dir)), { code: 0, lines: [`STOPPED ${SEG}: hsdd/judgement/STOP.md`] });
});

test("goal prints 11.4's text for the segment", () => {
  const dir = finishedRun();
  const r = run(dir, "state.mjs", ["goal"]);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, `${goalText(SEG)}\n`);
  assert.equal(
    goalText(SEG),
    `/goal The hsdd-auto segment ${SEG} is finished: the last message shows the output of \`node hsdd/scripts/auto/state.mjs done\` `
    + `ending in the line "DONE ${SEG}" or "STOPPED ${SEG}: hsdd/judgement/STOP.md". Stop if 20 turns pass without a new judgement commit being reported.`,
  );
  const none = makeRepo({ stage: "06-planned", config: cfg() });
  assert.equal(run(none, "state.mjs", ["goal"]).code, 1);
});

test("preflight refuses the standalone-spec-repo profile and a skill without Unattended runs", () => {
  const ok = makeRepo({ stage: "06-planned", config: cfg() });
  assert.deepEqual(preflight(ok, loadConfig(ok)), []);
  assert.equal(run(ok, "state.mjs", ["preflight"]).code, 0);

  // The shipped skills do not carry the section yet (Tasks 19 and 20), and the message says what to do.
  const bare = makeRepo({ stage: "06-planned", config: baseConfig() });
  const bareRefusals = PLANNING.flatMap((name) => preflight(bare, loadConfig(bare)).filter((r) => r.startsWith(`${name}/SKILL.md`)));
  const withSection = PLANNING.filter((name) => /^## Unattended runs\s*$/m.test(readFileSync(join(SKILLS, name, "SKILL.md"), "utf8")));
  assert.equal(bareRefusals.length, PLANNING.length - withSection.length);

  const profile = makeRepo({
    stage: "06-planned", config: cfg(),
    files: { "hsdd/conventions.md": "# Conventions\n\n## Layout\n\nProfile: standalone-spec-repo\n" },
  });
  const refused = preflight(profile, loadConfig(profile));
  assert.equal(refused.length, 1);
  assert.match(refused[0], /standalone-spec-repo profile/);
  const cli = run(profile, "state.mjs", ["preflight"]);
  assert.equal(cli.code, 1);
  assert.equal(cli.stdout.trimEnd().split("\n").at(-1), "preflight: refused (1)");

  // The conventions template only mentions the profile in prose, which is no declaration.
  const prose = makeRepo({
    stage: "06-planned", config: cfg(),
    files: { "hsdd/conventions.md": readFileSync(join(SKILLS, "hsdd-spec", "templates", "conventions.md"), "utf8") },
  });
  assert.deepEqual(preflight(prose, loadConfig(prose)), []);

  const own = mkdtempSync(join(tmpdir(), "hsdd-auto-skills-missing-"));
  cpSync(completeSkills(), own, { recursive: true });
  rmSync(join(own, "hsdd-adr", "SKILL.md"));
  const missing = makeRepo({ stage: "06-planned", config: cfg({ skills_dir: own }) });
  assert.deepEqual(preflight(missing, loadConfig(missing)).map((r) => r.replace(/ under skills_dir.*/, "")), ["hsdd-adr/SKILL.md is missing"]);
  // open-segment runs preflight first and changes nothing.
  assert.match(refusal(() => open(profile)), /standalone-spec-repo/);
  assert.equal(branchOf(profile), "main");
});

const everyFile = (root) => readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name).slice(root.length + 1)).sort();

test("install-scripts makes the bundled copy byte-identical", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  rmSync(join(dir, P.genRegistry), { force: true });
  const first = installScripts(dir, loadConfig(dir));
  const dst = join(dir, P.scriptsAuto);
  assert.deepEqual(everyFile(dst), everyFile(SCRIPTS));
  for (const f of everyFile(SCRIPTS)) assert.ok(readFileSync(join(SCRIPTS, f)).equals(readFileSync(join(dst, f))), f);
  assert.ok(first.length > 1 && first.every((l) => l.startsWith("copied ")), first.join("\n"));
  assert.ok(first.includes("copied hsdd/scripts/auto/VERSION"));
  // Contracts exist in this tree, so the registry generator is copied too.
  assert.ok(first.includes(`copied ${P.genRegistry}`));
  assert.ok(readFileSync(join(dir, P.genRegistry)).equals(readFileSync(join(SKILLS, "hsdd-contract", "scripts", "gen-registry.mjs"))));
  // A second run has nothing to do.
  assert.deepEqual(installScripts(dir, loadConfig(dir)), [`${P.scriptsAuto} is current`, `${P.genRegistry} is current`]);

  // A differing file is recopied, a file the skill no longer has is removed, with its empty directory.
  writeFileSync(join(dst, "next.mjs"), "// edited by hand\n");
  put(dir, `${P.scriptsAuto}/old/gone.mjs`, "// removed from the skill\n");
  writeFileSync(join(dir, P.genRegistry), "// stale\n");
  const again = installScripts(dir, loadConfig(dir));
  assert.deepEqual(again, [`copied ${P.scriptsAuto}/next.mjs`, `removed ${P.scriptsAuto}/old/gone.mjs`, `copied ${P.genRegistry}`]);
  assert.ok(!existsSync(join(dst, "old")));
  assert.deepEqual(everyFile(dst), everyFile(SCRIPTS));

  // No contract files: the generator is not copied.
  const bare = makeRepo({ config: cfg() });
  assert.deepEqual(installScripts(bare, loadConfig(bare)).filter((l) => l.includes("gen-registry")), []);
  assert.ok(!existsSync(join(bare, P.genRegistry)));
  const cli = run(bare, "state.mjs", ["install-scripts"]);
  assert.equal(cli.code, 0);
  assert.match(cli.stdout.trimEnd().split("\n").at(-1), /^install-scripts: \d+ line/);
});

test("snapshot hashes owner files and records null for absent ones", () => {
  const owner = ["notes/owner.md", "./notes/other.md", "notes/absent.md"];
  const dir = makeRepo({ config: cfg({ owner_files: owner }), files: { "notes/owner.md": "mine\n", "notes/other.md": "theirs\n" } });
  const snapshot = snapshotOwnerFiles(dir, loadConfig(dir));
  assert.deepEqual(Object.keys(snapshot), owner, "keyed exactly as listed");
  assert.equal(snapshot["notes/owner.md"], ownerFileHash(dir, "notes/owner.md"));
  assert.match(snapshot["./notes/other.md"], /^[0-9a-f]{64}$/);
  assert.equal(snapshot["notes/absent.md"], null);
  assert.deepEqual(JSON.parse(read(dir, P.ownerFiles)), snapshot);
  assert.deepEqual(validate("owner-files", snapshot), []);
  // gate A2 reads it back and agrees with the hashes byte for byte.
  const state = ownerState(dir, loadConfig(dir).owner_files);
  assert.equal(state.error, null);
  for (const [entry, hash] of state.hashes) assert.equal(snapshot[entry], hash);
  const cli = run(dir, "state.mjs", ["snapshot"]);
  assert.equal(cli.code, 0);
  assert.match(cli.stdout, /notes\/absent\.md absent/);
});

test("--json prints one JSON document", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(dir, planSegment());
  fakeStep(dir, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  openStep(dir, { step: "S01", segment: SEG, kind: "plan", target: SEG });
  const r = run(dir, "state.mjs", ["--json"]);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trimEnd().split("\n").length, 1);
  const view = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(view), ["run", "branch", "head", "segment", "steps", "stop", "queue", "tree", "next"]);
  assert.equal(view.run, "shop");
  assert.deepEqual(view.segment, { id: SEG, mode: "plan", stop_policy: "stop", first_step: "S00", ended: false });
  assert.deepEqual(view.steps, { count: 2, last: "S01", in_progress: { step: "S01", has_report: false, has_artifact_commit: false } });
  assert.equal(view.stop, null);
  assert.deepEqual(view.next, { waiting: "S01" });
  assert.deepEqual(view.tree.leaf_parents_without_plan, []);
  assert.equal(view.tree.nodes > 0, true);
  const text = run(dir, "state.mjs");
  assert.equal(text.code, 0);
  assert.match(text.stdout, /^segment: 2026-10-22-plan \(plan, stop policy stop, first step S00\)$/m);
  assert.match(text.stdout, /in progress S01 \(report: no, artifact commit: no\)/);
});

test("state view of a stopped, ended and intake segment", () => {
  const stopped = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(stopped, planSegment());
  fakeStep(stopped, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  fakeStep(stopped, { step: "S01", segment: SEG, kind: "plan", target: SEG, status: "stopped", files: { [P.stop]: "# Run stopped at S01\n\n- **Stop class:** shape\n" } });
  const view = stateView(ctxOf(stopped));
  assert.deepEqual(view.stop, { class: "shape", path: P.stop });
  assert.deepEqual(view.next, { blocked: P.stop });
  assert.match(formatState(view), /^stop: class shape, see hsdd\/judgement\/STOP\.md$/m);

  const ended = makeRepo({ stage: "06-planned", config: cfg(), files: { [REQUEST]: "# Spec v2\n" } });
  addSegment(ended, intakeSegment());
  fakeStep(ended, { step: "S00", segment: INTAKE, kind: "setup", target: INTAKE });
  fakeStep(ended, { step: "S01", segment: INTAKE, kind: "plan", target: INTAKE, note: "ended: owner message" });
  const endedView = stateView(ctxOf(ended));
  assert.equal(endedView.segment.ended, true);
  assert.deepEqual(endedView.intake, { record: null, handoffs: [] });
  assert.match(formatState(endedView), /ended by an owner message/);
  assert.deepEqual(openRefusals(ctxOf(ended), { instruction: "x" }), []);
});

test("an in-progress step with a report and an artifact commit", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  addSegment(dir, planSegment());
  fakeStep(dir, { step: "S00", segment: SEG, kind: "setup", target: SEG });
  openStep(dir, { step: "S01", segment: SEG, kind: "adr", target: "ADR-001" });
  put(dir, "hsdd/auto/steps/S01.json", "{}\n");
  gitIn(dir, "commit", "-q", "--allow-empty", "-m", "hsdd: S01 adr ADR-001: fake");
  const inProgress = stateView(ctxOf(dir)).steps.in_progress;
  assert.deepEqual(inProgress, { step: "S01", has_report: true, has_artifact_commit: true });
});

test("usage errors exit 2", () => {
  const dir = makeRepo({ stage: "06-planned", config: cfg() });
  assert.equal(run(dir, "state.mjs", ["bogus"]).code, 2);
  assert.equal(run(dir, "state.mjs", ["done", "extra"]).code, 2);
  assert.equal(run(dir, "state.mjs", ["open-segment", "--mode", "plan"]).code, 2);
  assert.equal(run(dir, "state.mjs", ["open-segment", "--mode", "intake", "--instruction-file", instruction()]).code, 2);
  assert.equal(run(dir, "state.mjs", ["open-segment", "--mode", "weekly", "--instruction-file", instruction()]).code, 2);
  assert.equal(branchOf(dir), "main");
  const cli = run(dir, "state.mjs", ["open-segment", "--mode", "plan", "--instruction-file", instruction()]);
  assert.equal(cli.code, 0, cli.stderr);
  assert.match(cli.stdout.trimEnd().split("\n").at(-1), /^open-segment: opened \d{4}-\d{2}-\d{2}-plan on branch auto\/shop, first step S00$/);
  assert.equal(main(["done"], mkdtempSync(join(tmpdir(), "hsdd-auto-empty-")), { log() {}, error() {} }), 1);
});

test("defaultOwnerFiles lists files, never directories", () => {
  const dir = makeRepo({ config: cfg() });
  put(dir, "notes/a.md", "a\n");
  put(dir, "notes/deep/b.md", "b\n");
  assert.deepEqual(defaultOwnerFiles(dir), ["notes/a.md", "notes/deep/b.md"]);
});

test("an intake segment's view lists each handoff as executed, skipped or pending", () => {
  const record = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "auto", "intake", "2026-10-22-intake-order-v2.md"), "utf8");
  const dir = makeRepo({ stage: "06-planned", config: cfg(), files: { [REQUEST]: "# Spec v2\n\nVersion: v2.\n" } });
  addSegment(dir, intakeSegment());
  fakeStep(dir, { step: "S00", segment: INTAKE, kind: "setup", target: INTAKE });
  fakeStep(dir, { step: "S01", segment: INTAKE, kind: "plan", target: INTAKE });
  fakeStep(dir, { step: "S02", segment: INTAKE, kind: "intake", target: REQUEST, files: { "hsdd/management/2026-10-22-intake-order-v2.md": record } });
  const { intake } = stateView(ctxOf(dir));
  assert.equal(intake.record, "hsdd/management/2026-10-22-intake-order-v2.md");
  assert.ok(intake.handoffs.length > 0);
  assert.ok(intake.handoffs.every((h) => h.state === "pending"), JSON.stringify(intake.handoffs));
  assert.match(formatState(stateView(ctxOf(dir))), /^  H1 \S+ \S+: pending$/m);
});
