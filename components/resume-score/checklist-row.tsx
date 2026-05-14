"use client";

import type {
  ApiChecklistItem,
  ApiChecklistStatus
} from "@/lib/api-client";

// ChecklistRow — one row in the audit checklist. Status pill (colour
// from the rs-* design tokens) + title + evidence quote below.

function statusLabel(s: ApiChecklistStatus): string {
  switch (s) {
    case "pass":
      return "Pass";
    case "warn":
      return "Warn";
    case "fail":
      return "Fail";
    case "na":
      return "N/A";
  }
}

export function ChecklistRow({ item }: { item: ApiChecklistItem }) {
  return (
    <li
      className={`rs-checklist-row rs-checklist-row--${item.status}`}
      title={item.status === "na" ? "Cannot evaluate from text alone" : undefined}
    >
      <span className={`rs-status-pill rs-status-pill--${item.status}`}>
        {statusLabel(item.status)}
      </span>
      <div className="rs-checklist-body">
        <strong className="rs-checklist-title">{item.title}</strong>
        {item.evidence ? (
          <p className="rs-checklist-evidence muted small">{item.evidence}</p>
        ) : null}
      </div>
    </li>
  );
}
