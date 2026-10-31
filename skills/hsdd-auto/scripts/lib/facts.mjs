// Facts per kind (spec appendix C.2a): one pure builder per row, each a function of the dispatch
// snapshot and the step. The snapshot is lib/context.mjs's, plus `reads` (dispatch.mjs
// dispatchContext): `plan` and `conventions` (file text or null), `existing` (which of the candidate
// paths exist: contract validation paths and the atlas) and `stepFiles` (names under hsdd/auto/steps).
// Every line ends in ` ({path})`, the file it was read from (10.3 "Facts come from files").
import { P } from "./paths.mjs";
import { sourcesOf } from "./config.mjs";
import { contractRefs, leafParentsOf, phaseNodeOf, toLines } from "./tree.mjs";
import { contractRoles, nodeFiles, specFilesInOrder } from "./order.mjs";
import { contractAt, contractTarget, lowerVersions, refFile, splitRef, supersededVersions, targetVersions, versionsOf } from "./contracts.mjs";

const unique = (xs) => [...new Set(xs)];
const code = (s) => `\`${s}\``;
const cite = (text, path) => `${text} (${path})`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = (v) => (Array.isArray(v) ? `[${v.join(", ")}]` : String(v));
const stripVersion = (ref) => ref.replace(/@v\d+$/, "");
const verifyRef = (ctx) => `${ctx.mainLine}:${ctx.layout.verify}`;

// ---------- shared lines ----------

const fileState = (c) => `status ${c.status ?? "missing"}, phase_ids ${c.phaseIds ?? "missing"}`;
const contractState = (c) => `version ${c.version ?? "missing"}, ${fileState(c)}`;

const validationText = (c) => (c.validationPaths.length === 0
  ? "no validation path"
  : `validation ${c.validationPaths.map((v) => `${v.kind} ${v.path}`).join(", ")}`);

// A reference `{id}@v{n}` and the state of the file that holds that version (v0.10.0 §3.1): the
// current version's, a lower version's own, or, with no file at that version, the current one's.
const versionStateLine = (tree, id, version, { validation = false } = {}) => {
  const entry = tree.contracts.get(id);
  const c = contractAt(tree, id, version);
  const v = (x) => (validation ? `, ${validationText(x)}` : "");
  if (c === null) return { text: `contract ${code(id)} is at ${contractState(entry)}${v(entry)}; no file holds ${version}`, file: entry.file };
  if (c.version === entry.version) return { text: `contract ${code(id)} is at ${contractState(c)}${v(c)}`, file: c.file };
  return { text: `contract ${code(id)} is at ${entry.version}; its ${version} file has ${fileState(c)}${v(c)}`, file: c.file };
};

// One line per contract reference of a node: the reference cites the node file it was read from,
// and the contract's state the file of the cited version (or that the contract has no file).
const refLines = (ctx, node, role, refs, { validation = false } = {}) => refs.map((r) => {
  const ref = `${role} ${code(`${r.slug}@${r.version}`)}`;
  if (!ctx.tree.contracts.has(r.slug)) return cite(`${ref}, which has no contract file yet`, node.file);
  const state = versionStateLine(ctx.tree, r.slug, r.version, { validation });
  return cite(`${cite(ref, node.file)}; ${state.text}`, state.file);
});

const nodeContractLines = (ctx, node, opts) => [
  ...refLines(ctx, node, "Produces", node.produces, opts),
  ...refLines(ctx, node, "Consumes", node.consumes, opts),
];

const governingLines = (ctx, node) => node.governedBy.map((id) => {
  const adr = ctx.tree.adrs.get(id);
  return adr ? cite(`Governed by ${code(id)}: status ${adr.status ?? "missing"}`, adr.file) : cite(`Governed by ${code(id)}, which has no file yet`, node.file);
});

const fieldLine = (node, name) => cite(`${code(node.id)} **${name}:** ${node.fields[name] === undefined ? "(absent)" : node.fields[name] === "" ? "(empty)" : node.fields[name]}`, node.file);

const sourceLine = (s) => cite(`Source ${code(s.path)}: ${s.role}, version ${s.version ?? "not given"}, authority ${s.authority ?? "absent"}`, P.runYaml);

// Phase ids with a verification doc on the main line (the conventions' **Main line:**), by node (12.4).
const verifiedLines = (ctx) => {
  const byNode = [...ctx.verifiedPhases].sort().reduce((m, id) => m.set(phaseNodeOf(id), [...(m.get(phaseNodeOf(id)) ?? []), id]), new Map());
  if (byNode.size === 0) return [cite(`No phase has a verification doc on ${ctx.mainLine}`, verifyRef(ctx))];
  return [...byNode].map(([node, ids]) => cite(`Phases of ${code(node)} with a verification doc on ${ctx.mainLine}: ${ids.join(", ")}`, verifyRef(ctx)));
};

const noFileLine = (ctx, id) => cite(`${code(id)} has no spec file`, `${ctx.layout.spec}/${id}.md`);

// ---------- one builder per C.2a row ----------

const rootSpecFacts = (ctx) => [
  ...sourcesOf(ctx.config).map(sourceLine),
  cite("`hsdd/` exists: it holds this run's configuration", P.runYaml),
  cite(ctx.reads.conventions === null ? `${code(P.conventions)} does not exist yet` : `${code(P.conventions)} exists`, P.conventions),
];

const parentSummaryLines = (ctx, node) => {
  const parents = [...ctx.tree.nodes.values()].filter((n) => n.decomposesInto.includes(node.id));
  if (parents.length === 0) {
    return [cite(node.id === ctx.tree.root ? `${code(node.id)} is the root: no parent embeds a summary of it` : `No spec names ${code(node.id)} in its **Decomposes into:**`, node.file)];
  }
  return parents.flatMap((p) => {
    const s = p.summaries.find((x) => x.id === node.id);
    if (!s) return [cite(`Parent ${code(p.id)} names ${code(node.id)} in **Decomposes into:** but embeds no summary of it`, p.file)];
    return [
      cite(`Parent ${code(p.id)} embeds ${code(node.id)} under ${code(`### ${s.heading}`)}`, p.file),
      ...Object.entries(s.fields).map(([k, v]) => cite(`Parent ${code(p.id)}'s summary **${k}:** ${v === "" ? "(empty)" : v}`, p.file)),
    ];
  });
};

const childLines = (ctx, node) => (node.decomposesInto.length === 0
  ? [cite(`${code(node.id)} decomposes into no child yet`, node.file)]
  : node.decomposesInto.map((id) => {
    const child = ctx.tree.nodes.get(id);
    return cite(`Child ${code(id)} of ${code(node.id)}: ${child ? `${child.kind ?? "no Kind"}, spec file ${child.file}` : "no spec file yet"}`, node.file);
  }));

const promotionLines = (node) => [
  fieldLine(node, "Adopted"),
  cite(`${code(node.id)} ${node.observedSurface ? "has" : "has no"} \`## Observed surface\` section`, node.file),
];

// mid-level-spec, graft, promote, spec-touch.
const nodeFacts = (ctx, step) => {
  const node = ctx.tree.nodes.get(step.target);
  if (!node) return [noFileLine(ctx, step.target)];
  return [
    ...Object.keys(node.fields).map((k) => fieldLine(node, k)),
    ...(node.fields["Decomposes into"] === undefined ? [fieldLine(node, "Decomposes into")] : []),
    ...nodeContractLines(ctx, node),
    ...governingLines(ctx, node),
    ...parentSummaryLines(ctx, node),
    ...(step.kind === "graft" ? childLines(ctx, node) : []),
    ...(step.kind === "promote" ? promotionLines(node) : []),
  ];
};

const frontMatterLines = (id, front, file) => Object.entries(front ?? {}).map(([k, v]) => cite(`${code(id)} front matter ${code(`${k}: ${fmt(v)}`)}`, file));

const affectsLine = (ctx, adr, ref) => {
  const { tree } = ctx;
  const { name: target, version } = splitRef(ref);
  const node = tree.nodes.get(target) ?? tree.nodes.get(phaseNodeOf(target));
  const contract = refFile(tree, target, version);
  if (contract) return cite(`${code(adr.id)} affects ${code(ref)}: contract ${contractState(contract)}, governed_by ${fmt(contract.governedBy)}`, contract.file);
  if (tree.contracts.has(target)) return cite(`${code(adr.id)} affects ${code(ref)}, which no file of ${code(target)} holds yet`, tree.contracts.get(target).file);
  if (node) return cite(`${code(adr.id)} affects ${code(ref)}, whose node ${code(node.id)} has **Governed by:** ${node.fields["Governed by"] ?? "(absent)"}`, node.file);
  return cite(`${code(adr.id)} affects ${code(ref)}, which has no file yet`, adr.file);
};

// adr, adr-update.
const adrFacts = (ctx, step) => {
  const { tree } = ctx;
  const id = step.target;
  const re = new RegExp(`(?<![A-Za-z0-9-])${id}(?![0-9])`);
  const texts = new Map(tree.specFiles.map((f) => [f.file, f.text]));
  const citing = specFilesInOrder(tree).flatMap((file) => toLines(texts.get(file) ?? "")
    .flatMap((l, i) => (re.test(l) ? [cite(`Line ${i + 1} cites ${id}: ${l.trim()}`, file)] : [])));
  const adr = tree.adrs.get(id);
  return [
    ...(citing.length > 0 ? citing : [cite(`No spec cites ${code(id)}`, `${ctx.layout.spec}/*.md`)]),
    ...(step.kind === "adr-update" ? (adr ? frontMatterLines(id, adr.front, adr.file) : [cite(`${code(id)} has no file`, `${ctx.layout.adr}/*.md`)]) : []),
    ...(adr ? adr.affects.map((ref) => affectsLine(ctx, adr, ref)) : []),
  ];
};

// The `## Versioning` section, one line per list item or paragraph, continuation lines joined.
const versioningItems = (text) => toLines(text ?? "").reduce(({ items, open }, l) => {
  if (l.trim() === "") return { items, open: false };
  if (open && !/^\s*[-*+]\s/.test(l)) return { items: [...items.slice(0, -1), `${items.at(-1)} ${l.trim()}`], open };
  return { items: [...items, l.trim()], open: true };
}, { items: [], open: false }).items;

const roleLines = (ctx, ids, field, missing) => (ids.length === 0
  ? [cite(missing, `${ctx.layout.spec}/*.md`)]
  : ids.map((id) => {
    const n = ctx.tree.nodes.get(id);
    return n ? fieldLine(n, field) : noFileLine(ctx, id);
  }));

// A contract file's own `owner` and `consumers` that name no node in the tree (a phase id counts as its node's).
const unresolvedRoleLines = (ctx, c, label) => [["owner", c.owner], ...c.consumers.map((x) => ["consumer", x])]
  .filter(([, name]) => name && !ctx.tree.nodes.has(name) && !ctx.tree.nodes.has(phaseNodeOf(name)))
  .map(([role, name]) => cite(`${code(label)} names ${code(name)} as its ${role}, which has no spec file`, c.file));

// contract, contract-touch. The target is an id, whose every version file is listed, or `{id}.v{n}`, one
// version (v0.10.0 §3.1); each version file is labelled `{id}@v{n}` once the id has more than one.
const contractFacts = (ctx, step) => {
  const { tree, layout } = ctx;
  const named = contractTarget(tree, step.target);
  const slug = named?.id ?? step.target;
  const all = versionsOf(tree.contracts.get(slug));
  const files = targetVersions(tree, step.target);
  const label = (c) => (all.length > 1 ? `${slug}@${c.version}` : slug);
  const own = named?.version ? step.target : slug;
  const { producers, consumers } = contractRoles(tree);
  const producedBy = [...(producers.get(slug) ?? [])];
  const adrs = [...tree.adrs.values()].filter((a) => a.affects.some((x) => stripVersion(x) === slug));
  const buildsOn = unique(producedBy.flatMap((id) => {
    const n = tree.nodes.get(id);
    return n ? [...n.consumes, ...n.phases.flatMap((p) => p.consumes)].map((r) => r.slug) : [];
  })).filter((s) => s !== slug);
  return [
    ...roleLines(ctx, producedBy, "Produces", `No node produces ${code(slug)}`),
    ...roleLines(ctx, [...(consumers.get(slug) ?? [])], "Consumes", `No node consumes ${code(slug)}`),
    ...(all.length > 1 || named?.version ? all.map((c) => cite(`${code(`${slug}@${c.version}`)}: ${contractState(c)}`, c.file)) : []),
    ...files.flatMap((c) => unresolvedRoleLines(ctx, c, label(c))),
    ...(adrs.length > 0
      ? adrs.flatMap((a) => a.affects.filter((x) => stripVersion(x) === slug).map((x) => cite(`${code(a.id)} (${a.status ?? "no status"}) affects ${code(x)}`, a.file)))
      : [cite(`No ADR's affects names ${code(slug)}`, `${layout.adr}/*.md`)]),
    ...(buildsOn.length > 0
      ? buildsOn.map((s) => {
        const b = tree.contracts.get(s);
        return b ? cite(`${code(slug)} builds on ${code(s)}: ${contractState(b)}`, b.file) : cite(`${code(slug)} builds on ${code(s)}, which has no contract file yet`, `${layout.contract}/${s}.md`);
      })
      : [cite(`${code(slug)} builds on no other contract: its producers consume none`, nodeFiles(tree, producedBy)[0] ?? `${layout.spec}/*.md`)]),
    ...(step.kind === "contract-touch" ? files.flatMap((c) => [
      ...frontMatterLines(label(c), c.front, c.file),
      ...(c.versioningText === null
        ? [cite(`${code(label(c))} has no \`## Versioning\` section`, c.file)]
        : versioningItems(c.versioningText).map((v) => cite(`${code(label(c))} \`## Versioning\`: ${v}`, c.file))),
    ]) : []),
    ...(files.length > 0
      ? files.flatMap((c) => (c.validationPaths.length === 0
        ? [cite(`${code(label(c))} names no validation path in \`## Validation\``, c.file)]
        : c.validationPaths.map((v) => cite(`${code(label(c))} validation ${v.kind} ${code(v.path)} ${ctx.reads.existing.has(v.path) ? "exists" : "does not exist"}`, c.file))))
      : [cite(`${code(own)} has no contract file yet, so no validation path`, `${layout.contract}/${own}.md`)]),
  ];
};

// The superseded strings of 12.2 as text: baseline paths and versions, and every superseded contract
// version (lib/contracts.mjs: deprecated or retired, or with no file of its own).
const supersededLines = (ctx) => {
  const baseline = ctx.config.sources.baseline ?? [];
  const lines = [
    ...unique(baseline.map((s) => s.path)).map((p) => cite(`Superseded string ${code(p)}: the path of a baseline source`, P.runYaml)),
    ...unique(baseline.map((s) => s.version).filter(Boolean)).map((v) => cite(`Superseded string ${code(v)}: the version of a baseline source`, P.runYaml)),
    ...[...ctx.tree.contracts.values()].flatMap((c) => supersededVersions(c).map((v) => (v.file
      ? cite(`Superseded string ${code(`${c.slug}@${v.version}`)}: ${c.slug} is at ${c.version}, and its ${v.version} file is ${v.file.status}`, v.file.file)
      : cite(`Superseded string ${code(`${c.slug}@${v.version}`)}: ${c.slug} is at ${c.version}${versionsOf(c).length > 1 ? `, and no file holds ${v.version}` : ""}`, c.file)))),
  ];
  return lines.length > 0 ? lines : [cite("No superseded string: no baseline source, and no superseded contract version", P.runYaml)];
};

// A lower version with a file of its own that is neither deprecated nor retired: live beside the current
// one (coexisting, v0.10.0 §3.5), so a citation of it is not superseded.
const liveLowerLines = (c) => lowerVersions(c).filter((v) => !v.superseded)
  .map((v) => cite(`${code(`${c.slug}@${v.version}`)} is ${v.file.status ?? "without a status"}, a lower version that stays live beside ${c.version} (coexisting): a citation of it is not superseded`, v.file.file));

const citationFacts = (ctx) => {
  const contracts = [...ctx.tree.contracts.values()];
  return [
    ...(contracts.length > 0
      ? contracts.flatMap((c) => [cite(`${code(c.slug)} is at ${c.version ?? "no version"}`, c.file), ...liveLowerLines(c)])
      : [cite("No contract file exists", `${ctx.layout.contract}/*.md`)]),
    ...sourcesOf(ctx.config).map((s) => cite(`Source ${code(s.cite)} (${code(s.path)}): ${s.role === "baseline" ? "baseline, superseded" : s.role}, version ${s.version ?? "not given"}`, P.runYaml)),
    ...supersededLines(ctx),
    ...verifiedLines(ctx),
  ];
};

const CONVENTION_LINES = ["Ordering policy", "Coding method", "Teams"];

const conventionLines = (ctx) => {
  if (ctx.reads.conventions === null) return [cite(`${code(P.conventions)} does not exist`, P.conventions)];
  const ls = toLines(ctx.reads.conventions);
  return CONVENTION_LINES.map((label) => {
    const line = ls.find((l) => l.trim().startsWith(`**${label}:**`));
    return cite(line ? line.trim() : `${code(P.conventions)} has no **${label}:** line`, P.conventions);
  });
};

const appendLines = (ctx, step, node) => {
  const ids = node.phases.map((p) => p.id);
  const verified = ids.filter((id) => ctx.verifiedPhases.has(id));
  const record = ctx.segment?.mode === "intake" ? ctx.intake.record : null;
  return [
    cite(`${code(node.id)} has phases ${ids.length > 0 ? ids.join(", ") : "none"}`, node.file),
    cite(`Of them, with a verification doc on ${ctx.mainLine}: ${verified.length > 0 ? verified.join(", ") : "none"}`, verifyRef(ctx)),
    ...(record
      ? [
        cite(`The segment's intake record is ${code(record.path)}`, record.path),
        // v0.10.0 §11.3 as of 0.10.2: the request's own path joins Sources, never the record's.
        cite(`The change request is ${code(ctx.segment.request)}; its own path, never the record's, joins the node's Sources`, P.runYaml),
      ]
      : [cite(`No intake record: this plan segment's step comes from ${step.queue_item ? `the insert-step item ${step.queue_item}` : "no insert-step item"}`, P.queue)]),
  ];
};

// phase-plan, phase-plan-append.
const phasePlanFacts = (ctx, step) => {
  const node = ctx.tree.nodes.get(step.target);
  if (!node) return [noFileLine(ctx, step.target)];
  return [
    ...["Purpose", "Owns", "Produces", "Consumes"].map((k) => fieldLine(node, k)),
    ...nodeContractLines(ctx, node, { validation: true }),
    ...governingLines(ctx, node),
    ...conventionLines(ctx),
    ...(step.kind === "phase-plan-append" ? appendLines(ctx, step, node) : []),
  ];
};

const countsText = (entries) => {
  const counts = entries.reduce((m, e) => m.set(e.kind, (m.get(e.kind) ?? 0) + 1), new Map());
  return entries.length === 0 ? "no entries" : `${plural(entries.length, "entry", "entries")} (${[...counts].map(([k, n]) => `${n} ${k}`).join(", ")})`;
};

// reconcile, align.
const reconcileFacts = (ctx, step) => {
  const { tree } = ctx;
  const named = step.target === "all" ? leafParentsOf(tree) : step.target.split(",").map((s) => s.trim()).filter(Boolean);
  const present = [...tree.nodes.values()].filter((n) => n.pending.present).map((n) => n.id);
  const order = [...named, ...present.filter((id) => !named.includes(id)).sort()];
  const sections = order.flatMap((id) => {
    const n = tree.nodes.get(id);
    if (!n) return [noFileLine(ctx, id)];
    if (!n.pending.present) return named.includes(id) ? [cite(`${code(id)} (named) has no pending section`, n.file)] : [];
    return [cite(`${code(id)} pending section: ${countsText(n.pendingEntries)}`, n.file)];
  });
  const refs = order.flatMap((id) => (tree.nodes.get(id)?.pendingEntries ?? []).flatMap((e) => contractRefs(e.text).map((r) => ({ ...r, node: tree.nodes.get(id) }))));
  // One line per version an entry names, from the file that holds that version (v0.10.0 §3.1).
  const contracts = refs.filter((r, i) => refs.findIndex((x) => x.slug === r.slug && x.version === r.version) === i).map((r) => {
    const ref = code(`${r.slug}@${r.version}`);
    if (!tree.contracts.has(r.slug)) return cite(`Pending entries name ${ref}, which has no contract file`, r.node.file);
    const c = contractAt(tree, r.slug, r.version);
    const entry = tree.contracts.get(r.slug);
    return c ? cite(`Pending entries name ${ref}: ${contractState(c)}`, c.file)
      : cite(`Pending entries name ${ref}, which no file of ${code(r.slug)} holds; it is at ${contractState(entry)}`, entry.file);
  });
  return [
    ...sections,
    ...(present.length === 0 ? [cite("No node has a pending section", `${ctx.layout.spec}/*.md`)] : []),
    ...contracts,
    ...(step.kind === "align" ? verifiedLines(ctx) : []),
  ];
};

const versionMoveLines = (config) => {
  const current = [...(config.sources.normative ?? []), ...(config.sources.informative ?? [])];
  return (config.sources.baseline ?? []).map((b) => {
    const now = current.find((s) => s.cite === b.cite);
    return now
      ? cite(`${code(b.cite)} moves from ${code(b.path)} ${b.version ?? "(no version)"} (baseline) to ${code(now.path)} ${now.version ?? "(no version)"}`, P.runYaml)
      : cite(`Baseline ${code(b.path)} ${b.version ?? "(no version)"} has no current source cited as ${code(b.cite)}`, P.runYaml);
  });
};

const intakeFacts = (ctx) => {
  const { tree, layout, segment } = ctx;
  const open = ctx.intake.records.filter((r) => r.status === "open");
  const atlas = `${layout.management}/atlas.md`;
  const nodes = [...tree.nodes.values()];
  const upstream = ctx.decisions.filter((d) => d.would_upstream === true).length;
  return [
    cite(`Request ${code(segment.request)}, authority ${segment.authority}`, P.runYaml),
    ...(open.length > 0
      ? open.map((r) => cite(`Open intake record, lands on ${r.landsOn.length > 0 ? r.landsOn.join(", ") : "nothing"}${r.contracts.length > 0 ? `, contracts ${r.contracts.join(", ")}` : ""}`, r.path))
      : [cite("No open intake record", `${layout.management}/*-intake-*.md`)]),
    ...(ctx.reads.existing.has(atlas)
      ? [cite(`The atlas is ${code(atlas)}`, atlas)]
      : nodes.length > 0
        ? nodes.map((n) => cite(`Node ${code(n.id)}: ${n.kind ?? "no Kind"}${n.name ? `, ${n.name}` : ""}`, n.file))
        : [cite("The tree has no node spec", `${layout.spec}/*.md`)]),
    ...versionMoveLines(ctx.config),
    cite(`${plural(upstream, "earlier decision")} carry would_upstream: true; \`node hsdd/scripts/auto/state.mjs upstream\` lists them`, P.ledger),
  ];
};

const FACTS = {
  "root-spec": rootSpecFacts,
  "mid-level-spec": nodeFacts,
  graft: nodeFacts,
  promote: nodeFacts,
  "spec-touch": nodeFacts,
  adr: adrFacts,
  "adr-update": adrFacts,
  contract: contractFacts,
  "contract-touch": contractFacts,
  "citation-touch": citationFacts,
  "phase-plan": phasePlanFacts,
  "phase-plan-append": phasePlanFacts,
  reconcile: reconcileFacts,
  align: reconcileFacts,
  intake: intakeFacts,
};

// `step` is next.mjs's step object ({ kind, target, queue_item, ... }); `ctx` the dispatch snapshot.
export const factLines = (ctx, step) => {
  const build = FACTS[step.kind];
  if (!build) throw new Error(`no facts for step kind ${step.kind}`);
  if (ctx.reads === undefined) throw new Error("factLines needs the dispatch snapshot (dispatch.mjs dispatchContext)");
  return build(ctx, step);
};
