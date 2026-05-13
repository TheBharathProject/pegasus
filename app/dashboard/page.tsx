"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductFrame } from "@/components/frames";
import { MetricCard } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { api, type ApiApplication, type ApiDashboard, type ApiUser } from "@/lib/api-client";
import { getMe, isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";

function greetingFor(hour: number): string {
  if (hour < 4) return "Still up,";
  if (hour < 7) return "Up early,";
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Afternoon,";
  if (hour < 21) return "Evening,";
  return "Burning the midnight oil,";
}

const FUNNEL_STAGES: Array<{ key: string; label: string }> = [
  { key: "INTERESTED", label: "Interested" },
  { key: "APPLIED", label: "Applied" },
  { key: "PHONE_SCREEN", label: "Phone screen" },
  { key: "TECHNICAL", label: "Technical" },
  { key: "ONSITE", label: "Onsite" },
  { key: "OFFER", label: "Offer" }
];

const INTERVIEW_STAGES = new Set(["PHONE_SCREEN", "TECHNICAL", "ONSITE", "OFFER"]);

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const day = m.getDay(); // Sunday = 0
  const diff = day === 0 ? -6 : 1 - day;
  m.setDate(m.getDate() + diff);
  return m;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [greeting, setGreeting] = useState("Still up,");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [metrics, setMetrics] = useState<ApiDashboard | null>(null);
  const [applications, setApplications] = useState<ApiApplication[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    // /me routes through the shared cache in lib/auth so dashboard +
    // sidebar + settings share one request. Analytics + applications are
    // page-specific so they go direct.
    Promise.all([
      getMe(),
      api.get<ApiDashboard>("/job-tracker/analytics/dashboard"),
      api.get<{ items: ApiApplication[] }>("/job-tracker/applications")
    ])
      .then(([u, m, page]) => {
        if (u) setUser(u as ApiUser);
        setMetrics(m);
        setApplications(page.items ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const firstName = user ? user.name.split(" ")[0] || user.name : "…";
  const showTrends = (metrics?.total ?? 0) >= 3;

  // ---- Pipeline funnel (count per stage, in canonical order) ----
  const funnel = useMemo(() => {
    if (!showTrends) return [];
    const counts = FUNNEL_STAGES.map((s) => ({
      ...s,
      count: applications.filter((a) => a.stage === s.key).length
    }));
    return counts;
  }, [applications, showTrends]);

  const funnelMax = useMemo(
    () => Math.max(1, ...funnel.map((f) => f.count)),
    [funnel]
  );

  // ---- Weekly activity (last 8 ISO weeks of appliedAt) ----
  const weekly = useMemo(() => {
    if (!showTrends) return [];
    const buckets = new Map<string, number>();
    for (const a of applications) {
      if (!a.appliedAt) continue;
      const monday = mondayOf(new Date(a.appliedAt));
      const key = monday.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const today = new Date();
    const out: Array<{ weekStart: string; count: number }> = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const key = mondayOf(d).toISOString().slice(0, 10);
      out.push({ weekStart: key, count: buckets.get(key) ?? 0 });
    }
    return out;
  }, [applications, showTrends]);

  const weeklyMax = useMemo(
    () => Math.max(1, ...weekly.map((w) => w.count)),
    [weekly]
  );

  // ---- Top sources (by total applications, with interviews subset) ----
  const sources = useMemo(() => {
    if (!showTrends) return [];
    const map = new Map<string, { total: number; interviews: number }>();
    for (const a of applications) {
      const key = (a.source && a.source.trim()) || "Other";
      const cur = map.get(key) ?? { total: 0, interviews: 0 };
      cur.total++;
      if (INTERVIEW_STAGES.has(a.stage)) cur.interviews++;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source))
      .slice(0, 6);
  }, [applications, showTrends]);

  const sourceMax = useMemo(
    () => Math.max(1, ...sources.map((s) => s.total)),
    [sources]
  );

  return (
    <ProductFrame
      active="dashboard"
      title={`${firstName}.`}
      intro="A small calm place for the loud work of looking."
      kicker={<p className="kicker-greeting">{greeting}</p>}
    >
      {error ? (
        <section className="notice">
          <em>Could not load dashboard: {error}</em>
        </section>
      ) : null}

      <section className="metric-grid">
        <MetricCard
          label="Total"
          value={metrics ? String(metrics.total) : "—"}
          detail={metrics ? `+${metrics.addedThisWeek} this week` : ""}
        />
        <MetricCard
          label="In pipeline"
          value={metrics ? String(metrics.inPipeline) : "—"}
          detail={
            metrics && metrics.total > 0
              ? `${Math.round((metrics.inPipeline / metrics.total) * 100)}% active`
              : ""
          }
        />
        <MetricCard
          label="Interviews"
          value={metrics ? String(metrics.interviews) : "—"}
          detail=""
        />
        <MetricCard
          label="Offers"
          value={metrics ? String(metrics.offers) : "—"}
          detail=""
        />
      </section>

      {metrics && metrics.total < 3 ? (
        <section className="notice">
          <em>Add a few more applications to unlock your pipeline analytics.</em>
        </section>
      ) : null}

      {showTrends ? (
        <>
          <section className="dash-panel" aria-labelledby="dash-funnel-h">
            <p className="eyebrow" id="dash-funnel-h">
              Pipeline funnel
            </p>
            <div className="dash-funnel">
              {funnel.map((f) => (
                <div className="dash-funnel-row" key={f.key}>
                  <span className="dash-funnel-label">{f.label}</span>
                  <div className="dash-funnel-track">
                    <span
                      className="dash-funnel-bar"
                      style={{ width: `${(f.count / funnelMax) * 100}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="dash-funnel-count">{f.count}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="dash-trend-grid">
            <section className="dash-panel" aria-labelledby="dash-weekly-h">
              <p className="eyebrow" id="dash-weekly-h">
                Weekly activity
              </p>
              <div className="dash-weekly">
                <div className="dash-weekly-axis" aria-hidden="true">
                  {[weeklyMax, Math.ceil(weeklyMax * 0.66), Math.ceil(weeklyMax * 0.33), 0].map(
                    (n, i) => (
                      <span key={i}>{n}</span>
                    )
                  )}
                </div>
                <div className="dash-weekly-chart">
                  {weekly.map((w) => (
                    <div className="dash-weekly-col" key={w.weekStart}>
                      <div className="dash-weekly-bar-track" aria-hidden="true">
                        <span
                          className="dash-weekly-bar"
                          style={{ height: `${(w.count / weeklyMax) * 100}%` }}
                          title={`${w.count} on ${shortDate(w.weekStart)}`}
                        />
                      </div>
                      <span className="dash-weekly-label">{shortDate(w.weekStart)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="dash-panel" aria-labelledby="dash-sources-h">
              <p className="eyebrow" id="dash-sources-h">
                Top sources
              </p>
              <div className="dash-sources">
                {sources.map((s) => (
                  <div className="dash-source-row" key={s.source}>
                    <span className="dash-source-label">{s.source}</span>
                    <div className="dash-source-track">
                      <span
                        className="dash-source-bar dash-source-bar--total"
                        style={{ width: `${(s.total / sourceMax) * 100}%` }}
                        aria-hidden="true"
                      />
                      {s.interviews > 0 ? (
                        <span
                          className="dash-source-bar dash-source-bar--interviews"
                          style={{ width: `${(s.interviews / sourceMax) * 100}%` }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <span className="dash-source-count">
                      {s.total}
                      {s.interviews > 0 ? <em> · {s.interviews} interviews</em> : null}
                    </span>
                  </div>
                ))}
              </div>
              <div className="dash-source-legend" aria-hidden="true">
                <span>
                  <span className="dash-legend-dot dash-legend-dot--total" /> Total
                </span>
                <span>
                  <span className="dash-legend-dot dash-legend-dot--interviews" /> Interviews
                </span>
              </div>
            </section>
          </div>
        </>
      ) : null}

      <section className="quick-grid">
        <Link className="quick-card" href="/applications">
          <p className="eyebrow">Track</p>
          <h2>
            Your applications <ArrowRightIcon width={18} height={18} />
          </h2>
          <p>Pipeline stages, notes, and the slow honest math of your search.</p>
        </Link>
        <Link className="quick-card" href="/recruiters">
          <p className="eyebrow">Connect</p>
          <h2>
            Your recruiters <ArrowRightIcon width={18} height={18} />
          </h2>
          <p>Your private CRM for recruiter contacts — separate from the community directory.</p>
        </Link>
      </section>
    </ProductFrame>
  );
}
