// The spec tree as sweep needs it: nodes, phase ids, the path prefixes each
// live node's Observed surface claims, and the shas phases' Scopes cite.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractPlan } from "../extract-plan.mjs";
import { parseObservedSurface } from "../diff.mjs";
import { isRecordFile, parseRecord } from "./record.mjs";
import { shaTokensIn } from "./candidates.mjs";

export function readTree(root) {
  const plan = extractPlan(root);
  const nodes = new Map(plan.nodes.map((n) => [n.id, { id: n.id, kind: n.kind, status: n.status, adopted: n.adopted }]));
  const scopes = plan.nodes
    .filter((n) => n.observedSurface && n.status !== "retired" && existsSync(join(root, n.sourceFile)))
    .map((n) => ({ node: n.id, prefixes: parseObservedSurface(readFileSync(join(root, n.sourceFile), "utf8"))?.modules ?? [] }));
  const scopeShas = plan.phases.flatMap((p) => shaTokensIn(p.scope ?? "").map((sha) => ({ sha, phase: p.id })));
  return { nodes, nodeIds: plan.nodes.map((n) => n.id), phaseIds: plan.phases.map((p) => p.id), scopes, scopeShas };
}

export function readRecords(root) {
  const dir = join(root, "hsdd", "management");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(isRecordFile)
    .sort()
    .map((filename) => ({ ...parseRecord(readFileSync(join(dir, filename), "utf8")), filename }));
}
