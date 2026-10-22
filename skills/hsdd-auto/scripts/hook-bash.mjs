// The adapter's Bash PreToolUse hook (spec 11.1, rules 1 to 3). evaluateBash is pure over the event,
// the configuration and the two directories; the CLI reads the event on stdin, exits 2 with the reason
// on stderr to block, and exits 0 silently on anything it cannot handle (the gate is the backstop).
import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { expandHome, globToRegExp } from "./lib/paths.mjs";

const isGlob = (p) => /[*?[]/.test(p);
const stripSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
const homeRelative = (abs, home) => (abs === home ? "~" : abs.startsWith(`${home}/`) ? `~/${abs.slice(home.length + 1)}` : null);

// ---------- path forms ----------

// One owner entry in its three forms: the text as written, the absolute path, the `~` path (null when
// outside the home directory). Pure over `home` and `projectDir`.
export const formsOf = (entry, { home, projectDir }) => {
  const owner = stripSlash(entry);
  const abs = owner.startsWith("~")
    ? posix.normalize(`${home}${owner.slice(1)}`)
    : isAbsolute(owner) ? posix.normalize(owner) : posix.normalize(`${projectDir}/${owner}`);
  return { owner, abs, tilde: homeRelative(abs, home), glob: isGlob(owner) };
};

// A token as an absolute path: `~` and `$HOME` expanded, a relative path taken from `cwd`; null when it
// holds a shell variable or substitution this text match cannot resolve.
const absOf = (token, { home, cwd }) => {
  const t = token.replace(/^\$\{?HOME\}?(?=\/|$)/, home).replace(/^~(?=\/|$)/, home);
  if (/[$`]/.test(t) || t === "") return null;
  return posix.normalize(isAbsolute(t) ? t : `${cwd}/${t}`);
};

const under = (path, dir) => path === dir || path.startsWith(dir === "/" ? "/" : `${dir}/`);
const hits = (path, f) => (f.glob ? globToRegExp(f.abs).test(path) || globToRegExp(`${f.abs}/**`).test(path) : under(path, f.abs));

// ---------- tokenizing ----------

const SEPARATORS = new Set([";", "|", "&", "\n", "(", ")", "`"]);

// Words and redirections of a command text, quotes removed, as simple commands:
// [{ words: [...], redirects: [target, ...] }]. A word keeps what is between quotes as written.
export const parseCommands = (text) => {
  const commands = [];
  let words = [];
  let redirects = [];
  let cur = null;
  let pendingRedirect = false;
  const flushWord = () => {
    if (cur === null) return;
    if (pendingRedirect) { redirects.push(cur); pendingRedirect = false; } else words.push(cur);
    cur = null;
  };
  const endCommand = () => {
    flushWord();
    pendingRedirect = false;
    if (words.length > 0 || redirects.length > 0) commands.push({ words, redirects });
    words = [];
    redirects = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'" ) {
      const j = text.indexOf("'", i + 1);
      const end = j < 0 ? text.length : j;
      cur = (cur ?? "") + text.slice(i + 1, end);
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\" && j + 1 < text.length) { s += text[j + 1]; j += 2; } else { s += text[j]; j++; }
      }
      cur = (cur ?? "") + s;
      i = j;
    } else if (c === "\\" && i + 1 < text.length) {
      cur = (cur ?? "") + text[i + 1];
      i++;
    } else if (c === ">") {
      // `2>`, `&>` and `>&2`: a digit-only word before `>` is the descriptor, not an argument.
      if (cur !== null && /^\d+$/.test(cur)) cur = null; else flushWord();
      while (text[i + 1] === ">" || text[i + 1] === "|") i++;
      if (text[i + 1] === "&") { i++; while (/\d|-/.test(text[i + 1] ?? "")) i++; pendingRedirect = false; } else pendingRedirect = true;
    } else if (c === "<") {
      flushWord();
      while (text[i + 1] === "<") i++;
      if (text[i + 1] === "&") { i++; }
      cur = null;
    } else if (/\s/.test(c) && c !== "\n") {
      flushWord();
    } else if (SEPARATORS.has(c)) {
      if (c === "&" && text[i + 1] === ">") { flushWord(); i++; if (text[i + 1] === ">") i++; pendingRedirect = true; continue; }
      endCommand();
    } else cur = (cur ?? "") + c;
  }
  endCommand();
  return commands;
};

const WRAPPERS = new Set(["sudo", "command", "env", "nohup", "time", "exec", "nice", "builtin"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);

// Drops env assignments and wrapper commands from the front of a command's words.
const significant = (words) => {
  let i = 0;
  while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || WRAPPERS.has(basename(words[i])))) i++;
  return words.slice(i);
};

// Every simple command of the text, including those inside `sh -c '...'` strings, wrappers removed.
const flatten = (text, depth = 0) =>
  parseCommands(text).flatMap(({ words, redirects }) => {
    const w = significant(words);
    const nested = depth < 3 && w.length > 0 && SHELLS.has(basename(w[0])) && w.includes("-c") && w[w.indexOf("-c") + 1] !== undefined
      ? flatten(w[w.indexOf("-c") + 1], depth + 1) : [];
    return [{ words: w, redirects }, ...nested];
  });

// ---------- rule 1: out_of_bounds ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The text names the entry as written, in absolute form or in `~` form (not as the tail of a longer path).
const namesLiteral = (text, f) =>
  [f.owner, f.abs, f.tilde].filter((s) => s !== null && s !== "").some((s) =>
    new RegExp(`(?<![\\w.~/-])${escapeRe(s)}(?![\\w.-])`).test(text));

const candidateTokens = (commands) =>
  commands.flatMap(({ words, redirects }) => [...words, ...redirects].flatMap((w) => (w.includes("=") ? [w, w.slice(w.indexOf("=") + 1)] : [w])));

const outOfBoundsHit = (text, commands, forms, ctx) => {
  const tokens = candidateTokens(commands);
  return forms.find((f) =>
    (!f.glob && namesLiteral(text, f)) ||
    tokens.some((t) => { const a = absOf(t, ctx); return a !== null && hits(a, f); }));
};

// ---------- rule 2: writes to read_only ----------

const options = (args) => args.filter((a) => a.startsWith("-") && a !== "-");
const operands = (args) => args.filter((a) => !a.startsWith("-") || a === "-");

// The paths a simple command writes by a file command, with whether removal of a parent counts.
const writtenBy = (words) => {
  const [name0, ...args] = words;
  const name = basename(name0 ?? "");
  switch (name) {
    case "tee": return { paths: operands(args), ancestors: false };
    case "touch": return { paths: operands(args), ancestors: false };
    case "rm": return { paths: operands(args), ancestors: true };
    case "mv": return { paths: operands(args), ancestors: true };
    case "cp": {
      const t = args.findIndex((a) => a === "-t" || a === "--target-directory" || a.startsWith("--target-directory="));
      if (t >= 0) return { paths: [args[t].includes("=") ? args[t].split("=")[1] : args[t + 1]].filter(Boolean), ancestors: false };
      const ops = operands(args);
      return { paths: ops.length > 0 ? [ops.at(-1)] : [], ancestors: false };
    }
    case "sed": {
      const inPlace = options(args).some((o) => o === "--in-place" || o.startsWith("--in-place=") || (/^-[A-Za-z]*i/.test(o) && !o.startsWith("--")));
      return { paths: inPlace ? operands(args) : [], ancestors: false };
    }
    default: return { paths: [], ancestors: false };
  }
};

const readOnlyHit = (commands, forms, ctx) => {
  for (const { words, redirects } of commands) {
    const { paths, ancestors } = writtenBy(words);
    const targets = [...redirects.map((p) => ({ p, ancestors: false })), ...paths.map((p) => ({ p, ancestors }))];
    for (const { p, ancestors: anc } of targets) {
      const a = absOf(p, ctx);
      if (a === null) continue;
      const f = forms.find((g) => hits(a, g) || (anc && !g.glob && under(g.abs, a)));
      if (f) return { form: f, path: p };
    }
  }
  return null;
};

// ---------- rule 3: git state ----------

const GIT_WRITES = new Set(["commit", "add", "rm", "mv", "reset", "checkout", "switch", "restore", "stash", "rebase", "merge", "cherry-pick", "revert", "push", "update-ref"]);
const BRANCH_READS = new Set(["--list", "-a", "-r", "-v", "-vv", "--show-current"]);
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);

const gitChange = (words) => {
  if (basename(words[0] ?? "") !== "git") return null;
  let i = 1;
  while (i < words.length && words[i].startsWith("-")) i += GLOBAL_WITH_VALUE.has(words[i]) ? 2 : 1;
  const sub = words[i];
  const rest = words.slice(i + 1);
  if (sub === undefined) return null;
  if (GIT_WRITES.has(sub)) return `git ${sub}`;
  if (sub === "tag") return !rest.some((a) => a === "-l" || a === "--list") && rest.length > 0 ? "git tag with an argument" : null;
  if (sub === "branch") {
    const listing = rest.includes("--list");
    const other = rest.filter((a) => !BRANCH_READS.has(a) && !(listing && !a.startsWith("-")));
    return other.length > 0 ? "git branch with an argument" : null;
  }
  return null;
};

// ---------- evaluation ----------

export const evaluateBash = (event, config, { home = homedir(), projectDir }) => {
  const text = event?.tool_input?.command;
  if (typeof text !== "string" || text.trim() === "") return { block: false, reason: "" };
  const cwd = typeof event.cwd === "string" && isAbsolute(event.cwd) ? event.cwd : projectDir;
  const ctx = { home, cwd };
  const forms = (list) => (list ?? []).map((e) => formsOf(e, { home, projectDir }));
  const commands = flatten(text);

  const oob = outOfBoundsHit(text, commands, forms(config.out_of_bounds), ctx);
  if (oob) return { block: true, reason: `hsdd-auto: this command names ${oob.owner}, which is out of bounds for the run (run.yaml out_of_bounds). Do not read it; state what you needed in your report's notes instead.` };

  const ro = readOnlyHit(commands, forms(config.read_only), ctx);
  if (ro) return { block: true, reason: `hsdd-auto: this command writes ${ro.path}, which is under ${ro.form.owner}, a read-only path of the run (run.yaml read_only). Write only inside your step's write set.` };

  if (typeof event.agent_id === "string" && event.agent_id !== "") {
    const change = commands.map(({ words }) => gitChange(words)).find((c) => c !== null && c !== undefined);
    if (change) return { block: true, reason: `hsdd-auto: ${change} changes git state. A step never does that: commit.mjs commits the step's files after the gate.` };
  }
  return { block: false, reason: "" };
};

// ---------- CLI ----------

export const main = (stdinText, env = process.env, cwd = process.cwd()) => {
  try {
    const event = JSON.parse(stdinText);
    const projectDir = resolve(env.CLAUDE_PROJECT_DIR || cwd);
    const config = loadConfig(projectDir);
    const { block, reason } = evaluateBash(event, config, { home: homedir(), projectDir });
    return block ? { code: 2, stderr: reason } : { code: 0, stderr: "" };
  } catch {
    return { code: 0, stderr: "" };
  }
};

const isEntry = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isEntry()) {
  let input = "";
  try { input = readFileSync(0, "utf8"); } catch { /* no stdin */ }
  const { code, stderr } = main(input);
  if (stderr) process.stderr.write(`${stderr}\n`);
  process.exitCode = code;
}
