"use client";

import type { ApiImprovementPlanItem } from "@/lib/api-client";

// ImprovementCard — one entry in the prioritised plan. Header with
// effort/impact pills, location line, then a before/after panel pair.
// Mirrors Naukri's improvement-plan card.

function effortLabel(e: string): string {
  return `effort: ${e}`;
}

function impactLabel(i: string): string {
  return `impact: ${i}`;
}

export function ImprovementCard({
  index,
  item
}: {
  index: number;
  item: ApiImprovementPlanItem;
}) {
  return (
    <article className="rs-improvement-card">
      <header className="rs-improvement-card-head">
        <span className="rs-improvement-card-number">#{index + 1}</span>
        <div className="rs-improvement-card-titles">
          <h3 className="rs-improvement-card-title">{item.title}</h3>
          <p className="muted small rs-improvement-card-where">
            {item.where || ""}
          </p>
        </div>
        <div className="rs-improvement-pills">
          <span
            className={`rs-improvement-pill rs-improvement-pill--effort-${item.effort}`}
          >
            {effortLabel(item.effort)}
          </span>
          <span
            className={`rs-improvement-pill rs-improvement-pill--impact-${item.impact}`}
          >
            {impactLabel(item.impact)}
          </span>
        </div>
      </header>
      {item.before ? (
        <div className="rs-before-block">
          <p className="rs-block-label">Before</p>
          <p className="rs-block-text">{item.before}</p>
        </div>
      ) : null}
      {item.after ? (
        <div className="rs-after-block">
          <p className="rs-block-label">After</p>
          <p className="rs-block-text">{item.after}</p>
        </div>
      ) : null}
      {item.why ? (
        <p className="rs-why-line">
          <span className="rs-why-label">Why:</span> {item.why}
        </p>
      ) : null}
    </article>
  );
}
