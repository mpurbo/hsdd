// For each candidate citation-touch target, evaluate the run's own `cites-superseded`
// condition (hsdd/scripts/auto/lib/intake.mjs) and print which superseded string matched
// in which file, with the matching line, so a textual hit can be told from a real citation.
// Usage: node probe.mjs <repoRoot>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.argv[2];
const lib = (m) => import(pathToFileURL(join(repoRoot, "hsdd/scripts/auto/lib", m)).href);
const { loadConfig } = await lib("config.mjs");
const { resolveLayout } = await lib("paths.mjs");
const { loadTree } = await lib("tree.mjs");
const { supersededStrings, citesSuperseded, targetFiles } = await lib("intake.mjs");

const config = loadConfig(repoRoot);
const layout = resolveLayout(repoRoot);
const tree = loadTree(repoRoot, layout, { root: config.root });
const strings = supersededStrings(config, tree);
console.log("plain:", JSON.stringify(strings.plain));
console.log("refs:", strings.refs.map((r) => r.re.source).join(" | "));

const candidates = [
  ["citation-touch", "simple-login"],
  ["citation-touch", "simple-login.backend"],
  ["citation-touch", "simple-login.web"],
  ["citation-touch", "simple-login.integration"],
  ["citation-touch", "ADR-001"],
  ["citation-touch", "auth-api"],
  ["citation-touch", "profile-api"],
  ["citation-touch", "profile-api.v2"],
];
for (const [kind, target] of candidates) {
  const files = targetFiles(kind, target, layout, tree);
  const holds = citesSuperseded(repoRoot, files, strings);
  console.log(`\n${target}: cites-superseded ${holds ? "HOLDS" : "does not hold"} over ${files.length} file(s)`);
  for (const rel of files) {
    let text;
    try { text = readFileSync(join(repoRoot, rel), "utf8"); } catch { continue; }
    const lines = text.split("\n");
    lines.forEach((l, i) => {
      const plain = strings.plain.filter((s) => l.includes(s));
      const refs = strings.refs.filter((r) => !r.except.has(rel) && r.re.test(l)).map((r) => r.re.source);
      if (plain.length + refs.length > 0) console.log(`  ${rel}:${i + 1} [${[...plain, ...refs.map(() => "version 1 token")].join(", ")}] ${l.trim().slice(0, 100)}`);
    });
  }
}
