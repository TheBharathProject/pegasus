"use client";

import type { ApiFindingTag, ApiScoreFinding } from "@/lib/api-client";

// FindingRow — one item in the per-section list. Coloured background
// tint by tag (red-ish for fix, amber for improve, green for good) plus
// a right-aligned uppercase pill so the tag is scannable at a glance.

function tagLabel(tag: ApiFindingTag): string {
  switch (tag) {
    case "fix":
      return "Fix";
    case "improve":
      return "Improve";
    case "good":
      return "Good";
  }
}

function rowClass(tag: ApiFindingTag): string {
  return `rs-finding rs-finding--${tag}`;
}

export function FindingRow({ finding }: { finding: ApiScoreFinding }) {
  return (
    <li className={rowClass(finding.tag)}>
      <span className="rs-finding-text">{finding.text}</span>
      <span className={`rs-finding-pill rs-finding-pill--${finding.tag}`}>
        {tagLabel(finding.tag)}
      </span>
    </li>
  );
}
