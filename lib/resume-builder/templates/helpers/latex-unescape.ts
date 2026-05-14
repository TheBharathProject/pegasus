// Inverse of texEscape in sypher-api/internal/jobtracker/resume_builder_render.go.
// Run as the LAST step on every user-visible string extracted from the .tex —
// keeps `&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`, and `\` round-tripping
// cleanly through the form-mode editor.
//
// IMPORTANT: keep this in sync with texReplacer in resume_builder_render.go.
// If a new char is added to the Go escaper, mirror it here.

const REPLACEMENTS: Array<[RegExp, string]> = [
  // Multi-char replacements first so we don't double-decode.
  [/\\textbackslash\{\}/g, "\\"],
  [/\\textasciitilde\{\}/g, "~"],
  [/\\textasciicircum\{\}/g, "^"],
  [/\\&/g, "&"],
  [/\\%/g, "%"],
  [/\\\$/g, "$"],
  [/\\#/g, "#"],
  [/\\_/g, "_"],
  [/\\\{/g, "{"],
  [/\\\}/g, "}"]
];

export function latexUnescape(s: string): string {
  let out = s;
  for (const [re, sub] of REPLACEMENTS) {
    out = out.replace(re, sub);
  }
  return out;
}

// trimUnescape is the convenience pair: trim whitespace then unescape.
// Most extractors want this on every captured string.
export function trimUnescape(s: string): string {
  return latexUnescape(s.trim());
}
