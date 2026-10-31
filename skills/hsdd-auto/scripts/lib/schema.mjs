// JSON Schema subset validator (spec 6.1). Zero dependencies.
// Keywords: type, enum, pattern, required, properties, additionalProperties,
// items, minItems, minLength, minimum, $ref. Everything else is ignored.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const DIR = fileURLToPath(new URL("../schema/", import.meta.url));
const cache = new Map();

export function loadSchema(name) {
  if (!cache.has(name)) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`invalid schema name ${name}`);
    cache.set(name, JSON.parse(readFileSync(join(DIR, `${name}.schema.json`), "utf8")));
  }
  return cache.get(name);
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const typeOf = (v) =>
  v === null ? ["null"]
  : Array.isArray(v) ? ["array"]
  : typeof v === "number" ? (Number.isInteger(v) ? ["number", "integer"] : ["number"])
  : [typeof v];

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
};

const key = (path, k) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`);

// ctx: { root: the schema document whose $defs are in scope }
function resolveRef(ref, ctx) {
  const [file, pointer] = ref.split("#");
  const root = file ? loadSchema(file.replace(/\.schema\.json$/, "")) : ctx.root;
  const m = /^\/\$defs\/([A-Za-z0-9_-]+)$/.exec(pointer ?? "");
  if (!m || !root.$defs || !Object.hasOwn(root.$defs, m[1])) throw new Error(`unresolvable $ref ${ref}`);
  return { schema: root.$defs[m[1]], ctx: { root } };
}

function check(schema, value, path, ctx, errs) {
  if (schema.$ref !== undefined) {
    const r = resolveRef(schema.$ref, ctx);
    check(r.schema, value, path, r.ctx, errs);
  }
  if (schema.type !== undefined) {
    const want = Array.isArray(schema.type) ? schema.type : [schema.type];
    const have = typeOf(value);
    if (!want.some((t) => have.includes(t))) {
      errs.push(`${path}: expected type ${want.join(" or ")}`);
      return;
    }
  }
  if (schema.enum !== undefined && !schema.enum.some((e) => deepEqual(e, value))) {
    errs.push(`${path}: expected one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  if (typeof value === "string") {
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) {
      errs.push(`${path}: does not match pattern ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && [...value].length < schema.minLength) {
      errs.push(`${path}: expected at least ${schema.minLength} characters`);
    }
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errs.push(`${path}: expected a number at least ${schema.minimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errs.push(`${path}: expected at least ${schema.minItems} items`);
    }
    if (schema.items !== undefined) value.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, ctx, errs));
  }
  if (isPlainObject(value)) {
    for (const r of schema.required ?? []) {
      if (!Object.hasOwn(value, r)) errs.push(`${path}: missing required property ${r}`);
    }
    const props = schema.properties ?? {};
    for (const k of Object.keys(value)) {
      if (Object.hasOwn(props, k)) check(props[k], value[k], key(path, k), ctx, errs);
      else if (schema.additionalProperties === false) errs.push(`${path}: unexpected property ${k}`);
      else if (isPlainObject(schema.additionalProperties)) check(schema.additionalProperties, value[k], key(path, k), ctx, errs);
    }
  }
}

export function validate(name, value, def) {
  const root = loadSchema(name);
  let schema = root;
  if (def !== undefined) {
    if (!root.$defs || !Object.hasOwn(root.$defs, def)) throw new Error(`schema ${name} has no $defs/${def}`);
    schema = root.$defs[def];
  }
  const errs = [];
  check(schema, value, "$", { root }, errs);
  return errs;
}
