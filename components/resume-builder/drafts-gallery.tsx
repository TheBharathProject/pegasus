"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import type { ApiResumeBuilderDraftSummary } from "@/lib/api-client";

// DraftsGallery — full-width replacement for the old left rail. Cards
// stagger in on mount; clicking a card opens that draft; the leading
// "+ New draft" card creates one from the picker. Trash icon on each
// card fades in on hover and deletes after a confirm.

export function DraftsGallery({
  drafts,
  loading,
  creating,
  activeId,
  onOpen,
  onNew,
  onDelete
}: {
  drafts: ApiResumeBuilderDraftSummary[];
  loading: boolean;
  creating: boolean;
  activeId?: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (d: ApiResumeBuilderDraftSummary) => void;
}) {
  return (
    <section className="rb-gallery" aria-label="Resume drafts">
      <header className="rb-gallery-head">
        <span className="rb-gallery-eyebrow">Drafts</span>
        <span className="rb-gallery-count">{drafts.length}</span>
        <span className="rb-gallery-head-spacer" />
        <button
          type="button"
          className="rb-gallery-head-new"
          onClick={onNew}
          disabled={creating}
        >
          <PlusIcon width={12} height={12} />
          {creating ? "Creating…" : "New draft"}
        </button>
      </header>

      {loading ? (
        <p className="muted small" style={{ marginTop: 18 }}>
          Loading drafts…
        </p>
      ) : (
        <div className="rb-gallery-grid">
          <NewDraftCard onClick={onNew} disabled={creating} />
          {drafts.map((d, i) => (
            <DraftCard
              key={d.id}
              draft={d}
              isActive={d.id === activeId}
              // Stagger reveal — each card slides in 60ms after the one before.
              // First card (i=0) is the New CTA, so we start at index+1.
              indexInRow={i + 1}
              onOpen={() => onOpen(d.id)}
              onDelete={() => onDelete(d)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewDraftCard({
  onClick,
  disabled
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="rb-gallery-card rb-gallery-card-new"
      onClick={onClick}
      disabled={disabled}
      // Index 0 — first to reveal.
      style={{ animationDelay: "0ms" }}
    >
      <span className="rb-gallery-card-new-plus" aria-hidden>
        <PlusIcon width={14} height={14} />
      </span>
      <span>
        <span className="rb-gallery-card-new-title">Start something new</span>
        <span className="rb-gallery-card-new-sub">Sample · Profile · Blank</span>
      </span>
    </button>
  );
}

function DraftCard({
  draft,
  isActive,
  indexInRow,
  onOpen,
  onDelete
}: {
  draft: ApiResumeBuilderDraftSummary;
  isActive: boolean;
  indexInRow: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const delay = `${Math.min(indexInRow * 50, 350)}ms`;
  return (
    <div
      className={
        isActive ? "rb-gallery-card is-active" : "rb-gallery-card"
      }
      style={{ animationDelay: delay }}
    >
      {/* Whole-card click target. Plain <button> so keyboard activation is
          free; the delete button is absolutely positioned ON TOP and stops
          propagation so trash-click doesn't also open the draft. */}
      <button
        type="button"
        className="rb-gallery-card-open"
        onClick={onOpen}
        aria-label={`Open ${draft.title}`}
      />
      <h3 className="rb-gallery-card-title">{draft.title || "Untitled"}</h3>
      <div className="rb-gallery-card-meta">
        <span className="rb-gallery-card-time">
          {relativeTime(draft.updatedAt)}
        </span>
        <span className="rb-gallery-card-arrow" aria-hidden>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none">
            <path
              d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <button
        type="button"
        className="rb-gallery-card-delete"
        title="Delete draft"
        aria-label={`Delete ${draft.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <TrashIcon width={12} height={12} />
      </button>
    </div>
  );
}

// Local relative-time formatter — same shape as the one in page.tsx, kept
// here so the gallery is self-contained. Trivial enough that duplication
// beats threading a util through props.
function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
