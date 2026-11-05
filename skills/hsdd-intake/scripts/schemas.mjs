function kindOf(path) {
  const name = path.split("/").pop();
  if (/\.proto$/.test(name)) return "proto";
  if (/\.(ya?ml|json)$/.test(name) && /openapi|swagger/i.test(name)) return "openapi";
  if (/\.(graphqls?|gql)$/.test(name)) return "graphql";
  if (/\.avsc$/.test(name)) return "avro";
  if (/\.schema\.json$/.test(name)) return "json-schema";
  return null;
}

export function schemas(files) {
  return files.map((path) => ({ path, kind: kindOf(path) })).filter((s) => s.kind).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
