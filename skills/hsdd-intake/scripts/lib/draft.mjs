// The sweep's `draft` (spec 4.2, 7.4): resolve the range, set aside, run the
// surface test and the placement, and write the record with every candidate
// row present. Pure helpers first, the command last.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Refusal, runGit, resolveCommit, isAncestor, rangeCommits, repoName } from "./git.mjs";
import { readTree, readRecords } from "./tree.mjs";
import { renderRecord, recordFile, newestRecord, classifiedOf } from "./record.mjs";
import { commitMoves } from "./surface.mjs";
import { setAside, asideLines, place } from "./candidates.mjs";

const short = (sha) => sha.slice(0, 7);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(root, opts, records, git = runGit) {
  for (const k of ["to", "from", "main"]) {
    if (typeof opts[k] === "string" && opts[k].startsWith("-")) throw new Refusal(`--${k} value "${opts[k]}" starts with "-"; give a commit or a branch name`);
  }
  const { name, named } = repoName(root, opts.repo, git);
  const main = opts.main ?? "main";
  const mainSha = resolveCommit(root, main, git) ?? resolveCommit(root, `origin/${main}`, git);
  if (!mainSha) throw new Refusal(`no branch ${main} or origin/${main}; pass --main with the main line's name`);
  const to = opts.to === undefined ? mainSha : resolveCommit(root, opts.to, git);
  if (!to || !isAncestor(root, to, mainSha, git)) throw new Refusal(`--to ${opts.to} is not on the main line (${main})`);
  const given = opts.from === undefined ? undefined : resolveCommit(root, opts.from, git);
  if (opts.from !== undefined && !given) throw new Refusal(`--from ${opts.from} is not a commit`);
  const previous = newestRecord(records, name, (a, b) => isAncestor(root, b, a, git));
  if (given === undefined && !previous) throw new Refusal(`first sweep of ${name}: name the start with --from SHA`);
  const from = given ?? previous.to;
  if (!isAncestor(root, from, to, git)) throw new Refusal(`--from ${short(from)} is not an ancestor of ${short(to)}`);
  if (previous && given !== undefined && given !== previous.to && !isAncestor(root, given, previous.to, git)) {
    throw new Refusal(`--from ${short(given)} is neither the previous record's to (${short(previous.to)}) nor an ancestor of it, which leaves commits unswept`);
  }
  return { repo: name, named, main, from, to, fromNote: given === undefined ? `from ${previous.filename}` : "from named" };
}

export const reasonOf = (moves) => (moves.length > 1 ? `${moves[0]}, +${moves.length - 1} more` : moves[0]);

export function rowFor(commit, moves, placement) {
  const base = { sha: short(commit.sha), subject: commit.subject };
  const spans = placement.spans.length > 0;
  const node = spans ? "none" : placement.node ?? "?";
  if (moves.length > 0) return { ...base, node, cls: "intake", reason: reasonOf(moves) };
  if (spans) return { ...base, node, cls: "intake", reason: `spans ${placement.spans.join(", ")}` };
  return { ...base, node, cls: "?", reason: "?" };
}

export function draftFor(root, range, tree, classified, { tmp } = {}) {
  const commits = rangeCommits(root, range.from, range.to);
  const aside = setAside(commits, tree, classified);
  const rows = aside.candidates.map((c) => rowFor(c, commitMoves(root, c, { tmp }), place(c, tree)));
  return { commits, aside, rows };
}

export function recordOf(range, today, runBy, draft) {
  const intake = draft.rows.filter((r) => r.cls === "intake").length;
  return {
    repo: range.repo, main: range.main, named: range.named, date: today,
    from: range.from, to: range.to, commits: draft.commits.length, candidates: draft.rows.length, fromNote: range.fromNote,
    runBy: runBy ?? "?", status: "open", rows: draft.rows,
    notCandidates: asideLines(draft.aside),
    routing: ["none"], produced: ["none"],
    changeLog: [`- ${today}: created; ${draft.rows.length} candidates: ? log, ? retro, ${intake} intake, ? unplaced, ? phase`],
  };
}

const unfinished = (r) => r.runBy === "?" || r.rows.some((x) => [x.cls, x.node, x.reason].includes("?"));

export function draft(root, opts, out, git = runGit) {
  const today = opts.today ?? new Date().toLocaleDateString("en-CA");
  if (!DATE.test(today)) throw new Refusal(`--today ${today} is not YYYY-MM-DD`);
  const records = readRecords(root);
  const bad = records.find((r) => r.repo === null || r.to === null || r.date === null);
  if (bad) throw new Refusal(`unreadable record ${bad.filename}: fix or delete it before drafting`);
  const { name } = repoName(root, opts.repo, git);
  const mine = records.filter((r) => r.repo === name);
  const open = mine.find(unfinished);
  if (open) throw new Refusal(`unfinished record ${open.filename}: fill every ? or delete it before drafting`);
  const lost = mine.find((r) => !resolveCommit(root, r.to, git));
  if (lost) throw new Refusal(`${lost.filename}: the Range to ${short(lost.to)} does not resolve in this clone; fetch it first`);
  const range = resolveRange(root, opts, records, git);
  const classified = classifiedOf(mine, name);
  const d = draftFor(root, range, readTree(root), classified);
  if (d.rows.length === 0) {
    const a = d.aside;
    out.log(`no candidates: ${d.commits.length} commits, ${a.merges.length} merges, ${a.governance.length} governance-only, ${a.attributed.length} attributed, ${a.classified.reduce((n, g) => n + g.shas.length, 0)} classified`);
    return 0;
  }
  const same = mine.find((r) => r.to === range.to);
  if (same) throw new Refusal(`already swept: ${same.filename} holds ${short(range.to)}`);
  const record = recordOf(range, today, opts["run-by"], d);
  const text = renderRecord(record);
  if (!opts.write) {
    out.log(text);
    return 0;
  }
  const path = recordFile({ today, repo: name, to: range.to });
  const full = join(root, path);
  if (existsSync(full)) throw new Refusal(`${path} exists; delete it to redraft`);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
  out.log(`wrote ${path}`);
  out.log("next: fill every ? in the record, then run check");
  return 0;
}
