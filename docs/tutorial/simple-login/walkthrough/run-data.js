// simple-login walkthrough: the recorded facts of the run, from the phase
// ledgers, the verification docs and git (see process-log.md). Values only.
"use strict";
window.WALK_RUN = {
  // Minutes after 23:30 WIB, 29 October 2026.
  axis: { start: 20, end: 110, ticks: ["23:50", "00:20", "00:50", "01:20"] },
  phases: [
    {
      id: "simple-login.backend.1", lane: "backend", tier: "gate-only", start: 24, end: 29, clock: "23:54 to 23:59 (5 min)", tasks: 5,
      plan: "docs/superpowers/plans/2026-10-29-simple-login.backend.1.md",
      tests: "17 (replay rig, accounts, app factory)", gate: "npm --prefix backend run gate: green",
      diff: "378 lines: 74 source, 262 test, 42 config", review: "gate-only: the gate re-run was the review",
      wrong: ["The repository's pre-commit guard rejected package-lock.json: a random integrity hash contained a guarded word. Lockfiles are git-ignored; the guard was not bypassed.", "tsc rejected Ajv's CommonJS default import under nodenext; fixed by taking .default."],
    },
    {
      id: "simple-login.backend.2", lane: "backend", tier: "full-review", start: 31, end: 52, clock: "00:01 to 00:22 (21 min, 14 of them the fresh review)", tasks: 6,
      plan: "docs/superpowers/plans/2026-10-30-simple-login.backend.2.md",
      tests: "70, plus the contract replay: 10 of 10 fixtures", gate: "gate and replay green; curl against the real server",
      diff: "525 lines: 187 source, 334 test", review: "fresh reviewer: 0 critical, 0 important, 6 minor; 2 re-graded and fixed",
      wrong: ["Lengths were counted in UTF-16 units; the contract says characters. A 40-emoji username got 400, not 401. Fixed test-first.", "engines said Node 24; import.meta.main needs 24.2, so the server would exit silently on 24.0. Fixed.", "backend.1's 'no routes yet' test went red once routes existed; it asserted a phase-1 fact and was replaced."],
    },
    {
      id: "simple-login.web.1", lane: "web", tier: "spot-check", start: 24, end: 45, clock: "23:54 to 00:15 (21 min)", tasks: 5,
      plan: "docs/superpowers/plans/2026-10-29-simple-login.web.1.md",
      tests: "35", gate: "npm --prefix web run gate: types, tests, build",
      diff: "604 lines: 182 source, 344 test, 78 config", review: "fresh reviewer: 5 minor; no request timeout re-graded and fixed",
      wrong: ["Vite rewrote new URL(..., import.meta.url) into an asset URL and broke the fixture loader; switched to node:path.", "A hung backend would leave the form busy forever: a 10-second abort was added test-first."],
    },
    {
      id: "simple-login.web.2", lane: "web", tier: "spot-check", start: 45, end: 61, clock: "00:15 to 00:31 (16 min)", tasks: 5,
      plan: "docs/superpowers/plans/2026-10-29-simple-login.web.2.md",
      tests: "51", gate: "npm --prefix web run gate: green",
      diff: "385 lines: 188 source, 197 test", review: "fresh reviewer: 1 important (fixed), 7 minor",
      wrong: ["iOS capitalizes the first letter of a text field, and auth-api@v1 matches usernames exactly, so 'ayu' typed on a phone would fail. Fixed with autocapitalize=none.", "user-event hangs under Vitest fake timers; the clock is faked only while a request is in flight."],
    },
    {
      id: "simple-login.web.3", lane: "web", tier: "full-review", start: 61, end: 77, clock: "00:31 to 00:47 (16 min)", tasks: 6,
      plan: "docs/superpowers/plans/2026-10-29-simple-login.web.3.md",
      tests: "79", gate: "npm --prefix web run gate: green",
      diff: "456 lines: 245 source, 211 test", review: "fresh reviewer: 7 minor; the gate added D5 to the web spec",
      wrong: ["The spec was silent on a network failure while checking a stored session; the gate turned the phase's choice into D5."],
    },
    {
      id: "simple-login.integration.1", lane: "integration", tier: "full-review", start: 81, end: 109, clock: "00:51 to 01:19 (28 min, 10 of them the fresh review)", tasks: 6,
      plan: "docs/superpowers/plans/2026-10-30-simple-login.integration.1.md",
      tests: "18 browser tests (9 acceptance, 9 fixtures through the proxy) + 3 runner tests", gate: "npm test: every gate, the replay, the runner, the browser suite (12 s)",
      diff: "481 lines: 82 source, 323 test, 76 config and README", review: "fresh reviewer: 2 important, 6 minor; 4 fixed test-first",
      wrong: ["Before the config existed, Playwright collected the dev-runner's node test, started both servers and killed the runner hard: two orphan servers held the ports. The config now limits Playwright to e2e/ and the runner also stops on SIGHUP.", "Review: an exported PORT moved the backend off the proxy's target and orphaned it; fixed in the fixture and the runner.", "Review: AC-1.2 matched a substring, so a message saying which field was wrong would pass; it now matches the whole message."],
    },
  ],
  gateWrong: ["Two lanes met the same contract ambiguity from opposite sides: the backend counted UTF-16 units, the web form's maxLength does too, and auth-api@v1 said only 'characters'. At the web.3 gate the contract was clarified (a character is a code point), a compatible change, still v1."],
  integration: {
    present: [
      "One command, npm run dev, starts the real backend and the web dev server; Ctrl-C stops both.",
      "The browser suite drives the installed Chrome through every acceptance criterion in the PRD, using the PRD's own words as selectors.",
      "AC-2.3 restarts the backend instead of seeding storage: the integration node may not know the web app's storage key, and the contract says an unknown token answers exactly like an expired one.",
      "Nine exact fixtures replayed through the dev proxy against the real service: the contract checked end to end.",
      "Every browser test passed on its first run. The two halves, built without seeing each other, fitted.",
    ],
    wrong: ["A red run before the config existed left two orphan servers on the ports (see the timeline). Caught, killed, and the config narrowed."],
    say: "A mutation check proves the green is real: changing one message in the web app made both AC-1.2 tests fail.",
  },
  metrics: {
    stats: [["962", "lines of source"], ["1,664", "lines of tests"], ["8", "minutes of agent time, PRD to stable contracts"], ["0", "defects found when the halves met"]],
    rows: [
      { id: "simple-login.backend.1", src: 74, test: 262, proc: 375 },
      { id: "simple-login.backend.2", src: 187, test: 334, proc: 620 },
      { id: "simple-login.web.1", src: 182, test: 344, proc: 817 },
      { id: "simple-login.web.2", src: 188, test: 197, proc: 770 },
      { id: "simple-login.web.3", src: 245, test: 211, proc: 908 },
      { id: "simple-login.integration.1", src: 82, test: 323, proc: 602 },
    ],
    planning: "1,292 lines across 4 node specs, 2 contracts with schemas and 10 fixtures, 1 ADR and the conventions",
  },
  catches: [
    ["A schema Ajv's strict mode rejects", "contracts, before any code", "validating the fixtures at authoring"],
    ["Two consumers assume localhost, the producer binds 127.0.0.1", "reconcile, before any code", "reconcile's collision check"],
    ["Is username matching case-sensitive?", "reconcile, before any code", "a consumer's request met the producer's amend"],
    ["Two contexts name a contract they do not carry", "phase switch", "hsdd-config's self-contained gate"],
    ["Lengths counted in UTF-16 units, not characters", "backend.2", "fresh reviewer, re-graded by effect"],
    ["Server exits silently on Node 24.0", "backend.2", "fresh reviewer"],
    ["No request timeout: a hung backend freezes the form", "web.1", "fresh reviewer, re-graded by effect"],
    ["iOS capitalizes 'ayu', exact match rejects it", "web.2", "fresh reviewer"],
    ["No message named for an invalid request; no rule for a network failure on load", "web.2, web.3 gates", "Learnings, executed as spec updates"],
    ["'Character' undefined in auth-api@v1", "web.3 gate", "the same ambiguity seen from both lanes"],
    ["Orphan servers after a hard-killed runner", "integration.1", "the phase's own red run"],
    ["An exported PORT moves the backend off the proxy's target", "integration.1", "fresh reviewer"],
    ["AC-1.2 test would pass a message that says which field was wrong", "integration.1", "fresh reviewer, re-graded by effect"],
  ],
  worth: {
    present: [
      "Process outweighs product here: 3,561 authored lines of specs, contracts, plans and verification docs, plus 1,824 lines of generated phase contexts, against 962 lines of source.",
      "What it bought: thirteen defects and disagreements caught, four of them before any code; two lanes that never waited for each other; and a browser suite that passed on its first run when the halves met.",
      "Each phase fitted one review sitting, and the tier told the reviewer how deep to read.",
      "A product this small, built by one person, does not need HSDD. The same mechanics pay off when lanes are different teams, when the system no longer fits one context, and when the tree outlives the first release.",
    ],
    say: [
      "Ask the room: which of the thirteen catches would your current process have found, and when?",
      "The contexts are generated, so the reading cost per phase is one file, not the tree.",
      "The 8 minutes of planning were agent time. In a team, the human reviews of the specs and contracts are the real cost; they are also where the localhost mismatch was cheapest to fix.",
    ],
    self: [
      "Compare your own numbers with the table, phase by phase.",
      "The process log lists every decision Claude took for the owner; check which ones you would have made differently.",
    ],
  },
  findings: [
    "hsdd-config injects only a contract's Interface and Guarantees. backend.1 builds the replay rig, needs the fixture format from the Validation section, and consumes no contract, so its context carried no contract text at all.",
    "The self-contained gate pulls in a contract named inside another contract's text, and the template has no direction for it; this run used 'referenced'.",
    "A phase's Scope may cite node-local D1 or D2, which the switch never injects; here their content survived only because reconcile had copied it into the contracts.",
    "The Learning dispositions have no word for a compatible contract clarification that keeps the version.",
    "superpowers' executing-plans requires a fresh-reviewer final review; HSDD's gate-only tier says the gate is enough. The run ruled for the tier; the derivative could say which governs.",
    "Phase Equivalent sizing counts tests, and test-first phases ran 385 to 604 product lines against a ~400 ceiling; plans' size estimates undershot.",
    "This tutorial's input folder hsdd/context/ sits one character away from the generated hsdd-context/.",
  ],
  screens: [
    { url: "localhost:5173", src: "screens/login-error.png", alt: "The Login screen after a wrong password: the message Incorrect username or password.", caption: "AC-1.2, real backend, real browser" },
    { url: "localhost:5173", src: "screens/home.png", alt: "The Home screen: Hello, Ayu Lestari, with username, email and member since 14 March 2024.", caption: "AC-2.1 after signing in as ayu" },
  ],
};
