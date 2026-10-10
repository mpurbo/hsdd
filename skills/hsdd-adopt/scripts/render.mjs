const uniqSorted = (xs) => [...new Set(xs)].sort();

export function renderObservedSurface(model, { script = "hsdd/scripts/seams/extract-seams.mjs" } = {}) {
  const mods = model.modules.map((m) => `${m.path}/`);
  const samples = model.routes.slice(0, 5).map((r) => `${r.method} ${r.path}`);
  if (model.routes.length > 5) samples.push("...");
  const tables = model.migrations.tables;
  const produces = uniqSorted(model.topics.produces.map((t) => t.topic));
  const consumes = uniqSorted(model.topics.consumes.map((t) => t.topic));
  const topicParts = [];
  if (produces.length) topicParts.push(`produces ${produces.join(", ")}`);
  if (consumes.length) topicParts.push(`consumes ${consumes.join(", ")}`);
  const owners = uniqSorted(model.owners.flatMap((o) => o.owners));
  return [
    "## Observed surface",
    "",
    `- extracted: ${model.date} @ ${model.sha}  (${script})`,
    `- modules: ${mods.length ? mods.join(", ") : "none found"}`,
    `- routes: ${model.routes.length}${samples.length ? `  (${samples.join(", ")})` : ""}`,
    `- tables: ${tables.length ? tables.join(", ") : "none found"}`,
    `- topics: ${topicParts.length ? topicParts.join("; ") : "none found"}`,
    `- owners: ${owners.length ? owners.join(", ") : model.ownersFile ? "none found" : "no CODEOWNERS"}`,
    "- unknown: (fill in, one line per item: what tooling could not see; a node with none is a node nobody looked at)",
    "",
  ].join("\n");
}
