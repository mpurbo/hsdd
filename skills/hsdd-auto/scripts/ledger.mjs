// The ledger and the run log (spec 10.5, appendix A.2 and A.3): appends the step's sidecar and
// run line, validates both, prints the next decision id. Usage: see USAGE.
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { validate } from "./lib/schema.mjs";
import { nowStamp, stampMs } from "./lib/time.mjs";
import { P } from "./lib/paths.mjs";
import { loadConfig } from "./lib/config.mjs";
import { commitStamp, revExists } from "./lib/git.mjs";
import { appendJsonl, idNum, listDispatches, readDispatch, readJsonl, readSidecar, stepNum } from "./lib/records.mjs";
import { decisionRuleErrors, nextDecisionId } from "./decide.mjs";

export { nextDecisionId };

export class LedgerError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "LedgerError";
    this.errors = errors;
  }
}

const WINDOW_MS = 60_000;

const dispatchFront = (repoRoot, step) => {
  try {
    return readDispatch(repoRoot, step)?.front ?? null;
  } catch {
    return null;
  }
};

const requireFront = (repoRoot, step) => {
  const front = dispatchFront(repoRoot, step);
  if (front === null) throw new LedgerError([`${step} has no readable dispatch file`]);
  return front;
};

// ---------- decisions ----------

// Appends the step's sidecar lines to the ledger in id order, adding segment, step_ref and commit.
// Ids already in the ledger are skipped, so a rerun after a crash appends only what is missing.
// All lines are validated first; on any error nothing is written.
export const appendDecisions = (repoRoot, step, commit) => {
  const front = requireFront(repoRoot, step);
  if (!revExists(repoRoot, commit)) throw new LedgerError([`commit ${commit} does not exist`]);
  const present = readJsonl(repoRoot, P.ledger);
  const have = new Set(present.map((l) => l.id));
  const top = Math.max(0, ...present.map((l) => idNum(l.id)));
  const lines = readSidecar(repoRoot, step)
    .sort((a, b) => idNum(a.id) - idNum(b.id))
    .filter((d) => !have.has(d.id))
    .map(({ id, at, by, step: type, artifact, question, options, chosen, why, evidence, blast_radius, confidence, would_have_asked, stop_class, would_upstream, model }) => ({
      id, at, segment: front.segment, step: type, step_ref: step, by, artifact, question, options, chosen, why, evidence,
      blast_radius, confidence, would_have_asked, stop_class, would_upstream, ...(model !== undefined ? { model } : {}), commit,
    }));
  const errors = lines.flatMap((l) => [
    ...validate("decision", l).map((e) => `${l.id}: ${e}`),
    ...decisionRuleErrors(l),
    ...(idNum(l.id) <= top ? [`${l.id} is not above the ledger's highest id DEC-${String(top).padStart(3, "0")}; appending it would break id order`] : []),
  ]);
  if (errors.length > 0) throw new LedgerError(errors);
  lines.forEach((l) => appendJsonl(repoRoot, P.ledger, l));
  return lines.length;
};

// ---------- run line ----------

// Appends the step's run line (6.3); false when the run log already has a line for the step.
export const appendRunLine = (repoRoot, { step, commit, status, model, usage, note }) => {
  if (readJsonl(repoRoot, P.runLog).some((l) => l.step_ref === step)) return false;
  const front = requireFront(repoRoot, step);
  if (!revExists(repoRoot, commit)) throw new LedgerError([`commit ${commit} does not exist`]);
  const line = {
    step_ref: step, segment: front.segment, kind: front.kind, skill: front.skill, target: front.target,
    started: front.rendered_at, finished: commitStamp(repoRoot, commit), commit,
    dispatches: front.launches.length, status,
    ...(typeof front.continues === "string" ? { continues: front.continues } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(usage !== undefined ? { usage } : {}),
    ...(note !== undefined ? { note } : {}),
  };
  const errors = validate("run-line", line);
  if (errors.length > 0) throw new LedgerError(errors.map((e) => `run line ${step}: ${e}`));
  appendJsonl(repoRoot, P.runLog, line);
  return true;
};

// ---------- validate ----------

const OFFSET_STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}:?\d{2})$/;

// Milliseconds of a Z stamp, or of a legacy stamp with a numeric zone offset; null when it is neither.
const legacyMs = (s) => {
  if (typeof s !== "string" || !OFFSET_STAMP.test(s)) return null;
  const ms = Date.parse(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(ms) ? null : ms;
};

// Legacy lines (10.5) are checked against the current shape with the fields they never had
// stood in, after refusing the ones they must not have; a legacy `at` is normalised to Z first.
const legacyDecisionErrors = (line) => {
  const extra = ["by", "model"].filter((f) => Object.hasOwn(line, f));
  if (extra.length > 0) return [`legacy line has ${extra.join(", ")}, which the earlier shape never carried`];
  const ms = legacyMs(line.at);
  if (ms === null) return [`at: not a timestamp (${JSON.stringify(line.at)})`];
  return validate("decision", { ...line, segment: "legacy", by: "subagent", at: nowStampOf(ms) });
};

const nowStampOf = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

const legacyRunErrors = (line) => {
  const started = legacyMs(line.started);
  const finished = legacyMs(line.finished);
  if (started === null || finished === null) return ["started and finished are timestamps, with a Z or a numeric offset"];
  return validate("run-line", { ...line, segment: "legacy", started: nowStampOf(started), finished: nowStampOf(finished) });
};

const idErrorsAndWarnings = (lines) => {
  const errors = [];
  const warnings = [];
  lines.reduce((prev, l) => {
    const n = idNum(l.id);
    if (prev !== null && n === prev) errors.push(`${l.id}: id appears more than once`);
    else if (prev !== null && n < prev) errors.push(`${l.id}: ids must increase in file order (follows DEC-${String(prev).padStart(3, "0")})`);
    else if (prev !== null && n > prev + 1) {
      warnings.push(`id gap between DEC-${String(prev).padStart(3, "0")} and ${l.id}: an id was minted and never committed`);
    }
    return Math.max(prev ?? 0, n);
  }, null);
  return { errors, warnings };
};

const settled = (fn) => {
  try {
    return { value: fn(), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
};

export const validateLedger = (repoRoot, { now = nowStamp() } = {}) => {
  const errors = [];
  const warnings = [];
  const nowMs = stampMs(now);

  const ledger = settled(() => readJsonl(repoRoot, P.ledger));
  const runLog = settled(() => readJsonl(repoRoot, P.runLog));
  if (ledger.error) errors.push(ledger.error);
  if (runLog.error) errors.push(runLog.error);
  const config = settled(() => loadConfig(repoRoot));
  const opened = new Map((config.value?.segments ?? []).map((s) => [s.id, s.opened_at]));

  const commitOk = new Map();
  const commitExists = (c) => {
    if (!commitOk.has(c)) commitOk.set(c, typeof c === "string" && revExists(repoRoot, c));
    return commitOk.get(c);
  };
  const steps = listDispatches(repoRoot);
  const renderedAt = (step) => {
    const at = dispatchFront(repoRoot, step)?.rendered_at;
    return typeof at === "string" && OFFSET_STAMP.test(at) ? legacyMs(at) : null;
  };

  // ----- decisions -----
  const unreadable = new Set();
  const lines = ledger.value ?? [];
  const legacy = lines.filter((l) => !Object.hasOwn(l, "segment"));
  if (legacy.length > 0) {
    warnings.push(`${legacy.length} legacy ledger line(s) without segment (an earlier record shape); validated against that shape, times not window-checked`);
  }
  const ids = idErrorsAndWarnings(lines);
  errors.push(...ids.errors);
  warnings.push(...ids.warnings);
  if (config.error && lines.some((l) => Object.hasOwn(l, "segment"))) errors.push(`cannot check segment start times: ${config.error.split("\n")[0]}`);

  for (const l of lines) {
    const label = l.id ?? "(line without id)";
    const isLegacy = !Object.hasOwn(l, "segment");
    const shape = isLegacy ? legacyDecisionErrors(l) : validate("decision", l);
    errors.push(...shape.map((e) => `${label}: ${e}`));
    if (shape.length > 0) continue;
    errors.push(...decisionRuleErrors(l));
    if (!commitExists(l.commit)) errors.push(`${label}: commit ${l.commit} does not exist`);
    const at = isLegacy ? legacyMs(l.at) : stampMs(l.at);
    if (at > nowMs) errors.push(`${label}: at ${l.at} lies in the future`);
    if (isLegacy) continue;
    const segmentOpened = opened.get(l.segment);
    if (config.value && segmentOpened === undefined) errors.push(`${label}: segment ${l.segment} is not in run.yaml`);
    else if (segmentOpened !== undefined && at < stampMs(segmentOpened)) errors.push(`${label}: at ${l.at} is before segment ${l.segment} opened (${segmentOpened})`);
    const started = renderedAt(l.step_ref);
    if (started === null) {
      errors.push(`${label}: ${l.step_ref} has no readable dispatch file, so the time window cannot be checked`);
      continue;
    }
    const low = started - WINDOW_MS;
    if (l.by === "subagent") {
      if (!commitExists(l.commit)) continue;
      const high = stampMs(commitStamp(repoRoot, l.commit)) + WINDOW_MS;
      if (at < low || at > high) errors.push(`${label}: at ${l.at} is outside ${l.step_ref}'s window (${nowStampOf(low)} to ${nowStampOf(high)})`);
    } else {
      const later = steps.filter((s) => stepNum(s) > stepNum(l.step_ref));
      const next = later.find((s) => renderedAt(s) !== null);
      later.slice(0, next === undefined ? later.length : later.indexOf(next)).forEach((s) => unreadable.add(s));
      const high = (next !== undefined ? renderedAt(next) : null) ?? nowMs;
      if (at < low || at > high) errors.push(`${label}: at ${l.at} is outside ${l.step_ref}'s window (${nowStampOf(low)} to ${nowStampOf(high)})`);
    }
  }

  [...unreadable].forEach((s) => warnings.push(`${P.dispatchDir}/${s}.md is unreadable; the orchestrator window of an earlier step runs to the next readable step instead`));

  // ----- run log -----
  const runLines = runLog.value ?? [];
  const legacyRuns = runLines.filter((l) => !Object.hasOwn(l, "segment"));
  if (legacyRuns.length > 0) {
    warnings.push(`${legacyRuns.length} legacy run log line(s) without segment (an earlier record shape); validated against that shape`);
  }
  const seen = new Set();
  for (const l of runLines) {
    const label = l.step_ref ?? "(run line without step_ref)";
    const isLegacy = !Object.hasOwn(l, "segment");
    const shape = isLegacy ? legacyRunErrors(l) : validate("run-line", l);
    errors.push(...shape.map((e) => `run line ${label}: ${e}`));
    if (shape.length > 0) continue;
    if (seen.has(l.step_ref)) errors.push(`run line ${label}: more than one run line for the step`);
    seen.add(l.step_ref);
    if (!commitExists(l.commit)) errors.push(`run line ${label}: commit ${l.commit} does not exist`);
    if (legacyMs(l.finished) > nowMs) errors.push(`run line ${label}: finished ${l.finished} lies in the future`);
  }
  return { errors, warnings };
};

// ---------- CLI ----------

const USAGE = [
  "ledger.mjs decisions --step S07 --commit <sha>",
  "ledger.mjs run --step S07 --commit <sha> --status completed|stopped [--model <id>] [--usage-file u.json] [--note \"...\"]",
  "ledger.mjs validate",
  "ledger.mjs next-id",
].join("\n");

class UsageError extends Error {}

const OPTIONS = {
  step: { type: "string" }, commit: { type: "string" }, status: { type: "string" }, model: { type: "string" },
  "usage-file": { type: "string" }, note: { type: "string" },
};

const need = (values, ...names) => {
  const missing = names.filter((n) => values[n] === undefined);
  if (missing.length > 0) throw new UsageError(`missing ${missing.map((n) => `--${n}`).join(", ")}`);
};

const commands = {
  decisions: ({ values }, repoRoot) => {
    need(values, "step", "commit");
    const n = appendDecisions(repoRoot, values.step, values.commit);
    return { code: 0, lines: [], summary: `decisions ${values.step}: appended ${n}` };
  },
  run: ({ values }, repoRoot) => {
    need(values, "step", "commit", "status");
    if (!["completed", "stopped"].includes(values.status)) throw new UsageError(`--status is completed or stopped, not ${values.status}`);
    let usage;
    if (values["usage-file"] !== undefined) {
      try {
        usage = JSON.parse(readFileSync(join(repoRoot, values["usage-file"]), "utf8"));
      } catch (e) {
        throw new LedgerError([`--usage-file ${values["usage-file"]}: ${e.message}`]);
      }
    }
    const added = appendRunLine(repoRoot, { step: values.step, commit: values.commit, status: values.status, model: values.model, usage, note: values.note });
    return { code: 0, lines: [], summary: added ? `run ${values.step}: appended` : `run ${values.step}: a run line exists; nothing appended` };
  },
  validate: (_parsed, repoRoot) => {
    const { errors, warnings } = validateLedger(repoRoot);
    return {
      code: errors.length > 0 ? 1 : 0,
      lines: [...errors.map((e) => `error: ${e}`), ...warnings.map((w) => `warning: ${w}`)],
      summary: `ledger: ${errors.length} error(s), ${warnings.length} warning(s)`,
    };
  },
  "next-id": (_parsed, repoRoot) => ({ code: 0, lines: [], summary: nextDecisionId(repoRoot) }),
};

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  try {
    const parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    const command = commands[parsed.positionals[0]];
    if (!command) throw new UsageError(`unknown command ${parsed.positionals[0] ?? "(none)"}`);
    const { code, lines, summary } = command(parsed, repoRoot);
    lines.forEach((l) => out.log(l));
    out.log(summary);
    return code;
  } catch (e) {
    if (e instanceof UsageError || e?.code?.startsWith?.("ERR_PARSE_ARGS")) {
      out.log(`usage error: ${e.message}`);
      out.log(USAGE);
      out.log("ledger: usage error");
      return 2;
    }
    (e instanceof LedgerError ? e.errors : [e.message]).forEach((m) => out.log(m));
    out.log("ledger: failed, nothing written");
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
