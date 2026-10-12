import { readFileSync } from "node:fs";
import { join } from "node:path";

const EXTS = new Set(["js", "mjs", "cjs", "ts", "tsx", "go", "java", "kt", "py", "rs"]);
const NAME = /(['"])([a-z0-9_-]+(?:\.[a-z0-9_-]+)+)\1/gi;
// Applied to the text up to and including the opening quote of the topic string.
const PRODUCE = /\b(?:publish|emit|send|produce)\w*\(\s*(?:\{[^}]*topic\s*:\s*)?['"]$/i;
const CONSUME = /\b(?:subscribe|consume|on|listen)\w*\(\s*['"]$/i;

export function topics(root, files) {
  const produces = [];
  const consumes = [];
  for (const file of files) {
    const dot = file.lastIndexOf(".");
    if (dot < 0 || !EXTS.has(file.slice(dot + 1))) continue;
    let text;
    try { text = readFileSync(join(root, file), "utf8"); } catch { continue; }
    text.split("\n").forEach((line, i) => {
      const listener = line.includes("KafkaListener") && line.includes("topics");
      for (const m of line.matchAll(NAME)) {
        const before = line.slice(0, m.index + 1);
        const entry = { topic: m[2], file, line: i + 1 };
        if (PRODUCE.test(before)) produces.push(entry);
        else if (CONSUME.test(before) || listener) consumes.push(entry);
      }
    });
  }
  return { produces, consumes };
}
