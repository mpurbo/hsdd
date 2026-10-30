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
        "The request's Screen was not in the context: the Scope pointed at it, the Links did not name it. The agent found it through the node's Sources and ledgered the read.",
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
      "web.4 had merged before integration.2's red step, so the red run borrowed the pre-web.4 web app for one run [owner proxy]: 3 browser tests failed on the missing phone.",
      "The fresh reviewer found that exact: true collapses whitespace: a web app writing non-breaking spaces passed. Re-graded Important and fixed test-first.",
    ],
    say: ["Mutation testing is cheap here: change one line of the web app and watch which criterion fails."],
  },
  screens: [
    { url: "localhost:5173", src: "screens/home-ayu.png", alt: "Home for Ayu Lestari: username ayu, email ayu@example.com, phone +62 812 3456 7890, member since 14 March 2024.", caption: "AC-2.1 and AC-2.4, real backend, real browser" },
    { url: "localhost:5173", src: "screens/home-budi.png", alt: "Home for Budi Santoso: username budi, email budi@example.com, phone +62 813 9876 5432, member since 9 January 2025.", caption: "Budi sees his own number" },
  ],
  checkpoint: {
    present: ["(filled after the checkpoint)"],
    wrong: [],
    say: [],
    steps: [["Pending", "The checkpoint has not run yet.", []]],
    findings: [],
  },
  metrics: {
    stats: [["3", "phases appended"], ["1", "contract version"], ["25", "source lines added"], ["163", "test lines added"]],
    rows: [
      { label: "governance", prod: 0, proc: 530 },
      { label: "backend.3", prod: 41, proc: 218 },
      { label: "web.4", prod: 151, proc: 380 },
      { label: "integration.2", prod: 54, proc: 199 },
    ],
    note: "Generated phase contexts (about 1,610 lines for the three phases) are not in the bars.",
  },
  worth: { present: ["(filled after the checkpoint)"], say: [] },
  catches: [],
  findings: [],
};
