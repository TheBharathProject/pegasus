"use client";

import type { ApiScoreReport } from "@/lib/api-client";
import { SECTION_ORDER, type SectionKey, sectionLabel } from "./sections";

// SectionNav — left-rail list of sections under the big score circle.
// Each row shows the section label and its score chip, colour-tiered
// by the existing scoreTone semantics (≥80 strong, ≥60 ok, else weak).
//
// Active row gets a left-border accent + filled background.

function chipClass(score: number): string {
  if (score >= 80) return "rs-section-chip rs-section-chip--strong";
  if (score >= 60) return "rs-section-chip rs-section-chip--ok";
  return "rs-section-chip rs-section-chip--weak";
}

export function SectionNav({
  report,
  active,
  onSelect
}: {
  report: ApiScoreReport;
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
}) {
  return (
    <nav className="rs-section-nav" aria-label="Score sections">
      {SECTION_ORDER.map((key) => {
        const sec = report.sections[key];
        const score = sec?.score ?? 0;
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            className={
              isActive ? "rs-section-row is-active" : "rs-section-row"
            }
            onClick={() => onSelect(key)}
          >
            <span className="rs-section-label">{sectionLabel(key)}</span>
            <span className={chipClass(score)}>{score}</span>
          </button>
        );
      })}
    </nav>
  );
}
