"use client";

import type { ApiImprovementPlanItem } from "@/lib/api-client";
import { ImprovementCard } from "./improvement-card";

// ImprovementPlan — ordered list of improvement cards. Backend already
// orders by most-impactful-first.

export function ImprovementPlan({
  items
}: {
  items: ApiImprovementPlanItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="muted small">
        No improvement actions returned for this report.
      </p>
    );
  }
  return (
    <div className="rs-improvement-plan">
      {items.map((item, idx) => (
        <ImprovementCard
          key={`${idx}-${item.title}`}
          index={idx}
          item={item}
        />
      ))}
    </div>
  );
}
