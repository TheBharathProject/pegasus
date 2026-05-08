"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import {
  BellIcon,
  ChatIcon,
  HelpIcon,
  SparkleStarIcon
} from "@/components/icons";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";
import type { ApiNotification } from "@/lib/api-client";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationVerb
} from "@/lib/notifications";

// Per-kind glyph in the row. Defaults to BellIcon for unknown kinds —
// new kinds render fine without a code change here.
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

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  // First load + reload when filter flips. Server pages by createdAt;
  // `cursor: null` always means "first page".
  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
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

  // Optimistic mark-read: stamp readAt locally before the round-trip so
  // the UI doesn't flicker. Roll back on failure.
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
      // linkPath is basePath-relative — e.g. "/applications". router.push
      // auto-prefixes with /pegasus, which is exactly right.
      router.push(n.linkPath);
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

  return (
    <ProductFrame
      active="notifications"
      title="Notifications"
      intro="Stale applications, approaching deadlines, and community replies."
      actions={
        unreadCount > 0 ? (
          <button
            type="button"
            className="ghost-button"
            onClick={onMarkAll}
            disabled={busyAll}
          >
            {busyAll ? "Marking…" : "Mark all read"}
          </button>
        ) : null
      }
    >
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
    </ProductFrame>
  );
}
