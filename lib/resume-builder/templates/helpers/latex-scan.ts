// Small toolbox of LaTeX scanning helpers used by the per-template
// parsers. Intentionally minimal — we don't try to be a real LaTeX
// parser, just enough to extract braced args and named environments
// from the output of our own templates.

// extractBracedArg reads a brace-balanced `{...}` starting at the first
// `{` at or after `startIndex`. Returns { content, endIndex } where
// content is the text inside the outermost braces (with inner braces
// preserved) and endIndex points one past the closing `}`.
//
// Returns null if no opening `{` is found or the braces don't balance
// before end-of-string.
export function extractBracedArg(
  src: string,
  startIndex: number
): { content: string; endIndex: number } | null {
  let i = startIndex;
  while (i < src.length && src[i] !== "{") {
    // Stop at newline so we don't slurp arguments from unrelated macros
    // on the next line — keeps us robust to malformed input.
    if (src[i] === "\n") return null;
    i++;
  }
  if (i >= src.length || src[i] !== "{") return null;
  let depth = 0;
  const startContent = i + 1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") {
      // Skip the next character — handles `\{` and `\}` inside arg.
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { content: src.slice(startContent, i), endIndex: i + 1 };
      }
    }
  }
  return null;
}

// extractMacroArg finds the first occurrence of `\<name>` (e.g. `\textbf`)
// and returns its first braced argument. Useful when a section is
// expected to start with a known macro.
export function extractMacroArg(src: string, name: string): string | null {
  const re = new RegExp(`\\\\${name}\\b`);
  const m = re.exec(src);
  if (!m) return null;
  const arg = extractBracedArg(src, m.index + m[0].length);
  return arg?.content ?? null;
}

// extractEnvironment returns the inner content of a `\begin{name}...\end{name}`
// block. Non-greedy, finds the FIRST occurrence. Nested environments of
// the same name are not handled (we don't emit any in classic-v2).
export function extractEnvironment(src: string, name: string): string | null {
  const open = `\\begin{${name}}`;
  const close = `\\end{${name}}`;
  const start = src.indexOf(open);
  if (start === -1) return null;
  const end = src.indexOf(close, start + open.length);
  if (end === -1) return null;
  return src.slice(start + open.length, end);
}

// iterSections splits the body by `\section{}` or `\section*{}` macros
// and yields each section as { label, body, headerIndex } where body is
// the text from the end of the section macro to the next section macro
// (or end-of-string). The pre-section "header" body (anything before the
// first \section{} call) is returned separately as `header`.
export function iterSections(body: string): {
  header: string;
  sections: { label: string; body: string }[];
} {
  // Match both `\section{X}` and `\section*{X}`.
  const re = /\\section\*?\s*\{/g;
  const out: { label: string; body: string }[] = [];
  let firstSectionStart = -1;
  let cursor = 0;
  let pending: { label: string; bodyStart: number } | null = null;
  for (;;) {
    re.lastIndex = cursor;
    const m = re.exec(body);
    if (!m) break;
    const arg = extractBracedArg(body, m.index + m[0].length - 1);
    if (!arg) {
      cursor = m.index + m[0].length;
      continue;
    }
    if (firstSectionStart === -1) firstSectionStart = m.index;
    if (pending) {
      out.push({
        label: pending.label,
        body: body.slice(pending.bodyStart, m.index)
      });
    }
    pending = { label: arg.content.trim(), bodyStart: arg.endIndex };
    cursor = arg.endIndex;
  }
  if (pending) {
    out.push({ label: pending.label, body: body.slice(pending.bodyStart) });
  }
  const header = firstSectionStart === -1 ? body : body.slice(0, firstSectionStart);
  return { header, sections: out };
}

// splitItems splits a section body into per-item chunks by looking for
// the canonical item start pattern in classic-v2: a blank line followed
// by `\noindent\textbf{`. Returns an array of trimmed item chunks.
//
// The first chunk often has empty/whitespace-only content if the section
// header was immediately followed by the first item — callers filter it.
export function splitOnItemStart(body: string): string[] {
  // Split on \n\n\noindent\textbf or \n\\noindent\textbf at line start.
  const parts = body.split(/\n\s*\n(?=\\noindent\\textbf\b)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

// extractDocumentBody returns the content between `\begin{document}` and
// `\end{document}`. Falls back to the whole string if either anchor is
// missing (lets the parser still try on partial snippets).
export function extractDocumentBody(src: string): {
  preamble: string;
  body: string;
  tail: string;
} {
  const beginIdx = src.indexOf("\\begin{document}");
  const endIdx = src.indexOf("\\end{document}");
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    return { preamble: "", body: src, tail: "" };
  }
  return {
    preamble: src.slice(0, beginIdx + "\\begin{document}".length),
    body: src.slice(beginIdx + "\\begin{document}".length, endIdx),
    tail: src.slice(endIdx)
  };
}
