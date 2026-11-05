#!/usr/bin/env node
// hsdd-intake sweep: classify the commits a repository took since its last
// sweep record, and write the record. Reads the repository through git only.
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Refusal, runGit, gitCwdFor, detachedCwds, commitPaths } from "./lib/git.mjs";
import { parseRecord } from "./lib/record.mjs";
import { draft } from "./lib/draft.mjs";
import { check } from "./lib/check.mjs";

export const USAGE = "usage: sweep.mjs draft | check | commit\n" +
  "  draft  [--from SHA] [--to REF] [--main BRANCH] [--repo NAME] [--run-by NAME] [--today YYYY-MM-DD] [--write]\n" +
  "  check  hsdd/management/DATE-sweep-REPO-SHA7.md\n" +
  "  commit hsdd/management/DATE-sweep-REPO-SHA7.md";

const VALUED = new Set("to from main repo run-by today".split(" "));
const FLAGS = new Set(["write"]);

export function parseArgs(argv) {
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i].startsWith("--") ? argv[i].slice(2) : null;
    if (key && FLAGS.has(key)) opts[key] = true;
    else if (key && VALUED.has(key)) opts[key] = argv[++i] ?? "";
    else throw new Refusal(`unexpected argument ${argv[i]}`);
  }
  return opts;
}

// Spec 7.4: run check, then commit the record alone. Never pushes.
export function commit(root, path, out, git = runGit) {
  if (check(root, path, out) !== 0) return 1;
  const rel = relative(root, resolve(root, path));
  const detached = detachedCwds(root, [rel], git);
  if (detached.length > 0) {
    out.error(`${relative(root, detached[0]) || detached[0]} is on a detached HEAD; check out a branch there before committing, or the commit is orphaned by the next submodule update`);
    return 1;
  }
  const r = parseRecord(readFileSync(resolve(root, path), "utf8"));
  const message = `sweep: ${r.repo} ${r.from.slice(0, 7)}..${r.to.slice(0, 7)}`;
  const cwd = gitCwdFor(root, rel);
  const sub = cwd === root ? null : relative(root, cwd);
  const committed = commitPaths(root, [rel], message, git);
  // A retry after a rejected pointer commit: the record is committed in the
  // submodule and the root's gitlink is stale. commitPaths bumps only what it
  // committed in this call, so compare the gitlink with the submodule's HEAD.
  let bumped = false;
  if (sub && committed.length === 0) {
    const gitlink = git(root, ["ls-tree", "HEAD", "--", sub]).split(/\s+/)[2];
    if (gitlink !== git(cwd, ["rev-parse", "HEAD"])) {
      git(root, ["add", "--", sub]);
      git(root, ["commit", "-q", "-m", `${message} (pointer)`, "--", sub]);
      bumped = true;
    }
  }
  const branchOf = (dir) => git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const rootBranch = branchOf(root);
  if (committed.length === 0 && !bumped) {
    out.log(`nothing to commit: ${rel} is already committed`);
    return 0;
  }
  if (!sub) out.log(`committed on ${rootBranch}`);
  else if (bumped) out.log(`bumped the pointer on ${rootBranch}; the record was already committed in ${sub} on ${branchOf(cwd)}`);
  else out.log(`committed on ${branchOf(cwd)} in ${sub}; pointer on ${rootBranch}`);
  const mainLine = r.main ?? "main";
  if (rootBranch !== mainLine) out.log(`note: ${rootBranch} is not ${mainLine}; the next sweep reads records from wherever this lands`);
  return 0;
}

export function main(argv, root = process.cwd(), out = { log: console.log, error: console.error }) {
  if (!["draft", "check", "commit"].includes(argv[0])) {
    out.log(USAGE);
    return 2;
  }
  try {
    if (argv[0] === "check") return check(root, argv[1], out);
    if (argv[0] === "commit") {
      if (argv.length > 2) throw new Refusal(`unexpected argument ${argv[2]}; commit takes only the record path`);
      return commit(root, argv[1], out);
    }
    return draft(root, parseArgs(argv), out);
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    out.error(e.message);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
