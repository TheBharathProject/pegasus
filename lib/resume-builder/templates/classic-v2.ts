import type {
  ApiDraftContent,
  ApiDraftEducation,
  ApiDraftExperience,
  ApiDraftPersonal,
  ApiDraftProject,
  ApiDraftSkillGroup
} from "@/lib/api-client";
import { registerTemplate } from "./registry";
import type { ParseResult, ResumeTemplate, SectionKey } from "./types";
import {
  extractBracedArg,
  extractDocumentBody,
  extractEnvironment,
  iterSections,
  splitOnItemStart
} from "./helpers/latex-scan";
import { latexUnescape, trimUnescape } from "./helpers/latex-unescape";

// classic-v2 parser. Mirrors the macros emitted by
// sypher-api/internal/jobtracker/templates/resume_builder/classic-v2.tex.tmpl.
//
// Anchors the parser relies on (any change to these requires a coordinated
// edit to the .tmpl):
//   - Header: `{\LARGE\bfseries <name>}` and `{\large <headline>}`,
//     contact line joined by ` $\cdot$ ` with `\href{...}{...}` macros.
//   - Section headers: `\section*{<Label>}` with fixed labels.
//   - Experience/Education items: blank line + `\noindent\textbf{...}` `\hfill` <range> `\\`
//     then `\textit{...}` `\hfill` <secondary>.
//   - Skills: itemize block, each item `\item \textbf{<Category>}: <items>`.

const TEMPLATE_ID = "classic-v2";

function parseTex(tex: string): ParseResult {
  const { body } = extractDocumentBody(tex);
  const { header, sections } = iterSections(body);

  const patch: Partial<ApiDraftContent> = {};
  const unresolvedSections: SectionKey[] = [];
  // Track which sections we attempted vs succeeded for confidence scoring.
  const scores: number[] = [];

  // Header → personal
  const personal = parseHeader(header);
  if (personal) {
    patch.personal = personal;
    scores.push(personal.name ? 1 : 0.5); // having a name is the strongest signal
  } else {
    unresolvedSections.push("personal");
    scores.push(0);
  }

  // Section-by-section, anchored on label.
  for (const sec of sections) {
    const label = sec.label.trim().toLowerCase();
    switch (label) {
      case "summary": {
        const text = parseSummary(sec.body);
        if (text !== null) {
          patch.summary = text;
          scores.push(1);
        } else {
          unresolvedSections.push("summary");
          scores.push(0);
        }
        break;
      }
      case "experience":
      case "experiences": {
        const items = parseExperiences(sec.body);
        if (items.length > 0) {
          patch.experiences = items;
          scores.push(1);
        } else {
          unresolvedSections.push("experiences");
          scores.push(0);
        }
        break;
      }
      case "education":
      case "educations": {
        const items = parseEducations(sec.body);
        if (items.length > 0) {
          patch.educations = items;
          scores.push(1);
        } else {
          unresolvedSections.push("educations");
          scores.push(0);
        }
        break;
      }
      case "skills": {
        const items = parseSkills(sec.body);
        if (items.length > 0) {
          patch.skills = items;
          scores.push(1);
        } else {
          unresolvedSections.push("skills");
          scores.push(0);
        }
        break;
      }
      case "projects": {
        const items = parseProjects(sec.body);
        if (items.length > 0) {
          patch.projects = items;
          scores.push(1);
        } else {
          unresolvedSections.push("projects");
          scores.push(0);
        }
        break;
      }
      default:
        // Unknown section — preserved in customTex on the editor side; no patch.
        break;
    }
  }

  const confidence =
    scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;

  return { patch, unresolvedSections, confidence };
}

// ----------------------------------------------------------------------------
// Header → DraftPersonal
// ----------------------------------------------------------------------------

function parseHeader(header: string): ApiDraftPersonal | null {
  // Pre-extract: the rendered header always contains:
  //   {\LARGE\bfseries <name>}
  //   {\large <headline>}     (may be empty between braces)
  //   <contact line with $\cdot$ separators>
  // Inside a {center} env OR after a \noindent depending on alignment style.

  const nameMatch = /\{\\LARGE\\bfseries\b/.exec(header);
  if (!nameMatch) {
    return null;
  }
  // extractBracedArg starts at the `{` before \LARGE — we need to seek back
  // to that opening brace. nameMatch.index is the `{` position.
  const nameArg = extractBracedArg(header, nameMatch.index);
  if (!nameArg) return null;

  // The braced content is `\LARGE\bfseries <name>`. Strip the leading
  // macros (whitespace tolerant) to get the name.
  const nameRaw = nameArg.content.replace(/^\s*\\LARGE\s*\\bfseries\s*/, "");
  const name = trimUnescape(nameRaw);

  // Headline: first `{\large ...}` after the name macro. Optional —
  // the template only emits this block when Personal.Headline is set.
  let headline = "";
  let headlineEndInHeader = nameArg.endIndex;
  const afterName = header.slice(nameArg.endIndex);
  const headlineMatch = /\{\\large\b/.exec(afterName);
  if (headlineMatch) {
    const headlineArg = extractBracedArg(afterName, headlineMatch.index);
    if (headlineArg) {
      headline = trimUnescape(
        headlineArg.content.replace(/^\s*\\large\s*/, "")
      );
      // extractBracedArg.endIndex is relative to `afterName`; translate
      // back to `header` coordinates by adding the offset of afterName.
      headlineEndInHeader = nameArg.endIndex + headlineArg.endIndex;
    }
  }

  // Contact line: the template emits this ONLY when at least one
  // contact field is set, preceded by a `\\[Npt]` separator. So:
  //   - No `\\[Npt]` in the post-name/headline region → no contact line.
  //   - Otherwise take the first non-empty line AFTER the last `\\[Npt]`
  //     and split it on the `$\cdot$` joiner.
  // Without this gate, the parser would scoop up trailing template
  // boilerplate (`\end{center}`, `\vspace{4pt}`, blank lines) and
  // mistakenly write it to `location`.
  const personal: ApiDraftPersonal = { name };
  if (headline) personal.headline = headline;

  const contactRegion = header.slice(headlineEndInHeader);
  const sepRe = /\\\\\[\d+pt\]/g;
  const separators = Array.from(contactRegion.matchAll(sepRe));
  if (separators.length > 0) {
    const lastSep = separators[separators.length - 1];
    const afterSep = contactRegion.slice(
      (lastSep.index ?? 0) + lastSep[0].length
    );
    // First non-empty line after the separator is the contact line.
    // Stop at `\end{center}` which closes the header.
    const contactLine = (afterSep
      .split(/\\end\{center\}/)[0] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
    if (contactLine) {
      const parts = contactLine
        .split(/\s*\$\\cdot\$\s*/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      for (const part of parts) {
        assignContactPart(personal, part);
      }
    }
  }

  return personal;
}

function assignContactPart(personal: ApiDraftPersonal, raw: string): void {
  // Email: \href{mailto:X}{label}
  const mailto = /\\href\{mailto:([^}]+)\}\{[^}]*\}/.exec(raw);
  if (mailto) {
    personal.email = latexUnescape(mailto[1]);
    return;
  }
  // Labelled URL: \href{X}{LinkedIn|GitHub|Website}
  const labelled = /\\href\{([^}]+)\}\{([^}]+)\}/.exec(raw);
  if (labelled) {
    const url = latexUnescape(labelled[1]);
    const label = labelled[2].trim().toLowerCase();
    if (label === "linkedin") personal.linkedinUrl = url;
    else if (label === "github") personal.githubUrl = url;
    else if (label === "website") personal.websiteUrl = url;
    else personal.websiteUrl = url; // unknown label → website-ish fallback
    return;
  }
  // Anything still containing a backslash is leftover LaTeX (e.g. a
  // `\vspace{4pt}` somebody pasted into a form field that then got
  // texEscape'd to `\textbackslash{}vspace\{4pt\}` on render). Don't
  // assign it as a location — that creates a self-reinforcing loop
  // where the bad value keeps showing up in the rendered .tex.
  const unescaped = latexUnescape(raw).trim();
  if (unescaped.includes("\\")) {
    return;
  }
  // Phone heuristic: digits, +, spaces, hyphens, parens dominate.
  if (/^[+\d][\d\s\-()]{4,}$/.test(unescaped)) {
    personal.phone = unescaped;
    return;
  }
  // Otherwise treat as location.
  if (unescaped) {
    personal.location = unescaped;
  }
}

// ----------------------------------------------------------------------------
// Section parsers
// ----------------------------------------------------------------------------

function parseSummary(body: string): string | null {
  // The template emits the summary as plain text between `\section*{Summary}`
  // and the next section. Trim and unescape.
  const text = trimUnescape(body);
  // Strip any trailing `\\` or `\vspace{}` artifacts the template may emit.
  return text.replace(/\\\\\s*$/, "").trim();
}

function parseExperiences(body: string): ApiDraftExperience[] {
  return splitOnItemStart(body)
    .map(parseExperienceItem)
    .filter((x): x is ApiDraftExperience => x !== null);
}

function parseExperienceItem(item: string): ApiDraftExperience | null {
  // Expected shape per item:
  //   \noindent\textbf{<title>} \hfill <date range>\\
  //   \textit{<company>} \hfill <location>
  //   \begin{itemize} \item ... \end{itemize}   (optional)
  const titleArg = extractMacroArg(item, "noindent", "textbf");
  if (!titleArg) return null;

  // Date range: text between `\hfill` and the line-ending `\\` on the
  // line where the title appears.
  const dateLineMatch = /\\hfill\s+([^\n\\]*?)\s*\\\\/.exec(item);
  let startDate = "";
  let endDate = "";
  let current = false;
  if (dateLineMatch) {
    const range = dateLineMatch[1].trim();
    if (/\bPresent\b\s*$/.test(range)) {
      current = true;
      startDate = range.replace(/\s*--\s*Present\s*$/, "").trim();
    } else if (range.includes(" -- ")) {
      const [s, e] = range.split(" -- ");
      startDate = s.trim();
      endDate = e.trim();
    } else {
      startDate = range;
    }
  }

  // Company: first `\textit{...}` after the date line.
  const afterTitle = dateLineMatch
    ? item.slice(dateLineMatch.index + dateLineMatch[0].length)
    : item;
  const companyArg = extractMacroArg(afterTitle, "textit");
  const company = companyArg ? trimUnescape(companyArg) : "";

  // Location: text between company's closing brace and end-of-line. When
  // the experience has no Description bullets, the template appends a
  // trailing `\\[2pt]` linebreak marker on the same line — strip those
  // formatting suffixes so they don't pollute the location field.
  let location = "";
  if (companyArg !== null) {
    const companyEndRe = new RegExp(`\\\\textit\\{[^}]*\\}`);
    const m = companyEndRe.exec(afterTitle);
    if (m) {
      const afterCompany = afterTitle.slice(m.index + m[0].length);
      const locLine = afterCompany.split("\n")[0] ?? "";
      const locMatch = /\\hfill\s+(.*)$/.exec(locLine.trim());
      if (locMatch) {
        const stripped = locMatch[1]
          .replace(/\\\\(\[[^\]]*\])?\s*$/, "")
          .trim();
        if (stripped) location = trimUnescape(stripped);
      }
    }
  }

  // Description: \begin{itemize}...\end{itemize}, one bullet per \item.
  const description = parseItemizeBullets(item);

  const out: ApiDraftExperience = {
    company,
    title: trimUnescape(titleArg),
    current
  };
  if (location) out.location = location;
  if (startDate) out.startDate = startDate;
  if (endDate) out.endDate = endDate;
  if (description.length > 0) out.description = description;
  return out;
}

function parseEducations(body: string): ApiDraftEducation[] {
  return splitOnItemStart(body)
    .map(parseEducationItem)
    .filter((x): x is ApiDraftEducation => x !== null);
}

function parseEducationItem(item: string): ApiDraftEducation | null {
  const schoolArg = extractMacroArg(item, "noindent", "textbf");
  if (!schoolArg) return null;

  // The template renders an education item as three logical lines
  // (separated by physical newlines):
  //   1. \noindent\textbf{School} \hfill <date range>\\
  //   2. \textit{<Degree, Field>} \hfill <GPA>
  //   3. \\<description>          (optional)
  const lines = item.split("\n").map((l) => l.trim()).filter((l) => l);

  // Line 1: date range from `\hfill ... \\`.
  let startDate = "";
  let endDate = "";
  const line1 = lines[0] ?? "";
  const dateMatch = /\\hfill\s+(.+?)\s*\\\\/.exec(line1);
  if (dateMatch) {
    const range = dateMatch[1].trim();
    if (range.includes(" -- ")) {
      const [s, e] = range.split(" -- ");
      startDate = s.trim();
      endDate = e.trim();
    } else if (range) {
      startDate = range;
    }
  }

  // Line 2: \textit{Degree[, Field]} \hfill GPA
  const line2 = lines[1] ?? "";
  const degreeFieldArg = extractMacroArg(line2, "textit");
  let degree = "";
  let field = "";
  if (degreeFieldArg !== null) {
    const txt = trimUnescape(degreeFieldArg);
    const ix = txt.indexOf(", ");
    if (ix >= 0) {
      degree = txt.slice(0, ix).trim();
      field = txt.slice(ix + 2).trim();
    } else {
      degree = txt;
    }
  }
  let gpa = "";
  const textitRe = /\\textit\{[^}]*\}/;
  const tm = textitRe.exec(line2);
  if (tm) {
    const after = line2.slice(tm.index + tm[0].length);
    const gpaMatch = /\\hfill\s+(.*)$/.exec(after.trim());
    if (gpaMatch) gpa = trimUnescape(gpaMatch[1]);
  }

  // Line 3 (optional): `\\Description`.
  let description = "";
  for (const ln of lines.slice(2)) {
    const m = /^\\\\(.+)$/.exec(ln);
    if (m) {
      description = trimUnescape(m[1]);
      break;
    }
  }

  const out: ApiDraftEducation = { school: trimUnescape(schoolArg) };
  if (degree) out.degree = degree;
  if (field) out.field = field;
  if (startDate) out.startDate = startDate;
  if (endDate) out.endDate = endDate;
  if (gpa) out.gpa = gpa;
  if (description) out.description = description;
  return out;
}

function parseSkills(body: string): ApiDraftSkillGroup[] {
  const block = extractEnvironment(body, "itemize");
  if (block === null) return [];
  const groups: ApiDraftSkillGroup[] = [];
  // Split on `\item`; first chunk before any \item is preamble whitespace.
  const chunks = block.split(/\\item\s+/).slice(1);
  for (const chunk of chunks) {
    // Shape: `\textbf{<Category>}: <items>`
    const categoryArg = extractMacroArg(chunk, "textbf");
    if (categoryArg === null) continue;
    const textbfRe = /\\textbf\{[^}]*\}/;
    const m = textbfRe.exec(chunk);
    if (!m) continue;
    const after = chunk.slice(m.index + m[0].length);
    // Skip the colon and spaces, then capture the rest of the item line.
    const itemsLine = after.replace(/^\s*:\s*/, "").split("\n")[0] ?? "";
    const items = itemsLine
      .split(/,\s*/)
      .map(trimUnescape)
      .filter((s) => s.length > 0);
    groups.push({ category: trimUnescape(categoryArg), items });
  }
  return groups;
}

function parseProjects(body: string): ApiDraftProject[] {
  return splitOnItemStart(body)
    .map(parseProjectItem)
    .filter((x): x is ApiDraftProject => x !== null);
}

function parseProjectItem(item: string): ApiDraftProject | null {
  const nameArg = extractMacroArg(item, "noindent", "textbf");
  if (!nameArg) return null;
  const techStackArg = extractMacroArg(item, "textit");

  // The template renders a project item as up to three logical lines:
  //   1. \noindent\textbf{Name} \hfill \textit{TechStack}
  //   2. \\<description>        (optional)
  //   3. \\\href{<url>}{<url>}  (optional)
  const lines = item.split("\n").map((l) => l.trim()).filter((l) => l);
  let description = "";
  let link = "";
  for (const line of lines.slice(1)) {
    // \\\href{url}{label}  → link
    const hrefMatch = /^\\\\\\href\{([^}]+)\}\{[^}]*\}$/.exec(line);
    if (hrefMatch) {
      link = latexUnescape(hrefMatch[1]);
      continue;
    }
    // \\<description>  → description (but not a \href line)
    const descMatch = /^\\\\(.+)$/.exec(line);
    if (descMatch && !descMatch[1].startsWith("\\href")) {
      description = trimUnescape(descMatch[1]);
    }
  }

  const out: ApiDraftProject = { name: trimUnescape(nameArg) };
  if (description) out.description = description;
  if (techStackArg) out.techStack = trimUnescape(techStackArg);
  if (link) out.link = link;
  return out;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

// extractMacroArg looks for `\<first>` optionally followed by `\<second>`
// (e.g. `\noindent\textbf{...}`) and returns the first braced arg of the
// trailing macro. If `second` is omitted, returns the first braced arg
// of `\<first>`.
function extractMacroArg(
  src: string,
  first: string,
  second?: string
): string | null {
  const pattern = second
    ? new RegExp(`\\\\${first}\\\\${second}\\b`)
    : new RegExp(`\\\\${first}\\b`);
  const m = pattern.exec(src);
  if (!m) return null;
  const arg = extractBracedArg(src, m.index + m[0].length);
  return arg?.content ?? null;
}

function parseItemizeBullets(src: string): string[] {
  const block = extractEnvironment(src, "itemize");
  if (block === null) return [];
  // Split on `\item` at line-ish boundaries.
  const chunks = block.split(/\\item\b/).slice(1);
  return chunks
    .map((c) => trimUnescape(c.replace(/\s*\\?\s*$/, "")))
    .filter((s) => s.length > 0);
}

// ----------------------------------------------------------------------------
// Registration
// ----------------------------------------------------------------------------

const classicV2: ResumeTemplate = {
  id: TEMPLATE_ID,
  label: "Classic",
  description:
    "Single-column, ATS-friendly resume with serif typography. Section headers underlined; dates right-aligned via \\hfill. The canonical Pegasus template — clean, recruiter-readable, no design-first noise.",
  tags: ["ATS-friendly", "Serif", "Single-column"],
  parseTex
};

registerTemplate(classicV2);

export { classicV2, parseTex };
