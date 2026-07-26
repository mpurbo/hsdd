# v0.7 acceptance — microsite-hsdd adoption run

**Gate:** `spec/hsdd-spec-v0_7.md` §7.3. v0.7 is not released until
`hsdd-checkpoint` and `hsdd-milestone` run against the microsite reference
project and produce conforming documents **without manual repair**, with the
adoption run's findings register catching the seeded findings below.

**Status:** expectations recorded, run not yet performed.

---

## Baselines at the time of writing (2026-07-26)

| Repo | State |
|---|---|
| `microsite-hsdd` (spec repo) | main `04ca8f8` |
| `microsite-be` | main; hsdd submodule **uninitialized**, pointer `6f8b6b8` |
| `microsite-fe` | `epic/fe-shell` (the branch carrying the FE code); hsdd submodule **checked out at `04ca8f8`** on branch `acceptance/v0_7-adoption-run`, while the branch's *recorded* pointer is `e2abf99` |

The run happens from **`microsite-fe`** on `epic/fe-shell` — the branch that
actually holds the FE application code, so the code-vs-plan half of the
evidence pass has something to compare against. `microsite-be`'s path is
supplied in the prompt so the pass can audit it; that BE cannot even read
`hsdd/` is finding 5.

**Pre-run adjustment, recorded for honesty.** `epic/fe-shell` records
submodule commit `e2abf99`, which is **31 commits behind** spec-repo main:
its `management/` holds only `2026-07-17-pe-estimation.md` and an
undated `hsdd-execution-plan.md`, and it predates ADR-018, the open-question
normalization (`699410e`), and the common.2–.5 verification docs. Running
there would have tested a July-17 project against expectations written from
July-26 content. The submodule working tree was therefore bumped to
`04ca8f8` before the run, and all four content findings (1–4) were verified
present in that checkout.

The recorded pointer was deliberately left at `e2abf99` — that drift is real
and is part of finding 5. A correct pass should notice both that BE's pointer
is unreachable and that FE's *recorded* pointer trails main, even though the
working tree it is reading is current.

**Scoped out of this dry run:** `hsdd-checkpoint` step 8 ("Land the output")
instructs a real run to commit and **push inside the submodule to spec-repo
main** and bump every implementation repo's pointer. Pushing to the team's
live repository is not acceptable for an acceptance rehearsal, so the prompt
forbids the push and the pointer bumps; commits stay local on
`acceptance/v0_7-adoption-run`. This exempts only the landing half of step 8
— document generation, the findings register, and every pass criterion below
are unaffected.

## Expected findings (written before the run — each re-verified present today)

1. **Dangling supersedes link.** `management/2026-07-24-hsdd-execution-plan.md:3`
   links `hsdd-execution-plan.md`; the file is
   `2026-07-17-hsdd-execution-plan.md`. Three further dangling anchors to the
   same missing filename at lines 13, 83, 320.
2. **No atlas.** `management/` contains five dated documents and no
   `atlas.md`. The adoption run must generate the first one rather than
   treating its absence as an error.
3. **Blank sign-offs.**
   `verify/moka-microsite.backend.common.2.verification.md:48` — "Reviewer /
   date:" empty. `verify/moka-microsite.backend.common.3.verification.md:27`
   — same, and `:29` still carries unfilled template text
   ("verified | waived (reason) | deferred to {phase-id}").
4. **Stale pending-OQ prose (R8-bis class).** `contract/be-analytics-api.md`
   and `contract/analytics-query.md` still justify the absent dismiss/snooze
   method as pending **OQ-F6**, which resolved 2026-07-21/22. The specs' OQ
   tables are already correct — only the contract prose lags.
5. **Submodule pointer drift, both repos.** BE's pointer `6f8b6b8` is on the
   lineage that never merged (and the submodule is not even initialized, so a
   session there cannot read governance at all). FE's `f6887af` is on main but
   behind `04ca8f8`.
6. **Guardrails 1–12 imported, not restarted.** The emitted execution plan
   must carry forward the numbered guardrails from
   `2026-07-24-hsdd-execution-plan.md` under their existing numbers, and
   append any new rule as 13+.
7. **Supersedes chain adopted, not replaced.** The emitted plan must supersede
   `2026-07-24-hsdd-execution-plan.md` **by exact filename**, and the emitted
   progress report must supersede `2026-07-24-progress.md`.

## Pass criteria

- [ ] Findings register ⊇ every expected finding still present at run time.
- [ ] Plan supersedes `2026-07-24-hsdd-execution-plan.md` by exact filename;
      progress report supersedes `2026-07-24-progress.md`.
- [ ] `atlas.md` generated with all three parts (tree + phase status, contract
      graph, ADR coverage); no diagram beyond ~20 nodes.
- [ ] Every findings-register row appears in the plan as a step or an explicit
      waiver (the §2.7 loop).
- [ ] Emitted documents carry the §2.2 headers: `Supersedes` (exact filename),
      `Repo baselines` on the progress report and plan, `Companion docs`,
      `## Change log`.
- [ ] Both implementation repos reviewed — the run took BE's path from the
      prompt rather than silently reviewing only FE.
- [ ] Changes confined to `hsdd/management/`; no historical dated document
      rewritten.
- [ ] `hsdd-milestone` recognizes `2026-07-24-milestones.md` as the baseline
      and mints no duplicate (no re-baseline unless a trigger fires).
- [ ] No manual repair was needed to make the output conform.

**Inverted criterion — the important one:** a checkpoint that runs *clean* on
this repo **fails** acceptance. The findings above are known to be present; a
green run means the evidence pass is not looking, which is a worse defect than
a noisy one.

## Method

The run must happen in a session with **cold context** — one that has not seen
the v0.7 design conversation. An agent that helped write the skills will
produce a good document from memory and prove nothing about whether the skill
text is sufficient to drive the run. That sufficiency is the whole hypothesis
under test.

---

## Result — `hsdd-checkpoint`: **PASS** (run 2026-07-26)

Run from `microsite-fe` on `epic/fe-shell` in a cold-context session
(`claude-work`), invoked in natural language — the skill's description
triggered discovery on its own, without the slash command. Output committed
locally as `39ef0b9` in the submodule on `acceptance/v0_7-adoption-run`;
nothing pushed, no pointers bumped.

Wrote `2026-07-26-progress.md` (152 lines, 26-row findings register CP-01…26),
`2026-07-26-execution-plan.md` (200 lines), `atlas.md` (329 lines), plus
change-log appends to four existing documents. 704 insertions, zero deletions.

### Expected findings

| # | Expectation | Caught as | Verdict |
|---|---|---|---|
| 1 | Dangling supersedes link (07-24 plan) | CP-18, CP-12 | **caught, sharper** — identified the link as *born broken* (the file was renamed in the same commit that wrote the link), which the expectation did not know |
| 2 | No atlas | first `atlas.md` generated | **caught** — treated as adoption work, not an error |
| 3 | Blank sign-offs common.2/.3 | CP-09, CP-22 | **caught, wider** — common.**4/.5** reviewer fields are also blank; the expectation named only two |
| 4 | Stale "pending OQ-F6" prose | CP-11 | **caught, wider** — the analytics *spec* echoes it too, not just the two contracts |
| 5 | Submodule pointer drift | CP-03, CP-19 | **caught, precisely** — located `6f8b6b8` as existing only on `origin/feature/MOK-1778-common-5`, and FE's record 31 commits behind |
| 6 | Guardrails 1–12 imported | plan § Guardrails | **caught** — 1–8 and 9–12 carried by reference under their numbers; 13–15 added and explicitly marked *proposed*, to be accepted or rejected at Sync R |
| 7 | Supersedes chain adopted by exact filename | both headers | **caught** — progress → `2026-07-24-progress.md`, plan → `2026-07-24-hsdd-execution-plan.md` |

7/7. No expectation missed.

### Pass criteria

All met. Traceability is exact: **all 26** register ids appear in the plan as
steps or under the explicit *Waivers* section (§2.7 loop, verified by set
comparison). `atlas.md` has all three parts, four diagrams, largest 15 nodes
(cap ~20). Changes confined to `management/`; the four edits to historical
documents are pure change-log appends, the permitted operation. Emitted
documents carry the §2.2 headers, including `Repo baselines` on both
evidence-derived documents and a `Method` line that honestly discloses gate
commands were **not** re-run (trees byte-identical to the 07-24 review).

**Inverted criterion: satisfied.** 26 findings, not a clean bill.

### Findings the run produced that the expectations did not anticipate

Evidence the pass does real work rather than confirming a checklist:

- **CP-01 (High) — a verification doc with no code.** `host-data.1` has a
  signed verification document on an unmerged branch, but the implementation
  it describes exists nowhere in the BE repo: no branch, no historical tree,
  no stash, no dangling objects. This is the audit chain's first real hole,
  and it is exactly the class of defect the pinned done-definition exists to
  expose.
- **CP-07 — every BE phase on main arrived squashed**, not just the known
  four-phase `a54f5bb`: `common.1` was also merged as a re-created single
  commit whose real branch tip was never merged.
- **Renderer `pr.1` correctly counted as a claim, not done** — genuinely
  implemented with verification numbers that check out exactly, but both
  halves sit on unmerged branches, so the done-definition excludes it.
- **FE main movement is clean** — `epic/fe-shell` merged via a true merge
  commit preserving all 40 per-phase commits. A negative result, reported.
- The run also self-corrected: a subagent called BE's pointer consistent; the
  controller re-verified and kept it as a High finding.

### Skill defect found by this run (fixed)

The run's closing chat message asked the operator to adjudicate three items
("R9 — find/push the host-data.1 code or retract the doc", the proposed
guardrails, the carried Sync R decisions). The *artifacts* were correct — all
three were already written into the plan as owned steps — but step 7's wording
("report … what needs a human decision") invited an interactive decision queue
at the end of the run. That defeats the point of running a checkpoint days
before the sync: the plan is the agenda a lead takes to the team, and a
decision extracted from whoever ran the checkpoint is one the team never saw.

Fixed in `hsdd-checkpoint` step 7 (**"Decisions are written, not asked"**),
with a matching quality gate and an anti-rationalization row. No artifact from
this run needed repair — the defect was in the reporting register only, so the
**"without manual repair"** condition of §7.3 still holds.

### Operational note (not a skill defect)

A permission prompt for a read-only grep was declined mid-run, apparently by
mis-click, and the run paused for direction. It resumed cleanly when told the
rejection was accidental. Worth knowing that a stray denial mid-pass is
recoverable without restarting.

---

## Result — `hsdd-milestone`

*(pending: run second, so it can adopt the checkpoint's output — must
recognize `2026-07-24-milestones.md` as the baseline and mint no duplicate)*
