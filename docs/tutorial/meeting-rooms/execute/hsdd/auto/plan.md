# Run plan: meeting-rooms

## Segments

**2026-10-31-intake-prd-simple-login-v2.** Take in version 2 of the PRD, which grows simple-login into a meeting-room booker with PostgreSQL, through every handoff its intake record names.
Mode `intake`, request `hsdd/context/prd-simple-login.v2.md`, authority approved PRD.
The owner's instruction: version 2 supersedes version 1 together with update 1; take it in end to end; decide and record every question for one review sitting (verbatim in this segment's entry in `hsdd/auto/run.yaml`).
Stop policy `decide-and-record`, with the full stop set, so every answer given on the owner's behalf carries `would_have_asked: true`.
Stages: 0 Setup (done), 1 Plan, 2 Route, 3 Handoffs, 4 Consistency, 5 Align, 6 Report.
Decisions expected: the request's class and landing (the tree's backend, web and integration split looks able to hold rooms and bookings; a `structural` answer would be decided and recorded); persistence (whether accounts and sessions move to PostgreSQL with the bookings, which PRD v2 leaves to engineering, and how the RFC-001 statements "no database" and "exactly two endpoints" are superseded); the contract changes (the time zone on `profile-api@v2`, which declares `additive-only`, and a new contract for rooms and bookings); the three limits PRD v2 leaves to engineering; and the web app's navigation, which RFC-001 kept to two screens without a router.

## Step log

| Step | Segment | Kind | Skill | Target | Status | Artifact commit |
|------|---------|------|-------|--------|--------|-----------------|
| S00 | 2026-10-31-intake-prd-simple-login-v2 | setup | none | 2026-10-31-intake-prd-simple-login-v2 | completed | 91fda2b |
| S01 | 2026-10-31-intake-prd-simple-login-v2 | plan | none | 2026-10-31-intake-prd-simple-login-v2 | completed | 2c42daf |
| S02 | 2026-10-31-intake-prd-simple-login-v2 | intake | hsdd-intake | hsdd/context/prd-simple-login.v2.md | completed | b14b69d |
| S03 | 2026-10-31-intake-prd-simple-login-v2 | adr-update | hsdd-adr | ADR-001 | completed | b304ae8 |
| S04 | 2026-10-31-intake-prd-simple-login-v2 | adr | hsdd-adr | ADR-002 | completed | 4f17c69 |
| S05 | 2026-10-31-intake-prd-simple-login-v2 | contract | hsdd-contract | booking-api | completed | 4e0200c |
| S06 | 2026-10-31-intake-prd-simple-login-v2 | contract-touch | hsdd-contract | auth-api | completed | 2e46f32 |
| S07 | 2026-10-31-intake-prd-simple-login-v2 | contract-touch | hsdd-contract | profile-api.v2 | completed | ec711f9 |
| S08 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login | completed | a92c51e |
| S09 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login.backend | completed | 663d5d2 |
| S10 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login.web | completed | 8938b23 |
| S11 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login.integration | completed | f60add9 |
| S12 | 2026-10-31-intake-prd-simple-login-v2 | citation-touch | hsdd-spec | simple-login | completed | 332f8c5 |
| S13 | 2026-10-31-intake-prd-simple-login-v2 | citation-touch | hsdd-spec | simple-login.backend | completed | dc11756 |
| S14 | 2026-10-31-intake-prd-simple-login-v2 | citation-touch | hsdd-spec | simple-login.web | completed | de872ce |
| S15 | 2026-10-31-intake-prd-simple-login-v2 | citation-touch | hsdd-spec | simple-login.integration | completed | da3d52f |
| S16 | 2026-10-31-intake-prd-simple-login-v2 | phase-plan-append | hsdd-phase-plan | simple-login.backend | completed | b33b424 |
| S17 | 2026-10-31-intake-prd-simple-login-v2 | reconcile | hsdd-reconcile | simple-login.backend | completed | 4d3f106 |
| S18 | 2026-10-31-intake-prd-simple-login-v2 | phase-plan-append | hsdd-phase-plan | simple-login.web | completed | 67f2701 |
| S19 | 2026-10-31-intake-prd-simple-login-v2 | reconcile | hsdd-reconcile | simple-login.web | completed | d86830b |
| S20 | 2026-10-31-intake-prd-simple-login-v2 | phase-plan-append | hsdd-phase-plan | simple-login.integration | completed | 8a0b50d |
| S21 | 2026-10-31-intake-prd-simple-login-v2 | reconcile | hsdd-reconcile | simple-login.integration | completed | f27954f |
| S22 | 2026-10-31-intake-prd-simple-login-v2 | plan | none | 2026-10-31-intake-prd-simple-login-v2 | completed | 221dd61 |
| S23 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login.backend | completed | eee2b6d |
| S24 | 2026-10-31-intake-prd-simple-login-v2 | phase-plan-append | hsdd-phase-plan | simple-login.backend | completed | 14073d3 |
| S25 | 2026-10-31-intake-prd-simple-login-v2 | reconcile | hsdd-reconcile | simple-login.backend | completed | 2d79322 |
| S26 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login.integration | completed | 10b8e59 |
| S27 | 2026-10-31-intake-prd-simple-login-v2 | phase-plan-append | hsdd-phase-plan | simple-login.integration | completed | 2c5770e |
| S28 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login | completed | 4ec7669 |
| S29 | 2026-10-31-intake-prd-simple-login-v2 | spec-touch | hsdd-spec | simple-login.web | completed | b433a7b |

## Change log

- DEC-001: `sources` in `hsdd/auto/run.yaml`: PRD v2 (`hsdd/context/prd-simple-login.v2.md`, version 2) joins the normative sources; PRD v1 and update 1 move to baseline with their versions; RFC-001 stays normative.
- DEC-209: inserted a phase-plan-append on simple-login.backend (Q-084, rewriting the unshipped simple-login.backend.7 in place) and a reconcile on simple-login.backend after it (Q-085), per the intake record's insert rule.
- DEC-222: inserted a phase-plan-append on simple-login.integration (Q-086) rewriting the unshipped simple-login.integration.3's Scope (b) in place; no reconcile after it.
