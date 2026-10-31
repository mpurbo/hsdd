// The segment report's generated parts and the intake record's `## Produced` append (spec 10.9,
// decisions S-7 and S-8). Pure builders over a context snapshot; the CLI is the only writer, and both
// of its writes are idempotent. Usage: report.mjs --segment <id>
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContext } from "./lib/context.mjs";
import { renderTemplate } from "./lib/render.mjs";
import { P } from "./lib/paths.mjs";
import { dateOf, nowStamp, stampMs } from "./lib/time.mjs";
import { showFile } from "./lib/git.mjs";
import { headings, parseContract, plain, sectionEnd, toLines } from "./lib/tree.mjs";
import { segmentRecord } from "./lib/intake.mjs";
import { versionNumber, versionsOf } from "./lib/contracts.mjs";
import { idNum, readReports, sidecarEntries } from "./lib/records.mjs";
import { validate } from "./lib/schema.mjs";
import { finalGate } from "./gate.mjs";
import { handoffStates } from "./next.mjs";
import { planIngest, queueItems } from "./routed.mjs";

const WINDOW_MS = 60_000;
const unique = (xs) => [...new Set(xs)];
const isStepId = (s) => /^S\d{2,}$/.test(String(s));

// ---------- text helpers ----------

// A table cell: one line, `|` escaped, `-` when empty (the template's empty cell).
const cell = (v) => String(v ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|") || "-";
const cut = (s, n) => {
  const one = String(s ?? "").replace(/\s+/g, " ").trim();
  return one.length <= n ? one : `${one.slice(0, n - 3).trimEnd()}...`;
};
const row = (cells) => `| ${cells.map(cell).join(" | ")} |`;
const table = (head, rows) => (rows.length === 0 ? "None." : [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n"));
const bullets = (lines) => (lines.length === 0 ? "None." : lines.map((l) => `- ${String(l).replace(/\s+/g, " ").trim()}`).join("\n"));
const refs = (rs) => (rs.length === 0 ? "-" : rs.map((r) => `${r.slug}@${r.version}`).join(", "));

// A fill is rendered once against the fills (lib/render.mjs), so braces in data are doubled.
const asFill = (text) => String(text).replace(/\{\{([a-z_]+)\}\}|\{([a-z_]+)\}/g, (_, doubled, name) => (doubled !== undefined ? `{{{${doubled}}}}` : `{{${name}}}`));

// ---------- segments and steps ----------

const segmentOf = (ctx, id) => {
  const i = ctx.segments.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`${P.runYaml} has no segment ${id}`);
  return { segment: ctx.segments[i], index: i };
};

// The named segment, and the earlier segments without a committed report that it continues, earliest
// first (10.9): ctx.segmentChain, the chain the final gate's scope starts from. A segment an earlier
// report already covered is not covered again.
export const coveredSegments = (ctx, segmentId) => {
  segmentOf(ctx, segmentId);
  return ctx.segmentChain(segmentId);
};

// Step ids of the covered segments in numeric order, each with its segment.
const stepsOf = (ctx, covered) => {
  const segmentOfStep = new Map([
    ...[...ctx.dispatches].flatMap(([s, d]) => (d.front?.segment ? [[s, d.front.segment]] : [])),
    ...ctx.runLines.flatMap((l) => (isStepId(l.step_ref) ? [[l.step_ref, l.segment]] : [])),
  ]);
  return [...segmentOfStep].filter(([s, seg]) => isStepId(s) && covered.includes(seg))
    .map(([step, segment]) => ({ step, segment }))
    .sort((a, b) => idNum(a.step) - idNum(b.step));
};

const runLineOf = (ctx, step) => ctx.runLines.find((l) => l.step_ref === step) ?? null;
const frontOf = (ctx, step) => ctx.dispatches.get(step)?.front ?? null;

// ---------- 2: what changed ----------

// The context as the named intake segment sees it: its own handoff states, across the segments of its intake.
const viewOf = (ctx, seg, index) => ({
  ...ctx,
  segment: seg,
  segments: ctx.segments.slice(0, index + 1),
  intake: { records: ctx.intake.records, record: seg.mode === "intake" ? segmentRecord(ctx.intake.records, seg.request) : null },
});

const handoffRows = (ctx, covered) => {
  const intakes = covered.map((id) => segmentOf(ctx, id)).filter((x) => x.segment.mode === "intake");
  const requests = unique(intakes.map((x) => x.segment.request));
  const groups = requests.map((request) => intakes.filter((x) => x.segment.request === request));
  const many = groups.length > 1;
  const rows = groups.flatMap((group) => {
    const last = group.at(-1);
    const view = viewOf(ctx, last.segment, last.index);
    const ids = new Set(group.map((x) => x.segment.id));
    const skips = ctx.handoffLines.filter((l) => l.status === "skipped" && (ids.has(l.segment) || view.segments.some((s) => s.id === l.segment && s.request === last.segment.request)));
    return handoffStates(view).map((h) => {
      const commit = h.step === null ? null : runLineOf(ctx, h.step)?.commit;
      const reason = skips.filter((l) => l.handoff === h.id).at(-1)?.reason;
      const stepCell = h.state === "executed" ? h.step : h.state === "skipped" ? `skipped (${reason ?? "no reason recorded"})` : h.step === null ? "pending" : `pending (stopped at ${h.step})`;
      return [...(many ? [last.segment.request] : []), h.id, stepCell, h.kind, h.target, commit === null || commit === undefined ? null : commit.slice(0, 7)];
    });
  });
  return table([...(many ? ["Request"] : []), "Handoff", "Step", "Kind", "Target", "Commit"], rows);
};

const treeRows = (ctx) => table(
  ["Node", "Kind", "Phases", "Produces", "Consumes"],
  [...ctx.tree.nodes.values()].map((n) => [n.id, n.kind, n.phases.length, refs(n.produces), refs(n.consumes)]),
);

// ---------- 3 to 5: decisions ----------

// The open report step's own sidecar decisions (final review B2): its last `plan` decisions (8.10) reach
// the ledger only with its commit, after the report is written. Each valid line not yet in the ledger,
// with `segment` and `step_ref` from the step's dispatch file.
const openReportDecisions = (ctx, covered) => {
  const front = ctx.inProgress === null ? null : ctx.dispatches.get(ctx.inProgress)?.front ?? null;
  if (front === null || front.kind !== "report" || !covered.includes(front.segment)) return [];
  const have = new Set(ctx.decisions.map((d) => d.id));
  return sidecarEntries(ctx.repoRoot, ctx.inProgress).entries
    .filter((e) => e.value !== null && validate("decision", e.value, "sidecarDecision").length === 0 && !have.has(e.value.id))
    .map((e) => ({ ...e.value, segment: front.segment, step_ref: ctx.inProgress }));
};

const decisionsOf = (ctx, covered) => [...ctx.decisions.filter((d) => covered.includes(d.segment)), ...openReportDecisions(ctx, covered)]
  .sort((a, b) => idNum(a.id) - idNum(b.id));

// 10.9 item 3: every would_have_asked decision, then low confidence, tree or upstream, then setup; each once.
export const decisionsFirst = (decisions) => {
  const groups = [
    (d) => d.would_have_asked === true,
    (d) => d.confidence === "low" || d.blast_radius === "tree" || d.blast_radius === "upstream",
    (d) => d.step === "setup",
  ];
  return groups.reduce((acc, g) => [...acc, ...decisions.filter((d) => g(d) && !acc.includes(d))], []);
};

const decisionsFirstTable = (decisions) => table(
  ["Decision", "Step", "Question", "Chosen"],
  decisionsFirst(decisions).map((d) => [d.id, `${d.step_ref} ${d.step}`, cut(d.question, 100), d.chosen]),
);

const upstreamTable = (decisions) => table(
  ["Decision", "Question", "Chosen", "Evidence"],
  decisions.filter((d) => d.would_upstream === true).map((d) => [d.id, cut(d.question, 100), d.chosen, (d.evidence ?? []).join("; ")]),
);

const BLAST = ["upstream", "tree", "contract", "node-local"];
const byBlastRadius = (decisions) => {
  const groups = BLAST.map((b) => [b, decisions.filter((d) => d.blast_radius === b)]).filter(([, ds]) => ds.length > 0);
  return groups.length === 0 ? "None." : groups.map(([b, ds]) => [
    `### ${b}`, "",
    ...ds.map((d) => `- ${d.id} (${d.step_ref} ${d.step}, ${d.confidence}): ${cut(d.question, 100)} Chosen: ${d.chosen}`),
  ].join("\n")).join("\n\n");
};

// ---------- 6: experiments ----------

const readmeFirstLine = (repoRoot, dir) => {
  const file = join(repoRoot, dir, "README.md");
  if (!existsSync(file)) return null;
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.trim() !== "");
  return line === undefined ? null : line.replace(/^#+\s*/, "").trim();
};

// The directory an experiment path or evidence string names: the first component under experiments_dir.
const experimentDir = (experimentsDir, path) => {
  const base = experimentsDir.replace(/\/+$/, "");
  if (!path.startsWith(`${base}/`)) return null;
  return `${base}/${path.slice(base.length + 1).split("/")[0]}`;
};

const experimentsTable = (ctx, steps, reports, decisions) => {
  const dir = ctx.config.experiments_dir;
  const fromReports = reports.flatMap(({ report }) => report.experiments.map((e) => ({ dir: experimentDir(dir, e.path) ?? e.path.replace(/\/+$/, ""), question: e.question })));
  const fromEvidence = decisions.flatMap((d) => (d.evidence ?? []).flatMap((e) => experimentDir(dir, e) ?? []).map((p) => ({ dir: p, question: null })));
  const all = [...fromReports, ...fromEvidence].filter((e, i, a) => a.findIndex((x) => x.dir === e.dir) === i);
  return table(["Directory", "Question", "Finding (README first line)"], all.map((e) => [e.dir, e.question, readmeFirstLine(ctx.repoRoot, e.dir)]));
};

// ---------- 8: record gaps ----------

const outsideWindow = (ctx, decisions) => decisions.filter((d) => d.by !== "owner").flatMap((d) => {
  const run = runLineOf(ctx, d.step_ref);
  const started = run?.started ?? frontOf(ctx, d.step_ref)?.rendered_at ?? null;
  if (started === null) return [`${d.id} names ${d.step_ref}, which has no dispatch file or run line`];
  const at = stampMs(d.at);
  const late = run ? at > stampMs(run.finished) + WINDOW_MS : false;
  return at < stampMs(started) - WINDOW_MS || late
    ? [`${d.id} (${d.step_ref}) is stamped ${d.at}, outside its step's window (${started} to ${run?.finished ?? "now"})`]
    : [];
});

const stopWhy = (ctx, step, decisions, reports) => {
  const d = decisions.find((x) => x.step_ref === step && x.would_have_asked === true);
  if (d) return `${d.stop_class ?? "no class"}, ${d.id}: ${cut(d.question, 100)}`;
  const stop = reports.filter((r) => r.step === step).map((r) => r.report.stop).filter(Boolean).at(-1);
  if (stop) return `${stop.stop_class}: ${cut(stop.question, 100)}`;
  return runLineOf(ctx, step)?.note ?? "no reason recorded";
};

const recordGaps = (ctx, covered, steps, decisions, reports, queue, warningLine) => {
  const launches = steps.flatMap(({ step }) => (frontOf(ctx, step)?.launches ?? []).map((l) => ({ step, ...l })));
  const lines = [
    ...outsideWindow(ctx, decisions),
    ...launches.filter((l) => l.reason.startsWith("resume-")).map((l) => `${l.step} was resumed at ${l.at} for ${l.reason === "resume-answer" ? "an answer" : "a finding"}`),
    ...launches.filter((l) => l.reason === "redispatch").map((l) => `${l.step} was re-dispatched at ${l.at}: the earlier subagent was lost`),
    ...ctx.runLines.filter((l) => l.status === "stopped" && covered.includes(l.segment)).map((l) => `${l.step_ref} stopped: ${stopWhy(ctx, l.step_ref, decisions, reports)}`),
    ...ctx.runLines.filter((l) => l.continues && covered.includes(l.segment)).map((l) => `${l.step_ref} continues ${l.continues}`),
    ...reports.flatMap((r) => r.report.reads_outside.map((x) => `${r.step} read ${x.path} outside its read set: ${x.why}`)),
    ...steps.flatMap(({ step }) => {
      const id = frontOf(ctx, step)?.queue_item;
      const it = id ? queue.get(id) : null;
      return id ? [`${step} is an inserted step for ${id}${it ? ` (${it.step_kind} on ${it.step_target}): ${cut(it.text, 100)}` : ""}`] : [];
    }),
    ...ctx.handoffLines.filter((l) => l.status === "skipped" && covered.includes(l.segment)).map((l) => `${l.handoff} was skipped: ${l.reason}`),
    warningLine,
  ];
  return bullets(lines);
};

const gateWarningLine = (ctx, seg, index) => {
  try {
    const n = finalGate(viewOf(ctx, seg, index)).filter((f) => f.level !== "error").length;
    return `As of this report run, the final gate reports ${n} warning${n === 1 ? "" : "s"}.`;
  } catch (e) {
    return `The final gate could not run: ${cut(e.message, 120)}`;
  }
};

// ---------- 9: deferred findings ----------

const deferredTable = (ctx, covered, steps, queueLines, queue) => {
  const mine = new Set(steps.map((s) => s.step));
  const ours = (it) => mine.has(it.from);
  const items = [...queue.values()];
  const considers = items.filter((it) => it.kind === "consider" && it.status === "open" && ours(it))
    .map((it) => ["consider, open", it.id, it.from, it.target, it.text]);
  const rejected = items.filter((it) => it.kind === "insert-step" && it.status === "rejected" && ours(it))
    .map((it) => ["insert-step, rejected", it.id, it.from, `${it.step_kind} on ${it.step_target}`, `${it.text} (rejected by ${it.events.at(-1).decision})`]);
  const segOf = (s) => frontOf(ctx, s)?.segment ?? runLineOf(ctx, s)?.segment ?? null;
  const repeats = steps.filter(({ step }) => frontOf(ctx, step)?.kind === "align").flatMap(({ step, segment }) => {
    const routed = readReports(ctx.repoRoot, step).flatMap(({ report }) => report?.routed ?? []);
    return planIngest(queueLines, { step, kind: "align", segment, segmentOf: segOf, routed, closes: [] }, nowStamp()).skipped
      .map((e) => ["align repeat, not reopened", null, step, e.target, e.text]);
  });
  return table(["Kind", "Item", "From", "Target", "Detail"], [...considers, ...rejected, ...repeats]);
};

// ---------- the prose slots ----------

const SLOT = /(<!--\s*slot:([A-Za-z0-9_-]+)\s*-->)([\s\S]*?)(<!--\s*\/slot\s*-->)/g;
const slotTexts = (text) => new Map([...text.matchAll(SLOT)].map((m) => [m[2], m[3]]));

// The rendered report with each prose slot's text taken from `existing` when it has that slot;
const keepSlots = (rendered, existing) => {
  const old = existing === null ? new Map() : slotTexts(existing);
  return rendered.replace(SLOT, (_, open, name, inner, close) => {
    const kept = old.get(name);
    const text = kept !== undefined ? kept : inner;
    return `${open}${text}${close}`;
  });
};

// ---------- the report ----------

// Generated, never in the Outcome slot: the orchestrator writes that slot (F6 needs it filled).
const coverageNote = (covered) => (covered.length < 2 ? ""
  : `This report also covers segment${covered.length > 2 ? "s" : ""} ${covered.slice(0, -1).join(", ")}, which ended without a report. Its generated sections draw from every covered segment.\n\n`);

const templateOf = (mode) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "templates", "report", `${mode}.md`), "utf8");

export const reportPathOf = (ctx, segmentId) => `${ctx.config.report_dir.replace(/\/+$/, "")}/${segmentId}.md`;

// The report text for the segment: generated parts rebuilt, prose slots kept from `existing` (the
// file's current text, or null). A report that covers earlier segments says so in a generated note
// that renders outside the Outcome slot, which stays the orchestrator's to fill (F6).
export const buildReport = (ctx, segmentId, existing = null) => {
  const { segment, index } = segmentOf(ctx, segmentId);
  const covered = coveredSegments(ctx, segmentId);
  const steps = stepsOf(ctx, covered);
  const decisions = decisionsOf(ctx, covered);
  const reports = steps.flatMap(({ step }) => readReports(ctx.repoRoot, step).flatMap(({ report }) => (report === null ? [] : [{ step, report: { experiments: [], reads_outside: [], routed: [], ...report } }])));
  const queueLines = ctx.queueLines;
  const queue = queueItems(queueLines);
  const { artifact, judgement } = ctx.config.commit;
  const data = {
    report_title: `Segment report: ${segmentId}`,
    what_changed_table: segment.mode === "intake" ? handoffRows(ctx, covered) : treeRows(ctx),
    decisions_first: decisionsFirstTable(decisions),
    upstream: upstreamTable(decisions),
    by_blast_radius: byBlastRadius(decisions),
    experiments: experimentsTable(ctx, steps, reports, decisions),
    record_gaps_generated: recordGaps(ctx, covered, steps, decisions, reports, queue, gateWarningLine(ctx, segment, index)),
    deferred: deferredTable(ctx, covered, steps, queueLines, queue),
  };
  const fills = {
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, asFill(v)])),
    // `{{step}}` renders as the literal `{step}`; the prefixes are the configured ones.
    coverage_note: asFill(coverageNote(covered)),
    commit_prefixes: `\`${asFill(artifact)}: {{step}} ...\` then \`${asFill(judgement)}: {{step}}\``,
  };
  return keepSlots(renderTemplate(templateOf(segment.mode), fills), existing);
};

// ---------- the intake record's ## Produced (S-7) ----------

// The highest version any file of the contract id held at `rev`, of the files the id has now (NaN when
// none of them was there, or none had a version).
const versionAt = (ctx, rev, slug, entry) => {
  const then = versionsOf(entry).flatMap((c) => {
    const was = showFile(ctx.repoRoot, rev, c.file);
    const old = was === null ? null : parseContract(was, c.file);
    return old !== null && old.slug === slug && !Number.isNaN(versionNumber(old.version)) ? [versionNumber(old.version)] : [];
  });
  return then.length > 0 ? Math.max(...then) : NaN;
};

// What the intake segment produced, mechanically: contract ids whose current version is above the
// highest version any file of the id held at the setup commit, a later version in a file of its own
// (v0.10.0 §3.1) or a bump in place (an id with no file then is new, not bumped); ADR files changed in
// the segment; and the nodes of completed graft steps whose spec file exists.
export const producedAdditions = (ctx, segmentId) => {
  const none = { contracts: [], adrs: [], nodes: [] };
  const { segment } = segmentOf(ctx, segmentId);
  if (segment.mode !== "intake") return none;
  const same = coveredSegments(ctx, segmentId).filter((id) => segmentOf(ctx, id).segment.request === segment.request
    && segmentOf(ctx, id).segment.mode === "intake");
  const first = same.find((id) => ctx.setupCommit(id) !== null);
  if (first === undefined) return none;
  const base = ctx.setupCommit(first);
  const contracts = [...ctx.tree.contracts].flatMap(([slug, c]) => (versionNumber(c.version) > versionAt(ctx, base, slug, c) ? [`${slug}@${c.version}`] : [])).sort();
  const changed = ctx.changedSinceSetup(first);
  const adrs = [...ctx.tree.adrs.values()].filter((a) => changed.has(a.file)).map((a) => a.id ?? a.file).sort();
  const nodes = unique(ctx.committedRunLines
    .filter((l) => l.kind === "graft" && l.status === "completed" && same.includes(l.segment) && ctx.tree.nodes.has(l.target))
    .map((l) => l.target)).sort();
  return { contracts, adrs, nodes };
};

const joined = (xs) => xs.join(", ");

// Inserts `lines` at the end of the level-2 section whose title matches `name`; a missing section is
// created before the section matching `before`, else at the end.
const appendToSection = (text, name, title, lines, before) => {
  const ls = toLines(text);
  const hs = headings(ls);
  const h = hs.find((x) => x.level === 2 && name.test(plain(x.text)));
  if (h) {
    const end = sectionEnd(hs, h, ls.length);
    let last = end - 1;
    while (last > h.line && ls[last].trim() === "") last--;
    const insert = last === h.line ? ["", ...lines] : lines;
    return [...ls.slice(0, last + 1), ...insert, ...ls.slice(last + 1)].join("\n");
  }
  const b = before ? hs.find((x) => x.level === 2 && before.test(plain(x.text))) : null;
  const block = [`## ${title}`, "", ...lines, ""];
  if (b) return [...ls.slice(0, b.line), ...block, ...ls.slice(b.line)].join("\n");
  const body = ls.at(-1) === "" ? ls.slice(0, -1) : ls;
  return [...body, "", `## ${title}`, "", ...lines, ""].join("\n");
};

// The record text with the additions and one change-log line, or null when there is nothing to add or
// the segment's change-log line is already there.
export const appendedRecord = (text, add, segmentId, date) => {
  const parts = [["Contracts bumped", "contracts bumped", add.contracts], ["ADRs amended", "ADRs amended", add.adrs], ["Nodes grafted", "nodes grafted", add.nodes]]
    .filter(([, , xs]) => xs.length > 0);
  if (parts.length === 0 || text.includes(`hsdd-auto segment ${segmentId}:`)) return null;
  const withProduced = appendToSection(text, /^produced\b/i, "Produced", parts.map(([label, , xs]) => `- ${label}: ${joined(xs)}`), /^change log\b/i);
  const summary = parts.map(([, label, xs]) => `${label} ${joined(xs)}`).join("; ");
  return appendToSection(withProduced, /^change log\b/i, "Change log", [`- ${date}: hsdd-auto segment ${segmentId}: ${summary}`]);
};

// Writes the append; false when there is nothing to append or it was appended before.
export const appendProduced = (ctx, segmentId) => {
  const { segment } = segmentOf(ctx, segmentId);
  if (segment.mode !== "intake") return false;
  const record = segmentRecord(ctx.intake.records, segment.request);
  if (record === null) return false;
  const file = join(ctx.repoRoot, record.path);
  const next = appendedRecord(readFileSync(file, "utf8"), producedAdditions(ctx, segmentId), segmentId, dateOf(nowStamp()));
  if (next === null) return false;
  writeFileSync(file, next);
  return true;
};

// ---------- CLI ----------

const USAGE = "report.mjs --segment <id>";

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { segment: { type: "string" } }, allowPositionals: false, strict: true }));
    if (values.segment === undefined) throw new Error("missing --segment");
  } catch (e) {
    out.log(`usage error: ${e.message}`);
    out.log(USAGE);
    out.log("report: usage error");
    return 2;
  }
  try {
    const ctx = loadContext(repoRoot);
    const rel = reportPathOf(ctx, values.segment);
    const file = join(repoRoot, rel);
    const text = buildReport(ctx, values.segment, existsSync(file) ? readFileSync(file, "utf8") : null);
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
    out.log(`wrote ${rel}`);
    let appended;
    try {
      appended = appendProduced(ctx, values.segment);
    } catch (e) {
      out.log(`the report was written to ${rel}; the ## Produced append failed: ${e.message}`);
      out.log("report: failed");
      return 1;
    }
    if (segmentOf(ctx, values.segment).segment.mode === "intake") {
      out.log(appended ? "appended ## Produced and one change-log line to the intake record" : "no ## Produced append (nothing to add, or already appended)");
    }
    out.log(`report: ${rel} covers ${coveredSegments(ctx, values.segment).length} segment(s)`);
    return 0;
  } catch (e) {
    out.log(e.message);
    out.log("report: failed");
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
