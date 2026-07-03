// Referential-integrity lint (spec v0.5 §3.4) plus the multi-team profile
// rules (§13). Pure: model in, findings out. Checks shape and references,
// never meaning.

import { parseIdVersion } from "./frontmatter.mjs";
import { extractSection } from "./sections.mjs";
import { allPhases } from "./model.mjs";
import { projectContracts, projectAdrs, deriveOwner, deriveConsumers } from "./registry.mjs";

export function lint(model, { strict = false, profile = null } = {}) {
  const effectiveProfile = profile || model.conventions.profile;
  const errors = [];
  const warnings = [];
  const err = (check, msg) => errors.push({ check, msg });
  const warn = (check, msg) => warnings.push({ check, msg });
  // migration findings are warnings by default, errors under --strict
  const migration = (check, msg) => (strict ? err(check, msg) : warn(check, msg));

  const phases = allPhases(model);
  const nodesById = new Map(model.nodes.map((n) => [n.id, n]));
  const phasesById = new Map(phases.map((p) => [p.id, p]));
  const contractsById = new Map(model.contracts.map((c) => [c.id, c]));
  const adrsById = new Map();
  for (const a of model.adrs) {
    if (adrsById.has(a.id)) err(5, `duplicate ADR id '${a.id}' (${a.file} and ${adrsById.get(a.id).file})`);
    else adrsById.set(a.id, a);
  }

  const teamOf = (artifactId) => {
    const node = nodesById.get(artifactId);
    if (node) return node.team;
    const phase = phasesById.get(artifactId);
    if (phase) return phase.nodeRef.team;
    return null;
  };

  // ---- check 1: consumes/produces resolve to a contract file with matching version
  const checkRefs = (refs, where) => {
    for (const ref of refs) {
      const { id, version } = parseIdVersion(ref);
      const contract = contractsById.get(id);
      if (!contract) {
        err(1, `${where} references '${ref}' but ${model.conventions.contracts_dir}/${id}.md does not exist`);
      } else if (version && contract.version !== version) {
        err(1, `${where} references '${ref}' but the contract file is version ${contract.version}`);
      }
    }
  };
  for (const n of model.nodes) {
    checkRefs(n.consumes, `${n.file} (consumes)`);
    checkRefs(n.produces, `${n.file} (produces)`);
  }
  for (const p of phases) {
    checkRefs(p.consumes, `phase ${p.id} (Consumes)`);
    checkRefs(p.produces, `phase ${p.id} (Produces)`);
  }

  // ---- check 2: owner exists and produces the contract; single producer
  const producesContract = (node, contractId) =>
    node.produces.some((r) => parseIdVersion(r).id === contractId) ||
    node.phases.some((p) => p.produces.some((r) => parseIdVersion(r).id === contractId));
  for (const c of model.contracts) {
    if (!c.owner) { err(2, `${c.file}: contract '${c.id}' has no owner`); continue; }
    const ownerNode = nodesById.get(c.owner);
    if (!ownerNode) {
      err(2, `${c.file}: owner '${c.owner}' is not a known node`);
    } else if (!producesContract(ownerNode, c.id)) {
      err(2, `${c.file}: owner '${c.owner}' does not list '${c.id}' under produces`);
    }
    const producers = model.nodes.filter((n) => producesContract(n, c.id)).map((n) => n.id);
    if (producers.length > 1) {
      err(2, `contract '${c.id}' is produced by more than one node: ${producers.join(", ")}`);
    }
  }

  // ---- check 3: governed_by resolves to an ADR file
  const checkAdrRefs = (adrIds, where) => {
    for (const adrId of adrIds) {
      if (!adrsById.has(adrId)) {
        err(3, `${where} lists '${adrId}' but no such ADR exists under ${model.conventions.adr_dir}/`);
      }
    }
  };
  for (const n of model.nodes) checkAdrRefs(n.governed_by, n.file);
  for (const p of phases) checkAdrRefs(p.governed_by, `phase ${p.id}`);
  for (const c of model.contracts) checkAdrRefs(c.governed_by, c.file);

  // ---- check 4: affects <-> governed_by bidirectional match
  const isAncestorGoverned = (phase, adrId) =>
    phase.governed_by.includes(adrId) || phase.nodeRef.governed_by.includes(adrId);
  for (const a of model.adrs) {
    for (const entry of a.affects) {
      const { id } = parseIdVersion(entry);
      const node = nodesById.get(id);
      const phase = phasesById.get(id);
      const contract = contractsById.get(id);
      if (node) {
        if (!node.governed_by.includes(a.id)) {
          err(4, `${a.id} affects '${id}' but ${node.file} carries no matching 'Governed by' (governed_by)`);
        }
      } else if (phase) {
        if (!isAncestorGoverned(phase, a.id)) {
          err(4, `${a.id} affects '${id}' but the phase carries no matching 'Governed by' (governed_by)`);
        }
      } else if (contract) {
        if (!contract.governed_by.includes(a.id)) {
          err(4, `${a.id} affects '${entry}' but ${contract.file} carries no matching 'Governed by' (governed_by)`);
        }
      } else {
        warn(4, `${a.id} affects '${entry}' which does not exist yet (forward reference)`);
      }
    }
  }
  // reverse direction: a governed_by must appear in the ADR's affects
  const affectsCovers = (adr, artifactId) => {
    if (!adr) return true; // missing ADR already reported by check 3
    const ids = adr.affects.map((e) => parseIdVersion(e).id);
    return ids.some((id) => artifactId === id || artifactId.startsWith(id + "."));
  };
  for (const n of model.nodes) {
    for (const adrId of n.governed_by) {
      if (adrsById.has(adrId) && !affectsCovers(adrsById.get(adrId), n.id)) {
        err(4, `${n.file} lists 'Governed by: ${adrId}' but ${adrId} does not list '${n.id}' in affects`);
      }
    }
  }
  for (const p of phases) {
    for (const adrId of p.governed_by) {
      if (adrsById.has(adrId) && !affectsCovers(adrsById.get(adrId), p.id)) {
        err(4, `phase ${p.id} lists 'Governed by: ${adrId}' but ${adrId} does not cover it in affects`);
      }
    }
  }
  for (const c of model.contracts) {
    for (const adrId of c.governed_by) {
      const adr = adrsById.get(adrId);
      if (adr && !adr.affects.some((e) => parseIdVersion(e).id === c.id)) {
        err(4, `${c.file} lists 'governed_by: ${adrId}' but ${adrId} does not list '${c.id}' in affects`);
      }
    }
  }

  // ---- check 5: ADR ids zero-padded, unique (above), matching filenames
  for (const a of model.adrs) {
    const m = a.id.match(/^ADR-(\d{3})$/);
    if (!m) {
      err(5, `${a.file}: ADR id '${a.id}' must match ADR-NNN with a zero-padded three-digit number`);
      continue;
    }
    const base = a.file.split("/").pop();
    if (!base.startsWith(`${m[1]}-`)) {
      err(5, `${a.file}: filename must start with '${m[1]}-' to match id '${a.id}'`);
    }
  }

  // ---- check 6: stable contracts carry executable validation artifacts
  for (const c of model.contracts) {
    if (c.status !== "stable") continue;
    if (!c.schema && !c.fixtures) {
      err(6, `${c.file}: stable contract '${c.id}' has neither schema nor fixtures (a stable contract must be machine-checkable)`);
    }
    if (c.schema && c.schemaExists === false) {
      err(6, `${c.file}: schema path '${c.schema}' does not exist`);
    }
    if (c.fixtures && c.fixturesExists === false) {
      err(6, `${c.file}: fixtures path '${c.fixtures}' does not exist`);
    }
  }

  // ---- check 7: phase consuming a draft contract
  for (const p of phases) {
    for (const ref of p.consumes) {
      const contract = contractsById.get(parseIdVersion(ref).id);
      if (contract && contract.status === "draft") {
        warn(7, `phase ${p.id} consumes '${ref}' which is still draft`);
      }
    }
  }

  // ---- check 8: phase blocks parse; numbering sequential per leaf-parent
  for (const e of model.phaseErrors) err(8, `${e.file}: ${e.error}`);
  for (const n of model.nodes.filter((x) => x.kind === "leaf-parent")) {
    const ns = n.phases.map((p) => p.n).sort((a, b) => a - b);
    const expected = ns.map((_, i) => i + 1);
    if (JSON.stringify(ns) !== JSON.stringify(expected)) {
      err(8, `${n.file}: phase numbers are not sequential from 1 (found: ${ns.join(", ")})`);
    }
  }

  // ---- check 9: active changes with a Phase: line reference existing phases
  for (const c of model.changes.filter((x) => !x.archived && x.phaseId)) {
    if (!phasesById.has(c.phaseId)) {
      err(9, `openspec change '${c.name}' references phase '${c.phaseId}' which does not exist`);
    }
  }

  // ---- check 10: derived-state consistency
  for (const v of model.verifications) {
    const linked = model.changes.filter((c) => c.phaseId === v.phaseId);
    if (linked.length === 0) {
      err(10, `${v.file}: verification doc exists but no OpenSpec change for phase '${v.phaseId}' was ever started`);
    } else if (!linked.some((c) => c.archived)) {
      warn(10, `${v.file}: verification doc exists but the change for '${v.phaseId}' is not yet archived (fine for in-progress notes)`);
    }
  }

  // ---- check 11: generated INDEX.md files match a fresh projection
  const diffIndex = (name, current, fresh) => {
    const norm = (s) => (s === null ? null : s.trim());
    if (norm(current) !== norm(fresh)) {
      err(11, `${name} does not match a fresh projection: run 'hsdd registry'`);
    }
  };
  diffIndex(`${model.conventions.contracts_dir}/INDEX.md`, model.contractsIndex, projectContracts(model));
  diffIndex(`${model.conventions.adr_dir}/INDEX.md`, model.adrIndex, projectAdrs(model));

  // ---- check 12: frontmatter everywhere; v0.3-shape migration findings
  for (const f of model.legacyNodes) migration(12, `${f}: node spec has no frontmatter (v0.3 shape); lift the bold fields into frontmatter`);
  for (const f of model.legacyContracts) migration(12, `${f}: contract has no frontmatter (v0.3 shape)`);
  for (const f of model.legacyAdrs) migration(12, `${f}: ADR has no frontmatter (v0.3 shape)`);
  for (const c of model.contracts) {
    for (const field of c.legacyFields) {
      migration(12, `${c.file}: '${field}' is removed in v0.5 (derived by 'hsdd registry'); drop it from the frontmatter`);
    }
  }

  // ---- check 13: undispositioned learnings in verified phases
  for (const v of model.verifications) {
    if (!v.hasGateEvidence) continue; // not yet verified; in-progress notes may accumulate
    const undispositioned = v.learnings.filter((l) => !l.dispositioned);
    if (undispositioned.length > 0) {
      migration(13, `${v.file}: ${undispositioned.length} undispositioned learning(s); every learning needs a disposition before sign-off`);
    } else if (!v.hasLearningsSection) {
      migration(13, `${v.file}: no '## Learnings' section ('no learnings' is a valid entry; silence is not)`);
    }
  }

  // ---- multi-team profile (spec v0.5 §13)
  if (effectiveProfile === "multi-team") {
    for (const n of model.nodes) {
      if (!n.team) err("13.1", `${n.file}: node '${n.id}' has no 'team' in frontmatter (required under the multi-team profile)`);
    }
    // cross-team Touches collision: same glob declared by phases of different teams
    const touchesByGlob = new Map();
    for (const p of phases) {
      for (const g of p.touches) {
        const seen = touchesByGlob.get(g);
        if (seen && seen.team !== p.nodeRef.team) {
          err("13.1", `phases ${seen.id} (team ${seen.team}) and ${p.id} (team ${p.nodeRef.team}) both declare Touches '${g}': a phase may not touch another team's scope`);
        } else if (!seen) {
          touchesByGlob.set(g, { id: p.id, team: p.nodeRef.team });
        }
      }
    }
    // contract bump negotiation: stable requires acks from every cross-team consumer
    for (const c of model.contracts) {
      if (c.status !== "stable") continue;
      const ownerTeam = teamOf(deriveOwner(model, c));
      const consumerTeams = [...new Set(
        deriveConsumers(model, c).map(teamOf).filter((t) => t && t !== ownerTeam)
      )].sort();
      if (consumerTeams.length === 0) continue;
      const versioning = extractSection(c.body, "Versioning") || "";
      const missing = consumerTeams.filter((t) => !new RegExp(`Acked-by:\\s*${t}\\b`).test(versioning));
      if (missing.length > 0) {
        err("13.2", `${c.file}: stable contract '${c.id}' has cross-team consumers without acks: ${missing.join(", ")} (add 'Acked-by: <team> (date)' lines to ## Versioning)`);
      }
    }
    // ADR approval: accepted ADRs spanning teams need every team in ## Approvals
    for (const a of model.adrs) {
      if (a.status !== "accepted") continue;
      const teams = new Set();
      for (const entry of a.affects) {
        const { id } = parseIdVersion(entry);
        const direct = teamOf(id);
        if (direct) teams.add(direct);
        const contract = contractsById.get(id);
        if (contract) {
          const ot = teamOf(deriveOwner(model, contract));
          if (ot) teams.add(ot);
          for (const t of deriveConsumers(model, contract).map(teamOf)) if (t) teams.add(t);
        }
      }
      if (teams.size <= 1) continue;
      const approvals = extractSection(a.body, "Approvals") || "";
      const missing = [...teams].sort().filter((t) => !approvals.includes(t));
      if (missing.length > 0) {
        err("13.3", `${a.file}: ${a.id} spans teams and may not be 'accepted' without '## Approvals' entries for: ${missing.join(", ")}`);
      }
    }
  }

  return { errors, warnings };
}
