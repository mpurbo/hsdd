// The next step (spec 10.2), the mode's stages (chapter 9) and the done definition (9.1, 9.2), as
// pure functions of one repository snapshot (lib/context.mjs). The edges are the snapshot's memoized
// reads (ctx.registry(), ctx.changedInSegment(), ctx.uncommitted()) and validateLedger, which only
// the done definition calls, and the target files a `cites-superseded` handoff reads when it comes
// up (12.2). A mode is a row of MODES: its stage table and the few rules that differ between modes.
// Usage: next.mjs [--stages]
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadContext } from "./lib/context.mjs";
import { KINDS, skillFor, targetType, writeSet } from "./lib/kinds.mjs";
import { c3Cited, c5, c6, c7, inScope } from "./lib/checks.mjs";
import { blockErrors, citesSuperseded, guardedHandoffTargets, supersededStrings, targetFiles } from "./lib/intake.mjs";
import { P, ownerMatcher, stepPaths } from "./lib/paths.mjs";
import { contractOrder, contractRoles, firstCited, nodeFiles, ordered, producerOrder } from "./lib/order.mjs";
import { idNum, stepNum } from "./lib/records.mjs";
import { contractTarget, refFile, splitRef, targetVersions } from "./lib/contracts.mjs";
import { leafParentsOf, matches, queueItems } from "./routed.mjs";
import { validateLedger } from "./ledger.mjs";

const unique = (xs) => [...new Set(xs)];
const byIdNum = (a, b) => idNum(a.id) - idNum(b.id);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isSubagent = (kind) => KINDS[kind] !== undefined && !KINDS[kind].orchestrator;
const isStepId = (s) => typeof s === "string" && /^S\d{2,}$/.test(s);

// Producer-first ordering lives in lib/order.mjs; re-exported so earlier imports keep working.
export { contractOrder, producerOrder };

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

export const leafParentsToPlan = (tree) => [...tree.nodes.values()]
  .filter((n) => n.kind === "leaf-parent" && notRetired(n) && n.adopted !== "as-built");

// What a plan segment's stage rules will create: C3 and C5 warn instead of failing on these (10.6).
const planWillCreate = (ctx) => ({
  adrs: new Set(missingAdrs(ctx).map((c) => c.id)),
  contracts: new Set(missingContracts(ctx).map((c) => c.slug)),
});

// ---------- the derived view of a snapshot ----------

// A committed subagent step whose dispatch file exists but cannot be read (final review A3): the
// handoff and queue item it carried are unknown, so it is a stuck line, never a step that named none.
const unreadableLine = (ctx, step) => {
  const d = ctx.dispatches.get(step);
  return d !== undefined && d.front === null
    ? `the committed dispatch file ${stepPaths(step).dispatch} cannot be read (${d.error}); the handoff and queue item ${step} carried are unknown`
    : null;
};

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
      return {
        step: l.step_ref, kind: l.kind, target: l.target, handoff: front?.handoff ?? null, queue_item: front?.queue_item ?? null,
        unreadable: unreadableLine(ctx, l.step_ref),
      };
    });
};

// `mode.view(ctx)` adds what only that mode reads (intake: the record, its handoffs and their
// states) and `handoffTargets`, the matching rule's handoff map (B-10).
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
    ...mode.view(ctx),
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
// The file of each version a node's Consumes and Produces cite (v0.10.0 §3.1).
const refFiles = (tree, refs) => refs.map((r) => refFile(tree, r.slug, r.version)?.file);
const adrFiles = (tree, ids) => ids.map((id) => tree.adrs.get(id)?.file);
const targetNodes = (tree, target) => (target === "all" ? leafParentsOf(tree) : target.split(",").map((s) => s.trim()));

// A target's files: a contract id's every version file, or the one version `{id}.v{n}` names.
const filesOfTarget = (tree, target) => {
  switch (targetType(target, tree)) {
    case "node": return [tree.nodes.get(target)?.file];
    case "contract": return targetVersions(tree, target).map((c) => c.file);
    case "adr": return [tree.adrs.get(target)?.file];
    case "request": return [target];
    default: return [];
  }
};

// An ADR's `affects` entry: a node or phase's spec file, or the file of the contract version it names.
const affectsFiles = (tree, ref) => {
  const { name, version } = splitRef(ref);
  return contractTarget(tree, name) !== null ? [refFile(tree, name, version)?.file] : filesOfTarget(tree, name);
};

// The files the step's template names (appendix C.2a), as far as the tree knows them; target first.
const inputsFor = (ctx, kind, target) => {
  const { tree, config } = ctx;
  const node = tree.nodes.get(target);
  const forNode = (withParent) => (node
    ? [node.file, ...(withParent ? parentFiles(tree, target) : []), ...refFiles(tree, [...node.consumes, ...node.produces]), ...adrFiles(tree, node.governedBy)]
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
        const affects = (tree.adrs.get(target)?.affects ?? []).flatMap((a) => affectsFiles(tree, a));
        const files = specFileOrder(tree);
        const citing = files.filter((f) => tree.adrCites.some((c) => c.id === target && c.file === f));
        return [tree.adrs.get(target)?.file, ...citing, ...affects];
      }
      case "contract": case "contract-touch": {
        const id = contractTarget(tree, target)?.id ?? target;
        const { producers, consumers } = contractRoles(tree);
        const governing = [...tree.adrs.values()].filter((a) => a.affects.some((x) => splitRef(x).name === id)).map((a) => a.file);
        return [...filesOfTarget(tree, target), ...nodeFiles(tree, [...(producers.get(id) ?? [])]),
          ...nodeFiles(tree, [...(consumers.get(id) ?? [])]), ...governing];
      }
      case "citation-touch":
        return filesOfTarget(tree, target);
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

// Every mode starts with these two; the selection order also returns them ahead of `blocked` (10.2).
const SETUP_STAGE = orchestratorStage(0, "Setup", "setup");
const PLAN_STAGE = orchestratorStage(1, "Plan", "plan");

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

// The step an open item's target needs (plan stage 7, intake stage 4): { close } for `run` or the
// request path, { kind, target } for a node, contract or ADR, or for a handoff id the touch of the
// handoff's own target (B-10); null when no kind fits.
const itemNeed = (v, it) => {
  const type = it.target === "run" ? "run" : targetType(it.target, v.ctx.tree);
  if (type === "run" || type === "request") return { close: true };
  if (type === "handoff") {
    const own = v.handoffTargets.get(it.target) ?? null;
    const ownType = own === null ? null : targetType(own, v.ctx.tree);
    return own !== null && TOUCH_BY_TYPE[ownType] ? { kind: TOUCH_BY_TYPE[ownType], target: own } : null;
  }
  return TOUCH_BY_TYPE[type] ? { kind: TOUCH_BY_TYPE[type], target: it.target } : null;
};

const itemLabel = (it) => `${it.kind} ${it.id} from ${it.from} on ${it.target}`;
const openLine = (open) => `open items: ${open.map((it) => `${it.id} (${it.kind} on ${it.target})`).join(", ")}`;

// One step per open must-address or consider item, oldest first; then, with `align`, an align on
// the mode's align target when the align condition does not hold.
const consistencyRule = (v, { stage, align }) => {
  for (const it of openItems(v)) {
    const need = itemNeed(v, it);
    if (need === null) continue;
    if (need.close) return { close: { item: it.id, why: `stage ${stage}: ${itemLabel(it)} targets ${it.target}; record the decision and close it in a plan step` } };
    if (!fresh(v, need.kind, need.target)) continue;
    const closes = openItems(v).filter((x) => matches(x, { target: need.target, handoff: null }, v.leafParents, v.handoffTargets)).map((x) => x.id);
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
const targetSet = (t) => t.split(",").map((x) => x.trim()).filter(Boolean).sort().join(",");

// 9.1: the segment's last committed subagent step is a completed align on the mode's target (plan:
// `all`; intake: the leaf-parents not re-planned, compared as a set). An intake segment whose
// leaf-parents were all re-planned has no target (null), and the condition holds without an align.
const alignHolds = (v) => {
  const target = v.mode.alignTarget(v);
  if (target === null) return true;
  const last = lastSubagent(v);
  if (last === null || last.kind !== "align" || last.status !== "completed") return false;
  // `all` stands for every leaf-parent of the segment, which covers any smaller required set.
  if (last.target === "all") return target === "all" || targetSet(target).split(",").every((id) => v.leafParents.includes(id));
  return targetSet(last.target) === targetSet(target);
};

const alignLine = (v) => {
  const last = lastSubagent(v);
  const lastText = last ? `${last.step_ref} (${last.kind} on ${last.target}, ${last.status})` : "none";
  return `the align condition does not hold: the segment's last committed subagent step is ${lastText}, not a completed align on ${v.mode.alignTarget(v)}`;
};

const consistencyStage = {
  n: 7, name: "Consistency",
  evaluate: (v) => {
    const open = openItems(v);
    const holds = alignHolds(v);
    if (open.length === 0 && holds) return DONE;
    return notDone([...(open.length > 0 ? [openLine(open)] : []), ...(holds ? [] : [alignLine(v)])],
      () => consistencyRule(v, { stage: "7 Consistency", align: true }));
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

// ---------- intake (9.2, 6.12) ----------

const PLAN_KINDS = new Set(["phase-plan", "phase-plan-append"]);
const SETTLED = new Set(["executed", "skipped"]);

const finished = (ctx, segId) => ctx.committedRunLines.some((l) => l.segment === segId && l.kind === "report" && l.status === "completed");

// The segments of the current intake: the newest, and the earlier ones with the same request after
// the last of those that finished. A segment opened by an answer or an owner message copies the
// request and continues the intake (5.5); a finished segment ended it, so a later segment on the
// same request is a new intake.
const intakeSegments = (ctx) => {
  const same = ctx.segments.slice(0, -1).filter((s) => s.mode === "intake" && s.request === ctx.segment.request);
  const last = same.findLastIndex((s) => finished(ctx, s.id));
  return new Set([...same.slice(last + 1).map((s) => s.id), ctx.segment.id]);
};

// Why the record does not route the intake: no block, a block C8 rejects (`errors`, blockErrors),
// or a structural class, whose handoffs are the owner's decision (the intake step stops, 9.2).
const recordProblems = (record, errors) => {
  if (record.block === null && record.blockError === null) return ["no hsdd-handoffs block in its ## Routing section"];
  if (errors.length > 0) return errors;
  return record.cls === "structural" ? ["class structural: its handoffs are the owner's decision, so the intake step stops with shape (spec 9.2)"] : [];
};

// Each handoff of the block as executed, skipped or pending (6.12), across the intake's segments:
// executed when a completed step's dispatch file names it (a completed continuation names it too),
// skipped when a committed skip line names it. `step` is the executing step, or for a pending
// handoff its newest (stopped) step.
const statesOf = (ctx, segs, lines, handoffs) => {
  const skipped = new Set(ctx.committedHandoffLines.filter((l) => segs.has(l.segment)).map((l) => l.handoff));
  return handoffs.map((h) => {
    const steps = lines.filter((l) => ctx.dispatches.get(l.step_ref)?.front?.handoff === h.id);
    const done = steps.filter((l) => l.status === "completed").at(-1);
    const state = done ? "executed" : skipped.has(h.id) ? "skipped" : "pending";
    const step = done ? done.step_ref : state === "pending" ? (steps.at(-1)?.step_ref ?? null) : null;
    return { id: h.id, kind: h.kind, target: h.target, state, step };
  });
};

// Leaf-parents a completed phase-plan or phase-plan-append re-planned (9.1's align condition): in
// this segment, and in the intake's earlier segments from the record's intake step on.
const replannedOf = (ctx, lines) => {
  const intake = lines.find((l) => l.kind === "intake");
  const from = intake ? stepNum(intake.step_ref) : Infinity;
  return new Set(lines
    .filter((l) => PLAN_KINDS.has(l.kind) && l.status === "completed" && (l.segment === ctx.segment.id || stepNum(l.step_ref) >= from))
    .map((l) => l.target));
};

// What an intake segment reads beyond the shared view. The segment's record (9.2) counts only once
// an intake step of this intake completed, so neither a stopped step's partial record nor an
// earlier intake's record routes it.
const intakeView = (ctx) => {
  const segs = intakeSegments(ctx);
  const lines = ctx.committedRunLines.filter((l) => segs.has(l.segment) && isStepId(l.step_ref));
  const wrote = lines.find((l) => l.kind === "intake" && l.status === "completed") ?? null;
  const record = wrote ? ctx.intake.record : null;
  const errors = record ? blockErrors(record, ctx.tree) : [];
  const handoffs = record && record.block !== null && errors.length === 0 ? record.block.handoffs : [];
  return {
    intake: {
      lines, wrote, record, handoffs,
      problems: record ? recordProblems(record, errors) : [],
      unreadable: lines.filter((l) => isSubagent(l.kind)).flatMap((l) => unreadableLine(ctx, l.step_ref) ?? []),
      states: statesOf(ctx, segs, lines, handoffs),
      replanned: replannedOf(ctx, lines),
    },
    handoffTargets: guardedHandoffTargets(record, ctx.tree),
  };
};

// The matching rule's handoff map for the segment, from one call (dispatch and the gate use it):
// empty outside an intake segment, before a completed intake step wrote the record, and when C8
// rejects the block.
export const intakeHandoffTargets = (ctx) => (ctx.segment?.mode === "intake" ? intakeView(ctx).handoffTargets : new Map());

// [{ id, kind, target, state: "executed"|"skipped"|"pending", step }] for the segment's record.
export const handoffStates = (ctx) => (ctx.segment?.mode === "intake" ? intakeView(ctx).intake.states : []);

// C3 and C5 warn on what a not yet executed intake handoff of kind `adr` or `contract` will create (10.6).
const intakeWillCreate = (ctx) => {
  const pending = handoffStates(ctx).filter((h) => h.state === "pending");
  const of = (kind) => new Set(pending.filter((h) => h.kind === kind).map((h) => h.target));
  return { adrs: of("adr"), contracts: of("contract") };
};

const routeStage = {
  n: 2, name: "Route",
  evaluate: (v) => {
    const { request } = v.seg;
    const { wrote, record, problems } = v.intake;
    const chain = chainOf(v, "intake", request);
    if (chain !== null) return notDone([chainLine(chain)], () => null);
    if (wrote === null) {
      const line = `no intake step of this intake has written a record for ${request}`;
      return notDone([line], () => stepResult(v, { kind: "intake", target: request, why: `stage 2 Route: ${line}` }));
    }
    if (record === null) {
      return notDone([`${wrote.step_ref} completed, but no ${v.ctx.layout.management}/*-intake-*.md names ${request} in its **Request:** line`], () => null);
    }
    return problems.length === 0 ? DONE : notDone(problems.map((p) => `the intake record ${record.path}: ${p}`), () => null);
  },
};

const settledIn = (states, id) => SETTLED.has(states.find((s) => s.id === id)?.state);
// 12.2: a handoff waits on its `after` list; an empty list means the previous handoff.
const waitsOn = (handoffs, i) => (handoffs[i].after.length > 0 ? handoffs[i].after : i > 0 ? [handoffs[i - 1].id] : []);
// The unfinished stopped chain of this intake whose dispatch file names the handoff (8.3).
const stoppedHandoff = (v, id) => v.chains.find((c) => c.handoff === id && v.intake.lines.some((l) => l.step_ref === c.step)) ?? null;
const handoffLabel = (h) => `${h.id} (${h.kind} on ${h.target})`;

// The first pending handoff in block order whose `after` holds and that no stopped step names (such
// a handoff is returned only as that step's continuation, 10.2): `skip` when its `when` condition
// does not hold, evaluated now (12.2), else its step.
const nextHandoff = (v, pending) => {
  const { ctx } = v;
  const { handoffs, states } = v.intake;
  const ready = pending.find(({ h, i }) => waitsOn(handoffs, i).every((id) => settledIn(states, id))
    && stoppedHandoff(v, h.id) === null && fresh(v, h.kind, h.target));
  if (ready === undefined) return null;
  const { h } = ready;
  const why = `stage 3 Handoffs: ${handoffLabel(h)}, the next in block order whose after list is executed or skipped`;
  if (h.when !== "cites-superseded") return stepResult(v, { kind: h.kind, target: h.target, handoff: h.id, why });
  const files = targetFiles(h.kind, h.target, ctx.layout, ctx.tree);
  return citesSuperseded(ctx.repoRoot, files, supersededStrings(ctx.config, ctx.tree))
    ? stepResult(v, { kind: h.kind, target: h.target, handoff: h.id, why: `${why}; cites-superseded holds for ${files.join(", ")}` })
    : { skip: { handoff: h.id, reason: `cites-superseded does not hold: ${files.join(", ") || `no file of ${h.target}`} names no baseline source path or version and no superseded contract version` } };
};

const handoffStage = {
  n: 3, name: "Handoffs",
  evaluate: (v) => {
    const { handoffs, states, record, problems, unreadable } = v.intake;
    // Final review A4: no handoff is known until the record routes the intake (stage 2 acts first).
    if (record === null || problems.length > 0) return notDone(["no handoff is known until the intake record routes the intake (stage 2)"], () => null);
    if (unreadable.length > 0) return notDone(unreadable, () => ({ stuck: unreadable }));
    const pending = handoffs.map((h, i) => ({ h, i })).filter(({ i }) => states[i].state === "pending");
    if (pending.length === 0) return DONE;
    const line = ({ h, i }) => {
      const chain = stoppedHandoff(v, h.id);
      const waits = waitsOn(handoffs, i).filter((id) => !settledIn(states, id));
      return `${handoffLabel(h)} is pending${chain ? `: ${chainLine(chain)}` : waits.length > 0 ? `, waiting on ${waits.join(", ")}` : ""}`;
    };
    return notDone(pending.map(line), () => nextHandoff(v, pending));
  },
};

// Plan stage 7 without the align (9.2).
const intakeConsistencyStage = {
  n: 4, name: "Consistency",
  evaluate: (v) => {
    const open = openItems(v);
    return open.length === 0 ? DONE : notDone([openLine(open)], () => consistencyRule(v, { stage: "4 Consistency", align: false }));
  },
};

// The leaf-parents no step of this intake re-planned, producer-first and comma-separated; null when
// there is none, which holds the align condition without an align (9.1).
const intakeAlignTarget = (v) => {
  const ids = v.leafParents.filter((id) => !v.intake.replanned.has(id));
  return ids.length === 0 ? null : ordered(producerOrder(v.ctx.tree, ids)).join(",");
};

const alignStage = {
  n: 5, name: "Align",
  evaluate: (v) => {
    if (alignHolds(v)) return DONE;
    const target = intakeAlignTarget(v);
    return notDone([alignLine(v)], () => (fresh(v, "align", target)
      ? stepResult(v, { kind: "align", target, why: `stage 5 Align: an align on ${target}, the leaf-parents no step of this intake re-planned` })
      : null));
  },
};

// ---------- modes ----------

// A mode: its stages in order, each `evaluate(view) -> { done, unmet, rule }`, and the rules that
// differ between modes.
const MODES = {
  plan: {
    stages: [
      SETUP_STAGE,
      PLAN_STAGE,
      rootStage,
      adrStage,
      contractStage,
      midStage,
      phaseStage,
      consistencyStage,
      reportStage(8),
    ],
    // A plan segment has no handoffs.
    view: () => ({ handoffTargets: new Map() }),
    // An item's `after` names an intake handoff (8.7); a plan segment has none, so it holds.
    afterSatisfied: () => true,
    alignTarget: () => "all",
    record: () => null,
    willCreate: planWillCreate,
  },
  intake: {
    stages: [
      SETUP_STAGE,
      PLAN_STAGE,
      routeStage,
      handoffStage,
      intakeConsistencyStage,
      alignStage,
      reportStage(6),
    ],
    view: intakeView,
    // 8.7: the named handoff, or every handoff, is executed or skipped. Before the record routes
    // the intake no handoff is known, so the item waits; an id the block does not list waits for
    // every handoff, so the item neither runs early nor waits for ever.
    afterSatisfied: (v, after) => {
      const { record, problems, states } = v.intake;
      if (record === null || problems.length > 0) return false;
      const ids = states.some((s) => s.id === after) ? [after] : states.map((s) => s.id);
      return ids.every((id) => settledIn(states, id));
    },
    alignTarget: intakeAlignTarget,
    record: (v) => v.intake.record?.path ?? null,
    willCreate: intakeWillCreate,
  },
};

const NO_SEGMENT = "no segment: hsdd/auto/run.yaml has no segments entry; open one with state.mjs open-segment";
const notImplemented = (mode) => `${mode} mode not implemented`;

// ---------- the done definition (9.1, decision S-1) ----------

export const findingLine = (f) => `${f.id} ${f.message}${f.file && !f.message.includes(f.file) ? ` (${f.file})` : ""}`;

// Every cited ADR, contract, open-question and phase id resolves; what a stage rule will create is not a failure.
export const idFindings = (ctx, creating) => [
  ...c3Cited(ctx.tree, { willCreateAdrs: creating.adrs }),
  ...c5(ctx.tree, { willCreateContracts: creating.contracts }),
  ...c6(ctx.tree),
  ...c7(ctx.tree),
].filter((f) => f.level === "error");

// S-1: a failure counts only when its file, or a file related to it, changed during the segment, counted
// from the first setup of the stopped or ended segments it continues (ctx.changedInSegment).
const scoped = (ctx, findings) => {
  const errors = findings.filter((f) => f.level === "error");
  if (errors.length === 0) return [];
  const changed = ctx.changedInSegment(ctx.segment.id);
  return errors.filter((f) => inScope(f, changed)).map(findingLine);
};

// Every contract version above v0 is stable with phase_ids final; deprecated and retired ones are
// exempt (S-2). Each version is its own file (v0.10.0 §3.1), named by its file name without `.md`.
const finalExempt = (c) => c.version === "v0" || c.status === "deprecated" || c.status === "retired";
export const contractsNotFinal = (tree) => tree.contractFiles
  .filter((c) => !finalExempt(c) && (c.status !== "stable" || c.phaseIds !== "final"))
  .map((c) => c.stem);

const contractLines = (tree) => tree.contractFiles
  .filter((c) => !finalExempt(c))
  .flatMap((c) => [
    ...(c.status === "stable" ? [] : [`contract ${c.stem} is ${c.status ?? "without a status"}`]),
    ...(c.phaseIds === "final" ? [] : [`contract ${c.stem} has phase_ids ${c.phaseIds ?? "missing"}`]),
  ]);

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

// 10.2 returns the newest segment's setup, then plan, ahead of `blocked`, so a segment opened by an
// owner's answer can remove STOP.md; not when a step of that segment stopped (a hard stop in its
// setup, say), which 6.7 blocks on.
const earlyStage = (v, stage) => {
  if (v.segLines.some((l) => l.status === "stopped")) return null;
  const e = stage.evaluate(v);
  return e.done ? null : e.rule();
};

export const selectNext = (ctx) => {
  if (ctx.segment === null) return { stuck: [NO_SEGMENT] };
  if (ctx.inProgress !== null) return { waiting: ctx.inProgress };
  const mode = MODES[ctx.segment.mode];
  if (!mode) return { stuck: [notImplemented(ctx.segment.mode)] };
  const v = derive(ctx, mode);
  return firstOf([
    () => earlyStage(v, SETUP_STAGE),
    () => earlyStage(v, PLAN_STAGE),
    () => (ctx.stopExists ? { blocked: P.stop } : null),
    () => { const line = endedLine(v); return line ? { stuck: [line] } : null; },
    () => { const it = v.items.find((x) => x.kind === "insert-step" && x.status === "open"); return it ? { decide: { item: it.id } } : null; },
    () => { const bad = v.chains.flatMap((c) => c.unreadable ?? []); return bad.length > 0 ? { stuck: bad } : null; },
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
