// Vertical timeline of stage changes for one application.
// Receives the raw ApiStageChange[] from /applications/{id}/timeline plus a
// fallback "addedAt" for the case where the backend hasn't backfilled the
// initial 'added' history row (older applications, or right after migration
// 0007 lands but before any new writes).
//
// Rendered left rule + dots, with stage chip pills on the right. Oldest at
// top (backend returns ascending), newest at bottom — mirrors the way you'd
// read a story.

import type { ReactNode } from "react";
import type { ApiStageChange } from "@/lib/api-client";
import { ArrowRightIcon } from "@/components/icons";

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
  INTERESTED: "tone-stage-interest",
  APPLIED: "tone-stage-applied",
  PHONE_SCREEN: "tone-stage-screen",
  TECHNICAL: "tone-stage-screen",
  ONSITE: "tone-stage-screen",
  OFFER: "tone-stage-offer",
  REJECTED: "tone-stage-default"
};

function fmtRelative(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StageChip({ stage }: { stage: string }) {
  const tone = STAGE_TONES[stage] ?? "tone-stage-default";
  return <span className={`pill ${tone}`}>{STAGE_LABELS[stage] ?? stage}</span>;
}

type Props = {
  changes: ApiStageChange[];
  loading?: boolean;
  // Fallback first event when the timeline endpoint returned nothing (older
  // applications added before migration 0007 backfilled history).
  fallbackAddedAt?: string;
  fallbackInitialStage?: string;
};

export function ApplicationTimeline({
  changes,
  loading,
  fallbackAddedAt,
  fallbackInitialStage
}: Props) {
  if (loading && changes.length === 0) {
    return <p className="muted small" style={{ marginTop: 10 }}>Loading…</p>;
  }

  // Prefer real history. If empty and we have a fallback, synthesise one row.
  let rows = changes;
  if (rows.length === 0 && fallbackAddedAt && fallbackInitialStage) {
    rows = [{ to: fallbackInitialStage, changedAt: fallbackAddedAt }];
  }

  if (rows.length === 0) return null;

  return (
    <ol className="timeline">
      {rows.map((entry, idx) => {
        const isInitial = !entry.from;
        return (
          <li className="timeline-item" key={`${entry.changedAt}-${idx}`}>
            <span
              className={`timeline-dot ${
                isInitial ? "timeline-dot--initial" : "timeline-dot--change"
              }`}
              aria-hidden
            />
            <div className="timeline-body">
              <div className="timeline-line">
                {isInitial ? (
                  <span className="timeline-verb">Added at stage</span>
                ) : (
                  <span className="timeline-verb">Moved from</span>
                )}
                {!isInitial ? (
                  <>
                    <StageChip stage={entry.from!} />
                    <ChevronGap>
                      <ArrowRightIcon width={11} height={11} />
                    </ChevronGap>
                  </>
                ) : null}
                <StageChip stage={entry.to} />
              </div>
              <span className="timeline-time">{fmtRelative(entry.changedAt)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ChevronGap({ children }: { children: ReactNode }) {
  return <span className="timeline-arrow">{children}</span>;
}
