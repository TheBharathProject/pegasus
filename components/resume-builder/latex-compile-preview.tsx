"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { renderPdf } from "@/lib/resume-builder";

// LatexCompilePreview replaces the HTML preview pane when the editor is in
// LaTeX mode. The HTML preview can't render arbitrary \tex, so it would
// keep showing form-derived content even after the user hand-edits the
// LaTeX — making edits feel like they don't apply. This component runs a
// real LaTeX compile against the saved draft and shows the resulting PDF
// in an iframe.
//
// Auto-compile behaviour (reverses ADR-0008 D10):
//   - Fires on mount so entering LaTeX mode doesn't leave the pane blank.
//   - Re-fires on sourceVersion change after a 2500ms debounce — safely
//     after the 2000ms autosave on the parent so the backend has the
//     latest .tex by the time we hit /render/pdf.
//   - The "Compile now" button stays as a manual override (skip the debounce).

type Phase =
  | { kind: "idle" }
  | { kind: "compiling" }
  | { kind: "pdf"; url: string }
  | { kind: "error"; status: number; message: string };

export function LatexCompilePreview({
  draftId,
  // Bump this when the user's LaTeX source changes — used to invalidate
  // the stale-pdf banner without auto-recompiling on every keystroke.
  sourceVersion
}: {
  draftId: string;
  sourceVersion: number;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [stale, setStale] = useState(false);
  // Stash created object URLs so we can revoke them on the next compile.
  const lastUrlRef = useRef<string | null>(null);
  // Track the in-flight compile timer so a new edit cancels a pending one.
  const compileTimerRef = useRef<number | null>(null);

  const compile = async () => {
    setPhase({ kind: "compiling" });
    setStale(false);
    try {
      const blob = await renderPdf(draftId);
      const url = URL.createObjectURL(blob);
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = url;
      setPhase({ kind: "pdf", url });
    } catch (e) {
      if (e instanceof ApiError) {
        setPhase({ kind: "error", status: e.status, message: e.message });
      } else {
        setPhase({ kind: "error", status: 0, message: (e as Error).message });
      }
    }
  };

  // Auto-compile on mount + on sourceVersion change. 2500ms debounce is
  // long enough that the parent's 2000ms autosave has flushed the latest
  // .tex to the backend before we hit /render/pdf, but short enough that
  // a paused-typing user sees the PDF refresh within ~3s.
  useEffect(() => {
    if (phase.kind === "pdf") setStale(true);
    if (compileTimerRef.current) {
      window.clearTimeout(compileTimerRef.current);
    }
    compileTimerRef.current = window.setTimeout(() => {
      compileTimerRef.current = null;
      void compile();
    }, 2500);
    return () => {
      if (compileTimerRef.current) {
        window.clearTimeout(compileTimerRef.current);
        compileTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceVersion, draftId]);

  // Clean up the most recent blob URL on unmount.
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rb-tex-preview">
      <header className="rb-tex-preview-head">
        <div>
          <h4 style={{ margin: 0, fontFamily: "var(--font-serif-stack)", fontSize: 15 }}>
            LaTeX preview
          </h4>
          <p className="muted small" style={{ margin: "2px 0 0" }}>
            Auto-compiles ~3s after you stop typing. Hit Compile to skip the wait.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            if (compileTimerRef.current) {
              window.clearTimeout(compileTimerRef.current);
              compileTimerRef.current = null;
            }
            void compile();
          }}
          disabled={phase.kind === "compiling"}
        >
          {phase.kind === "compiling"
            ? "Compiling…"
            : phase.kind === "pdf"
              ? stale
                ? "Compile now"
                : "Up to date"
              : "Compile now"}
        </button>
      </header>

      {phase.kind === "idle" ? (
        <div className="rb-tex-preview-blank">
          <p className="muted small" style={{ textAlign: "center" }}>
            Waiting for the first compile…
          </p>
        </div>
      ) : null}

      {phase.kind === "compiling" ? (
        <div className="rb-tex-preview-blank">
          <p className="muted small" style={{ textAlign: "center" }}>
            Compiling LaTeX…
          </p>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="rb-tex-preview-error">
          {phase.status === 503 ? (
            <p className="muted small" style={{ textAlign: "center" }}>
              PDF compilation isn&apos;t configured on this server. The export
              modal will fall back to showing the raw .tex source.
            </p>
          ) : (
            <>
              <p
                className="muted small"
                style={{
                  color: "var(--danger)",
                  marginBottom: 8,
                  fontWeight: 500
                }}
              >
                Compile failed
              </p>
              {/* Preformatted block so Tectonic's multi-line log output keeps
                  its line breaks. The `.rb-tex-preview-log` styling caps the
                  height so a massive log doesn't push the layout. */}
              <pre className="rb-tex-preview-log">{phase.message}</pre>
            </>
          )}
        </div>
      ) : null}

      {phase.kind === "pdf" ? (
        <>
          {stale ? (
            <p
              className="muted small"
              style={{ marginBottom: 6, color: "var(--text)" }}
            >
              Source changed — recompiling shortly…
            </p>
          ) : null}
          <iframe
            title="Compiled LaTeX preview"
            src={phase.url}
            className="rb-tex-preview-iframe"
          />
        </>
      ) : null}
    </div>
  );
}
