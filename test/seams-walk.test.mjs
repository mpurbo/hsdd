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
