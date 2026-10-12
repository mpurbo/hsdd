import { test } from "node:test";
import assert from "node:assert/strict";
import { completedModel, planPage } from "./helpers/plan-fixture.mjs";
import { crossCheckPlan } from "../skills/hsdd-summary/scripts/checks-plan.mjs";
import { renderPlan, PLAN_AUDIENCES } from "../skills/hsdd-summary/scripts/views-plan.mjs";
import { parseRoute, href, esc, html, block } from "../skills/hsdd-summary/scripts/views-core.mjs";
import { namesId } from "../skills/hsdd-summary/scripts/prose.mjs";

const model = completedModel();
const page = planPage(model, { findings: crossCheckPlan(model).findings });

function routes(m) {
  return [
    { view: "top" },
    ...m.nodes.map((n) => ({ view: "node", id: n.id })),
    ...m.phases.map((p) => ({ view: "phase", id: p.id })),
    { view: "contracts" },
    ...m.contracts.map((c) => ({ view: "contract", id: c.ref })),
    { view: "adrs" },
  ];
}

export function visibleText(view) {
  const body = view.body.replace(/<[^>]*>/g, " ");
  const diagram = view.diagrams.flatMap((d) => [...d.spec.nodes.flatMap((n) => [n.label, n.sub]), ...d.spec.edges.map((e) => e.label), ...d.spec.legend.map((l) => l.text)]);
  return [view.title, ...view.crumbs.map((c) => c.label), body, ...diagram].join("\n").replace(/&[a-z#0-9]+;/g, " ");
}

test("parseRoute: audience, view, id with dots and @", () => {
  assert.deepEqual(parseRoute("#stakeholder/contract/auth-token%40v1", PLAN_AUDIENCES), { audience: "stakeholder", view: "contract", id: "auth-token@v1" });
  assert.deepEqual(parseRoute("", PLAN_AUDIENCES), { audience: "reviewer", view: "top", id: null });
  assert.deepEqual(parseRoute("#node/acme.api", PLAN_AUDIENCES), { audience: "reviewer", view: "node", id: "acme.api" });
  assert.equal(href("reviewer", "contract", "auth-token@v1"), "#reviewer/contract/auth-token%40v1");
});

test("every route renders for every audience", () => {
  for (const audience of PLAN_AUDIENCES) for (const r of routes(model)) {
    const v = renderPlan(page, { audience, ...r });
    assert.ok(v.title && v.body && Array.isArray(v.crumbs) && Array.isArray(v.diagrams), `${audience} ${r.view} ${r.id}`);
  }
});

test("the stakeholder never sees an id", () => {
  for (const r of routes(model)) {
    const text = visibleText(renderPlan(page, { audience: "stakeholder", ...r }));
    assert.equal(namesId(text, model.ids), null, `${r.view} ${r.id ?? ""}: ${namesId(text, model.ids)}`);
  }
});

test("top view: child boxes, contract edges, outside box, legend", () => {
  const v = renderPlan(page, { audience: "reviewer", view: "top" });
  const spec = v.diagrams[0].spec;
  assert.deepEqual(spec.nodes.map((n) => n.id), ["acme.api", "acme.ops", "acme.web", "(outside)"]);
  assert.deepEqual(spec.nodes.find((n) => n.id === "acme.ops").role, "asbuilt");
  assert.ok(spec.edges.some((e) => e.from === "acme.api" && e.to === "acme.web" && e.label === "auth-token@v1, session@v1"));
  assert.ok(spec.legend.some((l) => l.edge === "contract"));
  assert.match(v.body, /outlet-api@v1 is named, not yet written/);
  assert.match(v.body, /Retired nodes \(1\)/);
});

test("leaf view: phase boxes by tier; stakeholder sees steps", () => {
  const r = renderPlan(page, { audience: "reviewer", view: "node", id: "acme.api" }).diagrams[0].spec;
  assert.deepEqual(r.nodes.map((n) => [n.label, n.role]), [["api.1", "tier-gate-only"], ["api.2", "tier-full-review"], ["api.3", "tier-full-review"]]);
  assert.match(r.nodes[2].sub, /waits on OQ1/);
  const s = renderPlan(page, { audience: "stakeholder", view: "node", id: "acme.api" }).diagrams[0].spec;
  assert.deepEqual(s.nodes.map((n) => [n.label, n.sub]), [["Step 1", "1 piece of work"], ["Step 2", "1 piece of work"], ["Step 3", "1 piece of work"]]);
});

test("a long chain of steps becomes an ordered list, not a diagram", () => {
  const m = completedModel();
  for (let i = 4; i <= 9; i++) m.phases.push({ ...m.phases[0], id: `acme.api.${i}`, n: i, heading: `api.${i}`, dependsOn: [`acme.api.${i - 1}`], collidesWith: [], contingentOn: [], citesOq: [] });
  const v = renderPlan(planPage(m), { audience: "stakeholder", view: "node", id: "acme.api" });
  assert.equal(v.diagrams.length, 0);
  assert.equal((v.body.match(/<li>/g) ?? []).length >= 9, true);
  assert.match(v.body, /<ol class="steps">/);
});

test("implementer sees gates; reviewer does not get the gate column", () => {
  assert.match(renderPlan(page, { audience: "implementer", view: "node", id: "acme.api" }).body, /<th>Gate<\/th>/);
  assert.doesNotMatch(renderPlan(page, { audience: "reviewer", view: "node", id: "acme.api" }).body, /<th>Gate<\/th>/);
});

test("stakeholder phase links fall back to the node; unknown ids fall back to the top", () => {
  assert.equal(renderPlan(page, { audience: "stakeholder", view: "phase", id: "acme.api.2" }).title, "Token Service");
  assert.equal(renderPlan(page, { audience: "reviewer", view: "node", id: "nope" }).title, "Acme Platform");
  assert.equal(renderPlan(page, { audience: "reviewer", view: "bogus" }).title, "Acme Platform");
});

test("a finding cited by two nodes in scope is listed once", () => {
  const body = renderPlan(page, { audience: "reviewer", view: "top" }).body;
  assert.equal(body.match(/outlet-api@v1 is named, not yet written/g).length, 1);
  assert.match(renderPlan(page, { audience: "stakeholder", view: "top" }).body, /1 connection is named but not yet written down/);
});

test("ordered collisions are counted, not listed", () => {
  const body = renderPlan(page, { audience: "reviewer", view: "node", id: "acme.api" }).body;
  assert.match(body, /1 collision a dependency already orders/);
  assert.doesNotMatch(body, /acme\.api\.2 and acme\.api\.3 edit the same files/);
});

test("hostile text is escaped everywhere", () => {
  const m = completedModel();
  m.nodes[1].name = "<script>alert(1)</script>";
  m.nodes[1].purpose = '"><img src=x onerror=alert(1)>';
  const p = planPage(m);
  p.prose["explain:acme.api"] = "</p><script>x()</script>";
  for (const audience of PLAN_AUDIENCES) for (const r of routes(m)) {
    const v = renderPlan(p, { audience, ...r });
    assert.doesNotMatch(v.body, /<script|<img/i, `${audience} ${r.view} ${r.id}`);
  }
});

test("views-core: esc, html, block", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(html`<b>${"<i>"}</b>`.s, "<b>&lt;i&gt;</b>");
  assert.equal(block("- a `b`\n- **c**").s, "<ul><li>a <code>b</code></li><li><strong>c</strong></li></ul>");
  assert.equal(block("one\ntwo").s, "<p>one two</p>");
});

test("views-core: inline links, emphasis; renderBlocks escapes and adds copy buttons", async () => {
  const { inline, renderBlocks } = await import("../skills/hsdd-summary/scripts/views-core.mjs");
  assert.equal(inline("see [the plan](2026-09-15-execution-plan.md) and *Validate:* `x`").s, "see the plan and <em>Validate:</em> <code>x</code>");
  const out = renderBlocks([{ type: "code", lang: "", text: "<b>run</b>" }, { type: "ul", items: [{ checked: true, text: "a" }, { checked: null, text: "b" }] }]).s;
  assert.match(out, /data-copy/);
  assert.match(out, /&lt;b&gt;run&lt;\/b&gt;/);
  assert.match(out, /\u2611/);
});

test("a non-root node draws the elsewhere box for contracts produced outside its parent", () => {
  const v = renderPlan(page, { audience: "reviewer", view: "node", id: "acme.web" });
  const spec = v.diagrams[0].spec;
  assert.ok(spec.nodes.some((n) => n.id === "(elsewhere)" && n.label === "Elsewhere in the tree"));
  assert.ok(spec.edges.some((e) => e.from === "(elsewhere)" && e.to === "acme.web.console"));
  assert.ok(spec.legend.some((l) => l.text === "elsewhere in the tree"));
  assert.ok(!spec.legend.some((l) => l.text === "outside the tree"));
  const s = renderPlan(page, { audience: "stakeholder", view: "node", id: "acme.web" }).diagrams[0].spec;
  assert.ok(s.legend.some((l) => l.text === "another part of this plan"));
});

function bigModel() {
  const m = completedModel();
  const tmpl = m.nodes.find((x) => x.id === "acme.ops");
  for (let i = 1; i <= 11; i++) {
    const id = `acme.k${i}`;
    m.nodes.push({ ...tmpl, id, name: `K${i}`, children: [], phases: [], sourceFile: `hsdd/spec/${id}.md` });
    m.nodes.find((x) => x.id === "acme").children.push(id);
  }
  return m;
}

test("too many children: the node and top views say so, and the contracts page drops its diagram", () => {
  const m = bigModel();
  const bp = planPage(m, { findings: crossCheckPlan(m).findings });
  const rev = renderPlan(bp, { audience: "reviewer", view: "top" });
  assert.equal(rev.diagrams.length, 0);
  assert.match(rev.body, /14 children are too many to draw/);
  const stk = renderPlan(bp, { audience: "stakeholder", view: "top" });
  assert.match(stk.body, /14 parts are too many to draw as one picture/);
  assert.equal(namesId(visibleText(stk), m.ids), null);
  const c = renderPlan(bp, { audience: "reviewer", view: "contracts" });
  assert.equal(c.diagrams.length, 0);
  assert.match(c.body, /14 parts are too many to draw/);
});

test("too many phases: the leaf page says the phases were grouped into steps", () => {
  const m = completedModel();
  const node = m.nodes.find((x) => x.id === "acme.api");
  for (let i = 1; i <= 13; i++) {
    const id = `acme.api.${100 + i}`;
    m.phases.push({ ...m.phases[0], id, n: 100 + i, heading: `api.${100 + i}`, dependsOn: [], collidesWith: [], contingentOn: [], citesOq: [] });
    node.phases.push(id);
  }
  const v = renderPlan(planPage(m), { audience: "reviewer", view: "node", id: "acme.api" });
  assert.match(v.body, /phases are too many to draw one by one/);
});
