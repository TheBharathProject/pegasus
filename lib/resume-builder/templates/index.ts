// Barrel: importing this file loads the registry AND every known template
// (each template self-registers on import). The editor imports from here.

export { defaultTemplateId, getTemplate, listTemplates, registerTemplate } from "./registry";
export type { ParseResult, ResumeTemplate, SectionKey } from "./types";

// Side-effect imports — each module calls registerTemplate at top level.
import "./classic-v2";
