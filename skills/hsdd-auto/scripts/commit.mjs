// The two commits of a step (spec 10.7, 6.11): the artifact commit of its write-set changes and
// experiments, then the judgement commit of its records, with a rerun after a crash at any point
// continuing where the crash left off (8.9); the skip commit of an intake handoff (6.12); and the
// plan's step log (6.9), regenerated whole at every judgement and skip commit. Subjects, messages, the
// step log and the section rewrite are pure; the phases are the edge. With `state.mjs open-segment`
// this is the only script that changes git state. Usage: see USAGE.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContext } from "./lib/context.mjs";
import { ConfigError, loadConfig } from "./lib/config.mjs";
import { KINDS } from "./lib/kinds.mjs";
import { P, judgementSet, matchesAny, ownerMatcher, stepPaths } from "./lib/paths.mjs";
import { changedPaths, currentBranch, git, headSha, headSubject, indexEmpty } from "./lib/git.mjs";
import {
  appendJsonl, committedJsonl, dispatchErrors, judgementCommitted, readDispatch, readJsonl, readReports, seriesOf, sidecarEntries,
} from "./lib/records.mjs";
import { validate } from "./lib/schema.mjs";
import { nowStamp } from "./lib/time.mjs";
import { citesSuperseded, supersededStrings, targetFiles } from "./lib/intake.mjs";
import { CHECK_IDS, GateError, admissionOf, b1, formatFindings, ownerProblems, ownerState, stepGate } from "./gate.mjs";
import { appendDecisions, appendRunLine } from "./ledger.mjs";
import { ingest, markAddressed, queueItems, wouldIngest } from "./routed.mjs";
import { handoffStates } from "./next.mjs";

export class CommitError extends Error {
  constructor(errors, { findings = [], changed = 0 } = {}) {
    super([...errors, ...findings.map((f) => `${f.id} ${f.message}`)].join("\n"));
    this.name = "CommitError";
    this.errors = errors;
    this.findings = findings;
    this.changed = changed;
  }
}

// Crash points, in order (tests stop a run after one of them; the CLI has no such option).
export const PHASES = Object.freeze(["stage", "artifact", "decisions", "ingest", "addressed", "run", "plan", "judgement-stage"]);
export const SKIP_PHASES = Object.freeze(["append", "plan", "stage"]);

const STATUSES = ["completed", "stopped"];
const STEP_ID = /^S\d{2,}$/;
const HANDOFF_ID = /^H\d+[a-z]?$/;
const STOPPED = " (stopped)";
const SUMMARY_CHARS = 72;

const unique = (xs) => [...new Set(xs)];
const short = (sha) => sha.slice(0, 7);
const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const cut = (s, n) => [...s].slice(0, n).join("").trimEnd();
const isOrchestrator = (front) => KINDS[front.kind]?.orchestrator === true;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- subjects and messages (6.11) ----------

export const artifactPrefix = (commit, front) => (isOrchestrator(front)
  ? `${commit.orchestrator}: ${front.step_ref} ${front.kind}: `
  : `${commit.artifact}: ${front.step_ref} ${front.kind} ${front.target}: `);

// The suffix ` (stopped)` belongs to the status, and resume detection reads it (10.7 step 1), so a
// summary never ends in `(stopped)`; a summary left empty by that becomes `no summary`.
const subjectSummary = (summary) => {
  const s = oneLine(summary).replace(/(?:\s*\(stopped\))+$/, "").trim();
  return s === "" ? "no summary" : s;
};

export const artifactSubject = (commit, front, summary, status) =>
  `${artifactPrefix(commit, front)}${subjectSummary(summary)}${status === "stopped" ? STOPPED : ""}`;

export const judgementSubject = (commit, step) => `${commit.judgement}: ${step}`;

export const skipSubject = (commit, handoff, reason) => `${commit.orchestrator}: skip ${handoff}: ${reason}`;

// The subject, then the configured trailers one per line after a blank line.
export const commitMessage = (subject, trailers = []) => (trailers.length > 0 ? `${subject}\n\n${trailers.join("\n")}\n` : `${subject}\n`);

// 10.7: --summary when given, else the report's first notes entry cut to 72 characters, else
// `no summary`; an orchestrator step without --summary takes its segment id. The report is the latest
// of the current series (`reports`, in launch order), the one B5 reads.
export const summaryOf = ({ summary, front, reports }) => {
  if (summary !== undefined) return oneLine(summary);
  if (isOrchestrator(front)) return front.segment;
  const notes = reports.at(-1)?.report?.notes;
  const note = (Array.isArray(notes) ? notes : []).filter((n) => typeof n === "string").map(oneLine).find((n) => n !== "");
  return note === undefined ? "no summary" : cut(note, SUMMARY_CHARS);
};

// The run line's one-line note (6.3): the orchestrator's --note first, so that a note starting
// `ended:` still reads as a segment's end (8.11), then what the commit itself must tell a reader.
// `ownerLeftOut` is the gate's A2 verdict, [{ file, problem }].
export const runNote = ({ note, noReport = false, discarded = [], ownerLeftOut = [], empty = false }) => {
  const parts = [
    note,
    noReport ? "no valid report" : null,
    discarded.length > 0 ? `discarded: ${discarded.join(", ")}` : null,
    ownerLeftOut.length > 0
      ? `owner file${ownerLeftOut.length === 1 ? "" : "s"} flagged by A2, left in place and out of the commit: ${ownerLeftOut.map((o) => `${o.file} (${o.problem})`).join(", ")}`
      : null,
    empty ? "no artifact changed; empty artifact commit" : null,
  ].filter((p) => typeof p === "string" && p !== "");
  return parts.length > 0 ? parts.join("; ") : undefined;
};

// ---------- the plan (6.9, S-6) ----------

const HEADER = ["Step", "Segment", "Kind", "Skill", "Target", "Status", "Artifact commit"];

const cell = (v) => {
  const s = oneLine(v);
  return s === "" ? "-" : s.replace(/\|/g, "\\|");
};
const row = (cells) => `| ${cells.map(cell).join(" | ")} |`;
const runRow = (l) => row([l.step_ref, l.segment, l.kind, l.skill, l.target, l.status, typeof l.commit === "string" ? short(l.commit) : null]);
const skipRow = (l) => row(["-", l.segment, "skip", "none", l.handoff, `skipped: ${oneLine(l.reason)}`, "-"]);

// Each line's row with the time it merges by; a line without a readable time keeps its predecessor's.
const timed = (lines, field, toRow) => lines.reduce((acc, l) => {
  const ms = Date.parse(l?.[field] ?? "");
  return [...acc, { text: toRow(l), t: Number.isNaN(ms) ? (acc.at(-1)?.t ?? -Infinity) : ms }];
}, []);

// A stable merge of two sequences, each kept in its own order: the next skip goes first only when it is
// earlier than the next run line, so a run line ties ahead (a skip follows the step before it).
const merge = (runs, skips) => {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < runs.length || j < skips.length) {
    if (j < skips.length && (i >= runs.length || skips[j].t < runs[i].t)) out.push(skips[j++]);
    else out.push(runs[i++]);
  }
  return out;
};

// The step log: one row per run line, in run-log order, and per skip line, in handoffs.jsonl order,
// interleaved by time (a run line's `finished`, a skip's `at`), so a skewed clock never reorders the run.
export const stepLogTable = (runLines, skipLines) => [
  row(HEADER),
  `|${HEADER.map((h) => "-".repeat(h.length + 2)).join("|")}|`,
  ...merge(timed(runLines, "finished", runRow), timed(skipLines, "at", skipRow)).map((r) => r.text),
].join("\n");

const FENCE = /^\s*(```|~~~)/;

// Indexes of the level-1 and level-2 heading lines outside fenced blocks.
const headingLines = (ls) => ls.reduce((acc, l, i) => {
  if (FENCE.test(l)) return { ...acc, fenced: !acc.fenced };
  return !acc.fenced && /^#{1,2}\s/.test(l) ? { ...acc, at: [...acc.at, i] } : acc;
}, { fenced: false, at: [] }).at;

// `## {heading}`'s body, up to the next level-1 or level-2 heading, replaced whole by `content`; the
// section is appended when the text has none.
export const replaceSection = (markdown, heading, content) => {
  const ls = markdown.split(/\r?\n/);
  const body = content.replace(/\s+$/, "").split(/\r?\n/);
  const heads = headingLines(ls);
  const title = new RegExp(`^##[ \\t]+${escapeRe(heading)}[ \\t]*$`);
  const start = heads.find((i) => title.test(ls[i]));
  if (start === undefined) {
    const before = markdown.replace(/\s+$/, "");
    return `${before}${before === "" ? "" : "\n\n"}## ${heading}\n\n${body.join("\n")}\n`;
  }
  const end = heads.find((i) => i > start) ?? ls.length;
  return [...ls.slice(0, start + 1), "", ...body, "", ...ls.slice(end)].join("\n");
};

export const planSkeleton = (run) => `# Run plan: ${run}\n\n## Segments\n\n## Step log\n\n## Change log\n`;

// A whole-file write that a reader never sees half done: a temporary file beside it, then a rename. The
// temporary name is fixed, so a write that dies before the rename is overwritten by the rerun's.
const writeAtomic = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = join(dirname(file), `.${basename(file)}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
};

// S-6: the skeleton when plan.md is missing (the first setup step commits before any plan step).
export const ensurePlan = (repoRoot, config) => {
  const file = join(repoRoot, P.plan);
  if (!existsSync(file)) writeAtomic(file, planSkeleton(config.run));
  return readFileSync(file, "utf8");
};

const writeStepLog = (repoRoot, config) => {
  const text = ensurePlan(repoRoot, config);
  const next = replaceSection(text, "Step log", stepLogTable(readJsonl(repoRoot, P.runLog), readJsonl(repoRoot, P.handoffs)));
  if (next !== text) writeAtomic(join(repoRoot, P.plan), next);
};

// ---------- git at the edge ----------

// Paths are literal: a file name with `*` or a leading `:` is never read as a pathspec pattern.
const LITERAL = "--literal-pathspecs";

const present = (repoRoot, rel) => {
  try {
    lstatSync(join(repoRoot, rel));
    return true;
  } catch {
    return false;
  }
};

// Stages exactly `paths`: the present ones with one `git add --`, each deletion with `git add -A --`.
const stage = (repoRoot, paths) => {
  const here = paths.filter((p) => present(repoRoot, p));
  if (here.length > 0) git(repoRoot, [LITERAL, "add", "--", ...here]);
  paths.filter((p) => !here.includes(p)).forEach((p) => git(repoRoot, [LITERAL, "add", "-A", "--", p]));
};

const unstageAll = (repoRoot) => { git(repoRoot, ["reset", "-q"]); };

const makeCommit = (repoRoot, message, { allowEmpty = false } = {}) => {
  git(repoRoot, ["commit", "-q", "--cleanup=whitespace", ...(allowEmpty ? ["--allow-empty"] : []), "-F", "-"], { input: message });
  return headSha(repoRoot, { short: false });
};

const inHead = (repoRoot, rel) => git(repoRoot, ["cat-file", "-e", `HEAD:${rel}`], { allowFail: true }) !== null;

const emptyCommit = (repoRoot, sha) => git(repoRoot, ["diff", "--quiet", `${sha}^`, sha], { allowFail: true }) !== null;

const branchGuard = (repoRoot, config) => {
  const branch = currentBranch(repoRoot);
  if (branch !== config.branch) {
    throw new CommitError([`the current branch is ${branch ?? "(a detached HEAD)"}, not the run's branch ${config.branch} (${P.runYaml}); every commit of the run lands on ${config.branch}`]);
  }
};

// ---------- reads ----------

const dispatchFront = (repoRoot, step) => {
  const path = stepPaths(step).dispatch;
  let d;
  try {
    d = readDispatch(repoRoot, step);
  } catch (e) {
    throw new CommitError([`${path}: ${e.message}`]);
  }
  if (d === null) throw new CommitError([`${step} has no dispatch file (${path}); a step is committed from its dispatch file`]);
  const errors = dispatchErrors(d.front, step);
  if (errors.length > 0) throw new CommitError(errors.map((e) => `${path}: ${e}`));
  return d.front;
};

const readUsage = (repoRoot, file) => {
  if (file === undefined) return undefined;
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, file), "utf8"));
  } catch (e) {
    throw new CommitError([`--usage-file ${file}: ${e.message}`]);
  }
};

// The run line this commit will append, checked before anything is written, so that a bad --model or
// --usage-file never fails after the artifact commit.
const runLineErrors = (front, { status, model, usage }) => validate("run-line", {
  step_ref: front.step_ref, segment: front.segment, kind: front.kind, skill: front.skill, target: front.target,
  started: front.rendered_at, finished: nowStamp(), commit: "0000000", dispatches: front.launches.length, status,
  ...(typeof front.continues === "string" ? { continues: front.continues } : {}),
  ...(model !== undefined ? { model } : {}),
  ...(usage !== undefined ? { usage } : {}),
}).map((e) => `the run line would not validate (--model, --usage-file): ${e}`);

// The owner files the gate's A2 flags (6.10), each with its problem: left in place and out of the
// commit, and named in the run line's note.
const flaggedOwnerFiles = (repoRoot, config) => ownerProblems(ownerState(repoRoot, config.owner_files), config.owner_files);

// 6.1: handoffs.jsonl is append-only, so its lines beyond HEAD's are the uncommitted ones.
const uncommittedSkips = (repoRoot) => readJsonl(repoRoot, P.handoffs).slice(committedJsonl(repoRoot, P.handoffs).length);

// ---------- refusals that read the records (10.7) ----------

// An insert-step item the step's report opened that is still `open` (8.5), or one `routed.mjs ingest`
// would open now because the review never ingested it (`ingestable` false: the series is renamed under
// --no-report and never ingested).
const insertStepErrors = (repoRoot, front, { ingestable }) => {
  const step = front.step_ref;
  const open = [...queueItems(readJsonl(repoRoot, P.queue)).values()]
    .filter((it) => it.kind === "insert-step" && it.from === step && it.status === "open")
    .map((it) => `${it.id} insert-step (${it.step_kind} on ${it.step_target}) from ${step} is still open: ${it.text}; accept or reject it with a plan decision in ${step}'s sidecar and routed.mjs decide before the commit (spec 8.5)`);
  const unopened = (ingestable ? wouldIngest(repoRoot, step).lines : [])
    .filter((l) => l.status === "open" && l.kind === "insert-step")
    .map((l) => `${step}'s report routes an insert-step (${l.step_kind} on ${l.step_target}) that routed.mjs ingest has not opened: ${l.text}; run routed.mjs ingest --step ${step}, then accept or reject it (spec 8.5)`);
  return [...open, ...unopened];
};

// A skip line appended by a `--skip` that stopped before its commit: the step's judgement commit would
// carry it, so the skip is finished first.
const pendingSkipErrors = (repoRoot, step) => uncommittedSkips(repoRoot).map((l) =>
  `${P.handoffs} has an uncommitted skip line for ${l.handoff} (segment ${l.segment}), from a skip that stopped before its commit; finish it with commit.mjs --skip ${l.handoff} --reason "..." before committing ${step}`);

// A completed inserted step marks its accepted item addressed (6.5); a rerun finds it addressed.
const queueItemErrors = (repoRoot, front, status) => {
  if (status !== "completed" || front.queue_item == null) return [];
  const it = queueItems(readJsonl(repoRoot, P.queue)).get(front.queue_item);
  const step = front.step_ref;
  if (!it) return [`${step}'s queue_item ${front.queue_item} is not in ${P.queue}`];
  if (it.kind !== "insert-step") return [`${step}'s queue_item ${it.id} is a ${it.kind} item, not an insert-step item`];
  if (it.status !== "accepted" && it.status !== "addressed") {
    return [`${step}'s queue_item ${it.id} is ${it.status}; a completed inserted step marks an accepted item addressed (spec 6.5)`];
  }
  return [];
};

const refuseIf = (errors) => { if (errors.length > 0) throw new CommitError(errors); };

// ---------- 10.7 step 1: resume detection ----------

// HEAD is the step's artifact commit: the records are next. The index is dirty at the dispatch head: a
// run crashed after staging, so it is unstaged. Any other artifact commit of the step below HEAD is refused.
const detectResume = (repoRoot, config, front, status) => {
  const step = front.step_ref;
  const prefix = artifactPrefix(config.commit, front);
  const head = headSha(repoRoot, { short: false });
  const subject = headSubject(repoRoot) ?? "";
  if (subject.startsWith(prefix)) {
    const made = subject.endsWith(STOPPED) ? "stopped" : "completed";
    if (made !== status) throw new CommitError([`HEAD ${short(head)} is ${step}'s artifact commit, made as ${made}; rerun with --status ${made} to finish it`]);
    return { artifact: head, lines: [`resuming ${step}: HEAD ${short(head)} is its artifact commit and has no judgement commit; continuing from the records (spec 8.9)`] };
  }
  const earlier = git(repoRoot, ["log", "--format=%H%x09%s", `${front.head}..HEAD`]).split("\n").filter(Boolean)
    .map((l) => l.split("\t")).find(([, s]) => s.startsWith(prefix));
  if (earlier) {
    throw new CommitError([`${step}'s artifact commit ${short(earlier[0])} exists, but HEAD ${short(head)} is a later commit, so its judgement commit cannot follow it; the run never rewrites history, so restore HEAD to ${short(earlier[0])} by hand and rerun`]);
  }
  if (head.startsWith(front.head) && !indexEmpty(repoRoot)) {
    unstageAll(repoRoot);
    return { artifact: null, lines: [`unstaged the index: HEAD is ${step}'s dispatch head, so an earlier run crashed after staging (spec 8.9)`] };
  }
  return { artifact: null, lines: [] };
};

// ---------- --no-report and --discard (10.7 step 3) ----------

// 8.6: the current series becomes `{step}.invalid{k}[.r{n}].json`, k one above the step's highest.
const renameInvalid = (repoRoot, step) => {
  const dir = join(repoRoot, P.stepsDir);
  const names = existsSync(dir) ? readdirSync(dir) : [];
  const series = seriesOf(names, step);
  if (series.length === 0) return [];
  const invalid = new RegExp(`^${step}\\.invalid(\\d+)(?:\\.r\\d+)?\\.json$`);
  const k = Math.max(0, ...names.flatMap((n) => invalid.exec(n)?.[1] ?? []).map(Number)) + 1;
  const renames = series.map((from) => [from, from.replace(/\/([^/]+?)((?:\.r\d+)?)\.json$/, `/$1.invalid${k}$2.json`)]);
  renames.forEach(([from, to]) => renameSync(join(repoRoot, from), join(repoRoot, to)));
  return renames.map(([from, to]) => `renamed ${from} -> ${to}: no valid report (spec 8.6)`);
};

export const discardPath = (arg) => String(arg).replace(/^(\.\/)+/, "").replace(/\/+$/, "");

// Each --discard argument with the changed files it covers; refused when it names a path outside the
// repository, an owner file, or a path the step's write set, records or experiments_dir admit.
const planDiscard = (repoRoot, config, front, args) => {
  const owner = ownerMatcher(config.owner_files);
  const admitted = admissionOf(config, front);
  const changed = changedPaths(repoRoot);
  const plans = args.map((arg) => {
    const path = discardPath(arg);
    if (path === "" || path.startsWith("/") || path.split("/").includes("..") || path === ".git" || path.startsWith(".git/")) {
      return { path, error: `--discard ${arg}: not a path inside the repository` };
    }
    const files = changed.filter((c) => c === path || c.startsWith(`${path}/`));
    const blocked = unique([path, ...files].filter(admitted));
    const owned = blocked.filter(owner);
    if (owned.length > 0) return { path, error: `--discard ${arg}: ${owned.join(", ")} is an owner file; only the owner restores it, so the step is committed stopped with it in place (spec 10.7)` };
    if (blocked.length > 0) return { path, error: `--discard ${arg}: ${blocked.join(", ")} is admitted by the step's write set, its records or experiments_dir; --discard restores only paths outside them (spec 10.7)` };
    return { path, files, error: null };
  });
  refuseIf(plans.flatMap((p) => (p.error ? [p.error] : [])));
  return plans;
};

// A tracked file goes back to HEAD; an untracked one is removed.
const restore = (repoRoot, rel) => {
  if (inHead(repoRoot, rel)) {
    git(repoRoot, [LITERAL, "checkout", "HEAD", "--", rel]);
    return `discarded ${rel}: restored to HEAD`;
  }
  git(repoRoot, [LITERAL, "reset", "-q", "--", rel]);
  rmSync(join(repoRoot, rel), { force: true, recursive: true });
  return `discarded ${rel}: removed, it was untracked`;
};

// ---------- 10.7 step 2: the gate ----------

const byCheck = (a, b) => CHECK_IDS.indexOf(a.id) - CHECK_IDS.indexOf(b.id);

// The step gate for the step's kind and status (10.6). B1's sidecar rule also runs where the gate
// leaves B1 out (an orchestrator step, --no-report), since `ledger.mjs decisions` appends the sidecar
// after the artifact commit and a line it refuses there would leave the step half committed.
const runGate = (repoRoot, front, { status, noReport }) => {
  const ctx = loadContext(repoRoot);
  const step = front.step_ref;
  let findings;
  try {
    findings = stepGate(ctx, step, { status, noReport });
  } catch (e) {
    if (e instanceof GateError) throw new CommitError(e.errors);
    throw e;
  }
  const sidecar = isOrchestrator(front) || noReport
    ? b1({ step, front, subagent: false, reports: [], sidecar: sidecarEntries(repoRoot, step), exists: () => true, status: null })
    : [];
  return { findings: [...findings, ...sidecar].sort(byCheck), changed: ctx.uncommitted().filter((p) => p !== P.decideLock).length };
};

// ---------- 10.7 steps 3 and 6: what each commit stages ----------

const artifactPaths = (repoRoot, config, front) => {
  const owner = ownerMatcher(config.owner_files);
  const experiments = `${config.experiments_dir.replace(/\/+$/, "")}/**`;
  return changedPaths(repoRoot).filter((p) => p !== P.decideLock && !owner(p) && (matchesAny(p, front.write_set) || matchesAny(p, [experiments])));
};

const judgementPaths = (repoRoot, config, step) => {
  const owner = ownerMatcher(config.owner_files);
  return changedPaths(repoRoot).filter((p) => matchesAny(p, judgementSet(step)) && !owner(p));
};

// ---------- a step ----------

// ---------- options: one check, one wording, for the CLI (exit 2) and for callers (CommitError) ----------

// A one-line text option: whitespace runs become one space; given but empty is an error.
const textOption = (name, v, errors) => {
  if (v === undefined) return undefined;
  const t = oneLine(v);
  if (t === "") errors.push(`--${name} is one line of text, not empty`);
  return t;
};

// { value, errors }: a step commit's options, normalized, and every way they are wrong.
export const stepOptions = (opts) => {
  const { step, status, summary, model, usageFile, note, discard = [], noReport = false } = opts ?? {};
  const errors = [];
  if (!STEP_ID.test(String(step))) errors.push(`--step takes a step id (S07), not ${String(step)}`);
  if (!STATUSES.includes(status)) errors.push(`--status is completed or stopped, not ${status === undefined ? "missing" : String(status)}`);
  if (noReport && status !== "stopped") errors.push("--no-report goes with --status stopped (a gate-twice raised by B1 or B5, spec 8.6)");
  const value = {
    step, status, summary: textOption("summary", summary, errors), model: textOption("model", model, errors), usageFile,
    note: textOption("note", note, errors), discard: [...discard], noReport: Boolean(noReport),
  };
  return { value, errors };
};

// { value, errors } for --skip.
export const skipOptions = (opts) => {
  const errors = [];
  const handoff = opts?.handoff;
  if (!HANDOFF_ID.test(String(handoff))) errors.push(`--skip takes a handoff id (H7, H7c), not ${String(handoff)}`);
  const reason = textOption("reason", opts?.reason, errors);
  if (reason === undefined) errors.push("--skip needs --reason");
  return { value: { handoff, reason }, errors };
};

const valid = ({ value, errors }) => {
  refuseIf(errors);
  return value;
};

// Attaches what the run did before a failure, so the CLI can print it above the error.
const withProgress = (lines, fn) => {
  try {
    return fn();
  } catch (e) {
    if (e !== null && typeof e === "object") e.progress = lines;
    throw e;
  }
};

// 10.7 for one step, over options `stepOptions` accepted. `stopAfter` names a phase of PHASES after
// which the run returns as if it had crashed there ({ stoppedAfter, ... }); tests use it, the CLI never does.
const stepPhases = (repoRoot, o, { stopAfter = null } = {}) => {
  const lines = [];
  return withProgress(lines, () => {
    const config = loadConfig(repoRoot);
    branchGuard(repoRoot, config);
    const front = dispatchFront(repoRoot, o.step);
    if (judgementCommitted(repoRoot, o.step)) {
      throw new CommitError([`${o.step} is already committed: its run line is in HEAD's ${P.runLog}, so it has its judgement commit`]);
    }
    if (o.noReport && isOrchestrator(front)) {
      throw new CommitError([`--no-report renames a subagent step's report series; ${o.step} is an orchestrator step (${front.kind}) with no report`]);
    }
    refuseIf(pendingSkipErrors(repoRoot, o.step));
    const usage = readUsage(repoRoot, o.usageFile);
    refuseIf(runLineErrors(front, { status: o.status, model: o.model, usage }));

    const resume = detectResume(repoRoot, config, front, o.status);
    lines.push(...resume.lines);
    const stop = (phase, extra = {}) => (stopAfter === phase ? { stoppedAfter: phase, lines, ...extra } : null);
    let artifact = resume.artifact;
    let findings = [];

    if (artifact === null) {
      if (readJsonl(repoRoot, P.runLog).some((l) => l.step_ref === o.step)) {
        throw new CommitError([`${P.runLog} already has a line for ${o.step}, but HEAD is not its artifact commit; the records and the history disagree, so nothing is committed`]);
      }
      refuseIf([
        ...queueItemErrors(repoRoot, front, o.status),
        ...insertStepErrors(repoRoot, front, { ingestable: !o.noReport }),
      ]);
      const discards = planDiscard(repoRoot, config, front, o.discard);
      lines.push(...discards.flatMap((d) => d.files.map((f) => restore(repoRoot, f))));

      const gate = runGate(repoRoot, front, o);
      findings = gate.findings;
      if (findings.some((f) => f.level === "error")) {
        throw new CommitError([`${o.step}: the gate failed (spec 10.6)`], { findings, changed: gate.changed });
      }
      lines.push(formatFindings(findings, gate.changed));
      // Under --no-report the gate skips B1 and B5 and reads the series nowhere else, so the series is
      // renamed only once the gate passed, and a refused run leaves it in place.
      if (o.noReport) lines.push(...renameInvalid(repoRoot, o.step));

      if (!indexEmpty(repoRoot)) unstageAll(repoRoot);
      stage(repoRoot, artifactPaths(repoRoot, config, front));
      const s1 = stop("stage");
      if (s1) return s1;
      const subject = artifactSubject(config.commit, front, summaryOf({ summary: o.summary, front, reports: readReports(repoRoot, o.step) }), o.status);
      artifact = makeCommit(repoRoot, commitMessage(subject, config.commit.trailers), { allowEmpty: indexEmpty(repoRoot) });
      lines.push(`artifact ${artifact} ${subject}`);
      const s2 = stop("artifact", { artifact });
      if (s2) return s2;
    } else {
      refuseIf([
        ...queueItemErrors(repoRoot, front, o.status),
        ...insertStepErrors(repoRoot, front, { ingestable: !o.noReport }),
      ]);
    }

    try {
      // 10.7 step 4: every append skips what is already there, so a rerun adds nothing twice.
      appendDecisions(repoRoot, o.step, artifact);
      const s3 = stop("decisions", { artifact });
      if (s3) return s3;
      ingest(repoRoot, o.step);
      const s4 = stop("ingest", { artifact });
      if (s4) return s4;
      if (o.status === "completed" && front.queue_item != null) markAddressed(repoRoot, front.queue_item, o.step, `step ${o.step} committed`);
      const s5 = stop("addressed", { artifact });
      if (s5) return s5;
      const note = runNote({
        note: o.note, noReport: o.noReport, discarded: o.discard.map(discardPath),
        ownerLeftOut: flaggedOwnerFiles(repoRoot, config), empty: emptyCommit(repoRoot, artifact),
      });
      appendRunLine(repoRoot, { step: o.step, commit: artifact, status: o.status, model: o.model, usage, note });
      const s6 = stop("run", { artifact });
      if (s6) return s6;

      // 10.7 steps 5 and 6.
      writeStepLog(repoRoot, config);
      const s7 = stop("plan", { artifact });
      if (s7) return s7;
      if (!indexEmpty(repoRoot)) unstageAll(repoRoot);
      stage(repoRoot, judgementPaths(repoRoot, config, o.step));
      const s8 = stop("judgement-stage", { artifact });
      if (s8) return s8;
      const subject = judgementSubject(config.commit, o.step);
      const judgement = makeCommit(repoRoot, commitMessage(subject, config.commit.trailers));
      lines.push(`judgement ${judgement} ${subject}`);
      return { artifact, judgement, findings, lines };
    } catch (e) {
      if (e !== null && typeof e === "object") e.artifact = artifact;
      throw e;
    }
  });
};

export const commitStepPhases = (repoRoot, opts, { stopAfter = null } = {}) => {
  if (stopAfter !== null && !PHASES.includes(stopAfter)) throw new TypeError(`unknown phase ${stopAfter}; the phases are ${PHASES.join(", ")}`);
  return stepPhases(repoRoot, valid(stepOptions(opts)), { stopAfter });
};

export const commitStep = (repoRoot, opts) => commitStepPhases(repoRoot, opts);

// ---------- a skipped handoff (6.12) ----------

// 12.2: a handoff without a `when` always runs; `cites-superseded` is evaluated now.
const conditionOf = (ctx, entry) => {
  if (entry.when === null || entry.when === undefined) {
    return { holds: true, why: `${entry.id} has no when condition: it always runs, so it is never skipped (spec 12.2)` };
  }
  if (entry.when !== "cites-superseded") return { holds: true, why: `${entry.id}'s when condition ${JSON.stringify(entry.when)} is not one this script evaluates` };
  const files = targetFiles(entry.kind, entry.target, ctx.layout, ctx.tree);
  return {
    holds: citesSuperseded(ctx.repoRoot, files, supersededStrings(ctx.config, ctx.tree)),
    why: `${entry.id}'s condition cites-superseded holds: ${files.join(", ") || `no file of ${entry.target}`} still names a baseline source or a contract version below the current one, so the handoff runs (spec 12.2)`,
  };
};

// 10.7 --skip over options `skipOptions` accepted; `stopAfter` names a phase of SKIP_PHASES.
const skipPhases = (repoRoot, { handoff, reason }, { stopAfter = null } = {}) => {
  const lines = [];
  return withProgress(lines, () => {
    const config = loadConfig(repoRoot);
    branchGuard(repoRoot, config);
    const ctx = loadContext(repoRoot);
    const seg = ctx.segment;
    if (seg === null || seg.mode !== "intake") {
      throw new CommitError([`--skip records a skipped intake handoff; the current segment ${seg ? `${seg.id} is a ${seg.mode} segment` : "is missing"}`]);
    }
    if (ctx.inProgress !== null) throw new CommitError([`${ctx.inProgress} is open (a dispatch file without its judgement commit); commit it before a skip`]);
    const states = handoffStates(ctx);
    const state = states.find((h) => h.id === handoff);
    if (!state) throw new CommitError([`${handoff} is not a handoff of segment ${seg.id}'s intake record; its handoffs are ${states.map((h) => h.id).join(", ") || "none yet"}`]);
    if (state.state === "skipped") throw new CommitError([`${handoff} is already skipped by a committed skip line in ${P.handoffs}`]);
    if (state.state === "executed" || state.step !== null) throw new CommitError([`${handoff} already has a step, ${state.step}; a handoff with a step is never skipped`]);

    // Its own uncommitted line first: a skip that stopped after the append already found the condition
    // false, and the rerun only makes the commit (10.7).
    const pending = uncommittedSkips(repoRoot);
    const isMine = (l) => l.handoff === handoff && l.segment === seg.id;
    const mine = pending.filter(isMine);
    const stray = [...pending.filter((l) => !isMine(l)), ...mine.slice(1)];
    if (stray.length > 0) {
      throw new CommitError(stray.map((l) => `${P.handoffs} has another uncommitted line (${l.handoff}, segment ${l.segment}); a skip commit holds one line`));
    }
    const resumed = mine.length > 0;
    const line = resumed ? mine[0] : { segment: seg.id, handoff, at: nowStamp(), status: "skipped", reason };
    if (resumed) {
      lines.push(`resuming the skip of ${handoff}: its line is in ${P.handoffs} without a commit (spec 10.7)`);
    } else {
      const condition = conditionOf(ctx, ctx.intake.record.block.handoffs.find((h) => h.id === handoff));
      if (condition.holds) throw new CommitError([condition.why]);
      refuseIf(validate("handoff-skip", line).map((e) => `the skip line would not validate: ${e}`));
      appendJsonl(repoRoot, P.handoffs, line);
      lines.push(`appended the skip line of ${handoff} to ${P.handoffs}`);
    }
    const stop = (phase) => (stopAfter === phase ? { stoppedAfter: phase, line, lines } : null);
    const s1 = stop("append");
    if (s1) return s1;
    writeStepLog(repoRoot, config);
    const s2 = stop("plan");
    if (s2) return s2;
    if (!indexEmpty(repoRoot)) unstageAll(repoRoot);
    const owner = ownerMatcher(config.owner_files);
    const changed = new Set(changedPaths(repoRoot));
    stage(repoRoot, [P.handoffs, P.plan].filter((p) => changed.has(p) && !owner(p)));
    const s3 = stop("stage");
    if (s3) return s3;
    const subject = skipSubject(config.commit, handoff, oneLine(line.reason));
    const commit = makeCommit(repoRoot, commitMessage(subject, config.commit.trailers));
    lines.push(`skip ${commit} ${subject}`);
    return { commit, line, lines, resumed };
  });
};

export const skipHandoffPhases = (repoRoot, opts, { stopAfter = null } = {}) => {
  if (stopAfter !== null && !SKIP_PHASES.includes(stopAfter)) throw new TypeError(`unknown phase ${stopAfter}; the phases are ${SKIP_PHASES.join(", ")}`);
  return skipPhases(repoRoot, valid(skipOptions(opts)), { stopAfter });
};

export const skipHandoff = (repoRoot, opts) => skipHandoffPhases(repoRoot, opts);

// ---------- CLI ----------

const USAGE = [
  "commit.mjs --step S07 --status completed|stopped [--summary \"one line\"]",
  "           [--model <id>] [--usage-file u.json] [--note \"one line\"]",
  "           [--discard <path>]... [--no-report]",
  "commit.mjs --skip H7c --reason \"one line\"",
].join("\n");

class UsageError extends Error {}

const OPTIONS = {
  step: { type: "string" }, status: { type: "string" }, summary: { type: "string" }, model: { type: "string" },
  "usage-file": { type: "string" }, note: { type: "string" }, discard: { type: "string", multiple: true }, "no-report": { type: "boolean" },
  skip: { type: "string" }, reason: { type: "string" },
};
const MODE_OPTIONS = {
  step: ["step", "status", "summary", "model", "usage-file", "note", "discard", "no-report"],
  skip: ["skip", "reason"],
};

const parse = (argv) => {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  if (positionals.length > 0) throw new UsageError(`unexpected argument ${positionals[0]}`);
  if ((values.step !== undefined) === (values.skip !== undefined)) throw new UsageError("give exactly one of --step, --skip");
  const mode = values.step !== undefined ? "step" : "skip";
  const stray = Object.keys(values).find((k) => !MODE_OPTIONS[mode].includes(k));
  if (stray) throw new UsageError(`--${stray} does not go with --${mode}`);
  const { value, errors } = mode === "skip"
    ? skipOptions({ handoff: values.skip, reason: values.reason })
    : stepOptions({
      step: values.step, status: values.status, summary: values.summary, model: values.model, usageFile: values["usage-file"],
      note: values.note, discard: values.discard ?? [], noReport: Boolean(values["no-report"]),
    });
  if (errors.length > 0) throw new UsageError(errors.join("; "));
  return { mode, opts: value };
};

const runStep = (repoRoot, opts, out) => {
  const r = stepPhases(repoRoot, opts);
  r.lines.forEach((l) => out.log(l));
  out.log(`commit: ${opts.step} committed ${opts.status}, artifact ${short(r.artifact)}, judgement ${short(r.judgement)}`);
};

const runSkip = (repoRoot, opts, out) => {
  const r = skipPhases(repoRoot, opts);
  r.lines.forEach((l) => out.log(l));
  out.log(`commit: ${opts.handoff} skipped, commit ${short(r.commit)}`);
};

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  let parsed;
  try {
    parsed = parse(argv);
  } catch (e) {
    if (!(e instanceof UsageError) && !e?.code?.startsWith?.("ERR_PARSE_ARGS")) throw e;
    out.log(`usage error: ${e.message}`);
    out.log(USAGE);
    out.log("commit: usage error");
    return 2;
  }
  const what = parsed.mode === "step" ? parsed.opts.step : `skip ${parsed.opts.handoff}`;
  try {
    (parsed.mode === "step" ? runStep : runSkip)(repoRoot, parsed.opts, out);
    return 0;
  } catch (e) {
    (e?.progress ?? []).forEach((l) => out.log(l));
    if (e instanceof CommitError) {
      if (e.findings.length > 0) out.log(formatFindings(e.findings, e.changed));
      e.errors.forEach((m) => out.log(m));
      out.log(`commit: ${what} refused, nothing committed`);
    } else if (e instanceof ConfigError) {
      e.errors.forEach((m) => out.log(m));
      out.log(`commit: ${what} refused, nothing committed`);
    } else {
      (Array.isArray(e?.errors) ? e.errors : [e?.message ?? String(e)]).forEach((m) => out.log(m));
      out.log(typeof e?.artifact === "string"
        ? `commit: ${what} failed after its artifact commit ${short(e.artifact)}; fix the cause and run the same command again, which continues from the records (spec 8.9)`
        : `commit: ${what} failed unexpectedly before its artifact commit; check git status, then run the same command again`);
    }
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
