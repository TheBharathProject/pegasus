"use client";

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import { FileIcon, UploadIcon } from "@/components/icons";
import { ScoreCircle } from "@/components/resume-score/score-circle";
import { SectionNav } from "@/components/resume-score/section-nav";
import { SectionFindings } from "@/components/resume-score/section-findings";
import { type SectionKey } from "@/components/resume-score/sections";
import { VerdictPill } from "@/components/resume-score/verdict-pile";
import { AtsScoreCard } from "@/components/resume-score/ats-score-card";
import { SectionBars } from "@/components/resume-score/section-bars";
import { ScoreTabs, type ScoreTab } from "@/components/resume-score/tabs";
import { Checklist } from "@/components/resume-score/checklist";
import { ImprovementPlan } from "@/components/resume-score/improvement-plan";
import { CoreDiagnosis } from "@/components/resume-score/core-diagnosis";
import { PendingReportLoader } from "@/components/resume-score/pending-report-loader";
import {
  api,
  ApiError,
  downloadPDF,
  type ApiAIReport,
  type ApiAIReportSummary,
  type ApiAIReportsResponse,
  type ApiScoreReport
} from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";
import { CREDIT_COSTS } from "@/lib/billing";
import { goTo } from "@/lib/paths";

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

// Default rail selection when a fresh report loads — Work Experience is
// the most-clicked section in the on-screen layout.
const DEFAULT_SECTION: SectionKey = "work_experience";

export default function ResumeAiPage() {
  return (
    <Suspense fallback={null}>
      <ResumeAiPageInner />
    </Suspense>
  );
}

function ResumeAiPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusedId = searchParams?.get("id") ?? null;
  const tabParam = (searchParams?.get("tab") ?? "sections") as ScoreTab;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ApiAIReport | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>(DEFAULT_SECTION);
  // Tab state is URL-driven so refresh keeps the user on the same view
  // and the Copy Link button captures whichever tab is active.
  const [activeTab, setActiveTab] = useState<ScoreTab>(
    tabParam === "checklist" || tabParam === "plan" ? tabParam : "sections"
  );
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastReports, setPastReports] = useState<ApiAIReportSummary[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  // Wizard step state
  const [level, setLevel] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Two distinct load modes:
  //   - `?id=` present → open that report directly at the Results step
  //     (deep-link / notification / builder redirect).
  //   - `?id=` absent → reset to the upload wizard. Fetch the latest
  //     report into state so the "Last report ready" pill can show as
  //     a one-click shortcut, but stepIndex stays at 0 — bare
  //     /pegasus/resume should always feel like the start of a new
  //     analysis, even if you arrived here from a previous report.
  const loadReport = useCallback(async (id: string | null) => {
    if (!id) {
      // Explicit reset — otherwise component state from a prior
      // ?id=… navigation lingers and shows the old report at Step 3
      // without any backend call (the bug the user spotted).
      setStepIndex(0);
      setReport(null);
    }
    try {
      if (id) {
        const r = await api.get<ApiAIReport>(`/job-tracker/ai/resume/reports/${id}`);
        setReport(r);
        setActiveSection(DEFAULT_SECTION);
        setStepIndex(3);
      } else {
        // Fetch latest for the shortcut pill only — don't move
        // stepIndex; the user stays at the upload wizard.
        const r = await api.get<ApiAIReport>("/job-tracker/ai/resume/report/latest");
        setReport(r);
      }
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) {
        // 404 = no report yet, nothing to load.
      }
    }
  }, []);

  // Poll pending reports every 10s. Backend's GenerateResumeReport
  // returns 202 + a pending id; the AI work runs in a goroutine, and
  // the row's format flips from "pending" → "json" once the JSON body
  // lands. Effect lifecycle: starts when report.format === "pending",
  // clears interval when report becomes json/md OR component unmounts
  // OR user navigates to a different report id.
  useEffect(() => {
    if (!report || report.format !== "pending") return;
    const reportId = report.id;
    const t = setInterval(() => {
      api
        .get<ApiAIReport>(`/job-tracker/ai/resume/reports/${reportId}`)
        .then((next) => {
          // Only swap state if the id still matches — guards against
          // a race when the user navigates to a different report
          // while a poll is in flight.
          setReport((prev) => (prev?.id === reportId ? next : prev));
        })
        .catch(() => {
          // Transient failure (e.g. backend restart) — keep polling.
        });
    }, 10000);
    return () => clearInterval(t);
  }, [report]);

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    void loadReport(focusedId);
    api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
    api
      .get<ApiAIReportsResponse>("/job-tracker/ai/resume/reports?limit=10")
      .then((r) => setPastReports(r.items ?? []))
      .catch(() => {});
  }, [focusedId, loadReport]);

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
      let r: ApiAIReport;
      if (pasteMode) {
        r = await api.post<ApiAIReport>("/job-tracker/ai/resume/report", {
          text: pastedText,
          ...extra
        });
      } else if (file) {
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
        await api.patch(`/job-tracker/resumes/${upload.file.id}/finalize`, {
          fileSize: file.size
        });
        r = await api.post<ApiAIReport>("/job-tracker/ai/resume/report", {
          fileId: upload.file.id,
          ...extra
        });
      } else {
        throw new Error("No resume provided");
      }
      setReport(r);
      setActiveSection(DEFAULT_SECTION);
      setStepIndex(3);
      // Update URL so the report becomes shareable / refreshable.
      router.replace(`/resume?id=${r.id}`, { scroll: false });
      api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
      // Refresh history strip.
      api
        .get<ApiAIReportsResponse>("/job-tracker/ai/resume/reports?limit=10")
        .then((res) => setPastReports(res.items ?? []))
        .catch(() => {});
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
    setReport(null);
    setCopyState("idle");
    router.replace("/resume", { scroll: false });
  };

  const copyLink = async () => {
    if (!report) return;
    // Include the active tab so the recipient lands on the same view.
    const tabSuffix = activeTab === "sections" ? "" : `&tab=${activeTab}`;
    const url = `${window.location.origin}/pegasus/resume?id=${report.id}${tabSuffix}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setError("Couldn't copy link — your browser blocked clipboard access.");
    }
  };

  // Switch tabs and reflect into the URL so refresh keeps state.
  const selectTab = (next: ScoreTab) => {
    setActiveTab(next);
    if (!report) return;
    const tabSuffix = next === "sections" ? "" : `&tab=${next}`;
    router.replace(`/resume?id=${report.id}${tabSuffix}`, { scroll: false });
  };

  const downloadReportPdf = async () => {
    if (!report) return;
    const path =
      report.format === "json"
        ? `/job-tracker/ai/resume/reports/${report.id}/pdf`
        : "/job-tracker/ai/resume/report/latest/pdf";
    try {
      await downloadPDF(
        path,
        null,
        `resume-score-${new Date().toISOString().slice(0, 10)}.pdf`
      );
    } catch (e) {
      window.alert(`Download failed: ${(e as Error).message}`);
    }
  };

  const isLegacy = report?.format === "md";
  const scoreReport: ApiScoreReport | null =
    report?.format === "json" && report.reportJson ? report.reportJson : null;
  // v2 detection mirrors the backend's ScoreReport.IsV2: both ats_score
  // (truthy) AND a non-empty checklist must be present.
  const isV2Report = !!(
    scoreReport &&
    (scoreReport.ats_score ?? 0) > 0 &&
    (scoreReport.checklist?.length ?? 0) > 0
  );

  return (
    <ProductFrame active="resume">
      <section style={{ paddingTop: 16 }}>
        {/* The 4-step stepper is only useful during the wizard
            (Upload → Level → Job Info). Hide it on the Results step
            (pending loader OR rendered report) so the score view is
            uncluttered. Returning to the wizard via "Score Another"
            resets stepIndex and brings the stepper back. */}
        {stepIndex !== 3 ? (
        <div className="stepper">
          {steps.map((step, index) => {
            const stateClass =
              index < stepIndex
                ? "step completed"
                : index === stepIndex
                  ? "step active"
                  : "step";
            return (
              <Fragment key={step}>
                {index > 0 && <div className="step-line" />}
                <div className={stateClass}>
                  <span className="step-number">
                    {index < stepIndex ? "✓" : index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        ) : null}

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
                  Score <strong style={{ color: "var(--text)" }}>{report.score}/100</strong>{" "}
                  · tap to view
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <section className="notice">
            <em>{error}</em>
          </section>
        ) : null}

        {/* Step 3 — Results */}
        {stepIndex === 3 && report && report.format === "pending" ? (
          <PendingReportLoader />
        ) : stepIndex === 3 && report && scoreReport ? (
          <>
            <div className="rs-header" style={{ marginTop: 24 }}>
              <div>
                <h1>Resume Score</h1>
                <p className="rs-header-summary">{scoreReport.executive_summary}</p>
              </div>
              <div className="rs-header-actions">
                <button className="ghost-button" type="button" onClick={() => void copyLink()}>
                  {copyState === "copied" ? "Copied!" : "Copy Link"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void downloadReportPdf()}
                >
                  Download Report
                </button>
                <button className="ghost-button" type="button" onClick={resetWizard}>
                  Score Another
                </button>
              </div>
            </div>

            {isV2Report ? (
              <>
                {scoreReport.core_diagnosis ? (
                  <CoreDiagnosis diagnosis={scoreReport.core_diagnosis} />
                ) : null}

                {scoreReport.verdict_pile ? (
                  <VerdictPill
                    pile={scoreReport.verdict_pile}
                    tagline={scoreReport.verdict_tagline}
                  />
                ) : null}

                <div className="rs-score-row">
                  <ScoreCircle score={scoreReport.overall_score} />
                  <AtsScoreCard score={scoreReport.ats_score ?? 0} />
                  <SectionBars report={scoreReport} />
                </div>

                <ScoreTabs active={activeTab} onSelect={selectTab} />

                {activeTab === "sections" ? (
                  <div className="rs-shell">
                    <aside className="rs-rail">
                      <SectionNav
                        report={scoreReport}
                        active={activeSection}
                        onSelect={setActiveSection}
                      />
                    </aside>
                    <SectionFindings
                      sectionKey={activeSection}
                      section={scoreReport.sections[activeSection]}
                    />
                  </div>
                ) : null}

                {activeTab === "checklist" ? (
                  <Checklist items={scoreReport.checklist ?? []} />
                ) : null}

                {activeTab === "plan" ? (
                  <ImprovementPlan items={scoreReport.improvement_plan ?? []} />
                ) : null}
              </>
            ) : (
              // v1 report layout — keep the original side-rail view.
              <div className="rs-shell">
                <aside className="rs-rail">
                  <ScoreCircle score={scoreReport.overall_score} />
                  <SectionNav
                    report={scoreReport}
                    active={activeSection}
                    onSelect={setActiveSection}
                  />
                </aside>
                <SectionFindings
                  sectionKey={activeSection}
                  section={scoreReport.sections[activeSection]}
                />
              </div>
            )}

            {pastReports.length > 1 ? (
              <div className="rs-past-strip">
                <h3>Past reports</h3>
                <ul className="rs-past-list">
                  {pastReports
                    .filter((r) => r.id !== report.id)
                    .slice(0, 8)
                    .map((r) => (
                      <li key={r.id} className="rs-past-row">
                        <span
                          className={
                            r.score >= 80
                              ? "rs-section-chip rs-section-chip--strong"
                              : r.score >= 60
                                ? "rs-section-chip rs-section-chip--ok"
                                : "rs-section-chip rs-section-chip--weak"
                          }
                        >
                          {r.score}
                        </span>
                        <span className="rs-past-row-meta">
                          {r.resumeFilename || (r.draftId ? "Resume Builder draft" : "Pasted text")}{" "}
                          · {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                        <a href={`/pegasus/resume?id=${r.id}`}>View →</a>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {usage && usage.limit > 0 ? (
              <p className="muted small" style={{ marginTop: 18 }}>
                Tokens this month: {usage.used.toLocaleString()} /{" "}
                {usage.limit.toLocaleString()}
              </p>
            ) : null}
          </>
        ) : stepIndex === 3 && report && isLegacy ? (
          <article className="settings-section" style={{ marginTop: 24 }}>
            <p className="muted">
              This report uses the legacy Markdown format. Generate a new one to
              see the structured score view.
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => void downloadReportPdf()}
              >
                Download legacy PDF
              </button>
              <button className="primary-button" type="button" onClick={resetWizard}>
                Score Another
              </button>
            </div>
          </article>
        ) : stepIndex === 2 ? (
          /* Step 2 — Job Info */
          <div style={{ width: "min(560px, 100%)", margin: "32px auto 0" }}>
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  fontSize: "clamp(20px, 5vw, 28px)",
                  fontWeight: 400,
                  fontFamily: "var(--font-serif-stack)"
                }}
              >
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
              <h1
                style={{
                  fontSize: "clamp(20px, 5vw, 28px)",
                  fontWeight: 400,
                  fontFamily: "var(--font-serif-stack)"
                }}
              >
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
                  style={{
                    textAlign: "left",
                    justifyContent: "flex-start",
                    width: "100%",
                    padding: "12px 16px"
                  }}
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
              <h1
                style={{
                  fontSize: "clamp(22px, 6vw, 36px)",
                  fontWeight: 400,
                  fontFamily: "var(--font-serif-stack)"
                }}
              >
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
                      {file
                        ? `${Math.round(file.size / 1024)} KB · ready to continue`
                        : "or click to browse"}
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
