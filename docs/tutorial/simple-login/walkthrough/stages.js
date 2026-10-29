// simple-login walkthrough: the stages. Each stage is a value: its text for
// the two modes and a visual, both functions from the state to HTML.
"use strict";
(() => {
const { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say, marker, box, path, svg, loopStrip } = window.WL;
const R = window.WALK_RESULTS || {};

// ---------- shared facts about the run ----------
const NODES = {
  "simple-login": { kind: "root", purpose: "let a registered user sign in with a username and password, see their own profile, and sign out", file: "hsdd/spec/simple-login.md" },
  "simple-login.backend": { kind: "leaf", purpose: "authenticate built-in users and serve the signed-in user's profile over HTTP", owns: "accounts, password checks, sessions, POST /api/login, GET /api/me", produces: "auth-api@v1, profile-api@v1", consumes: "none", file: "hsdd/spec/simple-login.backend.md" },
  "simple-login.web": { kind: "leaf", purpose: "let a user sign in, see their profile and sign out in the browser", owns: "Login and Home screens, the API client, token storage, the dev proxy", produces: "none", consumes: "auth-api@v1, profile-api@v1", file: "hsdd/spec/simple-login.web.md" },
  "simple-login.integration": { kind: "integration", purpose: "prove the real service and the real web app work together, end to end", owns: "root scripts, the browser test, run instructions", produces: "none", consumes: "auth-api@v1, profile-api@v1", file: "hsdd/spec/simple-login.integration.md" },
};

const PHASES = [
  { id: "simple-login.backend.1", node: "backend", name: "Skeleton, domain types, contract replay rig", tier: "gate-only", tasks: 5, consumes: [], produces: [] },
  { id: "simple-login.backend.2", node: "backend", name: "Sign-in, sessions and the two endpoints", tier: "full-review", tasks: 7, consumes: [], produces: ["auth-api@v1", "profile-api@v1"] },
  { id: "simple-login.web.1", node: "web", name: "App skeleton, API client, session storage", tier: "spot-check", tasks: 6, consumes: ["auth-api@v1", "profile-api@v1"], produces: [] },
  { id: "simple-login.web.2", node: "web", name: "Login screen", tier: "spot-check", tasks: 5, consumes: ["auth-api@v1"], produces: [], referenced: ["profile-api@v1"] },
  { id: "simple-login.web.3", node: "web", name: "Home screen and the session flow", tier: "full-review", tasks: 6, consumes: ["profile-api@v1"], produces: [], referenced: ["auth-api@v1"] },
  { id: "simple-login.integration.1", node: "integration", name: "End-to-end run and browser test", tier: "full-review", tasks: 6, consumes: ["auth-api@v1", "profile-api@v1"], produces: [] },
];
const PHASE = Object.fromEntries(PHASES.map((p) => [p.id, p]));

const FIXTURES = {
  "auth-api": [
    ["login-success", "schema", "ayu / sunrise-42", "200 token, Bearer, expiresAt"],
    ["login-wrong-password", "exact", "ayu / sunset-42", "401 INVALID_CREDENTIALS"],
    ["login-unknown-user", "exact", "citra / sunrise-42", "401 INVALID_CREDENTIALS (same bytes)"],
    ["login-missing-password", "exact", "ayu / (none)", "400 VALIDATION_FAILED"],
    ["login-empty-username", "exact", "(empty) / sunrise-42", "400 VALIDATION_FAILED"],
  ],
  "profile-api": [
    ["me-ayu", "exact", "Bearer {{token:ayu}}", "200 Ayu's five fields"],
    ["me-budi", "exact", "Bearer {{token:budi}}", "200 Budi's five fields"],
    ["me-no-token", "exact", "(no header)", "401 UNAUTHORIZED"],
    ["me-unknown-token", "exact", "Bearer AAAA…", "401 UNAUTHORIZED"],
    ["me-expired-token", "exact", "Bearer {{expired-token:ayu}}", "401 UNAUTHORIZED (same bytes)"],
  ],
};

// ---------- visuals ----------
function screensView(withShots) {
  const shots = withShots && R.screens;
  if (shots) {
    return `<div class="screens">${shots.map((s) => `<figure class="screen" style="margin:0"><div class="screen-bar"><i></i><i></i><i></i><span>${esc(s.url)}</span></div><img src="${s.src}" alt="${esc(s.alt)}"><figcaption class="hint" style="padding:6px 10px">${esc(s.caption)}</figcaption></figure>`).join("")}</div>`;
  }
  return `<div class="screens">
    <div class="screen"><div class="screen-bar"><i></i><i></i><i></i><span>localhost:5173</span></div><div class="screen-body">
      <h4>Sign in</h4>
      <div class="mini-field">Username<span>ayu</span></div>
      <div class="mini-field">Password<span>••••••••••</span></div>
      <span class="mini-btn">Sign in</span>
      <span class="mini-err">Incorrect username or password.</span>
    </div></div>
    <div class="screen"><div class="screen-bar"><i></i><i></i><i></i><span>localhost:5173</span></div><div class="screen-body">
      <h4>Hello, Ayu Lestari</h4>
      ${fields([["Username", "ayu"], ["Email", "ayu@example.com"], ["Member since", "14 March 2024"]])}
      <span class="mini-btn ghost">Sign out</span>
    </div></div>
  </div>
  <div class="cols">
    ${panel("flow", "Two endpoints", `<p>${c("POST /api/login")} returns a token; ${c("GET /api/me")} returns the profile.</p>`)}
    ${panel("flow", "No database", `<p>Two demo accounts live in memory: ${c("ayu")} and ${c("budi")}.</p>`)}
    ${panel("flow", "Two people", `<p>One backend developer, one frontend developer, working in parallel.</p>`)}
  </div>`;
}

function treeView(s) {
  const sel = s.ui.node || "simple-login.backend";
  const edges = s.ui.edges || "all";
  const show = (t) => edges === "all" || edges === t;
  const n = NODES[sel];
  const inner = `${marker("a1")}
    ${box({ x: 300, y: 16, w: 200, kind: "root", title: "simple-login", sub: "root · internal", action: "node", value: "simple-login", selected: sel === "simple-login" })}
    ${path("M400,66 C400,96 130,96 130,128", "", "a1")}${path("M400,66 L400,128", "", "a1")}${path("M400,66 C400,96 670,96 670,128", "", "a1")}
    ${box({ x: 40, y: 130, w: 180, kind: "leaf", title: "simple-login.backend", sub: "leaf-parent", action: "node", value: "simple-login.backend", selected: sel === "simple-login.backend" })}
    ${box({ x: 310, y: 130, w: 180, kind: "leaf", title: "simple-login.web", sub: "leaf-parent", action: "node", value: "simple-login.web", selected: sel === "simple-login.web" })}
    ${box({ x: 580, y: 130, w: 180, kind: "integration", title: "simple-login.integration", sub: "leaf-parent", action: "node", value: "simple-login.integration", selected: sel === "simple-login.integration" })}
    ${path("M220,165 L306,165", `contract ${show("contract") ? "" : "dim"}`, "a1")}
    <text class="t-edge" x="263" y="157" text-anchor="middle" opacity="${show("contract") ? 1 : 0.2}">auth-api@v1</text>
    <text class="t-edge" x="263" y="190" text-anchor="middle" opacity="${show("contract") ? 1 : 0.2}">profile-api@v1</text>
    ${path("M130,180 C130,250 640,250 660,184", `hard ${show("hard") ? "" : "dim"}`, "a1")}
    ${path("M400,180 C400,222 600,222 640,184", `hard ${show("hard") ? "" : "dim"}`, "a1")}
    <text class="t-edge" x="400" y="252" text-anchor="middle" opacity="${show("hard") ? 1 : 0.2}">hard: the real, running service and app</text>`;
  return `<div class="bar"><span class="label">Edges</span>${seg("edges", edges, [["all", "All"], ["contract", "contract"], ["hard", "hard"]])}</div>
    ${svg("0 0 800 270", "The simple-login tree", inner)}
    <p class="hint">Dashed blue: a ${c("contract")} edge, the consumer builds against fixtures and never waits. Solid amber: a ${c("hard")} edge, the consumer needs the real thing running. Click a node.</p>
    ${panel(n.kind === "root" ? "flow" : n.kind === "integration" ? "decision" : "impl", esc(sel),
      fields([["Purpose", esc(n.purpose)], ...(n.owns ? [["Owns", esc(n.owns)], ["Consumes", esc(n.consumes)], ["Produces", esc(n.produces)]] : [["Decomposes into", "backend, web, integration"]]), ["File", fileBtn(n.file)]]))}`;
}

function adrView(s) {
  const show = s.ui.adr || "phase";
  const parts = [
    ["Frontmatter: id, status, affects", "registry", "frontmatter"],
    ["## Context", "people", "context"],
    ["## Decision", "phase", "decision"],
    ["## Consequences", "phase", "consequences"],
    ["## Alternatives considered", "people", "alternatives"],
  ];
  return `<div class="bar"><span class="label">Who reads it</span>${seg("adr", show, [["phase", "A phase context"], ["registry", "The registry"], ["people", "People"]])}</div>
    <div class="cols" style="grid-template-columns:1fr">
    ${parts.map(([label, reader]) => panel(reader === show ? (show === "phase" ? "done" : show === "registry" ? "flow" : "process") : "ghost", esc(label),
      `<p class="hint">${reader === "phase" ? "Injected, verbatim, into every phase context that ADR-001 governs." : reader === "registry" ? "Projected into hsdd/adr/INDEX.md by gen-registry.mjs." : "Kept for people. Never injected into a phase."}</p>`)).join("")}
    </div>
    <p class="files-line">File: ${fileBtn("hsdd/adr/001-session-tokens.md")} ${fileBtn("hsdd/adr/INDEX.md")}</p>`;
}

function contractView(s) {
  const slug = s.ui.slug || "auth-api";
  const fx = s.ui.fixture || FIXTURES[slug][0][0];
  const row = FIXTURES[slug].find((f) => f[0] === fx) || FIXTURES[slug][0];
  const side = s.ui.side || "producer";
  return `<div class="bar"><span class="label">Contract</span>${seg("slug", slug, [["auth-api", "auth-api@v1"], ["profile-api", "profile-api@v1"]])}</div>
    <div class="cols">
      ${panel("flow", "Frontmatter", `<p class="hint">id, version, status, owner, produced_by, consumers, phase_ids. Machine-read; projected into ${c("INDEX.md")}.</p><p>${chip("decision", "status: draft")} ${chip("decision", "phase_ids: provisional")}</p>`)}
      ${panel("done", "Interface + Guarantees", `<p class="hint">The part injected into phase contexts. ${slug === "auth-api" ? "Three outcomes: 200, 400, 401; unknown user and wrong password byte-identical." : "200 with exactly five fields; one 401 body for every rejection."}</p>`)}
      ${panel("observed", "Validation", `<p class="hint">Schema and fixtures. A contract cannot become ${c("stable")} without them.</p>`)}
    </div>
    <div class="bar"><span class="label">Fixtures</span>${seg("fixture", row[0], FIXTURES[slug].map((f) => [f[0], f[0].replace(/^(login|me)-/, "")]))}</div>
    ${panel("plain", `${esc(row[0])} ${chip(row[1] === "exact" ? "done" : "observed", `replay: ${row[1]}`)}`,
      fields([["Request", c(row[2])], ["Response", esc(row[3])]]) +
      `<div class="bar"><span class="label">Who uses it</span>${seg("side", side, [["producer", "Backend gate"], ["consumer", "Web tests"]])}</div>
       <p>${side === "producer"
         ? `The backend's gate sends this request to the real routes and checks the answer: ${row[1] === "exact" ? "the body must equal the fixture" : "the body must validate against the schema (token and expiry vary)"}.`
         : "The web app's tests stub fetch with this response. The mocks are the fixtures, so nobody hand-writes a mock that can drift."}</p>`)}
    <p class="files-line">Files: ${fileBtn(`hsdd/contract/${slug}.md`)} ${fileBtn(`hsdd/contract/schema/${slug}.schema.json`)} ${fileBtn(`hsdd/contract/fixture/${slug}/${row[0]}.json`)}</p>`;
}

function plansView(s) {
  const floor = s.ui.floor !== "draft";
  const lane = (title, phases) => `<div class="panel"><h4>${title}</h4>${phases.map((p) => `<div class="panel ${p.ghost ? "ghost" : p.tier === "full-review" ? "decision" : p.tier === "spot-check" ? "impl" : "done"}">
      <div class="bar" style="justify-content:space-between"><span class="mono" style="font-size:12px">${esc(p.id)}</span>${tierChip(p.tier)}</div>
      <p style="font-size:13.5px">${esc(p.name)}</p>${p.note ? `<p class="hint">${p.note}</p>` : ""}</div>`).join("")}</div>`;
  const backend = floor
    ? [PHASE["simple-login.backend.1"], { ...PHASE["simple-login.backend.2"], note: "merged: logic and routes share a tier and contracts, and fit 7 tasks" }]
    : [PHASE["simple-login.backend.1"], { id: "backend.2 (draft)", name: "Password and session logic", tier: "full-review" }, { id: "backend.3 (draft)", name: "HTTP routes", tier: "full-review" }];
  return `<div class="bar"><span class="label">Backend plan</span>${seg("floor", floor ? "floor" : "draft", [["draft", "First draft"], ["floor", "After the sizing floor"]])}</div>
    <div class="cols">${lane("simple-login.backend", backend)}${lane("simple-login.web", PHASES.filter((p) => p.node === "web"))}${lane("simple-login.integration", PHASES.filter((p) => p.node === "integration"))}</div>
    <p class="hint">${tierChip("gate-only")} the gate passing is the review. ${tierChip("spot-check")} glance at the diff. ${tierChip("full-review")} read the diff and run the manual checks.</p>`;
}

const ENTRIES = [
  { from: "backend", kind: "confirm", c: "auth-api", text: "produced_by: [simple-login.backend.2]" },
  { from: "backend", kind: "confirm", c: "profile-api", text: "produced_by: [simple-login.backend.2]" },
  { from: "backend", kind: "amend", c: "auth-api", text: "usernames match exactly: case-sensitive, no trimming", answers: "web-user" },
  { from: "backend", kind: "amend", c: "auth-api", text: "development address http://127.0.0.1:3000, PORT overrides", clash: true },
  { from: "backend", kind: "amend", c: "profile-api", text: "same development address" },
  { from: "web", kind: "confirm", c: "auth-api", text: "consumers: [web.1, web.2]" },
  { from: "web", kind: "confirm", c: "profile-api", text: "consumers: [web.1, web.3]" },
  { from: "web", kind: "request", c: "auth-api", text: "where does the service listen? assumption: http://localhost:3000", clash: true },
  { from: "web", kind: "request", c: "auth-api", text: "case-sensitive? should a client trim? assumption: send as typed", id: "web-user" },
  { from: "integration", kind: "confirm", c: "auth-api", text: "consumers: [integration.1]" },
  { from: "integration", kind: "confirm", c: "profile-api", text: "consumers: [integration.1]" },
  { from: "integration", kind: "request", c: "auth-api", text: "development address? assumption: http://localhost:3000", clash: true },
];

function reconcileView(s) {
  const step = Number(s.ui.rstep || 0);
  const steps = [["0", "1. Scan"], ["1", "2. Collisions"], ["2", "3. Apply"], ["3", "4. Flip status"]];
  const cls = (e) => {
    if (step === 1 && e.clash) return "fail";
    if (step === 1 && (e.answers || e.id)) return "done";
    if (step >= 2) return "ghost";
    return e.kind === "request" ? "decision" : e.kind === "amend" ? "process" : "flow";
  };
  const byContract = (slug) => ENTRIES.filter((e) => e.c === slug);
  const status = step >= 3 ? [chip("done", "status: stable"), chip("done", "phase_ids: final")] : [chip("decision", "status: draft"), chip("decision", "phase_ids: provisional")];
  return `<div class="bar"><span class="label">Reconcile</span>${seg("rstep", step, steps)}</div>
    <div class="cols">${["auth-api", "profile-api"].map((slug) => `<div class="panel"><h4>${slug}@v1</h4><p>${status.join(" ")}</p>
      ${byContract(slug).map((e) => `<div class="panel ${cls(e)}" style="padding:6px 10px"><p style="font-size:13px"><b>${e.kind}</b> <span class="hint">from ${e.from}</span><br>${esc(e.text)}</p></div>`).join("")}</div>`).join("")}</div>
    <p>${[
      "Three plans emitted twelve entries. Reconcile groups them by contract before applying anything.",
      "Red: a collision. The backend said 127.0.0.1, two consumers assumed localhost. That goes to the human. Green: a request the producer's amend already answers; no collision.",
      "Confirms go into frontmatter; answers and amends go into the contract bodies as compatible additions, so the version stays v1. Each plan's section is stamped as drained.",
      "Both sides confirmed, no open request, schema and fixtures on disk: both contracts flip to stable. From now on any phase can build against them.",
    ][step]}</p>
    ${step === 1 ? proxy("Decided for 127.0.0.1: the backend binds only that address, and localhost can resolve to IPv6 first. The web and integration plans were updated to match.") : ""}`;
}

function contextView(s) {
  const id = s.ui.phase || "simple-login.web.2";
  const p = PHASE[id];
  const all = [
    ["hsdd/spec/simple-login.md", "root spec", false],
    ["hsdd/spec/simple-login.backend.md", "backend spec + plan", p.node === "backend" ? "phase section and node fields" : false],
    ["hsdd/spec/simple-login.web.md", "web spec + plan", p.node === "web" ? "phase section and node fields" : false],
    ["hsdd/spec/simple-login.integration.md", "integration spec + plan", p.node === "integration" ? "phase section and node fields" : false],
    ["hsdd/contract/auth-api.md", "contract", p.consumes.includes("auth-api@v1") || p.produces.includes("auth-api@v1") ? "Interface + Guarantees" : (p.referenced || []).includes("auth-api@v1") ? "referenced (gate pulled it in)" : false],
    ["hsdd/contract/profile-api.md", "contract", p.consumes.includes("profile-api@v1") || p.produces.includes("profile-api@v1") ? "Interface + Guarantees" : (p.referenced || []).includes("profile-api@v1") ? "referenced (gate pulled it in)" : false],
    ["hsdd/adr/001-session-tokens.md", "ADR", "Decision + Consequences"],
    ["hsdd/context/prd-simple-login.md", "PRD", false],
    ["hsdd/context/rfc-simple-login.md", "RFC", false],
    ["backend/", "backend code", false],
    ["web/", "web code", false],
  ];
  return `<div class="bar"><span class="label">Phase</span>${seg("phase", id, PHASES.map((x) => [x.id, x.id.replace("simple-login.", "")]))}</div>
    <p>${tierChip(p.tier)} ${esc(p.name)} · at most ${p.tasks} tasks</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>File in the repository</th><th>In this phase's context</th></tr></thead><tbody>
    ${all.map(([f, what, inn]) => `<tr><td>${f.endsWith("/") ? `<span class="mono">${f}</span>` : fileBtn(f)} <span class="hint">${what}</span></td><td>${inn ? chip(String(inn).startsWith("referenced") ? "decision" : "done", esc(inn)) : `<span class="hint">not seen</span>`}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="files-line">Written by the switch: ${fileBtn(`hsdd-context/${id}.md`)} ${fileBtn(`hsdd-context/superpowers/${id}.md`)}</p>`;
}

// ---------- the stages ----------
const STAGES = [
  {
    id: "start", group: "Start", title: "The exercise", short: "PRD and RFC in, running code out",
    lede: "A login backend with two endpoints and a web app with two screens, taken from a one-page PRD to running, tested code with every HSDD step, and recorded as it happened.",
    loop: [],
    present: () => `
      <p>Every artifact you will see was produced by an actual run on 29 and 30 October 2026, not written for the slides. The right-hand panel is the repository as each step left it; click any file to read it.</p>
      ${say([
        "The product is deliberately tiny, so we can see every HSDD step in one sitting.",
        "Watch for three things: what each step writes, what the next step reads, and where a person has to decide.",
        "At the end we look at the cost honestly. For a product this small the process outweighs the code; the question is what it bought.",
      ])}
      ${proxy("HSDD stops for a human in a few places. The owner was asleep and asked for no questions, so Claude took those calls and marked each one. They are decisions to check, not facts.")}
      <p class="files-line">Inputs: ${fileBtn("hsdd/context/prd-simple-login.md")} ${fileBtn("hsdd/context/rfc-simple-login.md")}</p>`,
    self: () => `
      <p>You will rebuild this project yourself, step by step, in your own repository, and compare each result with the recorded run.</p>
      ${checks("start", [
        "Install the HSDD skills (see the repository README) and the superpowers plugin.",
        "Create an empty git repository and copy template/hsdd/ into it, so it has hsdd/context/ with the PRD and RFC.",
        "Read the PRD (two minutes) and skim the RFC.",
      ])}
      <p class="hint">Each stage gives you the prompt to type, what to check, and the recorded file to compare with. Your wording will differ; the structure should not.</p>`,
    visual: () => `<h3>What we build</h3>${screensView(false)}`,
  },
  {
    id: "decompose", group: "Plan", title: "Decompose the root", short: "hsdd-spec", skill: "hsdd-spec",
    lede: "hsdd-spec turns the PRD and RFC into a tree of nodes joined by named contracts. The split follows who builds what.",
    loop: ["spec"],
    present: () => `
      ${list([
        `The PRD answers the one question hsdd-spec must otherwise stop and ask: <em>who builds what?</em> One backend developer, one frontend developer. So the split follows the stack.`,
        `The two halves exchange contracts, so the skill adds a third child, ${c("simple-login.integration")}, with <b>hard</b> edges: it needs both halves really running.`,
        `Each child is a <b>leaf-parent</b>: one owner can hold it in their head, and it splits into a few phases. Two levels is as deep as this product needs.`,
        `Contracts are named here (${c("auth-api@v1")}, ${c("profile-api@v1")}), not written. Every edge has a type.`,
      ])}
      ${say([
        "The tree is drawn along ownership, not along layers. Two people, two nodes.",
        "Contract edges are why the web developer never waits for the backend.",
        "Notice the Sources lines: each node points at the RFC sections that govern it, so a later step reads the original, not a summary.",
      ])}`,
    self: () => `
      ${prompt("Write a high-level spec for simple-login from @hsdd/context/prd-simple-login.md and @hsdd/context/rfc-simple-login.md.")}
      ${checks("decompose", [
        "hsdd/conventions.md exists.",
        "hsdd/spec/simple-login.md has a Sources section, a typed dependency DAG and a contract matrix.",
        "One file per child under hsdd/spec/, each a leaf-parent with Consumes, Produces and Sources lines.",
        "The skill did not ask who builds what (the PRD says). If yours asked, check your PRD copy.",
      ])}
      <p class="files-line">Compare: ${fileBtn("hsdd/spec/simple-login.md")} ${fileBtn("hsdd/conventions.md")}</p>`,
    visual: (s) => `<h3>The tree and its edges</h3>${treeView(s)}`,
  },
  {
    id: "adr", group: "Plan", title: "Record the cross-cutting decision", short: "hsdd-adr", skill: "hsdd-adr",
    lede: "The session-token model binds both nodes and both contracts, so it becomes ADR-001: a file, not a paragraph in a spec.",
    loop: ["adr"],
    present: () => `
      ${list([
        "Opaque bearer tokens, in memory, a fixed 30 minutes, sign-out on the client. The RFC already accepted it, so the ADR is born accepted.",
        "Only the Decision and Consequences are injected into phase contexts. The Context and the alternatives stay for people.",
        "Fastify, React, scrypt and sessionStorage stay out: each lives on one side, so each is a node-local choice.",
      ])}
      ${say(["ADRs are few on purpose. One decision spans both sides here, so there is one ADR.", "Toggle the panel to show what a phase actually sees of an ADR."])}`,
    self: () => `
      ${prompt("Write the ADR for the session-token decision hsdd-spec proposed. The RFC accepted it.")}
      ${checks("adr", ["hsdd/adr/001-*.md with frontmatter: id, status: accepted, affects, date.", "affects names both nodes and both contracts.", "hsdd/adr/INDEX.md was generated, not written by hand."])}
      <p class="files-line">Compare: ${fileBtn("hsdd/adr/001-session-tokens.md")}</p>`,
    visual: (s) => `<h3>Anatomy of ADR-001</h3>${adrView(s)}`,
  },
  {
    id: "contracts", group: "Plan", title: "Write the contracts", short: "hsdd-contract", skill: "hsdd-contract",
    lede: "Each contract is a file with an interface, guarantees, a JSON Schema and replayable fixtures. The fixtures are the mocks.",
    loop: ["contract"],
    present: () => `
      ${list([
        `Two contracts, ten fixtures. ${c("replay: exact")} means the backend's real body must equal the fixture; ${c("replay: schema")} is used only where values vary (the token).`,
        "No shared code package. Each side writes its own types; the schema and fixtures are the only shared artifacts.",
        "Both start as draft with provisional phase ids. Only reconcile may change that.",
      ])}
      ${wrong(["A scratch check compiled the schemas with Ajv in strict mode: the first draft failed (a subschema used properties without type: object). Fixed before anything consumed it."])}
      ${say(["The backend proves its responses against these files; the web app tests against the same files. That is what keeps two parallel lanes honest."])}`,
    self: () => `
      ${prompt("Define the auth-api and profile-api contracts: simple-login.backend produces them; simple-login.web and simple-login.integration consume them. Write the schema and the fixtures too.")}
      ${checks("contracts", ["hsdd/contract/{auth-api,profile-api}.md with complete frontmatter, status: draft, phase_ids: provisional.", "A schema per contract under hsdd/contract/schema/ and fixtures under hsdd/contract/fixture/.", "Validate every fixture against its schema (Ajv, strict mode) before you move on.", "hsdd/contract/INDEX.md regenerated."])}
      <p class="files-line">Compare: ${fileBtn("hsdd/contract/auth-api.md")} ${fileBtn("hsdd/contract/profile-api.md")}</p>`,
    visual: (s) => `<h3>Contract anatomy and fixtures</h3>${contractView(s)}`,
  },
  {
    id: "plan", group: "Plan", title: "Plan the phases", short: "hsdd-phase-plan ×3", skill: "hsdd-phase-plan",
    lede: "Each leaf-parent becomes a few phases, each one review sitting. Planners read only frozen governance and emit their changes as data.",
    loop: ["plan"],
    present: () => `
      ${list([
        "Six phases: backend 2, web 3, integration 1. Each has a tier, a gate command, a size estimate and at most 8 tasks.",
        "The sizing floor merged two backend phases: same tier, same contracts, still under 8 tasks together. Toggle the panel to see the draft.",
        "Reading the RFC changed the plan: the dummy-hash timing defence, no secrets in logs, and the injected clock are in phase scopes because they exist only in the RFC.",
        "No planner edited a contract. Each plan ends with a pending-governance section: confirms, amends, requests.",
      ])}
      ${say(["Phases are sized to human review, not to code. A gate-only phase needs no reading; a full-review phase gets the diff read and the manual checks run.", "Three planners worked from the same frozen snapshot without seeing each other. That is what lets them run in parallel."])}`,
    self: () => `
      ${prompt("simple-login.backend is small enough to phase. Write its phase plan.")}
      ${prompt("Write the phase plan for simple-login.web.")}
      ${prompt("Write the phase plan for simple-login.integration.")}
      ${checks("plan", ["Each node spec gained a Phase Plan with a summary table, tiers, gates and a Mermaid graph.", "Each plan ends with Governance updates (pending reconcile).", "Nothing under hsdd/contract/ changed.", "Did your web planner also ask where the backend listens? Ours did."])}
      <p class="files-line">Compare: ${fileBtn("hsdd/spec/simple-login.backend.md")} ${fileBtn("hsdd/spec/simple-login.web.md")}</p>`,
    visual: (s) => `<h3>Six phases in three lanes</h3>${plansView(s)}`,
  },
  {
    id: "reconcile", group: "Plan", title: "Reconcile", short: "hsdd-reconcile", skill: "hsdd-reconcile",
    lede: "One writer applies every planner's changes at the root. Disagreements surface here, as a line in a report, before any code exists.",
    loop: ["reconcile"],
    present: () => `
      ${list([
        "Twelve entries from three plans, grouped by contract before anything is applied.",
        "One collision: where the backend runs. The backend said 127.0.0.1; both consumers assumed localhost.",
        "One request the producer had already answered: usernames match exactly.",
        "Result: both contracts stable, phase ids final, still v1.",
      ])}
      ${say(["Without this step the localhost mismatch shows up on integration day as a proxy that cannot connect.", "Step through the four stages in the panel."])}`,
    self: () => `
      ${prompt("Reconcile the phase plans: drain the pending governance updates.")}
      ${checks("reconcile", ["Every contract: phase_ids: final, status: stable.", "Each plan's pending section replaced by a one-line Reconciled stamp.", "Any collision was put to you, with both sides quoted.", "Registries regenerated."])}
      <p class="files-line">Compare: ${fileBtn("hsdd/contract/auth-api.md")}</p>`,
    visual: (s) => `<h3>Twelve entries, one collision</h3>${reconcileView(s)}`,
  },
  {
    id: "context", group: "Execute", title: "Switch the phase context", short: "hsdd-config", skill: "hsdd-config",
    lede: "Before each phase, one file gathers everything that phase needs, copied verbatim, and nothing else. That file is the coding session's whole world.",
    loop: ["config"],
    present: () => `
      ${list([
        "The generic context: the phase's bullet block, its node's boundaries, the full text of its contracts and ADRs, the discipline lines.",
        "The superpowers derivative wraps it with eight Global Constraints: test-first, the task cap, the gate, the verification doc, the governance freeze.",
        "Pick a phase in the panel to see what it sees, and what it never sees.",
      ])}
      ${wrong(["The self-contained gate tripped twice: web.2 and web.3 each named the other contract inside a guarantee. Fixed in the file, as the skill says: each gained the referenced contract's text.", "backend.1 builds the replay rig but consumes no contract, so its context had no fixture format; the session had to follow the links."])}
      ${say(["This is the token saving: a phase reads one file of 70 to 200 lines, not the whole tree.", "It is also the discipline carrier: TDD and the verification doc travel in the file, not in someone's memory."])}`,
    self: () => `
      ${prompt("Set up HSDD for superpowers.")}
      ${prompt("/hsdd-phase simple-login.backend.1")}
      ${checks("context", ["hsdd/conventions.md says Coding method: superpowers.", "hsdd-context/simple-login.backend.1.md and hsdd-context/superpowers/simple-login.backend.1.md exist.", "The two bodies are identical (the switch's diff check prints nothing).", "Every contract or ADR id in the file has its text in the file."])}
      <p class="files-line">Compare: ${fileBtn("hsdd-context/superpowers/simple-login.backend.1.md")}</p>`,
    visual: (s) => `<h3>What a phase sees</h3>${contextView(s)}`,
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
window.WALK_PARTS = { PHASES, PHASE, prompt, checks, screensView };
})();
