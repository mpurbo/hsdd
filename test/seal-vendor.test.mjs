import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

test("md.mjs and extract-plan.mjs are byte-identical to hsdd-summary's", () => {
  for (const f of ["md.mjs", "extract-plan.mjs"]) {
    assert.equal(
      readFileSync(`${repo}skills/hsdd-seal/scripts/${f}`, "utf8"),
      readFileSync(`${repo}skills/hsdd-summary/scripts/${f}`, "utf8"),
      `${f} drifted from hsdd-summary's copy`,
    );
  }
});
