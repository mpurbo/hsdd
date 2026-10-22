// The routing queue (spec 6.5, 10.8, appendix A.5): the matching rule as pure functions over
// the queue's lines, and the file appends at the edge. Usage: see main().
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { validate } from "./lib/schema.mjs";
import { nowStamp } from "./lib/time.mjs";
import { P, resolveLayout } from "./lib/paths.mjs";
import { targetType } from "./lib/kinds.mjs";
import { loadConfig } from "./lib/config.mjs";
import { loadTree } from "./lib/tree.mjs";
import { appendJsonl, idNum, readDispatch, readJsonl, readReports, stepNum } from "./lib/records.mjs";

export class QueueError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "QueueError";
    this.errors = errors;
  }
}

// ---------- the queue as items (pure) ----------

// An Item is its open line's fields, `status` from its last line, and `events`: every line of
// the id in file order, the open line first. A line whose id has no open line is ignored.
export const queueItems = (lines) => {
  const groups = new Map();
  for (const line of lines) groups.set(line.id, [...(groups.get(line.id) ?? []), line]);
  return new Map([...groups]
    .filter(([, events]) => events[0].status === "open")
    .map(([id, events]) => [id, { ...events[0], status: events.at(-1).status, events }]));
};

// The status after the last event at or before `at` (inclusive); null before the item was opened.
const statusAt = (item, at) => item.events.filter((e) => e.at <= at).at(-1)?.status ?? null;

// The leaf-parents `all` stands for (decision S-2): kind leaf-parent and not retired.
export const leafParentsOf = (tree) =>
  [...tree.nodes.values()].filter((n) => n.kind === "leaf-parent" && n.status !== "retired").map((n) => n.id);

// 6.5: an item matches a step when its target equals the step's target, is an element of the
// step's target list (`all` matching every leaf-parent), or is the handoff id the step executes.
// An insert-step item targets `run` and never matches.
export const matches = (item, step, leafParents) => {
  if (item.kind === "insert-step") return false;
  if (item.target === step.target) return true;
  if (step.handoff != null && item.target === step.handoff) return true;
  if (step.target === "all") return leafParents.includes(item.target);
  return step.target.includes(",") && step.target.split(",").map((s) => s.trim()).includes(item.target);
};

// Items matching the step whose state is open: now, or at time `at` (inclusive). Oldest id first.
export const openMatching = (lines, step, leafParents, at) =>
  [...queueItems(lines).values()]
    .filter((it) => matches(it, step, leafParents))
    .filter((it) => (at === undefined ? it.status : statusAt(it, at)) === "open")
    .sort((a, b) => idNum(a.id) - idNum(b.id));

export const nextQueueId = (lines) => {
  const max = lines.reduce((m, l) => Math.max(m, Number(/^Q-(\d+)$/.exec(l.id)?.[1] ?? 0)), 0);
  return `Q-${String(max + 1).padStart(3, "0")}`;
};

// ---------- line rules (pure) ----------

const OPEN_ONLY = ["from", "target", "kind", "text", "step_kind", "step_target", "after"];
const CLOSE_FIELDS = ["by", "note", "decision"];

// A.5's schema and its code rules, for `line` appended after `lines`.
export const lineErrors = (lines, line) => {
  const schema = validate("queue-line", line);
  if (schema.length > 0) return schema;
  const errors = [];
  const has = (f) => line[f] !== undefined;
  const need = (...fs) => fs.filter((f) => !has(f)).forEach((f) => errors.push(`${line.id} ${line.status}: ${f} is required`));
  const forbid = (...fs) => fs.filter(has).forEach((f) => errors.push(`${line.id} ${line.status}: ${f} is not allowed`));
  const item = queueItems(lines).get(line.id);

  if (line.status === "open") {
    if (item) errors.push(`${line.id} already exists`);
    need("from", "target", "kind", "text");
    forbid(...CLOSE_FIELDS);
    if (line.kind === "insert-step") {
      need("step_kind", "step_target");
      if (line.target !== "run") errors.push(`${line.id}: an insert-step item targets run, not ${line.target}`);
      if (has("after") && !/^(handoffs|H\d+[a-z]?)$/.test(line.after)) errors.push(`${line.id}: after is a handoff id or 'handoffs', not ${line.after}`);
    } else {
      forbid("step_kind", "step_target", "after");
    }
    return errors;
  }

  forbid(...OPEN_ONLY);
  if (!item) return [...errors, `${line.id} has no open line`];
  const insert = item.kind === "insert-step";
  switch (line.status) {
    case "addressed": case "explained":
      need("by", "note");
      forbid("decision");
      if (insert && line.status === "explained") errors.push(`${line.id}: an insert-step item is accepted or rejected, never explained`);
      else if (insert && item.status !== "accepted") errors.push(`${line.id}: an insert-step item is addressed only after it is accepted (it is ${item.status})`);
      else if (!insert && item.status !== "open") errors.push(`${line.id}: is already ${item.status}`);
      break;
    case "accepted": case "rejected":
      need("decision");
      forbid("by", "note");
      if (!insert) errors.push(`${line.id}: only an insert-step item is accepted or rejected (it is ${item.kind})`);
      else if (item.status !== "open") errors.push(`${line.id}: is already ${item.status}`);
      break;
    default:
  }
  return errors;
};

// ---------- ingest planning (pure) ----------

const entryKey = (e) => JSON.stringify([e.from, e.kind, e.target, e.text]);

// S-8: texts of items closed `explained` by an earlier step of the segment.
const explainedInSegment = (lines, { step, segment, segmentOf }) =>
  new Set([...queueItems(lines).values()].flatMap((it) =>
    it.events.some((e) => e.status === "explained" && e.by !== undefined && segmentOf(e.by) === segment && stepNum(e.by) < stepNum(step))
      ? [it.text] : []));

// What `ingest` writes for a step: close lines for its `closes` (once per id and status) and open
// lines for its `routed` entries (once per from, kind, target and text), ids minted in order.
// An `align` step's entry whose text equals one explained earlier in the segment is skipped.
export const planIngest = (lines, { step, kind, segment, segmentOf, routed, closes }, at) => {
  const explained = kind === "align" ? explainedInSegment(lines, { step, segment, segmentOf }) : new Set();
  const closeLines = closes
    .filter((c, i) => closes.findIndex((d) => d.id === c.id && d.outcome === c.outcome) === i)
    .filter((c) => !(queueItems(lines).get(c.id)?.events ?? []).some((e) => e.status === c.outcome))
    .map((c) => ({ id: c.id, at, status: c.outcome, by: step, note: c.note }));
  const known = new Set(lines.filter((l) => l.status === "open").map(entryKey));
  const entries = routed.map((r) => ({
    from: step, target: r.kind === "insert-step" ? "run" : r.target, kind: r.kind, text: r.text,
    ...(r.step_kind !== undefined ? { step_kind: r.step_kind } : {}),
    ...(r.step_target !== undefined ? { step_target: r.step_target } : {}),
  }));
  const fresh = entries.filter((e, i) => entries.findIndex((d) => entryKey(d) === entryKey(e)) === i).filter((e) => !known.has(entryKey(e)));
  const skipped = fresh.filter((e) => explained.has(e.text));
  const toOpen = fresh.filter((e) => !explained.has(e.text));
  const opened = toOpen.reduce((acc, e) => {
    const id = nextQueueId([...lines, ...acc]);
    return [...acc, { id, at, status: "open", ...e }];
  }, []);
  return { lines: [...closeLines, ...opened], skipped };
};

// ---------- the edge ----------

// Validates every new line against the queue as it will stand, then appends them all; on any
// error nothing is written.
const appendLines = (repoRoot, newLines) => {
  const lines = readJsonl(repoRoot, P.queue);
  const errors = [];
  newLines.reduce((acc, line) => {
    errors.push(...lineErrors(acc, line));
    return [...acc, line];
  }, lines);
  if (errors.length > 0) throw new QueueError(errors);
  for (const line of newLines) appendJsonl(repoRoot, P.queue, line);
};

const entriesOf = (reports, field) =>
  reports.flatMap(({ report }) => (report !== null && Array.isArray(report[field]) ? report[field] : []));

// Opens one item per `routed` entry of the step's current report series and records each `closes`
// entry. The queue is read afresh, so a rerun after a crash writes nothing twice.
// It reads only what it needs (the step's dispatch file, other steps' dispatch files for the
// segment check, the run lines, the report series, the queue), so a defect in the tree, the
// config or an intake record never blocks crash recovery. `ctx` is optional and only a test shortcut.
const readFront = (repoRoot, step) => {
  try {
    return readDispatch(repoRoot, step)?.front ?? null;
  } catch {
    return null;
  }
};

export const ingest = (repoRoot, step, ctx) => {
  const front = ctx ? (ctx.dispatches.get(step)?.front ?? null) : readFront(repoRoot, step);
  if (front === null) throw new QueueError([`${step} has no readable dispatch file`]);
  const dispatch = { front };
  const runLines = ctx ? ctx.runLines : readJsonl(repoRoot, P.runLog);
  const segmentOf = (s) => (ctx ? ctx.dispatches.get(s)?.front : readFront(repoRoot, s))?.segment
    ?? runLines.find((l) => l.step_ref === s)?.segment ?? null;
  const reports = readReports(repoRoot, step);
  const lines = readJsonl(repoRoot, P.queue);
  const plan = planIngest(lines, {
    step, kind: dispatch.front.kind, segment: dispatch.front.segment, segmentOf,
    routed: entriesOf(reports, "routed"), closes: entriesOf(reports, "closes"),
  }, nowStamp());
  appendLines(repoRoot, plan.lines);
  return {
    opened: plan.lines.filter((l) => l.status === "open").map((l) => l.id),
    closed: plan.lines.filter((l) => l.status !== "open").map((l) => ({ id: l.id, status: l.status })),
    skipped: plan.skipped,
  };
};

export const openItem = (repoRoot, fields) => {
  const id = nextQueueId(readJsonl(repoRoot, P.queue));
  appendLines(repoRoot, [{ id, at: nowStamp(), status: "open", ...fields }]);
  return id;
};

const itemOf = (repoRoot, id) => {
  const item = queueItems(readJsonl(repoRoot, P.queue)).get(id);
  if (!item) throw new QueueError([`${id} is not in the queue`]);
  return item;
};

const defaultTree = (repoRoot) => loadTree(repoRoot, resolveLayout(repoRoot), { root: loadConfig(repoRoot).root });

// The orchestrator's close: only a must-address or consider item that targets run or the request path.
export const closeItem = (repoRoot, id, { outcome, by, note }, { tree } = {}) => {
  const item = itemOf(repoRoot, id);
  if (item.kind === "insert-step") throw new QueueError([`${id} is an insert-step item; decide it with 'decide'`]);
  const type = item.target === "run" ? "run" : targetType(item.target, tree ?? defaultTree(repoRoot));
  if (type !== "run" && type !== "request") {
    throw new QueueError([`${id} targets ${item.target}; close only closes an item that targets run or the request path (the target's step closes the others)`]);
  }
  appendLines(repoRoot, [{ id, at: nowStamp(), status: outcome, by, note }]);
};

export const decideItem = (repoRoot, id, { outcome, decision }) => {
  appendLines(repoRoot, [{ id, at: nowStamp(), status: outcome, decision }]);
};

// commit.mjs, when the inserted step commits as completed. A rerun finds the item addressed and writes nothing.
export const markAddressed = (repoRoot, id, by, note) => {
  if (itemOf(repoRoot, id).status === "addressed") return false;
  appendLines(repoRoot, [{ id, at: nowStamp(), status: "addressed", by, note }]);
  return true;
};

// ---------- CLI ----------

const USAGE = [
  "routed.mjs ingest --step S07",
  "routed.mjs open --from S07 --target <id> --kind must-address|consider|insert-step --text \"...\"",
  "               [--step-kind <kind> --step-target <id>] [--after <handoff id>|handoffs]",
  "routed.mjs close Q-012 --addressed|--explained --by S07 --note \"...\"",
  "routed.mjs decide Q-012 --accepted|--rejected --decision DEC-0nn",
  "routed.mjs list [--target <id>] [--open]",
].join("\n");

class UsageError extends Error {}

const OPTIONS = {
  step: { type: "string" }, from: { type: "string" }, target: { type: "string" }, kind: { type: "string" },
  text: { type: "string" }, "step-kind": { type: "string" }, "step-target": { type: "string" }, after: { type: "string" },
  addressed: { type: "boolean" }, explained: { type: "boolean" }, by: { type: "string" }, note: { type: "string" },
  accepted: { type: "boolean" }, rejected: { type: "boolean" }, decision: { type: "string" }, open: { type: "boolean" },
};

const require_ = (values, ...names) => {
  const missing = names.filter((n) => values[n] === undefined);
  if (missing.length > 0) throw new UsageError(`missing ${missing.map((n) => `--${n}`).join(", ")}`);
};

const exactlyOne = (values, ...names) => {
  const given = names.filter((n) => values[n]);
  if (given.length !== 1) throw new UsageError(`give exactly one of ${names.map((n) => `--${n}`).join(", ")}`);
  return given[0];
};

const describe = (item) =>
  `${item.id} ${item.status} ${item.kind} ${item.from} -> ${item.target}${item.kind === "insert-step" ? ` (${item.step_kind} ${item.step_target})` : ""}: ${item.text}`;

const commands = {
  ingest: ({ values }, repoRoot) => {
    require_(values, "step");
    const r = ingest(repoRoot, values.step);
    return {
      lines: r.skipped.map((e) => `skipped an align repeat: ${e.text}`),
      summary: `ingest ${values.step}: opened ${r.opened.length} (${r.opened.join(", ") || "none"}), recorded ${r.closed.length} close(s), skipped ${r.skipped.length}`,
    };
  },
  open: ({ values }, repoRoot) => {
    require_(values, "from", "target", "kind", "text");
    if (!["must-address", "consider", "insert-step"].includes(values.kind)) throw new UsageError(`--kind is must-address, consider or insert-step, not ${values.kind}`);
    const id = openItem(repoRoot, {
      from: values.from, target: values.target, kind: values.kind, text: values.text,
      ...(values["step-kind"] !== undefined ? { step_kind: values["step-kind"] } : {}),
      ...(values["step-target"] !== undefined ? { step_target: values["step-target"] } : {}),
      ...(values.after !== undefined ? { after: values.after } : {}),
    });
    return { lines: [], summary: `opened ${id}` };
  },
  close: ({ values, positionals }, repoRoot) => {
    const [id] = positionals.slice(1);
    if (!id) throw new UsageError("close needs an item id");
    const outcome = exactlyOne(values, "addressed", "explained");
    require_(values, "by", "note");
    closeItem(repoRoot, id, { outcome, by: values.by, note: values.note });
    return { lines: [], summary: `${id} ${outcome}` };
  },
  decide: ({ values, positionals }, repoRoot) => {
    const [id] = positionals.slice(1);
    if (!id) throw new UsageError("decide needs an item id");
    const outcome = exactlyOne(values, "accepted", "rejected");
    require_(values, "decision");
    decideItem(repoRoot, id, { outcome, decision: values.decision });
    return { lines: [], summary: `${id} ${outcome}` };
  },
  list: ({ values }, repoRoot) => {
    const items = [...queueItems(readJsonl(repoRoot, P.queue)).values()]
      .filter((it) => values.target === undefined || it.target === values.target)
      .filter((it) => !values.open || it.status === "open");
    return { lines: items.map(describe), summary: `${items.length} item(s), ${items.filter((i) => i.status === "open").length} open` };
  },
};

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  try {
    const parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    const command = commands[parsed.positionals[0]];
    if (!command) throw new UsageError(`unknown command ${parsed.positionals[0] ?? "(none)"}`);
    const { lines, summary } = command(parsed, repoRoot);
    lines.forEach((l) => out.log(l));
    out.log(summary);
    return 0;
  } catch (e) {
    if (e instanceof UsageError || e?.code?.startsWith?.("ERR_PARSE_ARGS")) {
      out.log(`usage error: ${e.message}`);
      out.log(USAGE);
      out.log("routed: usage error");
      return 2;
    }
    (e instanceof QueueError ? e.errors : [e.message]).forEach((m) => out.log(m));
    out.log("routed: failed, nothing written");
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
