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
