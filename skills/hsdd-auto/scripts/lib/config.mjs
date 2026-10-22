// Load, validate and default hsdd/auto/run.yaml (spec 5.1, appendix A.1 code rules).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, YamlError } from "./yaml.mjs";
import { validate } from "./schema.mjs";
import { P } from "./paths.mjs";
import { STOPPABLE } from "./kinds.mjs";

export class ConfigError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "ConfigError";
    this.errors = errors;
  }
}

const SOURCE_KINDS = ["normative", "informative", "baseline"];

// A.1 "checked in code", with S-9: a segment moves a version exactly when sources.baseline is not empty.
const codeRules = (raw) => {
  const errors = [];
  for (const key of Object.keys(raw.predecided ?? {})) {
    if (!STOPPABLE.includes(key)) errors.push(`predecided: '${key}' is not a stop-set class (${STOPPABLE.join(", ")})`);
  }
  const seen = new Set();
  for (const s of raw.segments ?? []) {
    if (seen.has(s.id)) errors.push(`segments: duplicate segment id ${s.id}`);
    seen.add(s.id);
    if (s.mode === "intake") {
      if (s.request === undefined) errors.push(`segments: intake segment ${s.id} has no request`);
      if (s.authority === undefined) errors.push(`segments: intake segment ${s.id} has no authority`);
    }
  }
  if ((raw.sources.baseline ?? []).length > 0) {
    for (const kind of SOURCE_KINDS) {
      for (const src of raw.sources[kind] ?? []) {
        if (src.version === undefined) errors.push(`sources.${kind}: ${src.path} has no version (required when sources.baseline is not empty)`);
      }
    }
  }
  return errors;
};

export const withDefaults = (raw) => ({
  ...raw,
  root: raw.root ?? raw.run,
  owner_facts: raw.owner_facts ?? [],
  preferences: raw.preferences ?? [],
  prose_rules: { banned_chars: [], banned_phrases: [], token_forms: {}, level: "warn", ...(raw.prose_rules ?? {}) },
  sources: { normative: [], informative: [], baseline: [], ...raw.sources },
  out_of_bounds: raw.out_of_bounds ?? [],
  owner_files: raw.owner_files ?? [],
  orchestrator_files: raw.orchestrator_files ?? [],
  toolchain: { commands: {}, rules: [], ...(raw.toolchain ?? {}) },
  experiments_dir: raw.experiments_dir ?? "hsdd/auto/experiments",
  report_dir: raw.report_dir ?? "hsdd/auto/report",
  stop_set: raw.stop_set ?? [...STOPPABLE],
  stop_policy: raw.stop_policy ?? "stop",
  predecided: raw.predecided ?? {},
  commit: { trailers: [], artifact: "hsdd", judgement: "judgement", orchestrator: "auto", ...(raw.commit ?? {}) },
  rework_limit: raw.rework_limit ?? 1,
  dispatch: { wait: "hand-back", fallback_wakeup_minutes: 30, ...(raw.dispatch ?? {}) },
  segments: raw.segments ?? [],
});

export const loadConfig = (repoRoot) => {
  const file = join(repoRoot, P.runYaml);
  if (!existsSync(file)) throw new ConfigError([`${P.runYaml} does not exist`]);
  let raw;
  try {
    raw = parseYaml(readFileSync(file, "utf8"));
  } catch (e) {
    if (e instanceof YamlError) throw new ConfigError([`${P.runYaml}: ${e.message}`]);
    throw e;
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new ConfigError([`${P.runYaml}: expected a mapping at the top level`]);
  const normalized = raw.segments === null ? { ...raw, segments: [] } : raw;
  const schemaErrors = validate("run-config", normalized);
  if (schemaErrors.length > 0) throw new ConfigError(schemaErrors.map((e) => `${P.runYaml}: ${e}`));
  const ruleErrors = codeRules(normalized);
  if (ruleErrors.length > 0) throw new ConfigError(ruleErrors.map((e) => `${P.runYaml}: ${e}`));
  return withDefaults(normalized);
};

export const currentSegment = (config) => config.segments.at(-1) ?? null;
