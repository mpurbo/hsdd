// Fixed record paths, layout resolution (spec 4.2), globs and the judgement set (spec 6.11).
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const P = Object.freeze({
  runYaml: "hsdd/auto/run.yaml",
  plan: "hsdd/auto/plan.md",
  queue: "hsdd/auto/queue.jsonl",
  handoffs: "hsdd/auto/handoffs.jsonl",
  ownerFiles: "hsdd/auto/owner-files.json",
  adapter: "hsdd/auto/adapter.json",
  dispatchDir: "hsdd/auto/dispatch",
  stepsDir: "hsdd/auto/steps",
  decideLock: "hsdd/auto/.decide.lock",
  ledger: "hsdd/judgement/decisions.jsonl",
  runLog: "hsdd/judgement/run.jsonl",
  reviews: "hsdd/judgement/decision-reviews.jsonl",
  stop: "hsdd/judgement/STOP.md",
  scriptsAuto: "hsdd/scripts/auto",
  genRegistry: "hsdd/scripts/gen-registry.mjs",
  conventions: "hsdd/conventions.md",
});

export const stepPaths = (step) => ({
  dispatch: `${P.dispatchDir}/${step}.md`,
  report: `${P.stepsDir}/${step}.json`,
  decisions: `${P.stepsDir}/${step}.decisions.jsonl`,
});

// n = 0 is the first report of the series; n >= 1 is the report after the nth resume.
export const reportPath = (step, n) => `${P.stepsDir}/${step}${n === 0 ? "" : `.r${n}`}.json`;

// ---------- layout (4.2) ----------

const DEFAULT_LAYOUT = Object.freeze({
  spec: "hsdd/spec",
  contract: "hsdd/contract",
  adr: "hsdd/adr",
  management: "hsdd/management",
  verify: "hsdd/verify",
});

const dirOf = (path) => {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
};

const stripSlash = (p) => p.replace(/\/+$/, "");

// Pure: the layout a conventions text declares, defaults for the rest.
export const parseLayout = (text) => {
  const layout = { ...DEFAULT_LAYOUT };
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Layout/.test(l));
  if (start >= 0) {
    const seen = new Set();
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^#{1,2}\s/.test(l)) break;
      if (!/^\s*[-*+]\s/.test(l)) continue;
      const m = /`([^`]+)`/.exec(l);
      if (!m) continue;
      const p = m[1];
      const set = (key, value) => { if (!seen.has(key) && value !== "") { seen.add(key); layout[key] = value; } };
      if (p.endsWith("{node-id}.md")) set("spec", dirOf(p));
      else if (p.endsWith("{slug}.md")) set("contract", dirOf(p));
      else if (p.endsWith("{nnn}-{title}.md")) set("adr", dirOf(p));
      else if (p.endsWith("{phase-id}.verification.md")) set("verify", dirOf(p));
      else if (p.endsWith("management/")) set("management", stripSlash(p));
    }
  }
  return { ...layout, relocated: layout.contract !== DEFAULT_LAYOUT.contract || layout.adr !== DEFAULT_LAYOUT.adr };
};

export const resolveLayout = (repoRoot) => {
  const file = join(repoRoot, P.conventions);
  return parseLayout(existsSync(file) ? readFileSync(file, "utf8") : "");
};

// ---------- globs ----------

const escapeRe = (s) => s.replace(/[.+^${}()|[\]\\?]/g, "\\$&");

export const globToRegExp = (pattern) => {
  if (pattern.endsWith("/")) return new RegExp(`^${escapeRe(pattern)}.+$`);
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") { out += "(?:.*/)?"; i += 2; } else { out += ".*"; i += 1; }
    } else if (c === "*") out += "[^/]*";
    else out += escapeRe(c);
  }
  return new RegExp(`^${out}$`);
};

export const matchesAny = (path, patterns) => patterns.some((p) => globToRegExp(p).test(path));

export const expandHome = (p) => (p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

// 6.11: what the judgement commit may hold for a step.
export const judgementSet = (step) => [
  P.ledger,
  P.runLog,
  `${P.stepsDir}/${step}.*`,
  `${P.stepsDir}/${step}.lost*`,
  `${P.stepsDir}/${step}.invalid*`,
  stepPaths(step).dispatch,
  P.queue,
  P.handoffs,
  P.plan,
  P.stop,
];
