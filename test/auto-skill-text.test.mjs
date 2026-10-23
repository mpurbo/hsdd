// SKILL.md and the slash command (spec 4.4, 3.3). An orchestrator follows SKILL.md with no other
// context, so every script command it names must be one the scripts accept: the script exists, each
// subcommand and flag is in the usage text the script prints and in the options it parses, and a
// literal value given to a flag whose usage lists its values is one of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, sourcesOf } from "../skills/hsdd-auto/scripts/lib/config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "skills", "hsdd-auto", "SKILL.md");
const COMMAND = join(ROOT, "commands", "hsdd-auto.md");
const SCRIPTS = join(ROOT, "skills", "hsdd-auto", "scripts");
const SPEC = readFileSync(join(ROOT, "spec", "hsdd-spec-v0_11.md"), "utf8");

const textOf = (file) => {
  assert.ok(existsSync(file), `${file} exists`);
  return readFileSync(file, "utf8");
};

// ---------- what SKILL.md names ----------

// Lines outside fenced blocks, and the lines inside them, kept apart.
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

const CMD = /^(?:node hsdd\/scripts\/auto\/)?([a-z][a-z-]*)\.mjs(?=\s|$)(.*)$/;

// Every script command the text names: an inline code span, or a fenced line, that starts with
// `node hsdd/scripts/auto/{x}.mjs` or `{x}.mjs`.
export const commandsIn = (text) => {
  const { prose, fenced } = split(text);
  const spans = prose.flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()));
  return [...spans, ...fenced.map((l) => l.trim())]
    .map((s) => CMD.exec(s))
    .filter(Boolean)
    .map((m) => ({ script: m[1], args: m[2].trim(), text: m[0] }));
};

const tokens = (args) => [...args.matchAll(/"[^"]*"|\S+/g)].map((m) => m[0]);

// ---------- what the scripts accept ----------

const BARE = /^[a-z][a-z-]*$/;
const ENUM = /^[a-z][a-z-]*(?:\|[a-z][a-z-]*)+$/;

// The usage text a script prints for an unknown option (exit 2, before it reads any repository).
const usageOf = (script) => {
  const r = spawnSync(process.execPath, [join(SCRIPTS, `${script}.mjs`), "--no-such-option"], { cwd: tmpdir(), encoding: "utf8" });
  assert.equal(r.status, 2, `${script}.mjs --no-such-option exits 2 with its usage:\n${r.stdout}${r.stderr}`);
  return `${r.stdout}${r.stderr}`;
};

// Flags with their listed values (null when the value is free), and the subcommands: the first bare
// word after `{script}.mjs` on a usage line, and each bare word after ` | `.
export const usageSpec = (script, usage) => {
  const flags = new Map();
  for (const m of usage.matchAll(/--([a-z][a-z-]*)(?: +([^\s[\]|-][^\s[\]]*))?/g)) {
    const values = m[2] !== undefined && ENUM.test(m[2]) ? new Set(m[2].split("|")) : null;
    const had = flags.get(m[1]);
    flags.set(m[1], had === undefined ? values : had === null || values === null ? null : new Set([...had, ...values]));
  }
  const subcommands = new Set();
  for (const line of usage.split("\n")) {
    const at = line.indexOf(`${script}.mjs`);
    if (at < 0) continue;
    const rest = line.slice(at + script.length + 4);
    const first = /^\s+([a-z][a-z-]*)(?=\s|$)/.exec(rest);
    if (first) subcommands.add(first[1]);
    for (const m of rest.matchAll(/\|\s+([a-z][a-z-]*)(?=\s|$)/g)) subcommands.add(m[1]);
  }
  return { flags, subcommands };
};

// A name the script's own parser handles: an options key, or a literal it compares an argument with.
const parsedIn = (source, name) => [`"--${name}"`, `"${name}"`, `${name}:`].some((s) => source.includes(s));

const specs = new Map();
const specOf = (script) => {
  if (!specs.has(script)) {
    const file = join(SCRIPTS, `${script}.mjs`);
    specs.set(script, existsSync(file) ? { ...usageSpec(script, usageOf(script)), source: readFileSync(file, "utf8") } : null);
  }
  return specs.get(script);
};

// The problems of one named command; [] when the scripts accept it.
export const problemsOf = (cmd, specFor = specOf) => {
  const spec = specFor(cmd.script);
  if (spec === null) return [`${cmd.text}: skills/hsdd-auto/scripts/${cmd.script}.mjs does not exist`];
  const ts = tokens(cmd.args);
  const problems = [];
  if (spec.subcommands.size > 0 && ts.length > 0 && BARE.test(ts[0])) {
    if (!spec.subcommands.has(ts[0]) || !parsedIn(spec.source, ts[0])) problems.push(`${cmd.text}: ${ts[0]} is not a subcommand of ${cmd.script}.mjs`);
  }
  ts.forEach((t, i) => {
    if (!t.startsWith("--")) return;
    for (const piece of t.split("|")) {
      const name = piece.replace(/^--/, "").replace(/=.*$/, "");
      if (!spec.flags.has(name) || !parsedIn(spec.source, name)) {
        problems.push(`${cmd.text}: --${name} is not a flag of ${cmd.script}.mjs`);
        continue;
      }
      const values = spec.flags.get(name);
      const value = ts[i + 1];
      if (values !== null && value !== undefined && (BARE.test(value) || ENUM.test(value))) {
        for (const v of value.split("|")) if (!values.has(v)) problems.push(`${cmd.text}: ${v} is not a value of --${name} (${[...values].join("|")})`);
      }
    }
  });
  return problems;
};

// ---------- the tests ----------

test("every script command SKILL.md names exists with that subcommand and flag", () => {
  const text = textOf(SKILL);
  // A code span that wraps across lines would hide its command from the extraction.
  const { prose } = split(text);
  const wrapped = prose.map((l, i) => [i + 1, l]).filter(([, l]) => (l.match(/`/g) ?? []).length % 2 === 1);
  assert.deepEqual(wrapped, [], "every inline code span opens and closes on one line");

  const commands = commandsIn(text);
  assert.ok(commands.length >= 40, `SKILL.md names ${commands.length} script commands`);
  const problems = commands.flatMap((c) => problemsOf(c));
  assert.deepEqual(problems, []);

  // The orchestrator runs every one of these scripts somewhere in the protocol.
  const named = new Set(commands.map((c) => c.script));
  for (const s of ["state", "next", "dispatch", "decide", "gate", "commit", "routed", "report", "adapter"]) {
    assert.ok(named.has(s), `SKILL.md names ${s}.mjs`);
  }
});

test("the command check rejects what the scripts do not accept", () => {
  const bad = [
    "node hsdd/scripts/auto/commit.mjs --step {step} --bogus",
    "node hsdd/scripts/auto/state.mjs reopen-segment",
    "node hsdd/scripts/auto/dispatch.mjs --plan --for later",
    "node hsdd/scripts/auto/routed.mjs open --kind maybe --text x",
    "node hsdd/scripts/auto/nosuch.mjs --step S01",
    "gate.mjs --step {step} --status paused",
  ];
  for (const line of bad) {
    const [cmd] = commandsIn(`\`${line}\``);
    assert.ok(cmd, `extracted ${line}`);
    assert.notDeepEqual(problemsOf(cmd), [], `${line} is refused`);
  }
  const good = [
    "node hsdd/scripts/auto/routed.mjs close {item} --addressed|--explained --by {step} --note \"why\"",
    "node hsdd/scripts/auto/commit.mjs --step {step} --status stopped --no-report",
    "node hsdd/scripts/auto/state.mjs open-segment --mode intake --instruction-file {f} --request {r} --authority draft",
  ];
  for (const line of good) assert.deepEqual(problemsOf(commandsIn(`\`${line}\``)[0]), [], `${line} is accepted`);
});

// Each point of chapter 8 where the orchestrator runs a script, as test/auto-e2e.test.mjs drives it.
const PROTOCOL = [
  ["state.mjs", "defaults"], ["state.mjs", "preflight"], ["state.mjs", "--json"], ["state.mjs", "open-segment"],
  ["state.mjs", "install-scripts"], ["state.mjs", "snapshot"], ["state.mjs", "done"], ["state.mjs", "goal"],
  ["adapter.mjs", "install"], ["adapter.mjs", "check"],
  ["next.mjs", ""], ["next.mjs", "--stages"],
  ["dispatch.mjs", "--next"], ["dispatch.mjs", "--context-file"], ["dispatch.mjs", "--plan --for stop"], ["dispatch.mjs", "--plan --for close"],
  ["dispatch.mjs", "--plan --for decide"], ["dispatch.mjs", "--plan --for stuck"], ["dispatch.mjs", "--plan --for owner"],
  ["dispatch.mjs", "--plan --for size"], ["dispatch.mjs", "--plan --for other"], ["dispatch.mjs", "--result-file"],
  ["dispatch.mjs", "--resume {step} --reason answer"], ["dispatch.mjs", "--resume {step} --reason finding"], ["dispatch.mjs", "--redispatch"],
  ["decide.mjs", "--by orchestrator"], ["decide.mjs", "--by owner --type setup"],
  ["gate.mjs", "--check B1,B5"], ["gate.mjs", "--final"],
  ["routed.mjs", "ingest"], ["routed.mjs", "open"], ["routed.mjs", "decide"], ["routed.mjs", "close"], ["routed.mjs", "--after"],
  ["commit.mjs", "--status completed"], ["commit.mjs", "--status stopped"], ["commit.mjs", "--no-report"], ["commit.mjs", "--skip"],
  ["commit.mjs", "--discard"], ["commit.mjs", "--note \"ended: owner message\""], ["commit.mjs", "--usage-file"],
  ["report.mjs", "--segment"],
];

test("SKILL.md names every script command of the orchestrator's protocol", () => {
  const commands = commandsIn(textOf(SKILL));
  const missing = PROTOCOL.filter(([script, part]) => !commands.some((c) => `${c.script}.mjs` === script && (part === "" ? c.args === "" : c.args.includes(part))));
  assert.deepEqual(missing.map(([s, p]) => `${s} ${p}`.trim()), []);
});

test("SKILL.md's run.yaml example loads as a first-run configuration", () => {
  const block = /```yaml\n([\s\S]*?)```/.exec(textOf(SKILL));
  assert.ok(block, "a yaml block");
  const dir = mkdtempSync(join(tmpdir(), "hsdd-auto-skill-text-"));
  try {
    mkdirSync(join(dir, "hsdd", "auto"), { recursive: true });
    writeFileSync(join(dir, "hsdd", "auto", "run.yaml"), block[1].split("\n").map((l) => l.replace(/^ {3}/, "")).join("\n"));
    const config = loadConfig(dir);
    assert.deepEqual(config.segments, [], "a first-run file ends with a bare segments:");
    assert.deepEqual(config.owner_files.filter((f) => /[*?[]|\/$/.test(f)), [], "owner files are plain files");
    assert.ok(config.read_only.length > 0 && sourcesOf(config).every((s) => config.read_only.some((r) => s.path.startsWith(r))), "read_only covers every source path");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SKILL.md's STOP.md shape is spec 6.7's", () => {
  const block = (text, opener) => {
    const at = text.indexOf(opener);
    assert.ok(at >= 0, `a block opening ${opener}`);
    return text.slice(at, text.indexOf("```", at)).trimEnd();
  };
  const spec = block(SPEC, "# Run stopped at {step}");
  assert.equal(block(textOf(SKILL), "# Run stopped at {step}"), spec);
});

const HOUSE = ["Preconditions", "First run", "The loop", "Judgement points", "Context recovery", "Finishing a segment", "Quality Gates", "Anti-Rationalization"];

test("SKILL.md has the house sections in order and the five anti-rationalization rows", () => {
  const text = textOf(SKILL);
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(front, "front matter");
  assert.match(front[1], /^name: hsdd-auto$/m);
  assert.match(front[1], /^description: /m);
  assert.match(front[1], /Triggers: /);
  assert.match(front[1], /Do NOT use for /);

  // Headings outside fenced blocks: the STOP.md shape carries headings of its own.
  const headings = split(text).prose.flatMap((l) => /^## (.+)$/.exec(l)?.[1].trim() ?? []);
  const at = HOUSE.map((h) => headings.indexOf(h));
  assert.deepEqual(HOUSE.filter((h, i) => at[i] < 0), [], `house sections present: ${headings.join(" | ")}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `house sections in order: ${headings.join(" | ")}`);
  assert.equal(headings.at(-1), "Anti-Rationalization");

  const section = (name) => text.split(`\n## ${name}\n`)[1].split(/\n## /)[0];
  // 4.4 item 7: the quality gates are checkboxes and carry the five the spec names.
  const gates = section("Quality Gates");
  const boxes = gates.split("\n").filter((l) => l.startsWith("- [ ] "));
  assert.ok(boxes.length >= 5);
  for (const re of [/two commits/i, /decide\.mjs/, /dispatch\.mjs/, /step id/i, /STOP\.md/]) {
    assert.ok(boxes.some((b) => re.test(b)), `a quality gate matching ${re}`);
  }
  // 4.4 item 8: the five rows, each a table row.
  const rows = section("Anti-Rationalization").split("\n").filter((l) => l.startsWith("| \""));
  for (const thought of [
    "I remember what that step decided, I'll restate it in the prompt",
    "the timestamp doesn't matter, I'll write one",
    "this stop is obviously answered, I'll let the subagent take it",
    "the gate is wrong this once, I'll commit anyway",
    "I'll check on the subagent in a few minutes",
  ]) {
    assert.ok(rows.some((r) => r.toLowerCase().startsWith(`| "${thought.toLowerCase()}"`)), `an anti-rationalization row for "${thought}"`);
  }
});

test("SKILL.md states the waiting rule and the binding controller rules", () => {
  const text = textOf(SKILL).replace(/\s+/g, " ");
  for (const re of [
    /never poll/i,
    /fallback_wakeup_minutes/,
    /never under 20/i,
    /hsdd-auto-step/,
    /segment\.ended/,
    /`state\.mjs defaults`|state\.mjs defaults`/,
    /files, never directories or globs/i,
    /outside the repository/i,
    /--unattended \{step\}/,
    /\*\*\{segment id\}\.\*\*/,
    // B-25: enforcement the setup installs starts with the next host session; the run goes on.
    /host enforcement \(the deny rules, the hooks, the `hsdd-auto-step` agent type\) starts with the next host session: record a `setup` decision/,
    /do not stop/,
    /default agent type when the adapter is not installed, for the rest of the host session whose setup installed it/,
    /whenever the host rejects `hsdd-auto-step`/,
    /next-host-session decision by id/,
    // The fallback timer is cancelled on hand-back; liveness never comes from a probe message.
    /Cancel it when the hand-back arrives, and ignore a wake-up whose launch has already handed back/,
    /never send it a probe message/,
    // --no-report and --discard hold for every stopped commit of a step that reached gate-twice.
    /Every stopped commit of such a step, whichever branch, takes the flags its last failure needs/,
    // A rerun's status.
    /`\{status\}` is `stopped` when `HEAD`'s artifact subject ends in ` \(stopped\)` or `STOP\.md` names the step, else `completed`/,
    // 9.3: a moved source joins read_only.
    /the new path joins `read_only` when no entry covers it/,
    // Final review B1: run.yaml on a branch that is not checked out is no first run.
    /Only when `hsdd\/auto\/run\.yaml` is missing and `state\.mjs defaults` prints an empty `run_branches`/,
    /An empty `run_branches` means First run/,
  ]) assert.match(text, re);
});

test("every ending runs state.mjs done and puts its output in the final message", () => {
  const text = textOf(SKILL);
  const para = /\*\*Every ending\.\*\*([\s\S]*?)\n\n/.exec(text)?.[1].replace(/\s+/g, " ");
  assert.ok(para, "an Every ending paragraph");
  for (const part of ["`done`", "case A", "`blocked`", "hard stop", "owner's request to stop",
    "`node hsdd/scripts/auto/state.mjs done`", "final message", "`DONE {segment id}`", "`STOPPED {segment id}: hsdd/judgement/STOP.md`"]) {
    assert.ok(para.includes(part), `the Every ending paragraph names ${part}`);
  }
  // Each place a session ends sends the orchestrator there: case A, blocked, the hard stops, an owner's stop.
  const flat = text.replace(/\s+/g, " ");
  for (const re of [
    /tree\. End \(Every ending\), showing the question/,
    /`blocked`: the run is stopped\. End \(Every ending\)/,
    /each ends the run \(Every ending\)/,
    /commit the plan step and end \(Every ending\)/,
  ]) assert.match(flat, re);
});

test("no em dash and no banned phrase in SKILL.md and the command", () => {
  const banned = ["load", "bearing"].join("-");
  for (const file of [SKILL, COMMAND]) {
    const text = textOf(file);
    assert.equal(text.includes("\u2014"), false, `${file} holds an em dash`);
    assert.equal(text.toLowerCase().includes(banned), false, `${file} holds a banned phrase`);
  }
});

test("commands/hsdd-auto.md delegates in one line", () => {
  const text = textOf(COMMAND);
  const m = /^---\ndescription: (.+)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, "front matter with a description, then the body");
  assert.ok(m[1].trim().length > 0);
  assert.deepEqual(m[2].split("\n").filter((l) => l.trim() !== ""), ["Use the hsdd-auto skill to run: $ARGUMENTS"]);
});
