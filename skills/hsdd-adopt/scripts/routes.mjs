import { readFileSync } from "node:fs";
import { join } from "node:path";

const JS = /\b(?:app|router|server|fastify|api)\.(get|post|put|patch|delete|options|head|all)\(\s*['"\x60]([^'"\x60]+)['"\x60]/g;
const GO = /\b(?:r|router|e|g|mux|app|http)\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|Handle|HandleFunc)\(\s*"([^"]+)"/g;
const JVM = /@(Get|Post|Put|Patch|Delete|Request)Mapping\(\s*(?:value\s*=\s*)?"([^"]+)"/g;
const PY = /@(?:app|router|api|bp)\.(route|get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
const RB = /^\s*(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/g;
const RB_RES = /^\s*resources\s+:(\w+)/g;
const RS = /\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\(/g;

const anyOf = (m) => (/^(all|handle|handlefunc|request|route)$/i.test(m) ? "ANY" : m.toUpperCase());

// Each rule maps one match to { method, path }.
const BY_EXT = {
  js: [[JS, (m) => ({ method: anyOf(m[1]), path: m[2] })]],
  go: [[GO, (m) => ({ method: anyOf(m[1]), path: m[2] })]],
  java: [[JVM, (m) => ({ method: anyOf(m[1]), path: m[2] })]],
  py: [[PY, (m) => ({ method: anyOf(m[1]), path: m[2] })]],
  rs: [[RS, (m) => ({ method: m[2].toUpperCase(), path: m[1] })]],
};
for (const e of ["mjs", "cjs", "ts", "tsx"]) BY_EXT[e] = BY_EXT.js;
BY_EXT.kt = BY_EXT.java;
const RUBY = [
  [RB, (m) => ({ method: m[1].toUpperCase(), path: m[2] })],
  [RB_RES, (m) => ({ method: "ANY", path: `/${m[1]}` })],
];

function rulesFor(path) {
  const name = path.split("/").pop();
  if (name === "routes.rb") return RUBY;
  const dot = name.lastIndexOf(".");
  return dot < 0 ? null : BY_EXT[name.slice(dot + 1)] ?? null;
}

export function routes(root, files) {
  const out = [];
  for (const file of files) {
    const rules = rulesFor(file);
    if (!rules) continue;
    let text;
    try { text = readFileSync(join(root, file), "utf8"); } catch { continue; }
    text.split("\n").forEach((line, i) => {
      for (const [re, make] of rules) {
        for (const m of line.matchAll(re)) out.push({ ...make(m), file, line: i + 1 });
      }
    });
  }
  return out;
}
