// The prune step: remove OpenSpec change directories the catch-up invented.
// A directory goes only when every file in it was first added by the catch-up
// commits, as the fresh scan sees it; openspec/specs/ is never touched.

export function prunableDirs(added, filesByDir) {
  const out = [];
  for (const [dir, files] of filesByDir) {
    if (files.length && files.every((f) => added.has(f))) out.push(dir);
  }
  return out.sort();
}

// Exactly openspec/changes/{name} or openspec/changes/archive/{name}.
export function isChangeDir(dir) {
  const seg = String(dir).split("/");
  const name = seg[seg.length - 1];
  if (!name || name === "." || name === ".." || name === "archive") return false;
  if (seg.length === 3) return seg[0] === "openspec" && seg[1] === "changes";
  if (seg.length === 4) return seg[0] === "openspec" && seg[1] === "changes" && seg[2] === "archive";
  return false;
}

export function opsPrune(plan, tree) {
  const ops = [];
  const dirs = tree.changeDirs ?? new Map();
  for (const entry of plan.prune ?? []) {
    const dir = entry?.dir;
    if (!isChangeDir(dir) || !dirs.has(dir)) continue;
    const files = dirs.get(dir);
    if (!files.length || !files.every((f) => tree.catchupAdded.has(f))) continue;
    ops.push({ kind: "delete", path: dir, note: `${files.length} file(s) the catch-up added` });
  }
  return ops;
}
