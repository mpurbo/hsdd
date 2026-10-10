import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOCATIONS = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];

// Repository metadata: read from disk under root, not from the walked file list,
// so it is found even when a prefix excludes it. `files` is accepted for a
// uniform signature and is unused.
export function owners(root, files) {
  for (const file of LOCATIONS) {
    let text;
    try { text = readFileSync(join(root, file), "utf8"); } catch { continue; }
    const rules = [];
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const tokens = line.split(/\s+/);
      const hash = tokens.findIndex((t) => t.startsWith("#"));
      const live = hash < 0 ? tokens : tokens.slice(0, hash);
      if (live.length < 2) continue;
      rules.push({ pattern: live[0], owners: live.slice(1), file });
    }
    return rules;
  }
  return [];
}
