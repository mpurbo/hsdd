// View helpers shared by every page. Pure and import-free: html.mjs inlines
// this file into the page as a classic script after stripping `export`.

export class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export function raw(s) {
  return new Raw(String(s));
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

function renderValue(v) {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(renderValue).join("");
  if (v instanceof Raw) return v.s;
  return esc(v);
}

// Tagged template: every interpolated value is escaped unless it is Raw.
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += renderValue(v) + strings[i + 1];
  });
  return new Raw(out);
}

// Inline markdown a source field may carry, after escaping: `code`,
// **bold**, *emphasis*, and [links](x) shown as their text.
export function inline(text) {
  return raw(
    esc(text)
      .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1<em>$2</em>"),
  );
}

// Source blocks (from md.mjs `blocks`) as HTML. Code gets a copy button.
export function renderBlocks(bs) {
  return raw(
    (bs ?? [])
      .map((b) => {
        if (b.type === "p") return html`<p>${inline(b.text)}</p>`.s;
        if (b.type === "heading") return html`<h4>${inline(b.text)}</h4>`.s;
        if (b.type === "quote") return html`<blockquote>${inline(b.text)}</blockquote>`.s;
        if (b.type === "code") return html`<div class="code"><button type="button" class="copy" data-copy>Copy</button><pre><code>${b.text}</code></pre></div>`.s;
        if (b.type === "table") return html`<div class="table-wrap"><table><thead><tr>${b.header.map((h) => html`<th>${inline(h)}</th>`)}</tr></thead><tbody>${b.rows.map((r) => html`<tr>${r.map((c) => html`<td>${inline(c)}</td>`)}</tr>`)}</tbody></table></div>`.s;
        const tag = b.type === "ol" ? "ol" : "ul";
        return `<${tag}>${b.items.map((it) => (it.checked === null ? html`<li>${inline(it.text)}</li>` : html`<li class="cb"><span class="box-mark" aria-label="${it.checked ? "done" : "open"}">${it.checked ? "\u2611" : "\u2610"}</span> ${inline(it.text)}</li>`).s).join("")}</${tag}>`;
      })
      .join(""),
  );
}

// A field value: a bullet list when every line is a bullet, else paragraphs.
export function block(text) {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return raw("");
  if (lines.every((l) => /^[-*]\s+/.test(l))) return html`<ul>${lines.map((l) => html`<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`)}</ul>`;
  return html`<p>${inline(lines.join(" "))}</p>`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many ?? one + "s"}`;
}

export function href(audience, ...parts) {
  return "#" + [audience, ...parts.filter((p) => p !== undefined && p !== null)].map((p) => encodeURIComponent(p)).join("/");
}

// "#reviewer/node/acme.api" -> { audience, view, id }. Unknown audiences fall
// back to the first one; an empty view is "top".
export function parseRoute(hash, audiences) {
  const parts = String(hash ?? "").replace(/^#/, "").split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const audience = audiences.includes(parts[0]) ? parts.shift() : audiences[0];
  return { audience, view: parts[0] ?? "top", id: parts.slice(1).join("/") || null };
}

export function chip(label, target, cls) {
  return target ? html`<a class="chip ${cls ?? ""}" href="${target}">${label}</a>` : html`<span class="chip ${cls ?? ""}">${label}</span>`;
}

export function section(title, body, cls) {
  if (!body || (body instanceof Raw && !body.s)) return raw("");
  return html`<section class="${cls ?? ""}"><h2>${title}</h2>${body}</section>`;
}

export function sourceLink(file, line) {
  if (!file) return raw("");
  const rel = String(file).replace(/^hsdd\//, "../");
  return html`<p class="source">Source: <a href="${rel}">${file}${line ? `:${line}` : ""}</a></p>`;
}

// Diagram placeholder: the page script lays out `spec` and draws it here.
export function diagramSlot(id) {
  return html`<div class="diagram" data-diagram="${id}" role="group" aria-label="Diagram"></div>`;
}

export function capitalize(s) {
  const t = String(s ?? "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
