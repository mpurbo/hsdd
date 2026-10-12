import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// GitHub's lookup order. `.gitlab/CODEOWNERS` and backslash-escaped spaces in
// patterns are out of scope.
const LOCATIONS = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];

// Where CODEOWNERS lives: the git top level that contains root, where GitHub
// reads it, and root's own path inside that top level ("" at the top, e.g.
// "services/payouts/" for a subproject). Outside git, root itself.
export function ownersBase(root) {
  try {
    const [dir, prefix = ""] = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel", "--show-prefix"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n");
    return { dir, prefix };
  } catch {
    return { dir: root, prefix: "" };
  }
}

// The first CODEOWNERS path that exists under the base, or null. Repository
// metadata: read from disk, not from the walked file list.
export function ownersFile(root, base = ownersBase(root)) {
  for (const file of LOCATIONS) {
    try { readFileSync(join(base.dir, file), "utf8"); return file; } catch { /* next */ }
  }
  return null;
}

// Every parsed rule in file order. A pattern with no owners is a rule with
// owners [] (it makes its files unowned). Patterns match paths relative to the
// base, so callers prefix root-relative paths with base.prefix. `files` is
// unused.
export function owners(root, files, base = ownersBase(root)) {
  const file = ownersFile(root, base);
  if (!file) return [];
  const rules = [];
  for (const raw of readFileSync(join(base.dir, file), "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    const hash = tokens.findIndex((t) => t.startsWith("#"));
    const live = hash < 0 ? tokens : tokens.slice(0, hash);
    if (live.length < 1) continue;
    rules.push({ pattern: live[0], owners: live.slice(1), file });
  }
  return rules;
}

function globToSource(body) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "*" && body[i + 1] === "*") {
      if (body[i + 2] === "/") { out += "(?:.*/)?"; i += 2; } else { out += ".*"; i += 1; }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return out;
}

function matcher(pattern) {
  const dirOnly = pattern.endsWith("/");
  const anchored = pattern.startsWith("/") || pattern.slice(0, -1).includes("/");
  const body = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
  // A literal last segment may name a directory, so it matches below it; a glob
  // last segment (docs/*) matches one level only.
  const literalLast = !/[*?]/.test(body.split("/").pop());
  const re = new RegExp(`^${anchored ? "" : "(?:.*/)?"}${globToSource(body)}${dirOnly ? "/.*" : literalLast ? "(?:/.*)?" : ""}$`);
  return (path) => re.test(path);
}

const compiled = new Map();
const matcherFor = (pattern) => {
  if (!compiled.has(pattern)) compiled.set(pattern, matcher(pattern));
  return compiled.get(pattern);
};

// The applicable rule for a file is the last rule in file order that matches
// it. Returns that rule, or null.
export function ownersOf(rules, path) {
  let hit = null;
  for (const r of rules) if (matcherFor(r.pattern)(path)) hit = r;
  return hit;
}
