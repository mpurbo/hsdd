#!/usr/bin/env node
// hsdd-intake sweep: classify the commits a repository took since its last
// sweep record, and write the record. Reads the repository through git only.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Refusal } from "./lib/git.mjs";
import { draft } from "./lib/draft.mjs";

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

export function main(argv, root = process.cwd(), out = { log: console.log, error: console.error }) {
  if (argv[0] !== "draft") {
    out.log(USAGE);
    return 2;
  }
  try {
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
