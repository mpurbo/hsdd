# v0.9 Plan B: hsdd-summary Engine and the Plan Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new skill, `hsdd-summary`, whose zero-dependency scripts turn an HSDD tree into one offline, stamped HTML plan page (root to phase cards, contracts, decisions, What to check) for three audiences.

**Architecture:** A script parses what the HSDD templates fix and lists what it could not parse; the agent fills only those items from the source; a schema and cross-checks validate the model. Pure view functions turn (model, route) into HTML strings and diagram specs; they run in Node tests and are inlined into the page, where a small runtime lays diagrams out with the vendored dagre and handles routes, audiences and keys. Prose lives in a stamped store; every page is stamped with the hashes of its inputs.

**Tech Stack:** Node.js 20 or later, built-ins only (`node:fs`, `node:crypto`, `node:test`, `node:vm`); `@dagrejs/dagre` 3.1.1, vendored (MIT); plain HTML, CSS and browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md` (sections 3, 5, 6, 8, 10, 11 B1 and B2). Read it before starting.

## Global Constraints

- Work on branch `feat/v0.9.0`. Commit as `Purbo Mamad <m.purbo@gmail.com>`; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git push` after every task.
- Zero dependencies: Node built-ins only, no `package.json`, no `npm install`. Run tests with `node --test test/*.test.mjs` from the repo root (`node --test test/` does not work on every Node version).
- Source files contain no literal em-dash, en-dash, line-separator or paragraph-separator character. Write them as `\u2014`, `\u2013`, `\u2028`, `\u2029` escapes inside code; prose uses neither dash.
- New prose (skill, spec, comments) contains no em-dash and none of the phrases the house style bans (the dispatch prompt names them).
- The page: one file, no network request, a Content-Security-Policy that lists the hash of every inline script and the style, every value escaped, no `style=` attributes and no inline event handlers.
- In a project, the skill writes only under `hsdd/summary/`; its scripts are copied verbatim to `hsdd/scripts/summary/`.
- No existing skill changes in this plan. (`hsdd-checkpoint`'s gated step is Plan C.)
- Visual identity: the `mermaid-pastel-style` palette in `page.css`; no other design system.
- Task 12 needs `spec/hsdd-spec-v0_9.md` (Plan A, Task 1) and Task 13 needs `review/hsdd-v0_9-acceptance.md` (Plan A, Task 6). Tasks 1 to 11 have no dependency on Plan A.

**Deviation from the design, recorded:** design §5.1 puts the scripts in `hsdd/scripts/` and the schemas in `hsdd/schema/`. This plan keeps the whole engine, schemas included, in one directory copied to `hsdd/scripts/summary/`, because generic module names (`html.mjs`, `graph.mjs`, `schema.mjs`) would collide with other bundled scripts in a flat `hsdd/scripts/`. Design §6.1 derives node edges from a dependency table; real trees carry their typed DAG only as Mermaid, which is never parsed, so edges come from the contracts each part consumes and produces.

## Review Focus

1. **Field drift in real trees:** titles separated by an em dash, a node's fields under `## Node spec`, a one-line `**Node id:** … · **Kind:** …` header above them, amendment bullets whose bold label wraps to the next line, phase aliases (`an.3` in node `frontend.analytics`), a footnote mark after an id (a dagger), and ranges written with an en dash between two ids. Pinned by the tests in Tasks 1 and 2.
2. **A leaf-parent with dozens of phases:** the collapsed graph becomes an ordered list rather than an unreadable row of boxes. Pinned in Task 6.
3. **Hostile text in any source field:** escaped in every view and unable to leave the data script. Pinned in Tasks 6 and 8.
4. **A hand-edited prose store that is no longer JSON:** `check` still reports and exits 0; `render` names the file. Pinned in Task 9.
5. **Blocked storage or blocked scripts in the viewer's browser:** settings fall back to defaults; a `<noscript>` message explains an empty page. Pinned by the browser check in Task 10.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `skills/hsdd-summary/SKILL.md` | The skill: setup, process, prose rules, quality gates |
| `skills/hsdd-summary/scripts/md.mjs` | Markdown primitives: frontmatter, headings, sections, field blocks, tables, references |
| `skills/hsdd-summary/scripts/extract-plan.mjs` | Tree to plan model, plus `unparsed[]` |
| `skills/hsdd-summary/scripts/plan-model.schema.json` | The plan model's schema |
| `skills/hsdd-summary/scripts/schema.mjs` | The JSON Schema subset validator |
| `skills/hsdd-summary/scripts/checks-plan.mjs` | Cross-checks: errors and findings |
| `skills/hsdd-summary/scripts/prose.mjs` | Prose slots, glossary keys, seeding, status, stamping, lint |
| `skills/hsdd-summary/scripts/stamp.mjs` | Input hashes, page stamp, safe JSON |
| `skills/hsdd-summary/scripts/graph.mjs` | Child graphs from contracts, phase graphs, layering |
| `skills/hsdd-summary/scripts/views-core.mjs` | Escaping, templates, routes, chips (inlined into pages) |
| `skills/hsdd-summary/scripts/views-plan.mjs` | Plan page views (inlined into pages) |
| `skills/hsdd-summary/scripts/app.js` | Browser runtime: routes, audiences, diagrams, keys, theme |
| `skills/hsdd-summary/scripts/page.css` | Page styles |
| `skills/hsdd-summary/scripts/html.mjs` | One-file page assembly with a hash-based CSP |
| `skills/hsdd-summary/scripts/summary.mjs` | CLI: extract, validate, slots, lint, stamp, render, check |
| `skills/hsdd-summary/scripts/vendor/` | dagre 3.1.1 and its notices |
| `commands/hsdd-summary.md` | One-line delegator |
| `test/` | `node --test` suites, `helpers/`, `fixtures/tree/` |

---

### Task 1: Markdown primitives

**Files:**
- Create: `skills/hsdd-summary/scripts/md.mjs`
- Test: `test/md.test.mjs`

**Interfaces:**
- Produces: `toLines(text) -> string[]`; `splitFrontmatter(text) -> { data: object|null, bodyStart: number, error?: string }`; `headings(lines) -> [{ level, text, line }]`; `sectionName(title)` (drops leading numbering such as `6. `); `blocks(lines, from?, to?) -> [{ type: p|ul|ol|code|table|quote|heading, ... }]`; `sections(lines, level, from?, to?) -> [{ title, line, start, end }]`; `fieldBlock(lines, from?, to?) -> { fields: { [name]: { value, line } }, start, end } | null`; `tables(lines, from?, to?) -> [{ header: string[], rows: [{ cells, line }], line }]`; `cells(line)`; `column(table, name) -> index`; `plain(s)`; `isNone(s)`; `contractRefs(s) -> [{ ref, id, version, ext }]`; `adrRefs(s)`; `oqRefs(s)`; `words(s)`. All line numbers are 0-based.

- [ ] **Step 1: Write the failing test**

Create `test/md.test.mjs`:

````js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toLines, splitFrontmatter, headings, sections, fieldBlock, tables, cells, column,
  plain, isNone, contractRefs, adrRefs, oqRefs, words, blocks, sectionName,
} from "../skills/hsdd-summary/scripts/md.mjs";

test("frontmatter: scalars, lists, comments, quotes", () => {
  const fm = splitFrontmatter("---\nid: auth-token\nversion: v1   # current\nproduced_by: [a.1, a.2]\nconsumers: []\nnote: \"x # y\"\n---\n# Body\n");
  assert.deepEqual(fm.data, { id: "auth-token", version: "v1", produced_by: ["a.1", "a.2"], consumers: [], note: "x # y" });
  assert.equal(fm.bodyStart, 7);
});

test("frontmatter: absent and unterminated", () => {
  assert.equal(splitFrontmatter("# Title\n").data, null);
  assert.match(splitFrontmatter("---\nid: x\n").error, /closing/);
  assert.match(splitFrontmatter("---\nnot a pair\n---\n").error, /line 2/);
});

test("headings ignore fenced code", () => {
  const ls = toLines("# A\n```markdown\n## not a heading\n```\n## B\n~~~\n# no\n~~~\n### C");
  assert.deepEqual(headings(ls).map((h) => [h.level, h.text, h.line]), [[1, "A", 0], [2, "B", 4], [3, "C", 8]]);
});

test("sections run to the next heading of the same or higher level", () => {
  const ls = toLines("# T\n## One\na\n### Sub\nb\n## Two\nc");
  const s = sections(ls, 2);
  assert.deepEqual(s.map((x) => [x.title, x.start, x.end]), [["One", 2, 5], ["Two", 6, 7]]);
});

test("fieldBlock: bullets, continuation, nested bullets, blank lines between fields", () => {
  const ls = toLines([
    "intro",
    "- **Kind:** leaf-parent",
    "- **Owns:**",
    "  - tokens",
    "  - sessions",
    "",
    "- **Consumes:** [a@v1], [b@v2],",
    "  [c@v1]",
    "",
    "| table | ends |",
  ].join("\n"));
  const fb = fieldBlock(ls);
  assert.equal(fb.start, 1);
  assert.equal(fb.end, 8);
  assert.equal(fb.fields.Kind.value, "leaf-parent");
  assert.equal(fb.fields.Owns.value, "- tokens\n- sessions");
  assert.equal(fb.fields.Consumes.value, "[a@v1], [b@v2],\n[c@v1]");
  assert.equal(fb.fields.Consumes.line, 6);
});

test("fieldBlock: bare **Field:** lines (pre-0.6.1) are recognized", () => {
  const fb = fieldBlock(toLines("**Kind:** internal\n**Purpose:** route things\n\nprose"));
  assert.equal(fb.fields.Kind.value, "internal");
  assert.equal(fb.fields.Purpose.value, "route things");
});

test("fieldBlock: field names may carry ids, dates and parentheses", () => {
  const fb = fieldBlock(toLines("- **Consumes:** none\n- **Amended by ADR-045 (2026-09-10):** flat 3 days\n  and more\n- **Scope:** the endpoints"));
  assert.equal(fb.fields["Amended by ADR-045 (2026-09-10)"].value, "flat 3 days\nand more");
  assert.equal(fb.fields.Scope.value, "the endpoints");
});

test("fieldBlock: a bullet whose bold label wraps is kept as an annotation", () => {
  const fb = fieldBlock(toLines("- **Governed by:** [ADR-1]\n- **Reopened 2026-09-16 (see\n  ADR-3):** routes\n- **Scope:** thin controllers\n\nprose"));
  assert.equal(fb.fields.Scope.value, "thin controllers");
  assert.equal(fb.fields._note1.value, "**Reopened 2026-09-16 (see\nADR-3):** routes");
  assert.equal(fb.end, 4);
});

test("fieldBlock: stops at a heading and returns null when none precede it", () => {
  assert.equal(fieldBlock(toLines("text\n## H\n- **Kind:** x")), null);
});

test("tables: header, rows, escaped pipes, pipes in code", () => {
  const ls = toLines("| Phase | Name | Depends on |\n|------:|------|---|\n| 1 | `a|b` | none |\n| 2 | x \\| y | 1 |\n\nafter");
  const [t] = tables(ls);
  assert.deepEqual(t.header, ["Phase", "Name", "Depends on"]);
  assert.deepEqual(t.rows.map((r) => r.cells), [["1", "`a|b`", "none"], ["2", "x | y", "1"]]);
  assert.equal(column(t, "depends"), 2);
  assert.equal(column(t, "tier"), -1);
});

test("cells trims and keeps empty cells", () => {
  assert.deepEqual(cells("| a ||  c |"), ["a", "", "c"]);
});

test("plain strips inline markdown", () => {
  assert.equal(plain("**[`auth@v1`](x.md)** and [ADR-001]"), "auth@v1 and ADR-001");
});

test("isNone recognizes the not-applicable markers", () => {
  for (const s of ["none", "None.", "", "\u2014", "-", "\u2013", "n/a"]) assert.equal(isNone(s), true, s);
  assert.equal(isNone("1"), false);
});

test("contractRefs: order, dedupe, ext marker", () => {
  const refs = contractRefs("[`acme-handoff-token@v1` (ext, forwarded)], [`acme-common@v2`], acme-common@v2, user-store@v1 (ext)");
  assert.deepEqual(refs.map((r) => [r.ref, r.ext]), [["acme-handoff-token@v1", true], ["acme-common@v2", false], ["user-store@v1", true]]);
});

test("adrRefs pads numbers; oqRefs finds every form", () => {
  assert.deepEqual(adrRefs("[ADR-1], ADR-011 and ADR-011"), ["ADR-001", "ADR-011"]);
  assert.deepEqual(oqRefs("OQ7, OQ-F1 and OQ-B12; not OQX"), ["OQ7", "OQ-F1", "OQ-B12"]);
});

test("words counts whitespace-separated tokens", () => {
  assert.equal(words("  one two\nthree "), 3);
  assert.equal(words(""), 0);
});

test("blocks: paragraphs, checkbox lists, numbered lists, code, tables, quotes", () => {
  const ls = toLines([
    "First line",
    "continues here.",
    "",
    "- [ ] open item",
    "      wrapped",
    "- [x] done item",
    "",
    "1. **One** text",
    "2. Two",
    "",
    "```",
    "copy me",
    "```",
    "",
    "| A | B |",
    "|---|---|",
    "| 1 | 2 |",
    "> quoted",
    "### Sub",
  ].join("\n"));
  assert.deepEqual(blocks(ls), [
    { type: "p", text: "First line continues here." },
    { type: "ul", items: [{ checked: false, text: "open item wrapped" }, { checked: true, text: "done item" }] },
    { type: "ol", items: [{ checked: null, text: "**One** text" }, { checked: null, text: "Two" }] },
    { type: "code", lang: "", text: "copy me" },
    { type: "table", header: ["A", "B"], rows: [["1", "2"]] },
    { type: "quote", text: "quoted" },
    { type: "heading", level: 3, text: "Sub" },
  ]);
});

test("sectionName drops leading numbering", () => {
  assert.equal(sectionName("6. Findings register"), "Findings register");
  assert.equal(sectionName("1.2 Scope"), "Scope");
  assert.equal(sectionName("Phase Plan"), "Phase Plan");
  assert.equal(sectionName("2026 roadmap"), "2026 roadmap");
});
````

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/md.test.mjs`
Expected: FAIL with `Cannot find module` for `md.mjs`.

- [ ] **Step 3: Implement**

Create `skills/hsdd-summary/scripts/md.mjs`:

````js
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
````

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/md.test.mjs`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/scripts/md.mjs test/md.test.mjs
git commit -m "feat(hsdd-summary): markdown primitives for HSDD artifacts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: The fixture tree and the plan extractor

**Files:**
- Create: `test/fixtures/tree/hsdd/**` (synthetic project "acme"), `test/helpers/plan-fixture.mjs`
- Create: `skills/hsdd-summary/scripts/extract-plan.mjs`
- Test: `test/extract-plan.test.mjs`

**Interfaces:**
- Consumes: Task 1's primitives.
- Produces: `extractPlan(root, { specSha }) -> model` (shape in Task 3's schema); `listMd(dir)`; `sha(text)`; `codingMethod(conventionsText)`; `splitTitle(text) -> { id, name }`; `phaseList(cell, nodeId, nodeIds, aliases?) -> { ids, unresolved }`; `TIERS`. Helpers: `TREE` (fixture root), `completedModel()` (the model with the two unparsed items filled), `planPage(model, extra)` (page data for views).

The fixture is synthetic and seeds every drift the extractor must survive: a node with no field block of its own (`acme.web`), bare pre-0.6.1 `**Field:**` lines (`acme.web.console`), short phase headings (`api.2`), a phase missing from its summary table (`console.3`), an off-vocabulary tier (`medium`), an external contract, a contract named but never written (`outlet-api@v1`), a version mismatch (`session@v1` against a v2 file), a missing ADR (`ADR-003`), a proposed ADR, an undrained governance section, an open question with a contingent phase, a retired node and an as-built node.

- [ ] **Step 1: Create the fixture tree**

Run from the repo root:

```bash
mkdir -p test/fixtures/tree/hsdd test/fixtures/tree/hsdd/adr test/fixtures/tree/hsdd/contract test/fixtures/tree/hsdd/spec
cat > test/fixtures/tree/hsdd/adr/001-token-signing.md <<'MD'
---
id: ADR-001
status: accepted
affects: [acme.api, auth-token@v1]
date: 2026-09-01
---

# ADR-001: Token signing

## Context
Long deliberation.

## Decision
Sign tokens with Ed25519. Keys rotate monthly.

## Consequences
- Verifiers need the public key.
MD
cat > test/fixtures/tree/hsdd/adr/002-session-store.md <<'MD'
---
id: ADR-002
status: proposed
affects: [acme.api, session@v2]
date: 2026-09-05
---

# ADR-002: Session store

## Decision
Keep sessions in Redis.

## Consequences
- Needs a Redis cluster.
MD
cat > test/fixtures/tree/hsdd/contract/INDEX.md <<'MD'
# Contract registry (generated)
MD
cat > test/fixtures/tree/hsdd/contract/auth-token.md <<'MD'
---
id: auth-token
version: v1
status: stable
kind: api
owner: acme.api
produced_by: [acme.api.2]
consumers: [acme.api.3, acme.web.console.1]
phase_ids: final
---

# Contract: auth-token

## Interface
`issue(userId) -> Token`

## Guarantees / invariants
- exp is iat plus 86400 seconds
- sub is the user id

## Versioning
- v1 current.
MD
cat > test/fixtures/tree/hsdd/contract/session.md <<'MD'
---
id: session
version: v2
status: draft
kind: shared-model
owner: acme.api
produced_by: [acme.api.3]
consumers: [acme.web.console.2]
phase_ids: provisional
---

# Contract: session

## Interface
`Session { id, userId, expiresAt }`

## Guarantees / invariants
- a session never outlives its token
MD
cat > test/fixtures/tree/hsdd/contract/user-store.md <<'MD'
---
id: user-store
version: v1
status: stable
kind: api
owner: ext:directory
produced_by: []
consumers: [acme.api.2]
phase_ids: final
---

# Contract: user-store

## Interface
`GET /users/{id}`

## Guarantees / invariants
- returns 404 for an unknown id
MD
cat > test/fixtures/tree/hsdd/conventions.md <<'MD'
# Project Conventions

## Coding method
**Coding method:** superpowers
MD
cat > test/fixtures/tree/hsdd/spec/acme.api.md <<'MD'
# acme.api: Token Service

## Node

- **Kind:** leaf-parent
- **Purpose:** issue and verify access tokens
- **Owns:** token issuance, session storage
- **Does not own:** user records
- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1], [session@v2]
- **Governed by:** [ADR-001]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fake user store, fixed clock

## Phase Plan

**Default gate:** `npm test`

| Phase | Name | Tier | Size | Depends on | Collides with |
|------:|------|------|------|------------|---------------|
| api.1 | Types | gate-only | ~3 files, <= 3 OpenSpec tasks | none | none |
| api.2 | Token issuance | full-review | ~4 files, <= 5 OpenSpec tasks | 1 | 3 |
| api.3 | Session store | full-review | ~5 files, <= 6 OpenSpec tasks | 2 | 2 |

### api.1: Types

- **Consumes:** none
- **Produces:** none
- **Scope:** token and session types
- **Size estimate:** ~3 files (~80 lines), <= 3 OpenSpec tasks
- **Gate:** node default
- **Verification:** the types compile
- **Review tier:** gate-only
- **Dependencies:** none

### api.2: Token issuance

- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1]
- **Governed by:** [ADR-001]
- **Scope:** issue a signed token for a known user
- **Size estimate:** ~4 files (~250 lines), <= 5 OpenSpec tasks
- **Gate:** node default
- **Verification:** a token issued now expires in exactly 24 hours
- **Review tier:** full-review
- **Collides with:** [api.3]
- **Dependencies:** api.1 (types)

### api.3: Session store

- **Consumes:** [auth-token@v1]
- **Produces:** [session@v2]
- **Governed by:** [ADR-002]
- **Scope:** store sessions in the region OQ1 settles
- **Size estimate:** ~5 files (~300 lines), <= 6 OpenSpec tasks
- **Gate:** `npm test -- sessions`
- **Verification:** a session survives a restart
- **Review tier:** full-review
- **Collides with:** [api.2]
- **Dependencies:** api.2; contingent (OQ1)

## Open questions

| ID | Question | Status | Waits on | Affects |
|----|----------|--------|----------|---------|
| OQ-A1 | Rotate signing keys monthly? | PARTIAL | security review | acme.api.2 |

### OQ-A1 - Key rotation

Monthly is likely.

## Governance updates (pending reconcile)

- request: session@v2 consumers gain acme.web.console.2
MD
cat > test/fixtures/tree/hsdd/spec/acme.legacy.md <<'MD'
# acme.legacy: Legacy Portal

## Node

- **Kind:** leaf-parent
- **Purpose:** the old portal
- **Status:** retired
- **Consumes:** none
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** none
MD
cat > test/fixtures/tree/hsdd/spec/acme.md <<'MD'
# acme: Acme Platform

## Overview

Acme lets a merchant sign in and manage outlets.

## Child nodes

### acme.api: Token Service

- **Kind:** leaf-parent
- **Purpose:** issue and verify access tokens
- **Owns:** token issuance, session storage
- **Does not own:** user records
- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1], [session@v2]
- **Governed by:** [ADR-001]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fake user store, fixed clock

### acme.web: Merchant Web

- **Kind:** internal
- **Purpose:** every screen a merchant uses
- **Team:** web
- **Owns:** the console
- **Does not own:** tokens
- **Consumes:** [auth-token@v1], [session@v1], [outlet-api@v1]
- **Produces:** none
- **Decomposes into:** acme.web.console
- **Isolation strategy:** mocked API

### acme.ops: Operations Scripts

- **Kind:** leaf-parent
- **Purpose:** the deploy scripts that existed before the tree
- **Adopted:** as-built
- **Consumes:** none
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** dry-run flag

### acme.legacy: Legacy Portal

- **Kind:** leaf-parent
- **Purpose:** the old portal
- **Status:** retired
- **Consumes:** none
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** none

## Open questions

| ID | Question | Status | Waits on | Affects |
|----|----------|--------|----------|---------|
| OQ1 | Which region hosts the sessions? | OPEN | ext: infra team | acme.api.3 |
| OQ2 | Do outlets need soft delete? | RESOLVED (2026-09-01) | none | ADR-002 |

### OQ1 - Session region

Undecided.

### OQ2 - Soft delete

Decided in ADR-002.
MD
cat > test/fixtures/tree/hsdd/spec/acme.ops.md <<'MD'
# acme.ops: Operations Scripts

## Node

- **Kind:** leaf-parent
- **Purpose:** the deploy scripts that existed before the tree
- **Adopted:** as-built
- **Consumes:** none
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** dry-run flag

## Observed surface

- extracted: 2026-09-01 @ abc1234 (scripts/extract-seams.mjs)
MD
cat > test/fixtures/tree/hsdd/spec/acme.web.console.md <<'MD'
# acme.web.console: Console

**Kind:** leaf-parent
**Purpose:** the signed-in console
**Consumes:** [auth-token@v1], [session@v1], [outlet-api@v1]
**Produces:** none
**Governed by:** [ADR-003]
**Decomposes into:** phases (see hsdd-phase-plan)
**Isolation strategy:** mocked API

## Phase Plan

**Default gate:** `pnpm test`

| Phase | Name | Size | Depends on |
|------:|------|------|------------|
| console.1 | Sign-in screen | ~4 files, <= 4 OpenSpec tasks | none |
| console.2 | Outlet list | ~5 files, <= 5 OpenSpec tasks | 1, api.2 |

### console.1: Sign-in screen

- **Consumes:** [auth-token@v1]
- **Produces:** none
- **Scope:** the sign-in form
- **Size estimate:** ~4 files (~200 lines), <= 4 OpenSpec tasks
- **Gate:** node default
- **Verification:** a wrong password shows an error
- **Review tier:** spot-check
- **Dependencies:** none

### console.2: Outlet list

- **Consumes:** [session@v1], [outlet-api@v1]
- **Produces:** none
- **Scope:** list the merchant's outlets
- **Size estimate:** ~5 files (~260 lines), <= 5 OpenSpec tasks
- **Gate:** node default
- **Verification:** the list shows every outlet
- **Review tier:** medium
- **Dependencies:** console.1, api.2

### console.3: Outlet detail

- **Consumes:** [outlet-api@v1]
- **Produces:** none
- **Scope:** one outlet's page
- **Size estimate:** ~3 files (~150 lines), <= 3 OpenSpec tasks
- **Gate:** node default
- **Verification:** the page shows the outlet's status
- **Review tier:** spot-check
- **Dependencies:** console.2 (the list links here)
MD
cat > test/fixtures/tree/hsdd/spec/acme.web.md <<'MD'
# acme.web: Merchant Web

## Overview

The web surfaces. This file carries no field block of its own; the parent embeds it.

## Child nodes

### acme.web.console: Console

- **Kind:** leaf-parent
- **Purpose:** the signed-in console
- **Consumes:** [auth-token@v1], [session@v1], [outlet-api@v1]
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** mocked API
MD
find test/fixtures/tree -type f | wc -l   # 13
```

- [ ] **Step 2: Create the test helper**

Create `test/helpers/plan-fixture.mjs`:

```js
import { fileURLToPath } from "node:url";
import { extractPlan } from "../../skills/hsdd-summary/scripts/extract-plan.mjs";

export const TREE = fileURLToPath(new URL("../fixtures/tree", import.meta.url));

// The plan model as the agent leaves it: each unparsed item filled from its source.
export function completedModel() {
  const m = extractPlan(TREE, { specSha: "abc1234" });
  m.phases[4].tier = "spot-check";
  m.phases[5].dependsOn = ["acme.web.console.2"];
  m.unparsed = [];
  return m;
}

// Page data as render builds it: the model, prose and glossary text, findings.
export function planPage(model = completedModel(), extra = {}) {
  const prose = {};
  for (const n of model.nodes) prose[`explain:${n.id}`] = "Plain words about what this part does.";
  const gloss = { "auth-token": "the sign-in pass", "outlet-api": "the outlet service", session: "the session record", "user-store": "the user directory" };
  return { kind: "plan", model, prose, gloss, findings: [], readability: [], ...extra };
}
```

- [ ] **Step 3: Write the failing test**

Create `test/extract-plan.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { extractPlan, phaseList, splitTitle, codingMethod } from "../skills/hsdd-summary/scripts/extract-plan.mjs";

const TREE = fileURLToPath(new URL("./fixtures/tree", import.meta.url));
const model = extractPlan(TREE, { specSha: "abc1234" });
const node = (id) => model.nodes.find((n) => n.id === id);
const phase = (id) => model.phases.find((p) => p.id === id);

test("project: root, name, sha, coding method", () => {
  assert.deepEqual(model.project, { root: "acme", name: "Acme Platform", specSha: "abc1234", codingMethod: "superpowers" });
  assert.equal(codingMethod(""), "openspec");
});

test("nodes are sorted by id and linked to parents", () => {
  assert.deepEqual(model.nodes.map((n) => n.id), ["acme", "acme.api", "acme.legacy", "acme.ops", "acme.web", "acme.web.console"]);
  assert.equal(node("acme.web.console").parent, "acme.web");
  assert.deepEqual(node("acme").children, ["acme.api", "acme.legacy", "acme.ops", "acme.web"]);
});

test("own field block, embedded fallback, and bare pre-0.6.1 lines", () => {
  assert.equal(node("acme.api").purpose, "issue and verify access tokens");
  assert.equal(node("acme.web").kind, "internal");
  assert.equal(node("acme.web").team, "web");
  assert.deepEqual(node("acme.web.console").governedBy, ["ADR-003"]);
  assert.equal(node("acme").kind, "root");
});

test("status, adoption and observed surface", () => {
  assert.equal(node("acme.legacy").status, "retired");
  assert.equal(node("acme.ops").adopted, "as-built");
  assert.equal(node("acme.ops").observedSurface, true);
});

test("contract references keep the external marker", () => {
  assert.deepEqual(node("acme.api").consumes, [{ ref: "user-store@v1", ext: true }]);
  assert.deepEqual(node("acme.api").produces.map((r) => r.ref), ["auth-token@v1", "session@v2"]);
});

test("open questions and pending governance", () => {
  assert.deepEqual(node("acme").openQuestions.map((q) => [q.id, q.status, q.hasDetail]), [["OQ1", "OPEN", true], ["OQ2", "RESOLVED", true]]);
  assert.equal(node("acme.api").pendingGovernance, true);
  assert.equal(node("acme.web.console").pendingGovernance, false);
});

test("phases: ids from short headings, default gate, tiers, caps", () => {
  assert.deepEqual(node("acme.api").phases, ["acme.api.1", "acme.api.2", "acme.api.3"]);
  assert.equal(phase("acme.api.2").heading, "api.2");
  assert.equal(phase("acme.api.2").resolvedGate, "npm test");
  assert.equal(phase("acme.api.3").resolvedGate, "npm test -- sessions");
  assert.equal(phase("acme.api.2").tier, "full-review");
  assert.equal(phase("acme.api.2").taskCap, 5);
});

test("dependencies and collisions from the summary table", () => {
  assert.deepEqual(phase("acme.api.3").dependsOn, ["acme.api.2"]);
  assert.deepEqual(phase("acme.api.2").collidesWith, ["acme.api.3"]);
  assert.deepEqual(phase("acme.web.console.2").dependsOn, ["acme.web.console.1", "acme.api.2"]);
  assert.deepEqual(phase("acme.api.3").contingentOn, ["OQ1"]);
});

test("unparsed: an off-vocabulary tier and a phase with no table row", () => {
  assert.deepEqual(model.unparsed.map((u) => u.path), ["/phases/4/tier", "/phases/5/dependsOn"]);
  assert.equal(phase("acme.web.console.3").inTable, false);
  assert.equal(phase("acme.web.console.2").tier, null);
});

test("contracts: frontmatter, external owner, guarantees", () => {
  const c = model.contracts.find((x) => x.ref === "session@v2");
  assert.equal(c.phaseIds, "provisional");
  assert.equal(model.contracts.find((x) => x.ref === "user-store@v1").external, true);
  assert.deepEqual(model.contracts.find((x) => x.ref === "auth-token@v1").guarantees, ["exp is iat plus 86400 seconds", "sub is the user id"]);
  assert.ok(!model.contracts.some((x) => x.sourceFile.endsWith("INDEX.md")));
});

test("ADRs: title, status, first sentence of the decision", () => {
  assert.deepEqual(model.adrs.map((a) => [a.id, a.title, a.status, a.decision]), [
    ["ADR-001", "Token signing", "accepted", "Sign tokens with Ed25519."],
    ["ADR-002", "Session store", "proposed", "Keep sessions in Redis."],
  ]);
});

test("ids cover nodes, phases, short headings, refs, ADRs and OQs", () => {
  for (const id of ["acme.api", "acme.api.2", "api.2", "outlet-api@v1", "ADR-002", "OQ-A1"]) assert.ok(model.ids.includes(id), id);
});

test("facts are stable hashes keyed by slot subject", () => {
  assert.match(model.facts["explain:acme.api"], /^sha256:[0-9a-f]{64}$/);
  assert.ok(model.facts["delivers:acme.api.2"]);
  assert.ok(model.facts["promise:auth-token@v1"]);
  assert.deepEqual(extractPlan(TREE, { specSha: "abc1234" }).facts, model.facts);
});

test("phaseList: aliases, cross-node, ranges, footnote marks, none", () => {
  const nodes = new Set(["x.web", "x.api"]);
  const aliases = new Map([["w", "x.web"], ["api", "x.api"]]);
  assert.deepEqual(phaseList("1, w.2, api.3\u2020", "x.web", nodes, aliases).ids, ["x.web.1", "x.web.2", "x.api.3"]);
  assert.deepEqual(phaseList("w.1\u2013w.3", "x.web", nodes, aliases).ids, ["x.web.1", "x.web.2", "x.web.3"]);
  assert.deepEqual(phaseList("\u2014", "x.web", nodes).ids, []);
  assert.deepEqual(phaseList("zz.4", "x.web", nodes).unresolved, ["zz.4"]);
});

test("splitTitle: colon, em dash and spaced hyphen", () => {
  assert.deepEqual(splitTitle("acme.api: Token Service"), { id: "acme.api", name: "Token Service" });
  assert.deepEqual(splitTitle("acme-x.backend \u2014 Backend"), { id: "acme-x.backend", name: "Backend" });
  assert.deepEqual(splitTitle("acme.web - Web"), { id: "acme.web", name: "Web" });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `node --test test/extract-plan.test.mjs`
Expected: FAIL with `Cannot find module` for `extract-plan.mjs`.

- [ ] **Step 5: Implement**

Create `skills/hsdd-summary/scripts/extract-plan.mjs`:

```js
// Extract the plan model from an HSDD tree. Reads files; computes nothing a
// view needs beyond what the artifacts state.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  toLines, splitFrontmatter, headings, sections, fieldBlock, tables, column,
  plain, isNone, contractRefs, adrRefs, oqRefs, sectionName,
} from "./md.mjs";

export const TIERS = ["gate-only", "spot-check", "full-review"];

export function sha(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

export function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "INDEX.md").sort();
}

function readIf(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export function codingMethod(conventions) {
  const m = /\*\*Coding method:\*\*\s*`?([a-z]+)`?/i.exec(conventions);
  return m ? m[1].toLowerCase() : "openspec";
}

function nextHeadingLine(ls, line, level) {
  const h = headings(ls).find((x) => x.line > line && x.level <= level);
  return h ? h.line : ls.length;
}

// "acme.api: Name", "acme.api - Name" or "acme.api" followed by an em dash.
export function splitTitle(text) {
  const m = /^([A-Za-z0-9][\w.-]*?)\s*(?::|\u2014|\u2013|\s-)\s*(.*)$/.exec(text.trim());
  return m ? { id: m[1], name: m[2].trim() } : { id: null, name: text.trim() };
}

// A node's own field block: under "## Node" (or "## Node spec"), else between
// the title and the first "##". It counts only if it has Kind or Purpose, so a
// one-line "**Node id:** ... · **Kind:** ..." header is never mistaken for it.
function ownBlock(ls) {
  const hs = headings(ls);
  const isBlock = (fb) => (fb && (fb.fields.Kind || fb.fields.Purpose) ? fb : null);
  const node = hs.find((h) => h.level === 2 && /^node( spec)?$/i.test(sectionName(h.text)));
  if (node) return isBlock(fieldBlock(ls, node.line + 1, nextHeadingLine(ls, node.line, 2)));
  const title = hs.find((h) => h.level === 1);
  const firstH2 = hs.find((h) => h.level === 2);
  let from = title ? title.line + 1 : 0;
  const to = firstH2 ? firstH2.line : ls.length;
  while (from < to) {
    const fb = fieldBlock(ls, from, to);
    if (!fb) return null;
    if (isBlock(fb)) return fb;
    from = fb.end + 1;
  }
  return null;
}

function value(fields, name) {
  const f = fields?.[name];
  return f ? f.value : null;
}

function refsOf(v) {
  return v === null || isNone(v) ? [] : contractRefs(v).map(({ ref, ext }) => ({ ref, ext }));
}

function normTier(v) {
  if (v == null) return null;
  const t = plain(v).toLowerCase().replace(/\s+/g, "-");
  return TIERS.find((x) => t.includes(x)) ?? null;
}

function normKind(v) {
  if (v == null) return null;
  const t = plain(v).toLowerCase();
  if (t.includes("leaf-parent")) return "leaf-parent";
  if (t.includes("integration")) return "integration";
  if (t.includes("internal")) return "internal";
  return null;
}

function parentOf(id, ids) {
  let p = id;
  while (p.includes(".")) {
    p = p.slice(0, p.lastIndexOf("."));
    if (ids.has(p)) return p;
  }
  return null;
}

// "1, api.2 and gateway.3 (types)" -> phase ids, in-node or resolved across nodes.
// `aliases` maps a phase-heading prefix ("an", "gateway") to the node that uses it.
export function phaseList(cell, nodeId, nodeIds, aliases = new Map()) {
  const out = { ids: [], unresolved: [] };
  if (cell == null || isNone(cell)) return out;
  const tokens = plain(cell).replace(/\([^)]*\)/g, "").split(/[,;]|\band\b/);
  for (const raw of tokens) {
    const t = raw.trim().replace(/^phases?\s+/i, "").replace(/[^\w.]+$/, "");
    if (!t || isNone(t)) continue;
    const range = /^(?:(.*?)\.)?(\d+)\s*[\u2013-]\s*(?:(.*?)\.)?(\d+)$/.exec(t);
    if (range && (!range[3] || range[3] === range[1]) && Number(range[4]) >= Number(range[2]) && Number(range[4]) - Number(range[2]) <= 50) {
      for (let n = Number(range[2]); n <= Number(range[4]); n++) tokens.push(`${range[1] ? range[1] + "." : ""}${n}`);
      continue;
    }
    const m = /^(?:(.*)\.)?(\d+)$/.exec(t);
    if (!m) {
      out.unresolved.push(t);
      continue;
    }
    const prefix = m[1] ?? "";
    if (!prefix || nodeId === prefix || nodeId.endsWith("." + prefix) || aliases.get(prefix) === nodeId) {
      out.ids.push(`${nodeId}.${m[2]}`);
      continue;
    }
    const owner = aliases.get(prefix) ?? [...nodeIds].find((n) => n === prefix || n.endsWith("." + prefix));
    if (owner) out.ids.push(`${owner}.${m[2]}`);
    else out.unresolved.push(t);
  }
  out.ids = [...new Set(out.ids)];
  return out;
}

function openQuestions(ls) {
  const sec = sections(ls, 2).find((s) => /^open questions/i.test(sectionName(s.title)));
  if (!sec) return [];
  const t = tables(ls, sec.start, sec.end).find((x) => column(x, "id") >= 0 && column(x, "question") >= 0);
  if (!t) return [];
  const [ci, cq, cs, cw, ca] = ["id", "question", "status", "waits", "affects"].map((n) => column(t, n));
  const hs = headings(ls);
  return t.rows.map((r) => {
    const id = plain(r.cells[ci]);
    const status = plain(r.cells[cs] ?? "");
    return {
      id,
      question: plain(r.cells[cq] ?? ""),
      status: /^resolved/i.test(status) ? "RESOLVED" : /^partial/i.test(status) ? "PARTIAL" : /^open/i.test(status) ? "OPEN" : status,
      waitsOn: cw >= 0 ? plain(r.cells[cw] ?? "") : "",
      affects: ca >= 0 ? plain(r.cells[ca] ?? "") : "",
      hasDetail: hs.some((h) => h.level >= 3 && new RegExp(`^${id}(?![\\w-])`).test(plain(h.text))),
    };
  });
}

function pendingGovernance(ls) {
  const sec = sections(ls, 2).find((s) => /^governance updates/i.test(sectionName(s.title)));
  if (!sec) return false;
  return ls.slice(sec.start, sec.end).some((l) => /^\s*-\s+\S/.test(l) && !/^\s*-\s+none\b/i.test(l));
}

function sectionText(ls, title) {
  const sec = sections(ls, 2).find((s) => new RegExp(`^${title}`, "i").test(sectionName(s.title)));
  return sec ? ls.slice(sec.start, sec.end).join("\n").trim() : "";
}

function bullets(text) {
  return toLines(text).filter((l) => /^\s*[-*]\s+\S/.test(l) && !/^\s{2,}/.test(l)).map((l) => plain(l.replace(/^\s*[-*]\s+/, "")));
}

function firstSentence(text) {
  const para = text.split(/\n\s*\n/)[0] ?? "";
  const s = plain(para);
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  return m ? m[1] : s;
}

export function extractPlan(root, { specSha = "n/a" } = {}) {
  const hsdd = join(root, "hsdd");
  const unparsed = [];
  const facts = {};
  const conventions = readIf(join(hsdd, "conventions.md"));

  const specIds = listMd(join(hsdd, "spec")).map((f) => f.slice(0, -3)).sort();
  const idSet = new Set(specIds);
  const docs = new Map(specIds.map((id) => [id, toLines(readFileSync(join(hsdd, "spec", id + ".md"), "utf8"))]));
  const rootId = specIds.filter((id) => !id.includes("."))[0] ?? specIds[0] ?? null;

  // Child blocks embedded in parents: "### {child-id}: Name" followed by fields.
  const embedded = new Map();
  for (const [file, ls] of docs) {
    for (const h of headings(ls).filter((x) => x.level === 3)) {
      const { id, name } = splitTitle(plain(h.text));
      if (!id || !idSet.has(id) || id === file) continue;
      const fb = fieldBlock(ls, h.line + 1, nextHeadingLine(ls, h.line, 3));
      if (fb) embedded.set(id, { fb, ls, name, file });
    }
  }

  // Phase-heading prefixes per node ("an" in "### an.3: ..."): a prefix used by
  // exactly one node resolves short ids in Depends on cells anywhere in the tree.
  const prefixOwners = new Map();
  for (const [id, ls] of docs) {
    const plan = sections(ls, 2).find((s) => /^phase plan/i.test(sectionName(s.title)));
    if (!plan) continue;
    for (const h of headings(ls).filter((x) => x.level === 3 && x.line > plan.line)) {
      const m = /^([\w.-]*?)\.?(\d+)\s*:/.exec(plain(h.text));
      if (m && m[1] && !idSet.has(m[1])) prefixOwners.set(m[1], [...new Set([...(prefixOwners.get(m[1]) ?? []), id])]);
    }
  }
  const aliases = new Map([...prefixOwners].filter(([, owners]) => owners.length === 1).map(([p, [o]]) => [p, o]));

  const nodes = [];
  const phases = [];
  for (const id of specIds) {
    const ls = docs.get(id);
    const file = `hsdd/spec/${id}.md`;
    const title = headings(ls).find((h) => h.level === 1);
    const t = title ? splitTitle(plain(title.text)) : { name: id };
    const own = ownBlock(ls);
    const emb = embedded.get(id);
    const block = own ?? emb?.fb ?? null;
    const blockLs = own ? ls : emb?.ls;
    const f = block?.fields ?? {};
    const i = nodes.length;
    const isRoot = id === rootId;
    const planSec = sections(ls, 2).find((s) => /^phase plan/i.test(sectionName(s.title)));
    const children = specIds.filter((c) => parentOf(c, idSet) === id);

    let kind = isRoot ? "root" : normKind(value(f, "Kind"));
    if (!isRoot && kind === null) {
      if (value(f, "Kind") === null && !block) kind = planSec ? "leaf-parent" : children.length ? "internal" : null;
      if (kind === null) unparsed.push({ path: `/nodes/${i}/kind`, file, line: (f.Kind?.line ?? 0) + 1, reason: `Kind "${value(f, "Kind") ?? "(absent)"}" is not internal, leaf-parent or integration` });
    }
    if (!isRoot && !block) unparsed.push({ path: `/nodes/${i}/purpose`, file, line: 1, reason: "no field block in the node's file or its parent's" });

    const status = /retired/i.test(value(f, "Status") ?? "") ? "retired" : "active";
    const adoptedV = value(f, "Adopted") ?? "";
    const raw = block ? blockLs.slice(block.start, block.end).join("\n") : "";
    facts[`explain:${id}`] = sha(`${t.name}\n${raw}`);

    const node = {
      id,
      name: t.name || emb?.name || id,
      parent: isRoot ? null : parentOf(id, idSet),
      kind,
      status,
      adopted: /as-built/i.test(adoptedV) ? "as-built" : /promoted/i.test(adoptedV) ? "promoted" : null,
      team: value(f, "Team") ? plain(value(f, "Team")) : null,
      purpose: value(f, "Purpose"),
      owns: value(f, "Owns"),
      doesNotOwn: value(f, "Does not own"),
      isolation: value(f, "Isolation strategy"),
      consumes: refsOf(value(f, "Consumes")),
      produces: refsOf(value(f, "Produces")),
      governedBy: adrRefs(value(f, "Governed by") ?? ""),
      children,
      phases: [],
      defaultGate: null,
      openQuestions: openQuestions(ls),
      pendingGovernance: pendingGovernance(ls),
      observedSurface: sections(ls, 2).some((s) => /^observed surface/i.test(sectionName(s.title))),
      sourceFile: file,
    };
    nodes.push(node);

    if (!planSec) continue;
    const planLs = ls.slice(planSec.start, planSec.end);
    const dg = planLs.map((l) => /^\*\*Default gate:\*\*\s*(.+)$/.exec(l.trim())).find(Boolean);
    node.defaultGate = dg ? plain(dg[1]) : null;
    const table = tables(ls, planSec.start, planSec.end).find((x) => column(x, "phase") >= 0 && column(x, "name") >= 0) ?? null;
    const rowByN = new Map();
    if (table) {
      const cp = column(table, "phase");
      for (const r of table.rows) {
        const n = /(\d+)\s*$/.exec(plain(r.cells[cp] ?? ""));
        if (n) rowByN.set(n[1], r);
      }
    }
    const heads = headings(ls).filter((h) => h.level === 3 && h.line > planSec.line);
    for (const h of heads) {
      const m = /^([\w.-]*?(\d+))\s*:\s*(.+)$/.exec(plain(h.text));
      if (!m || idSet.has(m[1])) continue;
      const end = nextHeadingLine(ls, h.line, 3);
      const fb = fieldBlock(ls, h.line + 1, end);
      if (!fb || !(fb.fields.Scope || fb.fields["Review tier"])) continue;
      const pf = fb.fields;
      const pid = `${id}.${m[2]}`;
      const pi = phases.length;
      const row = rowByN.get(m[2]) ?? null;
      const blockText = ls.slice(fb.start, fb.end).join("\n");
      facts[`delivers:${pid}`] = sha(blockText);

      let tier = normTier(value(pf, "Review tier"));
      if (tier === null && row && column(table, "tier") >= 0) tier = normTier(row.cells[column(table, "tier")]);
      if (tier === null) unparsed.push({ path: `/phases/${pi}/tier`, file, line: (pf["Review tier"]?.line ?? h.line) + 1, reason: `review tier "${value(pf, "Review tier") ?? "(absent)"}" is not gate-only, spot-check or full-review` });

      let dependsOn = [];
      if (row && column(table, "depends") >= 0) {
        const d = phaseList(row.cells[column(table, "depends")], id, idSet, aliases);
        dependsOn = d.ids;
        if (d.unresolved.length) unparsed.push({ path: `/phases/${pi}/dependsOn`, file, line: row.line + 1, reason: `Depends on names ${d.unresolved.join(", ")}, which matches no phase` });
      } else {
        unparsed.push({ path: `/phases/${pi}/dependsOn`, file, line: (pf.Dependencies?.line ?? h.line) + 1, reason: "the phase has no summary-table row; read its Dependencies line" });
      }
      const collCell = row && column(table, "collides") >= 0 ? row.cells[column(table, "collides")] : value(pf, "Collides with");
      const coll = phaseList(collCell, id, idSet, aliases);

      const gate = value(pf, "Gate") === null ? null : plain(value(pf, "Gate"));
      const size = value(pf, "Size estimate") === null ? (row && column(table, "size") >= 0 ? plain(row.cells[column(table, "size")]) : null) : plain(value(pf, "Size estimate"));
      const cap = /(?:<=|\u2264)\s*(\d+)/.exec(size ?? "");
      const contingentOn = [...new Set(toLines(blockText).filter((l) => /contingent/i.test(l)).flatMap(oqRefs))];

      phases.push({
        id: pid,
        node: id,
        heading: m[1],
        n: Number(m[2]),
        name: m[3].trim(),
        tier,
        size,
        taskCap: cap ? Number(cap[1]) : null,
        scope: value(pf, "Scope"),
        verification: value(pf, "Verification"),
        gate,
        resolvedGate: gate && /node default/i.test(gate) ? node.defaultGate : gate,
        consumes: refsOf(value(pf, "Consumes")),
        produces: refsOf(value(pf, "Produces")),
        governedBy: adrRefs(value(pf, "Governed by") ?? ""),
        dependsOn,
        collidesWith: coll.ids.filter((x) => x !== pid),
        contingentOn,
        citesOq: oqRefs(blockText),
        inTable: row !== null,
        sourceFile: file,
        line: h.line + 1,
      });
      node.phases.push(pid);
    }
    if (table) {
      for (const [n, r] of rowByN) {
        if (!node.phases.includes(`${id}.${n}`)) node.tableOnly = [...(node.tableOnly ?? []), { id: `${id}.${n}`, line: r.line + 1 }];
      }
    }
  }

  const contracts = [];
  for (const f of listMd(join(hsdd, "contract"))) {
    const file = `hsdd/contract/${f}`;
    const text = readFileSync(join(hsdd, "contract", f), "utf8");
    const fm = splitFrontmatter(text);
    const i = contracts.length;
    const d = fm.data ?? {};
    if (!fm.data) unparsed.push({ path: `/contracts/${i}`, file, line: 1, reason: fm.error ?? "no frontmatter" });
    const ls = toLines(text);
    const iface = sectionText(ls, "interface");
    const guar = sectionText(ls, "guarantees");
    const ref = `${d.id ?? f.slice(0, -3)}@${d.version ?? "v?"}`;
    facts[`promise:${ref}`] = sha(`${iface}\n${guar}`);
    contracts.push({
      ref,
      id: d.id ?? f.slice(0, -3),
      version: d.version ?? null,
      status: d.status ?? null,
      kind: d.kind ?? null,
      owner: d.owner ?? null,
      producedBy: Array.isArray(d.produced_by) ? d.produced_by : [],
      consumers: Array.isArray(d.consumers) ? d.consumers : [],
      phaseIds: d.phase_ids ?? null,
      external: String(d.owner ?? "").startsWith("ext:"),
      guarantees: bullets(guar),
      sourceFile: file,
    });
  }

  const adrs = [];
  for (const f of listMd(join(hsdd, "adr"))) {
    const file = `hsdd/adr/${f}`;
    const text = readFileSync(join(hsdd, "adr", f), "utf8");
    const fm = splitFrontmatter(text);
    const ls = toLines(text);
    const h1 = headings(ls).find((h) => h.level === 1);
    const d = fm.data ?? {};
    if (!fm.data) unparsed.push({ path: `/adrs/${adrs.length}`, file, line: 1, reason: fm.error ?? "no frontmatter" });
    adrs.push({
      id: adrRefs(d.id ?? f)[0] ?? null,
      title: h1 ? plain(h1.text).replace(/^ADR-\d+\s*:\s*/, "") : f,
      status: d.status ?? null,
      affects: Array.isArray(d.affects) ? d.affects : [],
      decision: firstSentence(sectionText(ls, "decision")),
      sourceFile: file,
    });
  }

  const contractRefsAll = new Set(contracts.map((c) => c.ref));
  for (const x of [...nodes, ...phases]) for (const r of [...x.consumes, ...x.produces]) contractRefsAll.add(r.ref);
  const oqIds = nodes.flatMap((n) => n.openQuestions.map((q) => q.id));
  const ids = [...new Set([
    ...nodes.map((n) => n.id), ...phases.map((p) => p.id), ...phases.map((p) => p.heading),
    ...contractRefsAll, ...adrs.map((a) => a.id).filter(Boolean), ...oqIds,
  ])];

  return {
    kind: "plan",
    schemaVersion: 1,
    project: { root: rootId, name: nodes.find((n) => n.id === rootId)?.name ?? rootId, specSha, codingMethod: codingMethod(conventions) },
    nodes,
    phases,
    contracts,
    adrs,
    ids,
    facts,
    unparsed,
  };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `node --test test/md.test.mjs test/extract-plan.test.mjs`
Expected: PASS, 33 tests.

- [ ] **Step 7: Commit**

```bash
git add test/fixtures/tree test/helpers/plan-fixture.mjs test/extract-plan.test.mjs skills/hsdd-summary/scripts/extract-plan.mjs
git commit -m "feat(hsdd-summary): extract the plan model from a tree, listing what it cannot parse

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: The model schema, its validator, and the cross-checks

**Files:**
- Create: `skills/hsdd-summary/scripts/schema.mjs`, `skills/hsdd-summary/scripts/plan-model.schema.json`, `skills/hsdd-summary/scripts/checks-plan.mjs`
- Test: `test/checks-plan.test.mjs`

**Interfaces:**
- Consumes: `extractPlan`, `TREE`, `completedModel`.
- Produces: `validate(schema, value) -> string[]` (empty when valid; throws on an unsupported keyword; supports `type`, `enum`, `const`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `pattern`, `minLength`, `minimum`, `$ref`); `crossCheckPlan(model) -> { errors: string[], findings: [{ node, kind, message, phase?, ref?, adr?, oq?, other? }] }`; `reaches(depsMap, from, to)`. Finding kinds: `table-only`, `not-in-table`, `pending-governance`, `unwritten-contract`, `version-mismatch` (node fields only), `provisional-contract`, `adr-missing`, `adr-proposed`, `oq-duplicate`, `oq-no-detail`, `oq-undefined`, `contingent`, `collision`, `collision-ordered`.

- [ ] **Step 1: Write the failing test**

Create `test/checks-plan.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TREE, completedModel } from "./helpers/plan-fixture.mjs";
import { extractPlan } from "../skills/hsdd-summary/scripts/extract-plan.mjs";
import { crossCheckPlan, reaches } from "../skills/hsdd-summary/scripts/checks-plan.mjs";
import { validate } from "../skills/hsdd-summary/scripts/schema.mjs";

const SCHEMA = JSON.parse(readFileSync(new URL("../skills/hsdd-summary/scripts/plan-model.schema.json", import.meta.url), "utf8"));

test("schema: the raw extraction fails only where unparsed items are", () => {
  const raw = extractPlan(TREE, { specSha: "abc1234" });
  assert.deepEqual(validate(SCHEMA, raw), ['/phases/4/tier: null is not one of "gate-only", "spot-check", "full-review"']);
});

test("schema: the completed model is valid", () => {
  assert.deepEqual(validate(SCHEMA, completedModel()), []);
});

test("schema validator: types, required, additionalProperties, pattern, $ref", () => {
  const s = { type: "object", required: ["a"], additionalProperties: false, properties: { a: { $ref: "#/$defs/x" } }, $defs: { x: { type: "string", pattern: "^v\\d$" } } };
  assert.deepEqual(validate(s, { a: "v1" }), []);
  assert.deepEqual(validate(s, { a: "x", b: 1 }), ['/a: "x" does not match ^v\\d$', '/: unexpected property "b"']);
  assert.deepEqual(validate(s, {}), ['/: missing required "a"']);
  assert.throws(() => validate({ oneOf: [] }, 1), /not supported/);
});

test("errors: unparsed items stop the run", () => {
  const { errors } = crossCheckPlan(extractPlan(TREE, { specSha: "abc1234" }));
  assert.match(errors[0], /^2 unparsed item\(s\) remain; first: \/phases\/4\/tier/);
});

test("errors: unknown dependency and cycles", () => {
  const m = completedModel();
  m.phases[0].dependsOn = ["acme.api.3"];
  m.phases[1].dependsOn = ["acme.api.1", "acme.api.9"];
  const { errors } = crossCheckPlan(m);
  assert.ok(errors.includes("phase acme.api.2 names acme.api.9, which is not a phase"));
  assert.ok(errors.some((e) => /cycle: acme\.api\.1 -> acme\.api\.3 -> acme\.api\.2 -> acme\.api\.1/.test(e)));
});

test("findings on the fixture tree", () => {
  const { errors, findings } = crossCheckPlan(completedModel());
  assert.deepEqual(errors, []);
  const got = findings.map((f) => `${f.node} ${f.kind} ${f.message}`);
  for (const line of [
    "acme.api pending-governance governance updates are waiting for reconcile",
    "acme.web.console not-in-table acme.web.console.3 has a phase section but no summary-table row",
    "acme.web unwritten-contract outlet-api@v1 is named, not yet written",
    "acme.web.console version-mismatch session@v1 is cited; the contract file is at v2",
    "acme.api provisional-contract session@v2 is provisional: reconcile has not confirmed its phase ids",
    "acme.web.console adr-missing ADR-003 is cited, but no ADR file exists",
    "acme.api adr-proposed ADR-002 is proposed: not binding until accepted",
    "acme.api contingent acme.api.3 is contingent on OQ1 (OPEN)",
    "acme.api collision-ordered acme.api.2 and acme.api.3 edit the same files; a dependency already orders them",
  ]) assert.ok(got.includes(line), line);
  assert.ok(!got.some((l) => /user-store@v1 is named/.test(l)), "an external contract with a file is not unwritten");
});

test("reaches follows dependency chains", () => {
  const deps = new Map([["a", ["b"]], ["b", ["c"]], ["c", []]]);
  assert.equal(reaches(deps, "a", "c"), true);
  assert.equal(reaches(deps, "c", "a"), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/checks-plan.test.mjs`
Expected: FAIL with `ENOENT` for `plan-model.schema.json`.

- [ ] **Step 3: Implement the validator**

Create `skills/hsdd-summary/scripts/schema.mjs`:

```js
// A JSON Schema validator for the keywords hsdd-summary's schemas use:
// type, enum, const, required, properties, additionalProperties (boolean or
// schema), items, minItems, pattern, minLength, minimum, $ref to "#/$defs/...".
// Returns a list of "path: message" strings; empty means valid.

const TYPES = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

const KNOWN = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "type", "enum", "const",
  "required", "properties", "additionalProperties", "items", "minItems", "pattern", "minLength", "minimum",
]);

export function validate(schema, value) {
  const errors = [];
  walk(schema, value, "", schema, errors);
  return errors;
}

function walk(s, v, path, root, errors) {
  for (const k of Object.keys(s)) if (!KNOWN.has(k)) throw new Error(`schema keyword "${k}" at ${path || "/"} is not supported`);
  if (s.$ref) {
    const m = /^#\/\$defs\/(.+)$/.exec(s.$ref);
    if (!m || !root.$defs?.[m[1]]) throw new Error(`unresolvable $ref ${s.$ref}`);
    return walk(root.$defs[m[1]], v, path, root, errors);
  }
  const at = path || "/";
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => TYPES[t](v))) {
      errors.push(`${at}: expected ${types.join(" or ")}, got ${v === null ? "null" : Array.isArray(v) ? "array" : typeof v}`);
      return;
    }
  }
  if ("const" in s && v !== s.const) errors.push(`${at}: must be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(v)) errors.push(`${at}: ${JSON.stringify(v)} is not one of ${s.enum.map((x) => JSON.stringify(x)).join(", ")}`);
  if (typeof v === "string") {
    if (s.pattern && !new RegExp(s.pattern).test(v)) errors.push(`${at}: ${JSON.stringify(v)} does not match ${s.pattern}`);
    if (s.minLength !== undefined && v.length < s.minLength) errors.push(`${at}: shorter than ${s.minLength}`);
  }
  if (typeof v === "number" && s.minimum !== undefined && v < s.minimum) errors.push(`${at}: below ${s.minimum}`);
  if (TYPES.object(v)) {
    for (const r of s.required ?? []) if (!(r in v)) errors.push(`${at}: missing required "${r}"`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in v) walk(sub, v[k], `${path}/${k}`, root, errors);
    if (s.additionalProperties !== undefined && s.additionalProperties !== true) {
      for (const k of Object.keys(v)) {
        if (s.properties && k in s.properties) continue;
        if (s.additionalProperties === false) errors.push(`${at}: unexpected property "${k}"`);
        else walk(s.additionalProperties, v[k], `${path}/${k}`, root, errors);
      }
    }
  }
  if (Array.isArray(v) && s.minItems !== undefined && v.length < s.minItems) errors.push(`${at}: fewer than ${s.minItems} item(s)`);
  if (Array.isArray(v) && s.items) v.forEach((x, i) => walk(s.items, x, `${path}/${i}`, root, errors));
}
```

- [ ] **Step 4: Write the schema**

Create `skills/hsdd-summary/scripts/plan-model.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "hsdd-summary/plan-model",
  "title": "hsdd-summary plan model",
  "description": "What extract plan writes and the agent completes. Every field comes from an artifact under hsdd/; nothing here is authored.",
  "type": "object",
  "required": ["kind", "schemaVersion", "project", "nodes", "phases", "contracts", "adrs", "ids", "facts", "unparsed"],
  "additionalProperties": false,
  "properties": {
    "kind": { "const": "plan" },
    "schemaVersion": { "const": 1 },
    "project": {
      "type": "object",
      "required": ["root", "name", "specSha", "codingMethod"],
      "additionalProperties": false,
      "properties": {
        "root": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "specSha": { "type": "string" },
        "codingMethod": { "enum": ["openspec", "superpowers"] }
      }
    },
    "nodes": { "type": "array", "items": { "$ref": "#/$defs/node" } },
    "phases": { "type": "array", "items": { "$ref": "#/$defs/phase" } },
    "contracts": { "type": "array", "items": { "$ref": "#/$defs/contract" } },
    "adrs": { "type": "array", "items": { "$ref": "#/$defs/adr" } },
    "ids": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "facts": { "type": "object", "additionalProperties": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" } },
    "unparsed": { "type": "array", "items": { "$ref": "#/$defs/unparsed" } }
  },
  "$defs": {
    "ref": {
      "type": "object",
      "required": ["ref", "ext"],
      "additionalProperties": false,
      "properties": {
        "ref": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9-]*@v\\d+$" },
        "ext": { "type": "boolean" }
      }
    },
    "refs": { "type": "array", "items": { "$ref": "#/$defs/ref" } },
    "text": { "type": ["string", "null"] },
    "oq": {
      "type": "object",
      "required": ["id", "question", "status", "waitsOn", "affects", "hasDetail"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^OQ-?[A-Z]*\\d+$" },
        "question": { "type": "string" },
        "status": { "type": "string" },
        "waitsOn": { "type": "string" },
        "affects": { "type": "string" },
        "hasDetail": { "type": "boolean" }
      }
    },
    "node": {
      "type": "object",
      "required": ["id", "name", "parent", "kind", "status", "adopted", "team", "purpose", "owns", "doesNotOwn", "isolation", "consumes", "produces", "governedBy", "children", "phases", "defaultGate", "openQuestions", "pendingGovernance", "observedSurface", "sourceFile"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^[A-Za-z0-9][\\w.-]*$" },
        "name": { "type": "string", "minLength": 1 },
        "parent": { "type": ["string", "null"] },
        "kind": { "enum": ["root", "internal", "leaf-parent", "integration"] },
        "status": { "enum": ["active", "retired"] },
        "adopted": { "enum": [null, "as-built", "promoted"] },
        "team": { "$ref": "#/$defs/text" },
        "purpose": { "$ref": "#/$defs/text" },
        "owns": { "$ref": "#/$defs/text" },
        "doesNotOwn": { "$ref": "#/$defs/text" },
        "isolation": { "$ref": "#/$defs/text" },
        "consumes": { "$ref": "#/$defs/refs" },
        "produces": { "$ref": "#/$defs/refs" },
        "governedBy": { "type": "array", "items": { "type": "string", "pattern": "^ADR-\\d{3,}$" } },
        "children": { "type": "array", "items": { "type": "string" } },
        "phases": { "type": "array", "items": { "type": "string" } },
        "defaultGate": { "$ref": "#/$defs/text" },
        "openQuestions": { "type": "array", "items": { "$ref": "#/$defs/oq" } },
        "pendingGovernance": { "type": "boolean" },
        "observedSurface": { "type": "boolean" },
        "sourceFile": { "type": "string", "pattern": "^hsdd/spec/.+\\.md$" },
        "tableOnly": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "line"],
            "additionalProperties": false,
            "properties": { "id": { "type": "string" }, "line": { "type": "integer", "minimum": 1 } }
          }
        }
      }
    },
    "phase": {
      "type": "object",
      "required": ["id", "node", "heading", "n", "name", "tier", "size", "taskCap", "scope", "verification", "gate", "resolvedGate", "consumes", "produces", "governedBy", "dependsOn", "collidesWith", "contingentOn", "citesOq", "inTable", "sourceFile", "line"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^[A-Za-z0-9][\\w.-]*\\.\\d+$" },
        "node": { "type": "string" },
        "heading": { "type": "string" },
        "n": { "type": "integer", "minimum": 0 },
        "name": { "type": "string", "minLength": 1 },
        "tier": { "enum": ["gate-only", "spot-check", "full-review"] },
        "size": { "$ref": "#/$defs/text" },
        "taskCap": { "type": ["integer", "null"] },
        "scope": { "$ref": "#/$defs/text" },
        "verification": { "$ref": "#/$defs/text" },
        "gate": { "$ref": "#/$defs/text" },
        "resolvedGate": { "$ref": "#/$defs/text" },
        "consumes": { "$ref": "#/$defs/refs" },
        "produces": { "$ref": "#/$defs/refs" },
        "governedBy": { "type": "array", "items": { "type": "string", "pattern": "^ADR-\\d{3,}$" } },
        "dependsOn": { "type": "array", "items": { "type": "string" } },
        "collidesWith": { "type": "array", "items": { "type": "string" } },
        "contingentOn": { "type": "array", "items": { "type": "string" } },
        "citesOq": { "type": "array", "items": { "type": "string" } },
        "inTable": { "type": "boolean" },
        "sourceFile": { "type": "string", "pattern": "^hsdd/spec/.+\\.md$" },
        "line": { "type": "integer", "minimum": 1 }
      }
    },
    "contract": {
      "type": "object",
      "required": ["ref", "id", "version", "status", "kind", "owner", "producedBy", "consumers", "phaseIds", "external", "guarantees", "sourceFile"],
      "additionalProperties": false,
      "properties": {
        "ref": { "type": "string" },
        "id": { "type": "string", "minLength": 1 },
        "version": { "type": ["string", "null"] },
        "status": { "type": ["string", "null"] },
        "kind": { "type": ["string", "null"] },
        "owner": { "type": ["string", "null"] },
        "producedBy": { "type": "array", "items": { "type": "string" } },
        "consumers": { "type": "array", "items": { "type": "string" } },
        "phaseIds": { "type": ["string", "null"] },
        "external": { "type": "boolean" },
        "guarantees": { "type": "array", "items": { "type": "string" } },
        "sourceFile": { "type": "string", "pattern": "^hsdd/contract/.+\\.md$" }
      }
    },
    "adr": {
      "type": "object",
      "required": ["id", "title", "status", "affects", "decision", "sourceFile"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^ADR-\\d{3,}$" },
        "title": { "type": "string" },
        "status": { "type": ["string", "null"] },
        "affects": { "type": "array", "items": { "type": "string" } },
        "decision": { "type": "string" },
        "sourceFile": { "type": "string", "pattern": "^hsdd/adr/.+\\.md$" }
      }
    },
    "unparsed": {
      "type": "object",
      "required": ["path", "file", "line", "reason"],
      "additionalProperties": false,
      "properties": {
        "path": { "type": "string", "pattern": "^/" },
        "file": { "type": "string" },
        "line": { "type": "integer", "minimum": 1 },
        "reason": { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 5: Implement the cross-checks**

Create `skills/hsdd-summary/scripts/checks-plan.mjs`:

```js
// Cross-checks over a plan model. Errors mean the extraction is wrong and stop
// render; findings are facts about the tree and appear on the page.

export function reaches(deps, from, to) {
  const seen = new Set();
  const stack = [...(deps.get(from) ?? [])];
  while (stack.length) {
    const x = stack.pop();
    if (x === to) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(deps.get(x) ?? []));
  }
  return false;
}

function findCycle(ids, deps) {
  const state = new Map();
  const path = [];
  const visit = (id) => {
    state.set(id, 1);
    path.push(id);
    for (const d of deps.get(id) ?? []) {
      if (state.get(d) === 1) return [...path.slice(path.indexOf(d)), d];
      if (!state.has(d)) {
        const c = visit(d);
        if (c) return c;
      }
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of ids) if (!state.has(id)) {
    const c = visit(id);
    if (c) return c;
  }
  return null;
}

export function crossCheckPlan(model) {
  const errors = [];
  const findings = [];
  const add = (node, kind, message, extra = {}) => findings.push({ node, kind, message, ...extra });

  if (model.unparsed.length) {
    const u = model.unparsed[0];
    errors.push(`${model.unparsed.length} unparsed item(s) remain; first: ${u.path} (${u.file}:${u.line}) ${u.reason}`);
  }
  const nodeIds = new Set();
  for (const n of model.nodes) {
    if (nodeIds.has(n.id)) errors.push(`node ${n.id} appears twice`);
    nodeIds.add(n.id);
  }
  for (const n of model.nodes) if (n.parent !== null && !nodeIds.has(n.parent)) errors.push(`node ${n.id} names parent ${n.parent}, which is not a node`);

  const phaseIds = new Set();
  for (const p of model.phases) {
    if (phaseIds.has(p.id)) errors.push(`phase ${p.id} appears twice`);
    phaseIds.add(p.id);
  }
  const tableOnly = new Set(model.nodes.flatMap((n) => (n.tableOnly ?? []).map((t) => t.id)));
  const deps = new Map(model.phases.map((p) => [p.id, p.dependsOn]));
  for (const p of model.phases) {
    for (const d of [...p.dependsOn, ...p.collidesWith]) {
      if (!phaseIds.has(d) && !tableOnly.has(d)) errors.push(`phase ${p.id} names ${d}, which is not a phase`);
    }
  }
  const cycle = findCycle(model.phases.map((p) => p.id), deps);
  if (cycle) errors.push(`phase dependencies form a cycle: ${cycle.join(" -> ")}`);

  for (const n of model.nodes) {
    for (const t of n.tableOnly ?? []) add(n.id, "table-only", `the summary table lists ${t.id}, but no phase section exists`, { phase: t.id });
    if (n.pendingGovernance) add(n.id, "pending-governance", "governance updates are waiting for reconcile");
  }
  for (const p of model.phases) if (!p.inTable) add(p.node, "not-in-table", `${p.id} has a phase section but no summary-table row`, { phase: p.id });

  const byId = new Map(model.contracts.map((c) => [c.id, c]));
  const seenRef = new Set();
  // Version drift is checked on node fields only: a phase cites the version it
  // was planned against, and a finished phase citing an older one is history.
  const citing = [...model.nodes.map((n) => ({ node: n.id, refs: [...n.consumes, ...n.produces], current: true })), ...model.phases.map((p) => ({ node: p.node, refs: [...p.consumes, ...p.produces], current: false }))];
  for (const { node, refs, current } of citing) {
    for (const r of refs) {
      const key = `${node}|${r.ref}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      const [cid, ver] = r.ref.split("@");
      const c = byId.get(cid);
      if (!c && !r.ext) add(node, "unwritten-contract", `${r.ref} is named, not yet written`, { ref: r.ref });
      else if (current && c && c.version && c.version !== ver) add(node, "version-mismatch", `${r.ref} is cited; the contract file is at ${c.version}`, { ref: r.ref });
    }
  }
  for (const c of model.contracts) {
    if (c.phaseIds === "provisional") add(nodeIds.has(c.owner) ? c.owner : model.project.root, "provisional-contract", `${c.ref} is provisional: reconcile has not confirmed its phase ids`, { ref: c.ref });
  }

  const adrs = new Map(model.adrs.map((a) => [a.id, a]));
  const seenAdr = new Set();
  for (const x of [...model.nodes.map((n) => ({ node: n.id, ids: n.governedBy })), ...model.phases.map((p) => ({ node: p.node, ids: p.governedBy }))]) {
    for (const id of x.ids) {
      const key = `${x.node}|${id}`;
      if (seenAdr.has(key)) continue;
      seenAdr.add(key);
      const a = adrs.get(id);
      if (!a) add(x.node, "adr-missing", `${id} is cited, but no ADR file exists`, { adr: id });
      else if (a.status === "proposed") add(x.node, "adr-proposed", `${id} is proposed: not binding until accepted`, { adr: id });
    }
  }

  const oqHome = new Map();
  for (const n of model.nodes) for (const q of n.openQuestions) {
    if (oqHome.has(q.id)) add(n.id, "oq-duplicate", `${q.id} is defined here and in ${oqHome.get(q.id).node}`, { oq: q.id });
    else oqHome.set(q.id, { node: n.id, q });
    if (!q.hasDetail) add(n.id, "oq-no-detail", `${q.id} has a table row but no detail subsection`, { oq: q.id });
  }
  for (const p of model.phases) {
    for (const id of p.citesOq) if (!oqHome.has(id)) add(p.node, "oq-undefined", `${p.id} cites ${id}, which no spec defines`, { phase: p.id, oq: id });
    for (const id of p.contingentOn) {
      const home = oqHome.get(id);
      if (home && home.q.status !== "RESOLVED") add(p.node, "contingent", `${p.id} is contingent on ${id} (${home.q.status})`, { phase: p.id, oq: id });
    }
  }

  const seenPair = new Set();
  for (const p of model.phases) for (const o of p.collidesWith) {
    const pair = [p.id, o].sort().join("|");
    if (seenPair.has(pair) || !phaseIds.has(o)) continue;
    seenPair.add(pair);
    const ordered = reaches(deps, p.id, o) || reaches(deps, o, p.id);
    add(p.node, ordered ? "collision-ordered" : "collision", ordered ? `${p.id} and ${o} edit the same files; a dependency already orders them` : `${p.id} and ${o} edit the same files and nothing orders them`, { phase: p.id, other: o });
  }
  return { errors, findings };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `node --test test/checks-plan.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add skills/hsdd-summary/scripts/schema.mjs skills/hsdd-summary/scripts/plan-model.schema.json skills/hsdd-summary/scripts/checks-plan.mjs test/checks-plan.test.mjs
git commit -m "feat(hsdd-summary): plan model schema, its validator, and cross-checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: The prose store and the input stamps

**Files:**
- Create: `skills/hsdd-summary/scripts/prose.mjs`, `skills/hsdd-summary/scripts/stamp.mjs`
- Test: `test/prose-stamp.test.mjs`

**Interfaces:**
- Consumes: `words` (Task 1), `listMd` (Task 2).
- Produces: `planSlots(model) -> [{ key, limit, required, noIds, facts }]` with keys `explain:{node}`, `note:{node}:{audience}`, `delivers:{phase}`, `promise:{contract ref}`; `planGlossaryKeys(model) -> contract ids`; `emptyStore()`; `seed(store, glossary, slots, glossKeys) -> { store, glossary }`; `proseStatus(store, glossary, slots, glossKeys, kind = "plan") -> { emptyRequired, emptyOptional, stale, unstamped, orphaned, glossEmpty, glossOrphaned }` (orphans are counted only among the kind's own keys; `cp:` keys belong to the checkpoint page); `slotKind(key)`; `stampProse(store, slots) -> { store, restamped }`; `lintProse(store, glossary, slots, glossKeys, ids) -> [{ key, rule, message }]`; `namesId(text, ids)`; `textHash`; `AUDIENCES`; `GLOSS_LIMIT`. From `stamp.mjs`: `planInputs(root) -> paths`; `hashInputs(root, paths) -> { path: hash }`; `diffInputs(stamped, current) -> { changed, added, removed, fresh }`; `safeJson(value)`; `readPageStamp(html)`; `fileHash(path)`.
- Store files: `hsdd/summary/prose.json` is `{ "version": 1, "entries": { key: { "text", "facts", "textHash" } } }`; `hsdd/summary/glossary.json` is `{ "version": 1, "entries": { contractId: phrase } }`.

- [ ] **Step 1: Write the failing test**

Create `test/prose-stamp.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPlan } from "../skills/hsdd-summary/scripts/extract-plan.mjs";
import {
  planSlots, planGlossaryKeys, emptyStore, seed, proseStatus, stampProse, lintProse, namesId, textHash,
} from "../skills/hsdd-summary/scripts/prose.mjs";
import { planInputs, hashInputs, diffInputs, safeJson, readPageStamp } from "../skills/hsdd-summary/scripts/stamp.mjs";

const TREE = fileURLToPath(new URL("./fixtures/tree", import.meta.url));
const model = extractPlan(TREE);
const slots = planSlots(model);
const gk = planGlossaryKeys(model);

test("slots: explain required for active nodes only; notes per audience", () => {
  const keys = slots.map((s) => s.key);
  assert.ok(keys.includes("explain:acme.api"));
  assert.ok(!keys.includes("explain:acme.legacy"), "retired nodes get no slots");
  assert.ok(keys.includes("note:acme.api:stakeholder"));
  assert.equal(slots.find((s) => s.key === "note:acme.api:stakeholder").noIds, true);
  assert.equal(slots.find((s) => s.key === "note:acme.api:reviewer").noIds, false);
  assert.ok(keys.includes("delivers:acme.api.2"));
  assert.ok(keys.includes("promise:auth-token@v1"));
  assert.equal(slots.filter((s) => s.required).length, 5);
});

test("glossary keys: contract ids without versions, written or only named", () => {
  assert.deepEqual(gk, ["auth-token", "outlet-api", "session", "user-store"]);
});

test("seed adds missing entries and never touches existing text", () => {
  const store = { version: 1, entries: { "explain:acme.api": { text: "Kept.", facts: "x", textHash: "y" }, "explain:gone": { text: "Old.", facts: null, textHash: null } } };
  const { store: s, glossary: g } = seed(store, { version: 1, entries: { session: "the session record" } }, slots, gk);
  assert.equal(s.entries["explain:acme.api"].text, "Kept.");
  assert.equal(s.entries["explain:acme"].text, "");
  assert.equal(g.entries.session, "the session record");
  assert.equal(g.entries["auth-token"], "");
  const st = proseStatus(s, g, slots, gk);
  assert.deepEqual(st.orphaned, ["explain:gone"]);
  assert.ok(st.emptyRequired.includes("explain:acme"));
  assert.deepEqual(st.unstamped, ["explain:acme.api"]);
  assert.equal(st.glossEmpty.length, gk.length - 1);
});

test("stamp restamps only rewritten entries; a changed subject makes an entry stale", () => {
  let { store } = seed(emptyStore(), { version: 1, entries: {} }, slots, gk);
  store.entries["explain:acme.api"].text = "Hands out the sign-in passes the web app checks.";
  const first = stampProse(store, slots);
  assert.deepEqual(first.restamped, ["explain:acme.api"]);
  assert.deepEqual(stampProse(first.store, slots).restamped, []);
  const moved = slots.map((s) => (s.key === "explain:acme.api" ? { ...s, facts: "sha256:" + "0".repeat(64) } : s));
  assert.deepEqual(proseStatus(first.store, { version: 1, entries: {} }, moved, []).stale, ["explain:acme.api"]);
  assert.equal(first.store.entries["explain:acme.api"].textHash, textHash("Hands out the sign-in passes the web app checks."));
});

test("lint: length, ids in id-free slots, markdown, glossary", () => {
  const store = { version: 1, entries: {
    "explain:acme.api": { text: "Uses auth-token@v1 to sign in.", facts: null, textHash: null },
    "explain:acme.web": { text: "word ".repeat(26).trim(), facts: null, textHash: null },
    "note:acme.api:reviewer": { text: "Review acme.api.2 first.", facts: null, textHash: null },
    "explain:acme.ops": { text: "The `deploy` scripts.", facts: null, textHash: null },
  } };
  const glossary = { version: 1, entries: { "auth-token": "the acme.api pass" } };
  const f = lintProse(store, glossary, slots, gk, model.ids).map((x) => `${x.key} ${x.rule}`);
  assert.deepEqual(f.sort(), ["explain:acme.api id", "explain:acme.ops markdown", "explain:acme.web length", "gloss:auth-token id"].sort());
});

test("namesId respects boundaries and sentence punctuation", () => {
  const ids = ["acme.api", "api.2", "acme"];
  assert.equal(namesId("See acme.api.", ids), "acme.api");
  assert.equal(namesId("The Acme platform", ids), null);
  assert.equal(namesId("rapi.2x", ids), null);
});

test("input stamps: list, hash, diff", () => {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-stamp-"));
  cpSync(TREE, dir, { recursive: true });
  const paths = planInputs(dir);
  assert.ok(paths.includes("hsdd/spec/acme.api.md"));
  assert.ok(!paths.some((p) => p.endsWith("INDEX.md")));
  const before = hashInputs(dir, paths);
  writeFileSync(join(dir, "hsdd/spec/acme.ops.md"), "# changed\n");
  writeFileSync(join(dir, "hsdd/adr/003-new.md"), "---\nid: ADR-003\n---\n");
  const after = hashInputs(dir, planInputs(dir));
  assert.deepEqual(diffInputs(before, after), { changed: ["hsdd/spec/acme.ops.md"], added: ["hsdd/adr/003-new.md"], removed: [], fresh: false });
  assert.equal(diffInputs(after, after).fresh, true);
});

test("safeJson survives a hostile string and reads back exactly", () => {
  const v = { s: "</script><script>alert(1)</script> & \u2028" };
  const j = safeJson(v);
  assert.ok(!/[<>&\u2028]/.test(j));
  assert.deepEqual(JSON.parse(j), v);
  const html = `<script type="application/json" id="hsdd-stamp">${safeJson({ kind: "plan", inputs: { a: "b" } })}</script>`;
  assert.deepEqual(readPageStamp(html), { kind: "plan", inputs: { a: "b" } });
  assert.equal(readPageStamp("<p>no stamp</p>"), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/prose-stamp.test.mjs`
Expected: FAIL with `Cannot find module` for `prose.mjs`.

- [ ] **Step 3: Implement the prose store**

Create `skills/hsdd-summary/scripts/prose.mjs`:

```js
// The prose store and glossary: which slots exist, which are empty, stale or
// unstamped, and the lint every written slot must pass. Pure functions.
import { createHash } from "node:crypto";
import { words } from "./md.mjs";

export const AUDIENCES = { plan: ["reviewer", "stakeholder", "implementer"], checkpoint: ["lead", "executor", "stakeholder"] };
export const GLOSS_LIMIT = 8;

export function textHash(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

// One slot per piece of prose a page can show: key, word limit, whether the
// page refuses to render without it, whether ids are forbidden in it, and
// the facts hash that makes it stale when its subject changes.
export function planSlots(model) {
  const slots = [];
  const active = model.nodes.filter((n) => n.status === "active");
  for (const n of active) {
    const facts = model.facts[`explain:${n.id}`];
    slots.push({ key: `explain:${n.id}`, limit: 25, required: true, noIds: true, facts });
    for (const a of AUDIENCES.plan) slots.push({ key: `note:${n.id}:${a}`, limit: 40, required: false, noIds: a === "stakeholder", facts });
  }
  const activeIds = new Set(active.map((n) => n.id));
  for (const p of model.phases) if (activeIds.has(p.node)) slots.push({ key: `delivers:${p.id}`, limit: 25, required: false, noIds: false, facts: model.facts[`delivers:${p.id}`] });
  for (const c of model.contracts) slots.push({ key: `promise:${c.ref}`, limit: 40, required: false, noIds: true, facts: model.facts[`promise:${c.ref}`] });
  return slots;
}

// Glossary keys: every contract id (not version) the active tree names. The
// stakeholder reads these plain phrases instead of contract ids; nodes are
// shown by their names, which are not ids.
export function planGlossaryKeys(model) {
  const active = model.nodes.filter((n) => n.status === "active");
  const activeIds = new Set(active.map((n) => n.id));
  const contracts = new Set(model.contracts.map((c) => c.id));
  for (const x of [...active, ...model.phases.filter((p) => activeIds.has(p.node))]) {
    for (const r of [...x.consumes, ...x.produces]) contracts.add(r.ref.split("@")[0]);
  }
  return [...contracts].sort();
}

export function slotKind(key) {
  return key.startsWith("cp:") ? "checkpoint" : "plan";
}

export function emptyStore() {
  return { version: 1, entries: {} };
}

// Add missing slots and glossary keys; never change or drop existing text.
export function seed(store, glossary, slots, glossKeys) {
  const s = structuredClone(store);
  const g = structuredClone(glossary);
  for (const slot of slots) if (!(slot.key in s.entries)) s.entries[slot.key] = { text: "", facts: null, textHash: null };
  for (const k of glossKeys) if (!(k in g.entries)) g.entries[k] = "";
  return { store: s, glossary: g };
}

// `kind` limits orphan detection to that page's slots ("cp:" keys belong to
// the checkpoint page); each page keeps its own store file.
export function proseStatus(store, glossary, slots, glossKeys, kind = "plan") {
  const keys = new Set(slots.map((s) => s.key));
  const out = { emptyRequired: [], emptyOptional: [], stale: [], unstamped: [], orphaned: [], glossEmpty: [], glossOrphaned: [] };
  for (const slot of slots) {
    const e = store.entries[slot.key];
    if (!e || !e.text.trim()) {
      (slot.required ? out.emptyRequired : out.emptyOptional).push(slot.key);
      continue;
    }
    if (e.textHash !== textHash(e.text) || e.facts === null) out.unstamped.push(slot.key);
    else if (e.facts !== slot.facts) out.stale.push(slot.key);
  }
  for (const k of Object.keys(store.entries)) if (slotKind(k) === kind && !keys.has(k)) out.orphaned.push(k);
  const gk = new Set(glossKeys);
  for (const k of glossKeys) if (!String(glossary.entries[k] ?? "").trim()) out.glossEmpty.push(k);
  if (kind === "plan") for (const k of Object.keys(glossary.entries)) if (!gk.has(k)) out.glossOrphaned.push(k);
  return out;
}

// Restamp only the entries whose text changed since they were last stamped.
export function stampProse(store, slots) {
  const s = structuredClone(store);
  const restamped = [];
  for (const slot of slots) {
    const e = s.entries[slot.key];
    if (!e || !e.text.trim()) continue;
    if (e.textHash !== textHash(e.text) || e.facts === null) {
      e.facts = slot.facts;
      e.textHash = textHash(e.text);
      restamped.push(slot.key);
    }
  }
  return { store: s, restamped };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function namesId(text, ids) {
  return ids.find((id) => new RegExp(`(^|[^\\w.@-])${escapeRe(id)}($|[^\\w@-])`).test(text)) ?? null;
}

export function lintProse(store, glossary, slots, glossKeys, ids) {
  const findings = [];
  for (const slot of slots) {
    const text = store.entries[slot.key]?.text ?? "";
    if (!text.trim()) continue;
    const n = words(text);
    if (n > slot.limit) findings.push({ key: slot.key, rule: "length", message: `${n} words; the limit is ${slot.limit}` });
    if (slot.noIds) {
      const id = namesId(text, ids);
      if (id) findings.push({ key: slot.key, rule: "id", message: `names ${id}; say what it is instead` });
    }
    if (/[`*_#[\]]/.test(text)) findings.push({ key: slot.key, rule: "markdown", message: "uses markdown; write plain text" });
  }
  for (const k of glossKeys) {
    const text = String(glossary.entries[k] ?? "");
    if (!text.trim()) continue;
    if (words(text) > GLOSS_LIMIT) findings.push({ key: `gloss:${k}`, rule: "length", message: `${words(text)} words; the limit is ${GLOSS_LIMIT}` });
    const id = namesId(text, ids);
    if (id) findings.push({ key: `gloss:${k}`, rule: "id", message: `names ${id}; a gloss is plain words` });
  }
  return findings;
}
```

- [ ] **Step 4: Implement the stamps**

Create `skills/hsdd-summary/scripts/stamp.mjs`:

```js
// Input stamps: which files a page was built from, and whether they changed.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { listMd } from "./extract-plan.mjs";

export function fileHash(path) {
  return "sha256:" + createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Every file the plan page reads, relative to the project root, sorted.
export function planInputs(root) {
  const out = [];
  if (existsSync(join(root, "hsdd/conventions.md"))) out.push("hsdd/conventions.md");
  for (const dir of ["spec", "contract", "adr"]) for (const f of listMd(join(root, "hsdd", dir))) out.push(`hsdd/${dir}/${f}`);
  for (const f of ["glossary.json", "prose.json"]) if (existsSync(join(root, "hsdd/summary", f))) out.push(`hsdd/summary/${f}`);
  return out.sort();
}

export function hashInputs(root, paths) {
  return Object.fromEntries(paths.map((p) => [p, fileHash(join(root, p))]));
}

export function diffInputs(stamped, current) {
  const changed = [];
  const added = [];
  const removed = [];
  for (const [p, h] of Object.entries(current)) {
    if (!(p in stamped)) added.push(p);
    else if (stamped[p] !== h) changed.push(p);
  }
  for (const p of Object.keys(stamped)) if (!(p in current)) removed.push(p);
  return { changed, added, removed, fresh: !changed.length && !added.length && !removed.length };
}

// JSON that is safe inside a <script> element: no "<", ">", "&" or line
// separators survive literally, and JSON.parse still reads it back exactly.
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function readPageStamp(html) {
  const m = /<script type="application\/json" id="hsdd-stamp">([^<]*)<\/script>/.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `node --test test/prose-stamp.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add skills/hsdd-summary/scripts/prose.mjs skills/hsdd-summary/scripts/stamp.mjs test/prose-stamp.test.mjs
git commit -m "feat(hsdd-summary): stamped prose store, glossary, lint, and input stamps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Graphs derived from the model

**Files:**
- Create: `skills/hsdd-summary/scripts/graph.mjs`
- Test: `test/graph.test.mjs`

**Interfaces:**
- Consumes: the model.
- Produces (import-free, because it is inlined into pages): `MAX_BOXES` (12), `MAX_STEPS` (6), `OUTSIDE`; `nodeById`, `activeChildren(model, id)`, `subtree(model, id) -> Set`, `producers(model) -> Map<contractId, Set<nodeId>>`; `childGraph(model, parentId) -> { boxes, outside, edges: [{ from, to, refs, kind }] }`; `layers(ids, depsOf) -> string[][]`; `reachesIn(depsOf, from, to)`; `phaseGraph(model, nodeId) -> { ids, edges, collisions, orderedCollisions, cross, steps, collapsed }`.

- [ ] **Step 1: Write the failing test**

Create `test/graph.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { completedModel } from "./helpers/plan-fixture.mjs";
import { childGraph, phaseGraph, layers, subtree, producers, OUTSIDE, MAX_BOXES } from "../skills/hsdd-summary/scripts/graph.mjs";

const model = completedModel();

test("subtree and producers", () => {
  assert.deepEqual([...subtree(model, "acme.web")].sort(), ["acme.web", "acme.web.console"]);
  assert.deepEqual([...producers(model).get("auth-token")], ["acme.api"]);
});

test("childGraph at the root: retired nodes hidden, edges from contracts, external box", () => {
  const g = childGraph(model, "acme");
  assert.deepEqual(g.boxes, ["acme.api", "acme.ops", "acme.web"]);
  const e = g.edges.map((x) => `${x.from}>${x.to} ${x.kind} ${x.refs.join(",")}`).sort();
  assert.deepEqual(e, [
    `${OUTSIDE}>acme.api contract user-store@v1`,
    "acme.api>acme.web contract auth-token@v1,session@v1",
  ]);
  assert.equal(g.outside, true);
});

test("phaseGraph: dependency edges, ordered collisions counted, cross-node listed", () => {
  const g = phaseGraph(model, "acme.api");
  assert.deepEqual(g.edges.map((e) => `${e.from}>${e.to}`), ["acme.api.1>acme.api.2", "acme.api.2>acme.api.3"]);
  assert.deepEqual(g.collisions, []);
  assert.equal(g.orderedCollisions, 1);
  assert.deepEqual(g.steps, [["acme.api.1"], ["acme.api.2"], ["acme.api.3"]]);
  assert.equal(g.collapsed, false);
  assert.deepEqual(phaseGraph(model, "acme.web.console").cross, [{ phase: "acme.web.console.2", on: "acme.api.2" }]);
});

test("phaseGraph: an unordered collision is drawn", () => {
  const m = structuredClone(model);
  m.phases[2].dependsOn = ["acme.api.1"];
  const g = phaseGraph(m, "acme.api");
  assert.deepEqual(g.collisions, [{ from: "acme.api.2", to: "acme.api.3", kind: "collides" }]);
  assert.equal(g.orderedCollisions, 0);
});

test("layers: longest path, independent of input order", () => {
  const deps = { a: [], b: ["a"], c: ["a"], d: ["b", "c"], e: [] };
  assert.deepEqual(layers(["d", "c", "b", "a", "e"], (x) => deps[x]), [["a", "e"], ["c", "b"], ["d"]]);
});

test("phaseGraph collapses above the box limit", () => {
  const m = structuredClone(model);
  for (let i = 4; i <= MAX_BOXES + 2; i++) {
    m.phases.push({ ...m.phases[0], id: `acme.api.${i}`, n: i, heading: `api.${i}`, dependsOn: [`acme.api.${i - 1}`], collidesWith: [] });
  }
  assert.equal(phaseGraph(m, "acme.api").collapsed, true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/graph.test.mjs`
Expected: FAIL with `Cannot find module` for `graph.mjs`.

- [ ] **Step 3: Implement**

Create `skills/hsdd-summary/scripts/graph.mjs`:

```js
// Graphs the plan page draws, derived from the model. Pure functions; this
// file is also inlined into the page, so it imports nothing.

export const MAX_BOXES = 12;
// A collapsed graph is a chain of steps; past this many it reads better as a list.
export const MAX_STEPS = 6;
export const OUTSIDE = "(outside)";

export function nodeById(model) {
  return new Map(model.nodes.map((n) => [n.id, n]));
}

export function activeChildren(model, id) {
  const byId = nodeById(model);
  return (byId.get(id)?.children ?? []).map((c) => byId.get(c)).filter((n) => n && n.status === "active");
}

export function subtree(model, id) {
  const byId = nodeById(model);
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop();
    if (out.has(x) || !byId.has(x)) continue;
    out.add(x);
    stack.push(...byId.get(x).children);
  }
  return out;
}

// contract id -> node ids that produce it (node fields, phase fields, owner, produced_by).
export function producers(model) {
  const out = new Map();
  const put = (cid, node) => {
    if (!out.has(cid)) out.set(cid, new Set());
    out.get(cid).add(node);
  };
  const nodes = new Set(model.nodes.map((n) => n.id));
  for (const n of model.nodes) for (const r of n.produces) put(r.ref.split("@")[0], n.id);
  for (const p of model.phases) for (const r of p.produces) put(r.ref.split("@")[0], p.node);
  for (const c of model.contracts) {
    if (nodes.has(c.owner)) put(c.id, c.owner);
    for (const pid of c.producedBy) {
      const node = pid.replace(/\.\d+$/, "");
      if (nodes.has(node)) put(c.id, node);
    }
  }
  return out;
}

function consumedIn(model, ids) {
  const refs = new Map();
  for (const n of model.nodes) if (ids.has(n.id)) for (const r of n.consumes) refs.set(r.ref, r);
  for (const p of model.phases) if (ids.has(p.node)) for (const r of p.consumes) refs.set(r.ref, r);
  return [...refs.values()];
}

function edgeKind(model, refs) {
  const kinds = new Set(refs.map((ref) => model.contracts.find((c) => c.id === ref.split("@")[0])?.kind ?? "api"));
  if (kinds.size === 1 && kinds.has("event")) return "event";
  if (kinds.size === 1 && kinds.has("shared-model")) return "shared-model";
  return "contract";
}

// Boxes are the active children of `parentId`; an edge A -> B means something
// in B's subtree consumes a contract something in A's subtree produces.
// Contracts produced outside the tree arrive from one OUTSIDE box.
export function childGraph(model, parentId) {
  const kids = activeChildren(model, parentId);
  const subs = new Map(kids.map((k) => [k.id, subtree(model, k.id)]));
  const prod = producers(model);
  const external = new Set(model.contracts.filter((c) => c.external).map((c) => c.id));
  const edges = new Map();
  const addEdge = (from, to, ref) => {
    const key = `${from}|${to}`;
    if (!edges.has(key)) edges.set(key, { from, to, refs: [] });
    if (!edges.get(key).refs.includes(ref)) edges.get(key).refs.push(ref);
  };
  for (const b of kids) {
    for (const r of consumedIn(model, subs.get(b.id))) {
      const cid = r.ref.split("@")[0];
      const from = kids.filter((a) => a.id !== b.id && [...(prod.get(cid) ?? [])].some((p) => subs.get(a.id).has(p)));
      for (const a of from) addEdge(a.id, b.id, r.ref);
      if (!from.length && (r.ext || external.has(cid)) && !(prod.get(cid)?.size)) addEdge(OUTSIDE, b.id, r.ref);
    }
  }
  const list = [...edges.values()].map((e) => ({ ...e, kind: edgeKind(model, e.refs) }));
  return { boxes: kids.map((k) => k.id), outside: list.some((e) => e.from === OUTSIDE), edges: list };
}

// Longest-path layering over in-set dependencies: layer 0 depends on nothing in the set.
export function layers(ids, depsOf) {
  const set = new Set(ids);
  const memo = new Map();
  const depth = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const ds = (depsOf(id) ?? []).filter((d) => set.has(d));
    const v = ds.length ? 1 + Math.max(...ds.map((d) => depth(d, seen))) : 0;
    memo.set(id, v);
    return v;
  };
  const out = [];
  for (const id of ids) {
    const d = depth(id);
    (out[d] ??= []).push(id);
  }
  return out.filter(Boolean);
}

export function reachesIn(depsOf, from, to) {
  const seen = new Set();
  const stack = [...(depsOf(from) ?? [])];
  while (stack.length) {
    const x = stack.pop();
    if (x === to) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(depsOf(x) ?? []));
  }
  return false;
}

// A leaf-parent's phases: in-node dependency edges, collisions no dependency
// orders (drawn), the count of ordered ones (not drawn), cross-node
// dependencies, and the layering used when the graph is too large to draw.
export function phaseGraph(model, nodeId) {
  const ps = model.phases.filter((p) => p.node === nodeId);
  const ids = ps.map((p) => p.id);
  const set = new Set(ids);
  const byId = new Map(ps.map((p) => [p.id, p]));
  const depsOf = (id) => (byId.get(id)?.dependsOn ?? []).filter((d) => set.has(d));
  const edges = ps.flatMap((p) => depsOf(p.id).map((d) => ({ from: d, to: p.id, kind: "depends" })));
  const collisions = [];
  let orderedCollisions = 0;
  const seen = new Set();
  for (const p of ps) for (const o of p.collidesWith) {
    if (!set.has(o)) continue;
    const key = [p.id, o].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (reachesIn(depsOf, p.id, o) || reachesIn(depsOf, o, p.id)) orderedCollisions++;
    else collisions.push({ from: [p.id, o].sort()[0], to: [p.id, o].sort()[1], kind: "collides" });
  }
  const cross = ps.flatMap((p) => p.dependsOn.filter((d) => !set.has(d)).map((d) => ({ phase: p.id, on: d })));
  const steps = layers(ids, depsOf);
  return { ids, edges, collisions, orderedCollisions, cross, steps, collapsed: ids.length > MAX_BOXES };
}

```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/graph.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/scripts/graph.mjs test/graph.test.mjs
git commit -m "feat(hsdd-summary): graphs from contracts, phase graphs, layering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 6: The view core and the plan views

**Files:**
- Create: `skills/hsdd-summary/scripts/views-core.mjs`, `skills/hsdd-summary/scripts/views-plan.mjs`
- Test: `test/views-plan.test.mjs`

**Interfaces:**
- Consumes: `graph.mjs`; `crossCheckPlan` and `namesId` in tests.
- Produces: from `views-core.mjs`: `Raw`, `raw`, `esc`, `html` (tagged template that escapes every value not `Raw`), `inline`, `block`, `plural`, `href(audience, ...parts)`, `parseRoute(hash, audiences) -> { audience, view, id }`, `chip`, `section`, `sourceLink`, `diagramSlot`, `capitalize`, `renderBlocks(blocks)` (source blocks as HTML; code blocks get a `data-copy` button). From `views-plan.mjs`: `PLAN_AUDIENCES`, `renderPlan(page, route) -> { title, crumbs: [{ label, href }], body: string, diagrams: [{ id, spec: { direction, nodes, edges, legend } }] }`. Page data: `{ kind, project, model, prose: { key: text }, gloss: { contractId: phrase }, findings, readability, generated }`. Routes: `top`, `node/{id}`, `phase/{id}`, `contracts`, `contract/{ref}`, `adrs`; an unknown id falls back to the top.
- Both files import nothing outside this directory and keep every top-level name distinct, because `html.mjs` concatenates them into one classic script.

- [ ] **Step 1: Write the failing test**

Create `test/views-plan.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { completedModel, planPage } from "./helpers/plan-fixture.mjs";
import { crossCheckPlan } from "../skills/hsdd-summary/scripts/checks-plan.mjs";
import { renderPlan, PLAN_AUDIENCES } from "../skills/hsdd-summary/scripts/views-plan.mjs";
import { parseRoute, href, esc, html, block } from "../skills/hsdd-summary/scripts/views-core.mjs";
import { namesId } from "../skills/hsdd-summary/scripts/prose.mjs";

const model = completedModel();
const page = planPage(model, { findings: crossCheckPlan(model).findings });

function routes(m) {
  return [
    { view: "top" },
    ...m.nodes.map((n) => ({ view: "node", id: n.id })),
    ...m.phases.map((p) => ({ view: "phase", id: p.id })),
    { view: "contracts" },
    ...m.contracts.map((c) => ({ view: "contract", id: c.ref })),
    { view: "adrs" },
  ];
}

export function visibleText(view) {
  const body = view.body.replace(/<[^>]*>/g, " ");
  const diagram = view.diagrams.flatMap((d) => [...d.spec.nodes.flatMap((n) => [n.label, n.sub]), ...d.spec.edges.map((e) => e.label), ...d.spec.legend.map((l) => l.text)]);
  return [view.title, ...view.crumbs.map((c) => c.label), body, ...diagram].join("\n").replace(/&[a-z#0-9]+;/g, " ");
}

test("parseRoute: audience, view, id with dots and @", () => {
  assert.deepEqual(parseRoute("#stakeholder/contract/auth-token%40v1", PLAN_AUDIENCES), { audience: "stakeholder", view: "contract", id: "auth-token@v1" });
  assert.deepEqual(parseRoute("", PLAN_AUDIENCES), { audience: "reviewer", view: "top", id: null });
  assert.deepEqual(parseRoute("#node/acme.api", PLAN_AUDIENCES), { audience: "reviewer", view: "node", id: "acme.api" });
  assert.equal(href("reviewer", "contract", "auth-token@v1"), "#reviewer/contract/auth-token%40v1");
});

test("every route renders for every audience", () => {
  for (const audience of PLAN_AUDIENCES) for (const r of routes(model)) {
    const v = renderPlan(page, { audience, ...r });
    assert.ok(v.title && v.body && Array.isArray(v.crumbs) && Array.isArray(v.diagrams), `${audience} ${r.view} ${r.id}`);
  }
});

test("the stakeholder never sees an id", () => {
  for (const r of routes(model)) {
    const text = visibleText(renderPlan(page, { audience: "stakeholder", ...r }));
    assert.equal(namesId(text, model.ids), null, `${r.view} ${r.id ?? ""}: ${namesId(text, model.ids)}`);
  }
});

test("top view: child boxes, contract edges, outside box, legend", () => {
  const v = renderPlan(page, { audience: "reviewer", view: "top" });
  const spec = v.diagrams[0].spec;
  assert.deepEqual(spec.nodes.map((n) => n.id), ["acme.api", "acme.ops", "acme.web", "(outside)"]);
  assert.deepEqual(spec.nodes.find((n) => n.id === "acme.ops").role, "asbuilt");
  assert.ok(spec.edges.some((e) => e.from === "acme.api" && e.to === "acme.web" && e.label === "auth-token@v1, session@v1"));
  assert.ok(spec.legend.some((l) => l.edge === "contract"));
  assert.match(v.body, /outlet-api@v1 is named, not yet written/);
  assert.match(v.body, /Retired nodes \(1\)/);
});

test("leaf view: phase boxes by tier; stakeholder sees steps", () => {
  const r = renderPlan(page, { audience: "reviewer", view: "node", id: "acme.api" }).diagrams[0].spec;
  assert.deepEqual(r.nodes.map((n) => [n.label, n.role]), [["api.1", "tier-gate-only"], ["api.2", "tier-full-review"], ["api.3", "tier-full-review"]]);
  assert.match(r.nodes[2].sub, /waits on OQ1/);
  const s = renderPlan(page, { audience: "stakeholder", view: "node", id: "acme.api" }).diagrams[0].spec;
  assert.deepEqual(s.nodes.map((n) => [n.label, n.sub]), [["Step 1", "1 piece of work"], ["Step 2", "1 piece of work"], ["Step 3", "1 piece of work"]]);
});

test("a long chain of steps becomes an ordered list, not a diagram", () => {
  const m = completedModel();
  for (let i = 4; i <= 9; i++) m.phases.push({ ...m.phases[0], id: `acme.api.${i}`, n: i, heading: `api.${i}`, dependsOn: [`acme.api.${i - 1}`], collidesWith: [], contingentOn: [], citesOq: [] });
  const v = renderPlan(planPage(m), { audience: "stakeholder", view: "node", id: "acme.api" });
  assert.equal(v.diagrams.length, 0);
  assert.equal((v.body.match(/<li>/g) ?? []).length >= 9, true);
  assert.match(v.body, /<ol class="steps">/);
});

test("implementer sees gates; reviewer does not get the gate column", () => {
  assert.match(renderPlan(page, { audience: "implementer", view: "node", id: "acme.api" }).body, /<th>Gate<\/th>/);
  assert.doesNotMatch(renderPlan(page, { audience: "reviewer", view: "node", id: "acme.api" }).body, /<th>Gate<\/th>/);
});

test("stakeholder phase links fall back to the node; unknown ids fall back to the top", () => {
  assert.equal(renderPlan(page, { audience: "stakeholder", view: "phase", id: "acme.api.2" }).title, "Token Service");
  assert.equal(renderPlan(page, { audience: "reviewer", view: "node", id: "nope" }).title, "Acme Platform");
  assert.equal(renderPlan(page, { audience: "reviewer", view: "bogus" }).title, "Acme Platform");
});

test("a finding cited by two nodes in scope is listed once", () => {
  const body = renderPlan(page, { audience: "reviewer", view: "top" }).body;
  assert.equal(body.match(/outlet-api@v1 is named, not yet written/g).length, 1);
  assert.match(renderPlan(page, { audience: "stakeholder", view: "top" }).body, /1 connection is named but not yet written down/);
});

test("ordered collisions are counted, not listed", () => {
  const body = renderPlan(page, { audience: "reviewer", view: "node", id: "acme.api" }).body;
  assert.match(body, /1 collision a dependency already orders/);
  assert.doesNotMatch(body, /acme\.api\.2 and acme\.api\.3 edit the same files/);
});

test("hostile text is escaped everywhere", () => {
  const m = completedModel();
  m.nodes[1].name = "<script>alert(1)</script>";
  m.nodes[1].purpose = '"><img src=x onerror=alert(1)>';
  const p = planPage(m);
  p.prose["explain:acme.api"] = "</p><script>x()</script>";
  for (const audience of PLAN_AUDIENCES) for (const r of routes(m)) {
    const v = renderPlan(p, { audience, ...r });
    assert.doesNotMatch(v.body, /<script|<img/i, `${audience} ${r.view} ${r.id}`);
  }
});

test("views-core: esc, html, block", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(html`<b>${"<i>"}</b>`.s, "<b>&lt;i&gt;</b>");
  assert.equal(block("- a `b`\n- **c**").s, "<ul><li>a <code>b</code></li><li><strong>c</strong></li></ul>");
  assert.equal(block("one\ntwo").s, "<p>one two</p>");
});

test("views-core: inline links, emphasis; renderBlocks escapes and adds copy buttons", async () => {
  const { inline, renderBlocks } = await import("../skills/hsdd-summary/scripts/views-core.mjs");
  assert.equal(inline("see [the plan](2026-09-15-execution-plan.md) and *Validate:* `x`").s, "see the plan and <em>Validate:</em> <code>x</code>");
  const out = renderBlocks([{ type: "code", lang: "", text: "<b>run</b>" }, { type: "ul", items: [{ checked: true, text: "a" }, { checked: null, text: "b" }] }]).s;
  assert.match(out, /data-copy/);
  assert.match(out, /&lt;b&gt;run&lt;\/b&gt;/);
  assert.match(out, /\u2611/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/views-plan.test.mjs`
Expected: FAIL with `Cannot find module` for `views-plan.mjs`.

- [ ] **Step 3: Implement the core**

Create `skills/hsdd-summary/scripts/views-core.mjs`:

```js
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
```

- [ ] **Step 4: Implement the plan views**

Create `skills/hsdd-summary/scripts/views-plan.mjs`:

```js
// The plan page's views. Pure: (page data, route) -> { title, crumbs, body,
// diagrams }. Inlined into the page with views-core.mjs and graph.mjs.
import { html, raw, inline, block, plural, href, chip, section, sourceLink, diagramSlot, capitalize } from "./views-core.mjs";
import { childGraph, phaseGraph, subtree, activeChildren, OUTSIDE, MAX_BOXES, MAX_STEPS } from "./graph.mjs";

export const PLAN_AUDIENCES = ["reviewer", "stakeholder", "implementer"];

const TIER_WORDS = { "gate-only": "light check", "spot-check": "quick look", "full-review": "full review" };
const STATUS_WORDS = { stable: "agreed", draft: "draft", deprecated: "being phased out", retired: "retired" };

export function renderPlan(page, route) {
  const model = page.model;
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const ctx = { page, model, byId, a: route.audience, stake: route.audience === "stakeholder" };
  const root = model.project.root;
  if (route.view === "node" && byId.has(route.id)) return planNode(ctx, route.id);
  if (route.view === "phase") {
    const p = model.phases.find((x) => x.id === route.id);
    if (p) return ctx.stake ? planNode(ctx, p.node) : planPhase(ctx, p);
  }
  if (route.view === "contracts") return planContracts(ctx);
  if (route.view === "contract") {
    const c = model.contracts.find((x) => x.ref === route.id);
    if (c) return planContract(ctx, c);
  }
  if (route.view === "adrs") return planAdrs(ctx);
  return planNode(ctx, root);
}

function prose(ctx, key) {
  return ctx.page.prose[key] ?? "";
}

function gloss(ctx, ref) {
  return ctx.page.gloss[String(ref).split("@")[0]] ?? "";
}

function crumbsTo(ctx, id) {
  const out = [];
  for (let n = ctx.byId.get(id); n; n = n.parent ? ctx.byId.get(n.parent) : null) out.unshift({ label: n.name, href: href(ctx.a, "node", n.id) });
  return out;
}

function isLeaf(n) {
  return n.kind === "leaf-parent" || n.kind === "integration";
}

function kindLabel(ctx, n) {
  if (ctx.stake) return n.kind === "root" ? "The whole plan" : isLeaf(n) ? "A part of the work" : "A group of parts";
  return { root: "root", internal: "internal node", "leaf-parent": "leaf-parent", integration: "integration node" }[n.kind] ?? n.kind;
}

function phasesIn(ctx, id) {
  const scope = subtree(ctx.model, id);
  const active = new Set(ctx.model.nodes.filter((n) => n.status === "active" && scope.has(n.id)).map((n) => n.id));
  return ctx.model.phases.filter((p) => active.has(p.node));
}

function contractChip(ctx, r) {
  const c = ctx.model.contracts.find((x) => x.id === r.ref.split("@")[0]);
  const label = ctx.stake ? gloss(ctx, r.ref) : r.ref;
  if (!c) return chip(ctx.stake ? label : `${label} (named, not yet written)`, null, "missing");
  return chip(label, href(ctx.a, "contract", c.ref), r.ext || c.external ? "external" : "");
}

// What to check, scoped to a node and everything under it.
function whatToCheck(ctx, id) {
  const scope = subtree(ctx.model, id);
  const seen = new Set();
  const fs = ctx.page.findings.filter((f) => scope.has(f.node) && !seen.has(`${f.kind}|${f.message}`) && seen.add(`${f.kind}|${f.message}`));
  const full = phasesIn(ctx, id).filter((p) => p.tier === "full-review");
  const count = (kind) => fs.filter((f) => f.kind === kind).length;
  if (ctx.stake) {
    const lines = [
      [full.length, "piece of work gets a full review", "pieces of work get a full review"],
      [count("contingent"), "piece of work waits on an open question", "pieces of work wait on an open question"],
      [count("unwritten-contract"), "connection is named but not yet written down", "connections are named but not yet written down"],
      [count("provisional-contract"), "connection is still provisional", "connections are still provisional"],
      [count("adr-missing") + count("adr-proposed"), "decision is not final yet", "decisions are not final yet"],
      [count("pending-governance"), "part has changes waiting to be applied", "parts have changes waiting to be applied"],
      [count("collision"), "pair of work items touches the same files", "pairs of work items touch the same files"],
      [count("version-mismatch"), "reference points at an older version of a connection", "references point at an older version of a connection"],
    ].filter(([n]) => n > 0);
    const body = lines.length ? html`<ul>${lines.map(([n, one, many]) => html`<li>${n} ${n === 1 ? one : many}</li>`)}</ul>` : html`<p>Nothing to watch at this level.</p>`;
    return section("What to watch", body, "check");
  }
  const items = [];
  if (full.length) items.push(html`<li><strong>Full review:</strong> ${plural(full.length, "phase")} ${full.length <= 12 ? full.map((p) => chip(p.heading, href(ctx.a, "phase", p.id), "tier-full-review")) : ""}</li>`);
  for (const f of fs.filter((x) => x.kind !== "collision-ordered")) {
    const target = f.phase ? href(ctx.a, "phase", f.phase) : f.ref && ctx.model.contracts.some((c) => c.ref === f.ref) ? href(ctx.a, "contract", f.ref) : href(ctx.a, "node", f.node);
    items.push(html`<li class="finding ${f.kind}"><a href="${target}">${f.message}</a></li>`);
  }
  const ordered = count("collision-ordered");
  if (ordered) items.push(html`<li class="muted">${plural(ordered, "collision")} a dependency already orders (not listed)</li>`);
  return section("What to check", items.length ? html`<ul>${items}</ul>` : html`<p>Nothing to check at this level.</p>`, "check");
}

function childSpec(ctx, g) {
  const nodes = g.boxes.map((id) => {
    const n = ctx.byId.get(id);
    const ph = phasesIn(ctx, id).length;
    const sub = isLeaf(n) ? (ctx.stake ? plural(ph, "piece of work", "pieces of work") : plural(ph, "phase")) : plural(activeChildren(ctx.model, id).length, "part");
    return { id, label: n.name, sub: `${prose(ctx, `explain:${id}`)}\n${sub}`, role: n.adopted === "as-built" ? "asbuilt" : isLeaf(n) ? "leaf" : "internal", href: href(ctx.a, "node", id) };
  });
  if (g.outside) nodes.push({ id: OUTSIDE, label: "Outside the tree", sub: ctx.stake ? "systems other teams run" : "external contracts", role: "outside", href: null });
  const edges = g.edges.map((e) => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
    label: ctx.stake ? "" : e.refs.length > 2 ? `${e.refs.slice(0, 2).join(", ")} +${e.refs.length - 2}` : e.refs.join(", "),
  }));
  const roles = new Set(nodes.map((n) => n.role));
  const kinds = new Set(edges.map((e) => e.kind));
  const legend = [
    roles.has("internal") && { swatch: "internal", text: ctx.stake ? "a group of parts" : "internal node" },
    roles.has("leaf") && { swatch: "leaf", text: ctx.stake ? "a part of the work" : "leaf-parent: planned as phases" },
    roles.has("asbuilt") && { swatch: "asbuilt", text: ctx.stake ? "existing code, described as it is" : "adopted as built" },
    roles.has("outside") && { swatch: "outside", text: ctx.stake ? "outside this plan" : "outside the tree" },
    kinds.has("contract") && { edge: "contract", text: ctx.stake ? "uses what the other part provides" : "consumes a contract" },
    kinds.has("event") && { edge: "event", text: ctx.stake ? "listens for its messages" : "consumes events" },
    kinds.has("shared-model") && { edge: "shared-model", text: ctx.stake ? "shares its data shapes" : "shares a model" },
  ].filter(Boolean);
  return { direction: "LR", nodes, edges, legend };
}

function phaseSpec(ctx, g) {
  const byId = new Map(ctx.model.phases.map((p) => [p.id, p]));
  if (ctx.stake || g.collapsed) {
    const nodes = g.steps.map((ids, k) => ({
      id: `step-${k + 1}`,
      label: `Step ${k + 1}`,
      sub: ctx.stake ? plural(ids.length, "piece of work", "pieces of work") : ids.map((id) => byId.get(id).heading).join(", "),
      role: "step",
      href: null,
    }));
    const edges = nodes.slice(1).map((n, k) => ({ from: nodes[k].id, to: n.id, kind: "step", label: "" }));
    return { direction: "LR", nodes, edges, legend: [{ swatch: "step", text: ctx.stake ? "work that can happen at the same time" : "phases with no dependency between them" }, { edge: "step", text: ctx.stake ? "comes after" : "the next layer depends on this one" }] };
  }
  const nodes = g.ids.map((id) => {
    const p = byId.get(id);
    const waits = p.contingentOn.length ? `\nwaits on ${p.contingentOn.join(", ")}` : "";
    return { id, label: p.heading, sub: `${p.name}${waits}`, role: `tier-${p.tier}`, href: href(ctx.a, "phase", id) };
  });
  const edges = [...g.edges, ...g.collisions].map((e) => ({ ...e, label: "" }));
  const tiers = new Set(g.ids.map((id) => byId.get(id).tier));
  const legend = [
    ...["gate-only", "spot-check", "full-review"].filter((t) => tiers.has(t)).map((t) => ({ swatch: `tier-${t}`, text: t })),
    g.edges.length && { edge: "depends", text: "depends on" },
    g.collisions.length && { edge: "collides", text: "edit the same files; nothing orders them" },
  ].filter(Boolean);
  return { direction: "LR", nodes, edges, legend };
}

// The collapsed graph as an ordered list, when a row of steps would be unreadable.
function stepList(ctx, g) {
  const byId = new Map(ctx.model.phases.map((p) => [p.id, p]));
  return section(ctx.stake ? "In order" : "Order of work", html`<ol class="steps">${g.steps.map((ids) => html`<li>${ctx.stake ? plural(ids.length, "piece of work", "pieces of work") : ids.map((id) => chip(byId.get(id).heading, href(ctx.a, "phase", id), `tier-${byId.get(id).tier}`))}</li>`)}</ol>`);
}

function fieldsSection(ctx, n) {
  const row = (label, value) => (value ? html`<dt>${label}</dt><dd>${value}</dd>` : "");
  const refs = (list) => (list.length ? raw(list.map((r) => contractChip(ctx, r).s).join(" ")) : null);
  const adrs = n.governedBy.length ? raw(n.governedBy.map((id) => chip(id, href(ctx.a, "adrs")).s).join(" ")) : null;
  return section("Details", html`<dl>
    ${row("Purpose", n.purpose ? block(n.purpose) : null)}
    ${row("Owns", n.owns ? block(n.owns) : null)}
    ${row("Does not own", n.doesNotOwn ? block(n.doesNotOwn) : null)}
    ${row("Isolation strategy", n.isolation ? block(n.isolation) : null)}
    ${row("Consumes", refs(n.consumes))}
    ${row("Produces", refs(n.produces))}
    ${row("Governed by", adrs)}
    ${row("Team", n.team)}
    ${row("Default gate", n.defaultGate && ctx.a === "implementer" ? html`<code>${n.defaultGate}</code>` : null)}
  </dl>`, "fields");
}

function questionsSection(ctx, n) {
  const qs = n.openQuestions;
  if (!qs.length) return raw("");
  const open = qs.filter((q) => q.status !== "RESOLVED");
  if (ctx.stake) return section("Open questions", html`<p>${plural(open.length, "question is", "questions are")} still open here.</p>`);
  return section("Open questions", html`<table><thead><tr><th>ID</th><th>Question</th><th>Status</th><th>Waits on</th></tr></thead><tbody>
    ${qs.map((q) => html`<tr class="${q.status === "RESOLVED" ? "muted" : ""}"><td>${q.id}</td><td>${q.question}</td><td>${q.status}</td><td>${q.waitsOn}</td></tr>`)}
  </tbody></table>`);
}

function phaseListSection(ctx, n, g) {
  const ps = ctx.model.phases.filter((p) => p.node === n.id);
  if (!ps.length) return section("Phases", html`<p>${ctx.stake ? "Not planned yet." : "No phase plan yet."}</p>`);
  if (ctx.stake) {
    const full = ps.filter((p) => p.tier === "full-review").length;
    return section("The work", html`<p>${plural(ps.length, "piece of work", "pieces of work")} in ${plural(g.steps.length, "step")}; ${plural(full, "gets", "get")} a full review.</p>`);
  }
  const impl = ctx.a === "implementer";
  return section("Phases", html`<table><thead><tr><th>Phase</th><th>Name</th><th>Tier</th><th>Size</th><th>Depends on</th>${impl ? html`<th>Gate</th>` : ""}</tr></thead><tbody>
    ${ps.map((p) => html`<tr><td><a href="${href(ctx.a, "phase", p.id)}">${p.heading}</a></td><td>${p.name}</td><td><span class="badge tier-${p.tier}">${p.tier}</span></td><td>${p.size ?? ""}</td><td>${p.dependsOn.map((d) => ctx.model.phases.find((x) => x.id === d)?.heading ?? d).join(", ")}</td>${impl ? html`<td><code>${p.resolvedGate ?? ""}</code></td>` : ""}</tr>`)}
  </tbody></table>
  ${g.cross.length ? html`<p class="muted">Waits on other parts: ${g.cross.map((c) => chip(c.on, href(ctx.a, "phase", c.on)))}</p>` : ""}`);
}

function childrenSection(ctx, n) {
  const kids = activeChildren(ctx.model, n.id);
  const retired = n.children.map((c) => ctx.byId.get(c)).filter((c) => c && c.status === "retired");
  return section(ctx.stake ? "Parts" : "Child nodes", html`<ul class="cards">
    ${kids.map((k) => html`<li class="card"><a href="${href(ctx.a, "node", k.id)}"><strong>${k.name}</strong></a><p>${prose(ctx, `explain:${k.id}`)}</p></li>`)}
  </ul>
  ${retired.length ? html`<details><summary>${ctx.stake ? "Retired parts" : "Retired nodes"} (${retired.length})</summary><ul>${retired.map((r) => html`<li>${r.name}</li>`)}</ul></details>` : ""}`);
}

function planNode(ctx, id) {
  const n = ctx.byId.get(id);
  const leaf = isLeaf(n);
  const diagrams = [];
  let listing;
  if (leaf) {
    const g = phaseGraph(ctx.model, id);
    const asSteps = ctx.stake || g.collapsed;
    if (g.ids.length && !(asSteps && g.steps.length > MAX_STEPS)) diagrams.push({ id: "main", spec: phaseSpec(ctx, g) });
    listing = html`${asSteps && g.steps.length > MAX_STEPS ? stepList(ctx, g) : ""}${phaseListSection(ctx, n, g)}`;
  } else {
    const g = childGraph(ctx.model, id);
    if (g.boxes.length && g.boxes.length <= MAX_BOXES) diagrams.push({ id: "main", spec: childSpec(ctx, g) });
    listing = childrenSection(ctx, n);
  }
  const note = prose(ctx, `note:${id}:${ctx.a}`);
  const markers = [
    n.adopted === "as-built" && (ctx.stake ? "Existing code, described as it is" : "Adopted as built"),
    n.adopted === "promoted" && (ctx.stake ? "Existing code, now planned" : "Adopted, then promoted"),
    n.status === "retired" && "Retired",
  ].filter(Boolean);
  const body = html`
    <header class="page-head">
      <p class="eyebrow">${kindLabel(ctx, n)}</p>
      <h1>${n.name}</h1>
      ${ctx.stake ? "" : html`<p class="id"><code>${n.id}</code></p>`}
      ${markers.length ? html`<p class="markers">${markers.map((m) => html`<span class="badge">${m}</span>`)}</p>` : ""}
      <p class="explain">${prose(ctx, `explain:${id}`)}</p>
      ${note ? html`<p class="note">${note}</p>` : ""}
    </header>
    ${diagrams.length ? diagramSlot("main") : ""}
    ${listing}
    ${whatToCheck(ctx, id)}
    ${ctx.stake || n.kind === "root" ? "" : fieldsSection(ctx, n)}
    ${questionsSection(ctx, n)}
    ${n.kind === "root" ? readability(ctx) : ""}
    ${ctx.stake ? "" : sourceLink(n.sourceFile)}`;
  return { title: n.name, crumbs: crumbsTo(ctx, id), body: body.s, diagrams };
}

function planPhase(ctx, p) {
  const row = (label, value) => (value ? html`<dt>${label}</dt><dd>${value}</dd>` : "");
  const refs = (list) => (list.length ? raw(list.map((r) => contractChip(ctx, r).s).join(" ")) : null);
  const phaseChips = (ids) => (ids.length ? raw(ids.map((d) => chip(ctx.model.phases.find((x) => x.id === d)?.heading ?? d, href(ctx.a, "phase", d)).s).join(" ")) : null);
  const oqs = ctx.model.nodes.flatMap((n) => n.openQuestions);
  const delivers = prose(ctx, `delivers:${p.id}`);
  const body = html`
    <header class="page-head">
      <p class="eyebrow">Phase · <span class="badge tier-${p.tier}">${p.tier}</span></p>
      <h1>${p.name}</h1>
      <p class="id"><code>${p.id}</code></p>
      ${delivers ? html`<p class="explain">${delivers}</p>` : ""}
    </header>
    ${section("Phase", html`<dl>
      ${row("Scope", p.scope ? block(p.scope) : null)}
      ${row("Verification", p.verification ? block(p.verification) : null)}
      ${row("Gate", p.resolvedGate ? html`<code>${p.resolvedGate}</code>${p.gate && /node default/i.test(p.gate) ? html` <span class="muted">(node default)</span>` : ""}` : null)}
      ${row("Size", p.size)}
      ${row("Consumes", refs(p.consumes))}
      ${row("Produces", refs(p.produces))}
      ${row("Governed by", p.governedBy.length ? raw(p.governedBy.map((id) => chip(id, href(ctx.a, "adrs")).s).join(" ")) : null)}
      ${row("Depends on", phaseChips(p.dependsOn))}
      ${row("Collides with", phaseChips(p.collidesWith))}
      ${row("Contingent on", p.contingentOn.length ? raw(p.contingentOn.map((id) => chip(`${id} (${oqs.find((q) => q.id === id)?.status ?? "undefined"})`, null, "warn").s).join(" ")) : null)}
    </dl>`)}
    ${sourceLink(p.sourceFile, p.line)}`;
  return { title: `${p.heading}: ${p.name}`, crumbs: [...crumbsTo(ctx, p.node), { label: p.heading, href: href(ctx.a, "phase", p.id) }], body: body.s, diagrams: [] };
}

function contractCard(ctx, c, full) {
  const promise = prose(ctx, `promise:${c.ref}`);
  const owner = ctx.byId.get(c.owner);
  return html`<li class="card contract">
    <p class="eyebrow"><span class="badge status-${c.status ?? "unknown"}">${ctx.stake ? STATUS_WORDS[c.status] ?? c.status ?? "" : c.status ?? "no status"}</span>${!ctx.stake && c.phaseIds === "provisional" ? html` <span class="badge warn">provisional</span>` : ""}${c.external ? html` <span class="badge">${ctx.stake ? "another team's" : "external"}</span>` : ""}</p>
    <h3>${ctx.stake ? capitalize(gloss(ctx, c.ref)) : html`<a href="${href(ctx.a, "contract", c.ref)}"><code>${c.ref}</code></a>`}</h3>
    ${ctx.stake ? "" : html`<p class="muted">${gloss(ctx, c.ref)}${owner ? html` · from ${owner.name}` : ""} · ${plural(c.consumers.length, "consumer")}</p>`}
    ${promise ? html`<p>${promise}</p>` : ""}
    ${full && !ctx.stake && c.guarantees.length ? html`<ul class="guarantees">${c.guarantees.map((g) => html`<li>${inline(g)}</li>`)}</ul>` : ""}
  </li>`;
}

function planContracts(ctx) {
  const root = ctx.model.project.root;
  const g = childGraph(ctx.model, root);
  const spec = childSpec(ctx, g);
  const cs = [...ctx.model.contracts].sort((x, y) => x.ref.localeCompare(y.ref));
  const named = [...new Set([...ctx.model.nodes, ...ctx.model.phases].flatMap((x) => [...x.consumes, ...x.produces]).filter((r) => !r.ext && !ctx.model.contracts.some((c) => c.id === r.ref.split("@")[0])).map((r) => r.ref))].sort();
  const body = html`
    <header class="page-head"><p class="eyebrow">${ctx.stake ? "How the parts connect" : "Contracts"}</p><h1>${ctx.stake ? "Connections" : "Contracts"}</h1>
      <p class="explain">${ctx.stake ? `${plural(cs.length, "connection")} between the parts, and how they depend on each other.` : `${plural(cs.length, "contract")} with a file; ${plural(named.length, "more is", "more are")} named, not yet written.`}</p></header>
    ${g.boxes.length ? diagramSlot("main") : ""}
    ${section(ctx.stake ? "The connections" : "Written", html`<ul class="cards">${cs.map((c) => contractCard(ctx, c, false))}</ul>`)}
    ${named.length ? section(ctx.stake ? "Named but not yet written down" : "Named, not yet written", html`<ul>${named.map((r) => html`<li>${ctx.stake ? capitalize(gloss(ctx, r)) : html`<code>${r}</code>`}</li>`)}</ul>`) : ""}`;
  return { title: ctx.stake ? "Connections" : "Contracts", crumbs: [{ label: ctx.stake ? "Connections" : "Contracts", href: href(ctx.a, "contracts") }], body: body.s, diagrams: g.boxes.length ? [{ id: "main", spec }] : [] };
}

function planContract(ctx, c) {
  const users = ctx.model.phases.filter((p) => p.consumes.some((r) => r.ref.split("@")[0] === c.id));
  const makers = ctx.model.phases.filter((p) => p.produces.some((r) => r.ref.split("@")[0] === c.id));
  const body = html`
    <ul class="cards single">${contractCard(ctx, c, true)}</ul>
    ${ctx.stake ? "" : section("Phases", html`<dl>
      ${makers.length ? html`<dt>Produced by</dt><dd>${makers.map((p) => chip(p.heading, href(ctx.a, "phase", p.id)))}</dd>` : ""}
      ${users.length ? html`<dt>Consumed by</dt><dd>${users.map((p) => chip(p.heading, href(ctx.a, "phase", p.id)))}</dd>` : ""}
    </dl>`)}
    ${ctx.stake ? "" : sourceLink(c.sourceFile)}`;
  const title = ctx.stake ? capitalize(gloss(ctx, c.ref)) : c.ref;
  return { title, crumbs: [{ label: ctx.stake ? "Connections" : "Contracts", href: href(ctx.a, "contracts") }, { label: title, href: href(ctx.a, "contract", c.ref) }], body: body.s, diagrams: [] };
}

function planAdrs(ctx) {
  const as = ctx.model.adrs;
  const accepted = as.filter((x) => x.status === "accepted").length;
  const body = ctx.stake
    ? html`<header class="page-head"><h1>Decisions</h1><p class="explain">${plural(as.length, "decision")} recorded; ${accepted} final, ${as.length - accepted} not final yet.</p></header>`
    : html`<header class="page-head"><p class="eyebrow">Cross-cutting decisions</p><h1>ADRs</h1></header>
      <table><thead><tr><th>ADR</th><th>Title</th><th>Status</th><th>Decision</th><th>Affects</th></tr></thead><tbody>
      ${as.map((x) => html`<tr><td><a href="${x.sourceFile.replace(/^hsdd\//, "../")}">${x.id}</a></td><td>${x.title}</td><td><span class="badge status-${x.status}">${x.status}</span></td><td>${inline(x.decision)}</td><td>${x.affects.map((t) => chip(t, ctx.byId.has(t) ? href(ctx.a, "node", t) : ctx.model.contracts.some((c) => c.ref === t) ? href(ctx.a, "contract", t) : null))}</td></tr>`)}
      </tbody></table>`;
  return { title: "Decisions", crumbs: [{ label: "Decisions", href: href(ctx.a, "adrs") }], body: body.s, diagrams: [] };
}

function readability(ctx) {
  if (ctx.stake || !ctx.page.readability.length) return raw("");
  return section("Readability notes", html`<ul>${ctx.page.readability.map((f) => html`<li><code>${f.key}</code>: ${f.message}</li>`)}</ul>`, "readability");
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `node --test test/views-plan.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add skills/hsdd-summary/scripts/views-core.mjs skills/hsdd-summary/scripts/views-plan.mjs test/views-plan.test.mjs
git commit -m "feat(hsdd-summary): plan page views for reviewer, stakeholder and implementer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 7: Vendor the layout engine

**Files:**
- Create: `skills/hsdd-summary/scripts/vendor/dagre.min.js`, `vendor/LICENSE`, `vendor/dagre.min.js.LEGAL.txt`, `vendor/README.md`
- Test: `test/vendor.test.mjs`

**Interfaces:**
- Produces: the global `dagre` (with `dagre.graphlib.Graph` and `dagre.layout`) for the page runtime in Task 8. It needs `structuredClone`, which every current browser provides.

- [ ] **Step 1: Write the failing test**

Create `test/vendor.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = new URL("../skills/hsdd-summary/scripts/vendor/", import.meta.url);

test("the vendored layout engine is the pinned file, with its notices", () => {
  const bytes = readFileSync(new URL("dagre.min.js", dir));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "3152d214941a5df3a3d4c079dfa338c3cd7a6c0d4c1b4c3a2fdb6bba6f6facf9");
  for (const f of ["LICENSE", "dagre.min.js.LEGAL.txt", "README.md"]) assert.ok(existsSync(new URL(f, dir)), f);
  assert.doesNotMatch(bytes.toString("utf8"), /<\/script|<!--/i);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/vendor.test.mjs`
Expected: FAIL with `ENOENT` for `dagre.min.js`.

- [ ] **Step 3: Download, verify, copy**

```bash
rm -rf /tmp/hsdd-dagre && mkdir -p /tmp/hsdd-dagre
curl -sSfL -o /tmp/hsdd-dagre/dagre.tgz https://registry.npmjs.org/@dagrejs/dagre/-/dagre-3.1.1.tgz
tar xzf /tmp/hsdd-dagre/dagre.tgz -C /tmp/hsdd-dagre
shasum -a 256 /tmp/hsdd-dagre/package/dist/dagre.min.js
```

Expected: `3152d214941a5df3a3d4c079dfa338c3cd7a6c0d4c1b4c3a2fdb6bba6f6facf9`. Any other hash: stop and report; do not continue with a different file.

```bash
mkdir -p skills/hsdd-summary/scripts/vendor
cp /tmp/hsdd-dagre/package/dist/dagre.min.js /tmp/hsdd-dagre/package/dist/dagre.min.js.LEGAL.txt /tmp/hsdd-dagre/package/LICENSE skills/hsdd-summary/scripts/vendor/
```

- [ ] **Step 4: Write the vendor README**

Create `skills/hsdd-summary/scripts/vendor/README.md`:

```markdown
# Vendored layout engine

`dagre.min.js` is `@dagrejs/dagre` 3.1.1, the file `package/dist/dagre.min.js`
from <https://registry.npmjs.org/@dagrejs/dagre/-/dagre-3.1.1.tgz>: 48,956
bytes, sha256 `3152d214941a5df3a3d4c079dfa338c3cd7a6c0d4c1b4c3a2fdb6bba6f6facf9`.
It is MIT licensed; `LICENSE` and `dagre.min.js.LEGAL.txt` beside it are the
package's own notices, copied unchanged.

`summary.mjs render` inlines it into every page, so diagrams lay out with no
network, no build step and no viewer. Never edit it. A new version is a new
download with a new pin, here and in `test/vendor.test.mjs`.
```

- [ ] **Step 5: Run it to verify it passes**

Run: `node --test test/vendor.test.mjs`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add skills/hsdd-summary/scripts/vendor test/vendor.test.mjs
git commit -m "feat(hsdd-summary): vendor dagre 3.1.1 (MIT), pinned by sha256

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 8: The page runtime, styles and assembler

**Files:**
- Create: `skills/hsdd-summary/scripts/app.js`, `skills/hsdd-summary/scripts/page.css`, `skills/hsdd-summary/scripts/html.mjs`
- Test: `test/html.test.mjs`

**Interfaces:**
- Consumes: `views-core.mjs`, `graph.mjs`, `views-plan.mjs` (inlined), `safeJson`, the vendored `dagre`.
- Produces: `renderPage({ kind, page, stamp }) -> html string`; `toClassic(moduleSource)`; `KINDS` (the page kinds: views to inline, audiences, nav and keys). `app.js` expects, in the same script, `parseRoute`, `href`, `esc` and `PAGE_VIEWS = { audiences, render, keys }`, and in the document `#hsdd-page` (JSON), `#main`, `#crumbs`, `#keys`, `#theme`, `[data-audience]`, `[data-nav]`, `[data-skip]`.
- The runtime never writes `style=` attributes or inline handlers (the CSP forbids both); storage is wrapped in `try`/`catch`; the skip control is a button, so it never changes the route; a `[data-copy]` button copies its code block's text.

- [ ] **Step 1: Write the failing test**

Create `test/html.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { completedModel, planPage } from "./helpers/plan-fixture.mjs";
import { crossCheckPlan } from "../skills/hsdd-summary/scripts/checks-plan.mjs";
import { renderPage, toClassic } from "../skills/hsdd-summary/scripts/html.mjs";
import { renderPlan, PLAN_AUDIENCES } from "../skills/hsdd-summary/scripts/views-plan.mjs";
import { readPageStamp } from "../skills/hsdd-summary/scripts/stamp.mjs";

const model = completedModel();
const page = planPage(model, { findings: crossCheckPlan(model).findings, project: model.project, generated: "2026-10-09" });
const stamp = { kind: "plan", generated: "2026-10-09", specSha: "abc1234", inputs: { "hsdd/spec/acme.md": "sha256:" + "a".repeat(64) } };
const out = renderPage({ kind: "plan", page, stamp });

const sha = (t) => `'sha256-${createHash("sha256").update(t, "utf8").digest("base64")}'`;
const scripts = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const style = /<style>([\s\S]*?)<\/style>/.exec(out)[1];
const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(out)[1].replace(/&#39;/g, "'");

test("one file: CSP lists the exact hash of every inline script and the style", () => {
  assert.equal(scripts.length, 2);
  for (const s of scripts) assert.ok(csp.includes(sha(s)), "script hash missing from CSP");
  assert.ok(csp.includes(`style-src ${sha(style)}`));
  assert.match(csp, /^default-src 'none';/);
});

test("offline: no src attributes, no external URLs in attributes", () => {
  assert.doesNotMatch(out, /\ssrc=/i);
  assert.doesNotMatch(out, /(href|src|action)="https?:/i);
});

test("every link a view renders is a route or a relative source link", () => {
  const routes = [{ view: "top" }, ...model.nodes.map((n) => ({ view: "node", id: n.id })), ...model.phases.map((p) => ({ view: "phase", id: p.id })), { view: "contracts" }, { view: "adrs" }];
  for (const audience of PLAN_AUDIENCES) for (const r of routes) {
    for (const [, h] of renderPlan(page, { audience, ...r }).body.matchAll(/href="([^"]*)"/g)) assert.match(h, /^(#|\.\.\/)/, h);
  }
});

test("the bundle compiles as a classic script and defines what the runtime needs", () => {
  new vm.Script(scripts[1]);
  assert.match(scripts[1], /const PAGE_VIEWS = \{ audiences: PLAN_AUDIENCES, render: renderPlan/);
  assert.doesNotMatch(scripts[1], /^\s*(import|export)\s/m);
});

test("the page carries its data and stamp, readable back", () => {
  assert.deepEqual(readPageStamp(out), stamp);
  const data = JSON.parse(/<script type="application\/json" id="hsdd-page">([^<]*)<\/script>/.exec(out)[1]);
  assert.equal(data.model.project.root, "acme");
});

test("toClassic drops imports and unexports declarations only", () => {
  const src = 'import { a } from "./a.mjs";\nexport const X = 1;\nexport function f() {}\nexport class C {}\nconst s = "export const";\n';
  assert.equal(toClassic(src), 'const X = 1;\nfunction f() {}\nclass C {}\nconst s = "export const";\n');
});

test("hostile model text cannot break out of the data script", () => {
  const m = completedModel();
  m.nodes[1].name = "</script><script>alert(1)</script>";
  const html = renderPage({ kind: "plan", page: planPage(m, { project: m.project }), stamp });
  assert.equal((html.match(/<script/g) ?? []).length, 4);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/html.test.mjs`
Expected: FAIL with `Cannot find module` for `html.mjs`.

- [ ] **Step 3: Write the runtime**

Create `skills/hsdd-summary/scripts/app.js`:

```js
// Page runtime: routes, audiences, diagrams, keyboard, theme. Runs in the
// browser after the view functions and PAGE_VIEWS are defined in this script.
(function () {
  "use strict";
  const page = JSON.parse(document.getElementById("hsdd-page").textContent);
  const main = document.getElementById("main");
  const crumbs = document.getElementById("crumbs");
  const store = {
    get(k) {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        /* storage blocked: the setting lasts for this visit only */
      }
    },
  };

  function route() {
    return parseRoute(window.location.hash, PAGE_VIEWS.audiences);
  }

  function go(audience, view, id) {
    window.location.hash = view && view !== "top" ? href(audience, view, id) : href(audience);
  }

  function wrap(text, max, maxLines) {
    const out = [];
    for (const para of String(text || "").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        if ((line + " " + word).trim().length > max && line) {
          out.push(line);
          line = word;
        } else line = (line + " " + word).trim();
      }
      if (line) out.push(line);
    }
    if (out.length > maxLines) return [...out.slice(0, maxLines - 1), out[maxLines - 1].slice(0, max - 1) + "…"];
    return out;
  }

  function drawDiagram(slotId, spec) {
    const W = 216;
    const LINE = 16;
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: spec.direction || "LR", nodesep: 22, ranksep: 64, marginx: 10, marginy: 10 });
    g.setDefaultEdgeLabel(() => ({}));
    const lines = new Map();
    for (const n of spec.nodes) {
      const sub = wrap(n.sub, 30, 5);
      lines.set(n.id, sub);
      g.setNode(n.id, { width: W, height: 36 + sub.length * LINE + 6 });
    }
    spec.edges.forEach((e, i) => {
      const label = e.label ? wrap(e.label, 28, 2) : [];
      g.setEdge(e.from, e.to, label.length ? { width: 170, height: label.length * 14 + 4, labelpos: "c", lines: label } : {}, "e" + i);
    });
    dagre.layout(g);
    const size = g.graph();
    const marker = `arrow-${slotId}`;
    let svg = `<svg class="dg" viewBox="0 0 ${Math.ceil(size.width)} ${Math.ceil(size.height)}" width="${Math.ceil(size.width)}" height="${Math.ceil(size.height)}" role="img" aria-label="${esc(spec.nodes.length + " boxes")}">`;
    svg += `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>`;
    spec.edges.forEach((e, i) => {
      const ed = g.edge({ v: e.from, w: e.to, name: "e" + i });
      if (!ed) return;
      const d = ed.points.map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      svg += `<path class="edge edge-${esc(e.kind)}" d="${d}"${e.kind === "collides" ? "" : ` marker-end="url(#${marker})"`}/>`;
      if (ed.lines) {
        svg += `<text class="edge-label" x="${ed.x.toFixed(1)}" y="${(ed.y - ((ed.lines.length - 1) * 14) / 2 + 4).toFixed(1)}" text-anchor="middle">`;
        ed.lines.forEach((l, k) => (svg += `<tspan x="${ed.x.toFixed(1)}" dy="${k ? 14 : 0}">${esc(l)}</tspan>`));
        svg += `</text>`;
      }
    });
    for (const n of spec.nodes) {
      const box = g.node(n.id);
      const x = box.x - box.width / 2;
      const y = box.y - box.height / 2;
      const inner =
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${box.width}" height="${box.height}" rx="8"/>` +
        `<text class="box-label" x="${(x + 12).toFixed(1)}" y="${(y + 22).toFixed(1)}">${esc(wrap(n.label, 26, 1)[0] || "")}</text>` +
        lines.get(n.id).map((l, k) => `<text class="box-sub" x="${(x + 12).toFixed(1)}" y="${(y + 42 + k * LINE).toFixed(1)}">${esc(l)}</text>`).join("");
      svg += n.href
        ? `<a class="box role-${esc(n.role)}" href="${esc(n.href)}" data-key="box:${esc(n.id)}" tabindex="0"><title>${esc(n.label)}</title>${inner}</a>`
        : `<g class="box role-${esc(n.role)}"><title>${esc(n.label)}</title>${inner}</g>`;
    }
    svg += `</svg>`;
    const legend = spec.legend.length
      ? `<ul class="legend">${spec.legend.map((l) => `<li><span class="${l.edge ? "key-edge edge-" + esc(l.edge) : "key-box role-" + esc(l.swatch)}"></span>${esc(l.text)}</li>`).join("")}</ul>`
      : "";
    return `<div class="dg-scroll">${svg}</div>${legend}`;
  }

  function draw() {
    const r = route();
    const active = document.activeElement;
    const focusKey = active && active.getAttribute ? active.getAttribute("data-key") : null;
    const view = PAGE_VIEWS.render(page, r);
    document.title = view.title === page.project.name ? view.title : `${view.title} \u00b7 ${page.project.name}`;
    main.innerHTML = view.body;
    crumbs.innerHTML = view.crumbs
      .map((c, i) => (i === view.crumbs.length - 1 ? `<span aria-current="page">${esc(c.label)}</span>` : `<a href="${esc(c.href)}">${esc(c.label)}</a>`))
      .join(`<span class="sep" aria-hidden="true">/</span>`);
    for (const d of view.diagrams) {
      const slot = main.querySelector(`[data-diagram="${d.id}"]`);
      if (slot) slot.innerHTML = drawDiagram(d.id, d.spec);
    }
    for (const b of document.querySelectorAll("[data-audience]")) b.setAttribute("aria-pressed", String(b.getAttribute("data-audience") === r.audience));
    for (const a of document.querySelectorAll("[data-nav]")) {
      const path = a.getAttribute("data-nav");
      a.setAttribute("href", path ? href(r.audience, path) : href(r.audience));
    }
    if (focusKey) {
      const again = main.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (again) again.focus();
    }
  }

  function setTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }

  document.addEventListener("click", (ev) => {
    const aud = ev.target.closest("[data-audience]");
    if (aud) {
      const r = route();
      go(aud.getAttribute("data-audience"), r.view, r.id);
      return;
    }
    const copy = ev.target.closest("[data-copy]");
    if (copy) {
      const code = copy.parentElement.querySelector("code");
      const done = (word) => {
        copy.textContent = word;
        window.setTimeout(() => (copy.textContent = "Copy"), 1500);
      };
      try {
        window.navigator.clipboard.writeText(code.textContent).then(() => done("Copied"), () => done("Select and copy"));
      } catch {
        done("Select and copy");
      }
      return;
    }
    if (ev.target.closest("[data-skip]")) {
      main.focus();
      return;
    }
    if (ev.target.closest("#theme")) {
      const dark = document.documentElement.getAttribute("data-theme") === "dark" || (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const next = dark ? "light" : "dark";
      setTheme(next);
      store.set("hsdd-summary-theme", next);
      return;
    }
    if (ev.target.closest("#keys")) {
      const btn = document.getElementById("keys");
      const on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(on));
      store.set("hsdd-summary-keys", on ? "on" : "off");
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.matches && ev.target.matches("a.box")) {
      window.location.hash = ev.target.getAttribute("href");
      ev.preventDefault();
      return;
    }
    if (ev.altKey || ev.ctrlKey || ev.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    if (document.getElementById("keys").getAttribute("aria-pressed") !== "true") return;
    const r = route();
    const n = Number(ev.key);
    if (n >= 1 && n <= PAGE_VIEWS.audiences.length) return go(PAGE_VIEWS.audiences[n - 1], r.view, r.id);
    if (ev.key === "u") {
      const links = crumbs.querySelectorAll("a");
      if (links.length) window.location.hash = links[links.length - 1].getAttribute("href");
      return;
    }
    if (ev.key in PAGE_VIEWS.keys) go(r.audience, PAGE_VIEWS.keys[ev.key] || "top");
  });

  setTheme(store.get("hsdd-summary-theme"));
  if (store.get("hsdd-summary-keys") === "off") document.getElementById("keys").setAttribute("aria-pressed", "false");
  window.addEventListener("hashchange", draw);
  draw();
})();
```

- [ ] **Step 4: Write the styles**

Create `skills/hsdd-summary/scripts/page.css`:

```css
/* hsdd-summary page styles. Palette: the mermaid-pastel-style roles HSDD's
   diagrams use, so the page matches the Mermaid diagrams in the specs. */
:root {
  --ink: #1e293b;
  --muted: #64748b;
  --line: #475569;
  --rule: #e2e8f0;
  --paper: #f8fafc;
  --card: #ffffff;
  --accent: #4f46e5;
  --process-bg: #f3e8ff; --process: #7c3aed;
  --decision-bg: #fef3c7; --decision: #d97706;
  --flow-bg: #e0e7ff; --flow: #4f46e5;
  --done-bg: #d1fae5; --done: #059669;
  --fail-bg: #fee2e2; --fail: #dc2626;
  --impl-bg: #dbeafe; --impl: #2563eb;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ink: #e2e8f0; --muted: #94a3b8; --line: #94a3b8; --rule: #334155;
    --paper: #0f172a; --card: #1e293b; --accent: #818cf8;
    --process-bg: #2e1065; --process: #a78bfa;
    --decision-bg: #451a03; --decision: #fbbf24;
    --flow-bg: #1e1b4b; --flow: #818cf8;
    --done-bg: #052e16; --done: #34d399;
    --fail-bg: #450a0a; --fail: #f87171;
    --impl-bg: #172554; --impl: #60a5fa;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ink: #e2e8f0; --muted: #94a3b8; --line: #94a3b8; --rule: #334155;
  --paper: #0f172a; --card: #1e293b; --accent: #818cf8;
  --process-bg: #2e1065; --process: #a78bfa;
  --decision-bg: #451a03; --decision: #fbbf24;
  --flow-bg: #1e1b4b; --flow: #818cf8;
  --done-bg: #052e16; --done: #34d399;
  --fail-bg: #450a0a; --fail: #f87171;
  --impl-bg: #172554; --impl: #60a5fa;
  color-scheme: dark;
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
code { font: 0.9em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
a { color: var(--accent); }
.muted, .source { color: var(--muted); }
.skip { position: absolute; left: -999px; top: 8px; }
.skip:focus { left: 16px; z-index: 10; }

.bar {
  position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center;
  padding: 10px 16px; background: var(--card); border-bottom: 3px solid var(--accent);
}
.brand { font-size: 15px; }
.brand .mark { color: var(--accent); font-weight: 700; letter-spacing: 0.04em; margin-right: 8px; }
.views, .audience, .tools { display: flex; gap: 6px; flex-wrap: wrap; }
.views a, .audience button, .tools button {
  font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--rule);
  background: var(--paper); color: var(--ink); text-decoration: none; cursor: pointer;
}
.audience button[aria-pressed="true"], .tools button[aria-pressed="true"] { background: var(--flow-bg); border-color: var(--flow); }
kbd { font: 11px ui-monospace, monospace; padding: 0 4px; border: 1px solid var(--rule); border-radius: 4px; margin-left: 4px; color: var(--muted); }

.crumbs { max-width: 1120px; margin: 12px auto 0; padding: 0 16px; font-size: 13px; color: var(--muted); }
.crumbs .sep { margin: 0 6px; }
main { display: block; max-width: 1120px; margin: 0 auto; padding: 8px 16px 48px; outline: none; }
.page-head h1 { margin: 2px 0 4px; font-size: 26px; line-height: 1.25; }
.eyebrow { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.id { margin: 0; color: var(--muted); }
.explain { font-size: 17px; margin: 8px 0; max-width: 70ch; }
.note { border-left: 3px solid var(--flow); padding-left: 10px; max-width: 70ch; }
section { margin-top: 28px; }
section h2 { font-size: 17px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--rule); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
dt { font-weight: 600; color: var(--muted); }
dd { margin: 0; }
dd p, dd ul { margin: 0; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
tr.muted td { color: var(--muted); }
.cards { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.cards.single { grid-template-columns: 1fr; }
.card { background: var(--card); border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; }
.card h3 { margin: 4px 0; font-size: 16px; }
.card p { margin: 4px 0; }

.chip, .badge {
  display: inline-block; font-size: 12px; line-height: 1.6; padding: 0 8px; border-radius: 999px;
  border: 1px solid var(--rule); background: var(--paper); color: var(--ink); text-decoration: none; margin: 1px 2px;
}
.chip.missing, .badge.warn, .chip.warn { background: var(--decision-bg); border-color: var(--decision); }
.chip.external { border-style: dashed; }
.badge.tier-gate-only, .chip.tier-gate-only { background: var(--done-bg); border-color: var(--done); }
.badge.tier-spot-check, .chip.tier-spot-check { background: var(--impl-bg); border-color: var(--impl); }
.badge.tier-full-review, .chip.tier-full-review { background: var(--process-bg); border-color: var(--process); }
.badge.status-stable, .badge.status-accepted, .badge.status-done { background: var(--done-bg); border-color: var(--done); }
.badge.status-draft, .badge.status-proposed, .badge.status-in-progress { background: var(--impl-bg); border-color: var(--impl); }
.badge.status-contingent { background: var(--decision-bg); border-color: var(--decision); }
.badge.sev-High { background: var(--fail-bg); border-color: var(--fail); }
.badge.sev-Medium { background: var(--decision-bg); border-color: var(--decision); }
.badge.sev-Low { background: var(--flow-bg); border-color: var(--flow); }
.check ul { padding-left: 20px; }
.check li { margin: 2px 0; }

.diagram { margin: 16px 0; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; padding: 8px; }
.dg-scroll { overflow-x: auto; }
.dg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
.dg rect { fill: var(--card); stroke: var(--line); stroke-width: 1.2; }
.dg .box-label { font: 600 14px system-ui, sans-serif; fill: var(--ink); }
.dg .box-sub { font: 12px system-ui, sans-serif; fill: var(--muted); }
.dg a.box { cursor: pointer; }
.dg a.box:focus { outline: none; }
.dg a.box:focus rect, .dg a.box:hover rect { stroke-width: 3; stroke: var(--accent); }
.dg .edge { fill: none; stroke: var(--line); stroke-width: 1.5; }
.dg .arrowhead { fill: var(--line); }
.dg .edge-event { stroke-dasharray: 6 4; }
.dg .edge-shared-model { stroke-dasharray: 2 4; }
.dg .edge-collides { stroke: var(--fail); stroke-dasharray: 5 4; }
.dg .edge-label { font: 11px system-ui, sans-serif; fill: var(--muted); paint-order: stroke; stroke: var(--card); stroke-width: 4px; }
.role-internal rect, .key-box.role-internal { fill: var(--process-bg); stroke: var(--process); }
.role-leaf rect, .key-box.role-leaf { fill: var(--impl-bg); stroke: var(--impl); }
.role-asbuilt rect, .key-box.role-asbuilt { fill: var(--flow-bg); stroke: var(--flow); stroke-dasharray: 4 3; }
.role-outside rect, .key-box.role-outside { fill: var(--decision-bg); stroke: var(--decision); }
.role-step rect, .key-box.role-step { fill: var(--flow-bg); stroke: var(--flow); }
.role-tier-gate-only rect, .key-box.role-tier-gate-only { fill: var(--done-bg); stroke: var(--done); }
.role-tier-spot-check rect, .key-box.role-tier-spot-check { fill: var(--impl-bg); stroke: var(--impl); }
.role-tier-full-review rect, .key-box.role-tier-full-review { fill: var(--process-bg); stroke: var(--process); }
.role-status-done rect, .key-box.role-status-done { fill: var(--done-bg); stroke: var(--done); }
.role-status-in-progress rect, .key-box.role-status-in-progress { fill: var(--impl-bg); stroke: var(--impl); }
.role-status-planned rect, .key-box.role-status-planned { fill: var(--card); stroke: var(--line); }
.role-status-contingent rect, .key-box.role-status-contingent { fill: var(--decision-bg); stroke: var(--decision); }
.role-sync rect, .key-box.role-sync { fill: var(--decision-bg); stroke: var(--decision); stroke-width: 2; }
.role-lane-step rect, .key-box.role-lane-step { fill: var(--impl-bg); stroke: var(--impl); }
.key-box.role-internal { background: var(--process-bg); border-color: var(--process); }
.key-box.role-leaf, .key-box.role-tier-spot-check, .key-box.role-status-in-progress, .key-box.role-lane-step { background: var(--impl-bg); border-color: var(--impl); }
.key-box.role-asbuilt { background: var(--flow-bg); border-color: var(--flow); border-style: dashed; }
.key-box.role-step { background: var(--flow-bg); border-color: var(--flow); }
.key-box.role-outside, .key-box.role-status-contingent, .key-box.role-sync { background: var(--decision-bg); border-color: var(--decision); }
.key-box.role-tier-gate-only, .key-box.role-status-done { background: var(--done-bg); border-color: var(--done); }
.key-box.role-tier-full-review { background: var(--process-bg); border-color: var(--process); }
.key-box.role-status-planned { background: var(--card); border-color: var(--line); }
.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 8px 4px 0; margin: 0; font-size: 12px; color: var(--muted); }
.legend li { display: flex; align-items: center; gap: 6px; }
.key-box { display: inline-block; width: 16px; height: 12px; border: 1.5px solid var(--line); border-radius: 3px; }
.key-edge { display: inline-block; width: 26px; border-top: 2px solid var(--line); }
.key-edge.edge-event { border-top-style: dashed; }
.key-edge.edge-shared-model { border-top-style: dotted; }
.key-edge.edge-collides { border-top: 2px dashed var(--fail); }

.stamp { max-width: 1120px; margin: 0 auto; padding: 16px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--rule); }
@media (max-width: 640px) {
  dl { grid-template-columns: 1fr; }
  .page-head h1 { font-size: 22px; }
}
.steps { padding-left: 24px; }
.steps li { margin: 4px 0; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin: 16px 0; }
.tile { background: var(--card); border: 1px solid var(--rule); border-radius: 10px; padding: 10px 12px; }
.tile dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.tile dd { margin-top: 4px; font-size: 14px; }
.gates { list-style: none; padding: 0; margin: 0; }
.gates li { display: grid; grid-template-columns: minmax(0, 1fr) 170px 64px 48px; align-items: center; gap: 4px 10px; padding: 8px 0; border-bottom: 1px solid var(--rule); }
.gates li > p { grid-column: 1 / -1; margin: 2px 0 0; }
.gate-name { min-width: 0; }
@media (max-width: 640px) { .gates li { grid-template-columns: minmax(0, 1fr) 90px 56px 32px; } .meter { width: 90px; } }
.gate-count { font-variant-numeric: tabular-nums; margin-left: 6px; }
.meter { display: inline-block; vertical-align: middle; width: 160px; height: 10px; border-radius: 999px; background: var(--rule); overflow: hidden; }
.meter-fill { display: block; height: 100%; background: var(--done); }
.move { font-size: 12px; margin-left: 6px; }
.move-up { color: var(--done); }
.move-down { color: var(--fail); }
.blockers li { margin: 6px 0; }
.step, .decision { margin: 12px 0; }
.detail { border-top: 1px solid var(--rule); margin-top: 8px; padding-top: 8px; }
.code { position: relative; margin: 8px 0; }
.code pre { background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; padding: 12px; overflow-x: auto; white-space: pre-wrap; }
.copy { position: absolute; top: 6px; right: 6px; font: inherit; font-size: 12px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--rule); background: var(--card); color: var(--ink); cursor: pointer; }
li.cb { list-style: none; margin-left: -18px; }
.box-mark { font-size: 15px; }
.table-wrap { overflow-x: auto; }
.warn-text { color: var(--fail); font-weight: 600; }
.chip.sync { background: var(--decision-bg); border-color: var(--decision); }
.chip.status-done { background: var(--done-bg); border-color: var(--done); }
.chip.sev-High { background: var(--fail-bg); border-color: var(--fail); }
.chip.sev-Medium { background: var(--decision-bg); border-color: var(--decision); }
.chip.sev-Low { background: var(--flow-bg); border-color: var(--flow); }
blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid var(--rule); color: var(--muted); }
.meter-fill.w0 { width: 0%; }
.meter-fill.w5 { width: 5%; }
.meter-fill.w10 { width: 10%; }
.meter-fill.w15 { width: 15%; }
.meter-fill.w20 { width: 20%; }
.meter-fill.w25 { width: 25%; }
.meter-fill.w30 { width: 30%; }
.meter-fill.w35 { width: 35%; }
.meter-fill.w40 { width: 40%; }
.meter-fill.w45 { width: 45%; }
.meter-fill.w50 { width: 50%; }
.meter-fill.w55 { width: 55%; }
.meter-fill.w60 { width: 60%; }
.meter-fill.w65 { width: 65%; }
.meter-fill.w70 { width: 70%; }
.meter-fill.w75 { width: 75%; }
.meter-fill.w80 { width: 80%; }
.meter-fill.w85 { width: 85%; }
.meter-fill.w90 { width: 90%; }
.meter-fill.w95 { width: 95%; }
.meter-fill.w100 { width: 100%; }
```

- [ ] **Step 5: Write the assembler**

Create `skills/hsdd-summary/scripts/html.mjs`:

```js
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
  const dagre = here("./vendor/dagre.min.js");
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
```

- [ ] **Step 6: Run it to verify it passes**

Run: `node --test test/html.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add skills/hsdd-summary/scripts/app.js skills/hsdd-summary/scripts/page.css skills/hsdd-summary/scripts/html.mjs test/html.test.mjs
git commit -m "feat(hsdd-summary): one-file page with a hash-based CSP, runtime and styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 9: The command line

**Files:**
- Create: `skills/hsdd-summary/scripts/summary.mjs`
- Test: `test/cli.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `main(argv, root) -> exit code` and the commands `extract plan`, `validate [plan]`, `slots [plan]`, `lint [plan]`, `stamp [plan]`, `render [plan] [-o hsdd/summary/x.html]`, `check`, each taking `--model <path>` (default: `hsdd-summary-plan-model.json` in the OS temp directory); `KINDS` (per page kind: schema, page file, prose file, extract, check, slots, glossKeys, inputs, extras, present); `specSha(root)`. Each page kind has its own prose store (`prose.json` for the plan page), so one page's prose never makes another page stale; `check` re-extracts every kind whose `present(root)` holds. `check` always exits 0; `render` refuses an invalid model, an empty required slot, or an output path outside `hsdd/summary/`; `stamp` refuses a page.

- [ ] **Step 1: Write the failing test**

Create `test/cli.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TREE } from "./helpers/plan-fixture.mjs";
import { main } from "../skills/hsdd-summary/scripts/summary.mjs";

function run(root, ...argv) {
  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    const code = main(argv, root);
    return { code, out: lines.join("\n") };
  } catch (e) {
    return { code: 1, out: lines.join("\n"), error: e.message };
  } finally {
    console.log = log;
  }
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "hsdd-cli-"));
  cpSync(TREE, root, { recursive: true });
  return { root, model: join(root, "model.json") };
}

function fillUnparsed(path) {
  const m = JSON.parse(readFileSync(path, "utf8"));
  m.phases[4].tier = "spot-check";
  m.phases[5].dependsOn = ["acme.web.console.2"];
  m.unparsed = [];
  writeFileSync(path, JSON.stringify(m));
}

function fillProse(root) {
  const p = join(root, "hsdd/summary/prose.json");
  const g = join(root, "hsdd/summary/glossary.json");
  const s = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(s.entries)) if (k.startsWith("explain:")) s.entries[k].text = "Plain words about what this part does.";
  writeFileSync(p, JSON.stringify(s));
  const gl = JSON.parse(readFileSync(g, "utf8"));
  for (const k of Object.keys(gl.entries)) gl.entries[k] = "a connection";
  writeFileSync(g, JSON.stringify(gl));
}

test("the whole pipeline: extract, validate, slots, stamp, render, check", () => {
  const { root, model } = project();
  let r = run(root, "extract", "plan", "--model", model);
  assert.equal(r.code, 0);
  assert.match(r.out, /unparsed: .* \(2\)/);
  assert.equal(run(root, "validate", "--model", model).code, 1);
  fillUnparsed(model);
  assert.equal(run(root, "validate", "--model", model).code, 0);
  r = run(root, "render", "--model", model);
  assert.match(r.error, /required slot\(s\) are empty/);
  r = run(root, "slots", "--model", model);
  assert.match(r.out, /explain:acme \(max 25 words, no ids\)/);
  fillProse(root);
  assert.match(run(root, "stamp", "--model", model).out, /restamped \(5\)/);
  r = run(root, "render", "--model", model);
  assert.equal(r.code, 0, r.error);
  assert.ok(existsSync(join(root, "hsdd/summary/summary.html")));
  assert.match(run(root, "check").out, /summary\.html: fresh/);
  appendFileSync(join(root, "hsdd/spec/acme.ops.md"), "\nmore\n");
  r = run(root, "check");
  assert.equal(r.code, 0);
  assert.match(r.out, /summary\.html: stale\n  changed: hsdd\/spec\/acme\.ops\.md/);
});

test("stamp refuses the page; render refuses a path outside hsdd/summary/", () => {
  const { root, model } = project();
  run(root, "extract", "plan", "--model", model);
  fillUnparsed(model);
  run(root, "slots", "--model", model);
  fillProse(root);
  assert.match(run(root, "stamp", "hsdd/summary/summary.html").error, /stamped by render/);
  assert.match(run(root, "render", "--model", model, "-o", "elsewhere.html").error, /under hsdd\/summary/);
});

test("check survives a malformed prose store and a page with no stamp", () => {
  const { root } = project();
  writeFileSync(join(root, "hsdd/summary.tmp"), "");
  cpSync(join(root, "hsdd/conventions.md"), join(root, "hsdd/summary/x.html"), { force: true });
  writeFileSync(join(root, "hsdd/summary/prose.json"), "{ not json");
  const r = run(root, "check");
  assert.equal(r.code, 0);
  assert.match(r.out, /x\.html: no readable stamp/);
  assert.match(r.out, /prose store unreadable/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL with `Cannot find module` for `summary.mjs`.

- [ ] **Step 3: Implement**

Create `skills/hsdd-summary/scripts/summary.mjs`:

```js
#!/usr/bin/env node
// hsdd-summary CLI: extract | validate | slots | lint | stamp | render | check.
// Run from the project root (the directory that holds hsdd/).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractPlan } from "./extract-plan.mjs";
import { crossCheckPlan } from "./checks-plan.mjs";
import { validate } from "./schema.mjs";
import { planSlots, planGlossaryKeys, emptyStore, seed, proseStatus, stampProse, lintProse } from "./prose.mjs";
import { planInputs, hashInputs, diffInputs, readPageStamp } from "./stamp.mjs";
import { renderPage } from "./html.mjs";

export const KINDS = {
  plan: {
    schema: "./plan-model.schema.json",
    page: "summary.html",
    prose: "prose.json",
    extract: (root, opts) => extractPlan(root, opts),
    check: crossCheckPlan,
    slots: planSlots,
    glossKeys: planGlossaryKeys,
    inputs: (root) => planInputs(root),
    extras: () => ({}),
    present: (root) => existsSync(join(root, "hsdd/spec")),
  },
};

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o") out.o = argv[++i];
    else if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true;
    else out._.push(a);
  }
  return out;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path} is not valid JSON: ${e.message}`);
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function specSha(root) {
  try {
    return execFileSync("git", ["-C", join(root, "hsdd"), "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "n/a";
  }
}

function defaultModel(kind) {
  return join(tmpdir(), `hsdd-summary-${kind}-model.json`);
}

function loadModel(a) {
  const path = a.model ?? defaultModel(a._[1] ?? "plan");
  const model = readJson(path, null);
  if (!model) throw new Error(`no model at ${path}; run extract first`);
  if (!KINDS[model.kind]) throw new Error(`${path} has kind "${model.kind}", which no page draws`);
  return { model, path };
}

// Each page has its own prose store, so writing one page's prose never makes
// the other page stale. The glossary belongs to the plan page.
function proseFiles(root, kind) {
  const dir = join(root, "hsdd/summary");
  return { prosePath: join(dir, KINDS[kind].prose), glossPath: join(dir, "glossary.json") };
}

function loadProse(root, kind) {
  const { prosePath, glossPath } = proseFiles(root, kind);
  const store = readJson(prosePath, emptyStore());
  const glossary = readJson(glossPath, { version: 1, entries: {} });
  if (!store || typeof store.entries !== "object") throw new Error(`${prosePath} has no "entries" object`);
  if (!glossary || typeof glossary.entries !== "object") throw new Error(`${glossPath} has no "entries" object`);
  return { store, glossary };
}

function schemaErrors(model) {
  const schema = JSON.parse(readFileSync(new URL(KINDS[model.kind].schema, import.meta.url), "utf8"));
  return validate(schema, model);
}

function list(label, items, max = 20) {
  if (!items.length) return;
  console.log(`${label} (${items.length}):`);
  for (const x of items.slice(0, max)) console.log(`  ${x}`);
  if (items.length > max) console.log(`  … ${items.length - max} more`);
}

export function main(argv, root = process.cwd()) {
  const a = args(argv);
  const cmd = a._[0];
  if (cmd === "extract") {
    const kind = a._[1] ?? "plan";
    if (!KINDS[kind]) throw new Error(`extract: unknown kind "${kind}"`);
    const model = KINDS[kind].extract(root, { specSha: specSha(root) });
    const path = a.model ?? defaultModel(kind);
    writeJson(path, model);
    console.log(`model: ${path}`);
    list("unparsed: fill each at its path from the source, then delete the entry", model.unparsed.map((u) => `${u.path}  ${u.file}:${u.line}  ${u.reason}`), 200);
    return 0;
  }
  if (cmd === "validate") {
    const { model } = loadModel(a);
    const se = schemaErrors(model);
    const { errors, findings } = KINDS[model.kind].check(model);
    list("schema errors", se, 200);
    list("errors", errors, 200);
    console.log(`findings: ${findings.length} (shown on the page)`);
    return se.length || errors.length ? 1 : 0;
  }
  if (cmd === "slots") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const { store, glossary } = loadProse(root, model.kind);
    const slots = k.slots(model);
    const keys = k.glossKeys(model);
    const seeded = seed(store, glossary, slots, keys);
    const { prosePath, glossPath } = proseFiles(root, model.kind);
    writeJson(prosePath, seeded.store);
    if (keys.length) writeJson(glossPath, seeded.glossary);
    const st = proseStatus(seeded.store, seeded.glossary, slots, keys, model.kind);
    const limit = new Map(slots.map((s) => [s.key, s]));
    list("write first: empty required slots", st.emptyRequired.map((x) => `${x} (max ${limit.get(x).limit} words, no ids)`), 500);
    list("glossary entries to write (a few plain words each)", st.glossEmpty, 500);
    list("stale: the subject changed; rewrite", st.stale, 500);
    list("unstamped: rewritten but not stamped", st.unstamped, 500);
    list("orphaned: subject gone; ask before deleting", [...st.orphaned, ...st.glossOrphaned.map((g) => `glossary:${g}`)], 500);
    console.log(`optional slots empty: ${st.emptyOptional.length}`);
    return 0;
  }
  if (cmd === "lint") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const { store, glossary } = loadProse(root, model.kind);
    const f = lintProse(store, glossary, k.slots(model), k.glossKeys(model), model.ids);
    list("readability findings", f.map((x) => `${x.key}: ${x.message}`), 500);
    if (!f.length) console.log("lint: clean");
    return 0;
  }
  if (cmd === "stamp") {
    if (a._.some((x) => /\.html?$/i.test(x)) || (a.o && /\.html?$/i.test(a.o))) throw new Error("stamp: pages are stamped by render, never by hand");
    const { model } = loadModel(a);
    const { store } = loadProse(root, model.kind);
    const { store: s, restamped } = stampProse(store, KINDS[model.kind].slots(model));
    writeJson(proseFiles(root, model.kind).prosePath, s);
    list("restamped", restamped, 500);
    if (!restamped.length) console.log("stamp: nothing rewritten since the last stamp");
    return 0;
  }
  if (cmd === "render") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const se = schemaErrors(model);
    const checked = k.check(model);
    const { errors, findings } = checked;
    if (se.length || errors.length) throw new Error(`render: the model does not validate (${[...se, ...errors][0]}); run validate`);
    const { store, glossary } = loadProse(root, model.kind);
    const slots = k.slots(model);
    const keys = k.glossKeys(model);
    const st = proseStatus(store, glossary, slots, keys, model.kind);
    if (st.emptyRequired.length || st.glossEmpty.length) throw new Error(`render: ${st.emptyRequired.length + st.glossEmpty.length} required slot(s) are empty (first: ${[...st.emptyRequired, ...st.glossEmpty][0]}); run slots`);
    const out = resolve(root, a.o ?? join("hsdd/summary", k.page));
    if (relative(join(root, "hsdd/summary"), out).startsWith("..")) throw new Error("render: the page must be written under hsdd/summary/");
    const generated = new Date().toISOString().slice(0, 10);
    const page = {
      kind: model.kind,
      project: model.project,
      model,
      prose: Object.fromEntries(Object.entries(store.entries).map(([key, e]) => [key, e.text])),
      gloss: glossary.entries,
      findings,
      readability: lintProse(store, glossary, slots, keys, model.ids),
      generated,
      ...k.extras(model, checked),
    };
    const stamp = { kind: model.kind, generated, specSha: model.project.specSha, inputs: hashInputs(root, k.inputs(root, model)) };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderPage({ kind: model.kind, page, stamp }));
    console.log(`wrote ${relative(root, out)} (${findings.length} findings, ${page.readability.length} readability notes)`);
    return 0;
  }
  if (cmd === "check") {
    const dir = join(root, "hsdd/summary");
    const pages = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".html")).sort() : [];
    if (!pages.length) console.log("check: no pages under hsdd/summary/");
    for (const f of pages) {
      const stamp = readPageStamp(readFileSync(join(dir, f), "utf8"));
      if (!stamp || !KINDS[stamp.kind]) {
        console.log(`${f}: no readable stamp; regenerate it`);
        continue;
      }
      const d = diffInputs(stamp.inputs, hashInputs(root, KINDS[stamp.kind].inputs(root)));
      console.log(`${f}: ${d.fresh ? "fresh" : "stale"}`);
      for (const [label, xs] of [["changed", d.changed], ["added", d.added], ["removed", d.removed]]) if (xs.length) console.log(`  ${label}: ${xs.join(", ")}`);
    }
    const models = [];
    for (const [kind, k] of Object.entries(KINDS)) {
      try {
        if (k.present(root)) models.push(k.extract(root, {}));
      } catch (e) {
        console.log(`cannot re-extract ${kind} to check prose: ${e.message}`);
      }
    }
    for (const model of models) {
      try {
        const k = KINDS[model.kind];
        const { store, glossary } = loadProse(root, model.kind);
        const st = proseStatus(store, glossary, k.slots(model), k.glossKeys(model), model.kind);
        list(`stale ${model.kind} prose entries`, st.stale);
        list(`unstamped ${model.kind} prose entries`, st.unstamped);
      } catch (e) {
        console.log(`prose store unreadable: ${e.message}`);
      }
    }
    return 0;
  }
  console.log("usage: summary.mjs extract plan | validate | slots | lint | stamp | render [-o hsdd/summary/x.html] | check   [--model path]");
  return cmd ? 2 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Run the whole suite**

Run: `node --test test/*.test.mjs`
Expected: PASS, 78 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/scripts/summary.mjs test/cli.test.mjs
git commit -m "feat(hsdd-summary): the command line, end to end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 10: Check the rendered page in a real browser

**Files:**
- Modify: any file under `skills/hsdd-summary/scripts/` only if this check exposes a defect (fix it test-first: add the failing assertion to the owning test file, then the fix).

**Interfaces:**
- Consumes: the CLI and the fixture.

Node tests cannot run the page's DOM code. This task renders the fixture page and runs it in headless Chrome.

- [ ] **Step 1: Render the fixture page in a scratch copy**

```bash
rm -rf /tmp/hsdd-page && mkdir -p /tmp/hsdd-page && cp -R test/fixtures/tree/hsdd /tmp/hsdd-page/
cd /tmp/hsdd-page
S=~/git/hsdd/skills/hsdd-summary/scripts/summary.mjs
node $S extract plan --model m.json
node -e 'const f=require("fs");const m=JSON.parse(f.readFileSync("m.json"));m.phases[4].tier="spot-check";m.phases[5].dependsOn=["acme.web.console.2"];m.unparsed=[];f.writeFileSync("m.json",JSON.stringify(m))'
node $S slots --model m.json > /dev/null
node -e 'const f=require("fs");const p="hsdd/summary/prose.json",g="hsdd/summary/glossary.json";const s=JSON.parse(f.readFileSync(p)),l=JSON.parse(f.readFileSync(g));for(const k in s.entries)if(k.startsWith("explain:"))s.entries[k].text="Plain words about what this part does.";for(const k in l.entries)l.entries[k]="a connection";f.writeFileSync(p,JSON.stringify(s));f.writeFileSync(g,JSON.stringify(l))'
node $S stamp --model m.json > /dev/null && node $S render --model m.json && node $S check
cd ~/git/hsdd
```

Expected: `wrote hsdd/summary/summary.html (…)` then `summary.html: fresh`.

- [ ] **Step 2: Run each audience and route in headless Chrome**

Serve the directory (`python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/hsdd-page/hsdd` in another shell), then for each of `""`, `#stakeholder`, `#reviewer/node/acme.api`, `#stakeholder/node/acme.api`, `#implementer/phase/acme.api.2`, `#reviewer/contracts`, `#reviewer/adrs`, `#reviewer/node/nope`:

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # or google-chrome on Linux
"$CH" --headless=new --disable-gpu --no-first-run --user-data-dir=/tmp/hsdd-chrome \
  --virtual-time-budget=4000 --enable-logging=stderr --v=0 \
  --dump-dom "http://127.0.0.1:8765/summary/summary.html$HASH" 2>/tmp/hsdd-chrome.log \
  | grep -c 'class="box '
grep -i -E 'uncaught|refused to|violates' /tmp/hsdd-chrome.log
```

Expected box counts: top and `#stakeholder` 4, `node/acme.api` 3 (reviewer and stakeholder), `phase/...` 0, `contracts` 4, `adrs` 0, `node/nope` 4 (it falls back to the top). The `grep` of the log prints nothing: no script error and no CSP violation.

- [ ] **Step 3: Look at it**

Open `/tmp/hsdd-page/hsdd/summary/summary.html` from disk (no server) in a desktop browser and confirm by eye: the diagram fits the width; every legend swatch shows its colour; `1`, `2`, `3`, `t`, `c`, `d`, `u` work, and stop working when Shortcuts is off; Tab reaches each box and Enter opens it; after Enter and Back, focus returns to the same box; Theme switches light and dark; the network panel shows no request. With JavaScript disabled, the `noscript` message appears.

- [ ] **Step 4: Commit (only if Steps 2 or 3 led to a fix)**

```bash
git add skills/hsdd-summary/scripts test
git commit -m "fix(hsdd-summary): what the browser check exposed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 11: The skill and its command

**Files:**
- Create: `skills/hsdd-summary/SKILL.md`, `commands/hsdd-summary.md`

**Interfaces:**
- Consumes: the CLI's commands and the slot table (Task 4).

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-summary-skill.sh <<'EOF'
s=skills/hsdd-summary/SKILL.md
fail=0
for need in "name: hsdd-summary" "## Setup (first run)" "hsdd/scripts/summary/" "## Process (plan page)" "extract plan" "validate plan" "slots plan" "lint plan" "stamp plan" "render plan" "summary.mjs check" "## Writing the Prose" "## Quality Gates" "## Anti-Rationalization"; do
  grep -qF -- "$need" "$s" 2>/dev/null || { echo "MISSING: $need"; fail=1; }
done
grep -q $'\xe2\x80\x94' "$s" 2>/dev/null && { echo "EM-DASH"; fail=1; }
grep -q "hsdd-summary skill" commands/hsdd-summary.md 2>/dev/null || { echo "COMMAND missing"; fail=1; }
exit $fail
EOF
bash /tmp/hsdd-v09-summary-skill.sh
```

Expected: FAIL with every `MISSING` line and `COMMAND missing`.

- [ ] **Step 2: Write the skill**

Create `skills/hsdd-summary/SKILL.md`:

````markdown
---
name: hsdd-summary
description: >
  Use when someone needs to read an HSDD tree without reading every artifact:
  renders the plan page, one offline HTML file that takes a reviewer, a
  stakeholder or an implementer from the root down to the phase cards, with
  What to check at every level, the contracts and the decisions. Triggers:
  "summary page", "review page", "plan page", "summary.html", "a reading aid
  for this MR", "explain the tree to the PM", "show me the plan from the top",
  "stale summaries", "hsdd/summary". Runs at any stage after the root spec
  exists. Do NOT use for writing or changing specs, contracts or ADRs
  (hsdd-spec, hsdd-contract, hsdd-adr), progress or the execution plan
  (hsdd-checkpoint), or the phase context (hsdd-config).
---

# HSDD Summary: Reading Aids

Render optional, derived reading aids over the tree: one offline HTML file
per page, under `hsdd/summary/`. The specs, contracts and ADRs stay the source
of truth; a page only helps a person into them, and if it disagrees with them
the page is wrong.

**Core principle: facts from the scripts, framing from you.** The bundled
scripts compute every id, count, edge, table and diagram. You do two things
only: fill the fields the parser flags as unparsed, by reading the source at
the line it names, and write short plain-English prose into the slots it
lists. You never draw an edge, count anything, restate a contract or edit a
source.

## Pages

| Page | File | Built from | Regenerate |
|------|------|------------|------------|
| Plan page | `hsdd/summary/summary.html` | `hsdd/spec/`, `hsdd/contract/`, `hsdd/adr/`, `hsdd/conventions.md`, the glossary and the prose store | after each `hsdd-spec` level and each phase plan, so the reviewer opens it in the same MR |

Each page is stamped with a hash of every input it read; `check` reports it
stale when any input changes. Nothing gates on a page, and nothing outside
`hsdd/summary/` is ever written.

## Setup (first run)

Copy this skill's `scripts/` directory, `vendor/` included, **verbatim** to
`hsdd/scripts/summary/` in the project (this skill's base directory is printed
when the skill loads). Never retype a file: the copy must be the code the
skill's tests cover, including the escaping and offline rules. Every command
below runs from the project root, the directory that holds `hsdd/`.

## Audiences

| Audience | Reads the page to | Ids | Detail |
|----------|-------------------|-----|--------|
| `reviewer` (default) | approve a spec level or a phase plan, then read the source | shown | full, with What to check |
| `stakeholder` | understand the plan without reading the source | never | names, counts and plain words; no gates, no question text |
| `implementer` | orient before a phase | shown | full, plus gates |

Keys on the page: `1` `2` `3` switch audience, `t` the top, `c` contracts,
`d` decisions, `u` up a level. The Shortcuts button turns them off.

## Process (plan page)

1. **Extract.**

   ```bash
   node hsdd/scripts/summary/summary.mjs extract plan
   ```

   It writes the model to a scratch file and prints every unparsed item:
   a model path (`/phases/4/tier`), the source file and line, and the reason.
2. **Fill each unparsed item from its source.** Open the file at the line,
   read what the artifact says, and set the model field at that path (a tier
   becomes one of `gate-only`, `spot-check`, `full-review`; a dependency list
   becomes full phase ids). Delete the entry from `unparsed`. Never add an
   item the parser did not flag, never guess a value the source does not
   state, and never edit the source: a source defect is a finding for its
   owning skill.
3. **Validate.**

   ```bash
   node hsdd/scripts/summary/summary.mjs validate plan
   ```

   Exit 0 means the model is complete. An error means the extraction is
   wrong; fix the model, not the check. Findings are not errors: they appear
   on the page under What to check.
4. **Seed the prose.**

   ```bash
   node hsdd/scripts/summary/summary.mjs slots plan
   ```

   It adds missing entries to `hsdd/summary/prose.json` and
   `hsdd/summary/glossary.json` and lists what to write first.
5. **Write the prose** (rules and examples below). Write only into empty or
   stale `text` fields and empty glossary entries. Never touch `facts` or
   `textHash`, and never change a glossary entry that has text: people own
   it.
6. **Lint, rewriting at most twice.**

   ```bash
   node hsdd/scripts/summary/summary.mjs lint plan
   ```

   Findings left after the second rewrite stay; the page lists them under
   Readability notes for the reviewer.
7. **Stamp.** `node hsdd/scripts/summary/summary.mjs stamp plan` restamps
   only the entries you rewrote.
8. **Render.** `node hsdd/scripts/summary/summary.mjs render plan` writes
   `hsdd/summary/summary.html`. It refuses while the model does not validate
   or a required slot is empty.
9. **Check.** `node hsdd/scripts/summary/summary.mjs check` must report the
   page `fresh`.
10. **Report:** the page's path, the unparsed items you filled and from
    where, the slots you wrote, and any readability notes left.

Commit `hsdd/summary/` (page, prose store, glossary) with the change it
summarizes. Never commit the scratch model. Under the standalone-spec-repo
profile `hsdd/summary/` lives in the spec repo, so it lands the way every
governance edit does: committed and pushed inside the submodule, then each
implementation repo's pointer bumped.

## Writing the Prose

| Slot | Words | Rule |
|------|-------|------|
| `explain:{node}` (required) | 25 | what the part is for, in words anyone reads; no ids |
| `note:{node}:{audience}` | 40 | what that audience should look at here; the stakeholder note has no ids |
| `delivers:{phase}` | 25 | what is true when the phase is done |
| `promise:{contract}` | 40 | what a consumer can rely on, in plain words; no ids |
| glossary `{contract-id}` (required) | 8 | a plain noun phrase the stakeholder reads instead of the id |

The lint checks the word limit, ids in id-free slots, and markdown. Write
plain sentences, not fragments; say what a thing does, not what it is called.

**Examples.**

- `explain:acme.api`: "Hands out the sign-in passes the web console checks,
  and keeps each merchant's session alive between visits."
- `note:acme.api:reviewer`: "Check that api.3's region choice still waits on
  OQ1; the session contract is provisional until reconcile runs."
- `delivers:acme.api.2`: "A known user gets a signed pass that expires exactly
  one day after it is issued."
- `promise:auth-token@v1`: "A pass always names exactly one user and stops
  working one day after it was issued, with no grace period."
- glossary `auth-token`: "the sign-in pass".

## What the Plan Page Shows

- **From the top down.** The root's parts as boxes, each with its
  explanation; a click (or Enter on a focused box) opens a part, down to a
  leaf-parent's phase graph and each phase's card. Breadcrumbs and `u` go
  back up.
- **Edges come from contracts.** An edge means something in one part consumes
  a contract something in the other produces; contracts produced outside the
  tree arrive from one "Outside the tree" box.
- **A leaf-parent's phases** are coloured by review tier, joined by their
  dependencies; collisions nothing orders are dashed, and collisions a
  dependency already orders are counted, not drawn. More than 12 phases
  collapse into steps (phases with no dependency between them); more than six
  steps become an ordered list.
- **What to check, at every level,** for the part and everything under it:
  full-review phases, contingent phases, contracts named but not written,
  provisional contracts, version drift, missing or proposed ADRs, undrained
  governance updates, phases missing from their summary table, collisions.
- **Contracts and decisions,** each a click away.

## Quality Gates

- [ ] `validate` exited 0, and every unparsed item was filled from the line
      it named.
- [ ] Every required slot and glossary entry has text; no existing glossary
      entry changed.
- [ ] Lint is clean, or its findings stand after at most two rewrites.
- [ ] Prose stamped; page rendered; `check` reports it fresh.
- [ ] No file outside `hsdd/summary/` changed, and the scratch model is not
      committed.
- [ ] The scripts under `hsdd/scripts/summary/` are byte-identical to this
      skill's `scripts/`.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I can see the graph; I'll draw the diagram myself" | The script derives edges from the contracts and reduces the layout. A hand-drawn diagram looks right the day it is drawn and drifts the day after. |
| "The parser missed this field; I'll fix the spec so it parses" | The spec belongs to its skill and its owner. Fill the model from the source; if the source is wrong, that is a finding for hsdd-spec or hsdd-phase-plan. |
| "This unparsed tier is obviously full-review" | Only if the source says so. Read the line it names; if it states no tier, report it rather than invent one. |
| "The explanation needs 40 words to be accurate" | The limit is the point. If it does not fit, you are restating what the page already shows; say what it means. |
| "The stakeholder will understand the ids" | They will not, and the lint fails it. Use the glossary's words. |
| "Lint still complains after two rewrites; one more round" | Two rounds, then the Readability notes. They tell the reviewer where the text is weak, which is worth more than a third rewrite. |
| "The glossary entry is clumsy; I'll improve it" | People own existing entries. Fill empty ones only. |
| "I'll retype the script from memory, it's quicker than copying" | A retyped script is not the one the tests cover: escaping, the offline rule and the id scan are pinned only for the bundled code. Copy the directory verbatim. |
| "The page is stale but close enough" | A stale page shows a plan that no longer exists. Regenerate it, or say in your report that it is stale. |
````

- [ ] **Step 3: Write the command**

Create `commands/hsdd-summary.md`:

```markdown
---
description: Render or refresh the HSDD reading aids under hsdd/summary/
---
Use the hsdd-summary skill for: $ARGUMENTS
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-summary-skill.sh`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add skills/hsdd-summary/SKILL.md commands/hsdd-summary.md
git commit -m "feat(hsdd-summary): the skill and its command

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 12: The engine and the plan page in the specification

**Files:**
- Modify: `spec/hsdd-spec-v0_9.md` (§1.5, chapter 13, §14.1, §15.1, §18.1, §19)

**Interfaces:**
- Consumes: `spec/hsdd-spec-v0_9.md` from Plan A, Task 1 (chapter 13 holds §13.1).
- Produces: §13.2 "The engine" and §13.3 "The plan page". Plan C appends §13.4.

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-spec-b.sh <<'EOF'
f=spec/hsdd-spec-v0_9.md
flat=$(tr '\n' ' ' < "$f" | tr -s ' ')
fail=0
for need in "Eleven skills" "| \`hsdd-summary\` |" "### 13.2 The engine" "### 13.3 The plan page" "hsdd/scripts/summary/" "| Reading aids |" "- **Reading aid:**" "- **Plan page:**" "- **Unparsed item:**" "hsdd-summary, \`hsdd/summary/\`"; do
  printf '%s' "$flat" | grep -qF -- "$need" || { echo "MISSING: $need"; fail=1; }
done
python3 /tmp/hsdd-v09-refs.py "$f" > /dev/null || { echo "REFS BROKEN"; fail=1; }
git diff -U0 "$f" | grep '^+' | grep -q $'\xe2\x80\x94' && { echo "EM-DASH added"; fail=1; }
exit $fail
EOF
bash /tmp/hsdd-v09-spec-b.sh
```

Expected: FAIL with the `MISSING` lines. (`/tmp/hsdd-v09-refs.py` is the reference checker from Plan A, Task 1; recreate it from there if this machine does not have it.)

- [ ] **Step 2: Make the edits**

**2a. §1.5**: replace `Ten skills, one per artifact with its own lifecycle.` with `Eleven skills, one per artifact with its own lifecycle.` and add this row after the `hsdd-milestone` row:

```markdown
| `hsdd-summary` | Render optional reading aids over the canonical artifacts: the plan page, an offline HTML view of the tree from the root down to the phase cards, for a reviewer, a stakeholder or an implementer (chapter 13). | `hsdd/summary/*.html` |
```

**2b. Chapter 13**: after §13.1's last paragraph and before the chapter's closing `---`, insert:

```markdown
### 13.2 The engine

`hsdd-summary` bundles zero-dependency Node scripts, copied verbatim into
`hsdd/scripts/summary/`, and one pipeline serves every page:

1. **Extract.** A script parses what the HSDD templates fix and lists every
   item it could not parse: the model path, the source file and line, and
   the reason.
2. **Fill.** The agent sets each unparsed field from the source line it
   names. It never adds an item, never guesses, never edits a source.
3. **Validate.** A schema and cross-checks over the model. An error means
   the extraction is wrong and stops the run; a finding is a fact about the
   artifacts and appears on the page.
4. **Prose.** The script seeds a prose store and a glossary; the agent
   writes the empty and stale slots within word limits; a lint checks the
   limits, ids where ids are forbidden, and markdown; at most two rewrites;
   then the rewritten entries are stamped with the facts they describe.
5. **Render** writes one HTML file stamped with a hash of every input.
   **Check** reports a stale page or stale prose, and always exits 0.

Every page meets the same requirements. It is one file that makes no
network request, under a Content-Security-Policy that lists the hash of
each inline script and the style. Every value is escaped. Diagrams fit the
viewport and carry a legend; a graph of more than 12 boxes collapses into
steps, and more than six steps become an ordered list. Boxes are focusable
and open on Enter, focus survives a redraw, a skip control moves to the
content without changing the view, and single-key shortcuts can be turned
off. The URL fragment holds the view, and an unknown id falls back to the
top. The stakeholder never sees an id: every id a view prints is
registered and tested for. Inputs that are missing or malformed fail by
name. The vendored layout library is pinned by version and hash. The
palette is `mermaid-pastel-style`'s, in light and dark themes, so the
pages match the Mermaid diagrams in the specs.

### 13.3 The plan page

`hsdd/summary/summary.html`, built from `hsdd/spec/`, `hsdd/contract/`,
`hsdd/adr/`, `hsdd/conventions.md`, the glossary and the prose store. It
starts at the root's parts, each a box with its plain explanation, and
opens down to a leaf-parent's phase graph and each phase's card; contracts
and decisions are a click away.

- **Edges come from contracts.** An edge means something in one part
  consumes a contract something in the other produces; contracts produced
  outside the tree arrive from one "Outside the tree" box. The Mermaid
  dependency DAG is never parsed.
- **Phases** are coloured by review tier and joined by their dependencies;
  collisions nothing orders are dashed, and those a dependency already
  orders are counted, not drawn.
- **What to check**, at every level and for everything beneath it:
  full-review phases, contingent phases, contracts named but not written,
  provisional contracts, version drift in node fields, missing or proposed
  ADRs, undrained governance updates, phases missing from their summary
  table, and collisions.
- **Three audiences.** The reviewer (default) reads it to approve a level
  and then the source; the stakeholder reads names, counts and plain words,
  never an id; the implementer gets the reviewer's view plus gates.
- **Prose slots:** a required 25-word explanation per active node, optional
  40-word notes per audience, a 25-word "delivers" line per phase, a 40-word
  "promise" per contract, and a required glossary phrase per contract id.

It is regenerated after each `hsdd-spec` level and each phase plan, so the
reviewer opens it in the same MR, and it is committed with the change it
summarizes. Under the standalone-spec-repo profile it lives in the spec
repo like the rest of `hsdd/`.
```

**2c. §14.1 layout `text` block**: replace

```text
  scripts/
    gen-registry.mjs
```

with

```text
  scripts/
    gen-registry.mjs
    summary/                    # hsdd-summary's scripts, copied verbatim
  summary/
    summary.html                # the plan page (hsdd-summary)
    prose.json                  # stamped prose slots
    glossary.json               # plain words for contract ids
```

**2d. §15.1 v0.9.0 table** (added by Plan A): append the row

```markdown
| `hsdd-summary`, `hsdd/summary/` (chapter 13) | Opt-in. A project without `hsdd/summary/` is unaffected. |
```

**2e. §18.1**: append the rows

```markdown
| Reading aids | Optional, derived, stamped HTML pages under `hsdd/summary/`; never authoritative, never a gate (chapter 13). | reasoned-only |
| Summary extraction | A script parses what the templates fix; the agent fills only the items it flags, from the source; a schema and cross-checks validate (§13.2). | reasoned-only |
| Plan-page edges | Derived from the contracts each part consumes and produces; the Mermaid DAG is never parsed (§13.3). | reasoned-only |
```

**2f. §19**: append

```markdown
- **Reading aid:** an optional, derived HTML page over the canonical
  artifacts, rendered by `hsdd-summary` (chapter 13).
- **Plan page:** the reading aid over the tree, from the root's parts down
  to the phase cards, with contracts, decisions and What to check (§13.3).
- **Unparsed item:** a model field the extraction script could not read;
  the agent fills it from the source line it names (§13.2).
```

- [ ] **Step 3: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-spec-b.sh`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add spec/hsdd-spec-v0_9.md
git commit -m "spec(v0.9): the summary engine and the plan page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 13: Commit the B1 and B2 acceptance expectations before any run

**Files:**
- Modify: `review/hsdd-v0_9-acceptance.md` (created by Plan A, Task 6)

- [ ] **Step 1: Append section B**

Append to `review/hsdd-v0_9-acceptance.md`:

````markdown

## B. The plan page

### B1. The plan page renders the field project's tree

- **Run:** in an implementation repo, with the v0.9 skills installed, invoke
  `hsdd-summary` and follow its process to the end (extract, fill, validate,
  slots, prose, lint, stamp, render, check).
- **Expected:** every unparsed item is filled from the line it names (the
  tree has exactly one: a phase with no summary-table row); `validate` exits
  0; `check` reports `summary.html: fresh`; the page opens from disk with
  networking disabled and draws the root's parts with contract edges; the
  leaf-parent with the most phases shows an ordered list of steps, not a
  diagram; no file outside `hsdd/summary/` changed.
- **Fails if:** a source file changed, a value was guessed where the source
  states none, or the page requests the network.
- **Result:**

### B2. The stakeholder sees no id

- **Run:** from the project root, after B1:

  ```bash
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { renderPlan } from "./hsdd/scripts/summary/views-plan.mjs";
  import { namesId } from "./hsdd/scripts/summary/prose.mjs";
  const html = readFileSync("hsdd/summary/summary.html", "utf8");
  const page = JSON.parse(/id="hsdd-page">([^<]*)</.exec(html)[1]);
  const m = page.model;
  const routes = [{ view: "top" }, ...m.nodes.map((n) => ({ view: "node", id: n.id })), { view: "contracts" }, ...m.contracts.map((c) => ({ view: "contract", id: c.ref })), { view: "adrs" }];
  let bad = 0;
  for (const r of routes) {
    const v = renderPlan(page, { audience: "stakeholder", ...r });
    const text = [v.title, v.body.replace(/<[^>]*>/g, " "), ...v.diagrams.flatMap((d) => d.spec.nodes.flatMap((n) => [n.label, n.sub]))].join(" ");
    const id = namesId(text, m.ids);
    if (id) { bad++; console.log(r.view, r.id ?? "", "names", id); }
  }
  console.log(bad ? `${bad} view(s) leak an id` : "no id in any stakeholder view");'
  ```

- **Expected:** `no id in any stakeholder view`.
- **Fails if:** any view names an id. A leak from a node's own name is a
  finding for that node's spec, recorded here; a leak from the page's own
  words is a defect in `views-plan.mjs`.
- **Result:**
````

- [ ] **Step 2: Verify**

Run: `grep -c '^### B[12]\.' review/hsdd-v0_9-acceptance.md && grep -c $'\xe2\x80\x94' review/hsdd-v0_9-acceptance.md`
Expected: `2` then `0`.

- [ ] **Step 3: Commit**

```bash
git add review/hsdd-v0_9-acceptance.md
git commit -m "review(v0.9): B1-B2 acceptance expectations, recorded before the run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
