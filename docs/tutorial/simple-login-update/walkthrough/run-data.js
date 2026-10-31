// simple-login update walkthrough: the recorded facts of the run, from the
// ledgers, the verification docs and git (see process-log.md). Values only.
"use strict";
window.WALK_RUN = {
  // Minutes after 13:00 WIB, 30 October 2026.
  axis: { start: 10, end: 55, ticks: ["13:10", "13:20", "13:30", "13:40", "13:50"] },
  phases: [
    {
      id: "simple-login.backend.3", lane: "backend", tier: "spot-check", start: 12, end: 22, clock: "13:12 to 13:22 (10 min, 5 of them the fresh review)", tasks: 2,
      plan: "docs/superpowers/plans/2026-10-30-simple-login.backend.3.md",
      red: "6 tsc errors and 5 of 72 tests (the v2 profiles have no phone yet)",
      tests: "72, plus the replay: auth-api ×5, profile-api.v2 ×5, no v1",
      diff: "41 lines: source +6 −2, tests +24 −9",
      review: "fresh reviewer: 0 critical, 0 important, 3 minor (deferred); two mutations caught by the gate",
      wrong: ["A routes test passed before the change: toProfile already copies every field but password. Kept as AC-2.4's guard and ledgered."],
      outstanding: "the red root npm test: deferred to simple-login.integration.2",
      learning: "v1 has no producer but stays stable until its consumers migrate (dropped: the closure handles it); toProfile is a denylist (dropped: the key-set test covers it)",
      signoff: "Claude as owner proxy, spot-check: diff glanced, gate and replay green from a clean install",
    },
    {
      id: "simple-login.web.4", lane: "web", tier: "spot-check", start: 13, end: 35, clock: "13:13 to 13:35 (22 min)", tasks: 4,
      plan: "docs/superpowers/plans/2026-10-30-simple-login.web.4.md",
      red: "three times: the stub's refusal test, then 7 tests, then 7 tests, each before its code",
      tests: "90 (79 before), types and build",
      diff: "151 lines: product +19 −10, tests and the fixture stub +102 −20",
      review: "fresh reviewer: 0 critical, 0 important, 5 minor; no fix pass",
      wrong: [
        "The request's Screen was not in the context: the Scope pointed at it, the Links did not name it. The agent found it through the node's Sources and ledgered the read. Fixed in v0.10.2: phase planning checks that no line leans on a pointer to text the context does not carry.",
        "Headless Chrome on macOS will not lay a page out under ~500 px, so the plan's 360 px check would have tested nothing. Rendered in a 360 px iframe instead.",
      ],
      outstanding: "the walk against the real backend: deferred to simple-login.integration.2; the 360 px eyeball: verified from screenshots",
      learning: "the missing Screen (dropped: a shipped Scope is not rewritten; logged as a finding about phase planning)",
      signoff: "Claude as owner proxy, spot-check: diff glanced, gate green, 360 px screenshots looked at",
    },
    {
      id: "simple-login.integration.2", lane: "integration", tier: "spot-check", start: 37, end: 52, clock: "13:37 to 13:52 (15 min, 9 of them the fresh review)", tasks: 3,
      plan: "docs/superpowers/plans/2026-10-30-simple-login.integration.2.md",
      red: "against the pre-web.4 app: 3 of 6 browser tests; then the replay set and v1's two profiles",
      tests: "npm test: backend 72, replay 10, web 90, runner 3, browser 20",
      diff: "54 lines: tests +37 −7, README +5 −5",
      review: "fresh reviewer: 3 minor; one re-graded Important by effect and fixed test-first",
      wrong: ["Playwright's exact: true normalizes whitespace: a web app writing non-breaking spaces passed 'exactly as stored'. Now an anchored raw-text match."],
      outstanding: "none: the red root build and the real-backend walk, deferred here, both ran",
      learning: "exact: true is not exact (dropped: a testing technique, recorded for the next browser phase)",
      signoff: "Claude as owner proxy, spot-check: npm test green, ports free, screenshots looked at",
    },
  ],
  redWindow: {
    failed: 2, failedWhat: "the proxy replay of v1's me-ayu and me-budi; each diff is one extra line.",
    passed: 16, passedWhat: "every acceptance-criterion test. The v1 web app reads the five fields it knows and ignores phone, so the product kept working.",
  },
  lanes: {
    present: [
      "backend.3 (2 tasks) ran in this session; web.4 (4 tasks) ran at the same time as a separate agent, in a worktree cut from this branch, with only its two context files as its specification.",
      "Every task's failing test was seen to fail first. backend.3: 6 tsc errors and 5 failing tests; web.4: three red runs, one per task.",
      "Each phase got superpowers' fresh final review: 0 critical and 0 important in both lanes.",
      "Between backend.3 and integration.2 the build was red exactly where the planners said: the contract replay, not the product.",
    ],
    say: [
      "The web lane never looked at the backend. It built against the v2 fixtures that hsdd-contract had written eleven minutes earlier.",
      "Look at the red window panel: 16 green, 2 red. The product kept working; only the contract replay noticed. That is what the replay is for.",
    ],
  },
  integration: {
    present: [
      "The integration node waits for both lanes (hard edges), then runs the real service and the real web app.",
      "The phone numbers in the browser test are read from profile-api@v2's fixtures at test time, so the test and the contract cannot disagree.",
      "The proxy replay moved to v2: nine exact fixtures, four auth-api and five profile-api.v2, checked by a test of its own.",
      "npm test is green again: backend 72, replay 10, web 90, runner 3, browser 20.",
    ],
    wrong: [
      "web.4 had merged before integration.2's red step, so the red run borrowed the pre-web.4 web app for one run [owner proxy]: 3 browser tests failed on the missing phone. Since v0.10.2 the test-first rule says so: fail against the tree before the merged dependency, or a named mutant.",
      "The fresh reviewer found that exact: true collapses whitespace: a web app writing non-breaking spaces passed. Re-graded Important and fixed test-first.",
    ],
    say: ["Mutation testing is cheap here: change one line of the web app and watch which criterion fails."],
  },
  screens: [
    { url: "localhost:5173", src: "screens/home-ayu.png", alt: "Home for Ayu Lestari: username ayu, email ayu@example.com, phone +62 812 3456 7890, member since 14 March 2024.", caption: "AC-2.1 and AC-2.4, real backend, real browser" },
    { url: "localhost:5173", src: "screens/home-budi.png", alt: "Home for Budi Santoso: username budi, email budi@example.com, phone +62 813 9876 5432, member since 9 January 2025.", caption: "Budi sees his own number" },
  ],
  checkpoint: {
    present: [
      "A fresh agent ran the project's first checkpoint, cold. As a first run it also applied the adoption behaviors: the first progress report, execution plan and atlas.",
      "It found the three phases whose Scope cites the intake record, appended them to Produced, checked each has its verification doc, and closed the record. hsdd-intake never closes its own record.",
      "It re-ran npm test green, re-generated the registries into a copy (identical), and found nine issues: two Medium, seven Low.",
      "F-1: profile-api@v1 is still stable with no producer. F-2: all nine sign-offs, the first run's included, are the owner proxy's. Both go to a sync as decisions, not to a fix.",
    ],
    wrong: ["The checkpoint's own audit counted the proxy sign-offs as done (it checks that the fields are filled) and raised F-2 separately: the template says the human signs, the audit does not check who. Fixed in v0.10.2: a delegated sign-off names the person, counts as done and goes to them in one finding."],
    say: [
      "The change is closed when the record says so, not when the code merges. The record is the one place the change is visible as one unit of work.",
      "The leftover work (v1's sunset, the proxy sign-offs) is now on next week's agenda with an owner, instead of in someone's head.",
    ],
    steps: [
      ["1. Baselines", "Pinned the commit every conclusion reads from: a82f99a. HEAD moved during the run (a walkthrough commit); the diff under the project root was empty, so both hold.", []],
      ["2. Evidence", "Registries, dangling references, open questions, pending sections, verification docs, the grandfather audit (set: empty), intake records. Then npm test: backend 72, replay 10, web 90, runner 3, browser 20.", []],
      ["3. Close the intake", "Three phases cite the record in their Scope; each has its verification doc on the main line. Produced gains them; Status: closed (2026-10-30).", ["hsdd/management/2026-10-30-intake-add-phone.md"]],
      ["4. Report and plan", "Nine phases done of nine. Nine findings, eight steps, five decisions for a proposed Sync A on Monday 2 November.", ["hsdd/management/2026-10-30-progress.md", "hsdd/management/2026-10-30-execution-plan.md"]],
      ["5. Atlas", "The first atlas: the tree, contracts and decisions on one page, regenerated whole by every checkpoint from now on. The next intake reads it to find its landing.", ["hsdd/management/atlas.md"]],
    ],
    findings: [
      ["F-1", "Medium", "profile-api@v1 is stable with no producer; its 'exactly the five fields' guarantee is false.", "A-1 (sunset date), then hsdd-contract"],
      ["F-2", "Medium", "All nine sign-offs, waivers and dropped Learnings are the owner proxy's.", "A-2 (ratify or re-review), then the owner"],
      ["F-3", "Low", "ADR-001's affects omits the root, which says Governed by ADR-001.", "hsdd-adr"],
      ["F-4", "Low", "auth-api@v1's consumers omits web.3 and web.4, whose App tests read its fixture.", "hsdd-contract"],
      ["F-5", "Low", "OQ1 waits on product but links no external track.", "hsdd-reconcile"],
      ["F-6", "Low", "Nobody has checked a screen reader announces the Login messages.", "the web lane, before the sync"],
      ["F-7", "Low", "integration.1's AC-1.2 tests use exact: true, the same whitespace blind spot.", "A-3"],
      ["F-8", "Low", "The integration docs cite screenshots outside the project root.", "waived, with a reason"],
      ["F-9", "Low", "No management layer existed.", "closed by this run"],
    ],
  },
  metrics: {
    stats: [["25", "source lines added"], ["163", "test lines added"], ["1,880", "process lines written"], ["1 h 13 min", "change request to closed record"]],
    rows: [
      { label: "intake + contract", prod: 0, proc: 530 },
      { label: "backend.3", prod: 41, proc: 218 },
      { label: "web.4", prod: 151, proc: 380 },
      { label: "integration.2", prod: 54, proc: 199 },
      { label: "checkpoint", prod: 0, proc: 553 },
    ],
    note: "Process here: the intake record, contract v2 with schema and fixtures, spec edits, plans and verification docs, and the checkpoint's report, plan and atlas. The generated phase contexts (1,610 lines) are not in the bars.",
  },
  worth: {
    present: [
      "25 lines of source and 163 of tests, against 1,880 lines of process. For one displayed field the process outweighs the code by far more than in the first run: most of HSDD's cost is per phase and per contract version, not per line.",
      "What it bought is in the table: a breaking change named before any code, a red build predicted to the test, a context gap and two test blind spots caught, and a change that ends as a closed record with its leftovers on an agenda.",
      "The cheapest saving is upstream: v1's closed, versioned policy made a display field a new version. v2 is additive-only, so the next optional field is an amend with no version and no migration.",
    ],
    say: [
      "Be honest with the room: for a change this size, HSDD is heavy. Its value shows when the seam is shared, the teams are separate, or the change will be followed by others.",
      "Ask: which of these catches would your team have made, and when?",
    ],
  },
  catches: [
    ["One display field is a breaking change: v1 is versioned with a closed schema", "intake, before any plan", "hsdd-intake reading the contract"],
    ["Seven texts still named the old version", "contract step, then planning", "the bump, then all three planners"],
    ["The build would be red between backend.3 and integration.2", "planning, before any code", "the integration and web planners"],
    ["v2 said additive-only but closed its schema", "planning", "two planners; settled at reconcile"],
    ["The red window, observed: the replay failed, the product kept working", "between the lanes", "the browser suite"],
    ["The request's Screen was not in web.4's context", "execution", "the web lane agent"],
    ["Headless Chrome will not lay out under ~500 px", "execution", "the web lane agent"],
    ["exact: true lets non-breaking spaces through", "integration.2's final review", "a fresh reviewer"],
    ["v1 still stable with no producer; nine proxy sign-offs", "closure", "hsdd-checkpoint"],
  ],
  findings: [
    "hsdd-intake has no authority value for an approved PRD amendment, the most ordinary change. Fixed in v0.10.2: `approved PRD` is an authority value.",
    "Two live versions of one contract: hsdd-contract names one file per slug, so where v2 lives beside v1 is left to the run. Fixed in v0.10.2: a later version is a new file beside the first, `{slug}.v{n}.md`, with its schema and fixtures named the same way; nothing is renamed.",
    "A version bump's ripple has no owner: node Produces and Consumes, the root's copies, matrix and DAG; append mode edits only Sources and no pending entry carries a spec change. Fixed in v0.10.2: append mode leaves the node header alone, and reconcile writes a confirmed version into the header and every copy above it.",
    "One endpoint cannot serve two versions: the deprecation window collapses to the intake, and v1 stays stable with no producer until someone deprecates it. Fixed in v0.10.2: the migration note names its mode; under `lockstep` the old version is deprecated at the bump, with its sunset when the new version's producer ships, and the checkpoint flags a `stable` version nothing serves.",
    "A migrated version never loses its consumers: nothing removes a phase that migrated, so 'no live consumer' cannot be read from frontmatter. Fixed in v0.10.2: the checkpoint reports migrated phases and reconcile moves them from `consumers` to `former_consumers`, so `consumers` means live.",
    "'The request's path' joins Sources: the intake record or the change request? Every planner had to choose. Fixed in v0.10.2: the change request's own path joins Sources; the intake record goes in the Scope.",
    "A Scope that points at a source ('per the request's Screen') leaves the phase without the content; nothing checks the rule that says to inline it. Fixed in v0.10.2: hsdd-phase-plan states that the context carries no source text and checks that no line leans on a pointer, and hsdd-config now injects the node decisions a phase cites.",
    "The sizing floor fires on every small appended phase, with no partner to merge with because the neighbour shipped. Fixed in v0.10.2: in append mode the floor runs over the appended phases only.",
    "'On spec-repo main' decides shipped-ness and closure, and needs a ruling when the main line is a branch. Fixed in v0.10.2: conventions name the main line (`**Main line:**`, `main` when absent).",
    "v0.10.1's referenced full text puts the old version into every migration phase's context (~250 lines each). No change in v0.10.2: kept, and watched.",
    "An integration phase starts after its dependencies merge, so 'see it fail' needs an older tree to fail against. Fixed in v0.10.2: the context's test-first rule says to fail against the tree before the merged dependency, or against a named mutant.",
    "The template says the human signs; the checkpoint's audit checks only that the fields are filled. Fixed in v0.10.2: a delegated sign-off names the person it answers to, counts as done, and goes to that person in one checkpoint finding to ratify; a sign-off that names no person leaves the phase a claim.",
  ],
};
