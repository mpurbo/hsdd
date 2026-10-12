import { readdirSync, statSync, lstatSync } from "node:fs";
import { join } from "node:path";

export const EXCLUDED_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build", "target", ".next", "coverage", "__pycache__", ".venv", "venv"]);
// HSDD's own governance and generated contexts, skipped at the top level only.
export const EXCLUDED_TOP = new Set(["hsdd", "hsdd-context", "openspec"]);

// True when a repo-relative path lies in a directory the walk never enters.
export function excludedPath(path) {
  const segs = path.split("/");
  return (segs.length > 1 && EXCLUDED_TOP.has(segs[0])) || segs.slice(0, -1).some((s) => EXCLUDED_DIRS.has(s));
}

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
// followed or listed; files over 2 MB are skipped; unreadable directories and
// files are skipped and reported through onSkip(path). With prefixes, the walk
// starts at each prefix and never visits, or reports on, anything outside them.
export function walk(root, { prefixes = [], onSkip = () => {} } = {}) {
  const wanted = prefixes.map(normalizePrefix).filter(Boolean);
  const out = new Set();
  const file = (path) => {
    try {
      if (statSync(join(root, path)).size <= MAX_BYTES) out.add(path);
    } catch {
      onSkip(path);
    }
  };
  const visit = (rel) => {
    let entries;
    try {
      entries = readdirSync(rel ? join(root, rel) : root, { withFileTypes: true });
    } catch {
      onSkip(rel || ".");
      return;
    }
    for (const e of entries) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!EXCLUDED_DIRS.has(e.name) && !(rel === "" && EXCLUDED_TOP.has(e.name))) visit(path);
      } else if (e.isFile()) file(path);
    }
  };
  if (wanted.length === 0) visit("");
  for (const prefix of wanted) {
    const segs = prefix.split("/");
    if (segs.includes("..") || excludedPath(`${prefix}/x`)) continue;
    // Every segment above the prefix must be a real directory (never a
    // symbolic link), as a whole walk would have reached it; the prefix itself
    // may be a directory or a file.
    for (let i = 1; i <= segs.length; i++) {
      const path = segs.slice(0, i).join("/");
      let st;
      try {
        st = lstatSync(join(root, path));
      } catch (e) {
        if (e.code !== "ENOENT" && e.code !== "ENOTDIR") onSkip(path);
        break;
      }
      if (i < segs.length) {
        if (!st.isDirectory()) break;
      } else if (st.isDirectory()) visit(path);
      else if (st.isFile()) file(path);
    }
  }
  return [...out].sort();
}
