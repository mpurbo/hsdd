// Reads of the repository through git only. Nothing here writes, checks out
// or stashes.
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { normalizeRepo, reservedIn } from "./record.mjs";

const MAX_BLOB = 2 * 1024 * 1024;

export const runGit = (cwd, args) => {
  const out = execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return out.endsWith("\n") ? out.slice(0, -1) : out;
};

export function resolveCommit(root, ref, git = runGit) {
  try {
    return git(root, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]) || null;
  } catch {
    return null;
  }
}

// Exit 1 means "not an ancestor"; anything else (128 is a bad ref) is an error.
export function isAncestor(root, a, b, git = runGit) {
  try {
    git(root, ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch (e) {
    if (e.status === 1) return false;
    throw e;
  }
}

// Oldest first, side branches included: no pathspec and no --first-parent,
// so a change that arrived through a merge is a candidate in its own right.
export function rangeCommits(root, from, to, git = runGit) {
  const ids = git(root, ["rev-list", "--reverse", "--topo-order", `${from}..${to}`]).split("\n").filter(Boolean);
  return ids.flatMap((id) => {
    const [sha, parents, date, subject, message] = git(root, ["show", "-s", "--format=%H%x00%P%x00%cs%x00%s%x00%B", id]).split("\0");
    const parentList = parents.split(" ").filter(Boolean);
    const paths = git(root, ["diff-tree", "--no-commit-id", "--root", "-r", "--name-only", "--no-renames", "-z", "--relative", id]).split("\0").filter(Boolean);
    if (parentList.length < 2 && paths.length === 0) return [];
    return [{ sha, parents: parentList, date, subject, message: message.trim(), paths }];
  });
}

// The blob at `path` (relative to the project root) as of `sha`, or null when
// it is absent, not a blob, or over 2 MB.
export function showAt(root, sha, path) {
  const spec = `${sha}:./${path}`;
  const git = (args, encoding) => execFileSync("git", args, { cwd: root, encoding, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  try {
    if (git(["cat-file", "-t", spec], "utf8").trim() !== "blob") return null;
    if (Number(git(["cat-file", "-s", spec], "utf8")) > MAX_BLOB) return null;
    return git(["show", spec], "buffer");
  } catch {
    return null;
  }
}

// A refusal the CLI prints as a message and exits 1 on, not a crash.
export class Refusal extends Error {}

const lastSegment = (url) => url.trim().replace(/\/+$/, "").replace(/\.git$/, "").split(/[/:]/).filter(Boolean).at(-1) ?? "";

// --repo, else origin's last path segment (the same on every clone), else the
// top-level directory's name.
export function repoName(root, given, git = runGit) {
  const fromOrigin = () => {
    try {
      return lastSegment(git(root, ["remote", "get-url", "origin"])) || null;
    } catch {
      return null;
    }
  };
  const [raw, named] = given
    ? [given, "--repo"]
    : (() => {
        const o = fromOrigin();
        return o ? [o, "origin"] : [basename(git(root, ["rev-parse", "--show-toplevel"])), "directory"];
      })();
  const name = normalizeRepo(raw);
  const word = reservedIn(name);
  if (word) throw new Refusal(`the repository name "${name}" contains "${word}", which hsdd reads as a report or an intake record; pass --repo with another name`);
  return { name, named };
}
