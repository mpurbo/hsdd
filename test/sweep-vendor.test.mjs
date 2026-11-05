import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repo = fileURLToPath(new URL("..", import.meta.url));
const SCRIPTS = `${repo}skills/hsdd-intake/scripts`;
const COPIES = {
  "hsdd-adopt": ["routes.mjs", "topics.mjs", "migrations.mjs", "schemas.mjs", "diff.mjs", "walk.mjs"],
  "hsdd-summary": ["md.mjs", "extract-plan.mjs"],
};

test("the eight copies are byte-identical to their sources", () => {
  for (const [skill, files] of Object.entries(COPIES)) {
    for (const f of files) {
      assert.equal(
        readFileSync(`${SCRIPTS}/${f}`, "utf8"),
        readFileSync(`${repo}skills/${skill}/scripts/${f}`, "utf8"),
        `${f} drifted from ${skill}'s copy`,
      );
    }
  }
});

function scriptFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? scriptFiles(p) : name.endsWith(".mjs") || name.endsWith(".js") ? [p] : [];
  });
}

test("every import under the scripts is relative or node:", () => {
  const spec = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  for (const file of scriptFiles(SCRIPTS)) {
    for (const [, s] of readFileSync(file, "utf8").matchAll(spec)) {
      assert.ok(
        s.startsWith("./") || s.startsWith("../") || s.startsWith("node:"),
        `${file} imports "${s}", which is neither relative nor node:`,
      );
    }
  }
});
