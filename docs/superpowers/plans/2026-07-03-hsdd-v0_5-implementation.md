# HSDD v0.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement everything in `spec/hsdd-spec-v0_5.md`: the `hsdd` CLI (registry, context, lint, status, rename, check-scope), the machine-readable artifact model in the skills, two new skills (`hsdd-review`, `hsdd-adopt`), new/updated slash commands, the claims rewrite across README/guide/templates, tests, and a maintainer's guide.

**Architecture:** The CLI is a zero-dependency Node (>= 20) package at `cli/` with a pure core (parsers, projections, lint checks, splice, glob) and a thin imperative shell (`bin/hsdd.mjs` + fs/git access in `src/model.mjs` and command handlers). Every command is a pure function of repository state. Skills shrink to judgment and delegate all mechanics to the CLI.

**Tech Stack:** Node >= 20, ESM (`.mjs`), `node:test` runner, zero runtime dependencies.

## Global Constraints

- CLI package is zero-dependency; Node `>= 20` (`engines` in package.json).
- Every command is deterministic: no timestamps in generated registries, no model calls, no guessing; unresolvable input is a hard error naming the skill that owns the fix.
- `hsdd lint` exit codes: 0 clean, 1 errors, 2 warnings-only.
- A field lives in exactly one place: machine-read fields in frontmatter (or the normative phase block); derivable fields are never authored.
- `produced_by`/`consumers` are removed from contract frontmatter; registry derives them.
- Contract `stable` requires at least one of `schema`/`fixtures` and the paths must exist.
- Markers for the config splice are literal: `<!-- hsdd:phase-context:begin -->` / `<!-- hsdd:phase-context:end -->`; only the marked region is replaced.
- `hsdd rename` never rewrites `openspec/changes/`.
- Conventions defaults: `specs_dir: docs/spec`, `verify_dir: docs/verify`, `contracts_dir: contracts`, `adr_dir: adr`, `openspec_dir: openspec`, `ordering_policy: interfaces-first`, `profile: single-team`.
- Avoid em-dash in all authored prose (user's global rule).

---

### Task 1: CLI scaffolding + frontmatter parser

**Files:**
- Create: `cli/package.json`, `cli/bin/hsdd.mjs` (stub dispatch), `cli/src/frontmatter.mjs`
- Test: `cli/test/frontmatter.test.mjs`

**Interfaces:**
- Produces: `parseFrontmatter(text) -> {data: object, body: string} | null` (null when no frontmatter); handles scalars, inline `[a, b]` lists, block `- item` lists, quoted strings, trailing `# comments`.
- Produces: `parseIdVersion("auth-token@v1") -> {id: "auth-token", version: "v1"}` (version null when absent).

Steps: write tests for scalar/list/comment/absent-frontmatter cases; implement (port + extend gen-registry.mjs parser to also return body); `node --test cli/test/` passes; commit.

### Task 2: Section extraction + phase-block grammar

**Files:**
- Create: `cli/src/sections.mjs`, `cli/src/phase-block.mjs`
- Test: `cli/test/phase-block.test.mjs`

**Interfaces:**
- `extractSection(md, title)` returns the body of `## {title}` up to the next `##` heading (null if absent).
- `parsePhaseBlocks(nodeId, body)` returns `{phases, errors}`. A phase heading is `### {nodeId}.{n}: {Name}`. Fields are `**Label:** value` lines with indented continuations. Required: Consumes, Produces, Scope, Size estimate, Gate, Verification, Review tier, Dependencies. Optional: Governed by, Touches. Review tier must be one of `gate-only|spot-check|full-review`. List-valued fields parse `[a, b]`. Errors name the missing/invalid field and the phase id.

Steps: tests (valid block, missing field, bad tier, optional Touches, continuation lines, non-sequential numbers detected by caller); implement; pass; commit.

### Task 3: Project model loader

**Files:**
- Create: `cli/src/model.mjs`
- Test: `cli/test/model.test.mjs` (+ `cli/test/helpers.mjs` fixture builder writing a temp project tree)

**Interfaces:**
- `DEFAULT_CONVENTIONS` (values in Global Constraints).
- `loadProject(root) -> model` with: `conventions`, `nodes` (frontmattered specs incl. parsed phases for leaf-parents), `legacyNodes`/`legacyContracts`/`legacyAdrs` (v0.3-shape files, for migration warnings), `contracts`, `adrs`, `changes` (`{name, phaseId, archived}` from `openspec/changes/` and `openspec/changes/archive/`; `Phase:` line in proposal.md is authoritative, hyphenated dir name is fallback), `verifications` (`{phaseId, file, hasGateEvidence, signedOff, learnings: [{text, dispositioned}], metrics}`), raw INDEX texts.
- Verification parsing rules (deterministic, documented): gate evidence = non-empty `## Test evidence` section; signed off = a line with `reviewed by` + non-placeholder value, or a `PR:` line containing `merged`; learning entry = top-level `- ` bullet in `## Learnings`; dispositioned = contains `disposition:`; `- none`/`- no learnings` counts as dispositioned.

Steps: fixture builder; tests; implement; pass; commit.

### Task 4: `hsdd registry`

**Files:**
- Create: `cli/src/registry.mjs`; wire into `cli/bin/hsdd.mjs`
- Test: `cli/test/registry.test.mjs`

**Interfaces:**
- `projectContracts(model) -> string|null`, `projectAdrs(model) -> string|null`; header line `<!-- generated by hsdd registry - do not edit by hand -->`.
- Contract `owner` column derived from the node/phase that lists the contract under `produces` (phase producers roll up to their leaf-parent node); falls back to frontmatter `owner`. `consumers` column = sorted node/phase ids whose `consumes` reference the contract id.

Steps: tests (derived owner/consumers, empty dirs, determinism: run twice diff-free); implement; pass; commit.

### Task 5: `hsdd context`

**Files:**
- Create: `cli/src/context.mjs`; wire subcommand `hsdd context <phase-id> [--write|--stdout]`
- Test: `cli/test/context.test.mjs`

**Interfaces:**
- `buildPhaseContext(model, phaseId) -> {ok, artifact, warnings, errors}`. Artifact sections: `## Current Phase: {id}: {name}` (phase block verbatim), `## Contracts from Prior Phases / Nodes` (per consumed contract: `### {id}@{version}` + only Interface + Guarantees/invariants), `## Governing Decisions` (ADRs from phase `Governed by` plus consumed contracts' `governed_by`; only `status: accepted`; only Decision + Consequences).
- Failure modes exactly per spec 3.3 table: unknown phase/unparseable block = error naming file + grammar; missing contract = error "author it with hsdd-contract"; missing ADR = error "author it with hsdd-adr"; proposed ADR = excluded + warning; draft contract = warning.
- `spliceConfig(configText, artifact) -> {ok, text, error}`: replace only lines between the literal markers, preserving marker indentation; error if markers missing (naming hsdd-config as the fix owner), duplicated, or out of order.

Steps: tests for artifact assembly, every failure mode, splice (indent preserved, rules untouched, missing markers); implement; pass; commit.

### Task 6: `hsdd lint`

**Files:**
- Create: `cli/src/lint.mjs`; wire `hsdd lint [--strict] [--profile <name>]`
- Test: `cli/test/lint.test.mjs`

**Interfaces:**
- `lint(model, {strict, profile}) -> {errors, warnings}` implementing checks 1-13 of spec 3.4 plus the multi-team profile rules of 13.1-13.3 (team required per node; contract bump to stable blocked until every derived cross-team consumer has an `Acked-by: <team> (...)` line in `## Versioning`; ADR spanning teams needs each team in `## Approvals` before `accepted`).
- Check 10 reading: verification doc with no change at all = error; change exists but not archived = warning (in-progress notes are legitimate per spec 6.2).
- Check 11: regenerate-and-diff both INDEX files.
- Exit codes 0/1/2 in the bin handler.

Steps: one test per check (positive + negative); implement; pass; commit.

### Task 7: `hsdd status`

**Files:**
- Create: `cli/src/status.mjs`; wire `hsdd status [node-id] [--write]`
- Test: `cli/test/status.test.mjs`

**Interfaces:**
- `deriveStatus(model, nodeId?) -> rows` with states `planned|in-progress|built|verified|approved` per spec 7.1 (linked change exists -> in-progress; archived -> built; verification doc with gate evidence -> verified; sign-off -> approved). Node rollup: `planned` until any child starts, `done` when all approved, else `in-progress`.
- `renderStatusMd(model, rows)` emits `docs/STATUS.md` with the generated header and a `## Metrics` aggregation of whatever `## Metrics` blocks exist in verification docs.

Steps: tests for each state transition + rollup + metrics aggregation; implement; pass; commit.

### Task 8: `hsdd check-scope`

**Files:**
- Create: `cli/src/scope.mjs`; wire `hsdd check-scope <phase-id> [--base <ref>]`
- Test: `cli/test/scope.test.mjs`

**Interfaces:**
- `globToRegExp(glob)`: `**` crosses segments, `*` within a segment, `?` one char; `src/auth/**` matches everything under `src/auth/`.
- `partitionScope(touches, files) -> {inScope, outOfScope}`.
- Shell: changed files = `git diff --name-only <base>` + `git diff --name-only --cached` + untracked (`git ls-files --others --exclude-standard`); default base = merge-base with origin/HEAD -> main -> master, else HEAD. No `Touches` on the phase: print note, exit 0. Out-of-scope files: list them, exit 1.

Steps: glob unit tests; partition tests; end-to-end test in a temp git repo; implement; pass; commit.

### Task 9: `hsdd rename`

**Files:**
- Create: `cli/src/rename.mjs`; wire `hsdd rename <old-node-id> <new-node-id>`
- Test: `cli/test/rename.test.mjs`

**Interfaces:**
- `planRename(model, oldId, newId) -> {fileMoves, contentEdits, errors}`. Id-boundary-aware replacement (a dot after the id is a descendant and is rewritten; a preceding dot or word char means suffix of a longer id and is not). Rewrites: spec filenames + frontmatter + phase headings, contract `owner`, ADR `affects`, verification-doc filenames, and references inside `docs/` + `contracts/` + `adr/`. Never touches `openspec/changes/`. Appends `- {old} -> {new} ({YYYY-MM-DD})` to `docs/renames.md` (created with a header if absent). Then runs registry + lint and reports.

Steps: tests (descendant rewrite, no-false-positive on `authx`/`foo.acme...`, archive untouched, ledger appended); implement; pass; commit.

### Task 10: CLI end-to-end + help/version

**Files:**
- Modify: `cli/bin/hsdd.mjs` (final dispatch, `--help`, `--version`, `--root`)
- Test: `cli/test/cli.test.mjs` (spawn the bin against a full fixture project)

Steps: e2e tests: `registry` writes both INDEXes; `context --write` splices; `lint` exit codes 0/1/2; `status` table; unknown command exits 1 with usage; pass; commit.

### Task 11: Skill updates (existing five)

**Files:**
- Modify: `skills/hsdd-spec/SKILL.md` (frontmattered node spec template per spec 2.1, integration-node rule 5.3, boundary corrections -> `hsdd rename` 6.3)
- Modify: `skills/hsdd-contract/SKILL.md` (drop produced_by/consumers, schema/fixtures required for stable 5.1, gates run the contract 5.2, `npx hsdd registry`, retire verbatim-copy prose, mid-phase renegotiation 6.2)
- Delete: `skills/hsdd-contract/scripts/gen-registry.mjs` (absorbed by CLI)
- Modify: `skills/hsdd-adr/SKILL.md` (registry via CLI, consistency checks in `hsdd lint`, bootstrap-gap prose removed, multi-team `## Approvals`)
- Modify: `skills/hsdd-phase-plan/SKILL.md` (ordering policy 11, normative phase block + Touches 2.2/8.2, contract-verification gates 5.2, leverage tier rule 9.3, PE redefinition 10)
- Modify: `skills/hsdd-config/SKILL.md` (shrinks to init + engine adapter; markers in config template; `Phase:` proposal rule 7.2; phase switch = `hsdd context`)
- Modify: `skills/hsdd-spec/templates/conventions.md` (frontmatter 2.4, layout additions 15.3, PE wording, worktree rule 4.2, CLI install)

Steps: rewrite each per spec sections cited; commit per skill.

### Task 12: New skills + slash commands

**Files:**
- Create: `skills/hsdd-review/SKILL.md` (spec 9.1: per-tier checklists, learnings dispositions 6.1, sign-off via PR or signed line 9.2)
- Create: `skills/hsdd-adopt/SKILL.md` (spec 12: archaeology, as-built specs, contracts from seams, lazy tree, rules 12.2)
- Create: `commands/hsdd-new.md` (spec 4.1/7.2), `commands/hsdd-review.md`
- Modify: `commands/hsdd-phase.md` (delegates to `hsdd context --write`)

Steps: author; commit.

### Task 13: Docs, claims rewrite, changelog, maintainer guide

**Files:**
- Modify: `README.md` (claims table 8.1 verbatim replacements, PE 10, install section gains the CLI, skill table gains hsdd-review/hsdd-adopt/CLI row, v0.5 link)
- Modify: `docs/users-guide.md` (claims, "review sitting" wording, `npx hsdd` commands, `/hsdd-new` flow, linkcheck.1 and acme phase 1 -> `spot-check` per 9.3, layout additions, learnings/review/status steps)
- Modify: `CHANGELOG.md` (0.5.0 entry, 2026-07-03)
- Create: `docs/maintainers-guide.md` (repo map, running CLI tests, npm publish procedure for `hsdd`, release/tagging, changelog discipline, how to add a lint check, skills distribution)

Steps: edit; self-review against spec 8.1/9.3/10/15; commit.

### Task 14: Full verification pass

Steps: `node --test cli/test/` green; build a scratch demo project and run every command against it end-to-end (registry, context --stdout/--write, lint clean + seeded violations, status, check-scope in a git repo, rename); `npm pack --dry-run` sanity; fix anything found; commit.

## Self-Review Notes

- Spec coverage: sections 2 (Tasks 1-3, 11), 3 (4-10), 4 (5, 11, 12), 5 (6, 11), 6 (3, 6, 11, 12), 7 (3, 7), 8 (8, 11, 13), 9 (12, 13), 10 (11, 13), 11 (11), 12 (12), 13 (6, 11, 12), 14 (7, 12, 13), 15 (11, 12, 13), 18 (all). Section 14.2 case study and v1.0 consolidation are v1.0 release criteria, out of scope for this implementation by the spec's own plan.
- Publishing itself needs npm credentials; the maintainer guide documents the procedure instead of performing it.
