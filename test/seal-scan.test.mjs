import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sealTree } from "./helpers/seal-fixture.mjs";
import {
  isSigned, idsIn, parseVerificationDoc, parseIntake, parseMilestone, progressDoneSet,
  pendingRequests, catchupArgs, gitCwdFor, readTree,
} from "../skills/hsdd-seal/scripts/lib/scan.mjs";

test("isSigned accepts a person or a delegated sign-off and rejects placeholders", () => {
  assert.equal(isSigned("Dewi, 2026-10-01"), true);
  assert.equal(isSigned("Claude for Dewi (delegated), 2026-10-01"), true);
  assert.equal(isSigned("{person} | {agent} for {person} (delegated)"), false);
  assert.equal(isSigned(""), false);
  assert.equal(isSigned(null), false);
  assert.equal(isSigned("TBD"), false);
  assert.equal(isSigned("n/a"), false);
});

test("idsIn is boundary-safe and keeps order of appearance", () => {
  assert.deepEqual(idsIn("gate: acme.api.10 and acme.api.1.", ["acme.api.1", "acme.api.10"]), ["acme.api.10", "acme.api.1"]);
  assert.deepEqual(idsIn("`acme.api.1`, acme.api.1 again", ["acme.api.1"]), ["acme.api.1"]);
  assert.deepEqual(idsIn("acme.api.1x acme.api.1.2", ["acme.api.1"]), []);
});

test("parseVerificationDoc reads a CRLF Sign-off", () => {
  const d = parseVerificationDoc("# V\r\n## Sign-off\r\n- Reviewer / date: Dewi, 2026-10-01\r\n");
  assert.equal(d.reviewer, "Dewi, 2026-10-01");
  assert.equal(d.signed, true);
  assert.equal(d.hasSignoff, true);
});

test("parseVerificationDoc flags placeholders and empty sections", () => {
  const d = parseVerificationDoc("# V\n## Outstanding\n\n## Learnings\n\n## Sign-off\n- Reviewer / date: {person} | {agent} for {person} (delegated)\n");
  assert.equal(d.signed, false);
  assert.equal(d.placeholder, true);
  assert.equal(d.outstandingEmpty, true);
  assert.equal(d.learningsEmpty, true);
});

test("parseVerificationDoc without a Sign-off section", () => {
  const d = parseVerificationDoc("# V\n## Observed\nx\n## Outstanding\n- item\n## Learnings\n- none\n");
  assert.equal(d.hasSignoff, false);
  assert.equal(d.reviewer, null);
  assert.equal(d.outstandingEmpty, false);
  assert.equal(d.learningsEmpty, true);
});

test("parseIntake reads status, request and the produced ids", () => {
  const text = "# Intake: X\n\n- **Request:** docs/x.md (ticket)\n- **Status:** open\n\n## Produced\n- phases appended: `a.1`, `a.2`\n\n## Change log\n- d: c\n";
  const r = parseIntake(text, "hsdd/management/2026-01-01-intake-x.md", ["a.1", "a.2", "a.3"]);
  assert.deepEqual(r, { path: "hsdd/management/2026-01-01-intake-x.md", status: "open", produced: ["a.1", "a.2"], request: "docs/x.md (ticket)" });
  assert.equal(parseIntake(text.replace("open", "closed (2026-02-02)"), "p", ["a.1"]).status, "closed");
});

test("parseMilestone lists the gates inside the Milestones section", () => {
  const { MILESTONES } = awaitImport();
  const m = parseMilestone(MILESTONES, ["acme.api.1", "acme.api.2", "acme.api.3", "acme.api.4", "acme.web.1", "acme.web.2", "acme.web.3"]);
  assert.equal(m.sealed, false);
  assert.equal(m.gates.length, 4);
  assert.deepEqual(m.gates[1].phases, ["acme.api.3", "acme.api.4"]);
  assert.deepEqual(m.gates[3].phases, []);
  assert.equal(m.gates[0].checked, false);
  assert.ok(m.firstH2Line > 0);
  assert.equal(parseMilestone("# M\n- **Sealed:** 2026-01-01\n## Milestones\n- [x] a.1 done\n", ["a.1"]).sealed, true);
});

test("progressDoneSet reads only the What is done section", () => {
  const { PROGRESS } = awaitImport();
  const ids = ["acme.api.1", "acme.api.2", "acme.api.3", "acme.web.1", "acme.web.2", "acme.web.3"];
  assert.deepEqual([...progressDoneSet(PROGRESS, ids)].sort(), ["acme.api.1", "acme.api.2", "acme.web.1"]);
  assert.equal(progressDoneSet("# P\n## Velocity\n`acme.api.1`\n", ids).size, 0);
});

test("pendingRequests counts bullets and request bullets", () => {
  const text = "# N\n## Phase Plan\nx\n## Governance updates (pending reconcile)\n\n- confirm a@v1 produced_by n.1\n- request a@v1: the envelope\n- note something\n\n## Other\n- request not counted here\n";
  assert.deepEqual(pendingRequests(text), { entries: 3, requests: 1 });
  assert.deepEqual(pendingRequests("# N\n## Phase Plan\n"), { entries: 0, requests: 0 });
});

test("catchupArgs turns the owner's value into git log arguments", () => {
  assert.deepEqual(catchupArgs("since:2026-10-01"), ["--since=2026-10-01"]);
  assert.deepEqual(catchupArgs("a1b2c3d,b2c3d4e"), ["a1b2c3d^!", "b2c3d4e^!"]);
  assert.deepEqual(catchupArgs("a1b2c3d..f4e5d6c"), ["a1b2c3d..f4e5d6c"]);
  assert.deepEqual(catchupArgs("a1b2c3d"), ["a1b2c3d^!"]);
  assert.deepEqual(catchupArgs(null), []);
});

test("gitCwdFor picks the submodule for hsdd/ paths under the profile", () => {
  const root = mkdtempSync(join(tmpdir(), "hsdd-seal-prof-"));
  mkdirSync(join(root, "hsdd"));
  writeFileSync(join(root, "hsdd", ".git"), "gitdir: ../.git/modules/hsdd\n");
  assert.equal(gitCwdFor(root, "hsdd/verify/x.md"), join(root, "hsdd"));
  assert.equal(gitCwdFor(root, "openspec/changes/x"), root);
  const plain = mkdtempSync(join(tmpdir(), "hsdd-seal-plain-"));
  mkdirSync(join(plain, "hsdd"));
  assert.equal(gitCwdFor(plain, "hsdd/verify/x.md"), plain);
});

test("readTree on the fixture", () => {
  const { root, catchup } = sealTree();
  const t = readTree(root, { catchup });
  assert.deepEqual(t.phaseIds, ["acme.api.1", "acme.api.2", "acme.api.3", "acme.api.4", "acme.legacy.1", "acme.web.1", "acme.web.2", "acme.web.3"]);
  assert.equal(t.docs.get("acme.api.1").signed, true);
  assert.equal(t.docs.get("acme.api.2").signed, true);
  assert.equal(t.docs.get("acme.api.3").placeholder, true);
  assert.equal(t.docs.get("acme.api.3").addedInCatchup, false);
  assert.equal(t.docs.get("acme.api.4").exists, false);
  assert.equal(t.docs.get("acme.web.2").addedInCatchup, true);
  assert.deepEqual([...t.progressDone].sort(), ["acme.api.1", "acme.api.2", "acme.web.1"]);
  assert.equal(t.intakes.length, 1);
  assert.deepEqual(t.intakes[0].produced, ["acme.api.3", "acme.api.4"]);
  assert.deepEqual(t.intakes[0].cited, ["acme.api.3", "acme.api.4", "acme.web.3"]);
  assert.equal(t.milestone.path, "hsdd/management/2026-09-01-milestones.md");
  assert.equal(t.milestone.gates.length, 4);
  assert.deepEqual(t.milestone.gates[3].phases, []);
  assert.ok(t.contextIds.has("acme.web.2"));
  assert.ok(t.openspecIds.has("acme.api.1"));
  assert.ok(!t.openspecIds.has("acme.api.3"));
  assert.deepEqual(t.pending, [{ node: "acme.api", path: "hsdd/spec/acme.api.md", entries: 2, requests: 1 }]);
  assert.equal(t.conventions.hasDropped, false);
  assert.ok(t.catchupAdded.has("openspec/changes/archive/2026-10-25-acme-api-3/tasks.md"));
  assert.ok(t.catchupAdded.has("hsdd/verify/acme.web.2.verification.md"));
  assert.notEqual(t.specSha, "n/a");
  assert.deepEqual(t.unparsed, []);
});

test("readTree without a catch-up marks nothing as added", () => {
  const { root } = sealTree();
  const t = readTree(root);
  assert.equal(t.catchupAdded.size, 0);
  assert.equal(t.docs.get("acme.web.2").addedInCatchup, false);
});

// The fixture texts are plain exports; this keeps the import at the top of the file readable.
import * as fixture from "./helpers/seal-fixture.mjs";
function awaitImport() { return fixture; }

test("readTree reports phases already carrying a dropped status", () => {
  const { root } = sealTree();
  const spec = join(root, "hsdd/spec/acme.web.md");
  const text = readFileSync(spec, "utf8");
  const marker = "- **Review tier:** gate-only\n- **Dependencies:** none\n";
  const at = text.lastIndexOf(marker);  // acme.web.3's block, the last gate-only phase in the file
  writeFileSync(spec, text.slice(0, at) + "- **Review tier:** gate-only\n- **Status:** dropped (2026-11-01, not built before release 2.4.0)\n- **Dependencies:** none\n" + text.slice(at + marker.length));
  const t = readTree(root);
  assert.deepEqual([...t.dropped], ["acme.web.3"]);
});

// Fix pass: findings 1, 5, 8 (parse), 11
import { validateCatchup, addedPaths } from "../skills/hsdd-seal/scripts/lib/scan.mjs";
import { profileTree, gitIn } from "./helpers/seal-fixture.mjs";

test("validateCatchup rejects what git rejects and malformed since: values", () => {
  const { root, catchup } = sealTree();
  assert.deepEqual(validateCatchup(root, catchup), { ok: true, errors: [] });
  assert.deepEqual(validateCatchup(root, "since:2026-10-01"), { ok: true, errors: [] });
  assert.equal(validateCatchup(root, `${catchup}^..${catchup}`).ok, true);
  assert.equal(validateCatchup(root, null).ok, true);
  for (const bad of ["deadbeef0000", "since:2026-13-01", "since:2026-1O-01", "since:yesterday", `${catchup},deadbeef0000`]) {
    const r = validateCatchup(root, bad);
    assert.equal(r.ok, false, bad);
    assert.ok(r.errors[0].includes(bad.split(",").pop()) || r.errors[0].includes("since:"), r.errors[0]);
  }
});

test("validateCatchup under the profile checks both repositories and names the one that fails", () => {
  const { root } = profileTree();
  const implSha = gitIn(root, "rev-parse", "HEAD");
  const r = validateCatchup(root, implSha);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /hsdd/);
  assert.match(r.errors[0], /since:/);
  assert.equal(validateCatchup(root, "since:2026-10-01").ok, true);
});

test("addedPaths throws on a revision git rejects instead of returning an empty set", () => {
  const { root } = sealTree();
  assert.throws(() => addedPaths(root, "deadbeef0000"), /deadbeef0000/);
});

test("readTree under the profile marks catch-up files in both repositories", () => {
  const { root, catchup } = profileTree();
  const t = readTree(root, { catchup });
  assert.equal(t.docs.get("acme.web.2").addedInCatchup, true);
  assert.equal(t.docs.get("acme.api.3").addedInCatchup, false);
  assert.ok(t.catchupAdded.has("openspec/changes/archive/2026-10-25-acme-api-3/proposal.md"));
  assert.ok(!t.catchupAdded.has("openspec/changes/archive/2026-08-01-acme-api-1/proposal.md"));
  assert.notEqual(t.specSha, "n/a");
});

test("readTree with the project root below the git root still attributes catch-up files", () => {
  const { root, catchup } = sealTree({ nested: true });
  const t = readTree(root, { catchup });
  assert.ok(t.catchupAdded.has("hsdd/verify/acme.web.2.verification.md"), [...t.catchupAdded].join(","));
  assert.equal(t.docs.get("acme.web.2").addedInCatchup, true);
  assert.ok(t.catchupAdded.has("openspec/changes/archive/2026-10-25-acme-api-3/tasks.md"));
});

test("an OpenSpec change directory is evidence only for the exact phase it names", () => {
  const { root, catchup } = sealTree();
  const t = readTree(root, { catchup });
  assert.ok(!t.openspecIds.has("acme.web.3"), "acme-web-30-thing must not count for acme.web.3");
  assert.ok(t.openspecIds.has("acme.api.1"));
});

test("parseMilestone expands a gate written as a range of one node's phases", () => {
  const ids = ["acme.api.1", "acme.api.2", "acme.api.3", "acme.api.4", "acme.web.1"];
  const m = parseMilestone("# M\n## Milestones\n- [ ] acme.api.1–acme.api.4 done\n- [ ] acme.api.1 - acme.api.3 and acme.web.1\n", ids);
  assert.deepEqual(m.gates[0].phases, ["acme.api.1", "acme.api.2", "acme.api.3", "acme.api.4"]);
  assert.deepEqual(m.gates[1].phases, ["acme.api.1", "acme.api.2", "acme.api.3", "acme.web.1"]);
});
