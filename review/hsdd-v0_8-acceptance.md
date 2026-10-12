# v0.8.0 acceptance — the consolidated specification

**Gate:** the thirteen acceptance criteria recorded in
`docs/superpowers/specs/2026-07-29-v0_8-consolidation-brownfield-design.md`
§11, written before the run per the practice established at v0.7 §7.3.

**Subject:** `spec/hsdd-spec-v0_8.md` (2,308 lines), plus `README.md` and
`docs/users-guide.md`.

**Baseline:** `feat/v0.8.0` at `36e6ee8`, branched from `main` at `3fe5518`
(v0.7.1 merged).

**Method:** the rule ledger
(`docs/superpowers/plans/2026-07-29-v0_8-rule-ledger.md`, 567 rows) is the
harness — Task 1 wrote it in a failing state, each chapter task ticked its
rows, and Task 12 reconciled it to zero open rows. Mechanical checks are the
greps recorded in the plan's Task 14 step 1. Criteria needing judgment were
checked by reading the chapters named.

**Status: PASS on all thirteen criteria, with two recorded deviations**
(document length, and the CLI grep's expected hits) — both stated below
rather than argued away.

---

## Mechanical checks

| Check | Expected | Observed | Result |
|---|---|---|---|
| `wc -l spec/hsdd-spec-v0_8.md` | 1600–2000 | **2308** | over — see Deviation 1 |
| numbered `##` chapters | 18 | 18 | PASS |
| H1 count, fence-aware | 1 | 1 | PASS |
| `read … against v0.` | no output | none | PASS |
| CLI command names | no output | 3 hits | expected — see Deviation 2 |
| unticked ledger rows | 0 | 0 | PASS |
| provenance vocabulary occurrences | ≥ 20 | 67 | PASS |

### Deviation 1 — length

The document is 2,308 lines against a 1,600–2,000 target, 15% over. The
design's own density rule is the right test, and it passes: excluding the 15
fenced blocks (311 lines of templates and worked examples, which cannot be
compressed) leaves 1,967 non-fenced lines carrying 545 written rules — **3.61
lines per rule against the ~4.8 sustainable rate.** The overage is rule
count, not verbosity: the design estimated the seven-delta corpus before
v0.7.1 merged and before the design-doc-only rules (517–567) were extracted,
which together added 77 rows. Thinning further would cost rules, and the
Global Constraint is explicit that a rule is never dropped to hit a line
count.

### Deviation 2 — the CLI grep

`grep -n "hsdd context\|hsdd lint\|hsdd status\|check-scope\|hsdd rename"`
returns three hits, all in §15.3 (non-goals) and §17.2 (deliberately
dropped) — the tables whose job is to name the excluded commands. The check
exists to catch the CLI being *specified*; naming it as excluded is the
opposite. Per the plan's own instruction not to narrow a check to make it
pass, the check is left as written and the hits are recorded here as
expected.

---

## The thirteen criteria

**1. Traceability — PASS.** Every normative rule in v0.3, v0.4, v0.4.2, v0.5,
v0.6, v0.6.1, v0.7, and v0.7.1 has a ledger row, and every row is ticked
(0 open). The section-citation sweep confirms every `##`/`###` section of all
eight deltas is cited by at least one row. The 12 `drop` rows all appear in
§17.2's deliberately-dropped table with their reasons; the 10 `scaffold` rows
are delta framing carrying no rule and are excluded from that table by design.

**2. Salvage fidelity — PASS.** Every row of design §3.2's *absorbed* table
appears in the document: executable validation for `stable` (§3.4), both gates
running the contract (§3.4, §10.2), integration nodes (§3.7), the Learnings
loop with its four dispositions (§10.3), mid-phase renegotiation and boundary
corrections (§10.4), the claims rewrite (§15.1), the unified PE (§7.2),
ordering policy (§7.4), brownfield adoption (chapter 6), the `Team` field
(§2.1, §13.5), and the Metrics block (§10.5). No row of the *dropped* table
appears as a live rule: the normative grammar, the CLI, pull-based context,
derived state, `Touches`, `hsdd-review`, and cross-team acks occur only inside
§15.3 and §17.2.

**3. No delta framing — PASS.** No "read this against v0.x" anywhere. The word
"delta" appears eight times: the header's statement that this document
replaces the series, three uses of OpenSpec's own "spec deltas" artifact term,
one "delta since the superseded plan" in the execution-plan shape, and three
in chapters 14/17 where the history is the subject.

**4. Peer entry points — PASS.** Chapters 5 and 6 open with structurally
parallel paragraphs (precondition, input, work, exit), state the same exit
verbatim — *"a tree whose leaf-parents are ready for phase planning — chapter
7"* — each names the other as its structural peer, and both close with the
identical handoff sentence, *"chapter 7 governs every phase from here on."*

**5. The PRD rule is stated as a rule — PASS.** §11.1 states it as a
blockquote (*"A PRD is never a root. There is one tree, and it is the
system's."*) with the failure it prevents named directly beneath under **The
failure this prevents** — the wipe-and-rebuild cycle whose adoption cost
amortizes over nothing.

**6. `@v0` consistency — PASS.** The id-scheme table (§2.4) states versions
are `v{n}` with `n >= 0` and names `@v0` admissible; §3.5 and §6.3 both
describe `v0` as a permanent property with `v0 → v1` as the contract-level
adoption exit; §17.1 and the glossary repeat it without contradiction. No text
anywhere assumes versions start at 1. The compatibility table (§3.5) states
that extension under `additive-only` never exits `v0`, which is consistent
with, not contrary to, permanence.

**7. Scripting boundary — PASS.** The boundary is normative in chapter 6,
stated as a blockquote: *"A script may ship bundled with a new skill. No
script may change how an existing skill behaves."* The drift check is gated
in both places it appears: chapter 6 (*"that path executes only when the tree
contains adopted nodes"*) and §12.7's evidence pass (*"only when the tree
contains adopted nodes — the gate that keeps this path from touching
greenfield behavior"*).

**8. Upgrade chapter — PASS.** §14.1 carries the eleven-row compatibility
table (the design's ten rows plus one for v0.7.1's execution-plan additions),
states the adoption-run vehicle, and says conformance applies from the next
document forward. The mixed-tree end state and the ≥0.6.1 floor are both
stated, and this is the only chapter referencing the deltas as a reading path.

**9. Grandfather clause end state — PASS.** §14.2 states all three closure
properties (set closed at upgrade with `validation: grandfathered`; discharge
on touch, not on a date; count reported and monotonically falling, with a
rising count as a finding) and names both rejected alternatives — the fixed
sunset date and permanent unmarked grandfathering — with their reasons.

**10. Provenance column — PASS.** §17.1's table carries a required Provenance
column populated on all 62 rows, with the vocabulary restricted to
`field-tested`, `pressure-tested`, and `reasoned-only`. The preamble states
why the column exists: new material must not inherit credibility from tested
material. Everything chapters 6, 11, and 14 contribute is marked
`reasoned-only`.

**11. Both former OQs settled — PASS.** OQ-1 (post-launch milestones) appears
in §17.1 as *"Per-campaign documents, sealed when green, archived,"* resolved
in §12.5. OQ-2 (adopted contracts and compatibility) appears as *"A declared
per-version `compatibility:` policy, fixture-enforced,"* resolved in §3.5.
Neither survives as an open question anywhere in the document.

**12. README and users guide — PASS.** The README's reading path collapses to
`spec/hsdd-spec-v0_8.md` as the single current specification with one line
noting the deltas remain as history; the skill table gains `hsdd-adopt` and
`hsdd-intake` (ten skills, and the install comment says ten); the claims
rewrite replaces the previously overstated isolation and token bullets; and
"How it works" now opens with the two entry points as peers. The users guide
retargets its header to the v0.8 spec, extends the one-line loop with adopt
and intake, gains a third worked example (adopt → intake → promote on a
brownfield system), and extends "Adopting on a project already underway" with
the upgrade path and the grandfather clause. No stale delta links remain in
either file.

**13. Skills follow the spec — PASS.** `git diff origin/main...HEAD --
skills/ commands/` is empty. No skill file was edited; the skill work is a
separate cycle after this specification is approved.

---

## What this acceptance does not establish

The criteria test the *document*, not the *method*. Chapters 6, 11, and 14 are
`reasoned-only`: no project has yet been adopted with `hsdd-adopt`, no change
has been routed with `hsdd-intake`, and no grandfathered contract has
discharged on touch — those skills do not exist yet. The provenance column
exists precisely so that this gap is visible in the document rather than
inferred from its confidence. The first real test is the skill cycle that
follows, and after it, a brownfield project run end to end.
