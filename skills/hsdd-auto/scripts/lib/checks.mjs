// The gate's tree checks C2 to C8 (spec 10.6) as pure functions of a tree snapshot. Each returns
// findings { id, level, message, file, related? }: `level` is the check's own level before the gate
// scopes it (spec 10.6, Scope), `file` is the repository-relative file the check names, or null when
// the finding names something with no file yet, and `related` lists other files whose change can
// cause the finding (inScope).
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { blockErrors } from "./intake.mjs";
import { phaseNodeOf } from "./tree.mjs";

const finding = (id, level, message, file, related = []) => ({
  id, level, message, file: file ?? null, ...(related.length > 0 ? { related } : {}),
});

// A finding is in scope when its file or any related file is in `changed` (a Set of repository-relative
// paths): the done definition and the gates count an error only then (spec 10.6 Scope, decision S-1).
export const inScope = (f, changed) => (f.file !== null && f.file !== undefined && changed.has(f.file))
  || (f.related ?? []).some((p) => changed.has(p));
const asSet = (xs) => new Set(xs ?? []);
const unique = (xs) => [...new Set(xs)];

// ---------- C2: node specs ----------

export const c2 = (tree) => [...tree.nodes.values()].flatMap((n) => {
  const out = [];
  if (n.title === null || n.titleId !== n.id) {
    out.push(finding("C2", "error", `${n.file}: the title is ${JSON.stringify(n.title ?? "")}; it must be "# ${n.id}: {Name}", matching the file name`, n.file));
  }
  if (n.kind === null) out.push(finding("C2", "error", `${n.id}: no Kind field`, n.file));
  for (const child of n.decomposesInto) {
    if (!tree.nodes.has(child)) out.push(finding("C2", "error", `${n.id}: Decomposes into names ${child}, which has no spec file`, n.file));
  }
  return out;
});

// ---------- C3: ADRs ----------

const ADR_FIELDS = ["id", "status", "affects", "date"];

const stripVersion = (target) => target.replace(/@v\d+$/, "");

// An affects target's file and whether its Governed by names the ADR; null when it has no file.
const governance = (tree, target, adrId) => {
  const name = stripVersion(target);
  const node = tree.nodes.get(name);
  if (node) {
    return { file: node.file, governed: node.governedBy.includes(adrId) || node.phases.some((p) => p.governedBy.includes(adrId)), where: "its header" };
  }
  const contract = tree.contracts.get(name);
  if (contract) return { file: contract.file, governed: contract.governedBy.includes(adrId), where: "its governed_by front matter" };
  const owner = tree.nodes.get(phaseNodeOf(name));
  const phase = owner?.phases.find((p) => p.id === name || p.short === name);
  if (phase) return { file: owner.file, governed: phase.governedBy.includes(adrId), where: "its phase header" };
  return null;
};

// C3's citation part: every cited ADR-{nnn} has a file, or is one that will be created (a warning).
export const c3Cited = (tree, { willCreateAdrs } = {}) => {
  const creating = asSet(willCreateAdrs);
  return tree.adrCites
    .filter((c) => !tree.adrs.has(c.id))
    .map((c) => (creating.has(c.id)
      ? finding("C3", "warn", `${c.id} is cited and has no file yet; a stage rule or an intake handoff will create it`, c.file)
      : finding("C3", "error", `${c.id} is cited and has no file`, c.file)));
};

// A governance finding names the affects target's file; the ADR's own file is related.
export const c3 = (tree, { willCreateAdrs } = {}) => {
  const shape = [...tree.adrs.values()].flatMap((a) =>
    ADR_FIELDS.filter((f) => a.front === null || a.front[f] === undefined)
      .map((f) => finding("C3", "error", `${a.id ?? a.file}: front matter has no ${f}`, a.file)));
  const governed = [...tree.adrs.values()].flatMap((a) => a.affects.flatMap((target) => {
    const g = governance(tree, target, a.id);
    if (g === null) return [finding("C3", "warn", `${a.id} affects ${target}, which has no file yet`, null, [a.file])];
    return g.governed ? [] : [finding("C3", "error", `${a.id} affects ${target}, but ${g.where} does not name ${a.id} under Governed by`, g.file, [a.file])];
  }));
  return [...shape, ...c3Cited(tree, { willCreateAdrs }), ...governed];
};

// ---------- C4: contract files ----------

const CONTRACT_FIELDS = ["id", "version", "status", "kind", "owner", "produced_by", "consumers", "phase_ids"];

// A validation path counts when it is a file, or a directory with at least one file below it.
const hasFiles = (full) => {
  if (!existsSync(full)) return false;
  const s = statSync(full);
  return s.isFile() || (s.isDirectory() && readdirSync(full).some((n) => hasFiles(join(full, n))));
};

export const c4 = (tree, { repoRoot }) => [...tree.contracts.values()].flatMap((c) => {
  const out = [];
  const err = (m) => out.push(finding("C4", "error", `${c.slug}: ${m}`, c.file));
  if (c.front === null) {
    err("no front matter");
    return out;
  }
  for (const f of CONTRACT_FIELDS) if (c.front[f] === undefined) err(`front matter has no ${f}`);
  if (c.front.id !== undefined && c.front.id !== c.slug) err(`id ${c.front.id} does not match the file name`);
  if (c.status === "stable" && c.phaseIds !== "final" && c.version !== "v0") {
    err(`status stable needs phase_ids final (it is ${c.phaseIds ?? "missing"}), except at version v0`);
  }
  if ((c.status === "stable" || c.status === "draft") && c.validation !== "grandfathered") {
    const present = c.validationPaths.some((v) => hasFiles(join(repoRoot, v.path)));
    if (!present) {
      const message = `${c.slug}: ## Validation names no schema or fixture path that exists and holds a file`;
      out.push(finding("C4", c.status === "stable" ? "error" : "warn", message, c.file));
    }
  }
  return out;
});

// ---------- C5: contract citations ----------

const versionNumber = (v) => Number(/^v(\d+)$/.exec(v ?? "")?.[1] ?? NaN);

// A cited version is acceptable when it is the current one, or an earlier one the contract's
// ## Versioning section names. A later version the section only announces is not a version yet.
const namesVersion = (contract, version) => {
  const cited = versionNumber(version);
  const current = versionNumber(contract.version);
  if (cited === current) return true;
  if (!(cited < current) || contract.versioningText === null) return false;
  return new RegExp(`(?<![A-Za-z0-9._@-])${version}(?![A-Za-z0-9]|\\.\\d)`).test(contract.versioningText);
};

export const c5 = (tree, { willCreateContracts } = {}) => {
  const creating = asSet(willCreateContracts);
  return tree.contractCites.filter((c) => !c.ext).flatMap((c) => {
    const contract = tree.contracts.get(c.slug);
    if (!contract) {
      return [creating.has(c.slug)
        ? finding("C5", "warn", `${c.slug}@${c.version} is cited and ${c.slug} has no file yet; a stage rule or an intake handoff will create it`, c.file)
        : finding("C5", "error", `${c.slug}@${c.version} is cited and ${c.slug} has no contract file`, c.file)];
    }
    return namesVersion(contract, c.version)
      ? []
      : [finding("C5", "error", `${c.slug}@${c.version} is cited, but the current version is ${contract.version} and ## Versioning does not name ${c.version}`, c.file)];
  });
};

// ---------- C6: open questions ----------

export const c6 = (tree) => {
  const defs = new Map();
  for (const d of tree.oqDefs) defs.set(d.id, [...(defs.get(d.id) ?? []), d.file]);
  const duplicates = [...defs.entries()].flatMap(([id, files]) =>
    files.slice(1).map((file) => finding("C6", "error", `${id} is defined again here; its first definition is in ${files[0]}`, file)));
  const unresolved = tree.oqCites
    .filter((c) => !defs.has(c.id))
    .map((c) => finding("C6", "error", `${c.id} is cited and defined nowhere`, c.file));
  return [...duplicates, ...unresolved];
};

// ---------- C7: phase ids in contracts ----------

const PHASE_ID_SHAPE = /(?:^|\.)\d+$/;

const phaseExists = (tree, name) => {
  const owner = tree.nodes.get(phaseNodeOf(name));
  if (owner) return owner.phases.some((p) => p.id === name || p.short === name);
  return [...tree.nodes.values()].some((n) => n.phases.some((p) => p.short === name));
};

// The finding names the contract's file; the spec file of the phase's node is related.
export const c7 = (tree) => [...tree.contracts.values()].flatMap((c) => {
  const level = c.phaseIds === "final" ? "error" : "warn";
  return unique([...c.producedBy, ...c.consumers])
    .filter((name) => PHASE_ID_SHAPE.test(name) && !tree.nodes.has(name))
    .filter((name) => !phaseExists(tree, name))
    .map((name) => {
      const nodeFile = tree.nodes.get(phaseNodeOf(name))?.file;
      return finding("C7", level, `${c.slug}: ${name} is not a phase heading in its node's spec file`, c.file, nodeFile ? [nodeFile] : []);
    });
});

// ---------- C8: intake records ----------

const BANNED_SLUG_WORDS = ["progress", "execution-plan", "milestones", "atlas"];
// v0.10.0 section 11.2; the record's headerFields are lower case.
const HEADER_FIELDS = ["date", "request", "class", "lands on", "contracts", "promotes", "collisions", "status"];
const HEADER_LABEL = (key) => key.replace(/\b\w/, (c) => c.toUpperCase());

export const c8 = (records, { intakeStep = false, recordPath = null, tree }) => records.flatMap((r) => {
  const out = [];
  const err = (m) => out.push(finding("C8", "error", `${r.path}: ${m}`, r.path));
  for (const word of BANNED_SLUG_WORDS.filter((w) => r.slug.includes(w))) err(`the slug contains ${word}`);
  for (const key of HEADER_FIELDS.filter((k) => !r.headerFields.includes(k))) err(`the header has no **${HEADER_LABEL(key)}:** field`);
  for (const m of blockErrors(r, tree)) err(m);
  if (intakeStep && r.path === recordPath && r.block == null && !r.blockError) {
    err("an intake step requires the hsdd-handoffs block in ## Routing, and this record has none");
  }
  return out;
});

// ---------- all of them ----------

// `extras`: willCreateAdrs and willCreateContracts (stage rules, imported from next.mjs by the gate),
// intakeStep and recordPath (the intake step's record).
export const treeChecks = (ctx, extras = {}) => [
  ...c2(ctx.tree),
  ...c3(ctx.tree, extras),
  ...c4(ctx.tree, { repoRoot: ctx.repoRoot }),
  ...c5(ctx.tree, extras),
  ...c6(ctx.tree),
  ...c7(ctx.tree),
  ...c8(ctx.intake.records, { intakeStep: extras.intakeStep ?? false, recordPath: extras.recordPath ?? null, tree: ctx.tree }),
];
