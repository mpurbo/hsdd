// Project model loader: the only module that reads the filesystem for the
// artifact tree. Everything downstream (registry, context, lint, status,
// rename planning) is a pure function of the model this returns.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./frontmatter.mjs";
import { parsePhaseBlocks } from "./phase-block.mjs";
import { extractSection } from "./sections.mjs";

export const DEFAULT_CONVENTIONS = {
  specs_dir: "docs/spec",
  verify_dir: "docs/verify",
  contracts_dir: "contracts",
  adr_dir: "adr",
  openspec_dir: "openspec",
  ordering_policy: "interfaces-first",
  profile: "single-team",
};

const readIfExists = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

const mdFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".md") && f.toUpperCase() !== "INDEX.MD").sort()
    : [];

function loadConventions(root) {
  const text = readIfExists(join(root, "docs/conventions.md"));
  const fm = text ? parseFrontmatter(text) : null;
  const overrides = {};
  if (fm) {
    for (const key of Object.keys(DEFAULT_CONVENTIONS)) {
      if (typeof fm.data[key] === "string" && fm.data[key]) overrides[key] = fm.data[key];
    }
  }
  return { ...DEFAULT_CONVENTIONS, ...overrides };
}

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function loadNodes(root, conventions, phaseErrors) {
  const dir = join(root, conventions.specs_dir);
  const nodes = [];
  const legacyNodes = [];
  for (const file of mdFiles(dir)) {
    const rel = `${conventions.specs_dir}/${file}`;
    const text = readFileSync(join(dir, file), "utf8");
    const fm = parseFrontmatter(text);
    if (!fm || !fm.data.id) { legacyNodes.push(rel); continue; }
    const node = {
      id: fm.data.id,
      kind: fm.data.kind || "",
      consumes: asList(fm.data.consumes),
      produces: asList(fm.data.produces),
      governed_by: asList(fm.data.governed_by),
      team: fm.data.team || null,
      adopted: fm.data.adopted || null,
      file: rel,
      body: fm.body,
      phases: [],
    };
    if (node.kind === "leaf-parent") {
      const { phases, errors } = parsePhaseBlocks(node.id, fm.body);
      node.phases = phases;
      for (const e of errors) phaseErrors.push({ file: rel, error: e });
    }
    nodes.push(node);
  }
  return { nodes, legacyNodes };
}

function loadContracts(root, conventions) {
  const dir = join(root, conventions.contracts_dir);
  const contracts = [];
  const legacyContracts = [];
  for (const file of mdFiles(dir)) {
    const rel = `${conventions.contracts_dir}/${file}`;
    const text = readFileSync(join(dir, file), "utf8");
    const fm = parseFrontmatter(text);
    if (!fm || !fm.data.id) { legacyContracts.push(rel); continue; }
    contracts.push({
      id: fm.data.id,
      version: fm.data.version || "",
      status: fm.data.status || "",
      kind: fm.data.kind || "",
      owner: fm.data.owner || "",
      governed_by: asList(fm.data.governed_by),
      schema: fm.data.schema || null,
      fixtures: fm.data.fixtures || null,
      // legacy v0.3/v0.4 fields, detected for migration warnings only
      legacyFields: ["produced_by", "consumers"].filter((k) => fm.data[k] !== undefined),
      file: rel,
      body: fm.body,
      slug: file.replace(/\.md$/, ""),
    });
  }
  return { contracts, legacyContracts };
}

function loadAdrs(root, conventions) {
  const dir = join(root, conventions.adr_dir);
  const adrs = [];
  const legacyAdrs = [];
  for (const file of mdFiles(dir)) {
    const rel = `${conventions.adr_dir}/${file}`;
    const text = readFileSync(join(dir, file), "utf8");
    const fm = parseFrontmatter(text);
    if (!fm || !fm.data.id) { legacyAdrs.push(rel); continue; }
    adrs.push({
      id: fm.data.id,
      status: fm.data.status || "",
      affects: asList(fm.data.affects),
      date: fm.data.date || "",
      supersedes: asList(fm.data.supersedes),
      superseded_by: asList(fm.data.superseded_by),
      file: rel,
      body: fm.body,
    });
  }
  return { adrs, legacyAdrs };
}

function loadChangesIn(dir, archived) {
  if (!existsSync(dir)) return [];
  const changes = [];
  for (const name of readdirSync(dir).sort()) {
    if (archived === false && name === "archive") continue;
    const changeDir = join(dir, name);
    if (!statSync(changeDir).isDirectory()) continue;
    const proposal = readIfExists(join(changeDir, "proposal.md"));
    let phaseId = null;
    const m = proposal && proposal.match(/^Phase:\s*(\S+)\s*$/m);
    if (m) phaseId = m[1];                                   // authoritative
    else if (/^[a-z0-9-]+-\d+$/.test(name)) phaseId = null;  // fallback resolved later
    changes.push({ name, phaseId, archived, hasProposal: proposal !== null });
  }
  return changes;
}

function loadChanges(root, conventions, phaseIds) {
  const base = join(root, conventions.openspec_dir, "changes");
  const changes = [
    ...loadChangesIn(base, false),
    ...loadChangesIn(join(base, "archive"), true),
  ];
  // fallback: hyphenated directory name matches a known phase id
  const byHyphenated = new Map(phaseIds.map((id) => [id.replace(/\./g, "-"), id]));
  for (const c of changes) {
    if (!c.phaseId && byHyphenated.has(c.name)) c.phaseId = byHyphenated.get(c.name);
  }
  return changes;
}

// Deterministic verification-doc reading rules (documented in the
// maintainer's guide): gate evidence = non-empty "## Test evidence" section;
// signed off = a "reviewed by" line with a non-placeholder value, or a line
// with a PR reference marked merged; a learning is a top-level "- " bullet in
// "## Learnings", dispositioned when it contains "disposition:" ("- none" and
// "- no learnings" count as dispositioned).
function parseVerification(text) {
  const evidence = extractSection(text, "Test evidence");
  const hasGateEvidence = Boolean(evidence && evidence.trim());
  const signoffSection = extractSection(text, "Human sign-off") || text;
  const reviewedBy = signoffSection.match(/reviewed by:?\s*(.+?)(?:\s+date|$)/im);
  const reviewedOk = Boolean(reviewedBy && reviewedBy[1].trim().replace(/_/g, "").trim());
  const prMerged = /PR:.*merged|merged PR/i.test(signoffSection);
  const learningsSection = extractSection(text, "Learnings");
  const learnings = [];
  if (learningsSection) {
    let current = null;
    for (const line of learningsSection.split("\n")) {
      if (/^- /.test(line)) {
        if (current) learnings.push(current);
        current = { text: line.slice(2).trim(), dispositioned: false };
      } else if (current && line.trim()) {
        current.text += " " + line.trim();
      }
    }
    if (current) learnings.push(current);
    for (const l of learnings) {
      l.dispositioned = /disposition:/.test(l.text) || /^(none|no learnings)\b/i.test(l.text);
    }
  }
  const metrics = extractSection(text, "Metrics");
  return {
    hasGateEvidence,
    signedOff: reviewedOk || prMerged,
    learnings,
    hasLearningsSection: learningsSection !== null,
    metrics: metrics ? metrics.trim() : null,
  };
}

function loadVerifications(root, conventions) {
  const dir = join(root, conventions.verify_dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".verification.md"))
    .sort()
    .map((f) => ({
      phaseId: f.replace(/\.verification\.md$/, ""),
      file: `${conventions.verify_dir}/${f}`,
      ...parseVerification(readFileSync(join(dir, f), "utf8")),
    }));
}

export function loadProject(root) {
  const conventions = loadConventions(root);
  const phaseErrors = [];
  const { nodes, legacyNodes } = loadNodes(root, conventions, phaseErrors);
  const { contracts, legacyContracts } = loadContracts(root, conventions);
  const { adrs, legacyAdrs } = loadAdrs(root, conventions);
  const phaseIds = nodes.flatMap((n) => n.phases.map((p) => p.id));
  const changes = loadChanges(root, conventions, phaseIds);
  const verifications = loadVerifications(root, conventions);
  return {
    root,
    conventions,
    nodes,
    legacyNodes,
    contracts,
    legacyContracts,
    adrs,
    legacyAdrs,
    phaseErrors,
    changes,
    verifications,
    contractsIndex: readIfExists(join(root, conventions.contracts_dir, "INDEX.md")),
    adrIndex: readIfExists(join(root, conventions.adr_dir, "INDEX.md")),
  };
}

// Every phase across the tree, with its owning node attached.
export function allPhases(model) {
  return model.nodes.flatMap((n) => n.phases.map((p) => ({ ...p, nodeRef: n })));
}

export function findPhase(model, phaseId) {
  return allPhases(model).find((p) => p.id === phaseId) || null;
}
