// The texts of spec v0.13 chapters 3 and 7: an agent reads SKILL.md and sweep.md
// and follows them, so every class, prompt and command they name must be the
// spec's and the script's. A missing file reads as empty, so each test fails on
// its own claim and not at load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { USAGE, parseArgs } from "../skills/hsdd-intake/scripts/sweep.mjs";
import { promptShas } from "../skills/hsdd-intake/scripts/lib/check.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "");
const norm = (t) => t.replace(/\s+/g, " ").trim();

const SPEC = read("spec/hsdd-spec-v0_13.md");
const SKILL = read("skills/hsdd-intake/SKILL.md");
const SWEEP = read("skills/hsdd-intake/sweep.md");
const COMMAND = read("commands/hsdd-intake.md");

// From a `## ` heading to the next one, or "" when the heading is absent.
const section = (text, heading) => {
  const i = text.indexOf(`\n${heading}\n`);
  if (i < 0) return "";
  const j = text.indexOf("\n## ", i + 1);
  return text.slice(i + 1, j < 0 ? undefined : j);
};
const frontMatter = (text) => text.slice(0, text.indexOf("\n---\n", 4));
const MANUAL_MARK = "**A `manual` answer writes nothing.**";
const manualParagraph = () => {
  const i = SKILL.indexOf(MANUAL_MARK);
  return i < 0 ? "" : SKILL.slice(i, SKILL.indexOf("\n5. **Write the record", i));
};
const tableRows = (text) => text.split("\n").filter((l) => /^\| /.test(l) && !/^\|[-| ]+\|$/.test(l));

test("the description adds the sweep and its two triggers", () => {
  const d = norm(frontMatter(SKILL));
  assert.match(d, /sweep/i);
  assert.ok(d.includes('"is this small enough to skip a phase"'));
  assert.ok(d.includes('"sweep the merged fixes"'));
  assert.ok(d.split("description: >")[1].length <= 1024, "a skill description fits 1024 characters");
});

test("the manual row carries the spec's words", () => {
  const row = SPEC.split("\n").find((l) => l.startsWith("| `manual` |"));
  const [, cls, means] = row.split("|");
  assert.ok(SKILL.includes(`|${cls}|${means}|`));
  assert.ok(SKILL.includes("**no skill, no record**"));
});

test("the manual row closes the class table of step 4, and no step is renumbered", () => {
  const steps = ["1. **Read every open intake first.**", "2. **Locate the landing.**", "3. **Promote first when the landing is as-built.**", "4. **Classify**", "5. **Write the record before the handoff**", "6. **Hand off**", "7. **Report:**"];
  const at = steps.map((s) => SKILL.indexOf(`\n${s}`));
  assert.ok(at.every((p) => p >= 0), `steps at ${at}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  const row = SKILL.indexOf("   | `manual` |");
  assert.ok(row > at[3] && row < at[4], "the row is in step 4");
  assert.ok(SKILL.indexOf(MANUAL_MARK) > row && SKILL.indexOf(MANUAL_MARK) < at[4], "the paragraph follows the table, inside step 4");
});

test("the manual paragraph states the tests, the limits and the four things the report names", () => {
  const p = norm(manualParagraph());
  for (const s of [
    "applied to the request as described",
    "Doubt is not `manual`",
    "`commit` is never `manual`",
    "does not exist before launch",
    "An as-built landing is not promoted for a `manual` request",
    "Steps 5 and 6 do not apply",
    "`HSDD-Node: {node-id}`",
    "`/hsdd-intake sweep`",
    "by the developer or by a lead before the next checkpoint",
    "comes back through request mode before it merges",
  ]) assert.ok(p.includes(s), s);
});

test("the mode section is at most 40 lines, names sweep.md and selects by the first argument", () => {
  const s = section(SKILL, "## Two modes");
  assert.ok(s, "## Two modes exists");
  assert.ok(s.trimEnd().split("\n").length <= 40, `${s.trimEnd().split("\n").length} lines`);
  assert.ok(SKILL.indexOf("\n## Two modes\n") < SKILL.indexOf("\n## Inputs\n"), "before ## Inputs");
  assert.equal(section(SKILL, "## Two modes").length + SKILL.indexOf("\n## Two modes\n") + 1, SKILL.indexOf("\n## Inputs\n"), "directly before ## Inputs");
  const n = norm(s);
  assert.ok(n.includes("Read `sweep.md` beside this file and follow it; the rest of this file is request mode."));
  assert.match(n, /first word of (?:your|the skill's) arguments/);
  for (const word of ["`sweep`", "`route`", "a path", "a URL", "a described request"]) assert.ok(n.includes(word), word);
  assert.match(n, /asks? once/);
  const rows = tableRows(s).slice(1);
  assert.equal(rows.length, 2, "one table, a row per mode");
  assert.match(rows[0], /Request mode/);
  assert.match(rows[1], /Sweep mode/);
});

test("the authority list ends in commit", () => {
  const n = norm(SKILL);
  assert.ok(n.includes("ticket | incident | braindump | commit)"));
  assert.ok(n.includes("A `commit` request is `{repo}@{sha}`, already shipped, and its phases are retro phases."));
});

test("the unattended row", () => {
  const row = "| A request that would be class `manual` | decide: route it `local`; `manual` is not an unattended class (spec v0.13 §3.4) | `judgement` |";
  assert.ok(section(SKILL, "## Unattended runs").split("\n").includes(row));
});

test("the quality gate and the anti-rationalization row", () => {
  assert.ok(norm(section(SKILL, "## Quality Gates")).includes("- [ ] A `manual` answer wrote nothing under `hsdd/` and named the node and the trailer; a request the description could not settle was not `manual`."));
  assert.ok(section(SKILL, "## Anti-Rationalization").split("\n").includes('| "It\'s probably small; I\'ll say manual" | Doubt is not manual. The phase is the safe answer, and the sweep can still find later that the diff stayed below the line. |'));
});

test("sweep.md is under 200 lines, its sections in order", () => {
  assert.ok(SWEEP.trimEnd().split("\n").length < 200, `${SWEEP.trimEnd().split("\n").length} lines`);
  assert.deepEqual([...SWEEP.matchAll(/^#{1,2} .+$/gm)].map((m) => m[0]), [
    "# HSDD Intake: Sweep Mode",
    "## When it applies",
    "## Setup",
    "## Procedure",
    "## The claim test",
    "## Handoff prompts",
    "## Quality Gates",
    "## Anti-Rationalization",
  ]);
  assert.match(norm(SWEEP), /the script owns the record's structure/i);
});

test("the setup copies the scripts verbatim and sweeps each repository on its own", () => {
  const n = norm(section(SWEEP, "## Setup"));
  for (const s of ["`scripts/`", "`hsdd/scripts/sweep/`", "**verbatim**", "Node 20", "each implementation repository is swept on its own"]) assert.ok(n.includes(s), s);
});

test("the procedure runs draft, check and commit in that order and says what the report names", () => {
  const p = section(SWEEP, "## Procedure");
  const at = ["sweep.mjs draft", "sweep.mjs check", "sweep.mjs commit"].map((s) => p.indexOf(s));
  assert.ok(at.every((i) => i >= 0), `commands at ${at}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  const n = norm(p);
  for (const s of [
    "`HSDD-Node:`",
    "`modules:`",
    "`Run by`",
    "`**H{n}** ({class}, {node or sha}):`",
    "`unplaced`",
    "the handoffs not run",
    "never commit a record `check` refused",
    "It never pushes",
  ]) assert.ok(n.includes(s), s);
  assert.match(n, /leave `## Routing` at `none`/);
});

test("the claim test and the as-built rule are stated as spec 4.3 states them", () => {
  const spec = norm(SPEC);
  const sweep = norm(section(SWEEP, "## The claim test"));
  for (const s of [
    "the node's spec file, the Scope and Verification lines of its phases, the Guarantees of the contracts the node produces, and the Decision of each ADR in its Governed by.",
    "If the diff makes any sentence there false or stale, the class is **`retro`**, and the reason names the claim by its location (`acme.web.checkout.4 Verification: \"shows the fee line\"`).",
    "Otherwise the class is **`log`**, and the row is the whole record of the commit.",
    "A copy change that renames what a Verification line names is `retro`; a font size is `log`; a log line is `log` unless a Guarantee speaks of logging.",
    "\"not worth recording\" is not a class",
    "the claim test is not applied",
    "A candidate placed on an as-built node is `log` unless the surface moved; a retro phase is never planned on an as-built node",
    "The agent may raise a class: `log` to `retro`, and either to `intake` when it reads a move the classifiers missed or when the paths span two nodes",
    "It never lowers one.",
    "`- YYYY-MM-DD: lowered {sha7} from {class} to {class} by {person}: {reason}`",
  ]) {
    assert.ok(spec.includes(s), `the spec: ${s}`);
    assert.ok(sweep.includes(s), `sweep.md: ${s}`);
  }
});

test("sweep.md carries chapter 6's prompts verbatim", () => {
  const ch6 = SPEC.slice(SPEC.indexOf("## 6. Handoffs"), SPEC.indexOf("## 7. The Mode"));
  const fences = [...ch6.matchAll(/```text\n([\s\S]*?)```/g)];
  const blocks = fences.map((m) => norm(m[1]));
  assert.equal(blocks.length, 3);
  for (const b of blocks) assert.ok(norm(SWEEP).includes(b), b.slice(0, 50));
  // check reads shas at these positions, so a fence must hold the prompt line for line.
  const prompts = section(SWEEP, "## Handoff prompts");
  for (const m of fences) assert.ok(prompts.includes(m[0]), m[1].slice(0, 50));
  assert.ok(prompts.includes("`/hsdd-reconcile {node}`"));
});

test("a prompt filled from sweep.md names its shas where check reads them", () => {
  const fences = [...section(SWEEP, "## Handoff prompts").matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(fences.length, 3);
  const fill = (p) => p.replaceAll("{sha}, {sha}", "a1b2c3d, b2c3d4e").replaceAll("{sha}", "c3d4e5f").replaceAll("{repo}", "acme").replaceAll("{record}", "2026-11-05-sweep-acme-d4e5f6a.md");
  assert.deepEqual(promptShas(fill(fences[0])), ["a1b2c3d", "b2c3d4e"]);
  assert.deepEqual(promptShas(fill(fences[1])), ["a1b2c3d", "b2c3d4e"]);
  assert.deepEqual(promptShas(fill(fences[2])), ["c3d4e5f"]);
});

test("sweep.md's quality gates cover each rule", () => {
  const gates = section(SWEEP, "## Quality Gates").split("\n").filter((l) => l.startsWith("- [ ] "));
  assert.ok(gates.length >= 5, `${gates.length} gates`);
  const n = norm(section(SWEEP, "## Quality Gates"));
  for (const re of [/[Ee]very candidate has a row/, /[Nn]o class was lowered by the agent/, /every `retro` row/, /as-built/, /`check` passed before `commit`/]) assert.match(n, re);
});

test("the first anti-rationalization row is the worth judgment", () => {
  const rows = tableRows(section(SWEEP, "## Anti-Rationalization"));
  assert.equal(rows[0], "| Thought | Reality |");
  assert.ok(rows[1]?.startsWith('| "This change isn\'t worth recording" | '), rows[1]);
  for (const [i, s] of ['"I\'ll skip the record, nothing staled"', '"The classifier is wrong, I\'ll change that intake to log"', '"I\'ll guess the node"'].entries()) {
    assert.ok(rows[i + 2]?.startsWith(`| ${s} | `), s);
  }
});

// ---------- the commands the texts name ----------

const split = (text) => {
  const prose = [];
  const fenced = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    (inFence ? fenced : prose).push(line);
  }
  return { prose, fenced };
};

const CMD = /^node hsdd\/scripts\/sweep\/sweep\.mjs(?=\s|$)(.*)$/;
const commandsIn = (text) => {
  const { prose, fenced } = split(text);
  const spans = prose.flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()));
  return [...spans, ...fenced.map((l) => l.trim())]
    .map((s) => CMD.exec(s))
    .filter(Boolean)
    .map((m) => ({ args: m[1].trim(), text: m[0] }));
};

const tokens = (args) => [...args.replace(/[[\]]/g, " ").matchAll(/"[^"]*"|\S+/g)].map((m) => m[0]);

// The problems of one named command; [] when the script accepts it.
const problemsOf = (cmd) => {
  const [sub, ...rest] = tokens(cmd.args);
  if (!["draft", "check", "commit"].includes(sub)) return [`${cmd.text}: ${sub} is not a subcommand`];
  const usage = USAGE.split("\n").find((l) => l.trim().startsWith(`${sub} `));
  const flags = rest.filter((t) => t.startsWith("--"));
  const problems = flags.filter((f) => !usage.includes(`${f} `) && !usage.includes(`${f}]`)).map((f) => `${cmd.text}: ${f} is not a flag of ${sub}`);
  if (sub !== "draft") {
    if (rest.length !== 1 || flags.length > 0) problems.push(`${cmd.text}: ${sub} takes only the record path`);
    return problems;
  }
  try {
    parseArgs([sub, ...rest]);
  } catch (e) {
    problems.push(`${cmd.text}: ${e.message}`);
  }
  return problems;
};

test("every sweep.mjs command the texts name is one the script accepts", () => {
  for (const [name, text] of [["SKILL.md", SKILL], ["sweep.md", SWEEP]]) {
    const wrapped = split(text).prose.map((l, i) => [i + 1, l]).filter(([, l]) => (l.match(/`/g) ?? []).length % 2 === 1);
    assert.deepEqual(wrapped, [], `${name}: every inline code span opens and closes on one line`);
  }
  const commands = [...commandsIn(SKILL), ...commandsIn(SWEEP)];
  assert.ok(commands.length >= 3, `${commands.length} commands`);
  assert.deepEqual(commands.flatMap(problemsOf), []);
  const named = new Set(commands.map((c) => tokens(c.args)[0]));
  for (const sub of ["draft", "check", "commit"]) assert.ok(named.has(sub), sub);
});

test("the command check rejects what the script does not accept", () => {
  for (const line of [
    "node hsdd/scripts/sweep/sweep.mjs frobnicate",
    "node hsdd/scripts/sweep/sweep.mjs draft --bogus",
    "node hsdd/scripts/sweep/sweep.mjs commit hsdd/management/DATE-sweep-REPO-SHA7.md --write",
    "node hsdd/scripts/sweep/sweep.mjs commit",
    "node hsdd/scripts/sweep/sweep.mjs check --today 2026-11-05 hsdd/management/DATE-sweep-REPO-SHA7.md",
  ]) assert.notDeepEqual(problemsOf(commandsIn(`\`${line}\``)[0]), [], line);
  assert.deepEqual(problemsOf(commandsIn("`node hsdd/scripts/sweep/sweep.mjs draft [--from SHA] [--run-by NAME] --write`")[0]), []);
});

test("the slash command names both modes and delegates in one line", () => {
  const lines = COMMAND.trimEnd().split("\n");
  assert.equal(lines.length, 4, COMMAND);
  assert.equal(lines[0], "---");
  assert.equal(lines[2], "---");
  assert.match(lines[1], /^description: Route .*change request.*sweep.*shipped commits/i);
  assert.equal(lines[3], "Use the hsdd-intake skill for: $ARGUMENTS");
});

test("no em dash and no banned phrase in sweep.md or the new text of SKILL.md", () => {
  const banned = new RegExp(["load", "bearing"].join("-"), "i");
  const added = {
    "sweep.md": SWEEP,
    "## Two modes": section(SKILL, "## Two modes"),
    "the manual paragraph": manualParagraph(),
    "SKILL.md as a whole": SKILL,
    "the slash command": COMMAND,
  };
  for (const [name, text] of Object.entries(added)) {
    assert.ok(text.length > 0, `${name} is empty`);
    assert.ok(!text.includes("\u2014"), `${name}: em dash`);
    assert.ok(!banned.test(text), `${name}: banned phrase`);
  }
});
