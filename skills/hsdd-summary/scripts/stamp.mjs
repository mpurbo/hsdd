// Input stamps: which files a page was built from, and whether they changed.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { listMd } from "./extract-plan.mjs";

export function fileHash(path) {
  return "sha256:" + createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Every file the plan page reads, relative to the project root, sorted.
export function planInputs(root) {
  const out = [];
  if (existsSync(join(root, "hsdd/conventions.md"))) out.push("hsdd/conventions.md");
  for (const dir of ["spec", "contract", "adr"]) for (const f of listMd(join(root, "hsdd", dir))) out.push(`hsdd/${dir}/${f}`);
  for (const f of ["glossary.json", "prose.json"]) if (existsSync(join(root, "hsdd/summary", f))) out.push(`hsdd/summary/${f}`);
  return out.sort();
}

export function hashInputs(root, paths) {
  return Object.fromEntries(paths.map((p) => [p, fileHash(join(root, p))]));
}

export function diffInputs(stamped, current) {
  const changed = [];
  const added = [];
  const removed = [];
  for (const [p, h] of Object.entries(current)) {
    if (!(p in stamped)) added.push(p);
    else if (stamped[p] !== h) changed.push(p);
  }
  for (const p of Object.keys(stamped)) if (!(p in current)) removed.push(p);
  return { changed, added, removed, fresh: !changed.length && !added.length && !removed.length };
}

// JSON that is safe inside a <script> element: no "<", ">", "&" or line
// separators survive literally, and JSON.parse still reads it back exactly.
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function readPageStamp(html) {
  const m = /<script type="application\/json" id="hsdd-stamp">([^<]*)<\/script>/.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
