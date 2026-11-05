// The sweep's `check` (spec 7.4): read a record back against a fresh draft of
// its range. The rules are pure; the command only reads and prints.
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Refusal, resolveCommit } from "./git.mjs";
import { readTree, readRecords } from "./tree.mjs";
import { isRecordFile, parseRecord, classifiedOf } from "./record.mjs";
import { draftFor } from "./draft.mjs";

const CLASSES = ["log", "retro", "intake", "unplaced"];
const HEADING = /^\*\*H(\d+)\*\* \((\w+), ([^)]*)\):\s*$/;

// `**H{n}** ({class}, {target}):` and the fenced blocks up to the next heading.
export function handoffsOf(routing) {
  const out = [];
  let open = null;
  let block = null;
  for (const line of routing) {
    const h = HEADING.exec(line);
    if (h && block === null) {
      open = { id: `H${h[1]}`, cls: h[2], target: h[3].trim(), prompts: [] };
      out.push(open);
    } else if (open && block === null && /^```/.test(line)) block = [];
    else if (block !== null && /^```\s*$/.test(line)) {
      open.prompts.push(block.join("\n"));
      block = null;
    } else if (block !== null) block.push(line);
  }
  return out;
}

// A prompt names a sha only at chapter 6's sha positions: `commits {sha}, {sha}`
// and `{repo}@{sha} (commit)`. The record's own filename ends in {to7} and a
// subject may quote any sha, so neither counts. Prompts wrap, so whitespace
// collapses first.
export function promptShas(prompt) {
  const text = prompt.replace(/\s+/g, " ");
  const listed = [...text.matchAll(/\bcommits ([0-9a-f]{7}(?:, [0-9a-f]{7})*)/g)].flatMap((m) => m[1].split(", "));
  const single = [...text.matchAll(/@([0-9a-f]{7}) \(commit\)/g)].map((m) => m[1]);
  return [...listed, ...single];
}

// The class a change-log line lowers `sha` to, or undefined on any other line.
const loweredTo = (line, sha) => new RegExp(`^- \\d{4}-\\d{2}-\\d{2}: lowered ${sha} from intake to (log|retro) by .+: .+$`).exec(line)?.[1];

function rowProblems(x, fresh, tree, record) {
  const at = `row ${x.sha}`;
  const out = [];
  const cells = { Class: x.cls, Node: x.node, Reason: x.reason };
  for (const [name, v] of Object.entries(cells)) if (v === "?") out.push(`${at}: ${name} is still ?`);
  if (x.cls !== "?" && !CLASSES.includes(x.cls)) out.push(`${at}: class "${x.cls}" is not one of ${CLASSES.join(", ")}`);
  if ((x.cls === "retro" || x.cls === "intake") && x.reason === "none") out.push(`${at}: reason is none on a ${x.cls} row`);
  if (fresh?.cls === "intake" && x.cls !== "intake" && x.cls !== "?") {
    if (x.cls === "unplaced") out.push(`${at}: the draft set intake and a row is never lowered to unplaced; an intake row nobody places stays intake, node none`);
    else if (!record.changeLog.some((l) => loweredTo(l, x.sha) === x.cls)) out.push(`${at}: the draft set intake and the row reads ${x.cls} with no change-log line "lowered ${x.sha} from intake to ${x.cls} by {person}: {reason}"`);
  }
  if (x.node === "none") {
    if (x.cls !== "intake" && x.cls !== "unplaced" && CLASSES.includes(x.cls)) out.push(`${at}: node none is valid on intake and unplaced rows only`);
  } else if (x.node !== "?") {
    const n = tree.nodes.get(x.node);
    if (!n) out.push(`${at}: node ${x.node} is not in the tree`);
    else if ((x.cls === "log" || x.cls === "retro") && n.status === "retired") out.push(`${at}: ${x.cls} row on retired node ${x.node}; a row names an active node`);
    else if (x.cls === "retro") {
      if (n.adopted === "as-built") out.push(`${at}: retro row on as-built node ${x.node}, where append mode has no plan to write into`);
      else if (n.kind === "internal" || n.kind === "root") out.push(`${at}: retro row on ${n.kind} node ${x.node}, where append mode has no plan to write into`);
    }
  }
  return out;
}

export function checkRecord(record, freshRows, tree) {
  const out = [];
  const freshBy = new Map(freshRows.map((x) => [x.sha, x]));
  const seen = new Set();
  for (const x of record.rows) {
    if (seen.has(x.sha)) out.push(`row ${x.sha}: duplicate row`);
    seen.add(x.sha);
    if (!freshBy.has(x.sha)) out.push(`row ${x.sha}: no candidate in the range`);
  }
  for (const f of freshRows) if (!seen.has(f.sha)) out.push(`candidate ${f.sha}: no row in the table`);
  for (const x of record.rows) out.push(...rowProblems(x, freshBy.get(x.sha), tree, record));

  const handoffs = handoffsOf(record.routing);
  for (const x of record.rows) {
    if (x.cls === "log" && handoffs.some((h) => h.prompts.some((p) => promptShas(p).includes(x.sha)))) out.push(`row ${x.sha}: a log row's sha appears in a handoff`);
    if ((x.cls === "retro" || x.cls === "intake") && !handoffs.some((h) => promptShas(h.prompts[0] ?? "").includes(x.sha))) out.push(`row ${x.sha}: ${x.cls} row has no handoff whose first prompt names it`);
  }

  if (!record.runBy || record.runBy === "?" || /[{}]/.test(record.runBy)) out.push("Run by is empty or a placeholder");

  const m = /^- \S+: created; (\d+) candidates: (\d+) log, (\d+) retro, (\d+) intake, (\d+) unplaced$/.exec(record.changeLog[0] ?? "");
  const n = (c) => record.rows.filter((x) => x.cls === c).length;
  const want = [record.rows.length, n("log"), n("retro"), n("intake"), n("unplaced")];
  if (!m) out.push("change-log counts: the first line is not 'created; {k} candidates: {l} log, {r} retro, {i} intake, {u} unplaced'");
  else if (m.slice(1).map(Number).some((v, i) => v !== want[i])) out.push(`change-log counts disagree with the table (the table has ${want[0]} candidates: ${want[1]} log, ${want[2]} retro, ${want[3]} intake, ${want[4]} unplaced)`);

  const closed = /^closed \(\d{4}-\d{2}-\d{2}\)$/.test(record.status ?? "");
  if (!closed && record.status !== "open") out.push(`Status "${record.status}" is neither open nor closed (YYYY-MM-DD)`);
  else if (closed && record.rows.some((x) => x.cls !== "log")) out.push("Status is closed on a record with a retro, intake or unplaced row");
  else if (record.status === "open" && record.rows.length > 0 && record.rows.every((x) => x.cls === "log")) out.push("Status is open on a record with only log rows");
  return out;
}

export function check(root, path, out) {
  if (!path) throw new Refusal("check needs a record path: check hsdd/management/DATE-sweep-REPO-SHA7.md");
  const file = resolve(root, path);
  const filename = basename(file);
  if (!isRecordFile(filename)) throw new Refusal(`${path} is not a sweep record (YYYY-MM-DD-sweep-...md)`);
  if (!existsSync(file)) throw new Refusal(`${path} does not exist`);
  const record = parseRecord(readFileSync(file, "utf8"));
  if (record.repo === null || record.from === null || record.to === null) throw new Refusal(`${path}: the Repository or Range header is unreadable`);
  for (const [end, sha] of Object.entries({ from: record.from, to: record.to })) {
    if (!resolveCommit(root, sha)) throw new Refusal(`${path}: the Range ${end} ${sha.slice(0, 7)} does not resolve in this clone; fetch it first`);
  }
  const classified = classifiedOf(readRecords(root), record.repo, filename);
  const tree = readTree(root);
  const fresh = draftFor(root, { from: record.from, to: record.to }, tree, classified);
  const problems = checkRecord(record, fresh.rows, tree);
  if (problems.length > 0) {
    for (const p of problems) out.error(p);
    return 1;
  }
  out.log(`ok: ${path}`);
  return 0;
}
