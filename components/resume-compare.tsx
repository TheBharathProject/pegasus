"use client";

// Side-by-side resume comparison modal. Two PDF iframes; left and right slot
// dropdowns let the user pick which slots to put under the loupe. URLs come
// from /job-tracker/resumes/{id}/view-url (5-minute presigned R2 GET).
//
// Read-only — no annotations, no diff. Just two screens of the same JD-against
// versions so the user can eyeball which looks tighter.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, type ApiFile } from "@/lib/api-client";
import { CloseIcon } from "@/components/icons";

type Props = {
  resumes: ApiFile[];
  initialLeftId: string | null;
  onClose: () => void;
};

async function fetchViewURL(resumeId: string): Promise<string | null> {
  try {
    const r = await api.get<{ viewUrl: string }>(
      `/job-tracker/resumes/${resumeId}/view-url`
    );
    return r.viewUrl;
  } catch {
    return null;
  }
}

export function ResumeCompare({ resumes, initialLeftId, onClose }: Props) {
  // The right side defaults to the next slot — typical "compare to neighbour"
  // pattern. If only one resume exists, picker still works but right is empty.
  const others = resumes.filter((f) => f.id !== initialLeftId);
  const [leftId, setLeftId] = useState<string | null>(initialLeftId);
  const [rightId, setRightId] = useState<string | null>(others[0]?.id ?? null);

  const [leftURL, setLeftURL] = useState<string | null>(null);
  const [rightURL, setRightURL] = useState<string | null>(null);

  // Refetch presigned URLs whenever a side's selected file changes.
  // Each load races on its own; if the user flips quickly we don't bother
  // cancelling — last-write-wins for both sides.
  useEffect(() => {
    let alive = true;
    setLeftURL(null);
    if (!leftId) return;
    fetchViewURL(leftId).then((u) => {
      if (alive) setLeftURL(u);
    });
    return () => {
      alive = false;
    };
  }, [leftId]);

  useEffect(() => {
    let alive = true;
    setRightURL(null);
    if (!rightId) return;
    fetchViewURL(rightId).then((u) => {
      if (alive) setRightURL(u);
    });
    return () => {
      alive = false;
    };
  }, [rightId]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Compare resumes"
      onClick={onClose}
    >
      <div
        className="modal-card modal-card--wide compare-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="list-head">
          <h2>Compare resumes</h2>
          <button
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
            type="button"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>

        <div className="compare-grid">
          <ComparePane
            label="Left"
            resumes={resumes}
            value={leftId}
            onChange={setLeftId}
            url={leftURL}
          />
          <ComparePane
            label="Right"
            resumes={resumes}
            value={rightId}
            onChange={setRightId}
            url={rightURL}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function ComparePane({
  label,
  resumes,
  value,
  onChange,
  url
}: {
  label: string;
  resumes: ApiFile[];
  value: string | null;
  onChange: (id: string | null) => void;
  url: string | null;
}) {
  return (
    <div className="compare-pane">
      <div className="compare-pane-head">
        <span className="eyebrow">{label}</span>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">— pick a resume —</option>
          {resumes.map((f) => (
            <option key={f.id} value={f.id}>
              Slot {f.slot ?? "?"} · {f.label || f.fileName}
            </option>
          ))}
        </select>
      </div>
      <div className="compare-pane-body">
        {!value ? (
          <p className="compare-empty">Pick a resume to preview.</p>
        ) : !url ? (
          <p className="compare-empty">Loading…</p>
        ) : (
          <iframe
            src={url}
            title={`${label} resume preview`}
            className="compare-iframe"
          />
        )}
      </div>
    </div>
  );
}
