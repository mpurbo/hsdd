import { test } from "node:test";
import assert from "node:assert/strict";
import { manifests } from "../skills/hsdd-adopt/scripts/manifests.mjs";
import { routes } from "../skills/hsdd-adopt/scripts/routes.mjs";
import { schemas } from "../skills/hsdd-adopt/scripts/schemas.mjs";
import { migrations } from "../skills/hsdd-adopt/scripts/migrations.mjs";
import { topics } from "../skills/hsdd-adopt/scripts/topics.mjs";
import { owners } from "../skills/hsdd-adopt/scripts/owners.mjs";
import { coupling } from "../skills/hsdd-adopt/scripts/coupling.mjs";
import { walk } from "../skills/hsdd-adopt/scripts/walk.mjs";
import { modules, extract } from "../skills/hsdd-adopt/scripts/extract-seams.mjs";
import { fixtureDir, makeRepo, plainCopy } from "./helpers/brownfield-fixture.mjs";

const root = fixtureDir();
const files = walk(root);

test("manifests by basename", () => {
  assert.deepEqual(manifests(files), [{ path: "go.mod", kind: "go.mod" }, { path: "package.json", kind: "package.json" }]);
});

test("routes across JS and Go, with method, path, file and line; vendor ignored", () => {
  assert.deepEqual(routes(root, files), [
    { method: "GET", path: "/v1/invoices", file: "src/billing/server.js", line: 2 },
    { method: "POST", path: "/v1/invoices/:id/pay", file: "src/billing/server.js", line: 3 },
    { method: "GET", path: "/v1/payouts", file: "src/payouts/handlers.go", line: 4 },
    { method: "POST", path: "/v1/payouts", file: "src/payouts/handlers.go", line: 5 },
  ]);
});

test("schemas by kind", () => {
  assert.deepEqual(schemas(files), [
    { path: "src/merchant/schema.graphql", kind: "graphql" },
    { path: "src/payouts/openapi.yaml", kind: "openapi" },
  ]);
});

test("migrations and the tables they create", () => {
  assert.deepEqual(migrations(root, files), {
    files: ["db/migrations/001_init.sql", "db/migrations/002_batches.sql"],
    tables: ["merchants", "payout_batches", "payouts"],
  });
});

test("topics produced and consumed, dotted names only", () => {
  const t = topics(root, files);
  assert.deepEqual(t.produces.map((x) => x.topic), ["invoice.paid", "payout.settled"]);
  assert.deepEqual(t.consumes.map((x) => x.topic), ["kyc.verified"]);
  assert.equal(t.consumes[0].file, "src/payouts/handlers.go");
});

test("owners from CODEOWNERS, comments skipped", () => {
  // A git copy: CODEOWNERS is read from the git top level, and the fixture
  // itself sits inside this repository's.
  assert.deepEqual(owners(makeRepo().dir, files), [
    { pattern: "/src/billing/", owners: ["@payments-team"], file: "CODEOWNERS" },
    { pattern: "/src/payouts/", owners: ["@payments-team", "@treasury"], file: "CODEOWNERS" },
    { pattern: "/cmd/", owners: ["@platform"], file: "CODEOWNERS" },
  ]);
});

test("modules follow the two-segment rule under src, cmd and friends", () => {
  assert.deepEqual(modules(files).map((m) => m.path), ["cmd/server", "db", "src/billing", "src/merchant", "src/payouts"]);
});

test("coupling counts co-changes per commit at min 2", () => {
  const { dir } = makeRepo();
  assert.deepEqual(coupling(dir, { min: 2 }), [
    { a: "db", b: "src/billing", count: 2 },
    { a: "db", b: "src/payouts", count: 2 },
    { a: "src/billing", b: "src/payouts", count: 2 },
  ]);
  assert.deepEqual(coupling(plainCopy()), []);  // no git history: empty, never an error
});

test("extract assembles the model with sha and date, honoring prefixes", () => {
  const { dir, sha } = makeRepo();
  const m = extract(dir, { prefixes: ["src/payouts"] });
  assert.equal(m.kind, "seams");
  assert.equal(m.sha, sha);
  assert.match(m.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(m.modules.map((x) => x.path), ["src/payouts"]);
  assert.equal(m.routes.length, 2);
  assert.deepEqual(m.migrations.tables, []);
});

// Owners by last matching rule per file, in a scratch repository.
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderObservedSurface } from "../skills/hsdd-adopt/scripts/render.mjs";

function scratch(codeowners, paths) {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-owners-"));
  for (const p of paths) {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeFileSync(join(dir, p), "x\n");
  }
  writeFileSync(join(dir, "CODEOWNERS"), codeowners);
  return dir;
}
const ownersLine = (dir, prefixes) => renderObservedSurface(extract(dir, { prefixes })).split("\n").find((l) => l.startsWith("- owners:"));

test("owners: catch-all and extension rules both apply under a prefix", () => {
  const dir = scratch("* @org\n*.go @gophers\n", ["src/billing/a.js", "src/billing/b.go"]);
  assert.equal(ownersLine(dir, ["src/billing"]), "- owners: @gophers, @org");
});

test("owners: the last matching rule wins, not the union", () => {
  const dir = scratch("/src/ @a\n/src/billing/ @b\n", ["src/billing/a.js"]);
  assert.equal(ownersLine(dir, ["src/billing"]), "- owners: @b");
});

test("owners: a last matching rule without owners leaves the files unowned", () => {
  const dir = scratch("/src/ @a\n/src/billing/\n", ["src/billing/a.js"]);
  assert.equal(ownersLine(dir, ["src/billing"]), "- owners: none found");
});

test("owners: the fixture, prefixed and whole", () => {
  const { dir } = makeRepo();
  assert.equal(ownersLine(dir, ["src/payouts"]), "- owners: @payments-team, @treasury");
  assert.equal(ownersLine(dir, []), "- owners: @payments-team, @platform, @treasury");
});

test("owners: a trailing glob segment matches one level; a bare name matches below", async () => {
  const { ownersOf } = await import("../skills/hsdd-adopt/scripts/owners.mjs");
  const rules = [{ pattern: "/docs/", owners: ["@a"] }, { pattern: "docs/*", owners: ["@d"] }];
  assert.deepEqual(ownersOf(rules, "docs/top.md").owners, ["@d"]);
  assert.deepEqual(ownersOf(rules, "docs/sub/deep.md").owners, ["@a"]);
  assert.deepEqual(ownersOf([{ pattern: "docs", owners: ["@b"] }], "docs/sub/deep.md").owners, ["@b"]);
});
