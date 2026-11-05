import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../skills/hsdd-intake/scripts/sweep.mjs";

function collector() {
  const lines = [];
  return { lines, log: (s) => lines.push(String(s)), error: (s) => lines.push(String(s)) };
}

test("no command prints usage and exits 2", () => {
  const o = collector();
  assert.equal(main([], mkdtempSync(join(tmpdir(), "hsdd-sweep-")), o), 2);
  assert.match(o.lines.join("\n"), /usage: sweep\.mjs draft \| check \| commit/);
});

test("an unknown command prints usage and exits 2", () => {
  const o = collector();
  assert.equal(main(["frobnicate"], mkdtempSync(join(tmpdir(), "hsdd-sweep-")), o), 2);
  assert.match(o.lines.join("\n"), /usage: sweep\.mjs draft \| check \| commit/);
});

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { renderRecord, parseRecord } from "../skills/hsdd-intake/scripts/lib/record.mjs";
import { sweepRepo, sweepProfileRepo } from "./helpers/sweep-fixture.mjs";
import { gitIn } from "./helpers/seal-fixture.mjs";

const draftArgs = (fx, ...more) => ["draft", "--repo", "acme", "--today", "2026-11-05", ...more];
const managed = (root) => (existsSync(join(root, "hsdd/management")) ? readdirSync(join(root, "hsdd/management")).filter((f) => f.includes("-sweep-")) : []);
const finish = (path) => {
  const r = parseRecord(readFileSync(path, "utf8"));
  const rows = r.rows.map((x) => ({ ...x, cls: x.cls === "?" ? "log" : x.cls, node: x.node === "?" ? "none" : x.node, reason: x.reason === "?" ? "none" : x.reason }));
  writeFileSync(path, renderRecord({ ...r, rows, runBy: "Purbo" }));
};

test("draft prints and writes nothing without --write", () => {
  const fx = sweepRepo();
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.base), fx.root, o), 0);
  assert.match(o.lines.join("\n"), /^# Sweep: acme /);
  assert.match(o.lines.join("\n"), /\| route added POST \/payouts\/preview \|/);
  assert.deepEqual(managed(fx.root), []);
});

test("draft --write writes the record and tells the next step", () => {
  const fx = sweepRepo();
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.base, "--write"), fx.root, o), 0);
  const name = `2026-11-05-sweep-acme-${fx.shas.contract.slice(0, 7)}.md`;
  assert.deepEqual(managed(fx.root), [name]);
  assert.deepEqual(o.lines, [`wrote hsdd/management/${name}`, "next: fill every ? in the record, then run check"]);
  assert.equal(parseRecord(readFileSync(join(fx.root, "hsdd/management", name), "utf8")).status, "open");
});

test("a range of only set-aside commits writes nothing and exits 0 with the counts", () => {
  const fx = sweepRepo();
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.shas.merge, "--to", fx.shas.phaseSubject, "--write"), fx.root, o), 0);
  assert.deepEqual(o.lines, ["no candidates: 2 commits, 0 merges, 1 governance-only, 1 attributed, 0 classified"]);
  assert.deepEqual(managed(fx.root), []);
});

test("a record with a ? cell left refuses the next draft and names the file", () => {
  const fx = sweepRepo();
  assert.equal(main(draftArgs(fx, "--from", fx.base, "--to", fx.shas.routeAdd, "--write"), fx.root, collector()), 0);
  const name = managed(fx.root)[0];
  const o = collector();
  assert.equal(main(draftArgs(fx), fx.root, o), 1);
  assert.match(o.lines.join("\n"), /unfinished record/);
  assert.match(o.lines.join("\n"), new RegExp(name));
});

test("a record whose run by is ? is unfinished", () => {
  const fx = sweepRepo();
  main(draftArgs(fx, "--from", fx.base, "--to", fx.shas.routeAdd, "--write"), fx.root, collector());
  const path = join(fx.root, "hsdd/management", managed(fx.root)[0]);
  const r = parseRecord(readFileSync(path, "utf8"));
  writeFileSync(path, renderRecord({ ...r, rows: r.rows.map((x) => ({ ...x, cls: "log", node: "none", reason: "none" })) }));
  const o = collector();
  assert.equal(main(draftArgs(fx), fx.root, o), 1);
  assert.match(o.lines.join("\n"), /unfinished record/);
});

test("a finished record lets the next draft continue from its to", () => {
  const fx = sweepRepo();
  main(draftArgs(fx, "--from", fx.base, "--to", fx.shas.routeAdd, "--write"), fx.root, collector());
  finish(join(fx.root, "hsdd/management", managed(fx.root)[0]));
  const o = collector();
  assert.equal(main(draftArgs(fx), fx.root, o), 0);
  assert.match(o.lines.join("\n"), new RegExp(`${fx.shas.routeAdd}\\.\\.${fx.shas.contract} .*from 2026-11-05-sweep-acme-${fx.shas.routeAdd.slice(0, 7)}\\.md`));
});

test("a draft whose --to already has a finished record is refused", () => {
  const fx = sweepRepo();
  assert.equal(main(draftArgs(fx, "--from", fx.shas.migration, "--write"), fx.root, collector()), 0);
  finish(join(fx.root, "hsdd/management", managed(fx.root)[0]));
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.base, "--write"), fx.root, o), 1);
  assert.match(o.lines.join("\n"), /already swept/);
  assert.equal(managed(fx.root).length, 1);
});

test("a record file that cannot be read refuses every draft and names the file", () => {
  const fx = sweepRepo();
  mkdirSync(join(fx.root, "hsdd/management"), { recursive: true });
  writeFileSync(join(fx.root, "hsdd/management", "2026-11-01-sweep-junk.md"), "# nothing here\n");
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.base), fx.root, o), 1);
  assert.match(o.lines.join("\n"), /unreadable record/);
  assert.match(o.lines.join("\n"), /2026-11-01-sweep-junk\.md/);
});

test("a refusal exits 1", () => {
  const fx = sweepRepo();
  const o = collector();
  assert.equal(main(draftArgs(fx), fx.root, o), 1);
  assert.match(o.lines.join("\n"), /first sweep .* --from/);
  const p = collector();
  assert.equal(main(draftArgs(fx, "--from", "--to"), fx.root, p), 1);
  assert.match(p.lines.join("\n"), /starts with "-"/);
});

test("under the profile the pointer commit is governance-only and the record lands in the submodule", () => {
  const p = sweepProfileRepo();
  const o = collector();
  assert.equal(main(draftArgs(p, "--from", p.base, "--write"), p.root, o), 0);
  const name = `2026-11-05-sweep-acme-${p.shas.log.slice(0, 7)}.md`;
  assert.ok(existsSync(join(p.spec, "management", name)) || existsSync(join(p.root, "hsdd/management", name)));
  assert.match(gitIn(join(p.root, "hsdd"), "status", "--porcelain"), /management/);
  const r = parseRecord(readFileSync(join(p.root, "hsdd/management", name), "utf8"));
  assert.deepEqual(r.rows.map((x) => x.sha), [p.shas.log.slice(0, 7)]);
  assert.match(r.notCandidates.join("\n"), new RegExp(`governance-only: 1 \\(${p.shas.pointer.slice(0, 7)}\\)`));
});

// check
import { completeDraft } from "./helpers/sweep-fixture.mjs";
const drafted = (fx) => {
  assert.equal(main(draftArgs(fx, "--from", fx.base, "--to", fx.shas.contract, "--write"), fx.root, collector()), 0);
  const name = managed(fx.root)[0];
  return { name, path: join(fx.root, "hsdd/management", name) };
};

test("check on a written record does not count it against itself", () => {
  const fx = sweepRepo();
  const { name, path } = drafted(fx);
  writeFileSync(path, completeDraft(readFileSync(path, "utf8"), fx.shas));
  const o = collector();
  assert.equal(main(["check", `hsdd/management/${name}`], fx.root, o), 0, o.lines.join("\n"));
  assert.equal(o.lines.join("\n"), `ok: hsdd/management/${name}`);
});

test("check prints problems, exits 1 and writes nothing", () => {
  const fx = sweepRepo();
  const { name, path } = drafted(fx);
  const before = readFileSync(path, "utf8");
  const o = collector();
  assert.equal(main(["check", `hsdd/management/${name}`], fx.root, o), 1);
  assert.match(o.lines.join("\n"), /\?/);
  assert.equal(readFileSync(path, "utf8"), before);
  assert.deepEqual(managed(fx.root), [name]);
});

test("check refuses a path that is not a sweep record or is absent", () => {
  const fx = sweepRepo();
  for (const p of ["hsdd/conventions.md", "hsdd/management/2026-11-05-sweep-acme-abcdef0.md"]) {
    const o = collector();
    assert.equal(main(["check", p], fx.root, o), 1);
    assert.ok(o.lines.length > 0);
  }
  assert.equal(main(["check"], fx.root, collector()), 1);
});
