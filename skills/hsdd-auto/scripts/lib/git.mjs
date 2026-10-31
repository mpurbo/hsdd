// git wrapper. Arguments are always an array and never pass through a shell.
import { spawnSync } from "node:child_process";

export class GitError extends Error {
  constructor(args, stderr, status) {
    super(`git ${args.join(" ")} failed${status === null ? "" : ` (${status})`}: ${stderr.trim()}`);
    this.name = "GitError";
    this.stderr = stderr;
    this.status = status;
  }
}

const raw = (repoRoot, args, input) => {
  const r = spawnSync("git", args, { cwd: repoRoot, input, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.error) return { ok: false, stdout: "", stderr: String(r.error.message), status: null };
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, status: r.status };
};

const chomp = (s) => (s.endsWith("\n") ? s.slice(0, -1) : s);

export const git = (repoRoot, args, { allowFail = false, input } = {}) => {
  const r = raw(repoRoot, args, input);
  if (r.ok) return chomp(r.stdout);
  if (allowFail) return null;
  throw new GitError(args, r.stderr, r.status);
};

const nulList = (s) => (s === null ? [] : s.split("\0").filter((x) => x !== ""));
const uniqSorted = (xs) => [...new Set(xs)].sort();

export const headSha = (repoRoot, { short = true } = {}) =>
  git(repoRoot, ["rev-parse", ...(short ? ["--short"] : []), "--verify", "-q", "HEAD"], { allowFail: true });

export const currentBranch = (repoRoot) => git(repoRoot, ["symbolic-ref", "--short", "-q", "HEAD"], { allowFail: true });

export const branchExists = (repoRoot, name) =>
  raw(repoRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${name}`]).ok;

export const changedPaths = (repoRoot) => {
  const entries = nulList(git(repoRoot, ["status", "--porcelain=v1", "-z", "-uall"]));
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    out.push(e.slice(3));
    // a rename or copy is followed by its source path
    if (e[0] === "R" || e[0] === "C" || e[1] === "R" || e[1] === "C") out.push(entries[++i]);
  }
  return uniqSorted(out);
};

export const indexEmpty = (repoRoot) => git(repoRoot, ["diff", "--cached", "--name-only"]) === "";

export const headSubject = (repoRoot) => git(repoRoot, ["log", "-1", "--format=%s"], { allowFail: true });

export const commitStamp = (repoRoot, rev) => {
  const ct = Number(git(repoRoot, ["log", "-1", "--format=%ct", rev]));
  return new Date(ct * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
};

// The exact file content (no trimming), or null when the path is not in the revision.
export const showFile = (repoRoot, rev, path) => {
  const r = raw(repoRoot, ["show", `${rev}:${path}`]);
  return r.ok ? r.stdout : null;
};

export const revExists = (repoRoot, rev) => raw(repoRoot, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).ok;

// Repository-relative paths of the entries directly under dir at rev ([] when dir is missing).
export const listTree = (repoRoot, rev, dir) => {
  const d = `${dir.replace(/\/+$/, "")}/`;
  return nulList(git(repoRoot, ["ls-tree", "--name-only", "-z", rev, d], { allowFail: true }));
};

// Paths that differ between rev and the working tree, plus untracked files.
export const changedSince = (repoRoot, rev) => {
  const tracked = nulList(git(repoRoot, ["diff", "--name-only", "--no-renames", "-z", rev]));
  const untracked = nulList(git(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]));
  return uniqSorted([...tracked, ...untracked]);
};

// Local branches whose tree at their tip holds the path, in refname order ([] outside a repository).
export const branchesHolding = (repoRoot, path) => {
  const refs = git(repoRoot, ["for-each-ref", "--format=%(refname:short)", "refs/heads"], { allowFail: true });
  return (refs ?? "").split("\n").filter(Boolean).filter((b) => raw(repoRoot, ["cat-file", "-e", `${b}:${path}`]).ok);
};
