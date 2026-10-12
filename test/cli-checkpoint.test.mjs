import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TREE } from "./helpers/plan-fixture.mjs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { main } from "../skills/hsdd-summary/scripts/summary.mjs";

function run(root, ...argv) {
  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    return { code: main(argv, root), out: lines.join("\n") };
  } catch (e) {
    return { code: 1, out: lines.join("\n"), error: e.message };
  } finally {
    console.log = log;
  }
}

function plan(root, model) {
  run(root, "extract", "plan", "--model", model);
  const m = JSON.parse(readFileSync(model, "utf8"));
  m.phases[4].tier = "spot-check";
  m.phases[5].dependsOn = ["acme.web.console.2"];
  m.unparsed = [];
  writeFileSync(model, JSON.stringify(m));
  run(root, "slots", "--model", model);
  const p = join(root, "hsdd/summary/prose.json");
  const s = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(s.entries)) if (k.startsWith("explain:")) s.entries[k].text = "Plain words about what this part does.";
  writeFileSync(p, JSON.stringify(s));
  const g = join(root, "hsdd/summary/glossary.json");
  const gl = JSON.parse(readFileSync(g, "utf8"));
  for (const k of Object.keys(gl.entries)) gl.entries[k] = "a connection";
  writeFileSync(g, JSON.stringify(gl));
  run(root, "stamp", "--model", model);
  return run(root, "render", "--model", model);
}

test("checkpoint pipeline, beside a plan page that it never makes stale", () => {
  const root = mkdtempSync(join(tmpdir(), "hsdd-cp-"));
  cpSync(TREE, root, { recursive: true });
  assert.equal(plan(root, join(root, "plan.json")).code, 0);
  const model = join(root, "cp.json");
  let r = run(root, "extract", "checkpoint", "--model", model);
  assert.match(r.out, /\/plan\/steps\/1\/lanes/);
  const m = JSON.parse(readFileSync(model, "utf8"));
  m.plan.steps[1].lanes = ["API", "Web"];
  m.unparsed = [];
  writeFileSync(model, JSON.stringify(m));
  assert.equal(run(root, "validate", "checkpoint", "--model", model).code, 0);
  assert.match(run(root, "render", "checkpoint", "--model", model).error, /required slot/);
  r = run(root, "slots", "checkpoint", "--model", model);
  assert.match(r.out, /cp:verdict \(max 60 words, no ids\)/);
  const p = join(root, "hsdd/summary/checkpoint-prose.json");
  const s = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(s.entries)) s.entries[k].text = "Plain words for whoever reads this.";
  writeFileSync(p, JSON.stringify(s));
  run(root, "stamp", "checkpoint", "--model", model);
  r = run(root, "render", "checkpoint", "--model", model);
  assert.equal(r.code, 0, r.error);
  assert.ok(existsSync(join(root, "hsdd/summary/checkpoint.html")));
  const html = readFileSync(join(root, "hsdd/summary/checkpoint.html"), "utf8");
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1].replace(/&#39;/g, "'");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  for (const sc of scripts) assert.ok(csp.includes(`'sha256-${createHash("sha256").update(sc, "utf8").digest("base64")}'`));
  new vm.Script(scripts[1]);
  assert.match(scripts[1], /render: renderCheckpoint/);
  r = run(root, "check");
  assert.match(r.out, /checkpoint\.html: fresh/);
  assert.match(r.out, /summary\.html: fresh/);
  writeFileSync(join(root, "hsdd/management/2026-10-09-progress.md"), "# acme · Progress Report (2026-10-09)\n");
  r = run(root, "check");
  assert.match(r.out, /checkpoint\.html: stale\n  added: hsdd\/management\/2026-10-09-progress\.md/);
  assert.match(r.out, /summary\.html: fresh/);
});
