// The run's state view and the segment commands (spec 10.1), plus the additive setup subcommands
// `preflight`, `snapshot` and `install-scripts` (decision A-7). The view is a pure function of one
// repository snapshot (lib/context.mjs) apart from two reads of the open step's files. Only
// `open-segment` changes git state; `snapshot` and `install-scripts` write files and never touch git.
// Usage: see USAGE.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContext } from "./lib/context.mjs";
import { loadConfig } from "./lib/config.mjs";
import { P, filesUnder, judgementSet, matchesAny, ownerFileHash, ownerMatcher, resolveLayout, skillsRoot } from "./lib/paths.mjs";
import { branchExists, changedPaths, currentBranch, git } from "./lib/git.mjs";
import { dateOf, nowStamp } from "./lib/time.mjs";
import { appendSegmentEntry, parseYaml } from "./lib/yaml.mjs";
import { validate } from "./lib/schema.mjs";
import { idNum, nextFreeStep, reportSeries } from "./lib/records.mjs";
import { queueItems } from "./routed.mjs";
import { contractsNotFinal, findingLine, handoffStates, idFindings, leafParentsToPlan, selectNext, unmetDone, willCreate } from "./next.mjs";
import { artifactPrefix } from "./commit.mjs";

const USAGE = [
  "usage: state.mjs [--json]",
  "       state.mjs done | goal | upstream | preflight | snapshot | install-scripts",
  "       state.mjs open-segment --mode plan|intake --instruction-file f.md [--request <path> --authority <a>] [--stop-policy <p>]",
].join("\n");

export class StateError extends Error {
  constructor(errors, { usage = false } = {}) {
    super([].concat(errors).join("\n"));
    this.name = "StateError";
    this.errors = [].concat(errors);
    this.usage = usage;
  }
}

// ---------- the state view (10.1) ----------

const lastLine = (ctx) => (ctx.segment === null ? null : ctx.committedRunLines.filter((l) => l.segment === ctx.segment.id).at(-1) ?? null);

// 8.11: the segment's last committed run line carries a note starting `ended:`.
const isEnded = (ctx) => typeof lastLine(ctx)?.note === "string" && lastLine(ctx).note.startsWith("ended:");

const isFinished = (ctx) => ctx.segment !== null
  && ctx.committedRunLines.some((l) => l.segment === ctx.segment.id && l.kind === "report" && l.status === "completed");

const stopText = (ctx) => (ctx.stopExists ? readFileSync(join(ctx.repoRoot, P.stop), "utf8") : null);
const stopClassOf = (text) => /^- \*\*Stop class:\*\*\s*(\S+)/m.exec(text)?.[1] ?? null;
const stopStepOf = (text) => /^# Run stopped at (S\d{2,})/m.exec(text)?.[1] ?? null;

// Segment stopped: STOP.md is committed and its stopped step belongs to the segment.
const isStopped = (ctx) => {
  if (ctx.segment === null || !ctx.stopCommitted) return false;
  const lines = ctx.committedRunLines.filter((l) => l.segment === ctx.segment.id);
  const step = stopStepOf(stopText(ctx) ?? "");
  return step === null ? lines.some((l) => l.status === "stopped") : lines.some((l) => l.step_ref === step);
};

const inProgressOf = (ctx) => {
  const step = ctx.inProgress;
  if (step === null) return null;
  const front = ctx.dispatches.get(step)?.front ?? null;
  const subjects = front?.head ? git(ctx.repoRoot, ["log", "--format=%s", `${front.head}..HEAD`], { allowFail: true }) : null;
  const prefix = front ? artifactPrefix(ctx.config.commit, front) : null;
  return {
    step,
    has_report: reportSeries(ctx.repoRoot, step).length > 0,
    has_artifact_commit: subjects !== null && prefix !== null && subjects.split("\n").some((s) => s.startsWith(prefix)),
  };
};

const queueCounts = (ctx) => {
  const counts = {};
  for (const it of queueItems(ctx.queueLines).values()) {
    if (it.status === "open") counts[it.kind] = (counts[it.kind] ?? 0) + 1;
  }
  return counts;
};

export const stateView = (ctx) => {
  const { tree } = ctx;
  const steps = [...ctx.dispatches.keys()];
  const stop = stopText(ctx);
  const seg = ctx.segment;
  return {
    run: ctx.config.run,
    branch: ctx.branch,
    head: ctx.head,
    segment: seg === null ? null : { id: seg.id, mode: seg.mode, stop_policy: seg.stop_policy, first_step: seg.first_step, ended: isEnded(ctx) },
    steps: { count: steps.length, last: steps.at(-1) ?? null, in_progress: inProgressOf(ctx) },
    stop: stop === null ? null : { class: stopClassOf(stop), path: P.stop },
    queue: queueCounts(ctx),
    tree: {
      nodes: tree.nodes.size,
      leaf_parents_without_plan: leafParentsToPlan(tree).filter((n) => !n.hasPhasePlan).map((n) => n.id),
      pending_sections: [...tree.nodes.values()].filter((n) => n.pending.entries > 0).map((n) => ({ node: n.id, entries: n.pending.entries })),
      contracts_not_final: contractsNotFinal(tree),
      unresolved_ids: idFindings(ctx, willCreate(ctx)).map(findingLine),
    },
    ...(seg?.mode === "intake"
      ? { intake: { record: ctx.intake.record?.path ?? null, handoffs: handoffStates(ctx).map((h) => ({ id: h.id, kind: h.kind, target: h.target, state: h.state, step: h.step ?? null })) } }
      : {}),
    next: selectNext(ctx),
  };
};

const listOrNone = (xs) => (xs.length === 0 ? "none" : xs.join(", "));

export const formatState = (view) => {
  const { segment: seg, steps, stop, tree } = view;
  const queue = Object.entries(view.queue).map(([k, n]) => `${k} ${n}`);
  return [
    `run: ${view.run} (branch ${view.branch ?? "none"}, head ${view.head ?? "none"})`,
    seg === null
      ? "segment: none"
      : `segment: ${seg.id} (${seg.mode}, stop policy ${seg.stop_policy}, first step ${seg.first_step})${seg.ended ? ", ended by an owner message" : ""}`,
    `steps: ${steps.count} dispatched, last ${steps.last ?? "none"}${steps.in_progress
      ? `; in progress ${steps.in_progress.step} (report: ${steps.in_progress.has_report ? "yes" : "no"}, artifact commit: ${steps.in_progress.has_artifact_commit ? "yes" : "no"})`
      : ""}`,
    stop === null ? "stop: none" : `stop: class ${stop.class ?? "unknown"}, see ${stop.path}`,
    `queue: ${listOrNone(queue)}`,
    `tree: ${tree.nodes} nodes`,
    `  leaf-parents without a phase plan: ${listOrNone(tree.leaf_parents_without_plan)}`,
    `  pending sections: ${listOrNone(tree.pending_sections.map((p) => `${p.node} (${p.entries})`))}`,
    `  contracts not final: ${listOrNone(tree.contracts_not_final)}`,
    `  unresolved ids: ${tree.unresolved_ids.length === 0 ? "none" : ""}`,
    ...tree.unresolved_ids.map((l) => `    ${l}`),
    ...(view.intake
      ? [`intake: record ${view.intake.record ?? "none"}`, ...view.intake.handoffs.map((h) => `  ${h.id} ${h.kind} ${h.target}: ${h.state}${h.step ? ` (${h.step})` : ""}`)]
      : []),
    `next: ${JSON.stringify(view.next)}`,
  ].join("\n");
};

// ---------- done, goal, upstream (10.1, 11.4) ----------

// { code, lines } for `done`.
export const doneResult = (ctx) => {
  const unmet = unmetDone(ctx);
  if (ctx.segment === null) return { code: 1, lines: unmet };
  if (ctx.stopExists) return { code: 0, lines: [`STOPPED ${ctx.segment.id}: ${P.stop}`] };
  return unmet.length === 0 ? { code: 0, lines: [`DONE ${ctx.segment.id}`] } : { code: 1, lines: unmet };
};

export const goalText = (segmentId) => `/goal The hsdd-auto segment ${segmentId} is finished: the last message shows the output of `
  + `\`node hsdd/scripts/auto/state.mjs done\` ending in the line "DONE ${segmentId}" or "STOPPED ${segmentId}: hsdd/judgement/STOP.md". `
  + "Stop if 20 turns pass without a new judgement commit being reported.";

const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();

export const upstreamLines = (ctx) => ctx.decisions
  .filter((d) => d.would_upstream === true)
  .sort((a, b) => idNum(a.id) - idNum(b.id))
  .map((d) => `${d.id} ${d.step_ref} ${oneLine(d.question)} -> ${d.chosen}`);

// ---------- segment ids (5.5) ----------

const isUrl = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);

const lastSegmentOf = (path) => path.split("/").filter((p) => p !== "").at(-1) ?? "";

// A request's file name without its extension, or a URL's last path segment.
const requestStem = (request) => {
  if (isUrl(request)) {
    let path;
    try { path = new URL(request).pathname; } catch { path = request.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").replace(/[?#].*$/, ""); }
    const last = lastSegmentOf(path);
    try { return decodeURIComponent(last); } catch { return last; }
  }
  return parse(lastSegmentOf(request.replace(/\\/g, "/"))).name;
};

export const requestSlug = (request) => requestStem(request ?? "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "") || "request";

export const segmentId = (mode, date, request, takenIds) => {
  const base = mode === "plan" ? `${date}-plan` : `${date}-intake-${requestSlug(request)}`;
  const taken = new Set(takenIds);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
};

// ---------- preflight (8.1 item 2, 3.5, 12.1) ----------

export const PLANNING_SKILLS = Object.freeze(["hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile", "hsdd-intake"]);

const declaresStandalone = (text) => /^\s*(?:[-*]\s+)?`?Profile:\s*standalone-spec-repo`?\s*$/m.test(text);

export const preflight = (repoRoot, config) => {
  const conventions = join(repoRoot, P.conventions);
  const profile = existsSync(conventions) && declaresStandalone(readFileSync(conventions, "utf8"))
    ? [`${P.conventions} declares the standalone-spec-repo profile, which hsdd-auto does not support in v0.11 (spec 3.5); run it from a repository that holds the tree directly`]
    : [];
  const root = skillsRoot(repoRoot, config.skills_dir);
  const skills = PLANNING_SKILLS.flatMap((name) => {
    const file = join(root, name, "SKILL.md");
    if (!existsSync(file)) return [`${name}/SKILL.md is missing under skills_dir ${config.skills_dir}; install HSDD 0.11`];
    return /^## Unattended runs\s*$/m.test(readFileSync(file, "utf8")) ? [] : [`${name}/SKILL.md has no '## Unattended runs' section; reinstall HSDD 0.11`];
  });
  const major = Number(process.versions.node.split(".")[0]);
  return [...profile, ...skills, ...(major < 20 ? [`Node.js 20 or later is required (found ${process.versions.node})`] : [])];
};

// ---------- snapshot (6.10) ----------

export const snapshotOwnerFiles = (repoRoot, config) => {
  const snapshot = Object.fromEntries(config.owner_files.map((entry) => [entry, ownerFileHash(repoRoot, entry)]));
  const errors = validate("owner-files", snapshot);
  if (errors.length > 0) throw new StateError(errors.map((e) => `${P.ownerFiles}: ${e}`));
  const file = join(repoRoot, P.ownerFiles);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
};

// 5.3 item 8: every path `git status` shows as modified or untracked, files only.
export const defaultOwnerFiles = (repoRoot) => changedPaths(repoRoot);

// ---------- install-scripts (4.3) ----------

const sameBytes = (a, b) => readFileSync(a).equals(readFileSync(b));

const versionOf = (dir, files) => (files.includes("VERSION") ? readFileSync(join(dir, "VERSION"), "utf8").trim() : null);

const pruneEmptyDirs = (root, rel) => {
  for (let d = dirname(rel); d !== "." && d !== ""; d = dirname(d)) {
    const full = join(root, d);
    if (!existsSync(full) || readdirSync(full).length > 0) return;
    rmdirSync(full);
  }
};

const copyInto = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};

const hasContractFiles = (repoRoot) => {
  const dir = join(repoRoot, resolveLayout(repoRoot).contract);
  return existsSync(dir) && readdirSync(dir).some((n) => n.endsWith(".md"));
};

export const installScripts = (repoRoot, config) => {
  const skills = skillsRoot(repoRoot, config.skills_dir);
  const src = join(skills, "hsdd-auto", "scripts");
  const srcFiles = filesUnder(src);
  if (srcFiles === null) throw new StateError([`${src} is not a directory; install the hsdd-auto skill under skills_dir ${config.skills_dir}`]);
  const dst = join(repoRoot, P.scriptsAuto);
  const dstFiles = filesUnder(dst) ?? [];
  const dstSet = new Set(dstFiles);
  const srcSet = new Set(srcFiles);
  const stale = srcFiles.filter((f) => !dstSet.has(f) || !sameBytes(join(src, f), join(dst, f)));
  const extra = dstFiles.filter((f) => !srcSet.has(f));
  const current = stale.length === 0 && extra.length === 0 && versionOf(src, srcFiles) === versionOf(dst, dstFiles);
  const scriptLines = current
    ? [`${P.scriptsAuto} is current`]
    : [
      ...stale.map((f) => { copyInto(join(src, f), join(dst, f)); return `copied ${P.scriptsAuto}/${f}`; }),
      ...extra.map((f) => { rmSync(join(dst, f)); pruneEmptyDirs(dst, f); return `removed ${P.scriptsAuto}/${f}`; }),
    ];
  if (!hasContractFiles(repoRoot)) return scriptLines;
  const generator = join(skills, "hsdd-contract", "scripts", "gen-registry.mjs");
  if (!existsSync(generator)) throw new StateError([`${generator} is missing; install the hsdd-contract skill under skills_dir ${config.skills_dir}`]);
  const copy = join(repoRoot, P.genRegistry);
  if (existsSync(copy) && sameBytes(generator, copy)) return [...scriptLines, `${P.genRegistry} is current`];
  copyInto(generator, copy);
  return [...scriptLines, `copied ${P.genRegistry}`];
};

// ---------- open-segment (5.5, 8.1, 10.1) ----------

// Why no segment may open now (8.1 items 3), as a function of the snapshot. `instruction` is the
// text the owner gave: with STOP.md present it is the answer, so an empty one is refused.
export const openRefusals = (ctx, { instruction }) => {
  const reasons = [];
  if (ctx.inProgress !== null) reasons.push(`${ctx.inProgress} is open (a dispatch file without its judgement commit); resume it (spec 8.9)`);
  if (ctx.segment !== null && !(isFinished(ctx) || isStopped(ctx) || isEnded(ctx))) {
    reasons.push(`segment ${ctx.segment.id} is unfinished (its report is not committed, and it is neither stopped nor ended); resume it (spec 8.9)`);
  }
  if (ctx.stopExists && instruction.trim() === "") reasons.push(`${P.stop} exists and the instruction is empty; the instruction must carry the owner's answer`);
  const owner = ownerMatcher(ctx.config.owner_files);
  const allowed = [P.runYaml, ...judgementSet("S*")];
  const dirty = ctx.uncommitted().filter((p) => !owner(p) && !matchesAny(p, allowed));
  if (dirty.length > 0) reasons.push(`the working tree has changes outside owner_files, ${P.runYaml} and the judgement set: ${dirty.join(", ")}`);
  return reasons;
};

const stripOneNewline = (s) => s.replace(/\r?\n$/, "");

const refuse = (reasons, closing) => { throw new StateError([...reasons.map((r) => `refused: ${r}`), closing]); };

const checkoutBranch = (repoRoot, config) => {
  if (currentBranch(repoRoot) === config.branch) return false;
  if (branchExists(repoRoot, config.branch)) git(repoRoot, ["checkout", "-q", config.branch]);
  else if (branchExists(repoRoot, config.base)) git(repoRoot, ["checkout", "-q", "-b", config.branch, config.base]);
  else throw new StateError([`neither branch ${config.branch} nor its base ${config.base} exists`]);
  return true;
};

// The entry to append (5.5): a segment that continues a stopped or ended one of the same mode copies
// its `request` and `authority` when the flags are absent. Throws a usage error when it cannot be formed.
const entryFor = (ctx, { mode, request, authority, stopPolicy }, instruction, openedAt) => {
  const prev = ctx.segment;
  const continues = prev !== null && (isEnded(ctx) || isStopped(ctx)) && (mode === undefined || mode === prev.mode);
  const useMode = mode ?? (continues ? prev.mode : undefined);
  if (useMode === undefined) throw new StateError(["--mode is required unless the segment continues a stopped or ended one"], { usage: true });
  const useRequest = request ?? (continues ? prev.request : undefined);
  const useAuthority = authority ?? (continues ? prev.authority : undefined);
  if (useMode === "intake" && (useRequest === undefined || useAuthority === undefined)) {
    throw new StateError(["an intake segment needs --request and --authority"], { usage: true });
  }
  return {
    id: segmentId(useMode, dateOf(openedAt), useRequest, ctx.segments.map((s) => s.id)),
    mode: useMode,
    opened_at: openedAt,
    instruction,
    stop_policy: stopPolicy ?? ctx.config.stop_policy,
    first_step: nextFreeStep(ctx.repoRoot),
    ...(useRequest === undefined ? {} : { request: useRequest }),
    ...(useAuthority === undefined ? {} : { authority: useAuthority }),
  };
};

export const openSegment = (repoRoot, opts) => {
  const openedAt = nowStamp();
  const config = loadConfig(repoRoot);
  const instruction = stripOneNewline(readInstruction(opts.instructionFile));
  const refusals = preflight(repoRoot, config);
  if (refusals.length > 0) refuse(refusals, "open-segment changed nothing");
  const before = loadContext(repoRoot);
  const early = openRefusals(before, { instruction });
  if (early.length > 0) refuse(early, "open-segment changed nothing");
  // Everything that can fail on the flags fails before git changes.
  entryFor(before, opts, instruction, openedAt);
  const moved = checkoutBranch(repoRoot, config);
  // The run branch may hold segments the base does not: build the entry from the branch that is written.
  const ctx = moved ? loadContext(repoRoot) : before;
  if (moved) {
    const late = openRefusals(ctx, { instruction });
    if (late.length > 0) refuse(late, `open-segment checked out ${config.branch}, found this there, and changed nothing else`);
  }
  const entry = entryFor(ctx, opts, instruction, openedAt);
  const file = join(repoRoot, P.runYaml);
  const text = appendSegmentEntry(readFileSync(file, "utf8"), entry);
  const parsed = parseYaml(text);
  const errors = validate("run-config", parsed.segments === null ? { ...parsed, segments: [] } : parsed);
  if (errors.length > 0) throw new StateError(errors.map((e) => `${P.runYaml}: ${e}`));
  writeFileSync(file, text);
  return entry;
};

const readInstruction = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    throw new StateError([`cannot read --instruction-file ${file}: ${e.message}`], { usage: true });
  }
};

// ---------- CLI ----------

const report = (e, out) => {
  (Array.isArray(e?.errors) ? e.errors : [e?.message ?? String(e)]).forEach((m) => out.error(m));
  out.error("state: failed");
  return e instanceof StateError && e.usage ? 2 : 1;
};

const usageError = (out, message) => {
  out.error(`usage error: ${message}`);
  out.error(USAGE);
  return 2;
};

const OPEN_OPTIONS = {
  mode: { type: "string" },
  "instruction-file": { type: "string" },
  request: { type: "string" },
  authority: { type: "string" },
  "stop-policy": { type: "string" },
};

const subcommands = {
  done: (repoRoot, out) => {
    const r = doneResult(loadContext(repoRoot));
    r.lines.forEach((l) => out.log(l));
    return r.code;
  },
  goal: (repoRoot, out) => {
    const { segment } = loadContext(repoRoot);
    if (segment === null) { out.error("no segment: hsdd/auto/run.yaml has no segments entry"); return 1; }
    out.log(goalText(segment.id));
    return 0;
  },
  upstream: (repoRoot, out) => {
    const lines = upstreamLines(loadContext(repoRoot));
    (lines.length === 0 ? ["no decision has would_upstream: true"] : lines).forEach((l) => out.log(l));
    return 0;
  },
  preflight: (repoRoot, out) => {
    const refusals = preflight(repoRoot, loadConfig(repoRoot));
    refusals.forEach((r) => out.log(`refused: ${r}`));
    out.log(refusals.length === 0 ? "preflight: ok" : `preflight: refused (${refusals.length})`);
    return refusals.length === 0 ? 0 : 1;
  },
  snapshot: (repoRoot, out) => {
    const snapshot = snapshotOwnerFiles(repoRoot, loadConfig(repoRoot));
    Object.entries(snapshot).forEach(([k, v]) => out.log(`${k} ${v ?? "absent"}`));
    out.log(`snapshot: ${P.ownerFiles} written, ${Object.keys(snapshot).length} owner files`);
    return 0;
  },
  "install-scripts": (repoRoot, out) => {
    const lines = installScripts(repoRoot, loadConfig(repoRoot));
    lines.forEach((l) => out.log(l));
    out.log(`install-scripts: ${lines.length} ${lines.length === 1 ? "line" : "lines"}`);
    return 0;
  },
};

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log, error: console.error }) => {
  const [head, ...rest] = argv;
  try {
    if (head === undefined || head === "--json") {
      if (argv.length > 1) return usageError(out, `unexpected argument ${argv[1]}`);
      const view = stateView(loadContext(repoRoot));
      out.log(head === "--json" ? JSON.stringify(view) : formatState(view));
      return 0;
    }
    if (head === "open-segment") {
      let parsed;
      try {
        parsed = parseArgs({ args: rest, options: OPEN_OPTIONS, strict: true, allowPositionals: false }).values;
      } catch (e) {
        return usageError(out, e.message);
      }
      if (parsed["instruction-file"] === undefined) return usageError(out, "open-segment needs --instruction-file");
      if (parsed.mode !== undefined && !["plan", "intake"].includes(parsed.mode)) return usageError(out, "--mode is plan or intake");
      const entry = openSegment(repoRoot, {
        mode: parsed.mode, instructionFile: parsed["instruction-file"], request: parsed.request, authority: parsed.authority, stopPolicy: parsed["stop-policy"],
      });
      out.log(JSON.stringify(entry));
      out.log(`open-segment: opened ${entry.id} on branch ${currentBranch(repoRoot)}, first step ${entry.first_step}`);
      return 0;
    }
    const run = subcommands[head];
    if (run === undefined) return usageError(out, `unknown argument ${head}`);
    if (rest.length > 0) return usageError(out, `unexpected argument ${rest[0]}`);
    return run(repoRoot, out);
  } catch (e) {
    return report(e, out);
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
