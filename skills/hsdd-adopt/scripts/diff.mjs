const list = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);

// Reads back what render.mjs writes. Returns null when there is no section.
export function parseObservedSurface(markdown) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^##\s+Observed surface\s*$/.test(l));
  if (start < 0) return null;
  const out = {
    extracted: { date: "", sha: "" },
    modules: [],
    routes: { count: 0, samples: [] },
    tables: [],
    topics: { produces: [], consumes: [] },
    owners: [],
    unknown: [],
  };
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const m = /^-\s+([a-z]+):\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "extracted") {
      const e = /^(\S+)\s*@\s*(\S+)/.exec(value);
      if (e) out.extracted = { date: e[1], sha: e[2] };
    } else if (key === "modules") {
      out.modules = value === "none found" ? [] : list(value).map((s) => s.replace(/\/$/, ""));
    } else if (key === "routes") {
      const r = /^(\d+)(?:\s*\((.*)\))?/.exec(value);
      if (r) out.routes = { count: Number(r[1]), samples: r[2] ? list(r[2]).filter((s) => s !== "...") : [] };
    } else if (key === "tables") {
      out.tables = value === "none found" ? [] : list(value);
    } else if (key === "topics") {
      for (const part of value.split(";")) {
        const t = /^\s*(produces|consumes)\s+(.*)$/.exec(part);
        if (t) out.topics[t[1]] = list(t[2]);
      }
    } else if (key === "owners") {
      out.owners = value === "no CODEOWNERS" || value === "none found" ? [] : list(value);
    } else if (key === "unknown") {
      if (value && !value.startsWith("(fill in")) out.unknown.push(value);
    }
  }
  return out;
}

const sorted = (xs) => [...new Set(xs)].sort();

function setDiff(field, before, after) {
  const b = new Set(before);
  const a = new Set(after);
  return [
    ...sorted(after).filter((x) => !b.has(x)).map((value) => ({ field, kind: "added", value })),
    ...sorted(before).filter((x) => !a.has(x)).map((value) => ({ field, kind: "removed", value })),
  ];
}

// "extracted" and "unknown" are never compared.
export function diffSurface(recorded, model) {
  const count = model.routes.length;
  return [
    ...setDiff("modules", recorded.modules, model.modules.map((m) => m.path)),
    ...(recorded.routes.count === count ? [] : [{ field: "routes.count", kind: "changed", value: `${recorded.routes.count} -> ${count}` }]),
    ...setDiff("tables", recorded.tables, model.migrations.tables),
    ...setDiff("topics.produces", recorded.topics.produces, model.topics.produces.map((t) => t.topic)),
    ...setDiff("topics.consumes", recorded.topics.consumes, model.topics.consumes.map((t) => t.topic)),
    ...setDiff("owners", recorded.owners, model.owners.flatMap((o) => o.owners)),
  ];
}
