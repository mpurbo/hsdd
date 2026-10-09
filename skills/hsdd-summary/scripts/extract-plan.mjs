// Extract the plan model from an HSDD tree. Reads files; computes nothing a
// view needs beyond what the artifacts state.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  toLines, splitFrontmatter, headings, sections, fieldBlock, tables, column,
  plain, isNone, contractRefs, adrRefs, oqRefs, sectionName,
} from "./md.mjs";

export const TIERS = ["gate-only", "spot-check", "full-review"];

export function sha(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

export function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "INDEX.md").sort();
}

function readIf(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export function codingMethod(conventions) {
  const m = /\*\*Coding method:\*\*\s*`?([a-z]+)`?/i.exec(conventions);
  return m ? m[1].toLowerCase() : "openspec";
}

function nextHeadingLine(ls, line, level) {
  const h = headings(ls).find((x) => x.line > line && x.level <= level);
  return h ? h.line : ls.length;
}

// "acme.api: Name", "acme.api - Name" or "acme.api" followed by an em dash.
export function splitTitle(text) {
  const m = /^([A-Za-z0-9][\w.-]*?)\s*(?::|\u2014|\u2013|\s-)\s*(.*)$/.exec(text.trim());
  return m ? { id: m[1], name: m[2].trim() } : { id: null, name: text.trim() };
}

// A node's own field block: under "## Node" (or "## Node spec"), else between
// the title and the first "##". It counts only if it has Kind or Purpose, so a
// one-line "**Node id:** ... · **Kind:** ..." header is never mistaken for it.
function ownBlock(ls) {
  const hs = headings(ls);
  const isBlock = (fb) => (fb && (fb.fields.Kind || fb.fields.Purpose) ? fb : null);
  const node = hs.find((h) => h.level === 2 && /^node( spec)?$/i.test(sectionName(h.text)));
  if (node) return isBlock(fieldBlock(ls, node.line + 1, nextHeadingLine(ls, node.line, 2)));
  const title = hs.find((h) => h.level === 1);
  const firstH2 = hs.find((h) => h.level === 2);
  let from = title ? title.line + 1 : 0;
  const to = firstH2 ? firstH2.line : ls.length;
  while (from < to) {
    const fb = fieldBlock(ls, from, to);
    if (!fb) return null;
    if (isBlock(fb)) return fb;
    from = fb.end + 1;
  }
  return null;
}

function value(fields, name) {
  const f = fields?.[name];
  return f ? f.value : null;
}

function refsOf(v) {
  return v === null || isNone(v) ? [] : contractRefs(v).map(({ ref, ext }) => ({ ref, ext }));
}

function normTier(v) {
  if (v == null) return null;
  const t = plain(v).toLowerCase().replace(/\s+/g, "-");
  return TIERS.find((x) => t.includes(x)) ?? null;
}

function normKind(v) {
  if (v == null) return null;
  const t = plain(v).toLowerCase();
  if (t.includes("leaf-parent")) return "leaf-parent";
  if (t.includes("integration")) return "integration";
  if (t.includes("internal")) return "internal";
  return null;
}

function parentOf(id, ids) {
  let p = id;
  while (p.includes(".")) {
    p = p.slice(0, p.lastIndexOf("."));
    if (ids.has(p)) return p;
  }
  return null;
}

// "1, api.2 and gateway.3 (types)" -> phase ids, in-node or resolved across nodes.
// `aliases` maps a phase-heading prefix ("an", "gateway") to the node that uses it.
export function phaseList(cell, nodeId, nodeIds, aliases = new Map()) {
  const out = { ids: [], unresolved: [] };
  if (cell == null || isNone(cell)) return out;
  const tokens = plain(cell).replace(/\([^)]*\)/g, "").split(/[,;]|\band\b/);
  for (const raw of tokens) {
    const t = raw.trim().replace(/^phases?\s+/i, "").replace(/[^\w.]+$/, "");
    if (!t || isNone(t)) continue;
    const range = /^(?:(.*?)\.)?(\d+)\s*[\u2013-]\s*(?:(.*?)\.)?(\d+)$/.exec(t);
    if (range && (!range[3] || range[3] === range[1]) && Number(range[4]) >= Number(range[2]) && Number(range[4]) - Number(range[2]) <= 50) {
      for (let n = Number(range[2]); n <= Number(range[4]); n++) tokens.push(`${range[1] ? range[1] + "." : ""}${n}`);
      continue;
    }
    const m = /^(?:(.*)\.)?(\d+)$/.exec(t);
    if (!m) {
      out.unresolved.push(t);
      continue;
    }
    const prefix = m[1] ?? "";
    if (!prefix || nodeId === prefix || nodeId.endsWith("." + prefix) || aliases.get(prefix) === nodeId) {
      out.ids.push(`${nodeId}.${m[2]}`);
      continue;
    }
    const owner = aliases.get(prefix) ?? [...nodeIds].find((n) => n === prefix || n.endsWith("." + prefix));
    if (owner) out.ids.push(`${owner}.${m[2]}`);
    else out.unresolved.push(t);
  }
  out.ids = [...new Set(out.ids)];
  return out;
}

function openQuestions(ls) {
  const sec = sections(ls, 2).find((s) => /^open questions/i.test(sectionName(s.title)));
  if (!sec) return [];
  const t = tables(ls, sec.start, sec.end).find((x) => column(x, "id") >= 0 && column(x, "question") >= 0);
  if (!t) return [];
  const [ci, cq, cs, cw, ca] = ["id", "question", "status", "waits", "affects"].map((n) => column(t, n));
  const hs = headings(ls);
  return t.rows.map((r) => {
    const id = plain(r.cells[ci]);
    const status = plain(r.cells[cs] ?? "");
    return {
      id,
      question: plain(r.cells[cq] ?? ""),
      status: /^resolved/i.test(status) ? "RESOLVED" : /^partial/i.test(status) ? "PARTIAL" : /^open/i.test(status) ? "OPEN" : status,
      waitsOn: cw >= 0 ? plain(r.cells[cw] ?? "") : "",
      affects: ca >= 0 ? plain(r.cells[ca] ?? "") : "",
      hasDetail: hs.some((h) => h.level >= 3 && new RegExp(`^${id}(?![\\w-])`).test(plain(h.text))),
    };
  });
}

function pendingGovernance(ls) {
  const sec = sections(ls, 2).find((s) => /^governance updates/i.test(sectionName(s.title)));
  if (!sec) return false;
  return ls.slice(sec.start, sec.end).some((l) => /^\s*-\s+\S/.test(l) && !/^\s*-\s+none\b/i.test(l));
}

function sectionText(ls, title) {
  const sec = sections(ls, 2).find((s) => new RegExp(`^${title}`, "i").test(sectionName(s.title)));
  return sec ? ls.slice(sec.start, sec.end).join("\n").trim() : "";
}

function bullets(text) {
  return toLines(text).filter((l) => /^\s*[-*]\s+\S/.test(l) && !/^\s{2,}/.test(l)).map((l) => plain(l.replace(/^\s*[-*]\s+/, "")));
}

function firstSentence(text) {
  const para = text.split(/\n\s*\n/)[0] ?? "";
  const s = plain(para);
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  return m ? m[1] : s;
}

export function extractPlan(root, { specSha = "n/a" } = {}) {
  const hsdd = join(root, "hsdd");
  const unparsed = [];
  const facts = {};
  const conventions = readIf(join(hsdd, "conventions.md"));

  const specIds = listMd(join(hsdd, "spec")).map((f) => f.slice(0, -3)).sort();
  const idSet = new Set(specIds);
  const docs = new Map(specIds.map((id) => [id, toLines(readFileSync(join(hsdd, "spec", id + ".md"), "utf8"))]));
  const rootId = specIds.filter((id) => !id.includes("."))[0] ?? specIds[0] ?? null;

  // Child blocks embedded in parents: "### {child-id}: Name" followed by fields.
  const embedded = new Map();
  for (const [file, ls] of docs) {
    for (const h of headings(ls).filter((x) => x.level === 3)) {
      const { id, name } = splitTitle(plain(h.text));
      if (!id || !idSet.has(id) || id === file) continue;
      const fb = fieldBlock(ls, h.line + 1, nextHeadingLine(ls, h.line, 3));
      if (fb) embedded.set(id, { fb, ls, name, file });
    }
  }

  // Phase-heading prefixes per node ("an" in "### an.3: ..."): a prefix used by
  // exactly one node resolves short ids in Depends on cells anywhere in the tree.
  const prefixOwners = new Map();
  for (const [id, ls] of docs) {
    const plan = sections(ls, 2).find((s) => /^phase plan/i.test(sectionName(s.title)));
    if (!plan) continue;
    for (const h of headings(ls).filter((x) => x.level === 3 && x.line > plan.line)) {
      const m = /^([\w.-]*?)\.?(\d+)\s*:/.exec(plain(h.text));
      if (m && m[1] && !idSet.has(m[1])) prefixOwners.set(m[1], [...new Set([...(prefixOwners.get(m[1]) ?? []), id])]);
    }
  }
  const aliases = new Map([...prefixOwners].filter(([, owners]) => owners.length === 1).map(([p, [o]]) => [p, o]));

  const nodes = [];
  const phases = [];
  for (const id of specIds) {
    const ls = docs.get(id);
    const file = `hsdd/spec/${id}.md`;
    const title = headings(ls).find((h) => h.level === 1);
    const t = title ? splitTitle(plain(title.text)) : { name: id };
    const own = ownBlock(ls);
    const emb = embedded.get(id);
    const block = own ?? emb?.fb ?? null;
    const blockLs = own ? ls : emb?.ls;
    const f = block?.fields ?? {};
    const i = nodes.length;
    const isRoot = id === rootId;
    const planSec = sections(ls, 2).find((s) => /^phase plan/i.test(sectionName(s.title)));
    const children = specIds.filter((c) => parentOf(c, idSet) === id);

    let kind = isRoot ? "root" : normKind(value(f, "Kind"));
    if (!isRoot && kind === null) {
      if (value(f, "Kind") === null && !block) kind = planSec ? "leaf-parent" : children.length ? "internal" : null;
      if (kind === null) unparsed.push({ path: `/nodes/${i}/kind`, file, line: (f.Kind?.line ?? 0) + 1, reason: `Kind "${value(f, "Kind") ?? "(absent)"}" is not internal, leaf-parent or integration` });
    }
    if (!isRoot && !block) unparsed.push({ path: `/nodes/${i}/purpose`, file, line: 1, reason: "no field block in the node's file or its parent's" });

    const status = /retired/i.test(value(f, "Status") ?? "") ? "retired" : "active";
    const adoptedV = value(f, "Adopted") ?? "";
    const raw = block ? blockLs.slice(block.start, block.end).join("\n") : "";
    facts[`explain:${id}`] = sha(`${t.name}\n${raw}`);

    const node = {
      id,
      name: t.name || emb?.name || id,
      parent: isRoot ? null : parentOf(id, idSet),
      kind,
      status,
      adopted: /as-built/i.test(adoptedV) ? "as-built" : /promoted/i.test(adoptedV) ? "promoted" : null,
      team: value(f, "Team") ? plain(value(f, "Team")) : null,
      purpose: value(f, "Purpose"),
      owns: value(f, "Owns"),
      doesNotOwn: value(f, "Does not own"),
      isolation: value(f, "Isolation strategy"),
      consumes: refsOf(value(f, "Consumes")),
      produces: refsOf(value(f, "Produces")),
      governedBy: adrRefs(value(f, "Governed by") ?? ""),
      children,
      phases: [],
      defaultGate: null,
      openQuestions: openQuestions(ls),
      pendingGovernance: pendingGovernance(ls),
      observedSurface: sections(ls, 2).some((s) => /^observed surface/i.test(sectionName(s.title))),
      sourceFile: file,
    };
    nodes.push(node);

    if (!planSec) continue;
    const planLs = ls.slice(planSec.start, planSec.end);
    const dg = planLs.map((l) => /^\*\*Default gate:\*\*\s*(.+)$/.exec(l.trim())).find(Boolean);
    node.defaultGate = dg ? plain(dg[1]) : null;
    const table = tables(ls, planSec.start, planSec.end).find((x) => column(x, "phase") >= 0 && column(x, "name") >= 0) ?? null;
    const rowByN = new Map();
    if (table) {
      const cp = column(table, "phase");
      for (const r of table.rows) {
        const n = /(\d+)\s*$/.exec(plain(r.cells[cp] ?? ""));
        if (n) rowByN.set(n[1], r);
      }
    }
    const heads = headings(ls).filter((h) => h.level === 3 && h.line > planSec.line);
    for (const h of heads) {
      const m = /^([\w.-]*?(\d+))\s*:\s*(.+)$/.exec(plain(h.text));
      if (!m || idSet.has(m[1])) continue;
      const end = nextHeadingLine(ls, h.line, 3);
      const fb = fieldBlock(ls, h.line + 1, end);
      if (!fb || !(fb.fields.Scope || fb.fields["Review tier"])) continue;
      const pf = fb.fields;
      const pid = `${id}.${m[2]}`;
      const pi = phases.length;
      const row = rowByN.get(m[2]) ?? null;
      const blockText = ls.slice(fb.start, fb.end).join("\n");
      facts[`delivers:${pid}`] = sha(blockText);

      let tier = normTier(value(pf, "Review tier"));
      if (tier === null && row && column(table, "tier") >= 0) tier = normTier(row.cells[column(table, "tier")]);
      if (tier === null) unparsed.push({ path: `/phases/${pi}/tier`, file, line: (pf["Review tier"]?.line ?? h.line) + 1, reason: `review tier "${value(pf, "Review tier") ?? "(absent)"}" is not gate-only, spot-check or full-review` });

      let dependsOn = [];
      if (row && column(table, "depends") >= 0) {
        const d = phaseList(row.cells[column(table, "depends")], id, idSet, aliases);
        dependsOn = d.ids;
        if (d.unresolved.length) unparsed.push({ path: `/phases/${pi}/dependsOn`, file, line: row.line + 1, reason: `Depends on names ${d.unresolved.join(", ")}, which matches no phase` });
      } else {
        unparsed.push({ path: `/phases/${pi}/dependsOn`, file, line: (pf.Dependencies?.line ?? h.line) + 1, reason: "the phase has no summary-table row; read its Dependencies line" });
      }
      const collCell = row && column(table, "collides") >= 0 ? row.cells[column(table, "collides")] : value(pf, "Collides with");
      const coll = phaseList(collCell, id, idSet, aliases);

      const gate = value(pf, "Gate") === null ? null : plain(value(pf, "Gate"));
      const size = value(pf, "Size estimate") === null ? (row && column(table, "size") >= 0 ? plain(row.cells[column(table, "size")]) : null) : plain(value(pf, "Size estimate"));
      const cap = /(?:<=|≤)\s*(\d+)/.exec(size ?? "");
      const contingentOn = [...new Set(toLines(blockText).filter((l) => /contingent/i.test(l)).flatMap(oqRefs))];

      phases.push({
        id: pid,
        node: id,
        heading: m[1],
        n: Number(m[2]),
        name: m[3].trim(),
        tier,
        size,
        taskCap: cap ? Number(cap[1]) : null,
        scope: value(pf, "Scope"),
        verification: value(pf, "Verification"),
        gate,
        resolvedGate: gate && /node default/i.test(gate) ? node.defaultGate : gate,
        consumes: refsOf(value(pf, "Consumes")),
        produces: refsOf(value(pf, "Produces")),
        governedBy: adrRefs(value(pf, "Governed by") ?? ""),
        dependsOn,
        collidesWith: coll.ids.filter((x) => x !== pid),
        contingentOn,
        citesOq: oqRefs(blockText),
        inTable: row !== null,
        sourceFile: file,
        line: h.line + 1,
      });
      node.phases.push(pid);
    }
    if (table) {
      for (const [n, r] of rowByN) {
        if (!node.phases.includes(`${id}.${n}`)) node.tableOnly = [...(node.tableOnly ?? []), { id: `${id}.${n}`, line: r.line + 1 }];
      }
    }
  }

  const contracts = [];
  for (const f of listMd(join(hsdd, "contract"))) {
    const file = `hsdd/contract/${f}`;
    const text = readFileSync(join(hsdd, "contract", f), "utf8");
    const fm = splitFrontmatter(text);
    const i = contracts.length;
    const d = fm.data ?? {};
    if (!fm.data) unparsed.push({ path: `/contracts/${i}`, file, line: 1, reason: fm.error ?? "no frontmatter" });
    const ls = toLines(text);
    const iface = sectionText(ls, "interface");
    const guar = sectionText(ls, "guarantees");
    const ref = `${d.id ?? f.slice(0, -3)}@${d.version ?? "v?"}`;
    facts[`promise:${ref}`] = sha(`${iface}\n${guar}`);
    contracts.push({
      ref,
      id: d.id ?? f.slice(0, -3),
      version: d.version ?? null,
      status: d.status ?? null,
      kind: d.kind ?? null,
      owner: d.owner ?? null,
      producedBy: Array.isArray(d.produced_by) ? d.produced_by : [],
      consumers: Array.isArray(d.consumers) ? d.consumers : [],
      phaseIds: d.phase_ids ?? null,
      external: String(d.owner ?? "").startsWith("ext:"),
      guarantees: bullets(guar),
      sourceFile: file,
    });
  }

  const adrs = [];
  for (const f of listMd(join(hsdd, "adr"))) {
    const file = `hsdd/adr/${f}`;
    const text = readFileSync(join(hsdd, "adr", f), "utf8");
    const fm = splitFrontmatter(text);
    const ls = toLines(text);
    const h1 = headings(ls).find((h) => h.level === 1);
    const d = fm.data ?? {};
    if (!fm.data) unparsed.push({ path: `/adrs/${adrs.length}`, file, line: 1, reason: fm.error ?? "no frontmatter" });
    adrs.push({
      id: adrRefs(d.id ?? f)[0] ?? null,
      title: h1 ? plain(h1.text).replace(/^ADR-\d+\s*:\s*/, "") : f,
      status: d.status ?? null,
      affects: Array.isArray(d.affects) ? d.affects : [],
      decision: firstSentence(sectionText(ls, "decision")),
      sourceFile: file,
    });
  }

  const contractRefsAll = new Set(contracts.map((c) => c.ref));
  for (const x of [...nodes, ...phases]) for (const r of [...x.consumes, ...x.produces]) contractRefsAll.add(r.ref);
  const oqIds = nodes.flatMap((n) => n.openQuestions.map((q) => q.id));
  const ids = [...new Set([
    ...nodes.map((n) => n.id), ...phases.map((p) => p.id), ...phases.map((p) => p.heading),
    ...contractRefsAll, ...adrs.map((a) => a.id).filter(Boolean), ...oqIds,
  ])];

  return {
    kind: "plan",
    schemaVersion: 1,
    project: { root: rootId, name: nodes.find((n) => n.id === rootId)?.name ?? rootId, specSha, codingMethod: codingMethod(conventions) },
    nodes,
    phases,
    contracts,
    adrs,
    ids,
    facts,
    unparsed,
  };
}
