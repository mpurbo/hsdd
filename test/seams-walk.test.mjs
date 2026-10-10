import { test } from "node:test";
import assert from "node:assert/strict";
import { walk, EXCLUDED_DIRS } from "../skills/hsdd-adopt/scripts/walk.mjs";
import { fixtureDir } from "./helpers/brownfield-fixture.mjs";

test("walk lists files, sorted, relative, excluding vendor and friends", () => {
  const files = walk(fixtureDir());
  assert.deepEqual(files, [
    "CODEOWNERS", "cmd/server/main.go", "db/migrations/001_init.sql", "db/migrations/002_batches.sql",
    "go.mod", "package.json", "src/billing/server.js", "src/merchant/schema.graphql",
    "src/payouts/handlers.go", "src/payouts/openapi.yaml",
  ]);
  assert.ok(EXCLUDED_DIRS.has("node_modules") && EXCLUDED_DIRS.has("vendor"));
});

test("walk restricts to prefixes by path segment, not by string prefix", () => {
  assert.deepEqual(walk(fixtureDir(), { prefixes: ["src/payouts"] }), ["src/payouts/handlers.go", "src/payouts/openapi.yaml"]);
  assert.deepEqual(walk(fixtureDir(), { prefixes: ["src/pay"] }), []);
});

import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-walk-"));
  for (const p of files) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), "x\n");
  }
  return dir;
}

test("walk skips hsdd, hsdd-context and openspec at the top level only", () => {
  const dir = tree(["hsdd/spec/a.md", "hsdd/scripts/summary/plan.schema.json", "hsdd-context/generic/p.md", "openspec/config.yaml", "src/hsdd/keep.js", "src/a.js"]);
  assert.deepEqual(walk(dir), ["src/a.js", "src/hsdd/keep.js"]);
});

test("under prefixes the walk starts at them and reports unreadable directories only inside them", () => {
  const dir = tree(["src/a/x.js", "src/a/deep/y.js", "src/b/z.js", "root.js", "vendor/v/w.js"]);
  mkdirSync(join(dir, "src/locked"));
  mkdirSync(join(dir, "src/a/locked"));
  symlinkSync(join(dir, "src/b"), join(dir, "src/link"));
  chmodSync(join(dir, "src/locked"), 0o000);
  chmodSync(join(dir, "src/a/locked"), 0o000);
  try {
    const skipped = [];
    assert.deepEqual(walk(dir, { prefixes: ["src/a", "./src/a/deep/", "root.js"], onSkip: (p) => skipped.push(p) }), ["root.js", "src/a/deep/y.js", "src/a/x.js"]);
    assert.deepEqual(skipped, ["src/a/locked"]);
    assert.deepEqual(walk(dir, { prefixes: ["../", "src/../src/b", "src/link", "vendor/v", "src/missing"] }), []);
  } finally {
    chmodSync(join(dir, "src/locked"), 0o755);
    chmodSync(join(dir, "src/a/locked"), 0o755);
  }
});
