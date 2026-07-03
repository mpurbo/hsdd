import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSection } from "../src/sections.mjs";
import { parsePhaseBlocks } from "../src/phase-block.mjs";

const VALID = `
## Overview

Some prose.

## Phase Plan

### acme.backend.auth.1: Types and contracts

**Consumes:** [user-model@v1]
**Produces:** [auth-token@v1]
**Governed by:** [ADR-001]
**Scope:** domain types and the auth-token contract skeleton
**Size estimate:** ~6 files, ~250 lines, <= 8 OpenSpec tasks
**Gate:** cargo build && cargo test
**Verification:** inspect generated types; run the fixture round-trip
**Review tier:** spot-check
**Touches:** [src/auth/**, tests/auth/**]
**Dependencies:** none

### acme.backend.auth.2: Token issuance

**Consumes:** [auth-token@v1]
**Produces:** []
**Scope:** issue JWTs on login,
  including error paths
**Size estimate:** ~4 files, ~300 lines, <= 8 OpenSpec tasks
**Gate:** cargo test && npm run contract:verify auth-token
**Verification:** manual login flow against staging keys
**Review tier:** full-review
**Dependencies:** phase 1 (auth-token@v1 only)
`;

test("extractSection returns section content up to the next ## heading", () => {
  const md = "## Interface\nline a\nline b\n\n## Guarantees / invariants\n- g1\n";
  assert.equal(extractSection(md, "Interface").trim(), "line a\nline b");
  assert.equal(extractSection(md, "Guarantees / invariants").trim(), "- g1");
  assert.equal(extractSection(md, "Missing"), null);
});

test("parses valid phase blocks with optional fields and continuations", () => {
  const { phases, errors } = parsePhaseBlocks("acme.backend.auth", VALID);
  assert.deepEqual(errors, []);
  assert.equal(phases.length, 2);
  const [p1, p2] = phases;
  assert.equal(p1.id, "acme.backend.auth.1");
  assert.equal(p1.n, 1);
  assert.equal(p1.name, "Types and contracts");
  assert.deepEqual(p1.consumes, ["user-model@v1"]);
  assert.deepEqual(p1.produces, ["auth-token@v1"]);
  assert.deepEqual(p1.governed_by, ["ADR-001"]);
  assert.deepEqual(p1.touches, ["src/auth/**", "tests/auth/**"]);
  assert.equal(p1.review_tier, "spot-check");
  assert.equal(p2.governed_by.length, 0);
  assert.equal(p2.touches.length, 0);
  assert.match(p2.scope, /including error paths/);
  assert.deepEqual(p2.produces, []);
});

test("missing required field is an error naming phase and field", () => {
  const bad = `### n.1: A\n\n**Consumes:** []\n**Produces:** []\n**Scope:** x\n**Size estimate:** ~1 file\n**Gate:** true\n**Review tier:** gate-only\n**Dependencies:** none\n`;
  const { errors } = parsePhaseBlocks("n", bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /n\.1/);
  assert.match(errors[0], /Verification/);
});

test("unknown review tier is an error", () => {
  const bad = `### n.1: A\n\n**Consumes:** []\n**Produces:** []\n**Scope:** x\n**Size estimate:** ~1 file\n**Gate:** true\n**Verification:** look\n**Review tier:** casual-glance\n**Dependencies:** none\n`;
  const { errors } = parsePhaseBlocks("n", bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Review tier/);
});

test("ignores headings that are not phases of this node", () => {
  const md = `### other.node.1: X\n\n**Consumes:** []\n`;
  const { phases, errors } = parsePhaseBlocks("n", md);
  assert.equal(phases.length, 0);
  assert.deepEqual(errors, []);
});
