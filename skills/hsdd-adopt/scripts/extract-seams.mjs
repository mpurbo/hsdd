#!/usr/bin/env node
import { realpathSync, readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync } from "node:fs";
import { resolve, relative, dirname, join, isAbsolute, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { walk, moduleOf, normalizePrefix } from "./walk.mjs";
import { renderObservedSurface } from "./render.mjs";
import { parseObservedSurface, diffSurface } from "./diff.mjs";
import { manifests } from "./manifests.mjs";
import { routes } from "./routes.mjs";
import { schemas } from "./schemas.mjs";
import { migrations } from "./migrations.mjs";
import { topics } from "./topics.mjs";
import { owners, ownersFile, ownersOf } from "./owners.mjs";
import { coupling } from "./coupling.mjs";

export function modules(files) {
  const counts = new Map();
  for (const f of files) {
    const m = moduleOf(f, 2);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts].map(([path, n]) => ({ path, files: n })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function shortSha(root) {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "n/a";
  } catch {
    return "n/a";
  }
}

// Keep the rules that are the last match for at least one in-scope file and
// have owners, in file order.
function scopeOwners(rules, files) {
  const live = new Set();
  for (const f of files) {
    const hit = ownersOf(rules, f);
    if (hit && hit.owners.length) live.add(hit);
  }
  return rules.filter((r) => live.has(r));
}

export function extract(root, { prefixes = [] } = {}) {
  const real = realpathSync(resolve(root));
  const wanted = prefixes.map(normalizePrefix).filter(Boolean);
  const unreadable = [];
  const files = walk(real, { prefixes: wanted, onSkip: (p) => unreadable.push(p) });
  return {
    kind: "seams",
    version: 1,
    root: real,
    sha: shortSha(real),
    date: new Date().toISOString().slice(0, 10),
    prefixes: wanted,
    modules: modules(files),
    manifests: manifests(files),
    routes: routes(real, files),
    schemas: schemas(files),
    migrations: migrations(real, files),
    topics: topics(real, files),
    ownersFile: ownersFile(real),
    owners: scopeOwners(owners(real, files), files),
    coupling: coupling(real, { prefixes: wanted }),
    unreadable: unreadable.sort(),
  };
}

const USAGE = `usage:
  extract-seams.mjs extract [--root DIR] [--prefix P]... [-o FILE]
  extract-seams.mjs render  [--root DIR] [--prefix P]... [--model FILE]
  extract-seams.mjs diff SPEC.md [--root DIR]
`;

function parseArgs(argv) {
  const opts = { positional: [], prefixes: [], root: null, out: null, model: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--root") opts.root = value();
    else if (a === "--prefix") opts.prefixes.push(value());
    else if (a === "-o") opts.out = value();
    else if (a === "--model") opts.model = value();
    else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

// True when path resolves (through symlinks) to somewhere under dir.
function insideDir(dir, path) {
  let base = path;
  while (!existsSync(base)) {
    if (lstatOrNull(base)) return false; // dangling symlink
    const up = dirname(base);
    if (up === base) return false;
    base = up;
  }
  const real = join(realpathSync(base), relative(base, path));
  const rel = relative(realpathSync(dir), real);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function lstatOrNull(p) {
  try { return lstatSync(p); } catch { return null; }
}

export function main(argv, cwd = process.cwd()) {
  const write = (s) => process.stdout.write(s);
  const fail = (s) => process.stderr.write(`${s}\n`);
  let opts;
  try {
    opts = parseArgs(argv.slice(1));
  } catch (e) {
    fail(e.message);
    fail(USAGE);
    return 1;
  }
  const cmd = argv[0];
  const root = resolve(cwd, opts.root ?? ".");
  try {
    if (cmd === "extract") {
      const model = extract(root, { prefixes: opts.prefixes });
      for (const p of model.unreadable) fail(`skipped unreadable: ${p}`);
      const json = `${JSON.stringify(model, null, 2)}\n`;
      if (opts.out === null) { write(json); return 0; }
      const target = resolve(cwd, opts.out);
      if (![cwd, root].some((d) => existsSync(d) && insideDir(d, target))) {
        fail(`refusing to write ${target}: -o must be under the current directory or --root`);
        return 1;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, json);
      return 0;
    }
    if (cmd === "render") {
      const model = opts.model ? JSON.parse(readFileSync(resolve(cwd, opts.model), "utf8")) : extract(root, { prefixes: opts.prefixes });
      for (const p of opts.model ? [] : model.unreadable) fail(`skipped unreadable: ${p}`);
      write(renderObservedSurface(model));
      return 0;
    }
    if (cmd === "diff") {
      if (opts.positional.length !== 1) { fail(USAGE); return 1; }
      const recorded = parseObservedSurface(readFileSync(resolve(cwd, opts.positional[0]), "utf8"));
      if (!recorded) { fail(`${opts.positional[0]} has no "## Observed surface" section`); return 2; }
      if (recorded.modules.length === 0) { write("nothing compared: the recorded surface names no modules\n"); return 0; }
      const diff = diffSurface(recorded, extract(root, { prefixes: recorded.modules }));
      write(diff.length ? diff.map((d) => `${d.field} ${d.kind} ${d.value}\n`).join("") : "nothing changed\n");
      return 0;
    }
  } catch (e) {
    fail(e.message);
    return 1;
  }
  fail(USAGE);
  return 1;
}

const entry = process.argv[1] && (() => { try { return pathToFileURL(realpathSync(process.argv[1])).href; } catch { return null; } })();
if (entry === import.meta.url) process.exitCode = main(process.argv.slice(2));
