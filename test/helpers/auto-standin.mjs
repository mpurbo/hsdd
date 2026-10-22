// A scripted stand-in for a step subagent (spec 3.4, 6.4): it reads its dispatch file, writes what its
// plan names, records each decision with the decide command the prompt gives, and writes its report
// echoing the read check. It never commits, never stamps a time and never mints an id.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontMatter } from "../../skills/hsdd-auto/scripts/lib/yaml.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIXTURES = join(ROOT, "test", "fixtures", "auto");
const OVERLAYS = join(FIXTURES, "tree");

const filesBelow = (root, rel = "") => readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) => {
  const r = rel === "" ? e.name : `${rel}/${e.name}`;
  return e.isDirectory() ? filesBelow(root, r) : [r];
});

const put = (dir, rel, text) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
};

// What a subagent learns from its dispatch file, read to its end: the front matter, the report path
// (a resume or redispatch section names a new one; otherwise the step section's **Report:** line),
// the decide command, and the read check on the last line.
export const readDispatchFile = (dir, step) => {
  const text = readFileSync(join(dir, "hsdd/auto/dispatch", `${step}.md`), "utf8");
  const { data: front, body } = splitFrontMatter(text);
  const later = [...body.matchAll(/report to `([^`]+\.json)`/g)].map((m) => m[1]);
  const first = /\*\*Report:\*\* `([^`]+)`/.exec(body)?.[1] ?? null;
  const decide = /`(node hsdd\/scripts\/auto\/decide\.mjs --step S\d{2,} --stdin)`/.exec(body)?.[1] ?? null;
  const readCheck = /^read_check: ([0-9a-f]{8})$/.exec(text.trimEnd().split("\n").at(-1))?.[1] ?? null;
  const experimentsDir = /, your report files, and `([^`]+?)\/?`\./.exec(body)?.[1] ?? "hsdd/auto/experiments";
  return { front, body, report: later.at(-1) ?? first, decide, readCheck, experimentsDir };
};

// Records one decision exactly as the prompt says: the decide command with the decision on stdin.
export const recordDecision = (dir, command, decision) => {
  const [node, script, ...args] = command.split(" ");
  if (node !== "node") throw new Error(`the decide command does not start with node: ${command}`);
  const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, input: JSON.stringify(decision), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`stand-in: ${command} failed (${r.status}):\n${r.stdout}${r.stderr}`);
  return /^(DEC-\d{3,}) at /m.exec(r.stdout)[1];
};

// One file's new content: a string, { from: "nn-stage/path" } (a fixture file), a function of the old
// text, or null to delete it.
const writeOne = (dir, rel, spec) => {
  const full = join(dir, rel);
  if (spec === null) { rmSync(full, { force: true }); return false; }
  if (typeof spec === "function") { put(dir, rel, spec(existsSync(full) ? readFileSync(full, "utf8") : null)); return true; }
  if (typeof spec === "object" && typeof spec.from === "string") {
    mkdirSync(dirname(full), { recursive: true });
    cpSync(join(OVERLAYS, spec.from), full);
    return true;
  }
  put(dir, rel, spec);
  return true;
};

// `plan` (every field optional):
//   overlay      a stage overlay name, or a list, under test/fixtures/auto/tree/: every file is copied in
//   files        { path: content | { from } | (old) => new | null }, applied after the overlay
//   regen        true: run the project's registry generator, as hsdd-contract does after a contract change
//   decisions    decision inputs (spec 10.4), each recorded with the decide command
//   stop         { status: "stopped" | "run-stop-candidate", question, skill_rule, stop_class, options,
//                recommendation, blocks }: the report ends the launch on a stop
//   routed, closes, experiments, reads_outside, notes, artifacts
//                report fields (artifacts default to the files written outside experiments_dir)
//   readCheck    a function of the dispatch file's value giving the value to echo (a stopped-short read)
//   noReport     true: the launch is lost before it writes a report
export const standIn = (dir, step, plan = {}) => {
  const d = readDispatchFile(dir, step);
  if (d.front.step_ref !== step) throw new Error(`stand-in: ${step}'s dispatch file names ${d.front.step_ref}`);
  if (d.readCheck === null) throw new Error(`stand-in: ${step}'s dispatch file does not end in its read check`);
  if (d.decide === null) throw new Error(`stand-in: ${step}'s dispatch file names no decide command`);

  const overlays = plan.overlay === undefined ? [] : [].concat(plan.overlay);
  const written = overlays.flatMap((name) => filesBelow(join(OVERLAYS, name)).map((rel) => {
    writeOne(dir, rel, { from: `${name}/${rel}` });
    return rel;
  }));
  for (const [rel, spec] of Object.entries(plan.files ?? {})) if (writeOne(dir, rel, spec)) written.push(rel);
  if (plan.regen) {
    const r = spawnSync(process.execPath, ["hsdd/scripts/gen-registry.mjs"], { cwd: dir, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`stand-in: gen-registry failed:\n${r.stdout}${r.stderr}`);
  }
  for (const decision of plan.decisions ?? []) recordDecision(dir, d.decide, decision);
  if (plan.noReport) return;

  const stop = plan.stop ?? null;
  const { status = "stopped", ...stopObject } = stop ?? {};
  const report = {
    step_ref: step,
    skill: d.front.skill,
    target: d.front.target,
    status: stop === null ? "completed" : status,
    stop: stop === null ? null : stopObject,
    artifacts: plan.artifacts ?? [...new Set(written)]
      .filter((rel) => !rel.startsWith(`${d.experimentsDir}/`) && existsSync(join(dir, rel)) && statSync(join(dir, rel)).isFile()),
    experiments: plan.experiments ?? [],
    self_check: [],
    routed: plan.routed ?? [],
    closes: plan.closes ?? [],
    reads_outside: plan.reads_outside ?? [],
    notes: plan.notes ?? [`${d.front.kind} on ${d.front.target} by the stand-in`],
    read_check: plan.readCheck ? plan.readCheck(d.readCheck) : d.readCheck,
  };
  put(dir, d.report, `${JSON.stringify(report, null, 2)}\n`);
};
