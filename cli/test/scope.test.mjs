import { test } from "node:test";
import assert from "node:assert/strict";
import { globToRegExp, partitionScope } from "../src/scope.mjs";

const match = (glob, path) => globToRegExp(glob).test(path);

test("glob semantics: **, *, ?, and literals", () => {
  assert.equal(match("src/auth/**", "src/auth/mod.rs"), true);
  assert.equal(match("src/auth/**", "src/auth/deep/nested.rs"), true);
  assert.equal(match("src/auth/**", "src/billing/mod.rs"), false);
  assert.equal(match("src/auth/**", "src/auth"), false);
  assert.equal(match("src/*.rs", "src/main.rs"), true);
  assert.equal(match("src/*.rs", "src/auth/mod.rs"), false);
  assert.equal(match("**/*.test.mjs", "cli/test/scope.test.mjs"), true);
  assert.equal(match("**/*.test.mjs", "scope.test.mjs"), true);
  assert.equal(match("docs/?.md", "docs/a.md"), true);
  assert.equal(match("docs/?.md", "docs/ab.md"), false);
  assert.equal(match("Cargo.toml", "Cargo.toml"), true);
  assert.equal(match("Cargo.toml", "sub/Cargo.toml"), false);
  // regex metacharacters in paths are literal
  assert.equal(match("a+b/*.md", "a+b/x.md"), true);
});

test("partitionScope splits changed files by the Touches allowlist", () => {
  const { inScope, outOfScope } = partitionScope(
    ["src/auth/**", "tests/auth/**"],
    ["src/auth/mod.rs", "tests/auth/it.rs", "src/billing/mod.rs"]
  );
  assert.deepEqual(inScope, ["src/auth/mod.rs", "tests/auth/it.rs"]);
  assert.deepEqual(outOfScope, ["src/billing/mod.rs"]);
});
