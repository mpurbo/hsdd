import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TREE } from "./helpers/plan-fixture.mjs";
import { main } from "../skills/hsdd-summary/scripts/summary.mjs";

function run(root, ...argv) {
  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    const code = main(argv, root);
    return { code, out: lines.join("\n") };
  } catch (e) {
    return { code: 1, out: lines.join("\n"), error: e.message };
  } finally {
    console.log = log;
  }
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "hsdd-cli-"));
  cpSync(TREE, root, { recursive: true });
  return { root, model: join(root, "model.json") };
}

function fillUnparsed(path) {
  const m = JSON.parse(readFileSync(path, "utf8"));
  m.phases[4].tier = "spot-check";
  m.phases[5].dependsOn = ["acme.web.console.2"];
  m.unparsed = [];
  writeFileSync(path, JSON.stringify(m));
}

function fillProse(root) {
  const p = join(root, "hsdd/summary/prose.json");
  const g = join(root, "hsdd/summary/glossary.json");
  const s = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(s.entries)) if (k.startsWith("explain:")) s.entries[k].text = "Plain words about what this part does.";
  writeFileSync(p, JSON.stringify(s));
  const gl = JSON.parse(readFileSync(g, "utf8"));
  for (const k of Object.keys(gl.entries)) gl.entries[k] = "a connection";
  writeFileSync(g, JSON.stringify(gl));
}

test("the whole pipeline: extract, validate, slots, stamp, render, check", () => {
  const { root, model } = project();
  let r = run(root, "extract", "plan", "--model", model);
  assert.equal(r.code, 0);
  assert.match(r.out, /unparsed: .* \(2\)/);
  assert.equal(run(root, "validate", "--model", model).code, 1);
  fillUnparsed(model);
  assert.equal(run(root, "validate", "--model", model).code, 0);
  r = run(root, "render", "--model", model);
  assert.match(r.error, /required slot\(s\) are empty/);
  r = run(root, "slots", "--model", model);
  assert.match(r.out, /explain:acme \(max 25 words, no ids\)/);
  fillProse(root);
  assert.match(run(root, "stamp", "--model", model).out, /restamped \(5\)/);
  r = run(root, "render", "--model", model);
  assert.equal(r.code, 0, r.error);
  assert.ok(existsSync(join(root, "hsdd/summary/summary.html")));
  assert.match(run(root, "check").out, /summary\.html: fresh/);
  appendFileSync(join(root, "hsdd/spec/acme.ops.md"), "\nmore\n");
  r = run(root, "check");
  assert.equal(r.code, 0);
  assert.match(r.out, /summary\.html: stale\n  changed: hsdd\/spec\/acme\.ops\.md/);
});

test("stamp refuses the page; render refuses a path outside hsdd/summary/", () => {
  const { root, model } = project();
  run(root, "extract", "plan", "--model", model);
  fillUnparsed(model);
  run(root, "slots", "--model", model);
  fillProse(root);
  assert.match(run(root, "stamp", "hsdd/summary/summary.html").error, /stamped by render/);
  assert.match(run(root, "render", "--model", model, "-o", "elsewhere.html").error, /under hsdd\/summary/);
});

test("check survives a malformed prose store and a page with no stamp", () => {
  const { root } = project();
  writeFileSync(join(root, "hsdd/summary.tmp"), "");
  cpSync(join(root, "hsdd/conventions.md"), join(root, "hsdd/summary/x.html"), { force: true });
  writeFileSync(join(root, "hsdd/summary/bare.html"), '<script type="application/json" id="hsdd-stamp">{"kind":"plan"}</script>');
  writeFileSync(join(root, "hsdd/summary/prose.json"), "{ not json");
  const r = run(root, "check");
  assert.equal(r.code, 0);
  assert.equal(r.error, undefined);
  assert.match(r.out, /x\.html: no readable stamp/);
  assert.match(r.out, /bare\.html: no readable stamp; regenerate it/);
  assert.match(r.out, /prose store unreadable/);
});
