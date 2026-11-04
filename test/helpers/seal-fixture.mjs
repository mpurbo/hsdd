// A synthetic released tree for the hsdd-seal tests: two commits, the second
// being a "catch-up" that added a verification doc and an OpenSpec archive
// after the fact. Returns the temp root and the catch-up commit's sha.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const gitIn = (dir, ...args) => {
  const out = execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  return out.endsWith("\n") ? out.slice(0, -1) : out;
};

export const write = (root, rel, content) => {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};

const header = (id, name, kind, extra = "") => `# ${id}: ${name}

- **Kind:** ${kind}
- **Purpose:** ${name} for the fixture
- **Owns:** its own surface
- **Does not own:** anything else
- **Consumes:** none
- **Produces:** none
- **Sources:** none
${extra}- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fixtures
`;

const phase = (id, name, tier, scope) => `### ${id}: ${name}

- **Consumes:** none
- **Produces:** none
- **Scope:** ${scope}
- **Size estimate:** ~3 files (~100 lines), <= 4 tasks
- **Gate:** npm test
- **Verification:** it works
- **Review tier:** ${tier}
- **Dependencies:** none
`;

const INTAKE = "hsdd/management/2026-08-20-intake-feature-x.md";

export const API_SPEC = `${header("acme.api", "API", "leaf-parent")}
## Phase Plan

**Default gate:** npm test

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| acme.api.1 | Types | gate-only | ~3 files, <=4 tasks | none |
| acme.api.2 | Endpoints | full-review | ~3 files, <=4 tasks | 1 |
| acme.api.3 | Pagination | spot-check | ~3 files, <=4 tasks | 2 |
| acme.api.4 | Export | gate-only | ~3 files, <=4 tasks | 3 |

${phase("acme.api.1", "Types", "gate-only", "the shared types")}
${phase("acme.api.2", "Endpoints", "full-review", "the two endpoints")}
${phase("acme.api.3", "Pagination", "spot-check", `pagination per ${INTAKE}`)}
${phase("acme.api.4", "Export", "gate-only", `the CSV export per ${INTAKE}`)}
## Governance updates (pending reconcile)

- confirm api-token@v1 produced_by acme.api.2
- request api-token@v1: the error envelope for an expired token
`;

export const WEB_SPEC = `${header("acme.web", "Web", "leaf-parent")}
## Phase Plan

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| acme.web.1 | Shell | gate-only | ~3 files, <=4 tasks | none |
| acme.web.2 | Screens | spot-check | ~3 files, <=4 tasks | 1 |
| acme.web.3 | Export button | gate-only | ~3 files, <=4 tasks | 2 |

${phase("acme.web.1", "Shell", "gate-only", "the app shell")}
${phase("acme.web.2", "Screens", "spot-check", "the two screens")}
${phase("acme.web.3", "Export button", "gate-only", `the export button per ${INTAKE}`)}`;

export const LEGACY_SPEC = `${header("acme.legacy", "Legacy", "leaf-parent", "- **Status:** retired\n")}
## Phase Plan

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| acme.legacy.1 | Old thing | gate-only | ~1 file | none |

${phase("acme.legacy.1", "Old thing", "gate-only", "the old thing")}`;

export const ROOT_SPEC = `# acme: Acme

## Overview

The fixture system.

### acme.api: API

- **Kind:** leaf-parent
- **Purpose:** API for the fixture

### acme.web: Web

- **Kind:** leaf-parent
- **Purpose:** Web for the fixture

### acme.legacy: Legacy

- **Kind:** leaf-parent
- **Purpose:** Legacy for the fixture
- **Status:** retired
`;

export const CONVENTIONS = `# Project Conventions

## Layout (default)
- \`hsdd/spec/{node-id}.md\` node specs

## Main line
**Main line:** main

## Phase design
**Ordering policy:** interfaces-first

- One Phase Equivalent (PE) per phase
- Review tiers: gate-only | spot-check | full-review

## Teams
**Teams:** single-team
`;

const doc = (id, name, signoff, { observed = "2026-09-10: ran npm test, 12 passed.", outstanding = "- none", learnings = "- none" } = {}) => `# Verification: ${id} — ${name}

## Commands to run
npm test

## Expected output
12 passed

## Observed
${observed}

## Outstanding
${outstanding}

## Learnings
${learnings}

## Sign-off
- Reviewer / date: ${signoff}
- Review tier applied: gate-only
- Disposition of each Outstanding item: none
- Disposition of each Learning: none
`;

export const PROGRESS = `# acme · Progress Report (2026-10-20)

**Date:** 2026-10-20 · **Supersedes:** none

## Bottom line

| | |
|---|---:|
| **Phases planned** | **8** |

## What is done

### acme.api

| Phase | Tier | Verification doc (on main) | Sign-off |
|---|---|---|---|
| \`acme.api.1\` · Types | gate-only | \`hsdd/verify/acme.api.1.verification.md\` | Dewi |
| \`acme.api.2\` · Endpoints | full-review | \`hsdd/verify/acme.api.2.verification.md\` | Claude for Dewi |

### acme.web

| Phase | Tier | Verification doc (on main) | Sign-off |
|---|---|---|---|
| \`acme.web.1\` · Shell | gate-only | claimed, no doc | none |

## In progress

- \`acme.api.3\`, \`acme.web.2\`, \`acme.web.3\`

## Change log
- 2026-10-20: created
`;

export const INTAKE_RECORD = `# Intake: Feature X

- **Date:** 2026-08-20
- **Request:** docs/feature-x.md (approved PRD)
- **Class:** local
- **Lands on:** [acme.api] · **Contracts:** none
- **Promotes:** none
- **Collisions:** none
- **Status:** open

## Request
Feature X.

## Routing
local. Handoff: "/hsdd-phase-plan acme.api per ${INTAKE}".

## Produced
- phases appended: \`acme.api.3\`, \`acme.api.4\`

## Change log
- 2026-08-20: created, routed local
`;

export const MILESTONES = `# acme · Milestones (2026-09-01)

**Date:** 2026-09-01 · **Audience:** stakeholders
**Campaign:** release train 2.4
**Basis:** no progress report yet

## How to read this

Each milestone is a demo and a gate.

## Milestones

### M1: Types and endpoints
Demo: call the API.
- [ ] acme.api.1 and acme.api.2 done

### M2: Pagination and export
Demo: page and export.
- [ ] acme.api.3 and acme.api.4 done

### M3: Web
Demo: click through.
- [ ] acme.web.1, acme.web.2 and acme.web.3 done

### M4: Later
- [ ] acme.api.10 done

## Contingent tail

none

## Tracking

The checkpoint ticks the gates.

## Change log
- 2026-09-01: generated
`;

export const RELEASE_AT = "2026-09-15T10:00:00+07:00";
export const CATCHUP_AT = "2026-10-25T10:00:00+07:00";

export const commitAt = (dir, when, message) =>
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });

export function initRepo(dir) {
  gitIn(dir, "init", "-q", "-b", "main");
  const noHooks = join(dir, ".git", "no-hooks");
  mkdirSync(noHooks, { recursive: true });
  gitIn(dir, "config", "core.hooksPath", noHooks);
  gitIn(dir, "config", "user.name", "Test Owner");
  gitIn(dir, "config", "user.email", "owner@example.invalid");
  gitIn(dir, "config", "commit.gpgsign", "false");
  gitIn(dir, "config", "protocol.file.allow", "always");
}

export function sealTree({ nested = false } = {}) {
  const gitRoot = mkdtempSync(join(tmpdir(), "hsdd-seal-"));
  initRepo(gitRoot);
  const root = nested ? join(gitRoot, "svc") : gitRoot;
  if (nested) mkdirSync(root);

  write(root, "hsdd/conventions.md", CONVENTIONS);
  write(root, "hsdd/spec/acme.md", ROOT_SPEC);
  write(root, "hsdd/spec/acme.api.md", API_SPEC);
  write(root, "hsdd/spec/acme.web.md", WEB_SPEC);
  write(root, "hsdd/spec/acme.legacy.md", LEGACY_SPEC);
  write(root, "hsdd/verify/acme.api.1.verification.md", doc("acme.api.1", "Types", "Dewi, 2026-09-10"));
  write(root, "hsdd/verify/acme.api.2.verification.md", doc("acme.api.2", "Endpoints", "Claude for Dewi (delegated), 2026-10-01"));
  write(root, "hsdd/verify/acme.api.3.verification.md", doc("acme.api.3", "Pagination", "{person} | {agent} for {person} (delegated)", { observed: "2026-09-20: ran npm test, 14 passed.", outstanding: "- the export of page 2 was not checked", learnings: "" }));
  write(root, "hsdd/management/2026-10-20-progress.md", PROGRESS);
  write(root, INTAKE, INTAKE_RECORD);
  write(root, "hsdd/management/2026-09-01-milestones.md", MILESTONES);
  write(root, "hsdd-context/acme.web.2.md", "# Current Phase: acme.web.2 - Screens\n");
  write(root, "openspec/changes/archive/2026-08-01-acme-api-1/proposal.md", "# acme.api.1\n");
  write(root, "openspec/changes/archive/2026-09-01-acme-web-30-thing/proposal.md", "# not acme.web.3\n");
  write(root, "openspec/specs/api/spec.md", "# API capability\n");
  gitIn(gitRoot, "add", "-A");
  commitAt(gitRoot, RELEASE_AT, "release 2.4.0");

  write(root, "hsdd/verify/acme.web.2.verification.md", CATCHUP_DOC);
  write(root, "openspec/changes/archive/2026-10-25-acme-api-3/proposal.md", "# acme.api.3\n");
  write(root, "openspec/changes/archive/2026-10-25-acme-api-3/tasks.md", "- [x] done\n");
  gitIn(gitRoot, "add", "-A");
  commitAt(gitRoot, CATCHUP_AT, "catch-up");
  return { root, gitRoot, catchup: gitIn(gitRoot, "rev-parse", "HEAD") };
}

export const CATCHUP_DOC = doc("acme.web.2", "Screens", "", { observed: "2026-10-25: the screens render and the tests pass (reconstructed)." });

// The standalone-spec-repo profile: the HSDD tree is its own repository,
// mounted as a submodule at hsdd/ in an implementation repository. The
// catch-up added a doc inside the submodule and an OpenSpec archive outside.
export function profileTree() {
  const spec = mkdtempSync(join(tmpdir(), "hsdd-seal-spec-"));
  initRepo(spec);
  write(spec, "conventions.md", CONVENTIONS.replace("## Main line", "Profile: standalone-spec-repo\n\n## Main line"));
  write(spec, "spec/acme.md", ROOT_SPEC);
  write(spec, "spec/acme.api.md", API_SPEC);
  write(spec, "spec/acme.web.md", WEB_SPEC);
  write(spec, "spec/acme.legacy.md", LEGACY_SPEC);
  write(spec, "verify/acme.api.1.verification.md", doc("acme.api.1", "Types", "Dewi, 2026-09-10"));
  write(spec, "verify/acme.api.2.verification.md", doc("acme.api.2", "Endpoints", "Claude for Dewi (delegated), 2026-10-01"));
  write(spec, "verify/acme.api.3.verification.md", doc("acme.api.3", "Pagination", "{person} | {agent} for {person} (delegated)", { observed: "2026-09-20: ran npm test, 14 passed.", outstanding: "- the export of page 2 was not checked", learnings: "" }));
  write(spec, "management/2026-10-20-progress.md", PROGRESS);
  write(spec, "management/2026-08-20-intake-feature-x.md", INTAKE_RECORD);
  write(spec, "management/2026-09-01-milestones.md", MILESTONES);
  gitIn(spec, "add", "-A");
  commitAt(spec, RELEASE_AT, "spec at release 2.4.0");

  const root = mkdtempSync(join(tmpdir(), "hsdd-seal-impl-"));
  initRepo(root);
  write(root, "hsdd-context/acme.web.2.md", "# Current Phase: acme.web.2 - Screens\n");
  write(root, "openspec/changes/archive/2026-08-01-acme-api-1/proposal.md", "# acme.api.1\n");
  write(root, "openspec/specs/api/spec.md", "# API capability\n");
  gitIn(root, "-c", "protocol.file.allow=always", "submodule", "add", "-q", spec, "hsdd");
  gitIn(root, "add", "-A");
  commitAt(root, RELEASE_AT, "impl at release 2.4.0");
  gitIn(join(root, "hsdd"), "config", "user.name", "Test Owner");
  gitIn(join(root, "hsdd"), "config", "user.email", "owner@example.invalid");
  gitIn(join(root, "hsdd"), "config", "commit.gpgsign", "false");
  gitIn(join(root, "hsdd"), "config", "core.hooksPath", join(spec, ".git", "no-hooks"));

  write(root, "hsdd/verify/acme.web.2.verification.md", CATCHUP_DOC);
  gitIn(join(root, "hsdd"), "add", "-A");
  commitAt(join(root, "hsdd"), CATCHUP_AT, "catch-up (spec)");
  write(root, "openspec/changes/archive/2026-10-25-acme-api-3/proposal.md", "# acme.api.3\n");
  gitIn(root, "add", "-A");
  commitAt(root, CATCHUP_AT, "catch-up (impl)");
  return { root, spec, catchup: "since:2026-10-01" };
}

export const INPUTS = { release: "2.4.0", date: "2026-09-15", owner: "Dewi", evidence: "QA run 77", catchup: null, today: "2026-11-03", keep: [] };
