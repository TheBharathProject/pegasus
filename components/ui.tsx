import { ReactNode } from "react";

export function SectionHeading({
  label,
  title,
  body
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      <p className="section-copy">{body}</p>
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="panel">{children}</section>;
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <h3 style={{ fontFamily: 'var(--font-mono)' }}>{value}</h3>
      <p className="muted small">{detail}</p>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}
