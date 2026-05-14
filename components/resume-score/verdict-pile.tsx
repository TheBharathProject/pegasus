"use client";

import type { ApiVerdictPile } from "@/lib/api-client";

// VerdictPill — Naukri-style verdict badge ("YES PILE" / "MAYBE PILE"
// / "NO PILE"). Sits next to the verdict tagline in the page header.

function pileLabel(pile: ApiVerdictPile): string {
  switch (pile) {
    case "yes":
      return "YES PILE";
    case "maybe":
      return "MAYBE PILE";
    case "no":
      return "NO PILE";
  }
}

export function VerdictPill({
  pile,
  tagline
}: {
  pile: ApiVerdictPile;
  tagline?: string;
}) {
  return (
    <div className="rs-verdict-row">
      <span className={`rs-verdict-pill rs-verdict-pill--${pile}`}>
        {pileLabel(pile)}
      </span>
      {tagline ? (
        <span className="rs-verdict-tagline">{tagline}</span>
      ) : null}
    </div>
  );
}
