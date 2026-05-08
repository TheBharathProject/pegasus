"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import { ResumeCompare } from "@/components/resume-compare";
import {
  CalendarIcon,
  ChatIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  PencilIcon,
  SplitIcon,
  TagIcon,
  TrashIcon,
  UploadIcon
} from "@/components/icons";
import {
  api,
  type ApiFile,
  type ApiResumesResponse,
  type ApiCoverLettersResponse
} from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";

type Vault = { resumes: ApiFile[]; covers: ApiFile[] };

const KIND_API: Record<"resumes" | "covers", "resume" | "cover_letter"> = {
  resumes: "resume",
  covers: "cover_letter"
};

// PendingUpload represents an open upload modal. file is null when the
// modal is in the "drop zone" step; once a file is picked it transitions
// to the "confirm + label" step.
type PendingUpload = {
  kind: "resumes" | "covers";
  slot: number;
  file: File | null;
  label: string;
};

export default function ResumesPage() {
  const router = useRouter();
  const [vault, setVault] = useState<Vault>({ resumes: [], covers: [] });
  const [busy, setBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [dropActive, setDropActive] = useState(false);
  // Inline-edit state for a slot's label. Holds the file id being edited
  // and the working value while the input is open.
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  // Usage counts per resume file id — populated after vault loads. Used to
  // show "Reviewed N times" badge below files that have AI reports against
  // them. Cover letters don't have usage today (no link table).
  const [usage, setUsage] = useState<Record<string, number>>({});
  // Compare-modal state. Holds the slot id that triggered the modal so the
  // left pane defaults to that resume; right pane defaults to the next slot.
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Trigger an AI resume report for the given file. The /resume page will
  // pick up the new "latest" report on mount; we just navigate there once
  // the backend confirms the report is saved.
  // Open a presigned R2 GET URL in a new tab. Used by both Preview and Download.
  // The download flow then forces an `<a download>` so the browser saves
  // instead of rendering inline.
  const openViewURL = async (file: ApiFile, mode: "preview" | "download") => {
    const path =
      file.kind === "resume"
        ? `/job-tracker/resumes/${file.id}/view-url`
        : `/job-tracker/cover-letters/${file.id}/view-url`;
    try {
      const r = await api.get<{ viewUrl: string }>(path);
      if (mode === "preview") {
        window.open(r.viewUrl, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = r.viewUrl;
        a.download = file.fileName || "resume.pdf";
        a.rel = "noopener";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      window.alert(`Could not open file: ${(e as Error).message}`);
    }
  };

  const requestReview = async (file: ApiFile) => {
    setReviewBusyId(file.id);
    try {
      await api.post("/job-tracker/ai/resume/report", { fileId: file.id });
      router.push("/resume");
    } catch (e) {
      window.alert(`Could not start review: ${(e as Error).message}`);
    } finally {
      setReviewBusyId(null);
    }
  };

  const refresh = async () => {
    try {
      const [r, c] = await Promise.all([
        api.get<ApiResumesResponse>("/job-tracker/resumes"),
        api.get<ApiCoverLettersResponse>("/job-tracker/cover-letters")
      ]);
      const resumes = r.resumes ?? [];
      setVault({ resumes, covers: c.coverLetters ?? [] });
      // Fan out usage queries — small N (5 max), parallel, ignore individual
      // failures so one stuck request doesn't blank the whole vault badges.
      const counts = await Promise.all(
        resumes.map((f) =>
          api
            .get<{ aiReports: number }>(`/job-tracker/resumes/${f.id}/usage`)
            .then((u) => [f.id, u.aiReports] as const)
            .catch(() => [f.id, 0] as const)
        )
      );
      setUsage(Object.fromEntries(counts));
    } catch {
      /* keep prior state */
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    refresh();
  }, []);

  // Open the modal at step A (drop zone). The user picks the file
  // inside the modal — either by drag-drop or by clicking "Browse files".
  const upload = (kind: "resumes" | "covers", slot: number) => {
    setPendingUpload({ kind, slot, file: null, label: "" });
    setDropActive(false);
  };

  const replaceSlot = async (kind: "resumes" | "covers", slot: number, file: File, label: string) => {
    const apiKind = KIND_API[kind];
    const endpoint =
      kind === "resumes"
        ? "/job-tracker/resumes/upload-url"
        : "/job-tracker/cover-letters/upload-url";
    setBusy(true);
    try {
      const trimmed = label.trim();
      const resp = await api.post<{ uploadUrl: string; file: ApiFile }>(endpoint, {
        kind: apiKind,
        slot,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/pdf",
        label: trimmed || (kind === "resumes" ? "Resume" : "Cover")
      });
      const putRes = await fetch(resp.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" }
      });
      if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);
      const finalizeBase =
        kind === "resumes"
          ? `/job-tracker/resumes/${resp.file.id}/finalize`
          : `/job-tracker/cover-letters/${resp.file.id}/finalize`;
      await api.patch(finalizeBase, { fileSize: file.size });
      await refresh();
    } catch (e) {
      window.alert(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Modal flow: clicking an empty slot now opens the file picker which
  // populates `pendingUpload`; the modal then prompts for a label before
  // we actually push to R2.
  const handleConfirmUpload = async () => {
    if (!pendingUpload || !pendingUpload.file) return;
    const { kind, slot, file, label } = pendingUpload;
    setPendingUpload(null);
    await replaceSlot(kind, slot, file, label);
  };

  const handleCancelUpload = () => {
    setPendingUpload(null);
    setDropActive(false);
  };

  // Step A → Step B transition: a file has been selected (drop or browse).
  const acceptFile = (f: File) => {
    if (!pendingUpload) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      window.alert("Please upload a PDF.");
      return;
    }
    setPendingUpload({ ...pendingUpload, file: f });
    setDropActive(false);
  };

  // Step B → Step A: clear the file but keep the modal open and the
  // kind/slot intact so the user can drop a different one.
  const handleChangeFile = () => {
    if (!pendingUpload) return;
    setPendingUpload({ ...pendingUpload, file: null, label: pendingUpload.label });
  };

  const openBrowsePicker = () => {
    if (fileRef.current) fileRef.current.click();
  };

  // Inline label edit — calls PATCH /resumes/{id} or /cover-letters/{id}
  const startEditLabel = (file: ApiFile) => {
    setEditingLabelId(file.id);
    setEditingLabelValue(file.label ?? "");
  };

  const cancelEditLabel = () => {
    setEditingLabelId(null);
    setEditingLabelValue("");
  };

  const saveEditLabel = async (file: ApiFile, kind: "resumes" | "covers") => {
    const next = editingLabelValue.trim();
    if (next === (file.label ?? "")) {
      cancelEditLabel();
      return;
    }
    setSavingLabel(true);
    const endpoint =
      kind === "resumes"
        ? `/job-tracker/resumes/${file.id}`
        : `/job-tracker/cover-letters/${file.id}`;
    try {
      await api.patch(endpoint, { label: next });
      await refresh();
      cancelEditLabel();
    } catch (e) {
      window.alert(`Could not update label: ${(e as Error).message}`);
    } finally {
      setSavingLabel(false);
    }
  };

  const removeSlot = async (kind: "resumes" | "covers", slot: number) => {
    const file = vault[kind].find((f) => f.slot === slot);
    if (!file) return;
    if (!window.confirm("Remove this file?")) return;
    const endpoint =
      kind === "resumes"
        ? `/job-tracker/resumes/${file.id}`
        : `/job-tracker/cover-letters/${file.id}`;
    try {
      await api.delete(endpoint);
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const renderSection = (kind: "resumes" | "covers", title: string) => {
    const items = vault[kind];
    return (
      <section style={{ marginTop: kind === "covers" ? 40 : 0 }}>
        <div className="vault-section-head">
          <h2>{title}</h2>
          <span className="vault-progress" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = items.some((f) => f.slot === n);
              return (
                <span
                  key={n}
                  className={filled ? "vault-progress-pip is-filled" : "vault-progress-pip"}
                />
              );
            })}
          </span>
          <span className="vault-count">{items.filter((f) => f.slot).length} / 5</span>
        </div>
        <div className="vault-grid">
          {[1, 2, 3, 4, 5].map((slot) => {
            const file = items.find((f) => f.slot === slot) ?? null;
            if (!file) {
              return (
                <article
                  className="slot-card empty"
                  key={slot}
                  onClick={() => upload(kind, slot)}
                  style={{ cursor: busy ? "wait" : "pointer" }}
                >
                  <div>
                    <p className="eyebrow">Slot {slot}</p>
                    <button className="icon-button" aria-label={`Upload to slot ${slot}`} type="button">
                      <UploadIcon width={14} height={14} />
                    </button>
                    <p>{busy ? "Working…" : "Upload PDF"}</p>
                  </div>
                </article>
              );
            }
            const dt = new Date(file.uploadedAt || file.createdAt);
            return (
              <article className="slot-card" key={slot}>
                <header>
                  <span className="eyebrow">Slot {slot}</span>
                  <span className="slot-status-dot" />
                </header>
                <div className="slot-body">
                  <div className="file-row">
                    <span className="file-icon-wrap">
                      <FileIcon width={16} height={16} />
                    </span>
                    <div className="file-info">
                      <strong>{file.fileName}</strong>
                      <p className="file-meta">
                        <span>{Math.max(1, Math.round(file.fileSize / 1024))} KB</span>
                        <span className="file-meta-sep">·</span>
                        <span className="file-meta-cal">
                          <CalendarIcon width={9} height={9} />
                          {dt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </span>
                        {kind === "resumes" && (usage[file.id] ?? 0) > 0 ? (
                          <>
                            <span className="file-meta-sep">·</span>
                            <span className="file-meta-usage">
                              Reviewed {usage[file.id]}{" "}
                              {usage[file.id] === 1 ? "time" : "times"}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {editingLabelId === file.id ? (
                    <div className="label-edit-row">
                      <input
                        autoFocus
                        disabled={savingLabel}
                        value={editingLabelValue}
                        onChange={(e) => setEditingLabelValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveEditLabel(file, kind);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEditLabel();
                          }
                        }}
                        placeholder="Label"
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Save label"
                        title="Save"
                        disabled={savingLabel}
                        onClick={() => void saveEditLabel(file, kind)}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="11"
                          height="11"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 8.5l3 3 7-7" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="label-row">
                      <button
                        type="button"
                        className={file.label ? "label-chip" : "label-chip is-empty"}
                        title="Click to edit label"
                        onClick={() => startEditLabel(file)}
                      >
                        <TagIcon className="tag-glyph" width={10} height={10} />
                        <span className="label-chip-text">{file.label || "Add label"}</span>
                        <PencilIcon className="pencil-glyph" width={8} height={8} />
                      </button>
                    </div>
                  )}
                </div>
                <div className={kind === "resumes" ? "slot-actions cols-6" : "slot-actions cols-4"}>
                  <button
                    className="icon-button"
                    aria-label="Preview"
                    title="Preview"
                    type="button"
                    onClick={() => openViewURL(file, "preview")}
                  >
                    <EyeIcon width={13} height={13} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Download"
                    title="Download"
                    type="button"
                    onClick={() => openViewURL(file, "download")}
                  >
                    <DownloadIcon width={13} height={13} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Replace"
                    title="Replace"
                    type="button"
                    onClick={() => upload(kind, slot)}
                  >
                    <UploadIcon width={13} height={13} />
                  </button>
                  {kind === "resumes" ? (
                    <>
                      <button
                        className="icon-button"
                        aria-label="Compare with another resume"
                        title="Compare"
                        type="button"
                        disabled={vault.resumes.length < 2}
                        onClick={() => setCompareLeftId(file.id)}
                      >
                        <SplitIcon width={13} height={13} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Get review (AI)"
                        title={reviewBusyId === file.id ? "Generating review…" : "Get review (AI)"}
                        type="button"
                        disabled={reviewBusyId !== null}
                        onClick={() => requestReview(file)}
                      >
                        <ChatIcon width={13} height={13} />
                      </button>
                    </>
                  ) : null}
                  <button
                    className="icon-button is-danger"
                    aria-label="Delete"
                    title="Delete"
                    type="button"
                    onClick={() => removeSlot(kind, slot)}
                  >
                    <TrashIcon width={13} height={13} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <ProductFrame
      active="resumes"
      title="Vault"
      intro="Store your resumes and cover letters — upload, preview, or swap anytime."
      kicker="Document vault"
    >
      {renderSection("resumes", "Resumes")}
      {renderSection("covers", "Cover Letters")}

      {/* Hidden picker the modal's "Browse files" button delegates to. */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) acceptFile(f);
          e.target.value = "";
        }}
      />

      {pendingUpload ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={handleCancelUpload}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540, padding: 0 }}
          >
            {/* Header — same in both steps. Generous top padding for breathing room. */}
            <div
              className="list-head"
              style={{
                padding: "28px 32px 24px",
                borderBottom: "1px solid #2e2e2e",
                marginBottom: 0
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  Upload {pendingUpload.kind === "resumes" ? "resume" : "cover letter"}
                </h2>
                <p className="muted small" style={{ marginTop: 6 }}>
                  Slot {pendingUpload.slot}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                type="button"
                onClick={handleCancelUpload}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>

            {pendingUpload.file === null ? (
              /* Step A: drop zone */
              <>
                <div style={{ padding: "32px 32px 24px" }}>
                  <div
                    onClick={openBrowsePicker}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropActive(true);
                    }}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropActive(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) acceptFile(f);
                    }}
                    style={{
                      border: dropActive ? "2px dashed #ececea" : "2px dashed #4a4a4a",
                      borderRadius: 16,
                      padding: "56px 24px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "border-color 120ms ease",
                      background: dropActive ? "#1a1a1a" : "transparent"
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: "#2c2c2c",
                        margin: "0 auto",
                        display: "grid",
                        placeItems: "center",
                        color: "#ececea"
                      }}
                    >
                      <UploadIcon width={20} height={20} />
                    </div>
                    <p
                      style={{
                        marginTop: 18,
                        color: "#ececea",
                        fontSize: 16,
                        fontWeight: 500
                      }}
                    >
                      Drop your{" "}
                      {pendingUpload.kind === "resumes" ? "resume" : "cover letter"} here
                    </p>
                    <p className="muted small" style={{ marginTop: 6 }}>
                      PDF only · Max 25 MB
                    </p>
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ marginTop: 18 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openBrowsePicker();
                      }}
                    >
                      Browse files
                    </button>
                  </div>
                </div>
                <div
                  className="section-actions"
                  style={{
                    justifyContent: "flex-end",
                    padding: "20px 32px 28px",
                    borderTop: "1px solid #2e2e2e"
                  }}
                >
                  <button className="ghost-button" type="button" onClick={handleCancelUpload}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              /* Step B: confirm + label */
              <>
                <div style={{ padding: "28px 32px 8px" }}>
                  <div
                    style={{
                      padding: "18px 20px",
                      border: "1px solid #2e2e2e",
                      borderRadius: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 16
                    }}
                  >
                    <span style={{ color: "#b3b1ab", flex: "0 0 auto" }}>
                      <FileIcon width={22} height={22} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {pendingUpload.file.name}
                      </strong>
                      <p className="muted small" style={{ marginTop: 6 }}>
                        {Math.max(1, Math.round(pendingUpload.file.size / 1024))} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ flex: "0 0 auto" }}
                      onClick={handleChangeFile}
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="field" style={{ padding: "20px 32px 8px" }}>
                  <label style={{ display: "block", marginBottom: 10 }}>
                    Label <span className="muted small">optional</span>
                  </label>
                  <input
                    placeholder="e.g. Frontend, Backend, Data Science"
                    value={pendingUpload.label}
                    onChange={(e) =>
                      setPendingUpload(
                        pendingUpload ? { ...pendingUpload, label: e.target.value } : null
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleConfirmUpload();
                      }
                    }}
                  />
                </div>

                <div
                  className="section-actions"
                  style={{
                    justifyContent: "flex-end",
                    padding: "20px 32px 28px",
                    marginTop: 12,
                    borderTop: "1px solid #2e2e2e"
                  }}
                >
                  <button className="ghost-button" type="button" onClick={handleCancelUpload}>
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleConfirmUpload()}
                  >
                    <UploadIcon width={14} height={14} /> {busy ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {compareLeftId ? (
        <ResumeCompare
          resumes={vault.resumes}
          initialLeftId={compareLeftId}
          onClose={() => setCompareLeftId(null)}
        />
      ) : null}
    </ProductFrame>
  );
}
