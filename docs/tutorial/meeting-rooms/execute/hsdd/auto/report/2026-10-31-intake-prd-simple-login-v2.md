# Segment report: 2026-10-31-intake-prd-simple-login-v2

## Outcome

<!-- slot:outcome -->
PRD v2 is taken into the planned tree end to end: every one of the intake record's nineteen handoffs executed, and three inserted steps and three consistency spec-touches closed what they found, with no stop and one rework (S23). The tree gains ADR-002 (the time model), an amended ADR-001 (sessions stay in memory), a new `booking-api@v1` that is now `stable` with final phase ids, `timeZone` on `profile-api@v2`, and twelve unshipped phases: simple-login.backend.4 to .7, simple-login.web.5 to .9 and simple-login.integration.3 to .5. The run answered on the owner's behalf every question the skills reserve for a human; those answers are the "Decisions to look at first" above, led by PRD v2's two open limits (DEC-046, DEC-047) and the dropped 3-second check (DEC-195). The intake record stays open until a checkpoint counts its phases done.
<!-- /slot -->

## What changed

<!-- slot:what_changed -->
The request is a new version of a source, so the setup step moved PRD v1 and update 1 to baseline and made PRD v2 normative (DEC-001), and four citation touches moved the node specs' source citations (S12 to S15). The class is `cross-node` (DEC-005): the decomposition by who builds what still holds, so rooms, bookings and PostgreSQL land on the backend, the screens on the web, and PRD v2's scripted success tests on integration. Persistence got no ADR of its own (DEC-010); sign-in stays in memory (DEC-018); every time crosses the wire as a UTC instant and only the web converts (ADR-002, DEC-028). After the handoffs, the consistency stage inserted an in-place rewrite of simple-login.backend.7 so the backend's own gate proves the start-on-an-empty-database promise (DEC-209), and of integration.3's Scope to drop a fallback and a false sentence about rooms (DEC-222).
<!-- /slot -->

| Handoff | Step | Kind | Target | Commit |
| --- | --- | --- | --- | --- |
| H1 | S03 | adr-update | ADR-001 | b304ae8 |
| H2 | S04 | adr | ADR-002 | 4f17c69 |
| H3 | S05 | contract | booking-api | 4e0200c |
| H4 | S06 | contract-touch | auth-api | 2e46f32 |
| H5 | S07 | contract-touch | profile-api.v2 | ec711f9 |
| H6 | S08 | spec-touch | simple-login | a92c51e |
| H7 | S09 | spec-touch | simple-login.backend | 663d5d2 |
| H8 | S10 | spec-touch | simple-login.web | 8938b23 |
| H9 | S11 | spec-touch | simple-login.integration | f60add9 |
| H10 | S12 | citation-touch | simple-login | 332f8c5 |
| H11 | S13 | citation-touch | simple-login.backend | dc11756 |
| H12 | S14 | citation-touch | simple-login.web | de872ce |
| H13 | S15 | citation-touch | simple-login.integration | da3d52f |
| H14 | S16 | phase-plan-append | simple-login.backend | b33b424 |
| H15 | S17 | reconcile | simple-login.backend | 4d3f106 |
| H16 | S18 | phase-plan-append | simple-login.web | 67f2701 |
| H17 | S19 | reconcile | simple-login.web | d86830b |
| H18 | S20 | phase-plan-append | simple-login.integration | 8a0b50d |
| H19 | S21 | reconcile | simple-login.integration | f27954f |

## Decisions to look at first

| Decision | Step | Question | Chosen |
| --- | --- | --- | --- |
| DEC-013 | S02 intake | RFC-001 (normative, read-only) still says the service owns accounts and sessions in memory, the A... | resolve locally, flag upstream |
| DEC-037 | S04 adr | Materializing an ADR whose decision no human stated | write it accepted, its Context citing this decision |
| DEC-046 | S05 contract | PRD v2 Left to engineering: the longest booking allowed, if there is a limit. | 8 hours of elapsed time |
| DEC-047 | S05 contract | PRD v2 Left to engineering: how far ahead a room can be booked, if there is a limit (Q-010 (1): w... | a start at most 365 days after the backend's clock |
| DEC-154 | S17 reconcile | simple-login.backend's amend refuses a POST /api/bookings whose title holds U+0000 or an unpaired... | in place in v1, with a dated Versioning line |
| DEC-156 | S17 reconcile | simple-login.backend's note says how this tree runs PostgreSQL 17 (backend/compose.yaml, npm --pr... | apply it as a short Local database section |
| DEC-187 | S20 phase-plan | Which scripted test covers the criteria that turn on the backend's clock (PRD v2 AC-5.5, AC-6.2's... | service tests now, the backend's replay for a started booking |
| DEC-195 | S20 plan | simple-login.integration.4 removes the shipped 3-second check from the AC-1.1 browser test, becau... | Keep the plan; flag the omission for the owner |
| DEC-198 | S21 reconcile | request `booking-api@v1`: when `npm --prefix backend start` runs with `DATABASE_URL` naming an em... | yes, at every start, before it listens |
| DEC-001 | S00 setup | How does the owner's sentence 'Version 2 of the PRD supersedes version 1 together with update 1'... | PRD v2 normative; PRD v1 and update 1 baseline; RFC-001 stays normative |
| DEC-002 | S00 setup | How do the owner's sentences 'take it in end to end, through every handoff the intake record name... | No scope limit; stop policy decide-and-record, which run.yaml already sets |
| DEC-003 | S00 setup | The adapter added 7 elements; when does host enforcement start? | Record that enforcement starts with the next host session; launch with the default agent type now |
| DEC-004 | S00 setup | The orchestrating session's working directory is not this repository and its Skill tool cannot lo... | One extra launch-prompt line naming the repository root, and one cited context line per dispatch telling the step to read the skill's SKILL.md under .claude/skills by path |
| DEC-005 | S02 intake | Classify, one class per intake: local, cross-node, new-capability or structural? | cross-node |
| DEC-008 | S02 intake | Where is 'whether signing in survives a restart of the service, now that a database exists' (PRD... | adr-update on ADR-001 |
| DEC-009 | S02 intake | Does the time handling PRD v2 asks for (AC-2.5, AC-4.2 to AC-4.4, AC-5.2, AC-5.3, AC-5.5, AC-6.2)... | new ADR-002, the time model |
| DEC-010 | S02 intake | Does persistence in PostgreSQL 17 (PRD v2 Constraints) get an ADR of its own? | no ADR: a root hard constraint plus backend D{n} |
| DEC-014 | S02 intake | Which nodes take a spec-touch for a change to their own text (not for contract versions in their... | the root and all three leaf-parents |
| DEC-015 | S02 intake | Which artifacts get a citation-touch handoff (when: cites-superseded) for the move from PRD 1 and... | the four node specs only |
| DEC-018 | S03 adr | Whether signing in survives a restart of the service, now that a database exists (PRD v2 Left to... | sessions stay in memory; amend ADR-001 |
| DEC-019 | S03 adr | Does sign-out stay client-side now that the API is no longer fixed at two endpoints (RFC-001 §3:... | client-side, no logout endpoint |
| DEC-020 | S03 adr | With the decision kept, where does the amendment state what PRD v2 changes for consumers: only in... | Consequences amended in place, recorded under Amendments |
| DEC-028 | S04 adr | Which node turns a date in the user's zone into a time range (AC-4.2), turns the booking form's d... | the web app converts both ways; the backend works in instants only |
| DEC-031 | S04 adr | How does the booking form handle London's clock-change days (AC-4.4, AC-5.1): the hour the clocks... | offer the day's quarter-hour instants |
| DEC-032 | S04 adr | How are times shown where PRD v2's examples are silent: a time that falls on another date than th... | carry the date; mark the repeated hour with the zone's short name |
| DEC-033 | S04 adr | Where does a booking show the room's local times (AC-4.3), and how is 'another time zone than min... | on the Rooms screen, when the zone names differ |
| DEC-034 | S04 adr | Do the tests of every node that handles time run in an ambient time zone that is neither account'... | required in every node's tests |
| DEC-141 | S16 phase-plan | Where does the PostgreSQL 17 Compose file live, how is it started, and how does simple-login.inte... | backend/compose.yaml, started by npm --prefix backend run db:up, which picks docker compose or docker-compose; told to the integration node as a note entry (D4) |
| DEC-144 | S16 phase-plan | Which PRD v2 sections join the node's Sources entry for hsdd/context/prd-simple-login.v2.md (the... | append US-4, US-5, US-6, Rooms, Constraints, Left to engineering, Team and delivery, Success |
| DEC-152 | S17 reconcile | The version ripple adds booking-api@v1 to simple-login.backend's Produces; its consumers (simple-... | matrix row and DAG edge now, consumers as the contract file names them |
| DEC-197 | S21 reconcile | Detect collisions before applying anything. Grouped by contract, simple-login.integration's five... | no collision |
| DEC-200 | S21 reconcile | note: simple-login.integration's browser suite runs the service on a database of its own, `meetin... | apply a short bullet in Local database |
| DEC-201 | S21 reconcile | Insert rule (intake record): this reconcile changed booking-api@v1 after every node's phase-plan-... | no insert; route two considers |

## Upstream

| Decision | Question | Chosen | Evidence |
| --- | --- | --- | --- |
| DEC-013 | RFC-001 (normative, read-only) still says the service owns accounts and sessions in memory, the A... | resolve locally, flag upstream | RFC-001 §1, §2, §3, §6; PRD v2 Constraints, Scope, Left to engineering; hsdd/judgement/decisions.jsonl DEC-001 |
| DEC-018 | Whether signing in survives a restart of the service, now that a database exists (PRD v2 Left to... | sessions stay in memory; amend ADR-001 | PRD v2 Left to engineering; PRD v2 Constraints; PRD v2 Success; RFC-001 §3; auth-api@v1 Interface; hsdd/spec/simple-login.integration.md simple-login.integration.2 Scope; hsdd/verify/simple-login.integration.1.verification.md Learnings; hsdd/management/2026-10-30-execution-plan.md H-2; DEC-008; DEC-013 |
| DEC-019 | Does sign-out stay client-side now that the API is no longer fixed at two endpoints (RFC-001 §3:... | client-side, no logout endpoint | RFC-001 §3; PRD v2 US-3; PRD v2 Scope; PRD v2 Constraints; hsdd/spec/simple-login.md OQ1; DEC-013 |
| DEC-195 | simple-login.integration.4 removes the shipped 3-second check from the AC-1.1 browser test, becau... | Keep the plan; flag the omission for the owner | hsdd/context/prd-simple-login.v2.md Success; hsdd/auto/steps/S08.decisions.jsonl DEC-073 |

### Earlier proposals read against the request

<!-- slot:earlier_proposals -->
No earlier decision carried `would_upstream: true` (`state.mjs upstream` listed none at the intake step), so the request adopted, contradicted or left open no earlier proposal. This segment adds four: DEC-013 (RFC-001's version-1 statements want an amendment or an RFC for version 2), DEC-018 and DEC-019 (the session answers the RFC's authors may want to revisit), and DEC-195 (PRD v2's Success section may have dropped the 3-second target by accident).
<!-- /slot -->

## Experiments

| Directory | Question | Finding (README first line) |
| --- | --- | --- |
| hsdd/auto/experiments/cites-superseded-targets | Which candidate citation-touch targets does the run's own cites-superseded condition select, and is each hit a real citation or a number? | cites-superseded holds for the four node specs through real Sources citations of the PRD 1 and Update 1 paths; for auth-api, profile-api and profile-api.v2 it holds only because the baseline version token "1" matches numbers ("1 to 64 characters", `"minLength": 1`); for ADR-001 it does not hold. |
| hsdd/auto/experiments/time-model-intl | Which runtime facts about time zones can ADR-002 rely on in Node.js 24, and so in the web app's Vitest runs: Temporal, London's clock-change days, quarter-hour offsets, en-GB formats, the ambient zone under TZ, the instant string form? | Node.js 24 (tz 2026b) has no global Temporal; its Intl data gives London's clock-change days as 23 and 25 hours, every zone's 2026-2028 offset is a multiple of 15 minutes, and en-GB formats PRD v2's examples as written. |
| hsdd/auto/experiments/time-model-postgres | Does storing booking times as instants in PostgreSQL 17 hold PRD v2 AC-5.3's touching rule and AC-4.2's day query with no zone in SQL? | PostgreSQL 17.11: timestamptz keeps the instant whatever the session TimeZone while timestamp silently drops the Z; half-open tstzrange makes touching bookings not overlap, and an exclusion constraint refuses an overlap with 23P01 naming one conflicting row. |
| hsdd/auto/experiments/booking-api-fixtures | Are booking-api@v1's schema and 35 fixtures consistent with each other and with the contract's rules, under the Ajv settings the backend's replay rig uses, and does a 365-day horizon keep the next London clock-change day bookable through the API under the real clock (Q-010 (1))? | All 35 booking-api@v1 fixtures validate against its schema under the backend replay rig's Ajv settings and reproduce against an independent model of the Interface; London's next clock change is at most 217 days after any clock, inside the 365-day horizon. |
| hsdd/auto/experiments/profile-api-v2-timezone | Does adding timeZone to profile-api@v2 meet the additive-only condition (the pre-touch fixtures still validate against the changed schema), what would a required field cost, and is the chosen value pattern tight enough? | All five profile-api@v2 fixtures as they stood at de2e86a validate against the schema with an optional `timeZone`, so the addition keeps v2 under additive-only; the same field made required rejects the pre-touch me-ayu and me-budi. |
| hsdd/auto/experiments/booking-store-postgres | How should the backend's store hold booking-api@v1 G4 to G6 on PostgreSQL 17 under 20 simultaneous overlapping bookings, which booking-api@v1 values does PostgreSQL refuse, how do instants pass through node-postgres, what does a database per test file cost, and which Compose command exists under Colima? | Under 20 simultaneous bookings of one room, a per-room advisory lock settled every round in under 100 ms with no deadlock; the exclusion constraint alone sometimes settled only through 40P01 deadlocks (up to 19 s a round), and retrying after them could leave attempts unbooked (one round 215 s). |
| hsdd/auto/experiments/booking-api-title-rule | Can booking-api@v1's schema state simple-login.backend's amend (a title holding U+0000 or an unpaired surrogate is refused) under the backend replay rig's strict Ajv settings, keep all 35 fixtures valid, and give the same verdict whether or not a validator compiles the pattern with the unicode flag? | booking-api@v1's Title can refuse U+0000 and unpaired surrogates with one whole-string pattern in an allOf: it compiles under the replay rig's strict Ajv, all 35 fixtures stay valid, and its verdict is the same with or without the unicode flag. |
| hsdd/auto/experiments/web-time-display | What exact instants and strings will simple-login.web's planned time functions (ADR-002 Decisions 4, 5 and 7, Intl only) give for booking-api@v1's fixtures under TZ=Asia/Kolkata, so the phase plan can state them? | Intl alone, under TZ=Asia/Kolkata on Node.js 24.18, implements ADR-002's web-side rules and reproduces every booking-api@v1 fixture path and PRD v2's example strings; the exact lines are in output.txt. |
| hsdd/auto/experiments/integration-replay-fixtures | Which booking-api@v1 fixtures can simple-login.integration replay exactly through the dev proxy against the real service on the real clock and a database whose bookings it does not fix (Q-069 counted 14)? | 15 of booking-api@v1's 35 fixtures answer the same under every real clock and any stored bookings, so the integration's proxy replay can replay them exactly: eight 400s, four 401s, two 404s and the 422 BOOKING_TOO_LONG. |
| hsdd/auto/experiments/integration-clock-change-days | Can the browser tests book on both the next last Sunday of March and of October after the real clock within booking-api@v1's 365 days, and which strings will those bookings show? | From any clock, the nearer London change day's planned booking starts at most 217.02 days ahead, inside booking-api@v1's 365 days; the farther one is beyond 365 days for about six days in some years (March 2029-03-25 to 03-31, October 2031-10-25 to 11-01 in 2026 to 2031). |
| hsdd/auto/experiments/integration-browser-clock | In the installed Chrome under Playwright 1.64.1, does a context's timezoneId set the page's ambient zone, and does page.clock.setFixedTime hold only the browser's clock behind the real one while timers run (for the AC-5.5 browser test)? | In the installed Chrome under Playwright 1.64.1, a context's timezoneId sets the page's ambient zone, and page.clock.setFixedTime holds the page's clock behind the real one while its timers run, leaving the test process on the real clock. |
| hsdd/auto/experiments/backend-start-empty-database | Can simple-login.backend.7's `start` test run the service on a test database created without the schema, start it again on that database, and still leave no database behind? | D6's schema applied at a start on a database created empty makes the `booking` table; applied again at a second start it raises only notices (42710, 42P07) and the booking keeps its id; a test database a pool still holds cannot be dropped (55006) until the pool ends. |

## Assumptions about the owner's intent

<!-- slot:assumptions -->
- The owner wants PRD v2 taken in with the tree's shape unchanged; no step found a reason to graft a node, and the stop set never fired.
- RFC-001 stays the accepted technical approach for sign-in and the profile, overtaken only where PRD v2 says so (DEC-001, DEC-013).
- The owner accepts the open execution plan's repairs C-2 and C-3 being absorbed where a touch passed by them (DEC-022, DEC-056), while C-1 (profile-api@v1's deprecation) waits for the owner's Sync A answer (DEC-016).
- The owner reads an 8-hour longest booking and a 365-day horizon as engineering's call that product said it had no preference on (DEC-046, DEC-047).
- Every phase planned here is unshipped and may still be rewritten in place before its switch; the run treated a verification doc on the conventions' Main line as the only mark of shipped.
<!-- /slot -->

## Record gaps

- S23 was resumed at 2026-10-31T18:26:25Z for a finding
- S02 read hsdd/management/2026-10-30-execution-plan.md outside its read set: To find open work outside intake records that touches the same ADR and contracts (C-1 to C-3), so the handoffs do not pre-empt Sync A (DEC-016).
- S02 read hsdd/auto/plan.md outside its read set: The segment's expected decisions, to make sure each has a route in the record.
- S02 read hsdd/auto/run.yaml outside its read set: The sources' citation names and versions, which define the superseded strings for cites-superseded.
- S02 read hsdd/judgement/decisions.jsonl outside its read set: DEC-001's reading of RFC-001, which DEC-013 builds on.
- S02 read hsdd/conventions.md outside its read set: Layout, ordering policy and the reconcile protocol, to order the per-node append and reconcile pairs.
- S02 read .claude/skills/hsdd-auto/SKILL.md outside its read set: Section 8 (what the intake mode walks: citation-touch placement, align) and the judgement-point shape.
- S02 read .claude/skills/hsdd-spec/SKILL.md outside its read set: The touch and citation-touch invocation forms and graft rules, to write the handoff prompts in the receiving skill's form.
- S02 read .claude/skills/hsdd-contract/SKILL.md outside its read set: The additive-only and versioned rules behind DEC-007 and the citation-touch rule.
- S02 read .claude/skills/hsdd-adr/SKILL.md outside its read set: The ADR or D{n} table behind DEC-008 to DEC-012 and the amend or supersede lifecycle named in H1.
- S02 read .claude/skills/hsdd-phase-plan/SKILL.md outside its read set: Append mode and Change Requests, which the record's Sources and Scope paragraph restates.
- S02 read .claude/skills/hsdd-reconcile/SKILL.md outside its read set: When a serial reconcile runs, to justify one reconcile per leaf-parent.
- S02 read hsdd/scripts/auto/lib/intake.mjs outside its read set: How the record and its hsdd-handoffs block are parsed and checked (C8), and the cites-superseded condition the experiment calls.
- S02 read hsdd/scripts/auto/lib/kinds.mjs outside its read set: Skill and target type per handoff kind, so each handoff's skill matches.
- S02 read hsdd/scripts/auto/lib/checks.mjs outside its read set: C8's header-field list.
- S02 read hsdd/scripts/auto/next.mjs outside its read set: How handoffs are dispatched, skipped, and what pending contract handoffs suppress in C3 and C5.
- S02 read hsdd/scripts/auto/routed.mjs outside its read set: The matching rule, so the consider items target handoff ids that match their steps.
- S02 read hsdd/scripts/auto/gate.mjs outside its read set: Which checks this step's gate runs.
- S02 read hsdd/scripts/auto/schema/handoffs.schema.json outside its read set: The block's schema.
- S02 read hsdd/scripts/auto/schema/step-report.schema.json outside its read set: This report's schema.
- S02 read hsdd/scripts/auto/lib/report-rules.mjs outside its read set: This report's code rules.
- S02 read hsdd/scripts/auto/templates/steps/ outside its read set: The default invocations of the receiving step kinds, to phrase the prompts.
- S03 read hsdd/spec/simple-login.integration.md outside its read set: The invocation asks to weigh simple-login.integration.2's restart stand-in for AC-2.3; the node is not in affects.
- S03 read hsdd/verify/simple-login.integration.1.verification.md outside its read set: Its Learnings record that a backend restart gives the expired-token 401 in the browser suite (DEC-018 evidence).
- S03 read hsdd/verify/simple-login.integration.2.verification.md outside its read set: Whether integration.2 shipped and still relies on the restart stand-in.
- S03 read hsdd/verify/simple-login.web.3.verification.md outside its read set: grep for restart: web D5's rationale names a restart invalidating every token.
- S03 read hsdd/verify/simple-login.backend.2.verification.md outside its read set: grep for restart and expiry: how the shipped session store behaves.
- S03 read hsdd/management/2026-10-30-execution-plan.md outside its read set: C-2 for Q-002, C-1 for profile-api@v1, and H-2's restart step (DEC-018, DEC-022, DEC-023).
- S03 read hsdd/judgement/decisions.jsonl outside its read set: DEC-008, DEC-013, DEC-015 and DEC-016, which the invocation and the routed items rest on.
- S03 read hsdd/conventions.md outside its read set: Main line, OQ rules and the governance write rules.
- S03 read .claude/skills/hsdd-contract/SKILL.md outside its read set: Where governed_by sits in contract front matter and what the registry projects from it (Q-001).
- S03 read .claude/skills/hsdd-config/SKILL.md outside its read set: Which ADR sections are injected and the self-contained rule, which keeps ids out of Consequences (DEC-020).
- S03 read .claude/skills/hsdd-auto/SKILL.md outside its read set: grep for amendment rules referenced by the step template.
- S03 read hsdd/scripts/auto/gate.mjs outside its read set: Which checks the step gate runs.
- S03 read hsdd/scripts/auto/lib/checks.mjs outside its read set: C3's governed-by rule for nodes and contracts.
- S03 read hsdd/scripts/auto/routed.mjs outside its read set: How routed targets match steps, to address the consider items to handoff ids.
- S03 read hsdd/scripts/auto/decide.mjs outside its read set: The decision rules the decide command enforces.
- S03 read hsdd/scripts/auto/schema/step-report.schema.json outside its read set: This report's schema.
- S03 read hsdd/scripts/auto/templates/steps/adr-update.md outside its read set: The step template, to read the What to do rule in full.
- S03 read hsdd/auto/steps/S02.json outside its read set: The routed items' origin and the target forms the run uses.
- S03 read hsdd/auto/steps/S02.decisions.jsonl outside its read set: The decision line format, first three lines only.
- S04 read hsdd/management/2026-10-30-execution-plan.md outside its read set: C-2 and finding F-3, the precedent for naming the root in an ADR's affects (DEC-035).
- S04 read hsdd/judgement/decisions.jsonl outside its read set: DEC-006, DEC-007, DEC-009, DEC-010, DEC-011, DEC-022 and DEC-023, which the invocation and DEC-025 to DEC-036 rest on.
- S04 read hsdd/auto/steps/S03.json outside its read set: The report shape and the handoff-id target form for routed items.
- S04 read hsdd/conventions.md outside its read set: Planners read contracts, not sibling plans (DEC-032, DEC-034); OQ rules.
- S04 read .claude/skills/hsdd-config/SKILL.md outside its read set: Which ADR sections are injected and which ids get inlined, to keep ids out of Decision and Consequences.
- S04 read hsdd/contract/auth-api.md outside its read set: grep for expiresAt: the existing instant form on the wire (DEC-025).
- S04 read hsdd/contract/fixture/auth-api/login-success.json outside its read set: grep for expiresAt: the exact instant string (DEC-025).
- S04 read hsdd/contract/schema/auth-api.schema.json outside its read set: grep for expiresAt: how the schema types an instant.
- S04 read package.json outside its read set: The toolchain as installed (Node engines, Playwright).
- S04 read backend/package.json outside its read set: The backend's test runner and gate script, for the test-zone consequence.
- S04 read web/package.json outside its read set: The web app's test runner and gate script, for the test-zone consequence.
- S04 read hsdd/scripts/auto/templates/steps/adr.md outside its read set: The step template behind this dispatch.
- S04 read hsdd/scripts/auto/schema/step-report.schema.json outside its read set: This report's schema.
- S04 read hsdd/scripts/auto/routed.mjs outside its read set: grep: how routed targets match steps.
- S04 read hsdd/scripts/auto/decide.mjs outside its read set: grep: the rules the decide command enforces.
- S04 read hsdd/scripts/auto/gate.mjs outside its read set: The checks the step gate runs (first 80 lines).
- S04 read hsdd/scripts/auto/lib/checks.mjs outside its read set: grep: C3's Governed by rule for nodes and contracts.
- S04 read hsdd/scripts/auto/lib/tree.mjs outside its read set: How a node header's and a phase's Governed by are parsed (lines 200 to 300).
- S05 read hsdd/judgement/decisions.jsonl outside its read set: DEC-006, DEC-010, DEC-011, DEC-019, DEC-020, DEC-025, DEC-026, DEC-029 and DEC-030, which the invocation and this step's decisions rest on.
- S05 read hsdd/auto/steps/S04.json outside its read set: The report shape and the handoff-id form of routed targets.
- S05 read hsdd/auto/run.yaml outside its read set: The run's owner facts, prose rules and segment.
- S05 read hsdd/auto/experiments/time-model-postgres/ outside its read set: The 23P01 DETAIL naming one row (Q-010 (2)) and the half-open overlap facts.
- S05 read hsdd/auto/experiments/time-model-intl/README.md outside its read set: London's change days 147 to 217 days apart (Q-010 (1)).
- S05 read backend/package.json outside its read set: The producer's Ajv and test runner versions, to check the schema under the same settings.
- S05 read backend/test/replay.ts outside its read set: The replay rig's fixture format, Ajv settings and body handling, which the new fixture fields extend.
- S05 read backend/test/replay.test.ts outside its read set: How the rig's own tests load fixtures and validate responses.
- S05 read backend/test/contract.replay.test.ts outside its read set: How the gate replays fixtures against the real routes with an injected clock.
- S05 read web/src/test/fetchStub.ts outside its read set: How the web's stub matches fixtures on method and path, for the query-string and 204 notes routed to H16.
- S05 read web/src/test/fetchStub.test.ts outside its read set: The stub's matching rules as tested.
- S05 read package.json outside its read set: Root scripts and workspaces, so the experiment stays out of the build.
- S05 read .gitignore outside its read set: That node_modules and package-lock.json under the experiment are ignored.
- S05 read hsdd/scripts/auto/templates/steps/contract.md outside its read set: The step template behind this dispatch.
- S05 read hsdd/scripts/auto/schema/step-report.schema.json outside its read set: This report's schema.
- S05 read hsdd/scripts/auto/schema/decision.schema.json outside its read set: The decision input's schema.
- S05 read hsdd/scripts/auto/decide.mjs outside its read set: The rules the decide command enforces (lines 40 to 75).
- S05 read hsdd/scripts/auto/gate.mjs outside its read set: The step gate's checks and D1's exemption of step reports (lines 1 to 140, 360 to 420).
- S05 read hsdd/scripts/auto/lib/checks.mjs outside its read set: C3, C4, C5 and C7: governed_by, validation paths, citations and provisional phase ids.
- S05 read hsdd/scripts/auto/lib/report-rules.mjs outside its read set: The code rules a report is held to.
- S05 read hsdd/scripts/auto/dispatch.mjs outside its read set: Lines 125 to 150: the <U+XXXX NAME> notation for a banned character, used in self_check.
- S05 read hsdd/scripts/auto/lib/tree.mjs outside its read set: grep: how governed_by and Governed by are parsed.
- S05 read .claude/skills/hsdd-adr/SKILL.md outside its read set: grep: whether another skill's gate text carries the banned dash.
- S06 read hsdd/judgement/decisions.jsonl outside its read set: DEC-004, DEC-016, DEC-018, DEC-019, DEC-020 and DEC-022, which the routed items and this step's decisions rest on.
- S06 read hsdd/auto/steps/S05.json outside its read set: The report shape, the handoff-id form of routed targets, and how the em dash in a quoted gate was written.
- S06 read hsdd/management/2026-10-30-execution-plan.md outside its read set: C-3's prompt and Validate line (Q-003).
- S06 read hsdd/management/2026-10-30-progress.md outside its read set: Finding F-4 behind C-3.
- S06 read web/src/App.test.tsx outside its read set: That the walk test stubs fetch with auth-api's login-success fixture (C-3's fact).
- S06 read web/src outside its read set: A search for auth-api fixture use, and web/src/session/store.ts for the client-side sign-out and how the web reads expiresAt.
- S06 read hsdd/verify/simple-login.web.3.verification.md outside its read set: That web.3 consumes auth-api@v1 for the sign-in step (C-3).
- S06 read hsdd/verify/simple-login.web.4.verification.md outside its read set: That the web.3 walk runs unchanged in web.4 (C-3).
- S06 read hsdd/verify/simple-login.integration.1.verification.md outside its read set: The observed restart giving the expired-token 401 (DEC-057).
- S06 read hsdd/spec/simple-login.web.md outside its read set: The web phases' Consumes lines and headings, for C-3 and gate check C7.
- S06 read hsdd/spec/simple-login.integration.md outside its read set: integration.2's restart stand-in for AC-2.3 (DEC-057).
- S06 read backend/src/sessions.ts outside its read set: That tokens live in a per-process Map, so a restart ends them (DEC-057).
- S06 read backend/src/routes.ts outside its read set: That the service has no logout endpoint (DEC-058).
- S06 read hsdd/context/rfc-simple-login.md outside its read set: RFC-001 §3, the session model and client-side sign-out since v1.
- S06 read hsdd/context/prd-simple-login.v2.md outside its read set: US-3 and the restart lines of Success and Left to engineering.
- S06 read hsdd/scripts/auto/gate.mjs outside its read set: Which checks the step gate runs.
- S06 read hsdd/scripts/auto/lib/checks.mjs outside its read set: Checks C4, C5 and C7 on contract front matter and citations, for the consumers change.
- S06 read hsdd/scripts/auto/routed.mjs outside its read set: How a routed target matches later steps.
- S06 read hsdd/scripts/auto/lib/report-rules.mjs outside its read set: The report's code rules.
- S06 read .claude/skills/hsdd-reconcile/SKILL.md outside its read set: Who writes consumers and how confirm entries reach them (C-3).
- S06 read .claude/skills/hsdd-config/SKILL.md outside its read set: That a contract id named in a consumed contract's body is inlined as referenced in phase contexts (note below).
- S06 read .claude/skills/hsdd-checkpoint/SKILL.md outside its read set: A search for a rule tying consumers to phase Consumes lines (none found).
- S07 read hsdd/auto/steps/ outside its read set: DEC-007, DEC-015, DEC-016, DEC-027, DEC-036, DEC-059 and DEC-060, which the routed items and this step's decisions rest on.
- S07 read hsdd/auto/steps/S06.json outside its read set: The report shape, the handoff-id form of routed targets, and how the em dash in a quoted gate was written.
- S07 read hsdd/adr/002-time-model.md outside its read set: ADR-002 Decision item 3 (timeZone in the profile), items 4 and 7, and Consequences, which the invocation and Q-011 name.
- S07 read hsdd/contract/booking-api.md outside its read set: How booking-api@v1 describes a room's timeZone and cites PRD v2, for consistent wording (DEC-062).
- S07 read hsdd/contract/schema/booking-api.schema.json outside its read set: The room timeZone pattern reused by DEC-062; the experiment reads it.
- S07 read hsdd/contract/fixture/booking-api/ outside its read set: The room zones the experiment compares the profile's zones with.
- S07 read hsdd/auto/experiments/booking-api-fixtures/ outside its read set: The earlier experiment's package.json and Ajv setup, copied for this experiment.
- S07 read hsdd/auto/experiments/time-model-intl/README.md outside its read set: The runtime facts ADR-002 rests on.
- S07 read hsdd/conventions.md outside its read set: Layout and coding method.
- S07 read .gitignore outside its read set: That the experiment's node_modules and package-lock.json stay out of git.
- S07 read hsdd/spec, hsdd/verify, hsdd/management, hsdd/adr, backend, web/src, e2e outside its read set: A search for citations of profile-api@v2 guarantees by id (none, DEC-064) and for 'six fields' statements.
- S07 read backend/package.json outside its read set: The Ajv versions the backend's replay rig uses, matched by the experiment.
- S07 read backend/test/replay.ts outside its read set: The replay rig's Ajv settings and exact-replay rule, mirrored by the experiment.
- S07 read backend/test/accounts.test.ts outside its read set: That the backend compares its account data with the me-ayu and me-budi fixtures (routed to H14).
- S07 read web/src/api/client.ts outside its read set: That decideProfile ignores unknown fields and fails a profile with a missing field (DEC-065 evidence, routed to H16).
- S07 read web/src/api/client.test.ts outside its read set: That the web's profile cases are literals the new fixtures still meet (routed to H16).
- S07 read web/src/home/HomeScreen.test.tsx outside its read set: That Home's rows tests read the fixtures (routed to H16).
- S07 read e2e/proxy-replay.spec.ts outside its read set: That the integration replays the exact profile fixtures through the proxy (routed to H18).
- S07 read e2e/fixtures.ts outside its read set: profileFixture reads the me-ayu and me-budi bodies (routed to H18).
- S07 read hsdd/scripts/auto/routed.mjs outside its read set: How a routed target matches later steps.
- S07 read hsdd/scripts/auto/lib/checks.mjs outside its read set: Gate checks C4, C5 and C7 on contract front matter (stable needs phase_ids final).
- S07 read hsdd/scripts/auto/lib/report-rules.mjs outside its read set: The report's code rules.
- S08 read hsdd/judgement/decisions.jsonl outside its read set: DEC-005, DEC-006, DEC-008 to DEC-016, DEC-022, DEC-035 to DEC-037, which the invocation, the routed items and this step's decisions rest on.
- S08 read hsdd/auto/queue.jsonl outside its read set: The full text of Q-007 and Q-012.
- S08 read hsdd/auto/steps/S07.json outside its read set: The report shape, the handoff-id form of routed targets, and how an em dash in a quoted gate was written.
- S08 read hsdd/contract/booking-api.md outside its read set: Front matter (owner, consumers, status) for the Isolation strategy's list, and its endpoints and limits, so the root names no endpoint the contract owns.
- S08 read hsdd/contract/auth-api.md, hsdd/contract/profile-api.md, hsdd/contract/profile-api.v2.md, hsdd/contract/INDEX.md outside its read set: Front matter: which contract versions are stable and who consumes them (profile-api@v1 still has live consumers, DEC-071).
- S08 read hsdd/spec/simple-login.web.md, hsdd/spec/simple-login.backend.md outside its read set: A search for the D{n} ids the Decisions section names (web D4 'No router').
- S08 read hsdd/spec/simple-login.integration.md, e2e/login.spec.ts outside its read set: A search for the 3-second success metric the restated criteria drop (DEC-073, routed to H18).
- S08 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/lib/checks.mjs, hsdd/scripts/auto/lib/kinds.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/decide.mjs, hsdd/scripts/auto/schema/decision.schema.json, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: What gate C3 and C5 check on the root, the prose check's scope, how routed targets match, and the report and decision shapes.
- S09 read hsdd/auto/steps/S08.json, hsdd/auto/steps/S08.decisions.jsonl outside its read set: The report shape, how S08 cited restated text (DEC-067) and wrote an em dash in a quoted gate, and DEC-077, which put the exactly-one mechanism in this node's D{n}.
- S09 read hsdd/auto/queue.jsonl (through routed.mjs list) outside its read set: The full text and status of Q-013, Q-017, Q-018 and Q-022, and which items earlier steps closed.
- S09 read hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/dispatch.mjs, hsdd/scripts/auto/lib/checks.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/schema/step-report.schema.json, hsdd/scripts/auto/templates/steps/spec-touch.md, hsdd/auto/run.yaml outside its read set: Why four H14 items reached a spec touch (B-10 matching), what closing them does to H14, what B3 and the C checks require, and the report shape (DEC-085).
- S09 read .claude/skills/hsdd-auto/SKILL.md (Answering a stop, Reviewing a step) outside its read set: How the orchestrator ingests closes and routed entries, to carry the H14 items without losing them.
- S09 read .claude/skills/hsdd-reconcile/SKILL.md (step 4, the version ripple) outside its read set: Which columns of the root's child-node table reconcile writes, for DEC-084.
- S09 read hsdd/judgement/decisions.jsonl outside its read set: A search for an earlier decision on items routed to a later handoff on the same node; none was found.
- S09 read hsdd/contract/booking-api.md, hsdd/contract/profile-api.v2.md, hsdd/contract/profile-api.md outside its read set: The booking endpoints' paths for Owns, the replay's clock and given for the Isolation strategy, G4 and G5 for the Overview, and profile-api@v1's status.
- S09 read hsdd/spec/simple-login.integration.md, hsdd/spec/simple-login.web.md outside its read set: The siblings' Owns lines, so the Compose file and the database get one owner (DEC-081), and the web row of the child table (DEC-084).
- S09 read backend/src/accounts.ts, backend/package.json, package.json outside its read set: Whether the accounts are held in memory and what the root scripts own, before the Overview kept 'in memory'.
- S09 read hsdd/auto/experiments/*/README.md outside its read set: The runtime facts behind ADR-002 and booking-api@v1 that the Overview summarizes.
- S10 read hsdd/auto/steps/S09.json, hsdd/auto/steps/S09.decisions.jsonl, git show 663d5d2 and 36af5a9 outside its read set: How the previous spec touch on a sibling restated its header, cited PRD v2, closed items routed to its phase plan, and how the orchestrator ingested that (Q-027 to Q-033), so this touch follows the same rules.
- S10 read hsdd/auto/queue.jsonl outside its read set: The full text and status of Q-014, Q-019, Q-023 and Q-033, to carry the first three verbatim and avoid duplicating Q-033.
- S10 read hsdd/judgement/decisions.jsonl (DEC-012, DEC-067, DEC-084, DEC-085) outside its read set: Where navigation is decided (D4), the citation rule for restated text, and the earlier choices on the child table and on carried items.
- S10 read hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/lib/checks.mjs, hsdd/scripts/auto/templates/steps/spec-touch.md, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: Why the H16 items matched this step, what the gate checks, and the report shape.
- S10 read .claude/skills/hsdd-phase-plan/SKILL.md outside its read set: Whether append mode writes header lines (it does not), for DEC-093.
- S10 read hsdd/adr/002-time-model.md, hsdd/contract/profile-api.v2.md, hsdd/contract/booking-api.md outside its read set: The decisions and guarantees the Overview, Owns and Isolation strategy restate (ADR-002 Decisions 4, 5, 7 and Consequences; profile-api@v2 G4, G5; booking-api@v1 G7, G16, G18).
- S10 read hsdd/verify/ and main:hsdd/verify/simple-login.web.4.verification.md outside its read set: Whether web.4 has shipped, for the H12 item's account of what is history.
- S11 read hsdd/auto/steps/S09.json, S09.decisions.jsonl, S10.json, S10.decisions.jsonl, git show 663d5d2 and 8938b23 outside its read set: How the sibling spec touches restated their headers, cited PRD v2 and closed items routed to their phase plans, and how the orchestrator ingested that (DEC-087, DEC-096, DEC-097), so this touch follows the same rules.
- S11 read hsdd/auto/queue.jsonl outside its read set: The full text and targets of Q-008, Q-015, Q-020, Q-021, Q-024 and Q-025 to carry verbatim, and Q-031 and Q-033 on the Compose file and the child table.
- S11 read hsdd/adr/001-session-tokens.md, hsdd/adr/002-time-model.md, hsdd/contract/auth-api.md, hsdd/contract/booking-api.md outside its read set: The consequences and guarantees the Owns, Isolation strategy and Overview restate (ADR-001 Consequences and affects; ADR-002 Decision 5 and Consequences; auth-api@v1 G2 to G4; booking-api@v1 G5, G7, G10, G11, G17, Validation).
- S11 read package.json, playwright.config.ts, e2e/fixtures.ts, grep over e2e/*.spec.ts outside its read set: What the shipped rig starts (no database), that it can restart the backend, and where the 3-second assertion lives, for the H18 item.
- S11 read hsdd/verify/ and git ls-tree main -- hsdd/verify outside its read set: Whether simple-login.integration.1 and .2 have shipped, for the H13 item's account of what is history.
- S11 read hsdd/conventions.md (Teams, Main line) outside its read set: single-team, for the Team gate.
- S11 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: What the gate checks and the report shape.
- S12 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: The handoff's record: its Sources and Scope paragraph (who moves the baseline entries, who adds new sections) and H11 to H19.
- S12 read hsdd/auto/run.yaml outside its read set: The baseline and normative sources and the owner facts the dispatch cites.
- S12 read hsdd/auto/queue.jsonl outside its read set: Q-026's full text, and Q-032, Q-033, Q-038 and Q-046, which leave the embedded Sources copies to H11 to H13.
- S12 read hsdd/auto/steps/S08.json, hsdd/auto/steps/S08.decisions.jsonl outside its read set: The preceding touch of this file: what it restated and left, the report shape, and how an em dash in a quoted gate is written.
- S12 read hsdd/auto/steps/*.decisions.jsonl outside its read set: A search for DEC-016 and DEC-071 (profile-api@v1's pending deprecation and why the Isolation strategy lists it); the search also returned DEC-008, DEC-010, DEC-013, DEC-019, DEC-021, DEC-022, DEC-023 and DEC-056.
- S12 read hsdd/scripts/auto/lib/intake.mjs, hsdd/scripts/auto/lib/kinds.mjs, hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/next.mjs, hsdd/scripts/auto/decide.mjs, hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/lib/report-rules.mjs outside its read set: The superseded-string rule, the citation-touch write set (H11 to H13 write only their own file), routed-target matching, and the decision and report rules. A throwaway scan in the session scratchpad applied the superseded-string rule to the touched file; it is not kept in the repository.
- S12 read .claude/skills/hsdd-phase-plan/SKILL.md, .claude/skills/hsdd-reconcile/SKILL.md outside its read set: Who later writes Sources: append mode adds a change request's sections to the node's header, and reconcile's version ripple copies the header's Sources into the root's embedded summary.
- S12 read hsdd/spec/simple-login.backend.md, hsdd/spec/simple-login.web.md, hsdd/spec/simple-login.integration.md outside its read set: Their Sources lines, which equal the embedded copies; simple-login.backend.3's Scope (profile-api@v2 only on GET /api/me); simple-login.web.2's 'per the PRD wireframe'.
- S12 read hsdd/contract/auth-api.md, hsdd/contract/profile-api.md, hsdd/contract/profile-api.v2.md, hsdd/contract/booking-api.md outside its read set: Front matter: which versions are current, that profile-api@v1 is stable and not deprecated, and its producer and consumers.
- S13 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: H11 and the Sources and Scope paragraph: who moves the baseline entries and who adds newly governing sections.
- S13 read hsdd/auto/run.yaml outside its read set: The baseline and normative sources with their versions, checked against the dispatch's facts.
- S13 read hsdd/auto/queue.jsonl outside its read set: The routed items' full texts and kinds, carried verbatim, and the statuses of earlier carries.
- S13 read hsdd/auto/plan.md outside its read set: The step log, to see which steps ran before this one.
- S13 read hsdd/auto/steps/S12.json, hsdd/auto/steps/S12.decisions.jsonl, hsdd/auto/steps/S09.decisions.jsonl outside its read set: The root's citation touch (the embedded copy's mapping, DEC-107, DEC-114) and this file's spec touch (DEC-079 to DEC-088), and the report shape.
- S13 read hsdd/auto/steps/*.decisions.jsonl outside its read set: A search for 'B-10' and 'carried' to find how S09 to S11 and the orchestrator handled items on H14, H16 and H18 (DEC-085, DEC-087, DEC-095, DEC-097, DEC-103, DEC-104); it also returned DEC-082, DEC-091 and DEC-101.
- S13 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/lib/intake.mjs, hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/decide.mjs, hsdd/scripts/auto/lib/report-rules.mjs outside its read set: F2 and the superseded-string rule, the routed-item matching (B-10) and close rules, the decision command, and the report rules.
- S13 read hsdd/spec/simple-login.md outside its read set: simple-login.backend's embedded summary, compared with this file's header after the move.
- S13 read hsdd/contract/auth-api.md, hsdd/contract/booking-api.md, hsdd/contract/profile-api.md, hsdd/contract/profile-api.v2.md outside its read set: Front matter (current versions, profile-api@v1 stable and not deprecated), profile-api's Versioning sections, and booking-api's clock and given lines, to check the Overview and Isolation strategy sentences against current text.
- S13 read hsdd/adr/001-session-tokens.md, hsdd/adr/002-time-model.md outside its read set: Searched for the sessions, restart, instants and clock statements the Overview restates.
- S13 read main:hsdd/verify/ outside its read set: git ls-tree on main: verification docs for simple-login.backend.1 to .3, so every phase of this node is shipped.
- S14 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: H12 and the Sources and Scope paragraph: who moves the baseline entries and who adds newly governing sections.
- S14 read hsdd/auto/run.yaml outside its read set: The baseline and normative sources with their versions, checked against the dispatch's facts.
- S14 read hsdd/auto/queue.jsonl outside its read set: The routed items' full texts and kinds, carried verbatim, and the statuses of earlier carries.
- S14 read hsdd/auto/plan.md outside its read set: The step log, to see which steps ran before this one.
- S14 read hsdd/auto/steps/S13.json, hsdd/auto/steps/S13.decisions.jsonl, hsdd/auto/steps/S12.decisions.jsonl, hsdd/auto/steps/S10.decisions.jsonl outside its read set: The sibling citation touches (DEC-105 to DEC-121), this file's spec touch (DEC-089 to DEC-097), the report shape and the self-check gate strings as S13 wrote them.
- S14 read hsdd/auto/experiments/cites-superseded-targets/README.md outside its read set: How the superseded-string rule treats the bare token 1.
- S14 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: F2, the routed-item matching (B-10) and the report rules and schema.
- S14 read hsdd/spec/simple-login.md outside its read set: simple-login.web's embedded summary, compared with this file's header after the move.
- S14 read hsdd/contract/auth-api.md, hsdd/contract/booking-api.md, hsdd/contract/profile-api.md, hsdd/contract/profile-api.v2.md outside its read set: Front matter (current versions, profile-api@v1 stable and not deprecated, consumers), profile-api@v2 G5, G7 and Versioning, booking-api@v1 G16 and G18, to check the Overview and D1 against current text.
- S14 read hsdd/adr/002-time-model.md outside its read set: Decisions 3 to 7 and Consequences, which the Overview, Owns and Isolation strategy restate.
- S14 read .claude/skills/hsdd-phase-plan/SKILL.md outside its read set: That a phase context carries the D{n} its lines cite, and append mode's rules, to decide whether D1 to D5 are live (DEC-123).
- S14 read hsdd/conventions.md outside its read set: The main line (absent, so main) and the OQ prefixes.
- S14 read main:hsdd/verify/ outside its read set: git ls-tree on main: verification docs for simple-login.web.1 to .4, so every phase of this node is shipped.
- S14 read git log and git diff of hsdd/spec/simple-login.web.md outside its read set: What S10 changed, to see which citations were already at PRD v2.
- S15 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: H13 and the Sources and Scope paragraph: who moves the baseline entries and who adds newly governing sections.
- S15 read hsdd/auto/run.yaml outside its read set: The baseline and normative sources with their versions, checked against the dispatch's facts.
- S15 read hsdd/auto/queue.jsonl outside its read set: The routed items' full texts, targets and kinds, carried verbatim.
- S15 read hsdd/auto/steps/S14.json, hsdd/auto/steps/S14.decisions.jsonl, hsdd/auto/steps/S12.decisions.jsonl, hsdd/auto/steps/S11.decisions.jsonl outside its read set: The sibling citation touches, the root's move of this node's embedded Sources (DEC-107, DEC-108), this file's spec touch (DEC-098 to DEC-103), and the report shape and gate strings.
- S15 read hsdd/auto/steps/*.decisions.jsonl (DEC-016, DEC-053, DEC-081, DEC-087 only) outside its read set: To check the decisions the routed texts cite.
- S15 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: F2 and the report rules and schema.
- S15 read hsdd/spec/simple-login.md outside its read set: simple-login.integration's embedded summary, compared with this file's header after the move.
- S15 read hsdd/spec/simple-login.backend.md outside its read set: Its Owns, to check the Overview's claim that the Compose service and file are the backend's.
- S15 read hsdd/contract/auth-api.md, hsdd/contract/booking-api.md, hsdd/contract/profile-api.md, hsdd/contract/profile-api.v2.md outside its read set: Front matter (current versions, profile-api@v1 stable and not deprecated, consumers, phase_ids), auth-api@v1 G2 to G4, booking-api@v1 G5, G10, G17 and Validation, profile-api@v2 G4 and G7, to check the Overview against current text.
- S15 read hsdd/adr/001-session-tokens.md, hsdd/adr/002-time-model.md outside its read set: affects and Consequences, which the Overview and Isolation strategy restate.
- S15 read hsdd/conventions.md outside its read set: The main line (absent, so main) and the ordering policy the Phase Plan preamble cites.
- S15 read hsdd/management/2026-10-30-execution-plan.md outside its read set: C-1 and A-1, named in the profile-api@v1 consider item.
- S15 read main:hsdd/verify/ outside its read set: git ls-tree on main: verification docs for simple-login.integration.1 and .2, so every phase of this node is shipped.
- S15 read git log and git show f60add9 for hsdd/spec/simple-login.integration.md outside its read set: What S11 changed, to see which citations were already at PRD v2.
- S16 read backend/src/*.ts, backend/test/*.ts, backend/package.json, backend/tsconfig.json, package.json, .gitignore outside its read set: The shipped code the appended phases change: the replay rig, the accounts tests, the gate scripts and buildApp, to size the phases and name the files (Q-052, Q-054 cite them).
- S16 read hsdd/spec/simple-login.md outside its read set: The root's embedded summary and Decisions (what is the backend's D{n}), a shared decomposition artifact.
- S16 read hsdd/spec/simple-login.integration.md outside its read set: Header and Overview only (not its phase plan), to see how the integration node starts the database through this node's Compose service (Q-055).
- S16 read hsdd/verify/simple-login.backend.3.verification.md outside its read set: To confirm phase 3 is shipped and what its replay covered.
- S16 read hsdd/auto/run.yaml, hsdd/auto/experiments/*/README.md, hsdd/auto/experiments/time-model-postgres/ outside its read set: The run's sources and the earlier experiments the routed items cite.
- S16 read hsdd/auto/steps/S13.json, hsdd/auto/steps/S05.decisions.jsonl (DEC-053) outside its read set: The origin of the routed items and of the provisional produced_by guess.
- S16 read .claude/skills/hsdd-reconcile/SKILL.md outside its read set: How confirm and note entries are drained, to write them in the form reconcile applies.
- S16 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/lib/checks.mjs, hsdd/scripts/auto/lib/tree.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: To make the plan and this report pass the step gate (phase headings, pending entries, report rules, routed targets).
- S17 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: The handoff order (H16 to H19 still to come for the consumers of booking-api@v1) and its insert rule, to decide whether the amend triggers a phase-plan-append on simple-login.backend.
- S17 read hsdd/auto/steps/S16.json, hsdd/auto/steps/*.decisions.jsonl (DEC-053, DEC-138, DEC-145) outside its read set: Why produced_by was a provisional guess, what S16 routed to H18 about the database, and the reasoning behind the amend.
- S17 read git show e84ae36:hsdd/spec/simple-login.md, git show e84ae36:hsdd/spec/simple-login.{backend,web,integration}.md outside its read set: Whether the child-node table's Purpose column was ever a verbatim copy of each header (DEC-153).
- S17 read backend/test/replay.ts (its Ajv lines) outside its read set: The Ajv settings the experiment reproduces.
- S17 read hsdd/auto/experiments/booking-api-fixtures/check.mjs outside its read set: Reused its endpoint mapping and ran it unchanged against the amended schema.
- S17 read .claude/skills/hsdd-contract/SKILL.md outside its read set: Its versioning policy and unattended table for a breaking change to a draft contract, which reconcile's step 5 and 6 apply under.
- S17 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/lib/checks.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/routed.mjs, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: What the step gate checks, and which targets a routed item can take.
- S18 read web/src/api/client.ts, web/src/api/types.ts, web/src/App.tsx, web/src/App.test.tsx (first 60 lines), web/src/session/flow.ts, web/src/session/store.ts, web/src/messages.ts, web/src/test/fetchStub.ts, web/src/test/fetchStub.test.ts, web/src/test/setup.ts, web/src/home/HomeScreen.tsx, web/src/home/memberSince.ts, web/src/main.tsx, web/package.json, web/vite.config.ts, web/tsconfig.json outside its read set: The shipped code the appended phases extend; Q-061 and Q-062 name fetchStub.ts and decideProfile, and the sizes, file names and the existing 'two fixtures for one route' refusal shape web.5's Scope.
- S18 read hsdd/spec/simple-login.backend.md (its Phase Plan section) and git show b33b424:hsdd/spec/simple-login.backend.md (S16's pending section) outside its read set: Read for the append-mode format the segment's other phase-plan-append used (append paragraph, sizing-floor note, confirm entries keeping a shipped phase). hsdd-phase-plan's sibling isolation says a sibling's phase-plan sections are not to be read; nothing in this plan depends on their content beyond what the contracts and conventions.md state, and DEC-174 cites the confirm-list precedent from that read.
- S18 read hsdd/auto/steps/S17.json; hsdd/auto/steps/*.decisions.jsonl (DEC-012, DEC-016, DEC-031 to DEC-034, DEC-053, DEC-089 to DEC-095, DEC-122 to DEC-128) outside its read set: booking-api@v1's draft and consumer-side state after the backend's reconcile, and the reasons behind the routed items Q-058 to Q-064.
- S18 read hsdd/auto/experiments/time-model-intl/ (README.md, probe.mjs) outside its read set: The runtime facts ADR-002 rests on, which the new experiment builds on.
- S18 read hsdd/scripts/auto/gate.mjs (head), hsdd/scripts/auto/lib/checks.mjs, hsdd/scripts/auto/lib/tree.mjs (phase parsing), hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/schema/step-report.schema.json, hsdd/scripts/auto/decide.mjs (head) outside its read set: What the step gate checks in a spec and a report, and the decision record's rules.
- S18 read package.json, .gitignore outside its read set: The root test script that runs the web gate, and whether any node_modules were installed for a Vitest experiment (none are).
- S19 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: The handoff order (H18 and H19 still to come for the integration side of booking-api@v1) and its insert rule, to decide whether this reconcile triggers an inserted step.
- S19 read hsdd/auto/steps/S17.json, hsdd/auto/steps/S17.decisions.jsonl, git show 4d3f106 outside its read set: How the previous reconcile in this segment treated the version ripple, the child table's Purpose column (DEC-152, DEC-153) and booking-api@v1's flip, so this one stays consistent.
- S19 read hsdd/scripts/auto/schema/step-report.schema.json outside its read set: The report's required fields.
- S20 read package.json outside its read set: this node's shipped root scripts, which simple-login.integration.3 changes
- S20 read playwright.config.ts outside its read set: this node's shipped Playwright config, which .3 changes
- S20 read README.md outside its read set: this node's shipped run instructions, which .3 rewrites
- S20 read scripts/dev.mjs outside its read set: this node's dev runner: how it starts and stops npm children in process groups (DEC-183, DEC-184)
- S20 read scripts/dev.test.mjs outside its read set: this node's dev runner test, to see what it needs once the service needs PostgreSQL
- S20 read e2e/fixtures.ts outside its read set: this node's backend fixture and helpers, which .3 changes
- S20 read e2e/home.spec.ts outside its read set: this node's shipped Home tests, which .4 extends
- S20 read e2e/login.spec.ts outside its read set: the 3-second assertion Q-072 names
- S20 read e2e/proxy-replay.spec.ts outside its read set: the shipped proxy replay and its count check, which .3 extends
- S20 read hsdd/auto/experiments/booking-api-fixtures/ outside its read set: README and check.mjs: the reference model the replay experiment copies, and the 217-day horizon finding Q-069 cites
- S20 read hsdd/auto/experiments/booking-store-postgres/README.md outside its read set: the Compose and per-database facts Q-074 cites
- S20 read hsdd/auto/experiments/web-time-display/ outside its read set: README, output.txt and probe.mjs: the display rules and strings Q-077 cites, reused by the clock-change experiment
- S20 read hsdd/auto/experiments/time-model-intl/README.md outside its read set: the Intl facts ADR-002 rests on
- S20 read hsdd/auto/steps/S18.json outside its read set: the head of the file, as an example of the report format; it carries the web plan's self-check notes, which this plan does not rely on (its cross-node ids come from the contracts' front matter)
- S20 read hsdd/scripts/auto/gate.mjs outside its read set: with lib/checks.mjs, lib/report-rules.mjs, part of lib/tree.mjs, the head of decide.mjs and schema/step-report.schema.json: what the step gate checks
- S20 read .gitignore outside its read set: whether the experiments' node_modules are ignored
- S20 read git log b33b424 67f2701 d86830b outside its read set: the S16, S18 and S19 commit subjects, for the sibling phase ranges; only S18's (web.5 to web.9) named one
- S21 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: The H19 handoff and its insert rule, to decide whether the request's answer or the flip triggers an inserted step (DEC-201).
- S21 read hsdd/auto/steps/S17.json, hsdd/auto/steps/S19.json, hsdd/auto/steps/S20.json, hsdd/auto/steps/S17.decisions.jsonl, hsdd/auto/steps/S19.decisions.jsonl outside its read set: How this segment's earlier reconciles treated the version ripple, the DAG and the Local database section, and what S20 already routed about the request, so this step stays consistent and does not duplicate a routed item.
- S21 read hsdd/auto/experiments/booking-store-postgres/ (README.md, per-file-database.mjs, compose.yaml) outside its read set: Evidence for the request's answer: the Compose user creates a database and then btree_gist and the booking table in it (DEC-198).
- S21 read .claude/skills/hsdd-contract/SKILL.md (Versioning Policy) outside its read set: Step 5 applies the request's answer under hsdd-contract rules; read to classify the edit.
- S21 read hsdd/scripts/auto/schema/step-report.schema.json outside its read set: The report's required fields.
- S23 read hsdd/auto/queue.jsonl outside its read set: The full text and status of Q-075 to Q-083, and which items were routed where.
- S23 read hsdd/auto/plan.md, hsdd/auto/steps/S22.decisions.jsonl outside its read set: Which handoffs are done (no pending phase-plan step on simple-login.backend) and how S22 routed consistency items.
- S23 read hsdd/auto/steps/S09.json, hsdd/auto/steps/S09.decisions.jsonl, hsdd/auto/steps/S13.json, hsdd/auto/steps/S15.json outside its read set: How an earlier spec touch closed items whose content is Phase Plan (DEC-085), and how earlier reports quoted gates holding the banned dash.
- S23 read hsdd/judgement/decisions.jsonl outside its read set: DEC-182, DEC-183, DEC-198 and DEC-199, which the routed items cite.
- S23 read hsdd/scripts/auto/templates/steps/spec-touch.md, hsdd/scripts/auto/templates/steps/phase-plan-append.md, hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/commit.mjs, hsdd/scripts/auto/lib/report-rules.mjs, hsdd/scripts/auto/schema/step-report.schema.json, hsdd/scripts/auto/schema/run-line.schema.json outside its read set: Which step kind can rewrite an unshipped phase, the insertable kinds, the report rules, and whether an empty artifact commit is allowed.
- S23 read .claude/skills/hsdd-auto/SKILL.md (Inserted steps), .claude/skills/hsdd-phase-plan/SKILL.md (append mode) outside its read set: How an insert-step is accepted, and that append mode may rewrite an unshipped phase in place when the invocation names it (DEC-205).
- S23 read hsdd/spec/simple-login.integration.md, hsdd/contract/booking-api.md outside its read set: simple-login.integration.3's Scope and Dependencies, and booking-api@v1's Development address, Validation and Versioning lines, which the items cite.
- S23 read hsdd/verify/ (listing) outside its read set: Whether simple-login.backend.7 has shipped (it has not).
- S23 read backend/test/server.test.ts, package.json, e2e/fixtures.ts, scripts/dev.mjs outside its read set: The shipped `start` test, the root `test` order, and how the shipped rig starts the service, for DEC-205 and DEC-206.
- S23 read backend/src/server.ts outside its read set: That `start` is the only place the service listens, for the restated clause (DEC-208).
- S24 read hsdd/auto/queue.jsonl outside its read set: Q-084, the insert-step this step was inserted for (front matter queue_item), and Q-080 behind it
- S24 read hsdd/auto/plan.md outside its read set: DEC-209 in the change log, which accepted Q-084 as an in-place rewrite of simple-login.backend.7
- S24 read hsdd/auto/run.yaml outside its read set: the segment's sources and the request path, to confirm the Sources entry
- S24 read hsdd/judgement/decisions.jsonl outside its read set: DEC-198, DEC-199, DEC-205, DEC-206 and DEC-209, the decisions that led to this step
- S24 read .claude/skills/hsdd-auto/scripts/templates/steps/phase-plan-append.md outside its read set: to see why the invocation names no phase: it is the kind's default text
- S24 read .claude/skills/hsdd-auto/scripts/dispatch.mjs outside its read set: how the invocation is rendered for a step with no handoff (lines 330 to 410)
- S24 read .claude/skills/hsdd-auto/scripts/gate.mjs outside its read set: the check list and the closes rule, so the report does not close the accepted Q-084
- S24 read .claude/skills/hsdd-reconcile/SKILL.md outside its read set: how reconcile treats a pending section with no entry, for DEC-214
- S24 read hsdd/auto/steps/S16.json outside its read set: the report shape of the earlier append on this node
- S24 read backend/src/server.ts outside its read set: the shipped `start(port)` the rewrite extends (DEC-211)
- S24 read backend/test/server.test.ts outside its read set: the shipped `start` test the rewrite folds in
- S24 read backend/package.json outside its read set: the shipped `start` script
- S24 read hsdd/auto/experiments/booking-store-postgres/ outside its read set: S16's experiment: what it already settled about a database per test file, and its Compose setup reused for this step's experiment
- S25 read hsdd/auto/plan.md outside its read set: The step log and DEC-209, to see why this reconcile was inserted after S24.
- S25 read hsdd/auto/queue.jsonl outside its read set: Q-084 and Q-085, the insert-steps behind S24 and this step, to confirm nothing is routed to S25 for `closes`.
- S25 read hsdd/judgement/decisions.jsonl outside its read set: DEC-215 and DEC-216: the orchestrator's attempt to reject Q-085 and its decision to let this step run and stamp the section.
- S25 read hsdd/auto/steps/S17.decisions.jsonl, hsdd/auto/steps/S21.json, hsdd/auto/steps/S24.json, hsdd/auto/steps/S24.decisions.jsonl outside its read set: How this segment's earlier reconciles dated the stamp and ran the ripple, and DEC-214, which says the emission block carries no entry.
- S25 read hsdd/scripts/auto/gate.mjs, hsdd/scripts/auto/schema/step-report.schema.json outside its read set: The checks the gate runs and the report's required fields.
- S26 read hsdd/contract/booking-api.md outside its read set: Check that the Development address holds S21's answer (tables created in an empty database before the service listens; rooms are not rows) and the 2026-11-01 Versioning entry.
- S26 read hsdd/spec/simple-login.backend.md outside its read set: grep for the request-entry wording outside the target; read the 2026-11-01 rewrite note on simple-login.backend.7.
- S26 read hsdd/conventions.md, git ls-tree main hsdd/verify/ outside its read set: Confirm simple-login.integration.3 is unshipped (no verification doc on the main line).
- S26 read hsdd/management/2026-10-31-intake-prd-simple-login-v2.md outside its read set: The handoff list and the insert rule, to judge whether the request answer requires a phase-plan-append on this node.
- S26 read hsdd/auto/queue.jsonl, hsdd/auto/plan.md outside its read set: Full text and history of Q-078 to Q-085 and which steps have run; whether any later step touches simple-login.integration.
- S26 read hsdd/auto/steps/S23.json, hsdd/auto/steps/S23.decisions.jsonl outside its read set: Precedent: how the spec touch on simple-login.backend closed items whose content is Phase Plan and routed an insert-step.
- S26 read hsdd/judgement/decisions.jsonl, hsdd/judgement/run.jsonl outside its read set: DEC-198's text and the recent step log.
- S26 read .claude/skills/hsdd-auto/SKILL.md (sections 8 and Inserted steps) outside its read set: Whether the align stage would touch this re-planned leaf-parent later, and how an insert-step is routed and accepted.
- S27 read hsdd/auto/queue.jsonl outside its read set: Q-086, the insert-step this step was inserted for (front matter queue_item), and Q-081 behind it
- S27 read hsdd/auto/plan.md outside its read set: the step log and DEC-222 in the change log, which accepted Q-086 as an in-place rewrite with no reconcile
- S27 read hsdd/auto/run.yaml outside its read set: the segment's sources and request path, to confirm the Sources entry
- S27 read hsdd/judgement/decisions.jsonl outside its read set: DEC-198, DEC-199, DEC-221 and DEC-222, the decisions that led to this step
- S27 read hsdd/auto/steps/S24.json, hsdd/auto/steps/S24.decisions.jsonl outside its read set: precedent: the same in-place rewrite on simple-login.backend.7 under a default invocation (DEC-210, DEC-214) and its report shape
- S27 read hsdd/auto/steps/S26.json outside its read set: the report that routed Q-086 and its note on the rooms clause
- S27 read git show 14073d3 -- hsdd/spec/simple-login.backend.md outside its read set: the form of S24's rewrite paragraph and emission line, to keep the two plans alike (DEC-224); this is a sibling's phase-plan section, read for format only, and nothing in integration.3 rests on it
- S27 read hsdd/spec/simple-login.backend.md (D3, lines 130 to 133) outside its read set: to check the rooms claim DEC-222 cites; D3 sits in the sibling's Phase Plan section, and the rewritten sentence cites only booking-api@v1's Development address
- S27 read hsdd/scripts/auto/gate.mjs outside its read set: the check list and the closes rule
- S28 read hsdd/auto/queue.jsonl (Q-082) outside its read set: The routed item's full text and status.
- S28 read hsdd/judgement/decisions.jsonl (DEC-203) outside its read set: How the orchestrator framed the fix: the cells should match the touched embedded summaries.
- S28 read hsdd/auto/steps/S10.json, hsdd/auto/steps/S27.json outside its read set: The report shape and how earlier reports quote gates whose text holds a banned character.
- S29 read hsdd/auto/queue.jsonl (Q-064, Q-076, Q-083) outside its read set: The routed item's full text and its history from S14 and S18.
- S29 read hsdd/auto/steps/S28.json, hsdd/auto/steps/S28.decisions.jsonl outside its read set: The report shape and how an earlier report quotes gates whose text holds a banned character.
- S24 is an inserted step for Q-084 (phase-plan-append on simple-login.backend): From S23 (Q-080, DEC-205). Rewrite the unshipped phase simple-login.backend.7 in place (hsdd-phas...
- S25 is an inserted step for Q-085 (reconcile on simple-login.backend): Reconcile simple-login.backend after Q-084's in-place rewrite of simple-login.backend.7, per the...
- S27 is an inserted step for Q-086 (phase-plan-append on simple-login.integration): From S26 (Q-081, DEC-221). Rewrite the unshipped phase simple-login.integration.3 in place (hsdd-...
- As of this report run, the final gate reports 0 warnings.

<!-- slot:record_gaps -->
- The generated list above covers reads outside each step's read set and the one resume. It leaves out three protocol slips recorded as decisions: S18 edited one word of a minted decision after the fact and read a sibling's phase plan (DEC-176); S27 read a sibling's D3 to check a claim (DEC-226); DEC-149's prose overstates an experiment's rounds, corrected by DEC-150.
- It also leaves out the routing churn: items routed to a node's phase-plan handoff were handed to every earlier step on that node (build decision B-10), which closed them as explained and carried copies forward (DEC-087); every carried text is verbatim and reached its handoff.
- An accepted insert-step cannot be withdrawn, so S25 ran a reconcile with nothing to drain (DEC-215, DEC-216).
- The final gate reports no F2 line: no live text cites a superseded contract version. `profile-api@v1` is still cited in ten places, each a live earlier version under `coexisting`, which the gate correctly does not count.
<!-- /slot -->

## Deferred findings

None.

## How to review

Read this report, then the decisions under "Decisions to look at first" in the
ledger. Record one line per decision in
`hsdd/judgement/decision-reviews.jsonl` (spec section 6.8). Each step is two
commits, `hsdd: {step} ...` then `judgement: {step}`.
