/* HSDD guide.
   Pure core: example data, glossary and chapters are plain values, and every
   view is a function from the state value to an HTML string. Imperative
   shell (the last section): routing, events, focus, and storage.
   Works from disk with no build step, no dependencies, and no network. */
"use strict";

// ---------------------------------------------------------------- helpers

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const strip = (html) => String(html).replace(/<[^>]+>/g, "");
const act = (action, value = "") => `data-action="${action}" data-value="${esc(value)}"`;
const t = (id, label) => `<button class="term" ${act("term", id)}>${label}</button>`;
const c = (s) => `<code>${esc(s)}</code>`;
const chip = (cls, text) => `<span class="chip ${cls}">${text}</span>`;
const fields = (rows) => `<dl class="fields">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
const key = (html) => `<div class="key"><b>Key idea</b><p>${html}</p></div>`;
const seg = (action, current, options, label = "") =>
  `<div class="seg" role="group"${label ? ` aria-label="${esc(label)}"` : ""}>${options
    .map(([v, text]) => `<button ${act(action, v)} aria-pressed="${current === v}">${text}</button>`)
    .join("")}</div>`;
const flow = (items) =>
  `<ol class="flow">${items.map(([cls, title, sub, n]) => `<li class="${cls}">${n ? `<span class="n">${n}</span>` : ""}<b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</li>`).join("")}</ol>`;
const doc = (path, note, body) =>
  `<div class="doc"><div class="doc-tab"><span class="mono">${esc(path)}</span><span>${note}</span></div><pre>${body}</pre></div>`;
const rgn = (cls, on, body) => `<span class="rgn ${cls}${on === true ? " on" : on === false ? " out" : ""}">${body}</span>`;

const SPEC = "../../spec/hsdd-spec-v0_10.md";
// v0.11 is a delta on v0.10: it adds hsdd-auto and nothing else, so only chapter 10 cites it.
const SPEC11 = "../../spec/hsdd-spec-v0_11.md";
const UG = "../users-guide.md";
const deeper = (links) =>
  `<p class="deeper"><span>Go deeper:</span>${links.map(([label, href]) => `<a href="${href}">${label}</a>`).join("")}</p>`;
const spec = (label, anchor) => [`spec ${label}`, `${SPEC}#${anchor}`];
const spec11 = (label, anchor) => [`v0.11 spec ${label}`, `${SPEC11}#${anchor}`];
const guide = (label, anchor) => [`user's guide: ${label}`, `${UG}#${anchor}`];

// SVG primitives. Boxes take their top-left corner; edges are cubic curves.
const marker = (id) =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow"/></marker></defs>`;
function box({ x, y, w = 150, h = 46, kind = "plain", title, sub = "", action = "", value = "", selected = false, mono = true, badge = "", badgeCls = "badge-bad", label = "" }) {
  const cx = x + w / 2;
  const ty = sub ? y + h / 2 - 3 : y + h / 2 + 4;
  const aria = label || `${strip(title)}${sub ? `, ${strip(sub)}` : ""}`;
  const hook = action ? ` ${act(action, value)} role="button" tabindex="0" aria-label="${esc(aria)}"` : "";
  return `<g class="k-${kind}${selected ? " selected" : ""}"${hook}>`
    + `<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`
    + `<text x="${cx}" y="${ty}" text-anchor="middle" class="${mono ? "t-id" : "t-strong"}">${title}</text>`
    + (sub ? `<text x="${cx}" y="${y + h / 2 + 13}" text-anchor="middle" class="t-sub">${sub}</text>` : "")
    + (badge ? `<text x="${x + w - 4}" y="${y - 6}" text-anchor="end" class="${badgeCls}">${badge}</text>` : "")
    + `</g>`;
}
const vEdge = (x1, y1, x2, y2, cls = "", m = "") => {
  const my = (y1 + y2) / 2;
  return `<path class="edge ${cls}" d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}"${m ? ` marker-end="url(#${m})"` : ""}/>`;
};
// Tree connector: down from the parent, along a shared bus, down into the child.
const elbow = (x1, y1, x2, y2, cls = "", m = "") => {
  const my = Math.round((y1 + y2) / 2);
  return `<path class="edge ${cls}" d="M${x1} ${y1} V${my} H${x2} V${y2}"${m ? ` marker-end="url(#${m})"` : ""}/>`;
};
const hEdge = (x1, y1, x2, y2, cls = "", m = "") => {
  const mx = (x1 + x2) / 2;
  return `<path class="edge ${cls}" d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}"${m ? ` marker-end="url(#${m})"` : ""}/>`;
};
const svg = (viewBox, label, inner, cls = "") =>
  `<div class="dg-scroll"><svg class="dg ${cls}" viewBox="${viewBox}" role="group" aria-label="${esc(label)}">${inner}</svg></div>`;

// ---------------------------------------------------------------- glossary and questions

const GLOSSARY = [
  ["node", "Node", "Any unit in the spec tree. Every node has the same header at every level: kind, purpose, owning team, what it owns and does not own, the contracts it consumes and produces, its sources, and how to test it in isolation."],
  ["internal", "Internal node", "A node that splits into child nodes. The system, a domain such as the backend, and a subsystem are all internal nodes."],
  ["leaf-parent", "Leaf-parent", "A node whose children are phases rather than more nodes. One owner can hold its whole scope in their head, and it owns a phase plan."],
  ["phase", "Phase", "The smallest independently verifiable unit of work. One phase drives exactly one coding cycle and ends at one human review gate. Its id is its leaf-parent's id plus a number, such as acme.backend.auth.2."],
  ["pe", "Phase Equivalent (PE)", "The sizing unit: the largest change one reviewer can genuinely review and manually verify in one sitting, plus the agent run that produced it. Roughly 400 changed lines of non-generated code, at most 8 tasks, about half a working day."],
  ["contract", "Contract", "A named, versioned interface between nodes: an API, an event, a schema, a shared type, a file layout, or a CLI. It is the only thing one node may know about another. Written as id@version, such as auth-token@v1."],
  ["dependency", "Dependency type", "Every edge between nodes is typed. hard: needs the producer's real output. contract: builds against fixtures. event: builds against the event schema. shared-model: needs the shared type. Only hard edges make a consumer wait for the producer to ship; the others need only a stable contract or the shared type."],
  ["stable", "Stable contract", "A contract with at least one executable validation artifact, a schema or a fixtures directory. The producer's gate replays it and consumers test against the same fixtures."],
  ["registry", "Registry", "The INDEX.md files for contracts and ADRs. A script generates them from frontmatter; nobody, human or agent, edits them by hand."],
  ["adr", "ADR", "Architecture Decision Record: a cross-cutting, durable decision kept as its own file, such as hsdd/adr/001-auth-provider.md, so the registry and phase contexts can find it by id. A decision inside one node stays a D{n} in that node's spec."],
  ["oq", "Open question (OQ)", "A decision that cannot be made yet. It is defined once, in the spec that owns it (OQ3 at the root, OQ-B3 in a node), and cited everywhere else by id. Phases that wait on it are marked contingent."],
  ["sources", "Sources", "The input documents (PRD, RFC, design, ticket) that govern a node. Sources trickle down at every split, so a later step reads the original rather than a summary of a summary."],
  ["tier", "Review tier", "How much human attention a phase gets at its gate, set by risk: gate-only, spot-check, or full-review. The tier also sets how many artifacts the coding cycle writes."],
  ["freeze", "Governance freeze", "During phase planning, contracts, ADRs, conventions.md and the registries are read-only, at the root and in every worktree. Planners write the changes they need into their own plan file, as data."],
  ["reconcile", "Reconcile", "hsdd-reconcile, the single writer for governance. At the root it applies the pending updates that phase plans emitted (confirm, request, amend, note), resolves requests with you, flips contracts to stable, and regenerates the registries."],
  ["context", "Phase context", "The self-contained file /hsdd-phase writes before a phase runs: the phase, the Interface, Guarantees and Validation of its contracts, its decisions, the discipline, and links pinned to a spec commit. It is then wrapped for OpenSpec or superpowers."],
  ["method", "Coding method", "How a project runs each phase's coding cycle: openspec or superpowers. HSDD decides what each cycle sees and in what order cycles run; the cycle itself is unchanged."],
  ["verification", "Verification doc", "hsdd/verify/{phase-id}.verification.md: commands, expected and observed output, outstanding items, learnings, and the human sign-off. Merged to main, it is the only admissible proof that a phase is done."],
  ["learning", "Learning", "A finding at the gate about the tree rather than the phase. Each one gets a disposition before sign-off: spec-updated, contract-bumped, adr-proposed, or dropped. Writing none is fine; leaving it blank is not."],
  ["integration", "Integration node", "A leaf-parent whose phases exercise the real composed behavior of sibling nodes. Its hard edges to each producer schedule it after they ship."],
  ["seams", "Seams", "The places where a system's parts meet that tooling can see without reading the code: manifests, route registrations, schemas, migrations, event topics, CODEOWNERS, and files that change together in git history."],
  ["as-built", "As-built node", "An adopted node whose spec records observed structure, marked Adopted: as-built. It stays that way until a change lands on it, and some nodes stay that way for good."],
  ["promoted", "Promoted node", "An as-built node that a change landed on, decomposed under governance after a human confirmed it. Marked Adopted: promoted. Its observed surface stays as provenance."],
  ["observed-surface", "Observed surface", "The section of an as-built spec holding only what the seam extractor saw (modules, routes, tables, topics, owners), stamped with the commit it looked at, plus the required unknown: lines a human adds."],
  ["v0", "v0", "The version of an adopted contract: observed behavior, warts included. It is permanent. A contract moves to v1 only when its interface is genuinely redesigned."],
  ["completeness", "Observed completeness", "The required section of a v0 contract that names what its fixtures do not reach."],
  ["intake", "Intake record", "The dated record hsdd-intake writes for each change request before any handoff: class, landing nodes, contracts, promotions, collisions, routing. Never superseded; records accumulate, one per request."],
  ["backfill", "Backfill", "The finding filed when code ships with no phase, such as a hotfix. It becomes a retro phase with a verification doc marked retroactive."],
  ["checkpoint", "Checkpoint", "hsdd-checkpoint: one evidence pass over the spec repo and every implementation repo, usually weekly, producing a progress report, an execution plan, the atlas, and ticked milestone gates."],
  ["atlas", "Atlas", "hsdd/management/atlas.md: a regenerated bird's-eye view of the tree with phase status, the contract graph, and ADR coverage. Derived only; if it disagrees with the artifacts, the atlas is wrong."],
  ["milestone", "Milestone", "A stakeholder checkpoint: a demo someone can watch work, plus a gate of yes/no checkboxes. Work that waits on outside parties goes to a contingent tail outside the launch gate."],
  ["reading-aid", "Reading aid", "An optional offline HTML page rendered by hsdd-summary over the canonical files: the plan page for reviewers and the checkpoint page for the weekly sync. Derived, never edited."],
  ["segment", "Run and segment", "An unattended run is one hsdd-auto effort on one branch, configured by hsdd/auto/run.yaml. A segment is one stretch of it, opened by one owner instruction (the first /hsdd-auto, an intake, or an answer to STOP.md), with one mode, one stop policy and one report."],
  ["orchestrator", "Orchestrator", "The agent session that runs hsdd-auto. It launches one fresh subagent per step, answers stops as the owner's stand-in or ends the run, reviews each step, and runs the scripts that gate, commit and record. It never runs a planning skill in its own context."],
  ["ledger", "Decision ledger", "hsdd/judgement/decisions.jsonl: one decision per line, append-only. Each line holds the question, the options and their consequences, the choice, why, the evidence, the blast radius and the confidence, pinned to the commit that holds the artifact it landed in."],
  ["stop-policy", "Stop policy", "Chosen per segment. stop: a condition in the stop set (axis, shape, promotion, breaking-amend, collision, external, gate-twice) ends the run with STOP.md. decide-and-record: the run decides it and records the decision with would_have_asked: true. Hard stops, such as a need outside the repository, end the run under either policy."],
  ["would-have-asked", "would_have_asked", "A decision field: true when a skill stopped for a human, or a careful engineer would have asked the owner first. The segment report lists these decisions first."],
  ["predecided", "Predecided answer", "The answer to a stop class, decided once before any step meets it and carried in every later prompt. A subagent that meets the class applies it, records its own decision citing it, and does not stop."],
];

const FAQ = [
  ["Does HSDD replace OpenSpec or superpowers?", "No. HSDD wraps a decomposition front-end and a contract layer around the coding cycle you already use. It decides what each cycle sees and in what order cycles run. Each phase is one ordinary OpenSpec change or one superpowers plan."],
  ["Will it cut my token bill?", "It bounds each session's context to one phase plus the contracts and decisions it touches. Total tokens across a project still grow with the number of phases, and planning has its own overhead. HSDD bounds the cost per session; it does not reduce the total."],
  ["Does context isolation stop an agent from reading other files?", "No. Isolation shapes attention: a session that only received its own phase is unlikely to wander into a sibling's concern or invent an interface it was never given. That held up under adversarial testing, but it is probabilistic, not enforced by a mechanism."],
  ["Do I need a deep tree for a small project?", "No. When the system is one coherent responsibility, the root is a leaf-parent and you go straight to phases, as in the linkcheck example. Depth and ceremony are costs: use as many levels and artifacts as the system needs and no more."],
  ["Why split by team rather than by feature?", "A node owned by two teams mixes two toolchains and two deploy targets and has no single owner, so nobody can hold its scope. Split where ownership splits; a feature that spans the stack comes back one level down as a pair of nodes joined by a contract. A solo developer or one full-stack squad can slice by feature, because there the feature boundary is the ownership boundary."],
  ["How big is a phase?", "One Phase Equivalent: what one reviewer can genuinely review and manually verify in one sitting, plus the agent run. Roughly 400 changed lines of non-generated code, at most 8 tasks, about half a working day. Bigger gets split; a phase too small to earn its own cycle gets merged with a neighbor."],
  ["What if a contract turns out wrong in the middle of a phase?", "Pause at a task boundary and write the gap into the verification doc's Outstanding section. Renegotiate it at the root through hsdd-contract, bring the change into the phase's branch, re-run the phase switch, and resume. The agent never improvises around the contract."],
  ["Can I use HSDD on an existing codebase?", "Yes. hsdd-adopt extracts the seams by script, proposes a shallow tree for you to confirm, writes as-built node specs and v0 contracts, and stops. Every change then enters through hsdd-intake, and a node is decomposed further only when a change lands on it."],
  ["Why not reverse-engineer the whole codebase into specs?", "Cost and trust. Shallow adoption reads structure, not code, so its cost scales with the number of seams rather than lines of code. And nobody reads 500 generated specs, yet every later agent session would treat them as authoritative. HSDD writes a node's spec when someone is about to work on that node and confirms it."],
  ["What about hotfixes that skip the process?", "Ship the fix. The next checkpoint finds code that no phase covers and files a backfill finding; a retro phase with a retroactive verification doc closes it. A backfill left open for two checkpoints in a row escalates. A recorded bypass beats a hidden one."],
  ["What does done mean?", "A phase is done when its verification doc, signed by a human, is merged to the spec repo's main branch. Progress reports list anything else as a claim, not as done."],
  ["Our backend and frontend live in separate repos.", "Use the standalone-spec-repo profile. The tree lives in its own repo, mounted as a git submodule at hsdd/ in each implementation repo, so every path stays the same. Skills run from an implementation repo, where the code they reason about is present."],
  ["Is there a CLI or a server to run?", "No. HSDD is a set of agent skills with optional slash commands. Scripts exist only where a skill bundles them: the registry generator, the seam extractor, the reading-aid renderer, and hsdd-auto's run scripts. Nothing starts a run on a timer."],
  ["Can an agent plan the whole tree without me?", "Yes, with hsdd-auto. It runs the planning skills one fresh subagent at a time, gates and commits every step, and records every decision with its options and evidence. You choose per segment whether a stop condition ends the run or is decided and recorded. Your review moves from each question to one sitting over the decisions. It never implements a phase or passes a review gate."],
  ["How proven is it?", "The core model was field-tested on a production monorepo (14 planned phases across two nodes) and held up in an adversarial pressure campaign. Most of the newer brownfield and steady-state rules are reasoned rather than field-tested, and the spec's decision table marks which is which. hsdd-auto packages a protocol that one field test ran by hand; its stop path has not been exercised in the field. A published end-to-end case study with a baseline comparison is the v1.0 release criterion."],
];

// ---------------------------------------------------------------- example: acme (greenfield)

const ACME_INFO = {
  "acme": [["Kind", "internal (root)"], ["Purpose", "Merchant onboarding platform: sign-up, verification, billing"], ["Sources", "docs/onboarding-prd.md (PRD), docs/platform-rfc.md (RFC), designs/onboarding (design)"], ["Decomposes into", "acme.backend, acme.mobile, acme.web"]],
  "acme.backend": [["Kind", "internal"], ["Team", "backend"], ["Purpose", "APIs, sign-in, billing, and the catalog"], ["Produces", "auth-token@v1, merchant-model@v1, onboarding-events@v1"], ["Sources", "docs/onboarding-prd.md (§2-4), docs/platform-rfc.md"], ["Decomposes into", "acme.backend.auth, acme.backend.billing, acme.backend.catalog"]],
  "acme.mobile": [["Kind", "internal"], ["Team", "mobile"], ["Purpose", "The merchant app"], ["Consumes", "auth-token@v1, onboarding-events@v1"], ["Decomposes into", "child nodes (not shown)"]],
  "acme.web": [["Kind", "internal"], ["Team", "web"], ["Purpose", "The merchant web console"], ["Consumes", "auth-token@v1, merchant-model@v1"], ["Decomposes into", "child nodes (not shown)"]],
  "acme.backend.auth": [["Kind", "leaf-parent"], ["Team", "backend"], ["Purpose", "Sign merchants in and issue the tokens other nodes verify"], ["Owns", "login, token issuance, sessions"], ["Does not own", "merchant profiles, billing"], ["Consumes", "none"], ["Produces", "auth-token@v1"], ["Governed by", "ADR-001"], ["Sources", "docs/onboarding-prd.md (§3), docs/platform-rfc.md (§auth)"], ["Decomposes into", "phases (see phase plan)"], ["Isolation strategy", "provider X's sandbox and the auth-token@v1 fixtures"]],
  "acme.backend.billing": [["Kind", "leaf-parent"], ["Team", "backend"], ["Purpose", "Plans, invoices, and charges"], ["Consumes", "auth-token@v1"], ["Decomposes into", "phases (see phase plan)"], ["Isolation strategy", "builds against the auth-token@v1 fixtures, never against auth's code"]],
  "acme.backend.catalog": [["Kind", "leaf-parent"], ["Team", "backend"], ["Purpose", "The merchant's product catalog"], ["Decomposes into", "phases (see phase plan)"]],
};

const AUTH_PHASES = [
  { id: "acme.backend.auth.1", name: "Types + auth-token contract", short: "Types + contract", tier: "gate-only", size: "small", deps: "-", col: "-",
    rec: [["Consumes", "none"], ["Produces", "none (the token and session types that auth-token@v1's Interface names)"], ["Scope", "Domain types for tokens and sessions, matching the contract schema"], ["Size estimate", "~4 files (~150 lines), <= 3 tasks"], ["Gate", "node default"], ["Verification", "the types compile and match auth-token's schema"], ["Review tier", "gate-only"], ["Dependencies", "none"]] },
  { id: "acme.backend.auth.2", name: "Token issuance (provider X)", short: "Token issuance", tier: "full-review", size: "medium", deps: "1", col: "-",
    rec: [["Consumes", "none"], ["Produces", "auth-token@v1"], ["Governed by", "ADR-001"], ["Scope", "Issue JWTs on login via provider X; sign, set claims, handle errors"], ["Size estimate", "~6 files (~400 lines), <= 6 tasks"], ["Gate", c("cargo test") + " plus contract replay for auth-token"], ["Verification", "a sandbox login returns a token whose claims match auth-token@v1"], ["Review tier", "full-review"], ["Dependencies", "acme.backend.auth.1 (the auth-token types)"]] },
  { id: "acme.backend.auth.3", name: "Session store", short: "Session store", tier: "spot-check", size: "small", deps: "1", col: "4",
    rec: [["Consumes", "none"], ["Produces", "none"], ["Scope", "Store sessions keyed by token id and expire them with the token"], ["Size estimate", "~4 files (~250 lines), <= 5 tasks"], ["Gate", "node default"], ["Verification", "a session disappears when its token expires"], ["Review tier", "spot-check"], ["Collides with", "acme.backend.auth.4 (both edit the router file)"], ["Dependencies", "acme.backend.auth.1 (the session types)"]] },
  { id: "acme.backend.auth.4", name: "Auth API + wiring", short: "Auth API + wiring", tier: "full-review", size: "medium", deps: "2, 3", col: "3",
    rec: [["Consumes", "none"], ["Produces", "none"], ["Scope", "Login and refresh endpoints wired to issuance and the session store"], ["Size estimate", "~7 files (~380 lines), <= 7 tasks"], ["Gate", "node default"], ["Verification", "a staging login returns a token and creates a session"], ["Review tier", "full-review"], ["Collides with", "acme.backend.auth.3 (both edit the router file)"], ["Dependencies", "acme.backend.auth.2 (issuance), acme.backend.auth.3 (sessions)"]] },
];
const PHASE_BY_ID = Object.fromEntries(AUTH_PHASES.map((p) => [p.id, p]));

// Tree layout in a 760-wide box: one row per level, 84 units apart.
const ACME_NODES = [
  { id: "acme", kind: "root", cx: 380, y: 16, sub: "root system", level: 0 },
  { id: "acme.backend", kind: "internal", cx: 230, y: 100, sub: "Team: backend", parent: "acme", level: 1 },
  { id: "acme.mobile", kind: "internal", cx: 460, y: 100, sub: "Team: mobile", parent: "acme", level: 1 },
  { id: "acme.web", kind: "internal", cx: 630, y: 100, sub: "Team: web", parent: "acme", level: 1 },
  { id: "acme.backend.auth", kind: "leafparent", cx: 90, y: 184, sub: "leaf-parent", parent: "acme.backend", level: 2 },
  { id: "acme.backend.billing", kind: "leafparent", cx: 262, y: 184, sub: "leaf-parent", parent: "acme.backend", level: 2 },
  { id: "acme.backend.catalog", kind: "leafparent", cx: 434, y: 184, sub: "leaf-parent", parent: "acme.backend", level: 2 },
  ...AUTH_PHASES.map((p, i) => ({ id: p.id, kind: "phase", cx: 85 + i * 160, y: 268, sub: p.short, parent: "acme.backend.auth", level: 3 })),
];
const FEATURE_NODES = [
  { id: "acme.auth", cx: 140, title: "acme.auth", sub: "sign-in, end to end" },
  { id: "acme.onboarding", cx: 380, title: "acme.onboarding", sub: "sign-up, end to end" },
  { id: "acme.billing", cx: 620, title: "acme.billing", sub: "billing, end to end" },
];
const LINKCHECK_INFO = {
  "linkcheck": [["Kind", "leaf-parent (the root is already small enough)"], ["Purpose", "Crawl a site, check every link, report the broken ones"], ["Consumes", "none"], ["Produces", "linkcheck-report@v1"], ["Decomposes into", "phases (see phase plan)"], ["Isolation strategy", "pure HTML parsing and report formatting are tested with fixtures; the HTTP checker is mocked"]],
  "linkcheck.1": [["Name", "Types + report contract"], ["Review tier", "gate-only"], ["Depends on", "none"]],
  "linkcheck.2": [["Name", "HTML link extractor"], ["Review tier", "spot-check"], ["Depends on", "linkcheck.1"]],
  "linkcheck.3": [["Name", "HTTP checker"], ["Review tier", "full-review"], ["Depends on", "linkcheck.1"]],
  "linkcheck.4": [["Name", "Crawl + report + CLI"], ["Review tier", "full-review"], ["Depends on", "linkcheck.2, linkcheck.3"]],
};

// ---------------------------------------------------------------- example: legacy-pay (brownfield)

const REQUESTS = {
  schedule: {
    title: "Merchant payout scheduling", date: "2026-10-10", slug: "payout-scheduling", source: "docs/prd-payout-scheduling.md (draft PRD)",
    ask: "Merchants choose a payout schedule: daily, weekly, or on a date. Payouts are batched per schedule.",
    cls: "local", lands: "legacy-pay.payouts", contracts: "payouts-api@v0", promotes: "legacy-pay.payouts", waits: [],
    routing: "local, after promoting legacy-pay.payouts, which is as-built. The PRD joins that node's Sources. payouts-api@v0 gains an optional schedule field: an additive change, so no version bump.",
    handoff: ["/hsdd-spec promote legacy-pay.payouts using docs/prd-payout-scheduling.md", "/hsdd-phase-plan legacy-pay.payouts per hsdd/management/2026-10-10-intake-payout-scheduling.md"],
  },
  hold: {
    title: "Hold payouts while invoices are unpaid", date: "2026-10-14", slug: "payout-hold", source: "tickets/PAY-212.md (ticket)",
    ask: "Do not release a payout to a merchant who has an overdue invoice.",
    cls: "cross-node", lands: "legacy-pay.billing, legacy-pay.payouts", contracts: "invoice-balance@v1 (new)", promotes: "legacy-pay.billing", waits: ["schedule"],
    routing: "cross-node: billing must publish outstanding balances and payouts must read them. Promote billing first (payouts is already promoted by the scheduling intake, so this one reuses it). hsdd-contract defines invoice-balance@v1, then each node is phase-planned; payouts in append mode, because it already has phases.",
    handoff: ["/hsdd-spec promote legacy-pay.billing using tickets/PAY-212.md", "\"Define the invoice-balance contract: billing produces, payouts consumes.\"  (hsdd-contract)", "/hsdd-phase-plan legacy-pay.billing per hsdd/management/2026-10-14-intake-payout-hold.md", "/hsdd-phase-plan legacy-pay.payouts per hsdd/management/2026-10-14-intake-payout-hold.md"],
  },
  disputes: {
    title: "Merchants can dispute a payout", date: "2026-10-20", slug: "payout-disputes", source: "docs/rfc-disputes.md (accepted RFC)",
    ask: "A merchant can open a dispute on a payout; support resolves it within five days.",
    cls: "new-capability", lands: "legacy-pay (the parent)", contracts: "payouts-api@v0 (consumed, unchanged)", promotes: "none", waits: [],
    routing: "new-capability: no node owns disputes. hsdd-spec grafts legacy-pay.disputes under the existing root; existing children keep their ids. The new node's use of payouts-api goes through the normal contract request path.",
    handoff: ["/hsdd-spec graft legacy-pay.disputes under legacy-pay using docs/rfc-disputes.md", "/hsdd-phase-plan legacy-pay.disputes per hsdd/management/2026-10-20-intake-payout-disputes.md"],
  },
  treasury: {
    title: "Treasury takes over settlement", date: "2026-10-21", slug: "treasury-settlement", source: "notes/settlement-ownership.md (braindump)",
    ask: "The treasury team will own the settlement job from next quarter.",
    cls: "structural", lands: "legacy-pay.payouts", contracts: "payout-settled-events@v0", promotes: "none", waits: ["schedule", "hold"],
    routing: "structural: stop. Settlement changes owning team, so the tree's ownership split no longer matches the system. Options for the human: (a) split settlement out of payouts into its own node owned by treasury, joined by a contract; (b) hand all of payouts to treasury; (c) keep the tree and record treasury as a stakeholder only.",
    handoff: [],
  },
};
const CLASSES = [
  ["local", "fits inside one existing leaf-parent", "hsdd-phase-plan (append mode when the node already has phases)"],
  ["cross-node", "touches several nodes' surfaces", "hsdd-contract bump and/or hsdd-adr, then phase-plan each node"],
  ["new-capability", "needs a node that does not exist", "hsdd-spec graft mode on the existing parent, then phase-plan the new child"],
  ["structural", "the tree's shape is wrong for this change", "stop: a human decision, with the options written down"],
];

const SKILLS = [
  ["Build the tree", [
    ["hsdd-spec", "Turn a brain-dump or PRD into a root spec, or split any node into children. Recursive. Also promotes as-built nodes and grafts new ones.", "Write a high-level spec for a merchant onboarding platform."],
    ["hsdd-adopt", "Bring an existing codebase into the tree: seams extracted by script, as-built node specs, v0 contracts. Brownfield's entry point.", "Adopt this codebase into HSDD."],
    ["hsdd-contract", "Define and version the contracts between nodes, with their schema and fixtures.", "Define the auth-token contract: auth produces, billing consumes."],
    ["hsdd-adr", "Write and maintain cross-cutting decisions as ADR files.", "Write the ADR for the auth provider decision."],
  ]],
  ["Plan", [
    ["hsdd-phase-plan", "Break a leaf-parent into ordered phases with gates, review tiers, and a dependency graph.", "acme.backend.auth is small enough. Write its phase plan."],
    ["hsdd-reconcile", "Apply the governance updates that phase plans emitted, at the root, as the single writer.", "Reconcile the worktrees."],
  ]],
  ["Execute", [
    ["hsdd-config", "Before each phase, write its self-contained context and wrap it for OpenSpec or superpowers. Its command is /hsdd-phase.", "/hsdd-phase acme.backend.auth.2"],
  ]],
  ["Change", [
    ["hsdd-intake", "Route a change request into the existing tree: classify it, detect collisions, write the record, hand off.", "Here's the payout-scheduling PRD, docs/prd-payout-scheduling.md. Where does it go?"],
  ]],
  ["Run", [
    ["hsdd-checkpoint", "Run the weekly evidence pass across the spec repo and every implementation repo.", "/hsdd-checkpoint full checkpoint before Monday's sync. Repos: ~/git/acme-be, ~/git/acme-fe."],
    ["hsdd-milestone", "Generate the stakeholder milestone document once a campaign is phase-planned; re-baseline it when dates move.", "/hsdd-milestone generate the milestone document."],
    ["hsdd-summary", "Render the offline reading aids: the plan page and the checkpoint page.", "/hsdd-summary render the plan page."],
  ]],
  ["Automate", [
    ["hsdd-auto", "Run the planning chain unattended: one fresh subagent per skill invocation, every step gated and committed, every decision recorded for one review sitting.", "/hsdd-auto plan the whole tree without asking me, and record the decisions."],
  ]],
];

// ---------------------------------------------------------------- chapter: start

function mapView() {
  const B = (x, y, w, kind, title, sub, ch, mono = false, h = 54) =>
    box({ x, y, w, h, kind, title, sub, mono, action: ch ? "goto" : "", value: ch, label: ch ? `${strip(title)}: ${strip(sub)}. Open the chapter.` : "" });
  return svg("0 0 980 330", "The HSDD lifecycle. Select a box to open its chapter.",
    marker("ah-map")
    + `<text x="16" y="12" class="band-label">TWO WAYS IN</text>`
    + `<text x="410" y="66" class="band-label">ONE SHARED LOOP</text>`
    + B(16, 20, 168, "source", "An idea, PRD or RFC", "greenfield", "")
    + B(210, 20, 168, "internal", "hsdd-spec", "decompose into a tree", "tree", true)
    + B(16, 130, 168, "source", "An existing codebase", "brownfield", "")
    + B(210, 130, 168, "observed", "hsdd-adopt", "extract seams, as-built tree", "adopt", true)
    + B(410, 75, 160, "root", "The tree", "nodes joined by contracts", "contracts")
    + B(600, 75, 160, "leafparent", "Phase plans", "hsdd-phase-plan", "phases")
    + B(790, 75, 174, "phase", "One cycle per phase", "context, code, human gate", "execute")
    + B(790, 195, 174, "plain", "Working system", "verified phase by phase", "")
    + B(600, 195, 160, "source", "A change request", "PRD, ticket, incident", "")
    + B(410, 195, 160, "internal", "hsdd-intake", "route into the tree", "change", true)
    + B(410, 275, 554, "gate", "hsdd-checkpoint · one evidence pass a week across spec and code", "", "manage", false, 40)
    + B(530, 6, 434, "internal", "hsdd-auto", "runs the planning skills unattended, records each decision", "auto", true, 44)
    + `<path class="edge dashed" d="M550 50 L550 71" marker-end="url(#ah-map)"/>`
    + `<path class="edge dashed" d="M680 50 L680 71" marker-end="url(#ah-map)"/>`
    + `<path class="edge" d="M184 47 L206 47" marker-end="url(#ah-map)"/>`
    + `<path class="edge" d="M184 157 L206 157" marker-end="url(#ah-map)"/>`
    + hEdge(378, 47, 406, 96, "", "ah-map")
    + hEdge(378, 157, 406, 108, "", "ah-map")
    + `<path class="edge" d="M570 102 L596 102" marker-end="url(#ah-map)"/>`
    + `<path class="edge" d="M760 102 L786 102" marker-end="url(#ah-map)"/>`
    + `<path class="edge" d="M877 129 L877 191" marker-end="url(#ah-map)"/>`
    + `<path class="edge" d="M790 222 L764 222" marker-end="url(#ah-map)"/>`
    + `<path class="edge" d="M600 222 L574 222" marker-end="url(#ah-map)"/>`
    + `<path class="edge hot" d="M490 195 L490 133" marker-end="url(#ah-map)"/>`
    + `<text x="498" y="168" class="t-label">every later change</text>`
    + `<path class="edge dashed" d="M877 275 L877 253" marker-end="url(#ah-map)"/>`
    + `<text x="884" y="268" class="t-label">evidence</text>`, "wide");
}

function homeView() {
  return `<div class="home">
    <header class="ch-head">
      <p class="eyebrow">An interactive guide · HSDD v0.11</p>
      <h1>Build large systems with AI agents, one reviewed phase at a time.</h1>
      <p class="lede">HSDD (Hierarchical Spec-Driven Development) splits a large spec into a tree of small pieces that meet only at versioned contracts. An agent builds one small piece per session, and a human reviews each one before the next begins.</p>
    </header>
    <section class="visual" aria-label="Lifecycle map">
      <div class="bar"><span class="label">The whole method on one page</span><span class="hint">Select a box to jump to its chapter</span></div>
      ${mapView()}
    </section>
    <div class="ways">
      <div class="way"><h2>New to HSDD?</h2><p>Take the tour from the problem it solves to running a project week to week, then handing planning to an agent. Ten short chapters, each a few steps.</p><div class="cta-row"><button class="btn primary" ${act("goto", "why")}>Start the tour →</button></div></div>
      <div class="way"><h2>Have a codebase already?</h2><p>Most systems exist before their spec. See how HSDD adopts existing code, then routes every change into one tree.</p><div class="cta-row"><button class="btn" ${act("goto", "adopt")}>Start with brownfield →</button></div></div>
      <div class="way"><h2>Just want to try it?</h2><p>The skills, the install command, and the first prompts to type, for a new system or an existing one.</p><div class="cta-row"><button class="btn" ${act("goto", "begin")}>Get started →</button></div></div>
    </div>
    <p class="howto"><span><kbd>←</kbd> <kbd>→</kbd> step through</span><span><kbd>0</kbd>–<kbd>9</kbd> jump to a chapter</span><span><kbd>G</kbd> glossary</span><span><kbd>?</kbd> common questions</span><span><kbd>T</kbd> theme</span><span>Words with a dotted underline, like ${t("contract", "contract")}, open the glossary.</span></p>
  </div>`;
}

// ---------------------------------------------------------------- chapter: why

const SIZES = [
  { label: "A CLI tool", spec: 9, phases: 4 },
  { label: "A product", spec: 32, phases: 20 },
  { label: "A platform", spec: 68, phases: 60 },
  { label: "Several teams", spec: 140, phases: 150 },
];
const WINDOW = 40;

function sizesView(s) {
  const z = SIZES[s.size];
  const specW = Math.min(z.spec, 100);
  const over = z.spec > WINDOW;
  const specText = z.spec > 100 ? "whole spec: off the chart" : "whole spec, every session";
  const hsdd = s.step >= 1
    ? `<div class="size-row"><span>HSDD: one phase session reads</span><div class="track"><div class="fill phase" style="width:7%"></div><div class="marker" style="left:${WINDOW}%"></div></div></div>
       <p class="caveat">One phase, the contracts it touches, and its decisions: about the same at every size. This system has ${z.phases} phases, so total work still grows with it.</p>`
    : "";
  return `<div class="bar"><span class="label">System size</span><span class="hint">Illustrative scale, not measured</span></div>
    <input type="range" id="size-range" min="0" max="${SIZES.length - 1}" step="1" value="${s.size}" aria-label="System size" aria-valuetext="${z.label}">
    <div class="range-ticks">${SIZES.map((x) => `<span>${x.label}</span>`).join("")}</div>
    <div class="sizes">
      <div class="size-row"><span>Single spec: each session reads</span><div class="track"><div class="fill mono-spec${over ? " over" : ""}" style="width:${specW}%">${specW > 30 ? specText : ""}</div><div class="marker" style="left:${WINDOW}%"></div></div></div>
      ${hsdd}
      <div class="size-row"><span></span><p class="marker-label"><span></span><span>dashed line: what a session can read with focus, and a person can review</span></p></div>
    </div>
    ${over ? `<div class="verdict bad"><b>Past the line.</b> Every session re-reads the whole spec. Token use climbs and the model's attention spreads across parts unrelated to the task.</div>` : `<div class="verdict ok"><b>Fits.</b> One spec and one cycle are enough at this size.</div>`}`;
}

function compareView() {
  const col = (title, cls, items) => `<div><p class="col-title">${title}</p>${flow(items.map(([k, a, b]) => [k, a, b]))}</div>`;
  return `<div class="cols">
    ${col("Single spec", "", [["k-gate", "One spec", "the whole system"], ["k-process", "One coding cycle", "context: the entire spec"], ["k-impl", "Whole system", ""]])}
    ${col("HSDD", "", [["k-flow", "Root spec", "the system"], ["k-process", "Nodes + contracts", "recursive"], ["k-done", "Leaf phases", "small, verifiable"], ["k-impl", "One cycle per phase", "context: one phase + its contracts"], ["k-done", "Integrated system", ""]])}
  </div>
  <p class="caveat">The coding cycle itself does not change. HSDD decides what each cycle sees and in what order the cycles run.</p>`;
}

const IDEAS = [
  ["Recursive decomposition", "A large system is a tree, not a flat spec. Only the leaves drive code.", "Any node can split into child nodes, to as many levels as the system needs. Splitting stops at a leaf-parent, whose children are phases. Small systems stay flat."],
  ["Contracts as the only coupling", "Nodes depend on named, versioned contracts, never on each other's internals.", "Context becomes a dependency graph instead of a monolith. Think of each node as a function: consumed contracts are its typed inputs, produced contracts its outputs, and the dependency graph is the composition. Nodes are built against contract fixtures, not live implementations."],
  ["Human review at every leaf", "Each phase is sized so the agent run plus a human's review fits one sitting.", "Agents produce faster than people can read, so review is the pacing unit. The human owns correctness; the agent owns throughput. This holds as models improve, because the reviewer does not get a bigger context window."],
];
// One small tree carries all three ideas: it grows a level (01), a contract joins two of its
// nodes (02), and a person reviews one of its phases (03). Every render rebuilds the SVG, so a
// card click replays its animation; with reduced motion the final picture shows at once.
const IDEA_MID = [{ id: "acme.backend", cx: 230 }, { id: "acme.web", cx: 560 }];
const IDEA_LEAVES = [
  { id: "acme.backend.auth", cx: 130, parent: 230, phases: 3 },
  { id: "acme.backend.billing", cx: 330, parent: 230, phases: 3 },
  { id: "acme.web.signup", cx: 560, parent: 560, phases: 2 },
];
const IDEA_LABELS = [
  "The acme tree grows: the root splits into backend and web, those split into leaf-parents, and the leaf-parents' children are phases.",
  "acme.backend produces the auth-token@v1 contract and acme.web consumes it; neither sees the other's internals.",
  "One reviewer examines one phase, acme.backend.auth.2, and signs it off in one sitting.",
];
function ideaDiagram(i) {
  const grow = i === 0;
  const wire = i === 1;
  const review = i === 2;
  // In 01 the third level and its phases arrive in sequence; elsewhere they are already there.
  const enter = (body, delay) => (grow ? `<g class="appear" style="animation-delay:${delay}s">${body}</g>` : body);
  const chipX = (leaf, n) => leaf.cx + (n - (leaf.phases - 1) / 2) * 42;
  let tree = box({ x: 305, y: 14, w: 150, h: 40, kind: "root", title: "acme" });
  for (const m of IDEA_MID) {
    tree += elbow(380, 54, m.cx, 86, "", "ah-idea");
    tree += box({ x: m.cx - 80, y: 88, w: 160, h: 40, kind: "internal", title: m.id, selected: wire });
  }
  let lower = "";
  IDEA_LEAVES.forEach((leaf, k) => {
    lower += enter(elbow(leaf.parent, 128, leaf.cx, 164, "", "ah-idea") + box({ x: leaf.cx - 88, y: 166, w: 176, h: 40, kind: "leafparent", title: leaf.id }), 0.3 + k * 0.15);
    for (let n = 0; n < leaf.phases; n++) {
      const x = chipX(leaf, n);
      const picked = review && k === 0 && n === 1;
      lower += enter(elbow(leaf.cx, 206, x, 220) + box({ x: x - 18, y: 222, w: 36, h: 18, kind: "phase", title: `.${n + 1}`, selected: picked, label: `${leaf.id}.${n + 1}` }), 0.9 + k * 0.15 + n * 0.08);
    }
  });
  const legend = [["root", 38], ["internal", 112], ["leaf-parent", 190], ["phases", 235]]
    .map(([text, y], n) => (n < 2 ? `<text x="752" y="${y}" text-anchor="end" class="t-label">${text}</text>` : enter(`<text x="752" y="${y}" text-anchor="end" class="t-label">${text}</text>`, n === 2 ? 0.6 : 1.3)))
    .join("");
  const contract = wire
    ? `<path class="edge draw" d="M310 108 L480 108"/>`
      + `<path class="edge hot flowing" d="M310 108 L476 108" marker-end="url(#ah-idea)"/>`
      + `<text x="395" y="100" text-anchor="middle" class="t-id">auth-token@v1</text>`
      + `<text x="316" y="124" class="t-label">produces</text><text x="474" y="124" text-anchor="end" class="t-label">consumes</text>`
    : "";
  const reviewer = review
    ? `<rect class="pulse" x="108" y="218" width="44" height="26" rx="8"/>`
      + `<g class="reviewer appear"><circle class="head" cx="238" cy="258" r="9"/><path d="M238 267 V290 M238 290 L227 308 M238 290 L249 308 M238 275 L253 286 M238 275 L221 265"/><circle cx="215" cy="259" r="7"/></g>`
      + `<path class="edge dashed appear" style="animation-delay:.5s" d="M209 253 L154 240"/>`
      + `<text x="264" y="282" class="t-label appear" style="animation-delay:.3s">one reviewer, one phase, one sitting</text>`
      + `<text x="264" y="300" class="t-ok appear" style="animation-delay:1.3s">✓ signed, then the next phase</text>`
    : "";
  return svg("0 0 760 314", IDEA_LABELS[i], marker("ah-idea") + tree + `<g class="${wire ? "dimmed" : ""}">${lower}</g>` + legend + contract + reviewer, "ideas");
}
function ideasView(s) {
  const i = s.idea;
  return `<div class="cards">${IDEAS.map(([title, sum], n) => `<button class="card" ${act("idea", n)} aria-pressed="${i === n}"><span class="num">0${n + 1}</span><h3>${title}</h3><p>${sum}</p></button>`).join("")}</div>
    ${ideaDiagram(i)}
    <div class="detail"><h3>${IDEAS[i][0]}</h3><p>${IDEAS[i][2]}</p></div>`;
}

// ---------------------------------------------------------------- chapter: tree

function acmeTree(s) {
  const level = Math.min(s.step, 3);
  const nodes = ACME_NODES.filter((n) => n.level <= level);
  const byId = Object.fromEntries(ACME_NODES.map((n) => [n.id, n]));
  const W = (n) => (n.level === 2 ? 164 : 150);
  let edges = "";
  let boxes = `<text x="630" y="12" text-anchor="middle" class="band-label">SOURCES</text>`;
  const sources = [["PRD", 560], ["RFC", 630], ["Design", 700]];
  boxes += sources.map(([label, cx]) => box({ x: cx - 31, y: 24, w: 62, h: 30, kind: "source", title: label, mono: false })).join("");
  edges += `<path class="edge dashed" d="M529 39 L455 39"/>`;
  if (s.step === 1 && s.axis === "feature") {
    edges += FEATURE_NODES.map((f) => elbow(380, 62, f.cx, 100, "bad")).join("");
    boxes += box({ x: 305, y: 16, w: 150, kind: "root", title: "acme", sub: "root system", action: "node", value: "acme", selected: s.node === "acme" });
    boxes += FEATURE_NODES.map((f) => box({ x: f.cx - 85, y: 100, w: 170, kind: "bad", title: f.title, sub: f.sub, action: "node", value: f.id, selected: s.node === f.id, badge: "3 teams" })).join("");
    return svg("0 0 760 156", "acme split by feature: each node has three owning teams", boxes + edges);
  }
  for (const n of nodes) {
    if (n.parent) {
      const p = byId[n.parent];
      edges += elbow(p.cx, p.y + 46, n.cx, n.y - 2, "", "ah-tree");
    }
    boxes += box({ x: n.cx - W(n) / 2, y: n.y, w: W(n), kind: n.kind, title: n.id, sub: n.sub, action: "node", value: n.id, selected: s.node === n.id });
  }
  const height = [72, 156, 240, 324][level];
  return svg(`0 0 760 ${height}`, "The acme spec tree. Select a node to see its header.", marker("ah-tree") + edges + boxes);
}

function linkcheckTree(s) {
  let out = marker("ah-lc");
  out += box({ x: 280, y: 16, w: 200, kind: "leafparent", title: "linkcheck", sub: "root, already a leaf-parent", action: "node", value: "linkcheck", selected: s.node === "linkcheck" });
  ["linkcheck.1", "linkcheck.2", "linkcheck.3", "linkcheck.4"].forEach((id, i) => {
    const cx = 95 + i * 190;
    out += elbow(380, 62, cx, 98, "", "ah-lc");
    out += box({ x: cx - 85, y: 100, w: 170, kind: "phase", title: id, sub: LINKCHECK_INFO[id][0][1], action: "node", value: id, selected: s.node === id });
  });
  return svg("0 0 760 156", "linkcheck: a root that is already a leaf-parent, with four phases", out);
}

function inspector(s) {
  const id = s.node;
  if (FEATURE_NODES.some((f) => f.id === id)) {
    return `<div class="detail"><h3 class="mono">${id}</h3>${fields([["Kind", "internal"], ["Team", `${chip("bad", "backend + mobile + web")}`], ["Problem", "three owners, three toolchains, three deploy targets; nobody can hold its scope, and no single team can be assigned the node"]])}</div>`;
  }
  const info = ACME_INFO[id] || LINKCHECK_INFO[id];
  if (info) return `<div class="detail"><h3 class="mono">${id}</h3>${fields(info)}</div>`;
  const p = PHASE_BY_ID[id];
  if (p) return `<div class="detail"><h3 class="mono">${id}: ${p.name}</h3>${fields(p.rec)}</div>`;
  return `<div class="detail"><p class="hint">Select a node to see its header.</p></div>`;
}

function treeVisual(s) {
  const toolbar = s.step === 1
    ? `<div class="bar"><span class="label">Split acme by</span>${seg("axis", s.axis, [["ownership", "Who builds it"], ["feature", "Feature, end to end"]], "Decomposition axis")}</div>`
    : s.step === 4
      ? `<div class="bar"><span class="label">Example</span>${seg("example", s.example, [["linkcheck", "linkcheck: one level"], ["acme", "acme: multi-level"]], "Example project")}</div>`
      : `<div class="bar"><span class="label">Example: acme</span><span class="hint">Select a node to read its header</span></div>`;
  const tree = s.step === 4 && s.example === "linkcheck" ? linkcheckTree(s) : acmeTree(s);
  return toolbar + tree + inspector(s);
}

// ---------------------------------------------------------------- chapter: contracts

function contractDoc(s) {
  const p = s.part;
  const on = (k) => p === k;
  return doc("hsdd/contract/auth-token.md", "a contract file",
    rgn("", on("meta"), `<span class="c">---</span>
<span class="k">id:</span> auth-token
<span class="k">version:</span> v1
<span class="k">status:</span> stable
<span class="k">kind:</span> api
<span class="k">owner:</span> acme.backend.auth
<span class="k">compatibility:</span> versioned
<span class="k">produced_by:</span> [acme.backend.auth.2]
<span class="k">consumers:</span> [acme.backend.billing.2, acme.mobile.session.1]
<span class="k">phase_ids:</span> final
<span class="c">---</span>`)
    + `\n<span class="h"># Contract: auth-token</span>\n\n`
    + rgn("", on("interface"), `<span class="h">## Interface</span>
A signed JWT with the claims { sub, exp, iat, scopes }.

<span class="h">## Guarantees / invariants</span>
- exp is always greater than iat
- sub never changes for a merchant`)
    + "\n"
    + rgn("", on("versioning"), `<span class="h">## Versioning</span>
- v1 current. A breaking change requires v2 and a migration note.
  v1 stays until every consumer has migrated.`)
    + "\n"
    + rgn("", on("validation"), `<span class="h">## Validation</span>
- schema: hsdd/contract/schema/auth-token.schema.json
- fixture: hsdd/contract/fixture/auth-token/`));
}
const PARTS = {
  meta: ["Frontmatter: metadata for the registry", "A script projects every contract's frontmatter into hsdd/contract/INDEX.md. Nobody maintains the index by hand, so it cannot drift. phase_ids starts provisional and only hsdd-reconcile flips it to final."],
  interface: ["Interface and Guarantees: what consumers receive", "This half, with the Validation section, is what a consuming phase's context gets, by id. A consumer never sees the producing node's code or spec, only the contract."],
  versioning: ["Versioning: v1, v2, no semver", "Compatibility is declared per version: additive-only, versioned, or frozen. A breaking change mints the next version in its own file beside the old one, with a migration note. The old version stays until its consumers move, or, when one endpoint cannot serve both, is deprecated at once and goes when the new version ships."],
  validation: ["Validation: stable means machine-checkable", "A contract cannot be stable without a schema or fixtures. The producing phase's gate replays them against real output; consuming phases test against the same fixtures. The mocks are the fixtures, so a contract change breaks consumer tests loudly instead of drifting silently. Every phase context carries this section, so the session knows where the fixtures are and what they look like."],
};

const EDGE_TYPES = {
  contract: { start: 0, label: "builds against fixtures", can: "Yes, once the contract is stable." },
  event: { start: 0, label: "builds against the event schema", can: "Yes, against the event schema." },
  "shared-model": { start: 1, label: "starts once the shared type exists", can: "Yes, once the type exists." },
  hard: { start: 6, label: "waits for the backend to ship", can: "No. The producer ships first." },
};
function lanesView(s) {
  const e = EDGE_TYPES[s.edge];
  const span = 12;
  const pct = (v) => `${(v / span) * 100}%`;
  const bar = (cls, from, to, text) => `<div class="fill ${cls}" style="left:${pct(from)};width:${pct(to - from)}">${text}</div>`;
  const lane = (name, cls, from, to, text, before = "") =>
    `<div class="lane"><span>${name}</span><div class="track">${before}${bar(cls, from, to, text)}</div></div>`;
  const waiting = e.start > 1 ? bar("waiting", 0, e.start, "waiting") : "";
  const end = Math.max(6, e.start + 5);
  return `<div class="bar"><span class="label">Edge from backend to web</span>${seg("edge", s.edge, [["contract", "contract"], ["event", "event"], ["shared-model", "shared-model"], ["hard", "hard"]], "Dependency type")}</div>
    ${svg("0 0 760 120", "acme's dependency graph with typed edges",
      marker("ah-dag")
      + box({ x: 20, y: 40, w: 160, kind: "leafparent", title: "acme.backend", sub: "produces" })
      + box({ x: 580, y: 4, w: 160, kind: "internal", title: "acme.mobile", sub: "consumes" })
      + box({ x: 580, y: 72, w: 160, kind: "internal", title: "acme.web", sub: "consumes" })
      + hEdge(180, 56, 576, 27, "", "ah-dag")
      + hEdge(180, 70, 576, 95, s.edge === "hard" ? "bad" : "hot", "ah-dag")
      + `<text x="300" y="30" class="t-label">auth-token@v1 · contract</text>`
      + `<text x="300" y="108" class="t-label">auth-token@v1 · ${s.edge}</text>`, "narrow")}
    <div class="lanes">
      ${lane("backend", "backend", 0, 6, "auth phases 1-4")}
      ${lane("mobile", "consumer", 0, 5, "builds against fixtures")}
      ${lane("web", "consumer", e.start, e.start + 5, e.label, waiting)}
    </div>
    <div class="axis"><span>start</span><span>time (illustrative)</span><span>${end > 6 ? "later" : ""}</span></div>
    <div class="verdict ${s.edge === "hard" ? "bad" : "ok"}"><b>Can web start before backend ships?</b> ${e.can}${s.edge === "hard" ? " The critical path doubles here. Keep hard edges rare." : ""}</div>`;
}

const CONTEXT_FILES = [
  ["in", "hsdd/spec/acme.backend.auth.md", "only the acme.backend.auth.2 section, plus where it sits: purpose, owns, does not own, isolation strategy"],
  ["in", "hsdd/contract/auth-token.md", "only the Interface, Guarantees and Validation"],
  ["in", "hsdd/adr/001-auth-provider.md", "only the Decision and Consequences"],
  ["in", "Discipline", "test-first, the governance freeze, consume contracts only, how to write the verification doc"],
  ["in", "Links pinned to the spec commit", "paths to the full files, for a human or a deliberate lookup"],
  ["out", "hsdd/spec/acme.md", "the root spec"],
  ["out", "hsdd/spec/acme.backend.billing.md, acme.web.md, acme.mobile.md", "sibling and cousin nodes"],
  ["out", "acme.backend.auth.1, .3, .4", "sibling phases, and the plan's summary table"],
  ["out", "hsdd/contract/merchant-model.md, onboarding-events.md", "contracts this phase does not touch"],
  ["out", "billing's and web's code", "other nodes' internals"],
];
function contextView(s) {
  const single = s.session === "single";
  const rows = CONTEXT_FILES.map(([io, path, why]) => {
    const inside = single || io === "in";
    return `<li class="${inside ? "in" : "out"}"><span class="mark">${inside ? "✓" : "–"}</span><span><span class="mono">${esc(path)}</span><small>${single && io === "out" ? "the whole file" : why}</small></span></li>`;
  }).join("");
  return `<div class="bar"><span class="label">Session for acme.backend.auth.2</span>${seg("session", s.session, [["hsdd", "HSDD phase session"], ["single", "Single-spec session"]], "Session type")}</div>
    <ul class="files">${rows}</ul>
    <p class="caveat">${single ? "With one spec, every session carries everything, whether the task needs it or not." : "Built by /hsdd-phase. The session never sees billing, web, or auth's sibling phases."}</p>`;
}

function adrView() {
  return `${flow([["k-process", "hsdd-spec proposes", "a decision that affects several nodes", "1"], ["k-gate", "You accept it", "a human decision", "2"], ["k-process", "hsdd-adr writes the file", "hsdd/adr/001-auth-provider.md", "3"], ["k-flow", "Registry regenerates", "hsdd/adr/INDEX.md", "4"], ["k-done", "Phase contexts get it", "Decision + Consequences only", "5"]])}
    ${doc("hsdd/adr/001-auth-provider.md", "an ADR file", `<span class="c">---</span>
<span class="k">id:</span> ADR-001
<span class="k">status:</span> accepted
<span class="k">affects:</span> [acme.backend.auth, auth-token@v1]
<span class="k">date:</span> 2026-07-02
<span class="c">---</span>
<span class="h"># ADR-001: Auth provider</span>
<span class="h">## Context</span>
Login must work across mobile and web, and key material must rotate.
<span class="h">## Decision</span>
Use provider X with rotating asymmetric keys.
<span class="h">## Consequences</span>
- token verification needs the public JWKS endpoint
- key rotation is a hard dependency for auth.2`)}`;
}

// ---------------------------------------------------------------- chapter: phases

function planTable(s, highlightTier = "") {
  const rows = AUTH_PHASES.map((p) => {
    const dim = highlightTier && p.tier !== highlightTier;
    return `<tr ${act("phase", p.id)} tabindex="0" class="${s.phase === p.id ? "selected" : ""}${dim ? " dim" : ""}"><td class="mono">${p.id}</td><td>${p.name}</td><td>${chip(p.tier, p.tier)}</td><td>${p.size}</td><td>${p.deps}</td><td>${p.col}</td></tr>`;
  }).join("");
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Phase</th><th>Name</th><th>Tier</th><th>Size</th><th>Depends on</th><th>Collides with</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function planView(s) {
  const p = PHASE_BY_ID[s.phase];
  return `<div class="bar"><span class="label">Phase plan: acme.backend.auth</span><span class="hint">Default gate: ${c("cargo test")} · select a row</span></div>
    ${planTable(s)}
    <div class="detail"><h3 class="mono">${p.id}: ${p.name}</h3>${fields(p.rec)}</div>`;
}

const CANDIDATES = {
  big: { title: "Build the whole auth subsystem", sub: "~2,000 lines · 20+ tasks", verdict: "bad", text: "<b>Too big: split it.</b> Nobody can genuinely review 2,000 lines and verify them by hand in one sitting. This is a leaf-parent's worth of work, so hsdd-phase-plan splits it into phases." },
  right: { title: "Token issuance with provider X", sub: "~400 lines · 6 tasks · full-review", verdict: "ok", text: "<b>One PE.</b> The agent run, a careful review, and the manual verification fit in about half a day." },
  tiny: { title: "Add the session-expiry enum", sub: "~20 lines · 1 task · spot-check", verdict: "warn", text: "<b>Below the floor: merge it.</b> It has the same tier and consumes the same contracts as the session-store phase next to it, nothing depends on one without the other, and the merged phase still fits a sitting. On its own it would cost a full cycle and buy nothing." },
};
function sizingView(s) {
  const pick = s.cand;
  return `<div class="bar"><span class="label">Is this a good phase?</span><span class="hint">Pick one</span></div>
    <div class="cards">${Object.entries(CANDIDATES).map(([k, v]) => `<button class="card" ${act("cand", k)} aria-pressed="${pick === k}"><h3>${v.title}</h3><p class="mono">${v.sub}</p></button>`).join("")}</div>
    ${pick ? `<div class="verdict ${CANDIDATES[pick].verdict}">${CANDIDATES[pick].text}</div>` : `<div class="verdict neutral">The ceiling: a phase must fit one review sitting. The floor: a phase must earn its own cycle.</div>`}
    ${fields([["One PE", "the largest change one reviewer can genuinely review and manually verify in one sitting, plus the agent run"], ["Roughly", "<= 400 changed lines of non-generated code, <= 8 tasks, about half a working day end to end"]])}`;
}

const TIERS = {
  "gate-only": { for: "scaffolding, types, boilerplate", gate: "the gate command passes; proceed automatically and notify the human", artifacts: "no design.md; slim verification doc" },
  "spot-check": { for: "well-constrained work with a clear contract", gate: "glance at the diff, confirm the gate, proceed", artifacts: "design.md only if the phase settles a real design decision; short verification doc" },
  "full-review": { for: "orchestration, business logic, integrations, security", gate: "read the diff, run the manual verification, think through edge cases", artifacts: "the full set; full verification doc" },
};
function tiersView(s) {
  const tier = s.tier;
  return `<div class="cards">${Object.entries(TIERS).map(([k, v]) => `<button class="card" ${act("tier", k)} aria-pressed="${tier === k}">${chip(k, k)}<p>${v.for}</p></button>`).join("")}</div>
    <div class="detail">${fields([["At the gate", TIERS[tier].gate], ["Artifacts", TIERS[tier].artifacts], ["Always", "tasks and spec deltas in full (they drive the tests), and a verification doc"]])}</div>
    ${planTable(s, tier)}`;
}

function freezeView(s) {
  const reconciled = s.step >= 4;
  const gov = `<div class="doc"><div class="doc-tab"><span class="mono">main (root lineage)</span><span>${reconciled ? chip("ok", "written by hsdd-reconcile") : chip("warn", "read-only while planning")}</span></div><pre>hsdd/contract/   auth-token.md  ${reconciled ? "<span class=\"k\">status: stable · phase_ids: final</span>" : "status: draft · phase_ids: provisional"}
hsdd/adr/        001-auth-provider.md
hsdd/conventions.md
hsdd/contract/INDEX.md, hsdd/adr/INDEX.md   ${reconciled ? "<span class=\"k\">regenerated</span>" : "generated"}</pre></div>`;
  const wt = (name, file, body) => `<div class="doc"><div class="doc-tab"><span class="mono">worktree: ${name}</span><span>writes only its own plan</span></div><pre><span class="c">${file}</span>
<span class="h">## Governance updates (pending reconcile)</span>
${body}</pre></div>`;
  if (!reconciled) {
    return `${gov}<div class="cols">
      ${wt("plan-auth", "hsdd/spec/acme.backend.auth.md", "- confirm `auth-token@v1` produced_by:\n    [acme.backend.auth.2]\n- amend `auth-token@v1`: expired tokens\n    return 401, never 403")}
      ${wt("plan-billing", "hsdd/spec/acme.backend.billing.md", "- confirm `auth-token@v1` consumers:\n    [acme.backend.billing.2]\n- request `auth-token@v1`: which fixture\n    do consumers mock against?\n  - assumption: the fixtures in\n      hsdd/contract/fixture/auth-token/\n  - contingent phases:\n      acme.backend.billing.2")}
    </div>`;
  }
  return `${flow([["k-impl", "Merge both plan branches", "clean: they touched different files", "1"], ["k-process", "hsdd-reconcile drains", "at the root, once", "2"], ["k-gate", "You resolve each request", "the fixture question", "3"], ["k-done", "Governance updated", "contract stable, registry regenerated", "4"]])}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Entry</th><th>What reconcile does</th></tr></thead><tbody>
      <tr><td class="mono">confirm</td><td>finalizes the contract's produced_by and consumers phase ids</td></tr>
      <tr><td class="mono">request</td><td>asks you; contingent phases wait until it is resolved</td></tr>
      <tr><td class="mono">amend</td><td>adds the guarantee to the contract body; a breaking change goes to you and bumps the version</td></tr>
      <tr><td class="mono">note</td><td>a fact for conventions.md; dropped if the registry already says it</td></tr>
    </tbody></table></div>${gov}`;
}

// ---------------------------------------------------------------- chapter: execute

function contextDocView(s) {
  const op = s.method === "openspec";
  const lands = op
    ? flow([["k-process", "/hsdd-phase acme.backend.auth.2", "writes the context", "1"], ["k-impl", "openspec/config.yaml", "the same text, between markers", "2"], ["k-done", "opsx: new ...", "proposal, design, tasks, apply, archive", "3"]])
    : flow([["k-process", "/hsdd-phase acme.backend.auth.2 --method superpowers", "writes the context", "1"], ["k-impl", "hsdd-context/superpowers/acme.backend.auth.2.md", "a spec for writing-plans", "2"], ["k-done", "superpowers:writing-plans", "then subagent-driven-development, test-first", "3"]]);
  return `<div class="bar"><span class="label">Coding method</span>${seg("method", s.method, [["openspec", "OpenSpec"], ["superpowers", "superpowers"]], "Coding method")}</div>
    ${lands}
    ${doc("hsdd-context/acme.backend.auth.2.md", "the generic phase context (abridged)", `<span class="h"># Current Phase: acme.backend.auth.2 - Token issuance (provider X)</span>
<span class="h">## Goal</span>
Issue JWTs on login via provider X; sign, set claims, handle errors.
<span class="h">## Where it sits</span>
- Node: acme.backend.auth · Sign merchants in and issue the tokens
  other nodes verify.
- Owns: login, token issuance, sessions
- Does not own: merchant profiles, billing
<span class="h">## Phase</span>
- Produces: auth-token@v1 · Governed by: ADR-001 · Review tier: full-review
- Gate: cargo test plus contract replay for auth-token
<span class="h">## Contracts</span>
### auth-token@v1 · produces · stable
A signed JWT with the claims { sub, exp, iat, scopes }. exp > iat ...
<span class="h">## Decisions</span>
### ADR-001: Auth provider · accepted
Use provider X with rotating asymmetric keys. ...
<span class="h">## Discipline</span>
- Test-first. Consume contracts only. Change nothing under hsdd/
  except this phase's verification doc.
<span class="h">## Links (spec 4f2a9c1)</span>`)}`;
}

function cycleView(s) {
  const op = s.method === "openspec";
  return `<div class="bar"><span class="label">Coding method</span>${seg("method", s.method, [["openspec", "OpenSpec"], ["superpowers", "superpowers"]], "Coding method")}</div>
    ${op
      ? flow([["k-impl", "new", "a change for this phase", "1"], ["k-impl", "proposal · design · tasks", "design.md scaled by tier", "2"], ["k-impl", "apply", "test-first, task by task", "3"], ["k-gate", "gate", "gate command + contract replay", "4"], ["k-done", "verification doc", "then archive", "5"]])
      : flow([["k-impl", "writing-plans", "plans from the phase spec", "1"], ["k-impl", "the tier's execution skill", "test-driven-development on every task", "2"], ["k-gate", "gate", "gate command + contract replay", "3"], ["k-done", "verification doc", "written from the template", "4"]])}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tier</th><th>proposal</th><th>design.md</th><th>tasks + spec deltas</th><th>verification doc</th></tr></thead><tbody>
      <tr><td>${chip("gate-only", "gate-only")}</td><td>brief</td><td>skipped</td><td>full</td><td>slim</td></tr>
      <tr><td>${chip("spot-check", "spot-check")}</td><td>brief</td><td>only for a real decision</td><td>full</td><td>short</td></tr>
      <tr><td>${chip("full-review", "full-review")}</td><td>full</td><td>full</td><td>full</td><td>full</td></tr>
    </tbody></table></div>`;
}

const LEARNINGS = [
  ["l1", "Billing and mobile will both need the same JWKS cache that auth.2 built for key rotation."],
  ["l2", "auth.4's size estimate looks low now that refresh tokens need their own endpoint."],
];
const DISPOSITIONS = [["", "Choose a disposition"], ["spec-updated", "spec-updated"], ["contract-bumped (auth-token@v2)", "contract-bumped (auth-token@v2)"], ["adr-proposed (ADR-002)", "adr-proposed (ADR-002)"], ["dropped (not worth it)", "dropped (reason)"]];
function gateView(s) {
  const ready = LEARNINGS.every(([id]) => s.learn[id]);
  return `${doc("hsdd/verify/acme.backend.auth.2.verification.md", "written at apply, signed at the gate", `<span class="h"># Verification: acme.backend.auth.2 - Token issuance (provider X)</span>
<span class="h">## Commands to run</span>        cargo test; contract replay for auth-token
<span class="h">## Expected output</span>        all green; replay matches every fixture
<span class="h">## Observed</span>               2026-07-09: 41 tests green, replay matched
<span class="h">## Outstanding</span>
- production key rotation not exercisable in the sandbox
  disposition: deferred to acme.backend.auth.4
<span class="h">## Learnings</span>              (about the tree, not this phase; dispositions below)
<span class="h">## Sign-off</span>
- Reviewer / date · Review tier applied: full-review
- Disposition of each Outstanding item`)}
    <div class="learn">${LEARNINGS.map(([id, text]) => `<div class="learn-item"><span>${text}</span><label class="sr-only" for="learn-${id}">Disposition</label><select id="learn-${id}" ${act("learn", id)}>${DISPOSITIONS.map(([v, l]) => `<option value="${esc(v)}"${s.learn[id] === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>`).join("")}</div>
    <div class="bar"><button class="btn primary" ${act("signoff")} ${ready ? "" : "disabled"}>Sign off</button><span class="hint">${ready ? (s.signed ? "" : "Every item has a disposition.") : "Sign-off waits until every learning has a disposition. Writing none is fine; leaving one blank is not."}</span></div>
    ${s.signed && ready ? `<div class="verdict ok"><b>Signed.</b> Merge the doc to main the same day. That merge is what done means; dispositions run at the root through hsdd-spec, hsdd-contract or hsdd-adr.</div>` : ""}`;
}

function renegotiateView() {
  return `${flow([["k-gate", "Pause", "at a task boundary", "1"], ["k-impl", "Record the gap", "in the verification doc's Outstanding, as a request or amend", "2"], ["k-process", "Renegotiate at the root", "with a human, through hsdd-contract", "3"], ["k-impl", "Propagate", "bring the change into the phase's branch", "4"], ["k-process", "Re-run /hsdd-phase", "the context now carries the fix", "5"], ["k-done", "Resume", "from the same task", "6"]])}
    <div class="verdict bad"><b>Never:</b> improvise around the contract, or edit hsdd/contract/ from inside the phase. Producer-side code changes ship through the producing node's own phases.</div>`;
}

// ---------------------------------------------------------------- chapter: adopt

function seamsView(s) {
  const q = s.quiz;
  const answer = q === "" ? "" : q === "monolith"
    ? `<div class="verdict ok"><b>Right.</b> The monolith has fewer seams. Shallow adoption extracts structure by script and never reads the code, so cost tracks seams. Budget by seam count, never by lines of code.</div>`
    : `<div class="verdict bad"><b>Not quite.</b> Forty services means far more routes, topics, schemas, and owners to map. Lines of code barely matter, because adoption never reads them.</div>`;
  return doc("$ node hsdd/scripts/seams/extract-seams.mjs extract -o .hsdd-seams.json", "what the model records (summary)", `<span class="c"># stamped with the commit it looked at: 9f3c2ab</span>
<span class="k">manifests</span>   package.json, go.mod
<span class="k">modules</span>     src/billing  src/payouts  src/merchant  db  cmd/server
<span class="k">routes</span>      GET /v1/payouts       src/payouts/routes.go:41
            POST /v1/payouts      src/payouts/routes.go:58   ...
<span class="k">schemas</span>     src/payouts/openapi.yaml, src/merchant/schema.graphql
<span class="k">tables</span>      from db/migrations: payouts, payout_batches, invoices, ...
<span class="k">topics</span>      produces payout.settled; consumes kyc.verified
<span class="k">owners</span>      CODEOWNERS: @payments-team, @treasury, @platform
<span class="k">co-change</span>   directories that change together in git history`)
    + `<div class="bar"><span class="label">Quick check</span><span>Which is cheaper to adopt?</span></div>
    <div class="cards">
      <button class="card" ${act("quiz", "monolith")} aria-pressed="${q === "monolith"}"><h3>A 1M-line monolith</h3><p>20 endpoints, 5 tables</p></button>
      <button class="card" ${act("quiz", "mesh")} aria-pressed="${q === "mesh"}"><h3>A 100k-line service mesh</h3><p>40 services</p></button>
    </div>${answer}`;
}

function proposedTree(s) {
  const ok = s.confirmed;
  let out = marker("ah-lp");
  out += box({ x: 290, y: 16, w: 180, kind: "root", title: "legacy-pay", sub: "root, internal" });
  const kids = [["legacy-pay.billing", "src/billing · @payments-team", 125], ["legacy-pay.payouts", "src/payouts · @payments-team", 380], ["legacy-pay.merchant", "src/merchant · no owner line", 635]];
  for (const [id, sub, cx] of kids) {
    out += elbow(380, 62, cx, 98, "", "ah-lp");
    out += box({ x: cx - 115, y: 100, w: 230, kind: "observed", title: id, sub, badge: "as-built", badgeCls: "badge-obs" });
  }
  return `<div class="bar"><span class="label">Proposed tree</span>${ok ? chip("ok", "confirmed by you") : chip("warn", "waiting for your confirmation")}</div>
    ${svg("0 0 760 156", "The proposed legacy-pay tree: three as-built leaf-parents", out)}
    ${fields([["Folded in", "db/ and cmd/server are shared infrastructure, folded into the nodes that own their tables and entry point"], ["One owner each", "treasury also appears in CODEOWNERS for src/payouts; payments owns the node and treasury is recorded as a stakeholder"], ["Unknowns so far", "settlement retry logic has no tests; merchant has no CODEOWNERS line"]])}
    <div class="bar">${ok ? `<button class="btn" ${act("confirm", "undo")}>Undo</button><span class="hint">Now, and only now, the skill writes node specs and contracts.</span>` : `<button class="btn primary" ${act("confirm", "yes")}>Confirm the tree</button><button class="btn" ${act("confirm", "move")}>Move a module</button><span class="hint">No node spec or contract is written before this stop.</span>`}</div>
    ${s.moved ? `<div class="verdict neutral">Moving a module is just as valid: the tree is redrawn and shown again. In this example, keep the proposal and confirm.</div>` : ""}`;
}

function asBuiltView(s) {
  const r = s.region;
  const on = (k) => (r === "all" ? null : r === k);
  const notes = {
    all: "",
    authored: "<b>Authored: yours.</b> The bullet header claims intent, as in any node spec, plus Adopted: as-built. Isolation strategy records how the node is tested today, not how you wish it were.",
    observed: "<b>Observed: the tooling's.</b> Pasted verbatim from the extractor's render, stamped with the commit. Nobody edits a bullet by hand. The modules line is the scope the checkpoint re-extracts later to detect drift.",
    unknown: "<b>Unknowns: required.</b> A node with no unknown: lines is a node nobody looked at. Here the third one explains why Owns names two tables while the surface says none found: the migrations live outside the module.",
  };
  return `<div class="bar"><span class="label">Highlight</span>${seg("region", r, [["authored", "Authored"], ["observed", "Observed"], ["unknown", "Unknowns"], ["all", "All"]], "Spec region")}</div>
    ${doc("hsdd/spec/legacy-pay.payouts.md", "an as-built node spec", `<span class="h"># legacy-pay.payouts: Payouts (as built)</span>
`
      + rgn("authored", on("authored"), `- Kind: leaf-parent
- Purpose: schedule and settle merchant payouts, as currently deployed;
  treasury signs off on settlement runs
- Team: payments-team
- Owns: payouts and payout_batches tables, the settlement job,
  GET and POST /v1/payouts
- Does not own: invoicing (legacy-pay.billing), merchant profiles
- Consumes: [kyc-verified-events@v0]
- Produces: [payouts-api@v0, payout-settled-events@v0]
- Adopted: as-built
- Isolation strategy: tests/payouts/ and staging; the settlement job
  has no tests`)
      + `\n<span class="h">## Observed surface</span>\n`
      + rgn("observed", on("observed"), `- extracted: 2026-10-10 @ 9f3c2ab  (hsdd/scripts/seams/extract-seams.mjs)
- modules: src/payouts/
- routes: 2  (GET /v1/payouts, POST /v1/payouts)
- tables: none found
- topics: produces payout.settled; consumes kyc.verified
- owners: @payments-team, @treasury`)
      + rgn("unknown", on("unknown"), `- unknown: settlement retry logic (no tests, no docs)
- unknown: who consumes payout.settled outside this repository
- unknown: the payouts tables live in db/migrations, outside this module`))}
    ${notes[r] ? `<div class="verdict neutral">${notes[r]}</div>` : ""}`;
}

function v0View(s) {
  const r = s.v0part;
  return `<div class="bar"><span class="label">Highlight</span>${seg("v0part", r, [["version", "v0 and stable"], ["completeness", "Observed completeness"]], "Contract region")}</div>
    ${doc("hsdd/contract/payouts-api.md", "an adopted contract", rgn("", r === "version", `<span class="c">---</span>
<span class="k">id:</span> payouts-api
<span class="k">version:</span> v0
<span class="k">status:</span> stable
<span class="k">kind:</span> api
<span class="k">owner:</span> legacy-pay.payouts
<span class="k">compatibility:</span> additive-only
<span class="k">produced_by:</span> [legacy-pay.payouts]   <span class="c"># a node id until promotion</span>
<span class="k">consumers:</span> [legacy-pay.merchant]
<span class="k">external_consumers:</span> [treasury-ledger]
<span class="k">phase_ids:</span> provisional
<span class="c">---</span>`) + `
<span class="h">## Interface</span>
GET /v1/payouts?merchant_id=  -> 200 [{ id, merchant_id, amount, status }]
POST /v1/payouts { merchant_id, amount } -> 201 { id, status: "scheduled" }
<span class="h">## Guarantees / invariants</span>
- A payout id is never reused.
- status moves scheduled -> settled -> paid and never backwards.
<span class="h">## Versioning</span>
- v0 is observed behavior. Additive changes keep v0; a redesign mints v1.
<span class="h">## Validation</span>
- schema: hsdd/contract/schema/payouts-api.schema.json
- fixture: hsdd/contract/fixture/payouts-api/
` + rgn("", r === "completeness", `<span class="h">## Observed completeness</span>
- covered by fixtures: happy path, 4xx envelope, pagination
- NOT exercised: partial-batch failure, idempotency-key replay
- inferred from code, never observed in traffic: retry-after semantics`))}
    <div class="verdict neutral">${r === "version"
      ? "<b>v0 means observed, not designed.</b> Stable from day one: the schema comes from code or the OpenAPI file, fixtures from existing tests or captured payloads. v0 is permanent; additive changes never leave it. Only a genuine redesign mints v1."
      : "<b>What the fixtures do not reach.</b> An adopted contract's guarantees are inferred, so it says where the evidence stops. The block is maintained: a fixture added later updates it in the same edit, and a stale block is a checkpoint finding."}</div>`;
}

function stopView() {
  return `<div class="cols">
    <div class="verdict bad"><b>Full-depth reverse engineering</b><span>Days of reading and a four-figure bill. Then 500 generated node specs that nobody reads, which every later agent session treats as authoritative. Unread wrong specs spread, so this is worse than no adoption.</span></div>
    <div class="verdict ok"><b>Shallow adoption, promotion on demand</b><span>Hours and tens of dollars for a million lines, because structure comes from a script. A node's real spec is written when someone is about to work on it, and they confirm it. Every spec in the tree has been read.</span></div>
  </div>
  ${flow([["k-obs", "Extract seams", "by script, stamped with a commit", "1"], ["k-gate", "Confirm the tree", "depth 1 to 2", "2"], ["k-obs", "As-built specs", "observed surface + unknowns", "3"], ["k-obs", "v0 contracts", "observed completeness", "4"], ["k-done", "Prove and stop", "regenerate the registries", "5"]])}`;
}

// ---------------------------------------------------------------- chapter: change

function oneTreeView() {
  const row = (title, cls, items) => `<div><p class="col-title">${title}</p>${flow(items)}</div>`;
  return `${row("Each PRD becomes a root", "", [["k-flow", "PRD A", "spec tree A"], ["k-bad", "PRD B arrives", "tree A no longer fits: rebuild"], ["k-bad", "PRD C arrives", "rebuild again"], ["k-bad", "Every time", "adoption cost paid again, amortized over nothing"]])}
    ${row("One tree, and it is the system's", "", [["k-flow", "legacy-pay tree", "adopted once"], ["k-done", "PRD A", "intake record 1: phases appended to payouts"], ["k-done", "Ticket B", "intake record 2: a contract added, two nodes planned"], ["k-done", "RFC C", "intake record 3: a node grafted"]])}
    <div class="verdict neutral">After five change requests, hsdd/spec/ holds more nodes and longer phase ledgers, and hsdd/management/ holds five intake records. Records are dated and never superseded. Phase numbers continue; shipped phases are never renumbered or rewritten.</div>`;
}

function intakeRecord(id, s) {
  const r = REQUESTS[id];
  // Earlier open intakes on the same node; the scheduling one closes when the reader says so.
  const waits = r.waits.filter((k) => k !== "schedule" || s.openSched).map((k) => `${REQUESTS[k].date}-intake-${REQUESTS[k].slug}.md`);
  const collides = waits.length > 0;
  const collisions = collides ? `[${waits.join(", ")}] (this intake waits on ${waits.length > 1 ? "them" : "it"})` : "none";
  return doc(`hsdd/management/${r.date}-intake-${r.slug}.md`, "written before any handoff", `<span class="h"># Intake: ${esc(r.title)}</span>
- <span class="k">Date:</span> ${r.date}
- <span class="k">Request:</span> ${esc(r.source)}
- <span class="k">Class:</span> ${r.cls}
- <span class="k">Lands on:</span> [${esc(r.lands)}] · <span class="k">Contracts:</span> [${esc(r.contracts)}]
- <span class="k">Promotes:</span> ${r.promotes === "none" ? "none" : `[${esc(r.promotes)}]`}
- <span class="k">Collisions:</span> ${esc(collisions)}
- <span class="k">Status:</span> open

<span class="h">## Request</span>
${esc(wrap(r.ask, 74))}

<span class="h">## Routing</span>
${esc(wrap(r.routing, 74))}
${r.handoff.length ? `Handoff:\n${r.handoff.map((h) => `  ${esc(h)}`).join("\n")}` : "No handoff: a human decides the tree's shape first."}

<span class="h">## Produced</span>
(hsdd-checkpoint appends the phases whose Scope cites this record)

<span class="h">## Change log</span>
- ${r.date}: created, routed ${r.cls}${collides ? "; serialized behind the open intakes above" : ""}`);
}
function wrap(text, width) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > width) { out.push(line.trim()); line = word; } else line += " " + word;
  }
  if (line.trim()) out.push(line.trim());
  return out.join("\n");
}

function routerView(s) {
  const id = s.request;
  return `<div class="bar"><span class="label">A change request arrives</span><span class="hint">Pick one</span></div>
    <div class="req-list">${Object.entries(REQUESTS).map(([k, r]) => `<button class="card" ${act("request", k)} aria-pressed="${id === k}"><h3>${r.title}</h3><p>${esc(r.source)}</p></button>`).join("")}</div>
    ${intakeRecord(id, s)}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Class</th><th>Means</th><th>Routes to</th></tr></thead><tbody>${CLASSES.map(([k, m, to]) => `<tr class="${REQUESTS[id].cls === k ? "selected" : "dim"}"><td class="mono">${k}</td><td>${m}</td><td>${to}</td></tr>`).join("")}</tbody></table></div>`;
}

function promoteView(s) {
  const after = s.promoted;
  return `<div class="bar"><span class="label">legacy-pay.payouts</span>${seg("promoted", after ? "after" : "before", [["before", "As-built"], ["after", "After promotion"]], "Promotion state")}</div>
    ${doc("hsdd/spec/legacy-pay.payouts.md", after ? "promoted, governed" : "as-built, observed", `<span class="h"># legacy-pay.payouts: Payouts</span>
- Kind: leaf-parent
- Team: payments-team
- Sources: ${after ? "<span class=\"k\">## Observed surface (this file),\n  docs/prd-payout-scheduling.md</span>" : "none"}
- Adopted: ${after ? "<span class=\"k\">promoted</span>" : "as-built"}
- Decomposes into: ${after ? "phases (see phase plan)" : "phases (only when this subtree changes)"}

<span class="h">## Observed surface</span>          ${after ? "<span class=\"c\">kept as provenance</span>" : ""}
- extracted: 2026-10-10 @ 9f3c2ab ...
${after ? `
<span class="h">## Phase Plan</span>             <span class="c">appended next, by hsdd-phase-plan</span>
| Phase                | Name                      | Tier        |
| legacy-pay.payouts.1 | Schedule model + API field | spot-check  |
| legacy-pay.payouts.2 | Batch by schedule          | full-review |
| legacy-pay.payouts.3 | Treasury batch preview     | spot-check  |
<span class="c">  each phase's Scope cites hsdd/management/2026-10-10-intake-payout-scheduling.md</span>` : ""}`)}
    ${after
      ? `<div class="verdict ok"><b>Confirmed, then authoritative.</b> hsdd-spec decomposed the node using its observed surface and the PRD as primary sources, and stopped for your confirmation. Then the intake's next handoff, hsdd-phase-plan, appended the phases. payouts-api keeps v0: its first phase becomes the producer, and the contract stays observed.</div>`
      : `<div class="verdict warn"><b>An as-built spec is an unvalidated claim about intent.</b> Before a change is planned on it, hsdd-spec promotes it, with a human confirmation stop. Landing on an as-built node is not a separate class: promote first, then classify.</div>`}`;
}

function collisionView(s) {
  const open = s.openSched;
  return `<div class="bar"><span class="label">Payout-scheduling intake</span>${seg("openSched", open ? "open" : "closed", [["open", "still open"], ["closed", "closed"]], "Earlier intake status")}</div>
    <div class="cols">
      <div class="doc"><div class="doc-tab"><span class="mono">2026-10-10-intake-payout-scheduling.md</span><span>${open ? chip("warn", "open") : chip("ok", "closed")}</span></div><pre>Lands on: [legacy-pay.payouts]
Contracts: [payouts-api@v0]
${open ? "Change log:\n- 2026-10-14: payout-hold intake\n  waits on this one" : "Status: closed (2026-10-13)\nevery listed phase has its\nverification doc on main"}</pre></div>
      <div class="doc"><div class="doc-tab"><span class="mono">2026-10-14-intake-payout-hold.md</span><span>${open ? chip("warn", "serialized") : chip("ok", "proceeds")}</span></div><pre>Lands on: [legacy-pay.billing,
           legacy-pay.payouts]
Collisions: ${open ? "[2026-10-10-intake-\n  payout-scheduling.md]" : "none"}</pre></div>
    </div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>When two open intakes...</th><th>Rule</th></tr></thead><tbody>
      <tr class="${open ? "selected" : ""}"><td>touch the same node or contract</td><td>serialize, or merge into one record; write which, in both records</td></tr>
      <tr><td>graft new children under the same parent</td><td>serialize: both edit the parent's child list and graph</td></tr>
      <tr><td>need the same as-built node promoted</td><td>promote once and share the result; the second never re-promotes</td></tr>
    </tbody></table></div>`;
}

function mixedView() {
  let out = marker("ah-mx");
  out += box({ x: 290, y: 16, w: 180, kind: "root", title: "legacy-pay", sub: "root" });
  const kids = [
    ["legacy-pay.billing", "as-built", "observed", 95],
    ["legacy-pay.payouts", "promoted · phases .1-.6", "leafparent", 285],
    ["legacy-pay.merchant", "as-built", "observed", 475],
    ["legacy-pay.disputes", "grafted · governed", "leafparent", 665],
  ];
  for (const [id, sub, kind, cx] of kids) {
    out += elbow(380, 62, cx, 98, "", "ah-mx");
    out += box({ x: cx - 89, y: 100, w: 178, kind, title: id, sub });
  }
  return `${svg("0 0 760 156", "A mixed tree: as-built, promoted and grafted nodes side by side", out)}
    <div class="cols">
      <div><p class="col-title">Drift, at every checkpoint</p>${flow([["k-obs", "Re-extract per node", "the scope in its modules line"], ["k-gate", "billing: routes 2 → 3", "a finding, not an error"], ["k-done", "Plan step", "a reviewed re-render; on a promoted node, code that no phase covers is a backfill"]])}</div>
      <div><p class="col-title">The legal bypass</p>${flow([["k-bad", "Hotfix ships", "no phase"], ["k-gate", "Checkpoint finds it", "code with no phase: backfill"], ["k-done", "Retro phase", "verification doc marked retroactive"]])}<p class="caveat">A backfill left open for two checkpoints in a row escalates. Here phases .1-.3 came from the scheduling intake, .4-.5 from the payout hold, and the hotfix became retro phase .6.</p></div>
    </div>`;
}

// ---------------------------------------------------------------- chapter: manage

function rolesView() {
  return `<div class="tbl-wrap"><table class="tbl roles"><thead><tr><th></th><th>Developer</th><th>Lead</th></tr></thead><tbody>
    <tr><td>Plan</td><td>drafts the tree, contracts and phase plans, often sitting with a lead for the split</td><td><b>verifies</b> the split, the contracts, and the phase sizes before any phase opens; arbitrates reconcile</td></tr>
    <tr><td>Execute</td><td>owns it: phase switch, coding cycle, tests, gate, verification doc</td><td>reviews at the tier each phase declares</td></tr>
    <tr><td>Manage</td><td>supplies the evidence: verification docs merged to main</td><td>owns it: the weekly checkpoint, milestones, the stakeholder conversation</td></tr>
  </tbody></table></div>
  <div class="verdict warn"><b>The one hard rule:</b> the lead verifies the decomposition before phases open. A wrong split reworks every node beneath it, and it is cheapest to fix on the day it is drawn.</div>`;
}

function checkpointView() {
  return `${flow([["k-impl", "Spec repo + every implementation repo", "commit SHAs pinned in each report", "in"], ["k-process", "/hsdd-checkpoint", "one evidence pass", "pass"]])}
    <div class="cards">
      <div class="card"><h3>Progress report</h3><p>What is actually done, with evidence. Velocity per lane, ranked blockers, a findings register, an honest verdict.</p></div>
      <div class="card"><h3>Execution plan</h3><p>This week's steps. Agent steps carry the exact prompt to paste; human steps carry why, what to do, and when it is done.</p></div>
      <div class="card"><h3>Atlas</h3><p>The tree with phase status, the contract graph, and ADR coverage. Regenerated whole every time.</p></div>
      <div class="card"><h3>Milestone gates</h3><p>Ticked from the same evidence, never from claims.</p></div>
    </div>
    <div class="verdict neutral">Every finding becomes a plan step or an explicit waiver. The review compiles into next week's work; it never just advises. When new context lands mid-week, a scoped checkpoint issues a revised plan the same day.</div>`;
}

function loopView() {
  let out = marker("ah-lp2");
  out += box({ x: 10, y: 30, w: 190, kind: "phase", title: "Phases execute", sub: "verification docs merge to main", mono: false });
  out += box({ x: 285, y: 30, w: 190, kind: "gate", title: "/hsdd-checkpoint", sub: "one evidence pass" });
  out += box({ x: 560, y: 30, w: 190, kind: "plain", title: "Progress report + atlas", sub: "what is actually true", mono: false });
  out += box({ x: 560, y: 150, w: 190, kind: "plain", title: "Execution plan", sub: "steps, prompts, guardrails", mono: false });
  out += box({ x: 285, y: 150, w: 190, kind: "internal", title: "Spec tree", sub: "fixes when review found drift", mono: false });
  out += box({ x: 10, y: 150, w: 190, kind: "leafparent", title: "Next phases", sub: "this week's steps", mono: false });
  out += `<text x="240" y="22" text-anchor="middle" class="t-label">evidence up</text><path class="edge hot" d="M200 53 L281 53" marker-end="url(#ah-lp2)"/>`;
  out += `<path class="edge" d="M475 53 L556 53" marker-end="url(#ah-lp2)"/>`;
  out += `<path class="edge" d="M655 76 L655 146" marker-end="url(#ah-lp2)"/>`;
  out += `<path class="edge" d="M560 173 L479 173" marker-end="url(#ah-lp2)"/><text x="518" y="142" text-anchor="middle" class="t-label">spec fixes</text>`;
  out += `<path class="edge hot" d="M600 196 C 500 252, 220 252, 110 200" marker-end="url(#ah-lp2)"/><text x="355" y="252" text-anchor="middle" class="t-label">work down</text>`;
  out += `<path class="edge" d="M105 150 L105 80" marker-end="url(#ah-lp2)"/>`;
  return `${svg("0 0 760 262", "The management loop: evidence flows up, work flows down", out)}
    <div class="verdict neutral"><b>Done means one thing:</b> the phase's verification doc is merged to the spec repo's main branch. Everything else is reported as a claim.</div>`;
}

function milestoneView() {
  return `<div class="ms">
    <div class="ms-card"><span class="eyebrow">M1 · base Nov 6 · window Nov 4-12</span><h3>Demo: a merchant signs up on web and receives a token</h3><ul><li><span class="box">[x]</span>acme.backend.auth.1-4 done</li><li><span class="box">[x]</span>auth-token@v1 replay green</li><li><span class="box">[ ]</span>acme.web.signup.2 done</li></ul></div>
    <div class="ms-card"><span class="eyebrow">M2 · base Nov 27 · window Nov 24-Dec 5</span><h3>Demo: a merchant pays the first invoice</h3><ul><li><span class="box">[ ]</span>acme.backend.billing.1-3 done</li><li><span class="box">[ ]</span>acme.web.billing.1 done</li></ul></div>
    <div class="ms-card tail"><span class="eyebrow">Contingent tail · outside the launch gate</span><h3>Bank payout rails</h3><ul><li>Waits on: the bank's sandbox (OQ-B3)</li><li>Degradation path: manual payouts at launch</li></ul></div>
  </div>
  <div class="verdict neutral">Each milestone is a demo someone can watch work plus yes/no gate items. The checkpoint ticks the gates. A gate red at two checkpoints in a row, or a scope change the dates cannot absorb, triggers a re-baseline that states the old window and the new one together.</div>`;
}

// ---------------------------------------------------------------- chapter: begin

function skillsView(s) {
  const all = SKILLS.flatMap(([, list]) => list);
  const sel = all.find(([n]) => n === s.skill) || all[0];
  return `<div class="skills">${SKILLS.map(([group, list]) => `<div class="skill-group"><p>${group}</p><div class="skill-row">${list.map(([n]) => `<button class="skill" ${act("skill", n)} aria-pressed="${sel[0] === n}">${n}</button>`).join("")}</div></div>`).join("")}</div>
    <div class="detail"><h3 class="mono">${sel[0]}</h3><p>${sel[1]}</p>${promptBox(sel[2], "Say this to your agent")}</div>`;
}
function promptBox(text, note = "") {
  return `<div class="prompt"><span>${esc(text)}${note ? `<small>${note}</small>` : ""}</span><button class="btn small" ${act("copy", text)}>Copy</button></div>`;
}
function firstSessionView(s) {
  const green = s.path === "green";
  const steps = green
    ? [["Write a high-level spec for acme from docs/onboarding-prd.md: a merchant onboarding platform with a backend, a mobile app, and a web console.", "hsdd-spec asks who builds what, then splits the root"], ["Break down @hsdd/spec/acme.backend.md into auth, billing, and catalog.", "hsdd-spec again, one level down"], ["Define the auth-token contract: auth produces it, billing and mobile consume it.", "hsdd-contract, with schema and fixtures"], ["acme.backend.auth is small enough to phase. Write its phase plan.", "hsdd-phase-plan"], ["Drain the pending governance updates.", "hsdd-reconcile"], ["Set up OpenSpec config for this project.", "hsdd-config, once per project: the gate and verification-doc rules"], ["/hsdd-phase acme.backend.auth.1", "hsdd-config's switch, before every phase; then run your coding cycle"]]
    : [["Adopt this codebase into HSDD.", "hsdd-adopt extracts seams and stops at the tree for you to confirm"], ["Here's the payout-scheduling PRD, docs/prd-payout-scheduling.md. Where does it go?", "hsdd-intake writes the record and the handoff"], ["/hsdd-spec promote legacy-pay.payouts using docs/prd-payout-scheduling.md", "promotion, with your confirmation"], ["/hsdd-phase-plan legacy-pay.payouts per hsdd/management/2026-10-10-intake-payout-scheduling.md", "phases that cite the intake record"], ["Drain the pending governance updates.", "hsdd-reconcile"], ["Set up OpenSpec config for this project.", "hsdd-config, once per project"], ["/hsdd-phase legacy-pay.payouts.1", "the switch, before every phase"], ["/hsdd-checkpoint full checkpoint before Monday's sync. Repos: ~/git/legacy-pay.", "the weekly evidence pass, with drift checks"]];
  return `<div class="bar"><span class="label">Install</span></div>
    ${promptBox("npx skills add mpurbo/hsdd", "All twelve skills, for Claude Code, Cursor, Codex and other agents. Recommended companion: the superpowers plugin.")}
    <p class="caveat">The skills CLI does not install the optional slash commands such as ${c("/hsdd-phase")}. To use them, copy ${c("commands/*.md")} from this repository into your project's ${c(".claude/commands/")}; otherwise ask in words, as in the skill map.</p>
    <div class="bar"><span class="label">First session</span>${seg("path", s.path, [["green", "New system"], ["brown", "Existing codebase"]], "Starting point")}</div>
    <div class="learn">${steps.map(([p, n]) => promptBox(p, n)).join("")}</div>`;
}

function claimsView() {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Claim</th><th>What HSDD says about it</th></tr></thead><tbody>
    <tr><td>Context isolation</td><td>Shapes attention; held up under adversarial testing. Probabilistic, not enforced: nothing stops a session from opening another file.</td></tr>
    <tr><td>Tokens</td><td>Bounded per session, in proportion to the phase. The project total still grows with the number of phases, plus planning overhead.</td></tr>
    <tr><td>Evidence</td><td>Field-tested on a production monorepo and pressure-tested adversarially. Newer rules, including most of brownfield, are marked reasoned-only in the spec. A published case study with a baseline is the v1.0 criterion.</td></tr>
    <tr><td>Ceremony</td><td>Depth and artifacts are costs. A small project is one leaf-parent and a few phases.</td></tr>
    <tr><td>Unattended planning</td><td>Moves review from each question to one sitting over the decision ledger; it does not remove it. One field test ran the protocol by hand. The packaged skill and its stop path are reasoned, not field-tested.</td></tr>
  </tbody></table></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Not part of HSDD</th><th>Why</th></tr></thead><tbody>
    <tr><td>A CLI or a server</td><td>Skills are the surface; scripts ship only bundled with a skill.</td></tr>
    <tr><td>Its own TDD, debugging, or review</td><td>Companion skills already do that; HSDD wires them in.</td></tr>
    <tr><td>Scheduling and dashboards</td><td>The weekly cadence is a convention; the atlas stays a markdown file.</td></tr>
    <tr><td>Refactoring proposals during adoption</td><td>The tree fits the system, not the other way round.</td></tr>
    <tr><td>Unattended execution</td><td>hsdd-auto plans. Every phase still runs as its own coding cycle and ends at a human review gate.</td></tr>
  </tbody></table></div>`;
}

// ---------------------------------------------------------------- chapter: auto

const LOOP = [
  ["script", "next.mjs", "picks the next step from the repository's state"],
  ["script", "dispatch.mjs", "renders the prompt from templates and files"],
  ["subagent", "A fresh subagent", "one skill on one target; records each decision"],
  ["orchestrator", "The orchestrator", "reads the report and the diff; handles any stop"],
  ["script", "gate.mjs, commit.mjs", "check the step, then two commits: artifacts, then records"],
];
const ROLES = {
  script: {
    cls: "k-obs", label: "The scripts",
    does: ["which step runs next, with its kind, target and write set", "the step's prompt, with facts read from files, open routed items and predecided answers", "every decision id and timestamp, taken at the moment the decision is made", "the gate, both commits, the ledger, the run log, and the report's tables"],
    never: "make a judgement call. Anything with one right answer is a script, so no agent types a timestamp or restates a fact from memory.",
  },
  subagent: {
    cls: "k-process", label: "The step subagent",
    does: ["starts with no context except its dispatch file", "invokes exactly one HSDD skill on one target", "writes that skill's artifacts, any experiments, and a step report", "records each decision the moment it takes it"],
    never: "commit, or answer a stop. At an ask point it returns the stop with its options and ends its launch.",
  },
  orchestrator: {
    cls: "k-gate", label: "The orchestrator",
    does: ["launches each step's subagent and waits for the hand-back, without polling", "answers a stop as your stand-in, or ends the run, as the stop policy says", "reviews each step beyond the gate: every sentence the diff touches is true against what it cites", "writes the plan's change log and the report's prose"],
    never: "run a planning skill in its own context, implement a phase, run hsdd-config, or pass a review gate.",
  },
};
function autoLoopView(s) {
  const r = s.autoRole;
  const sel = ROLES[r];
  const items = LOOP.map(([role, title, sub], i) => [`${ROLES[role].cls}${sel && r !== role ? " dim" : ""}`, title, sub, String(i + 1)]);
  return `<div class="bar"><span class="label">One step, start to finish</span>${seg("autoRole", r, [["all", "All"], ["script", "Scripts"], ["subagent", "Subagent"], ["orchestrator", "Orchestrator"]], "Who does what")}</div>
    ${flow(items)}
    ${sel
      ? `<div class="detail"><h3>${sel.label}</h3><ul>${sel.does.map((d) => `<li>${d}</li>`).join("")}</ul></div>
        <div class="verdict bad"><b>Never:</b> ${sel.never}</div>`
      : `<div class="verdict neutral">The loop repeats until next.mjs reports the segment done, or a stop ends the run. Steps run one at a time, each in a subagent that has never seen the others.</div>`}`;
}

const MODES = {
  plan: {
    cmd: "/hsdd-auto", note: "plan mode on acme: an empty tree through reconcile",
    rows: [
      ["0 Setup", "S00 setup", "committed"],
      ["1 Plan", "S01 plan", "committed"],
      ["2 Root decomposition", "S02 root-spec on acme", "the root spec exists"],
      ["3 Root ADRs", "S03 adr ADR-001", "every cited ADR has a file"],
      ["4 Root contracts", "S04 to S06 contract auth-token, merchant-model, onboarding-events", "every named contract has a file"],
      ["5 Mid-level decomposition", "mid-level-spec on acme.backend, acme.mobile, acme.web, then the ADRs and contracts they name", "no internal node is left unsplit"],
      ["6 Phase plans", "phase-plan acme.backend.auth, reconcile, phase-plan acme.backend.billing, reconcile, and on, producer-first", "every leaf-parent has phases and no pending entries"],
      ["7 Consistency", "one touch per open routed item, then align on all", "no open item, and an align ran last"],
      ["8 Report", "report", "committed"],
    ],
  },
  intake: {
    cmd: "/hsdd-auto intake docs/prd-payout-scheduling.md", note: "intake mode on legacy-pay: one PRD into the planned tree",
    rows: [
      ["0 Setup", "S00 setup", "committed"],
      ["1 Plan", "S01 plan", "committed"],
      ["2 Route", "S02 intake on docs/prd-payout-scheduling.md", "the intake record exists, with its handoff block"],
      ["3 Handoffs", "S03 promote legacy-pay.payouts, S04 phase-plan legacy-pay.payouts", "every handoff ran or was skipped"],
      ["4 Consistency", "one touch per open routed item", "no open item"],
      ["5 Align", "align on legacy-pay.billing and legacy-pay.merchant", "an align ran on every leaf-parent this intake did not re-plan"],
      ["6 Report", "report", "committed"],
    ],
  },
};
function modesView(s) {
  const m = MODES[s.autoMode];
  return `<div class="bar"><span class="label">Mode</span>${seg("autoMode", s.autoMode, [["plan", "plan"], ["intake", "intake"]], "Run mode")}</div>
    ${promptBox(m.cmd, m.note)}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Stage</th><th>Steps in this example</th><th>Done when</th></tr></thead><tbody>${m.rows.map(([stage, steps, done]) => `<tr><td>${stage}</td><td>${esc(steps)}</td><td>${done}</td></tr>`).join("")}</tbody></table></div>
    <p class="caveat">${s.autoMode === "plan"
      ? "Steps are numbered across the whole run and take their id when they start, so an inserted step never renumbers another."
      : "The steps come from the record's handoff block. The run never closes the intake record: it stays open until its phases ship."}</p>`;
}

const DEC_PARTS = {
  choice: ["Question, options, chosen", "Every real choice between at least two options becomes a line, small ones included: a name, an id, a default. Each option states its consequence, so you can judge the option the run did not take."],
  why: ["Why and evidence", "The reason is written for you, reading cold, and names the signal that would have changed it. Evidence cites source sections, artifacts, other decisions, and experiments: throwaway programs a subagent ran to settle a runtime fact. Empty evidence means judgement alone, and why says so."],
  radius: ["Blast radius and confidence", "What the choice can change: node-local, contract, tree, or upstream (a read-only source would change). With would_have_asked and confidence, they decide which decisions the report shows you first."],
  stamp: ["Who, when, and the commit", "decide.mjs mints the id and stamps the time when the decision is taken, never later. commit is the step's artifact commit, so git show on it gives the artifact exactly as the decision left it."],
};
function decisionView(s) {
  const p = s.decPart;
  const on = (k) => p === k;
  const k = (name) => `<span class="k">"${name}":</span>`;
  return `<div class="bar"><span class="label">Highlight</span>${seg("decPart", p, [["choice", "Choice"], ["why", "Why"], ["radius", "Blast radius"], ["stamp", "Stamp"]], "Decision part")}</div>
    ${doc("hsdd/judgement/decisions.jsonl", "one line in the file, shown wrapped",
      rgn("", on("stamp"), `{ ${k("id")} "DEC-019", ${k("at")} "2026-07-02T09:41:07Z",
  ${k("segment")} "2026-07-02-plan", ${k("step")} "contract", ${k("step_ref")} "S04",
  ${k("by")} "subagent", ${k("artifact")} "hsdd/contract/auth-token.md",`)
      + rgn("", on("choice"), `  ${k("question")} "Does an expired token return 401 or 403?",
  ${k("options")} [
    { "label": "401", "consequence": "Clients treat expiry like a
       missing token and refresh." },
    { "label": "403", "consequence": "Clients cannot tell expiry from
       a missing scope; mobile needs a second check to refresh." } ],
  ${k("chosen")} "401",`)
      + rgn("", on("why"), `  ${k("why")} "PRD §3 sends an expired session back through login,
    the 401 path, and the experiment shows provider X raising
    TokenExpired. A source that told expiry from revocation would
    have changed this.",
  ${k("evidence")} ["PRD §3", "hsdd/auto/experiments/S04-token-expiry/"],`)
      + rgn("", on("radius"), `  ${k("blast_radius")} "contract", ${k("confidence")} "high",
  ${k("would_have_asked")} false, ${k("stop_class")} null, ${k("would_upstream")} false,`)
      + rgn("", on("stamp"), `  ${k("commit")} "3f6878f..." }`))}
    <div class="verdict neutral"><b>${DEC_PARTS[p][0]}</b><span>${DEC_PARTS[p][1]}</span></div>`;
}

const STOPS = {
  shape: {
    title: "Two defensible trees", where: "hsdd-spec on acme.backend",
    id: "S07", kind: "mid-level-spec", skill: "hsdd-spec", target: "acme.backend", segment: "2026-07-02-plan", dec: "027",
    question: "Is catalog its own leaf-parent, or part of billing? Both fit one owner, and no source, owner fact or HSDD rule gives either a reason to lead.",
    options: [["catalog as its own leaf-parent", "one more node, consuming merchant-model; catalog plans its phases on its own"], ["catalog inside billing", "one node fewer; billing's phase plan grows by about three phases"]],
    blocks: "every ADR, contract and phase plan under acme.backend",
  },
  promotion: {
    title: "payouts is still as-built", where: "the first handoff of an intake",
    id: "S03", kind: "promote", skill: "hsdd-spec", target: "legacy-pay.payouts", segment: "2026-10-10-intake-prd-payout-scheduling", dec: "006",
    question: "legacy-pay.payouts is as-built. Promote it, with its observed surface and docs/prd-payout-scheduling.md as its primary sources?",
    options: [["promote as proposed", "the node becomes governed, and the intake's phase plan can run"], ["keep it as-built", "no phases can be planned on payouts; the intake record stays open"]],
    blocks: "S04 phase-plan on legacy-pay.payouts, the align, the report",
  },
  "breaking-amend": {
    title: "auth-token needs a breaking change", where: "a stable contract, compatibility: versioned",
    id: "S12", kind: "contract-touch", skill: "hsdd-contract", target: "auth-token", segment: "2026-08-04-intake-rfc-scoped-tokens", dec: "211",
    question: "Scopes become objects with their own expiry. That breaks auth-token@v1, which is stable and versioned. Mint auth-token@v2 with a migration note?",
    options: [["mint auth-token@v2", "consumers migrate on their own schedule; v1 stays until the last one moves"], ["keep v1 and drop the per-scope expiry", "no migration; the RFC's per-scope expiry is not delivered"]],
    blocks: "the phase-plan-append steps for billing and mobile, the align, the report",
  },
  external: {
    title: "The run needs a sandbox key", where: "an experiment on provider X",
    id: "S04", kind: "contract", skill: "hsdd-contract", target: "auth-token", segment: "2026-07-02-plan",
    question: "The experiment that settles token expiry needs provider X's sandbox API key, which is not in the repository.",
    options: [["supply a sandbox key outside the repository", "the experiment runs, and the decision cites its output"], ["decide from the provider's documentation", "no runtime evidence; the decision's confidence drops"]],
    blocks: "S04 and every step after it",
  },
};
function stopDoc(x) {
  const opts = x.options.map(([label, cons], i) => esc(wrap(`- ${label}${i === 0 ? " (recommended)" : ""}: ${cons}`, 68)).replace(/\n/g, "\n  ")).join("\n");
  return doc("hsdd/judgement/STOP.md", "committed with the stopped step", `<span class="h"># Run stopped at ${x.id}</span>

- <span class="k">Segment:</span> ${x.segment}
- <span class="k">Stop class:</span> ${x.cls}
- <span class="k">Step:</span> ${x.id} (${x.kind}, ${x.skill} on ${x.target})

<span class="h">## Question</span>
${esc(wrap(x.question, 70))}

<span class="h">## Options</span>
${opts}

<span class="h">## What it blocks</span>
${esc(wrap(x.blocks, 70))}

<span class="h">## How to resume</span>
Answer in one message, then run /hsdd-auto. The answer opens a new
segment and is recorded as your decision; a continuation of ${x.id}
finishes the step with it.`);
}
function stopDecisionDoc(x) {
  return doc("hsdd/judgement/decisions.jsonl", "the orchestrator's answer, abridged", `{ "id": "DEC-${x.dec}", "step_ref": "${x.id}", "by": "orchestrator",
  "question": "${esc(wrap(x.question, 62)).replace(/\n/g, "\n    ")}",
  "chosen": "${esc(x.options[0][0])}",
  <span class="k">"would_have_asked":</span> true, <span class="k">"stop_class":</span> "${x.cls}", ... }`);
}
function stopsView(s) {
  const x = { ...STOPS[s.stopPick], cls: s.stopPick };
  const hard = x.cls === "external";
  const ends = hard || s.policy === "stop";
  const verdict = hard
    ? `<div class="verdict bad"><b>A hard stop, under either policy.</b><span>A need outside the repository ends the run unless an in-repository alternative exists, such as a project-local dependency instead of a global one. A credential has none.</span></div>`
    : ends
      ? `<div class="verdict warn"><b>The run ends, with a clean tree.</b><span>The step's partial artifacts are committed as a stopped step, with STOP.md in its records commit. Your answer opens a new segment, and a continuation of ${x.id} finishes the work.</span></div>`
      : `<div class="verdict ok"><b>Decided and recorded.</b><span>The orchestrator answers as your stand-in, records the answer with would_have_asked: true and the class ${x.cls}, and resumes the same subagent. Nothing is committed in between, and the report lists the decision first.${x.cls === "breaking-amend" ? " A segment that will meet this class on many contracts can decide it once, as a predecided answer that every later prompt carries." : ""}</span></div>`;
  return `<div class="bar"><span class="label">Stop policy</span>${seg("policy", s.policy, [["stop", "stop"], ["decide-and-record", "decide-and-record"]], "Stop policy")}</div>
    <div class="req-list">${Object.entries(STOPS).map(([id, v]) => `<button class="card" ${act("stopPick", id)} aria-pressed="${s.stopPick === id}"><h3>${v.title}</h3><p>${chip(id === "external" ? "bad" : "warn", id)} ${esc(v.where)}</p></button>`).join("")}</div>
    ${verdict}
    ${ends ? stopDoc(x) : stopDecisionDoc(x)}`;
}

const RUN_LOG = [
  ["28d15d1", "auto: S00 setup: 2026-07-02-plan"], ["f3c7647", "judgement: S00"],
  ["66a8254", "auto: S01 plan: 2026-07-02-plan"], ["0a3e23f", "judgement: S01"],
  ["95938e7", "hsdd: S02 root-spec acme: three teams, three children"], ["008bb05", "judgement: S02"],
  ["eabc196", "hsdd: S03 adr ADR-001: provider X with rotating keys"], ["dac01e3", "judgement: S03"],
  ["3f6878f", "hsdd: S04 contract auth-token: expired tokens return 401"], ["1bad262", "judgement: S04"],
];
const TOP_DECISIONS = [
  ["Decision", "Step", "Question", "Chosen"],
  ["DEC-027", "S07 mid-level-spec", "Does catalog consume merchant-model", "consume it"],
  ["", "", "or keep its own merchant fields?", ""],
  ["DEC-044", "S15 phase-plan", "Split key rotation out of token", "one phase"],
  ["", "", "issuance?", ""],
  ["DEC-001", "S00 setup", "How does \"stop on anything", "policy stop"],
  ["", "", "structural\" apply to this segment?", ""],
];
// A fixed-width markdown table for a doc view: every column padded to its widest cell.
const fixedTable = (rows) => {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => `| ${r.map((cell, i) => esc(cell.padEnd(widths[i]))).join(" | ")} |`).join("\n");
};
const REVIEW_VIEWS = {
  history: () => doc("$ git log --oneline --reverse main..auto/acme", "the run branch", `<span class="c"># each step: its artifacts, then its records (ledger lines, run line, report)</span>
${RUN_LOG.map(([sha, subject]) => `${sha} ${subject.startsWith("judgement") ? `<span class="c">${subject}</span>` : subject}`).join("\n")}
...
993099f auto: S41 report: 2026-07-02-plan
<span class="c">5d8bcc2 judgement: S41</span>

<span class="c"># the contract exactly as DEC-019 left it:</span>
$ git show 3f6878f:hsdd/contract/auth-token.md`),
  report: () => doc("hsdd/auto/report/2026-07-02-plan.md", "read this first (abridged)", `<span class="h"># Segment report: 2026-07-02-plan</span>

<span class="h">## Outcome</span>
The acme tree is planned through reconcile. Every contract is stable
with final phase ids, and the final gate is clean. Nine decisions are
marked would_have_asked; nothing stopped.

<span class="h">## What changed</span>          one row per node: kind, phases, contracts
<span class="h">## Decisions to look at first</span>
${fixedTable(TOP_DECISIONS)}
<span class="h">## Upstream</span>                 decisions that would change a read-only source
<span class="h">## Every decision by blast radius</span>
<span class="h">## Experiments</span> · <span class="h">## Assumptions about the owner's intent</span>
<span class="h">## Record gaps</span> · <span class="h">## Deferred findings</span> · <span class="h">## How to review</span>`),
  review: () => doc("hsdd/judgement/decision-reviews.jsonl", "written by you, never by the run", `{"decision": "DEC-019", "at": "2026-07-03T08:12:40Z", "review": "agree"}
{"decision": "DEC-027", "at": "2026-07-03T08:20:05Z", "review": "disagree",
 "reason": "catalog keeps its own merchant fields until web ships",
 "preferred": "keep its own fields"}
{"decision": "DEC-044", "at": "2026-07-03T08:31:52Z",
 "review": "should-have-asked",
 "reason": "key rotation timing is a security call; ask me"}`),
};
function reviewView(s) {
  const v = s.autoView;
  return `<div class="bar"><span class="label">After the segment</span>${seg("autoView", v, [["history", "Run branch"], ["report", "Report"], ["review", "Your review"]], "Review artifact")}</div>
    ${REVIEW_VIEWS[v]()}
    ${v === "review"
      ? `<div class="verdict neutral"><b>To reverse a decision</b><span>Write the reversal as a short request and route it with /hsdd-auto intake, or run the owning skill yourself. The run never writes this file: your verdicts sit beside the decisions they judge.</span></div>`
      : v === "history"
        ? `<div class="verdict neutral"><b>Before each artifact commit, a gate.</b><span>Nothing outside the step's write set changed, your files match their snapshot, the tree's ids still resolve, and the prose rules hold. A step that fails is reworked by the same subagent, within a limit.</span></div>`
        : `<div class="verdict neutral"><b>Decisions to look at first</b><span>Every answer given on your behalf, then low-confidence decisions and those that change the tree or a read-only source, then the setup decisions.</span></div>`}`;
}

// ---------------------------------------------------------------- chapters

const CHAPTERS = [
  { id: "start", group: "Start", short: "Start here", home: true, steps: [{ title: "Start here" }] },
  {
    id: "why", group: "The idea", short: "Why HSDD", eyebrow: "01 · The problem",
    title: "One spec stops scaling.",
    lede: "Spec-driven development works: write a spec, let an agent build against it, review the result. It works until the spec outgrows what a session can hold.",
    steps: [
      { title: "A single spec fits small systems", visual: sizesView, body: () => `
        <p>Drag the system size. With one spec, every coding session reads the whole thing. For a CLI tool that is fine.</p>
        <p>As the system grows, the spec becomes a monolith. Each session re-reads all of it, token use climbs, and the model's attention spreads across parts that have nothing to do with the task. The person reviewing the output faces the same problem.</p>` },
      { title: "Bound what each session sees", visual: sizesView, body: () => `
        <p>HSDD keeps the per-session load roughly constant. A session gets one ${t("phase", "phase")}, the ${t("contract", "contracts")} that phase consumes or produces, and the decisions that govern it. Nothing else.</p>
        ${key("HSDD bounds the cost of each session. It does not reduce the total: a bigger system still has more phases, and planning has its own overhead.")}` },
      { title: "The spec is the program", visual: compareView, body: () => `
        <p>You would not write a large program as one file. You split it into modules that talk only through interfaces. HSDD applies the same decomposition to the spec.</p>
        <div class="key"><b>The unit of work</b><p>The unit of spec-driven development is not the product. It is the smallest independently verifiable phase with explicit contracts.</p></div>
        <p>Everything above a phase is decomposition. Everything inside one is a single ordinary coding cycle, with OpenSpec or superpowers.</p>` },
      { title: "Three ideas working together", visual: ideasView, body: () => `
        <p>Select each idea. Together they give one invariant that no release moves:</p>
        ${key("One phase drives exactly one coding cycle and ends at one human review gate.")}
        <p>The rest of this guide shows the artifacts and skills that make that invariant cheap to keep.</p>
        ${deeper([spec("§1", "1-what-hsdd-is"), spec("§1.6 vs OpenSpec", "16-hsdd-versus-openspec-dimension-by-dimension")])}` },
    ],
  },
  {
    id: "tree", group: "Build the tree", short: "Decompose", eyebrow: "02 · Decompose",
    title: "Split the spec into a tree, along the lines of ownership.",
    lede: "hsdd-spec turns your inputs into a root spec, then splits any node into children. It recurses until each piece is small enough to plan as phases.",
    steps: [
      { title: "Start at the root, and keep the sources", visual: treeVisual, body: () => `
        <p>The inputs are whatever you already have: a PRD, an RFC, designs, a brain-dump. The root spec lists them in a ${c("## Sources")} section.</p>
        <p>Every ${t("node", "node")} below names the ${t("sources", "sources")} that govern it. Sources trickle down at each split, so a later step reads the original instead of a summary that thinned at every level.</p>
        ${key("The summary indexes the source; it never replaces it.")}` },
      { title: "Ask who builds what", visual: treeVisual, body: () => `
        <p>The first split follows ownership: where different teams, owners, or deploy targets hold different parts of the stack. Toggle the split to see why.</p>
        <p>A feature sliced end to end across three teams has three owners, mixes three toolchains, and cannot be assigned to anyone. The capability does not disappear: one level down it becomes ${c("acme.backend.auth")} and ${c("acme.web.auth")}, joined by a contract.</p>
        ${key("When the inputs do not say who builds what, hsdd-spec asks and stops until you answer. It is the one question decomposition must not guess.")}
        ${deeper([spec("§2.5", "25-the-decomposition-axis-ownership-first")])}` },
      { title: "Recurse until a node is small enough", visual: treeVisual, body: () => `
        <p>Within one owner's territory, split by capability (auth, billing, catalog), not by technology layer (controllers, models).</p>
        <p>A node becomes a ${t("leaf-parent", "leaf-parent")} when both hold:</p>
        <ul><li>one owner or pair can hold its full scope in their head, and</li><li>it splits into phases that each fit one review sitting.</li></ul>
        <p>Otherwise, split again. Depth is a judgment, not a fixed number of levels.</p>
        ${deeper([spec("§2.3", "23-where-recursion-stops")])}` },
      { title: "Leaves become phases", visual: treeVisual, body: () => `
        <p>A leaf-parent's children are ${t("phase", "phases")}. Only phases drive code. Select any node to read its header; every node has the same shape at every level.</p>
        <p>Ids are the dotted path from the root, with phases numbered: ${c("acme.backend.auth.2")}. Every artifact refers to nodes, contracts, and decisions by id, so nothing needs to be copied.</p>` },
      { title: "Small projects stay flat", visual: treeVisual, body: () => `
        <p>HSDD does not force a tree on you. ${c("linkcheck")}, a CLI that reports broken links, is one coherent responsibility, so its root is already a leaf-parent with four phases and one outward contract.</p>
        ${key("Depth and ceremony are costs. Use exactly as many levels and artifacts as the system needs.")}
        ${deeper([guide("Example 1", "example-1-a-simple-project-single-level"), guide("Example 2", "example-2-a-multi-level-system")])}` },
    ],
  },
  {
    id: "contracts", group: "Build the tree", short: "Contracts", eyebrow: "03 · Connect",
    title: "Nodes meet only at contracts.",
    lede: "A contract is a named, versioned interface between nodes. It is the only thing one node may know about another, so it is also the only thing a session needs to know about its neighbors.",
    steps: [
      { title: "Anatomy of a contract", visual: (s) => `<div class="bar"><span class="label">Highlight</span>${seg("part", s.part, [["meta", "Frontmatter"], ["interface", "Interface"], ["versioning", "Versioning"], ["validation", "Validation"]], "Contract part")}</div>${contractDoc(s)}`, body: (s) => `
        <p>${c("hsdd-contract")} writes one file per contract, plus its schema and fixtures. Select a part.</p>
        <div class="verdict neutral"><b>${PARTS[s.part][0]}</b><span>${PARTS[s.part][1]}</span></div>
        ${deeper([spec("§3.1", "31-the-contract-artifact"), spec("§3.4", "34-validation-stable-means-machine-checkable")])}` },
      { title: "Typed edges decide what runs in parallel", visual: lanesView, body: () => `
        <p>Every edge between nodes has a ${t("dependency", "dependency type")}, and the type says whether the consumer can start before the producer ships.</p>
        <p>Change the edge from backend to web. With ${c("contract")} or ${c("event")}, the web team builds against fixtures or the event schema as soon as the contract is stable. With ${c("shared-model")}, it starts once the shared type exists. With ${c("hard")}, it waits for the backend to ship.</p>
        ${key("A graph of mostly contract, event, and shared-model edges parallelizes. Hard edges are the critical path; keep them rare.")}
        ${deeper([spec("§3.2", "32-dependency-types")])}` },
      { title: "Each session sees only its slice", visual: contextView, body: () => `
        <p>Before a phase runs, ${c("/hsdd-phase")} assembles its ${t("context", "phase context")}: the phase itself, the Interface, Guarantees and Validation of its contracts, and the decisions that govern it.</p>
        <p>Toggle the session type to compare with a single spec.</p>
        ${key("Isolation shapes attention: a session is unlikely to wander into a sibling's concern or invent an interface it was never given. It is probabilistic, not enforced.")}
        ${deeper([spec("§3.6", "36-context-isolation-the-payoff")])}` },
      { title: "Decisions that span nodes become ADRs", visual: adrView, body: () => `
        <p>A decision that affects several nodes and outlives any one of them, such as the auth provider, becomes an ${t("adr", "ADR")} file. Phase contexts then receive only its Decision and Consequences.</p>
        <p>A decision that cannot be made yet becomes an ${t("oq", "open question")} with an id. Phases that wait on it are marked contingent. When the question waits on an outside party, the milestone document moves those phases to a contingent tail outside the launch gate.</p>
        ${deeper([spec("§4", "4-adrs-and-open-questions")])}` },
    ],
  },
  {
    id: "phases", group: "Plan and execute", short: "Plan phases", eyebrow: "04 · Plan",
    title: "Plan each leaf as phases a person can review in one sitting.",
    lede: "hsdd-phase-plan turns a leaf-parent into ordered phases. Each phase is one coding cycle that ends at one human review.",
    steps: [
      { title: "The phase plan", visual: planView, body: () => `
        <p>The plan opens with a summary table for humans; the phase sections below it are the detail an agent receives. Select a row to see a phase record.</p>
        <p>Each record names what the phase consumes and produces, a concrete scope, a size estimate, the gate command, what a human should confirm by hand, and a ${t("tier", "review tier")}.</p>
        <p>${c("Collides with")} marks phases that edit the same files. They run one after the other. Only phases with no collision and no dependency between them can run in parallel worktrees.</p>` },
      { title: "Size: one Phase Equivalent", visual: sizingView, body: () => `
        <p>The sizing unit is the ${t("pe", "Phase Equivalent")}: what one reviewer can genuinely review and verify by hand in one sitting, plus the agent run that produced it.</p>
        <p>The ceiling keeps review real. The floor stops ceremony: a phase whose process artifacts would outweigh its diff is a merge candidate.</p>
        ${deeper([spec("§7.2", "72-sizing-the-phase-equivalent")])}` },
      { title: "Review depth follows risk", visual: tiersView, body: () => `
        <p>Each phase gets one tier, chosen by risk rather than size. Select a tier to see which auth phases carry it.</p>
        <p>The tier sets both how much attention the gate gets and how many artifacts the coding cycle writes. Every phase still ends at the gate with a verification doc; only the depth changes.</p>
        ${deeper([spec("§7.3", "73-review-tiers"), guide("Review tiers", "review-tiers")])}` },
      { title: "Plan in parallel against frozen governance", visual: freezeView, body: () => `
        <p>Independent leaf-parents can be planned at the same time, one git worktree each. That makes contracts, ADRs, and ${c("conventions.md")} shared mutable state with several writers.</p>
        <p>HSDD's answer is the functional one. During planning, those files are read-only. Each plan writes the changes it needs into its own file, as data, in a pending section.</p>
        ${key("Every branch writes only its own node's plan file, so the merge is clean by construction.")}` },
      { title: "Reconcile: one writer at the root", visual: freezeView, body: () => `
        <p>After the plan branches merge, ${t("reconcile", "hsdd-reconcile")} drains every pending section, once, at the root. It asks you about each open request, applies the rest, flips contracts to stable (only if their schema or fixtures exist), and regenerates the registries.</p>
        <p>Serial projects run the same step. It takes a minute, and it means the rules never change with the setup.</p>
        ${deeper([spec("§8", "8-governance-freeze-and-reconcile"), guide("Step 7", "step-7-parallel-leaf-parents-worktrees-reconcile")])}` },
    ],
  },
  {
    id: "execute", group: "Plan and execute", short: "Execute a phase", eyebrow: "05 · Execute",
    title: "Switch context, run one cycle, sign the gate.",
    lede: "Before each phase, /hsdd-phase writes a self-contained context. Your usual coding cycle runs on it. The phase is done when its verification doc, signed by a human, is merged to main.",
    steps: [
      { title: "Switch the context", visual: contextDocView, body: () => `
        <p>${c("/hsdd-phase {phase-id}")} writes one method-neutral context file, then wraps it for the project's ${t("method", "coding method")}. Toggle the method to see where it lands.</p>
        <p>The links at the bottom are pinned to the spec commit the context was built from, so a later reader knows exactly what the session saw.</p>
        ${key("Run the switch before every phase. It is the step easiest to forget, which makes its command the one worth always using.")}` },
      { title: "Run the cycle you already use", visual: cycleView, body: () => `
        <p>The coding cycle is unchanged. HSDD only decided what it sees. Test-first discipline, debugging, and code review come from companion skills such as superpowers, wired in by the context.</p>
        <p>The gate runs the phase's command. If the phase produces a contract, the gate also replays it: real output must validate against the schema and reproduce the fixtures.</p>` },
      { title: "The gate: a doc a human signs", visual: gateView, body: () => `
        <p>At apply, the agent writes the ${t("verification", "verification doc")}. A human reviews at the phase's tier and signs.</p>
        <p><b>Outstanding</b> is about this phase's claims: what could not be verified here. <b>${t("learning", "Learnings")}</b> are about the tree: what should flow back up. Try signing before giving each learning a disposition.</p>
        ${deeper([spec("§10", "10-the-gate"), spec("§10.3", "103-learnings-the-feedback-loop-at-the-gate")])}` },
      { title: "When a contract turns out wrong", visual: renegotiateView, body: () => `
        <p>Sometimes a phase discovers mid-way that a consumed contract is wrong or incomplete. The fix goes through the root, where every consumer can see it, never through a quiet workaround in one phase.</p>
        <p>A compatible addition amends the current version. A breaking change drafts the next version with a migration note.</p>
        ${deeper([spec("§10.4", "104-mid-phase-renegotiation-and-boundary-corrections")])}` },
    ],
  },
  {
    id: "adopt", group: "Existing systems", short: "Adopt a codebase", eyebrow: "06 · Brownfield",
    title: "Start from the code you already have.",
    lede: "Most systems exist before their spec does. hsdd-adopt builds a shallow tree from what tooling can see in the code, writes contracts that describe today's behavior, and stops.",
    steps: [
      { title: "Extract seams; do not read the code", visual: seamsView, body: () => `
        <p>The example is ${c("legacy-pay")}, a production payments service with no specs, some tests, and three teams in CODEOWNERS.</p>
        <p>${c("hsdd-adopt")} copies its seam extractor into ${c("hsdd/scripts/seams/")} and runs it. The extractor records the ${t("seams", "seams")}: structure that tooling can see, with ${c("file:line")} where it found each item, stamped with the commit it looked at.</p>
        ${key("Adoption cost scales with the number of seams, never with lines of code.")}` },
      { title: "Confirm the tree before any spec is written", visual: proposedTree, body: () => `
        <p>The skill proposes a shallow tree, one or two levels deep, on the seams that exist rather than the ones anyone wishes existed. Then it stops.</p>
        <p>CODEOWNERS usually answers who builds what, so the mandatory ownership question becomes a confirmation. Each node still gets exactly one owning team.</p>
        <p>Confirm the tree to continue the example.</p>` },
      { title: "As-built specs: intent beside observation", visual: asBuiltView, body: () => `
        <p>One spec file per node, marked ${t("as-built", "as-built")}. The file shows its own honesty boundary: what a human claims, what tooling saw, and what nobody knows yet. Highlight each region.</p>
        ${key("A node with no unknowns is a node nobody looked at.")}
        <p class="caveat">The skill never proposes refactoring the system to fit a nicer tree. The tree fits the system.</p>` },
      { title: "v0 contracts: today's behavior, warts included", visual: v0View, body: () => `
        <p>Each seam between two nodes becomes a contract at ${t("v0", "v0")}: the interface as the system already implements it.</p>
        <p>Because the fixtures come from existing tests or captured payloads, the contract is stable from day one, and code that never had a validation harness now has one. That is the most valuable output of an adoption run.</p>
        ${deeper([spec("§6.3", "63-adopted-contracts-v0-stable-with-a-completeness-caveat")])}` },
      { title: "Prove the tree, and stop", visual: stopView, body: () => `
        <p>The skill regenerates the registries, checks that every contract id resolves, and stops. No phases, and no decomposition below what the first change needs.</p>
        <p>What you review at the stop takes minutes: the tree shape, which mirrors code you know; the ${c("unknown:")} lines; and each contract's ${t("completeness", "observed completeness")}.</p>
        ${deeper([spec("§6", "6-entry-b-brownfield-adoption"), spec("§6.5", "65-why-not-full-depth-reverse-engineering"), guide("Example 3", "example-3-a-brownfield-system-adopt-intake-promote")])}` },
    ],
  },
  {
    id: "change", group: "Existing systems", short: "Route every change", eyebrow: "07 · Steady state",
    title: "A PRD is never a root.",
    lede: "After the first change, every project is brownfield. There is one tree, and it belongs to the system. hsdd-intake routes each change request into it.",
    steps: [
      { title: "One tree, many change requests", visual: oneTreeView, body: () => `
        <p>Treating each PRD as the root of its own tree produces a tree that describes a project instead of the system. When the next PRD arrives, it has to be thrown away.</p>
        <p>In HSDD, a change request is an input that changes the one tree: nodes grafted, phases appended, contracts bumped. The PRD lands in the ${c("Sources")} of every node it governs, and the ${t("intake", "intake record")} is where it stays visible as one unit of work.</p>
        ${key("The tree does not complete. Phases complete.")}` },
      { title: "Route the request", visual: routerView, body: (s) => `
        <p>${c("hsdd-intake")} reads every open intake record first, finds the nodes and contracts the request touches, picks exactly one class, and writes the record before any handoff, so the routing decision is auditable.</p>
        <p>Pick each request to see its record. ${REQUESTS[s.request].cls === "structural" ? "A structural change stops: the tree's shape is a human decision, and the record lists the options." : "The record ends with the exact prompts for the next skills."}</p>
        ${deeper([spec("§11.2", "112-intake-and-routing")])}` },
      { title: "Promote an as-built node on first touch", visual: promoteView, body: () => `
        <p>The payout-scheduling request lands on ${c("legacy-pay.payouts")}, which is still as-built. Before anyone plans phases on it, ${c("hsdd-spec")} promotes it.</p>
        <p>Promotion recurs for the life of the system, one node at a time, always when someone is about to work there. That keeps every authoritative spec in the tree one that a person actually read.</p>
        ${deeper([spec("§6.4", "64-promotion--the-recurring-operation")])}` },
      { title: "Catch collisions at intake", visual: collisionView, body: () => `
        <p>Changes to different subtrees run in parallel using the same worktree and reconcile rules as planning. Changes that touch the same node or contract are caught at intake, before either is planned.</p>
        <p>Toggle the earlier intake's status. While it is open, the payout-hold intake waits on it, and both records say so.</p>
        ${deeper([spec("§11.7", "117-parallel-change-requests")])}` },
      { title: "The mixed tree is normal", visual: mixedView, body: () => `
        <p>Some nodes are promoted, some stay as-built for good, and new ones are grafted under governance from the start. That is the permanent state, not a phase to get through.</p>
        <p>Each checkpoint re-extracts every as-built and promoted node's seams and turns differences into plan steps. Production incidents still bypass the process; HSDD gives the bypass a legal path so the tree does not rot.</p>
        ${deeper([spec("§6.6", "66-the-mixed-tree-is-normal-and-permanent"), spec("§11.8", "118-the-legal-bypass")])}` },
    ],
  },
  {
    id: "manage", group: "Run it", short: "Evidence and milestones", eyebrow: "08 · Run the project",
    title: "Done means a signed verification doc on main.",
    lede: "Planning artifacts say what to build. The management layer says how it is going, computed from evidence once a week.",
    steps: [
      { title: "Two roles", visual: rolesView, body: () => `
        <p>On a small team one person wears both hats. The split matters less than the handoffs between them.</p>
        <p>Developers own execution. Leads own verification of the plan and the weekly management pass.</p>` },
      { title: "One evidence pass, four outputs", visual: checkpointView, body: () => `
        <p>Before the team sync, the lead runs ${t("checkpoint", "hsdd-checkpoint")} over the spec repo and every implementation repo. Each report pins the commits it reviewed, because a review means nothing without knowing what it looked at.</p>
        <p>The execution plan is written for its readers. An agent step can be re-prompted mid-task; the person at Monday's sync has only what the plan gave them.</p>
        ${deeper([guide("The weekly checkpoint", "the-weekly-checkpoint")])}` },
      { title: "Evidence up, work down", visual: loopView, body: () => `
        <p>Read the loop in two directions. Evidence flows up: a phase counts as done only when its verification doc is on main. Work flows back down as named steps, into execution and into the spec tree when review found drift.</p>
        ${key("Management documents cite; they never define. A decision made in a sync lands in a spec, a contract, or an ADR, or it does not exist.")}` },
      { title: "Milestones for stakeholders", visual: milestoneView, body: () => `
        <p>Once every leaf-parent in a campaign is phase-planned, total scope is computable and ${c("hsdd-milestone")} writes the stakeholder document. Each ${t("milestone", "milestone")} is a demo plus a gate.</p>
        <p>Work that waits on an outside party sits in a contingent tail with a pre-agreed fallback, so another team's silence is a plan rather than a slip.</p>
        <p>Optional ${t("reading-aid", "reading aids")} render the plan and the checkpoint as offline HTML pages for reviewers and the weekly sync.</p>
        ${deeper([spec("§12", "12-management-layer"), guide("Running the project", "running-the-project")])}` },
    ],
  },
  {
    id: "begin", group: "Run it", short: "Get started", eyebrow: "09 · Get started",
    title: "Twelve skills, two ways in.",
    lede: "HSDD ships as agent skills for Claude Code, Cursor, Codex and other agents. You talk to your agent; the skills trigger on what you ask for.",
    steps: [
      { title: "The skill map", visual: skillsView, body: () => `
        <p>One skill per artifact with its own lifecycle. Each also has an optional slash command, and the phase switch is the one worth always using: ${c("/hsdd-phase")}.</p>
        <p>Select a skill to see what it does and a prompt that triggers it.</p>` },
      { title: "Your first session", visual: firstSessionView, body: () => `
        <p>Install the skills, then pick where you start. A new system starts at the root with ${c("hsdd-spec")}. An existing codebase starts with ${c("hsdd-adopt")}, and then every change goes through ${c("hsdd-intake")}.</p>
        <p>With the OpenSpec method, run ${c("openspec init")} once at the repo root, the directory that holds ${c("hsdd/")}, then have ${c("hsdd-config")} set up the project's config once. After that, the phase switch runs before every phase.</p>
        ${deeper([["README", "../../README.md"], guide("full walkthrough", "how-hsdd-works")])}` },
      { title: "What it claims, and what it does not", visual: claimsView, body: () => `
        <p>The specification states its claims in one place and qualifies them there. The short version is on the left.</p>
        <p>If you want the reasoning behind a rule, the spec's settled-decisions table records each decision with its provenance: field-tested, pressure-tested, or reasoned-only.</p>
        ${deeper([spec("§16 claims", "16-claims-and-non-goals"), spec("§17 evidence", "17-evidence"), ["methodology spec", SPEC]])}` },
    ],
  },
  {
    id: "auto", group: "Going further", short: "Run unattended", eyebrow: "10 · Unattended",
    title: "Hand the planning chain to an agent, then review it in one sitting.",
    lede: "hsdd-auto runs the planning skills without you at each question: one fresh subagent per skill invocation, every step gated and committed, every decision recorded. It plans; it never implements a phase or passes a review gate.",
    steps: [
      { title: "Who does what", visual: autoLoopView, body: () => `
        <p>Planning is paced by its questions: who builds what, accept this ADR, answer this request. For a tree of nine nodes that is a few hundred questions spread over days, and the sources already imply most of the answers.</p>
        <p>${c("hsdd-auto")} splits a run three ways. The ${t("orchestrator", "orchestrator")} is the session you start it in; each step is a fresh subagent running one skill; scripts do everything that has one right answer. Select each role.</p>
        ${key("The model is used only where judgement is needed. The next step, every prompt, id and timestamp, the gate and the commits come from scripts.")}
        <p class="caveat">On Claude Code, an optional adapter adds permission rules and a hook that keep the run inside the paths you declared. Without it those rules are instructions in every prompt, and the gate still catches every write.</p>
        ${deeper([spec11("§3.4", "34-who-does-what"), spec11("§14 evidence", "14-evidence-informative")])}` },
      { title: "Two modes, one loop", visual: modesView, body: () => `
        <p>Each ${t("segment", "segment")} of a run has one mode. ${c("plan")} plans an empty tree through reconcile. ${c("intake")} routes one change request through ${c("hsdd-intake")} and every handoff its record names.</p>
        <p>A script walks the mode's stages and computes each next step from what is in the repository. A segment on a partly planned tree starts at its first unfinished stage, and an interrupted run resumes from disk.</p>
        <p>The first ${c("/hsdd-auto")} in a project asks its setup questions once, including who builds what, and writes ${c("hsdd/auto/run.yaml")}. Every later run reads that file and asks nothing.</p>
        ${deeper([spec11("§9", "9-modes"), spec11("§5.3", "53-the-first-run-questions")])}` },
      { title: "Every question becomes a decision", visual: decisionView, body: () => `
        <p>Where a skill would have asked you, the run decides and writes the decision to the ${t("ledger", "decision ledger")}, one line per real choice. Highlight each part.</p>
        <p>The ledger is append-only. A correction is a new decision, never an edit, so the record shows what the run believed at every step.</p>
        ${key("A decision you can audit carries the options it rejected, the evidence it used, and the commit it landed in.")}
        ${deeper([spec11("§6.2", "62-the-decision-record")])}` },
      { title: "You choose when it stops", visual: stopsView, body: () => `
        <p>Some questions should still reach you. Each has a stop class, and the ${t("stop-policy", "stop policy")}, chosen per segment, says what happens to it. Pick a stop, then switch the policy.</p>
        <p>Under ${c("stop")}, a class in the stop set ends the run with ${c("STOP.md")}. Under ${c("decide-and-record")}, the run decides it and marks the decision ${t("would-have-asked", "would_have_asked")}. A class you can answer ahead of time becomes a ${t("predecided", "predecided answer")}.</p>
        <p class="caveat">Choices no skill stops for, and fixes that belong in a read-only source, never stop the run. They are decided, recorded, and listed for you.</p>
        ${deeper([spec11("§8.2", "82-stop-classes-and-the-stop-policy"), spec11("§8.4", "84-deciding-in-advance")])}` },
      { title: "Two commits per step, one sitting to review", visual: reviewView, body: () => `
        <p>Each step ends in two commits on the run branch: its artifacts, then its records. A gate checks the step before the first.</p>
        <p>When the segment is done, read its report. Every answer the run gave on your behalf is listed first. Record the ones you disagree with in ${c("decision-reviews.jsonl")}, and route a reversal as a change request.</p>
        ${key("Unattended planning moves your review from each question to one sitting. It does not remove it.")}
        ${deeper([spec11("§10.9", "109-reportmjs"), guide("Unattended runs", "unattended-runs")])}` },
    ],
  },
];

// ---------------------------------------------------------------- views: chapter, table of contents, pager

function chapterView(s) {
  const ch = CHAPTERS[s.ch];
  if (ch.home) return homeView();
  const st = ch.steps[s.step];
  return `<header class="ch-head"><p class="eyebrow">${ch.eyebrow}</p><h1 id="ch-title" tabindex="-1">${ch.title}</h1><p class="lede">${ch.lede}</p></header>
    <div class="scene">
      <article class="explain"><p class="stepno">Step ${s.step + 1} of ${ch.steps.length}</p><h2>${st.title}</h2>${st.body(s)}</article>
      <section class="visual" aria-label="Interactive illustration">${st.visual(s)}</section>
    </div>`;
}

function tocView(s) {
  const names = [...new Set(CHAPTERS.map((ch) => ch.group))];
  const groups = names.map((name) => ({ name, items: CHAPTERS.map((ch, i) => [ch, i]).filter(([ch]) => ch.group === name) }));
  return groups.map((g) => `<div class="toc-group"><p>${g.name}</p><ol>${g.items.map(([ch, i]) => `<li class="${s.visited.includes(i) && i !== s.ch ? "visited" : ""}"><a href="#${ch.id}-1" ${act("goto", ch.id)}${i === s.ch ? ' aria-current="page"' : ""}><span class="num">${i}</span><span>${ch.short}</span></a></li>`).join("")}</ol></div>`).join("")
    + `<div class="toc-foot"><span>Source: <a href="${SPEC}">the specification</a> and <a href="${UG}">the user's guide</a>.</span><span>Examples are illustrations, not a real project.</span></div>`;
}

const position = (s) => {
  const ch = CHAPTERS[s.ch];
  return { last: s.step === ch.steps.length - 1, final: s.ch === CHAPTERS.length - 1 && s.step === ch.steps.length - 1, first: s.ch === 0 && s.step === 0 };
};

function glossaryView(hit) {
  return `<h2 id="sheet-title">Glossary</h2><dl class="gloss">${GLOSSARY.map(([id, term, def]) => `<div id="g-${id}" class="${id === hit ? "hit" : ""}"><dt>${term}</dt><dd>${esc(def)}</dd></div>`).join("")}</dl>
    <p class="hint">The full glossary is the last chapter of <a href="${SPEC}#19-glossary">the specification</a>.</p>`;
}
function faqView() {
  return `<h2 id="sheet-title">Common questions</h2><div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
    <div class="shortcuts"><span><kbd>←</kbd> <kbd>→</kbd> step</span><span><kbd>0</kbd>–<kbd>9</kbd> chapter</span><span><kbd>G</kbd> glossary</span><span><kbd>?</kbd> questions</span><span><kbd>T</kbd> theme</span><span><kbd>Esc</kbd> close</span></div>`;
}

// ---------------------------------------------------------------- shell

const STORE = "hsdd-guide";
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* storage unavailable: keep going */ } };

const initial = (saved) => ({
  ch: 0, step: 0, visited: Array.isArray(saved.visited) ? saved.visited : [0],
  size: 2, idea: 0,
  node: "acme", axis: "ownership", example: "linkcheck",
  part: "validation", edge: "contract", session: "hsdd",
  phase: "acme.backend.auth.2", cand: "", tier: "full-review",
  method: "openspec", learn: { l1: "", l2: "" }, signed: false,
  quiz: "", confirmed: false, moved: false, region: "observed", v0part: "completeness",
  request: "schedule", promoted: false, openSched: true,
  skill: "hsdd-spec", path: "green",
  autoRole: "all", autoMode: "plan", decPart: "choice", stopPick: "promotion", policy: "stop", autoView: "history",
  theme: saved.theme || "system",
});

let state = initial(load());

const $ = (sel) => document.querySelector(sel);
const sheet = $("#sheet");

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
  const btn = $("#theme-toggle");
  btn.textContent = theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐";
  btn.setAttribute("aria-label", `Theme: ${theme === "system" ? "follow system" : theme}. Change theme.`);
}

function parseHash() {
  const m = /^#([a-z]+)-(\d+)$/.exec(location.hash);
  if (!m) return null;
  const ch = CHAPTERS.findIndex((x) => x.id === m[1]);
  if (ch < 0) return null;
  const step = Math.min(Math.max(Number(m[2]) - 1, 0), CHAPTERS[ch].steps.length - 1);
  return { ch, step };
}

// Remember the focused control so a re-render does not drop keyboard focus.
function focusKey() {
  const el = document.activeElement;
  if (!el || !$("#stage").contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset && el.dataset.action) return `[data-action="${el.dataset.action}"][data-value="${CSS.escape(el.dataset.value || "")}"]`;
  return null;
}

function render({ moved = false, scroll = false } = {}) {
  const s = state;
  const ch = CHAPTERS[s.ch];
  const keep = moved ? null : focusKey();
  $("#stage").innerHTML = chapterView(s);
  $("#toc").innerHTML = tocView(s);
  const pos = position(s);
  const next = CHAPTERS[s.ch + 1];
  $("#where").innerHTML = ch.home ? "<b>Start here</b>" : `<b>${s.ch} · ${ch.short}</b> · ${ch.steps[s.step].title}`;
  $("#dots").innerHTML = ch.steps.length > 1 ? ch.steps.map((st, i) => `<button class="dot" ${act("step", i)} aria-label="Step ${i + 1}: ${esc(st.title)}"${i === s.step ? ' aria-current="step"' : ""}></button>`).join("") : "";
  $("#prev").disabled = pos.first;
  $("#next").disabled = pos.final;
  $("#next").textContent = pos.final ? "The end" : pos.last ? `Next: ${next.short} →` : "Next →";
  document.title = ch.home ? "HSDD Guide" : `${ch.short} · HSDD Guide`;
  const hash = `#${ch.id}-${s.step + 1}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
  if (keep) { const el = document.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
  if (moved) {
    $("#announce").textContent = ch.home ? "Start here" : `Chapter ${s.ch}, ${ch.short}. Step ${s.step + 1} of ${ch.steps.length}: ${ch.steps[s.step].title}`;
    if (scroll === "top") { window.scrollTo({ top: 0 }); $("#stage").focus({ preventScroll: true }); }
    else if (scroll === "scene") {
      const scene = document.querySelector(".scene");
      const bar = document.querySelector(".topbar").getBoundingClientRect().bottom;
      if (scene && (scene.getBoundingClientRect().top < bar || scene.getBoundingClientRect().top > innerHeight * 0.6)) {
        window.scrollTo({ top: window.scrollY + scene.getBoundingClientRect().top - bar - 12 });
      }
    }
  }
}

function update(patch) {
  state = { ...state, ...patch };
  render();
}

// Steps that build on earlier choices start from a sensible selection.
const ENTER = {
  "tree-0": { node: "acme" },
  "tree-1": { node: "acme.backend", axis: "ownership" },
  "tree-2": { node: "acme.backend.auth" },
  "tree-3": { node: "acme.backend.auth.2" },
  "tree-4": { node: "linkcheck", example: "linkcheck" },
};

function go(ch, step = 0) {
  const changed = ch !== state.ch;
  const entering = changed || step !== state.step;
  const defaults = entering ? ENTER[`${CHAPTERS[ch].id}-${step}`] || {} : {};
  const visited = state.visited.includes(ch) ? state.visited : [...state.visited, ch];
  state = { ...state, ...defaults, ch, step, visited };
  save({ theme: state.theme, visited });
  closeToc();
  render({ moved: true, scroll: changed ? "top" : "scene" });
}

function advance(dir) {
  const ch = CHAPTERS[state.ch];
  const step = state.step + dir;
  if (step >= 0 && step < ch.steps.length) return go(state.ch, step);
  const nextCh = state.ch + dir;
  if (nextCh < 0 || nextCh >= CHAPTERS.length) return;
  go(nextCh, dir > 0 ? 0 : CHAPTERS[nextCh].steps.length - 1);
}

function openSheet(kind, hit = "") {
  $("#sheet-kind").textContent = kind === "faq" ? "HSDD · Questions" : "HSDD · Terms";
  $("#sheet-body").innerHTML = kind === "faq" ? faqView() : glossaryView(hit);
  if (!sheet.open) sheet.showModal();
  if (hit) { const el = document.getElementById(`g-${hit}`); if (el) el.scrollIntoView({ block: "center" }); }
  else $("#sheet-body").scrollTop = 0;
}

function openToc(open) {
  $("#toc").classList.toggle("open", open);
  $("#contents-toggle").setAttribute("aria-expanded", String(open));
}
const closeToc = () => openToc(false);

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; }
  catch {
    const span = btn.parentElement.querySelector("span");
    const range = document.createRange();
    range.selectNodeContents(span.firstChild || span);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    btn.textContent = "Selected";
  }
  setTimeout(() => { btn.textContent = "Copy"; }, 1600);
}

const ACTIONS = {
  goto: (v) => go(CHAPTERS.findIndex((x) => x.id === v)),
  step: (v) => go(state.ch, Number(v)),
  term: (v) => openSheet("glossary", v),
  idea: (v) => update({ idea: Number(v) }),
  node: (v) => update({ node: v }),
  axis: (v) => update({ axis: v, node: v === "feature" ? "acme.auth" : "acme.backend" }),
  example: (v) => update({ example: v, node: v === "linkcheck" ? "linkcheck" : "acme.backend.auth" }),
  part: (v) => update({ part: v }),
  edge: (v) => update({ edge: v }),
  session: (v) => update({ session: v }),
  phase: (v) => update({ phase: v }),
  cand: (v) => update({ cand: v }),
  tier: (v) => update({ tier: v }),
  method: (v) => update({ method: v }),
  signoff: () => update({ signed: true }),
  quiz: (v) => update({ quiz: v }),
  confirm: (v) => update(v === "move" ? { moved: true } : { confirmed: v === "yes", moved: false }),
  region: (v) => update({ region: v }),
  v0part: (v) => update({ v0part: v }),
  request: (v) => update({ request: v }),
  promoted: (v) => update({ promoted: v === "after" }),
  openSched: (v) => update({ openSched: v === "open" }),
  skill: (v) => update({ skill: v }),
  path: (v) => update({ path: v }),
  autoRole: (v) => update({ autoRole: v }),
  autoMode: (v) => update({ autoMode: v }),
  decPart: (v) => update({ decPart: v }),
  stopPick: (v) => update({ stopPick: v }),
  policy: (v) => update({ policy: v }),
  autoView: (v) => update({ autoView: v }),
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && el.tagName !== "SELECT") {
    const fn = ACTIONS[el.dataset.action];
    if (el.dataset.action === "copy") { e.preventDefault(); copy(el.dataset.value, el); return; }
    if (fn) { e.preventDefault(); if (el.dataset.action === "term" && sheet.open) { openSheet("glossary", el.dataset.value); return; } fn(el.dataset.value); }
    return;
  }
  if ($("#toc").classList.contains("open") && !e.target.closest("#toc") && !e.target.closest("#contents-toggle")) closeToc();
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.matches("select[data-action='learn']")) update({ learn: { ...state.learn, [el.dataset.value]: el.value }, signed: false });
});
document.addEventListener("input", (e) => {
  if (e.target.id === "size-range") update({ size: Number(e.target.value) });
});

document.addEventListener("keydown", (e) => {
  const el = e.target;
  // SVG nodes and table rows act like buttons.
  if ((e.key === "Enter" || e.key === " ") && el.matches && el.matches("g[data-action], tr[data-action]")) {
    e.preventDefault(); ACTIONS[el.dataset.action](el.dataset.value); return;
  }
  if (sheet.open || e.metaKey || e.ctrlKey || e.altKey) return;
  if (el.closest && el.closest("input, select, textarea, [contenteditable]")) return;
  if (e.key === "ArrowRight") { e.preventDefault(); advance(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); advance(-1); }
  else if (/^[0-9]$/.test(e.key) && Number(e.key) < CHAPTERS.length) go(Number(e.key));
  else if (e.key === "g" || e.key === "G") openSheet("glossary");
  else if (e.key === "?") openSheet("faq");
  else if (e.key === "t" || e.key === "T") $("#theme-toggle").click();
  else if (e.key === "Escape") closeToc();
});

$("#prev").addEventListener("click", () => advance(-1));
$("#next").addEventListener("click", () => advance(1));
$("#glossary-open").addEventListener("click", () => openSheet("glossary"));
$("#faq-open").addEventListener("click", () => openSheet("faq"));
$("#sheet-close").addEventListener("click", () => sheet.close());
sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
$("#contents-toggle").addEventListener("click", () => openToc(!$("#toc").classList.contains("open")));
$("#theme-toggle").addEventListener("click", () => {
  const order = ["system", "light", "dark"];
  const theme = order[(order.indexOf(state.theme) + 1) % order.length];
  state = { ...state, theme };
  save({ theme, visited: state.visited });
  applyTheme(theme);
});
window.addEventListener("hashchange", () => {
  const r = parseHash();
  if (r && (r.ch !== state.ch || r.step !== state.step)) go(r.ch, r.step);
});

applyTheme(state.theme);
const start = parseHash();
if (start) go(start.ch, start.step); else render();
