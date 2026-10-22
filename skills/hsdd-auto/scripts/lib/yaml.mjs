// The YAML subset of spec §5.2, plus nested block constructs (A-6).
// Accepts: block mappings and sequences (items may be compact "- key: value"
// mappings), flow sequences and mappings, plain, single- and double-quoted
// one-line scalars, integers, true/false/null, and # comments.
// Rejects, naming the line: anchors, aliases, tags, multi-line scalars,
// multiple documents, tabs in indentation, duplicate keys.

export class YamlError extends Error {
  constructor(line, reason) {
    super(`line ${line}: ${reason}`);
    this.name = "YamlError";
    this.line = line;
  }
}

const fail = (n, reason) => { throw new YamlError(n, reason); };

// ---------- reading ----------

const INT_RE = /^-?\d+$/;

const typed = (t) => {
  if (INT_RE.test(t) && Number.isSafeInteger(Number(t))) return Number(t) === 0 ? 0 : Number(t);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  return t;
};

const setKey = (obj, key, value) =>
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });

const tokenize = (text, offset) => {
  const lines = [];
  text.split("\n").forEach((raw0, i) => {
    const raw = raw0.endsWith("\r") ? raw0.slice(0, -1) : raw0;
    const n = i + 1 + offset;
    if (/^[ \t]*$/.test(raw)) return;
    const lead = /^[ \t]*/.exec(raw)[0];
    if (lead.includes("\t")) fail(n, "tab in indentation (indentation is spaces only)");
    const content = raw.slice(lead.length);
    if (content.startsWith("#")) return;
    if (lead.length === 0 && (content === "---" || content.startsWith("--- ") || content === "...")) {
      fail(n, "multiple documents are not supported");
    }
    lines.push({ n, indent: lead.length, text: content });
  });
  return lines;
};

const commentFree = (s) => {
  const m = /(^|\s)#/.exec(s);
  return m ? s.slice(0, m.index) : s;
};

const isSeqItem = (t) => t === "-" || t.startsWith("- ");

const parseQuoted = (s, i, n) => {
  const q = s[i];
  let out = "";
  let j = i + 1;
  if (q === "'") {
    while (j < s.length) {
      if (s[j] === "'") {
        if (s[j + 1] === "'") { out += "'"; j += 2; continue; }
        return { value: out, end: j + 1 };
      }
      out += s[j++];
    }
    return fail(n, "unterminated single-quoted scalar");
  }
  while (j < s.length) {
    const c = s[j];
    if (c === "\"") return { value: out, end: j + 1 };
    if (c !== "\\") { out += c; j++; continue; }
    const e = s[j + 1];
    if (e === "\"" || e === "\\") out += e;
    else if (e === "n") out += "\n";
    else if (e === "t") out += "\t";
    else if (e === "u") {
      const hex = s.slice(j + 2, j + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail(n, "invalid \\u escape");
      out += String.fromCharCode(parseInt(hex, 16));
      j += 4;
    } else fail(n, `unsupported escape \\${e ?? ""}`);
    j += 2;
  }
  return fail(n, "unterminated double-quoted scalar");
};

const skipWs = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };

const rejectIndicator = (c, n) => {
  if (c === "&") fail(n, "anchors are not supported");
  if (c === "*") fail(n, "aliases are not supported");
  if (c === "!") fail(n, "tags are not supported");
};

const parseFlowScalar = (s, i, n) => {
  const c = s[i];
  if (c === "\"" || c === "'") return parseQuoted(s, i, n);
  rejectIndicator(c, n);
  let j = i;
  while (j < s.length && !",]}".includes(s[j])) j++;
  const t = s.slice(i, j).trim();
  if (t === "") fail(n, "empty item in flow collection");
  if (/:(\s|$)/.test(t)) fail(n, "plain scalar in a flow collection contains ': '; quote it");
  return { value: typed(t), end: j };
};

const parseFlowValue = (s, i0, n) => {
  let i = skipWs(s, i0);
  if (i >= s.length) fail(n, "unterminated flow collection");
  if (s[i] === "[") {
    const out = [];
    i++;
    for (;;) {
      i = skipWs(s, i);
      if (i >= s.length) fail(n, "unterminated flow sequence");
      if (s[i] === "]") return { value: out, end: i + 1 };
      const r = parseFlowValue(s, i, n);
      out.push(r.value);
      i = skipWs(s, r.end);
      if (s[i] === ",") i++;
      else if (s[i] !== "]") fail(n, i >= s.length ? "unterminated flow sequence" : "expected ',' or ']' in flow sequence");
    }
  }
  if (s[i] === "{") {
    const out = {};
    i++;
    for (;;) {
      i = skipWs(s, i);
      if (i >= s.length) fail(n, "unterminated flow mapping");
      if (s[i] === "}") return { value: out, end: i + 1 };
      let key;
      if (s[i] === "\"" || s[i] === "'") {
        const k = parseQuoted(s, i, n);
        key = k.value;
        i = k.end;
      } else {
        rejectIndicator(s[i], n);
        let j = i;
        while (j < s.length && !",}]".includes(s[j]) && !(s[j] === ":" && (j + 1 >= s.length || /[\s,}]/.test(s[j + 1])))) j++;
        key = s.slice(i, j).trim();
        if (key === "") fail(n, "empty key in flow mapping");
        i = j;
      }
      i = skipWs(s, i);
      if (s[i] !== ":") fail(n, i >= s.length ? "unterminated flow mapping" : "expected ':' in flow mapping");
      if (Object.hasOwn(out, key)) fail(n, `duplicate key '${key}'`);
      i = skipWs(s, i + 1);
      if (i >= s.length) fail(n, "unterminated flow mapping");
      if (s[i] === "," || s[i] === "}") setKey(out, key, null);
      else {
        const r = parseFlowValue(s, i, n);
        setKey(out, key, r.value);
        i = r.end;
      }
      i = skipWs(s, i);
      if (s[i] === ",") i++;
      else if (s[i] !== "}") fail(n, i >= s.length ? "unterminated flow mapping" : "expected ',' or '}' in flow mapping");
    }
  }
  return parseFlowScalar(s, i, n);
};

const afterValue = (s, i, n) => {
  const j = skipWs(s, i);
  if (j >= s.length) return;
  if (s[j] === "#" && j > i) return;
  fail(n, "unexpected content after value");
};

const parseInline = (s, n) => {
  const c = s[0];
  rejectIndicator(c, n);
  if (c === "|" || c === ">") fail(n, "multi-line scalars are not supported");
  if (c === "[" || c === "{") {
    const r = parseFlowValue(s, 0, n);
    afterValue(s, r.end, n);
    return r.value;
  }
  if (c === "\"" || c === "'") {
    const r = parseQuoted(s, 0, n);
    afterValue(s, r.end, n);
    return r.value;
  }
  const t = commentFree(s).trimEnd();
  if (/:(\s|$)/.test(t)) fail(n, "plain scalar contains ': '; quote it");
  return typed(t);
};

const keyColon = (s) => {
  const m = /:(\s|$)/.exec(commentFree(s));
  return m ? m.index : -1;
};

const looksLikeKey = (rest) => {
  const c = rest[0];
  if (c === "[" || c === "{") return false;
  if (c === "\"" || c === "'") {
    try {
      const { end } = parseQuoted(rest, 0, 0);
      return rest[end] === ":" && (end + 1 >= rest.length || rest[end + 1] === " ");
    } catch { return false; }
  }
  return keyColon(rest) >= 0;
};

const splitKey = (l) => {
  const t = l.text;
  if (t[0] === "\"" || t[0] === "'") {
    const { value, end } = parseQuoted(t, 0, l.n);
    if (t[end] !== ":" || !(end + 1 >= t.length || t[end + 1] === " ")) fail(l.n, "expected 'key: value'");
    return { key: value, rest: t.slice(end + 1).trim() };
  }
  rejectIndicator(t[0], l.n);
  const idx = keyColon(t);
  if (idx < 0) fail(l.n, "expected 'key: value'");
  const key = t.slice(0, idx).trimEnd();
  if (key === "") fail(l.n, "empty key");
  return { key, rest: t.slice(idx + 1).trim() };
};

const blank = (rest) => rest === "" || rest.startsWith("#");

const parseBlock = (st, indent) =>
  isSeqItem(st.lines[st.pos].text) ? parseSeq(st, indent) : parseMap(st, indent);

const parseMap = (st, indent) => {
  const out = {};
  while (st.pos < st.lines.length) {
    const l = st.lines[st.pos];
    if (l.indent < indent) break;
    if (l.indent > indent) fail(l.n, "unexpected indentation (multi-line scalars are not supported)");
    if (isSeqItem(l.text)) fail(l.n, "sequence item where a mapping key was expected");
    const { key, rest } = splitKey(l);
    if (Object.hasOwn(out, key)) fail(l.n, `duplicate key '${key}'`);
    st.pos++;
    let value;
    if (blank(rest)) {
      const nx = st.lines[st.pos];
      value = nx && (nx.indent > indent || (nx.indent === indent && isSeqItem(nx.text))) ? parseBlock(st, nx.indent) : null;
    } else value = parseInline(rest, l.n);
    setKey(out, key, value);
  }
  return out;
};

const parseSeq = (st, indent) => {
  const out = [];
  while (st.pos < st.lines.length) {
    const l = st.lines[st.pos];
    if (l.indent < indent) break;
    if (l.indent > indent) fail(l.n, "unexpected indentation (multi-line scalars are not supported)");
    if (!isSeqItem(l.text)) break;
    const off = l.text === "-" ? 1 : /^- +/.exec(l.text)[0].length;
    const rest = l.text.slice(off).trim();
    if (blank(rest)) {
      st.pos++;
      const nx = st.lines[st.pos];
      out.push(nx && nx.indent > indent ? parseBlock(st, nx.indent) : null);
    } else if (isSeqItem(rest) || looksLikeKey(rest)) {
      st.lines[st.pos] = { n: l.n, indent: indent + off, text: l.text.slice(off) };
      out.push(parseBlock(st, indent + off));
    } else {
      st.pos++;
      out.push(parseInline(rest, l.n));
    }
  }
  return out;
};

const parseDocument = (text, offset) => {
  const lines = tokenize(text, offset);
  if (lines.length === 0) return null;
  const st = { lines, pos: 0 };
  const value = parseBlock(st, lines[0].indent);
  if (st.pos < lines.length) fail(lines[st.pos].n, "unexpected indentation");
  // §5.2: a top-level `segments:` with no value loads as an empty list.
  if (value && !Array.isArray(value) && typeof value === "object" && value.segments === null) value.segments = [];
  return value;
};

export const parseYaml = (text) => parseDocument(text, 0);

// ---------- writing ----------

const QUOTE_START = "-?:,[]{}#&*!|>'\"%@";

const quoteDouble = (s) => {
  let out = "\"";
  for (const c of s) {
    const code = c.codePointAt(0);
    if (c === "\"") out += "\\\"";
    else if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += c;
  }
  return out + "\"";
};

const needsQuote = (s, flow) =>
  s === "" ||
  s.startsWith(" ") || s.endsWith(" ") || s.endsWith(":") ||
  s.includes(": ") || s.includes(" #") ||
  QUOTE_START.includes(s[0]) ||
  /[\u0000-\u001f\u007f]/.test(s) ||
  INT_RE.test(s) || s === "true" || s === "false" || s === "null" ||
  (flow && /[,[\]{}]/.test(s));

const scalar = (v, flow) => {
  if (v === null) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new TypeError(`not an integer: ${v}`);
    return String(v);
  }
  if (typeof v === "string") return needsQuote(v, flow) ? quoteDouble(v) : v;
  throw new TypeError(`cannot write ${typeof v} as a YAML scalar`);
};

export const formatScalar = (v) => scalar(v, false);

const formatKey = (k) => (/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(k) && !INT_RE.test(k) ? k : quoteDouble(k));

export const formatFlow = (v) => {
  if (Array.isArray(v)) return `[${v.map(formatFlow).join(", ")}]`;
  if (v !== null && typeof v === "object") {
    const parts = Object.entries(v).map(([k, x]) => `${formatKey(k)}: ${formatFlow(x)}`);
    return parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
  }
  return scalar(v, true);
};

export const stringifyFrontMatter = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${formatKey(k)}: ${v !== null && typeof v === "object" ? formatFlow(v) : formatScalar(v)}\n`)
    .join("");

export const splitFrontMatter = (text) => {
  const lines = text.split("\n");
  if ((lines[0] ?? "").replace(/\r$/, "") !== "---") fail(1, "front matter must start with a '---' line");
  const close = lines.findIndex((l, i) => i > 0 && l.replace(/\r$/, "") === "---");
  if (close < 0) fail(lines.length, "front matter has no closing '---' line");
  const data = parseDocument(lines.slice(1, close).join("\n"), 1) ?? {};
  return { data, body: lines.slice(close + 1).join("\n") };
};

export const appendSegmentEntry = (text, entry) => {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^segments:(\s|$)/.test(l));
  if (at < 0) fail(lines.length, "no top-level 'segments:' key");
  const rest = lines[at].slice("segments:".length);
  const cm = /(^|\s)#/.exec(rest);
  const value = (cm ? rest.slice(0, cm.index) : rest).trim();
  const comment = cm ? rest.slice(cm.index).trimStart() : "";
  if (value !== "" && value !== "[]") fail(at + 1, "'segments' must be a block sequence to append to");
  if (value === "[]") lines[at] = comment ? `segments: ${comment}` : "segments:";
  let last = at;
  let indent = null;
  for (let j = at + 1; j < lines.length; j++) {
    const l = lines[j].replace(/\r$/, "");
    if (/^\s*$/.test(l) || /^\s*#/.test(l)) continue;
    const lead = /^ */.exec(l)[0].length;
    if (lead > 0 || isSeqItem(l)) {
      last = j;
      if (indent === null) indent = lead;
    } else break;
  }
  lines.splice(last + 1, 0, `${" ".repeat(indent ?? 2)}- ${formatFlow(entry)}`);
  return lines.join("\n");
};
