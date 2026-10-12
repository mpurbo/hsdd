# v0.8.0 Rule Ledger

Test harness for `spec/hsdd-spec-v0_8.md` acceptance criterion 1.
Every normative rule in v0.3–v0.7.1 gets a row. A rule is normative if it
constrains what an artifact must contain, what a skill must do, or when a
gate passes.

Dispositions: `carry` (verbatim intent) | `carry+amend` (changed by v0.8.0) |
`drop` (deliberately removed) | `scaffold` (delta framing, not a rule) |
`new` (introduced by v0.8.0 — source is the design doc, no delta origin)

**How to use it.** Each chapter task reads its mapped source ranges directly and
ticks the rows whose `Target` names one of its chapters. A rule found in your
ranges with no row is a missing row: add it and report it. Rows 1–3 are the
format exemplars given by the plan and are deliberately out of source order.

**`scaffold` vs `drop`.** Task 12 step 3 compiles the **`drop`** rows into the
document's "deliberately dropped" table, so `drop` is reserved for *rules* that
existed and are deliberately gone (with the reason in the Disposition cell).
Delta framing — "What X Changes and Why" openers, "Skill Edits (summary)"
tables, "Implementation Steps" — is `scaffold` and stays out of that table,
because it was never a rule. Every scaffold section still gets a row, so the
traceability pass is explicit rather than assumed.

**Targets are CHAPTER numbers** (ch1–ch18), never task numbers. Chapter → task:
ch1,2→T2 · ch3,4→T3 · ch5→T4 · ch6→T5 · ch7,8→T6 · ch9,10→T7 · ch11→T8 ·
ch12,13→T9 · ch14→T10 · ch15,16→T11 · ch17,18→T12.

| # | Source | Rule | Disposition | Target | Done |
|---|--------|------|-------------|--------|------|
| 1 | v0.3 §4.4 | Node id is the dotted path of slugs from the root; leaf phases numbered | carry | ch2 | [x] |
| 2 | v0.3 §5.1 | Contract frontmatter carries id, version, status, kind, owner | carry+amend (adds `compatibility`) | ch3 | [x] |
| 3 | v0.4.2 §3.1 | Phase planning may not edit shared governance files; it emits a pending section | carry | ch8 | [x] |
| 4 | v0.3 §1 | OpenSpec stays the execution engine; HSDD changes the unit of work | carry | ch1 | [x] |
| 5 | v0.3 §1 | The unit of spec-driven development is the smallest independently verifiable phase with explicit contracts | carry | ch1 | [x] |
| 6 | v0.3 §1 | Everything above that unit is decomposition; everything inside it is one ordinary OpenSpec cycle | carry | ch1 | [x] |
| 7 | v0.3 §1 | Leverage 1 — recursive decomposition: a large system is a tree, not a flat spec, and only the leaves drive code | carry | ch1 | [x] |
| 8 | v0.3 §1 | Leverage 2 — contracts are the dependency mechanism: nodes depend on named, versioned contracts, never on each other's internals | carry | ch1 | [x] |
| 9 | v0.3 §1 | Leverage 3 — human review at every leaf: the human owns correctness, the agent owns throughput, and each phase fits one review window | carry+amend (window restated as one review sitting / PE, vNext §10) | ch1 | [x] |
| 10 | v0.3 §2.1 | The OpenSpec cycle is untouched: new → proposal/design/tasks/specs → human review → apply → code → human review → archive | carry | ch1 | [x] |
| 11 | v0.3 §2.2 | HSDD wraps a decomposition front-end and a contract substrate around the cycle; it decides what each cycle sees and in what order cycles run | carry | ch1 | [x] |
| 12 | v0.3 §2.2 | One contract-isolated OpenSpec cycle per leaf phase; the integrated system is the composition | carry | ch1 | [x] |
| 13 | v0.3 §3 | Node-kind vocabulary: internal node (decomposes into child nodes) and leaf-parent (children are phases) | carry+amend (an OPEN set — the integration node specializes leaf-parent, ch3) | ch2 | [x] |
| 14 | v0.3 §3 | A leaf phase is the atomic, independently verifiable unit: it drives exactly one OpenSpec cycle and is sized for one review window | carry | ch2 | [x] |
| 15 | v0.3 §3 | A contract is a named, versioned interface artifact — the only thing one node may know about another | carry | ch3 | [x] |
| 16 | v0.3 §3 | Dependency-type vocabulary: hard / contract / event / shared-model | carry | ch3 | [x] |
| 17 | v0.3 §3 | Context isolation: a phase's OpenSpec session sees its own spec plus only the interfaces of contracts it consumes, never producer internals | carry | ch9 | [x] |
| 18 | v0.3 §3 | Review window: the wall-clock budget for one phase — AI run plus human review plus manual verification | carry+amend (one review sitting, vNext §10) | ch7 | [x] |
| 19 | v0.3 §3 | The mental model is functional: each node is a function with typed inputs and outputs (its consumed and produced contracts), the dependency DAG is the composition, and internals are private | carry | ch1 | [x] |
| 20 | v0.3 §4.1 | Every node, at every level, has the same shape — no system-vs-subsystem split that bakes the level into the structure | carry | ch2 | [x] |
| 21 | v0.3 §4.1 | Node header fields: Kind, Purpose, Owns, Does not own, Consumes, Produces, Governed by, Decomposes into, Isolation strategy | carry+amend (bullet lists, v0.6 §2.1; gains Sources, Team, Adopted, Status) | ch2 | [x] |
| 22 | v0.3 §4.1 | Consumes and Produces name contracts by reference (`contract-id@version`), never as an inline copy | carry | ch2 | [x] |
| 23 | v0.3 §4.1 | A leaf phase is the same shape plus the execution attributes: Scope, Size estimate (~N files, ~N lines, ≤8 OpenSpec tasks), Gate (exact command), Verification, Review tier | carry+amend (v0.6 adds Collides with and Dependencies; bullets) | ch7 | [x] |
| 24 | v0.3 §4.2 | A node becomes a leaf-parent when both hold: one owner or pair can hold its full scope in their head, and it splits into phases that each fit one review window; otherwise decompose further | carry | ch2 | [x] |
| 25 | v0.3 §4.2 | Depth is a judgment, not a constant: an intermediate "feature" layer is simply an internal node inserted when a subsystem is too big to phase directly | carry | ch2 | [x] |
| 26 | v0.3 §4.3 | Only leaf phases drive OpenSpec cycles; leaf-parents own a phase plan; internal nodes only decompose and route contracts | carry | ch2 | [x] |
| 27 | v0.3 §4.4 | The id-scheme table: root `{slug}`, node `{parent}.{slug}`, phase `{leaf-parent}.{n}`, contract `{slug}@v{n}`, node-local decision `D{n}`, ADR `ADR-{nnn}`, story/acceptance `US-{n}` / `AC-{n}.{y}` | carry+amend (adds OQ ids, ch4; `@v0` admissible, ch3) | ch2 | [x] |
| 28 | v0.3 §4.4 | Backward-compatibility note: the pre-0.3 `S1` / `S1.2` scheme is the depth-2 special case, so existing specs stay valid | drop (pre-0.3 compatibility claim; v0.8.0 supports ≥0.6.1 only, design §7) | — | [x] |
| 29 | v0.3 §5 | Contracts are standalone, versioned artifacts, not prose buried in a spec; a node references them by id and never copies another node's internals | carry | ch3 | [x] |
| 30 | v0.3 §5.1 | The split is deliberate: frontmatter is the metadata projected into the registry, the body is the interface injected into a consuming phase's context | carry | ch3 | [x] |
| 31 | v0.3 §5.1 | `status:` vocabulary — stable / draft / deprecated | carry+amend (adds `retired`; full lifecycle draft → stable → deprecated → retired, design §6.9) | ch3 | [x] |
| 32 | v0.3 §5.1 | `kind:` vocabulary — api / event / schema / shared-model / file / cli | carry | ch3 | [x] |
| 33 | v0.3 §5.1 | Frontmatter carries `produced_by` and `consumers` as authored phase-id lists | carry (vNext's retirement of both is rejected, design §3.2) | ch3 | [x] |
| 34 | v0.3 §5.1 | One file per contract, named for the slug | carry+amend (`hsdd/contract/{slug}.md`, v0.5) | ch13 | [x] |
| 35 | v0.3 §5.1 | Contract body sections: `## Interface`, `## Guarantees / invariants`, `## Versioning`, `## Validation` | carry+amend (adopted contracts add `## Observed completeness`, design §5.4) | ch3 | [x] |
| 36 | v0.3 §5.1 | The contract body's H1 is `# Contract: {slug}` | carry | ch3 | [x] |
| 37 | v0.3 §5.1 | Versioning rule: the current version is named; a breaking change requires the next version plus a migration note, and the old version stays until all consumers migrate | carry+amend (per-version `compatibility:` policy, design §6.9) | ch3 | [x] |
| 38 | v0.3 §5.1 | `## Validation` names the contract's fixture and schema paths | carry+amend (executable validation becomes required for `stable`, vNext §5.1) | ch3 | [x] |
| 39 | v0.3 §5.1 | Each downstream consumer reads exactly one of the two halves, never the whole producing node | carry | ch3 | [x] |
| 40 | v0.3 §5.2 | Every edge in the dependency DAG is typed, and the type states whether a consumer can start before the producer ships: hard — no; contract — yes once the contract is `stable`; event — yes against the event schema; shared-model — yes once the type exists | carry | ch3 | [x] |
| 41 | v0.3 §5.2 | `hard` edges are the critical path — minimize them; a DAG of mostly contract, event, and shared-model edges parallelizes well | carry | ch3 | [x] |
| 42 | v0.3 §5.3 | The contract registry `INDEX.md` is derived data — a pure projection over every contract's frontmatter, generated by a small deterministic script and never hand-maintained by an agent | carry | ch3 | [x] |
| 43 | v0.3 §5.3 | Registry columns: id, version, kind, owner, status, consumer count | carry | ch3 | [x] |
| 44 | v0.3 §5.3 | `hsdd-contract` owns the contract files (the source of truth); the generator owns the projection — the pure-core / derived-artifact split applied to documentation | carry | ch3 | [x] |
| 45 | v0.3 §5.4 | A phase's OpenSpec session receives its own phase section plus only the Interface and Guarantees of the contracts it consumes — never the producing node's implementation, sibling phases, or the full subsystem spec | carry | ch3 | [x] |
| 46 | v0.3 §6.1 | The end-to-end workflow: brain-dump → `hsdd-spec` → `hsdd-contract` → recurse until leaf-parents → `hsdd-phase-plan` → `hsdd-config` phase switch → OpenSpec cycle → verification doc → human gate → next phase | carry+amend (Entry B is its structural peer; the loop feeds steady state) | ch5 | [x] |
| 47 | v0.3 §6.1 | The verification doc is generated at `apply`, one per leaf phase | carry | ch10 | [x] |
| 48 | v0.3 §6.2 | Planning artifacts (node specs, contracts, ADRs, phase plans) are intent: stable, rarely rewritten | carry | ch9 | [x] |
| 49 | v0.3 §6.2 | Execution artifacts (the OpenSpec change plus the verification doc) are mechanism: disposable, re-runnable, archived per phase — execution re-runs without rewriting intent | carry | ch9 | [x] |
| 50 | v0.3 §7 | Skills are named by role, not by tree level, because the recursive model uses the same operation at multiple levels | carry | ch1 | [x] |
| 51 | v0.3 §7 | The skill roster is stated as one skill per artifact, each with its role and key outputs | carry+amend (four skills → ten) | ch1 | [x] |
| 52 | v0.3 §7 | `hsdd-spec` decomposes the root or any internal node: normalize the idea, split into child nodes, assign contracts by id, build the typed dependency DAG and dev flow, and record cross-cutting decisions as ADRs | carry | ch1 | [x] |
| 53 | v0.3 §7 | `hsdd-contract` authors and versions first-class contracts (frontmatter plus interface body) and classifies dependency type; the registry is script-generated | carry | ch1 | [x] |
| 54 | v0.3 §7 | `hsdd-phase-plan` turns a leaf-parent into ordered, OpenSpec-sized phases with gates, verification, review tiers, and a phase DAG | carry | ch1 | [x] |
| 55 | v0.3 §7 | Phase ordering follows an FP progression: types → pure functions → effects → composition | carry+amend (becomes the named `ordering_policy`, default `interfaces-first`, vNext §11) | ch7 | [x] |
| 56 | v0.3 §7 | `hsdd-config` generates and maintains `config.yaml`, performs the per-phase context switch (the current phase plus only its consumed contract interfaces and governing ADR decisions), and wires companion skills into each workflow step | carry | ch9 | [x] |
| 57 | v0.3 §7.1 | The skills chain in a fixed order: spec → contract → recurse → phase-plan → config → OpenSpec cycle → human review gate | carry+amend (gains adr, reconcile, adopt, intake, checkpoint, milestone) | ch1 | [x] |
| 58 | v0.3 §7.2 | Level-based skill names are rejected: the same decomposition operation runs at the system, domain, and subsystem level, so a tier in the name would mislead | carry | ch1 | [x] |
| 59 | v0.3 §7.3 | `hsdd-spec` and `hsdd-phase-plan` stay separate: phase planning carries sharply different discipline (ordering, OpenSpec sizing, gates, review tiers, verification docs) | carry | ch1 | [x] |
| 60 | v0.3 §8 | HSDD composes with general-purpose discipline skills rather than re-implementing them | carry | ch9 | [x] |
| 61 | v0.3 §8 | `hsdd-config` is the mechanism that wires companion skills into each phase session, so discipline persists across the stateless session boundary | carry | ch9 | [x] |
| 62 | v0.3 §8 | The companion mapping: brainstorming at spec and phase-plan; TDD, systematic-debugging, and verification-before-completion at apply; code-review skills at the gate; git-worktrees for parallel phases; writing/executing-plans for large phases; finishing-a-development-branch after archive | carry | ch9 | [x] |
| 63 | v0.3 §8 | Domain and tooling skills (diagram style, stack-specific skills) are optional and wired into apply through the same mapping | carry | ch9 | [x] |
| 64 | v0.3 §8 | `hsdd-config` references only skills that are actually installed: it discovers what is present, and missing companions degrade gracefully | carry | ch9 | [x] |
| 65 | v0.3 §9.1 | Each skill has named natural-language triggers (spec at the root or an internal node, contract define / bump, phase-plan a leaf-parent, config init / phase switch) | carry+amend (gains adopt, intake, checkpoint, milestone triggers) | ch5 | [x] |
| 66 | v0.3 §9.2 | The greenfield bootstrap is a scripted sequence: root spec → decompose to domains → decompose to subsystems → define contracts → phase-plan a leaf-parent → config init → phase switch → cycle → human sign-off → next phase | carry | ch5 | [x] |
| 67 | v0.3 §9.2 | The phase-context switch is required before `opsx: new`; skip it and the change inherits the previous phase's context | carry | ch9 | [x] |
| 68 | v0.3 §10.1 | Two invocation surfaces: skills (model-invoked on trigger match, conversational) and slash commands (user-invoked, deterministic, argument-shaped) | carry | ch13 | [x] |
| 69 | v0.3 §10.2 | Skills are the source of truth; slash commands are thin wrappers over them | carry | ch13 | [x] |
| 70 | v0.3 §10.2 | Every command is a one-line delegator: the moment a command embeds logic the skill also owns, the two drift apart | carry | ch13 | [x] |
| 71 | v0.3 §10.3 | The command set: the phase-context switch is the high-value command (the easiest step to forget); the rest are optional | carry+amend (one wrapper per skill, ten) | ch13 | [x] |
| 72 | v0.3 §11.1 | The layout is a recommended default recorded in `conventions.md`; a project that wants different paths overrides them there and every skill honors the override | carry | ch13 | [x] |
| 73 | v0.3 §11.1 | Paths are never hard-coded in a skill's behavior, only defaulted | carry | ch13 | [x] |
| 74 | v0.3 §11.1 | The default layout: node specs under `spec/`, verification docs under `verify/`, contracts plus a generated INDEX, ADRs plus a generated INDEX, and `openspec/` holding `config.yaml` and one change directory per phase | carry+amend (rooted at `hsdd/`, singular names, v0.5) | ch13 | [x] |
| 75 | v0.3 §11.2 | The required artifact set is deliberately few: node specs (only as deep as the tree needs), contracts, leaf-parent phase plans, the per-phase OpenSpec change plus verification doc, and `conventions.md` | carry+amend (the management layer joins it where a project runs one) | ch13 | [x] |
| 76 | v0.3 §11.2 | `adr/` and `retrospective.md` are optional and used only when they earn their keep: depth and ceremony are costs, spent deliberately | carry | ch13 | [x] |
| 77 | v0.3 §11.3 | The verification document is named for the phase id with a `.verification.md` suffix, one per leaf phase | carry | ch9 | [x] |
| 78 | v0.3 §11.3 | It is generated during `apply` and kept outside the OpenSpec change directory, so it survives `archive` and stays discoverable as durable project history | carry | ch9 | [x] |
| 79 | v0.3 §12 | Human responsibility is central, not a rubber stamp; the mechanisms exist to keep the human effective without becoming the bottleneck | carry | ch10 | [x] |
| 80 | v0.3 §12.1 | Every phase is assigned a review tier that scales human attention to risk: gate-only / spot-check / full-review | carry | ch7 | [x] |
| 81 | v0.3 §12.1 | What each tier means at the gate: gate-only — gate passes, auto-proceed, human notified; spot-check — glance at the diff, confirm the gate, proceed; full-review — read the diff, run the verification guide, consider edge cases | carry+amend (per-tier checklists sharpen it) | ch10 | [x] |
| 82 | v0.3 §12.2 | At `apply` the agent generates the phase's verification document, turning the manual verification guide into a named, durable artifact | carry | ch10 | [x] |
| 83 | v0.3 §12.2 | Verification-doc content: what was implemented, what was not implemented or deferred, test evidence with commands and results, manual verification steps, and human sign-off with reviewer, date, and tier | carry+amend (v0.6 §5.2's template supersedes the shape; gains Learnings and Metrics) | ch10 | [x] |
| 84 | v0.3 §12.3 | Each leaf phase is sized so the full loop — AI run plus human review plus manual verification — fits one review window, and the review tier modulates the human half | carry+amend (window → one review sitting, vNext §10) | ch7 | [x] |
| 85 | v0.3 §12.3 | If a phase cannot fit the window it is too big and `hsdd-phase-plan` splits it; phase sizing is the control knob over context, tokens, time, and quality | carry | ch7 | [x] |
| 86 | v0.3 §12.4 | ADRs capture durable "why" for decisions that span more than one node or must outlive the node that introduced them; node-local choices stay `D{n}` inside the node spec | carry | ch4 | [x] |
| 87 | v0.3 §12.4 | ADRs are not auto-generated in bulk: `hsdd-spec` proposes one when a cross-cutting decision surfaces and the human accepts, edits, or writes it directly; they stay few on purpose | carry | ch4 | [x] |
| 88 | v0.3 §12.4 | An ADR has an id (`ADR-{nnn}`) and a status (proposed / accepted / superseded-by `ADR-{mmm}`) | carry+amend (frontmatter status vocabulary, v0.4 §3) | ch4 | [x] |
| 89 | v0.3 §12.4 | The ADR link is bidirectional and by id: the ADR lists `Affects: [node-ids, contract-ids]`, and every affected node, phase, and contract lists `Governed by: [ADR-NNN]` in its header | carry | ch4 | [x] |
| 90 | v0.3 §12.4 | The ADR registry `INDEX.md` is generated the same way as the contract registry | carry | ch4 | [x] |
| 91 | v0.3 §12.4 | ADR injection: `hsdd-config` resolves the ADRs referenced by the phase's node and by the contracts the phase consumes, then injects only each ADR's Decision and Consequences — never the Context or the alternatives | carry | ch4 | [x] |
| 92 | v0.3 §12.4 | The v0.3 ADR body example — bold body fields, no YAML frontmatter | drop (superseded by v0.4 §3's registry-compatible frontmatter form; the old shape is silently skipped by the generator) | — | [x] |
| 93 | v0.3 §13 | HSDD versus OpenSpec, dimension by dimension: unit of work, structure, decomposition, coupling, context per session, parallelism, dependency model, cycle engine, human review, pacing, and the scale each reaches | carry | ch1 | [x] |
| 94 | v0.3 §13 | HSDD does not replace OpenSpec: it composes it with bounded-context decomposition, contract-first architecture, tiered human review, and context isolation | carry | ch1 | [x] |
| 95 | v0.3 §14.1 | The recursive node model exists because a flat spec stops scaling at the context window; a tree lets only the leaves drive code | carry | ch15 | [x] |
| 96 | v0.3 §14.1 | Context isolation via contracts is the central token and focus win: the dependency graph, not the whole spec, defines what a session sees | carry+amend (claims rewrite, vNext §8.1) | ch15 | [x] |
| 97 | v0.3 §14.1 | The remaining stated rationales: first-class versioned contracts, typed dependency edges, the per-phase verification doc, tiered human review, phase sized to a review window, planning/execution separation, generated registries, and composing discipline instead of re-implementing it | carry | ch15 | [x] |
| 98 | v0.3 §14.2 | Non-goal: a fixed `Feature` tier between subsystem and phase — the recursive model already inserts an internal node when needed | carry | ch15 | [x] |
| 99 | v0.3 §14.2 | Non-goal: a mandatory `retrospective.md` per phase — opt-in only | carry | ch15 | [x] |
| 100 | v0.3 §14.2 | Non-goal: agent-maintained contract or ADR registries — non-deterministic and token-expensive; generated instead | carry | ch15 | [x] |
| 101 | v0.3 §14.2 | Non-goal: heavy, always-on documentation — the required set is minimal and everything else earns its keep | carry | ch15 | [x] |
| 102 | v0.3 §14.2 | Non-goal: re-implementing TDD, review, or debugging inside HSDD | carry | ch15 | [x] |
| 103 | v0.3 §15 | Settled: skill names are role-based | carry+amend (ten skills) | ch17 | [x] |
| 104 | v0.3 §15 | Settled: spec and phase-plan are not merged | carry | ch17 | [x] |
| 105 | v0.3 §15 | Settled: contract versioning is simple `v{n}` with a migration note on a breaking change — no semantic versioning | carry | ch3, ch17 | [x] |
| 106 | v0.3 §15 | Settled: the verification doc's location is `{verify}/{phase-id}.verification.md` | carry+amend (`hsdd/verify/`, v0.5) | ch17 | [x] |
| 107 | v0.3 §15 | Settled: node identification is the dotted slug path from the root with leaf phases numbered | carry | ch17 | [x] |
| 108 | v0.3 §15 | Settled: registry maintenance is script-generated from contract frontmatter | carry | ch17 | [x] |
| 109 | v0.3 §15 | Settled: the recommended companion plugin is superpowers, wired in via `hsdd-config` | carry | ch17 | [x] |
| 110 | v0.3 §15 | Settled: slash commands are optional thin wrappers; the primary surface is skills | carry | ch17 | [x] |
| 111 | v0.3 §16 | "Next Steps" — the v0.3 implementation to-do list | scaffold (implementation bookkeeping, not a rule) | — | [x] |
| 112 | v0.3 §17 | Glossary terms: node, leaf phase, contract, dependency type, ADR, review tier, review window, companion skill, context isolation | carry+amend (gains the v0.8.0 terms, ch18 task list) | ch18 | [x] |
| 113 | v0.4 §1 | "What 0.4 Changes and Why" — the two gaps 0.4 closes | scaffold (delta framing; the rules are in §2–§5) | — | [x] |
| 114 | v0.4 §1.1 | The failure named alongside the rule: an ADR left as inline prose has two broken consumers — `hsdd-config` cannot resolve it, and a body-field ADR with no frontmatter is silently skipped by the registry generator | carry | ch4 | [x] |
| 115 | v0.4 §1.2 | "The `openspec init` point was never pinned" — delta framing; §5 states the rule | scaffold | — | [x] |
| 116 | v0.4 §2 | `hsdd-adr` owns the ADR directory the same way `hsdd-contract` owns contracts: it authors first-class files and lets the deterministic generator project the registry | carry+amend (five skills → ten) | ch1 | [x] |
| 117 | v0.4 §2 | `hsdd-adr`'s role: author and maintain cross-cutting ADRs as first-class files with registry-compatible frontmatter, and manage the status lifecycle and the bidirectional `Affects` / `Governed by` links | carry | ch4 | [x] |
| 118 | v0.4 §2.1 | The chain gains one line: `hsdd-spec` proposes, the human accepts, `hsdd-adr` materializes, the registry regenerates | carry | ch1 | [x] |
| 119 | v0.4 §2.2 | One artifact, one skill: an artifact with its own lifecycle (status transitions, superseding, a registry projection) gets its own skill rather than a branch of another | carry | ch1 | [x] |
| 120 | v0.4 §3 | An ADR file is written to `{nnn}-{title}.md` in the ADR directory | carry+amend (`hsdd/adr/`, v0.5) | ch4 | [x] |
| 121 | v0.4 §3 | ADR frontmatter: `id`, `status` (proposed / accepted / superseded / deprecated), `affects`, `date`, and optional `supersedes` / `superseded_by` | carry | ch4 | [x] |
| 122 | v0.4 §3 | ADR body: `# ADR-{nnn}: {title}`, `## Context`, `## Decision`, `## Consequences`, and an optional `## Alternatives considered` | carry | ch4 | [x] |
| 123 | v0.4 §3 | The same split as a contract: frontmatter is registry metadata, the body carries the decision — and Decision and Consequences stay free of deliberation because those two sections are what gets injected | carry | ch4 | [x] |
| 124 | v0.4 §3 | The filename carries the number and a slug; the frontmatter `id` is the display id `ADR-001` | carry | ch4 | [x] |
| 125 | v0.4 §3 | ADR numbers are global across the whole tree, never per node | carry | ch4 | [x] |
| 126 | v0.4 §3 | Node-local decisions stay `D{n}` inside the node spec and never become files | carry | ch4 | [x] |
| 127 | v0.4 §3 | "No change to `gen-registry.mjs` is required" — the fix is that the skill emits the frontmatter the generator already reads | scaffold (delta implementation note; the constraint itself is row 121) | — | [x] |
| 128 | v0.4 §4.1 | Once an ADR is accepted, `hsdd-spec` hands materialization to `hsdd-adr`, which writes the file; then `Governed by: [ADR-NNN]` is set on every affected node, phase, and contract | carry | ch4 | [x] |
| 129 | v0.4 §4.1 | ADRs are never left as inline prose in a node spec | carry | ch4 | [x] |
| 130 | v0.4 §4.2 | If a referenced `ADR-NNN` has no file, it was never materialized: stop and author it with `hsdd-adr` before injecting | carry | ch4 | [x] |
| 131 | v0.4 §4.2 | The human supplies the decision — never invent one. If the content is unavailable, author the ADR `status: proposed` with the Decision as an explicit TODO and do not inject it as binding until it is `accepted` | carry | ch4 | [x] |
| 132 | v0.4 §4.2 | Never write an invented decision as `accepted`, and never silently drop the reference | carry | ch4 | [x] |
| 133 | v0.4 §4.3 | The ADR path end to end: `hsdd-spec` proposes → human accepts → `hsdd-adr` writes the file → the generator projects the INDEX and `Governed by` links point back → `hsdd-config` injects Decision plus Consequences into the phase session | carry | ch4 | [x] |
| 134 | v0.4 §5 | Run `openspec init` once, at the repository root — the same directory that holds the HSDD tree | carry | ch5 | [x] |
| 135 | v0.4 §5 | One HSDD tree has exactly one OpenSpec project: every phase, across every node, is a change under that single `openspec/changes/` | carry | ch5 | [x] |
| 136 | v0.4 §5 | Phases are isolated by the per-phase context switch, not by separate OpenSpec projects | carry | ch5 | [x] |
| 137 | v0.4 §5.1 | Project-start sequence: `openspec init` at the root → `hsdd-spec` at the root (root node spec plus seeded conventions) → `hsdd-config` init → then, per phase, the context switch followed by the OpenSpec cycle | carry | ch5 | [x] |
| 138 | v0.4 §5.1 | `openspec init` is a one-time step owned by no HSDD skill; the skills assume `openspec/` already exists at the root, and `hsdd-config` (init) is the first HSDD step that touches it | carry | ch5 | [x] |
| 139 | v0.4 §5.2 | The single project at the root is what makes the layout coherent: one `config.yaml` to switch, one `changes/` history, one place the registries sit beside — context isolation stays a property of the phase switch, not the filesystem | carry | ch5 | [x] |
| 140 | v0.4 §5.2 | Polyrepo variant: when the system is already physically split across repositories, run `openspec init` at each repo root and share the contract and ADR directories through a package or a git submodule; the single-project default is canonical | carry+amend (the standalone-spec-repo profile, v0.7 §6) | ch13 | [x] |
| 141 | v0.4 §6 | Each skill ships one thin slash-command wrapper (here `/hsdd-adr`); the command stays a one-line delegator and the skill remains the source of truth | carry | ch13 | [x] |
| 142 | v0.4 §7 | Settled: `hsdd-adr` authors ADR files — `hsdd-spec` proposes, `hsdd-adr` materializes | carry | ch17 | [x] |
| 143 | v0.4 §7 | Settled: the ADR artifact is YAML frontmatter plus body, reconciled with the existing generator | carry | ch17 | [x] |
| 144 | v0.4 §7 | Settled: no generator change is needed — the skill emits the frontmatter the generator already reads | carry | ch17 | [x] |
| 145 | v0.4 §7 | Settled: ADR numbering is global across the tree, `ADR-{nnn}`, with the filename `{nnn}-{title}.md` | carry | ch17 | [x] |
| 146 | v0.4 §7 | Settled: `openspec init` runs once, at the repo root — one OpenSpec project per HSDD tree | carry | ch17 | [x] |
| 147 | v0.4 §7 | Settled: a missing ADR at config time stops the switch and hands off to `hsdd-adr`; an unknown decision is authored `proposed` with a TODO, never as an invented `accepted` | carry | ch17 | [x] |
| 148 | v0.4 §8 | "Implementation Steps" | scaffold | — | [x] |
| 149 | v0.4.2 §1 | "What 0.4.2 Changes and Why" — the three parallel-planning field failures | scaffold (delta framing; §1's closing paragraphs carry rows 150–153) | — | [x] |
| 150 | v0.4.2 §1 | **The governance write protocol:** governance files become immutable inputs during phase planning, intended mutations are emitted as data, and a single writer applies them at the root | carry | ch8 | [x] |
| 151 | v0.4.2 §1 | The reason, named alongside the rule: contracts, ADRs, `conventions.md`, and the INDEX registries are shared mutable state with concurrent writers, and no skill defined a write protocol | carry | ch8 | [x] |
| 152 | v0.4.2 §1 | Two independent generations from the same prose are not byte-identical: a plan may never resolve a shared artifact with "create it verbatim if absent; identical by construction; the merge is trivial" | carry | ch8 | [x] |
| 153 | v0.4.2 §1 | A note addressed to "whoever runs next" is a defect: under parallelism that is every run at once | carry | ch8 | [x] |
| 154 | v0.4.2 §2 | `hsdd-reconcile` is the single writer for governance effects, the same way `hsdd-contract` is the single author of contract bodies | carry+amend (six skills → ten) | ch1 | [x] |
| 155 | v0.4.2 §2 | `hsdd-contract` is a root-only writer | carry | ch8 | [x] |
| 156 | v0.4.2 §2 | The phase context switch warns on a provisional contract and stops on a phase contingent on an open `request` | carry | ch9 | [x] |
| 157 | v0.4.2 §2 | `hsdd-reconcile`'s job: drain pending governance sections at the root after phase-plan branches merge — apply confirms, resolve requests with the human, finalize `phase_ids`, regenerate the registries | carry | ch8 | [x] |
| 158 | v0.4.2 §2.1 | The chain gains one line: reconcile runs at the root after the branches merge, before any phase context switch | carry | ch8 | [x] |
| 159 | v0.4.2 §2.2 | Reconcile is its own skill: `hsdd-phase-plan` decides *what a node needs* from governance, `hsdd-reconcile` owns *how and when* governance changes — folding it into either gives one skill two jobs or re-creates the concurrent writer | carry | ch8 | [x] |
| 160 | v0.4.2 §3.1 | The frozen set during phase planning: every contract file, every ADR file, `conventions.md`, and both INDEX registries | carry | ch8 | [x] |
| 161 | v0.4.2 §3.1 | The freeze is unconditional — root or worktree, serial or parallel; there is no environment detection and nothing to configure | carry | ch8 | [x] |
| 162 | v0.4.2 §3.1 | Under the freeze every branch writes only its own node's plan file, so a parallel flow is conflict-free by construction and a serial flow pays one trivially fast reconcile step | carry | ch8 | [x] |
| 163 | v0.4.2 §3.2 | `hsdd-phase-plan` appends `## Governance updates (pending reconcile)` to its own node's plan file, with the emitted-by / drained-by note and "do not apply by hand" | carry | ch8 | [x] |
| 164 | v0.4.2 §3.2 | Entry kind `confirm`: finalize the provisional `produced_by` / `consumers` phase ids for a contract this node produces or consumes | carry | ch8 | [x] |
| 165 | v0.4.2 §3.2 | Entry kind `note`: a conventions-worthy fact; notes that duplicate derived data are dropped at reconcile time, because the registry already projects contract facts | carry | ch8 | [x] |
| 166 | v0.4.2 §3.2 | Entry kind `amend`: a producer-side enrichment of a contract this node owns, settled during planning, that consumers may rely on; reconcile applies it to the contract body — a backward-compatible addition keeps the version, a breaking one goes to the human and bumps it | carry | ch8 | [x] |
| 167 | v0.4.2 §3.2 | Entry kind `request`: a gap in a consumed contract phrased as a question, with the assumption taken and the contingent phases named; contingent phases must not start until the request is resolved | carry | ch8 | [x] |
| 168 | v0.4.2 §3.2 | Any entry may carry short rationale sub-bullets | carry | ch8 | [x] |
| 169 | v0.4.2 §3.2 | After draining, `hsdd-reconcile` replaces the section's entries with one line recording the reconcile date; the drained entries live in git history | carry | ch8 | [x] |
| 170 | v0.4.2 §3.3 | Two-tier gap rule: if a gap in a consumed contract changes the shape of the plan, stop and ask the human immediately — a wrong structural assumption poisons every downstream phase; otherwise proceed conservatively and record a `request` | carry | ch8 | [x] |
| 171 | v0.4.2 §3.4 | Sibling isolation: a planner must not read sibling worktree folders or other nodes' phase plans | carry | ch8 | [x] |
| 172 | v0.4.2 §3.4 | Sibling node specs as written by `hsdd-spec` are shared decomposition artifacts and fine to read; a sibling's phase-plan sections and its worktree are not | carry | ch8 | [x] |
| 173 | v0.4.2 §4.1 | Contract frontmatter carries `phase_ids: provisional / final`, flipped only by `hsdd-reconcile` | carry | ch3 | [x] |
| 174 | v0.4.2 §4.1 | The habit of writing "phase ids are provisional, update them then" in the contract body is retired: that paragraph was a standing invitation for two writers to edit the same prose | carry | ch3 | [x] |
| 175 | v0.4.2 §4.1 | The registry generator's parser reads all frontmatter keys but projects only the known columns, so a new key passes through without effect | carry | ch3 | [x] |
| 176 | v0.4.2 §4.2 | The hand-maintained `## Established contracts` list is removed from the conventions template: it duplicated what the registry already projects, and hand-maintained projections drift | carry | ch13 | [x] |
| 177 | v0.4.2 §4.2 | The conventions template gains a `## Parallel development protocol` section stating the freeze rule, the pending-section mechanism, the reconcile step, and sibling isolation | carry+amend (extended to cover the execution stage, v0.6 §4) | ch13 | [x] |
| 178 | v0.4.2 §4.2 | Every skill reads `conventions.md` first, so a protocol stated there reaches every downstream session without new cross-skill references | carry | ch13 | [x] |
| 179 | v0.4.2 §5 | "Skill Edits (summary)" — the per-skill edit list | scaffold (delta bookkeeping; the rules stated only in its cells are rows 180–182) | — | [x] |
| 180 | v0.4.2 §5 | `hsdd-contract` quality gate: any code-level artifact both sides consume names its canonical path and its owning phase | carry | ch3 | [x] |
| 181 | v0.4.2 §5 | A phase's tasks never instruct it to update `conventions.md` | carry | ch8 | [x] |
| 182 | v0.4.2 §5 | Conventions stay root-owned: `hsdd-spec` seeds the file and `hsdd-reconcile` updates it | carry | ch13 | [x] |
| 183 | v0.4.2 §6 | `/hsdd-reconcile` is a thin wrapper, consistent with the others | carry | ch13 | [x] |
| 184 | v0.4.2 §7 | Settled: the write model for governance files during planning is freeze plus effects-as-data, unconditional — no worktree detection, serial and parallel flows identical | carry | ch17 | [x] |
| 185 | v0.4.2 §7 | Settled: reconciliation lives in its own skill, run at the root after branches merge | carry | ch17 | [x] |
| 186 | v0.4.2 §7 | Settled: contract gaps during planning are two-tier — ask when the gap changes the plan's shape, otherwise record a `request` with the stated assumption | carry | ch17 | [x] |
| 187 | v0.4.2 §7 | Settled: collision resolution — the human arbitrates once, at reconcile time; the skill never auto-picks a winner | carry | ch8, ch17 | [x] |
| 188 | v0.4.2 §7 | Settled: `conventions.md` is written at the root only; phases and phase planning never touch it | carry | ch17 | [x] |
| 189 | v0.4.2 §7 | Settled: sibling worktree reads are forbidden — contracts are the only inter-node knowledge | carry | ch17 | [x] |
| 190 | v0.4.2 §7 | Settled: no generator change — `phase_ids` is parsed and ignored by the projection | carry | ch17 | [x] |
| 191 | v0.4.2 §7 | Settled: producer-side discoveries travel as the `amend` entry kind, and a breaking amendment goes to the human and bumps the version | carry | ch17 | [x] |
| 192 | v0.4.2 §7 | Settled: `draft → stable` is flipped by `hsdd-reconcile` at the end of the pass, once `phase_ids` is `final` and no `request` naming the contract is unresolved; `stable` means interface-frozen (safe to build against), not producer-shipped | carry+amend (also requires executable validation, vNext §5.1) | ch3, ch17 | [x] |
| 193 | v0.4.2 §8 | "Implementation Steps" | scaffold | — | [x] |
| 194 | v0.5 §1 | "What 0.5 Changes and Why" — scattered output and inconsistent naming | scaffold (delta framing; §1's closing paragraphs carry rows 195–198) | — | [x] |
| 195 | v0.5 §1 | Every HSDD artifact lives under one root directory, `hsdd/` | carry | ch13 | [x] |
| 196 | v0.5 §1 | Directory names are singular (`spec`, `contract`, `adr`, `verify`): a directory names the artifact kind, not the collection | carry | ch13 | [x] |
| 197 | v0.5 §1 | `openspec/` is the one exception — OpenSpec owns that location and expects its files exactly there; HSDD does not relocate another tool's files | carry | ch13 | [x] |
| 198 | v0.5 §1 | The ownership boundary is the point: something on disk must say "this is the methodology's output", or cleanup, review scoping, and ignore rules all need tribal knowledge | carry | ch13 | [x] |
| 199 | v0.5 §2 | The default layout: `hsdd/conventions.md`, `hsdd/spec/{node-id}.md`, `hsdd/verify/{phase-id}.verification.md`, `hsdd/contract/{slug}.md` plus its INDEX, `hsdd/adr/{nnn}-{title}.md` plus its INDEX, `hsdd/scripts/gen-registry.mjs`; `openspec/` unchanged | carry+amend (adds `hsdd/management/`, v0.7 §8.2, and `management/archive/`, design §6.8) | ch13 | [x] |
| 200 | v0.5 §2 | The layout is still a default: `hsdd/conventions.md` remains the single source of truth and a project may override any path in it | carry | ch13 | [x] |
| 201 | v0.5 §2 | `openspec init` still runs once, at the repo root — now simply the directory that holds `hsdd/` | carry | ch13 | [x] |
| 202 | v0.5 §3 | The registry generator keeps a `--root <dir>` flag; its default root is `./hsdd` and it scans `<root>/contract` and `<root>/adr` | carry | ch13 | [x] |
| 203 | v0.5 §3 | The standard invocation is `node hsdd/scripts/gen-registry.mjs` | carry | ch13 | [x] |
| 204 | v0.5 §3 | The generator ships bundled with `hsdd-contract` only, and is copied verbatim into the target project at `hsdd/scripts/` | carry | ch13 | [x] |
| 205 | v0.5 §4 | The conventions file is the compatibility mechanism: skills load `hsdd/conventions.md` first and honor whatever layout the project's conventions state | carry | ch13 | [x] |
| 206 | v0.5 §4 | Pre-0.5 detection (`docs/conventions.md` present instead) and the `git mv` migration recipe | drop (v0.8.0 supports ≥0.6.1 only, design §7; the pre-0.5 rename is history) | — | [x] |
| 207 | v0.5 §4 | After migrating, update the layout section of the conventions file and replace the copied generator, since the old copy scans the old paths by default | drop (same reason as row 206) | — | [x] |
| 208 | v0.5 §5 | The node, phase, contract, and ADR id schemes are layout-independent | carry | ch13 | [x] |
| 209 | v0.5 §5 | The governance freeze protocol and `hsdd-reconcile` semantics are layout-independent | carry | ch13 | [x] |
| 210 | v0.5 §5 | The conventions-override mechanism is layout-independent: the layout is a default, not a requirement | carry | ch13 | [x] |
| 211 | v0.5 §5 | The `openspec/` location, the per-phase context switch, and the OpenSpec cycle are unchanged by any layout choice | carry | ch13 | [x] |
| 212 | v0.6 §1 | "What 0.6 Changes and Why" — the four classes of field friction | scaffold (delta framing; §1's closing paragraph carries row 213) | — | [x] |
| 213 | v0.6 §1 | The core invariant no release moves: one phase drives exactly one OpenSpec change and ends at one human review gate | carry | ch1 | [x] |
| 214 | v0.6 §2.1 | Every field block emitted in a node header or a phase section is a bullet list — never consecutive `**Field:** value` lines relying on soft breaks, which every compliant renderer collapses into one paragraph | carry | ch2 | [x] |
| 215 | v0.6 §2.1 | Wrapped values keep the 2-space continuation indent, so wrapped lines render inside their field | carry | ch2 | [x] |
| 216 | v0.6 §2.1 | The phase template's fields: Consumes, Produces, Governed by, Scope, Size estimate, Gate, Verification, Review tier, Collides with, Dependencies | carry | ch7 | [x] |
| 217 | v0.6 §2.1 | The `Verification` field is 1–3 lines of intent — what a human should confirm works beyond the gate, as observable behavior, not commands | carry | ch7 | [x] |
| 218 | v0.6 §2.1 | Rendering rule, a quality-gate item in both skills: field blocks must be bullet lists or tables, never structure carried by soft line breaks | carry | ch2 | [x] |
| 219 | v0.6 §2.1 | Empty lists render as "none", not `[]`: bracket notation is agent-speak and the plan is a human artifact | carry | ch2 | [x] |
| 220 | v0.6 §2.1 | Rejected and staying rejected: full tables for the phase record (multi-sentence Scope and Verification become unreadable one-line cells) and hard line breaks (invisible in source, silently stripped) | carry | ch7 | [x] |
| 221 | v0.6 §2.2 | `## Phase Plan` opens with a summary table, one row per phase: Phase, Name, Tier, Size, Depends on, Collides with — omitting the last column when no phase collides | carry | ch7 | [x] |
| 222 | v0.6 §2.2 | The summary table is the human index and the bullet sections stay the machine-consumed detail: `hsdd-config` injects only the detailed section, so the table never enters an agent's context | carry | ch7 | [x] |
| 223 | v0.6 §2.2 | Quality gate: the summary table matches the phase sections | carry+amend (v0.6.1 §6: "opens the section and matches") | ch7 | [x] |
| 224 | v0.6 §2.3 | The phase dependency graph is a Mermaid flowchart, one node per phase labeled `{phase-id}<br/>{short name}`; ASCII is retired | carry | ch7 | [x] |
| 225 | v0.6 §2.3 | Graph edges are logical dependencies only; textual contention is carried by `Collides with` and never drawn | carry | ch7 | [x] |
| 226 | v0.6 §2.3 | Cross-node dependencies appear as dashed edges with the dependency named on the edge label | carry | ch7 | [x] |
| 227 | v0.6 §2.3 | If `mermaid-pastel-style` is installed, follow it | carry | ch7 | [x] |
| 228 | v0.6 §2.4 | A standalone node spec file uses one `#` title, `##` for document sections, and does not repeat the title as an inner `###` heading | carry | ch2 | [x] |
| 229 | v0.6 §3.1 | Sizing floor: a phase must be big enough to earn its cycle | carry | ch7 | [x] |
| 230 | v0.6 §3.1 | Two adjacent phases are merge candidates when all hold: same review tier, same consumed contracts, no third phase depends on one without the other, and the merged phase still fits the review window with ≤8 OpenSpec tasks | carry | ch7 | [x] |
| 231 | v0.6 §3.1 | Textual contention strengthens the merge case: phases that would serialize anyway have a lower bar to merge | carry | ch7 | [x] |
| 232 | v0.6 §3.1 | Keep a small phase separate only for a reason you can name: a tier boundary, a parallel lane assigned to another owner, or a risk you want reviewed in isolation | carry | ch7 | [x] |
| 233 | v0.6 §3.1 | The merge smell: if a phase's predicted process artifacts exceed its predicted diff, it is a merge candidate by default | carry | ch7 | [x] |
| 234 | v0.6 §3.2 | The review tier sets the artifact profile, not only human attention: proposal depth, whether `design.md` exists at all, and verification-doc depth scale with the tier | carry | ch10 | [x] |
| 235 | v0.6 §3.2 | Never scaled: `tasks.md` and the requirement/scenario deltas — they drive TDD and the tests at every tier | carry | ch10 | [x] |
| 236 | v0.6 §3.2 | Every phase still produces a verification doc; only its depth varies | carry | ch10 | [x] |
| 237 | v0.6 §3.2 | Mechanism: the review tier is already injected into every phase context, so the artifact rules are tier-conditional | carry | ch9 | [x] |
| 238 | v0.6 §3.3 | Anti-rationalization: "merge them so there's less to review" — merging to dodge review defeats the tiers; merge only under the sizing floor's conditions | carry | ch7 | [x] |
| 239 | v0.6 §3.3 | Anti-rationalization: "small phases are always a feature" — they are a feature when they buy parallelism or isolated review; below the floor they buy neither and still cost a full cycle | carry | ch7 | [x] |
| 240 | v0.6 §3.4 | A phase plan may state one `**Default gate:**` command above the summary table; a phase's `Gate` field then reads "node default" unless it overrides | carry | ch7 | [x] |
| 241 | v0.6 §4 | The execution protocol is the freeze's mirror for the execution stage, and it lives in the conventions template's parallel-development section, in `hsdd-config`, and in the users guide | carry | ch9 | [x] |
| 242 | v0.6 §4.1 | The `## Current Phase` block and its companion contract/ADR blocks in `openspec/config.yaml` are per-session working state, rewritten by every context switch: a merge conflict on them carries no information | carry | ch9 | [x] |
| 243 | v0.6 §4.1 | On any merge, resolve `openspec/config.yaml` by taking either side, then re-run the phase context switch before the next OpenSpec cycle; optionally set `merge=ours` in `.gitattributes` on integration branches | carry | ch9 | [x] |
| 244 | v0.6 §4.1 | The phase-switch command self-heals: warn when the Current Phase block names a phase that is not next-runnable per the node's plan (already archived, or blocked by an unmerged dependency) | carry | ch9 | [x] |
| 245 | v0.6 §4.2 | One integration branch per node; phase branches merge into it | carry | ch9 | [x] |
| 246 | v0.6 §4.2 | Node integration branches merge into the root branch | carry | ch9 | [x] |
| 247 | v0.6 §4.2 | A node's plan file is written on exactly one lineage — never re-plan or copy a plan onto a diverged sibling lineage | carry | ch9 | [x] |
| 248 | v0.6 §4.2 | `hsdd-reconcile` runs once, at the root lineage, after the node plans are merged there — never per-lineage; its commit exists only on the root | carry | ch8 | [x] |
| 249 | v0.6 §4.3 | Each phase section carries `- **Collides with:** [phase-ids]` when the plan expects textual contention (omit when none), and the summary table surfaces the column | carry | ch7 | [x] |
| 250 | v0.6 §4.3 | Colliding phases execute serially on the node's integration branch; spawn parallel worktrees only for phases with no `Collides with` entry between them | carry | ch9 | [x] |
| 251 | v0.6 §4.3 | Logical dependencies and textual contention stay separate concepts: the graph draws the former, the field carries the latter | carry | ch7 | [x] |
| 252 | v0.6 §4.4 | Name OpenSpec capabilities after a stable feature area within the node, not after the phase, and accept that same-capability archives serialize | carry | ch9 | [x] |
| 253 | v0.6 §4.4 | Fall back to per-phase capability names only when genuinely parallel phases would contend on the same capability spec | carry | ch9 | [x] |
| 254 | v0.6 §5.1 | The phase's tasks include a gate task that runs the phase gate command | carry | ch10 | [x] |
| 255 | v0.6 §5.1 | After the gate task, a documentation task writes the verification doc at `hsdd/verify/{phase-id}.verification.md` from the bundled template, at the depth the phase's review tier requires | carry | ch10 | [x] |
| 256 | v0.6 §5.1 | A phase never updates `hsdd/conventions.md` or `hsdd/contract/`; governance changes are made at the root | carry | ch8 | [x] |
| 257 | v0.6 §5.1 | Long compound rules are the ones agents half-apply, so the tasks rule is stated as three separate rules | carry | ch9 | [x] |
| 258 | v0.6 §5.2 | The bundled verification template's sections: Commands to run, Expected output, Observed (dated), Outstanding, Sign-off | carry+amend (gains `## Learnings`, vNext §6, and `## Metrics`, vNext §14.1) | ch10 | [x] |
| 259 | v0.6 §5.2 | Sign-off records the reviewer and date, the review tier applied, and a disposition for every Outstanding item: verified / waived (reason) / deferred to `{phase-id}` | carry | ch10 | [x] |
| 260 | v0.6 §5.2 | The review gate is not passed while an Outstanding item lacks a disposition | carry | ch10 | [x] |
| 261 | v0.6 §5.2 | The verification doc is written at apply, never during planning | carry | ch10 | [x] |
| 262 | v0.6 §6.1 | The failure named alongside the axis rule: an end-to-end node across two teams has two owners, interleaves two toolchains and deploy targets, silently fails the leaf-parent criterion, and leaves the worktree-per-node model with no single owner to assign | carry | ch2 | [x] |
| 263 | v0.6 §6.1 | "Prefer capability slices over technology buckets" rejects *layer* buckets inside one codebase; it never licenses feature slices across an ownership boundary | carry | ch2 | [x] |
| 264 | v0.6 §6.2 | Choose the decomposition axis by ownership, not elegance: at each level, first split along the boundaries where different teams, owners, or deploy targets hold different parts of the stack | carry | ch2 | [x] |
| 265 | v0.6 §6.2 | Those boundaries come with their natural contract and match how work is actually assigned — Conway's law is a constraint to design with, not a smell to fight | carry | ch2 | [x] |
| 266 | v0.6 §6.2 | Within one owner's territory, prefer capability slices over technology buckets | carry | ch2 | [x] |
| 267 | v0.6 §6.2 | A capability that spans the stack returns one level down as a node per side, joined by a contract, with the pairing visible in the dependency DAG | carry | ch2 | [x] |
| 268 | v0.6 §6.2 | Vertical end-to-end slices remain correct when one owner genuinely holds the whole stack: there the feature boundary *is* the ownership boundary | carry | ch2 | [x] |
| 269 | v0.6 §6.2 | The rule reduces to one question — who builds what? — and an unstated team structure over a stack-spanning system is the canonical clarifying question | carry+amend (becomes a mandatory stop, v0.6.1 §4) | ch2 | [x] |
| 270 | v0.6 §6.2 | Quality gate: the decomposition axis at each level matches the stated ownership, and no node is owned by two teams | carry+amend (ownership stated by the human, not assumed, v0.6.1 §4) | ch2 | [x] |
| 271 | v0.6 §6.2 | Anti-rationalization: "auth end-to-end is one coherent capability" — coherent for whom? Split at the ownership boundary; the capability comes back as a node pair joined by a contract | carry | ch2 | [x] |
| 272 | v0.6 §7 | "Skill Edits (summary)" | scaffold (delta bookkeeping; the rule stated only in its cells is row 273) | — | [x] |
| 273 | v0.6 §7 | The conventions template's parallel-development section is extended and renamed to cover both stages — planning and execution | carry | ch13 | [x] |
| 274 | v0.6 §8 | Settled: the decomposition axis is ownership first; capability slices apply within one owner's territory; an unknown team structure is the canonical one-clarifying-question | carry | ch17 | [x] |
| 275 | v0.6 §8 | Settled: field-block format is bullet lists; tables rejected for multi-sentence fields, hard line breaks rejected as invisible and fragile | carry | ch17 | [x] |
| 276 | v0.6 §8 | Settled: a plan's human scannability comes from a per-plan summary table, human-only, with zero agent context cost | carry | ch17 | [x] |
| 277 | v0.6 §8 | Settled: the dependency-graph format is Mermaid in both skills, always; cross-node edges dashed; contention is a field, not an edge | carry | ch17 | [x] |
| 278 | v0.6 §8 | Settled: sizing has a floor as well as a ceiling; a merge requires same tier, same contracts, a clean dependency shape, and window fit; artifacts-exceed-diff is the default merge smell | carry+amend (both ends restated in PE terms, vNext §10) | ch17 | [x] |
| 279 | v0.6 §8 | Settled: the review tier controls human attention *and* artifact depth; tasks and spec deltas never scale; a verification doc always exists | carry | ch17 | [x] |
| 280 | v0.6 §8 | Settled: one phase = one OpenSpec change = one review gate — unchanged invariant | carry | ch17 | [x] |
| 281 | v0.6 §8 | Settled: `openspec/config.yaml` at merge is ephemeral — take either side and re-run the phase switch | carry | ch17 | [x] |
| 282 | v0.6 §8 | Settled: a node's plan lives on exactly one lineage, and reconcile runs once, at the root lineage only | carry | ch17 | [x] |
| 283 | v0.6 §8 | Settled: textual contention is structured (`Collides with`), surfaced in the summary table, serializes execution, and never reshapes logical dependencies | carry | ch17 | [x] |
| 284 | v0.6 §8 | Settled: capability naming is per stable feature area by default; per-phase names only for genuinely parallel contention | carry | ch17 | [x] |
| 285 | v0.6 §8 | Settled: the verification doc has a bundled template with Outstanding and Sign-off, and the gate is not passed while an Outstanding item lacks a disposition | carry | ch17 | [x] |
| 286 | v0.6 §9 | "Implementation Steps" — including item 8, which proposes this very consolidation | scaffold | — | [x] |
| 287 | v0.6.1 §1 | "What 0.6.1 Changes and Why" — four instances of one failure class | scaffold (delta framing; §1's closing carries rows 288–289) | — | [x] |
| 288 | v0.6.1 §1 | Rules that live only in prose fire inconsistently: the same skill text produced conforming and non-conforming runs, and unpinned behavior with observed variance is the failure mode | carry | ch1 | [x] |
| 289 | v0.6.1 §1 | Every behavior that must fire gets a structural anchor — a required field, a checklist item, or an explicit stop — instead of more prose | carry | ch1 | [x] |
| 290 | v0.6.1 §2.1 | Downstream skills read only the node spec's closure (conventions plus the node spec plus contracts plus ADRs), so a detail absent from that closure is unreachable *by construction*, not by accident | carry | ch2 | [x] |
| 291 | v0.6.1 §2.1 | Restatement thins at every level of the tree; the pointer is the only carrier that scales | carry | ch2 | [x] |
| 292 | v0.6.1 §2.2 | The root spec carries a `## Sources` section listing each input document: path or URL, its authority (accepted RFC / draft / braindump / ticket), and one line on what it governs | carry | ch2 | [x] |
| 293 | v0.6.1 §2.2 | The node header gains `- **Sources:**` after `Governed by`, listing only the sources — or named sections of them — that govern that node, or "none" | carry | ch2 | [x] |
| 294 | v0.6.1 §2.2 | Sources trickle down at decomposition time, at every level: each child's Sources is the subset of the parent's that governs it, and a source relevant to several nodes appears on each | carry | ch2 | [x] |
| 295 | v0.6.1 §2.2 | The Sources field is required whenever the root `## Sources` section exists; it is omitted entirely only in projects with no source documents | carry | ch2 | [x] |
| 296 | v0.6.1 §2.2 | The summary indexes the source and never replaces it: restating a normative detail is fine, but the node's Sources must still name where it came from | carry | ch2 | [x] |
| 297 | v0.6.1 §2.2 | Quality gate: every input source appears in at least one node's Sources, or is marked in the root `## Sources` as "informative only — not decomposed" with a reason. No source is silently dropped | carry | ch2 | [x] |
| 298 | v0.6.1 §2.2 | Quality gate: no node's Sources lists a document that does not govern it — the field is context the next skill will read, not a bibliography | carry | ch2 | [x] |
| 299 | v0.6.1 §2.3 | Phase planning reads the node's Sources — the referenced documents or sections, not just the node spec's summary of them — before phasing | carry | ch7 | [x] |
| 300 | v0.6.1 §2.3 | A binding detail found only in a source must land where execution will see it: in a phase's Scope or Verification line, or in a contract `request` / `amend` entry so the contract body carries it | carry | ch7 | [x] |
| 301 | v0.6.1 §2.3 | Phases carry no Sources field and no source document is injected into a phase context; the phase context stays ~20 lines | carry | ch9 | [x] |
| 302 | v0.6.1 §2.3 | Wire-level source detail (envelopes, pagination rules, quotas) is exactly what contract bodies exist to absorb | carry | ch3 | [x] |
| 303 | v0.6.1 §2.3 | Anti-rationalization: "the spec captures everything important from the RFC" — summaries thin at every level; if the RFC is not in Sources its details are unreachable, not just unmentioned | carry | ch2 | [x] |
| 304 | v0.6.1 §3 | Phase Design Checklist item: adjacent same-tier phases were checked against the sizing floor, and every merge candidate kept separate names its reason | carry | ch7 | [x] |
| 305 | v0.6.1 §3 | When a merge-candidate pair is kept split, record the reason in one line — in the kept phase's section or a short note under the summary table; a plan with no merge-candidate pairs records nothing | carry | ch7 | [x] |
| 306 | v0.6.1 §3 | Anti-rationalization: "the node spec already lists N pieces, so N phases" — a prose enumeration is not a phase plan; run the floor over adjacent same-tier phases before accepting the count | carry | ch7 | [x] |
| 307 | v0.6.1 §4 | When the input does not state the team structure and the system plausibly spans stacks, do not choose an axis: ask "who builds what?" and stop until it is answered | carry | ch2 | [x] |
| 308 | v0.6.1 §4 | Here the clarifying question is mandatory, not permitted: an axis guessed wrong reworks every node beneath it | carry | ch2 | [x] |
| 309 | v0.6.1 §4 | Stating an assumption and proceeding covers details; it is never an alternative for the decomposition's shape | carry | ch2 | [x] |
| 310 | v0.6.1 §4 | The sharpened quality gate: the axis at each level matches ownership **stated by the human, not assumed** | carry | ch2 | [x] |
| 311 | v0.6.1 §4 | Anti-rationalization: "the axis is defensible either way, I'll pick a safe default" — defensible-either-way is the definition of a decomposition-changing unknown, and a flag at the bottom of a finished-looking tree does not get read | carry | ch2 | [x] |
| 312 | v0.6.1 §5 | Every child node — internal or leaf-parent — gets its own `hsdd/spec/{child-id}.md` at decomposition time | carry | ch2 | [x] |
| 313 | v0.6.1 §5 | The parent document embeds each child's header block as a summary; the child's file is the authoritative node spec, which the next skill appends to and a later decomposition edits in place | carry | ch2 | [x] |
| 314 | v0.6.1 §5 | Quality gate: every child node has its own spec file | carry | ch2 | [x] |
| 315 | v0.6.1 §5 | The standalone-file heading rule applies in every file (restates row 228 for decomposition output) | carry | ch2 | [x] |
| 316 | v0.6.1 §6 | Phase ids in the summary table and in every `Collides with` entry use the same id form as the phase section headers; the short `{n}.{i}` form is fine if used consistently throughout the plan | carry | ch7 | [x] |
| 317 | v0.6.1 §6 | `Collides with` may carry a one-line reason after an em dash | carry | ch7 | [x] |
| 318 | v0.6.1 §6 | `## Phase Plan` begins with the `**Default gate:**` line (when present) followed immediately by the summary table; prose commentary comes after the table, not before | carry | ch7 | [x] |
| 319 | v0.6.1 §6 | Cross-node dashed edges appear only when a phase actually depends on another node's artifact; a node that builds purely against contract fixtures draws none | carry | ch7 | [x] |
| 320 | v0.6.1 §7 | "Skill Edits (summary)" — including the users-guide tip "point at the doc, don't paste it", which is guide material, not a spec rule | scaffold | — | [x] |
| 321 | v0.6.1 §8 | Settled: source provenance lives in a root `## Sources` section plus a per-node field, trickled at every decomposition level; YAML frontmatter for it is rejected | carry | ch17 | [x] |
| 322 | v0.6.1 §8 | Settled: restate or reference — both are allowed but the pointer is mandatory; pasting source content into specs is rejected | carry | ch17 | [x] |
| 323 | v0.6.1 §8 | Settled: phases carry no Sources, and injecting source documents into phase contexts is rejected | carry | ch17 | [x] |
| 324 | v0.6.1 §8 | Settled: an unmapped source must be explicitly marked "informative only — not decomposed" with a reason; silence is the failure being fixed | carry | ch17 | [x] |
| 325 | v0.6.1 §8 | Settled: floor enforcement is a checklist item plus a conditional one-line kept-split reason; a mandatory floor-analysis section in every plan is rejected | carry | ch17 | [x] |
| 326 | v0.6.1 §8 | Settled: an unknown decomposition axis is asked and stopped on — mandatory, not permitted; proceed-with-flagged-assumption is rejected as the loophole, not the mitigation | carry | ch17 | [x] |
| 327 | v0.6.1 §8 | Settled: one file per child, every child, at decomposition time; the parent embeds only the summary block | carry | ch17 | [x] |
| 328 | v0.6.1 §8 | Settled: one phase = one OpenSpec change = one review gate — unchanged (restates row 280 in the 0.6.1 table) | carry | ch17 | [x] |
| 329 | v0.6.1 §9 | "Implementation Steps" | scaffold | — | [x] |
| 330 | v0.7 §1 | "What 0.7 Changes and Why" — the three field observations behind the management layer | scaffold (delta framing; §1's closing paragraphs carry rows 331–332) | — | [x] |
| 331 | v0.7 §1 | The packaging rule: the progress report, the revised execution plan, the milestone gate ticks, and the atlas are four views over one expensive evidence pass, so one skill runs the pass and emits every view | carry | ch12 | [x] |
| 332 | v0.7 §1 | Milestone *generation* stands alone, because it has a different trigger and a different audience | carry | ch12 | [x] |
| 333 | v0.7 §2.1 | `management/` joins `spec/`, `contract/`, and `adr/` at the HSDD root and holds the documents that run the project: progress reports, execution plans, milestone documents, and the atlas | carry | ch12, ch13 | [x] |
| 334 | v0.7 §2.1 | Management documents cite, never define: nothing in `management/` is normative — no open question, contract semantic, decision, or phase content is defined there | carry | ch12 | [x] |
| 335 | v0.7 §2.1 | A decision minuted in an execution plan or a sync agenda must land in its proper governance artifact — a spec `D{n}`, an ADR, a contract amendment — or it does not exist; the management document links to where it landed | carry | ch12 | [x] |
| 336 | v0.7 §2.1 | The layer is disposable by construction: deleting `management/` loses navigation, velocity history, and stakeholder communication — never truth | carry | ch12 | [x] |
| 337 | v0.7 §2.2 | Point-in-time management documents are dated files: `management/YYYY-MM-DD-progress.md`, `-execution-plan.md`, `-milestones.md` | carry | ch12 | [x] |
| 338 | v0.7 §2.2 | Each carries a `**Supersedes:**` header linking the previous document of its kind **by exact filename**, forming an unbroken audit chain | carry | ch12 | [x] |
| 339 | v0.7 §2.2 | Documents produced by an evidence pass carry a `**Repo baselines:**` header pinning the spec repo's and every implementation repo's commit SHA, including each repo's submodule pointer under the profile | carry | ch12 | [x] |
| 340 | v0.7 §2.2 | A milestone document does not review repos: it inherits its baselines from the progress report named in its `**Basis:**` header and must not restate SHAs it did not verify | carry | ch12 | [x] |
| 341 | v0.7 §2.2 | Each carries a `**Companion docs:**` header linking its same-date siblings, and a `## Change log` section | carry | ch12 | [x] |
| 342 | v0.7 §2.2 | After publication a dated document accepts exactly two in-place edits — ticking its own checkboxes and appending to its change log; anything more is a new superseding document | carry | ch12 | [x] |
| 343 | v0.7 §2.2 | One named exception: a milestone document is a living checkpoint tracker, so an *absorbed* scope change may update its gate contents in place, with a change-log entry saying what moved and why the window still holds | carry | ch12 | [x] |
| 344 | v0.7 §2.2 | A change that moves the dates is never absorbed — it is a re-baseline, and re-baselines supersede; progress reports and execution plans have no such exception | carry | ch12 | [x] |
| 345 | v0.7 §2.2 | Historical documents are never rewritten | carry | ch12 | [x] |
| 346 | v0.7 §2.2 | The atlas is the exception to the dated chain: one living file, `management/atlas.md`, regenerated in full on every checkpoint and overwritten each time, with git as its history | carry | ch12 | [x] |
| 347 | v0.7 §2.2 | Because the atlas filename carries no date, its header must: every atlas states the date it was generated and the artifact baselines it was derived from | carry | ch12 | [x] |
| 348 | v0.7 §2.3 | The progress report is the evidence view, and the execution plan and milestone document take their numbers from it, never from independent counting | carry | ch12 | [x] |
| 349 | v0.7 §2.3 | Progress-report header block: date, Supersedes (by exact filename), Repo baselines, Companion docs, and `**Method:**` — one line naming what was actually reviewed | carry | ch12 | [x] |
| 350 | v0.7 §2.3 | Required section — Bottom line: one table of phases planned / code-complete / remaining (externally-contingent broken out), implementation progress %, observed velocity per lane, calibrated remaining effort, calendar outlook | carry | ch12 | [x] |
| 351 | v0.7 §2.3 | Required section — Milestone gate status: one row per milestone with gate items met over total and each unmet item's blocker; this is the persisted input the slip trigger reads | carry | ch12 | [x] |
| 352 | v0.7 §2.3 | Required section — What is done, per node, **with evidence** | carry | ch12 | [x] |
| 353 | v0.7 §2.3 | **The only admissible "done":** the phase's verification document is merged to the spec repo's main branch; claims without a verification doc are reported as claims, not as done | carry | ch12 | [x] |
| 354 | v0.7 §2.3 | Required section — Velocity: the observed rate per lane, then the *calibrated* rate with its caveats stated; this calibration supersedes any earlier estimation document | carry | ch12 | [x] |
| 355 | v0.7 §2.3 | Required section — Blockers, ranked by urgency, each with what it blocks and its repair | carry | ch12 | [x] |
| 356 | v0.7 §2.3 | Required section — Findings register: every defect the evidence pass found (governance integrity, code-vs-plan drift, hygiene), with severity | carry | ch12 | [x] |
| 357 | v0.7 §2.3 | Required section — Verdict: a short honest paragraph on whether the method is working and what the real threat is | carry | ch12 | [x] |
| 358 | v0.7 §2.4 | The execution plan is the operational view, addressed to the people driving AI sessions this week | carry | ch12 | [x] |
| 359 | v0.7 §2.4 | Required sections: header block; an operating-model preamble (who executes, where prompts run, a pointer to the delegation guide); and current state as a delta since the superseded plan, in plan terms | carry | ch12 | [x] |
| 360 | v0.7 §2.4 | Required section — Ownership split: one table of nodes per lane, contracts per lane (single-writer), and external tracks per lane | carry | ch12 | [x] |
| 361 | v0.7 §2.4 | Required section — Sync points: the standing weekly plus any named consolidation or integration syncs, each with when, who, and agenda | carry+amend (v0.7.1 §4.2: the table keeps one row per sync, linking to that sync's section; rows 501–506) | ch12 | [x] |
| 362 | v0.7 §2.4 | Required section — Step tables per sync or lane batch, with stable step IDs, owner, action, dependency, and a done checkbox | carry | ch12 | [x] |
| 363 | v0.7 §2.4 | Required section — Copy-paste prompts with validation: for every delegable step, the exact prompt, the delegate / interactive / human-only marker, and a *Validate:* line naming the observable outcome to check by hand. Required, not decorative | carry+amend (superseded in part by v0.7.1 §2.2: the bullet becomes "Step details" — 🤖/🤝 keep the prompt and *Validate:* unchanged, 👤 steps gain the briefing; rows 492–495) | ch12 | [x] |
| 364 | v0.7 §2.4 | Required section — External tracks: the `E{n}` table (owner, current status, what happens on answer, which contingent phases it gates by OQ ID) | carry | ch12 | [x] |
| 365 | v0.7 §2.4 | Required section — Timeline: weeks × lanes, aligned to the milestone document's checkpoints | carry | ch12 | [x] |
| 366 | v0.7 §2.4 | Required section — Guardrails: an append-only numbered rule list; rules are never renumbered or deleted, and a lesson learned this week becomes the next number | carry | ch12 | [x] |
| 367 | v0.7 §2.5 | The milestone document is the stakeholder view and opens with "How to read this": demo and gate semantics, the slip tolerance, and the launch window as a base / optimistic / pessimistic triple | carry | ch12 | [x] |
| 368 | v0.7 §2.5 | Every milestone has a **demo** — something a stakeholder can watch work, not "module X complete"; a milestone with no demo is not a milestone, so find the demonstrable slice | carry | ch12 | [x] |
| 369 | v0.7 §2.5 | Every milestone has a **gate** of measurable yes/no checkboxes, where "phase X done" always means the pinned definition | carry | ch12 | [x] |
| 370 | v0.7 §2.5 | Required section — Contingent tail: externally-gated work with what it waits on, its entry criterion, and its estimate, deliberately excluded from the launch gate, each with a pre-agreed degradation path stated in the document | carry | ch12 | [x] |
| 371 | v0.7 §2.5 | Required section — Tracking: who ticks the gates and when, plus the re-baseline trigger | carry | ch12 | [x] |
| 372 | v0.7 §2.6 | Every atlas opens with a required stamp — a `Generated:` line (date and the skill that wrote it) and a `Derived from:` line naming the spec-repo and implementation-repo commits — followed by the statement that if the file disagrees with those artifacts, the file is wrong | carry | ch12 | [x] |
| 373 | v0.7 §2.6 | Atlas part 1 — the tree, root to phases: node status is `specified` or `phase-planned`, phase status is `planned` / `in-progress` / `done` / `contingent (OQ-id)`, rendered as a diagram down to nodes with a per-node phase-status table beneath | carry | ch12 | [x] |
| 374 | v0.7 §2.6 | Atlas part 2 — the contract graph: which nodes produce and consume which contracts with status on the edge set; one overview diagram at subsystem level, then one detail diagram per parent node; anything past roughly 20 nodes is split; never one mega-graph | carry | ch12 | [x] |
| 375 | v0.7 §2.6 | Atlas part 3 — the ADR coverage map from the `Governed by` links, as a table, with a diagram only where an ADR's reach is genuinely cross-cutting | carry | ch12 | [x] |
| 376 | v0.7 §2.6 | The atlas is derived only: every element must be reconstructible from the artifacts, and `done` is never derived from spec prose — prose carries claims | carry | ch12 | [x] |
| 377 | v0.7 §2.6 | The atlas introduces no new information, so it needs no reconcile, no ownership, and no review gate; if it disagrees with the artifacts it is wrong by definition and the fix is regeneration | carry | ch12 | [x] |
| 378 | v0.7 §2.7 | The findings→plan loop: every row of the progress report's findings register lands in the execution plan as a step, or is explicitly waived in the plan with a reason. No third state | carry | ch12 | [x] |
| 379 | v0.7 §2.7 | A finding that appears in two consecutive progress reports without a landed step is itself a finding, one level up | carry | ch12 | [x] |
| 380 | v0.7 §3.1 | Checkpoint step 1 — pin the baselines: the spec repo SHA, every implementation repo SHA, and under the profile each repo's submodule pointer | carry | ch12 | [x] |
| 381 | v0.7 §3.1 | A submodule pointer that does not reference a spec-repo main commit is recorded as a finding immediately, before any content review, because every conclusion drawn through a forked submodule is suspect | carry | ch12 | [x] |
| 382 | v0.7 §3.1 | Evidence pass — governance integrity: registry consistency, dangling references, open-question health, undrained pending-reconcile sections, the verification-doc audit, and management chain integrity | carry | ch12 | [x] |
| 383 | v0.7 §3.1 | Evidence pass — code versus plan, per implementation repo: what phases the code actually completes versus what the plans and the prior report claim; contract-surface drift in both directions; scope creep (code with no phase) | carry+amend (extends to phases and `## Observed surface`, design §6.11) | ch12 | [x] |
| 384 | v0.7 §3.1 | Checkpoint emits the progress report, revises the execution plan as a new dated superseding file with the findings compiled into steps, regenerates the atlas, and ticks the milestone gates | carry | ch12 | [x] |
| 385 | v0.7 §3.1 | Guardrail candidates from the week's lessons are *proposed*: the human accepts or rejects each | carry | ch12 | [x] |
| 386 | v0.7 §3.1 | Checkpoint evaluates the re-baseline trigger and reports it loudly if it fires | carry | ch12 | [x] |
| 387 | v0.7 §3.1 | Checkpoint's output ends with the same discipline it audits: what it changed, what it could not verify, and what needs a human decision — never a silent green | carry | ch12 | [x] |
| 388 | v0.7 §3.2 | Full mode is the default and runs the whole sequence; the intended cadence is weekly, before the team sync, and the cadence is a convention — nothing schedules anything | carry | ch12 | [x] |
| 389 | v0.7 §3.2 | Scoped mode takes named inputs and narrows the evidence pass to the artifacts the new context touches plus their closure (consumers of touched contracts, phase plans of touched nodes); code-versus-plan runs only where that closure reaches | carry | ch12 | [x] |
| 390 | v0.7 §3.2 | A scoped run still supersedes the plan, and may carry forward the previous progress report's numbers where the scope did not touch them — saying so | carry | ch12 | [x] |
| 391 | v0.7 §3.2 | Both modes end in a plan: a review that does not end in a plan is the confusion the layer exists to remove | carry | ch12 | [x] |
| 392 | v0.7 §3.3 | Checkpoint is read-only toward governance artifacts: it *finds* the stale note, the undrained section, the drift, and does not fix them — the fixes become plan steps routed to the owning skill and the owning human | carry | ch12 | [x] |
| 393 | v0.7 §3.3 | The only files checkpoint writes are `management/` files | carry+amend (it also re-runs the extraction script read-only for as-built drift, design §5.8) | ch12 | [x] |
| 394 | v0.7 §4.1 | Milestone precondition stop: every leaf-parent node has a phase plan — the first moment total scope is computable; if any lacks one, the skill stops and names the missing plans instead of generating | carry | ch12 | [x] |
| 395 | v0.7 §4.1 | Generation takes velocity from the latest progress report's calibration, or from the phase plans' assumed rate with a wider stated uncertainty band — and the document says which it used | carry | ch12 | [x] |
| 396 | v0.7 §4.1 | Milestones are demos, not internals: candidates are derived from the dependency structure — what becomes demonstrable when — not from the org chart or the node list | carry | ch12 | [x] |
| 397 | v0.7 §4.1 | The contingent tail is computed, not curated: every phase contingent on an external OQ lands in the tail with its degradation path, and an externally-gated phase inside the launch gate is a generation error | carry | ch12 | [x] |
| 398 | v0.7 §4.2 | Weekly gate-ticking belongs to checkpoint; `hsdd-milestone` runs again only to re-baseline | carry | ch12 | [x] |
| 399 | v0.7 §4.2 | The slip trigger: a gate red across two consecutive checkpoints | carry | ch12 | [x] |
| 400 | v0.7 §4.2 | The scope trigger: a change that moves the totals. If the dates hold the change is *absorbed* — gates updated, change-log entry, same file; if the dates move it is a *re-baseline* — a new dated document superseding the old, with both the old and the new window stated so the slip is visible instead of silently renormalized | carry | ch12 | [x] |
| 401 | v0.7 §4.2 | Re-baselining is a stakeholder event, not bookkeeping: the output says what changed, why, and what was decided, and that decision lands where decisions land | carry | ch12 | [x] |
| 402 | v0.7 §5.1 | OQ id scheme: the root spec mints `OQ{n}`; node specs mint `OQ-{prefix}{n}`, with the prefix set declared in conventions.md | carry | ch4 | [x] |
| 403 | v0.7 §5.1 | OQ ids are stable — never renumbered, never reused | carry | ch4 | [x] |
| 404 | v0.7 §5.1 | Resolved entries keep their table row and detail subsection as audit trail; they are never deleted | carry | ch4 | [x] |
| 405 | v0.7 §5.1 | One definition home: an OQ is defined exactly once, in the `## Open questions` section of the spec that owns the decision — the root for cross-cutting questions, the closest owning node otherwise | carry | ch4 | [x] |
| 406 | v0.7 §5.1 | A child spec needing a local view of a parent's question mints its own id and marks it `[inherits OQ{n}]`, which is what gives a question a spine from root to phase | carry | ch4 | [x] |
| 407 | v0.7 §5.1 | Every other artifact — leaf specs, contracts, ADRs, phase plans, management documents — cites the id only and never re-defines the question | carry | ch4 | [x] |
| 408 | v0.7 §5.1 | OQ format in the owning spec: a summary table (ID, Question, Status, Waits on, Affects) followed by one `### {ID} — {title}` detail subsection per entry, so `grep {ID}` always lands on the definition | carry | ch4 | [x] |
| 409 | v0.7 §5.1 | Status vocabulary: `OPEN` (undecided) · `PARTIAL` (partly resolved, residual named under *Waits on*) · `RESOLVED (date)` (decided, with the row pointing at where the decision landed) | carry | ch4 | [x] |
| 410 | v0.7 §5.1 | `ext:` under *Waits on* marks an external party and links the execution plan's E-track where one exists | carry | ch4 | [x] |
| 411 | v0.7 §5.1 | Resolving an OQ means all three: update the row and detail in the owning spec, land the decision in its proper artifact, and sweep citations that still treat it as open | carry | ch4 | [x] |
| 412 | v0.7 §5.1 | Prose that justifies a design choice as "pending OQ-x" after OQ-x resolved is a named defect class, not a cosmetic wrinkle | carry | ch4 | [x] |
| 413 | v0.7 §5.2 | The root and node spec templates carry the `## Open questions` section with its table and detail format, so specs are born conforming; the minting rules live at the decomposition step, where questions are first surfaced | carry | ch4 | [x] |
| 414 | v0.7 §5.2 | A contingent phase **must** name the OQ id it is contingent on: a contingency with no OQ behind it is an error with a stop — either the question exists and is cited, or it does not and must be surfaced to the owning spec first | carry | ch7 | [x] |
| 415 | v0.7 §5.2 | `hsdd-contract` and `hsdd-adr` are cite-only: resolving text points at the owning spec's id | carry | ch4 | [x] |
| 416 | v0.7 §5.2 | `hsdd-reconcile` gains the citation sweep: when a pass lands a resolution, it sweeps for citations still treating the question as open | carry | ch8 | [x] |
| 417 | v0.7 §5.2 | Checkpoint verifies OQ health every pass: every cited id defined exactly once, every definition in its owner's spec, statuses coherent, no stale pending-prose | carry | ch12 | [x] |
| 418 | v0.7 §5.2 | The conventions template gains an `## Open questions (OQ)` section carrying the convention and the project's prefix set | carry | ch13 | [x] |
| 419 | v0.7 §6.1 | The standalone-spec-repo profile is opt-in, declared in conventions.md, and triggered by more than one implementation repository; the single-repo layout remains the default and is untouched | carry | ch13 | [x] |
| 420 | v0.7 §6.1 | Under the profile the HSDD tree is its own git repository — the spec repo — and each implementation repo mounts it as a git submodule at `hsdd/` | carry | ch13 | [x] |
| 421 | v0.7 §6.1 | Every path is unchanged: the profile costs zero path changes, no skill needs conditional path resolution, and no document needs a profile-specific path example | carry | ch13 | [x] |
| 422 | v0.7 §6.1 | `management/` lives in the spec repo, because the layer describes the project rather than one subsystem and both lanes must see the same copy | carry | ch12, ch13 | [x] |
| 423 | v0.7 §6.2 | Skills run only from an implementation repo — never from a standalone clone of the spec repo; every invocation, governance-only ones included, runs with an implementation repo as the working directory and reaches governance through `hsdd/` | carry | ch9 | [x] |
| 424 | v0.7 §6.2 | The three reasons, each a field failure: a standalone clone is a third working copy whose pointer bump someone must remember; assertions need the code; one run location is one set of paths | carry | ch9 | [x] |
| 425 | v0.7 §6.2 | Writing through the submodule: governance edits land in the submodule working tree, are committed and pushed **inside the submodule** to spec-repo main, and each implementation repo's pointer is then bumped to that commit | carry | ch9 | [x] |
| 426 | v0.7 §6.2 | The pointer bump for repos other than the one you ran from is a separate step and the standard way pointers go stale — checkpoint audits every repo's pointer on every pass | carry | ch9, ch12 | [x] |
| 427 | v0.7 §6.2 | Cross-repo runs take the sibling repos' paths from the invoking prompt and ask for them when absent: repo locations differ per machine, so they are session input, never a checked-in registry | carry | ch9 | [x] |
| 428 | v0.7 §6.3 | Profile rule 1: submodule pointers only ever reference spec-repo main commits — a pointer into a feature branch silently forks the spec truth for every session in that repo | carry | ch13 | [x] |
| 429 | v0.7 §6.3 | Profile rule 2: a phase is done when its verification doc is on spec-repo main, the same day as sign-off, not parked on a feature branch; blank reviewer or disposition fields are a review failure, not a formality | carry | ch13 | [x] |
| 430 | v0.7 §6.3 | Profile rule 3: coordinated branch pairs land or die atomically — work spanning an implementation repo and the spec repo lives on a named branch pair, and neither side is merged or deleted without the other | carry | ch13 | [x] |
| 431 | v0.7 §6.3 | Profile rule 4: no squash-merging multi-phase epics — per-phase history is the velocity data and the audit trail; merge phase branches individually or merge-commit the epic with history intact | carry | ch13 | [x] |
| 432 | v0.7 §6.3 | Checkpoint audits all four profile rules on every pass | carry | ch12, ch13 | [x] |
| 433 | v0.7 §6.4 | The profile changes where the tree is versioned and where sessions run, nothing about the tree's shape: the freeze, sibling isolation, single-writer contracts, and reconcile ordering all apply unchanged, and so does every path they name | carry | ch13 | [x] |
| 434 | v0.7 §6.4 | Parallel phase planning still uses worktrees, and the execution branch protocol applies per implementation repo, with the branch-pair rule layered on when work spans repos | carry | ch13 | [x] |
| 435 | v0.7 §7.1 | A release states its compatibility contract explicitly: which artifact shapes change, what is opt-in, and that no skill loses a capability — so a project can upgrade mid-flight | carry+amend (v0.8.0 states its own, design §7) | ch14 | [x] |
| 436 | v0.7 §7.1 | A newly required stop binds only the artifacts authored by the run that hits it; pre-existing violations are reported for repair, never blocked | carry | ch14 | [x] |
| 437 | v0.7 §7.2 | The adoption run: the first checkpoint on an existing project treats nonconformances as findings, not errors — each becomes a findings-register row and, per the findings loop, a migration step in the emitted plan; the run never hard-fails on the state it exists to repair | carry | ch14 | [x] |
| 438 | v0.7 §7.2 | Existing documents are adopted, not replaced: pre-existing management documents become the head of the supersedes chain, and existing numbered guardrails are imported under their numbers rather than restarted | carry | ch14 | [x] |
| 439 | v0.7 §7.2 | The first atlas is generated whatever state the tree is in — an atlas of a messy tree is precisely the map the cleanup needs | carry | ch14 | [x] |
| 440 | v0.7 §7.2 | `hsdd-milestone` behaves symmetrically: an existing milestone document is recognized as the current baseline and never duplicated | carry | ch14 | [x] |
| 441 | v0.7 §7.3 | Acceptance is evidence-backed and recorded before the run: a release is not done until the new behavior runs against a live project and produces conforming documents without manual repair | carry+amend (v0.8.0's own thirteen criteria, design §11) | ch14 | [x] |
| 442 | v0.7 §7.3 | A run that comes back clean on a repo known to contain findings fails acceptance in the more important direction | carry | ch14 | [x] |
| 443 | v0.7 §8.1 | The skill roster is stated per release with each skill's change, and each new skill gains a slash command | carry+amend (ten skills; the per-skill change table belongs to ch14, never ch1) | ch1 | [x] |
| 444 | v0.7 §8.2 | Layout addition: `management/YYYY-MM-DD-progress.md`, `-execution-plan.md`, `-milestones.md`, and `atlas.md` under the HSDD root | carry+amend (adds `management/archive/` and the intake record, design §6) | ch13 | [x] |
| 445 | v0.7 §8.3 | "Relationship to the 0.8 candidate (vNext mechanization)" — the planned hand-off to the CLI | drop (this document resolves the relationship: the tool-free half is absorbed per design §3.2, the CLI is dropped) | — | [x] |
| 446 | v0.7 §9 | Settled: two skills, not four, not zero — one evidence pass feeds four views, and milestone generation alone has a distinct trigger and audience | carry | ch17 | [x] |
| 447 | v0.7 §9 | Settled: the management layer is field-driven and ships now; mechanization is a bigger bet with its own release | carry+amend (resolved: the tool-free half is absorbed, the CLI is dropped) | ch17 | [x] |
| 448 | v0.7 §9 | Settled: cite, never define — management documents are views, and deleting `management/` loses no truth | carry | ch17 | [x] |
| 449 | v0.7 §9 | Settled: a dated chain for point-in-time documents and one living atlas; tick-and-append are the only in-place edits; supersedes links are by exact filename | carry | ch17 | [x] |
| 450 | v0.7 §9 | Settled: checkpoint ticks, milestone re-baselines | carry | ch17 | [x] |
| 451 | v0.7 §9 | Settled: open questions are a convention plus structural anchors, not a skill | carry | ch17 | [x] |
| 452 | v0.7 §9 | Settled: the profile is normative and opt-in and moves no paths; its content is the run-location rule plus four incident-backed rules; single-repo remains the default | carry | ch17 | [x] |
| 453 | v0.7 §9 | Settled: additive compatibility is a contract, not an aspiration, with a live project as the acceptance fixture | carry | ch17 | [x] |
| 454 | v0.7 §9 | Settled: rejected document classes, as derivable or duplicative — a standalone risk register, sync minutes, a stakeholder one-pager, a standalone estimation doc | carry | ch17 | [x] |
| 455 | v0.7 §10 | Non-goal: no mechanization — no CLI, no generated registries beyond what exists, no lint tooling | carry+amend (scripts are permitted only under the design §3.1 boundary) | ch15 | [x] |
| 456 | v0.7 §10 | Non-goal: no scheduling — the weekly cadence is convention and nothing fires on a timer | carry | ch15 | [x] |
| 457 | v0.7 §10 | Non-goal: no new governance semantics — freeze, reconcile, ownership, and tiers are untouched, and the management layer sits strictly downstream of them | carry | ch15 | [x] |
| 458 | v0.7 §10 | Non-goal: no multi-team org model | carry+amend (the `Team` field lands; acks, ADR approvals, and profile lint do not) | ch15 | [x] |
| 459 | v0.7 §10 | Non-goal: no dashboard or BI ambitions for the atlas — it is a markdown file with diagrams, regenerated whole | carry | ch15 | [x] |
| 460 | v0.7 §11 | "Implementation Plan" | scaffold | — | [x] |
| 461 | vNext §5.1 (design §3.2) | A contract may not be `stable` unless it carries at least one executable validation artifact — a schema or a fixtures directory — at the canonical paths its frontmatter names; `hsdd-reconcile` asserts it at the `draft → stable` flip | carry (vNext salvage: absorbed) | ch3 | [x] |
| 462 | vNext §5.1 (design §3.2) | Default validation locations are `hsdd/contract/schema/` and `hsdd/contract/fixture/`, overridable — the contract's frontmatter is authoritative either way; guidance per kind (api/event want schema plus example payloads, schema/shared-model want edge-case fixtures, file wants a sample tree, cli wants recorded invocations) | carry (vNext salvage: absorbed) | ch3 | [x] |
| 463 | vNext §5.2 (design §3.2) | Both gates run the contract — producer side: the gate of any phase that produces a contract must check that its real output validates against the schema and reproduces the fixtures, written into the phase's `Gate` by default | carry (vNext salvage: absorbed) | ch3, ch10 | [x] |
| 464 | vNext §5.2 (design §3.2) | Both gates run the contract — consumer side: consuming phases build and test against the fixtures, not hand-rolled mocks. The mocks *are* the fixtures, so a bump fails consumer tests loudly instead of drifting silently | carry (vNext salvage: absorbed) | ch3, ch10 | [x] |
| 465 | vNext §5.3 (design §3.2) | Integration nodes: when an internal node's children exchange contracts, `hsdd-spec` should add a `{node}.integration` child leaf-parent with `hard` edges to each producing sibling, whose phases exercise the real composed behavior and default to `full-review` | carry (vNext salvage: absorbed) | ch3 | [x] |
| 466 | vNext §5.3 (design §3.2) | Because its edges are `hard` the DAG schedules an integration node after its producers ship; a small tree that is one leaf-parent needs none, since its final composition phase already covers it | carry (vNext salvage: absorbed) | ch3 | [x] |
| 467 | vNext §5.3 (design §3.2) | An integration node still has exactly one owning team — whoever owns the composed, user-facing behavior; consuming two teams' contracts is not co-ownership | carry (vNext salvage: absorbed) | ch3 | [x] |
| 468 | vNext §6 (design §3.2) | The verification template gains `## Learnings`, and every entry carries exactly one disposition: `spec-updated` / `contract-bumped (id@v)` / `adr-proposed (ADR-nnn)` / `dropped (reason)`. "- none" is a valid entry; silence is not | carry (vNext salvage: absorbed) | ch10 | [x] |
| 469 | vNext §6 (design §3.2) | The two sections divide cleanly: Outstanding is about this phase's claims, Learnings is about the tree. Both gate sign-off — the review gate is not passed while either holds an undispositioned item | carry (vNext salvage: absorbed) | ch10 | [x] |
| 470 | vNext §6 (design §3.2) | Dispositions execute through the owning skills, at the root, by the human running the gate, so the phase-session prohibition on editing governance is untouched | carry (vNext salvage: absorbed) | ch10 | [x] |
| 471 | vNext §6.2 (design §3.2) | Mid-phase contract renegotiation: pause the apply at a task boundary, record the gap in `request` / `amend` vocabulary, renegotiate at the root lineage with the human, propagate the change into the phase branch, re-derive the phase context, resume — and never improvise around the contract | carry+amend (the re-derive step is the push-based switch; vNext's CLI call is dropped) | ch10 | [x] |
| 472 | vNext §6.3 (design §3.2) | Boundary corrections: when shipped phases reveal a wrong decomposition, `hsdd-spec` re-decomposes the affected subtree, archived changes stay put, and old ids stay resolvable | carry+amend (the mechanical rewrite stays skill work; `hsdd rename` and `lint` are dropped) | ch10 | [x] |
| 473 | vNext §8.1 (design §3.2) | Claims rewrite — isolation: context injection shapes attention and the isolation rules held under adversarial pressure, but they are probabilistic, not enforced; HSDD does not mechanically prevent a session from reading a file outside its phase | carry+amend (the `Touches` / check-scope remedy is dropped with vNext §8.2) | ch15 | [x] |
| 474 | vNext §8.1 (design §3.2) | Claims rewrite — tokens: per-session context is bounded by the phase, not the system; total project tokens still scale with phase count, decomposition itself costs tokens, and below a handful of PEs plain OpenSpec is cheaper | carry (vNext salvage: absorbed) | ch15 | [x] |
| 475 | vNext §10 (design §3.2) | One PE is the largest unit of change one reviewer can genuinely review and manually verify in a single sitting, plus the agent run that produces it — working guidelines ~≤400 changed lines of non-generated code, ≤8 OpenSpec tasks, about half a working day end to end | carry (vNext salvage: absorbed) | ch7 | [x] |
| 476 | vNext §10 (design §3.2) | The ~5h rolling window is an explicitly non-normative calibration note, not the definition: the review sitting is the invariant, and all "~5h window" phrasing is replaced by "one review sitting" | carry (vNext salvage: absorbed) | ch7 | [x] |
| 477 | vNext §10 (design §3.2) | Floor and ceiling are two ends of one rule in the same unit: a phase must fit one review sitting (split if not) and must earn one (merge candidates if not) | carry (vNext salvage: absorbed) | ch7 | [x] |
| 478 | vNext §11 (design §3.2) | Phase ordering is a named policy selected in conventions frontmatter: `interfaces-first` (default — stable interfaces and shared types first, effects behind interfaces, composition last), `fp-progression`, or a project-defined policy documented in the conventions body | carry (vNext salvage: absorbed) | ch7 | [x] |
| 479 | vNext §11 (design §3.2) | `hsdd-phase-plan` reads the ordering policy and orders phases accordingly; sizing, tiers, gates, the summary table, and the floor are policy-independent | carry (vNext salvage: absorbed) | ch7 | [x] |
| 480 | vNext §12 (design §3.2) | Brownfield adoption is a first-class entry point with its own skill, `hsdd-adopt`, whose output feeds the standard loop unchanged | carry+amend (rewritten per design §5: `v0` not `v1`, `## Observed surface`, a bundled extraction script, no `hsdd registry`/`lint` proof step) | ch6 | [x] |
| 481 | vNext §13.1 (design §3.2) | The `Team` node field records the answer to "who builds what?", which currently shapes the tree and then evaporates | carry+amend (the field only; `hsdd lint --profile multi-team` enforcement is dropped) | ch2, ch13 | [x] |
| 482 | vNext §14.1 (design §3.2) | The verification template gains an optional `## Metrics` block, filled at the gate while the numbers are fresh: agent wall-clock, review wall-clock, gate failures before green, tokens if the harness reports them, product diff versus process artifacts, and escaped defects filled retroactively | carry+amend (no `hsdd status --write` aggregation) | ch10 | [x] |
| 483 | vNext §14.2 (design §3.2) | The evidence program: one real system built end to end with HSDD, published with its tree, contracts, verification docs, and metrics, including a comparison baseline — stated as release criteria for v1.0 | carry (vNext salvage: absorbed) | ch16 | [x] |
| 484 | vNext §2 (design §3.2) | The normative grammar (machine-parseable node header, phase section, contract frontmatter, and conventions frontmatter) | drop (it only mattered as parser input; the 0.6.1 bullet templates already stand as the authored format) | — | [x] |
| 485 | vNext §3 (design §3.2) | The `hsdd` CLI and its commands: `registry`, `context`, `lint`, `status`, `rename`, `check-scope`, `template` | drop (registry generation stays script-based; everything else stays skill work) | — | [x] |
| 486 | vNext §4 (design §3.2) | Pull-based phase context (context as a pure function, derived on demand) | drop (the push-based switch of v0.3 §9 / v0.4 §5, as implemented in `hsdd-config`, survives unchanged) | — | [x] |
| 487 | vNext §7 (design §3.2) | Derived state, and the retirement of `confirm`, `produced_by`, `consumers`, and `phase_ids` | drop (these fields and the `confirm` entry kind survive as authored, per v0.3 §5.1 / v0.4.2; derivation of done-ness survives anyway via v0.7 checkpoint's verification-doc rule) | — | [x] |
| 488 | vNext §8.2 (design §3.2) | `Touches` globs plus `hsdd check-scope` gate enforcement of a phase's file footprint | drop (dead surface: v0.6's `Collides with` already carries the collision signal) | — | [x] |
| 489 | vNext §9 (design §3.2) | The `hsdd-review` skill, its per-tier checklists, PR-based sign-off, and the leverage-based tier floor | drop (deferred; the 0.6 review tiers and gate commands stand) | — | [x] |
| 490 | vNext §13.2, §13.3 (design §3.2) | Cross-team contract acks before `stable`, and multi-team ADR approvals before `accepted` | drop (lint-enforced, so honor-system without it; deferred) | — | [x] |
| 491 | v0.7.1 preamble, §1, §2.1, §3.1, §4.1 | "What 0.7.1 Changes and Why" and the three "observed failure" narratives — the 07-31 checkpoint plan's regressions and the supersedes-in-part note | scaffold | — | [x] |
| 492 | v0.7.1 §2.2 | Step details: every step in every step table gets exactly one detail block, keyed by step ID; no step's content lives only in its table cell | carry | ch12 | [x] |
| 493 | v0.7.1 §2.2 | The 👤 briefing form — *Why:* one or two sentences of context, finding IDs cited in parentheses after the fact they justify, never as the subject; *Do:* a checklist, one checkbox per action, each naming its concrete target (file, branch, field, person); *Done when:* one observable line, the human analogue of *Validate:* | carry | ch12 | [x] |
| 494 | v0.7.1 §2.2 | The cell indexes, the block instructs: the Action cell holds a one-sentence summary; a cell that needs a second sentence, a semicolon-chained list, or more than two parenthetical citations has outgrown the table — move the content into the detail block | carry | ch12 | [x] |
| 495 | v0.7.1 §2.2 | Checkpoint quality gates: every step in every step table has exactly one detail block (prompt + *Validate:* for 🤖/🤝, a *Why / Do / Done when* briefing for 👤); no Action cell carries more than one sentence | carry | ch12 | [x] |
| 496 | v0.7.1 §3.2 | Plan graph — required section between Sync points and the step tables: one Mermaid flowchart of the plan ahead, every load-bearing sync as a junction node, every step batch as a node inside its lane's subgraph, edges from the `Depends` column and the sync sections' *Unblocks* lines | carry | ch12 | [x] |
| 497 | v0.7.1 §3.2 | The graph is derived from the tables the way the atlas is derived from the artifacts: regenerated whole with every plan; when graph and tables disagree, the tables are right — regenerate the graph | carry | ch12 | [x] |
| 498 | v0.7.1 §3.2 | Plan-graph ceiling: the atlas's ~20-node ceiling applies — chart batches, never individual phases; follow `mermaid-pastel-style` if installed | carry | ch12 | [x] |
| 499 | v0.7.1 §3.2 | Scoped-mode runs get no exemption: a scoped checkpoint still supersedes the whole plan, so the plan it emits still carries the graph | carry | ch12 | [x] |
| 500 | v0.7.1 §3.2 | Checkpoint quality gate: plan graph present and consistent with the tables — every load-bearing sync and every step batch appears exactly once, every edge traces to a `Depends` entry or an *Unblocks* line, and the graph stays under ~20 nodes | carry | ch12 | [x] |
| 501 | v0.7.1 §4.2 | Definition: a sync is load-bearing when any step, decision, or lane start names it as a dependency | carry | ch12 | [x] |
| 502 | v0.7.1 §4.2 | One section per load-bearing sync (the standing weekly is exempt: it has a rhythm, not a gate), carrying Entry (checkboxes: what must be done or brought, citing step IDs), Agenda, Exit (checkboxes: discharged when every box ticks; a decision's box names its landing artifact), and Unblocks (one line per lane: what starts when this sync exits) | carry | ch12 | [x] |
| 503 | v0.7.1 §4.2 | Agenda decisions are defined in the sync section once: a stable ID (the field's D-a scheme), the question, the live options, and the governance artifact the answer must land in; steps, tracks, and other syncs cite these IDs — the definition never appears twice | carry | ch12 | [x] |
| 504 | v0.7.1 §4.2 | The sync-points table keeps one row per sync — when, who, a one-line agenda — linking to the section; a step's `Depends` column may name a sync only if that sync has a section | carry | ch12 | [x] |
| 505 | v0.7.1 §4.2 | Cite-never-define is preserved: the agenda defines the *question* (options and landing artifact), the *answer* lands in its governance artifact, and the Exit box cites it | carry | ch12 | [x] |
| 506 | v0.7.1 §4.2 | Checkpoint quality gates: every load-bearing sync has a section with Entry / Agenda / Exit / Unblocks and no step depends on a sync without one; every decision queued for a sync is defined once, in that sync's Agenda, and only cited everywhere else | carry | ch12 | [x] |
| 507 | v0.7.1 §2.2, §3.2, §4.2 | Three anti-rationalization rows: "the table cell already says everything the briefing would", "the Depends column already encodes the graph", "the sync has an agenda row in the table — that's the checklist" | carry | ch12 | [x] |
| 508 | v0.7.1 §5 | "Skill Edits (summary)" — including the users-guide updates (plan-graph walkthrough, sync-section example, the briefing rule in the delegation guide), which is guide material, not a spec rule | scaffold | — | [x] |
| 509 | v0.7.1 §6 | Settled: every step gets exactly one detail block. Rejected: briefings only for "complex" steps (the complexity judgment is the loophole); richer table cells (that is the defect, formalized) | carry | ch17 | [x] |
| 510 | v0.7.1 §6 | Settled: detail-block existence is mandated, grouping is not — under the owning sync's section or in one step-details section both conform; what failed in the field was absence, not placement | carry | ch17 | [x] |
| 511 | v0.7.1 §6 | Settled: plan-graph granularity is load-bearing syncs plus step batches. Rejected: per-phase graphs (the atlas's tree, unreadable as a weekly map); optional-when-small (the smallest plan still has a shape; the cost is one fence) | carry | ch17 | [x] |
| 512 | v0.7.1 §6 | Settled: only load-bearing syncs get sections; the standing weekly stays a table row. Rejected: sections for every row (ceremony without a gate to define) | carry | ch17 | [x] |
| 513 | v0.7.1 §6 | Settled: sync agendas do not violate cite-never-define — the question is defined in the agenda, the answer lands in governance; the R6/G-1 precedent made structural | carry | ch17 | [x] |
| 514 | v0.7.1 §6 | Settled: the progress report does not change — its dense tables are registers, diffed and compiled from, not executed from; briefing-grade unreadability recurring there is 0.7.2's evidence, not this delta's guess | carry | ch17 | [x] |
| 515 | v0.7.1 §6 | Settled: the findings→plan loop is an unchanged invariant — briefings and sync sections change how steps read, never whether findings land | carry | ch17 | [x] |
| 516 | v0.7.1 §7 | Implementation steps and the on-release re-sync note | scaffold | — | [x] |
| 517 | design §3.1 | The scripting boundary: a script may ship bundled with a new skill where it materially improves cost or determinism; no script may change how an existing skill behaves | new | ch6 | [x] |
| 518 | design §3.1 | `hsdd-adopt` bundles `scripts/extract-seams.mjs`: manifests, directory tree, route registrations, proto/OpenAPI/GraphQL schemas, DB migrations, event topic producers and consumers, `CODEOWNERS`, and `git log --numstat` coupling clusters | new | ch6 | [x] |
| 519 | design §5.1 | Seam archaeology extracts, never reads: the bundled script emits the structure, and the extraction commit SHA is recorded | new | ch6 | [x] |
| 520 | design §5.1 | Propose a shallow tree (depth 1–2) on the seams that exist, not the ones anyone wishes existed; the ownership-first axis applies; `CODEOWNERS` plus history turns the mandatory "who builds what?" stop into a confirmation rather than a blocker | new | ch6 | [x] |
| 521 | design §5.1 | As-built node specs: one file per node, the standard bullet header plus `- **Adopted:** as-built`, plus `## Observed surface` | new | ch6 | [x] |
| 522 | design §5.1 | Contracts from seams at `version: v0`, defined as current behavior | new | ch6 | [x] |
| 523 | design §5.1 | Stop rule: no decomposition below what the first change needs | new | ch6 | [x] |
| 524 | design §5.1 | Prove the tree: regenerate the contract and ADR registries | new | ch6 | [x] |
| 525 | design §5.2 | `## Observed surface` carries: extracted date @ SHA (and the script), modules, routes, tables, topics, owners, and `unknown:` lines; the epistemic split is per-section, not per-file — authored bullet fields claim intent, Observed surface claims only what tooling saw | new | ch6 | [x] |
| 526 | design §5.2 | Observed surface is at seam level, not file level — "the pointer scales, the summary thins" governs it verbatim | new | ch6 | [x] |
| 527 | design §5.3 | `unknown:` lines are required, not optional — a node with no unknowns is a node nobody looked at | new | ch6 | [x] |
| 528 | design §5.3 | An adopted node's `Isolation strategy` records how the node is exercised today (existing tests, staging), never an aspiration | new | ch6 | [x] |
| 529 | design §5.3 | Adopted contracts describe observed behavior, warts included; a wart worth fixing becomes a Learning at a later gate, then a versioned bump with a migration note — never silently corrected during extraction | new | ch6 | [x] |
| 530 | design §5.3 | `hsdd-adopt` never proposes refactoring the system to fit a nicer tree; the tree fits the system; boundary improvements arrive later as Learnings and ADRs | new | ch6 | [x] |
| 531 | design §5.4 | Adopted contracts start `version: v0`; `v1` comes to mean the first version HSDD designed; `@v0` reads observed-not-designed at every reference site | new | ch6 | [x] |
| 532 | design §5.4 | Adopted contracts start `status: stable` — schemas from code or captured traffic, fixtures from existing tests or captured payloads, satisfying the executable-validation rule | new | ch6 | [x] |
| 533 | design §5.4 | Required `## Observed completeness` caveat in every adopted contract body: covered by fixtures / NOT exercised / inferred-never-observed; maintained, not write-once — when a phase closes a gap it updates the block, and a stale caveat is a checkpoint drift finding | new | ch6 | [x] |
| 534 | design §5.4 | `v0` is a permanent property, not a waypoint; `v0 → v1` is the contract-level adoption exit, taken when the interface is genuinely redesigned rather than extended; `additive-only` constrains what may happen without a bump, never forbids one | new | ch6 | [x] |
| 535 | design §5.5 | Promotion (as-built → governed) recurs for the life of the system: triggered when a change routes to an as-built node; `hsdd-spec` decomposes it taking `## Observed surface` as a primary source; a human confirmation stop precedes authority; the field becomes `- **Adopted:** promoted` and Observed surface stays as provenance | new | ch6 | [x] |
| 536 | design §5.5 | The confirmation stop keeps the validated fraction at 100%: a node spec is only generated when someone is about to work on it and therefore actually reads it | new | ch6 | [x] |
| 537 | design §5.6 | Adoption cost scales with seam count, not LOC — stated explicitly so nobody budgets by LOC | new | ch6 | [x] |
| 538 | design §5.6 | The trust argument against full-depth reverse engineering: an as-built spec's value is capped by whether a human confirmed it; unread wrong specs propagate, making full-depth adoption worse than no adoption | new | ch6 | [x] |
| 539 | design §5.7 | The mixed tree is normal and permanent; some nodes stay as-built forever; the as-built ↔ governed seam is where the contract must be real, exercised via integration nodes; reachable from the governed side too | new | ch6 | [x] |
| 540 | design §5.8 | As-built drift: checkpoint re-runs `extract-seams.mjs` per adopted node and diffs against the recorded `## Observed surface`; a diff is a finding, not an error, landing in the findings register; the whole check is skipped when the tree has no adopted nodes | new | ch12 | [x] |
| 541 | design §6 | `hsdd-intake` is separate from checkpoint on both axes: event-driven vs periodic, writes into governance vs read-only toward it; input is a change request (PRD, RFC, ticket, incident) plus the atlas; output an intake record at `hsdd/management/YYYY-MM-DD-intake-{slug}.md`, then a handoff | new | ch11 | [x] |
| 542 | design §6.1 | A PRD is never a root: there is one tree and it is the system's; a PRD is an input producing nodes grafted and phases appended; the rule is stated with the failure it prevents (wipe-`hsdd/`-per-project) named alongside | new | ch11 | [x] |
| 543 | design §6.1 | The PRD goes into `## Sources` on every node it governs; it is visible as one unit of work only in the intake record; the split: spec tree = system structure, permanent; management layer = work units, episodic | new | ch11 | [x] |
| 544 | design §6.2 | Routing classes: `local` → phase-plan append mode; `cross-node` → contract bump and/or ADR, then phase-plan each; `new-capability` → spec graft mode on the existing parent; `structural` → stop, human decision. Landing on an as-built node is not a fifth class: promote first, then reclassify | new | ch11 | [x] |
| 545 | design §6.2 | The routing decision is written before the handoff, so the choice is auditable rather than implicit in whatever the next skill did | new | ch11 | [x] |
| 546 | design §6.3 | Phase-plan append mode: continue numbering from the highest existing phase id; never renumber, never rewrite a shipped phase; the phase summary table becomes a permanent ledger; shipped-ness is not authored — it derives from the verification doc on spec-repo main | new | ch11 | [x] |
| 547 | design §6.4 | Spec graft mode: existing children's ids are stable, the new child takes the next slug; the parent's embedded child summaries and Mermaid DAG gain the node; any contract the new child consumes from a sibling goes through the normal request / governance-freeze path — grafting does not bypass it | new | ch11 | [x] |
| 548 | design §6.5 | Intake records are dated and never superseded, unlike progress reports and execution plans; this is the rule that replaces "wipe `hsdd/` and rebuild", stated as such | new | ch11 | [x] |
| 549 | design §6.6 | Node retirement: `- **Status:** retired`; the file is kept in place so ids stay resolvable for history; excluded from the atlas's active view; contracts it solely produced go to `retired` | new | ch11 | [x] |
| 550 | design §6.7 | Before routing, intake reads every open intake record; collisions are serialized rather than raced: same node or contract → serialize or merge into one record (record which); two grafts under the same parent → serialize; same as-built node needing promotion → promote once, share the result | new | ch11 | [x] |
| 551 | design §6.7 | An intake record closes when every phase it produced has a verification doc on main — the same admissibility rule as everywhere else | new | ch11 | [x] |
| 552 | design §6.8 | Milestones are per-campaign (the adoption bootstrap, one change request's fan-out, or a release train); when every gate is green the document is sealed: `- **Sealed:** YYYY-MM-DD`, moved to `hsdd/management/archive/`, checkpoint stops ticking it; sealing admissibility is the existing verification-doc-on-main rule — evidence-backed, never declared | new | ch12 | [x] |
| 553 | design §6.9 | `compatibility:` is a declared per-contract policy in frontmatter: `additive-only` (Protobuf discipline — optional additions only, never remove, retype, or repurpose; consumers ignore unknowns; compatible changes keep the version and field-level deprecation replaces contract-level bumps) / `versioned` (default — breaking change bumps the version, adds a migration note, opens a deprecation window) / `frozen` (any change means a new contract) | new | ch3 | [x] |
| 554 | design §6.9 | Enforcement, not aspiration: `additive-only` is claimable only if the contract's existing fixtures still pass against the new schema; both gates already replay the contract | new | ch3 | [x] |
| 555 | design §6.9 | `compatibility` is declared per version, not per contract; extension under `additive-only` never exits `v0` — only a redesign does | new | ch3 | [x] |
| 556 | design §6.9 | Full status lifecycle `draft → stable → deprecated → retired`, with a sunset date and migration note on the deprecating version; `external_consumers` covers consumers outside the tree; retiring a version with a live consumer is a checkpoint finding | new | ch3 | [x] |
| 557 | design §6.10 | The legal bypass: ship the hotfix; checkpoint's code-vs-plan pass flags it as code with no phase; a backfill finding becomes an execution-plan step; the step appends a retro phase to the owning node's plan with a verification doc written after the fact and explicitly marked retroactive; a backfill unclosed across two consecutive checkpoints escalates | new | ch11 | [x] |
| 558 | design §6.11 | Checkpoint maintenance mode: post-launch the drift question inverts — is the plan behind the code?; the code-vs-plan pass extends to phases and to as-built `## Observed surface` sections | new | ch12 | [x] |
| 559 | design §7 | v0.8.0 is additive: no existing project rewrites anything; the upgrade vehicle is checkpoint's Adoption Run — nonconformances are findings, existing documents are adopted not replaced, and findings become migration steps in the emitted execution plan; conformance applies from the next document forward | new | ch14 | [x] |
| 560 | design §7 | The upgrade compatibility table for ≥0.6.1 projects: Learnings/Metrics forward-only; `Team` optional; ordering policy absent = `interfaces-first`; unified PE applies to future sizing only; stable-requires-validation grandfathered; `compatibility` absent = `versioned`; `retired` and the deprecation lifecycle additive; the existing milestone document becomes the current campaign's; intake/append/graft used from the next change forward; adopt/`@v0`/Observed surface inert without unadopted code | new | ch14 | [x] |
| 561 | design §7 | A fully-governed ≥0.6.1 project usually still has system surface that was never in the tree; `hsdd-adopt` runs on that, grafting as-built nodes alongside governed ones — the mixed tree reached from the governed side is the normal end state | new | ch14 | [x] |
| 562 | design §7 | Projects below 0.6.1 are out of scope: upgrade to 0.6.1 first per the existing delta reading path, which remains in `spec/` as history | new | ch14 | [x] |
| 563 | design §7.1 | Grandfather property 1 — the set is closed at upgrade: the upgrade checkpoint enumerates every contract already `stable` without executable validation and marks each `validation: grandfathered`; nothing joins the set afterward; a new contract flipped `draft → stable` without fixtures is an error, not a grandfather case | new | ch14 | [x] |
| 564 | design §7.1 | Grandfather property 2 — discharge on touch, not on a date: the moment any phase produces, amends, or bumps a grandfathered contract, it must gain fixtures before the phase's gate passes; obligations attach to work, not calendars | new | ch14 | [x] |
| 565 | design §7.1 | Grandfather property 3 — the remaining count is reported in each checkpoint's progress report and can only fall; a count that rises is a finding | new | ch14 | [x] |
| 566 | design §7.1 | The rejected alternatives are stated: a fixed sunset date (HSDD does not control anyone's calendar; a cliff invites blanket waivers) and permanent unmarked grandfathering (invisible, uncountable, never drains) | new | ch14 | [x] |
| 567 | design §4 | Provenance is a required column in the settled-decisions table: `field-tested`, `pressure-tested`, or `reasoned-only` — new material must not inherit credibility from the tested parts | new | ch17 | [x] |
