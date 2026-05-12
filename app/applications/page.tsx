"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import { MetricCard, ModalShell, Pill } from "@/components/ui";
import { ApplicationTimeline } from "@/components/timeline";
import { ImportModal } from "@/components/import-modal";
import {
  api,
  apiBaseUrl,
  downloadPDF,
  type ApiApplication,
  type ApiApplicationPage,
  type ApiStageChange
} from "@/lib/api-client";
import { CREDIT_COSTS } from "@/lib/billing";
import { getToken, isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";
import {
  BellIcon,
  BoardIcon,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  ImportIcon,
  ListIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  SparkleStarIcon,
  TrashIcon,
  UploadIcon,
  WandIcon
} from "@/components/icons";

const STAGE_LABELS: Record<string, string> = {
  INTERESTED: "Interested",
  APPLIED: "Applied",
  PHONE_SCREEN: "Phone screen",
  TECHNICAL: "Technical",
  ONSITE: "Onsite",
  OFFER: "Offer",
  REJECTED: "Rejected"
};

const STAGE_TONES: Record<string, string> = {
  INTERESTED: "stage-interest",
  APPLIED: "stage-applied",
  PHONE_SCREEN: "stage-screen",
  TECHNICAL: "stage-screen",
  ONSITE: "stage-screen",
  OFFER: "stage-offer",
  REJECTED: "default"
};

const STAGES = Object.keys(STAGE_LABELS);

// SOURCE_LABELS maps the canonical UPPERCASE enum (what the server
// stores + validates) to readable display text. Used in table + detail
// renders. Keep keys aligned with backend `validSources` in
// internal/jobtracker/types.go.
const SOURCE_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  NAUKRI: "Naukri",
  REFERRAL: "Referral",
  COMPANY_SITE: "Company site",
  OTHER: "Other"
};

const EMPTY_DRAFT = {
  company: "",
  role: "",
  stage: "INTERESTED",
  // Empty value matches the leading "—" option; the backend accepts
  // null/empty source. Picking explicitly is optional.
  source: "",
  appliedAt: new Date().toISOString().slice(0, 10),
  applyDeadline: "",
  location: "",
  salaryRange: "",
  jobLink: "",
  jobDescription: "",
  notes: "",
  stale: false
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtRelative(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

// Outer wrapper: useSearchParams() bails out of static prerender unless
// it's read inside a Suspense boundary. The list page is auth-gated and
// runs entirely client-side, but Next still tries to prerender it during
// `next build` — the Suspense satisfies that bail-out check. Same
// pattern as app/auth/callback/page.tsx.
export default function ApplicationsPage() {
  return (
    <Suspense fallback={null}>
      <ApplicationsInner />
    </Suspense>
  );
}

function ApplicationsInner() {
  // Router + search params drive the deep-link flow — visiting
  // /applications?view=<id> (or /applications/<id> via the redirector
  // at app/applications/[id]/page.tsx) opens the viewing modal for that
  // row. Closing the modal strips the param so the URL stays clean.
  // Documented in ADR-0005.
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get("view") ?? null;

  const [items, setItems] = useState<ApiApplication[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ApiStageChange[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  // Toast for "application not found" when ?view=<id> doesn't match a
  // loaded row after the grace window. Auto-dismisses.
  const [viewToast, setViewToast] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(true);
  const tweakFileRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // AI tools dialogs
  const [showCoverDialog, setShowCoverDialog] = useState(false);
  const [showTweakDialog, setShowTweakDialog] = useState(false);
  const [coverJD, setCoverJD] = useState("");
  const [tweakJD, setTweakJD] = useState("");
  const [tweakFile, setTweakFile] = useState<File | null>(null);
  const [tweakResumeId, setTweakResumeId] = useState<string | null>(null);
  // Resume-tweak revision state. tweakResult holds the latest AI output
  // so the modal can render it inline; tweakHistory lists past versions
  // for this application (lightweight summaries); tweakParentId is set
  // when the user clicks "Continue" on a past version, forming the
  // revision chain via the backend's parentId field.
  const [tweakResult, setTweakResult] = useState<{
    id: string;
    title: string;
    tweakedText: string;
    userEdits?: string;
    parentId?: string | null;
    createdAt: string;
  } | null>(null);
  const [tweakHistory, setTweakHistory] = useState<
    Array<{ id: string; title: string; parentId?: string | null; createdAt: string }>
  >([]);
  const [tweakParentId, setTweakParentId] = useState<string | null>(null);
  const [vaultResumes, setVaultResumes] = useState<
    Array<{ id: string; fileName: string; label?: string }>
  >([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [coverLetterText, setCoverLetterText] = useState<string | null>(null);

  // Reminders
  const [reminderApp, setReminderApp] = useState<ApiApplication | null>(null);
  const [reminderAt, setReminderAt] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const viewingApp = useMemo(
    () => items.find((a) => a.id === viewingId) ?? null,
    [items, viewingId]
  );

  const refresh = async () => {
    try {
      setLoading(true);
      const page = await api.get<ApiApplicationPage>("/job-tracker/applications");
      setItems(page.items);
      setNextCursor(page.nextCursor ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<ApiApplicationPage>(
        `/job-tracker/applications?cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    refresh();
  }, []);

  const summary = useMemo(() => {
    const total = items.length;
    const inPipeline = items.filter((a) => a.stage !== "REJECTED" && a.stage !== "OFFER").length;
    const interviews = items.filter((a) => ["PHONE_SCREEN", "TECHNICAL", "ONSITE"].includes(a.stage)).length;
    const offers = items.filter((a) => a.stage === "OFFER").length;
    return { total, inPipeline, interviews, offers };
  }, [items]);

  const openNew = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setShowModal(true);
  };

  const openEdit = (a: ApiApplication) => {
    setEditingId(a.id);
    setDraft({
      company: a.company ?? "",
      role: a.role ?? "",
      stage: a.stage ?? "INTERESTED",
      source: a.source ?? "",
      appliedAt: a.appliedAt ? a.appliedAt.slice(0, 10) : "",
      applyDeadline: a.applyDeadline ? a.applyDeadline.slice(0, 10) : "",
      location: a.location ?? "",
      salaryRange: a.salaryRange ?? "",
      jobLink: a.jobLink ?? "",
      jobDescription: a.jobDescription ?? "",
      notes: a.notes ?? "",
      stale: a.stale ?? false
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  // Drag-and-drop on the board: when a card is dropped on a different
  // column we PUT the application with the new stage. Optimistic UI:
  // patch local items first so the card jumps immediately, then refresh
  // from the server to pick up stage_changed_at + history.
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);

  const moveAppToStage = async (appId: string, nextStage: string) => {
    const current = items.find((a) => a.id === appId);
    if (!current || current.stage === nextStage) return;
    setItems((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, stage: nextStage } : a))
    );
    try {
      await api.put(`/job-tracker/applications/${appId}`, {
        company: current.company,
        role: current.role,
        source: current.source ?? "",
        location: current.location ?? "",
        salaryRange: current.salaryRange ?? "",
        stage: nextStage,
        appliedAt: current.appliedAt ?? "",
        applyDeadline: current.applyDeadline ?? "",
        jobLink: current.jobLink ?? "",
        jobDescription: current.jobDescription ?? "",
        notes: current.notes ?? "",
        stale: current.stale
      });
      await refresh();
    } catch (e) {
      // Roll back on failure.
      setItems((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, stage: current.stage } : a))
      );
      window.alert(`Could not move card: ${(e as Error).message}`);
    }
  };

  const handleSave = async () => {
    if (!draft.company.trim() || !draft.role.trim()) return;
    try {
      if (editingId) {
        await api.put(`/job-tracker/applications/${editingId}`, draft);
      } else {
        await api.post("/job-tracker/applications", draft);
      }
      closeModal();
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const openView = (a: ApiApplication) => {
    setViewingId(a.id);
    setTimeline([]);
    setTimelineLoading(true);
    api
      .get<ApiStageChange[]>(`/job-tracker/applications/${a.id}/timeline`)
      .then((rows) => setTimeline(rows ?? []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false));
  };
  const closeView = () => {
    setViewingId(null);
    setTimeline([]);
    // Strip ?view= from the URL when the modal closes so the page URL
    // stays clean and the back button doesn't reopen the modal.
    if (viewParam) {
      router.replace("/applications", { scroll: false });
    }
  };

  // Deep-link effect: when ?view=<id> is set in the URL, find the
  // matching application in the loaded list and open it in the
  // viewing modal. If items are still loading, this will retry once
  // they arrive (effect re-runs on items.length change). After a 1.2s
  // grace window we give up with a "not found" toast — this handles
  // an id that's truly missing or doesn't belong to the user.
  useEffect(() => {
    if (!viewParam) return;
    if (viewingId === viewParam) return; // already open
    if (items.length === 0) {
      // Items not loaded yet; if loading is done already, the id
      // must be bogus — show the toast.
      if (!loading) {
        setViewToast("Application not found");
        const t = setTimeout(() => setViewToast(null), 2400);
        return () => clearTimeout(t);
      }
      return;
    }
    const match = items.find((a) => a.id === viewParam);
    if (match) {
      openView(match);
    } else {
      setViewToast("Application not found");
      const t = setTimeout(() => setViewToast(null), 2400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParam, items.length, loading]);

  // Load past tweaks for this application whenever the tweak modal opens.
  // Reset prior result + parent so each session starts clean — the user
  // can pick "Continue" on a past version to set parentId again.
  useEffect(() => {
    if (!showTweakDialog || !viewingApp) return;
    setTweakResult(null);
    setTweakParentId(null);
    api
      .get<{ items: typeof tweakHistory }>(
        `/job-tracker/ai/resume/tweaks?applicationId=${encodeURIComponent(viewingApp.id)}`
      )
      .then((r) => setTweakHistory(r.items || []))
      .catch(() => setTweakHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTweakDialog, viewingApp?.id]);

  const editFromView = () => {
    const a = viewingApp;
    if (!a) return;
    setViewingId(null);
    openEdit(a);
  };

  const deleteApp = async (a: ApiApplication) => {
    if (!window.confirm(`Delete "${a.company} — ${a.role}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/job-tracker/applications/${a.id}`);
      if (viewingId === a.id) setViewingId(null);
      if (editingId === a.id) closeModal();
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const openCoverDialog = () => {
    if (!viewingApp) return;
    setCoverJD(viewingApp.jobDescription ?? "");
    setAiError(null);
    setCoverLetterText(null);
    setShowCoverDialog(true);
  };

  const openTweakDialog = () => {
    if (!viewingApp) return;
    setTweakJD(viewingApp.jobDescription ?? "");
    setTweakFile(null);
    setTweakResumeId(null);
    setAiError(null);
    api
      .get<Array<{ id: string; fileName: string; label?: string }>>("/job-tracker/resumes")
      .then((rs) => setVaultResumes(rs ?? []))
      .catch(() => setVaultResumes([]));
    setShowTweakDialog(true);
  };

  const handleGenerateCover = async () => {
    if (!viewingApp || !coverJD.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await api.post<{ text?: string; coverLetterText?: string }>("/job-tracker/ai/cover-letter", {
        applicationId: viewingApp.id,
        jobDescription: coverJD
      });
      const text = result?.text ?? result?.coverLetterText ?? null;
      setCoverLetterText(text);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleGenerateTweak = async () => {
    if (!viewingApp || !tweakJD.trim()) return;
    // A source resume is required for ROOT tweaks; if tweakParentId is set
    // the backend resolves source from the parent row, so a fresh upload
    // isn't needed for a "Continue" action.
    if (!tweakParentId && !tweakFile && !tweakResumeId) {
      setAiError("Pick a resume from your vault or upload a new one.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      let resumeFileId = tweakResumeId;
      if (tweakFile) {
        const upload = await api.post<{ uploadUrl: string; file: { id: string } }>(
          "/job-tracker/resumes/upload-url",
          {
            kind: "resume",
            fileName: tweakFile.name,
            fileSize: tweakFile.size,
            mimeType: tweakFile.type || "application/pdf",
            label: "Tweak source"
          }
        );
        const putRes = await fetch(upload.uploadUrl, {
          method: "PUT",
          body: tweakFile,
          headers: { "Content-Type": tweakFile.type || "application/pdf" }
        });
        if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
        await api.patch(`/job-tracker/resumes/${upload.file.id}/finalize`, {
          fileSize: tweakFile.size
        });
        resumeFileId = upload.file.id;
      }
      const title = `${viewingApp.company} — ${viewingApp.role}`.slice(0, 120);
      const saved = await api.post<{
        id: string;
        title: string;
        tweakedText: string;
        userEdits?: string;
        parentId?: string | null;
        createdAt: string;
      }>("/job-tracker/ai/resume/tweaks", {
        applicationId: viewingApp.id,
        parentId: tweakParentId || "",
        sourceFileId: resumeFileId || "",
        prompt: tweakJD,
        title
      });
      setTweakResult(saved);
      // Refresh the history so the new row shows up in the past-versions list.
      api
        .get<{ items: typeof tweakHistory }>(
          `/job-tracker/ai/resume/tweaks?applicationId=${encodeURIComponent(viewingApp.id)}`
        )
        .then((r) => setTweakHistory(r.items || []))
        .catch(() => {});
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  // Continue tweaking from a past version. Sets parentId so the next
  // generation chains from that row, clears file/upload (source carries
  // forward from the parent), and resets the result panel.
  const continueFromTweak = (id: string) => {
    setTweakParentId(id);
    setTweakResult(null);
    setTweakFile(null);
    setTweakResumeId(null);
    setAiError(null);
  };

  const handleExport = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBaseUrl()}/job-tracker/applications/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "applications.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(`Export failed: ${(e as Error).message}`);
    }
  };

  return (
    <ProductFrame
      active="applications"
      title="Applications"
      intro="One company at a time. The pipeline is patience made visible."
      actions={
        <div className="toolbar">
          <div className="segmented-control" aria-label="View mode">
            <button
              className={view === "list" ? "segmented-button active" : "segmented-button"}
              onClick={() => setView("list")}
              type="button"
            >
              <ListIcon width={14} height={14} /> List
            </button>
            <button
              className={view === "board" ? "segmented-button active" : "segmented-button"}
              onClick={() => setView("board")}
              type="button"
            >
              <BoardIcon width={14} height={14} /> Board
            </button>
          </div>
          <button className="ghost-button" onClick={handleExport} type="button">
            <DownloadIcon width={14} height={14} /> Export
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setImportOpen(true)}
          >
            <ImportIcon width={14} height={14} /> Import
          </button>
          <button className="primary-button" onClick={openNew} type="button">
            <PlusIcon width={14} height={14} /> Add application
          </button>
        </div>
      }
    >
      {error ? (
        <section className="notice">
          <em>Could not load applications: {error}</em>
        </section>
      ) : null}

      <section className="metric-grid">
        <MetricCard label="Total" value={String(summary.total)} detail="" />
        <MetricCard label="In pipeline" value={String(summary.inPipeline)} detail="" />
        <MetricCard label="Interviews" value={String(summary.interviews)} detail="" />
        <MetricCard label="Offers" value={String(summary.offers)} detail="" />
      </section>

      {showTip ? (
        <section className="notice">
          <span>
            Tip — save jobs from LinkedIn, Instahyre, Naukri or any careers page in one click with our{" "}
            <a
              href="https://chromewebstore.google.com/detail/pegasus-%E2%80%94-job-clipper/oghjgddbopcpgdbpgijkkaabiaebedgp"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Chrome extension
            </a>.
          </span>
          <button className="icon-button" aria-label="Dismiss" onClick={() => setShowTip(false)} type="button">
            <CloseIcon width={14} height={14} />
          </button>
        </section>
      ) : null}

      {view === "list" ? (
        <section className="app-table" aria-label="Applications list">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Applied</th>
                <th>Updated</th>
                <th aria-label="Actions" style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#7d7c76" }}>
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#7d7c76", fontFamily: "var(--font-serif-stack)", fontStyle: "italic" }}>
                    No applications yet. Click &ldquo;Add application&rdquo; to start.
                  </td>
                </tr>
              ) : (
                items.map((application) => (
                  <tr
                    key={application.id}
                    onClick={() => openView(application)}
                    style={{ cursor: "pointer" }}
                  >
                    <td data-label="Company">{application.company}</td>
                    <td data-label="Role">{application.role}</td>
                    <td data-label="Stage">
                      <Pill tone={STAGE_TONES[application.stage] || "default"}>
                        <span className="stage-dot" />
                        {STAGE_LABELS[application.stage] ?? application.stage}
                      </Pill>
                    </td>
                    <td data-label="Source">
                      {application.source ? SOURCE_LABELS[application.source] ?? application.source : "—"}
                    </td>
                    <td data-label="Applied">{fmtDate(application.appliedAt ?? "")}</td>
                    <td data-label="Updated">{fmtRelative(application.updatedAt)}</td>
                    <td className="row-actions" data-label="">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Set reminder for ${application.company}`}
                        title="Set reminder"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReminderApp(application);
                          setReminderAt("");
                          setReminderNote("");
                          setReminderError(null);
                        }}
                      >
                        <BellIcon width={14} height={14} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${application.company}`}
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(application);
                        }}
                      >
                        <PencilIcon width={14} height={14} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Delete ${application.company}`}
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteApp(application);
                        }}
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {nextCursor ? (
            <div style={{ textAlign: "center", paddingTop: 16 }}>
              <button
                className="ghost-button"
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="board-grid" aria-label="Applications board">
          {STAGES.map((stage) => {
            const cards = items.filter((a) => a.stage === stage);
            const isHover = hoverStage === stage && dragId !== null;
            return (
              <article
                className={isHover ? "kanban-column is-drop-target" : "kanban-column"}
                key={stage}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (hoverStage !== stage) setHoverStage(stage);
                }}
                onDragLeave={(e) => {
                  // Only clear if we've actually left the column, not just
                  // moved over a child card.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  if (hoverStage === stage) setHoverStage(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("application/x-app-id") || dragId;
                  setHoverStage(null);
                  setDragId(null);
                  if (id) void moveAppToStage(id, stage);
                }}
              >
                <header>
                  <span>
                    <span
                      className="stage-dot"
                      style={{
                        background:
                          stage === "INTERESTED"
                            ? "var(--stage-interested)"
                            : stage === "APPLIED"
                              ? "var(--stage-applied)"
                              : stage === "PHONE_SCREEN"
                                ? "var(--stage-phone)"
                                : stage === "TECHNICAL"
                                  ? "var(--stage-technical)"
                                  : stage === "ONSITE"
                                    ? "var(--stage-onsite)"
                                    : stage === "OFFER"
                                      ? "var(--stage-offer-tint)"
                                      : stage === "REJECTED"
                                        ? "var(--stage-rejected)"
                                        : "var(--stage-interested)"
                      }}
                    />
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="pill">{cards.length}</span>
                </header>
                {cards.length === 0 ? (
                  <div className="empty-card">empty</div>
                ) : (
                  cards.map((c) => (
                    <div
                      className={dragId === c.id ? "kanban-card is-dragging" : "kanban-card"}
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-app-id", c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(c.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setHoverStage(null);
                      }}
                      onClick={() => openView(c)}
                      style={{ cursor: dragId === c.id ? "grabbing" : "grab" }}
                    >
                      <strong>{c.company}</strong>
                      <p className="muted small" style={{ marginTop: 4 }}>
                        {c.role}
                      </p>
                    </div>
                  ))
                )}
              </article>
            );
          })}
        </section>
      )}

      <ModalShell
        open={!!viewingApp}
        onClose={closeView}
        title={viewingApp?.company ?? ""}
        titleId="app-detail-title"
        width="780px"
      >
        {viewingApp ? (
          <>
            <button
              className="icon-button app-detail-close"
              aria-label="Close"
              onClick={closeView}
              type="button"
            >
              <CloseIcon width={14} height={14} />
            </button>

            <header className="app-detail-head">
              <p className="eyebrow">Application</p>
              <p className="app-detail-sub">{viewingApp.role}</p>
              <div className="app-detail-tags">
                <Pill tone={STAGE_TONES[viewingApp.stage] || "default"}>
                  <span className="stage-dot" />
                  {STAGE_LABELS[viewingApp.stage] ?? viewingApp.stage}
                </Pill>
                {viewingApp.jobLink ? (
                  <a
                    className="app-detail-link"
                    href={viewingApp.jobLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Job posting ↗
                  </a>
                ) : null}
              </div>
              <div className="app-detail-actions">
                <button className="ghost-button" type="button" onClick={editFromView}>
                  <PencilIcon width={14} height={14} /> Edit
                </button>
                <button
                  className="ghost-button app-detail-delete"
                  type="button"
                  onClick={() => deleteApp(viewingApp)}
                >
                  <TrashIcon width={14} height={14} /> Delete
                </button>
              </div>
            </header>

            <div className="app-detail-grid">
              <section className="app-detail-section">
                <p className="eyebrow">Details</p>
                <div className="app-detail-fields">
                  <div className="app-detail-field">
                    <span className="app-detail-label">Source</span>
                    <span className="app-detail-value">
                      {viewingApp.source ? SOURCE_LABELS[viewingApp.source] ?? viewingApp.source : "—"}
                    </span>
                  </div>
                  <div className="app-detail-field">
                    <span className="app-detail-label">Location</span>
                    <span className="app-detail-value">{viewingApp.location || "—"}</span>
                  </div>
                  <div className="app-detail-field">
                    <span className="app-detail-label">Salary</span>
                    <span className="app-detail-value">{viewingApp.salaryRange || "—"}</span>
                  </div>
                  <div className="app-detail-field">
                    <span className="app-detail-label">Applied</span>
                    <span className="app-detail-value">
                      {viewingApp.appliedAt ? fmtDate(viewingApp.appliedAt) : "—"}
                    </span>
                  </div>
                  <div className="app-detail-field">
                    <span className="app-detail-label">Last date to apply</span>
                    <span className="app-detail-value">
                      {viewingApp.applyDeadline ? fmtDate(viewingApp.applyDeadline) : "—"}
                    </span>
                  </div>
                  <div className="app-detail-field">
                    <span className="app-detail-label">Last updated</span>
                    <span className="app-detail-value">{fmtRelative(viewingApp.updatedAt)}</span>
                  </div>
                  <div className="app-detail-field">
                    <span className="app-detail-label">Stage since</span>
                    <span className="app-detail-value">{fmtRelative(viewingApp.updatedAt)}</span>
                  </div>
                </div>
                {viewingApp.jobDescription ? (
                  <div className="app-detail-block">
                    <p className="app-detail-label">Job description</p>
                    <p className="app-detail-prose">{viewingApp.jobDescription}</p>
                  </div>
                ) : null}
                {viewingApp.notes ? (
                  <div className="app-detail-block">
                    <p className="app-detail-label">Notes</p>
                    <p className="app-detail-prose">{viewingApp.notes}</p>
                  </div>
                ) : null}
              </section>

              <aside className="app-detail-aside">
                <section className="app-detail-section">
                  <p className="eyebrow">AI tools</p>
                  <button
                    className="app-tool-card"
                    type="button"
                    onClick={openCoverDialog}
                  >
                    <span className="app-tool-icon">
                      <MailIcon width={17} height={17} />
                    </span>
                    <span>
                      <strong>Cover letter</strong>
                      <span className="muted small">Generate a tailored cover letter</span>
                    </span>
                  </button>
                  <button
                    className="app-tool-card"
                    type="button"
                    onClick={openTweakDialog}
                  >
                    <span className="app-tool-icon">
                      <WandIcon width={17} height={17} />
                    </span>
                    <span>
                      <strong>Tweak resume</strong>
                      <span className="muted small">Get suggestions based on this JD</span>
                    </span>
                  </button>
                </section>

                <section className="app-detail-section">
                  <p className="eyebrow">Timeline</p>
                  <ApplicationTimeline
                    changes={timeline}
                    loading={timelineLoading}
                    fallbackAddedAt={viewingApp.createdAt}
                    fallbackInitialStage={viewingApp.stage}
                  />
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </ModalShell>

      <ModalShell
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Edit application" : "New application"}
        titleId="app-form-title"
      >
        <div className="form-grid">
          <div className="field">
            <label>Company *</label>
            <input
              placeholder="Stripe"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Role *</label>
            <input
              placeholder="Senior Engineer"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Stage</label>
            <select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Source</label>
            {/* Values match the server-side enum (UPPERCASE) introduced
                by the source validator in handlers_applications.go +
                the CHECK constraint in migrations/0016. Labels are
                title-case for readability. Empty value ("—") submits
                as null/empty, which the backend accepts. */}
            <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              <option value="">—</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="NAUKRI">Naukri</option>
              <option value="REFERRAL">Referral</option>
              <option value="COMPANY_SITE">Company site</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="field">
            <label>Applied date</label>
            <input
              type="date"
              value={draft.appliedAt}
              onChange={(e) => setDraft({ ...draft, appliedAt: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Last date to apply</label>
            <input
              type="date"
              value={draft.applyDeadline}
              onChange={(e) => setDraft({ ...draft, applyDeadline: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              placeholder="Remote · Bangalore"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Salary range</label>
            <input
              placeholder="e.g. 15 LPA, $120k, €90k"
              value={draft.salaryRange}
              onChange={(e) => setDraft({ ...draft, salaryRange: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Job link</label>
            <input
              type="url"
              placeholder="https://..."
              value={draft.jobLink}
              onChange={(e) => setDraft({ ...draft, jobLink: e.target.value })}
            />
          </div>
          <div className="field wide">
            <label>Job description</label>
            <textarea
              placeholder="Paste the JD here..."
              value={draft.jobDescription}
              onChange={(e) => setDraft({ ...draft, jobDescription: e.target.value })}
            />
          </div>
          <div className="field wide">
            <label>Notes</label>
            <textarea
              placeholder="What stood out, contacts, prep tasks..."
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="section-actions" style={{ justifyContent: "flex-end" }}>
          <button className="ghost-button" onClick={closeModal} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={handleSave}
            disabled={!draft.company.trim() || !draft.role.trim()}
            type="button"
          >
            {editingId ? "Save changes" : "Save application"}
          </button>
        </div>
      </ModalShell>

      <ModalShell
        open={showCoverDialog && !!viewingApp}
        onClose={() => setShowCoverDialog(false)}
        title={viewingApp ? `Cover letter — ${viewingApp.role} at ${viewingApp.company}` : "Cover letter"}
        titleId="cover-letter-title"
        width="600px"
      >
        {viewingApp ? (
          <>
            <div className="ai-modal-body">
              <div className="field">
                <label>
                  Job description <span className="required">*</span>
                </label>
                <textarea
                  className="ai-textarea"
                  placeholder="Paste the job description here..."
                  value={coverJD}
                  onChange={(e) => setCoverJD(e.target.value)}
                />
                <p className="muted small ai-helper">
                  Paste the JD. The AI will use it together with your profile to write a tailored
                  letter.
                </p>
                <p className="muted small ai-helper">
                  Free within your monthly AI quota; beyond that, costs{" "}
                  <strong>{CREDIT_COSTS.coverLetter} credits</strong>.{" "}
                  <Link href="/upgrade#credits">Top up →</Link>
                </p>
              </div>
              {aiError ? (
                <p className="notice" style={{ marginTop: 12 }}>
                  <em>{aiError}</em>
                </p>
              ) : null}
              {coverLetterText ? (
                <div className="field" style={{ marginTop: 16 }}>
                  <label>Generated cover letter</label>
                  <pre
                    className="ai-textarea"
                    style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}
                  >
                    {coverLetterText}
                  </pre>
                </div>
              ) : null}
            </div>
            <div className="ai-modal-foot">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setShowCoverDialog(false)}
              >
                Close
              </button>
              {coverLetterText ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    if (!viewingApp || !coverLetterText) return;
                    downloadPDF(
                      "/job-tracker/ai/cover-letter/pdf",
                      { text: coverLetterText, company: viewingApp.company, role: viewingApp.role },
                      "cover-letter.pdf"
                    ).catch((e: Error) => window.alert(`Download failed: ${e.message}`));
                  }}
                >
                  <DownloadIcon width={13} height={13} /> Download PDF
                </button>
              ) : null}
              <button
                className="primary-button"
                type="button"
                disabled={!coverJD.trim() || aiBusy}
                onClick={handleGenerateCover}
              >
                <SparkleStarIcon width={13} height={13} />
                {aiBusy ? "Generating…" : "Generate"}
              </button>
            </div>
          </>
        ) : null}
      </ModalShell>

      <ModalShell
        open={showTweakDialog && !!viewingApp}
        onClose={() => setShowTweakDialog(false)}
        title="Tweak resume as per job description"
        titleId="tweak-title"
        width="600px"
      >
        {viewingApp ? (
          <>
            <div className="ai-modal-body">
              <div className="field">
                <label>
                  Your resume <span className="required">*</span>
                </label>
                {vaultResumes.length > 0 ? (
                  <div className="resume-picker">
                    <p className="eyebrow" style={{ marginBottom: 8 }}>
                      From your vault
                    </p>
                    <div className="resume-pick-list">
                      {vaultResumes.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={
                            tweakResumeId === r.id
                              ? "resume-pick-card active"
                              : "resume-pick-card"
                          }
                          onClick={() => {
                            setTweakResumeId(r.id);
                            setTweakFile(null);
                          }}
                        >
                          <FileIcon width={16} height={16} />
                          <span>
                            <strong>{r.fileName}</strong>
                            {r.label ? <em className="muted small">{r.label}</em> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="muted small ai-helper">— or upload a new one below —</p>
                  </div>
                ) : null}
                <div
                  className={tweakFile ? "ai-drop-zone has-file" : "ai-drop-zone"}
                  onClick={() => tweakFileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0] ?? null;
                    if (f) {
                      setTweakFile(f);
                      setTweakResumeId(null);
                    }
                  }}
                >
                  <UploadIcon width={20} height={20} />
                  <strong>
                    {tweakFile
                      ? tweakFile.name
                      : "Drop resume PDF here or click to upload"}
                  </strong>
                  {tweakFile ? (
                    <span className="muted small">
                      {Math.max(1, Math.round(tweakFile.size / 1024))} KB
                    </span>
                  ) : null}
                </div>
                <input
                  ref={tweakFileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) {
                      setTweakFile(f);
                      setTweakResumeId(null);
                    }
                    e.target.value = "";
                  }}
                />
                <p className="muted small ai-helper">
                  Upload your resume PDF — text is extracted and never stored.
                </p>
              </div>

              <div className="field">
                <label>
                  Job description <span className="required">*</span>
                </label>
                <textarea
                  className="ai-textarea"
                  placeholder="Paste the job description here..."
                  value={tweakJD}
                  onChange={(e) => setTweakJD(e.target.value)}
                />
                <p className="muted small ai-helper">
                  The AI will match your resume against this role.
                </p>
                <p className="muted small ai-helper">
                  Free within your monthly AI quota; beyond that, costs{" "}
                  <strong>{CREDIT_COSTS.resumeTweak} credits</strong> per version.{" "}
                  <Link href="/upgrade#credits">Top up →</Link>
                </p>
              </div>

              {aiError ? (
                <p className="notice" style={{ marginTop: 12 }}>
                  <em>{aiError}</em>
                </p>
              ) : null}

              {tweakParentId ? (
                <p className="muted small" style={{ marginTop: 8 }}>
                  Continuing from a saved version —{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setTweakParentId(null)}
                  >
                    start fresh instead
                  </button>
                </p>
              ) : null}

              {tweakResult ? (
                <div className="field" style={{ marginTop: 16 }}>
                  <label>Tweaked resume · {tweakResult.title}</label>
                  <pre
                    className="ai-textarea"
                    style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}
                  >
                    {tweakResult.tweakedText}
                  </pre>
                  <p className="muted small ai-helper">
                    Saved automatically — you can come back to this version
                    later from the &ldquo;Past versions&rdquo; list below.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => continueFromTweak(tweakResult.id)}
                    >
                      Continue tweaking this version
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        downloadPDF(
                          `/job-tracker/ai/resume/tweaks/${tweakResult.id}/pdf`,
                          null,
                          "resume-tweak.pdf"
                        ).catch((e: Error) => window.alert(`Download failed: ${e.message}`));
                      }}
                    >
                      <DownloadIcon width={13} height={13} /> Download PDF
                    </button>
                  </div>
                </div>
              ) : null}

              {tweakHistory.length > 0 ? (
                <div className="field" style={{ marginTop: 16 }}>
                  <label>Past versions for this application</label>
                  <ul className="resume-pick-list" style={{ listStyle: "none", padding: 0 }}>
                    {tweakHistory.map((h) => (
                      <li key={h.id} style={{ marginBottom: 6 }}>
                        <button
                          type="button"
                          className="resume-pick-card"
                          onClick={() => continueFromTweak(h.id)}
                          style={{ textAlign: "left", width: "100%" }}
                        >
                          <FileIcon width={16} height={16} />
                          <span>
                            <strong>{h.title || "Untitled tweak"}</strong>
                            <em className="muted small">
                              {new Date(h.createdAt).toLocaleString()}
                              {h.parentId ? " · continued" : ""}
                            </em>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="ai-modal-foot">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setShowTweakDialog(false)}
              >
                Close
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={
                  !tweakJD.trim() ||
                  (!tweakParentId && !tweakFile && !tweakResumeId) ||
                  aiBusy
                }
                onClick={handleGenerateTweak}
              >
                {aiBusy ? "Generating…" : tweakParentId ? "Generate next version" : "Generate"}
              </button>
            </div>
          </>
        ) : null}
      </ModalShell>

      <ModalShell
        open={!!reminderApp}
        onClose={() => setReminderApp(null)}
        title={reminderApp ? `Set reminder · ${reminderApp.company}` : "Set reminder"}
        titleId="reminder-modal-title"
      >
        {reminderApp ? (
          <>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Quick pick</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Tomorrow", days: 1 },
                    { label: "In 3 days", days: 3 },
                    { label: "In 1 week", days: 7 },
                    { label: "In 2 weeks", days: 14 }
                  ].map(({ label, days }) => {
                    const ts = new Date(Date.now() + days * 86_400_000);
                    ts.setHours(9, 0, 0, 0);
                    const iso = ts.toISOString().slice(0, 16);
                    return (
                      <button
                        key={label}
                        type="button"
                        className={reminderAt === iso ? "primary-button" : "ghost-button"}
                        style={{ fontSize: 13 }}
                        onClick={() => setReminderAt(iso)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Custom date &amp; time</label>
                <input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)}
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Follow up on interview feedback"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                />
              </div>
              {reminderError ? (
                <p className="muted small" style={{ color: "var(--danger)", gridColumn: "1 / -1" }}>
                  {reminderError}
                </p>
              ) : null}
            </div>
            <div className="ai-modal-foot">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setReminderApp(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!reminderAt || reminderBusy}
                onClick={async () => {
                  if (!reminderApp || !reminderAt) return;
                  setReminderBusy(true);
                  setReminderError(null);
                  try {
                    const ts = new Date(reminderAt).toISOString();
                    await api.post(
                      `/job-tracker/applications/${reminderApp.id}/reminders`,
                      { triggersAt: ts, note: reminderNote || undefined }
                    );
                    setReminderApp(null);
                  } catch (e) {
                    setReminderError((e as Error).message);
                  } finally {
                    setReminderBusy(false);
                  }
                }}
              >
                {reminderBusy ? "Saving…" : "Set reminder"}
              </button>
            </div>
          </>
        ) : null}
      </ModalShell>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void refresh()}
      />
      {viewToast ? <div className="page-toast">{viewToast}</div> : null}
    </ProductFrame>
  );
}
