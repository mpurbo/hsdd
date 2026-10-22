// Mints, stamps, validates and appends one decision (spec 10.4, appendix A.2). Usage: see USAGE.
// The id is minted, the line validated and the append done inside the lock file, so two
// concurrent calls never share an id.
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { validate, loadSchema } from "./lib/schema.mjs";
import { nowStamp } from "./lib/time.mjs";
import { P, resolveLayout, stepPaths } from "./lib/paths.mjs";
import { decisionTypeFor } from "./lib/kinds.mjs";
import { loadConfig } from "./lib/config.mjs";
import { loadTree } from "./lib/tree.mjs";
import { appendJsonl, idNum, judgementCommitted, readDispatch, readJsonl } from "./lib/records.mjs";

export class DecideError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "DecideError";
    this.errors = errors;
  }
}

const SUPPLIED_BY_SCRIPT = ["id", "at", "segment", "step", "step_ref", "by", "commit"];
const DECISION_TYPES = loadSchema("decision").$defs.type.enum;
const BYS = loadSchema("decision").$defs.by.enum;

// ---------- ids (pure over the files) ----------

const sidecarFiles = (repoRoot) => {
  const dir = join(repoRoot, P.stepsDir);
  return existsSync(dir) ? readdirSync(dir).filter((n) => /\.decisions\.jsonl$/.test(n)).sort().map((n) => `${P.stepsDir}/${n}`) : [];
};

// One more than the highest id in the ledger and in every step's sidecar.
export const nextDecisionId = (repoRoot) => {
  const ids = [P.ledger, ...sidecarFiles(repoRoot)].flatMap((rel) => readJsonl(repoRoot, rel)).map((l) => idNum(l.id));
  return `DEC-${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`;
};

// The rules appendix A.2 states in prose; shared with ledger.mjs. `d` is any decision-shaped object.
export const decisionRuleErrors = (d) => {
  const errors = [];
  if (Array.isArray(d.options) && !d.options.some((o) => o?.label === d.chosen)) {
    errors.push(`${d.id ?? "decision"}: chosen is not one of the options' labels`);
  }
  if ((d.stop_class !== null && d.stop_class !== undefined) !== (d.would_have_asked === true)) {
    errors.push(`${d.id ?? "decision"}: stop_class is set exactly when would_have_asked is true`);
  }
  if (d.blast_radius === "upstream" && d.would_upstream !== true) {
    errors.push(`${d.id ?? "decision"}: blast_radius upstream implies would_upstream true`);
  }
  return errors;
};

// ---------- the lock ----------

const LOCK_RETRY_MS = 50;
const LOCK_WAIT_MS = 10_000;
const LOCK_STALE_MS = 60_000;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A lock older than LOCK_STALE_MS is replaced: it is renamed to a unique name, and the renamed file
// is judged by its inode. When the inode is the one judged stale it is deleted; when it differs, the
// rename moved a lock another process had just taken, which is therefore live: nothing is put back and
// nothing deleted, and the caller keeps waiting. Returns "replaced", "live" or "none".
export const replaceIfStale = (file, { staleMs = LOCK_STALE_MS, beforeRename = () => {} } = {}) => {
  try {
    const seen = statSync(file);
    if (Date.now() - seen.mtimeMs <= staleMs) return "live";
    beforeRename();
    const moved = `${file}.stale.${process.pid}.${randomBytes(4).toString("hex")}`;
    renameSync(file, moved);
    if (statSync(moved).ino !== seen.ino) return "live";
    unlinkSync(moved);
    return "replaced";
  } catch {
    return "none"; // gone already, or someone else replaced it: the caller retries
  }
};

// The holder removes the lock only while the file still holds its own pid.
const releaseLock = (file) => {
  try {
    if (readFileSync(file, "utf8").trim() === String(process.pid)) unlinkSync(file);
  } catch {
    // already removed
  }
};

export const withLock = (repoRoot, fn) => {
  const file = join(repoRoot, P.decideLock);
  mkdirSync(dirname(file), { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fd = openSync(file, "wx");
      writeSync(fd, `${process.pid}\n`);
      closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      replaceIfStale(file);
      if (Date.now() > deadline) throw new DecideError([`${P.decideLock} is held; gave up after ${LOCK_WAIT_MS / 1000} s`]);
      sleep(LOCK_RETRY_MS);
    }
  }
  try {
    return fn();
  } finally {
    releaseLock(file);
  }
};

// ---------- decide ----------

const dispatchOf = (repoRoot, step) => {
  let dispatch;
  try {
    dispatch = readDispatch(repoRoot, step);
  } catch (e) {
    throw new DecideError([`${stepPaths(step).dispatch}: ${e.message}`]);
  }
  if (dispatch === null) throw new DecideError([`${step} has no dispatch file (${stepPaths(step).dispatch}); decide only for a dispatched step`]);
  if (typeof dispatch.front?.kind !== "string" || typeof dispatch.front?.segment !== "string") {
    throw new DecideError([`${stepPaths(step).dispatch} has no kind or segment`]);
  }
  return dispatch.front;
};

const typeOf = (repoRoot, front, by, explicit) => {
  if (explicit !== undefined) return explicit;
  if (by !== "subagent") return front.kind === "setup" ? "setup" : "plan";
  // A tree is read only for the two kinds whose type depends on the target.
  if (front.kind !== "spec-touch" && front.kind !== "citation-touch") return decisionTypeFor(front.kind, front.target);
  try {
    const config = loadConfig(repoRoot);
    const tree = front.kind === "citation-touch" ? loadTree(repoRoot, resolveLayout(repoRoot), { root: config.root }) : null;
    return decisionTypeFor(front.kind, front.target, tree, config.root);
  } catch (e) {
    throw new DecideError([`cannot assign the decision type of a ${front.kind} step: ${e.message} (pass --type)`]);
  }
};

export const decide = (repoRoot, { step, by = "subagent", type, input }) => {
  const errors = [];
  if (!/^S\d{2,}$/.test(step ?? "")) throw new DecideError([`not a step id: ${String(step)}`]);
  if (!BYS.includes(by)) throw new DecideError([`--by is ${BYS.join(", ")}, not ${by}`]);
  if (type !== undefined && !DECISION_TYPES.includes(type)) throw new DecideError([`--type is one of ${DECISION_TYPES.join(", ")}, not ${type}`]);
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new DecideError(["the decision is not a JSON object"]);
  for (const k of SUPPLIED_BY_SCRIPT.filter((f) => Object.hasOwn(input, f))) {
    errors.push(`${k} is set by decide.mjs; remove it from the input`);
  }
  errors.push(...validate("decision", input, "decisionInput").filter((e) => !/unexpected property (id|at|segment|step|step_ref|by|commit)$/.test(e)));
  errors.push(...decisionRuleErrors(input));
  if (errors.length > 0) throw new DecideError(errors);

  const front = dispatchOf(repoRoot, step);
  if (judgementCommitted(repoRoot, step)) throw new DecideError([`${step} has its judgement commit; a decision for it can no longer be recorded`]);
  const decisionType = typeOf(repoRoot, front, by, type);

  return withLock(repoRoot, () => {
    const id = nextDecisionId(repoRoot);
    const at = nowStamp();
    const { model, ...rest } = input;
    const line = { id, at, by, step: decisionType, ...rest, ...(model !== undefined ? { model } : {}) };
    const lineErrors = [...validate("decision", line, "sidecarDecision"), ...decisionRuleErrors(line)];
    if (lineErrors.length > 0) throw new DecideError(lineErrors);
    appendJsonl(repoRoot, stepPaths(step).decisions, line);
    return { id, at };
  });
};

// ---------- CLI ----------

const USAGE = "decide.mjs --step S07 [--by subagent|orchestrator|owner] [--type <decision type>] (--stdin | --file d.json)";

class UsageError extends Error {}

const OPTIONS = {
  step: { type: "string" }, by: { type: "string" }, type: { type: "string" }, stdin: { type: "boolean" }, file: { type: "string" },
};

const readInput = (values, repoRoot) => {
  if (Boolean(values.stdin) === (values.file !== undefined)) throw new UsageError("give exactly one of --stdin, --file");
  const text = values.stdin ? readFileSync(0, "utf8") : readFileSync(resolve(repoRoot, values.file), "utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new DecideError([`the decision is not valid JSON (${e.message})`]);
  }
};

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  try {
    const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    if (positionals.length > 0) throw new UsageError(`unexpected argument ${positionals[0]}`);
    if (values.step === undefined) throw new UsageError("missing --step");
    if (values.by !== undefined && !BYS.includes(values.by)) throw new UsageError(`--by is ${BYS.join(", ")}, not ${values.by}`);
    if (values.type !== undefined && !DECISION_TYPES.includes(values.type)) throw new UsageError(`--type is one of ${DECISION_TYPES.join(", ")}, not ${values.type}`);
    const input = readInput(values, repoRoot);
    const { id, at } = decide(repoRoot, { step: values.step, by: values.by, type: values.type, input });
    out.log(`${id} at ${at}`);
    return 0;
  } catch (e) {
    if (e instanceof UsageError || e?.code?.startsWith?.("ERR_PARSE_ARGS")) {
      out.log(`usage error: ${e.message}`);
      out.log(USAGE);
      out.log("decide: usage error");
      return 2;
    }
    (e instanceof DecideError ? e.errors : [e.message]).forEach((m) => out.log(m));
    out.log("decide: failed, nothing written");
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
