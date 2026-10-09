// The plan page's views. Pure: (page data, route) -> { title, crumbs, body,
// diagrams }. Inlined into the page with views-core.mjs and graph.mjs.
import { html, raw, inline, block, plural, href, chip, section, sourceLink, diagramSlot, capitalize } from "./views-core.mjs";
import { childGraph, phaseGraph, subtree, activeChildren, OUTSIDE, ELSEWHERE, MAX_BOXES, MAX_STEPS } from "./graph.mjs";

export const PLAN_AUDIENCES = ["reviewer", "stakeholder", "implementer"];

const TIER_WORDS = { "gate-only": "light check", "spot-check": "quick look", "full-review": "full review" };
const STATUS_WORDS = { stable: "agreed", draft: "draft", deprecated: "being phased out", retired: "retired" };

export function renderPlan(page, route) {
  const model = page.model;
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const ctx = { page, model, byId, a: route.audience, stake: route.audience === "stakeholder" };
  const root = model.project.root;
  if (route.view === "node" && byId.has(route.id)) return planNode(ctx, route.id);
  if (route.view === "phase") {
    const p = model.phases.find((x) => x.id === route.id);
    if (p) return ctx.stake ? planNode(ctx, p.node) : planPhase(ctx, p);
  }
  if (route.view === "contracts") return planContracts(ctx);
  if (route.view === "contract") {
    const c = model.contracts.find((x) => x.ref === route.id);
    if (c) return planContract(ctx, c);
  }
  if (route.view === "adrs") return planAdrs(ctx);
  return planNode(ctx, root);
}

function prose(ctx, key) {
  return ctx.page.prose[key] ?? "";
}

function gloss(ctx, ref) {
  return ctx.page.gloss[String(ref).split("@")[0]] ?? "";
}

function crumbsTo(ctx, id) {
  const out = [];
  for (let n = ctx.byId.get(id); n; n = n.parent ? ctx.byId.get(n.parent) : null) out.unshift({ label: n.name, href: href(ctx.a, "node", n.id) });
  return out;
}

function isLeaf(n) {
  return n.kind === "leaf-parent" || n.kind === "integration";
}

function kindLabel(ctx, n) {
  if (ctx.stake) return n.kind === "root" ? "The whole plan" : isLeaf(n) ? "A part of the work" : "A group of parts";
  return { root: "root", internal: "internal node", "leaf-parent": "leaf-parent", integration: "integration node" }[n.kind] ?? n.kind;
}

function phasesIn(ctx, id) {
  const scope = subtree(ctx.model, id);
  const active = new Set(ctx.model.nodes.filter((n) => n.status === "active" && scope.has(n.id)).map((n) => n.id));
  return ctx.model.phases.filter((p) => active.has(p.node));
}

function contractChip(ctx, r) {
  const c = ctx.model.contracts.find((x) => x.id === r.ref.split("@")[0]);
  const label = ctx.stake ? gloss(ctx, r.ref) : r.ref;
  if (!c) return chip(ctx.stake ? label : `${label} (named, not yet written)`, null, "missing");
  return chip(label, href(ctx.a, "contract", c.ref), r.ext || c.external ? "external" : "");
}

// What to check, scoped to a node and everything under it.
function whatToCheck(ctx, id) {
  const scope = subtree(ctx.model, id);
  const seen = new Set();
  const fs = ctx.page.findings.filter((f) => scope.has(f.node) && !seen.has(`${f.kind}|${f.message}`) && seen.add(`${f.kind}|${f.message}`));
  const full = phasesIn(ctx, id).filter((p) => p.tier === "full-review");
  const count = (kind) => fs.filter((f) => f.kind === kind).length;
  if (ctx.stake) {
    const lines = [
      [full.length, "piece of work gets a full review", "pieces of work get a full review"],
      [count("contingent"), "piece of work waits on an open question", "pieces of work wait on an open question"],
      [count("unwritten-contract"), "connection is named but not yet written down", "connections are named but not yet written down"],
      [count("provisional-contract"), "connection is still provisional", "connections are still provisional"],
      [count("adr-missing") + count("adr-proposed"), "decision is not final yet", "decisions are not final yet"],
      [count("pending-governance"), "part has changes waiting to be applied", "parts have changes waiting to be applied"],
      [count("collision"), "pair of work items touches the same files", "pairs of work items touch the same files"],
      [count("version-mismatch"), "reference points at an older version of a connection", "references point at an older version of a connection"],
    ].filter(([n]) => n > 0);
    const body = lines.length ? html`<ul>${lines.map(([n, one, many]) => html`<li>${n} ${n === 1 ? one : many}</li>`)}</ul>` : html`<p>Nothing to watch at this level.</p>`;
    return section("What to watch", body, "check");
  }
  const items = [];
  if (full.length) items.push(html`<li><strong>Full review:</strong> ${plural(full.length, "phase")} ${full.length <= 12 ? full.map((p) => chip(p.heading, href(ctx.a, "phase", p.id), "tier-full-review")) : ""}</li>`);
  for (const f of fs.filter((x) => x.kind !== "collision-ordered")) {
    const target = f.phase ? href(ctx.a, "phase", f.phase) : f.ref && ctx.model.contracts.some((c) => c.ref === f.ref) ? href(ctx.a, "contract", f.ref) : href(ctx.a, "node", f.node);
    items.push(html`<li class="finding ${f.kind}"><a href="${target}">${f.message}</a></li>`);
  }
  const ordered = count("collision-ordered");
  if (ordered) items.push(html`<li class="muted">${plural(ordered, "collision")} a dependency already orders (not listed)</li>`);
  return section("What to check", items.length ? html`<ul>${items}</ul>` : html`<p>Nothing to check at this level.</p>`, "check");
}

function childSpec(ctx, g) {
  const nodes = g.boxes.map((id) => {
    const n = ctx.byId.get(id);
    const ph = phasesIn(ctx, id).length;
    const sub = isLeaf(n) ? (ctx.stake ? plural(ph, "piece of work", "pieces of work") : plural(ph, "phase")) : plural(activeChildren(ctx.model, id).length, "part");
    return { id, label: n.name, sub: `${prose(ctx, `explain:${id}`)}\n${sub}`, role: n.adopted === "as-built" ? "asbuilt" : isLeaf(n) ? "leaf" : "internal", href: href(ctx.a, "node", id) };
  });
  if (g.outside) nodes.push({ id: OUTSIDE, label: "Outside the tree", sub: ctx.stake ? "systems other teams run" : "external contracts", role: "outside", href: null });
  if (g.elsewhere) nodes.push({ id: ELSEWHERE, label: "Elsewhere in the tree", sub: ctx.stake ? "other parts of this plan" : "producers in other branches", role: "outside", href: null });
  const edges = g.edges.map((e) => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
    label: ctx.stake ? "" : e.refs.length > 2 ? `${e.refs.slice(0, 2).join(", ")} +${e.refs.length - 2}` : e.refs.join(", "),
  }));
  const roles = new Set(nodes.map((n) => n.role));
  const kinds = new Set(edges.map((e) => e.kind));
  const legend = [
    roles.has("internal") && { swatch: "internal", text: ctx.stake ? "a group of parts" : "internal node" },
    roles.has("leaf") && { swatch: "leaf", text: ctx.stake ? "a part of the work" : "leaf-parent: planned as phases" },
    roles.has("asbuilt") && { swatch: "asbuilt", text: ctx.stake ? "existing code, described as it is" : "adopted as built" },
    nodes.some((n) => n.id === OUTSIDE) && { swatch: "outside", text: ctx.stake ? "outside this plan" : "outside the tree" },
    nodes.some((n) => n.id === ELSEWHERE) && { swatch: "outside", text: ctx.stake ? "another part of this plan" : "elsewhere in the tree" },
    kinds.has("contract") && { edge: "contract", text: ctx.stake ? "uses what the other part provides" : "consumes a contract" },
    kinds.has("event") && { edge: "event", text: ctx.stake ? "listens for its messages" : "consumes events" },
    kinds.has("shared-model") && { edge: "shared-model", text: ctx.stake ? "shares its data shapes" : "shares a model" },
  ].filter(Boolean);
  return { direction: "LR", nodes, edges, legend };
}

function phaseSpec(ctx, g) {
  const byId = new Map(ctx.model.phases.map((p) => [p.id, p]));
  if (ctx.stake || g.collapsed) {
    const nodes = g.steps.map((ids, k) => ({
      id: `step-${k + 1}`,
      label: `Step ${k + 1}`,
      sub: ctx.stake ? plural(ids.length, "piece of work", "pieces of work") : ids.map((id) => byId.get(id).heading).join(", "),
      role: "step",
      href: null,
    }));
    const edges = nodes.slice(1).map((n, k) => ({ from: nodes[k].id, to: n.id, kind: "step", label: "" }));
    return { direction: "LR", nodes, edges, legend: [{ swatch: "step", text: ctx.stake ? "work that can happen at the same time" : "phases with no dependency between them" }, { edge: "step", text: ctx.stake ? "comes after" : "the next layer depends on this one" }] };
  }
  const nodes = g.ids.map((id) => {
    const p = byId.get(id);
    const waits = p.contingentOn.length ? `\nwaits on ${p.contingentOn.join(", ")}` : "";
    return { id, label: p.heading, sub: `${p.name}${waits}`, role: `tier-${p.tier}`, href: href(ctx.a, "phase", id) };
  });
  const edges = [...g.edges, ...g.collisions].map((e) => ({ ...e, label: "" }));
  const tiers = new Set(g.ids.map((id) => byId.get(id).tier));
  const legend = [
    ...["gate-only", "spot-check", "full-review"].filter((t) => tiers.has(t)).map((t) => ({ swatch: `tier-${t}`, text: t })),
    g.edges.length && { edge: "depends", text: "depends on" },
    g.collisions.length && { edge: "collides", text: "edit the same files; nothing orders them" },
  ].filter(Boolean);
  return { direction: "LR", nodes, edges, legend };
}

// The collapsed graph as an ordered list, when a row of steps would be unreadable.
function stepList(ctx, g) {
  const byId = new Map(ctx.model.phases.map((p) => [p.id, p]));
  return section(ctx.stake ? "In order" : "Order of work", html`<ol class="steps">${g.steps.map((ids) => html`<li>${ctx.stake ? plural(ids.length, "piece of work", "pieces of work") : ids.map((id) => chip(byId.get(id).heading, href(ctx.a, "phase", id), `tier-${byId.get(id).tier}`))}</li>`)}</ol>`);
}

function fieldsSection(ctx, n) {
  const row = (label, value) => (value ? html`<dt>${label}</dt><dd>${value}</dd>` : "");
  const refs = (list) => (list.length ? raw(list.map((r) => contractChip(ctx, r).s).join(" ")) : null);
  const adrs = n.governedBy.length ? raw(n.governedBy.map((id) => chip(id, href(ctx.a, "adrs")).s).join(" ")) : null;
  return section("Details", html`<dl>
    ${row("Purpose", n.purpose ? block(n.purpose) : null)}
    ${row("Owns", n.owns ? block(n.owns) : null)}
    ${row("Does not own", n.doesNotOwn ? block(n.doesNotOwn) : null)}
    ${row("Isolation strategy", n.isolation ? block(n.isolation) : null)}
    ${row("Consumes", refs(n.consumes))}
    ${row("Produces", refs(n.produces))}
    ${row("Governed by", adrs)}
    ${row("Team", n.team)}
    ${row("Default gate", n.defaultGate && ctx.a === "implementer" ? html`<code>${n.defaultGate}</code>` : null)}
  </dl>`, "fields");
}

function questionsSection(ctx, n) {
  const qs = n.openQuestions;
  if (!qs.length) return raw("");
  const open = qs.filter((q) => q.status !== "RESOLVED");
  if (ctx.stake) return section("Open questions", html`<p>${plural(open.length, "question is", "questions are")} still open here.</p>`);
  return section("Open questions", html`<table><thead><tr><th>ID</th><th>Question</th><th>Status</th><th>Waits on</th></tr></thead><tbody>
    ${qs.map((q) => html`<tr class="${q.status === "RESOLVED" ? "muted" : ""}"><td>${q.id}</td><td>${q.question}</td><td>${q.status}</td><td>${q.waitsOn}</td></tr>`)}
  </tbody></table>`);
}

function phaseListSection(ctx, n, g) {
  const ps = ctx.model.phases.filter((p) => p.node === n.id);
  if (!ps.length) return section("Phases", html`<p>${ctx.stake ? "Not planned yet." : "No phase plan yet."}</p>`);
  if (ctx.stake) {
    const full = ps.filter((p) => p.tier === "full-review").length;
    return section("The work", html`<p>${plural(ps.length, "piece of work", "pieces of work")} in ${plural(g.steps.length, "step")}; ${plural(full, "gets", "get")} a full review.</p>`);
  }
  const impl = ctx.a === "implementer";
  return section("Phases", html`<table><thead><tr><th>Phase</th><th>Name</th><th>Tier</th><th>Size</th><th>Depends on</th>${impl ? html`<th>Gate</th>` : ""}</tr></thead><tbody>
    ${ps.map((p) => html`<tr><td><a href="${href(ctx.a, "phase", p.id)}">${p.heading}</a></td><td>${p.name}</td><td><span class="badge tier-${p.tier}">${p.tier}</span></td><td>${p.size ?? ""}</td><td>${p.dependsOn.map((d) => ctx.model.phases.find((x) => x.id === d)?.heading ?? d).join(", ")}</td>${impl ? html`<td><code>${p.resolvedGate ?? ""}</code></td>` : ""}</tr>`)}
  </tbody></table>
  ${g.cross.length ? html`<p class="muted">Waits on other parts: ${g.cross.map((c) => chip(c.on, href(ctx.a, "phase", c.on)))}</p>` : ""}`);
}

function childrenSection(ctx, n) {
  const kids = activeChildren(ctx.model, n.id);
  const retired = n.children.map((c) => ctx.byId.get(c)).filter((c) => c && c.status === "retired");
  return section(ctx.stake ? "Parts" : "Child nodes", html`<ul class="cards">
    ${kids.map((k) => html`<li class="card"><a href="${href(ctx.a, "node", k.id)}"><strong>${k.name}</strong></a><p>${prose(ctx, `explain:${k.id}`)}</p></li>`)}
  </ul>
  ${retired.length ? html`<details><summary>${ctx.stake ? "Retired parts" : "Retired nodes"} (${retired.length})</summary><ul>${retired.map((r) => html`<li>${r.name}</li>`)}</ul></details>` : ""}`);
}

function planNode(ctx, id) {
  const n = ctx.byId.get(id);
  const leaf = isLeaf(n);
  const diagrams = [];
  let listing;
  if (leaf) {
    const g = phaseGraph(ctx.model, id);
    const asSteps = ctx.stake || g.collapsed;
    if (g.ids.length && !(asSteps && g.steps.length > MAX_STEPS)) diagrams.push({ id: "main", spec: phaseSpec(ctx, g) });
    listing = html`${asSteps && g.steps.length > MAX_STEPS ? stepList(ctx, g) : ""}${phaseListSection(ctx, n, g)}`;
  } else {
    const g = childGraph(ctx.model, id);
    if (g.boxes.length && g.boxes.length <= MAX_BOXES) diagrams.push({ id: "main", spec: childSpec(ctx, g) });
    listing = childrenSection(ctx, n);
  }
  const note = prose(ctx, `note:${id}:${ctx.a}`);
  const markers = [
    n.adopted === "as-built" && (ctx.stake ? "Existing code, described as it is" : "Adopted as built"),
    n.adopted === "promoted" && (ctx.stake ? "Existing code, now planned" : "Adopted, then promoted"),
    n.status === "retired" && "Retired",
  ].filter(Boolean);
  const body = html`
    <header class="page-head">
      <p class="eyebrow">${kindLabel(ctx, n)}</p>
      <h1>${n.name}</h1>
      ${ctx.stake ? "" : html`<p class="id"><code>${n.id}</code></p>`}
      ${markers.length ? html`<p class="markers">${markers.map((m) => html`<span class="badge">${m}</span>`)}</p>` : ""}
      <p class="explain">${prose(ctx, `explain:${id}`)}</p>
      ${note ? html`<p class="note">${note}</p>` : ""}
    </header>
    ${diagrams.length ? diagramSlot("main") : ""}
    ${listing}
    ${whatToCheck(ctx, id)}
    ${ctx.stake || n.kind === "root" ? "" : fieldsSection(ctx, n)}
    ${questionsSection(ctx, n)}
    ${n.kind === "root" ? readability(ctx) : ""}
    ${ctx.stake ? "" : sourceLink(n.sourceFile)}`;
  return { title: n.name, crumbs: crumbsTo(ctx, id), body: body.s, diagrams };
}

function planPhase(ctx, p) {
  const row = (label, value) => (value ? html`<dt>${label}</dt><dd>${value}</dd>` : "");
  const refs = (list) => (list.length ? raw(list.map((r) => contractChip(ctx, r).s).join(" ")) : null);
  const phaseChips = (ids) => (ids.length ? raw(ids.map((d) => chip(ctx.model.phases.find((x) => x.id === d)?.heading ?? d, href(ctx.a, "phase", d)).s).join(" ")) : null);
  const oqs = ctx.model.nodes.flatMap((n) => n.openQuestions);
  const delivers = prose(ctx, `delivers:${p.id}`);
  const body = html`
    <header class="page-head">
      <p class="eyebrow">Phase · <span class="badge tier-${p.tier}">${p.tier}</span></p>
      <h1>${p.name}</h1>
      <p class="id"><code>${p.id}</code></p>
      ${delivers ? html`<p class="explain">${delivers}</p>` : ""}
    </header>
    ${section("Phase", html`<dl>
      ${row("Scope", p.scope ? block(p.scope) : null)}
      ${row("Verification", p.verification ? block(p.verification) : null)}
      ${row("Gate", p.resolvedGate ? html`<code>${p.resolvedGate}</code>${p.gate && /node default/i.test(p.gate) ? html` <span class="muted">(node default)</span>` : ""}` : null)}
      ${row("Size", p.size)}
      ${row("Consumes", refs(p.consumes))}
      ${row("Produces", refs(p.produces))}
      ${row("Governed by", p.governedBy.length ? raw(p.governedBy.map((id) => chip(id, href(ctx.a, "adrs")).s).join(" ")) : null)}
      ${row("Depends on", phaseChips(p.dependsOn))}
      ${row("Collides with", phaseChips(p.collidesWith))}
      ${row("Contingent on", p.contingentOn.length ? raw(p.contingentOn.map((id) => chip(`${id} (${oqs.find((q) => q.id === id)?.status ?? "undefined"})`, null, "warn").s).join(" ")) : null)}
    </dl>`)}
    ${sourceLink(p.sourceFile, p.line)}`;
  return { title: `${p.heading}: ${p.name}`, crumbs: [...crumbsTo(ctx, p.node), { label: p.heading, href: href(ctx.a, "phase", p.id) }], body: body.s, diagrams: [] };
}

function contractCard(ctx, c, full) {
  const promise = prose(ctx, `promise:${c.ref}`);
  const owner = ctx.byId.get(c.owner);
  return html`<li class="card contract">
    <p class="eyebrow"><span class="badge status-${c.status ?? "unknown"}">${ctx.stake ? STATUS_WORDS[c.status] ?? c.status ?? "" : c.status ?? "no status"}</span>${!ctx.stake && c.phaseIds === "provisional" ? html` <span class="badge warn">provisional</span>` : ""}${c.external ? html` <span class="badge">${ctx.stake ? "another team's" : "external"}</span>` : ""}</p>
    <h3>${ctx.stake ? capitalize(gloss(ctx, c.ref)) : html`<a href="${href(ctx.a, "contract", c.ref)}"><code>${c.ref}</code></a>`}</h3>
    ${ctx.stake ? "" : html`<p class="muted">${gloss(ctx, c.ref)}${owner ? html` · from ${owner.name}` : ""} · ${plural(c.consumers.length, "consumer")}</p>`}
    ${promise ? html`<p>${promise}</p>` : ""}
    ${full && !ctx.stake && c.guarantees.length ? html`<ul class="guarantees">${c.guarantees.map((g) => html`<li>${inline(g)}</li>`)}</ul>` : ""}
  </li>`;
}

function planContracts(ctx) {
  const root = ctx.model.project.root;
  const g = childGraph(ctx.model, root);
  const spec = childSpec(ctx, g);
  const cs = [...ctx.model.contracts].sort((x, y) => x.ref.localeCompare(y.ref));
  const named = [...new Set([...ctx.model.nodes, ...ctx.model.phases].flatMap((x) => [...x.consumes, ...x.produces]).filter((r) => !r.ext && !ctx.model.contracts.some((c) => c.id === r.ref.split("@")[0])).map((r) => r.ref))].sort();
  const body = html`
    <header class="page-head"><p class="eyebrow">${ctx.stake ? "How the parts connect" : "Contracts"}</p><h1>${ctx.stake ? "Connections" : "Contracts"}</h1>
      <p class="explain">${ctx.stake ? `${plural(cs.length, "connection")} between the parts, and how they depend on each other.` : `${plural(cs.length, "contract")} with a file; ${plural(named.length, "more is", "more are")} named, not yet written.`}</p></header>
    ${g.boxes.length ? diagramSlot("main") : ""}
    ${section(ctx.stake ? "The connections" : "Written", html`<ul class="cards">${cs.map((c) => contractCard(ctx, c, false))}</ul>`)}
    ${named.length ? section(ctx.stake ? "Named but not yet written down" : "Named, not yet written", html`<ul>${named.map((r) => html`<li>${ctx.stake ? capitalize(gloss(ctx, r)) : html`<code>${r}</code>`}</li>`)}</ul>`) : ""}`;
  return { title: ctx.stake ? "Connections" : "Contracts", crumbs: [{ label: ctx.stake ? "Connections" : "Contracts", href: href(ctx.a, "contracts") }], body: body.s, diagrams: g.boxes.length ? [{ id: "main", spec }] : [] };
}

function planContract(ctx, c) {
  const users = ctx.model.phases.filter((p) => p.consumes.some((r) => r.ref.split("@")[0] === c.id));
  const makers = ctx.model.phases.filter((p) => p.produces.some((r) => r.ref.split("@")[0] === c.id));
  const body = html`
    <ul class="cards single">${contractCard(ctx, c, true)}</ul>
    ${ctx.stake ? "" : section("Phases", html`<dl>
      ${makers.length ? html`<dt>Produced by</dt><dd>${makers.map((p) => chip(p.heading, href(ctx.a, "phase", p.id)))}</dd>` : ""}
      ${users.length ? html`<dt>Consumed by</dt><dd>${users.map((p) => chip(p.heading, href(ctx.a, "phase", p.id)))}</dd>` : ""}
    </dl>`)}
    ${ctx.stake ? "" : sourceLink(c.sourceFile)}`;
  const title = ctx.stake ? capitalize(gloss(ctx, c.ref)) : c.ref;
  return { title, crumbs: [{ label: ctx.stake ? "Connections" : "Contracts", href: href(ctx.a, "contracts") }, { label: title, href: href(ctx.a, "contract", c.ref) }], body: body.s, diagrams: [] };
}

function planAdrs(ctx) {
  const as = ctx.model.adrs;
  const accepted = as.filter((x) => x.status === "accepted").length;
  const body = ctx.stake
    ? html`<header class="page-head"><h1>Decisions</h1><p class="explain">${plural(as.length, "decision")} recorded; ${accepted} final, ${as.length - accepted} not final yet.</p></header>`
    : html`<header class="page-head"><p class="eyebrow">Cross-cutting decisions</p><h1>ADRs</h1></header>
      <table><thead><tr><th>ADR</th><th>Title</th><th>Status</th><th>Decision</th><th>Affects</th></tr></thead><tbody>
      ${as.map((x) => html`<tr><td><a href="${x.sourceFile.replace(/^hsdd\//, "../")}">${x.id}</a></td><td>${x.title}</td><td><span class="badge status-${x.status}">${x.status}</span></td><td>${inline(x.decision)}</td><td>${x.affects.map((t) => chip(t, ctx.byId.has(t) ? href(ctx.a, "node", t) : ctx.model.contracts.some((c) => c.ref === t) ? href(ctx.a, "contract", t) : null))}</td></tr>`)}
      </tbody></table>`;
  return { title: "Decisions", crumbs: [{ label: "Decisions", href: href(ctx.a, "adrs") }], body: body.s, diagrams: [] };
}

function readability(ctx) {
  if (ctx.stake || !ctx.page.readability.length) return raw("");
  return section("Readability notes", html`<ul>${ctx.page.readability.map((f) => html`<li><code>${f.key}</code>: ${f.message}</li>`)}</ul>`, "readability");
}
