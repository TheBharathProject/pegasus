"use client";

import type { ApiScoreSection } from "@/lib/api-client";
import { FindingRow } from "./finding-row";
import { countsText, findingCounts, sectionLabel, type SectionKey } from "./sections";

// SectionFindings — right-side panel for the currently-selected section.
// Renders the title line ("Work Experience  70 / 100"), the counts row
// ("2 to fix · 5 to improve · 1 good"), and the findings list.

export function SectionFindings({
  sectionKey,
  section
}: {
  sectionKey: SectionKey;
  section: ApiScoreSection | undefined;
}) {
  const counts = findingCounts(section);
  const score = section?.score ?? 0;
  const findings = section?.findings ?? [];

  return (
    <div className="rs-section-findings">
      <header className="rs-section-findings-head">
        <h2>
          {sectionLabel(sectionKey)}{" "}
          <span className="rs-section-findings-score" data-score={score}>
            {score}
          </span>
          <span className="muted"> / 100</span>
        </h2>
        <p className="muted small rs-section-findings-counts">
          {countsText(counts) || "No findings"}
        </p>
      </header>
      {findings.length > 0 ? (
        <ul className="rs-finding-list">
          {findings.map((f, i) => (
            <FindingRow key={`${sectionKey}-${i}`} finding={f} />
          ))}
        </ul>
      ) : (
        <p className="muted small" style={{ marginTop: 20 }}>
          No findings for this section — the AI returned an empty list.
        </p>
      )}
    </div>
  );
}
