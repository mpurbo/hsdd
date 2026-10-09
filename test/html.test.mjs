import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { completedModel, planPage } from "./helpers/plan-fixture.mjs";
import { crossCheckPlan } from "../skills/hsdd-summary/scripts/checks-plan.mjs";
import { renderPage, toClassic } from "../skills/hsdd-summary/scripts/html.mjs";
import { renderPlan, PLAN_AUDIENCES } from "../skills/hsdd-summary/scripts/views-plan.mjs";
import { readPageStamp } from "../skills/hsdd-summary/scripts/stamp.mjs";

const model = completedModel();
const page = planPage(model, { findings: crossCheckPlan(model).findings, project: model.project, generated: "2026-10-09" });
const stamp = { kind: "plan", generated: "2026-10-09", specSha: "abc1234", inputs: { "hsdd/spec/acme.md": "sha256:" + "a".repeat(64) } };
const out = renderPage({ kind: "plan", page, stamp });

const sha = (t) => `'sha256-${createHash("sha256").update(t, "utf8").digest("base64")}'`;
const scripts = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const style = /<style>([\s\S]*?)<\/style>/.exec(out)[1];
const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(out)[1].replace(/&#39;/g, "'");

test("one file: CSP lists the exact hash of every inline script and the style", () => {
  assert.equal(scripts.length, 2);
  for (const s of scripts) assert.ok(csp.includes(sha(s)), "script hash missing from CSP");
  assert.ok(csp.includes(`style-src ${sha(style)}`));
  assert.match(csp, /^default-src 'none';/);
});

test("offline: no src attributes, no external URLs in attributes", () => {
  assert.doesNotMatch(out, /\ssrc=/i);
  assert.doesNotMatch(out, /(href|src|action)="https?:/i);
});

test("every link a view renders is a route or a relative source link", () => {
  const routes = [{ view: "top" }, ...model.nodes.map((n) => ({ view: "node", id: n.id })), ...model.phases.map((p) => ({ view: "phase", id: p.id })), { view: "contracts" }, { view: "adrs" }];
  for (const audience of PLAN_AUDIENCES) for (const r of routes) {
    for (const [, h] of renderPlan(page, { audience, ...r }).body.matchAll(/href="([^"]*)"/g)) assert.match(h, /^(#|\.\.\/)/, h);
  }
});

test("the bundle compiles as a classic script and defines what the runtime needs", () => {
  new vm.Script(scripts[1]);
  assert.match(scripts[1], /const PAGE_VIEWS = \{ audiences: PLAN_AUDIENCES, render: renderPlan/);
  assert.doesNotMatch(scripts[1], /^\s*(import|export)\s/m);
});

test("the page carries its data and stamp, readable back", () => {
  assert.deepEqual(readPageStamp(out), stamp);
  const data = JSON.parse(/<script type="application\/json" id="hsdd-page">([^<]*)<\/script>/.exec(out)[1]);
  assert.equal(data.model.project.root, "acme");
});

test("toClassic drops imports and unexports declarations only", () => {
  const src = 'import { a } from "./a.mjs";\nexport const X = 1;\nexport function f() {}\nexport class C {}\nconst s = "export const";\n';
  assert.equal(toClassic(src), 'const X = 1;\nfunction f() {}\nclass C {}\nconst s = "export const";\n');
});

test("hostile model text cannot break out of the data script", () => {
  const m = completedModel();
  m.nodes[1].name = "</script><script>alert(1)</script>";
  const html = renderPage({ kind: "plan", page: planPage(m, { project: m.project }), stamp });
  assert.equal((html.match(/<script/g) ?? []).length, 4);
});

test("the inlined layout library carries its MIT notice and no source-map pointer", () => {
  assert.match(scripts[0], /Copyright \(c\) 2012-2014 Chris Pettitt/);
  assert.match(scripts[0], /Permission is hereby granted/);
  assert.doesNotMatch(scripts[0], /sourceMappingURL/);
});
