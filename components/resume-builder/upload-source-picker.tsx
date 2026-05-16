"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  parseResumeForBuilder,
  uploadResumeFile
} from "@/lib/resume-builder";
import type { ApiDraftContent } from "@/lib/api-client";

// UploadSourcePicker — modal for prefilling a new draft from an
// existing resume. Two input modes share one Parse button:
//   • file (.pdf / .txt) → R2 upload → server-side text extract → AI parse
//   • pasted text        → AI parse directly
//
// On success the modal hands {content, title} back to the parent so the
// existing startNew(content, title) flow can create the draft and
// navigate. The component never touches drafts itself — keeps the parse
// step pure and the create step retriable.

type Phase = "idle" | "uploading" | "parsing" | "done";

export function UploadSourcePicker({
  open,
  onClose,
  onParsed
}: {
  open: boolean;
  onClose: () => void;
  onParsed: (result: { content: ApiDraftContent; title: string }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset internal state every time the modal opens so a previously-
  // failed attempt doesn't leak into the new one.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPastedText("");
    setPasteMode(false);
    setPhase("idle");
    setError(null);
  }, [open]);

  // Escape closes; backdrop click closes; matches TemplatePicker.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "uploading" && phase !== "parsing") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, phase]);

  if (!open) return null;

  const busy = phase === "uploading" || phase === "parsing";
  const canSubmit =
    !busy && ((pasteMode && pastedText.trim().length >= 30) || (!pasteMode && !!file));

  const handleSubmit = async () => {
    setError(null);
    try {
      if (pasteMode) {
        setPhase("parsing");
        const result = await parseResumeForBuilder({ text: pastedText });
        track({ name: "resume_parsed", params: { source: "text" } });
        setPhase("done");
        onParsed(result);
      } else if (file) {
        setPhase("uploading");
        const { fileId } = await uploadResumeFile(file);
        setPhase("parsing");
        const result = await parseResumeForBuilder({ fileId });
        track({ name: "resume_parsed", params: { source: "file" } });
        setPhase("done");
        onParsed(result);
      }
    } catch (e) {
      setError((e as Error).message || "Couldn't parse the resume.");
      setPhase("idle");
    }
  };

  const phaseLabel =
    phase === "uploading"
      ? "Uploading resume…"
      : phase === "parsing"
        ? "Reading sections with AI…"
        : phase === "done"
          ? "Done — opening your draft."
          : null;

  return (
    <div
      className="rb-picker-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rb-upload-title"
    >
      <div className="rb-picker-shell" style={{ maxWidth: 640 }}>
        <header className="rb-picker-head">
          <div>
            <h2 id="rb-upload-title" className="rb-picker-title">
              Import from an existing resume
            </h2>
            <p className="muted small rb-picker-sub">
              Upload a PDF (or paste the text) and we&apos;ll fill in your
              name, experience, education, projects, and skills. Review and
              edit before exporting.
            </p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close import dialog"
          >
            Cancel
          </button>
        </header>

        <div style={{ padding: "0 22px 22px", display: "grid", gap: 14 }}>
          {!pasteMode ? (
            <>
              <button
                type="button"
                className="rb-upload-drop"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {file ? (
                  <span>
                    <strong>{file.name}</strong>
                    <span className="muted small" style={{ marginLeft: 8 }}>
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </span>
                ) : (
                  <span>
                    <strong>Choose a PDF</strong>
                    <span className="muted small" style={{ marginLeft: 8 }}>
                      .pdf or .txt, up to ~5 MB
                    </span>
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setError(null);
                }}
              />
              <button
                type="button"
                className="rb-upload-link"
                onClick={() => setPasteMode(true)}
                disabled={busy}
              >
                Paste text instead
              </button>
            </>
          ) : (
            <>
              <textarea
                className="feedback-box"
                rows={12}
                placeholder="Paste your resume text here…"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="rb-upload-link"
                onClick={() => setPasteMode(false)}
                disabled={busy}
              >
                Upload a file instead
              </button>
            </>
          )}

          {phaseLabel ? (
            <p className="muted small" aria-live="polite">
              {phaseLabel}
            </p>
          ) : null}

          {error ? (
            <section className="notice">
              <em>{error}</em>
            </section>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {busy ? "Working…" : "Parse and continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
