// Touches glob matching (spec v0.5 §3.7, §8.2). Pure.
// Semantics: '**' crosses path segments, '*' matches within one segment,
// '?' matches a single character; everything else is literal. Globs match
// repo-relative paths in full.

export function globToRegExp(glob) {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // '**' possibly followed by '/'
        if (glob[i + 2] === "/") { re += "(?:[^/]+/)*"; i += 3; }
        else { re += ".*"; i += 2; }
      } else { re += "[^/]*"; i += 1; }
    } else if (c === "?") {
      re += "[^/]"; i += 1;
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&"); i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

export function partitionScope(touches, files) {
  const regexps = touches.map(globToRegExp);
  const inScope = [];
  const outOfScope = [];
  for (const f of files) {
    (regexps.some((r) => r.test(f)) ? inScope : outOfScope).push(f);
  }
  return { inScope, outOfScope };
}
