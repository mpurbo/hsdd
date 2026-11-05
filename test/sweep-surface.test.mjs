import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rangeCommits } from "../skills/hsdd-intake/scripts/lib/git.mjs";
import { surfaceOf, surfaceMoves, commitMoves } from "../skills/hsdd-intake/scripts/lib/surface.mjs";
import { sweepRepo } from "./helpers/sweep-fixture.mjs";
import { gitIn } from "./helpers/seal-fixture.mjs";

const fx = sweepRepo();
const commits = rangeCommits(fx.root, fx.base, fx.shas.contract);
const commit = (key) => commits.find((c) => c.sha === fx.shas[key]);

const empty = () => ({ routes: new Set(), topics: new Set(), tables: new Set(), migrations: new Set(), schemas: new Set() });
const side = (o) => ({ ...empty(), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new Set(v)])) });

test("surfaceMoves names additions and removals in order", () => {
  const before = side({ routes: ["GET /a", "DELETE /z"], topics: ["consumes t.old"], tables: ["old"], migrations: ["m/V1.sql"], schemas: ["s.proto"] });
  const after = side({ routes: ["GET /a", "POST /b"], topics: ["produces t.new"], tables: ["new"], migrations: ["m/V1.sql", "m/V2.sql"], schemas: ["s.proto"] });
  assert.deepEqual(surfaceMoves(before, after, ["m/V1.sql", "s.proto", "hsdd/contract/c.md"]), [
    "route removed DELETE /z", "route added POST /b",
    "topic removed consumes t.old", "topic added produces t.new",
    "table added new", "table removed old",
    "migration changed m/V1.sql", "migration added m/V2.sql",
    "schema changed s.proto",
    "contract changed hsdd/contract/c.md",
  ]);
});
test("surfaceMoves: an unchanged migration or schema in both sides is no move", () => {
  const s = side({ migrations: ["m/V1.sql"], schemas: ["s.proto"] });
  assert.deepEqual(surfaceMoves(s, s, ["src/x.js"]), []);
});
test("surfaceOf keys carry no file or line", () => {
  const s = surfaceOf(join(fx.root), ["src/web/list.js"]);
  assert.ok(s.routes.has("GET /payouts"));
});

const MOVES = { routeAdd: ["route added POST /payouts/preview"], schema: ["schema changed api/openapi.yaml"],
  migration: ["table added holds", "migration added src/web/migrations/V2__holds.sql"],
  alter: ["migration added src/web/migrations/V3__reason.sql"], topic: ["topic added produces payouts.settled"],
  removed: ["route removed DELETE /payouts/old"], contract: ["contract changed hsdd/contract/payouts-api.md"],
  copy: [], moved: [], spaced: [], log: [] };
for (const [key, want] of Object.entries(MOVES)) test(`commitMoves: ${key}`, () => assert.deepEqual(commitMoves(fx.root, commit(key)), want));

test("no temporary directory is left and the working tree is untouched", () => {
  const tmp = mkdtempSync(join(tmpdir(), "hsdd-sweep-t-")); commitMoves(fx.root, commit("routeAdd"), { tmp });
  assert.deepEqual(readdirSync(tmp), []); assert.equal(gitIn(fx.root, "status", "--porcelain"), "");
});
