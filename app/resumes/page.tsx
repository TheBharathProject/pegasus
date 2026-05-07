"use client";

import { useEffect, useRef, useState } from "react";
import { ProductFrame } from "@/components/frames";
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  TrashIcon,
  UploadIcon
} from "@/components/icons";
import { api } from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";

type ApiFile = {
  id: string;
  kind: "resume" | "cover_letter";
  slot?: number;
  label?: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  uploadedAt?: string;
  createdAt: string;
};

type Vault = { resumes: ApiFile[]; covers: ApiFile[] };

const KIND_API: Record<"resumes" | "covers", "resume" | "cover_letter"> = {
  resumes: "resume",
  covers: "cover_letter"
};

export default function ResumesPage() {
  const [vault, setVault] = useState<Vault>({ resumes: [], covers: [] });
  const [busy, setBusy] = useState(false);
  const [activeUpload, setActiveUpload] = useState<{ kind: "resumes" | "covers"; slot: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    try {
      const [resumes, covers] = await Promise.all([
        api.get<ApiFile[]>("/job-tracker/resumes"),
        api.get<ApiFile[]>("/job-tracker/cover-letters")
      ]);
      setVault({ resumes, covers });
    } catch {
      /* keep prior state */
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      window.location.href = "/login";
      return;
    }
    refresh();
  }, []);

  const upload = (kind: "resumes" | "covers", slot: number) => {
    setActiveUpload({ kind, slot });
    setTimeout(() => fileRef.current?.click(), 0);
  };

  const replaceSlot = async (kind: "resumes" | "covers", slot: number, file: File) => {
    const apiKind = KIND_API[kind];
    const endpoint =
      kind === "resumes"
        ? "/job-tracker/resumes/upload-url"
        : "/job-tracker/cover-letters/upload-url";
    setBusy(true);
    try {
      const resp = await api.post<{ uploadUrl: string; file: ApiFile }>(endpoint, {
        kind: apiKind,
        slot,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/pdf",
        label: kind === "resumes" ? "Resume" : "Cover"
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
      <section style={{ marginTop: kind === "covers" ? 44 : 0 }}>
        <div className="list-head">
          <h2
            style={{
              color: "#ececea",
              fontFamily: "var(--font-serif-stack)",
              fontSize: 22,
              fontWeight: 400
            }}
          >
            {title}
          </h2>
          <span className="muted small">{items.filter((f) => f.slot).length} / 5</span>
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
                  <span className="stage-dot" style={{ background: "#62c18b" }} />
                </header>
                <div className="file-row">
                  <span style={{ color: "#b3b1ab" }}>
                    <FileIcon width={18} height={18} />
                  </span>
                  <div>
                    <strong>{file.fileName}</strong>
                    <p className="muted small" style={{ marginTop: 4 }}>
                      {Math.max(1, Math.round(file.fileSize / 1024))} KB ·{" "}
                      {dt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </p>
                    {file.label ? (
                      <div className="pill-row" style={{ marginTop: 8 }}>
                        <span className="pill">{file.label}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="slot-actions">
                  <button
                    className="icon-button"
                    aria-label="Preview"
                    title="Preview"
                    type="button"
                    onClick={() => window.alert(`${file.fileName} preview not wired yet.`)}
                  >
                    <EyeIcon width={14} height={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Download"
                    title="Download"
                    type="button"
                    onClick={() => window.alert(`${file.fileName} download not wired yet.`)}
                  >
                    <DownloadIcon width={14} height={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Replace"
                    title="Replace"
                    type="button"
                    onClick={() => upload(kind, slot)}
                  >
                    <UploadIcon width={14} height={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Delete"
                    title="Delete"
                    type="button"
                    onClick={() => removeSlot(kind, slot)}
                  >
                    <TrashIcon width={14} height={14} />
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

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && activeUpload) replaceSlot(activeUpload.kind, activeUpload.slot, f);
          setActiveUpload(null);
          e.target.value = "";
        }}
      />
    </ProductFrame>
  );
}
