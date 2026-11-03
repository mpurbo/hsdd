// The prune step: remove OpenSpec change directories the catch-up invented.
// A directory goes only when every file in it was first added by the catch-up
// commits; openspec/specs/ is never touched.
import { existsSync } from "node:fs";
import { join } from "node:path";

export function prunableDirs(added, filesByDir) {
  const out = [];
  for (const [dir, files] of filesByDir) {
    if (files.length && files.every((f) => added.has(f))) out.push(dir);
  }
  return out.sort();
}

export function opsPrune(plan, tree) {
  const ops = [];
  for (const entry of plan.prune ?? []) {
    if (!/^openspec\/changes\//.test(entry.dir)) continue;
    if (!existsSync(join(tree.root, entry.dir))) continue;
    ops.push({ kind: "delete", path: entry.dir, note: `${entry.files.length} file(s) the catch-up added` });
  }
  return ops;
}
