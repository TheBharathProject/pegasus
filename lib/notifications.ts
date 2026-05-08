"use client";

// Notifications hooks — thin wrappers over the api client. Two paths:
//
//   useUnreadCount()   — small, frequent (60s) — drives the bell badge
//                         in the sidebar. Polls only while authed; pauses
//                         when the tab is hidden so we don't burn API
//                         calls in background tabs.
//
//   loadNotifications() — used by the /notifications page. Returns one
//                         page + a nextCursor; the page paginates with
//                         "Load more". No live updates today (refresh
//                         on action is enough at our notification rate).

import { useEffect, useRef, useState } from "react";
import { api, type ApiNotification, type ApiNotificationListResponse } from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";

const POLL_INTERVAL_MS = 60_000;

export function useUnreadCount(): number {
  const [count, setCount] = useState<number>(0);
  // Hold the latest poll handle so we can clear it on unmount or auth flip.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      // Skip if signed out — avoids a 401 every 60s on a logged-out tab.
      if (!isAuthed()) {
        if (!cancelled) setCount(0);
      } else {
        try {
          const r = await api.get<{ unread: number }>("/job-tracker/notifications/count");
          if (!cancelled) setCount(r.unread ?? 0);
        } catch {
          // Network errors are fine; we'll catch up on the next tick.
        }
      }
      if (!cancelled) {
        timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    // Pause polling when the tab is hidden (Page Visibility API). When
    // the user comes back, the next tick fires immediately so the badge
    // is fresh on focus return.
    const onVis = () => {
      if (document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        tick();
      }
    };

    tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return count;
}

// One-shot list fetch. Used by /notifications. Returns the page and the
// cursor; pass cursor back to load the next page.
export async function loadNotifications(opts: {
  unreadOnly?: boolean;
  cursor?: string | null;
  limit?: number;
}): Promise<ApiNotificationListResponse> {
  const params = new URLSearchParams();
  if (opts.unreadOnly) params.set("unreadOnly", "1");
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const q = params.toString() ? `?${params.toString()}` : "";
  return api.get<ApiNotificationListResponse>(`/job-tracker/notifications${q}`);
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/job-tracker/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<{ marked: number }> {
  return api.patch<{ marked: number }>("/job-tracker/notifications/read-all");
}

// Pure helpers exported so the page + sidebar share the same icon /
// verb mapping. Add a new case here when introducing a new `kind`.
export function notificationVerb(n: ApiNotification): string {
  switch (n.kind) {
    case "app_stale":
      return "Stale application";
    case "app_deadline":
      return "Approaching deadline";
    case "community_reply":
      return "New reply";
    case "digest":
      return "Daily digest";
    default:
      return "Update";
  }
}
