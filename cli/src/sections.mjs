// Markdown section helpers. Pure.

// Content of "## {title}" up to (excluding) the next "## " heading. Null if absent.
export function extractSection(markdown, title) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join("\n");
}
