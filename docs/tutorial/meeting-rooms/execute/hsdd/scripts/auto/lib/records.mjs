// JSONL records, dispatch files, report series, step ids and judgement-commit detection
// (spec 6.1, 6.4, 6.6, 8.6; decision A-4). Reads are pure over the files; the only writers
// here are appendJsonl and writeDispatch.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { splitFrontMatter, stringifyFrontMatter } from "./yaml.mjs";
import { validate } from "./schema.mjs";
import { P, stepPaths } from "./paths.mjs";
import { ORCHESTRATOR_KINDS } from "./kinds.mjs";
import { showFile } from "./git.mjs";

// ---------- JSONL ----------

const parseJsonl = (rel, text) =>
  text.split("\n").flatMap((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") return [];
    try {
      return [JSON.parse(line)];
    } catch (e) {
      throw new Error(`${rel}:${i + 1}: not valid JSON (${e.message})`);
    }
  });

export const readJsonl = (repoRoot, rel) => {
  const file = join(repoRoot, rel);
  return existsSync(file) ? parseJsonl(rel, readFileSync(file, "utf8")) : [];
};

export const committedJsonl = (repoRoot, rel, rev = "HEAD") => {
  const text = showFile(repoRoot, rev, rel);
  return text === null ? [] : parseJsonl(rel, text);
};

// One line per call. A file that lacks its final newline gets one first, so a line never joins its predecessor.
export const appendJsonl = (repoRoot, rel, obj) => {
  const file = join(repoRoot, rel);
  mkdirSync(dirname(file), { recursive: true });
  const prior = existsSync(file) ? readFileSync(file, "utf8") : "";
  appendFileSync(file, `${prior !== "" && !prior.endsWith("\n") ? "\n" : ""}${JSON.stringify(obj)}\n`);
};

// ---------- step ids ----------

export const stepNum = (step) => {
  const m = /^S(\d{2,})$/.exec(step);
  if (!m) throw new Error(`not a step id: ${String(step)}`);
  return Number(m[1]);
};

// The numeric part of a record id (`Q-1000`, `DEC-012`, `S07`); ids order by it, never as strings.
export const idNum = (id) => Number(/(\d+)$/.exec(String(id))?.[1] ?? 0);

export const stepId = (n) => `S${String(n).padStart(2, "0")}`;

const DISPATCH_FILE = /^(S\d{2,})\.md$/;

// Step ids that have a dispatch file, in numeric order.
export const listDispatches = (repoRoot) => {
  const dir = join(repoRoot, P.dispatchDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((n) => DISPATCH_FILE.exec(n)?.[1] ?? [])
    .sort((a, b) => stepNum(a) - stepNum(b));
};

export const nextFreeStep = (repoRoot) => {
  const all = listDispatches(repoRoot);
  return all.length === 0 ? stepId(0) : stepId(stepNum(all.at(-1)) + 1);
};

// ---------- dispatch files (6.6) ----------

// 10.3: a dispatch file above WARN_BYTES gets a warning (dispatch.mjs, the gate's B6); above
// MAX_BYTES dispatch.mjs writes nothing.
export const WARN_BYTES = 32768;
export const MAX_BYTES = 65536;

const READ_CHECK = /^read_check: ([0-9a-f]{8})$/;

// The value of the file's last line `read_check: {8 hex}`; trailing blank lines do not count as text.
export const readCheckOf = (text) => READ_CHECK.exec(text.trimEnd().split("\n").at(-1).replace(/\r$/, ""))?.[1] ?? null;

export const readDispatch = (repoRoot, step) => {
  const file = join(repoRoot, stepPaths(step).dispatch);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const { data, body } = splitFrontMatter(text);
  return { front: data, body, readCheck: readCheckOf(text), text };
};

// A.8's schema and its code rules: `skill` is none exactly for an orchestrator kind, and then
// report and template are null and launches is empty; otherwise launches starts with one initial.
export const dispatchErrors = (front, step = front?.step_ref) => {
  const errors = validate("dispatch", front);
  if (errors.length > 0) return errors;
  if (front.step_ref !== step) errors.push(`step_ref ${front.step_ref} is not the dispatched step ${step}`);
  const orchestrator = ORCHESTRATOR_KINDS.includes(front.kind);
  if (orchestrator !== (front.skill === "none")) {
    errors.push(`skill is 'none' exactly for an orchestrator kind (kind ${front.kind}, skill ${front.skill})`);
  }
  if (orchestrator) {
    if (front.report !== null) errors.push(`an orchestrator step has no report (report: ${front.report})`);
    if (front.template !== null) errors.push(`an orchestrator step has no template (template: ${front.template})`);
    if (front.launches.length !== 0) errors.push("an orchestrator step has no launches");
  } else {
    if (front.launches[0]?.reason !== "initial") errors.push("launches must start with one initial launch");
    if (front.launches.slice(1).some((l) => l.reason === "initial")) errors.push("only the first launch is initial");
    if (front.report === null) errors.push("a subagent step has a report path");
    if (front.template === null) errors.push("a subagent step has a template");
  }
  return errors;
};

// The dispatch file's text: `---\n{front}---\n{body}`.
export const dispatchText = (front, body) => `---\n${stringifyFrontMatter(front)}---\n${body}`;

// Writes dispatchText(front, body); returns the repository-relative path written.
export const writeDispatch = (repoRoot, step, front, body) => {
  const errors = dispatchErrors(front, step);
  if (errors.length > 0) throw new Error(`invalid dispatch for ${step}: ${errors.join("; ")}`);
  const rel = stepPaths(step).dispatch;
  const file = join(repoRoot, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, dispatchText(front, body));
  return rel;
};

// ---------- the report series (6.4, 8.6) ----------

// `{step}.json`, then `{step}.r1.json`, `{step}.r2.json` ... in launch order. Renamed series
// (`.lost{k}`, `.invalid{k}`) are history and never listed. Repository-relative paths.
// Pure: the series among `names`, the file names under hsdd/auto/steps.
export const seriesOf = (names, step) => {
  const rank = (name) => {
    const m = new RegExp(`^${step}(?:\\.r(\\d+))?\\.json$`).exec(name);
    return m === null ? null : Number(m[1] ?? 0);
  };
  return names
    .flatMap((n) => (rank(n) === null ? [] : [{ n, r: rank(n) }]))
    .sort((a, b) => a.r - b.r)
    .map(({ n }) => `${P.stepsDir}/${n}`);
};

export const reportSeries = (repoRoot, step) => {
  const dir = join(repoRoot, P.stepsDir);
  return existsSync(dir) ? seriesOf(readdirSync(dir), step) : [];
};

export const readReports = (repoRoot, step) =>
  reportSeries(repoRoot, step).map((path) => {
    try {
      const report = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
      if (report === null || typeof report !== "object" || Array.isArray(report)) {
        return { path, report: null, error: "the report is not a JSON object" };
      }
      return { path, report, error: null };
    } catch (e) {
      return { path, report: null, error: `not valid JSON (${e.message})` };
    }
  });

export const readSidecar = (repoRoot, step) => readJsonl(repoRoot, stepPaths(step).decisions);

// Each non-blank line of the step's sidecar, parsed without throwing: { rel, entries: [{ n, value, error }] }
// (n the 1-based line number). The gate's B1 reads it, and commit.mjs checks the same lines before an
// artifact commit when the gate leaves B1 out.
export const sidecarEntries = (repoRoot, step) => {
  const rel = stepPaths(step).decisions;
  const full = join(repoRoot, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return { rel, entries: [] };
  const entries = readFileSync(full, "utf8").split("\n").flatMap((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") return [];
    try {
      return [{ n: i + 1, value: JSON.parse(line), error: null }];
    } catch (e) {
      return [{ n: i + 1, value: null, error: e.message }];
    }
  });
  return { rel, entries };
};

// ---------- the judgement commit (A-4) ----------

// A step has its judgement commit when its run line is in HEAD's run log; no search of commit subjects.
export const judgementCommitted = (repoRoot, step) =>
  committedJsonl(repoRoot, P.runLog).some((l) => l.step_ref === step);
