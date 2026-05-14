"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";
import { DownloadIcon, FolderIcon } from "@/components/icons";
import { ApiError } from "@/lib/api-client";
import { renderPdf, renderTex, saveToVault } from "@/lib/resume-builder";

// Export modal — compile the draft via LaTeX, preview the resulting PDF,
// and offer "Save to Vault slot N" or "Download". When Tectonic is not
// installed on the server (dev environments) the server returns 503; we
// fall back to showing the raw .tex source so the user can at least eyeball
// the compiled-look approximation and copy the source elsewhere.

type Phase =
  | { kind: "compiling" }
  | { kind: "pdf"; url: string; blob: Blob }
  | { kind: "tex-fallback"; tex: string; reason: string }
  | { kind: "error"; message: string };

export function ExportModal({
  draftId,
  onClose
}: {
  draftId: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "compiling" });
  const [slot, setSlot] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Kick off the compile when the modal mounts.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const blob = await renderPdf(draftId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        createdUrl = url;
        setPhase({ kind: "pdf", url, blob });
      } catch (e) {
        if (cancelled) return;
        // 503 = tectonic_unavailable. Fall back to showing the .tex source so
        // the user can still see what would have compiled.
        if (e instanceof ApiError && e.status === 503) {
          try {
            const tex = await renderTex(draftId);
            if (cancelled) return;
            setPhase({
              kind: "tex-fallback",
              tex,
              reason: "PDF compilation isn't configured on this server. Showing the LaTeX source instead."
            });
          } catch (innerErr) {
            setPhase({ kind: "error", message: (innerErr as Error).message });
          }
          return;
        }
        setPhase({ kind: "error", message: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [draftId]);

  const handleSaveToVault = async () => {
    setSaving(true);
    try {
      const file = await saveToVault(draftId, slot);
      setSavedToast(`Saved to Vault slot ${slot} (${file.fileName})`);
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (phase.kind !== "pdf") return;
    const a = document.createElement("a");
    a.href = phase.url;
    a.download = "resume.pdf";
    a.click();
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Export resume"
      titleId="rb-export-title"
      width="min(900px, 94vw)"
    >
      {phase.kind === "compiling" ? (
        <p className="muted small">Compiling LaTeX… this usually takes 2–5 seconds.</p>
      ) : null}

      {phase.kind === "error" ? (
        <div className="rb-tex-preview-error">
          <p
            className="muted small"
            style={{ color: "var(--danger)", marginBottom: 8, fontWeight: 500 }}
          >
            Compile failed
          </p>
          <pre className="rb-tex-preview-log">{phase.message}</pre>
        </div>
      ) : null}

      {phase.kind === "tex-fallback" ? (
        <>
          <section className="notice" style={{ marginBottom: 10 }}>
            <em>{phase.reason}</em>
          </section>
          <textarea
            className="feedback-box"
            rows={18}
            readOnly
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            value={phase.tex}
          />
        </>
      ) : null}

      {phase.kind === "pdf" ? (
        <>
          <iframe
            title="Compiled resume PDF"
            src={phase.url}
            className="rb-export-iframe"
          />
          {savedToast ? (
            <p
              className="muted small"
              style={{ marginTop: 8, color: "var(--text)" }}
            >
              ✓ {savedToast}
            </p>
          ) : null}
        </>
      ) : null}

      <div
        className="ai-modal-foot"
        style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}
      >
        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
        {phase.kind === "pdf" ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginRight: "auto"
              }}
            >
              <label className="muted small" htmlFor="rb-slot">
                Slot
              </label>
              <select
                id="rb-slot"
                className="filter-select"
                value={slot}
                onChange={(e) => setSlot(parseInt(e.target.value, 10))}
                style={{ minWidth: 84 }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={handleDownload}
            >
              <DownloadIcon width={12} height={12} /> Download
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleSaveToVault()}
              disabled={saving}
            >
              <FolderIcon width={12} height={12} />{" "}
              {saving ? "Saving…" : `Save to slot ${slot}`}
            </button>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
