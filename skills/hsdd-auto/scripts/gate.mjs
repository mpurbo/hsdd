// The step gate and the final gate (spec 10.6). A gate reads the lib/context.mjs snapshot and, for
// the step gate, a view of the step's own records whose readers run once, on first use: those
// readers are the edge, every check is a function of what they return, and nothing here writes a
// file or changes git state. A check returns findings { id, level, message, file?, related? }; the
// CLI prints them, one line each, then the summary, and exits 0 when none is an error.
// Usage: see USAGE.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContext } from "./lib/context.mjs";
import { inScope, treeChecks } from "./lib/checks.mjs";
import { validate } from "./lib/schema.mjs";
import { STAMP_RE, nowStamp, stampMs } from "./lib/time.mjs";
import { KINDS, RAISED_WHEN, neverPatterns } from "./lib/kinds.mjs";
import { P, expandHome, judgementSet, matchesAny, ownerMatcher, reportPath, stepPaths } from "./lib/paths.mjs";
import { git, headSha } from "./lib/git.mjs";
import { dispatchErrors, idNum, readReports } from "./lib/records.mjs";
import { leafParentsOf } from "./lib/tree.mjs";
import { decisionRuleErrors } from "./decide.mjs";
import { validateLedger } from "./ledger.mjs";
import { intakeHandoffTargets, unmetDone, willCreate } from "./next.mjs";
import { lineErrors, openMatching, planIngest, queueItems } from "./routed.mjs";
import { WARN_BYTES } from "./dispatch.mjs";

export class GateError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "GateError";
    this.errors = errors;
  }
}

const A = ["A1", "A2", "A3", "A4"];
const B = ["B1", "B2", "B3", "B4", "B5", "B6"];
const C = ["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];
const F = ["F1", "F2", "F3", "F4", "F5", "F6"];
export const CHECK_IDS = Object.freeze([...A, ...B, ...C, "D1", ...F]);
const STATUSES = ["completed", "stopped"];
const WINDOW_MS = 60_000;

// 10.6: which checks run by the step's kind (subagent or orchestrator) and status. The report step
// also runs the final gate (checkList).
const DEFAULT_CHECKS = {
  subagent: { completed: [...A, ...B, ...C, "D1"], stopped: ["A1", "A2", "A3", "A4", "B1", "B5"] },
  orchestrator: { completed: ["A1", "A2", "A3", ...C, "D1"], stopped: ["A1", "A2", "A3"] },
};

const finding = (id, level, message, extra = {}) => ({ id, level, message, ...extra });
const error = (id, message, extra) => finding(id, "error", message, extra);
const warning = (id, message, extra) => finding(id, "warn", message, extra);
const isError = (f) => f.level === "error";
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (xs) => (xs.length <= 5 ? xs.join(", ") : `${xs.slice(0, 5).join(", ")} and ${xs.length - 5} more`);
const unique = (xs) => [...new Set(xs)];
const byCheck = (a, b) => CHECK_IDS.indexOf(a.id) - CHECK_IDS.indexOf(b.id);
const fmtMs = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const withFile = (f) => (f.file && !f.message.includes(f.file) ? `${f.message} (${f.file})` : f.message);

const memo = (fn) => {
  let done = false;
  let value;
  return () => {
    if (!done) { value = fn(); done = true; }
    return value;
  };
};

// ---------- readers (the edge) ----------

const isFile = (full) => existsSync(full) && statSync(full).isFile();

// Repository-relative files below `root`, sorted; null when `root` is not a directory.
const filesUnder = (root) => {
  if (!existsSync(root) || !statSync(root).isDirectory()) return null;
  const walk = (rel) => readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel === "" ? e.name : `${rel}/${e.name}`;
    return e.isDirectory() ? walk(r) : e.isFile() ? [r] : [];
  });
  return walk("").sort();
};

// A text file's content; null when it is absent, not a regular file, or binary (holds a NUL byte).
const textOf = (repoRoot, rel) => {
  const full = join(repoRoot, rel);
  if (!isFile(full)) return null;
  const buf = readFileSync(full);
  return buf.includes(0) ? null : buf.toString("utf8");
};

// The sha256 of an owner file's bytes, or null when it is absent (6.10); state.mjs snapshot agrees.
export const ownerFileHash = (repoRoot, rel) => {
  const full = join(repoRoot, rel);
  return isFile(full) ? createHash("sha256").update(readFileSync(full)).digest("hex") : null;
};

const ownerState = (repoRoot, ownerFiles) => {
  const file = join(repoRoot, P.ownerFiles);
  if (!existsSync(file)) return { present: false };
  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { present: true, error: `not valid JSON (${e.message})` };
  }
  const errs = validate("owner-files", snapshot);
  if (errs.length > 0) return { present: true, error: errs.join("; ") };
  const paths = unique([...Object.keys(snapshot), ...ownerFiles]);
  return { present: true, error: null, snapshot, hashes: new Map(paths.map((p) => [p, ownerFileHash(repoRoot, p)])) };
};

const skillsRoot = (repoRoot, skillsDir) => {
  const p = expandHome(skillsDir);
  return isAbsolute(p) ? p : join(repoRoot, p);
};

// What A3 compares, read once: the copy against the installed skill's scripts (4.3), and the
// registry generator against hsdd-contract's.
const copyState = (repoRoot, config) => {
  const skills = skillsRoot(repoRoot, config.skills_dir);
  const src = join(skills, "hsdd-auto", "scripts");
  const dst = join(repoRoot, P.scriptsAuto);
  const srcFiles = filesUnder(src);
  const dstFiles = filesUnder(dst);
  const srcSet = new Set(srcFiles ?? []);
  const dstSet = new Set(dstFiles ?? []);
  const bytes = (root, rel) => readFileSync(join(root, rel));
  const version = (root, set) => (set.has("VERSION") ? bytes(root, "VERSION").toString("utf8").trim() : null);
  const generator = join(repoRoot, P.genRegistry);
  const skillGenerator = join(skills, "hsdd-contract", "scripts", "gen-registry.mjs");
  return {
    src,
    srcFiles,
    dstFiles,
    versions: { skill: version(src, srcSet), copy: version(dst, dstSet) },
    differ: (srcFiles ?? []).filter((f) => dstSet.has(f) && !bytes(src, f).equals(bytes(dst, f))),
    missing: dstFiles === null ? [] : (srcFiles ?? []).filter((f) => !dstSet.has(f)),
    extra: srcFiles === null ? [] : (dstFiles ?? []).filter((f) => !srcSet.has(f)),
    generator: isFile(generator)
      ? { skill: skillGenerator, present: isFile(skillGenerator), same: isFile(skillGenerator) && readFileSync(generator).equals(readFileSync(skillGenerator)) }
      : null,
  };
};

const headState = (repoRoot) => ({
  head: headSha(repoRoot, { short: false }),
  staged: (git(repoRoot, ["diff", "--cached", "--name-only", "-z"], { allowFail: true }) ?? "").split("\0").filter(Boolean),
});

// Each non-blank line of the step's sidecar, parsed: { n, value, error }.
const sidecarOf = (repoRoot, step) => {
  const rel = stepPaths(step).decisions;
  const full = join(repoRoot, rel);
  if (!isFile(full)) return { rel, entries: [] };
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

// ---------- A: the step's changes ----------

// A1 (decision B-6): the write set, the judgement set (which holds the step's report series and its
// sidecar), experiments_dir and owner_files admit a path; only a path none admits is checked against
// the never list, which 7.3 states for a subagent step.
export const a1 = ({ changed, writeSet, step, experimentsDir, owner, never, subagent }) => {
  const admitted = [...judgementSet(step), `${experimentsDir}/**`];
  return changed
    .filter((p) => p !== P.decideLock && !matchesAny(p, writeSet) && !matchesAny(p, admitted) && !owner(p))
    .map((p) => (subagent && matchesAny(p, never)
      ? error("A1", `${p} is on the never list (spec 7.3): forbidden for a subagent step`, { file: p })
      : error("A1", `${p} is outside the write set`, { file: p })));
};

export const a2 = (state, ownerFiles, level) => {
  if (!state.present) {
    return ownerFiles.length === 0 ? [] : [finding("A2", level, `${P.ownerFiles} does not exist, so the owner files (${names(ownerFiles)}) cannot be checked; the segment's setup step takes the snapshot (spec 6.10)`)];
  }
  if (state.error) return [finding("A2", level, `${P.ownerFiles}: ${state.error}`, { file: P.ownerFiles })];
  const changed = Object.entries(state.snapshot)
    .filter(([path, hash]) => state.hashes.get(path) !== hash)
    .map(([path, hash]) => finding("A2", level, `owner file ${path} ${state.hashes.get(path) === null ? "is gone" : hash === null ? "now exists" : "changed"} since the snapshot in ${P.ownerFiles}; only the owner restores it`, { file: path }));
  const unhashed = ownerFiles.filter((o) => !Object.hasOwn(state.snapshot, o))
    .map((o) => finding("A2", level, `owner file ${o} has no hash in ${P.ownerFiles}; the segment's setup step takes the snapshot`, { file: o }));
  return [...changed, ...unhashed];
};

export const a3 = (s) => {
  const out = [];
  if (s.srcFiles === null) {
    out.push(error("A3", `the installed skill's scripts directory ${s.src} does not exist; check skills_dir in ${P.runYaml}`));
  } else if (s.dstFiles === null) {
    out.push(error("A3", `${P.scriptsAuto}/ does not exist; a setup step copies ${s.src} there (spec 4.3)`, { file: P.scriptsAuto }));
  } else {
    const versionDiffers = s.versions.copy !== s.versions.skill;
    const differ = versionDiffers ? s.differ.filter((f) => f !== "VERSION") : s.differ;
    const parts = [
      ...(versionDiffers ? [`VERSION ${s.versions.copy ?? "missing"}, the skill's ${s.versions.skill ?? "missing"}`] : []),
      ...(differ.length > 0 ? [`${plural(differ.length, "file")} differ: ${names(differ)}`] : []),
      ...(s.missing.length > 0 ? [`${s.missing.length} missing: ${names(s.missing)}`] : []),
      ...(s.extra.length > 0 ? [`${s.extra.length} extra: ${names(s.extra)}`] : []),
    ];
    if (parts.length > 0) {
      out.push(error("A3", `${P.scriptsAuto}/ is not the current copy of ${s.src} (spec 4.3): ${parts.join("; ")}; recopy it in a setup or plan step by a recorded decision, never by editing`, { file: P.scriptsAuto }));
    }
  }
  if (s.generator && !s.generator.present) {
    out.push(error("A3", `${P.genRegistry} cannot be compared: ${s.generator.skill} does not exist`, { file: P.genRegistry }));
  } else if (s.generator && !s.generator.same) {
    out.push(error("A3", `${P.genRegistry} is not byte-identical to ${s.generator.skill}; recopy it`, { file: P.genRegistry }));
  }
  return out;
};

export const a4 = (dispatchHead, { head, staged }) => [
  ...(head !== null && head.startsWith(dispatchHead) ? [] : [error("A4", `HEAD ${head === null ? "(none)" : head.slice(0, 12)} is not the dispatch file's head ${dispatchHead}: the step committed, or HEAD moved after dispatch`)]),
  ...(staged.length === 0 ? [] : [error("A4", `the index is not empty: the step staged ${names(staged)}`)]),
];

// ---------- B: the step's records ----------

// The report files the current series must hold: {step}.json, then one {step}.r{n}.json per resume
// since the last initial launch or redispatch (6.4, 8.6).
export const expectedReports = (step, launches) => {
  const start = Math.max(0, launches.findLastIndex((l) => l.reason === "initial" || l.reason === "redispatch"));
  const resumes = launches.slice(start + 1).filter((l) => String(l.reason).startsWith("resume-")).length;
  return Array.from({ length: resumes + 1 }, (_, n) => reportPath(step, n));
};

const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// A.4's rules checked in code, and the fields a report takes from its dispatch file (6.4).
export const reportRuleErrors = (r, front, step) => {
  const errs = [];
  if (r.step_ref !== step) errs.push(`step_ref ${r.step_ref} is not the step ${step}`);
  if (r.skill !== front.skill) errs.push(`skill ${r.skill} is not the dispatched ${front.skill}`);
  if (r.target !== front.target) errs.push(`target ${r.target} is not the dispatched ${front.target}`);
  if ((r.stop === null) !== (r.status === "completed")) {
    errs.push(`stop is null exactly when status is completed (status ${r.status}, stop ${r.stop === null ? "null" : "set"})`);
  }
  if (r.stop !== null) {
    if (r.stop.stop_class !== "procedural" && r.stop.options.length < 2) {
      errs.push(`stop.options has ${r.stop.options.length}; a stop has at least two options unless its stop_class is procedural`);
    }
    if (!r.stop.options.some((o) => o.label === r.stop.recommendation)) {
      errs.push(`stop.recommendation ${JSON.stringify(r.stop.recommendation)} is not one of the options' labels`);
    }
    if (r.status === "run-stop-candidate" && !squash(r.stop.skill_rule).includes(squash(RAISED_WHEN[r.stop.stop_class]))) {
      errs.push(`a run-stop-candidate's stop.skill_rule quotes the Raised when line of the ${r.stop.stop_class} class from the preamble's stop conditions`);
    }
  }
  r.routed.forEach((e, i) => {
    const any = e.step_kind !== undefined || e.step_target !== undefined;
    const both = e.step_kind !== undefined && e.step_target !== undefined;
    if (e.kind === "insert-step" ? !both : any) errs.push(`routed[${i}]: step_kind and step_target are set exactly when kind is insert-step (kind ${e.kind})`);
  });
  return errs;
};

// B1. `reports` is readReports' result; `exists` tells whether a repository path exists.
export const b1 = ({ step, front, subagent, reports, sidecar, exists }) => {
  const out = [];
  const add = (file, message) => out.push(error("B1", message, { file }));
  if (subagent) {
    const expected = expectedReports(step, front.launches);
    expected.filter((p) => !reports.some((r) => r.path === p)).forEach((p) => add(p, `${p} does not exist: the step's report for that launch is missing`));
    reports.filter((r) => !expected.includes(r.path))
      .forEach((r) => add(r.path, `${r.path} has no launch in ${stepPaths(step).dispatch} (the current series has ${plural(expected.length, "launch", "launches")})`));
    for (const { path, report, error: e } of reports) {
      if (e) { add(path, `${path}: ${e}`); continue; }
      const schema = validate("step-report", report);
      const errs = schema.length > 0 ? schema : [
        ...reportRuleErrors(report, front, step),
        ...report.artifacts.filter((a) => !exists(a)).map((a) => `artifacts names ${a}, which does not exist`),
      ];
      errs.forEach((m) => add(path, `${path}: ${m}`));
    }
  }
  for (const { n, value, error: e } of sidecar.entries) {
    const where = `${sidecar.rel}:${n}`;
    if (e) { add(sidecar.rel, `${where}: not valid JSON (${e})`); continue; }
    const schema = validate("decision", value, "sidecarDecision");
    (schema.length > 0 ? schema : decisionRuleErrors(value)).forEach((m) => add(sidecar.rel, `${where}: ${m}`));
  }
  return out;
};

// Milliseconds of a stamp, or null when it is not one (a calendar date that does not exist included).
const msOf = (stamp) => {
  if (!STAMP_RE.test(String(stamp))) return null;
  try {
    return stampMs(stamp);
  } catch {
    return null;
  }
};

// B2: a subagent decision's `at` lies within the dispatch's rendered_at minus 60 s and now plus 60 s.
// An `at` that is not a stamp is B1's finding; one that matches the pattern but names no real time is B2's.
export const b2 = ({ sidecar, renderedAt, now }) => {
  const low = stampMs(renderedAt) - WINDOW_MS;
  const high = stampMs(now) + WINDOW_MS;
  return sidecar.entries
    .filter(({ value: d }) => d?.by === "subagent" && STAMP_RE.test(String(d.at)))
    .filter(({ value: d }) => { const at = msOf(d.at); return at === null || at < low || at > high; })
    .map(({ n, value: d }) => error("B2", `${d.id ?? `line ${n}`}: at ${d.at} is outside the step's window, ${fmtMs(low)} to ${fmtMs(high)} (rendered_at minus 60 seconds to now plus 60 seconds)`, { file: sidecar.rel }));
};

const entriesOf = (reports, field) => reports.flatMap(({ path, report }) =>
  (report !== null && Array.isArray(report[field]) ? report[field] : []).filter((e) => e !== null && typeof e === "object").map((e) => ({ ...e, from: path })));

const CLOSE_OUTCOMES = new Set(["addressed", "explained"]);

// The close lines routed.mjs ingest would write for the series' `closes`, checked against the queue as
// it would stand: a conflict with an earlier close, or an id with no open line, is a refusal there.
const closeRefusals = (queueLines, closes, { step, front, segmentOf, now }) => {
  const valid = closes.filter((c) => typeof c.id === "string" && CLOSE_OUTCOMES.has(c.outcome) && typeof c.note === "string" && c.note !== "")
    .map(({ id, outcome, note }) => ({ id, outcome, note }));
  const { lines } = planIngest(queueLines, { step, kind: front.kind, segment: front.segment, segmentOf, routed: [], closes: valid }, now);
  const refusals = [];
  lines.reduce((acc, line) => {
    lineErrors(acc, line).forEach((m) => refusals.push(error("B3", `${m} (a closes entry marking ${line.id} ${line.status}; routed.mjs ingest would refuse it)`)));
    return [...acc, line];
  }, queueLines);
  return refusals;
};

// B3: `open` are the items that matched the step and were open at rendered_at (the prompt's list).
export const b3 = ({ open, closes, refusals }) => {
  const closed = new Set(closes.map((c) => c.id));
  return [
    ...open.filter((it) => !closed.has(it.id)).map((it) => finding("B3", it.kind === "must-address" ? "error" : "warn",
      `${it.id} ${it.kind} from ${it.from} on ${it.target} was listed for the step and is not in the closes of its reports: ${it.text}`)),
    ...refusals,
  ];
};

export const b4 = (readsOutside) => readsOutside.map((r) => warning("B4", `${r.path} was read outside the step's read set: ${r.why} (${r.from})`, { file: r.from }));

export const b5 = ({ reports, readCheck, dispatchPath }) => {
  if (readCheck === null) return [error("B5", `${dispatchPath} does not end in a read_check line`, { file: dispatchPath })];
  const latest = reports.at(-1);
  if (latest === undefined) return [error("B5", `no report of the current series to compare with the read_check of ${dispatchPath}`)];
  if (latest.report === null) return [error("B5", `${latest.path} cannot be read, so its read_check cannot be compared (${latest.error})`, { file: latest.path })];
  return latest.report.read_check === readCheck ? [] : [error("B5",
    `${latest.path} has read_check ${JSON.stringify(latest.report.read_check)}, but ${dispatchPath} ends in ${readCheck}: the subagent did not read the whole file`, { file: latest.path })];
};

export const b6 = (dispatchPath, bytes) => (bytes > WARN_BYTES
  ? [warning("B6", `${dispatchPath} is ${bytes} bytes, above ${WARN_BYTES} (32 KiB, spec 10.3), so one read may not return all of it`, { file: dispatchPath })]
  : []);

// ---------- C: the tree, scoped ----------

const without = (set, x) => new Set([...set].filter((y) => y !== x));

// Task 9's rule: a step that had to create its own ADR or contract gets no will-create warning for it.
const stepExtras = (ctx, front) => {
  const w = willCreate(ctx);
  return {
    willCreateAdrs: front.kind === "adr" ? without(w.adrs, front.target) : w.adrs,
    willCreateContracts: front.kind === "contract" ? without(w.contracts, front.target) : w.contracts,
    intakeStep: front.kind === "intake",
    recordPath: front.kind === "intake" ? (ctx.intake.record?.path ?? null) : null,
  };
};

const finalExtras = (ctx) => {
  const w = willCreate(ctx);
  return { willCreateAdrs: w.adrs, willCreateContracts: w.contracts };
};

// 10.6 Scope (decisions S-1, B-9): an error stays an error only when its file or a related file is in
// `changed`; otherwise it is a warning that says so. C0 and C1 run only when asked for (C1 runs the
// registry generator on a temporary copy).
const cFindings = (ctx, { ids, extras, changed, where }) => {
  const registry = ids.has("C0") || ids.has("C1") ? ctx.registry() : { c0: [], c1: [] };
  const tree = C.slice(2).some((id) => ids.has(id)) ? treeChecks(ctx, extras) : [];
  return [...registry.c0, ...registry.c1, ...tree]
    .filter((f) => ids.has(f.id))
    .map((f) => (!isError(f) || inScope(f, changed) ? f : { ...f, level: "warn", message: `${withFile(f)}; not changed ${where}` }));
};

// ---------- D1: prose rules ----------

const reportDirOf = (config) => (config.report_dir ?? "hsdd/auto/report").replace(/\/+$/, "");

// Every `<!-- slot:{name} -->` ... `<!-- /slot -->` of a segment report (10.9): { name, text, start, closed }.
export const slotsOf = (text) => [...text.matchAll(/<!--\s*slot:([A-Za-z0-9_-]+)\s*-->/g)].map((m) => {
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const close = /<!--\s*\/slot\s*-->/.exec(rest);
  const next = rest.search(/<!--\s*slot:/);
  const closed = close !== null && (next < 0 || close.index < next);
  return { name: m[1], text: rest.slice(0, closed ? close.index : next < 0 ? rest.length : next), start, closed };
});

const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const codePoint = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

// D1 for one file: each banned character (named by code point) and each banned phrase (any case) once,
// with its count and first line; with `slotsOnly`, only the text inside the prose slots.
export const proseFindings = (path, text, { chars, phrases, level, slotsOnly = false }) => {
  const parts = slotsOnly ? slotsOf(text).map((s) => ({ label: `slot ${s.name}`, text: s.text, offset: s.start })) : [{ label: null, text, offset: 0 }];
  const needles = [
    ...chars.map((ch) => ({ re: new RegExp(escapeRe(ch), "gu"), what: `the banned character ${codePoint(ch)}` })),
    ...phrases.map((p) => ({ re: new RegExp(escapeRe(p), "giu"), what: `the banned phrase "${p}"` })),
  ];
  return parts.flatMap((part) => needles.flatMap(({ re, what }) => {
    const hits = [...part.text.matchAll(re)];
    if (hits.length === 0) return [];
    const line = lineAt(text, part.offset + hits[0].index);
    return [finding("D1", level, `${path}:${line}${part.label ? ` (${part.label})` : ""}: contains ${what} (${plural(hits.length, "occurrence")}; prose_rules)`, { file: path })];
  }));
};

// 7.6's exemptions; a segment report is checked in its prose slots only.
const proseExempt = (p) => p === P.conventions || p.startsWith("hsdd/scripts/") || p.startsWith(".claude/") || p.startsWith(`${P.stepsDir}/`);

const d1 = (v) => {
  const { config, repoRoot } = v.ctx;
  const rules = config.prose_rules;
  const chars = unique((rules.banned_chars ?? []).flatMap((s) => [...s]));
  const phrases = (rules.banned_phrases ?? []).filter((p) => p !== "");
  if (chars.length === 0 && phrases.length === 0) return [];
  const reportDir = reportDirOf(config);
  return v.changed()
    .filter((p) => matchesAny(p, v.front.write_set) && !proseExempt(p))
    .flatMap((p) => {
      const text = textOf(repoRoot, p);
      if (text === null) return [];
      const slotsOnly = p.startsWith(`${reportDir}/`) && p.endsWith(".md");
      return proseFindings(p, text, { chars, phrases, level: rules.level === "error" ? "error" : "warn", slotsOnly });
    });
};

// ---------- F: the final checks ----------

const REF = /(?<![A-Za-z0-9_-])([a-z0-9][a-z0-9-]*)@(v\d+)(?![A-Za-z_])/g;
const versionNumber = (v) => Number(/^v(\d+)$/.exec(v ?? "")?.[1] ?? NaN);

// F2 over [{ file, text }]: per file and version, how often a contract is cited below its current
// version, outside that contract's own file.
export const staleVersionRefs = (files, contracts) => files.flatMap(({ file, text }) => {
  const counts = new Map();
  for (const m of text.matchAll(REF)) {
    const c = contracts.get(m[1]);
    if (!c || c.file === file || !(versionNumber(m[2]) < versionNumber(c.version))) continue;
    const key = `${m[1]}@${m[2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, count]) => ({ file, ref: key, count, current: contracts.get(key.split("@")[0]).version }));
});

// S-12: F2 reads the spec, contract (with fixtures and schemas) and ADR directories; the generated
// registries are left out.
const citationFiles = (repoRoot, layout) => unique([layout.spec, layout.contract, layout.adr]
  .flatMap((dir) => (filesUnder(join(repoRoot, dir)) ?? []).map((rel) => `${dir}/${rel}`)))
  .filter((p) => !/(^|\/)INDEX\.md$/i.test(p))
  .flatMap((file) => {
    const text = textOf(repoRoot, file);
    return text === null ? [] : [{ file, text }];
  });

// The first cell of every table row of a registry, without backticks, emphasis and link targets.
export const registrySlugs = (text) => new Set(text.split(/\r?\n/)
  .filter((l) => /^\s*\|/.test(l))
  .map((l) => l.trim().replace(/^\|/, "").split("|")[0].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*]/g, "").trim())
  .filter(Boolean));

const f2 = (ctx) => staleVersionRefs(citationFiles(ctx.repoRoot, ctx.layout), ctx.tree.contracts)
  .map((r) => warning("F2", `${r.file}: ${r.ref} ${plural(r.count, "time")}, current is ${r.current}; dated history may keep an old version (spec 12.4), so the report says each was read`, { file: r.file }));

const f4 = (queueLines) => [...queueItems(queueLines).values()]
  .filter((it) => it.status === "open" && (it.kind === "must-address" || it.kind === "insert-step"))
  .sort((a, b) => idNum(a.id) - idNum(b.id))
  .map((it) => error("F4", `${it.id} ${it.kind} from ${it.from} on ${it.target} is open${it.kind === "insert-step" ? ", neither accepted nor rejected" : ""}: ${it.text}`));

const f5 = (ctx) => {
  const path = `${ctx.layout.contract}/INDEX.md`;
  const named = new Map();
  for (const n of ctx.tree.contractNames) if (!named.has(n.slug)) named.set(n.slug, n.file);
  if (named.size === 0) return [];
  const text = textOf(ctx.repoRoot, path);
  if (text === null) return [error("F5", `${path} does not exist; the specs name ${names([...named.keys()])}`, { file: path })];
  const listed = registrySlugs(text);
  return [...named].filter(([slug]) => !listed.has(slug))
    .map(([slug, file]) => error("F5", `${path} does not list ${slug}, which ${file} names; regenerate it with ${P.genRegistry}`, { file: path }));
};

const f6 = (ctx) => {
  const path = `${reportDirOf(ctx.config)}/${ctx.segment.id}.md`;
  const text = textOf(ctx.repoRoot, path);
  if (text === null) return [error("F6", `${path} does not exist; write it with report.mjs --segment ${ctx.segment.id} and fill its prose slots`, { file: path })];
  return slotsOf(text).flatMap((s) => {
    if (!s.closed) return [error("F6", `${path}: slot ${s.name} has no closing <!-- /slot -->`, { file: path })];
    return s.text.trim() === "" ? [error("F6", `${path}: slot ${s.name} is empty; every prose slot is filled before the report step commits`, { file: path })] : [];
  });
};

// F1 to F6 among `ids`; the ledger is validated once for F1 and F3.
const finalChecks = (ctx, ids) => {
  if (!F.some((id) => ids.has(id))) return [];
  if (ctx.segment === null) throw new GateError([`${P.runYaml} has no segment, so the final checks have nothing to check`]);
  const ledger = memo(() => validateLedger(ctx.repoRoot));
  const run = (id, fn) => (ids.has(id) ? fn() : []);
  return [
    ...run("F1", () => unmetDone(ctx, { final: true, ledger: ledger() }).map((line) => error("F1", line))),
    ...run("F2", () => f2(ctx)),
    ...run("F3", () => [...ledger().errors.map((e) => error("F3", e)), ...ledger().warnings.map((w) => warning("F3", w))]),
    ...run("F4", () => f4(ctx.queueLines)),
    ...run("F5", () => f5(ctx)),
    ...run("F6", () => f6(ctx)),
  ];
};

// ---------- the step gate ----------

// The step's dispatch file and lazy readers for everything else the step gate reads.
const stepView = (ctx, step, { status, noReport }) => {
  const dispatchPath = stepPaths(step).dispatch;
  const entry = ctx.dispatches.get(step);
  if (entry === undefined) throw new GateError([`${step} has no dispatch file (${dispatchPath}); the step gate reads its kind, target, write set and head there`]);
  if (entry.error !== null || entry.front === null) throw new GateError([`${dispatchPath}: ${entry.error ?? "no front matter"}`]);
  const errs = dispatchErrors(entry.front, step);
  if (errs.length > 0) throw new GateError(errs.map((e) => `${dispatchPath}: ${e}`));
  const { repoRoot } = ctx;
  return {
    ctx,
    step,
    front: entry.front,
    status,
    noReport,
    subagent: !KINDS[entry.front.kind].orchestrator,
    dispatchPath,
    readCheck: entry.readCheck,
    now: nowStamp(),
    changed: memo(() => ctx.uncommitted().filter((p) => p !== P.decideLock)),
    reports: memo(() => readReports(repoRoot, step)),
    sidecar: memo(() => sidecarOf(repoRoot, step)),
  };
};

const segmentOfStep = (ctx) => (s) => ctx.dispatches.get(s)?.front?.segment ?? ctx.runLines.find((l) => l.step_ref === s)?.segment ?? null;

const STEP_CHECKS = {
  A1: (v) => a1({
    changed: v.changed(),
    writeSet: v.front.write_set,
    step: v.step,
    experimentsDir: v.ctx.config.experiments_dir.replace(/\/+$/, ""),
    owner: ownerMatcher(v.ctx.config.owner_files),
    never: neverPatterns(v.ctx.config, v.ctx.layout),
    subagent: v.subagent,
  }),
  // 10.6: only the owner can restore an owner file, so on a stopped step A2 is a warning.
  A2: (v) => a2(ownerState(v.ctx.repoRoot, v.ctx.config.owner_files), v.ctx.config.owner_files, v.status === "stopped" ? "warn" : "error"),
  A3: (v) => a3(copyState(v.ctx.repoRoot, v.ctx.config)),
  A4: (v) => a4(v.front.head, headState(v.ctx.repoRoot)),
  B1: (v) => b1({
    step: v.step, front: v.front, subagent: v.subagent, reports: v.subagent ? v.reports() : [], sidecar: v.sidecar(),
    exists: (p) => existsSync(join(v.ctx.repoRoot, p)),
  }),
  B2: (v) => b2({ sidecar: v.sidecar(), renderedAt: v.front.rendered_at, now: v.now }),
  B3: (v) => {
    if (!v.subagent) return [];
    const { ctx, front } = v;
    const open = openMatching(ctx.queueLines, { target: front.target, handoff: front.handoff ?? null }, leafParentsOf(ctx.tree), front.rendered_at, intakeHandoffTargets(ctx));
    const closes = entriesOf(v.reports(), "closes");
    return b3({ open, closes, refusals: closeRefusals(ctx.queueLines, closes, { step: v.step, front, segmentOf: segmentOfStep(ctx), now: v.now }) });
  },
  B4: (v) => (v.subagent ? b4(entriesOf(v.reports(), "reads_outside")) : []),
  B5: (v) => (v.subagent ? b5({ reports: v.reports(), readCheck: v.readCheck, dispatchPath: v.dispatchPath }) : []),
  B6: (v) => b6(v.dispatchPath, statSync(join(v.ctx.repoRoot, v.dispatchPath)).size),
  D1: d1,
};

const checkList = (v, checks) => {
  if (checks !== undefined) return CHECK_IDS.filter((id) => checks.includes(id));
  const base = DEFAULT_CHECKS[v.subagent ? "subagent" : "orchestrator"][v.status];
  const withFinal = v.front.kind === "report" && v.status === "completed" ? [...base, ...F] : base;
  return v.noReport ? withFinal.filter((id) => id !== "B1" && id !== "B5") : withFinal;
};

const checkArguments = (status, checks) => {
  if (!STATUSES.includes(status)) throw new GateError([`status is completed or stopped, not ${status}`]);
  const unknown = (checks ?? []).filter((id) => !CHECK_IDS.includes(id));
  if (unknown.length > 0) throw new GateError([`unknown check id(s) ${unknown.join(", ")}; the ids are ${CHECK_IDS.join(", ")}`]);
};

// The step gate (10.6) for `status`; `checks` runs only the named ids whatever the status (A2 keeps the
// status's level); `noReport` drops B1 and B5 (commit.mjs --no-report). The report step's C checks use
// the final scope, which holds every error the step scope would, and it runs F1 to F6.
export const stepGate = (ctx, step, { status = "completed", checks, noReport = false } = {}) => {
  checkArguments(status, checks);
  const v = stepView(ctx, step, { status, noReport });
  const ids = new Set(checkList(v, checks));
  const report = v.front.kind === "report";
  const own = [...A, ...B, "D1"].filter((id) => ids.has(id)).flatMap((id) => STEP_CHECKS[id](v));
  const tree = C.some((id) => ids.has(id))
    ? cFindings(ctx, report
      ? { ids, extras: finalExtras(ctx), changed: ctx.changedInSegment(v.front.segment), where: "in this segment" }
      : { ids, extras: stepExtras(ctx, v.front), changed: new Set(v.changed()), where: "by this step" })
    : [];
  return [...own, ...tree, ...finalChecks(ctx, ids)].sort(byCheck);
};

// ---------- the final gate ----------

// C0 to C8 over the whole tree with the final scope, then F1 to F6 (10.6).
export const finalGate = (ctx) => {
  if (ctx.segment === null) throw new GateError([`${P.runYaml} has no segment; the final gate checks the current segment`]);
  const ids = new Set([...C, ...F]);
  return [
    ...cFindings(ctx, { ids, extras: finalExtras(ctx), changed: ctx.changedInSegment(ctx.segment.id), where: "in this segment" }),
    ...finalChecks(ctx, ids),
  ].sort(byCheck);
};

// ---------- output ----------

export const formatFindings = (findings, changedCount) => {
  const e = findings.filter(isError).length;
  return [
    ...findings.map((f) => `${isError(f) ? "ERROR" : "warn "} ${f.id} ${withFile(f)}`),
    `gate: ${e} error(s), ${findings.length - e} warning(s), ${changedCount} changed file(s)`,
  ].join("\n");
};

// ---------- CLI ----------

const USAGE = [
  "gate.mjs --step S07 [--status completed|stopped] [--no-report]",
  "gate.mjs --step S07 --check B5,B6 [--status completed|stopped]",
  "gate.mjs --final",
].join("\n");

class UsageError extends Error {}

const OPTIONS = {
  step: { type: "string" }, check: { type: "string" }, final: { type: "boolean" }, status: { type: "string" }, "no-report": { type: "boolean" },
};

const parse = (argv) => {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  if (positionals.length > 0) throw new UsageError(`unexpected argument ${positionals[0]}`);
  if ((values.step !== undefined) === Boolean(values.final)) throw new UsageError("give exactly one of --step, --final");
  if (values.final) {
    const stray = ["check", "status", "no-report"].find((k) => values[k] !== undefined);
    if (stray) throw new UsageError(`--${stray} goes with --step, not --final`);
    return { final: true };
  }
  if (!/^S\d{2,}$/.test(values.step)) throw new UsageError(`--step takes a step id, not ${values.step}`);
  const status = values.status ?? "completed";
  if (!STATUSES.includes(status)) throw new UsageError(`--status is completed or stopped, not ${status}`);
  const checks = values.check?.split(",").map((s) => s.trim()).filter(Boolean);
  if (checks !== undefined) {
    if (checks.length === 0) throw new UsageError("--check names at least one check id");
    const unknown = checks.filter((id) => !CHECK_IDS.includes(id));
    if (unknown.length > 0) throw new UsageError(`unknown check id(s) ${unknown.join(", ")}; the ids are ${CHECK_IDS.join(", ")}`);
  }
  return { final: false, step: values.step, status, checks, noReport: Boolean(values["no-report"]) };
};

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  let args;
  try {
    args = parse(argv);
  } catch (e) {
    if (!(e instanceof UsageError) && !e?.code?.startsWith?.("ERR_PARSE_ARGS")) throw e;
    out.log(`usage error: ${e.message}`);
    out.log(USAGE);
    out.log("gate: usage error");
    return 2;
  }
  try {
    const ctx = loadContext(repoRoot);
    const findings = args.final ? finalGate(ctx) : stepGate(ctx, args.step, args);
    const changed = args.final ? ctx.changedInSegment(ctx.segment.id).size : ctx.uncommitted().filter((p) => p !== P.decideLock).length;
    out.log(formatFindings(findings, changed));
    return findings.some(isError) ? 1 : 0;
  } catch (e) {
    (Array.isArray(e?.errors) ? e.errors : [e?.message ?? String(e)]).forEach((m) => out.log(m));
    out.log("gate: failed before any check could run");
    return 1;
  }
};

const isEntry = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isEntry()) process.exitCode = main(process.argv.slice(2));
