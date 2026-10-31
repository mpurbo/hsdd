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

## Change log

- DEC-001: `sources` in `hsdd/auto/run.yaml`: PRD v2 (`hsdd/context/prd-simple-login.v2.md`, version 2) joins the normative sources; PRD v1 and update 1 move to baseline with their versions; RFC-001 stays normative.
