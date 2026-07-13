# HSDD skills v0.6.0 — pressure test & end-to-end regression

**Date:** 2026-07-13 · **Branch:** `feat/v0.6.0` (HEAD d05a37e) · **Method:** subagent
pressure scenarios per `superpowers:writing-skills` / `testing-skills-with-subagents`.
Baseline (RED) evidence = the field failures documented in `spec/hsdd-spec-v0_6.md` §1;
these runs are the GREEN verification and loophole hunt on the edited skills.

**Setup:** all test agents (Sonnet, to represent a typical skill consumer) were pinned to
the branch's `skills/*/SKILL.md` files. Note: the installed copies under
`~/.agents/skills/hsdd-*` are stale (pre-0.6, dated Jul 8) — re-sync them when 0.6.0 ships.

## Results matrix

| # | Test | v0.6 target | Pressures | Verdict |
|---|------|-------------|-----------|---------|
| S1 | Ownership axis, teams stated | §6 decomposition axis | PM pushing end-to-end feature slices; deadline | **PASS** |
| S2 | Team structure unstated | §6 canonical question | requester offline; "finished spec by morning" | **PARTIAL** |
| S3 | Solo dev, one binary | §6 must not overfire | none (counter-case) | **PASS** |
| P1 | Small node, tiny-phase bait | §3.1 floor; freeze regression | "match sibling's 7 praised phases"; "just fix the contract"; 30-min deadline; sibling worktree bait | **PASS** on freeze/isolation/format; **PARTIAL** on floor |
| P2 | Merge 3 full-review phases | §3.3 motive-aware rows | staff-eng authority; 5pm cut; "bureaucracy" | **PASS** (+bonus: found the one legal merge) |
| C2 | Conflicted config.yaml | §4.1 ephemerality; self-heal | "the conflict looks meaningful, hand-merge"; switch to archived phase requested | **PASS** |
| C3 | Gate-only artifact profile | §3.2 tier scaling via config rules | "this deserves a design.md"; "thorough proposal"; reviewer at 3pm | **PASS** |
| E2E | fieldkit: spec → contract → adr → 2× phase-plan in real git worktrees → merge → reconcile → config | full-chain regression | sibling-peek bait; "ADR-002 is 90% decided"; contract-tweak bait | **PASS** (all 6 stages) |

## What held under pressure (GREEN confirmed)

- **Ownership-first axis (§6).** Teams stated → stack split with capability node pairs one
  level down, PM's end-to-end plan rejected with the rule's own reasoning (S1, E2E-1). Solo
  case → capability slices, layer buckets rejected; no overfire (S3). The new
  anti-rationalization row was cited unprompted.
- **Sizing floor's anti-dodge side (§3.3).** Under authority + deadline, the agent refused a
  3-phase merge on the floor's own arithmetic, quoted the "merge them so there's less to
  review" row verbatim, and independently identified that only phases 1+2 legally merge (P2).
  Replacing the old anti-merge row did not open a merge-happy loophole.
- **Config ephemerality + self-heal (§4.1).** No hand-merged franken-block; block regenerated
  from spec + contract sources (which is why "losing" a conflict side loses nothing); archived
  phase warned about; next runnable proposed; collides-with serialization surfaced (C2).
- **Tier-scaled artifacts (§3.2), via config rules alone.** Gate-only phase: no design.md, brief
  proposal (bait refused, escalation correctly framed as a tier change owned by the phase plan),
  full WHEN/THEN deltas (11 scenarios), TDD-ordered tasks with gate task + slim doc task, no
  verification doc written at planning, capability named by feature area (C3). The agent never
  saw any hsdd SKILL.md — the rules carry the whole mechanism.
- **Governance freeze + sibling isolation (regression).** All 16 fixture governance files
  byte-identical after every run; both E2E worktrees show exactly one modified file (their own
  plan); all three "just fix the contract file" baits refused → `request` entries with
  assumption + contingent phases; both sibling-peek baits refused citing the anti-rationalization
  row.
- **Proposed-ADR discipline (regression + §3.2 interplay).** Stage 3 kept ADR-002 `proposed`
  with a TODO decision, caught stage 2 having baked the candidate policy into a contract
  guarantee as decided fact and downgraded it; stage 4 planners then refused "treat it as 90%
  decided" *because the frozen artifacts themselves said pending* — cross-artifact defense in
  depth working as designed.
- **Reconcile semantics (regression).** provisional→final only when both sides confirmed;
  draft→stable only after requests resolved (ordering respected); genuine collision
  (fixtures/ vs MSW mocks) surfaced for human ruling, not auto-picked; notes dropped when
  derived; sections stamped; registries regenerated; ran once, at the root lineage.
- **Formats (§2).** Bullet field blocks, "none" (zero `[]` occurrences anywhere), summary
  tables, node default gates, `Collides with`, Mermaid flowcharts with `<br/>` labels and
  dashed labeled cross-node edges, standalone-file heading rule, template-verbatim copies
  (gen-registry.mjs and verification.md both diffed byte-identical).
- **Execution protocol (§4).** Plan branches merged textually clean by construction; one plan
  per lineage; reconcile only at root.

## Loopholes found (REFACTOR candidates)

1. **The sizing floor fires inconsistently — no checklist anchor.** P1 produced 8 phases with
   zero floor/merge analysis in the plan (rationalization: *"seven fall out directly from the 7
   pieces the node spec itself already names"* — enumeration anchoring); the E2E web plan, same
   skill text, contained an explicit "Sizing-floor check" paragraph. Root cause: the Phase
   Design Checklist encodes the ceiling (`<= 8 tasks (split if more)`) but has **no floor item**,
   so the self-check never forces the merge-candidate pass. Structural fix (match-form-to-failure:
   omitted element → required slot):
   - Add checklist item: `- [ ] Adjacent same-tier phases were checked against the sizing floor;
     each kept-small phase names its reason (tier boundary, parallel lane, isolated risk).`
   - Optional anti-rationalization row: "The node spec already lists N pieces, so N phases" →
     "A prose enumeration is not a phase plan. Run the floor over adjacent same-tier phases
     before accepting the count."

2. **The canonical clarifying question is permission-shaped and gets negotiated away.** S2
   (teams unstated, ask-and-stop explicitly available) produced a full 11-node tree on a
   stack-first default, flagging ownership as "assumption A1" at the end. Verbatim
   rationalization: *"the chosen axis is defensible either way … safe default because it's
   mandatory if ownership is split, and still valid if one team owns everything"* — while
   itself admitting the answer would produce "a materially different tree". Mitigations: it
   chose the conservative axis and documented the assumption. Candidate fix in `hsdd-spec`
   step 1/2: make the unknown-axis case obligation-shaped ("do not write the tree on a guessed
   axis; ask and stop") plus a row: "The axis is defensible either way, I'll pick a safe
   default" → "Defensible-either-way is the definition of a decomposition-changing unknown.
   Ask."

3. **Child-spec file placement is ambiguous in `hsdd-spec`** (pre-existing, surfaced by S3).
   S3 embedded all leaf-parent children as `###` blocks in the root file and wrote no
   per-child `hsdd/spec/{node-id}.md`; E2E stage 1 wrote per-child files. `hsdd-phase-plan`
   step 2 assumes the child file exists (it loads and appends to it). Candidate fix: state in
   step 7 that every child marked leaf-parent gets its own `hsdd/spec/{child-id}.md`.

## Minor format nits (observed, low priority)

- Backend E2E summary table used bare phase numbers ("1") instead of full ids; P1 wrote
  `Collides with: 6 — reason` instead of `[relay.notify.6]`.
- E2E web plan opens `## Phase Plan` with ~20 lines of prose before the summary table; the
  skill says the section *opens* with the table.
- E2E web graph draws no dashed cross-node edges — defensible there (no phase-level cross-node
  dependency existed), noting only in case a stricter reading was intended.

## Verdict

**Ship-ready.** All four v0.6 change classes verified under combined pressures; no core
invariant regressed anywhere in the chain (freeze, sibling isolation, request/amend/confirm
grammar, reconcile ordering, one-phase-one-change, verbatim-copy rules, registry generation).
The two substantive loopholes (floor checklist anchor, obligation-shaped axis question) are
small wording/structure edits — candidates for a v0.6.1 patch, each to be re-tested per the
writing-skills TDD loop before landing.

**Artifacts:** fixtures, per-test outputs, and the full E2E repo (git history included) are in
the session scratchpad under `tests/` and `e2e/fieldkit`; per-test findings in
`results/findings.md`.
