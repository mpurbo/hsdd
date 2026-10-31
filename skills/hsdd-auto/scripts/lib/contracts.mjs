// Contract versions (v0.10.0 §3.1 and §3.5, as of 0.10.2): one file per version, found by its
// front-matter `id` and `version`, never by its file name. Pure functions of lib/tree.mjs's contract
// index: `tree.contracts` maps an id to its current version's file record (the highest `v{n}`) with
// `versions`, every file of the id, lowest version first; `tree.contractFiles` lists every file.
// A record without `versions` (a hand-built tree) stands for an id with that one file.

export const versionNumber = (v) => Number(/^v(\d+)$/.exec(v ?? "")?.[1] ?? NaN);

export const versionsOf = (entry) => entry?.versions ?? (entry ? [entry] : []);

// The file of a contract id at a version, or null.
export const contractAt = (tree, id, version) => versionsOf(tree.contracts.get(id)).find((c) => c.version === version) ?? null;

// `{id}.v{n}`, a later version's file name without `.md`.
const VERSION_NAME = /^([a-z0-9][a-z0-9-]*)\.v(\d+)$/;
export const versionName = (name) => {
  const m = VERSION_NAME.exec(name);
  return m ? { id: m[1], version: `v${Number(m[2])}` } : null;
};

// The file a citation `{id}@{version}` resolves to: that version's file; for a version below the current
// one that no file holds, the current file, where it is history (a bump in place, before 0.10.2); the
// current file when `version` is null. Null when the tree has no such id, or the version is later than
// any file holds.
export const refFile = (tree, id, version = null) => {
  const entry = tree.contracts.get(id);
  if (!entry) return null;
  if (version === null) return entry;
  return contractAt(tree, id, version) ?? (versionNumber(version) < versionNumber(entry.version) ? entry : null);
};

// `{name}@v{n}` as { name, version }; version null without the suffix.
export const splitRef = (ref) => {
  const m = /^(.*)@(v\d+)$/.exec(ref);
  return m ? { name: m[1], version: m[2] } : { name: ref, version: null };
};

// A target that names a contract: its id, or `{id}.v{n}` for one version of it. { id, version }, the
// version null for the id; null when the target names no contract id the tree has.
export const contractTarget = (tree, target) => {
  if (tree.contracts.has(target)) return { id: target, version: null };
  const v = versionName(target);
  return v !== null && tree.contracts.has(v.id) ? v : null;
};

// The files a contract target resolves to: every version's for an id, the one version's for
// `{id}.v{n}` (none when that version has no file yet).
export const targetVersions = (tree, target) => {
  const t = contractTarget(tree, target);
  if (t === null) return [];
  const all = versionsOf(tree.contracts.get(t.id));
  return t.version === null ? all : all.filter((c) => c.version === t.version);
};

const RETIRING = new Set(["deprecated", "retired"]);

// The versions of an id below its current one: [{ version, file, superseded }], lowest first. A version
// with a file of its own is superseded only when that file is `deprecated` or `retired`: a `coexisting`
// version stays live while it is `stable` (v0.10.0 §3.5). A version with no file of its own lives only
// as history in a later file (the bump in place before 0.10.2) and is superseded.
export const lowerVersions = (entry) => {
  const n = versionNumber(entry?.version);
  if (!(n > 0)) return [];
  return Array.from({ length: n }, (_, k) => {
    const file = versionsOf(entry).find((c) => versionNumber(c.version) === k) ?? null;
    return { version: `v${k}`, file, superseded: file === null || RETIRING.has(file.status) };
  });
};

export const supersededVersions = (entry) => lowerVersions(entry).filter((v) => v.superseded);

// Whether `{id}@{version}` names a superseded version of a contract the tree has.
export const isSuperseded = (tree, id, version) => supersededVersions(tree.contracts.get(id)).some((v) => v.version === version);
