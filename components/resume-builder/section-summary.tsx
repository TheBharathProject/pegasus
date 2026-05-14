"use client";

const MAX_SUMMARY = 400;

export function SectionSummary({
  value,
  onChange
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <section className="rb-section" id="rb-jump-summary">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>03</span>
        <h3>Summary</h3>
        <span className="muted small rb-section-head-meta">
          {value.length} / {MAX_SUMMARY}
        </span>
      </header>
      <textarea
        className="feedback-box"
        rows={4}
        placeholder="2–3 sentences on what you do and the impact you've had. Skipped on the PDF if empty."
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_SUMMARY))}
        maxLength={MAX_SUMMARY}
      />
    </section>
  );
}
