"use client";

import { useEffect, useMemo, useState } from "react";
import { BellIcon, BellOffIcon, PencilIcon, RefreshIcon } from "@/components/icons";
import { ReminderModal } from "@/components/reminder-modal";
import { goTo } from "@/lib/paths";
import { api, type ApiReminder } from "@/lib/api-client";

// Reminders tab for the Activity panel — see ADR-0007 D6 (inline edit via the
// extracted ReminderModal). Pending / fired / all filter; row click opens the
// modal in edit mode (which carries the delete affordance too).

type StatusFilter = "all" | "pending" | "fired";

function fmtTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function fmtRelativeFuture(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const sign = diff < 0 ? "ago" : "from now";
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${minutes}m ${sign}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${sign}`;
  const days = Math.round(hours / 24);
  return `${days}d ${sign}`;
}

export function RemindersPane() {
  const [items, setItems] = useState<ApiReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<ApiReminder | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.get<ApiReminder[]>("/job-tracker/reminders");
      setItems(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "pending") return items.filter((r) => !r.firedAt);
    if (filter === "fired") return items.filter((r) => !!r.firedAt);
    return items;
  }, [items, filter]);

  // Pending first (by triggers_at asc), then fired (by triggers_at desc).
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aFired = !!a.firedAt;
      const bFired = !!b.firedAt;
      if (aFired !== bFired) return aFired ? 1 : -1;
      const ta = new Date(a.triggersAt).getTime();
      const tb = new Date(b.triggersAt).getTime();
      return aFired ? tb - ta : ta - tb;
    });
  }, [filtered]);

  return (
    <>
      <div className="activity-toolbar" style={{ marginTop: 12 }}>
        <div className="filters">
          <span className="activity-toolbar-label">Status</span>
          <button
            type="button"
            className={filter === "all" ? "filter-box is-active" : "filter-box"}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filter === "pending" ? "filter-box is-active" : "filter-box"}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            type="button"
            className={filter === "fired" ? "filter-box is-active" : "filter-box"}
            onClick={() => setFilter("fired")}
          >
            Fired
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
            <BellOffIcon width={22} height={22} />
          </span>
          <h3>
            {filter === "fired"
              ? "Nothing fired yet"
              : filter === "pending"
                ? "No pending reminders"
                : "No reminders set"}
          </h3>
          <p>
            {filter === "all"
              ? "Set a reminder from any application row — they show up here once you do."
              : filter === "pending"
                ? "Everything queued up has already fired, or you haven't set anything yet."
                : "Fired reminders appear here once they trigger."}
          </p>
          {filter === "all" ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => goTo("/applications")}
            >
              <BellIcon width={14} height={14} /> Set a reminder
            </button>
          ) : null}
        </div>
      ) : (
        <div className="activity-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 200 }}>When</th>
                <th>Application</th>
                <th>Note</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 56 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isFired = !!r.firedAt;
                const appLabel = [r.company, r.role].filter(Boolean).join(" · ") || "—";
                return (
                  <tr
                    key={r.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditing(r)}
                  >
                    <td data-label="When">
                      <div>{fmtTime(r.triggersAt)}</div>
                      <div className="muted small" style={{ fontSize: 11 }}>
                        {fmtRelativeFuture(r.triggersAt)}
                      </div>
                    </td>
                    <td data-label="App">{appLabel}</td>
                    <td data-label="Note">{r.note || <em className="muted">—</em>}</td>
                    <td data-label="Status">
                      <span className={isFired ? "reminder-status fired" : "reminder-status pending"}>
                        {isFired ? "Fired" : "Pending"}
                      </span>
                    </td>
                    <td data-label="" className="num" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Edit reminder"
                        title="Edit"
                        onClick={() => setEditing(r)}
                      >
                        <PencilIcon width={14} height={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <ReminderModal
          open
          mode="edit"
          reminderId={editing.id}
          initialTriggersAt={editing.triggersAt}
          initialNote={editing.note}
          applicationLabel={[editing.company, editing.role].filter(Boolean).join(" · ")}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
          onDeleted={() => void refresh()}
        />
      ) : null}
    </>
  );
}
