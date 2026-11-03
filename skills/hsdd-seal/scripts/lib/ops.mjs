// File operations: computed first, described, then applied only with --write.
// An Op is { kind: "write"|"delete"|"rename", path, content?, to?, note }.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function describeOps(ops) {
  if (!ops.length) return "nothing to do";
  const width = Math.max(...ops.map((o) => o.path.length));
  return ops.map((o) => `${o.kind.padEnd(6)} ${o.path.padEnd(width)}  ${o.kind === "rename" ? `-> ${o.to}  ` : ""}${o.note ?? ""}`.trimEnd()).join("\n");
}

export function applyOps(root, ops, { write = false } = {}) {
  const applied = [];
  const skipped = [];
  const lines = [];
  for (const op of ops) {
    const full = join(root, op.path);
    if (op.kind === "write") {
      if (existsSync(full) && readFileSync(full, "utf8") === op.content) {
        skipped.push(op.path);
        lines.push(`skip   ${op.path}  (already as planned)`);
        continue;
      }
      if (write) {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, op.content);
      }
    } else if (op.kind === "delete") {
      if (!existsSync(full)) {
        skipped.push(op.path);
        lines.push(`skip   ${op.path}  (absent)`);
        continue;
      }
      if (write) rmSync(full, { recursive: true, force: true });
    } else if (op.kind === "rename") {
      if (!existsSync(full)) {
        skipped.push(op.path);
        lines.push(`skip   ${op.path}  (absent)`);
        continue;
      }
      if (write) {
        mkdirSync(dirname(join(root, op.to)), { recursive: true });
        renameSync(full, join(root, op.to));
      }
    } else {
      throw new Error(`unknown op kind ${op.kind}`);
    }
    if (write) applied.push(op.path);
    lines.push(`${write ? "done" : "plan"}   ${op.kind} ${op.path}${op.kind === "rename" ? ` -> ${op.to}` : ""}`);
  }
  return { applied, skipped, lines };
}
