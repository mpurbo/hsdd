import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseArgs } from "../skills/hsdd-intake/scripts/sweep.mjs";
import { Refusal } from "../skills/hsdd-intake/scripts/lib/git.mjs";

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
import { sweepRepo, sweepProfileRepo, fillRecord } from "./helpers/sweep-fixture.mjs";
import { gitIn, write } from "./helpers/seal-fixture.mjs";

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

// commit
const s7 = (s) => s.slice(0, 7);
const filled = (fx, from, to, opts) => {
  assert.equal(main(draftArgs(fx, "--from", from, "--to", to, "--write"), fx.root, collector()), 0);
  const name = managed(fx.root).find((n) => n.endsWith(`-${s7(to)}.md`));
  const path = join(fx.root, "hsdd/management", name);
  writeFileSync(path, completeDraft(readFileSync(path, "utf8"), fx.shas, opts));
  return { name, rel: `hsdd/management/${name}`, path };
};

test("commit: the record alone, with the message, unrelated staged files left staged", () => {
  const fx = sweepRepo();
  const { rel } = filled(fx, fx.base, fx.shas.contract);
  writeFileSync(join(fx.root, "unrelated.txt"), "keep\n");
  gitIn(fx.root, "add", "unrelated.txt");
  const o = collector();
  assert.equal(main(["commit", rel], fx.root, o), 0, o.lines.join("\n"));
  assert.equal(gitIn(fx.root, "log", "-1", "--format=%s"), `sweep: acme ${s7(fx.base)}..${s7(fx.shas.contract)}`);
  assert.equal(gitIn(fx.root, "show", "--name-only", "--format=", "HEAD"), rel);
  assert.equal(gitIn(fx.root, "diff", "--cached", "--name-only"), "unrelated.txt");
  assert.deepEqual(o.lines, [`ok: ${rel}`, "committed on main"]);
});

test("commit prints a note when the branch is not the main line", () => {
  const fx = sweepRepo();
  const { rel } = filled(fx, fx.base, fx.shas.contract);
  gitIn(fx.root, "checkout", "-q", "-b", "work");
  const o = collector();
  assert.equal(main(["commit", rel], fx.root, o), 0, o.lines.join("\n"));
  assert.deepEqual(o.lines.slice(1), ["committed on work", "note: work is not main; the next sweep reads records from wherever this lands"]);
});

test("commit refuses a record check refuses", () => {
  const fx = sweepRepo();
  const { name } = drafted(fx);
  const head = gitIn(fx.root, "rev-parse", "HEAD");
  const o = collector();
  assert.equal(main(["commit", `hsdd/management/${name}`], fx.root, o), 1);
  assert.match(o.lines.join("\n"), /\?/);
  assert.equal(gitIn(fx.root, "rev-parse", "HEAD"), head);
});

const profileFilled = (p) => {
  assert.equal(main(draftArgs(p, "--from", p.base, "--write"), p.root, collector()), 0);
  const name = readdirSync(join(p.root, "hsdd/management"))[0];
  const rel = `hsdd/management/${name}`;
  writeFileSync(join(p.root, rel), completeDraft(readFileSync(join(p.root, rel), "utf8"), { ...p.shas, copy: "" }));
  return rel;
};

test("under the profile it commits inside the submodule and bumps the pointer", () => {
  const p = sweepProfileRepo();
  const rel = profileFilled(p);
  const o = collector();
  assert.equal(main(["commit", rel], p.root, o), 0, o.lines.join("\n"));
  const msg = `sweep: acme ${s7(p.base)}..${s7(p.shas.log)}`;
  assert.equal(gitIn(join(p.root, "hsdd"), "log", "-1", "--format=%s"), msg);
  assert.equal(gitIn(p.root, "log", "-1", "--format=%s"), `${msg} (pointer)`);
  assert.equal(gitIn(join(p.root, "hsdd"), "show", "--name-only", "--format=", "HEAD"), rel.replace(/^hsdd\//, ""));
});

test("a detached submodule is refused and nothing is committed", () => {
  const p = sweepProfileRepo();
  const rel = profileFilled(p);
  gitIn(join(p.root, "hsdd"), "checkout", "-q", "--detach");
  const subHead = gitIn(join(p.root, "hsdd"), "rev-parse", "HEAD");
  const rootHead = gitIn(p.root, "rev-parse", "HEAD");
  const o = collector();
  assert.equal(main(["commit", rel], p.root, o), 1);
  assert.equal(o.lines.at(-1), "hsdd is on a detached HEAD; check out a branch there before committing, or the commit is orphaned by the next submodule update");
  assert.equal(gitIn(join(p.root, "hsdd"), "rev-parse", "HEAD"), subHead);
  assert.equal(gitIn(p.root, "rev-parse", "HEAD"), rootHead);
});

test("the whole run: draft, fill, check, commit, then the next draft starts where this one ended", () => {
  const fx = sweepRepo();
  const { name, rel } = filled(fx, fx.base, fx.shas.contract);
  assert.equal(main(["check", rel], fx.root, collector()), 0);
  assert.equal(main(["commit", rel], fx.root, collector()), 0);
  const none = collector();
  assert.equal(main(draftArgs(fx), fx.root, none), 0);
  assert.match(none.lines.join("\n"), /^no candidates/);
  write(fx.root, "src/web/app.js", gitIn(fx.root, "show", "HEAD:src/web/app.js") + "\n// after the sweep\n");
  gitIn(fx.root, "add", "-A");
  gitIn(fx.root, "commit", "-q", "-m", "web: after the sweep");
  const o = collector();
  assert.equal(main(draftArgs(fx, "--write"), fx.root, o), 0, o.lines.join("\n"));
  const next = managed(fx.root).find((n) => n !== name);
  const r = parseRecord(readFileSync(join(fx.root, "hsdd/management", next), "utf8"));
  assert.equal(r.from, fx.shas.contract);
  assert.equal(r.rows.length, 1);
  assert.match(readFileSync(join(fx.root, "hsdd/management", next), "utf8"), new RegExp(`from ${name}\\)`));
});

test("the overlap of an earlier --from lands under classified by", () => {
  const fx = sweepRepo();
  const first = filled(fx, fx.base, fx.shas.routeAdd);
  assert.equal(main(["commit", first.rel], fx.root, collector()), 0);
  assert.equal(main(draftArgs(fx, "--from", fx.base, "--to", fx.shas.contract, "--write"), fx.root, collector()), 0);
  const second = managed(fx.root).find((n) => n !== first.name);
  const r = parseRecord(readFileSync(join(fx.root, "hsdd/management", second), "utf8"));
  assert.match(r.notCandidates.join("\n"), new RegExp(`classified by ${first.name.replace(/\./g, "\\.")}: `));
  assert.ok(!r.rows.some((x) => x.sha === s7(fx.shas.routeAdd)));
});

// commit, fix round 1
test("a main line named trunk gives no note", () => {
  const fx = sweepRepo();
  gitIn(fx.root, "branch", "-m", "main", "trunk");
  assert.equal(main(draftArgs(fx, "--main", "trunk", "--from", fx.base, "--to", fx.shas.contract, "--write"), fx.root, collector()), 0);
  const name = managed(fx.root)[0];
  const path = join(fx.root, "hsdd/management", name);
  writeFileSync(path, completeDraft(readFileSync(path, "utf8"), fx.shas));
  const o = collector();
  assert.equal(main(["commit", `hsdd/management/${name}`], fx.root, o), 0, o.lines.join("\n"));
  assert.deepEqual(o.lines.slice(1), ["committed on trunk"]);
});

test("under the profile the root on work gives the note and the pointer line", () => {
  const p = sweepProfileRepo();
  const rel = profileFilled(p);
  gitIn(p.root, "checkout", "-q", "-b", "work");
  const o = collector();
  assert.equal(main(["commit", rel], p.root, o), 0, o.lines.join("\n"));
  assert.deepEqual(o.lines.slice(1), ["committed on main in hsdd; pointer on work", "note: work is not main; the next sweep reads records from wherever this lands"]);
});

test("under the profile the root and the submodule both on main give no note", () => {
  const p = sweepProfileRepo();
  const rel = profileFilled(p);
  const o = collector();
  assert.equal(main(["commit", rel], p.root, o), 0, o.lines.join("\n"));
  assert.deepEqual(o.lines.slice(1), ["committed on main in hsdd; pointer on main"]);
});

test("the retry after a rejected pointer commit bumps the pointer and exits 0", () => {
  const p = sweepProfileRepo();
  const rel = profileFilled(p);
  const hooks = mkdtempSync(join(tmpdir(), "hsdd-hooks-"));
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  gitIn(p.root, "config", "core.hooksPath", hooks);
  assert.throws(() => main(["commit", rel], p.root, collector()));
  const subHead = gitIn(join(p.root, "hsdd"), "rev-parse", "HEAD");
  assert.notEqual(gitIn(p.root, "ls-tree", "HEAD", "hsdd").split(/\s+/)[2], subHead);
  gitIn(p.root, "config", "core.hooksPath", mkdtempSync(join(tmpdir(), "hsdd-nohooks-")));
  const o = collector();
  assert.equal(main(["commit", rel], p.root, o), 0, o.lines.join("\n"));
  assert.equal(gitIn(p.root, "ls-tree", "HEAD", "hsdd").split(/\s+/)[2], subHead);
  assert.match(gitIn(p.root, "log", "-1", "--format=%s"), /^sweep: acme [0-9a-f]{7}\.\.[0-9a-f]{7} \(pointer\)$/);
  assert.match(o.lines.join("\n"), /bumped the pointer on main/);
  const again = collector();
  assert.equal(main(["commit", rel], p.root, again), 0);
  assert.match(again.lines.join("\n"), /nothing to commit/);
});

test("commit takes no flags", () => {
  const fx = sweepRepo();
  const { rel } = filled(fx, fx.base, fx.shas.contract);
  const head = gitIn(fx.root, "rev-parse", "HEAD");
  const o = collector();
  assert.equal(main(["commit", rel, "--write"], fx.root, o), 1);
  assert.match(o.lines.join("\n"), /unexpected argument --write/);
  assert.equal(gitIn(fx.root, "rev-parse", "HEAD"), head);
});

// final review
for (const k of ["to", "from", "main", "repo", "run-by", "today"]) {
  test(`--${k} with a missing or an empty value is refused, naming the flag`, () => {
    const refused = (e) => e instanceof Refusal && e.message === `--${k} needs a value`;
    assert.throws(() => parseArgs(["draft", `--${k}`]), refused);
    assert.throws(() => parseArgs(["draft", `--${k}`, ""]), refused);
    assert.throws(() => parseArgs(["draft", "--write", `--${k}`]), refused);
  });
}

test("a trailing --repo refuses the draft and does not take the origin name", () => {
  const fx = sweepRepo();
  const o = collector();
  assert.equal(main(["draft", "--from", fx.base, "--write", "--repo"], fx.root, o), 1);
  assert.deepEqual(o.lines, ["--repo needs a value"]);
  assert.deepEqual(managed(fx.root), []);
});

test("a commit a phase's Scope cites gets no row, and the record lists it under attributed", () => {
  const fx = sweepRepo();
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.base), fx.root, o), 0);
  const r = parseRecord(o.lines.join("\n"));
  assert.ok(!r.rows.some((x) => x.sha === s7(fx.shas.cited)));
  assert.match(r.notCandidates.join("\n"), new RegExp(`attributed: .*${s7(fx.shas.cited)} -> acme\\.web\\.3`));
});

const edited = (path, patch) => writeFileSync(path, renderRecord({ ...parseRecord(readFileSync(path, "utf8")), ...patch }));
const LOST = "0123456".repeat(5) + "01234";

test("a record with no Date line is unreadable", () => {
  const fx = sweepRepo();
  const { name, path } = filled(fx, fx.base, fx.shas.routeAdd);
  writeFileSync(path, readFileSync(path, "utf8").replace(/^- \*\*Date:\*\*.*\n/m, ""));
  const o = collector();
  assert.equal(main(draftArgs(fx), fx.root, o), 1);
  assert.equal(o.lines.join("\n"), `unreadable record ${name}: fix or delete it before drafting`);
});

test("a record whose to is not in this clone refuses the draft and names the file", () => {
  const fx = sweepRepo();
  const { name, path } = filled(fx, fx.base, fx.shas.routeAdd);
  edited(path, { to: LOST });
  const o = collector();
  assert.equal(main(draftArgs(fx), fx.root, o), 1);
  assert.match(o.lines.join("\n"), new RegExp(`^${name.replace(/\./g, "\\.")}: .*${LOST.slice(0, 7)} does not resolve in this clone`));
});

test("another repository's record is not resolved here: under the profile its shas are in its own clone", () => {
  const fx = sweepRepo();
  const { path } = filled(fx, fx.base, fx.shas.routeAdd);
  edited(path, { repo: "other", to: LOST });
  const o = collector();
  assert.equal(main(draftArgs(fx, "--from", fx.base), fx.root, o), 0, o.lines.join("\n"));
});

for (const end of ["from", "to"]) {
  test(`check and commit refuse a header ${end} not in this clone, naming the file`, () => {
    const fx = sweepRepo();
    const { rel, path } = filled(fx, fx.base, fx.shas.routeAdd);
    edited(path, { [end]: LOST });
    const head = gitIn(fx.root, "rev-parse", "HEAD");
    for (const command of ["check", "commit"]) {
      const o = collector();
      assert.equal(main([command, rel], fx.root, o), 1);
      assert.deepEqual(o.lines, [`${rel}: the Range ${end} ${LOST.slice(0, 7)} does not resolve in this clone; fetch it first`]);
    }
    assert.equal(gitIn(fx.root, "rev-parse", "HEAD"), head);
  });
}

test("a phase row goes through check and commit with no handoff", () => {
  const fx = sweepRepo();
  const { rel } = filled(fx, fx.base, fx.shas.contract);
  const file = join(fx.root, rel);
  const sha = fx.shas.log.slice(0, 7);
  writeFileSync(file, fillRecord(readFileSync(file, "utf8"), { rows: { [sha]: { cls: "phase", reason: "acme.web.2" } } }));
  const o = collector();
  assert.equal(main(["check", rel], fx.root, o), 0, o.lines.join("\n"));
  assert.equal(main(["commit", rel], fx.root, collector()), 0);
  const r = parseRecord(readFileSync(file, "utf8"));
  assert.deepEqual(r.rows.filter((x) => x.cls === "phase").map((x) => [x.sha, x.reason]), [[sha, "acme.web.2"]]);
  assert.match(r.changeLog[0], /, 1 phase$/);
});
