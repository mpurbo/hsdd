import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const EXCLUDED_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build", "target", ".next", "coverage", "__pycache__", ".venv", "venv"]);

const MAX_BYTES = 2 * 1024 * 1024;
const MODULE_ROOTS = new Set(["src", "lib", "app", "apps", "cmd", "pkg", "internal", "services", "packages"]);

// "./src/billing/" -> "src/billing"; "." and "" -> "" (no restriction).
export function normalizePrefix(p) {
  return String(p).replace(/\\/g, "/").split("/").filter((s) => s && s !== ".").join("/");
}

// The module rule. Directory segments only: a file's own name is never a module.
// depth 2: the first two directory segments when the first is a conventional
// source root, else the first. depth 1: the first segment. Root-level files: null.
export function moduleOf(path, depth = 2) {
  const dirs = path.split("/").slice(0, -1);
  if (dirs.length === 0) return null;
  if (depth >= 2 && MODULE_ROOTS.has(dirs[0]) && dirs.length >= 2) return `${dirs[0]}/${dirs[1]}`;
  return dirs[0];
}

// Files only, repo-relative with "/" separators, sorted. Symbolic links are not
// followed or listed; files over 2 MB are skipped.
export function walk(root, { prefixes = [] } = {}) {
  const wanted = prefixes.map(normalizePrefix).filter(Boolean);
  const out = [];
  const visit = (rel) => {
    for (const e of readdirSync(rel ? join(root, rel) : root, { withFileTypes: true })) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!EXCLUDED_DIRS.has(e.name)) visit(path);
      } else if (e.isFile()) {
        if (statSync(join(root, path)).size <= MAX_BYTES) out.push(path);
      }
    }
  };
  visit("");
  const kept = wanted.length === 0 ? out : out.filter((f) => wanted.some((p) => f === p || f.startsWith(`${p}/`)));
  return kept.sort();
}
