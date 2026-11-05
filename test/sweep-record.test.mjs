import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderRecord, parseRecord, recordFile, isRecordFile, normalizeRepo, reservedIn, newestRecord, classifiedOf } from "../skills/hsdd-intake/scripts/lib/record.mjs";
import { repoName, Refusal } from "../skills/hsdd-intake/scripts/lib/git.mjs";
import { readRecords } from "../skills/hsdd-intake/scripts/lib/tree.mjs";

const FROM = "a".repeat(40), TO = "f8c1d07" + "b".repeat(33);
const sample = (over = {}) => ({
  repo: "acme-shop", main: "main", named: "origin", date: "2026-11-05", from: FROM, to: TO,
  commits: 9, candidates: 4, fromNote: "from named", runBy: "Purbo", status: "open",
  rows: [
    { sha: "a1b2c3d", node: "acme.web.checkout", cls: "log", reason: "none", subject: "checkout: larger total" },
    { sha: "b2c3d4e", node: "acme.web.checkout", cls: "retro", reason: 'acme.web.checkout.4 Verification: "shows the fee line"', subject: "checkout: fee" },
    { sha: "c3d4e5f", node: "acme.backend.payouts", cls: "intake", reason: "route added POST /payouts/preview", subject: "payouts: preview" },
    { sha: "d4e5f6a", node: "none", cls: "unplaced", reason: "src/legacy/report.ts", subject: "report: null check" },
  ],
  notCandidates: ["- merges: none", "- governance-only: 1 (e5f6a7b)", "- attributed: none", "- classified by x.md: none", "- unknown phase id: none"],
  routing: ["**H1** (retro, acme.web.checkout):", "```text", "append this", "", "## not a heading", "```"],
  produced: ["none"],
  changeLog: ["- 2026-11-05: created; 4 candidates: 1 log, 1 retro, 1 intake, 1 unplaced"],
  ...over,
});

test("render then parse keeps the header and the rows", () => {
  const r = sample();
  assert.deepEqual(parseRecord(renderRecord(r)), r);
  assert.equal(renderRecord(parseRecord(renderRecord(r))), renderRecord(r));
  const out = renderRecord(r);
  assert.match(out, /^# Sweep: acme-shop aaaaaaa\.\.f8c1d07\n/);
  assert.match(out, /- \*\*Repository:\*\* acme-shop \(main; named by origin\)/);
  assert.match(out, new RegExp(`- \\*\\*Range:\\*\\* ${FROM}\\.\\.${TO} \\(9 commits, 4 candidates; from named\\)`));
  const order = ["## Commits", "## Not candidates", "## Routing", "## Produced", "## Change log"].map((h) => out.indexOf(h));
  assert.deepEqual([...order].sort((a, b) => a - b), order); assert.ok(order[0] > 0);
});
test("a closed status and a previous-record fromNote round-trip", () => {
  const r = sample({ status: "closed (2026-11-09)", fromNote: "from 2026-11-01-sweep-acme-shop-1234567.md", runBy: "claude for Purbo (delegated)" });
  assert.deepEqual(parseRecord(renderRecord(r)), r);
});
test("a pipe in a subject becomes a slash", () => {
  const r = sample({ rows: [{ sha: "a1b2c3d", node: "n", cls: "log", reason: "a|b", subject: "x | y" }] });
  const back = parseRecord(renderRecord(r));
  assert.equal(back.rows[0].subject, "x / y"); assert.equal(back.rows[0].reason, "a/b");
});
test("parseRecord reads CRLF", () => {
  const r = sample();
  assert.deepEqual(parseRecord(renderRecord(r).replace(/\n/g, "\r\n")), r);
});
test("empty routing and produced read none", () => {
  const back = parseRecord(renderRecord(sample({ routing: [], produced: [] })));
  assert.deepEqual(back.routing, ["none"]); assert.deepEqual(back.produced, ["none"]);
});
test("the filename", () => {
  assert.equal(recordFile({ today: "2026-11-05", repo: "acme-shop", to: "f8c1d07aabbcc" }), "hsdd/management/2026-11-05-sweep-acme-shop-f8c1d07.md");
  assert.equal(isRecordFile("2026-11-05-sweep-acme-shop-f8c1d07.md"), true);
  assert.equal(isRecordFile("2026-11-05-intake-sweep-fix.md"), false);
});
test("normalizeRepo and reservedIn", () => {
  assert.equal(normalizeRepo("Acme_Shop.v2"), "acme-shop-v2");
  assert.equal(reservedIn("intake-service"), "intake"); assert.equal(reservedIn("order-progress"), "progress"); assert.equal(reservedIn("acme-shop"), null);
});
const stub = (map) => (cwd, args) => { const k = args.join(" "); if (k in map) { const v = map[k]; if (v instanceof Error) throw v; return v; } throw new Error("no " + k); };
test("repoName: --repo, then origin in both URL forms, then the directory", () => {
  const none = new Error("no remote");
  assert.deepEqual(repoName("/x", "Given_Name", stub({})), { name: "given-name", named: "--repo" });
  assert.deepEqual(repoName("/x", undefined, stub({ "remote get-url origin": "https://github.com/acme/Acme-Shop.git" })), { name: "acme-shop", named: "origin" });
  assert.deepEqual(repoName("/x", undefined, stub({ "remote get-url origin": "git@github.com:acme/acme-shop.git/" })), { name: "acme-shop", named: "origin" });
  assert.deepEqual(repoName("/x", undefined, stub({ "remote get-url origin": none, "rev-parse --show-toplevel": "/home/me/My Shop" })), { name: "my-shop", named: "directory" });
});
test("repoName refuses a reserved word and names --repo", () => {
  assert.throws(() => repoName("/x", "intake-service", stub({})), /--repo/);
  assert.throws(() => repoName("/x", "intake-service", stub({})), Refusal);
});
const rec = (repo, date, to, filename = `${date}-sweep-${repo}-${to.slice(0, 7)}.md`) => sample({ repo, date, to, filename });
test("newestRecord: the latest date, then the descendant; another repository is ignored", () => {
  const a = rec("acme", "2026-11-01", "1111111"), b = rec("acme", "2026-11-05", "2222222"), c = rec("acme", "2026-11-05", "3333333"), o = rec("other", "2026-11-09", "4444444");
  const descends = (x, y) => x === "3333333" && y === "2222222";
  assert.equal(newestRecord([a, b, c, o], "acme", descends).to, "3333333");
  assert.equal(newestRecord([c, b, a, o], "acme", descends).to, "3333333");
  assert.equal(newestRecord([a], "none", descends), null);
});
test("classifiedOf leaves out the record it is told to", () => {
  const a = rec("acme", "2026-11-01", "1111111"), b = rec("acme", "2026-11-05", "2222222"), o = rec("other", "2026-11-01", "4444444");
  const m = classifiedOf([a, b, o], "acme", b.filename);
  assert.equal(m.get("a1b2c3d"), a.filename); assert.equal(m.size, 4);
});
test("readRecords leaves out an intake record whose slug says sweep", () => {
  const root = mkdtempSync(join(tmpdir(), "rec-")); const dir = join(root, "hsdd", "management"); mkdirSync(dir, { recursive: true });
  const r = rec("acme", "2026-11-05", "2222222");
  writeFileSync(join(dir, r.filename), renderRecord(r));
  writeFileSync(join(dir, "2026-11-05-intake-sweep-fix.md"), "# Intake\n");
  const got = readRecords(root);
  assert.deepEqual(got.map((x) => x.filename), [r.filename]); assert.equal(got[0].repo, "acme");
  assert.deepEqual(readRecords(mkdtempSync(join(tmpdir(), "rec-"))), []);
});
