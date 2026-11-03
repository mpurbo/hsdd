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

function sectionBody(ls, title) {
  const sec = sections(ls, 2).find((s) => new RegExp(`^${title}`, "i").test(sectionName(s.title)));
  return sec ? { lines: ls.slice(sec.start, sec.end), sec } : null;
}

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

function headerField(ls, name) {
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

export function parseMilestone(text, phaseIds) {
  const ls = toLines(text);
  const ms = sectionBody(ls, "milestones");
  const from = ms ? ms.sec.start : 0;
  const to = ms ? ms.sec.end : ls.length;
  const gates = [];
  for (let i = from; i < to; i++) {
    const m = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(ls[i]);
    if (m) gates.push({ line: i, checked: m[1] !== " ", text: m[2].trim(), phases: idsIn(m[2], phaseIds) });
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
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

// Root-relative paths first added by the catch-up commits under hsdd/verify
// and openspec/changes, each queried in its own git working copy.
export function addedPaths(root, catchup, { git = runGit } = {}) {
  const out = new Set();
  const args = catchupArgs(catchup);
  if (!args.length) return out;
  for (const rel of ["hsdd/verify", "openspec/changes"]) {
    const cwd = gitCwdFor(root, rel + "/");
    const inCwd = relative(cwd, join(root, rel)) || ".";
    let text = "";
    try {
      text = git(cwd, ["log", "--diff-filter=A", "--name-only", "--format=", ...args, "--", inCwd]);
    } catch {
      continue;
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
    for (const id of phaseIds) {
      if (slug.includes(id) || slug.includes(id.replace(/\./g, "-"))) openspecIds.add(id);
    }
  }

  const pending = [];
  const dropped = new Set();
  const seen = new Set();
  for (const n of plan.nodes) {
    if (!n.sourceFile || seen.has(n.sourceFile) || !existsSync(join(root, n.sourceFile))) continue;
    seen.add(n.sourceFile);
    const text = readFileSync(join(root, n.sourceFile), "utf8");
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
    conventions: { path: "hsdd/conventions.md", text: convText, hasDropped: /Status:\*{0,2}\s*dropped|Status: dropped/.test(convText) },
    catchupAdded,
    unparsed: [...plan.unparsed],
  };
}
