// meeting-rooms walkthrough: the build, the checkpoint and the result,
// built from the recorded facts of the run (RUN). Appended to the planning
// stages.
"use strict";
(() => {
const { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say } = window.WL;
const { RECORD, prompt, checks } = window.WALK_PARTS;
const STAGES = window.WALK_STAGES;
const RUN = window.WALK_RUN;
const EVIDENCE = "docs/superpowers/evidence/";

const LANES = [
  ["backend", "Backend lane<br><small>lane/backend</small>"],
  ["backend6", "Backend, second branch<br><small>lane/backend6</small>"],
  ["web", "Web lane<br><small>lane/web</small>"],
  ["integration", "Integration<br><small>after both</small>"],
];
function laneView(s, focus, fallback) {
  const sel = s.ui.lanephase && RUN.phases.some((p) => p.id === s.ui.lanephase && focus.includes(p.lane)) ? s.ui.lanephase : fallback;
  const span = RUN.axis.end - RUN.axis.start;
  const pos = (m) => ((m - RUN.axis.start) / span) * 100;
  const block = (p) => `<button class="${p.tier}" style="left:${pos(p.start)}%;width:${Math.max(6, pos(p.end) - pos(p.start))}%" ${act("lanephase", p.id)} aria-pressed="${p.id === sel}" title="${esc(p.id)}: ${esc(p.clock)}">${esc(p.id.split(".").at(-1))}</button>`;
  const pause = `<span class="pause" style="left:${pos(RUN.pause.start)}%;width:${pos(RUN.pause.end) - pos(RUN.pause.start)}%" title="${esc(RUN.pause.label)}"></span>`;
  const lane = ([who, label]) => `<div class="lane${focus.includes(who) ? "" : " dim"}"><span>${label}</span><div class="lane-track">${pause}${RUN.phases.filter((p) => p.lane === who).map(block).join("")}</div></div>`;
  const p = RUN.phases.find((x) => x.id === sel);
  return `<div class="lanes">
      ${LANES.map(lane).join("")}
      <div class="axis"><span></span><div>${RUN.axis.ticks.map((t, i) => `<span style="left:${pos(RUN.axis.tickAt[i])}%">${t}</span>`).join("")}</div></div>
    </div>
    <p class="hint">Each block is one phase, numbered within its node. WIB, from the commits: each runs from the hsdd-config switch to the owner proxy's sign-off. The hatched band is the pause on the account's usage limit (05:16 to 06:54).</p>
    ${panel("impl", `${esc(p.id)} ${tierChip(p.tier)}`,
      `<p>${esc(p.name)}</p>` +
      fields([
        ["Clock", `${esc(p.clock)}; agent ${esc(p.agent)}`],
        ["Size", `estimate ${esc(p.estimate)} lines; ${p.changed} product and test lines added`],
        ["Tests", esc(p.tests)],
        ["Built", esc(p.red)],
        ["Review", esc(p.review)],
        ["Sign-off", esc(p.outstanding)],
      ]) +
      `<p class="files-line">${fileBtn(`hsdd-context/${p.id}.md`, "context")} ${fileBtn(`hsdd-context/superpowers/${p.id}.md`, "superpowers derivative")} ${fileBtn(p.plan, "plan")} ${fileBtn(`hsdd/verify/${p.id}.verification.md`, "verification doc")}</p>`)}`;
}
const shot = (file, alt, caption) =>
  `<figure class="shot"><img src="../execute/${EVIDENCE}${file}" alt="${esc(alt)}" loading="lazy"><figcaption class="hint">${esc(caption)} ${fileBtn(EVIDENCE + file, "open")}</figcaption></figure>`;

function phasePrompts(id, tier) {
  const exec = tier === "full-review" ? "superpowers:subagent-driven-development" : "superpowers:executing-plans";
  return `${prompt(`/hsdd-config ${id}`)}
    ${prompt(`Use superpowers:writing-plans to plan hsdd-context/superpowers/${id}.md`)}
    <p class="hint">Then execute the plan with ${c(exec)}, which the derivative's header names for a ${esc(tier)} phase, and sign the verification doc yourself.</p>`;
}

function checkpointView(s) {
  const cp = RUN.checkpoint;
  const step = Number(s.ui.cstep || 0);
  const [, text, files] = cp.steps[step];
  const tab = s.ui.cpf || "findings";
  const table = tab === "findings"
    ? `<div class="table-wrap"><table class="data"><thead><tr><th>Id</th><th>Finding</th><th>Routed to</th></tr></thead><tbody>
        ${cp.findings.map(([id, sev, what, to]) => `<tr><td class="mono">${esc(id)}<br>${chip(sev === "Medium" ? "decision" : "ghost", esc(sev))}</td><td>${esc(what)}</td><td>${esc(to)}</td></tr>`).join("")}
      </tbody></table></div>`
    : `<div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>Question for the owner</th></tr></thead><tbody>
        ${cp.agenda.map(([id, q]) => `<tr><td class="mono">${esc(id)}</td><td>${esc(q)}</td></tr>`).join("")}
      </tbody></table></div>`;
  return `<div class="bar"><span class="label">Checkpoint</span>${seg("cstep", step, cp.steps.map((x, i) => [String(i), x[0]]))}</div>
    <p>${esc(text)}</p>
    ${files.length ? `<p class="files-line">Open: ${files.map((f) => fileBtn(f, f.replace("hsdd/management/", ""))).join(" ")}</p>` : ""}
    <div class="bar">${seg("cpf", tab, [["findings", "New findings F-10 to F-22"], ["agenda", "Sync A agenda"]])}</div>
    ${table}
    <h3>F-12, on screen</h3>
    ${shot("simple-login.web.8/ayu-rooms-range-edges-rooms.png", "Rooms at 360 px for ayu on 5 November 2026: Kew in London shows Wed 4 Nov 23:30 to 00:30 Handover, and under it (Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London).", "web.8's evidence: the room-local range repeats Wed 4 Nov, the form the review of DEC-032 rejected.")}`;
}

function worthView() {
  const L = RUN.lines;
  const max = Math.max(...L.map((r) => r.n));
  const color = { src: "var(--impl)", test: "color-mix(in srgb, var(--impl) 45%, var(--card))", proc: "color-mix(in srgb, var(--process) 55%, var(--card))", copy: "var(--rule)" };
  return `<div class="stat-row four">${[["231", "decisions, 9 would_have_asked"], ["33", "review lines, 1 disagree"], ["12", "phases, 8 full-review"], ["0", "stops"]].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <div class="stat-row four">${[["72 → 299", "backend gate"], ["10 → 46", "contract replay"], ["90 → 387", "web gate"], ["20 → 85", "browser suite"]].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <h3>Lines added, template to checkpoint</h3>
    <div class="legend"><span><i style="background:${color.src}"></i>product</span><span><i style="background:${color.test}"></i>tests</span><span><i style="background:${color.proc}"></i>process</span><span><i style="background:${color.copy}"></i>copied</span></div>
    <div class="bars">${L.map((r) => `<div class="bar-row"><span title="${esc(r.label)}">${esc(r.label)}</span><div class="stack"><i style="width:${(r.n / max) * 100}%;background:${color[r.kind]}"></i></div><span class="num">${r.n.toLocaleString("en-US")}</span></div>`).join("")}</div>
    <p class="hint">From git diff --numstat 080ef39 70bfc4f under execute/; 21 screenshots not counted. Phase contexts are generated by hsdd-config; evidence logs are recorded test output; the hsdd-auto scripts are a verbatim copy.</p>
    <h3>What was caught, and where</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Caught</th><th>When</th><th>By</th></tr></thead><tbody>
      ${RUN.catches.map(([what, when, by]) => `<tr><td>${esc(what)}</td><td>${esc(when)}</td><td>${esc(by)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

const BUILD_INTRO = [
  "hsdd-auto plans and stops there. Each of the twelve phases took the ordinary path: hsdd-config's switch, the superpowers derivative it writes, the gate, a verification doc, and a sign-off.",
  "Two worktrees cut from main after the review: lane/backend and lane/web, one agent per phase; integration after both. A phase agent may start its own subagents, so the full-review tier runs as subagent-driven-development intends.",
  "Isolation: a phase agent's whole specification is its two context files and the files their Links name.",
  "The agent leaves ## Sign-off empty; the orchestrator reads its report, signs as owner proxy, merges the lane into main with --no-ff, and starts the lane's next phase.",
];

const EXEC = [
  {
    id: "backend", group: "Build", title: "The backend lane", short: "backend.4 to .7", skill: "hsdd-config + superpowers",
    lede: "Four backend phases, two of them on parallel branches. The first closes the red window the contract step predicted; the last serves booking-api@v1 from a service that starts on its own database.",
    loop: ["config", "code", "gate"],
    present: () => `
      ${list(BUILD_INTRO)}
      ${list([
        "backend.4 started on a red gate, 68 of 72: exactly the window S07 predicted, since me-ayu and me-budi now carry timeZone. It ended at 111 tests, the gate starting PostgreSQL itself.",
        "backend.5 (the booking rules, pure) and backend.6 (the store on PostgreSQL) ran in parallel on two branches, as the plan allowed.",
        "backend.7 tied them together: 299 tests, and the replay runs all 45 fixtures of the three contracts.",
      ])}
      ${wrong([
        "backend.6: a read-before-lock mutant passed every test the plan listed, and the phase's Verification line (\"no deadlock detected\") could not catch it: it logged 183 ERROR lines and no deadlock. A line that names a symptom instead of the invariant.",
        "backend.7: a process crash when a connection dropped while a request held it. Found by the final reviewer, fixed with a listener on each connection.",
      ])}
      ${say(["Pick backend.6 on the timeline: six reviewers for one store. Ask which of its catches a single end-of-phase review would have found."])}
      <p class="hint">main at this stage's commit also holds web.5 to web.7: the lanes ran at the same time.</p>`,
    self: () => `
      ${phasePrompts("simple-login.backend.4", "gate-only")}
      ${checks("backend", [
        "Before backend.4, npm --prefix backend run gate is red on me-ayu and me-budi; after it, green.",
        "Run backend.5 and backend.6 on two branches at once; merge both before backend.7.",
        "After backend.7: npm --prefix backend run gate and npm --prefix backend run replay pass, and the replay counts every fixture.",
        "Each phase has a verification doc whose Outstanding items and Learnings each carry a disposition.",
      ])}
      <p class="hint">The gate runs db:up first, so Colima (or Docker) must be running.</p>`,
    visual: (s) => `<h3>Two lanes, then integration</h3>${laneView(s, ["backend", "backend6"], "simple-login.backend.6")}`,
  },
  {
    id: "web", group: "Build", title: "The web lane", short: "web.5 to .9", skill: "hsdd-config + superpowers",
    lede: "Five web phases, built only against booking-api@v1's fixtures and ADR-002. The time module is pure and takes the zone as an argument; the browser's own zone is used for nothing.",
    loop: ["config", "code", "gate"],
    present: () => `
      ${list([
        "web.5 built the client, Profile.timeZone and a fixture stub, and pinned every web test to Asia/Kolkata with a guard test: neither account's zone, and not UTC.",
        "web.6, the time functions: zone names, a day's range, the form's quarter-hour options, the formatters. Its 63 time tests also pass under Europe/London, America/St_Johns, Asia/Jakarta and UTC.",
        "web.7 (Home), web.8 (Rooms and moving between screens) and web.9 (the booking form) each had per-task reviewers and a final one.",
        "The web gate went from 90 to 387 tests. web.9 stopped on the account's usage limit with integration.3; both resumed after the reset with nothing lost.",
      ])}
      ${wrong([
        "web.5: a client sort of the rooms would pass every test, since the fixtures already come in order. A sorting mutant passed 176 of 176.",
        "web.7: overlapping Cancels made a canceled booking's button usable again; a screen reader heard nothing after a Cancel.",
        "web.9: the no-break-space test cases had silently become ASCII spaces. An editor tool turned the plan's \\u escapes into literal characters, and an implementer copied the text.",
      ])}
      ${proxy("Product rulings at sign-off: a cancel gets no success message, since AC-6.2's confirmation is the booking leaving the list (web.7); focus on a screen change and a retry on Rooms are later work (web.8).")}`,
    self: () => `
      ${phasePrompts("simple-login.web.6", "full-review")}
      ${checks("web", [
        "npm --prefix web run gate runs every test under TZ=Asia/Kolkata, and a guard test fails if it does not.",
        "Run the time tests under another TZ: they still pass.",
        "Book Merapi as budi: on Rooms, the booking shows budi's London times with Jakarta's in parentheses (AC-4.3).",
        "Compare Home and Rooms with PRD v2's Screens yourself: the phase contexts did not carry the wireframe.",
      ])}`,
    visual: (s) => `<h3>Two lanes, then integration</h3>${laneView(s, ["web"], "simple-login.web.9")}`,
  },
  {
    id: "integration", group: "Build", title: "Integration: the whole product, proven", short: "integration.3 to .5 · all green", skill: "hsdd-config + superpowers",
    lede: "The integration node runs the real service on its own PostgreSQL database beside the real web app, in a third time zone, on the real clock, and proves PRD v2's Success section.",
    loop: ["config", "code", "gate"],
    present: () => `
      ${list([
        "integration.3: a meeting_rooms_e2e database re-created per run, the service in its own process group, the browser in Asia/Kolkata, and PRD v2's two Success tests: 20 simultaneous attempts in five rounds, one winner each, and a restart that keeps every booking.",
        "integration.4: Home in the browser. The behavior had shipped with the web phases, so each test's red came from a named network mutant. AC-1.1's test drops the 3-second check, per PRD v2 (DEC-195).",
        "integration.5: Rooms in the browser, two users booking at once in two browsers, and London's clock-change days on the next last Sunday of March and of October.",
        "The final root npm test, rerun by the orchestrator: backend 299, replay 46, web 387, browser 85. A fresh clone gave the same, with runner 3.",
      ])}
      ${wrong([
        "Tests asserting Thames would have failed about 14 days a year, on the days integration.5 books it for London's clock change.",
        "integration.5 picking its own dates would have collided with integration.4's on about 224 run days of 2027; fixed with a shared winter-date helper.",
        "The runtime reports Asia/Kolkata as Asia/Calcutta; a context that pins a zone name should say canonical or alias.",
      ])}
      ${proxy("Open for the owner: in the two-browser check the user who lost the race saw (no bookings) under Thames beside \"Thames is already booked from 19:00 to 20:00.\" web.9 refetches after a 201, not after a 409. A web change request, not fixed in this run.")}`,
    self: () => `
      ${phasePrompts("simple-login.integration.3", "full-review")}
      ${checks("integration", [
        "Stop npm run dev first; npm test needs ports 3000 and 5173.",
        "npm test runs every suite green, the browser suite on meeting_rooms_e2e, which it drops and re-creates each run.",
        "Book the same room and time in two browser windows at once: one wins, the other sees the overlap message.",
        "Restart the service: every booking is still there, and every token is gone (ADR-001).",
      ])}`,
    visual: (s) => `<h3>Two lanes, then integration</h3>${laneView(s, ["integration"], "simple-login.integration.3")}
      <h3>The running product</h3>
      <div class="screens">
        ${shot("simple-login.integration.4/budi-home-1280.png", "Home for Budi Santoso with Time zone Europe/London and three bookings on Kew, each with Cancel.", "Home for budi: the time zone, and my bookings with Cancel (integration.4).")}
        ${shot("simple-login.web.9/1280px-3-conflict.png", "Rooms on 6 November 2026 with the booking form filled for Merapi 09:30 to 10:30 and the message Merapi is already booked from 09:00 to 10:00.", "An overlap refused with AC-5.3's message (web.9).")}
        ${shot("simple-login.integration.5/ayu-rooms-race-1280.png", "Rooms for ayu on 31 January 2027: Thames shows (no bookings) while the message says Thames is already booked from 19:00 to 20:00.", "The race's loser: (no bookings) beside the refusal (integration.5's open item).")}
      </div>`,
  },
  {
    id: "checkpoint", group: "Close", title: "Close the intake", short: "hsdd-checkpoint", skill: "hsdd-checkpoint",
    lede: "Only the checkpoint closes an intake record. It found the twelve phases by their Scope citation, checked each has a verification doc, a green gate and a named sign-off, and closed the record. Then it judged the proxy.",
    loop: ["checkpoint"],
    present: () => `
      ${list([
        "21 of 21 phases done; the root npm test green from a fresh install. It wrote the progress report, the execution plan and the atlas, and ticked the earlier plan's C-2 and C-3, which the run had absorbed.",
        "Thirteen new findings, F-10 to F-22, and a Sync A agenda of eleven items for the owner, A-1 to A-11. It asked nothing.",
        "Two findings judge the proxy itself: the twelve sign-offs dropped all 53 Learnings and took ten waivers (F-10, F-11), and the review's disagreement with DEC-032 never landed, so web.8 shipped the form the proxy rejected (F-12).",
      ])}
      ${wrong(["The one disagree of the review sitting had no place to land: nothing in the run carried it into ADR-002 or a phase, and the build followed ADR-002 as written. The checkpoint caught it after the fact."])}
      ${say(["The report's one-sentence read: PRD v2 is delivered and re-proven green, but every decision behind it, from the planning run's 231 decisions to the twelve sign-offs, was taken by an owner proxy, and one of the proxy's own objections shipped unaddressed."])}`,
    self: () => `
      ${prompt("Run a checkpoint.")}
      ${checks("checkpoint", [
        "The intake record's Produced lists the twelve phases and its Status reads closed.",
        "hsdd/management/ has a new progress report, an execution plan and a regenerated atlas.",
        "Your review lines are in the findings if they disagree with what shipped.",
        "Every finding has a step or an agenda item that owns it.",
      ])}
      <p class="files-line">Compare: ${fileBtn(RECORD)} ${fileBtn("hsdd/management/2026-11-01-progress.md")} ${fileBtn("hsdd/management/2026-11-01-execution-plan.md")}</p>`,
    visual: (s) => `<h3>What the checkpoint did</h3>${checkpointView(s)}`,
  },
  {
    id: "worth", group: "Result", title: "What this run shows", short: "numbers, catches, findings",
    lede: "One unattended run planned a product-sized change in 31 steps without a stop. The review took one sitting. The build took twelve phases. The open question is the evidence chain.",
    loop: [],
    present: () => `
      ${list([
        "Planning: 31 steps, 231 decisions, 65 commits, 12 experiments, one rework, three inserted steps, no stop. The records let a reader find any choice and its reason without the transcript.",
        "Build: twelve phases in two lanes, then integration. Every phase review found at least one real defect the plan's own tests missed; each was fixed with a test seen failing first.",
        "Size estimates ran 1.96 times low once tests count. Process artifacts outweigh product in every phase.",
        "The weak point is the loop back into governance: 33 review lines and twelve sign-offs by one proxy, 53 dropped Learnings, and a rejected rule that shipped.",
      ])}
      ${key("hsdd-auto moves the owner from every ask point to one review sitting. That only works if the sitting is real, and if what it decides has a place to land.")}
      <div><h2>Fixed in v0.11.0 after the run</h2>${list(RUN.fixed.map(([id, t]) => `<b>${esc(id)}</b> ${esc(t)}`))}<p class="hint">Fifteen gaps between hsdd-auto and v0.10.2 (G-1 to G-15) were fixed before the run. The tutorial's run keeps the skills it was recorded with, so its records show R-1 to R-6.</p></div>
      <div><h2>Open, for the owner</h2>${list(RUN.open.map(([t, d]) => `<b>${esc(t)}.</b> ${esc(d)}`))}</div>
      ${proxy("Owner proxy throughout: the change request itself (PRD v2 dropped the 3-second target by accident), the first run's ten answers, two hsdd-auto design choices before the run, the review sitting and twelve sign-offs. The process log lists each.")}
      <p class="files-line">Full record: <button class="filelink" ${act("open-log", "")}>process-log.md</button></p>`,
    self: () => `
      ${checks("worth", [
        "Count your own: decisions, would_have_asked, review lines, and how many of your disagrees landed.",
        "For each would_have_asked decision, ask whether you would have answered differently at the time.",
        "Pick one finding from the checkpoint and route it through hsdd-intake: that is the next change.",
      ])}`,
    visual: () => `<h3>Cost and return</h3>${worthView()}`,
  },
];

STAGES.push(...EXEC);
})();
