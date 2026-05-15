"use client";

import { useEffect } from "react";
import { listTemplates } from "@/lib/resume-builder/templates";
import { sampleDraftContent } from "@/lib/resume-builder-content";
import { ResumeBuilderPreview } from "@/components/resume-builder/preview";

// TemplatePicker — modal shown when the user starts a new draft. Each
// card renders a live <ResumeBuilderPreview> fed with sampleDraftContent()
// (CSS-scaled to ~40%) so the user sees the actual rendered template,
// not a stale screenshot. Click a card → onSelect(templateId) → parent
// closes the modal and creates the draft.
//
// "Use my Profile" and "Start blank" deliberately don't go through this
// picker — they're shortcuts that bypass the template-choice step.

export function TemplatePicker({
  open,
  onSelect,
  onClose
}: {
  open: boolean;
  onSelect: (templateId: string) => void;
  onClose: () => void;
}) {
  // Escape closes; matches the chrome modal behaviour elsewhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const templates = listTemplates();
  const sample = sampleDraftContent();

  return (
    <div
      className="rb-picker-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rb-picker-title"
    >
      <div className="rb-picker-shell">
        <header className="rb-picker-head">
          <div>
            <h2 id="rb-picker-title" className="rb-picker-title">
              Choose a template
            </h2>
            <p className="muted small rb-picker-sub">
              Pick a template style — the layout and section spacing applied
              to whatever data lands in the draft (sample, profile, or an
              imported resume).
            </p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            aria-label="Close template picker"
          >
            Cancel
          </button>
        </header>

        <div className="rb-picker-grid">
          {templates.map((t) => (
            <article key={t.id} className="rb-picker-card">
              {/* Live preview, scaled. The inner preview is rendered at
                  its natural size (Letter @ 96 DPI = 816px wide) and
                  shrunk via CSS transform; the .rb-picker-thumb wrapper
                  clips the overflow. */}
              <div className="rb-picker-thumb">
                <div className="rb-picker-thumb-scale">
                  <ResumeBuilderPreview content={sample} />
                </div>
              </div>

              <div className="rb-picker-card-body">
                <h3 className="rb-picker-card-name">{t.label}</h3>
                {t.description ? (
                  <p className="muted small rb-picker-card-desc">
                    {t.description}
                  </p>
                ) : null}
                {t.tags && t.tags.length > 0 ? (
                  <ul className="rb-picker-card-tags">
                    {t.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  className="primary-button rb-picker-cta"
                  onClick={() => onSelect(t.id)}
                >
                  Use this template
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
