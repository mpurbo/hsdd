// The next step (spec 10.2), the mode's stages (chapter 9) and the done definition (9.1), as pure
// functions of one repository snapshot (lib/context.mjs). The edges are the snapshot's memoized
// reads (ctx.registry(), ctx.changedInSegment(), ctx.uncommitted()) and validateLedger; only the
// done definition calls them. A mode is a row of MODES: its stage table and the few rules that
// differ between modes. Usage: next.mjs [--stages]
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadContext } from "./lib/context.mjs";
import { KINDS, skillFor, targetType, writeSet } from "./lib/kinds.mjs";
import { c5, c6, c7 } from "./lib/checks.mjs";
import { P, globToRegExp } from "./lib/paths.mjs";
import { phaseNodeOf } from "./lib/tree.mjs";
import { idNum, stepNum } from "./lib/records.mjs";
import { leafParentsOf, matches, queueItems } from "./routed.mjs";
import { validateLedger } from "./ledger.mjs";

const unique = (xs) => [...new Set(xs)];
const byIdNum = (a, b) => idNum(a.id) - idNum(b.id);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isSubagent = (kind) => KINDS[kind] !== undefined && !KINDS[kind].orchestrator;
const isStepId = (s) => typeof s === "string" && /^S\d{2,}$/.test(s);
// A position in `list`; what is not in it comes after everything that is.
const rankIn = (list) => (x) => { const i = list.indexOf(x); return i < 0 ? list.length : i; };

// ---------- producer-first (9.1) ----------

// A name in a Produces/Consumes field or contract front matter as a node id: the node itself, or a
// phase id's node (the id without its trailing numeric segment); null when the tree has no such node.
const nodeOf = (tree, name) => {
  if (tree.nodes.has(name)) return name;
  const owner = phaseNodeOf(name);
  return owner !== name && tree.nodes.has(owner) ? owner : null;
};

// Who produces and who consumes each contract slug, as sets of node ids: node and phase Produces and
// Consumes fields, contract `owner` and `consumers`.
const contractRoles = (tree) => {
  const fromNodes = [...tree.nodes.values()].flatMap((n) => [
    ...[...n.produces, ...n.phases.flatMap((p) => p.produces)].map((r) => ["produces", r.slug, n.id]),
    ...[...n.consumes, ...n.phases.flatMap((p) => p.consumes)].map((r) => ["consumes", r.slug, n.id]),
  ]);
  const fromContracts = [...tree.contracts.values()].flatMap((c) => [
    ...(c.owner ? [["produces", c.slug, nodeOf(tree, c.owner)]] : []),
    ...c.consumers.map((name) => ["consumes", c.slug, nodeOf(tree, name)]),
  ]);
  const group = (role) => [...fromNodes, ...fromContracts]
    .filter(([r, , node]) => r === role && node !== null)
    .reduce((m, [, slug, node]) => m.set(slug, new Set([...(m.get(slug) ?? []), node])), new Map());
  return { producers: group("produces"), consumers: group("consumes") };
};

// Every item reachable from `start` along `succ`, `start` excluded unless a cycle returns to it.
const reachable = (succ, start) => {
  const seen = new Set();
  const visit = (x) => succ(x).forEach((y) => { if (!seen.has(y)) { seen.add(y); visit(y); } });
  visit(start);
  return seen;
};

// Kahn's algorithm over `items` with `before(a, b)` (a must come first) and the tie order `rank`:
// the lowest-ranked ready item goes next. Items left when none is ready are the cycle.
const kahn = (items, before, rank) => {
  const go = (remaining, order) => {
    const ready = remaining.filter((b) => !remaining.some((a) => a !== b && before(a, b)));
    if (ready.length === 0) return { order, cycle: remaining };
    return go(remaining.filter((x) => x !== ready[0]), [...order, ready[0]]);
  };
  return go(unique(items).sort((a, b) => rank(a) - rank(b) || cmp(a, b)), []);
};

// Ties keep first mention in the root spec, then in the parent specs (tree.mentionOrder); the root
// comes first; nodes never mentioned last.
const nodeRank = (tree) => rankIn([tree.root, ...tree.mentionOrder]);

// Citations ({ file, ... }) in the order of their file in `files` (citations elsewhere dropped), then
// text order; each key once, at its first citation.
const firstCited = (cites, files, key) => {
  const rank = rankIn(files);
  const sorted = cites
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => files.includes(c.file))
    .sort((a, b) => rank(a.c.file) - rank(b.c.file) || a.i - b.i)
    .map(({ c }) => c);
  return sorted.filter((c, i) => sorted.findIndex((d) => key(d) === key(c)) === i);
};

// Node A precedes node B when B consumes a contract A produces, directly or through other nodes, so
// an order over some candidates honours links through nodes that are not candidates.
export const producerOrder = (tree, nodeIds) => {
  const { producers, consumers } = contractRoles(tree);
  const succ = (a) => unique([...producers].flatMap(([slug, ps]) => (ps.has(a) ? [...(consumers.get(slug) ?? [])] : [])))
    .filter((b) => b !== a);
  const reach = new Map(unique(nodeIds).map((id) => [id, reachable(succ, id)]));
  return kahn(nodeIds, (a, b) => reach.get(a).has(b), nodeRank(tree));
};

const nodeFiles = (tree, ids) => ids.map((id) => tree.nodes.get(id)?.file);

// Contract slugs in order of first mention in the specs: the root's, then tree.mentionOrder's.
const contractRank = (tree) => {
  const files = nodeFiles(tree, [tree.root, ...tree.mentionOrder]).filter(Boolean);
  return rankIn(firstCited(tree.contractCites, files, (c) => c.slug).map((c) => c.slug));
};

// Contract X precedes contract Y when Y's producing node consumes X, directly or through other contracts.
export const contractOrder = (tree, slugs) => {
  const { producers, consumers } = contractRoles(tree);
  const consumedBy = (node) => [...consumers].flatMap(([slug, cs]) => (cs.has(node) ? [slug] : []));
  const succ = (x) => unique([...producers].flatMap(([y, ps]) => ([...ps].some((p) => consumedBy(p).includes(x)) ? [y] : [])))
    .filter((y) => y !== x);
  const reach = new Map(unique(slugs).map((s) => [s, reachable(succ, s)]));
  return kahn(slugs, (a, b) => reach.get(a).has(b), contractRank(tree));
};

const ordered = ({ order, cycle }) => [...order, ...cycle];

// ---------- stage inputs read from the tree ----------

const notRetired = (n) => n.status !== "retired";

// Every spec file (each is a node's) in stage 3's citation order: the root spec, then the parent
// specs producer-first, then the other specs producer-first.
const specFileOrder = (tree) => {
  const others = [...tree.nodes.keys()].filter((id) => id !== tree.root);
  const parents = others.filter((id) => tree.nodes.get(id).decomposesInto.length > 0);
  const rest = others.filter((id) => !parents.includes(id));
  return nodeFiles(tree, [tree.root, ...ordered(producerOrder(tree, parents)), ...ordered(producerOrder(tree, rest))]).filter(Boolean);
};

// ADR ids a spec cites (adrCites restricted to the spec files), each once, in stage 3's order:
// [{ id, file }] with the first citing file.
const specAdrCites = (ctx) => firstCited(ctx.tree.adrCites, specFileOrder(ctx.tree), (c) => c.id);

const missingAdrs = (ctx) => specAdrCites(ctx).filter((c) => !ctx.tree.adrs.has(c.id));

// Contract slugs a spec names (Consumes and Produces fields) that have no file: [{ slug, file }].
const missingContracts = (ctx) => {
  const named = ctx.tree.contractNames.filter((n) => !ctx.tree.contracts.has(n.slug));
  return named.filter((n, i) => named.findIndex((m) => m.slug === n.slug) === i).map((n) => ({ slug: n.slug, file: n.file }));
};

const leafParentsToPlan = (tree) => [...tree.nodes.values()]
  .filter((n) => n.kind === "leaf-parent" && notRetired(n) && n.adopted !== "as-built");

// What a plan segment's stage rules will create: C3 and C5 warn instead of failing on these (10.6).
const planWillCreate = (ctx) => ({
  adrs: new Set(missingAdrs(ctx).map((c) => c.id)),
  contracts: new Set(missingContracts(ctx).map((c) => c.slug)),
});

// ---------- the derived view of a snapshot ----------

// A stopped step's chain blocks a fresh step for its (kind, target); reconcile and align by kind
// alone, since their target only names the plans and the skill drains the whole tree (7.1).
const KIND_WIDE = new Set(["reconcile", "align"]);
const chainKey = (kind, target) => (KIND_WIDE.has(kind) ? kind : `${kind}\u0000${target}`);

// Subagent steps committed `stopped` that no committed step continues: the head of each unfinished
// chain (8.3), oldest first. A stopped continuation is itself the head of its chain.
// Legacy run lines (no `segment`, spec 10.5) come from a hand-built run and start no chain.
export const pendingStopped = (ctx) => {
  const lines = ctx.committedRunLines.filter((l) => isStepId(l.step_ref) && l.segment !== undefined);
  const continued = new Set(lines.map((l) => l.continues).filter(isStepId));
  return lines
    .filter((l) => l.status === "stopped" && isSubagent(l.kind) && !continued.has(l.step_ref))
    .sort((a, b) => stepNum(a.step_ref) - stepNum(b.step_ref))
    .map((l) => {
      const front = ctx.dispatches.get(l.step_ref)?.front ?? null;
      return { step: l.step_ref, kind: l.kind, target: l.target, handoff: front?.handoff ?? null, queue_item: front?.queue_item ?? null };
    });
};

const derive = (ctx, mode) => {
  const chains = pendingStopped(ctx);
  return {
    ctx,
    mode,
    seg: ctx.segment,
    segLines: ctx.committedRunLines.filter((l) => l.segment === ctx.segment.id),
    items: [...queueItems(ctx.queueLines).values()].sort(byIdNum),
    chains,
    blocked: new Map(chains.map((c) => [chainKey(c.kind, c.target), c])),
    leafParents: leafParentsOf(ctx.tree),
  };
};

const chainOf = (v, kind, target) => v.blocked.get(chainKey(kind, target)) ?? null;
const fresh = (v, kind, target) => chainOf(v, kind, target) === null;
const chainLine = (c) => `${c.kind} ${c.step} on ${c.target} stopped and no continuation of it has completed`;
const chainsOfKind = (v, kind) => v.chains.filter((c) => c.kind === kind);
const committedKind = (v, kind) => v.segLines.some((l) => l.kind === kind);
const reportCommitted = (v) => v.segLines.some((l) => l.kind === "report" && l.status === "completed");

// ---------- results ----------

const parentFiles = (tree, id) => [...tree.nodes.values()].filter((n) => n.decomposesInto.includes(id)).map((n) => n.file);
const nodeContracts = (n) => [...n.consumes, ...n.produces].map((r) => r.slug);
const contractFiles = (tree, slugs) => slugs.map((s) => tree.contracts.get(s)?.file);
const adrFiles = (tree, ids) => ids.map((id) => tree.adrs.get(id)?.file);
const targetNodes = (tree, target) => (target === "all" ? leafParentsOf(tree) : target.split(",").map((s) => s.trim()));

const fileOfTarget = (tree, target) => {
  switch (targetType(target, tree)) {
    case "node": return tree.nodes.get(target)?.file;
    case "contract": return tree.contracts.get(target)?.file;
    case "adr": return tree.adrs.get(target)?.file;
    case "request": return target;
    default: return null;
  }
};

// The files the step's template names (appendix C.2a), as far as the tree knows them; target first.
const inputsFor = (ctx, kind, target) => {
  const { tree, config } = ctx;
  const node = tree.nodes.get(target);
  const forNode = (withParent) => (node
    ? [node.file, ...(withParent ? parentFiles(tree, target) : []), ...contractFiles(tree, nodeContracts(node)), ...adrFiles(tree, node.governedBy)]
    : []);
  const paths = (() => {
    switch (kind) {
      case "root-spec":
        return ["normative", "informative", "baseline"].flatMap((k) => (config.sources[k] ?? []).map((s) => s.path));
      case "mid-level-spec": case "graft": case "promote": case "spec-touch":
        return forNode(true);
      case "phase-plan": case "phase-plan-append":
        return forNode(false);
      case "adr": case "adr-update": {
        const affects = (tree.adrs.get(target)?.affects ?? []).map((a) => fileOfTarget(tree, a.replace(/@v\d+$/, "")));
        const files = specFileOrder(tree);
        const citing = files.filter((f) => tree.adrCites.some((c) => c.id === target && c.file === f));
        return [tree.adrs.get(target)?.file, ...citing, ...affects];
      }
      case "contract": case "contract-touch": {
        const { producers, consumers } = contractRoles(tree);
        const governing = [...tree.adrs.values()].filter((a) => a.affects.some((x) => x.replace(/@v\d+$/, "") === target)).map((a) => a.file);
        return [tree.contracts.get(target)?.file, ...nodeFiles(tree, [...(producers.get(target) ?? [])]),
          ...nodeFiles(tree, [...(consumers.get(target) ?? [])]), ...governing];
      }
      case "citation-touch":
        return [fileOfTarget(tree, target)];
      case "reconcile": case "align":
        return [...nodeFiles(tree, targetNodes(tree, target)), ...[...tree.nodes.values()].filter((n) => n.pending.entries > 0).map((n) => n.file)];
      case "intake":
        return [target];
      default:
        return [];
    }
  })();
  return unique(paths.filter((p) => typeof p === "string" && p !== ""));
};

const stepResult = (v, { kind, target, handoff = null, queue_item = null, continues = null, why }) => {
  const { ctx } = v;
  return {
    step: {
      kind,
      skill: skillFor(kind, target, ctx.tree),
      target,
      handoff,
      queue_item,
      continues,
      inputs: inputsFor(ctx, kind, target),
      write_set: writeSet(kind, target, {
        layout: ctx.layout, config: ctx.config, segmentId: v.seg.id, record: v.mode.record(v), tree: ctx.tree,
      }),
      why,
    },
  };
};

const orchestratorStep = (v, kind, why) => stepResult(v, { kind, target: v.seg.id, why });

const cycleStop = (what, cycle) => ({
  stop: { class: "shape", reason: `producer cycle: the ${what} ${cycle.join(", ")} cannot be ordered producer-first (each depends on another through the contracts they produce and consume)` },
});

// The first orderable candidate that has no unfinished stopped chain; a stop when only a cycle is left.
const firstInOrder = (v, kind, { order, cycle }, what, why) => {
  const next = order.find((t) => fresh(v, kind, t));
  if (next !== undefined) return stepResult(v, { kind, target: next, why: why(next) });
  return cycle.length > 0 && order.length === 0 ? cycleStop(what, cycle) : null;
};

// ---------- the plan stages (9.1) ----------

const DONE = Object.freeze({ done: true, unmet: [], rule: () => null });
const notDone = (unmet, rule) => ({ done: false, unmet, rule });

const orchestratorStage = (n, name, kind) => ({
  n, name,
  evaluate: (v) => (committedKind(v, kind)
    ? DONE
    : notDone([`the segment's ${kind} step is not committed`], () => orchestratorStep(v, kind, `stage ${n} ${name}: segment ${v.seg.id} has no ${kind} commit`))),
});

const rootStage = {
  n: 2, name: "Root decomposition",
  evaluate: (v) => {
    const root = v.ctx.config.root;
    const chain = chainOf(v, "root-spec", root);
    const exists = v.ctx.tree.nodes.has(root);
    if (exists && chain === null) return DONE;
    const file = `${v.ctx.layout.spec}/${root}.md`;
    return notDone([chain ? chainLine(chain) : `the root spec ${file} does not exist`],
      () => (chain ? null : stepResult(v, { kind: "root-spec", target: root, why: `stage 2 Root decomposition: the root spec ${file} does not exist` })));
  },
};

const adrStage = {
  n: 3, name: "Root ADRs",
  evaluate: (v) => {
    const missing = missingAdrs(v.ctx);
    const chains = chainsOfKind(v, "adr").filter((c) => !missing.some((m) => m.id === c.target));
    if (missing.length === 0 && chains.length === 0) return DONE;
    const line = (m) => `${m.id} is cited in ${m.file} and has no file`;
    return notDone([...missing.map(line), ...chains.map(chainLine)], () => {
      const next = missing.find((m) => fresh(v, "adr", m.id));
      return next ? stepResult(v, { kind: "adr", target: next.id, why: `stage 3 Root ADRs: ${line(next)}` }) : null;
    });
  },
};

const contractStage = {
  n: 4, name: "Root contracts",
  evaluate: (v) => {
    const missing = missingContracts(v.ctx);
    const chains = chainsOfKind(v, "contract").filter((c) => !missing.some((m) => m.slug === c.target));
    if (missing.length === 0 && chains.length === 0) return DONE;
    const line = (m) => `contract ${m.slug} is named in ${m.file} and has no file`;
    return notDone([...missing.map(line), ...chains.map(chainLine)], () => {
      const order = contractOrder(v.ctx.tree, missing.map((m) => m.slug));
      return firstInOrder(v, "contract", order, "contracts", (slug) => `stage 4 Root contracts: ${line(missing.find((m) => m.slug === slug))}, producer-first`);
    });
  },
};

const midStage = {
  n: 5, name: "Mid-level decomposition",
  evaluate: (v) => {
    const candidates = [...v.ctx.tree.nodes.values()]
      .filter((n) => n.kind === "internal" && n.decomposesInto.length === 0 && notRetired(n)).map((n) => n.id);
    const chains = chainsOfKind(v, "mid-level-spec").filter((c) => !candidates.includes(c.target));
    const earlier = adrStage.evaluate(v).done && contractStage.evaluate(v).done;
    if (candidates.length === 0 && chains.length === 0 && earlier) return DONE;
    const line = (id) => `${id} is internal and its Decomposes into names no child ids`;
    return notDone([...candidates.map(line), ...chains.map(chainLine), ...(earlier ? [] : ["stages 3 and 4 are not done"])],
      () => firstInOrder(v, "mid-level-spec", producerOrder(v.ctx.tree, candidates), "nodes to decompose",
        (id) => `stage 5 Mid-level decomposition: ${line(id)}, producer-first`));
  },
};

const phaseStage = {
  n: 6, name: "Phase plans",
  evaluate: (v) => {
    const { tree } = v.ctx;
    const toPlan = leafParentsToPlan(tree);
    const untabled = toPlan.filter((n) => !n.hasSummaryTable).map((n) => n.id);
    const pending = [...tree.nodes.values()].filter((n) => n.pending.entries > 0);
    const chains = [...chainsOfKind(v, "phase-plan").filter((c) => !untabled.includes(c.target)), ...chainsOfKind(v, "reconcile")];
    if (untabled.length === 0 && pending.length === 0 && chains.length === 0) return DONE;
    const unmet = [
      ...untabled.map((id) => `${id} has no phase summary table`),
      ...pending.map((n) => `${n.id} has ${plural(n.pending.entries, "pending entry", "pending entries")}`),
      ...chains.map(chainLine),
    ];
    return notDone(unmet, () => {
      if (pending.length > 0) {
        const target = ordered(producerOrder(tree, pending.map((n) => n.id))).join(",");
        return fresh(v, "reconcile", target)
          ? stepResult(v, { kind: "reconcile", target, why: `stage 6 Phase plans: pending entries in ${target}, reconciled before the next phase-plan` })
          : null;
      }
      const candidates = toPlan.filter((n) => !n.hasPhasePlan).map((n) => n.id);
      return firstInOrder(v, "phase-plan", producerOrder(tree, candidates), "leaf-parents to plan",
        (id) => `stage 6 Phase plans: ${id} is a leaf-parent with no ## Phase Plan, producer-first`);
    });
  },
};

const OPEN_KINDS = new Set(["must-address", "consider"]);
const openItems = (v) => v.items.filter((it) => OPEN_KINDS.has(it.kind) && it.status === "open");

const TOUCH_BY_TYPE = { node: "spec-touch", contract: "contract-touch", adr: "adr-update" };

// The step an open item's target needs (plan stage 7): { close } for `run` or the request path,
// { kind, target } for a node, contract, ADR or handoff id, null when no kind fits.
const itemNeed = (v, it) => {
  const type = it.target === "run" ? "run" : targetType(it.target, v.ctx.tree);
  if (type === "run" || type === "request") return { close: true };
  if (type === "handoff") {
    const own = v.mode.handoffTarget(v, it.target);
    const ownType = own === null ? null : targetType(own, v.ctx.tree);
    return own !== null && TOUCH_BY_TYPE[ownType] ? { kind: TOUCH_BY_TYPE[ownType], target: own } : null;
  }
  return TOUCH_BY_TYPE[type] ? { kind: TOUCH_BY_TYPE[type], target: it.target } : null;
};

const itemLabel = (it) => `${it.kind} ${it.id} from ${it.from} on ${it.target}`;

// One step per open must-address or consider item, oldest first; then, with `align`, an align on
// the mode's align target when the align condition does not hold.
const consistencyRule = (v, { stage, align }) => {
  for (const it of openItems(v)) {
    const need = itemNeed(v, it);
    if (need === null) continue;
    if (need.close) return { close: { item: it.id, why: `stage ${stage}: ${itemLabel(it)} targets ${it.target}; record the decision and close it in a plan step` } };
    if (!fresh(v, need.kind, need.target)) continue;
    const closes = openItems(v).filter((x) => matches(x, { target: need.target, handoff: null }, v.leafParents)).map((x) => x.id);
    return stepResult(v, {
      kind: need.kind, target: need.target,
      why: `stage ${stage}: ${itemLabel(it)} needs a ${need.kind}; it closes ${closes.join(", ")}`,
    });
  }
  if (openItems(v).length > 0 || !align) return null;
  const target = v.mode.alignTarget(v);
  return fresh(v, "align", target)
    ? stepResult(v, { kind: "align", target, why: `stage ${stage}: no open item; an align on ${target} after the consistency pass` })
    : null;
};

const lastSubagent = (v) => v.segLines.filter((l) => isSubagent(l.kind)).at(-1) ?? null;

// 9.1: the segment's last committed subagent step is a completed align on the mode's target (`all`).
const alignHolds = (v) => {
  const last = lastSubagent(v);
  return last !== null && last.kind === "align" && last.target === v.mode.alignTarget(v) && last.status === "completed";
};

const consistencyStage = {
  n: 7, name: "Consistency",
  evaluate: (v) => {
    const open = openItems(v);
    const holds = alignHolds(v);
    if (open.length === 0 && holds) return DONE;
    const last = lastSubagent(v);
    const lastText = last ? `${last.step_ref} (${last.kind} on ${last.target}, ${last.status})` : "none";
    return notDone([
      ...(open.length > 0 ? [`open items: ${open.map((it) => `${it.id} (${it.kind} on ${it.target})`).join(", ")}`] : []),
      ...(holds ? [] : [`the align condition does not hold: the segment's last committed subagent step is ${lastText}, not a completed align on ${v.mode.alignTarget(v)}`]),
    ], () => consistencyRule(v, { stage: "7 Consistency", align: true }));
  },
};

// 8.10: the report step only when every other condition of the mode holds; otherwise `stuck`.
const reportStage = (n) => ({
  n, name: "Report", report: true,
  evaluate: (v) => {
    if (reportCommitted(v)) return DONE;
    return notDone(["the segment's report step is not committed"], () => {
      const unmet = unmetDone(v.ctx, { final: true });
      return unmet.length === 0
        ? orchestratorStep(v, "report", `stage ${n} Report: every other condition of the segment's done definition holds`)
        : { stuck: unmet };
    });
  },
});

// ---------- modes ----------

// A mode: its stages in order, each `evaluate(view) -> { done, unmet, rule }`, and the rules that
// differ between modes. Intake mode (spec 9.2) is a second row of this table.
const MODES = {
  plan: {
    stages: [
      orchestratorStage(0, "Setup", "setup"),
      orchestratorStage(1, "Plan", "plan"),
      rootStage,
      adrStage,
      contractStage,
      midStage,
      phaseStage,
      consistencyStage,
      reportStage(8),
    ],
    // An item's `after` names an intake handoff (8.7); a plan segment has none, so it holds.
    afterSatisfied: () => true,
    // The target of an intake handoff id; a plan segment has no handoffs.
    handoffTarget: () => null,
    alignTarget: () => "all",
    record: () => null,
    willCreate: planWillCreate,
  },
};

const NO_SEGMENT = "no segment: hsdd/auto/run.yaml has no segments entry; open one with state.mjs open-segment";
const notImplemented = (mode) => `${mode} mode not implemented`;

// ---------- the done definition (9.1, decision S-1) ----------

const finding = (id, message, file) => ({ id, level: "error", message, file });
const findingLine = (f) => `${f.id} ${f.message}${f.file && !f.message.includes(f.file) ? ` (${f.file})` : ""}`;

// Every cited ADR, contract, open-question and phase id resolves; what a stage rule will create is not a failure.
const idFindings = (ctx, creating) => [
  ...ctx.tree.adrCites.filter((c) => !ctx.tree.adrs.has(c.id) && !creating.adrs.has(c.id))
    .map((c) => finding("C3", `${c.id} is cited and has no file`, c.file)),
  ...c5(ctx.tree, { willCreateContracts: creating.contracts }),
  ...c6(ctx.tree),
  ...c7(ctx.tree),
].filter((f) => f.level === "error");

// S-1: a failure counts only when its file changed during the segment.
const scoped = (ctx, findings) => {
  const errors = findings.filter((f) => f.level === "error" && f.file);
  if (errors.length === 0) return [];
  const changed = ctx.changedInSegment(ctx.segment.id);
  return errors.filter((f) => changed.has(f.file)).map(findingLine);
};

// Every contract above v0 is stable with phase_ids final; deprecated and retired ones are exempt (S-2).
const contractLines = (tree) => [...tree.contracts.values()]
  .filter((c) => c.version !== "v0" && c.status !== "deprecated" && c.status !== "retired")
  .flatMap((c) => [
    ...(c.status === "stable" ? [] : [`contract ${c.slug} is ${c.status ?? "without a status"}`]),
    ...(c.phaseIds === "final" ? [] : [`contract ${c.slug} has phase_ids ${c.phaseIds ?? "missing"}`]),
  ]);

// An owner_files entry is a glob when it has a star, else a file or a directory.
const ownerMatcher = (ownerFiles) => {
  const tests = ownerFiles.map((o) => o.replace(/^\.\//, "")).map((o) => {
    if (o.includes("*")) { const re = globToRegExp(o); return (p) => re.test(p); }
    const bare = o.replace(/\/+$/, "");
    return (p) => p === bare || p.startsWith(`${bare}/`);
  });
  return (path) => tests.some((t) => t(path));
};

const cleanTreeLines = (ctx) => {
  const owner = ownerMatcher(ctx.config.owner_files);
  const dirty = ctx.uncommitted().filter((p) => !owner(p));
  return dirty.length === 0 ? [] : [`the working tree has changes outside owner_files: ${dirty.join(", ")}`];
};

// Each unmet condition of the mode's done definition, one human-readable line each. With `final`
// (the final gate's F1) the report stage and the clean working tree are left out. `ledger` is
// validateLedger's result when the caller already has it.
export const unmetDone = (ctx, { final = false, ledger } = {}) => {
  if (ctx.segment === null) return [NO_SEGMENT];
  const mode = MODES[ctx.segment.mode];
  if (!mode) return [notImplemented(ctx.segment.mode)];
  const v = derive(ctx, mode);
  const stageLines = mode.stages
    .filter((s) => !(final && s.report))
    .flatMap((s) => s.evaluate(v).unmet.map((line) => `stage ${s.n} ${s.name}: ${line}`));
  const mustAddress = v.items.filter((it) => it.kind === "must-address" && it.status === "open")
    .map((it) => `${it.from} must-address ${it.id} is open`);
  const registry = ctx.registry();
  return [
    ...stageLines,
    ...contractLines(ctx.tree),
    ...scoped(ctx, [...registry.c0, ...registry.c1]),
    ...scoped(ctx, idFindings(ctx, mode.willCreate(ctx))),
    ...mustAddress,
    ...(ledger ?? validateLedger(ctx.repoRoot)).errors.map((e) => `ledger: ${e}`),
    ...(final ? [] : cleanTreeLines(ctx)),
  ];
};

// ---------- exports for the gate and state ----------

export const stages = (ctx) => {
  if (ctx.segment === null) return [];
  const mode = MODES[ctx.segment.mode];
  if (!mode) return [];
  const v = derive(ctx, mode);
  return mode.stages.map((s) => ({ n: s.n, name: s.name, done: s.evaluate(v).done }));
};

export const willCreate = (ctx) => {
  const mode = MODES[ctx.segment?.mode ?? "plan"];
  return mode ? mode.willCreate(ctx) : { adrs: new Set(), contracts: new Set() };
};

// ---------- the selection order (10.2) ----------

const endedLine = (v) => {
  const last = v.segLines.at(-1);
  return typeof last?.note === "string" && last.note.startsWith("ended:")
    ? `segment ${v.seg.id} was ended at ${last.step_ref} ("${last.note}", spec 8.11); open the next segment with state.mjs open-segment before any further step`
    : null;
};

const insertFrom = (v, step) => v.items.filter((it) => it.kind === "insert-step" && it.from === step);

const continuation = (v) => {
  if (v.ctx.stopExists) return null;
  const c = v.chains.find((ch) => insertFrom(v, ch.step).every((it) => it.status === "addressed" || it.status === "rejected"));
  return c ? stepResult(v, {
    kind: c.kind, target: c.target, handoff: c.handoff, queue_item: c.queue_item, continues: c.step,
    why: `continuation of ${c.step} (${c.kind} on ${c.target}), which stopped and no step continues (spec 8.3)`,
  }) : null;
};

// Accepted, unaddressed insert-step items whose `after` holds, oldest first; an item a stopped
// step's dispatch file names is returned only as that step's continuation.
const insertedStep = (v) => {
  const named = new Set(v.chains.map((c) => c.queue_item).filter(Boolean));
  const it = v.items.find((x) => x.kind === "insert-step" && x.status === "accepted" && !named.has(x.id)
    && (x.after === undefined || v.mode.afterSatisfied(v, x.after)));
  return it ? stepResult(v, {
    kind: it.step_kind, target: it.step_target, queue_item: it.id,
    why: `accepted insert-step ${it.id} from ${it.from}: ${it.text}`,
  }) : null;
};

// S-4: the stages are evaluated from the top on every call; the first unfinished one acts.
const stageRule = (v) => {
  for (const s of v.mode.stages) {
    const e = s.evaluate(v);
    if (!e.done) return e.rule();
  }
  return null;
};

const finish = (v) => {
  const reported = reportCommitted(v);
  const unmet = unmetDone(v.ctx, { final: !reported });
  if (reported && unmet.length === 0) return { done: true };
  return { stuck: unmet.length > 0 ? unmet : ["no stage rule applies and the report step is not committed"] };
};

const firstOf = (thunks) => thunks.reduce((found, f) => found ?? f(), null);

export const selectNext = (ctx) => {
  if (ctx.segment === null) return { stuck: [NO_SEGMENT] };
  if (ctx.inProgress !== null) return { waiting: ctx.inProgress };
  const mode = MODES[ctx.segment.mode];
  if (!mode) return { stuck: [notImplemented(ctx.segment.mode)] };
  const v = derive(ctx, mode);
  return firstOf([
    () => (committedKind(v, "setup") ? null : orchestratorStep(v, "setup", `segment ${v.seg.id} has no setup commit`)),
    () => (committedKind(v, "plan") ? null : orchestratorStep(v, "plan", `segment ${v.seg.id} has no plan commit`)),
    () => (ctx.stopExists ? { blocked: P.stop } : null),
    () => { const line = endedLine(v); return line ? { stuck: [line] } : null; },
    () => { const it = v.items.find((x) => x.kind === "insert-step" && x.status === "open"); return it ? { decide: { item: it.id } } : null; },
    () => continuation(v),
    () => insertedStep(v),
    () => stageRule(v),
  ]) ?? finish(v);
};

// ---------- CLI ----------

const USAGE = "usage: next.mjs [--stages]";

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log, error: console.error }) => {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--stages")) {
    out.error(`usage error: unexpected argument ${argv.find((a) => a !== "--stages") ?? argv[1]}`);
    out.error(USAGE);
    return 2;
  }
  try {
    const ctx = loadContext(repoRoot);
    out.log(JSON.stringify(argv[0] === "--stages" ? stages(ctx) : selectNext(ctx)));
    return 0;
  } catch (e) {
    (Array.isArray(e?.errors) ? e.errors : [e?.message ?? String(e)]).forEach((m) => out.error(m));
    out.error("next: failed");
    return 1;
  }
};

const isEntry = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isEntry()) process.exitCode = main(process.argv.slice(2));
