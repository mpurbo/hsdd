import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, YamlError, formatScalar, formatFlow, appendSegmentEntry, splitFrontMatter, stringifyFrontMatter } from "../skills/hsdd-auto/scripts/lib/yaml.mjs";
import { nowStamp, STAMP_RE, stampMs, dateOf } from "../skills/hsdd-auto/scripts/lib/time.mjs";

const EXAMPLE = String.raw`version: 1
run: v1-planning
branch: auto/v1-planning
base: main
skills_dir: .agents/skills
models: { orchestrator: claude-opus-5-5, step: claude-opus-5-5 }
owner_facts:
  - "Who builds what: one developer with coding agents. One team, one repository."
  - "The v0.15.1 Specification is accepted for v1 and replaces v0.15.0. The Guide and the Rationale are informative."
  - "Coding method for phase execution: superpowers, not OpenSpec. OpenSpec is not installed."
  - "No global tooling may be installed; project-local dev dependencies are fine."
preferences:
  - "Functional-first: pure core, imperative shell, immutability, composition, ADTs, declarative over imperative."
prose_rules:
  banned_chars: ["\u2014"]
  banned_phrases: ["leverage"]
  token_forms: { empty_cell: none, id_separator: ":", reason_separator: " - " }
  level: warn
sources:
  normative: [{ path: ref/docs/arch/spec-v0_15_1.md, cite: Spec, version: v0.15.1 }]
  informative:
    - { path: ref/docs/arch/guide-v0_15_1.md, cite: Guide, version: v0.15.1 }
    - { path: ref/docs/arch/rationale-v0_15_1.md, cite: Rationale, version: v0.15.1 }
  baseline: [{ path: ref/docs/arch/spec-v0_15_0.md, cite: Spec, version: v0.15.0 }]
read_only: [ref/]
out_of_bounds: [~/tmp, "~/.claude*/projects/*/memory"]
owner_files: []
orchestrator_files: [CLAUDE.md]
toolchain:
  commands: { dart: fvm dart, flutter: fvm flutter }
  rules: ["Always fvm dart and fvm flutter, never a bare dart."]
stop_set: [axis, shape, promotion, breaking-amend, collision, external, gate-twice]
stop_policy: stop
predecided:
  breaking-amend: { answer: "A breaking change to a stable contract takes the next version with a migration note, mode coexisting.", decision: DEC-688 }
commit:
  trailers: ["Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"]
segments:
  - { id: 2026-10-17-plan, mode: plan, opened_at: "2026-10-17T11:53:19Z", instruction: "Plan the tree from scratch through reconcile.", stop_policy: stop, first_step: S00 }
  - { id: 2026-10-20-intake-spec-v0-15-1, mode: intake, opened_at: "2026-10-20T16:04:09Z", instruction: "Align everything with v0.15.1. Do not ask me anything, but record the decisions.", stop_policy: decide-and-record, first_step: S55, request: ref/docs/arch/spec-v0_15_1.md, authority: accepted-rfc }
`;

test("parses spec §5.4's example", () => {
  const c = parseYaml(EXAMPLE);
  assert.equal(c.version, 1);
  assert.deepEqual(c.models, { orchestrator: "claude-opus-5-5", step: "claude-opus-5-5" });
  assert.equal(c.prose_rules.banned_chars[0], "\u2014");
  assert.equal(c.sources.informative[1].cite, "Rationale");
  assert.equal(c.predecided["breaking-amend"].decision, "DEC-688");
  assert.equal(c.segments[1].stop_policy, "decide-and-record");
  assert.equal(c.segments[0].opened_at, "2026-10-17T11:53:19Z");
  assert.equal(c.sources.normative[0].version, "v0.15.1");
  assert.deepEqual(c.prose_rules.token_forms, { empty_cell: "none", id_separator: ":", reason_separator: " - " });
  assert.deepEqual(c.out_of_bounds, ["~/tmp", "~/.claude*/projects/*/memory"]);
  assert.deepEqual(c.owner_files, []);
});

test("accepts every construct of §5.2", () => {
  const text = [
    "# leading comment",
    "map:   # trailing comment",
    "  inner: value # comment",
    "  seq:",
    "    - a",
    "    - b # c",
    "    - key: v",
    "      other: 2",
    "    - - nested",
    "      - items",
    "  same_indent_seq:",
    "  - x",
    "  - y",
    "flow_seq: [a, b, 3]",
    "flow_maps: [{ path: x, cite: Spec }, {path: y, cite: Guide}]",
    "flow_map: { path: x, n: -4, ok: true, none: null, list: [1, 2] }",
    "empty_flow: { a: [], b: {} }",
    "plain: hello world",
    "single: 'it''s: fine # really'",
    "double: \"q\\\" b\\\\ n\\n t\\t u\\u00e9\"",
    "ints: [0, -7, 42]",
    "version_like: 0.11.0",
    "short_version: 0.11",
    "bools: [true, false, null]",
    "word_true: \"true\"",
    "trailing_null:",
    "tilde: ~/tmp",
    "",
    "quoted key: 1",
    "\"q: key\": 2",
  ].join("\n") + "\n";
  const c = parseYaml(text);
  assert.deepEqual(c.map, {
    inner: "value",
    seq: ["a", "b", { key: "v", other: 2 }, ["nested", "items"]],
    same_indent_seq: ["x", "y"],
  });
  assert.deepEqual(c.flow_seq, ["a", "b", 3]);
  assert.deepEqual(c.flow_maps, [{ path: "x", cite: "Spec" }, { path: "y", cite: "Guide" }]);
  assert.deepEqual(c.flow_map, { path: "x", n: -4, ok: true, none: null, list: [1, 2] });
  assert.deepEqual(c.empty_flow, { a: [], b: {} });
  assert.equal(c.plain, "hello world");
  assert.equal(c.single, "it's: fine # really");
  assert.equal(c.double, "q\" b\\ n\n t\t u\u00e9");
  assert.deepEqual(c.ints, [0, -7, 42]);
  assert.equal(c.version_like, "0.11.0");
  assert.equal(c.short_version, "0.11");
  assert.deepEqual(c.bools, [true, false, null]);
  assert.equal(c.word_true, "true");
  assert.equal(c.trailing_null, null);
  assert.equal(c.tilde, "~/tmp");
  assert.equal(c["quoted key"], 1);
  assert.equal(c["q: key"], 2);
});

test("segments with no value and [] load as empty lists", () => {
  assert.deepEqual(parseYaml("segments:\n").segments, []);
  assert.deepEqual(parseYaml("segments: []\n").segments, []);
});

for (const [name, text, line] of [
  ["anchor", "a: &x 1\n", 1], ["alias", "a: 1\nb: *x\n", 2], ["tag", "a: !!str 1\n", 1],
  ["multi-line scalar", "a: |\n  x\n", 1], ["folded", "a: >\n  x\n", 1],
  ["tab", "a:\n\t- x\n", 2], ["second document", "a: 1\n---\nb: 2\n", 2],
  ["continued plain scalar", "a: x\n  y\n", 2],
  ["unterminated flow", "a: 1\nb: [x, y\n", 2],
  ["unterminated quote", "a: \"x\n", 1],
  ["unknown escape", "a: \"x\\qy\"\n", 1],
  ["duplicate key", "a: 1\na: 2\n", 2],
  ["plain scalar with colon-space", "a: b: c\n", 1],
  ["content after a value", "a: \"x\" y\n", 1],
]) test(`rejects ${name}, naming line ${line}`, () => {
  assert.throws(() => parseYaml(text), (e) => e instanceof YamlError && e.line === line && e.message.startsWith(`line ${line}:`));
});

test("formatScalar quotes and escapes", () => {
  for (const s of ["a: b", "x #y", "-lead", "123", "true", "null", "", "say \"hi\"\nnext", "Align with v0.15.1. Do not ask me anything",
    " lead", "trail ", "tab\there", "back\\slash", "bell\u0007", "a:", "- x", "\u00e9t\u00e9", "[x]", "k: v # c", "false", "-5", "?q", "@at", "%p"])
    assert.equal(parseYaml(`k: ${formatScalar(s)}\n`).k, s);
  assert.equal(formatScalar("plain-word"), "plain-word");
  assert.equal(formatScalar("0.11.0"), "0.11.0");
  assert.equal(formatScalar("2026-10-22T11:53:19Z"), "2026-10-22T11:53:19Z");
  assert.equal(formatScalar("123"), "\"123\"");
  assert.equal(formatScalar(7), "7");
  assert.equal(formatScalar(true), "true");
  assert.equal(formatScalar(null), "null");
  assert.equal(formatScalar("a\"b\\c\nd\te\u0001"), "\"a\\\"b\\\\c\\nd\\te\\u0001\"");
});

test("formatFlow writes flow collections that parse back", () => {
  assert.equal(formatFlow(["a", "b"]), "[a, b]");
  assert.equal(formatFlow({ k: "v", k2: ["x"] }), "{ k: v, k2: [x] }");
  assert.equal(formatFlow([]), "[]");
  assert.equal(formatFlow({}), "{}");
  const tricky = { a: "x, y", b: ["p]q", "{r}"], "odd key": "k: v", n: 3, t: true, z: null, deep: [{ i: "1" }] };
  assert.deepEqual(parseYaml(`k: ${formatFlow(tricky)}\n`).k, tricky);
});

test("appendSegmentEntry keeps comments and quoting", () => {
  const before = "version: 1 # format\nrun: x\n# owner note: keep me\nsegments:\n";
  const after = appendSegmentEntry(before, { id: "2026-10-22-plan", mode: "plan", instruction: "Plan it: all # of it" });
  assert.ok(after.startsWith("version: 1 # format\nrun: x\n# owner note: keep me\nsegments:\n  - { id: 2026-10-22-plan,"));
  assert.equal(parseYaml(after).segments[0].instruction, "Plan it: all # of it");
  const twice = appendSegmentEntry(after + "commit:\n  trailers: []\n", { id: "b", mode: "plan" });
  assert.deepEqual(parseYaml(twice).segments.map((s) => s.id), ["2026-10-22-plan", "b"]);
  assert.ok(twice.endsWith("commit:\n  trailers: []\n"));
});

test("appendSegmentEntry replaces [] and changes nothing else", () => {
  const before = "# top\nsegments: []\ncommit:\n  trailers: []   # none\n";
  const after = appendSegmentEntry(before, { id: "a" });
  assert.equal(after, "# top\nsegments:\n  - { id: a }\ncommit:\n  trailers: []   # none\n");
});

test("appendSegmentEntry treats segments: null like an empty sequence", () => {
  // Final review B3: the loader reads `segments: null` as no segments, so the append must accept it too.
  const before = "# top\nsegments: null   # filled by the run\ncommit:\n  trailers: []\n";
  const after = appendSegmentEntry(before, { id: "a" });
  assert.equal(after, "# top\nsegments: # filled by the run\n  - { id: a }\ncommit:\n  trailers: []\n");
  assert.deepEqual(parseYaml(after).segments, [{ id: "a" }]);
  assert.equal(appendSegmentEntry("segments: null\n", { id: "b" }), "segments:\n  - { id: b }\n");
  assert.throws(() => appendSegmentEntry("segments: nothing\n", { id: "c" }), YamlError);
});

test("appendSegmentEntry matches the existing indentation and appends after the last item", () => {
  const before = "a: 1\nsegments:\n- { id: x }\n\n# between\n- id: y\n  mode: plan\n\n# owner note\nz: 2\n";
  const after = appendSegmentEntry(before, { id: "w", instruction: "multi\nline" });
  assert.equal(after, "a: 1\nsegments:\n- { id: x }\n\n# between\n- id: y\n  mode: plan\n- { id: w, instruction: \"multi\\nline\" }\n\n# owner note\nz: 2\n");
  assert.deepEqual(parseYaml(after).segments.map((s) => s.id), ["x", "y", "w"]);
});

test("appendSegmentEntry handles a segments block at end of file without a newline", () => {
  const after = appendSegmentEntry("segments:\n  - { id: x }", { id: "y" });
  assert.deepEqual(parseYaml(after).segments.map((s) => s.id), ["x", "y"]);
});

test("appendSegmentEntry refuses a segments value that is not a block", () => {
  assert.throws(() => appendSegmentEntry("segments: [{ id: x }]\n", { id: "y" }), (e) => e instanceof YamlError && e.line === 1);
  assert.throws(() => appendSegmentEntry("a: 1\n", { id: "y" }), YamlError);
});

test("front matter round-trips a dispatch header", () => {
  const front = { step_ref: "S64", handoff: null, write_set: ["hsdd/contract/a.md", "hsdd/contract/fixture/a/**"], head: "1234567", skill_version: "0.11.0", launches: [{ at: "2026-10-20T19:28:30Z", reason: "initial" }] };
  const { data, body } = splitFrontMatter(`---\n${stringifyFrontMatter(front)}---\nbody\n`);
  assert.deepEqual(data, front); assert.equal(body, "body\n");
});

test("splitFrontMatter rejects missing delimiters and reports file line numbers", () => {
  assert.throws(() => splitFrontMatter("a: 1\n---\nbody\n"), YamlError);
  assert.throws(() => splitFrontMatter("---\na: 1\nbody\n"), YamlError);
  assert.throws(() => splitFrontMatter("---\na: 1\nb: &x 2\n---\n"), (e) => e instanceof YamlError && e.line === 3);
  assert.deepEqual(splitFrontMatter("---\n---\n"), { data: {}, body: "" });
  assert.equal(stringifyFrontMatter({ a: 1, b: "x y" }), "a: 1\nb: x y\n");
});

test("nowStamp is UTC at second precision", () => assert.match(nowStamp(), STAMP_RE));

test("stampMs and dateOf read a stamp", () => {
  assert.equal(stampMs("2026-10-17T11:53:19Z"), Date.UTC(2026, 9, 17, 11, 53, 19));
  assert.equal(dateOf("2026-10-17T11:53:19Z"), "2026-10-17");
  assert.throws(() => stampMs("2026-10-17"));
  assert.throws(() => dateOf("nope"));
});

test("formatScalar quotes a string with # anywhere and round-trips it", () => {
  assert.equal(formatScalar("x#y"), "\"x#y\"");
  assert.equal(parseYaml(`k: ${formatScalar("x#y")}\n`).k, "x#y");
  assert.equal(parseYaml(`k: ${formatScalar("a#")}\n`).k, "a#");
});
test("CRLF files parse and keep one line-ending style on append", () => {
  const crlf = "version: 1\r\nrun: shop\r\nsegments:\r\n  - { id: a }\r\nafter: 1\r\n";
  assert.deepEqual(parseYaml(crlf), { version: 1, run: "shop", segments: [{ id: "a" }], after: 1 });
  const out = appendSegmentEntry(crlf, { id: "b" });
  assert.equal(out, "version: 1\r\nrun: shop\r\nsegments:\r\n  - { id: a }\r\n  - { id: b }\r\nafter: 1\r\n");
  assert.ok(!/[^\r]\n/.test(out));
  const empty = appendSegmentEntry("run: shop\r\nsegments: []\r\n", { id: "b" });
  assert.equal(empty, "run: shop\r\nsegments:\r\n  - { id: b }\r\n");
  assert.equal(appendSegmentEntry("segments:\n  - { id: x }\n", { id: "y" }), "segments:\n  - { id: x }\n  - { id: y }\n");
});
