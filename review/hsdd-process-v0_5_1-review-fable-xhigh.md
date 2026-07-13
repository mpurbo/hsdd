# HSDD Process Review — v0.5.1, field-tested on GMP-911

**Reviewer:** Claude (Fable 5, xhigh effort)
**Date:** 2026-07-12
**Subject:** the six HSDD skills at v0.5.1, the spec chain (v0.3 + v0.4 + v0.4.2
+ v0.5 deltas), and the user's guide — as exercised end-to-end on
`gopay-merchant-react` (MIGPA progressive loading screen, ticket GMP-911).
**Requested scope:** honest assessment plus improvements suitable for a minor
version bump; no breaking changes.

---

## Verdict

The methodology core is sound, and the field evidence proves it in the place
that matters most: **the isolation actually worked.** The shell node was built
and tested against synthetic contract events with zero React code present; the
reporter node ran in parallel against the same contract; the contract file is
byte-identical across both lineages; a parity test is scheduled at the seam
(shell.7). The governance freeze held — no worktree touched `hsdd/contract/`
or `hsdd/adr/`. And the verification docs are genuinely better than what most
human teams produce (see "What's working" below).

Both of the issues you raised are real, and they share a root: **the process
has excellent controls against phases being too big, and no controls at all
against ceremony being too big for the phase.** The user's guide states the
right principle — *"depth and ceremony are costs. Use exactly as many levels
and artifacts as the system needs, and no more"* (users-guide.md:36) — but
`hsdd-phase-plan` and `hsdd-config` currently cannot act on the second half of
that sentence. Every phase, however small, pays the identical fixed cost: a
full OpenSpec artifact set, a full verification doc, a context switch, a
review, an archive.

There is also a third finding you didn't ask about but will feel soon: the
v0.4.2 freeze protocol made *planning* conflict-free, but nothing equivalent
exists for *execution*. Your worktrees already contain the evidence
(config.yaml rewritten differently on every branch, the shell plan and a
reconcile committed independently on both lineages, four worktrees all editing
`index.html` in parallel against the plan's own advice).

All three findings are fixable with guidance and template changes — nothing
breaking. Recommended target: **v0.6.0** (additive, backward compatible).

---

## Evidence base

- Skills repo `~/git/hsdd` at v0.5.1 (`f84b0d7`): all six SKILL.md files,
  commands, templates, spec chain, users guide, changelog.
- Testbed `~/git/gopay-merchant-react`: root branch `GMP-911`, two node
  lineages (`GMP-911-shell`, `GMP-911-reporter`), nine phase worktrees.
- Feature shape: 1 root node, 2 leaf-parent nodes, **14 planned phases**
  (shell.1–7, reporter.1–7), 1 contract (`loading-progress-events@v1`),
  2 ADRs. Executed at review time: reporter.1–2, shell.1–3, shell.5–6
  archived; reporter.3–6 in progress in parallel worktrees.
- Artifacts inspected in depth: `hsdd/spec/migpa-loading.shell.md` (the file
  you flagged), the shell.6 change end-to-end (product diff vs process
  artifacts), `hsdd/verify/migpa-loading.shell.6.verification.md`, the
  config.yaml diffs between lineages and phase branches.

---

## What's working (keep this, and know why)

Worth stating explicitly, because the recommendations below trim ceremony and
you should be confident about what *not* to trim.

1. **Contract-first isolation delivered.** `loading-progress-events@v1` is
   identical on both lineages; shell and reporter were developed with no
   knowledge of each other's internals; shell.7 carries the parity test that
   proves the inline literals match the canonical `contract.ts`. This is the
   methodology's central bet, and it paid off on a real codebase.

2. **Spec quality is high.** The shell node spec's acceptance criteria are
   precise and consequence-aware (AC-4.3 reasons through why fast loads show
   only tagline variant (a); AC-6.2 specifies the app-version gate down to the
   line range it reuses). The Risks section flagged WebView `CustomEvent`/
   `min()` quirks and the plan scheduled that check into shell.1's
   verification. Most human-written specs don't do this.

3. **Verification docs are the standout artifact.** The shell.6 doc reports
   what was verified *and what could not be verified in that environment*
   ("Outstanding (requires a real browser, before phase sign-off)"), and its
   Deviations section captures a real product decision — no true Bold font
   asset exists, so semibold is registered as `font-weight: 700` to prevent
   faux-bold synthesis, flagged to the design owner. In a normal AI coding
   session that knowledge evaporates. Here it's durable and reviewable.

4. **The v0.5.1 fix landed.** Worktrees contain verification docs only for
   executed phases — planning no longer fabricates them.

5. **FP phase ordering is correct where it matters.** shell.1 (skeleton) →
   shell.3 (pure core) → shell.4 (effects) → shell.7 (composition) is
   textbook, and the pure core carrying `full-review` while the skeleton is
   `gate-only` is exactly the right risk allocation.

---

## Finding 1 — Phase sections render as a single collapsed paragraph

*(your issue #1)*

### Root cause

The phase template (hsdd-phase-plan SKILL.md:119–132) and the node header
template (hsdd-spec SKILL.md:116–128) emit consecutive `**Field:** value`
lines with no blank line between them:

```markdown
**Consumes:** [loading-progress-events@v1]  (event-name literals, ...)
**Produces:** []
**Governed by:** [ADR-001, ADR-002]
**Scope:** Replace the `#gma-loader` block (markup + its CSS) ...
```

CommonMark/GFM treats a single newline inside a paragraph as a soft break, so
GitHub, VS Code preview, and every standards-compliant renderer collapse the
whole block — nine fields including a 20-line Scope — into one run-on
paragraph. The 2-space continuation indent used for wrapped values makes it
worse: those lines are lazy paragraph continuations, so even the visual
grouping in the source is lost when rendered. The same defect exists in the
node header (the `**Kind:** … **Isolation strategy:** …` block at the top of
every node spec) and in the users guide's own examples (users-guide.md:201–210).

### Recommendation: bullets for the fields, plus one summary table per plan

**(a) Convert every field block to a bullet list.** Minimal change, renders
correctly everywhere, and the existing 2-space continuation convention
survives unchanged (wrapped lines become list-item continuations):

```markdown
- **Consumes:** [loading-progress-events@v1] — event-name literals,
  duplicated inline per ADR-001
- **Produces:** none
- **Governed by:** [ADR-001, ADR-002]
- **Scope:** Replace the `#gma-loader` block (markup + its CSS) with the new
  shell skeleton under a fresh root id `#migpa-loading-shell` ...
- **Size estimate:** ~6 files (~400 lines), <= 7 OpenSpec tasks
- **Gate:** `pnpm --filter @gma-apps/migpa test && pnpm --filter @gma-apps/migpa build`
- **Verification:** open the harness page against statically served
  `index.html` ...
- **Review tier:** gate-only
- **Dependencies:** none (first phase)
```

**(b) Add a phase-overview table at the top of the Phase Plan section** — one
row per phase, for the human scanning the plan as a whole:

```markdown
| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| shell.1 | Skeleton, constants, test rig | gate-only | ~400 loc, ≤7 tasks | — |
| shell.2 | Visual composition | spot-check | ~250 loc, ≤6 tasks | 1 |
| shell.3 | Pure core: progress + taglines | full-review | ~450 loc, ≤8 tasks | 1 |
| ... | | | | |
```

This is the compromise you were looking for: the **table is the human index**
(scannable, comparable, renders beautifully), the **bullet sections remain the
machine-consumed detail** — `hsdd-config` keeps injecting only the detailed
phase section into config.yaml, so token cost is unchanged and the table never
enters an agent's context. Add one quality-gate item to hsdd-phase-plan
("summary table matches the phase sections"), same as the existing rule that
the Mermaid DAG must match the dependency table.

### Why not tables for everything

You suggested tables might be best; for the *whole* phase record they are the
wrong tool: Scope and Verification are multi-sentence prose, and markdown
table cells force them onto one physical line — unreadable and undiffable in
source, painful for agents to edit reliably, and any future field addition
reflows every row. Bullets keep source and render both readable and keep
diffs line-scoped. (Hard line breaks — trailing double-space or `\` — were
also considered and rejected: invisible in source, silently stripped by
editors and formatters.)

### Where to change

- `skills/hsdd-phase-plan/SKILL.md`: phase template, plus the summary-table
  requirement and its checklist item.
- `skills/hsdd-spec/SKILL.md`: node header template (same collapse defect).
- `docs/users-guide.md`: the inline examples (they teach the old format).
- Add a one-line rendering rule to both skills' quality gates, so this class
  of bug can't recur: *"Field blocks must be bullet lists or tables; never
  rely on soft line breaks for structure."*

Backward compatible: skills read old-format specs fine (they parse content,
not layout); only newly emitted files change shape.

### Related nit

Generated node specs duplicate their title: `migpa-loading.shell.md` opens
with an H1 and then repeats the same title as the template's `###` heading
(lines 1 and 3). The templates start at `###` because they're designed for
embedding; specify the heading levels for a standalone file (H1 title, H2
sections, drop the duplicate) in the same template pass.

---

## Finding 2 — Phase granularity: your instinct is right, and so is the skill

*(your issue #2)*

### The data

shell.6 ("defer container script, font strategy"), measured across the full
branch diff (`GMP-911-shell...GMP-911-shell-6`):

| Kind | Artifact | Lines |
|------|----------|------:|
| Product | `apps/migpa/index.html` | +30 |
| Product | 2 font binaries | (bin) |
| Product | `critical-path.test.ts` | 130 |
| Process | `proposal.md` | 55 |
| Process | `design.md` | 157 |
| Process | change `specs/` delta | 60 |
| Process | `tasks.md` | 20 |
| Process | `openspec/specs/` copy (archive) | 67 |
| Process | verification doc | 136 |
| Process | `openspec/config.yaml` rewrite | −70/+108 |

**≈160 lines of product change; ≈495 lines of process artifacts — a 3:1
process-to-product ratio.** Across the feature: 14 phases × ~420–600 artifact
lines ≈ 7,000 lines of process output for a loading screen. Several reporter
phases are estimated at ~110–180 product lines each and pay the same toll.

### The honest assessment

The skill is right that isolation must be designed and that small phases
enable focused review — shell.1/3/4/7 each earn their cycle (the pure core
alone justifies its own full-review phase). But the skill is currently
**structurally incapable of agreeing with you** when you're right that two
phases should merge. Sizing has a ceiling with three enforcement mechanisms
(the ~5h window rule, the ≤8-task rule, an anti-rationalization row for "this
phase is a bit big") and **no floor at all** — worse, the anti-rationalization
table preemptively brands every merge impulse as rationalization ("These two
phases are too small, combine them" → "Small phases are a feature"). When a
methodology can't express "you're right, merge them," the human either
overrides it (and learns to distrust the tables) or eats the overhead (and
learns to distrust the method). A one-sided control contradicts the guide's
own "ceremony is a cost" principle.

The tell in this very project: the plan itself concluded that phases 2/3/5/6
"collide textually" in `index.html` and that "parallel worktrees are possible
but buy little here" (migpa-loading.shell.md:156–160). When parallelism — the
strongest justification for fine granularity — is void, the case for seven
phases is mostly gone, yet the skill still produced seven, because nothing in
it is allowed to weigh that.

Concretely, with a floor rule this plan plausibly lands at:

- **shell:** 1+2 (skeleton + visuals, adjacent render-only work), 3, 4, 5+6
  (both independent head-of-file platform concerns, both full-review), 7 —
  **5 phases instead of 7**.
- **reporter:** 1, 2, 3+4 (both spot-check milestone emits), 5+6 (both
  full-review terminal semantics), 7 — **5 phases instead of 7**.

Ten cycles instead of fourteen, with no isolation lost where isolation was
doing work (the pure core, the effects layer, and the integrations all keep
their own cycles and their full-review tiers).

### Recommendation A: add a sizing floor and merge heuristic (hsdd-phase-plan)

Add alongside "Sizing to the Review Window":

> **Sizing floor.** A phase must be big enough to earn its cycle. Two adjacent
> phases are merge candidates when all hold: (i) same review tier, (ii) same
> consumed contracts, (iii) no third phase depends on one without the other,
> (iv) the merged phase still fits the review window with ≤8 tasks. Textual
> contention strengthens the case: phases that would serialize anyway (same
> file, same owner) have a lower bar to merge. Keep a small phase separate
> only for a reason you can name: a tier boundary, a parallel lane assigned to
> another owner, or a risk you want reviewed in isolation.

A useful smell to include: *if a phase's predicted process artifacts exceed
its predicted diff, it is a merge candidate by default.*

And rebalance the anti-rationalization table — replace the current
merge-forbidding row with two rows that distinguish motive:

| Thought | Reality |
|---------|---------|
| "Merge them so there's less to review" | Merging to dodge review defeats the tiers. Merge only under the sizing floor's conditions. |
| "Small phases are always a feature" | Small phases are a feature when they buy parallelism or isolated review. A phase below the floor buys neither and still costs a full cycle. |

### Recommendation B: let the review tier scale the artifacts, not just the review

Today the tier only modulates human attention (users-guide.md:153–156:
"every phase still runs the full OpenSpec cycle and still produces a
verification doc"). Extend it to modulate ceremony — this attacks your "whole
artifacts (a lot!) for one small index.html edit" complaint directly without
touching phase boundaries at all:

| Tier | proposal | design.md | verification doc |
|------|----------|-----------|------------------|
| gate-only | brief | **skip** (OpenSpec already treats design as optional for simple changes) | gate transcript + 3–5 line checklist |
| spot-check | brief | skip unless a real decision exists | short: commands, expected output, what to eyeball |
| full-review | full | full | full (current shape) |

Implementation is a `hsdd-config` rules change (the tier is already injected
into every phase context, so the rules can condition on it) plus a paragraph
in hsdd-phase-plan's tier table. Evidence this is safe: shell.1 is gate-only
and its 133-line design.md decided nothing the proposal and spec didn't
already state; shell.6's 157-line design.md, by contrast, earned its keep
(the D3a/D3b font decisions the verification doc later leaned on) — and
shell.6 is full-review, so it keeps the full set. The tier already encodes
exactly the signal needed.

Neither A nor B breaks the core invariant (one phase = one OpenSpec change =
one review gate), so both fit a minor bump.

---

## Finding 3 — Planning is conflict-free by construction; execution is not

The v0.4.2 governance freeze solved parallel *planning* elegantly. The same
worktree pattern applied to *execution* has three unguarded seams, all
already visible in your repo:

**(a) `openspec/config.yaml` is a guaranteed merge conflict.** Every phase
context switch rewrites the `## Current Phase` block wholesale (shell ↔
shell-6 diff: −70/+108 lines), and every phase branch commits it. Any two
execution branches conflict on it; so do the two node lineages
(`hsdd: config shell.1` vs `hsdd: config reporter.2`). The conflict is
meaningless — the block is per-session working state — but nothing tells the
person merging that. Fix (documentation-level, minor): declare the phase
block **ephemeral** in hsdd-config and the users guide: *on merge, resolve
config.yaml by taking either side, then re-run `/hsdd-phase {next}` before
the next cycle*; optionally suggest `openspec/config.yaml merge=ours` in
`.gitattributes` on the integration branch. `/hsdd-phase` could also
self-heal: warn when the Current Phase block doesn't match a phase that is
next-runnable per the plan.

**(b) The same node was planned — and reconciled — on two diverged lineages.**
`GMP-911-reporter` carries `c79796e5 hsdd: phase plan migpa-loading.shell` +
`5fc46209 hsdd: reconcile`; `GMP-911-shell` carries its own pair (`8513a4fe`,
`bc4f9f08`) with near-identical content (the shell copy has 8 extra lines —
the harness-serving note). At final integration that's an add/add conflict on
`hsdd/spec/migpa-loading.shell.md` and an ambiguity about which reconcile is
authoritative. The skills got the *content* right (the contract is
byte-identical on both sides — the freeze worked), but the *choreography*
went wrong, and nothing in the guide flags it. Fix: an execution-stage
mirror of Example 2's planning walkthrough, stating the branch discipline
explicitly — *phase branches merge into their node's integration branch;
node branches merge into the root; reconcile runs once, at the root, after
node plans merge, and its commit lives only there; a node's plan file is
written on exactly one lineage.*

**(c) Parallel execution of textually-colliding phases has no guard.** The
plan's execution note warned that shell 2/3/5/6 all edit `index.html`, yet
worktrees shell-2/-3/-5/-6 each ran one of them in parallel — four branches
all but guaranteed to conflict on `index.html` at merge, on top of (a). The
warning existed but lived as prose in the plan file, invisible at the moment
worktrees get spawned. Fix: make contention structured — an optional
**Collides with:** field per phase (emitted only when the plan knows phases
share files), checked by `/hsdd-phase` or simply listed in the summary table
from Finding 1 so the human sees it when deciding what to parallelize.

**(d) (Observation, lower priority.) Per-phase capability naming fragments
OpenSpec's living specs.** Each shell phase created its own capability
(`loading-shell-skeleton`, `loading-shell-visuals`,
`loading-shell-critical-path`), so `openspec/specs/` accumulates phase-shaped
specs no future change will ever update. The flip side: per-phase capabilities
are what made the parallel archives conflict-free. This is a genuine
trade-off; hsdd-config should state it and give a default (e.g. name
capabilities per stable feature area within the node, accepting that archives
then serialize — which, per (c), they mostly must anyway).

---

## Minor findings

1. **The config.yaml tasks rule is a run-on doing three jobs**
   (hsdd-config SKILL.md:110: gate task + verification-doc task + governance
   prohibition in one quoted string). Split into three rules; long compound
   rules are the ones agents half-apply.
2. **No owner or template for the verification doc.** Its required content
   lives inside that one rule string. The shell.6 doc turned out excellent,
   but its "Outstanding" items have no tracked disposition — nothing requires
   the reviewer to accept/waive them at sign-off. A small bundled template
   (Commands / Expected / Observed / Outstanding / **Sign-off**) would
   standardize quality and close the loop cheaply. Pairs naturally with the
   tier-scaled slim variant from Finding 2B.
3. **Gate repetition.** All seven shell phases carry the identical gate
   command. Allow a node-level default gate above the phase sections, with
   per-phase override — less noise, one place to fix when the command changes.
4. **`**Produces:** []`** — empty-bracket notation is agent-speak; render
   "none" for humans (template-level fix alongside Finding 1).
5. **Spec reading path is now four deltas deep.** Understanding current HSDD
   requires v0.3 + v0.4 + v0.4.2 + v0.5, and 0.5.1 exists only in the
   changelog and skills. The users guide still links v0.3 as "the methodology
   spec" (users-guide.md:4) and its review-tier section points into v0.3
   §12. A consolidated spec (editorial, no semantic change) would be a
   worthy v0.6.0 deliverable.
6. **CHANGELOG link refs are stale:** `[Unreleased]` still compares against
   v0.4.2, and 0.5.0/0.5.1 have no link definitions (CHANGELOG.md:151–155).

---

## Prioritized recommendations for the next minor version

| P | Change | Where | Effort |
|---|--------|-------|--------|
| 1 | Bullet-list field blocks + per-plan phase summary table + rendering rule in quality gates | hsdd-phase-plan, hsdd-spec templates; users-guide examples | Small |
| 2 | Tier-scaled artifact profile (skip design.md and slim the verification doc below full-review) | hsdd-config rules; hsdd-phase-plan tier table; users guide | Small |
| 3 | Sizing floor + merge heuristic; rebalance the anti-merge anti-rationalization row | hsdd-phase-plan | Small |
| 4 | Execution protocol: config.yaml ephemerality + merge rule, integration-branch discipline, structured Collides-with, capability-naming default | hsdd-config, users guide, conventions template | Medium |
| 5 | Housekeeping: split the tasks rule, verification-doc template with sign-off, node-level default gate, heading levels, "none" for empty lists, changelog links | various | Small |
| 6 | Consolidated spec document (editorial) | spec/ | Medium |

All six are additive guidance/template changes. Existing projects keep
working; old-format spec files remain readable by every skill. Per semver
that's a clean **0.6.0** (1–3 and 5 alone would also fit a 0.5.x patch train,
but 2 and 4 change emitted-artifact behavior enough to deserve the minor).

---

## Closing opinion

You asked whether the phases "need to be as they are so that it can be
isolated or whatnot." Split the question: **isolation of the two nodes** —
unambiguously yes, it's the best thing in this methodology and the field
evidence backs it. **Seven phases per node with full ceremony each** — no;
about a third of those cycles bought neither parallelism (the plan itself
said so) nor isolated review (adjacent phases shared tier and contracts),
and each cost ~500 lines of artifacts plus a context switch and a gate. The
method isn't wrong; it's missing its own cost model on the small end. Give
`hsdd-phase-plan` a floor to stand on and `hsdd-config` a tier-shaped
ceremony dial, and the honest principle already written in your user's guide
— ceremony is a cost — becomes something the skills can actually enforce.
