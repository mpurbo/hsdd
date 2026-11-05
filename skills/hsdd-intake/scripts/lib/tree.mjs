// The spec tree as sweep needs it: nodes, phases, the path prefixes each live
// node's Observed surface claims, and the shas phases' Scopes cite.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractPlan } from "../extract-plan.mjs";
import { parseObservedSurface } from "../diff.mjs";
import { toLines, headings } from "../md.mjs";
import { isRecordFile, parseRecord } from "./record.mjs";
import { shaTokensIn } from "./candidates.mjs";

// The ids among `ids` whose phase section carries `- **Status:** dropped`.
export function droppedIn(text, ids) {
  const ls = toLines(text);
  const hs = headings(ls).filter((h) => h.level <= 3);
  return ids.filter((id) => {
    const at = hs.findIndex((h) => h.level === 3 && h.text.startsWith(`${id}:`));
    if (at < 0) return false;
    const end = hs[at + 1]?.line ?? ls.length;
    return ls.slice(hs[at].line, end).some((l) => /^\s*-\s+\*\*Status:\*\*\s+dropped\b/.test(l));
  });
}

export function readTree(root) {
  const plan = extractPlan(root);
  const nodes = new Map(plan.nodes.map((n) => [n.id, { id: n.id, kind: n.kind, status: n.status, adopted: n.adopted }]));
  const scopes = plan.nodes
    .filter((n) => n.observedSurface && n.status !== "retired" && existsSync(join(root, n.sourceFile)))
    .map((n) => ({ node: n.id, prefixes: parseObservedSurface(readFileSync(join(root, n.sourceFile), "utf8"))?.modules ?? [] }));
  const scopeShas = plan.phases.flatMap((p) => shaTokensIn(p.scope ?? "").map((sha) => ({ sha, phase: p.id })));
  const dropped = new Set(plan.nodes.flatMap((n) => {
    const file = join(root, n.sourceFile);
    return n.phases.length > 0 && existsSync(file) ? droppedIn(readFileSync(file, "utf8"), n.phases) : [];
  }));
  const phases = new Map(plan.phases.map((p) => [p.id, { id: p.id, node: p.node, dropped: dropped.has(p.id) }]));
  return { nodes, nodeIds: plan.nodes.map((n) => n.id), phaseIds: plan.phases.map((p) => p.id), phases, scopes, scopeShas };
}

export function readRecords(root) {
  const dir = join(root, "hsdd", "management");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(isRecordFile)
    .sort()
    .map((filename) => ({ ...parseRecord(readFileSync(join(dir, filename), "utf8")), filename }));
}
