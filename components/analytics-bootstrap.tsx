"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

// AnalyticsBootstrap — invisible client component mounted once at the
// root layout. Handles two concerns @next/third-parties doesn't cover
// out of the box for the App Router:
//
//   1. SPA page views — gtag's auto-tracking only fires on initial
//      load; route changes triggered by `next/link` need an explicit
//      `event: page_view`. We listen to usePathname / useSearchParams
//      and emit one on every change.
//   2. User identification — once getMe() resolves, attach user.id
//      to subsequent events as GA4's `user_id` so the same person
//      across devices shows up as one user in reports. We send the
//      UUID, NOT the email (GA's user_id is for cross-device
//      stitching, not PII).
//
// When NEXT_PUBLIC_GA_ID is unset, window.gtag is never
// injected by <GoogleAnalytics>, so both effects short-circuit
// silently.

export function AnalyticsBootstrap() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    const qs = search?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title
    });
  }, [pathname, search]);

  useEffect(() => {
    if (typeof window.gtag !== "function" || !user?.id) return;
    window.gtag("set", { user_id: user.id });
  }, [user?.id]);

  return null;
}
