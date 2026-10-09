// The checkpoint page's views. Pure: (page data, route) -> { title, crumbs,
// body, diagrams }. Inlined into the page with views-core.mjs and graph.mjs.
import { html, raw, inline, plural, href, chip, section, diagramSlot, renderBlocks, capitalize } from "./views-core.mjs";
import { planGraph, collapsePlanGraph, dependsRefs, layers, MAX_BOXES } from "./graph.mjs";

export const CHECKPOINT_AUDIENCES = ["lead", "executor", "stakeholder"];
export const PLAN_GRAPH_MAX = 20;

const MODE_WORDS = { delegate: "\u{1F916} delegate", interactive: "\u{1F91D} interactive", human: "\u{1F464} human-only" };
const SEVERITIES = ["High", "Medium", "Low"];

export function renderCheckpoint(page, route) {
  const m = page.model;
  const ctx = {
    page,
    m,
    a: route.audience,
    stake: route.audience === "stakeholder",
    steps: new Map(m.plan.steps.map((s) => [s.id, s])),
    details: new Map(m.plan.details.map((d) => [d.id, d])),
    findings: new Map(m.progress.findings.map((f) => [f.id, f])),
    syncs: new Map(m.plan.syncs.map((s) => [s.id, s])),
  };
  if (!ctx.stake) {
    if (route.view === "sync" && ctx.syncs.has(route.id)) return cpSync(ctx, ctx.syncs.get(route.id));
    if (route.view === "lane" && m.plan.lanes.some((l) => l.key === route.id)) return cpLane(ctx, route.id);
    if (route.view === "step" && ctx.steps.has(route.id)) return cpStep(ctx, ctx.steps.get(route.id));
    if (route.view === "finding" && ctx.findings.has(route.id)) return cpFinding(ctx, ctx.findings.get(route.id));
    if (route.view === "findings") return cpFindings(ctx);
  }
  if (route.view === "milestone") {
    const ms = m.progress.milestones.find((x) => x.id === route.id);
    if (ms) return cpMilestone(ctx, ms);
  }
  if (route.view === "status") return cpStatus(ctx, route.id);
  if (ctx.stake) return cpStakeholderTop(ctx);
  if (ctx.a === "executor") return cpExecutorTop(ctx);
  return cpLeadTop(ctx);
}

function prose(ctx, key) {
  return ctx.page.prose[key] ?? "";
}

function home(ctx) {
  return { label: `Checkpoint ${ctx.m.project.date}`, href: href(ctx.a) };
}

function src(file, line) {
  if (!file) return raw("");
  return html`<p class="source">Source: <a href="${String(file).replace(/^hsdd\//, "../")}">${file}${line ? `:${line}` : ""}</a></p>`;
}

function stepChip(ctx, id) {
  const s = ctx.steps.get(id);
  return chip(id, s ? href(ctx.a, "step", id) : null, s && s.done ? "status-done" : "");
}

function findingChip(ctx, id) {
  const f = ctx.findings.get(id);
  return chip(id, f ? href(ctx.a, "finding", id) : null, f ? `sev-${f.severity}` : "");
}

function bar(fr) {
  if (!fr) return raw("");
  const [met, total] = fr;
  const pct = total ? Math.round((100 * met) / total) : 0;
  return html`<span class="meter" role="img" aria-label="${met} of ${total}"><span class="meter-fill w${Math.round(pct / 5) * 5}"></span></span>`;
}

function arrow(dir) {
  return { up: "▲", down: "▼", same: "═", new: "new" }[dir] ?? "";
}

function decisionHome(ctx) {
  const out = new Map();
  for (const s of ctx.m.plan.syncs) for (const d of s.decisions) if (!out.has(d.id)) out.set(d.id, s.id);
  return out;
}

function dependsChips(ctx, text) {
  const r = dependsRefs(text, new Set(ctx.steps.keys()), new Set(ctx.syncs.keys()), decisionHome(ctx));
  return raw([...r.syncs.map((y) => chip(`Sync ${y}`, href(ctx.a, "sync", y), "sync").s), ...r.steps.map((s) => stepChip(ctx, s).s), ...r.unresolved.map((u) => chip(u, null, "missing").s)].join(" "));
}

function graphSpec(ctx) {
  const g = planGraph(ctx.m);
  if (!g.nodes.length) return null;
  const c = g.nodes.length > PLAN_GRAPH_MAX ? collapsePlanGraph(g, PLAN_GRAPH_MAX) : { ...g, collapsed: false };
  if (c.nodes.length > PLAN_GRAPH_MAX) return null;
  const point = (id) => ctx.m.plan.syncPoints.find((p) => p.id === id);
  const nodes = c.nodes.map((n) => {
    if (n.kind === "sync") return { id: n.id, label: `Sync ${n.ref}`, sub: point(n.ref)?.when ?? "", role: "sync", href: href(ctx.a, "sync", n.ref) };
    if (n.kind === "batch") {
      const open = n.members.filter((id) => ctx.steps.get(id)?.done !== true);
      return { id: n.id, label: `${n.lane === "unassigned" ? "No lane" : n.lane === "shared" ? "Shared" : n.lane} · ${plural(n.members.length, "step")}`, sub: n.members.join(", "), role: open.length ? "lane-step" : "status-done", href: n.lane && n.lane !== "shared" && n.lane !== "unassigned" ? href(ctx.a, "lane", n.lane) : null };
    }
    const s = ctx.steps.get(n.ref);
    const d = ctx.details.get(n.ref);
    return { id: n.id, label: n.ref, sub: `${s.lanes.join(", ")}${d ? `\n${d.title}` : ""}`, role: s.done ? "status-done" : "lane-step", href: href(ctx.a, "step", n.ref) };
  });
  const roles = new Set(nodes.map((n) => n.role));
  const legend = [
    roles.has("sync") && { swatch: "sync", text: "sync: a meeting other work waits on" },
    roles.has("lane-step") && { swatch: "lane-step", text: c.collapsed ? "steps of one lane at one depth, still open" : "open step" },
    roles.has("status-done") && { swatch: "status-done", text: "done" },
    c.edges.length && { edge: "depends", text: "must come first" },
  ].filter(Boolean);
  return { direction: "LR", nodes, edges: c.edges.map((e) => ({ ...e, kind: "depends", label: "" })), legend };
}

function bottomTiles(ctx, onlySafe) {
  const rows = ctx.m.progress.bottomLine.filter((r, i) => !onlySafe || ctx.page.safe?.bottomLine?.[i]);
  if (!rows.length) return raw("");
  return html`<dl class="tiles">${rows.map((r) => html`<div class="tile"><dt>${r.label}</dt><dd>${inline(r.value)}</dd></div>`)}</dl>`;
}

function gates(ctx) {
  const mv = ctx.page.computed.movement ?? {};
  const ms = ctx.m.progress.milestones;
  if (!ms.length) return raw("");
  return html`<ul class="gates">${ms.map((x) => {
    const v = mv[x.id];
    const label = ctx.stake ? html`<strong>${x.name || x.id}</strong>` : html`<a href="${href(ctx.a, "milestone", x.id)}"><strong>${x.id}</strong></a> ${x.name}`;
    return html`<li><span class="gate-name">${label}${x.date ? html` <span class="muted">${x.date}</span>` : ""}</span>
      ${x.fraction ? html`${bar(x.fraction)}<span class="gate-count">${x.fraction[0]} / ${x.fraction[1]}</span>` : html`<span><span class="badge status-done">reached</span></span><span></span>`}
      <span>${!ctx.stake && v && v.dir !== "same" ? html`<span class="move move-${v.dir}" title="${v.prev ? `was ${v.prev[0]} / ${v.prev[1]}` : "first reading"}">${arrow(v.dir)}</span>` : ""}</span>
      ${ctx.stake && prose(ctx, `cp:milestone:${x.id}`) ? html`<p>${prose(ctx, `cp:milestone:${x.id}`)}</p>` : ""}</li>`;
  })}</ul>`;
}

function integrity(ctx) {
  if (!ctx.page.findings.length) return raw("");
  return section("Plan integrity", html`<p class="muted">hsdd-checkpoint's own quality gates, as the scripts read the documents.</p><ul>${ctx.page.findings.map((f) => html`<li>${f.message}</li>`)}</ul>`, "check");
}

function readability(ctx) {
  if (ctx.stake || !ctx.page.readability.length) return raw("");
  return section("Readability notes", html`<ul>${ctx.page.readability.map((f) => html`<li><code>${f.key}</code>: ${f.message}</li>`)}</ul>`, "readability");
}

function cpLeadTop(ctx) {
  const { m, page } = ctx;
  const spec = graphSpec(ctx);
  const size = planGraph(m).nodes.length;
  const ages = page.computed.ages ?? {};
  const delta = page.computed.delta;
  const sev = Object.fromEntries(SEVERITIES.map((s) => [s, m.progress.findings.filter((f) => f.severity === s)]));
  const syncCards = m.plan.syncPoints.map((p) => {
    const s = ctx.syncs.get(p.id);
    return html`<li class="card"><p class="eyebrow">${s ? (s.gating ? "gating" : "sync") : "standing"}</p><h3>${s ? html`<a href="${href(ctx.a, "sync", p.id)}">${p.name}</a>` : p.name}</h3><p class="muted">${p.when}${p.who ? ` · ${p.who}` : ""}</p><p>${inline(p.agenda)}</p>${s ? html`<p class="muted">${plural(s.decisions.length, "decision")} · ${plural(s.entry.length, "entry item")}</p>` : ""}</li>`;
  });
  const body = html`
    <header class="page-head"><p class="eyebrow">Checkpoint ${m.project.date}</p><h1>${m.project.name}</h1>
      ${m.progress.read ? html`<p class="explain">${inline(m.progress.read)}</p>` : ""}</header>
    ${bottomTiles(ctx, false)}
    ${section("Milestone gates", gates(ctx))}
    ${section("Syncs", html`<ul class="cards">${syncCards}</ul>`)}
    ${spec ? section("Plan graph", html`${size > PLAN_GRAPH_MAX ? html`<p class="explain">${size} steps and syncs are too many to draw one by one; steps of one lane at the same depth are grouped into one box.</p>` : ""}${diagramSlot("plan")}`) : section("Order of work", html`${size > PLAN_GRAPH_MAX ? html`<p class="explain">${size} steps and syncs are too many to draw even when grouped, so they are listed in order.</p>` : ""}${stepOrder(ctx)}`)}
    ${section("Blockers", html`<ol class="blockers">${m.progress.blockers.map((b) => html`<li><strong>${b.lead ?? ""}</strong> ${b.findings.map((f) => findingChip(ctx, f))} ${b.steps.map((s) => stepChip(ctx, s))}</li>`)}</ol>`)}
    ${section("Findings", html`<p>${SEVERITIES.map((s) => html`<span class="badge sev-${s}">${s}: ${sev[s].length}</span> `)} <a href="${href(ctx.a, "findings")}">all ${m.progress.findings.length}</a></p>
      <ul>${m.progress.findings.filter((f) => f.severity === "High" || (ages[f.id] ?? 0) > 1).map((f) => html`<li>${findingChip(ctx, f.id)} ${f.lead ?? ""}${(ages[f.id] ?? 0) > 1 ? html` <span class="badge warn">${plural(ages[f.id], "report")} running</span>` : ""}</li>`)}</ul>`)}
    ${delta ? section("Since the last plan", html`<p>Against <a href="${delta.file.replace(/^hsdd\//, "../")}">${delta.file.split("/").pop()}</a>: ${plural(delta.carried.length, "step")} carried into this plan, ${plural(delta.gone.length, "step")} no longer in it (landed or dropped; the Current state says which).</p>
      ${m.plan.currentState.length ? html`<ul>${m.plan.currentState.map((t) => html`<li>${inline(t)}</li>`)}</ul>` : ""}`) : ""}
    ${integrity(ctx)}
    ${readability(ctx)}
    ${src(m.files.progress)}${src(m.files.plan)}`;
  return { title: `Checkpoint ${m.project.date}`, crumbs: [home(ctx)], body: body.s, diagrams: spec ? [{ id: "plan", spec }] : [] };
}

function stepOrder(ctx) {
  const g = planGraph(ctx.m);
  const lay = layers(g.nodes.map((n) => n.id), (id) => g.edges.filter((e) => e.to === id).map((e) => e.from));
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return html`<ol class="steps">${lay.map((ids) => html`<li>${ids.map((id) => {
    const n = byId.get(id);
    return n.kind === "sync" ? chip(`Sync ${n.ref}`, href(ctx.a, "sync", n.ref), "sync") : stepChip(ctx, n.ref);
  })}</li>`)}</ol>`;
}

function laneSteps(ctx, key) {
  const g = planGraph(ctx.m);
  const lay = layers(g.nodes.map((n) => n.id), (id) => g.edges.filter((e) => e.to === id).map((e) => e.from));
  const order = lay.flat();
  return ctx.m.plan.steps.filter((s) => s.lanes.includes(key)).sort((x, y) => order.indexOf(`step:${x.id}`) - order.indexOf(`step:${y.id}`));
}

function cpExecutorTop(ctx) {
  const { m } = ctx;
  const body = html`
    <header class="page-head"><p class="eyebrow">Checkpoint ${m.project.date}</p><h1>Pick your lane</h1>
      <p class="explain">Each lane's steps, in the order they can run, with the prompt or briefing to work from.</p></header>
    <ul class="cards">${m.plan.lanes.map((l) => {
      const steps = laneSteps(ctx, l.key);
      const open = steps.filter((s) => s.done !== true);
      return html`<li class="card"><h3><a href="${href(ctx.a, "lane", l.key)}">${l.name}</a></h3><p>${plural(open.length, "open step")}${steps.length > open.length ? `, ${steps.length - open.length} done` : ""}</p><p>${open.slice(0, 6).map((s) => stepChip(ctx, s.id))}</p></li>`;
    })}</ul>
    ${section("Syncs", html`<ul>${m.plan.syncPoints.map((p) => html`<li>${ctx.syncs.has(p.id) ? html`<a href="${href(ctx.a, "sync", p.id)}">${p.name}</a>` : p.name} · ${p.when}</li>`)}</ul>`)}`;
  return { title: `Checkpoint ${m.project.date}`, crumbs: [home(ctx)], body: body.s, diagrams: [] };
}

function cpStakeholderTop(ctx) {
  const { m } = ctx;
  const body = html`
    <header class="page-head"><p class="eyebrow">Progress on ${m.project.date}</p><h1>${m.project.name}</h1>
      <p class="explain">${prose(ctx, "cp:verdict")}</p></header>
    ${section("Where things stand", bottomTiles(ctx, true))}
    ${section("Milestones", gates(ctx))}
    ${m.progress.blockers.length ? section("What could slip", html`<ul>${m.progress.blockers.map((b) => html`<li>${prose(ctx, `cp:blocker:${b.rank}`)}</li>`)}</ul>`) : ""}
    ${section("Build progress", html`<p><a href="${href(ctx.a, "status")}">See how far each part has come.</a></p>`)}`;
  return { title: `Progress on ${m.project.date}`, crumbs: [{ label: `Progress on ${m.project.date}`, href: href(ctx.a) }], body: body.s, diagrams: [] };
}

function cpSync(ctx, s) {
  const p = ctx.m.plan.syncPoints.find((x) => x.id === s.id);
  const g = planGraph(ctx.m);
  const waiting = g.edges.filter((e) => e.from === `sync:${s.id}` && e.to.startsWith("step:")).map((e) => e.to.slice(5));
  const checklist = (items) => renderBlocks([{ type: "ul", items }]);
  const body = html`
    <header class="page-head"><p class="eyebrow">${s.gating ? "Gating sync" : "Sync"}</p><h1>${s.title}</h1>
      ${p ? html`<p class="muted">${p.when}${p.who ? ` · ${p.who}` : ""}</p>` : ""}
      ${s.why ? html`<p class="explain">${inline(s.why)}</p>` : ""}</header>
    ${section("Entry", s.entry.length ? checklist(s.entry) : html`<p class="muted">None stated.</p>`)}
    ${section("Agenda", html`${s.decisions.map((d) => html`<article class="card decision"><h3>${d.id} · ${d.question}</h3>${renderBlocks(d.text.split(/\n\n/).map((t) => ({ type: "p", text: t })))}${d.landsIn ? html`<p><strong>Lands in:</strong> ${inline(d.landsIn)}</p>` : ""}</article>`)}`)}
    ${section("Exit", s.exit.length ? checklist(s.exit) : html`<p class="muted">None stated.</p>`)}
    ${section("Unblocks", html`<ul>${s.unblocks.map((u) => html`<li>${u.lane ? html`<strong>${u.lane}:</strong> ` : ""}${inline(u.text)}</li>`)}</ul>`)}
    ${waiting.length ? section("Steps waiting on this sync", html`<p>${waiting.map((id) => stepChip(ctx, id))}</p>`) : ""}
    ${src(ctx.m.files.plan, s.line)}`;
  return { title: s.title, crumbs: [home(ctx), { label: `Sync ${s.id}`, href: href(ctx.a, "sync", s.id) }], body: body.s, diagrams: [] };
}

function stepCard(ctx, s, full) {
  const d = ctx.details.get(s.id);
  const age = ctx.page.computed.stepAges?.[s.id] ?? 0;
  return html`<article class="card step">
    <p class="eyebrow">${s.mode ? MODE_WORDS[s.mode] : "step"} · ${s.owner}${s.done ? html` <span class="badge status-done">done</span>` : ""}${age > 1 ? html` <span class="badge warn">open in ${plural(age, "plan")}</span>` : ""}</p>
    <h3><a href="${href(ctx.a, "step", s.id)}">${s.id}</a> · ${d ? d.title : ""}</h3>
    <p>${inline(s.action)}</p>
    <p class="muted">Depends: ${dependsChips(ctx, s.depends)}${s.findings.length ? html` · Findings: ${s.findings.map((f) => findingChip(ctx, f))}` : ""}</p>
    ${full && d ? html`<div class="detail">${renderBlocks(d.body)}</div>` : ""}
  </article>`;
}

function cpLane(ctx, key) {
  const lane = ctx.m.plan.lanes.find((l) => l.key === key);
  const steps = laneSteps(ctx, key);
  const k = ctx.m.plan.lanes.indexOf(lane);
  const own = ctx.m.plan.ownership.filter((r) => r.cells[k] && !/^\s*(\u2014|-)?\s*$/.test(r.cells[k]));
  const tl = ctx.m.plan.timeline;
  const tcol = tl ? tl.header.findIndex((h) => h.toLowerCase().includes(key.toLowerCase())) : -1;
  const body = html`
    <header class="page-head"><p class="eyebrow">Lane</p><h1>${lane.name}</h1>
      <p class="explain">${plural(steps.filter((s) => s.done !== true).length, "open step")}, in the order they can run.</p></header>
    ${steps.map((s) => stepCard(ctx, s, ctx.a === "executor"))}
    ${own.length ? section("Owns", html`<dl>${own.map((r) => html`<dt>${r.label}</dt><dd>${inline(r.cells[k])}</dd>`)}</dl>`) : ""}
    ${tcol > 0 ? section("Timeline", html`<dl>${tl.rows.map((r) => html`<dt>${inline(r[0])}</dt><dd>${inline(r[tcol] ?? "")}</dd>`)}</dl>`) : ""}`;
  return { title: lane.name, crumbs: [home(ctx), { label: lane.name, href: href(ctx.a, "lane", key) }], body: body.s, diagrams: [] };
}

function cpStep(ctx, s) {
  const d = ctx.details.get(s.id);
  const g = planGraph(ctx.m);
  const next = g.edges.filter((e) => e.from === `step:${s.id}`).map((e) => e.to);
  const body = html`
    ${stepCard(ctx, s, true)}
    ${next.length ? section("Unblocks", html`<p>${next.map((id) => (id.startsWith("sync:") ? chip(`Sync ${id.slice(5)}`, href(ctx.a, "sync", id.slice(5)), "sync") : stepChip(ctx, id.slice(5))))}</p>`) : ""}
    ${src(ctx.m.files.plan, d ? d.line : s.line)}`;
  const crumbs = [home(ctx), ...(s.lanes.length === 1 ? [{ label: ctx.m.plan.lanes.find((l) => l.key === s.lanes[0])?.name ?? s.lanes[0], href: href(ctx.a, "lane", s.lanes[0]) }] : []), { label: s.id, href: href(ctx.a, "step", s.id) }];
  return { title: `${s.id}${d ? ` · ${d.title}` : ""}`, crumbs, body: body.s, diagrams: [] };
}

function cpFinding(ctx, f) {
  const age = ctx.page.computed.ages?.[f.id] ?? 1;
  const landed = ctx.page.computed.landedBy?.[f.id] ?? { steps: [], waived: false };
  const waiver = ctx.m.plan.waivers.find((w) => w.finding === f.id);
  const reports = ctx.m.history.progress.slice(0, age).map((h) => h.file);
  const body = html`
    <header class="page-head"><p class="eyebrow"><span class="badge sev-${f.severity}">${f.severity}</span> ${f.area}</p><h1>${f.id} · ${f.lead ?? ""}</h1>
      <p class="muted">In ${plural(age, "consecutive register")}${age > 1 ? html`: ${reports.map((r) => html`<a href="${r.replace(/^hsdd\//, "../")}">${r.split("/").pop()}</a> `)}` : ""}</p></header>
    <div class="card">${renderBlocks([{ type: "p", text: f.text }])}</div>
    ${section("Lands in the plan as", landed.steps.length ? html`<p>${landed.steps.map((s) => stepChip(ctx, s))}</p>` : waiver ? html`<p><strong>Waived:</strong> ${inline(waiver.text)}</p>` : html`<p class="warn-text">No step and no waiver.</p>`)}
    ${src(ctx.m.files.progress, f.line)}`;
  return { title: f.id, crumbs: [home(ctx), { label: "Findings", href: href(ctx.a, "findings") }, { label: f.id, href: href(ctx.a, "finding", f.id) }], body: body.s, diagrams: [] };
}

function cpFindings(ctx) {
  const ages = ctx.page.computed.ages ?? {};
  const landed = ctx.page.computed.landedBy ?? {};
  const body = html`<header class="page-head"><h1>Findings register</h1></header>
    <div class="table-wrap"><table><thead><tr><th>ID</th><th>Severity</th><th>Area</th><th>Finding</th><th>Reports</th><th>Lands in</th></tr></thead><tbody>
    ${ctx.m.progress.findings.map((f) => html`<tr><td><a href="${href(ctx.a, "finding", f.id)}">${f.id}</a></td><td><span class="badge sev-${f.severity}">${f.severity}</span></td><td>${f.area}</td><td>${f.lead ?? ""}</td><td>${ages[f.id] ?? 1}</td><td>${(landed[f.id]?.steps ?? []).map((s) => stepChip(ctx, s))}${landed[f.id]?.waived ? "waived" : ""}</td></tr>`)}
    </tbody></table></div>`;
  return { title: "Findings", crumbs: [home(ctx), { label: "Findings", href: href(ctx.a, "findings") }], body: body.s, diagrams: [] };
}

function cpMilestone(ctx, x) {
  const v = ctx.page.computed.movement?.[x.id];
  const body = html`
    <header class="page-head"><p class="eyebrow">Milestone${x.date ? ` · ${x.date}` : ""}</p><h1>${ctx.stake ? capitalize(x.name || x.id) : `${x.id} · ${x.name}`}</h1>
      <p>${x.fraction ? html`${bar(x.fraction)} ${x.fraction[0]} / ${x.fraction[1]}` : html`<span class="badge status-done">reached</span>`}${!ctx.stake && v && v.prev ? html` <span class="muted">(was ${v.prev[0]} / ${v.prev[1]})</span>` : ""}</p>
      ${ctx.stake ? html`<p class="explain">${prose(ctx, `cp:milestone:${x.id}`)}</p>` : ""}</header>
    ${ctx.stake ? "" : x.items.length ? section("Gate items", renderBlocks([{ type: "ul", items: x.items.map((it) => ({ checked: it.met, text: it.text })) }])) : section("Gate", html`<p>${inline(x.raw)}</p>`)}
    ${ctx.stake ? "" : src(ctx.m.files.progress, x.line)}`;
  return { title: ctx.stake ? capitalize(x.name || x.id) : x.id, crumbs: [ctx.stake ? { label: `Progress on ${ctx.m.project.date}`, href: href(ctx.a) } : home(ctx), { label: ctx.stake ? capitalize(x.name || x.id) : x.id, href: href(ctx.a, "milestone", x.id) }], body: body.s, diagrams: [] };
}

function cpStatus(ctx, id) {
  const tree = new Map(ctx.m.tree.map((n) => [n.id, n]));
  const root = ctx.m.project.root;
  const at = tree.has(id) ? id : root;
  const rows = new Map(ctx.m.atlas.map((r) => [r.node, r]));
  const sub = (nid) => {
    const out = [nid];
    for (const c of tree.get(nid)?.children ?? []) out.push(...sub(c));
    return out;
  };
  const totals = (nid) => sub(nid).reduce((acc, x) => {
    const r = rows.get(x);
    return r ? { live: acc.live + r.live, done: acc.done + r.done, warn: acc.warn || r.warn } : acc;
  }, { live: 0, done: 0, warn: false });
  const kids = (tree.get(at)?.children ?? []).map((c) => tree.get(c)).filter((n) => n && n.status === "active");
  const tooBig = kids.length + 1 > MAX_BOXES;
  const box = (n) => {
    const t = totals(n.id);
    return { id: n.id, label: n.name, sub: t.live ? `${t.done} of ${t.live} ${ctx.stake ? "pieces of work" : "phases"} done` : ctx.stake ? "nothing planned yet" : "no phases", role: t.warn ? "status-contingent" : t.live && t.done === t.live ? "status-done" : "status-planned", href: (tree.get(n.id)?.children ?? []).length || rows.has(n.id) ? href(ctx.a, "status", n.id) : null };
  };
  const node = tree.get(at);
  const nodes = [box(node), ...kids.map(box)];
  const spec = { direction: "TB", nodes, edges: kids.map((k) => ({ from: node.id, to: k.id, kind: "depends", label: "" })), legend: [{ swatch: "status-done", text: "every phase done" }, { swatch: "status-planned", text: "phases remaining" }, { swatch: "status-contingent", text: ctx.stake ? "needs a correction" : "the atlas flags a count" }] };
  const r = rows.get(at);
  const t = totals(at);
  const crumbs = [ctx.stake ? { label: `Progress on ${ctx.m.project.date}`, href: href(ctx.a) } : home(ctx)];
  for (let n = node; n; n = n.parent ? tree.get(n.parent) : null) crumbs.splice(1, 0, { label: n.name, href: href(ctx.a, "status", n.id) });
  const body = html`
    <header class="page-head"><p class="eyebrow">Build progress</p><h1>${node.name}</h1>
      <p class="explain">${t.live ? `${t.done} of ${t.live} ${ctx.stake ? "pieces of work" : "phases"} done.` : ""}</p></header>
    ${kids.length && !tooBig ? diagramSlot("status") : ""}
    ${tooBig ? html`<p class="explain">${kids.length} ${ctx.stake ? "parts are too many to draw as one picture; they are listed below." : "children are too many to draw; they are listed below."}</p><ul>${kids.map((k) => html`<li><a href="${href(ctx.a, "status", k.id)}">${k.name}</a> · ${box(k).sub}</li>`)}</ul>` : ""}
    ${r && !ctx.stake ? section("From the atlas", html`<dl><dt>Live</dt><dd>${r.live}</dd><dt>Done</dt><dd>${r.done}${r.warn ? " (flagged)" : ""}</dd><dt>Remaining</dt><dd>${inline(r.remaining)}</dd></dl>`) : ""}
    ${ctx.stake ? "" : src(ctx.m.files.atlas, r?.line)}`;
  return { title: node.name, crumbs, body: body.s, diagrams: kids.length && !tooBig ? [{ id: "status", spec }] : [] };
}
