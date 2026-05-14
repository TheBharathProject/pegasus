"use client";

// ScoreTabs — segmented control that switches between the three views
// of a v2 Resume Score: Sections / Checklist / Improvement Plan.
// The active tab is controlled (URL-driven via ?tab=...) so refresh
// preserves location and the Copy Link button can capture the tab.

export type ScoreTab = "sections" | "checklist" | "plan";

const TABS: { key: ScoreTab; label: string }[] = [
  { key: "sections", label: "Sections" },
  { key: "checklist", label: "Checklist" },
  { key: "plan", label: "Improvement Plan" }
];

export function ScoreTabs({
  active,
  onSelect
}: {
  active: ScoreTab;
  onSelect: (tab: ScoreTab) => void;
}) {
  return (
    <div className="rs-tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={
            t.key === active ? "rs-tab is-active" : "rs-tab"
          }
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
