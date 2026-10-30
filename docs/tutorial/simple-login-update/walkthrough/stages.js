// simple-login update walkthrough: the stages from the change request to the
// phase contexts. Each stage is a value: its text for the two modes and a
// visual, both functions from the state to HTML.
"use strict";
(() => {
const { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say, marker, box, path, svg } = window.WL;

// ---------- shared facts about the change ----------
const SHIPPED = [
  ["simple-login.backend.1", "Skeleton, domain types, contract replay rig", "gate-only"],
  ["simple-login.backend.2", "Sign-in, sessions and the two endpoints", "full-review"],
  ["simple-login.web.1", "App skeleton, API client, session storage", "spot-check"],
  ["simple-login.web.2", "Login screen", "spot-check"],
  ["simple-login.web.3", "Home screen and the session flow", "full-review"],
  ["simple-login.integration.1", "End-to-end run and browser test", "full-review"],
];
const PHASES = [
  { id: "simple-login.backend.3", node: "backend", name: "Phone number in the profile", tier: "spot-check", tasks: 3, size: "~7 files, ~40 lines", produces: ["profile-api@v2"], consumes: [], referenced: ["profile-api@v1", "auth-api@v1"], lines: 250 },
  { id: "simple-login.web.4", node: "web", name: "Phone number on Home", tier: "spot-check", tasks: 4, size: "~9 files, ~70 lines", produces: [], consumes: ["profile-api@v2"], referenced: ["profile-api@v1", "auth-api@v1"], lines: 248 },
  { id: "simple-login.integration.2", node: "integration", name: "Phone number end to end", tier: "spot-check", tasks: 4, size: "~4 files, ~35 lines", produces: [], consumes: ["auth-api@v1", "profile-api@v2"], referenced: ["profile-api@v1"], lines: 247 },
];
const PHASE = Object.fromEntries(PHASES.map((p) => [p.id, p]));
const RECORD = "hsdd/management/2026-10-30-intake-add-phone.md";

// ---------- visuals ----------
function homeMock(phone) {
  return `<div class="screen"><div class="screen-bar"><i></i><i></i><i></i><span>localhost:5173</span></div><div class="screen-body">
      <h4>Hello, Ayu Lestari</h4>
      ${fields([["Username", "ayu"], ["Email", "ayu@example.com"], ...(phone ? [["Phone", "<b>+62 812 3456 7890</b>"]] : []), ["Member since", "14 March 2024"]])}
      <span class="mini-btn ghost">Sign out</span>
    </div></div>`;
}
function startView() {
  return `<div class="screens">${homeMock(false)}${homeMock(true)}</div>
    <p class="hint" style="text-align:center">Home before update 1, and after.</p>
    <div class="cols">
      ${panel("done", "The finished project", `<p>Six phases shipped, every verification doc signed. Two contracts, both ${c("stable")}: ${c("auth-api@v1")}, ${c("profile-api@v1")}. 180 tests green.</p>`)}
      ${panel("flow", "One change request", `<p>${fileBtn("hsdd/context/update-1-add-phone.md", "update-1-add-phone.md")}: amend AC-2.1, add AC-2.4. One minute to read.</p>`)}
      ${panel("process", "The question", `<p>How does a finished HSDD tree take a change, without a new spec and without rereading everything?</p>`)}
    </div>`;
}

const CLASSES = [
  ["local", "fits inside one existing leaf-parent", "hsdd-phase-plan on that node, append mode", "The phone number crosses the backend-to-web seam: three leaf-parents, not one."],
  ["cross-node", "touches several nodes' surfaces", "hsdd-contract bump and/or hsdd-adr, then hsdd-phase-plan on each node", "This one. The backend owns the data and GET /api/me, the web owns Home, the integration node owns the browser test of every criterion."],
  ["new-capability", "needs a node that does not exist", "hsdd-spec graft mode on the existing parent", "No node is missing: the change follows an existing seam."],
  ["structural", "the tree's shape is wrong for this change", "stop: a human decision, with the options written", "The shape fits. Nothing here asks to move a boundary."],
];
function intakeView(s) {
  const pick = s.ui.klass || "cross-node";
  const row = CLASSES.find((r) => r[0] === pick);
  const lit = (n) => pick === "cross-node" || (pick === "local" && n === "backend");
  const inner = `${marker("i1")}
    ${box({ x: 300, y: 12, w: 200, kind: "root", title: "simple-login", sub: "root" })}
    ${path("M400,62 C400,92 130,92 130,122", "", "i1")}${path("M400,62 L400,122", "", "i1")}${path("M400,62 C400,92 670,92 670,122", "", "i1")}
    ${box({ x: 40, y: 124, w: 180, kind: "leaf", title: "simple-login.backend", sub: lit("backend") ? "lands here" : "leaf-parent", selected: lit("backend") })}
    ${box({ x: 310, y: 124, w: 180, kind: "leaf", title: "simple-login.web", sub: lit("web") ? "lands here" : "leaf-parent", selected: lit("web") })}
    ${box({ x: 580, y: 124, w: 180, kind: "integration", title: "simple-login.integration", sub: lit("integration") ? "lands here" : "leaf-parent", selected: lit("integration") })}
    ${path("M220,160 L306,160", `contract ${pick === "cross-node" ? "hot" : ""}`, "i1")}
    <text class="t-edge" x="263" y="152" text-anchor="middle">profile-api</text>`;
  return `<div class="bar"><span class="label">Class</span>${seg("klass", pick, CLASSES.map(([k]) => [k, k]))}</div>
    ${svg("0 0 800 190", "Where update 1 lands in the tree", inner)}
    ${panel(pick === "cross-node" ? "done" : "ghost", `${esc(pick)}: ${esc(row[1])}`,
      fields([["Routes to", esc(row[2])], ["Here?", esc(row[3])]]))}
    <p class="files-line">The record: ${fileBtn(RECORD)}</p>`;
}

const POLICIES = {
  "additive-only": ["optional additions only; consumers ignore unknown fields", "Adding phone amends the current version in place. The schema and fixtures change, consumers keep working."],
  versioned: ["breaking changes bump the version, with a migration note", "This is v1's policy. Its schema closes the profile (additionalProperties: false) and its guarantee says exactly five fields, so phone is breaking: v2."],
  frozen: ["not under our control; a change is a new contract", "Adding phone would mean a new contract, not a new version."],
};
const SCHEMA_CHECK = [
  ["me-ayu (200)", false, true], ["me-budi (200)", false, true],
  ["me-no-token (401)", true, true], ["me-unknown-token (401)", true, true], ["me-expired-token (401)", true, true],
];
function contractView(s) {
  const pol = s.ui.policy || "versioned";
  const [rule, cost] = POLICIES[pol];
  const yes = (b) => (b ? chip("done", "valid") : chip("fail", "rejected"));
  return `<div class="bar"><span class="label">If profile-api were</span>${seg("policy", pol, Object.keys(POLICIES).map((k) => [k, k]))}</div>
    ${panel(pol === "versioned" ? "decision" : "plain", `${c("compatibility: " + pol)}`, `<p class="hint">${esc(rule)}</p><p>${esc(cost)}</p>`)}
    <h3>The v2 fixtures against both schemas</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>v2 fixture</th><th>v1 schema</th><th>v2 schema</th></tr></thead><tbody>
      ${SCHEMA_CHECK.map(([f, v1, v2]) => `<tr><td class="mono">${esc(f)}</td><td>${yes(v1)}</td><td>${yes(v2)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="hint">Checked with Ajv in strict mode before anything consumed v2. The 401 fixtures are byte copies; only the two profiles change.</p>
    <p class="files-line">Compare: ${fileBtn("hsdd/contract/profile-api.md", "profile-api.md (v1)")} ${fileBtn("hsdd/contract/profile-api.v2.md", "profile-api.v2.md")} ${fileBtn("hsdd/contract/fixture/profile-api.v2/me-ayu.json", "v2 me-ayu.json")}</p>`;
}

const RIPPLE = [
  ["hsdd/contract/auth-api.md", "token guarantee: \"accepted by profile-api@v1\"", "hsdd-contract", "contract", "names v2 too; compatible, still v1"],
  ["hsdd/adr/001-session-tokens.md", "affects: [..., profile-api@v1]", "hsdd-adr", "contract", "gains profile-api@v2 (bidirectional link)"],
  ["hsdd/contract/profile-api.md", "Versioning", "hsdd-contract", "contract", "points at v2 and its migration note"],
  ["hsdd/spec/simple-login.backend.md", "Produces: [auth-api@v1, profile-api@v1]", "no skill", "reconcile", "both versions while v1 is live [owner proxy]"],
  ["hsdd/spec/simple-login.web.md", "Consumes: [..., profile-api@v1]", "no skill", "reconcile", "both versions while v1 is live [owner proxy]"],
  ["hsdd/spec/simple-login.integration.md", "Consumes: [..., profile-api@v1]", "no skill", "reconcile", "both versions while v1 is live [owner proxy]"],
  ["hsdd/spec/simple-login.md", "child table, node sections, DAG, contract matrix, Sources", "no skill", "reconcile", "v2 edge and row added; Sources gains update 1 [owner proxy]"],
];
function rippleView(s) {
  const at = s.ui.ripple || "contract";
  const done = (step) => at === "reconcile" || step === "contract";
  return `<div class="bar"><span class="label">After</span>${seg("ripple", at, [["contract", "the contract step"], ["reconcile", "reconcile"]])}</div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Text that named profile-api@v1</th><th>Owning skill</th><th>State</th></tr></thead><tbody>
      ${RIPPLE.map(([f, what, owner, step, how]) => `<tr><td>${fileBtn(f, f.replace("hsdd/", ""))}<br><span class="hint">${esc(what)}</span></td><td>${owner === "no skill" ? chip("fail", "no skill") : chip("process", esc(owner))}</td><td>${done(step) ? chip("done", "updated") + `<br><span class="hint">${esc(how)}</span>` : chip("decision", "still says v1")}</td></tr>`).join("")}
    </tbody></table></div>`;
}

const LEDGERS = {
  backend: { shipped: SHIPPED.filter(([id]) => id.includes(".backend.")), added: PHASE["simple-login.backend.3"] },
  web: { shipped: SHIPPED.filter(([id]) => id.includes(".web.")), added: PHASE["simple-login.web.4"] },
  integration: { shipped: SHIPPED.filter(([id]) => id.includes(".integration.")), added: PHASE["simple-login.integration.2"] },
};
function planView(s) {
  const node = s.ui.lnode || "backend";
  const L = LEDGERS[node];
  return `<div class="bar"><span class="label">Node</span>${seg("lnode", node, [["backend", "backend"], ["web", "web"], ["integration", "integration"]])}</div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Phase</th><th>Name</th><th>Tier</th><th></th></tr></thead><tbody>
      ${L.shipped.map(([id, name, tier]) => `<tr class="locked"><td class="mono">${esc(id)}</td><td>${esc(name)}</td><td>${tierChip(tier)}</td><td>${chip("ghost", "shipped, never edited")}</td></tr>`).join("")}
      <tr><td class="mono"><b>${esc(L.added.id)}</b></td><td>${esc(L.added.name)}<br><span class="hint">${esc(L.added.size)}, at most ${L.added.tasks} tasks</span></td><td>${tierChip(L.added.tier)}</td><td>${chip("done", "appended")}</td></tr>
    </tbody></table></div>
    ${panel("flow", "Scope cites the record", `<p class="hint">Every appended phase says ${c("per " + RECORD)}, and the node's Sources gains the change request. That is how the closing checkpoint finds the phases.</p>`)}
    <p class="files-line">Plan: ${fileBtn(`hsdd/spec/simple-login.${node}.md`)}</p>`;
}

const ENTRIES = [
  { from: "backend", kind: "confirm", c: "profile-api@v2", text: "produced_by: [simple-login.backend.3]" },
  { from: "web", kind: "confirm", c: "profile-api@v2", text: "consumers: [simple-login.web.4]" },
  { from: "integration", kind: "confirm", c: "profile-api@v2", text: "consumers: [simple-login.integration.2]" },
  { from: "integration", kind: "confirm", c: "auth-api@v1", text: "consumers: [simple-login.integration.2]" },
  { from: "backend", kind: "note", c: "specs", text: "node Produces and the root's copies still say v1", ripple: true },
  { from: "integration", kind: "note", c: "specs", text: "Consumes still says v1; land backend.3 and integration.2 together", ripple: true },
  { from: "web", kind: "sub-bullet", c: "specs", text: "Consumes, the Overview and the root spec still say v1", ripple: true },
];
function reconcileView(s) {
  const step = Number(s.ui.rstep || 0);
  const steps = [["0", "1. Scan"], ["1", "2. Collisions"], ["2", "3. Ruling"], ["3", "4. Apply and flip"]];
  const cls = (e) => (step === 3 ? "ghost" : step === 1 ? (e.ripple ? "decision" : "done") : e.kind === "confirm" ? "flow" : "process");
  const groups = ["profile-api@v2", "auth-api@v1", "specs"];
  const status = step >= 3 ? [chip("done", "status: stable"), chip("done", "phase_ids: final")] : [chip("decision", "status: draft"), chip("decision", "phase_ids: provisional")];
  return `<div class="bar"><span class="label">Reconcile</span>${seg("rstep", step, steps)}</div>
    <div class="cols">${groups.map((g) => `<div class="panel"><h4>${esc(g)}</h4>${g === "profile-api@v2" ? `<p>${status.join(" ")}</p>` : ""}
      ${ENTRIES.filter((e) => e.c === g).map((e) => `<div class="panel ${cls(e)}" style="padding:6px 10px"><p style="font-size:13px"><b>${e.kind}</b> <span class="hint">from ${e.from}</span><br>${esc(e.text)}</p></div>`).join("")}</div>`).join("")}</div>
    <p>${[
      "Three plans emitted four confirms, two notes and a rationale sub-bullet. No request: nothing is contingent.",
      "No collision: all three confirms match v2's provisional ids. Amber: three planners each found the same stale v1 text and had no entry type that fits it.",
      "Before the flip, two planners' catch: v2 says additive-only and consumers ignore unknown fields, but its schema closes the profile. Ruled: keep it closed (a leaked field fails the replay) and say so in the contract.",
      "Confirms applied, v2 flips to stable, the sections are stamped, the registries regenerated. The stale v1 text is updated too, by ruling, since no step names it.",
    ][step]}</p>
    ${step === 2 ? proxy("The schema stays closed; an additive amendment adds its optional field to the schema in the same edit, and every existing fixture must still validate. Edited through hsdd-contract while v2 was still a draft.") : ""}
    ${step === 3 ? proxy("Node headers and the root spec list both versions while v1 is live. No reconcile step names this edit; it is logged as a finding.") : ""}`;
}

function contextView(s) {
  const id = s.ui.phase && PHASE[s.ui.phase] ? s.ui.phase : "simple-login.web.4";
  const p = PHASE[id];
  const dir = (cid) => (p.produces.includes(cid) ? "produces" : p.consumes.includes(cid) ? "consumes" : p.referenced.includes(cid) ? "referenced" : false);
  const rows = [
    ["hsdd/contract/profile-api.v2.md", "profile-api@v2", "profile-api@v2"],
    ["hsdd/contract/profile-api.md", "profile-api@v1", "profile-api@v1"],
    ["hsdd/contract/auth-api.md", "auth-api@v1", "auth-api@v1"],
  ];
  return `<div class="bar"><span class="label">Phase</span>${seg("phase", id, PHASES.map((x) => [x.id, x.id.replace("simple-login.", "")]))}</div>
    <p>${tierChip(p.tier)} ${esc(p.name)} · at most ${p.tasks} tasks · ${p.lines} lines of context</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Contract</th><th>In this context as</th></tr></thead><tbody>
      ${rows.map(([f, label, cid]) => { const d = dir(cid); return `<tr><td>${fileBtn(f, label)}</td><td>${d ? chip(d === "referenced" ? "decision" : "done", d) + ` <span class="hint">Interface, Guarantees, Validation</span>` : `<span class="hint">not seen</span>`}</td></tr>`; }).join("")}
      <tr><td>${fileBtn("hsdd/adr/001-session-tokens.md", "ADR-001")}</td><td>${chip("done", "Decision + Consequences")}</td></tr>
      <tr><td><span class="mono">${p.node === "backend" ? "web/, e2e/" : p.node === "web" ? "backend/, e2e/" : "backend/, web/ internals"}</span></td><td><span class="hint">not seen</span></td></tr>
    </tbody></table></div>
    <p class="hint">${p.referenced.includes("profile-api@v1") ? "Its Scope names profile-api@v1, the version it leaves, so v1 comes in as referenced, full text." : ""} ${p.referenced.includes("auth-api@v1") ? "auth-api@v1 follows through v2's Interface: the token comes from it." : ""}</p>
    <p class="files-line">Written by the switch: ${fileBtn(`hsdd-context/${id}.md`)} ${fileBtn(`hsdd-context/superpowers/${id}.md`)}</p>`;
}

// ---------- the stages ----------
const STAGES = [
  {
    id: "start", group: "Start", title: "A finished project gets a change", short: "one field, end to end",
    lede: "The simple-login project is done: six phases shipped and signed. Product asks for one thing more, the phone number on Home. This walkthrough follows that change through HSDD to tested code and a closed record.",
    loop: [],
    present: () => `
      <p>Every artifact here comes from an actual run on 30 October 2026, recorded as it happened. The right-hand panel shows what changed in the repository since the template; open any file, and use <b>Diff vs template</b> to see the change itself.</p>
      ${key("A PRD is never a root. There is one tree, and it is the system's. A change request does not get a spec of its own: it produces changes to the tree, and the intake record is where it is visible as one unit of work.")}
      ${say([
        "Start from the end state of the first tutorial. Nothing about it is special; it is a finished HSDD project.",
        "The change is deliberately one field. Watch how far one field travels: a contract version, three appended phases, a migration.",
        "As before, look at the cost at the end.",
      ])}
      ${proxy("HSDD stops for a human in a few places. The owner chose, before the run, to have Claude take those calls; each is marked and listed in the process log.")}
      <p class="files-line">Input: ${fileBtn("hsdd/context/update-1-add-phone.md")}</p>`,
    self: () => `
      <p>You will make the same change in your own copy of the finished project, step by step, and compare each result with the recorded run.</p>
      ${checks("start", [
        "Install the HSDD skills (v0.10.1 or later) and the superpowers plugin.",
        "Copy template/ into an empty git repository and commit it. It is the finished simple-login project plus one new file, hsdd/context/update-1-add-phone.md.",
        "Run npm run install:all and npm test once: everything is green before you change anything.",
        "Read the change request (one minute).",
      ])}
      <p class="hint">If you have not done the first tutorial, skim its walkthrough first: this one assumes you know what a contract, a phase and a reconcile are.</p>`,
    visual: () => `<h3>The change</h3>${startView()}`,
  },
  {
    id: "intake", group: "Route", title: "Route the change into the tree", short: "hsdd-intake", skill: "hsdd-intake",
    lede: "hsdd-intake reads the open intakes, finds where the change lands, classifies it, and writes the routing record before anything else runs.",
    loop: ["intake"],
    present: () => `
      ${list([
        "No open intakes to collide with, and no atlas yet, so the landing is read from the specs themselves.",
        `The phone number crosses the backend-to-web seam through ${c("profile-api")}. Three leaf-parents: class <b>cross-node</b>.`,
        `The contract decides the cost: ${c("profile-api@v1")} is ${c("versioned")} and its schema forbids extra fields, so the record routes to hsdd-contract for v2 before any phase plan.`,
        "The record carries the five handoff prompts, in order. It was written before any of them ran.",
      ])}
      ${say(["The record is the audit trail: what was decided, before anyone did anything.", "Try the other classes in the panel: each one says why it does not apply."])}
      ${wrong(["The skill's authority values (accepted RFC, draft, ticket, incident, braindump) have none for an approved PRD amendment, the most common product change. The record says ticket."])}`,
    self: () => `
      ${prompt("A change request came in: @hsdd/context/update-1-add-phone.md (approved by product). Route it into the tree.")}
      ${checks("intake", [
        "hsdd/management/YYYY-MM-DD-intake-{slug}.md exists, Status: open, before any other file changed.",
        "Class cross-node; Lands on the three leaf-parents; Contracts: profile-api@v1.",
        "Routing names hsdd-contract first, then hsdd-phase-plan on each node, then hsdd-reconcile, with exact prompts.",
        "No spec, contract or ADR was written by this step.",
      ])}
      <p class="files-line">Compare: ${fileBtn(RECORD)}</p>`,
    visual: (s) => `<h3>Where the change lands</h3>${intakeView(s)}`,
  },
  {
    id: "contract", group: "Govern", title: "Version the contract", short: "hsdd-contract", skill: "hsdd-contract",
    lede: "One field is a breaking change here, because of a policy chosen months earlier. hsdd-contract drafts profile-api@v2 beside v1, with its own schema, fixtures and migration note.",
    loop: ["contract"],
    present: () => `
      ${list([
        `v2 is a separate file, ${c("profile-api.v2.md")}, with ${c("profile-api.v2.schema.json")} and ${c("fixture/profile-api.v2/")}. v1 stays untouched and ${c("stable")} until its consumers migrate.`,
        "Checked, not assumed: the v2 profiles fail v1's schema and pass v2's.",
        "One endpoint carries one shape, and the PRD allows exactly two endpoints, so the producer cannot serve v1 and v2 side by side. The migration note says the window closes when this intake ships.",
        `v2 states its fixture format in full rather than "same as auth-api's": since v0.10.1 a cross-reference pulls the other contract into every phase context.`,
      ])}
      ${proxy("Each version declares its own compatibility, so drafting v2 forced the choice. v2 declares additive-only: the next optional field amends v2 instead of minting v3. The price is a guarantee consumers must keep: ignore fields you do not know.")}
      ${wrong(["hsdd-contract says a breaking change creates v{n+1} while the old version stays stable, but names one file per slug. Where two live versions sit was left to the run; it chose a .v2 suffix."])}
      ${say(["Switch the policy in the panel: the same field costs an amend, a version or a new contract.", "The compatibility line in the frontmatter is the cheapest place to save a future version bump."])}`,
    self: () => `
      ${prompt("Draft profile-api@v2 (adds phone) per hsdd/management/2026-10-30-intake-add-phone.md. v1 stays until its consumers migrate.")}
      ${checks("contract", [
        "A v2 contract file with status: draft, phase_ids: provisional, and its own compatibility line.",
        "A v2 schema and five v2 fixtures; validate them against both schemas (Ajv strict): the two 200s fail v1's.",
        "A migration note in v2's Versioning.",
        "hsdd/contract/INDEX.md shows two profile-api rows.",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd/contract/profile-api.v2.md")}</p>`,
    visual: (s) => `<h3>Why one field is a new version</h3>${contractView(s)}`,
  },
  {
    id: "ripple", group: "Govern", title: "Follow the ripple", short: "what else named v1",
    lede: "A version bump touches every text that named the old version. Some of it has an owning skill; some has none.",
    loop: ["contract", "reconcile"],
    present: () => `
      ${list([
        "Seven places named profile-api@v1: another contract's guarantee, the ADR's affects list, the three node specs and the root spec.",
        "Within the contract step: auth-api@v1 gets a compatible clarification, ADR-001's affects gains v2 (hsdd-adr's bidirectional-link rule), v1's Versioning points at v2.",
        "The node specs and the root spec have no owning skill for this. Every planner noticed; reconcile updated them by ruling.",
      ])}
      ${say(["Toggle the panel: after the contract step, then after reconcile.", "Red chips are the finding: a version bump has no checklist of what it must update."])}`,
    self: () => `
      ${prompt("Search the tree for every mention of profile-api@v1 and list which skill owns each one.")}
      ${checks("ripple", [
        "auth-api's token guarantee names v2 as well (compatible, still v1).",
        "ADR-001's affects lists profile-api@v2.",
        "Note the node and root spec lines that still say v1: reconcile handles them later.",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd/contract/auth-api.md")} ${fileBtn("hsdd/adr/001-session-tokens.md")}</p>`,
    visual: (s) => `<h3>Every text that named the old version</h3>${rippleView(s)}`,
  },
  {
    id: "plan", group: "Govern", title: "Append phases", short: "hsdd-phase-plan ×3, append", skill: "hsdd-phase-plan",
    lede: "Each landing node gets new phases at the end of its plan. Shipped phases are a permanent ledger: never renumbered, never rewritten.",
    loop: ["plan"],
    present: () => `
      ${list([
        "Three fresh agents planned in parallel, one per node, each forbidden the others' plans.",
        "One phase each: backend.3 produces v2, web.4 consumes it and shows the number, integration.2 proves AC-2.1 and AC-2.4 in the browser. All spot-check, 35 to 70 lines.",
        "Each Scope cites the intake record; each node's Sources gains the change request.",
      ])}
      ${wrong([
        "The red window: once backend.3 serves v2, integration.1's exact replay of v1 fails, so the build is red until integration.2 lands. The integration planner worked it out, the web planner reached it from its side; both wrote it in: the three phases land together.",
        "A contradiction in the v2 draft: additive-only and \"ignore unknown fields\", yet a closed schema. Two planners noticed; the fix belonged to hsdd-contract, before the flip.",
      ])}
      ${say(["Append mode is why history survives: the ledger of what shipped never changes.", "The planners caught a sequencing hazard before any code. Planning in isolation, against frozen contracts, still lets each side see the whole seam."])}`,
    self: () => `
      ${prompt("/hsdd-phase-plan simple-login.backend per hsdd/management/2026-10-30-intake-add-phone.md")}
      ${prompt("/hsdd-phase-plan simple-login.web per hsdd/management/2026-10-30-intake-add-phone.md")}
      ${prompt("/hsdd-phase-plan simple-login.integration per hsdd/management/2026-10-30-intake-add-phone.md")}
      ${checks("plan", [
        "Each node gained one phase after its last shipped one; no existing row, section or graph edge changed.",
        "Each new Scope names the intake record.",
        "Each plan ends with a new pending-governance block: a confirm for profile-api@v2.",
        "Did your planners notice the red window? Ours did.",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd/spec/simple-login.backend.md")} ${fileBtn("hsdd/spec/simple-login.web.md")}</p>`,
    visual: (s) => `<h3>Shipped rows stay; new rows append</h3>${planView(s)}`,
  },
  {
    id: "reconcile", group: "Govern", title: "Reconcile", short: "hsdd-reconcile", skill: "hsdd-reconcile",
    lede: "One writer applies the three plans' entries at the root. This time there was no collision, one wording fix, and a ripple no step names.",
    loop: ["reconcile"],
    present: () => `
      ${list([
        "Grouped by contract, the three confirms agree with v2's provisional ids. No collision.",
        "The schema question settled before the flip: closed stays closed, and the contract now says why.",
        "v2 flips to stable with final phase ids; auth-api gains integration.2 as a consumer; the registries show two profile-api rows.",
        "The node headers and the root spec now list both versions, by ruling.",
      ])}
      ${say(["Step through the panel. Compare with the first run's reconcile, which caught a real collision: here the seam was already agreed, so the planners agreed too."])}`,
    self: () => `
      ${prompt("Reconcile: drain the pending governance updates.")}
      ${checks("reconcile", [
        "profile-api@v2: status: stable, phase_ids: final.",
        "auth-api@v1 consumers include simple-login.integration.2.",
        "Each plan's new pending block replaced by a Reconciled stamp.",
        "Decide where your node headers say v1 or v2; ours list both until v1 is deprecated.",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd/contract/profile-api.v2.md")} ${fileBtn("hsdd/spec/simple-login.md")}</p>`,
    visual: (s) => `<h3>Seven entries, no collision</h3>${reconcileView(s)}`,
  },
  {
    id: "context", group: "Execute", title: "Switch the phase contexts", short: "hsdd-config", skill: "hsdd-config",
    lede: "The same switch as before, now with v0.10.1's rules: every contract carries its Validation section, and a contract the phase only names comes in as referenced.",
    loop: ["config"],
    present: () => `
      ${list([
        "Each migration phase's Scope names profile-api@v1, the version it leaves, so v1's full text is in its context as referenced.",
        "auth-api@v1 follows through v2's Interface: the token comes from it.",
        "The cost: about 250 lines per context, against 65 to 190 in the first run. For a migration phase the old version is useful: its Validation names the fixture paths the phase must stop reading.",
      ])}
      ${say(["Pick a phase in the panel: what it sees, and in which role."])}`,
    self: () => `
      ${prompt("/hsdd-phase simple-login.backend.3")}
      ${prompt("/hsdd-phase simple-login.web.4")}
      ${prompt("/hsdd-phase simple-login.integration.2")}
      ${checks("context", [
        "Each context has a profile-api@v2 subsection with Interface, Guarantees and Validation.",
        "profile-api@v1 appears as referenced, and a Referenced line in Discipline names it.",
        "The equality check prints nothing for all three.",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd-context/simple-login.web.4.md")}</p>`,
    visual: (s) => `<h3>What each phase sees</h3>${contextView(s)}`,
  },
];

// ---------- self-guided helpers (stateful through the shell) ----------
function prompt(text) {
  return `<div class="prompt"><div class="prompt-head"><b>Type this</b><button class="btn small" ${act("copy", text)}>Copy</button></div><pre>${esc(text)}</pre></div>`;
}
function checks(stage, items) {
  const done = (window.WALK_CHECKS && window.WALK_CHECKS[stage]) || {};
  return `<div><h2>Check your result</h2><ul class="checks">${items.map((t, i) => `<li><label><input type="checkbox" ${act("check", `${stage}:${i}`)} ${done[i] ? "checked" : ""}><span>${t}</span></label></li>`).join("")}</ul></div>`;
}

window.WALK_STAGES = STAGES;
window.WALK_PARTS = { PHASES, PHASE, RECORD, prompt, checks, homeMock };
})();
