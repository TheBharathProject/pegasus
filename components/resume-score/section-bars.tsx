"use client";

import type { ApiScoreReport } from "@/lib/api-client";
import { SECTION_ORDER, sectionLabel } from "./sections";

// SectionBars — horizontal score bar chart for the header strip.
// Mirrors Naukri's "Section Scores" panel. Each row: label · score
// number · proportional-fill bar. Colour-coded by score tier.

function barClass(score: number): string {
  if (score >= 80) return "rs-section-bar-fill rs-section-bar-fill--strong";
  if (score >= 60) return "rs-section-bar-fill rs-section-bar-fill--ok";
  return "rs-section-bar-fill rs-section-bar-fill--weak";
}

export function SectionBars({ report }: { report: ApiScoreReport }) {
  return (
    <div className="rs-section-bars" role="list">
      {SECTION_ORDER.map((key) => {
        const sec = report.sections[key];
        const score = sec?.score ?? 0;
        const pct = Math.max(0, Math.min(100, score));
        return (
          <div key={key} className="rs-section-bar" role="listitem">
            <span className="rs-section-bar-label">{sectionLabel(key)}</span>
            <div className="rs-section-bar-track">
              <div
                className={barClass(score)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="rs-section-bar-score">{score}</span>
          </div>
        );
      })}
    </div>
  );
}
