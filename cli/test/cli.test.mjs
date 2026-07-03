// End-to-end: spawn the real bin against a fixture project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeProject, BASE_PROJECT } from "./helpers.mjs";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "hsdd.mjs");

function run(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args, "--root", root], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || "", stderr: e.stderr || "" };
  }
}

test("registry writes both INDEX files", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const r = run(root, ["registry"]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(readFileSync(join(root, "contracts/INDEX.md"), "utf8"), /auth-token/);
    assert.match(readFileSync(join(root, "adr/INDEX.md"), "utf8"), /ADR-001/);
  } finally { cleanup(); }
});

test("context --write splices config.yaml; second run is idempotent", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const r1 = run(root, ["context", "acme.backend.auth.1", "--write"]);
    assert.equal(r1.code, 0, r1.stderr);
    const config = readFileSync(join(root, "openspec/config.yaml"), "utf8");
    assert.match(config, /## Current Phase: acme\.backend\.auth\.1/);
    assert.match(config, /rules:/);
    const r2 = run(root, ["context", "acme.backend.auth.2", "--write"]);
    assert.equal(r2.code, 0, r2.stderr);
    const config2 = readFileSync(join(root, "openspec/config.yaml"), "utf8");
    assert.match(config2, /## Current Phase: acme\.backend\.auth\.2/);
    assert.doesNotMatch(config2, /## Current Phase: acme\.backend\.auth\.1/);
  } finally { cleanup(); }
});

test("context on a missing phase exits 1 with a grammar-naming error", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const r = run(root, ["context", "acme.backend.auth.7"]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /acme\.backend\.auth\.7/);
  } finally { cleanup(); }
});

test("lint exit codes: 0 clean, 2 warnings-only, 1 errors", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    run(root, ["registry"]);
    assert.equal(run(root, ["lint"]).code, 0);
    // introduce a warnings-only condition: draft contract consumed by a phase
    writeFileSync(join(root, "contracts/user-model.md"),
      readFileSync(join(root, "contracts/user-model.md"), "utf8").replace("status: stable", "status: draft"));
    run(root, ["registry"]);
    assert.equal(run(root, ["lint"]).code, 2);
    // and an error: break a consumed reference
    writeFileSync(join(root, "docs/spec/acme.web.md"),
      readFileSync(join(root, "docs/spec/acme.web.md"), "utf8").replace("auth-token@v1", "ghost@v9"));
    run(root, ["registry"]);
    assert.equal(run(root, ["lint"]).code, 1);
  } finally { cleanup(); }
});

test("status prints the table and writes STATUS.md", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const r = run(root, ["status", "--write"]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /acme\.backend\.auth\.1\s+planned/);
    assert.match(readFileSync(join(root, "docs/STATUS.md"), "utf8"), /Project Status/);
  } finally { cleanup(); }
});

test("check-scope enforces Touches inside a git repo", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const g = (cmd) => execFileSync("git", cmd.split(" "), { cwd: root, encoding: "utf8" });
    g("init -q -b main");
    g("config user.email hsdd@test.local");
    g("config user.name hsdd");
    g("add -A");
    execFileSync("git", ["commit", "-qm", "base"], { cwd: root });
    // in-scope change
    mkdirSync(join(root, "src/auth"), { recursive: true });
    writeFileSync(join(root, "src/auth/mod.rs"), "// ok\n");
    let r = run(root, ["check-scope", "acme.backend.auth.1"]);
    assert.equal(r.code, 0, r.stderr);
    // out-of-scope change
    mkdirSync(join(root, "src/billing"), { recursive: true });
    writeFileSync(join(root, "src/billing/mod.rs"), "// nope\n");
    r = run(root, ["check-scope", "acme.backend.auth.1"]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /src\/billing\/mod\.rs/);
    // phase without Touches: note + exit 0
    r = run(root, ["check-scope", "acme.backend.auth.2"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /no Touches/);
  } finally { cleanup(); }
});

test("rename moves files, rewrites ids, updates ledger, reruns registry+lint", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    run(root, ["registry"]);
    const r = run(root, ["rename", "acme.backend.auth", "acme.platform.auth"]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.equal(existsSync(join(root, "docs/spec/acme.platform.auth.md")), true);
    assert.match(readFileSync(join(root, "docs/renames.md"), "utf8"), /acme\.backend\.auth -> acme\.platform\.auth/);
    assert.match(readFileSync(join(root, "contracts/INDEX.md"), "utf8"), /acme\.platform\.auth/);
  } finally { cleanup(); }
});

test("--help and unknown commands behave", () => {
  const { root, cleanup } = makeProject({});
  try {
    assert.match(run(root, ["--help"]).stdout, /Usage: hsdd/);
    const r = run(root, ["frobnicate"]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /unknown command/);
  } finally { cleanup(); }
});
