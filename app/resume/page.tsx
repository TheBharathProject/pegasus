"use client";

import { useEffect, useRef, useState } from "react";
import { ProductFrame } from "@/components/frames";
import { ArrowRightIcon, UploadIcon } from "@/components/icons";
import { renderMarkdown } from "@/lib/markdown";
import { api, ApiError } from "@/lib/api-client";
import { CREDIT_COSTS } from "@/lib/billing";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";

type AIReport = {
  id: string;
  reportMd: string;
  score: number;
  createdAt: string;
};

type AIUsage = {
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
};

const steps = ["Upload", "Level", "Job Info", "Results"];

export default function ResumeAiPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<AIReport | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    api
      .get<AIReport>("/job-tracker/ai/resume/report/latest")
      .then((r) => setReport(r))
      .catch((e: Error) => {
        if (!(e instanceof ApiError) || e.status !== 404) {
          /* ignore — no report yet */
        }
      });
    api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
  }, []);

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setStepIndex(1);
  };

  const generateFromText = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<AIReport>("/job-tracker/ai/resume/report", { text });
      setReport(r);
      setStepIndex(3);
      api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const generateFromFile = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const upload = await api.post<{ uploadUrl: string; file: { id: string } }>(
        "/job-tracker/resumes/upload-url",
        {
          kind: "resume",
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.type || "application/pdf",
          label: "AI Source"
        }
      );
      const putRes = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": f.type || "application/pdf" }
      });
      if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);
      await api.patch(`/job-tracker/resumes/${upload.file.id}/finalize`, { fileSize: f.size });
      const r = await api.post<AIReport>("/job-tracker/ai/resume/report", {
        fileId: upload.file.id
      });
      setReport(r);
      setStepIndex(3);
      api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProductFrame active="resume">
      <section style={{ paddingTop: 16 }}>
        <div className="stepper">
          {steps.map((step, index) => (
            <div className={index <= stepIndex ? "step active" : "step"} key={step}>
              <span className="step-number">{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        {report ? (
          <div
            className="last-report"
            onClick={() => setStepIndex(3)}
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "#2c2c2c",
                  color: "#b3b1ab"
                }}
              >
                <UploadIcon width={14} height={14} />
              </span>
              <div>
                <strong>Your last resume report is ready · score {report.score}/100</strong>
                <p className="muted">Click to view</p>
              </div>
            </div>
            <ArrowRightIcon width={16} height={16} />
          </div>
        ) : null}

        {error ? (
          <section className="notice">
            <em>{error}</em>
          </section>
        ) : null}

        {stepIndex === 3 && report ? (
          <article className="settings-section" style={{ marginTop: 24 }}>
            <div className="list-head">
              <div>
                <p className="eyebrow">Score</p>
                <h2 style={{ fontFamily: "var(--font-serif-stack)" }}>
                  {report.score} / 100
                </h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setStepIndex(0);
                  setFile(null);
                  setPastedText("");
                }}
              >
                Run another analysis
              </button>
            </div>
            {usage && usage.limit > 0 ? (
              <p className="muted small" style={{ marginTop: 8 }}>
                Tokens this month: {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
              </p>
            ) : null}
            <div
              className="markdown-preview"
              style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(report.reportMd) }}
            />
          </article>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 36, fontWeight: 400, fontFamily: "var(--font-serif-stack)" }}>
                {pasteMode ? "Paste your resume text" : "Upload your resume"}
              </h1>
              <p className="muted" style={{ marginTop: 12 }}>
                We&apos;ll analyze it and show you exactly where to improve.
              </p>
            </div>

            {pasteMode ? (
              <div style={{ width: "min(560px, 100%)", margin: "24px auto 0" }}>
                <textarea
                  className="feedback-box"
                  style={{ minHeight: 220 }}
                  placeholder="Paste your resume content here..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                  <button className="ghost-button" type="button" onClick={() => setPasteMode(false)}>
                    Back to upload
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!pastedText.trim() || busy}
                    onClick={() => generateFromText(pastedText)}
                  >
                    {busy ? "Analyzing…" : "Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="drop-zone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0] ?? null;
                    handleFile(f);
                    if (f) generateFromFile(f);
                  }}
                >
                  <div>
                    <div className="drop-icon">
                      <UploadIcon />
                    </div>
                    <strong style={{ color: "#ececea", fontSize: 16 }}>
                      {busy ? "Working…" : file ? file.name : "Drop your resume PDF here"}
                    </strong>
                    <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                      {file ? `${Math.round(file.size / 1024)} KB · ready to analyze` : "or click to browse"}
                    </p>
                    <p
                      className="muted small"
                      style={{
                        marginTop: 18,
                        fontFamily: "var(--font-serif-stack)",
                        fontStyle: "italic"
                      }}
                    >
                      We extract the text and never store the file.
                    </p>
                    <p
                      className="muted small"
                      style={{ marginTop: 6 }}
                    >
                      Free within your monthly AI quota; beyond that,{" "}
                      <strong>{CREDIT_COSTS.resumeReport} credits</strong>.
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    handleFile(f);
                    if (f) generateFromFile(f);
                    e.target.value = "";
                  }}
                />
              </>
            )}

            <p style={{ marginTop: 28, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setPasteMode((v) => !v)}
                style={{
                  background: "none",
                  border: 0,
                  color: "#ececea",
                  borderBottom: "1px solid #4a4a4a",
                  padding: "2px 0",
                  cursor: "pointer",
                  font: "inherit"
                }}
              >
                {pasteMode ? "Or upload a PDF" : "Or paste text manually"}
              </button>
            </p>
          </>
        )}
      </section>
    </ProductFrame>
  );
}
