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

// The write helpers in lib/git.mjs are copies of hsdd-seal's. Compare each
// definition's source text; `export ` is stripped, and the one parameter
// difference (`git = runGit`) is the same text on both sides.
function definition(text, name) {
  const start = text.search(new RegExp(`^(?:export )?(?:function ${name}\\b|const ${name} =)`, "m"));
  assert.ok(start >= 0, `${name} not found`);
  const rest = text.slice(start);
  const end = rest.search(/^[}\]];?\s*$/m);
  const closing = rest.indexOf("\n", end);
  return rest.slice(0, closing < 0 ? rest.length : closing).replace(/^export /, "");
}

test("the write helpers copied from hsdd-seal have not drifted", () => {
  const mine = readFileSync(`${SCRIPTS}/lib/git.mjs`, "utf8");
  const seal = readFileSync(`${repo}skills/hsdd-seal/scripts/seal.mjs`, "utf8");
  const scan = readFileSync(`${repo}skills/hsdd-seal/scripts/lib/scan.mjs`, "utf8");
  const sources = { gitCwdFor: scan, groupByCwd: seal, detachedCwds: seal, hasStaged: seal, commitPaths: seal };
  for (const [name, src] of Object.entries(sources)) {
    assert.equal(definition(mine, name), definition(src, name), `${name} drifted from hsdd-seal`);
  }
});
