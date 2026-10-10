import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOCATIONS = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];

// The first CODEOWNERS path that exists under root, or null. Repository
// metadata: read from disk, not from the walked file list.
export function ownersFile(root) {
  for (const file of LOCATIONS) {
    try { readFileSync(join(root, file), "utf8"); return file; } catch { /* next */ }
  }
  return null;
}

// Every parsed rule in file order. A pattern with no owners is a rule with
// owners [] (it makes its files unowned). `files` is unused.
export function owners(root, files) {
  const file = ownersFile(root);
  if (!file) return [];
  const rules = [];
  for (const raw of readFileSync(join(root, file), "utf8").split("\n")) {
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
  const re = new RegExp(`^${anchored ? "" : "(?:.*/)?"}${globToSource(body)}${dirOnly ? "/.*" : "(?:/.*)?"}$`);
  return (path) => re.test(path);
}

// The applicable rule for a file is the last rule in file order that matches
// it. Returns that rule, or null.
export function ownersOf(rules, path) {
  let hit = null;
  for (const r of rules) if (matcher(r.pattern)(path)) hit = r;
  return hit;
}
