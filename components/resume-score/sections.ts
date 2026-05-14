import type { ApiScoreSection } from "@/lib/api-client";

// SECTION_ORDER matches `ai.SectionOrder` in sypher-api/internal/ai/types.go.
// Keep these two lists in lockstep — the FE rail mirrors the PDF template
// section ordering.
export const SECTION_ORDER = [
  "summary",
  "work_experience",
  "education",
  "skills",
  "projects",
  "achievements_awards"
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number];

export function sectionLabel(key: string): string {
  switch (key) {
    case "summary":
      return "Summary";
    case "work_experience":
      return "Work Experience";
    case "education":
      return "Education";
    case "skills":
      return "Skills";
    case "projects":
      return "Projects";
    case "achievements_awards":
      return "Achievements / Awards";
    default:
      return key;
  }
}

// findingCounts returns the tally per tag for the section header
// ("N to fix · N to improve · N good"). Sections that aren't yet
// rendered get all zeros.
export function findingCounts(sec?: ApiScoreSection | null): {
  fix: number;
  improve: number;
  good: number;
} {
  if (!sec) return { fix: 0, improve: 0, good: 0 };
  let fix = 0;
  let improve = 0;
  let good = 0;
  for (const f of sec.findings) {
    if (f.tag === "fix") fix++;
    else if (f.tag === "improve") improve++;
    else if (f.tag === "good") good++;
  }
  return { fix, improve, good };
}

export function countsText(counts: {
  fix: number;
  improve: number;
  good: number;
}): string {
  const parts: string[] = [];
  if (counts.fix > 0) parts.push(`${counts.fix} to fix`);
  if (counts.improve > 0) parts.push(`${counts.improve} to improve`);
  if (counts.good > 0) parts.push(`${counts.good} good`);
  return parts.join("  ·  ");
}
