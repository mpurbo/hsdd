#!/usr/bin/env node
// Starts the real backend and the web dev server together. Ctrl-C stops
// both; if either exits, the other is stopped and the runner exits with the
// first non-zero code. No dependencies.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const SERVERS = [
  ["backend", ["--prefix", "backend", "start"]],
  ["web", ["--prefix", "web", "run", "dev", "--", "--strictPort"]],
];

const prefix = (name, stream, out) => {
  let rest = "";
  stream.on("data", (chunk) => {
    const lines = (rest + chunk).split("\n");
    rest = lines.pop();
    for (const line of lines) out.write(`[${name}] ${line}\n`);
  });
};

const children = SERVERS.map(([name, args]) => {
  // Each child leads its own process group, so stopping it also stops what
  // npm started under it (node, vite).
  const child = spawn(npm, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
  prefix(name, child.stdout, process.stdout);
  prefix(name, child.stderr, process.stderr);
  return { name, child, running: true };
});

let exitCode = null;
const stopAll = () => {
  for (const c of children) {
    if (!c.running) continue;
    try { process.kill(-c.child.pid, "SIGTERM"); } catch { /* already gone */ }
  }
};

for (const c of children) {
  c.child.on("exit", (code, signal) => {
    c.running = false;
    if (exitCode === null) {
      exitCode = code ?? (signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1);
      if (exitCode !== 0) process.stderr.write(`[${c.name}] exited with code ${exitCode}\n`);
      stopAll();
    }
    if (children.every((x) => !x.running)) process.exit(exitCode);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (exitCode === null) exitCode = 0;
    stopAll();
  });
}
