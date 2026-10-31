import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AGENT_FILE, SETTINGS, check, install, renderAgent, ruleFor, uninstall } from "../skills/hsdd-auto/scripts/adapter.mjs";
import { loadConfig } from "../skills/hsdd-auto/scripts/lib/config.mjs";
import { validate } from "../skills/hsdd-auto/scripts/lib/schema.mjs";
import { splitFrontMatter } from "../skills/hsdd-auto/scripts/lib/yaml.mjs";
import { baseConfig, installScripts, makeRepo, run } from "./helpers/auto-repo.mjs";

const config = (over = {}) => baseConfig({ out_of_bounds: ["docs/private", "/srv/secret", "~/.claude*/projects/*/memory"], read_only: ["ref/", "specs/*.md"], ...over });
const repo = (over, scripts = true) => {
  const dir = makeRepo({ config: config(over) });
  if (scripts) installScripts(dir);
  return dir;
};
const put = (dir, rel, text) => { mkdirSync(join(dir, rel, ".."), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), "utf8");
const json = (dir, rel) => JSON.parse(read(dir, rel));

test("rule translation", () => {
  assert.equal(ruleFor("/a/b", "Read"), "Read(//a/b/**)");
  assert.equal(ruleFor("~/a/b", "Read"), "Read(~/a/b/**)");
  assert.equal(ruleFor("a/b", "Edit"), "Edit(/a/b/**)");
  assert.equal(ruleFor("~/.claude*/projects/*/memory", "Read"), "Read(~/.claude*/projects/*/memory/**)");
  assert.equal(ruleFor("ref/**", "Edit"), "Edit(/ref/**)");
  assert.equal(ruleFor("ref/", "Edit"), "Edit(/ref/**)");
  assert.equal(ruleFor("./ref", "Edit"), "Edit(/ref/**)");
  assert.equal(ruleFor("specs/*.md", "Edit"), "Edit(/specs/*.md/**)");
  assert.equal(ruleFor("~", "Read"), "Read(~/**)");
});

test("install keeps existing settings and uninstall removes exactly what it added", () => {
  const dir = repo();
  const owner = {
    model: "opus",
    permissions: { allow: ["Bash(ls)"], deny: ["Read(//etc/passwd/**)", "Edit(/ref/**)"] },
    hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo hi" }] }], Stop: [{ hooks: [{ type: "command", command: "echo bye" }] }] },
  };
  put(dir, SETTINGS, `${JSON.stringify(owner, null, 2)}\n`);
  const record = install(dir, loadConfig(dir), { stopHook: true });
  const after = json(dir, SETTINGS);
  assert.equal(after.model, "opus");
  assert.deepEqual(after.permissions.allow, ["Bash(ls)"]);
  assert.deepEqual(after.permissions.deny.slice(0, 2), owner.permissions.deny);
  assert.ok(after.permissions.deny.includes("Read(/docs/private/**)"));
  assert.ok(after.permissions.deny.includes("Read(//srv/secret/**)"));
  assert.ok(after.permissions.deny.includes("Read(~/.claude*/projects/*/memory/**)"));
  assert.ok(after.permissions.deny.includes("Edit(/specs/*.md/**)"));
  assert.ok(after.permissions.deny.includes("Edit(/specs/*.md)"));
  assert.ok(after.permissions.deny.includes("Read(/docs/private)"));
  assert.equal(after.hooks.PreToolUse[0].matcher, "Write");
  assert.equal(after.hooks.PreToolUse[1].matcher, "Bash");
  assert.equal(after.hooks.PreToolUse[1].hooks[0].command, 'node "${CLAUDE_PROJECT_DIR}/hsdd/scripts/auto/hook-bash.mjs"');
  assert.equal(after.hooks.SubagentStop[0].hooks[0].command, 'node "${CLAUDE_PROJECT_DIR}/hsdd/scripts/auto/hook-subagent-stop.mjs"');
  assert.deepEqual(after.hooks.Stop, owner.hooks.Stop);
  // "Edit(/ref/**)" was already the owner's: it is not recorded
  assert.ok(!record.added.some((a) => a.value === "Edit(/ref/**)"));
  assert.deepEqual(validate("adapter", json(dir, "hsdd/auto/adapter.json")), []);
  assert.deepEqual(record.created, [AGENT_FILE]);
  assert.ok(record.added.every((a) => a.file === SETTINGS && a.pointer.startsWith("/")));
  assert.ok(existsSync(join(dir, AGENT_FILE)));

  uninstall(dir);
  assert.deepEqual(json(dir, SETTINGS), owner);
  assert.ok(!existsSync(join(dir, AGENT_FILE)));
  assert.ok(!existsSync(join(dir, "hsdd/auto/adapter.json")));
});

test("uninstall deletes a settings file install created, and keeps one that holds other entries", () => {
  const dir = repo();
  const record = install(dir, loadConfig(dir), {});
  assert.deepEqual(record.created, [SETTINGS, AGENT_FILE]);
  uninstall(dir);
  assert.ok(!existsSync(join(dir, SETTINGS)));
  assert.ok(!existsSync(join(dir, ".claude")));

  install(dir, loadConfig(dir), {});
  const s = json(dir, SETTINGS);
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ ...s, env: { A: "1" } }));
  uninstall(dir);
  assert.deepEqual(json(dir, SETTINGS), { env: { A: "1" } });
});

test("uninstall leaves an agent file the owner changed, and uninstall without a record does nothing", () => {
  const dir = repo();
  uninstall(dir);
  install(dir, loadConfig(dir), {});
  writeFileSync(join(dir, AGENT_FILE), `${read(dir, AGENT_FILE)}\nOwner addition.\n`);
  uninstall(dir);
  assert.ok(existsSync(join(dir, AGENT_FILE)));
  assert.ok(!existsSync(join(dir, "hsdd/auto/adapter.json")));
});

test("install does not overwrite an agent file it did not create", () => {
  const dir = repo();
  put(dir, AGENT_FILE, "mine\n");
  const record = install(dir, loadConfig(dir), {});
  assert.equal(read(dir, AGENT_FILE), "mine\n");
  assert.ok(!record.created.includes(AGENT_FILE));
  uninstall(dir);
  assert.equal(read(dir, AGENT_FILE), "mine\n");
});

test("install is idempotent", () => {
  const dir = repo();
  const first = install(dir, loadConfig(dir), { stopHook: true });
  const settings = read(dir, SETTINGS);
  const second = install(dir, loadConfig(dir), { stopHook: true });
  assert.deepEqual(second, first);
  assert.equal(read(dir, SETTINGS), settings);
  const third = install(dir, loadConfig(dir), {});
  assert.deepEqual(third, first, "a later install without --stop-hook keeps what was recorded");
  const s = json(dir, SETTINGS);
  assert.equal(s.hooks.PreToolUse.length, 1);
  assert.equal(new Set(s.permissions.deny).size, s.permissions.deny.length);
  uninstall(dir);
  assert.ok(!existsSync(join(dir, SETTINGS)));
});

test("the step agent type has the allowlist, disallows the agent-launching tool and carries models.step", () => {
  const dir = repo({ models: { step: "sonnet" } });
  install(dir, loadConfig(dir), {});
  const { data } = splitFrontMatter(read(dir, AGENT_FILE));
  assert.equal(data.name, "hsdd-auto-step");
  assert.equal(data.model, "sonnet");
  assert.equal(data.tools, "Read, Write, Edit, Glob, Grep, Bash, Skill");
  assert.equal(data.disallowedTools, "Agent, Task");
  assert.ok(data.description.length > 0);
  assert.ok(!/model:/.test(renderAgent(loadConfig(repo()))));
  assert.ok(!read(dir, AGENT_FILE).includes("\u2014"));
});

test("a settings file that is not JSON is refused and nothing changes", () => {
  const dir = repo();
  put(dir, SETTINGS, "{ nope");
  assert.throws(() => install(dir, loadConfig(dir), {}), /not valid JSON/);
  assert.equal(read(dir, SETTINGS), "{ nope");
  assert.ok(!existsSync(join(dir, "hsdd/auto/adapter.json")));
});

test("check passes after install and fails when a rule is removed", () => {
  const dir = repo();
  const cfg = loadConfig(dir);
  assert.match(check(dir, cfg).join("\n"), /does not exist/);
  install(dir, cfg, {});
  assert.deepEqual(check(dir, cfg), []);
  const s = json(dir, SETTINGS);
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ ...s, permissions: { deny: s.permissions.deny.filter((r) => r !== "Read(/docs/private/**)") } }));
  assert.deepEqual(check(dir, cfg), ["Read(/docs/private/**)"].map((r) => `${SETTINGS} lacks the deny rule ${r}`));
  install(dir, cfg, {});
  assert.deepEqual(check(dir, cfg), []);
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ ...s, hooks: {} }));
  assert.match(check(dir, cfg).join("\n"), /lacks the Bash PreToolUse hook/);
});

test("check fails when the hook script copy is missing, the agent file allows Agent, or a sample is not blocked", () => {
  const dir = repo({}, false);
  const cfg = loadConfig(dir);
  install(dir, cfg, { stopHook: true });
  const failures = check(dir, cfg).join("\n");
  assert.match(failures, /hook-bash\.mjs does not exist/);
  assert.match(failures, /hook-subagent-stop\.mjs does not exist/);
  installScripts(dir);
  assert.deepEqual(check(dir, cfg), []);
  writeFileSync(join(dir, AGENT_FILE), read(dir, AGENT_FILE).replace("disallowedTools: Agent, Task", "disallowedTools: Foo").replace("tools: Read", "tools: Agent, Read"));
  const agent = check(dir, cfg).join("\n");
  assert.match(agent, /disallowedTools does not name Agent/);
  assert.match(agent, /tools names Agent/);
});

test("check exercises every form of every out-of-bounds path (the sample events)", () => {
  const dir = repo({ out_of_bounds: ["docs/private", "~/.claude*/projects/*/memory", "vault/**"] });
  const cfg = loadConfig(dir);
  install(dir, cfg, {});
  assert.deepEqual(check(dir, cfg), []);
});

test("CLI install, check, uninstall", () => {
  const dir = repo();
  const i = run(dir, "adapter.mjs", ["install", "--stop-hook"]);
  assert.equal(i.code, 0, i.stdout + i.stderr);
  assert.match(i.stdout.trim().split("\n").at(-1), /^adapter: \d+ element\(s\) added/);
  const c = run(dir, "adapter.mjs", ["check"]);
  assert.deepEqual([c.code, c.stdout.trim()], [0, "adapter check: ok"]);
  const s = json(dir, SETTINGS);
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ ...s, permissions: { deny: [] } }));
  const bad = run(dir, "adapter.mjs", ["check"]);
  assert.equal(bad.code, 1);
  assert.match(bad.stdout, /error: .*lacks the deny rule/);
  assert.match(bad.stdout.trim().split("\n").at(-1), /^adapter check: \d+ failure\(s\)$/);
  const u = run(dir, "adapter.mjs", ["uninstall"]);
  assert.equal(u.code, 0);
  assert.ok(!existsSync(join(dir, "hsdd/auto/adapter.json")));
  assert.equal(run(dir, "adapter.mjs", ["bogus"]).code, 2);
  assert.equal(run(dir, "adapter.mjs", ["check", "--stop-hook"]).code, 2);
  const noConfig = makeRepo({ commit: false });
  writeFileSync(join(noConfig, "hsdd/auto/run.yaml"), "run: [unclosed\n");
  assert.equal(run(noConfig, "adapter.mjs", ["install"]).code, 1);
});

test("a file entry and a file glob each get the bare rule and the /** rule", () => {
  const dir = repo({ out_of_bounds: ["secrets.env", "~/.aws/credentials"], read_only: ["ref/spec.md", "ref/", "docs/**"] });
  install(dir, loadConfig(dir), {});
  const deny = json(dir, SETTINGS).permissions.deny;
  for (const r of ["Read(/secrets.env)", "Read(/secrets.env/**)", "Read(~/.aws/credentials)", "Read(~/.aws/credentials/**)",
    "Edit(/ref/spec.md)", "Edit(/ref/spec.md/**)", "Edit(/ref)", "Edit(/ref/**)", "Edit(/docs/**)"]) assert.ok(deny.includes(r), r);
  assert.equal(deny.filter((r) => r === "Edit(/docs/**)").length, 1);
  assert.equal(new Set(deny).size, deny.length);
  const cfg = loadConfig(dir);
  assert.deepEqual(check(dir, cfg), []);
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ permissions: { deny: deny.filter((r) => r !== "Read(/secrets.env)") }, hooks: json(dir, SETTINGS).hooks }));
  assert.match(check(dir, cfg).join("\n"), /lacks the deny rule Read\(\/secrets\.env\)/);
});

test("uninstall refuses an unreadable or invalid settings file and keeps adapter.json", () => {
  const dir = repo();
  install(dir, loadConfig(dir), {});
  writeFileSync(join(dir, SETTINGS), "{ nope");
  assert.throws(() => uninstall(dir), (e) => e.name === "AdapterError" && e.message.includes(SETTINGS));
  assert.ok(existsSync(join(dir, "hsdd/auto/adapter.json")));
  assert.equal(read(dir, SETTINGS), "{ nope");
  const r = run(dir, "adapter.mjs", ["uninstall"]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /settings\.json/);
});

test("elements are compared by canonical JSON, so key order never duplicates", () => {
  const dir = repo();
  put(dir, SETTINGS, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: 'node "${CLAUDE_PROJECT_DIR}/hsdd/scripts/auto/hook-bash.mjs"', type: "command" }], matcher: "Bash" }] } }));
  const record = install(dir, loadConfig(dir), {});
  assert.equal(json(dir, SETTINGS).hooks.PreToolUse.length, 1);
  assert.ok(!record.added.some((a) => a.pointer === "/hooks/PreToolUse"));
});

test("a non-array deny is a check failure and an install refusal", () => {
  const dir = repo();
  const cfg = loadConfig(dir);
  install(dir, cfg, {});
  const s = json(dir, SETTINGS);
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ ...s, permissions: { deny: "Read(x)" } }));
  assert.match(check(dir, cfg).join("\n"), /permissions\.deny is not an array/);
  assert.throws(() => install(dir, cfg, {}), /not an array/);
  assert.equal(json(dir, SETTINGS).permissions.deny, "Read(x)");
  const d2 = repo();
  put(d2, SETTINGS, JSON.stringify({ permissions: [] }));
  assert.throws(() => install(d2, loadConfig(d2), {}), /not an object/);
});

test("check reports an owner's agent file that does not match", () => {
  const dir = repo();
  put(dir, AGENT_FILE, "mine\n");
  install(dir, loadConfig(dir), {});
  assert.match(check(dir, loadConfig(dir)).join("\n"), /hsdd-auto-step\.md/);
});

test("the record is written before the settings, and uninstall tolerates absent recorded elements", () => {
  const dir = repo();
  install(dir, loadConfig(dir), {});
  writeFileSync(join(dir, SETTINGS), JSON.stringify({ env: { A: "1" } }));
  uninstall(dir);
  assert.deepEqual(json(dir, SETTINGS), { env: { A: "1" } });
  assert.ok(!existsSync(join(dir, "hsdd/auto/adapter.json")));
});
