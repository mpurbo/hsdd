import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { replaceNodeId, planRename, applyRename } from "../src/rename.mjs";
import { loadProject } from "../src/model.mjs";
import { makeProject, BASE_PROJECT } from "./helpers.mjs";

test("replaceNodeId rewrites the id and dotted descendants, nothing else", () => {
  const r = (s) => replaceNodeId(s, "acme.backend.auth", "acme.platform.auth");
  assert.equal(r("acme.backend.auth"), "acme.platform.auth");
  assert.equal(r("phase acme.backend.auth.2 done"), "phase acme.platform.auth.2 done");
  assert.equal(r("owner: acme.backend.auth"), "owner: acme.platform.auth");
  // not a longer id's suffix, not a different id sharing a prefix
  assert.equal(r("acme.backend.authx"), "acme.backend.authx");
  assert.equal(r("foo.acme.backend.auth"), "foo.acme.backend.auth");
  assert.equal(r("acme.backend.authentication"), "acme.backend.authentication");
  // multiple occurrences on one line
  assert.equal(
    r("acme.backend.auth and acme.backend.auth.1"),
    "acme.platform.auth and acme.platform.auth.1");
});

test("planRename moves spec and verification files and rewrites references", () => {
  const files = {
    ...BASE_PROJECT,
    "docs/verify/acme.backend.auth.1.verification.md":
      "# Verification: acme.backend.auth.1\n\n## Test evidence\n- ok\n\n## Learnings\n- none\n",
    "openspec/changes/archive/acme-backend-auth-1/proposal.md": "Phase: acme.backend.auth.1\n",
  };
  const { root, cleanup } = makeProject(files);
  try {
    const plan = planRename(loadProject(root), "acme.backend.auth", "acme.platform.auth");
    assert.deepEqual(plan.errors, []);
    const moves = Object.fromEntries(plan.fileMoves.map((m) => [m.from, m.to]));
    assert.equal(moves["docs/spec/acme.backend.auth.md"], "docs/spec/acme.platform.auth.md");
    assert.equal(
      moves["docs/verify/acme.backend.auth.1.verification.md"],
      "docs/verify/acme.platform.auth.1.verification.md");
    // openspec archive is never rewritten
    assert.equal(plan.contentEdits.some((e) => e.file.startsWith("openspec/")), false);
    // contract owner and ADR affects are rewritten
    assert.equal(plan.contentEdits.some((e) => e.file === "contracts/auth-token.md"), true);
    assert.equal(plan.contentEdits.some((e) => e.file === "adr/001-auth-provider.md"), true);
  } finally { cleanup(); }
});

test("applyRename executes the plan and appends the ledger", () => {
  const { root, cleanup } = makeProject({
    ...BASE_PROJECT,
    "docs/verify/acme.backend.auth.1.verification.md": "# Verification: acme.backend.auth.1\n",
  });
  try {
    const plan = planRename(loadProject(root), "acme.backend.auth", "acme.platform.auth");
    applyRename(root, plan, "2026-07-03");
    assert.equal(existsSync(join(root, "docs/spec/acme.platform.auth.md")), true);
    assert.equal(existsSync(join(root, "docs/spec/acme.backend.auth.md")), false);
    const spec = readFileSync(join(root, "docs/spec/acme.platform.auth.md"), "utf8");
    assert.match(spec, /id: acme\.platform\.auth/);
    assert.match(spec, /### acme\.platform\.auth\.1: Types and contracts/);
    const contract = readFileSync(join(root, "contracts/auth-token.md"), "utf8");
    assert.match(contract, /owner: acme\.platform\.auth/);
    const ledger = readFileSync(join(root, "docs/renames.md"), "utf8");
    assert.match(ledger, /acme\.backend\.auth -> acme\.platform\.auth \(2026-07-03\)/);
    // the renamed tree still lints referentially (registry regeneration pending)
    const m = loadProject(root);
    assert.equal(m.nodes.some((n) => n.id === "acme.platform.auth"), true);
  } finally { cleanup(); }
});

test("renaming to an existing node id is an error", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const plan = planRename(loadProject(root), "acme.backend.auth", "acme.web");
    assert.match(plan.errors[0], /already exists/);
  } finally { cleanup(); }
});

test("renaming an unknown node id is an error", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const plan = planRename(loadProject(root), "acme.ghost", "acme.spirit");
    assert.match(plan.errors[0], /no node/i);
  } finally { cleanup(); }
});
