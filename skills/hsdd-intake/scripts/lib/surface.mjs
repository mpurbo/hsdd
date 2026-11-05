// The sweep's surface test (spec 4.3): does a commit move a route, topic,
// table, migration, schema or contract. Compares keys, never file or line.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { routes } from "../routes.mjs";
import { topics } from "../topics.mjs";
import { migrations } from "../migrations.mjs";
import { schemas } from "../schemas.mjs";
import { excludedPath } from "../walk.mjs";
import { showAt } from "./git.mjs";

export function surfaceOf(dir, files) {
  const t = topics(dir, files);
  const m = migrations(dir, files);
  return {
    routes: new Set(routes(dir, files).map((r) => `${r.method} ${r.path}`)),
    topics: new Set([...t.produces.map((x) => `produces ${x.topic}`), ...t.consumes.map((x) => `consumes ${x.topic}`)]),
    tables: new Set(m.tables),
    migrations: new Set(m.files),
    schemas: new Set(schemas(files).map((s) => s.path)),
  };
}

const diffKeys = (noun, before, after) =>
  [...new Set([...before, ...after])].sort().flatMap((k) =>
    after.has(k) && !before.has(k) ? [`${noun} added ${k}`] : before.has(k) && !after.has(k) ? [`${noun} removed ${k}`] : []);

const diffFiles = (noun, before, after, changed) =>
  [...new Set([...before, ...after])].sort().flatMap((k) =>
    !before.has(k) ? [`${noun} added ${k}`] : !after.has(k) ? [`${noun} removed ${k}`] : changed.has(k) ? [`${noun} changed ${k}`] : []);

export function surfaceMoves(before, after, changed) {
  const ch = new Set(changed);
  return [
    ...diffKeys("route", before.routes, after.routes),
    ...diffKeys("topic", before.topics, after.topics),
    ...diffKeys("table", before.tables, after.tables),
    ...diffFiles("migration", before.migrations, after.migrations, ch),
    ...diffFiles("schema", before.schemas, after.schemas, ch),
    ...[...ch].filter((p) => p.startsWith("hsdd/contract/")).sort().map((p) => `contract changed ${p}`),
  ];
}

export function commitMoves(root, commit, { tmp = tmpdir() } = {}) {
  const dir = mkdtempSync(join(tmp, "hsdd-sweep-"));
  try {
    const paths = commit.paths.filter((p) => !excludedPath(p));
    const materialize = (name, sha) => {
      const base = join(dir, name);
      mkdirSync(base);
      if (!sha) return surfaceOf(base, []);
      const written = paths.filter((p) => {
        const blob = showAt(root, sha, p);
        if (!blob) return false;
        mkdirSync(dirname(join(base, p)), { recursive: true });
        writeFileSync(join(base, p), blob);
        return true;
      });
      return surfaceOf(base, written);
    };
    return surfaceMoves(materialize("before", commit.parents[0]), materialize("after", commit.sha), commit.paths);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
