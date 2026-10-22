// Temporary git repositories, script runner and record fabrication for hsdd-auto tests.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendSegmentEntry, formatFlow, formatScalar } from "../../skills/hsdd-auto/scripts/lib/yaml.mjs";
import { nowStamp } from "../../skills/hsdd-auto/scripts/lib/time.mjs";
import { validate } from "../../skills/hsdd-auto/scripts/lib/schema.mjs";
import { P, resolveLayout, stepPaths } from "../../skills/hsdd-auto/scripts/lib/paths.mjs";
import { KINDS, skillFor, writeSet } from "../../skills/hsdd-auto/scripts/lib/kinds.mjs";
import { loadConfig } from "../../skills/hsdd-auto/scripts/lib/config.mjs";
import { writeDispatch } from "../../skills/hsdd-auto/scripts/lib/records.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SCRIPTS = join(ROOT, "skills", "hsdd-auto", "scripts");
export const SKILLS = join(ROOT, "skills");
const OVERLAYS = join(ROOT, "test", "fixtures", "auto", "tree");

export const baseConfig = (overrides = {}) => ({
  version: 1,
  run: "shop",
  branch: "auto/shop",
  base: "main",
  skills_dir: SKILLS,
  owner_facts: ["One team builds the shop."],
  sources: { normative: [{ path: "ref/spec.md", cite: "Spec", version: "v1" }] },
  read_only: ["ref/"],
  segments: [],
  ...overrides,
});

// Writes the subset: scalars as scalars, other values as one-line flow collections;
// `segments` as a block sequence (or the bare key when empty, as a first-run file does).
export const writeRunYaml = (config) =>
  Object.entries(config).map(([key, v]) => {
    if (key === "segments") {
      return v === null || v.length === 0 ? "segments:\n" : `segments:\n${v.map((e) => `  - ${formatFlow(e)}\n`).join("")}`;
    }
    return `${key}: ${v !== null && typeof v === "object" ? formatFlow(v) : formatScalar(v)}\n`;
  }).join("");

export const gitIn = (dir, ...args) => {
  const out = execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  return out.endsWith("\n") ? out.slice(0, -1) : out;
};

const write = (dir, rel, content) => {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};

// Overlays are directories under test/fixtures/auto/tree/, named nn-stage; stage names one of them.
const applyOverlays = (dir, stage) => {
  const names = existsSync(OVERLAYS) ? readdirSync(OVERLAYS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  const upto = names.indexOf(stage);
  if (upto < 0) throw new Error(`no tree overlay named ${stage}`);
  for (const name of names.slice(0, upto + 1)) cpSync(join(OVERLAYS, name), dir, { recursive: true, force: true });
};

export const makeRepo = ({ stage = null, config = baseConfig(), files = {}, commit = true } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-auto-"));
  gitIn(dir, "init", "-q", "-b", "main");
  gitIn(dir, "config", "user.name", "Test Owner");
  gitIn(dir, "config", "user.email", "owner@example.invalid");
  gitIn(dir, "config", "commit.gpgsign", "false");
  if (stage !== null) applyOverlays(dir, stage);
  // A stage overlay brings its own normative source; the stand-in is for stage-less repositories.
  if (!existsSync(join(dir, "ref/spec.md"))) write(dir, "ref/spec.md", "# Spec v1\n");
  write(dir, P.runYaml, writeRunYaml(config));
  for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
  if (commit) {
    gitIn(dir, "add", "-A");
    gitIn(dir, "commit", "-q", "-m", "init");
  }
  return dir;
};

export const run = (dir, script, args = [], { input, env } = {}) => {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    cwd: dir, input, encoding: "utf8", env: { ...process.env, ...env },
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

export const installScripts = (dir) => {
  cpSync(SCRIPTS, join(dir, P.scriptsAuto), { recursive: true });
  cpSync(join(SKILLS, "hsdd-contract", "scripts", "gen-registry.mjs"), join(dir, P.genRegistry));
};

const commitWith = (dir, config, subject, args = []) => {
  const trailers = config.commit.trailers.join("\n");
  gitIn(dir, "commit", "-q", ...args, "-m", subject, ...(trailers ? ["-m", trailers] : []));
  return gitIn(dir, "rev-parse", "HEAD");
};

// Fabricates what commit.mjs will do for a step, so next.mjs can be tested before Task 13.
export const fakeStep = (dir, {
  step, segment, kind, target, status = "completed", handoff = null, queue_item = null,
  continues = null, note, files = {},
}) => {
  const config = loadConfig(dir);
  const layout = resolveLayout(dir);
  const tree = { nodes: new Map(), contracts: new Map() };
  const orchestrator = KINDS[kind].orchestrator;
  const paths = stepPaths(step);
  const started = nowStamp();
  const head = gitIn(dir, "rev-parse", "--short", "HEAD");

  for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
  if (Object.keys(files).length > 0) gitIn(dir, "add", "-A", "--", ...Object.keys(files));
  const subject = (orchestrator
    ? `${config.commit.orchestrator}: ${step} ${kind}: fake`
    : `${config.commit.artifact}: ${step} ${kind} ${target}: fake`) + (status === "stopped" ? " (stopped)" : "");
  const commit = commitWith(dir, config, subject, ["--allow-empty"]);

  const front = {
    step_ref: step, segment, kind, skill: skillFor(kind, target, tree), target, handoff, queue_item, continues,
    report: orchestrator ? null : paths.report,
    decisions: paths.decisions,
    write_set: writeSet(kind, target, { layout, config, segmentId: segment, tree }),
    template: orchestrator ? null : `steps/${kind}.md`,
    skill_version: "0.11.0",
    rendered_at: started,
    head,
    launches: orchestrator ? [] : [{ at: started, reason: "initial" }],
  };
  writeDispatch(dir, step, front, orchestrator ? "" : "fake prompt\n\nread_check: 00000000\n");

  const line = {
    step_ref: step, segment, kind, skill: front.skill, target, started, finished: nowStamp(), commit,
    dispatches: orchestrator ? 0 : 1, status,
    ...(continues ? { continues } : {}),
    ...(note ? { note } : {}),
  };
  const lineErrors = validate("run-line", line);
  if (lineErrors.length > 0) throw new Error(`fakeStep: invalid run line: ${lineErrors.join("; ")}`);
  mkdirSync(join(dir, "hsdd/judgement"), { recursive: true });
  appendFileSync(join(dir, P.runLog), `${JSON.stringify(line)}\n`);

  const stepsDir = join(dir, P.stepsDir);
  const stepFiles = existsSync(stepsDir) ? readdirSync(stepsDir).filter((n) => n.startsWith(`${step}.`)).map((n) => `${P.stepsDir}/${n}`) : [];
  const judgement = [P.ledger, P.runLog, paths.dispatch, P.queue, P.handoffs, P.plan, P.stop, ...stepFiles]
    .filter((p) => existsSync(join(dir, p)));
  gitIn(dir, "add", "-A", "--", ...judgement);
  const judgementCommit = commitWith(dir, config, `${config.commit.judgement}: ${step}`, ["--allow-empty"]);
  return { commit, judgementCommit, line };
};

// A dispatched step that has no commit yet: the dispatch file only (no run line, no judgement commit).
export const openStep = (dir, { step, segment, kind, target, renderedAt = nowStamp() }) => {
  const config = loadConfig(dir);
  const layout = resolveLayout(dir);
  const tree = { nodes: new Map(), contracts: new Map() };
  const orchestrator = KINDS[kind].orchestrator;
  const paths = stepPaths(step);
  const front = {
    step_ref: step, segment, kind, skill: skillFor(kind, target, tree), target, handoff: null, queue_item: null, continues: null,
    report: orchestrator ? null : paths.report,
    decisions: paths.decisions,
    write_set: writeSet(kind, target, { layout, config, segmentId: segment, tree }),
    template: orchestrator ? null : `steps/${kind}.md`,
    skill_version: "0.11.0",
    rendered_at: renderedAt,
    head: gitIn(dir, "rev-parse", "--short", "HEAD"),
    launches: orchestrator ? [] : [{ at: renderedAt, reason: "initial" }],
  };
  writeDispatch(dir, step, front, orchestrator ? "" : "fake prompt\n\nread_check: 00000000\n");
  return front;
};

export const addSegment = (dir, entry) => {
  const file = join(dir, P.runYaml);
  writeFileSync(file, appendSegmentEntry(readFileSync(file, "utf8"), entry));
  gitIn(dir, "add", P.runYaml);
  gitIn(dir, "commit", "-q", "-m", `owner: segment ${entry.id}`);
};
