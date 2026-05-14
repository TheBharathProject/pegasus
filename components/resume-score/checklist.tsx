"use client";

import { useMemo } from "react";
import type {
  ApiChecklistGroup,
  ApiChecklistItem
} from "@/lib/api-client";
import { ChecklistRow } from "./checklist-row";

// Checklist — full audit view with three groups (Common Mistakes /
// Do's & Don'ts / Stands Out). Items inside each group are rendered in
// the order returned by the backend (which already sorts canonically
// after ValidateScoreReport).

const GROUPS: { key: ApiChecklistGroup; label: string; subtitle: string }[] = [
  {
    key: "common_mistakes",
    label: "Common Mistakes",
    subtitle: "Things that hurt the resume in recruiter screening."
  },
  {
    key: "dos_donts",
    label: "Do's and Don'ts",
    subtitle: "Structural and content rules every resume should pass."
  },
  {
    key: "stands_out",
    label: "Stands Out",
    subtitle: "What the resume nails — and what it could nail."
  }
];

function countByStatus(items: ApiChecklistItem[]): {
  pass: number;
  warn: number;
  fail: number;
  na: number;
} {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let na = 0;
  for (const it of items) {
    if (it.status === "pass") pass++;
    else if (it.status === "warn") warn++;
    else if (it.status === "fail") fail++;
    else if (it.status === "na") na++;
  }
  return { pass, warn, fail, na };
}

// sourceDependentNa counts N/A items whose evidence references the
// missing source. The prompt emits a stable string ("needs the
// LaTeX/source view") when latexSource isn't provided — we match on
// "LaTeX" OR "source view" so older reports with the previous wording
// still trip the banner.
function sourceDependentNa(items: ApiChecklistItem[]): number {
  let n = 0;
  for (const it of items) {
    if (it.status !== "na") continue;
    const e = it.evidence?.toLowerCase() ?? "";
    if (
      e.includes("source formatting") ||
      e.includes("source view") ||
      e.includes("latex/source") ||
      e.includes("formatting check")
    ) {
      n++;
    }
  }
  return n;
}

export function Checklist({ items }: { items: ApiChecklistItem[] }) {
  const groups = useMemo(() => {
    const byGroup: Record<ApiChecklistGroup, ApiChecklistItem[]> = {
      common_mistakes: [],
      dos_donts: [],
      stands_out: []
    };
    for (const it of items) {
      if (byGroup[it.group]) byGroup[it.group].push(it);
    }
    return byGroup;
  }, [items]);

  const naSourceCount = useMemo(() => sourceDependentNa(items), [items]);

  return (
    <div className="rs-checklist">
      {naSourceCount >= 3 ? (
        <section className="rs-checklist-banner">
          <strong>{naSourceCount} formatting checks couldn&apos;t be evaluated.</strong>{" "}
          When you score an <strong>uploaded PDF</strong> or <strong>pasted text</strong>,
          the AI only sees the extracted prose — not the layout. Visual checks
          like single-column layout, bolding policy, photo, and font
          consistency need the source view.
          <br />
          <a href="/pegasus/resume-builder">Score a Resume Builder draft</a> to get
          all 42 items evaluated.
        </section>
      ) : null}
      {GROUPS.map(({ key, label, subtitle }) => {
        const groupItems = groups[key] ?? [];
        if (groupItems.length === 0) return null;
        const counts = countByStatus(groupItems);
        return (
          <section key={key} className="rs-checklist-group">
            <header className="rs-checklist-group-head">
              <h3>{label}</h3>
              <p className="muted small">{subtitle}</p>
              <p className="rs-checklist-group-counts muted small">
                {counts.pass > 0 ? `${counts.pass} pass` : null}
                {counts.warn > 0 ? ` · ${counts.warn} warn` : null}
                {counts.fail > 0 ? ` · ${counts.fail} fail` : null}
                {counts.na > 0 ? ` · ${counts.na} n/a` : null}
              </p>
            </header>
            <ul className="rs-checklist-list">
              {groupItems.map((it) => (
                <ChecklistRow key={it.id} item={it} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
