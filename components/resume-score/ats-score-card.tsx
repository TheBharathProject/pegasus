"use client";

import { ScoreCircle } from "./score-circle";

// AtsScoreCard — small ATS score gauge that sits next to the overall
// score in the header strip. Visually distinct (different size + label)
// from ScoreCircle so the user understands these are two numbers.

export function AtsScoreCard({ score }: { score: number }) {
  return (
    <div className="rs-ats-card">
      <ScoreCircle score={score} size={100} label="ATS SCORE" />
    </div>
  );
}
