// Phase Context assembly (spec v0.5 §3.3). Pure: model + phase id in,
// engine-neutral markdown artifact out. The CLI never invents content: a
// missing artifact is a hard error naming the skill that owns the fix.

import { parseIdVersion } from "./frontmatter.mjs";
import { extractSection } from "./sections.mjs";
import { findPhase } from "./model.mjs";
import { GRAMMAR_HINT } from "./phase-block.mjs";

export const BEGIN_MARKER = "<!-- hsdd:phase-context:begin -->";
export const END_MARKER = "<!-- hsdd:phase-context:end -->";

// Phase block re-rendered verbatim from the parsed fields, in grammar order.
function renderPhaseBlock(phase) {
  const list = (v) => `[${v.join(", ")}]`;
  const lines = [
    `**Consumes:** ${list(phase.consumes)}`,
    `**Produces:** ${list(phase.produces)}`,
  ];
  if (phase.governed_by.length) lines.push(`**Governed by:** ${list(phase.governed_by)}`);
  lines.push(
    `**Scope:** ${phase.scope}`,
    `**Size estimate:** ${phase.size_estimate}`,
    `**Gate:** ${phase.gate}`,
    `**Verification:** ${phase.verification}`,
    `**Review tier:** ${phase.review_tier}`,
  );
  if (phase.touches.length) lines.push(`**Touches:** ${list(phase.touches)}`);
  lines.push(`**Dependencies:** ${phase.dependencies}`);
  return lines.join("\n");
}

export function buildPhaseContext(model, phaseId) {
  const errors = [];
  const warnings = [];

  const phase = findPhase(model, phaseId);
  if (!phase) {
    const parent = phaseId.replace(/\.\d+$/, "");
    const nodeFile = `${model.conventions.specs_dir}/${parent}.md`;
    const parseErrs = model.phaseErrors.filter((e) => e.error.startsWith(phaseId + ":"));
    if (parseErrs.length) {
      errors.push(...parseErrs.map((e) => `${e.file}: ${e.error}`));
    } else {
      errors.push(
        `unknown phase id '${phaseId}': no matching phase block in ${nodeFile} (${GRAMMAR_HINT})`
      );
    }
    return { ok: false, artifact: null, errors, warnings };
  }

  // Consumed contracts: Interface + Guarantees only.
  const contractSections = [];
  const adrIds = [...phase.governed_by];
  for (const ref of phase.consumes) {
    const { id, version } = parseIdVersion(ref);
    const contract = model.contracts.find((c) => c.id === id);
    if (!contract) {
      errors.push(
        `consumed contract '${ref}' has no file ${model.conventions.contracts_dir}/${id}.md: author it with hsdd-contract`
      );
      continue;
    }
    if (contract.status === "draft") {
      warnings.push(`consumed contract '${ref}' is draft: building against it is at the consumer's own risk`);
    }
    if (version && contract.version !== version) {
      warnings.push(`consumed contract '${ref}' resolves to version ${contract.version} on file`);
    }
    adrIds.push(...contract.governed_by);
    const iface = extractSection(contract.body, "Interface");
    const guarantees = extractSection(contract.body, "Guarantees / invariants");
    const parts = [`### ${contract.id}@${contract.version}`];
    if (iface && iface.trim()) parts.push("#### Interface", iface.trim());
    if (guarantees && guarantees.trim()) parts.push("#### Guarantees / invariants", guarantees.trim());
    contractSections.push(parts.join("\n\n"));
  }

  // Governing ADRs: Decision + Consequences, accepted only.
  const adrSections = [];
  for (const adrId of [...new Set(adrIds)].sort()) {
    const adr = model.adrs.find((a) => a.id === adrId);
    if (!adr) {
      errors.push(
        `referenced ${adrId} has no file under ${model.conventions.adr_dir}/: author it with hsdd-adr (the CLI never invents a decision)`
      );
      continue;
    }
    if (adr.status !== "accepted") {
      warnings.push(
        `${adrId} is '${adr.status}', not 'accepted': excluded from the phase context (a non-accepted decision is never injected as binding)`
      );
      continue;
    }
    const decision = extractSection(adr.body, "Decision");
    const consequences = extractSection(adr.body, "Consequences");
    const title = adr.body.match(/^#\s+(.+)$/m);
    const parts = [`### ${title ? title[1].trim() : adr.id}`];
    if (decision && decision.trim()) parts.push("#### Decision", decision.trim());
    if (consequences && consequences.trim()) parts.push("#### Consequences", consequences.trim());
    adrSections.push(parts.join("\n\n"));
  }

  if (errors.length) return { ok: false, artifact: null, errors, warnings };

  const artifact = [
    `## Current Phase: ${phase.id}: ${phase.name}`,
    "",
    renderPhaseBlock(phase),
    "",
    "## Contracts from Prior Phases / Nodes",
    "",
    contractSections.length ? contractSections.join("\n\n") : "(none consumed)",
    "",
    "## Governing Decisions",
    "",
    adrSections.length ? adrSections.join("\n\n") : "(none)",
  ].join("\n");

  return { ok: true, artifact, errors, warnings };
}

// Replace only the marked region inside config.yaml's context block scalar.
// Rules and project-wide context are untouched by construction.
export function spliceConfig(configText, artifact) {
  const lines = configText.split("\n");
  const beginIdx = lines.findIndex((l) => l.includes(BEGIN_MARKER));
  const endIdx = lines.findIndex((l) => l.includes(END_MARKER));
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    return {
      ok: false,
      text: null,
      error:
        `config.yaml has no usable '${BEGIN_MARKER}' / '${END_MARKER}' marker pair inside the context block: ` +
        "add the markers with hsdd-config (project init owns the config layout)",
    };
  }
  const indent = lines[beginIdx].match(/^\s*/)[0];
  const indented = artifact.split("\n").map((l) => (l ? indent + l : l));
  const next = [...lines.slice(0, beginIdx + 1), ...indented, ...lines.slice(endIdx)];
  return { ok: true, text: next.join("\n"), error: null };
}
