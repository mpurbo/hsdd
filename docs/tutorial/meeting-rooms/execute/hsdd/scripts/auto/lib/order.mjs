// Producer-first ordering (spec 9.1) as pure functions of a parsed tree (lib/tree.mjs): node A
// precedes B when B consumes a contract A produces; contract X precedes Y when Y's producing node
// consumes X. Kahn's algorithm with the mention-order tie rule; what is left is the cycle.
import { phaseNodeOf } from "./tree.mjs";

const unique = (xs) => [...new Set(xs)];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// A position in `list`; what is not in it comes after everything that is.
const rankIn = (list) => (x) => { const i = list.indexOf(x); return i < 0 ? list.length : i; };

// A name in a Produces/Consumes field or contract front matter as a node id: the node itself, or a
// phase id's node (the id without its trailing numeric segment); null when the tree has no such node.
const nodeOf = (tree, name) => {
  if (tree.nodes.has(name)) return name;
  const owner = phaseNodeOf(name);
  return owner !== name && tree.nodes.has(owner) ? owner : null;
};

// Who produces and who consumes each contract slug, as sets of node ids: node and phase Produces and
// Consumes fields, and the `owner` and `consumers` of every version file of the contract.
export const contractRoles = (tree) => {
  const fromNodes = [...tree.nodes.values()].flatMap((n) => [
    ...[...n.produces, ...n.phases.flatMap((p) => p.produces)].map((r) => ["produces", r.slug, n.id]),
    ...[...n.consumes, ...n.phases.flatMap((p) => p.consumes)].map((r) => ["consumes", r.slug, n.id]),
  ]);
  const fromContracts = tree.contractFiles.flatMap((c) => [
    ...(c.owner ? [["produces", c.slug, nodeOf(tree, c.owner)]] : []),
    ...c.consumers.map((name) => ["consumes", c.slug, nodeOf(tree, name)]),
  ]);
  const group = (role) => [...fromNodes, ...fromContracts]
    .filter(([r, , node]) => r === role && node !== null)
    .reduce((m, [, slug, node]) => m.set(slug, new Set([...(m.get(slug) ?? []), node])), new Map());
  return { producers: group("produces"), consumers: group("consumes") };
};

// Every item reachable from `start` along `succ`, `start` excluded unless a cycle returns to it.
const reachable = (succ, start) => {
  const seen = new Set();
  const visit = (x) => succ(x).forEach((y) => { if (!seen.has(y)) { seen.add(y); visit(y); } });
  visit(start);
  return seen;
};

// Kahn's algorithm over `items` with `before(a, b)` (a must come first) and the tie order `rank`:
// the lowest-ranked ready item goes next. Items left when none is ready are the cycle.
const kahn = (items, before, rank) => {
  const go = (remaining, order) => {
    const ready = remaining.filter((b) => !remaining.some((a) => a !== b && before(a, b)));
    if (ready.length === 0) return { order, cycle: remaining };
    return go(remaining.filter((x) => x !== ready[0]), [...order, ready[0]]);
  };
  return go(unique(items).sort((a, b) => rank(a) - rank(b) || cmp(a, b)), []);
};

// Ties keep first mention in the root spec, then in the parent specs (tree.mentionOrder); the root
// comes first; nodes never mentioned last.
const nodeRank = (tree) => rankIn([tree.root, ...tree.mentionOrder]);

// Citations ({ file, ... }) in the order of their file in `files` (citations elsewhere dropped), then
// text order; each key once, at its first citation.
export const firstCited = (cites, files, key) => {
  const rank = rankIn(files);
  const sorted = cites
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => files.includes(c.file))
    .sort((a, b) => rank(a.c.file) - rank(b.c.file) || a.i - b.i)
    .map(({ c }) => c);
  return sorted.filter((c, i) => sorted.findIndex((d) => key(d) === key(c)) === i);
};

// Node A precedes node B when B consumes a contract A produces, directly or through other nodes, so
// an order over some candidates honours links through nodes that are not candidates.
export const producerOrder = (tree, nodeIds) => {
  const { producers, consumers } = contractRoles(tree);
  const succ = (a) => unique([...producers].flatMap(([slug, ps]) => (ps.has(a) ? [...(consumers.get(slug) ?? [])] : [])))
    .filter((b) => b !== a);
  const reach = new Map(unique(nodeIds).map((id) => [id, reachable(succ, id)]));
  return kahn(nodeIds, (a, b) => reach.get(a).has(b), nodeRank(tree));
};

export const nodeFiles = (tree, ids) => ids.map((id) => tree.nodes.get(id)?.file);

// The spec files in the root spec's order: the root's first, then in first-mention order (tree.mentionOrder),
// then any other spec file. dispatch.mjs's `{proposing_spec}` and the adr facts both read it.
export const specFilesInOrder = (tree) => unique([...nodeFiles(tree, [tree.root, ...tree.mentionOrder]), ...tree.specFiles.map((f) => f.file)].filter(Boolean));

// Contract slugs in order of first mention in the specs: the root's, then tree.mentionOrder's.
const contractRank = (tree) => {
  const files = nodeFiles(tree, [tree.root, ...tree.mentionOrder]).filter(Boolean);
  return rankIn(firstCited(tree.contractCites, files, (c) => c.slug).map((c) => c.slug));
};

// Contract X precedes contract Y when Y's producing node consumes X, directly or through other contracts.
export const contractOrder = (tree, slugs) => {
  const { producers, consumers } = contractRoles(tree);
  const consumedBy = (node) => [...consumers].flatMap(([slug, cs]) => (cs.has(node) ? [slug] : []));
  const succ = (x) => unique([...producers].flatMap(([y, ps]) => ([...ps].some((p) => consumedBy(p).includes(x)) ? [y] : [])))
    .filter((y) => y !== x);
  const reach = new Map(unique(slugs).map((s) => [s, reachable(succ, s)]));
  return kahn(slugs, (a, b) => reach.get(a).has(b), contractRank(tree));
};

// An order's items with the cycle, when there is one, appended in tie order.
export const ordered = ({ order, cycle }) => [...order, ...cycle];
