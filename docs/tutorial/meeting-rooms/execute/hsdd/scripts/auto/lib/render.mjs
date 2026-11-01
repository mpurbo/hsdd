// Slot rendering (spec 13.2). A slot is `{name}` with lower-case letters and underscores;
// `{{name}}` renders as `{name}`; any other brace text is written as it stands. A fill is rendered
// once against the same fills before insertion, and a slot in the fill's own output stays.

const TOKEN = /\{\{([a-z_]+)\}\}|\{([a-z_]+)\}/g;

export class RenderError extends Error {
  constructor(slots) {
    super(`no fill for slot${slots.length === 1 ? "" : "s"} ${slots.map((s) => `{${s}}`).join(", ")}`);
    this.name = "RenderError";
    this.slots = slots;
  }
}

const has = (fills, name) => Object.hasOwn(fills, name) && fills[name] != null;

// Slot names of a template, distinct, in order of first appearance; doubled braces are not slots.
export const slotNames = (template) => [...new Set([...template.matchAll(TOKEN)].filter((m) => m[2] !== undefined).map((m) => m[2]))];

// One pass: slots become `lookup(name)`, doubled braces become single.
const pass = (text, lookup) => text.replace(TOKEN, (_, doubled, name) => (doubled !== undefined ? `{${doubled}}` : lookup(name)));

export const renderTemplate = (template, fills) => {
  const missing = new Set();
  const rendered = new Map();
  const fillOf = (name) => {
    if (!has(fills, name)) { missing.add(name); return ""; }
    if (!rendered.has(name)) {
      // The fill's own slots take the raw fills; what comes out is not rendered again.
      rendered.set(name, pass(String(fills[name]), (inner) => {
        if (!has(fills, inner)) { missing.add(inner); return ""; }
        return String(fills[inner]);
      }));
    }
    return rendered.get(name);
  };
  const out = pass(template, fillOf);
  if (missing.size > 0) throw new RenderError([...missing]);
  return out;
};
