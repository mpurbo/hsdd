// simple-login walkthrough: the execution and result stages, built from the
// recorded facts of each phase (RUN). Appended to the planning stages.
"use strict";
(() => {
const { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say } = window.WL;
const { PHASE, prompt, checks, screensView } = window.WALK_PARTS;
const STAGES = window.WALK_STAGES;

// Minutes after 23:30 WIB on 29 October 2026, for the lane timeline.
const RUN = window.WALK_RUN;

function laneView(s) {
  const sel = s.ui.lanephase || "simple-login.backend.2";
  const span = RUN.axis.end - RUN.axis.start;
  const pos = (m) => ((m - RUN.axis.start) / span) * 100;
  const block = (p) => `<button class="${p.tier}" style="left:${pos(p.start)}%;width:${Math.max(7, pos(p.end) - pos(p.start))}%" ${act("lanephase", p.id)} aria-pressed="${p.id === sel}" title="${esc(p.id)}">${esc(p.id.replace("simple-login.", ""))}</button>`;
  const lane = (label, who) => `<div class="lane"><span>${label}</span><div class="lane-track">${RUN.phases.filter((p) => p.lane === who).map(block).join("")}</div></div>`;
  const p = RUN.phases.find((x) => x.id === sel);
  const ticks = RUN.axis.ticks;
  return `<div class="lanes">
      ${lane("Backend lane<br><small>Claude, main checkout</small>", "backend")}
      ${lane("Web lane<br><small>separate agent, own worktree</small>", "web")}
      ${lane("Integration<br><small>after both</small>", "integration")}
      <div class="axis"><span></span><div>${ticks.map((t) => `<span>${t}</span>`).join("")}</div></div>
    </div>
    ${panel(p.tier === "full-review" ? "decision" : p.tier === "spot-check" ? "impl" : "done", `${esc(p.id)} ${tierChip(p.tier)}`,
      `<p>${esc(PHASE[p.id].name)}</p>` +
      fields([
        ["Wall-clock", esc(p.clock)],
        ["Plan", `${p.tasks} tasks ${p.plan ? fileBtn(p.plan, "plan") : ""}`],
        ["Tests", esc(p.tests)],
        ["Gate", esc(p.gate)],
        ["Diff", esc(p.diff)],
        ["Review", esc(p.review)],
        ["Verification", fileBtn(`hsdd/verify/${p.id}.verification.md`, "verification doc")],
      ]) + (p.wrong && p.wrong.length ? `<div class="went-wrong"><b>What went wrong</b>${list(p.wrong.map(esc))}</div>` : ""))}`;
}

function verifyView(s) {
  const sel = s.ui.phase && RUN.phases.some((p) => p.id === s.ui.phase) ? s.ui.phase : "simple-login.backend.1";
  const p = RUN.phases.find((x) => x.id === sel);
  const depth = { "gate-only": ["Commands to run", "Expected output", "Observed", "Learnings", "Sign-off"], "spot-check": ["Commands to run", "Expected output", "Observed", "Outstanding", "Learnings", "Metrics", "Sign-off"], "full-review": ["Commands to run", "Expected output", "Observed", "Outstanding", "Learnings", "Metrics", "Sign-off"] }[p.tier];
  const all = ["Commands to run", "Expected output", "Observed", "Outstanding", "Learnings", "Metrics", "Sign-off"];
  const what = {
    "Commands to run": "exact commands, including one-time setup on a fresh checkout",
    "Expected output": "what passing looks like: counts, exit codes",
    Observed: "dated: what actually happened when the gate ran",
    Outstanding: "what could not be verified here; every item needs a disposition",
    Learnings: "findings about the tree, each ending with exactly one disposition",
    Metrics: "wall-clock, gate failures before green, product diff vs process lines",
    "Sign-off": "the human: reviewer, tier applied, every disposition",
  };
  return `<div class="bar"><span class="label">Phase</span>${seg("phase", sel, RUN.phases.map((x) => [x.id, x.id.replace("simple-login.", "")]))}</div>
    <p>${tierChip(p.tier)} <span class="hint">${p.tier === "gate-only" ? "the gate passing is the review; the diff is not read" : p.tier === "spot-check" ? "glance at the diff, confirm the gate" : "read the diff, run the manual checks, think through edge cases"}</span></p>
    <div class="cols" style="grid-template-columns:1fr">${all.map((h) => panel(depth.includes(h) ? (h === "Sign-off" ? "decision" : h === "Learnings" ? "process" : "done") : "ghost", `## ${h}`, `<p class="hint">${what[h]}</p>`)).join("")}</div>
    <p class="files-line">Open: ${fileBtn(`hsdd/verify/${sel}.verification.md`)}</p>`;
}

function worthView(s) {
  const m = RUN.metrics;
  const max = Math.max(...m.rows.map((r) => r.src + r.test + r.proc));
  const w = (n) => `${(n / max) * 100}%`;
  return `<div class="stat-row">
      ${m.stats.map(([v, label]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(label)}</span></div>`).join("")}
    </div>
    <div class="legend"><span><i style="background:var(--impl)"></i>source</span><span><i style="background:color-mix(in srgb, var(--impl) 45%, var(--card))"></i>tests</span><span><i style="background:color-mix(in srgb, var(--process) 55%, var(--card))"></i>process artifacts (plan, context, verification doc)</span></div>
    <div class="bars">${m.rows.map((r) => `<div class="bar-row"><span title="${esc(r.id)}">${esc(r.id.replace("simple-login.", ""))}</span><div class="stack"><i class="p-src" style="width:${w(r.src)}"></i><i class="p-test" style="width:${w(r.test)}"></i><i class="p-proc" style="width:${w(r.proc)}"></i></div><span class="num">${r.src + r.test} / ${r.proc}</span></div>`).join("")}</div>
    <p class="hint">Lines added per phase: product (source + tests) / process. Planning artifacts shared by all phases (specs, contracts, fixtures, ADR) are not in the bars: ${esc(m.planning)}.</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Caught</th><th>When</th><th>By</th></tr></thead><tbody>
      ${RUN.catches.map(([what, when, by]) => `<tr><td>${esc(what)}</td><td>${esc(when)}</td><td>${esc(by)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

const EXEC = [
  {
    id: "lanes", group: "Execute", title: "Build in two lanes", short: "superpowers, per phase",
    lede: "Each phase is one superpowers cycle: writing-plans from the derivative, TDD on every task, the gate, the verification doc. The web lane ran in parallel, in its own worktree, from its context files alone.",
    loop: ["code"],
    present: () => `
      ${list([
        `Start at ${c("superpowers:writing-plans")} with the derivative's path, never at brainstorming: the design was already reviewed in HSDD.`,
        "The plan copies the eight Global Constraints verbatim, then the derivative's five-box Plan check runs.",
        `${c("superpowers:executing-plans")} runs each task test-first: the failing test is seen to fail before any code.`,
        "The web lane was a separate agent in its own git worktree. Its whole specification was three context files; the backend did not exist yet.",
        "Click a phase on the timeline for its numbers.",
      ])}
      ${say([
        "The web lane started its API client at 23:54, when the backend had no code at all, and never looked at the backend afterwards. That is the contract edge at work.",
        "Look at the merge: the two lanes touched disjoint files, so it was clean by construction.",
      ])}`,
    self: () => `
      ${prompt("/hsdd-config simple-login.backend.1")}
      ${prompt("Use superpowers:writing-plans to plan hsdd-context/superpowers/simple-login.backend.1.md")}
      ${checks("lanes", [
        "The plan is under docs/superpowers/plans/, has at most the task cap, and its Global Constraints match the derivative's.",
        "Every task but the last starts with a failing test, and you saw it fail.",
        "The gate passes; the last task wrote hsdd/verify/{phase}.verification.md with Sign-off blank.",
        "Repeat per phase. Try running the web lane in a second session or worktree at the same time.",
      ])}
      <p class="files-line">Compare: ${fileBtn("docs/superpowers/plans/2026-10-29-simple-login.backend.1.md")}</p>`,
    visual: (s) => `<h3>Two lanes, six phases</h3>${laneView(s)}`,
  },
  {
    id: "gate", group: "Execute", title: "The review gate", short: "verification doc, sign-off",
    lede: "Every phase ends at a human. The review tier sets how deep the reading goes and how full the verification doc is; every tier keeps Learnings and Sign-off.",
    loop: ["gate"],
    present: () => `
      ${list([
        "The verification doc is written at apply time from a fixed template, never during planning.",
        "gate-only: the gate passing is the review. spot-check: glance at the diff. full-review: read the diff, run the manual checks.",
        "Every Learning ends with exactly one disposition; the gate is not passed while one lacks it.",
        "Every phase above gate-only also got superpowers' fresh-context final review: a second reader the author's blind spots cannot reach. Four of its Minors were re-graded by their effect on a user and fixed.",
      ])}
      ${RUN.gateWrong ? wrong(RUN.gateWrong) : ""}
      ${proxy("Every Sign-off in this run is Claude acting for the absent owner. In your project this is the step a person must own.")}`,
    self: () => `
      ${checks("gate", [
        "For each phase, open its verification doc and fill Sign-off yourself, at the tier the plan assigned.",
        "For full-review phases, run the doc's manual commands before signing.",
        "Give every Learning one disposition: spec-updated, contract-bumped, adr-proposed or dropped (with a reason).",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd/verify/simple-login.backend.2.verification.md")}</p>`,
    visual: (s) => `<h3>What the verification doc holds, by tier</h3>${verifyView(s)}`,
  },
  {
    id: "integrate", group: "Execute", title: "Join the halves", short: "integration.1",
    lede: "The integration node's edges are hard: it runs the real service and the real web app, and drives a browser through every acceptance criterion in the PRD.",
    loop: ["code", "gate"],
    present: () => `
      ${list(RUN.integration.present)}
      ${RUN.integration.wrong.length ? wrong(RUN.integration.wrong) : ""}
      ${say(["This is the first moment the two halves meet. Everything before it was built against fixtures.", RUN.integration.say])}`,
    self: () => `
      ${prompt("/hsdd-config simple-login.integration.1")}
      ${prompt("Use superpowers:writing-plans to plan hsdd-context/superpowers/simple-login.integration.1.md")}
      ${checks("integrate", [
        "npm run install:all && npm run dev starts both; http://localhost:5173 signs you in as ayu.",
        "npm test runs every gate, the replay and the browser suite.",
        "Wrong password, reload, sign out: each behaves as the PRD says.",
      ])}
      <p class="files-line">Compare: ${fileBtn("README.md")}</p>`,
    visual: () => `<h3>The running product</h3>${screensView(true)}`,
  },
  {
    id: "worth", group: "Result", title: "Was it worth it?", short: "cost, catches, findings",
    lede: "For a product this small, the process artifacts outweigh the code. What they bought is in the table: every disagreement and defect, and where it was caught.",
    loop: [],
    present: () => `
      ${list(RUN.worth.present)}
      ${say(RUN.worth.say)}
      <div><h2>Findings about HSDD itself</h2>${list(RUN.findings)}</div>
      <p class="files-line">Full record: <button class="filelink" ${act("open-log", "")}>process-log.md</button></p>`,
    self: () => `
      ${checks("worth", [
        "Count your own: product lines, process lines, and what each gate or review caught.",
        "Note one place where your run differed from ours, and why.",
        "Try the same steps on a real ticket of your own, and compare the cost curve.",
      ])}
      ${list(RUN.worth.self)}`,
    visual: (s) => `<h3>Cost and return</h3>${worthView(s)}`,
  },
];

STAGES.push(...EXEC);
})();
