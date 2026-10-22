// Step kinds (spec 7.1), write sets and the never list (7.3), target types,
// stop classes and their "Raised when" text (8.2). The single definition of the 7.3 table (A-8).
import { P } from "./paths.mjs";

const k = (skill, mode, type, orchestrator = false) => ({
  skill, mode, type, orchestrator, template: null,
});

// skill and type "by-file" mean: decided from the target's file (skillFor, decisionTypeFor).
// type "by-target" (spec-touch) means: root-spec for the root node, else mid-level-spec.
const TABLE = {
  setup: k("none", null, "setup", true),
  plan: k("none", null, "plan", true),
  "root-spec": k("hsdd-spec", null, "root-spec"),
  "mid-level-spec": k("hsdd-spec", null, "mid-level-spec"),
  graft: k("hsdd-spec", "graft", "mid-level-spec"),
  promote: k("hsdd-spec", "promotion", "mid-level-spec"),
  "spec-touch": k("hsdd-spec", "touch", "by-target"),
  adr: k("hsdd-adr", null, "adr"),
  "adr-update": k("hsdd-adr", null, "adr"),
  contract: k("hsdd-contract", null, "contract"),
  "contract-touch": k("hsdd-contract", null, "contract"),
  "citation-touch": k("by-file", null, "by-file"),
  "phase-plan": k("hsdd-phase-plan", null, "phase-plan"),
  "phase-plan-append": k("hsdd-phase-plan", "append", "phase-plan"),
  reconcile: k("hsdd-reconcile", null, "reconcile"),
  align: k("hsdd-reconcile", "align", "reconcile"),
  intake: k("hsdd-intake", null, "intake"),
  report: k("none", null, "plan", true),
};

export const KINDS = Object.freeze(Object.fromEntries(
  Object.entries(TABLE).map(([kind, v]) => [kind, Object.freeze({ ...v, template: v.orchestrator ? null : `${kind}.md` })]),
));

const kindsWhere = (pred) => Object.keys(KINDS).filter((x) => pred(KINDS[x], x));
export const ORCHESTRATOR_KINDS = Object.freeze(kindsWhere((v) => v.orchestrator));
export const SUBAGENT_KINDS = Object.freeze(kindsWhere((v) => !v.orchestrator));
export const INSERTABLE_KINDS = Object.freeze(SUBAGENT_KINDS.filter((x) => x !== "intake"));

export const STOPPABLE = Object.freeze(["axis", "shape", "promotion", "breaking-amend", "collision", "external", "gate-twice"]);
export const STOP_CLASSES = Object.freeze([...STOPPABLE, "upstream", "procedural", "judgement"]);

export const RAISED_WHEN = Object.freeze({
  axis: "The decomposition axis is unknown and no owner fact answers it.",
  shape: "The two leading options produce different nodes or a different set of contracts, both are defensible, and no source, owner fact, HSDD rule or experiment gives one a stated reason to lead.",
  promotion: "An as-built node would be promoted.",
  "breaking-amend": "A change the contract's own versioning rules call breaking, to a `stable` contract under `compatibility: versioned`. Under `frozen`, or at `v0`, such a change is a run-stop candidate of this class that no predecided answer covers: a frozen contract takes a new contract and a `v0` one a redesign (`hsdd-contract`'s versioning policy).",
  collision: "Two nodes' entries conflict at reconcile.",
  external: "The run needs something outside the repository: a credential, a private network resource, or global tooling.",
  "gate-twice": "A step failed its gate or its review once more than `rework_limit` allows.",
  upstream: "The right resolution changes a read-only source.",
  procedural: "A skill stops for a missing input another step supplies: an unminted open-question id, a node that still contains subsystems, an ADR cited without a file.",
  judgement: "A choice a careful engineer would put to the owner although no skill stops for it.",
});

// ---------- targets ----------

// A request path's last segment ends in a document extension. The list is closed on
// purpose: a dotted node id that is not in the tree yet (`shop.web.admin`, a graft's
// target) ends in letters too and must stay a node.
const DOC_EXTENSION = /\.(?:md|mdx|markdown|txt|text|pdf|doc|docx|odt|rtf|html|htm|json|yaml|yml|xml|csv|rst|adoc|org|tex)$/i;
const isRequestFile = (target) => DOC_EXTENSION.test(target.slice(target.lastIndexOf("/") + 1));

// tree needs only nodes.has(id) and contracts.has(slug).
export const targetType = (target, tree) => {
  if (/^ADR-\d+$/.test(target)) return "adr";
  if (/^H\d+[a-z]?$/.test(target)) return "handoff";
  if (target === "run") return "run";
  if (target === "all") return "all";
  if (tree.nodes.has(target)) return "node";
  if (tree.contracts.has(target)) return "contract";
  if (isRequestFile(target)) return "request";
  if (target.includes(",")) return "list";
  if (target.includes("/")) return "request";
  return target.includes(".") ? "node" : "contract";
};

const FILE_SKILL = { node: "hsdd-spec", contract: "hsdd-contract", adr: "hsdd-adr" };

const citationSkill = (target, tree) => {
  const skill = FILE_SKILL[targetType(target, tree)];
  if (!skill) throw new Error(`citation-touch target is not a contract, ADR or node: ${target}`);
  return skill;
};

export const skillFor = (kind, target, tree) => {
  const row = KINDS[kind];
  if (!row) throw new Error(`unknown step kind ${kind}`);
  return kind === "citation-touch" ? citationSkill(target, tree) : row.skill;
};

export const decisionTypeFor = (kind, target, tree, root) => {
  const row = KINDS[kind];
  if (!row) throw new Error(`unknown step kind ${kind}`);
  if (kind === "spec-touch") return target === root ? "root-spec" : "mid-level-spec";
  if (kind === "citation-touch") {
    const t = targetType(target, tree);
    if (t === "node") return decisionTypeFor("spec-touch", target, tree, root);
    return citationSkill(target, tree) === "hsdd-adr" ? "adr" : "contract";
  }
  return row.type;
};

// ---------- write sets (7.3) ----------

const dedupe = (xs) => [...new Set(xs)];

export const writeSet = (kind, target, { layout, config, segmentId, record = null, tree }) => {
  const { spec, contract, adr, management } = layout;
  const conventions = P.conventions;
  const registries = [`${contract}/INDEX.md`, `${adr}/INDEX.md`];
  switch (kind) {
    case "root-spec": case "mid-level-spec": case "graft": case "promote": case "spec-touch":
      return [`${spec}/*.md`, conventions];
    case "adr": case "adr-update":
      return [`${adr}/**`, `${spec}/*.md`, `${contract}/*.md`, P.genRegistry];
    case "contract": case "contract-touch":
      return [`${contract}/**`, `${adr}/INDEX.md`, P.genRegistry];
    case "citation-touch": {
      const t = targetType(target, tree);
      const own = t === "adr" ? [`${adr}/${target.slice(4)}-*.md`]
        : t === "contract" ? [`${contract}/${target}.md`, `${contract}/fixture/${target}/**`, `${contract}/schema/${target}.schema.json`]
        : [`${spec}/${target}.md`];
      return dedupe([...own, ...registries]);
    }
    case "phase-plan": case "phase-plan-append":
      return [`${spec}/${target}.md`];
    case "reconcile": case "align":
      return [`${contract}/**`, `${spec}/*.md`, conventions, `${adr}/INDEX.md`];
    case "intake":
      return [`${management}/*-intake-*.md`];
    case "setup":
      return dedupe([
        P.runYaml, P.ownerFiles, P.adapter, `${P.scriptsAuto}/**`, P.genRegistry,
        ".claude/settings.json", ".claude/agents/hsdd-auto-step.md",
        ...(config.orchestrator_files ?? []),
      ]);
    case "plan":
      return [P.plan, P.runYaml, `${P.scriptsAuto}/**`, P.genRegistry];
    case "report": {
      const segment = target ?? segmentId;
      const reportDir = (config.report_dir ?? "hsdd/auto/report").replace(/\/+$/, "");
      const intake = /^\d{4}-\d{2}-\d{2}-intake-/.test(segment);
      const rec = record ?? (intake ? `${management}/${segment}.md` : null);
      return dedupe([`${reportDir}/${segment}.md`, ...(rec ? [rec] : [])]);
    }
    default:
      throw new Error(`unknown step kind ${kind}`);
  }
};

const dirForms = (p) => {
  const bare = p.replace(/^\.\//, "");
  if (bare.endsWith("/") || /[*]/.test(bare)) return [bare];
  return [bare, `${bare}/`];
};

const insideRepo = (p) => !p.startsWith("/") && !p.startsWith("~") && !/^\.\.(\/|$)/.test(p);

// 7.3 "Never" for a subagent step, as glob patterns. Git state is not a path and is not listed.
export const neverPatterns = (config, _layout) => [
  "hsdd/judgement/",
  "hsdd/auto/",
  `${P.scriptsAuto}/`,
  ".claude/",
  ...(config.read_only ?? []).flatMap(dirForms),
  ...(config.owner_files ?? []).flatMap(dirForms),
  ...(insideRepo(config.skills_dir ?? "/") ? dirForms(config.skills_dir) : []),
];
