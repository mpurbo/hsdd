// simple-login update walkthrough: the execution, closure and result
// stages, built from the recorded facts of the run (RUN). Appended to the
// governance stages.
"use strict";
(() => {
const { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say } = window.WL;
const { PHASE, RECORD, prompt, checks } = window.WALK_PARTS;
const STAGES = window.WALK_STAGES;
const RUN = window.WALK_RUN;

function laneView(s) {
  const sel = s.ui.lanephase && RUN.phases.some((p) => p.id === s.ui.lanephase) ? s.ui.lanephase : "simple-login.backend.3";
  const span = RUN.axis.end - RUN.axis.start;
  const pos = (m) => ((m - RUN.axis.start) / span) * 100;
  const block = (p) => `<button class="${p.tier}" style="left:${pos(p.start)}%;width:${Math.max(8, pos(p.end) - pos(p.start))}%" ${act("lanephase", p.id)} aria-pressed="${p.id === sel}" title="${esc(p.id)}">${esc(p.id.replace("simple-login.", ""))}</button>`;
  const lane = (label, who) => `<div class="lane"><span>${label}</span><div class="lane-track">${RUN.phases.filter((p) => p.lane === who).map(block).join("")}</div></div>`;
  const p = RUN.phases.find((x) => x.id === sel);
  return `<div class="lanes">
      ${lane("Backend lane<br><small>Claude, this checkout</small>", "backend")}
      ${lane("Web lane<br><small>separate agent, own worktree</small>", "web")}
      ${lane("Integration<br><small>after both</small>", "integration")}
      <div class="axis"><span></span><div>${RUN.axis.ticks.map((t) => `<span>${t}</span>`).join("")}</div></div>
    </div>
    ${panel("impl", `${esc(p.id)} ${tierChip(p.tier)}`,
      `<p>${esc(PHASE[p.id].name)}</p>` +
      fields([
        ["Wall-clock", esc(p.clock)],
        ["Plan", `${p.tasks} tasks ${fileBtn(p.plan, "plan")}`],
        ["Red, then green", esc(p.red)],
        ["Tests", esc(p.tests)],
        ["Diff", esc(p.diff)],
        ["Review", esc(p.review)],
        ["Verification", fileBtn(`hsdd/verify/${p.id}.verification.md`, "verification doc")],
      ]) + (p.wrong && p.wrong.length ? `<div class="went-wrong"><b>Caught</b>${list(p.wrong.map(esc))}</div>` : ""))}`;
}

function redWindowView() {
  const r = RUN.redWindow;
  return `<div class="cols">
      ${panel("fail", "Contract replay", `<p><b>${r.failed} failed</b>: ${r.failedWhat}</p><pre class="raw diff"><span class="d-ctx">  "email": "budi@example.com",</span>
<span class="d-add">+ "phone": "+62 813 9876 5432",</span>
<span class="d-ctx">  "memberSince": "2025-01-09",</span></pre>`)}
      ${panel("done", "The product", `<p><b>${r.passed} passed</b>: ${r.passedWhat}</p>`)}
    </div>
    <p class="hint">Observed after backend.3 merged and before web.4 and integration.2: the backend serves v2, the web app is still on v1.</p>`;
}

function gateView(s) {
  const sel = s.ui.vphase && RUN.phases.some((p) => p.id === s.ui.vphase) ? s.ui.vphase : "simple-login.backend.3";
  const p = RUN.phases.find((x) => x.id === sel);
  return `<div class="bar"><span class="label">Phase</span>${seg("vphase", sel, RUN.phases.map((x) => [x.id, x.id.replace("simple-login.", "")]))}</div>
    <p>${tierChip(p.tier)} <span class="hint">glance at the diff, confirm the gate</span></p>
    ${fields([
      ["Outstanding", esc(p.outstanding)],
      ["Learnings", esc(p.learning)],
      ["Sign-off", esc(p.signoff)],
    ])}
    <p class="files-line">Open: ${fileBtn(`hsdd/verify/${sel}.verification.md`)}</p>`;
}

function checkpointView(s) {
  const cp = RUN.checkpoint;
  const step = Number(s.ui.cstep || 0);
  const steps = cp.steps.map((x, i) => [String(i), x[0]]);
  const [, text, files] = cp.steps[step];
  return `<div class="bar"><span class="label">Checkpoint</span>${seg("cstep", step, steps)}</div>
    <p>${text}</p>
    ${files.length ? `<p class="files-line">Open: ${files.map((f) => fileBtn(f, f.replace("hsdd/management/", ""))).join(" ")}</p>` : ""}
    <h3>Findings register</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Id</th><th>Finding</th><th>Routed to</th></tr></thead><tbody>
      ${cp.findings.map(([id, sev, what, to]) => `<tr><td class="mono">${esc(id)}<br>${chip(sev === "High" ? "fail" : sev === "Medium" ? "decision" : "ghost", esc(sev))}</td><td>${esc(what)}</td><td>${esc(to)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function worthView() {
  const m = RUN.metrics;
  const max = Math.max(...m.rows.map((r) => r.prod + r.proc));
  const w = (n) => `${(n / max) * 100}%`;
  return `<div class="stat-row">${m.stats.map(([v, label]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(label)}</span></div>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--impl)"></i>product (source, tests, README)</span><span><i style="background:color-mix(in srgb, var(--process) 55%, var(--card))"></i>process (records, contract, specs, plans, verification)</span></div>
    <div class="bars">${m.rows.map((r) => `<div class="bar-row"><span title="${esc(r.label)}">${esc(r.label)}</span><div class="stack"><i class="p-src" style="width:${w(r.prod)}"></i><i class="p-proc" style="width:${w(r.proc)}"></i></div><span class="num">${r.prod} / ${r.proc}</span></div>`).join("")}</div>
    <p class="hint">Lines added or changed, product / process. ${esc(m.note)}</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Caught</th><th>When</th><th>By</th></tr></thead><tbody>
      ${RUN.catches.map(([what, when, by]) => `<tr><td>${esc(what)}</td><td>${esc(when)}</td><td>${esc(by)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

const EXEC = [
  {
    id: "lanes", group: "Execute", title: "Build in two lanes", short: "backend.3 ∥ web.4",
    lede: "backend.3 here, web.4 as a separate agent in its own worktree, at the same time. Each built against profile-api@v2's fixtures; neither saw the other.",
    loop: ["code"],
    present: () => `
      ${list(RUN.lanes.present)}
      ${say(RUN.lanes.say)}`,
    self: () => `
      ${prompt("Use superpowers:writing-plans to plan hsdd-context/superpowers/simple-login.backend.3.md")}
      ${prompt("Use superpowers:writing-plans to plan hsdd-context/superpowers/simple-login.web.4.md")}
      ${checks("lanes", [
        "Each plan copies its Global Constraints verbatim and stays under its task cap.",
        "Every task but the last starts with a failing test, and you saw it fail.",
        "After backend.3, the backend's replay lists profile-api.v2 fixtures and none of v1.",
        "Run the browser suite between backend.3 and integration.2: you should see the red window.",
      ])}
      <p class="files-line">Compare: ${fileBtn("docs/superpowers/plans/2026-10-30-simple-login.backend.3.md")} ${fileBtn("docs/superpowers/plans/2026-10-30-simple-login.web.4.md")}</p>`,
    visual: (s) => `<h3>Two lanes, then the join</h3>${laneView(s)}<h3>The red window, observed</h3>${redWindowView()}`,
  },
  {
    id: "integrate", group: "Execute", title: "Join and prove it", short: "integration.2",
    lede: "The integration node's edges are hard: it runs after both lanes, against the real service and the real web app, and closes the red window.",
    loop: ["code", "gate"],
    present: () => `
      ${list(RUN.integration.present)}
      ${wrong(RUN.integration.wrong)}
      ${say(RUN.integration.say)}`,
    self: () => `
      ${prompt("Use superpowers:writing-plans to plan hsdd-context/superpowers/simple-login.integration.2.md")}
      ${checks("integrate", [
        "npm test is green again: the proxy replay runs nine exact fixtures, four of auth-api and five of profile-api.v2.",
        "Make the web app drop the spaces from the number: AC-2.4 fails. Then make it use non-breaking spaces: does yours fail too?",
        "npm run dev, sign in as ayu and as budi: each Home shows its own number.",
      ])}
      <p class="files-line">Compare: ${fileBtn("e2e/home.spec.ts")}</p>`,
    visual: () => `<h3>The running product</h3><div class="screens">${RUN.screens.map((x) => `<figure class="screen" style="margin:0"><div class="screen-bar"><i></i><i></i><i></i><span>${esc(x.url)}</span></div><img src="${x.src}" alt="${esc(x.alt)}"><figcaption class="hint" style="padding:6px 10px">${esc(x.caption)}</figcaption></figure>`).join("")}</div>`,
  },
  {
    id: "gate", group: "Execute", title: "The review gates", short: "three sign-offs",
    lede: "Each phase ends at a human with a verification doc. Here each phase's Outstanding item was deferred to a later phase of the same change and closed there.",
    loop: ["gate"],
    present: () => `
      ${list([
        "All three phases are spot-check: glance at the diff, confirm the gate. Each still got superpowers' fresh final review.",
        "backend.3 deferred the red root build to integration.2; web.4 deferred its walk against the real backend to integration.2. integration.2's Outstanding is empty: both ran there.",
        "The Learnings were dispositioned dropped, each with its reason; the reasons are findings about HSDD, collected in the last stage.",
      ])}
      ${proxy("All three sign-offs are Claude's, by the owner's choice before the run.")}`,
    self: () => `
      ${checks("gate", [
        "Sign each verification doc at its tier; give every Outstanding item and Learning one disposition.",
        "Check that each deferral names a phase of this change that closes it.",
      ])}`,
    visual: (s) => `<h3>Deferred, then closed</h3>${gateView(s)}`,
  },
  {
    id: "checkpoint", group: "Close", title: "Close the intake", short: "hsdd-checkpoint", skill: "hsdd-checkpoint",
    lede: "Only the checkpoint closes an intake record: it finds the phases whose Scope cites the record, checks that each has its verification doc, and ticks the record closed.",
    loop: ["checkpoint"],
    present: () => `
      ${list(RUN.checkpoint.present)}
      ${RUN.checkpoint.wrong.length ? wrong(RUN.checkpoint.wrong) : ""}
      ${say(RUN.checkpoint.say)}`,
    self: () => `
      ${prompt("Run the weekly checkpoint. This is the project's first.")}
      ${checks("checkpoint", [
        "The intake record's Produced lists the three phases and its Status reads closed (date).",
        "hsdd/management/ has a progress report, an execution plan and atlas.md.",
        "Every finding is in the register and has a plan step that owns it.",
      ])}
      <p class="files-line">Compare: ${fileBtn(RECORD)}</p>`,
    visual: (s) => `<h3>What the checkpoint did</h3>${checkpointView(s)}`,
  },
  {
    id: "worth", group: "Result", title: "What one field cost", short: "cost, catches, findings",
    lede: "One displayed field took a contract version, three phases and a migration. The table shows what that bought: every problem and where it was caught.",
    loop: [],
    present: () => `
      ${list(RUN.worth.present)}
      ${say(RUN.worth.say)}
      <div><h2>Findings about HSDD's change flow</h2>${list(RUN.findings)}</div>
      <p class="files-line">Full record: <button class="filelink" ${act("open-log", "")}>process-log.md</button></p>`,
    self: () => `
      ${checks("worth", [
        "Count your own: product lines, process lines, and what each step caught.",
        "Would your project's contract policy have made this an amend instead of a version? Check the compatibility line of your busiest contract.",
        "Try your own next change: a new optional field on profile-api@v2 should now be an amend.",
      ])}`,
    visual: () => `<h3>Cost and return</h3>${worthView()}`,
  },
];

STAGES.push(...EXEC);
})();
