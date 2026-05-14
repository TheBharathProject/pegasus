"use client";

// ScoreCircle — large SVG donut showing the overall (or section) score
// out of 100. Stroke colour tracks the score tier: green ≥80, amber 60-79,
// red <60. Used in two places: big overall on the left rail of the
// Resume Score page, smaller per-section if we ever want it inline.

const RADIUS = 56;
const STROKE = 8;
const CIRC = 2 * Math.PI * RADIUS;

export function ScoreCircle({
  score,
  size = 140,
  label = "OVERALL SCORE"
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const dash = (clamped / 100) * CIRC;
  const tone =
    clamped >= 80
      ? "var(--rs-tone-good)"
      : clamped >= 60
        ? "var(--rs-tone-ok)"
        : "var(--rs-tone-weak)";
  return (
    <div className="rs-score-circle" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 140 140"
        width={size}
        height={size}
        style={{ display: "block" }}
      >
        <circle
          cx={70}
          cy={70}
          r={RADIUS}
          fill="none"
          stroke="var(--rs-track)"
          strokeWidth={STROKE}
        />
        <circle
          cx={70}
          cy={70}
          r={RADIUS}
          fill="none"
          stroke={tone}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC - dash}`}
          // Start at 12-o'clock, sweep clockwise.
          transform="rotate(-90 70 70)"
        />
        <text
          x={70}
          y={78}
          textAnchor="middle"
          fontSize="38"
          fontWeight="600"
          fill="var(--text)"
          fontFamily="var(--font-serif-stack)"
        >
          {clamped}
        </text>
      </svg>
      {label ? <p className="rs-score-circle-label muted small">{label}</p> : null}
    </div>
  );
}
