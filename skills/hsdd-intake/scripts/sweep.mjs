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
  "  commit hsdd/management/DATE-sweep-REPO-SHA7.md [--main BRANCH]";

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
export function commit(root, path, opts, out, git = runGit) {
  if (check(root, path, out) !== 0) return 1;
  const rel = relative(root, resolve(root, path));
  const detached = detachedCwds(root, [rel], git);
  if (detached.length > 0) {
    out.error(`${relative(root, detached[0]) || detached[0]} is on a detached HEAD; check out a branch there before committing, or the commit is orphaned by the next submodule update`);
    return 1;
  }
  const r = parseRecord(readFileSync(resolve(root, path), "utf8"));
  const committed = commitPaths(root, [rel], `sweep: ${r.repo} ${r.from.slice(0, 7)}..${r.to.slice(0, 7)}`, git);
  if (committed.length === 0) {
    out.log(`nothing to commit: ${rel} is already committed`);
    return 0;
  }
  const branch = git(gitCwdFor(root, rel), ["rev-parse", "--abbrev-ref", "HEAD"]);
  const main = opts.main ?? "main";
  out.log(`committed on ${branch}`);
  if (branch !== main) out.log(`note: ${branch} is not ${main}; the next sweep reads records from wherever this lands`);
  return 0;
}

export function main(argv, root = process.cwd(), out = { log: console.log, error: console.error }) {
  if (!["draft", "check", "commit"].includes(argv[0])) {
    out.log(USAGE);
    return 2;
  }
  try {
    if (argv[0] === "check") return check(root, argv[1], out);
    if (argv[0] === "commit") return commit(root, argv[1], parseArgs(["commit", ...argv.slice(2)]), out);
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
