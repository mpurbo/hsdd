// Intake records and their handoff block (v0.11 spec 12.2, appendix A.7), read
// leniently (decision A-5), and the `cites-superseded` condition.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { validate } from "./schema.mjs";
import { skillFor, targetType } from "./kinds.mjs";
import { headings, listItems, plain, sectionEnd, toLines, word } from "./tree.mjs";

const unique = (xs) => [...new Set(xs)];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- the handoff block ----------

const OPEN_FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/;

// Every fenced block of a text: [{ start, end, info, closed }], end exclusive of the closing fence.
const fences = (ls) => {
  const out = [];
  for (let i = 0; i < ls.length; i++) {
    const m = OPEN_FENCE.exec(ls[i]);
    if (!m) continue;
    const fence = m[1];
    let j = i + 1;
    while (j < ls.length) {
      const t = ls[j].trim();
      if (t[0] === fence[0] && /^(`+|~+)$/.test(t) && t.length >= fence.length) break;
      j++;
    }
    out.push({ start: i, end: j, info: m[2], closed: j < ls.length });
    i = j;
  }
  return out;
};

export const parseHandoffBlock = (routingText) => {
  const ls = toLines(routingText ?? "");
  const blocks = fences(ls).filter((f) => f.info === "hsdd-handoffs");
  if (blocks.length === 0) return { block: null, error: null };
  if (blocks.length > 1) return { block: null, error: "the ## Routing section holds more than one hsdd-handoffs block" };
  const [b] = blocks;
  if (!b.closed) return { block: null, error: "the hsdd-handoffs block has no closing fence" };
  try {
    const block = JSON.parse(ls.slice(b.start + 1, b.end).join("\n"));
    if (block === null || typeof block !== "object" || Array.isArray(block)) {
      return { block: null, error: "the hsdd-handoffs block is not a JSON object" };
    }
    return { block, error: null };
  } catch (e) {
    return { block: null, error: `the hsdd-handoffs block is not valid JSON: ${e.message}` };
  }
};

// The ## Routing prose: the section without its hsdd-handoffs block, whitespace runs as one space.
const routingProse = (routing) => {
  const ls = toLines(routing ?? "");
  const inBlock = new Set(fences(ls).filter((f) => f.info === "hsdd-handoffs")
    .flatMap((f) => Array.from({ length: f.end - f.start + 1 }, (_, k) => f.start + k)));
  return ls.filter((_, i) => !inBlock.has(i)).join("\n").replace(/\s+/g, " ");
};

const promptErrors = (routing, handoffs) => {
  const prose = routingProse(routing);
  const errors = [];
  let pos = 0;
  for (const h of handoffs) {
    const prompt = h.prompt.replace(/\s+/g, " ");
    const at = prose.indexOf(prompt, pos);
    if (at >= 0) { pos = at + prompt.length; continue; }
    errors.push(prose.includes(prompt)
      ? `${h.id}: its prompt is quoted in the ## Routing prose out of block order; the prose quotes the prompts in the block's order`
      : `${h.id}: its prompt does not appear verbatim in the ## Routing prose`);
  }
  return errors;
};

const expectedSkill = (h, tree) => {
  try {
    return { skill: skillFor(h.kind, h.target, tree) };
  } catch (e) {
    return { error: e.message };
  }
};

// A.7's schema and code rules (gate C8): only a structural record has an empty list, and a
// structural record has nothing else (spec 12.2); ids are unique; every `after` id names an
// earlier handoff; `skill` is the one 7.1 gives the kind; each prompt is quoted verbatim in
// the ## Routing prose, in block order. An absent block has no errors: C8 decides when it is required.
export const blockErrors = (record, tree) => {
  if (tree == null) throw new TypeError("blockErrors: tree is required");
  if (record.blockError) return [record.blockError];
  if (record.block == null) return [];
  const schema = validate("handoffs", record.block);
  if (schema.length > 0) return schema.map((e) => `handoff block: ${e}`);
  const handoffs = record.block.handoffs;
  const structural = record.cls === "structural";
  const errors = [];
  if (handoffs.length === 0 && !structural) {
    errors.push(`the handoff block lists no handoffs, which only a structural record may do (**Class:** ${record.cls ?? "missing"})`);
  }
  if (handoffs.length > 0 && structural) {
    errors.push(`a structural record's handoff block lists no handoffs, since they are the owner's decision; this one lists ${handoffs.length}`);
  }
  handoffs.forEach((h, i) => {
    const earlier = handoffs.slice(0, i).map((x) => x.id);
    if (earlier.includes(h.id)) errors.push(`duplicate handoff id ${h.id}`);
    for (const a of h.after) if (!earlier.includes(a)) errors.push(`${h.id}: after names ${a}, which is not an earlier handoff`);
    const expected = expectedSkill(h, tree);
    if (expected.error) errors.push(`${h.id}: ${expected.error}`);
    else if (expected.skill !== h.skill) errors.push(`${h.id}: kind ${h.kind} takes skill ${expected.skill}, not ${h.skill}`);
  });
  return [...errors, ...promptErrors(record.routing, handoffs)];
};

// Handoff id -> target for the record's block, for the matching rule (routed.mjs matches, B-10);
// empty when the record or its block is missing.
export const handoffTargets = (record) => new Map((Array.isArray(record?.block?.handoffs) ? record.block.handoffs : [])
  .filter((h) => typeof h?.id === "string" && typeof h?.target === "string")
  .map((h) => [h.id, h.target]));

// ---------- the record ----------

const HEADER_FIELD = /^\s*(?:[-*+]\s+)?\*\*([^*]+?):\*\*\s*(.*)$/;

// Header fields, several per line when separated by a middle dot ("Lands on ... · Contracts ...").
const headerFields = (lines) => {
  const out = {};
  for (const l of lines) {
    for (const part of l.split("\u00b7")) {
      const m = HEADER_FIELD.exec(part);
      const key = m?.[1].trim().toLowerCase();
      if (m && !(key in out)) out[key] = m[2].trim();
    }
  }
  return out;
};

// "{path or URL} ({authority})"; the authority is the last parenthesized group.
const parseRequest = (v) => {
  if (v == null || v.trim() === "") return { request: null, authority: null };
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(v.trim());
  const [where, authority] = m ? [m[1], m[2].trim()] : [v.trim(), null];
  const link = /^\[[^\]]*\]\(([^)]*)\)$/.exec(where.trim());
  return { request: (link ? link[1] : where).replace(/`/g, "").trim() || null, authority: authority || null };
};

const NAME = /^(\d{4}-\d{2}-\d{2})-intake-(.+)\.md$/;

export const parseIntakeRecord = (text, path) => {
  const ls = toLines(text);
  const hs = headings(ls);
  const title = hs.find((h) => h.level === 1) ?? null;
  const firstH2 = hs.find((h) => h.level === 2 && (!title || h.line > title.line));
  const fields = headerFields(ls.slice(title ? title.line + 1 : 0, firstH2 ? firstH2.line : ls.length));
  const name = basename(path);
  const named = NAME.exec(name);
  const routingHeading = hs.find((h) => h.level === 2 && /^routing\b/i.test(plain(h.text)));
  const routing = routingHeading ? ls.slice(routingHeading.line + 1, sectionEnd(hs, routingHeading, ls.length)).join("\n").trim() : null;
  const { block, error } = parseHandoffBlock(routing ?? "");
  const { request, authority } = parseRequest(fields.request);
  return {
    path,
    slug: named ? named[2] : name.replace(/\.md$/i, ""),
    title: title ? plain(title.text).replace(/^intake\s*:\s*/i, "") : null,
    date: /\d{4}-\d{2}-\d{2}/.exec(fields.date ?? "")?.[0] ?? /^(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? null,
    request,
    authority,
    requestLine: fields.request ?? null,
    headerFields: Object.keys(fields),
    cls: word(fields.class),
    landsOn: listItems(fields["lands on"]),
    contracts: listItems(fields.contracts),
    promotes: listItems(fields.promotes),
    collisions: listItems(fields.collisions),
    status: word(fields.status),
    routing,
    block,
    blockError: error,
  };
};

const newestFirst = (a, b) => cmp(b.date ?? "", a.date ?? "") || cmp(basename(b.path), basename(a.path));

// `{management}/*-intake-*.md`, newest date first, then file name descending.
export const loadIntakeRecords = (repoRoot, layout) => {
  const dir = join(repoRoot, layout.management);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((n) => /-intake-.*\.md$/.test(n) && statSync(join(dir, n)).isFile())
    .map((n) => parseIntakeRecord(readFileSync(join(dir, n), "utf8"), `${layout.management}/${n}`))
    .sort(newestFirst);
};

// The segment's intake record (spec 9.2): the newest whose **Request:** line names the request.
export const segmentRecord = (records, request) =>
  [...records].sort(newestFirst).find((r) => (r.requestLine ?? "").includes(request)) ?? null;

// ---------- cites-superseded (spec 12.2) ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// A baseline version string counts as a whole token: not inside a longer version
// (`v10`, `v1.2`), a word or a contract reference (`order-api@v1` is a contract's version).
const versionRe = (v) => new RegExp(`(?<![A-Za-z0-9_.@-])${escapeRe(v)}(?![A-Za-z0-9_-]|\\.\\d)`);

// `{slug}@v{k}` followed by a character that is not a letter, digit, `_` or `-`, or by the end.
const contractVersionRe = (slug, k) => new RegExp(`(?<![A-Za-z0-9_-])${escapeRe(slug)}@v${k}(?![A-Za-z0-9_-])`);

export const supersededStrings = (config, tree) => {
  const baseline = config?.sources?.baseline ?? [];
  const versions = unique(baseline.map((s) => s.version).filter((v) => typeof v === "string" && v !== ""));
  const contractRefs = [...tree.contracts.entries()].flatMap(([slug, c]) => {
    const n = /^v(\d+)$/.exec(c.version ?? "")?.[1];
    return n === undefined ? [] : Array.from({ length: Number(n) }, (_, k) => contractVersionRe(slug, k));
  });
  return {
    plain: unique(baseline.map((s) => s.path).filter((p) => typeof p === "string" && p !== "")),
    refs: [...versions.map(versionRe), ...contractRefs],
  };
};

export const citesSuperseded = (repoRoot, files, strings) => files.some((rel) => {
  const full = join(repoRoot, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return false;
  const text = readFileSync(full, "utf8");
  return strings.plain.some((s) => text.includes(s)) || strings.refs.some((r) => r.test(text));
});

// ---------- the target's files (spec 12.2) ----------

const TYPE_BY_KIND = {
  contract: "contract", "contract-touch": "contract",
  adr: "adr", "adr-update": "adr",
  "root-spec": "node", "mid-level-spec": "node", graft: "node", promote: "node", "spec-touch": "node",
  "phase-plan": "node", "phase-plan-append": "node",
};

export const targetFiles = (kind, target, layout, tree) => {
  switch (TYPE_BY_KIND[kind] ?? targetType(target, tree)) {
    case "contract":
      return [
        `${layout.contract}/${target}.md`,
        ...(tree.contracts.get(target)?.fixtureFiles ?? []),
        `${layout.contract}/schema/${target}.schema.json`,
      ];
    case "adr": {
      const adr = tree.adrs?.get(target);
      return adr ? [adr.file] : [];
    }
    case "node":
      return [`${layout.spec}/${target}.md`];
    case "list":
      return unique(target.split(",").map((s) => s.trim()).filter(Boolean).map((id) => `${layout.spec}/${id}.md`));
    case "all":
      return [...tree.nodes.values()].filter((n) => n.kind === "leaf-parent" && n.status !== "retired").map((n) => n.file);
    default:
      return [];
  }
};
