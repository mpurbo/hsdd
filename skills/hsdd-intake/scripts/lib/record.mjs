// The sweep record (spec 5.1, 5.2): render, parse and the pure helpers around
// its name. No I/O.
import { toLines, tables, column, sections, sectionName } from "../md.mjs";

const RESERVED = ["progress", "execution-plan", "milestones", "atlas", "intake"];
const NAMED = "--repo|origin|directory";

export const normalizeRepo = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "-");
export const reservedIn = (name) => RESERVED.find((w) => name.includes(w)) ?? null;
export const isRecordFile = (name) => /^\d{4}-\d{2}-\d{2}-sweep-.+\.md$/.test(name);
export const recordFile = ({ today, repo, to }) => `hsdd/management/${today}-sweep-${repo}-${to.slice(0, 7)}.md`;

const cell = (s) => String(s).replace(/\|/g, "/");
const none = (ls) => (ls.length ? ls : ["none"]);

export function renderRecord(r) {
  const row = (x) => `| ${[x.sha, x.node, x.cls, x.reason, x.subject].map(cell).join(" | ")} |`;
  return [
    `# Sweep: ${r.repo} ${r.from.slice(0, 7)}..${r.to.slice(0, 7)}`,
    "",
    `- **Date:** ${r.date}`,
    `- **Repository:** ${r.repo} (${r.main}; named by ${r.named})`,
    `- **Range:** ${r.from}..${r.to} (${r.commits} commits, ${r.candidates} candidates; ${r.fromNote})`,
    `- **Run by:** ${r.runBy}`,
    `- **Status:** ${r.status}`,
    "",
    "## Commits",
    "",
    "| Commit | Node | Class | Reason | Subject |",
    "|--------|------|-------|--------|---------|",
    ...r.rows.map(row),
    "",
    "## Not candidates",
    ...none(r.notCandidates),
    "",
    "## Routing",
    ...none(r.routing),
    "",
    "## Produced",
    ...none(r.produced),
    "",
    "## Change log",
    ...r.changeLog,
    "",
  ].join("\n");
}

function headerField(ls, name) {
  const re = new RegExp(`^\\s*-?\\s*\\*\\*${name}:\\*\\*\\s*(.*)$`, "i");
  for (const l of ls) {
    const m = re.exec(l);
    if (m) return m[1].trim();
  }
  return null;
}

function trimEdges(ls) {
  let a = 0, b = ls.length;
  while (a < b && !ls[a].trim()) a++;
  while (b > a && !ls[b - 1].trim()) b--;
  return ls.slice(a, b);
}

export function parseRecord(text) {
  const ls = toLines(text);
  const secs = sections(ls, 2);
  const body = (name) => {
    const s = secs.find((x) => sectionName(x.title).toLowerCase() === name);
    return s ? trimEdges(ls.slice(s.start, s.end)) : [];
  };
  const repoM = new RegExp(`^(.*) \\((.*); named by (${NAMED})\\)$`).exec(headerField(ls, "Repository") ?? "");
  const rangeM = /^(\S+)\.\.(\S+) \((\d+) commits?, (\d+) candidates?; (.*)\)$/.exec(headerField(ls, "Range") ?? "");
  const commits = body("commits");
  const table = tables(commits)[0];
  const col = (n) => (table ? column(table, n) : -1);
  const [cSha, cNode, cCls, cReason, cSubject] = ["commit", "node", "class", "reason", "subject"].map(col);
  const rows = table
    ? table.rows.map((x) => ({ sha: x.cells[cSha], node: x.cells[cNode], cls: x.cells[cCls], reason: x.cells[cReason], subject: x.cells[cSubject] }))
    : [];
  return {
    repo: repoM?.[1] ?? null,
    main: repoM?.[2] ?? null,
    named: repoM?.[3] ?? null,
    date: headerField(ls, "Date"),
    from: rangeM?.[1] ?? null,
    to: rangeM?.[2] ?? null,
    commits: rangeM ? Number(rangeM[3]) : 0,
    candidates: rangeM ? Number(rangeM[4]) : 0,
    fromNote: rangeM?.[5] ?? null,
    runBy: headerField(ls, "Run by"),
    status: headerField(ls, "Status"),
    rows,
    notCandidates: body("not candidates"),
    routing: none(body("routing")),
    produced: none(body("produced")),
    changeLog: body("change log"),
  };
}

// `descends(a, b)` is true when commit `a` descends from commit `b`.
export function newestRecord(records, repo, descends) {
  const mine = records.filter((r) => r.repo === repo);
  if (!mine.length) return null;
  const latest = mine.reduce((d, r) => (r.date > d ? r.date : d), "");
  const sameDay = mine.filter((r) => r.date === latest);
  return sameDay.find((r) => sameDay.every((o) => o === r || o.to === r.to || descends(r.to, o.to))) ?? sameDay.at(-1);
}

// short sha -> the filename of the record that classified it.
export function classifiedOf(records, repo, exclude = null) {
  const out = new Map();
  for (const r of records) {
    if (r.repo !== repo || r.filename === exclude) continue;
    for (const x of r.rows) out.set(x.sha.slice(0, 7), r.filename);
  }
  return out;
}
