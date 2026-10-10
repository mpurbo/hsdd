import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeRepo } from "./helpers/brownfield-fixture.mjs";

const CLI = new URL("../skills/hsdd-adopt/scripts/extract-seams.mjs", import.meta.url).pathname;
const run = (cwd, ...args) => {
  try { return { out: execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8" }), code: 0 }; }
  catch (e) { return { out: e.stdout + e.stderr, code: e.status }; }
};

test("extract writes a model under the root only", () => {
  const { dir } = makeRepo();
  assert.equal(run(dir, "extract", "-o", "seams.json").code, 0);
  const m = JSON.parse(readFileSync(join(dir, "seams.json"), "utf8"));
  assert.equal(m.kind, "seams");
  assert.equal(m.routes.length, 4);
  assert.notEqual(run(dir, "extract", "-o", "/tmp/outside-seams.json").code, 0);
  assert.ok(!existsSync("/tmp/outside-seams.json"));
});

test("render prints the block; diff finds a drifted route and exits 0; no section exits 2", () => {
  const { dir } = makeRepo();
  const r = run(dir, "render", "--prefix", "src/billing");
  assert.equal(r.code, 0);
  assert.match(r.out, /^## Observed surface\n/);
  assert.match(r.out, /- routes: 2  \(GET \/v1\/invoices, POST \/v1\/invoices\/:id\/pay\)/);
  writeFileSync(join(dir, "billing.md"), "# legacy.billing: Billing\n\n- **Kind:** leaf-parent\n\n" + r.out);
  writeFileSync(join(dir, "src/billing/server.js"), readFileSync(join(dir, "src/billing/server.js"), "utf8") + "\napp.delete('/v1/invoices/:id', remove);\n");
  const d = run(dir, "diff", "billing.md");
  assert.equal(d.code, 0);
  assert.match(d.out, /routes\.count changed 2 -> 3/);
  writeFileSync(join(dir, "plain.md"), "# no surface\n");
  assert.equal(run(dir, "diff", "plain.md").code, 2);
});
