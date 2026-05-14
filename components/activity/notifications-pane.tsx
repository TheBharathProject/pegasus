"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  ChatIcon,
  HelpIcon,
  SparkleStarIcon
} from "@/components/icons";
import type { ApiNotification } from "@/lib/api-client";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationVerb
} from "@/lib/notifications";

// Pane for the Activity panel — see ADR-0007 D1. Lifted verbatim from the
// pre-shell /notifications page body so we keep the exact UX (filter chips,
// mark-read flow, deep-link on click). The shell owns visibility; this pane
// owns its data.

function kindIcon(kind: string) {
  switch (kind) {
    case "app_stale":
    case "app_deadline":
      return <BellIcon width={14} height={14} />;
    case "community_reply":
      return <ChatIcon width={14} height={14} />;
    case "digest":
      return <SparkleStarIcon width={14} height={14} />;
    default:
      return <HelpIcon width={14} height={14} />;
  }
}

function fmtRelative(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function NotificationsPane({
  unreadCountCallback
}: {
  // Lets the shell render "Mark all read" in the page header when there are
  // unread rows in this pane. Pulled out so the action button is positioned
  // in the title row, not buried in the pane body.
  unreadCountCallback?: (count: number, markAll: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadNotifications({ unreadOnly, cursor: null })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unreadOnly]);

  const loadMore = async () => {
    if (!nextCursor) return;
    const res = await loadNotifications({ unreadOnly, cursor: nextCursor });
    setItems((prev) => [...prev, ...res.items]);
    setNextCursor(res.nextCursor);
  };

  const onRowClick = async (n: ApiNotification) => {
    if (!n.readAt) {
      const stamped: ApiNotification = { ...n, readAt: new Date().toISOString() };
      setItems((prev) => prev.map((x) => (x.id === n.id ? stamped : x)));
      try {
        await markNotificationRead(n.id);
      } catch {
        setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
      }
    }
    if (n.linkPath) {
      // Next.js basePath ("/pegasus") is prepended automatically by
      // router.push(). Backend stores basePath-relative paths today,
      // but historical rows have the `/pegasus` prefix baked in —
      // strip it defensively so those still navigate correctly
      // instead of double-prefixing to `/pegasus/pegasus/…`.
      const path = n.linkPath.startsWith("/pegasus/")
        ? n.linkPath.slice("/pegasus".length)
        : n.linkPath;
      router.push(path);
    }
  };

  const onMarkAll = async () => {
    setBusyAll(true);
    try {
      const { marked } = await markAllNotificationsRead();
      if (marked > 0) {
        setItems((prev) =>
          prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() }))
        );
      }
    } finally {
      setBusyAll(false);
    }
  };

  const unreadCount = items.filter((x) => !x.readAt).length;

  // Surface the mark-all callback up to the shell whenever the count changes.
  useEffect(() => {
    unreadCountCallback?.(unreadCount, onMarkAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, busyAll]);

  return (
    <>
      <div className="filters" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={!unreadOnly ? "filter-box is-active" : "filter-box"}
          onClick={() => setUnreadOnly(false)}
        >
          All
        </button>
        <button
          type="button"
          className={unreadOnly ? "filter-box is-active" : "filter-box"}
          onClick={() => setUnreadOnly(true)}
        >
          Unread
        </button>
      </div>

      {loading ? (
        <p className="muted small" style={{ marginTop: 24 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div className="community-empty" style={{ marginTop: 24 }}>
          <span className="community-empty-icon">
            <BellIcon width={22} height={22} />
          </span>
          <h3>{unreadOnly ? "No unread notifications" : "No notifications yet"}</h3>
          <p>
            When something happens to your applications or community posts, it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li
              key={n.id}
              className={n.readAt ? "notif-row" : "notif-row notif-row--unread"}
              onClick={() => onRowClick(n)}
            >
              <span className="notif-icon" aria-hidden>
                {kindIcon(n.kind)}
              </span>
              <div className="notif-body">
                <p className="notif-eyebrow">{notificationVerb(n)}</p>
                <p className="notif-title">{n.title}</p>
                {n.body ? <p className="notif-detail">{n.body}</p> : null}
              </div>
              <span className="notif-time">{fmtRelative(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className="section-actions" style={{ justifyContent: "center", marginTop: 18 }}>
          <button type="button" className="ghost-button" onClick={loadMore}>
            Load more
          </button>
        </div>
      ) : null}
    </>
  );
}
