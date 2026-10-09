// Extract the checkpoint model from hsdd/management/: the newest progress
// report and execution plan, the atlas, and the chain behind them.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { toLines, headings, sections, tables, column, plain, blocks, sectionName } from "./md.mjs";
import { extractPlan, sha, codingMethod } from "./extract-plan.mjs";

export const HISTORY = 8;
export const STEP_ID = /^([A-Z]{1,2}-(?:\d+|[a-z]))([′″']*)/;
const STEP_IDS = /\b[A-Z]{1,2}-(?:\d+|[a-z])[′″']*(?![\w-])/g;
const MODES = [["\u{1F916}", "delegate"], ["\u{1F91D}", "interactive"], ["\u{1F464}", "human"]];

export function dated(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-/.test(f) && f.endsWith(suffix))
    .sort()
    .reverse();
}

// Newest first. Progress reports end "-progress.md"; plans end
// "execution-plan.md" (older chains used "-hsdd-execution-plan.md").
export function chainFiles(root) {
  const dir = join(root, "hsdd/management");
  return {
    progress: dated(dir, "-progress.md").map((f) => `hsdd/management/${f}`),
    plans: dated(dir, "execution-plan.md").map((f) => `hsdd/management/${f}`),
    atlas: existsSync(join(dir, "atlas.md")) ? "hsdd/management/atlas.md" : null,
  };
}

function read(root, rel) {
  return toLines(readFileSync(join(root, rel), "utf8"));
}

function section(ls, re) {
  return sections(ls, 2).find((s) => re.test(sectionName(s.title))) ?? null;
}

function sub(ls, sec, re) {
  if (!sec) return null;
  return sections(ls, 3, sec.start, sec.end).find((s) => re.test(sectionName(s.title))) ?? null;
}

function boldLead(text) {
  const m = /\*\*(.+?)\*\*/.exec(text);
  return m ? plain(m[1]).replace(/[.:]\s*$/, "") : null;
}

export function modeOf(text) {
  return MODES.find(([e]) => String(text).includes(e))?.[1] ?? null;
}

function stripModes(text) {
  return MODES.reduce((t, [e]) => t.split(e).join(""), String(text)).trim();
}

// "**Date:** x · **Supersedes:** [y](y)" lines before the first "##".
export function headerFields(ls) {
  const first = headings(ls).find((h) => h.level === 2);
  const out = {};
  for (const l of ls.slice(0, first ? first.line : ls.length)) {
    for (const part of l.split(/\s·\s(?=\*\*)/)) {
      const m = /^\s*\*\*([^*]+?):\*\*\s*(.*)$/.exec(part);
      if (m) out[m[1].trim()] = m[2].trim();
    }
  }
  return out;
}

function blocksOf(ls, sec) {
  return sec ? blocks(ls, sec.start, sec.end) : [];
}

function tableIn(ls, sec, ...cols) {
  if (!sec) return null;
  return tables(ls, sec.start, sec.end).find((t) => cols.every((c) => column(t, c) >= 0)) ?? null;
}

function fraction(text) {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(plain(text));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function gateItems(cell) {
  return String(cell)
    .split(/(?=[☑☐])/)
    .filter((p) => /^[☑☐]/.test(p))
    .map((p) => ({ met: p.startsWith("☑"), text: p.slice(1).replace(/^\s*·\s*/, "").replace(/\s*·\s*$/, "").trim() }));
}

export function parseProgress(ls) {
  const header = headerFields(ls);
  const bl = section(ls, /^bottom line/i);
  const blTable = bl ? tables(ls, bl.start, bl.end)[0] ?? null : null;
  const blBlocks = blocksOf(ls, bl).filter((b) => b.type === "p");
  const readBlock = blBlocks.find((b) => /^\*\*the one-sentence read/i.test(b.text)) ?? blBlocks[0] ?? null;

  const ms = section(ls, /^milestone gate status/i);
  const mt = tableIn(ls, ms, "milestone", "gate");
  const milestones = [];
  if (mt) {
    const [cm, cg, cv] = ["milestone", "gate", "movement"].map((n) => column(mt, n));
    const ci = mt.header.length - 1;
    for (const r of mt.rows) {
      const cell = plain(r.cells[cm] ?? "");
      const m = /^(M[\w.\u2013-]*?)(?:\s*·\s*|\s+|$)(.*)$/.exec(cell);
      const rest = m ? m[2] : cell;
      const date = /\(([^)]*)\)\s*$/.exec(rest);
      milestones.push({
        id: m ? m[1] : cell,
        name: rest.replace(/\s*\([^)]*\)\s*$/, "").trim(),
        date: date ? date[1] : null,
        gate: plain(r.cells[cg] ?? ""),
        fraction: fraction(r.cells[cg] ?? ""),
        reached: /reached/i.test(r.cells[cg] ?? ""),
        movement: cv >= 0 ? plain(r.cells[cv] ?? "") : null,
        items: ci !== cg ? gateItems(r.cells[ci] ?? "") : [],
        raw: r.cells.join(" | "),
        line: r.line + 1,
      });
    }
  }
  const trigger = blocksOf(ls, ms).filter((b) => b.type === "ul").flatMap((b) => b.items).map((it) => ({ lead: boldLead(it.text), text: it.text }));

  const done = section(ls, /^what is done/i);
  const doneTable = tableIn(ls, done, "phase");

  const bk = section(ls, /^blockers/i);
  const bkList = blocksOf(ls, bk).find((b) => b.type === "ol");
  const blockers = (bkList?.items ?? []).map((it, i) => ({ rank: i + 1, lead: boldLead(it.text), text: it.text }));

  const fr = section(ls, /^findings register/i);
  const ft = tableIn(ls, fr, "id", "finding");
  const findings = [];
  if (ft) {
    const [ci, cs, ca, cf] = ["id", "sev", "area", "finding"].map((n) => column(ft, n));
    for (const r of ft.rows) findings.push({
      id: plain(r.cells[ci] ?? ""),
      severity: plain(r.cells[cs] ?? "") || null,
      area: ca >= 0 ? plain(r.cells[ca] ?? "") : "",
      lead: boldLead(r.cells[cf] ?? ""),
      text: r.cells[cf] ?? "",
      line: r.line + 1,
    });
  }

  return {
    header,
    bottomLine: blTable ? blTable.rows.map((r) => ({ label: plain(r.cells[0] ?? ""), value: r.cells[1] ?? "" })) : [],
    read: readBlock ? readBlock.text.replace(/^\*\*the one-sentence read:?\*\*:?\s*/i, "") : null,
    milestones,
    trigger,
    done: doneTable ? { header: doneTable.header, rows: doneTable.rows.map((r) => r.cells) } : null,
    doneNotes: blocksOf(ls, done).filter((b) => b.type !== "table"),
    velocity: blocksOf(ls, section(ls, /^velocity/i)),
    blockers,
    findings,
    verdict: blocksOf(ls, section(ls, /^verdict/i)),
    sections: sections(ls, 2).map((s) => sectionName(s.title)),
  };
}

function laneKey(name) {
  return plain(name).replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+lane$/i, "").trim();
}

// A sync section's parts (Entry, Agenda, Exit, Unblocks), marked either by
// "###" headings or by a bold-only line such as "**Agenda**".
function syncParts(ls, sec) {
  const marks = [];
  for (let i = sec.start; i < sec.end; i++) {
    const h = /^###\s+(.*)$/.exec(ls[i]);
    const b = /^\*\*(Entry|Agenda|Exit|Unblocks)\b[^*]*\*\*\s*(.*)$/i.exec(ls[i].trim());
    const name = h ? sectionName(h[1]) : b ? b[1] : null;
    if (name && /^(entry|agenda|exit|unblocks)/i.test(name)) marks.push({ name: name.toLowerCase().match(/^(entry|agenda|exit|unblocks)/)[1], line: i, inline: b ? b[2].trim() : "" });
    else if (h) marks.push({ name: null, line: i, inline: "" });
  }
  const out = {};
  marks.forEach((m, k) => {
    if (m.name && !out[m.name]) out[m.name] = { start: m.line + 1, end: k + 1 < marks.length ? marks[k + 1].line : sec.end, inline: m.inline };
  });
  return { parts: out, first: marks.length ? marks[0].line : sec.end };
}

export function lanesFor(owner, lanes) {
  const o = stripModes(plain(owner)).toLowerCase();
  return lanes.filter((l) => new RegExp(`(^|[^a-z])${l.key.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(o)).map((l) => l.key);
}

function syncId(text) {
  const m = /^sync\s+([^\s·\u2014,(]+)/i.exec(plain(text));
  return m ? m[1] : null;
}

// An Agenda's decisions, in either form: a paragraph led by
// "**D-49 · question?**" (the bold may wrap lines) followed by its options,
// or a table with ID and Decision columns.
function decisions(ls, from, to) {
  const t = tables(ls, from, to).find((x) => column(x, "id") >= 0 && column(x, "decision") >= 0);
  if (t) {
    const [ci, cd, co, cl] = ["id", "decision", "live", "lands"].map((n) => column(t, n));
    return t.rows.map((r) => ({ id: plain(r.cells[ci] ?? ""), question: plain(r.cells[cd] ?? ""), text: co >= 0 ? r.cells[co] ?? "" : "", landsIn: cl >= 0 ? plain(r.cells[cl] ?? "") : null, line: r.line + 1 }));
  }
  const out = [];
  let cur = null;
  for (const b of blocks(ls, from, to)) {
    const m = b.type === "p" ? /^\*\*(D-\d+[′″']*)\s*(?:·|\u2014|-|:)\s*(.*?)\*\*\s*(.*)$/.exec(b.text) : null;
    if (m) {
      cur = { id: m[1], question: plain(m[2]), parts: [m[3]] };
      out.push(cur);
    } else if (cur && b.type === "p") cur.parts.push(b.text);
    else if (cur && (b.type === "ul" || b.type === "ol")) cur.parts.push(b.items.map((it) => `- ${it.text}`).join("\n"));
  }
  return out.map((d) => {
    const text = d.parts.filter(Boolean).join("\n\n");
    const lands = /\*\*Lands in:\*\*\s*([\s\S]*)$/.exec(text);
    return { id: d.id, question: d.question, text: lands ? text.slice(0, lands.index).trim() : text, landsIn: lands ? lands[1].replace(/\s+/g, " ").trim() : null, line: null };
  });
}

export function parsePlan(ls) {
  const header = headerFields(ls);
  const own = section(ls, /^ownership split/i);
  const ownTable = own ? tables(ls, own.start, own.end)[0] ?? null : null;
  const lanes = ownTable ? ownTable.header.slice(1).map((h) => ({ name: plain(h), key: laneKey(h) })) : [];
  const ownership = ownTable ? ownTable.rows.map((r) => ({ label: plain(r.cells[0] ?? ""), cells: r.cells.slice(1) })) : [];

  const cs = section(ls, /^current state/i);
  const currentState = blocksOf(ls, cs).filter((b) => b.type === "ul").flatMap((b) => b.items.map((it) => it.text));

  const sp = section(ls, /^sync points/i);
  const spTable = tableIn(ls, sp, "sync");
  const points = spTable ? spTable.rows.map((r) => ({ id: syncId(r.cells[0]) ?? plain(r.cells[0]).replace(/\s*\(.*\)\s*$/, ""), name: plain(r.cells[0]), when: plain(r.cells[column(spTable, "when")] ?? ""), who: column(spTable, "who") >= 0 ? plain(r.cells[column(spTable, "who")] ?? "") : "", agenda: r.cells[r.cells.length - 1] ?? "" })) : [];

  const syncs = [];
  for (const s of sections(ls, 2).filter((x) => /^sync\s+\S/i.test(sectionName(x.title)) && !/^sync points/i.test(sectionName(x.title)))) {
    const id = syncId(s.title);
    const { parts, first } = syncParts(ls, s);
    const items = (sec) => blocksOf(ls, sec).filter((b) => b.type === "ul").flatMap((b) => b.items);
    const why = blocks(ls, s.start, first).find((b) => b.type === "p" && /why it gates/i.test(b.text));
    syncs.push({
      id,
      title: plain(s.title),
      gating: /gating/i.test(s.title),
      why: why ? why.text : null,
      entry: items(parts.entry),
      decisions: parts.agenda ? decisions(ls, parts.agenda.start, parts.agenda.end) : [],
      exit: items(parts.exit),
      unblocks: items(parts.unblocks).length
        ? items(parts.unblocks).map((it) => ({ lane: boldLead(it.text), text: it.text.replace(/^\*\*[^*]+\*\*:?\s*/, "") }))
        : [parts.unblocks?.inline, ...blocksOf(ls, parts.unblocks).filter((b) => b.type === "p").map((b) => b.text)].filter(Boolean).map((text) => ({ lane: null, text })),
      line: s.line + 1,
    });
  }

  const steps = [];
  const waivers = [];
  const skippedTables = [];
  const hs = headings(ls);
  for (const t of tables(ls)) {
    const titleOf = () => plain([...hs].reverse().find((h) => h.line < t.line)?.text ?? "");
    if (column(t, "id") >= 0 && column(t, "owner") >= 0 && column(t, "action") >= 0) {
      const [ci, co, ca, cd, cf] = ["id", "owner", "action", "depends", "finding"].map((n) => column(t, n));
      const last = t.header.length - 1;
      for (const r of t.rows) {
        const id = plain(r.cells[ci] ?? "");
        const doneCell = r.cells[last] ?? "";
        steps.push({
          id,
          owner: stripModes(plain(r.cells[co] ?? "")),
          mode: modeOf(r.cells[co] ?? ""),
          lanes: [],
          action: r.cells[ca] ?? "",
          depends: cd >= 0 ? r.cells[cd] ?? "" : "",
          findings: cf >= 0 ? [...new Set(plain(r.cells[cf] ?? "").match(/\b[A-Z]{1,2}-\d+\b/g) ?? [])] : [],
          done: /☑|\[x\]/i.test(doneCell) ? true : /☐|\[ \]/.test(doneCell) ? false : null,
          group: titleOf(),
          line: r.line + 1,
        });
      }
    } else if (column(t, "finding") >= 0 && column(t, "disposition") >= 0) {
      for (const r of t.rows) waivers.push({ finding: plain(r.cells[column(t, "finding")] ?? ""), text: r.cells[column(t, "disposition")] ?? "", line: r.line + 1 });
    } else if (column(t, "id") >= 0 && t.rows.some((r) => STEP_ID.test(plain(r.cells[0] ?? "")))) {
      const missing = [column(t, "owner") < 0 ? "Owner" : null, column(t, "action") < 0 ? "Action" : null].filter(Boolean);
      skippedTables.push({ line: t.line + 1, missing: missing.join(" and ") });
    }
  }
  // With no ownership table, single-word owners name the lanes.
  if (!lanes.length) for (const k of [...new Set(steps.map((x) => x.owner).filter((o) => /^[A-Za-z]+$/.test(o) && !/^(both|all)$/i.test(o)))]) lanes.push({ name: k, key: k });
  for (const st of steps) st.lanes = lanesFor(st.owner, lanes);

  const sd = section(ls, /^step details/i);
  const details = [];
  if (sd) {
    for (const h of sections(ls, 3, sd.start, sd.end)) {
      const t = plain(h.title);
      const m = STEP_ID.exec(t);
      if (!m) continue;
      const bs = blocks(ls, h.start, h.end);
      const find = (re) => bs.findIndex((b) => b.type === "p" && re.test(b.text));
      const after = (re) => {
        const k = find(re);
        return k < 0 ? null : bs[k].text.replace(re, "").trim() || null;
      };
      const pk = find(/^\*\*Prompt/i);
      const prompt = pk >= 0 ? bs.slice(pk + 1).find((b) => b.type === "code")?.text ?? null : bs.find((b) => b.type === "code")?.text ?? null;
      const dk = find(/^\*\*Do:?\*\*/i);
      const owner = /\(([^)]*)\)\s*$/.exec(t);
      details.push({
        id: m[1] + m[2],
        title: stripModes(t.slice(m[0].length).replace(/^\s*(·|\u2014|-)\s*/, "").replace(/\s*\([^)]*\)\s*$/, "")).trim(),
        mode: modeOf(h.title),
        owner: owner ? owner[1] : null,
        prompt,
        validate: after(/^\*(?:\*)?Validate:?\*(?:\*)?:?/i),
        why: after(/^\*\*Why:?\*\*:?/i),
        do: dk >= 0 && bs[dk + 1]?.type === "ul" ? bs[dk + 1].items : [],
        doneWhen: after(/^\*\*Done when:?\*\*:?/i),
        body: bs,
        line: h.line + 1,
      });
    }
  }

  const et = section(ls, /^external tracks/i);
  const etTable = et ? tables(ls, et.start, et.end)[0] ?? null : null;
  const tl = section(ls, /^timeline/i);
  const tlTable = tl ? tables(ls, tl.start, tl.end)[0] ?? null : null;
  return {
    header,
    lanes,
    ownership,
    currentState,
    syncPoints: points,
    syncs,
    steps,
    waivers,
    skippedTables,
    details,
    externalTracks: etTable ? { header: etTable.header, rows: etTable.rows.map((r) => r.cells) } : null,
    timeline: tlTable ? { header: tlTable.header, rows: tlTable.rows.map((r) => r.cells) } : null,
    timelineNotes: blocksOf(ls, tl).filter((b) => b.type === "p"),
    sections: sections(ls, 2).map((s) => sectionName(s.title)),
  };
}

export function parseAtlas(ls) {
  const t = tables(ls).find((x) => column(x, "node") >= 0 && column(x, "done") >= 0);
  if (!t) return [];
  const [cn, cl, cd, cr] = ["node", "live", "done", "planned"].map((n) => column(t, n));
  return t.rows
    .map((r) => ({ node: plain(r.cells[cn] ?? ""), live: Number(plain(r.cells[cl] ?? "").match(/\d+/)?.[0] ?? NaN), done: Number(plain(r.cells[cd] ?? "").match(/\d+/)?.[0] ?? NaN), warn: /⚠/.test(r.cells[cd] ?? ""), remaining: cr >= 0 ? r.cells[cr] ?? "" : "", line: r.line + 1 }))
    .filter((r) => !/^total$/i.test(r.node));
}

function idsIn(text, known) {
  return [...new Set((String(text).match(STEP_IDS) ?? []).filter((x) => known.has(x)))];
}

// The chain is read whole or reported: a progress report or plan the chain
// does not read, and a date shared by two files of one kind.
function chainProblems(root, chain) {
  const dir = join(root, "hsdd/management");
  const prefix = "hsdd/management/";
  const known = new Set([...chain.progress, ...chain.plans].map((f) => f.slice(prefix.length)));
  const out = [];
  const stray = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "atlas.md" && /progress|execution-plan/i.test(f) && !known.has(f)) : [];
  for (const name of stray) out.push({ path: "/history", file: `${prefix}${name}`, line: 1, reason: `"${name}" looks like a progress report or execution plan, but only YYYY-MM-DD-progress.md and YYYY-MM-DD-execution-plan.md names are read; rename it and extract again, or move it out of hsdd/management/` });
  for (const [kind, files] of [["progress report", chain.progress], ["execution plan", chain.plans]]) {
    const byDate = new Map();
    for (const f of files) {
      const name = f.slice(prefix.length);
      const date = name.slice(0, 10);
      byDate.set(date, [...(byDate.get(date) ?? []), name]);
    }
    for (const [date, names] of byDate) {
      for (const b of names.slice(1)) out.push({ path: "/history", file: `${prefix}${b}`, line: 1, reason: `two ${kind} files share the date ${date} (${names[0]}, ${b}); keep one and extract again` });
    }
  }
  return out;
}

export function extractCheckpoint(root, { specSha = "n/a" } = {}) {
  const chain = chainFiles(root);
  const unparsed = [];
  unparsed.push(...chainProblems(root, chain));
  const facts = {};
  if (!chain.progress.length || !chain.plans.length) throw new Error("extract checkpoint: hsdd/management/ holds no dated progress report and execution plan");
  const progressFile = chain.progress[0];
  const planFile = chain.plans[0];
  const pls = read(root, progressFile);
  const progress = parseProgress(pls);
  const { skippedTables, ...plan } = parsePlan(read(root, planFile));

  const heads = headings(pls).map((h) => h.text);
  const requiredHeads = [
    [/verdict/i, "/progress/verdict", "the newest progress report has no Verdict heading the extractor can read; fill the verdict from the report"],
    [/blockers/i, "/progress/blockers", "the newest progress report has no Blockers heading the extractor can read; fill the blockers from the report, or [] if it has none"],
    [/findings/i, "/progress/findings", "the newest progress report has no Findings register heading the extractor can read; fill the findings from the report, or [] if it has none"],
  ];
  for (const [re, path, reason] of requiredHeads) if (!heads.some((t) => re.test(t))) unparsed.push({ path, file: progressFile, line: 1, reason });
  if (!plan.steps.length) unparsed.push({ path: "/plan/steps", file: planFile, line: 1, reason: "the newest execution plan has no step table the extractor can read (a table with ID, Owner and Action columns); fill the steps from the plan" });
  for (const t of skippedTables) unparsed.push({ path: "/plan/steps", file: planFile, line: t.line, reason: `the table at line ${t.line} lists step ids but has no ${t.missing} column; add its steps from the plan` });

  const tree = extractPlan(root, { specSha });
  const nodeIds = new Set(tree.nodes.map((n) => n.id));
  const rootId = tree.project.root;
  const full = (short) => (nodeIds.has(short) ? short : nodeIds.has(`${rootId}.${short}`) ? `${rootId}.${short}` : null);

  plan.steps.forEach((s, i) => {
    if (!s.lanes.length) unparsed.push({ path: `/plan/steps/${i}/lanes`, file: planFile, line: s.line, reason: `owner "${s.owner}" names no lane in the ownership split (${plan.lanes.map((l) => l.key).join(", ")})` });
  });
  progress.milestones.forEach((m, i) => {
    if (!m.fraction && !m.reached) unparsed.push({ path: `/progress/milestones/${i}/fraction`, file: progressFile, line: m.line, reason: `gate "${m.gate}" states no met/total` });
  });
  const atlas = chain.atlas ? parseAtlas(read(root, chain.atlas)) : [];
  atlas.forEach((a, i) => {
    const id = full(a.node);
    if (id) a.node = id;
    else unparsed.push({ path: `/atlas/${i}/node`, file: chain.atlas, line: a.line, reason: `atlas row "${a.node}" names no node in hsdd/spec/` });
  });

  // The chain behind the heads, newest first, bounded.
  const history = {
    progress: chain.progress.slice(0, HISTORY).map((f) => {
      const p = f === progressFile ? progress : parseProgress(read(root, f));
      return { file: f, findings: p.findings.map((x) => x.id), gates: Object.fromEntries(p.milestones.map((m) => [m.id, m.fraction])) };
    }),
    plans: chain.plans.slice(0, HISTORY).map((f) => {
      const p = f === planFile ? plan : parsePlan(read(root, f));
      return { file: f, open: p.steps.filter((s) => s.done !== true).map((s) => s.id), done: p.steps.filter((s) => s.done === true).map((s) => s.id) };
    }),
  };

  facts["cp:verdict"] = sha(JSON.stringify(progress.verdict));
  for (const m of progress.milestones) facts[`cp:milestone:${m.id}`] = sha(m.raw);
  for (const b of progress.blockers) facts[`cp:blocker:${b.rank}`] = sha(b.text);

  const stepIds = new Set(plan.steps.map((s) => s.id));
  for (const b of progress.blockers) {
    b.findings = [...new Set(b.text.match(/\b[A-Z]{1,2}-\d+\b/g) ?? [])].filter((id) => progress.findings.some((f) => f.id === id));
    b.steps = idsIn(b.text, stepIds);
  }

  const phaseShort = tree.phases.flatMap((p) => [p.heading, `${p.node.split(".").pop()}.${p.n}`, p.id.slice(rootId.length + 1)]);
  const nodeShort = tree.nodes.map((n) => n.id.slice(rootId.length + 1)).filter(Boolean);
  const ids = [...new Set([
    ...tree.ids, ...phaseShort, ...nodeShort, ...stepIds, ...progress.findings.map((f) => f.id),
    ...plan.syncs.flatMap((s) => s.decisions.map((d) => d.id)),
    ...(plan.externalTracks?.rows ?? []).map((r) => /\bE-\d+\b/.exec(r[0] ?? "")?.[0]).filter(Boolean),
  ])].filter((x) => x && x.length > 1);

  return {
    kind: "checkpoint",
    schemaVersion: 1,
    project: { root: rootId, name: tree.project.name, specSha, codingMethod: tree.project.codingMethod, date: /(\d{4}-\d{2}-\d{2})/.exec(progressFile)[1] },
    files: { progress: progressFile, plan: planFile, atlas: chain.atlas, chain: [...new Set([...history.progress.map((h) => h.file), ...history.plans.map((h) => h.file)])] },
    tree: tree.nodes.map((n) => ({ id: n.id, name: n.name, parent: n.parent, children: n.children, kind: n.kind, status: n.status })),
    progress,
    plan,
    atlas,
    history,
    ids,
    facts,
    unparsed,
  };
}
