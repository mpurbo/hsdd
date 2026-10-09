// Graphs the plan page draws, derived from the model. Pure functions; this
// file is also inlined into the page, so it imports nothing.

export const MAX_BOXES = 12;
// A collapsed graph is a chain of steps; past this many it reads better as a list.
export const MAX_STEPS = 6;
export const OUTSIDE = "(outside)";

export function nodeById(model) {
  return new Map(model.nodes.map((n) => [n.id, n]));
}

export function activeChildren(model, id) {
  const byId = nodeById(model);
  return (byId.get(id)?.children ?? []).map((c) => byId.get(c)).filter((n) => n && n.status === "active");
}

export function subtree(model, id) {
  const byId = nodeById(model);
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop();
    if (out.has(x) || !byId.has(x)) continue;
    out.add(x);
    stack.push(...byId.get(x).children);
  }
  return out;
}

// contract id -> node ids that produce it (node fields, phase fields, owner, produced_by).
export function producers(model) {
  const out = new Map();
  const put = (cid, node) => {
    if (!out.has(cid)) out.set(cid, new Set());
    out.get(cid).add(node);
  };
  const nodes = new Set(model.nodes.map((n) => n.id));
  for (const n of model.nodes) for (const r of n.produces) put(r.ref.split("@")[0], n.id);
  for (const p of model.phases) for (const r of p.produces) put(r.ref.split("@")[0], p.node);
  for (const c of model.contracts) {
    if (nodes.has(c.owner)) put(c.id, c.owner);
    for (const pid of c.producedBy) {
      const node = pid.replace(/\.\d+$/, "");
      if (nodes.has(node)) put(c.id, node);
    }
  }
  return out;
}

function consumedIn(model, ids) {
  const refs = new Map();
  for (const n of model.nodes) if (ids.has(n.id)) for (const r of n.consumes) refs.set(r.ref, r);
  for (const p of model.phases) if (ids.has(p.node)) for (const r of p.consumes) refs.set(r.ref, r);
  return [...refs.values()];
}

function edgeKind(model, refs) {
  const kinds = new Set(refs.map((ref) => model.contracts.find((c) => c.id === ref.split("@")[0])?.kind ?? "api"));
  if (kinds.size === 1 && kinds.has("event")) return "event";
  if (kinds.size === 1 && kinds.has("shared-model")) return "shared-model";
  return "contract";
}

// Boxes are the active children of `parentId`; an edge A -> B means something
// in B's subtree consumes a contract something in A's subtree produces.
// Contracts produced outside the tree arrive from one OUTSIDE box.
export function childGraph(model, parentId) {
  const kids = activeChildren(model, parentId);
  const subs = new Map(kids.map((k) => [k.id, subtree(model, k.id)]));
  const prod = producers(model);
  const external = new Set(model.contracts.filter((c) => c.external).map((c) => c.id));
  const edges = new Map();
  const addEdge = (from, to, ref) => {
    const key = `${from}|${to}`;
    if (!edges.has(key)) edges.set(key, { from, to, refs: [] });
    if (!edges.get(key).refs.includes(ref)) edges.get(key).refs.push(ref);
  };
  for (const b of kids) {
    for (const r of consumedIn(model, subs.get(b.id))) {
      const cid = r.ref.split("@")[0];
      const from = kids.filter((a) => a.id !== b.id && [...(prod.get(cid) ?? [])].some((p) => subs.get(a.id).has(p)));
      for (const a of from) addEdge(a.id, b.id, r.ref);
      if (!from.length && (r.ext || external.has(cid)) && !(prod.get(cid)?.size)) addEdge(OUTSIDE, b.id, r.ref);
    }
  }
  const list = [...edges.values()].map((e) => ({ ...e, kind: edgeKind(model, e.refs) }));
  return { boxes: kids.map((k) => k.id), outside: list.some((e) => e.from === OUTSIDE), edges: list };
}

// Longest-path layering over in-set dependencies: layer 0 depends on nothing in the set.
export function layers(ids, depsOf) {
  const set = new Set(ids);
  const memo = new Map();
  const depth = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const ds = (depsOf(id) ?? []).filter((d) => set.has(d));
    const v = ds.length ? 1 + Math.max(...ds.map((d) => depth(d, seen))) : 0;
    memo.set(id, v);
    return v;
  };
  const out = [];
  for (const id of ids) {
    const d = depth(id);
    (out[d] ??= []).push(id);
  }
  return out.filter(Boolean);
}

export function reachesIn(depsOf, from, to) {
  const seen = new Set();
  const stack = [...(depsOf(from) ?? [])];
  while (stack.length) {
    const x = stack.pop();
    if (x === to) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(depsOf(x) ?? []));
  }
  return false;
}

// A leaf-parent's phases: in-node dependency edges, collisions no dependency
// orders (drawn), the count of ordered ones (not drawn), cross-node
// dependencies, and the layering used when the graph is too large to draw.
export function phaseGraph(model, nodeId) {
  const ps = model.phases.filter((p) => p.node === nodeId);
  const ids = ps.map((p) => p.id);
  const set = new Set(ids);
  const byId = new Map(ps.map((p) => [p.id, p]));
  const depsOf = (id) => (byId.get(id)?.dependsOn ?? []).filter((d) => set.has(d));
  const edges = ps.flatMap((p) => depsOf(p.id).map((d) => ({ from: d, to: p.id, kind: "depends" })));
  const collisions = [];
  let orderedCollisions = 0;
  const seen = new Set();
  for (const p of ps) for (const o of p.collidesWith) {
    if (!set.has(o)) continue;
    const key = [p.id, o].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (reachesIn(depsOf, p.id, o) || reachesIn(depsOf, o, p.id)) orderedCollisions++;
    else collisions.push({ from: [p.id, o].sort()[0], to: [p.id, o].sort()[1], kind: "collides" });
  }
  const cross = ps.flatMap((p) => p.dependsOn.filter((d) => !set.has(d)).map((d) => ({ phase: p.id, on: d })));
  const steps = layers(ids, depsOf);
  return { ids, edges, collisions, orderedCollisions, cross, steps, collapsed: ids.length > MAX_BOXES };
}
