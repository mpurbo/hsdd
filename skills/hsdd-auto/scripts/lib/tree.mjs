// Lenient parsers for HSDD artifacts (decision A-5): node specs, contracts, ADRs,
// open questions, phase plans, pending sections and citations. Every parser is a
// pure function of the text; loadTree is the one reader of the repository.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

// ---------- markdown primitives ----------

export const toLines = (text) => String(text ?? "").replace(/\r\n?/g, "\n").split("\n");

const FENCE = /^\s*(`{3,}|~{3,})/;

// Which lines sit inside a fenced code block (the fence lines included).
const fenceMask = (ls) => {
  const mask = new Array(ls.length).fill(false);
  let fence = null;
  ls.forEach((l, i) => {
    const f = FENCE.exec(l);
    if (fence === null) {
      if (f) { fence = f[1]; mask[i] = true; }
      return;
    }
    mask[i] = true;
    const t = l.trim();
    if (t[0] === fence[0] && /^(`+|~+)$/.test(t) && t.length >= fence.length) fence = null;
  });
  return mask;
};

// Headings outside fenced code: [{ level, text, line }], line 0-based.
export const headings = (ls, mask = fenceMask(ls)) =>
  ls.flatMap((l, i) => {
    if (mask[i]) return [];
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(l);
    return m ? [{ level: m[1].length, text: m[2], line: i }] : [];
  });

// The line where a heading's section ends: the next heading of the same or a higher level.
export const sectionEnd = (hs, h, total) => hs.find((x) => x.line > h.line && x.level <= h.level)?.line ?? total;

// Strip inline markdown: links, emphasis, code ticks, brackets; collapse whitespace.
export const plain = (s) => String(s ?? "")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/\*\*|__/g, "")
  .replace(/`/g, "")
  .replace(/\[([^\]]*)\]/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

// A section title without its numbering: "6. Findings" is "Findings".
const sectionName = (s) => plain(s).replace(/^(?:\d{1,2}(?:\.\d+)*\.?|\u00a7\s*\d+(?:\.\d+)*)\s+/, "");

const NONE = /^(none|n\/a|\u2014|\u2013|-)?\.?$/i;
const isNone = (s) => NONE.test(plain(s));

// The first lower-case word of a value: "As-built" is "as-built", "closed (2026-10-30)" is "closed".
export const word = (v) => (v == null ? null : plain(v).toLowerCase().match(/^[a-z][a-z-]*/)?.[0] ?? null);

// "acme.api: Name", "acme.api - Name", "acme.api" then an en or em dash; the id is null without a separator.
const TITLE = /^([A-Za-z0-9][\w.-]*?)\s*(?::|\u2014|\u2013|\s-)\s*(.*)$/;
export const splitTitle = (text) => {
  const m = TITLE.exec(String(text).trim());
  return m ? { id: m[1], name: m[2].trim() } : { id: null, name: String(text).trim() };
};

const unique = (xs) => [...new Set(xs)];

// Top-level comma split that keeps "(§2, §3)" and "[a, b]" whole.
const splitTop = (s) => {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const c of s) {
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    if (c === "," && depth === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  return [...out, cur];
};

const closingBracket = (s) => {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[") depth++;
    else if (s[i] === "]" && --depth === 0) return i;
  }
  return -1;
};

// A list field value ("[a, b]", "a, b", "none") as plain items.
export const listItems = (v) => {
  if (v == null || isNone(v)) return [];
  let s = String(v).trim();
  if (s.startsWith("[") && closingBracket(s) === s.length - 1) s = s.slice(1, -1);
  return splitTop(s).map(plain).filter((x) => x !== "" && !isNone(x));
};

// ---------- field blocks ----------

const FIELD = /^(?:[-*+]\s+)?\*\*([A-Za-z][^*]*?):\*\*\s?(.*)$/;

// The first run of `- **Name:** value` lines in [from, to): indented lines continue a
// field, blank lines may separate fields. Null when a heading or the end comes first.
const fieldBlock = (ls, from, to, mask) => {
  let i = from;
  while (i < to && (mask[i] || !(/^\S/.test(ls[i]) && FIELD.test(ls[i])))) {
    if (!mask[i] && /^#{1,6}\s/.test(ls[i])) return null;
    i++;
  }
  if (i >= to) return null;
  const start = i;
  const fields = {};
  let cur = null;
  for (; i < to; i++) {
    const l = ls[i];
    const m = /^\S/.test(l) ? FIELD.exec(l) : null;
    if (m) {
      cur = [m[2]];
      if (!(m[1].trim() in fields)) fields[m[1].trim()] = cur;
      continue;
    }
    if (cur && /^\s+\S/.test(l)) { cur.push(l.trim()); continue; }
    if (!l.trim()) {
      let j = i + 1;
      while (j < to && !ls[j].trim()) j++;
      if (j < to && /^\S/.test(ls[j]) && FIELD.test(ls[j])) continue;
    }
    break;
  }
  return { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.join(" ").trim()])), start, end: i };
};

const isNodeBlock = (fb) => (fb && ("Kind" in fb.fields || "Purpose" in fb.fields) ? fb : null);

// A node's own field block: under "## Node" (or "## Node spec"), else between the title
// and the first "##", else under a "###" heading that carries the node's own id.
const ownBlock = (ls, hs, mask, id) => {
  const nodeSection = hs.find((h) => h.level === 2 && /^node( spec)?$/i.test(sectionName(h.text)));
  if (nodeSection) {
    const fb = isNodeBlock(fieldBlock(ls, nodeSection.line + 1, sectionEnd(hs, nodeSection, ls.length), mask));
    if (fb) return fb;
  }
  const title = hs.find((h) => h.level === 1);
  const firstH2 = hs.find((h) => h.level === 2 && (!title || h.line > title.line));
  const to = firstH2 ? firstH2.line : ls.length;
  for (let from = title ? title.line + 1 : 0; from < to;) {
    const fb = fieldBlock(ls, from, to, mask);
    if (!fb) break;
    if (isNodeBlock(fb)) return fb;
    from = fb.end + 1;
  }
  const own = hs.find((h) => h.level === 3 && splitTitle(plain(h.text)).id === id);
  return own ? isNodeBlock(fieldBlock(ls, own.line + 1, sectionEnd(hs, own, ls.length), mask)) : null;
};

// ---------- ids and references ----------

// `{slug}@v{n}` references in order, each once; `(ext)` after one marks it external.
export const contractRefs = (value) => {
  const text = value == null ? "" : String(value);
  const matches = [...text.matchAll(/(?<![A-Za-z0-9_-])([a-z0-9][a-z0-9-]*)@(v\d+)(?![A-Za-z_])/g)];
  const out = [];
  matches.forEach((m, k) => {
    const end = m.index + m[0].length;
    const tail = text.slice(end, Math.min(k + 1 < matches.length ? matches[k + 1].index : text.length, end + 40));
    const ext = /^[`\]\s]*\(\s*ext\b/i.test(tail) || /\bext\b/i.test(tail.split(/[\],;]/)[0]);
    if (!out.some((r) => r.slug === m[1] && r.version === m[2])) out.push({ slug: m[1], version: m[2], ext });
  });
  return out;
};

// A phase id's node: the id without its trailing numeric segment.
export const phaseNodeOf = (phaseId) => phaseId.replace(/\.\d+$/, "");

const ADR_RE = /\bADR-\d{3,}\b/g;
const OQ_RE = /\bOQ(?:\d+|-[A-Z]+\d+)\b/g;
const OQ_DEF = /^(OQ(?:\d+|-[A-Z]+\d+))(?:\s*(?::|\u2014|\u2013|\s-)|$)/;
const adrIds = (v) => unique([...String(v ?? "").matchAll(ADR_RE)].map((m) => m[0]));

// A child id: dotted, not part of a path or a file name.
const CHILD_ID = /(?<![A-Za-z0-9_./-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?![A-Za-z0-9_/-])/g;
const childIds = (v) => {
  const s = plain(v ?? "");
  return s === "" || /^phases\b/i.test(s) ? [] : unique([...s.matchAll(CHILD_ID)].map((m) => m[0]));
};

// A phase heading's id: full (`shop.api.2`) or short (`2`, `api.2`); its number is the last segment.
const PHASE_HEADING = /^(?:[a-z0-9][a-z0-9-]*\.)*(\d+)$/i;
const NODE_ID = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;

// ---------- node specs ----------

const PENDING_ENTRY = /^(confirm|note|amend|request)\b/i;

const pendingOf = (ls, hs, mask) => {
  const sections = hs.filter((h) => h.level === 2 && /^governance updates\b/i.test(sectionName(h.text)));
  const entries = sections.reduce((n, h) => n + ls.slice(h.line + 1, sectionEnd(hs, h, ls.length))
    .filter((l, k) => !mask[h.line + 1 + k] && /^[-*+]\s+\S/.test(l) && PENDING_ENTRY.test(plain(l.replace(/^[-*+]\s+/, "")))).length, 0);
  return { present: sections.length > 0, entries };
};

const tableHeaders = (ls, from, to, mask) => {
  const out = [];
  for (let i = from; i + 1 < to; i++) {
    if (mask[i] || !/^\s*\|/.test(ls[i])) continue;
    if (/^[\s|:-]+$/.test(ls[i + 1]) && ls[i + 1].includes("---")) {
      out.push(ls[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => plain(c)));
      while (i + 1 < to && /^\s*\|/.test(ls[i + 1])) i++;
    }
  }
  return out;
};

const phasesOf = (ls, hs, mask, nodeId, plan) => {
  if (!plan) return [];
  const end = sectionEnd(hs, plan, ls.length);
  return hs.filter((h) => h.level === 3 && h.line > plan.line && h.line < end).flatMap((h) => {
    const text = plain(h.text);
    const t = splitTitle(text);
    const short = t.id ?? text;
    const m = PHASE_HEADING.exec(short);
    if (!m) return [];
    const full = short.startsWith(`${nodeId}.`) && /^\d+$/.test(short.slice(nodeId.length + 1));
    const fb = fieldBlock(ls, h.line + 1, sectionEnd(hs, h, ls.length), mask);
    const f = fb?.fields ?? {};
    return [{
      id: full ? short : `${nodeId}.${Number(m[1])}`,
      short,
      name: t.id ? t.name : "",
      consumes: contractRefs(f.Consumes),
      produces: contractRefs(f.Produces),
      governedBy: adrIds(f["Governed by"]),
    }];
  });
};

const childrenOf = (ls, hs, mask, nodeId) =>
  hs.filter((h) => h.level === 3).flatMap((h) => {
    const { id, name } = splitTitle(plain(h.text));
    if (!id || id === nodeId || !NODE_ID.test(id) || /\.\d+$/.test(id)) return [];
    return isNodeBlock(fieldBlock(ls, h.line + 1, sectionEnd(hs, h, ls.length), mask)) ? [{ id, name }] : [];
  });

const value = (f, name) => (f[name] === undefined || f[name] === "" ? null : f[name]);

export const parseNodeSpec = (text, file) => {
  const ls = toLines(text);
  const mask = fenceMask(ls);
  const hs = headings(ls, mask);
  const titleHeading = hs.find((h) => h.level === 1) ?? null;
  const title = titleHeading ? plain(titleHeading.text) : null;
  const parsed = title === null ? { id: null, name: null } : splitTitle(title);
  const id = file ? basename(file).replace(/\.md$/i, "") : parsed.id;
  const f = ownBlock(ls, hs, mask, id)?.fields ?? {};
  const plan = hs.find((h) => h.level === 2 && /^phase plan\b/i.test(sectionName(h.text))) ?? null;
  const kindText = value(f, "Kind") === null ? null : plain(f.Kind).toLowerCase();
  return {
    id,
    name: parsed.name,
    file: file ?? null,
    title,
    titleId: parsed.id,
    kind: kindText === null ? null
      : /\bleaf[- ]parent\b/.test(kindText) ? "leaf-parent"
      : /\binternal\b/.test(kindText) ? "internal" : kindText,
    purpose: value(f, "Purpose") === null ? null : plain(f.Purpose),
    team: value(f, "Team") === null ? null : plain(f.Team),
    consumes: contractRefs(f.Consumes),
    produces: contractRefs(f.Produces),
    governedBy: adrIds(f["Governed by"]),
    sources: listItems(value(f, "Sources")),
    decomposesInto: childIds(f["Decomposes into"]),
    adopted: word(value(f, "Adopted")),
    status: word(value(f, "Status")),
    hasPhasePlan: plan !== null,
    hasSummaryTable: plan !== null && tableHeaders(ls, plan.line + 1, sectionEnd(hs, plan, ls.length), mask)
      .some((cells) => cells[0]?.toLowerCase() === "phase"),
    phases: phasesOf(ls, hs, mask, id, plan),
    pending: pendingOf(ls, hs, mask),
    children: childrenOf(ls, hs, mask, id),
    observedSurface: hs.some((h) => h.level === 2 && /^observed surface\b/i.test(sectionName(h.text))),
  };
};

// ---------- front matter, contracts, ADRs ----------

const dequote = (s) => s.replace(/^["']|["']$/g, "");
const stripComment = (s) => s.replace(/\s+#.*$/, "").trim();

// The approach of hsdd-contract's gen-registry.mjs: scalars, inline [a, b] lists and block
// "- item" lists, quotes and trailing comments stripped. Null when there is no front matter.
export const parseFrontMatter = (text) => {
  const t = String(text ?? "").replace(/\r\n?/g, "\n");
  if (!t.startsWith("---")) return null;
  const end = t.indexOf("\n---", 3);
  if (end === -1) return null;
  const data = {};
  let key = null;
  for (const raw of t.slice(3, end).split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = /^\s*-\s+(.*)$/.exec(raw);
    if (item && key !== null && Array.isArray(data[key])) { data[key].push(dequote(stripComment(item[1]))); continue; }
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (!kv || kv[1] === "__proto__") continue;
    key = kv[1];
    const val = stripComment(kv[2]);
    if (val === "") data[key] = [];
    else if (val.startsWith("[")) data[key] = val.replace(/^\[|\]$/g, "").split(",").map((s) => dequote(s.trim())).filter(Boolean);
    else data[key] = dequote(val);
  }
  return data;
};

const str = (v) => (typeof v === "string" && v !== "" ? v : null);
const list = (v) => (Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : []);

const sectionLines = (ls, hs, re) => {
  const h = hs.find((x) => x.level === 2 && re.test(sectionName(x.text)));
  return h ? ls.slice(h.line + 1, sectionEnd(hs, h, ls.length)) : null;
};

const validationPathsOf = (lines) => (lines ?? []).flatMap((l) => {
  const m = /^\s*[-*+]\s*(schema|fixtures?)\s*:\s*(\S+)/i.exec(l.replace(/`|\*\*/g, ""));
  return m ? [{ kind: m[1].toLowerCase() === "schema" ? "schema" : "fixture", path: m[2].replace(/^\.\//, "") }] : [];
});

// The `Breaking:` line under `## Versioning` (v0.11 spec 12.1), with its continuation lines.
const breakingLineOf = (lines) => {
  if (!lines) return null;
  const clean = lines.map((l) => l.replace(/\*\*/g, ""));
  const i = clean.findIndex((l) => /^\s*(?:[-*+]\s+)?Breaking\s*:/i.test(l));
  if (i < 0) return null;
  const rest = [];
  for (let j = i + 1; j < clean.length && /^\s+\S/.test(clean[j]) && !/^\s*[-*+]\s/.test(clean[j]); j++) rest.push(clean[j].trim());
  return [clean[i].replace(/^\s*(?:[-*+]\s+)?Breaking\s*:\s*/i, ""), ...rest].join(" ").trim();
};

export const parseContract = (text, file) => {
  const front = parseFrontMatter(text);
  const f = front ?? {};
  const ls = toLines(text);
  const hs = headings(ls);
  const versioning = sectionLines(ls, hs, /^versioning\b/i);
  return {
    slug: basename(file).replace(/\.md$/i, ""),
    file,
    front,
    text: String(text ?? ""),
    version: str(f.version),
    status: str(f.status),
    phaseIds: str(f.phase_ids),
    owner: str(f.owner),
    producedBy: list(f.produced_by),
    consumers: list(f.consumers),
    governedBy: list(f.governed_by),
    compatibility: str(f.compatibility),
    validation: str(f.validation),
    validationPaths: validationPathsOf(sectionLines(ls, hs, /^validation\b/i)),
    versioningText: versioning === null ? null : versioning.join("\n").trim(),
    breakingLine: breakingLineOf(versioning),
  };
};

export const parseAdr = (text, file) => {
  const front = parseFrontMatter(text);
  const f = front ?? {};
  const num = /^(\d+)(?:-|\.md$)/.exec(basename(file))?.[1];
  return {
    id: str(f.id) ?? (num ? `ADR-${num.padStart(3, "0")}` : null),
    file,
    front,
    text: String(text ?? ""),
    status: str(f.status),
    affects: list(f.affects),
    date: str(f.date),
  };
};

// ---------- the tree ----------

const listMd = (repoRoot, dir) => {
  const full = join(repoRoot, dir);
  if (!existsSync(full) || !statSync(full).isDirectory()) return [];
  return readdirSync(full)
    .filter((n) => n.endsWith(".md") && n.toUpperCase() !== "INDEX.MD" && statSync(join(full, n)).isFile())
    .sort()
    .map((n) => ({ file: `${dir}/${n}`, text: readFileSync(join(full, n), "utf8") }));
};

const listFiles = (repoRoot, dir) => {
  const full = join(repoRoot, dir);
  if (!existsSync(full) || !statSync(full).isDirectory()) return [];
  return readdirSync(full).sort().flatMap((n) => (statSync(join(full, n)).isDirectory()
    ? listFiles(repoRoot, `${dir}/${n}`)
    : [`${dir}/${n}`]));
};

const MENTION = /(?<![A-Za-z0-9_-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*/g;

// Node ids a text mentions, in order: each dotted token counts as its longest known prefix,
// so `shop.api.2` and `hsdd/spec/shop.api.md` mention shop.api.
const mentions = (text, known) => [...text.matchAll(MENTION)].flatMap((m) => {
  const parts = m[0].split(".");
  for (let k = parts.length; k > 0; k--) {
    const id = parts.slice(0, k).join(".");
    if (known.has(id)) return [id];
  }
  return [];
});

// First mention in the root spec, then in the specs of the parent nodes (those that decompose
// into nodes) in that order; a leaf-parent's spec does not contribute. Nodes never mentioned
// follow in file name order. The root itself is not listed.
const mentionOrderOf = (nodes, textOf, root) => {
  const known = new Set(nodes.keys());
  const order = [];
  const add = (id) => { if (id !== root && !order.includes(id)) order.push(id); };
  const visit = (id) => mentions(textOf(id), known).forEach(add);
  if (root !== null && nodes.has(root)) visit(root);
  const isParent = (id) => (nodes.get(id)?.decomposesInto ?? []).length > 0;
  for (let i = 0; i < order.length; i++) if (isParent(order[i])) visit(order[i]);
  const rest = [...nodes.values()].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map((n) => n.id).filter((id) => id !== root && !order.includes(id));
  return [...order, ...rest];
};

const citesIn = (re, files) => files.flatMap(({ file, text }) => unique([...text.matchAll(re)].map((m) => m[0])).map((id) => ({ id, file })));

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Citations (adrCites, oqCites, contractCites) cover the spec, contract and ADR files,
// the set checks C3, C5 and C6 read (spec 10.6); each id is listed once per file, files
// in that order. A stage rule that counts only what a spec cites filters on `file`.
export const loadTree = (repoRoot, layout, { root = null } = {}) => {
  const specFiles = listMd(repoRoot, layout.spec);
  const contractFiles = listMd(repoRoot, layout.contract);
  const adrFiles = listMd(repoRoot, layout.adr);
  const nodes = new Map(specFiles.map(({ file, text }) => parseNodeSpec(text, file)).sort(byId).map((n) => [n.id, n]));
  const rootId = root ?? [...nodes.keys()].find((id) => !id.includes(".")) ?? null;
  const textByFile = new Map(specFiles.map(({ file, text }) => [file, text]));
  const contracts = new Map(contractFiles.map(({ file, text }) => {
    const c = parseContract(text, file);
    const schema = `${layout.contract}/schema/${c.slug}.schema.json`;
    return [c.slug, {
      ...c,
      schemaFile: existsSync(join(repoRoot, schema)) ? schema : null,
      fixtureFiles: listFiles(repoRoot, `${layout.contract}/fixture/${c.slug}`),
    }];
  }));
  const adrs = new Map();
  for (const { file, text } of adrFiles) {
    const a = parseAdr(text, file);
    const key = a.id ?? file;
    if (!adrs.has(key)) adrs.set(key, a);
  }
  const citeFiles = [...specFiles, ...contractFiles, ...adrFiles];
  return {
    root: rootId,
    rootFile: rootId !== null && nodes.has(rootId) ? nodes.get(rootId).file : null,
    nodes,
    mentionOrder: mentionOrderOf(nodes, (id) => textByFile.get(nodes.get(id).file) ?? "", rootId),
    contracts,
    adrs,
    specFiles,
    oqDefs: specFiles.flatMap(({ file, text }) => {
      const ls = toLines(text);
      return headings(ls).filter((h) => h.level === 3).flatMap((h) => {
        const m = OQ_DEF.exec(plain(h.text));
        return m ? [{ id: m[1], file }] : [];
      });
    }),
    oqCites: citesIn(OQ_RE, citeFiles),
    adrCites: citesIn(ADR_RE, citeFiles),
    contractCites: citeFiles.flatMap(({ file, text }) => contractRefs(text).map(({ slug, version }) => ({ slug, version, file }))),
    contractNames: [...nodes.values()].flatMap((n) => {
      const seen = new Set();
      return [...n.consumes, ...n.produces].flatMap((r) => {
        const key = `${r.slug}@${r.version}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ ...r, file: n.file, node: n.id }];
      });
    }),
  };
};
