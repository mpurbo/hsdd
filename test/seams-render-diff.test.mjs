import { test } from "node:test";
import assert from "node:assert/strict";
import { renderObservedSurface } from "../skills/hsdd-adopt/scripts/render.mjs";
import { parseObservedSurface, diffSurface } from "../skills/hsdd-adopt/scripts/diff.mjs";
import { extract } from "../skills/hsdd-adopt/scripts/extract-seams.mjs";
import { makeRepo } from "./helpers/brownfield-fixture.mjs";

test("render follows the fixed bullet order and round-trips through parse", () => {
  const { dir, sha } = makeRepo();
  const md = renderObservedSurface(extract(dir));
  const lines = md.split("\n");
  assert.equal(lines[0], "## Observed surface");
  assert.deepEqual(lines.slice(2, 9).map((l) => l.split(":")[0]), ["- extracted", "- modules", "- routes", "- tables", "- topics", "- owners", "- unknown"]);
  assert.match(lines[2], new RegExp(`@ ${sha}  \\(hsdd/scripts/seams/extract-seams.mjs\\)$`));
  assert.equal(lines[4], "- routes: 4  (GET /v1/invoices, POST /v1/invoices/:id/pay, GET /v1/payouts, POST /v1/payouts)");
  assert.equal(lines[5], "- tables: merchants, payout_batches, payouts");
  assert.equal(lines[6], "- topics: produces invoice.paid, payout.settled; consumes kyc.verified");
  assert.equal(lines[7], "- owners: @payments-team, @platform, @treasury");
  const p = parseObservedSurface("# x\n\n" + md + "\n\n## Next\n");
  assert.equal(p.extracted.sha, sha);
  assert.deepEqual(p.modules, ["cmd/server", "db", "src/billing", "src/merchant", "src/payouts"]);
  assert.equal(p.routes.count, 4);
  assert.deepEqual(p.tables, ["merchants", "payout_batches", "payouts"]);
});

test("parse returns null without a section and keeps unknown lines", () => {
  assert.equal(parseObservedSurface("# spec\n\n## Node\n"), null);
  const p = parseObservedSurface("## Observed surface\n\n- extracted: 2026-01-01 @ abc1234  (x)\n- modules: a/\n- routes: 0\n- tables: none found\n- topics: none found\n- owners: no CODEOWNERS\n- unknown: retry logic (no tests)\n- unknown: cron owner\n");
  assert.deepEqual(p.unknown, ["retry logic (no tests)", "cron owner"]);
  assert.deepEqual(p.tables, []);
});

test("diff reports added and removed facts and ignores unknown lines", () => {
  const { dir } = makeRepo();
  const model = extract(dir);
  const recorded = parseObservedSurface(renderObservedSurface(model).replace("- tables: merchants, payout_batches, payouts", "- tables: merchants, payouts, legacy_ledger").replace("- routes: 4  (", "- routes: 3  (") + "- unknown: anything\n");
  const d = diffSurface(recorded, model);
  assert.deepEqual(d, [
    { field: "routes.count", kind: "changed", value: "3 -> 4" },
    { field: "tables", kind: "added", value: "payout_batches" },
    { field: "tables", kind: "removed", value: "legacy_ledger" },
  ]);
  assert.deepEqual(diffSurface(parseObservedSurface(renderObservedSurface(model)), model), []);
});
