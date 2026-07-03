import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProject, DEFAULT_CONVENTIONS } from "../src/model.mjs";
import { makeProject, BASE_PROJECT } from "./helpers.mjs";

test("loads conventions from frontmatter with defaults for missing fields", () => {
  const { root, cleanup } = makeProject({
    "docs/conventions.md": "---\nspecs_dir: specifications\n---\nbody\n",
  });
  try {
    const m = loadProject(root);
    assert.equal(m.conventions.specs_dir, "specifications");
    assert.equal(m.conventions.contracts_dir, DEFAULT_CONVENTIONS.contracts_dir);
    assert.equal(m.conventions.profile, "single-team");
  } finally { cleanup(); }
});

test("loads nodes, phases, contracts, adrs from the base project", () => {
  const { root, cleanup } = makeProject(BASE_PROJECT);
  try {
    const m = loadProject(root);
    assert.equal(m.nodes.length, 3);
    const auth = m.nodes.find((n) => n.id === "acme.backend.auth");
    assert.equal(auth.kind, "leaf-parent");
    assert.equal(auth.phases.length, 2);
    assert.equal(m.contracts.length, 2);
    assert.equal(m.adrs.length, 1);
    assert.equal(m.adrs[0].id, "ADR-001");
    assert.deepEqual(m.phaseErrors, []);
  } finally { cleanup(); }
});

test("classifies v0.3-shape files (no frontmatter) as legacy", () => {
  const { root, cleanup } = makeProject({
    "docs/spec/old.md": "### old: Old Node\n\n**Kind:** leaf-parent\n",
    "contracts/old-contract.md": "# Contract: old\n",
  });
  try {
    const m = loadProject(root);
    assert.equal(m.nodes.length, 0);
    assert.deepEqual(m.legacyNodes, ["docs/spec/old.md"]);
    assert.deepEqual(m.legacyContracts, ["contracts/old-contract.md"]);
  } finally { cleanup(); }
});

test("links openspec changes to phases; Phase: line is authoritative", () => {
  const { root, cleanup } = makeProject({
    ...BASE_PROJECT,
    "openspec/changes/acme-backend-auth-1/proposal.md": "Phase: acme.backend.auth.1\n\nProposal body\n",
    "openspec/changes/archive/acme-backend-auth-9/proposal.md": "Phase: acme.backend.auth.9\n",
    "openspec/changes/free-form-name/proposal.md": "Phase: acme.backend.auth.2\n",
  });
  try {
    const m = loadProject(root);
    const active = m.changes.filter((c) => !c.archived);
    const archived = m.changes.filter((c) => c.archived);
    assert.equal(active.length, 2);
    assert.equal(archived.length, 1);
    assert.equal(active.find((c) => c.name === "free-form-name").phaseId, "acme.backend.auth.2");
    assert.equal(archived[0].phaseId, "acme.backend.auth.9");
  } finally { cleanup(); }
});

test("parses verification docs: gate evidence, sign-off, learnings, metrics", () => {
  const { root, cleanup } = makeProject({
    ...BASE_PROJECT,
    "docs/verify/acme.backend.auth.1.verification.md": `# Verification: acme.backend.auth.1

## Test evidence
- unit: cargo test (42 passed)

## Learnings
- L1: auth-token needs a scopes claim.
  -> disposition: contract-bumped (auth-token@v2)
- L2: latency budget was guessed.

## Metrics
- agent wall-clock: 2h 40m
- review wall-clock: 35m (tier: full-review)

## Human sign-off
- reviewed by: purbo date: 2026-07-03 tier: spot-check
`,
    "docs/verify/acme.backend.auth.2.verification.md": `# Verification: acme.backend.auth.2

## Test evidence

## Learnings
- none

## Human sign-off
- reviewed by ____ date ____
`,
  });
  try {
    const m = loadProject(root);
    const v1 = m.verifications.find((v) => v.phaseId === "acme.backend.auth.1");
    assert.equal(v1.hasGateEvidence, true);
    assert.equal(v1.signedOff, true);
    assert.equal(v1.learnings.length, 2);
    assert.equal(v1.learnings[0].dispositioned, true);
    assert.equal(v1.learnings[1].dispositioned, false);
    assert.match(v1.metrics, /agent wall-clock/);
    const v2 = m.verifications.find((v) => v.phaseId === "acme.backend.auth.2");
    assert.equal(v2.hasGateEvidence, false);
    assert.equal(v2.signedOff, false);
    assert.equal(v2.learnings.length, 1);
    assert.equal(v2.learnings[0].dispositioned, true); // "- none" is a valid entry
  } finally { cleanup(); }
});
