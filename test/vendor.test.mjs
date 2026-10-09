import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = new URL("../skills/hsdd-summary/scripts/vendor/", import.meta.url);

test("the vendored layout engine is the pinned file, with its notices", () => {
  const bytes = readFileSync(new URL("dagre.min.js", dir));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "3152d214941a5df3a3d4c079dfa338c3cd7a6c0d4c1b4c3a2fdb6bba6f6facf9");
  for (const f of ["LICENSE", "dagre.min.js.LEGAL.txt", "README.md"]) assert.ok(existsSync(new URL(f, dir)), f);
  assert.doesNotMatch(bytes.toString("utf8"), /<\/script|<!--/i);
});
