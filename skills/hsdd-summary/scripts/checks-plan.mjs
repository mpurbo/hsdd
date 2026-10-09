// Cross-checks over a plan model. Errors mean the extraction is wrong and stop
// render; findings are facts about the tree and appear on the page.

export function reaches(deps, from, to) {
  const seen = new Set();
  const stack = [...(deps.get(from) ?? [])];
  while (stack.length) {
    const x = stack.pop();
    if (x === to) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(deps.get(x) ?? []));
  }
  return false;
}

function findCycle(ids, deps) {
  const state = new Map();
  const path = [];
  const visit = (id) => {
    state.set(id, 1);
    path.push(id);
    for (const d of deps.get(id) ?? []) {
      if (state.get(d) === 1) return [...path.slice(path.indexOf(d)), d];
      if (!state.has(d)) {
        const c = visit(d);
        if (c) return c;
      }
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of ids) if (!state.has(id)) {
    const c = visit(id);
    if (c) return c;
  }
  return null;
}

export function crossCheckPlan(model) {
  const errors = [];
  const findings = [];
  const add = (node, kind, message, extra = {}) => findings.push({ node, kind, message, ...extra });

  if (model.unparsed.length) {
    const u = model.unparsed[0];
    errors.push(`${model.unparsed.length} unparsed item(s) remain; first: ${u.path} (${u.file}:${u.line}) ${u.reason}`);
  }
  const nodeIds = new Set();
  for (const n of model.nodes) {
    if (nodeIds.has(n.id)) errors.push(`node ${n.id} appears twice`);
    nodeIds.add(n.id);
  }
  for (const n of model.nodes) if (n.parent !== null && !nodeIds.has(n.parent)) errors.push(`node ${n.id} names parent ${n.parent}, which is not a node`);

  const phaseIds = new Set();
  for (const p of model.phases) {
    if (phaseIds.has(p.id)) errors.push(`phase ${p.id} appears twice`);
    phaseIds.add(p.id);
  }
  const tableOnly = new Set(model.nodes.flatMap((n) => (n.tableOnly ?? []).map((t) => t.id)));
  const deps = new Map(model.phases.map((p) => [p.id, p.dependsOn]));
  for (const p of model.phases) {
    for (const d of [...p.dependsOn, ...p.collidesWith]) {
      if (!phaseIds.has(d) && !tableOnly.has(d)) errors.push(`phase ${p.id} names ${d}, which is not a phase`);
    }
  }
  const cycle = findCycle(model.phases.map((p) => p.id), deps);
  if (cycle) errors.push(`phase dependencies form a cycle: ${cycle.join(" -> ")}`);

  for (const n of model.nodes) {
    for (const t of n.tableOnly ?? []) add(n.id, "table-only", `the summary table lists ${t.id}, but no phase section exists`, { phase: t.id });
    if (n.sourceFile !== `hsdd/spec/${n.id}.md`) add(n.id, "no-spec-file", `${n.id} is described only inside ${n.sourceFile}; it has no spec file of its own`);
    if (n.pendingGovernance) add(n.id, "pending-governance", "governance updates are waiting for reconcile");
  }
  for (const p of model.phases) if (!p.inTable) add(p.node, "not-in-table", `${p.id} has a phase section but no summary-table row`, { phase: p.id });

  const byId = new Map(model.contracts.map((c) => [c.id, c]));
  const seenRef = new Set();
  // Version drift is checked on node fields only: a phase cites the version it
  // was planned against, and a finished phase citing an older one is history.
  const citing = [...model.nodes.map((n) => ({ node: n.id, refs: [...n.consumes, ...n.produces], current: true })), ...model.phases.map((p) => ({ node: p.node, refs: [...p.consumes, ...p.produces], current: false }))];
  for (const { node, refs, current } of citing) {
    for (const r of refs) {
      const key = `${node}|${r.ref}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      const [cid, ver] = r.ref.split("@");
      const c = byId.get(cid);
      if (!c && !r.ext) add(node, "unwritten-contract", `${r.ref} is named, not yet written`, { ref: r.ref });
      else if (current && c && c.version && c.version !== ver) add(node, "version-mismatch", `${r.ref} is cited; the contract file is at ${c.version}`, { ref: r.ref });
    }
  }
  for (const c of model.contracts) {
    if (c.phaseIds === "provisional") add(nodeIds.has(c.owner) ? c.owner : model.project.root, "provisional-contract", `${c.ref} is provisional: reconcile has not confirmed its phase ids`, { ref: c.ref });
  }

  const adrs = new Map(model.adrs.map((a) => [a.id, a]));
  const seenAdr = new Set();
  for (const x of [...model.nodes.map((n) => ({ node: n.id, ids: n.governedBy })), ...model.phases.map((p) => ({ node: p.node, ids: p.governedBy }))]) {
    for (const id of x.ids) {
      const key = `${x.node}|${id}`;
      if (seenAdr.has(key)) continue;
      seenAdr.add(key);
      const a = adrs.get(id);
      if (!a) add(x.node, "adr-missing", `${id} is cited, but no ADR file exists`, { adr: id });
      else if (a.status === "proposed") add(x.node, "adr-proposed", `${id} is proposed: not binding until accepted`, { adr: id });
    }
  }

  const oqHome = new Map();
  for (const n of model.nodes) for (const q of n.openQuestions) {
    if (oqHome.has(q.id)) add(n.id, "oq-duplicate", `${q.id} is defined here and in ${oqHome.get(q.id).node}`, { oq: q.id });
    else oqHome.set(q.id, { node: n.id, q });
    if (!q.hasDetail) add(n.id, "oq-no-detail", `${q.id} has a table row but no detail subsection`, { oq: q.id });
  }
  for (const p of model.phases) {
    for (const id of p.citesOq) if (!oqHome.has(id)) add(p.node, "oq-undefined", `${p.id} cites ${id}, which no spec defines`, { phase: p.id, oq: id });
    for (const id of p.contingentOn) {
      const home = oqHome.get(id);
      if (home && home.q.status !== "RESOLVED") add(p.node, "contingent", `${p.id} is contingent on ${id} (${home.q.status})`, { phase: p.id, oq: id });
    }
  }

  const seenPair = new Set();
  for (const p of model.phases) for (const o of p.collidesWith) {
    const pair = [p.id, o].sort().join("|");
    if (seenPair.has(pair) || !phaseIds.has(o)) continue;
    seenPair.add(pair);
    const ordered = reaches(deps, p.id, o) || reaches(deps, o, p.id);
    add(p.node, ordered ? "collision-ordered" : "collision", ordered ? `${p.id} and ${o} edit the same files; a dependency already orders them` : `${p.id} and ${o} edit the same files and nothing orders them`, { phase: p.id, other: o });
  }
  return { errors, findings };
}
