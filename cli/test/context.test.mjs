import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProject } from "../src/model.mjs";
import { buildPhaseContext, spliceConfig } from "../src/context.mjs";
import { makeProject, BASE_PROJECT } from "./helpers.mjs";

function withBase(extra, mutate) {
  const files = { ...BASE_PROJECT, ...extra };
  if (mutate) mutate(files);
  return makeProject(files);
}

test("assembles phase, contract interfaces, and accepted ADR decisions", () => {
  const { root, cleanup } = withBase({});
  try {
    const r = buildPhaseContext(loadProject(root), "acme.backend.auth.1");
    assert.equal(r.ok, true);
    assert.match(r.artifact, /## Current Phase: acme\.backend\.auth\.1: Types and contracts/);
    assert.match(r.artifact, /\*\*Gate:\*\* cargo test && npm run contract:verify auth-token/);
    assert.match(r.artifact, /## Contracts from Prior Phases \/ Nodes/);
    assert.match(r.artifact, /### user-model@v1/);
    assert.match(r.artifact, /id is immutable/);
    assert.match(r.artifact, /## Governing Decisions/);
    assert.match(r.artifact, /### ADR-001/);
    assert.match(r.artifact, /rotating asymmetric keys/);
    assert.match(r.artifact, /JWKS endpoint/);
    // never the deliberation
    assert.doesNotMatch(r.artifact, /Login must work across mobile/);
    assert.deepEqual(r.errors, []);
  } finally { cleanup(); }
});

test("includes ADRs referenced by consumed contracts, not just the phase", () => {
  const { root, cleanup } = withBase({});
  try {
    // phase 2 has no Governed by, but consumes auth-token which is governed by ADR-001
    const r = buildPhaseContext(loadProject(root), "acme.backend.auth.2");
    assert.equal(r.ok, true);
    assert.match(r.artifact, /### ADR-001/);
  } finally { cleanup(); }
});

test("unknown phase id is a hard error naming the grammar", () => {
  const { root, cleanup } = withBase({});
  try {
    const r = buildPhaseContext(loadProject(root), "acme.backend.auth.9");
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /acme\.backend\.auth\.9/);
  } finally { cleanup(); }
});

test("missing contract file names hsdd-contract as the fix owner", () => {
  const { root, cleanup } = withBase({}, (files) => {
    delete files["contracts/user-model.md"];
  });
  try {
    const r = buildPhaseContext(loadProject(root), "acme.backend.auth.1");
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /user-model/);
    assert.match(r.errors[0], /hsdd-contract/);
  } finally { cleanup(); }
});

test("missing ADR names hsdd-adr; proposed ADR is excluded with a warning", () => {
  const missing = withBase({}, (files) => { delete files["adr/001-auth-provider.md"]; });
  try {
    const r = buildPhaseContext(loadProject(missing.root), "acme.backend.auth.1");
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /ADR-001/);
    assert.match(r.errors[0], /hsdd-adr/);
  } finally { missing.cleanup(); }

  const proposed = withBase({}, (files) => {
    files["adr/001-auth-provider.md"] = files["adr/001-auth-provider.md"].replace("status: accepted", "status: proposed");
  });
  try {
    const r = buildPhaseContext(loadProject(proposed.root), "acme.backend.auth.1");
    assert.equal(r.ok, true);
    assert.doesNotMatch(r.artifact, /rotating asymmetric keys/);
    assert.match(r.warnings[0], /ADR-001/);
    assert.match(r.warnings[0], /proposed/);
  } finally { proposed.cleanup(); }
});

test("consuming a draft contract is a warning, not an error", () => {
  const { root, cleanup } = withBase({}, (files) => {
    files["contracts/user-model.md"] = files["contracts/user-model.md"].replace("status: stable", "status: draft");
  });
  try {
    const r = buildPhaseContext(loadProject(root), "acme.backend.auth.1");
    assert.equal(r.ok, true);
    assert.match(r.warnings[0], /user-model/);
    assert.match(r.warnings[0], /draft/);
  } finally { cleanup(); }
});

test("spliceConfig replaces only the marked region, preserving indentation", () => {
  const config = BASE_PROJECT["openspec/config.yaml"];
  const r = spliceConfig(config, "## Current Phase: x\n\nline");
  assert.equal(r.ok, true);
  assert.match(r.text, /  <!-- hsdd:phase-context:begin -->\n  ## Current Phase: x\n\n  line\n  <!-- hsdd:phase-context:end -->/);
  assert.match(r.text, /## Project: acme/);       // untouched above
  assert.match(r.text, /rules:/);                  // untouched below
  // idempotent: splicing again replaces, not appends
  const r2 = spliceConfig(r.text, "REPLACED");
  assert.doesNotMatch(r2.text, /Current Phase: x/);
  assert.match(r2.text, /REPLACED/);
});

test("spliceConfig errors when markers are missing, naming hsdd-config", () => {
  const r = spliceConfig("context: |\n  no markers here\n", "x");
  assert.equal(r.ok, false);
  assert.match(r.error, /hsdd:phase-context/);
  assert.match(r.error, /hsdd-config/);
});
