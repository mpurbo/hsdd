import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../skills/hsdd-seal/scripts/seal.mjs";

function collector() {
  const lines = [];
  return { lines, log: (s) => lines.push(String(s)), error: (s) => lines.push(String(s)) };
}

test("no command prints usage and exits 2", () => {
  const o = collector();
  assert.equal(main([], mkdtempSync(join(tmpdir(), "hsdd-seal-")), o), 2);
  assert.match(o.lines.join("\n"), /usage: seal\.mjs plan \| apply sign\|drop\|prune\|close \| report/);
});

test("an unknown command prints usage and exits 2", () => {
  const o = collector();
  assert.equal(main(["frobnicate"], mkdtempSync(join(tmpdir(), "hsdd-seal-")), o), 2);
  assert.match(o.lines.join("\n"), /usage: seal\.mjs/);
});

// Task 9: the wired CLI, end to end on the fixture
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sealTree, gitIn } from "./helpers/seal-fixture.mjs";

const PLAN_ARGS = (catchup) => ["plan", "--release", "2.4.0", "--date", "2026-09-15", "--owner", "Dewi", "--evidence", "QA run 77", "--catchup", catchup, "--today", "2026-11-03"];

test("plan, edit, apply all, report", () => {
  const { root, catchup } = sealTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o), 0);
  const json = join(root, "hsdd/management/2026-11-03-seal-plan.json");
  const md = join(root, "hsdd/management/2026-11-03-seal-plan.md");
  assert.ok(existsSync(json));
  assert.ok(existsSync(md));
  assert.match(o.lines.join("\n"), /done 2, sign 3, drop 2, keep 0, skip 1/);
  const p = JSON.parse(readFileSync(json, "utf8"));
  assert.equal(p.kind, "seal-plan");
  p.phases.find((x) => x.id === "acme.web.3").class = "sign";
  writeFileSync(json, JSON.stringify(p, null, 2));
  for (const step of ["sign", "drop", "prune", "close"]) {
    const dry = collector();
    assert.equal(main(["apply", step, "--plan", json], root, dry), 0, step);
    assert.match(dry.lines.join("\n"), /dry run/);
    const wet = collector();
    assert.equal(main(["apply", step, "--plan", json, "--write"], root, wet), 0, step);
  }
  assert.ok(existsSync(join(root, "hsdd/verify/acme.web.3.verification.md")));
  assert.ok(existsSync(join(root, "hsdd/verify/acme.web.1.verification.md")));
  assert.equal(existsSync(join(root, "openspec/changes/archive/2026-10-25-acme-api-3")), false);
  assert.match(readFileSync(join(root, "hsdd/spec/acme.api.md"), "utf8"), /acme\.api\.4: Export[\s\S]*\*\*Status:\*\* dropped/);
  const rep = collector();
  assert.equal(main(["report", "--plan", json, "--write"], root, rep), 0);
  assert.match(rep.lines.join("\n"), /## Result/);
  assert.match(readFileSync(md, "utf8"), /## Result[\s\S]*\| Signed today \| 4 \|/);
});

test("apply --commit commits the touched files in the repository", () => {
  const { root, catchup } = sealTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o), 0);
  const json = join(root, "hsdd/management/2026-11-03-seal-plan.json");
  assert.equal(main(["apply", "sign", "--plan", json, "--write", "--commit"], root, o), 0);
  assert.equal(gitIn(root, "log", "-1", "--format=%s"), "seal: sign");
  assert.equal(gitIn(root, "status", "--porcelain", "--", "hsdd/verify"), "");
  assert.equal(main(["apply", "sign", "--plan", json, "--write", "--commit"], root, o), 0);
  assert.equal(gitIn(root, "log", "--format=%s").split("\n").filter((s) => s === "seal: sign").length, 1);
});

test("apply with a missing plan returns 1; plan without --owner returns 2", () => {
  const { root } = sealTree();
  const o = collector();
  assert.equal(main(["apply", "sign", "--plan", "hsdd/management/none.json"], root, o), 1);
  assert.equal(main(["plan", "--release", "2.4.0", "--date", "2026-09-15", "--evidence", "x"], root, o), 2);
  assert.equal(main(["apply", "frob", "--plan", "x"], root, o), 2);
});

test("apply refuses a plan file of another kind", () => {
  const { root } = sealTree();
  writeFileSync(join(root, "other.json"), JSON.stringify({ kind: "plan" }));
  const o = collector();
  assert.equal(main(["apply", "sign", "--plan", "other.json"], root, o), 1);
  assert.match(o.lines.join("\n"), /not a seal plan/);
});

// Fix pass: findings 1, 2, 3, 4, 10 at the CLI
import { profileTree } from "./helpers/seal-fixture.mjs";

test("plan refuses a --catchup value git rejects, with exit 1 and no plan file", () => {
  const { root } = sealTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS("deadbeef0000"), root, o), 1);
  assert.match(o.lines.join("\n"), /deadbeef0000/);
  assert.equal(existsSync(join(root, "hsdd/management/2026-11-03-seal-plan.json")), false);
  const o2 = collector();
  assert.equal(main(PLAN_ARGS("since:yesterday"), root, o2), 1);
});

test("plan refuses to overwrite an existing plan unless --force", () => {
  const { root, catchup } = sealTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o), 0);
  const json = join(root, "hsdd/management/2026-11-03-seal-plan.json");
  const p = JSON.parse(readFileSync(json, "utf8"));
  p.phases.find((x) => x.id === "acme.web.3").class = "sign";
  writeFileSync(json, JSON.stringify(p, null, 2));
  const o2 = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o2), 1);
  assert.match(o2.lines.join("\n"), /--force/);
  assert.equal(JSON.parse(readFileSync(json, "utf8")).phases.find((x) => x.id === "acme.web.3").class, "sign");
  assert.equal(main([...PLAN_ARGS(catchup), "--force"], root, collector()), 0);
  assert.equal(JSON.parse(readFileSync(json, "utf8")).phases.find((x) => x.id === "acme.web.3").class, "drop");
});

test("apply --commit leaves unrelated staged changes out of the seal commit", () => {
  const { root, catchup } = sealTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o), 0);
  const json = join(root, "hsdd/management/2026-11-03-seal-plan.json");
  writeFileSync(join(root, "unrelated.js"), "// staged by someone else\n");
  gitIn(root, "add", "unrelated.js");
  assert.equal(main(["apply", "sign", "--plan", json, "--write", "--commit"], root, o), 0);
  assert.equal(gitIn(root, "log", "-1", "--format=%s"), "seal: sign");
  assert.ok(!gitIn(root, "show", "--name-only", "--format=", "HEAD").includes("unrelated.js"));
  assert.match(gitIn(root, "status", "--porcelain", "--", "unrelated.js"), /^A /);
});

test("apply refuses a plan whose today is not a date", () => {
  const { root, catchup } = sealTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o), 0);
  const json = join(root, "hsdd/management/2026-11-03-seal-plan.json");
  const p = JSON.parse(readFileSync(json, "utf8"));
  p.inputs.today = "../x";
  writeFileSync(json, JSON.stringify(p));
  const o2 = collector();
  assert.equal(main(["report", "--plan", json, "--write"], root, o2), 1);
  assert.match(o2.lines.join("\n"), /today/);
});

test("under the profile, --commit refuses a detached hsdd/ before writing, then commits inside it and bumps the pointer", () => {
  const { root, catchup } = profileTree();
  const o = collector();
  assert.equal(main(PLAN_ARGS(catchup), root, o), 0);
  const json = join(root, "hsdd/management/2026-11-03-seal-plan.json");
  gitIn(join(root, "hsdd"), "checkout", "-q", "--detach");
  const detached = collector();
  assert.equal(main(["apply", "sign", "--plan", json, "--write", "--commit"], root, detached), 1);
  assert.match(detached.lines.join("\n"), /detached/);
  assert.equal(existsSync(join(root, "hsdd/verify/acme.web.1.verification.md")), false);
  gitIn(join(root, "hsdd"), "checkout", "-q", "main");
  const attached = collector();
  assert.equal(main(["apply", "sign", "--plan", json, "--write", "--commit"], root, attached), 0);
  assert.equal(gitIn(join(root, "hsdd"), "log", "-1", "--format=%s"), "seal: sign");
  assert.equal(gitIn(join(root, "hsdd"), "branch", "--show-current"), "main");
  assert.equal(gitIn(root, "log", "-1", "--format=%s"), "seal: sign (pointer)");
  assert.equal(gitIn(root, "status", "--porcelain", "--ignore-submodules=untracked", "--", "hsdd"), "");
});
