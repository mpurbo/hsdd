import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBash } from "../skills/hsdd-auto/scripts/hook-bash.mjs";
import { evaluateStop } from "../skills/hsdd-auto/scripts/hook-subagent-stop.mjs";
import { reportPath } from "../skills/hsdd-auto/scripts/lib/paths.mjs";
import { SCRIPTS, baseConfig, makeRepo, openStep } from "./helpers/auto-repo.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "auto", "hooks");
const HOME = "/home/owner";
const PROJECT = "/work/shop";
const CONFIG = { out_of_bounds: ["docs/private", "/srv/secret", "~/.ssh", "~/.claude*/projects/*/memory", "vault/**"], read_only: ["ref/", "~/notes", "/etc/shared", "specs/*.md"] };
const bash = (command, extra = {}) => evaluateBash({ tool_name: "Bash", tool_input: { command }, cwd: PROJECT, ...extra }, CONFIG, { home: HOME, projectDir: PROJECT });
const blocks = (command, extra) => assert.equal(bash(command, extra).block, true, `should block: ${command}`);
const allows = (command, extra) => assert.equal(bash(command, extra).block, false, `should allow: ${command}`);

test("every form of an out-of-bounds path is blocked", () => {
  blocks("cat docs/private/notes.md");        // owner form
  blocks("cat ./docs/private/notes.md");
  blocks("ls docs/private");
  blocks(`cat ${PROJECT}/docs/private/notes.md`); // absolute form
  blocks("cat /srv/secret/key.pem");           // owner is absolute
  blocks("cat ~/.ssh/id_rsa");                 // ~ form
  blocks(`cat ${HOME}/.ssh/id_rsa`);           // its absolute form
  blocks('cat "$HOME/.ssh/id_rsa"');
  blocks("cat ~/.claude-personal/projects/x/memory/MEMORY.md"); // a path a glob matches
  blocks("grep -r token vault/a/b.txt");       // under a glob entry
  blocks("head -n1 < docs/private/a");
  blocks("bash -c 'cat docs/private/a'");
  blocks("echo x > out.txt && cat docs/private/a");
  blocks("cat --file=docs/private/a");
  allows("cat docs/privately/a");
  allows("cat src/docs/private/a");
  allows("cat ~/.sshconfig-backup");
  assert.match(bash("cat docs/private/a").reason, /docs\/private/);
});

test("ls of the project root is allowed", () => {
  allows(`ls ${PROJECT}`);
  allows("ls .");
  allows("ls -la");
  allows("cat README.md");
  assert.equal(bash("").block, false);
  assert.equal(evaluateBash({ tool_name: "Bash", tool_input: {} }, CONFIG, { home: HOME, projectDir: PROJECT }).block, false);
});

test("writes to read-only paths are blocked by redirection and file commands", () => {
  blocks("echo x > ref/spec.md");
  blocks("echo x >> ref/spec.md");
  blocks("echo x>ref/spec.md");
  blocks("echo x 2>&1 | tee ref/spec.md");
  blocks("cp a.md ref/spec.md");
  blocks("cp -t ref a.md");
  blocks("mv ref/spec.md old.md");
  blocks("mv a.md ref/b.md");
  blocks("rm ref/spec.md");
  blocks("rm -rf ref");
  blocks("rm -rf .");
  blocks("sed -i 's/a/b/' ref/spec.md");
  blocks("sed -i.bak s/a/b/ ref/spec.md");
  blocks("touch ref/new.md");
  blocks("touch ~/notes/x.md");
  blocks(`touch ${HOME}/notes/x.md`);
  blocks("echo x > /etc/shared/f");
  blocks("echo x > specs/a.md");                       // a glob entry
  blocks("sh -c 'rm ref/a'");
  blocks("FOO=1 sudo rm ref/a");
  allows("cat ref/spec.md");
  allows("cp ref/spec.md copy.md");
  allows("sed -n 1p ref/spec.md");
  allows("echo x > out/ref/a");
  allows("echo x > reference.md");
  allows("echo x > specs/nested/a.txt");
  allows("echo x 2>/dev/null");
  assert.match(bash("rm ref/a").reason, /read-only/);
});

test("git writes are blocked only with agent_id", () => {
  const sub = { agent_id: "a1", agent_type: "hsdd-auto-step" };
  for (const c of ["git commit -m x", "git add -A", "git rm f", "git mv a b", "git reset --hard", "git checkout main", "git switch x", "git restore f",
    "git stash", "git rebase main", "git merge x", "git cherry-pick abc", "git revert abc", "git push", "git update-ref HEAD abc", "git -C . commit -m x",
    "git tag v1", "git tag -d v1", "cd x && git add f", "git status; git commit -m x"]) {
    blocks(c, sub);
    allows(c);
  }
  for (const c of ["git status", "git diff", "git log --oneline", "git show HEAD", "git tag", "git tag -l", "git tag --list 'v*'", "git branch", "git branch --list", "git branch -a",
    "git branch -r", "git branch -v", "git branch -vv", "git branch --show-current", "git branch --list 'feat*'", "git rev-parse HEAD", "echo git commit"]) allows(c, sub);
  assert.match(bash("git commit -m x", sub).reason, /git commit/);
  allows("node hsdd/scripts/auto/commit.mjs --step S04", sub);
});

test("git branch new-name is a write; git branch --show-current is not", () => {
  const sub = { agent_id: "a1" };
  blocks("git branch new-name", sub);
  blocks("git branch -D old", sub);
  blocks("git branch -m a b", sub);
  allows("git branch --show-current", sub);
  allows("git branch new-name");
});

test("bash hook CLI: exit 2 with the reason on stderr, else 0 and silent", () => {
  const dir = makeRepo({ config: baseConfig({ out_of_bounds: ["docs/private"] }) });
  const hook = join(SCRIPTS, "hook-bash.mjs");
  const call = (input, env = { CLAUDE_PROJECT_DIR: dir }) => spawnSync(process.execPath, [hook], { cwd: dir, input, encoding: "utf8", env: { ...process.env, ...env } });
  const blockedRun = call(readFileSync(join(FIX, "bash-event-cat.json"), "utf8"));
  assert.equal(blockedRun.status, 2);
  assert.match(blockedRun.stderr, /docs\/private/);
  assert.equal(blockedRun.stdout, "");
  const git = call(readFileSync(join(FIX, "bash-event-git-subagent.json"), "utf8"));
  assert.equal(git.status, 2);
  const ok = call(JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }));
  assert.deepEqual([ok.status, ok.stdout, ok.stderr], [0, "", ""]);
  const garbage = call("not json");
  assert.deepEqual([garbage.status, garbage.stderr], [0, ""]);
  const empty = makeRepo({ commit: false });
  writeFileSync(join(empty, "hsdd/auto/run.yaml"), "run: [unclosed\n");
  const badConfig = call(readFileSync(join(FIX, "bash-event-cat.json"), "utf8"), { CLAUDE_PROJECT_DIR: empty });
  assert.deepEqual([badConfig.status, badConfig.stderr], [0, ""]);
  const noConfig = call(readFileSync(join(FIX, "bash-event-cat.json"), "utf8"), { CLAUDE_PROJECT_DIR: tmpdir() });
  assert.deepEqual([noConfig.status, noConfig.stderr], [0, ""]);
  assert.ok(homedir());
});

// ---------- the SubagentStop hook ----------

const stopRepo = () => {
  const dir = makeRepo();
  openStep(dir, { step: "S04", segment: "2026-10-22-plan", kind: "spec-touch", target: "shop.api" });
  const tdir = mkdtempSync(join(tmpdir(), "hsdd-transcript-"));
  const transcript = join(tdir, "agent.jsonl");
  copyFileSync(join(FIX, "subagent-S04.jsonl"), transcript);
  return { dir, transcript, event: (over = {}) => ({ hook_event_name: "SubagentStop", agent_transcript_path: transcript, agent_id: "a1", stop_hook_active: false, ...over }) };
};
const reportFor = (over = {}) => ({
  step_ref: "S04", skill: "hsdd-spec", target: "shop.api", status: "completed", stop: null, artifacts: [], experiments: [], self_check: [],
  routed: [], closes: [], reads_outside: [], notes: ["did the step"], read_check: "00000000", ...over,
});
const putReport = (dir, report, n = 0) => { mkdirSync(join(dir, "hsdd/auto/steps"), { recursive: true }); writeFileSync(join(dir, reportPath("S04", n)), typeof report === "string" ? report : JSON.stringify(report)); };

test("stop hook on missing or invalid report", () => {
  const { dir, event } = stopRepo();
  assert.deepEqual(evaluateStop(event(), dir), { block: true, reason: "Write your report to hsdd/auto/steps/S04.json before ending" });
  putReport(dir, "{ nope");
  assert.match(evaluateStop(event(), dir).reason, /^Write your report to hsdd\/auto\/steps\/S04\.json before ending: .*not valid JSON/);
  putReport(dir, { step_ref: "S04" });
  assert.match(evaluateStop(event(), dir).reason, /^Write your report to hsdd\/auto\/steps\/S04\.json before ending: /);
  putReport(dir, reportFor({ target: "other" }));
  assert.match(evaluateStop(event(), dir).reason, /target other is not the dispatched shop\.api/);
  putReport(dir, reportFor());
  assert.deepEqual(evaluateStop(event(), dir), { block: false, reason: "" });
});

test("stop hook on read-check mismatch", () => {
  const { dir, event } = stopRepo();
  putReport(dir, reportFor({ read_check: "deadbeef" }));
  assert.deepEqual(evaluateStop(event(), dir), { block: true, reason: "Read hsdd/auto/dispatch/S04.md to its end, then correct your report" });
  putReport(dir, reportFor({ read_check: "00000000" }));
  assert.equal(evaluateStop(event(), dir).block, false);
});

test("stop hook reads the latest report of the series", () => {
  const { dir, event } = stopRepo();
  const file = join(dir, "hsdd/auto/dispatch/S04.md");
  const text = readFileSync(file, "utf8").replace(/^(launches: \[.*)\]$/m, "$1, { at: \"2026-10-22T10:00:00Z\", reason: resume-answer }]");
  assert.notEqual(text, readFileSync(file, "utf8"));
  writeFileSync(file, text);
  putReport(dir, reportFor());
  assert.equal(evaluateStop(event(), dir).block, true, "a resume launch expects S04.r1.json");
  assert.match(evaluateStop(event(), dir).reason, /S04\.r1\.json/);
  putReport(dir, reportFor(), 1);
  assert.equal(evaluateStop(event(), dir).block, false);
});

test("stop hook nudges once: stop_hook_active exits 0", () => {
  const { dir, event } = stopRepo();
  assert.equal(evaluateStop(event(), dir).block, true);
  assert.equal(evaluateStop(event({ stop_hook_active: true }), dir).block, false);
});

test("stop hook ignores other subagents and unreadable transcripts", () => {
  const { dir, event } = stopRepo();
  assert.equal(evaluateStop(event({ agent_transcript_path: join(FIX, "subagent-other.jsonl") }), dir).block, false);
  assert.equal(evaluateStop(event({ agent_transcript_path: join(dir, "missing.jsonl") }), dir).block, false);
  assert.equal(evaluateStop(event({ agent_transcript_path: undefined }), dir).block, false);
  assert.equal(evaluateStop({}, dir).block, false);
  assert.equal(evaluateStop(null, dir).block, false);
  const bad = join(dir, "bad.jsonl");
  writeFileSync(bad, "not json\n\u0000\n");
  assert.equal(evaluateStop(event({ agent_transcript_path: bad }), dir).block, false);
  // a step with no dispatch file, and a prompt naming a path that is not the step's own dispatch file
  const other = join(dir, "other.jsonl");
  writeFileSync(other, `${JSON.stringify({ type: "user", message: { role: "user", content: "You are step S09 of an unattended HSDD run. Your complete instructions are\nin hsdd/auto/dispatch/S09.md. Read" } })}\n`);
  assert.equal(evaluateStop(event({ agent_transcript_path: other }), dir).block, false);
  const odd = join(dir, "odd.jsonl");
  writeFileSync(odd, `${JSON.stringify({ type: "user", message: { role: "user", content: "You are step S04 of an unattended HSDD run. Your complete instructions are\nin ../elsewhere/S04.md. Read" } })}\n`);
  assert.equal(evaluateStop(event({ agent_transcript_path: odd }), dir).block, false);
});

test("stop hook CLI exits 2 with the reason on stderr", () => {
  const { dir, event } = stopRepo();
  const hook = join(SCRIPTS, "hook-subagent-stop.mjs");
  const call = (input) => spawnSync(process.execPath, [hook], { cwd: dir, input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const r = call(JSON.stringify(event()));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Write your report to hsdd\/auto\/steps\/S04\.json before ending/);
  assert.deepEqual([call("garbage").status, call(JSON.stringify(event({ stop_hook_active: true }))).status], [0, 0]);
});
