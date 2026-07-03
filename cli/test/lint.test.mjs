import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { loadProject } from "../src/model.mjs";
import { lint } from "../src/lint.mjs";
import { projectContracts, projectAdrs } from "../src/registry.mjs";
import { makeProject, BASE_PROJECT } from "./helpers.mjs";

// helper: run lint over BASE_PROJECT mutated by `mutate`, with INDEXes regenerated first
function runLint(mutate, opts = {}) {
  const files = { ...BASE_PROJECT };
  if (mutate) mutate(files);
  const { root, cleanup } = makeProject(files);
  try {
    // write fresh INDEXes unless the test wants them stale
    if (!opts.staleIndex) {
      const m0 = loadProject(root);
      const c = projectContracts(m0);
      const a = projectAdrs(m0);
      if (c) writeFileSync(`${root}/contracts/INDEX.md`, c);
      if (a) writeFileSync(`${root}/adr/INDEX.md`, a);
    }
    return lint(loadProject(root), { strict: opts.strict || false, profile: opts.profile || null });
  } finally { cleanup(); }
}

const msgs = (list) => list.map((f) => f.msg).join("\n");

test("clean base project lints clean", () => {
  const r = runLint(null);
  assert.deepEqual(r.errors, [], msgs(r.errors));
  assert.deepEqual(r.warnings, [], msgs(r.warnings));
});

test("check 1: unresolvable consumes and version mismatch are errors", () => {
  const r = runLint((f) => {
    f["docs/spec/acme.web.md"] = f["docs/spec/acme.web.md"].replace(
      "consumes: [auth-token@v1]", "consumes: [ghost@v1, auth-token@v2]");
  });
  assert.match(msgs(r.errors), /ghost/);
  assert.match(msgs(r.errors), /auth-token@v2/);
});

test("check 2: owner mismatch and duplicate producers are errors", () => {
  const r = runLint((f) => {
    f["contracts/user-model.md"] = f["contracts/user-model.md"].replace(
      "owner: acme.backend.users", "owner: acme.nonexistent");
  });
  assert.match(msgs(r.errors), /acme\.nonexistent/);

  const dup = runLint((f) => {
    f["docs/spec/acme.web.md"] = f["docs/spec/acme.web.md"].replace(
      "produces: []", "produces: [auth-token@v1]");
  });
  assert.match(msgs(dup.errors), /auth-token.*produced by/i);
});

test("check 3: governed_by referencing a missing ADR is an error", () => {
  const r = runLint((f) => {
    f["contracts/auth-token.md"] = f["contracts/auth-token.md"].replace(
      "governed_by: [ADR-001]", "governed_by: [ADR-002]");
  });
  assert.match(msgs(r.errors), /ADR-002/);
});

test("check 4: affects/governed_by must match bidirectionally; forward refs warn", () => {
  const r = runLint((f) => {
    // node drops its governed_by while ADR still lists it in affects
    f["docs/spec/acme.backend.auth.md"] = f["docs/spec/acme.backend.auth.md"].replace(
      "governed_by: [ADR-001]\n", "");
  });
  assert.match(msgs(r.errors), /acme\.backend\.auth.*Governed by|Governed by.*acme\.backend\.auth/i);

  const fwd = runLint((f) => {
    f["adr/001-auth-provider.md"] = f["adr/001-auth-provider.md"].replace(
      "affects: [acme.backend.auth, auth-token@v1]",
      "affects: [acme.backend.auth, auth-token@v1, future.node]");
  });
  assert.match(msgs(fwd.warnings), /future\.node/);
  assert.doesNotMatch(msgs(fwd.errors), /future\.node/);
});

test("check 5: duplicate, non-zero-padded, or filename-mismatched ADR ids are errors", () => {
  const r = runLint((f) => {
    f["adr/002-cache.md"] = `---\nid: ADR-1\nstatus: accepted\naffects: []\ndate: 2026-07-03\n---\n\n# ADR-1: Cache\n\n## Decision\nx\n\n## Consequences\n- y\n`;
  });
  assert.match(msgs(r.errors), /ADR-1/);
});

test("check 6: stable contract without schema/fixtures (or with dead paths) errors", () => {
  const none = runLint((f) => {
    f["contracts/user-model.md"] = f["contracts/user-model.md"].replace(
      "schema: schemas/user-model.schema.json\n", "");
  });
  assert.match(msgs(none.errors), /user-model.*(schema|fixtures)/);

  const dead = runLint((f) => {
    delete f["schemas/user-model.schema.json"];
  });
  assert.match(msgs(dead.errors), /schemas\/user-model\.schema\.json/);
});

test("check 7: phase consuming a draft contract warns", () => {
  const r = runLint((f) => {
    f["contracts/user-model.md"] = f["contracts/user-model.md"].replace("status: stable", "status: draft");
  });
  assert.match(msgs(r.warnings), /draft/);
});

test("check 8: unparseable phase blocks and non-sequential numbering error", () => {
  const r = runLint((f) => {
    f["docs/spec/acme.backend.auth.md"] = f["docs/spec/acme.backend.auth.md"]
      .replace("### acme.backend.auth.2:", "### acme.backend.auth.5:");
  });
  assert.match(msgs(r.errors), /sequential/);
});

test("check 9: active change with a Phase: line must reference an existing phase", () => {
  const r = runLint((f) => {
    f["openspec/changes/x/proposal.md"] = "Phase: acme.backend.auth.99\n";
  });
  assert.match(msgs(r.errors), /acme\.backend\.auth\.99/);
});

test("check 10: verification doc for a phase with no change errors; unarchived warns", () => {
  const orphan = runLint((f) => {
    f["docs/verify/acme.backend.auth.1.verification.md"] =
      "# V\n\n## Test evidence\n- ok\n\n## Learnings\n- none\n";
  });
  assert.match(msgs(orphan.errors), /never started|no OpenSpec change/i);

  const inProgress = runLint((f) => {
    f["docs/verify/acme.backend.auth.1.verification.md"] =
      "# V\n\n## Test evidence\n- ok\n\n## Learnings\n- none\n";
    f["openspec/changes/acme-backend-auth-1/proposal.md"] = "Phase: acme.backend.auth.1\n";
  });
  assert.doesNotMatch(msgs(inProgress.errors), /acme\.backend\.auth\.1/);
  assert.match(msgs(inProgress.warnings), /not.*archived|never archived/i);
});

test("check 11: stale INDEX.md is an error", () => {
  const r = runLint(null, { staleIndex: true });
  assert.match(msgs(r.errors), /INDEX\.md/);
});

test("check 12: v0.3-shape artifacts warn; --strict makes them errors", () => {
  const warn = runLint((f) => {
    f["docs/spec/legacy.md"] = "### legacy: Old\n\n**Kind:** internal\n";
    f["contracts/auth-token.md"] = f["contracts/auth-token.md"].replace(
      "owner: acme.backend.auth", "owner: acme.backend.auth\nproduced_by: [acme.backend.auth.1]");
  });
  assert.match(msgs(warn.warnings), /legacy\.md/);
  assert.match(msgs(warn.warnings), /produced_by/);

  const strict = runLint((f) => {
    f["docs/spec/legacy.md"] = "### legacy: Old\n\n**Kind:** internal\n";
  }, { strict: true });
  assert.match(msgs(strict.errors), /legacy\.md/);
});

test("check 13: undispositioned learnings in verified phases warn; --strict errors", () => {
  const mutate = (f) => {
    f["docs/verify/acme.backend.auth.1.verification.md"] =
      "# V\n\n## Test evidence\n- ok\n\n## Learnings\n- L1: gap found\n";
    f["openspec/changes/archive/acme-backend-auth-1/proposal.md"] = "Phase: acme.backend.auth.1\n";
  };
  const warn = runLint(mutate);
  assert.match(msgs(warn.warnings), /undispositioned/i);
  const strict = runLint(mutate, { strict: true });
  assert.match(msgs(strict.errors), /undispositioned/i);
});

test("multi-team: team required, cross-team acks and ADR approvals enforced", () => {
  const r = runLint(null, { profile: "multi-team" });
  // BASE_PROJECT nodes carry no team field
  assert.match(msgs(r.errors), /team/);

  const teams = runLint((f) => {
    f["docs/spec/acme.backend.auth.md"] = f["docs/spec/acme.backend.auth.md"].replace(
      "kind: leaf-parent", "kind: leaf-parent\nteam: identity");
    f["docs/spec/acme.backend.users.md"] = f["docs/spec/acme.backend.users.md"].replace(
      "kind: leaf-parent", "kind: leaf-parent\nteam: identity");
    f["docs/spec/acme.web.md"] = f["docs/spec/acme.web.md"].replace(
      "kind: internal", "kind: internal\nteam: web-team");
  }, { profile: "multi-team" });
  // auth-token is stable and consumed by web-team without an Acked-by line
  assert.match(msgs(teams.errors), /web-team/);
  // ADR-001 affects auth (identity) and auth-token (consumed cross-team) but has no Approvals
  assert.match(msgs(teams.errors), /ADR-001.*Approvals|Approvals.*ADR-001/);

  const acked = runLint((f) => {
    f["docs/spec/acme.backend.auth.md"] = f["docs/spec/acme.backend.auth.md"].replace(
      "kind: leaf-parent", "kind: leaf-parent\nteam: identity");
    f["docs/spec/acme.backend.users.md"] = f["docs/spec/acme.backend.users.md"].replace(
      "kind: leaf-parent", "kind: leaf-parent\nteam: identity");
    f["docs/spec/acme.web.md"] = f["docs/spec/acme.web.md"].replace(
      "kind: internal", "kind: internal\nteam: web-team");
    f["contracts/auth-token.md"] = f["contracts/auth-token.md"].replace(
      "## Versioning\n- v1 current.",
      "## Versioning\n- v1 current.\n- Acked-by: web-team (2026-07-03)");
    f["adr/001-auth-provider.md"] = f["adr/001-auth-provider.md"] +
      "\n## Approvals\n- identity (2026-07-03)\n- web-team (2026-07-03)\n";
  }, { profile: "multi-team" });
  assert.deepEqual(acked.errors, [], msgs(acked.errors));
});
