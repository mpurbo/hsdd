import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../skills/hsdd-seal/scripts/seal.mjs";

function collector() {
  const lines = [];
  return { lines, log: (s) => lines.push(String(s)), error: (s) => lines.push(String(s)) };
}

test("no command prints usage and exits 2", () => {
  const o = collector();
  assert.equal(main([], mkdtempSync(join(tmpdir(), "hsdd-seal-")), o), 2);
  assert.match(o.lines.join("\n"), /usage: seal\.mjs plan \| apply sign\|drop\|prune\|close \| report/);
});

test("an unknown command prints usage and exits 2", () => {
  const o = collector();
  assert.equal(main(["frobnicate"], mkdtempSync(join(tmpdir(), "hsdd-seal-")), o), 2);
  assert.match(o.lines.join("\n"), /usage: seal\.mjs/);
});
