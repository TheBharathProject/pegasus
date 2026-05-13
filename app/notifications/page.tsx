// NOTE: This route is named `/notifications` for historical reasons but the
// page is the **Activity** center per ADR-0007 D1. The misnomer is documented
// debt — rename triggers are listed in the ADR's "When to revisit" section.
// Don't rename in place without also updating email templates, the Pegasus
// extension popup link, and inbound links from notification linkPath.
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import { goTo } from "@/lib/paths";
import { isAuthed } from "@/lib/auth";
import { NotificationsPane } from "@/components/activity/notifications-pane";
import { ResumeReportsPane } from "@/components/activity/resume-reports-pane";
import { RemindersPane } from "@/components/activity/reminders-pane";

type TabKey = "notifications" | "reports" | "reminders";

const TABS: { key: TabKey; label: string }[] = [
  { key: "notifications", label: "Notifications" },
  { key: "reports", label: "Resume reports" },
  { key: "reminders", label: "Reminders" }
];

function isTab(v: string | null): v is TabKey {
  return v === "notifications" || v === "reports" || v === "reminders";
}

function ActivityShellInner() {
  const search = useSearchParams();
  const tabFromUrl = search.get("tab");
  const current: TabKey = isTab(tabFromUrl) ? tabFromUrl : "notifications";

  // ADR-0007 D3: lazy mount + persistent state. Once activated, a pane stays
  // mounted (hidden via display:none when inactive) so switching back doesn't
  // refetch. First activation per session fires one fetch; refresh button
  // inside each pane handles the on-demand case.
  const [activated, setActivated] = useState<Set<TabKey>>(() => new Set([current]));
  useEffect(() => {
    setActivated((prev) => {
      if (prev.has(current)) return prev;
      const next = new Set(prev);
      next.add(current);
      return next;
    });
  }, [current]);

  // Surfaced from NotificationsPane so the "Mark all read" lives in the
  // page header (matching the pre-shell UX) — visible only when the
  // notifications tab is active AND there's unread to act on.
  const [unreadCount, setUnreadCount] = useState(0);
  const [markAllFn, setMarkAllFn] = useState<(() => Promise<void>) | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const surfaceMarkAll = useCallback((count: number, fn: () => Promise<void>) => {
    setUnreadCount(count);
    setMarkAllFn(() => fn);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
    }
  }, []);

  const onMarkAll = async () => {
    if (!markAllFn) return;
    setBusyAll(true);
    try {
      await markAllFn();
    } finally {
      setBusyAll(false);
    }
  };

  const actions = useMemo(() => {
    if (current !== "notifications" || unreadCount === 0) return null;
    return (
      <button
        type="button"
        className="ghost-button"
        onClick={() => void onMarkAll()}
        disabled={busyAll}
      >
        {busyAll ? "Marking…" : "Mark all read"}
      </button>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, unreadCount, busyAll]);

  // Next.js's <Link> applies the basePath automatically — do NOT prepend it
  // here or we end up with `/pegasus/pegasus/notifications`.
  const tabHref = (k: TabKey) => `/notifications?tab=${k}`;

  return (
    <ProductFrame
      active="notifications"
      title="Activity"
      intro="Your alerts, past resume reviews, and reminders — in one place."
      actions={actions}
    >
      <nav className="community-tabs activity-tabs" aria-label="Activity sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={current === t.key ? "community-tab active" : "community-tab"}
            scroll={false}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activated.has("notifications") ? (
        <div style={{ display: current === "notifications" ? "block" : "none" }}>
          <NotificationsPane unreadCountCallback={surfaceMarkAll} />
        </div>
      ) : null}
      {activated.has("reports") ? (
        <div style={{ display: current === "reports" ? "block" : "none" }}>
          <ResumeReportsPane />
        </div>
      ) : null}
      {activated.has("reminders") ? (
        <div style={{ display: current === "reminders" ? "block" : "none" }}>
          <RemindersPane />
        </div>
      ) : null}
    </ProductFrame>
  );
}

export default function ActivityPage() {
  // useSearchParams() requires a Suspense boundary for static prerender —
  // matches the pattern from app/applications/[id]/page.tsx (ADR-0005 D2).
  return (
    <Suspense fallback={null}>
      <ActivityShellInner />
    </Suspense>
  );
}
