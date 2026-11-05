# hsdd-intake sweep mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `hsdd-intake` the `manual` class and a sweep mode: a zero-dependency script that drafts, checks and commits a dated record attributing a range of shipped commits, a procedure for the agent that fills the judgment cells, and the checkpoint, phase-plan, conventions and documentation edits that make the lane real.

**Architecture:** `record.mjs`, `candidates.mjs`, `check.mjs` and the compare half of `surface.mjs` are pure: data in, data out. `git.mjs` and `tree.mjs` hold every read of the repository and the tree; `draft.mjs` composes them into a draft; `sweep.mjs` only parses arguments and writes. The agent's part is text: `sweep.md` beside `SKILL.md`, read only in sweep mode, and request mode runs no script.

**Tech Stack:** Node 20+, ESM `.mjs`, `node:test`, git through `node:child_process`. No packages.

**Spec:** `spec/hsdd-spec-v0_13.md`, read with v0.10.2, v0.11.0 and v0.12.0. Section numbers below are v0.13's unless prefixed.

## Global Constraints

- Node 20 or later; no dependency; every import under `skills/hsdd-intake/scripts/` is relative or `node:`, so the directory works when copied verbatim to `hsdd/scripts/sweep/`.
- Eight files under `skills/hsdd-intake/scripts/` are byte-identical copies: `routes.mjs`, `topics.mjs`, `migrations.mjs`, `schemas.mjs`, `diff.mjs`, `walk.mjs` from `skills/hsdd-adopt/scripts/`; `md.mjs`, `extract-plan.mjs` from `skills/hsdd-summary/scripts/`. Copy with `cp`, never retype.
- Nothing under `skills/hsdd-auto/`, `skills/hsdd-seal/`, `skills/hsdd-adopt/` or `skills/hsdd-summary/` changes. Request mode runs no script (§1.3).
- The script reads the repository through git only. It never checks out, stashes or writes to the working tree, except that `draft --write` writes the record. It never pushes.
- Records are found by `YYYY-MM-DD-sweep-` at the start of the name, never by `-sweep-` anywhere (§5.1).
- A short sha is the first seven characters of the full sha. The header's `Range` line holds full shas; table rows, the title, the filename and handoff prompts hold seven.
- `--today` defaults to the local date (`new Date().toLocaleDateString("en-CA")`), not UTC.
- No em dash and no banned phrase in any text this plan adds. Never name any company project in a committed file.
- Test command: `node --test test/*.test.mjs` (`node --test test/` fails on Node 24). The baseline is 891 passing, about 4.5 minutes. During a script task run `node --test test/sweep-*.test.mjs`; run the full suite at the end of Tasks 8, 10 and 11.
- Branch `feat/hsdd-sweep`. Commit as `Purbo Mamad <m.purbo@gmail.com>`, end every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, and push after each task.

## Review Focus

1. A change that reached main through a merge: the merge is set aside and the commits it brought in are candidates. A first-parent walk would hide every change. Pinned in Task 2 (`rangeCommits`) and Task 5 (`setAside`).
2. A handler moved to another file, or shifted down by an edit above it: no surface move, because routes compare by method and path. Pinned in Task 4.
3. A migration that only runs `ALTER TABLE`: a surface move, though the classifier sees only `CREATE TABLE`. Pinned in Task 4.
4. A repository named `intake-service`, and an intake record whose slug contains `sweep`: the first is refused, the second is never read as a sweep record. Pinned in Task 3.
5. A deleted file that carried a route, and a path with a space: the route is reported removed, and the path survives `-z` parsing and `git show`. Pinned in Tasks 2 and 4.

---

### Task 1: Copies and the CLI skeleton

**Files:**
- Create: the eight copies under `skills/hsdd-intake/scripts/`
- Create: `skills/hsdd-intake/scripts/sweep.mjs`
- Test: `test/sweep-vendor.test.mjs`, `test/sweep-cli.test.mjs`

**Interfaces:**
- Produces: `USAGE: string` and `main(argv: string[], root = process.cwd(), out = { log, error }) -> number` in `sweep.mjs`; no command or an unknown one prints `USAGE` and returns 2. Entry guard as in `skills/hsdd-seal/scripts/seal.mjs`.

`USAGE` is exactly:

```text
usage: sweep.mjs draft | check | commit
  draft  [--from SHA] [--to REF] [--main BRANCH] [--repo NAME] [--run-by NAME] [--today YYYY-MM-DD] [--write]
  check  hsdd/management/DATE-sweep-REPO-SHA7.md
  commit hsdd/management/DATE-sweep-REPO-SHA7.md
```

- [ ] **Step 1: Write the failing tests**

```js
// test/sweep-vendor.test.mjs
const COPIES = { "hsdd-adopt": ["routes.mjs", "topics.mjs", "migrations.mjs", "schemas.mjs", "diff.mjs", "walk.mjs"], "hsdd-summary": ["md.mjs", "extract-plan.mjs"] };
test("the eight copies are byte-identical to their sources", () => { /* per file: readFileSync equal, message names the file */ });
test("every import under the scripts is relative or node:", () => { /* walk skills/hsdd-intake/scripts; no `from "x"` outside ./ ../ node: */ });
// test/sweep-cli.test.mjs
test("no command prints usage and exits 2", () => { assert.equal(main([], tmp, o), 2); assert.match(o.lines.join("\n"), /usage: sweep\.mjs draft \| check \| commit/); });
test("an unknown command prints usage and exits 2", ...);
```

- [ ] **Step 2: Run to verify they fail** (`node --test test/sweep-vendor.test.mjs test/sweep-cli.test.mjs`; expected: module not found)
- [ ] **Step 3: `cp` the eight files; write `sweep.mjs`**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): sweep script skeleton and vendored classifiers`

---

### Task 2: Fixture, git reads, tree reads

**Files:**
- Create: `skills/hsdd-intake/scripts/lib/git.mjs`, `skills/hsdd-intake/scripts/lib/tree.mjs`
- Create: `test/helpers/sweep-fixture.mjs`
- Test: `test/sweep-git.test.mjs`

**Interfaces:**
- Produces, in `git.mjs`:
  - `runGit(cwd, args) -> string`: stdout without its final newline, `execFileSync`, `maxBuffer` 64 MB.
  - `resolveCommit(root, ref, git = runGit) -> string|null`: `git rev-parse --verify -q {ref}^{commit}`, null on failure.
  - `isAncestor(root, a, b, git = runGit) -> boolean`: `git merge-base --is-ancestor a b`; exit 1 is false; any other failure throws (exit 128 is a bad ref).
  - `rangeCommits(root, from, to, git = runGit) -> Commit[]`, `Commit = { sha, parents: string[], date, subject, message, paths: string[] }`, oldest first. Ids from `git rev-list --reverse --topo-order {from}..{to}`, with no pathspec and no `--first-parent`. Fields from `git show -s --format=%H%x00%P%x00%cs%x00%s%x00%B {sha}`. Paths from `git diff-tree --no-commit-id --root -r --name-only --no-renames -z --relative {sha}`. A commit with one parent or none and no paths is dropped: it changed nothing under the project root. A merge has empty paths and is kept.
  - `showAt(root, sha, path) -> Buffer|null`: `git show {sha}:./{path}` through `execFileSync` with `encoding: "buffer"`; null when absent, not a blob, or over 2 MB.
- Produces, in `tree.mjs`:
  - `readTree(root) -> Tree`, `Tree = { nodes: Map<id, { id, kind, status, adopted }>, nodeIds: string[], phaseIds: string[], scopes: [{ node, prefixes: string[] }] }`. From `extractPlan(root)`; `phaseIds` are `plan.phases[].id`. `scopes` come from `parseObservedSurface` on each `observedSurface` node's `sourceFile`, leaving out `status: "retired"` nodes.
- Produces, in `test/helpers/sweep-fixture.mjs`, reusing `gitIn`, `write`, `initRepo` from `seal-fixture.mjs`:
  - `sweepRepo({ nested = false } = {}) -> { root, gitRoot, base, shas }`. With `nested`, the project sits in `svc/` and one extra commit `outside` touches `other/x.txt` at the git root.
  - `sweepProfileRepo() -> { root, spec, base, shas }`: the tree in a spec repo mounted at `hsdd/`, on the shape of `seal-fixture.mjs`'s `profileTree`; `shas` holds `pointer` (a spec-repo commit, then the gitlink bump) and `log` (`src/web/app.js`).

**Fixture tree at `base`.** `acme` root; `acme.web`, leaf-parent, `- **Adopted:** promoted`, `## Observed surface` with `- modules: src/web/`, phases `acme.web.1` and `acme.web.2` (the latter's Verification: `the preview shows the fee line`); `acme.reports`, leaf-parent, `- **Adopted:** as-built`, `- modules: src/reports/`, no phases; `acme.legacy`, `- **Status:** retired`, `- modules: src/legacy/`. Files: `src/web/routes.js` (`app.get("/payouts", list);` and `const title = "Payouts";`), `src/web/old.js` (`app.delete("/payouts/old", h);`), `src/web/app.js`, `src/web/events.js`, `src/reports/monthly.js`, `src/legacy/old.js`, `tools/report.js`, `api/openapi.yaml`, `hsdd/conventions.md`.

**Fixture commits, in order, each key in `shas`.** Later tasks assert the last two columns. "move" is what `commitMoves` returns first; "place" is `place`'s result; "aside" means `setAside` removes it.

| Key | Subject (body) | Change | Move | Place |
|-----|----------------|--------|------|-------|
| `side`, then `merge` | `web: side fix` on branch `feat`, merged `--no-ff` as `merge feat` | a comment in `src/web/app.js` | none; merge aside | `acme.web` |
| `gov` | `docs: tree` | `hsdd/spec/acme.web.md` gains a blank line | aside | |
| `phaseSubject` | `acme.web.2: finish the preview` | `src/web/app.js` | aside | |
| `phaseTrailer` | `web: tidy` (`Phase: acme.web.1`) | `src/web/app.js` | aside | |
| `unknownId` | `web: per acme.web.20` | `src/web/app.js` | none; noted unknown | `acme.web` |
| `routeAdd` | `web: preview endpoint` | `app.post("/payouts/preview", preview);` added and the title line changed | `route added POST /payouts/preview` | `acme.web` |
| `schema` | `api: document preview` | `api/openapi.yaml` changed | `schema changed api/openapi.yaml` | null |
| `migration` | `web: payout holds` | `src/web/migrations/V2__holds.sql`, `CREATE TABLE holds` | `table added holds`, then `migration added src/web/migrations/V2__holds.sql` | `acme.web` |
| `alter` | `web: hold reason` | `src/web/migrations/V3__reason.sql`, `ALTER TABLE holds ADD reason text` | `migration added src/web/migrations/V3__reason.sql` | `acme.web` |
| `topic` | `web: emit settled` | `publish("payouts.settled", p);` in `src/web/events.js` | `topic added produces payouts.settled` | `acme.web` |
| `copy` | `web: rename title` | only the title string in `src/web/routes.js` | none | `acme.web` |
| `moved` | `web: split routes` | the `app.get` line moves to `src/web/list.js` | none | `acme.web` |
| `removed` | `web: drop the old route` | `src/web/old.js` deleted | `route removed DELETE /payouts/old` | `acme.web` |
| `spaced` | `web: asset` | `src/web/my assets/logo name.js` and a binary `src/web/logo.png` added | none | `acme.web` |
| `log` | `web: log the retry` | `console.log` in `src/web/app.js` | none | `acme.web` |
| `asBuilt` | `reports: null check` | `src/reports/monthly.js` | none | `acme.reports` |
| `spans` | `web and reports: shared date` | `src/web/app.js` and `src/reports/monthly.js` | none | spans both |
| `unowned` | `tools: null check` | `tools/report.js` | none | null |
| `retired` | `legacy: tidy` | `src/legacy/old.js` | none | null |
| `trailer` | `tools: helper` (`HSDD-Node: acme.web`) | `tools/helper.js` | none | `acme.web` |
| `trailerSpan` | `web: shared` (`HSDD-Node: acme.web`) | `src/web/app.js` and `src/reports/monthly.js` | none | spans both |
| `contract` | `web: contract note` | `hsdd/contract/payouts-api.md` and `src/web/app.js` | `contract changed hsdd/contract/payouts-api.md` | `acme.web` |

Build the fixture once per test file (`const fx = sweepRepo()`) for read-only tests; a test that writes builds its own.

- [ ] **Step 1: Write the failing tests**

```js
test("rangeCommits walks side branches and keeps the merge", () => {
  const cs = rangeCommits(fx.root, fx.base, fx.shas.contract);
  assert.deepEqual(cs.find((c) => c.sha === fx.shas.side).paths, ["src/web/app.js"]);
  const m = cs.find((c) => c.sha === fx.shas.merge);
  assert.equal(m.parents.length, 2); assert.deepEqual(m.paths, []);
});
test("a path with a space survives", () => assert.ok(rangeCommits(fx.root, fx.base, fx.shas.spaced).at(-1).paths.includes("src/web/my assets/logo name.js")));
test("a nested project root reads relative paths and drops commits outside it", () => {
  const n = sweepRepo({ nested: true }); const cs = rangeCommits(n.root, n.base, n.shas.contract);
  assert.ok(!cs.some((c) => c.sha === n.shas.outside));
  assert.ok(cs.some((c) => c.paths.includes("src/web/app.js")));
});
test("showAt: a blob, a deleted path, a path with a space", ...);
test("isAncestor: true, false, and a bad ref throws", ...);
test("readTree: scopes leave out the retired node, adopted is read", () => {
  const t = readTree(fx.root);
  assert.deepEqual(t.scopes.map((s) => s.node).sort(), ["acme.reports", "acme.web"]);
  assert.deepEqual(t.scopes.find((s) => s.node === "acme.web").prefixes, ["src/web/"]);
  assert.equal(t.nodes.get("acme.reports").adopted, "as-built");
  assert.ok(t.phaseIds.includes("acme.web.2"));
});
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `git.mjs`, `tree.mjs` and the fixture**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): sweep reads git and the tree`

---

### Task 3: The record

**Files:**
- Create: `skills/hsdd-intake/scripts/lib/record.mjs`
- Modify: `skills/hsdd-intake/scripts/lib/git.mjs`, `skills/hsdd-intake/scripts/lib/tree.mjs`
- Test: `test/sweep-record.test.mjs`

**Interfaces:**
- Produces, in `record.mjs`, all pure:
  - `Record = { repo, main, named: "--repo"|"origin"|"directory", date, from, to, commits: number, candidates: number, fromNote, runBy, status, rows: Row[], notCandidates: string[], routing: string[], produced: string[], changeLog: string[] }`; `Row = { sha, node, cls, reason, subject }`. `fromNote` is `from named` or `from {filename}`. `routing` and `produced` are the section's lines, `["none"]` when empty.
  - `renderRecord(r: Record) -> string`: the shape of §5.2 exactly, in its section order. A pipe in any cell becomes `/`.
  - `parseRecord(text: string) -> Record`, tolerant of CRLF through `toLines`, table through `tables` and `column`.
  - `recordFile({ today, repo, to }) -> string`, `isRecordFile(name) -> boolean` (`/^\d{4}-\d{2}-\d{2}-sweep-.+\.md$/`).
  - `normalizeRepo(s) -> string`; `reservedIn(name) -> string|null` over `progress`, `execution-plan`, `milestones`, `atlas`, `intake`.
  - `newestRecord(records, repo, descends: (a, b) => boolean) -> Record|null`: latest `date`; among one date, the one whose `to` descends from the others'.
  - `classifiedOf(records, repo, exclude = null) -> Map<sha7, filename>`.
- Produces, in `git.mjs`: `repoName(root, given, git = runGit) -> { name, named }`: `given`, else the last segment of `git remote get-url origin` (split on `/` and `:`, `.git` and a trailing slash removed), else the basename of `git rev-parse --show-toplevel`; normalized; throws an `Error` naming `--repo` when `reservedIn` is not null.
- Produces, in `tree.mjs`: `readRecords(root) -> (Record & { filename })[]`, over `hsdd/management/` entries that pass `isRecordFile`.

- [ ] **Step 1: Write the failing tests**

```js
test("render then parse keeps the header and the rows", () => { /* a Record with four rows, one per class */ });
test("a pipe in a subject becomes a slash", ...);
test("parseRecord reads CRLF", ...);
test("the filename", () => {
  assert.equal(recordFile({ today: "2026-11-05", repo: "acme-shop", to: "f8c1d07aabbcc" }), "hsdd/management/2026-11-05-sweep-acme-shop-f8c1d07.md");
  assert.equal(isRecordFile("2026-11-05-sweep-acme-shop-f8c1d07.md"), true);
  assert.equal(isRecordFile("2026-11-05-intake-sweep-fix.md"), false);
});
test("normalizeRepo and reservedIn", () => {
  assert.equal(normalizeRepo("Acme_Shop.v2"), "acme-shop-v2");
  assert.equal(reservedIn("intake-service"), "intake"); assert.equal(reservedIn("order-progress"), "progress"); assert.equal(reservedIn("acme-shop"), null);
});
test("repoName: --repo, then origin in both URL forms, then the directory", ...);
test("repoName refuses a reserved word and names --repo", () => assert.throws(() => repoName(root, "intake-service"), /--repo/));
test("newestRecord: the latest date, then the descendant; another repository is ignored", ...);
test("classifiedOf leaves out the record it is told to", ...);
test("readRecords leaves out an intake record whose slug says sweep", ...);
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): the sweep record`

---

### Task 4: The surface test

**Files:**
- Create: `skills/hsdd-intake/scripts/lib/surface.mjs`
- Test: `test/sweep-surface.test.mjs`

**Interfaces:**
- Consumes: `showAt` (Task 2); `routes`, `topics`, `migrations`, `schemas`; `excludedPath` from `walk.mjs`.
- Produces:
  - `surfaceOf(dir, files) -> { routes: Set, topics: Set, tables: Set, migrations: Set, schemas: Set }`. Keys: a route is `{METHOD} {path}`; a topic `produces {name}` or `consumes {name}`; a migration or schema is its path. File and line are never in a key.
  - `surfaceMoves(before, after, changed: string[]) -> string[]`, pure. Order: routes, topics, tables, migrations, schemas, contracts, each sorted. Wording: `route added|removed {key}`, `topic added|removed {key}`, `table added|removed {name}`, `migration added|changed|removed {path}`, `schema added|changed|removed {path}`, `contract changed {path}`. A migration or schema in both sides is `changed` when its path is in `changed`.
  - `commitMoves(root, commit, { tmp = tmpdir() } = {}) -> string[]`: one `mkdtempSync` under `tmp` with `before/` and `after/`; the commit's paths that `excludedPath` does not exclude, written from `showAt` against `commit.parents[0]` (nothing for a root commit) and `commit.sha`; `surfaceOf` on each side; `rmSync` in a `finally`. All paths of the commit are compared together, so a route moved between files is no move.

- [ ] **Step 1: Write the failing tests**

```js
test("surfaceMoves names additions and removals in order", ...);
const MOVES = { routeAdd: ["route added POST /payouts/preview"], schema: ["schema changed api/openapi.yaml"],
  migration: ["table added holds", "migration added src/web/migrations/V2__holds.sql"],
  alter: ["migration added src/web/migrations/V3__reason.sql"], topic: ["topic added produces payouts.settled"],
  removed: ["route removed DELETE /payouts/old"], contract: ["contract changed hsdd/contract/payouts-api.md"],
  copy: [], moved: [], spaced: [], log: [] };
for (const [key, want] of Object.entries(MOVES)) test(`commitMoves: ${key}`, () => assert.deepEqual(commitMoves(fx.root, commit(key)), want));
test("no temporary directory is left and the working tree is untouched", () => {
  const tmp = mkdtempSync(join(tmpdir(), "hsdd-sweep-t-")); commitMoves(fx.root, commit("routeAdd"), { tmp });
  assert.deepEqual(readdirSync(tmp), []); assert.equal(gitIn(fx.root, "status", "--porcelain"), "");
});
```

`commit(key)` finds the fixture commit in `rangeCommits(fx.root, fx.base, fx.shas.contract)`.

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `surface.mjs`**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): the sweep's surface test`

---

### Task 5: Setting aside and placement

**Files:**
- Create: `skills/hsdd-intake/scripts/lib/candidates.mjs`
- Test: `test/sweep-candidates.test.mjs`

**Interfaces:**
- Produces, all pure:
  - `isGovernancePath(path) -> boolean`: `hsdd` exactly (the gitlink), or under `hsdd/`, `hsdd-context/`, `openspec/`.
  - `phaseIdsIn(text, phaseIds) -> string[]`: boundary `(?<![\w.-])id(?![\w-]|\.\d)`.
  - `unknownIdsIn(text, nodeIds, phaseIds) -> string[]`: tokens `{node id}.{digits}` under the same boundary that `phaseIds` does not hold. Nothing else that looks dotted counts.
  - `setAside(commits, tree, classified: Map<sha7, filename>) -> Aside`, tests applied in §4.2's order. `Aside = { merges: string[], governance: string[], attributed: [{ sha, phases }], classified: [{ filename, shas }], unknown: [{ sha, id }], candidates: Commit[] }`; shas are seven characters. A commit with an unknown id stays a candidate and is also listed under `unknown`.
  - `asideLines(aside) -> string[]`: the five bullets of §5.2; an empty category reads `- merges: none`, `- governance-only: none`, `- attributed: none`, `- classified by: none`, `- unknown phase id: none`.
  - `place(commit, tree) -> { node: string|null, spans: string[] }`. Paths are the commit's less governance paths. `some` is the nodes covering at least one path, `all` those covering every path (a prefix `./` covers everything). When `all` is empty and `some` has two or more, `spans` is `some` sorted and `node` is null, whatever the trailer says. Otherwise an `HSDD-Node:` line (`/^HSDD-Node:\s*(\S+)\s*$/m`) naming an active node wins; otherwise `node` is the sole member of `all`, or null.

- [ ] **Step 1: Write the failing tests**

```js
test("phaseIdsIn is boundary-safe", () => { assert.deepEqual(phaseIdsIn("per acme.web.20", ["acme.web.2"]), []); assert.deepEqual(phaseIdsIn("acme.web.2: done.", ["acme.web.2"]), ["acme.web.2"]); });
test("unknownIdsIn ignores versions and file names", () => assert.deepEqual(unknownIdsIn("bump v1.2.3, per acme.web.20", ["acme.web"], ["acme.web.2"]), ["acme.web.20"]));
test("setAside on the fixture", () => {
  const a = setAside(commits, tree, new Map());
  assert.deepEqual(a.merges, [s7("merge")]); assert.deepEqual(a.governance, [s7("gov")]);
  assert.deepEqual(a.attributed.map((x) => x.sha), [s7("phaseSubject"), s7("phaseTrailer")]);
  assert.deepEqual(a.unknown, [{ sha: s7("unknownId"), id: "acme.web.20" }]);
  assert.ok(a.candidates.some((c) => c.sha === fx.shas.side), "a commit a merge brought in is a candidate");
  assert.ok(a.candidates.some((c) => c.sha === fx.shas.unknownId));
});
test("setAside groups classified commits by record", ...);
test("the gitlink alone is governance-only", () => assert.equal(isGovernancePath("hsdd"), true));
test("hsdd-contextual is not governance", () => assert.equal(isGovernancePath("hsdd-contextual/x.js"), false));
for each row of the fixture table: test(`place: ${key}`, ...);
test("a ./ scope and a narrower scope both covering gives null, not spans", ...);
test("partly unowned paths give null, not spans", ...);
test("asideLines reads none for an empty category", ...);
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `candidates.mjs`**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): the sweep sets aside and places`

---

### Task 6: `draft`

**Files:**
- Create: `skills/hsdd-intake/scripts/lib/draft.mjs`
- Modify: `skills/hsdd-intake/scripts/sweep.mjs`
- Test: `test/sweep-draft.test.mjs`, `test/sweep-cli.test.mjs` (append)

**Interfaces:**
- Produces, in `draft.mjs`:
  - `class Refusal extends Error`. `main` catches it, prints the message and returns 1.
  - `resolveRange(root, opts, records, git = runGit) -> Range`, `Range = { repo, named, main, from, to, fromNote }`. Refusals, in this order, before any commit is read: the main line resolves through `resolveCommit(main)`, else `origin/{main}`, else `/no branch/`; `--to` resolves and is an ancestor of the main line, else `/not on the main line/`; `--from` resolves, else `/not a commit/`; no `--from` and no record, `/first sweep .* --from/`; `--from` not an ancestor of `{to}`, `/not an ancestor of/`; a previous record exists and `--from` is neither its `to` nor an ancestor of it, `/leaves commits unswept/`.
  - `reasonOf(moves) -> string`: `moves[0]`, then `, +{n} more` when there are others.
  - `rowFor(commit, moves, placement) -> Row`, pure. Moves present: `cls: "intake"`, `reason: reasonOf(moves)`, `node` as below. No moves and `spans`: `cls: "intake"`, `reason: "spans a, b"`. Otherwise `cls` and `reason` are `?`. `node` is `none` with `spans`, else `placement.node ?? "?"`. `sha` is seven characters.
  - `draftFor(root, range, tree, classified, { tmp } = {}) -> { commits, aside, rows }`, one row per candidate, in range order.
  - `recordOf(range, today, runBy, draft) -> Record`: `runBy` is `?` when absent; `status: "open"`; `routing` and `produced` `["none"]`; `changeLog` one line, `- {today}: created; {k} candidates: ? log, ? retro, {i} intake, ? unplaced`.
- `main`, `draft`: flags per `USAGE`. A record of this repository with a `?` cell left refuses `/unfinished record/`, naming the file, before anything else. No candidates prints `no candidates: {n} commits, {m} merges, {g} governance-only, {a} attributed, {c} classified`, writes nothing, returns 0. A record of the same repository and `to` refuses `/already swept/`. Without `--write` prints the record. With it, writes and prints `wrote {path}` and `next: fill every ? in the record, then run check`.

- [ ] **Step 1: Write the failing tests**

```js
test("resolveRange: a first sweep with no --from is refused", () => assert.throws(() => range({}), /first sweep .* --from/));
test("resolveRange: --to off the main line", ...);       // a commit on an unmerged branch
test("resolveRange: an unknown --from", ...);            // /not a commit/
test("resolveRange: --from after --to", ...);            // /not an ancestor of/
test("resolveRange: the default --from is the newest record's to", ...);  // fromNote is `from {filename}`
test("resolveRange: a --from later than the previous record's to leaves a gap", ...);  // /leaves commits unswept/
test("resolveRange: a --from on a side branch the previous to does not contain leaves a gap", ...);
test("resolveRange: an ancestor --from is accepted", ...);
test("rowFor: move, spans, a move with spans, neither", ...);
test("reasonOf counts the rest", () => assert.equal(reasonOf(["a", "b", "c"]), "a, +2 more"));
test("draftFor over the fixture", () => {
  const d = draftFor(fx.root, { from: fx.base, to: fx.shas.contract }, tree, new Map());
  const row = (k) => d.rows.find((r) => r.sha === s7(k));
  assert.deepEqual([row("routeAdd").cls, row("routeAdd").reason, row("routeAdd").node], ["intake", "route added POST /payouts/preview", "acme.web"]);
  assert.deepEqual([row("schema").cls, row("schema").node], ["intake", "?"]);
  assert.equal(row("migration").reason, "table added holds, +1 more");
  assert.deepEqual([row("spans").cls, row("spans").reason, row("spans").node], ["intake", "spans acme.reports, acme.web", "none"]);
  assert.deepEqual([row("log").cls, row("log").reason, row("log").node], ["?", "?", "acme.web"]);
  assert.deepEqual([row("asBuilt").cls, row("asBuilt").node], ["?", "acme.reports"]);
  assert.equal(row("unowned").node, "?");
  assert.equal(d.rows.length, d.aside.candidates.length);
});
// cli
test("draft prints and writes nothing without --write", ...);
test("draft --write writes the record and tells the next step", ...);
test("a range of only set-aside commits writes nothing and exits 0 with the counts", ...);
test("a record with a ? cell left refuses the next draft and names the file", ...);
test("a draft whose --to already has a finished record is refused", ...);  // --from mid --to head, filled, then --from base --to head: /already swept/
test("a refusal exits 1", ...);
test("under the profile the pointer commit is governance-only and the record lands in the submodule", ...);
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `draft.mjs` and wire `draft` into `main`** (`--main` defaults to `main`)
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): sweep draft`

---

### Task 7: `check`

**Files:**
- Create: `skills/hsdd-intake/scripts/lib/check.mjs`
- Modify: `skills/hsdd-intake/scripts/sweep.mjs`, `test/helpers/sweep-fixture.mjs`
- Test: `test/sweep-check.test.mjs`, `test/sweep-cli.test.mjs` (append)

**Interfaces:**
- Produces, in `check.mjs`, all pure:
  - `handoffsOf(routing: string[]) -> [{ id, cls, target, prompts: string[] }]`: each `**H{n}** ({class}, {target}):` heading with the fenced `text` blocks up to the next heading.
  - `checkRecord(record, freshRows: Row[], tree) -> string[]`: one problem per refusal of §7.4, each naming the row's sha or the field. Empty means conformant. Rules beyond the obvious: `Class` is one of `log`, `retro`, `intake`, `unplaced`. A fresh `intake` row may read otherwise only when a change-log line matches `^- \d{4}-\d{2}-\d{2}: lowered {sha7} from intake to (log|retro) by .+: .+$`. `Node` may be `none` only on `intake` and `unplaced` rows. A `retro` row's node must not be as-built, nor of kind `internal` or `root`. `Run by` fails on empty, `?`, or any `{` or `}`. The first change-log line must match `created; {k} candidates: {l} log, {r} retro, {i} intake, {u} unplaced` with numbers equal to the table's counts. `Status` must be `open` or `closed (YYYY-MM-DD)` as §7.4 says.
- `main`, `check PATH`: refuses a path that fails `isRecordFile` or is absent; reads `readTree` and `readRecords`; runs `draftFor` over the header's `from` and `to` with `classifiedOf(records, repo, filename)`, so the record is not counted against itself, and passes its `rows`. Prints each problem and returns 1, or `ok: {path}` and returns 0. Writes nothing.
- Produces, in the fixture: `fillRecord(text, { rows: { [sha7]: { node, cls, reason } }, runBy, routing, status, lowered }) -> string`, standing in for the agent: replaces `?` cells, fills the change-log counts from the final table, and appends `lowered` lines.

- [ ] **Step 1: Write the failing tests**

```js
// good() parses a filled draft of the fixture range: `copy` is retro, the unplaceable rows unplaced, the rest log, and
// every intake and retro row has its handoff. problems(r) is checkRecord(r, freshRows, tree). The edit helpers are local.
test("handoffsOf reads a retro handoff's three prompts and an intake handoff's one", ...);
test("a conformant record passes", () => assert.deepEqual(problems(good()), []));
const REFUSALS = [
  ["a candidate with no row", (r) => dropRow(r, "log"), /no row/],
  ["a row with no candidate", (r) => addRow(r, "deadbee"), /no candidate/],
  ["a ? cell", (r) => set(r, "log", { cls: "?" }), /\?/],
  ["an unknown class", (r) => set(r, "log", { cls: "skip" }), /class/],
  ["a retro row with reason none", (r) => set(r, "copy", { reason: "none" }), /reason/],
  ["a script-set intake changed with no line", (r) => set(r, "routeAdd", { cls: "log", reason: "none" }), /lowered/],
  ["a log row's sha in a handoff", (r) => addToPrompt(r, s7("log")), /handoff/],
  ["a retro row with no handoff", (r) => dropHandoffs(r), /handoff/],
  ["a retro row on an as-built node", (r) => set(r, "asBuilt", { cls: "retro", reason: "x" }), /as-built/],
  ["a retro row on the root", (r) => set(r, "copy", { node: "acme" }), /internal|root/],
  ["a node outside the tree", (r) => set(r, "log", { node: "acme.nope" }), /not in the tree/],
  ["none on a log row", (r) => set(r, "log", { node: "none" }), /none/],
  ["an empty Run by", (r) => ({ ...r, runBy: "" }), /Run by/],
  ["a placeholder Run by", (r) => ({ ...r, runBy: "{person}" }), /Run by/],
  ["counts that disagree", (r) => miscount(r), /counts/],
  ["closed with a retro row", (r) => ({ ...r, status: "closed (2026-11-05)" }), /Status/],
];
for (const [name, edit, re] of REFUSALS) test(`check refuses ${name}`, () => assert.match(problems(edit(good())).join("\n"), re));
test("an all-log record must be closed", ...);
test("a script-set intake lowered with its line passes", ...);
// cli
test("check on a written record does not count it against itself", ...);
test("check prints problems, exits 1 and writes nothing", ...);
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `check.mjs`, `fillRecord` and wire `check`**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): sweep check`

---

### Task 8: `commit`, and the whole run

**Files:**
- Modify: `skills/hsdd-intake/scripts/lib/git.mjs`, `skills/hsdd-intake/scripts/sweep.mjs`
- Test: `test/sweep-cli.test.mjs` (append)

**Interfaces:**
- Produces, in `git.mjs`, with the behavior of the same names in `seal.mjs` and `scan.mjs`: `gitCwdFor(root, relPath) -> string`; `detachedCwds(root, paths, git) -> string[]`; `commitPaths(root, paths, message, git) -> string[]`, which stages and commits only `paths` and bumps the pointer as `{message} (pointer)`.
- `main`, `commit PATH`: runs `check` and returns 1 on any problem; refuses a detached submodule with a message naming it, returns 1, commits nothing; commits the record alone as `sweep: {repo} {from7}..{to7}`; prints `committed on {branch}`, and `note: {branch} is not {main}; the next sweep reads records from wherever this lands` when they differ. Never pushes.

- [ ] **Step 1: Write the failing tests**

```js
test("commit: the record alone, with the message, unrelated staged files left staged", ...);
test("commit refuses a record check refuses", ...);
test("under the profile it commits inside the submodule and bumps the pointer", () => {
  /* sweepProfileRepo; draft, fill, commit */
  assert.equal(gitIn(join(p.root, "hsdd"), "log", "-1", "--format=%s"), `sweep: ${repo} ${from7}..${to7}`);
  assert.equal(gitIn(p.root, "log", "-1", "--format=%s"), `sweep: ${repo} ${from7}..${to7} (pointer)`);
});
test("a detached submodule is refused and nothing is committed", ...);
test("the whole run: draft, fill, check, commit, then the next draft starts where this one ended", () => {
  /* sweepRepo; draft --from base --to contract --write; fillRecord; check 0; commit 0.
     draft with no --from prints no candidates (its from is the record's to).
     A new commit on main; draft --write; its Range line says `from {first filename}`, and it has one row. */
});
test("the overlap of an earlier --from lands under classified by", ...);
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `node --test test/*.test.mjs` to verify everything passes**
- [ ] **Step 5: Commit** `feat(hsdd-intake): sweep commit`

---

### Task 9: Skill text: `manual`, the mode, `sweep.md`

**Files:**
- Create: `skills/hsdd-intake/sweep.md`
- Modify: `skills/hsdd-intake/SKILL.md`, `commands/hsdd-intake.md`
- Test: `test/sweep-skill-text.test.mjs`

**Interfaces, `SKILL.md`** (no step is renumbered; the tests in `test/auto-unattended-sections.test.mjs` must stay green, so `ticket | incident | braindump` stays contiguous and `## Unattended runs` stays directly before `## Quality Gates`):
- Front matter: the description adds the sweep and two triggers, "is this small enough to skip a phase" and "sweep the merged fixes".
- A new `## Two modes` section before `## Inputs`, at most 40 lines: request mode and sweep mode in one table each with its tense; selection per §7.2; "Read `sweep.md` beside this file and follow it; the rest of this file is request mode."
- Inputs: the authority list ends `braindump | commit`, with one sentence: a `commit` request is `{repo}@{sha}`, already shipped, and its phases are retro phases.
- Step 4's table gains §3.1's row, its first two cells verbatim. After the table, a paragraph `**A \`manual\` answer writes nothing.**` stating the two tests on the request as described, that doubt is not `manual`, that `commit` is never `manual`, that it does not exist before launch, that an as-built landing is not promoted for it, and the four things of §3.2 the report names. It says that steps 5 and 6 do not apply.
- Unattended table gains, exactly: ``| A request that would be class `manual` | decide: route it `local`; `manual` is not an unattended class (spec v0.13 §3.4) | `judgement` |``
- Quality gate added: `- [ ] A \`manual\` answer wrote nothing under \`hsdd/\` and named the node and the trailer; a request the description could not settle was not \`manual\`.`
- Anti-rationalization row added: `| "It's probably small; I'll say manual" | Doubt is not manual. The phase is the safe answer, and the sweep can still find later that the diff stayed below the line. |`

**Interfaces, `sweep.md`** (under 200 lines), sections in order:
1. `# HSDD Intake: Sweep Mode`, with the core principle: the script owns the record's structure, the agent answers one bounded question per commit.
2. `## When it applies` (§4.1).
3. `## Setup`: copy this skill's `scripts/` verbatim to `hsdd/scripts/sweep/`, Node 20, run from the implementation repo's root; each repository under the profile is swept on its own.
4. `## Procedure`: `draft --write`; fill every `?` (placement order of §4.4, then the claim test, the `Run by` line, the change-log counts); write `## Routing`; `check` until it passes; `commit`; run the handoffs in order or hand the prompts over; report the record's path, the counts, what is `unplaced`, and the handoffs not run. A published record is edited only as §5.3 says.
5. `## The claim test`: §4.3's closure list, the examples, the as-built rule, raising, and the lowering line's exact form.
6. `## Handoff prompts`: the three fenced prompts of chapter 6 verbatim, and `/hsdd-reconcile {node}`.
7. `## Quality Gates`: checkboxes for every candidate having a row, no class lowered by the agent, a claim named by location on every `retro` row, no `retro` on an as-built node, `check` passed before `commit`.
8. `## Anti-Rationalization`, first row `| "This change isn't worth recording" | ...`, then rows for "I'll skip the record, nothing staled", "the classifier is wrong, I'll change that intake to log", and "I'll guess the node".

- [ ] **Step 1: Write the failing tests**

```js
const SPEC = read("spec/hsdd-spec-v0_13.md"), SKILL = read("skills/hsdd-intake/SKILL.md"), SWEEP = read("skills/hsdd-intake/sweep.md");
test("the manual row carries the spec's words", () => {
  const row = SPEC.split("\n").find((l) => l.startsWith("| `manual` |"));
  const [, cls, means] = row.split("|");
  assert.ok(SKILL.includes(`|${cls}|${means}|`));
  assert.ok(SKILL.includes("**no skill, no record**"));
});
test("the mode section is at most 40 lines, names sweep.md and selects by the first argument", ...);
test("the authority list ends in commit", () => assert.ok(norm(SKILL).includes("ticket | incident | braindump | commit")));
test("the unattended row", ...); test("the quality gate and the anti-rationalization row", ...);
test("sweep.md is under 200 lines, its sections in order", ...);
test("sweep.md carries chapter 6's prompts verbatim", () => {
  const ch6 = SPEC.slice(SPEC.indexOf("## 6. Handoffs"), SPEC.indexOf("## 7. The Mode"));
  const blocks = [...ch6.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => norm(m[1]));
  assert.equal(blocks.length, 3);
  for (const b of blocks) assert.ok(norm(SWEEP).includes(b));
});
test("the first anti-rationalization row is the worth judgment", ...);
test("every sweep.mjs command the texts name is one the script accepts", () => {
  /* extract `node hsdd/scripts/sweep/sweep.mjs ...` from spans and fences of SKILL and SWEEP;
     the subcommand is draft, check or commit; each --flag appears in USAGE */
  assert.ok(commands.length >= 3);
});
test("the slash command names both modes and delegates in one line", ...);
test("no em dash and no banned phrase in sweep.md or the new section", ...);
```

- [ ] **Step 2: Run to verify they fail** (`node --test test/sweep-skill-text.test.mjs test/auto-unattended-sections.test.mjs`)
- [ ] **Step 3: Write the texts.** `commands/hsdd-intake.md`'s description names routing a change request and sweeping shipped commits; its body reads `Use the hsdd-intake skill for: $ARGUMENTS`
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `feat(hsdd-intake): the manual class and the sweep mode in the skill text`

---

### Task 10: The checkpoint, phase planning, the conventions template

**Files:**
- Modify: `skills/hsdd-checkpoint/SKILL.md`, `skills/hsdd-phase-plan/SKILL.md`, `skills/hsdd-spec/templates/conventions.md`
- Test: `test/sweep-skill-text.test.mjs` (append)

**Interfaces, `hsdd-checkpoint`:**
- The management-file list before the chain rules gains: ``- `hsdd/management/YYYY-MM-DD-sweep-{repo}-{to7}.md`: `hsdd-intake`'s sweep mode writes it (spec v0.13 chapter 5); outside the chain rules below, like intake records; this skill only appends to its `## Produced`, ticks its `**Status:**` and appends to its change log``
- *Code vs plan*: the scope-creep clause through "marked retroactive." is replaced by chapter 8's first bullet, up to the escalation sentence, which stays. It must contain "a commit trailer attributes nothing on its own" and "`/hsdd-intake sweep --from {sha}`, never a retro phase per commit".
- A new `*Sweep records:*` bullet after *Intake records*, carrying the rest of chapter 8's first bullet: products appended, closure by spec v0.13 §5.4, the findings (an `unplaced` row, a record open two checkpoints with a handoff not landed, a sha two records classify, a gap between consecutive records), delegated runs joining the delegated sign-offs' finding, and a `## Manual lane (project convention)` paragraph in `conventions.md` filed as a finding whose step removes it.
- The quality gate on backfill reads: `- [ ] Post-launch code with no phase and no sweep row is one backfill finding per repository whose plan step is a sweep over the unswept range; a backfill carried two reports escalates.`

**Interfaces, `hsdd-phase-plan`.** The retro-phase rule in Append Mode reads:

> A **retro phase** (a backfill for code that shipped with no phase) is marked `(retro)` in its name, cites in its Scope the finding id, the sweep record, or the intake record of authority `commit` it came from, and its verification doc is written after the fact and marked retroactive. From a sweep record it lists each commit's sha with the claim it staled: one retro phase per node per record, never one per commit, review tier gate-only unless the prompt says otherwise, and the sizing ceiling does not apply, since it records work already done (spec v0.13 §6.1). Never plan one on an as-built node.

**Interfaces, the conventions template:** the layout gains ``- `hsdd/scripts/sweep/`                       sweep script (copied verbatim from hsdd-intake; present only in swept trees)`` after the seal line; the `hsdd/management/` line's `hsdd-intake (intake records)` becomes `hsdd-intake (intake and sweep records)`; "List the implementation repos here (lane + repo name)." gains "Name each by the last path segment of its `origin` remote, the name sweep records use."

- [ ] **Step 1: Write the failing tests** (`norm(text).includes(...)` on each quoted string above; plus: the old "its plan step appends a retro phase to the owning node's plan" is gone from the checkpoint; the management-list string `and \`hsdd-auto\`'s report step, for an intake record's \`## Produced\`` is still in the template)
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Edit the three files**
- [ ] **Step 4: Run `node --test test/*.test.mjs` to verify everything passes**
- [ ] **Step 5: Commit** `feat(hsdd-intake): the checkpoint reads sweep records; retro phases over several commits`

---

### Task 11: Documentation

**Files:**
- Modify: `docs/users-guide.md`, `README.md`, `CHANGELOG.md`, `docs/guide/guide.js`, `docs/guide/README.md`
- Test: `test/sweep-skill-text.test.mjs` (append)

**Interfaces:**
- `docs/users-guide.md`:
  - "Outside the loop" intro: two of the four situations run on the skills as they are, the third is intake's `manual` class and sweep mode, the fourth is `hsdd-seal`.
  - "Small fixes and small requests on a launched system" rewritten over the two tenses. Keep the opening's dividing line and the **Which node?** prompt, since §4.4 cites it. Then: **Ask first** (a `/hsdd-intake route` example answered `manual`, with the trailer); **A request above the line** (the existing PAY-412 flow, unchanged); **Already made** (`/hsdd-intake sweep --run-by "..."`, a filled table with one row per class, what each class costs, and one range rather than one per problem); **Who runs it** (a developer after merging, a lead before a checkpoint, `--run-by "Claude for {person} (delegated)"` when nobody reads the record). Remove both retro-phase prompts and the `## Manual lane (project convention)` block; keep the checkpoint cadence sentence.
  - `## Upgrading` gains `### From 0.12.0 to 0.13.0` from §9.1, including: remove the `## Manual lane` paragraph if you added it.
- `README.md`: the `hsdd-intake` row names both modes; the fenced block after the workflow steps gains `hsdd-intake sweep (after launch) -> attributes shipped commits, one row each`; a `## Small changes after launch` section before `## Sealing a released tree`, one paragraph; the documents list gains the v0.13 specification. The count stays thirteen.
- `CHANGELOG.md`: `## [0.13.0] - Unreleased` above `## [0.12.0]`, with Specification, Upgrading from 0.12.0 (§9.1), Added (`manual`, sweep mode, the record, the `commit` authority) and Changed (the checkpoint's backfill step, retro phases over several commits, the scripts rule).
- `docs/guide/guide.js`: the `hsdd-intake` skill-map row (line 232) describes both modes; `CLASSES` gains `["manual", "after launch, moves no surface and stales no claim", "no record: a node and a trailer; the sweep attributes the commit"]`. `docs/guide/README.md`'s chapter 7 row mentions small changes.

- [ ] **Step 1: Write the failing tests** (the README row and thirteen count; `### From 0.12.0 to 0.13.0`; `## Manual lane` absent from the guide; `HSDD-Kind` absent from the guide; the **Which node?** prompt still present; the changelog heading; `guide.js` has the `manual` row)
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Write the documentation**
- [ ] **Step 4: Verify** `node --check docs/guide/guide.js` exits 0, the diff adds no em dash, and `node --test test/*.test.mjs` passes
- [ ] **Step 5: Commit** `docs(hsdd-intake): the two tenses in the guide, README and changelog`
- [ ] **Step 6: Rebuild the docs site** from `~/git/mpurbo.github.io` per its `README.md`, with `node tools/build-hsdd.mjs --src ../hsdd --ref feat/hsdd-sweep`, and commit there. The skill list needs no new group; pushing that repo stays the owner's.

---

## Not in this plan

- **Live acceptance (§12.3)** needs a launched tree and a person. It is the owner's, after the branch merges.
- **`hsdd-auto` changes.** None: `manual` is a decision inside the intake step (§3.4), and a `sweep` step kind is deferred (§11.2).
