#!/usr/bin/env node
// hsdd-seal: seal a released HSDD tree by script. Run from the project root
// (the directory that holds hsdd/). Every write is computed first and shown
// as a dry run; --write applies it.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const USAGE = "usage: seal.mjs plan | apply sign|drop|prune|close | report\n" +
  "  plan   --release R --date YYYY-MM-DD --owner NAME --evidence TEXT [--catchup REVSPEC|since:YYYY-MM-DD|SHA,SHA] [--keep id,id] [--today YYYY-MM-DD]\n" +
  "  apply  sign|drop|prune|close --plan hsdd/management/DATE-seal-plan.json [--write] [--commit]\n" +
  "  report --plan hsdd/management/DATE-seal-plan.json [--write]";

export function main(argv, root = process.cwd(), out = { log: console.log, error: console.error }) {
  const [cmd] = argv;
  out.log(USAGE);
  return cmd ? 2 : 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
