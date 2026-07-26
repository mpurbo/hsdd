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

## Result

*(to be filled after the run: per-finding caught/missed table, deviations from
the pass criteria, and the verdict)*
