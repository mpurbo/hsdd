// Dispatch files and launch prompts (spec 6.6, 10.3, chapter 13, appendices B and C). The fills and
// the file text are pure functions of the dispatch snapshot (dispatchContext: lib/context.mjs's
// snapshot plus the few files the facts read) and next.mjs's step object; the C.2a facts live in
// lib/facts.mjs. The CLI modes are the edge: they allocate the step id, stamp the time, draw the read
// check, rename a lost report series and write the file. Usage: see USAGE.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContext } from "./lib/context.mjs";
import { ConfigError, sourcesOf } from "./lib/config.mjs";
import { KINDS, RAISED_WHEN, skillFor, targetType, writeSet } from "./lib/kinds.mjs";
import { P, reportPath, stepPaths } from "./lib/paths.mjs";
import { RenderError, renderTemplate, slotNames } from "./lib/render.mjs";
import { nowStamp } from "./lib/time.mjs";
import { changedPaths, headSha } from "./lib/git.mjs";
import {
  MAX_BYTES, WARN_BYTES, dispatchErrors, dispatchText, judgementCommitted, nextFreeStep, readDispatch, reportSeries, seriesOf, writeDispatch,
} from "./lib/records.mjs";
import { targetFiles } from "./lib/intake.mjs";
import { leafParentsOf } from "./lib/tree.mjs";
import { specFilesInOrder } from "./lib/order.mjs";
import { factLines } from "./lib/facts.mjs";
import { intakeHandoffTargets, selectNext } from "./next.mjs";
import { openMatching, queueItems } from "./routed.mjs";

export { factLines };

// The size limits live in lib/records.mjs beside the dispatch file's reader; re-exported here.
export { MAX_BYTES, WARN_BYTES };

export class DispatchError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "DispatchError";
    this.errors = errors;
  }
}

// A failure after some of a redispatch's writes ran: `done` names the renames already made.
class PartialWriteError extends Error {
  constructor(cause, done) {
    super(cause.message);
    this.name = "PartialWriteError";
    this.errors = [cause.message, ...done.map(([from, to]) => `already renamed: ${from} -> ${to}`)];
    this.done = done;
  }
}

const unique = (xs) => [...new Set(xs)];
const code = (s) => `\`${s}\``;
const lines = (xs) => (xs.length > 0 ? xs.join("\n") : "none");
const bullets = (xs) => lines(xs.map((x) => `- ${String(x).replace(/\n/g, "\n  ")}`));
const commaList = (xs) => (xs.length > 0 ? xs.map(code).join(", ") : "none");

// ---------- templates (part of the skill, read beside this script) ----------

const TEMPLATE_DIR = fileURLToPath(new URL("./templates/", import.meta.url));
const templateText = (rel) => readFileSync(join(TEMPLATE_DIR, rel), "utf8");
const skillVersion = () => readFileSync(fileURLToPath(new URL("./VERSION", import.meta.url)), "utf8").trim();

const DEFAULT_INVOCATION = /^<!-- default_invocation: (.*) -->$/;

// A step template's first line carries the kind's default invocation (B-1); the rest is the body.
const stepTemplate = (kind) => {
  const [first, ...rest] = templateText(`steps/${kind}.md`).split("\n");
  const m = DEFAULT_INVOCATION.exec(first);
  if (!m) throw new DispatchError([`templates/steps/${kind}.md: its first line is not <!-- default_invocation: ... -->`]);
  return { invocation: m[1], body: rest.join("\n") };
};

// Verbatim text as a fill. 13.2 renders a fill once before insertion, so a `{name}` in owner text,
// a prompt or a fact would be read as a slot; doubling its braces makes it come out as written.
const asFill = (text) => String(text).replace(/\{\{([a-z_]+)\}\}|\{([a-z_]+)\}/g, (_, doubled, name) => (doubled !== undefined ? `{{{${doubled}}}}` : `{{${name}}}`));
const escapeFills = (fills) => Object.fromEntries(Object.entries(fills).map(([k, v]) => [k, v == null ? v : asFill(v)]));

const render = (template, fills, name) => {
  try {
    return renderTemplate(template, fills);
  } catch (e) {
    if (e instanceof RenderError) throw new DispatchError([`templates/${name}: ${e.message}`]);
    throw e;
  }
};

// ---------- the snapshot ----------

// lib/context.mjs's snapshot plus `reads`, the files the facts and the preamble read beyond it.
export const dispatchContext = (repoRoot) => {
  const ctx = loadContext(repoRoot);
  const textOf = (rel) => (existsSync(join(repoRoot, rel)) ? readFileSync(join(repoRoot, rel), "utf8") : null);
  const candidates = [
    ...ctx.tree.contractFiles.flatMap((c) => c.validationPaths.map((v) => v.path)),
    `${ctx.layout.management}/atlas.md`,
  ];
  const stepsDir = join(repoRoot, P.stepsDir);
  return {
    ...ctx,
    reads: {
      plan: textOf(P.plan),
      conventions: textOf(P.conventions),
      existing: new Set(candidates.filter((p) => existsSync(join(repoRoot, p)))),
      stepFiles: existsSync(stepsDir) ? readdirSync(stepsDir).sort() : [],
    },
  };
};

// ---------- the preamble's fills (appendix B) ----------

const POLICY = {
  stop: "The orchestrator ends the run on these and asks the owner.",
  "decide-and-record": "The owner asked not to be asked in this segment. The orchestrator answers these as the owner's stand-in and records each answer with `would_have_asked: true`, except needs outside the repository it cannot meet. For you nothing changes: you report stops, you never answer them.",
};

const ROLE_TEXT = { normative: "normative", informative: "informative", baseline: "baseline, read only to see what changed" };

// 7.6's token forms, each with the place the form is written.
const TOKEN_USE = {
  empty_cell: "for an empty table cell or list",
  id_separator: "between an id and its title in a heading",
  reason_separator: "before a `Collides with` reason",
  source_separator: "between the path, authority and scope of a root `## Sources` line",
};

// Unicode names of the characters a prose rule usually bans: dashes, quotes, spaces and other
// typographic marks. Any other banned character is named by code point and "(unnamed)".
const CHAR_NAMES = new Map([
  [0x2010, "HYPHEN"], [0x2011, "NON-BREAKING HYPHEN"], [0x2012, "FIGURE DASH"], [0x2013, "EN DASH"], [0x2014, "EM DASH"],
  [0x2015, "HORIZONTAL BAR"], [0x2212, "MINUS SIGN"], [0x2E3A, "TWO-EM DASH"], [0x2E3B, "THREE-EM DASH"], [0xFE58, "SMALL EM DASH"],
  [0xFE63, "SMALL HYPHEN-MINUS"], [0xFF0D, "FULLWIDTH HYPHEN-MINUS"], [0x00AD, "SOFT HYPHEN"],
  [0x2026, "HORIZONTAL ELLIPSIS"], [0x2022, "BULLET"], [0x00B7, "MIDDLE DOT"], [0x2032, "PRIME"], [0x2033, "DOUBLE PRIME"],
  [0x00A0, "NO-BREAK SPACE"], [0x202F, "NARROW NO-BREAK SPACE"], [0x2009, "THIN SPACE"], [0x200B, "ZERO WIDTH SPACE"],
  [0x200C, "ZERO WIDTH NON-JOINER"], [0x200D, "ZERO WIDTH JOINER"], [0x2060, "WORD JOINER"], [0xFEFF, "ZERO WIDTH NO-BREAK SPACE"],
  [0x2018, "LEFT SINGLE QUOTATION MARK"], [0x2019, "RIGHT SINGLE QUOTATION MARK"], [0x201A, "SINGLE LOW-9 QUOTATION MARK"],
  [0x201B, "SINGLE HIGH-REVERSED-9 QUOTATION MARK"], [0x201C, "LEFT DOUBLE QUOTATION MARK"], [0x201D, "RIGHT DOUBLE QUOTATION MARK"],
  [0x201E, "DOUBLE LOW-9 QUOTATION MARK"], [0x201F, "DOUBLE HIGH-REVERSED-9 QUOTATION MARK"],
  [0x2039, "SINGLE LEFT-POINTING ANGLE QUOTATION MARK"], [0x203A, "SINGLE RIGHT-POINTING ANGLE QUOTATION MARK"],
  [0x00AB, "LEFT-POINTING DOUBLE ANGLE QUOTATION MARK"], [0x00BB, "RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK"],
]);

const charName = (ch) => {
  const cp = ch.codePointAt(0);
  const name = CHAR_NAMES.get(cp);
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${name ?? "(unnamed)"}`;
};

// Text with every banned character written as `<U+XXXX NAME>`, so the rule itself never contains one.
const withoutChars = (text, banned) => [...String(text)].map((ch) => (banned.has(ch) ? `<${charName(ch)}>` : ch)).join("");

// Final review A5: a period that ends one of these is not a sentence end; a letter right before the
// abbreviation makes it part of a word ("canvas."), so that period still ends the sentence.
const ABBREVIATIONS = ["e.g.", "i.e.", "etc.", "vs."];
const endsAbbreviation = (text, end) => ABBREVIATIONS.some((a) => {
  const start = end - a.length;
  return start >= 0 && text.slice(start, end).toLowerCase() === a && (start === 0 || !/\p{L}/u.test(text[start - 1]));
});

// The text up to the first `.`, `!` or `?` followed by whitespace or the end that does not close an
// abbreviation; the whole text when there is none.
const firstSentence = (text) => {
  const end = [...text.matchAll(/[.!?](?=\s|$)/g)].map((m) => m.index + 1)
    .find((e) => text[e - 1] !== "." || !endsAbbreviation(text, e));
  return end === undefined ? text : text.slice(0, end);
};

// The first sentence of the segment's paragraph under plan.md's `## Segments`, which opens with
// `**{segment id}.**` (S-5); null when there is none.
export const purposeOf = (planText, id) => {
  if (planText == null) return null;
  const ls = planText.replace(/\r\n?/g, "\n").split("\n");
  const start = ls.findIndex((l) => /^##\s+Segments\b/.test(l));
  if (start < 0) return null;
  const end = ls.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  const section = ls.slice(start + 1, end < 0 ? ls.length : end);
  const opener = `**${id}.**`;
  const at = section.findIndex((l) => l.trimStart().startsWith(opener));
  if (at < 0) return null;
  const stop = section.findIndex((l, i) => i > at && l.trim() === "");
  const text = section.slice(at, stop < 0 ? section.length : stop).map((l) => l.trim()).join(" ").slice(opener.length).trim();
  return text === "" ? null : firstSentence(text);
};

const earlierSegmentLine = (ctx) => (s) => {
  const steps = ctx.committedRunLines.filter((l) => l.segment === s.id).map((l) => l.step_ref);
  const span = steps.length > 0 ? `steps ${steps[0]} to ${steps.at(-1)}` : `first step ${s.first_step}, no step committed`;
  const purpose = purposeOf(ctx.reads.plan, s.id) ?? `no paragraph opens with **${s.id}.** under \`## Segments\``;
  return `- ${code(s.id)} (${s.mode}), ${span}: ${purpose} (${P.plan})`;
};

const segmentContext = (ctx) => {
  const seg = ctx.segment;
  const head = `This step belongs to segment ${seg.id} (${seg.mode}), opened ${seg.opened_at} by the owner's instruction:\n\n${String(seg.instruction).split("\n").map((l) => `> ${l}`).join("\n")}`;
  const earlier = ctx.segments.slice(0, -1);
  if (earlier.length === 0) return head;
  const recent = earlier.slice(-3).reverse();
  const more = earlier.length - recent.length;
  return [
    head,
    "",
    "Earlier segments of this run, newest first:",
    "",
    ...recent.map(earlierSegmentLine(ctx)),
    ...(more > 0 ? [`- ${more} more earlier segment${more === 1 ? "" : "s"}, each with its paragraph under \`## Segments\` in \`${P.plan}\``] : []),
  ].join("\n");
};

const sourceLines = (config) => {
  const all = sourcesOf(config);
  if (all.length === 0) return "- no sources are configured;";
  return all.map((s) => `- ${code(s.path)}: ${ROLE_TEXT[s.role]}, cited as ${code(s.cite)}, version ${s.version ?? "not given"}, authority ${s.authority ?? "absent"};`).join("\n");
};

const toolchainLines = ({ rules = [], commands = {} }) => {
  const cmds = Object.entries(commands);
  if (rules.length === 0 && cmds.length === 0) return "none";
  return [...rules, ...(cmds.length > 0 ? [`Use exactly these command prefixes: ${cmds.map(([k, v]) => `${code(k)}: ${code(v)}`).join("; ")}.`] : [])].join(" ");
};

const proseRuleLines = ({ banned_chars: chars = [], banned_phrases: phrases = [], token_forms: forms = {} }) => {
  const banned = new Set(chars.flatMap((s) => [...s]));
  const names = [...banned].map(charName);
  const usable = Object.entries(forms).filter(([k]) => TOKEN_USE[k] !== undefined);
  const parts = [
    ...(names.length > 0 ? [`Never write these characters: ${names.join(", ")}.`] : []),
    ...(phrases.length > 0 ? [`Never write these phrases: ${phrases.map((p) => `"${withoutChars(p, banned)}"`).join(", ")}.`] : []),
    ...(usable.length > 0 ? [`Where an HSDD template uses a banned character as a token, write instead: ${usable.map(([k, v]) => `${code(withoutChars(v, banned))} ${TOKEN_USE[k]}`).join("; ")}.`] : []),
  ];
  return parts.length > 0 ? parts.join(" ") : "none";
};

const citationLines = (config) => {
  const all = sourcesOf(config);
  if (all.length === 0) return "none";
  const current = all.filter((s) => s.role !== "baseline");
  const example = (current[0] ?? all[0]).cite;
  return [
    `Cite sources by citation name and section number, for example \`${example} §3.4\`.`,
    ...(current.length > 0 ? [`Citation names: ${current.map((s) => `${code(s.cite)} for ${code(s.path)}`).join(", ")}.`] : []),
    ...all.filter((s) => s.role === "baseline").map((s) => (s.version
      ? `For the baseline ${code(s.path)}, name its version, for example \`${s.cite} ${s.version} §3.4\`.`
      : `For the baseline ${code(s.path)} (cited as ${code(s.cite)}), name its version.`)),
  ].join(" ");
};

export const preambleFills = (ctx) => {
  const { config, segment } = ctx;
  return {
    branch: config.branch,
    skills_dir: config.skills_dir,
    experiments_dir: config.experiments_dir,
    segment_context: segmentContext(ctx),
    source_lines: sourceLines(config),
    out_of_bounds_lines: bullets(config.out_of_bounds.map(code)),
    owner_fact_lines: bullets(config.owner_facts),
    preference_lines: bullets(config.preferences),
    stop_set_lines: bullets(config.stop_set.map((c) => `${code(c)}: ${RAISED_WHEN[c]}`)),
    policy_paragraph: POLICY[segment.stop_policy ?? config.stop_policy],
    read_only_list: commaList(config.read_only),
    owner_file_list: commaList(config.owner_files),
    toolchain_lines: toolchainLines(config.toolchain),
    prose_rule_lines: proseRuleLines(config.prose_rules),
    citation_lines: citationLines(config),
  };
};

// ---------- the step section's fills (C.2, C.4) ----------

const SKILL_MODE = { graft: " in graft mode", promote: " in promotion mode", "phase-plan-append": " in append mode", align: " in align mode" };

// 6.5: the open items matching the step, oldest first.
const routedItems = (ctx, next) => openMatching(
  ctx.queueLines, { target: next.target, handoff: next.handoff ?? null }, leafParentsOf(ctx.tree), undefined, intakeHandoffTargets(ctx),
);

const recordPath = (ctx) => ctx.intake.record?.path ?? null;

const handoffOf = (ctx, id) => (ctx.intake.record?.block?.handoffs ?? []).find((h) => h.id === id) ?? null;

const targetFile = (ctx, target) => {
  switch (targetType(target, ctx.tree)) {
    case "contract": return `${ctx.layout.contract}/${target}.md`;
    case "adr": return ctx.tree.adrs.get(target)?.file ?? null;
    case "node": return `${ctx.layout.spec}/${target}.md`;
    default: return null;
  }
};

// The highest version the specs cite for the contract, v1 when none.
const targetVersion = (ctx, slug) => {
  const inSpecs = ctx.tree.contractCites.filter((c) => c.slug === slug && c.file.startsWith(`${ctx.layout.spec}/`));
  const versions = [...ctx.tree.contractNames, ...inSpecs].filter((c) => c.slug === slug).map((c) => Number(c.version.slice(1)));
  return versions.length > 0 ? `v${Math.max(...versions)}` : "v1";
};

// The first spec file, in the root spec's order (C.4), that cites the ADR; the adr facts list the citing
// lines in the same order.
const proposingSpec = (ctx, next) => specFilesInOrder(ctx.tree).find((f) => ctx.tree.adrCites.some((c) => c.id === next.target && c.file === f))
  // Deliberate departure from 13.2's fail-on-unfillable rule: an inserted adr step no spec cites yet
  // names its insert-step item instead of failing to render.
  ?? (next.queue_item ? `the insert-step item ${next.queue_item}` : null);

const STAGE_REASON = { plan: "the consistency pass", intake: "the segment's handoffs" };

// C.4: the executed insert-step item's text; for an align from a stage rule the mode's fixed text; else
// the texts of the routed items the step closes.
const reasonText = (ctx, next, routed) => {
  if (next.queue_item) return queueItems(ctx.queueLines).get(next.queue_item)?.text ?? null;
  if (next.kind === "align" && !next.handoff) return STAGE_REASON[ctx.segment.mode];
  if (routed.length > 0) return routed.map((it) => it.text).join("; ");
  // Deliberate departure from 13.2's fail-on-unfillable rule (B-16): a step with no item to quote (a
  // continuation whose items are closed) gets fixed text that points at its items, never next.mjs's
  // `why`, which is the selection's internal reason (final review A6).
  return next.continues ? "the items this step continues" : "the reason in this step's routed items";
};

// Every template that uses `{reason}` ends the sentence after it, so a fill that ends in a period would
// render two (smoke run S10, final wave F1): drop trailing whitespace and one trailing period.
const asReason = (text) => (text === null ? null : text.trimEnd().replace(/\.$/, ""));

const recordText = (ctx, next) => (ctx.segment.mode === "intake"
  ? recordPath(ctx)
  : next.queue_item ? `the insert-step item ${next.queue_item}` : null);

// C.4. A value that does not apply is null, so a default invocation that needs it fails to render.
export const instructionFills = (ctx, next, routed = routedItems(ctx, next)) => ({
  target: next.target,
  target_file: targetFile(ctx, next.target),
  target_version: targetVersion(ctx, next.target),
  proposing_spec: proposingSpec(ctx, next),
  reason: asReason(reasonText(ctx, next, routed)),
  record: recordText(ctx, next),
  request: ctx.segment.request ?? null,
  authority: ctx.segment.authority ?? null,
});

const invocationText = (ctx, next, c4) => {
  if (next.handoff) {
    const h = handoffOf(ctx, next.handoff);
    if (h === null) throw new DispatchError([`handoff ${next.handoff} is not in the segment's intake record (${recordPath(ctx) ?? "none found"})`]);
    return h.prompt;
  }
  return render(stepTemplate(next.kind).invocation, escapeFills(c4), `steps/${next.kind}.md default_invocation`);
};

const targetLine = (ctx, next) => {
  if (next.kind === "intake") return `${code(next.target)}, the request`;
  const files = targetFiles(next.kind, next.target, ctx.layout, ctx.tree);
  return files.length > 0 ? `${code(next.target)}, resolving to ${files.map(code).join(", ")}` : `${code(next.target)}, which has no file yet`;
};

const mentions = (text, step) => new RegExp(`(?<![A-Za-z0-9])${step}(?![0-9])`).test(String(text));

// C.2: the stopped step, its dispatch file, its report series, its artifact commit and the decisions
// on its stop (the orchestrator's in its sidecar, now in the ledger, and any owner decision naming it).
const continuingLines = (ctx, next) => {
  const s = next.continues;
  if (!s) return "none";
  const series = seriesOf(ctx.reads.stepFiles, s);
  const renamed = ctx.reads.stepFiles.filter((n) => new RegExp(`^${s}\\.(?:lost|invalid)\\d+(?:\\.r\\d+)?\\.json$`).test(n)).map((n) => `${P.stepsDir}/${n}`);
  const line = ctx.committedRunLines.find((l) => l.step_ref === s);
  const decisions = ctx.decisions.filter((d) => (d.step_ref === s && d.by === "orchestrator")
    || (d.by === "owner" && (d.evidence ?? []).some((e) => mentions(e, s))));
  return [
    `- Stopped step: ${s}, dispatched in ${code(stepPaths(s).dispatch)}`,
    `- Its reports: ${series.length > 0 ? series.map(code).join(", ") : "none in its current series"}`,
    ...(renamed.length > 0 ? [`- Its renamed reports, history: ${renamed.map(code).join(", ")}`] : []),
    `- Its artifact commit: ${line?.commit ?? `not in ${P.runLog}`}`,
    ...(decisions.length > 0
      ? decisions.map((d) => `- Decision on its stop: ${d.id}, chosen "${d.chosen}" (by ${d.by})`)
      : ["- Decisions on its stop: none recorded"]),
    "",
    "Finish the work from where it stopped; its partial artifacts are committed.",
  ].join("\n");
};

// `next` is next.mjs's step object; `step` the allocated id; `contextLines` the checked --context-file lines.
export const stepFills = (ctx, next, { step, head, contextLines = null }) => {
  const routed = routedItems(ctx, next);
  const c4 = instructionFills(ctx, next, routed);
  const record = recordPath(ctx);
  if (next.handoff && record === null) throw new DispatchError([`handoff ${next.handoff} has no intake record in this segment`]);
  return {
    step,
    kind: next.kind,
    skill: next.skill,
    report: stepPaths(step).report,
    head,
    handoff_suffix: next.handoff ? `, handoff ${next.handoff} of ${record}` : "",
    skill_mode: SKILL_MODE[next.kind] ?? "",
    target_line: targetLine(ctx, next),
    decide_command: `node hsdd/scripts/auto/decide.mjs --step ${step} --stdin`,
    write_set_list: next.write_set.map(code).join(", "),
    experiments_dir: ctx.config.experiments_dir,
    invocation: invocationText(ctx, next, c4),
    fact_lines: bullets(factLines(ctx, next)),
    routed_lines: bullets(routed.map((it) => `${it.id}, ${it.kind}, from ${it.from}: ${it.text}`)),
    predecided_lines: bullets(Object.entries(ctx.config.predecided).map(([cls, p]) => `${code(cls)}: ${p.answer} (${p.decision})`)),
    continuing_lines: continuingLines(ctx, next),
    context_lines: contextLines !== null && contextLines.length > 0 ? contextLines.join("\n") : "none",
    ...c4,
  };
};

// ---------- the file ----------

const READ_CHECK = "read_check: ";

const frontOf = (ctx, next, { step, head, renderedAt }) => {
  const orchestrator = KINDS[next.kind].orchestrator;
  return {
    step_ref: step,
    segment: ctx.segment.id,
    kind: next.kind,
    skill: next.skill,
    target: next.target,
    handoff: next.handoff ?? null,
    queue_item: next.queue_item ?? null,
    continues: next.continues ?? null,
    report: orchestrator ? null : stepPaths(step).report,
    decisions: stepPaths(step).decisions,
    write_set: next.write_set,
    template: orchestrator ? null : `steps/${next.kind}.md`,
    skill_version: skillVersion(),
    rendered_at: renderedAt,
    head,
    launches: orchestrator ? [] : [{ at: renderedAt, reason: "initial" }],
  };
};

const slotSizes = (templates, fills) => unique(templates.flatMap(slotNames))
  .map((slot) => ({ slot, bytes: Buffer.byteLength(String(fills[slot] ?? "")) }))
  .sort((a, b) => b.bytes - a.bytes || (a.slot < b.slot ? -1 : 1));

// The whole file for the step: front matter, then for a subagent step the rendered preamble, the
// rendered step section and the read check as the last line; an orchestrator step has an empty body.
export const buildDispatch = (ctx, next, { step, head, renderedAt, readCheck = null, contextLines = null }) => {
  const front = frontOf(ctx, next, { step, head, renderedAt });
  if (KINDS[next.kind].orchestrator) return { front, body: "", text: dispatchText(front, ""), sizes: [] };
  if (!/^[0-9a-f]{8}$/.test(readCheck ?? "")) throw new DispatchError([`a subagent step needs a read check of eight hex digits, not ${readCheck}`]);
  const preamble = templateText("preamble.md");
  const section = stepTemplate(next.kind).body;
  const fills = { ...preambleFills(ctx), ...stepFills(ctx, next, { step, head, contextLines }) };
  const escaped = escapeFills(fills);
  const body = [render(preamble, escaped, "preamble.md"), render(section, escaped, `steps/${next.kind}.md`), `${READ_CHECK}${readCheck}\n`].join("\n");
  return { front, body, text: dispatchText(front, body), sizes: slotSizes([preamble, section], fills) };
};

// A section inserted above the read check line, which stays last (6.6).
const withSection = (body, section, readCheck) => {
  const i = body.lastIndexOf(`\n${READ_CHECK}`);
  if (i < 0) throw new DispatchError(["the dispatch body has no read_check line"]);
  return `${body.slice(0, i + 1)}${section}\n${READ_CHECK}${readCheck}\n`;
};

const sizeLines = (sizes) => sizes.map((s) => `  ${s.slot} ${s.bytes}`);

// Refuses above MAX_BYTES (nothing is written); returns the warning lines above WARN_BYTES.
const checkSize = (path, text, sizes, refusal) => {
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_BYTES) throw new DispatchError([refusal(bytes), ...sizeLines(sizes)]);
  return bytes > WARN_BYTES ? [`warn  ${path} is ${bytes} bytes, above ${WARN_BYTES} (32 KiB, spec 10.3); slot sizes, largest first:`, ...sizeLines(sizes)] : [];
};

const launchPrompt = (step, path) => [
  `You are step ${step} of an unattended HSDD run. Your complete instructions are`,
  `in ${path}. Read the whole file first, then follow it exactly.`,
];

const drawReadCheck = () => randomBytes(4).toString("hex");

// A value that occurs nowhere in `above` (and differs from `previous`), so only a read to the end finds it (6.6).
const freshReadCheck = (above, previous = null) => {
  const v = drawReadCheck();
  return above.includes(v) || v === previous ? freshReadCheck(above, previous) : v;
};

// ---------- the context file (10.3) ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const citationTokens = (config) => [
  /[^\s/]\/[^\s/]/, // a repository path containing `/`
  /\b[0-9a-f]{7,}\b/, // a commit sha
  /\bS\d{2,}\b/,
  /\bDEC-\d{3,}\b/,
  /\bQ-\d{3,}\b/,
  ...unique(sourcesOf(config).map((s) => s.cite)).map((cite) => new RegExp(`(?<![A-Za-z0-9_-])${escapeRe(cite)}(?:\\s+\\S+)?\\s+§\\s*\\d`)),
];

// The first non-empty line without a citation token, as an error naming its line; [] when every line has one.
export const contextErrors = (contextLines, config, file = "the context file") => {
  const tokens = citationTokens(config);
  const bad = contextLines.findIndex((l) => l.trim() !== "" && !tokens.some((re) => re.test(l)));
  return bad < 0 ? [] : [
    `${file}:${bad + 1}: no citation token (a repository path with /, a commit sha of 7 or more hex digits, a step, decision or queue id, or a source citation such as \`Spec §3\`): ${contextLines[bad]}`,
  ];
};

const readText = (repoRoot, file, flag) => {
  const full = resolve(repoRoot, file);
  if (!existsSync(full)) throw new DispatchError([`${flag} ${file} does not exist`]);
  return readFileSync(full, "utf8").replace(/\r\n?/g, "\n");
};

// Lines are checked, and a refusal numbered, as the file stands; the fill drops leading and trailing blank lines.
const readContextFile = (repoRoot, file, config) => {
  const text = readText(repoRoot, file, "--context-file");
  const errors = contextErrors(text.split("\n"), config, file);
  if (errors.length > 0) throw new DispatchError(errors);
  const ls = text.replace(/^\n+|\n+$/g, "").split("\n");
  return ls.some((l) => l.trim() !== "") ? ls : null;
};

// ---------- the modes ----------

const endedAt = (ctx) => {
  const last = ctx.committedRunLines.filter((l) => l.segment === ctx.segment.id).at(-1);
  return typeof last?.note === "string" && last.note.startsWith("ended:") ? last : null;
};

// No step opens without a segment, or on a segment an owner message ended (8.11, B-11).
const segmentGuards = (ctx) => {
  if (ctx.segment === null) throw new DispatchError([`${P.runYaml} has no segment; open one with state.mjs open-segment`]);
  const ended = endedAt(ctx);
  if (ended) {
    throw new DispatchError([`segment ${ctx.segment.id} was ended at ${ended.step_ref} ("${ended.note}", spec 8.11); open the next segment with state.mjs open-segment first`]);
  }
  if (ctx.head === null) throw new DispatchError(["the repository has no commit; a dispatch file records HEAD"]);
};

const runNext = (repoRoot, { contextFile }) => {
  const ctx = dispatchContext(repoRoot);
  segmentGuards(ctx);
  const result = selectNext(ctx);
  if (!result.step) throw new DispatchError([`next.mjs returned ${JSON.stringify(result)}; --next dispatches only a step result (spec 10.3)`]);
  const next = result.step;
  const orchestrator = KINDS[next.kind].orchestrator;
  const step = nextFreeStep(repoRoot);
  if (next.kind === "setup" && step !== ctx.segment.first_step) {
    throw new DispatchError([`the setup step of segment ${ctx.segment.id} takes its first_step ${ctx.segment.first_step}, but the next free step id is ${step} (spec 5.5, 7.2)`]);
  }
  if (contextFile !== undefined && orchestrator) throw new DispatchError([`--context-file is for a subagent step; ${next.kind} is an orchestrator step with an empty body`]);
  const contextLines = contextFile === undefined ? null : readContextFile(repoRoot, contextFile, ctx.config);
  const path = stepPaths(step).dispatch;
  const renderedAt = nowStamp();
  const build = (readCheck) => buildDispatch(ctx, next, { step, head: ctx.head, renderedAt, readCheck, contextLines });
  const drawn = orchestrator ? null : drawReadCheck();
  const first = build(drawn);
  // The text above the read check is the same whatever the value; a value found in it is drawn again.
  const above = first.body.slice(0, Math.max(0, first.body.lastIndexOf(`\n${READ_CHECK}`)));
  const built = drawn !== null && above.includes(drawn) ? build(freshReadCheck(above)) : first;
  const warnings = checkSize(path, built.text, built.sizes,
    (bytes) => `${path} would be ${bytes} bytes, above the ${MAX_BYTES}-byte limit (64 KiB, spec 10.3); nothing written and no step id allocated. Slot sizes, largest first:`);
  writeDispatch(repoRoot, step, built.front, built.body);
  return { out: orchestrator ? [path] : [path, "", ...launchPrompt(step, path)], warnings };
};

const readResult = (repoRoot, file) => {
  try {
    return JSON.parse(readText(repoRoot, file, "--result-file"));
  } catch (e) {
    if (e instanceof DispatchError) throw e;
    throw new DispatchError([`--result-file ${file} is not valid JSON (${e.message})`]);
  }
};

const planBody = (reason, result) => `for: ${reason}\n${result === null ? "" : `\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`}`;

const runPlan = (repoRoot, { forReason, resultFile }) => {
  const ctx = loadContext(repoRoot);
  segmentGuards(ctx);
  const seg = ctx.segment;
  if (ctx.inProgress !== null) {
    throw new DispatchError([`${ctx.inProgress} is open (a dispatch file without its judgement commit); resume or commit it before a plan step (spec 8.9)`]);
  }
  if (!ctx.committedRunLines.some((l) => l.segment === seg.id && l.kind === "setup")) {
    throw new DispatchError([`segment ${seg.id} has no committed setup step, which takes its first_step ${seg.first_step} (spec 5.5); run dispatch.mjs --next`]);
  }
  const result = resultFile === undefined ? null : readResult(repoRoot, resultFile);
  const step = nextFreeStep(repoRoot);
  const next = {
    kind: "plan", skill: skillFor("plan", seg.id, ctx.tree), target: seg.id, handoff: null, queue_item: null, continues: null,
    write_set: writeSet("plan", seg.id, { layout: ctx.layout, config: ctx.config, segmentId: seg.id, tree: ctx.tree }),
  };
  const front = frontOf(ctx, next, { step, head: ctx.head, renderedAt: nowStamp() });
  const body = planBody(forReason, result);
  const path = stepPaths(step).dispatch;
  const warnings = checkSize(path, dispatchText(front, body), [{ slot: "result-file", bytes: Buffer.byteLength(body) }],
    (bytes) => `${path} would be ${bytes} bytes, above the ${MAX_BYTES}-byte limit (64 KiB, spec 10.3); nothing written and no step id allocated:`);
  writeDispatch(repoRoot, step, front, body);
  return { out: [path], warnings };
};

// A subagent step's dispatch file that a resume or a redispatch may change.
const openDispatch = (repoRoot, step) => {
  const path = stepPaths(step).dispatch;
  let d;
  try {
    d = readDispatch(repoRoot, step);
  } catch (e) {
    throw new DispatchError([`${path}: ${e.message}`]);
  }
  if (d === null) throw new DispatchError([`${step} has no dispatch file (${path})`]);
  const errors = dispatchErrors(d.front, step);
  if (errors.length > 0) throw new DispatchError(errors.map((e) => `${path}: ${e}`));
  if (KINDS[d.front.kind].orchestrator) throw new DispatchError([`${step} is an orchestrator step (${d.front.kind}); it has no subagent to resume or re-dispatch`]);
  if (judgementCommitted(repoRoot, step)) throw new DispatchError([`${step} has its judgement commit; it can no longer be resumed or re-dispatched`]);
  if (d.readCheck === null) throw new DispatchError([`${path} does not end in its read_check line`]);
  return d;
};

// Launches since the current report series began: after the initial launch or the last redispatch.
const sinceSeries = (launches) => launches.slice(launches.findLastIndex((l) => l.reason === "initial" || l.reason === "redispatch") + 1);

const RESUME_WHAT = { answer: "an answer from the orchestrator", finding: "a finding to fix" };

const resumeMessage = ({ step, n, reason, message }) => [
  `Resume ${n} of step ${step}: ${RESUME_WHAT[reason]}.`,
  "",
  message,
  "",
  `Write this launch's report to ${code(reportPath(step, n))}, with the same \`read_check\` value as before. The rest of ${code(stepPaths(step).dispatch)} still holds; this message is its \`## Resume ${n}\` section.`,
].join("\n");

const runResume = (repoRoot, { step, reason, messageFile }) => {
  const d = openDispatch(repoRoot, step);
  const message = readText(repoRoot, messageFile, "--message-file").trim();
  if (message === "") throw new DispatchError([`--message-file ${messageFile} is empty`]);
  const n = sinceSeries(d.front.launches).filter((l) => l.reason.startsWith("resume-")).length + 1;
  const text = resumeMessage({ step, n, reason, message });
  const front = { ...d.front, launches: [...d.front.launches, { at: nowStamp(), reason: `resume-${reason}` }] };
  const body = withSection(d.body, `## Resume ${n}\n\n${text}\n`, d.readCheck);
  const path = stepPaths(step).dispatch;
  const sizes = [{ slot: "file before this resume", bytes: Buffer.byteLength(d.text) }, { slot: "resume message", bytes: Buffer.byteLength(text) }]
    .sort((a, b) => b.bytes - a.bytes);
  const warnings = checkSize(path, dispatchText(front, body), sizes,
    (bytes) => `the resume message would take ${path} to ${bytes} bytes, above the ${MAX_BYTES}-byte limit (64 KiB, spec 10.3); nothing written, shorten the message. Sizes, largest first:`);
  writeDispatch(repoRoot, step, front, body);
  return { out: text.split("\n"), warnings };
};

const redispatchSection = ({ step, k, at, changed, renamed, sidecar }) => `${[
  "## Redispatch",
  "",
  `Redispatch ${k} of step ${step}, at ${at}: the subagent of the previous launch was lost. You are a fresh subagent with no context but this file. Any \`## Resume\` section above went to the lost subagent and is history. Write your report to ${code(reportPath(step, 0))}${renamed.length > 0 ? `; the lost launch's reports were renamed ${renamed.map(code).join(", ")} and are history` : ""}. The \`read_check\` value below is new.`,
  "",
  "Files the lost launch changed (git status when this section was written):",
  "",
  ...(changed.length > 0 ? changed.map((p) => `- ${code(p)}`) : ["none"]),
  "",
  `Finish or correct them: they are this step's partial work, and the gate checks them against your write set.${sidecar ? ` The decisions the lost launch recorded are in ${code(sidecar)}.` : ""}`,
].join("\n")}\n`;

const runRedispatch = (repoRoot, { step }) => {
  const d = openDispatch(repoRoot, step);
  const path = stepPaths(step).dispatch;
  const full = headSha(repoRoot, { short: false });
  if (full === null || !full.startsWith(d.front.head)) {
    throw new DispatchError([`HEAD ${full ?? "(none)"} is not ${step}'s dispatch head ${d.front.head}: its artifact commit exists or HEAD moved; rerun commit.mjs instead (spec 8.9)`]);
  }
  // k counts redispatches from 1 (8.6).
  const k = d.front.launches.filter((l) => l.reason === "redispatch").length + 1;
  const renames = reportSeries(repoRoot, step).map((from) => [from, from.replace(/\/([^/]+?)((?:\.r\d+)?)\.json$/, `/$1.lost${k}$2.json`)]);
  const taken = renames.filter(([, to]) => existsSync(join(repoRoot, to)));
  if (taken.length > 0) throw new DispatchError(taken.map(([from, to]) => `cannot rename ${from}: ${to} exists`));
  const renamed = new Map(renames);
  const sidecar = stepPaths(step).decisions;
  const status = changedPaths(repoRoot).map((p) => renamed.get(p) ?? p);
  const own = new Set([path, P.decideLock, sidecar, ...renamed.values()]);
  const at = nowStamp();
  const section = redispatchSection({
    step, k, at, changed: status.filter((p) => !own.has(p)), renamed: [...renamed.values()], sidecar: status.includes(sidecar) ? sidecar : null,
  });
  const front = { ...d.front, launches: [...d.front.launches, { at, reason: "redispatch" }] };
  const above = withSection(d.body, section, d.readCheck);
  const body = withSection(d.body, section, freshReadCheck(above.slice(0, above.lastIndexOf(`\n${READ_CHECK}`)), d.readCheck));
  const errors = dispatchErrors(front, step);
  if (errors.length > 0) throw new DispatchError(errors.map((e) => `${path}: ${e}`));
  const warnings = checkSize(path, dispatchText(front, body), [{ slot: "file before this redispatch", bytes: Buffer.byteLength(d.text) }, { slot: "redispatch section", bytes: Buffer.byteLength(section) }],
    (bytes) => `${path} would be ${bytes} bytes, above the ${MAX_BYTES}-byte limit (64 KiB, spec 10.3); nothing written or renamed. This is a hard stop recorded in ${step} itself: decide.mjs --step ${step} --by orchestrator, STOP.md, then commit.mjs --step ${step} --status stopped --no-report. Sizes:`);
  const done = [];
  try {
    for (const [from, to] of renames) {
      renameSync(join(repoRoot, from), join(repoRoot, to));
      done.push([from, to]);
    }
    writeDispatch(repoRoot, step, front, body);
  } catch (e) {
    throw new PartialWriteError(e, done);
  }
  return { out: [path, "", ...launchPrompt(step, path)], warnings };
};

// ---------- CLI ----------

const USAGE = [
  "dispatch.mjs --next [--context-file f.md]",
  "dispatch.mjs --plan --for stop|close|decide|stuck|owner|size|other [--result-file f.json]",
  "dispatch.mjs --resume S07 --reason answer|finding --message-file f.md",
  "dispatch.mjs --redispatch S07",
].join("\n");

class UsageError extends Error {}

const OPTIONS = {
  next: { type: "boolean" }, plan: { type: "boolean" }, resume: { type: "string" }, redispatch: { type: "string" },
  "context-file": { type: "string" }, for: { type: "string" }, "result-file": { type: "string" }, reason: { type: "string" }, "message-file": { type: "string" },
};

// Each mode and the options that go with it.
const MODE_OPTIONS = { next: ["context-file"], plan: ["for", "result-file"], resume: ["reason", "message-file"], redispatch: [] };
const FOR_REASONS = ["stop", "close", "decide", "stuck", "owner", "size", "other"];
const STEP_ID = /^S\d{2,}$/;

const parse = (argv) => {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  if (positionals.length > 0) throw new UsageError(`unexpected argument ${positionals[0]}`);
  const modes = Object.keys(MODE_OPTIONS).filter((m) => values[m] !== undefined);
  if (modes.length !== 1) throw new UsageError("give exactly one of --next, --plan, --resume, --redispatch");
  const [mode] = modes;
  const stray = Object.keys(values).find((k) => !Object.hasOwn(MODE_OPTIONS, k) && !MODE_OPTIONS[mode].includes(k));
  if (stray) throw new UsageError(`--${stray} does not go with --${mode}`);
  const need = (name) => { if (values[name] === undefined) throw new UsageError(`--${mode} needs --${name}`); return values[name]; };
  switch (mode) {
    case "next":
      return { mode, opts: { contextFile: values["context-file"] } };
    case "plan": {
      const forReason = need("for");
      if (!FOR_REASONS.includes(forReason)) throw new UsageError(`--for is one of ${FOR_REASONS.join(", ")}, not ${forReason}`);
      return { mode, opts: { forReason, resultFile: values["result-file"] } };
    }
    case "resume": {
      const reason = need("reason");
      if (!STEP_ID.test(values.resume)) throw new UsageError(`--resume takes a step id, not ${values.resume}`);
      if (!Object.hasOwn(RESUME_WHAT, reason)) throw new UsageError(`--reason is answer or finding, not ${reason}`);
      return { mode, opts: { step: values.resume, reason, messageFile: need("message-file") } };
    }
    default:
      if (!STEP_ID.test(values.redispatch)) throw new UsageError(`--redispatch takes a step id, not ${values.redispatch}`);
      return { mode, opts: { step: values.redispatch } };
  }
};

const MODES = { next: runNext, plan: runPlan, resume: runResume, redispatch: runRedispatch };

// Prints what 10.3 says on stdout; warnings go to stderr so stdout stays the path and the prompt.
// A refusal prints its findings and a summary line, and exits 1 having written nothing.
export const main = (argv, repoRoot = process.cwd(), out = { log: console.log, error: console.error }) => {
  try {
    const { mode, opts } = parse(argv);
    const r = MODES[mode](repoRoot, opts);
    r.warnings.forEach((w) => out.error(w));
    r.out.forEach((l) => out.log(l));
    return 0;
  } catch (e) {
    if (e instanceof UsageError || e?.code?.startsWith?.("ERR_PARSE_ARGS")) {
      out.log(`usage error: ${e.message}`);
      out.log(USAGE);
      out.log("dispatch: usage error");
      return 2;
    }
    (Array.isArray(e?.errors) ? e.errors : [e?.message ?? String(e)]).forEach((m) => out.log(m));
    if (e instanceof DispatchError || e instanceof ConfigError) out.log("dispatch: refused, nothing written");
    else if (e instanceof PartialWriteError) out.log(`dispatch: failed after ${e.done.length} rename(s) listed above, before the dispatch file was written in full; check git status`);
    else out.log("dispatch: failed unexpectedly; check git status for a partial write");
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
