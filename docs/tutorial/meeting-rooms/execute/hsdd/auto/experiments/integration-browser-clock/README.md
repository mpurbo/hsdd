In the installed Chrome under Playwright 1.64.1, a context's timezoneId sets the page's ambient zone, and page.clock.setFixedTime holds the page's clock behind the real one while its timers run, leaving the test process on the real clock.
Question: can simple-login.integration's browser tests run in Asia/Kolkata (ADR-002) and put only the browser's clock behind, so the Rooms form offers a quarter hour the backend's real clock has already started (PRD v2 AC-5.5) (S20)?
Run from the repository root: `npm --prefix hsdd/auto/experiments/integration-browser-clock install`, then `node hsdd/auto/experiments/integration-browser-clock/probe.mjs`; output in `output.txt` (Chrome 156, Node.js 24.18).
timezoneId Asia/Kolkata: the page resolves Asia/Calcutta (an alias, as TZ does in Node), offset -330, 02:00Z reads hour 7.
setFixedTime(5 minutes before the current quarter hour) before goto: the page's Date.now() and new Date() read that instant at load and do not move; setInterval still fires (19 ticks in one second).
The current quarter hour was after the page's clock and already started on the real clock, which is the condition the AC-5.5 browser test needs.
