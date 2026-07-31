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
