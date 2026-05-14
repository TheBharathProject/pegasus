"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import { PlusIcon, ResumeBuilderIcon, SparkleStarIcon, TrashIcon } from "@/components/icons";
import { ResumeBuilderEditor } from "@/components/resume-builder/editor";
import { ExportModal } from "@/components/resume-builder/export-modal";
import { TemplatePicker } from "@/components/resume-builder/template-picker";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";
import {
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  saveDraft
} from "@/lib/resume-builder";
import {
  emptyDraftContent,
  fromProfile,
  sampleDraftContent
} from "@/lib/resume-builder-content";
import { defaultTemplateId } from "@/lib/resume-builder/templates";
import {
  api,
  type ApiDraftContent,
  type ApiResumeBuilderDraft,
  type ApiResumeBuilderDraftSummary
} from "@/lib/api-client";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Debounce window before autosave fires. Aligns with the plan's "2s" target.
const AUTOSAVE_MS = 2000;

function ResumeBuilderInner() {
  const router = useRouter();
  const search = useSearchParams();
  const draftIdFromUrl = search.get("draft");

  const [drafts, setDrafts] = useState<ApiResumeBuilderDraftSummary[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [current, setCurrent] = useState<ApiResumeBuilderDraft | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [scoring, setScoring] = useState(false);

  // Score this draft via the Resume AI endpoint (passes draftId, not a
  // file). Navigates to /resume?id=<newReportId> on success — the Resume
  // AI page picks up the id and renders the new structured report.
  const handleScoreCurrent = async () => {
    if (!current) return;
    setScoring(true);
    setError(null);
    try {
      const r = await api.post<{ id: string }>(
        "/job-tracker/ai/resume/report",
        { draftId: current.id }
      );
      router.push(`/resume?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScoring(false);
    }
  };

  // Bounce unauthenticated visitors to login.
  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
    }
  }, []);

  // Load drafts list on mount.
  const reloadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const list = await listDrafts();
      setDrafts(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadDrafts();
  }, [reloadDrafts]);

  // Load the selected draft (full content) when ?draft=<id> changes.
  useEffect(() => {
    if (!draftIdFromUrl) {
      setCurrent(null);
      return;
    }
    let cancelled = false;
    setCurrentLoading(true);
    getDraft(draftIdFromUrl)
      .then((d) => {
        if (!cancelled) setCurrent(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setCurrentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draftIdFromUrl]);

  // Switch which draft is open via the URL — that way the editor view is
  // shareable + survives reload.
  const openDraft = (id: string) => {
    router.push(`/resume-builder?draft=${id}`, { scroll: false });
  };

  const startNew = async (content: ApiDraftContent, title: string) => {
    setCreating(true);
    setError(null);
    try {
      const created = await createDraft({
        title,
        // Pass through the FE registry's default so new drafts land on
        // the parse-friendly template. Backend has its own default
        // (kept in sync at sypher-api/internal/jobtracker/store_resume_builder.go).
        templateId: defaultTemplateId,
        content
      });
      setCurrent(created);
      router.push(`/resume-builder?draft=${created.id}`, { scroll: false });
      // Refresh the rail so the new draft shows up.
      void reloadDrafts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Default new-draft path: open the TemplatePicker so the user can
  // see the available templates (live-rendered previews) and pick
  // one. The picker calls handleTemplateChosen with the selected
  // templateId, which then creates the actual draft with sample data
  // under that template.
  //
  // "Use my Profile" and "Start blank" stay direct (no picker) — they
  // bypass the template-choice step.
  const handleStartSample = () => setShowPicker(true);

  const handleTemplateChosen = (templateId: string) => {
    setShowPicker(false);
    // We still use the same startNew flow; the templateId arg is
    // honoured by the existing override block inside startNew (see
    // its `templateId: defaultTemplateId` line — replaced via a
    // wrapper below).
    void startNewWithTemplate(sampleDraftContent(), "Sample resume", templateId);
  };

  // startNewWithTemplate is a thin wrapper around startNew that
  // accepts an explicit templateId. Reuses the existing creation +
  // navigation flow.
  const startNewWithTemplate = async (
    content: ApiDraftContent,
    title: string,
    templateId: string
  ) => {
    setCreating(true);
    setError(null);
    try {
      const created = await createDraft({ title, templateId, content });
      setCurrent(created);
      router.push(`/resume-builder?draft=${created.id}`, { scroll: false });
      void reloadDrafts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleStartTrulyBlank = () =>
    void startNew(emptyDraftContent(), "Untitled resume");

  const handleStartFromProfile = async () => {
    setCreating(true);
    try {
      const content = await fromProfile();
      const title = content.personal.name
        ? `${content.personal.name}'s resume`
        : "Resume from profile";
      await startNew(content, title);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  // Autosave: editor calls onChange with the next content/title; we debounce
  // and PATCH after AUTOSAVE_MS of inactivity.
  const onEditorChange = useCallback(
    (next: Partial<Pick<ApiResumeBuilderDraft, "title" | "content">>) => {
      if (!current) return;
      // Apply locally immediately for preview liveness.
      setCurrent((c) => (c ? { ...c, ...next } : c));
      setSaveStatus("saving");
    },
    [current]
  );

  // Effect-driven autosave: every time `current` changes after an edit,
  // schedule a save. Cleanup cancels any pending save when a new edit fires.
  useEffect(() => {
    if (!current || saveStatus !== "saving") return;
    const handle = window.setTimeout(async () => {
      try {
        const saved = await saveDraft(current.id, {
          title: current.title,
          content: current.content
        });
        // Don't overwrite local content with the server echo — the user
        // may have typed during the round-trip. Just update timestamps.
        setCurrent((c) =>
          c && c.id === saved.id ? { ...c, updatedAt: saved.updatedAt } : c
        );
        setSaveStatus("saved");
        // Update the rail's updated_at so it reorders by recency.
        setDrafts((ds) =>
          ds.map((d) =>
            d.id === saved.id
              ? { ...d, title: saved.title, updatedAt: saved.updatedAt }
              : d
          )
        );
      } catch (e) {
        setError((e as Error).message);
        setSaveStatus("error");
      }
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.title, current?.content, saveStatus]);

  const handleDeleteCurrent = async () => {
    if (!current) return;
    if (!window.confirm(`Delete "${current.title}"? This cannot be undone.`)) return;
    try {
      await deleteDraft(current.id);
      setCurrent(null);
      router.push("/resume-builder", { scroll: false });
      void reloadDrafts();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ----- Renders -----
  const showEmptyState = !draftsLoading && drafts.length === 0 && !current;
  const showDraftsRail = drafts.length > 0 || !!current;

  return (
    <ProductFrame
      active="resume_builder"
      title="Resume Builder"
      intro="Build an ATS-friendly LaTeX resume from your profile data. Live preview, exports straight to your Vault."
      actions={
        current ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SaveBadge status={saveStatus} />
            <button
              type="button"
              className="ghost-button"
              onClick={handleDeleteCurrent}
              title="Delete this draft"
            >
              <TrashIcon width={12} height={12} /> Delete
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleScoreCurrent()}
              disabled={scoring}
              title="Run Resume AI scoring on this draft"
            >
              {scoring ? "Scoring…" : "Score this resume"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowExport(true)}
            >
              Export → PDF
            </button>
          </div>
        ) : drafts.length > 0 ? (
          <button
            type="button"
            className="primary-button"
            onClick={handleStartSample}
            disabled={creating}
          >
            <PlusIcon width={14} height={14} />{" "}
            {creating ? "Creating…" : "New from sample"}
          </button>
        ) : null
      }
    >
      {error ? (
        <section className="notice" style={{ marginTop: 12 }}>
          <em>{error}</em>
        </section>
      ) : null}

      {showEmptyState ? (
        <div className="community-empty" style={{ marginTop: 24 }}>
          <span className="community-empty-icon">
            <ResumeBuilderIcon width={22} height={22} />
          </span>
          <h3>Start your first resume</h3>
          <p>
            Open a fully filled sample to see how the export looks, pull your
            existing profile into a draft, or start from a clean slate. Either
            way, exports compile through real LaTeX for ATS-friendly PDFs.
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 4
            }}
          >
            <button
              type="button"
              className="primary-button"
              onClick={handleStartSample}
              disabled={creating}
            >
              <SparkleStarIcon width={14} height={14} />{" "}
              {creating ? "Creating…" : "Start with sample"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleStartFromProfile()}
              disabled={creating}
            >
              {creating ? "Loading…" : "Use my Profile"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleStartTrulyBlank}
              disabled={creating}
            >
              Start blank
            </button>
          </div>
        </div>
      ) : showDraftsRail ? (
        <div className="rb-shell">
          <aside className="rb-rail">
            <header className="rb-rail-head">
              <span className="rb-rail-head-label">Drafts</span>
              <span className="rb-rail-count" aria-hidden>
                {drafts.length}
              </span>
            </header>
            <button
              type="button"
              className="rb-rail-new"
              onClick={handleStartSample}
              disabled={creating}
            >
              <PlusIcon width={12} height={12} />
              <span>{creating ? "Creating…" : "New draft"}</span>
            </button>
            {draftsLoading ? (
              <p className="muted small" style={{ padding: "12px 14px" }}>
                Loading…
              </p>
            ) : (
              <ul className="rb-draft-list">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className={
                      d.id === current?.id
                        ? "rb-draft-item is-active"
                        : "rb-draft-item"
                    }
                    onClick={() => openDraft(d.id)}
                  >
                    <p className="rb-draft-title">{d.title}</p>
                    <p className="muted small rb-draft-sub">
                      {relativeTime(d.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <main className="rb-main">
            {currentLoading ? (
              <p className="muted small">Loading draft…</p>
            ) : current ? (
              <ResumeBuilderEditor
                draft={current}
                onChange={onEditorChange}
              />
            ) : (
              <div className="community-empty" style={{ marginTop: 12 }}>
                <h3>Pick a draft from the left</h3>
                <p>Or start a new one with the + button.</p>
              </div>
            )}
          </main>
        </div>
      ) : null}

      {showExport && current ? (
        <ExportModal
          draftId={current.id}
          onClose={() => setShowExport(false)}
        />
      ) : null}

      <TemplatePicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleTemplateChosen}
      />
    </ProductFrame>
  );
}

// Status-dot chip — the editor's autosave state. A pulsing dot during
// "saving", a checkmark on "saved", a warning glyph on "error". The
// chip reads as a status indicator at a glance instead of a label
// blending into surrounding muted text.
function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="rb-save-chip is-saving" aria-live="polite">
        <span className="rb-save-dot" aria-hidden />
        Saving
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="rb-save-chip is-saved" aria-live="polite">
        <svg
          className="rb-save-icon"
          viewBox="0 0 14 14"
          width="11"
          height="11"
          aria-hidden
        >
          <path
            d="M3 7.5 L6 10.5 L11.5 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Saved
      </span>
    );
  }
  return (
    <span className="rb-save-chip is-error" aria-live="polite">
      <span className="rb-save-icon" aria-hidden>
        !
      </span>
      Save failed
    </span>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ResumeBuilderPage() {
  // useSearchParams() needs a Suspense boundary for static prerender, same
  // pattern as the Activity shell (ADR-0005 D2).
  return (
    <Suspense fallback={null}>
      <ResumeBuilderInner />
    </Suspense>
  );
}
