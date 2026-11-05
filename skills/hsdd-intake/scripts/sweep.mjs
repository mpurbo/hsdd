#!/usr/bin/env node
// hsdd-intake sweep: classify the commits a repository took since its last
// sweep record, and write the record. Reads the repository through git only.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const USAGE = "usage: sweep.mjs draft | check | commit\n" +
  "  draft  [--from SHA] [--to REF] [--main BRANCH] [--repo NAME] [--run-by NAME] [--today YYYY-MM-DD] [--write]\n" +
  "  check  hsdd/management/DATE-sweep-REPO-SHA7.md\n" +
  "  commit hsdd/management/DATE-sweep-REPO-SHA7.md";

export function main(argv, root = process.cwd(), out = { log: console.log, error: console.error }) {
  out.log(USAGE);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
