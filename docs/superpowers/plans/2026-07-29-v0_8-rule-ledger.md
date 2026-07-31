# v0.8.0 Rule Ledger

Test harness for `spec/hsdd-spec-v0_8.md` acceptance criterion 1.
Every normative rule in v0.3–v0.7 gets a row. A rule is normative if it
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
| 1 | v0.3 §4.4 | Node id is the dotted path of slugs from the root; leaf phases numbered | carry | ch2 | [ ] |
| 2 | v0.3 §5.1 | Contract frontmatter carries id, version, status, kind, owner | carry+amend (adds `compatibility`) | ch3 | [ ] |
| 3 | v0.4.2 §3.1 | Phase planning may not edit shared governance files; it emits a pending section | carry | ch8 | [ ] |
| 4 | v0.3 §1 | OpenSpec stays the execution engine; HSDD changes the unit of work | carry | ch1 | [ ] |
| 5 | v0.3 §1 | The unit of spec-driven development is the smallest independently verifiable phase with explicit contracts | carry | ch1 | [ ] |
| 6 | v0.3 §1 | Everything above that unit is decomposition; everything inside it is one ordinary OpenSpec cycle | carry | ch1 | [ ] |
| 7 | v0.3 §1 | Leverage 1 — recursive decomposition: a large system is a tree, not a flat spec, and only the leaves drive code | carry | ch1 | [ ] |
| 8 | v0.3 §1 | Leverage 2 — contracts are the dependency mechanism: nodes depend on named, versioned contracts, never on each other's internals | carry | ch1 | [ ] |
| 9 | v0.3 §1 | Leverage 3 — human review at every leaf: the human owns correctness, the agent owns throughput, and each phase fits one review window | carry+amend (window restated as one review sitting / PE, vNext §10) | ch1 | [ ] |
| 10 | v0.3 §2.1 | The OpenSpec cycle is untouched: new → proposal/design/tasks/specs → human review → apply → code → human review → archive | carry | ch1 | [ ] |
| 11 | v0.3 §2.2 | HSDD wraps a decomposition front-end and a contract substrate around the cycle; it decides what each cycle sees and in what order cycles run | carry | ch1 | [ ] |
| 12 | v0.3 §2.2 | One contract-isolated OpenSpec cycle per leaf phase; the integrated system is the composition | carry | ch1 | [ ] |
| 13 | v0.3 §3 | Node-kind vocabulary: internal node (decomposes into child nodes) and leaf-parent (children are phases) | carry+amend (an OPEN set — the integration node specializes leaf-parent, ch3) | ch2 | [ ] |
| 14 | v0.3 §3 | A leaf phase is the atomic, independently verifiable unit: it drives exactly one OpenSpec cycle and is sized for one review window | carry | ch2 | [ ] |
| 15 | v0.3 §3 | A contract is a named, versioned interface artifact — the only thing one node may know about another | carry | ch3 | [ ] |
| 16 | v0.3 §3 | Dependency-type vocabulary: hard / contract / event / shared-model | carry | ch3 | [ ] |
| 17 | v0.3 §3 | Context isolation: a phase's OpenSpec session sees its own spec plus only the interfaces of contracts it consumes, never producer internals | carry | ch9 | [ ] |
| 18 | v0.3 §3 | Review window: the wall-clock budget for one phase — AI run plus human review plus manual verification | carry+amend (one review sitting, vNext §10) | ch7 | [ ] |
| 19 | v0.3 §3 | The mental model is functional: each node is a function with typed inputs and outputs (its consumed and produced contracts), the dependency DAG is the composition, and internals are private | carry | ch1 | [ ] |
| 20 | v0.3 §4.1 | Every node, at every level, has the same shape — no system-vs-subsystem split that bakes the level into the structure | carry | ch2 | [ ] |
| 21 | v0.3 §4.1 | Node header fields: Kind, Purpose, Owns, Does not own, Consumes, Produces, Governed by, Decomposes into, Isolation strategy | carry+amend (bullet lists, v0.6 §2.1; gains Sources, Team, Adopted, Status) | ch2 | [ ] |
| 22 | v0.3 §4.1 | Consumes and Produces name contracts by reference (`contract-id@version`), never as an inline copy | carry | ch2 | [ ] |
| 23 | v0.3 §4.1 | A leaf phase is the same shape plus the execution attributes: Scope, Size estimate (~N files, ~N lines, ≤8 OpenSpec tasks), Gate (exact command), Verification, Review tier | carry+amend (v0.6 adds Collides with and Dependencies; bullets) | ch7 | [ ] |
| 24 | v0.3 §4.2 | A node becomes a leaf-parent when both hold: one owner or pair can hold its full scope in their head, and it splits into phases that each fit one review window; otherwise decompose further | carry | ch2 | [ ] |
| 25 | v0.3 §4.2 | Depth is a judgment, not a constant: an intermediate "feature" layer is simply an internal node inserted when a subsystem is too big to phase directly | carry | ch2 | [ ] |
| 26 | v0.3 §4.3 | Only leaf phases drive OpenSpec cycles; leaf-parents own a phase plan; internal nodes only decompose and route contracts | carry | ch2 | [ ] |
| 27 | v0.3 §4.4 | The id-scheme table: root `{slug}`, node `{parent}.{slug}`, phase `{leaf-parent}.{n}`, contract `{slug}@v{n}`, node-local decision `D{n}`, ADR `ADR-{nnn}`, story/acceptance `US-{n}` / `AC-{n}.{y}` | carry+amend (adds OQ ids, ch4; `@v0` admissible, ch3) | ch2 | [ ] |
| 28 | v0.3 §4.4 | Backward-compatibility note: the pre-0.3 `S1` / `S1.2` scheme is the depth-2 special case, so existing specs stay valid | drop (pre-0.3 compatibility claim; v0.8.0 supports ≥0.6.1 only, design §7) | — | [ ] |
| 29 | v0.3 §5 | Contracts are standalone, versioned artifacts, not prose buried in a spec; a node references them by id and never copies another node's internals | carry | ch3 | [ ] |
| 30 | v0.3 §5.1 | The split is deliberate: frontmatter is the metadata projected into the registry, the body is the interface injected into a consuming phase's context | carry | ch3 | [ ] |
| 31 | v0.3 §5.1 | `status:` vocabulary — stable / draft / deprecated | carry+amend (adds `retired`; full lifecycle draft → stable → deprecated → retired, design §6.9) | ch3 | [ ] |
| 32 | v0.3 §5.1 | `kind:` vocabulary — api / event / schema / shared-model / file / cli | carry | ch3 | [ ] |
| 33 | v0.3 §5.1 | Frontmatter carries `produced_by` and `consumers` as authored phase-id lists | carry (vNext's retirement of both is rejected, design §3.2) | ch3 | [ ] |
| 34 | v0.3 §5.1 | One file per contract, named for the slug | carry+amend (`hsdd/contract/{slug}.md`, v0.5) | ch13 | [ ] |
| 35 | v0.3 §5.1 | Contract body sections: `## Interface`, `## Guarantees / invariants`, `## Versioning`, `## Validation` | carry+amend (adopted contracts add `## Observed completeness`, design §5.4) | ch3 | [ ] |
| 36 | v0.3 §5.1 | The contract body's H1 is `# Contract: {slug}` | carry | ch3 | [ ] |
| 37 | v0.3 §5.1 | Versioning rule: the current version is named; a breaking change requires the next version plus a migration note, and the old version stays until all consumers migrate | carry+amend (per-version `compatibility:` policy, design §6.9) | ch3 | [ ] |
| 38 | v0.3 §5.1 | `## Validation` names the contract's fixture and schema paths | carry+amend (executable validation becomes required for `stable`, vNext §5.1) | ch3 | [ ] |
| 39 | v0.3 §5.1 | Each downstream consumer reads exactly one of the two halves, never the whole producing node | carry | ch3 | [ ] |
| 40 | v0.3 §5.2 | Every edge in the dependency DAG is typed, and the type states whether a consumer can start before the producer ships: hard — no; contract — yes once the contract is `stable`; event — yes against the event schema; shared-model — yes once the type exists | carry | ch3 | [ ] |
| 41 | v0.3 §5.2 | `hard` edges are the critical path — minimize them; a DAG of mostly contract, event, and shared-model edges parallelizes well | carry | ch3 | [ ] |
| 42 | v0.3 §5.3 | The contract registry `INDEX.md` is derived data — a pure projection over every contract's frontmatter, generated by a small deterministic script and never hand-maintained by an agent | carry | ch3 | [ ] |
| 43 | v0.3 §5.3 | Registry columns: id, version, kind, owner, status, consumer count | carry | ch3 | [ ] |
| 44 | v0.3 §5.3 | `hsdd-contract` owns the contract files (the source of truth); the generator owns the projection — the pure-core / derived-artifact split applied to documentation | carry | ch3 | [ ] |
| 45 | v0.3 §5.4 | A phase's OpenSpec session receives its own phase section plus only the Interface and Guarantees of the contracts it consumes — never the producing node's implementation, sibling phases, or the full subsystem spec | carry | ch3 | [ ] |
| 46 | v0.3 §6.1 | The end-to-end workflow: brain-dump → `hsdd-spec` → `hsdd-contract` → recurse until leaf-parents → `hsdd-phase-plan` → `hsdd-config` phase switch → OpenSpec cycle → verification doc → human gate → next phase | carry+amend (Entry B is its structural peer; the loop feeds steady state) | ch5 | [ ] |
| 47 | v0.3 §6.1 | The verification doc is generated at `apply`, one per leaf phase | carry | ch10 | [ ] |
| 48 | v0.3 §6.2 | Planning artifacts (node specs, contracts, ADRs, phase plans) are intent: stable, rarely rewritten | carry | ch9 | [ ] |
| 49 | v0.3 §6.2 | Execution artifacts (the OpenSpec change plus the verification doc) are mechanism: disposable, re-runnable, archived per phase — execution re-runs without rewriting intent | carry | ch9 | [ ] |
| 50 | v0.3 §7 | Skills are named by role, not by tree level, because the recursive model uses the same operation at multiple levels | carry | ch1 | [ ] |
| 51 | v0.3 §7 | The skill roster is stated as one skill per artifact, each with its role and key outputs | carry+amend (four skills → ten) | ch1 | [ ] |
| 52 | v0.3 §7 | `hsdd-spec` decomposes the root or any internal node: normalize the idea, split into child nodes, assign contracts by id, build the typed dependency DAG and dev flow, and record cross-cutting decisions as ADRs | carry | ch1 | [ ] |
| 53 | v0.3 §7 | `hsdd-contract` authors and versions first-class contracts (frontmatter plus interface body) and classifies dependency type; the registry is script-generated | carry | ch1 | [ ] |
| 54 | v0.3 §7 | `hsdd-phase-plan` turns a leaf-parent into ordered, OpenSpec-sized phases with gates, verification, review tiers, and a phase DAG | carry | ch1 | [ ] |
| 55 | v0.3 §7 | Phase ordering follows an FP progression: types → pure functions → effects → composition | carry+amend (becomes the named `ordering_policy`, default `interfaces-first`, vNext §11) | ch7 | [ ] |
| 56 | v0.3 §7 | `hsdd-config` generates and maintains `config.yaml`, performs the per-phase context switch (the current phase plus only its consumed contract interfaces and governing ADR decisions), and wires companion skills into each workflow step | carry | ch9 | [ ] |
| 57 | v0.3 §7.1 | The skills chain in a fixed order: spec → contract → recurse → phase-plan → config → OpenSpec cycle → human review gate | carry+amend (gains adr, reconcile, adopt, intake, checkpoint, milestone) | ch1 | [ ] |
| 58 | v0.3 §7.2 | Level-based skill names are rejected: the same decomposition operation runs at the system, domain, and subsystem level, so a tier in the name would mislead | carry | ch1 | [ ] |
| 59 | v0.3 §7.3 | `hsdd-spec` and `hsdd-phase-plan` stay separate: phase planning carries sharply different discipline (ordering, OpenSpec sizing, gates, review tiers, verification docs) | carry | ch1 | [ ] |
| 60 | v0.3 §8 | HSDD composes with general-purpose discipline skills rather than re-implementing them | carry | ch9 | [ ] |
| 61 | v0.3 §8 | `hsdd-config` is the mechanism that wires companion skills into each phase session, so discipline persists across the stateless session boundary | carry | ch9 | [ ] |
| 62 | v0.3 §8 | The companion mapping: brainstorming at spec and phase-plan; TDD, systematic-debugging, and verification-before-completion at apply; code-review skills at the gate; git-worktrees for parallel phases; writing/executing-plans for large phases; finishing-a-development-branch after archive | carry | ch9 | [ ] |
| 63 | v0.3 §8 | Domain and tooling skills (diagram style, stack-specific skills) are optional and wired into apply through the same mapping | carry | ch9 | [ ] |
| 64 | v0.3 §8 | `hsdd-config` references only skills that are actually installed: it discovers what is present, and missing companions degrade gracefully | carry | ch9 | [ ] |
| 65 | v0.3 §9.1 | Each skill has named natural-language triggers (spec at the root or an internal node, contract define / bump, phase-plan a leaf-parent, config init / phase switch) | carry+amend (gains adopt, intake, checkpoint, milestone triggers) | ch5 | [ ] |
| 66 | v0.3 §9.2 | The greenfield bootstrap is a scripted sequence: root spec → decompose to domains → decompose to subsystems → define contracts → phase-plan a leaf-parent → config init → phase switch → cycle → human sign-off → next phase | carry | ch5 | [ ] |
| 67 | v0.3 §9.2 | The phase-context switch is required before `opsx: new`; skip it and the change inherits the previous phase's context | carry | ch9 | [ ] |
| 68 | v0.3 §10.1 | Two invocation surfaces: skills (model-invoked on trigger match, conversational) and slash commands (user-invoked, deterministic, argument-shaped) | carry | ch13 | [ ] |
| 69 | v0.3 §10.2 | Skills are the source of truth; slash commands are thin wrappers over them | carry | ch13 | [ ] |
| 70 | v0.3 §10.2 | Every command is a one-line delegator: the moment a command embeds logic the skill also owns, the two drift apart | carry | ch13 | [ ] |
| 71 | v0.3 §10.3 | The command set: the phase-context switch is the high-value command (the easiest step to forget); the rest are optional | carry+amend (one wrapper per skill, ten) | ch13 | [ ] |
| 72 | v0.3 §11.1 | The layout is a recommended default recorded in `conventions.md`; a project that wants different paths overrides them there and every skill honors the override | carry | ch13 | [ ] |
| 73 | v0.3 §11.1 | Paths are never hard-coded in a skill's behavior, only defaulted | carry | ch13 | [ ] |
| 74 | v0.3 §11.1 | The default layout: node specs under `spec/`, verification docs under `verify/`, contracts plus a generated INDEX, ADRs plus a generated INDEX, and `openspec/` holding `config.yaml` and one change directory per phase | carry+amend (rooted at `hsdd/`, singular names, v0.5) | ch13 | [ ] |
| 75 | v0.3 §11.2 | The required artifact set is deliberately few: node specs (only as deep as the tree needs), contracts, leaf-parent phase plans, the per-phase OpenSpec change plus verification doc, and `conventions.md` | carry+amend (the management layer joins it where a project runs one) | ch13 | [ ] |
| 76 | v0.3 §11.2 | `adr/` and `retrospective.md` are optional and used only when they earn their keep: depth and ceremony are costs, spent deliberately | carry | ch13 | [ ] |
| 77 | v0.3 §11.3 | The verification document is named for the phase id with a `.verification.md` suffix, one per leaf phase | carry | ch9 | [ ] |
| 78 | v0.3 §11.3 | It is generated during `apply` and kept outside the OpenSpec change directory, so it survives `archive` and stays discoverable as durable project history | carry | ch9 | [ ] |
| 79 | v0.3 §12 | Human responsibility is central, not a rubber stamp; the mechanisms exist to keep the human effective without becoming the bottleneck | carry | ch10 | [ ] |
| 80 | v0.3 §12.1 | Every phase is assigned a review tier that scales human attention to risk: gate-only / spot-check / full-review | carry | ch7 | [ ] |
| 81 | v0.3 §12.1 | What each tier means at the gate: gate-only — gate passes, auto-proceed, human notified; spot-check — glance at the diff, confirm the gate, proceed; full-review — read the diff, run the verification guide, consider edge cases | carry+amend (per-tier checklists sharpen it) | ch10 | [ ] |
| 82 | v0.3 §12.2 | At `apply` the agent generates the phase's verification document, turning the manual verification guide into a named, durable artifact | carry | ch10 | [ ] |
| 83 | v0.3 §12.2 | Verification-doc content: what was implemented, what was not implemented or deferred, test evidence with commands and results, manual verification steps, and human sign-off with reviewer, date, and tier | carry+amend (v0.6 §5.2's template supersedes the shape; gains Learnings and Metrics) | ch10 | [ ] |
| 84 | v0.3 §12.3 | Each leaf phase is sized so the full loop — AI run plus human review plus manual verification — fits one review window, and the review tier modulates the human half | carry+amend (window → one review sitting, vNext §10) | ch7 | [ ] |
| 85 | v0.3 §12.3 | If a phase cannot fit the window it is too big and `hsdd-phase-plan` splits it; phase sizing is the control knob over context, tokens, time, and quality | carry | ch7 | [ ] |
| 86 | v0.3 §12.4 | ADRs capture durable "why" for decisions that span more than one node or must outlive the node that introduced them; node-local choices stay `D{n}` inside the node spec | carry | ch4 | [ ] |
| 87 | v0.3 §12.4 | ADRs are not auto-generated in bulk: `hsdd-spec` proposes one when a cross-cutting decision surfaces and the human accepts, edits, or writes it directly; they stay few on purpose | carry | ch4 | [ ] |
| 88 | v0.3 §12.4 | An ADR has an id (`ADR-{nnn}`) and a status (proposed / accepted / superseded-by `ADR-{mmm}`) | carry+amend (frontmatter status vocabulary, v0.4 §3) | ch4 | [ ] |
| 89 | v0.3 §12.4 | The ADR link is bidirectional and by id: the ADR lists `Affects: [node-ids, contract-ids]`, and every affected node, phase, and contract lists `Governed by: [ADR-NNN]` in its header | carry | ch4 | [ ] |
| 90 | v0.3 §12.4 | The ADR registry `INDEX.md` is generated the same way as the contract registry | carry | ch4 | [ ] |
| 91 | v0.3 §12.4 | ADR injection: `hsdd-config` resolves the ADRs referenced by the phase's node and by the contracts the phase consumes, then injects only each ADR's Decision and Consequences — never the Context or the alternatives | carry | ch4 | [ ] |
| 92 | v0.3 §12.4 | The v0.3 ADR body example — bold body fields, no YAML frontmatter | drop (superseded by v0.4 §3's registry-compatible frontmatter form; the old shape is silently skipped by the generator) | — | [ ] |
| 93 | v0.3 §13 | HSDD versus OpenSpec, dimension by dimension: unit of work, structure, decomposition, coupling, context per session, parallelism, dependency model, cycle engine, human review, pacing, and the scale each reaches | carry | ch1 | [ ] |
| 94 | v0.3 §13 | HSDD does not replace OpenSpec: it composes it with bounded-context decomposition, contract-first architecture, tiered human review, and context isolation | carry | ch1 | [ ] |
| 95 | v0.3 §14.1 | The recursive node model exists because a flat spec stops scaling at the context window; a tree lets only the leaves drive code | carry | ch15 | [ ] |
| 96 | v0.3 §14.1 | Context isolation via contracts is the central token and focus win: the dependency graph, not the whole spec, defines what a session sees | carry+amend (claims rewrite, vNext §8.1) | ch15 | [ ] |
| 97 | v0.3 §14.1 | The remaining stated rationales: first-class versioned contracts, typed dependency edges, the per-phase verification doc, tiered human review, phase sized to a review window, planning/execution separation, generated registries, and composing discipline instead of re-implementing it | carry | ch15 | [ ] |
| 98 | v0.3 §14.2 | Non-goal: a fixed `Feature` tier between subsystem and phase — the recursive model already inserts an internal node when needed | carry | ch15 | [ ] |
| 99 | v0.3 §14.2 | Non-goal: a mandatory `retrospective.md` per phase — opt-in only | carry | ch15 | [ ] |
| 100 | v0.3 §14.2 | Non-goal: agent-maintained contract or ADR registries — non-deterministic and token-expensive; generated instead | carry | ch15 | [ ] |
| 101 | v0.3 §14.2 | Non-goal: heavy, always-on documentation — the required set is minimal and everything else earns its keep | carry | ch15 | [ ] |
| 102 | v0.3 §14.2 | Non-goal: re-implementing TDD, review, or debugging inside HSDD | carry | ch15 | [ ] |
| 103 | v0.3 §15 | Settled: skill names are role-based | carry+amend (ten skills) | ch17 | [ ] |
| 104 | v0.3 §15 | Settled: spec and phase-plan are not merged | carry | ch17 | [ ] |
| 105 | v0.3 §15 | Settled: contract versioning is simple `v{n}` with a migration note on a breaking change — no semantic versioning | carry | ch3, ch17 | [ ] |
| 106 | v0.3 §15 | Settled: the verification doc's location is `{verify}/{phase-id}.verification.md` | carry+amend (`hsdd/verify/`, v0.5) | ch17 | [ ] |
| 107 | v0.3 §15 | Settled: node identification is the dotted slug path from the root with leaf phases numbered | carry | ch17 | [ ] |
| 108 | v0.3 §15 | Settled: registry maintenance is script-generated from contract frontmatter | carry | ch17 | [ ] |
| 109 | v0.3 §15 | Settled: the recommended companion plugin is superpowers, wired in via `hsdd-config` | carry | ch17 | [ ] |
| 110 | v0.3 §15 | Settled: slash commands are optional thin wrappers; the primary surface is skills | carry | ch17 | [ ] |
| 111 | v0.3 §16 | "Next Steps" — the v0.3 implementation to-do list | scaffold (implementation bookkeeping, not a rule) | — | [ ] |
| 112 | v0.3 §17 | Glossary terms: node, leaf phase, contract, dependency type, ADR, review tier, review window, companion skill, context isolation | carry+amend (gains the v0.8.0 terms, ch18 task list) | ch18 | [ ] |
| 113 | v0.4 §1 | "What 0.4 Changes and Why" — the two gaps 0.4 closes | scaffold (delta framing; the rules are in §2–§5) | — | [ ] |
| 114 | v0.4 §1.1 | The failure named alongside the rule: an ADR left as inline prose has two broken consumers — `hsdd-config` cannot resolve it, and a body-field ADR with no frontmatter is silently skipped by the registry generator | carry | ch4 | [ ] |
| 115 | v0.4 §1.2 | "The `openspec init` point was never pinned" — delta framing; §5 states the rule | scaffold | — | [ ] |
| 116 | v0.4 §2 | `hsdd-adr` owns the ADR directory the same way `hsdd-contract` owns contracts: it authors first-class files and lets the deterministic generator project the registry | carry+amend (five skills → ten) | ch1 | [ ] |
| 117 | v0.4 §2 | `hsdd-adr`'s role: author and maintain cross-cutting ADRs as first-class files with registry-compatible frontmatter, and manage the status lifecycle and the bidirectional `Affects` / `Governed by` links | carry | ch4 | [ ] |
| 118 | v0.4 §2.1 | The chain gains one line: `hsdd-spec` proposes, the human accepts, `hsdd-adr` materializes, the registry regenerates | carry | ch1 | [ ] |
| 119 | v0.4 §2.2 | One artifact, one skill: an artifact with its own lifecycle (status transitions, superseding, a registry projection) gets its own skill rather than a branch of another | carry | ch1 | [ ] |
| 120 | v0.4 §3 | An ADR file is written to `{nnn}-{title}.md` in the ADR directory | carry+amend (`hsdd/adr/`, v0.5) | ch4 | [ ] |
| 121 | v0.4 §3 | ADR frontmatter: `id`, `status` (proposed / accepted / superseded / deprecated), `affects`, `date`, and optional `supersedes` / `superseded_by` | carry | ch4 | [ ] |
| 122 | v0.4 §3 | ADR body: `# ADR-{nnn}: {title}`, `## Context`, `## Decision`, `## Consequences`, and an optional `## Alternatives considered` | carry | ch4 | [ ] |
| 123 | v0.4 §3 | The same split as a contract: frontmatter is registry metadata, the body carries the decision — and Decision and Consequences stay free of deliberation because those two sections are what gets injected | carry | ch4 | [ ] |
| 124 | v0.4 §3 | The filename carries the number and a slug; the frontmatter `id` is the display id `ADR-001` | carry | ch4 | [ ] |
| 125 | v0.4 §3 | ADR numbers are global across the whole tree, never per node | carry | ch4 | [ ] |
| 126 | v0.4 §3 | Node-local decisions stay `D{n}` inside the node spec and never become files | carry | ch4 | [ ] |
| 127 | v0.4 §3 | "No change to `gen-registry.mjs` is required" — the fix is that the skill emits the frontmatter the generator already reads | scaffold (delta implementation note; the constraint itself is row 121) | — | [ ] |
| 128 | v0.4 §4.1 | Once an ADR is accepted, `hsdd-spec` hands materialization to `hsdd-adr`, which writes the file; then `Governed by: [ADR-NNN]` is set on every affected node, phase, and contract | carry | ch4 | [ ] |
| 129 | v0.4 §4.1 | ADRs are never left as inline prose in a node spec | carry | ch4 | [ ] |
| 130 | v0.4 §4.2 | If a referenced `ADR-NNN` has no file, it was never materialized: stop and author it with `hsdd-adr` before injecting | carry | ch4 | [ ] |
| 131 | v0.4 §4.2 | The human supplies the decision — never invent one. If the content is unavailable, author the ADR `status: proposed` with the Decision as an explicit TODO and do not inject it as binding until it is `accepted` | carry | ch4 | [ ] |
| 132 | v0.4 §4.2 | Never write an invented decision as `accepted`, and never silently drop the reference | carry | ch4 | [ ] |
| 133 | v0.4 §4.3 | The ADR path end to end: `hsdd-spec` proposes → human accepts → `hsdd-adr` writes the file → the generator projects the INDEX and `Governed by` links point back → `hsdd-config` injects Decision plus Consequences into the phase session | carry | ch4 | [ ] |
| 134 | v0.4 §5 | Run `openspec init` once, at the repository root — the same directory that holds the HSDD tree | carry | ch5 | [ ] |
| 135 | v0.4 §5 | One HSDD tree has exactly one OpenSpec project: every phase, across every node, is a change under that single `openspec/changes/` | carry | ch5 | [ ] |
| 136 | v0.4 §5 | Phases are isolated by the per-phase context switch, not by separate OpenSpec projects | carry | ch5 | [ ] |
| 137 | v0.4 §5.1 | Project-start sequence: `openspec init` at the root → `hsdd-spec` at the root (root node spec plus seeded conventions) → `hsdd-config` init → then, per phase, the context switch followed by the OpenSpec cycle | carry | ch5 | [ ] |
| 138 | v0.4 §5.1 | `openspec init` is a one-time step owned by no HSDD skill; the skills assume `openspec/` already exists at the root, and `hsdd-config` (init) is the first HSDD step that touches it | carry | ch5 | [ ] |
| 139 | v0.4 §5.2 | The single project at the root is what makes the layout coherent: one `config.yaml` to switch, one `changes/` history, one place the registries sit beside — context isolation stays a property of the phase switch, not the filesystem | carry | ch5 | [ ] |
| 140 | v0.4 §5.2 | Polyrepo variant: when the system is already physically split across repositories, run `openspec init` at each repo root and share the contract and ADR directories through a package or a git submodule; the single-project default is canonical | carry+amend (the standalone-spec-repo profile, v0.7 §6) | ch13 | [ ] |
| 141 | v0.4 §6 | Each skill ships one thin slash-command wrapper (here `/hsdd-adr`); the command stays a one-line delegator and the skill remains the source of truth | carry | ch13 | [ ] |
| 142 | v0.4 §7 | Settled: `hsdd-adr` authors ADR files — `hsdd-spec` proposes, `hsdd-adr` materializes | carry | ch17 | [ ] |
| 143 | v0.4 §7 | Settled: the ADR artifact is YAML frontmatter plus body, reconciled with the existing generator | carry | ch17 | [ ] |
| 144 | v0.4 §7 | Settled: no generator change is needed — the skill emits the frontmatter the generator already reads | carry | ch17 | [ ] |
| 145 | v0.4 §7 | Settled: ADR numbering is global across the tree, `ADR-{nnn}`, with the filename `{nnn}-{title}.md` | carry | ch17 | [ ] |
| 146 | v0.4 §7 | Settled: `openspec init` runs once, at the repo root — one OpenSpec project per HSDD tree | carry | ch17 | [ ] |
| 147 | v0.4 §7 | Settled: a missing ADR at config time stops the switch and hands off to `hsdd-adr`; an unknown decision is authored `proposed` with a TODO, never as an invented `accepted` | carry | ch17 | [ ] |
| 148 | v0.4 §8 | "Implementation Steps" | scaffold | — | [ ] |
| 149 | v0.4.2 §1 | "What 0.4.2 Changes and Why" — the three parallel-planning field failures | scaffold (delta framing; §1's closing paragraphs carry rows 150–153) | — | [ ] |
| 150 | v0.4.2 §1 | **The governance write protocol:** governance files become immutable inputs during phase planning, intended mutations are emitted as data, and a single writer applies them at the root | carry | ch8 | [ ] |
| 151 | v0.4.2 §1 | The reason, named alongside the rule: contracts, ADRs, `conventions.md`, and the INDEX registries are shared mutable state with concurrent writers, and no skill defined a write protocol | carry | ch8 | [ ] |
| 152 | v0.4.2 §1 | Two independent generations from the same prose are not byte-identical: a plan may never resolve a shared artifact with "create it verbatim if absent; identical by construction; the merge is trivial" | carry | ch8 | [ ] |
| 153 | v0.4.2 §1 | A note addressed to "whoever runs next" is a defect: under parallelism that is every run at once | carry | ch8 | [ ] |
| 154 | v0.4.2 §2 | `hsdd-reconcile` is the single writer for governance effects, the same way `hsdd-contract` is the single author of contract bodies | carry+amend (six skills → ten) | ch1 | [ ] |
| 155 | v0.4.2 §2 | `hsdd-contract` is a root-only writer | carry | ch8 | [ ] |
| 156 | v0.4.2 §2 | The phase context switch warns on a provisional contract and stops on a phase contingent on an open `request` | carry | ch9 | [ ] |
| 157 | v0.4.2 §2 | `hsdd-reconcile`'s job: drain pending governance sections at the root after phase-plan branches merge — apply confirms, resolve requests with the human, finalize `phase_ids`, regenerate the registries | carry | ch8 | [ ] |
| 158 | v0.4.2 §2.1 | The chain gains one line: reconcile runs at the root after the branches merge, before any phase context switch | carry | ch8 | [ ] |
| 159 | v0.4.2 §2.2 | Reconcile is its own skill: `hsdd-phase-plan` decides *what a node needs* from governance, `hsdd-reconcile` owns *how and when* governance changes — folding it into either gives one skill two jobs or re-creates the concurrent writer | carry | ch8 | [ ] |
| 160 | v0.4.2 §3.1 | The frozen set during phase planning: every contract file, every ADR file, `conventions.md`, and both INDEX registries | carry | ch8 | [ ] |
| 161 | v0.4.2 §3.1 | The freeze is unconditional — root or worktree, serial or parallel; there is no environment detection and nothing to configure | carry | ch8 | [ ] |
| 162 | v0.4.2 §3.1 | Under the freeze every branch writes only its own node's plan file, so a parallel flow is conflict-free by construction and a serial flow pays one trivially fast reconcile step | carry | ch8 | [ ] |
| 163 | v0.4.2 §3.2 | `hsdd-phase-plan` appends `## Governance updates (pending reconcile)` to its own node's plan file, with the emitted-by / drained-by note and "do not apply by hand" | carry | ch8 | [ ] |
| 164 | v0.4.2 §3.2 | Entry kind `confirm`: finalize the provisional `produced_by` / `consumers` phase ids for a contract this node produces or consumes | carry | ch8 | [ ] |
| 165 | v0.4.2 §3.2 | Entry kind `note`: a conventions-worthy fact; notes that duplicate derived data are dropped at reconcile time, because the registry already projects contract facts | carry | ch8 | [ ] |
| 166 | v0.4.2 §3.2 | Entry kind `amend`: a producer-side enrichment of a contract this node owns, settled during planning, that consumers may rely on; reconcile applies it to the contract body — a backward-compatible addition keeps the version, a breaking one goes to the human and bumps it | carry | ch8 | [ ] |
| 167 | v0.4.2 §3.2 | Entry kind `request`: a gap in a consumed contract phrased as a question, with the assumption taken and the contingent phases named; contingent phases must not start until the request is resolved | carry | ch8 | [ ] |
| 168 | v0.4.2 §3.2 | Any entry may carry short rationale sub-bullets | carry | ch8 | [ ] |
| 169 | v0.4.2 §3.2 | After draining, `hsdd-reconcile` replaces the section's entries with one line recording the reconcile date; the drained entries live in git history | carry | ch8 | [ ] |
| 170 | v0.4.2 §3.3 | Two-tier gap rule: if a gap in a consumed contract changes the shape of the plan, stop and ask the human immediately — a wrong structural assumption poisons every downstream phase; otherwise proceed conservatively and record a `request` | carry | ch8 | [ ] |
| 171 | v0.4.2 §3.4 | Sibling isolation: a planner must not read sibling worktree folders or other nodes' phase plans | carry | ch8 | [ ] |
| 172 | v0.4.2 §3.4 | Sibling node specs as written by `hsdd-spec` are shared decomposition artifacts and fine to read; a sibling's phase-plan sections and its worktree are not | carry | ch8 | [ ] |
| 173 | v0.4.2 §4.1 | Contract frontmatter carries `phase_ids: provisional / final`, flipped only by `hsdd-reconcile` | carry | ch3 | [ ] |
| 174 | v0.4.2 §4.1 | The habit of writing "phase ids are provisional, update them then" in the contract body is retired: that paragraph was a standing invitation for two writers to edit the same prose | carry | ch3 | [ ] |
| 175 | v0.4.2 §4.1 | The registry generator's parser reads all frontmatter keys but projects only the known columns, so a new key passes through without effect | carry | ch3 | [ ] |
| 176 | v0.4.2 §4.2 | The hand-maintained `## Established contracts` list is removed from the conventions template: it duplicated what the registry already projects, and hand-maintained projections drift | carry | ch13 | [ ] |
| 177 | v0.4.2 §4.2 | The conventions template gains a `## Parallel development protocol` section stating the freeze rule, the pending-section mechanism, the reconcile step, and sibling isolation | carry+amend (extended to cover the execution stage, v0.6 §4) | ch13 | [ ] |
| 178 | v0.4.2 §4.2 | Every skill reads `conventions.md` first, so a protocol stated there reaches every downstream session without new cross-skill references | carry | ch13 | [ ] |
| 179 | v0.4.2 §5 | "Skill Edits (summary)" — the per-skill edit list | scaffold (delta bookkeeping; the rules stated only in its cells are rows 180–182) | — | [ ] |
| 180 | v0.4.2 §5 | `hsdd-contract` quality gate: any code-level artifact both sides consume names its canonical path and its owning phase | carry | ch3 | [ ] |
| 181 | v0.4.2 §5 | A phase's tasks never instruct it to update `conventions.md` | carry | ch8 | [ ] |
| 182 | v0.4.2 §5 | Conventions stay root-owned: `hsdd-spec` seeds the file and `hsdd-reconcile` updates it | carry | ch13 | [ ] |
| 183 | v0.4.2 §6 | `/hsdd-reconcile` is a thin wrapper, consistent with the others | carry | ch13 | [ ] |
| 184 | v0.4.2 §7 | Settled: the write model for governance files during planning is freeze plus effects-as-data, unconditional — no worktree detection, serial and parallel flows identical | carry | ch17 | [ ] |
| 185 | v0.4.2 §7 | Settled: reconciliation lives in its own skill, run at the root after branches merge | carry | ch17 | [ ] |
| 186 | v0.4.2 §7 | Settled: contract gaps during planning are two-tier — ask when the gap changes the plan's shape, otherwise record a `request` with the stated assumption | carry | ch17 | [ ] |
| 187 | v0.4.2 §7 | Settled: collision resolution — the human arbitrates once, at reconcile time; the skill never auto-picks a winner | carry | ch8, ch17 | [ ] |
| 188 | v0.4.2 §7 | Settled: `conventions.md` is written at the root only; phases and phase planning never touch it | carry | ch17 | [ ] |
| 189 | v0.4.2 §7 | Settled: sibling worktree reads are forbidden — contracts are the only inter-node knowledge | carry | ch17 | [ ] |
| 190 | v0.4.2 §7 | Settled: no generator change — `phase_ids` is parsed and ignored by the projection | carry | ch17 | [ ] |
| 191 | v0.4.2 §7 | Settled: producer-side discoveries travel as the `amend` entry kind, and a breaking amendment goes to the human and bumps the version | carry | ch17 | [ ] |
| 192 | v0.4.2 §7 | Settled: `draft → stable` is flipped by `hsdd-reconcile` at the end of the pass, once `phase_ids` is `final` and no `request` naming the contract is unresolved; `stable` means interface-frozen (safe to build against), not producer-shipped | carry+amend (also requires executable validation, vNext §5.1) | ch3, ch17 | [ ] |
| 193 | v0.4.2 §8 | "Implementation Steps" | scaffold | — | [ ] |
| 194 | v0.5 §1 | "What 0.5 Changes and Why" — scattered output and inconsistent naming | scaffold (delta framing; §1's closing paragraphs carry rows 195–198) | — | [ ] |
| 195 | v0.5 §1 | Every HSDD artifact lives under one root directory, `hsdd/` | carry | ch13 | [ ] |
| 196 | v0.5 §1 | Directory names are singular (`spec`, `contract`, `adr`, `verify`): a directory names the artifact kind, not the collection | carry | ch13 | [ ] |
| 197 | v0.5 §1 | `openspec/` is the one exception — OpenSpec owns that location and expects its files exactly there; HSDD does not relocate another tool's files | carry | ch13 | [ ] |
| 198 | v0.5 §1 | The ownership boundary is the point: something on disk must say "this is the methodology's output", or cleanup, review scoping, and ignore rules all need tribal knowledge | carry | ch13 | [ ] |
| 199 | v0.5 §2 | The default layout: `hsdd/conventions.md`, `hsdd/spec/{node-id}.md`, `hsdd/verify/{phase-id}.verification.md`, `hsdd/contract/{slug}.md` plus its INDEX, `hsdd/adr/{nnn}-{title}.md` plus its INDEX, `hsdd/scripts/gen-registry.mjs`; `openspec/` unchanged | carry+amend (adds `hsdd/management/`, v0.7 §8.2, and `management/archive/`, design §6.8) | ch13 | [ ] |
| 200 | v0.5 §2 | The layout is still a default: `hsdd/conventions.md` remains the single source of truth and a project may override any path in it | carry | ch13 | [ ] |
| 201 | v0.5 §2 | `openspec init` still runs once, at the repo root — now simply the directory that holds `hsdd/` | carry | ch13 | [ ] |
| 202 | v0.5 §3 | The registry generator keeps a `--root <dir>` flag; its default root is `./hsdd` and it scans `<root>/contract` and `<root>/adr` | carry | ch13 | [ ] |
| 203 | v0.5 §3 | The standard invocation is `node hsdd/scripts/gen-registry.mjs` | carry | ch13 | [ ] |
| 204 | v0.5 §3 | The generator ships bundled with `hsdd-contract` only, and is copied verbatim into the target project at `hsdd/scripts/` | carry | ch13 | [ ] |
| 205 | v0.5 §4 | The conventions file is the compatibility mechanism: skills load `hsdd/conventions.md` first and honor whatever layout the project's conventions state | carry | ch13 | [ ] |
| 206 | v0.5 §4 | Pre-0.5 detection (`docs/conventions.md` present instead) and the `git mv` migration recipe | drop (v0.8.0 supports ≥0.6.1 only, design §7; the pre-0.5 rename is history) | — | [ ] |
| 207 | v0.5 §4 | After migrating, update the layout section of the conventions file and replace the copied generator, since the old copy scans the old paths by default | drop (same reason as row 206) | — | [ ] |
| 208 | v0.5 §5 | The node, phase, contract, and ADR id schemes are layout-independent | carry | ch13 | [ ] |
| 209 | v0.5 §5 | The governance freeze protocol and `hsdd-reconcile` semantics are layout-independent | carry | ch13 | [ ] |
| 210 | v0.5 §5 | The conventions-override mechanism is layout-independent: the layout is a default, not a requirement | carry | ch13 | [ ] |
| 211 | v0.5 §5 | The `openspec/` location, the per-phase context switch, and the OpenSpec cycle are unchanged by any layout choice | carry | ch13 | [ ] |
| 212 | v0.6 §1 | "What 0.6 Changes and Why" — the four classes of field friction | scaffold (delta framing; §1's closing paragraph carries row 213) | — | [ ] |
| 213 | v0.6 §1 | The core invariant no release moves: one phase drives exactly one OpenSpec change and ends at one human review gate | carry | ch1 | [ ] |
| 214 | v0.6 §2.1 | Every field block emitted in a node header or a phase section is a bullet list — never consecutive `**Field:** value` lines relying on soft breaks, which every compliant renderer collapses into one paragraph | carry | ch2 | [ ] |
| 215 | v0.6 §2.1 | Wrapped values keep the 2-space continuation indent, so wrapped lines render inside their field | carry | ch2 | [ ] |
| 216 | v0.6 §2.1 | The phase template's fields: Consumes, Produces, Governed by, Scope, Size estimate, Gate, Verification, Review tier, Collides with, Dependencies | carry | ch7 | [ ] |
| 217 | v0.6 §2.1 | The `Verification` field is 1–3 lines of intent — what a human should confirm works beyond the gate, as observable behavior, not commands | carry | ch7 | [ ] |
| 218 | v0.6 §2.1 | Rendering rule, a quality-gate item in both skills: field blocks must be bullet lists or tables, never structure carried by soft line breaks | carry | ch2 | [ ] |
| 219 | v0.6 §2.1 | Empty lists render as "none", not `[]`: bracket notation is agent-speak and the plan is a human artifact | carry | ch2 | [ ] |
| 220 | v0.6 §2.1 | Rejected and staying rejected: full tables for the phase record (multi-sentence Scope and Verification become unreadable one-line cells) and hard line breaks (invisible in source, silently stripped) | carry | ch7 | [ ] |
| 221 | v0.6 §2.2 | `## Phase Plan` opens with a summary table, one row per phase: Phase, Name, Tier, Size, Depends on, Collides with — omitting the last column when no phase collides | carry | ch7 | [ ] |
| 222 | v0.6 §2.2 | The summary table is the human index and the bullet sections stay the machine-consumed detail: `hsdd-config` injects only the detailed section, so the table never enters an agent's context | carry | ch7 | [ ] |
| 223 | v0.6 §2.2 | Quality gate: the summary table matches the phase sections | carry+amend (v0.6.1 §6: "opens the section and matches") | ch7 | [ ] |
| 224 | v0.6 §2.3 | The phase dependency graph is a Mermaid flowchart, one node per phase labeled `{phase-id}<br/>{short name}`; ASCII is retired | carry | ch7 | [ ] |
| 225 | v0.6 §2.3 | Graph edges are logical dependencies only; textual contention is carried by `Collides with` and never drawn | carry | ch7 | [ ] |
| 226 | v0.6 §2.3 | Cross-node dependencies appear as dashed edges with the dependency named on the edge label | carry | ch7 | [ ] |
| 227 | v0.6 §2.3 | If `mermaid-pastel-style` is installed, follow it | carry | ch7 | [ ] |
| 228 | v0.6 §2.4 | A standalone node spec file uses one `#` title, `##` for document sections, and does not repeat the title as an inner `###` heading | carry | ch2 | [ ] |
| 229 | v0.6 §3.1 | Sizing floor: a phase must be big enough to earn its cycle | carry | ch7 | [ ] |
| 230 | v0.6 §3.1 | Two adjacent phases are merge candidates when all hold: same review tier, same consumed contracts, no third phase depends on one without the other, and the merged phase still fits the review window with ≤8 OpenSpec tasks | carry | ch7 | [ ] |
| 231 | v0.6 §3.1 | Textual contention strengthens the merge case: phases that would serialize anyway have a lower bar to merge | carry | ch7 | [ ] |
| 232 | v0.6 §3.1 | Keep a small phase separate only for a reason you can name: a tier boundary, a parallel lane assigned to another owner, or a risk you want reviewed in isolation | carry | ch7 | [ ] |
| 233 | v0.6 §3.1 | The merge smell: if a phase's predicted process artifacts exceed its predicted diff, it is a merge candidate by default | carry | ch7 | [ ] |
| 234 | v0.6 §3.2 | The review tier sets the artifact profile, not only human attention: proposal depth, whether `design.md` exists at all, and verification-doc depth scale with the tier | carry | ch10 | [ ] |
| 235 | v0.6 §3.2 | Never scaled: `tasks.md` and the requirement/scenario deltas — they drive TDD and the tests at every tier | carry | ch10 | [ ] |
| 236 | v0.6 §3.2 | Every phase still produces a verification doc; only its depth varies | carry | ch10 | [ ] |
| 237 | v0.6 §3.2 | Mechanism: the review tier is already injected into every phase context, so the artifact rules are tier-conditional | carry | ch9 | [ ] |
| 238 | v0.6 §3.3 | Anti-rationalization: "merge them so there's less to review" — merging to dodge review defeats the tiers; merge only under the sizing floor's conditions | carry | ch7 | [ ] |
| 239 | v0.6 §3.3 | Anti-rationalization: "small phases are always a feature" — they are a feature when they buy parallelism or isolated review; below the floor they buy neither and still cost a full cycle | carry | ch7 | [ ] |
| 240 | v0.6 §3.4 | A phase plan may state one `**Default gate:**` command above the summary table; a phase's `Gate` field then reads "node default" unless it overrides | carry | ch7 | [ ] |
| 241 | v0.6 §4 | The execution protocol is the freeze's mirror for the execution stage, and it lives in the conventions template's parallel-development section, in `hsdd-config`, and in the users guide | carry | ch9 | [ ] |
| 242 | v0.6 §4.1 | The `## Current Phase` block and its companion contract/ADR blocks in `openspec/config.yaml` are per-session working state, rewritten by every context switch: a merge conflict on them carries no information | carry | ch9 | [ ] |
| 243 | v0.6 §4.1 | On any merge, resolve `openspec/config.yaml` by taking either side, then re-run the phase context switch before the next OpenSpec cycle; optionally set `merge=ours` in `.gitattributes` on integration branches | carry | ch9 | [ ] |
| 244 | v0.6 §4.1 | The phase-switch command self-heals: warn when the Current Phase block names a phase that is not next-runnable per the node's plan (already archived, or blocked by an unmerged dependency) | carry | ch9 | [ ] |
| 245 | v0.6 §4.2 | One integration branch per node; phase branches merge into it | carry | ch9 | [ ] |
| 246 | v0.6 §4.2 | Node integration branches merge into the root branch | carry | ch9 | [ ] |
| 247 | v0.6 §4.2 | A node's plan file is written on exactly one lineage — never re-plan or copy a plan onto a diverged sibling lineage | carry | ch9 | [ ] |
| 248 | v0.6 §4.2 | `hsdd-reconcile` runs once, at the root lineage, after the node plans are merged there — never per-lineage; its commit exists only on the root | carry | ch8 | [ ] |
| 249 | v0.6 §4.3 | Each phase section carries `- **Collides with:** [phase-ids]` when the plan expects textual contention (omit when none), and the summary table surfaces the column | carry | ch7 | [ ] |
| 250 | v0.6 §4.3 | Colliding phases execute serially on the node's integration branch; spawn parallel worktrees only for phases with no `Collides with` entry between them | carry | ch9 | [ ] |
| 251 | v0.6 §4.3 | Logical dependencies and textual contention stay separate concepts: the graph draws the former, the field carries the latter | carry | ch7 | [ ] |
| 252 | v0.6 §4.4 | Name OpenSpec capabilities after a stable feature area within the node, not after the phase, and accept that same-capability archives serialize | carry | ch9 | [ ] |
| 253 | v0.6 §4.4 | Fall back to per-phase capability names only when genuinely parallel phases would contend on the same capability spec | carry | ch9 | [ ] |
| 254 | v0.6 §5.1 | The phase's tasks include a gate task that runs the phase gate command | carry | ch10 | [ ] |
| 255 | v0.6 §5.1 | After the gate task, a documentation task writes the verification doc at `hsdd/verify/{phase-id}.verification.md` from the bundled template, at the depth the phase's review tier requires | carry | ch10 | [ ] |
| 256 | v0.6 §5.1 | A phase never updates `hsdd/conventions.md` or `hsdd/contract/`; governance changes are made at the root | carry | ch8 | [ ] |
| 257 | v0.6 §5.1 | Long compound rules are the ones agents half-apply, so the tasks rule is stated as three separate rules | carry | ch9 | [ ] |
| 258 | v0.6 §5.2 | The bundled verification template's sections: Commands to run, Expected output, Observed (dated), Outstanding, Sign-off | carry+amend (gains `## Learnings`, vNext §6, and `## Metrics`, vNext §14.1) | ch10 | [ ] |
| 259 | v0.6 §5.2 | Sign-off records the reviewer and date, the review tier applied, and a disposition for every Outstanding item: verified / waived (reason) / deferred to `{phase-id}` | carry | ch10 | [ ] |
| 260 | v0.6 §5.2 | The review gate is not passed while an Outstanding item lacks a disposition | carry | ch10 | [ ] |
| 261 | v0.6 §5.2 | The verification doc is written at apply, never during planning | carry | ch10 | [ ] |
| 262 | v0.6 §6.1 | The failure named alongside the axis rule: an end-to-end node across two teams has two owners, interleaves two toolchains and deploy targets, silently fails the leaf-parent criterion, and leaves the worktree-per-node model with no single owner to assign | carry | ch2 | [ ] |
| 263 | v0.6 §6.1 | "Prefer capability slices over technology buckets" rejects *layer* buckets inside one codebase; it never licenses feature slices across an ownership boundary | carry | ch2 | [ ] |
| 264 | v0.6 §6.2 | Choose the decomposition axis by ownership, not elegance: at each level, first split along the boundaries where different teams, owners, or deploy targets hold different parts of the stack | carry | ch2 | [ ] |
| 265 | v0.6 §6.2 | Those boundaries come with their natural contract and match how work is actually assigned — Conway's law is a constraint to design with, not a smell to fight | carry | ch2 | [ ] |
| 266 | v0.6 §6.2 | Within one owner's territory, prefer capability slices over technology buckets | carry | ch2 | [ ] |
| 267 | v0.6 §6.2 | A capability that spans the stack returns one level down as a node per side, joined by a contract, with the pairing visible in the dependency DAG | carry | ch2 | [ ] |
| 268 | v0.6 §6.2 | Vertical end-to-end slices remain correct when one owner genuinely holds the whole stack: there the feature boundary *is* the ownership boundary | carry | ch2 | [ ] |
| 269 | v0.6 §6.2 | The rule reduces to one question — who builds what? — and an unstated team structure over a stack-spanning system is the canonical clarifying question | carry+amend (becomes a mandatory stop, v0.6.1 §4) | ch2 | [ ] |
| 270 | v0.6 §6.2 | Quality gate: the decomposition axis at each level matches the stated ownership, and no node is owned by two teams | carry+amend (ownership stated by the human, not assumed, v0.6.1 §4) | ch2 | [ ] |
| 271 | v0.6 §6.2 | Anti-rationalization: "auth end-to-end is one coherent capability" — coherent for whom? Split at the ownership boundary; the capability comes back as a node pair joined by a contract | carry | ch2 | [ ] |
| 272 | v0.6 §7 | "Skill Edits (summary)" | scaffold (delta bookkeeping; the rule stated only in its cells is row 273) | — | [ ] |
| 273 | v0.6 §7 | The conventions template's parallel-development section is extended and renamed to cover both stages — planning and execution | carry | ch13 | [ ] |
| 274 | v0.6 §8 | Settled: the decomposition axis is ownership first; capability slices apply within one owner's territory; an unknown team structure is the canonical one-clarifying-question | carry | ch17 | [ ] |
| 275 | v0.6 §8 | Settled: field-block format is bullet lists; tables rejected for multi-sentence fields, hard line breaks rejected as invisible and fragile | carry | ch17 | [ ] |
| 276 | v0.6 §8 | Settled: a plan's human scannability comes from a per-plan summary table, human-only, with zero agent context cost | carry | ch17 | [ ] |
| 277 | v0.6 §8 | Settled: the dependency-graph format is Mermaid in both skills, always; cross-node edges dashed; contention is a field, not an edge | carry | ch17 | [ ] |
| 278 | v0.6 §8 | Settled: sizing has a floor as well as a ceiling; a merge requires same tier, same contracts, a clean dependency shape, and window fit; artifacts-exceed-diff is the default merge smell | carry+amend (both ends restated in PE terms, vNext §10) | ch17 | [ ] |
| 279 | v0.6 §8 | Settled: the review tier controls human attention *and* artifact depth; tasks and spec deltas never scale; a verification doc always exists | carry | ch17 | [ ] |
| 280 | v0.6 §8 | Settled: one phase = one OpenSpec change = one review gate — unchanged invariant | carry | ch17 | [ ] |
| 281 | v0.6 §8 | Settled: `openspec/config.yaml` at merge is ephemeral — take either side and re-run the phase switch | carry | ch17 | [ ] |
| 282 | v0.6 §8 | Settled: a node's plan lives on exactly one lineage, and reconcile runs once, at the root lineage only | carry | ch17 | [ ] |
| 283 | v0.6 §8 | Settled: textual contention is structured (`Collides with`), surfaced in the summary table, serializes execution, and never reshapes logical dependencies | carry | ch17 | [ ] |
| 284 | v0.6 §8 | Settled: capability naming is per stable feature area by default; per-phase names only for genuinely parallel contention | carry | ch17 | [ ] |
| 285 | v0.6 §8 | Settled: the verification doc has a bundled template with Outstanding and Sign-off, and the gate is not passed while an Outstanding item lacks a disposition | carry | ch17 | [ ] |
| 286 | v0.6 §9 | "Implementation Steps" — including item 8, which proposes this very consolidation | scaffold | — | [ ] |
| 287 | v0.6.1 §1 | "What 0.6.1 Changes and Why" — four instances of one failure class | scaffold (delta framing; §1's closing carries rows 288–289) | — | [ ] |
| 288 | v0.6.1 §1 | Rules that live only in prose fire inconsistently: the same skill text produced conforming and non-conforming runs, and unpinned behavior with observed variance is the failure mode | carry | ch1 | [ ] |
| 289 | v0.6.1 §1 | Every behavior that must fire gets a structural anchor — a required field, a checklist item, or an explicit stop — instead of more prose | carry | ch1 | [ ] |
| 290 | v0.6.1 §2.1 | Downstream skills read only the node spec's closure (conventions plus the node spec plus contracts plus ADRs), so a detail absent from that closure is unreachable *by construction*, not by accident | carry | ch2 | [ ] |
| 291 | v0.6.1 §2.1 | Restatement thins at every level of the tree; the pointer is the only carrier that scales | carry | ch2 | [ ] |
| 292 | v0.6.1 §2.2 | The root spec carries a `## Sources` section listing each input document: path or URL, its authority (accepted RFC / draft / braindump / ticket), and one line on what it governs | carry | ch2 | [ ] |
| 293 | v0.6.1 §2.2 | The node header gains `- **Sources:**` after `Governed by`, listing only the sources — or named sections of them — that govern that node, or "none" | carry | ch2 | [ ] |
| 294 | v0.6.1 §2.2 | Sources trickle down at decomposition time, at every level: each child's Sources is the subset of the parent's that governs it, and a source relevant to several nodes appears on each | carry | ch2 | [ ] |
| 295 | v0.6.1 §2.2 | The Sources field is required whenever the root `## Sources` section exists; it is omitted entirely only in projects with no source documents | carry | ch2 | [ ] |
| 296 | v0.6.1 §2.2 | The summary indexes the source and never replaces it: restating a normative detail is fine, but the node's Sources must still name where it came from | carry | ch2 | [ ] |
| 297 | v0.6.1 §2.2 | Quality gate: every input source appears in at least one node's Sources, or is marked in the root `## Sources` as "informative only — not decomposed" with a reason. No source is silently dropped | carry | ch2 | [ ] |
| 298 | v0.6.1 §2.2 | Quality gate: no node's Sources lists a document that does not govern it — the field is context the next skill will read, not a bibliography | carry | ch2 | [ ] |
| 299 | v0.6.1 §2.3 | Phase planning reads the node's Sources — the referenced documents or sections, not just the node spec's summary of them — before phasing | carry | ch7 | [ ] |
| 300 | v0.6.1 §2.3 | A binding detail found only in a source must land where execution will see it: in a phase's Scope or Verification line, or in a contract `request` / `amend` entry so the contract body carries it | carry | ch7 | [ ] |
| 301 | v0.6.1 §2.3 | Phases carry no Sources field and no source document is injected into a phase context; the phase context stays ~20 lines | carry | ch9 | [ ] |
| 302 | v0.6.1 §2.3 | Wire-level source detail (envelopes, pagination rules, quotas) is exactly what contract bodies exist to absorb | carry | ch3 | [ ] |
| 303 | v0.6.1 §2.3 | Anti-rationalization: "the spec captures everything important from the RFC" — summaries thin at every level; if the RFC is not in Sources its details are unreachable, not just unmentioned | carry | ch2 | [ ] |
| 304 | v0.6.1 §3 | Phase Design Checklist item: adjacent same-tier phases were checked against the sizing floor, and every merge candidate kept separate names its reason | carry | ch7 | [ ] |
| 305 | v0.6.1 §3 | When a merge-candidate pair is kept split, record the reason in one line — in the kept phase's section or a short note under the summary table; a plan with no merge-candidate pairs records nothing | carry | ch7 | [ ] |
| 306 | v0.6.1 §3 | Anti-rationalization: "the node spec already lists N pieces, so N phases" — a prose enumeration is not a phase plan; run the floor over adjacent same-tier phases before accepting the count | carry | ch7 | [ ] |
| 307 | v0.6.1 §4 | When the input does not state the team structure and the system plausibly spans stacks, do not choose an axis: ask "who builds what?" and stop until it is answered | carry | ch2 | [ ] |
| 308 | v0.6.1 §4 | Here the clarifying question is mandatory, not permitted: an axis guessed wrong reworks every node beneath it | carry | ch2 | [ ] |
| 309 | v0.6.1 §4 | Stating an assumption and proceeding covers details; it is never an alternative for the decomposition's shape | carry | ch2 | [ ] |
| 310 | v0.6.1 §4 | The sharpened quality gate: the axis at each level matches ownership **stated by the human, not assumed** | carry | ch2 | [ ] |
| 311 | v0.6.1 §4 | Anti-rationalization: "the axis is defensible either way, I'll pick a safe default" — defensible-either-way is the definition of a decomposition-changing unknown, and a flag at the bottom of a finished-looking tree does not get read | carry | ch2 | [ ] |
| 312 | v0.6.1 §5 | Every child node — internal or leaf-parent — gets its own `hsdd/spec/{child-id}.md` at decomposition time | carry | ch2 | [ ] |
| 313 | v0.6.1 §5 | The parent document embeds each child's header block as a summary; the child's file is the authoritative node spec, which the next skill appends to and a later decomposition edits in place | carry | ch2 | [ ] |
| 314 | v0.6.1 §5 | Quality gate: every child node has its own spec file | carry | ch2 | [ ] |
| 315 | v0.6.1 §5 | The standalone-file heading rule applies in every file (restates row 228 for decomposition output) | carry | ch2 | [ ] |
| 316 | v0.6.1 §6 | Phase ids in the summary table and in every `Collides with` entry use the same id form as the phase section headers; the short `{n}.{i}` form is fine if used consistently throughout the plan | carry | ch7 | [ ] |
| 317 | v0.6.1 §6 | `Collides with` may carry a one-line reason after an em dash | carry | ch7 | [ ] |
| 318 | v0.6.1 §6 | `## Phase Plan` begins with the `**Default gate:**` line (when present) followed immediately by the summary table; prose commentary comes after the table, not before | carry | ch7 | [ ] |
| 319 | v0.6.1 §6 | Cross-node dashed edges appear only when a phase actually depends on another node's artifact; a node that builds purely against contract fixtures draws none | carry | ch7 | [ ] |
| 320 | v0.6.1 §7 | "Skill Edits (summary)" — including the users-guide tip "point at the doc, don't paste it", which is guide material, not a spec rule | scaffold | — | [ ] |
| 321 | v0.6.1 §8 | Settled: source provenance lives in a root `## Sources` section plus a per-node field, trickled at every decomposition level; YAML frontmatter for it is rejected | carry | ch17 | [ ] |
| 322 | v0.6.1 §8 | Settled: restate or reference — both are allowed but the pointer is mandatory; pasting source content into specs is rejected | carry | ch17 | [ ] |
| 323 | v0.6.1 §8 | Settled: phases carry no Sources, and injecting source documents into phase contexts is rejected | carry | ch17 | [ ] |
| 324 | v0.6.1 §8 | Settled: an unmapped source must be explicitly marked "informative only — not decomposed" with a reason; silence is the failure being fixed | carry | ch17 | [ ] |
| 325 | v0.6.1 §8 | Settled: floor enforcement is a checklist item plus a conditional one-line kept-split reason; a mandatory floor-analysis section in every plan is rejected | carry | ch17 | [ ] |
| 326 | v0.6.1 §8 | Settled: an unknown decomposition axis is asked and stopped on — mandatory, not permitted; proceed-with-flagged-assumption is rejected as the loophole, not the mitigation | carry | ch17 | [ ] |
| 327 | v0.6.1 §8 | Settled: one file per child, every child, at decomposition time; the parent embeds only the summary block | carry | ch17 | [ ] |
| 328 | v0.6.1 §8 | Settled: one phase = one OpenSpec change = one review gate — unchanged (restates row 280 in the 0.6.1 table) | carry | ch17 | [ ] |
| 329 | v0.6.1 §9 | "Implementation Steps" | scaffold | — | [ ] |
