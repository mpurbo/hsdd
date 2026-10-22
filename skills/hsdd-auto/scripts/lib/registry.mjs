// C0 and C1 of the gate (spec 10.6): the registry generator is present when contracts exist, and
// regenerating the registries from the tree changes nothing. C1 runs the tree's own copy of the
// generator on a temporary copy of the files it reads, so nothing is ever written into the tree.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { P } from "./paths.mjs";

const GENERATOR_TIMEOUT_MS = 30_000;

const finding = (id, level, message, file) => ({ id, level, message, file });

const isFile = (path) => existsSync(path) && statSync(path).isFile();

const contractFiles = (repoRoot, layout) => {
  const dir = join(repoRoot, layout.contract);
  return existsSync(dir) && statSync(dir).isDirectory()
    ? readdirSync(dir).filter((n) => n.endsWith(".md") && n.toUpperCase() !== "INDEX.MD" && isFile(join(dir, n)))
    : [];
};

const readOrNull = (path) => (isFile(path) ? readFileSync(path) : null);

const REGISTRIES = ["contract/INDEX.md", "adr/INDEX.md"];

// Copies the generator and the two directories it reads (without their INDEX.md files, so a stale registry
// cannot survive in the copy) to a fresh directory under `tmpRoot`, runs it there, compares the registries.
const regenerationFindings = (repoRoot, tmpRoot) => {
  const tmp = mkdtempSync(join(tmpRoot, "hsdd-registry-"));
  try {
    for (const sub of ["contract", "adr"]) {
      if (existsSync(join(repoRoot, "hsdd", sub))) cpSync(join(repoRoot, "hsdd", sub), join(tmp, sub), { recursive: true, filter: (src) => basename(src).toUpperCase() !== "INDEX.MD" });
    }
    cpSync(join(repoRoot, P.genRegistry), join(tmp, "scripts", "gen-registry.mjs"));
    const r = spawnSync(process.execPath, [join(tmp, "scripts", "gen-registry.mjs"), "--root", tmp], {
      encoding: "utf8", timeout: GENERATOR_TIMEOUT_MS, cwd: tmp,
    });
    if (r.error || r.status !== 0) {
      const why = r.error ? r.error.message : (r.stderr || r.stdout).trim().split("\n")[0] || `exit ${r.status}`;
      return [finding("C1", "error", `${P.genRegistry} failed on a temporary copy: ${why}`, P.genRegistry)];
    }
    return REGISTRIES.flatMap((rel) => {
      const tree = readOrNull(join(repoRoot, "hsdd", rel));
      const fresh = readOrNull(join(tmp, rel));
      if (tree === null && fresh === null) return [];
      if (tree !== null && fresh !== null && tree.equals(fresh)) return [];
      return [finding("C1", "error", tree === null
        ? `hsdd/${rel} is missing; run ${P.genRegistry} and commit the registry`
        : `hsdd/${rel} is not what ${P.genRegistry} writes from the tree; regenerate and commit it`, `hsdd/${rel}`)];
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

// { c0, c1, skipped }; `skipped` is true when C1 did not run because the layout is relocated (spec 4.2).
export const checkRegistries = (repoRoot, layout, { tmpRoot = tmpdir() } = {}) => {
  const generator = isFile(join(repoRoot, P.genRegistry));
  const c0 = !generator && contractFiles(repoRoot, layout).length > 0
    ? [finding("C0", "error", `contract files exist and ${P.genRegistry} does not; copy it from hsdd-contract`, P.genRegistry)]
    : [];
  if (!generator) return { c0, c1: [], skipped: false };
  if (layout.relocated) {
    return {
      c0,
      c1: [finding("C1", "warn", "C1 skipped: contract/ or adr/ is relocated and the registry generator reads only the default paths", null)],
      skipped: true,
    };
  }
  return { c0, c1: regenerationFindings(repoRoot, tmpRoot), skipped: false };
};
