// Pure core of the sweep: which commits are set aside (spec 4.2), which node a
// candidate happened in (spec 4.4), and the "Not candidates" bullets (spec 5.2).
// No git, no filesystem.

const GOVERNANCE_DIRS = ["hsdd/", "hsdd-context/", "openspec/"];
const short = (sha) => sha.slice(0, 7);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byLengthDesc = (ids) => [...ids].sort((a, b) => b.length - a.length);

export const isGovernancePath = (path) => path === "hsdd" || GOVERNANCE_DIRS.some((d) => path.startsWith(d));

const tokensIn = (text, pattern) => [...new Set([...text.matchAll(new RegExp(`(?<![\\w.-])(${pattern})(?![\\w-]|\\.\\d)`, "g"))].map((m) => m[1]))];

export function phaseIdsIn(text, phaseIds) {
  if (phaseIds.length === 0) return [];
  const found = new Set(tokensIn(text, byLengthDesc(phaseIds).map(escapeRe).join("|")));
  return phaseIds.filter((id) => found.has(id));
}

export function unknownIdsIn(text, nodeIds, phaseIds) {
  if (nodeIds.length === 0) return [];
  const known = new Set(phaseIds);
  return tokensIn(text, `(?:${byLengthDesc(nodeIds).map(escapeRe).join("|")})\\.\\d+`).filter((id) => !known.has(id));
}

export const shaTokensIn = (text) => tokensIn(text, "[0-9a-f]{7,40}");

const citingPhases = (sha, scopeShas) => [...new Set(scopeShas.filter((s) => sha.startsWith(s.sha)).map((s) => s.phase))];

export function setAside(commits, tree, classified) {
  const aside = { merges: [], governance: [], attributed: [], classified: [], unknown: [], candidates: [] };
  const byRecord = new Map();
  for (const c of commits) {
    const sha = short(c.sha);
    if (c.parents.length > 1) { aside.merges.push(sha); continue; }
    if (c.paths.length > 0 && c.paths.every(isGovernancePath)) { aside.governance.push(sha); continue; }
    const named = phaseIdsIn(c.message, tree.phaseIds);
    const phases = named.length > 0 ? named : citingPhases(c.sha, tree.scopeShas);
    if (phases.length > 0) { aside.attributed.push({ sha, phases }); continue; }
    if (classified.has(sha)) {
      const filename = classified.get(sha);
      byRecord.set(filename, [...(byRecord.get(filename) ?? []), sha]);
      continue;
    }
    for (const id of unknownIdsIn(c.message, tree.nodeIds, tree.phaseIds)) aside.unknown.push({ sha, id });
    aside.candidates.push(c);
  }
  aside.classified = [...byRecord].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([filename, shas]) => ({ filename, shas }));
  return aside;
}

const list = (n, shas) => `${n} (${shas.join(", ")})`;

export function asideLines(a) {
  return [
    `- merges: ${a.merges.length ? list(a.merges.length, a.merges) : "none"}`,
    `- governance-only: ${a.governance.length ? list(a.governance.length, a.governance) : "none"}`,
    `- attributed: ${a.attributed.length ? a.attributed.map((x) => `${x.sha} -> ${x.phases.join(", ")}`).join("; ") : "none"}`,
    a.classified.length
      ? `- classified by ${a.classified.map((g) => `${g.filename}: ${g.shas.join(", ")}`).join("; ")}`
      : "- classified by: none",
    `- unknown phase id: ${a.unknown.length ? a.unknown.map((u) => `${u.sha} names ${u.id}`).join("; ") : "none"}`,
  ];
}

const covers = (prefix, path) => prefix === "./" || prefix === "." || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) || path === prefix;

export function place(commit, tree) {
  const paths = commit.paths.filter((p) => !isGovernancePath(p));
  const owns = (scope, p) => scope.prefixes.some((x) => covers(x, p));
  const some = tree.scopes.filter((s) => paths.some((p) => owns(s, p))).map((s) => s.node);
  const all = tree.scopes.filter((s) => paths.length > 0 && paths.every((p) => owns(s, p))).map((s) => s.node);
  if (all.length === 0 && some.length >= 2) return { node: null, spans: [...new Set(some)].sort() };
  const hint = /^HSDD-Node:\s*(\S+)\s*$/m.exec(commit.message)?.[1];
  const hinted = hint !== undefined && tree.nodes.has(hint) && tree.nodes.get(hint).status !== "retired";
  if (hinted) return { node: hint, spans: [] };
  return { node: all.length === 1 ? all[0] : null, spans: [] };
}
