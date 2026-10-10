import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const CLI = new URL("../skills/hsdd-adopt/scripts/extract-seams.mjs", import.meta.url).pathname;
const run = (cwd, ...args) => {
  try { return { out: execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: e.stdout + e.stderr, code: e.status }; }
};
const git = (dir, ...args) => execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

// A committed scratch repository built from { path: content }.
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-roundtrip-"));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "import");
  return { dir, sha: git(dir, "rev-parse", "--short", "HEAD") };
}

// Render through the CLI into a node spec kept outside the repository, then
// diff that spec through the CLI.
function roundTrip(dir, ...prefixArgs) {
  const r = run(dir, "render", ...prefixArgs);
  assert.equal(r.code, 0, r.out);
  const spec = join(mkdtempSync(join(tmpdir(), "hsdd-roundtrip-spec-")), "node.md");
  writeFileSync(spec, "# x.node: Node\n\n- **Kind:** leaf-parent\n- **Adopted:** as-built\n\n" + r.out + "\n## Next\n");
  return { rendered: r.out, spec, diff: run(dir, "diff", spec) };
}
const modulesLine = (md) => md.split("\n").find((l) => l.startsWith("- modules:"));

test("round trip: a deep prefix records itself and diffs clean", () => {
  const { dir } = repo({
    "pom.xml": "<project/>\n",
    "src/main/java/com/acme/payouts/PayoutController.java": "class P {\n  @GetMapping(\"/v1/payouts\")\n  void list() {}\n}\n",
    "src/main/java/com/acme/billing/InvoiceController.java": "class I {\n  @GetMapping(\"/v1/invoices\")\n  void list() {}\n  @PostMapping(\"/v1/invoices\")\n  void make() {}\n}\n",
    "CODEOWNERS": "/src/main/java/com/acme/payouts/ @payments\n/src/main/java/com/acme/billing/ @billing\n",
  });
  const { rendered, diff } = roundTrip(dir, "--prefix", "src/main/java/com/acme/payouts");
  assert.equal(modulesLine(rendered), "- modules: src/main/java/com/acme/payouts/");
  assert.match(rendered, /- routes: 1  \(GET \/v1\/payouts\)/);
  assert.match(rendered, /- owners: @payments\n/);
  assert.deepEqual(diff, { out: "nothing changed\n", code: 0 });
});

test("round trip: a top directory outside the module roots diffs clean", () => {
  const { dir } = repo({
    "backend/payouts/server.js": "app.get('/v1/payouts', list);\n",
    "backend/billing/server.js": "app.get('/v1/invoices', list);\napp.post('/v1/invoices', make);\n",
    "CODEOWNERS": "/backend/payouts/ @payments\n/backend/billing/ @billing\n",
  });
  const { rendered, diff } = roundTrip(dir, "--prefix", "./backend/payouts/");
  assert.equal(modulesLine(rendered), "- modules: backend/payouts/");
  assert.deepEqual(diff, { out: "nothing changed\n", code: 0 });
});

test("round trip: an unprefixed render records ./ and keeps root-level routes", () => {
  const { dir } = repo({
    "app.js": "app.get('/health', ok);\n",
    "handlers/payouts.js": "router.get('/v1/payouts', list);\nrouter.post('/v1/payouts', make);\n",
  });
  const { rendered, diff } = roundTrip(dir);
  assert.equal(modulesLine(rendered), "- modules: ./");
  assert.match(rendered, /- routes: 3 /);
  assert.deepEqual(diff, { out: "nothing changed\n", code: 0 });
});

test("round trip: a prefix with no file left is removed; real drift still shows", () => {
  const { dir } = repo({
    "backend/payouts/server.js": "app.get('/v1/payouts', list);\n",
    "jobs/settle/run.js": "app.post('/v1/settle', run);\n",
  });
  const { rendered, spec } = roundTrip(dir, "--prefix", "jobs/settle", "--prefix", "backend/payouts");
  assert.equal(modulesLine(rendered), "- modules: backend/payouts/, jobs/settle/");
  git(dir, "rm", "-q", "jobs/settle/run.js");
  git(dir, "commit", "-qm", "drop the settle job");
  assert.deepEqual(run(dir, "diff", spec), { out: "modules removed jobs/settle/\nroutes.count changed 2 -> 1\n", code: 0 });
});

test("render --model with --prefix is an error, exit 2, one line", () => {
  const { dir } = repo({ "src/a/x.js": "app.get('/a', h);\n" });
  assert.equal(run(dir, "extract", "-o", "seams.json").code, 0);
  const r = run(dir, "render", "--model", "seams.json", "--prefix", "src/a");
  assert.equal(r.code, 2);
  assert.equal(r.out.trim().split("\n").length, 1);
  assert.match(r.out, /--prefix/);
});

test("CODEOWNERS comes from the git top level, .github first, matched from there", () => {
  const { dir } = repo({
    ".github/CODEOWNERS": "/services/payouts/ @payments\n",
    "CODEOWNERS": "* @root-file-loses\n",
    "services/payouts/server.js": "app.get('/v1/payouts', list);\n",
    "services/billing/server.js": "app.get('/v1/invoices', list);\n",
  });
  const r = run(join(dir, "services/payouts"), "render");
  assert.match(r.out, /- owners: @payments\n/);
  assert.match(run(dir, "render", "--root", "services/payouts").out, /- owners: @payments\n/);
  assert.match(run(dir, "render", "--prefix", "services/billing").out, /- owners: none found\n/);
});

test("the extraction stamp says -dirty when the scope has uncommitted changes", () => {
  const { dir, sha } = repo({
    "src/payouts/server.js": "app.get('/v1/payouts', list);\n",
    "src/billing/server.js": "app.get('/v1/invoices', list);\n",
  });
  const stamp = (...args) => run(dir, "render", ...args).out.split("\n").find((l) => l.startsWith("- extracted:"));
  mkdirSync(join(dir, "hsdd/scripts/seams"), { recursive: true });
  writeFileSync(join(dir, "hsdd/scripts/seams/x.mjs"), "// governance, untracked\n");
  assert.match(stamp(), new RegExp(`@ ${sha}  \\(`));
  writeFileSync(join(dir, "src/payouts/new.js"), "app.post('/v1/payouts', make);\n");
  assert.match(stamp("--prefix", "src/payouts"), new RegExp(`@ ${sha}-dirty  \\(`));
  assert.match(stamp("--prefix", "src/billing"), new RegExp(`@ ${sha}  \\(`));
  assert.match(stamp(), new RegExp(`@ ${sha}-dirty  \\(`));
});
