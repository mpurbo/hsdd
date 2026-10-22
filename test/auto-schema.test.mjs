import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSchema, validate } from "../skills/hsdd-auto/scripts/lib/schema.mjs";
import { parseYaml } from "../skills/hsdd-auto/scripts/lib/yaml.mjs";

const NAMES = ["run-config", "decision", "run-line", "step-report", "queue-line", "review", "handoffs", "dispatch", "owner-files", "adapter", "handoff-skip"];

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
  breaking-amend: { answer: "A breaking change to a stable contract takes the next version with a migration note.", decision: DEC-688 }
commit:
  trailers: ["Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"]
segments:
  - { id: 2026-10-17-plan, mode: plan, opened_at: "2026-10-17T11:53:19Z", instruction: "Plan the tree from scratch through reconcile.", stop_policy: stop, first_step: S00 }
  - { id: 2026-10-20-intake-spec-v0-15-1, mode: intake, opened_at: "2026-10-20T16:04:09Z", instruction: "Align everything with v0.15.1. Do not ask me anything, but record the decisions.", stop_policy: decide-and-record, first_step: S55, request: ref/docs/arch/spec-v0_15_1.md, authority: accepted-rfc }
`;

const opts = [{ label: "a", consequence: "c" }, { label: "b", consequence: "d" }];
const sidecar = { id: "DEC-001", at: "2026-10-20T16:04:30Z", by: "subagent", step: "contract", artifact: "hsdd/contract/a.md", question: "q", options: opts, chosen: "a", why: "w", evidence: [], blast_radius: "contract", confidence: "high", would_have_asked: false, stop_class: null, would_upstream: false };

test("every schema file parses and names its $id", () => { for (const n of NAMES) assert.match(loadSchema(n).$id, /^hsdd-auto\//); });
test("loadSchema caches", () => assert.equal(loadSchema("decision"), loadSchema("decision")));
test("spec §5.4's run.yaml validates against run-config", () => assert.deepEqual(validate("run-config", parseYaml(EXAMPLE)), []));
test("a ledger line validates; a missing commit fails", () => {
  const line = { id: "DEC-001", at: "2026-10-20T16:04:30Z", segment: "s", step: "contract", step_ref: "S07", by: "subagent", artifact: "hsdd/contract/a.md", question: "q", options: [{ label: "a", consequence: "c" }, { label: "b", consequence: "d" }], chosen: "a", why: "w", evidence: [], blast_radius: "contract", confidence: "high", would_have_asked: false, stop_class: null, would_upstream: false, commit: "abc1234" };
  assert.deepEqual(validate("decision", line), []);
  const { commit, ...noCommit } = line;
  assert.deepEqual(validate("decision", noCommit), ["$: missing required property commit"]);
});
test("minItems reports the path and reason", () => {
  const errs = validate("decision", { id: "DEC-001", at: "2026-10-20T16:04:30Z", segment: "s", step: "contract", step_ref: "S07", by: "subagent", artifact: null, question: "q", options: [opts[0]], chosen: "a", why: "w", evidence: [], blast_radius: "contract", confidence: "high", would_have_asked: false, stop_class: null, would_upstream: false, commit: "abc1234" });
  assert.deepEqual(errs, ["$.options: expected at least 2 items"]);
});
test("sidecarDecision and decisionInput defs resolve", () => {
  assert.deepEqual(validate("decision", sidecar, "sidecarDecision"), []);
  const { id, at, by, step, ...input } = sidecar;
  assert.deepEqual(validate("decision", input, "decisionInput"), []);
  const errs = validate("decision", { ...input, id: "DEC-001" }, "decisionInput");
  assert.equal(errs.length, 1);
  assert.match(errs[0], /^\$: /);
  assert.match(errs[0], /additional property id/);
});
test("cross-file $ref resolves (step-report routed.step_kind)", () => {
  const routed = (k) => ({ routed: [{ target: "t", kind: "insert-step", text: "x", step_kind: k }] });
  const bad = validate("step-report", routed("intake")).filter((e) => e.startsWith("$.routed[0].step_kind"));
  assert.equal(bad.length, 1);
  assert.deepEqual(validate("step-report", routed("contract")).filter((e) => e.startsWith("$.routed[0].step_kind")), []);
});
test("artifact pattern rejects absolute and parent paths", () => {
  const f = (artifact) => validate("decision", { ...sidecar, artifact }, "sidecarDecision");
  assert.equal(f("/etc/x").length, 1);
  assert.equal(f("a/../b").length, 1);
  assert.equal(f("..").length, 1);
  assert.deepEqual(f(null), []);
  assert.deepEqual(f("hsdd/x.md"), []);
  assert.deepEqual(f("a/..b/c"), []);
});
test("type list, enum with null, minimum, minLength", () => {
  const line = { step_ref: "S01", segment: "s", kind: "setup", skill: "none", target: "run", started: "2026-10-20T16:04:30Z", finished: "2026-10-20T16:04:31Z", commit: "abc1234", dispatches: 0, status: "completed" };
  assert.deepEqual(validate("run-line", line), []);
  assert.deepEqual(validate("run-line", { ...line, dispatches: -1 }), ["$.dispatches: expected a number at least 0"]);
  assert.deepEqual(validate("run-line", { ...line, dispatches: 1.5 }), ["$.dispatches: expected type integer"]);
  assert.deepEqual(validate("run-line", { ...line, segment: "" }), ["$.segment: expected at least 1 characters"]);
  assert.deepEqual(validate("run-line", { ...line, kind: "nope" }).length, 1);
  assert.deepEqual(validate("run-line", { ...line, extra: 1 }), ["$: unexpected property extra"]);
  const h = "a".repeat(64);
  assert.deepEqual(validate("owner-files", { "CLAUDE.md": h, "x.md": null }), []);
  assert.equal(validate("owner-files", { "x.md": "xyz" }).length, 1);
  assert.match(validate("owner-files", { "x.md": "xyz" })[0], /^\$\["x\.md"\]: /);
  assert.equal(validate("owner-files", { "x.md": 5 }).length, 1);
  assert.deepEqual(validate("adapter", { version: 1, added: [{ file: "f", pointer: "/p", value: null }], created: [] }), []);
  assert.equal(validate("adapter", { version: 2, added: [], created: [] }).length, 1);
});
test("minLength counts code points; pattern skips non-strings; root type", () => {
  const s = (reason) => ({ segment: "s", handoff: "H1", at: "2026-10-20T16:04:30Z", status: "skipped", reason });
  assert.deepEqual(validate("handoff-skip", s("\u{1F600}")), []);
  assert.deepEqual(validate("handoff-skip", s("")).length, 1);
  assert.deepEqual(validate("handoff-skip", [1]), ["$: expected type object"]);
  assert.deepEqual(validate("handoff-skip", null), ["$: expected type object"]);
});
test("unknown schema or def throws", () => {
  assert.throws(() => loadSchema("nope"));
  assert.throws(() => validate("decision", {}, "nope"));
});
