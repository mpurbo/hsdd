// simple-login walkthrough: pure helpers. Every function here maps values to
// HTML strings; nothing reads or writes the DOM.
"use strict";

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const act = (action, value = "") => `data-action="${action}" data-value="${esc(value)}"`;
const c = (s) => `<code>${esc(s)}</code>`;
const chip = (cls, text) => `<span class="chip ${cls}">${text}</span>`;
const tierChip = (tier) => `<span class="chip tier ${tier}">${tier}</span>`;
const fileBtn = (path, label = path) => `<button class="filelink" ${act("open", path)}>${esc(label)}</button>`;
const fields = (rows) => `<dl class="fields">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
const list = (items, cls = "") => `<ul class="${cls}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const seg = (action, current, options) =>
  `<div class="seg" role="group">${options
    .map(([value, label]) => `<button ${act(action, value)} aria-pressed="${String(value) === String(current)}">${label}</button>`)
    .join("")}</div>`;
const panel = (cls, title, body) => `<div class="panel ${cls}">${title ? `<h4>${title}</h4>` : ""}${body}</div>`;
const key = (html) => `<div class="key"><b>Key idea</b><p>${html}</p></div>`;
const wrong = (items) => `<div class="went-wrong"><b>What went wrong, and was caught</b>${list(items)}</div>`;
const proxy = (html) => `<p class="proxy"><b>Owner proxy.</b> ${html}</p>`;
const say = (items) => `<div class="say"><b>Say this</b>${list(items)}</div>`;

// ---------- a small markdown renderer for the file viewer ----------
// Headings, paragraphs, lists, block quotes, fenced code, tables, rules,
// inline code, bold, italics and links. Enough for HSDD's own files.
function inline(text) {
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts
    .map((p) => {
      if (p.startsWith("`") && p.endsWith("`") && p.length > 1) return `<code>${esc(p.slice(1, -1))}</code>`;
      return esc(p)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) =>
          /^https?:/.test(href) ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : `<span class="mono">${label}</span>`,
        );
    })
    .join("");
}

function markdown(src) {
  const lines = String(src).replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  // YAML frontmatter is shown as a code block, labelled.
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      out.push(`<pre><code>${esc(lines.slice(0, end + 1).join("\n"))}</code></pre>`);
      i = end + 1;
    }
  }
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (line.startsWith("<!--")) {
      let j = i; while (j < lines.length && !lines[j].includes("-->")) j++;
      out.push(`<pre><code>${esc(lines.slice(i, j + 1).join("\n"))}</code></pre>`);
      i = j + 1; continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      let j = i + 1; while (j < lines.length && !lines[j].startsWith("```")) j++;
      out.push(`<pre><code>${esc(lines.slice(i + 1, j).join("\n"))}</code></pre>`);
      i = j + 1; continue;
    }
    const h = line.match(/^(#{1,4}) (.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
      const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      const [head, ...rest] = body;
      out.push(`<table><thead><tr>${cells(head).map((x) => `<th>${inline(x)}</th>`).join("")}</tr></thead><tbody>${rest
        .map((r) => `<tr>${cells(r).map((x) => `<td>${inline(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (line.startsWith(">")) {
      const q = [];
      while (i < lines.length && lines[i].startsWith(">")) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.) /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.) |^\s{2,}\S/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        if (/^\s*([-*]|\d+\.) /.test(lines[i]) && !/^\s{4,}/.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.) /, ""));
        else items[items.length - 1] += " " + lines[i].trim().replace(/^([-*]|\d+\.) /, "· ");
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4} |```|\||>|\s*([-*]|\d+\.) )/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return `<div class="md">${out.join("\n")}</div>`;
}

// ---------- SVG helpers ----------
const marker = (id) =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow" d="M0,0 L10,5 L0,10 z"/></marker></defs>`;
function box({ x, y, w = 170, h = 50, kind = "leaf", title, sub = "", action = "", value = "", selected = false, cls = "" }) {
  const a = action ? ` ${act(action, value)} tabindex="0" role="button"` : "";
  return `<g class="k-${kind}${selected ? " selected" : ""} ${cls}"${a}>
    <rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
    <text class="t-id" x="${x + w / 2}" y="${y + (sub ? 21 : h / 2 + 4)}" text-anchor="middle">${esc(title)}</text>
    ${sub ? `<text class="t-sub" x="${x + w / 2}" y="${y + 38}" text-anchor="middle">${esc(sub)}</text>` : ""}
  </g>`;
}
const path = (d, cls, m) => `<path class="edge ${cls}" d="${d}" ${m ? `marker-end="url(#${m})"` : ""}/>`;
const svg = (viewBox, label, inner, cls = "") =>
  `<div class="dg-scroll"><svg class="dg ${cls}" viewBox="${viewBox}" role="img" aria-label="${esc(label)}">${inner}</svg></div>`;

// ---------- the HSDD loop strip ----------
const LOOP = [
  ["spec", "hsdd-spec"], ["adr", "hsdd-adr"], ["contract", "hsdd-contract"], ["plan", "hsdd-phase-plan"],
  ["reconcile", "hsdd-reconcile"], ["config", "hsdd-config"], ["code", "superpowers cycle"], ["gate", "review gate"],
];
const loopStrip = (on) =>
  `<div class="loop" aria-label="The HSDD loop">${LOOP.map(([id, label], n) =>
    `${n ? "<i>→</i>" : ""}<span class="${["code", "gate"].includes(id) ? "exec" : ""}${on.includes(id) ? " on" : ""}">${label}</span>`).join("")}</div>`;

window.WL = { esc, act, c, chip, tierChip, fileBtn, fields, list, seg, panel, key, wrong, proxy, say, markdown, marker, box, path, svg, loopStrip };
