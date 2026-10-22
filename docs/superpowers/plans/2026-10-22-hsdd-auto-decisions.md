# hsdd-auto (v0.11.0) build decisions

Decisions taken while building `hsdd-auto` from `spec/hsdd-spec-v0_11.md`,
without stopping to ask the owner. Each row gives the decision, the
confidence, and the grounding. Where confidence was medium or low, the
alternative that was considered (and, where it was worth it, tried) is
named with the reason it lost. The owner reviews this file in one sitting
after the build, the same way a segment report is reviewed.

Plan: `docs/superpowers/plans/2026-10-22-hsdd-auto.md`.

## Process

| ID | Decision | Confidence | Grounding |
|----|----------|------------|-----------|
| P-1 | Build on `feat/hsdd-auto` in place, no worktree; push to origin after every task commit. | high | The branch exists, is clean and holds only the spec commit; the owner's standing rule is to push early because a working copy was once lost mid-session. |
| P-2 | Execution is subagent-driven: one fresh implementer per task, a spec-compliance review and a code-quality review per task, a whole-branch review at the end. | high | The owner asked for superpowers' subagent-driven development. |
| P-3 | `spec/hsdd-spec-v0_11.md` stays a delta; `spec/hsdd-spec-v0_10.md` is not edited. The edits §15.3 lists against v0.10.0's text are carried by the delta itself; the ones that land in skills or templates (conventions template writer line, the six skills) are applied. | high | v0.7.1, the previous delta release, left its base specification untouched; the delta's own header says "Read it against v0.10.0; only the changes are stated here". |
| P-4 | Live acceptance (§17.2) is written as expectations with empty `Result:` fields for the owner's cold-context run; the builder's evidence is a script-level end-to-end simulation (Task 17) that drives every script through plan, stop, procedural stop, intake, rework and interruption paths with a scripted stand-in for the step subagent. | medium | v0.10's acceptance precedent (the owner runs it cold). Alternative: run scenario 1 live from this session. It lost because a step subagent must invoke the HSDD skills through the host's Skill tool, which only sees skills installed when the session started; a live run here would test a fallback (reading `SKILL.md` by path), not the shipped path. Revisited at the end of the build (see B-rows). |

## Architecture

| ID | Decision | Confidence | Grounding |
|----|----------|------------|-----------|
| A-1 | `scripts/lib/` holds more modules than §4.1 lists: `kinds.mjs` (the §7.1 table, §7.3 write sets, stop classes), `config.mjs`, `records.mjs`, `context.mjs` (one snapshot of repository state), `tree.mjs` and `intake.mjs` (artifact parsers), `checks.mjs` (C2 to C8 as pure functions), `registry.mjs` (C0, C1), `render.mjs` (slots). | high | §4.1 calls `lib/` "shared modules" and lists examples; the owner's functional-first rule (pure core, imperative shell) needs one place that reads the repository and pure functions over the snapshot. Every script still uses only Node's standard library and nothing outside `scripts/`. |
| A-2 | The repository root is `process.cwd()`; templates and schemas are found relative to each script's own file. | high | §10: "Every script runs from the repository root". Resolving assets by `import.meta.url` makes the installed skill's copy and the project's copy behave the same (§4.3). |
| A-3 | No clock override exists, not even for tests. Window checks are tested by writing stale timestamps into records or by `utimesSync` on the lock file. | high | §6.1 "Times are taken, never typed"; an environment variable that sets the clock would be a typing channel an agent could use. |
| A-4 | A step "has its judgement commit" when its run line is present in `HEAD:hsdd/judgement/run.jsonl`; no search of commit subjects. | high | Content-based detection survives a `commit.*` prefix change between segments (a `setup` decision may change it) and needs one `git show`. Alternative: `git log --format=%s` for `{judgement}: {step}`; rejected because old commits keep old prefixes. |
| A-5 | HSDD artifacts (specs, contracts, ADRs, intake records) are parsed leniently, the way `gen-registry.mjs` and `hsdd-summary` already parse them; run records (`run.yaml`, dispatch front matter, JSONL) are parsed strictly by the YAML subset and the schemas. | high | Artifacts are written by skills and people under v0.10.0's formats, which the subset was never meant to cover; records are written by the scripts, so strictness catches the scripts' own defects. |
| A-6 | The YAML subset accepts nested block constructs, including a block sequence whose items are compact block mappings (`- path: x` / `  cite: Spec`). | medium | §5.2 lists "block mappings; block sequences" and names what is excluded (anchors, aliases, tags, multi-line scalars, multiple documents, tabs); nesting is not on the excluded list, and owners write sources this way. Alternative: flow-only items; rejected as a trap for hand-written files. |
| A-7 | Steps the spec gives to the orchestrator but that have one right answer are scripted as additive `state.mjs` subcommands: `preflight` (§8.1 item 2 refusals), `snapshot` (§6.10) and `install-scripts` (§4.3 copy, plus `gen-registry.mjs` from `hsdd-contract`). `open-segment` runs `preflight` first. | medium | §3.2: scripts do "every part of the work that has one right answer". Alternative: a new `setup.mjs`; rejected because §4.1 fixes the script list, and subcommands of an existing script deviate less. Alternative: leave them to the orchestrator's hands; rejected because hashing and byte-identical copying are exactly what FT-3 got wrong by hand. |
| A-8 | `dispatch.mjs` builds every step's write set and the gate reads it from the dispatch file only (§10.6); `lib/kinds.mjs` is the single definition of the §7.3 table. | high | One table, two readers, no drift (FT-3 patched its gate twice). |

## Semantics the spec leaves open

| ID | Decision | Confidence | Grounding |
|----|----------|------------|-----------|
| S-1 | The done definition's "every cited id resolves" and "the registries regenerate clean" use the final gate's scope: a failure counts only when its file changed during the segment; otherwise it is a warning in the report. | medium | §10.6 makes pre-existing defects warnings in both gates, and F1 requires the done definition. An unscoped done would make F1 fail on a defect the same final gate reports as a warning, and an intake into an imperfect tree could never finish. Alternative: unscoped done; rejected for that contradiction. |
| S-2 | Contracts at `status: deprecated` or `retired` are exempt from "every contract above `v0` is `stable` with `phase_ids: final`"; nodes with `- **Status:** retired` are never candidates for stages 5 and 6 and are not in align's `all`. | high | v0.10.0's lifecycle (`draft → stable → deprecated → retired`) and its retirement rule; a retired thing is never planned again. |
| S-3 | A contract reference marked `(ext)` still needs a contract file in stage 4. | medium | §9.1 stage 4: "one `contract` per contract slug a spec names that has no file". The test tree of v0.10 keeps a file for its external contract. |
| S-4 | `next.mjs` evaluates the stages from the top on every call and acts on the first unfinished one, so stages 3 and 4 run again right after each `mid-level-spec` names new ADRs or contracts. | high | §9.1: "A stage is done when its condition holds, so a plan segment on a partly planned tree starts at its first unfinished stage", and "stages 3 and 4 then apply again". |
| S-5 | Each paragraph under `plan.md`'s `## Segments` opens with the bold segment id, `**{segment id}.**`, followed by the purpose sentence; `{segment_context}` quotes that sentence. | high | Appendix B needs to find "the first sentence of its paragraph"; a fixed opener makes that mechanical. |
| S-6 | `commit.mjs` writes the `plan.md` skeleton (`# Run plan: {run}`, `## Segments`, `## Step log`, `## Change log`) when the file is missing. | high | The first `setup` step commits before any `plan` step exists, and §6.9 says the step log is regenerated at every judgement commit. |
| S-7 | `report.mjs` makes the intake record's `## Produced` append (contracts bumped, ADRs amended, nodes grafted, one change-log line), idempotently. | medium | §10.9 assigns it to "the `report` step" and §3.4 gives deterministic work to scripts; the inputs (versions at the setup commit and now, files changed in the segment, completed `graft` steps) are all mechanical. Alternative: the orchestrator writes it; rejected because it is the same hand-typed bookkeeping §1.1 names as FT-3's failure. |
| S-8 | `routed.mjs ingest` does not open an item routed by an `align` step whose `text` equals an item closed `explained` earlier in the segment; `report.mjs` lists such entries among the deferred findings. | high | §9.1: such an item "is not reopened: it is a deferred finding", which bounds stage 7 to one align after the last touch. |
| S-9 | "A segment that moves a version" (A.1's code rule) is read as: `sources.baseline` is not empty. Then every source must carry `version`. | medium | §9.3 moves the old version to `baseline` exactly when a version moves, and §12.2's `cites-superseded` matches on baseline versions. Alternative: inspect the intake request; rejected because the loader cannot tell from a path whether it is a new version. |
| S-10 | `skills_dir` may also be an absolute path. | high | The schema says only `minLength: 1`; tests and some installs need it. |
| S-11 | Both hooks block by exiting 2 with the reason on stderr. | high | §4.1: "the two hooks instead follow the host's hook protocol (§11.1), where exit 2 blocks the call"; Claude Code feeds stderr back to the agent for `PreToolUse` and `SubagentStop`. |
| S-12 | F2 and the citation scan read `H/spec`, `H/contract` (with fixtures and schemas) and `H/adr`, as C5 to C7 do. | medium | §10.6 limits C5 to C7 to those directories because `H/management`, `H/auto` and dispatch files name old versions as history; F2 states the same purpose. |

## Testing

| ID | Decision | Confidence | Grounding |
|----|----------|------------|-----------|
| T-1 | The plan-mode fixture tree is a set of cumulative overlays under `test/fixtures/auto/tree/{nn-stage}/`; stage N is overlays 0 to N copied in order. | medium | §17.1 asks for "a small tree at each plan-mode stage" under `test/fixtures/auto/`; overlays keep each file in one place. Alternative: a full copy per stage (drifts) or a JS builder (not a fixture on disk). |
| T-2 | Test files are named `test/auto-*.test.mjs`, run by the existing `node --test 'test/*.test.mjs'`. | high | The repository's single test command and naming habit. |
| T-3 | Script tests spawn the scripts from `skills/hsdd-auto/scripts/` with the temporary repository as the working directory, and set `skills_dir` to this repository's absolute `skills/` path. | high | It exercises the CLIs as the orchestrator calls them before the first copy (§4.3). |

## Decisions taken during the build

(Appended as tasks surface them.)
