"use client";

// LatexCompilePreview is the right-pane PDF view — controlled by the
// editor (phase + stale flag live there so the blob URL survives
// HTML↔PDF toggles). This component is now header-less; the editor
// hosts the compile button + stale hint inline with the preview-mode
// toggle so both HTML and PDF panels start at the same Y, and toggling
// doesn't shove the document up or down.

export type PdfPhase =
  | { kind: "idle" }
  | { kind: "compiling" }
  | { kind: "pdf"; url: string }
  | { kind: "error"; status: number; message: string };

export function LatexCompilePreview({
  phase
}: {
  phase: PdfPhase;
}) {
  return (
    <div className="rb-tex-preview">
      {phase.kind === "idle" ? (
        <div className="rb-tex-preview-blank">
          <p className="muted small" style={{ textAlign: "center" }}>
            No PDF yet — click Compile to render.
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
              <pre className="rb-tex-preview-log">{phase.message}</pre>
            </>
          )}
        </div>
      ) : null}

      {phase.kind === "pdf" ? (
        <iframe
          title="Compiled LaTeX preview"
          // PDF Open Parameters strip Chrome's built-in viewer chrome
          // (top toolbar, side nav, scrollbar) so the iframe shows just
          // the document — much cleaner inside our preview pane.
          src={`${phase.url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="rb-tex-preview-iframe"
        />
      ) : null}
    </div>
  );
}
