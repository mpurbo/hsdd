# v0.8.0: Consolidation + Brownfield Adoption + Steady State

**Date:** 2026-07-29
**Status:** Design — approved, revised after review, ready for implementation planning
**Owner:** Purbo Mohamad
**Drafted by:** Claude (Opus 5), from a brainstorming session on brownfield HSDD
**Produces:** `spec/hsdd-spec-v0_8.md` — a *consolidation*, not a delta
**Supersedes as a reading path:** v0.3, v0.4, v0.4.2, v0.5, v0.6, v0.6.1, v0.7
(the files remain in `spec/` as history)

---

## 1. Problem

HSDD is shaped like a **project**: decompose a tree, contract the boundaries,
phase-plan the leaves, execute, gate, launch. Real systems are shaped like a
**product**: a permanent tree receiving a stream of changes forever. Two gaps
follow from the mismatch.

**Gap 1 — no way in for a system that already exists.** Every entry point
assumes a brain-dump or a PRD and an empty tree. Field practice on a brownfield
codebase has been: feed the PRD *and* the codebase to `hsdd-spec`, let it
generate a tree scoped to that one PRD, ship, and then wipe `hsdd/` before the
next PRD because the tree describes a project rather than the system. The
adoption cost is paid every time and amortizes over nothing.

**Gap 2 — no way in for a change that arrives after the tree exists.** Every
skill assumes you already know which node you are working on. `hsdd-spec` takes
a brain-dump or a named node; `hsdd-phase-plan` takes a named leaf-parent.
Nothing takes "here is a new PRD — where does it go?" `hsdd-checkpoint`'s scoped
mode is the closest thing (it ingests named new context, computes closure, emits
plan steps) but it is built to find inconsistencies in *planned* work and is
deliberately read-only toward governance, so it can observe that work is needed
and cannot place it.

The unifying observation:

> **The tree does not complete. Phases complete. After the first change, every
> project is brownfield.**

Greenfield is a three-month bootstrap; the rest of a system's life is the steady
state. v0.8.0 makes that structural rather than rhetorical.

---

## 2. Decisions taken

| Question | Decision |
|----------|----------|
| Delta or consolidation? | **Consolidation.** v0.8.0 is a single current spec absorbing v0.3–v0.7. The delta format is retired for major revisions. |
| Adopt vNext's mechanization (the `hsdd` CLI)? | **No.** No `hsdd context`/`lint`/`status`/`check-scope`/`rename`/`template`. Mechanical invariants in the existing flow stay prose- and structure-enforced. |
| Any scripts at all? | **Yes, scoped.** A script may ship bundled with a **new** skill where it materially improves cost or determinism. No script may change how an **existing** skill behaves. See §3.1. |
| Is dropping the CLI a retreat? | No — vNext §1 concedes mechanization "is not a rescue; it is economics and determinism." The 0.6.0 pressure campaign showed the prose-and-structure defenses holding GREEN under combined authority, deadline, and social pressure. Dropping the CLI costs determinism and per-session tokens, not correctness. |
| What of vNext survives? | The tool-free half — see §3.2. |
| How does an adopted node carry mechanical evidence? | **One tier, evidence in a section.** As-built node specs carry `## Observed surface`. The epistemic split is per-section, not per-file. See §5. |
| What version do adopted contracts start at? | **`v0`.** See §5.4. |
| Where does change intake live? | **A new skill,** not an extension of `hsdd-checkpoint`. Different trigger (event vs periodic), different posture (writes into governance vs read-only toward it). |
| Where does an incoming PRD's spec live? | **Nowhere — a PRD is never a root.** There is one tree and it is the system's. See §6.1. |
| OQ-1: milestones after launch? | **Resolved — per-campaign milestone documents, sealed when green.** See §6.8. |
| OQ-2: adopted contracts and compatibility? | **Resolved — a declared `compatibility:` policy, fixture-enforced.** See §6.9. |

---

## 3. Tooling boundary and vNext salvage

### 3.1 The scripting boundary

The precedent already exists: `skills/hsdd-contract/scripts/gen-registry.mjs` is
a script bundled with the skill that owns it. v0.8.0 keeps that pattern and
draws one line around it:

> **A script may ship with a new skill. No script may change how an existing
> skill behaves.**

Applied:

- `hsdd-adopt` bundles `scripts/extract-seams.mjs` — manifests, directory tree,
  route registrations, schemas, migrations, topics, `CODEOWNERS`, coupling from
  `git log --numstat`. Adoption is a new process with no proven prose flow to
  put at risk, and extraction is exactly the kind of work a script does better
  and ~100× cheaper than a model.
- `hsdd-checkpoint`'s as-built drift check (§5.8) reuses that script. Checkpoint
  is an existing skill, so the rule is stated explicitly: **that path executes
  only when adopted nodes exist.** A greenfield tree, or an already-governed
  ≥0.6.1 tree with no `- **Adopted:**` nodes, never reaches it, and checkpoint's
  proven behavior is unchanged.
- Nothing else gains a script. Registry generation stays as-is.

### 3.2 vNext salvage list

**Absorbed into v0.8.0:**

| vNext | What | Why it survives the CLI's removal |
|-------|------|-----------------------------------|
| §5.1 | `stable` requires executable validation (schema and/or fixtures) | A discipline, not a tool. Lint enforced it; `hsdd-reconcile` can assert it at the flip. |
| §5.2 | Both gates run the contract | Gate-command content, no tooling needed — and the enforcement point for §6.9. |
| §5.3 | Integration nodes | Pure methodology — and the natural shape for the as-built ↔ governed seam (§5.7). |
| §6 | The feedback loop at the gate: `## Learnings`, every entry dispositioned (`spec-updated` / `contract-bumped` / `adr-proposed` / `dropped`) before sign-off | Load-bearing for §6: this is the channel from execution back into the spec. |
| §6.2, §6.3 | Mid-phase contract renegotiation; boundary corrections | Pure methodology. |
| §8.1 | Claims rewrite — honest isolation and token claims | Corrects claims that are currently overstated in shipped README/spec prose. |
| §10 | PE floor and ceiling in the same terms | Corrects a real inconsistency (0.6's floor and v0.3's ceiling use different units). |
| §11 | Phase ordering as a named policy (`interfaces-first` default) | Selected in conventions; no tooling needed. |
| §12 | Brownfield adoption | The point of this release — rewritten per §5 below. |
| §13.1 | The `Team` node field | One line; the durable landing spot for 0.6.1's mandatory "who builds what?" stop, whose answer currently evaporates. |
| §14 | Evidence program: `## Metrics` block, case study as v1.0 release criteria | Pure record-keeping. |

**Dropped:**

| vNext | What | Consequence |
|-------|------|-------------|
| §2 | Normative grammar | Nothing changes: it only mattered as parser input; the 0.6.1 bullet templates already stand as the authored format. |
| §3 | The `hsdd` CLI and its six commands | Registry generation stays script-based; everything else stays skill work. |
| §4 | Pull-based phase context | The push-based switch of v0.3 §9 / v0.4 §5, as implemented in `hsdd-config`, survives unchanged. |
| §7 | Derived state; retirement of `confirm`, `produced_by`, `consumers`, `phase_ids` | These fields and the `confirm` entry kind survive as authored, per v0.3 §5.1 / v0.4.2. Derivation of *done-ness* survives anyway via v0.7 checkpoint's verification-doc rule. |
| §8.2 | `Touches` + `hsdd check-scope` | Dropped as dead surface; v0.6's `Collides with` already carries the collision signal. |
| §9 | `hsdd-review` skill | Deferred. The 0.6 review tiers and gate commands stand. |
| §13.2, §13.3 | Cross-team contract acks; ADR approvals | Lint-enforced, so honor-system without it. Deferred. |

---

## 4. Document shape

Greenfield and brownfield become **peer entry points**, both landing on the same
phase-planning chapter and both feeding the same steady-state loop.

| # | Chapter | Sources | Provenance |
|---|---------|---------|------------|
| 1 | What HSDD Is | v0.3 §1–2, README | field-tested |
| 2 | The Node Model | v0.3 §3–4; 0.6 ownership axis; 0.6.1 sources, one-file-per-node | field-tested |
| 3 | Contracts | v0.3 §5; vNext §5.1–5.2 | field-tested / reasoned |
| 4 | ADRs and Open Questions | v0.4 §4; v0.7 §5.2 | field-tested |
| 5 | **Entry A: Greenfield Bootstrap** | v0.3 §7–9 | field-tested |
| 6 | **Entry B: Brownfield Adoption** | NEW (§5 below) | reasoned |
| 7 | Phase Planning | v0.3 §12; 0.6 templates/tiers/floor; 0.6.1 anchors; vNext §10, §11 | field-tested |
| 8 | Governance: Freeze and Reconcile | v0.4.2 | pressure-tested |
| 9 | Execution: the OpenSpec Cycle | v0.3 §9; 0.6 §4 parallel protocol; `hsdd-config` | field-tested |
| 10 | The Gate | 0.6 review tiers; vNext §6 Learnings loop | field-tested / reasoned |
| 11 | **Steady State: Change Intake** | NEW (§6 below) | reasoned |
| 12 | Management Layer | v0.7 whole; per-campaign milestones (§6.8) | field-tested / reasoned |
| 13 | Layout, Profiles, Conventions | v0.5; v0.7 §6; vNext §13.1 | field-tested |
| 14 | **Upgrading and Compatibility** | NEW (§7 below) | reasoned |
| 15 | Claims and Non-Goals | vNext §8.1; merged non-goals | reasoned |
| 16 | Evidence | vNext §14 | reasoned |
| 17 | Settled Decisions | merged tables, all deltas | — |
| 18 | Glossary | merged | — |

**Provenance is a required column** in chapter 17's settled-decisions table:
`field-tested` (GMP-911), `pressure-tested` (the 0.6.0 campaign), or
`reasoned-only`. Much of what this release adds is reasoned-only, and the
document must say so rather than let new material inherit credibility from the
tested parts.

Realistic size: **1600–2000 lines.** The seven deltas total 3,143 lines and
restate each other heavily; dedup should compress substantially.

---

## 5. Chapter 6 — Brownfield Adoption

New skill: **`hsdd-adopt`**, bundling `scripts/extract-seams.mjs` (§3.1).
Revised from vNext §12 with the Observed-surface and `v0` decisions.

### 5.1 Process

1. **Seam archaeology — extract, do not read.** The bundled script emits
   manifests (`package.json`, `go.mod`, `pom.xml`, BUILD files), directory tree,
   route registrations, proto/OpenAPI/GraphQL schemas, DB migrations, event topic
   producers and consumers, `CODEOWNERS`, and `git log --numstat` coupling
   clusters. Record the extraction commit SHA.
2. **Propose a shallow tree** (depth 1–2) on the seams that exist, not the ones
   anyone wishes existed. The ownership-first axis (0.6 §6) applies. `CODEOWNERS`
   plus history usually *answers* "who builds what?", which turns 0.6.1's
   mandatory stop into a confirmation rather than a blocker.
3. **Write as-built node specs** — one file per node (0.6.1 §5), the standard
   bullet header plus `- **Adopted:** as-built`, plus `## Observed surface`.
4. **Contracts from seams** — `version: v0`, defined as *current behavior* (§5.4).
5. **Stop.** No decomposition below what the first change needs.
6. **Prove the tree** — regenerate the contract and ADR registries.

### 5.2 The `## Observed surface` section

```markdown
## Observed surface

- extracted: 2026-07-29 @ a1b2c3d  (scripts/extract-seams.mjs)
- modules: src/billing/, src/payouts/, src/merchant/
- routes: 34  (GET /v1/merchants, POST /v1/payouts, ...)
- tables: merchants, payouts, payout_batches
- topics: produces payout.settled; consumes kyc.verified
- owners: @payments-team
- unknown: settlement retry logic (no tests, no docs)
```

The epistemic split is **per-section, not per-file**: authored bullet fields
claim intent, `## Observed surface` claims only what tooling saw, stamped with
the extraction SHA. One artifact type; the honesty boundary is visible in the
file you are reading.

The section is at **seam level, not file level** — 0.6.1's "the pointer scales,
the summary thins" governs it verbatim.

### 5.3 Honesty rules

- **`unknown:` lines are required, not optional.** A node with no unknowns is a
  node nobody looked at. This is the structural anchor (0.6.1's remedy pattern)
  that keeps as-built specs from bluffing.
- **`Isolation strategy` records how the node is exercised *today*** — existing
  tests, staging — never an aspiration.
- **Contracts describe observed behavior, warts included.** A wart worth fixing
  becomes a Learning at a later gate, then a versioned bump with a migration
  note. Never silently corrected during extraction.
- **`hsdd-adopt` never proposes refactoring the system to fit a nicer tree.**
  The tree fits the system. Boundary improvements arrive later as Learnings and
  ADRs.

### 5.4 Adopted contracts: `v0`, `stable`, with a completeness caveat

Adopted contracts start at **`version: v0`**. HSDD versions are `v{n}` with no
semantic versioning (`hsdd-contract`: "Versions are `v{n}`. No semantic
versioning"), so `v0` carries none of semver's "no promises" connotation. It
buys two things:

- **`v1` comes to mean "the first version HSDD designed."** The version number
  carries adoption provenance for free.
- It is legible at every reference site: `merchant-api@v0` reads as
  observed-not-designed wherever it appears.

They start **`status: stable`** — schemas from code or captured traffic,
fixtures from existing tests or captured payloads, which satisfies vNext §5.1.
This hands a validation harness to code that never had one, and is the single
highest-value output of an adoption run.

They carry a required **completeness caveat** in the body — the contract-level
analogue of the node's mandatory `unknown:` lines:

```markdown
## Observed completeness

- covered by fixtures: happy path, 4xx envelope, pagination
- NOT exercised: partial-batch failure, idempotency-key replay
- inferred from code, never observed in traffic: retry-after semantics
```

An adopted contract's guarantees are *inferred*. Recording what the fixtures do
not reach is what keeps `stable` honest.

### 5.5 Promotion — the recurring operation

Promotion (as-built → governed) is not a one-time adoption step; it recurs for
the life of the system.

1. **Trigger:** a change routes to an as-built node (chapter 11).
2. `hsdd-spec` decomposes it, taking that node's `## Observed surface` as a
   primary source alongside the change request.
3. **Human confirmation stop** before the promoted spec is authoritative — the
   same shape as the mandatory "who builds what?" stop.
4. The field becomes `- **Adopted:** promoted`; `## Observed surface` stays as
   provenance.

The confirmation stop is the mechanism that keeps the **validated fraction at
100%**: a node spec is only ever generated when someone is about to work on it
and therefore actually reads it.

**Promotion happens once and is shared, never raced** — see §6.7.

### 5.6 Why not full-depth reverse engineering

Two arguments, stated in the chapter so the question does not recur.

**Cost scales with seam count, not LOC.** Shallow adoption never reads the code
— it extracts structure, and now does so by script. For 1M LOC that is hours and
tens of dollars. Full depth to leaf-parent means understanding every module's
responsibility, so 10M+ tokens minimum before synthesis, across hundreds of
subagent runs: days, four figures. A 1M-LOC monolith with 20 endpoints and 5
tables is *cheaper* to adopt than a 100k-LOC service mesh with 40 services.
**State this explicitly so nobody budgets by LOC.**

**The trust argument decides it.** Generate 500 as-built node specs and nobody
reads 500 node specs — you now hold 500 unvalidated claims about intent that
every future agent session treats as authoritative. An as-built spec's value is
capped by whether a human confirmed it. Unread wrong specs propagate, which
makes full-depth adoption *worse* than no adoption.

### 5.7 The mixed tree is normal and permanent

Some nodes stay as-built forever. The seam between an as-built node and a
governed node is where the contract must be real — that is where the value
concentrates. vNext §5.3 integration nodes are the shape for exercising it.

The mixed tree is also reachable **from the governed side**: an existing
fully-governed project can run `hsdd-adopt` on the parts of its system that were
never in the tree, grafting as-built nodes alongside governed ones (§7).

### 5.8 Drift

`hsdd-checkpoint` re-runs `extract-seams.mjs` per adopted node and diffs against
the recorded `## Observed surface`. A diff is a **finding, not an error** — it
lands in the findings register and becomes a plan step or an explicit waiver,
per the existing Findings→Plan loop. Per-node scope keeps it cheap, and the
whole check is skipped when the tree has no adopted nodes (§3.1).

---

## 6. Chapter 11 — Steady State: Change Intake

New skill: **`hsdd-intake`**.

Separate from `hsdd-checkpoint` because the two differ on both axes that matter:
checkpoint is **periodic** and deliberately **read-only toward governance**;
intake is **event-driven** and its entire job is to route *into* governance.
Conflating them would muddy both.

- **Input:** a change request (PRD, RFC, ticket, incident) plus the atlas.
- **Output:** an intake record at
  `hsdd/management/YYYY-MM-DD-intake-{slug}.md`, then a handoff.

### 6.1 The load-bearing rule: a PRD is never a root

> **There is one tree, and it is the system's.**

The root of `hsdd/spec/` is the *system* — created once, by adoption (§5) or by
greenfield bootstrap (chapter 5). A PRD is an **input** that produces changes to
that tree: nodes grafted, phases appended. It never becomes a root, and it never
gets a spec of its own.

Treating a PRD as a root is precisely what forces the wipe-`hsdd/`-per-project
cycle this release exists to end. The rule is stated in the spec, with the
failure it prevents named alongside it.

Three consequences:

- **Where the PRD goes:** into `## Sources` on every node it governs. 0.6.1's
  source provenance already trickles sources down the tree, so no new mechanism
  is needed.
- **Where the PRD is visible as one unit of work:** the intake record. It names
  the change request, the routing decision, and every node and phase the change
  produced. A PRD that fans out into three nodes and nine phases is one intake
  record.
- **The split this establishes:** *spec tree = system structure, permanent;
  management layer = work units, episodic.* v0.7 already put episodic documents
  in `hsdd/management/`; intake adds the per-change document to that layer.

### 6.2 Routing classes

| Class | Means | Routes to |
|-------|-------|-----------|
| `local` | fits inside one existing leaf-parent | `hsdd-phase-plan` append mode (§6.3) |
| `cross-node` | touches several nodes' surfaces | `hsdd-contract` bump and/or `hsdd-adr`, then phase-plan each |
| `new-capability` | needs a node that does not exist | `hsdd-spec` graft mode (§6.4) on the **existing parent** |
| `structural` | the tree's shape is wrong for this change | **stop** — human decision, the expensive one |

Landing on an as-built node is not a fifth class: promote first (§5.5), then
reclassify.

The routing decision is **written before the handoff**, so the choice is
auditable rather than implicit in whatever the next skill did.

### 6.3 `hsdd-phase-plan` append mode

- Continue numbering from the highest existing phase id in the node's plan.
- **Never renumber. Never rewrite a shipped phase.**
- The phase summary table becomes a permanent ledger; shipped phases stay in it.
- Shipped-ness is *not authored*: it derives from the verification doc on the
  spec repo's main branch — v0.7's only admissible "done".

### 6.4 `hsdd-spec` graft mode

Adding a child to an already-decomposed node:

- Existing children's ids are stable; the new child takes the next slug.
- The parent's embedded child summaries and Mermaid DAG gain the new node.
- Any contract the new child consumes from a sibling goes through the normal
  `request` / governance-freeze path (v0.4.2) — grafting does not bypass it.

### 6.5 Intake records accumulate

Intake records are **dated and never superseded**, unlike progress reports and
execution plans, which supersede by design. After five change requests,
`hsdd/spec/` holds more nodes and longer phase ledgers; `hsdd/management/` holds
five intake records.

**This is the rule that replaces "wipe `hsdd/` and rebuild."** State it as such.

### 6.6 Node retirement

Features get deleted. A retired node takes `- **Status:** retired`; the file is
**kept in place** so ids stay resolvable for history, and is excluded from the
atlas's active view. Contracts it solely produced go to `retired`.

### 6.7 Parallel change requests

Disjoint changes route to different subtrees, where v0.6 §4's parallel execution
protocol (integration branches, one-lineage plans, `Collides with`
serialization) and v0.4.2's governance freeze plus `hsdd-reconcile` carry them
unchanged. What is new is that **intake is where collisions are detected**:

> Before routing, `hsdd-intake` reads every **open** intake record.

Three collision kinds, each serialized rather than raced:

| Collision | Rule |
|-----------|------|
| Two changes touching the same node or the same contract | Serialize, or merge into one intake record; record which |
| Two `new-capability` grafts under the same parent | Serialize — both edit the parent's child list and DAG |
| Two changes needing the same as-built node promoted | **Promote once, share the result.** The second intake consumes the promoted node; it does not re-promote |

An intake record closes when every phase it produced has a verification doc on
main — the same admissibility rule as everywhere else.

### 6.8 Milestones become per-campaign, and get sealed (resolves OQ-1)

v0.7's milestone document is implicitly per-project and open forever. v0.8.0
makes it **per-campaign**: a campaign is the adoption bootstrap, one change
request's fan-out, or a release train.

When every gate in a campaign is green, its milestone document is **sealed**:

- `- **Sealed:** YYYY-MM-DD` in the header block.
- Moved to `hsdd/management/archive/`.
- `hsdd-checkpoint` stops ticking it; the next campaign opens a new one.

**Admissibility for sealing is the rule that already exists:** every phase in
scope has a verification doc merged to spec-repo main. The seal is
evidence-backed, never declared. This is a small change to v0.7 — "the current
milestone document" becomes plural over time instead of singular forever.

### 6.9 Contract compatibility policy (resolves OQ-2)

`hsdd-contract` already states that a backward-compatible addition keeps the
version — producer-side backward compatibility. What is missing is the
**consumer-side obligation** (consumers tolerate unknown fields), which cannot
be a global mandate: a REST API can honor it, a DB schema partly, a UI contract
often cannot. So it becomes a declared per-contract policy in frontmatter:

| `compatibility:` | Means | Consequence |
|------------------|-------|-------------|
| `additive-only` | Protobuf discipline — optional additions only; never remove, retype, or repurpose a field; consumers must ignore unknowns | Compatible changes keep the version; **field-level deprecation replaces contract-level bumps** |
| `versioned` (default) | Today's behavior | Breaking change bumps the version, adds a migration note, opens a deprecation window |
| `frozen` | Not under our control, or adopted-pending-investigation | Any change means a new contract, not a new version |

**Enforcement, not aspiration:** `additive-only` is claimable only if **the
contract's existing fixtures still pass against the new schema**. vNext §5.2
already runs contracts at both gates, so the replay is already in the loop.

This also settles the adopted-contract worry directly: a contract at `@v0` with
`compatibility: additive-only` can be extended indefinitely without breaking the
consumers that depend on its warts, because a wart is never removed — the field
is deprecated and a new one added beside it.

Full status lifecycle after this chapter:
`draft → stable → deprecated → retired`, with a sunset date and migration note
on the deprecating version. `external_consumers` (vNext) covers consumers
outside the tree. **Retiring a version with a live consumer is a checkpoint
finding.**

### 6.10 The legal bypass

> Production incidents will bypass HSDD. If the bypass is not part of the
> method, it happens invisibly and the tree rots until nobody trusts it.

The path:

1. Ship the hotfix.
2. `hsdd-checkpoint`'s code-vs-plan pass detects it — it already flags "scope
   creep: code with no phase".
3. It files a **backfill** finding, which becomes an execution-plan step per the
   Findings→Plan loop.
4. The step appends a **retro phase** to the owning node's plan, with a
   verification doc written after the fact and explicitly marked as
   retroactive.
5. **A backfill unclosed across two consecutive checkpoints escalates** — the
   same shape as the existing two-consecutive-reds milestone trigger.

A recorded bypass beats a hidden one.

### 6.11 `hsdd-checkpoint` maintenance mode

The drift question inverts. Pre-launch: *is the code behind the plan?*
Post-launch: *is the plan behind the code?* The code-vs-plan pass already looks
both ways for contract surfaces; extend it to phases and to as-built
`## Observed surface` sections (§5.8).

---

## 7. Chapter 14 — Upgrading from ≥0.6.1

**v0.8.0 is additive. No existing project rewrites anything.**

The vehicle already exists: `hsdd-checkpoint`'s **Adoption Run** mode, whose
stated philosophy is exactly right for a version migration — *nonconformances
are findings, not errors; existing documents are adopted, not replaced; the
first atlas is generated whatever state the tree is in; conformance applies from
the next document forward.* Upgrading is a checkpoint run whose findings become
migration steps in the emitted execution plan.

| Change | Effect on an existing ≥0.6.1 project |
|--------|--------------------------------------|
| `## Learnings`, `## Metrics` in the verification template | Forward-only. Existing verification docs are never rewritten. |
| `Team` node field | Optional; absent is conformant. |
| Ordering policy in conventions frontmatter | Absent = `interfaces-first`. No edit needed. |
| Unified PE definition (vNext §10) | Applies to future sizing only. Existing phase plans stand. |
| `stable` requires executable validation (vNext §5.1) | **Grandfathered.** Applies to new versions and new `draft → stable` flips. Existing stable contracts without fixtures become a findings-register row with a migration step, never an error. |
| `compatibility:` field (§6.9) | Absent = `versioned`, which is today's behavior. |
| `retired` status; deprecation lifecycle | Additive to the existing `stable \| draft \| deprecated` lifecycle. |
| Per-campaign milestones; sealing (§6.8) | The existing milestone document becomes the current campaign's. Seal it when green, or leave it open. |
| `hsdd-intake`, append mode, graft mode | Used from the next change forward. No back-application. |
| `hsdd-adopt`, `@v0`, `## Observed surface` | **Inert** unless the project has unadopted code. |

**The one case worth calling out:** a fully-governed ≥0.6.1 project usually
still has system surface that was never in the tree — the code the HSDD-built
part sits inside. `hsdd-adopt` runs on *that*, grafting as-built nodes alongside
governed ones. The result is the same mixed tree as §5.7, reached from the other
direction, and it is the normal end state rather than a transitional one.

Projects below 0.6.1 are out of scope: upgrade to 0.6.1 first, per the existing
delta reading path, which remains in `spec/` as history.

---

## 8. Skill surface

**Scope note:** this table is the *consequence* of v0.8.0, not part of it. The
deliverable of the implementation plan that follows this design is
`spec/hsdd-spec-v0_8.md` plus the README and users-guide updates. Skill files
are edited in a separate cycle, after the spec is approved (acceptance
criterion 12).

| Skill | Change |
|-------|--------|
| `hsdd-adopt` | **New** — seam archaeology (bundled script), as-built specs with `## Observed surface`, `v0` contracts from seams, promotion |
| `hsdd-intake` | **New** — route a change request into an existing tree; collision check across open intake records |
| `hsdd-spec` | Graft mode; consumes `## Observed surface` on promotion |
| `hsdd-phase-plan` | Append mode; ordering policy (vNext §11); unified PE (vNext §10) |
| `hsdd-contract` | `compatibility:` policy; `retired` status; validation discipline (vNext §5.1) |
| `hsdd-checkpoint` | Maintenance mode; as-built drift diff; backfill findings; milestone sealing |
| `hsdd-milestone` | Per-campaign scope; seal on all-green |
| `hsdd-config` | Unchanged — push-based context survives; no CLI |
| `hsdd-reconcile` | Unchanged |
| `hsdd-adr` | Unchanged |

Ten skills is real surface growth. It is proportionate — two new lifecycle
stages, one skill each — and consolidation removes six documents from the
reading path, so net legibility improves.

**Verification template** gains `## Learnings` (vNext §6) and `## Metrics`
(vNext §14).

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Document size — a 1600–2000 line "consolidated" spec is a lot | It replaces six documents read in order; the deltas' restatement-of-context is pure duplication and compresses well. Chapter-level navigation and the settled-decisions table carry the skim path. |
| Most new material is reasoned-only, not field-tested | The provenance column (§4) makes that visible instead of letting it borrow credibility. GMP-911 or the current brownfield project is the natural first test. |
| Ten skills is discoverability pressure | Both new skills sit at lifecycle entry points (`adopt` at the start, `intake` at every change), which is where a user is already looking for one. |
| Dropping the CLI leaves mechanical invariants prose-enforced | Accepted knowingly, on the 0.6.0 pressure-campaign evidence. vNext remains on the shelf as a 0.9 candidate for the mechanization line. |
| `extract-seams.mjs` becomes a de-facto dependency of existing flows | §3.1's boundary is normative, and the drift check is gated on adopted nodes existing. Worth an acceptance criterion. |
| Consolidation could silently drop a rule from a delta | Acceptance criterion 1: a traceability pass, delta by delta. |
| `@v0` conflicts with an unnoticed "versions start at 1" assumption | Checked: `hsdd-contract` states "Versions are `v{n}`. No semantic versioning." No skill or template assumes a floor of 1. Acceptance criterion 6 re-verifies. |

---

## 10. Non-goals

- **No `hsdd` CLI.** No `context`, `lint`, `status`, `rename`, `check-scope`,
  `template`. Scripts are permitted only under §3.1's boundary.
- **No script that changes an existing skill's proven behavior.**
- **No `hsdd-review` skill.** Deferred; 0.6 review tiers stand.
- **No multi-team enforcement.** The `Team` field lands; acks, ADR approvals,
  and `--profile` lint do not.
- **No rewriting of shipped deltas.** They stay in `spec/` as history.
- **No back-application of v0.8.0 rules to existing artifacts.** Conformance
  applies from the next artifact forward.
- **No refactoring proposals from `hsdd-adopt`.** The tree fits the system.
- **No support for projects below 0.6.1.** Upgrade to 0.6.1 first.

---

## 11. Acceptance criteria for `spec/hsdd-spec-v0_8.md`

Recorded before the run, per the practice established at v0.7 §7.3.

1. **Traceability.** Every normative rule in v0.3, v0.4, v0.4.2, v0.5, v0.6,
   v0.6.1, and v0.7 appears in v0.8.0 or is listed in an explicit
   "deliberately dropped" table with a reason. Verified delta by delta.
2. **Salvage fidelity.** Every row of §3.2's "absorbed" table appears; no row of
   the "dropped" table appears.
3. **No delta framing.** The document reads standalone. No "read this against
   v0.x"; no unexplained references to superseded numbering.
4. **Peer entry points.** Chapters 5 and 6 are structurally parallel and both
   hand off to chapter 7.
5. **The PRD rule is stated as a rule** (§6.1), with the failure it prevents
   named alongside it.
6. **`@v0` is consistent** across chapter 6, chapter 3, the id-scheme table, and
   the conventions template; nothing assumes versions start at 1.
7. **Scripting boundary** (§3.1) is normative in the document, and the as-built
   drift check is explicitly gated on adopted nodes existing.
8. **Upgrade chapter** carries the full compatibility table and states that
   conformance applies forward only.
9. **Provenance column** present and populated in the settled-decisions table.
10. **Both former OQs appear as settled decisions, not open questions** —
    §6.8 and §6.9 resolve them.
11. **README and users guide updated:** reading path collapses to one spec; the
    claims rewrite (vNext §8.1) lands in the README's isolation and token claims;
    the skill table gains `hsdd-adopt` and `hsdd-intake`.
12. **Skills follow the spec, not the reverse.** No skill file is edited until
    v0.8.0 is approved.
