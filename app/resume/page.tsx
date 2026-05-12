"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ProductFrame } from "@/components/frames";
import { ArrowRightIcon, FileIcon, UploadIcon } from "@/components/icons";
import { renderMarkdown } from "@/lib/markdown";
import { api, ApiError, downloadPDF } from "@/lib/api-client";
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

const LEVELS = [
  { value: "Fresher", label: "Fresher (0 YOE)" },
  { value: "Junior", label: "Junior (0–2 YOE)" },
  { value: "Mid", label: "Mid (2–5 YOE)" },
  { value: "Senior", label: "Senior (5+ YOE)" },
  { value: "Lead", label: "Lead (8+ YOE)" }
];

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

  // Wizard step 1 — level
  const [level, setLevel] = useState("");
  // Wizard step 2 — job context
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");

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

  const handleTextContinue = () => {
    if (!pastedText.trim()) return;
    setStepIndex(1);
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const extra = { level, targetRole, jobDescription };
      let r: AIReport;
      if (pasteMode) {
        r = await api.post<AIReport>("/job-tracker/ai/resume/report", {
          text: pastedText,
          ...extra
        });
      } else if (file) {
        // Upload file first, then generate
        const upload = await api.post<{ uploadUrl: string; file: { id: string } }>(
          "/job-tracker/resumes/upload-url",
          {
            kind: "resume",
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf",
            label: "AI Source"
          }
        );
        const putRes = await fetch(upload.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/pdf" }
        });
        if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);
        await api.patch(`/job-tracker/resumes/${upload.file.id}/finalize`, { fileSize: file.size });
        r = await api.post<AIReport>("/job-tracker/ai/resume/report", {
          fileId: upload.file.id,
          ...extra
        });
      } else {
        throw new Error("No resume provided");
      }
      setReport(r);
      setStepIndex(3);
      api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetWizard = () => {
    setStepIndex(0);
    setFile(null);
    setPastedText("");
    setLevel("");
    setTargetRole("");
    setJobDescription("");
    setError(null);
  };

  return (
    <ProductFrame active="resume">
      <section style={{ paddingTop: 16 }}>
        <div className="stepper">
          {steps.map((step, index) => {
            const stateClass =
              index < stepIndex ? "step completed" : index === stepIndex ? "step active" : "step";
            return (
              <Fragment key={step}>
                {index > 0 && <div className="step-line" />}
                <div className={stateClass}>
                  <span className="step-number">{index < stepIndex ? "✓" : index + 1}</span>
                  <span>{step}</span>
                </div>
              </Fragment>
            );
          })}
        </div>

        {report && stepIndex !== 3 ? (
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
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--chip)",
                  color: "var(--text-soft)",
                  flexShrink: 0
                }}
              >
                <FileIcon width={15} height={15} />
              </span>
              <div>
                <strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>
                  Last report ready
                </strong>
                <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                  Score <strong style={{ color: "var(--text)" }}>{report.score}/100</strong> · tap to view
                </p>
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

        {/* Step 3 — Results */}
        {stepIndex === 3 && report ? (
          <article className="settings-section" style={{ marginTop: 24 }}>
            <div className="list-head">
              <div>
                <p className="eyebrow">Score</p>
                <h2 style={{ fontFamily: "var(--font-serif-stack)" }}>
                  {report.score} / 100
                </h2>
              </div>
              <div className="resume-report-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    downloadPDF(
                      "/job-tracker/ai/resume/report/latest/pdf",
                      null,
                      `resume-report-${new Date().toISOString().slice(0, 10)}.pdf`
                    ).catch((e: Error) => window.alert(`Download failed: ${e.message}`));
                  }}
                >
                  Download report
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={resetWizard}
                >
                  Run another analysis
                </button>
              </div>
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
        ) : stepIndex === 2 ? (
          /* Step 2 — Job Info */
          <div style={{ width: "min(560px, 100%)", margin: "32px auto 0" }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "clamp(20px, 5vw, 28px)", fontWeight: 400, fontFamily: "var(--font-serif-stack)" }}>
                What role are you targeting?
              </h1>
              <p className="muted" style={{ marginTop: 8 }}>
                Optional — but more context means a sharper report.
              </p>
            </div>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label>Target role</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Backend Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Job description</label>
                <textarea
                  className="feedback-box"
                  style={{ minHeight: 140 }}
                  placeholder="Paste the JD here for tailored feedback…"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button className="ghost-button" type="button" onClick={() => setStepIndex(1)}>
                Back
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={() => void generate()}
              >
                {busy ? "Analyzing…" : "Generate report"}
              </button>
            </div>
          </div>
        ) : stepIndex === 1 ? (
          /* Step 1 — Level */
          <div style={{ width: "min(480px, 100%)", margin: "32px auto 0" }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "clamp(20px, 5vw, 28px)", fontWeight: 400, fontFamily: "var(--font-serif-stack)" }}>
                What&apos;s your experience level?
              </h1>
              <p className="muted" style={{ marginTop: 8 }}>
                We calibrate the feedback to where you are in your career.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
              {LEVELS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={level === value ? "primary-button" : "ghost-button"}
                  style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", padding: "12px 16px" }}
                  onClick={() => setLevel(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button className="ghost-button" type="button" onClick={() => setStepIndex(0)}>
                Back
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => setStepIndex(2)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          /* Step 0 — Upload */
          <>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <h1 style={{ fontSize: "clamp(22px, 6vw, 36px)", fontWeight: 400, fontFamily: "var(--font-serif-stack)" }}>
                {pasteMode ? "Paste your resume text" : "Upload your resume"}
              </h1>
              <p className="muted" style={{ marginTop: 8 }}>
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
                    disabled={!pastedText.trim()}
                    onClick={handleTextContinue}
                  >
                    Continue
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
                  }}
                >
                  <div>
                    <div className="drop-icon">
                      <UploadIcon />
                    </div>
                    <strong style={{ color: "#ececea", fontSize: 16 }}>
                      {file ? file.name : "Drop your resume PDF here"}
                    </strong>
                    <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                      {file ? `${Math.round(file.size / 1024)} KB · ready to continue` : "or click to browse"}
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
                    <p className="muted small" style={{ marginTop: 6 }}>
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
                    e.target.value = "";
                  }}
                />
              </>
            )}

            <button
              type="button"
              className="resume-paste-toggle"
              onClick={() => setPasteMode((v) => !v)}
              style={{
                marginTop: 20,
                display: "block",
                width: "min(560px, 100%)",
                marginLeft: "auto",
                marginRight: "auto",
                padding: "10px 16px",
                background: "none",
                border: 0,
                borderBottom: "1px solid #4a4a4a",
                color: "#ececea",
                cursor: "pointer",
                font: "inherit",
                textAlign: "center"
              }}
            >
              {pasteMode ? "Or upload a PDF" : "Or paste text manually"}
            </button>
          </>
        )}
      </section>
    </ProductFrame>
  );
}
