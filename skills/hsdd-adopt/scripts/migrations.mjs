import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIRS = new Set(["migrations", "migrate", "flyway"]);

function isMigration(path) {
  const segs = path.split("/");
  const dirs = segs.slice(0, -1);
  if (dirs.some((d) => DIRS.has(d))) return true;
  const alembic = dirs.indexOf("alembic");
  if (alembic >= 0 && dirs.slice(alembic + 1).includes("versions")) return true;
  return /^V\d+__.*\.sql$/.test(segs[segs.length - 1]);
}

export function migrations(root, files) {
  const found = files.filter(isMigration).sort();
  const tables = new Set();
  for (const file of found) {
    let text;
    try { text = readFileSync(join(root, file), "utf8"); } catch { continue; }
    for (const m of text.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?[\x60"]?(\w+)/gi)) tables.add(m[1]);
  }
  return { files: found, tables: [...tables].sort() };
}
