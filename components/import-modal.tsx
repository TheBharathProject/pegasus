"use client";

// Bulk-import modal — opened from the Applications toolbar. Four tabs,
// one per source. CSV / LinkedIn / Naukri all upload a CSV file and
// hit the same backend at different ?source= values per ADR-004 D2.
// Gmail is stubbed pending OAuth or paste-flow design.
//
// Two-step UX inside each tab:
//   1. Pick file → click Preview → get count + per-row error list
//   2. Confirm → click Import → real rows land in the tracker
//
// The preview is the safety net: a CSV with broken column names won't
// silently import 0 rows; the user sees the error before committing.

import { useRef, useState } from "react";
import { api, apiBaseUrl } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import {
  CloseIcon,
  DownloadIcon,
  FileIcon,
  HelpIcon,
  ImportIcon,
  UploadIcon
} from "@/components/icons";

// Each row of the column reference shown inside the Pegasus CSV tab.
// `required` columns must be present in every row; the rest are optional
// — leaving them blank is fine. `stale` is intentionally absent: it's
// system-managed and not part of the import template.
const PEGASUS_COLUMN_REFERENCE: Array<{
  name: string;
  required?: boolean;
  copy: string;
}> = [
  { name: "company", required: true, copy: "Employer name. Required." },
  { name: "role", required: true, copy: "Job title you applied for. Required." },
  { name: "source", copy: "Where you found the role — LinkedIn, Naukri, referral, etc." },
  { name: "location", copy: "City or 'Remote'. Free text." },
  { name: "salaryRange", copy: "Posted compensation, if known. Free text (e.g. '20–30 LPA')." },
  {
    name: "stage",
    copy: "Current step. One of INTERESTED, APPLIED, PHONE_SCREEN, TECHNICAL, ONSITE, OFFER, REJECTED, WITHDRAWN. Defaults to APPLIED."
  },
  { name: "appliedAt", copy: "Date you applied. ISO (2026-05-09), US (05/09/2026), or 'May 9, 2026' all work." },
  { name: "applyDeadline", copy: "Last day applications are accepted. Same date formats as appliedAt." },
  { name: "jobLink", copy: "URL to the posting." },
  { name: "description", copy: "Job description / blurb you want to keep with the row." },
  { name: "notes", copy: "Anything else — recruiter name, follow-up reminder, salary expectation." }
];

type Source = "csv" | "linkedin" | "naukri" | "gmail";

type PreviewRow = {
  company: string;
  role: string;
  source?: string;
  stage?: string;
  appliedAt?: string;
};

type PreviewResult = {
  preview: PreviewRow[];
  errors: string[];
  source: string;
};

const SOURCE_TABS: Array<{ key: Source; label: string }> = [
  { key: "csv", label: "Pegasus CSV" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "naukri", label: "Naukri" },
  { key: "gmail", label: "Gmail" }
];

export function ImportModal({
  open,
  onClose,
  onImported
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [source, setSource] = useState<Source>("csv");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const closeAndReset = () => {
    reset();
    setSource("csv");
    onClose();
  };

  const switchTab = (next: Source) => {
    if (next === source) return;
    setSource(next);
    reset();
  };

  // Preview hits /import/preview?source=X. The user can iterate on the
  // file pick + preview cycle without ever committing rows.
  const handlePreview = async () => {
    if (!file || busy) return;
    setBusy(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<PreviewResult>(
        `/job-tracker/applications/import/preview?source=${source}`,
        fd
      );
      setPreview(res);
    } catch (e) {
      window.alert(`Preview failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Import is the real write. Always confirms via window.confirm so a
  // user who hits Import twice doesn't double-create.
  const handleImport = async () => {
    if (!file || busy) return;
    const ok = window.confirm(
      preview
        ? `Import ${preview.preview.length} application${preview.preview.length === 1 ? "" : "s"}?`
        : "Import without preview?"
    );
    if (!ok) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api.post<{ imported: number; errors: string[] }>(
        `/job-tracker/applications/import?source=${source}`,
        fd
      );
      const errs = result.errors?.length
        ? `\n\nWarnings:\n${result.errors.join("\n")}`
        : "";
      window.alert(`Imported ${result.imported} applications.${errs}`);
      onImported();
      closeAndReset();
    } catch (e) {
      window.alert(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Template download is a direct fetch (auth header doesn't ride along
  // with `<a download>` cleanly, so we do it manually + revokeObjectURL).
  const downloadTemplate = async () => {
    const token = getToken();
    const res = await fetch(`${apiBaseUrl()}/job-tracker/applications/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      window.alert(`Template download failed: HTTP ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pegasus-import-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Import applications"
      onClick={closeAndReset}
    >
      <div
        className="modal-card modal-card--lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="list-head import-head">
          <div>
            <p className="eyebrow">Bulk import</p>
            <h2>Import applications</h2>
            <p className="modal-intro">
              Pick where the data is coming from. We'll preview before committing
              anything to your tracker.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close"
            type="button"
            onClick={closeAndReset}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>

        {/* Tab strip */}
        <div className="import-tabs" role="tablist">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={source === t.key}
              className={source === t.key ? "import-tab is-active" : "import-tab"}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Per-tab body. Gmail is a stub; the other three share the
            same upload+preview+import shape, only the explainer copy
            differs. */}
        <div className="import-body">
          {source === "csv" ? (
            <SourceExplainer
              title="Pegasus CSV"
              copy="Use the Pegasus template — one row per application, required columns are company and role. Everything else is optional."
              hint={
                <div className="import-explainer-actions">
                  <button type="button" className="ghost-button" onClick={downloadTemplate}>
                    <DownloadIcon width={12} height={12} /> Download template
                  </button>
                  <details className="import-column-help">
                    <summary>
                      <HelpIcon width={13} height={13} /> Column reference
                    </summary>
                    <ul className="import-column-list">
                      {PEGASUS_COLUMN_REFERENCE.map((c) => (
                        <li key={c.name}>
                          <span className="import-column-name">
                            <code>{c.name}</code>
                            {c.required ? (
                              <span className="import-column-tag">required</span>
                            ) : null}
                          </span>
                          <span className="import-column-copy">{c.copy}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="import-column-footnote">
                      You may notice an extra <code>stale</code> column in exports —
                      it's a system flag we set after 14 days of no activity, not
                      something you fill in.
                    </p>
                  </details>
                </div>
              }
            />
          ) : null}

          {source === "linkedin" ? (
            <SourceExplainer
              title="LinkedIn"
              copy={`From LinkedIn → Settings & Privacy → Get a copy of your data → "Job Application Insights". Upload the CSV here. We map Company Name, Job Title, Application Date, Status, and Job URL automatically.`}
            />
          ) : null}

          {source === "naukri" ? (
            <SourceExplainer
              title="Naukri"
              copy="From your Naukri profile → My Applications → Export. Upload the CSV here. Company, Designation, Application Date, Status, and Salary all map across automatically."
            />
          ) : null}

          {source === "gmail" ? (
            <div className="import-coming-soon">
              <p className="muted small">
                Gmail import is coming soon. The plan is OAuth-based scraping of a
                Gmail label so applications you replied to from your inbox land here
                without an export step. For now, use the LinkedIn or Naukri tabs —
                they cover most of what would be in your sent folder.
              </p>
            </div>
          ) : null}

          {/* Upload + preview + import controls — shared by all CSV-shaped tabs */}
          {source !== "gmail" ? (
            <>
              <div
                className={file ? "upload-tile is-filled" : "upload-tile"}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fileRef.current?.click();
                }}
              >
                <span className="upload-tile-icon">
                  <UploadIcon width={20} height={20} />
                </span>
                {file ? (
                  <>
                    <span className="upload-tile-title">{file.name}</span>
                    <span className="upload-tile-meta">
                      {Math.max(1, Math.round(file.size / 1024))} KB · click to replace
                    </span>
                  </>
                ) : (
                  <>
                    <span className="upload-tile-title">Click to choose a CSV</span>
                    <span className="upload-tile-meta">
                      Up to 8 MB · UTF-8 encoded
                    </span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setPreview(null);
                  }}
                />
              </div>

              {/* Preview pane — only renders after a successful preview call */}
              {preview ? (
                <div className="import-preview">
                  <p className="muted small">
                    {preview.preview.length} row
                    {preview.preview.length === 1 ? "" : "s"} ready to import
                    {preview.errors?.length
                      ? ` · ${preview.errors.length} warning${preview.errors.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  {preview.preview.length > 0 ? (
                    <div className="import-preview-table-wrap">
                      <table className="import-preview-table">
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Role</th>
                            <th>Stage</th>
                            <th>Applied</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.preview.slice(0, 8).map((r, i) => (
                            <tr key={i}>
                              <td className="col-company">{r.company}</td>
                              <td className="col-role">{r.role}</td>
                              <td className="col-stage">
                                {r.stage ? (
                                  <span className="import-stage-pill">{r.stage}</span>
                                ) : (
                                  <span className="muted small">—</span>
                                )}
                              </td>
                              <td className="col-date">
                                {r.appliedAt || (
                                  <span className="muted small">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.preview.length > 8 ? (
                        <p className="import-preview-more muted small">
                          …and {preview.preview.length - 8} more
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {preview.errors?.length ? (
                    <details className="import-preview-errors">
                      <summary>{preview.errors.length} warning{preview.errors.length === 1 ? "" : "s"}</summary>
                      <ul>
                        {preview.errors.slice(0, 12).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                        {preview.errors.length > 12 ? (
                          <li className="muted small">
                            …and {preview.errors.length - 12} more
                          </li>
                        ) : null}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ) : null}

              <div className="section-actions" style={{ justifyContent: "flex-end" }}>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handlePreview}
                  disabled={!file || busy}
                >
                  <FileIcon width={12} height={12} />{" "}
                  {busy && !preview ? "Previewing…" : "Preview"}
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleImport}
                  disabled={!file || busy}
                >
                  <ImportIcon width={12} height={12} />{" "}
                  {busy && preview ? "Importing…" : "Import"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SourceExplainer({
  title,
  copy,
  hint
}: {
  title: string;
  copy: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="import-explainer">
      <p className="eyebrow">{title}</p>
      <p>{copy}</p>
      {hint ? <div style={{ marginTop: 10 }}>{hint}</div> : null}
    </div>
  );
}
