import type { ApiDraftContent } from "@/lib/api-client";

// Sections the parser knows how to extract. Matches the top-level fields
// on ApiDraftContent that the UI form mode edits.
export type SectionKey =
  | "personal"
  | "summary"
  | "experiences"
  | "educations"
  | "skills"
  | "projects";

// Result of running a template's parser over the .tex source. The patch is
// merged onto the existing DraftContent; missing sections leave the
// corresponding form field untouched.
export type ParseResult = {
  patch: Partial<ApiDraftContent>;
  // Sections we expected to find (because the .tex has matching anchors)
  // but couldn't extract with confidence. Drives the Phase-2 mapping
  // dialog prompt.
  unresolvedSections: SectionKey[];
  // 0 .. 1. Below 0.5 we surface the "Map sections" pill instead of
  // applying the patch silently.
  confidence: number;
};

// One template = one render shape on the backend + one parser on the
// frontend. Templates self-register via registerTemplate() on module
// import; the editor pulls the active one out of the registry by id.
//
// Display metadata (description, accent) is for the TemplatePicker
// modal. The picker iterates listTemplates() and renders one card per
// entry with a live <ResumeBuilderPreview> for the visual.
export type ResumeTemplate = {
  id: string;
  label: string;
  /** One-line description shown under the name in the picker card. */
  description?: string;
  /** Tags surface in the picker (e.g. ["ATS-friendly", "Serif", "Single-column"]). */
  tags?: string[];
  parseTex(tex: string): ParseResult;
};
