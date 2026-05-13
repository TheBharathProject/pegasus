"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";
import { GaugeIcon, RefreshIcon, SparkleStarIcon } from "@/components/icons";
import { goTo } from "@/lib/paths";
import { renderMarkdown } from "@/lib/markdown";
import {
  api,
  type ApiAIReport,
  type ApiAIReportSummary,
  type ApiAIReportsResponse
} from "@/lib/api-client";

// Resume report history pane — see ADR-0007 D4. List is cheap (no markdown);
// each row click fetches the full report by id and renders it in a modal.

type SortKey = "date" | "score";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function scoreTone(n: number): string {
  if (n >= 80) return "score-chip score-chip--strong";
  if (n >= 60) return "score-chip score-chip--ok";
  return "score-chip score-chip--weak";
}

export function ResumeReportsPane() {
  const [items, setItems] = useState<ApiAIReportSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");

  // Drill-in modal state.
  const [openId, setOpenId] = useState<string | null>(null);
  const [openReport, setOpenReport] = useState<ApiAIReport | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const fetchPage = async (cursor: string | null) => {
    const qs = new URLSearchParams();
    if (cursor) qs.set("cursor", cursor);
    const path = `/job-tracker/ai/resume/reports${qs.toString() ? `?${qs.toString()}` : ""}`;
    return api.get<ApiAIReportsResponse>(path);
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPage(null);
      setItems(res.items);
      setNextCursor(res.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      const res = await fetchPage(nextCursor);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openRow = async (r: ApiAIReportSummary) => {
    setOpenId(r.id);
    setOpenReport(null);
    setOpenError(null);
    setOpenLoading(true);
    try {
      const full = await api.get<ApiAIReport>(`/job-tracker/ai/resume/reports/${r.id}`);
      setOpenReport(full);
    } catch (e) {
      setOpenError((e as Error).message);
    } finally {
      setOpenLoading(false);
    }
  };

  const sorted = [...items].sort((a, b) => {
    if (sortKey === "score") return (b.score ?? 0) - (a.score ?? 0);
    // date: items already come newest-first; preserve that
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
      <div className="activity-toolbar" style={{ marginTop: 12 }}>
        <div className="filters">
          <span className="activity-toolbar-label">Sort</span>
          <button
            type="button"
            className={sortKey === "date" ? "filter-box is-active" : "filter-box"}
            onClick={() => setSortKey("date")}
          >
            Newest
          </button>
          <button
            type="button"
            className={sortKey === "score" ? "filter-box is-active" : "filter-box"}
            onClick={() => setSortKey("score")}
          >
            Highest score
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Refresh"
          title="Refresh"
          onClick={() => void refresh()}
        >
          <RefreshIcon width={14} height={14} />
        </button>
      </div>

      {error ? (
        <section className="notice" style={{ marginTop: 12 }}>
          <em>{error}</em>
        </section>
      ) : null}

      {loading ? (
        <p className="muted small" style={{ marginTop: 24 }}>Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="community-empty" style={{ marginTop: 24 }}>
          <span className="community-empty-icon">
            <GaugeIcon width={22} height={22} />
          </span>
          <h3>No resume reviews yet</h3>
          <p>
            Run your first review — your score and feedback will show up here for later
            comparison.
          </p>
          <button className="primary-button" type="button" onClick={() => goTo("/resume")}>
            <SparkleStarIcon width={14} height={14} /> Review my resume
          </button>
        </div>
      ) : (
        <div className="activity-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th style={{ width: 96 }}>Score</th>
                <th>Resume</th>
                <th style={{ width: 96 }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => void openRow(r)}
                >
                  <td data-label="Date">{fmtDate(r.createdAt)}</td>
                  <td data-label="Score">
                    <span className={scoreTone(r.score)}>{r.score}</span>
                  </td>
                  <td data-label="Resume">{r.resumeFilename ?? <em className="muted">deleted</em>}</td>
                  <td data-label="" className="num">
                    <span className="link-like">View →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor ? (
        <div className="section-actions" style={{ justifyContent: "center", marginTop: 18 }}>
          <button type="button" className="ghost-button" onClick={() => void loadMore()}>
            Load more
          </button>
        </div>
      ) : null}

      <ModalShell
        open={!!openId}
        onClose={() => {
          setOpenId(null);
          setOpenReport(null);
        }}
        title="Resume review"
        titleId="report-detail-title"
        width="min(820px, 92vw)"
      >
        {openLoading ? (
          <p className="muted small">Loading report…</p>
        ) : openError ? (
          <section className="notice"><em>{openError}</em></section>
        ) : openReport ? (
          <>
            <div className="activity-report-head">
              <span className={scoreTone(openReport.score)} style={{ fontSize: 14 }}>
                {openReport.score} / 100
              </span>
              <span className="muted small">{fmtDate(openReport.createdAt)}</span>
            </div>
            <div
              className="markdown-body"
              style={{ marginTop: 14 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(openReport.reportMd) }}
            />
          </>
        ) : null}
      </ModalShell>
    </>
  );
}
