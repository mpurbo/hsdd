# v0.8.0: Consolidation + Brownfield Adoption + Steady State

**Date:** 2026-07-29
**Status:** Design — approved, ready for implementation planning
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
| Adopt vNext's mechanization (the `hsdd` CLI)? | **No.** No CLI, no `hsdd context`/`lint`/`status`/`check-scope`/`rename`/`template`. Mechanical invariants stay prose- and structure-enforced. |
| Is dropping the CLI a retreat? | No — vNext §1 concedes mechanization "is not a rescue; it is economics and determinism." The 0.6.0 pressure campaign showed the prose-and-structure defenses holding GREEN under combined authority, deadline, and social pressure. Dropping the CLI costs determinism and per-session tokens, not correctness. |
| What of vNext survives? | The tool-free half — see §3. |
| How does an adopted node carry mechanical evidence? | **One tier, evidence in a section.** As-built node specs carry `## Observed surface`. The epistemic split is per-section, not per-file. See §5. |
| Where does change intake live? | **A new skill,** not an extension of `hsdd-checkpoint`. Different trigger (event vs periodic), different posture (writes into governance vs read-only toward it). |

---

## 3. vNext salvage list

**Absorbed into v0.8.0:**

| vNext | What | Why it survives the CLI's removal |
|-------|------|-----------------------------------|
| §5.1 | `stable` requires executable validation (schema and/or fixtures) | A discipline, not a tool. Lint enforced it; `hsdd-reconcile` can assert it at the flip. |
| §5.2 | Both gates run the contract | Gate-command content, no tooling needed. |
| §5.3 | Integration nodes | Pure methodology — and the natural shape for the as-built ↔ governed seam (§5). |
| §6 | The feedback loop at the gate: `## Learnings`, every entry dispositioned (`spec-updated` / `contract-bumped` / `adr-proposed` / `dropped`) before sign-off | Load-bearing for §6: this is the channel from execution back into the spec. |
| §6.2, §6.3 | Mid-phase contract renegotiation; boundary corrections | Pure methodology. |
| §8.1 | Claims rewrite — honest isolation and token claims | Corrects claims that are currently overstated in shipped README/spec prose. |
| §10 | PE floor and ceiling in the same terms | Corrects a real inconsistency (0.6's floor and v0.3's ceiling use different units). |
| §11 | Phase ordering as a named policy (`interfaces-first` default) | Selected in conventions; no tooling needed. |
| §12 | Brownfield adoption | The point of this release — rewritten per §5 below. |
| §13.1 | The `Team` node field | One line; the durable landing spot for 0.6.1's mandatory "who builds what?" stop, whose answer currently evaporates. |
| §14 | Evidence program: `## Metrics` block, case study as v1.0 release criteria | Pure record-keeping. |

**Dropped with the CLI:**

| vNext | What | Consequence |
|-------|------|-------------|
| §2 | Normative grammar | Nothing changes: it only mattered as parser input; the 0.6.1 bullet templates already stand as the authored format. |
| §3 | The `hsdd` CLI and all six commands | Registries stay script-generated (`gen-registry.mjs`); everything else stays skill work. |
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
| 12 | Management Layer | v0.7 whole | field-tested |
| 13 | Layout, Profiles, Conventions | v0.5; v0.7 §6; vNext §13.1 | field-tested |
| 14 | Claims and Non-Goals | vNext §8.1; merged non-goals | reasoned |
| 15 | Evidence | vNext §14 | reasoned |
| 16 | Settled Decisions | merged tables, all deltas | — |
| 17 | Glossary | merged | — |

**Provenance is a required column** in chapter 16's settled-decisions table:
`field-tested` (GMP-911), `pressure-tested` (the 0.6.0 campaign), or
`reasoned-only`. Much of what this release adds is reasoned-only, and the
document must say so rather than let new material inherit credibility from the
tested parts.

Realistic size: **1600–2000 lines.** The seven deltas total 3,143 lines and
restate each other heavily; dedup should compress substantially.

---

## 5. Chapter 6 — Brownfield Adoption

New skill: **`hsdd-adopt`**. Revised from vNext §12 with the Observed-surface
decision.

### 5.1 Process

1. **Seam archaeology — extract, do not read.** Manifests
   (`package.json`, `go.mod`, `pom.xml`, BUILD files), directory tree, route
   registrations, proto/OpenAPI/GraphQL schemas, DB migrations, event topic
   producers and consumers, `CODEOWNERS`, and `git log --numstat` coupling
   clusters. Record the extraction commit SHA. Standard shell tooling
   (`find`, `grep`, `git`); no packaged CLI.
2. **Propose a shallow tree** (depth 1–2) on the seams that exist, not the ones
   anyone wishes existed. The ownership-first axis (0.6 §6) applies. `CODEOWNERS`
   plus history usually *answers* "who builds what?", which turns 0.6.1's
   mandatory stop into a confirmation rather than a blocker.
3. **Write as-built node specs** — one file per node (0.6.1 §5), the standard
   bullet header plus `- **Adopted:** as-built`, plus `## Observed surface`.
4. **Contracts from seams** — `version: v1` defined as *current behavior*.
5. **Stop.** No decomposition below what the first change needs.
6. **Prove the tree** — regenerate the contract and ADR registries.

### 5.2 The `## Observed surface` section

```markdown
## Observed surface

- extracted: 2026-07-29 @ a1b2c3d  (find/grep/git)
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

### 5.4 Adopted contracts start `stable`

Schemas come from the code or captured traffic; fixtures from existing tests or
captured payloads. That satisfies vNext §5.1, so adopted contracts start
`stable` and hand a validation harness to code that never had one. This is the
single highest-value output of an adoption run.

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

### 5.6 Why not full-depth reverse engineering

Two arguments, stated in the chapter so the question does not recur.

**Cost scales with seam count, not LOC.** Shallow adoption never reads the code
— it extracts structure. For 1M LOC that is roughly 1–3M tokens of mostly
mechanical input: hours, tens of dollars. Full depth to leaf-parent means
understanding every module's responsibility, so 10M+ tokens minimum before
synthesis, across hundreds of subagent runs: days, four figures. A 1M-LOC
monolith with 20 endpoints and 5 tables is *cheaper* to adopt than a 100k-LOC
service mesh with 40 services. **State this explicitly so nobody budgets by
LOC.**

**The trust argument decides it.** Generate 500 as-built node specs and nobody
reads 500 node specs — you now hold 500 unvalidated claims about intent that
every future agent session treats as authoritative. An as-built spec's value is
capped by whether a human confirmed it. Unread wrong specs propagate, which
makes full-depth adoption *worse* than no adoption.

### 5.7 The mixed tree is normal and permanent

Some nodes stay as-built forever. The seam between an as-built node and a
governed node is where the contract must be real — that is where the value
concentrates. vNext §5.3 integration nodes are the shape for exercising it.

### 5.8 Drift

`hsdd-checkpoint` re-runs extraction per adopted node and diffs against the
recorded `## Observed surface`. A diff is a **finding, not an error** — it lands
in the findings register and becomes a plan step or an explicit waiver, per the
existing Findings→Plan loop. Per-node scope keeps it cheap.

---

## 6. Chapter 11 — Steady State: Change Intake

New skill: **`hsdd-intake`**.

Separate from `hsdd-checkpoint` because the two differ on both axes that matter:
checkpoint is **periodic** and deliberately **read-only toward governance**;
intake is **event-driven** and its entire job is to route *into* governance.
Conflating them would muddy both.

- **Input:** a change request (PRD, RFC, ticket, incident) plus the atlas.
- **Output:** a routing decision written to
  `hsdd/management/YYYY-MM-DD-intake-{slug}.md`, then a handoff.

### 6.1 Routing classes

| Class | Means | Routes to |
|-------|-------|-----------|
| `local` | fits inside one existing leaf-parent | `hsdd-phase-plan` append mode |
| `cross-node` | touches several nodes' surfaces | `hsdd-contract` bump and/or `hsdd-adr`, then phase-plan each |
| `new-capability` | needs a node that does not exist | `hsdd-spec` graft mode on the parent |
| `structural` | the tree's shape is wrong for this change | **stop** — human decision, the expensive one |

Landing on an as-built node is not a fifth class: promote first (§5.5), then
reclassify.

The routing decision is **written before the handoff**, so the choice is
auditable rather than implicit in whatever the next skill did.

### 6.2 `hsdd-phase-plan` append mode

- Continue numbering from the highest existing phase id in the node's plan.
- **Never renumber. Never rewrite a shipped phase.**
- The phase summary table becomes a permanent ledger; shipped phases stay in it.
- Shipped-ness is *not authored*: it derives from the verification doc on the
  spec repo's main branch — v0.7's only admissible "done".

### 6.3 `hsdd-spec` graft mode

Adding a child to an already-decomposed node:

- Existing children's ids are stable; the new child takes the next slug.
- The parent's embedded child summaries and Mermaid DAG gain the new node.
- Any contract the new child consumes from a sibling goes through the normal
  `request` / governance-freeze path (v0.4.2) — grafting does not bypass it.

### 6.4 Contract deprecation lifecycle

`draft → stable → deprecated → retired`, with a sunset date and a migration note
on the deprecating version. Post-launch is when versioning stops being
theoretical. `external_consumers` (vNext) covers consumers outside the tree that
cannot be coordinated with. **Retiring a version with a live consumer is a
checkpoint finding.**

### 6.5 Node retirement

Features get deleted. A retired node takes `- **Status:** retired`; the file is
**kept in place** so ids stay resolvable for history, and is excluded from the
atlas's active view. Contracts it solely produced go to `retired`.

### 6.6 The legal bypass

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

### 6.7 `hsdd-checkpoint` maintenance mode

The drift question inverts. Pre-launch: *is the code behind the plan?*
Post-launch: *is the plan behind the code?* The code-vs-plan pass already looks
both ways for contract surfaces; extend it to phases and to as-built
`## Observed surface` sections (§5.8).

---

## 7. Skill surface

**Scope note:** this table is the *consequence* of v0.8.0, not part of it. The
deliverable of the implementation plan that follows this design is
`spec/hsdd-spec-v0_8.md` plus the README and users-guide updates. Skill files
are edited in a separate cycle, after the spec is approved (acceptance
criterion 8).

| Skill | Change |
|-------|--------|
| `hsdd-adopt` | **New** — seam archaeology, as-built specs with `## Observed surface`, contracts from seams, promotion |
| `hsdd-intake` | **New** — route a change request into an existing tree |
| `hsdd-spec` | Graft mode; consumes `## Observed surface` on promotion |
| `hsdd-phase-plan` | Append mode; ordering policy (vNext §11); unified PE (vNext §10) |
| `hsdd-contract` | Deprecation lifecycle; validation discipline (vNext §5.1) |
| `hsdd-checkpoint` | Maintenance mode; as-built drift diff; backfill findings |
| `hsdd-milestone` | Post-launch re-baseline trigger — see OQ-1 |
| `hsdd-config` | Unchanged — push-based context survives; no CLI |
| `hsdd-reconcile` | Unchanged |
| `hsdd-adr` | Unchanged |

Ten skills is real surface growth. It is proportionate — two new lifecycle
stages, one skill each — and consolidation removes six documents from the
reading path, so net legibility improves.

**Verification template** gains `## Learnings` (vNext §6) and `## Metrics`
(vNext §14).

---

## 8. Open questions (carried into v0.8.0 under the OQ convention)

- **OQ-1 — What does `hsdd-milestone` become after launch?** The launch gate is
  a one-time event; the natural post-launch analogue is a rolling release
  window rather than a fixed date. Written as an OQ rather than answered by
  invention.
- **OQ-2 — Does an adopted contract's `v1 = current behavior` survive its first
  bump?** If the wart is in v1 and v2 fixes it, consumers of the wart break.
  The deprecation lifecycle (§6.4) is the mechanism, but the migration-window
  policy for adopted contracts specifically is unsettled.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Document size — a 1600–2000 line "consolidated" spec is a lot | It replaces six documents read in order; the deltas' restatement-of-context is pure duplication and compresses well. Chapter-level navigation and the settled-decisions table carry the skim path. |
| Most new material is reasoned-only, not field-tested | The provenance column (§4) makes that visible instead of letting it borrow credibility. GMP-911 or the current brownfield project is the natural first test. |
| Ten skills is discoverability pressure | The two new skills sit at lifecycle entry points (`adopt` at the start, `intake` at every change), which is where a user is already looking for one. |
| Dropping the CLI leaves mechanical invariants prose-enforced | Accepted knowingly, on the 0.6.0 pressure-campaign evidence. vNext remains on the shelf as a 0.9 candidate for the mechanization line. |
| Consolidation could silently drop a rule from a delta | Acceptance criterion below: a traceability pass, delta by delta. |

---

## 10. Non-goals

- **No `hsdd` CLI.** No `context`, `lint`, `status`, `rename`, `check-scope`,
  `template`. The registry generator script stays as-is.
- **No `hsdd-review` skill.** Deferred; 0.6 review tiers stand.
- **No multi-team enforcement.** The `Team` field lands; acks, ADR approvals,
  and `--profile` lint do not.
- **No rewriting of shipped deltas.** They stay in `spec/` as history.
- **No refactoring proposals from `hsdd-adopt`.** The tree fits the system.

---

## 11. Acceptance criteria for `spec/hsdd-spec-v0_8.md`

Recorded before the run, per the practice established at v0.7 §7.3.

1. **Traceability.** Every normative rule in v0.3, v0.4, v0.4.2, v0.5, v0.6,
   v0.6.1, and v0.7 appears in v0.8.0 or is listed in an explicit
   "deliberately dropped" table with a reason. Verified delta by delta.
2. **Salvage fidelity.** Every row of §3's "absorbed" table appears; no row of
   the "dropped" table appears.
3. **No delta framing.** The document reads standalone. No "read this against
   v0.x"; no unexplained references to superseded numbering.
4. **Peer entry points.** Chapters 5 and 6 are structurally parallel and both
   hand off to chapter 7.
5. **Provenance column** present and populated in the settled-decisions table.
6. **Both OQs** present in the v0.7 OQ format (table row plus detail
   subsection).
7. **README and users guide updated:** reading path collapses to one spec; the
   claims rewrite (vNext §8.1) lands in the README's isolation and token claims;
   the skill table gains `hsdd-adopt` and `hsdd-intake`.
8. **Skills follow the spec, not the reverse.** No skill file is edited until
   v0.8.0 is approved.
