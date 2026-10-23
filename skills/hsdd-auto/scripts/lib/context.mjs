// One snapshot of repository state (spec 10, A-4). Every field is read once; the pure
// functions of the later modules take the snapshot and never touch the repository.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, currentSegment } from "./config.mjs";
import { P, resolveLayout } from "./paths.mjs";
import { loadTree } from "./tree.mjs";
import { checkRegistries } from "./registry.mjs";
import { loadIntakeRecords, segmentRecord } from "./intake.mjs";
import {
  branchExists, changedPaths, changedSince, currentBranch, defaultBranch as defaultBranchOf, headSha, listTree, revExists, showFile,
} from "./git.mjs";
import { committedJsonl, listDispatches, readDispatch, readJsonl } from "./records.mjs";

const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const memoize = (fn) => {
  let done = false;
  let value;
  return () => {
    if (!done) { value = fn(); done = true; }
    return value;
  };
};

const memoizeBy = (fn) => {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key);
  };
};

const readDispatchSafe = (repoRoot, step) => {
  try {
    const { front, body, readCheck } = readDispatch(repoRoot, step);
    return { front, body, readCheck, error: null };
  } catch (e) {
    return { front: null, body: "", readCheck: null, error: e.message };
  }
};

// Phase ids with `{verify}/{phase-id}.verification.md` on the default branch (12.4); empty when the branch is missing.
const verifiedPhasesOf = (repoRoot, layout, branch) => {
  const rev = branchExists(repoRoot, branch) ? branch : revExists(repoRoot, `origin/${branch}`) ? `origin/${branch}` : null;
  if (rev === null) return new Set();
  return new Set(listTree(repoRoot, rev, layout.verify)
    .flatMap((p) => /([^/]+)\.verification\.md$/.exec(p)?.[1] ?? []));
};

// `registry` is the C0 and C1 check, injected as (repoRoot, layout) => RegistryResult (tests replace
// it); it runs at most once, and only when a caller asks.
export const loadContext = (repoRoot, { registry = checkRegistries } = {}) => {
  const config = loadConfig(repoRoot);
  const layout = resolveLayout(repoRoot);
  const tree = loadTree(repoRoot, layout, { root: config.root });
  const runLines = readJsonl(repoRoot, P.runLog);
  const committedRunLines = committedJsonl(repoRoot, P.runLog);
  const committed = new Set(committedRunLines.map((l) => l.step_ref));
  const steps = listDispatches(repoRoot);
  const dispatches = new Map(steps.map((s) => [s, readDispatchSafe(repoRoot, s)]));
  const inProgress = steps.filter((s) => !committed.has(s)).at(-1) ?? null;
  const segment = currentSegment(config);
  const records = loadIntakeRecords(repoRoot, layout);
  const defaultBranch = defaultBranchOf(repoRoot);

  const setupCommit = memoizeBy((segmentId) =>
    runLines.find((l) => l.segment === segmentId && l.kind === "setup")?.commit ?? null);

  // The named segment and the earlier segments right before it that have no committed `report` run
  // line, earliest first: the stopped and ended segments it continues (5.5, 8.3, 8.11), which its
  // report covers (10.9). A segment opens only after the previous one finished, stopped or ended (8.1).
  const reported = new Set(committedRunLines.filter((l) => l.kind === "report" && l.status === "completed").map((l) => l.segment));
  const segmentChain = (segmentId) => {
    const index = config.segments.findIndex((s) => s.id === segmentId);
    if (index < 0) return [segmentId];
    const before = config.segments.slice(0, index).map((s) => s.id);
    const last = before.findLastIndex((id) => reported.has(id));
    return [...before.slice(last + 1), segmentId];
  };

  // Files that differ between the named segment's own setup commit's parent and the working tree,
  // untracked included.
  const changedSinceSetup = memoizeBy((segmentId) => {
    const commit = setupCommit(segmentId);
    if (commit === null) return new Set();
    return new Set(changedSince(repoRoot, revExists(repoRoot, `${commit}^`) ? `${commit}^` : EMPTY_TREE_SHA));
  });

  return {
    repoRoot,
    config,
    layout,
    tree,
    head: headSha(repoRoot),
    branch: currentBranch(repoRoot),
    segment,
    segments: config.segments,
    stopExists: existsSync(join(repoRoot, P.stop)),
    stopCommitted: showFile(repoRoot, "HEAD", P.stop) !== null,
    runLines,
    committedRunLines,
    decisions: readJsonl(repoRoot, P.ledger),
    queueLines: readJsonl(repoRoot, P.queue),
    handoffLines: readJsonl(repoRoot, P.handoffs),
    // Skip lines in HEAD: an uncommitted one is a crash after the append (10.7), still pending.
    committedHandoffLines: committedJsonl(repoRoot, P.handoffs),
    dispatches,
    inProgress,
    intake: {
      records,
      record: segment?.mode === "intake" ? segmentRecord(records, segment.request) : null,
    },
    verifiedPhases: verifiedPhasesOf(repoRoot, layout, defaultBranch),
    defaultBranch,
    setupCommit,
    segmentChain,
    changedSinceSetup,
    // The final scope (10.6, final review A1): files changed since the first setup commit of the
    // segment's chain, so a stopped step's partial artifacts, whose own gate skipped the C checks, are
    // in scope in the segment that continues it. The done definition and the final gate both read it.
    changedInSegment: memoizeBy((segmentId) => {
      const first = segmentChain(segmentId).find((id) => setupCommit(id) !== null);
      return first === undefined ? new Set() : changedSinceSetup(first);
    }),
    registry: memoize(() => registry(repoRoot, layout)),
    // Paths with uncommitted changes in the working tree, untracked included (git status).
    uncommitted: memoize(() => changedPaths(repoRoot)),
  };
};
