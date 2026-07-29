# HSDD v0.8.0 Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `spec/hsdd-spec-v0_8.md` — a single standalone specification
consolidating v0.3 through v0.7, absorbing the tool-free half of vNext, and
adding brownfield adoption and steady-state change intake — plus the README and
users-guide updates that follow from it.

**Architecture:** The deliverable is a document, so the test harness is a
**rule ledger**: every normative rule in the seven deltas, extracted first
(Task 1), each row dispositioned `carry` / `carry+amend` / `drop` and assigned a
target chapter. Chapters are then written in dependency order, each task ticking
its ledger rows. The ledger's `drop` rows become the spec's own
"deliberately dropped" table. The final task runs all thirteen acceptance
criteria and records the result, following the v0.7 practice
(`review/hsdd-v0_7-acceptance-microsite.md`).

**Tech Stack:** Markdown. Mermaid for diagrams (follow `mermaid-pastel-style`
if installed). `grep`/`wc` for mechanical verification. No build step, no CLI.

## Global Constraints

- **Source of truth for every design decision:** `docs/superpowers/specs/2026-07-29-v0_8-consolidation-brownfield-design.md`. Where this plan and the design doc disagree, the design doc wins.
- **The document is standalone.** No "read this against v0.x". No unexplained references to superseded numbering. Deltas may be cited only as history, in chapter 14 and the glossary.
- **Skill files are out of scope.** Do not edit anything under `skills/` or `commands/`. Skills follow in a separate cycle (acceptance criterion 13).
- **No `hsdd` CLI.** No `context`, `lint`, `status`, `rename`, `check-scope`, `template` commands anywhere in the document. Scripts appear only under the §3.1 boundary: bundled with a new skill, never changing an existing skill's behavior.
- **Adopted contracts are `v0`.** Never `v1`. Versions are `v{n}` with no semantic versioning.
- **Provenance vocabulary is exactly:** `field-tested`, `pressure-tested`, `reasoned-only`.
- **Node header fields are bullet lists**, never bare `**Field:**` lines (v0.6 §2.1).
- **Standalone file heading rule:** one `#` title, `##` sections, no repeated `###` title (v0.6 §2.4).
- **Target length:** 1600–2000 lines. If a chapter draft pushes past its share, thin restatement — never drop a rule.

---

## Chapter → source map

Every chapter cites its sources. Ranges are `file:start-end` in the current repo.

| Ch | Title | Sources |
|----|-------|---------|
| 1 | What HSDD Is | `v0_3:16-144` (§1–3), `v0_3:777-798` (§13), `v0_3:428-469` (§7 skill set + chaining — **see gap note**), README framing |
| 2 | The Node Model | `v0_3:145-253` (§4), `v0_6:79-168` (§2.1, §2.4), `v0_6:357-417` (§6 axis), `v0_6_1:58-156` (§2 sources), `v0_6_1:195-255` (§4 stop, §5 one file per child), `v0_6_1:256-277` (§6 format), vNext §13.1 `Team` |
| 3 | Contracts | `v0_3:254-372` (§5), `v0_4_2:205-221` (§4.1), `v0_5:61-72` (§3), vNext §5.1–5.3 |
| 4 | ADRs and Open Questions | `v0_4:47-185` (§2–4), `v0_7:445-513` (§5) |
| 5 | Entry A: Greenfield Bootstrap | `v0_3:373-427` (§6), `v0_3:502-567` (§9), `v0_4:186-249` (§5) |
| 6 | Entry B: Brownfield Adoption | **NEW** — design §5 |
| 7 | Phase Planning | `v0_3:684-693` (§12.1), `v0_3:719-735` (§12.3), `v0_6:79-168` (§2), `v0_6:169-245` (§3), `v0_6_1:157-194` (§3), vNext §10, §11 |
| 8 | Governance: Freeze and Reconcile | `v0_4_2:53-204` (§2–3), `v0_4_2:222-234` (§4.2) |
| 9 | Execution: the OpenSpec Cycle | `v0_3:414-427` (§6.2), `v0_3:517-567` (§9.2), `v0_3:663-678` (§11.3), `v0_3:470-501` (§8 companion skills — **see gap note**), `v0_6:246-318` (§4), `v0_7:539-576` (§6.2) |
| 10 | The Gate | `v0_3:679-758` (§12), `v0_6:195-219` (§3.2), `v0_6:319-356` (§5), vNext §6, §6.2, §6.3, §14.1 |
| 11 | Steady State: Change Intake | **NEW** — design §6 |
| 12 | Management Layer | `v0_7:101-444` (§2–4), plus design §6.8 sealing, §5.8 drift, §6.11 maintenance mode |
| 13 | Layout, Profiles, Conventions | `v0_3:616-678` (§11), `v0_3:568-615` (§10 packaging — **see gap note**), `v0_5:44-104` (§2, §4, §5), `v0_7:514-616` (§6), `v0_7:694-704` (§8.2) |
| 14 | Upgrading and Compatibility | **NEW** — design §7, modelled on `v0_7:617-675` (§7) |
| 15 | Claims and Non-Goals | `v0_3:799-827` (§14), `v0_7:763-776` (§10), vNext §8.1, design §10 |
| 16 | Evidence | vNext §14, pointers into `review/` |
| 17 | Settled Decisions | `v0_3:828-844`, `v0_4:267-279`, `v0_4_2:259-274`, `v0_6:430-449`, `v0_6_1:291-305`, `v0_7:726-762`, design §2 |
| 18 | Glossary | `v0_3:859-872`, vNext §19 (tool-free subset) |

**Gap note — three v0.3 sections the design outline did not assign.** They carry
real rules, so criterion 1 would fail silently without a home:

- **v0.3 §7 (The Skill Set, §7.1 chaining, §7.2/§7.3 naming rationale) → chapter 1**, as a closing section. It answers "what is HSDD made of", which is chapter 1's job. Updated to ten skills.
- **v0.3 §8 (Recommended Companion Skills) → chapter 9**, since `hsdd-config` is what wires them into each cycle.
- **v0.3 §10 (Packaging: skills vs slash commands) → chapter 13**, with layout and distribution.

**Deliberately not carried forward** (delta scaffolding, not rules): every
"What X Changes and Why" section, every "Skill Edits (summary)" section, every
"Implementation Steps" / "Implementation Plan" section, `v0_3:845-858` (§16 Next
Steps), and `v0_7:705-725` (§8.3, relationship to the 0.8 candidate — this
document resolves it). Record each in the ledger as `drop` with this reason so
the traceability pass is explicit rather than assumed.

---

## Task 1: The rule ledger

The test harness. Nothing else can be verified without it.

**Files:**
- Create: `docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md`

**Interfaces:**
- Produces: the ledger table every later task ticks rows in, and the `drop` rows Task 12 compiles into the spec's dropped table.

- [ ] **Step 1: Create the ledger with its header and format**

```markdown
# v0.8.0 Rule Ledger

Test harness for `spec/hsdd-spec-v0_8.md` acceptance criterion 1.
Every normative rule in v0.3–v0.7 gets a row. A rule is normative if it
constrains what an artifact must contain, what a skill must do, or when a
gate passes.

Dispositions: `carry` (verbatim intent) | `carry+amend` (changed by v0.8.0) |
`drop` (deliberately removed) | `scaffold` (delta framing, not a rule)

| # | Source | Rule | Disposition | Target | Done |
|---|--------|------|-------------|--------|------|
| 1 | v0.3 §4.4 | Node id is the dotted path of slugs from the root; leaf phases numbered | carry | ch2 | [ ] |
| 2 | v0.3 §5.1 | Contract frontmatter carries id, version, status, kind, owner | carry+amend (adds `compatibility`) | ch3 | [ ] |
| 3 | v0.4.2 §3.1 | Phase planning may not edit shared governance files; it emits a pending section | carry | ch8 | [ ] |
```

- [ ] **Step 2: Extract rules from v0.3**

Read `spec/hsdd-spec-v0_3.md` in full. Add one row per normative rule. Sections
§1–3, §13 → ch1; §4 → ch2; §5 → ch3; §6, §9 → ch5/ch9; §7 → ch1; §8 → ch9;
§10 → ch13; §11 → ch13; §12 → ch7/ch10; §14 → ch15; §15 → ch17; §16 → `drop`
(scaffold); §17 → ch18.

- [ ] **Step 3: Extract rules from v0.4, v0.4.2, v0.5**

`v0_4` §2–4 → ch4; §5 → ch5; §6 → ch13; §7 → ch17; §1, §8 → `scaffold`.
`v0_4_2` §2–3 → ch8; §4.1 → ch3; §4.2 → ch8; §6 → ch13; §7 → ch17; §1, §5, §8 → `scaffold`.
`v0_5` §2, §4, §5 → ch13; §3 → ch3; §1 → `scaffold`.

- [ ] **Step 4: Extract rules from v0.6 and v0.6.1**

`v0_6` §2 → ch2/ch7; §3 → ch7; §4 → ch9; §5 → ch10; §6 → ch2; §8 → ch17; §1, §7, §9 → `scaffold`.
`v0_6_1` §2 → ch2; §3 → ch7; §4 → ch2; §5 → ch2; §6 → ch2; §8 → ch17; §1, §7, §9 → `scaffold`.

- [ ] **Step 5: Extract rules from v0.7**

`v0_7` §2–4 → ch12; §5 → ch4; §6 → ch13; §7 → ch14 (as the model for the upgrade
chapter, not carried verbatim); §8.1–8.2 → ch1/ch13; §8.3 → `drop` (this document
resolves it); §9 → ch17; §10 → ch15; §1, §11 → `scaffold`.

- [ ] **Step 6: Add the vNext rows**

One row per item in design §3.2's two tables. Absorbed rows get their target
chapter; dropped rows get `drop` and the reason from the design doc's second
table.

- [ ] **Step 7: Verify the ledger is complete**

```bash
# Every ## and ### section of every delta should be represented at least once
for f in v0_3 v0_4 v0_4_2 v0_5 v0_6 v0_6_1 v0_7; do
  echo "$f: $(grep -cE '^#{2,3} ' spec/hsdd-spec-$f.md) sections"
done
grep -c '^| [0-9]' docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
```

Expected: the ledger row count materially exceeds the total section count (rules
are finer-grained than sections). Then read the section list back and confirm
each has at least one ledger row citing it.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "plan: v0.8.0 rule ledger — traceability harness for the consolidation"
```

---

## Task 2: Skeleton and chapters 1–2

**Files:**
- Create: `spec/hsdd-spec-v0_8.md`
- Modify: `docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md` (tick rows)

**Interfaces:**
- Produces: the document header block and chapter numbering every later task appends to; the node header grammar chapters 6, 7, and 11 extend.

- [ ] **Step 1: Write the header block and chapter skeleton**

```markdown
# HSDD: Hierarchical Spec-Driven Development

**Version:** 0.8.0
**Status:** Current specification
**Date:** 2026-07-29
**Owner:** Purbo Mohamad

This is the complete specification. It consolidates and replaces the delta
series v0.3 through v0.7, which remain in `spec/` as history. Nothing here
requires reading them.

---

## 1. What HSDD Is
## 2. The Node Model
...
## 18. Glossary
```

Write all eighteen `##` headings now, in the order of the chapter map above, so
later tasks append into a fixed structure.

- [ ] **Step 2: Write chapter 1**

Consolidate `v0_3:16-144` (why HSDD exists, relationship to OpenSpec, core
concepts) and `v0_3:777-798` (the OpenSpec vs HSDD comparison table). Close with
the skill set section from `v0_3:428-469`, updated to ten skills — add
`hsdd-adopt` and `hsdd-intake` to the chain diagram and the table, and keep
§7.2/§7.3's naming rationale.

Do **not** restate the isolation or token claims in their v0.3 wording; chapter
1 states the shape of the method and cross-references chapter 15 for the claims.

- [ ] **Step 3: Write chapter 2**

Consolidate the node model (`v0_3:145-253`), the bullet-list field rule and
standalone heading rule (`v0_6:79-90`, `v0_6:159-168`), the ownership-first axis
(`v0_6:357-417`), the mandatory "who builds what?" stop (`v0_6_1:195-229`),
source provenance and trickle-down (`v0_6_1:58-156`), one spec file per child
node (`v0_6_1:230-255`), and format clarifications (`v0_6_1:256-277`).

Extend the node header grammar with three fields — mark each as new:

```markdown
- **Team:** {name}                       # optional; the durable answer to "who builds what?"
- **Adopted:** as-built | promoted       # brownfield only (chapter 6)
- **Status:** active | retired           # default active (chapter 11)
```

- [ ] **Step 4: Tick the ledger and verify structure**

```bash
grep -cE "^## " spec/hsdd-spec-v0_8.md          # expect 18
grep -nE "^#{1} " spec/hsdd-spec-v0_8.md        # expect exactly 1 (line 1)
grep -nE "read .{0,12}against v0\." spec/hsdd-spec-v0_8.md   # expect no output
```

Mark every ch1 and ch2 ledger row `[x]`.

- [ ] **Step 5: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): skeleton, chapter 1 (what HSDD is), chapter 2 (node model)"
```

---

## Task 3: Chapters 3–4 — Contracts, ADRs and Open Questions

Chapter 3 must land before chapter 6, which references `v0`, `compatibility`,
and `## Observed completeness`.

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: node header grammar (Task 2).
- Produces: contract frontmatter schema (`id`, `version`, `status`, `kind`, `owner`, `compatibility`, `external_consumers`, `validation`), the `v0` convention, and the integration-node definition — all referenced by chapters 6, 11, 12, 14.

- [ ] **Step 1: Write chapter 3, carried material**

Consolidate `v0_3:254-372` (contract artifact, the four dependency types, the
generated registry, context isolation), `v0_4_2:205-221` (`phase_ids`), and
`v0_5:61-72` (registry generator defaults). Keep the rule that the registry is
generated by `skills/hsdd-contract/scripts/gen-registry.mjs`, never
hand-maintained.

- [ ] **Step 2: Add the validation discipline and integration nodes**

From vNext §5.1–5.3: `stable` requires executable validation (schema and/or
fixtures); both the phase gate and the node gate run the contract; an
integration node is a leaf-parent child with `hard` edges to producing siblings,
whose phases exercise the real composed behavior, reviewed `full-review`, owned
by exactly one team. Cross-reference chapter 2's node-kind list.

- [ ] **Step 3: Add the version and compatibility rules (new)**

State, from design §5.4 and §6.9:

```markdown
Versions are `v{n}`. There is no semantic versioning.

`v0` is reserved for adopted contracts (chapter 6): the interface as the
existing system already implements it. It is a permanent property, not a
waypoint — a `v0` contract that has absorbed additions for years is still
inherited. `v0 -> v1` is the contract-level adoption exit, taken only when the
interface is genuinely redesigned.

`compatibility` is declared per version:

| value | meaning | consequence |
|-------|---------|-------------|
| `additive-only` | optional additions only; never remove, retype, or repurpose a field; consumers ignore unknowns | compatible changes keep the version; field-level deprecation replaces contract-level bumps |
| `versioned` (default) | breaking changes bump | migration note plus a deprecation window |
| `frozen` | not under our control, or adopted pending investigation | a change means a new contract, not a new version |

`additive-only` is claimable only if the contract's existing fixtures still pass
against the new schema. Both gates already replay them.

Status lifecycle: `draft -> stable -> deprecated -> retired`. Retiring a version
that still has a live consumer — including an `external_consumers` entry — is a
checkpoint finding.
```

- [ ] **Step 4: Write chapter 4**

Consolidate the ADR artifact and handoff rules (`v0_4:47-185`) and the
open-question convention with its structural anchors (`v0_7:445-513`).

- [ ] **Step 5: Verify and tick**

```bash
grep -n "@v1" spec/hsdd-spec-v0_8.md    # any hit must be a generic example, never an adopted contract
grep -n "semantic versioning" spec/hsdd-spec-v0_8.md   # expect the "no semantic versioning" rule
```

Mark every ch3 and ch4 ledger row `[x]`.

- [ ] **Step 6: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 3 (contracts, v0, compatibility), chapter 4 (ADRs, OQs)"
```

---

## Task 4: Chapter 5 — Entry A: Greenfield Bootstrap

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: chapters 2–4.
- Produces: the entry-point structure chapter 6 mirrors, and the handoff into chapter 7 that both entries share.

- [ ] **Step 1: Write the chapter**

Consolidate the end-to-end workflow (`v0_3:373-427`), the trigger quick
reference and scripted session (`v0_3:502-567`), and where to run `openspec
init` with its sequence and polyrepo case (`v0_4:186-249`).

- [ ] **Step 2: Frame it as an entry point**

Open with one paragraph naming it Entry A, stating its precondition (no existing
system, or a system whose code is out of scope) and its exit (a tree whose
leaf-parents are ready for chapter 7). Chapter 6 opens with the parallel
paragraph. Both must end by handing to chapter 7 in the same words.

- [ ] **Step 3: Verify and tick**

```bash
grep -n "Entry A\|Entry B" spec/hsdd-spec-v0_8.md   # both named, parallel phrasing
```

Mark every ch5 ledger row `[x]`.

- [ ] **Step 4: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 5 (greenfield bootstrap) as Entry A"
```

---

## Task 5: Chapter 6 — Entry B: Brownfield Adoption

Entirely new. Source: design §5. This chapter and chapter 11 are the release.

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: contract schema and `v0` (Task 3), node header `Adopted` field (Task 2), Entry-A framing (Task 4).
- Produces: `## Observed surface`, `## Observed completeness`, and the promotion protocol — consumed by chapters 11, 12, 14.

- [ ] **Step 1: Write the six-step process and the scripting boundary**

Design §5.1 verbatim in intent. State the §3.1 boundary as a normative rule
where the script is introduced:

```markdown
A script may ship bundled with a new skill. No script may change how an
existing skill behaves.

`hsdd-adopt` bundles `scripts/extract-seams.mjs`, following the precedent of
`hsdd-contract`'s registry generator. `hsdd-checkpoint` reuses it for drift
detection (chapter 12) on one condition: that path executes only when the tree
contains adopted nodes. A tree with none never reaches it.
```

- [ ] **Step 2: Specify `## Observed surface`**

Design §5.2, including the worked example block and the seam-level (not
file-level) rule. State that the extraction SHA is required.

- [ ] **Step 3: Write the honesty rules**

Design §5.3 — `unknown:` lines required, `Isolation strategy` describes today,
contracts carry warts, no refactoring proposals. Give `unknown:` an
anti-rationalization row in the chapter's table: *"The node looks fully
understood" → then you did not look. Every adopted node has unknowns; naming
none is the tell.*

- [ ] **Step 4: Write §5.4's contract rules**

`v0`, `status: stable`, and the required `## Observed completeness` block with
its worked example. Include the permanence rule and the `v0 -> v1` adoption exit
(cross-reference chapter 3, do not restate the table).

- [ ] **Step 5: Write promotion, the cost argument, the mixed tree, and drift**

Design §5.5–5.8. The cost argument (§5.6) states both halves: cost scales with
seam count not LOC, and the trust argument — an as-built spec's value is capped
by whether a human confirmed it, so the confirmation stop keeps the validated
fraction at 100%.

- [ ] **Step 6: Verify and tick**

```bash
grep -n "extract-seams" spec/hsdd-spec-v0_8.md
grep -n "Observed surface\|Observed completeness" spec/hsdd-spec-v0_8.md
grep -n "adopted nodes" spec/hsdd-spec-v0_8.md   # the drift gating rule must be present
```

Mark every vNext §12 ledger row `[x]`.

- [ ] **Step 7: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 6 — brownfield adoption as Entry B"
```

---

## Task 6: Chapters 7–8 — Phase Planning, Governance

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: chapters 2–6.
- Produces: the phase template, review tiers, the sizing floor and PE, and the pending-governance wire format — consumed by chapters 9–12.

- [ ] **Step 1: Write chapter 7's carried material**

Readable plans and the phase template (`v0_6:79-168`), proportional ceremony,
the sizing floor, tier-scaled artifacts, the node-level default gate
(`v0_6:169-245`), the floor's checklist anchor (`v0_6_1:157-194`), review tiers
(`v0_3:684-693`).

- [ ] **Step 2: Unify the PE (vNext §10)**

Replace v0.3 §12.3's ~5-hour framing and v0.6's separate floor units with one
definition, stated once:

```markdown
One Phase Equivalent (PE) is the largest change one reviewer can genuinely
review and manually verify in one sitting, plus the agent run that produced it:
roughly <= 400 changed lines, <= 8 tasks, about half a day end to end. The
~5-hour window is calibration for that, not a second definition. The sizing
floor and the sizing ceiling are expressed in these same terms.
```

- [ ] **Step 3: Add the ordering policy (vNext §11)**

A named policy selected in conventions frontmatter, `interfaces-first` by
default, with `fp-progression` as the documented alternative. This supersedes
v0.3 §7's FP-progression mandate — record that as `carry+amend` in the ledger.

- [ ] **Step 4: Write chapter 8**

The governance freeze protocol, the pending section wire format, contract gaps
(ask or record), sibling isolation (`v0_4_2:53-204`), and the conventions
template additions (`v0_4_2:222-234`). This is the pressure-tested core — carry
its anti-rationalization content intact.

- [ ] **Step 5: Verify and tick**

```bash
grep -n "Phase Equivalent" spec/hsdd-spec-v0_8.md   # expect exactly one definition site
grep -n "interfaces-first" spec/hsdd-spec-v0_8.md
```

Mark ch7 and ch8 ledger rows `[x]`.

- [ ] **Step 6: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 7 (phase planning, unified PE), chapter 8 (governance freeze)"
```

---

## Task 7: Chapters 9–10 — Execution, The Gate

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: chapters 7–8.
- Produces: the verification document template (with `## Learnings` and `## Metrics`) — consumed by chapters 11, 12, 14, 16.

- [ ] **Step 1: Write chapter 9**

Planning vs execution (`v0_3:414-427`), the scripted session (`v0_3:517-567`),
the verification document convention (`v0_3:663-678`), the execution protocol —
`config.yaml` ephemerality, branch discipline, `Collides with`, capability
naming (`v0_6:246-318`) — and the run-location rule (`v0_7:539-576`). Close with
the companion-skills section from `v0_3:470-501`, per the gap note.

- [ ] **Step 2: Write chapter 10's carried material**

Human-in-the-loop and the review window (`v0_3:679-758`), tier-scaled artifacts
(`v0_6:195-219`), and the verification doc template with its sign-off block
(`v0_6:319-356`).

- [ ] **Step 3: Add the Learnings loop (vNext §6)**

```markdown
## Learnings

A gate-time finding about the tree, not this phase's claims. Every entry is
dispositioned before sign-off — no entry may be left open:

- `spec-updated` — the owning node spec was corrected
- `contract-bumped` — a contract changed; cite the id and version
- `adr-proposed` — a cross-cutting decision was raised; cite the ADR id
- `dropped` — considered and rejected; say why in one line

`Outstanding` covers what this phase could not verify. `Learnings` covers what
this phase discovered about everything else. Dispositions execute at the root,
through the owning skill.
```

Add mid-phase contract renegotiation and boundary corrections (vNext §6.2, §6.3).

- [ ] **Step 4: Add the Metrics block (vNext §14.1)**

The optional `## Metrics` section — agent wall-clock, review wall-clock, gate
failures before green, tokens if reported, product-diff vs process-artifact line
counts, escaped defects filled retroactively.

- [ ] **Step 5: Verify and tick**

```bash
grep -n "## Learnings\|## Metrics" spec/hsdd-spec-v0_8.md
grep -n "spec-updated\|contract-bumped\|adr-proposed\|dropped" spec/hsdd-spec-v0_8.md
```

Mark ch9 and ch10 ledger rows `[x]`.

- [ ] **Step 6: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 9 (execution), chapter 10 (the gate, Learnings, Metrics)"
```

---

## Task 8: Chapter 11 — Steady State: Change Intake

Entirely new. Source: design §6.

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: chapters 2–10 — especially promotion (ch6), the phase template (ch7), the freeze (ch8), and the verification doc (ch10).
- Produces: the intake record shape and the backfill finding type — consumed by chapter 12.

- [ ] **Step 1: Open with the load-bearing rule**

Design §6.1, stated as a rule with the failure it prevents named beside it:

```markdown
> A PRD is never a root. There is one tree, and it is the system's.

The root of `hsdd/spec/` is the system, created once — by adoption (chapter 6)
or by greenfield bootstrap (chapter 5). A change request is an input that
produces changes to that tree: nodes grafted, phases appended. It never becomes
a root and never gets a spec of its own.

**The failure this prevents:** treating each PRD as a root produces a tree that
describes a project rather than a system, which must be discarded when the next
PRD arrives. The adoption cost is then paid every time and amortizes over
nothing.
```

Then the three consequences: the PRD lands in `## Sources` on every node it
governs; the intake record is where it is visible as one unit of work; and the
split — spec tree is system structure and permanent, management layer is work
units and episodic.

- [ ] **Step 2: Write the routing classes**

Design §6.2's four-row table (`local`, `cross-node`, `new-capability`,
`structural`), the as-built-node rule (promote first, then reclassify), and the
requirement that the routing decision is written before the handoff.

- [ ] **Step 3: Write append mode, graft mode, and accumulation**

Design §6.3, §6.4, §6.5. State §6.5 as the explicit replacement for
"wipe `hsdd/` and rebuild": intake records are dated and never superseded,
unlike progress reports and execution plans.

- [ ] **Step 4: Write node retirement and parallel change requests**

Design §6.6 and §6.7, including the three-row collision table. Give
promote-once-share-the-result its own emphasis — it is the collision most likely
to be raced.

- [ ] **Step 5: Write the legal bypass**

Design §6.10, all five steps plus the two-consecutive-checkpoints escalation.
Open with the quoted rationale so the mechanism is not mistaken for permission
to skip the method casually.

- [ ] **Step 6: Verify and tick**

```bash
grep -n "never a root" spec/hsdd-spec-v0_8.md
grep -n "backfill" spec/hsdd-spec-v0_8.md
grep -n "Promote once" spec/hsdd-spec-v0_8.md
```

Mark every design-§6 ledger row `[x]`.

- [ ] **Step 7: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 11 — steady state, change intake, the legal bypass"
```

---

## Task 9: Chapters 12–13 — Management Layer, Layout

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: chapters 6, 10, 11.
- Produces: `hsdd/management/archive/` and the sealed-milestone rule — consumed by chapter 14.

- [ ] **Step 1: Write chapter 12's carried material**

The fourth artifact class, the document chain, the progress report, the
execution plan, the milestone document, the atlas, the findings→plan loop
(`v0_7:101-325`), checkpoint's one-pass-four-views and two modes
(`v0_7:326-396`), and milestone generation and the maintenance split
(`v0_7:397-444`).

- [ ] **Step 2: Add per-campaign milestones and sealing (new)**

Design §6.8. Define a campaign as the adoption bootstrap, one change request's
fan-out, or a release train. Sealing writes `- **Sealed:** YYYY-MM-DD`, moves
the document to `hsdd/management/archive/`, and stops checkpoint ticking it.
Admissibility for sealing is the existing rule: every phase in scope has a
verification doc merged to spec-repo main.

- [ ] **Step 3: Add maintenance mode, drift, and backfill findings (new)**

Design §6.11 (the drift question inverts post-launch), §5.8 (as-built drift diff,
gated on adopted nodes existing), and the `backfill` finding type from chapter
11. Each lands in the findings register and becomes a plan step or an explicit
waiver, under the existing loop rule.

- [ ] **Step 4: Write chapter 13**

The artifact model and repository layout (`v0_3:616-678`), the `hsdd/` root and
singular directory names (`v0_5:44-60`), pre-0.5 projects and what does not
change (`v0_5:73-104`), the standalone-spec-repo profile (`v0_7:514-616`),
layout additions (`v0_7:694-704`), and packaging — skills vs slash commands —
from `v0_3:568-615` per the gap note. Add `hsdd/management/archive/` to the
layout and the `single-team` / `multi-team` profile default with the `Team`
field.

- [ ] **Step 5: Verify and tick**

```bash
grep -n "Sealed\|management/archive" spec/hsdd-spec-v0_8.md
grep -n "single-team" spec/hsdd-spec-v0_8.md
```

Mark ch12 and ch13 ledger rows `[x]`.

- [ ] **Step 6: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 12 (management, sealing, drift), chapter 13 (layout, profiles)"
```

---

## Task 10: Chapter 14 — Upgrading and Compatibility

New. Source: design §7, modelled on `v0_7:617-675`.

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

- [ ] **Step 1: State the compatibility contract**

v0.8.0 is additive; no existing project rewrites anything. The vehicle is
`hsdd-checkpoint`'s existing Adoption Run mode — nonconformances are findings
not errors, existing documents are adopted not replaced, conformance applies
from the next document forward.

- [ ] **Step 2: Write the full compatibility table**

Design §7's ten-row table, verbatim in intent. Every row states the effect on a
≥0.6.1 project.

- [ ] **Step 3: Write the grandfather clause and its end state**

Design §7.1, all three closure properties plus the named rejected alternatives:

```markdown
1. The set is closed at upgrade time. The upgrade checkpoint enumerates every
   contract already `stable` without executable validation and marks each
   `validation: grandfathered`. Nothing may join afterward. A new contract
   flipped `draft -> stable` without fixtures is an error, not a grandfather
   case.
2. It discharges on touch, not on a date. Any phase that produces, amends, or
   bumps a grandfathered contract must add fixtures before its gate passes.
3. The count is reported each checkpoint and can only fall. A rising count is a
   finding — property 1 was violated.

Rejected: a fixed sunset date (HSDD does not control anyone's calendar, and a
cliff invites blanket waivers) and permanent unmarked grandfathering (invisible,
uncountable, never drains).
```

- [ ] **Step 4: State the mixed-tree end state and the version floor**

A fully-governed ≥0.6.1 project usually still has surface that was never in the
tree; `hsdd-adopt` runs on that, and the mixed tree is the normal end state, not
a transitional one. Projects below 0.6.1 upgrade to 0.6.1 first via the delta
reading path, which remains in `spec/` as history. **This is the only chapter
that may reference the deltas as a reading path.**

- [ ] **Step 5: Verify and tick**

```bash
grep -n "grandfathered" spec/hsdd-spec-v0_8.md
grep -n "discharges on touch\|on touch, not on a date" spec/hsdd-spec-v0_8.md
```

Mark ch14 ledger rows `[x]`.

- [ ] **Step 6: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 14 — upgrading from >=0.6.1, grandfather clause"
```

---

## Task 11: Chapters 15–16 — Claims and Non-Goals, Evidence

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

- [ ] **Step 1: Write the claims rewrite (vNext §8.1)**

Replace the isolation and token claims wherever the old wording would have gone:

```markdown
**Isolation.** Per-phase context shapes attention: a session receives its own
phase plus only the interfaces of the contracts it consumes, so it is unlikely
to wander into a sibling's concern or fabricate an interface it was never
given. The defense is prose and structure, tested under adversarial pressure
and found to hold — but it is probabilistic, not enforced. HSDD does not
mechanically prevent a session from reading a file outside its phase.

**Tokens.** Per-session context is bounded and proportional to the phase, not
the system. Total tokens across a project scale with phase count, and planning
carries its own overhead. HSDD bounds the per-session cost; it does not reduce
the total.
```

- [ ] **Step 2: Merge the non-goals**

`v0_3:816-827`, `v0_7:763-776`, and design §10. Deduplicate; keep every distinct
exclusion. The CLI exclusion and the scripting boundary both appear here.

- [ ] **Step 3: Write chapter 16**

vNext §14 — the metrics pipeline (cross-reference chapter 10's block rather than
restating it), and the case study as v1.0 release criteria. Point at the real
artifacts in `review/` that already exist: the GMP-911 field test and the 0.6.0
pressure campaign.

- [ ] **Step 4: Verify and tick**

```bash
grep -n "probabilistic" spec/hsdd-spec-v0_8.md
grep -n "does not reduce the total\|scale with phase count" spec/hsdd-spec-v0_8.md
```

Mark ch15 and ch16 ledger rows `[x]`.

- [ ] **Step 5: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 15 (honest claims, non-goals), chapter 16 (evidence)"
```

---

## Task 12: Chapters 17–18 — Settled Decisions, Glossary, ledger reconciliation

**Files:**
- Modify: `spec/hsdd-spec-v0_8.md`, ledger

**Interfaces:**
- Consumes: every prior chapter, and the ledger's `drop` rows.

- [ ] **Step 1: Merge the settled-decisions tables**

From `v0_3:828-844`, `v0_4:267-279`, `v0_4_2:259-274`, `v0_6:430-449`,
`v0_6_1:291-305`, `v0_7:726-762`, plus design §2's rows. Where a later delta
revised an earlier decision, keep only the current answer — the superseded one
goes in the dropped table with a pointer.

- [ ] **Step 2: Add the provenance column**

Three values only: `field-tested` (GMP-911), `pressure-tested` (the 0.6.0
campaign), `reasoned-only`. Everything from chapters 6, 11, and 14 is
`reasoned-only`. Add one line above the table saying why the column exists: new
material must not inherit credibility from tested material.

- [ ] **Step 3: Compile the deliberately-dropped table**

Every ledger row dispositioned `drop`, with its reason. This is what acceptance
criterion 1 checks against.

- [ ] **Step 4: Write chapter 18**

`v0_3:859-872` plus new terms: as-built node, promoted node, Observed surface,
Observed completeness, campaign, sealed milestone, intake record, backfill,
grandfathered contract, integration node, Learning, ordering policy, profile,
PE (revised), `external_consumers`.

Do **not** import vNext glossary entries for dropped machinery: no `hsdd` CLI,
no normative grammar, no Phase Context artifact, no derived state, no `Touches`.

- [ ] **Step 5: Reconcile the ledger**

```bash
grep -c '\[ \]' docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
```

Expected: 0 unticked rows. Any remaining row is either an unwritten rule (write
it) or a rule that should have been `drop` (reclassify it and add it to the
dropped table with a reason). No third option.

- [ ] **Step 6: Commit**

```bash
git add spec/hsdd-spec-v0_8.md docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md
git commit -m "spec(v0.8): chapter 17 (settled decisions, provenance, dropped), chapter 18 (glossary)"
```

---

## Task 13: README and users guide

**Files:**
- Modify: `README.md:121-197` (skill set, how it works, learn more)
- Modify: `docs/users-guide.md:1-49` (before you start), `:736-746` (adopting on a project already underway), `:747-783` (tips)
- Modify: `docs/users-guide.md` — insert a new "Example 3" section after `:565`, before "Running the project"

- [ ] **Step 1: Update the README skill table**

Add `hsdd-adopt` and `hsdd-intake` rows. Update the count from eight to ten in
the install comment (`README.md:104`) and anywhere else it appears.

- [ ] **Step 2: Collapse the README reading path**

Replace `README.md:173-196` ("Learn more", currently seven delta bullets) with a
pointer to `spec/hsdd-spec-v0_8.md` as the single current specification, plus
one line noting the deltas remain as history.

- [ ] **Step 3: Apply the claims rewrite to the README**

`README.md:82-88` currently states the isolation and token claims in their
overstated form. Replace with chapter 15's wording.

- [ ] **Step 4: Add the brownfield entry to "How it works"**

`README.md:134-159` describes one entry path. Add the adoption path as a peer,
matching chapter 5 / chapter 6's parallel framing.

- [ ] **Step 5: Add a users-guide brownfield walkthrough**

A third worked example after `docs/users-guide.md:565`, parallel to Examples 1
and 2: adopt an existing codebase, land the first change through intake, promote
one node. Same shape as the existing examples — commands, artifacts produced,
what the human does at each stop.

- [ ] **Step 6: Update the users guide's adoption section**

`docs/users-guide.md:736-746` currently covers adopting HSDD on a project
already underway. Extend it with the chapter 14 upgrade path and the grandfather
clause, and cross-reference the new walkthrough.

- [ ] **Step 7: Verify**

```bash
grep -n "eight HSDD skills\|eight skills" README.md docs/users-guide.md   # expect no output
grep -n "hsdd-adopt\|hsdd-intake" README.md docs/users-guide.md           # expect hits in both
grep -c "spec/hsdd-spec-v0_" README.md    # the delta list should be gone; expect 1-2
```

- [ ] **Step 8: Commit**

```bash
git add README.md docs/users-guide.md
git commit -m "docs: README and users guide for v0.8.0 — ten skills, one spec, brownfield walkthrough"
```

---

## Task 14: Acceptance pass

**Files:**
- Create: `review/hsdd-v0_8-acceptance.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the mechanical checks**

```bash
wc -l spec/hsdd-spec-v0_8.md                                  # expect 1600-2000
grep -cE "^## " spec/hsdd-spec-v0_8.md                        # expect 18
grep -nE "^# " spec/hsdd-spec-v0_8.md                         # expect exactly 1
grep -nE "read .{0,12}against v0\." spec/hsdd-spec-v0_8.md    # expect no output
grep -n "hsdd context\|hsdd lint\|hsdd status\|check-scope\|hsdd rename" spec/hsdd-spec-v0_8.md   # expect no output
grep -c '\[ \]' docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md    # expect 0
grep -c "field-tested\|pressure-tested\|reasoned-only" spec/hsdd-spec-v0_8.md   # expect >= 20
```

- [ ] **Step 2: Check each of the thirteen acceptance criteria**

Work through §11 of the design doc, criterion by criterion. For each, record in
`review/hsdd-v0_8-acceptance.md`: the criterion, PASS or FAIL, and the evidence
(a line reference, a command output, or a ledger row range). Criterion 1 is
checked by the reconciled ledger; criteria 6, 7, 9 by the greps above plus a
read of the relevant chapters.

- [ ] **Step 3: Fix any FAIL and re-check that criterion only**

Commit fixes separately from the acceptance record so the record's baseline SHA
is meaningful.

- [ ] **Step 4: Write the acceptance record**

Follow the shape of `review/hsdd-v0_7-acceptance-microsite.md`: baseline SHA,
method, criterion-by-criterion result, and an explicit statement of anything
that could not be verified.

- [ ] **Step 5: Update CHANGELOG.md**

A `## 0.8.0` entry: the consolidation, the two new chapters, the two new skills
named as forthcoming, the vNext salvage boundary, and the upgrade path for
≥0.6.1 projects.

- [ ] **Step 6: Commit**

```bash
git add review/hsdd-v0_8-acceptance.md CHANGELOG.md
git commit -m "review: v0.8.0 acceptance record; CHANGELOG for 0.8.0"
```

---

## Self-review notes

**Spec coverage.** Every section of design doc §§1–11 maps to a task: §3.1
scripting boundary → Task 5 step 1 and Task 11 step 2; §3.2 salvage → Tasks
3, 6, 7, 11; §4 outline → Task 2 step 1 and the chapter map; §5 → Task 5; §6 →
Tasks 8, 9; §7 → Task 10; §8 skill surface → out of scope by design, stated in
Global Constraints; §9 risks → mitigated by Task 1's ledger and Task 14's
checks; §10 non-goals → Task 11 step 2; §11 acceptance → Task 14.

**Known plan-level risk.** Task 1 is the longest task and the one with no
mechanical completeness check — a rule missed during extraction is invisible to
every later verification. Mitigate by extracting per-delta in separate steps
(as written) and by having Task 14 step 2 re-read the two deltas with the
densest rule content (v0.3 and v0.7) against the finished document rather than
against the ledger alone.

**Deliberate deviation from the skill's TDD shape.** There is no executable test
suite for a specification. The ledger is the harness: Task 1 writes it in a
failing state (every row unticked), each chapter task ticks its rows, and Task
12 step 5 fails the build if any row is still open.
