// meeting-rooms walkthrough: the stages from the change request through the
// unattended planning run to the owner's review. Each stage is a value: its
// text for the two modes and a visual, both functions from the state to HTML.
"use strict";
(() => {
const { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say, marker, box, path, svg } = window.WL;
const RUN = window.WALK_RUN;

// ---------- shared facts about the run ----------
const SEGMENT = "2026-10-31-intake-prd-simple-login-v2";
const RECORD = `hsdd/management/${SEGMENT}.md`;
const REPORT = `hsdd/auto/report/${SEGMENT}.md`;
const LEDGER = "hsdd/judgement/decisions.jsonl";
const REVIEWS = "hsdd/judgement/decision-reviews.jsonl";
const PRD2 = "hsdd/context/prd-simple-login.v2.md";
const STEP = Object.fromEntries(RUN.steps.map((s) => [s[0], s]));
const SUBAGENT = (id) => !["S00", "S01", "S22", "S30"].includes(id);

// The records of one step: its dispatch file, its report and its decisions.
function stepFiles(id) {
  const s = STEP[id];
  const out = [fileBtn(`hsdd/auto/dispatch/${id}.md`, `dispatch/${id}.md`)];
  if (SUBAGENT(id)) out.push(fileBtn(`hsdd/auto/steps/${id}.json`, `steps/${id}.json`));
  if (s[5] > 0) out.push(fileBtn(`hsdd/auto/steps/${id}.decisions.jsonl`, `${id}.decisions.jsonl`));
  return out.join(" ");
}
const recordsLine = (ids) => `<p class="files-line">The records: ${ids.map(stepFiles).join(" ")}</p>`;
const stepsTable = (ids, sel, action) => `<div class="table-wrap"><table class="data"><thead><tr><th>Step</th><th>Kind and target</th><th class="num">Decisions</th><th class="num">Min</th></tr></thead><tbody>
  ${ids.map((id) => { const s = STEP[id]; return `<tr class="pick${id === sel ? " sel" : ""}" ${act(action, id)}><td class="mono">${id}${s[4] ? `<br><span class="hint">${esc(s[4])}</span>` : ""}</td><td>${chip(/^Q-/.test(s[4]) ? "decision" : "process", esc(s[1]))}<br><span class="hint">${esc(s[3])}</span></td><td class="num">${s[5]}${s[6] ? `<br>${chip("decision", `${s[6]} asked`)}` : ""}</td><td class="num">${s[7].toFixed(0)}</td></tr>`; }).join("")}
  </tbody></table></div>`;

// ---------- stage 0: the change ----------
const WIREFRAME = ` Home                                     Rooms
+----------------------------------+     +--------------------------------------------+
|  Hello, Budi Santoso             |     |  Rooms on [ 2026-11-05 ]        [ Home ]   |
|                                  |     |                                            |
|  Username      budi              |     |  Merapi · Jakarta · 8 seats                |
|  Email         budi@example.com  |     |    02:00 to 03:00  Sprint planning         |
|  Phone         +62 813 9876 5432 |     |      (09:00 to 10:00 in Jakarta)           |
|  Time zone     Europe/London     |     |  Bromo · Jakarta · 4 seats                 |
|  Member since  9 January 2025    |     |    (no bookings)                           |
|                                  |     |  Thames · London · 10 seats                |
|  My bookings                     |     |    10:00 to 11:00  Design review           |
|  Thu 5 Nov  10:00 to 11:00       |     |  Kew · London · 4 seats                    |
|    Thames · Design review [Cancel]     |    (no bookings)                           |
|                                  |     |                                            |
|  [ Book a room ]  [ Sign out ]   |     |  Book: room [Thames v] start [10:00 v]     |
+----------------------------------+     |        end [11:00 v] title [__________]    |
                                         |        [ Book ]  (message here)            |
                                         +--------------------------------------------+`;
function startView() {
  return `<div class="cols">
      ${panel("done", "The finished project", `<p>simple-login after its phone-number update: nine phases shipped and signed, three contract files (${c("auth-api@v1")}, ${c("profile-api@v1")}, ${c("profile-api@v2")}), one closed intake record and a first checkpoint. ${c("npm test")}: backend 72, replay 10, web 90, runner 3, browser 20.</p>`)}
      ${panel("flow", "One change request", `<p>${fileBtn(PRD2, "prd-simple-login.v2.md")}: stories 4 to 6 (find a free room, book it, see and cancel my bookings), the time zone on Home, PostgreSQL 17 in Docker Compose, and three choices left to engineering. Four minutes to read.</p>`)}
      ${panel("process", "The question", `<p>Can the planning for a change this size run without the owner at every step, and still leave the owner in charge of every choice?</p>`)}
    </div>
    <h3>What PRD v2 draws</h3>
    <pre class="wire">${esc(WIREFRAME)}</pre>
    <p class="hint">PRD v2 Screens, verbatim. Two offices, Jakarta (Asia/Jakarta) and London (Europe/London), four pre-loaded rooms, the same two demo accounts: ayu in Jakarta, budi in London.</p>`;
}

// ---------- stage 1: the run's records ----------
const RECORDS = [
  { id: "run", path: "hsdd/auto/run.yaml", label: "run.yaml", when: "S00",
    holds: "The first run's answers: name, branch, sources with their citation names and versions, read-only and out-of-bounds paths, owner facts, stop policy and stop set, prose rules, commit trailers. One entry per segment carries the owner's instruction verbatim.",
    who: "The orchestrator, from the first run's ten questions; state.mjs open-segment adds the segment.",
    read: "What the run was allowed to read, and what it was told." },
  { id: "plan", path: "hsdd/auto/plan.md", label: "plan.md", when: "S01",
    holds: "The run's table of contents: the segment's paragraph (S01), a step log with one row per step (kind, skill, target, status, artifact commit), and a change log of inserted steps.",
    who: "The orchestrator and the scripts.",
    read: "Start here. The step log tells you which S{n} to open." },
  { id: "dispatch", path: "hsdd/auto/dispatch/S05.md", label: "dispatch/S{n}.md", when: "every step",
    holds: "The exact prompt one step got. Front matter: handoff, write set, template, the commit it was rendered at, every launch (a resume adds one). Then the preamble (inputs, owner facts, decision policy, stop conditions) and Your step: the invocation, facts read from files, items routed to it, predecided answers.",
    who: "dispatch.mjs, before the step starts.",
    read: "What the step was told and what it was allowed to write." },
  { id: "report", path: "hsdd/auto/steps/S05.json", label: "steps/S{n}.json", when: "subagent steps",
    holds: "The step's report: artifacts, experiments, self_check (each of the skill's quality gates, pass or fail, with a note), routed (items for later steps), closes (items it closed), reads_outside, notes.",
    who: "The step's subagent, checked by the gate.",
    read: "What the step did, and what it handed on." },
  { id: "sidecar", path: "hsdd/auto/steps/S05.decisions.jsonl", label: "steps/S{n}.decisions.jsonl", when: "steps that decide",
    holds: "The step's own decisions, one JSON line each.",
    who: "decide.mjs, as each decision is taken.",
    read: "Every choice of one step, without the rest of the run." },
  { id: "ledger", path: LEDGER, label: "judgement/decisions.jsonl", when: "S00 on",
    holds: "Every decision of the run, stamped with its id, step and commit: question, options with consequences, chosen, why, evidence, blast_radius, confidence, would_have_asked, stop_class, would_upstream.",
    who: "decide.mjs mints, ledger.mjs appends and validates.",
    read: "would_have_asked marks a question a skill reserves for a human. The viewer embeds the first 100 KB; each step's sidecar holds the rest." },
  { id: "queue", path: "hsdd/auto/queue.jsonl", label: "auto/queue.jsonl", when: "S02 on",
    holds: "Items one step routes to another: must-address, consider or insert-step, each followed by its events (open, accepted, addressed).",
    who: "routed.mjs.",
    read: "How a finding traveled from the step that saw it to the step that fixed it." },
  { id: "runlog", path: "hsdd/judgement/run.jsonl", label: "judgement/run.jsonl", when: "every step",
    holds: "One line per step: kind, target, started, finished, commit, dispatches, status.",
    who: "ledger.mjs, at the step's commit.",
    read: "Timing, and which steps were resumed." },
  { id: "experiments", path: "hsdd/auto/experiments/time-model-postgres/README.md", label: "auto/experiments/{name}/", when: "when a step needs one",
    holds: "Throwaway probes a step ran to settle a question: a README whose first line is the finding, the probe, and its output.",
    who: "The step's subagent.",
    read: "The evidence a decision cites." },
  { id: "segreport", path: REPORT, label: "auto/report/{segment}.md", when: "S30",
    holds: "One report per segment: outcome, what changed, the handoff table, the decisions to look at first, upstream proposals, experiments, assumptions, record gaps.",
    who: "report.mjs, with prose slots the orchestrator fills.",
    read: "Where the owner's review starts." },
  { id: "reviews", path: REVIEWS, label: "judgement/decision-reviews.jsonl", when: "after the run",
    holds: "The owner's review: one line per decision, agree, disagree or should-have-asked, with a reason and a preferred answer.",
    who: "The owner, by hand.",
    read: "What the owner accepted, and what is still open." },
];
function stepCycle() {
  const inner = `${marker("c1")}
    ${box({ x: 10, y: 20, w: 150, kind: "source", title: "next.mjs", sub: "picks the next step" })}
    ${box({ x: 190, y: 20, w: 170, kind: "root", title: "dispatch.mjs", sub: "dispatch/S{n}.md" })}
    ${box({ x: 390, y: 20, w: 190, kind: "leaf", title: "step subagent", sub: "one skill invocation" })}
    ${box({ x: 610, y: 20, w: 180, kind: "integration", title: "orchestrator", sub: "reviews; may resume" })}
    ${path("M160,45 L186,45", "", "c1")}${path("M360,45 L386,45", "", "c1")}${path("M580,45 L606,45", "", "c1")}
    ${path("M700,70 L700,104", "", "c1")}
    ${box({ x: 560, y: 106, w: 230, kind: "phase", title: "gate.mjs, commit.mjs", sub: "two commits per step" })}
    ${box({ x: 300, y: 106, w: 230, kind: "phase", title: "hsdd: S{n} ...", sub: "the artifacts" })}
    ${box({ x: 40, y: 106, w: 230, kind: "phase", title: "judgement: S{n}", sub: "the records and the ledger" })}
    ${path("M560,131 L534,131", "", "c1")}${path("M300,131 L274,131", "", "c1")}
    <text class="t-edge" x="485" y="88" text-anchor="middle">artifacts, S{n}.json, decisions</text>`;
  return svg("0 0 800 170", "One step of the run, from dispatch to two commits", inner);
}
function recordsView(s) {
  const sel = RECORDS.find((r) => r.id === s.ui.rec) || RECORDS[0];
  return `<div class="records">${RECORDS.map((r) => `<button class="rec" ${act("rec", r.id)} aria-pressed="${r.id === sel.id}"><span>${esc(r.label)}</span><span>${esc(r.when)}</span></button>`).join("")}</div>
    ${panel("flow", esc(sel.label), fields([["Holds", esc(sel.holds)], ["Written by", esc(sel.who)], ["Read it for", esc(sel.read)]]) + `<p class="files-line">Open: ${fileBtn(sel.path)}</p>`)}`;
}

// ---------- stage 2: the intake ----------
const CLASSES = [
  ["local", "fits inside one existing leaf-parent", "hsdd-phase-plan on that node, append mode", "PRD v2 lands on four nodes: rooms and bookings on the backend, the screens on the web, the Success tests on integration, and the root's own text."],
  ["cross-node", "touches several nodes' surfaces", "hsdd-adr and hsdd-contract, then hsdd-spec touches, then hsdd-phase-plan and hsdd-reconcile per node", "This one (DEC-005). The decomposition axis, who builds what, still holds: PRD v2's Team and delivery keeps the same two developers."],
  ["new-capability", "needs a node that does not exist", "hsdd-spec graft mode on the existing parent", "No node is missing: each leaf-parent still has one owner and review-sized phases."],
  ["structural", "the tree's shape is wrong for this change", "a shape stop: under decide-and-record, decided and recorded with would_have_asked", "The shape fits. Nothing here asks to move a boundary."],
];
const HANDOFFS = [
  ["H1", "adr-update", "hsdd-adr", "ADR-001", "S03", "", "/hsdd-adr update ADR-001 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: PRD v2 drops the two-endpoint API and the no-database premise its Context rests on (PRD v2 Constraints, Scope). Decide whether signing in survives a restart of the service ..."],
  ["H2", "adr", "hsdd-adr", "ADR-002", "S04", "", "/hsdd-adr ADR-002, the time model, as hsdd/management/2026-10-31-intake-prd-simple-login-v2.md proposes it: decide how booking times travel on the wire and are stored in PostgreSQL, where the user's IANA time zone comes from (PRD v2 AC-2.5), which node turns ..."],
  ["H3", "contract", "hsdd-contract", "booking-api", "S05", "", "/hsdd-contract draft booking-api@v1 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: the HTTP API behind PRD v2 US-4 to US-6 (every room with its bookings on a date, booking a room, my bookings, cancelling one), owned by simple-login.backend and ..."],
  ["H4", "contract-touch", "hsdd-contract", "auth-api", "S06", "", "/hsdd-contract touch auth-api@v1 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: its token guarantee names booking-api@v1 beside profile-api@v1 and profile-api@v2, and its guarantees follow ADR-001 as updated for this record (a restart, ..."],
  ["H5", "contract-touch", "hsdd-contract", "profile-api.v2", "S07", "", "/hsdd-contract touch profile-api@v2 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: the profile gains the account's time zone as an IANA name, as ADR-002 states it (PRD v2 AC-2.1, AC-2.5; Demo accounts: ayu Asia/Jakarta, budi Europe/London), ..."],
  ["H6", "spec-touch", "hsdd-spec", "simple-login", "S08", "", "/hsdd-spec touch simple-login per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: restate Purpose, Owns, Does not own, the Overview's flows, hard constraints and success criteria, the Isolation strategy's list of contracts the children meet at, and ..."],
  ["H7", "spec-touch", "hsdd-spec", "simple-login.backend", "S09", "", "/hsdd-spec touch simple-login.backend per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Purpose, Owns, Isolation strategy and Overview gain the pre-loaded rooms, bookings ..."],
  ["H8", "spec-touch", "hsdd-spec", "simple-login.web", "S10", "", "/hsdd-spec touch simple-login.web per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Purpose, Owns and Overview gain the Rooms screen, booking a room, my bookings and ..."],
  ["H9", "spec-touch", "hsdd-spec", "simple-login.integration", "S11", "", "/hsdd-spec touch simple-login.integration per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Owns, Isolation strategy and Overview cover running the real service with its ..."],
  ["H10", "citation-touch", "hsdd-spec", "simple-login", "S12", "cites-superseded", "/hsdd-spec citation touch hsdd/spec/simple-login.md: move its citations to the current versions"],
  ["H11", "citation-touch", "hsdd-spec", "simple-login.backend", "S13", "cites-superseded", "/hsdd-spec citation touch hsdd/spec/simple-login.backend.md: move its citations to the current versions"],
  ["H12", "citation-touch", "hsdd-spec", "simple-login.web", "S14", "cites-superseded", "/hsdd-spec citation touch hsdd/spec/simple-login.web.md: move its citations to the current versions"],
  ["H13", "citation-touch", "hsdd-spec", "simple-login.integration", "S15", "cites-superseded", "/hsdd-spec citation touch hsdd/spec/simple-login.integration.md: move its citations to the current versions"],
  ["H14", "phase-plan-append", "hsdd-phase-plan", "simple-login.backend", "S16", "", "/hsdd-phase-plan simple-login.backend per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md"],
  ["H15", "reconcile", "hsdd-reconcile", "simple-login.backend", "S17", "", "/hsdd-reconcile simple-login.backend"],
  ["H16", "phase-plan-append", "hsdd-phase-plan", "simple-login.web", "S18", "", "/hsdd-phase-plan simple-login.web per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md"],
  ["H17", "reconcile", "hsdd-reconcile", "simple-login.web", "S19", "", "/hsdd-reconcile simple-login.web"],
  ["H18", "phase-plan-append", "hsdd-phase-plan", "simple-login.integration", "S20", "", "/hsdd-phase-plan simple-login.integration per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md"],
  ["H19", "reconcile", "hsdd-reconcile", "simple-login.integration", "S21", "", "/hsdd-reconcile simple-login.integration"],
];
const GROUP = (kind) => (/adr/.test(kind) ? "ADRs" : /contract/.test(kind) ? "contracts" : kind === "spec-touch" ? "node text" : kind === "citation-touch" ? "citations" : "append and reconcile");
function intakeView(s) {
  const pick = s.ui.klass || "cross-node";
  const row = CLASSES.find((r) => r[0] === pick);
  const h = HANDOFFS.find((x) => x[0] === s.ui.hand) || HANDOFFS[0];
  return `<div class="bar"><span class="label">Class</span>${seg("klass", pick, CLASSES.map(([k]) => [k, k]))}</div>
    ${panel(pick === "cross-node" ? "done" : "ghost", `${esc(pick)}: ${esc(row[1])}`, fields([["Routes to", esc(row[2])], ["Here?", esc(row[3])]]))}
    <h3>Nineteen handoffs, in the order the run executes them</h3>
    <div class="steps-strip">${HANDOFFS.map((x) => `<button class="in" ${act("hand", x[0])} aria-pressed="${x[0] === h[0]}" title="${esc(x[1])} ${esc(x[3])}">${x[0]}</button>`).join("")}</div>
    ${panel("process", `${esc(h[0])} · ${esc(GROUP(h[1]))}`, fields([
      ["Kind", `${chip("process", esc(h[1]))} ${esc(h[2])}`],
      ["Target", c(h[3])],
      ["Executed as", `${h[4]} ${stepFiles(h[4])}`],
      ...(h[5] ? [["When", `${c(h[5])}: dispatched only if the target still cites PRD 1 or Update 1`]] : []),
      ["Prompt", `<span class="mono" style="font-size:12.5px">${esc(h[6])}</span>`],
    ]))}
    <p class="files-line">The record: ${fileBtn(RECORD)} · its handoffs are the ${c("hsdd-handoffs")} block at the end.</p>`;
}

// ---------- stage 3: the anatomy of a decision ----------
const DEC032 = [
  ["id", "DEC-032", "Minted by decide.mjs when the decision was taken. Never reused, never edited: a correction is a new decision (DEC-150 corrects DEC-149)."],
  ["step_ref, by", "S04, subagent", "Which step took it, and whether the step's subagent or the orchestrator did."],
  ["artifact", "hsdd/adr/002-time-model.md", "The file the decision lands in."],
  ["question", "How are times shown where PRD v2's examples are silent: a time that falls on another date than the one its line is about, and a wall time in the hour London's clocks repeat?", "A skill's own wording when a skill asked; otherwise the step's."],
  ["options", "carry the date; mark the repeated hour with the zone's short name · times only, as PRD v2's examples show them · always show the UTC offset", "At least two, each with its consequence. Here the first reads '23:00 to Fri 6 Nov 02:00' for a Jakarta user, and '01:30 BST' and '01:30 GMT' on October's repeated hour."],
  ["chosen", "carry the date; mark the repeated hour with the zone's short name", "One of the option labels."],
  ["why", "Jakarta and London are 7 or 8 hours apart, so a booking in one office regularly crosses midnight in the other ... A PRD rule limiting bookings to office hours would have made the date mark unnecessary.", "Written for an owner reading cold. It names the signal that would have changed the choice."],
  ["evidence", "PRD v2 AC-4.2, AC-4.3, AC-4.4, AC-5.3, Screens; hsdd/conventions.md; hsdd/auto/experiments/time-model-intl/", "Sources and experiments the choice rests on."],
  ["blast_radius", "tree", "node-local, contract, tree or upstream. Every tree decision is listed in the report's Decisions to look at first."],
  ["confidence", "medium", "high or medium in this run: 166 and 65 of the 231."],
  ["would_have_asked", "false", "True when a skill reserves the question for a human. Under decide-and-record the run answers anyway and says so. Nine in this run."],
  ["stop_class, would_upstream", "null, false", "The stop-set class when would_have_asked is true; whether a source's authors should hear about it."],
  ["commit", "4f17c69...", "The run's own commit that carries the decision (a hash in the run's repository, not this one)."],
];
const ADR2 = [
  ["DEC-025", "Wire format", "UTC instants in toISOString form"], ["DEC-026", "Storage", "timestamptz instants, half-open"],
  ["DEC-027", "The zone's source", "the account, served in the profile"], ["DEC-028", "The converting node", "the web app converts both ways; the backend works in instants only"],
  ["DEC-029", "The clock", "the backend's injected clock, started at the start instant"], ["DEC-030", "The quarter hour", "check the UTC instant"],
  ["DEC-031", "The form on clock-change days", "offer the day's quarter-hour instants"], ["DEC-032", "Display marks", "carry the date; mark the repeated hour with the zone's short name"],
  ["DEC-033", "The room's local times", "on the Rooms screen, when the zone names differ"], ["DEC-034", "Test zones", "required in every node's tests"],
];
function anatomyView(s) {
  const sel = DEC032.find((r) => r[0] === s.ui.field) || DEC032[4];
  return `<div class="anatomy">${DEC032.map((r) => `<button ${act("field", r[0])} aria-pressed="${r[0] === sel[0]}"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></button>`).join("")}</div>
    ${panel("decision", esc(sel[0]), `<p>${esc(sel[2])}</p>`)}
    <p class="files-line">Open the whole line: ${fileBtn("hsdd/auto/steps/S04.decisions.jsonl", "S04.decisions.jsonl")} ${fileBtn("hsdd/adr/002-time-model.md", "ADR-002")}</p>
    <h3>ADR-002, decision by decision</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Decision</th><th>Question</th><th>Chosen</th></tr></thead><tbody>
      ${ADR2.map(([id, q, ch]) => `<tr><td class="mono">${id}</td><td>${esc(q)}</td><td>${esc(ch)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

// ---------- stage 4: the contracts ----------
const ENDPOINTS = [
  ["GET /api/rooms?from={instant}&to={instant}", "every room, each with its bookings that overlap [from, to)", "200"],
  ["GET /api/me/bookings", "the signed-in user's bookings that have not ended", "200"],
  ["POST /api/bookings", "books a room", "201"],
  ["DELETE /api/bookings/{id}", "cancels one of the signed-in user's bookings", "204, no body"],
];
const ERRORS = [["UNAUTHORIZED", 401], ["VALIDATION_FAILED", 400], ["BOOKING_TOO_LONG", 422], ["BOOKING_STARTED", 422], ["BOOKING_TOO_FAR_AHEAD", 422], ["BOOKING_CONFLICT", 409], ["BOOKING_NOT_FOUND", 404], ["BOOKING_NOT_YOURS", 403]];
const TZ = {
  optional: ["The field is optional in the schema, so every old fixture still validates and the shipped web, whose decoder ignores unknown fields, keeps working. Guarantees say every 200 carries it (G4) and that a consumer never substitutes another zone (G5). v2 stays v2 (DEC-065).", "done"],
  required: ["The pre-touch me-ayu and me-budi fixtures fail the schema: v3 and a breaking-amend, which is in the stop set. The experiment checked both forms.", "fail"],
};
function contractsView(s) {
  const tz = s.ui.tz || "optional";
  return `<h3>booking-api@v1, drafted by S05</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Endpoint</th><th>Does</th><th>Success</th></tr></thead><tbody>
      ${ENDPOINTS.map(([e, d, ok]) => `<tr><td class="mono">${esc(e)}</td><td>${esc(d)}</td><td>${esc(ok)}</td></tr>`).join("")}
    </tbody></table></div>
    <p>${ERRORS.map(([code, st]) => chip(st >= 500 ? "fail" : st === 409 ? "decision" : "plain", `${code} ${st}`)).join(" ")}</p>
    <div class="cols">
      ${panel("decision", "DEC-046 · the longest booking", `<p>8 hours. Medium confidence: all-day events would move it. ${chip("decision", "would_have_asked")}</p>`)}
      ${panel("decision", "DEC-047 · how far ahead", `<p>365 days. London's clocks change at most 217 days after any moment, so the integration node can always book a change day through the API. ${chip("decision", "would_have_asked")}</p>`)}
    </div>
    <h3>profile-api@v2 gains the time zone</h3>
    <div class="bar"><span class="label">timeZone is</span>${seg("tz", tz, [["optional", "optional (chosen)"], ["required", "required"]])}</div>
    ${panel(TZ[tz][1], `${c("compatibility: additive-only")}`, `<p>${esc(TZ[tz][0])}</p>`)}
    <p class="files-line">Compare: ${fileBtn("hsdd/contract/booking-api.md")} ${fileBtn("hsdd/contract/profile-api.v2.md")} ${fileBtn("hsdd/contract/auth-api.md")} ${fileBtn("hsdd/auto/experiments/booking-api-fixtures/README.md", "booking-api-fixtures/")} ${fileBtn("hsdd/auto/experiments/profile-api-v2-timezone/README.md", "profile-api-v2-timezone/")}</p>`;
}

// ---------- stage 5: spec touches and citation touches ----------
const TOUCH = {
  S08: { what: "Purpose, Owns, Does not own, the Overview, the Isolation strategy's contract list and the Decisions section restated from PRD v2 (DEC-067 to DEC-077). It also rewrote the Overview's lead, which still said \"nothing is persisted\" and \"exactly two endpoints\".", note: "PRD v2's Success leaves out version 1's \"Home within 3 seconds of Sign in\", so the root no longer carries it (DEC-073, medium), while the shipped integration.1 still asserts it. The omission was the PRD author's; the run noticed and routed the question to the integration plan.", file: "hsdd/spec/simple-login.md" },
  S09: { what: "Purpose, Owns (the time zones, rooms, bookings, PostgreSQL 17 and its Compose service, the four booking paths), the Isolation strategy (a real PostgreSQL in every test that touches bookings) and the Overview, in the node's file and its embedded copy in the root.", note: "Four items meant for H14, the backend's phase plan, were handed to this step: an item on a handoff id also matches any step on that handoff's target (build decision B-10). It closed them explained and carried each text to H14 as a new item (DEC-087).", file: "hsdd/spec/simple-login.backend.md" },
  S10: { what: "Purpose, Owns (Home with the time zone and my bookings, the Rooms screen, the conversion and display of times under ADR-002) and the Overview, which now leaves navigation to the plan's D4. It also rewrote the Isolation strategy, which H8 did not name, because no later handoff writes it (DEC-096).", note: "The web learns about an expired session only when GET /api/me answers 401 (D1), while every booking endpoint can now be the first to see it. Routed to the web's phase plan. Three more items carried to H16.", file: "hsdd/spec/simple-login.web.md" },
  S11: { what: "Owns now runs the real service with its PostgreSQL 17 beside the web app and names PRD v2's three scripted tests; the Isolation strategy requires a real database, a third browser time zone and the real clock.", note: "The shipped rig starts no database, and bookings now persist between test runs, so a second run's 20 attempts could all get 409 unless each run gets a clean database. Routed to the integration plan. Six items carried to H18.", file: "hsdd/spec/simple-login.integration.md" },
  S12: { what: "13 citations of PRD 1 and Update 1 moved to PRD v2, with section names mapped; RFC-001 kept; ten profile-api@v1 citations kept because v1 is still live beside v2.", note: "A child's citation touch may write only the child's own file, but the root embeds a copy of each child's header. The root's touch moved those copies itself and routed the mapping to H11 to H13 (DEC-116).", file: "hsdd/spec/simple-login.md" },
  S13: { what: "One Sources line moved, matching the root's copy; twelve citations kept (shipped phases, a dated append paragraph, live profile-api@v1).", note: "", file: "hsdd/spec/simple-login.backend.md" },
  S14: { what: "The Sources line and D3's two criterion citations moved (D{n} are live node decisions, unlike shipped phases); 21 kept as history and 3 as live v1.", note: "Review routed one citation nit to the web node: the Overview cites PRD v2 Screens for three screens, but Screens draws only Home and Rooms (DEC-128). S29 fixes it.", file: "hsdd/spec/simple-login.web.md" },
  S15: { what: "One Sources line moved; 17 citations kept as history in the two shipped phases.", note: "The Overview cites ADR-001 while ADR-001 does not govern the node; review left it (DEC-135, medium). The checkpoint raises it again as F-19.", file: "hsdd/spec/simple-login.integration.md" },
};
function touchesView(s) {
  const ids = ["S08", "S09", "S10", "S11", "S12", "S13", "S14", "S15"];
  const sel = ids.includes(s.ui.touch) ? s.ui.touch : "S09";
  const t = TOUCH[sel];
  return `${stepsTable(ids, sel, "touch")}
    ${panel(STEP[sel][1] === "citation-touch" ? "impl" : "process", `${sel} · ${esc(STEP[sel][1])} ${esc(STEP[sel][3])}`, `<p>${esc(t.what)}</p>${t.note ? `<p class="hint">${esc(t.note)}</p>` : ""}<p class="files-line">${fileBtn(t.file)} ${stepFiles(sel)}</p>`)}`;
}

// ---------- stage 6: append and reconcile ----------
const APPENDED = {
  backend: { step: "S16", rec: "S17", rows: [
    ["simple-login.backend.4", "Time zones, booking types, PostgreSQL and the booking replay rig", "gate-only", "~14 files (~400 lines), ≤7 tasks"],
    ["simple-login.backend.5", "Booking rules (pure core)", "spot-check", "~4 files (~350 lines), ≤6 tasks"],
    ["simple-login.backend.6", "The booking store on PostgreSQL", "full-review", "~3 files (~330 lines), ≤6 tasks"],
    ["simple-login.backend.7", "Booking endpoints, the service on its database (booking-api@v1)", "full-review", "~9 files (~400 lines), ≤7 tasks"],
  ], note: "Interfaces first. Phases 5 and 6 can run in parallel. The reconcile (S17) confirms booking-api@v1's producer as backend.7, replacing S05's guess of backend.4, and applies the U+0000 title amend in place on the draft contract (DEC-154)." },
  web: { step: "S18", rec: "S19", rows: [
    ["simple-login.web.5", "Booking API client, the time zone in the profile, the test rig", "spot-check", "~8 files (~400 lines), ≤7 tasks"],
    ["simple-login.web.6", "Time functions (pure core)", "full-review", "~2 files (~340 lines), ≤6 tasks"],
    ["simple-login.web.7", "Home: time zone, my bookings and Cancel", "full-review", "~8 files (~385 lines), ≤7 tasks"],
    ["simple-login.web.8", "Rooms on a date, moving between screens", "full-review", "~8 files (~400 lines), ≤7 tasks"],
    ["simple-login.web.9", "Booking form", "full-review", "~5 files (~360 lines), ≤7 tasks"],
  ], note: "D1 and D4 revised in place with dated markers; D6 to D11 new. The experiment found that the 80-character title fixture is 80 code points but 81 UTF-16 units, which a naive maxLength would refuse." },
  integration: { step: "S20", rec: "S21", rows: [
    ["simple-login.integration.3", "PostgreSQL rig, booking replay and the Success tests", "full-review", "~8 files (~340 lines), ≤7 tasks"],
    ["simple-login.integration.4", "Home in the browser: time zone, my bookings, cancelling", "spot-check", "~4 files (~250 lines), ≤6 tasks"],
    ["simple-login.integration.5", "Rooms and booking in the browser, clock-change days included", "full-review", "~2 files (~300 lines), ≤7 tasks"],
  ], note: "integration.4 removes the shipped 3-second check, following PRD v2 (DEC-195, flagged for the owner). The reconcile (S21) makes booking-api@v1's consumers final, so it flips from draft to stable: any breaking change now needs v2." },
};
const LOCK = [
  ["lock", "per-room advisory lock", "done", "Lock, read the earliest overlap, insert. 60 of 60 rounds of 20 simultaneous attempts gave exactly one 201 and nineteen 409s naming it; the slowest round took 71 ms; no deadlock. Chosen as D7 (DEC-149)."],
  ["constraint", "exclusion constraint alone", "decision", "Correct in the end, but some rounds settled only through 40P01 deadlocks, up to 19 s a round."],
  ["retry", "re-read and retry", "fail", "What S05 had suggested. It livelocked: 219 deadlocks, and 18 attempts gave up after ten retries."],
];
function plansView(s) {
  const node = APPENDED[s.ui.pnode] ? s.ui.pnode : "backend";
  const a = APPENDED[node];
  const lk = LOCK.find((x) => x[0] === s.ui.lock) || LOCK[0];
  return `<div class="bar"><span class="label">Node</span>${seg("pnode", node, [["backend", "backend (S16, S17)"], ["web", "web (S18, S19)"], ["integration", "integration (S20, S21)"]])}</div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Phase</th><th>Name</th><th>Tier</th><th>Size</th></tr></thead><tbody>
      ${a.rows.map(([id, name, tier, size]) => `<tr><td class="mono">${esc(id.replace("simple-login.", ""))}</td><td>${esc(name)}</td><td>${tierChip(tier)}</td><td class="hint">${esc(size)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="hint">${esc(a.note)}</p>
    <p class="files-line">${fileBtn(`hsdd/spec/simple-login.${node}.md`)} ${stepFiles(a.step)} ${stepFiles(a.rec)}</p>
    <h3>D7: one booking wins, tried three ways on a real PostgreSQL 17</h3>
    <div class="bar">${seg("lock", lk[0], LOCK.map((x) => [x[0], x[1]]))}</div>
    ${panel(lk[2], esc(lk[1]), `<p>${esc(lk[3])}</p>`)}
    <p class="files-line">${fileBtn("hsdd/auto/experiments/booking-store-postgres/README.md", "booking-store-postgres/README.md")}</p>`;
}

// ---------- stage 7: the consistency stage ----------
const CONS = {
  S22: { text: "A plan step. All nineteen handoffs had run and seven consider items were still open. S22 routed the three on run (stale Purpose cells in the root's child table; the web Overview's citation) to the nodes whose text they are (DEC-203).", files: [] },
  S23: { text: "A spec touch on the backend for three items from the integration plan about starting the service on an empty database. No header change, but it routed an insert-step: rewrite the unshipped backend.7 so its own gate proves the start-on-an-empty-database promise (DEC-205). It also reported, and left unchanged, a false sentence in its own target (\"the service itself opens no port\"): the orchestrator resumed it once with the finding (DEC-207), and the rework corrected the clause (DEC-208).", files: ["hsdd/auto/steps/S23.r1.json"] },
  S24: { text: "Inserted for Q-084 (DEC-209). backend.7 rewritten in place: start takes the database URL and applies the schema before it listens; its test starts the service on an empty database, books Merapi, starts again and finds the booking while the old token gets 401. Its invocation was the template's default \"Append phases to ...\", so the step had to read its queue item to learn what to do (DEC-210).", files: [] },
  S25: { text: "Inserted for Q-085. The rewrite emitted no pending entry, so the orchestrator tried to reject this reconcile (DEC-215); routed.mjs refused, because an accepted insert-step cannot be withdrawn, and the step ran with nothing to drain (DEC-216).", files: [] },
  S26: { text: "A spec touch on integration. integration.3's Scope still offered a \"separate command\" fallback and said the service creates the four rooms in the database, which the contract contradicts (rooms are data in the service). That text sits in the Phase Plan, which a spec touch may not edit, so it routed an insert-step; accepted without a reconcile (DEC-222).", files: [] },
  S27: { text: "Inserted for Q-086: one Scope sentence of integration.3 rewritten. The same default invocation as S24, and a second planner-isolation slip: it checked the rooms claim against the backend's D3 (DEC-226).", files: [] },
  S28: { text: "The root's child table: two stale Purpose cells now copy the embedded summaries verbatim. Each child's Purpose lives in three places (child file, embedded summary, child table), which is how it went stale.", files: [] },
  S29: { text: "The web: one citation now reads (PRD v2 US-1, Screens), closing S14's nit.", files: [] },
};
function consView(s) {
  const ids = Object.keys(CONS);
  const sel = ids.includes(s.ui.cons) ? s.ui.cons : "S23";
  const st = STEP[sel];
  const ins = /^Q-/.test(st[4]);
  return `<div class="steps-strip">${ids.map((id) => `<button class="in${/^Q-/.test(STEP[id][4]) ? " ins" : ""}" ${act("cons", id)} aria-pressed="${id === sel}">${id}${/^Q-/.test(STEP[id][4]) ? " inserted" : ""}</button>`).join("")}</div>
    ${panel(ins ? "decision" : "process", `${sel} · ${esc(st[1])} ${esc(st[3])}${ins ? ` · ${esc(st[4])}` : ""}`, `<p>${esc(CONS[sel].text)}</p><p class="files-line">${stepFiles(sel)} ${CONS[sel].files.map((f) => fileBtn(f, f.replace("hsdd/auto/", ""))).join(" ")}</p>`)}
    <h3>How a step gets inserted</h3>
    ${list([
      `A step's report routes an ${c("insert-step")} item; ${c("routed.mjs")} writes it to the queue as ${c("open")}.`,
      `The orchestrator decides: here DEC-209 accepted Q-084 and Q-085, DEC-222 accepted Q-086. The queue gains an ${c("accepted")} event.`,
      `The decision lands in ${c("hsdd/auto/plan.md")}'s change log, and ${c("next.mjs")} dispatches the inserted step before the stage moves on.`,
    ])}
    <p class="files-line">Follow it: ${fileBtn("hsdd/auto/queue.jsonl")} ${fileBtn("hsdd/auto/plan.md")}</p>`;
}

// ---------- stage 8: the report ----------
function reportView(s) {
  const ids = RUN.steps.map((x) => x[0]);
  const sel = ids.includes(s.ui.dstep) ? s.ui.dstep : "S18";
  const max = Math.max(...RUN.steps.map((x) => x[5]));
  const st = STEP[sel];
  return `<div class="stat-row">${[["31", "steps, S00 to S30"], ["27", "by subagents"], ["231", "decisions"], ["9", "would_have_asked"], ["12", "experiments"], ["0", "stops"]].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <h3>Decisions per step</h3>
    <div class="dbars">${RUN.steps.map((x) => `<button ${act("dstep", x[0])} aria-pressed="${x[0] === sel}" style="height:${Math.max(2, (x[5] / max) * 100)}%" title="${x[0]}: ${x[5]} decisions, ${x[6]} would_have_asked">${x[6] ? `<i style="height:${(x[6] / Math.max(1, x[5])) * 100}%"></i>` : ""}</button>`).join("")}</div>
    <div class="dbars-axis"><span>S00</span><span>S10</span><span>S20</span><span>S30</span></div>
    <div class="legend"><span><i style="background:color-mix(in srgb, var(--process) 45%, var(--card))"></i>decisions</span><span><i style="background:var(--decision)"></i>would_have_asked</span></div>
    ${panel("flow", `${sel} · ${esc(st[1])} ${esc(st[3])}`, `<p>${esc(st[8])}</p><p class="hint">${st[5]} decisions, ${st[6]} would_have_asked, ${st[7].toFixed(1)} minutes${SUBAGENT(sel) ? "" : ", by the orchestrator"}.</p><p class="files-line">${stepFiles(sel)}</p>`)}
    <p class="files-line">The report: ${fileBtn(REPORT)}</p>`;
}

// ---------- stage 9: the review ----------
function reviewView(s) {
  const filter = s.ui.revf || "all";
  const rows = RUN.reviews.filter((r) => filter === "all" || (filter === "asked" ? r[3] : !r[3]));
  const sel = RUN.reviews.find((r) => r[0] === (s.ui.rev || "DEC-032")) || RUN.reviews[0];
  const agree = RUN.reviews.filter((r) => r[7] === "agree").length;
  return `<div class="stat-row">${[[String(RUN.reviews.length), "review lines"], [String(agree), "agree"], [String(RUN.reviews.length - agree), "disagree"], ["0", "should-have-asked"]].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <div class="bar"><span class="label">Show</span>${seg("revf", filter, [["all", "all 33"], ["asked", "would_have_asked (9)"], ["tree", "blast radius tree (24)"]])}</div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Decision</th><th>Chosen</th><th>Review</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="pick${r[0] === sel[0] ? " sel" : ""}" ${act("rev", r[0])}><td class="mono">${r[0]}<br><span class="hint">${r[1]} ${esc(r[2])}</span></td><td>${esc(r[6])}</td><td>${r[7] === "agree" ? chip("done", "agree") : chip("fail", "disagree")}${r[3] ? `<br>${chip("decision", "asked")}` : ""}</td></tr>`).join("")}
    </tbody></table></div>
    ${panel(sel[7] === "agree" ? "done" : "fail", `${sel[0]} · ${sel[1]}`, fields([
      ["Question", esc(sel[5])], ["Chosen", esc(sel[6])], ["Confidence", esc(sel[4])],
      ["Review", `${esc(sel[7])}${sel[8] ? `: ${esc(sel[8])}` : ""}`],
    ]) + `<p class="files-line">${fileBtn(`hsdd/auto/steps/${sel[1]}.decisions.jsonl`, `${sel[1]}.decisions.jsonl`)} ${fileBtn(REVIEWS)}</p>`)}`;
}

// ---------- the stages ----------
const STAGES = [
  {
    id: "start", group: "Start", title: "A finished project gets a product-sized change", short: "PRD version 2",
    lede: "simple-login is done twice over: built from a PRD, then given a phone number. Product now approves version 2 of the PRD: meeting-room booking for the Jakarta and London offices, with PostgreSQL in Docker. This walkthrough follows it from one unattended planning run to twelve built phases and a closed intake record.",
    loop: [],
    present: () => `
      <p>Every artifact here comes from an actual run on 31 October and 1 November 2026, recorded as it happened. The right-hand panel shows what changed in the repository since the template; open any file, and use <b>Diff vs template</b> to see the change itself.</p>
      ${key("hsdd-auto plans; the owner reviews afterwards. The planning chain runs unattended, one fresh subagent per skill invocation. Every question a skill would have asked the owner becomes a recorded decision, and the owner reads the ledger in one sitting.")}
      ${say([
        "Start from the end of the second tutorial. The project is finished and signed; nothing about it is special.",
        "This change is the opposite of one field: a new contract, a new ADR, a database, a third screen, and two offices whose clocks disagree.",
        "Watch two things: how the run's records let you audit 231 decisions you did not take, and what happens to the one the review rejects.",
      ])}
      ${proxy("Every HSDD stop meant for a human (the first run's questions, the review of the run's decisions, twelve sign-offs) was taken by Claude acting for the owner, by the owner's choice before the run. Each is marked in the process log, which lists them all.")}
      <p class="files-line">Input: ${fileBtn(PRD2)}</p>`,
    self: () => `
      <p>You will take the same PRD through the same run in your own copy of the finished project, and compare each result with the recorded one.</p>
      ${checks("start", [
        "Install the HSDD v0.11.0 skills (project-locally under .claude/skills is fine) and the superpowers plugin.",
        "Install Node.js 24 and Docker with Compose. On macOS: Colima, then colima start.",
        "Copy template/ into an empty git repository and commit it. It is simple-login after update 1, plus one new file: hsdd/context/prd-simple-login.v2.md.",
        "Run npm run install:all and npm test once: backend 72, replay 10, web 90, runner 3, browser 20, all green before anything changes.",
        "Read PRD v2 (four minutes). Note the three choices it leaves to engineering.",
      ])}
      <p class="hint">If you have not done the update tutorial, skim it first: this one assumes you know an intake record, a contract version and a reconcile.</p>`,
    visual: () => `<h3>The change</h3>${startView()}`,
  },
  {
    id: "setup", group: "Plan, unattended", title: "Configure the run and start it", short: "/hsdd-auto intake · S00 · S01", skill: "hsdd-auto",
    lede: "The first run's ten questions are hsdd-auto's only interactive moment. Their answers become hsdd/auto/run.yaml; from then on the run asks nothing, and every answer is a recorded decision.",
    loop: ["setup"],
    present: () => `
      ${list([
        `The ten answers, all as owner proxy: run ${c("meeting-rooms")} on branch ${c("auto/meeting-rooms")}; who builds what (PRD v2's two developers, the backend one owning the database); PRD v1, update 1 and RFC-001 as sources; ${c("hsdd/context/")} read-only; agent memory and the HSDD repository out of bounds; Node 24, PostgreSQL 17 in Compose, nothing global; policy ${c("decide-and-record")} with the full stop set; the owner's prose rules at level error.`,
        `The instruction: ${c("/hsdd-auto intake hsdd/context/prd-simple-login.v2.md --authority approved-prd")}, plus one sentence: v2 supersedes v1 and update 1, take it in end to end, decide and record every question.`,
        "S00 setup copied the scripts to hsdd/scripts/auto/, installed the adapter (deny rules, a Bash hook, the hsdd-auto-step agent type) and recorded four decisions: the sources (DEC-001), the instruction's reading (DEC-002), host enforcement (DEC-003), two harness deviations (DEC-004).",
        "S01 wrote the segment's paragraph in hsdd/auto/plan.md, naming the decisions it expects: class and landing, persistence, the contract changes, PRD v2's open limits, web navigation.",
      ])}
      ${key("Learn the records once, here. Every later stage reads the same files: plan.md for the step, dispatch/S{n}.md for what the step was told, steps/S{n}.json for what it did, its decisions sidecar for what it chose.")}
      ${say(["Click through the records in the panel. The step diagram above them is the whole engine: the scripts do every part that has one right answer, the orchestrator keeps the judgement."])}
      ${proxy("The run happened in a standalone repository so the write sets match hsdd/ at the root; its history was imported afterwards. The orchestrating session sat outside it, so each dispatch carries one extra line telling the step to read its skill by path (DEC-004).")}`,
    self: () => `
      ${prompt("/hsdd-auto intake hsdd/context/prd-simple-login.v2.md --authority approved-prd\nVersion 2 of the PRD supersedes version 1 together with update 1; take it in end to end, through every handoff the intake record names. Decide and record every question; I review the decisions afterwards in one sitting.")}
      <p>Answer the ten questions in one batch. To match the recorded run, take the answers from ${fileBtn("hsdd/auto/run.yaml")}.</p>
      ${checks("setup", [
        "hsdd/auto/run.yaml holds your answers and one segment with your instruction verbatim.",
        "git log --oneline auto/meeting-rooms shows two commits per step: auto: S00 setup ... then judgement: S00.",
        "hsdd/scripts/auto/ exists, with a VERSION that matches the skill's.",
        "hsdd/auto/plan.md has the segment's paragraph and a step log; hsdd/judgement/decisions.jsonl has DEC-001 to DEC-004.",
        "/hsdd-auto status shows where the run is at any time; it changes nothing.",
      ])}
      <p class="hint">Start Claude Code inside your repository and neither harness deviation applies. For the strongest memory isolation, start that session with CLAUDE_CONFIG_DIR set to a directory used only for the run.</p>`,
    visual: (s) => `<h3>One step, two commits</h3>${stepCycle()}<h3>The run's records</h3>${recordsView(s)}`,
  },
  {
    id: "intake", group: "Plan, unattended", title: "S02: route the request into the tree", short: "hsdd-intake · 19 handoffs", skill: "hsdd-intake",
    lede: "The first subagent step. hsdd-intake classifies PRD v2, decides which skill does what, and writes nineteen handoff prompts in one producer-first order. The run executes exactly that order.",
    loop: ["intake"],
    present: () => `
      ${list([
        `Class <b>cross-node</b> (DEC-005): the axis, who builds what, still holds. Rooms, bookings and PostgreSQL land on the backend, the screens on the web, the Success tests on integration.`,
        `Contracts: a new ${c("booking-api@v1")} for rooms and bookings together (DEC-006); ${c("profile-api@v2")} touched for the time zone under its own additive-only rule (DEC-007); ${c("auth-api@v1")} touched to name the new API.`,
        "ADRs: ADR-001 updated, amended or superseded depending on where sessions live (DEC-008); a new ADR-002 for the time model, which spans three nodes and two contracts (DEC-009); no persistence ADR, since PostgreSQL is a PRD constraint (DEC-010).",
        "RFC-001's version-1 statements (in memory, two endpoints, no database, no router) are resolved locally and flagged for its authors: DEC-013, the run's first would_have_asked.",
        "Routed: a must-address to H1 (three contracts lack governed_by: [ADR-001]) and three consider items pointing at the open execution plan's repairs.",
      ])}
      ${wrong(["The step's own experiment showed that cites-superseded treats a baseline version as a bare token: with version \"1\", any file with a standalone 1 (\"minLength\": 1) cites a superseded version. The record limited its touches to the four specs that really cite the old paths. Fixed after the run in v0.11.0 (R-1): a baseline version matches only with its citation name."])}
      ${say(["Click through the handoffs: ADRs before the contracts they govern, contracts before the node texts, each node's text before its citations, then an append and a reconcile per node, producer first.", "Open the dispatch file for S02: the step got the request, the facts the scripts read, and nothing else."])}`,
    self: () => `
      <p>Nothing to type: the run moves on by itself. These are the records to read once S02 is committed.</p>
      ${checks("intake", [
        `The intake record has Class, Lands on and Contracts, a Routing section, and an hsdd-handoffs block with one entry per handoff.`,
        "steps/S02.json lists its routed items; hsdd/auto/queue.jsonl opens them (Q-001 to Q-004 in ours).",
        "S02.decisions.jsonl holds the step's decisions (13 in ours); exactly one carries would_have_asked: true.",
        "reads_outside in S02.json lists every read beyond the step's inputs, each with a reason. Ours had 21, all inside the repository.",
      ])}
      ${recordsLine(["S02"])}
      <p class="hint">With the released v0.11.0, cites-superseded matches a baseline only by its citation name (PRD 1, Update 1), so the bare-1 false positives the recorded experiment found do not occur (R-1).</p>`,
    visual: (s) => `<h3>Where the change lands, and in what order</h3>${intakeView(s)}`,
  },
  {
    id: "adrs", group: "Plan, unattended", title: "S03 and S04: the decisions behind the change", short: "ADR-001 amended · ADR-002 new", skill: "hsdd-adr",
    lede: "Two ADR steps settle what three nodes and two contracts will rest on: whether signing in survives a restart, and how time works across two offices whose clocks disagree.",
    loop: ["adr"],
    present: () => `
      ${list([
        "S03 amended ADR-001 rather than superseding it (DEC-018): sessions stay in memory, so a restart still signs everyone out, while bookings in PostgreSQL survive it. Sign-out stays client-side (DEC-019). affects gains booking-api@v1 and, absorbing the open plan's repair C-2, simple-login (DEC-022).",
        "S04 wrote ADR-002, the time model, as accepted under DEC-037: the second would_have_asked, since hsdd-adr never writes invented content as accepted and the owner's review is the acceptance.",
        "ADR-002's core: UTC instants on the wire, timestamptz and half-open intervals in PostgreSQL, the account's IANA zone served in the profile, the web app converting both ways (DEC-028, the choice most open to review), the backend's injected clock deciding \"started\".",
        "Two experiments in the records: Node 24's Intl on London's 23-hour and 25-hour days, and a throwaway postgres:17-alpine container showing timestamptz keeps the instant and an exclusion constraint refuses an overlap with SQLSTATE 23P01.",
      ])}
      ${key("A decision is a record, not a sentence in a transcript. Each one names its question, its options with their consequences, what was chosen and why, the evidence, how far it reaches and how sure the step was.")}
      ${say(["Walk the anatomy panel with DEC-032. Remember it: the review rejects it, and the checkpoint finds it shipped anyway."])}`,
    self: () => `
      <p>Still nothing to type. Read the two steps' records.</p>
      ${checks("adrs", [
        "ADR-001 has an amendment and its affects lists booking-api@v1; the three contracts carry governed_by: [ADR-001] (the must-address from S02, closed in S03.json's closes).",
        "ADR-002 is accepted and its Context cites the decision that allowed it (DEC-037 in ours).",
        "grep -c '\"would_have_asked\":true' hsdd/judgement/decisions.jsonl prints 2 after S04 (DEC-013, DEC-037).",
        "Each experiment's README starts with its finding in one line.",
      ])}
      ${recordsLine(["S03", "S04"])}
      <p class="files-line">Experiments: ${fileBtn("hsdd/auto/experiments/time-model-intl/README.md", "time-model-intl/")} ${fileBtn("hsdd/auto/experiments/time-model-postgres/README.md", "time-model-postgres/")}</p>`,
    visual: (s) => `<h3>The anatomy of a decision: DEC-032</h3>${anatomyView(s)}`,
  },
  {
    id: "contracts", group: "Plan, unattended", title: "S05 to S07: the contracts", short: "booking-api@v1 · two touches", skill: "hsdd-contract",
    lede: "A new contract for rooms and bookings, and two touches that keep their versions: auth-api@v1 names the new API, and profile-api@v2 gains the time zone.",
    loop: ["contract"],
    present: () => `
      ${list([
        "S05 drafted booking-api@v1 (versioned, governed by ADR-001 and ADR-002): four endpoints, one flat booking shape, eight error codes in a fixed check order, eighteen guarantees and 35 fixtures that each carry the backend's clock and the bookings given before it, so the producer can replay them exactly.",
        "PRD v2's two open limits, both would_have_asked: the longest booking is 8 hours (DEC-046), and a booking may start at most 365 days ahead (DEC-047).",
        "S06 kept auth-api@v1 stable: G2 names booking-api@v1, and two new guarantees state shipped behavior that was only in ADR-001 (a restart ends every token; sign-out is client-side).",
        "S07 added an optional timeZone to profile-api@v2, which stays v2. The cost lands on the producer: the new me-ayu and me-budi fixtures fail the shipped backend's exact replay until a backend phase serves the field, so main goes red between the contract and that phase, as in the previous tutorial.",
      ])}
      ${wrong(["One hsdd-contract quality gate contains an em dash, and the step wrote it as <U+2014 EM DASH> in its self_check instead of copying it, although the gate exempts step reports from the prose rules. Verbatim quotes and prose rules collide; S18 meets it again."])}
      ${say(["Toggle timeZone to required: the same field becomes a v3 and a breaking-amend, which is in the stop set. The schema's openness decides the price, as in the update tutorial."])}`,
    self: () => `
      <p>Read the three steps' records and the contract files.</p>
      ${checks("contracts", [
        "booking-api.md is status: draft and phase_ids: provisional at this point; schema/booking-api.schema.json and the fixtures validate (the experiment checks all 35).",
        "S05.decisions.jsonl has two would_have_asked decisions: the two limits PRD v2 left open.",
        "profile-api.v2.md is still v2; the old fixtures validate against the new schema.",
        "auth-api.md is still v1, with consumers naming the shipped web phases (the open plan's repair C-3).",
      ])}
      ${recordsLine(["S05", "S06", "S07"])}`,
    visual: (s) => `<h3>What consumers will see</h3>${contractsView(s)}`,
  },
  {
    id: "touches", group: "Plan, unattended", title: "S08 to S15: node text and citations", short: "four spec touches · four citation touches", skill: "hsdd-spec",
    lede: "Each node's own text is restated from PRD v2, then its citations move from PRD 1 and Update 1 to PRD v2. Contract versions in the headers wait for reconcile.",
    loop: ["spec"],
    present: () => `
      ${list([
        "S08 to S11 restated the root and the three leaf-parents from PRD v2: Purpose, Owns, Isolation strategy, Overview, in each node's file and in its embedded copy in the root.",
        "Owner attention (DEC-073): PRD v2's Success leaves out version 1's \"Home within 3 seconds\", so the root no longer carries it while the shipped integration.1 still asserts it. The PRD author's omission; the run routed the question on.",
        "S12 to S15 moved the citations: 13 in the root with section names mapped; ten live profile-api@v1 citations kept, since v1 is still live beside v2 under coexisting.",
        "Two touches noticed seams for later plans: every booking endpoint can now be the first to see an expired session (S10), and bookings persist between test runs (S11).",
      ])}
      ${wrong([
        "Items meant for a node's phase plan were handed to every earlier step on that node (build decision B-10). S09, S10 and S11 each closed them explained and carried copies forward: thirteen items in all, verbatim, each reaching its handoff (DEC-087). Fixed after the run (R-2): an item waits for its handoff's own step.",
        "A child's citation touch cannot write the root's copy of its header, so the root's touch moved the copies itself (DEC-116). Fixed after the run (R-6): the parent's touch owns its copies.",
      ])}
      ${say(["Pick S09 in the panel, then open its dispatch file: the Routed to this step section lists the four items it should never have been handed."])}`,
    self: () => `
      <p>Read the eight steps' records.</p>
      ${checks("touches", [
        "Each node spec's Sources line cites hsdd/context/prd-simple-login.v2.md; citations left in shipped phases are history, kept on purpose.",
        "Produces and Consumes still name the old contract versions: reconcile writes those.",
        "Compare a node's own section with its embedded copy in hsdd/spec/simple-login.md: they agree.",
        "With the released v0.11.0, S09 to S11's dispatch files list no items meant for H14, H16 or H18 (R-2).",
      ])}
      ${recordsLine(["S09", "S12"])}`,
    visual: (s) => `<h3>Eight touches</h3>${touchesView(s)}`,
  },
  {
    id: "plans", group: "Plan, unattended", title: "S16 to S21: append phases, reconcile each node", short: "twelve phases · booking-api@v1 stable", skill: "hsdd-phase-plan",
    lede: "Node by node, producer first: an append, then a reconcile, so each consumer plans against a contract its producer's reconcile has settled. booking-api@v1 flips to stable at the last reconcile.",
    loop: ["plan", "reconcile"],
    present: () => `
      ${list([
        "S16 appended four backend phases, interfaces first. Its experiment against a real PostgreSQL 17 in Colima decided D7: a per-room advisory lock (DEC-149).",
        "S17 confirmed backend.7 as booking-api@v1's producer, applied the U+0000 title amend in place on the draft contract (DEC-154), and turned the Compose note into a Local database section in conventions (DEC-156). Both would_have_asked.",
        "S18 appended five web phases; S19 drained three confirms. S20 appended three integration phases and sent reconcile a request: does the service create its tables in an empty database at start-up?",
        "S21 answered yes (DEC-198) and made booking-api@v1's consumers final, so it flipped from draft to stable.",
        "DEC-149's prose says 90 rounds; the experiment says 60. Decisions are never edited, so the correction is its own decision (DEC-150).",
      ])}
      ${wrong(["S18 made two protocol slips and recorded both (DEC-176): it read the backend's phase plan for its format, which planner isolation forbids, and it edited one word of a minted decision to remove an em dash it had quoted from a skill template. Neither is visible to the gate: planner isolation is a prompt rule only."])}
      ${say(["Switch nodes in the panel, then switch the D7 strategies: the experiment ran before any code, and the plan chose from its numbers."])}`,
    self: () => `
      <p>Read the six steps' records and the three specs' Phase Plan sections.</p>
      ${checks("plans", [
        "Each node gained phases after its last shipped one; nothing shipped was renumbered or rewritten.",
        "Each new phase's Scope cites the intake record.",
        "booking-api.md: status: stable, phase_ids: final, produced_by backend.7, seven consumers.",
        "hsdd/conventions.md has a Local database section naming backend/compose.yaml and db:up.",
      ])}
      ${recordsLine(["S16", "S18", "S20", "S21"])}`,
    visual: (s) => `<h3>Twelve phases, appended</h3>${plansView(s)}`,
  },
  {
    id: "consistency", group: "Plan, unattended", title: "S22 to S29: the consistency stage", short: "one rework · three inserted steps",
    lede: "All nineteen handoffs ran, but seven consider items were still open. The run kept going: a spec touch per node with open items, one rework, and three steps inserted by the intake record's own rule.",
    loop: ["spec", "plan", "reconcile"],
    present: () => `
      ${list([
        "S22, a plan step, routed three items to the nodes whose text they are (DEC-203).",
        "S23 found a false sentence in its own target and left it; the orchestrator sent it back once with the finding (DEC-207). The rework corrected it (DEC-208). One rework in the run.",
        "The insert rule covers exactly this case: a reconcile answer that changes what an unshipped phase should prove. S24 rewrote backend.7 in place; S27 rewrote one sentence of integration.3's Scope.",
        "S28 and S29 closed the last stale cells and a citation nit.",
      ])}
      ${wrong([
        "An inserted step's invocation rendered the template's default (\"Append phases to ...\") with none of the item's text; S24 and S27 had to read their queue items to learn the job. Fixed after the run (R-3).",
        "S24's rewrite emitted no pending entry, so the inserted reconcile S25 had nothing to drain, but an accepted insert-step could not be withdrawn (DEC-215, DEC-216). It ran anyway. Fixed after the run (R-4).",
        "S27 checked a claim against the backend's D3, a second planner-isolation slip, recorded (DEC-226).",
      ])}`,
    self: () => `
      <p>Read the stage's records; the queue shows each item's path.</p>
      ${checks("consistency", [
        "hsdd/auto/plan.md's change log names each inserted step with its queue item and decision.",
        "dispatch/S23.md's launches lists two entries, initial and resume-finding; steps/S23.r1.json is the report after the resume.",
        "In hsdd/auto/queue.jsonl, Q-084 to Q-086 go open, accepted, addressed.",
        "With the released v0.11.0, an inserted step's invocation carries its item's text (R-3), and an accepted insert-step can be withdrawn while no dispatch names it (R-4).",
      ])}
      ${recordsLine(["S23", "S24", "S25"])}`,
    visual: (s) => `<h3>Eight more steps</h3>${consView(s)}`,
  },
  {
    id: "report", group: "Plan, unattended", title: "S30: the segment report", short: "DONE · no stop",
    lede: "The last step writes one report per segment. It is where the owner's review starts: the outcome, what changed, and the decisions to look at first.",
    loop: ["report"],
    present: () => `
      ${list([
        "The final gate gave no F2 line: no live text cites a superseded contract version. profile-api@v1's ten citations are a live earlier version under coexisting.",
        "state.mjs done printed DONE 2026-10-31-intake-prd-simple-login-v2; ledger.mjs validate gave 0 errors and 0 warnings.",
        "31 steps, 27 by subagents; 65 commits on auto/meeting-rooms; 231 decisions; 12 experiments, three against a real PostgreSQL 17 and one in the installed Chrome; one rework; three inserted steps; no stop.",
        "Decisions to look at first: the nine would_have_asked decisions, then every decision whose blast radius is the tree. 33 rows.",
      ])}
      ${wrong(["The report step's ## Produced append in the intake record lists \"ADRs amended: ADR-001, ADR-002\", though ADR-002 is new, omits the new booking-api@v1, and keeps its \"none yet\" placeholder. Fixed after the run (R-5); the checkpoint raises it as F-21."])}
      ${say(["Click the bars: the planners (S16, S18, S20) and the contract step (S05) carry the most decisions; the would_have_asked ones cluster where a skill reserves a question for a human."])}`,
    self: () => `
      ${checks("report", [
        "/hsdd-auto status reports the segment done; the run's last message names the report, the counts and the would_have_asked decisions by id.",
        "node hsdd/scripts/auto/ledger.mjs validate prints no error.",
        "The report's Decisions to look at first lists every would_have_asked decision first.",
        "Read the Assumptions and Record gaps slots: what the run took for granted, and what its records leave out.",
      ])}
      ${recordsLine(["S30"])}
      <p class="files-line">The report: ${fileBtn(REPORT)}</p>`,
    visual: (s) => `<h3>The run in numbers</h3>${reportView(s)}`,
  },
  {
    id: "review", group: "Review", title: "The owner's review sitting", short: "33 review lines · 1 disagree",
    lede: "The run asked nothing; this is where the owner answers. One line per decision the report lists first, in hsdd/judgement/decision-reviews.jsonl: agree, disagree or should-have-asked.",
    loop: ["review"],
    present: () => `
      ${list([
        "33 lines, one per decision the report lists first. Reviewer: \"Claude for Purbo Mohamad (owner proxy)\", the named-delegate form v0.10.2 admits.",
        "32 agree, 1 disagree. The disagreement is DEC-032: ADR-002's date-mark rule, applied literally, repeats a date in a room-local range, (Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London). The preferred form shows it once.",
        "The disagreement is left for the owner as a follow-up, an ADR-002 amendment through a later intake. Nothing in the run acts on it, so the build follows ADR-002 as written.",
        "auto/meeting-rooms merged into main. hsdd-auto's part is over.",
      ])}
      ${proxy("The whole sitting is the proxy's: 33 lines in one pass. The checkpoint later judges it (F-13) and finds that the one disagreement never landed (F-12).")}
      ${say(["A review line is a record, not an action. Ask the room: where should a disagree go so that it changes something?"])}`,
    self: () => `
      ${prompt("Read hsdd/auto/report/2026-10-31-intake-prd-simple-login-v2.md, then each decision it lists first in hsdd/judgement/decisions.jsonl.")}
      <p>Write one line per decision to ${c(REVIEWS)}:</p>
      <pre class="snippet">{"decision": "DEC-032", "at": "...", "review": "disagree", "reviewer": "...", "reason": "...", "preferred": "...", "impact": "node-local"}</pre>
      ${checks("review", [
        "One line per listed decision; review is agree, disagree or should-have-asked.",
        "Each disagree has a reason and a preferred answer.",
        "For each disagree, write down where it lands (an intake, an ADR amendment) before you build. The run will not.",
        "Merge the run branch into main with a merge commit.",
      ])}`,
    visual: (s) => `<h3>The review, decision by decision</h3>${reviewView(s)}`,
  },
];

// ---------- self-guided helpers (stateful through the shell) ----------
function prompt(text) {
  return `<div class="prompt"><div class="prompt-head"><b>Type this</b><button class="btn small" ${act("copy", text)}>Copy</button></div><pre>${esc(text)}</pre></div>`;
}
function checks(stage, items) {
  const done = (window.WALK_CHECKS && window.WALK_CHECKS[stage]) || {};
  return `<div><h2>Check your result</h2><ul class="checks">${items.map((t, i) => `<li><label><input type="checkbox" ${act("check", `${stage}:${i}`)} ${done[i] ? "checked" : ""}><span>${esc(t)}</span></label></li>`).join("")}</ul></div>`;
}

window.WALK_STAGES = STAGES;
window.WALK_PARTS = { RECORD, REPORT, STEP, stepFiles, prompt, checks };
})();
