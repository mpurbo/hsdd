// A JSON Schema validator for the keywords hsdd-summary's schemas use:
// type, enum, const, required, properties, additionalProperties (boolean or
// schema), items, minItems, pattern, minLength, minimum, $ref to "#/$defs/...".
// Returns a list of "path: message" strings; empty means valid.

const TYPES = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

const KNOWN = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "type", "enum", "const",
  "required", "properties", "additionalProperties", "items", "minItems", "pattern", "minLength", "minimum",
]);

export function validate(schema, value) {
  const errors = [];
  walk(schema, value, "", schema, errors);
  return errors;
}

function walk(s, v, path, root, errors) {
  for (const k of Object.keys(s)) if (!KNOWN.has(k)) throw new Error(`schema keyword "${k}" at ${path || "/"} is not supported`);
  if (s.$ref) {
    const m = /^#\/\$defs\/(.+)$/.exec(s.$ref);
    if (!m || !root.$defs?.[m[1]]) throw new Error(`unresolvable $ref ${s.$ref}`);
    return walk(root.$defs[m[1]], v, path, root, errors);
  }
  const at = path || "/";
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => TYPES[t](v))) {
      errors.push(`${at}: expected ${types.join(" or ")}, got ${v === null ? "null" : Array.isArray(v) ? "array" : typeof v}`);
      return;
    }
  }
  if ("const" in s && v !== s.const) errors.push(`${at}: must be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(v)) errors.push(`${at}: ${JSON.stringify(v)} is not one of ${s.enum.map((x) => JSON.stringify(x)).join(", ")}`);
  if (typeof v === "string") {
    if (s.pattern && !new RegExp(s.pattern).test(v)) errors.push(`${at}: ${JSON.stringify(v)} does not match ${s.pattern}`);
    if (s.minLength !== undefined && v.length < s.minLength) errors.push(`${at}: shorter than ${s.minLength}`);
  }
  if (typeof v === "number" && s.minimum !== undefined && v < s.minimum) errors.push(`${at}: below ${s.minimum}`);
  if (TYPES.object(v)) {
    for (const r of s.required ?? []) if (!(r in v)) errors.push(`${at}: missing required "${r}"`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in v) walk(sub, v[k], `${path}/${k}`, root, errors);
    if (s.additionalProperties !== undefined && s.additionalProperties !== true) {
      for (const k of Object.keys(v)) {
        if (s.properties && k in s.properties) continue;
        if (s.additionalProperties === false) errors.push(`${at}: unexpected property "${k}"`);
        else walk(s.additionalProperties, v[k], `${path}/${k}`, root, errors);
      }
    }
  }
  if (Array.isArray(v) && s.minItems !== undefined && v.length < s.minItems) errors.push(`${at}: fewer than ${s.minItems} item(s)`);
  if (Array.isArray(v) && s.items) v.forEach((x, i) => walk(s.items, x, `${path}/${i}`, root, errors));
}
