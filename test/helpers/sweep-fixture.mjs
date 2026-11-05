// A synthetic project for the hsdd-intake sweep tests: a spec tree at `base`
// and one commit per case the sweep has to attribute, each keyed in `shas`.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitIn, write, initRepo } from "./seal-fixture.mjs";
import { parseRecord, renderRecord } from "../../skills/hsdd-intake/scripts/lib/record.mjs";

const spec = (id, name, kind, fields, body) => `# ${id}: ${name}

- **Kind:** ${kind}
- **Purpose:** ${name} for the fixture
- **Owns:** its own surface
- **Does not own:** anything else
- **Consumes:** none
- **Produces:** none
- **Sources:** none
${fields}- **Isolation strategy:** fixtures
${body}`;

const phase = (id, name, verification) => `### ${id}: ${name}

- **Consumes:** none
- **Produces:** none
- **Scope:** ${name}
- **Size estimate:** ~3 files (~100 lines), <= 4 tasks
- **Gate:** npm test
- **Verification:** ${verification}
- **Review tier:** gate-only
- **Dependencies:** none
`;

const surface = (modules) => `
## Observed surface

- modules: ${modules}
`;

const ROOT = `# acme: Acme

## Overview

The fixture system.
`;

const WEB = spec("acme.web", "Web", "leaf-parent", "- **Adopted:** promoted\n", `- **Decomposes into:** phases (see hsdd-phase-plan)

## Phase Plan

**Default gate:** npm test

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| acme.web.1 | Shell | gate-only | ~3 files, <=4 tasks | none |
| acme.web.2 | Preview | gate-only | ~3 files, <=4 tasks | 1 |

${phase("acme.web.1", "Shell", "it works")}
${phase("acme.web.2", "Preview", "the preview shows the fee line")}${surface("src/web/")}`);

const REPORTS = spec("acme.reports", "Reports", "leaf-parent", "- **Adopted:** as-built\n", surface("src/reports/"));
const LEGACY = spec("acme.legacy", "Legacy", "leaf-parent", "- **Status:** retired\n", surface("src/legacy/"));

const write_ = (root, files) => Object.entries(files).forEach(([p, c]) => write(root, p, c));

const BASE_CODE = {
  "src/web/routes.js": 'app.get("/payouts", list);\nconst title = "Payouts";\n',
  "src/web/old.js": 'app.delete("/payouts/old", h);\n',
  "src/web/app.js": "// web app\n",
  "src/web/events.js": "// events\n",
  "src/reports/monthly.js": "// monthly\n",
  "src/legacy/old.js": "// legacy\n",
  "tools/report.js": "// report\n",
  "api/openapi.yaml": "openapi: 3.0.0\npaths: {}\n",
};
const BASE_SPEC = {
  "hsdd/conventions.md": "# Project Conventions\n\n## Main line\n**Main line:** main\n",
  "hsdd/spec/acme.md": ROOT,
  "hsdd/spec/acme.web.md": WEB,
  "hsdd/spec/acme.reports.md": REPORTS,
  "hsdd/spec/acme.legacy.md": LEGACY,
};

const sha = (dir) => gitIn(dir, "rev-parse", "HEAD");

export function sweepRepo({ nested = false } = {}) {
  const gitRoot = mkdtempSync(join(tmpdir(), "hsdd-sweep-"));
  initRepo(gitRoot);
  const root = nested ? join(gitRoot, "svc") : gitRoot;
  if (nested) mkdirSync(root);
  const at = (rel, content) => write(root, rel, content);
  const append = (rel, text) => at(rel, gitShow(rel) + text);
  const gitShow = (rel) => gitIn(root, "show", `HEAD:./${rel}`) + "\n";
  const commit = (subject, body) => {
    gitIn(gitRoot, "add", "-A");
    gitIn(gitRoot, "commit", "-q", "-m", subject, ...(body ? ["-m", body] : []));
    return sha(gitRoot);
  };

  write_(root, { ...BASE_SPEC, ...BASE_CODE, "hsdd/contract/.keep": "" });
  const base = commit("base");
  const shas = {};

  if (nested) {
    write(gitRoot, "other/x.txt", "outside\n");
    shas.outside = commit("other: outside the project");
  }

  gitIn(gitRoot, "checkout", "-q", "-b", "feat");
  append("src/web/app.js", "// side fix\n");
  shas.side = commit("web: side fix");
  gitIn(gitRoot, "checkout", "-q", "main");
  gitIn(gitRoot, "merge", "-q", "--no-ff", "-m", "merge feat", "feat");
  shas.merge = sha(gitRoot);

  at("hsdd/spec/acme.web.md", WEB + "\n");
  shas.gov = commit("docs: tree");

  append("src/web/app.js", "// finish preview\n");
  shas.phaseSubject = commit("acme.web.2: finish the preview");

  append("src/web/app.js", "// tidy\n");
  shas.phaseTrailer = commit("web: tidy", "Phase: acme.web.1");

  append("src/web/app.js", "// unknown id\n");
  shas.unknownId = commit("web: per acme.web.20");

  at("src/web/routes.js", 'app.get("/payouts", list);\napp.post("/payouts/preview", preview);\nconst title = "Payouts preview";\n');
  shas.routeAdd = commit("web: preview endpoint");

  at("api/openapi.yaml", "openapi: 3.0.0\npaths:\n  /payouts/preview: {}\n");
  shas.schema = commit("api: document preview");

  at("src/web/migrations/V2__holds.sql", "CREATE TABLE holds (id int);\n");
  shas.migration = commit("web: payout holds");

  at("src/web/migrations/V3__reason.sql", "ALTER TABLE holds ADD reason text;\n");
  shas.alter = commit("web: hold reason");

  at("src/web/events.js", '// events\npublish("payouts.settled", p);\n');
  shas.topic = commit("web: emit settled");

  at("src/web/routes.js", 'app.get("/payouts", list);\napp.post("/payouts/preview", preview);\nconst title = "Payments preview";\n');
  shas.copy = commit("web: rename title");

  at("src/web/routes.js", 'app.post("/payouts/preview", preview);\nconst title = "Payments preview";\n');
  at("src/web/list.js", 'app.get("/payouts", list);\n');
  shas.moved = commit("web: split routes");

  gitIn(root, "rm", "-q", "src/web/old.js");
  shas.removed = commit("web: drop the old route");

  at("src/web/my assets/logo name.js", "// logo\n");
  at("src/web/logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x00, 0xff]));
  shas.spaced = commit("web: asset");

  append("src/web/app.js", 'console.log("retry");\n');
  shas.log = commit("web: log the retry");

  append("src/reports/monthly.js", "// null check\n");
  shas.asBuilt = commit("reports: null check");

  append("src/web/app.js", "// shared date\n");
  append("src/reports/monthly.js", "// shared date\n");
  shas.spans = commit("web and reports: shared date");

  append("tools/report.js", "// null check\n");
  shas.unowned = commit("tools: null check");

  append("src/legacy/old.js", "// tidy\n");
  shas.retired = commit("legacy: tidy");

  at("tools/helper.js", "// helper\n");
  shas.trailer = commit("tools: helper", "HSDD-Node: acme.web");

  append("src/web/app.js", "// shared again\n");
  append("src/reports/monthly.js", "// shared again\n");
  shas.trailerSpan = commit("web: shared", "HSDD-Node: acme.web");

  at("hsdd/contract/payouts-api.md", "# Payouts API\n");
  append("src/web/app.js", "// contract note\n");
  shas.contract = commit("web: contract note");

  return { root, gitRoot, base, shas };
}

// The standalone-spec-repo profile: the tree is its own repository mounted at
// hsdd/ in the implementation repository.
export function sweepProfileRepo() {
  const specDir = mkdtempSync(join(tmpdir(), "hsdd-sweep-spec-"));
  initRepo(specDir);
  write_(specDir, {
    "conventions.md": "# Project Conventions\n\nProfile: standalone-spec-repo\n\n## Main line\n**Main line:** main\n",
    "spec/acme.md": ROOT,
    "spec/acme.web.md": WEB,
    "spec/acme.reports.md": REPORTS,
    "spec/acme.legacy.md": LEGACY,
  });
  gitIn(specDir, "add", "-A");
  gitIn(specDir, "commit", "-q", "-m", "spec");

  const root = mkdtempSync(join(tmpdir(), "hsdd-sweep-impl-"));
  initRepo(root);
  write_(root, BASE_CODE);
  gitIn(root, "-c", "protocol.file.allow=always", "-c", "init.templateDir=", "submodule", "add", "-q", specDir, "hsdd");
  gitIn(root, "add", "-A");
  gitIn(root, "commit", "-q", "-m", "base");
  const base = sha(root);
  const hsdd = join(root, "hsdd");
  for (const [k, v] of [["user.name", "Test Owner"], ["user.email", "owner@example.invalid"], ["commit.gpgsign", "false"], ["core.hooksPath", join(specDir, ".git", "no-hooks")]]) gitIn(hsdd, "config", k, v);

  write(root, "hsdd/spec/acme.web.md", WEB + "\n");
  gitIn(hsdd, "add", "-A");
  gitIn(hsdd, "commit", "-q", "-m", "spec: touch web");
  gitIn(root, "add", "-A");
  gitIn(root, "commit", "-q", "-m", "docs: bump the spec");
  const pointer = sha(root);

  write(root, "src/web/app.js", '// web app\nconsole.log("retry");\n');
  gitIn(root, "add", "-A");
  gitIn(root, "commit", "-q", "-m", "web: log the retry");
  return { root, spec: specDir, base, shas: { pointer, log: sha(root) } };
}

// Stands in for the agent: replaces `?` cells, fills the change-log counts
// from the final table and appends `lowered` lines. `rows[sha7]` overrides
// any of node, cls, reason on that row.
export function fillRecord(text, { rows = {}, runBy, routing, status, lowered = [] } = {}) {
  const r = parseRecord(text);
  const filled = r.rows.map((x) => ({ ...x, ...(rows[x.sha] ?? {}) }));
  const n = (c) => filled.filter((x) => x.cls === c).length;
  const counts = `${filled.length} candidates: ${n("log")} log, ${n("retro")} retro, ${n("intake")} intake, ${n("unplaced")} unplaced`;
  const [first, ...rest] = r.changeLog;
  return renderRecord({
    ...r,
    rows: filled,
    runBy: runBy ?? r.runBy,
    routing: routing ?? r.routing,
    status: status ?? r.status,
    changeLog: [first.replace(/created; .*$/, `created; ${counts}`), ...rest, ...lowered],
  });
}

// The agent's usual completion of a draft: unplaceable rows unplaced, `copy`
// retro on acme.web, the rest log, one handoff per retro node and intake row.
export function completeDraft(text, shas, { runBy = "Purbo" } = {}) {
  const r = parseRecord(text);
  const rows = {};
  for (const x of r.rows) {
    const o = {};
    if (x.cls === "?") {
      if (x.node === "?") Object.assign(o, { node: "none", cls: "unplaced", reason: "src/unowned" });
      else if (x.sha === shas.copy.slice(0, 7)) Object.assign(o, { cls: "retro", reason: 'acme.web.2 Verification: "the preview shows the fee line"' });
      else Object.assign(o, { cls: "log", reason: "none" });
    } else if (x.node === "?") o.node = "acme.web";
    rows[x.sha] = o;
  }
  const final = r.rows.map((x) => ({ ...x, ...rows[x.sha] }));
  const retro = final.filter((x) => x.cls === "retro");
  const lines = [];
  let h = 0;
  for (const node of new Set(retro.map((x) => x.node))) {
    const own = retro.filter((x) => x.node === node).map((x) => x.sha);
    lines.push(`**H${++h}** (retro, ${node}):`);
    for (const p of [`/hsdd-phase-plan ${node} per the record: add one retro phase for commits ${own.join(", ")}.`, `/hsdd-reconcile ${node}`, `Write the verification doc for commits ${own.join(", ")}.`]) lines.push("```text", p, "```");
  }
  for (const x of final.filter((y) => y.cls === "intake")) lines.push(`**H${++h}** (intake, ${x.sha}):`, "```text", `/hsdd-intake per the record: commit ${x.sha}.`, "```");
  const open = final.some((x) => x.cls !== "log");
  return fillRecord(text, { rows, runBy, routing: lines.length ? lines : undefined, status: open ? "open" : `closed (${r.date})` });
}
