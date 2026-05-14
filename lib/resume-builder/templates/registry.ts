import type { ResumeTemplate } from "./types";

// Module-level singleton — every template module self-registers on import.
// Keyed by template id (matches backend id used in /render/* APIs).
const templates = new Map<string, ResumeTemplate>();

export function registerTemplate(t: ResumeTemplate): void {
  templates.set(t.id, t);
}

export function getTemplate(id: string): ResumeTemplate | undefined {
  return templates.get(id);
}

export function listTemplates(): ResumeTemplate[] {
  return Array.from(templates.values());
}

// Default for new drafts. Must match `defaultResumeBuilderTemplate` in
// sypher-api/internal/jobtracker/store_resume_builder.go.
export const defaultTemplateId = "classic-v2";
