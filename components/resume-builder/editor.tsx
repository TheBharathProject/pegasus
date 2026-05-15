"use client";

import { useEffect, useRef, useState } from "react";
import {
  LatexCompilePreview,
  type PdfPhase
} from "@/components/resume-builder/latex-compile-preview";
import { ResumeBuilderPreview } from "@/components/resume-builder/preview";
import { SectionPersonal } from "@/components/resume-builder/section-personal";
import { SectionStyle } from "@/components/resume-builder/section-style";
import { SectionSummary } from "@/components/resume-builder/section-summary";
import { SectionExperiences } from "@/components/resume-builder/section-experiences";
import { SectionEducations } from "@/components/resume-builder/section-educations";
import { SectionSkills } from "@/components/resume-builder/section-skills";
import { SectionProjects } from "@/components/resume-builder/section-projects";
import { renderPdf, renderTex } from "@/lib/resume-builder";
import {
  defaultTemplateId,
  getTemplate,
  type SectionKey
} from "@/lib/resume-builder/templates";
import {
  ApiError,
  type ApiDraftContent,
  type ApiResumeBuilderDraft
} from "@/lib/api-client";

// ResumeBuilderEditor — host for the section forms + the live preview.
// Two modes: Form (default; section UIs drive `content`) and LaTeX (raw
// .tex source bound to `content.customTex`). When customTex is set, the
// export pipeline ships that string verbatim and the preview falls back
// to whatever the form fields say (since we can't render arbitrary .tex
// in HTML). Flipping back to Form discards customTex.

type Mode = "form" | "tex";

type ChangePayload = Partial<Pick<ApiResumeBuilderDraft, "title" | "content">>;

export function ResumeBuilderEditor({
  draft,
  onChange
}: {
  draft: ApiResumeBuilderDraft;
  onChange: (next: ChangePayload) => void;
}) {
  // If the draft already has customTex, default to LaTeX mode so we don't
  // visually drop the user's hand-edited source on a page reload.
  const [mode, setMode] = useState<Mode>(
    draft.content.customTex ? "tex" : "form"
  );
  const [texLoading, setTexLoading] = useState(false);
  const [texError, setTexError] = useState<string | null>(null);
  // Local-only mirror of the LaTeX textarea content. We seed it from the
  // draft's persisted customTex (so a refreshed page stays consistent),
  // but we only PERSIST back to draft.content.customTex once the user
  // actually types — otherwise merely peeking at LaTeX mode would mark
  // the draft as "hand-edited" and trigger the warning banner.
  const [texLocal, setTexLocal] = useState<string>(
    draft.content.customTex ?? ""
  );
  // Reset the local textarea seed when the user switches between drafts.
  useEffect(() => {
    setTexLocal(draft.content.customTex ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);
  // Right-pane view selector — HTML approximation vs real LaTeX compile.
  // Default = "pdf" because the compiled PDF is the actual artifact the
  // user is exporting; HTML preview is a fast structural approximation
  // that can't replicate LaTeX's font (Latin Modern Roman), microtype
  // kerning, or hyperref link colours. Users can still toggle to HTML
  // for a quick layout sanity check without paying for a compile.
  const [previewMode, setPreviewMode] = useState<"html" | "pdf">("pdf");

  // Compiled-PDF state lives at the editor (not inside LatexCompilePreview)
  // so the blob URL survives HTML↔PDF toggles. Auto-compile fires once on
  // first PDF activation per draft; after that, only the Compile button
  // triggers a recompile — source edits just flag the PDF as stale.
  const [pdfPhase, setPdfPhase] = useState<PdfPhase>({ kind: "idle" });
  const [pdfStale, setPdfStale] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);
  // Sections the LaTeX→Form parser couldn't auto-detect with confidence.
  // Drives the "Map sections" hint pill below the textarea — the
  // Phase-2 mapping dialog will read from here.
  const [parseUnresolved, setParseUnresolved] = useState<SectionKey[]>([]);

  // Kick off a compile against the persisted draft. Revokes the previous
  // blob URL so we don't leak object URLs across recompiles.
  const compilePdf = async () => {
    setPdfPhase({ kind: "compiling" });
    setPdfStale(false);
    try {
      const blob = await renderPdf(draft.id);
      const url = URL.createObjectURL(blob);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdfPhase({ kind: "pdf", url });
    } catch (e) {
      if (e instanceof ApiError) {
        setPdfPhase({ kind: "error", status: e.status, message: e.message });
      } else {
        setPdfPhase({ kind: "error", status: 0, message: (e as Error).message });
      }
    }
  };

  // Reset compile state when switching to a different draft — the old
  // draft's blob is meaningless against the new one's source.
  useEffect(() => {
    setPdfPhase({ kind: "idle" });
    setPdfStale(false);
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
  }, [draft.id]);

  // First-time auto-compile: the moment the user lands on the PDF tab for
  // this draft AND we have no compile in-flight or cached, kick one off.
  // After that, only manual button clicks trigger compiles.
  useEffect(() => {
    if (previewMode === "pdf" && pdfPhase.kind === "idle") {
      void compilePdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, pdfPhase.kind]);

  // Mark the compiled PDF stale on any content/source change — purely a
  // hint to the user; does NOT trigger a recompile.
  useEffect(() => {
    if (pdfPhase.kind === "pdf") setPdfStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentVersion(draft.content), draft.content.customTex]);

  // Final blob-URL cleanup on unmount.
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  // Form → LaTeX sync: when the user edits any form field in Form mode and
  // there's a stale customTex on the draft (from a previous LaTeX-mode
  // session), clear it. That way, switching back to LaTeX regenerates the
  // source from the latest form state instead of showing what they had
  // hand-edited before. LaTeX-mode edits don't trigger this branch — they
  // go through the textarea's onChange path which sets customTex directly.
  const setContent = (next: ApiDraftContent) => {
    if (mode === "form" && draft.content.customTex) {
      next = { ...next, customTex: "" };
    }
    onChange({ content: next });
  };

  // When switching INTO LaTeX mode for a draft that has no customTex yet,
  // fetch the auto-generated source so the user can edit from a real
  // starting point instead of an empty textarea. We store it in
  // `texLocal` (component state) rather than `draft.content.customTex`
  // so a no-op visit doesn't mark the draft as hand-edited.
  const handleSwitchToTex = async () => {
    setMode("tex");
    if (texLocal.trim().length > 0) {
      return; // already seeded (either from persisted customTex or a prior switch)
    }
    setTexLoading(true);
    setTexError(null);
    try {
      const tex = await renderTex(draft.id);
      setTexLocal(tex);
    } catch (e) {
      setTexError((e as Error).message);
    } finally {
      setTexLoading(false);
    }
  };

  const handleResetToForm = () => {
    // Auto-sync (when registered for this template) keeps the form
    // fields in lockstep with the textarea — switching to Form is no
    // longer destructive, so we just flip mode silently. The customTex
    // is preserved so the user can toggle back to LaTeX and see exactly
    // what they had. Existing setContent logic clears customTex on the
    // first form-mode edit, which is the right "stale" semantic.
    //
    // Only show the legacy "discard?" confirm for templates without a
    // parser — those drafts can't recover the LaTeX edits into form
    // fields, so the warning still applies.
    const hasParser = !!getTemplate(draft.templateId || defaultTemplateId);
    if (
      !hasParser &&
      draft.content.customTex &&
      !window.confirm(
        "Discard your hand-edited LaTeX? The form data stays — you can edit raw LaTeX again later."
      )
    ) {
      return;
    }
    setMode("form");
    setTexError(null);
  };

  // (Note: the previous auto-flip-to-tex effect that snapped the user
  // back to LaTeX mode when customTex was set externally was removed
  // when bidirectional sync landed. With the parser keeping form +
  // textarea in lockstep, customTex being non-empty in form mode is no
  // longer a "user's intent will be lost" scenario — it's just a stale
  // backup that the first form edit clears.)

  // LaTeX → Form auto-sync. When the user edits the textarea in tex mode,
  // wait 400ms after the last keystroke, then run the template's parser
  // and merge the recognised sections back into the structured form
  // fields. Anything the parser can't extract (unknown sections, free
  // preamble edits) stays in customTex untouched — so the .tex source
  // remains the authoritative thing the export pipeline ships.
  //
  // Templates without a registered parser (e.g. legacy "classic-v1"
  // drafts) skip the effect silently, preserving the pre-sync behaviour.
  useEffect(() => {
    if (mode !== "tex") return;
    const tex = draft.content.customTex ?? "";
    if (tex.trim().length === 0) {
      setParseUnresolved([]);
      return;
    }
    const template = getTemplate(draft.templateId || defaultTemplateId);
    if (!template) return;
    const timer = window.setTimeout(() => {
      const result = template.parseTex(tex);
      if (result.confidence >= 0.5) {
        // Merge patch into content; customTex is preserved by the spread
        // so the textarea doesn't bounce.
        onChange({ content: { ...draft.content, ...result.patch } });
        setParseUnresolved([]);
      } else {
        setParseUnresolved(result.unresolvedSections);
      }
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.content.customTex, draft.templateId, mode]);

  return (
    <div className="rb-editor">
      <div className="rb-editor-form">
        {/* Title bar — borderless display-font line. Doubles as the
            page header now that ProductFrame's H1 is suppressed in
            editor view. */}
        <div className="rb-title-row">
          <input
            id="rb-title"
            className="rb-title-input"
            type="text"
            placeholder="Untitled resume"
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={200}
            aria-label="Draft title"
          />
        </div>

        {/* Mode toggle — segmented control with a sliding pill. The
            data-mode attribute drives the pill's transform; aria-pressed
            keeps keyboard users in the loop. */}
        <div className="rb-mode-row">
          <div
            className="rb-mode-toggle"
            data-mode={mode}
            role="tablist"
            aria-label="Editing mode"
          >
            <span className="rb-mode-toggle-pill" aria-hidden />
            <button
              type="button"
              role="tab"
              aria-selected={mode === "form"}
              className="rb-mode-toggle-btn"
              onClick={handleResetToForm}
            >
              Form
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "tex"}
              className="rb-mode-toggle-btn"
              onClick={() => void handleSwitchToTex()}
            >
              LaTeX source
            </button>
          </div>
          {mode === "tex" && draft.content.customTex ? (
            <span className="muted small rb-mode-hint">
              Hand-edited LaTeX overrides form sections on export. Form edits
              regenerate the source when you switch back.
            </span>
          ) : mode === "tex" ? (
            <span className="muted small rb-mode-hint">Switching to LaTeX mode…</span>
          ) : (
            <span className="muted small rb-mode-hint">
              Structured form. Sync to LaTeX is bidirectional.
            </span>
          )}
        </div>

        {/* Info banner — shown in form mode if customTex was set in a prior
            LaTeX session. Uses a calm left-rule treatment, not the .notice
            (error-toned) chrome. Includes an inline Discard action so the
            user can drop the stale LaTeX without having to wait for the
            silent clear on first form edit. */}
        {mode === "form" && draft.content.customTex ? (
          <aside className="rb-info-banner">
            <span className="rb-info-banner-rule" aria-hidden />
            <div className="rb-info-banner-body">
              <p>
                You have hand-edited LaTeX from a previous session. Any form
                edit below discards it; or keep it by switching back to LaTeX.
              </p>
              <button
                type="button"
                className="rb-info-banner-action"
                onClick={() => {
                  setTexLocal("");
                  onChange({
                    content: { ...draft.content, customTex: "" }
                  });
                }}
              >
                Discard now
              </button>
            </div>
          </aside>
        ) : null}

        {mode === "tex" ? (
          <section className="rb-section">
            <header className="rb-section-head">
              <h3>LaTeX source</h3>
              {texLoading ? <span className="muted small">Loading…</span> : null}
            </header>
            {texError ? (
              <section className="notice" style={{ marginBottom: 10 }}>
                <em>{texError}</em>
              </section>
            ) : null}
            <textarea
              className="feedback-box rb-tex-area"
              spellCheck={false}
              rows={28}
              placeholder="\documentclass{article}..."
              value={texLocal}
              onChange={(e) => {
                const next = e.target.value;
                setTexLocal(next);
                // Persist the edit — at this point the user has truly
                // hand-edited LaTeX, so customTex earns its "hand-edited"
                // semantics and the form-mode warning banner is correct.
                setContent({ ...draft.content, customTex: next });
              }}
            />
            <p className="muted small" style={{ marginTop: 6 }}>
              Tip: keep <code>\documentclass</code> and the <code>\begin/end</code>{" "}
              of <code>document</code> intact. Tectonic compiles this verbatim
              at export time.
            </p>
            {parseUnresolved.length > 0 ? (
              <p className="muted small" style={{ marginTop: 6 }}>
                Couldn't auto-detect: {parseUnresolved.join(", ")}. Form
                fields for these sections weren't updated — manual mapping
                support is coming soon.
              </p>
            ) : null}
          </section>
        ) : (
          <>
            <SectionStyle
              value={draft.content.style}
              onChange={(style) => setContent({ ...draft.content, style })}
            />
            <SectionPersonal
              value={draft.content.personal}
              onChange={(personal) =>
                setContent({ ...draft.content, personal })
              }
            />
            <SectionSummary
              value={draft.content.summary ?? ""}
              onChange={(summary) =>
                setContent({ ...draft.content, summary })
              }
            />
            <SectionExperiences
              value={draft.content.experiences ?? []}
              onChange={(experiences) =>
                setContent({ ...draft.content, experiences })
              }
            />
            <SectionEducations
              value={draft.content.educations ?? []}
              onChange={(educations) =>
                setContent({ ...draft.content, educations })
              }
            />
            <SectionSkills
              value={draft.content.skills ?? []}
              onChange={(skills) =>
                setContent({ ...draft.content, skills })
              }
            />
            <SectionProjects
              value={draft.content.projects ?? []}
              onChange={(projects) =>
                setContent({ ...draft.content, projects })
              }
            />
          </>
        )}
      </div>

      <aside className="rb-editor-preview">
        <div className="rb-preview-mode-row">
          <div className="filters">
            <button
              type="button"
              className={
                previewMode === "html"
                  ? "filter-box is-active"
                  : "filter-box"
              }
              onClick={() => setPreviewMode("html")}
              title="Instant approximation — close to PDF but not exact"
            >
              HTML preview
            </button>
            <button
              type="button"
              className={
                previewMode === "pdf"
                  ? "filter-box is-active"
                  : "filter-box"
              }
              onClick={() => setPreviewMode("pdf")}
              title="Real LaTeX compile — pixel-true to the export"
            >
              Compiled PDF
            </button>
          </div>
          <div className="rb-preview-mode-actions">
            {previewMode === "html" ? (
              <span
                className="rb-preview-stale-dot"
                title="HTML preview can't fully match LaTeX's font and microtype — use Compiled PDF for the exact export."
              >
                Approximate
              </span>
            ) : null}
            {previewMode === "pdf" && pdfStale && pdfPhase.kind === "pdf" ? (
              <span className="rb-preview-stale-dot">Source changed</span>
            ) : null}
            {previewMode === "pdf" ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => void compilePdf()}
                disabled={pdfPhase.kind === "compiling"}
              >
                {pdfPhase.kind === "compiling" ? "Compiling…" : "Compile"}
              </button>
            ) : null}
          </div>
        </div>
        {/* Keyed wrapper retriggers the fade-in keyframe on each toggle
            so the swap reads as a soft crossfade rather than a hard cut. */}
        <div key={previewMode} className="rb-preview-body">
          {previewMode === "html" ? (
            <ResumeBuilderPreview content={draft.content} />
          ) : (
            <LatexCompilePreview phase={pdfPhase} />
          )}
        </div>
      </aside>
    </div>
  );
}

// contentVersion is a cheap stable signature for the draft content. We
// use string length of a JSON snapshot — anything that changes the
// content (text, array reordering, style flips) bumps this number,
// which is enough to invalidate the compile-preview "stale" state.
function contentVersion(c: import("@/lib/api-client").ApiDraftContent): number {
  try {
    return JSON.stringify(c).length;
  } catch {
    return 0;
  }
}

