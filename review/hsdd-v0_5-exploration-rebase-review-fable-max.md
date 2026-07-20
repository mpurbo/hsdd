# Rebasing the v0_5 Exploration onto v0.6.1 — Conflict Review

**Reviewer:** Claude (Fable 5, max effort)
**Date:** 2026-07-15
**Subject:** the `v0_5` exploration branch — `review/hsdd-v0_4-review-fable.md`,
that branch's `spec/hsdd-spec-v0_5.md`, the implemented `cli/` package, the
`hsdd-review` and `hsdd-adopt` skills, the migrated five skills, and the
maintainer's guide — checked against everything released since the fork
point (v0.4.2, v0.5, v0.5.1, v0.6, v0.6.1), the current six skills, both
field/pressure reviews, the users guide, and the README.
**Output:** the rebased tentative spec, `spec/hsdd-spec-vnext.md`
(version undecided). This document records how the exploration fits and
conflicts with the released line, how each conflict was resolved, and what
new proposals fell out of the rebase itself.

---

## Verdict up front

The exploration and the released line solved **different problems and barely
collide**. The released 0.4.2→0.6.1 line hardened *planning*: parallel-safe
governance, field-tested templates, proportional ceremony, the execution
branch protocol, the decomposition axis, source provenance. The exploration
mechanized *everything deterministic* and built the missing back half of the
loop: the CLI, pull-based context, the review gate, learnings, derived state,
brownfield, multi-team. Nearly all of the exploration's fourteen proposals
**survive intact or strengthened**. Two specific rules inside them are
genuinely superseded by better field-tested designs (the worktree-per-phase
mandate, the unqualified leverage rule), and the machine-readable artifact
model survives with its mechanism inverted (bullet grammar instead of
frontmatter).

There are seven real conflicts, all resolved in the vNext spec (§3 below).
The deepest one is also the most productive: the exploration deletes
`produced_by`/`consumers` as write-only metadata, while 0.4.2 built the
`phase_ids`/`confirm`/reconcile choreography *around* that same metadata.
Deriving the data retires roughly a third of the reconcile protocol while
keeping everything in it that is genuinely judgment. That is the single
biggest simplification available to the project right now, and it only
became visible by holding both lines side by side.

One framing gift: v0.6.1's own thesis — *"rules that live only in prose fire
inconsistently"*, fix by *structural anchor* — is the exploration's thesis
one rung short of code. The rebased spec presents the whole delta as
completing that ladder: prose → structure → tool.

---

## 1. Two documents named v0.5 (disambiguation)

The branch's `spec/hsdd-spec-v0_5.md` (2026-07-03, "mechanization") and the
released `spec/hsdd-spec-v0_5.md` (2026-07-06, the `hsdd/` layout change) are
unrelated documents sharing a filename. The branch forked at `ca0203b`
(v0.4.1) and never saw 0.4.2 or anything after. Throughout this review:
"the exploration" = the branch's artifacts; version numbers = the released
line. The rebased spec is deliberately named `hsdd-spec-vnext.md` — no
number until one is decided — and states the disambiguation in its header.

Worth stating: the exploration is not a paper design. It is **implemented and
tested** — a zero-dependency CLI (ten pure-core modules, unit and e2e
suites), five migrated skills, two new skills, commands, a maintainer's
guide with an npm release procedure. The rebase is a bounded migration of
working code, not a greenfield build.

---

## 2. Scorecard: the exploration against 0.4.2–0.6.1

| # | Exploration proposal | What the released line did meanwhile | Status |
|---|----------------------|--------------------------------------|--------|
| E1 | Machine-readable artifacts: node frontmatter + normative phase block + conventions frontmatter | 0.6 made all field blocks bullet lists with quality gates; 0.6.1 rejected node frontmatter and required one file per child | **Conflict → inverted:** the bullet templates *become* the grammar (§3.1) |
| E2 | `hsdd` CLI: registry, context, lint, status, rename, check-scope | Nothing; both verbatim-copy rules still stand (generator since 0.4.1, verification template added by 0.6!) | **Open, strengthened** — 0.6 added a second copy-rule the CLI retires |
| E3 | Pull-based context, `/hsdd-new`, splice markers | 0.6 declared `config.yaml` ephemeral and added the self-heal warning — mitigation for push-based switching | **Open, meshes:** the CLI is the mechanism behind 0.6's mitigation (§3.4) |
| E4 | Contract validation wired into both gates; integration nodes | 0.4.2 added the canonical-artifact-path gate (adjacent, not wired); the 0.6.0 E2E test's fixtures-vs-MSW-mocks collision proved the gap | **Open, evidence stronger** |
| E5 | Learnings + dispositions; mid-phase renegotiation; boundary corrections | 0.4.2 added request/amend (planning-time); 0.6 added Outstanding + dispositions (verification-time); GMP-911 docs grew ad-hoc "Deviations" sections | **Open; rebased to coexist** (§3.7) |
| E6 | Derived state; `Phase:` link; `hsdd status` | Nothing equivalent; "where are we?" is still archaeology | **Open** |
| E7 | Claims rewrite; `Touches` + check-scope | README claims unchanged; 0.4.2 added prose isolation rules that later **held under pressure testing** | **Open, tone updated** (§3.6) |
| E8 | `hsdd-review` skill; PR-wired sign-off; leverage tier rule | 0.6 built the artifact half (template, Sign-off, Outstanding gate); the sitting still has no skill; leverage rule contradicted by field praise for a gate-only skeleton | **Open; leverage rule narrowed** (§3.5) |
| E9 | PE redefined in review-sitting terms | 0.6 added the sizing floor — the other half of proportionality; README/skills still say ~5h window | **Open; unified with floor+ceiling** |
| E10 | Ordering policy (FP → named policy) | Unchanged mandate in `hsdd-phase-plan`; field review praised FP ordering where it applied | **Open** |
| E11 | `hsdd-adopt` (brownfield) | Nothing; still greenfield-only | **Open; enriched by 0.6.1 sources** |
| E12 | Multi-team profile (`team`, acks, approvals) | 0.6/0.6.1 made "who builds what?" a mandatory stop — but the answer lands nowhere durable | **Open; now has a job the released line created** (§6) |
| E13 | Evidence program (metrics, case study) | Two real campaigns ran and published into `review/` — the program started itself | **Open; formalize what already happens** |
| E14 | Last delta; consolidate | 0.6 §9.8 listed consolidation as editorial, unshipped; the stack is now six deltas deep (v0.3+4+4.2+5+6+6.1) | **Open, more urgent** |

Superseded outright: the exploration's **worktree-per-phase mandate** (0.6 §4
shipped the finer instrument) and its **npm-name assumption** that phase
branches are named `hsdd/{phase-id}` (0.6's field convention uses
`integration/{node-id}` + phase-named branches; the spec drops the naming
claim).

---

## 3. The seven conflicts, and how the vNext spec resolves them

### 3.1 Node frontmatter vs "node specs have none" (E1 vs 0.6.1 §8)

The exploration put machine-read fields in YAML frontmatter and stripped the
duplicated bold body fields. Meanwhile 0.6 invested in making the *human*
format regular (bullet lists, quality gates, "none" not `[]`), and 0.6.1
explicitly rejected node frontmatter when placing Sources. Adding frontmatter
now would either duplicate every field (violating the exploration's own "a
field lives in exactly one place") or strip the bullet fields 0.6 just made
readable.

**Resolution: invert the mechanism, keep the property.** The 0.6.1 bullet
templates are regular enough to *be* the normative grammar — `- **Kind:**
leaf-parent` is as parseable as `kind: leaf-parent` and stays human-first.
The CLI parses the bullet blocks; unparseable blocks are lint errors naming
the template. Zero migration for 0.6.1-shaped projects, zero template churn,
and 0.6.1's decision is reaffirmed rather than reversed. The exploration's
phase-block grammar (written against the pre-0.6 `**Field:**`-line shape) is
re-targeted the same way, gaining `Collides with`, `node default` gate
resolution, and `Touches`.

### 3.2 Deriving `consumers` vs the `phase_ids`/`confirm` machinery (E6/E1 vs 0.4.2)

The deep one. The exploration deletes `produced_by`/`consumers` as rot-prone
duplication and derives them from `Produces`/`Consumes` declarations. 0.4.2,
not knowing that, kept the fields and built process to manage the
duplication: `phase_ids: provisional|final`, `confirm` entries, reconcile
draining, an hsdd-config warning. That machinery is field-tested and
pressure-tested — and it exists *only because the same fact is authored in
two places*.

**Resolution: derive, and retire the machinery the duplication required.**
`produced_by`, `consumers`, `phase_ids`, and the `confirm` entry kind go;
`request`/`amend`/`note`, the freeze, sibling isolation, and reconcile's
judgment role (collision arbitration, request resolution, the draft→stable
flip) stay untouched. "Provisional" collapses into `status: draft`, which
already means "not yet safe to build against." An `external_consumers`
frontmatter field covers 0.4.2's external-consumer edge case so no
information is lost. This is the delta's one breaking artifact change, with
a mechanical migration and lint warnings for the old shape.

Flagged alternative, if the appetite for a breaking change is low:
derive-and-check (keep the fields, lint verifies them against the
derivation). It fixes rot-*detection* but preserves the double bookkeeping
and the whole confirm choreography; the spec records why it was rejected.

### 3.3 Layout and parsing assumptions in the implemented CLI

Mechanical but pervasive: the CLI's defaults predate 0.5.0
(`docs/spec`, `contracts/`, `adr/`, `docs/STATUS.md`, `docs/renames.md`,
conventions at `docs/conventions.md`) and its verification parser reads the
pre-0.6 doc shape (`## Test evidence`, `## Human sign-off`) rather than the
0.6 template (`## Observed`, `## Outstanding` + dispositions, `## Sign-off`).
**Resolution:** rebase list in vNext §18 P0 — `hsdd/` defaults with the 0.5
pre-migration fallback, 0.6-template parsing, `hsdd/STATUS.md`,
`hsdd/renames.md`. The `approved` state now additionally requires Outstanding
*and* Learnings dispositions (the 0.6 gate condition, mechanized).

### 3.4 Worktree-per-phase "required" vs the 0.6 execution protocol (E3 §4.2 vs 0.6 §4)

The exploration, seeing the config.yaml race, mandated one worktree per
active phase. The field test then produced a better instrument: `Collides
with` serialization, one integration branch per node, plans on one lineage,
reconcile once at the root — parallelism granted exactly where contention is
absent, not everywhere. **Resolution: 0.6 governs; the exploration's blanket
rule is superseded.** The CLI serves the protocol instead: deterministic
regeneration is what makes 0.6's "take either side and re-run" costless (the
pressure test observed this property from the prose side), and `hsdd context`
gains a warning when a colliding phase has an in-flight change — 0.6's
serialization rule, checked at the moment it matters.

### 3.5 The tier leverage rule vs field evidence (E8 §9.3 vs the GMP-911 review)

The exploration: any phase whose outputs feed 2+ later phases gets
spot-check minimum — aimed at gate-only "types + contracts" first phases.
The GMP-911 process review then explicitly praised a gate-only skeleton
phase as "exactly the right risk allocation." Direct contradiction if read
broadly. **Resolution: narrow to the object, not the phase.** What deserves
eyes is a *produced contract or shared type surface* (highest fan-out, all
signal, cheap to read); pure scaffolding with no consumed outputs stays
gate-only. The spot-check reads the surface, not the whole diff. Both
sources of evidence are honored.

### 3.6 The claims rewrite vs the pressure-test results (E7 vs the 0.6.0 campaign)

The exploration's rewrite treated prose isolation as unenforced and
overstated. Since then, the prose defenses were adversarially tested and
held (sibling-peek baits refused, freeze intact under authority+deadline
pressure). Rewriting the claims as if prose were worthless would now itself
be dishonest. **Resolution: keep the rewrite, change its ground.** The
claims become precise rather than penitent: attention-shaping plus *tested
but probabilistic* prose defenses, with `Touches` + `check-scope` as the
deterministic option where hiding must be certain. The token-cost rewrite
stands unchanged (it was always just true).

### 3.7 `Learnings` vs `Outstanding` (E5 vs 0.6 §5)

Overlapping-looking sections with different jobs, and the field already
demonstrated the difference: GMP-911's docs had both "Outstanding (requires
a real browser)" *and* an ad-hoc "Deviations" section recording a product
decision (the font-weight registration) that belonged upstream.
**Resolution: two sections, one gate.** Outstanding = claims about *this
phase* that could not be verified here (0.6, unchanged). Learnings = what
flows *upward* to the tree, each with exactly one disposition, executed at
the root by the owning skill; contract-shaped learnings reuse the 0.4.2
`request`/`amend` vocabulary so the project has one grammar for upward
messages, not two. Sign-off requires both sections dispositioned. The
mid-phase renegotiation procedure is re-threaded through 0.6's branch
discipline (renegotiate at the root lineage, propagate, re-derive, resume).

---

## 4. What the released line built that the exploration lacked

Worth naming, because the rebase keeps all of it verbatim:

1. **Parallel planning safety.** The exploration had no answer to two
   planners racing on shared governance; it solved execution-stage
   parallelism and stopped there. 0.4.2's freeze + effects-as-data +
   single-writer reconcile is the missing half, and it survives vNext with
   only the `confirm` kind removed (§3.2).
2. **Human-legible plans.** Bullet templates, the summary table, Mermaid
   everywhere, "none" — none of it in the exploration, all of it now the
   foundation the grammar stands on.
3. **Proportional ceremony.** The floor, the merge smell, tier-scaled
   artifacts. The exploration scaled *review attention* by tier but never
   noticed every phase paid identical artifact cost — the field data
   (3:1 process-to-product on the smallest phase) found what the
   competitor-review missed.
4. **The ownership axis and its stop.** Nothing in the exploration
   constrains decomposition by team structure; it took a second project's
   mis-slicing to surface it.
5. **Source provenance.** The exploration's context function reads node
   specs, contracts, ADRs — it would have re-flattened PRD/RFC details
   exactly the way 0.6.1 diagnosed. Sources trickle-down slots cleanly into
   the grammar and gets lint backing in vNext.

The general pattern: the exploration optimized what a tool can see; the
field tests caught what only humans hit (rendering, ceremony cost, team
shape, provenance). Neither review process would have found the other's
findings. That is an argument for keeping both loops running.

---

## 5. What the exploration still uniquely contributes

The whole back half of the lifecycle, still missing from main today:

- Every mechanical guarantee is still prose (two verbatim-copy rules now,
  not one — 0.6 added the verification-template copy while the exploration
  branch was already shipping the fix for that class).
- The phase switch is still push-based and hand-assembled; 0.6 §4.1
  documents how to mop up after it rather than replacing it.
- The review gate — the methodology's centerpiece — still has no skill;
  sign-off is still a line an agent could type.
- Nothing answers "where are we?" (no status projection).
- Nothing brings an existing codebase in (the biggest adoption flank in the
  category, per the original competitor review — still open in 2026).
- Contract `## Validation` is still decorative; fixtures are still not what
  consumers mock against.
- The README still makes the two claims both reviews agreed to soften.
- The spec reading path is six documents deep and the users guide's first
  link still says v0.3 is "the methodology spec."

---

## 6. New proposals born from the rebase (not in either parent)

1. **The bullet grammar as the normative grammar** (§3.1's resolution) — the
   human format *is* the machine format; no artifact gains a second
   representation.
2. **`confirm`/`phase_ids` retirement via derivation** (§3.2) — the reconcile
   protocol keeps its judgment and loses its bookkeeping.
3. **Lint checks for the 0.6/0.6.1 structural anchors:** summary table
   opens-and-matches, `Collides with` symmetry, one-file-per-child, sources
   mapping, bullet/"none" format. 0.6.1 invented the anchors; vNext makes
   them verifiable. (The pressure test's "minor format nits" — bare phase
   numbers, prose before the table — are exactly what these catch for free.)
4. **Context-time execution guards:** the 0.4.2 contingent-phase stop, the
   0.6 next-runnable warning, an undrained-pending-section warning, and a
   new *colliding-phase-in-flight* warning — all derived mechanically at the
   moment `/hsdd-new` runs, which is when they can still change a decision.
5. **`Team` as the landing spot for "who builds what?"** — 0.6.1 mandates
   asking; nothing records the answer. The multi-team profile's field turns
   the mandatory stop's output into a durable, lint-checkable fact.
6. **Integration-node ownership under the axis rule** — a node that
   exercises two teams' outputs still has exactly one owning team; consuming
   contracts is not co-ownership. Closes a gap the axis rule and the
   integration-node idea open jointly.
7. **`Touches`∩ ⇒ missing `Collides with` lint** — the plan declares scopes;
   the tool derives the contention the plan forgot to mark. Opt-in by
   construction (fires only when both phases declare Touches).
8. **`hsdd template`** — retires the *second* verbatim-copy rule (0.6's
   verification template) the same way the CLI retires the first; both
   templates ship versioned in the npm package.
9. **`hsdd status` reads pending sections** — "planned, awaiting reconcile"
   becomes a visible state instead of a surprise at `/hsdd-phase` time.
10. **Metrics gains a product/process ratio line** — the number the GMP-911
    review had to compute by hand to find the ceremony problem becomes a
    free column in the evidence record.
11. **Adoption × sources** — as-built nodes point their `Sources` at code
    paths, READMEs, dashboards; 0.6.1's provenance rule turns out to be the
    natural honesty mechanism for brownfield specs too.

---

## 7. Open questions for the human

1. **Version number.** The delta is additive except the contract-frontmatter
   change (§3.2). Options: **0.7.0** (pre-1.0 minor plays the major role,
   matching the maintainer-guide convention from the exploration) or fold
   into a **1.0** whose release criteria (consolidation + case study) it
   already states. Recommendation: 0.7.0 now, 1.0 when §14.2's case study
   exists. The file is named `vnext` until decided; rename is one `git mv`.
2. **Appetite for the breaking change.** If deleting
   `produced_by`/`consumers`/`phase_ids` feels too hot, the derive-and-check
   fallback (§3.2) is a one-paragraph amendment to the spec — but it keeps
   the confirm choreography alive indefinitely.
3. **npm commitment.** The CLI retires the copy rules only if it is actually
   installable; publishing `hsdd` to npm (name availability, 2FA, the
   maintainer-guide procedure) becomes a release blocker for the skills that
   reference `npx hsdd`.
4. **Where fixtures live.** vNext defaults to `hsdd/contract/schema|fixture/`
   with the contract frontmatter authoritative; if you prefer
   fixtures-next-to-tests as the default (the GMP-911 instinct), flip the
   default and keep the frontmatter rule — nothing else moves.
5. **Consolidation timing.** vNext declares itself the last delta. If P3
   (§18) feels too big to gate the release on, split it out — but the
   six-deep reading path is already the users guide's worst usability bug,
   and it gets worse with every delta including this one.
6. **The `v0_5` branch's fate.** After the CLI code is ported onto a fresh
   branch from main (per §18 P0), archive the exploration branch (tag it
   `exploration/v0_5-mechanization`, delete the head) so the two v0.5 specs
   stop coexisting in checkouts.

---

## 8. Recommendation

Adopt the rebased spec as the next working delta. Sequence exactly as its
§18 orders: the CLI rebase first (it is the enabling mechanism for a third
of the other sections and the code already exists), skills second, the gate
and adoption third, consolidation as the release gate. Re-run the
pressure-test loop on every edited skill before shipping — the 0.6.0
campaign set that precedent and the 0.6.1 addendum proved the loop catches
what field use alone does not.

The original competitor review said the race was items 1 and 2: dogfood and
mechanize. Twelve days later, half of item 1 exists (two published field
campaigns) and item 2 exists as unmerged code on a forgotten branch. The
rebase is small; most of the work was already done — twice.
