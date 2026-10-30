// simple-login update walkthrough: state, rendering and the imperative shell.
// The state is one value; views are functions of it; the shell at the end
// owns events, the address, focus and storage.
"use strict";
(() => {
const { esc, act, markdown } = window.WL;
const STAGES = window.WALK_STAGES;
const DATA = window.WALK_DATA || { stages: {}, blobs: [] };

// ---------- storage (per-viewer conveniences only) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(`slu-walk:${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`slu-walk:${k}`, JSON.stringify(v)); } catch { /* storage unavailable: fine */ } },
};

// ---------- state ----------
const indexOf = (id) => Math.max(0, STAGES.findIndex((s) => s.id === id));
let state = {
  stage: indexOf(location.hash.slice(1)),
  mode: store.get("mode", "present"),
  ui: {},
  visited: store.get("visited", []),
  file: null,
  raw: false,
  diff: false,
  filter: store.get("filter", "changed"),
};
window.WALK_CHECKS = store.get("checks", {});

// ---------- the repository as a stage left it ----------
function filesAt(stageIndex) {
  for (let i = stageIndex; i >= 0; i--) {
    const hit = DATA.stages[STAGES[i].id];
    if (hit) return hit.files;
  }
  return [];
}
function blobAt(stageIndex, path) {
  const hit = filesAt(stageIndex).find(([p]) => p === path);
  if (hit) return DATA.blobs[hit[1]];
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const later = filesAt(i).find(([p]) => p === path);
    if (later) return DATA.blobs[later[1]];
  }
  return undefined;
}

function treeHtml(stageIndex) {
  const all = filesAt(stageIndex);
  if (!all.length) return `<p class="repo-sum">Run <code>node build-data.mjs</code> to embed the repository.</p>`;
  const before = new Map(stageIndex > 0 ? filesAt(stageIndex - 1) : []);
  const base = new Map(filesAt(0));
  const changed = (p, b) => !before.has(p) || before.get(p) !== b;
  const sinceBase = ([p, b]) => !base.has(p) || base.get(p) !== b;
  const now = state.filter === "changed" && stageIndex > 0 ? all.filter(sinceBase) : all;
  const root = {};
  for (const [p, b] of now) {
    const parts = p.split("/");
    let node = root;
    parts.slice(0, -1).forEach((d) => (node = node[d + "/"] ||= {}));
    node[parts.at(-1)] = { path: p, blob: b };
  }
  const lines = (b) => (DATA.blobs[b].match(/\n/g) || []).length;
  const render = (node) => `<ul>${Object.keys(node).sort((a, z) => (a.endsWith("/") === z.endsWith("/") ? a.localeCompare(z) : a.endsWith("/") ? -1 : 1)).map((k) => {
    const v = node[k];
    if (k.endsWith("/")) return `<li><div class="dir">${esc(k)}</div>${render(v)}</li>`;
    return `<li class="${changed(v.path, v.blob) ? "new" : ""}"><button ${act("open", v.path)} title="${esc(v.path)}"><span>${esc(k)}</span><span class="n">${lines(v.blob)}</span></button></li>`;
  }).join("")}</ul>`;
  const fresh = now.filter(([p, b]) => changed(p, b)).length;
  const filter = `<div class="tree-filter">${window.WL.seg("filter", state.filter, [["changed", "Changed since the template"], ["all", "All files"]])}</div>`;
  if (!now.length) return `${filter}<p class="repo-sum">Nothing has changed since the template yet.</p>`;
  const what = state.filter === "changed" && stageIndex > 0 ? `${now.length} of ${all.length} files changed since the template` : `${all.length} files`;
  return `${filter}<p class="repo-sum">${what}${fresh ? `; ${fresh} new or changed in this stage` : ""}. Click to read.</p><div class="tree">${render(root).replace(/^<ul>/, '<ul class="tree-root" style="padding:0;border:0;margin:0">')}</div>`;
}

// ---------- views ----------
function stagesNav() {
  const groups = [...new Set(STAGES.map((s) => s.group))];
  return groups.map((g) => `<div class="group"><p>${esc(g)}</p><ol>${STAGES.map((s, i) => [s, i]).filter(([s]) => s.group === g).map(([s, i]) =>
    `<li class="${state.visited.includes(s.id) ? "done" : ""}"><a href="#${s.id}" ${act("go", i)} ${i === state.stage ? 'aria-current="step"' : ""}><span class="num">${i}</span><span>${esc(s.title)}<small>${esc(s.short)}</small></span></a></li>`).join("")}</ol></div>`).join("")
    + `<div class="stages-foot"><span><kbd>←</kbd> <kbd>→</kbd> step · <kbd>M</kbd> mode · <kbd>T</kbd> theme</span><span>Full record: <button class="filelink" ${act("open-log", "")}>process-log.md</button></span></div>`;
}

function stageView() {
  const s = STAGES[state.stage];
  const body = state.mode === "present" ? s.present(state) : s.self(state);
  return `<header class="st-head">
      <p class="eyebrow"><span>Stage ${state.stage} of ${STAGES.length - 1}</span>${s.skill ? `<span class="chip process">${esc(s.skill)}</span>` : ""}<span>${state.mode === "present" ? "What happened" : "Do it yourself"}</span></p>
      <h1>${esc(s.title)}</h1>
      <p class="lede">${s.lede}</p>
      ${window.WL.loopStrip(s.loop || [])}
    </header>
    <div class="scene"><section class="explain" aria-label="${state.mode === "present" ? "What happened" : "Your turn"}">${body}</section><section class="visual" aria-label="Illustration">${s.visual(state)}</section></div>`;
}

function baseText(path) {
  const hit = filesAt(0).find(([p]) => p === path);
  return hit ? DATA.blobs[hit[1]] : undefined;
}
function fileView() {
  if (!state.file) return "";
  const text = state.file === "@log" ? DATA.log : blobAt(state.stage, state.file);
  if (text === undefined) return `<p>This file does not exist at this stage of the run.</p>`;
  if (state.diff && state.file !== "@log") return window.WL.diffView(baseText(state.file), text);
  const isMd = /\.md$/.test(state.file) || state.file === "@log";
  return isMd && !state.raw ? markdown(text) : `<pre class="raw">${esc(text)}</pre>`;
}

// ---------- actions: (state, value) -> state ----------
const ui = (k) => (s, v) => ({ ...s, ui: { ...s.ui, [k]: v } });
const ACTIONS = {
  go: (s, v) => ({ ...s, stage: Number(v) }),
  mode: (s, v) => ({ ...s, mode: v }),
  open: (s, v) => ({ ...s, file: v, raw: false, diff: false }),
  diff: (s) => ({ ...s, diff: !s.diff }),
  filter: (s, v) => ({ ...s, filter: v }),
  "open-log": (s) => ({ ...s, file: "@log", raw: false, diff: false }),
  raw: (s) => ({ ...s, raw: !s.raw }),
  klass: ui("klass"), policy: ui("policy"), ripple: ui("ripple"), lnode: ui("lnode"), rstep: ui("rstep"), phase: ui("phase"),
  lanephase: ui("lanephase"), vphase: ui("vphase"), cstep: ui("cstep"), metric: ui("metric"),
};

// ---------- shell ----------
const $ = (id) => document.getElementById(id);
function render(focusStage = false) {
  const s = STAGES[state.stage];
  document.title = `${s.title} · simple-login update walkthrough`;
  $("stages").innerHTML = stagesNav();
  $("stage").innerHTML = stageView();
  $("repo-tree").innerHTML = treeHtml(state.stage);
  $("where").textContent = `${state.stage}. ${s.title} · ${s.short}`;
  $("prev").disabled = state.stage === 0;
  $("next").disabled = state.stage === STAGES.length - 1;
  document.querySelectorAll("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === state.mode)));
  if (focusStage) $("stage").focus({ preventScroll: true });
}
function renderFile() {
  const dlg = $("viewer");
  if (!state.file) { if (dlg.open) dlg.close(); return; }
  $("viewer-path").textContent = state.file === "@log" ? "walkthrough/process-log.md" : `execute/${state.file}`;
  $("viewer-raw").textContent = state.raw ? "Formatted" : "Raw";
  $("viewer-raw").hidden = state.diff || !(/\.md$/.test(state.file) || state.file === "@log");
  const base = state.file === "@log" ? undefined : baseText(state.file);
  const now = state.file === "@log" ? undefined : blobAt(state.stage, state.file);
  $("viewer-diff").hidden = state.file === "@log" || base === now;
  $("viewer-diff").textContent = state.diff ? "Whole file" : base === undefined ? "New file" : "Diff vs template";
  $("viewer-body").innerHTML = fileView();
  if (!dlg.open) dlg.showModal();
}
function go(i) {
  const next = Math.min(STAGES.length - 1, Math.max(0, i));
  if (next === state.stage) return;
  const id = STAGES[state.stage].id;
  state = { ...state, stage: next, visited: state.visited.includes(id) ? state.visited : [...state.visited, id] };
  store.set("visited", state.visited);
  try { history.replaceState(null, "", `#${STAGES[next].id}`); } catch { location.hash = STAGES[next].id; }
  render(true);
  window.scrollTo({ top: 0 });
}

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, value } = el.dataset;
  if (action === "go") { e.preventDefault(); go(Number(value)); closeDrawers(); return; }
  if (action === "copy") {
    try { await navigator.clipboard.writeText(value); el.textContent = "Copied"; }
    catch { const pre = el.closest(".prompt").querySelector("pre"); getSelection().selectAllChildren(pre); el.textContent = "Selected"; }
    setTimeout(() => (el.textContent = "Copy"), 1400);
    return;
  }
  if (action === "check") {
    const [stage, i] = value.split(":");
    const cur = { ...(window.WALK_CHECKS[stage] || {}), [i]: el.checked };
    window.WALK_CHECKS = { ...window.WALK_CHECKS, [stage]: cur };
    store.set("checks", window.WALK_CHECKS);
    return;
  }
  const fn = ACTIONS[action];
  if (!fn) return;
  state = fn(state, value);
  if (action === "mode") store.set("mode", state.mode);
  if (action === "filter") store.set("filter", state.filter);
  if (["open", "open-log", "raw", "diff"].includes(action)) { renderFile(); return; }
  render();
});
$("viewer").addEventListener("close", () => { state = { ...state, file: null }; });
$("viewer-close").addEventListener("click", () => $("viewer").close());

function closeDrawers() { $("stages").classList.remove("open"); $("repo").classList.remove("open"); }
$("stages-toggle").addEventListener("click", () => { $("repo").classList.remove("open"); $("stages").classList.toggle("open"); });
$("tree-toggle").addEventListener("click", () => { $("stages").classList.remove("open"); $("repo").classList.toggle("open"); });
$("prev").addEventListener("click", () => go(state.stage - 1));
$("next").addEventListener("click", () => go(state.stage + 1));

const THEMES = ["system", "light", "dark"];
let theme = store.get("theme", "system");
function applyTheme() {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  $("theme").setAttribute("aria-label", `Theme: ${theme}`);
  $("theme").title = `Theme: ${theme} (T)`;
}
$("theme").addEventListener("click", () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; store.set("theme", theme); applyTheme(); });

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || $("viewer").open) return;
  if (e.key === "ArrowRight") go(state.stage + 1);
  else if (e.key === "ArrowLeft") go(state.stage - 1);
  else if (e.key === "m" || e.key === "M") { state = { ...state, mode: state.mode === "present" ? "self" : "present" }; store.set("mode", state.mode); render(); }
  else if (e.key === "t" || e.key === "T") $("theme").click();
});
window.addEventListener("hashchange", () => { const i = indexOf(location.hash.slice(1)); if (i !== state.stage) { state = { ...state, stage: i }; render(true); } });

applyTheme();
render();
})();
