// Assemble one offline HTML file: styles, the page data, the vendored layout
// engine, the view functions and the runtime, under a hash-based CSP.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { esc } from "./views-core.mjs";
import { safeJson } from "./stamp.mjs";
import { PLAN_AUDIENCES } from "./views-plan.mjs";

const here = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

export const KINDS = {
  plan: {
    label: "Plan",
    files: ["views-core.mjs", "graph.mjs", "views-plan.mjs"],
    audiences: PLAN_AUDIENCES,
    render: "renderPlan",
    audienceConst: "PLAN_AUDIENCES",
    nav: [
      { label: "Plan", path: "", key: "t" },
      { label: "Contracts", path: "contracts", key: "c" },
      { label: "Decisions", path: "adrs", key: "d" },
    ],
  },
};

// An ES module as a classic-script fragment: drop import lines, unexport.
export function toClassic(src) {
  return src
    .split("\n")
    .filter((l) => !/^import\s/.test(l))
    .map((l) => l.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/, ""))
    .join("\n");
}

function cspHash(text) {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

function assertInlineSafe(name, text) {
  if (/<\/script|<!--/i.test(text)) throw new Error(`${name} contains "</script" or "<!--" and cannot be inlined`);
}

export function renderPage({ kind, page, stamp }) {
  const k = KINDS[kind];
  if (!k) throw new Error(`unknown page kind "${kind}"`);
  const css = here("./page.css");
  // The MIT notice travels with every copy; the source map it names is not shipped.
  const dagre = `${here("./vendor/dagre.min.js.LEGAL.txt").trimEnd()}\n${here("./vendor/dagre.min.js").replace(/\n\/\/# sourceMappingURL=[^\n]*\s*$/, "\n")}`;
  const keys = Object.fromEntries(k.nav.map((n) => [n.key, n.path]));
  const bundle = [
    ...k.files.map((f) => toClassic(here(`./${f}`))),
    `const PAGE_VIEWS = { audiences: ${k.audienceConst}, render: ${k.render}, keys: ${JSON.stringify(keys)} };`,
    here("./app.js"),
  ].join("\n");
  assertInlineSafe("vendor/dagre.min.js", dagre);
  assertInlineSafe("the view bundle", bundle);
  const csp = [
    "default-src 'none'",
    `script-src ${cspHash(dagre)} ${cspHash(bundle)}`,
    `style-src ${cspHash(css)}`,
    "img-src data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const title = `${page.project.name} · ${k.label}`;
  const nav = k.nav.map((n) => `<a data-nav="${esc(n.path)}" href="#">${esc(n.label)}<kbd>${esc(n.key)}</kbd></a>`).join("");
  const auds = k.audiences.map((a, i) => `<button type="button" data-audience="${esc(a)}" aria-pressed="${i === 0}">${esc(a)}<kbd>${i + 1}</kbd></button>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body>
<button type="button" class="skip" data-skip>Skip to the summary</button>
<header class="bar">
<div class="brand"><span class="mark">HSDD</span><strong>${esc(page.project.name)}</strong> <span class="muted">${esc(k.label)}</span></div>
<nav class="views" aria-label="Views">${nav}</nav>
<div class="audience" role="group" aria-label="Audience">${auds}</div>
<div class="tools"><button type="button" id="theme">Theme</button><button type="button" id="keys" aria-pressed="true">Shortcuts</button></div>
</header>
<nav id="crumbs" class="crumbs" aria-label="Breadcrumbs"></nav>
<main id="main" tabindex="-1"><noscript>This page draws itself with its own inline script. Open it in a browser with scripts enabled.</noscript></main>
<footer class="stamp">Generated ${esc(stamp.generated)} from spec ${esc(stamp.specSha)} · ${Object.keys(stamp.inputs).length} input files · derived, never edited: regenerate it with hsdd-summary.</footer>
<script type="application/json" id="hsdd-page">${safeJson(page)}</script>
<script type="application/json" id="hsdd-stamp">${safeJson(stamp)}</script>
<script>${dagre}</script>
<script>${bundle}</script>
</body>
</html>
`;
}
