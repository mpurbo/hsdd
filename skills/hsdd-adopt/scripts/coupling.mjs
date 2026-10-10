import { execFileSync } from "node:child_process";
import { EXCLUDED_DIRS, moduleOf, normalizePrefix } from "./walk.mjs";

export function coupling(root, { depth = 2, commits = 500, min = 2, maxFiles = 50, prefixes = [] } = {}) {
  const specs = prefixes.map(normalizePrefix).filter(Boolean);
  let log;
  try {
    log = execFileSync(
      "git",
      ["-C", root, "-c", "core.quotepath=false", "log", "--numstat", "--no-renames", "--relative", "--format=%H", "-n", String(commits), "--", ...(specs.length ? specs : ["."])],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 512 * 1024 * 1024 },
    );
  } catch {
    return [];
  }
  const perCommit = [];
  for (const line of log.split("\n")) {
    if (/^[0-9a-f]{40,64}$/.test(line)) perCommit.push([]);
    else if (line && perCommit.length) perCommit[perCommit.length - 1].push(line.split("\t").slice(2).join("\t"));
  }
  const counts = new Map();
  for (const paths of perCommit) {
    if (paths.length > maxFiles) continue;
    const mods = new Set();
    for (const p of paths) {
      if (p.split("/").some((s) => EXCLUDED_DIRS.has(s))) continue;
      const m = moduleOf(p, depth);
      if (m) mods.add(m);
    }
    const list = [...mods].sort();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]}\0${list[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts]
    .map(([k, count]) => { const [a, b] = k.split("\0"); return { a, b, count }; })
    .filter((p) => p.count >= min)
    .sort((x, y) => y.count - x.count || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0) || (x.b < y.b ? -1 : x.b > y.b ? 1 : 0));
}
