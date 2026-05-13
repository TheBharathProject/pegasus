"use client";

// Notifications hooks — thin wrappers over the api client.
//
//   useUnreadCount()   — drives the bell badge in the sidebar. One shared
//                         60s polling timer at module scope; React hooks
//                         subscribe instead of each starting their own
//                         interval. Pauses when the tab is hidden, resumes
//                         on focus. Pauses when no subscribers are mounted.
//
//   loadNotifications() — used by the /notifications page. Returns one
//                         page + a nextCursor; the page paginates with
//                         "Load more". No live updates today.

import { useEffect, useState } from "react";
import { api, type ApiNotification, type ApiNotificationListResponse } from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";

const POLL_INTERVAL_MS = 60_000;

// ---- Module-level state -------------------------------------------------
//
// One cache, one inflight, one timer, one set of subscribers across the
// whole app. Previously every consumer of useUnreadCount() started its
// own 60s loop and fired its own initial fetch on mount; with ProductFrame
// remounting on every navigation that meant a fresh fetch every nav.

type CountCache = { unread: number; fetchedAt: number };

let cache: CountCache | null = null;
let inflight: Promise<number> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(n: number) => void>();
let visibilityListenerInstalled = false;

function notify(unread: number): void {
  subscribers.forEach((cb) => {
    try {
      cb(unread);
    } catch {
      /* a subscriber's setState should never throw; if it does, the others
         shouldn't pay for it */
    }
  });
}

// Shared fetcher. Multiple concurrent callers share `inflight`; the cache
// holds the last successful value so a fresh subscriber within the poll
// window doesn't trigger a new network call.
//
// `force` is set by the polling timer's recurring tick so it always
// refreshes on the 60s boundary. The default (cache-aware) path is what
// new subscribers on navigation use — they pull from cache without a
// network call as long as the last fetch is younger than the poll
// interval. This is what stops the per-navigation /count refire.
async function fetchUnreadCount(opts?: { force?: boolean }): Promise<number> {
  const now = Date.now();
  if (!opts?.force && cache && now - cache.fetchedAt < POLL_INTERVAL_MS) {
    return cache.unread;
  }
  if (inflight) return inflight;

  if (!isAuthed()) {
    cache = { unread: 0, fetchedAt: Date.now() };
    notify(0);
    return 0;
  }

  inflight = (async () => {
    try {
      const r = await api.get<{ unread: number }>("/job-tracker/notifications/count");
      const n = r.unread ?? 0;
      cache = { unread: n, fetchedAt: Date.now() };
      notify(n);
      return n;
    } catch {
      // Network errors leave the cache untouched — the next tick retries.
      return cache?.unread ?? 0;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// startTimer ensures exactly one polling loop is active. Idempotent —
// calling it while a timer is already scheduled is a no-op.
//
// First tick after a fresh start is cache-aware (no network if a recent
// fetch is still warm — this is what stops every navigation from re-firing
// /count when ProductFrame remounts). Subsequent recurring ticks force a
// refresh so the bell stays accurate.
function startTimer(): void {
  if (timer !== null) return;
  if (typeof document !== "undefined" && document.hidden) return; // paused
  let isFirstTick = true;
  const tick = async () => {
    await fetchUnreadCount({ force: !isFirstTick });
    isFirstTick = false;
    if (subscribers.size === 0) {
      timer = null;
      return;
    }
    if (typeof document !== "undefined" && document.hidden) {
      timer = null;
      return;
    }
    timer = setTimeout(tick, POLL_INTERVAL_MS);
  };
  timer = setTimeout(tick, 0);
}

function stopTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

// Install Page Visibility listener once. The previous per-hook install
// meant every mount registered another listener; this collapses to one.
function ensureVisibilityListener(): void {
  if (visibilityListenerInstalled || typeof document === "undefined") return;
  visibilityListenerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopTimer();
    } else if (subscribers.size > 0) {
      // On focus return: tick immediately, then resume the loop.
      stopTimer();
      startTimer();
    }
  });
}

// invalidateUnreadCount drops the cache so the next fetch hits the network.
// Useful after actions that change unread state (mark-read, mark-all-read).
export function invalidateUnreadCount(): void {
  cache = null;
}

export function useUnreadCount(): number {
  const [count, setCount] = useState<number>(cache?.unread ?? 0);

  useEffect(() => {
    ensureVisibilityListener();
    const cb = (n: number) => setCount(n);
    subscribers.add(cb);
    // Kick the timer if it isn't running yet. fetchUnreadCount inside the
    // first tick will hit cache and avoid a network call when fresh.
    startTimer();
    return () => {
      subscribers.delete(cb);
      // Last subscriber leaving stops the loop — no orphan timers.
      if (subscribers.size === 0) {
        stopTimer();
      }
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
}): Promise<{ items: ApiNotification[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (opts.unreadOnly) qs.set("unreadOnly", "1");
  if (opts.cursor) qs.set("cursor", opts.cursor);
  if (opts.limit) qs.set("limit", String(opts.limit));
  const path = `/job-tracker/notifications${qs.toString() ? `?${qs.toString()}` : ""}`;
  const res = await api.get<ApiNotificationListResponse>(path);
  return { items: res.items, nextCursor: res.nextCursor ?? null };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/job-tracker/notifications/${id}/read`);
  // Reading reduces unread count — invalidate so the next bell-poll picks
  // up the new total. We don't speculatively decrement here because the
  // user might mark-read a notification that was already read in another tab.
  invalidateUnreadCount();
}

export async function markAllNotificationsRead(): Promise<{ marked: number }> {
  const res = await api.patch<{ marked: number }>("/job-tracker/notifications/read-all");
  invalidateUnreadCount();
  // Force-fetch immediately so the bell drops to 0 without waiting for the
  // next 60s tick. fetchUnreadCount's inflight dedup handles concurrent calls.
  void fetchUnreadCount({ force: true });
  return res;
}

// notificationVerb maps a notification kind to the "verb phrase" rendered
// in the eyebrow of each row. Keep this aligned with the kinds emitted
// from the backend (internal/jobtracker/handlers_community.go, etc.).
export function notificationVerb(n: ApiNotification): string {
  switch (n.kind) {
    case "app_stale":
      return "Application getting stale";
    case "app_deadline":
      return "Apply deadline approaching";
    case "community_reply":
      return "New reply on your post";
    case "community_mention":
      return "You were mentioned";
    case "digest":
      return "Daily digest";
    case "reminder_fired":
      return "Reminder";
    default:
      return "Notification";
  }
}
