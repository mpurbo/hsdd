// Minimal YAML-subset frontmatter parser: scalars, inline [a, b] lists, and
// block "- item" lists. Strips surrounding quotes and trailing " # comments".
// Pure: string in, data out.

const dequote = (s) => s.replace(/^["']|["']$/g, "");
const stripComment = (s) => s.replace(/\s+#.*$/, "").trim();

export function parseFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const data = {};
  let key = null;
  for (const raw of text.slice(3, end).split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = raw.match(/^\s*-\s+(.*)$/);
    if (item && Array.isArray(data[key])) {
      data[key].push(dequote(stripComment(item[1])));
      continue;
    }
    const kv = raw.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const val = stripComment(kv[2]);
    if (val === "") { data[key] = []; }                     // block list follows
    else if (val.startsWith("[")) {                         // inline list
      data[key] = val.replace(/^\[|\]$/g, "").split(",").map((s) => dequote(s.trim())).filter(Boolean);
    } else { data[key] = dequote(val); }
  }
  const bodyStart = text.indexOf("\n", end + 4);
  return { data, body: bodyStart === -1 ? "" : text.slice(bodyStart + 1) };
}

// "auth-token@v1" -> { id: "auth-token", version: "v1" }
export function parseIdVersion(ref) {
  const at = ref.lastIndexOf("@");
  if (at === -1) return { id: ref, version: null };
  return { id: ref.slice(0, at), version: ref.slice(at + 1) };
}
