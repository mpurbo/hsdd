// Markdown primitives for HSDD artifacts. Pure functions over text; no I/O.

export function toLines(text) {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

// A leading '---' block of `key: value` and `key: [a, b]` lines.
export function splitFrontmatter(text) {
  const ls = toLines(text);
  if (ls[0] !== "---") return { data: null, bodyStart: 0 };
  const end = ls.indexOf("---", 1);
  if (end < 0) return { data: null, bodyStart: 0, error: "frontmatter has no closing ---" };
  const data = {};
  for (let i = 1; i < end; i++) {
    const raw = stripComment(ls[i]);
    if (!raw.trim()) continue;
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(raw);
    if (!m) return { data: null, bodyStart: 0, error: `frontmatter line ${i + 1} is not key: value` };
    data[m[1]] = scalarOrList(m[2].trim());
  }
  return { data, bodyStart: end + 1 };
}

function stripComment(s) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[") depth++;
    else if (c === "]") depth--;
    else if (c === "#" && depth === 0 && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s;
}

function unquote(s) {
  return /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s;
}

function scalarOrList(v) {
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(",").map((x) => unquote(x.trim())).filter(Boolean) : [];
  }
  return unquote(v);
}

// Headings outside fenced code blocks: [{ level, text, line }], line 0-based.
export function headings(ls) {
  const out = [];
  let fence = null;
  ls.forEach((l, i) => {
    const f = /^\s*(```|~~~)/.exec(l);
    if (f) {
      if (fence === null) fence = f[1];
      else if (l.trim().startsWith(fence)) fence = null;
      return;
    }
    if (fence !== null) return;
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(l);
    if (m) out.push({ level: m[1].length, text: m[2], line: i });
  });
  return out;
}

// Sections at one heading level: body runs to the next heading of that level or higher.
export function sections(ls, level, from = 0, to = ls.length) {
  const hs = headings(ls).filter((h) => h.line >= from && h.line < to);
  return hs
    .filter((h) => h.level === level)
    .map((h) => {
      const next = hs.find((x) => x.line > h.line && x.level <= level);
      return { title: h.text, line: h.line, start: h.line + 1, end: next ? next.line : to };
    });
}

const FIELD = /^(?:[-*]\s+)?\*\*([A-Za-z][^*]*?):\*\*\s?(.*)$/;

// The first run of `- **Name:** value` lines (or bare `**Name:** value` lines)
// in [from, to). Indented lines continue the current field. Any other
// top-level bullet inside the run (an amendment note whose bold label wraps)
// is kept as an annotation field named "_note{line}". Returns null when a
// heading or the range end comes first.
export function fieldBlock(ls, from = 0, to = ls.length) {
  let i = from;
  while (i < to && !(/^\S/.test(ls[i]) && FIELD.test(ls[i]))) {
    if (/^#{1,6}\s/.test(ls[i])) return null;
    i++;
  }
  if (i >= to) return null;
  const start = i;
  const fields = {};
  let cur = null;
  for (; i < to; i++) {
    const l = ls[i];
    const m = /^\S/.test(l) ? FIELD.exec(l) : null;
    if (m) {
      cur = { value: [m[2]], line: i };
      fields[m[1].trim()] = cur;
      continue;
    }
    if (/^[-*]\s+\S/.test(l)) {
      cur = { value: [l.replace(/^[-*]\s+/, "")], line: i };
      fields[`_note${i}`] = cur;
      continue;
    }
    if (cur && /^\s+\S/.test(l)) {
      cur.value.push(l.trim());
      continue;
    }
    if (!l.trim()) {
      let j = i + 1;
      while (j < to && !ls[j].trim()) j++;
      if (j < to && ((/^\S/.test(ls[j]) && FIELD.test(ls[j])) || /^\s+\S/.test(ls[j]))) continue;
    }
    break;
  }
  for (const f of Object.values(fields)) f.value = f.value.join("\n").trim();
  return { fields, start, end: i };
}

const SEPARATOR = /^[\s|:-]+$/;

// Pipe tables in [from, to): [{ header, rows: [{ cells, line }], line }].
export function tables(ls, from = 0, to = ls.length) {
  const out = [];
  for (let i = from; i < to; i++) {
    if (!/^\s*\|/.test(ls[i])) continue;
    if (i + 1 < to && SEPARATOR.test(ls[i + 1]) && ls[i + 1].includes("---")) {
      const header = cells(ls[i]);
      const rows = [];
      let j = i + 2;
      for (; j < to && /^\s*\|/.test(ls[j]); j++) rows.push({ cells: cells(ls[j]), line: j });
      out.push({ header, rows, line: i });
      i = j - 1;
    }
  }
  return out;
}

export function cells(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  const out = [];
  let cur = "";
  let tick = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (c === "`") tick = !tick;
    if (c === "|" && !tick) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

// Column index by header name, case-insensitive, first header that starts with `name`.
export function column(table, name) {
  const n = name.toLowerCase();
  return table.header.findIndex((h) => plain(h).toLowerCase().startsWith(n));
}

// Strip inline markdown: emphasis, code ticks, links, footnote-style brackets.
export function plain(s) {
  return String(s)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// A section title without its numbering: "6. Findings register" -> "Findings register".
export function sectionName(s) {
  return plain(s).replace(/^(?:\d{1,2}(?:\.\d+)*\.?|\u00a7\s*\d+(?:\.\d+)*)\s+/, "");
}

const NONE = /^(none|n\/a|\u2014|-|\u2013)?\.?$/i;

export function isNone(s) {
  return NONE.test(plain(s));
}

// Contract references `{id}@v{n}` in order of appearance, each once.
export function contractRefs(s) {
  const out = [];
  const re = /([a-z0-9][a-z0-9-]*)@(v\d+)/gi;
  const text = String(s);
  const matches = [...text.matchAll(re)];
  matches.forEach((m, k) => {
    const ref = `${m[1]}@${m[2]}`;
    const tailEnd = k + 1 < matches.length ? matches[k + 1].index : text.length;
    const tail = text.slice(m.index + m[0].length, Math.min(tailEnd, m.index + m[0].length + 40));
    const ext = /^[`\]\s]*\(\s*ext\b/i.test(tail) || /\bext\b/i.test(tail.split(/[\],;]/)[0]);
    if (!out.some((r) => r.ref === ref)) out.push({ ref, id: m[1], version: m[2], ext });
  });
  return out;
}

export function adrRefs(s) {
  return [...new Set([...String(s).matchAll(/\bADR-(\d+)\b/g)].map((m) => `ADR-${m[1].padStart(3, "0")}`))];
}

export function oqRefs(s) {
  return [...new Set([...String(s).matchAll(/\bOQ-?[A-Z]*\d+\b/g)].map((m) => m[0]))];
}

export function words(s) {
  const t = String(s).trim();
  return t ? t.split(/\s+/).length : 0;
}

// The blocks of a markdown region, for showing source text on a page:
// paragraphs, bullet and numbered lists (checkboxes kept), fenced code,
// tables, quotes and headings. Continuation lines join their item.
export function blocks(ls, from = 0, to = ls.length) {
  const out = [];
  const isFence = (l) => /^\s*(```|~~~)/.test(l);
  const isTable = (k) => /^\s*\|/.test(ls[k]) && k + 1 < to && SEPARATOR.test(ls[k + 1]) && ls[k + 1].includes("---");
  const isItem = (l) => /^([-*]|\d+\.)\s+\S/.test(l);
  let i = from;
  while (i < to) {
    const l = ls[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*(```|~~~)(.*)$/.exec(l);
    if (fence) {
      const body = [];
      i++;
      while (i < to && !ls[i].trim().startsWith(fence[1])) body.push(ls[i++]);
      i++;
      out.push({ type: "code", lang: fence[2].trim(), text: body.join("\n") });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      out.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    if (isTable(i)) {
      const t = tables(ls, i, to)[0];
      out.push({ type: "table", header: t.header, rows: t.rows.map((r) => r.cells) });
      i = t.rows.length ? t.rows[t.rows.length - 1].line + 1 : i + 2;
      continue;
    }
    if (isItem(l)) {
      const ordered = /^\d+\./.test(l);
      const items = [];
      while (i < to) {
        const m = /^([-*]|\d+\.)\s+(.*)$/.exec(ls[i]);
        if (m && /^\d+\./.test(m[1]) === ordered) {
          items.push([m[2]]);
          i++;
          continue;
        }
        if (items.length && /^\s+\S/.test(ls[i])) {
          items[items.length - 1].push(ls[i].trim());
          i++;
          continue;
        }
        if (!ls[i].trim() && i + 1 < to && (/^\s+\S/.test(ls[i + 1]) || (isItem(ls[i + 1]) && /^\d+\./.test(ls[i + 1]) === ordered))) {
          i++;
          continue;
        }
        break;
      }
      out.push({
        type: ordered ? "ol" : "ul",
        items: items.map((parts) => {
          const t = parts.join(" ");
          const cb = /^\[( |x|X)\]\s+(.*)$/.exec(t);
          return cb ? { checked: cb[1] !== " ", text: cb[2] } : { checked: null, text: t };
        }),
      });
      continue;
    }
    if (/^>\s?/.test(l)) {
      const q = [];
      while (i < to && /^>\s?/.test(ls[i])) q.push(ls[i++].replace(/^>\s?/, ""));
      out.push({ type: "quote", text: q.join(" ").trim() });
      continue;
    }
    const p = [];
    while (i < to && ls[i].trim() && !isFence(ls[i]) && !/^#{1,6}\s/.test(ls[i]) && !isTable(i) && !isItem(ls[i]) && !/^>\s?/.test(ls[i])) p.push(ls[i++].trim());
    if (!p.length) p.push(ls[i++].trim());
    out.push({ type: "p", text: p.join(" ") });
  }
  return out;
}
