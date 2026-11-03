// Read an HSDD tree into the plain model the seal works from. The only
// module with reads and git queries; everything it returns is data.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { toLines, headings, sections, sectionName, plain } from "../md.mjs";
import { extractPlan, listMd } from "../extract-plan.mjs";

const PLACEHOLDER = /[{}]/;
const EMPTY_VALUE = /^(none|tbd|n\/a|-)?$/i;

export function isSigned(reviewer) {
  if (reviewer == null) return false;
  const v = plain(reviewer).trim();
  return v !== "" && !PLACEHOLDER.test(v) && !EMPTY_VALUE.test(v);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Known ids present in a text, each once, in order of first appearance.
// A boundary on both sides keeps `acme.api.1` out of `acme.api.10`.
export function idsIn(text, ids) {
  const found = [];
  for (const id of ids) {
    const re = new RegExp(`(?<![\\w.])${escapeRe(id)}(?![\\w]|\\.\\d)`);
    const m = re.exec(text);
    if (m) found.push({ id, at: m.index });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.id);
}

// The level-2 section whose name (numbering stripped) starts with `title`,
// as { lines, sec: { title, line, start, end } }, or null. Shared by every
// module that reads or rewrites a section, so they agree on which one it is.
export function findSection(ls, title) {
  const sec = sections(ls, 2).find((s) => new RegExp(`^${title}`, "i").test(sectionName(s.title)));
  return sec ? { lines: ls.slice(sec.start, sec.end), sec } : null;
}
const sectionBody = findSection;

const bodyIsEmpty = (lines) => !lines || lines.every((l) => !l.trim() || /^\s*-\s+none\b/i.test(l));

export function parseVerificationDoc(text) {
  const ls = toLines(text);
  const signoff = sectionBody(ls, "sign-off");
  let reviewer = null;
  if (signoff) {
    const line = signoff.lines.find((l) => /^\s*-?\s*\*{0,2}Reviewer\s*\/\s*date\*{0,2}:/i.test(l));
    if (line) reviewer = line.replace(/^\s*-?\s*\*{0,2}Reviewer\s*\/\s*date\*{0,2}:\s*/i, "").trim();
  }
  const outstanding = sectionBody(ls, "outstanding");
  const learnings = sectionBody(ls, "learnings");
  return {
    reviewer,
    signed: isSigned(reviewer),
    placeholder: reviewer !== null && PLACEHOLDER.test(reviewer),
    hasSignoff: signoff !== null,
    outstandingEmpty: bodyIsEmpty(outstanding?.lines ?? []),
    learningsEmpty: bodyIsEmpty(learnings?.lines ?? []),
  };
}

export function headerField(ls, name) {
  const re = new RegExp(`^\\s*-?\\s*\\*\\*${name}:\\*\\*\\s*(.*)$`, "i");
  for (const l of ls) {
    const m = re.exec(l);
    if (m) return m[1].trim();
  }
  return null;
}

export function parseIntake(text, path, phaseIds) {
  const ls = toLines(text);
  const status = /^closed/i.test(headerField(ls, "Status") ?? "") ? "closed" : "open";
  const produced = sectionBody(ls, "produced");
  return {
    path,
    status,
    produced: produced ? idsIn(produced.lines.join("\n"), phaseIds) : [],
    request: headerField(ls, "Request"),
  };
}

const splitId = (id) => {
  const at = id.lastIndexOf(".");
  return { node: id.slice(0, at), n: Number(id.slice(at + 1)) };
};

// Phase ids a gate names, with `a.1–a.4` (one node, ascending) expanded to
// every known phase of that node in the range.
export function gatePhases(text, phaseIds) {
  const found = idsIn(text, phaseIds);
  const ranges = [...text.matchAll(/([\w.-]+\.\d+)\s*(?:\u2013|\u2014|-)\s*([\w.-]+\.\d+)/g)];
  const out = [...found];
  for (const r of ranges) {
    if (!phaseIds.includes(r[1]) || !phaseIds.includes(r[2])) continue;
    const a = splitId(r[1]);
    const b = splitId(r[2]);
    if (a.node !== b.node || a.n > b.n) continue;
    const members = phaseIds.filter((id) => {
      const s = splitId(id);
      return s.node === a.node && s.n >= a.n && s.n <= b.n;
    }).sort((x, y) => splitId(x).n - splitId(y).n);
    // The range's members sit where the range sits in the text, right after its first id.
    const at = out.indexOf(r[1]);
    const fresh = members.filter((id) => !out.includes(id));
    out.splice(at + 1, 0, ...fresh);
  }
  return out;
}

export function parseMilestone(text, phaseIds) {
  const ls = toLines(text);
  const ms = sectionBody(ls, "milestones");
  const from = ms ? ms.sec.start : 0;
  const to = ms ? ms.sec.end : ls.length;
  const gates = [];
  for (let i = from; i < to; i++) {
    const m = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(ls[i]);
    if (m) gates.push({ line: i, checked: m[1] !== " ", text: m[2].trim(), phases: gatePhases(m[2], phaseIds) });
  }
  const firstH2 = headings(ls).find((h) => h.level === 2);
  return {
    sealed: headerField(ls, "Sealed") !== null,
    gates,
    firstH2Line: firstH2 ? firstH2.line : ls.length,
  };
}

// Phase ids whose record carries a `- **Status:** dropped` line, read from
// each phase section under the node's Phase Plan.
export function droppedPhaseIds(text, phaseIds) {
  const ls = toLines(text);
  const out = [];
  const hs = headings(ls).filter((h) => h.level === 3);
  hs.forEach((h, k) => {
    const [id] = idsIn(h.text, phaseIds);
    if (!id) return;
    const end = k + 1 < hs.length ? hs[k + 1].line : ls.length;
    const next2 = headings(ls).find((x) => x.line > h.line && x.level <= 2);
    const stop = Math.min(end, next2 ? next2.line : ls.length);
    if (ls.slice(h.line + 1, stop).some((l) => /^\s*-?\s*\*\*Status:\*\*\s*dropped\b/i.test(l))) out.push(id);
  });
  return out;
}

export function progressDoneSet(text, phaseIds) {
  const ls = toLines(text);
  const done = sectionBody(ls, "what is done");
  return new Set(done ? idsIn(done.lines.join("\n"), phaseIds) : []);
}

export function pendingRequests(text) {
  const ls = toLines(text);
  const sec = sectionBody(ls, "governance updates");
  if (!sec) return { entries: 0, requests: 0 };
  const bullets = sec.lines.filter((l) => /^\s*[-*]\s+\S/.test(l) && !/^\s*[-*]\s+none\b/i.test(l));
  return { entries: bullets.length, requests: bullets.filter((l) => /^\s*[-*]\s+`?\*{0,2}request\b/i.test(l)).length };
}

export function catchupArgs(arg) {
  if (arg == null || String(arg).trim() === "") return [];
  const v = String(arg).trim();
  if (/^since:/i.test(v)) return [`--since=${v.slice(6)}`];
  if (v.includes("..")) return [v];
  return v.split(",").map((s) => s.trim()).filter(Boolean).map((s) => `${s}^!`);
}

export function gitCwdFor(root, relPath) {
  const sub = join(root, "hsdd");
  if (/^hsdd\//.test(relPath) && existsSync(join(sub, ".git"))) return sub;
  return root;
}

export function runGit(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const err = String(e.stderr ?? "").trim();
    throw new Error(`git ${args[0]} failed in ${cwd}${err ? `: ${err}` : ""}`);
  }
}

// The git working copies a catch-up value is evaluated in: the project root,
// and the submodule at hsdd/ under the standalone-spec-repo profile.
function catchupCwds(root) {
  return [...new Set([gitCwdFor(root, "hsdd/"), root])];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Is the owner's --catchup value one git will evaluate the way the owner
// means? A since: date must be a real calendar date; every sha or range end
// must be a commit in every repository the catch-up is queried in.
export function validateCatchup(root, arg, { git = runGit } = {}) {
  const errors = [];
  if (arg == null || String(arg).trim() === "") return { ok: true, errors };
  const v = String(arg).trim();
  if (/^since:/i.test(v)) {
    const d = v.slice(6);
    if (!DATE.test(d) || Number.isNaN(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d) errors.push(`since: takes a calendar date as YYYY-MM-DD; "${v}" is not one (git would read a bad date as the beginning of history)`);
    return { ok: errors.length === 0, errors };
  }
  const revs = v.includes("..") ? v.split("..").map((s) => s.replace(/^\.+|\.+$/g, "")).filter(Boolean) : v.split(",").map((s) => s.trim()).filter(Boolean);
  for (const cwd of catchupCwds(root)) {
    const label = relative(root, cwd) || ".";
    for (const rev of revs) {
      try {
        git(cwd, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
      } catch {
        const hint = cwd !== root ? "; under the standalone-spec-repo profile a sha from the implementation repository does not exist in hsdd/, use since:YYYY-MM-DD, which reaches both repositories" : "";
        errors.push(`${rev}: not a commit in ${label}${hint}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// Root-relative paths first added by the catch-up commits under hsdd/verify
// and openspec/changes, each queried in its own git working copy. A git
// failure is an error, never an empty set.
export function addedPaths(root, catchup, { git = runGit } = {}) {
  const out = new Set();
  const args = catchupArgs(catchup);
  if (!args.length) return out;
  for (const rel of ["hsdd/verify", "openspec/changes"]) {
    const cwd = gitCwdFor(root, rel + "/");
    const inCwd = relative(cwd, join(root, rel)) || ".";
    let text = "";
    try {
      text = git(cwd, ["log", "--diff-filter=A", "--name-only", "--format=", "--relative", ...args, "--", inCwd]);
    } catch (e) {
      throw new Error(`--catchup ${catchup} could not be evaluated for ${rel} (${e.message})`);
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const abs = join(cwd, line.trim());
      out.add(relative(root, abs));
    }
  }
  return out;
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function changeDirs(root) {
  const base = join(root, "openspec", "changes");
  const dirs = new Map();
  if (!existsSync(base)) return dirs;
  const add = (dir) => {
    if (!statSync(dir).isDirectory()) return;
    dirs.set(relative(root, dir), walk(dir).map((f) => relative(root, f)));
  };
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === "archive") {
      for (const a of readdirSync(join(base, "archive"), { withFileTypes: true })) if (a.isDirectory()) add(join(base, "archive", a.name));
    } else add(join(base, e.name));
  }
  return dirs;
}

export function readTree(root, { catchup = null, git = runGit } = {}) {
  const plan = extractPlan(root, { specSha: "n/a" });
  const phaseIds = plan.phases.map((p) => p.id).sort();
  const catchupAdded = addedPaths(root, catchup, { git });

  const docs = new Map();
  for (const id of phaseIds) {
    const path = `hsdd/verify/${id}.verification.md`;
    const full = join(root, path);
    const exists = existsSync(full);
    const text = exists ? readFileSync(full, "utf8") : "";
    docs.set(id, { path, exists, text, ...parseVerificationDoc(text), addedInCatchup: catchupAdded.has(path) });
  }

  const mgmt = join(root, "hsdd", "management");
  const intakes = [];
  for (const f of listMd(mgmt).filter((f) => /-intake-/.test(f))) {
    const path = `hsdd/management/${f}`;
    const text = readFileSync(join(root, path), "utf8");
    const rec = parseIntake(text, path, phaseIds);
    const cited = plan.phases.filter((p) => p.scope && p.scope.includes(path)).map((p) => p.id);
    intakes.push({ ...rec, cited, text });
  }

  let milestone = null;
  const msFiles = listMd(mgmt).filter((f) => /-milestones\.md$/.test(f)).sort();
  for (const f of msFiles.reverse()) {
    const path = `hsdd/management/${f}`;
    const text = readFileSync(join(root, path), "utf8");
    const m = parseMilestone(text, phaseIds);
    if (m.sealed) continue;
    milestone = { path, text, ...m };
    break;
  }

  let progressDone = new Set();
  const progress = listMd(mgmt).filter((f) => /-progress\.md$/.test(f)).sort();
  if (progress.length) progressDone = progressDoneSet(readFileSync(join(mgmt, progress[progress.length - 1]), "utf8"), phaseIds);

  const contextIds = new Set(phaseIds.filter((id) => existsSync(join(root, "hsdd-context", `${id}.md`)) || existsSync(join(root, "hsdd-context", "superpowers", `${id}.md`))));

  const openspecIds = new Set();
  const dirs = changeDirs(root);
  for (const [dir, files] of dirs) {
    if (files.length && files.every((f) => catchupAdded.has(f))) continue;
    const slug = dir.split("/").pop();
    for (const id of idsIn(slug, phaseIds)) openspecIds.add(id);
    for (const id of phaseIds) {
      const dashed = new RegExp(`(?<![\\w])${escapeRe(id.replace(/\./g, "-"))}(?![\\w]|-\\d)`);
      if (dashed.test(slug)) openspecIds.add(id);
    }
  }

  const pending = [];
  const dropped = new Set();
  const specTexts = new Map();
  for (const n of plan.nodes) {
    if (!n.sourceFile || specTexts.has(n.sourceFile) || !existsSync(join(root, n.sourceFile))) continue;
    const text = readFileSync(join(root, n.sourceFile), "utf8");
    specTexts.set(n.sourceFile, text);
    const pr = pendingRequests(text);
    if (pr.entries > 0) pending.push({ node: n.id, path: n.sourceFile, ...pr });
    for (const id of droppedPhaseIds(text, phaseIds)) dropped.add(id);
  }

  const convPath = join(root, "hsdd", "conventions.md");
  const convText = existsSync(convPath) ? readFileSync(convPath, "utf8") : "";

  let specSha = "n/a";
  try {
    specSha = git(gitCwdFor(root, "hsdd/"), ["rev-parse", "--short", "HEAD"]).trim() || "n/a";
  } catch {
    specSha = "n/a";
  }

  return {
    root,
    specSha,
    plan,
    phaseIds,
    docs,
    intakes,
    milestone,
    progressDone,
    contextIds,
    openspecIds,
    changeDirs: dirs,
    pending,
    dropped,
    specTexts,
    conventions: { path: "hsdd/conventions.md", text: convText, hasDropped: /Status:\*{0,2}\s*dropped|Status: dropped/.test(convText) },
    catchupAdded,
    unparsed: [...plan.unparsed],
  };
}
